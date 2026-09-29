import { z } from "zod";

export const WORLD_ROOM = "world";

export const MoveRequestSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
  yaw: z.number().finite().default(0),
});

export const MineBlockRequestSchema = z.object({
  requestId: z.string().min(1).max(64),
  expectedRevision: z.number().int().nonnegative(),
  x: z.number().int(),
  y: z.number().int(),
  z: z.number().int(),
});

export type MoveRequest = z.infer<typeof MoveRequestSchema>;
export type MineBlockRequest = z.infer<typeof MineBlockRequestSchema>;

export interface ChunkSnapshot {
  chunkX: number;
  chunkZ: number;
  revision: number;
  blocks: number[];
}

export interface WorldBootstrap {
  seed: string;
  chunkSize: number;
  chunkHeight: number;
  spawn: { x: number; y: number; z: number };
  chunks: ChunkSnapshot[];
}

export interface BlockChanged {
  requestId: string;
  x: number;
  y: number;
  z: number;
  block: number;
  revision: number;
}

export interface ActionRejected {
  requestId?: string;
  action: "move" | "mine";
  reason: "payload" | "range" | "protected" | "missing" | "collision" | "stale";
}
