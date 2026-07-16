const bcrypt = require('bcryptjs');

const cleanEmail = value => String(value || '').trim().toLowerCase();
const cleanYearGroup = value => String(value || '').replace(/[<>]/g, '').trim().slice(0, 50);
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
const emailDomain = value => cleanEmail(value).split('@')[1] || '';

function publicId(type, id) {
  return String(type || '').toLowerCase() + '_' + String(id || '').replace(/[^0-9a-z_-]/gi, '');
}

function normalizeBcryptHash(hash) {
  const raw = String(hash || '');
  return raw.startsWith('$2y$') ? '$2b$' + raw.slice(4) : raw;
}

function displayNameFromEmail(email) {
  const local = String(email || '').split('@')[0].split('+')[0] || 'student';
  const words = local.replace(/[^a-z0-9]+/gi, ' ').trim().split(/\s+/).filter(Boolean);
  const name = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return (name || 'Student').slice(0, 255);
}

function duplicateError(error) {
  return error && (error.code === 'ER_DUP_ENTRY' || Number(error.errno) === 1062);
}

class MySqlAuthBackend {
  constructor(options = {}) {
    this.pool = options.pool || null;
    this.bcrypt = options.bcrypt || bcrypt;
    this.env = options.env || process.env;
    this.studentColumnSet = null;
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

  async studentColumns(pool = this.getPool()) {
    if (this.studentColumnSet) return this.studentColumnSet;
    try {
      const [rows] = await pool.execute('SHOW COLUMNS FROM students');
      this.studentColumnSet = new Set((rows || []).map(row => String(row.Field || row.field || '').toLowerCase()).filter(Boolean));
    } catch (_) {
      this.studentColumnSet = new Set(['id', 'name', 'email', 'password_hash', 'school_id']);
    }
    return this.studentColumnSet;
  }

  async schoolForEmail(pool, email) {
    const domain = emailDomain(email);
    if (!domain) return null;
    const [rows] = await pool.execute(
      'SELECT id, name, domain FROM schools WHERE LOWER(domain) = ? LIMIT 1',
      [domain],
    );
    const row = rows && rows[0];
    if (!row) return null;
    return {
      id: Number(row.id),
      name: String(row.name || '').trim(),
      domain: String(row.domain || domain).trim().toLowerCase(),
    };
  }

  async registerStudent(input = {}) {
    const email = cleanEmail(input.email || input.username);
    if (!validEmail(email)) throw Object.assign(new Error('Enter a valid school email address.'), { status: 400, code: 'email' });
    const password = String(input.password || '');
    if (password.length < 10 || password.length > 128) throw Object.assign(new Error('Password must be 10-128 characters.'), { status: 400, code: 'password' });
    const yearGroup = cleanYearGroup(input.yearGroup || input.year_group);
    if (!yearGroup || !/^[A-Za-z0-9 _-]{1,50}$/.test(yearGroup)) throw Object.assign(new Error('Enter a valid year group.'), { status: 400, code: 'year_group' });
    if (await this.findAccount(email)) throw Object.assign(new Error('That email address is already registered.'), { status: 409, code: 'exists' });

    const pool = this.getPool();
    const explicitSchoolId = Number.parseInt(String(input.school || input.schoolId || '').trim(), 10);
    let school = null;
    let schoolId = explicitSchoolId;
    if (!Number.isSafeInteger(schoolId) || schoolId <= 0) {
      school = await this.schoolForEmail(pool, email);
      if (!school || !Number.isSafeInteger(school.id) || school.id <= 0) {
        throw Object.assign(new Error('We could not find a school for that email domain.'), { status: 400, code: 'school_domain' });
      }
      schoolId = school.id;
    }
    const columns = await this.studentColumns(pool);
    const fields = ['name', 'email', 'password_hash', 'school_id'];
    const values = [displayNameFromEmail(email), email, await this.bcrypt.hash(password, Number(this.env.STUDENT_REGISTER_BCRYPT_ROUNDS || 10)), schoolId];
    let yearGroupSaved = false;
    if (columns.has('year_group')) {
      fields.push('year_group');
      values.push(yearGroup);
      yearGroupSaved = true;
    }
    if (columns.has('last_active')) {
      fields.push('last_active');
      values.push(new Date());
    }
    try {
      const sql = `INSERT INTO students (${fields.map(f => '`' + f + '`').join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`;
      const [result] = await pool.execute(sql, values);
      const id = result && result.insertId;
      const account = id ? {
        id: publicId('student', id),
        username: email,
        displayName: values[0],
        accountType: 'student',
        role: 'student',
        schoolId: String(schoolId),
        schoolName: school && school.name ? school.name : undefined,
        yearGroup,
      } : await this.findStudent(pool, email);
      if (!account) throw Object.assign(new Error('Registration could not be completed.'), { status: 500, code: 'register' });
      account.yearGroupSaved = yearGroupSaved;
      return account;
    } catch (e) {
      if (duplicateError(e)) throw Object.assign(new Error('That email address is already registered.'), { status: 409, code: 'exists' });
      throw e;
    }
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
