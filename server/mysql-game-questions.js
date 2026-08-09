const KC = require('../shared/knowledge-challenge');
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
function boolFlag(value, fallback = false) {
  if (value == null || value === '') return !!fallback;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(text)) return true;
  if (['0', 'false', 'no', 'off'].includes(text)) return false;
  return Number(value) !== 0;
}
function cleanQuestionModes(input = {}) {
  const modes = input.modes && typeof input.modes === 'object' ? input.modes : {};
  const has = key => hasOwn(modes, key) || hasOwn(input, key);
  const read = (key, alt, fallback) => {
    if (hasOwn(modes, key)) return boolFlag(modes[key], fallback);
    if (hasOwn(input, key)) return boolFlag(input[key], fallback);
    if (alt && hasOwn(input, alt)) return boolFlag(input[alt], fallback);
    return !!fallback;
  };
  const any = ['recall', 'scholar', 'meditation', 'useRecall', 'useScholar', 'useMeditation', 'use_recall', 'use_scholar', 'use_meditation'].some(has);
  return {
    recall: any ? read('recall', 'use_recall', true) && read('useRecall', '', true) : true,
    scholar: any ? read('scholar', 'use_scholar', true) && read('useScholar', '', true) : true,
    meditation: any ? read('meditation', 'use_meditation', false) || read('useMeditation', '', false) : false,
  };
}
const ymdUTC = value => {
  const d = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
};
const homeworkWeekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const KC_QUESTION_ATOM_OFFSET = 1000000000;
const QUESTION_DB_PREFIXES = ['GAME_QUESTION_MYSQL_', 'LIVEWEAVE_MYSQL_', 'QUESTION_MYSQL_'];
const QUESTION_DB_KEYS = ['HOST', 'PORT', 'USER', 'PASSWORD', 'DATABASE'];
function firstEnv(env, names, fallback = '') {
  for (const name of names) {
    const value = env && env[name];
    if (String(value || '').trim()) return value;
  }
  return fallback;
}
function gameQuestionDbConfig(env = process.env) {
  const prefixed = suffix => firstEnv(env, QUESTION_DB_PREFIXES.map(prefix => prefix + suffix), '');
  const host = prefixed('HOST');
  const database = prefixed('DATABASE');
  const user = prefixed('USER');
  const password = prefixed('PASSWORD');
  if (!host && !database && !user && !password) return null;
  for (const key of QUESTION_DB_KEYS) {
    if (key === 'PORT') continue;
    if (!String(prefixed(key) || '').trim()) {
      throw Object.assign(new Error('Game question MySQL override requires ' + QUESTION_DB_PREFIXES[0] + key + ' (or LIVEWEAVE_MYSQL_' + key + ').'), { status: 503, code: 'mysql_question_config' });
    }
  }
  return {
    host,
    port: Number(prefixed('PORT') || 3306),
    user,
    password,
    database,
  };
}
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

// Map a kc_student_atom row (snake_case, seconds) into the camelCase / epoch-ms
// shape the pure engine (shared/knowledge-challenge.js) expects. A missing row
// (unseen atom) returns {} so the engine applies its defaults.
function atomStateFromRow(row) {
  if (!row || row.stage == null) return {};
  const bool = v => v === 1 || v === true;
  return {
    stage: Number(row.stage) || 0,
    attempts: Number(row.attempts) || 0,
    correct: Number(row.correct) || 0,
    firstAttemptCorrect: Number(row.first_attempt_correct) || 0,
    streak: Number(row.streak) || 0,
    ease: row.ease == null ? 250 : Number(row.ease),
    intervalIdx: Number(row.interval_idx) || 0,
    nextDue: row.next_due_ms == null ? null : Number(row.next_due_ms),
    formatsSeen: Number(row.formats_seen) || 0,
    discriminated: bool(row.discriminated),
    nearTransferOk: bool(row.near_transfer_ok),
    explained: bool(row.explained),
    delayedSuccess: bool(row.delayed_success),
    lastShiftId: row.last_shift_id == null ? null : Number(row.last_shift_id),
    sessionsSeen: Number(row.sessions_seen) || 0,
    lastSeenAt: row.last_seen_ms == null ? 0 : Number(row.last_seen_ms),
  };
}

function shuffleList(list) {
  const out = Array.isArray(list) ? list.slice() : [];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = out[i]; out[i] = out[j]; out[j] = t;
  }
  return out;
}

function scholarSyntheticFormatFor(row, opts = {}) {
  const rawAnswers = Array.isArray(row && row._answers) ? row._answers : [];
  const correct = clampInt(row && row.correct_index, 0, Math.max(0, rawAnswers.length - 1));
  const distractors = rawAnswers.map((text, index) => ({ text, index })).filter(a => a.index !== correct && a.text);
  const candidates = ['multiple_choice'];
  if (distractors.length) candidates.push('approve_reject', 'compare', 'replace', 'predict_consequence');
  if (row && row.explanation && rawAnswers[correct]) candidates.push('construct_justification');
  const reason = cleanText(opts.reason, 32);
  const preferred = reason === 'confusion' || reason === 'remediation'
    ? ['compare', 'approve_reject', 'replace', 'multiple_choice']
    : reason === 'near_transfer'
      ? ['predict_consequence', 'replace', 'compare', 'multiple_choice']
      : reason === 'weakness'
        ? ['construct_justification', 'approve_reject', 'multiple_choice']
        : reason === 'maintenance'
          ? ['construct_justification', 'compare', 'multiple_choice']
          : ['multiple_choice', 'approve_reject', 'compare', 'replace', 'construct_justification'];
  const avoid = cleanText(opts.avoidFormat, 32);
  const pool = preferred.filter(f => candidates.includes(f) && f !== avoid);
  return pool.length ? pool[0] : candidates.find(f => f !== avoid) || 'multiple_choice';
}

