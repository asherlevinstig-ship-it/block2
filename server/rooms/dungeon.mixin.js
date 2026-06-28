// Dungeon gates, party instances, entry/exit, and server-authored shard hazards.
// Lifted verbatim out of GameRoom.js and mixed into its prototype.
const {
  BOSS_REWARD_BY_RANK, DRAGON_DROP_POOL, DRAGON_EGG_BOSS_CHANCE, DRAGON_EGG_OF, GATE_DISTANCE_BANDS,
  I, SHARD_ITEM_IDS, SHARD_TIERS, SOLO_KEYS, TEAM_KEYS, rollShardMods,
} = require('./constants');
const { State, Player, Mob, Team, Gate } = require('../schema');
const { TeamManager } = require('../teams');
const W = require('../world');
const D = require('../dungeon');
const AI = require('../ai');
const { DungeonInstance } = require('./dungeonInstance');
const { createStore, sanitizeProfile, mergeClientSave, defaultProfile, cleanToken, sanitizeUtilityLoadout } = require('../store');

class DungeonMixin {
  // Dungeon / gate lifecycle state, co-located with the mixin that owns it.
  // Called once from onCreate, before restoreSavedGates (which fills gateSeq/gateTtls).
  initDungeonState() {
    this.dungeonLobbies = new Map();
    this.gateSeq = 0;
    this.gateTtls = new Map();
    this.gateLootedChests = new Map();
    this.gateTimer = 40;       // countdown to the next public gate spawn (sim-loop driven)
    this.gateTtl = 0;
  }

  dungeonStatusPayload(inst) {
    if (!inst) return null;
    const party = [];
    inst.players.forEach(sid => {
      const p = this.state.players.get(sid);
      if (p && p.dgn === inst.id) party.push({ name: p.name, lvl: p.lvl, team: p.team || '' });
    });
    let bossAlive = false;
    this.state.mobs.forEach(m => { if (m.dgn === inst.id && m.kind === 'boss' && m.hp > 0) bossAlive = true; });
    const looted = this.gateLootedChests.get(inst.id)?.size || 0;
    return {
      id: inst.id,
      rank: inst.rank,
      kind: inst.kind || 'public',
      party,
      bossAlive,
      cleared: !!inst.cleared,
      remainingChests: Math.max(0, (inst.lootChestTotal || 0) - looted),
    };
  }
  sendDungeonStatus(dgn) {
    const inst = this.instances[dgn];
    const payload = this.dungeonStatusPayload(inst);
    if (!payload) return;
    for (const c of this.clients) {
      const p = this.state.players.get(c.sessionId);
      if (p && p.dgn === dgn) c.send('dungeonStatus', payload);
    }
  }

