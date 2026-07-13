// Dungeon gates, party instances, entry/exit, and server-authored shard hazards.
// Lifted verbatim out of GameRoom.js and mixed into its prototype.
const {
  BOLSTER_DMG, BOLSTER_HP, BOLSTER_MAX_STACKS, BOLSTER_RADIUS,
  BOSS_REWARD_BY_RANK, BREACH_CLEANUP_REWARD_BY_RANK, DRAGON_DROP_POOL, DRAGON_EGG_BOSS_CHANCE, DRAGON_EGG_OF, GATE_DISTANCE_BANDS,
  I, SHARD_ITEM_IDS, SHARD_TIERS, SOLO_KEYS, TEAM_KEYS, rollShardMods, townDistance,
} = require('./constants');
const { State, Player, Mob, Team, Gate } = require('../schema');
const { TeamManager } = require('../teams');
const W = require('../world');
const D = require('../dungeon');
const AI = require('../ai');
const { DungeonInstance } = require('./dungeonInstance');
const { GATE_INTERACT_RANGE, gateEncounterPreview, gateReadinessForProfile, gateRoleForProfile, gateProfileSignals, gatePartyReadinessSummary } = require('./gate-readiness');
const { createStore, sanitizeProfile, mergeClientSave, defaultProfile, cleanToken, sanitizeUtilityLoadout } = require('../store');
const { canonicalDungeonId } = require('../../shared/dungeon-pools');
const { issueDungeonAdmission } = require('./dungeon-admission');
const MAX_ACTIVE_GATE_BREACHES = 3;

class DungeonMixin {
  // Dungeon / gate lifecycle state, co-located with the mixin that owns it.
  // Called once from onCreate, before restoreSavedGates (which fills gateSeq/gateTtls).
  initDungeonState() {
    this.dungeonLobbies = new Map();
    this.gateSeq = 0;
    this.gateTtls = new Map();
    this.gateLootedChests = new Map();
    this.gateBreaches = new Map();
    this.gateBreachScars = new Map();
    this.dungeonPingAt = new Map();
    this.gateTimer = 40;       // countdown to the next public gate spawn (sim-loop driven)
    this.gateTtl = 0;
  }

