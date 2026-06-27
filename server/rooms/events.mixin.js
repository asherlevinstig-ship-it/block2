// Server events (skyship, day cycle, parkour, king-of-the-hill, PvP bounty) and the
// guild hall. Lifted verbatim out of GameRoom.js and mixed into its prototype.
const {
  AEGIS_BOUNTY_MS, AEGIS_BOUNTY_RANGE, BETA_EVENT_TEST, DAY_MS, EVENT_ACTIVE_MS, EVENT_FIRST_DELAY_MS,
  EVENT_IDLE_JITTER_MS, EVENT_IDLE_MIN_MS, EVENT_KING, EVENT_PARKOUR, EVENT_QUEUE_MS, EVENT_REWARD_TOKENS,
  EVENT_TEST_QUEUE_MS, GUILD_DECOR_BLOCKS, GUILD_FLOOR_MAX, GUILD_HALL, I, KING_ACTIVE_MS, KING_ARENA_SIZE,
  KING_CROWN_PICKUP_RADIUS, KING_HIT_RANGE, KING_RESPAWN_MS, SKYSHIP_AWAY_MS, SKYSHIP_BOARD_GOLD,
  SKYSHIP_BOARD_RANK, SKYSHIP_CYCLE_MS, SKYSHIP_DOCK_MS, SKYSHIP_TRAVEL_MS, dayTimeAt, guildFloorPrice,
  skyshipSnapshot, sstep,
} = require('./constants');
const { State, Player, Mob, Team, Gate } = require('../schema');
const { TeamManager } = require('../teams');
const W = require('../world');
const D = require('../dungeon');
const AI = require('../ai');
const { createStore, sanitizeProfile, mergeClientSave, defaultProfile, cleanToken, sanitizeUtilityLoadout } = require('../store');

class EventsMixin {
  // Server-event and day-cycle state, co-located with the mixin that owns it.
  // Called once from onCreate. serverEvent is seeded via the mixin's own helpers.
  initEventsState() {
    this.eventSeq = 0;
    this.skyshipEpoch = Date.now();
    this.dayEpoch = Date.now() - .35 * DAY_MS;
    this.sleepingPlayers = new Set();
    this.serverEvent = this.createIdleEvent(Date.now() + EVENT_FIRST_DELAY_MS, this.pickNextServerEvent().kind);
    this.eventInstances = new Map();
    this.activeEventInstanceId = '';
    this.eventCourseBlocks = new Set();
    this.eventTransientEditKeys = new Set();
  }

  skyshipSyncPayload() {
    return {
      serverNow: Date.now(), epoch: this.skyshipEpoch,
      dockMs: SKYSHIP_DOCK_MS, travelMs: SKYSHIP_TRAVEL_MS,
      awayMs: SKYSHIP_AWAY_MS, cycleMs: SKYSHIP_CYCLE_MS,
    };
  }

  sendSkyshipSync(client) {
    if (client && typeof client.send === 'function') client.send('skyshipSync', this.skyshipSyncPayload());
  }

  broadcastSkyshipSync() {
    this.broadcast('skyshipSync', this.skyshipSyncPayload());
  }

  dayCycleSyncPayload() {
    return { serverNow: Date.now(), epoch: this.dayEpoch, dayMs: DAY_MS };
  }

  sendDayCycleSync(client) {
    if (client && typeof client.send === 'function') client.send('dayCycleSync', this.dayCycleSyncPayload());
  }

  broadcastDayCycleSync() {
    this.broadcast('dayCycleSync', this.dayCycleSyncPayload());
  }

  handleSleep(client, m) {
    const p = this.state.players.get(client.sessionId);
    if (!p || p.dgn || !m) return client.send('sleepReject', { reason: 'invalid' });
    const x = Math.floor(+m.x), y = Math.floor(+m.y), z = Math.floor(+m.z);
    if (Math.hypot(p.x - (x + .5), p.z - (z + .5)) > 4 || Math.abs(p.y - (y + 1)) > 4 || this.world.getB(x, y, z) !== W.B.BED)
      return client.send('sleepReject', { reason: 'bed' });
    const time = dayTimeAt(this.dayEpoch, Date.now());
    const th = time * Math.PI * 2, sy = -Math.cos(th);
    const dayF = sstep(-.12, .20, sy / Math.hypot(Math.sin(th), sy, .22));
    if (dayF > .35) return client.send('sleepReject', { reason: 'day' });
    this.sleepingPlayers.add(client.sessionId);
    const surfaceIds = [];
    this.state.players.forEach((sp, sid) => { if (!sp.dgn) surfaceIds.push(sid); });
    const ready = surfaceIds.length > 0 && surfaceIds.every(sid => this.sleepingPlayers.has(sid));
    if (!ready) return client.send('sleepWait', { sleeping: this.sleepingPlayers.size, needed: surfaceIds.length });
    this.dayEpoch = Date.now() - .30 * DAY_MS;
    this.state.tod = .30;
    this.sleepingPlayers.clear();
    this.broadcastDayCycleSync();
    for (const c of this.clients) c.send('sleepComplete', { tod: .30 });
  }

