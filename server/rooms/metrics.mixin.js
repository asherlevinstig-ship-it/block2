// Lightweight, behaviour-free observability. Feeds the open architecture question —
// "is a DungeonRoom split or per-client state filtering ever worth it?" — with real
// numbers instead of guesses, and never alters game state.
//
// The three metrics that decide it:
//   - instances / dgnPlayers : how much concurrent raiding a single room carries.
//   - wastedMobSyncs         : dungeon-mob state syncs that per-instance @filter would
//                              eliminate (problem B). Each dungeon mob currently syncs to
//                              EVERY client; only those inside its instance need it.
//   - tick avg/max (ms)      : the cost of simulating overworld + all instances in one
//                              loop (problem C).
const { Protocol } = require('@colyseus/shared-types');

class MetricsMixin {
  initMetrics() {
    this.messageMetrics = {
      inbound: 0,
      outbound: 0,
      outboundBytes: 0,
      inboundByType: {},
      outboundByType: {},
      outboundEstimatedBytesByType: {},
      outboundMessageBytesByType: {},
      outboundBytesByKind: {},
      windowStartedAt: Date.now(),
      windowInbound: 0,
      windowOutbound: 0,
      windowOutboundByType: {},
      windowOutboundBytes: 0,
      windowOutboundBytesByClient: {},
      windowOutboundBytesByKind: {},
      windowOutboundMessageBytesByType: {},
      disconnects: 0,
      unexpectedDisconnects: 0,
    };
    if (this.__metricsOnMessageWrapped || typeof this.onMessage !== 'function') return;
    const original = this.onMessage.bind(this);
    this.onMessage = (type, handler) => original(type, (client, message) => {
      this.recordInboundMessage(type);
      return handler(client, message);
    });
    this.__metricsOnMessageWrapped = true;
  }

  resetMessageWindow(m, now) {
    if (now - (m.windowStartedAt || now) <= 10000) return;
    m.windowStartedAt = now;
    m.windowInbound = 0;
    m.windowOutbound = 0;
    m.windowOutboundByType = {};
    m.windowOutboundBytes = 0;
    m.windowOutboundBytesByClient = {};
    m.windowOutboundBytesByKind = {};
    m.windowOutboundMessageBytesByType = {};
  }

  recordInboundMessage(type) {
    const m = this.messageMetrics || (this.messageMetrics = { inbound: 0, inboundByType: {}, windowStartedAt: Date.now(), windowInbound: 0 });
    const key = String(type || 'unknown');
    const now = Date.now();
    this.resetMessageWindow(m, now);
    m.inbound = (m.inbound || 0) + 1;
    m.windowInbound = (m.windowInbound || 0) + 1;
    m.inboundByType = m.inboundByType || {};
    m.inboundByType[key] = (m.inboundByType[key] || 0) + 1;
  }

  outboundPayloadBytes(type, payload) {
    let payloadBytes = 0;
    if (payload instanceof Uint8Array || Buffer.isBuffer(payload)) payloadBytes = payload.length;
    else {
      try { payloadBytes = Buffer.byteLength(JSON.stringify(payload === undefined ? null : payload)); }
      catch (_) { payloadBytes = Buffer.byteLength(String(payload || '')); }
    }
    return Buffer.byteLength(String(type || '')) + payloadBytes;
  }

  classifyOutboundBytes(data) {
    const code = data && data.length ? data[0] : -1;
    if (code === Protocol.ROOM_STATE) return 'stateFull';
    if (code === Protocol.ROOM_STATE_PATCH) return 'statePatch';
    if (code === Protocol.ROOM_DATA || code === Protocol.ROOM_DATA_SCHEMA) return 'message';
    if (code === Protocol.ROOM_DATA_BYTES) return 'messageBytes';
    if (code === Protocol.JOIN_ROOM) return 'join';
    if (code === Protocol.PING) return 'ping';
    if (code === Protocol.ERROR) return 'error';
    if (code === Protocol.LEAVE_ROOM) return 'leave';
    return 'other';
  }

