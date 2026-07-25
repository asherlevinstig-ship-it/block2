import { apiUrl } from './config.mjs';

const sessionKey = 'blockcraft.auth.session';
const els = {};
const state = {
  account: null,
  subjects: [],
  classes: [],
  questions: [],
  selectedId: 0,
  open: false,
  busy: false,
};
const standalone = typeof document !== 'undefined' && !!document.body && document.body.dataset.page === 'teacher';

function byId(id) {
  return typeof document === 'undefined' ? null : document.getElementById(id);
}

function ensureShell() {
  let desk = byId('teacherdesk');
  if (!desk && typeof document !== 'undefined' && document.body) {
    desk = document.createElement('div');
    desk.id = 'teacherdesk';
    desk.className = standalone ? 'teacher-page' : 'hidden';
    desk.setAttribute('role', 'dialog');
    desk.setAttribute('aria-modal', 'true');
    desk.setAttribute('aria-labelledby', 'teacherdesktitle');
    const mount = byId('teacherapp') || document.body;
    mount.appendChild(desk);
  }
  if (!desk || desk.dataset.ready === '1') return;
  if (standalone) desk.classList.add('teacher-page');
  desk.innerHTML =
    '<div class="teacherdesk-shell">' +
      '<header class="teacherdesk-header">' +
        '<div><div class="teacherdesk-kicker">TEACHER TOOLS</div><h2 id="teacherdesktitle">Game Question Bank</h2></div>' +
        '<div class="teacherdesk-actions"><button id="teacherrefresh" type="button">REFRESH</button><button id="teacherclose" type="button">' + (standalone ? 'BACK TO GAME' : 'CLOSE') + '</button></div>' +
      '</header>' +
      '<section class="teacherdesk-toolbar" aria-label="Teacher dashboard filters">' +
        '<label>Subject<select id="teachersubject"></select></label>' +
        '<label>Class<select id="teacherclass"></select></label>' +
        '<label>Status<select id="teacherstatusfilter"><option value="">All active</option><option value="draft">Draft</option><option value="teacher-reviewed">Teacher reviewed</option><option value="approved">Approved</option></select></label>' +
        '<label>Search<input id="teachersearch" maxlength="96" placeholder="Topic or question"></label>' +
      '</section>' +
      '<section class="teacherdesk-stats" aria-label="Question totals"><span><b id="teacherquestioncount">0</b> Questions</span><span><b id="teacherdraftcount">0</b> Draft</span><span><b id="teacherapprovedcount">0</b> Approved</span></section>' +
      '<main class="teacherdesk-main">' +
        '<aside class="teacherquestion-list" aria-label="Game questions"><div id="teacherquestionlist"></div></aside>' +
        '<form id="teacherquestionform" class="teacherquestion-editor">' +
          '<input id="teacherquestionid" type="hidden">' +
          '<div class="teacherform-grid">' +
            '<label>Topic<input id="teachertopic" maxlength="96" placeholder="Fractions"></label>' +
            '<label>Stage<input id="teacherstage" maxlength="32" placeholder="Year 6"></label>' +
            '<label>Difficulty<select id="teacherdifficulty"><option value="1">1 - Core</option><option value="2">2 - Stretch</option><option value="3">3 - Challenge</option></select></label>' +
            '<label>Specification<input id="teacherspec" maxlength="96" placeholder="Add and subtract fractions"></label>' +
            '<label>Review<select id="teacherreview"><option value="draft">Draft</option><option value="teacher-reviewed">Teacher reviewed</option><option value="approved">Approved</option></select></label>' +
            '<label class="teachercheck"><input id="teacheractive" type="checkbox" checked> Active in game</label>' +
          '</div>' +
          '<label class="teacherwide">Question prompt<textarea id="teacherprompt" maxlength="500" rows="4" placeholder="What should students answer?"></textarea></label>' +
          '<fieldset class="teacheranswers"><legend>Answers</legend>' +
            '<label><input name="teachercorrect" type="radio" value="0" checked><span>A</span><input id="teacheranswer0" maxlength="160"></label>' +
            '<label><input name="teachercorrect" type="radio" value="1"><span>B</span><input id="teacheranswer1" maxlength="160"></label>' +
            '<label><input name="teachercorrect" type="radio" value="2"><span>C</span><input id="teacheranswer2" maxlength="160"></label>' +
            '<label><input name="teachercorrect" type="radio" value="3"><span>D</span><input id="teacheranswer3" maxlength="160"></label>' +
          '</fieldset>' +
          '<label class="teacherwide">Explanation<textarea id="teacherexplanation" maxlength="800" rows="4" placeholder="Why is the correct answer right?"></textarea></label>' +
          '<div id="teacherdeskstatus"></div>' +
          '<div class="teacherform-actions"><button id="teacherclear" type="button">NEW QUESTION</button><button id="teachersavecopy" type="button">SAVE AS NEW</button><button id="teachersave" type="submit">SAVE QUESTION</button></div>' +
        '</form>' +
      '</main>' +
    '</div>';
  desk.dataset.ready = '1';
}

