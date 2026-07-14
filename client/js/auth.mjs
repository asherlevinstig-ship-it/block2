export function createAuthController({ user, password, playerName, status, play, register, logout, request = fetch, apiUrl = path => path }) {
  const state = { checked: false, account: null, busy: false };
  const cleanHunterName = value => String(value || '').replace(/[^A-Za-z0-9 _-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);

  function setStatus(text, kind = '') {
    status.textContent = text || '';
    status.className = kind;
  }

  function render() {
    const signed = !!state.account;
    user.classList.toggle('hidden', signed);
    password.classList.toggle('hidden', signed);
    register.classList.add('hidden');
    register.hidden = true;
    logout.classList.toggle('hidden', !signed);
    play.textContent = signed ? 'PLAY' : 'SIGN IN & PLAY';
    if (signed) {
      setStatus(cleanHunterName(playerName.value) ? 'SIGNED IN AS ' + state.account.username.toUpperCase() : 'CHOOSE YOUR HUNTER NAME', cleanHunterName(playerName.value) ? 'ok' : '');
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
    try { state.account = (await json('/auth/me')).account || null; }
    catch (_) { state.account = null; }
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
      state.account = (await json('/auth/login', { username, password: secret })).account;
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
    state.checked = true;
    render();
    setStatus('SIGNED OUT');
  }

  function expire(message = 'SESSION EXPIRED - SIGN IN AGAIN') {
    state.account = null;
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
    return name;
  }

  return { state, setStatus, render, json, check, authenticate, signOut, expire, requireHunterName };
}