  recordOutboundBytes(bytes, sessionId = '', kind = 'other') {
    const n = Math.max(0, Number(bytes) || 0);
    if (!n) return;
    const m = this.messageMetrics || (this.messageMetrics = { windowStartedAt: Date.now() });
    const now = Date.now();
    this.resetMessageWindow(m, now);
    m.outboundBytes = (m.outboundBytes || 0) + n;
    m.windowOutboundBytes = (m.windowOutboundBytes || 0) + n;
    const key = String(kind || 'other');
    const byKind = m.outboundBytesByKind || (m.outboundBytesByKind = {});
    const windowByKind = m.windowOutboundBytesByKind || (m.windowOutboundBytesByKind = {});
    byKind[key] = (byKind[key] || 0) + n;
    windowByKind[key] = (windowByKind[key] || 0) + n;
    if (sessionId) {
      const byClient = m.windowOutboundBytesByClient || (m.windowOutboundBytesByClient = {});
      byClient[sessionId] = (byClient[sessionId] || 0) + n;
    }
  }

  recordOutboundMessage(type, estimatedBytes = 0, sessionId = '', countEstimatedBytesInTotals = true) {
    const m = this.messageMetrics || (this.messageMetrics = { outbound: 0, outboundByType: {}, windowStartedAt: Date.now(), windowOutbound: 0 });
    const key = String(type || 'unknown');
    const now = Date.now();
    this.resetMessageWindow(m, now);
    m.outbound = (m.outbound || 0) + 1;
    m.windowOutbound = (m.windowOutbound || 0) + 1;
    m.outboundByType = m.outboundByType || {};
    m.outboundByType[key] = (m.outboundByType[key] || 0) + 1;
    m.windowOutboundByType = m.windowOutboundByType || {};
    m.windowOutboundByType[key] = (m.windowOutboundByType[key] || 0) + 1;
    if (estimatedBytes > 0) {
      const n = Math.max(0, Number(estimatedBytes) || 0);
      const estimatedByType = m.outboundEstimatedBytesByType || (m.outboundEstimatedBytesByType = {});
      const messageBytesByType = m.outboundMessageBytesByType || (m.outboundMessageBytesByType = {});
      const windowMessageBytesByType = m.windowOutboundMessageBytesByType || (m.windowOutboundMessageBytesByType = {});
      estimatedByType[key] = (estimatedByType[key] || 0) + n;
      messageBytesByType[key] = (messageBytesByType[key] || 0) + n;
      windowMessageBytesByType[key] = (windowMessageBytesByType[key] || 0) + n;
      if (countEstimatedBytesInTotals) this.recordOutboundBytes(n, sessionId, 'estimatedMessage');
    }
  }

  recordClientLeave(_code, unexpected = false) {
    const m = this.messageMetrics || (this.messageMetrics = {});
    m.disconnects = (m.disconnects || 0) + 1;
    if (unexpected) m.unexpectedDisconnects = (m.unexpectedDisconnects || 0) + 1;
  }

  // Roll a tick-duration sample into an EMA + running max. Cheap; called every tick.
  recordTick(ms) {
    const m = this.tickMetrics || (this.tickMetrics = { lastMs: 0, avgMs: 0, maxMs: 0, samples: 0, overBudget: 0 });
    m.lastMs = ms;
    m.samples++;
    m.avgMs = m.avgMs ? m.avgMs * 0.95 + ms * 0.05 : ms;   // ~last-20-ticks weighting
    if (ms > m.maxMs) m.maxMs = ms;
    if (ms > 100) m.overBudget = (m.overBudget || 0) + 1;
  }

  recordPersistence(ms, failed = false, operation = '') {
    const m = this.persistenceMetrics || (this.persistenceMetrics = { operations: 0, failures: 0, lastMs: 0, avgMs: 0, maxMs: 0, byOperation: {} });
    m.operations++;
    if (failed) m.failures++;
    m.lastMs = ms;
    m.avgMs = m.avgMs ? m.avgMs * 0.9 + ms * 0.1 : ms;
    m.maxMs = Math.max(m.maxMs, ms);
    const op = m.byOperation[operation] || (m.byOperation[operation] = { operations: 0, failures: 0 });
    op.operations++;
    if (failed) op.failures++;
  }

