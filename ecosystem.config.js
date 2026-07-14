module.exports = {
  apps: [{
    name: 'blockcraft-mp',
    script: 'server/index.js',
    time: true,
    watch: false,
    instances: Number(process.env.WEB_CONCURRENCY || 1),
    exec_mode: 'fork',
    wait_ready: true,
    listen_timeout: 30000,
    max_memory_restart: process.env.PM2_MAX_MEMORY_RESTART || '768M',
    env: {
      NODE_ENV: process.env.NODE_ENV || 'production',
    },
  }],
};