function ensureEntryButton() {
  let button = byId('teacherdeskbtn');
  if (button) return button;
  const actions = typeof document === 'undefined' ? null : document.querySelector('.account-actions');
  const logout = byId('logoutbtn');
  if (!actions || !logout) return null;
  button = document.createElement('button');
  button.id = 'teacherdeskbtn';
  button.className = 'hidden';
  button.type = 'button';
  button.disabled = true;
  button.hidden = true;
  button.textContent = 'TEACHER DASHBOARD';
  actions.insertBefore(button, logout);
  return button;
}

function initElements() {
  ensureShell();
  if (!standalone) ensureEntryButton();
  for (const id of [
    'teacherdeskbtn', 'teacherdesk', 'teacherclose', 'teacherrefresh', 'teachersubject', 'teacherclass',
    'teacherstatusfilter', 'teachersearch', 'teacherquestioncount', 'teacherdraftcount', 'teacherapprovedcount',
    'teacherquestionlist', 'teacherquestionform', 'teacherquestionid', 'teachertopic', 'teacherstage',
    'teacherdifficulty', 'teacherspec', 'teacherreview', 'teacheractive', 'teacherprompt', 'teacheranswer0',
    'teacheranswer1', 'teacheranswer2', 'teacheranswer3', 'teacherexplanation', 'teacherdeskstatus',
    'teacherclear', 'teachersavecopy',
  ]) els[id] = byId(id);
  return !!((standalone || els.teacherdeskbtn) && els.teacherdesk && els.teacherquestionform);
}

function storedSession() {
  try { return typeof localStorage === 'undefined' ? '' : String(localStorage.getItem(sessionKey) || '').trim(); } catch (_) { return ''; }
}

function authHeaders(base = {}) {
  const token = storedSession();
  return token ? { ...base, Authorization: 'Bearer ' + token } : base;
}

function isTeacherAccount(account) {
  const role = String(account && (account.role || account.accountType) || '').trim().toLowerCase();
  const id = String(account && account.id || '').trim().toLowerCase();
  return role === 'teacher' || role === 'admin' || id.startsWith('teacher_');
}

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
}

