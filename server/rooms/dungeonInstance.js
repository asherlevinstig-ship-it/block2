// One dungeon instance: the server-side state for a single gate's party raid —
// the world buffer, the party's edit log, the roster of players inside, and the
// shard-affix hazard bookkeeping. Mobs live in the room's *synced* state tagged
// by this instance's id; everything here is server-only and never synced.
//
// This is the home for "what IS a dungeon instance"; the room (GameRoom) still
// owns cross-cutting behaviour that needs room services (spawning mobs, damaging
// players, broadcasting fx), reading and mutating these fields.
const W = require('../world');
const { HAZARD_MOD_SET } = require('./constants');

class DungeonInstance {
  // d: the generated dungeon ({ world, rooms, spawns, bossRoom }); g: the Gate schema.
  constructor(d, g) {
    this.id = g.id;
    this.seed = g.seed;
    this.rank = g.rank;
    this.world = d.world;              // Uint8Array world buffer (same layout as the overworld)
    this.edits = [];                  // party mining/building log, replayed to late joiners
    this.players = new Set();         // session ids currently inside
    this.cleared = false;
    this.kind = g.kind || 'public';
    this.bossRoom = { x: d.bossRoom.x, z: d.bossRoom.z };
    this.lootChestTotal = 0;          // set by the room after construction (needs a chest count)
    this.shardPlus = g.shardPlus | 0;
    this.shardName = g.shardName || '';
    this.shardMods = g.shardMods || '';
    this.shardModSet = new Set((g.shardMods || '').split(',').filter(Boolean));
    this.hazMods = new Set([...this.shardModSet].filter(k => HAZARD_MOD_SET.has(k)));
    this.haz = {
      pools: [], vols: [], orbs: [], ghosts: [], quakes: [],
      bleed: new Map(), grv: new Map(),
      quakeT: 6 + Math.random() * 5, orbT: 9 + Math.random() * 6,
    };
  }

  // ---- world access (same semantics as the overworld W.getB/setB) ----
  getB(x, y, z) { return W.inWorld(x, y, z) ? this.world[W.idx(x, y, z)] : W.B.AIR; }
  setB(x, y, z, id) { if (W.inWorld(x, y, z)) this.world[W.idx(x, y, z)] = id; }
  addEdit(x, y, z, id) { this.edits.push({ x, y, z, id }); }

  // ---- roster ----
  addPlayer(sid) { this.players.add(sid); }
  removePlayer(sid) { this.players.delete(sid); }
  hasPlayer(sid) { return this.players.has(sid); }
  get playerCount() { return this.players.size; }
}

module.exports = { DungeonInstance };
