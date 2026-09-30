module.exports = {
  apps: [{
    name: "blockcraft-mp",
    script: "apps/server/dist/index.js",
    instances: 1,
    exec_mode: "fork",
    watch: false,
    time: true,
    wait_ready: true,
    listen_timeout: 15000,
    kill_timeout: 10000,
    env_production: {
      NODE_ENV: "production",
    },
  }],
};
