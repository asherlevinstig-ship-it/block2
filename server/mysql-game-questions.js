const cleanText = (value, max = 255) => String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
const cleanStatus = value => {
  const status = String(value || 'draft').trim().toLowerCase();
  return ['draft', 'teacher-reviewed', 'approved'].includes(status) ? status : 'draft';
};
const cleanHomeworkCadence = value => {
  const cadence = String(value || 'once').trim().toLowerCase();
  return ['once', 'daily', 'weekly'].includes(cadence) ? cadence : 'once';
};
const cleanHomeworkStatus = value => {
  const status = String(value || 'scheduled').trim().toLowerCase();
  return ['draft', 'scheduled', 'live', 'closed'].includes(status) ? status : 'scheduled';
};
const clampInt = (value, min, max) => Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
const hasOwn = (obj, key) => !!obj && Object.prototype.hasOwnProperty.call(obj, key);
const cleanDate = value => {
  const text = String(value || '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
};
const publicDate = value => {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return cleanDate(value);
};
const ymdUTC = value => {
  const d = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
};
const homeworkWeekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function homeworkPeriodKey(row, now = new Date()) {
  const cadence = cleanHomeworkCadence(row && row.cadence);
  if (cadence === 'daily') return 'day:' + ymdUTC(now);
  if (cadence === 'weekly') {
    const d = now instanceof Date ? new Date(now.getTime()) : new Date(now || Date.now());
    const day = Number.isFinite(d.getUTCDay()) ? d.getUTCDay() : 0;
    const target = clampInt(row && row.weekly_day, 0, 6);
    d.setUTCDate(d.getUTCDate() - ((day - target + 7) % 7));
    return 'week:' + ymdUTC(d);
  }
  return 'once';
}
function homeworkPeriodLabel(row) {
  const cadence = cleanHomeworkCadence(row && row.cadence);
  if (cadence === 'daily') return 'Today';
  if (cadence === 'weekly') return homeworkWeekdayNames[clampInt(row && row.weekly_day, 0, 6)] || 'This week';
  return publicDate(row && row.due_date) || 'One-off';
}
function publicHomeworkProgress(row, progress = {}, now = new Date()) {
  const hw = publicHomework(row);
  const required = clampInt(hw.questionCount, 1, 100);
  const current = Math.min(required, clampInt(progress.answered_count ?? progress.answeredCount, 0, required));
  return {
    ...hw,
    periodKey: String(progress.period_key || homeworkPeriodKey(row, now)).slice(0, 32),
    periodLabel: homeworkPeriodLabel(row),
    answeredCount: current,
    completed: current >= required || !!progress.completed_at,
    completedAt: progress.completed_at || null,
    lastAnsweredAt: progress.last_answered_at || null,
  };
}

function sourceIdFromAccount(account, type) {
  const id = String(account && account.id || '');
  const match = id.match(new RegExp('^' + type + '_([0-9]+)$'));
  return match ? Number(match[1]) : 0;
}

function publicQuestion(row) {
  let answers = [];
  try { answers = JSON.parse(row.answers || '[]'); } catch (_) {}
  if (!Array.isArray(answers)) answers = [];
  return {
    id: Number(row.id) || 0,
    schoolId: row.school_id == null ? null : Number(row.school_id),
    subjectId: Number(row.subject_id) || 0,
    subjectName: row.subject_name || '',
    subjectCode: row.subject_code || '',
    teacherId: row.teacher_id == null ? null : Number(row.teacher_id),
    creatorName: row.creator_name || '',
    creatorEmail: row.creator_email || '',
    topic: row.topic || '',
    stage: row.stage || '',
    difficulty: Number(row.difficulty) || 1,
    spec: row.spec || '',
    prompt: row.prompt || '',
    answers,
    correct: Number(row.correct_index) || 0,
    explanation: row.explanation || '',
    reviewStatus: row.review_status || 'draft',
    active: Number(row.is_active) !== 0,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function publicHomework(row) {
  return {
    id: Number(row.id) || 0,
    schoolId: row.school_id == null ? null : Number(row.school_id),
    subjectId: Number(row.subject_id) || 0,
    subjectName: row.subject_name || '',
    subjectCode: row.subject_code || '',
    teacherId: row.teacher_id == null ? null : Number(row.teacher_id),
    classId: row.class_id == null ? null : Number(row.class_id),
    className: row.class_name || '',
    title: row.title || '',
    cadence: row.cadence || 'once',
    dueDate: publicDate(row.due_date),
    weeklyDay: row.weekly_day == null ? null : clampInt(row.weekly_day, 0, 6),
    questionCount: Number(row.question_count) || 10,
    status: row.status || 'scheduled',
    notes: row.notes || '',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

class MySqlGameQuestionStore {
  constructor(options = {}) {
    this.authBackend = options.authBackend || null;
    this.pool = options.pool || null;
    this.ready = false;
  }

  getPool() {
    if (this.pool) return this.pool;
    if (!this.authBackend || typeof this.authBackend.getPool !== 'function') {
      throw Object.assign(new Error('MySQL teacher tools are not configured.'), { status: 503, code: 'mysql' });
    }
    this.pool = this.authBackend.getPool();
    return this.pool;
  }

  async ensureSchema() {
    if (this.ready) return;
    const pool = this.getPool();
    await pool.execute(`CREATE TABLE IF NOT EXISTS game_question (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      school_id INT UNSIGNED NULL,
      subject_id INT UNSIGNED NOT NULL,
      teacher_id INT UNSIGNED NULL,
      topic VARCHAR(96) NOT NULL DEFAULT '',
      stage VARCHAR(32) NOT NULL DEFAULT '',
      difficulty TINYINT UNSIGNED NOT NULL DEFAULT 1,
      spec VARCHAR(96) NOT NULL DEFAULT '',
      prompt TEXT NOT NULL,
      answers LONGTEXT NOT NULL,
      correct_index TINYINT UNSIGNED NOT NULL DEFAULT 0,
      explanation TEXT NOT NULL,
      review_status ENUM('draft','teacher-reviewed','approved') NOT NULL DEFAULT 'draft',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_game_question_subject (subject_id, is_active),
      KEY idx_game_question_teacher (teacher_id),
      KEY idx_game_question_school (school_id),
      KEY idx_game_question_topic (topic)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS game_question_attempt (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      school_id INT UNSIGNED NULL,
      subject_id INT UNSIGNED NOT NULL,
      class_id INT UNSIGNED NULL,
      question_id INT UNSIGNED NOT NULL,
      student_id INT UNSIGNED NULL,
      account_id VARCHAR(96) NOT NULL DEFAULT '',
      answer_index TINYINT UNSIGNED NOT NULL DEFAULT 0,
      correct TINYINT(1) NOT NULL DEFAULT 0,
      duration_ms INT UNSIGNED NOT NULL DEFAULT 0,
      source VARCHAR(32) NOT NULL DEFAULT 'game',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_gqa_subject_created (subject_id, created_at),
      KEY idx_gqa_student (student_id, subject_id),
      KEY idx_gqa_question (question_id),
      KEY idx_gqa_class (class_id, subject_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS teacher_curriculum_request (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      school_id INT UNSIGNED NULL,
      subject_id INT UNSIGNED NOT NULL,
      teacher_id INT UNSIGNED NOT NULL,
      class_id INT UNSIGNED NULL,
      title VARCHAR(160) NOT NULL DEFAULT '',
      topics TEXT NOT NULL,
      syllabus TEXT NOT NULL,
      notes TEXT NOT NULL,
      files_json LONGTEXT NOT NULL,
      notification_email VARCHAR(255) NOT NULL DEFAULT '',
      notification_sent TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_tcr_subject_created (subject_id, created_at),
      KEY idx_tcr_teacher_created (teacher_id, created_at),
      KEY idx_tcr_school_created (school_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS game_homework (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      school_id INT UNSIGNED NULL,
      subject_id INT UNSIGNED NOT NULL,
      teacher_id INT UNSIGNED NOT NULL,
      class_id INT UNSIGNED NULL,
      title VARCHAR(160) NOT NULL DEFAULT '',
      cadence ENUM('once','daily','weekly') NOT NULL DEFAULT 'once',
      due_date DATE NULL,
      weekly_day TINYINT UNSIGNED NULL,
      question_count SMALLINT UNSIGNED NOT NULL DEFAULT 10,
      status ENUM('draft','scheduled','live','closed') NOT NULL DEFAULT 'scheduled',
      notes TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_game_homework_subject_due (subject_id, due_date),
      KEY idx_game_homework_teacher_due (teacher_id, due_date),
      KEY idx_game_homework_class_due (class_id, due_date),
      KEY idx_game_homework_school_due (school_id, due_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS game_homework_progress (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      homework_id BIGINT UNSIGNED NOT NULL,
      school_id INT UNSIGNED NULL,
      subject_id INT UNSIGNED NOT NULL,
      class_id INT UNSIGNED NULL,
      student_id INT UNSIGNED NOT NULL,
      period_key VARCHAR(32) NOT NULL DEFAULT '',
      answered_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      completed_at TIMESTAMP NULL,
      last_answered_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_ghp_homework_student_period (homework_id, student_id, period_key),
      KEY idx_ghp_student_subject (student_id, subject_id),
      KEY idx_ghp_homework (homework_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await this.ensureHomeworkColumns(pool);
    this.ready = true;
  }

  async ensureHomeworkColumns(pool) {
    let columns = [];
    try {
      const [rows] = await pool.execute('SHOW COLUMNS FROM game_homework');
      columns = Array.isArray(rows) ? rows.map(row => String(row.Field || '').toLowerCase()) : [];
    } catch (_) {
      return;
    }
    if (!columns.includes('weekly_day')) {
      await pool.execute('ALTER TABLE game_homework ADD COLUMN weekly_day TINYINT UNSIGNED NULL AFTER due_date');
    }
    await pool.execute('ALTER TABLE game_homework MODIFY COLUMN due_date DATE NULL').catch(() => {});
  }

  teacherIds(account) {
    const teacherId = sourceIdFromAccount(account, 'teacher');
    if (!teacherId) throw Object.assign(new Error('Teacher account required.'), { status: 403, code: 'teacher' });
    const schoolId = clampInt(account && account.schoolId, 0, 2147483647);
    return { teacherId, schoolId };
  }

  async safeQuery(sql, params = []) {
    try {
      const [rows] = await this.getPool().execute(sql, params);
      return Array.isArray(rows) ? rows : [];
    } catch (_) {
      return [];
    }
  }

  uniqueSubjectRows(rows) {
    const seen = new Set();
    const out = [];
    for (const row of rows || []) {
      const id = Number(row && row.id) || 0;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(row);
    }
    return out;
  }

  uniqueClassRows(rows) {
    const seen = new Set();
    const out = [];
    for (const row of rows || []) {
      const id = Number(row && row.id) || 0;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(row);
    }
    return out;
  }

  async teacherSubjectRows(account, subjectId = 0) {
    const { teacherId, schoolId } = this.teacherIds(account);
    subjectId = clampInt(subjectId, 0, 2147483647);
    const activeSchoolWhere = `s.is_active = 1
       AND (s.school_id IS NULL OR ? = 0 OR s.school_id = ?)
       ${subjectId ? 'AND s.id = ?' : ''}`;
    const subjectParam = subjectId ? [subjectId] : [];
    const candidates = [
      [
        `SELECT DISTINCT s.id, s.name, s.code, s.school_id
         FROM subjects s
         JOIN teacher_subjects ts ON ts.subject_id = s.id AND ts.teacher_id = ?
         WHERE ${activeSchoolWhere}
         ORDER BY s.name ASC`,
        [teacherId, schoolId, schoolId, ...subjectParam],
      ],
      [
        `SELECT DISTINCT s.id, s.name, s.code, s.school_id
         FROM subjects s
         JOIN class_subjects cs ON cs.subject_id = s.id
         JOIN class_subject_teachers cst ON cst.class_subject_id = cs.id AND cst.teacher_id = ?
         WHERE ${activeSchoolWhere}
         ORDER BY s.name ASC`,
        [teacherId, schoolId, schoolId, ...subjectParam],
      ],
      [
        `SELECT DISTINCT s.id, s.name, s.code, s.school_id
         FROM subjects s
         JOIN class_subjects cs ON cs.subject_id = s.id
         JOIN classes c ON c.id = cs.class_id AND c.teacher_id = ?
         WHERE ${activeSchoolWhere}
         ORDER BY s.name ASC`,
        [teacherId, schoolId, schoolId, ...subjectParam],
      ],
      [
        `SELECT DISTINCT s.id, s.name, s.code, s.school_id
         FROM subjects s
         WHERE ${activeSchoolWhere}
           AND s.teacher_id = ?
         ORDER BY s.name ASC`,
        [schoolId, schoolId, ...subjectParam, teacherId],
      ],
    ];
    let rows = [];
    for (const [sql, params] of candidates) rows = rows.concat(await this.safeQuery(sql, params));
    rows = this.uniqueSubjectRows(rows);
    if (rows.length) return rows;
    return this.uniqueSubjectRows(await this.safeQuery(
      `SELECT DISTINCT s.id, s.name, s.code, s.school_id
       FROM subjects s
       WHERE ${activeSchoolWhere}
       ORDER BY s.name ASC`,
      [schoolId, schoolId, ...subjectParam],
    ));
  }

  async assertTeacherSubject(account, subjectId) {
    const { teacherId, schoolId } = this.teacherIds(account);
    subjectId = clampInt(subjectId, 1, 2147483647);
    const rows = await this.teacherSubjectRows(account, subjectId);
    const subject = rows && rows[0];
    if (!subject) throw Object.assign(new Error('Subject not found or not assigned to this teacher.'), { status: 403, code: 'subject' });
    return { teacherId, schoolId, subject };
  }

  async listSubjects(account) {
    const rows = await this.teacherSubjectRows(account);
    return (rows || []).map(row => ({
      id: Number(row.id) || 0,
      name: String(row.name || ''),
      code: String(row.code || ''),
      schoolId: row.school_id == null ? null : Number(row.school_id),
    }));
  }

  async listStudentSubjects(account) {
    await this.ensureSchema();
    const studentId = sourceIdFromAccount(account, 'student');
    if (!studentId) return [];
    const schoolId = clampInt(account && account.schoolId, 0, 2147483647);
    const pool = this.getPool();
    const classIds = await this.studentClassIds(pool, studentId);
    let rows = [];
    if (classIds.length) {
      rows = rows.concat(await this.safeQuery(
        `SELECT DISTINCT s.id, s.name, s.code, s.school_id
         FROM subjects s
         JOIN class_subjects cs ON cs.subject_id = s.id
         WHERE s.is_active = 1
           AND cs.class_id IN (${classIds.map(() => '?').join(',')})
           AND (s.school_id IS NULL OR ? = 0 OR s.school_id = ?)
         ORDER BY s.name ASC`,
        [...classIds, schoolId, schoolId],
      ));
      rows = rows.concat(await this.safeQuery(
        `SELECT DISTINCT s.id, s.name, s.code, s.school_id
         FROM subjects s
         JOIN classes c ON c.subject_id = s.id
         WHERE s.is_active = 1
           AND c.id IN (${classIds.map(() => '?').join(',')})
           AND (s.school_id IS NULL OR ? = 0 OR s.school_id = ?)
         ORDER BY s.name ASC`,
        [...classIds, schoolId, schoolId],
      ));
    }
    rows = this.uniqueSubjectRows(rows);
    if (!rows.length) rows = this.uniqueSubjectRows(await this.safeQuery(
      `SELECT DISTINCT s.id, s.name, s.code, s.school_id
       FROM subjects s
       WHERE s.is_active = 1
         AND (s.school_id IS NULL OR ? = 0 OR s.school_id = ?)
       ORDER BY s.name ASC`,
      [schoolId, schoolId],
    ));
    return (rows || []).map(row => ({
      id: Number(row.id) || 0,
      name: String(row.name || ''),
      code: String(row.code || ''),
      schoolId: row.school_id == null ? null : Number(row.school_id),
    }));
  }

  async listClasses(account, subjectId) {
    const { teacherId, schoolId } = await this.assertTeacherSubject(account, subjectId);
    subjectId = clampInt(subjectId, 1, 2147483647);
    const candidates = [
      [
        `SELECT DISTINCT c.id, c.name, c.join_code, c.is_active
         FROM classes c
         JOIN class_subjects cs ON cs.class_id = c.id AND cs.subject_id = ?
         JOIN class_subject_teachers cst ON cst.class_subject_id = cs.id AND cst.teacher_id = ?
         ORDER BY c.name ASC`,
        [subjectId, teacherId],
      ],
      [
        `SELECT DISTINCT c.id, c.name, c.join_code, c.is_active
         FROM classes c
         JOIN class_subjects cs ON cs.class_id = c.id AND cs.subject_id = ?
         JOIN class_teachers ct ON ct.class_id = c.id AND ct.teacher_id = ?
         ORDER BY c.name ASC`,
        [subjectId, teacherId],
      ],
      [
        `SELECT DISTINCT c.id, c.name, c.join_code, c.is_active
         FROM classes c
         JOIN class_subjects cs ON cs.class_id = c.id AND cs.subject_id = ?
         WHERE c.teacher_id = ?
         ORDER BY c.name ASC`,
        [subjectId, teacherId],
      ],
      [
        `SELECT DISTINCT c.id, c.name, c.join_code, c.is_active
         FROM classes c
         WHERE c.subject_id = ? AND c.teacher_id = ?
         ORDER BY c.name ASC`,
        [subjectId, teacherId],
      ],
    ];
    let rows = [];
    for (const [sql, params] of candidates) rows = rows.concat(await this.safeQuery(sql, params));
    rows = this.uniqueClassRows(rows);
    if (!rows.length) {
      rows = this.uniqueClassRows(await this.safeQuery(
        `SELECT DISTINCT c.id, c.name, c.join_code, c.is_active
         FROM classes c
         JOIN class_subjects cs ON cs.class_id = c.id AND cs.subject_id = ?
         WHERE (c.school_id IS NULL OR ? = 0 OR c.school_id = ?)
         ORDER BY c.name ASC`,
        [subjectId, schoolId, schoolId],
      ));
    }
    if (!rows.length) {
      rows = this.uniqueClassRows(await this.safeQuery(
        `SELECT DISTINCT c.id, c.name, c.join_code, c.is_active
         FROM classes c
         WHERE (c.school_id IS NULL OR ? = 0 OR c.school_id = ?)
         ORDER BY c.name ASC`,
        [schoolId, schoolId],
      ));
    }
    return (rows || []).map(row => ({
      id: Number(row.id) || 0,
      name: String(row.name || ''),
      joinCode: String(row.join_code || ''),
      active: Number(row.is_active) !== 0,
    }));
  }

  normalizeQuestionPatch(input = {}) {
    const answers = Array.isArray(input.answers) ? input.answers.map(v => cleanText(v, 160)).filter(Boolean).slice(0, 4) : [];
    if (answers.length !== 4 || new Set(answers.map(v => v.toLowerCase())).size !== 4) {
      throw Object.assign(new Error('Game questions need four unique answers.'), { status: 400, code: 'answers' });
    }
    const prompt = cleanText(input.prompt, 500);
    if (prompt.length < 10) throw Object.assign(new Error('Question prompt is too short.'), { status: 400, code: 'prompt' });
    const explanation = cleanText(input.explanation, 800);
    if (explanation.length < 10) throw Object.assign(new Error('Add a short teaching explanation.'), { status: 400, code: 'explanation' });
    return {
      topic: cleanText(input.topic, 96),
      stage: cleanText(input.stage, 32),
      difficulty: clampInt(input.difficulty || 1, 1, 3),
      spec: cleanText(input.spec, 96),
      prompt,
      answers,
      correct: clampInt(input.correct, 0, 3),
      explanation,
      reviewStatus: cleanStatus(input.reviewStatus || input.review_status),
      active: input.active !== false && Number(input.is_active) !== 0,
    };
  }

  async listQuestions(account, query = {}) {
    await this.ensureSchema();
    const subjectId = clampInt(query.subjectId || query.subject_id, 1, 2147483647);
    const { schoolId, subject } = await this.assertTeacherSubject(account, subjectId);
    const topic = cleanText(query.topic, 96);
    const status = cleanStatus(query.reviewStatus || query.review_status || '');
    const params = [subjectId];
    let where = 'gq.subject_id = ?';
    const scopeSchoolId = subject.school_id == null ? schoolId : Number(subject.school_id);
    if (scopeSchoolId) { where += ' AND (gq.school_id IS NULL OR gq.school_id = ?)'; params.push(scopeSchoolId); }
    if (topic) { where += ' AND LOWER(gq.topic) = LOWER(?)'; params.push(topic); }
    if (query.reviewStatus || query.review_status) { where += ' AND gq.review_status = ?'; params.push(status); }
    if (query.includeInactive !== true && query.include_inactive !== '1') where += ' AND gq.is_active = 1';
    const [rows] = await this.getPool().execute(
      `SELECT gq.*, s.name AS subject_name, s.code AS subject_code, t.name AS creator_name, t.email AS creator_email
       FROM game_question gq
       LEFT JOIN subjects s ON s.id = gq.subject_id
       LEFT JOIN teachers t ON t.id = gq.teacher_id
       WHERE ${where}
       ORDER BY gq.updated_at DESC, gq.id DESC
       LIMIT 500`,
      params,
    );
    return (rows || []).map(publicQuestion);
  }

  async createQuestion(account, input = {}) {
    await this.ensureSchema();
    const subjectId = clampInt(input.subjectId || input.subject_id, 1, 2147483647);
    const { teacherId, schoolId, subject } = await this.assertTeacherSubject(account, subjectId);
    const patch = this.normalizeQuestionPatch(input);
    const [result] = await this.getPool().execute(
      `INSERT INTO game_question
       (school_id, subject_id, teacher_id, topic, stage, difficulty, spec, prompt, answers, correct_index, explanation, review_status, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        subject.school_id == null ? (schoolId || null) : subject.school_id,
        subjectId,
        teacherId,
        patch.topic,
        patch.stage,
        patch.difficulty,
        patch.spec,
        patch.prompt,
        JSON.stringify(patch.answers),
        patch.correct,
        patch.explanation,
        patch.reviewStatus,
        patch.active ? 1 : 0,
      ],
    );
    return this.getQuestion(account, Number(result.insertId || 0));
  }

  async getQuestion(account, questionId) {
    await this.ensureSchema();
    const id = clampInt(questionId, 1, 2147483647);
    const [rows] = await this.getPool().execute(
      `SELECT gq.*, s.name AS subject_name, s.code AS subject_code, t.name AS creator_name, t.email AS creator_email
       FROM game_question gq
       LEFT JOIN subjects s ON s.id = gq.subject_id
       LEFT JOIN teachers t ON t.id = gq.teacher_id
       WHERE gq.id = ?
       LIMIT 1`,
      [id],
    );
    const row = rows && rows[0];
    if (!row) throw Object.assign(new Error('Game question not found.'), { status: 404, code: 'question' });
    const { schoolId, subject } = await this.assertTeacherSubject(account, row.subject_id);
    const scopeSchoolId = subject.school_id == null ? schoolId : Number(subject.school_id);
    if (scopeSchoolId && row.school_id != null && Number(row.school_id) !== Number(scopeSchoolId)) {
      throw Object.assign(new Error('Game question not found.'), { status: 404, code: 'question' });
    }
    return publicQuestion(row);
  }

  async updateQuestion(account, questionId, input = {}) {
    await this.ensureSchema();
    const existing = await this.getQuestion(account, questionId);
    const next = this.normalizeQuestionPatch({ ...existing, ...input, answers: input.answers || existing.answers, correct: Object.prototype.hasOwnProperty.call(input, 'correct') ? input.correct : existing.correct });
    await this.getPool().execute(
      `UPDATE game_question
       SET topic = ?, stage = ?, difficulty = ?, spec = ?, prompt = ?, answers = ?, correct_index = ?, explanation = ?, review_status = ?, is_active = ?
       WHERE id = ?`,
      [next.topic, next.stage, next.difficulty, next.spec, next.prompt, JSON.stringify(next.answers), next.correct, next.explanation, next.reviewStatus, next.active ? 1 : 0, existing.id],
    );
    return this.getQuestion(account, existing.id);
  }

  normalizeHomeworkPatch(input = {}) {
    const title = cleanText(input.title, 160);
    const cadence = cleanHomeworkCadence(input.cadence || input.schedule);
    const dueDate = cleanDate(input.dueDate || input.due_date);
    if (title.length < 3) throw Object.assign(new Error('Add a short homework title.'), { status: 400, code: 'title' });
    if (cadence === 'once' && !dueDate) throw Object.assign(new Error('Choose a homework due date.'), { status: 400, code: 'due_date' });
    const weeklyDay = hasOwn(input, 'weeklyDay') || hasOwn(input, 'weekly_day') ? clampInt(input.weeklyDay ?? input.weekly_day, 0, 6) : null;
    if (cadence === 'weekly' && weeklyDay == null) throw Object.assign(new Error('Choose the weekly homework day.'), { status: 400, code: 'weekly_day' });
    return {
      classId: clampInt(input.classId || input.class_id, 0, 2147483647),
      title,
      cadence,
      dueDate: cadence === 'once' ? dueDate : '',
      weeklyDay: cadence === 'weekly' ? weeklyDay : null,
      questionCount: clampInt(input.questionCount || input.question_count || 10, 1, 100),
      status: cleanHomeworkStatus(input.status),
      notes: cleanText(input.notes, 1000),
    };
  }

  async listHomework(account, query = {}) {
    await this.ensureSchema();
    const subjectId = clampInt(query.subjectId || query.subject_id, 1, 2147483647);
    await this.assertTeacherSubject(account, subjectId);
    const classId = clampInt(query.classId || query.class_id, 0, 2147483647);
    const params = [subjectId];
    let where = 'gh.subject_id = ?';
    if (classId) { where += ' AND gh.class_id = ?'; params.push(classId); }
    const [rows] = await this.getPool().execute(
      `SELECT gh.*, s.name AS subject_name, s.code AS subject_code, c.name AS class_name
       FROM game_homework gh
       LEFT JOIN subjects s ON s.id = gh.subject_id
       LEFT JOIN classes c ON c.id = gh.class_id
       WHERE ${where}
       ORDER BY COALESCE(gh.due_date, '9999-12-31') ASC, gh.weekly_day ASC, gh.updated_at DESC
       LIMIT 200`,
      params,
    );
    return (rows || []).map(publicHomework);
  }

  async createHomework(account, input = {}) {
    await this.ensureSchema();
    const subjectId = clampInt(input.subjectId || input.subject_id, 1, 2147483647);
    const { teacherId, schoolId, subject } = await this.assertTeacherSubject(account, subjectId);
    const patch = this.normalizeHomeworkPatch(input);
    const [result] = await this.getPool().execute(
      `INSERT INTO game_homework
       (school_id, subject_id, teacher_id, class_id, title, cadence, due_date, weekly_day, question_count, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        subject.school_id == null ? (schoolId || null) : subject.school_id,
        subjectId,
        teacherId,
        patch.classId || null,
        patch.title,
        patch.cadence,
        patch.dueDate || null,
        patch.weeklyDay,
        patch.questionCount,
        patch.status,
        patch.notes,
      ],
    );
    const [rows] = await this.getPool().execute(
      `SELECT gh.*, s.name AS subject_name, s.code AS subject_code, c.name AS class_name
       FROM game_homework gh
       LEFT JOIN subjects s ON s.id = gh.subject_id
       LEFT JOIN classes c ON c.id = gh.class_id
       WHERE gh.id = ?
       LIMIT 1`,
      [Number(result.insertId || 0)],
    );
    return publicHomework(rows && rows[0] || { id: Number(result.insertId || 0), subject_id: subjectId, teacher_id: teacherId, title: patch.title, cadence: patch.cadence, due_date: patch.dueDate || null, weekly_day: patch.weeklyDay, question_count: patch.questionCount, status: patch.status, notes: patch.notes });
  }

  async studentClassIds(pool, studentId) {
    const id = clampInt(studentId, 1, 2147483647);
    const ids = new Set();
    const queries = [
      ['SELECT class_id FROM students WHERE id = ? LIMIT 1', [id]],
      ['SELECT class_id FROM student_classes WHERE student_id = ?', [id]],
      ['SELECT class_id FROM class_students WHERE student_id = ?', [id]],
    ];
    for (const [sql, params] of queries) {
      try {
        const [rows] = await pool.execute(sql, params);
        for (const row of rows || []) {
          const classId = clampInt(row.class_id, 0, 2147483647);
          if (classId) ids.add(classId);
        }
      } catch (_) {}
    }
    return [...ids].slice(0, 20);
  }

  async studentRosterRows(account, classId = 0) {
    const schoolId = clampInt(account && account.schoolId, 0, 2147483647);
    classId = clampInt(classId, 0, 2147483647);
    const schoolWhere = '(s.school_id IS NULL OR ? = 0 OR s.school_id = ?)';
    let rows = [];
    if (classId) {
      const candidates = [
        [`SELECT s.id, s.name, s.email, s.school_id FROM students s WHERE s.class_id = ? AND ${schoolWhere} ORDER BY s.name ASC, s.email ASC LIMIT 500`, [classId, schoolId, schoolId]],
        [`SELECT s.id, s.name, s.email, s.school_id FROM students s JOIN student_classes sc ON sc.student_id = s.id WHERE sc.class_id = ? AND ${schoolWhere} ORDER BY s.name ASC, s.email ASC LIMIT 500`, [classId, schoolId, schoolId]],
        [`SELECT s.id, s.name, s.email, s.school_id FROM students s JOIN class_students cs ON cs.student_id = s.id WHERE cs.class_id = ? AND ${schoolWhere} ORDER BY s.name ASC, s.email ASC LIMIT 500`, [classId, schoolId, schoolId]],
      ];
      for (const [sql, params] of candidates) rows = rows.concat(await this.safeQuery(sql, params));
    } else if (schoolId) {
      rows = await this.safeQuery(
        `SELECT s.id, s.name, s.email, s.school_id
         FROM students s
         WHERE ${schoolWhere}
         ORDER BY s.name ASC, s.email ASC
         LIMIT 500`,
        [schoolId, schoolId],
      );
    }
    const seen = new Set();
    return (rows || []).filter(row => {
      const id = Number(row && row.id) || 0;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  async activeHomeworkRowsForStudent(account, subjectId = 0) {
    const studentId = sourceIdFromAccount(account, 'student');
    if (!studentId) return { studentId: 0, rows: [] };
    const schoolId = clampInt(account && account.schoolId, 0, 2147483647);
    const pool = this.getPool();
    const classIds = await this.studentClassIds(pool, studentId);
    const params = [schoolId, schoolId];
    let where = `gh.status IN ('scheduled','live')
      AND (gh.school_id IS NULL OR ? = 0 OR gh.school_id = ?)
      AND (gh.class_id IS NULL OR gh.class_id = 0`;
    if (classIds.length) {
      where += ` OR gh.class_id IN (${classIds.map(() => '?').join(',')})`;
      params.push(...classIds);
    }
    where += `)
      AND (
        gh.cadence IN ('daily','weekly')
        OR gh.due_date IS NULL
        OR gh.due_date >= CURDATE()
      )`;
    if (subjectId) { where += ' AND gh.subject_id = ?'; params.push(subjectId); }
    const [rows] = await pool.execute(
      `SELECT gh.*, s.name AS subject_name, s.code AS subject_code, c.name AS class_name
       FROM game_homework gh
       LEFT JOIN subjects s ON s.id = gh.subject_id
       LEFT JOIN classes c ON c.id = gh.class_id
       WHERE ${where}
       ORDER BY gh.status = 'live' DESC, COALESCE(gh.due_date, '9999-12-31') ASC, gh.weekly_day ASC, gh.updated_at DESC
       LIMIT 12`,
      params,
    );
    return { studentId, rows: rows || [] };
  }

  async homeworkProgressForStudent(account, query = {}) {
    await this.ensureSchema();
    const subjectId = clampInt(query.subjectId || query.subject_id, 0, 2147483647);
    const now = new Date();
    const { studentId, rows } = await this.activeHomeworkRowsForStudent(account, subjectId);
    if (!studentId || !rows.length) return [];
    const keys = rows.map(row => homeworkPeriodKey(row, now));
    const ids = rows.map(row => Number(row.id) || 0).filter(Boolean);
    const progressBy = new Map();
    if (ids.length) {
      const [progressRows] = await this.getPool().execute(
        `SELECT homework_id, period_key, answered_count, completed_at, last_answered_at
         FROM game_homework_progress
         WHERE student_id = ?
           AND homework_id IN (${ids.map(() => '?').join(',')})
           AND period_key IN (${keys.map(() => '?').join(',')})`,
        [studentId, ...ids, ...keys],
      );
      for (const row of progressRows || []) progressBy.set(`${row.homework_id}:${row.period_key}`, row);
    }
    return rows
      .map(row => publicHomeworkProgress(row, progressBy.get(`${row.id}:${homeworkPeriodKey(row, now)}`), now))
      .sort((a, b) => Number(a.completed) - Number(b.completed) || a.title.localeCompare(b.title));
  }

  async recordHomeworkProgress(account, subjectId, options = {}) {
    const now = new Date();
    const { studentId, rows: subjectRows } = await this.activeHomeworkRowsForStudent(account, subjectId);
    let rows = subjectRows;
    if (studentId && !rows.length && options.fallbackToAnyActive) {
      const fallback = await this.activeHomeworkRowsForStudent(account, 0);
      rows = (fallback.rows || []).slice(0, 1);
    }
    if (!studentId || !rows.length) return [];
    const pool = this.getPool();
    for (const row of rows) {
      const periodKey = homeworkPeriodKey(row, now);
      const required = clampInt(row.question_count, 1, 100);
      await pool.execute(
        `INSERT INTO game_homework_progress
         (homework_id, school_id, subject_id, class_id, student_id, period_key, answered_count, completed_at, last_answered_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, CASE WHEN 1 >= ? THEN NOW() ELSE NULL END, NOW())
         ON DUPLICATE KEY UPDATE
           answered_count = LEAST(?, answered_count + CASE WHEN completed_at IS NULL THEN 1 ELSE 0 END),
           completed_at = CASE
             WHEN completed_at IS NOT NULL THEN completed_at
             WHEN LEAST(?, answered_count + 1) >= ? THEN NOW()
             ELSE NULL
           END,
           last_answered_at = NOW()`,
        [
          Number(row.id) || 0,
          row.school_id == null ? null : Number(row.school_id),
          Number(row.subject_id) || subjectId,
          row.class_id == null ? null : Number(row.class_id),
          studentId,
          periodKey,
          required,
          required,
          required,
          required,
        ],
      );
    }
    return this.homeworkProgressForStudent(account, {});
  }

  async createCurriculumRequest(account, input = {}) {
    await this.ensureSchema();
    const subjectId = clampInt(input.subjectId || input.subject_id, 1, 2147483647);
    const { teacherId, schoolId, subject } = await this.assertTeacherSubject(account, subjectId);
    const title = cleanText(input.title, 160);
    const topics = cleanText(input.topics, 5000);
    const syllabus = cleanText(input.syllabus, 5000);
    const notes = cleanText(input.notes, 5000);
    if (!title || title.length < 3) throw Object.assign(new Error('Add a short title for the curriculum request.'), { status: 400, code: 'title' });
    if (!topics && !syllabus && !notes && !(Array.isArray(input.files) && input.files.length)) {
      throw Object.assign(new Error('Add topics, syllabus notes, or at least one uploaded file.'), { status: 400, code: 'content' });
    }
    const files = Array.isArray(input.files) ? input.files.map(file => ({
      originalName: cleanText(file.originalName, 255),
      storedName: cleanText(file.storedName, 255),
      path: cleanText(file.path, 500),
      mimeType: cleanText(file.mimeType, 120),
      size: clampInt(file.size, 0, 50 * 1024 * 1024),
    })).filter(file => file.storedName && file.path) : [];
    const classId = clampInt(input.classId || input.class_id, 0, 2147483647);
    const notificationEmail = cleanText(input.notificationEmail, 255);
    const [result] = await this.getPool().execute(
      `INSERT INTO teacher_curriculum_request
       (school_id, subject_id, teacher_id, class_id, title, topics, syllabus, notes, files_json, notification_email, notification_sent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        subject.school_id == null ? (schoolId || null) : subject.school_id,
        subjectId,
        teacherId,
        classId || null,
        title,
        topics,
        syllabus,
        notes,
        JSON.stringify(files),
        notificationEmail,
        input.notificationSent ? 1 : 0,
      ],
    );
    return {
      id: Number(result.insertId) || 0,
      subjectId,
      subjectName: String(subject.name || ''),
      teacherId,
      classId: classId || null,
      title,
      topics,
      syllabus,
      notes,
      files,
      notificationEmail,
      notificationSent: !!input.notificationSent,
    };
  }

  async markCurriculumNotification(account, requestId, sent, email = '') {
    await this.ensureSchema();
    const { teacherId } = this.teacherIds(account);
    const id = clampInt(requestId, 1, Number.MAX_SAFE_INTEGER);
    await this.getPool().execute(
      `UPDATE teacher_curriculum_request
       SET notification_sent = ?, notification_email = ?
       WHERE id = ? AND teacher_id = ?`,
      [sent ? 1 : 0, cleanText(email, 255), id, teacherId],
    );
  }

  async recordRecallAttempt(account, input = {}) {
    await this.ensureSchema();
    const studentId = sourceIdFromAccount(account, 'student');
    if (!studentId) return { recorded: false, reason: 'student' };
    const schoolId = clampInt(account && account.schoolId, 0, 2147483647);
    const subjectName = cleanText(input.subject, 96);
    if (!subjectName) return { recorded: false, reason: 'subject' };
    const pool = this.getPool();
    const [subjectRows] = await pool.execute(
      `SELECT id, school_id FROM subjects
       WHERE is_active = 1
         AND (LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?))
         AND (school_id IS NULL OR ? = 0 OR school_id = ?)
       ORDER BY CASE WHEN school_id = ? THEN 0 ELSE 1 END, id ASC
       LIMIT 1`,
      [subjectName, subjectName, schoolId, schoolId, schoolId],
    );
    const subject = subjectRows && subjectRows[0];
    if (!subject) return { recorded: false, reason: 'subject' };
    const subjectId = Number(subject.id) || 0;
    const prompt = cleanText(input.prompt, 500);
    const answers = Array.isArray(input.answers) ? input.answers.map(v => cleanText(v, 160)).filter(Boolean).slice(0, 4) : [];
    if (!subjectId || prompt.length < 3 || answers.length !== 4) return { recorded: false, reason: 'question' };
    const scopeSchoolId = subject.school_id == null ? schoolId : Number(subject.school_id);
    const [questionRows] = await pool.execute(
      `SELECT id FROM game_question
       WHERE subject_id = ? AND prompt = ?
         AND (school_id IS NULL OR ? = 0 OR school_id = ?)
       ORDER BY id ASC
       LIMIT 1`,
      [subjectId, prompt, scopeSchoolId, scopeSchoolId],
    );
    let questionId = questionRows && questionRows[0] && Number(questionRows[0].id) || 0;
    if (!questionId) {
      const [result] = await pool.execute(
        `INSERT INTO game_question
         (school_id, subject_id, teacher_id, topic, stage, difficulty, spec, prompt, answers, correct_index, explanation, review_status, is_active)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 1)`,
        [
          subject.school_id == null ? (schoolId || null) : subject.school_id,
          subjectId,
          cleanText(input.topic, 96),
          cleanText(input.stage, 32),
          clampInt(input.difficulty || 1, 1, 3),
          cleanText(input.spec || 'recall-bank', 96),
          prompt,
          JSON.stringify(answers),
          clampInt(input.correctIndex, 0, 3),
          cleanText(input.explanation || 'Recorded from a Recall question.', 800),
        ],
      );
      questionId = Number(result && result.insertId) || 0;
    }
    if (!questionId) return { recorded: false, reason: 'question' };
    await pool.execute(
      `INSERT INTO game_question_attempt
       (school_id, subject_id, class_id, question_id, student_id, account_id, answer_index, correct, duration_ms, source)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
      [
        subject.school_id == null ? (schoolId || null) : subject.school_id,
        subjectId,
        questionId,
        studentId,
        String(account.id || ''),
        clampInt(input.answerIndex, 0, 3),
        input.correct ? 1 : 0,
        clampInt(input.durationMs, 0, 60 * 60 * 1000),
        cleanText(input.source || 'recall', 32) || 'recall',
      ],
    );
    const homeworkObjectives = await this.recordHomeworkProgress(account, subjectId, { fallbackToAnyActive: true });
    return { recorded: true, subjectId, questionId, studentId, homeworkObjectives };
  }

  async analytics(account, query = {}) {
    await this.ensureSchema();
    const subjectId = clampInt(query.subjectId || query.subject_id, 1, 2147483647);
    const { schoolId, subject } = await this.assertTeacherSubject(account, subjectId);
    const scopeSchoolId = subject.school_id == null ? schoolId : Number(subject.school_id);
    const classId = clampInt(query.classId || query.class_id, 0, 2147483647);
    const days = clampInt(query.days || 30, 1, 365);
    const rosterRows = await this.studentRosterRows(account, classId);
    const rosterIds = rosterRows.map(row => Number(row.id) || 0).filter(Boolean);
    const params = [subjectId, days];
    let attemptWhere = 'gqa.subject_id = ? AND gqa.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)';
    if (classId) {
      attemptWhere += ' AND (gqa.class_id = ?';
      params.push(classId);
      if (rosterIds.length) {
        attemptWhere += ` OR gqa.student_id IN (${rosterIds.map(() => '?').join(',')})`;
        params.push(...rosterIds);
      }
      attemptWhere += ')';
    }
    const [studentRows] = await this.getPool().execute(
      `SELECT
         COALESCE(gqa.student_id, 0) AS student_id,
         COALESCE(s.name, s.email, gqa.account_id, 'Unknown student') AS student_name,
         COALESCE(s.email, '') AS student_email,
         COUNT(*) AS attempts,
         SUM(CASE WHEN gqa.correct = 1 THEN 1 ELSE 0 END) AS correct,
         MAX(gqa.created_at) AS last_attempt_at
       FROM game_question_attempt gqa
       LEFT JOIN students s ON s.id = gqa.student_id
       WHERE ${attemptWhere}
       GROUP BY COALESCE(gqa.student_id, 0), student_name, student_email
       ORDER BY attempts DESC, student_name ASC
      LIMIT 200`,
      params,
    );
    let questionAttemptClassJoin = '';
    const questionParams = [days];
    if (classId) {
      questionAttemptClassJoin = 'AND (gqa.class_id = ?';
      questionParams.push(classId);
      if (rosterIds.length) {
        questionAttemptClassJoin += ` OR gqa.student_id IN (${rosterIds.map(() => '?').join(',')})`;
        questionParams.push(...rosterIds);
      }
      questionAttemptClassJoin += ')';
    }
    questionParams.push(subjectId);
    let questionWhere = 'gq.subject_id = ?';
    if (scopeSchoolId) { questionWhere += ' AND (gq.school_id IS NULL OR gq.school_id = ?)'; questionParams.push(scopeSchoolId); }
    const [questionRows] = await this.getPool().execute(
      `SELECT
         gq.id,
         gq.topic,
         gq.stage,
         gq.prompt,
         gq.review_status,
         COUNT(gqa.id) AS attempts,
         SUM(CASE WHEN gqa.correct = 1 THEN 1 ELSE 0 END) AS correct
       FROM game_question gq
       LEFT JOIN game_question_attempt gqa
         ON gqa.question_id = gq.id
        AND gqa.subject_id = gq.subject_id
        AND gqa.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        ${questionAttemptClassJoin}
       WHERE ${questionWhere}
       GROUP BY gq.id, gq.topic, gq.stage, gq.prompt, gq.review_status
       ORDER BY attempts DESC, gq.updated_at DESC
       LIMIT 200`,
      questionParams,
    );
    const normalize = row => {
      const attempts = Number(row.attempts) || 0;
      const correct = Number(row.correct) || 0;
      return { attempts, correct, accuracy: attempts ? Math.round((correct / attempts) * 100) : 0 };
    };
    const byStudent = new Map();
    for (const row of rosterRows || []) {
      const id = Number(row.id) || 0;
      if (!id) continue;
      byStudent.set(id, {
        id,
        name: String(row.name || row.email || 'Unknown student'),
        email: String(row.email || ''),
        lastAttemptAt: null,
        attempts: 0,
        correct: 0,
        accuracy: 0,
      });
    }
    for (const row of studentRows || []) {
      const id = Number(row.student_id) || 0;
      const summary = {
        id,
        name: String(row.student_name || 'Unknown student'),
        email: String(row.student_email || ''),
        lastAttemptAt: row.last_attempt_at || null,
        ...normalize(row),
      };
      if (id && byStudent.has(id)) byStudent.set(id, { ...byStudent.get(id), ...summary });
      else byStudent.set(id || `unknown:${summary.name}`, summary);
    }
    const students = [...byStudent.values()].sort((a, b) => {
      const support = Number(a.attempts > 0) - Number(b.attempts > 0);
      return support || a.accuracy - b.accuracy || b.attempts - a.attempts || a.name.localeCompare(b.name);
    });
    const questions = (questionRows || []).map(row => ({
      id: Number(row.id) || 0,
      topic: String(row.topic || ''),
      stage: String(row.stage || ''),
      prompt: String(row.prompt || ''),
      reviewStatus: String(row.review_status || 'draft'),
      ...normalize(row),
    }));
    const totals = students.reduce((acc, row) => {
      acc.attempts += row.attempts;
      acc.correct += row.correct;
      return acc;
    }, { attempts: 0, correct: 0 });
    return {
      windowDays: days,
      classId: classId || null,
      totals: { ...totals, accuracy: totals.attempts ? Math.round((totals.correct / totals.attempts) * 100) : 0 },
      students,
      questions,
    };
  }
}

module.exports = { MySqlGameQuestionStore, sourceIdFromAccount, publicQuestion };
