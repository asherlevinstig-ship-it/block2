import type { ItemId } from "@blockcraft/protocol";
import type { MobArchetypeId } from "./mob-archetypes.js";

export type RoadsideGuard = {
  id: string;
  siteId: string;
  archetype: MobArchetypeId;
  name: string;
  x: number;
  y: number;
  z: number;
  elite?: boolean;
};

export type RoadsideEncounterVariant = {
  id: string;
  title: string;
  activation: string;
  rewardItemId: ItemId;
  guards: readonly RoadsideGuard[];
};

/** One-time guarded discoveries retain a single authored formation. */
const FIXED_ROADSIDE_GUARDS: readonly RoadsideGuard[] = [
  { id: "roadside-rootwatch-keeper", siteId: "greenwood-rootwatch-camp", archetype: "thornbinder", name: "Rootwatch Keeper", x: 51.5, y: 8, z: -5.5, elite: true },
  { id: "roadside-rootwatch-briar-west", siteId: "greenwood-rootwatch-camp", archetype: "briar_crawler", name: "Rootwatch Briar", x: 47.5, y: 8, z: -8.5 },
  { id: "roadside-rootwatch-briar-east", siteId: "greenwood-rootwatch-camp", archetype: "briar_crawler", name: "Rootwatch Briar", x: 55.5, y: 8, z: -8.5 },
  { id: "roadside-mossbound-wardbreaker", siteId: "mistfen-shrine", archetype: "fen_bloater", name: "Mire Wardbreaker", x: -39.5, y: 8, z: -20.5, elite: true },
  { id: "roadside-mossbound-briar-west", siteId: "mistfen-shrine", archetype: "briar_crawler", name: "Mossbound Lurker", x: -44.5, y: 8, z: -18.5 },
  { id: "roadside-mossbound-briar-east", siteId: "mistfen-shrine", archetype: "briar_crawler", name: "Mossbound Lurker", x: -34.5, y: 8, z: -18.5 },
  { id: "roadside-southgate-raider", siteId: "southgate-cart", archetype: "briar_crawler", name: "Southgate Raider", x: 12.5, y: 8, z: 39.5 },
  { id: "roadside-southgate-spitter", siteId: "southgate-cart", archetype: "cave_spitter", name: "Cart Lookout", x: 19.5, y: 8, z: 38.5 },
  { id: "roadside-lift-crawler", siteId: "collapsed-lift", archetype: "briar_crawler", name: "Lift Scavenger", x: -8.5, y: 8, z: 87.5 },
  { id: "roadside-lift-spitter", siteId: "collapsed-lift", archetype: "cave_spitter", name: "Lift Lookout", x: -.5, y: 8, z: 85.5 },
  { id: "roadside-watch-stalker", siteId: "northwatch-watchpost", archetype: "ridge_stalker", name: "Watchpost Stalker", x: 16.5, y: 8, z: -59.5 },
  { id: "roadside-watch-sentry", siteId: "northwatch-watchpost", archetype: "shard_sentry", name: "Watchpost Sentry", x: 24.5, y: 8, z: -59.5 },
];

const variant = (siteId: string, id: string, title: string, activation: string, rewardItemId: ItemId,
  guards: readonly Omit<RoadsideGuard, "siteId">[]): RoadsideEncounterVariant => ({
  id, title, activation, rewardItemId, guards: guards.map(guard => ({ ...guard, siteId })),
});

