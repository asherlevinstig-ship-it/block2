import { SURFACE_HEIGHT, isInGreenwoodRegion, isInMistfenMarsh, isInNorthwatchHighlands } from "@blockcraft/voxel-world";

export const FORAGER_RECOVERY_PER_SECOND = 4;
export const FENWALKER_POOL_WARD_COOLDOWN_MS = 2_500;

export function foragerRecoveryBonus(armourId: string, x: number, y: number, z: number): number {
  return armourId === "forager_wrap" && y >= SURFACE_HEIGHT - 1 && isInGreenwoodRegion(x, z)
    ? FORAGER_RECOVERY_PER_SECOND : 0;
}

export function fenwalkerBlocksPoolPulse(armourId: string, x: number, y: number, z: number,
  now: number, wardReadyAt: number): boolean {
  return armourId === "fenwalker_mantle" && y >= SURFACE_HEIGHT - 1
    && isInMistfenMarsh(x, z) && now >= wardReadyAt;
}

export const NORTHWATCH_SHARD_WARD_COOLDOWN_MS = 8_000;
export function northwatchShardWardReady(armourId: string, archetype: string | undefined,
  kind: string, x: number, y: number, z: number, now: number, wardReadyAt: number): boolean {
  return (armourId === "ridgeguard_mantle" || armourId === "northwatch_cloak")
    && archetype === "shard_sentry" && kind === "projectile"
    && y >= SURFACE_HEIGHT - 1 && isInNorthwatchHighlands(x, z) && now >= wardReadyAt;
}
