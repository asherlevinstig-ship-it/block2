const { matchMaker, CloseCode } = require('@colyseus/core');
const { StateView } = require('@colyseus/schema');
const { State, Player } = require('../schema');
const { createStore, sanitizeProfile, cleanToken, defaultProfile } = require('../store');
const D = require('../dungeon');
const { GameRoom } = require('./GameRoom');
const W = require('../world');
const { handOff, hostGate, unhostGate, consumeGate, recordGateBreach } = require('./dungeon-handoff');
const { canonicalDungeonId } = require('../../shared/dungeon-pools');
const { peekDungeonAdmission, claimDungeonAdmission, revokeDungeonAdmission } = require('./dungeon-admission');
const { registerRoom, unregisterRoom } = require('../metrics-registry');

const DUNGEON_MOB_INTEREST_RADIUS = Number(process.env.DUNGEON_MOB_INTEREST_RADIUS || 28);
const DUNGEON_MOB_INTEREST_EXIT_RADIUS = Number(process.env.DUNGEON_MOB_INTEREST_EXIT_RADIUS || 40);
const DUNGEON_PLAYER_INTEREST_RADIUS = Number(process.env.DUNGEON_PLAYER_INTEREST_RADIUS || 48);
const DUNGEON_FX_INTEREST_RADIUS = Number(process.env.DUNGEON_FX_INTEREST_RADIUS || 44);
const DUNGEON_STATUS_INTERVAL_MS = Math.max(250, Number(process.env.DUNGEON_STATUS_INTERVAL_MS || 3000));

// One gate instance hosted in its own Colyseus room — the DungeonRoom split (Phases 2a–2c).
//
// Extends GameRoom to inherit the shared per-mob simulation (simulateMob), projectile stepping
// (stepProjectiles), movement (handleMove), all room mixins, and every core helper
// (createInstance, spaceSolid, hurtPlayer, ensurePlayerHp, the init*State cluster). It overrides
// only the lifecycle for single-instance, no-overworld operation: no global world lease, no
// overworld generation/spawning, no gate lifecycle.
//
// 2b makes the room independently joinable and playable: a client can join the `dungeon` room
// for a gate id, spawn inside, fight/mine/cast, and leave, and the room simulates a full raid
// on its own. 2c makes it the profile's owner for the raid's duration: mutations from the
// inherited mixins flow into this room's own dirtyPlayers/profiles (same mechanism GameRoom
// uses), get flushed to the store on leave/dispose, and get handed off (server/rooms/
// dungeon-handoff.js) to GameRoom so a returning hunter's cached copy there — which GameRoom
// otherwise trusts forever once populated — doesn't silently revert what was earned here.
class DungeonRoom extends GameRoom {
  // Account auth is identical to the overworld room — GameRoom.onAuth is static and inherited.

  async onCreate(options) {
    const admittedGate = peekDungeonAdmission(options && options.ticket);
    if (!admittedGate || admittedGate.id !== (options && options.gateId)) throw new Error('invalid dungeon admission');
    this.admissionTicket = options.ticket;
    this.isDungeonRoom = true;
    this.maxClients = 8;                 // a raid party, not the 16-player overworld
    // Same shape as GameRoom.bootId — a per-process stamp for the crash-recovery marker
    // armDungeonRecovery writes. A future overworld room (this or the next boot) compares
    // it against its own bootId to tell a genuine restart from a same-boot rejoin.
    this.bootId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
    this.setState(new State());
    this.store = this.monitorStore(createStore());

    // Per-session + sim bookkeeping the inherited mixins/tick read. The overworld slice of
    // GameRoom.onCreate (world gen, edits, chests, furnaces, gates, teams, events) is skipped.
    this.lastMoveMsg = new Map();
    this.lastAttackMsg = new Map();
    this.rateBuckets = new Map();
    this.playerLastHit = new Map();
    this.playerDamageRecaps = new Map();
    this.aegisBounties = new Map();
    this.playerHp = new Map();
    this.playerHunger = new Map();
    this.fallState = new Map();
    this.biomeStatuses = new Map();
    this.bossContrib = new Map();
    this.restartRecoveries = new Map();
    this.tutorialReturns = new Map();
    this.deathLimbo = new Map();
    this.deathDrops = new Map();
    this.deathDropSeq = 0;
    this.mobSeq = 0;
    this.mobMeta = {};
    this.instances = {};
    this.gateExpiresAt = Number(admittedGate.expiresAt) || 0;
    this.breached = false;
    this.initPersistenceState();
    this.initDungeonState();
    this.initDragonState();
    this.initCombatState();
    this.initRecallState();

    // The single instance this room hosts, built from the gate options matchmaking carried in.
    this.instance = this.createInstance(this.gateFromOptions(admittedGate));
    hostGate(this.instance.id);

    this.initMetrics();
    this.registerRaidHandlers();
    this.clock.setInterval(() => this.updateDungeonInterestViews(), 250);
    this.clock.setInterval(() => { if (this.instance) this.sendDungeonPartyStatus(this.instance.id); }, DUNGEON_STATUS_INTERVAL_MS);
    this.setSimulationInterval(dt => {
      const started = performance.now();
      this.update(dt / 1000);
      this.recordTick(performance.now() - started);
    }, 100);   // 10 Hz, like GameRoom
    this.clock.setInterval(() => this.flush(), 30000);   // periodic save for long raids, like GameRoom
    registerRoom(this, 'dungeon', { gateId: this.instance.id });
  }

