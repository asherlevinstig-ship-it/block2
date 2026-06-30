const { State } = require('../schema');
const { createStore } = require('../store');
const { GameRoom } = require('./GameRoom');

// One gate instance hosted in its own Colyseus room — sub-phase 2a of the DungeonRoom split.
//
// Extends GameRoom to inherit the shared per-mob simulation (simulateMob), all room mixins,
// and every core helper (createInstance, spaceSolid, hurtPlayer, fireArrow, the init*State
// cluster). It overrides only the room lifecycle for single-instance, no-overworld operation:
// no global world lease (claimGlobalWorld), no overworld generation/spawning/persistence, and
// no gate lifecycle. The simulation reuses Phase 1's DungeonInstance.tick() verbatim.
//
// 2a is server-only and proves the room can host and simulate one instance (mobs, boss,
// hazards) in isolation. It is registered and unit-tested but NOT yet: joined by the client
// (that wires in 2b, with the in-dungeon message handlers and projectile stepping), nor
// coordinating player-profile ownership with GameRoom (the store-mediated handoff is 2c).
class DungeonRoom extends GameRoom {
  // Account auth is identical to the overworld room — GameRoom.onAuth is static and inherited.

  async onCreate(options) {
    this.isDungeonRoom = true;
    this.maxClients = 8;                 // a raid party, not the 16-player overworld
    this.setState(new State());
    this.store = createStore();

    // Per-session + sim bookkeeping the inherited mixins/tick read. This mirrors the slice of
    // GameRoom.onCreate those paths need, minus everything overworld (world gen, edits, chests,
    // furnaces, gates, teams, events, day cycle, the persistence restore loaders).
    this.lastMoveMsg = new Map();
    this.lastAttackMsg = new Map();
    this.rateBuckets = new Map();
    this.playerLastHit = new Map();
    this.aegisBounties = new Map();
    this.playerHp = new Map();
    this.playerHunger = new Map();
    this.bossContrib = new Map();
    this.restartRecoveries = new Map();
    this.tutorialReturns = new Map();
    this.mobSeq = 0;
    this.mobMeta = {};
    this.instances = {};
    this.initPersistenceState();
    this.initDungeonState();
    this.initDragonState();
    this.initCombatState();

    // The single instance this room hosts, built from the gate options matchmaking carried in.
    this.instance = this.createInstance(this.gateFromOptions(options));

    this.setSimulationInterval(dt => this.update(dt / 1000), 100);   // 10 Hz, like GameRoom
  }

  // Translate matchmaking options into the gate descriptor createInstance() (dungeon.mixin) wants.
  gateFromOptions(options = {}) {
    return {
      id: options.gateId || ('dgn-' + this.roomId),
      seed: (options.seed | 0) || 1,
      rank: options.rank | 0,
      kind: options.kind || 'public',
      shardPlus: options.shardPlus | 0,
      shardName: options.shardName || '',
      shardMods: options.shardMods || '',
    };
  }

  // Single-instance tick: the Phase-1 dispatch with no overworld passes and no gate lifecycle.
  // Mobs and players are filtered to this room's one instance; DungeonInstance.tick() runs the
  // mob brains (via the inherited simulateMob) and the shard hazards.
  update(dt) {
    const inst = this.instance;
    if (!inst) return;
    const players = [];
    this.state.players.forEach((p, sid) => { if (p.dgn === inst.id) players.push({ p, sid }); });
    const mobIds = [];
    this.state.mobs.forEach((m, id) => { if (m.dgn === inst.id) mobIds.push(id); });
    inst.tick(this, dt, { [inst.id]: players }, mobIds);
  }
}

module.exports = { DungeonRoom };
