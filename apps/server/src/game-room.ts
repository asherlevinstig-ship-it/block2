import { Client, Room } from "@colyseus/core";
import {
  AttackRequestSchema,
  COMBAT_ATTACKS,
  COMBO_CHAIN_WINDOW_MS,
  DodgeRequestSchema,
  MineBlockRequestSchema,
  MoveRequestSchema,
  POWER_DEFINITIONS,
  PowerCancelRequestSchema,
  PowerEquipRequestSchema,
  PowerRequestSchema,
  type ActionRejected,
  type BlockChanged,
  type ChunkSnapshot,
  type CombatHit,
  type CombatMiss,
  type CombatStagger,
  type PlayerHit,
  type PowerCast,
  type PowerCancelled,
  type PowerFracture,
  type PowerId,
  type PowerResolved,
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
  isProtectedVoxel,
  isPlayerSupported,
  resolvePlayerMotion,
  setBlock,
  worldToChunk,
  type GeneratedChunk,
} from "@blockcraft/voxel-world";
import { MobState, PlayerState, WorldState } from "./schema.js";
import { miningRejectionReason, movementRejectionReason, nextComboStep, selectAttackTarget } from "./action-rules.js";
import { canMobLungeHit, dodgeDirection, pursueTarget, selectAggroTarget } from "./combat-rules.js";
import { isGroundPowerTargetInRange, isPowerCompatible, lineFractureColumns, powerDirection, powerEvadeDirection, selectBurstPowerTargets, selectGroundPowerTargets, selectLinePowerTargets } from "./power-rules.js";
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

interface AttackChainState {
  step: 1 | 2 | 3;
  recoveryUntil: number;
  comboExpiresAt: number;
}

interface PendingAttack {
  requestId: string;
  yaw: number;
  step: 1 | 2 | 3;
  impactAt: number;
}

interface PendingPower {
  requestId: string;
  powerId: PowerId;
  yaw: number;
  impactAt: number;
  target?: { x: number; y: number; z: number };
}