function setStatus(text, kind = '') {
  if (!els.teacherdeskstatus) return;
  els.teacherdeskstatus.textContent = text || '';
  els.teacherdeskstatus.className = kind;
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

async function checkAccount() {
  if (!storedSession()) {
    state.account = null;
    updateEntryButton();
    return null;
  }
  try {
    const data = await requestJson('/auth/me');
    state.account = data.account || null;
  } catch (_) {
    state.account = null;
  }
  updateEntryButton();
  return state.account;
}

function updateEntryButton() {
  if (!els.teacherdeskbtn) return;
  const visible = isTeacherAccount(state.account);
  els.teacherdeskbtn.classList.toggle('hidden', !visible);
  els.teacherdeskbtn.hidden = !visible;
  els.teacherdeskbtn.disabled = !visible;
}

function subjectId() {
  return Math.max(0, Number(els.teachersubject && els.teachersubject.value || 0) | 0);
}

function clearSelect(select, emptyLabel) {
  if (!select) return;
  select.innerHTML = '';
  const opt = document.createElement('option');
  opt.value = '';
  opt.textContent = emptyLabel;
  select.appendChild(opt);
}

function renderSubjects() {
  clearSelect(els.teachersubject, state.subjects.length ? 'Choose subject' : 'No assigned subjects');
  for (const subject of state.subjects) {
    const opt = document.createElement('option');
    opt.value = String(subject.id);
    opt.textContent = subject.code ? subject.name + ' (' + subject.code + ')' : subject.name;
    els.teachersubject.appendChild(opt);
  }
  if (state.subjects.length) els.teachersubject.value = String(state.subjects[0].id);
}

function renderClasses() {
  clearSelect(els.teacherclass, state.classes.length ? 'All classes' : 'No classes');
  for (const row of state.classes) {
    const opt = document.createElement('option');
    opt.value = String(row.id);
    opt.textContent = row.joinCode ? row.name + ' - ' + row.joinCode : row.name;
    els.teacherclass.appendChild(opt);
  }
}

function filteredQuestions() {
  const needle = String(els.teachersearch && els.teachersearch.value || '').trim().toLowerCase();
  if (!needle) return state.questions.slice();
  return state.questions.filter(q => [q.topic, q.prompt, q.stage, q.spec].some(v => String(v || '').toLowerCase().includes(needle)));
}

function renderStats() {
  const all = state.questions;
  if (els.teacherquestioncount) els.teacherquestioncount.textContent = String(all.length);
  if (els.teacherdraftcount) els.teacherdraftcount.textContent = String(all.filter(q => q.reviewStatus === 'draft').length);
  if (els.teacherapprovedcount) els.teacherapprovedcount.textContent = String(all.filter(q => q.reviewStatus === 'approved').length);
}

function renderQuestionList() {
  renderStats();
  const list = els.teacherquestionlist;
  if (!list) return;
  const rows = filteredQuestions();
  if (!rows.length) {
    list.innerHTML = '<div class="teacherempty">No questions match this view.</div>';
    return;
  }
  list.innerHTML = rows.map(q =>
    '<button type="button" class="teacherquestion-row' + (q.id === state.selectedId ? ' selected' : '') + '" data-id="' + esc(q.id) + '">' +
      '<b>' + esc(q.prompt || 'Untitled question') + '</b>' +
      '<span>' + esc([q.topic || 'No topic', q.stage || 'No stage', 'Difficulty ' + (q.difficulty || 1)].join(' / ')) + '</span>' +
      '<i>' + esc(q.reviewStatus || 'draft') + (q.active ? '' : ' / inactive') + '</i>' +
    '</button>'
  ).join('');
  list.querySelectorAll('.teacherquestion-row').forEach(btn => btn.addEventListener('click', () => selectQuestion(Number(btn.dataset.id) || 0)));
}

function selectedQuestion() {
  return state.questions.find(q => q.id === state.selectedId) || null;
}

function setAnswer(index, value) {
  const input = els['teacheranswer' + index];
  if (input) input.value = value || '';
}

function selectQuestion(id) {
  state.selectedId = id;
  const q = selectedQuestion();
  if (!q) {
    clearForm();
    return;
  }
  els.teacherquestionid.value = String(q.id || '');
  els.teachertopic.value = q.topic || '';
  els.teacherstage.value = q.stage || '';
  els.teacherdifficulty.value = String(q.difficulty || 1);
  els.teacherspec.value = q.spec || '';
  els.teacherreview.value = q.reviewStatus || 'draft';
  els.teacheractive.checked = q.active !== false;
  els.teacherprompt.value = q.prompt || '';
  for (let i = 0; i < 4; i++) setAnswer(i, q.answers && q.answers[i]);
  const correct = document.querySelector('input[name="teachercorrect"][value="' + Math.max(0, Math.min(3, Number(q.correct) || 0)) + '"]');
  if (correct) correct.checked = true;
  els.teacherexplanation.value = q.explanation || '';
  setStatus('Editing question #' + q.id + '.', 'ok');
  renderQuestionList();
}

function clearForm() {
  state.selectedId = 0;
  if (!els.teacherquestionform) return;
  els.teacherquestionform.reset();
  els.teacherquestionid.value = '';
  els.teacherdifficulty.value = '1';
  els.teacherreview.value = 'draft';
  els.teacheractive.checked = true;
  const first = document.querySelector('input[name="teachercorrect"][value="0"]');
  if (first) first.checked = true;
  setStatus('');
  renderQuestionList();
}

function readForm() {
  const answers = [0, 1, 2, 3].map(i => String(els['teacheranswer' + i].value || '').trim());
  const uniqueAnswers = new Set(answers.map(v => v.toLowerCase()).filter(Boolean));
  const correct = Number((document.querySelector('input[name="teachercorrect"]:checked') || {}).value || 0) || 0;
  const prompt = String(els.teacherprompt.value || '').trim();
  const explanation = String(els.teacherexplanation.value || '').trim();
  if (prompt.length < 10) throw new Error('Question prompt needs at least 10 characters.');
  if (answers.some(v => !v) || uniqueAnswers.size !== 4) throw new Error('Add four unique answer choices.');
  if (explanation.length < 10) throw new Error('Add a short teaching explanation.');
  return {
    subjectId: subjectId(),
    topic: els.teachertopic.value,
    stage: els.teacherstage.value,
    difficulty: Number(els.teacherdifficulty.value) || 1,
    spec: els.teacherspec.value,
    prompt,
    answers,
    correct,
    explanation,
    reviewStatus: els.teacherreview.value,
    active: !!els.teacheractive.checked,
  };
}

async function loadSubjects() {
  setStatus('Loading teacher subjects...');
  const data = await requestJson('/auth/teacher/subjects');
  state.subjects = data.subjects || [];
  renderSubjects();
  if (!state.subjects.length) {
    state.classes = [];
    state.questions = [];
    renderClasses();
    renderQuestionList();
    setStatus('No subjects are assigned to this teacher account.', 'bad');
    return;
  }
  await loadSubjectData();
}

async function loadSubjectData() {
  const id = subjectId();
  if (!id) return;
  const status = String(els.teacherstatusfilter && els.teacherstatusfilter.value || '');
  const suffix = '?subjectId=' + encodeURIComponent(id) + (status ? '&reviewStatus=' + encodeURIComponent(status) : '');
  setStatus('Loading questions...');
  const [classesData, questionsData] = await Promise.all([
    requestJson('/auth/teacher/classes?subjectId=' + encodeURIComponent(id)),
    requestJson('/auth/teacher/game-questions' + suffix),
  ]);
  state.classes = classesData.classes || [];
  state.questions = questionsData.questions || [];
  renderClasses();
  renderQuestionList();
  if (state.selectedId && !selectedQuestion()) clearForm();
  setStatus('Question bank ready.', 'ok');
}

async function saveQuestion(copy = false) {
  if (state.busy) return;
  state.busy = true;
  try {
    const body = readForm();
    const existingId = Number(els.teacherquestionid.value || 0) || 0;
    const path = existingId && !copy ? '/auth/teacher/game-questions/' + encodeURIComponent(existingId) : '/auth/teacher/game-questions';
    setStatus(existingId && !copy ? 'Updating question...' : 'Creating question...');
    const data = await requestJson(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await loadSubjectData();
    if (data.question && data.question.id) selectQuestion(Number(data.question.id));
    setStatus('Question saved.', 'ok');
  } catch (e) {
    setStatus(e.message || 'Could not save question.', 'bad');
  } finally {
    state.busy = false;
  }
}

async function openDesk() {
  await checkAccount();
  if (!isTeacherAccount(state.account)) {
    setStatus('Teacher account required.', 'bad');
    return;
  }
  state.open = true;
  if (!standalone) els.teacherdesk.classList.remove('hidden');
  try { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); } catch (_) {}
  document.body.classList.add('game-modal-open');
  try {
    await loadSubjects();
  } catch (e) {
    setStatus(e.message || 'Could not load teacher dashboard.', 'bad');
  }
}

function closeDesk() {
  state.open = false;
  if (standalone) {
    location.href = './';
    return;
  }
  els.teacherdesk.classList.add('hidden');
  document.body.classList.remove('game-modal-open');
}

function bindEvents() {
  if (els.teacherdeskbtn) els.teacherdeskbtn.addEventListener('click', () => { location.href = './teacher.html'; });
  els.teacherclose.addEventListener('click', closeDesk);
  els.teacherrefresh.addEventListener('click', () => loadSubjectData().catch(e => setStatus(e.message || 'Refresh failed.', 'bad')));
  els.teachersubject.addEventListener('change', () => { clearForm(); loadSubjectData().catch(e => setStatus(e.message || 'Could not load subject.', 'bad')); });
  els.teacherstatusfilter.addEventListener('change', () => loadSubjectData().catch(e => setStatus(e.message || 'Could not load status.', 'bad')));
  els.teachersearch.addEventListener('input', renderQuestionList);
  els.teacherclear.addEventListener('click', clearForm);
  els.teachersavecopy.addEventListener('click', () => saveQuestion(true));
  els.teacherquestionform.addEventListener('submit', e => { e.preventDefault(); saveQuestion(false); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.open) closeDesk();
  });
  const play = byId('playbtn');
  const logout = byId('logoutbtn');
  if (play) play.addEventListener('click', () => setTimeout(checkAccount, 900));
  if (logout) logout.addEventListener('click', () => setTimeout(checkAccount, 300));
}

export function initTeacherTools() {
  if (!initElements()) return null;
  bindEvents();
  updateEntryButton();
  if (standalone) openDesk().catch(e => setStatus(e.message || 'Could not load teacher dashboard.', 'bad'));
  else checkAccount().catch(() => updateEntryButton());
  setInterval(() => {
    if (!state.open && !standalone) checkAccount().catch(() => updateEntryButton());
  }, 5000);
  return { state, open: openDesk, close: closeDesk, refresh: loadSubjectData };
}

export const api = initTeacherTools();