  // ---------------- party dungeon instances ----------------
  mirrorPrimaryGate() {
    const legacy = this.state.gate;
    let first = null;
    this.state.gates.forEach(g => {
      if (!first && g.active && g.kind === 'public') first = g;
    });
    if (!first) {
      legacy.active = false;
      legacy.id = '';
      return;
    }
    legacy.active = true;
    legacy.x = first.x; legacy.y = first.y; legacy.z = first.z;
    legacy.rank = first.rank; legacy.id = first.id; legacy.seed = first.seed;
    legacy.kind = first.kind; legacy.owner = first.owner; legacy.team = first.team;
  }
  findGateForPlayer(client, m) {
    const p = this.state.players.get(client.sessionId);
    if (!p || p.dgn) return { gate: null, reason: 'invalid' };
    const requested = m && typeof m.id === 'string' ? m.id : '';
    let gate = requested ? this.state.gates.get(requested) : null;
    if (!gate && this.state.gate.active) gate = this.state.gates.get(this.state.gate.id) || this.state.gate;
    if (!gate || !gate.active) return { gate: null, reason: 'gone' };
    if (Math.hypot(gate.x - p.x, gate.z - p.z) > 5) return { gate: null, reason: 'range' };
    if (!this.canEnterGate(client, gate)) return { gate: null, reason: gate.kind || 'locked' };
    return { gate, reason: '' };
  }
  canEnterGate(client, gate) {
    if (!gate || !gate.active) return false;
    if (!this.canAccessGateRank(client, gate.rank)) return false;
    if (gate.kind === 'solo') return !!gate.owner && gate.owner === this.clientToken(client);
    if (gate.kind === 'team') {
      const p = this.state.players.get(client.sessionId);
      return !!p && !!gate.team && gate.team === this.cleanTeamId(p.team);
    }
    if (gate.kind === 'shard') {
      if (gate.owner && gate.owner === this.clientToken(client)) return true;
      const p = this.state.players.get(client.sessionId);
      return !!p && !!gate.team && gate.team === this.cleanTeamId(p.team);
    }
    return true;
  }
  isValidRestoredPublicGate(raw) {
    const rank = Math.max(0, Math.min(4, raw.rank | 0));
    const band = GATE_DISTANCE_BANDS[rank] || GATE_DISTANCE_BANDS[0];
    const x = +raw.x, z = +raw.z;
    if (!isFinite(x) || !isFinite(z)) return false;
    if (x < 6 || x > W.WX - 6 || z < 6 || z > W.WX - 6) return false;
    const ring = Math.max(Math.abs(x - W.TOWN.TC), Math.abs(z - W.TOWN.TC));
    return ring >= band.min && ring <= band.max;
  }
  restoreSavedGates(savedGates) {
    const now = Date.now();
    let count = 0;
    for (const id in savedGates || {}) {
      const raw = savedGates[id];
      if (!raw || raw.expiresAt <= now) continue;
      const kind = ['public', 'solo', 'team', 'shard'].includes(raw.kind) ? raw.kind : 'public';
      if (kind === 'public' && !this.isValidRestoredPublicGate(raw)) continue;
      const g = new Gate();
      g.id = raw.id || id;
      g.x = raw.x;
      g.y = raw.y;
      g.z = raw.z;
      g.rank = Math.max(0, Math.min(4, raw.rank | 0));
      g.seed = raw.seed >>> 0;
      g.kind = kind;
      g.owner = (g.kind === 'solo' || g.kind === 'team' || g.kind === 'shard') ? (cleanToken(raw.owner) || '') : '';
      g.team = (g.kind === 'team' || g.kind === 'shard') ? this.cleanTeamId(raw.team) : '';
      if (g.kind === 'shard') {
        g.shardPlus = Math.max(0, Math.min(5, raw.shardPlus | 0));
        g.shardName = typeof raw.shardName === 'string' ? raw.shardName.slice(0, 16) : '';
        g.shardMods = typeof raw.shardMods === 'string' ? raw.shardMods : '';
      }
      g.refundItem = Math.max(0, raw.refundItem | 0);
      g.refundOwner = cleanToken(raw.refundOwner) || '';
      g.active = true;
      this.state.gates.set(g.id, g);
      this.gateTtls.set(g.id, raw.expiresAt);
      this.gateLootedChests.set(g.id, new Set(Array.isArray(raw.lootedChests) ? raw.lootedChests : []));
      const seq = /^g(\d+)$/.exec(g.id);
      if (seq) this.gateSeq = Math.max(this.gateSeq, seq[1] | 0);
      count++;
    }
    this.mirrorPrimaryGate();
    return count;
  }
  createGate({ x, y, z, rank, kind, owner, team, ttl, shardPlus, shardName, shardMods, refundItem, refundOwner }) {
    const g = new Gate();
    g.x = x; g.y = y; g.z = z;
    g.rank = Math.max(0, Math.min(4, rank | 0));
    g.id = 'g' + (++this.gateSeq);
    g.seed = (Math.random() * 4294967295) >>> 0;
    g.kind = ['public', 'solo', 'team', 'shard'].includes(kind) ? kind : 'public';
    g.owner = owner || '';
    g.team = this.cleanTeamId(team || '');
    g.shardPlus = Math.max(0, Math.min(5, shardPlus | 0));
    g.shardName = typeof shardName === 'string' ? shardName.slice(0, 16) : '';
    g.shardMods = Array.isArray(shardMods) ? shardMods.join(',') : (shardMods || '');
    g.refundItem = Math.max(0, refundItem | 0);
    g.refundOwner = cleanToken(refundOwner) || '';
    g.active = true;
    this.state.gates.set(g.id, g);
    this.gateTtls.set(g.id, Date.now() + Math.max(15, ttl || 75) * 1000);
    this.gateLootedChests.set(g.id, new Set());
    this.dirtyGates = true;
    this.mirrorPrimaryGate();
    return g;
  }
  findShardGateSpawn() {
    const TC = W.TOWN.TC, HS = W.TOWN.HS;
    const tries = [
      [TC, TC - HS - 7],   // north (matches the solo client's "outside the north wall")
      [TC, TC + HS + 7],   // south
      [TC + HS + 7, TC],   // east
      [TC - HS - 7, TC],   // west
    ];
    for (const [x, z] of tries) {
      if (x < W.LAVA_BORDER_WIDTH + 6 || x > W.WX - W.LAVA_BORDER_WIDTH - 6 || z < W.LAVA_BORDER_WIDTH + 6 || z > W.WX - W.LAVA_BORDER_WIDTH - 6) continue;
      const gy = this.world.standHeight(x + .5, z + .5, W.WH - 2);
      if (gy >= 3 && gy <= 34) return { x: x + .5, y: gy, z: z + .5 };
    }
    return null;
  }
  findGateSpawnNear(p) {
    for (let i = 0; i < 36; i++) {
      const a = Math.random() * Math.PI * 2, d = 5 + Math.random() * 8;
      const x = Math.floor(p.x + Math.cos(a) * d), z = Math.floor(p.z + Math.sin(a) * d);
      if (x < 6 || x > W.WX - 6 || z < 6 || z > W.WX - 6) continue;
      if (this.isTownProtected(x, z)) continue;
      const gy = this.world.standHeight(x + .5, z + .5, W.WH - 2);
      if (gy >= 3 && gy <= 34) return { x: x + .5, y: gy, z: z + .5 };
    }
    return null;
  }
  keyGateInfo(id) {
    let rank = SOLO_KEYS.indexOf(id);
    if (rank >= 0) return { rank, kind: 'solo' };
    rank = TEAM_KEYS.indexOf(id);
    if (rank >= 0) return { rank, kind: 'team' };
    return null;
  }
  handleUseGateKey(client, m) {
    const p = this.state.players.get(client.sessionId);
    const rec = this.profileFor(client);
    if (!p || !rec || !m || p.dgn) return client.send('gateKeyReject', { reason: 'invalid' });
    if (this.rateLimited(client, 'action', 5, 10)) return client.send('gateKeyReject', { reason: 'rate' });
    const slot = Math.max(0, Math.min(35, m.slot | 0));
    const item = Array.isArray(rec.prof.inv) ? rec.prof.inv[slot] : null;
    const info = item ? this.keyGateInfo(item.id | 0) : null;
    if (!info) return client.send('gateKeyReject', { reason: 'item' });
    if (info.rank > this.maxUnlockedGateRankForKey(client, info.kind)) return client.send('gateKeyReject', { reason: 'rank' });
    const team = this.cleanTeamId(p.team);
    if (info.kind === 'team' && !team) return client.send('gateKeyReject', { reason: 'team' });
    const pos = this.findGateSpawnNear(p);
    if (!pos) return client.send('gateKeyReject', { reason: 'space' });
    item.count--;
    if (item.count <= 0) rec.prof.inv[slot] = null;
    this.dirtyPlayers.add(rec.token);
    const gate = this.createGate({
      ...pos,
      rank: info.rank,
      kind: info.kind,
      owner: rec.token,
      team: info.kind === 'team' ? team : '',
      ttl: 180,
      refundItem: item.id,
      refundOwner: rec.token,
    });
    client.send('gateKeyResult', { id: gate.id, rank: gate.rank, kind: gate.kind, x: gate.x, y: gate.y, z: gate.z, slot });
  }
  handleAttuneShard(client, m) {
    const p = this.state.players.get(client.sessionId);
    const rec = this.profileFor(client);
    if (!p || !rec || !m || p.dgn) return client.send('shardAttuneReject', { reason: 'invalid' });
    if (this.rateLimited(client, 'action', 5, 10)) return client.send('shardAttuneReject', { reason: 'rate' });
    const slot = Math.max(0, Math.min(35, m.slot | 0));
    const item = Array.isArray(rec.prof.inv) ? rec.prof.inv[slot] : null;
    const ti = item ? SHARD_ITEM_IDS.indexOf(item.id | 0) : -1;
    if (ti < 0) return client.send('shardAttuneReject', { reason: 'item' });
    // attuned at the in-town pedestal, so spawn the gate just outside a town wall
    // (mirrors the solo client) rather than next to the player's town-protected feet
    const pos = this.findShardGateSpawn() || this.findGateSpawnNear(p);
    if (!pos) return client.send('shardAttuneReject', { reason: 'space' });
    const tier = SHARD_TIERS[ti];
    const rank = this.playerRankGateIndexForProfile(rec.prof);
    const mods = rollShardMods(tier.plus);
    item.count--;
    if (item.count <= 0) rec.prof.inv[slot] = null;
    this.dirtyPlayers.add(rec.token);
    const gate = this.createGate({
      ...pos,
      rank,
      kind: 'shard',
      owner: rec.token,
      team: this.cleanTeamId(p.team),
      ttl: 180,
      shardPlus: tier.plus,
      shardName: tier.name,
      shardMods: mods,
      refundItem: item.id,
      refundOwner: rec.token,
    });
    client.send('shardAttuneResult', {
      id: gate.id, rank: gate.rank, plus: gate.shardPlus, name: gate.shardName,
      mods, x: gate.x, y: gate.y, z: gate.z, slot,
    });
    this.broadcast('chat', { name: '[System]', text: p.name + ' attuned a ' + tier.name + ' +' + tier.plus + ' sharded gate — ' + mods.join(', ') });
  }
  expireGate(id) {
    const g = this.state.gates.get(id);
    if (g) g.active = false;
    this.disbandDungeonLobby(id, 'gone');
    this.state.gates.delete(id);
    this.gateTtls.delete(id);
    this.gateLootedChests.delete(id);
    this.dirtyGates = true;
    this.mirrorPrimaryGate();
  }
  dungeonLobbyPayload(lobby) {
    const g = this.state.gates.get(lobby.gateId);
    const members = [];
    for (const sid of lobby.members) {
      const p = this.state.players.get(sid);
      if (!p) continue;
      members.push({
        sid,
        name: p.name || 'Hunter',
        ready: lobby.ready.has(sid),
        leader: sid === lobby.leader,
      });
    }
    const readyCount = members.reduce((n, m) => n + (m.ready ? 1 : 0), 0);
    return {
      id: lobby.id,
      gateId: lobby.gateId,
      rank: g ? (g.rank | 0) : (lobby.rank | 0),
      kind: g ? (g.kind || lobby.kind || 'public') : (lobby.kind || 'public'),
      members,
      readyCount,
      needed: members.length,
      leader: lobby.leader || '',
    };
  }
  sendDungeonLobby(lobby) {
    if (!lobby) return;
    const payload = this.dungeonLobbyPayload(lobby);
    for (const sid of lobby.members) {
      const c = this.clients.find(cl => cl.sessionId === sid);
      if (c) c.send('dungeonLobby', payload);
    }
  }
  disbandDungeonLobby(gateId, reason = 'cancelled') {
    if (!this.dungeonLobbies) return;
    const lobby = this.dungeonLobbies.get(gateId);
    if (!lobby) return;
    this.dungeonLobbies.delete(gateId);
    for (const sid of lobby.members) {
      const c = this.clients.find(cl => cl.sessionId === sid);
      if (c) c.send('dungeonLobbyClosed', { gateId, reason });
    }
  }
  leaveDungeonLobby(sid, notify = true) {
    if (!this.dungeonLobbies) return;
    for (const [gateId, lobby] of [...this.dungeonLobbies.entries()]) {
      if (!lobby.members.has(sid)) continue;
      lobby.members.delete(sid);
      lobby.ready.delete(sid);
      const client = this.clients.find(c => c.sessionId === sid);
      if (notify && client) client.send('dungeonLobbyClosed', { gateId, reason: 'left' });
      if (!lobby.members.size) {
        this.dungeonLobbies.delete(gateId);
        return;
      }
      if (lobby.leader === sid) lobby.leader = [...lobby.members][0] || '';
      this.sendDungeonLobby(lobby);
      return;
    }
  }
  gateEntryPayload(g, inst) {
    return {
      id: inst.id, seed: inst.seed, rank: inst.rank, kind: inst.kind || (g && g.kind) || 'public',
      edits: inst.edits,
      bx: g ? g.x : inst.gateX, by: g ? g.y : inst.gateY, bz: g ? g.z : inst.gateZ,
      cleared: inst.cleared,
      shardPlus: inst.shardPlus || 0, shardName: inst.shardName || '', shardMods: inst.shardMods || '',
    };
  }
  armDungeonRecovery(client, g) {
    const rec = this.profileFor(client);
    if (!rec || !g) return;
    rec.prof.dungeonRecovery = {
      gateId: g.id,
      bootId: this.bootId,
      pos: [g.x + 1.5, g.y + .5, g.z],
      enteredAt: Date.now(),
    };
    this.dirtyPlayers.add(rec.token);
  }
  clearDungeonRecoveryForSid(sid) {
    const token = this.tokens.get(sid);
    const prof = token && this.profiles.get(token);
    if (!prof || !prof.dungeonRecovery) return;
    prof.dungeonRecovery = null;
    this.dirtyPlayers.add(token);
  }
  async recoverDungeonAfterRestart(token, prof) {
    const recovery = prof && prof.dungeonRecovery;
    if (!recovery || recovery.bootId === this.bootId) return null;
    const gate = this.state.gates.get(recovery.gateId);
    let refundedItem = 0;
    let refundedTo = '';
    if (gate && gate.refundItem > 0 && gate.refundOwner) {
      refundedItem = gate.refundItem | 0;
      refundedTo = gate.refundOwner;
      let payer = gate.refundOwner === token ? prof : this.profiles.get(gate.refundOwner);
      if (!payer) {
        payer = sanitizeProfile(await this.store.loadPlayer(gate.refundOwner));
        this.profiles.set(gate.refundOwner, payer);
      }
      this.addRewardItem(payer, refundedItem, 1);
      this.dirtyPlayers.add(gate.refundOwner);
    }
    if (gate) this.expireGate(gate.id);
    prof.pos = recovery.pos.slice();
    prof.dungeonRecovery = null;
    this.dirtyPlayers.add(token);
    await this.flush();
    return {
      gateId: recovery.gateId,
      refundedItem,
      refunded: refundedTo === token,
      x: prof.pos[0], y: prof.pos[1], z: prof.pos[2],
    };
  }
  resumeDungeonInstance(client) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !p.dgn) return false;
    const inst = this.instances[p.dgn];
    if (!inst || !inst.hasPlayer(client.sessionId)) {
      p.dgn = '';
      p.dim = 'overworld';
      return false;
    }
    client.send('enterDungeon', this.gateEntryPayload(null, inst));
    this.sendDungeonStatus(inst.id);
    return true;
  }
  enterGateInstance(client, g, inst) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !g || !inst) return false;
    this.armDungeonRecovery(client, g);
    inst.addPlayer(client.sessionId);
    p.dgn = g.id;
    p.dim = 'dungeon';
    p.mount = '';                 // can't ride into a dungeon
    const hp = this.ensurePlayerHp(client);
    hp.hp = hp.max;
    client.send('enterDungeon', this.gateEntryPayload(g, inst));
    return true;
  }
  startDungeonLobby(lobby) {
    const g = this.state.gates.get(lobby.gateId);
    if (!g || !g.active) return this.disbandDungeonLobby(lobby.gateId, 'gone');
    let inst = this.instances[g.id];
    if (!inst) inst = this.createInstance(g);
    const members = [...lobby.members];
    this.dungeonLobbies.delete(lobby.gateId);
    for (const sid of members) {
      const c = this.clients.find(cl => cl.sessionId === sid);
      const p = this.state.players.get(sid);
      if (!c || !p || p.dgn || !this.canEnterGate(c, g) || Math.hypot(g.x - p.x, g.z - p.z) > 7) {
        if (c) c.send('dungeonLobbyClosed', { gateId: g.id, reason: 'range' });
        continue;
      }
      c.send('dungeonLobbyStart', { gateId: g.id });
      this.enterGateInstance(c, g, inst);
    }
    this.sendDungeonStatus(g.id);
  }
  maybeStartDungeonLobby(lobby) {
    if (!lobby || !lobby.members.size) return;
    for (const sid of lobby.members) if (!lobby.ready.has(sid)) return;
    this.startDungeonLobby(lobby);
  }
  enterGate(client, m) {
    const p = this.state.players.get(client.sessionId);
    const found = this.findGateForPlayer(client, m);
    const g = found.gate;
    if (!p || !g) return client.send('gateReject', { reason: found.reason || 'locked' });
    if (this.rateLimited(client, 'action', 5, 10)) return client.send('gateReject', { reason: 'rate' });
    let inst = this.instances[g.id];
    if (inst && !inst.cleared && inst.players && inst.players.size) {
      this.enterGateInstance(client, g, inst);
      this.sendDungeonStatus(g.id);
      return;
    }
    if (!this.dungeonLobbies) this.dungeonLobbies = new Map();
    this.leaveDungeonLobby(client.sessionId, false);
    let lobby = this.dungeonLobbies.get(g.id);
    if (!lobby) {
      lobby = {
        id: g.id + ':lobby',
        gateId: g.id,
        rank: g.rank | 0,
        kind: g.kind || 'public',
        leader: client.sessionId,
        members: new Set(),
        ready: new Set(),
        createdAt: Date.now(),
      };
      this.dungeonLobbies.set(g.id, lobby);
    }
    lobby.members.add(client.sessionId);
    this.sendDungeonLobby(lobby);
  }
  handleDungeonLobbyReady(client, m) {
    const p = this.state.players.get(client.sessionId);
    if (!p || p.dgn) return client.send('gateReject', { reason: 'invalid' });
    if (this.rateLimited(client, 'action', 5, 10)) return client.send('gateReject', { reason: 'rate' });
    let lobby = null;
    if (m && typeof m.gateId === 'string' && this.dungeonLobbies) lobby = this.dungeonLobbies.get(m.gateId);
    if (!lobby && this.dungeonLobbies) {
      for (const l of this.dungeonLobbies.values()) if (l.members.has(client.sessionId)) { lobby = l; break; }
    }
    if (!lobby || !lobby.members.has(client.sessionId)) return client.send('gateReject', { reason: 'lobby' });
    const g = this.state.gates.get(lobby.gateId);
    if (!g || !g.active) return this.disbandDungeonLobby(lobby.gateId, 'gone');
    if (!this.canEnterGate(client, g) || Math.hypot(g.x - p.x, g.z - p.z) > 7) {
      this.leaveDungeonLobby(client.sessionId, true);
      return client.send('gateReject', { reason: 'range' });
    }
    if (m && m.ready === false) lobby.ready.delete(client.sessionId);
    else lobby.ready.add(client.sessionId);
    this.sendDungeonLobby(lobby);
    this.maybeStartDungeonLobby(lobby);
  }

  createInstance(g) {
    const d = D.generateDungeon(g.rank, g.seed);
    const inst = new DungeonInstance(d, g, this);
    inst.lootChestTotal = this.countGeneratedDungeonChests(d.world);
    this.instances[g.id] = inst;
    const plus = inst.shardPlus, modSet = inst.shardModSet;
    // shard affix multipliers (Phase B): base +N scaling plus stat affixes
    const baseHp = 1 + 0.18 * plus, baseDmg = 1 + 0.12 * plus;
    let trashHpMul = baseHp, trashDmgMul = baseDmg, bossHpMul = baseHp, bossDmgMul = baseDmg;
    if (modSet.has('Empowered')) { trashDmgMul *= 1.5; bossDmgMul *= 1.5; }
    if (modSet.has('Fortified')) trashHpMul *= 1.6;
    if (modSet.has('Tyrannical')) { bossHpMul *= 1.7; bossDmgMul *= 1.4; }
    const mul = D.RANK_MUL[g.rank];
    const trashHp = (kind, elite) => Math.round(((kind === 'skeleton' ? 6 : 8) + 8 * mul) * trashHpMul * (elite ? 1.8 : 1));
    const trashDmg = (elite) => Math.max(1, Math.round((3 + g.rank) * trashDmgMul * (elite ? 1.45 : 1)));
    const trashSpd = (kind) => (kind === 'skeleton' ? 1.3 : 1.6) + Math.random() * .5;
    // Group the generator's spawns by their nearest room so each room reads as a
    // themed encounter instead of a uniform smear of identical zombies. Server-only:
    // the byte-identical world buffer and the client are untouched — mobs still sync
    // by kind/maxHp, so a tougher elite simply shows a longer health bar.
    const roomOf = (x, z) => {
      let best = null, bd = Infinity;
      for (const rm of d.rooms) { const dd = Math.hypot(rm.x - x, rm.z - z); if (dd < bd) { bd = dd; best = rm; } }
      return best;
    };
    const byRoom = new Map();
    for (const s of d.spawns) {
      const rm = roomOf(s.x, s.z);
      const key = rm ? rm.x + ',' + rm.z : 'loose';
      let group = byRoom.get(key);
      if (!group) byRoom.set(key, group = { type: rm ? rm.type : 'guard', list: [] });
      group.list.push(s);
    }
    for (const { type, list } of byRoom.values()) {
      list.forEach((s, i) => {
        // skeletons add ranged variety — now present from E-rank (was rank >= 1 only)
        let skelChance = g.rank >= 1 ? .35 : .22;
        if (type === 'guard') skelChance = i === 1 ? .85 : .12;   // a melee pack with one archer covering it
        else if (type === 'pit') skelChance = .55;                // ledges favour ranged attackers
        else if (type === 'crypt') skelChance = .30;
        const kind = Math.random() < skelChance ? 'skeleton' : 'zombie';
        // vault / treasure rooms post a tougher elite standing guard over the loot
        const elite = (type === 'vault' || type === 'treasure') && i === 0;
        const id = this.addDungeonMob(g.id, s.x, s.z, kind, trashHp(kind, elite), trashDmg(elite), trashSpd(kind), d.world, g.rank);
        if (elite) {
          if (this.mobMeta[id]) this.mobMeta[id].elite = true;
          const em = this.state.mobs.get(id);
          if (em) em.elite = true;   // synced so the client renders the elite model/tint
        }
      });
    }
    this.addDungeonMob(g.id, d.bossRoom.x, d.bossRoom.z, 'boss',
      Math.round(50 * mul * bossHpMul),
      Math.max(1, Math.round((5 + g.rank * 2) * bossDmgMul)), 1.3, d.world, g.rank);
    return inst;
  }

  addDungeonMob(dgn, x, z, kind, hp, dmg, speed, wbuf, rank) {
    const id = String(++this.mobSeq);
    const mob = new Mob();
    const gy = D.standHeightIn(wbuf, x, z, 12);
    mob.x = x; mob.y = gy > 0 ? gy : 9; mob.z = z;
    mob.maxHp = mob.hp = hp;
    mob.kind = kind;
    mob.dgn = dgn;
    this.state.mobs.set(id, mob);
    this.mobMeta[id] = this.freshMeta(x, z, dmg, speed, kind, rank, kind === 'boss');
    return id;
  }
  // ---------------- shard environmental hazards (server-authored) ----------------
  removeTransient(dgn, id) {
    const inst = this.instances[dgn];
    if (!inst || !inst.haz) return;
    inst.haz.orbs = inst.haz.orbs.filter(o => o.id !== id);
    inst.haz.ghosts = inst.haz.ghosts.filter(g => g.id !== id);
  }
  spawnHazMob(inst, kind, x, z, hp, withMeta, dmg, speed) {
    const id = String(++this.mobSeq);
    const mob = new Mob();
    const gy = D.standHeightIn(inst.world, x, z, 12);
    mob.x = x; mob.y = gy > 0 ? gy : 9; mob.z = z;
    mob.maxHp = mob.hp = hp;
    mob.kind = kind;
    mob.dgn = inst.id;
    this.state.mobs.set(id, mob);
    if (withMeta) this.mobMeta[id] = this.freshMeta(x, z, dmg, speed, kind, inst.rank, true);
    return { id, mob };
  }
  // hazard damage guard: only hit players still alive and inside this instance
  // (a player can be killed/ejected by an earlier hazard within the same tick)
  hurtIfActive(sid, dgn, dmg, reason = 'dungeon_hazard') {
    const p = this.state.players.get(sid);
    const hp = this.playerHp.get(sid);
    if (!p || p.dgn !== dgn || !hp || hp.hp <= 0) return;
    const c = this.clients.find(cl => cl.sessionId === sid);
    if (c) this.hurtPlayer(c, dmg, reason);
  }
  hurtSidsInRadius(inst, players, x, z, r, dmg, reason = 'dungeon_area') {
    for (const { p, sid } of players) {
      if (p && Math.hypot(p.x - x, p.z - z) <= r) this.hurtIfActive(sid, inst.id, dmg, reason);
    }
  }
  instancePlayers(inst) {
    const out = [];
    for (const sid of inst.players) {
      const p = this.state.players.get(sid);
      if (p && p.dgn === inst.id) out.push({ sid, p });
    }
    return out;
  }
  onDungeonTrashDeath(dgn, x, y, z) {
    const inst = this.instances[dgn];
    if (!inst || !inst.hazMods || !inst.hazMods.size) return;
    const plus = inst.shardPlus | 0;
    if (inst.hazMods.has('Volatile')) inst.haz.vols.push({ x, y, z, t: 1.1, dmg: 4 + plus });
    if (inst.hazMods.has('Sanguine')) inst.haz.pools.push({ x, z, t: 6 });
    if (inst.hazMods.has('Spiteful')) this.spawnGhost(inst, x, z);
    if (inst.hazMods.has('Bursting')) {
      for (const { sid } of this.instancePlayers(inst)) {
        const b = inst.haz.bleed.get(sid) || { stacks: 0, t: 0, acc: 0 };
        b.stacks = Math.min(8, b.stacks + 1); b.t = 4;
        inst.haz.bleed.set(sid, b);
      }
      this.sendSpace(dgn, 'fx', { t: 'bleed', dgn });
    }
  }
  spawnGhost(inst, x, z) {
    const { id } = this.spawnHazMob(inst, 'ghost', x, z, 1, true, 2 + (inst.shardPlus | 0), 3.0 + Math.random() * .4);
    inst.haz.ghosts.push({ id, life: 8 });
    this.sendSpace(inst.id, 'fx', { t: 'ghost', x, z, dgn: inst.id });
  }
  spawnOrb(inst, players) {
    const anchor = players[(Math.random() * players.length) | 0];
    if (!anchor) return;
    for (let k = 0; k < 8; k++) {
      const a = Math.random() * 6.283, d = 3 + Math.random() * 3;
      const x = anchor.p.x + Math.cos(a) * d, z = anchor.p.z + Math.sin(a) * d;
      const gy = D.standHeightIn(inst.world, x, z, anchor.p.y + 2);
      if (gy < 1) continue;
      const { id } = this.spawnHazMob(inst, 'orb', x, z, 2, false, 0, 0);
      inst.haz.orbs.push({ id, x, z, y: gy, fuse: 6 });
      this.sendSpace(inst.id, 'fx', { t: 'orb', x, z, dgn: inst.id });
      return;
    }
  }
  tickInstanceHazards(inst, dt, players) {
    const haz = inst.haz, plus = inst.shardPlus | 0;
    // Volatile: delayed corpse explosions
    for (let i = haz.vols.length - 1; i >= 0; i--) {
      const v = haz.vols[i]; v.t -= dt;
      if (v.t <= 0) {
        this.sendSpace(inst.id, 'fx', { t: 'shardboom', x: v.x, y: v.y, z: v.z, dgn: inst.id });
        this.hurtSidsInRadius(inst, players, v.x, v.z, 3, v.dmg);
        haz.vols.splice(i, 1);
      }
    }
    // Sanguine: ichor pools heal wounded trash standing in them
    for (let i = haz.pools.length - 1; i >= 0; i--) {
      const pool = haz.pools[i]; pool.t -= dt;
      this.state.mobs.forEach(mm => {
        if (mm.dgn === inst.id && mm.kind !== 'boss' && mm.kind !== 'orb' && mm.kind !== 'ghost' &&
            mm.hp < mm.maxHp && Math.hypot(mm.x - pool.x, mm.z - pool.z) < 2.2)
          mm.hp = Math.min(mm.maxHp, mm.hp + 6 * dt);
      });
      if (pool.t <= 0) haz.pools.splice(i, 1);
    }
    // Spiteful: ghost lifetimes
    for (let i = haz.ghosts.length - 1; i >= 0; i--) {
      const g = haz.ghosts[i]; g.life -= dt;
      if (g.life <= 0) {
        this.state.mobs.delete(g.id); delete this.mobMeta[g.id];
        haz.ghosts.splice(i, 1);
      }
    }
    // Explosive: spawn unstable orbs and tick their fuses
    if (inst.hazMods.has('Explosive') && players.length) {
      haz.orbT -= dt;
      if (haz.orbT <= 0) { haz.orbT = 11 + Math.random() * 6; this.spawnOrb(inst, players); }
    }
    for (let i = haz.orbs.length - 1; i >= 0; i--) {
      const o = haz.orbs[i]; o.fuse -= dt;
      if (o.fuse <= 0) {
        const mob = this.state.mobs.get(o.id);
        const ox = mob ? mob.x : o.x, oy = mob ? mob.y : o.y, oz = mob ? mob.z : o.z;
        this.sendSpace(inst.id, 'fx', { t: 'shardboom', x: ox, y: oy, z: oz, dgn: inst.id });
        this.hurtSidsInRadius(inst, players, ox, oz, 3, 6 + plus);
        this.state.mobs.delete(o.id); delete this.mobMeta[o.id];
        haz.orbs.splice(i, 1);
      }
    }
    // Quaking: telegraph a shockwave under each player, detonate after a beat
    if (inst.hazMods.has('Quaking')) {
      haz.quakeT -= dt;
      if (haz.quakeT <= 0) {
        haz.quakeT = 7 + Math.random() * 5;
        for (const { p, sid } of players) {
          haz.quakes.push({ x: p.x, z: p.z, sid, t: 1.0 });
          this.sendSpace(inst.id, 'fx', { t: 'quakewarn', x: p.x, z: p.z, dgn: inst.id });
        }
      }
      for (let i = haz.quakes.length - 1; i >= 0; i--) {
        const q = haz.quakes[i]; q.t -= dt;
        if (q.t <= 0) {
          this.sendSpace(inst.id, 'fx', { t: 'quake', x: q.x, z: q.z, dgn: inst.id });
          const cur = this.state.players.get(q.sid);
          if (cur && Math.hypot(cur.x - q.x, cur.z - q.z) < 2.5) this.hurtIfActive(q.sid, inst.id, 4 + plus);
          haz.quakes.splice(i, 1);
        }
      }
    }
    // Bursting bleed + Grievous self-bleed (fractional DoT accumulated to integer ticks)
    for (const { sid } of players) {
      const b = haz.bleed.get(sid);
      if (b && b.stacks > 0) {
        b.t -= dt;
        b.acc = (b.acc || 0) + 0.5 * b.stacks * dt;
        if (b.acc >= 1) { const n = Math.floor(b.acc); b.acc -= n; this.hurtIfActive(sid, inst.id, n); }
        if (b.t <= 0) haz.bleed.delete(sid);
      }
      if (inst.hazMods.has('Grievous')) {
        const hp = this.playerHp.get(sid);
        if (hp) {
          const gv = haz.grv.get(sid) || { stacks: 0, t: 0, acc: 0 };
          if (hp.hp >= hp.max) gv.stacks = 0;
          else if (hp.hp < hp.max * 0.9) {
            gv.t -= dt;
            if (gv.t <= 0) { gv.t = 3; gv.stacks = Math.min(5, gv.stacks + 1); }
          }
          if (gv.stacks > 0) {
            gv.acc += 0.4 * gv.stacks * dt;
            if (gv.acc >= 1) { const n = Math.floor(gv.acc); gv.acc -= n; this.hurtIfActive(sid, inst.id, n); }
          }
          haz.grv.set(sid, gv);
        }
      }
    }
  }

  leaveInstance(sid) {
    const p = this.state.players.get(sid);
    if (!p || !p.dgn) return;
    if (p.dim === 'event') {
      p.dgn = '';
      p.dim = 'overworld';
      return;
    }
    const dgn = p.dgn;
    const inst = this.instances[dgn];
    this.clearDungeonRecoveryForSid(sid);
    p.dgn = '';
    p.dim = 'overworld';
    if (!inst) return;
    inst.removePlayer(sid);
    if (inst.playerCount === 0) inst.dispose();
    else this.sendDungeonStatus(dgn);
  }
  ejectFromDungeon(sid) {
    const p = this.state.players.get(sid);
    if (!p || !p.dgn) return;
    const inst = this.instances[p.dgn];
    this.clearDungeonRecoveryForSid(sid);
    p.dgn = '';
    p.dim = 'overworld';
    p.x = W.TOWN.TC + .5;
    p.y = W.TOWN.G + 2;
    p.z = W.TOWN.TC + 7.5;
    const token = this.tokens.get(sid);
    const prof = token && this.profiles.get(token);
    if (prof) {
      prof.pos = [p.x, p.y, p.z];
      this.dirtyPlayers.add(token);
    }
    const hp = this.playerHp.get(sid);
    if (hp) hp.hp = hp.max;
    if (inst) inst.removePlayer(sid);
    this.bossContrib.forEach(byPlayer => byPlayer.delete(sid));
  }
  clearDungeonInstance(dgn) {
    const inst = this.instances[dgn];
    if (!inst) return;
    inst.dispose();   // also clears bossContrib for this instance
  }
  failDungeon(dgn, reason) {
    const inst = this.instances[dgn];
    if (!inst) return;
    for (const sid of [...inst.players]) {
      const client = this.clients.find(c => c.sessionId === sid);
      this.ejectFromDungeon(sid);
      const p = this.state.players.get(sid);
      if (client) client.send('dungeonFailed', {
        reason: reason || 'wipe',
        x: p && p.x, y: p && p.y, z: p && p.z,
      });
    }
    this.clearDungeonInstance(dgn);
    this.expireGate(dgn);
  }

  // One-time progression hook: the boss already guarantees the next-rank solo key on
  // every clear, so the FIRST time a hunter clears a given rank we add a distinct
  // material leg-up — iron + diamond to craft gear for the rank ahead. Returns []
  // when it isn't a fresh clear or there's no rank above this one.
  firstClearBonusItems(rank, progress) {
    if (!progress || !progress.newClear || rank < 0 || rank >= 4) return [];
    return [
      { id: I.IRON_INGOT, count: 4 + rank * 2 },
      { id: I.DIAMOND, count: 1 + rank },
    ];
  }
  onBossDown(dgn) {
    const inst = this.instances[dgn];
    if (!inst || inst.cleared) return;
    inst.cleared = true;
    // A cleared gate is consumed. Hunters already inside retain their return
    // portal, but the party cannot leave and regenerate a fresh boss from the
    // same gate during its remaining TTL.
    this.expireGate(dgn);
    const ri = inst.rank;
    const reward = BOSS_REWARD_BY_RANK[ri];
    const baseLoot = {
      source: 'boss',
      xp: reward.xp,
      gold: reward.gold,
      coal: reward.coal,
      iron: reward.iron,
      dia: reward.dia,
      items: this.rollBossKeyDrops(ri),
      rank: ri,
      kind: inst.kind || 'public',
      earned: true,
    };
    const plus = inst.shardPlus | 0;
    if (plus > 0) {
      baseLoot.gold = Math.round(baseLoot.gold * (1 + 0.4 * plus));
      baseLoot.xp = Math.round(baseLoot.xp * (1 + 0.25 * plus));
      baseLoot.items.push({ id: I.LEGEND_TOKEN, count: 1 + Math.floor(plus / 2) });
      baseLoot.shard = { plus, name: inst.shardName || '' };
    }
    for (const c of this.clients) {
      const q = this.state.players.get(c.sessionId);
      if (!q || q.dgn !== dgn) continue;
      const eligibility = this.bossRewardEligibility(c, inst);
      if (eligibility.ok) {
        c.send('gateCleared', { rank: ri });
        const progress = this.markGateCleared(c, ri);
        const items = baseLoot.items.map(it => ({ ...it }));
        const eggPool = DRAGON_DROP_POOL[ri] || [];
        if (eggPool.length && Math.random() < DRAGON_EGG_BOSS_CHANCE[ri]) {
          items.push({ id: DRAGON_EGG_OF(this.pickDragonEggForPlayer(c, eggPool)), count: 1 });
        }
        const firstClear = this.firstClearBonusItems(ri, progress);
        for (const b of firstClear) items.push(b);
        const loot = { ...baseLoot, items, progress: this.dungeonRewardProgress(ri, progress) };
        if (firstClear.length) {
          loot.firstClear = { rank: ri, nextRank: ri + 1 };
          this.broadcast('chat', { name: '[Gate]', text: (q.name || 'A hunter') + ' cleared their first ' + 'EDCBA'[ri] + '-Rank Gate — first-clear bonus awarded!' });
        }
        this.awardLoot(c, loot);
      } else {
        c.send('lootReject', {
          reason: eligibility.reason || 'contribution',
          rank: ri,
          kind: inst.kind || 'public',
          progress: this.dungeonRewardProgress(ri, null),
        });
      }
    }
    this.bossContrib.delete(dgn);
    this.sendDungeonStatus(dgn);
    const clearMsg = plus > 0
      ? 'The ' + (inst.shardName || 'sharded') + ' +' + plus + ' Gate has been cleared — Legendary loot awarded!'
      : 'The ' + 'EDCBA'[ri] + '-Rank Gate has been cleared!';
    this.broadcast('chat', { name: '[System]', text: clearMsg });
  }

}

module.exports = DungeonMixin.prototype;
