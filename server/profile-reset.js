const handlers = new Set();

function registerProfileResetHandler(handler) {
  if (typeof handler !== 'function') return () => {};
  handlers.add(handler);
  return () => handlers.delete(handler);
}

async function resetLivePlayerProfiles(token) {
  const id = String(token || '');
  if (!id) return 0;
  let count = 0;
  for (const handler of [...handlers]) {
    try {
      if (await handler(id)) count++;
    } catch (e) {
      console.warn('[profile-reset] live reset handler failed:', e.message);
    }
  }
  return count;
}

module.exports = { registerProfileResetHandler, resetLivePlayerProfiles };