export class WorldRoom extends Room<{ state: WorldState }> {
  override maxClients = 20;
  private readonly chunks = new Map<string, MutableChunk>();
  private readonly movementInputs = new Map<string, StoredMovementInput>();
  private readonly movementRateWindows = new Map<string, MovementRateWindow>();
  private readonly verticalVelocities = new Map<string, number>();
  private readonly attackChains = new Map<string, AttackChainState>();
  private readonly pendingAttacks = new Map<string, PendingAttack>();
  private readonly pendingPowers = new Map<string, PendingPower>();
  private readonly lastMobAttackAt = new Map<string, number>();
  private readonly lastDodgeAt = new Map<string, number>();
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
    this.onMessage("dodge", (client, payload) => this.handleDodge(client, payload));
    this.onMessage("power", (client, payload) => this.handlePower(client, payload));
    this.onMessage("power:cancel", (client, payload) => this.handlePowerCancel(client, payload));
    this.onMessage("power:equip", (client, payload) => this.handlePowerEquip(client, payload));
    this.setSimulationInterval(deltaTime => this.simulatePlayers(Math.min(deltaTime / 1000, 0.1)), 50);
  }

  override onJoin(client: Client, options: unknown): void {
    const player = new PlayerState();
    // Assign after construction so Colyseus includes the loadout in the initial
    // patch instead of eliding it as an unchanged schema default.
    player.equippedPower = "shockwave";
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
    this.attackChains.delete(client.sessionId);
    this.pendingAttacks.delete(client.sessionId);
    this.pendingPowers.delete(client.sessionId);
    this.lastDodgeAt.delete(client.sessionId);
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
    this.resolvePendingPowers(now);
    this.resolvePendingAttacks(now);
    for (const [mobId, mob] of this.state.mobs) {
      if (!mob.alive && now >= mob.respawnAt) {
        mob.x = 13.5;
        mob.y = 8;
        mob.z = 11.5;
        mob.health = mob.maxHealth;
        mob.alive = true;
        mob.respawnAt = 0;
        mob.combatState = "idle";
        mob.stateUntil = 0;
        mob.targetId = "";
      }
      if (!mob.alive) continue;
      if (mob.combatState === "stagger" || mob.combatState === "recover") {
        if (now < mob.stateUntil) continue;
        mob.combatState = "idle";
        mob.stateUntil = 0;
      }
      if (mob.combatState === "windup") {
        const targetPlayer = this.state.players.get(mob.targetId);
        if (targetPlayer) {
          mob.yaw = Math.atan2(targetPlayer.x - mob.x, targetPlayer.z - mob.z) * 180 / Math.PI;
        }
        if (now < mob.stateUntil) continue;
        mob.combatState = "recover";
        mob.stateUntil = now + 450;
        mob.actionSequence += 1;
        this.lastMobAttackAt.set(mobId, now);
        if (!targetPlayer) continue;
        const deltaX = targetPlayer.x - mob.x;
        const deltaZ = targetPlayer.z - mob.z;
        const distance = Math.hypot(deltaX, deltaZ);
        if (distance > 0.001) {
          const lungeDistance = Math.min(0.85, Math.max(0, distance - 0.8));
          mob.x += deltaX / distance * lungeDistance;
          mob.z += deltaZ / distance * lungeDistance;
        }
        if (!canMobLungeHit(mob, targetPlayer, targetPlayer.invulnerableUntil, now)) continue;
        targetPlayer.health = Math.max(0, targetPlayer.health - 1);
        const defeated = targetPlayer.health === 0;
        const hit: PlayerHit = { mobId, playerId: mob.targetId, damage: 1, health: targetPlayer.health, defeated };
        this.broadcast("combat:player-hit", hit);
        if (defeated) {
          const spawn = this.spawnPoint();
          targetPlayer.x = spawn.x;
          targetPlayer.y = spawn.y;
          targetPlayer.z = spawn.z;
          targetPlayer.health = targetPlayer.maxHealth;
          targetPlayer.stamina = targetPlayer.maxStamina;
          this.pendingAttacks.delete(mob.targetId);
          this.pendingPowers.delete(mob.targetId);
          this.attackChains.delete(mob.targetId);
          this.movementInputs.set(mob.targetId, { request: idleMovementInput(), receivedAt: now });
          this.verticalVelocities.set(mob.targetId, 0);
          mob.x = 13.5;
          mob.y = 8;
          mob.z = 11.5;
          mob.combatState = "recover";
        }
        continue;
      }
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
      mob.combatState = "windup";
      mob.stateUntil = now + 650;
      mob.targetId = target.id;
    }
    for (const [sessionId, player] of this.state.players) {
      player.stamina = Math.min(player.maxStamina, player.stamina + 18 * deltaTime);
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

  private handleDodge(client: Client, payload: unknown): void {
    const parsed = DodgeRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "dodge", reason: "payload" });
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const now = Date.now();
    const lastDodgeAt = this.lastDodgeAt.get(client.sessionId) ?? 0;
    if (now - lastDodgeAt < 350) return this.reject(client, { requestId: parsed.data.requestId, action: "dodge", reason: "rate" });
    if (player.stamina < 35) return this.reject(client, { requestId: parsed.data.requestId, action: "dodge", reason: "stamina" });
    this.cancelPendingPower(client.sessionId, "dodge");
    const direction = dodgeDirection(parsed.data.strafe, parsed.data.forward, parsed.data.yaw);
    const next = resolvePlayerMotion(
      { x: player.x, y: player.y, z: player.z },
      { x: direction.x * 1.8, y: 0, z: direction.z * 1.8 },
      this.readWorldBlock,
    );
    player.x = next.x;
    player.y = next.y;
    player.z = next.z;
    player.yaw = parsed.data.yaw;
    player.stamina -= 35;
    player.invulnerableUntil = now + 320;
    player.dodgeSequence += 1;
    this.lastDodgeAt.set(client.sessionId, now);
  }

  private handlePower(client: Client, payload: unknown): void {
    const parsed = PowerRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "power", reason: "payload" });
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const powerId = parsed.data.powerId as PowerId;
    const definition = POWER_DEFINITIONS[powerId];
    if (!definition || player.equippedPower !== powerId) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "power", reason: "missing" });
    }
    if (!isPowerCompatible(definition, player.mainHandTag)) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "power", reason: "compatibility" });
    }
    const now = Date.now();
    if (this.pendingPowers.has(client.sessionId)) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "power", reason: "rate" });
    }
    if (now < player.powerCooldownUntil) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "power", reason: "cooldown" });
    }
    const target = parsed.data.target;
    if (definition.core === "ground") {
      if (!target) {
        return this.reject(client, { requestId: parsed.data.requestId, action: "power", reason: "payload" });
      }
      if (!isGroundPowerTargetInRange(player, target, definition.range)) {
        return this.reject(client, { requestId: parsed.data.requestId, action: "power", reason: "range" });
      }
      if (!isPlayerSupported(this.readWorldBlock, target.x, target.y, target.z)) {
        return this.reject(client, { requestId: parsed.data.requestId, action: "power", reason: "collision" });
      }
    } else if (target) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "power", reason: "payload" });
    }
    player.yaw = parsed.data.yaw;
    player.powerCooldownUntil = now + definition.cooldownMs;
    player.powerCastStartedAt = now;
    player.powerSequence += 1;
    this.pendingPowers.set(client.sessionId, {
      requestId: parsed.data.requestId,
      powerId,
      yaw: parsed.data.yaw,
      impactAt: now + definition.windupMs,
      ...(target ? { target } : {}),
    });
    if (definition.core === "line") {
      const threatened = selectLinePowerTargets(
        player,
        parsed.data.yaw,
        [...this.state.mobs.entries()].map(([id, mob]) => ({ id, x: mob.x, y: mob.y, z: mob.z, alive: mob.alive })),
        definition.range,
        definition.width,
      );
      for (const target of threatened) {
        const mob = this.state.mobs.get(target.id);
        if (!mob || !mob.alive || mob.combatState === "stagger") continue;
        const evade = powerEvadeDirection(player, parsed.data.yaw, mob);
        const sidestep = resolvePlayerMotion(
          { x: mob.x, y: mob.y, z: mob.z },
          { x: evade.x * 0.58, y: 0, z: evade.z * 0.58 },
          this.readWorldBlock,
        );
        mob.x = sidestep.x;
        mob.y = sidestep.y;
        mob.z = sidestep.z;
        mob.yaw = Math.atan2(player.x - mob.x, player.z - mob.z) * 180 / Math.PI;
      }
    }
    const cast: PowerCast = {
      casterId: client.sessionId,
      powerId,
      x: player.x,
      y: player.y,
      z: player.z,
      yaw: parsed.data.yaw,
      startedAt: now,
      windupMs: definition.windupMs,
      ...(target ? { target } : {}),
    };
    this.broadcast("power:cast", cast);
  }

  private handlePowerCancel(client: Client, payload: unknown): void {
    const parsed = PowerCancelRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "power", reason: "payload" });
    this.cancelPendingPower(client.sessionId, "cancel");
  }

  private handlePowerEquip(client: Client, payload: unknown): void {
    const parsed = PowerEquipRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "power", reason: "payload" });
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const definition = POWER_DEFINITIONS[parsed.data.powerId];
    if (!definition || !isPowerCompatible(definition, player.mainHandTag)) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "power", reason: "compatibility" });
    }
    if (this.pendingPowers.has(client.sessionId)) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "power", reason: "rate" });
    }
    player.equippedPower = parsed.data.powerId;
  }

  private cancelPendingPower(sessionId: string, reason: PowerCancelled["reason"]): boolean {
    const pending = this.pendingPowers.get(sessionId);
    if (!pending) return false;
    this.pendingPowers.delete(sessionId);
    const player = this.state.players.get(sessionId);
    if (player) {
      player.powerCooldownUntil = 0;
      player.powerCastStartedAt = 0;
    }
    this.broadcast("power:cancelled", {
      casterId: sessionId,
      powerId: pending.powerId,
      reason,
    } satisfies PowerCancelled);
    return true;
  }

  private fractureTerrain(requestId: string, x: number, z: number, playerY: number): PowerFracture | null {
    if (isProtectedVoxel(x, z)) return null;
    const top = Math.min(CHUNK_HEIGHT - 1, Math.floor(playerY));
    const bottom = Math.max(1, top - 4);
    for (let y = top; y >= bottom; y -= 1) {
      const block = this.readWorldBlock(x, y, z);
      if (block === Block.Air) continue;
      if (block === Block.Bedrock) return null;
      if (block === Block.Grass) {
        const address = worldToChunk(x, z);
        const stored = this.getChunk(address.chunkX, address.chunkZ);
        setBlock(stored.chunk, address.localX, y, address.localZ, Block.Dirt);
        stored.revision += 1;
        this.broadcast("block:changed", {
          requestId: `${requestId}-fracture-${x}-${z}`,
          x,
          y,
          z,
          block: Block.Dirt,
          revision: stored.revision,
        } satisfies BlockChanged);
      }
      return { x, y, z };
    }
    return null;
  }

  private resolvePendingPowers(now: number): void {
    for (const [sessionId, pending] of this.pendingPowers) {
      if (now < pending.impactAt) continue;
      this.pendingPowers.delete(sessionId);
      const player = this.state.players.get(sessionId);
      const definition = POWER_DEFINITIONS[pending.powerId];
      if (!player || !definition) continue;
      const direction = powerDirection(pending.yaw);
      const stepped = resolvePlayerMotion(
        { x: player.x, y: player.y, z: player.z },
        { x: direction.x * definition.forwardStep, y: 0, z: direction.z * definition.forwardStep },
        this.readWorldBlock,
      );
      player.x = stepped.x;
      player.y = stepped.y;
      player.z = stepped.z;
      const availableTargets = [...this.state.mobs.entries()].map(([id, mob]) => ({
        id,
        x: mob.x,
        y: mob.y,
        z: mob.z,
        alive: mob.alive,
      }));
      const impactCenter = definition.core === "ground" && pending.target ? pending.target : player;
      const targets = definition.core === "burst"
        ? selectBurstPowerTargets(player, availableTargets, definition.range)
        : definition.core === "ground"
          ? selectGroundPowerTargets(impactCenter, availableTargets, definition.width)
          : selectLinePowerTargets(player, pending.yaw, availableTargets, definition.range, definition.width);
      const defeatedMobIds: string[] = [];
      for (const target of targets) {
        const mob = this.state.mobs.get(target.id);
        if (!mob || !mob.alive) continue;
        mob.health = Math.max(0, mob.health - definition.damage);
        mob.hitSequence += 1;
        const radialX = mob.x - impactCenter.x;
        const radialZ = mob.z - impactCenter.z;
        const radialLength = Math.hypot(radialX, radialZ);
        const knockbackDirection = (definition.core === "burst" || definition.core === "ground") && radialLength > 0.001
          ? { x: radialX / radialLength, z: radialZ / radialLength }
          : direction;
        const knockedBack = resolvePlayerMotion(
          { x: mob.x, y: mob.y, z: mob.z },
          { x: knockbackDirection.x * definition.knockback, y: 0, z: knockbackDirection.z * definition.knockback },
          this.readWorldBlock,
        );
        mob.x = knockedBack.x;
        mob.z = knockedBack.z;
        if (mob.health === 0) {
          mob.alive = false;
          mob.respawnAt = now + 5000;
          mob.combatState = "idle";
          mob.stateUntil = 0;
          mob.targetId = "";
          defeatedMobIds.push(target.id);
        } else {
          mob.combatState = "stagger";
          mob.stateUntil = now + definition.staggerMs;
          mob.targetId = "";
          mob.staggerSequence += 1;
        }
      }
      const fractures = definition.fracturesTerrain && definition.core === "line"
        ? lineFractureColumns(player, pending.yaw, definition.range)
            .map(column => this.fractureTerrain(pending.requestId, column.x, column.z, player.y))
            .filter((fracture): fracture is PowerFracture => fracture !== null)
        : [];
      const resolved: PowerResolved = {
        casterId: sessionId,
        powerId: pending.powerId,
        x: impactCenter.x,
        y: impactCenter.y,
        z: impactCenter.z,
        yaw: pending.yaw,
        hitCount: targets.length,
        damage: definition.damage,
        defeatedMobIds,
        fractures,
      };
      this.broadcast("power:resolved", resolved);
    }
  }

  private handleMine(client: Client, payload: unknown): void {
    const parsed = MineBlockRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "mine", reason: "payload" });
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (this.pendingPowers.has(client.sessionId)) {
      const requestId = typeof payload === "object" && payload && "requestId" in payload && typeof payload.requestId === "string"
        ? payload.requestId
        : undefined;
      return this.reject(client, { requestId, action: "mine", reason: "rate" });
    }
    const request = parsed.data;
    player.attackStep = 0;
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
    if (this.pendingPowers.has(client.sessionId)) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "attack", reason: "rate" });
    }
    const now = Date.now();
    const chain = this.attackChains.get(client.sessionId);
    if (chain && now < chain.recoveryUntil) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "attack", reason: "rate" });
    }
    const step = chain ? nextComboStep(chain.step, chain.comboExpiresAt, now) : 1;
    const timing = COMBAT_ATTACKS[step - 1]!;
    this.attackChains.set(client.sessionId, {
      step,
      recoveryUntil: now + timing.durationMs,
      comboExpiresAt: now + timing.durationMs + COMBO_CHAIN_WINDOW_MS,
    });
    this.pendingAttacks.set(client.sessionId, {
      requestId: parsed.data.requestId,
      yaw: parsed.data.yaw,
      step,
      impactAt: now + timing.impactMs,
    });
    player.yaw = parsed.data.yaw;
    player.attackStep = step;
    player.actionSequence += 1;
  }

  private resolvePendingAttacks(now: number): void {
    for (const [sessionId, pending] of this.pendingAttacks) {
      if (now < pending.impactAt) continue;
      this.pendingAttacks.delete(sessionId);
      const player = this.state.players.get(sessionId);
      if (!player) continue;
      const timing = COMBAT_ATTACKS[pending.step - 1]!;
      const targets = [...this.state.mobs.entries()].map(([id, mob]) => ({
        id,
        x: mob.x,
        y: mob.y,
        z: mob.z,
        alive: mob.alive,
      }));
      const target = selectAttackTarget(player, pending.yaw, targets);
      if (!target) {
        const miss: CombatMiss = { attackerId: sessionId, comboStep: pending.step };
        this.broadcast("combat:miss", miss);
        continue;
      }
      const mob = this.state.mobs.get(target.id);
      if (!mob || !mob.alive) continue;
      mob.health = Math.max(0, mob.health - timing.damage);
      mob.hitSequence += 1;
      if (mob.combatState === "windup") {
        mob.combatState = "stagger";
        mob.stateUntil = now + 900;
        mob.targetId = "";
        mob.staggerSequence += 1;
        const stagger: CombatStagger = { attackerId: sessionId, mobId: target.id, durationMs: 900 };
        this.broadcast("combat:stagger", stagger);
      }
      const deltaX = mob.x - player.x;
      const deltaZ = mob.z - player.z;
      const distance = Math.hypot(deltaX, deltaZ);
      if (distance > 0.001 && timing.knockback > 0) {
        const next = resolvePlayerMotion(
          { x: mob.x, y: mob.y, z: mob.z },
          { x: deltaX / distance * timing.knockback, y: 0, z: deltaZ / distance * timing.knockback },
          this.readWorldBlock,
        );
        mob.x = next.x;
        mob.z = next.z;
      }
      if (mob.health === 0) {
        mob.alive = false;
        mob.respawnAt = now + 5000;
        mob.combatState = "idle";
        mob.stateUntil = 0;
        mob.targetId = "";
      }
      const hit: CombatHit = {
        attackerId: sessionId,
        mobId: target.id,
        damage: timing.damage,
        health: mob.health,
        defeated: !mob.alive,
        comboStep: pending.step,
        knockback: timing.knockback,
      };
      this.broadcast("combat:hit", hit);
    }
  }
}
