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
    ember_forge: Object.freeze({ name: 'Ember Forge', theme: 'forge', enemies: Object.freeze(['charger', 'graveguard', 'skeleton']), boss: 'The Cinder Smith', preview: 'Hot iron platforms, lava-lit forge lanes, and furnace-like boss chambers.', combat: Object.freeze({ skeletonChance: .22, zombieRoles: Object.freeze(['charger', 'charger', 'graveguard']), bossStyle: 'cinder_smith' }), layout: Object.freeze({ roomTypes: ['vault', 'arena', 'guard', 'pit'], roomBonus: 2, roomScale: 2, bossScale: 3, wideChance: .78, branchChance: .44, dressing: 'forge', waveRooms: true }) }),
    forgotten_keep: Object.freeze({ name: 'Forgotten Keep', theme: 'keep', enemies: Object.freeze(['skeleton', 'graveguard', 'charger']), boss: 'The Hollow Castellan', preview: 'Broken castle corridors, timber barricades, and defensible guard rooms.', combat: Object.freeze({ skeletonChance: .52, zombieRoles: Object.freeze(['graveguard', 'charger', 'graveguard']), bossStyle: 'castellan' }), layout: Object.freeze({ roomTypes: ['guard', 'arena', 'vault', 'crypt'], roomBonus: 1, roomScale: 2, bossScale: 3, wideChance: .68, branchChance: .52, dressing: 'keep', waveRooms: true }) }),
    hollow_sanctum: Object.freeze({ name: 'Hollow Sanctum', theme: 'sanctum', enemies: Object.freeze(['graveguard', 'skeleton']), boss: 'The Glass Choir', preview: 'Pale shrine halls with glass sigils, clean lanes, and ritual side rooms.', combat: Object.freeze({ skeletonChance: .44, zombieRoles: Object.freeze(['graveguard', 'graveguard', 'charger']), bossStyle: 'choir' }), layout: Object.freeze({ roomTypes: ['shrine', 'vault', 'arena', 'crypt'], roomBonus: 2, roomScale: 2, bossScale: 3, wideChance: .72, branchChance: .62, dressing: 'sanctum', waveRooms: false }) }),
    void_monastery: Object.freeze({ name: 'Void Monastery', theme: 'void', enemies: Object.freeze(['skeleton', 'graveguard', 'charger']), boss: 'The Silent Prior', preview: 'Dark geometric halls, glass void marks, and disciplined arena chambers.', combat: Object.freeze({ skeletonChance: .58, zombieRoles: Object.freeze(['graveguard', 'charger']), bossStyle: 'void_prior' }), layout: Object.freeze({ roomTypes: ['shrine', 'arena', 'vault', 'guard'], roomBonus: 2, roomScale: 3, bossScale: 4, wideChance: .82, branchChance: .46, dressing: 'void', waveRooms: true }) }),
    frozen_depths: Object.freeze({ name: 'Frozen Depths', theme: 'frozen', enemies: Object.freeze(['skeleton', 'graveguard']), boss: 'The Rimebound Giant', preview: 'Ice floors, snow shelves, and cold blue sightlines under the mountain.', combat: Object.freeze({ skeletonChance: .66, zombieRoles: Object.freeze(['graveguard', 'charger']), bossStyle: 'rime_giant' }), layout: Object.freeze({ roomTypes: ['pit', 'shrine', 'arena', 'vault'], roomBonus: 2, roomScale: 3, bossScale: 4, wideChance: .76, branchChance: .58, dressing: 'frozen', waveRooms: true }) }),
    storm_bastion: Object.freeze({ name: 'Storm Bastion', theme: 'storm', enemies: Object.freeze(['skeleton', 'charger', 'graveguard']), boss: 'The Thunder Warden', preview: 'Glass lightning channels, hard concrete platforms, and bastion corner towers.', combat: Object.freeze({ skeletonChance: .70, zombieRoles: Object.freeze(['charger', 'graveguard']), bossStyle: 'thunder_warden' }), layout: Object.freeze({ roomTypes: ['vault', 'arena', 'guard', 'shrine'], roomBonus: 2, roomScale: 3, bossScale: 4, wideChance: .9, branchChance: .42, dressing: 'storm', waveRooms: true }) }),
    monarchs_tomb: Object.freeze({ name: "Monarch's Tomb", theme: 'royal_tomb', enemies: Object.freeze(['skeleton', 'graveguard', 'charger']), boss: 'The Buried Monarch', preview: 'Royal brick halls, glass reliquaries, and diamond-lit burial courts.', combat: Object.freeze({ skeletonChance: .64, zombieRoles: Object.freeze(['graveguard', 'graveguard', 'charger']), bossStyle: 'buried_monarch' }), layout: Object.freeze({ roomTypes: ['crypt', 'vault', 'shrine', 'arena'], roomBonus: 3, roomScale: 3, bossScale: 5, wideChance: .82, branchChance: .54, floor: 'brick', dressing: 'royal_tomb', waveRooms: true }) }),
    abyssal_citadel: Object.freeze({ name: 'Abyssal Citadel', theme: 'abyssal', enemies: Object.freeze(['skeleton', 'graveguard', 'charger']), boss: 'The Abyssal Gatekeeper', preview: 'Black-water citadel rooms, glass sigils, and oppressive drowned chambers.', combat: Object.freeze({ skeletonChance: .56, zombieRoles: Object.freeze(['graveguard', 'charger', 'graveguard']), bossStyle: 'abyssal_gatekeeper' }), layout: Object.freeze({ roomTypes: ['vault', 'crypt', 'pit', 'arena'], roomBonus: 3, roomScale: 3, bossScale: 5, wideChance: .8, branchChance: .6, dressing: 'abyssal', waveRooms: true }) }),
    worldscar_nexus: Object.freeze({ name: 'Worldscar Nexus', theme: 'worldscar', enemies: Object.freeze(['skeleton', 'charger', 'graveguard']), boss: 'The Rift Monarch', preview: 'A fractured endgame nexus mixing ice, lava, glass, ore, and unstable stone.', combat: Object.freeze({ skeletonChance: .62, zombieRoles: Object.freeze(['charger', 'graveguard', 'charger']), bossStyle: 'rift_monarch' }), layout: Object.freeze({ roomTypes: ['arena', 'vault', 'pit', 'shrine'], roomBonus: 4, roomScale: 4, bossScale: 6, wideChance: .94, branchChance: .66, dressing: 'worldscar', waveRooms: true }) }),
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
