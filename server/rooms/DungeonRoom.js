const { State, Player } = require('../schema');
const { createStore, sanitizeProfile, cleanToken, defaultProfile } = require('../store');
const D = require('../dungeon');
const { GameRoom } = require('./GameRoom');

// One gate instance hosted in its own Colyseus room — the DungeonRoom split (Phases 2a–2b).
//
// Extends GameRoom to inherit the shared per-mob simulation (simulateMob), projectile stepping
// (stepProjectiles), movement (handleMove), all room mixins, and every core helper
// (createInstance, spaceSolid, hurtPlayer, ensurePlayerHp, the init*State cluster). It overrides
// only the lifecycle for single-instance, no-overworld operation: no global world lease, no
// overworld generation/spawning/persistence, no gate lifecycle.
//
// 2b makes the room independently joinable and playable: a client can join the `dungeon` room
// for a gate id, spawn inside, fight/mine/cast, and leave, and the room simulates a full raid
// on its own. NOT yet wired into the live client or the `enterGate` flow (2c), and it loads the
// profile READ-ONLY — exclusive ownership coordination with GameRoom (the store-mediated handoff
// that prevents two writers) is 2c.
class DungeonRoom extends GameRoom {
  // Account auth is identical to the overworld room — GameRoom.onAuth is static and inherited.

  async onCreate(options) {
    this.isDungeonRoom = true;
    this.maxClients = 8;                 // a raid party, not the 16-player overworld
    this.setState(new State());
    this.store = createStore();

    // Per-session + sim bookkeeping the inherited mixins/tick read. The overworld slice of
    // GameRoom.onCreate (world gen, edits, chests, furnaces, gates, teams, events) is skipped.
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

    this.registerRaidHandlers();
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

  // The in-dungeon message subset. Every handler method is inherited from GameRoom/mixins;
  // overworld-only messages (shops, farming, gates, chests, furnaces, teams, events) are omitted.
  registerRaidHandlers() {
    this.onMessage('move', (c, m) => this.handleMove(c, m));
    this.onMessage('attack', (c, m) => this.handleAttack(c, m));
    this.onMessage('ability', (c, m) => this.handleAbility(c, m));
    this.onMessage('dragonAbility', (c, m) => this.handleDragonAbility(c, m));
    this.onMessage('dragonBreath', (c, m) => this.handleDragonBreath(c, m));
    this.onMessage('blackhole', (c, m) => this.handleBlackholeStaff(c, m));
    this.onMessage('legendaryWeapon', (c, m) => this.handleLegendaryWeapon(c, m));
    this.onMessage('craftLegendary', (c, m) => this.handleCraftLegendary(c, m));
    this.onMessage('bindFamiliar', (c, m) => this.handleBindFamiliar(c, m));
    this.onMessage('summonFamiliar', (c, m) => this.handleSummonFamiliar(c, m));
    this.onMessage('dismissFamiliar', (c) => { const p = this.state.players.get(c.sessionId); if (p) p.familiar = ''; });
    this.onMessage('spendStat', (c, m) => this.handleSpendStat(c, m));
    this.onMessage('equipArmor', (c, m) => this.handleEquipArmor(c, m));
    this.onMessage('useFood', (c, m) => this.handleUseFood(c, m));
    this.onMessage('useRepairKit', (c, m) => this.handleUseRepairKit(c, m));
    this.onMessage('dedit', (c, m) => this.handleDungeonEdit(c, m));   // mining inside the dungeon
  }

  async onJoin(client, options, auth) {
    const token = cleanToken(auth && auth.id);
    if (!token) throw new Error('authenticated account required');
    let prof = this.profiles.get(token);
    if (!prof) {
      try { prof = sanitizeProfile(await this.store.loadPlayer(token)); }
      catch (e) { prof = null; }
      if (!prof) { prof = defaultProfile((options && options.name) || (auth && auth.displayName)); prof.noPersist = true; }
      this.profiles.set(token, prof);   // read-only for 2b; exclusive ownership vs GameRoom is 2c
    }
    this.tokens.set(client.sessionId, token);

    const inst = this.instance;
    const ex = inst.entrance;
    const ey = D.standHeightIn(inst.world, ex.x, ex.z, 12);
    const p = new Player();
    p.name = (options && typeof options.name === 'string' && options.name) || prof.name || 'Hunter';
    p.lvl = prof.S.lvl;
    p.path = prof.S.path;
    p.x = ex.x; p.y = ey > 0 ? ey : 9; p.z = ex.z;
    p.dim = 'dungeon';
    p.dgn = inst.id;
    this.state.players.set(client.sessionId, p);
    this.ensurePlayerHp(client);
    inst.addPlayer(client.sessionId);
    client.send('enterDungeon', this.gateEntryPayload(null, inst));
  }

  onLeave(client) {
    const token = this.tokens.get(client.sessionId);
    if (this.instance) this.instance.removePlayer(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.playerHp.delete(client.sessionId);
    this.playerHunger.delete(client.sessionId);
    this.tokens.delete(client.sessionId);
    // 2b loads the profile READ-ONLY, so drop the in-memory copy without persisting — the room
    // is not the profile's owner. Persisting a hunter's dungeon progress back to the store is the
    // store-mediated ownership handoff in 2c; doing it here would risk a second writer vs GameRoom.
    if (token) this.profiles.delete(token);
    // empty room disposes via Colyseus autoDispose; the instance goes with it.
  }

  onDispose() {
    // Unlike GameRoom, a DungeonRoom holds no world lease and persists no world state, so there
    // is nothing to flush or release — just tear the instance's mobs/projectiles down.
    if (this.instance) { try { this.instance.dispose(); } catch (_) {} }
  }

  // Single-instance tick: the Phase-1 dispatch with no overworld passes and no gate lifecycle.
  // Mobs and players are filtered to this room's one instance; projectiles step first (matching
  // GameRoom order), then DungeonInstance.tick() runs the mob brains + shard hazards.
  update(dt) {
    const inst = this.instance;
    if (!inst) return;
    const players = [];
    this.state.players.forEach((p, sid) => { if (p.dgn === inst.id) players.push({ p, sid }); });
    const mobIds = [];
    this.state.mobs.forEach((m, id) => { if (m.dgn === inst.id) mobIds.push(id); });
    const spaces = { [inst.id]: players };
    this.stepProjectiles(dt, spaces);
    inst.tick(this, dt, spaces, mobIds);
  }
}

module.exports = { DungeonRoom };
