import type { MobArchetypeId } from "./mob-archetypes.js";

/** Fixed, shared guards make each cart a real encounter instead of a nearby-mob check. */
export const ROADSIDE_GUARDS: readonly { id: string; siteId: string; archetype: MobArchetypeId; name: string; x: number; y: number; z: number; elite?: boolean }[] = [
  { id: "roadside-southgate-raider", siteId: "southgate-cart", archetype: "briar_crawler", name: "Southgate Raider", x: 12.5, y: 8, z: 39.5 },
  { id: "roadside-southgate-spitter", siteId: "southgate-cart", archetype: "cave_spitter", name: "Cart Lookout", x: 19.5, y: 8, z: 38.5 },
  { id: "roadside-lift-crawler", siteId: "collapsed-lift", archetype: "briar_crawler", name: "Lift Scavenger", x: -8.5, y: 8, z: 87.5 },
  { id: "roadside-lift-spitter", siteId: "collapsed-lift", archetype: "cave_spitter", name: "Lift Lookout", x: -.5, y: 8, z: 85.5 },
  { id: "roadside-watch-stalker", siteId: "northwatch-watchpost", archetype: "ridge_stalker", name: "Watchpost Stalker", x: 16.5, y: 8, z: -59.5 },
  { id: "roadside-watch-sentry", siteId: "northwatch-watchpost", archetype: "shard_sentry", name: "Watchpost Sentry", x: 24.5, y: 8, z: -59.5 },
  { id: "roadside-winch-enforcer", siteId: "broken-winch-camp", archetype: "stone_brute", name: "Quarry Patrol Enforcer", x: 29.5, y: 8, z: 61.5, elite: true },
  { id: "roadside-winch-crawler-west", siteId: "broken-winch-camp", archetype: "briar_crawler", name: "Quarry Patrol Raider", x: 27.5, y: 8, z: 55.5 },
  { id: "roadside-winch-crawler-east", siteId: "broken-winch-camp", archetype: "briar_crawler", name: "Quarry Patrol Raider", x: 31.5, y: 8, z: 58.5 },
  { id: "roadside-ashglass-ram", siteId: "ashglass-survey", archetype: "cinder_ram", name: "Ashglass Breaker", x: 116.5, y: 8, z: 73.5, elite: true },
  { id: "roadside-ashglass-hound-west", siteId: "ashglass-survey", archetype: "ember_hound", name: "Ashglass Ambusher", x: 107.5, y: 8, z: 73.5 },
  { id: "roadside-ashglass-hound-east", siteId: "ashglass-survey", archetype: "ember_hound", name: "Ashglass Ambusher", x: 116.5, y: 8, z: 67.5 },
  { id: "roadside-wilds-stalker", siteId: "wilds-hunter-blind", archetype: "ridge_stalker", name: "Wounded Wilds Stalker", x: -31.5, y: 8, z: 26.5, elite: true },
  { id: "roadside-wilds-caller", siteId: "wilds-hunter-blind", archetype: "briar_crawler", name: "Alerted Wilds Crawler", x: -35.5, y: 8, z: 23.5 },
  { id: "roadside-wilds-flanker", siteId: "wilds-hunter-blind", archetype: "briar_crawler", name: "Alerted Wilds Crawler", x: -27.5, y: 8, z: 29.5 },
];

export const roadsideGuardsFor = (siteId: string) => ROADSIDE_GUARDS.filter(guard => guard.siteId === siteId);
export const roadsideGuard = (id: string) => ROADSIDE_GUARDS.find(guard => guard.id === id);
export const ROADSIDE_GUARD_SITES = [...new Set(ROADSIDE_GUARDS.map(guard => guard.siteId))];
