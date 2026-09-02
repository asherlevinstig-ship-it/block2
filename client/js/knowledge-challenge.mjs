// Knowledge Challenge — client controller + overlay.
//
// Server-authoritative (server/rooms/knowledge-challenge.mixin.js): this only
// renders the chooser, the cases, per-case feedback and the end-of-shift report,
// and relays the player's answers. Entry stakes shown here are for display; the
// server's KC_CONFIG is the source of truth.
const ENTRY = { quick: 20, standard: 40, full: 60, timed: 40, endless: 25 };
const PLANNED = { quick: 10, standard: 20, full: 30, timed: 20, endless: 0 };
const FALLBACK_SUBJECT = 'Computer Science';
const REASON_LABEL = {
  weakness: 'Focus practice', retrieval: 'Review due', confusion: 'Common confusion',
  maintenance: 'Keep sharp', near_transfer: 'New context', remediation: 'Recovery question', fallback: 'Practice',
};
const FORMAT_INSTRUCTION = {
  classify: 'Classify this device.', approve_reject: 'Approve or reject the proposal.',
  replace: 'Choose the better component.', compare: 'Pick the decisive difference.',
  predict_consequence: 'Predict what happens.', repair_diagram: 'Arrange a valid system flow.',
  construct_justification: 'Choose one answer, then choose the reason that proves it.',
};

let overlay = null, panel = null, shift = null, pending = null, caseAt = 0, busy = false;
let awaitingContinue = false, buffered = null;
let tableHeat = 0, lastStreak = 0;