  monitorStore(store) {
    if (!store || store.__monitored) return store;
    const room = this;
    return new Proxy(store, {
      get(target, key, receiver) {
        if (key === '__monitored') return true;
        const value = Reflect.get(target, key, receiver);
        if (typeof value !== 'function' || !String(key).startsWith('save')) return value;
        return async (...args) => {
          const started = performance.now();
          try {
            const result = await value.apply(target, args);
            room.recordPersistence(performance.now() - started, false, String(key));
            return result;
          } catch (error) {
            room.recordPersistence(performance.now() - started, true, String(key));
            throw error;
          }
        };
      },
    });
  }

  monitorClient(client) {
    if (!client || client.__metricsSendWrapped) return;
    if (typeof client.raw === 'function' && !client.__metricsRawWrapped) {
      const originalRaw = client.raw.bind(client);
      client.raw = (data, ...args) => {
        this.recordOutboundBytes(data && data.length, client.sessionId, this.classifyOutboundBytes(data));
        return originalRaw(data, ...args);
      };
      client.__metricsRawWrapped = true;
    }
    const original = client.send.bind(client);
    client.send = (type, payload) => {
      const hasRawAccounting = typeof client.raw === 'function';
      this.recordOutboundMessage(type, this.outboundPayloadBytes(type, payload), client.sessionId, !hasRawAccounting);
      if (/Reject$/.test(String(type))) {
        const m = this.rejectionMetrics || (this.rejectionMetrics = { total: 0, byType: {}, byReason: {} });
        const reason = payload && payload.reason || 'unspecified';
        m.total++;
        m.byType[type] = (m.byType[type] || 0) + 1;
        m.byReason[reason] = (m.byReason[reason] || 0) + 1;
      }
      return original(type, payload);
    };
    client.__metricsSendWrapped = true;
  }

