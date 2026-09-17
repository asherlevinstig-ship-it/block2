// These must be set before @colyseus/tools loads @colyseus/core: the core reads
// both values once at module initialization. A cold main-room restore currently
// takes much longer than Colyseus' default matchmaking lock and IPC timeouts.
process.env.COLYSEUS_PRESENCE_SHORT_TIMEOUT ||= '45000';
process.env.COLYSEUS_MAX_CONCURRENT_CREATE_ROOM_WAIT_TIME ||= '45';

const { listen } = require('@colyseus/tools');
const { server } = require('./cloud');
const { summarizeStartupEnv } = require('./startup-config');

listen(server).catch(error => {
  console.error('[startup] ' + error.message);
  console.error('[startup-env] ' + JSON.stringify(summarizeStartupEnv()));
  process.exit(1);
});
