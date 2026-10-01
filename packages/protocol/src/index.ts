import { z } from "zod";

export const WORLD_ROOM = "world";

export const MoveRequestSchema = z.object({
  sequence: z.number().int().positive(),
  strafe: z.number().finite().min(-1).max(1),
  forward: z.number().finite().min(-1).max(1),
  yaw: z.number().finite().default(0),
});

export const MineBlockRequestSchema = z.object({
  requestId: z.string().min(1).max(64),
  expectedRevision: z.number().int().nonnegative(),
  x: z.number().int(),
  y: z.number().int(),
  z: z.number().int(),
});

export const AttackRequestSchema = z.object({
  requestId: z.string().min(1).max(64),
  yaw: z.number().finite(),
});

export const DodgeRequestSchema = z.object({
  requestId: z.string().min(1).max(64),
  strafe: z.number().finite().min(-1).max(1),
  forward: z.number().finite().min(-1).max(1),
  yaw: z.number().finite(),
});

export type MoveRequest = z.infer<typeof MoveRequestSchema>;
export type MineBlockRequest = z.infer<typeof MineBlockRequestSchema>;
export type AttackRequest = z.infer<typeof AttackRequestSchema>;
export type DodgeRequest = z.infer<typeof DodgeRequestSchema>;

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

export interface CombatHit {
  attackerId: string;
  mobId: string;
  damage: number;
  health: number;
  defeated: boolean;
}

export interface PlayerHit {
  mobId: string;
  playerId: string;
  damage: number;
  health: number;
  defeated: boolean;
}

export interface CombatStagger {
  attackerId: string;
  mobId: string;
  durationMs: number;
}

export interface ActionRejected {
  requestId?: string;
  action: "move" | "mine" | "attack" | "dodge";
  reason: "payload" | "range" | "protected" | "missing" | "collision" | "stale" | "rate" | "stamina";
}
