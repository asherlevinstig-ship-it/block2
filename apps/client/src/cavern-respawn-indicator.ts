export const CAVERN_RESPAWN_IDS = new Set([
  "shallow-cave-crawler",
  "deep-cave-spitter",
  "buried-vault-crawler",
  "buried-chamber-brute",
]);

export interface CavernRespawnIndicator {
  seconds: number;
  phase: "waiting" | "warning";
}

/** Keep cleared cavern rooms readable without exposing unrelated overworld spawns. */
export function cavernRespawnIndicator(mobId: string, alive: boolean, respawnAt: number,
  serverNow: number): CavernRespawnIndicator | null {
  if (alive || !CAVERN_RESPAWN_IDS.has(mobId) || !Number.isFinite(respawnAt) || respawnAt <= serverNow) return null;
  const seconds = Math.max(1, Math.ceil((respawnAt - serverNow) / 1_000));
  return { seconds, phase: seconds <= 5 ? "warning" : "waiting" };
}
