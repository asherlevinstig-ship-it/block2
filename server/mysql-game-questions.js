const cleanText = (value, max = 255) => String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
const cleanStatus = value => {
  const status = String(value || 'draft').trim().toLowerCase();
  return ['draft', 'teacher-reviewed', 'approved'].includes(status) ? status : 'draft';
};
const clampInt = (value, min, max) => Math.max(min, Math.min(max, Math.round(Number(value) || 0)));

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
    this.ready = true;
  }

  teacherIds(account) {
    const teacherId = sourceIdFromAccount(account, 'teacher');
    if (!teacherId) throw Object.assign(new Error('Teacher account required.'), { status: 403, code: 'teacher' });
    const schoolId = clampInt(account && account.schoolId, 0, 2147483647);
    return { teacherId, schoolId };
  }

  async assertTeacherSubject(account, subjectId) {
    const { teacherId, schoolId } = this.teacherIds(account);
    subjectId = clampInt(subjectId, 1, 2147483647);
    const pool = this.getPool();
    const [rows] = await pool.execute(
      `SELECT id, name, code, school_id FROM subjects
       WHERE id = ?
         AND is_active = 1
         AND (school_id IS NULL OR ? = 0 OR school_id = ?)
         AND (
           EXISTS (SELECT 1 FROM teacher_subjects ts WHERE ts.subject_id = subjects.id AND ts.teacher_id = ?)
           OR EXISTS (
             SELECT 1
             FROM class_subjects cs
             JOIN class_subject_teachers cst ON cst.class_subject_id = cs.id
             WHERE cs.subject_id = subjects.id AND cst.teacher_id = ?
           )
         )
       LIMIT 1`,
      [subjectId, schoolId, schoolId, teacherId, teacherId],
    );
    const subject = rows && rows[0];
    if (!subject) throw Object.assign(new Error('Subject not found or not assigned to this teacher.'), { status: 403, code: 'subject' });
    return { teacherId, schoolId, subject };
  }

  async listSubjects(account) {
    const { teacherId, schoolId } = this.teacherIds(account);
    const pool = this.getPool();
    const [rows] = await pool.execute(
      `SELECT DISTINCT s.id, s.name, s.code, s.school_id
       FROM subjects s
       LEFT JOIN teacher_subjects ts ON ts.subject_id = s.id AND ts.teacher_id = ?
       LEFT JOIN class_subjects cs ON cs.subject_id = s.id
       LEFT JOIN class_subject_teachers cst ON cst.class_subject_id = cs.id AND cst.teacher_id = ?
       WHERE s.is_active = 1
         AND (s.school_id IS NULL OR ? = 0 OR s.school_id = ?)
         AND (ts.teacher_id IS NOT NULL OR cst.teacher_id IS NOT NULL)
       ORDER BY s.name ASC`,
      [teacherId, teacherId, schoolId, schoolId],
    );
    return (rows || []).map(row => ({
      id: Number(row.id) || 0,
      name: String(row.name || ''),
      code: String(row.code || ''),
      schoolId: row.school_id == null ? null : Number(row.school_id),
    }));
  }

  async listClasses(account, subjectId) {
    const { teacherId } = await this.assertTeacherSubject(account, subjectId);
    const pool = this.getPool();
    const [rows] = await pool.execute(
      `SELECT DISTINCT c.id, c.name, c.join_code, c.is_active
       FROM classes c
       JOIN class_subjects cs ON cs.class_id = c.id AND cs.subject_id = ?
       LEFT JOIN class_subject_teachers cst ON cst.class_subject_id = cs.id AND cst.teacher_id = ?
       LEFT JOIN class_teachers ct ON ct.class_id = c.id AND ct.teacher_id = ?
       WHERE cst.teacher_id IS NOT NULL OR ct.teacher_id IS NOT NULL OR c.teacher_id = ?
       ORDER BY c.name ASC`,
      [subjectId, teacherId, teacherId, teacherId],
    );
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
    await this.assertTeacherSubject(account, subjectId);
    const topic = cleanText(query.topic, 96);
    const status = cleanStatus(query.reviewStatus || query.review_status || '');
    const params = [subjectId];
    let where = 'gq.subject_id = ?';
    if (topic) { where += ' AND LOWER(gq.topic) = LOWER(?)'; params.push(topic); }
    if (query.reviewStatus || query.review_status) { where += ' AND gq.review_status = ?'; params.push(status); }
    if (query.includeInactive !== true && query.include_inactive !== '1') where += ' AND gq.is_active = 1';
    const [rows] = await this.getPool().execute(
      `SELECT gq.*, s.name AS subject_name, s.code AS subject_code
       FROM game_question gq
       LEFT JOIN subjects s ON s.id = gq.subject_id
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
      `SELECT gq.*, s.name AS subject_name, s.code AS subject_code
       FROM game_question gq
       LEFT JOIN subjects s ON s.id = gq.subject_id
       WHERE gq.id = ?
       LIMIT 1`,
      [id],
    );
    const row = rows && rows[0];
    if (!row) throw Object.assign(new Error('Game question not found.'), { status: 404, code: 'question' });
    await this.assertTeacherSubject(account, row.subject_id);
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
}

module.exports = { MySqlGameQuestionStore, sourceIdFromAccount, publicQuestion };
