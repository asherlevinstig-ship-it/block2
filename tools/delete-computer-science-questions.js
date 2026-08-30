#!/usr/bin/env node
'use strict';

// Soft-delete Computer Science question content from the Blockcraft question DB.
//
// Dry run:
//   node tools/delete-computer-science-questions.js
//
// Apply:
//   CONFIRM_DELETE_COMPUTER_SCIENCE_QUESTIONS=DELETE_COMPUTER_SCIENCE_QUESTIONS \
//   node tools/delete-computer-science-questions.js --force
//
// Uses the same question DB env vars as the game server:
// GAME_QUESTION_MYSQL_*, LIVEWEAVE_MYSQL_*, QUESTION_MYSQL_*, then legacy MYSQL_*.

const { gameQuestionDbConfig } = require('../server/mysql-game-questions');

const CONFIRM_VALUE = 'DELETE_COMPUTER_SCIENCE_QUESTIONS';
const SUBJECT_NAMES = ['computer science'];
const SUBJECT_CODES = ['cs', 'compsci', 'computer_science'];

function hasFlag(name) {
  return process.argv.includes('--' + name);
}

function inListSql(values) {
  return values.map(() => '?').join(', ');
}

async function tableExists(pool, table) {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
    [table],
  );
  return Number(rows && rows[0] && rows[0].n) > 0;
}

async function scalar(pool, sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return Number(rows && rows[0] && rows[0].n) || 0;
}

async function main() {
  const mysql = require('mysql2/promise');
  const config = gameQuestionDbConfig(process.env) || {
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  };
  if (!config.host || !config.user || !config.database) {
    throw new Error('Missing MySQL question DB config. Set GAME_QUESTION_MYSQL_* or LIVEWEAVE_MYSQL_* env vars.');
  }

  const force = hasFlag('force');
  const confirmed = process.env.CONFIRM_DELETE_COMPUTER_SCIENCE_QUESTIONS === CONFIRM_VALUE;
  const pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 2,
    charset: 'utf8mb4',
  });

  try {
    const where = `(LOWER(name) IN (${inListSql(SUBJECT_NAMES)}) OR LOWER(code) IN (${inListSql(SUBJECT_CODES)}))`;
    const params = [...SUBJECT_NAMES, ...SUBJECT_CODES];
    const [subjects] = await pool.execute(
      `SELECT id, name, code, is_active FROM subjects WHERE ${where} ORDER BY id ASC`,
      params,
    );
    const subjectIds = subjects.map(row => Number(row.id)).filter(Boolean);

    const result = {
      mode: force ? 'force' : 'dry-run',
      mysql: { host: config.host, database: config.database },
      matchedSubjects: subjects.map(row => ({
        id: Number(row.id),
        name: row.name || '',
        code: row.code || '',
        active: Number(row.is_active) !== 0,
      })),
      counts: {},
    };

    if (!subjectIds.length) {
      console.log(JSON.stringify({ ...result, ok: true, changed: false, reason: 'no_computer_science_subject_found' }, null, 2));
      return;
    }

    const idSql = inListSql(subjectIds);
    result.counts.game_question_active = await scalar(pool, `SELECT COUNT(*) AS n FROM game_question WHERE subject_id IN (${idSql}) AND is_active = 1`, subjectIds);
    if (await tableExists(pool, 'kc_entity')) result.counts.kc_entity_active = await scalar(pool, `SELECT COUNT(*) AS n FROM kc_entity WHERE subject_id IN (${idSql}) AND is_active = 1`, subjectIds);
    if (await tableExists(pool, 'kc_atom')) result.counts.kc_atom_active = await scalar(pool, `SELECT COUNT(*) AS n FROM kc_atom WHERE subject_id IN (${idSql}) AND is_active = 1`, subjectIds);
    if (await tableExists(pool, 'game_homework')) result.counts.game_homework_open = await scalar(pool, `SELECT COUNT(*) AS n FROM game_homework WHERE subject_id IN (${idSql}) AND status IN ('draft', 'scheduled', 'live')`, subjectIds);

    if (!force) {
      console.log(JSON.stringify({
        ...result,
        ok: true,
        changed: false,
        nextStep: 'Run with --force and CONFIRM_DELETE_COMPUTER_SCIENCE_QUESTIONS=' + CONFIRM_VALUE + ' to soft-delete these rows.',
      }, null, 2));
      return;
    }
    if (!confirmed) {
      throw new Error('Refusing to change DB without CONFIRM_DELETE_COMPUTER_SCIENCE_QUESTIONS=' + CONFIRM_VALUE);
    }

    const updates = {};
    const [gq] = await pool.execute(`UPDATE game_question SET is_active = 0 WHERE subject_id IN (${idSql}) AND is_active = 1`, subjectIds);
    updates.game_question_deactivated = Number(gq.affectedRows) || 0;

    if (await tableExists(pool, 'kc_entity')) {
      const [ke] = await pool.execute(`UPDATE kc_entity SET is_active = 0 WHERE subject_id IN (${idSql}) AND is_active = 1`, subjectIds);
      updates.kc_entity_deactivated = Number(ke.affectedRows) || 0;
    }
    if (await tableExists(pool, 'kc_atom')) {
      const [ka] = await pool.execute(`UPDATE kc_atom SET is_active = 0 WHERE subject_id IN (${idSql}) AND is_active = 1`, subjectIds);
      updates.kc_atom_deactivated = Number(ka.affectedRows) || 0;
    }
    if (await tableExists(pool, 'game_homework')) {
      const [gh] = await pool.execute(`UPDATE game_homework SET status = 'closed' WHERE subject_id IN (${idSql}) AND status IN ('draft', 'scheduled', 'live')`, subjectIds);
      updates.game_homework_closed = Number(gh.affectedRows) || 0;
    }

    console.log(JSON.stringify({ ...result, ok: true, changed: true, updates }, null, 2));
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch(err => {
  console.error('[delete-computer-science-questions]', err && err.message || err);
  process.exit(1);
});
