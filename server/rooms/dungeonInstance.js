// One dungeon instance: the server-side state for a single gate's party raid —
// the world buffer, the party's edit log, the roster of players inside, and the
// shard-affix hazard bookkeeping. Mobs live in the room's *synced* state tagged
// by this instance's id; everything here is server-only and never synced.
//
// This is the home for "what IS a dungeon instance"; the room (GameRoom) still
// owns cross-cutting behaviour that needs room services (spawning mobs, damaging
// players, broadcasting fx), reading and mutating these fields.
const { isDimensionGrid } = require('../../shared/dimension-grid');
const { HAZARD_MOD_SET } = require('./constants');

class DungeonInstance {
  // d: the generated dungeon ({ world, rooms, spawns, bossRoom }); g: the Gate schema;
  // room: the owning GameRoom, used by methods that touch shared state (mobs, projectiles).
  constructor(d, g, room) {
    if (!d || !isDimensionGrid(d.world)) throw new TypeError('DungeonInstance requires a DimensionGrid world');
    this.room = room;
    this.id = g.id;
    this.seed = g.seed;
    this.dungeonId = g.dungeonId || '';
    this.definition = d.definition || null;
    this.bossStyle = this.definition && this.definition.combat ? this.definition.combat.bossStyle || '' : '';
    this.rank = g.rank;
    this.gateX = g.x;
    this.gateY = g.y;
    this.gateZ = g.z;
    this.world = d.world;              // compact instance-local DungeonGrid
    this.edits = [];                  // party mining/building log, replayed to late joiners
    this.players = new Set();         // session ids currently inside
    this.originalPlayers = new Set(); // session ids who ever joined this run; used for party status
    this.startedAt = Date.now();
    this.deathCount = 0;
    this.bossMastery = {
      hitsBySid: new Map(),
      partyHits: 0,
      deathsByReason: new Map(),
    };
    this.cleared = false;
    this.kind = g.kind || 'public';
    this.bossRoom = { x: d.bossRoom.x, z: d.bossRoom.z };
    // entry room — where a DungeonRoom spawns a joining hunter (falls back to the boss room)
    this.entrance = d.entrance ? { x: d.entrance.x, z: d.entrance.z } : { x: this.bossRoom.x, z: this.bossRoom.z };
    this.lootChestTotal = 0;          // set by the room after construction (needs a chest count)
    this.roomProgress = {
      rooms: new Map(),
      total: 0,
      cleared: 0,
    };
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
  inBounds(x, y, z) {
    return this.world.inBounds(x, y, z);
  }
  getB(x, y, z) { return this.world.getB(x, y, z); }
  setB(x, y, z, id) { return this.world.setB(x, y, z, id); }
  addEdit(x, y, z, id) { this.edits.push({ x, y, z, id }); }

  // ---- roster ----
  addPlayer(sid) { this.players.add(sid); this.originalPlayers.add(sid); }
  removePlayer(sid) { this.players.delete(sid); }
  hasPlayer(sid) { return this.players.has(sid); }
  get playerCount() { return this.players.size; }

  configureRoomProgress(groups) {
    this.roomProgress.rooms.clear();
    this.roomProgress.total = 0;
    this.roomProgress.cleared = 0;
    for (const group of groups || []) {
      if (!group || !group.key || !group.list || !group.list.length) continue;
      this.roomProgress.rooms.set(group.key, {
        key: group.key,
        type: group.type || 'guard',
        x: group.x,
        z: group.z,
        total: group.list.length,
        alive: group.list.length,
        cleared: false,
      });
    }
    this.roomProgress.total = this.roomProgress.rooms.size;
  }

  roomKeyNear(x, z) {
    let best = '', bd = Infinity;
    for (const room of this.roomProgress.rooms.values()) {
      const d = Math.hypot((room.x || 0) - x, (room.z || 0) - z);
      if (d < bd) { bd = d; best = room.key; }
    }
    return best;
  }

  markRoomMobKilled(x, z) {
    const key = this.roomKeyNear(x, z);
    const room = key && this.roomProgress.rooms.get(key);
    if (!room || room.cleared) return null;
    room.alive = Math.max(0, (room.alive | 0) - 1);
    if (room.alive > 0) return null;
    room.cleared = true;
    this.roomProgress.cleared = [...this.roomProgress.rooms.values()].filter(r => r.cleared).length;
    return {
      key: room.key,
      type: room.type,
      x: room.x,
      z: room.z,
      roomsCleared: this.roomProgress.cleared,
      roomTotal: this.roomProgress.total,
      bossGateState: this.bossGateState(),
    };
  }

  bossGateState() {
    if (this.cleared) return 'defeated';
    if (!this.roomProgress.total || this.roomProgress.cleared >= this.roomProgress.total) return 'open';
    return 'locked';
  }

  // True while at least one roster member is still inside this instance and alive.
  // Drives the wipe check: when it goes false, the run fails.
  hasLivingPlayers() {
    const room = this.room;
    if (!room) return false;
    for (const sid of this.players) {
      const p = room.state.players.get(sid);
      const hp = room.playerHp.get(sid);
      if (p && p.dgn === this.id && (!hp || hp.hp > 0)) return true;
    }
    return false;
  }

  // Per-instance simulation entry point, called once per server tick from the GameRoom
  // update() loop. This is the seam the eventual DungeonRoom split turns into the room's
  // own update(): the instance owns its mob brains and hazards, while cross-cutting helpers
  // (simulateMob, tickInstanceHazards, hurt/fx/loot) stay on the room and are reached via
  // the passed `room`. `spaces` maps dgn -> [{p,sid}] (as built in update()); `mobIds` are
  // the ids of this instance's mobs, snapshotted before the loop so a wipe that deletes a
  // mob mid-tick is handled by the live re-fetch.
  tick(room, dt, spaces, mobIds) {
    const players = spaces[this.id] || [];
    for (const id of mobIds) {
      const m = room.state.mobs.get(id);
      if (!m) continue;                       // killed earlier this tick (projectile, blackhole pop)
      const meta = room.mobMeta[id];
      if (!meta) continue;
      room.simulateMob(m, id, meta, dt, spaces);
    }
    if (this.hazMods && this.hazMods.size) room.tickInstanceHazards(this, dt, players);
  }

  // Tear the instance down: drop its mobs (and their meta), purge its in-flight
  // projectiles, and remove the instance from the room's registry. The caller owns
  // any extra bookkeeping (e.g. clearDungeonInstance also clears boss contribution).
  dispose() {
    const room = this.room;
    if (!room) return;
    const dead = [];
    room.state.mobs.forEach((m, id) => { if (m.dgn === this.id) dead.push(id); });
    for (const id of dead) { room.state.mobs.delete(id); delete room.mobMeta[id]; }
    room.sArrows = room.sArrows.filter(a => a.dgn !== this.id);
    room.sFireballs = room.sFireballs.filter(a => a.dgn !== this.id);
    if (room.bossContrib) room.bossContrib.delete(this.id);   // don't leak boss-loot tracking on teardown
    delete room.instances[this.id];
  }
}

module.exports = { DungeonInstance };
