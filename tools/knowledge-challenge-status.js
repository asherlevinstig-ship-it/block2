#!/usr/bin/env node
'use strict';
// Check whether the MySQL-backed Scholar Table / Knowledge Challenge has playable content.
//
//   node tools/knowledge-challenge-status.js [--subject "Computer Science"] [--subject-id N]
//
// Reads MYSQL_* env vars, same as the server and seed tool. This is intentionally
// read-only apart from the store's additive ensureSchema() migration.
const mysql = require('mysql2/promise');
const { MySqlGameQuestionStore } = require('../server/mysql-game-questions');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(name + ' is required');
  return value;
}

async function scalar(pool, sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  const row = rows && rows[0] || {};
  const key = Object.keys(row)[0];
  return Number(row[key] || 0);
}

async function main() {
  const pool = mysql.createPool({
    host: required('MYSQL_HOST'),
    port: Number(process.env.MYSQL_PORT || 3306),
    user: required('MYSQL_USER'),
    password: required('MYSQL_PASSWORD'),
    database: required('MYSQL_DATABASE'),
    waitForConnections: true,
    connectionLimit: 2,
    charset: 'utf8mb4',
  });
  try {
    const store = new MySqlGameQuestionStore({ pool });
    await store.ensureSchema();

    const explicitSubjectId = Number(arg('subject-id', 0)) || 0;
    const subjectName = String(arg('subject', 'Computer Science') || '').trim();
    let subject = null;
    if (explicitSubjectId) {
      const [rows] = await pool.execute('SELECT id, name, code FROM subjects WHERE id = ? LIMIT 1', [explicitSubjectId]);
      subject = rows && rows[0] || null;
    } else if (subjectName) {
      const [rows] = await pool.execute(
        'SELECT id, name, code FROM subjects WHERE is_active = 1 AND (LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)) ORDER BY id ASC LIMIT 1',
        [subjectName, subjectName],
      );
      subject = rows && rows[0] || null;
    }

    const tableCounts = {
      subjects: await scalar(pool, 'SELECT COUNT(*) AS n FROM subjects'),
      game_question: await scalar(pool, 'SELECT COUNT(*) AS n FROM game_question'),
      kc_entity: await scalar(pool, 'SELECT COUNT(*) AS n FROM kc_entity'),
      kc_atom: await scalar(pool, 'SELECT COUNT(*) AS n FROM kc_atom'),
      kc_shift: await scalar(pool, 'SELECT COUNT(*) AS n FROM kc_shift'),
    };

    const result = { ok: true, mysql: { host: process.env.MYSQL_HOST, database: process.env.MYSQL_DATABASE }, tableCounts };
    if (!subject) {
      result.playable = false;
      result.reason = explicitSubjectId ? 'subject_id_not_found' : 'subject_not_found';
      result.subjectQuery = explicitSubjectId || subjectName;
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = 2;
      return;
    }

    const subjectId = Number(subject.id);
    const atoms = await scalar(pool, 'SELECT COUNT(*) AS n FROM kc_atom WHERE subject_id = ? AND is_active = 1', [subjectId]);
    const questions = await scalar(
      pool,
      `SELECT COUNT(*) AS n
       FROM game_question
       WHERE subject_id = ? AND primary_atom_id IS NOT NULL AND is_active = 1
         AND review_status IN ('approved', 'teacher-reviewed')`,
      [subjectId],
    );
    const formatsRows = await pool.execute(
      `SELECT format, COUNT(*) AS n
       FROM game_question
       WHERE subject_id = ? AND primary_atom_id IS NOT NULL AND is_active = 1
         AND review_status IN ('approved', 'teacher-reviewed')
       GROUP BY format
       ORDER BY format`,
      [subjectId],
    );
    result.subject = { id: subjectId, name: subject.name, code: subject.code || '' };
    result.subjectCounts = {
      kc_atom: atoms,
      playable_questions: questions,
      formats: Object.fromEntries((formatsRows[0] || []).map(r => [r.format || 'multiple_choice', Number(r.n) || 0])),
    };
    result.playable = atoms > 0 && questions > 0;
    if (!result.playable) result.reason = atoms <= 0 ? 'no_kc_atoms_seeded' : 'no_atom_linked_questions_seeded';
    console.log(JSON.stringify(result, null, 2));
    if (!result.playable) process.exitCode = 2;
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch(err => {
  console.error('[knowledge-challenge-status]', err && err.stack || err);
  process.exitCode = 1;
});
