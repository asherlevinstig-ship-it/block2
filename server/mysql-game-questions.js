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

function isCurriculumAdminAccount(account) {
  const role = String(account && (account.role || account.accountType) || '').trim().toLowerCase();
  const username = String(account && (account.username || account.email) || '').trim().toLowerCase();
  const displayName = String(account && account.displayName || '').trim().toLowerCase();
  const id = String(account && account.id || '').trim().toLowerCase();
  return role === 'admin'
    || username === 'asherlevin85@gmail.com'
    || username === 'asherlevin85'
    || username === 'asherlevin'
    || displayName === 'asherlevin'
    || displayName === 'asher levin'
    || id === 'asherlevin';
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

function publicCurriculumRequest(row) {
  let files = [];
  try { files = JSON.parse(row.files_json || '[]'); } catch (_) {}
  if (!Array.isArray(files)) files = [];
  return {
    id: Number(row.id) || 0,
    schoolId: row.school_id == null ? null : Number(row.school_id),
    subjectId: Number(row.subject_id) || 0,
    subjectName: row.subject_name || '',
    subjectCode: row.subject_code || '',
    teacherId: row.teacher_id == null ? null : Number(row.teacher_id),
    teacherName: row.teacher_name || '',
    teacherEmail: row.teacher_email || '',
    classId: row.class_id == null ? null : Number(row.class_id),
    className: row.class_name || '',
    title: row.title || '',
    topics: row.topics || '',
    syllabus: row.syllabus || '',
    notes: row.notes || '',
    files: files.map(file => ({
      originalName: cleanText(file.originalName, 255),
      storedName: cleanText(file.storedName, 255),
      mimeType: cleanText(file.mimeType, 120),
      size: clampInt(file.size, 0, 50 * 1024 * 1024),
    })).filter(file => file.storedName),
    notificationEmail: row.notification_email || '',
    notificationSent: Number(row.notification_sent) !== 0,
    status: row.status || 'open',
    completedAt: row.completed_at || null,
    completedBy: row.completed_by || '',
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
      status ENUM('open','done') NOT NULL DEFAULT 'open',
      completed_at TIMESTAMP NULL,
      completed_by VARCHAR(96) NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
    await this.ensureCurriculumRequestColumns(pool);
    await this.ensureHomeworkColumns(pool);
    this.ready = true;
  }

  async ensureCurriculumRequestColumns(pool) {
    let columns = [];
    try {
      const [rows] = await pool.execute('SHOW COLUMNS FROM teacher_curriculum_request');
      columns = Array.isArray(rows) ? rows.map(row => String(row.Field || '').toLowerCase()) : [];
    } catch (_) {
      return;
    }
    if (!columns.includes('status')) {
      await pool.execute("ALTER TABLE teacher_curriculum_request ADD COLUMN status ENUM('open','done') NOT NULL DEFAULT 'open' AFTER notification_sent");
    }
    if (!columns.includes('completed_at')) {
      await pool.execute('ALTER TABLE teacher_curriculum_request ADD COLUMN completed_at TIMESTAMP NULL AFTER status');
    }
    if (!columns.includes('completed_by')) {
      await pool.execute("ALTER TABLE teacher_curriculum_request ADD COLUMN completed_by VARCHAR(96) NOT NULL DEFAULT '' AFTER completed_at");
    }
    if (!columns.includes('updated_at')) {
      await pool.execute('ALTER TABLE teacher_curriculum_request ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
    }
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
         JOIN class_teachers ct ON ct.class_id = cs.class_id AND ct.teacher_id = ?
         WHERE ${activeSchoolWhere}
         ORDER BY s.name ASC`,
        [teacherId, schoolId, schoolId, ...subjectParam],
      ],
      [
        `SELECT DISTINCT s.id, s.name, s.code, s.school_id
         FROM subjects s
         JOIN class_subjects cs ON cs.subject_id = s.id
         JOIN teacher_classes tc ON tc.class_id = cs.class_id AND tc.teacher_id = ?
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
         JOIN classes c ON c.subject_id = s.id
         JOIN class_teachers ct ON ct.class_id = c.id AND ct.teacher_id = ?
         WHERE ${activeSchoolWhere}
         ORDER BY s.name ASC`,
        [teacherId, schoolId, schoolId, ...subjectParam],
      ],
      [
        `SELECT DISTINCT s.id, s.name, s.code, s.school_id
         FROM subjects s
         JOIN classes c ON c.subject_id = s.id
         JOIN teacher_classes tc ON tc.class_id = c.id AND tc.teacher_id = ?
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
        `SELECT DISTINCT c.id, c.name, c.join_code, c.year_group, c.is_active
         FROM classes c
         JOIN class_subjects cs ON cs.class_id = c.id AND cs.subject_id = ?
         JOIN class_subject_teachers cst ON cst.class_subject_id = cs.id AND cst.teacher_id = ?
         ORDER BY c.name ASC`,
        [subjectId, teacherId],
      ],
      [
        `SELECT DISTINCT c.id, c.name, c.join_code, c.year_group, c.is_active
         FROM classes c
         JOIN class_subjects cs ON cs.class_id = c.id AND cs.subject_id = ?
         JOIN class_teachers ct ON ct.class_id = c.id AND ct.teacher_id = ?
         ORDER BY c.name ASC`,
        [subjectId, teacherId],
      ],
      [
        `SELECT DISTINCT c.id, c.name, c.join_code, c.year_group, c.is_active
         FROM classes c
         JOIN class_subjects cs ON cs.class_id = c.id AND cs.subject_id = ?
         WHERE c.teacher_id = ?
         ORDER BY c.name ASC`,
        [subjectId, teacherId],
      ],
      [
        `SELECT DISTINCT c.id, c.name, c.join_code, c.year_group, c.is_active
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
        `SELECT DISTINCT c.id, c.name, c.join_code, c.year_group, c.is_active
         FROM classes c
         JOIN class_subjects cs ON cs.class_id = c.id AND cs.subject_id = ?
         WHERE (c.school_id IS NULL OR ? = 0 OR c.school_id = ?)
         ORDER BY c.name ASC`,
        [subjectId, schoolId, schoolId],
      ));
    }
    return (rows || []).map(row => ({
      id: Number(row.id) || 0,
      name: String(row.name || ''),
      joinCode: String(row.join_code || ''),
      ...(row.year_group ? { yearGroup: String(row.year_group || '') } : {}),
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

  async studentRosterRows(account, classId = 0, options = {}) {
    const schoolId = clampInt(account && account.schoolId, 0, 2147483647);
    classId = clampInt(classId, 0, 2147483647);
    const yearGroup = cleanText(options.yearGroup || options.year_group, 50);
    const schoolWhere = '(s.school_id IS NULL OR ? = 0 OR s.school_id = ?)';
    let rows = [];
    if (classId) {
      const candidates = [
        [`SELECT s.id, s.name, s.email, s.school_id, s.year_group FROM students s WHERE s.class_id = ? AND ${schoolWhere} ORDER BY s.name ASC, s.email ASC LIMIT 500`, [classId, schoolId, schoolId]],
        [`SELECT s.id, s.name, s.email, s.school_id, s.year_group FROM students s JOIN student_classes sc ON sc.student_id = s.id WHERE sc.class_id = ? AND ${schoolWhere} ORDER BY s.name ASC, s.email ASC LIMIT 500`, [classId, schoolId, schoolId]],
        [`SELECT s.id, s.name, s.email, s.school_id, s.year_group FROM students s JOIN class_students cs ON cs.student_id = s.id WHERE cs.class_id = ? AND ${schoolWhere} ORDER BY s.name ASC, s.email ASC LIMIT 500`, [classId, schoolId, schoolId]],
      ];
      for (const [sql, params] of candidates) rows = rows.concat(await this.safeQuery(sql, params));
    } else if (yearGroup && schoolId) {
      const candidates = [
        [`SELECT s.id, s.name, s.email, s.school_id, s.year_group FROM students s WHERE LOWER(s.year_group) = LOWER(?) AND ${schoolWhere} ORDER BY s.name ASC, s.email ASC LIMIT 1000`, [yearGroup, schoolId, schoolId]],
        [`SELECT s.id, s.name, s.email, s.school_id, s.year_group FROM students s JOIN classes c ON c.id = s.class_id WHERE LOWER(c.year_group) = LOWER(?) AND ${schoolWhere} ORDER BY s.name ASC, s.email ASC LIMIT 1000`, [yearGroup, schoolId, schoolId]],
        [`SELECT s.id, s.name, s.email, s.school_id, s.year_group FROM students s JOIN student_classes sc ON sc.student_id = s.id JOIN classes c ON c.id = sc.class_id WHERE LOWER(c.year_group) = LOWER(?) AND ${schoolWhere} ORDER BY s.name ASC, s.email ASC LIMIT 1000`, [yearGroup, schoolId, schoolId]],
        [`SELECT s.id, s.name, s.email, s.school_id, s.year_group FROM students s JOIN class_students cs ON cs.student_id = s.id JOIN classes c ON c.id = cs.class_id WHERE LOWER(c.year_group) = LOWER(?) AND ${schoolWhere} ORDER BY s.name ASC, s.email ASC LIMIT 1000`, [yearGroup, schoolId, schoolId]],
      ];
      for (const [sql, params] of candidates) rows = rows.concat(await this.safeQuery(sql, params));
    } else if (schoolId) {
      rows = await this.safeQuery(
        `SELECT s.id, s.name, s.email, s.school_id, s.year_group
         FROM students s
         WHERE ${schoolWhere}
         ORDER BY s.name ASC, s.email ASC
         LIMIT 1500`,
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

  async yearGroupRows(account) {
    const schoolId = clampInt(account && account.schoolId, 0, 2147483647);
    if (!schoolId) return [];
    const rows = []
      .concat(await this.safeQuery(
        `SELECT DISTINCT s.year_group AS year_group
         FROM students s
         WHERE s.year_group IS NOT NULL AND s.year_group <> ''
           AND (s.school_id IS NULL OR s.school_id = ?)
         ORDER BY s.year_group ASC
         LIMIT 40`,
        [schoolId],
      ))
      .concat(await this.safeQuery(
        `SELECT DISTINCT c.year_group AS year_group
         FROM classes c
         WHERE c.year_group IS NOT NULL AND c.year_group <> ''
           AND (c.school_id IS NULL OR c.school_id = ?)
         ORDER BY c.year_group ASC
         LIMIT 40`,
        [schoolId],
      ));
    return [...new Set(rows.map(row => cleanText(row && row.year_group, 50)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
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

  async listCurriculumRequests(account, query = {}) {
    await this.ensureSchema();
    const teacherId = sourceIdFromAccount(account, 'teacher');
    const admin = isCurriculumAdminAccount(account);
    if (!admin && !teacherId) throw Object.assign(new Error('Teacher account required.'), { status: 403, code: 'teacher' });
    const subjectId = clampInt(query.subjectId || query.subject_id, 0, 2147483647);
    const classId = clampInt(query.classId || query.class_id, 0, 2147483647);
    const params = [];
    const where = [];
    if (!admin) {
      where.push('tcr.teacher_id = ?');
      params.push(teacherId);
    }
    if (subjectId) {
      where.push('tcr.subject_id = ?');
      params.push(subjectId);
    }
    if (classId) {
      where.push('tcr.class_id = ?');
      params.push(classId);
    }
    const [rows] = await this.getPool().execute(
      `SELECT tcr.*, s.name AS subject_name, s.code AS subject_code, t.name AS teacher_name, t.email AS teacher_email, c.name AS class_name
       FROM teacher_curriculum_request tcr
       LEFT JOIN subjects s ON s.id = tcr.subject_id
       LEFT JOIN teachers t ON t.id = tcr.teacher_id
       LEFT JOIN classes c ON c.id = tcr.class_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY tcr.created_at DESC, tcr.id DESC
       LIMIT 200`,
      params,
    );
    return rows.map(publicCurriculumRequest);
  }

  async curriculumAttachment(account, requestId, storedName) {
    await this.ensureSchema();
    const teacherId = sourceIdFromAccount(account, 'teacher');
    const admin = isCurriculumAdminAccount(account);
    const id = clampInt(requestId, 1, Number.MAX_SAFE_INTEGER);
    const cleanStoredName = cleanText(storedName, 255);
    if (!cleanStoredName || cleanStoredName.includes('/') || cleanStoredName.includes('\\')) {
      throw Object.assign(new Error('Attachment not found.'), { status: 404, code: 'file' });
    }
    const params = [id];
    const ownerWhere = admin ? '' : ' AND teacher_id = ?';
    if (!admin) {
      if (!teacherId) throw Object.assign(new Error('Teacher account required.'), { status: 403, code: 'teacher' });
      params.push(teacherId);
    }
    const [rows] = await this.getPool().execute(
      `SELECT id, files_json FROM teacher_curriculum_request WHERE id = ?${ownerWhere} LIMIT 1`,
      params,
    );
    const row = rows && rows[0];
    if (!row) throw Object.assign(new Error('Attachment not found.'), { status: 404, code: 'file' });
    let files = [];
    try { files = JSON.parse(row.files_json || '[]'); } catch (_) {}
    const file = Array.isArray(files) ? files.find(item => cleanText(item && item.storedName, 255) === cleanStoredName) : null;
    if (!file) throw Object.assign(new Error('Attachment not found.'), { status: 404, code: 'file' });
    return {
      originalName: cleanText(file.originalName, 255) || cleanStoredName,
      storedName: cleanStoredName,
      mimeType: cleanText(file.mimeType, 120),
      path: cleanText(file.path, 500),
      size: clampInt(file.size, 0, 50 * 1024 * 1024),
    };
  }

  async completeCurriculumRequest(account, requestId) {
    await this.ensureSchema();
    if (!isCurriculumAdminAccount(account)) throw Object.assign(new Error('Admin account required.'), { status: 403, code: 'admin' });
    const id = clampInt(requestId, 1, Number.MAX_SAFE_INTEGER);
    const [rows] = await this.getPool().execute(
      `SELECT tcr.*, s.name AS subject_name, s.code AS subject_code, t.name AS teacher_name, t.email AS teacher_email, c.name AS class_name
       FROM teacher_curriculum_request tcr
       LEFT JOIN subjects s ON s.id = tcr.subject_id
       LEFT JOIN teachers t ON t.id = tcr.teacher_id
       LEFT JOIN classes c ON c.id = tcr.class_id
       WHERE tcr.id = ?
       LIMIT 1`,
      [id],
    );
    const row = rows && rows[0];
    if (!row) throw Object.assign(new Error('Curriculum request not found.'), { status: 404, code: 'request' });
    await this.getPool().execute(
      `UPDATE teacher_curriculum_request
       SET status = 'done', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP), completed_by = ?
       WHERE id = ?`,
      [cleanText(account && (account.username || account.displayName || account.id), 96), id],
    );
    return { ...publicCurriculumRequest({ ...row, status: 'done', completed_at: row.completed_at || new Date(), completed_by: account && (account.username || account.displayName || account.id) || '' }) };
  }

  async deleteCurriculumRequest(account, requestId) {
    await this.ensureSchema();
    if (!isCurriculumAdminAccount(account)) throw Object.assign(new Error('Admin account required.'), { status: 403, code: 'admin' });
    const id = clampInt(requestId, 1, Number.MAX_SAFE_INTEGER);
    const [rows] = await this.getPool().execute('SELECT id, files_json FROM teacher_curriculum_request WHERE id = ? LIMIT 1', [id]);
    const row = rows && rows[0];
    if (!row) throw Object.assign(new Error('Curriculum request not found.'), { status: 404, code: 'request' });
    await this.getPool().execute('DELETE FROM teacher_curriculum_request WHERE id = ?', [id]);
    let files = [];
    try { files = JSON.parse(row.files_json || '[]'); } catch (_) {}
    return {
      id,
      files: Array.isArray(files) ? files.map(file => ({
        path: cleanText(file && file.path, 500),
        storedName: cleanText(file && file.storedName, 255),
      })).filter(file => file.path || file.storedName) : [],
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
    const scope = ['class', 'year', 'school', 'network'].includes(String(query.scope || '').toLowerCase()) ? String(query.scope || '').toLowerCase() : classId ? 'class' : 'school';
    const yearGroup = cleanText(query.yearGroup || query.year_group, 50);
    const days = clampInt(query.days || 30, 1, 365);
    const rosterRows = scope === 'network' ? [] : await this.studentRosterRows(account, scope === 'class' ? classId : 0, { yearGroup: scope === 'year' ? yearGroup : '' });
    const rosterIds = rosterRows.map(row => Number(row.id) || 0).filter(Boolean);
    const params = [subjectId, days];
    let attemptWhere = 'gqa.subject_id = ? AND gqa.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)';
    if (scope === 'class' && classId) {
      attemptWhere += ' AND (gqa.class_id = ?';
      params.push(classId);
      if (rosterIds.length) {
        attemptWhere += ` OR gqa.student_id IN (${rosterIds.map(() => '?').join(',')})`;
        params.push(...rosterIds);
      }
      attemptWhere += ')';
    } else if (scope === 'year') {
      if (rosterIds.length) {
        attemptWhere += ` AND gqa.student_id IN (${rosterIds.map(() => '?').join(',')})`;
        params.push(...rosterIds);
      } else {
        attemptWhere += ' AND 1 = 0';
      }
    } else if (scope === 'school' && scopeSchoolId) {
      attemptWhere += ' AND (gqa.school_id IS NULL OR gqa.school_id = ?)';
      params.push(scopeSchoolId);
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
    if (scope === 'class' && classId) {
      questionAttemptClassJoin = 'AND (gqa.class_id = ?';
      questionParams.push(classId);
      if (rosterIds.length) {
        questionAttemptClassJoin += ` OR gqa.student_id IN (${rosterIds.map(() => '?').join(',')})`;
        questionParams.push(...rosterIds);
      }
      questionAttemptClassJoin += ')';
    } else if (scope === 'year') {
      if (rosterIds.length) {
        questionAttemptClassJoin = `AND gqa.student_id IN (${rosterIds.map(() => '?').join(',')})`;
        questionParams.push(...rosterIds);
      } else {
        questionAttemptClassJoin = 'AND 1 = 0';
      }
    } else if (scope === 'school' && scopeSchoolId) {
      questionAttemptClassJoin = 'AND (gqa.school_id IS NULL OR gqa.school_id = ?)';
      questionParams.push(scopeSchoolId);
    }
    questionParams.push(subjectId);
    let questionWhere = 'gq.subject_id = ?';
    if (scope !== 'network' && scopeSchoolId) { questionWhere += ' AND (gq.school_id IS NULL OR gq.school_id = ?)'; questionParams.push(scopeSchoolId); }
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
    const [attemptRows] = await this.getPool().execute(
      `SELECT
         gqa.id AS attempt_id,
         COALESCE(gqa.student_id, 0) AS student_id,
         COALESCE(s.name, s.email, gqa.account_id, 'Unknown student') AS student_name,
         COALESCE(s.email, '') AS student_email,
         gqa.account_id,
         gqa.answer_index,
         gqa.correct,
         gqa.duration_ms,
         gqa.source,
         gqa.created_at,
         gq.id AS question_id,
         gq.topic,
         gq.stage,
         gq.prompt,
         gq.answers,
         gq.correct_index
       FROM game_question_attempt gqa
       LEFT JOIN students s ON s.id = gqa.student_id
       LEFT JOIN game_question gq ON gq.id = gqa.question_id
       WHERE ${attemptWhere}
       ORDER BY gqa.created_at DESC
       LIMIT 1000`,
      params,
    );
    const [schoolRows] = await this.getPool().execute(
      `SELECT
         COALESCE(gqa.school_id, 0) AS school_id,
         COALESCE(sc.name, CONCAT('School ', COALESCE(gqa.school_id, 0))) AS school_name,
         COUNT(*) AS attempts,
         SUM(CASE WHEN gqa.correct = 1 THEN 1 ELSE 0 END) AS correct
       FROM game_question_attempt gqa
       LEFT JOIN schools sc ON sc.id = gqa.school_id
       WHERE gqa.subject_id = ? AND gqa.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY COALESCE(gqa.school_id, 0), school_name
       ORDER BY attempts DESC, school_name ASC
       LIMIT 100`,
      [subjectId, days],
    );
    const classComparisonRows = await this.safeQuery(
      `SELECT
         c.id AS class_id,
         c.name AS class_name,
         COALESCE(NULLIF(c.year_group, ''), 'No year group') AS year_group,
         COUNT(gqa.id) AS attempts,
         SUM(CASE WHEN gqa.correct = 1 THEN 1 ELSE 0 END) AS correct,
         COUNT(DISTINCT gqa.student_id) AS active_students
       FROM classes c
       LEFT JOIN game_question_attempt gqa
         ON gqa.class_id = c.id
        AND gqa.subject_id = ?
        AND gqa.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       WHERE (c.subject_id = ? OR EXISTS (SELECT 1 FROM class_subjects cs WHERE cs.class_id = c.id AND cs.subject_id = ?))
         AND (? = 0 OR c.school_id IS NULL OR c.school_id = ?)
       GROUP BY c.id, c.name, c.year_group
       ORDER BY attempts DESC, c.name ASC
       LIMIT 200`,
      [subjectId, days, subjectId, subjectId, scopeSchoolId || 0, scopeSchoolId || 0],
    );
    const yearComparisonRows = await this.safeQuery(
      `SELECT
         COALESCE(NULLIF(s.year_group, ''), NULLIF(c.year_group, ''), 'No year group') AS year_group,
         COUNT(gqa.id) AS attempts,
         SUM(CASE WHEN gqa.correct = 1 THEN 1 ELSE 0 END) AS correct,
         COUNT(DISTINCT gqa.student_id) AS active_students
       FROM game_question_attempt gqa
       LEFT JOIN students s ON s.id = gqa.student_id
       LEFT JOIN classes c ON c.id = COALESCE(gqa.class_id, s.class_id)
       WHERE gqa.subject_id = ? AND gqa.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND (? = 0 OR gqa.school_id IS NULL OR gqa.school_id = ?)
       GROUP BY year_group
       ORDER BY attempts DESC, year_group ASC
       LIMIT 100`,
      [subjectId, days, scopeSchoolId || 0, scopeSchoolId || 0],
    );
    const questionClassRows = await this.safeQuery(
      `SELECT
         gqa.question_id,
         COALESCE(gqa.class_id, s.class_id, 0) AS class_id,
         COALESCE(c.name, CONCAT('Class ', COALESCE(gqa.class_id, s.class_id, 0))) AS class_name,
         COUNT(*) AS attempts,
         SUM(CASE WHEN gqa.correct = 1 THEN 1 ELSE 0 END) AS correct
       FROM game_question_attempt gqa
       LEFT JOIN students s ON s.id = gqa.student_id
       LEFT JOIN classes c ON c.id = COALESCE(gqa.class_id, s.class_id)
       WHERE gqa.subject_id = ? AND gqa.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND (? = 0 OR gqa.school_id IS NULL OR gqa.school_id = ?)
       GROUP BY gqa.question_id, class_id, class_name
       ORDER BY gqa.question_id ASC, attempts DESC, class_name ASC
       LIMIT 1200`,
      [subjectId, days, scopeSchoolId || 0, scopeSchoolId || 0],
    );
    const questionYearRows = await this.safeQuery(
      `SELECT
         gqa.question_id,
         COALESCE(NULLIF(s.year_group, ''), NULLIF(c.year_group, ''), 'No year group') AS year_group,
         COUNT(*) AS attempts,
         SUM(CASE WHEN gqa.correct = 1 THEN 1 ELSE 0 END) AS correct
       FROM game_question_attempt gqa
       LEFT JOIN students s ON s.id = gqa.student_id
       LEFT JOIN classes c ON c.id = COALESCE(gqa.class_id, s.class_id)
       WHERE gqa.subject_id = ? AND gqa.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND (? = 0 OR gqa.school_id IS NULL OR gqa.school_id = ?)
       GROUP BY gqa.question_id, year_group
       ORDER BY gqa.question_id ASC, attempts DESC, year_group ASC
       LIMIT 1200`,
      [subjectId, days, scopeSchoolId || 0, scopeSchoolId || 0],
    );
    const questionSchoolRows = await this.safeQuery(
      `SELECT
         gqa.question_id,
         COALESCE(gqa.school_id, 0) AS school_id,
         COALESCE(sc.name, CONCAT('School ', COALESCE(gqa.school_id, 0))) AS school_name,
         COUNT(*) AS attempts,
         SUM(CASE WHEN gqa.correct = 1 THEN 1 ELSE 0 END) AS correct
       FROM game_question_attempt gqa
       LEFT JOIN schools sc ON sc.id = gqa.school_id
       WHERE gqa.subject_id = ? AND gqa.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY gqa.question_id, school_id, school_name
       ORDER BY gqa.question_id ASC, attempts DESC, school_name ASC
       LIMIT 1200`,
      [subjectId, days],
    );
    const topicClassRows = await this.safeQuery(
      `SELECT
         COALESCE(NULLIF(gq.topic, ''), 'Uncategorised') AS topic,
         COALESCE(gqa.class_id, s.class_id, 0) AS class_id,
         COALESCE(c.name, CONCAT('Class ', COALESCE(gqa.class_id, s.class_id, 0))) AS class_name,
         COUNT(*) AS attempts,
         SUM(CASE WHEN gqa.correct = 1 THEN 1 ELSE 0 END) AS correct
       FROM game_question_attempt gqa
       LEFT JOIN game_question gq ON gq.id = gqa.question_id
       LEFT JOIN students s ON s.id = gqa.student_id
       LEFT JOIN classes c ON c.id = COALESCE(gqa.class_id, s.class_id)
       WHERE gqa.subject_id = ? AND gqa.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND (? = 0 OR gqa.school_id IS NULL OR gqa.school_id = ?)
       GROUP BY topic, class_id, class_name
       ORDER BY topic ASC, attempts DESC, class_name ASC
       LIMIT 1200`,
      [subjectId, days, scopeSchoolId || 0, scopeSchoolId || 0],
    );
    const topicYearRows = await this.safeQuery(
      `SELECT
         COALESCE(NULLIF(gq.topic, ''), 'Uncategorised') AS topic,
         COALESCE(NULLIF(s.year_group, ''), NULLIF(c.year_group, ''), 'No year group') AS year_group,
         COUNT(*) AS attempts,
         SUM(CASE WHEN gqa.correct = 1 THEN 1 ELSE 0 END) AS correct
       FROM game_question_attempt gqa
       LEFT JOIN game_question gq ON gq.id = gqa.question_id
       LEFT JOIN students s ON s.id = gqa.student_id
       LEFT JOIN classes c ON c.id = COALESCE(gqa.class_id, s.class_id)
       WHERE gqa.subject_id = ? AND gqa.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND (? = 0 OR gqa.school_id IS NULL OR gqa.school_id = ?)
       GROUP BY topic, year_group
       ORDER BY topic ASC, attempts DESC, year_group ASC
       LIMIT 1200`,
      [subjectId, days, scopeSchoolId || 0, scopeSchoolId || 0],
    );
    const topicSchoolRows = await this.safeQuery(
      `SELECT
         COALESCE(NULLIF(gq.topic, ''), 'Uncategorised') AS topic,
         COALESCE(gqa.school_id, 0) AS school_id,
         COALESCE(sc.name, CONCAT('School ', COALESCE(gqa.school_id, 0))) AS school_name,
         COUNT(*) AS attempts,
         SUM(CASE WHEN gqa.correct = 1 THEN 1 ELSE 0 END) AS correct
       FROM game_question_attempt gqa
       LEFT JOIN game_question gq ON gq.id = gqa.question_id
       LEFT JOIN schools sc ON sc.id = gqa.school_id
       WHERE gqa.subject_id = ? AND gqa.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY topic, school_id, school_name
       ORDER BY topic ASC, attempts DESC, school_name ASC
       LIMIT 1200`,
      [subjectId, days],
    );
    const activeHomeworkRows = await this.safeQuery(
      `SELECT gh.*
       FROM game_homework gh
       WHERE gh.subject_id = ?
         AND gh.status IN ('scheduled','live')
         AND (? = 0 OR gh.school_id IS NULL OR gh.school_id = ?)
         AND (
           gh.cadence IN ('daily','weekly')
           OR gh.due_date IS NULL
           OR gh.due_date >= CURDATE()
         )
       ORDER BY gh.status = 'live' DESC, COALESCE(gh.due_date, '9999-12-31') ASC, gh.weekly_day ASC
       LIMIT 50`,
      [subjectId, scopeSchoolId || 0, scopeSchoolId || 0],
    );
    const activeHomeworkIds = activeHomeworkRows.map(row => Number(row.id) || 0).filter(Boolean);
    const homeworkProgressRows = activeHomeworkIds.length ? await this.safeQuery(
      `SELECT homework_id, student_id, period_key, answered_count, completed_at, last_answered_at
       FROM game_homework_progress
       WHERE subject_id = ?
         AND homework_id IN (${activeHomeworkIds.map(() => '?').join(',')})`,
      [subjectId, ...activeHomeworkIds],
    ) : [];
    const normalize = row => {
      const attempts = Number(row.attempts) || 0;
      const correct = Number(row.correct) || 0;
      const wrong = Math.max(0, attempts - correct);
      return { attempts, correct, wrong, accuracy: attempts ? Math.round((correct / attempts) * 100) : 0 };
    };
    const addSummaryAttempt = (map, key, isCorrect, patch = {}) => {
      const id = String(key || 'Uncategorised');
      if (!map.has(id)) map.set(id, { id, name: id, attempts: 0, correct: 0, wrong: 0, accuracy: 0, ...patch });
      const row = map.get(id);
      row.attempts += 1;
      if (isCorrect) row.correct += 1;
      else row.wrong += 1;
      row.accuracy = row.attempts ? Math.round((row.correct / row.attempts) * 100) : 0;
      return row;
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
        wrong: 0,
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
    const questionBreakdowns = new Map();
    const ensureQuestionBreakdown = questionId => {
      const id = Number(questionId) || 0;
      if (!questionBreakdowns.has(id)) questionBreakdowns.set(id, { class: [], year: [], school: [] });
      return questionBreakdowns.get(id);
    };
    for (const row of questionClassRows || []) {
      ensureQuestionBreakdown(row.question_id).class.push({
        id: Number(row.class_id) || 0,
        name: String(row.class_name || 'No class'),
        ...normalize(row),
      });
    }
    for (const row of questionYearRows || []) {
      ensureQuestionBreakdown(row.question_id).year.push({
        id: String(row.year_group || 'No year group'),
        name: String(row.year_group || 'No year group'),
        ...normalize(row),
      });
    }
    for (const row of questionSchoolRows || []) {
      ensureQuestionBreakdown(row.question_id).school.push({
        id: Number(row.school_id) || 0,
        name: String(row.school_name || 'Unknown school'),
        ownSchool: scopeSchoolId ? Number(row.school_id) === Number(scopeSchoolId) : false,
        ...normalize(row),
      });
    }
    for (const question of questions) {
      const breakdowns = questionBreakdowns.get(question.id) || { class: [], year: [], school: [] };
      question.breakdowns = {
        class: breakdowns.class.slice(0, 6),
        year: breakdowns.year.slice(0, 6),
        school: breakdowns.school.slice(0, 8),
      };
    }
    const topicMap = new Map();
    const studentTopicMap = new Map();
    const attempts = (attemptRows || []).map(row => {
      let answers = [];
      try { answers = JSON.parse(row.answers || '[]'); } catch (_) {}
      if (!Array.isArray(answers)) answers = [];
      const answerIndex = clampInt(row.answer_index, 0, 3);
      const correctIndex = clampInt(row.correct_index, 0, 3);
      const topic = String(row.topic || 'Uncategorised');
      const studentId = Number(row.student_id) || 0;
      const correct = Number(row.correct) === 1;
      addSummaryAttempt(topicMap, topic, correct, { name: topic });
      const studentKey = `${studentId || String(row.account_id || row.student_name || 'unknown')}:${topic}`;
      addSummaryAttempt(studentTopicMap, studentKey, correct, {
        studentId,
        studentName: String(row.student_name || 'Unknown student'),
        topic,
        name: topic,
      });
      return {
        id: Number(row.attempt_id) || 0,
        studentId,
        studentName: String(row.student_name || 'Unknown student'),
        studentEmail: String(row.student_email || ''),
        accountId: String(row.account_id || ''),
        questionId: Number(row.question_id) || 0,
        topic,
        stage: String(row.stage || ''),
        prompt: String(row.prompt || ''),
        answerIndex,
        answerText: String(answers[answerIndex] || ''),
        correctIndex,
        correctAnswer: String(answers[correctIndex] || ''),
        correct,
        durationMs: Number(row.duration_ms) || 0,
        source: String(row.source || ''),
        createdAt: row.created_at || null,
      };
    });
    const topicSummaries = [...topicMap.values()].sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts || a.name.localeCompare(b.name));
    const studentTopicSummaries = [...studentTopicMap.values()].sort((a, b) => String(a.studentName || '').localeCompare(String(b.studentName || '')) || a.accuracy - b.accuracy || b.attempts - a.attempts);
    const schoolComparisons = (schoolRows || []).map(row => ({
      id: Number(row.school_id) || 0,
      name: String(row.school_name || 'Unknown school'),
      ...normalize(row),
      ownSchool: scopeSchoolId ? Number(row.school_id) === Number(scopeSchoolId) : false,
    })).sort((a, b) => b.accuracy - a.accuracy || b.attempts - a.attempts || a.name.localeCompare(b.name));
    const classComparisons = (classComparisonRows || []).map(row => ({
      id: Number(row.class_id) || 0,
      name: String(row.class_name || 'Class'),
      yearGroup: String(row.year_group || ''),
      activeStudents: Number(row.active_students) || 0,
      ...normalize(row),
    })).sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts || a.name.localeCompare(b.name));
    const yearGroupComparisons = (yearComparisonRows || []).map(row => ({
      id: String(row.year_group || 'No year group'),
      name: String(row.year_group || 'No year group'),
      activeStudents: Number(row.active_students) || 0,
      ...normalize(row),
    })).sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts || a.name.localeCompare(b.name));
    const topicBreakdownMap = new Map();
    const ensureTopicBreakdown = topic => {
      const id = String(topic || 'Uncategorised');
      if (!topicBreakdownMap.has(id)) topicBreakdownMap.set(id, { id, name: id, class: [], year: [], school: [] });
      return topicBreakdownMap.get(id);
    };
    for (const row of topicClassRows || []) {
      ensureTopicBreakdown(row.topic).class.push({
        id: Number(row.class_id) || 0,
        name: String(row.class_name || 'No class'),
        ...normalize(row),
      });
    }
    for (const row of topicYearRows || []) {
      ensureTopicBreakdown(row.topic).year.push({
        id: String(row.year_group || 'No year group'),
        name: String(row.year_group || 'No year group'),
        ...normalize(row),
      });
    }
    for (const row of topicSchoolRows || []) {
      ensureTopicBreakdown(row.topic).school.push({
        id: Number(row.school_id) || 0,
        name: String(row.school_name || 'Unknown school'),
        ownSchool: scopeSchoolId ? Number(row.school_id) === Number(scopeSchoolId) : false,
        ...normalize(row),
      });
    }
    const topicBreakdowns = [...topicBreakdownMap.values()].map(row => ({
      ...row,
      class: row.class.slice(0, 8),
      year: row.year.slice(0, 8),
      school: row.school.slice(0, 10),
    })).sort((a, b) => a.name.localeCompare(b.name));
    const progressByStudentHomework = new Map();
    for (const row of homeworkProgressRows || []) {
      progressByStudentHomework.set(`${Number(row.student_id) || 0}:${Number(row.homework_id) || 0}:${String(row.period_key || '')}`, row);
    }
    const homeworkInScope = (activeHomeworkRows || []).filter(row => {
      const homeworkClassId = Number(row.class_id) || 0;
      if (scope === 'class' && classId) return !homeworkClassId || homeworkClassId === classId;
      return !homeworkClassId;
    });
    const missingHomework = students.map(student => {
      const requiredItems = homeworkInScope.filter(row => Number(student.id) && (!Number(row.class_id) || scope !== 'class' || Number(row.class_id) === classId));
      const totals = requiredItems.reduce((acc, row) => {
        const required = clampInt(row.question_count, 1, 100);
        const progress = progressByStudentHomework.get(`${Number(student.id) || 0}:${Number(row.id) || 0}:${homeworkPeriodKey(row)}`) || {};
        const answered = Math.min(required, clampInt(progress.answered_count, 0, required));
        acc.required += required;
        acc.answered += answered;
        if (answered >= required || progress.completed_at) acc.completed += 1;
        else acc.missing += 1;
        acc.lastHomeworkAt = progress.last_answered_at || acc.lastHomeworkAt;
        return acc;
      }, { required: 0, answered: 0, completed: 0, missing: 0, lastHomeworkAt: null });
      return {
        id: student.id,
        name: student.name,
        email: student.email,
        lastAttemptAt: student.lastAttemptAt,
        accuracy: student.accuracy,
        attempts: student.attempts,
        ...totals,
        completion: totals.required ? Math.round((totals.answered / totals.required) * 100) : 0,
      };
    }).filter(row => row.required > 0 && row.answered < row.required)
      .sort((a, b) => a.completion - b.completion || a.attempts - b.attempts || a.name.localeCompare(b.name));
    const yearGroups = await this.yearGroupRows(account);
    const totals = students.reduce((acc, row) => {
      acc.attempts += row.attempts;
      acc.correct += row.correct;
      acc.wrong += row.wrong;
      return acc;
    }, { attempts: 0, correct: 0, wrong: 0 });
    if (scope === 'network') {
      totals.attempts = schoolComparisons.reduce((sum, row) => sum + row.attempts, 0);
      totals.correct = schoolComparisons.reduce((sum, row) => sum + row.correct, 0);
      totals.wrong = schoolComparisons.reduce((sum, row) => sum + row.wrong, 0);
    }
    return {
      windowDays: days,
      scope,
      yearGroup: scope === 'year' ? yearGroup : '',
      classId: classId || null,
      totals: { ...totals, accuracy: totals.attempts ? Math.round((totals.correct / totals.attempts) * 100) : 0 },
      students,
      questions,
      topicSummaries,
      studentTopicSummaries,
      attempts,
      schoolComparisons,
      classComparisons,
      yearGroupComparisons,
      topicBreakdowns,
      missingHomework,
      yearGroups,
    };
  }
}

module.exports = { MySqlGameQuestionStore, sourceIdFromAccount, publicQuestion };
