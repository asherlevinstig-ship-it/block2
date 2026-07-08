const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const roots = ['client', 'server', 'shared', 'tools', 'e2e', 'docs'];
const extensions = new Set(['.js', '.mjs', '.cjs', '.json', '.md', '.css', '.html', '.yml', '.yaml']);
const ignored = new Set(['node_modules', 'vendor', 'data', 'test-results', 'playwright-report', 'pebble']);
const failures = [];

function inspect(file) {
  if (!extensions.has(path.extname(file))) return;
  const text = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);
  text.split(/\r?\n/).forEach((line, index) => {
    if (/[ \t]+$/.test(line)) failures.push(`${relative}:${index + 1}: trailing whitespace`);
  });
  if (text && !text.endsWith('\n')) failures.push(`${relative}: missing final newline`);
}

function walk(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.statSync(target);
  if (stat.isFile()) return inspect(target);
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    walk(path.join(target, entry.name));
  }
}

for (const dir of roots) walk(path.join(root, dir));
for (const file of ['package.json', 'playwright.config.cjs', 'README.md', 'eslint.config.js']) walk(path.join(root, file));

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log('Formatting check passed.');
