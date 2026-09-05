const PATH_LOG_LIMIT = 200;

export function pathDebug(event, data = {}) {
  const entry = { at: new Date().toISOString(), event: String(event || ''), ...(data || {}) };
  try {
    const log = Array.isArray(globalThis.BlockcraftPathLog) ? globalThis.BlockcraftPathLog : [];
    log.push(entry);
    if (log.length > PATH_LOG_LIMIT) log.splice(0, log.length - PATH_LOG_LIMIT);
    globalThis.BlockcraftPathLog = log;
  } catch (_) {}
  try { console.warn('[bc-path]', JSON.stringify(entry)); } catch (_) {}
  return entry;
}
