const { matchMaker } = require('colyseus');

async function prewarmOverworldRoom(config = {}) {
  if (process.env.BLOCKCRAFT_PREWARM_OVERWORLD === '0') return null;
  const started = Date.now();
  const shardId = 'main';
  try {
    const room = await matchMaker.createRoom('blockcraft', { shardId, prewarm: true });
    console.log('[startup] prewarmed overworld shard "' + shardId + '" as room ' + room.roomId + ' in ' + (Date.now() - started) + 'ms');
    return room;
  } catch (e) {
    console.error('[startup] failed to prewarm overworld shard "' + shardId + '": ' + (e && e.message || e));
    if (config.production !== false) throw e;
    return null;
  }
}

module.exports = { prewarmOverworldRoom };