function syntheticScholarChallenge(row, atomId, opts = {}) {
  const answers = Array.isArray(row && row._answers) ? row._answers.map(v => cleanText(v, 160)).filter(Boolean).slice(0, 4) : [];
  const correctIndex = clampInt(row && row.correct_index, 0, Math.max(0, answers.length - 1));
  const correctAnswer = answers[correctIndex] || '';
  const distractors = answers.map((text, index) => ({ text, index })).filter(a => a.index !== correctIndex && a.text);
  const basePrompt = cleanText(row && row.prompt, 500);
  const explanation = cleanText(row && row.explanation, 800);
  const format = scholarSyntheticFormatFor({ ...row, _answers: answers }, opts);
  const common = {
    questionId: Number(row && row.id) || 0,
    atomId,
    format,
    entityId: row && row.entity_id == null ? null : Number(row.entity_id),
    confusionPairId: row && row.confusion_pair_id == null ? null : Number(row.confusion_pair_id),
    difficulty: Number(row && row.difficulty) || 1,
    payload: null,
  };
  if (format === 'approve_reject' && distractors.length) {
    const candidate = Math.random() < 0.55 ? distractors[Math.floor(Math.random() * distractors.length)] : { text: correctAnswer, index: correctIndex };
    const isRight = candidate.index === correctIndex;
    return {
      ...common,
      prompt: basePrompt + '\n\nA hunter at the table answers: "' + candidate.text + '". Should the table accept it?',
      answers: ['Approve - this answer fits', 'Reject - this answer is a misconception'],
      correctIndex: isRight ? 0 : 1,
      explanation,
      payload: { consequence: isRight ? 'Rejecting a correct answer would lose secure knowledge.' : 'Accepting this would practise the misconception instead of the target idea.' },
    };
  }
  if (format === 'compare' && distractors.length) {
    const wrong = distractors[Math.floor(Math.random() * distractors.length)].text;
    const pair = shuffleList([correctAnswer, wrong]);
    return {
      ...common,
      prompt: basePrompt + '\n\nTwo plausible answers are on the table. Which one is the stronger answer?',
      answers: pair,
      correctIndex: pair.indexOf(correctAnswer),
      explanation,
      payload: { consequence: 'This is a discrimination check: the wrong option is plausible enough to trap surface learning.' },
    };
  }
  if (format === 'replace' && distractors.length) {
    const wrong = distractors[Math.floor(Math.random() * distractors.length)].text;
    const pool = shuffleList([correctAnswer, ...distractors.map(d => d.text).filter(v => v !== wrong)]).slice(0, Math.min(4, answers.length));
    if (!pool.includes(correctAnswer)) pool[0] = correctAnswer;
    return {
      ...common,
      prompt: 'A student tried this question:\n\n' + basePrompt + '\n\nThey wrote: "' + wrong + '". Which replacement best fixes the answer?',
      answers: pool,
      correctIndex: pool.indexOf(correctAnswer),
      explanation,
      payload: { consequence: 'The first answer failed retrieval. Replacing it checks whether the correction is understood.' },
    };
  }
  if (format === 'predict_consequence' && distractors.length) {
    const wrong = distractors[Math.floor(Math.random() * distractors.length)].text;
    return {
      ...common,
      prompt: 'Predict the consequence: in this situation, a learner chooses "' + wrong + '" for:\n\n' + basePrompt,
      answers: [
        'They have used the target idea correctly',
        'They have chosen a plausible but wrong idea',
        'There is not enough information to answer',
        'All answers become equally valid',
      ],
      correctIndex: 1,
      explanation,
      payload: { consequence: 'The table is checking whether the player can spot why the misconception matters.' },
    };
  }
  if (format === 'construct_justification' && correctAnswer && explanation) {
    const bank = [
      { text: 'Answer: ' + correctAnswer, correct: true },
      { text: explanation, correct: true },
      ...distractors.slice(0, 3).map(d => ({ text: 'Distractor: ' + d.text, correct: false })),
    ];
    return {
      ...common,
      prompt: 'Build a complete justification for:\n\n' + basePrompt,
      answers: [],
      correctIndex: -1,
      explanation,
      payload: {
        kind: 'construct_justification',
        prompt: 'Select the answer and the reason that prove it.',
        bank,
        consequence: 'Recognition is not enough here: the Scholar Table wants the answer plus the reason.',
      },
    };
  }
  return {
    ...common,
    format: 'multiple_choice',
    prompt: basePrompt,
    answers,
    correctIndex,
    explanation,
  };
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
    modes: {
      recall: row.use_recall == null ? true : Number(row.use_recall) !== 0,
      scholar: row.use_scholar == null ? true : Number(row.use_scholar) !== 0,
      meditation: row.use_meditation == null ? false : Number(row.use_meditation) !== 0,
    },
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
    this.env = options.env || process.env;
    this.ready = false;
  }

  getPool() {
    if (this.pool) return this.pool;
    const questionDb = gameQuestionDbConfig(this.env);
    if (questionDb) {
      const mysql = require('mysql2/promise');
      this.pool = mysql.createPool({
        ...questionDb,
        waitForConnections: true,
        connectionLimit: Number(this.env.GAME_QUESTION_MYSQL_CONNECTION_LIMIT || this.env.LIVEWEAVE_MYSQL_CONNECTION_LIMIT || this.env.MYSQL_CONNECTION_LIMIT || 10),
        charset: 'utf8mb4',
      });
      return this.pool;
    }
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
      use_recall TINYINT(1) NOT NULL DEFAULT 1,
      use_scholar TINYINT(1) NOT NULL DEFAULT 1,
      use_meditation TINYINT(1) NOT NULL DEFAULT 0,
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
    await this.ensureKnowledgeChallengeSchema(pool);
    await this.ensureCurriculumRequestColumns(pool);
    await this.ensureHomeworkColumns(pool);
    await this.ensureKnowledgeChallengeColumns(pool);
    await this.seedKnowledgeChallengeAtomTypes(pool);
    this.ready = true;
  }

  // Knowledge Challenge (adaptive practice engine) tables. See
  // docs/KNOWLEDGE_CHALLENGE_DB.md. All additive: the press-p multiple_choice
  // flow keeps using game_question / game_question_attempt unchanged.
  async ensureKnowledgeChallengeSchema(pool) {
    await pool.execute(`CREATE TABLE IF NOT EXISTS kc_entity (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      school_id INT UNSIGNED NULL,
      subject_id INT UNSIGNED NOT NULL,
      code VARCHAR(64) NOT NULL,
      name VARCHAR(120) NOT NULL,
      topic VARCHAR(96) NOT NULL DEFAULT '',
      stage VARCHAR(32) NOT NULL DEFAULT '',
      summary TEXT NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_kc_entity_code (subject_id, code),
      KEY idx_kc_entity_subject (subject_id, is_active),
      KEY idx_kc_entity_topic (topic)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS kc_atom_type (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      subject_id INT UNSIGNED NULL,
      code VARCHAR(48) NOT NULL,
      label VARCHAR(96) NOT NULL,
      sort_order SMALLINT NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_kc_atom_type (subject_id, code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS kc_atom (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      subject_id INT UNSIGNED NOT NULL,
      entity_id INT UNSIGNED NOT NULL,
      atom_type_id INT UNSIGNED NOT NULL,
      code VARCHAR(96) NOT NULL,
      statement TEXT NOT NULL,
      difficulty TINYINT UNSIGNED NOT NULL DEFAULT 1,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_kc_atom_code (subject_id, code),
      KEY idx_kc_atom_entity (entity_id),
      KEY idx_kc_atom_type (atom_type_id),
      KEY idx_kc_atom_subject (subject_id, is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS kc_confusion_pair (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      subject_id INT UNSIGNED NOT NULL,
      atom_a_id INT UNSIGNED NOT NULL,
      atom_b_id INT UNSIGNED NOT NULL,
      note VARCHAR(240) NOT NULL DEFAULT '',
      PRIMARY KEY (id),
      UNIQUE KEY uniq_kc_confusion (subject_id, atom_a_id, atom_b_id),
      KEY idx_kc_confusion_a (atom_a_id),
      KEY idx_kc_confusion_b (atom_b_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS kc_student_atom (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      student_id INT UNSIGNED NULL,
      account_id VARCHAR(96) NOT NULL DEFAULT '',
      subject_id INT UNSIGNED NOT NULL,
      atom_id INT UNSIGNED NOT NULL,
      stage TINYINT UNSIGNED NOT NULL DEFAULT 0,
      attempts INT UNSIGNED NOT NULL DEFAULT 0,
      correct INT UNSIGNED NOT NULL DEFAULT 0,
      first_attempt_correct INT UNSIGNED NOT NULL DEFAULT 0,
      streak SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      ease SMALLINT NOT NULL DEFAULT 250,
      interval_idx TINYINT UNSIGNED NOT NULL DEFAULT 0,
      next_due TIMESTAMP NULL,
      formats_seen INT UNSIGNED NOT NULL DEFAULT 0,
      discriminated TINYINT(1) NOT NULL DEFAULT 0,
      near_transfer_ok TINYINT(1) NOT NULL DEFAULT 0,
      explained TINYINT(1) NOT NULL DEFAULT 0,
      last_shift_id BIGINT UNSIGNED NULL,
      sessions_seen SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      delayed_success TINYINT(1) NOT NULL DEFAULT 0,
      last_seen_at TIMESTAMP NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_ksa (account_id, atom_id),
      KEY idx_ksa_due (account_id, subject_id, next_due),
      KEY idx_ksa_stage (account_id, subject_id, stage),
      KEY idx_ksa_student (student_id, subject_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS kc_remediation (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      account_id VARCHAR(96) NOT NULL DEFAULT '',
      student_id INT UNSIGNED NULL,
      subject_id INT UNSIGNED NOT NULL,
      atom_id INT UNSIGNED NOT NULL,
      confusion_pair_id INT UNSIGNED NULL,
      reason VARCHAR(48) NOT NULL DEFAULT 'wrong',
      stage_of_loop TINYINT UNSIGNED NOT NULL DEFAULT 0,
      corrective_passed TINYINT(1) NOT NULL DEFAULT 0,
      recovery_passed TINYINT(1) NOT NULL DEFAULT 0,
      due_after_cases SMALLINT UNSIGNED NOT NULL DEFAULT 4,
      status ENUM('open','done','failed') NOT NULL DEFAULT 'open',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP NULL,
      PRIMARY KEY (id),
      KEY idx_kc_rem_open (account_id, subject_id, status),
      KEY idx_kc_rem_atom (atom_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS kc_shift (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      account_id VARCHAR(96) NOT NULL DEFAULT '',
      student_id INT UNSIGNED NULL,
      school_id INT UNSIGNED NULL,
      subject_id INT UNSIGNED NOT NULL,
      shift_type ENUM('quick','standard','full','timed','endless') NOT NULL DEFAULT 'standard',
      planned_cases SMALLINT UNSIGNED NOT NULL DEFAULT 20,
      entry_cost_gold INT UNSIGNED NOT NULL DEFAULT 0,
      payout_gold INT UNSIGNED NOT NULL DEFAULT 0,
      status ENUM('active','ended','abandoned') NOT NULL DEFAULT 'active',
      completed_cases SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      first_attempt_correct SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      independent_correct SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      near_transfer_correct SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      recovery_cases SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      handbook_uses SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      best_streak SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      stages_advanced SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      avg_response_ms INT UNSIGNED NOT NULL DEFAULT 0,
      started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ended_at TIMESTAMP NULL,
      PRIMARY KEY (id),
      KEY idx_kc_shift_acct (account_id, subject_id, started_at),
      KEY idx_kc_shift_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS kc_shift_case (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      shift_id BIGINT UNSIGNED NOT NULL,
      ordinal SMALLINT UNSIGNED NOT NULL,
      question_id INT UNSIGNED NOT NULL,
      atom_id INT UNSIGNED NOT NULL,
      format VARCHAR(32) NOT NULL DEFAULT 'multiple_choice',
      selector_reason VARCHAR(24) NOT NULL DEFAULT '',
      first_attempt_correct TINYINT(1) NOT NULL DEFAULT 0,
      corrected TINYINT(1) NOT NULL DEFAULT 0,
      independent TINYINT(1) NOT NULL DEFAULT 1,
      response_ms INT UNSIGNED NOT NULL DEFAULT 0,
      gold_delta INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_kc_case_shift (shift_id, ordinal),
      KEY idx_kc_case_atom (atom_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }

  // Extend the existing MCQ tables with atom/format/shift linkage. Idempotent:
  // guarded by SHOW COLUMNS, mirroring ensureHomeworkColumns.
  async ensureKnowledgeChallengeColumns(pool) {
    const columnsOf = async table => {
      try {
        const [rows] = await pool.execute(`SHOW COLUMNS FROM ${table}`);
        return Array.isArray(rows) ? rows.map(row => String(row.Field || '').toLowerCase()) : [];
      } catch (_) {
        return null;
      }
    };
    const question = await columnsOf('game_question');
    if (question) {
      if (!question.includes('format')) {
        await pool.execute(`ALTER TABLE game_question ADD COLUMN format ENUM(
          'multiple_choice','classify','approve_reject','replace','compare',
          'repair_diagram','predict_consequence','construct_justification'
        ) NOT NULL DEFAULT 'multiple_choice' AFTER spec`);
      }
      if (!question.includes('entity_id')) {
        await pool.execute('ALTER TABLE game_question ADD COLUMN entity_id INT UNSIGNED NULL AFTER format');
      }
      if (!question.includes('primary_atom_id')) {
        await pool.execute('ALTER TABLE game_question ADD COLUMN primary_atom_id INT UNSIGNED NULL AFTER entity_id, ADD KEY idx_gq_atom (primary_atom_id)');
      }
      if (!question.includes('confusion_pair_id')) {
        await pool.execute('ALTER TABLE game_question ADD COLUMN confusion_pair_id INT UNSIGNED NULL AFTER primary_atom_id, ADD KEY idx_gq_confusion (confusion_pair_id)');
      }
      if (!question.includes('payload_json')) {
        await pool.execute('ALTER TABLE game_question ADD COLUMN payload_json LONGTEXT NULL AFTER explanation');
      }
      if (!question.includes('use_recall')) {
        await pool.execute('ALTER TABLE game_question ADD COLUMN use_recall TINYINT(1) NOT NULL DEFAULT 1 AFTER is_active');
      }
      if (!question.includes('use_scholar')) {
        await pool.execute('ALTER TABLE game_question ADD COLUMN use_scholar TINYINT(1) NOT NULL DEFAULT 1 AFTER use_recall');
      }
      if (!question.includes('use_meditation')) {
        await pool.execute('ALTER TABLE game_question ADD COLUMN use_meditation TINYINT(1) NOT NULL DEFAULT 0 AFTER use_scholar');
      }
    }
    const attempt = await columnsOf('game_question_attempt');
    if (attempt) {
      if (!attempt.includes('atom_id')) {
        await pool.execute('ALTER TABLE game_question_attempt ADD COLUMN atom_id INT UNSIGNED NULL AFTER question_id, ADD KEY idx_gqa_atom (atom_id, created_at)');
      }
      if (!attempt.includes('format')) {
        await pool.execute("ALTER TABLE game_question_attempt ADD COLUMN format VARCHAR(32) NOT NULL DEFAULT 'multiple_choice' AFTER atom_id");
      }
      if (!attempt.includes('shift_id')) {
        await pool.execute('ALTER TABLE game_question_attempt ADD COLUMN shift_id BIGINT UNSIGNED NULL AFTER format, ADD KEY idx_gqa_shift (shift_id)');
      }
      if (!attempt.includes('case_ordinal')) {
        await pool.execute('ALTER TABLE game_question_attempt ADD COLUMN case_ordinal SMALLINT UNSIGNED NULL AFTER shift_id');
      }
      if (!attempt.includes('first_attempt')) {
        await pool.execute('ALTER TABLE game_question_attempt ADD COLUMN first_attempt TINYINT(1) NOT NULL DEFAULT 1 AFTER case_ordinal');
      }
      if (!attempt.includes('required_correction')) {
        await pool.execute('ALTER TABLE game_question_attempt ADD COLUMN required_correction TINYINT(1) NOT NULL DEFAULT 0 AFTER first_attempt');
      }
      if (!attempt.includes('corrective_passed')) {
        await pool.execute('ALTER TABLE game_question_attempt ADD COLUMN corrective_passed TINYINT(1) NOT NULL DEFAULT 0 AFTER required_correction');
      }
      if (!attempt.includes('recovery_passed')) {
        await pool.execute('ALTER TABLE game_question_attempt ADD COLUMN recovery_passed TINYINT(1) NOT NULL DEFAULT 0 AFTER corrective_passed');
      }
      if (!attempt.includes('independent')) {
        await pool.execute('ALTER TABLE game_question_attempt ADD COLUMN independent TINYINT(1) NOT NULL DEFAULT 1 AFTER recovery_passed');
      }
      if (!attempt.includes('handbook_used')) {
        await pool.execute('ALTER TABLE game_question_attempt ADD COLUMN handbook_used TINYINT(1) NOT NULL DEFAULT 0 AFTER independent');
      }
      if (!attempt.includes('selector_reason')) {
        await pool.execute("ALTER TABLE game_question_attempt ADD COLUMN selector_reason VARCHAR(24) NOT NULL DEFAULT '' AFTER handbook_used");
      }
    }
  }

  // Seed the default global atom facets (subject_id NULL). Idempotent: only
  // inserts when the global set is missing. Subjects may add their own later.
  async seedKnowledgeChallengeAtomTypes(pool) {
    let existing = 0;
    try {
      const [rows] = await pool.execute('SELECT COUNT(*) AS n FROM kc_atom_type WHERE subject_id IS NULL');
      existing = Array.isArray(rows) && rows[0] ? Number(rows[0].n) || 0 : 0;
    } catch (_) {
      return;
    }
    if (existing > 0) return;
    const defaults = [
      ['recognition', 'Recognition', 10],
      ['category', 'Category', 20],
      ['purpose', 'Purpose', 30],
      ['use', 'Use', 40],
      ['advantage', 'Advantage', 50],
      ['disadvantage', 'Disadvantage', 60],
      ['comparison', 'Comparison', 70],
      ['system_role', 'System role', 80],
      ['contextual_justification', 'Contextual justification', 90],
    ];
    for (const [code, label, sort] of defaults) {
      await pool.execute(
        'INSERT INTO kc_atom_type (subject_id, code, label, sort_order) VALUES (NULL, ?, ?, ?)',
        [code, label, sort],
      ).catch(() => {});
    }
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
    const modes = cleanQuestionModes(input);
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
      modes,
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
       (school_id, subject_id, teacher_id, topic, stage, difficulty, spec, prompt, answers, correct_index, explanation, review_status, is_active, use_recall, use_scholar, use_meditation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        patch.modes.recall ? 1 : 0,
        patch.modes.scholar ? 1 : 0,
        patch.modes.meditation ? 1 : 0,
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
       SET topic = ?, stage = ?, difficulty = ?, spec = ?, prompt = ?, answers = ?, correct_index = ?, explanation = ?, review_status = ?, is_active = ?, use_recall = ?, use_scholar = ?, use_meditation = ?
       WHERE id = ?`,
      [next.topic, next.stage, next.difficulty, next.spec, next.prompt, JSON.stringify(next.answers), next.correct, next.explanation, next.reviewStatus, next.active ? 1 : 0, next.modes.recall ? 1 : 0, next.modes.scholar ? 1 : 0, next.modes.meditation ? 1 : 0, existing.id],
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

  // ---- Knowledge Challenge persistence (see docs/KNOWLEDGE_CHALLENGE_DB.md) ----
  // Bridges the pure engine (shared/knowledge-challenge.js) to the kc_* tables.
  // Player state keys on account_id (VARCHAR) so it works for any account;
  // student_id is filled in when the account is a "student_N".

  async resolvePlaySubject(account, input = {}) {
    await this.ensureSchema();
    const schoolId = clampInt(account && account.schoolId, 0, 2147483647);
    const pool = this.getPool();
    const byId = clampInt(input.subjectId || input.subject_id, 0, 2147483647);
    if (byId) {
      const [rows] = await pool.execute(
        `SELECT id, name, code, school_id FROM subjects
         WHERE id = ? AND is_active = 1 AND (school_id IS NULL OR ? = 0 OR school_id = ?)
         LIMIT 1`,
        [byId, schoolId, schoolId],
      );
      const s = rows && rows[0];
      return s ? { subjectId: Number(s.id), scopeSchoolId: s.school_id == null ? schoolId : Number(s.school_id), subjectName: s.name || '', subjectCode: s.code || '' } : null;
    }
    const name = cleanText(input.subject, 96);
    if (!name) return null;
    const [rows] = await pool.execute(
      `SELECT id, name, code, school_id FROM subjects
       WHERE is_active = 1 AND (LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?))
         AND (school_id IS NULL OR ? = 0 OR school_id = ?)
       ORDER BY CASE WHEN school_id = ? THEN 0 ELSE 1 END, id ASC
       LIMIT 1`,
      [name, name, schoolId, schoolId, schoolId],
    );
    const s = rows && rows[0];
    return s ? { subjectId: Number(s.id), scopeSchoolId: s.school_id == null ? schoolId : Number(s.school_id), subjectName: s.name || '', subjectCode: s.code || '' } : null;
  }

  async challengeContentCount(subjectId) {
    await this.ensureSchema();
    subjectId = clampInt(subjectId, 1, 2147483647);
    if (!subjectId) return 0;
    const [rows] = await this.getPool().execute(
      `SELECT COUNT(DISTINCT a.id) AS n
       FROM kc_atom a
       JOIN game_question q ON q.primary_atom_id = a.id
        AND q.subject_id = a.subject_id
        AND q.is_active = 1
        AND COALESCE(q.use_scholar, 1) = 1
        AND q.review_status IN ('approved', 'teacher-reviewed')
       WHERE a.subject_id = ? AND a.is_active = 1`,
      [subjectId],
    );
    return Number(rows && rows[0] && rows[0].n) || 0;
  }

  async approvedQuestionCount(subjectId) {
    await this.ensureSchema();
    subjectId = clampInt(subjectId, 1, 2147483647);
    if (!subjectId) return 0;
    const [rows] = await this.getPool().execute(
      `SELECT COUNT(*) AS n
       FROM game_question
       WHERE subject_id = ? AND is_active = 1
         AND COALESCE(use_scholar, 1) = 1
         AND review_status IN ('approved', 'teacher-reviewed')`,
      [subjectId],
    );
    return Number(rows && rows[0] && rows[0].n) || 0;
  }

  async findPlayableChallengeSubject(account, input = {}) {
    await this.ensureSchema();
    const schoolId = clampInt(account && account.schoolId, 0, 2147483647);
    const requestedSubject = cleanText(input.subject, 96);
    const requested = await this.resolvePlaySubject(account, input).catch(() => null);
    if (requested && ((await this.challengeContentCount(requested.subjectId)) || (await this.approvedQuestionCount(requested.subjectId)))) {
      return Object.assign({}, requested, { requestedSubject, subjectFallback: false });
    }

    const fallbackSubject = cleanText(input.fallbackSubject, 96) || 'Computer Science';
    const fallback = fallbackSubject && fallbackSubject !== requestedSubject
      ? await this.resolvePlaySubject(account, { subject: fallbackSubject }).catch(() => null)
      : null;
    if (fallback && ((await this.challengeContentCount(fallback.subjectId)) || (await this.approvedQuestionCount(fallback.subjectId)))) {
      return Object.assign({}, fallback, { requestedSubject, subjectFallback: !!requested && fallback.subjectId !== requested.subjectId });
    }

    let [rows] = await this.getPool().execute(
      `SELECT s.id, s.name, s.code, s.school_id, COUNT(DISTINCT a.id) AS playable_atoms
       FROM subjects s
       JOIN game_question q ON q.subject_id = s.id AND q.is_active = 1
        AND COALESCE(q.use_scholar, 1) = 1
        AND q.review_status IN ('approved', 'teacher-reviewed')
       LEFT JOIN kc_atom a ON a.id = q.primary_atom_id AND a.subject_id = s.id AND a.is_active = 1
       WHERE s.is_active = 1 AND (s.school_id IS NULL OR ? = 0 OR s.school_id = ?)
       GROUP BY s.id, s.name, s.code, s.school_id
       ORDER BY CASE WHEN LOWER(s.name) = LOWER(?) OR LOWER(s.code) = LOWER(?) THEN 0 WHEN s.school_id = ? THEN 1 ELSE 2 END,
                playable_atoms DESC, COUNT(q.id) DESC, s.id ASC
       LIMIT 1`,
      [schoolId, schoolId, fallbackSubject, fallbackSubject, schoolId],
    );
    if (!rows || !rows.length) {
      [rows] = await this.getPool().execute(
        `SELECT s.id, s.name, s.code, s.school_id, COUNT(DISTINCT a.id) AS playable_atoms
         FROM subjects s
         JOIN game_question q ON q.subject_id = s.id AND q.is_active = 1
          AND COALESCE(q.use_scholar, 1) = 1
          AND q.review_status IN ('approved', 'teacher-reviewed')
         LEFT JOIN kc_atom a ON a.id = q.primary_atom_id AND a.subject_id = s.id AND a.is_active = 1
         WHERE s.is_active = 1
         GROUP BY s.id, s.name, s.code, s.school_id
         ORDER BY CASE
                    WHEN LOWER(s.name) = LOWER(?) OR LOWER(s.code) = LOWER(?) THEN 0
                    WHEN s.school_id = ? THEN 1
                    WHEN s.school_id IS NULL THEN 2
                    ELSE 3
                  END,
                  playable_atoms DESC, COUNT(q.id) DESC, s.id ASC
         LIMIT 1`,
        [fallbackSubject, fallbackSubject, schoolId],
      );
    }
    const s = rows && rows[0];
    return s ? {
      subjectId: Number(s.id),
      scopeSchoolId: s.school_id == null ? schoolId : Number(s.school_id),
      subjectName: s.name || '',
      subjectCode: s.code || '',
      requestedSubject,
      subjectFallback: !requested || Number(s.id) !== requested.subjectId,
    } : null;
  }

  async debugChallengeSubjects(account, input = {}) {
    await this.ensureSchema();
    const schoolId = clampInt(account && account.schoolId, 0, 2147483647);
    const requestedSubject = cleanText(input.subject, 96);
    const fallbackSubject = cleanText(input.fallbackSubject, 96) || 'Computer Science';
    const requested = requestedSubject ? await this.resolvePlaySubject(account, input).catch(e => ({ error: e && e.message || String(e) })) : null;
    const fallback = fallbackSubject ? await this.resolvePlaySubject(account, { subject: fallbackSubject }).catch(e => ({ error: e && e.message || String(e) })) : null;
    async function withCount(store, subject) {
      if (!subject || subject.error || !subject.subjectId) return subject || null;
      const playableAtoms = await store.challengeContentCount(subject.subjectId).catch(() => -1);
      const approvedQuestions = await store.approvedQuestionCount(subject.subjectId).catch(() => -1);
      return Object.assign({}, subject, { playableAtoms, approvedQuestions });
    }
    const [rows] = await this.getPool().execute(
      `SELECT s.id, s.name, s.code, s.school_id,
              COUNT(DISTINCT a.id) AS active_atoms,
              COUNT(DISTINCT q.primary_atom_id) AS playable_atoms,
              COUNT(q.id) AS approved_questions,
              (SELECT COUNT(*) FROM game_question gq
               WHERE gq.subject_id = s.id AND gq.is_active = 1
                 AND COALESCE(gq.use_scholar, 1) = 1
                 AND gq.review_status IN ('approved', 'teacher-reviewed')) AS raw_approved_questions
       FROM subjects s
       LEFT JOIN kc_atom a ON a.subject_id = s.id AND a.is_active = 1
       LEFT JOIN game_question q ON q.primary_atom_id = a.id
        AND q.subject_id = s.id
        AND q.is_active = 1
        AND COALESCE(q.use_scholar, 1) = 1
        AND q.review_status IN ('approved', 'teacher-reviewed')
       WHERE s.is_active = 1 AND (s.school_id IS NULL OR ? = 0 OR s.school_id = ?)
       GROUP BY s.id, s.name, s.code, s.school_id
       ORDER BY playable_atoms DESC, approved_questions DESC, active_atoms DESC, s.id ASC
      LIMIT 12`,
      [schoolId, schoolId],
    );
    const [anyRows] = await this.getPool().execute(
      `SELECT s.id, s.name, s.code, s.school_id,
              COUNT(DISTINCT a.id) AS active_atoms,
              COUNT(DISTINCT q.primary_atom_id) AS playable_atoms,
              COUNT(q.id) AS approved_questions,
              (SELECT COUNT(*) FROM game_question gq
               WHERE gq.subject_id = s.id AND gq.is_active = 1
                 AND COALESCE(gq.use_scholar, 1) = 1
                 AND gq.review_status IN ('approved', 'teacher-reviewed')) AS raw_approved_questions
       FROM subjects s
       LEFT JOIN kc_atom a ON a.subject_id = s.id AND a.is_active = 1
       LEFT JOIN game_question q ON q.primary_atom_id = a.id
        AND q.subject_id = s.id
        AND q.is_active = 1
        AND COALESCE(q.use_scholar, 1) = 1
        AND q.review_status IN ('approved', 'teacher-reviewed')
       WHERE s.is_active = 1
       GROUP BY s.id, s.name, s.code, s.school_id
       ORDER BY playable_atoms DESC, approved_questions DESC, active_atoms DESC, s.id ASC
       LIMIT 12`,
    );
    const mapRow = r => ({
      subjectId: Number(r.id) || 0,
      name: r.name || '',
      code: r.code || '',
      schoolId: r.school_id == null ? null : Number(r.school_id),
      activeAtoms: Number(r.active_atoms) || 0,
      playableAtoms: Number(r.playable_atoms) || 0,
      approvedQuestions: Number(r.approved_questions) || 0,
      rawApprovedQuestions: Number(r.raw_approved_questions) || 0,
    });
    return {
      schoolId,
      requestedSubject,
      fallbackSubject,
      requested: await withCount(this, requested),
      fallback: await withCount(this, fallback),
      available: (rows || []).map(mapRow),
      availableAnySchool: (anyRows || []).map(mapRow),
    };
  }

  // Student-merged atoms for the selector: every active atom in the subject,
  // LEFT JOINed to this account's fluency record (null state for unseen atoms).
  async loadStudentAtoms(account, query = {}) {
    await this.ensureSchema();
    const accountId = String(account && account.id || '');
    const subjectId = clampInt(query.subjectId || query.subject_id, 1, 2147483647);
    if (!subjectId) return { subjectId: 0, atoms: [] };
    const playableOnly = !!query.playableOnly;
    const playableJoin = playableOnly
      ? `JOIN game_question playable_q ON playable_q.primary_atom_id = a.id
          AND playable_q.subject_id = a.subject_id
          AND playable_q.is_active = 1
          AND COALESCE(playable_q.use_scholar, 1) = 1
          AND playable_q.review_status IN ('approved', 'teacher-reviewed')`
      : '';
    const params = [accountId, subjectId];
    const [rows] = await this.getPool().execute(
      `SELECT a.id AS atom_id, a.difficulty, a.entity_id,
              sa.stage, sa.attempts, sa.correct, sa.first_attempt_correct, sa.streak,
              sa.ease, sa.interval_idx, UNIX_TIMESTAMP(sa.next_due) * 1000 AS next_due_ms,
              sa.formats_seen, sa.discriminated, sa.near_transfer_ok, sa.explained,
              sa.delayed_success, sa.last_shift_id, sa.sessions_seen,
              UNIX_TIMESTAMP(sa.last_seen_at) * 1000 AS last_seen_ms
       FROM kc_atom a
       ${playableJoin}
       LEFT JOIN kc_student_atom sa ON sa.atom_id = a.id AND sa.account_id = ?
       WHERE a.subject_id = ? AND a.is_active = 1
       GROUP BY a.id, a.difficulty, a.entity_id,
                sa.stage, sa.attempts, sa.correct, sa.first_attempt_correct, sa.streak,
                sa.ease, sa.interval_idx, sa.next_due, sa.formats_seen, sa.discriminated,
                sa.near_transfer_ok, sa.explained, sa.delayed_success, sa.last_shift_id,
                sa.sessions_seen, sa.last_seen_at
       ORDER BY a.id ASC`,
      params,
    );
    const atoms = (rows || []).map(row => ({
      atomId: Number(row.atom_id) || 0,
      difficulty: Number(row.difficulty) || 1,
      entityId: Number(row.entity_id) || 0,
      state: atomStateFromRow(row),
    }));
    if (!atoms.length && query.questionFallback !== false) {
      const [questionRows] = await this.getPool().execute(
        `SELECT q.id, q.difficulty, q.topic, q.stage
         FROM game_question q
         WHERE q.subject_id = ? AND q.is_active = 1
           AND COALESCE(q.use_scholar, 1) = 1
           AND q.review_status IN ('approved', 'teacher-reviewed')
         ORDER BY q.id ASC
         LIMIT 500`,
        [subjectId],
      );
      for (const row of questionRows || []) {
        const questionId = Number(row.id) || 0;
        if (!questionId) continue;
        atoms.push({
          atomId: KC_QUESTION_ATOM_OFFSET + questionId,
          questionId,
          syntheticQuestionAtom: true,
          difficulty: Number(row.difficulty) || 1,
          entityId: 0,
          state: {},
        });
      }
    }
    return { subjectId, atoms };
  }

  // Fetch a servable challenge for a selected atom, optionally avoiding a format
  // the atom was just shown in. Returns null when the atom has no live question.
  async loadChallengeForAtom(subjectId, atomId, opts = {}) {
    await this.ensureSchema();
    subjectId = clampInt(subjectId, 1, 2147483647);
    atomId = clampInt(atomId, 1, 2147483647);
    if (!subjectId || !atomId) return null;
    const syntheticQuestionId = atomId >= KC_QUESTION_ATOM_OFFSET ? atomId - KC_QUESTION_ATOM_OFFSET : 0;
    const [rows] = syntheticQuestionId
      ? await this.getPool().execute(
        `SELECT id, format, prompt, answers, correct_index, explanation, payload_json,
                entity_id, primary_atom_id, confusion_pair_id, difficulty
         FROM game_question
         WHERE id = ? AND subject_id = ? AND is_active = 1
           AND COALESCE(use_scholar, 1) = 1
           AND review_status IN ('approved', 'teacher-reviewed')
         LIMIT 1`,
        [syntheticQuestionId, subjectId],
      )
      : await this.getPool().execute(
        `SELECT id, format, prompt, answers, correct_index, explanation, payload_json,
                entity_id, primary_atom_id, confusion_pair_id, difficulty
         FROM game_question
         WHERE subject_id = ? AND primary_atom_id = ? AND is_active = 1
           AND COALESCE(use_scholar, 1) = 1
           AND review_status IN ('approved', 'teacher-reviewed')
         ORDER BY RAND()
         LIMIT 8`,
        [subjectId, atomId],
      );
    let list = rows || [];
    if (!list.length) return null;
    const avoid = cleanText(opts.avoidFormat, 32);
    if (avoid) { const filtered = list.filter(r => r.format !== avoid); if (filtered.length) list = filtered; }
    const row = list[0];
    let answers = [];
    try { answers = JSON.parse(row.answers || '[]'); } catch (_) {}
    if (!Array.isArray(answers)) answers = [];
    let payload = null;
    if (row.payload_json) { try { payload = JSON.parse(row.payload_json); } catch (_) {} }
    if (syntheticQuestionId && (!row.primary_atom_id || (row.format || 'multiple_choice') === 'multiple_choice')) {
      return syntheticScholarChallenge({ ...row, _answers: answers }, atomId, opts);
    }
    return {
      questionId: Number(row.id) || 0,
      atomId,
      format: row.format || 'multiple_choice',
      prompt: row.prompt || '',
      answers,
      correctIndex: Number(row.correct_index) || 0,
      explanation: row.explanation || '',
      payload,
      entityId: row.entity_id == null ? null : Number(row.entity_id),
      confusionPairId: row.confusion_pair_id == null ? null : Number(row.confusion_pair_id),
      difficulty: Number(row.difficulty) || 1,
    };
  }

  async loadMeditationChallenge(account, input = {}) {
    await this.ensureSchema();
    const subject = await this.findPlayableMeditationSubject(account, input);
    if (!subject || !subject.subjectId) return null;
    const [rows] = await this.getPool().execute(
      `SELECT id, prompt, answers, correct_index, explanation, topic, stage, difficulty
       FROM game_question
       WHERE subject_id = ? AND is_active = 1
         AND COALESCE(use_meditation, 0) = 1
         AND review_status IN ('approved', 'teacher-reviewed')
       ORDER BY RAND()
       LIMIT 25`,
      [subject.subjectId],
    );
    for (const row of rows || []) {
      let answers = [];
      try { answers = JSON.parse(row.answers || '[]'); } catch (_) {}
      if (!Array.isArray(answers) || answers.length < 2) continue;
      answers = answers.map(v => cleanText(v, 160)).filter(Boolean).slice(0, 4);
      if (answers.length < 2) continue;
      return {
        id: 'db-' + (Number(row.id) || 0) + '-' + Date.now().toString(36),
        questionId: Number(row.id) || 0,
        type: 'multiple_choice',
        subjectId: subject.subjectId,
        subjectName: subject.subjectName || '',
        topic: row.topic || '',
        stage: row.stage || '',
        difficulty: Number(row.difficulty) || 1,
        prompt: row.prompt || '',
        answers,
        correctIndex: Math.max(0, Math.min(answers.length - 1, Number(row.correct_index) || 0)),
        explanation: row.explanation || '',
      };
    }
    return null;
  }

  async findPlayableMeditationSubject(account, input = {}) {
    await this.ensureSchema();
    const schoolId = clampInt(account && account.schoolId, 0, 2147483647);
    const requestedSubject = cleanText(input.subject, 96);
    const requested = requestedSubject ? await this.resolvePlaySubject(account, input).catch(() => null) : null;
    const hasMeditation = async subjectId => {
      if (!subjectId) return false;
      const [rows] = await this.getPool().execute(
        `SELECT COUNT(*) AS n
         FROM game_question
         WHERE subject_id = ? AND is_active = 1
           AND COALESCE(use_meditation, 0) = 1
           AND review_status IN ('approved', 'teacher-reviewed')`,
        [subjectId],
      );
      return (Number(rows && rows[0] && rows[0].n) || 0) > 0;
    };
    if (requested && await hasMeditation(requested.subjectId)) return requested;
    const fallbackSubject = cleanText(input.fallbackSubject, 96) || 'Computer Science';
    const fallback = fallbackSubject ? await this.resolvePlaySubject(account, { subject: fallbackSubject }).catch(() => null) : null;
    if (fallback && await hasMeditation(fallback.subjectId)) return fallback;
    const [rows] = await this.getPool().execute(
      `SELECT s.id, s.name, s.code, s.school_id, COUNT(q.id) AS n
       FROM subjects s
       JOIN game_question q ON q.subject_id = s.id
        AND q.is_active = 1
        AND COALESCE(q.use_meditation, 0) = 1
        AND q.review_status IN ('approved', 'teacher-reviewed')
       WHERE s.is_active = 1 AND (s.school_id IS NULL OR ? = 0 OR s.school_id = ?)
       GROUP BY s.id, s.name, s.code, s.school_id
       ORDER BY CASE WHEN LOWER(s.name) = LOWER(?) OR LOWER(s.code) = LOWER(?) THEN 0 WHEN s.school_id = ? THEN 1 ELSE 2 END,
                n DESC, s.id ASC
       LIMIT 1`,
      [schoolId, schoolId, fallbackSubject, fallbackSubject, schoolId],
    );
    const s = rows && rows[0];
    return s ? { subjectId: Number(s.id), scopeSchoolId: s.school_id == null ? schoolId : Number(s.school_id), subjectName: s.name || '', subjectCode: s.code || '' } : null;
  }

  async loadConfusionPairs(subjectId) {
    await this.ensureSchema();
    subjectId = clampInt(subjectId, 1, 2147483647);
    if (!subjectId) return [];
    const [rows] = await this.getPool().execute(
      'SELECT atom_a_id, atom_b_id FROM kc_confusion_pair WHERE subject_id = ?',
      [subjectId],
    );
    return (rows || []).map(r => ({ atomAId: Number(r.atom_a_id) || 0, atomBId: Number(r.atom_b_id) || 0 }));
  }

  // Idempotent bulk import of a content pack for one subject: entities -> atoms
  // -> atom-linked questions, plus confusion pairs. Re-running updates in place
  // (entities/atoms dedupe on their stable code; questions on subject+prompt).
  async importContentPack(subjectId, pack = {}, opts = {}) {
    await this.ensureSchema();
    subjectId = clampInt(subjectId, 1, 2147483647);
    if (!subjectId) throw Object.assign(new Error('A subjectId is required.'), { code: 'subject' });
    const pool = this.getPool();
    const schoolId = clampInt(opts.schoolId, 0, 2147483647) || null;
    const counts = { atomTypes: 0, entities: 0, atoms: 0, questions: 0, pairs: 0 };

    for (const t of Array.isArray(pack.atomTypes) ? pack.atomTypes : []) {
      const code = cleanText(t.code, 48);
      if (!code) continue;
      await pool.execute(
        `INSERT INTO kc_atom_type (subject_id, code, label, sort_order) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE label = VALUES(label), sort_order = VALUES(sort_order)`,
        [subjectId, code, cleanText(t.label, 96) || code, clampInt(t.sortOrder, 0, 32767)],
      );
      counts.atomTypes++;
    }

    // Resolve atom-type code -> id (subject-specific wins over the global default set).
    const [typeRows] = await pool.execute(
      'SELECT id, code, subject_id FROM kc_atom_type WHERE subject_id = ? OR subject_id IS NULL',
      [subjectId],
    );
    const typeByCode = new Map();
    for (const r of typeRows || []) {
      const prev = typeByCode.get(r.code);
      if (!prev || (prev.subject_id == null && r.subject_id != null)) typeByCode.set(r.code, r);
    }

    const atomIdByCode = new Map();
    for (const e of Array.isArray(pack.entities) ? pack.entities : []) {
      const eCode = cleanText(e.code, 64);
      if (!eCode) continue;
      const topic = cleanText(e.topic, 96);
      const stage = cleanText(e.stage, 32);
      const [er] = await pool.execute(
        `INSERT INTO kc_entity (school_id, subject_id, code, name, topic, stage, summary)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), name = VALUES(name), topic = VALUES(topic), stage = VALUES(stage), summary = VALUES(summary)`,
        [schoolId, subjectId, eCode, cleanText(e.name, 120) || eCode, topic, stage, cleanText(e.summary, 2000)],
      );
      const entityId = Number(er.insertId) || 0;
      counts.entities++;
      for (const a of Array.isArray(e.atoms) ? e.atoms : []) {
        const typeRow = typeByCode.get(cleanText(a.type, 48));
        if (!typeRow) continue;
        const difficulty = clampInt(a.difficulty || 1, 1, 3);
        const code = eCode + '.' + typeRow.code;
        const [ar] = await pool.execute(
          `INSERT INTO kc_atom (subject_id, entity_id, atom_type_id, code, statement, difficulty)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), entity_id = VALUES(entity_id), atom_type_id = VALUES(atom_type_id), statement = VALUES(statement), difficulty = VALUES(difficulty)`,
          [subjectId, entityId, Number(typeRow.id), code, cleanText(a.statement, 2000), difficulty],
        );
        const atomId = Number(ar.insertId) || 0;
        atomIdByCode.set(code, atomId);
        counts.atoms++;
        for (const q of Array.isArray(a.questions) ? a.questions : []) {
          const prompt = cleanText(q.prompt, 500);
          if (prompt.length < 3) continue;
          const format = KC.FORMATS.includes(q.format) ? q.format : 'multiple_choice';
          const answers = JSON.stringify(Array.isArray(q.answers) ? q.answers.map(v => cleanText(v, 160)).filter(Boolean) : []);
          const correct = clampInt(q.correct, 0, 15);
          const explanation = cleanText(q.explanation, 800);
          const payload = q.payload ? JSON.stringify(q.payload) : null;
          const [existing] = await pool.execute('SELECT id FROM game_question WHERE subject_id = ? AND prompt = ? LIMIT 1', [subjectId, prompt]);
          const qid = (existing && existing[0] && Number(existing[0].id)) || 0;
          if (qid) {
            await pool.execute(
              `UPDATE game_question SET format = ?, entity_id = ?, primary_atom_id = ?, answers = ?, correct_index = ?, explanation = ?, payload_json = ?, topic = ?, stage = ?, difficulty = ?, review_status = 'approved', is_active = 1 WHERE id = ?`,
              [format, entityId, atomId, answers, correct, explanation, payload, topic, stage, difficulty, qid],
            );
          } else {
            await pool.execute(
              `INSERT INTO game_question
               (school_id, subject_id, teacher_id, topic, stage, difficulty, spec, prompt, answers, correct_index, explanation, review_status, is_active, format, entity_id, primary_atom_id, payload_json)
               VALUES (?, ?, NULL, ?, ?, ?, 'kc-pack', ?, ?, ?, ?, 'approved', 1, ?, ?, ?, ?)`,
              [schoolId, subjectId, topic, stage, difficulty, prompt, answers, correct, explanation, format, entityId, atomId, payload],
            );
          }
          counts.questions++;
        }
      }
    }

    for (const p of Array.isArray(pack.confusionPairs) ? pack.confusionPairs : []) {
      const aId = atomIdByCode.get(cleanText(p.a, 96));
      const bId = atomIdByCode.get(cleanText(p.b, 96));
      if (!aId || !bId) continue;
      await pool.execute(
        `INSERT INTO kc_confusion_pair (subject_id, atom_a_id, atom_b_id, note) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE note = VALUES(note)`,
        [subjectId, aId, bId, cleanText(p.note, 240)],
      );
      counts.pairs++;
    }
    return counts;
  }

  async listOpenRemediation(account, query = {}) {
    await this.ensureSchema();
    const accountId = String(account && account.id || '');
    const subjectId = clampInt(query.subjectId || query.subject_id, 1, 2147483647);
    if (!accountId || !subjectId) return [];
    const [rows] = await this.getPool().execute(
      `SELECT id, atom_id, confusion_pair_id, reason, stage_of_loop,
              corrective_passed, recovery_passed, due_after_cases
       FROM kc_remediation
       WHERE account_id = ? AND subject_id = ? AND status = 'open'
       ORDER BY created_at ASC`,
      [accountId, subjectId],
    );
    return (rows || []).map(r => ({
      id: Number(r.id) || 0,
      atomId: Number(r.atom_id) || 0,
      confusionPairId: r.confusion_pair_id == null ? null : Number(r.confusion_pair_id),
      reason: r.reason || 'wrong',
      stageOfLoop: Number(r.stage_of_loop) || 0,
      correctivePassed: r.corrective_passed === 1 || r.corrective_passed === true,
      recoveryPassed: r.recovery_passed === 1 || r.recovery_passed === true,
      dueAfterCases: Number(r.due_after_cases) || 0,
    }));
  }

  // Load -> run the pure stage machine -> upsert. Returns the engine verdict.
  async recordAtomReview(account, input = {}) {
    await this.ensureSchema();
    const accountId = String(account && account.id || '');
    const subjectId = clampInt(input.subjectId || input.subject_id, 1, 2147483647);
    const atomId = clampInt(input.atomId || input.atom_id, 1, 2147483647);
    if (!accountId || !subjectId || !atomId) return { recorded: false, reason: 'context' };
    const now = Number(input.now) || Date.now();
    const pool = this.getPool();
    const [rows] = await pool.execute(
      `SELECT stage, attempts, correct, first_attempt_correct, streak, ease, interval_idx,
              UNIX_TIMESTAMP(next_due) * 1000 AS next_due_ms, formats_seen,
              discriminated, near_transfer_ok, explained, delayed_success,
              last_shift_id, sessions_seen, UNIX_TIMESTAMP(last_seen_at) * 1000 AS last_seen_ms
       FROM kc_student_atom WHERE account_id = ? AND atom_id = ? LIMIT 1`,
      [accountId, atomId],
    );
    const prev = atomStateFromRow(rows && rows[0]);
    const result = KC.reviewAtom(prev, input.event || {}, now);
    const s = result.state;
    const b = v => (v ? 1 : 0);
    const studentId = sourceIdFromAccount(account, 'student') || null;
    await pool.execute(
      `INSERT INTO kc_student_atom
       (student_id, account_id, subject_id, atom_id, stage, attempts, correct, first_attempt_correct,
        streak, ease, interval_idx, next_due, formats_seen, discriminated, near_transfer_ok, explained,
        delayed_success, last_shift_id, sessions_seen, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(? / 1000), ?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(? / 1000))
       ON DUPLICATE KEY UPDATE
         stage = VALUES(stage), attempts = VALUES(attempts), correct = VALUES(correct),
         first_attempt_correct = VALUES(first_attempt_correct), streak = VALUES(streak),
         ease = VALUES(ease), interval_idx = VALUES(interval_idx), next_due = VALUES(next_due),
         formats_seen = VALUES(formats_seen), discriminated = VALUES(discriminated),
         near_transfer_ok = VALUES(near_transfer_ok), explained = VALUES(explained),
         delayed_success = VALUES(delayed_success), last_shift_id = VALUES(last_shift_id),
         sessions_seen = VALUES(sessions_seen), last_seen_at = VALUES(last_seen_at)`,
      [
        studentId, accountId, subjectId, atomId, s.stage, s.attempts, s.correct, s.firstAttemptCorrect,
        s.streak, s.ease, s.intervalIdx, s.nextDue, s.formatsSeen, b(s.discriminated), b(s.nearTransferOk),
        b(s.explained), b(s.delayedSuccess), s.lastShiftId, s.sessionsSeen, s.lastSeenAt,
      ],
    );
    return { recorded: true, state: s, advanced: result.advanced, regressed: result.regressed, reachedMaintain: result.reachedMaintain };
  }

  async openRemediation(account, input = {}) {
    await this.ensureSchema();
    const accountId = String(account && account.id || '');
    const subjectId = clampInt(input.subjectId || input.subject_id, 1, 2147483647);
    const atomId = clampInt(input.atomId || input.atom_id, 1, 2147483647);
    if (!accountId || !subjectId || !atomId) return { opened: false };
    const studentId = sourceIdFromAccount(account, 'student') || null;
    const reason = ['wrong', 'confusion', 'regression'].includes(String(input.reason || '')) ? String(input.reason) : 'wrong';
    const dueAfterCases = clampInt(input.dueAfterCases == null ? 4 : input.dueAfterCases, 1, 20);
    const [result] = await this.getPool().execute(
      `INSERT INTO kc_remediation
       (account_id, student_id, subject_id, atom_id, confusion_pair_id, reason, due_after_cases)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [accountId, studentId, subjectId, atomId, clampInt(input.confusionPairId, 0, 2147483647) || null, reason, dueAfterCases],
    );
    return { opened: true, id: Number(result && result.insertId) || 0 };
  }

  async resolveRemediation(id, patch = {}) {
    await this.ensureSchema();
    id = clampInt(id, 1, Number.MAX_SAFE_INTEGER);
    if (!id) return { updated: false };
    const status = ['open', 'done', 'failed'].includes(String(patch.status || '')) ? String(patch.status) : 'done';
    const done = status !== 'open';
    await this.getPool().execute(
      `UPDATE kc_remediation
       SET stage_of_loop = ?, corrective_passed = ?, recovery_passed = ?, status = ?,
           resolved_at = ${done ? 'NOW()' : 'NULL'}
       WHERE id = ?`,
      [clampInt(patch.stageOfLoop, 0, 2), patch.correctivePassed ? 1 : 0, patch.recoveryPassed ? 1 : 0, status, id],
    );
    return { updated: true };
  }

  async startShift(account, input = {}) {
    await this.ensureSchema();
    const accountId = String(account && account.id || '');
    const subjectId = clampInt(input.subjectId || input.subject_id, 1, 2147483647);
    if (!accountId || !subjectId) return { started: false };
    const types = ['quick', 'standard', 'full', 'timed', 'endless'];
    const shiftType = types.includes(String(input.shiftType || '')) ? String(input.shiftType) : 'standard';
    const plannedCases = clampInt(input.plannedCases, 0, 200);
    const schoolId = clampInt(account && account.schoolId, 0, 2147483647) || null;
    const studentId = sourceIdFromAccount(account, 'student') || null;
    const [result] = await this.getPool().execute(
      `INSERT INTO kc_shift
       (account_id, student_id, school_id, subject_id, shift_type, planned_cases, entry_cost_gold, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [accountId, studentId, schoolId, subjectId, shiftType, plannedCases, clampInt(input.entryCostGold, 0, 1000000)],
    );
    return { started: true, id: Number(result && result.insertId) || 0, shiftType, plannedCases };
  }

  async recordShiftCase(input = {}) {
    await this.ensureSchema();
    const shiftId = clampInt(input.shiftId || input.shift_id, 1, Number.MAX_SAFE_INTEGER);
    if (!shiftId) return { recorded: false };
    await this.getPool().execute(
      `INSERT INTO kc_shift_case
       (shift_id, ordinal, question_id, atom_id, format, selector_reason,
        first_attempt_correct, corrected, independent, response_ms, gold_delta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        shiftId, clampInt(input.ordinal, 0, 65535), clampInt(input.questionId, 0, 2147483647),
        clampInt(input.atomId, 0, 2147483647), cleanText(input.format || 'multiple_choice', 32),
        cleanText(input.selectorReason, 24), input.firstAttemptCorrect ? 1 : 0, input.corrected ? 1 : 0,
        input.independent === false ? 0 : 1, clampInt(input.responseMs, 0, 60 * 60 * 1000),
        Math.round(Number(input.goldDelta) || 0),
      ],
    );
    return { recorded: true };
  }

  // Finalise a shift with its payout and roll-up totals. Only touches an 'active'
  // shift, so a double end / late disconnect cannot overwrite the result.
  async endShift(shiftId, input = {}) {
    await this.ensureSchema();
    shiftId = clampInt(shiftId, 1, Number.MAX_SAFE_INTEGER);
    if (!shiftId) return { ended: false };
    const status = ['ended', 'abandoned'].includes(String(input.status || '')) ? String(input.status) : 'ended';
    const t = input.totals || {};
    const [result] = await this.getPool().execute(
      `UPDATE kc_shift SET
         status = ?, payout_gold = ?, completed_cases = ?, first_attempt_correct = ?,
         independent_correct = ?, near_transfer_correct = ?, recovery_cases = ?, handbook_uses = ?,
         best_streak = ?, stages_advanced = ?, avg_response_ms = ?, ended_at = NOW()
       WHERE id = ? AND status = 'active'`,
      [
        status, clampInt(input.payoutGold, 0, 1000000), clampInt(t.completedCases, 0, 65535),
        clampInt(t.firstAttemptCorrect, 0, 65535), clampInt(t.independentCorrect, 0, 65535),
        clampInt(t.nearTransferCorrect, 0, 65535), clampInt(t.recoveryCases, 0, 65535),
        clampInt(t.handbookUses, 0, 65535), clampInt(t.bestStreak, 0, 65535),
        clampInt(t.stagesAdvanced, 0, 65535), clampInt(t.avgResponseMs, 0, 60 * 60 * 1000), shiftId,
      ],
    );
    return { ended: (result && result.affectedRows) ? true : false, status };
  }

  async logChallengeAttempt(account, input = {}) {
    await this.ensureSchema();
    const accountId = String(account && account.id || '');
    const subjectId = clampInt(input.subjectId || input.subject_id, 1, 2147483647);
    const questionId = clampInt(input.questionId || input.question_id, 1, 2147483647);
    if (!accountId || !subjectId || !questionId) return { recorded: false };
    const studentId = sourceIdFromAccount(account, 'student') || null;
    const schoolId = clampInt(account && account.schoolId, 0, 2147483647) || null;
    await this.getPool().execute(
      `INSERT INTO game_question_attempt
       (school_id, subject_id, class_id, question_id, student_id, account_id, answer_index, correct,
        duration_ms, source, atom_id, format, shift_id, case_ordinal, first_attempt, required_correction,
        corrective_passed, recovery_passed, independent, handbook_used, selector_reason)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        schoolId, subjectId, questionId, studentId, accountId,
        clampInt(input.answerIndex, 0, 15), input.correct ? 1 : 0,
        clampInt(input.durationMs, 0, 60 * 60 * 1000), cleanText(input.source || 'knowledge_challenge', 32),
        clampInt(input.atomId, 0, 2147483647) || null, cleanText(input.format || 'multiple_choice', 32),
        clampInt(input.shiftId, 0, Number.MAX_SAFE_INTEGER) || null,
        input.caseOrdinal == null ? null : clampInt(input.caseOrdinal, 0, 65535),
        input.firstAttempt === false ? 0 : 1, input.requiredCorrection ? 1 : 0,
        input.correctivePassed ? 1 : 0, input.recoveryPassed ? 1 : 0,
        input.independent === false ? 0 : 1, input.handbookUsed ? 1 : 0, cleanText(input.selectorReason, 24),
      ],
    );
    return { recorded: true };
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

module.exports = { MySqlGameQuestionStore, sourceIdFromAccount, publicQuestion, gameQuestionDbConfig };