function now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
function room() { return (typeof NET !== 'undefined' && NET && NET.on && NET.room) ? NET.room : null; }
function send(type, msg) { const r = room(); if (r) r.send(type, msg); }
function say(html) { if (typeof sysMsg === 'function') sysMsg(html); }
function sfx(name) { try { if (typeof SFX !== 'undefined' && SFX && typeof SFX[name] === 'function') SFX[name](); } catch (_) {} }
function subject() { return FALLBACK_SUBJECT; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function displayText(s) {
  return String(s == null ? '' : s)
    .replace(/^\s*(Distractor|Answer|Correct answer|Correct)\s*:\s*/i, '')
    .trim();
}
function tavernFx(kind, detail) {
  try {
    const fx = globalThis.BlockcraftTavernChallengeFx;
    if (fx && typeof fx.pulse === 'function') fx.pulse(kind, detail || {});
  } catch (_) {}
}
function trace(event, data) {
  try { if (globalThis.BlockcraftTrace) globalThis.BlockcraftTrace(event, data || {}); } catch (_) {}
  try { console.info('[kc-trace]', event, JSON.stringify(data || {}, null, 2)); } catch (_) { try { console.info('[kc-trace]', event, data || {}); } catch (__) {} }
}

function ensure() {
  if (overlay) return;
  const style = el('style'); style.textContent = STYLE; document.head.appendChild(style);
  overlay = el('div', 'kc-overlay hidden');
  panel = el('div', 'kc-panel');
  overlay.appendChild(panel);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.body.appendChild(overlay);
}
function show() {
  ensure(); overlay.classList.remove('hidden'); document.body.classList.add('kc-open');
  if (globalThis.BlockcraftModal && globalThis.BlockcraftModal.bringToFront) globalThis.BlockcraftModal.bringToFront(overlay);
  if (globalThis.BlockcraftModal && globalThis.BlockcraftModal.sync) globalThis.BlockcraftModal.sync();
}
function hide() {
  if (overlay) {
    overlay.classList.add('hidden'); document.body.classList.remove('kc-open');
    if (globalThis.BlockcraftModal && globalThis.BlockcraftModal.sync) globalThis.BlockcraftModal.sync();
  }
}

function open() {
  if (!room()) { say('The Knowledge Challenge needs a live connection.'); return; }
  ensure(); shift = null; pending = null; awaitingContinue = false; buffered = null;
  renderChooser(); show();
}
function close() {
  if (shift && !busy) send('kcEnd', { reason: 'ended' });
  hide(); shift = null; pending = null; awaitingContinue = false; buffered = null; tableHeat = 0; lastStreak = 0;
}

function renderChooser() {
  ensure(); panel.innerHTML = '';
  panel.appendChild(el('h2', 'kc-title', 'SCHOLAR TABLE'));
  panel.appendChild(el('p', 'kc-note kc-tavern-note', 'Choose your stake. Once the gold hits the table, the first challenge is dealt immediately.'));
  panel.appendChild(el('p', 'kc-note', 'Better accuracy, streaks, recovery answers, and mastery progress improve the payout. Walk away early and the table keeps the stake.'));
  const grid = el('div', 'kc-grid');
  for (const type of Object.keys(ENTRY)) {
    const card = el('button', 'kc-shift'); card.type = 'button';
    card.innerHTML = '<b>' + ENTRY[type] + ' GOLD</b><span>' + type.toUpperCase() + ' · ' + (PLANNED[type] ? PLANNED[type] + ' cases' : 'endless') + '</span><em>Put stake on table</em>';
    card.onclick = () => start(type);
    grid.appendChild(card);
  }
  panel.appendChild(grid);
  const row = el('div', 'kc-row');
  const leave = el('button', 'kc-btn', 'LEAVE'); leave.type = 'button'; leave.onclick = () => close();
  row.appendChild(leave); panel.appendChild(row);
}

function renderDealing(type) {
  ensure(); panel.innerHTML = '';
  panel.classList.remove('kc-hit', 'kc-miss');
  panel.appendChild(el('h2', 'kc-title', 'GOLD ON THE TABLE'));
  panel.appendChild(el('p', 'kc-note kc-tavern-note', 'Stake locked: <b>' + (ENTRY[type] | 0) + ' gold</b>. The Scholar is dealing your first challenge...'));
  const deal = el('div', 'kc-dealing');
  deal.innerHTML = '<span></span><span></span><span></span>';
  panel.appendChild(deal);
}

function start(type) {
  if (busy) return;
  busy = true;
  tableHeat = 0; lastStreak = 0;
  renderDealing(type);
  tavernFx('start', { shiftType: type });
  send('kcStart', { shiftType: type, subject: subject(), fallbackSubject: FALLBACK_SUBJECT });
}

function heatLabel() {
  if (tableHeat >= 90) return 'ON FIRE';
  if (tableHeat >= 65) return 'HOT HAND';
  if (tableHeat >= 35) return 'WARMING';
  return 'STEADY';
}

function renderTableStatus(m) {
  const wrap = el('div', 'kc-table-status');
  const heat = el('div', 'kc-heat');
  heat.innerHTML = '<span>CHALLENGE PACE</span><b>' + heatLabel() + '</b><i style="width:' + Math.max(4, Math.min(100, tableHeat | 0)) + '%"></i>';
  const streak = el('div', 'kc-streak');
  streak.innerHTML = '<span>CORRECT STREAK</span><b>x' + Math.max(0, lastStreak | 0) + '</b>';
  const pot = el('div', 'kc-pot');
  const left = m && m.planned ? Math.max(0, (m.planned | 0) - (m.ordinal | 0) + 1) : 0;
  pot.innerHTML = '<span>' + (left ? 'QUESTIONS LEFT' : 'POT') + '</span><b>' + (left || 'OPEN') + '</b>';
  wrap.appendChild(heat); wrap.appendChild(streak); wrap.appendChild(pot);
  panel.appendChild(wrap);
}

function caseHeader(m) {
  const head = el('div', 'kc-head');
  head.appendChild(el('span', 'kc-tag', esc(REASON_LABEL[m.reason] || 'Practice')));
  head.appendChild(el('span', 'kc-count', (m.ordinal | 0) + (m.planned ? ' / ' + m.planned : '')));
  panel.appendChild(head);
  renderTableStatus(m);
  const instr = FORMAT_INSTRUCTION[m.format];
  if (instr) panel.appendChild(el('div', 'kc-instruction', esc(instr)));
  panel.appendChild(el('p', 'kc-prompt', esc(m.prompt || '')));
}

function renderCase(m) {
  ensure(); show(); panel.innerHTML = '';
  caseHeader(m);
  const p = m.payload;
  if (m.format === 'construct_justification' && p && p.kind === 'construct_justification') return renderConstruct(m, p);
  if (m.format === 'repair_diagram' && p && p.kind === 'repair_diagram') return renderRepair(m, p);
  renderChoices(m);
}

// The five single-choice formats: distinct framing, one index answer.
function renderChoices(m) {
  const twoUp = m.format === 'approve_reject' || ((m.answers || []).length === 2);
  const answers = el('div', 'kc-answers' + (twoUp ? ' kc-two' : '') + (m.format === 'classify' ? ' kc-grid-opts' : ''));
  (m.answers || []).forEach((a, i) => {
    const b = el('button', 'kc-answer'); b.type = 'button';
    b.innerHTML = '<i>' + String.fromCharCode(65 + i) + '</i><span>' + esc(displayText(a)) + '</span>';
    b.onclick = () => submit(i);
    answers.appendChild(b);
  });
  panel.appendChild(answers);
}

// construct_justification: multi-select the parts that form a complete justification.
function renderConstruct(m, p) {
  const chosen = new Set();
  const correctSet = new Set(Array.isArray(p.correctSet) ? p.correctSet.map(n => n | 0) : []);
  const roles = Array.isArray(p.roles) ? p.roles : [];
  const items = (p.bank || []).map((text, index) => ({ text, index, correct: correctSet.has(index), role: String(roles[index] || '') }));
  let answerItems = items.filter(item => item.role === 'answer');
  let reasonItems = items.filter(item => item.role === 'reason');
  if (!answerItems.length || !reasonItems.length) {
    const answerHint = items.find(item => item.correct && displayText(item.text).length <= 42) || items.find(item => item.correct) || null;
    answerItems = items.filter(item => item.index === (answerHint && answerHint.index));
    reasonItems = items.filter(item => item.index !== (answerHint && answerHint.index));
  }

  const help = el('p', 'kc-task-help', 'Select the correct answer first. Then select the explanation that proves why it is correct.');
  panel.appendChild(help);

  const board = el('div', 'kc-construct');
  const answerSection = el('section', 'kc-choice-group');
  answerSection.appendChild(el('h3', '', '1. Answer'));
  const answerBank = el('div', 'kc-bank');
  answerItems.forEach(item => answerBank.appendChild(constructChip(item, chosen, true)));
  answerSection.appendChild(answerBank);

  const reasonSection = el('section', 'kc-choice-group');
  reasonSection.appendChild(el('h3', '', '2. Reason'));
  const reasonBank = el('div', 'kc-bank');
  reasonItems.forEach(item => reasonBank.appendChild(constructChip(item, chosen, false)));
  reasonSection.appendChild(reasonBank);
  board.append(answerSection, reasonSection);
  panel.appendChild(board);

  const submitBtn = el('button', 'kc-btn kc-submit', 'CHECK ANSWER AND REASON'); submitBtn.type = 'button';
  submitBtn.onclick = () => {
    if (chosen.size < 2) { say('Choose one answer and one reason first.'); return; }
    submitAssembly({ selected: Array.from(chosen) }, panel.querySelectorAll('.kc-chip'), submitBtn);
  };
  panel.appendChild(submitBtn);
}

function constructChip(item, chosen, exclusive) {
  const b = el('button', 'kc-chip'); b.type = 'button'; b.textContent = displayText(item.text);
  b.onclick = () => {
    if (chosen.has(item.index)) {
      chosen.delete(item.index); b.classList.remove('on'); return;
    }
    if (exclusive) {
      const group = b.closest('.kc-choice-group');
      if (group) Array.prototype.forEach.call(group.querySelectorAll('.kc-chip.on'), chip => chip.classList.remove('on'));
      const items = Array.prototype.slice.call(group ? group.querySelectorAll('.kc-chip') : []);
      items.forEach((chip) => {
        const idx = Number(chip.dataset.index);
        if (Number.isFinite(idx)) chosen.delete(idx);
      });
    }
    chosen.add(item.index); b.classList.add('on');
  };
  b.dataset.index = String(item.index);
  return b;
}

// repair_diagram: place pool pieces, in order, into the flow slots.
function renderRepair(m, p) {
  const slotCount = p.slots | 0;
  const order = [], slotEls = [];
  const slotRow = el('div', 'kc-slots');
  for (let i = 0; i < slotCount; i++) {
    const s = el('div', 'kc-slot'); s.textContent = String(i + 1); slotEls.push(s); slotRow.appendChild(s);
    if (i < slotCount - 1) slotRow.appendChild(el('span', 'kc-arrow', '→'));
  }
  panel.appendChild(slotRow);
  const poolRow = el('div', 'kc-pool');
  (p.pool || []).forEach((text, i) => {
    const b = el('button', 'kc-piece'); b.type = 'button'; b.textContent = displayText(text);
    b.onclick = () => {
      if (order.length >= slotCount || b.disabled) return;
      b.disabled = true; b.classList.add('placed');
      const pos = order.length; order.push(i);
      slotEls[pos].textContent = displayText(text); slotEls[pos].classList.add('filled');
    };
    poolRow.appendChild(b);
  });
  panel.appendChild(poolRow);
  const row = el('div', 'kc-row');
  const reset = el('button', 'kc-btn', 'RESET'); reset.type = 'button'; reset.onclick = () => renderCase(m);
  const submitBtn = el('button', 'kc-btn kc-submit', 'CHECK ORDER'); submitBtn.type = 'button';
  submitBtn.onclick = () => { if (order.length < slotCount) { say('Fill every slot first.'); return; } submitAssembly({ order: order.slice() }, poolRow.querySelectorAll('.kc-piece'), submitBtn); };
  row.appendChild(reset); row.appendChild(submitBtn); panel.appendChild(row);
}

function submit(index) {
  if (!pending || busy) return;
  busy = true;
  const rt = Math.round(now() - caseAt);
  Array.prototype.forEach.call(panel.querySelectorAll('.kc-answer'), b => { b.disabled = true; });
  send('kcAnswer', { shiftId: shift ? shift.id : 0, questionId: pending.questionId, index, responseMs: rt, handbookUsed: false });
}

function submitAssembly(extra, buttons, submitBtn) {
  if (!pending || busy) return;
  busy = true;
  if (buttons) Array.prototype.forEach.call(buttons, b => { b.disabled = true; });
  if (submitBtn) submitBtn.disabled = true;
  const rt = Math.round(now() - caseAt);
  send('kcAnswer', Object.assign({ shiftId: shift ? shift.id : 0, questionId: pending.questionId, responseMs: rt, handbookUsed: false }, extra));
}

function proceed() {
  awaitingContinue = false;
  const c = buffered; buffered = null;
  if (c) { pending = c; caseAt = now(); renderCase(c); }
}

// ---- message handlers (relayed from networking.mjs) ----
function onStarted(m) { busy = false; shift = { id: m.shiftId, type: m.shiftType, planned: m.planned | 0 }; }
function onCase(m) {
  busy = false;
  if (awaitingContinue) { buffered = m; const c = panel && panel.querySelector('.kc-continue'); if (c) c.disabled = false; }
  else { pending = m; caseAt = now(); renderCase(m); }
}
function onResult(m) {
  busy = false;
  lastStreak = Math.max(0, m && (m.streak | 0) || 0);
  tableHeat = m && m.correct ? Math.min(100, tableHeat + 18 + Math.min(18, lastStreak * 3)) : Math.max(0, tableHeat - 22);
  if (panel) {
    panel.classList.remove('kc-hit', 'kc-miss');
    panel.offsetHeight; // restart animation
    panel.classList.add(m.correct ? 'kc-hit' : 'kc-miss');
  }
  const answers = panel ? panel.querySelectorAll('.kc-answer') : [];
  if (answers && Number.isInteger(m.correctIndex) && answers[m.correctIndex]) answers[m.correctIndex].classList.add('kc-correct');
  if (answers && Number.isInteger(m.answerIndex) && !m.correct && answers[m.answerIndex]) answers[m.answerIndex].classList.add('kc-wrong');
  const fb = el('div', 'kc-feedback ' + (m.correct ? 'ok' : 'no'));
  const headline = m.correct
    ? (lastStreak >= 5 ? 'TABLE ROARS!' : lastStreak >= 3 ? 'HOT STREAK!' : 'CLEAN HIT!')
    : 'THE TABLE BITES BACK';
  fb.innerHTML = '<strong>' + headline + '</strong> '
    + (m.correct ? '<b>Correct.</b> ' : '<b>Not quite.</b> ')
    + esc(m.explanation || '')
    + (lastStreak > 1 ? ' <em>x' + lastStreak + ' streak</em>' : '')
    + (m.advanced ? ' <em>Fluency up.</em>' : '') + (m.reachedMaintain ? ' <em>Maintained!</em>' : '');
  if (panel) panel.appendChild(fb);
  if (m.correct && panel) burst(panel, lastStreak);
  sfx(m.correct ? 'coin' : 'error');
  pending = null; awaitingContinue = true;
  const cont = el('button', 'kc-btn kc-continue', m.correct ? (lastStreak >= 3 ? 'PRESS THE STREAK' : 'KEEP THE RUN ALIVE') : 'RECOVER THE HAND');
  cont.type = 'button'; cont.disabled = !buffered;
  cont.onclick = () => proceed();
  if (panel) panel.appendChild(cont);
  if (buffered) cont.disabled = false;
}

function burst(root, streak) {
  const n = Math.min(14, 5 + (streak | 0));
  for (let i = 0; i < n; i++) {
    const p = el('span', 'kc-spark', Math.random() < .35 ? '✦' : '+');
    p.style.left = (30 + Math.random() * 40) + '%';
    p.style.top = (40 + Math.random() * 20) + '%';
    p.style.setProperty('--dx', ((Math.random() - .5) * 180).toFixed(0) + 'px');
    p.style.setProperty('--dy', (-50 - Math.random() * 90).toFixed(0) + 'px');
    root.appendChild(p);
    setTimeout(() => { try { p.remove(); } catch (_) {} }, 900);
  }
}
function onReport(m) {
  shift = null; pending = null; awaitingContinue = false; buffered = null;
  ensure(); show(); panel.innerHTML = '';
  panel.appendChild(el('h2', 'kc-title', 'TABLE RESULT'));
  const t = m.totals || {};
  const delta = (m.payout | 0) - (m.entry | 0);
  tavernFx(delta >= 0 ? 'win' : 'loss', { delta, payout: m.payout | 0, entry: m.entry | 0 });
  panel.appendChild(el('p', 'kc-note', 'Stake <b>' + (m.entry | 0) + '</b> · Payout <b>' + (m.payout | 0) + '</b> · Net <b class="' + (delta >= 0 ? 'kc-up' : 'kc-down') + '">' + (delta >= 0 ? '+' : '') + delta + ' gold</b>'));
  const stats = el('div', 'kc-stats');
  const rows = [
    ['Cases', t.completedCases | 0], ['First-try', t.firstAttemptCorrect | 0], ['Independent', t.independentCorrect | 0],
    ['Best streak', t.bestStreak | 0], ['Stages up', t.stagesAdvanced | 0], ['Recovered', t.recoveryCases | 0],
  ];
  for (const [k, v] of rows) { const s = el('div', 'kc-stat'); s.innerHTML = '<b>' + v + '</b><span>' + k + '</span>'; stats.appendChild(s); }
  panel.appendChild(stats);
  const row = el('div', 'kc-row');
  const again = el('button', 'kc-btn', 'PLAY AGAIN'); again.type = 'button'; again.onclick = () => renderChooser();
  const leave = el('button', 'kc-btn', 'LEAVE'); leave.type = 'button'; leave.onclick = () => hide();
  row.appendChild(again); row.appendChild(leave); panel.appendChild(row);
  if (delta >= 0) sfx('level');
}
function onReject(m) {
  busy = false;
  trace('knowledge-challenge.reject', m || {});
  const r = m && m.reason;
  if (r === 'gold') {
    const entry = Math.max(0, (m.entry | 0));
    const have = Number.isFinite(Number(m.gold)) ? Math.max(0, Number(m.gold) | 0) : 0;
    say('<b>Not enough gold.</b> The Scholar Table needs <b>' + entry + ' gold</b>; you have <b>' + have + ' gold</b>.');
  }
  else if (r === 'no_content') {
    const subj = esc((m && (m.subjectName || m.requestedSubject || m.subject)) || 'this subject');
    say('No Knowledge Challenge content is loaded for <b>' + subj + '</b> yet.');
  }
  else if (r === 'unavailable') say('The Knowledge Challenge is not available right now.');
  else if (r === 'active') say('Finish your current shift first.');
  else if (r === 'subject') say('That subject has no challenge content.');
  else say('That could not start.');
  sfx('error');
  if (overlay && !overlay.classList.contains('hidden') && !shift) renderChooser();
}

function onTrace(m) {
  trace('knowledge-challenge.server', m || {});
}

function onCorrective(m) {
  busy = false;
  if (!panel) return;
  const cont = panel.querySelector('.kc-continue'); if (cont) cont.remove(); // must answer this first
  const box = el('div', 'kc-corrective');
  if (m && m.consequence) box.appendChild(el('p', 'kc-consequence', '<b>Consequence:</b> ' + esc(m.consequence)));
  if (m && m.decisive) box.appendChild(el('p', 'kc-decisive', '<b>The distinction:</b> ' + esc(m.decisive)));
  box.appendChild(el('p', 'kc-corrective-q', esc((m && m.prompt) || 'Which is correct?')));
  const opts = el('div', 'kc-answers');
  ((m && m.answers) || []).forEach((a, i) => {
    const b = el('button', 'kc-answer kc-corrective-opt'); b.type = 'button';
    b.innerHTML = '<i>' + String.fromCharCode(65 + i) + '</i> ' + esc(a);
    b.onclick = () => submitCorrective(i);
    opts.appendChild(b);
  });
  box.appendChild(opts);
  panel.appendChild(box);
}
function submitCorrective(index) {
  if (busy) return; busy = true;
  if (panel) Array.prototype.forEach.call(panel.querySelectorAll('.kc-corrective-opt'), b => { b.disabled = true; });
  send('kcCorrective', { shiftId: shift ? shift.id : 0, index });
}
function onCorrectiveResult(m) {
  busy = false;
  const opts = panel ? panel.querySelectorAll('.kc-corrective-opt') : [];
  if (opts && Number.isInteger(m.correctIndex) && opts[m.correctIndex]) opts[m.correctIndex].classList.add('kc-correct');
  const fb = el('div', 'kc-feedback ' + (m.correct ? 'ok' : 'no'));
  fb.innerHTML = m.correct ? '<b>Right — that is the distinction.</b>' : '<b>Not quite — hold onto that distinction.</b>';
  if (panel) panel.appendChild(fb);
  sfx(m.correct ? 'coin' : 'error');
  awaitingContinue = true;
  const cont = el('button', 'kc-btn kc-continue', 'CONTINUE'); cont.type = 'button'; cont.disabled = !buffered;
  cont.onclick = () => proceed();
  if (panel) panel.appendChild(cont);
}

const STYLE = `
.kc-overlay{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;background:rgba(4,8,16,.62);backdrop-filter:blur(4px);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.kc-overlay.hidden{display:none}
.kc-panel{position:relative;width:min(900px,calc(100vw - 32px));max-height:88vh;overflow:auto;padding:26px 30px 28px;border-radius:18px;border:1px solid rgba(125,211,252,.34);background:radial-gradient(circle at 50% 0,rgba(255,210,74,.08),transparent 34%),linear-gradient(160deg,rgba(12,20,34,.98),rgba(7,11,18,.98));color:#e6eefc;box-shadow:0 24px 60px rgba(0,0,0,.5)}
.kc-panel.kc-hit{animation:kcHit .42s ease}
.kc-panel.kc-miss{animation:kcMiss .36s ease}
.kc-title{margin:0 0 10px;letter-spacing:.04em;color:#9ad7ff;font-size:24px;line-height:1.1}
.kc-note{margin:0 0 14px;color:#aebfd4;line-height:1.45;font-size:13px}
.kc-tavern-note{padding:10px 12px;border-radius:9px;border:1px solid rgba(255,210,74,.25);background:rgba(55,32,10,.35);color:#f5dfaa}
.kc-note b{color:#ffe39a}.kc-up{color:#86efac}.kc-down{color:#ff8a8a}
.kc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.kc-shift{display:flex;flex-direction:column;gap:3px;padding:14px;border-radius:9px;border:1px solid rgba(125,211,252,.24);background:rgba(10,20,32,.8);color:#dbe7f6;cursor:pointer;font-family:inherit;text-align:left}
.kc-shift:hover{border-color:#9ad7ff;box-shadow:0 0 16px rgba(154,215,255,.16)}
.kc-shift b{font-size:14px;letter-spacing:1.5px;color:#fff}.kc-shift span{font-size:11px;color:#8ea6c2}.kc-shift em{font-style:normal;color:#ffd24a;font-weight:bold}
.kc-dealing{display:flex;justify-content:center;gap:14px;padding:18px 0 8px}
.kc-dealing span{width:54px;height:76px;border-radius:8px;border:1px solid rgba(255,210,74,.45);background:linear-gradient(145deg,rgba(20,34,54,.95),rgba(6,10,18,.95));box-shadow:0 8px 18px rgba(0,0,0,.32),inset 0 0 18px rgba(154,215,255,.08);animation:kcDeal 1s ease-in-out infinite}
.kc-dealing span:nth-child(2){animation-delay:.14s}.kc-dealing span:nth-child(3){animation-delay:.28s}
.kc-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.kc-tag{font-size:12px;letter-spacing:.04em;text-transform:none;color:#03111d;background:#9ad7ff;padding:6px 12px;border-radius:20px;font-weight:800}
.kc-count{color:#b6c7dd;font-size:15px}
.kc-table-status{display:grid;grid-template-columns:minmax(0,1fr) 130px 140px;gap:12px;margin:0 0 18px}
.kc-heat,.kc-streak,.kc-pot{position:relative;overflow:hidden;min-height:64px;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,210,74,.22);background:rgba(9,17,28,.72)}
.kc-heat span,.kc-streak span,.kc-pot span{display:block;font-size:11px;letter-spacing:.08em;color:#8ea6c2;text-transform:uppercase}
.kc-heat b,.kc-streak b,.kc-pot b{position:relative;z-index:1;display:block;margin-top:6px;color:#ffe39a;font-size:18px;letter-spacing:0}
.kc-heat i{position:absolute;left:0;bottom:0;height:4px;border-radius:0 6px 6px 0;background:linear-gradient(90deg,#22d3ee,#facc15,#fb7185);box-shadow:0 0 18px rgba(250,204,21,.45);transition:width .28s ease}
.kc-streak b{color:#86efac}.kc-pot b{color:#9ad7ff}
.kc-prompt{font-size:22px;line-height:1.4;margin:0 0 20px;color:#f4f8ff}
.kc-answers{display:grid;gap:10px}
.kc-answer{display:flex;gap:12px;align-items:center;padding:14px 16px;border-radius:12px;border:1px solid rgba(125,211,252,.26);background:rgba(9,17,28,.85);color:#e6eefc;cursor:pointer;font-family:inherit;font-size:16px;line-height:1.35;text-align:left}
.kc-answer:hover:not(:disabled){border-color:#9ad7ff}
.kc-answer:disabled{opacity:.85;cursor:default}
.kc-answer i{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:#1a2a40;color:#9ad7ff;font-style:normal;font-weight:800;flex:0 0 auto}
.kc-answer span{min-width:0}
.kc-answer.kc-correct{border-color:#34d399;background:rgba(52,211,153,.14)}
.kc-answer.kc-wrong{border-color:#fb7185;background:rgba(251,113,133,.12)}
.kc-feedback{margin-top:12px;padding:11px;border-radius:8px;font-size:13px;line-height:1.4}
.kc-feedback strong{display:block;margin-bottom:4px;font-size:14px;letter-spacing:1.4px;color:#ffe39a;text-transform:uppercase}
.kc-feedback.ok{background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.3)}
.kc-feedback.no{background:rgba(251,113,133,.1);border:1px solid rgba(251,113,133,.3)}
.kc-feedback em{font-style:normal;color:#ffe39a}
.kc-spark{position:absolute;z-index:4;pointer-events:none;color:#ffe39a;text-shadow:0 0 12px rgba(255,210,74,.9);font-weight:bold;animation:kcSpark .9s ease-out forwards}
.kc-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
.kc-stat{padding:10px;border-radius:8px;background:rgba(9,17,28,.7);text-align:center}
.kc-stat b{display:block;font-size:20px;color:#9ad7ff}.kc-stat span{font-size:10px;color:#8ea6c2;letter-spacing:.5px}
.kc-row{display:flex;gap:8px;margin-top:14px}
.kc-btn{flex:1;min-height:48px;padding:12px 16px;border-radius:10px;border:1px solid rgba(255,210,74,.5);background:rgba(73,45,12,.6);color:#ffe39a;font-family:inherit;font-weight:800;letter-spacing:.04em;cursor:pointer}
.kc-btn:hover:not(:disabled){border-color:#fff0a8}
.kc-btn:disabled{opacity:.5;cursor:default}
.kc-continue{margin-top:12px;border-color:rgba(125,211,252,.5);background:rgba(12,34,54,.7);color:#cfe8ff}
.kc-corrective{margin-top:14px;padding:12px;border-radius:9px;border:1px solid rgba(255,210,74,.34);background:rgba(40,30,10,.35)}
.kc-consequence{margin:0 0 8px;font-size:12px;line-height:1.4;color:#f0d9a8}.kc-consequence b{color:#ffd24a}
.kc-decisive{margin:0 0 10px;font-size:12px;line-height:1.4;color:#cfe0f2}.kc-decisive b{color:#9ad7ff}
.kc-corrective-q{margin:0 0 10px;font-size:14px;color:#fff}
.kc-instruction{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#9ad7ff;margin-bottom:10px;font-weight:800}
.kc-task-help{margin:0 0 14px;color:#cfe0f2;font-size:14px;line-height:1.45}
.kc-construct{display:grid;gap:14px;margin-top:6px}
.kc-choice-group{display:grid;gap:10px;padding:14px;border:1px solid rgba(125,211,252,.2);border-radius:14px;background:rgba(8,16,28,.5)}
.kc-choice-group h3{margin:0;color:#f4f8ff;font-size:14px;letter-spacing:.04em}
.kc-answers.kc-two{grid-template-columns:1fr 1fr}
.kc-answers.kc-grid-opts{grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}
.kc-bank{display:flex;flex-wrap:wrap;gap:10px;margin:4px 0 18px}
.kc-chip{padding:12px 16px;border-radius:999px;border:1px solid rgba(125,211,252,.34);background:rgba(9,17,28,.85);color:#dbe7f6;cursor:pointer;font-family:inherit;font-size:15px;line-height:1.35;text-align:left}
.kc-chip:hover{border-color:#9ad7ff}
.kc-chip.on{border-color:#34d399;background:rgba(52,211,153,.18);color:#eafff5}
.kc-slots{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:6px 0 12px}
.kc-slot{min-width:78px;min-height:42px;display:grid;place-items:center;padding:6px 10px;border-radius:8px;border:1px dashed rgba(125,211,252,.4);background:rgba(9,17,28,.6);color:#8ea6c2;font-size:12px;text-align:center}
.kc-slot.filled{border-style:solid;border-color:#9ad7ff;background:rgba(12,34,54,.8);color:#eaf4ff}
.kc-arrow{color:#5f7896;font-size:18px}
.kc-pool{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:6px}
.kc-piece{padding:9px 13px;border-radius:8px;border:1px solid rgba(255,210,74,.4);background:rgba(40,30,10,.5);color:#ffe39a;cursor:pointer;font-family:inherit;font-size:12px}
.kc-piece:hover:not(:disabled){border-color:#fff0a8}
.kc-piece.placed{opacity:.4;cursor:default}
.kc-submit{margin-top:6px}
@media(max-width:720px){.kc-panel{padding:20px 16px;width:calc(100vw - 20px)}.kc-table-status{grid-template-columns:1fr}.kc-answers.kc-two{grid-template-columns:1fr}.kc-prompt{font-size:18px}.kc-answer,.kc-chip{font-size:14px}}
@keyframes kcHit{0%{transform:scale(1);box-shadow:0 24px 60px rgba(0,0,0,.5)}35%{transform:scale(1.012);box-shadow:0 0 34px rgba(52,211,153,.22),0 24px 60px rgba(0,0,0,.5)}100%{transform:scale(1);box-shadow:0 24px 60px rgba(0,0,0,.5)}}
@keyframes kcMiss{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}55%{transform:translateX(4px)}80%{transform:translateX(-2px)}}
@keyframes kcSpark{0%{opacity:0;transform:translate(0,0) scale(.7)}15%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1.35)}}
@keyframes kcDeal{0%,100%{transform:translateY(0) rotate(-2deg);opacity:.55}45%{transform:translateY(-9px) rotate(2deg);opacity:1}}
`;

globalThis.BlockcraftKnowledgeChallenge = Object.freeze({
  open, close, start,
  get active() { return !!shift; },
  handle(type, m) {
    const map = { kcShiftStarted: onStarted, kcCase: onCase, kcResult: onResult, kcCorrective: onCorrective, kcCorrectiveResult: onCorrectiveResult, kcShiftReport: onReport, kcReject: onReject, kcTrace: onTrace };
    (map[type] || function () {})(m);
  },
});

export {};
