(function exposeDungeonPools(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BlockcraftDungeonPools = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function dungeonPoolsFactory() {
  'use strict';

  // Stable content identities for ranked Gates.
  const DUNGEON_POOLS = Object.freeze([
    Object.freeze(['abandoned_mine', 'sunken_crypt', 'mossbound_cellar']),
    Object.freeze(['bone_catacombs', 'blighted_grotto', 'watchers_vault']),
    Object.freeze(['ember_forge', 'forgotten_keep', 'hollow_sanctum']),
    Object.freeze(['void_monastery', 'frozen_depths', 'storm_bastion']),
    Object.freeze(['monarchs_tomb', 'abyssal_citadel', 'worldscar_nexus']),
  ]);

  const KNOWN_DUNGEON_IDS = new Set(DUNGEON_POOLS.flat());
  const DUNGEON_DEFINITIONS = Object.freeze({
    abandoned_mine: Object.freeze({ name: 'Abandoned Mine', theme: 'mine', enemies: Object.freeze(['charger', 'skeleton']), boss: 'The Foreman', preview: 'Timber-braced workings with guarded ore vaults.', combat: Object.freeze({ skeletonChance: .28, zombieRoles: Object.freeze(['charger', 'charger', 'graveguard']), bossStyle: 'foreman' }), layout: Object.freeze({ roomTypes: ['guard', 'vault', 'pit'], branchChance: .38, dressing: 'supports' }) }),
    sunken_crypt: Object.freeze({ name: 'Sunken Crypt', theme: 'crypt', enemies: Object.freeze(['skeleton', 'graveguard']), boss: 'The Drowned Regent', preview: 'Flooded burial halls with a longer, brick-lined descent.', combat: Object.freeze({ skeletonChance: .48, zombieRoles: Object.freeze(['graveguard', 'graveguard', 'charger']), bossStyle: 'regent' }), layout: Object.freeze({ roomTypes: ['crypt', 'pit', 'crypt', 'shrine'], roomBonus: 1, branchChance: .30, floor: 'brick', dressing: 'flooded' }) }),
    mossbound_cellar: Object.freeze({ name: 'Mossbound Cellar', theme: 'overgrown', enemies: Object.freeze(['graveguard', 'charger']), boss: 'The Rootbound Keeper', preview: 'Overgrown chambers with frequent shrines and side vaults.', combat: Object.freeze({ skeletonChance: .12, zombieRoles: Object.freeze(['graveguard', 'charger', 'graveguard']), bossStyle: 'rootkeeper' }), layout: Object.freeze({ roomTypes: ['shrine', 'treasure', 'guard', 'pit'], branchChance: .72, floor: 'brick', dressing: 'overgrown' }) }),
    bone_catacombs: Object.freeze({ name: 'Bone Catacombs', theme: 'catacombs', enemies: Object.freeze(['skeleton', 'graveguard', 'charger']), boss: 'The Ossuary Herald', preview: 'Wide ossuary halls that escalate into coordinated undead waves.', combat: Object.freeze({ skeletonChance: .62, zombieRoles: Object.freeze(['graveguard', 'charger', 'graveguard']), bossStyle: 'ossuary' }), layout: Object.freeze({ roomTypes: ['crypt', 'arena', 'guard', 'vault'], roomBonus: 2, roomScale: 2, bossScale: 2, wideChance: .86, branchChance: .48, floor: 'brick', dressing: 'bones', waveRooms: true }) }),
    blighted_grotto: Object.freeze({ name: 'Blighted Grotto', theme: 'blighted', enemies: Object.freeze(['graveguard', 'charger', 'skeleton']), boss: 'The Spore Matron', preview: 'A widened fungal cavern where blight patches and root traps split the party.', combat: Object.freeze({ skeletonChance: .24, zombieRoles: Object.freeze(['graveguard', 'graveguard', 'charger']), bossStyle: 'blight' }), layout: Object.freeze({ roomTypes: ['shrine', 'pit', 'arena', 'treasure'], roomBonus: 2, roomScale: 2, bossScale: 2, wideChance: .74, branchChance: .76, floor: 'brick', dressing: 'blighted', waveRooms: true }) }),
    watchers_vault: Object.freeze({ name: "Watcher's Vault", theme: 'vault', enemies: Object.freeze(['skeleton', 'charger', 'graveguard']), boss: 'The Vault Watcher', preview: 'Broad vault lanes with ranged pressure, guarded treasure rooms, and crossfire tells.', combat: Object.freeze({ skeletonChance: .72, zombieRoles: Object.freeze(['charger', 'graveguard']), bossStyle: 'watcher' }), layout: Object.freeze({ roomTypes: ['vault', 'guard', 'arena', 'crypt'], roomBonus: 1, roomScale: 2, bossScale: 3, wideChance: .92, branchChance: .42, floor: 'brick', dressing: 'vault', waveRooms: false }) }),
  });

  function dungeonPoolForRank(rank) {
    return DUNGEON_POOLS[Math.max(0, Math.min(4, rank | 0))];
  }

  function dungeonIdForGate(rank, seed) {
    const pool = dungeonPoolForRank(rank);
    return pool[(seed >>> 0) % pool.length];
  }

  function canonicalDungeonId(rank, seed, requested) {
    return typeof requested === 'string' && KNOWN_DUNGEON_IDS.has(requested) && dungeonPoolForRank(rank).includes(requested)
      ? requested
      : dungeonIdForGate(rank, seed);
  }

  function dungeonDefinition(rank, seed, requested) {
    const id = canonicalDungeonId(rank, seed, requested);
    return DUNGEON_DEFINITIONS[id] || Object.freeze({
      name: id.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
      theme: 'ranked', enemies: Object.freeze(['zombie', 'skeleton']), boss: 'Gate Monarch',
      preview: 'A shifting ranked Gate.', combat: Object.freeze({}), layout: Object.freeze({}),
    });
  }

  return { DUNGEON_POOLS, DUNGEON_DEFINITIONS, KNOWN_DUNGEON_IDS, dungeonPoolForRank, dungeonIdForGate, canonicalDungeonId, dungeonDefinition };
});
