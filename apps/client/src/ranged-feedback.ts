import { WEAPON_ATTACK_DEFINITIONS, type MainHandId } from "@blockcraft/protocol";
export const confirmedRangedHit = (weapon: MainHandId, damage: number, local: boolean) => local && damage > 0 && WEAPON_ATTACK_DEFINITIONS[weapon].projectileTravelMs > 0;
export function projectileImpactCue(id: string, reason: "hit" | "terrain" | "miss") {
  if (!(id.startsWith("weapon:") || id.startsWith("venom:")) || reason === "miss") return null;
  return reason === "terrain" ? "terrain" : "enemy";
}
