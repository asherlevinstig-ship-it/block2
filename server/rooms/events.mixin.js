// Server events (skyship, day cycle, parkour, king-of-the-hill, PvP bounty) and the
// guild hall. Lifted verbatim out of GameRoom.js and mixed into its prototype.
const {
  AEGIS_BOUNTY_MS, AEGIS_BOUNTY_RANGE, BETA_EVENT_TEST, CARAVAN_ACTIVE_MS, DAY_MS, EVENT_ACTIVE_MS, EVENT_CARAVAN, EVENT_FIRST_DELAY_MS,
  EVENT_IDLE_JITTER_MS, EVENT_IDLE_MIN_MS, EVENT_KING, EVENT_PARKOUR, EVENT_QUEUE_MS, EVENT_REWARD_TOKENS,
  EVENT_TEST_QUEUE_MS, GUILD_DECOR_BLOCKS, GUILD_FLOOR_MAX, GUILD_HALL, I, KING_ACTIVE_MS, KING_ARENA_SIZE,
  KING_CROWN_PICKUP_RADIUS, KING_HIT_RANGE, KING_RESPAWN_MS, SKYSHIP_AWAY_MS, SKYSHIP_BOARD_GOLD,
  SKYSHIP_BOARD_RANK, SKYSHIP_CYCLE_MS, SKYSHIP_DOCK_MS, SKYSHIP_TRAVEL_MS, WEATHER_KINDS,
  LIGHTNING_INTERVAL_MS, LIGHTNING_RADIUS, LIGHTNING_PLAYER_DMG, LIGHTNING_MOB_DMG,
  rollWeatherNext, rollWeatherDurationMs, dayTimeAt, guildFloorPrice,
  skyshipSnapshot, sstep, clampN,
} = require('./constants');
const { State, Player, Mob, Team, Gate } = require('../schema');
const { TeamManager } = require('../teams');
const W = require('../world');
const { hunterXpForActivity } = require('./xp-economy');
const D = require('../dungeon');
const AI = require('../ai');
const { createStore, sanitizeProfile, mergeClientSave, defaultProfile, cleanToken, sanitizeUtilityLoadout } = require('../store');
const EVENT_START_MS = 4000;
const EVENT_RESULTS_MS = 7000;
const EVENT_READY_MS = 10000;
const EVENT_QUEUE_RETRY_MS = 30000;
const EVENT_QUEUE_EXTENSION_MS = 15000;
const EVENT_QUEUE_CAPACITY = 8;
const EVENT_QUEUE_NEAR_FULL = 6;
const EVENT_TEAM_MAX = 5;

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
    this.weatherUntil = 0;
    this.nextLightningAt = 0;
  }

  // ---- weather: server-owned like the day cycle; clients render, the server decides ----
  weatherPayload() {
    return { kind: (this.state && this.state.weather) || 'clear', until: this.weatherUntil | 0, serverNow: Date.now() };
  }
  sendWeather(client) {
    if (client && typeof client.send === 'function') client.send('weather', this.weatherPayload());
  }
  setWeather(kind, now = Date.now()) {
    if (!WEATHER_KINDS.includes(kind)) kind = 'clear';
    const prev = this.state.weather;
    this.state.weather = kind;
    this.weatherUntil = now + rollWeatherDurationMs(kind);
    if (kind === 'storm') this.nextLightningAt = now + 2500;
    if (prev !== kind) this.broadcast('weather', this.weatherPayload());
    return kind;
  }
  tickWeather(now) {
    if (!this.state || typeof this.state.weather !== 'string') return;
    if (!this.weatherUntil) { this.weatherUntil = now + rollWeatherDurationMs(this.state.weather); return; }
    if (now >= this.weatherUntil) this.setWeather(rollWeatherNext(this.state.weather), now);
    if (this.state.weather === 'storm' && now >= (this.nextLightningAt || 0)) {
      this.nextLightningAt = now + LIGHTNING_INTERVAL_MS[0] + Math.random() * (LIGHTNING_INTERVAL_MS[1] - LIGHTNING_INTERVAL_MS[0]);
      this.strikeLightning();
    }
  }
  // Pick a strike point near a random surface hunter; the town stays a sanctuary.
  strikeLightning() {
    const surface = [];
    this.state.players.forEach((p, sid) => { if (!p.dgn && (p.dim || 'overworld') === 'overworld') surface.push({ p, sid }); });
    if (!surface.length) return null;
    const anchor = surface[(Math.random() * surface.length) | 0];
    const ang = Math.random() * Math.PI * 2, dist = 4 + Math.random() * 12;
    const x = clampN(anchor.p.x + Math.cos(ang) * dist, 2, W.WX - 2);
    const z = clampN(anchor.p.z + Math.sin(ang) * dist, 2, W.WX - 2);
    if (this.isTownProtected(x, z)) return null;
    const gy = this.world.standHeight(x, z, W.WH - 2);
    return this.applyLightningStrike(x, gy > 0 ? gy : anchor.p.y, z);
  }
  // Deterministic damage step, split out so it is directly testable: broadcast the bolt,
  // shock unsheltered hunters, and fry overworld mobs in the blast radius (friendlies immune).
  applyLightningStrike(x, y, z) {
    this.broadcast('weatherBolt', { x, y, z });
    this.state.players.forEach((p, sid) => {
      if (p.dgn || (p.dim || 'overworld') !== 'overworld') return;
      if (Math.hypot(p.x - x, p.z - z) > LIGHTNING_RADIUS || this.isTownProtected(p.x, p.z)) return;
      const client = this.clients.find(c => c.sessionId === sid);
      if (client) this.hurtPlayer(client, LIGHTNING_PLAYER_DMG, 'lightning');
    });
    const dead = [];
    this.state.mobs.forEach((m, id) => {
      const meta = this.mobMeta[id];
      if (m.dgn || !meta || meta.friendly) return;
      if (Math.hypot(m.x - x, m.z - z) > LIGHTNING_RADIUS) return;
      m.hp -= LIGHTNING_MOB_DMG;
      if (m.hp <= 0) dead.push(id);
    });
    for (const id of dead) { this.state.mobs.delete(id); delete this.mobMeta[id]; }
    return { x, y, z, killed: dead.length };
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
    const roll = Math.random();
    return roll < 1 / 3 ? EVENT_PARKOUR : roll < 2 / 3 ? EVENT_KING : EVENT_CARAVAN;
  }
  createIdleEvent(nextAt, forcedKind) {
    const def = forcedKind === EVENT_KING.kind ? EVENT_KING
      : forcedKind === EVENT_CARAVAN.kind ? EVENT_CARAVAN
      : EVENT_PARKOUR;
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
  minParticipantsForEvent(ev) {
    return ev && (ev.kind === EVENT_KING.kind || ev.kind === EVENT_CARAVAN.kind) ? 2 : 1;
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
      queueExtended: false,
      waitingForPlayers: false,
      lastJoinAt: 0,
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
      queueExtended: false,
      waitingForPlayers: false,
      lastJoinAt: 0,
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
    if (inst && inst.kind === EVENT_CARAVAN.kind) {
      return [...(inst.participants || new Map()).entries()]
        .map(([sid, part]) => ({
          name: this.playerName(sid) || 'Hunter',
          kills: part.kills | 0,
          revives: part.revives | 0,
        }))
        .sort((a, b) => (b.kills - a.kills) || (b.revives - a.revives) || a.name.localeCompare(b.name))
        .slice(0, 8);
    }
    if (inst && inst.kind === EVENT_KING.kind) {
      return [...(inst.scores || new Map()).values()]
        .sort((a, b) => (b.ms - a.ms) || String(a.name).localeCompare(String(b.name)))
        .slice(0, 5)
        .map(row => ({
          teamId: row.teamId || '',
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
  eventResultPayload(ev, sid, outcome, reward, extra = {}) {
    const part = ev && ev.participants && ev.participants.get(sid);
    const leaderboard = this.eventLeaderboardPayload(ev);
    let placement = 0;
    if (ev && ev.kind === EVENT_PARKOUR.kind) {
      const index = (ev.leaderboard || []).findIndex(row => row.sid === sid);
      placement = index >= 0 ? index + 1 : 0;
    } else if (part) {
      const index = leaderboard.findIndex(row => row.name === part.teamName);
      placement = index >= 0 ? index + 1 : 0;
    }
    return {
      id: ev && ev.id || '',
      kind: ev && ev.kind || '',
      name: ev && ev.name || 'Server Event',
      outcome,
      placement,
      participantCount: ev && ev.participants ? ev.participants.size : 0,
      contribution: ev && ev.kind === EVENT_KING.kind
        ? { label: 'Crown time', valueMs: part && ev.scores.get(part.teamId) ? ev.scores.get(part.teamId).ms | 0 : 0 }
        : ev && ev.kind === EVENT_CARAVAN.kind
          ? { label: 'Bandits defeated', value: part ? part.kills | 0 : 0, revives: part ? part.revives | 0 : 0 }
          : { label: 'Finish time', valueMs: part && part.finishedAt ? Math.max(0, part.finishedAt - (part.startedAt || ev.startsAt || part.finishedAt)) : 0, resets: part && part.resets | 0 },
      reward: reward || { xp: 0, tokens: 0 },
      leaderboard,
      returnAt: part && part.returnAt || Date.now() + EVENT_RESULTS_MS,
      ...extra,
    };
  }
  createCaravanInstance(now, startsAt) {
    const x = EVENT_CARAVAN.x, z = EVENT_CARAVAN.z, half = EVENT_CARAVAN.size / 2;
    return {
      id: 'event-' + (++this.eventSeq),
      kind: EVENT_CARAVAN.kind,
      name: EVENT_CARAVAN.name,
      phase: 'queue',
      createdAt: now,
      startsAt,
      endsAt: 0,
      queue: new Set(),
      participants: new Map(),
      completed: new Set(),
      leaderboard: [],
      arena: {
        x, z, size: EVENT_CARAVAN.size,
        minX: x - half, maxX: x + half,
        minZ: z - 28, maxZ: z + 28,
        startX: x - half + 12, endX: x + half - 12,
      },
      caravan: {
        x: x - half + 12, y: W.TOWN.G + 1.05, z,
        hp: 0, maxHp: 0, progress: 0,
        wave: 0, totalWaves: 4, enemiesRemaining: 0,
        state: 'staging', wagonId: '',
      },
      enemyIds: new Set(),
      lastCaravanTickAt: 0,
      cleanupAt: 0,
      queueExtended: false,
      waitingForPlayers: false,
      lastJoinAt: 0,
    };
  }
  eventPayload(client) {
    const ev = this.currentEventInstance() || this.serverEvent || this.createIdleEvent(Date.now() + EVENT_FIRST_DELAY_MS);
    const sid = client && client.sessionId;
    const participating = !!(sid && ev.participants && ev.participants.has(sid));
    const coursePayload = ev.course && (ev.phase === 'active' || participating) ? {
      seed: ev.course.seed,
      start: ev.course.start,
      finish: ev.course.finish,
      checkpoints: ev.course.checkpoints || [],
      fallY: ev.course.fallY,
      blocks: ev.course.blocks,
    } : null;
    const rec = client && this.profileFor(client);
    const part = participating ? ev.participants.get(sid) : null;
    const rewardXp = rec ? hunterXpForActivity(rec.prof.S.lvl, 'event') : 0;
    return {
      kind: ev.kind,
      name: ev.name,
      phase: ev.phase,
      id: ev.id,
      nextAt: ev.nextAt || 0,
      startsAt: ev.startsAt || 0,
      goAt: ev.goAt || 0,
      endsAt: ev.endsAt || 0,
      queueSize: ev.queue ? ev.queue.size : 0,
      queueCapacity: EVENT_QUEUE_CAPACITY,
      minParticipants: this.minParticipantsForEvent(ev),
      waitingForPlayers: !!ev.waitingForPlayers,
      waitingReason: ev.waitingReason || '',
      queueExtended: !!ev.queueExtended,
      joined: !!(sid && ev.queue && ev.queue.has(sid)),
      participating,
      participantCount: ev.participants ? ev.participants.size : 0,
      ready: !!(sid && ev.participants && ev.participants.get(sid) && ev.participants.get(sid).ready),
      readyCount: ev.participants ? [...ev.participants.values()].filter(part => part.ready).length : 0,
      eventTeam: participating ? {
        id: ev.participants.get(sid).teamId || '',
        name: ev.participants.get(sid).teamName || '',
        source: ev.participants.get(sid).groupSource || '',
      } : null,
      eventSquad: participating && (ev.kind === EVENT_KING.kind || ev.kind === EVENT_CARAVAN.kind) ? {
        id: ev.participants.get(sid).teamId || '',
        name: ev.participants.get(sid).teamName || '',
        source: ev.participants.get(sid).groupSource || '',
        members: [...ev.participants.entries()]
          .filter(([, part]) => part.teamId === ev.participants.get(sid).teamId)
          .map(([memberSid]) => {
            const player = this.state.players.get(memberSid);
            return { sid: memberSid, name: player && player.name || 'Hunter', path: player && player.path || '' };
          }),
      } : null,
      completed: !!(sid && ev.completed && ev.completed.has(sid)),
      checkpointProgress: participating && ev.kind === EVENT_PARKOUR.kind ? {
        passed: part.checkpointsPassed | 0,
        total: ev.course && ev.course.checkpoints ? ev.course.checkpoints.length : 0,
        splitTimes: Array.isArray(part.splitTimes) ? part.splitTimes : [],
        startedAt: part.startedAt || 0,
      } : null,
      personalBestMs: rec && rec.prof ? rec.prof.parkourBestMs | 0 : 0,
      course: coursePayload,
      arena: ev.arena || null,
      caravan: ev.caravan ? {
        x: ev.caravan.x,
        y: ev.caravan.y,
        z: ev.caravan.z,
        hp: Math.max(0, ev.caravan.hp | 0),
        maxHp: Math.max(1, ev.caravan.maxHp | 0),
        progress: Math.max(0, Math.min(1, Number(ev.caravan.progress) || 0)),
        wave: ev.caravan.wave | 0,
        totalWaves: ev.caravan.totalWaves | 0,
        enemiesRemaining: ev.caravan.enemiesRemaining | 0,
        state: ev.caravan.state || 'staging',
        downed: participating ? [...ev.participants.entries()]
          .filter(([, member]) => member.downed)
          .map(([memberSid, member]) => ({
            sid: memberSid,
            name: this.playerName(memberSid) || 'Hunter',
            reviveProgress: Math.max(0, Math.min(1, (member.reviveMs || 0) / 2000)),
          })) : [],
        kills: part ? part.kills | 0 : 0,
        revives: part ? part.revives | 0 : 0,
      } : null,
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
      rewardMin: ev.kind === EVENT_CARAVAN.kind ? 1 : EVENT_REWARD_TOKENS,
      rewardMax: ev.kind === EVENT_CARAVAN.kind ? 3 : EVENT_REWARD_TOKENS,
      rewardXp,
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
    if (!ev.queue.has(client.sessionId) && ev.queue.size >= EVENT_QUEUE_CAPACITY)
      return client.send('eventReject', { reason: 'full' });
    ev.queue.add(client.sessionId);
    ev.lastJoinAt = Date.now();
    ev.waitingForPlayers = ev.queue.size < this.minParticipantsForEvent(ev);
    client.send('eventJoined', this.eventPayload(client));
    this.broadcastEventStatus(true);
  }
  handleEventLeave(client) {
    const ev = this.currentEventInstance() || this.serverEvent;
    if (!ev) return;
    if (ev.phase === 'queue' && ev.queue.delete(client.sessionId)) {
      ev.waitingForPlayers = ev.queue.size < this.minParticipantsForEvent(ev);
      client.send('eventLeft', this.eventPayload(client));
      this.broadcastEventStatus(true);
    }
  }
  handleEventReady(client) {
    const ev = this.currentEventInstance() || this.serverEvent;
    const part = ev && ev.phase === 'starting' && ev.participants && ev.participants.get(client.sessionId);
    if (!part || part.ready) return;
    part.ready = true;
    part.readyAt = Date.now();
    client.send('eventReady', this.eventPayload(client));
    this.broadcastEventStatus(true);
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
      : kind === 'caravan' || kind === 'defence' || kind === 'defense' ? EVENT_CARAVAN.kind
      : kind === 'parkour' ? EVENT_PARKOUR.kind
      : '';
    if (!forcedKind) return client.send('chat', { name: '[Event]', text: 'use /event parkour, /event king, or /event caravan' });
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
    this.eventCourseBlocks.clear();
  }
  setEventBlock(x, y, z, id) {
    if (!W.inWorld(x, y, z)) return;
    this.eventCourseBlocks.add(x + ',' + y + ',' + z + ',' + id);
  }
  eventPlatform(cx, y, cz, rx, rz, id) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      for (let z = cz - rz; z <= cz + rz; z++) this.setEventBlock(x, y, z, id);
    }
  }
  generateParkourCourse(seed) {
    const blocks = [];
    const checkpoints = [];
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
      if (i === 3 || i === 7 || i === 11) checkpoints.push({
        index: checkpoints.length,
        x: x + .5,
        y: y + 1.05,
        z: z + .5,
      });
    }
    x += 5;
    platform(x, y, z, 3, 2, W.B.CONCRETE);
    addBlock(x, y + 1, z - 2, W.B.TORCH);
    addBlock(x, y + 1, z + 2, W.B.TORCH);
    return {
      seed,
      start: { x: sx + .5, y: sy + 1.05, z: sz + .5 },
      finish: { x: x + .5, y: y + 1.05, z: z + .5 },
      checkpoints,
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
  announceCaravanEvent(now) {
    const ev = this.createCaravanInstance(now, now + EVENT_QUEUE_MS);
    this.eventInstances.set(ev.id, ev);
    this.setServerEventFromInstance(ev);
    this.broadcast('chat', { name: '[Event]', text: 'Caravan Defence opened. Rally a team to escort the merchants through the bandit ambush.' });
    this.broadcastEventStatus(true);
    return ev;
  }
  announceServerEvent(now, forcedKind) {
    return forcedKind === EVENT_KING.kind ? this.announceKingEvent(now)
      : forcedKind === EVENT_CARAVAN.kind ? this.announceCaravanEvent(now)
      : this.announceParkourEvent(now);
  }
  eventReturnPos(p) {
    if (!p) return { x: W.TOWN.TC + .5, y: W.TOWN.G + 2, z: W.TOWN.TC + 7.5 };
    return { x: p.x, y: p.y, z: p.z };
  }
  teleportEventPlayer(client, pos, reason, evArg) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !pos) return;
    const ev = evArg || this.currentEventInstance() || this.serverEvent;
    const inEvent = ev && (ev.phase === 'starting' || ev.phase === 'active')
      && reason !== 'complete' && reason !== 'failed' && reason !== 'return' && reason !== 'afk' && reason !== 'cancel';
    p.dgn = inEvent ? ev.id : '';
    p.dim = inEvent ? 'event' : 'overworld';
    p.x = pos.x; p.y = pos.y; p.z = pos.z;
    client.send('eventTeleport', { x: pos.x, y: pos.y, z: pos.z, reason: reason || 'event', eventId: inEvent ? ev.id : '', course: inEvent ? ev.course : null });
  }
  resumeEventParticipant(client) {
    const p = client && this.state.players.get(client.sessionId);
    const ev = this.currentEventInstance() || this.serverEvent;
    if (!p || !ev || (ev.phase !== 'starting' && ev.phase !== 'active') || !ev.participants || !ev.participants.has(client.sessionId)) return false;
    p.dim = 'event';
    p.dgn = ev.id;
    client.send('eventTeleport', {
      kind: ev.kind,
      eventId: ev.id,
      x: p.x,
      y: p.y,
      z: p.z,
      reason: 'reconnect',
      course: ev.kind === EVENT_PARKOUR.kind ? ev.course : null,
      arena: ev.kind === EVENT_KING.kind || ev.kind === EVENT_CARAVAN.kind ? ev.arena : null,
      caravan: ev.kind === EVENT_CARAVAN.kind ? ev.caravan : null,
    });
    client.send('eventStarted', this.eventPayload(client));
    return true;
  }
  startParkourEvent(now) {
    const ev = this.currentEventInstance() || this.serverEvent;
    if (!ev || ev.phase !== 'queue') return;
    ev.phase = 'starting';
    ev.goAt = 0;
    ev.readyDeadline = now + EVENT_READY_MS;
    ev.startsAt = 0;
    ev.endsAt = 0;
    for (const sid of ev.queue) {
      const client = this.clients.find(c => c.sessionId === sid);
      const p = this.state.players.get(sid);
      if (!client || !p || p.dgn) continue;
      ev.participants.set(sid, {
        returnPos: this.eventReturnPos(p),
        resets: 0,
        startedAt: 0,
        finishedAt: 0,
        ready: false,
        readyAt: 0,
        checkpointsPassed: 0,
        splitTimes: [],
      });
      this.teleportEventPlayer(client, ev.course.start, 'start', ev);
      client.send('eventStarted', this.eventPayload(client));
    }
    if (ev.participants.size <= 0) return this.endParkourEvent('empty');
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
    const rec = this.profileFor(client);
    const previousBestMs = rec && rec.prof ? rec.prof.parkourBestMs | 0 : 0;
    const newBest = !!(rec && rec.prof && (!previousBestMs || ms < previousBestMs));
    if (newBest) {
      rec.prof.parkourBestMs = ms;
      this.dirtyPlayers.add(rec.token);
    }
    const xp = rec ? hunterXpForActivity(rec.prof.S.lvl, 'event') : 0;
    this.awardGrant(client, { source: 'event', event: EVENT_PARKOUR.name, xp, items: [{ id: I.LEGEND_TOKEN, count: EVENT_REWARD_TOKENS }] });
    this.recordEventProgress(client);
    const unlocked = this.unlockUtility(client, 'feather_step', 'Parkour finish unlocked');
    part.returnAt = now + EVENT_RESULTS_MS;
    client.send('eventComplete', this.eventPayload(client));
    client.send('eventResult', this.eventResultPayload(ev, client.sessionId, 'complete', {
      xp,
      tokens: EVENT_REWARD_TOKENS,
      unlock: unlocked ? 'Feather Step' : '',
      personalBestMs: rec && rec.prof ? rec.prof.parkourBestMs | 0 : ms,
      previousBestMs,
      newBest,
    }));
    this.broadcastEventStatus(true);
  }
  endParkourEvent(reason) {
    const ev = this.currentEventInstance() || this.serverEvent;
    if (!ev || ev.phase === 'idle') return;
    ev.phase = 'ended';
    ev.cleanupAt = Date.now() + 60000;
    ev.returnAt = Date.now() + EVENT_RESULTS_MS;
    for (const [sid, part] of ev.participants) {
      if (ev.completed.has(sid)) continue;
      const client = this.clients.find(c => c.sessionId === sid);
      part.returnAt = ev.returnAt;
      if (client) {
        client.send('eventFailed', { reason: reason || 'timeout', name: ev.name, id: ev.id, leaderboard: this.eventLeaderboardPayload(ev) });
        client.send('eventResult', this.eventResultPayload(ev, sid, 'failed', { xp: 0, tokens: 0 }, {
          reason: reason || 'timeout',
        }));
      }
    }
    this.broadcast('chat', { name: '[Event]', text: 'Parkour event ended.' });
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
  eventAbilityBalanceValue(sid) {
    const client = this.clients.find(c => c.sessionId === sid);
    const rec = client && this.profileFor(client);
    const S = rec && rec.prof && rec.prof.S || {};
    return Math.max(1, S.lvl | 0) * 10
      + Math.max(1, S.str | 0) + Math.max(1, S.agi | 0)
      + Math.max(1, S.vit | 0) + Math.max(1, S.int | 0);
  }
  kingSocialGroupForSid(sid) {
    const p = this.state.players.get(sid);
    if (p && p.team) {
      const team = this.state.teams.get(p.team);
      return { id: 'party:' + p.team, name: team && team.name || 'Hunter Party', source: 'party' };
    }
    const token = this.tokens.get(sid);
    const guild = token && this.guildForToken(token);
    if (guild) return { id: 'fellowship:' + guild.id, name: guild.name || 'Fellowship Squad', source: 'fellowship' };
    return { id: 'solo:' + sid, name: '', source: 'ability' };
  }
  buildKingEventTeams(sids) {
    const socialGroups = new Map();
    const solos = [];
    for (const sid of sids) {
      const social = this.kingSocialGroupForSid(sid);
      if (social.source === 'ability') {
        solos.push(sid);
        continue;
      }
      if (!socialGroups.has(social.id)) socialGroups.set(social.id, { ...social, sids: [] });
      socialGroups.get(social.id).sids.push(sid);
    }
    const assignments = new Map();
    const eventTeams = [];
    for (const group of [...socialGroups.values()].sort((a, b) => a.id.localeCompare(b.id))) {
      const chunks = [];
      for (let i = 0; i < group.sids.length; i += EVENT_TEAM_MAX) chunks.push(group.sids.slice(i, i + EVENT_TEAM_MAX));
      chunks.forEach((members, index) => {
        const suffix = chunks.length > 1 ? ' ' + (index + 1) : '';
        const team = {
          id: group.id + (chunks.length > 1 ? ':' + index : ''),
          name: group.name + suffix,
          source: group.source,
          members,
          count: members.length,
        };
        eventTeams.push(team);
        for (const sid of members) assignments.set(sid, { teamId: team.id, teamName: team.name, groupSource: team.source });
      });
    }
    if (solos.length) {
      const neededForCapacity = Math.ceil(solos.length / EVENT_TEAM_MAX);
      const neededForOpponent = eventTeams.length === 0 ? 2 : eventTeams.length === 1 ? 1 : 0;
      const squadCount = Math.min(solos.length, Math.max(1, neededForCapacity, neededForOpponent));
      const squads = Array.from({ length: squadCount }, (_, i) => ({
        id: 'balanced:' + (i + 1),
        name: 'Event Squad ' + (i + 1),
        source: 'ability',
        members: [],
        count: 0,
        power: 0,
        paths: { shadow: 0, mage: 0, guardian: 0 },
      }));
      const ordered = solos.slice().sort((a, b) => this.eventAbilityBalanceValue(b) - this.eventAbilityBalanceValue(a) || a.localeCompare(b));
      for (const sid of ordered) {
        const p = this.state.players.get(sid);
        const path = p && ['shadow', 'mage', 'guardian'].includes(p.path) ? p.path : '';
        const eligible = squads.filter(squad => squad.count < EVENT_TEAM_MAX);
        eligible.sort((a, b) =>
          (a.count - b.count)
          || ((a.power + (path ? a.paths[path] * 20 : 0)) - (b.power + (path ? b.paths[path] * 20 : 0)))
          || a.id.localeCompare(b.id));
        const squad = eligible[0];
        squad.members.push(sid);
        squad.count++;
        squad.power += this.eventAbilityBalanceValue(sid);
        if (path) squad.paths[path]++;
        assignments.set(sid, { teamId: squad.id, teamName: squad.name, groupSource: squad.source });
      }
    }
    return assignments;
  }
  kingEventTeamCount(sids) {
    return new Set([...this.buildKingEventTeams(sids).values()].map(assignment => assignment.teamId)).size;
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
    return { x, y: W.TOWN.G + 1.05, z };
  }
  teleportKingPlayer(client, pos, reason, evArg) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !pos) return;
    const ev = evArg || this.currentEventInstance() || this.serverEvent;
    const inEvent = !!(ev && (ev.phase === 'starting' || ev.phase === 'active')
      && reason !== 'complete' && reason !== 'failed' && reason !== 'return' && reason !== 'afk' && reason !== 'cancel');
    p.dim = inEvent ? 'event' : 'overworld';
    p.dgn = inEvent ? ev.id : '';
    if (inEvent) p.mount = '';
    p.x = pos.x; p.y = pos.y; p.z = pos.z;
    client.send('eventTeleport', {
      kind: EVENT_KING.kind,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      reason: reason || 'king',
      eventId: inEvent ? ev.id : '',
      arena: inEvent ? ev.arena : null,
    });
  }
  startKingEvent(now) {
    const ev = this.currentEventInstance() || this.serverEvent;
    if (!ev || ev.phase !== 'queue') return;
    ev.phase = 'starting';
    ev.goAt = 0;
    ev.readyDeadline = now + EVENT_READY_MS;
    ev.startsAt = 0;
    ev.endsAt = 0;
    ev.lastScoreAt = 0;
    const eligible = [];
    for (const sid of ev.queue) {
      const client = this.clients.find(c => c.sessionId === sid);
      const p = this.state.players.get(sid);
      if (!client || !p || p.dgn) continue;
      eligible.push(sid);
    }
    const assignments = this.buildKingEventTeams(eligible);
    if (new Set([...assignments.values()].map(assignment => assignment.teamId)).size < 2) {
      ev.phase = 'queue';
      ev.waitingForPlayers = true;
      ev.waitingReason = 'teams';
      ev.startsAt = now + EVENT_QUEUE_RETRY_MS;
      return this.broadcastEventStatus(true);
    }
    for (const sid of eligible) {
      const p = this.state.players.get(sid);
      const assignment = assignments.get(sid);
      const teamId = assignment.teamId;
      const teamName = assignment.teamName;
      ev.participants.set(sid, {
        returnPos: this.eventReturnPos(p), teamId, teamName, groupSource: assignment.groupSource,
        respawnAt: 0, ready: false, readyAt: 0,
      });
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
    this.broadcastEventStatus(true);
  }
  caravanSpawnPos(ev, sid) {
    const i = Math.max(0, [...(ev.participants || new Map()).keys()].indexOf(sid));
    const row = Math.floor(i / 4), side = i % 4;
    return {
      x: ev.arena.startX - 4 - row * 2,
      y: W.TOWN.G + 1.05,
      z: ev.arena.z + (side - 1.5) * 2.3,
    };
  }
  teleportCaravanPlayer(client, pos, reason, evArg) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !pos) return;
    const ev = evArg || this.currentEventInstance() || this.serverEvent;
    const inEvent = !!(ev && (ev.phase === 'starting' || ev.phase === 'active')
      && reason !== 'complete' && reason !== 'failed' && reason !== 'return' && reason !== 'afk' && reason !== 'cancel');
    p.dim = inEvent ? 'event' : 'overworld';
    p.dgn = inEvent ? ev.id : '';
    if (inEvent) p.mount = '';
    p.x = pos.x; p.y = pos.y; p.z = pos.z;
    client.send('eventTeleport', {
      kind: EVENT_CARAVAN.kind,
      x: pos.x, y: pos.y, z: pos.z,
      reason: reason || 'caravan',
      eventId: inEvent ? ev.id : '',
      arena: inEvent ? ev.arena : null,
      caravan: inEvent ? ev.caravan : null,
    });
  }
  startCaravanEvent(now) {
    const ev = this.currentEventInstance() || this.serverEvent;
    if (!ev || ev.kind !== EVENT_CARAVAN.kind || ev.phase !== 'queue') return;
    ev.phase = 'starting';
    ev.goAt = 0;
    ev.readyDeadline = now + EVENT_READY_MS;
    ev.startsAt = 0;
    ev.endsAt = 0;
    for (const sid of ev.queue) {
      const client = this.clients.find(c => c.sessionId === sid);
      const p = this.state.players.get(sid);
      if (!client || !p || p.dgn) continue;
      ev.participants.set(sid, {
        returnPos: this.eventReturnPos(p),
        teamId: 'escort',
        teamName: 'Caravan Guard',
        groupSource: 'cooperative',
        ready: false,
        readyAt: 0,
        kills: 0,
        revives: 0,
        deaths: 0,
        downed: false,
        downedUntil: 0,
        reviveMs: 0,
      });
    }
    if (ev.participants.size < this.minParticipantsForEvent(ev)) return this.cancelStagedEvent(ev, 'players', now);
    for (const sid of ev.participants.keys()) {
      const client = this.clients.find(c => c.sessionId === sid);
      if (!client) continue;
      this.teleportCaravanPlayer(client, this.caravanSpawnPos(ev, sid), 'start', ev);
      client.send('eventStarted', this.eventPayload(client));
    }
    this.broadcastEventStatus(true);
  }
  spawnCaravanWagon(ev) {
    if (!ev || !ev.caravan || ev.caravan.wagonId) return;
    const maxHp = 120 + ev.participants.size * 30;
    const id = String(++this.mobSeq), mob = new Mob();
    mob.kind = 'caravan_wagon';
    mob.dgn = ev.id;
    mob.x = ev.caravan.x; mob.y = ev.caravan.y; mob.z = ev.caravan.z;
    mob.hp = mob.maxHp = maxHp;
    this.state.mobs.set(id, mob);
    const meta = this.freshMeta(mob.x, mob.z, 0, 0, mob.kind, 0, false);
    meta.friendly = true;
    meta.eventCaravan = ev.id;
    this.mobMeta[id] = meta;
    ev.caravan.wagonId = id;
    ev.caravan.hp = ev.caravan.maxHp = maxHp;
  }
  spawnCaravanWave(ev, wave) {
    if (!ev || ev.kind !== EVENT_CARAVAN.kind || ev.phase !== 'active') return;
    ev.caravan.wave = wave;
    ev.caravan.state = wave >= ev.caravan.totalWaves ? 'captain' : 'ambushed';
    const count = Math.min(12, 2 + ev.participants.size + wave);
    const roles = ['bandit', 'bandit_archer', 'bandit_shield', 'bandit_scout', 'bandit_brute'];
    for (let i = 0; i < count; i++) {
      const captain = wave >= ev.caravan.totalWaves && i === 0;
      const kind = captain ? 'bandit_captain' : roles[(i + wave) % roles.length];
      const side = i % 2 ? -1 : 1, lane = Math.floor(i / 2);
      const id = String(++this.mobSeq), mob = new Mob();
      mob.kind = kind;
      mob.dgn = ev.id;
      mob.x = Math.max(ev.arena.minX + 3, Math.min(ev.arena.maxX - 3, ev.caravan.x + 10 + lane * 1.7));
      mob.z = ev.caravan.z + side * (8 + (lane % 3) * 3);
      mob.y = W.TOWN.G + 1.05;
      const baseHp = captain ? 65 + ev.participants.size * 16 : kind === 'bandit_brute' ? 30 : kind === 'bandit_shield' ? 24 : 17;
      mob.hp = mob.maxHp = Math.round(baseHp * (1 + (wave - 1) * .16));
      this.state.mobs.set(id, mob);
      const ranged = kind === 'bandit_archer';
      const meta = this.freshMeta(mob.x, mob.z, captain ? 8 : kind === 'bandit_brute' ? 6 : ranged ? 4 : 5, captain ? 1.3 : ranged ? 1.35 : 1.7, kind, wave - 1, captain);
      meta.bandit = true;
      meta.banditCaptain = captain;
      meta.banditRole = captain ? 'captain' : kind.replace('bandit_', '');
      meta.eventCaravan = ev.id;
      meta.alert = true;
      meta.eventAttackAt = 0;
      this.mobMeta[id] = meta;
      ev.enemyIds.add(id);
    }
    ev.caravan.enemiesRemaining = ev.enemyIds.size;
    this.sendSpace(ev.id, 'eventCaravanWave', {
      wave,
      totalWaves: ev.caravan.totalWaves,
      enemies: ev.caravan.enemiesRemaining,
      captain: wave >= ev.caravan.totalWaves,
    });
    this.broadcastEventStatus(true);
  }
  onCaravanEventMobKilled(client, mobId, meta) {
    const ev = this.currentEventInstance() || this.serverEvent;
    if (!ev || ev.kind !== EVENT_CARAVAN.kind || ev.phase !== 'active' || !meta || meta.eventCaravan !== ev.id) return;
    ev.enemyIds.delete(String(mobId));
    ev.caravan.enemiesRemaining = ev.enemyIds.size;
    const part = client && ev.participants.get(client.sessionId);
    if (part) part.kills = (part.kills | 0) + 1;
    this.broadcastEventStatus(true);
  }
  clearCaravanDowned(ev, sid, rescued, helperSid) {
    const part = ev && ev.participants.get(sid);
    const client = this.clients.find(c => c.sessionId === sid);
    if (!part || !client) return;
    part.downed = false;
    part.downedUntil = 0;
    part.reviveMs = 0;
    const hp = this.ensurePlayerHp(client);
    hp.hp = hp.max;
    client.send('hurt', { n: -hp.max, reason: rescued ? 'event_revive' : 'event_respawn' });
    if (!rescued) {
      part.deaths = (part.deaths | 0) + 1;
      this.teleportCaravanPlayer(client, {
        x: ev.caravan.x - 3,
        y: W.TOWN.G + 1.05,
        z: ev.caravan.z,
      }, 'respawn', ev);
    }
    if (rescued && helperSid) {
      const helper = ev.participants.get(helperSid);
      if (helper) helper.revives = (helper.revives | 0) + 1;
    }
    this.sendSpace(ev.id, 'eventCaravanRevived', {
      sid,
      name: this.playerName(sid),
      helperSid: helperSid || '',
      helperName: this.playerName(helperSid),
      rescued: !!rescued,
    });
  }
  tickCaravanEvent(ev, now) {
    if (!ev || ev.kind !== EVENT_CARAVAN.kind || ev.phase !== 'active') return;
    const dt = Math.max(0, Math.min(1, (now - (ev.lastCaravanTickAt || now)) / 1000));
    ev.lastCaravanTickAt = now;
    const wagon = this.state.mobs.get(ev.caravan.wagonId);
    if (!wagon) return this.endCaravanEvent(false, 'wagon');
    ev.caravan.hp = Math.max(0, Math.round(wagon.hp));
    ev.caravan.maxHp = Math.max(1, Math.round(wagon.maxHp));
    ev.enemyIds = new Set([...ev.enemyIds].filter(id => {
      const mob = this.state.mobs.get(id);
      return !!(mob && mob.hp > 0);
    }));
    ev.caravan.enemiesRemaining = ev.enemyIds.size;

    for (const [sid, part] of ev.participants) {
      const client = this.clients.find(c => c.sessionId === sid);
      const p = this.state.players.get(sid);
      if (!client || !p) continue;
      if (part.downed) {
        let helperSid = '';
        for (const [otherSid, otherPart] of ev.participants) {
          if (otherSid === sid || otherPart.downed) continue;
          const other = this.state.players.get(otherSid);
          if (other && Math.hypot(other.x - p.x, other.z - p.z) <= 3.2) { helperSid = otherSid; break; }
        }
        part.reviveMs = helperSid ? Math.min(2000, (part.reviveMs || 0) + dt * 1000) : Math.max(0, (part.reviveMs || 0) - dt * 500);
        if (part.reviveMs >= 2000) this.clearCaravanDowned(ev, sid, true, helperSid);
        else if (now >= (part.downedUntil || 0)) this.clearCaravanDowned(ev, sid, false, '');
        continue;
      }
      if (p.x < ev.arena.minX || p.x > ev.arena.maxX || p.z < ev.arena.minZ || p.z > ev.arena.maxZ || p.y < W.TOWN.G - 6) {
        this.teleportCaravanPlayer(client, { x: ev.caravan.x - 4, y: W.TOWN.G + 1.05, z: ev.caravan.z }, 'arena', ev);
      }
    }

    for (const id of ev.enemyIds) {
      const mob = this.state.mobs.get(id), meta = this.mobMeta[id];
      if (!mob || !meta) continue;
      const ranged = mob.kind === 'bandit_archer';
      let target = null, targetSid = '', best = ranged ? 14 : 8;
      for (const [sid, part] of ev.participants) {
        if (part.downed) continue;
        const p = this.state.players.get(sid);
        if (!p) continue;
        const distance = Math.hypot(p.x - mob.x, p.z - mob.z);
        if (distance < best) { best = distance; target = p; targetSid = sid; }
      }
      const tx = target ? target.x : wagon.x, tz = target ? target.z : wagon.z;
      const distance = Math.hypot(tx - mob.x, tz - mob.z) || 1;
      const attackRange = ranged ? 9 : meta.banditCaptain ? 2.5 : 1.7;
      if (distance > attackRange) {
        const step = Math.min(distance, (meta.speed || 1.5) * dt);
        mob.x += (tx - mob.x) / distance * step;
        mob.z += (tz - mob.z) / distance * step;
        mob.y = W.TOWN.G + 1.05;
        mob.yaw = Math.atan2(tx - mob.x, tz - mob.z);
        mob.state = ranged && distance < 13 ? 'draw' : 'chase';
      } else if (now >= (meta.eventAttackAt || 0)) {
        meta.eventAttackAt = now + (ranged ? 2200 : 1500);
        mob.state = meta.banditCaptain ? 'bruteWind' : ranged ? 'draw' : 'attack';
        if (target && targetSid && ranged) {
          // Archers loose a genuine server-simulated arrow (dodgeable, like every other
          // ranged enemy) instead of instant damage; lead the shot with tracked velocity.
          const v = this.pvel.get(targetSid) || { x: 0, z: 0 };
          const lead = distance / 16 * .5;
          mob.yaw = Math.atan2(tx - mob.x, tz - mob.z);
          this.fireArrow(mob, ev.id, target.x + v.x * lead, target.y + 1.4, target.z + v.z * lead,
            Math.max(2, Math.round((meta.dmg || 4) * .65)), false);
        } else if (target && targetSid) {
          const targetClient = this.clients.find(c => c.sessionId === targetSid);
          if (targetClient) this.hurtPlayer(targetClient, Math.max(2, Math.round((meta.dmg || 4) * .65)), 'caravan_bandit');
        } else {
          wagon.hp = Math.max(0, wagon.hp - Math.max(2, Math.round(meta.dmg || 4)));
          ev.caravan.hp = Math.round(wagon.hp);
        }
      }
    }

    if (wagon.hp <= 0) return this.endCaravanEvent(false, 'wagon');
    if (ev.enemyIds.size) {
      ev.caravan.state = ev.caravan.wave >= ev.caravan.totalWaves ? 'captain' : 'ambushed';
      return;
    }
    ev.caravan.state = 'moving';
    const targetProgress = Math.min(1, ev.caravan.wave / ev.caravan.totalWaves);
    ev.caravan.progress = Math.min(targetProgress, ev.caravan.progress + dt * .045);
    ev.caravan.x = ev.arena.startX + (ev.arena.endX - ev.arena.startX) * ev.caravan.progress;
    wagon.x = ev.caravan.x; wagon.y = ev.caravan.y; wagon.z = ev.caravan.z; wagon.state = 'moving';
    if (ev.caravan.progress + .0001 < targetProgress) return;
    if (ev.caravan.wave >= ev.caravan.totalWaves) return this.endCaravanEvent(true, 'secured');
    this.spawnCaravanWave(ev, ev.caravan.wave + 1);
  }
  eventSpaceSolid(dgn) {
    const ev = this.currentEventInstance() || this.serverEvent;
    if (!dgn || !ev || ev.id !== dgn || ev.kind !== EVENT_CARAVAN.kind || !ev.arena) return null;
    return (x, y, z) => y <= W.TOWN.G
      || x <= ev.arena.minX || x >= ev.arena.maxX
      || z <= ev.arena.minZ || z >= ev.arena.maxZ;
  }
  cleanupCaravanMobs(ev, keepWagon) {
    if (!ev) return;
    for (const id of ev.enemyIds || []) {
      this.state.mobs.delete(id);
      delete this.mobMeta[id];
    }
    if (!keepWagon && ev.caravan && ev.caravan.wagonId) {
      this.state.mobs.delete(ev.caravan.wagonId);
      delete this.mobMeta[ev.caravan.wagonId];
      ev.caravan.wagonId = '';
    }
    if (ev.enemyIds) ev.enemyIds.clear();
    if (ev.caravan) ev.caravan.enemiesRemaining = 0;
  }
  endCaravanEvent(success, reason) {
    const ev = this.currentEventInstance() || this.serverEvent;
    if (!ev || ev.kind !== EVENT_CARAVAN.kind || ev.phase === 'ended') return;
    ev.phase = 'ended';
    ev.cleanupAt = Date.now() + 60000;
    ev.returnAt = Date.now() + EVENT_RESULTS_MS;
    ev.caravan.state = success ? 'secured' : 'wrecked';
    const healthPct = Math.max(0, Math.min(1, ev.caravan.hp / Math.max(1, ev.caravan.maxHp)));
    const tokens = success ? (healthPct >= .8 ? 3 : healthPct >= .5 ? 2 : 1) : 0;
    this.cleanupCaravanMobs(ev, true);
    const wagon = this.state.mobs.get(ev.caravan.wagonId);
    if (wagon) {
      wagon.kind = success ? 'caravan_wagon' : 'caravan_wreck';
      wagon.hp = wagon.maxHp = Math.max(1, ev.caravan.hp);
    }
    for (const [sid, part] of ev.participants) {
      const client = this.clients.find(c => c.sessionId === sid);
      if (!client) continue;
      part.returnAt = ev.returnAt;
      let xp = 0;
      if (success) {
        const rec = this.profileFor(client);
        xp = rec ? hunterXpForActivity(rec.prof.S.lvl, 'event') : 0;
        this.awardGrant(client, { source: 'event', event: EVENT_CARAVAN.name, xp, items: [{ id: I.LEGEND_TOKEN, count: tokens }] });
        this.recordEventProgress(client);
        ev.completed.add(sid);
        client.send('eventComplete', this.eventPayload(client));
      } else {
        client.send('eventFailed', { reason: reason || 'wagon', name: ev.name, id: ev.id });
      }
      client.send('eventResult', this.eventResultPayload(ev, sid, success ? 'complete' : 'failed', {
        xp,
        tokens,
      }, {
        reason: reason || '',
        caravanHealthPct: Math.round(healthPct * 100),
        revives: part.revives | 0,
      }));
    }
    this.broadcast('chat', {
      name: '[Event]',
      text: success
        ? 'Caravan Defence complete. The merchants reached safety with ' + Math.round(healthPct * 100) + '% wagon health.'
        : 'Caravan Defence failed. The wagon was lost to the bandits.',
    });
    this.broadcastEventStatus(true);
  }
  armEventCountdown(ev, now) {
    if (!ev || ev.phase !== 'starting' || ev.goAt) return;
    ev.goAt = now + EVENT_START_MS;
    ev.startsAt = ev.goAt;
    ev.endsAt = ev.goAt + (ev.kind === EVENT_KING.kind ? KING_ACTIVE_MS : ev.kind === EVENT_CARAVAN.kind ? CARAVAN_ACTIVE_MS : EVENT_ACTIVE_MS);
    this.broadcastEventStatus(true);
  }
  cancelStagedEvent(ev, reason, now = Date.now()) {
    if (!ev || (ev.phase !== 'queue' && ev.phase !== 'starting')) return;
    ev.phase = 'ended';
    for (const [sid, part] of ev.participants || []) {
      const client = this.clients.find(c => c.sessionId === sid);
      if (!client) continue;
      client.send('eventCancelled', { id: ev.id, name: ev.name, reason: reason || 'players' });
      if (ev.kind === EVENT_KING.kind) this.teleportKingPlayer(client, part.returnPos, 'cancel', ev);
      else if (ev.kind === EVENT_CARAVAN.kind) this.teleportCaravanPlayer(client, part.returnPos, 'cancel', ev);
      else this.teleportEventPlayer(client, part.returnPos, 'cancel', ev);
    }
    ev.cleanupAt = now + 60000;
    this.broadcast('chat', { name: '[Event]', text: ev.name + ' cancelled — not enough ready hunters.' });
    this.activeEventInstanceId = '';
    this.serverEvent = this.createIdleEvent(now + this.randomEventDelay(), this.pickNextServerEvent().kind);
    this.broadcastEventStatus(true);
  }
  tickStartingEvent(ev, now) {
    const minimum = this.minParticipantsForEvent(ev);
    const teamCount = ev.kind === EVENT_KING.kind
      ? new Set([...ev.participants.values()].map(part => part.teamId)).size
      : 1;
    if (ev.participants.size < minimum || teamCount < 2 && ev.kind === EVENT_KING.kind)
      return this.cancelStagedEvent(ev, 'players', now);
    if (ev.goAt) {
      if (now >= ev.goAt) this.beginStagedEvent(ev, now);
      return;
    }
    const ready = [...ev.participants.values()].filter(part => part.ready).length;
    if (ready >= ev.participants.size) return this.armEventCountdown(ev, now);
    if (now < (ev.readyDeadline || 0)) return;
    for (const [sid, part] of [...ev.participants.entries()]) {
      if (part.ready) continue;
      const client = this.clients.find(c => c.sessionId === sid);
      if (client) {
        client.send('eventAfk', { id: ev.id, name: ev.name });
        if (ev.kind === EVENT_KING.kind) this.teleportKingPlayer(client, part.returnPos, 'afk', ev);
        else if (ev.kind === EVENT_CARAVAN.kind) this.teleportCaravanPlayer(client, part.returnPos, 'afk', ev);
        else this.teleportEventPlayer(client, part.returnPos, 'afk', ev);
      }
      ev.participants.delete(sid);
    }
    const remainingTeams = ev.kind === EVENT_KING.kind
      ? new Set([...ev.participants.values()].map(part => part.teamId)).size
      : 1;
    if (ev.participants.size < minimum || remainingTeams < 2 && ev.kind === EVENT_KING.kind)
      return this.cancelStagedEvent(ev, 'afk', now);
    this.armEventCountdown(ev, now);
  }
  beginStagedEvent(ev, now) {
    if (!ev || ev.phase !== 'starting') return;
    ev.phase = 'active';
    ev.startedAt = now;
    ev.endsAt = now + (ev.kind === EVENT_KING.kind ? KING_ACTIVE_MS : ev.kind === EVENT_CARAVAN.kind ? CARAVAN_ACTIVE_MS : EVENT_ACTIVE_MS);
    if (ev.kind === EVENT_KING.kind) {
      ev.lastScoreAt = now;
      const firstSid = [...ev.participants.keys()][(Math.random() * ev.participants.size) | 0];
      if (firstSid) this.setKingCrownHolder(ev, firstSid, 'start');
    } else if (ev.kind === EVENT_CARAVAN.kind) {
      ev.lastCaravanTickAt = now;
      this.spawnCaravanWagon(ev);
      this.spawnCaravanWave(ev, 1);
    } else {
      for (const part of ev.participants.values()) part.startedAt = now;
    }
    for (const sid of ev.participants.keys()) {
      const client = this.clients.find(c => c.sessionId === sid);
      if (client) client.send('eventGo', this.eventPayload(client));
    }
    this.broadcast('chat', {
      name: '[Event]',
      text: ev.kind === EVENT_KING.kind
        ? 'King of the Hill has begun. Hold the crown for the longest time.'
        : ev.kind === EVENT_CARAVAN.kind
          ? 'Caravan Defence has begun. Protect the wagon through every ambush.'
          : 'Parkour has begun. Reach the finish before the timer ends.',
    });
    this.broadcastEventStatus(true);
  }
  eventMovementLocked(sid, now = Date.now()) {
    const ev = this.currentEventInstance() || this.serverEvent;
    if (!ev || !ev.participants || !ev.participants.has(sid)) return false;
    if (ev.phase === 'starting') return true;
    return !!(ev.kind === EVENT_CARAVAN.kind && ev.phase === 'active' && ev.participants.get(sid).downed);
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
    if (!attacker || !target || attacker.dim !== 'event' || target.dim !== 'event' || attacker.dgn !== ev.id || target.dgn !== ev.id) return;
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
    if (!ev || ev.phase !== 'active' || !ev.participants.has(client.sessionId)) return false;
    if (ev.kind === EVENT_CARAVAN.kind) {
      const part = ev.participants.get(client.sessionId);
      if (part.downed) return true;
      part.downed = true;
      part.downedUntil = Date.now() + 10000;
      part.reviveMs = 0;
      hp.hp = hp.max;
      client.send('hurt', { n: -hp.max, reason: 'event_downed' });
      this.sendSpace(ev.id, 'eventCaravanDowned', {
        sid: client.sessionId,
        name: p.name || 'Hunter',
        reviveBy: part.downedUntil,
      });
      this.broadcastEventStatus(true);
      return true;
    }
    if (ev.kind !== EVENT_KING.kind) return false;
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
      if (!this.pointInKingArena(ev, p.x, p.z) || p.y < W.TOWN.G - 8) this.teleportKingPlayer(client, this.kingSpawnPos(ev, sid), 'arena', ev);
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
    ev.returnAt = Date.now() + EVENT_RESULTS_MS;
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
      part.returnAt = ev.returnAt;
      let reward = { xp: 0, tokens: 0 };
      const won = !!(winner && part.teamId === winner.teamId);
      if (winner && part.teamId === winner.teamId) {
        const rec = this.profileFor(client);
        const xp = rec ? hunterXpForActivity(rec.prof.S.lvl, 'event') : 0;
        this.awardGrant(client, { source: 'event', event: EVENT_KING.name, xp, items: [{ id: I.LEGEND_TOKEN, count: EVENT_REWARD_TOKENS }] });
        this.recordEventProgress(client);
        reward = { xp, tokens: EVENT_REWARD_TOKENS };
      }
      client.send('eventFailed', { reason: reason || 'timeout', name: ev.name, id: ev.id, leaderboard: this.eventLeaderboardPayload(ev), winner: winner && winner.name || '' });
      client.send('eventResult', this.eventResultPayload(ev, sid, won ? 'win' : 'loss', reward, {
        reason: reason || 'timeout',
        winner: winner && winner.name || '',
      }));
    }
    this.broadcast('chat', { name: '[Event]', text: winner ? 'King of the Hill ended. ' + winner.name + ' held the crown longest.' : 'King of the Hill ended.' });
    this.broadcastEventStatus(true);
  }
  returnFinishedEventPlayers(ev, now) {
    if (!ev || !ev.participants) return;
    for (const [sid, part] of ev.participants) {
      if (part.returned || !part.returnAt || now < part.returnAt) continue;
      const client = this.clients.find(c => c.sessionId === sid);
      if (client) {
        if (ev.kind === EVENT_KING.kind) this.teleportKingPlayer(client, part.returnPos, 'return', ev);
        else if (ev.kind === EVENT_CARAVAN.kind) this.teleportCaravanPlayer(client, part.returnPos, 'return', ev);
        else this.teleportEventPlayer(client, part.returnPos, 'return', ev);
      }
      part.returned = true;
    }
    if (ev.phase !== 'ended') return;
    const waiting = [...ev.participants.values()].some(part => !part.returned && part.returnAt && now < part.returnAt);
    if (waiting) return;
    if (ev.kind === EVENT_CARAVAN.kind) this.cleanupCaravanMobs(ev, false);
    this.activeEventInstanceId = '';
    this.serverEvent = this.createIdleEvent(now + this.randomEventDelay(), this.pickNextServerEvent().kind);
    this.broadcastEventStatus(true);
  }
  tickServerEvent(now) {
    if (!this.serverEvent) this.serverEvent = this.createIdleEvent(now + EVENT_FIRST_DELAY_MS);
    if (this.eventInstances) {
      for (const [id, inst] of this.eventInstances) {
        if (inst.phase === 'ended' && inst.cleanupAt && inst.cleanupAt <= now) {
          if (inst.kind === EVENT_CARAVAN.kind) this.cleanupCaravanMobs(inst, false);
          this.eventInstances.delete(id);
        }
      }
    }
    const ev = this.currentEventInstance() || this.serverEvent;
    if (ev && ev.participants) this.returnFinishedEventPlayers(ev, now);
    if (ev !== (this.currentEventInstance() || this.serverEvent)) return;
    if (ev.phase === 'idle' && now >= ev.nextAt) this.announceServerEvent(now, ev.kind);
    else if (ev.phase === 'queue' && now >= ev.startsAt) {
      const minimum = this.minParticipantsForEvent(ev);
      const eligible = [...ev.queue].filter(sid => {
        const p = this.state.players.get(sid);
        return p && !p.dgn && this.clients.some(client => client.sessionId === sid);
      });
      const lacksTeams = ev.kind === EVENT_KING.kind && eligible.length >= minimum && this.kingEventTeamCount(eligible) < 2;
      if (eligible.length < minimum || lacksTeams) {
        ev.waitingForPlayers = true;
        ev.waitingReason = lacksTeams ? 'teams' : 'players';
        ev.startsAt = now + EVENT_QUEUE_RETRY_MS;
        this.broadcastEventStatus(true);
      } else if (!ev.queueExtended && ev.queue.size >= EVENT_QUEUE_NEAR_FULL && now - (ev.lastJoinAt || 0) <= EVENT_QUEUE_RETRY_MS) {
        ev.queueExtended = true;
        ev.startsAt = now + EVENT_QUEUE_EXTENSION_MS;
        this.broadcast('chat', { name: '[Event]', text: ev.name + ' queue extended for a final call.' });
        this.broadcastEventStatus(true);
      } else if (ev.kind === EVENT_KING.kind) this.startKingEvent(now);
      else if (ev.kind === EVENT_CARAVAN.kind) this.startCaravanEvent(now);
      else this.startParkourEvent(now);
    }
    else if (ev.phase === 'starting') this.tickStartingEvent(ev, now);
    else if (ev.phase === 'active') {
      if (now >= ev.endsAt) {
        if (ev.kind === EVENT_KING.kind) this.endKingEvent('timeout');
        else if (ev.kind === EVENT_CARAVAN.kind) this.endCaravanEvent(false, 'timeout');
        else this.endParkourEvent('timeout');
      }
      else if (ev.kind === EVENT_KING.kind) this.tickKingEvent(ev, now);
      else if (ev.kind === EVENT_CARAVAN.kind) this.tickCaravanEvent(ev, now);
      else if (ev.course) {
        for (const [sid, part] of ev.participants) {
          if (ev.completed.has(sid)) continue;
          const client = this.clients.find(c => c.sessionId === sid);
          const p = this.state.players.get(sid);
          if (!client || !p) continue;
          const checkpoints = ev.course.checkpoints || [];
          const nextCheckpoint = checkpoints[part.checkpointsPassed | 0];
          if (nextCheckpoint && Math.hypot(p.x - nextCheckpoint.x, p.z - nextCheckpoint.z) < 2.5 && Math.abs(p.y - nextCheckpoint.y) < 3) {
            part.checkpointsPassed = (part.checkpointsPassed | 0) + 1;
            if (!Array.isArray(part.splitTimes)) part.splitTimes = [];
            const splitMs = Math.max(0, now - (part.startedAt || ev.startsAt || now));
            part.splitTimes.push(splitMs);
            client.send('eventCheckpoint', {
              index: part.checkpointsPassed,
              total: checkpoints.length,
              ms: splitMs,
              x: nextCheckpoint.x,
              y: nextCheckpoint.y,
              z: nextCheckpoint.z,
            });
            this.sendEventStatus(client);
          }
          const f = ev.course.finish;
          if ((part.checkpointsPassed | 0) >= checkpoints.length && Math.hypot(p.x - f.x, p.z - f.z) < 2.2 && Math.abs(p.y - f.y) < 3) {
            this.completeParkourPlayer(client);
            continue;
          }
          const outside = p.x < ev.course.minX || p.x > ev.course.maxX || p.z < ev.course.minZ || p.z > ev.course.maxZ;
          if (p.y < ev.course.fallY || outside) {
            part.resets = (part.resets | 0) + 1;
            const respawn = part.checkpointsPassed > 0 ? checkpoints[part.checkpointsPassed - 1] : ev.course.start;
            this.teleportEventPlayer(client, respawn, 'reset', ev);
          }
        }
        if (ev.participants.size > 0 && ev.completed.size >= ev.participants.size) this.endParkourEvent('complete');
      }
    }
    this.broadcastEventStatus(false);
  }
  isEventProtectedBlock(x, y, z) {
    return false;
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
