import { Client, Room } from "@colyseus/core";
import {
  AttackRequestSchema,
  MineBlockRequestSchema,
  MoveRequestSchema,
  type ActionRejected,
  type BlockChanged,
  type ChunkSnapshot,
  type CombatHit,
  type PlayerHit,
  type WorldBootstrap,
} from "@blockcraft/protocol";
import {
  Block,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  GRAVITY,
  TERMINAL_VELOCITY,
  generateChunk,
  getBlock,
  highestSolidY,
  isPlayerSupported,
  resolvePlayerMotion,
  setBlock,
  worldToChunk,
  type GeneratedChunk,
} from "@blockcraft/voxel-world";
import { MobState, PlayerState, WorldState } from "./schema.js";
import { attackRejectionReason, miningRejectionReason, movementRejectionReason, selectAttackTarget } from "./action-rules.js";
import { pursueTarget, selectAggroTarget } from "./combat-rules.js";
import {
  activeMovementInput,
  idleMovementInput,
  recordMovementMessage,
  type MovementRateWindow,
  type StoredMovementInput,
} from "./movement-input.js";

interface MutableChunk {
  chunk: GeneratedChunk;
  revision: number;
}

export class WorldRoom extends Room<{ state: WorldState }> {
  override maxClients = 20;
  private readonly chunks = new Map<string, MutableChunk>();
  private readonly movementInputs = new Map<string, StoredMovementInput>();
  private readonly movementRateWindows = new Map<string, MovementRateWindow>();
  private readonly verticalVelocities = new Map<string, number>();
  private readonly lastAttackAt = new Map<string, number>();
  private readonly lastMobAttackAt = new Map<string, number>();
  private worldSeed = "blockcraft-dev";

  override onCreate(): void {
    this.worldSeed = String(process.env.WORLD_SEED || "blockcraft-dev");
    this.setState(new WorldState());
    const crawler = new MobState();
    this.state.mobs.set("moss-crawler", crawler);
    this.onMessage("world:ready", client => client.send("world:bootstrap", this.bootstrapPayload()));
    this.onMessage("ping", (client, payload: unknown) => {
      if (typeof payload === "object" && payload && "id" in payload && typeof payload.id === "string") {
        client.send("pong", { id: payload.id });
      }
    });
    this.onMessage("move", (client, payload) => this.handleMove(client, payload));
    this.onMessage("mine", (client, payload) => this.handleMine(client, payload));
    this.onMessage("attack", (client, payload) => this.handleAttack(client, payload));
    this.setSimulationInterval(deltaTime => this.simulatePlayers(Math.min(deltaTime / 1000, 0.1)), 50);
  }

  override onJoin(client: Client, options: unknown): void {
    const player = new PlayerState();
    const requestedName = typeof options === "object" && options && "name" in options ? String(options.name) : "Explorer";
    player.name = requestedName.replace(/[^A-Za-z0-9 _-]/g, "").trim().slice(0, 20) || "Explorer";
    const requestedQaSpawn = typeof options === "object" && options && "qaSpawn" in options ? String(options.qaSpawn) : "";
    const spawn = process.env.NODE_ENV !== "production" && requestedQaSpawn === "cave"
      ? { x: 23.5, y: 3, z: 8.5 }
      : this.spawnPoint();
    player.x = spawn.x;
    player.y = spawn.y;
    player.z = spawn.z;
    this.state.players.set(client.sessionId, player);
    this.movementInputs.set(client.sessionId, { request: idleMovementInput(), receivedAt: Date.now() });
    this.verticalVelocities.set(client.sessionId, 0);
  }

