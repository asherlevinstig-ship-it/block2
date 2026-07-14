const { listen } = require('@colyseus/tools');
const { server } = require('./cloud');

listen(server).catch(error => {
  console.error('[startup] ' + error.message);
  process.exitCode = 1;
});
