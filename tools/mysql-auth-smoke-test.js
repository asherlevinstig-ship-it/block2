#!/usr/bin/env node

const crypto = require('crypto');
const http = require('http');
const https = require('https');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(name + ' is required');
  return value;
}

function requestJson(baseUrl, path, body) {
  const data = body ? Buffer.from(JSON.stringify(body)) : null;
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(url, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json', 'content-length': data.length } : {},
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
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

  const suffix = crypto.randomBytes(5).toString('hex');
  const email = 'blockcraft-smoke-' + suffix + '@example.test';
  const password = 'correct horse smoke ' + suffix;
  const hash = await bcrypt.hash(password, 10);
  let insertedId = null;

  try {
    const [tables] = await pool.query("SHOW TABLES LIKE 'students'");
    if (!tables.length) throw new Error('students table was not found');

    const [result] = await pool.execute(
      'INSERT INTO students (name, email, password_hash, school_id) VALUES (?, ?, ?, NULL)',
      ['Blockcraft Smoke', email, hash],
    );
    insertedId = result.insertId;
    if (!insertedId) throw new Error('temporary student insert did not return an id');

    const baseUrl = process.env.SMOKE_AUTH_BASE_URL;
    if (baseUrl) {
      const login = await requestJson(baseUrl, '/auth/login', { username: email, password, displayName: 'Smoke' });
      if (login.status !== 200 || !login.body.account || login.body.account.id !== 'student_' + insertedId) {
        throw new Error('server login failed with status ' + login.status);
      }
    }

    console.log('MySQL auth smoke passed for temporary student id:', insertedId);
  } finally {
    if (insertedId) await pool.execute('DELETE FROM students WHERE id = ? AND email = ?', [insertedId, email]).catch(() => {});
    await pool.end();
  }
}

main().catch(err => {
  console.error(err && err.stack || err);
  if (err && Array.isArray(err.errors)) {
    for (const cause of err.errors) console.error(cause && cause.code ? cause.code + ': ' + cause.message : cause);
  }
  process.exitCode = 1;
});
