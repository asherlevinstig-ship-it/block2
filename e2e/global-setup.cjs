const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const PORT = 2607;

function serverReady() {
  return new Promise(resolve => {
    const request = http.get(`http://127.0.0.1:${PORT}/`, response => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });
    request.on('error', () => resolve(false));
    request.setTimeout(500, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function exited(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise(resolve => child.once('exit', resolve));
}

module.exports = async () => {
  const root = path.resolve(__dirname, '..');
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: root,
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'bc-e2e-')),
      AUTH_SECRET: 'e2e-only-secret',
      BLOCKCRAFT_E2E: '1',
    },
  });

  for (let attempt = 0; attempt < 40; attempt++) {
    if (child.exitCode !== null) throw new Error(`E2E server exited during startup (${child.exitCode})`);
    if (await serverReady()) {
      return async () => {
        if (child.exitCode === null) child.kill();
        await Promise.race([
          exited(child),
          new Promise((_, reject) => setTimeout(() => reject(new Error('E2E server did not stop')), 5_000)),
        ]);
      };
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  child.kill();
  throw new Error('E2E server did not become ready');
};