  dungeonStatusPayload(inst) {
    if (!inst) return null;
    const party = [];
    inst.players.forEach(sid => {
      const p = this.state.players.get(sid);
      if (p && p.dgn === inst.id) {
        const hp = this.playerHp.get(sid) || { hp: 0, max: 1 };
        const token = this.tokens.get(sid), profile = token && this.profiles.get(token);
        const contribution = this.bossContrib.get(inst.id)?.get(sid) || { damage: 0, support: 0 };
        const spirit = !!p.spirit;
        const downed = hp.hp <= 0;
        party.push({ sid, name: p.name, lvl: p.lvl, team: p.team || '', x: p.x, y: p.y, z: p.z, hp: Math.max(0, Math.ceil(hp.hp)), maxHp: Math.max(1, Math.ceil(hp.max)), downed, spirit, state: spirit ? 'spirit' : downed ? 'downed' : 'alive', role: gateRoleForProfile(profile || {}), contribution: Math.round((contribution.damage || 0) + (contribution.support || 0)) });
      }
    });
    let bossAlive = false, boss = null;
    this.state.mobs.forEach(m => { if (m.dgn === inst.id && m.kind === 'boss' && m.hp > 0) { bossAlive = true; boss = m; } });
    const looted = this.gateLootedChests.get(inst.id)?.size || 0;
    const unopenedChests = this.unopenedDungeonChests(inst).slice(0, 8);
    const roomProgress = inst.roomProgress || { total: 0, cleared: 0 };
    const totalPlayers = Math.max(inst.originalPlayers ? inst.originalPlayers.size : 0, inst.players ? inst.players.size : 0, party.length);
    const aliveCount = party.filter(m => m.state === 'alive').length;
    const spiritCount = party.filter(m => m.state === 'spirit').length;
    const downedCount = party.filter(m => m.state === 'downed').length;
    const returnedCount = Math.max(0, totalPlayers - party.length);
    return {
      id: inst.id,
      rank: inst.rank,
      kind: inst.kind || 'public',
      party,
      totalPlayers,
      activeCount: party.length,
      aliveCount,
      spiritCount,
      downedCount,
      returnedCount,
      wipe: party.length > 0 && aliveCount === 0,
      bossAlive,
      boss: boss ? this.dungeonBossStatusPayload(boss) : null,
      cleared: !!inst.cleared,
      roomsCleared: Math.max(0, roomProgress.cleared | 0),
      roomTotal: Math.max(0, roomProgress.total | 0),
      bossGateState: typeof inst.bossGateState === 'function' ? inst.bossGateState() : (inst.cleared ? 'defeated' : 'open'),
      bossRoom: inst.bossRoom ? { x: inst.bossRoom.x, z: inst.bossRoom.z } : null,
      exit: inst.entrance ? { x: inst.entrance.x, z: inst.entrance.z } : null,
      unopenedChests,
      remainingChests: Math.max(0, (inst.lootChestTotal || 0) - looted),
    };
  }
  dungeonBossStatusPayload(boss) {
    const hp = Math.max(0, Math.ceil(boss.hp || 0));
    const maxHp = Math.max(1, Math.ceil(boss.maxHp || 1));
    const pct = hp / maxHp;
    const phase = boss.enraged || pct <= .2 ? 4 : pct <= .33 ? 3 : pct <= .66 ? 2 : 1;
    return {
      x: boss.x, y: boss.y, z: boss.z,
      hp,
      maxHp,
      pct: Math.round(pct * 100),
      phase,
      phaseLabel: boss.enraged || phase === 4 ? 'Enraged' : 'Phase ' + phase,
      state: boss.state || 'chase',
      enraged: !!boss.enraged,
      name: boss.displayName || 'Gate Boss',
    };
  }
  bossMasterySpec(rank = 0) {
    const specs = [
      { tag: 'E-rank Fundamentals', focus: 'slam, charge, and safe-zone ring', reasons: ['boss_slam', 'boss_charge', 'grave_ring'] },
      { tag: 'D-rank Volley Lesson', focus: 'first ranged pressure', reasons: ['arrow', 'boss_charge'] },
      { tag: 'C-rank Positioning Lesson', focus: 'rings and ground spikes', reasons: ['grave_ring', 'boss_spikes'] },
      { tag: 'B-rank Control Lesson', focus: 'roots and control pressure', reasons: ['boss_control_roots', 'keeper_roots', 'blighted_roots', 'drowned_tide'] },
      { tag: 'A/S-rank Layered Lesson', focus: 'layered follow-up mechanics', reasons: ['boss_slam', 'boss_charge', 'grave_ring', 'boss_spikes', 'boss_control_roots', 'keeper_roots', 'blighted_roots', 'drowned_tide', 'ossuary_wave', 'falling_rock'] },
    ];
    return specs[Math.max(0, Math.min(4, rank | 0))] || specs[0];
  }
  isBossMasteryReason(reason = '') {
    return ['boss_melee', 'boss_slam', 'boss_charge', 'boss_spikes', 'grave_ring', 'falling_rock', 'keeper_roots', 'boss_control_roots', 'drowned_tide', 'ossuary_wave', 'blighted_roots', 'arrow'].includes(String(reason || '').replace(/_arrow$/, ''));
  }
  rememberDungeonBossMechanicHit(client, damage, reason) {
    const p = client && this.state.players.get(client.sessionId);
    if (!p || !p.dgn || damage <= 0 || !this.isBossMasteryReason(reason)) return;
    const inst = this.instances[p.dgn];
    if (!inst || inst.cleared || !inst.bossMastery) return;
    const key = String(reason || 'combat').replace(/_arrow$/, '');
    const rec = inst.bossMastery.hitsBySid.get(client.sessionId) || { total: 0, damage: 0, byReason: {} };
    rec.total += 1;
    rec.damage += Math.max(0, damage | 0);
    rec.byReason[key] = (rec.byReason[key] | 0) + 1;
    inst.bossMastery.hitsBySid.set(client.sessionId, rec);
    inst.bossMastery.partyHits = (inst.bossMastery.partyHits | 0) + 1;
  }
  recordDungeonBossDeathReason(client, reason = 'combat') {
    const p = client && this.state.players.get(client.sessionId);
    if (!p || !p.dgn) return;
    const inst = this.instances[p.dgn];
    if (!inst || !inst.bossMastery) return;
    const key = String(reason || 'combat').replace(/_arrow$/, '');
    inst.bossMastery.deathsByReason.set(key, (inst.bossMastery.deathsByReason.get(key) || 0) + 1);
  }
  dungeonMasteryResult(inst, client = null) {
    if (!inst) return null;
    const spec = this.bossMasterySpec(inst.rank);
    const sid = client && client.sessionId;
    const rec = sid && inst.bossMastery && inst.bossMastery.hitsBySid.get(sid) || { total: 0, damage: 0, byReason: {} };
    const lessonHits = spec.reasons.reduce((sum, r) => sum + (rec.byReason[r] | 0), 0);
    const partyHits = inst.bossMastery ? inst.bossMastery.partyHits | 0 : 0;
    let topReason = '', topDeaths = 0;
    if (inst.bossMastery) for (const [reason, count] of inst.bossMastery.deathsByReason.entries()) if (count > topDeaths) { topDeaths = count; topReason = reason; }
    const noDeaths = (inst.deathCount | 0) === 0;
    const clean = lessonHits === 0 && noDeaths;
    const bonus = clean ? { gold: 8 + (inst.rank | 0) * 4, iron: 1 + Math.max(0, inst.rank | 0) } : null;
    const lines = [
      clean ? 'Clean lesson: no deaths and no ' + spec.focus + ' hits.' : 'Lesson hits taken: ' + lessonHits + ' (' + spec.focus + ').',
      partyHits ? 'Party avoidable boss hits: ' + partyHits + '.' : 'Party avoided every tracked boss mechanic hit.',
    ];
    if (topReason) lines.push('Wipe training: most lethal mechanic was ' + this.combatReasonLabel(topReason) + '.');
    return { tag: spec.tag, focus: spec.focus, clean, bonus, hitCount: rec.total | 0, lessonHits, partyHits, deaths: inst.deathCount | 0, topDeath: topReason ? this.combatReasonLabel(topReason) : '', lines };
  }
  unopenedDungeonChests(inst) {
    if (!inst) return [];
    const looted = this.gateLootedChests.get(inst.id) || new Set();
    return (inst.lootChestLocations || []).filter(ch => ch && !looted.has(ch.key)).map(ch => ({ x: ch.x, y: ch.y, z: ch.z }));
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
  dungeonResultPayload(inst, outcome = 'cleared', reason = '') {
    if (!inst) return null;
    const status = this.dungeonStatusPayload(inst) || {};
    const looted = this.gateLootedChests.get(inst.id)?.size || 0;
    const def = inst.definition || {};
    const plus = inst.shardPlus | 0;
    return {
      outcome,
      reason: reason || '',
      id: inst.id,
      rank: inst.rank | 0,
      kind: inst.kind || 'public',
      dungeonId: inst.dungeonId || '',
      dungeonName: def.name || '',
      bossName: def.boss || 'Gate Boss',
      clearMs: Math.max(0, Date.now() - (inst.startedAt || Date.now())),
      deaths: Math.max(0, inst.deathCount | 0),
      spirits: status.spiritCount | 0,
      returned: status.returnedCount | 0,
      partySize: Math.max(status.totalPlayers | 0, status.party ? status.party.length : 0),
      chestsOpened: looted,
      chestTotal: inst.lootChestTotal | 0,
      bossAlive: !!status.bossAlive,
      mastery: this.dungeonMasteryResult(inst, null),
      shard: plus > 0 ? { plus, name: inst.shardName || '', mods: (inst.shardMods || '').split(',').filter(Boolean) } : null,
    };
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
    if (Math.hypot(gate.x - p.x, gate.z - p.z) > GATE_INTERACT_RANGE) return { gate: null, reason: 'range' };
    if (!this.canEnterGate(client, gate)) return { gate: null, reason: gate.kind || 'locked' };
    return { gate, reason: '' };
  }
  canEnterGate(client, gate) {
    if (!gate || !gate.active) return false;
    // Owned/team/shard gates grant entry by entitlement: the rank was already
    // enforced when the key was bought and the gate created, so a lower-level
    // teammate is not re-gated at the portal. Only walk-up public gates check
    // the entrant's own Hunter rank here.
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
    return this.canAccessGateRank(client, gate.rank);
  }
  isValidRestoredPublicGate(raw) {
    const rank = Math.max(0, Math.min(4, raw.rank | 0));
    const band = GATE_DISTANCE_BANDS[rank] || GATE_DISTANCE_BANDS[0];
    const x = +raw.x, z = +raw.z;
    if (!isFinite(x) || !isFinite(z)) return false;
    if (x < 6 || x > W.WX - 6 || z < 6 || z > W.WX - 6) return false;
    const distance = townDistance(x, z);
    return distance >= band.min && distance <= band.max;
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
      g.dungeonId = canonicalDungeonId(g.rank, g.seed, raw.dungeonId);
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
      g.expiresAt = raw.expiresAt;
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
  createGate({ x, y, z, rank, kind, owner, team, ttl, shardPlus, shardName, shardMods, refundItem, refundOwner, dungeonId }) {
    const g = new Gate();
    g.x = x; g.y = y; g.z = z;
    g.rank = Math.max(0, Math.min(4, rank | 0));
    g.id = 'g' + (++this.gateSeq);
    g.seed = (Math.random() * 4294967295) >>> 0;
    g.dungeonId = canonicalDungeonId(g.rank, g.seed, dungeonId);
    g.kind = ['public', 'solo', 'team', 'shard'].includes(kind) ? kind : 'public';
    g.owner = owner || '';
    g.team = this.cleanTeamId(team || '');
    g.shardPlus = Math.max(0, Math.min(5, shardPlus | 0));
    g.shardName = typeof shardName === 'string' ? shardName.slice(0, 16) : '';
    g.shardMods = Array.isArray(shardMods) ? shardMods.join(',') : (shardMods || '');
    g.refundItem = Math.max(0, refundItem | 0);
    g.refundOwner = cleanToken(refundOwner) || '';
    g.expiresAt = Date.now() + Math.max(15, ttl || 75) * 1000;
    g.active = true;
    this.state.gates.set(g.id, g);
    this.gateTtls.set(g.id, g.expiresAt);
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
  breachExpiredGate(id) {
    const g = this.state.gates.get(id);
    const inst = this.instances && this.instances[id];
    if (!g || !inst || inst.cleared) return this.expireGate(id);
    if (!this.gateBreaches) this.gateBreaches = new Map();
    this.pruneGateBreachesForNew(g.rank | 0);
    const breach = {
      id, gateId: id, x: g.x, y: g.y, z: g.z, rank: g.rank | 0,
      bossId: '', bossName: inst.definition && inst.definition.boss || 'Gate Boss',
      mobIds: [], originalTokens: [], rewarded: false, startedAt: Date.now(), expiresAt: Date.now() + 15 * 60 * 1000,
    };
    for (const sid of [...inst.players]) {
      const token = this.tokens && this.tokens.get(sid);
      if (token) breach.originalTokens.push(token);
    }
    const breached = [];
    this.state.mobs.forEach((m, mid) => {
      if (!m || m.dgn !== id || m.hp <= 0) return;
      const n = breached.length, ring = 3 + Math.floor(n / 8) * 2, a = n * 2.399;
      const x = g.x + Math.cos(a) * ring, z = g.z + Math.sin(a) * ring;
      const y = this.world && this.world.standHeight ? this.world.standHeight(x, z, W.WH - 2) : g.y;
      m.x = x; m.y = y > 0 ? y : g.y; m.z = z; m.dgn = ''; m.state = m.kind === 'boss' ? 'chase' : '';
      const meta = this.mobMeta[mid] || this.freshMeta(m.x, m.z, 4 + (inst.rank | 0), 1.4, m.kind, inst.rank, true);
      meta.sx = meta.tx = m.x; meta.sz = meta.tz = m.z; meta.alert = true; meta.rank = inst.rank | 0; meta.gateBreach = id; meta.dayActive = true;
      if (m.kind === 'boss') { meta.woke = true; meta.gcd = 1.2; meta.bossStyle = meta.bossStyle || inst.bossStyle || ''; meta.gateBreachBoss = true; breach.bossId = String(mid); m.displayName = 'Breached ' + breach.bossName; }
      this.mobMeta[mid] = meta;
      breach.mobIds.push(String(mid));
      breached.push(m);
    });
    const result = this.dungeonResultPayload(inst, 'failed', 'breach');
    for (const sid of [...inst.players]) {
      const client = this.clients.find(c => c.sessionId === sid);
      this.ejectFromDungeon(sid);
      const p = this.state.players.get(sid);
      if (client) client.send('dungeonFailed', {
        reason: 'breach',
        result,
        x: p && p.x, y: p && p.y, z: p && p.z,
      });
    }
    this.clearDungeonInstance(id);
    this.expireGate(id);
    if (breach.bossId) this.gateBreaches.set(id, breach);
    this.broadcast('chat', { name: '[Gate]', text: 'A Gate collapsed before it was cleared. ' + breached.length + ' dungeon threat' + (breached.length === 1 ? '' : 's') + ' breached into the overworld!' });
    this.sendSpace('', 'gateBreach', { gateId: id, x: g.x, y: g.y, z: g.z, rank: g.rank | 0, count: breached.length, bossName: breach.bossName, expiresAt: breach.expiresAt });
  }
  breachExternalDungeonGate(payload) {
    if (!payload || !payload.gateId) return false;
    const id = String(payload.gateId);
    const g = this.state.gates.get(id);
    if (!g) return false;
    if (!this.gateBreaches) this.gateBreaches = new Map();
    const rank = Math.max(0, Math.min(4, (payload.rank != null ? payload.rank : g.rank) | 0));
    this.pruneGateBreachesForNew(rank);
    const now = Date.now();
    const breach = {
      id, gateId: id, x: g.x, y: g.y, z: g.z, rank,
      bossId: '', bossName: payload.bossName || 'Gate Boss',
      mobIds: [], originalTokens: Array.isArray(payload.originalTokens) ? payload.originalTokens.filter(Boolean) : [],
      rewarded: false, startedAt: now, expiresAt: now + 15 * 60 * 1000,
    };
    const specs = Array.isArray(payload.mobs) ? payload.mobs : [];
    const spawned = [];
    for (const spec of specs) {
      if (!spec || spec.hp <= 0) continue;
      const n = spawned.length, ring = 3 + Math.floor(n / 8) * 2, a = n * 2.399;
      const x = g.x + Math.cos(a) * ring, z = g.z + Math.sin(a) * ring;
      const y = this.world && this.world.standHeight ? this.world.standHeight(x, z, W.WH - 2) : g.y;
      const m = new Mob();
      m.x = x; m.y = y > 0 ? y : g.y; m.z = z; m.yaw = spec.yaw || 0;
      m.hp = Math.max(1, spec.hp || 1);
      m.maxHp = Math.max(m.hp, spec.maxHp || m.hp || 1);
      m.kind = spec.kind || 'zombie';
      m.dgn = '';
      m.state = m.kind === 'boss' ? 'chase' : (spec.state || '');
      m.variant = spec.variant || '';
      m.bossStyle = spec.bossStyle || payload.bossStyle || '';
      m.displayName = m.kind === 'boss' ? 'Breached ' + breach.bossName : (spec.displayName || '');
      m.elite = !!spec.elite;
      const mid = 'm' + (++this.mobSeq);
      this.state.mobs.set(mid, m);
      const meta = this.freshMeta(m.x, m.z, 4 + rank, 1.4, m.kind, rank, true);
      meta.sx = meta.tx = m.x; meta.sz = meta.tz = m.z; meta.alert = true; meta.rank = rank; meta.gateBreach = id; meta.dayActive = true;
      if (m.kind === 'boss') {
        meta.woke = true; meta.gcd = 1.2; meta.bossStyle = m.bossStyle || payload.bossStyle || ''; meta.gateBreachBoss = true; breach.bossId = mid;
      }
      this.mobMeta[mid] = meta;
      breach.mobIds.push(mid);
      spawned.push(m);
    }
    this.expireGate(id);
    if (breach.bossId) this.gateBreaches.set(id, breach);
    this.broadcast('chat', { name: '[Gate]', text: 'A dedicated Gate collapsed before it was cleared. ' + spawned.length + ' dungeon threat' + (spawned.length === 1 ? '' : 's') + ' breached into the overworld!' });
    this.sendSpace('', 'gateBreach', { gateId: id, x: g.x, y: g.y, z: g.z, rank, count: spawned.length, bossName: breach.bossName, expiresAt: breach.expiresAt });
    return true;
  }
  gateBreachPayload(breach) {
    if (!breach) return null;
    const boss = breach.bossId ? this.state.mobs.get(breach.bossId) : null;
    const remaining = (breach.mobIds || []).reduce((n, id) => n + (this.state.mobs.has(id) ? 1 : 0), 0);
    return {
      id: breach.id, gateId: breach.gateId, x: boss ? boss.x : breach.x, z: boss ? boss.z : breach.z,
      rank: breach.rank | 0, bossId: breach.bossId || '', bossName: breach.bossName || 'Breached Gate Boss',
      hp: boss ? boss.hp : 0, maxHp: boss ? boss.maxHp : 0, remaining, expiresAt: breach.expiresAt || 0,
    };
  }
  resolveGateBreachBoss(client, mobId, mob, meta) {
    const id = meta && meta.gateBreach;
    const breach = id && this.gateBreaches && this.gateBreaches.get(id);
    if (!breach) return false;
    const rank = Math.max(0, Math.min(4, breach.rank | 0));
    const rec = client && this.profileFor ? this.profileFor(client) : null;
    const normal = BOSS_REWARD_BY_RANK[rank] || BOSS_REWARD_BY_RANK[0];
    const cleanup = BREACH_CLEANUP_REWARD_BY_RANK[rank] || BREACH_CLEANUP_REWARD_BY_RANK[0];
    const cleanupRatio = normal && normal.xp ? Math.round((cleanup.xp / normal.xp) * 100) : 0;
    const originalParty = !!(rec && (breach.originalTokens || []).includes(rec.token));
    if (client && !breach.rewarded && !originalParty) {
      const items = (cleanup.items || []).map(it => ({ ...it }));
      this.awardGrant(client, {
        source: 'gate_breach', xp: cleanup.xp, items, rank, bossName: breach.bossName,
        normalXp: normal.xp, cleanupRatio, noKeys: true,
      });
      this.recordKillProgress(client, true);
      breach.rewarded = true;
    } else if (client && originalParty) {
      client.send('gateBreachRewardSkipped', { gateId: id, reason: 'original_party', bossName: breach.bossName, rank, normalXp: normal.xp, cleanupXp: cleanup.xp, cleanupRatio });
    }
    this.gateBreaches.delete(id);
    if (typeof this.adjustRoadSafety === 'function') this.adjustRoadSafety(3 + rank, 'gate_breach_contained');
    this.broadcast('chat', { name: '[Gate]', text: (client && this.state.players.get(client.sessionId) && this.state.players.get(client.sessionId).name || 'Hunters') + ' contained the breached Gate boss.' });
    this.sendSpace('', 'gateBreachCleared', { gateId: id, x: mob.x, y: mob.y, z: mob.z, rank, bossName: breach.bossName, normalXp: normal.xp, cleanupXp: cleanup.xp, cleanupRatio, noKeys: true });
    return true;
  }
  tickGateBreaches(now = Date.now()) {
    this.pruneGateBreachScars(now);
    if (!this.gateBreaches || !this.gateBreaches.size) return;
    for (const [id, breach] of [...this.gateBreaches]) {
      const bossAlive = breach.bossId && this.state.mobs.has(breach.bossId);
      if (!bossAlive) { this.gateBreaches.delete(id); continue; }
      if (!breach.expiresAt || breach.expiresAt > now) continue;
      this.expireGateBreachRecord(id, breach, 'uncontained', now);
    }
  }
  pruneGateBreachesForNew(rank = 0) {
    if (!this.gateBreaches || !this.gateBreaches.size) return;
    const active = [...this.gateBreaches.entries()].sort((a, b) => (a[1].startedAt || 0) - (b[1].startedAt || 0));
    const sameRank = active.find(([, breach]) => (breach.rank | 0) === (rank | 0));
    if (sameRank) this.expireGateBreachRecord(sameRank[0], sameRank[1], 'superseded', Date.now());
    while (this.gateBreaches.size >= MAX_ACTIVE_GATE_BREACHES) {
      const oldest = [...this.gateBreaches.entries()].sort((a, b) => (a[1].startedAt || 0) - (b[1].startedAt || 0))[0];
      if (!oldest) break;
      this.expireGateBreachRecord(oldest[0], oldest[1], 'overloaded', Date.now());
    }
  }
  expireGateBreachRecord(id, breach, reason = 'uncontained', now = Date.now()) {
    if (!breach) return 0;
    let removed = 0;
    for (const mobId of breach.mobIds || []) {
      if (!this.state.mobs.has(mobId)) continue;
      this.state.mobs.delete(mobId); delete this.mobMeta[mobId]; removed++;
    }
    if (this.gateBreaches) this.gateBreaches.delete(id);
    const rank = Math.max(0, breach.rank | 0), ageMin = Math.max(0, Math.floor((now - (breach.startedAt || now)) / 60000));
    const penalty = -Math.min(14, 5 + rank + Math.floor(ageMin / 3));
    if (typeof this.adjustRoadSafety === 'function') this.adjustRoadSafety(penalty, reason === 'uncontained' ? 'gate_breach_uncontained' : 'gate_breach_' + reason);
    this.recordGateBreachScar(id, breach, reason, penalty, now);
    const text = reason === 'superseded'
      ? 'A previous Gate breach was displaced by a new collapse. Road safety worsened.'
      : reason === 'overloaded'
        ? 'Too many Gate breaches destabilized the region. Road safety worsened.'
        : 'An uncontained Gate breach scattered into the region. Road safety worsened.';
    this.broadcast('chat', { name: '[Gate]', text });
    this.sendSpace('', 'gateBreachExpired', { gateId: id, x: breach.x, y: breach.y, z: breach.z, rank, count: removed, bossName: breach.bossName, reason, penalty });
    return removed;
  }
  recordGateBreachScar(id, breach, reason = 'uncontained', penalty = 0, now = Date.now()) {
    if (!breach) return null;
    if (!this.gateBreachScars) this.gateBreachScars = new Map();
    const rank = Math.max(0, Math.min(4, breach.rank | 0));
    const ttl = reason === 'uncontained' ? 12 * 60 * 1000 : 6 * 60 * 1000;
    const scar = {
      id: String(id), gateId: String(breach.gateId || id),
      x: breach.x, y: breach.y, z: breach.z, rank,
      bossName: breach.bossName || 'Escaped Gate Boss',
      reason, penalty: penalty | 0, createdAt: now, expiresAt: now + ttl,
    };
    this.gateBreachScars.set(scar.id, scar);
    return scar;
  }
  pruneGateBreachScars(now = Date.now()) {
    if (!this.gateBreachScars || !this.gateBreachScars.size) return;
    for (const [id, scar] of [...this.gateBreachScars]) if (!scar.expiresAt || scar.expiresAt <= now) this.gateBreachScars.delete(id);
  }
  gateBreachScarPayload(scar) {
    if (!scar) return null;
    return {
      id: scar.id, gateId: scar.gateId, x: scar.x, y: scar.y, z: scar.z, rank: scar.rank | 0,
      bossName: scar.bossName || 'Escaped Gate Boss', reason: scar.reason || 'uncontained',
      penalty: scar.penalty | 0, expiresAt: scar.expiresAt || 0,
    };
  }
  dungeonLobbyPayload(lobby, viewerSid = '') {
    const g = this.state.gates.get(lobby.gateId);
    const rank = g ? (g.rank | 0) : (lobby.rank | 0);
    const shardPlus = g ? (g.shardPlus | 0) : 0;
    const baseReward = BOSS_REWARD_BY_RANK[Math.max(0, Math.min(4, rank))];
    if (!lobby.preview) {
      const layout = g ? D.generateDungeon(rank, g.seed, g.dungeonId) : null;
      lobby.preview = gateEncounterPreview(g || { rank, kind: lobby.kind }, layout);
    }
    const preview = lobby.preview;
    const members = [];
    for (const sid of lobby.members) {
      const p = this.state.players.get(sid);
      if (!p) continue;
      const token = this.tokens.get(sid);
      const profile = token && this.profiles.get(token);
      const signals = gateProfileSignals(profile || {}, rank);
      members.push({
        sid,
        name: p.name || 'Hunter',
        ready: lobby.ready.has(sid),
        leader: sid === lobby.leader,
        role: signals.role,
        rankFit: signals.rankFit,
        coverage: signals.coverage,
        strengths: signals.strengths,
        roleNote: signals.roleNote,
        readiness: signals.readiness,
      });
    }
    const readyCount = members.reduce((n, m) => n + (m.ready ? 1 : 0), 0);
    const partyReadiness = gatePartyReadinessSummary(members, rank, preview);
    return {
      id: lobby.id,
      gateId: lobby.gateId,
      rank,
      kind: g ? (g.kind || lobby.kind || 'public') : (lobby.kind || 'public'),
      rally: g ? { x: g.x, y: g.y, z: g.z } : null,
      rewardXp: Math.round(baseReward.xp * (1 + .25 * Math.max(0, shardPlus))),
      preview,
      partyReadiness,
      members,
      readyCount,
      needed: members.length,
      leader: lobby.leader || '',
      advertised: !!lobby.advertised,
      canAdvertise: !viewerSid || viewerSid === lobby.leader,
    };
  }
  dungeonLobbyFinalSummary(lobby) {
    const payload = this.dungeonLobbyPayload(lobby, '');
    const rankLetters = ['E', 'D', 'C', 'B', 'A'];
    const rank = Math.max(0, Math.min(4, payload.rank | 0));
    const focusByRank = ['basic boss tells', 'ranged pressure', 'positioning checks', 'control pressure', 'layered mechanics'];
    const pr = payload.partyReadiness || {};
    const warnings = Array.isArray(pr.warnings) ? pr.warnings : [];
    const low = warnings.find(line => /crowd control/i.test(line)) ? 'low control'
      : warnings.find(line => /sustain|healing|food/i.test(line)) ? 'low sustain'
      : warnings.find(line => /ranged/i.test(line)) ? 'low ranged pressure'
      : warnings.find(line => /damage/i.test(line)) ? 'low damage'
      : warnings.find(line => /Recommended party/i.test(line)) ? 'small party'
      : 'coverage ready';
    const memberCount = Math.max(0, pr.memberCount | 0);
    return {
      line: 'Entering ' + rankLetters[rank] + '-rank Gate: ' + focusByRank[rank] + ', ' + memberCount + '/4 hunters, ' + low + '.',
      responsibilities: [
        'Stay together until first room.',
        'Boss mastery starts on first boss hit.',
        'Gate collapse timer continues outside.',
      ],
    };
  }
  handleDungeonPing(client, m) {
    const p = this.state.players.get(client.sessionId), kind = m && m.kind;
    if (!p || !p.dgn || !['group', 'boss', 'loot'].includes(kind)) return;
    if (!this.dungeonPingAt) this.dungeonPingAt = new Map();
    const now = Date.now(), last = this.dungeonPingAt.get(client.sessionId) || 0;
    if (now - last < 1500) return;
    this.dungeonPingAt.set(client.sessionId, now);
    let x = p.x, y = p.y, z = p.z;
    if (kind === 'boss') this.state.mobs.forEach(mob => { if (mob.dgn === p.dgn && mob.kind === 'boss' && mob.hp > 0) { x = mob.x; y = mob.y; z = mob.z; } });
    const payload = { kind, from: p.name || 'Hunter', x, y, z, at: now };
    for (const sid of this.instances[p.dgn]?.players || []) {
      const c = this.clients.find(other => other.sessionId === sid);
      if (c) c.send('dungeonPing', payload);
    }
  }
  sendDungeonLobby(lobby) {
    if (!lobby) return;
    this.broadcastDungeonMatchmaking();
    for (const sid of lobby.members) {
      const c = this.clients.find(cl => cl.sessionId === sid);
      if (c) {
        const p = this.state.players.get(sid), g = this.state.gates.get(lobby.gateId);
        const payload = this.dungeonLobbyPayload(lobby, sid);
        payload.youDistance = p && g ? Math.hypot(g.x - p.x, g.z - p.z) : Infinity;
        payload.canReady = payload.youDistance <= GATE_INTERACT_RANGE;
        c.send('dungeonLobby', payload);
      }
    }
  }
  dungeonMatchmakingPayload(client) {
    const p = this.state.players.get(client.sessionId), out = [];
    if (!p || p.dgn || !this.dungeonLobbies) return out;
    for (const lobby of this.dungeonLobbies.values()) {
      if (!lobby.advertised || lobby.members.has(client.sessionId) || lobby.members.size >= 4) continue;
      const g = this.state.gates.get(lobby.gateId);
      if (!g || !g.active || !this.canEnterGate(client, g)) continue;
      const distance = Math.hypot(g.x - p.x, g.z - p.z);
      if (distance > 120) continue;
      const leader = this.state.players.get(lobby.leader), preview = lobby.preview || gateEncounterPreview(g);
      const leaderToken = this.tokens.get(lobby.leader), leaderProfile = leaderToken && this.profiles.get(leaderToken);
      const leaderReadiness = gateReadinessForProfile(leaderProfile || {}, g.rank);
      const memberSignals = [...lobby.members].map(sid => {
        const member = this.state.players.get(sid);
        const token = this.tokens.get(sid);
        const profile = token && this.profiles.get(token);
        return { name: member && member.name || 'Hunter', ...gateProfileSignals(profile || {}, g.rank) };
      });
      const partyReadiness = gatePartyReadinessSummary(memberSignals, g.rank, preview);
      out.push({ gateId: g.id, rank: g.rank | 0, kind: g.kind || 'public', leaderName: leader && leader.name || 'Hunter', leaderRole: gateRoleForProfile(leaderProfile || {}), readiness: leaderReadiness.status, readinessScore: leaderReadiness.score, readinessTotal: leaderReadiness.total, partyStatus: partyReadiness.status, partyWarnings: partyReadiness.warnings.slice(0, 2), partyStrengths: partyReadiness.strengths.slice(0, 3), members: lobby.members.size, capacity: 4, distance: Math.round(distance), difficulty: ['Initiate','Dangerous','Severe','Extreme','Cataclysmic'][g.rank | 0], recommendedParty: preview.recommendedParty });
    }
    return out.sort((a, b) => a.distance - b.distance).slice(0, 12);
  }
  sendDungeonMatchmaking(client) { client.send('dungeonMatchmaking', { listings: this.dungeonMatchmakingPayload(client) }); }
  broadcastDungeonMatchmaking() { for (const client of this.clients) this.sendDungeonMatchmaking(client); }
  handleDungeonMatchmakingAdvertise(client, m) {
    let lobby = null;
    for (const value of this.dungeonLobbies.values()) if (value.members.has(client.sessionId)) { lobby = value; break; }
    if (!lobby || lobby.leader !== client.sessionId) return client.send('gateReject', { reason: 'leader' });
    lobby.advertised = !(m && m.active === false);
    this.sendDungeonLobby(lobby);
  }
  handleDungeonMatchmakingJoin(client, m) {
    const gateId = m && typeof m.gateId === 'string' ? m.gateId : '';
    const lobby = this.dungeonLobbies && this.dungeonLobbies.get(gateId), g = this.state.gates.get(gateId), p = this.state.players.get(client.sessionId);
    if (!lobby || !lobby.advertised || !g || !g.active) return client.send('gateReject', { reason: 'lobby' });
    if (!p || p.dgn || !this.canEnterGate(client, g)) return client.send('gateReject', { reason: 'locked' });
    if (Math.hypot(g.x - p.x, g.z - p.z) > 120) return client.send('gateReject', { reason: 'range' });
    if (lobby.members.size >= 4) return client.send('gateReject', { reason: 'full' });
    this.leaveDungeonLobby(client.sessionId, false);
    lobby.members.add(client.sessionId);
    lobby.ready.delete(client.sessionId);
    this.sendDungeonLobby(lobby);
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
    this.broadcastDungeonMatchmaking();
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
        this.broadcastDungeonMatchmaking();
        return;
      }
      if (lobby.leader === sid) lobby.leader = [...lobby.members][0] || '';
      this.sendDungeonLobby(lobby);
      return;
    }
  }
  gateEntryPayload(g, inst) {
    return {
      id: inst.id, seed: inst.seed, dungeonId: inst.dungeonId || canonicalDungeonId(inst.rank, inst.seed), rank: inst.rank, kind: inst.kind || (g && g.kind) || 'public',
      edits: inst.edits,
      bx: g ? g.x : inst.gateX, by: g ? g.y : inst.gateY, bz: g ? g.z : inst.gateZ,
      cleared: inst.cleared,
      shardPlus: inst.shardPlus || 0, shardName: inst.shardName || '', shardMods: inst.shardMods || '',
    };
  }
  // The dungeonLobbyStart signal a flag-on hunter receives: the overworld gate descriptor the
  // client passes straight to NETWORK.switchRoom('dungeon', ...). `mode:'room'` disambiguates it
  // from the bare legacy start (which is followed by an in-room enterDungeon instead). Field names
  // match DungeonRoom.gateFromOptions so the whole payload is forwarded as the room's join options.
  dungeonRoomEntryPayload(g, ticket, startInfo = null) {
    return {
      mode: 'room',
      gateId: g.id,
      ticket,
      startsAt: startInfo && startInfo.startsAt || 0,
      countdownMs: startInfo && startInfo.countdownMs || 0,
      finalSummary: startInfo && startInfo.finalSummary || null,
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
      let payer = gate.refundOwner === token ? prof : this.profiles.get(gate.refundOwner);
      if (!payer) {
        payer = sanitizeProfile(await this.store.loadPlayer(gate.refundOwner));
        this.profiles.set(gate.refundOwner, payer);
      }
      // Only report a refund the inventory actually accepted; a full inventory
      // would otherwise lose the key while the client is told it was returned.
      if (this.addRewardItem(payer, gate.refundItem | 0, 1) === 0) {
        refundedItem = gate.refundItem | 0;
        refundedTo = gate.refundOwner;
        this.dirtyPlayers.add(gate.refundOwner);
      }
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
    const members = [...lobby.members];
    const tokens = members.map(sid => this.tokens.get(sid)).filter(Boolean);
    if (tokens.length !== members.length) return this.disbandDungeonLobby(lobby.gateId, 'auth');
    const ticket = issueDungeonAdmission(g, tokens);
    const startInfo = { countdownMs: 3000, startsAt: Date.now() + 3000, finalSummary: this.dungeonLobbyFinalSummary(lobby) };
    this.dungeonLobbies.delete(lobby.gateId);
    // Legacy in-room instance is created lazily and only if a flag-off member actually needs it —
    // a fully flag-on party enters the dedicated DungeonRoom and leaves no instance in the overworld.
    for (const sid of members) {
      const c = this.clients.find(cl => cl.sessionId === sid);
      const p = this.state.players.get(sid);
      if (!c || !p || p.dgn || !this.canEnterGate(c, g) || Math.hypot(g.x - p.x, g.z - p.z) > 7) {
        if (c) c.send('dungeonLobbyClosed', { gateId: g.id, reason: 'range' });
        continue;
      }
      if (ticket) {
        // Flag-on: the ready hunter switches into the dedicated DungeonRoom for this gate.
        // filterBy(gateId) lands the whole ready party in one room; the overworld gate is
        // retired when that room disposes (dungeon-handoff consumeGate), not here.
        c.send('dungeonLobbyStart', this.dungeonRoomEntryPayload(g, ticket, startInfo));
      }
    }
  }
  maybeStartDungeonLobby(lobby) {
    if (!lobby || !lobby.members.size) return;
    for (const sid of lobby.members) if (!lobby.ready.has(sid)) return;
    this.startDungeonLobby(lobby);
  }
  warnFirstDGatePrep(client, lobby, rank) {
    if (!client || !lobby || (rank | 0) !== 1) return false;
    const rec = this.profileFor(client);
    if (!rec || !rec.prof || rec.prof.progressionFocus !== 'first_d_gate') return false;
    if (!lobby.prepWarned) lobby.prepWarned = new Set();
    if (lobby.prepWarned.has(client.sessionId)) return false;
    const readiness = gateReadinessForProfile(rec.prof, rank);
    if (readiness.ready) return false;
    lobby.prepWarned.add(client.sessionId);
    client.send('gatePrepWarning', {
      rank,
      status: readiness.status,
      score: readiness.score,
      total: readiness.total,
      missing: readiness.missing.map(check => ({ id: check.id, label: check.label, hint: check.hint })),
      next: readiness.next ? { id: readiness.next.id, label: readiness.next.label, hint: readiness.next.hint } : null,
    });
    return true;
  }
  enterGate(client, m) {
    const p = this.state.players.get(client.sessionId);
    const found = this.findGateForPlayer(client, m);
    const g = found.gate;
    if (!p || !g) return client.send('gateReject', { reason: found.reason || 'locked' });
    if (this.rateLimited(client, 'action', 5, 10)) return client.send('gateReject', { reason: 'rate' });
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
        advertised: false,
      };
      this.dungeonLobbies.set(g.id, lobby);
    }
    lobby.members.add(client.sessionId);
    this.warnFirstDGatePrep(client, lobby, g.rank | 0);
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
    if (!this.canEnterGate(client, g) || Math.hypot(g.x - p.x, g.z - p.z) > GATE_INTERACT_RANGE) {
      this.leaveDungeonLobby(client.sessionId, true);
      return client.send('gateReject', { reason: 'range' });
    }
    if (m && m.ready === false) {
      lobby.ready.delete(client.sessionId);
    } else {
      this.warnFirstDGatePrep(client, lobby, lobby.rank | 0);
      lobby.ready.add(client.sessionId);
      // Remember whether this hunter wants the dedicated DungeonRoom (flag on) so startDungeonLobby
      // routes them there instead of an overworld in-room instance. Per-member so a mixed party
      // during the opt-in phase degrades gracefully rather than forcing one path on everyone.
    }
    this.sendDungeonLobby(lobby);
    this.maybeStartDungeonLobby(lobby);
  }

