const { monitorEventLoopDelay } = require('node:perf_hooks');

const activeRooms = new Set();
const loop = monitorEventLoopDelay({ resolution: 20 });
loop.enable();

function registerRoom(room, type, metadata = {}) {
  if (!room) return room;
  room.__metricsRegistry = {
    type: type || 'room',
    metadata: { ...metadata },
    createdAt: Date.now(),
  };
  activeRooms.add(room);
  return room;
}

function unregisterRoom(room) {
  if (!room) return;
  activeRooms.delete(room);
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function addMetricTotals(target, source) {
  for (const [kind, value] of Object.entries(source || {})) {
    target[kind] = round2((target[kind] || 0) + (Number(value) || 0));
  }
}

function roomSnapshot(room) {
  const registration = room.__metricsRegistry || {};
  const metrics = typeof room.metricsSnapshot === 'function' ? room.metricsSnapshot() : {};
  const type = registration.type || 'room';
  return {
    roomId: room.roomId || '',
    type,
    shardId: room.shardId || registration.metadata && registration.metadata.shardId || '',
    gateId: room.instance && room.instance.id || registration.metadata && registration.metadata.gateId || '',
    maxClients: room.maxClients || 0,
    uptimeMs: Date.now() - (registration.createdAt || Date.now()),
    ...metrics,
  };
}

function summarizeRooms(rooms) {
  const totals = {
    rooms: rooms.length,
    clients: 0,
    players: 0,
    mobs: 0,
    instances: 0,
    rejectedMessages: 0,
    inboundMessages: 0,
    outboundMessages: 0,
    outboundBytes: 0,
    outboundBytesPerSecond: 0,
    outboundBytesByKind: {},
    outboundBytesPerSecondByKind: {},
    outboundMessagesPerSecondByType: {},
    outboundMessageBytesByType: {},
    outboundMessageBytesPerSecondByType: {},
    outboundPeakClientBytesPerSecond: 0,
    disconnects: 0,
    unexpectedDisconnects: 0,
    persistenceOperations: 0,
    persistenceFailures: 0,
    tickOverBudget: 0,
    dungeonMobs: 0,
    visibleMobLinks: 0,
    hiddenMobLinksAvoided: 0,
    bossVisibleLinks: 0,
    dungeonPlayers: 0,
    visiblePlayerLinks: 0,
    hiddenPlayerLinksAvoided: 0,
    selfPlayerLinks: 0,
    downedPlayerLinks: 0,
    interestViewAdds: 0,
    interestViewRemoves: 0,
    dungeonClients: 0,
    dungeonFxSent: 0,
    dungeonFxSkipped: 0,
    dungeonFxFilteredEvents: 0,
  };
  for (const room of rooms) {
    totals.clients += room.connectedClients || 0;
    totals.players += room.players || 0;
    totals.mobs += room.mobs || 0;
    totals.instances += room.instances || 0;
    totals.rejectedMessages += room.rejectedMessages || 0;
    totals.inboundMessages += room.inboundMessages || 0;
    totals.outboundMessages += room.outboundMessages || 0;
    totals.outboundBytes += room.outboundBytes || 0;
    totals.outboundBytesPerSecond += room.outboundBytesPerSecond || 0;
    addMetricTotals(totals.outboundBytesByKind, room.outboundBytesByKind);
    addMetricTotals(totals.outboundBytesPerSecondByKind, room.outboundBytesPerSecondByKind);
    addMetricTotals(totals.outboundMessagesPerSecondByType, room.outboundMessagesPerSecondByType);
    addMetricTotals(totals.outboundMessageBytesByType, room.outboundMessageBytesByType);
    addMetricTotals(totals.outboundMessageBytesPerSecondByType, room.outboundMessageBytesPerSecondByType);
    totals.outboundPeakClientBytesPerSecond = Math.max(totals.outboundPeakClientBytesPerSecond, room.outboundPeakClientBytesPerSecond || 0);
    totals.disconnects += room.disconnects || 0;
    totals.unexpectedDisconnects += room.unexpectedDisconnects || 0;
    totals.persistenceOperations += room.persistenceOperations || 0;
    totals.persistenceFailures += room.persistenceFailures || 0;
    totals.tickOverBudget += room.tickOverBudget || 0;
    totals.dungeonMobs += room.dungeonMobs || 0;
    totals.visibleMobLinks += room.visibleMobLinks || 0;
    totals.hiddenMobLinksAvoided += room.hiddenMobLinksAvoided || 0;
    totals.bossVisibleLinks += room.bossVisibleLinks || 0;
    totals.dungeonPlayers += room.dungeonPlayers || 0;
    totals.visiblePlayerLinks += room.visiblePlayerLinks || 0;
    totals.hiddenPlayerLinksAvoided += room.hiddenPlayerLinksAvoided || 0;
    totals.selfPlayerLinks += room.selfPlayerLinks || 0;
    totals.downedPlayerLinks += room.downedPlayerLinks || 0;
    totals.interestViewAdds += room.interestViewAdds || 0;
    totals.interestViewRemoves += room.interestViewRemoves || 0;
    if (room.type === 'dungeon') totals.dungeonClients += room.connectedClients || 0;
    totals.dungeonFxSent += room.dungeonFxSent || 0;
    totals.dungeonFxSkipped += room.dungeonFxSkipped || 0;
    totals.dungeonFxFilteredEvents += room.dungeonFxFilteredEvents || 0;
  }
  totals.avgVisibleMobsPerDungeonClient = totals.dungeonClients ? round2(totals.visibleMobLinks / totals.dungeonClients) : 0;
  totals.avgVisiblePlayersPerDungeonClient = totals.dungeonClients ? round2(totals.visiblePlayerLinks / totals.dungeonClients) : 0;
  totals.outboundBytesPerClientPerSecond = totals.clients ? round2(totals.outboundBytesPerSecond / totals.clients) : 0;
  return totals;
}

function groupByShard(rooms) {
  return rooms.filter(room => room.type === 'overworld').map(room => ({
    shardId: room.shardId || 'main',
    roomId: room.roomId,
    clients: room.connectedClients || 0,
    players: room.players || 0,
    maxClients: room.maxClients || 0,
    mobs: room.mobs || 0,
    tickAvgMs: room.tickAvgMs || 0,
    tickMaxMs: room.tickMaxMs || 0,
    persistenceFailures: room.persistenceFailures || 0,
    rejectedMessages: room.rejectedMessages || 0,
    inboundMessagesPerSecond: room.inboundMessagesPerSecond || 0,
    outboundMessagesPerSecond: room.outboundMessagesPerSecond || 0,
    outboundBytesPerSecond: room.outboundBytesPerSecond || 0,
    outboundBytesPerSecondByKind: { ...(room.outboundBytesPerSecondByKind || {}) },
    outboundMessagesPerSecondByType: { ...(room.outboundMessagesPerSecondByType || {}) },
    outboundMessageBytesPerSecondByType: { ...(room.outboundMessageBytesPerSecondByType || {}) },
    outboundBytesPerClientPerSecond: room.outboundBytesPerClientPerSecond || 0,
    outboundPeakClientBytesPerSecond: room.outboundPeakClientBytesPerSecond || 0,
    disconnects: room.disconnects || 0,
    unexpectedDisconnects: room.unexpectedDisconnects || 0,
  })).sort((a, b) => a.shardId.localeCompare(b.shardId));
}

function groupByDungeon(rooms) {
  return rooms.filter(room => room.type === 'dungeon').map(room => ({
    gateId: room.gateId,
    roomId: room.roomId,
    clients: room.connectedClients || 0,
    players: room.players || 0,
    maxClients: room.maxClients || 0,
    mobs: room.mobs || 0,
    tickAvgMs: room.tickAvgMs || 0,
    tickMaxMs: room.tickMaxMs || 0,
    persistenceFailures: room.persistenceFailures || 0,
    rejectedMessages: room.rejectedMessages || 0,
    inboundMessagesPerSecond: room.inboundMessagesPerSecond || 0,
    outboundMessagesPerSecond: room.outboundMessagesPerSecond || 0,
    outboundBytesPerSecond: room.outboundBytesPerSecond || 0,
    outboundBytesPerSecondByKind: { ...(room.outboundBytesPerSecondByKind || {}) },
    outboundMessagesPerSecondByType: { ...(room.outboundMessagesPerSecondByType || {}) },
    outboundMessageBytesPerSecondByType: { ...(room.outboundMessageBytesPerSecondByType || {}) },
    outboundBytesPerClientPerSecond: room.outboundBytesPerClientPerSecond || 0,
    outboundPeakClientBytesPerSecond: room.outboundPeakClientBytesPerSecond || 0,
    disconnects: room.disconnects || 0,
    unexpectedDisconnects: room.unexpectedDisconnects || 0,
    dungeonMobs: room.dungeonMobs || 0,
    visibleMobLinks: room.visibleMobLinks || 0,
    avgVisibleMobsPerClient: room.avgVisibleMobsPerClient || 0,
    hiddenMobLinksAvoided: room.hiddenMobLinksAvoided || 0,
    bossVisibleLinks: room.bossVisibleLinks || 0,
    bossMobs: room.bossMobs || 0,
    dungeonPlayers: room.dungeonPlayers || 0,
    visiblePlayerLinks: room.visiblePlayerLinks || 0,
    avgVisiblePlayersPerClient: room.avgVisiblePlayersPerClient || 0,
    hiddenPlayerLinksAvoided: room.hiddenPlayerLinksAvoided || 0,
    selfPlayerLinks: room.selfPlayerLinks || 0,
    downedPlayerLinks: room.downedPlayerLinks || 0,
    interestViewAdds: room.interestViewAdds || 0,
    interestViewRemoves: room.interestViewRemoves || 0,
    interestViewAddsPerSecond: room.interestViewAddsPerSecond || 0,
    interestViewRemovesPerSecond: room.interestViewRemovesPerSecond || 0,
    dungeonFxSent: room.dungeonFxSent || 0,
    dungeonFxSkipped: room.dungeonFxSkipped || 0,
    dungeonFxFilteredEvents: room.dungeonFxFilteredEvents || 0,
  })).sort((a, b) => a.gateId.localeCompare(b.gateId));
}

function metricsSnapshot() {
  const rooms = [...activeRooms].map(roomSnapshot);
  const memory = process.memoryUsage();
  return {
    at: new Date().toISOString(),
    pid: process.pid,
    uptimeSec: round2(process.uptime()),
    memory: {
      rssMb: round2(memory.rss / 1024 / 1024),
      heapUsedMb: round2(memory.heapUsed / 1024 / 1024),
      heapTotalMb: round2(memory.heapTotal / 1024 / 1024),
      externalMb: round2(memory.external / 1024 / 1024),
    },
    eventLoop: {
      meanMs: round2(loop.mean / 1e6),
      p99Ms: round2(loop.percentile(99) / 1e6),
      maxMs: round2(loop.max / 1e6),
    },
    totals: summarizeRooms(rooms),
    shards: groupByShard(rooms),
    dungeons: groupByDungeon(rooms),
    rooms,
  };
}

function duplicateOverworldShards(shards) {
  const seen = new Set();
  const duplicates = new Set();
  for (const shard of shards || []) {
    const id = shard.shardId || 'main';
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates].sort();
}

function readinessSnapshot({ maxEventLoopP99Ms = 500, maxHeapUsedMb = 850 } = {}) {
  const snapshot = metricsSnapshot();
  const duplicateShards = duplicateOverworldShards(snapshot.shards);
  const issues = [];
  if (duplicateShards.length) issues.push({ code: 'duplicate_overworld_shard', shards: duplicateShards });
  if (snapshot.eventLoop.p99Ms > maxEventLoopP99Ms) {
    issues.push({ code: 'event_loop_lag', p99Ms: snapshot.eventLoop.p99Ms, limitMs: maxEventLoopP99Ms });
  }
  if (snapshot.memory.heapUsedMb > maxHeapUsedMb) {
    issues.push({ code: 'heap_pressure', heapUsedMb: snapshot.memory.heapUsedMb, limitMb: maxHeapUsedMb });
  }
  return {
    ok: issues.length === 0,
    at: snapshot.at,
    pid: snapshot.pid,
    uptimeSec: snapshot.uptimeSec,
    issues,
    eventLoop: snapshot.eventLoop,
    memory: snapshot.memory,
    totals: {
      rooms: snapshot.totals.rooms,
      clients: snapshot.totals.clients,
      players: snapshot.totals.players,
      mobs: snapshot.totals.mobs,
      persistenceFailures: snapshot.totals.persistenceFailures,
      tickOverBudget: snapshot.totals.tickOverBudget,
      unexpectedDisconnects: snapshot.totals.unexpectedDisconnects,
      outboundBytesPerClientPerSecond: snapshot.totals.outboundBytesPerClientPerSecond,
    },
    shards: snapshot.shards.map(shard => ({
      shardId: shard.shardId,
      roomId: shard.roomId,
      clients: shard.clients,
      players: shard.players,
      maxClients: shard.maxClients,
      tickAvgMs: shard.tickAvgMs,
      tickMaxMs: shard.tickMaxMs,
      persistenceFailures: shard.persistenceFailures,
      unexpectedDisconnects: shard.unexpectedDisconnects,
    })),
    dungeons: snapshot.dungeons.map(dungeon => ({
      gateId: dungeon.gateId,
      roomId: dungeon.roomId,
      clients: dungeon.clients,
      players: dungeon.players,
      maxClients: dungeon.maxClients,
      tickAvgMs: dungeon.tickAvgMs,
      tickMaxMs: dungeon.tickMaxMs,
      persistenceFailures: dungeon.persistenceFailures,
      unexpectedDisconnects: dungeon.unexpectedDisconnects,
    })),
  };
}

function tokenFromRequest(req) {
  const auth = req && req.headers && String(req.headers.authorization || '');
  const bearer = auth.match(/^Bearer\s+(.+)$/i);
  if (bearer) return bearer[1].trim();
  return req && req.headers && String(req.headers['x-blockcraft-metrics-token'] || '');
}

function metricsHttpHandler({ token = '', production = false, allowMissingToken = false } = {}) {
  return (req, res) => {
    if (!token && (production || !allowMissingToken)) return res.status(403).json({ error: 'metrics token required' });
    if (token && tokenFromRequest(req) !== token) return res.status(401).json({ error: 'unauthorized' });
    res.setHeader('Cache-Control', 'no-store');
    res.json(metricsSnapshot());
  };
}

function readinessHttpHandler(options = {}) {
  return (_req, res) => {
    const snapshot = readinessSnapshot(options);
    res.setHeader('Cache-Control', 'no-store');
    res.status(snapshot.ok ? 200 : 503).json(snapshot);
  };
}

module.exports = {
  registerRoom,
  unregisterRoom,
  metricsSnapshot,
  metricsHttpHandler,
  readinessSnapshot,
  readinessHttpHandler,
  _activeRooms: activeRooms,
};