  handleSkyshipBoard(client) {
    const p = this.state.players.get(client.sessionId);
    const rec = this.profileFor(client);
    if (!p || !rec || p.dgn) return client.send('skyshipBoardReject', { reason: 'invalid' });
    const cx = W.TOWN.TC - 32, cz = W.TOWN.TC, top = W.TOWN.G + 24;
    const inGangway = p.x >= cx - 15.5 && p.x <= cx - 6.5
      && Math.abs(p.z - cz) <= 3.25 && p.y >= top + .25 && p.y <= top + 4;
    if (!inGangway) return client.send('skyshipBoardReject', { reason: 'range' });
    const ship = skyshipSnapshot(this.skyshipEpoch || Date.now(), Date.now());
    if (ship.state !== 'docked') return client.send('skyshipBoardReject', { reason: 'away' });
    const rank = this.playerHunterRankIndexForProfile(rec.prof);
    if (rank < SKYSHIP_BOARD_RANK)
      return client.send('skyshipBoardReject', { reason: 'rank', requiredRank: 'S', rank });
    const availableGold = Math.max(0, rec.prof.gold | 0);
    if (availableGold < SKYSHIP_BOARD_GOLD)
      return client.send('skyshipBoardReject', { reason: 'gold', requiredGold: SKYSHIP_BOARD_GOLD, gold: availableGold });
    // Gold is an access requirement, not a fare: boarding does not spend it.
    client.send('skyshipBoardResult', { ok: true, route: 'western', gold: availableGold, rank });
  }
  randomEventDelay() {
    return EVENT_IDLE_MIN_MS + Math.floor(Math.random() * EVENT_IDLE_JITTER_MS);
  }
  pickNextServerEvent() {
    return Math.random() < 0.5 ? EVENT_PARKOUR : EVENT_KING;
  }
  createIdleEvent(nextAt, forcedKind) {
    const def = forcedKind === EVENT_KING.kind ? EVENT_KING : EVENT_PARKOUR;
    return {
      kind: def.kind,
      name: def.name,
      phase: 'idle',
      id: '',
      instanceId: '',
      nextAt: nextAt || (Date.now() + this.randomEventDelay()),
      startsAt: 0,
      endsAt: 0,
      queue: new Set(),
      participants: new Map(),
      completed: new Set(),
      course: null,
      lastSync: 0,
    };
  }
  createParkourInstance(now, startsAt) {
    const seed = (Math.random() * 1000000) | 0;
    const course = this.generateParkourCourse(seed);
    return {
      id: 'event-' + (++this.eventSeq),
      kind: EVENT_PARKOUR.kind,
      name: EVENT_PARKOUR.name,
      phase: 'queue',
      createdAt: now,
      startsAt,
      endsAt: 0,
      queue: new Set(),
      participants: new Map(),
      completed: new Set(),
      leaderboard: [],
      course,
      cleanupAt: 0,
    };
  }
  createKingInstance(now, startsAt) {
    return {
      id: 'event-' + (++this.eventSeq),
      kind: EVENT_KING.kind,
      name: EVENT_KING.name,
      phase: 'queue',
      createdAt: now,
      startsAt,
      endsAt: 0,
      queue: new Set(),
      participants: new Map(),
      completed: new Set(),
      leaderboard: [],
      arena: {
        x: EVENT_KING.x,
        z: EVENT_KING.z,
        size: EVENT_KING.size,
        minX: EVENT_KING.x - EVENT_KING.size / 2,
        maxX: EVENT_KING.x + EVENT_KING.size / 2,
        minZ: EVENT_KING.z - EVENT_KING.size / 2,
        maxZ: EVENT_KING.z + EVENT_KING.size / 2,
      },
      crown: { holderSid: '', holderTeamId: '', x: EVENT_KING.x + .5, y: W.TOWN.G + 2, z: EVENT_KING.z + .5, since: 0 },
      scores: new Map(),
      lastScoreAt: 0,
      cleanupAt: 0,
    };
  }
  currentEventInstance() {
    if (!this.eventInstances) this.eventInstances = new Map();
    const id = this.activeEventInstanceId || (this.serverEvent && this.serverEvent.instanceId) || '';
    return id ? this.eventInstances.get(id) || null : null;
  }
  setServerEventFromInstance(inst) {
    if (!inst) return;
    this.serverEvent = inst;
    this.activeEventInstanceId = inst.id;
  }
  eventLeaderboardPayload(inst) {
    if (inst && inst.kind === EVENT_KING.kind) {
      return [...(inst.scores || new Map()).values()]
        .sort((a, b) => (b.ms - a.ms) || String(a.name).localeCompare(String(b.name)))
        .slice(0, 5)
        .map(row => ({
          name: row.name || 'Hunters',
          ms: row.ms | 0,
          holder: !!(inst.crown && inst.crown.holderTeamId === row.teamId),
        }));
    }
    return (inst && inst.leaderboard || []).slice(0, 5).map(row => ({
      name: row.name || 'Hunter',
      ms: row.ms | 0,
      resets: row.resets | 0,
    }));
  }
  eventPayload(client) {
    const ev = this.currentEventInstance() || this.serverEvent || this.createIdleEvent(Date.now() + EVENT_FIRST_DELAY_MS);
    const sid = client && client.sessionId;
    const participating = !!(sid && ev.participants && ev.participants.has(sid));
    const coursePayload = ev.course && (ev.phase === 'active' || participating) ? {
      seed: ev.course.seed,
      start: ev.course.start,
      finish: ev.course.finish,
      fallY: ev.course.fallY,
      blocks: ev.course.blocks,
    } : null;
    return {
      kind: ev.kind,
      name: ev.name,
      phase: ev.phase,
      id: ev.id,
      nextAt: ev.nextAt || 0,
      startsAt: ev.startsAt || 0,
      endsAt: ev.endsAt || 0,
      queueSize: ev.queue ? ev.queue.size : 0,
      joined: !!(sid && ev.queue && ev.queue.has(sid)),
      participating,
      completed: !!(sid && ev.completed && ev.completed.has(sid)),
      course: coursePayload,
      arena: ev.arena || null,
      crown: ev.crown ? {
        holderSid: ev.crown.holderSid || '',
        holderTeamId: ev.crown.holderTeamId || '',
        holderName: this.playerName(ev.crown.holderSid),
        x: ev.crown.x || 0,
        y: ev.crown.y || 0,
        z: ev.crown.z || 0,
      } : null,
      leaderboard: this.eventLeaderboardPayload(ev),
      reward: EVENT_REWARD_TOKENS,
    };
  }
  sendEventStatus(client) {
    if (client) client.send('eventStatus', this.eventPayload(client));
  }
  broadcastEventStatus(force) {
    const ev = this.currentEventInstance() || this.serverEvent;
    if (!ev) return;
    const now = Date.now();
    if (!force && now - (ev.lastSync || 0) < 1000) return;
    ev.lastSync = now;
    for (const c of this.clients) this.sendEventStatus(c);
  }
  handleEventJoin(client) {
    const ev = this.currentEventInstance() || this.serverEvent;
    const p = this.state.players.get(client.sessionId);
    if (!ev || !p) return;
    if (ev.phase !== 'queue') {
      this.sendEventStatus(client);
      return client.send('eventReject', { reason: ev.phase === 'active' ? 'active' : 'closed' });
    }
    if (p.dgn) return client.send('eventReject', { reason: 'dungeon' });
    ev.queue.add(client.sessionId);
    client.send('eventJoined', this.eventPayload(client));
    this.broadcastEventStatus(true);
  }
  handleEventLeave(client) {
    const ev = this.currentEventInstance() || this.serverEvent;
    if (!ev) return;
    if (ev.phase === 'queue' && ev.queue.delete(client.sessionId)) {
      client.send('eventLeft', this.eventPayload(client));
      this.broadcastEventStatus(true);
    }
  }
  handleEventDebugStart(client) {
    if (!BETA_EVENT_TEST) return client.send('eventReject', { reason: 'closed' });
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    if (p.dgn) return client.send('eventReject', { reason: 'dungeon' });
    const now = Date.now();
    let ev = this.currentEventInstance() || this.serverEvent;
    if (!ev || ev.phase === 'idle') ev = this.announceServerEvent(now, ev && ev.kind);
    if (ev.phase !== 'queue') {
      this.sendEventStatus(client);
      return client.send('eventReject', { reason: ev.phase === 'active' ? 'active' : 'closed' });
    }
    ev.queue.add(client.sessionId);
    ev.startsAt = Math.min(ev.startsAt || (now + EVENT_TEST_QUEUE_MS), now + EVENT_TEST_QUEUE_MS);
    client.send('eventJoined', this.eventPayload(client));
    this.broadcast('chat', { name: '[Event]', text: 'Beta test ' + ev.name + ' queue starts in a few seconds.' });
    this.broadcastEventStatus(true);
  }
  handleDevEvent(client, text) {
    if (!BETA_EVENT_TEST) return client.send('eventReject', { reason: 'closed' });
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    if (p.dgn) return client.send('eventReject', { reason: 'dungeon' });
    const arg = String(text || '').split(/\s+/)[1] || '';
    const kind = arg.toLowerCase();
    const forcedKind = kind === 'king' || kind === 'koth' ? EVENT_KING.kind
      : kind === 'parkour' ? EVENT_PARKOUR.kind
      : '';
    if (!forcedKind) return client.send('chat', { name: '[Event]', text: 'use /event king or /event parkour' });
    const cur = this.currentEventInstance() || this.serverEvent;
    if (cur && cur.phase === 'active') return client.send('eventReject', { reason: 'active' });
    if (cur && cur.phase === 'queue') {
      cur.phase = 'ended';
      cur.cleanupAt = Date.now() + 60000;
    }
    this.activeEventInstanceId = '';
    const now = Date.now();
    const ev = this.announceServerEvent(now, forcedKind);
    ev.startsAt = now + EVENT_TEST_QUEUE_MS;
    ev.queue.add(client.sessionId);
    client.send('eventJoined', this.eventPayload(client));
    this.broadcast('chat', { name: '[Event]', text: 'Beta test ' + ev.name + ' starts in a few seconds.' });
    this.broadcastEventStatus(true);
  }
  clearEventCourse() {
    if (!this.eventCourseBlocks) this.eventCourseBlocks = new Set();
    for (const key of this.eventCourseBlocks) {
      const [x, y, z] = key.split(',').map(Number);
      if (!W.inWorld(x, y, z)) continue;
      this.world.setB(x, y, z, W.B.AIR);
      this.state.edits.set(key, W.B.AIR);
      this.dirtyWorld = true;
      if (!this.eventTransientEditKeys) this.eventTransientEditKeys = new Set();
      this.eventTransientEditKeys.add(key);
    }
    this.eventCourseBlocks.clear();
  }
  setEventBlock(x, y, z, id) {
    if (!W.inWorld(x, y, z)) return;
    const key = x + ',' + y + ',' + z;
    this.world.setB(x, y, z, id);
    this.state.edits.set(key, id);
    this.dirtyWorld = true;
    this.eventCourseBlocks.add(key);
    if (!this.eventTransientEditKeys) this.eventTransientEditKeys = new Set();
    this.eventTransientEditKeys.add(key);
  }
  eventPlatform(cx, y, cz, rx, rz, id) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      for (let z = cz - rz; z <= cz + rz; z++) this.setEventBlock(x, y, z, id);
    }
  }
  generateParkourCourse(seed) {
    const blocks = [];
    const addBlock = (x, y, z, id) => {
      if (W.inWorld(x, y, z)) blocks.push(x + ',' + y + ',' + z + ',' + id);
    };
    const platform = (cx, y, cz, rx, rz, id) => {
      for (let x = cx - rx; x <= cx + rx; x++) {
        for (let z = cz - rz; z <= cz + rz; z++) addBlock(x, y, z, id);
      }
    };
    const sx = EVENT_PARKOUR.x | 0, sy = EVENT_PARKOUR.y | 0, sz = EVENT_PARKOUR.z | 0;
    let x = sx, y = sy, z = sz;
    platform(x, y, z, 2, 2, W.B.PLANKS);
    for (let i = 0; i < 14; i++) {
      const side = (seed + i * 17) % 3 - 1;
      x += 4 + (i % 3 === 0 ? 1 : 0);
      z += side * (2 + (i % 2));
      y += (i % 4 === 2) ? 1 : (i % 5 === 4 ? -1 : 0);
      const mat = i % 5 === 0 ? W.B.GLASS : i % 3 === 0 ? W.B.BRICK : W.B.COBBLE;
      platform(x, y, z, i % 4 === 0 ? 1 : 0, i % 4 === 0 ? 1 : 0, mat);
      if (i % 4 === 1) addBlock(x, y + 1, z, W.B.TORCH);
    }
    x += 5;
    platform(x, y, z, 3, 2, W.B.CONCRETE);
    addBlock(x, y + 1, z - 2, W.B.TORCH);
    addBlock(x, y + 1, z + 2, W.B.TORCH);
    return {
      seed,
      start: { x: sx + .5, y: sy + 1.05, z: sz + .5 },
      finish: { x: x + .5, y: y + 1.05, z: z + .5 },
      fallY: sy - 12,
      minX: Math.min(sx, x) - 8,
      maxX: Math.max(sx, x) + 8,
      minZ: Math.min(sz, z) - 10,
      maxZ: Math.max(sz, z) + 10,
      blocks,
    };
  }
  buildParkourCourse(course) {
    if (!course) return;
    this.clearEventCourse();
    this.eventCourseBlocks = new Set();
    for (const key of course.blocks) {
      const [x, y, z, id] = key.split(',').map(Number);
      this.setEventBlock(x, y, z, id);
    }
  }
  announceParkourEvent(now) {
    const ev = this.createParkourInstance(now, now + EVENT_QUEUE_MS);
    this.eventInstances.set(ev.id, ev);
    this.setServerEventFromInstance(ev);
    this.broadcast('chat', { name: '[Event]', text: 'Parkour event opened. Join the queue for a chance at 2 Legendary Weapon Tokens.' });
    this.broadcastEventStatus(true);
    return ev;
  }
  announceKingEvent(now) {
    const ev = this.createKingInstance(now, now + EVENT_QUEUE_MS);
    this.eventInstances.set(ev.id, ev);
    this.setServerEventFromInstance(ev);
    this.broadcast('chat', { name: '[Event]', text: 'King of the Hill opened. Sign up to fight for the crown.' });
    this.broadcastEventStatus(true);
    return ev;
  }
  announceServerEvent(now, forcedKind) {
    return forcedKind === EVENT_KING.kind ? this.announceKingEvent(now) : this.announceParkourEvent(now);
  }
  eventReturnPos(p) {
    if (!p) return { x: W.TOWN.TC + .5, y: W.TOWN.G + 2, z: W.TOWN.TC + 7.5 };
    return { x: p.x, y: p.y, z: p.z };
  }
  teleportEventPlayer(client, pos, reason, evArg) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !pos) return;
    const ev = evArg || this.currentEventInstance() || this.serverEvent;
    const inEvent = ev && ev.phase === 'active' && reason !== 'complete' && reason !== 'failed';
    p.dgn = inEvent ? ev.id : '';
    p.dim = inEvent ? 'event' : 'overworld';
    p.x = pos.x; p.y = pos.y; p.z = pos.z;
    client.send('eventTeleport', { x: pos.x, y: pos.y, z: pos.z, reason: reason || 'event', eventId: inEvent ? ev.id : '', course: inEvent ? ev.course : null });
  }
  startParkourEvent(now) {
    const ev = this.currentEventInstance() || this.serverEvent;
    if (!ev || ev.phase !== 'queue') return;
    ev.phase = 'active';
    ev.endsAt = now + EVENT_ACTIVE_MS;
    for (const sid of ev.queue) {
      const client = this.clients.find(c => c.sessionId === sid);
      const p = this.state.players.get(sid);
      if (!client || !p || p.dgn) continue;
      ev.participants.set(sid, { returnPos: this.eventReturnPos(p), resets: 0, startedAt: now, finishedAt: 0 });
      this.teleportEventPlayer(client, ev.course.start, 'start', ev);
      client.send('eventStarted', this.eventPayload(client));
    }
    this.broadcast('chat', { name: '[Event]', text: 'Parkour has begun. Reach the finish before the timer ends.' });
    this.broadcastEventStatus(true);
  }
  completeParkourPlayer(client) {
    const ev = this.currentEventInstance() || this.serverEvent;
    if (!ev || ev.phase !== 'active' || ev.completed.has(client.sessionId)) return;
    const part = ev.participants.get(client.sessionId);
    if (!part) return;
    const p = this.state.players.get(client.sessionId);
    const now = Date.now();
    part.finishedAt = now;
    const ms = Math.max(0, now - (part.startedAt || ev.startsAt || now));
    ev.completed.add(client.sessionId);
    ev.leaderboard.push({ sid: client.sessionId, name: p && p.name || 'Hunter', ms, resets: part.resets | 0 });
    ev.leaderboard.sort((a, b) => (a.ms - b.ms) || (a.resets - b.resets));
    this.awardGrant(client, { source: 'event', event: EVENT_PARKOUR.name, items: [{ id: I.LEGEND_TOKEN, count: EVENT_REWARD_TOKENS }] });
    this.recordEventProgress(client);
    this.unlockUtility(client, 'feather_step', 'Parkour finish unlocked');
    client.send('eventComplete', this.eventPayload(client));
    this.teleportEventPlayer(client, part.returnPos, 'complete', ev);
    this.broadcastEventStatus(true);
  }
  endParkourEvent(reason) {
    const ev = this.currentEventInstance() || this.serverEvent;
    if (!ev || ev.phase === 'idle') return;
    ev.phase = 'ended';
    ev.cleanupAt = Date.now() + 60000;
    for (const [sid, part] of ev.participants) {
      if (ev.completed.has(sid)) continue;
      const client = this.clients.find(c => c.sessionId === sid);
      if (client) {
        client.send('eventFailed', { reason: reason || 'timeout', name: ev.name, id: ev.id, leaderboard: this.eventLeaderboardPayload(ev) });
        this.teleportEventPlayer(client, part.returnPos, 'failed', ev);
      }
    }
    this.broadcast('chat', { name: '[Event]', text: 'Parkour event ended.' });
    this.activeEventInstanceId = '';
    this.serverEvent = this.createIdleEvent(Date.now() + this.randomEventDelay(), this.pickNextServerEvent().kind);
    this.broadcastEventStatus(true);
  }
  eventTeamIdForSid(sid) {
    const p = this.state.players.get(sid);
    return p && p.team ? p.team : 'solo:' + sid;
  }
  eventTeamNameForSid(sid) {
    const p = this.state.players.get(sid);
    if (!p) return 'Hunter';
    if (p.team) {
      const t = this.state.teams.get(p.team);
      return t && t.name ? t.name : p.team;
    }
    return p.name || 'Solo Hunter';
  }
  playerName(sid) {
    const p = sid && this.state.players.get(sid);
    return p && p.name || '';
  }
  ensureKingScore(ev, teamId, name) {
    if (!ev || !teamId) return null;
    let row = ev.scores.get(teamId);
    if (!row) {
      row = { teamId, name: name || teamId, ms: 0 };
      ev.scores.set(teamId, row);
    } else if (name) row.name = name;
    return row;
  }
  kingSpawnPos(ev, sid) {
    const a = ev && ev.arena || { x: EVENT_KING.x, z: EVENT_KING.z, minX: EVENT_KING.x - 200, maxX: EVENT_KING.x + 200, minZ: EVENT_KING.z - 200, maxZ: EVENT_KING.z + 200 };
    const i = Math.max(0, [...(ev.participants || new Map()).keys()].indexOf(sid));
    const ang = (i / Math.max(1, ev.participants.size || 1)) * Math.PI * 2 + Math.random() * .25;
    const r = Math.min(150, (a.size || KING_ARENA_SIZE) * .38);
    const x = Math.max(a.minX + 6, Math.min(a.maxX - 6, a.x + Math.cos(ang) * r));
    const z = Math.max(a.minZ + 6, Math.min(a.maxZ - 6, a.z + Math.sin(ang) * r));
    const y = this.world.standHeight(x, z, W.WH - 2) + 1.05;
    return { x, y: y > 1 ? y : W.TOWN.G + 2, z };
  }
  teleportKingPlayer(client, pos, reason, evArg) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !pos) return;
    p.dim = 'overworld';
    p.dgn = '';
    p.x = pos.x; p.y = pos.y; p.z = pos.z;
    client.send('eventTeleport', { kind: EVENT_KING.kind, x: pos.x, y: pos.y, z: pos.z, reason: reason || 'king', eventId: evArg && evArg.id || '' });
  }
  startKingEvent(now) {
    const ev = this.currentEventInstance() || this.serverEvent;
    if (!ev || ev.phase !== 'queue') return;
    ev.phase = 'active';
    ev.endsAt = now + KING_ACTIVE_MS;
    ev.lastScoreAt = now;
    for (const sid of ev.queue) {
      const client = this.clients.find(c => c.sessionId === sid);
      const p = this.state.players.get(sid);
      if (!client || !p || p.dgn) continue;
      const teamId = this.eventTeamIdForSid(sid);
      const teamName = this.eventTeamNameForSid(sid);
      ev.participants.set(sid, { returnPos: this.eventReturnPos(p), teamId, teamName, respawnAt: 0 });
      this.ensureKingScore(ev, teamId, teamName);
    }
    if (ev.participants.size <= 0) return this.endKingEvent('empty');
    for (const sid of ev.participants.keys()) {
      const client = this.clients.find(c => c.sessionId === sid);
      if (client) {
        this.teleportKingPlayer(client, this.kingSpawnPos(ev, sid), 'start', ev);
        client.send('eventStarted', this.eventPayload(client));
      }
    }
    const firstSid = [...ev.participants.keys()][(Math.random() * ev.participants.size) | 0];
    this.setKingCrownHolder(ev, firstSid, 'start');
    this.broadcast('chat', { name: '[Event]', text: 'King of the Hill has begun. Hold the crown for the longest time.' });
    this.broadcastEventStatus(true);
  }
  setKingCrownHolder(ev, sid, reason) {
    if (!ev || ev.kind !== EVENT_KING.kind) return;
    const part = ev.participants.get(sid);
    const p = this.state.players.get(sid);
    if (!part || !p) return;
    ev.crown.holderSid = sid;
    ev.crown.holderTeamId = part.teamId;
    ev.crown.x = p.x; ev.crown.y = p.y + 1.9; ev.crown.z = p.z;
    ev.crown.since = Date.now();
    this.ensureKingScore(ev, part.teamId, part.teamName);
    this.broadcast('eventCrown', { holderSid: sid, holderName: p.name, teamId: part.teamId, teamName: part.teamName, reason: reason || 'claim' });
    this.broadcastEventStatus(true);
  }
  clearKingCrown(ev, x, y, z) {
    if (!ev || ev.kind !== EVENT_KING.kind) return;
    ev.crown.holderSid = '';
    ev.crown.holderTeamId = '';
    ev.crown.x = x || ev.arena.x;
    ev.crown.y = y || W.TOWN.G + 2;
    ev.crown.z = z || ev.arena.z;
    ev.crown.since = Date.now();
    this.broadcastEventStatus(true);
  }
  isKingParticipant(sid) {
    const ev = this.currentEventInstance() || this.serverEvent;
    return !!(ev && ev.kind === EVENT_KING.kind && ev.phase === 'active' && ev.participants && ev.participants.has(sid));
  }
  handleEventHit(client, m) {
    const ev = this.currentEventInstance() || this.serverEvent;
    if (!ev || ev.kind !== EVENT_KING.kind || ev.phase !== 'active' || !m) return;
    const attackerSid = client.sessionId;
    const targetSid = String(m.sid || '');
    if (!ev.participants.has(attackerSid) || !ev.participants.has(targetSid) || attackerSid === targetSid) return;
    const attacker = this.state.players.get(attackerSid);
    const target = this.state.players.get(targetSid);
    if (!attacker || !target || target.dgn || attacker.dgn) return;
    const aPart = ev.participants.get(attackerSid), tPart = ev.participants.get(targetSid);
    if (aPart.teamId === tPart.teamId) return;
    if (Math.hypot(attacker.x - target.x, attacker.z - target.z) > KING_HIT_RANGE) return;
    if (!this.pointInKingArena(ev, attacker.x, attacker.z) || !this.pointInKingArena(ev, target.x, target.z)) return;
    const now = Date.now();
    if (now < (aPart.nextHitAt || 0)) return;
    aPart.nextHitAt = now + 450;
    this.playerLastHit.set(targetSid, { attackerSid, at: now });
    this.hurtPlayer(this.clients.find(c => c.sessionId === targetSid), Math.max(4, Math.round(this.serverDamageFor(attacker, attackerSid) * .75)));
  }
  pointInKingArena(ev, x, z) {
    const a = ev && ev.arena;
    return !!a && x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ;
  }
  validAegisBountyTargets(client) {
    const hunter = this.state.players.get(client.sessionId);
    if (!hunter) return [];
    const out = [];
    const hunterTeam = hunter.team || '';
    for (const c of this.clients || []) {
      if (!c || c.sessionId === client.sessionId) continue;
      const p = this.state.players.get(c.sessionId);
      if (!p || p.dgn || this.isKingParticipant(c.sessionId)) continue;
      if (hunterTeam && p.team && hunterTeam === p.team) continue;
      out.push({ client: c, player: p });
    }
    return out;
  }
  handleRequestAegisBounty(client) {
    const p = this.state.players.get(client.sessionId);
    if (!p || p.dgn || this.isKingParticipant(client.sessionId)) return client.send('pvpBountyReject', { reason: 'invalid' });
    const targets = this.validAegisBountyTargets(client);
    if (!targets.length) return client.send('pvpBountyReject', { reason: 'target' });
    const pick = targets[(Math.random() * targets.length) | 0];
    const expiresAt = Date.now() + AEGIS_BOUNTY_MS;
    this.aegisBounties.set(client.sessionId, {
      targetSid: pick.client.sessionId,
      targetName: pick.player.name || 'Hunter',
      expiresAt,
      nextHitAt: 0,
    });
    client.send('pvpBountyAssigned', { targetSid: pick.client.sessionId, targetName: pick.player.name || 'Hunter', expiresAt });
  }
  handlePvpBountyHit(client, m) {
    const bounty = this.aegisBounties && this.aegisBounties.get(client.sessionId);
    if (!bounty) return client.send('pvpBountyReject', { reason: 'none' });
    const now = Date.now();
    if (now > bounty.expiresAt) {
      this.aegisBounties.delete(client.sessionId);
      return client.send('pvpBountyFail', { reason: 'time' });
    }
    const targetSid = String(m && m.sid || '');
    if (targetSid !== bounty.targetSid) return client.send('pvpBountyReject', { reason: 'target' });
    const attacker = this.state.players.get(client.sessionId);
    const target = this.state.players.get(targetSid);
    const targetClient = this.clients.find(c => c.sessionId === targetSid);
    if (!attacker || !target || !targetClient || attacker.dgn || target.dgn || this.isKingParticipant(client.sessionId) || this.isKingParticipant(targetSid)) return client.send('pvpBountyReject', { reason: 'invalid' });
    if (this.isTownProtected(attacker.x, attacker.z) || this.isTownProtected(target.x, target.z)) return client.send('pvpBountyReject', { reason: 'town' });
    if (Math.hypot(attacker.x - target.x, attacker.z - target.z) > AEGIS_BOUNTY_RANGE) return client.send('pvpBountyReject', { reason: 'range' });
    const solid = this.spaceSolid('');
    // reject a strike thrown from inside terrain — a client that noclipped its body into a wall to line up the hit
    if (solid(Math.floor(attacker.x), Math.floor(attacker.y + 0.9), Math.floor(attacker.z)) ||
        solid(Math.floor(attacker.x), Math.floor(attacker.y + 1.5), Math.floor(attacker.z))) return client.send('pvpBountyReject', { reason: 'noclip' });
    // require line of sight, matching melee against mobs — a wall between hunters blocks the strike
    if (!AI.losClear(solid, attacker.x, attacker.y + 1.2, attacker.z, target.x, target.y + 1.2, target.z)) return client.send('pvpBountyReject', { reason: 'sight' });
    if (now < (bounty.nextHitAt || 0)) return;
    bounty.nextHitAt = now + 450;
    this.playerLastHit.set(targetSid, { attackerSid: client.sessionId, at: now, kind: 'aegis_bounty' });
    this.hurtPlayer(targetClient, Math.max(4, Math.round(this.serverDamageFor(attacker, client.sessionId) * .9)));
  }
  handleAegisBountyPlayerDeath(client, p) {
    if (!this.aegisBounties || !this.playerLastHit) return;
    const hit = this.playerLastHit.get(client.sessionId);
    const killerSid = hit && hit.kind === 'aegis_bounty' && Date.now() - hit.at < 8000 ? hit.attackerSid : '';
    if (!killerSid) return;
    const bounty = this.aegisBounties.get(killerSid);
    if (!bounty || bounty.targetSid !== client.sessionId) return;
    const killer = this.clients.find(c => c.sessionId === killerSid);
    this.aegisBounties.delete(killerSid);
    if (killer) {
      const rec = this.profileFor(killer);
      if (rec) { rec.prof.aegisTrialReady = true; this.dirtyPlayers.add(rec.token); }
      killer.send('pvpBountyComplete', { targetSid: client.sessionId, targetName: p.name || bounty.targetName || 'Hunter' });
    }
    client.send('pvpBountySlain', { hunterSid: killerSid });
  }
  handleKingPlayerDeath(client, p, hp) {
    const ev = this.currentEventInstance() || this.serverEvent;
    if (!ev || ev.kind !== EVENT_KING.kind || ev.phase !== 'active' || !ev.participants.has(client.sessionId)) return false;
    const sid = client.sessionId;
    const hit = this.playerLastHit && this.playerLastHit.get(sid);
    const killerSid = hit && Date.now() - hit.at < 8000 ? hit.attackerSid : '';
    if (ev.crown.holderSid === sid) {
      const killerPart = killerSid && ev.participants.get(killerSid);
      const deadPart = ev.participants.get(sid);
      if (killerPart && deadPart && killerPart.teamId !== deadPart.teamId) this.setKingCrownHolder(ev, killerSid, 'kill');
      else this.clearKingCrown(ev, p.x, p.y + 1.2, p.z);
    }
    this.playerLastHit.delete(sid);
    hp.hp = hp.max;
    const part = ev.participants.get(sid);
    if (part) part.respawnAt = Date.now() + KING_RESPAWN_MS;
    this.teleportKingPlayer(client, this.kingSpawnPos(ev, sid), 'respawn', ev);
    client.send('hurt', { n: -hp.max });
    return true;
  }
  tickKingEvent(ev, now) {
    const dt = Math.max(0, Math.min(2000, now - (ev.lastScoreAt || now)));
    ev.lastScoreAt = now;
    if (ev.crown && ev.crown.holderSid && ev.participants.has(ev.crown.holderSid)) {
      const p = this.state.players.get(ev.crown.holderSid);
      if (p) {
        ev.crown.x = p.x; ev.crown.y = p.y + 1.9; ev.crown.z = p.z;
      }
      const row = this.ensureKingScore(ev, ev.crown.holderTeamId, null);
      if (row) row.ms += dt;
    }
    for (const [sid, part] of ev.participants) {
      const client = this.clients.find(c => c.sessionId === sid);
      const p = this.state.players.get(sid);
      if (!client || !p) continue;
      if (part.respawnAt && now < part.respawnAt) continue;
      if (!this.pointInKingArena(ev, p.x, p.z)) this.teleportKingPlayer(client, this.kingSpawnPos(ev, sid), 'arena', ev);
      if (!ev.crown.holderSid && Math.hypot(p.x - ev.crown.x, p.z - ev.crown.z) <= KING_CROWN_PICKUP_RADIUS) {
        this.setKingCrownHolder(ev, sid, 'pickup');
      }
    }
  }
  endKingEvent(reason) {
    const ev = this.currentEventInstance() || this.serverEvent;
    if (!ev || ev.kind !== EVENT_KING.kind || ev.phase === 'idle') return;
    this.tickKingEvent(ev, Date.now());
    ev.phase = 'ended';
    ev.cleanupAt = Date.now() + 60000;
    const winners = [...ev.scores.values()].sort((a, b) => {
      const byScore = b.ms - a.ms;
      if (byScore) return byScore;
      if (ev.crown.holderTeamId === a.teamId) return -1;
      if (ev.crown.holderTeamId === b.teamId) return 1;
      return String(a.name).localeCompare(String(b.name));
    });
    const winner = winners[0] || null;
    for (const [sid, part] of ev.participants) {
      const client = this.clients.find(c => c.sessionId === sid);
      if (!client) continue;
      if (winner && part.teamId === winner.teamId) {
        this.awardGrant(client, { source: 'event', event: EVENT_KING.name, items: [{ id: I.LEGEND_TOKEN, count: EVENT_REWARD_TOKENS }] });
        this.recordEventProgress(client);
      }
      client.send('eventFailed', { reason: reason || 'timeout', name: ev.name, id: ev.id, leaderboard: this.eventLeaderboardPayload(ev), winner: winner && winner.name || '' });
      this.teleportKingPlayer(client, part.returnPos, 'failed', ev);
    }
    this.broadcast('chat', { name: '[Event]', text: winner ? 'King of the Hill ended. ' + winner.name + ' held the crown longest.' : 'King of the Hill ended.' });
    this.activeEventInstanceId = '';
    this.serverEvent = this.createIdleEvent(Date.now() + this.randomEventDelay(), this.pickNextServerEvent().kind);
    this.broadcastEventStatus(true);
  }
  tickServerEvent(now) {
    if (!this.serverEvent) this.serverEvent = this.createIdleEvent(now + EVENT_FIRST_DELAY_MS);
    if (this.eventInstances) {
      for (const [id, inst] of this.eventInstances) {
        if (inst.phase === 'ended' && inst.cleanupAt && inst.cleanupAt <= now) this.eventInstances.delete(id);
      }
    }
    const ev = this.currentEventInstance() || this.serverEvent;
    if (ev.phase === 'idle' && now >= ev.nextAt) this.announceServerEvent(now, ev.kind);
    else if (ev.phase === 'queue' && now >= ev.startsAt) {
      if (ev.kind === EVENT_KING.kind) this.startKingEvent(now);
      else this.startParkourEvent(now);
    }
    else if (ev.phase === 'active') {
      if (now >= ev.endsAt) {
        if (ev.kind === EVENT_KING.kind) this.endKingEvent('timeout');
        else this.endParkourEvent('timeout');
      }
      else if (ev.kind === EVENT_KING.kind) this.tickKingEvent(ev, now);
      else if (ev.course) {
        for (const [sid, part] of ev.participants) {
          if (ev.completed.has(sid)) continue;
          const client = this.clients.find(c => c.sessionId === sid);
          const p = this.state.players.get(sid);
          if (!client || !p) continue;
          const f = ev.course.finish;
          if (Math.hypot(p.x - f.x, p.z - f.z) < 2.2 && Math.abs(p.y - f.y) < 3) {
            this.completeParkourPlayer(client);
            continue;
          }
          const outside = p.x < ev.course.minX || p.x > ev.course.maxX || p.z < ev.course.minZ || p.z > ev.course.maxZ;
          if (p.y < ev.course.fallY || outside) {
            part.resets = (part.resets | 0) + 1;
            this.teleportEventPlayer(client, ev.course.start, 'reset');
          }
        }
        if (ev.participants.size > 0 && ev.completed.size >= ev.participants.size) this.endParkourEvent('complete');
      }
    }
    this.broadcastEventStatus(false);
  }
  isEventProtectedBlock(x, y, z) {
    return !!(this.eventCourseBlocks && this.eventCourseBlocks.has(x + ',' + y + ',' + z));
  }
  guildForToken(token) {
    if (!token || !this.guilds) return null;
    for (const g of this.guilds.values()) if (g.members.has(token)) return g;
    return null;
  }
  guildRole(guild, token) {
    if (!guild || !token) return '';
    if (guild.leader === token) return 'leader';
    return guild.roles && guild.roles.get(token) === 'officer' ? 'officer' : 'member';
  }
  guildCanInvite(guild, token) {
    const role = this.guildRole(guild, token);
    return role === 'leader' || role === 'officer';
  }
  guildCanKick(guild, actorToken, targetToken) {
    const a = this.guildRole(guild, actorToken);
    const t = this.guildRole(guild, targetToken);
    if (!a || !t || actorToken === targetToken || t === 'leader') return false;
    if (a === 'leader') return true;
    return a === 'officer' && t === 'member';
  }
  guildHallPayload(client) {
    const token = this.clientToken(client);
    const mine = this.guildForToken(token);
    const all = [...this.guilds.values()];
    const floors = all.filter(g => g.floor > 0).sort((a, b) => a.floor - b.floor).map(g => ({
      id: g.id, name: g.name, leaderName: g.leaderName, floor: g.floor,
    }));
    const fellowships = all.sort((a, b) => a.name.localeCompare(b.name)).map(g => ({
      id: g.id, name: g.name, leaderName: g.leaderName, floor: g.floor,
      memberCount: g.members.size, private: !!g.private,
    }));
    const members = mine ? [...mine.members].map(t => {
      const sid = this.onlineSidForToken(t);
      return { sid, name: this.fellowshipNameForToken(t), role: this.guildRole(mine, t), online: !!sid };
    }).sort((a, b) => {
      const order = { leader: 0, officer: 1, member: 2 };
      return (order[a.role] - order[b.role]) || a.name.localeCompare(b.name);
    }) : [];
    return {
      floors,
      fellowships,
      guild: mine ? {
        id: mine.id, name: mine.name, leaderName: mine.leaderName, floor: mine.floor,
        memberCount: mine.members.size, isLeader: mine.leader === token,
        role: this.guildRole(mine, token), private: !!mine.private, members,
      } : null,
      nextFloor: floors.length + 1,
      nextPrice: guildFloorPrice(floors.length),
      maxFloors: GUILD_FLOOR_MAX,
    };
  }
  sendGuildHallSync(client) {
    if (client && typeof client.send === 'function') client.send('guildHallSync', this.guildHallPayload(client));
  }
  broadcastGuildHallSync() {
    for (const client of this.clients) this.sendGuildHallSync(client);
  }
  nearGuildReception(client) {
    const p = client && this.state.players.get(client.sessionId);
    return !!(p && !p.dgn && Math.hypot(p.x - GUILD_HALL.receptionistX, p.z - GUILD_HALL.receptionistZ) <= 8);
  }
  cleanGuildName(name) {
    return (typeof name === 'string' ? name : '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  }
  handleGuildCreate(client, m) {
    const rec = this.profileFor(client);
    const token = rec && rec.token;
    if (!rec || !token || !this.nearGuildReception(client)) return client.send('guildReject', { reason: 'range' });
    if (this.rateLimited(client, 'guild', 1, 3)) return client.send('guildReject', { reason: 'rate' });
    if (this.guildForToken(token)) return client.send('guildReject', { reason: 'member' });
    const name = this.cleanGuildName(m && m.name);
    if (name.length < 3) return client.send('guildReject', { reason: 'name' });
    for (const g of this.guilds.values()) if (g.name.toLowerCase() === name.toLowerCase()) return client.send('guildReject', { reason: 'taken' });
    const p = this.state.players.get(client.sessionId);
    const guild = {
      id: 'G' + (++this.guildSeq), name, leader: token, leaderName: p && p.name || rec.prof.name || 'Guild Leader',
      members: new Set([token]), roles: new Map(), invites: new Set(), private: !!(m && m.private), floor: 0, foundedAt: Date.now(), floorBoughtAt: 0,
    };
    this.guilds.set(guild.id, guild);
    this.dirtyGuilds = true;
    client.send('guildCreated', { id: guild.id, name: guild.name, leaderName: guild.leaderName });
    this.broadcastGuildHallSync();
    this.broadcast('chat', { name: '[Guild Hall]', text: guild.leaderName + ' founded ' + guild.name });
  }
  fellowshipNameForToken(token) {
    const sid = this.onlineSidForToken(token);
    const online = sid && this.state.players.get(sid);
    const profile = this.profiles.get(token);
    return (online && online.name) || (profile && profile.name) || 'Hunter';
  }
  handleGuildJoin(client, m) {
    const rec = this.profileFor(client);
    if (!rec || !this.nearGuildReception(client)) return client.send('guildReject', { reason: 'range' });
    if (this.rateLimited(client, 'guild', 1, 3)) return client.send('guildReject', { reason: 'rate' });
    if (this.guildForToken(rec.token)) return client.send('guildReject', { reason: 'member' });
    const id = typeof (m && m.id) === 'string' ? m.id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) : '';
    const guild = this.guilds.get(id);
    if (!guild) return client.send('guildReject', { reason: 'missing' });
    if (guild.private && !(guild.invites && guild.invites.has(rec.token))) return client.send('guildReject', { reason: 'invite' });
    if (guild.members.size >= 50) return client.send('guildReject', { reason: 'full_members' });
    guild.members.add(rec.token);
    if (guild.invites) guild.invites.delete(rec.token);
    this.dirtyGuilds = true;
    client.send('guildJoined', { id: guild.id, name: guild.name, leaderName: guild.leaderName });
    this.broadcastGuildHallSync();
    this.broadcast('chat', { name: '[Fellowship]', text: this.fellowshipNameForToken(rec.token) + ' joined ' + guild.name });
  }
  handleGuildLeave(client) {
    const rec = this.profileFor(client);
    const guild = rec && this.guildForToken(rec.token);
    if (!rec || !guild) return client.send('guildReject', { reason: 'guild' });
    if (this.rateLimited(client, 'guild', 1, 3)) return client.send('guildReject', { reason: 'rate' });
    const leavingName = this.fellowshipNameForToken(rec.token);
    guild.members.delete(rec.token);
    if (guild.roles) guild.roles.delete(rec.token);
    if (guild.invites) guild.invites.delete(rec.token);
    let disbanded = false;
    if (!guild.members.size) {
      this.guilds.delete(guild.id);
      disbanded = true;
    } else if (guild.leader === rec.token) {
      guild.leader = [...guild.members][0];
      guild.leaderName = this.fellowshipNameForToken(guild.leader);
      if (guild.roles) guild.roles.delete(guild.leader);
    }
    this.dirtyGuilds = true;
    client.send('guildLeft', { id: guild.id, name: guild.name, disbanded });
    this.broadcastGuildHallSync();
    this.broadcast('chat', { name: '[Fellowship]', text: disbanded ? guild.name + ' has disbanded' : leavingName + ' left ' + guild.name });
  }
  handleGuildPrivacy(client, m) {
    const rec = this.profileFor(client);
    const guild = rec && this.guildForToken(rec.token);
    if (!rec || !guild) return client.send('guildReject', { reason: 'guild' });
    if (this.rateLimited(client, 'guild', 1, 3)) return client.send('guildReject', { reason: 'rate' });
    if (guild.leader !== rec.token) return client.send('guildReject', { reason: 'leader' });
    guild.private = !!(m && m.private);
    this.dirtyGuilds = true;
    client.send('guildResult', { ok: true, action: 'privacy', private: guild.private });
    this.broadcastGuildHallSync();
    this.broadcast('chat', { name: '[Fellowship]', text: guild.name + ' is now ' + (guild.private ? 'invite-only' : 'open to join') });
  }
  handleGuildInvite(client, m) {
    const rec = this.profileFor(client);
    const guild = rec && this.guildForToken(rec.token);
    if (!rec || !guild) return client.send('guildReject', { reason: 'guild' });
    if (this.rateLimited(client, 'guild', 1, 3)) return client.send('guildReject', { reason: 'rate' });
    if (!this.guildCanInvite(guild, rec.token)) return client.send('guildReject', { reason: 'officer' });
    if (guild.members.size >= 50) return client.send('guildReject', { reason: 'full_members' });
    const target = this.findOnlinePlayerByNameOrSid(m && (m.sid || m.name));
    if (!target) return client.send('guildReject', { reason: 'target' });
    const targetRec = this.profileFor(target);
    if (!targetRec || this.guildForToken(targetRec.token)) return client.send('guildReject', { reason: 'target' });
    if (!guild.invites) guild.invites = new Set();
    guild.invites.add(targetRec.token);
    this.dirtyGuilds = true;
    target.send('guildInvite', { id: guild.id, name: guild.name, from: this.fellowshipNameForToken(rec.token), private: !!guild.private });
    client.send('guildResult', { ok: true, action: 'invite', target: this.fellowshipNameForToken(targetRec.token) });
  }
  handleGuildKick(client, m) {
    const rec = this.profileFor(client);
    const guild = rec && this.guildForToken(rec.token);
    if (!rec || !guild) return client.send('guildReject', { reason: 'guild' });
    if (this.rateLimited(client, 'guild', 1, 3)) return client.send('guildReject', { reason: 'rate' });
    const targetClient = m && typeof m.sid === 'string' ? this.clients.find(c => c.sessionId === m.sid) : null;
    const targetToken = targetClient ? this.clientToken(targetClient) : (typeof (m && m.token) === 'string' ? cleanToken(m.token) : '');
    if (!targetToken || !guild.members.has(targetToken)) return client.send('guildReject', { reason: 'target' });
    if (!this.guildCanKick(guild, rec.token, targetToken)) return client.send('guildReject', { reason: 'officer' });
    const kickedName = this.fellowshipNameForToken(targetToken);
    guild.members.delete(targetToken);
    if (guild.roles) guild.roles.delete(targetToken);
    if (guild.invites) guild.invites.delete(targetToken);
    this.dirtyGuilds = true;
    if (targetClient) targetClient.send('guildLeft', { id: guild.id, name: guild.name, kicked: true });
    client.send('guildResult', { ok: true, action: 'kick', target: kickedName });
    this.broadcastGuildHallSync();
    this.broadcast('chat', { name: '[Fellowship]', text: kickedName + ' was removed from ' + guild.name });
  }
  handleGuildRole(client, m) {
    const rec = this.profileFor(client);
    const guild = rec && this.guildForToken(rec.token);
    if (!rec || !guild) return client.send('guildReject', { reason: 'guild' });
    if (this.rateLimited(client, 'guild', 1, 3)) return client.send('guildReject', { reason: 'rate' });
    if (guild.leader !== rec.token) return client.send('guildReject', { reason: 'leader' });
    const targetClient0 = m && typeof m.sid === 'string' ? this.clients.find(c => c.sessionId === m.sid) : null;
    const targetToken = targetClient0 ? this.clientToken(targetClient0) : (typeof (m && m.token) === 'string' ? cleanToken(m.token) : '');
    const role = ['leader', 'officer', 'member'].includes(m && m.role) ? m.role : '';
    if (!targetToken || !role || !guild.members.has(targetToken)) return client.send('guildReject', { reason: 'target' });
    if (targetToken === guild.leader && role !== 'leader') return client.send('guildReject', { reason: 'leader_self' });
    if (!guild.roles) guild.roles = new Map();
    if (role === 'leader') {
      if (targetToken === guild.leader) return client.send('guildResult', { ok: true, action: 'role', role });
      guild.roles.set(guild.leader, 'officer');
      guild.leader = targetToken;
      guild.leaderName = this.fellowshipNameForToken(targetToken);
      guild.roles.delete(targetToken);
    } else if (role === 'officer') {
      guild.roles.set(targetToken, 'officer');
    } else {
      guild.roles.delete(targetToken);
    }
    this.dirtyGuilds = true;
    client.send('guildResult', { ok: true, action: 'role', role, target: this.fellowshipNameForToken(targetToken) });
    const sid = this.onlineSidForToken(targetToken);
    const targetClient = targetClient0 || (sid && this.clients.find(c => c.sessionId === sid));
    if (targetClient) targetClient.send('guildResult', { ok: true, action: 'roleChanged', role, name: guild.name });
    this.broadcastGuildHallSync();
    this.broadcast('chat', { name: '[Fellowship]', text: this.fellowshipNameForToken(targetToken) + ' is now ' + role + ' of ' + guild.name });
  }
  setGuildHallBlock(x, y, z, id, dirty = true) {
    if (!W.inWorld(x, y, z)) return;
    this.world.setB(x, y, z, id);
    this.state.edits.set(x + ',' + y + ',' + z, id);
    if (dirty) this.dirtyWorld = true;
  }
  guildFloorY0(floor) {
    return W.TOWN.G + 6 + ((floor | 0) - 1) * 5;
  }
  guildFloorInteriorForClient(client, x, y, z) {
    const rec = this.profileFor(client);
    const guild = rec && this.guildForToken(rec.token);
    if (!guild || !(guild.floor > 0)) return false;
    const y0 = this.guildFloorY0(guild.floor);
    const { x1, x2, z1, z2 } = GUILD_HALL;
    if (x < x1 + 2 || x > x2 - 2 || z < z1 + 2 || z > z2 - 2 || y < y0 + 1 || y > y0 + 4) return false;
    const inStairwell = x >= x1 + 3 && x <= x1 + 4 && z >= z2 - 7 && z <= z2 - 3;
    return !inStairwell;
  }
  canEditGuildFloor(client, x, y, z, id, prev) {
    if (!this.guildFloorInteriorForClient(client, x, y, z)) return false;
    if (id === W.B.AIR) return GUILD_DECOR_BLOCKS.has(prev);
    return GUILD_DECOR_BLOCKS.has(id);
  }
  buildGuildHallFloor(floor, dirty = true) {
    floor = floor | 0;
    if (floor < 1 || floor > GUILD_FLOOR_MAX) return false;
    const y0 = this.guildFloorY0(floor);
    const { x1, x2, z1, z2 } = GUILD_HALL;
    const put = (x, y, z, id) => this.setGuildHallBlock(x, y, z, id, dirty);
    for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) put(x, y0, z, W.B.PLANKS);
    for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) {
      if (x !== x1 && x !== x2 && z !== z1 && z !== z2) continue;
      const pillar = ((x === x1 || x === x2) && (z === z1 || z === z2)) || ((x - x1) % 6 === 0 && (z === z1 || z === z2));
      for (let y = y0 + 1; y <= y0 + 4; y++) put(x, y, z, pillar ? W.B.LOG : W.B.BRICK);
    }
    for (let x = x1 + 3; x <= x2 - 3; x += 5) {
      put(x, y0 + 2, z1, W.B.GLASS); put(x, y0 + 2, z2, W.B.GLASS);
      put(x, y0 + 3, z1, W.B.GLASS); put(x, y0 + 3, z2, W.B.GLASS);
    }
    for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) put(x, y0 + 5, z, W.B.PLANKS);
    for (let step = 0; step < 5; step++) for (let x = x1 + 3; x <= x1 + 4; x++) {
      const z = z2 - 3 - step, y = y0 - 5 + step;
      put(x, y, z, W.B.COBBLE);
      for (let head = y + 1; head <= Math.min(y + 3, y0 + 1); head++) put(x, head, z, W.B.AIR);
    }
    return true;
  }
  handleGuildFloorBuy(client) {
    const rec = this.profileFor(client);
    if (!rec || !this.nearGuildReception(client)) return client.send('guildReject', { reason: 'range' });
    if (this.rateLimited(client, 'guild', 1, 3)) return client.send('guildReject', { reason: 'rate' });
    const guild = this.guildForToken(rec.token);
    if (!guild) return client.send('guildReject', { reason: 'guild' });
    if (guild.leader !== rec.token) return client.send('guildReject', { reason: 'leader' });
    if (guild.floor > 0) return client.send('guildReject', { reason: 'owned' });
    const used = new Set([...this.guilds.values()].map(g => g.floor).filter(Boolean));
    let floor = 1; while (used.has(floor)) floor++;
    if (floor > GUILD_FLOOR_MAX) return client.send('guildReject', { reason: 'full' });
    const price = guildFloorPrice(used.size);
    if ((rec.prof.gold | 0) < price) return client.send('guildReject', { reason: 'gold', price, gold: rec.prof.gold | 0 });
    rec.prof.gold = Math.max(0, (rec.prof.gold | 0) - price);
    guild.floor = floor;
    guild.floorBoughtAt = Date.now();
    this.dirtyPlayers.add(rec.token);
    this.dirtyGuilds = true;
    this.buildGuildHallFloor(floor, true);
    client.send('guildFloorResult', { floor, price, gold: rec.prof.gold | 0, name: guild.name });
    this.broadcastGuildHallSync();
    this.broadcast('chat', { name: '[Guild Hall]', text: guild.name + ' claimed floor ' + floor });
  }
}

module.exports = EventsMixin.prototype;
