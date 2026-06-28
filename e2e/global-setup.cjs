const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const PORT = 2607;
const CONTROL_PORT = 2608;

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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-e2e-'));
  let child;
  let restarting = false;

  const startChild = () => {
    child = spawn(process.execPath, ['server/index.js'], {
      cwd: root,
      windowsHide: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        PORT: String(PORT),
        DATA_DIR: dataDir,
        AUTH_SECRET: 'e2e-only-secret',
        BLOCKCRAFT_E2E: '1',
      },
    });
  };
  const waitForReady = async () => {
    for (let attempt = 0; attempt < 40; attempt++) {
      if (child.exitCode !== null) throw new Error(`E2E server exited during startup (${child.exitCode})`);
      if (await serverReady()) return;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('E2E server did not become ready');
  };
  const requestShutdown = () => new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1', port: PORT, path: '/__e2e/shutdown', method: 'POST',
    }, response => {
      response.resume();
      response.on('end', resolve);
    });
    request.on('error', reject);
    request.setTimeout(2_000, () => request.destroy(new Error('shutdown request timed out')));
    request.end();
  });
  const stopChild = async graceful => {
    if (!child || child.exitCode !== null) return;
    if (graceful) {
      try {
        await requestShutdown();
        await Promise.race([
          exited(child),
          new Promise((_, reject) => setTimeout(() => reject(new Error('graceful shutdown timed out')), 8_000)),
        ]);
      } catch (_) {}
    }
    if (child.exitCode === null) {
      child.kill();
      await exited(child);
    }
  };
  const restart = async () => {
    if (restarting) throw new Error('E2E server restart already in progress');
    restarting = true;
    try {
      await stopChild(true);
      startChild();
      await waitForReady();
    } finally {
      restarting = false;
    }
  };

  startChild();
  await waitForReady();

  const control = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/restart') {
      res.writeHead(404).end();
      return;
    }
    restart().then(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    }).catch(error => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: error.message }));
    });
  });
  await new Promise((resolve, reject) => {
    control.once('error', reject);
    control.listen(CONTROL_PORT, '127.0.0.1', resolve);
  });

  return async () => {
    await new Promise(resolve => control.close(resolve));
    await stopChild(false);
  };
};
