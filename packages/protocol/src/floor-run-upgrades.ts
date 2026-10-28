import type { BuildPathId, CallingAbilityId } from "./index.js";

export interface FloorUpgradeDefinition {
  id: string; path: BuildPathId; name: string; branch: string; detail: string;
  ability?: CallingAbilityId;
}
// Ability upgrades are offered only for an equipped, unlocked ability.
export const FLOOR_RUN_UPGRADES: readonly FloorUpgradeDefinition[] = [
  { id: "tank_riposte", path: "tank", name: "Shield Reprisal", branch: "Vanguard", detail: "Parry to empower your next weapon hit within 5s: +2 damage." },
  { id: "tank_guard", path: "tank", name: "Steadfast Guard", branch: "Guardian", detail: "Blocking costs 4 less stamina. Keep your guard facing incoming attacks." },
  { id: "tank_breaker", path: "tank", name: "Crushing Timing", branch: "Breaker", detail: "A weapon hit during an enemy windup can interrupt it for 350ms, including brutes. 3s cooldown." },
  { id: "tank_wall", path: "tank", name: "Sheltering Wall", branch: "Guardian", ability: "tank_bulwark", detail: "Bulwark lasts 2s longer and prevents 1 extra damage for allies behind you." },
  { id: "tank_challenge", path: "tank", name: "Commanding Presence", branch: "Vanguard", ability: "tank_challenge", detail: "Challenge reaches 3m farther, pulling attention from a wider group." },
  { id: "tank_fault", path: "tank", name: "Spreading Fault", branch: "Breaker", ability: "tank_earthbreaker", detail: "Earthbreaker reaches 1.5m farther. Catch more dangerous windups." },
  { id: "mage_chain", path: "mage", name: "Arc Jump", branch: "Stormcaller", detail: "A weapon hit arcs for 1 damage to one other visible enemy within 4m. 3s cooldown." },
  { id: "mage_distance", path: "mage", name: "Distant Focus", branch: "Arcanist", detail: "Weapon hits from at least 6m away deal +1 damage. Maintain your distance." },
  { id: "mage_reserve", path: "mage", name: "Deep Focus", branch: "Spellguard", detail: "At 80+ stamina, a weapon hit spends 8 stamina to deal +1 damage." },
  { id: "mage_surge", path: "mage", name: "Expanding Surge", branch: "Stormcaller", ability: "mage_arcane_surge", detail: "Arcane Surge reaches 2m farther, controlling a wider crowd." },
  { id: "mage_shield", path: "mage", name: "Shield Release", branch: "Spellguard", ability: "mage_mana_shield", detail: "Absorbing damage with Mana Shield empowers your next weapon hit within 5s: +2 damage." },
  { id: "mage_fault", path: "mage", name: "Unstable Fault", branch: "Arcanist", ability: "mage_overload", detail: "Overload's marked blast grows by 1m. Lead enemies into it." },
  { id: "assassin_flank", path: "assassin", name: "Backstab", branch: "Phantom", detail: "Weapon hits from behind an enemy deal +1 damage." },
  { id: "assassin_open", path: "assassin", name: "First Blood", branch: "Blade Dancer", detail: "Your weapon's first hit on a full-health enemy deals +1 damage." },
  { id: "assassin_finish", path: "assassin", name: "Execution Window", branch: "Executioner", detail: "Weapon hits against enemies at 30% health or less deal +1 damage." },
  { id: "assassin_cloak", path: "assassin", name: "Patient Shadow", branch: "Phantom", ability: "assassin_vanish", detail: "Stealth lasts 2s longer, giving you more time to get behind a target." },
  { id: "assassin_mark", path: "assassin", name: "Lingering Sentence", branch: "Executioner", ability: "assassin_death_mark", detail: "Death Mark lasts 5s longer. Keep pressure on your chosen target." },
  { id: "assassin_dance", path: "assassin", name: "Encore", branch: "Blade Dancer", ability: "assassin_blade_dance", detail: "Blade Dance performs one additional cut against its surviving targets." },
  { id: "thief_distraction", path: "thief", name: "Dirty Fighting", branch: "Trickster", detail: "Deal +1 weapon damage to enemies actively targeting someone else, including a decoy." },
  { id: "thief_guard", path: "thief", name: "Light Fingers", branch: "Skirmisher", detail: "Blocking costs 4 less stamina, leaving more energy to escape." },
  { id: "thief_opening", path: "thief", name: "Exploit Confusion", branch: "Saboteur", detail: "Weapon hits on staggered enemies deal +1 damage." },
  { id: "thief_smoke", path: "thief", name: "Lingering Smoke", branch: "Saboteur", ability: "thief_smoke_bomb", detail: "Smoke Bomb conceals you for 2s longer." },
  { id: "thief_decoy", path: "thief", name: "Convincing Double", branch: "Trickster", ability: "thief_decoy", detail: "Your attackable decoy gains 3 health and lasts 2s longer." },
  { id: "thief_escape", path: "thief", name: "Clean Break", branch: "Skirmisher", ability: "thief_escape_artist", detail: "Escape Artist's evade window lasts 400ms longer." },
  { id: "ranger_distance", path: "ranger", name: "Long Shot", branch: "Deadeye", detail: "Weapon hits from at least 6m away deal +1 damage." },
  { id: "ranger_open", path: "ranger", name: "Hunter's Opening", branch: "Volley", detail: "Your weapon's first hit on a full-health enemy deals +1 damage." },
  { id: "ranger_snare", path: "ranger", name: "Pinning Finish", branch: "Trapper", detail: "A weapon hit on a staggered enemy roots it for 700ms. 3s cooldown." },
  { id: "ranger_volley", path: "ranger", name: "Extended Volley", branch: "Volley", ability: "ranger_volley_focus", detail: "Volley Focus empowers one additional shot." },
  { id: "ranger_leap", path: "ranger", name: "Long Retreat", branch: "Trapper", ability: "ranger_disengage", detail: "Disengage leaps 1.5m farther, respecting walls and terrain." },
  { id: "ranger_deadeye", path: "ranger", name: "Eagle's Reach", branch: "Deadeye", ability: "ranger_deadeye", detail: "Deadeye can acquire precise, visible targets 4m farther away." },
  { id: "healer_protect", path: "healer", name: "Defend the Wounded", branch: "Lifebinder", detail: "Deal +1 weapon damage to an enemy targeting another player below half health." },
  { id: "healer_vigor", path: "healer", name: "Shared Vigor", branch: "Renewalist", detail: "A weapon hit restores 4 stamina to the nearest visible ally within 6m, or yourself. 2s cooldown." },
  { id: "healer_guard", path: "healer", name: "Sanctuary Guard", branch: "Sanctuary", detail: "Blocking costs 4 less stamina so you can hold your position." },
  { id: "healer_rescue", path: "healer", name: "Rescue Surge", branch: "Lifebinder", ability: "healer_field_mend", detail: "Field Mend restores 2 extra health when its target was below half health." },
  { id: "healer_field", path: "healer", name: "Wide Sanctuary", branch: "Sanctuary", ability: "healer_renewal", detail: "Renewal's healing field grows by 1.5m." },
  { id: "healer_renew", path: "healer", name: "Enduring Renewal", branch: "Renewalist", ability: "healer_renewal", detail: "Renewal lasts 2s longer, delivering two additional healing pulses." },
];
export interface FloorRunUpgradeState {
  active: boolean; path: BuildPathId | null; earned: number; pending: number;
  picked: string[]; offerId: string | null; choices: string[];
}
export interface FloorRunUpgradeUpdate extends FloorRunUpgradeState { canChoose: boolean }
export const EMPTY_FLOOR_RUN_STATE: FloorRunUpgradeState = {
  active: false, path: null, earned: 0, pending: 0, picked: [], offerId: null, choices: [],
};
export function floorUpgradeChoices(path: BuildPathId, abilities: readonly CallingAbilityId[], picked: readonly string[], seed: number): string[] {
  const pool = FLOOR_RUN_UPGRADES.filter(upgrade => upgrade.path === path && !picked.includes(upgrade.id)
    && (!upgrade.ability || abilities.includes(upgrade.ability)));
  // Stable within an offer: reopening the menu cannot reroll its choices.
  const score = (id: string) => { let hash = seed | 0; for (const c of id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619); return hash >>> 0; };
  return pool.sort((a, b) => score(a.id) - score(b.id)).slice(0, 3).map(upgrade => upgrade.id);
}
