#!/usr/bin/env node
'use strict';
// Seed a Knowledge Challenge content pack into MySQL.
//
//   node tools/seed-knowledge-challenge.js [--file <path>] [--subject-id N] [--school-id N]
//
// Defaults to content/knowledge-challenge/sample-pack.json. The subject is taken
// from --subject-id, else resolved by the pack's "subject" name against the
// existing `subjects` table (it must already exist). Reads the same game-question
// DB env vars as the server: GAME_QUESTION_MYSQL_* first, then LIVEWEAVE_MYSQL_*,
// QUESTION_MYSQL_*, and finally legacy MYSQL_* auth DB vars. Idempotent:
// re-running updates content in place.
const fs = require('fs');
const path = require('path');
const { MySqlGameQuestionStore, gameQuestionDbConfig } = require('../server/mysql-game-questions');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

async function resolveSubjectId(pool, pack) {
  const explicit = Number(arg('subject-id', 0)) || 0;
  if (explicit) return explicit;
  const name = String(pack.subject || '').trim();
  if (!name) throw new Error('Pack has no "subject" and no --subject-id was given.');
  const [rows] = await pool.execute(
    'SELECT id FROM subjects WHERE is_active = 1 AND (LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)) ORDER BY id ASC LIMIT 1',
    [name, name],
  );
  if (!rows || !rows[0]) throw new Error('Subject "' + name + '" not found. Create it first, or pass --subject-id.');
  return Number(rows[0].id);
}

async function main() {
  const file = path.resolve(arg('file', 'content/knowledge-challenge/sample-pack.json'));
  const pack = JSON.parse(fs.readFileSync(file, 'utf8'));
  const mysql = require('mysql2/promise');
  const config = gameQuestionDbConfig(process.env) || {
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  };
  const pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 4,
    charset: 'utf8mb4',
  });
  try {
    const store = new MySqlGameQuestionStore({ pool });
    const subjectId = await resolveSubjectId(pool, pack);
    const schoolId = Number(arg('school-id', 0)) || 0;
    const counts = await store.importContentPack(subjectId, pack, { schoolId });
    console.log('Imported into subject ' + subjectId + ':', JSON.stringify(counts));
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch(err => { console.error('[seed-knowledge-challenge]', err && err.message || err); process.exit(1); });
