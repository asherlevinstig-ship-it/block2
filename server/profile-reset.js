const resetHandlers = new Set();
const updateHandlers = new Set();

function registerProfileResetHandler(handler) {
  if (typeof handler !== 'function') return () => {};
  resetHandlers.add(handler);
  return () => resetHandlers.delete(handler);
}

function registerProfileUpdateHandler(handler) {
  if (typeof handler !== 'function') return () => {};
  updateHandlers.add(handler);
  return () => updateHandlers.delete(handler);
}

async function resetLivePlayerProfiles(token) {
  const id = String(token || '');
  if (!id) return 0;
  let count = 0;
  for (const handler of [...resetHandlers]) {
    try {
      if (await handler(id)) count++;
    } catch (e) {
      console.warn('[profile-reset] live reset handler failed:', e.message);
    }
  }
  return count;
}

async function updateLivePlayerProfiles(token, patch) {
  const id = String(token || '');
  if (!id) return 0;
  let count = 0;
  for (const handler of [...updateHandlers]) {
    try {
      if (await handler(id, patch || {})) count++;
    } catch (e) {
      console.warn('[profile-reset] live update handler failed:', e.message);
    }
  }
  return count;
}

module.exports = { registerProfileResetHandler, registerProfileUpdateHandler, resetLivePlayerProfiles, updateLivePlayerProfiles };
