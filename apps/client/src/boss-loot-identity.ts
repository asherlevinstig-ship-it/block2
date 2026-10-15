import { BUILD_PATHS, ITEM_DEFINITIONS, type BuildPathId, type ItemId } from "@blockcraft/protocol";

export interface BossLootIdentity {
  itemId: ItemId;
  itemName: string;
  callings: readonly BuildPathId[];
  fitLabel: string;
  dropLabel: string;
}

const ITEM_CALLINGS: Partial<Record<ItemId, readonly BuildPathId[]>> = {
  fang_dagger: ["assassin", "thief"],
  matriarch_edge: ["assassin", "thief"],
  acid_gland_focus: ["mage", "ranger"],
  venom_focus: ["mage", "ranger"],
  echo_prism: ["mage", "ranger"],
  stone_core_hammer: ["tank"],
  rootbound_hammer: ["tank"],
  rootguard_armour: ["tank"],
};

const BOSS_SIGNATURES: Readonly<Record<string, ItemId>> = {
  "crystal-matriarch": "matriarch_edge",
  "forest-guardian": "rootbound_hammer",
  "greenwood-venom-matriarch": "venom_focus",
  "realm-stone-warden": "rootbound_hammer",
};

function signatureForBoss(id: string, name: string, archetype: string): ItemId {
  if (BOSS_SIGNATURES[id]) return BOSS_SIGNATURES[id];
  if (/Razorhide Pack Sovereign/i.test(name)) return "fang_dagger";
  if (/Viridian Brood Oracle/i.test(name)) return "acid_gland_focus";
  if (/Worldsplitter Colossus|Stoneheart/i.test(name)) return "stone_core_hammer";
  if (/Ashglass/i.test(name)) return "echo_prism";
  if (archetype === "stone_brute") return "stone_core_hammer";
  if (archetype === "cave_spitter") return "acid_gland_focus";
  return "fang_dagger";
}

export function bossLootIdentity(id: string, name: string, archetype: string, activeCalling: BuildPathId | null): BossLootIdentity {
  const itemId = signatureForBoss(id, name, archetype);
  const callings = ITEM_CALLINGS[itemId] ?? [];
  const callingNames = callings.map(path => BUILD_PATHS[path].name);
  const fitLabel = activeCalling && callings.includes(activeCalling)
    ? `YOUR ${BUILD_PATHS[activeCalling].name.toUpperCase()} CALLING`
    : callingNames.length ? `BEST FOR ${callingNames.join(" / ").toUpperCase()}` : "WORKS WITH ANY CALLING";
  return {
    itemId,
    itemName: ITEM_DEFINITIONS[itemId].name,
    callings,
    fitLabel,
    dropLabel: id === "crystal-matriarch" || id === "greenwood-venom-matriarch" || id === "realm-stone-warden"
      ? "SIGNATURE CHANCE"
      : "LEADER CACHE",
  };
}

export function equipmentCallingFit(itemId: ItemId, activeCalling: BuildPathId | null): string {
  const callings = ITEM_CALLINGS[itemId] ?? [];
  if (!callings.length) return "Flexible equipment";
  if (activeCalling && callings.includes(activeCalling)) return `Fits your ${BUILD_PATHS[activeCalling].name} Calling`;
  return `Build path: ${callings.map(path => BUILD_PATHS[path].name).join(" / ")}`;
}
