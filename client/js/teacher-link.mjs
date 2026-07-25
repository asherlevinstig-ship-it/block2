import { apiUrl } from './config.mjs';

const sessionKey = 'blockcraft.auth.session';

function byId(id) {
  return typeof document === 'undefined' ? null : document.getElementById(id);
}

function storedSession() {
  try { return typeof localStorage === 'undefined' ? '' : String(localStorage.getItem(sessionKey) || '').trim(); } catch (_) { return ''; }
}

function isTeacherAccount(account) {
  const role = String(account && (account.role || account.accountType) || '').trim().toLowerCase();
  const id = String(account && account.id || '').trim().toLowerCase();
  return role === 'teacher' || role === 'admin' || id.startsWith('teacher_');
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
  button.addEventListener('click', () => { location.href = './teacher.html'; });
  actions.insertBefore(button, logout);
  return button;
}

function setButtonVisible(button, visible) {
  if (!button) return;
  button.classList.toggle('hidden', !visible);
  button.hidden = !visible;
  button.disabled = !visible;
}

async function checkTeacherAccess(button) {
  const token = storedSession();
  if (!token) {
    setButtonVisible(button, false);
    return null;
  }
  try {
    const res = await fetch(apiUrl('/auth/me'), {
      credentials: 'include',
      headers: { Authorization: 'Bearer ' + token },
    });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    const account = res.ok ? data.account : null;
    setButtonVisible(button, isTeacherAccount(account));
    return account;
  } catch (_) {
    setButtonVisible(button, false);
    return null;
  }
}

export function initTeacherDashboardLink() {
  const button = ensureEntryButton();
  if (!button) return null;
  checkTeacherAccess(button);
  const play = byId('playbtn');
  const logout = byId('logoutbtn');
  if (play) play.addEventListener('click', () => setTimeout(() => checkTeacherAccess(button), 900));
  if (logout) logout.addEventListener('click', () => setTimeout(() => checkTeacherAccess(button), 300));
  setInterval(() => checkTeacherAccess(button), 5000);
  return { refresh: () => checkTeacherAccess(button) };
}

export const api = initTeacherDashboardLink();
