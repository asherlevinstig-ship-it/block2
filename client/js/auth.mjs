export function createAuthController({ user, password, playerName, status, play, register, logout, request = fetch }) {
  const state = { checked: false, account: null, busy: false };

  function setStatus(text, kind = '') {
    status.textContent = text || '';
    status.className = kind;
  }

  function render() {
    const signed = !!state.account;
    user.classList.toggle('hidden', signed);
    password.classList.toggle('hidden', signed);
    register.classList.toggle('hidden', signed);
    logout.classList.toggle('hidden', !signed);
    play.textContent = signed ? 'PLAY' : 'SIGN IN & PLAY';
    if (signed) {
      setStatus('SIGNED IN AS ' + state.account.username.toUpperCase(), 'ok');
      if (!playerName.value) playerName.value = state.account.displayName || 'Hunter';
    }
  }

  async function json(url, body) {
    const res = await request(url, {
      method: body ? 'POST' : 'GET', credentials: 'same-origin',
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
    const displayName = (playerName.value || 'Hunter').slice(0, 16);
    if (!username || !secret) {
      setStatus('ENTER YOUR USERNAME AND PASSWORD', 'bad');
      return false;
    }
    setStatus(create ? 'CREATING ACCOUNT...' : 'SIGNING IN...');
    try {
      state.account = (await json(create ? '/auth/register' : '/auth/login', { username, password: secret, displayName })).account;
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

  return { state, setStatus, render, json, check, authenticate, signOut, expire };
}
