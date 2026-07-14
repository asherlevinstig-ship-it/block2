const bcrypt = require('bcryptjs');

const cleanEmail = value => String(value || '').trim().toLowerCase();

function publicId(type, id) {
  return String(type || '').toLowerCase() + '_' + String(id || '').replace(/[^0-9a-z_-]/gi, '');
}

function normalizeBcryptHash(hash) {
  const raw = String(hash || '');
  return raw.startsWith('$2y$') ? '$2b$' + raw.slice(4) : raw;
}

class MySqlAuthBackend {
  constructor(options = {}) {
    this.pool = options.pool || null;
    this.bcrypt = options.bcrypt || bcrypt;
    this.env = options.env || process.env;
  }

  getPool() {
    if (this.pool) return this.pool;
    const mysql = require('mysql2/promise');
    this.pool = mysql.createPool({
      host: this.env.MYSQL_HOST || 'localhost',
      port: Number(this.env.MYSQL_PORT || 3306),
      user: this.env.MYSQL_USER,
      password: this.env.MYSQL_PASSWORD,
      database: this.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: Number(this.env.MYSQL_CONNECTION_LIMIT || 10),
      charset: 'utf8mb4',
    });
    return this.pool;
  }

  async findAccount(identifier) {
    const email = cleanEmail(identifier);
    if (!email || !email.includes('@')) return null;
    const pool = this.getPool();
    const teacher = await this.findTeacher(pool, email);
    if (teacher) return teacher;
    return this.findStudent(pool, email);
  }

  async findTeacher(pool, email) {
    const [rows] = await pool.execute(
      'SELECT id, name, email, password_hash, role, is_active, school_id FROM teachers WHERE LOWER(email) = ? LIMIT 1',
      [email],
    );
    const row = rows && rows[0];
    if (!row || Number(row.is_active) === 0) return null;
    return {
      id: publicId('teacher', row.id),
      username: cleanEmail(row.email),
      displayName: String(row.name || 'Teacher').trim().slice(0, 32) || 'Teacher',
      passwordHash: row.password_hash,
      accountType: 'teacher',
      role: String(row.role || 'teacher'),
      schoolId: row.school_id == null ? null : String(row.school_id),
      sourceId: String(row.id),
    };
  }

  async findStudent(pool, email) {
    const [rows] = await pool.execute(
      'SELECT id, name, email, password_hash, school_id FROM students WHERE LOWER(email) = ? LIMIT 1',
      [email],
    );
    const row = rows && rows[0];
    if (!row) return null;
    return {
      id: publicId('student', row.id),
      username: cleanEmail(row.email),
      displayName: String(row.name || 'Student').trim().slice(0, 32) || 'Student',
      passwordHash: row.password_hash,
      accountType: 'student',
      role: 'student',
      schoolId: row.school_id == null ? null : String(row.school_id),
      sourceId: String(row.id),
    };
  }

  async verifyPassword(password, hash) {
    const normalized = normalizeBcryptHash(hash);
    if (!normalized.startsWith('$2a$') && !normalized.startsWith('$2b$')) return false;
    return this.bcrypt.compare(String(password || ''), normalized);
  }

  async touchLastLogin(account) {
    const pool = this.getPool();
    if (account.accountType === 'teacher') {
      await pool.execute('UPDATE teachers SET auth_token = NULL WHERE id = ?', [account.sourceId]).catch(() => {});
      return;
    }
    if (account.accountType === 'student') {
      await pool.execute('UPDATE students SET last_login_at = NOW() WHERE id = ?', [account.sourceId]).catch(() => {});
    }
  }

  async login(identifier, password) {
    const account = await this.findAccount(identifier);
    const ok = account && await this.verifyPassword(password, account.passwordHash);
    if (!ok) throw Object.assign(new Error('Invalid username or password.'), { status: 401, code: 'credentials' });
    await this.touchLastLogin(account);
    delete account.passwordHash;
    delete account.sourceId;
    return account;
  }
}

function createConfiguredAuthBackend(env = process.env) {
  if (String(env.AUTH_BACKEND || '').toLowerCase() !== 'mysql') return null;
  return new MySqlAuthBackend({ env });
}

module.exports = { MySqlAuthBackend, createConfiguredAuthBackend, cleanEmail, normalizeBcryptHash, publicId };
