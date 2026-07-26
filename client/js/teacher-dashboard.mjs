import { createApp, computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import Chart from 'chart.js/auto';
import { apiUrl } from './config.mjs';

const sessionKey = 'blockcraft.auth.session';

function storedSession() {
  try { return typeof localStorage === 'undefined' ? '' : String(localStorage.getItem(sessionKey) || '').trim(); } catch (_) { return ''; }
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

function cleanQuestion(question) {
  return {
    ...question,
    answers: Array.isArray(question.answers) ? question.answers.slice(0, 4).concat(['', '', '', '']).slice(0, 4) : ['', '', '', ''],
    difficulty: Number(question.difficulty) || 1,
    correct: Math.max(0, Math.min(3, Number(question.correct) || 0)),
    active: question.active !== false,
  };
}

createApp({
  setup() {
    const state = reactive({
      account: null,
      subjects: [],
      classes: [],
      questions: [],
      analytics: { totals: { attempts: 0, correct: 0, accuracy: 0 }, students: [], questions: [], windowDays: 30 },
      selectedId: 0,
      subjectId: '',
      classId: '',
      status: '',
      analyticsDays: 30,
      curriculum: emptyCurriculum(),
      search: '',
      view: 'overview',
      loading: true,
      saving: false,
      error: '',
      notice: '',
      form: emptyForm(),
    });

    const selectedSubject = computed(() => state.subjects.find(s => String(s.id) === String(state.subjectId)) || null);
    const selectedQuestion = computed(() => state.questions.find(q => q.id === state.selectedId) || null);
    const filteredQuestions = computed(() => {
      const needle = state.search.trim().toLowerCase();
      if (!needle) return state.questions;
      return state.questions.filter(q => [q.topic, q.stage, q.spec, q.prompt].some(value => String(value || '').toLowerCase().includes(needle)));
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
    const dashboardLinks = computed(() => [
      { id: 'questions', title: 'Questions', value: stats.value.total, detail: stats.value.draft + ' draft / ' + stats.value.approved + ' approved' },
      { id: 'students', title: 'Student Analysis', value: studentRows.value.length, detail: state.analytics.totals.accuracy + '% average accuracy' },
      { id: 'question-analysis', title: 'Question Analysis', value: questionRows.value.length, detail: state.analytics.totals.attempts + ' attempts' },
      { id: 'curriculum', title: 'Curriculum Requests', value: 'Upload', detail: 'Send topics, syllabus, and organisers' },
      { id: 'review', title: 'Review Queue', value: stats.value.reviewed, detail: 'Teacher-reviewed game questions' },
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

    function openView(view) {
      state.view = ['questions', 'students', 'question-analysis', 'curriculum'].includes(view) ? view : 'overview';
      setNotice('');
    }

    function editQuestionFromAnalysis(row) {
      const full = state.questions.find(question => Number(question.id) === Number(row && row.id));
      openView('questions');
      if (full) fillForm(full);
    }

    async function loadAccount() {
      if (!storedSession()) throw new Error('Sign in from the game page first.');
      const data = await requestJson('/auth/me');
      state.account = data.account || null;
      if (!isTeacherAccount(state.account)) throw new Error('Teacher account required.');
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
      const query = '?subjectId=' + encodeURIComponent(state.subjectId) + (state.status ? '&reviewStatus=' + encodeURIComponent(state.status) : '');
      const analyticsQuery = '?subjectId=' + encodeURIComponent(state.subjectId)
        + (state.classId ? '&classId=' + encodeURIComponent(state.classId) : '')
        + '&days=' + encodeURIComponent(state.analyticsDays);
      const [classesData, questionsData, analyticsData] = await Promise.all([
        requestJson('/auth/teacher/classes?subjectId=' + encodeURIComponent(state.subjectId)),
        requestJson('/auth/teacher/game-questions' + query),
        requestJson('/auth/teacher/analytics' + analyticsQuery),
      ]);
      state.classes = classesData.classes || [];
      state.questions = (questionsData.questions || []).map(cleanQuestion);
      state.analytics = analyticsData.analytics || state.analytics;
      if (state.selectedId && !selectedQuestion.value) newQuestion();
    }

    async function refreshAll() {
      state.loading = true;
      try {
        await loadAccount();
        await loadSubjects();
        await loadSubjectData();
        setNotice('Question bank loaded.');
      } catch (e) {
        setError(e.message || 'Could not load teacher dashboard.');
      } finally {
        state.loading = false;
      }
    }

    async function changeSubject() {
      newQuestion();
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
        setNotice(copy ? 'Saved as a new question.' : 'Question saved.');
      } catch (e) {
        setError(e.message || 'Could not save question.');
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
        setNotice(data.notification && data.notification.sent
          ? 'Curriculum request submitted and email notification sent.'
          : 'Curriculum request submitted. Email notification is not configured on the server yet.');
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
      studentRows,
      questionRows,
      stats,
      dashboardLinks,
      studentChart,
      questionChart,
      refreshAll,
      changeSubject,
      changeStatus,
      openView,
      editQuestionFromAnalysis,
      handleCurriculumFiles,
      clearCurriculumRequest,
      submitCurriculumRequest,
      fillForm,
      newQuestion,
      saveQuestion,
    };
  },
  template: `
    <div class="teacher-vue-shell">
      <aside class="teacher-vue-sidebar">
        <a class="teacher-vue-back" href="./">Back to game</a>
        <div class="teacher-vue-brand">
          <span>TEACHER</span>
          <strong>Dashboard</strong>
        </div>
        <nav class="teacher-vue-nav" aria-label="Teacher dashboard">
          <button type="button" :class="{ active: state.view === 'overview' }" @click="openView('overview')">Overview</button>
          <button type="button" :class="{ active: state.view === 'questions' }" @click="openView('questions')">Questions</button>
          <button type="button" :class="{ active: state.view === 'students' }" @click="openView('students')">Student Analysis</button>
          <button type="button" :class="{ active: state.view === 'question-analysis' }" @click="openView('question-analysis')">Question Analysis</button>
          <button type="button" :class="{ active: state.view === 'curriculum' }" @click="openView('curriculum')">Curriculum Requests</button>
        </nav>
        <label>
          Subject
          <select v-model="state.subjectId" @change="changeSubject">
            <option v-for="subject in state.subjects" :key="subject.id" :value="String(subject.id)">
              {{ subject.code ? subject.name + ' (' + subject.code + ')' : subject.name }}
            </option>
          </select>
        </label>
        <label>
          Class
          <select v-model="state.classId" @change="changeStatus">
            <option value="">All classes</option>
            <option v-for="row in state.classes" :key="row.id" :value="String(row.id)">
              {{ row.joinCode ? row.name + ' - ' + row.joinCode : row.name }}
            </option>
          </select>
        </label>
        <label>
          Analysis window
          <select v-model.number="state.analyticsDays" @change="changeStatus">
            <option :value="7">Last 7 days</option>
            <option :value="30">Last 30 days</option>
            <option :value="90">Last 90 days</option>
            <option :value="180">Last 180 days</option>
          </select>
        </label>
        <label>
          Status
          <select v-model="state.status" @change="changeStatus">
            <option value="">All active</option>
            <option value="draft">Draft</option>
            <option value="teacher-reviewed">Teacher reviewed</option>
            <option value="approved">Approved</option>
          </select>
        </label>
        <button type="button" class="teacher-vue-primary" @click="newQuestion">New question</button>
      </aside>

      <main class="teacher-vue-main">
        <header class="teacher-vue-topbar">
          <div>
            <span>{{ selectedSubject ? selectedSubject.name : 'Teacher workspace' }}</span>
            <h1>{{ state.view === 'questions' ? 'Questions' : state.view === 'students' ? 'Student Analysis' : state.view === 'question-analysis' ? 'Question Analysis' : state.view === 'curriculum' ? 'Curriculum Requests' : 'Dashboard' }}</h1>
          </div>
          <button type="button" @click="refreshAll" :disabled="state.loading">Refresh</button>
        </header>

        <section class="teacher-vue-metrics" aria-label="Question metrics">
          <div><span>Total</span><strong>{{ stats.total }}</strong></div>
          <div><span>Draft</span><strong>{{ stats.draft }}</strong></div>
          <div><span>Reviewed</span><strong>{{ stats.reviewed }}</strong></div>
          <div><span>Approved</span><strong>{{ stats.approved }}</strong></div>
          <div><span>Active</span><strong>{{ stats.active }}</strong></div>
        </section>

        <div class="teacher-vue-status bad" v-if="state.error">{{ state.error }}</div>
        <div class="teacher-vue-status ok" v-else-if="state.notice">{{ state.notice }}</div>

        <section class="teacher-vue-overview" v-if="state.view === 'overview'">
          <button
            v-for="link in dashboardLinks"
            :key="link.id"
            type="button"
            class="teacher-vue-card"
            @click="openView(link.id)"
            :disabled="link.id === 'review'"
          >
            <span>{{ link.title }}</span>
            <strong>{{ link.value }}</strong>
            <i>{{ link.detail }}</i>
          </button>
        </section>

        <section class="teacher-vue-analysis" v-else-if="state.view === 'students'">
          <div class="teacher-vue-chart">
            <div>
              <span>Lowest accuracy first</span>
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
                <span>Content request</span>
                <h2>Send topics and organisers</h2>
              </div>
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
            <label class="teacher-vue-wide">Knowledge organisers and files<input id="teacherCurriculumFiles" type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg" @change="handleCurriculumFiles"></label>
            <div class="teacher-vue-file-list" v-if="state.curriculum.files.length">
              <span v-for="file in state.curriculum.files" :key="file.name + file.size">{{ file.name }}</span>
            </div>
            <div class="teacher-vue-actions">
              <button type="button" @click="clearCurriculumRequest">Clear</button>
              <button type="submit" class="teacher-vue-primary" :disabled="state.saving">Submit request</button>
            </div>
          </form>
        </section>

        <section class="teacher-vue-workspace" v-else>
          <div class="teacher-vue-list">
            <div class="teacher-vue-list-head">
              <label>Search<input v-model="state.search" maxlength="96" placeholder="Topic, spec, or question"></label>
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
                <i>{{ question.stage || 'No stage' }} / D{{ question.difficulty }} / {{ question.reviewStatus }}</i>
              </button>
              <div class="teacher-vue-empty" v-if="!filteredQuestions.length">
                No questions match this view.
              </div>
            </div>
          </div>

          <form class="teacher-vue-editor" @submit.prevent="saveQuestion(false)">
            <div class="teacher-vue-editor-head">
              <div>
                <span>{{ state.form.id ? 'Editing #' + state.form.id : 'New question' }}</span>
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
