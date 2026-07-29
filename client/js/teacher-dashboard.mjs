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
  const res = await fetch(apiUrl(path), {
    credentials: 'include',
    ...options,
    headers: authHeaders(options.headers || {}),
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error(data.error || 'Teacher dashboard request failed.');
  return data;
}

function isTeacherAccount(account) {
  const role = String(account && (account.role || account.accountType) || '').trim().toLowerCase();
  const id = String(account && account.id || '').trim().toLowerCase();
  return role === 'teacher' || role === 'admin' || id.startsWith('teacher_');
}

const emptyForm = () => ({
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
    creatorName: String(question.creatorName || question.creatorEmail || '').trim(),
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
      selectedId: 0,
      subjectId: '',
      classId: '',
      status: '',
      topicFilter: '',
      stageFilter: '',
      difficultyFilter: '',
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

    const selectedSubject = computed(() => state.subjects.find(s => String(s.id) === String(state.subjectId)) || null);
    const selectedQuestion = computed(() => state.questions.find(q => q.id === state.selectedId) || null);
    const topicOptions = computed(() => [...new Set(state.questions.map(q => String(q.topic || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)));
    const stageOptions = computed(() => [...new Set(state.questions.map(q => String(q.stage || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)));
    const difficultyOptions = computed(() => [...new Set(state.questions.map(q => Number(q.difficulty) || 1).filter(Boolean))].sort((a, b) => a - b));
    const filteredQuestions = computed(() => {
      const needle = state.search.trim().toLowerCase();
      const topic = String(state.topicFilter || '').trim().toLowerCase();
      const stage = String(state.stageFilter || '').trim().toLowerCase();
      const difficulty = Number(state.difficultyFilter || 0) || 0;
      return state.questions.filter(q => {
        if (topic && String(q.topic || '').trim().toLowerCase() !== topic) return false;
        if (stage && String(q.stage || '').trim().toLowerCase() !== stage) return false;
        if (difficulty && Number(q.difficulty || 0) !== difficulty) return false;
        if (!needle) return true;
        return [q.topic, q.stage, q.spec, q.prompt].some(value => String(value || '').toLowerCase().includes(needle));
      });
    });
    const stats = computed(() => ({
      total: state.questions.length,
      draft: state.questions.filter(q => q.reviewStatus === 'draft').length,
      reviewed: state.questions.filter(q => q.reviewStatus === 'teacher-reviewed').length,
      approved: state.questions.filter(q => q.reviewStatus === 'approved').length,
      active: state.questions.filter(q => q.active).length,
    }));
    const studentRows = computed(() => (state.analytics.students || []).slice().sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts));
    const questionRows = computed(() => (state.analytics.questions || []).slice().sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts));
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
      stats.value.active + ' active shared subject-bank questions available for Recall',
      state.homeworks.length + ' homework schedules ready',
      state.analytics.totals.attempts + ' student attempts in the current window',
      'Curriculum requests email through the SiteGround bridge',
    ]);
    const dashboardLinks = computed(() => [
      { id: 'questions', title: 'Add Questions', value: stats.value.active, detail: 'Shared subject bank', tone: 'blue' },
      { id: 'homework', title: 'Set Homework', value: state.homeworks.length, detail: 'Scheduled practice', tone: 'purple' },
      { id: 'students', title: 'Student Insights', value: needingSupport.value, detail: 'Need support', tone: 'red' },
      { id: 'question-analysis', title: 'Question Analysis', value: state.analytics.totals.accuracy + '%', detail: 'Average accuracy', tone: 'green' },
      { id: 'curriculum', title: 'Curriculum Content', value: 'Upload', detail: 'Request new content', tone: 'orange' },
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

    function syncClassSelectionWithSubject() {
      const validClassIds = new Set((state.classes || []).map(row => String(row.id)));
      if (state.classId && !validClassIds.has(String(state.classId))) state.classId = '';
      if (state.homework.classId && !validClassIds.has(String(state.homework.classId))) state.homework.classId = '';
    }

    function signOut() {
      storeSession('');
      state.account = null;
      state.subjects = [];
      state.classes = [];
      state.questions = [];
      state.homeworks = [];
      state.analytics = { totals: { attempts: 0, correct: 0, accuracy: 0 }, students: [], questions: [], windowDays: 30 };
      state.view = 'overview';
      state.loading = false;
      setNotice('');
      setError('');
    }

    function fillForm(question) {
      const q = cleanQuestion(question || {});
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
      };
      state.selectedId = q.id || 0;
    }

    function newQuestion() {
      state.view = 'questions';
      state.selectedId = 0;
      state.form = emptyForm();
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
      state.view = ['questions', 'homework', 'students', 'question-analysis', 'curriculum'].includes(view) ? view : 'overview';
      setNotice('');
    }

    function editQuestionFromAnalysis(row) {
      const full = state.questions.find(question => Number(question.id) === Number(row && row.id));
      openView('questions');
      if (full) fillForm(full);
    }

    async function loadAccount() {
      if (!storedSession()) {
        state.account = null;
        return false;
      }
      const data = await requestJson('/auth/me');
      state.account = data.account || null;
      if (!isTeacherAccount(state.account)) throw new Error('Teacher account required.');
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
        + (state.classId ? '&classId=' + encodeURIComponent(state.classId) : '')
        + '&days=' + encodeURIComponent(state.analyticsDays);
      const [questionsData, analyticsData, homeworkData] = await Promise.all([
        requestJson('/auth/teacher/game-questions' + query),
        requestJson('/auth/teacher/analytics' + analyticsQuery),
        requestJson('/auth/teacher/homework' + analyticsQuery),
      ]);
      state.questions = (questionsData.questions || []).map(cleanQuestion);
      state.analytics = analyticsData.analytics || state.analytics;
      state.homeworks = homeworkData.homework || [];
      if (state.selectedId && !selectedQuestion.value) newQuestion();
    }

    async function refreshAll() {
      state.loading = true;
      try {
        const signedIn = await loadAccount();
        if (!signedIn) {
          setNotice('');
          return;
        }
        await loadSubjects();
        await loadSubjectData();
        setNotice('Shared subject question bank loaded.');
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
      const answers = state.form.answers.map(value => String(value || '').trim());
      const unique = new Set(answers.map(value => value.toLowerCase()).filter(Boolean));
      if (!state.subjectId) throw new Error('Choose a subject first.');
      if (String(state.form.prompt || '').trim().length < 10) throw new Error('Question prompt needs at least 10 characters.');
      if (answers.some(value => !value) || unique.size !== 4) throw new Error('Add four unique answer choices.');
      if (String(state.form.explanation || '').trim().length < 10) throw new Error('Add a short teaching explanation.');
      return {
        subjectId: Number(state.subjectId),
        topic: state.form.topic,
        stage: state.form.stage,
        difficulty: Number(state.form.difficulty) || 1,
        spec: state.form.spec,
        prompt: state.form.prompt,
        answers,
        correct: Number(state.form.correct) || 0,
        explanation: state.form.explanation,
        reviewStatus: state.form.reviewStatus,
        active: !!state.form.active,
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
        setNotice(copy ? 'Saved as a new shared subject-bank question.' : 'Shared subject-bank question saved.');
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
      selectedSubject,
      filteredQuestions,
      topicOptions,
      stageOptions,
      difficultyOptions,
      studentRows,
      questionRows,
      needingSupport,
      reviewCount,
      dueSoonCount,
      currentAssignments,
      classRows,
      attentionItems,
      recentActivity,
      stats,
      dashboardLinks,
      studentChart,
      questionChart,
      refreshAll,
      teacherLogin,
      signOut,
      changeSubject,
      changeStatus,
      changeQuestionFilters,
      clearQuestionFilters,
      openView,
      editQuestionFromAnalysis,
      handleCurriculumFiles,
      clearCurriculumRequest,
      submitCurriculumRequest,
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
          <button type="button" :class="{ active: state.view === 'overview' }" @click="openView('overview')"><span>⌂</span>Home</button>
          <button type="button" :class="{ active: state.view === 'questions' }" @click="openView('questions')"><span>▤</span>Add Questions</button>
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
            <h1>{{ state.view === 'questions' ? 'Add Questions' : state.view === 'homework' ? 'Set Homework' : state.view === 'students' ? 'Student insights' : state.view === 'question-analysis' ? 'Question analysis' : state.view === 'curriculum' ? 'Curriculum Requests' : 'Good morning, ' + (state.account && state.account.displayName || 'Mr Levin') }}</h1>
            <p>{{ selectedSubject ? (state.view === 'questions' || state.view === 'question-analysis' ? selectedSubject.name + ' uses one shared subject question bank.' : "Here's what's happening in " + selectedSubject.name + " today.") : "Here's what's happening with your homework today." }}</p>
          </div>
          <div class="teacher-vue-toolbar">
            <select v-model="state.subjectId" @change="changeSubject">
              <option v-for="subject in state.subjects" :key="subject.id" :value="String(subject.id)">
                {{ subject.code ? subject.name + ' (' + subject.code + ')' : subject.name }}
              </option>
            </select>
            <select v-model="state.classId" @change="changeStatus">
              <option value="">All classes</option>
              <option v-for="row in state.classes" :key="row.id" :value="String(row.id)">
                {{ row.joinCode ? row.name + ' - ' + row.joinCode : row.name }}
              </option>
            </select>
            <select v-model.number="state.analyticsDays" @change="changeStatus">
              <option :value="7">Last 7 days</option>
              <option :value="30">Last 30 days</option>
              <option :value="90">Last 90 days</option>
              <option :value="180">Last 180 days</option>
            </select>
            <button type="button" class="teacher-vue-primary" @click="state.view === 'homework' ? clearHomework() : newQuestion()">{{ state.view === 'homework' ? '+ New homework' : '+ Add question' }}</button>
          </div>
        </header>

        <section class="teacher-vue-metrics" aria-label="Question metrics">
          <div class="tone-red"><i>♙</i><span>Students needing support</span><strong>{{ needingSupport }}</strong><small>Needs attention</small></div>
          <div class="tone-purple"><i>?</i><span>Written reviews</span><strong>{{ reviewCount }}</strong><small>Need review</small></div>
          <div class="tone-orange"><i>◷</i><span>Homework</span><strong>{{ dueSoonCount }}</strong><small>Scheduled</small></div>
          <div class="tone-green"><i>↗</i><span>Average accuracy</span><strong>{{ state.analytics.totals.accuracy }}%</strong><small>Across all classes</small></div>
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

        <section class="teacher-vue-analysis" v-else-if="state.view === 'students'">
          <div class="teacher-vue-chart">
            <div>
              <span>Student insights</span>
              <strong>{{ state.analytics.totals.accuracy }}%</strong>
              <i>{{ state.analytics.totals.correct }} correct from {{ state.analytics.totals.attempts }} attempts</i>
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
            <div class="teacher-vue-analysis-row" v-for="row in studentRows" :key="row.id || row.name">
              <span>{{ row.name }}<small>{{ row.email || 'Game account' }}</small></span>
              <strong>{{ row.attempts }}</strong>
              <strong>{{ row.accuracy }}%</strong>
              <i>{{ row.lastAttemptAt || 'No attempts' }}</i>
            </div>
            <div class="teacher-vue-empty" v-if="!studentRows.length">No student attempt data for this subject yet.</div>
          </div>
        </section>

        <section class="teacher-vue-analysis" v-else-if="state.view === 'question-analysis'">
          <div class="teacher-vue-chart">
            <div>
              <span>Questions that need attention</span>
              <strong>{{ questionRows.length }}</strong>
              <i>Sorted by accuracy, then attempt count</i>
            </div>
            <canvas ref="questionChart" aria-label="Question accuracy chart"></canvas>
          </div>
          <div class="teacher-vue-analysis-table">
            <div class="teacher-vue-analysis-row head">
              <span>Question</span>
              <span>Topic</span>
              <span>Attempts</span>
              <span>Accuracy</span>
            </div>
            <button class="teacher-vue-analysis-row action" type="button" v-for="row in questionRows" :key="row.id" @click="editQuestionFromAnalysis(row)">
              <span>{{ row.prompt }}<small>{{ row.stage || row.reviewStatus }}</small></span>
              <span>{{ row.topic || 'No topic' }}</span>
              <strong>{{ row.attempts }}</strong>
              <strong>{{ row.accuracy }}%</strong>
            </button>
            <div class="teacher-vue-empty" v-if="!questionRows.length">No question attempt data for this subject yet.</div>
          </div>
        </section>

        <section class="teacher-vue-curriculum" v-else-if="state.view === 'curriculum'">
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
                No questions match this view.
              </div>
            </div>
          </div>

          <form class="teacher-vue-editor" @submit.prevent="saveQuestion(false)">
            <div class="teacher-vue-editor-head">
              <div>
                <span>{{ state.form.id ? 'Editing shared question #' + state.form.id : 'New shared subject-bank question' }}</span>
                <h2>Question details</h2>
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

            <label class="teacher-vue-wide">Question prompt<textarea v-model="state.form.prompt" maxlength="500" rows="4"></textarea></label>

            <fieldset class="teacher-vue-answers">
              <legend>Answers</legend>
              <label v-for="index in [0,1,2,3]" :key="index">
                <input type="radio" name="correctAnswer" :value="index" v-model.number="state.form.correct">
                <span>{{ ['A','B','C','D'][index] }}</span>
                <input v-model="state.form.answers[index]" maxlength="160">
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

