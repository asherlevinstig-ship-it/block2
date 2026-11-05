export type ServiceNpcId = "smith-brom" | "healer-lyra" | "guild-steward-elin";
export type ServiceNpcPerformanceKind = "greet" | "forge" | "heal" | "guild";

export interface TownNpcFacingPoint {
  x: number;
  z: number;
}

/** Face the player using the same +Z-forward convention as town-life routes. */
export function serviceNpcFacingYaw(
  actor: TownNpcFacingPoint,
  player: TownNpcFacingPoint,
  fallbackYaw: number,
): number {
  const dx = player.x - actor.x;
  const dz = player.z - actor.z;
  return Math.hypot(dx, dz) < .001 ? fallbackYaw : Math.atan2(dx, dz) * 180 / Math.PI;
}

export function serviceNpcAnimation(kind: ServiceNpcPerformanceKind): string {
  if (kind === "forge") return "1H_Melee_Attack_Chop";
  if (kind === "heal") return "Spellcasting";
  return "Interact";
}

export function serviceNpcPerformanceDuration(kind: ServiceNpcPerformanceKind): number {
  if (kind === "greet") return 1_150;
  if (kind === "forge") return 1_350;
  if (kind === "heal") return 1_600;
  return 1_250;
}

export function serviceNpcPerformanceFor(npcId: ServiceNpcId): Exclude<ServiceNpcPerformanceKind, "greet"> {
  if (npcId === "smith-brom") return "forge";
  if (npcId === "healer-lyra") return "heal";
  return "guild";
}