  createInstance(g) {
    const d = D.generateDungeon(g.rank, g.seed, g.dungeonId);
    const inst = new DungeonInstance(d, g, this);
    inst.lootChestTotal = this.countGeneratedDungeonChests(d.world);
    inst.lootChestLocations = this.generatedDungeonChestLocations(d.world);
    this.instances[g.id] = inst;
    const plus = inst.shardPlus, modSet = inst.shardModSet;
    const combat = d.definition && d.definition.combat || {};
    const theme = d.definition && d.definition.theme || '';
    const visualFor = (kind, role, type) => {
      if (kind === 'skeleton') {
        if (theme === 'crypt') return 'drowned';
        if (theme === 'catacombs') return 'ossuary';
        if (theme === 'vault') return 'watcher';
        if (theme === 'blighted' || theme === 'overgrown') return 'blighted';
        return type === 'pit' ? 'ledge' : '';
      }
      if (theme === 'mine') return role === 'graveguard' ? 'mine_guard' : 'miner';
      if (theme === 'crypt') return 'drowned';
      if (theme === 'overgrown') return 'mossbound';
      if (theme === 'catacombs') return role === 'graveguard' ? 'ossuary_guard' : 'ossuary';
      if (theme === 'blighted') return 'blighted';
      if (theme === 'vault') return role === 'graveguard' ? 'vault_guard' : 'vault';
      return role || '';
    };
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
      if (!group) byRoom.set(key, group = { key, type: rm ? rm.type : 'guard', x: rm ? rm.x : s.x, z: rm ? rm.z : s.z, list: [] });
      group.list.push(s);
    }
    inst.configureRoomProgress(byRoom.values());
    for (const { type, list } of byRoom.values()) {
      list.forEach((s, i) => {
        // skeletons add ranged variety — now present from E-rank (was rank >= 1 only)
        let skelChance = Number.isFinite(combat.skeletonChance) ? combat.skeletonChance : (g.rank >= 1 ? .35 : .22);
        if (type === 'guard') skelChance = i === 1 ? Math.max(.72, skelChance) : Math.min(.18, skelChance);
        else if (type === 'pit') skelChance = .55;                // ledges favour ranged attackers
        else if (type === 'crypt') skelChance = .30;
        else if (type === 'arena') skelChance = Math.max(.40, skelChance);
        const kind = Math.random() < skelChance ? 'skeleton' : 'zombie';
        // vault / treasure rooms post a tougher elite standing guard over the loot
        const elite = (type === 'vault' || type === 'treasure' || (type === 'arena' && s.wave)) && i === 0;
        const id = this.addDungeonMob(g.id, s.x, s.z, kind, trashHp(kind, elite), trashDmg(elite), trashSpd(kind), d.world, g.rank);
        // The first Gate teaches the undead family in readable pairs: skeletons
        // hold range while alternating zombie roles pressure or punish greed.
        if (kind === 'zombie' && this.mobMeta[id]) {
          const roles = combat.zombieRoles || ['charger', 'graveguard'];
          const role = roles[i % roles.length];
          this.mobMeta[id].undeadRole = role;
          const mob = this.state.mobs.get(id);
          if (mob) mob.variant = visualFor(kind, role, type);
        }
        if (kind === 'skeleton') {
          const mob = this.state.mobs.get(id);
          if (mob) mob.variant = visualFor(kind, '', type);
        }
        if (elite) {
          if (this.mobMeta[id]) this.mobMeta[id].elite = true;
          const em = this.state.mobs.get(id);
          if (em) em.elite = true;   // synced so the client renders the elite model/tint
        }
      });
    }
    const bossId = this.addDungeonMob(g.id, d.bossRoom.x, d.bossRoom.z, 'boss',
      Math.round(50 * mul * bossHpMul),
      Math.max(1, Math.round((5 + g.rank * 2) * bossDmgMul)), 1.3, d.world, g.rank);
    if (this.mobMeta[bossId]) this.mobMeta[bossId].bossStyle = combat.bossStyle || '';
    const boss = this.state.mobs.get(bossId);
    if (boss) {
      boss.bossStyle = combat.bossStyle || '';
      boss.displayName = d.definition && d.definition.boss || '';
    }
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
    if (!inst) return;
    const clear = typeof inst.markRoomMobKilled === 'function' ? inst.markRoomMobKilled(x, z) : null;
    if (clear) {
      this.sendSpace(dgn, 'dungeonRoomCleared', clear);
      this.sendDungeonStatus(dgn);
    }
    if (!inst.hazMods || !inst.hazMods.size) return;
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
    if (inst.hazMods.has('Bolstering')) this.bolsterNearbyTrash(inst, x, z);
  }
  // Bolstering: a trash death emboldens every surviving trash within BOLSTER_RADIUS,
  // stacking up to BOLSTER_MAX_STACKS. The dying mob has already been removed from
  // state by finishMobKill, so it never bolsters itself; bosses and hazard entities
  // (orbs, ghosts) are excluded so only real trash grows.
  bolsterNearbyTrash(inst, x, z) {
    const plus = inst.shardPlus | 0;
    let bolstered = false;
    this.state.mobs.forEach((mm, id) => {
      if (mm.dgn !== inst.id || mm.kind === 'boss' || mm.kind === 'orb' || mm.kind === 'ghost') return;
      const meta = this.mobMeta[id];
      if (!meta || (meta.bolster | 0) >= BOLSTER_MAX_STACKS) return;
      if (Math.hypot(mm.x - x, mm.z - z) > BOLSTER_RADIUS) return;
      meta.bolster = (meta.bolster | 0) + 1;
      const hpBump = BOLSTER_HP + plus;
      mm.maxHp += hpBump; mm.hp += hpBump;
      meta.dmg += BOLSTER_DMG;
      meta.arrowDmg = (meta.arrowDmg | 0) + BOLSTER_DMG;
      bolstered = true;
    });
    if (bolstered) this.sendSpace(inst.id, 'fx', { t: 'bolster', x, z, dgn: inst.id });
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
    p.z = W.TOWN.TC + 14.5;
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
    const result = this.dungeonResultPayload(inst, 'failed', reason || 'wipe');
    for (const sid of [...inst.players]) {
      const client = this.clients.find(c => c.sessionId === sid);
      this.ejectFromDungeon(sid);
      const p = this.state.players.get(sid);
      if (client) client.send('dungeonFailed', {
        reason: reason || 'wipe',
        result,
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
  bossShardDrop(rank, shardPlus = 0) {
    if ((shardPlus | 0) > 0) return [];
    const ri = Math.max(0, Math.min(SHARD_ITEM_IDS.length - 1, rank | 0));
    return [{ id: SHARD_ITEM_IDS[ri], count: 1 }];
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
    const result = this.dungeonResultPayload(inst, 'cleared', '');
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
    baseLoot.items.push(...this.bossShardDrop(ri, plus));
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
        const mastery = this.dungeonMasteryResult(inst, c);
        c.send('gateCleared', { rank: ri, result: { ...result, mastery } });
        const progress = this.markGateCleared(c, ri);
        const items = baseLoot.items.map(it => ({ ...it }));
        const rewardProfile=this.profileFor(c),weapon=this.rollWeaponDropForSource('gate',ri,plus,rewardProfile&&rewardProfile.prof);if(weapon)items.push(weapon);
        const armor=this.rollArmorDropForSource('gate',ri,plus);if(armor)items.push(armor);
        const eggPool = DRAGON_DROP_POOL[ri] || [];
        if (eggPool.length && Math.random() < DRAGON_EGG_BOSS_CHANCE[ri]) {
          items.push({ id: DRAGON_EGG_OF(this.pickDragonEggForPlayer(c, eggPool)), count: 1 });
        }
        const firstClear = this.firstClearBonusItems(ri, progress);
        for (const b of firstClear) items.push(b);
        const masteryBonus = mastery && mastery.bonus;
        const loot = { ...baseLoot, items, progress: this.dungeonRewardProgress(ri, progress), result: { ...result, mastery }, mastery };
        if (masteryBonus) {
          loot.gold += masteryBonus.gold | 0;
          loot.iron += masteryBonus.iron | 0;
          loot.masteryBonus = masteryBonus;
        }
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
          mastery: this.dungeonMasteryResult(inst, c),
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
