const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..').replaceAll('\\', '/');
const report = path.join(__dirname, 'REPORT.md');
let text = fs.readFileSync(report, 'utf8');
text = text.replace(/`((?:(?:client|server|e2e)\/)[A-Za-z0-9_./-]+)(?::(\d+))?`/g,
  (all, file, line) => fs.existsSync(path.join(root, file))
    ? `[${file}${line ? ':' + line : ''}](<${root}/${file}${line ? ':' + line : ''}>)` : all);
fs.writeFileSync(report, text);
for (const match of text.matchAll(/\]\(<([^>]+)>\)/g)) {
  const target = match[1].replace(/:\d+$/, '');
  if (!fs.existsSync(target)) throw new Error('Broken report link: ' + target);
}
console.log('Report file links verified.');