  override onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    this.movementInputs.delete(client.sessionId);
    this.movementRateWindows.delete(client.sessionId);
    this.verticalVelocities.delete(client.sessionId);
    this.lastAttackAt.delete(client.sessionId);
  }

  private chunkKey(chunkX: number, chunkZ: number): string {
    return `${chunkX},${chunkZ}`;
  }

  private getChunk(chunkX: number, chunkZ: number): MutableChunk {
    const key = this.chunkKey(chunkX, chunkZ);
    let stored = this.chunks.get(key);
    if (!stored) {
      stored = { chunk: generateChunk(this.worldSeed, chunkX, chunkZ), revision: 0 };
      this.chunks.set(key, stored);
    }
    return stored;
  }

  private snapshot(chunkX: number, chunkZ: number): ChunkSnapshot {
    const stored = this.getChunk(chunkX, chunkZ);
    return { chunkX, chunkZ, revision: stored.revision, blocks: [...stored.chunk.blocks] };
  }

  private bootstrapPayload(): WorldBootstrap {
    const chunks: ChunkSnapshot[] = [];
    for (let chunkZ = -1; chunkZ <= 1; chunkZ += 1) {
      for (let chunkX = -1; chunkX <= 1; chunkX += 1) chunks.push(this.snapshot(chunkX, chunkZ));
    }
    return {
      seed: this.worldSeed,
      chunkSize: CHUNK_SIZE,
      chunkHeight: CHUNK_HEIGHT,
      spawn: this.spawnPoint(),
      chunks,
    };
  }

  private spawnPoint(): { x: number; y: number; z: number } {
    const chunk = this.getChunk(0, 0).chunk;
    return { x: 8.5, y: highestSolidY(chunk, 8, 8) + 1, z: 8.5 };
  }

  private reject(client: Client, rejection: ActionRejected): void {
    client.send("action:rejected", rejection);
  }

  private handleMove(client: Client, payload: unknown): void {
    const parsed = MoveRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "move", reason: "payload" });
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const now = Date.now();
    const rate = recordMovementMessage(this.movementRateWindows.get(client.sessionId), now);
    this.movementRateWindows.set(client.sessionId, rate.window);
    if (!rate.allowed) return this.reject(client, { action: "move", reason: "rate" });
    const previous = this.movementInputs.get(client.sessionId);
    if (previous && parsed.data.sequence <= previous.request.sequence) return;
    const rejection = movementRejectionReason(player, parsed.data);
    if (rejection) return this.reject(client, { action: "move", reason: rejection });
    player.yaw = parsed.data.yaw;
    this.movementInputs.set(client.sessionId, { request: parsed.data, receivedAt: now });
  }

  private readWorldBlock = (x: number, y: number, z: number) => {
    if (y < 0) return Block.Bedrock;
    if (y >= CHUNK_HEIGHT) return Block.Air;
    const address = worldToChunk(x, z);
    return getBlock(this.getChunk(address.chunkX, address.chunkZ).chunk, address.localX, y, address.localZ);
  };

  private simulatePlayers(deltaTime: number): void {
    const now = Date.now();
    for (const [mobId, mob] of this.state.mobs) {
      if (!mob.alive && now >= mob.respawnAt) {
        mob.x = 13.5;
        mob.y = 8;
        mob.z = 11.5;
        mob.health = mob.maxHealth;
        mob.alive = true;
        mob.respawnAt = 0;
      }
      if (!mob.alive) continue;
      const players = [...this.state.players.entries()].map(([id, player]) => ({
        id,
        x: player.x,
        y: player.y,
        z: player.z,
        health: player.health,
      }));
      const target = selectAggroTarget(mob, players);
      if (!target) {
        const homeward = pursueTarget(mob, { x: 13.5, y: 8, z: 11.5 }, deltaTime, 0.9, 0.05);
        mob.x = homeward.x;
        mob.z = homeward.z;
        if (Math.hypot(13.5 - mob.x, 11.5 - mob.z) > 0.05) mob.yaw = homeward.yaw;
        continue;
      }
      const pursuit = pursueTarget(mob, target, deltaTime);
      mob.x = pursuit.x;
      mob.z = pursuit.z;
      mob.yaw = pursuit.yaw;
      const lastAttackAt = this.lastMobAttackAt.get(mobId) ?? 0;
      if (!pursuit.inAttackRange || now - lastAttackAt < 1100) continue;
      const player = this.state.players.get(target.id);
      if (!player) continue;
      this.lastMobAttackAt.set(mobId, now);
      mob.actionSequence += 1;
      player.health = Math.max(0, player.health - 1);
      const defeated = player.health === 0;
      const hit: PlayerHit = { mobId, playerId: target.id, damage: 1, health: player.health, defeated };
      this.broadcast("combat:player-hit", hit);
      if (defeated) {
        const spawn = this.spawnPoint();
        player.x = spawn.x;
        player.y = spawn.y;
        player.z = spawn.z;
        player.health = player.maxHealth;
        this.movementInputs.set(target.id, { request: idleMovementInput(), receivedAt: now });
        this.verticalVelocities.set(target.id, 0);
        mob.x = 13.5;
        mob.y = 8;
        mob.z = 11.5;
      }
    }
    for (const [sessionId, player] of this.state.players) {
      const input = activeMovementInput(this.movementInputs.get(sessionId), now, player.yaw);
      const inputLength = Math.hypot(input.strafe, input.forward);
      const scale = inputLength > 1 ? 1 / inputLength : 1;
      const speed = 4.2;
      const grounded = isPlayerSupported(this.readWorldBlock, player.x, player.y, player.z);
      let verticalVelocity = this.verticalVelocities.get(sessionId) ?? 0;
      if (grounded && verticalVelocity < 0) verticalVelocity = 0;
      else verticalVelocity = Math.max(-TERMINAL_VELOCITY, verticalVelocity - GRAVITY * deltaTime);

      const next = resolvePlayerMotion(
        { x: player.x, y: player.y, z: player.z },
        {
          x: input.strafe * scale * speed * deltaTime,
          y: verticalVelocity * deltaTime,
          z: input.forward * scale * speed * deltaTime,
        },
        this.readWorldBlock,
      );
      if (next.hitVertical || next.grounded) verticalVelocity = 0;
      this.verticalVelocities.set(sessionId, verticalVelocity);
      player.x = next.x;
      player.y = next.y;
      player.z = next.z;
      player.lastProcessedInput = input.sequence;
    }
  }

  private handleMine(client: Client, payload: unknown): void {
    const parsed = MineBlockRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "mine", reason: "payload" });
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const request = parsed.data;
    player.actionSequence += 1;
    const address = worldToChunk(request.x, request.z);
    const stored = this.getChunk(address.chunkX, address.chunkZ);
    const current = getBlock(stored.chunk, address.localX, request.y, address.localZ);
    const rejection = miningRejectionReason(player, request, current, stored.revision);
    if (rejection) return this.reject(client, { requestId: request.requestId, action: "mine", reason: rejection });
    setBlock(stored.chunk, address.localX, request.y, address.localZ, Block.Air);
    stored.revision += 1;
    const changed: BlockChanged = {
      requestId: request.requestId,
      x: request.x,
      y: request.y,
      z: request.z,
      block: Block.Air,
      revision: stored.revision,
    };
    this.broadcast("block:changed", changed);
  }

  private handleAttack(client: Client, payload: unknown): void {
    const parsed = AttackRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "attack", reason: "payload" });
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const now = Date.now();
    const rejection = attackRejectionReason(this.lastAttackAt.get(client.sessionId), now);
    if (rejection) return this.reject(client, { requestId: parsed.data.requestId, action: "attack", reason: rejection });
    this.lastAttackAt.set(client.sessionId, now);
    player.yaw = parsed.data.yaw;
    player.actionSequence += 1;
    const targets = [...this.state.mobs.entries()].map(([id, mob]) => ({
      id,
      x: mob.x,
      y: mob.y,
      z: mob.z,
      alive: mob.alive,
    }));
    const target = selectAttackTarget(player, parsed.data.yaw, targets);
    if (!target) return;
    const mob = this.state.mobs.get(target.id);
    if (!mob || !mob.alive) return;
    mob.health = Math.max(0, mob.health - 1);
    mob.hitSequence += 1;
    if (mob.health === 0) {
      mob.alive = false;
      mob.respawnAt = now + 5000;
    }
    const hit: CombatHit = {
      attackerId: client.sessionId,
      mobId: target.id,
      damage: 1,
      health: mob.health,
      defeated: !mob.alive,
    };
    this.broadcast("combat:hit", hit);
  }
}
