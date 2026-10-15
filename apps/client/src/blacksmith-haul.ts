import { BLACKSMITH_UPGRADES, type BlacksmithUpgradeId } from "@blockcraft/protocol";

const HAUL_UPGRADE_ORDER: readonly BlacksmithUpgradeId[] = [
  "reinforced_pickaxe", "iron_sword", "miners_pack", "explorer_pack", "adventurer_pack",
];

export function nextHaulUpgrade(owned: ReadonlySet<BlacksmithUpgradeId>): BlacksmithUpgradeId | null {
  return HAUL_UPGRADE_ORDER.find(id => !owned.has(id)) ?? null;
}

export function haulUpgradeProgress(upgradeId: BlacksmithUpgradeId, gold: number, iron: number, silver: number): { percent: number; detail: string } {
  const recipe = BLACKSMITH_UPGRADES[upgradeId];
  const requirements: { held: number; needed: number; label: string }[] = [];
  if (recipe.price > 0) requirements.push({ held: gold, needed: recipe.price, label: "gold" });
  if (recipe.ironOre > 0) requirements.push({ held: iron, needed: recipe.ironOre, label: "iron" });
  if ("silverOre" in recipe && recipe.silverOre > 0) requirements.push({ held: silver, needed: recipe.silverOre, label: "silver" });
  const percent = requirements.length ? Math.min(...requirements.map(entry => entry.held / entry.needed)) * 100 : 100;
  return {
    percent: Math.max(0, Math.min(100, percent)),
    detail: requirements.map(entry => `${Math.min(entry.held, entry.needed)} / ${entry.needed} ${entry.label}`).join(" · "),
  };
}

export type HaulRegion = { name: string; detail: string; x: number; y: number; z: number };
export function nextHaulRegion(level: number): HaulRegion {
  if (level <= 3) return { name: "Greenwood Camp", detail: "LV 2–5 · follow the east road", x: 42.5, y: 8, z: 19.5 };
  if (level <= 6) return { name: "Mistfen Marsh", detail: "LV 5–9 · seek the western boardwalk", x: -47.5, y: 8, z: -31.5 };
  if (level <= 9) return { name: "Stone Frontier", detail: "LV 8–12 · follow the southeast road", x: 42.5, y: 8, z: 41.5 };
  return { name: "Ashen Reach", detail: "LV 10+ · seek the split eastern spire", x: 97.5, y: 8, z: 62.5 };
}