  // GameRoom.flush() unconditionally runs completeFurnaces() first, which iterates
  // this.furnaces — a collection a DungeonRoom never has (furnace/chest/gate/team/guild setup
  // is part of the overworld slice this room skips). Override with just the player-save loop
  // instead of guarding the shared flush() for subsystems this room structurally lacks.
  async flush() {
    await this.flushDirtyPlayers();
  }

  // Translate matchmaking options into the gate descriptor createInstance() (dungeon.mixin) wants.
  gateFromOptions(options = {}) {
    return {
      id: options.id || options.gateId || ('dgn-' + this.roomId),
      seed: (options.seed >>> 0) || 1,
      rank: options.rank | 0,
      dungeonId: canonicalDungeonId(options.rank, options.seed, options.dungeonId),
      kind: options.kind || 'public',
      // gate world coords so gateEntryPayload's back-position (bx/by/bz) returns the hunter to
      // the overworld gate on exit; the client passes these from the gate it entered.
      x: Number.isFinite(options.x) ? options.x : (Number.isFinite(options.gateX) ? options.gateX : 0),
      y: Number.isFinite(options.y) ? options.y : (Number.isFinite(options.gateY) ? options.gateY : 0),
      z: Number.isFinite(options.z) ? options.z : (Number.isFinite(options.gateZ) ? options.gateZ : 0),
      expiresAt: Number(options.expiresAt) || 0,
      shardPlus: options.shardPlus | 0,
      shardName: options.shardName || '',
      shardMods: options.shardMods || '',
    };
  }

  // The in-dungeon message subset. Every handler method is inherited from GameRoom/mixins;
  // overworld-only messages (shops, farming, gates, chests, furnaces, teams, events) are omitted.
  registerRaidHandlers() {
    this.onMessage('move', (c, m) => this.handleMove(c, m));
    this.onMessage('recallStart', (c, m) => this.handleRecallStart(c, m));
    this.onMessage('recallAnswer', (c, m) => this.handleRecallAnswer(c, m));
    this.onMessage('recallSubject', (c, m) => this.handleRecallSubject(c, m));
    this.onMessage('attack', (c, m) => this.handleAttack(c, m));
    this.onMessage('ability', (c, m) => this.handleAbility(c, m));
    this.onMessage('dragonAbility', (c, m) => this.handleDragonAbility(c, m));
    this.onMessage('dragonBreath', (c, m) => this.handleDragonBreath(c, m));
    this.onMessage('blackhole', (c, m) => this.handleBlackholeStaff(c, m));
    this.onMessage('legendaryWeapon', (c, m) => this.handleLegendaryWeapon(c, m));
    this.onMessage('craftLegendary', (c, m) => this.handleCraftLegendary(c, m));
    this.onMessage('bindFamiliar', (c, m) => this.handleBindFamiliar(c, m));
    this.onMessage('summonFamiliar', (c, m) => this.handleSummonFamiliar(c, m));
    this.onMessage('dismissFamiliar', (c) => this.handleDismissFamiliar(c));
    this.onMessage('shadeStep', (c, m) => this.handleShadeStep(c, m));
    this.onMessage('spendStat', (c, m) => this.handleSpendStat(c, m));
    this.onMessage('equipArmor', (c, m) => this.handleEquipArmor(c, m));
    this.onMessage('useFood', (c, m) => this.handleUseFood(c, m));
    this.onMessage('quitDungeonSpirit', c => this.handleQuitDungeonSpirit(c));
    this.onMessage('prospect', c => this.handleProspect(c));
    this.onMessage('useRepairKit', (c, m) => this.handleUseRepairKit(c, m));
    this.onMessage('dedit', (c, m) => this.handleDungeonEdit(c, m));   // mining inside the dungeon
    if (process.env.BLOCKCRAFT_E2E === '1') this.onMessage('e2eJourney', (c, m) => this.handleE2EJourney(c, m));
  }

