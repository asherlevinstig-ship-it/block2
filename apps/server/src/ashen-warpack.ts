import { ASHEN_HOUND_IDS, ASHEN_SENTRY_IDS } from "./wilderness-encounters.js";

export type AshenWarpackTactic = "ram-advance" | "ashglass-crossfire" | "pack-collapse";
type Point = { x: number; y: number; z: number };

export function ashenWarpackTactic(engagedAt: number, now: number, ramAlive: boolean, ramExposed: boolean,
  houndsAlive: number, sentriesAlive: number): AshenWarpackTactic {
  if (ramAlive && ramExposed && houndsAlive > 0) return "pack-collapse";
  if (sentriesAlive > 0 && Math.floor(Math.max(0, now - engagedAt) / 7_000) % 2 === 1) return "ashglass-crossfire";
  return "ram-advance";
}

export function ashenWarpackCooldownMultiplier(mobId: string, tactic: AshenWarpackTactic): number {
  if (tactic === "ram-advance" && mobId === "ashen-cinder-ram") return .72;
  if (tactic === "pack-collapse" && ASHEN_HOUND_IDS.some(id => id === mobId)) return .68;
  if (tactic === "ashglass-crossfire" && ASHEN_SENTRY_IDS.some(id => id === mobId)) return .78;
  return 1;
}

export function ashenWarpackSpeedMultiplier(mobId: string, tactic: AshenWarpackTactic): number {
  if (tactic === "ram-advance" && (mobId === "ashen-cinder-ram" || ASHEN_HOUND_IDS.some(id => id === mobId))) return 1.16;
  if (tactic === "pack-collapse" && ASHEN_HOUND_IDS.some(id => id === mobId)) return 1.24;
  return 1;
}

export function ashenSentryTacticalPattern(sequence: number, tactic: AshenWarpackTactic): "fan" | "aimed" {
  if (tactic === "ashglass-crossfire") return "aimed";
  if (tactic === "pack-collapse") return "fan";
  return sequence % 3 === 2 ? "aimed" : "fan";
}

export function ashenWarpackGoal(mobId: string, tactic: AshenWarpackTactic, target: Point,
  ram: Point | null): Point | null {
  const houndIndex = ASHEN_HOUND_IDS.findIndex(id => id === mobId);
  const sentryIndex = ASHEN_SENTRY_IDS.findIndex(id => id === mobId);
  if (houndIndex < 0 && sentryIndex < 0) return null;
  const anchor = ram ?? { x: target.x, y: target.y, z: target.z - 1 };
  const dx = target.x - anchor.x, dz = target.z - anchor.z;
  const length = Math.max(.001, Math.hypot(dx, dz));
  const forwardX = dx / length, forwardZ = dz / length;
  const sideX = forwardZ, sideZ = -forwardX;
  const side = (houndIndex >= 0 ? houndIndex : sentryIndex) === 0 ? -1 : 1;
  if (houndIndex >= 0) {
    if (tactic === "pack-collapse") return { x: anchor.x + forwardX * 1.35 + sideX * side * 1.15,
      y: target.y, z: anchor.z + forwardZ * 1.35 + sideZ * side * 1.15 };
    return { x: target.x - forwardX * .2 + sideX * side * 1.1,
      y: target.y, z: target.z - forwardZ * .2 + sideZ * side * 1.1 };
  }
  if (tactic !== "ashglass-crossfire" && tactic !== "pack-collapse") return null;
  const radius = tactic === "ashglass-crossfire" ? 5.4 : 4.4;
  return { x: target.x - forwardX * 1.1 + sideX * side * radius,
    y: target.y, z: target.z - forwardZ * 1.1 + sideZ * side * radius };
}
