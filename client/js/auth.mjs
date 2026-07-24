export function createAuthController({ user, password, playerName, status, play, register, logout, request = fetch, apiUrl = path => path }) {
  const state = { checked: false, account: null, gameProfile: null, busy: false };
  const cleanHunterName = value => String(value || '').replace(/[^A-Za-z0-9 _-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  const hunterSetup = typeof document === 'undefined' ? null : document.getElementById('huntersetup');
  const appearanceSystem = typeof globalThis === 'undefined' ? null : globalThis.BlockcraftAppearanceSystem;
  const sanitizeAppearance = value => appearanceSystem && appearanceSystem.sanitizeAppearance
    ? appearanceSystem.sanitizeAppearance(value)
    : { skin:'#c98952', hair:'#e7d574', face:'#185f68', shirt:'#26283f', pants:'#17182a', accent:'#8f6aa7' };
  let draftAppearance = sanitizeAppearance(null);
  const sessionKey = 'blockcraft.auth.session';
  const creator = typeof document === 'undefined' ? null : ensureCharacterCreator();

  function ensureCharacterCreator() {
    if (!hunterSetup) return null;
    let el = document.getElementById('charactercreator');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'charactercreator';
    el.className = 'character-creator';
    hunterSetup.appendChild(el);
    return el;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
  }

  function paletteButton(key, color) {
    const selected = draftAppearance[key] === color ? ' selected' : '';
    return '<button type="button" class="ccswatch'+selected+'" data-key="'+esc(key)+'" data-color="'+esc(color)+'" style="--swatch:'+esc(color)+'" aria-label="'+esc(key)+' '+esc(color)+'"></button>';
  }

  function renderCharacterCreator(mode = 'setup') {
    if (!creator || !appearanceSystem) return;
    const p = appearanceSystem.PALETTES;
    creator.dataset.mode = mode;
    creator.innerHTML =
      '<div class="cchead"><b>'+(mode === 'mirror' ? 'MIRROR APPEARANCE' : 'CUSTOMIZE YOUR HUNTER')+'</b><span>Saved to your profile</span></div>'+
      '<div class="ccbody">'+
        '<div class="ccpreview" style="--skin:'+esc(draftAppearance.skin)+';--hair:'+esc(draftAppearance.hair)+';--eyes:'+esc(draftAppearance.face)+';--shirt:'+esc(draftAppearance.shirt)+';--pants:'+esc(draftAppearance.pants)+';--accent:'+esc(draftAppearance.accent)+'">'+
          '<i class="ccshadow"></i><i class="cclegs"></i><i class="cctunic"></i><i class="ccbelt"></i><i class="ccheadpix"></i><i class="cchair"></i><i class="cceyes"></i><i class="ccaccent"></i>'+
        '</div>'+
        '<div class="cccontrols">'+
          [['skin','Skin'],['hair','Hair'],['face','Eyes'],['shirt','Coat'],['pants','Pants'],['accent','Accent']].map(([key,label])=>
            '<div class="ccrow"><span>'+label+'</span><div>'+p[key].map(color=>paletteButton(key,color)).join('')+'</div></div>'
          ).join('')+
        '</div>'+
      '</div>'+
      (mode === 'mirror' ? '<div class="ccactions"><button type="button" id="ccsave">SAVE LOOK</button><button type="button" id="cccancel">CLOSE</button></div>' : '');
    creator.querySelectorAll('.ccswatch').forEach(btn => btn.addEventListener('click', () => {
      draftAppearance = sanitizeAppearance({ ...draftAppearance, [btn.dataset.key]: btn.dataset.color });
      renderCharacterCreator(mode);
    }));
    const save = creator.querySelector('#ccsave');
    if (save) save.addEventListener('click', () => saveAppearance(draftAppearance, { mirror: true }).catch(e => setStatus(e.message || 'COULD NOT SAVE APPEARANCE', 'bad')));
    const cancel = creator.querySelector('#cccancel');
    if (cancel) cancel.addEventListener('click', () => closeAppearanceEditor());
  }

  function setAppearance(value) {
    draftAppearance = sanitizeAppearance(value);
    if (state.gameProfile) state.gameProfile.appearance = draftAppearance;
    renderCharacterCreator(creator && creator.dataset.mode === 'mirror' ? 'mirror' : 'setup');
  }

  function closeAppearanceEditor() {
    if (!creator) return;
    creator.classList.remove('floating');
    if (typeof document !== 'undefined') document.body.classList.remove('game-modal-open');
    creator.classList.toggle('hidden', !!(state.gameProfile && state.gameProfile.nameSet));
    creator.dataset.mode = 'setup';
    renderCharacterCreator('setup');
  }

  function openAppearanceEditor(mode = 'mirror') {
    if (!creator) return false;
    setAppearance(state.gameProfile && state.gameProfile.appearance || draftAppearance);
    creator.classList.remove('hidden');
    creator.classList.toggle('floating', mode === 'mirror');
    if (typeof document !== 'undefined') document.body.classList.toggle('game-modal-open', mode === 'mirror');
    renderCharacterCreator(mode);
    return true;
  }

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

  function clearWorldSession() {
    try {
      if (typeof sessionStorage === 'undefined') return;
      sessionStorage.removeItem('bc_reconnect_token');
      sessionStorage.removeItem('bc_reconnect_token:auth');
    } catch (_) {}
  }

  function authHeaders(base = {}) {
    const token = storedSession();
    return token ? { ...base, Authorization: 'Bearer ' + token } : base;
  }

  function hasHunterName() {
    return !!(state.gameProfile && state.gameProfile.nameSet);
  }

  function isAdminAccount() {
    const account = state.account || {};
    const username = String(account.username || '').trim().toLowerCase();
    const role = String(account.role || account.accountType || '').trim().toLowerCase();
    return username === 'asherlevin85@gmail.com' || role === 'admin';
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
    if (creator) {
      creator.classList.toggle('hidden', !signed || hasHunterName());
      renderCharacterCreator('setup');
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
      setAppearance(state.gameProfile && state.gameProfile.appearance);
      if (state.gameProfile && state.gameProfile.name) playerName.value = state.gameProfile.name;
      else if (state.account) playerName.value = '';
    } catch (_) { state.account = null; state.gameProfile = null; }
    render();
    return state.account;
  }

  async function authenticate(create = false) {
    await check();
    const username = (user.value || '').trim();
    const secret = password.value || '';
    if (state.account) {
      const signedUsername = String(state.account.username || '').trim().toLowerCase();
      const wantedUsername = username.toLowerCase();
      if (!wantedUsername || wantedUsername === signedUsername) return true;
      storeSession('');
      clearWorldSession();
      state.account = null;
      state.gameProfile = null;
      state.checked = true;
    }
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
      setAppearance(state.gameProfile && state.gameProfile.appearance);
      if (state.gameProfile && state.gameProfile.name) playerName.value = state.gameProfile.name;
      else playerName.value = '';
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
    clearWorldSession();
    state.account = null;
    state.gameProfile = null;
    state.checked = true;
    render();
    setStatus('SIGNED OUT');
  }

  function adminApiUrl(path) {
    try {
      const local = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
      if (local) return path;
    } catch (_) {}
    return apiUrl(path);
  }

  async function resetPlayerProfile({ target, token } = {}) {
    const value = String(target || '').trim();
    const adminToken = String(token || '').trim();
    const body = value && value.includes('@') ? { email: value }
      : value ? { accountId: value }
        : state.account && state.account.id ? { accountId: state.account.id }
          : {};
    if (!body.email && !body.accountId) throw new Error('Sign in or enter an email/account id');
    const res = await request(adminApiUrl('/auth/admin/reset-player'), {
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
    clearWorldSession();
    render();
    return data;
  }

  function adminTargetBody(target) {
    const value = String(target || '').trim();
    return value && value.includes('@') ? { email: value }
      : value ? { accountId: value }
        : state.account && state.account.id ? { accountId: state.account.id }
          : {};
  }

  async function adminRequest(url, { target, token, body = {} } = {}) {
    const adminToken = String(token || '').trim();
    const targetBody = adminTargetBody(target);
    if (!targetBody.email && !targetBody.accountId) throw new Error('Sign in or enter an email/account id');
    const res = await request(adminApiUrl(url), {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders({ 'Content-Type': 'application/json', 'x-admin-reset-token': adminToken }),
      body: JSON.stringify({ ...targetBody, ...(body || {}) }),
    });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(data.error || 'Admin action failed');
    return data;
  }

  async function adminInspectPlayer({ target, token, details = true } = {}) {
    return adminRequest('/auth/admin/player-profile', { target, token, body: { details: details === true } });
  }

  async function adminPatchPlayer({ target, token, patch = {} } = {}) {
    return adminRequest('/auth/admin/player-profile/patch', { target, token, body: patch });
  }

  function expire(message = 'SESSION EXPIRED - SIGN IN AGAIN') {
    state.account = null;
    state.gameProfile = null;
    state.checked = false;
    storeSession('');
    clearWorldSession();
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
    state.gameProfile.appearance = draftAppearance;
    render();
    return name;
  }

  async function saveHunterName(name) {
    const clean = cleanHunterName(name);
    if (!clean) throw new Error('Choose your hunter name');
    const data = await json('/auth/profile/name', { name: clean });
    state.gameProfile = data.gameProfile || { name: clean, nameSet: true };
    setAppearance(state.gameProfile && state.gameProfile.appearance);
    if (state.gameProfile && state.gameProfile.name) playerName.value = state.gameProfile.name;
    render();
    return state.gameProfile;
  }

  async function saveHunterProfile(name, appearance = draftAppearance) {
    const clean = cleanHunterName(name);
    if (!clean) throw new Error('Choose your hunter name');
    const data = await json('/auth/profile', { name: clean, appearance: sanitizeAppearance(appearance) });
    state.gameProfile = data.gameProfile || { name: clean, nameSet: true, appearance: sanitizeAppearance(appearance) };
    setAppearance(state.gameProfile.appearance);
    if (state.gameProfile && state.gameProfile.name) playerName.value = state.gameProfile.name;
    render();
    return state.gameProfile;
  }

  async function saveAppearance(appearance = draftAppearance, options = {}) {
    const data = await json('/auth/profile/appearance', { appearance: sanitizeAppearance(appearance) });
    state.gameProfile = data.gameProfile || { ...(state.gameProfile || {}), appearance: sanitizeAppearance(appearance) };
    setAppearance(state.gameProfile.appearance);
    render();
    if (options.mirror) {
      setStatus('APPEARANCE SAVED', 'ok');
      closeAppearanceEditor();
    }
    return state.gameProfile;
  }

  setAppearance(null);
  return { state, setStatus, render, json, check, authenticate, signOut, expire, requireHunterName, hasHunterName, isAdminAccount, resetPlayerProfile, adminInspectPlayer, adminPatchPlayer, saveHunterName, saveHunterProfile, saveAppearance, openAppearanceEditor, closeAppearanceEditor, currentAppearance: () => sanitizeAppearance(draftAppearance) };
}
