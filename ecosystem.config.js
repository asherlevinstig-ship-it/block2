module.exports = {
  apps: [{
    name: 'blockcraft-mp',
    script: 'server/cloud-listen.js',
    time: true,
    watch: false,
    instances: Number(process.env.WEB_CONCURRENCY || 1),
    exec_mode: 'fork',
    wait_ready: true,
    listen_timeout: 30000,
    max_memory_restart: process.env.PM2_MAX_MEMORY_RESTART || '768M',
    env: {
      NODE_ENV: process.env.NODE_ENV || 'production',
      // The main room restores a large persisted world before onCreate resolves.
      // Keep concurrent matchmaking requests on the first creation attempt instead
      // of allowing Colyseus' sub-second default lock to start duplicate rooms.
      COLYSEUS_PRESENCE_SHORT_TIMEOUT: process.env.COLYSEUS_PRESENCE_SHORT_TIMEOUT || '45000',
      COLYSEUS_MAX_CONCURRENT_CREATE_ROOM_WAIT_TIME: process.env.COLYSEUS_MAX_CONCURRENT_CREATE_ROOM_WAIT_TIME || '45',
    },
  }],
};
