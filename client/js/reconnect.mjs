export const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function reconnectWithBackoff(connect, options = {}) {
  const attempts = Math.max(1, options.attempts | 0 || 4);
  const baseDelay = Math.max(0, options.baseDelay | 0 || 250);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt > 1) await (options.wait || wait)(baseDelay * 2 ** (attempt - 2));
    if (options.onAttempt) options.onAttempt(attempt);
    try { return await connect(attempt); }
    catch (e) { lastError = e; }
  }
  throw lastError || new Error('Reconnect failed');
}
