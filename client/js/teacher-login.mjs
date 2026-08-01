import { apiUrl } from './config.mjs';

const sessionKey = 'blockcraft.auth.session';
const form = document.getElementById('teacherLoginForm');
const email = document.getElementById('teacherEmail');
const password = document.getElementById('teacherPassword');
const toggle = document.getElementById('teacherPasswordToggle');
const status = document.getElementById('teacherLoginStatus');
const submit = document.getElementById('teacherLoginButton');
const recoveryLink = document.getElementById('teacherForgotPassword');
const recoveryUrl = 'https://compscigo.com/forgot_password.php?type=teacher&source=blockcraft';

function storeSession(token) {
  try {
    const clean = String(token || '').trim();
    if (clean) localStorage.setItem(sessionKey, clean);
    else localStorage.removeItem(sessionKey);
  } catch (_) {}
}

function clearReconnectTokens() {
  try {
    sessionStorage.removeItem('bc_reconnect_token');
    sessionStorage.removeItem('bc_reconnect_token:auth');
  } catch (_) {}
}

function setStatus(message, kind = '') {
  if (!status) return;
  status.textContent = message || '';
  status.classList.toggle('bad', kind === 'bad');
  status.classList.toggle('ok', kind === 'ok');
}

function isTeacherAccount(account) {
  const role = String(account && (account.role || account.accountType) || '').trim().toLowerCase();
  const id = String(account && account.id || '').trim().toLowerCase();
  return role === 'teacher' || role === 'admin' || id.startsWith('teacher_');
}

async function clearServerCookie() {
  try {
    await fetch(apiUrl('/auth/logout'), { method: 'POST', credentials: 'include' });
  } catch (_) {}
}

async function loginTeacher(event) {
  event.preventDefault();
  const username = String(email && email.value || '').trim();
  const secret = String(password && password.value || '');
  if (!username || !secret) {
    setStatus('Enter your teacher email and password.', 'bad');
    return;
  }
  if (submit) submit.disabled = true;
  setStatus('Signing in...');
  try {
    storeSession('');
    clearReconnectTokens();
    await clearServerCookie();
    const res = await fetch(apiUrl('/auth/login'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: secret }),
    });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(data.error || 'Teacher login failed.');
    if (!isTeacherAccount(data.account)) {
      storeSession('');
      await clearServerCookie();
      throw new Error('That account is not linked to a teacher dashboard.');
    }
    if (data.sessionToken) storeSession(data.sessionToken);
    if (password) password.value = '';
    setStatus('Signed in. Opening dashboard...', 'ok');
    location.href = './teacher.html?teacher_login=1';
  } catch (error) {
    setStatus(error && error.message || 'Could not sign in.', 'bad');
  } finally {
    if (submit) submit.disabled = false;
  }
}

function initPasswordToggle() {
  if (!toggle || !password) return;
  toggle.addEventListener('click', () => {
    const visible = password.type === 'text';
    password.type = visible ? 'password' : 'text';
    toggle.textContent = visible ? 'SHOW' : 'HIDE';
    toggle.setAttribute('aria-pressed', visible ? 'false' : 'true');
  });
}

function updateRecoveryLink() {
  if (!recoveryLink) return;
  const username = String(email && email.value || '').trim().toLowerCase();
  const url = new URL(recoveryUrl);
  if (username) url.searchParams.set('email', username);
  recoveryLink.href = url.toString();
}

storeSession('');
clearReconnectTokens();
initPasswordToggle();
updateRecoveryLink();
if (form) form.addEventListener('submit', loginTeacher);
if (email) email.addEventListener('input', updateRecoveryLink);
