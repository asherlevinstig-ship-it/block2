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
    persistenceOperations: 0,
    persistenceFailures: 0,
    tickOverBudget: 0,
  };
  for (const room of rooms) {
    totals.clients += room.connectedClients || 0;
    totals.players += room.players || 0;
    totals.mobs += room.mobs || 0;
    totals.instances += room.instances || 0;
    totals.rejectedMessages += room.rejectedMessages || 0;
    totals.persistenceOperations += room.persistenceOperations || 0;
    totals.persistenceFailures += room.persistenceFailures || 0;
    totals.tickOverBudget += room.tickOverBudget || 0;
  }
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

module.exports = { registerRoom, unregisterRoom, metricsSnapshot, metricsHttpHandler, _activeRooms: activeRooms };
