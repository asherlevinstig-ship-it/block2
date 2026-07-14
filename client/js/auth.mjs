export function createAuthController({ user, password, playerName, status, play, register, logout, request = fetch, apiUrl = path => path }) {
  const state = { checked: false, account: null, gameProfile: null, busy: false };
  const cleanHunterName = value => String(value || '').replace(/[^A-Za-z0-9 _-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  const hunterSetup = typeof document === 'undefined' ? null : document.getElementById('huntersetup');

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
      headers: body ? { 'Content-Type': 'application/json' } : {},
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
      setStatus('ENTER YOUR SCHOOL EMAIL AND PASSWORD', 'bad');
      return false;
    }
    setStatus('SIGNING IN...');
    try {
      const data = await json('/auth/login', { username, password: secret });
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
    state.account = null;
    state.gameProfile = null;
    state.checked = true;
    render();
    setStatus('SIGNED OUT');
  }

  function expire(message = 'SESSION EXPIRED - SIGN IN AGAIN') {
    state.account = null;
    state.gameProfile = null;
    state.checked = false;
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

  return { state, setStatus, render, json, check, authenticate, signOut, expire, requireHunterName, hasHunterName };
}
