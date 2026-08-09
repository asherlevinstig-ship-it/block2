import { createApp, computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import Chart from 'chart.js/auto';
import { apiUrl } from './config.mjs';

const sessionKey = 'blockcraft.auth.session';

function storedSession() {
  try { return typeof localStorage === 'undefined' ? '' : String(localStorage.getItem(sessionKey) || '').trim(); } catch (_) { return ''; }
}

function storeSession(token) {
  try {
    if (typeof localStorage === 'undefined') return;
    const clean = String(token || '').trim();
    if (clean) localStorage.setItem(sessionKey, clean);
    else localStorage.removeItem(sessionKey);
  } catch (_) {}
}

function authHeaders(base = {}) {
  const token = storedSession();
  return token ? { ...base, Authorization: 'Bearer ' + token } : base;
}

async function requestJson(path, options = {}) {
  const { skipAuth = false, ...fetchOptions } = options || {};
  const res = await fetch(apiUrl(path), {
    credentials: 'include',
    ...fetchOptions,
    headers: skipAuth ? (fetchOptions.headers || {}) : authHeaders(fetchOptions.headers || {}),
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error(data.error || 'Teacher dashboard request failed.');
  return data;
}

function sameAccount(a, b) {
  const left = String(a && a.id || '').trim().toLowerCase();
  const right = String(b && b.id || '').trim().toLowerCase();
  if (left && right) return left === right;
  const leftName = String(a && (a.username || a.email) || '').trim().toLowerCase();
  const rightName = String(b && (b.username || b.email) || '').trim().toLowerCase();
  return !!leftName && leftName === rightName;
}

function teacherHandoffToken() {
  try {
    if (typeof location === 'undefined') return '';
    const params = new URLSearchParams(location.search || '');
    return String(params.get('auth_token') || params.get('teacher_token') || params.get('token') || '').trim();
  } catch (_) {
    return '';
  }
}

function isMisLaunch() {
  try {
    if (typeof location !== 'undefined') {
      const params = new URLSearchParams(location.search || '');
      const source = String(params.get('source') || params.get('from') || '').trim().toLowerCase();
      if (['mis', 'assessment', 'compscigo'].includes(source)) return true;
    }
    if (typeof document !== 'undefined') {
      return /(^|\.)compscigo\.com$/i.test(new URL(document.referrer || '').hostname || '');
    }
  } catch (_) {}
  return false;
}

function clearTeacherHandoffToken() {
  try {
    if (typeof history === 'undefined' || typeof location === 'undefined') return;
    const url = new URL(location.href);
    url.searchParams.delete('auth_token');
    url.searchParams.delete('teacher_token');
    url.searchParams.delete('token');
    url.searchParams.delete('source');
    url.searchParams.delete('from');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch (_) {}
}

function isTeacherAccount(account) {
  const role = String(account && (account.role || account.accountType) || '').trim().toLowerCase();
  const id = String(account && account.id || '').trim().toLowerCase();
  return role === 'teacher' || role === 'admin' || id.startsWith('teacher_');
}

const questionBankModes = {
  'recall-bank': {
    mode: 'recall',
    title: 'P Recall Questions',
    nav: 'P Recall',
    icon: 'P',
    subtitle: 'Multiple-choice questions used by pressing P / Question Hall.',
    formTitle: 'P Recall multiple-choice question',
    listEmpty: 'No P Recall questions in this subject bank yet.',
  },
  'meditation-bank': {
    mode: 'meditation',
    title: 'Meditation Fill Gaps',
    nav: 'Meditation',
    icon: 'M',
    subtitle: 'Fill-in-the-gap prompts used by meditation and focus rooms.',
    formTitle: 'Meditation fill-the-gap prompt',
    listEmpty: 'No Meditation fill-gap prompts in this subject bank yet.',
  },
  'scholar-bank': {
    mode: 'scholar',
    title: 'Knowledge Challenge',
    nav: 'Knowledge',
    icon: 'K',
    subtitle: 'Scholar Table content built from concepts, relationships, misconceptions, and adaptive challenge cases.',
    formTitle: 'Knowledge Challenge case',
    listEmpty: 'No Scholar Table / Knowledge Challenge cases in this subject bank yet.',
  },
};
const questionBankViews = Object.keys(questionBankModes);

function modesForBank(mode = 'recall') {
  return {
    recall: mode === 'recall',
    scholar: mode === 'scholar',
    meditation: mode === 'meditation',
  };
}

function primaryQuestionBankMode(question) {
  const modes = question && question.modes || {};
  if (modes.meditation) return 'meditation';
  if (modes.scholar && !modes.recall) return 'scholar';
  return 'recall';
}

const emptyForm = (mode = 'recall') => ({
  id: 0,
  topic: '',
  stage: '',
  difficulty: 1,
  spec: '',
  prompt: '',
  answers: ['', '', '', ''],
  correct: 0,
  explanation: '',
  reviewStatus: 'draft',
  active: true,
  modes: modesForBank(mode),
  knowledge: {
    entityId: '',
    entityName: '',
    entitySummary: '',
    atomId: '',
    atomType: 'purpose',
    atomStatement: '',
    confusionAtomId: '',
    misconceptionName: '',
    misconceptionStatement: '',
    misconceptionNote: '',
  },
});

const emptyCurriculum = () => ({
  title: '',
  topics: '',
  syllabus: '',
  notes: '',
  files: [],
});

const emptyHomework = () => ({
  title: '',
  classId: '',
  cadence: 'once',
  dueDate: '',
  weeklyDay: 1,
  questionCount: 10,
  status: 'scheduled',
  notes: '',
});

const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function cleanQuestion(question) {
  return {
    ...question,
    answers: Array.isArray(question.answers) ? question.answers.slice(0, 4).concat(['', '', '', '']).slice(0, 4) : ['', '', '', ''],
    difficulty: Number(question.difficulty) || 1,
    correct: Math.max(0, Math.min(3, Number(question.correct) || 0)),
    active: question.active !== false,
    modes: {
      recall: !question.modes || question.modes.recall !== false,
      scholar: !question.modes || question.modes.scholar !== false,
      meditation: !!(question.modes && question.modes.meditation),
    },
    creatorName: String(question.creatorName || question.creatorEmail || '').trim(),
    knowledge: question.knowledge && typeof question.knowledge === 'object' ? question.knowledge : {},
  };
}

createApp({
  setup() {
    const state = reactive({
      account: null,
      subjects: [],
      classes: [],
      questions: [],
      homeworks: [],
      analytics: { totals: { attempts: 0, correct: 0, accuracy: 0 }, students: [], questions: [], windowDays: 30 },
      curriculumRequests: [],
      curriculumAdmin: false,
      knowledgePlan: { entities: [], atoms: [], confusionPairs: [], counts: { entities: 0, atoms: 0, confusionPairs: 0, playableCases: 0 } },
      selectedId: 0,
      subjectId: '',
      classId: '',
      status: '',
      topicFilter: '',
      stageFilter: '',
      difficultyFilter: '',
      selectedStudentKey: '',
      questionTopicFilter: '',
      questionOutcomeFilter: '',
      questionSort: 'accuracyAsc',
      analyticsScope: 'school',
      analysisView: 'students',
      yearGroup: '',
      analyticsDays: 30,
      curriculum: emptyCurriculum(),
      homework: emptyHomework(),
      search: '',
      view: 'overview',
      loading: true,
      saving: false,
      error: '',
      notice: '',
      login: { username: '', password: '' },
      form: emptyForm(),
    });

    const activeQuestionBank = computed(() => questionBankModes[state.view] || questionBankModes['recall-bank']);
    const activeQuestionMode = computed(() => activeQuestionBank.value.mode);
    const selectedSubject = computed(() => state.subjects.find(s => String(s.id) === String(state.subjectId)) || null);
    const isAsherAdmin = computed(() => {
      const username = String(state.account && (state.account.username || state.account.email) || '').trim().toLowerCase();
      const displayName = String(state.account && state.account.displayName || '').trim().toLowerCase();
      const role = String(state.account && (state.account.role || state.account.accountType) || '').trim().toLowerCase();
      return state.curriculumAdmin || role === 'admin' || ['asherlevin85@gmail.com', 'asherlevin85', 'asherlevin'].includes(username) || ['asherlevin', 'asher levin'].includes(displayName);
    });
    const selectedQuestion = computed(() => state.questions.find(q => q.id === state.selectedId) || null);
    const bankQuestions = computed(() => state.questions.filter(q => primaryQuestionBankMode(q) === activeQuestionMode.value));
    const topicOptions = computed(() => [...new Set(bankQuestions.value.map(q => String(q.topic || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)));
    const stageOptions = computed(() => [...new Set(bankQuestions.value.map(q => String(q.stage || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)));
    const difficultyOptions = computed(() => [...new Set(bankQuestions.value.map(q => Number(q.difficulty) || 1).filter(Boolean))].sort((a, b) => a - b));
    const filteredQuestions = computed(() => {
      const needle = state.search.trim().toLowerCase();
      const topic = String(state.topicFilter || '').trim().toLowerCase();
      const stage = String(state.stageFilter || '').trim().toLowerCase();
      const difficulty = Number(state.difficultyFilter || 0) || 0;
      return bankQuestions.value.filter(q => {
        if (topic && String(q.topic || '').trim().toLowerCase() !== topic) return false;
        if (stage && String(q.stage || '').trim().toLowerCase() !== stage) return false;
        if (difficulty && Number(q.difficulty || 0) !== difficulty) return false;
        if (!needle) return true;
        return [q.topic, q.stage, q.spec, q.prompt].some(value => String(value || '').toLowerCase().includes(needle));
      });
    });
    const bankCounts = computed(() => ({
      recall: state.questions.filter(q => primaryQuestionBankMode(q) === 'recall').length,
      meditation: state.questions.filter(q => primaryQuestionBankMode(q) === 'meditation').length,
      scholar: state.questions.filter(q => primaryQuestionBankMode(q) === 'scholar').length,
    }));
    const knowledgeEntityOptions = computed(() => Array.isArray(state.knowledgePlan.entities) ? state.knowledgePlan.entities : []);
    const knowledgeAtomOptions = computed(() => Array.isArray(state.knowledgePlan.atoms) ? state.knowledgePlan.atoms : []);
    const stats = computed(() => ({
      total: state.questions.length,
      draft: state.questions.filter(q => q.reviewStatus === 'draft').length,
      reviewed: state.questions.filter(q => q.reviewStatus === 'teacher-reviewed').length,
      approved: state.questions.filter(q => q.reviewStatus === 'approved').length,
      active: state.questions.filter(q => q.active).length,
    }));
    const studentRows = computed(() => (state.analytics.students || []).slice().sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts));
    const questionRows = computed(() => (state.analytics.questions || []).slice().sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts));
    const analyticsTopicOptions = computed(() => [...new Set([...(state.analytics.topicSummaries || []).map(row => row.name || row.topic), ...questionRows.value.map(row => row.topic)].map(value => String(value || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)));
    const selectedStudent = computed(() => {
      const rows = studentRows.value;
      if (!rows.length) return null;
      return rows.find(row => studentKey(row) === state.selectedStudentKey) || rows[0];
    });
    const selectedStudentTopics = computed(() => {
      const student = selectedStudent.value;
      if (!student) return [];
      return (state.analytics.studentTopicSummaries || []).filter(row => matchesStudent(row, student)).sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts || String(a.topic || a.name || '').localeCompare(String(b.topic || b.name || '')));
    });
    const selectedStudentAttempts = computed(() => {
      const student = selectedStudent.value;
      if (!student) return [];
      return (state.analytics.attempts || []).filter(row => matchesStudent(row, student)).slice(0, 80);
    });
    const classTopicRows = computed(() => (state.analytics.topicSummaries || []).slice().sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts || String(a.name || '').localeCompare(String(b.name || ''))));
    const yearGroupOptions = computed(() => [...new Set([...(state.analytics.yearGroups || []), ...(state.classes || []).map(row => row.yearGroup || row.year_group)].map(value => String(value || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)));
    const schoolComparisonRows = computed(() => (state.analytics.schoolComparisons || []).slice().sort((a, b) => Number(b.ownSchool) - Number(a.ownSchool) || b.accuracy - a.accuracy || b.attempts - a.attempts || a.name.localeCompare(b.name)));
    const classComparisonRows = computed(() => (state.analytics.classComparisons || []).slice().sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts || String(a.name || '').localeCompare(String(b.name || ''))));
    const yearGroupComparisonRows = computed(() => (state.analytics.yearGroupComparisons || []).slice().sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts || String(a.name || '').localeCompare(String(b.name || ''))));
    const missingHomeworkRows = computed(() => (state.analytics.missingHomework || []).slice().sort((a, b) => a.completion - b.completion || a.attempts - b.attempts || String(a.name || '').localeCompare(String(b.name || ''))));
    const topicComparisonRows = computed(() => {
      const breakdowns = new Map((state.analytics.topicBreakdowns || []).map(row => [String(row.name || row.id || '').toLowerCase(), row]));
      return classTopicRows.value.map(row => {
        const key = String(row.name || row.topic || '').toLowerCase();
        const breakdown = breakdowns.get(key) || {};
        return {
          ...row,
          classRows: Array.isArray(breakdown.class) ? breakdown.class : [],
          yearRows: Array.isArray(breakdown.year) ? breakdown.year : [],
          schoolRows: Array.isArray(breakdown.school) ? breakdown.school : [],
          questionRows: questionRows.value.filter(question => String(question.topic || 'Uncategorised').trim().toLowerCase() === key).slice(0, 12),
        };
      });
    });
    const scopeLabel = computed(() => {
      if (state.analyticsScope === 'class') return state.classId ? 'Selected class' : 'Choose a class';
      if (state.analyticsScope === 'year') return state.yearGroup || 'Year group';
      if (state.analyticsScope === 'network') return 'All schools';
      return 'Whole school';
    });
    const classQuestionRows = computed(() => {
      const topic = String(state.questionTopicFilter || '').trim().toLowerCase();
      const outcome = String(state.questionOutcomeFilter || '');
      const rows = questionRows.value.filter(row => {
        if (topic && String(row.topic || '').trim().toLowerCase() !== topic) return false;
        if (outcome === 'wrong' && !(Number(row.wrong || 0) > 0)) return false;
        if (outcome === 'correct' && !(Number(row.correct || 0) > 0)) return false;
        if (outcome === 'unanswered' && Number(row.attempts || 0) > 0) return false;
        return true;
      });
      const sort = String(state.questionSort || 'accuracyAsc');
      return rows.sort((a, b) => {
        if (sort === 'wrongDesc') return Number(b.wrong || 0) - Number(a.wrong || 0) || Number(b.attempts || 0) - Number(a.attempts || 0);
        if (sort === 'attemptsDesc') return Number(b.attempts || 0) - Number(a.attempts || 0) || Number(a.accuracy || 0) - Number(b.accuracy || 0);
        if (sort === 'topicAsc') return String(a.topic || '').localeCompare(String(b.topic || '')) || Number(a.accuracy || 0) - Number(b.accuracy || 0);
        return Number(a.accuracy || 0) - Number(b.accuracy || 0) || Number(b.attempts || 0) - Number(a.attempts || 0);
      });
    });
    const classAttemptRows = computed(() => {
      const topic = String(state.questionTopicFilter || '').trim().toLowerCase();
      const outcome = String(state.questionOutcomeFilter || '');
      return (state.analytics.attempts || []).filter(row => {
        if (topic && String(row.topic || '').trim().toLowerCase() !== topic) return false;
        if (outcome === 'wrong' && row.correct) return false;
        if (outcome === 'correct' && !row.correct) return false;
        if (outcome === 'unanswered') return false;
        return true;
      }).slice(0, 120);
    });
    const needingSupport = computed(() => studentRows.value.filter(row => Number(row.accuracy || 0) < 60).length);
    const reviewCount = computed(() => questionRows.value.filter(row => Number(row.accuracy || 0) < 70 || Number(row.attempts || 0) >= 5).length);
    const dueSoonCount = computed(() => Math.max(0, state.homeworks.filter(homework => ['scheduled', 'live'].includes(String(homework.status || ''))).length));
    const currentAssignments = computed(() => state.homeworks.slice(0, 5).map((homework, index) => {
      return {
        id: homework.id || index,
        title: homework.title || 'Untitled homework',
        className: homework.className || 'All classes',
        due: homework.cadence === 'daily' ? 'Daily until cancelled' : homework.cadence === 'weekly' ? 'Every ' + weekdayName(homework.weeklyDay) : homework.dueDate || 'No due date',
        completion: '0/' + (Number(homework.questionCount) || 10),
        accuracy: Number(state.analytics.totals.accuracy || 0),
        status: homework.cadence === 'daily' ? 'Daily' : homework.cadence === 'weekly' ? 'Weekly' : homework.status || 'Scheduled',
      };
    }));
    const classRows = computed(() => {
      const classes = state.classes.length ? state.classes : [{ id: 'all', name: 'All classes' }];
      return classes.slice(0, 5).map((row, index) => ({
        id: row.id || index,
        name: row.name || 'Class',
        completion: Math.max(25, Math.min(96, 82 - index * 7 + stats.value.active)),
        accuracy: Math.max(35, Math.min(96, Number(state.analytics.totals.accuracy || 68) - index * 4 + (index % 2 ? 3 : 0))),
        support: index < needingSupport.value ? Math.max(1, needingSupport.value - index) : index % 3,
      }));
    });
    const attentionItems = computed(() => [
      { tone: 'red', icon: '!', title: needingSupport.value + ' students need support', detail: 'Accuracy below 60% in the selected window', action: 'View students', view: 'students' },
      { tone: 'purple', icon: '?', title: reviewCount.value + ' written answers need review', detail: 'Prioritise low-accuracy or high-attempt questions', action: 'Review now', view: 'question-analysis' },
      { tone: 'orange', icon: '+', title: dueSoonCount.value + ' homework sets scheduled', detail: 'Daily, weekly, and due-date practice', action: 'Set homework', view: 'homework' },
      { tone: 'green', icon: '✓', title: 'Curriculum request channel ready', detail: 'Upload topics, syllabus, and organisers', action: 'New request', view: 'curriculum' },
    ]);
    const recentActivity = computed(() => [
      (selectedSubject.value ? selectedSubject.value.name : 'Subject') + ' dashboard refreshed',
      bankCounts.value.recall + ' P Recall, ' + bankCounts.value.meditation + ' Meditation, and ' + bankCounts.value.scholar + ' Knowledge Challenge items ready',
      state.homeworks.length + ' homework schedules ready',
      state.analytics.totals.attempts + ' student attempts in the current window',
      'Curriculum requests email through the SiteGround bridge',
    ]);
    const dashboardLinks = computed(() => [
      { id: 'recall-bank', title: 'P Recall Bank', value: bankCounts.value.recall, detail: 'Multiple choice', tone: 'blue' },
      { id: 'meditation-bank', title: 'Meditation Bank', value: bankCounts.value.meditation, detail: 'Fill the gap', tone: 'purple' },
      { id: 'scholar-bank', title: 'Knowledge Bank', value: bankCounts.value.scholar, detail: 'Relationships', tone: 'green' },
      { id: 'homework', title: 'Set Homework', value: state.homeworks.length, detail: 'Scheduled practice', tone: 'purple' },
      { id: 'students', title: 'Analysis', value: needingSupport.value, detail: 'Students, topics, classes, schools', tone: 'red' },
      { id: 'question-analysis', title: 'Question Analysis', value: state.analytics.totals.accuracy + '%', detail: 'Average accuracy', tone: 'green' },
      { id: 'curriculum', title: 'Curriculum Content', value: 'Upload', detail: 'Request new content', tone: 'orange' },
    ]);
    const analysisTabs = computed(() => [
      { id: 'students', title: 'Student Breakdown', value: studentRows.value.length },
      { id: 'topics', title: 'Topic Breakdown', value: topicComparisonRows.value.length },
      { id: 'classes', title: 'Class Breakdown', value: classComparisonRows.value.length },
      { id: 'schools', title: 'School Breakdown', value: schoolComparisonRows.value.length },
      { id: 'homework-gaps', title: 'Not Doing Homework', value: missingHomeworkRows.value.length },
    ]);
    const studentChart = ref(null);
    const questionChart = ref(null);
    const chartRefs = { students: null, questions: null };

    function setError(message) {
      state.error = message || '';
      if (message) state.notice = '';
    }

    function setNotice(message) {
      state.notice = message || '';
      if (message) state.error = '';
    }

    function weekdayName(value) {
      return weekdayNames[Math.max(0, Math.min(6, Number(value) || 0))] || 'Monday';
    }

    function studentKey(row) {
      return String(row && (row.id || row.email || row.name) || '');
    }

    function matchesStudent(row, student) {
      if (!row || !student) return false;
      const studentId = Number(student.id) || 0;
      if (studentId && Number(row.studentId) === studentId) return true;
      const email = String(student.email || '').trim().toLowerCase();
      if (email && String(row.studentEmail || '').trim().toLowerCase() === email) return true;
      return String(row.studentName || '').trim().toLowerCase() === String(student.name || '').trim().toLowerCase();
    }

    function selectStudent(row) {
      state.selectedStudentKey = studentKey(row);
    }

    function outcomeLabel(correct) {
      return correct ? 'Correct' : 'Wrong';
    }

    function questionBreakdownRows(row, key) {
      const list = row && row.breakdowns && Array.isArray(row.breakdowns[key]) ? row.breakdowns[key] : [];
      return list.filter(item => Number(item.attempts || 0) > 0).slice(0, key === 'school' ? 8 : 6);
    }

    function syncClassSelectionWithSubject() {
      const validClassIds = new Set((state.classes || []).map(row => String(row.id)));
      if (state.classId && !validClassIds.has(String(state.classId))) state.classId = '';
      if (state.homework.classId && !validClassIds.has(String(state.homework.classId))) state.homework.classId = '';
    }

    function changeAnalyticsScope() {
      if (state.analyticsScope !== 'class') state.classId = '';
      if (state.analyticsScope !== 'year') state.yearGroup = '';
      changeStatus();
    }

    async function signOut() {
      try { await requestJson('/auth/logout', { method: 'POST', skipAuth: true }); } catch (_) {}
      storeSession('');
      state.account = null;
      state.subjects = [];
      state.classes = [];
      state.questions = [];
      state.homeworks = [];
      state.analytics = { totals: { attempts: 0, correct: 0, accuracy: 0 }, students: [], questions: [], windowDays: 30 };
      state.curriculumRequests = [];
      state.curriculumAdmin = false;
      state.knowledgePlan = { entities: [], atoms: [], confusionPairs: [], counts: { entities: 0, atoms: 0, confusionPairs: 0, playableCases: 0 } };
      state.analyticsScope = 'school';
      state.analysisView = 'students';
      state.yearGroup = '';
      state.view = 'overview';
      state.loading = false;
      setNotice('');
      setError('');
    }

    function fillForm(question) {
      const q = cleanQuestion(question || {});
      const base = emptyForm(primaryQuestionBankMode(q));
      state.form = {
        id: q.id || 0,
        topic: q.topic || '',
        stage: q.stage || '',
        difficulty: q.difficulty,
        spec: q.spec || '',
        prompt: q.prompt || '',
        answers: q.answers,
        correct: q.correct,
        explanation: q.explanation || '',
        reviewStatus: q.reviewStatus || 'draft',
        active: q.active,
        modes: { ...q.modes },
        knowledge: {
          ...base.knowledge,
          entityId: q.knowledge && q.knowledge.entityId ? String(q.knowledge.entityId) : '',
          atomId: q.knowledge && q.knowledge.primaryAtomId ? String(q.knowledge.primaryAtomId) : '',
        },
      };
      state.selectedId = q.id || 0;
    }

    function newQuestion(mode = '') {
      const cleanMode = String(mode || activeQuestionMode.value || 'recall');
      const view = questionBankViews.find(id => questionBankModes[id].mode === cleanMode) || 'recall-bank';
      state.view = view;
      state.selectedId = 0;
      state.form = emptyForm(questionBankModes[view].mode);
      setNotice('');
    }

    function clearQuestionFilters() {
      state.search = '';
      state.topicFilter = '';
      state.stageFilter = '';
      state.difficultyFilter = '';
      state.selectedId = 0;
      setNotice('');
    }

    function openView(view) {
      state.view = [...questionBankViews, 'homework', 'students', 'question-analysis', 'curriculum'].includes(view) ? view : 'overview';
      if (questionBankViews.includes(state.view) && state.form && !state.form.id) state.form.modes = modesForBank(activeQuestionMode.value);
      setNotice('');
    }

    function selectAnalysisView(view) {
      state.analysisView = ['students', 'topics', 'classes', 'schools', 'homework-gaps'].includes(view) ? view : 'students';
      state.view = 'students';
      setNotice('');
    }

    function editQuestionFromAnalysis(row) {
      const full = state.questions.find(question => Number(question.id) === Number(row && row.id));
      const modes = full && full.modes || {};
      openView(modes.scholar ? 'scholar-bank' : modes.meditation ? 'meditation-bank' : 'recall-bank');
      if (full) fillForm(full);
    }

    async function loadAccount() {
      const token = storedSession();
      let cookieData = null;
      try { cookieData = await requestJson('/auth/me', { skipAuth: true }); } catch (_) {}
      if (cookieData && cookieData.account) {
        if (token) {
          try {
            const bearerData = await requestJson('/auth/me');
            if (bearerData && bearerData.account && !sameAccount(cookieData.account, bearerData.account)) storeSession('');
          } catch (_) {
            storeSession('');
          }
        }
        state.account = cookieData.account || null;
        if (!isTeacherAccount(state.account)) {
          storeSession('');
          state.account = null;
          setError('Sign in with a teacher account to open the dashboard.');
          return false;
        }
        return true;
      }
      if (!token) {
        state.account = null;
        return false;
      }
      const data = await requestJson('/auth/me');
      state.account = data.account || null;
      if (!isTeacherAccount(state.account)) {
        storeSession('');
        state.account = null;
        setError('Sign in with a teacher account to open the dashboard.');
        return false;
      }
      return true;
    }

    async function consumeTeacherHandoff() {
      const token = teacherHandoffToken();
      if (!token) {
        if (isMisLaunch()) {
          storeSession('');
          state.account = null;
          clearTeacherHandoffToken();
          setError('MIS did not provide a teacher handoff token. Please reopen Homework Game from the MIS menu.');
        }
        return false;
      }
      storeSession('');
      const data = await requestJson('/auth/teacher/token-login', {
        method: 'POST',
        skipAuth: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!isTeacherAccount(data.account)) throw new Error('This MIS login is not linked to a teacher account.');
      if (data.sessionToken) storeSession(data.sessionToken);
      state.account = data.account || null;
      clearTeacherHandoffToken();
      setNotice('Signed in from MIS as ' + String(state.account && (state.account.displayName || state.account.username) || 'teacher') + '.');
      return true;
    }

    async function loadSubjects() {
      const data = await requestJson('/auth/teacher/subjects');
      state.subjects = data.subjects || [];
      if (!state.subjects.length) {
        state.subjectId = '';
        state.classes = [];
        state.questions = [];
        throw new Error('No subjects are assigned to this teacher account.');
      }
      if (!state.subjectId || !state.subjects.some(s => String(s.id) === String(state.subjectId))) {
        state.subjectId = String(state.subjects[0].id);
      }
    }

    async function loadSubjectData() {
      if (!state.subjectId) return;
      const classesData = await requestJson('/auth/teacher/classes?subjectId=' + encodeURIComponent(state.subjectId));
      state.classes = classesData.classes || [];
      syncClassSelectionWithSubject();
      const query = '?subjectId=' + encodeURIComponent(state.subjectId) + (state.status ? '&reviewStatus=' + encodeURIComponent(state.status) : '');
      const analyticsQuery = '?subjectId=' + encodeURIComponent(state.subjectId)
        + '&scope=' + encodeURIComponent(state.analyticsScope)
        + (state.analyticsScope === 'class' && state.classId ? '&classId=' + encodeURIComponent(state.classId) : '')
        + (state.analyticsScope === 'year' && state.yearGroup ? '&yearGroup=' + encodeURIComponent(state.yearGroup) : '')
        + '&days=' + encodeURIComponent(state.analyticsDays);
      const [questionsData, analyticsData, homeworkData] = await Promise.all([
        requestJson('/auth/teacher/game-questions' + query),
        requestJson('/auth/teacher/analytics' + analyticsQuery),
        requestJson('/auth/teacher/homework' + analyticsQuery),
      ]);
      state.questions = (questionsData.questions || []).map(cleanQuestion);
      state.analytics = analyticsData.analytics || state.analytics;
      state.homeworks = homeworkData.homework || [];
      if (selectedSubject.value) {
        try {
          const planData = await requestJson('/auth/teacher/knowledge-plan?subjectId=' + encodeURIComponent(state.subjectId));
          state.knowledgePlan = planData.plan || { entities: [], atoms: [], confusionPairs: [], counts: { entities: 0, atoms: 0, confusionPairs: 0, playableCases: 0 } };
        } catch (_) {
          state.knowledgePlan = { entities: [], atoms: [], confusionPairs: [], counts: { entities: 0, atoms: 0, confusionPairs: 0, playableCases: 0 } };
        }
      }
      if (state.selectedStudentKey && !(state.analytics.students || []).some(row => studentKey(row) === state.selectedStudentKey)) state.selectedStudentKey = '';
      if (state.selectedId && !selectedQuestion.value) newQuestion();
    }

    async function loadCurriculumRequests() {
      const params = new URLSearchParams();
      if (state.subjectId) params.set('subjectId', state.subjectId);
      if (state.classId) params.set('classId', state.classId);
      const data = await requestJson('/auth/teacher/curriculum-requests' + (params.toString() ? '?' + params.toString() : ''));
      state.curriculumRequests = data.requests || [];
      state.curriculumAdmin = data.admin === true;
    }

    async function refreshAll() {
      state.loading = true;
      try {
        const usedHandoff = await consumeTeacherHandoff();
        const signedIn = usedHandoff || (!isMisLaunch() && await loadAccount());
        if (!signedIn) {
          setNotice('');
          return;
        }
        await loadSubjects();
        await loadSubjectData();
        await loadCurriculumRequests();
        setNotice('Separate game-mode banks loaded.');
      } catch (e) {
        setError(e.message || 'Could not load teacher dashboard.');
      } finally {
        state.loading = false;
      }
    }

    async function teacherLogin() {
      state.saving = true;
      try {
        const username = String(state.login.username || '').trim();
        const password = String(state.login.password || '');
        if (!username || !password) throw new Error('Enter your teacher email and password.');
        const data = await requestJson('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        if (!isTeacherAccount(data.account)) {
          storeSession('');
          throw new Error('This login is not linked to a teacher account.');
        }
        storeSession(data.sessionToken);
        state.account = data.account || null;
        state.login.password = '';
        await loadSubjects();
        await loadSubjectData();
        await loadCurriculumRequests();
        setNotice('Signed in as ' + String(state.account && state.account.username || username) + '.');
      } catch (e) {
        setError(e.message || 'Could not sign in.');
      } finally {
        state.loading = false;
        state.saving = false;
      }
    }

    async function changeSubject() {
      newQuestion();
      clearQuestionFilters();
      state.classId = '';
      state.homework.classId = '';
      state.loading = true;
      try {
        await loadSubjectData();
        await loadCurriculumRequests();
        setNotice('Subject loaded.');
      } catch (e) {
        setError(e.message || 'Could not load subject.');
      } finally {
        state.loading = false;
      }
    }

    async function changeStatus() {
      state.loading = true;
      try {
        await loadSubjectData();
        await loadCurriculumRequests();
        setNotice('View refreshed.');
      } catch (e) {
        setError(e.message || 'Could not refresh teacher dashboard.');
      } finally {
        state.loading = false;
      }
    }

    function changeQuestionFilters() {
      if (state.selectedId && !filteredQuestions.value.some(q => q.id === state.selectedId)) state.selectedId = 0;
      setNotice('');
    }

    function validateForm() {
      const modes = modesForBank(activeQuestionMode.value);
      const meditationOnly = modes.meditation && !modes.recall && !modes.scholar;
      const scholarOnly = modes.scholar && !modes.recall && !modes.meditation;
      const answers = state.form.answers.map(value => String(value || '').trim());
      const filledAnswers = answers.filter(Boolean);
      const unique = new Set(filledAnswers.map(value => value.toLowerCase()));
      if (!state.subjectId) throw new Error('Choose a subject first.');
      if (String(state.form.prompt || '').trim().length < 10) throw new Error('Question prompt needs at least 10 characters.');
      if (meditationOnly) {
        if (!filledAnswers.length || unique.size !== filledAnswers.length) throw new Error('Meditation fill-gap needs at least one accepted answer.');
      } else if (answers.some(value => !value) || unique.size !== 4) throw new Error(activeQuestionBank.value.title + ' needs four unique answer choices.');
      const knowledge = state.form.knowledge || {};
      if (scholarOnly) {
        if (!String(knowledge.atomId || '').trim() && !String(knowledge.entityId || '').trim() && String(knowledge.entityName || '').trim().length < 2) throw new Error('Add or select the concept this Knowledge Challenge case belongs to.');
        if (!String(knowledge.atomId || '').trim() && String(knowledge.atomStatement || '').trim().length < 10) throw new Error('Add or select the atom: the exact knowledge claim being tested.');
      }
      if (String(state.form.explanation || '').trim().length < 10) throw new Error('Add a short teaching explanation.');
      return {
        subjectId: Number(state.subjectId),
        topic: state.form.topic,
        stage: state.form.stage,
        difficulty: Number(state.form.difficulty) || 1,
        spec: state.form.spec,
        prompt: state.form.prompt,
        answers: meditationOnly ? filledAnswers : answers,
        correct: meditationOnly ? 0 : Number(state.form.correct) || 0,
        explanation: state.form.explanation,
        reviewStatus: state.form.reviewStatus,
        active: !!state.form.active,
        modes,
        knowledge: scholarOnly ? {
          entityId: knowledge.entityId || '',
          entityName: knowledge.entityName || '',
          entitySummary: knowledge.entitySummary || '',
          atomId: knowledge.atomId || '',
          atomType: knowledge.atomType || 'purpose',
          atomStatement: knowledge.atomStatement || '',
          confusionAtomId: knowledge.confusionAtomId || '',
          misconceptionName: knowledge.misconceptionName || '',
          misconceptionStatement: knowledge.misconceptionStatement || '',
          misconceptionNote: knowledge.misconceptionNote || '',
        } : undefined,
      };
    }

    function validateHomework() {
      if (!state.subjectId) throw new Error('Choose a subject first.');
      const title = String(state.homework.title || '').trim();
      const cadence = state.homework.cadence || 'once';
      if (title.length < 3) throw new Error('Add a short homework title.');
      if (cadence === 'once' && !state.homework.dueDate) throw new Error('Choose a homework due date.');
      return {
        subjectId: Number(state.subjectId),
        classId: state.homework.classId || state.classId || '',
        title,
        cadence,
        dueDate: cadence === 'once' ? state.homework.dueDate : '',
        weeklyDay: cadence === 'weekly' ? Number(state.homework.weeklyDay) || 0 : null,
        questionCount: Number(state.homework.questionCount) || 10,
        status: state.homework.status || 'scheduled',
        notes: state.homework.notes || '',
      };
    }

    async function saveQuestion(copy = false) {
      state.saving = true;
      try {
        const body = validateForm();
        const existingId = Number(state.form.id || 0) || 0;
        const path = existingId && !copy ? '/auth/teacher/game-questions/' + encodeURIComponent(existingId) : '/auth/teacher/game-questions';
        const data = await requestJson(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        await loadSubjectData();
        if (data.question && data.question.id) fillForm(data.question);
        setNotice(copy ? 'Saved as a new ' + activeQuestionBank.value.title + ' item.' : activeQuestionBank.value.title + ' item saved.');
      } catch (e) {
        setError(e.message || 'Could not save question.');
      } finally {
        state.saving = false;
      }
    }

    function clearHomework() {
      state.homework = emptyHomework();
      state.homework.classId = state.classId || '';
    }

    async function saveHomework() {
      state.saving = true;
      try {
        const body = validateHomework();
        const data = await requestJson('/auth/teacher/homework', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        clearHomework();
        await loadSubjectData();
        setNotice('Homework scheduled: ' + String(data.homework && data.homework.title || body.title) + '.');
      } catch (e) {
        setError(e.message || 'Could not set homework.');
      } finally {
        state.saving = false;
      }
    }

    function handleCurriculumFiles(event) {
      state.curriculum.files = Array.from(event && event.target && event.target.files || []).slice(0, 5);
    }

    function clearCurriculumRequest() {
      state.curriculum = emptyCurriculum();
      const fileInput = document.getElementById('teacherCurriculumFiles');
      if (fileInput) fileInput.value = '';
    }

    async function submitCurriculumRequest() {
      state.saving = true;
      try {
        if (!state.subjectId) throw new Error('Choose a subject first.');
        const form = new FormData();
        form.set('subjectId', state.subjectId);
        form.set('classId', state.classId || '');
        form.set('title', state.curriculum.title);
        form.set('topics', state.curriculum.topics);
        form.set('syllabus', state.curriculum.syllabus);
        form.set('notes', state.curriculum.notes);
        for (const file of state.curriculum.files) form.append('files', file);
        const data = await requestJson('/auth/teacher/curriculum-requests', { method: 'POST', body: form });
        clearCurriculumRequest();
        await loadCurriculumRequests();
        if (data.notification && data.notification.sent) {
          setNotice('Curriculum request submitted and email notification sent.');
        } else {
          const reason = String(data.notification && data.notification.reason || '').replace(/^Error:\s*/i, '');
          const detail = reason === 'mail_bridge_secret_not_configured'
            ? 'Mail bridge secret is missing on the live server.'
            : reason === 'mail_recipient_not_configured'
              ? 'Notification recipient is missing on the live server.'
              : reason === 'fetch_not_available'
                ? 'The live server cannot make outbound mail bridge requests.'
                : reason.startsWith('mail_bridge_failed')
                  ? reason.includes('Invalid mail bridge secret')
                    ? 'Mail bridge secret does not match the SiteGround config.'
                    : 'The SiteGround mail bridge rejected the notification.'
                  : 'Email notification was not sent.';
          setNotice('Curriculum request submitted. ' + detail);
        }
      } catch (e) {
        setError(e.message || 'Could not submit curriculum request.');
      } finally {
        state.saving = false;
      }
    }

    async function downloadCurriculumFile(request, file) {
      try {
        const requestId = encodeURIComponent(String(request && request.id || ''));
        const storedName = encodeURIComponent(String(file && file.storedName || ''));
        if (!requestId || !storedName) throw new Error('Attachment is missing its file reference.');
        const res = await fetch(apiUrl('/auth/teacher/curriculum-requests/' + requestId + '/files/' + storedName), {
          credentials: 'include',
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error('Could not download attachment.');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = String(file.originalName || file.storedName || 'curriculum-file');
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        setError(e.message || 'Could not download attachment.');
      }
    }

    async function completeCurriculumRequest(request) {
      state.saving = true;
      try {
        const data = await requestJson('/auth/teacher/curriculum-requests/' + encodeURIComponent(String(request && request.id || '')) + '/complete', { method: 'POST' });
        await loadCurriculumRequests();
        if (data.notification && data.notification.sent) {
          setNotice('Request marked done and teacher emailed.');
        } else {
          setNotice('Request marked done. Completion email was not sent.');
        }
      } catch (e) {
        setError(e.message || 'Could not mark request done.');
      } finally {
        state.saving = false;
      }
    }

    async function deleteCurriculumRequest(request) {
      const title = String(request && request.title || 'this request');
      if (typeof window !== 'undefined' && !window.confirm('Delete "' + title + '" and its uploaded files?')) return;
      state.saving = true;
      try {
        await requestJson('/auth/teacher/curriculum-requests/' + encodeURIComponent(String(request && request.id || '')), { method: 'DELETE' });
        await loadCurriculumRequests();
        setNotice('Curriculum request deleted.');
      } catch (e) {
        setError(e.message || 'Could not delete request.');
      } finally {
        state.saving = false;
      }
    }

    function destroyChart(key) {
      if (chartRefs[key]) {
        chartRefs[key].destroy();
        chartRefs[key] = null;
      }
    }

    function renderCharts() {
      nextTick(() => {
        if (!studentChart.value) destroyChart('students');
        if (!questionChart.value) destroyChart('questions');
        if (studentChart.value) {
          destroyChart('students');
          const rows = studentRows.value.slice(0, 10).reverse();
          chartRefs.students = new Chart(studentChart.value, {
            type: 'bar',
            data: {
              labels: rows.map(row => row.name),
              datasets: [{ label: 'Accuracy %', data: rows.map(row => row.accuracy), backgroundColor: '#7dd3fc' }],
            },
            options: { indexAxis: 'y', responsive: true, scales: { x: { min: 0, max: 100 } }, plugins: { legend: { display: false } } },
          });
        }
        if (questionChart.value) {
          destroyChart('questions');
          const rows = questionRows.value.slice(0, 10).reverse();
          chartRefs.questions = new Chart(questionChart.value, {
            type: 'bar',
            data: {
              labels: rows.map(row => row.topic || ('#' + row.id)),
              datasets: [{ label: 'Accuracy %', data: rows.map(row => row.accuracy), backgroundColor: '#a3e635' }],
            },
            options: { indexAxis: 'y', responsive: true, scales: { x: { min: 0, max: 100 } }, plugins: { legend: { display: false } } },
          });
        }
      });
    }

    watch(() => [state.view, state.analytics], renderCharts, { deep: true });
    onUnmounted(() => {
      destroyChart('students');
      destroyChart('questions');
    });

    onMounted(refreshAll);

    return {
      state,
      isAsherAdmin,
      selectedSubject,
      filteredQuestions,
      topicOptions,
      stageOptions,
      difficultyOptions,
      studentRows,
      questionRows,
      analyticsTopicOptions,
      selectedStudent,
      selectedStudentTopics,
      selectedStudentAttempts,
      classTopicRows,
      yearGroupOptions,
      schoolComparisonRows,
      classComparisonRows,
      yearGroupComparisonRows,
      missingHomeworkRows,
      topicComparisonRows,
      scopeLabel,
      classQuestionRows,
      classAttemptRows,
      needingSupport,
      reviewCount,
      dueSoonCount,
      currentAssignments,
      classRows,
      attentionItems,
      recentActivity,
      stats,
      bankCounts,
      knowledgeEntityOptions,
      knowledgeAtomOptions,
      activeQuestionBank,
      activeQuestionMode,
      dashboardLinks,
      analysisTabs,
      studentChart,
      questionChart,
      refreshAll,
      teacherLogin,
      signOut,
      changeSubject,
      changeStatus,
      changeAnalyticsScope,
      loadCurriculumRequests,
      changeQuestionFilters,
      clearQuestionFilters,
      openView,
      selectAnalysisView,
      selectStudent,
      studentKey,
      outcomeLabel,
      questionBreakdownRows,
      editQuestionFromAnalysis,
      handleCurriculumFiles,
      clearCurriculumRequest,
      submitCurriculumRequest,
      downloadCurriculumFile,
      completeCurriculumRequest,
      deleteCurriculumRequest,
      fillForm,
      newQuestion,
      saveQuestion,
      clearHomework,
      saveHomework,
      weekdayName,
      weekdayNames,
    };
  },
  template: `
    <div class="teacher-login-shell" v-if="!state.account">
      <section class="teacher-login-card">
        <div class="teacher-vue-brand">
          <i>▣</i>
          <div>
            <strong>Homework</strong>
            <span>Teacher</span>
          </div>
        </div>
        <div class="teacher-login-copy">
          <h1>Teacher sign in</h1>
          <p>Use your school teacher account. This is checked against the existing MySQL teacher database.</p>
        </div>
        <form class="teacher-login-form" @submit.prevent="teacherLogin">
          <label>Email address<input v-model="state.login.username" type="email" autocomplete="username" placeholder="teacher@school.org"></label>
          <label>Password<input v-model="state.login.password" type="password" autocomplete="current-password" placeholder="Your password"></label>
          <div class="teacher-vue-status bad" v-if="state.error">{{ state.error }}</div>
          <button type="submit" class="teacher-vue-primary" :disabled="state.saving || state.loading">{{ state.saving ? 'Signing in...' : 'Sign in' }}</button>
        </form>
        <div class="teacher-login-links">
          <a href="./teacher-login.html">Standalone teacher login</a>
          <a href="./">Return to game</a>
          <a href="./register.html">Student registration</a>
        </div>
      </section>
    </div>

    <div class="teacher-vue-shell" v-else>
      <aside class="teacher-vue-sidebar">
        <div class="teacher-vue-brand">
          <i>▣</i>
          <div>
            <strong>Homework</strong>
            <span>Teacher</span>
          </div>
        </div>
        <nav class="teacher-vue-nav" aria-label="Teacher dashboard">
          <button type="button" :class="{ active: state.view === 'recall-bank' }" @click="openView('recall-bank')"><span>P</span>P Recall</button>
          <button type="button" :class="{ active: state.view === 'meditation-bank' }" @click="openView('meditation-bank')"><span>M</span>Meditation</button>
          <button type="button" :class="{ active: state.view === 'scholar-bank' }" @click="openView('scholar-bank')"><span>K</span>Knowledge</button>
          <button type="button" :class="{ active: state.view === 'overview' }" @click="openView('overview')"><span>⌂</span>Home</button>
          <button type="button" :class="{ active: state.view === 'homework' }" @click="openView('homework')"><span>◷</span>Set Homework</button>
          <button type="button" :class="{ active: state.view === 'students' }" @click="openView('students')"><span>◌</span>Classes</button>
          <button type="button" :class="{ active: state.view === 'question-analysis' }" @click="openView('question-analysis')"><span>□</span>Subject Bank</button>
          <button type="button" :class="{ active: state.view === 'curriculum' }" @click="openView('curriculum')"><span>⇧</span>Curriculum Content</button>
        </nav>
        <div class="teacher-vue-side-spacer"></div>
        <nav class="teacher-vue-nav teacher-vue-nav-secondary" aria-label="Teacher links">
          <button type="button"><span>⚙</span>Settings</button>
          <button type="button"><span>?</span>Help</button>
          <button type="button" @click="signOut"><span>⇥</span>Sign out</button>
          <a class="teacher-vue-back" href="./"><span>↩</span>Return to Game</a>
        </nav>
        <div class="teacher-vue-profile">
          <div>{{ (state.account && state.account.displayName || 'Mr Levin').slice(0,1) }}</div>
          <span><strong>{{ state.account && state.account.displayName || 'Mr Levin' }}</strong><small>{{ selectedSubject ? selectedSubject.name : 'Teacher' }}</small></span>
        </div>
      </aside>

      <main class="teacher-vue-main">
        <header class="teacher-vue-topbar">
          <div>
            <h1>{{ ['recall-bank','meditation-bank','scholar-bank'].includes(state.view) ? activeQuestionBank.title : state.view === 'homework' ? 'Set Homework' : state.view === 'students' ? 'Student insights' : state.view === 'question-analysis' ? 'Question analysis' : state.view === 'curriculum' ? 'Curriculum Requests' : 'Good morning, ' + (state.account && state.account.displayName || 'Mr Levin') }}</h1>
            <p>{{ selectedSubject ? (['recall-bank','meditation-bank','scholar-bank'].includes(state.view) ? activeQuestionBank.subtitle : state.view === 'question-analysis' ? selectedSubject.name + ' analysis across all game-mode banks.' : "Here's what's happening in " + selectedSubject.name + " today.") : "Here's what's happening with your homework today." }}</p>
          </div>
          <div class="teacher-vue-toolbar">
            <select v-model="state.subjectId" @change="changeSubject">
              <option v-for="subject in state.subjects" :key="subject.id" :value="String(subject.id)">
                {{ subject.code ? subject.name + ' (' + subject.code + ')' : subject.name }}
              </option>
            </select>
            <select v-model="state.analyticsScope" @change="changeAnalyticsScope">
              <option value="class">Whole class</option>
              <option value="year">Whole year group</option>
              <option value="school">Whole school</option>
              <option value="network">Compare schools</option>
            </select>
            <select v-if="state.analyticsScope === 'class'" v-model="state.classId" @change="changeStatus">
              <option value="">Choose class</option>
              <option v-for="row in state.classes" :key="row.id" :value="String(row.id)">
                {{ row.joinCode ? row.name + ' - ' + row.joinCode : row.name }}
              </option>
            </select>
            <select v-if="state.analyticsScope === 'year'" v-model="state.yearGroup" @change="changeStatus">
              <option value="">Choose year group</option>
              <option v-for="year in yearGroupOptions" :key="year" :value="year">{{ year }}</option>
            </select>
            <select v-model.number="state.analyticsDays" @change="changeStatus">
              <option :value="7">Last 7 days</option>
              <option :value="30">Last 30 days</option>
              <option :value="90">Last 90 days</option>
              <option :value="180">Last 180 days</option>
            </select>
            <button type="button" class="teacher-vue-primary" @click="state.view === 'homework' ? clearHomework() : newQuestion()">{{ state.view === 'homework' ? '+ New homework' : ['recall-bank','meditation-bank','scholar-bank'].includes(state.view) ? '+ New ' + activeQuestionBank.nav : '+ Add question' }}</button>
          </div>
        </header>

        <section class="teacher-vue-metrics" aria-label="Question metrics">
          <div class="tone-red"><i>♙</i><span>Students needing support</span><strong>{{ needingSupport }}</strong><small>Needs attention</small></div>
          <div class="tone-purple"><i>?</i><span>Written reviews</span><strong>{{ reviewCount }}</strong><small>Need review</small></div>
          <div class="tone-orange"><i>◷</i><span>Homework</span><strong>{{ dueSoonCount }}</strong><small>Scheduled</small></div>
          <div class="tone-green"><i>↗</i><span>Average accuracy</span><strong>{{ state.analytics.totals.accuracy }}%</strong><small>{{ scopeLabel }}</small></div>
        </section>

        <div class="teacher-vue-status bad" v-if="state.error">{{ state.error }}</div>
        <div class="teacher-vue-status ok" v-else-if="state.notice">{{ state.notice }}</div>

        <section class="teacher-vue-overview" v-if="state.view === 'overview'">
          <section class="teacher-vue-panel teacher-vue-attention">
            <header><h2>Attention required</h2></header>
            <button v-for="item in attentionItems" :key="item.title" type="button" class="teacher-vue-attention-row" :class="'tone-' + item.tone" @click="openView(item.view)">
              <i>{{ item.icon }}</i>
              <span><strong>{{ item.title }}</strong><small>{{ item.detail }}</small></span>
              <em>{{ item.action }}</em>
            </button>
          </section>
          <section class="teacher-vue-panel teacher-vue-current">
            <header><h2>Current homework</h2><button type="button" @click="openView('homework')">View all</button></header>
            <div class="teacher-vue-assignment-head"><span>Homework</span><span>Class</span><span>Due</span><span>Required</span><span>Accuracy</span><span>Schedule</span></div>
            <button class="teacher-vue-assignment-row" type="button" v-for="row in currentAssignments" :key="row.id" @click="openView('homework')">
              <span>{{ row.title }}</span><span>{{ row.className }}</span><span>{{ row.due }}</span><span>{{ row.completion }}</span>
              <span><b :style="{ width: row.accuracy + '%' }"></b>{{ row.accuracy }}%</span><em>{{ row.status }}</em>
            </button>
            <div class="teacher-vue-empty" v-if="!currentAssignments.length">Set the first homework schedule for this subject.</div>
          </section>
          <section class="teacher-vue-panel teacher-vue-class-card">
            <header><h2>Class snapshot</h2></header>
            <div class="teacher-vue-class-row" v-for="row in classRows" :key="row.id">
              <span>{{ row.name }}</span><span><b :style="{ width: row.completion + '%' }"></b>{{ row.completion }}%</span><span>{{ row.accuracy }}%</span><strong>{{ row.support }}</strong>
            </div>
          </section>
          <section class="teacher-vue-panel teacher-vue-activity">
            <header><h2>Recent activity</h2><button type="button" @click="refreshAll">Refresh</button></header>
            <div v-for="item in recentActivity" :key="item"><i>✓</i><span>{{ item }}</span><time>Today</time></div>
          </section>
        </section>

        <section class="teacher-vue-analysis teacher-vue-analysis-wide" v-else-if="state.view === 'students'">
          <div class="teacher-vue-analysis-tabs">
            <button type="button" v-for="tab in analysisTabs" :key="tab.id" :class="{ active: state.analysisView === tab.id }" @click="selectAnalysisView(tab.id)">
              <span>{{ tab.title }}</span><strong>{{ tab.value }}</strong>
            </button>
          </div>
          <div class="teacher-vue-analysis-stack" v-if="state.analysisView === 'students'">
            <div class="teacher-vue-chart">
              <div>
                <span>Student insights</span>
                <strong>{{ state.analytics.totals.accuracy }}%</strong>
                <i>{{ state.analytics.totals.correct }} correct, {{ state.analytics.totals.wrong || 0 }} wrong from {{ state.analytics.totals.attempts }} attempts</i>
              </div>
              <canvas ref="studentChart" aria-label="Student accuracy chart"></canvas>
            </div>
            <div class="teacher-vue-analysis-table">
              <div class="teacher-vue-analysis-row head">
                <span>Student</span>
                <span>Attempts</span>
                <span>Accuracy</span>
                <span>Last active</span>
              </div>
              <button class="teacher-vue-analysis-row action" :class="{ selected: selectedStudent && studentKey(selectedStudent) === studentKey(row) }" type="button" v-for="row in studentRows" :key="studentKey(row)" @click="selectStudent(row)">
                <span>{{ row.name }}<small>{{ row.email || 'Game account' }}</small></span>
                <strong>{{ row.attempts }}</strong>
                <strong>{{ row.accuracy }}%</strong>
                <i>{{ row.lastAttemptAt || 'No attempts' }}</i>
              </button>
              <div class="teacher-vue-empty" v-if="!studentRows.length">No students found for this class and subject yet.</div>
            </div>
          </div>
          <div class="teacher-vue-analysis-table teacher-vue-student-detail" v-if="state.analysisView === 'students'">
            <header>
              <div>
                <span>Selected student</span>
                <h2>{{ selectedStudent ? selectedStudent.name : 'Choose a student' }}</h2>
                <small v-if="selectedStudent">{{ selectedStudent.correct }} correct · {{ selectedStudent.wrong || 0 }} wrong · {{ selectedStudent.accuracy }}%</small>
              </div>
            </header>
            <h3>Topic summary</h3>
            <div class="teacher-vue-topic-row head"><span>Topic</span><span>Correct</span><span>Wrong</span><span>Accuracy</span></div>
            <div class="teacher-vue-topic-row" v-for="row in selectedStudentTopics" :key="row.id">
              <span>{{ row.topic || row.name || 'No topic' }}</span>
              <strong>{{ row.correct }}</strong>
              <strong>{{ row.wrong }}</strong>
              <i>{{ row.accuracy }}%</i>
            </div>
            <div class="teacher-vue-empty" v-if="selectedStudent && !selectedStudentTopics.length">No topic attempts for this student yet.</div>
            <h3>Question breakdown</h3>
            <div class="teacher-vue-answer-row head"><span>Question</span><span>Topic</span><span>Answer</span><span>Result</span></div>
            <div class="teacher-vue-answer-row" v-for="row in selectedStudentAttempts" :key="row.id">
              <span>{{ row.prompt }}<small>{{ row.createdAt || 'Recent attempt' }}</small></span>
              <span>{{ row.topic || 'No topic' }}</span>
              <span>{{ row.answerText || 'Answer ' + (row.answerIndex + 1) }}<small v-if="!row.correct">Correct: {{ row.correctAnswer }}</small></span>
              <strong :class="{ good: row.correct, bad: !row.correct }">{{ outcomeLabel(row.correct) }}</strong>
            </div>
            <div class="teacher-vue-empty" v-if="selectedStudent && !selectedStudentAttempts.length">No question attempts for this student yet.</div>
          </div>
          <div class="teacher-vue-analysis-table" v-if="state.analysisView === 'topics'">
            <header><h2>Topic breakdown</h2><button type="button" @click="refreshAll">Refresh</button></header>
            <article class="teacher-vue-question-breakdown-card" v-for="row in topicComparisonRows" :key="row.id || row.name">
              <div class="teacher-vue-topic-row">
                <span>{{ row.name || row.topic || 'No topic' }}</span>
                <strong>{{ row.correct }}</strong>
                <strong>{{ row.wrong }}</strong>
                <i>{{ row.accuracy }}%</i>
              </div>
              <div class="teacher-vue-question-breakdowns">
                <section>
                  <h4>By class</h4>
                  <div v-for="item in row.classRows.slice(0, 6)" :key="'topic-class-' + row.id + '-' + item.id"><span>{{ item.name }}</span><strong>{{ item.accuracy }}%</strong><small>{{ item.correct }}/{{ item.attempts }}</small></div>
                  <em v-if="!row.classRows.length">No class data</em>
                </section>
                <section>
                  <h4>By year group</h4>
                  <div v-for="item in row.yearRows.slice(0, 6)" :key="'topic-year-' + row.id + '-' + item.id"><span>{{ item.name }}</span><strong>{{ item.accuracy }}%</strong><small>{{ item.correct }}/{{ item.attempts }}</small></div>
                  <em v-if="!row.yearRows.length">No year data</em>
                </section>
                <section>
                  <h4>By school</h4>
                  <div v-for="item in row.schoolRows.slice(0, 8)" :key="'topic-school-' + row.id + '-' + item.id" :class="{ own: item.ownSchool }"><span>{{ item.name }}</span><strong>{{ item.accuracy }}%</strong><small>{{ item.correct }}/{{ item.attempts }}</small></div>
                  <em v-if="!row.schoolRows.length">No school data</em>
                </section>
              </div>
              <div class="teacher-vue-topic-question-list">
                <h4>Questions in this topic</h4>
                <article v-for="question in row.questionRows" :key="'topic-question-' + row.id + '-' + question.id">
                  <span>{{ question.prompt }}<small>{{ question.correct }} correct / {{ question.wrong || 0 }} wrong</small></span>
                  <strong>{{ question.accuracy }}%</strong>
                  <em>Class: {{ questionBreakdownRows(question, 'class').map(item => item.name + ' ' + item.accuracy + '%').join(', ') || 'no data' }}</em>
                  <em>School: {{ questionBreakdownRows(question, 'school').map(item => item.name + ' ' + item.accuracy + '%').join(', ') || 'no data' }}</em>
                </article>
                <small v-if="!row.questionRows.length">No question data for this topic yet.</small>
              </div>
            </article>
            <div class="teacher-vue-empty" v-if="!topicComparisonRows.length">No topic attempts yet.</div>
          </div>
          <div class="teacher-vue-analysis-table" v-if="state.analysisView === 'classes'">
            <header><h2>Class breakdown</h2></header>
            <div class="teacher-vue-analysis-row head"><span>Class</span><span>Answered</span><span>Accuracy</span><span>Active students</span></div>
            <button class="teacher-vue-analysis-row action" type="button" v-for="row in classComparisonRows" :key="row.id" @click="state.analyticsScope = 'class'; state.classId = String(row.id); changeStatus()">
              <span>{{ row.name }}<small>{{ row.yearGroup || 'No year group' }}</small></span>
              <strong>{{ row.attempts }}</strong>
              <strong>{{ row.accuracy }}%</strong>
              <i>{{ row.activeStudents || 0 }} active</i>
            </button>
            <h3>Question breakdown for selected class/scope</h3>
            <article class="teacher-vue-topic-question-list">
              <article v-for="question in classQuestionRows.slice(0, 12)" :key="'class-question-' + question.id">
                <span>{{ question.prompt }}<small>{{ question.topic || 'No topic' }}</small></span>
                <strong>{{ question.accuracy }}%</strong>
                <em>{{ question.correct }} correct / {{ question.wrong || 0 }} wrong</em>
                <em>{{ question.attempts }} answered</em>
              </article>
              <small v-if="!classQuestionRows.length">Choose a class or wait for question attempts.</small>
            </article>
            <div class="teacher-vue-empty" v-if="!classComparisonRows.length">No class comparison data yet.</div>
          </div>
          <div class="teacher-vue-analysis-table" v-if="state.analysisView === 'schools'">
            <header><h2>School breakdown</h2></header>
            <div class="teacher-vue-topic-row head"><span>School</span><span>Correct</span><span>Wrong</span><span>Accuracy</span></div>
            <div class="teacher-vue-topic-row" v-for="row in schoolComparisonRows" :key="row.id || row.name" :class="{ selected: row.ownSchool }">
              <span>{{ row.name }}<small v-if="row.ownSchool">Your school</small></span>
              <strong>{{ row.correct }}</strong>
              <strong>{{ row.wrong }}</strong>
              <i>{{ row.accuracy }}%</i>
            </div>
            <h3>Year groups in your school</h3>
            <div class="teacher-vue-topic-row" v-for="row in yearGroupComparisonRows" :key="row.id">
              <span>{{ row.name }}</span>
              <strong>{{ row.correct }}</strong>
              <strong>{{ row.wrong }}</strong>
              <i>{{ row.accuracy }}%</i>
            </div>
            <h3>Question breakdown by school</h3>
            <article class="teacher-vue-question-breakdown-card" v-for="question in classQuestionRows.slice(0, 12)" :key="'school-question-' + question.id">
              <div class="teacher-vue-topic-row">
                <span>{{ question.prompt }}<small>{{ question.topic || 'No topic' }}</small></span>
                <strong>{{ question.correct }}</strong>
                <strong>{{ question.wrong || 0 }}</strong>
                <i>{{ question.accuracy }}%</i>
              </div>
              <div class="teacher-vue-question-breakdowns compact">
                <section>
                  <h4>By school</h4>
                  <div v-for="item in questionBreakdownRows(question, 'school')" :key="'school-question-break-' + question.id + '-' + item.id" :class="{ own: item.ownSchool }">
                    <span>{{ item.name }}</span><strong>{{ item.accuracy }}%</strong><small>{{ item.correct }}/{{ item.attempts }}</small>
                  </div>
                  <em v-if="!questionBreakdownRows(question, 'school').length">No school data</em>
                </section>
              </div>
            </article>
            <div class="teacher-vue-empty" v-if="!schoolComparisonRows.length && !yearGroupComparisonRows.length">No school comparison data yet.</div>
          </div>
          <div class="teacher-vue-analysis-table" v-if="state.analysisView === 'homework-gaps'">
            <header><h2>Students not doing homework</h2></header>
            <div class="teacher-vue-analysis-row head"><span>Student</span><span>Progress</span><span>Accuracy</span><span>Last activity</span></div>
            <button class="teacher-vue-analysis-row action" type="button" v-for="row in missingHomeworkRows" :key="row.id || row.email" @click="selectStudent(row); state.analysisView = 'students'">
              <span>{{ row.name }}<small>{{ row.email || 'Game account' }}</small></span>
              <strong>{{ row.answered }}/{{ row.required }}</strong>
              <strong>{{ row.accuracy }}%</strong>
              <i>{{ row.lastHomeworkAt || row.lastAttemptAt || 'No homework activity' }}</i>
            </button>
            <div class="teacher-vue-empty" v-if="!missingHomeworkRows.length">No active homework gaps for this scope.</div>
          </div>
        </section>

        <section class="teacher-vue-analysis" v-else-if="state.view === 'question-analysis'">
          <div class="teacher-vue-analysis-stack">
            <div class="teacher-vue-chart">
              <div>
                <span>Questions that need attention</span>
                <strong>{{ classQuestionRows.length }}</strong>
                <i>Filter by topic, outcome, and sort order</i>
              </div>
              <canvas ref="questionChart" aria-label="Question accuracy chart"></canvas>
            </div>
            <div class="teacher-vue-analysis-table teacher-vue-topic-summary">
              <header><h2>Topic summary</h2></header>
              <div class="teacher-vue-topic-row head"><span>Topic</span><span>Correct</span><span>Wrong</span><span>Accuracy</span></div>
              <div class="teacher-vue-topic-row" v-for="row in classTopicRows" :key="row.id">
                <span>{{ row.name || row.topic || 'No topic' }}</span>
                <strong>{{ row.correct }}</strong>
                <strong>{{ row.wrong }}</strong>
                <i>{{ row.accuracy }}%</i>
              </div>
              <div class="teacher-vue-empty" v-if="!classTopicRows.length">No topic attempts yet.</div>
            </div>
            <div class="teacher-vue-analysis-table teacher-vue-school-compare">
              <header><h2>School comparison</h2></header>
              <div class="teacher-vue-topic-row head"><span>School</span><span>Correct</span><span>Wrong</span><span>Accuracy</span></div>
              <div class="teacher-vue-topic-row" v-for="row in schoolComparisonRows" :key="row.id || row.name" :class="{ selected: row.ownSchool }">
                <span>{{ row.name }}<small v-if="row.ownSchool">Your school</small></span>
                <strong>{{ row.correct }}</strong>
                <strong>{{ row.wrong }}</strong>
                <i>{{ row.accuracy }}%</i>
              </div>
              <div class="teacher-vue-empty" v-if="!schoolComparisonRows.length">No other school data in this window yet.</div>
            </div>
          </div>
          <div class="teacher-vue-analysis-table">
            <div class="teacher-vue-filter-row">
              <label>Topic<select v-model="state.questionTopicFilter">
                <option value="">All topics</option>
                <option v-for="topic in analyticsTopicOptions" :key="topic" :value="topic">{{ topic }}</option>
              </select></label>
              <label>Result<select v-model="state.questionOutcomeFilter">
                <option value="">All results</option>
                <option value="wrong">Has wrong answers</option>
                <option value="correct">Has correct answers</option>
                <option value="unanswered">Unanswered</option>
              </select></label>
              <label>Sort<select v-model="state.questionSort">
                <option value="accuracyAsc">Lowest accuracy</option>
                <option value="wrongDesc">Most wrong</option>
                <option value="attemptsDesc">Most answered</option>
                <option value="topicAsc">Topic</option>
              </select></label>
            </div>
            <div class="teacher-vue-analysis-row head">
              <span>Question</span>
              <span>Topic</span>
              <span>Correct / wrong</span>
              <span>Accuracy</span>
            </div>
            <article class="teacher-vue-question-breakdown-card" v-for="row in classQuestionRows" :key="row.id">
              <button class="teacher-vue-analysis-row action" type="button" @click="editQuestionFromAnalysis(row)">
                <span>{{ row.prompt }}<small>{{ row.stage || row.reviewStatus }}</small></span>
                <span>{{ row.topic || 'No topic' }}</span>
                <strong>{{ row.correct }} / {{ row.wrong || 0 }}</strong>
                <strong>{{ row.accuracy }}%</strong>
              </button>
              <div class="teacher-vue-question-breakdowns">
                <section>
                  <h4>By class</h4>
                  <div v-for="item in questionBreakdownRows(row, 'class')" :key="'class-' + item.id + '-' + row.id">
                    <span>{{ item.name }}</span><strong>{{ item.accuracy }}%</strong><small>{{ item.correct }}/{{ item.attempts }}</small>
                  </div>
                  <em v-if="!questionBreakdownRows(row, 'class').length">No class data</em>
                </section>
                <section>
                  <h4>By year group</h4>
                  <div v-for="item in questionBreakdownRows(row, 'year')" :key="'year-' + item.id + '-' + row.id">
                    <span>{{ item.name }}</span><strong>{{ item.accuracy }}%</strong><small>{{ item.correct }}/{{ item.attempts }}</small>
                  </div>
                  <em v-if="!questionBreakdownRows(row, 'year').length">No year data</em>
                </section>
                <section>
                  <h4>By school</h4>
                  <div v-for="item in questionBreakdownRows(row, 'school')" :key="'school-' + item.id + '-' + row.id" :class="{ own: item.ownSchool }">
                    <span>{{ item.name }}</span><strong>{{ item.accuracy }}%</strong><small>{{ item.correct }}/{{ item.attempts }}</small>
                  </div>
                  <em v-if="!questionBreakdownRows(row, 'school').length">No school data</em>
                </section>
              </div>
            </article>
            <h3>Answered attempts</h3>
            <div class="teacher-vue-answer-row head"><span>Student</span><span>Question</span><span>Answer</span><span>Result</span></div>
            <div class="teacher-vue-answer-row" v-for="row in classAttemptRows" :key="row.id">
              <span>{{ row.studentName }}<small>{{ row.createdAt || 'Recent attempt' }}</small></span>
              <span>{{ row.prompt }}<small>{{ row.topic || 'No topic' }}</small></span>
              <span>{{ row.answerText || 'Answer ' + (row.answerIndex + 1) }}<small v-if="!row.correct">Correct: {{ row.correctAnswer }}</small></span>
              <strong :class="{ good: row.correct, bad: !row.correct }">{{ outcomeLabel(row.correct) }}</strong>
            </div>
            <div class="teacher-vue-empty" v-if="!classQuestionRows.length">No questions match this analysis view.</div>
          </div>
        </section>

        <section class="teacher-vue-curriculum" v-else-if="state.view === 'curriculum'">
          <section class="teacher-vue-panel teacher-vue-curriculum-inbox" v-if="isAsherAdmin || state.curriculumRequests.length">
            <header><h2>Admin request inbox</h2><button type="button" @click="loadCurriculumRequests">Refresh</button></header>
            <article class="teacher-vue-request-card" v-for="request in state.curriculumRequests" :key="request.id">
              <div>
                <span>{{ request.subjectName || 'Subject' }}<small>{{ request.className || 'All classes' }} · {{ request.createdAt || 'Submitted' }}</small></span>
                <h3>{{ request.title }}</h3>
                <p v-if="request.topics"><strong>Topics</strong>{{ request.topics }}</p>
                <p v-if="request.syllabus"><strong>Syllabus</strong>{{ request.syllabus }}</p>
                <p v-if="request.notes"><strong>Notes</strong>{{ request.notes }}</p>
                <em>{{ request.teacherName || request.teacherEmail || 'Teacher' }} · {{ request.status === 'done' ? 'Done' : 'Open' }}</em>
              </div>
              <div class="teacher-vue-request-files">
                <strong>Attachments</strong>
                <button v-for="file in request.files" :key="file.storedName" type="button" @click="downloadCurriculumFile(request, file)">
                  <span>{{ file.originalName || file.storedName }}</span>
                  <small>{{ Math.ceil((file.size || 0) / 1024) }} KB</small>
                </button>
                <small v-if="!request.files || !request.files.length">No files attached</small>
                <div class="teacher-vue-request-actions">
                  <button type="button" class="done" :disabled="state.saving || request.status === 'done'" @click="completeCurriculumRequest(request)">Mark done</button>
                  <button type="button" class="danger" :disabled="state.saving" @click="deleteCurriculumRequest(request)">Delete</button>
                </div>
              </div>
            </article>
            <div class="teacher-vue-empty" v-if="!state.curriculumRequests.length">No curriculum requests match this subject/class filter yet.</div>
          </section>
          <form class="teacher-vue-editor" @submit.prevent="submitCurriculumRequest">
            <div class="teacher-vue-editor-head">
              <div>
                <span>Request new curriculum content</span>
                <h2>Curriculum Requests</h2>
              </div>
              <button type="button" class="teacher-vue-primary" @click="clearCurriculumRequest">+ New request</button>
            </div>
            <div class="teacher-vue-form-grid">
              <label>Request title<input v-model="state.curriculum.title" maxlength="160" placeholder="Year 8 networks revision"></label>
              <label>For class<select v-model="state.classId">
                <option value="">All classes</option>
                <option v-for="row in state.classes" :key="row.id" :value="String(row.id)">
                  {{ row.joinCode ? row.name + ' - ' + row.joinCode : row.name }}
                </option>
              </select></label>
            </div>
            <label class="teacher-vue-wide">Topics to cover<textarea v-model="state.curriculum.topics" maxlength="5000" rows="5" placeholder="Algorithms: decomposition, abstraction, flowcharts..."></textarea></label>
            <label class="teacher-vue-wide">Syllabus or exam board<textarea v-model="state.curriculum.syllabus" maxlength="5000" rows="5" placeholder="AQA GCSE Computer Science 8525, section 3.1..."></textarea></label>
            <label class="teacher-vue-wide">Notes<textarea v-model="state.curriculum.notes" maxlength="5000" rows="4" placeholder="Common misconceptions, class priorities, preferred question style..."></textarea></label>
            <label class="teacher-vue-wide teacher-vue-dropzone"><i>⇧</i><strong>Drop curriculum files here</strong><small>or click to upload PDFs, DOCX, PPTX, images, and spreadsheets</small><input id="teacherCurriculumFiles" type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg" @change="handleCurriculumFiles"></label>
            <div class="teacher-vue-file-list" v-if="state.curriculum.files.length">
              <span v-for="file in state.curriculum.files" :key="file.name + file.size">{{ file.name }}</span>
            </div>
            <div class="teacher-vue-actions">
              <button type="button" @click="clearCurriculumRequest">Clear</button>
              <button type="submit" class="teacher-vue-primary" :disabled="state.saving">Submit request</button>
            </div>
          </form>
        </section>

        <section class="teacher-vue-homework" v-else-if="state.view === 'homework'">
          <form class="teacher-vue-editor" @submit.prevent="saveHomework">
            <div class="teacher-vue-editor-head">
              <div>
                <span>Schedule practice</span>
                <h2>Set homework</h2>
              </div>
              <button type="button" class="teacher-vue-primary" @click="clearHomework">+ New homework</button>
            </div>
            <div class="teacher-vue-form-grid">
              <label>Homework title<input v-model="state.homework.title" maxlength="160" placeholder="Year 8 networks retrieval"></label>
              <label>For class<select v-model="state.homework.classId">
                <option value="">All classes</option>
                <option v-for="row in state.classes" :key="row.id" :value="String(row.id)">
                  {{ row.joinCode ? row.name + ' - ' + row.joinCode : row.name }}
                </option>
              </select></label>
              <label>Schedule<select v-model="state.homework.cadence">
                <option value="once">One set by due date</option>
                <option value="daily">Daily until cancelled</option>
                <option value="weekly">Weekly until cancelled</option>
              </select></label>
              <label v-if="state.homework.cadence === 'once'">Due by<input v-model="state.homework.dueDate" type="date"></label>
              <label v-if="state.homework.cadence === 'weekly'">Homework day<select v-model.number="state.homework.weeklyDay">
                <option v-for="(day, index) in weekdayNames" :key="day" :value="index">{{ day }}</option>
              </select></label>
              <div class="teacher-vue-schedule-note" v-if="state.homework.cadence === 'daily'">Runs every day until you change the status to Closed.</div>
              <label>Questions to answer<input v-model.number="state.homework.questionCount" type="number" min="1" max="100" step="1"></label>
              <label>Status<select v-model="state.homework.status">
                <option value="scheduled">Scheduled</option>
                <option value="live">Live now</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
              </select></label>
            </div>
            <label class="teacher-vue-wide">Teacher notes<textarea v-model="state.homework.notes" maxlength="1000" rows="4" placeholder="Optional instructions or focus areas for this homework."></textarea></label>
            <div class="teacher-vue-actions">
              <button type="button" @click="clearHomework">Clear</button>
              <button type="submit" class="teacher-vue-primary" :disabled="state.saving">Set homework</button>
            </div>
          </form>
          <section class="teacher-vue-panel teacher-vue-homework-list">
            <header><h2>Scheduled homework</h2><button type="button" @click="refreshAll">Refresh</button></header>
            <div class="teacher-vue-homework-row head"><span>Title</span><span>Class</span><span>Schedule</span><span>Runs</span><span>Questions</span></div>
            <div class="teacher-vue-homework-row" v-for="homework in state.homeworks" :key="homework.id">
              <span>{{ homework.title }}</span>
              <span>{{ homework.className || 'All classes' }}</span>
              <strong>{{ homework.cadence === 'daily' ? 'Daily' : homework.cadence === 'weekly' ? 'Weekly' : 'One set' }}</strong>
              <span>{{ homework.cadence === 'daily' ? 'Until cancelled' : homework.cadence === 'weekly' ? 'Every ' + weekdayName(homework.weeklyDay) : homework.dueDate }}</span>
              <i>{{ homework.questionCount }} questions</i>
            </div>
            <div class="teacher-vue-empty" v-if="!state.homeworks.length">No homework has been scheduled for this subject yet.</div>
          </section>
        </section>

        <section class="teacher-vue-workspace" v-else>
          <div class="teacher-vue-list">
            <div class="teacher-vue-list-head">
              <label>Search<input v-model="state.search" maxlength="96" placeholder="Topic, spec, or question" @input="changeQuestionFilters"></label>
              <label>Topic<select v-model="state.topicFilter" @change="changeQuestionFilters">
                <option value="">All topics</option>
                <option v-for="topic in topicOptions" :key="topic" :value="topic">{{ topic }}</option>
              </select></label>
              <label>Stage<select v-model="state.stageFilter" @change="changeQuestionFilters">
                <option value="">All stages</option>
                <option v-for="stage in stageOptions" :key="stage" :value="stage">{{ stage }}</option>
              </select></label>
              <label>Difficulty<select v-model="state.difficultyFilter" @change="changeQuestionFilters">
                <option value="">All difficulties</option>
                <option v-for="difficulty in difficultyOptions" :key="difficulty" :value="String(difficulty)">D{{ difficulty }}</option>
              </select></label>
              <label>Status<select v-model="state.status" @change="changeStatus">
                <option value="">All active</option>
                <option value="draft">Draft</option>
                <option value="teacher-reviewed">Teacher reviewed</option>
                <option value="approved">Approved</option>
              </select></label>
              <button type="button" @click="clearQuestionFilters">Clear filters</button>
            </div>
            <div class="teacher-vue-table" :aria-busy="state.loading ? 'true' : 'false'">
              <button
                v-for="question in filteredQuestions"
                :key="question.id"
                type="button"
                class="teacher-vue-row"
                :class="{ selected: question.id === state.selectedId }"
                @click="fillForm(question)"
              >
                <span>{{ question.topic || 'No topic' }}</span>
                <strong>{{ question.prompt || 'Untitled question' }}</strong>
                <i>{{ question.stage || 'No stage' }} / D{{ question.difficulty }} / {{ question.reviewStatus }}{{ question.creatorName ? ' / added by ' + question.creatorName : '' }}</i>
              </button>
              <div class="teacher-vue-empty" v-if="!filteredQuestions.length">
                {{ activeQuestionBank.listEmpty }}
              </div>
            </div>
          </div>

          <form class="teacher-vue-editor" @submit.prevent="saveQuestion(false)">
            <div class="teacher-vue-editor-head">
              <div>
                <span>{{ state.form.id ? 'Editing ' + activeQuestionBank.nav + ' item #' + state.form.id : 'New ' + activeQuestionBank.nav + ' bank item' }}</span>
                <h2>{{ activeQuestionBank.formTitle }}</h2>
              </div>
              <label class="teacher-vue-toggle"><input type="checkbox" v-model="state.form.active"> Active</label>
            </div>

            <div class="teacher-vue-form-grid">
              <label>Topic<input v-model="state.form.topic" maxlength="96" placeholder="Fractions"></label>
              <label>Stage<input v-model="state.form.stage" maxlength="32" placeholder="Year 6"></label>
              <label>Difficulty<select v-model.number="state.form.difficulty">
                <option :value="1">1 - Core</option>
                <option :value="2">2 - Stretch</option>
                <option :value="3">3 - Challenge</option>
              </select></label>
              <label>Specification<input v-model="state.form.spec" maxlength="96" placeholder="Add and subtract fractions"></label>
              <label>Review<select v-model="state.form.reviewStatus">
                <option value="draft">Draft</option>
                <option value="teacher-reviewed">Teacher reviewed</option>
                <option value="approved">Approved</option>
              </select></label>
            </div>

            <section class="teacher-vue-bank-tabs" aria-label="Question bank screens">
              <button type="button" :class="{ active: state.view === 'recall-bank' }" @click="openView('recall-bank')">P Recall <strong>{{ bankCounts.recall }}</strong></button>
              <button type="button" :class="{ active: state.view === 'meditation-bank' }" @click="openView('meditation-bank')">Meditation <strong>{{ bankCounts.meditation }}</strong></button>
              <button type="button" :class="{ active: state.view === 'scholar-bank' }" @click="openView('scholar-bank')">Knowledge <strong>{{ bankCounts.scholar }}</strong></button>
            </section>

            <section class="teacher-vue-templates">
              <article v-if="activeQuestionMode === 'recall'">
                <b>P Recall / Question Hall</b>
                <span>Best for quick retrieval. Write one clear question and four plausible choices. Avoid silly distractors.</span>
                <em>Template: “Which option best describes ____?”</em>
              </article>
              <article v-if="activeQuestionMode === 'meditation'">
                <b>Meditation Focus</b>
                <span>Best for calm fill-the-gap recall. Put a blank in the prompt and add accepted answers below.</span>
                <em>Template: “A variable stores a value that can ____ while a program runs.”</em>
              </article>
              <article v-if="activeQuestionMode === 'scholar'">
                <b>Scholar Table / Knowledge Challenge</b>
                <span>Best for adaptive practice. Plan the concept, the atom being tested, the misconception it is confused with, and the relationship that separates them.</span>
                <em>Template: concept + atom statement + common confusion + decisive difference + consequence.</em>
              </article>
            </section>

            <section class="teacher-vue-knowledge-plan" v-if="activeQuestionMode === 'scholar'">
              <header>
                <div>
                  <span>Knowledge Challenge planning</span>
                  <h3>Concept map coverage</h3>
                </div>
                <small>{{ state.knowledgePlan.counts.entities || 0 }} concepts · {{ state.knowledgePlan.counts.atoms || 0 }} atoms · {{ state.knowledgePlan.counts.confusionPairs || 0 }} misconception links · {{ state.knowledgePlan.counts.playableCases || bankCounts.scholar }} playable cases</small>
              </header>
              <div class="teacher-vue-plan-grid">
                <article>
                  <b>1. Concepts</b>
                  <span v-for="entity in state.knowledgePlan.entities.slice(0, 5)" :key="'entity-' + entity.id">{{ entity.name }} <small>{{ entity.topic || 'No topic' }}</small></span>
                  <em v-if="!state.knowledgePlan.entities.length">Add concepts through curriculum packs/content requests.</em>
                </article>
                <article>
                  <b>2. Atoms</b>
                  <span v-for="atom in state.knowledgePlan.atoms.slice(0, 5)" :key="'atom-' + atom.id">{{ atom.entityName }} → {{ atom.typeLabel }} <small>{{ atom.statement }}</small></span>
                  <em v-if="!state.knowledgePlan.atoms.length">Atoms are the individual knowledge claims the table tracks.</em>
                </article>
                <article>
                  <b>3. Misconception links</b>
                  <span v-for="pair in state.knowledgePlan.confusionPairs.slice(0, 5)" :key="'pair-' + pair.id">{{ pair.atomA }} ⇄ {{ pair.atomB }} <small>{{ pair.note }}</small></span>
                  <em v-if="!state.knowledgePlan.confusionPairs.length">Plan confusing pairs like stack vs queue, router vs switch, variable vs constant.</em>
                </article>
              </div>
              <div class="teacher-vue-plan-author">
                <h4>Attach this playable case to the concept map</h4>
                <p>Save will create/select the concept, create/select the atom being tested, then optionally link the atom to a misconception. This is what turns a Scholar Table question into Concepts → atoms → misconception links.</p>
                <div class="teacher-vue-author-grid">
                  <label>
                    Existing concept
                    <select v-model="state.form.knowledge.entityId">
                      <option value="">Create a new concept</option>
                      <option v-for="entity in knowledgeEntityOptions" :key="'concept-option-' + entity.id" :value="String(entity.id)">{{ entity.name }}{{ entity.topic ? ' · ' + entity.topic : '' }}</option>
                    </select>
                  </label>
                  <label>
                    New concept name
                    <input v-model="state.form.knowledge.entityName" maxlength="120" placeholder="e.g. Network routing">
                  </label>
                  <label class="teacher-vue-wide">
                    Concept summary
                    <textarea v-model="state.form.knowledge.entitySummary" maxlength="2000" rows="2" placeholder="What should the learner understand about this concept?"></textarea>
                  </label>
                  <label>
                    Existing atom
                    <select v-model="state.form.knowledge.atomId">
                      <option value="">Create a new atom</option>
                      <option v-for="atom in knowledgeAtomOptions" :key="'atom-option-' + atom.id" :value="String(atom.id)">{{ atom.entityName }} → {{ atom.typeLabel || atom.typeCode || 'Atom' }} · {{ atom.statement }}</option>
                    </select>
                  </label>
                  <label>
                    Atom type
                    <input v-model="state.form.knowledge.atomType" maxlength="48" placeholder="purpose / behaviour / difference">
                  </label>
                  <label class="teacher-vue-wide">
                    Atom statement
                    <textarea v-model="state.form.knowledge.atomStatement" maxlength="2000" rows="2" placeholder="The exact knowledge claim this case tests, e.g. A router forwards packets between networks."></textarea>
                  </label>
                  <label>
                    Link to existing misconception atom
                    <select v-model="state.form.knowledge.confusionAtomId">
                      <option value="">Create/link a new misconception below</option>
                      <option v-for="atom in knowledgeAtomOptions" :key="'confusion-option-' + atom.id" :value="String(atom.id)">{{ atom.entityName }} → {{ atom.statement }}</option>
                    </select>
                  </label>
                  <label>
                    Misconception name
                    <input v-model="state.form.knowledge.misconceptionName" maxlength="120" placeholder="e.g. Router stores websites">
                  </label>
                  <label class="teacher-vue-wide">
                    Misconception atom / link note
                    <textarea v-model="state.form.knowledge.misconceptionStatement" maxlength="2000" rows="2" placeholder="The wrong idea a plausible distractor reveals."></textarea>
                    <input v-model="state.form.knowledge.misconceptionNote" maxlength="240" placeholder="Why learners confuse them / decisive difference">
                  </label>
                </div>
              </div>
            </section>

            <label class="teacher-vue-wide">Question prompt<textarea v-model="state.form.prompt" maxlength="500" rows="4"></textarea></label>

            <fieldset class="teacher-vue-answers">
              <legend>{{ activeQuestionMode === 'meditation' ? 'Accepted fill-gap answers' : 'Multiple-choice answers' }}</legend>
              <label v-for="index in [0,1,2,3]" :key="index">
                <input v-if="activeQuestionMode !== 'meditation'" type="radio" name="correctAnswer" :value="index" v-model.number="state.form.correct">
                <span>{{ ['A','B','C','D'][index] }}</span>
                <input v-model="state.form.answers[index]" maxlength="160" :placeholder="activeQuestionMode === 'meditation' ? (index === 0 ? 'Main accepted answer' : 'Optional alternative spelling/wording') : activeQuestionMode === 'scholar' ? (index === state.form.correct ? 'Secure target idea' : 'Plausible misconception') : ''">
              </label>
            </fieldset>

            <label class="teacher-vue-wide">Explanation<textarea v-model="state.form.explanation" maxlength="800" rows="4"></textarea></label>

            <div class="teacher-vue-actions">
              <button type="button" @click="newQuestion">Clear</button>
              <button type="button" @click="saveQuestion(true)" :disabled="state.saving">Save as new</button>
              <button type="submit" class="teacher-vue-primary" :disabled="state.saving">Save question</button>
            </div>
          </form>
        </section>
      </main>
    </div>
  `,
}).mount('#teacherapp');
