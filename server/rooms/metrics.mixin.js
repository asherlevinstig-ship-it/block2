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
class MetricsMixin {
  // Roll a tick-duration sample into an EMA + running max. Cheap; called every tick.
  recordTick(ms) {
    const m = this.tickMetrics || (this.tickMetrics = { lastMs: 0, avgMs: 0, maxMs: 0, samples: 0 });
    m.lastMs = ms;
    m.samples++;
    m.avgMs = m.avgMs ? m.avgMs * 0.95 + ms * 0.05 : ms;   // ~last-20-ticks weighting
    if (ms > m.maxMs) m.maxMs = ms;
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
    const clients = (this.clients && this.clients.length) || this.state.players.size;
    let wastedMobSyncs = 0;
    perInst.forEach((count, dgn) => {
      const inst = this.instances && this.instances[dgn];
      const inInst = inst ? inst.playerCount : 0;
      wastedMobSyncs += count * Math.max(0, clients - inInst);
    });
    const tm = this.tickMetrics || {};
    return {
      players: this.state.players.size, owPlayers, dgnPlayers,
      instances: Object.keys(this.instances || {}).length,
      mobs: owMobs + dgnMobs, owMobs, dgnMobs, wastedMobSyncs,
      tickAvgMs: Math.round((tm.avgMs || 0) * 100) / 100,
      tickMaxMs: Math.round((tm.maxMs || 0) * 100) / 100,
    };
  }

  // Once-a-minute one-liner; stays quiet on an empty room.
  logMetrics() {
    const s = this.metricsSnapshot();
    if (!s.players && !s.instances) return;
    console.log('[metrics] players=' + s.players + ' (ow=' + s.owPlayers + ' dgn=' + s.dgnPlayers + ')'
      + ' instances=' + s.instances
      + ' mobs=' + s.mobs + ' (ow=' + s.owMobs + ' dgn=' + s.dgnMobs + ')'
      + ' wastedMobSyncs=' + s.wastedMobSyncs
      + ' tick(ms) avg=' + s.tickAvgMs + ' max=' + s.tickMaxMs);
  }
}

module.exports = MetricsMixin.prototype;
