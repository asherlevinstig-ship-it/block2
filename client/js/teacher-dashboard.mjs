import { createApp, computed, onMounted, reactive } from 'vue';
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
      selectedId: 0,
      subjectId: '',
      classId: '',
      status: '',
      search: '',
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
      state.selectedId = 0;
      state.form = emptyForm();
      setNotice('');
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
      const [classesData, questionsData] = await Promise.all([
        requestJson('/auth/teacher/classes?subjectId=' + encodeURIComponent(state.subjectId)),
        requestJson('/auth/teacher/game-questions' + query),
      ]);
      state.classes = classesData.classes || [];
      state.questions = (questionsData.questions || []).map(cleanQuestion);
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
        setNotice('Filter applied.');
      } catch (e) {
        setError(e.message || 'Could not load questions.');
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

    onMounted(refreshAll);

    return {
      state,
      selectedSubject,
      filteredQuestions,
      stats,
      refreshAll,
      changeSubject,
      changeStatus,
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
          <strong>Question Studio</strong>
        </div>
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
          <select v-model="state.classId">
            <option value="">All classes</option>
            <option v-for="row in state.classes" :key="row.id" :value="String(row.id)">
              {{ row.joinCode ? row.name + ' - ' + row.joinCode : row.name }}
            </option>
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
            <span>{{ selectedSubject ? 'Subject workspace' : 'Teacher workspace' }}</span>
            <h1>{{ selectedSubject ? selectedSubject.name : 'Question Bank' }}</h1>
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

        <section class="teacher-vue-workspace">
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
