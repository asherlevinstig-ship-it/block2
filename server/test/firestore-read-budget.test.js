const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('the teacher dashboard link does not poll auth and Firestore while the game is idle', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'teacher-link.mjs'), 'utf8');
  assert.match(source, /checkTeacherAccess\(button\)/, 'teacher access is still checked on startup');
  assert.doesNotMatch(source, /setInterval\([^\n]*checkTeacherAccess/, 'teacher access must not be polled on a timer');
  assert.match(source, /refresh:\s*\(\)\s*=>\s*checkTeacherAccess\(button\)/, 'explicit refresh remains available');
});
