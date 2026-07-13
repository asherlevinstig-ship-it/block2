const { spawn } = require('node:child_process');
const http = require('node:http');

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function parseRadii() {
  return String(process.env.INTEREST_RADIUS_MATRIX || '48/60,36/48,28/40')
    .split(',')
    .map(entry => {
      const [enter, exit] = entry.split('/').map(value => positiveNumber(value, 0));
      return enter > 0 && exit >= enter ? { enter, exit } : null;
    })
    .filter(Boolean);
}

function fetchMetrics(port) {
  return new Promise(resolve => {
    const request = http.get({ host: '127.0.0.1', port, path: '/__metrics', timeout: 750 }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try { resolve(response.statusCode === 200 ? JSON.parse(body) : null); }
        catch (_) { resolve(null); }
      });
    });
    request.on('error', () => resolve(null));
    request.on('timeout', () => {
      request.destroy();
      resolve(null);
    });
  });
}

function summarize(snapshot) {
  const totals = snapshot && snapshot.totals || {};
  const eventLoop = snapshot && snapshot.eventLoop || {};
  return {
    visibleMobLinks: totals.visibleMobLinks || 0,
    hiddenMobLinksAvoided: totals.hiddenMobLinksAvoided || 0,
    avgVisibleMobs: totals.avgVisibleMobsPerDungeonClient || 0,
    viewChurn: (totals.interestViewAdds || 0) + (totals.interestViewRemoves || 0),
    loopP99Ms: eventLoop.p99Ms || 0,
  };
}

function score(summary) {
  return summary.hiddenMobLinksAvoided - summary.viewChurn * 0.25;
}

function runVariant(variant, index) {
  const port = positiveNumber(process.env.INTEREST_RADIUS_PORT, 2640) + index;
  const durationMs = positiveNumber(process.env.INTEREST_RADIUS_DURATION_MS, 8000);
  const maxP99Ms = positiveNumber(process.env.INTEREST_RADIUS_MAX_P99_MS, 75);
  const maxHeapMb = positiveNumber(process.env.INTEREST_RADIUS_MAX_HEAP_MB, 96);
  return new Promise((resolve, reject) => {
    console.log('\n=== Dungeon interest radius ' + variant.enter + '/' + variant.exit + ' ===');
    let peak = null;
    const poll = setInterval(async () => {
      const snapshot = await fetchMetrics(port);
      if (!snapshot || !snapshot.totals || snapshot.totals.rooms <= 0) return;
      const peakScore = peak
        ? (peak.totals.hiddenMobLinksAvoided || 0) + (peak.totals.visibleMobLinks || 0)
        : -1;
      const nextScore = (snapshot.totals.hiddenMobLinksAvoided || 0) + (snapshot.totals.visibleMobLinks || 0);
      if (nextScore >= peakScore) peak = snapshot;
    }, 500);
    const child = spawn(process.execPath, ['tools/dungeon-load-test.js'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        BLOCKCRAFT_METRICS: '1',
        DUNGEON_LOAD_PORT: String(port),
        DUNGEON_LOAD_DURATION_MS: String(durationMs),
        DUNGEON_LOAD_MAX_P99_MS: String(maxP99Ms),
        DUNGEON_LOAD_MAX_HEAP_MB: String(maxHeapMb),
        DUNGEON_MOB_INTEREST_RADIUS: String(variant.enter),
        DUNGEON_MOB_INTEREST_EXIT_RADIUS: String(variant.exit),
      },
    });
    child.on('error', error => {
      clearInterval(poll);
      reject(error);
    });
    child.on('exit', code => {
      clearInterval(poll);
      if (code !== 0) return reject(new Error('radius ' + variant.enter + '/' + variant.exit + ' failed with exit code ' + code));
      if (!peak) return reject(new Error('radius ' + variant.enter + '/' + variant.exit + ' did not expose metrics'));
      const summary = summarize(peak);
      console.log('Interest metrics: ' + JSON.stringify(summary));
      resolve({ ...variant, ...summary, score: score(summary) });
    });
  });
}

async function main() {
  const variants = parseRadii();
  if (!variants.length) throw new Error('INTEREST_RADIUS_MATRIX did not contain any valid enter/exit pairs');
  const results = [];
  for (let i = 0; i < variants.length; i++) results.push(await runVariant(variants[i], i));
  results.sort((a, b) => b.score - a.score);
  console.log('\nDungeon interest radius matrix');
  for (const result of results) {
    console.log([
      result.enter + '/' + result.exit,
      'hidden=' + result.hiddenMobLinksAvoided,
      'visible=' + result.visibleMobLinks,
      'avg=' + result.avgVisibleMobs,
      'churn=' + result.viewChurn,
      'p99=' + result.loopP99Ms,
      'score=' + Math.round(result.score * 100) / 100,
    ].join(' '));
  }
  console.log('Best radius candidate: ' + results[0].enter + '/' + results[0].exit);
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
