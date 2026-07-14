const { listen } = require('@colyseus/tools');
const { server } = require('./cloud');
const { summarizeStartupEnv } = require('./startup-config');

listen(server).catch(error => {
  console.error('[startup] ' + error.message);
  console.error('[startup-env] ' + JSON.stringify(summarizeStartupEnv()));
  process.exit(1);
});