  // Pure snapshot of current room load (reads state only — no mutation).
  metricsSnapshot() {
    let owPlayers = 0, dgnPlayers = 0;
    this.state.players.forEach(p => { if (p.dgn) dgnPlayers++; else owPlayers++; });
    const perInst = new Map();
    let owMobs = 0, dgnMobs = 0;
    this.state.mobs.forEach(m => {
      if (m.dgn) { dgnMobs++; perInst.set(m.dgn, (perInst.get(m.dgn) || 0) + 1); }
      else owMobs++;
    });
    const clients = this.clients ? this.clients.length : this.state.players.size;
    let wastedMobSyncs = 0;
    perInst.forEach((count, dgn) => {
      const inst = this.instances && this.instances[dgn];
      const inInst = inst ? inst.playerCount : 0;
      wastedMobSyncs += count * Math.max(0, clients - inInst);
    });
    const tm = this.tickMetrics || {}, pm = this.persistenceMetrics || {}, rm = this.rejectionMetrics || {};
    const mm = this.messageMetrics || {};
    const windowAgeSec = Math.max(1, (Date.now() - (mm.windowStartedAt || Date.now())) / 1000);
    const windowOutboundBytesByClient = Object.values(mm.windowOutboundBytesByClient || {});
    const peakClientBytes = windowOutboundBytesByClient.length ? Math.max(...windowOutboundBytesByClient) : 0;
    const outboundBytesByKind = { ...(mm.outboundBytesByKind || {}) };
    const outboundBytesPerSecondByKind = {};
    for (const [kind, bytes] of Object.entries(mm.windowOutboundBytesByKind || {})) {
      outboundBytesPerSecondByKind[kind] = Math.round(((bytes || 0) / windowAgeSec) * 100) / 100;
    }
    const outboundMessagesPerSecondByType = {};
    for (const [type, count] of Object.entries(mm.windowOutboundByType || {})) {
      outboundMessagesPerSecondByType[type] = Math.round(((count || 0) / windowAgeSec) * 100) / 100;
    }
    const outboundMessageBytesPerSecondByType = {};
    for (const [type, bytes] of Object.entries(mm.windowOutboundMessageBytesByType || {})) {
      outboundMessageBytesPerSecondByType[type] = Math.round(((bytes || 0) / windowAgeSec) * 100) / 100;
    }
    const gameInterest = typeof this.gameInterestSnapshot === 'function' ? this.gameInterestSnapshot() : {};
    return {
      players: this.state.players.size, connectedClients: clients, owPlayers, dgnPlayers,
      instances: Object.keys(this.instances || {}).length,
      mobs: owMobs + dgnMobs, owMobs, dgnMobs, wastedMobSyncs,
      ...gameInterest,
      tickAvgMs: Math.round((tm.avgMs || 0) * 100) / 100,
      tickMaxMs: Math.round((tm.maxMs || 0) * 100) / 100,
      tickOverBudget: tm.overBudget || 0,
      persistenceOperations: pm.operations || 0,
      persistenceFailures: pm.failures || 0,
      persistenceAvgMs: Math.round((pm.avgMs || 0) * 100) / 100,
      persistenceMaxMs: Math.round((pm.maxMs || 0) * 100) / 100,
      persistenceByOperation: { ...(pm.byOperation || {}) },
      rejectedMessages: rm.total || 0,
      rejectedByType: { ...(rm.byType || {}) },
      rejectedByReason: { ...(rm.byReason || {}) },
      inboundMessages: mm.inbound || 0,
      outboundMessages: mm.outbound || 0,
      outboundBytes: mm.outboundBytes || 0,
      outboundBytesByKind,
      inboundMessagesPerSecond: Math.round(((mm.windowInbound || 0) / windowAgeSec) * 100) / 100,
      outboundMessagesPerSecond: Math.round(((mm.windowOutbound || 0) / windowAgeSec) * 100) / 100,
      outboundBytesPerSecond: Math.round(((mm.windowOutboundBytes || 0) / windowAgeSec) * 100) / 100,
      outboundBytesPerSecondByKind,
      outboundBytesPerClientPerSecond: clients ? Math.round((((mm.windowOutboundBytes || 0) / windowAgeSec) / clients) * 100) / 100 : 0,
      outboundPeakClientBytesPerSecond: Math.round((peakClientBytes / windowAgeSec) * 100) / 100,
      inboundByType: { ...(mm.inboundByType || {}) },
      outboundByType: { ...(mm.outboundByType || {}) },
      outboundEstimatedBytesByType: { ...(mm.outboundEstimatedBytesByType || {}) },
      outboundMessagesPerSecondByType,
      outboundMessageBytesByType: { ...(mm.outboundMessageBytesByType || mm.outboundEstimatedBytesByType || {}) },
      outboundMessageBytesPerSecondByType,
      disconnects: mm.disconnects || 0,
      unexpectedDisconnects: mm.unexpectedDisconnects || 0,
    };
  }

  // Once-a-minute one-liner; stays quiet on an empty room.
  logMetrics() {
    const s = this.metricsSnapshot();
    if (!s.players && !s.instances && !s.persistenceFailures && !s.rejectedMessages) return;
    console.log('[metrics] clients=' + s.connectedClients + ' players=' + s.players + ' (ow=' + s.owPlayers + ' dgn=' + s.dgnPlayers + ')'
      + ' instances=' + s.instances
      + ' mobs=' + s.mobs + ' (ow=' + s.owMobs + ' dgn=' + s.dgnMobs + ')'
      + ' wastedMobSyncs=' + s.wastedMobSyncs
      + ' tick(ms) avg=' + s.tickAvgMs + ' max=' + s.tickMaxMs + ' overBudget=' + s.tickOverBudget
      + ' outboundKBps=' + Math.round((s.outboundBytesPerSecond || 0) / 1024 * 100) / 100
      + ' statePatchKBps=' + Math.round(((s.outboundBytesPerSecondByKind && s.outboundBytesPerSecondByKind.statePatch || 0) / 1024) * 100) / 100
      + ' peakClientKBps=' + Math.round((s.outboundPeakClientBytesPerSecond || 0) / 1024 * 100) / 100
      + ' persistence ops=' + s.persistenceOperations + ' failures=' + s.persistenceFailures + ' avgMs=' + s.persistenceAvgMs + ' maxMs=' + s.persistenceMaxMs
      + ' rejected=' + s.rejectedMessages);
  }
}

module.exports = MetricsMixin.prototype;