  async onJoin(client, options, auth) {
    this.monitorClient(client);
    const token = cleanToken(auth && auth.id);
    if (!token) throw new Error('authenticated account required');
    const admittedGate = claimDungeonAdmission(options && options.ticket, token);
    if (!admittedGate || options.ticket !== this.admissionTicket || admittedGate.id !== this.instance.id) throw new Error('invalid dungeon admission');
    let prof = this.profiles.get(token);
    if (!prof) {
      try { prof = sanitizeProfile(await this.store.loadPlayer(token)); }
      catch (e) { prof = null; }
      if (!prof) { prof = defaultProfile((options && options.name) || (auth && auth.displayName)); prof.noPersist = true; }
      this.profiles.set(token, prof);
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
    // Crash-recovery parity with the overworld enterGate path (which arms this in
    // enterGateInstance): the flag-gated switchRoom entry never touched that handler, so
    // without this a server restart mid-raid would strand the hunter with no return
    // position and no refund of an unused private key. The marker is keyed by the overworld
    // gate (inst.id / inst.gateX..Z); the overworld room's recoverDungeonAfterRestart
    // consumes it on the next boot, and onLeave clears it on a clean exit.
    this.armDungeonRecovery(client, { id: inst.id, x: inst.gateX, y: inst.gateY, z: inst.gateZ });
    this.initDungeonInterestView(client);
    this.updateClientDungeonInterestView(client);
    client.send('enterDungeon', this.gateEntryPayload(null, inst));
    const status = this.dungeonStatusPayload(inst);
    if (status) client.send('dungeonStatus', status);
  }

  async onLeave(client, code) {
    // A graceful server shutdown is not a voluntary exit: leave the seat, entity, profile, and
    // crash-recovery marker intact for onDispose to flush and next boot to recover (mirrors
    // GameRoom.onLeave). Tearing down here would retire the recovery marker, and there's no live
    // GameRoom left in the dying process to hand the profile off to anyway.
    if (matchMaker && matchMaker.state === matchMaker.MatchMakerState.SHUTTING_DOWN) return;
    // An unclean disconnect (a network blip, not a flee/switch) shouldn't eject a hunter from the
    // raid. Hold their seat + live entity briefly; if they reconnect within the window, resume
    // them into the instance and keep everything as it was. Only a timed-out window falls through
    // to the durable teardown. Mirrors GameRoom.onLeave's reconnection path, minus the tutorial/
    // event resumes a single-instance raid room can't have. Holding the seat also keeps the room
    // alive across the window (Colyseus counts the reservation against autoDispose).
    const unexpected = code === false || (typeof code === 'number' && code !== CloseCode.CONSENTED);
    if (unexpected) {
      try {
        await this.allowReconnection(client, 15);
        const token = this.tokens.get(client.sessionId);
        const profile = token && this.profiles.get(token);
        if (profile) client.send('profile', profile);
        const hunger = this.playerHunger.get(client.sessionId);
        if (hunger) client.send('hunger', { hunger: Math.ceil(hunger.hunger), maxHunger: hunger.max });
        this.resumeDungeonInstance(client);
        return;
      } catch (_) {
        // The reconnect window elapsed — perform the durable teardown below.
      }
    }
    this.recordClientLeave(code, unexpected);
    await this.finalizeDungeonLeave(client);
  }

  async finalizeDungeonLeave(client) {
    // Teardown runs synchronously (an async fn executes up to its first await synchronously) —
    // if the departing hunter's schema entity and its mob aggro were instead cleared only after
    // the persistence await below, they'd stay live for the rest of the raid party for the
    // duration of the store write.
    const token = this.tokens.get(client.sessionId);
    if (this.instance) this.instance.removePlayer(client.sessionId);
    if (this.instance && this.instance.playerCount > 0) this.sendDungeonStatus(this.instance.id);
    this.state.players.delete(client.sessionId);
    this.playerHp.delete(client.sessionId);
    this.playerHunger.delete(client.sessionId);
    if (this.fallState) this.fallState.delete(client.sessionId);
    if (this.biomeStatuses) this.biomeStatuses.delete(client.sessionId);
    if(typeof this.clearRecallState==='function')this.clearRecallState(client.sessionId);
    this.clearFamiliarRuntime(client.sessionId);
    if (this.moveRejects) this.moveRejects.delete(client.sessionId);
    if (this.weaponMomentum) this.weaponMomentum.delete(client.sessionId);
    this.tokens.delete(client.sessionId);
    if (!token) return;
    // Keep this token's profile in this.profiles until AFTER flush() runs — flushDirtyPlayers()
    // looks it up by token to know what to save, and a concurrent leave from another client in
    // this same instance may piggyback its own dirty token onto this flush() call.
    const prof = this.profiles.get(token);
    // A real exit — fled/cleared and switched back, or a disconnect whose reconnect window
    // elapsed — retires the crash-recovery marker armed on join. Leaving it set would make the
    // overworld room's recoverDungeonAfterRestart treat this hunter's very next return as a
    // server restart and wrongly refund the key / teleport them to the gate mouth. (Graceful
    // shutdown never reaches here — onLeave returns early above so the marker survives.)
    if (prof && prof.dungeonRecovery) {
      prof.dungeonRecovery = null;
      this.dirtyPlayers.add(token);
    }
    // The in-memory handoff — not the store write — is what actually protects this hunter's
    // progress from GameRoom's stale cache, so it must still happen even if flush() throws.
    try {
      await this.flush();
    } catch (e) {
      console.warn('[persist] dungeon leave flush failed:', e.message);
    }
    this.profiles.delete(token);
    if (prof && !prof.noPersist) handOff(token, prof);
    // empty room disposes via Colyseus autoDispose; the instance goes with it.
  }

  async onDispose() {
    unregisterRoom(this);
    revokeDungeonAdmission(this.admissionTicket);
    // Unlike GameRoom, a DungeonRoom holds no world lease, but it does own in-memory profile
    // mutations from any client whose onLeave hasn't run yet (e.g. an abrupt shutdown) — flush
    // those before tearing the instance down. Colyseus only calls onDispose after every
    // client's onLeave has resolved, so in the common case this is a cheap no-op.
    try { await this.flush(); } catch (e) { console.warn('[persist] dungeon dispose flush failed:', e.message); }
    // The raid is over (party cleared it or everyone left). The flag-gated entry
    // reached this room via a client-side switchRoom that never told the overworld
    // GameRoom its gate was used, so retire that gate now instead of letting it
    // linger active until its TTL. Keyed by the overworld gate id the client
    // passed in as gateId (== this.instance.id); the overworld room drains this on
    // its next gate-lifecycle tick. Public gates stay walk-up-joinable for the
    // rest of the party while this room lives — only its disposal retires them.
    if (this.instance) {
      unhostGate(this.instance.id);
      if (!this.breached) consumeGate(this.instance.id);
    }
    if (this.instance) { try { this.instance.dispose(); } catch (_) {} }
  }

  breachToOverworld(now = Date.now()) {
    const inst = this.instance;
    if (!inst || inst.cleared || this.breached) return false;
    this.breached = true;
    const mobs = [];
    this.state.mobs.forEach((m, id) => {
      if (!m || m.dgn !== inst.id || m.hp <= 0) return;
      const meta = this.mobMeta[id] || {};
      mobs.push({
        id: String(id),
        kind: m.kind || 'zombie',
        hp: Math.max(0, m.hp || 0),
        maxHp: Math.max(1, m.maxHp || m.hp || 1),
        state: m.state || '',
        yaw: m.yaw || 0,
        variant: m.variant || meta.variant || '',
        bossStyle: m.bossStyle || meta.bossStyle || inst.bossStyle || '',
        displayName: m.displayName || '',
        elite: !!m.elite,
      });
    });
    const originalTokens = [];
    for (const sid of [...inst.players]) {
      const token = this.tokens && this.tokens.get(sid);
      if (token) originalTokens.push(token);
    }
    recordGateBreach({
      gateId: inst.id,
      x: inst.gateX, y: inst.gateY, z: inst.gateZ,
      rank: inst.rank | 0,
      kind: inst.kind || 'public',
      dungeonId: inst.dungeonId || '',
      bossName: inst.definition && inst.definition.boss || 'Gate Boss',
      bossStyle: inst.bossStyle || '',
      originalTokens,
      mobs,
      at: now,
    });
    const result = this.dungeonResultPayload(inst, 'failed', 'breach');
    const tx = W.TOWN.TC + .5, ty = W.TOWN.G + 2, tz = W.TOWN.TC + 14.5;
    for (const sid of [...inst.players]) {
      const p = this.state.players.get(sid);
      if (p) { p.x = tx; p.y = ty; p.z = tz; p.dgn = ''; p.dim = 'overworld'; }
      const token = this.tokens && this.tokens.get(sid);
      const prof = token && this.profiles && this.profiles.get(token);
      if (prof) {
        prof.pos = [tx, ty, tz];
        prof.dungeonRecovery = null;
        if (this.dirtyPlayers) this.dirtyPlayers.add(token);
      }
      const client = this.clients.find(c => c.sessionId === sid);
      if (client) client.send('dungeonFailed', { reason: 'breach', result, x: tx, y: ty, z: tz });
    }
    return true;
  }

  initDungeonInterestView(client) {
    if (!client.view) client.view = new StateView();
    client.__visibleDungeonMobs = client.__visibleDungeonMobs || new Map();
    client.__visibleDungeonPlayers = client.__visibleDungeonPlayers || new Map();
  }

  recordDungeonInterestChange(kind) {
    const now = Date.now();
    const metrics = this.dungeonInterestMetrics || (this.dungeonInterestMetrics = {
      added: 0,
      removed: 0,
      windowStartedAt: now,
      windowAdded: 0,
      windowRemoved: 0,
    });
    if (now - metrics.windowStartedAt > 10000) {
      metrics.windowStartedAt = now;
      metrics.windowAdded = 0;
      metrics.windowRemoved = 0;
    }
    if (kind === 'add') {
      metrics.added++;
      metrics.windowAdded++;
    } else if (kind === 'remove') {
      metrics.removed++;
      metrics.windowRemoved++;
    }
  }

  shouldSeeDungeonMob(viewer, mob, alreadyVisible = false) {
    if (!viewer || !mob || !viewer.dgn || mob.dgn !== viewer.dgn) return false;
    if (mob.kind === 'boss') return true;
    const radius = alreadyVisible ? DUNGEON_MOB_INTEREST_EXIT_RADIUS : DUNGEON_MOB_INTEREST_RADIUS;
    return Math.hypot((mob.x || 0) - (viewer.x || 0), (mob.z || 0) - (viewer.z || 0)) <= radius;
  }

  updateClientDungeonInterestView(client) {
    if (!client || !client.view) return;
    const viewer = this.state.players.get(client.sessionId);
    const visibleMobs = client.__visibleDungeonMobs || (client.__visibleDungeonMobs = new Map());
    const visiblePlayers = client.__visibleDungeonPlayers || (client.__visibleDungeonPlayers = new Map());

    this.state.mobs.forEach((mob, id) => {
      if (!this.shouldSeeDungeonMob(viewer, mob, visibleMobs.has(id))) return;
      if (!visibleMobs.has(id)) {
        client.view.add(mob);
        visibleMobs.set(id, mob);
        this.recordDungeonInterestChange('add');
      }
    });

    for (const [id, mob] of [...visibleMobs.entries()]) {
      if (!this.state.mobs.has(id) || !this.shouldSeeDungeonMob(viewer, mob, true)) {
        client.view.remove(mob);
        visibleMobs.delete(id);
        this.recordDungeonInterestChange('remove');
      }
    }

    this.state.players.forEach((player, sid) => {
      if (!this.shouldSeeDungeonPlayer(client.sessionId, viewer, sid, player)) return;
      if (!visiblePlayers.has(sid)) {
        client.view.add(player);
        visiblePlayers.set(sid, player);
      }
    });

    for (const [sid, player] of [...visiblePlayers.entries()]) {
      if (!this.state.players.has(sid) || !this.shouldSeeDungeonPlayer(client.sessionId, viewer, sid, player)) {
        client.view.remove(player);
        visiblePlayers.delete(sid);
      }
    }
  }

  updateDungeonInterestViews() {
    for (const client of this.clients) this.updateClientDungeonInterestView(client);
  }

  dungeonPartyStatusPayload(inst) {
    const status = this.dungeonStatusPayload(inst);
    if (!status) return null;
    return {
      id: status.id,
      party: status.party,
      totalPlayers: status.totalPlayers,
      activeCount: status.activeCount,
      aliveCount: status.aliveCount,
      spiritCount: status.spiritCount,
      downedCount: status.downedCount,
      returnedCount: status.returnedCount,
      wipe: status.wipe,
    };
  }

  sendDungeonPartyStatus(dgn) {
    const inst = this.instances[dgn];
    const payload = this.dungeonPartyStatusPayload(inst);
    if (!payload) return;
    for (const c of this.clients) {
      const p = this.state.players.get(c.sessionId);
      if (p && p.dgn === dgn) c.send('dungeonPartyStatus', payload);
    }
  }

  dungeonFxPoints(msg) {
    if (!msg || typeof msg !== 'object') return [];
    const points = [];
    const add = (x, z) => {
      if (Number.isFinite(x) && Number.isFinite(z)) points.push({ x, z });
    };
    add(Number(msg.x), Number(msg.z));
    add(Number(msg.fromX), Number(msg.fromZ));
    add(Number(msg.tx), Number(msg.tz));
    for (const point of msg.points || []) add(Number(point && point.x), Number(point && point.z));
    for (const target of msg.targets || []) add(Number(target && target.x), Number(target && target.z));
    return points;
  }

  shouldFilterSpaceMessage(dgn, type, msg) {
    return !!dgn && (type === 'fx' || type === 'arrow') && this.dungeonFxPoints(msg).length > 0;
  }

  recordDungeonFxFanout(sent, skipped) {
    const metrics = this.dungeonFxMetrics || (this.dungeonFxMetrics = { sent: 0, skipped: 0, filteredEvents: 0 });
    metrics.sent += sent;
    metrics.skipped += skipped;
    if (skipped > 0) metrics.filteredEvents++;
  }

  sendSpace(dgn, type, msg) {
    if (!this.shouldFilterSpaceMessage(dgn, type, msg)) return super.sendSpace(dgn, type, msg);
    const points = this.dungeonFxPoints(msg);
    let sent = 0, skipped = 0;
    for (const client of this.clients) {
      const player = this.state.players.get(client.sessionId);
      if (!player || (player.dgn || '') !== (dgn || '')) continue;
      const nearby = points.some(point => Math.hypot((player.x || 0) - point.x, (player.z || 0) - point.z) <= DUNGEON_FX_INTEREST_RADIUS);
      if (nearby) {
        client.send(type, msg);
        sent++;
      } else {
        skipped++;
      }
    }
    this.recordDungeonFxFanout(sent, skipped);
  }

  shouldSeeDungeonPlayer(viewerSid, viewer, targetSid, target) {
    if (!viewer || !target || !viewer.dgn || viewer.dgn !== target.dgn) return false;
    if (viewerSid === targetSid) return true;
    const hp = this.playerHp && this.playerHp.get(targetSid);
    if (hp && hp.hp <= 0) return true;
    return Math.hypot((target.x || 0) - (viewer.x || 0), (target.z || 0) - (viewer.z || 0)) <= DUNGEON_PLAYER_INTEREST_RADIUS;
  }

  dungeonInterestSnapshot() {
    const clients = this.clients ? this.clients.length : 0;
    let dungeonMobs = 0, bosses = 0, visibleMobLinks = 0, bossVisibleLinks = 0;
    this.state.mobs.forEach(mob => {
      if (!mob || !mob.dgn) return;
      dungeonMobs++;
      if (mob.kind === 'boss') bosses++;
    });
    for (const client of this.clients || []) {
      const visible = client.__visibleDungeonMobs;
      if (!visible) continue;
      visible.forEach(mob => {
        if (!mob || !mob.dgn) return;
        visibleMobLinks++;
        if (mob.kind === 'boss') bossVisibleLinks++;
      });
    }
    const possibleMobLinks = dungeonMobs * clients;
    const hiddenMobLinksAvoided = Math.max(0, possibleMobLinks - visibleMobLinks);
    const dungeonPlayers = [];
    this.state.players.forEach((player, sid) => { if (player && player.dgn) dungeonPlayers.push({ sid, player }); });
    let visiblePlayerLinks = 0, selfPlayerLinks = 0, downedPlayerLinks = 0;
    for (const client of this.clients || []) {
      const visible = client.__visibleDungeonPlayers;
      if (!visible) continue;
      visible.forEach((player, sid) => {
        if (!player || !player.dgn) return;
        visiblePlayerLinks++;
        if (client.sessionId === sid) selfPlayerLinks++;
        const hp = this.playerHp && this.playerHp.get(sid);
        if (client.sessionId !== sid && hp && hp.hp <= 0) downedPlayerLinks++;
      });
    }
    const possiblePlayerLinks = dungeonPlayers.length * clients;
    const hiddenPlayerLinksAvoided = Math.max(0, possiblePlayerLinks - visiblePlayerLinks);
    const metrics = this.dungeonInterestMetrics || {};
    const fxMetrics = this.dungeonFxMetrics || {};
    const windowAgeSec = Math.max(1, (Date.now() - (metrics.windowStartedAt || Date.now())) / 1000);
    return {
      dungeonMobs,
      visibleMobLinks,
      avgVisibleMobsPerClient: clients ? Math.round(visibleMobLinks / clients * 100) / 100 : 0,
      hiddenMobLinksAvoided,
      bossVisibleLinks,
      bossMobs: bosses,
      dungeonPlayers: dungeonPlayers.length,
      visiblePlayerLinks,
      avgVisiblePlayersPerClient: clients ? Math.round(visiblePlayerLinks / clients * 100) / 100 : 0,
      hiddenPlayerLinksAvoided,
      selfPlayerLinks,
      downedPlayerLinks,
      interestViewAdds: metrics.added || 0,
      interestViewRemoves: metrics.removed || 0,
      interestViewAddsPerSecond: Math.round(((metrics.windowAdded || 0) / windowAgeSec) * 100) / 100,
      interestViewRemovesPerSecond: Math.round(((metrics.windowRemoved || 0) / windowAgeSec) * 100) / 100,
      dungeonFxSent: fxMetrics.sent || 0,
      dungeonFxSkipped: fxMetrics.skipped || 0,
      dungeonFxFilteredEvents: fxMetrics.filteredEvents || 0,
    };
  }

  metricsSnapshot() {
    return { ...super.metricsSnapshot(), ...this.dungeonInterestSnapshot() };
  }

  // Single-instance tick: the Phase-1 dispatch with no overworld passes and no gate lifecycle.
  // Mobs and players are filtered to this room's one instance; projectiles step first (matching
  // GameRoom order), then DungeonInstance.tick() runs the mob brains + shard hazards.
  update(dt) {
    const inst = this.instance;
    if (!inst) return;
    if (this.gateExpiresAt && this.gateExpiresAt <= Date.now() && !inst.cleared) {
      this.breachToOverworld();
      return;
    }
    const players = [];
    this.state.players.forEach((p, sid) => { if (p.dgn === inst.id) players.push({ p, sid }); });
    const mobIds = [];
    this.state.mobs.forEach((m, id) => { if (m.dgn === inst.id) mobIds.push(id); });
    const spaces = { [inst.id]: players };
    this.stepProjectiles(dt, spaces);
    this.tickShadowSoldiers(Date.now(), dt);
    inst.tick(this, dt, spaces, mobIds);
  }
}

module.exports = { DungeonRoom };
