const DEFAULT_RESTART_WARNING_MS = 8000;
const MAX_RESTART_WARNING_MS = 15000;

function restartWarningDelay(env = process.env) {
  if (env.BLOCKCRAFT_E2E === '1' || env.NODE_ENV === 'test') return 0;
  const configured = Number(env.BLOCKCRAFT_RESTART_WARNING_MS);
  if (!Number.isFinite(configured)) return DEFAULT_RESTART_WARNING_MS;
  return Math.max(0, Math.min(MAX_RESTART_WARNING_MS, Math.round(configured)));
}

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function warnForRestart(rooms, options = {}) {
  const delayMs = options.delayMs === undefined ? restartWarningDelay(options.env) : Math.max(0, Number(options.delayMs) || 0);
  const sleep = typeof options.wait === 'function' ? options.wait : wait;
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const activeRooms = Array.from(rooms || []).filter(Boolean);
  const connectedRooms = activeRooms.filter(room => room.clients && room.clients.length > 0);
  const effectiveDelayMs = connectedRooms.length > 0 ? delayMs : 0;
  const startedAt = now();
  const payload = {
    message: 'Server restarting for an update',
    detail: 'Your progress is being saved. Reconnecting automatically.',
    delayMs: effectiveDelayMs,
    restartAt: startedAt + effectiveDelayMs,
  };

  for (const room of connectedRooms) {
    try { room.broadcast('serverRestartWarning', payload); } catch (error) {
      console.warn('[shutdown] restart warning broadcast failed:', error && error.message || error);
    }
  }

  const lockRooms = activeRooms.map(async room => {
    if (typeof room.lock === 'function') await room.lock();
  });
  const flushRooms = activeRooms.map(async room => {
    if (typeof room.flush === 'function') await room.flush();
  });
  const countdown = effectiveDelayMs > 0 ? sleep(effectiveDelayMs) : Promise.resolve();
  const results = await Promise.allSettled([...lockRooms, ...flushRooms, countdown]);
  const failures = results.filter(result => result.status === 'rejected');
  for (const failure of failures) {
    console.warn('[shutdown] restart preparation failed:', failure.reason && failure.reason.message || failure.reason);
  }
  return { rooms: connectedRooms.length, failures: failures.length, delayMs: effectiveDelayMs };
}

module.exports = {
  DEFAULT_RESTART_WARNING_MS,
  MAX_RESTART_WARNING_MS,
  restartWarningDelay,
  warnForRestart,
};
