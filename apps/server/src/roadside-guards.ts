import type { MobArchetypeId } from "./mob-archetypes.js";

/** Fixed, shared guards make each cart a real encounter instead of a nearby-mob check. */
export const ROADSIDE_GUARDS: readonly { id: string; siteId: string; archetype: MobArchetypeId; name: string; x: number; y: number; z: number }[] = [
  { id: "roadside-southgate-raider", siteId: "southgate-cart", archetype: "briar_crawler", name: "Southgate Raider", x: 12.5, y: 8, z: 39.5 },
  { id: "roadside-southgate-spitter", siteId: "southgate-cart", archetype: "cave_spitter", name: "Cart Lookout", x: 19.5, y: 8, z: 38.5 },
  { id: "roadside-lift-crawler", siteId: "collapsed-lift", archetype: "briar_crawler", name: "Lift Scavenger", x: -8.5, y: 8, z: 87.5 },
  { id: "roadside-lift-spitter", siteId: "collapsed-lift", archetype: "cave_spitter", name: "Lift Lookout", x: -.5, y: 8, z: 85.5 },
  { id: "roadside-watch-stalker", siteId: "northwatch-watchpost", archetype: "ridge_stalker", name: "Watchpost Stalker", x: 16.5, y: 8, z: -59.5 },
  { id: "roadside-watch-sentry", siteId: "northwatch-watchpost", archetype: "shard_sentry", name: "Watchpost Sentry", x: 24.5, y: 8, z: -59.5 },
];

export const roadsideGuardsFor = (siteId: string) => ROADSIDE_GUARDS.filter(guard => guard.siteId === siteId);
export const roadsideGuard = (id: string) => ROADSIDE_GUARDS.find(guard => guard.id === id);
export const ROADSIDE_GUARD_SITES = [...new Set(ROADSIDE_GUARDS.map(guard => guard.siteId))];
