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

  function mirrorOpen() {
    return !!(creator && creator.dataset.mode === 'mirror' && creator.classList.contains('floating'));
  }

  function mountCharacterCreator(mode = 'setup') {
    if (!creator) return;
    const target = mode === 'mirror' && typeof document !== 'undefined' ? document.body : hunterSetup;
    if (target && creator.parentElement !== target) target.appendChild(creator);
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
  }

  const colorNames = {
    '#8a5a3c':'Umber', '#a96f46':'Copper', '#c98952':'Honey', '#e0ad76':'Sand', '#f0c997':'Rose', '#6b3f2c':'Walnut',
    '#2b1b14':'Black', '#5a3320':'Brown', '#8b5a2b':'Auburn', '#e7d574':'Blond', '#d6d9e6':'Silver', '#7b3f63':'Wine',
    '#185f68':'Teal', '#315f9f':'Blue', '#3b7f52':'Green', '#6b4a9c':'Violet', '#7a3d38':'Amber', '#1f2937':'Slate',
    '#26283f':'Night', '#3a6ea8':'Azure', '#7d3155':'Rosewood', '#14532d':'Grove', '#7c2d12':'Ember', '#374151':'Steel',
    '#17182a':'Ink', '#24324a':'Navy', '#2f3326':'Olive', '#3a2a1e':'Leather', '#321f2c':'Plum', '#111827':'Black',
    '#8f6aa7':'Aether', '#9bdcff':'Sky', '#ffd27a':'Gold', '#65d982':'Leaf', '#ff9a42':'Flame', '#f472b6':'Bloom',
  };
  const styleLabels = {
    hairStyle:{ windswept:'Windswept', cropped:'Cropped', long:'Long', braided:'Braided' },
    outfitStyle:{ tunic:'Tunic', coat:'Coat', tabard:'Tabard', wanderer:'Wanderer' },
    accessory:{ ribbon:'Ribbon', headband:'Headband', scarf:'Scarf', none:'None' },
  };
  const presets = [
    { id:'ranger', name:'Grove Ranger', look:{ skin:'#c98952', hair:'#5a3320', face:'#3b7f52', shirt:'#14532d', pants:'#2f3326', accent:'#65d982', hairStyle:'braided', outfitStyle:'wanderer', accessory:'scarf' } },
    { id:'knight', name:'Gate Knight', look:{ skin:'#e0ad76', hair:'#2b1b14', face:'#315f9f', shirt:'#26283f', pants:'#17182a', accent:'#ffd27a', hairStyle:'cropped', outfitStyle:'tabard', accessory:'headband' } },
    { id:'arcanist', name:'Arcane Adept', look:{ skin:'#f0c997', hair:'#d6d9e6', face:'#6b4a9c', shirt:'#3a6ea8', pants:'#24324a', accent:'#9bdcff', hairStyle:'long', outfitStyle:'coat', accessory:'ribbon' } },
    { id:'shadow', name:'Night Hunter', look:{ skin:'#8a5a3c', hair:'#7b3f63', face:'#1f2937', shirt:'#374151', pants:'#111827', accent:'#f472b6', hairStyle:'windswept', outfitStyle:'coat', accessory:'none' } },
  ];

  function optionLabel(key, value) {
    return (styleLabels[key] && styleLabels[key][value]) || String(value || '').replace(/_/g, ' ');
  }

  function paletteButton(key, color) {
    const selected = draftAppearance[key] === color ? ' selected' : '';
    const name = colorNames[String(color || '').toLowerCase()] || color;
    return '<button type="button" class="ccswatch'+selected+'" data-key="'+esc(key)+'" data-color="'+esc(color)+'" style="--swatch:'+esc(color)+'" aria-label="'+esc(key)+' '+esc(name)+'" title="'+esc(name)+'"><i></i><span>'+esc(name)+'</span></button>';
  }

  function styleButton(key, value) {
    const selected = draftAppearance[key] === value ? ' selected' : '';
    return '<button type="button" class="ccstyle'+selected+'" data-key="'+esc(key)+'" data-value="'+esc(value)+'">'+esc(optionLabel(key, value))+'</button>';
  }

  function previewFigure(side) {
    const back = side === 'back';
    return '<div class="ccpreview '+(back?'back':'front')+'" style="--skin:'+esc(draftAppearance.skin)+';--hair:'+esc(draftAppearance.hair)+';--eyes:'+esc(draftAppearance.face)+';--shirt:'+esc(draftAppearance.shirt)+';--pants:'+esc(draftAppearance.pants)+';--accent:'+esc(draftAppearance.accent)+'" data-hair="'+esc(draftAppearance.hairStyle)+'" data-outfit="'+esc(draftAppearance.outfitStyle)+'" data-accessory="'+esc(draftAppearance.accessory)+'">'+
      '<i class="ccshadow"></i><i class="cccape"></i><i class="cclegs"></i><i class="cctunic"></i><i class="cctabard"></i><i class="ccbelt"></i><i class="ccscarf"></i><i class="ccheadpix"></i><i class="cchair"></i><i class="cchair2"></i><i class="cceyes"></i><i class="ccheadband"></i><i class="ccaccent"></i>'+
    '</div>';
  }

  function randomAppearance() {
    const p = appearanceSystem.PALETTES;
    const o = appearanceSystem.OPTIONS || {};
    const pick = list => list[Math.floor(Math.random() * list.length)];
    return sanitizeAppearance({
      skin:pick(p.skin), hair:pick(p.hair), face:pick(p.face), shirt:pick(p.shirt), pants:pick(p.pants), accent:pick(p.accent),
      hairStyle:pick(o.hairStyle || ['windswept']), outfitStyle:pick(o.outfitStyle || ['tunic']), accessory:pick(o.accessory || ['ribbon']),
    });
  }

  function renderCharacterCreator(mode = 'setup') {
    if (!creator || !appearanceSystem) return;
    const p = appearanceSystem.PALETTES;
    const o = appearanceSystem.OPTIONS || {};
    creator.dataset.mode = mode;
    creator.innerHTML =
      '<div class="cchead"><div><small>'+(mode === 'mirror' ? 'CRAFTED MIRROR' : 'HUNTER REGISTRY')+'</small><b>'+(mode === 'mirror' ? 'REFINE YOUR LOOK' : 'CUSTOMIZE YOUR HUNTER')+'</b></div><span>Saved to your profile</span></div>'+
      '<div class="ccbody">'+
        '<div class="ccstage"><div class="ccmirrorglow"></div><div class="ccfigures">'+previewFigure('front')+previewFigure('back')+'</div><div class="cclookname">'+esc(optionLabel('hairStyle', draftAppearance.hairStyle))+' / '+esc(optionLabel('outfitStyle', draftAppearance.outfitStyle))+'</div></div>'+
        '<div class="cccontrols">'+
          '<div class="ccpresetbar">'+presets.map(preset=>'<button type="button" class="ccpreset" data-preset="'+esc(preset.id)+'">'+esc(preset.name)+'</button>').join('')+'</div>'+
          [['skin','Skin tone'],['hair','Hair color'],['face','Eye color'],['shirt','Coat color'],['pants','Pants'],['accent','Accent glow']].map(([key,label])=>
            '<div class="ccrow"><span>'+label+'</span><div class="ccswatches">'+p[key].map(color=>paletteButton(key,color)).join('')+'</div></div>'
          ).join('')+
          '<div class="ccstylegrid">'+
            '<div class="ccstylegroup"><span>Hair style</span><div>'+(o.hairStyle||[]).map(v=>styleButton('hairStyle',v)).join('')+'</div></div>'+
            '<div class="ccstylegroup"><span>Outfit</span><div>'+(o.outfitStyle||[]).map(v=>styleButton('outfitStyle',v)).join('')+'</div></div>'+
            '<div class="ccstylegroup"><span>Accessory</span><div>'+(o.accessory||[]).map(v=>styleButton('accessory',v)).join('')+'</div></div>'+
          '</div>'+
        '</div>'+
      '</div>'+
      '<div class="ccactions"><button type="button" id="ccrandom">RANDOMIZE</button><button type="button" id="ccreset">RESET</button>'+(mode === 'mirror' ? '<button type="button" id="ccsave">SAVE LOOK</button><button type="button" id="cccancel">CLOSE</button>' : '')+'</div>';
    creator.querySelectorAll('.ccswatch').forEach(btn => btn.addEventListener('click', () => {
      draftAppearance = sanitizeAppearance({ ...draftAppearance, [btn.dataset.key]: btn.dataset.color });
      renderCharacterCreator(mode);
    }));
    creator.querySelectorAll('.ccstyle').forEach(btn => btn.addEventListener('click', () => {
      draftAppearance = sanitizeAppearance({ ...draftAppearance, [btn.dataset.key]: btn.dataset.value });
      renderCharacterCreator(mode);
    }));
    creator.querySelectorAll('.ccpreset').forEach(btn => btn.addEventListener('click', () => {
      const preset = presets.find(p => p.id === btn.dataset.preset);
      if (preset) {
        draftAppearance = sanitizeAppearance(preset.look);
        renderCharacterCreator(mode);
      }
    }));
    const random = creator.querySelector('#ccrandom');
    if (random) random.addEventListener('click', () => {
      draftAppearance = randomAppearance();
      renderCharacterCreator(mode);
    });
    const reset = creator.querySelector('#ccreset');
    if (reset) reset.addEventListener('click', () => {
      draftAppearance = sanitizeAppearance(appearanceSystem.DEFAULT);
      renderCharacterCreator(mode);
    });
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
    mountCharacterCreator('setup');
    creator.classList.toggle('hidden', !!(state.gameProfile && state.gameProfile.nameSet));
    creator.dataset.mode = 'setup';
    renderCharacterCreator('setup');
  }

  function openAppearanceEditor(mode = 'mirror') {
    if (!creator) return false;
    if (mode === 'mirror' && typeof document !== 'undefined') {
      try { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); } catch (_) {}
    }
    mountCharacterCreator(mode);
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
    const editingMirror = mirrorOpen();
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
      if (editingMirror) {
        mountCharacterCreator('mirror');
        creator.classList.remove('hidden');
        renderCharacterCreator('mirror');
      } else {
        mountCharacterCreator('setup');
        creator.classList.toggle('hidden', !signed || hasHunterName());
        renderCharacterCreator('setup');
      }
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
    return apiUrl(path);
  }

  function adminFallbackUrl(path) {
    try {
      const host = location && location.hostname;
      return host === 'localhost' || host === '127.0.0.1' || host === '::1' ? path : '';
    } catch (_) {
      return '';
    }
  }

  async function adminFetch(path, options) {
    const primary = adminApiUrl(path);
    const fallback = adminFallbackUrl(path);
    try {
      return await request(primary, options);
    } catch (primaryError) {
      if (!fallback || primary === fallback) throw primaryError;
      try {
        return await request(fallback, options);
      } catch (_) {
        throw new Error('Could not reach admin server at ' + primary);
      }
    }
  }

  function adminHeaders(token) {
    const headers = { 'Content-Type': 'application/json' };
    const adminToken = String(token || '').trim();
    if (adminToken) headers['x-admin-reset-token'] = adminToken;
    return authHeaders(headers);
  }

  async function resetPlayerProfile({ target, token } = {}) {
    const value = String(target || '').trim();
    const adminToken = String(token || '').trim();
    const body = value && value.includes('@') ? { email: value }
      : value ? { accountId: value }
        : state.account && state.account.id ? { accountId: state.account.id }
          : {};
    if (!body.email && !body.accountId) throw new Error('Sign in or enter an email/account id');
    const res = await adminFetch('/auth/admin/reset-player', {
      method: 'POST',
      credentials: 'include',
      headers: adminHeaders(adminToken),
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
    const res = await adminFetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: adminHeaders(adminToken),
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
