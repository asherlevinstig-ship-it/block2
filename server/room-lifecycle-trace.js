const MAX_EVENTS = Math.max(25, Math.min(500, Number(process.env.ROOM_LIFECYCLE_TRACE_MAX || 200) | 0));
const events = [];

function recordRoomLifecycleTrace(type, detail = {}) {
  const entry = {
    at: new Date().toISOString(),
    type: String(type || 'room.lifecycle'),
    ...detail,
  };
  events.push(entry);
  while (events.length > MAX_EVENTS) events.shift();
  try {
    console.log('[room-lifecycle] ' + JSON.stringify(entry));
  } catch (_) {
    console.log('[room-lifecycle] ' + entry.type);
  }
  return entry;
}

function recentRoomLifecycleTrace() {
  return events.slice();
}

function clearRoomLifecycleTrace() {
  const count = events.length;
  events.length = 0;
  return count;
}

module.exports = {
  clearRoomLifecycleTrace,
  recentRoomLifecycleTrace,
  recordRoomLifecycleTrace,
};
