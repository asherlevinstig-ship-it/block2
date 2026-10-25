import type { BuildPathId, ItemId } from "@blockcraft/protocol";

export function greenwoodFirstClearBossId(fastWorld: boolean): "greenwood-elderthorn" | "wild-crawler" {
  return fastWorld ? "greenwood-elderthorn" : "wild-crawler";
}

/** An accessible first weapon, not a second rare trophy or a forced class choice. */
export function greenwoodFirstClearWeapon(pathId: BuildPathId | null): ItemId {
  switch (pathId) {
    case "assassin":
    case "thief": return "fang_dagger";
    case "ranger": return "forged_bow";
    case "mage":
    case "healer": return "forged_focus";
    default: return "forged_sword";
  }
}