/** Fixed regional rotations: no player-level or party-size scaling is applied. */
export const ROADSIDE_VARIANTS: Readonly<Record<string, readonly RoadsideEncounterVariant[]>> = {
  "broken-winch-camp": [
    variant("broken-winch-camp", "quarry-patrol", "Quarry Patrol", "Hold the winch while the quarry patrol closes in.", "silver_ore", [
      { id: "roadside-winch-enforcer", archetype: "stone_brute", name: "Quarry Patrol Enforcer", x: 29.5, y: 8, z: 61.5, elite: true },
      { id: "roadside-winch-crawler-west", archetype: "briar_crawler", name: "Quarry Patrol Raider", x: 27.5, y: 8, z: 55.5 },
      { id: "roadside-winch-crawler-east", archetype: "briar_crawler", name: "Quarry Patrol Raider", x: 31.5, y: 8, z: 58.5 },
    ]),
    variant("broken-winch-camp", "saboteur-rush", "Saboteur Rush", "Repair the winch before the saboteurs overrun the camp.", "iron_ore", [
      { id: "roadside-winch-saboteur", archetype: "briar_crawler", name: "Quarry Saboteur", x: 29.5, y: 8, z: 61.5, elite: true },
      { id: "roadside-winch-sapper-west", archetype: "briar_crawler", name: "Quarry Sapper", x: 25.5, y: 8, z: 57.5 },
      { id: "roadside-winch-sapper-east", archetype: "cave_spitter", name: "Quarry Slingwatch", x: 33.5, y: 8, z: 58.5 },
    ]),
    variant("broken-winch-camp", "foreman-reclamation", "Foreman's Reclamation", "The quarry foreman has come to reclaim the repaired winch.", "stone_core", [
      { id: "roadside-winch-foreman", archetype: "stone_brute", name: "Quarry Foreman", x: 30.5, y: 8, z: 62.5, elite: true },
      { id: "roadside-winch-lookout-west", archetype: "cave_spitter", name: "Foreman's Lookout", x: 24.5, y: 8, z: 57.5 },
      { id: "roadside-winch-lookout-east", archetype: "cave_spitter", name: "Foreman's Lookout", x: 34.5, y: 8, z: 58.5 },
    ]),
  ],
  "wilds-hunter-blind": [
    variant("wilds-hunter-blind", "blood-trail", "Blood Trail", "The wounded stalker calls nearby creatures to its defence.", "crawler_fang", [
      { id: "roadside-wilds-stalker", archetype: "ridge_stalker", name: "Wounded Wilds Stalker", x: -31.5, y: 8, z: 26.5, elite: true },
      { id: "roadside-wilds-caller", archetype: "briar_crawler", name: "Alerted Wilds Crawler", x: -35.5, y: 8, z: 23.5 },
      { id: "roadside-wilds-flanker", archetype: "briar_crawler", name: "Alerted Wilds Crawler", x: -27.5, y: 8, z: 29.5 },
    ]),
    variant("wilds-hunter-blind", "pack-ambush", "Pack Ambush", "Fast hunters break cover on both sides of the blind.", "ridge_hide", [
      { id: "roadside-wilds-packleader", archetype: "ridge_stalker", name: "Wilds Packleader", x: -32.5, y: 8, z: 26.5, elite: true },
      { id: "roadside-wilds-runner-west", archetype: "ridge_stalker", name: "Wilds Runner", x: -37.5, y: 8, z: 22.5 },
      { id: "roadside-wilds-runner-east", archetype: "ridge_stalker", name: "Wilds Runner", x: -26.5, y: 8, z: 30.5 },
    ]),
    variant("wilds-hunter-blind", "alpha-hunt", "Alpha Hunt", "An alpha stalker answers the lure with thornbinders at its back.", "moss_fibre", [
      { id: "roadside-wilds-alpha", archetype: "ridge_stalker", name: "Wilds Alpha", x: -32.5, y: 8, z: 27.5, elite: true },
      { id: "roadside-wilds-thorn-west", archetype: "thornbinder", name: "Alpha Thornbinder", x: -38.5, y: 8, z: 23.5 },
      { id: "roadside-wilds-thorn-east", archetype: "thornbinder", name: "Alpha Thornbinder", x: -26.5, y: 8, z: 30.5 },
    ]),
  ],
  "ashglass-survey": [
    variant("ashglass-survey", "breaker-squad", "Breaker Squad", "An Ashglass breaker advances while hounds close from both sides.", "silver_ore", [
      { id: "roadside-ashglass-ram", archetype: "cinder_ram", name: "Ashglass Breaker", x: 116.5, y: 8, z: 73.5, elite: true },
      { id: "roadside-ashglass-hound-west", archetype: "ember_hound", name: "Ashglass Ambusher", x: 107.5, y: 8, z: 73.5 },
      { id: "roadside-ashglass-hound-east", archetype: "ember_hound", name: "Ashglass Ambusher", x: 116.5, y: 8, z: 67.5 },
    ]),
    variant("ashglass-survey", "survey-fireline", "Survey Fireline", "Survey sentries establish a fireline behind a charging hound.", "ember_ore", [
      { id: "roadside-ashglass-firehound", archetype: "ember_hound", name: "Survey Firehound", x: 112.5, y: 8, z: 72.5, elite: true },
      { id: "roadside-ashglass-sentry-west", archetype: "shard_sentry", name: "Ashglass Surveyor", x: 106.5, y: 8, z: 74.5 },
      { id: "roadside-ashglass-sentry-east", archetype: "shard_sentry", name: "Ashglass Surveyor", x: 118.5, y: 8, z: 68.5 },
    ]),
    variant("ashglass-survey", "duststorm-patrol", "Duststorm Patrol", "A cinder captain drives its patrol through the dust.", "stone_core", [
      { id: "roadside-ashglass-captain", archetype: "cinder_ram", name: "Duststorm Captain", x: 115.5, y: 8, z: 73.5, elite: true },
      { id: "roadside-ashglass-patrol-west", archetype: "ember_hound", name: "Duststorm Hound", x: 107.5, y: 8, z: 72.5 },
      { id: "roadside-ashglass-patrol-east", archetype: "shard_sentry", name: "Duststorm Sentry", x: 118.5, y: 8, z: 67.5 },
    ]),
  ],
};

const allVariantGuards = Object.values(ROADSIDE_VARIANTS).flatMap(variants => variants.flatMap(entry => entry.guards));
export const ROADSIDE_GUARDS: readonly RoadsideGuard[] = [...FIXED_ROADSIDE_GUARDS, ...allVariantGuards];

export const roadsideVariantsFor = (siteId: string) => ROADSIDE_VARIANTS[siteId] ?? [];
export const roadsideVariantFor = (siteId: string, index = 0) => {
  const variants = roadsideVariantsFor(siteId);
  return variants.length > 0 ? variants[((index % variants.length) + variants.length) % variants.length] : undefined;
};
export const roadsideGuardsFor = (siteId: string, variantIndex = 0) =>
  roadsideVariantFor(siteId, variantIndex)?.guards ?? FIXED_ROADSIDE_GUARDS.filter(guard => guard.siteId === siteId);
export const roadsideGuard = (id: string) => ROADSIDE_GUARDS.find(guard => guard.id === id);
export const ROADSIDE_GUARD_SITES = [...new Set(ROADSIDE_GUARDS.map(guard => guard.siteId))];
