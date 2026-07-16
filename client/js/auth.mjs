export function createAuthController({ user, password, playerName, status, play, register, logout, request = fetch, apiUrl = path => path }) {
  const state = { checked: false, account: null, gameProfile: null, busy: false };
  const cleanHunterName = value => String(value || '').replace(/[^A-Za-z0-9 _-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  const hunterSetup = typeof document === 'undefined' ? null : document.getElementById('huntersetup');
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

  function hasHunterName() {
    return !!(state.gameProfile && state.gameProfile.nameSet);
  }

  function setStatus(text, kind = '') {
    status.textContent = text || '';
    status.className = kind;
  }

  function render() {
    const signed = !!state.account;
    user.classList.toggle('hidden', signed);
    password.classList.toggle('hidden', signed);
    if (hunterSetup) hunterSetup.classList.toggle('hidden', !signed || hasHunterName());
    register.classList.add('hidden');
    register.hidden = true;
    logout.classList.toggle('hidden', !signed);
    play.textContent = signed && !hasHunterName() ? 'SAVE HUNTER NAME' : signed ? 'PLAY' : 'SIGN IN & PLAY';
    if (signed) {
      if (hasHunterName()) setStatus('SIGNED IN AS ' + state.account.username.toUpperCase(), 'ok');
      else setStatus('CHOOSE YOUR HUNTER NAME');
    }
  }

  async function json(url, body) {
    const res = await request(apiUrl(url), {
      method: body ? 'POST' : 'GET', credentials: 'include',
      headers: authHeaders(body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(data.error || 'Authentication failed');
    return data;
  }

  async function check() {
    if (state.checked) return state.account;
    state.checked = true;
    try {
      const data = await json('/auth/me');
      if (data.sessionToken) storeSession(data.sessionToken);
      state.account = data.account || null;
      state.gameProfile = data.gameProfile || null;
      if (state.gameProfile && state.gameProfile.name) playerName.value = state.gameProfile.name;
    } catch (_) { state.account = null; state.gameProfile = null; }
    render();
    return state.account;
  }

  async function authenticate(create = false) {
    await check();
    if (state.account) return true;
    const username = (user.value || '').trim();
    const secret = password.value || '';
    if (!username || !secret) {
      setStatus('ENTER YOUR EMAIL AND PASSWORD', 'bad');
      return false;
    }
    setStatus('SIGNING IN...');
    try {
      const data = await json('/auth/login', { username, password: secret });
      if (data.sessionToken) storeSession(data.sessionToken);
      state.account = data.account;
      state.gameProfile = data.gameProfile || null;
      if (state.gameProfile && state.gameProfile.name) playerName.value = state.gameProfile.name;
      password.value = '';
      render();
      return true;
    } catch (e) {
      setStatus(e.message, 'bad');
      return false;
    }
  }

  async function signOut() {
    try { await json('/auth/logout', {}); } catch (_) {}
    storeSession('');
    state.account = null;
    state.gameProfile = null;
    state.checked = true;
    render();
    setStatus('SIGNED OUT');
  }

  async function resetPlayerProfile({ target, token } = {}) {
    const value = String(target || '').trim();
    const adminToken = String(token || '').trim();
    if (!adminToken) throw new Error('Admin reset token required');
    const body = value && value.includes('@') ? { email: value }
      : value ? { accountId: value }
        : state.account && state.account.id ? { accountId: state.account.id }
          : {};
    if (!body.email && !body.accountId) throw new Error('Sign in or enter an email/account id');
    const res = await request(apiUrl('/auth/admin/reset-player'), {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders({ 'Content-Type': 'application/json', 'x-admin-reset-token': adminToken }),
      body: JSON.stringify(body),
    });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(data.error || 'Reset failed');
    state.account = null;
    state.gameProfile = null;
    state.checked = false;
    storeSession('');
    render();
    return data;
  }

  function expire(message = 'SESSION EXPIRED - SIGN IN AGAIN') {
    state.account = null;
    state.gameProfile = null;
    state.checked = false;
    storeSession('');
    render();
    setStatus(message, 'bad');
  }

  function requireHunterName() {
    const name = cleanHunterName(playerName.value);
    if (!name) {
      setStatus('CHOOSE YOUR HUNTER NAME', 'bad');
      playerName.focus();
      return '';
    }
    if (playerName.value !== name) playerName.value = name;
    state.gameProfile = { name, nameSet: true };
    render();
    return name;
  }

  async function saveHunterName(name) {
    const clean = cleanHunterName(name);
    if (!clean) throw new Error('Choose your hunter name');
    const data = await json('/auth/profile/name', { name: clean });
    state.gameProfile = data.gameProfile || { name: clean, nameSet: true };
    if (state.gameProfile && state.gameProfile.name) playerName.value = state.gameProfile.name;
    render();
    return state.gameProfile;
  }

  return { state, setStatus, render, json, check, authenticate, signOut, expire, requireHunterName, hasHunterName, resetPlayerProfile, saveHunterName };
}
