import { Client, Room } from "@colyseus/core";
import {
  MineBlockRequestSchema,
  MoveRequestSchema,
  type ActionRejected,
  type BlockChanged,
  type ChunkSnapshot,
  type WorldBootstrap,
} from "@blockcraft/protocol";
import {
  Block,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  generateChunk,
  getBlock,
  highestSolidY,
  setBlock,
  worldToChunk,
  type GeneratedChunk,
} from "@blockcraft/voxel-world";
import { PlayerState, WorldState } from "./schema.js";
import { miningRejectionReason, movementRejectionReason } from "./action-rules.js";

interface MutableChunk {
  chunk: GeneratedChunk;
  revision: number;
}

export class WorldRoom extends Room<{ state: WorldState }> {
  override maxClients = 20;
  private readonly chunks = new Map<string, MutableChunk>();
  private worldSeed = "blockcraft-dev";

  override onCreate(): void {
    this.worldSeed = String(process.env.WORLD_SEED || "blockcraft-dev");
    this.setState(new WorldState());
    this.onMessage("world:ready", client => client.send("world:bootstrap", this.bootstrapPayload()));
    this.onMessage("move", (client, payload) => this.handleMove(client, payload));
    this.onMessage("mine", (client, payload) => this.handleMine(client, payload));
  }

  override onJoin(client: Client, options: unknown): void {
    const player = new PlayerState();
    const requestedName = typeof options === "object" && options && "name" in options ? String(options.name) : "Explorer";
    player.name = requestedName.replace(/[^A-Za-z0-9 _-]/g, "").trim().slice(0, 20) || "Explorer";
    const spawn = this.spawnPoint();
    player.x = spawn.x;
    player.y = spawn.y;
    player.z = spawn.z;
    this.state.players.set(client.sessionId, player);
  }

  override onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
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
    return {
      seed: this.worldSeed,
      chunkSize: CHUNK_SIZE,
      chunkHeight: CHUNK_HEIGHT,
      spawn: this.spawnPoint(),
      chunks: [this.snapshot(0, 0)],
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
    const rejection = movementRejectionReason(player, parsed.data);
    if (rejection) return this.reject(client, { action: "move", reason: rejection });
    player.x = parsed.data.x;
    player.y = parsed.data.y;
    player.z = parsed.data.z;
    player.yaw = parsed.data.yaw;
  }

  private handleMine(client: Client, payload: unknown): void {
    const parsed = MineBlockRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "mine", reason: "payload" });
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const request = parsed.data;
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
}
