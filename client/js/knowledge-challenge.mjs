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
  weakness: 'Weak spot', retrieval: 'Due review', confusion: 'Easily confused',
  maintenance: 'Keep sharp', near_transfer: 'New context', remediation: 'Recovery', fallback: 'Practice',
};
const FORMAT_INSTRUCTION = {
  classify: 'Classify this device.', approve_reject: 'Approve or reject the proposal.',
  replace: 'Choose the better component.', compare: 'Pick the decisive difference.',
  predict_consequence: 'Predict what happens.', repair_diagram: 'Arrange a valid system flow.',
  construct_justification: 'Build a complete justification.',
};

let overlay = null, panel = null, shift = null, pending = null, caseAt = 0, busy = false;
let awaitingContinue = false, buffered = null;

function now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
function room() { return (typeof NET !== 'undefined' && NET && NET.on && NET.room) ? NET.room : null; }
function send(type, msg) { const r = room(); if (r) r.send(type, msg); }
function say(html) { if (typeof sysMsg === 'function') sysMsg(html); }
function sfx(name) { try { if (typeof SFX !== 'undefined' && SFX && typeof SFX[name] === 'function') SFX[name](); } catch (_) {} }
function subject() { try { return localStorage.getItem('bc_recall_subject') || FALLBACK_SUBJECT; } catch (_) { return FALLBACK_SUBJECT; } }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function tavernFx(kind, detail) {
  try {
    const fx = globalThis.BlockcraftTavernChallengeFx;
    if (fx && typeof fx.pulse === 'function') fx.pulse(kind, detail || {});
  } catch (_) {}
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
function show() { ensure(); overlay.classList.remove('hidden'); document.body.classList.add('kc-open'); }
function hide() { if (overlay) { overlay.classList.add('hidden'); document.body.classList.remove('kc-open'); } }

function open() {
  if (!room()) { say('The Knowledge Challenge needs a live connection.'); return; }
  ensure(); shift = null; pending = null; awaitingContinue = false; buffered = null;
  renderChooser(); show();
}
function close() {
  if (shift && !busy) send('kcEnd', { reason: 'ended' });
  hide(); shift = null; pending = null; awaitingContinue = false; buffered = null;
}

function renderChooser() {
  ensure(); panel.innerHTML = '';
  panel.appendChild(el('h2', 'kc-title', 'SCHOLAR TABLE'));
  panel.appendChild(el('p', 'kc-note kc-tavern-note', 'A tavern table game for sharp hunters. Put gold down, answer a run of questions, and win back more if your thinking holds under pressure.'));
  panel.appendChild(el('p', 'kc-note', 'Better accuracy, streaks, recovery answers, and mastery progress improve the payout. Walk away early and the table keeps the stake.'));
  const grid = el('div', 'kc-grid');
  for (const type of Object.keys(ENTRY)) {
    const card = el('button', 'kc-shift'); card.type = 'button';
    card.innerHTML = '<b>' + type.toUpperCase() + '</b><span>' + (PLANNED[type] ? PLANNED[type] + ' cases' : 'endless') + '</span><em>' + ENTRY[type] + ' gold</em>';
    card.onclick = () => start(type);
    grid.appendChild(card);
  }
  panel.appendChild(grid);
  const row = el('div', 'kc-row');
  const leave = el('button', 'kc-btn', 'LEAVE'); leave.type = 'button'; leave.onclick = () => close();
  row.appendChild(leave); panel.appendChild(row);
}

function start(type) {
  if (busy) return;
  busy = true;
  tavernFx('start', { shiftType: type });
  send('kcStart', { shiftType: type, subject: subject(), fallbackSubject: FALLBACK_SUBJECT });
}

function caseHeader(m) {
  const head = el('div', 'kc-head');
  head.appendChild(el('span', 'kc-tag', esc(REASON_LABEL[m.reason] || 'Practice')));
  head.appendChild(el('span', 'kc-count', (m.ordinal | 0) + (m.planned ? ' / ' + m.planned : '')));
  panel.appendChild(head);
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
    b.innerHTML = '<i>' + String.fromCharCode(65 + i) + '</i> ' + esc(a);
    b.onclick = () => submit(i);
    answers.appendChild(b);
  });
  panel.appendChild(answers);
}

// construct_justification: multi-select the parts that form a complete justification.
function renderConstruct(m, p) {
  const chosen = new Set();
  const bank = el('div', 'kc-bank');
  (p.bank || []).forEach((text, i) => {
    const b = el('button', 'kc-chip'); b.type = 'button'; b.textContent = text;
    b.onclick = () => { if (chosen.has(i)) { chosen.delete(i); b.classList.remove('on'); } else { chosen.add(i); b.classList.add('on'); } };
    bank.appendChild(b);
  });
  panel.appendChild(bank);
  const submitBtn = el('button', 'kc-btn kc-submit', 'SUBMIT JUSTIFICATION'); submitBtn.type = 'button';
  submitBtn.onclick = () => submitAssembly({ selected: Array.from(chosen) }, bank.querySelectorAll('.kc-chip'), submitBtn);
  panel.appendChild(submitBtn);
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
    const b = el('button', 'kc-piece'); b.type = 'button'; b.textContent = text;
    b.onclick = () => {
      if (order.length >= slotCount || b.disabled) return;
      b.disabled = true; b.classList.add('placed');
      const pos = order.length; order.push(i);
      slotEls[pos].textContent = text; slotEls[pos].classList.add('filled');
    };
    poolRow.appendChild(b);
  });
  panel.appendChild(poolRow);
  const row = el('div', 'kc-row');
  const reset = el('button', 'kc-btn', 'RESET'); reset.type = 'button'; reset.onclick = () => renderCase(m);
  const submitBtn = el('button', 'kc-btn kc-submit', 'SUBMIT FLOW'); submitBtn.type = 'button';
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
  const answers = panel ? panel.querySelectorAll('.kc-answer') : [];
  if (answers && Number.isInteger(m.correctIndex) && answers[m.correctIndex]) answers[m.correctIndex].classList.add('kc-correct');
  if (answers && Number.isInteger(m.answerIndex) && !m.correct && answers[m.answerIndex]) answers[m.answerIndex].classList.add('kc-wrong');
  const fb = el('div', 'kc-feedback ' + (m.correct ? 'ok' : 'no'));
  fb.innerHTML = (m.correct ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + esc(m.explanation || '')
    + (m.advanced ? ' <em>Fluency up.</em>' : '') + (m.reachedMaintain ? ' <em>Maintained!</em>' : '');
  if (panel) panel.appendChild(fb);
  sfx(m.correct ? 'coin' : 'error');
  pending = null; awaitingContinue = true;
  const cont = el('button', 'kc-btn kc-continue', 'CONTINUE'); cont.type = 'button'; cont.disabled = !buffered;
  cont.onclick = () => proceed();
  if (panel) panel.appendChild(cont);
  if (buffered) cont.disabled = false;
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
  const r = m && m.reason;
  if (r === 'gold') say('You need <b>' + (m.entry | 0) + ' gold</b> to enter that shift.');
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
.kc-overlay{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;background:rgba(4,8,16,.72);backdrop-filter:blur(2px);font-family:inherit}
.kc-overlay.hidden{display:none}
.kc-panel{width:min(560px,92vw);max-height:88vh;overflow:auto;padding:20px;border-radius:12px;border:1px solid rgba(125,211,252,.28);background:linear-gradient(160deg,rgba(12,20,34,.98),rgba(7,11,18,.98));color:#e6eefc;box-shadow:0 24px 60px rgba(0,0,0,.5)}
.kc-title{margin:0 0 8px;letter-spacing:2px;color:#9ad7ff;font-size:20px}
.kc-note{margin:0 0 14px;color:#aebfd4;line-height:1.45;font-size:13px}
.kc-tavern-note{padding:10px 12px;border-radius:9px;border:1px solid rgba(255,210,74,.25);background:rgba(55,32,10,.35);color:#f5dfaa}
.kc-note b{color:#ffe39a}.kc-up{color:#86efac}.kc-down{color:#ff8a8a}
.kc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.kc-shift{display:flex;flex-direction:column;gap:3px;padding:14px;border-radius:9px;border:1px solid rgba(125,211,252,.24);background:rgba(10,20,32,.8);color:#dbe7f6;cursor:pointer;font-family:inherit;text-align:left}
.kc-shift:hover{border-color:#9ad7ff;box-shadow:0 0 16px rgba(154,215,255,.16)}
.kc-shift b{font-size:14px;letter-spacing:1.5px;color:#fff}.kc-shift span{font-size:11px;color:#8ea6c2}.kc-shift em{font-style:normal;color:#ffd24a;font-weight:bold}
.kc-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.kc-tag{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#03111d;background:#9ad7ff;padding:3px 8px;border-radius:20px;font-weight:bold}
.kc-count{color:#8ea6c2;font-size:12px}
.kc-prompt{font-size:16px;line-height:1.4;margin:0 0 14px;color:#f4f8ff}
.kc-answers{display:grid;gap:8px}
.kc-answer{display:flex;gap:10px;align-items:center;padding:11px 13px;border-radius:8px;border:1px solid rgba(125,211,252,.22);background:rgba(9,17,28,.85);color:#e6eefc;cursor:pointer;font-family:inherit;font-size:13px;text-align:left}
.kc-answer:hover:not(:disabled){border-color:#9ad7ff}
.kc-answer:disabled{opacity:.85;cursor:default}
.kc-answer i{display:grid;place-items:center;width:22px;height:22px;border-radius:5px;background:#1a2a40;color:#9ad7ff;font-style:normal;font-weight:bold;flex:0 0 auto}
.kc-answer.kc-correct{border-color:#34d399;background:rgba(52,211,153,.14)}
.kc-answer.kc-wrong{border-color:#fb7185;background:rgba(251,113,133,.12)}
.kc-feedback{margin-top:12px;padding:11px;border-radius:8px;font-size:13px;line-height:1.4}
.kc-feedback.ok{background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.3)}
.kc-feedback.no{background:rgba(251,113,133,.1);border:1px solid rgba(251,113,133,.3)}
.kc-feedback em{font-style:normal;color:#ffe39a}
.kc-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
.kc-stat{padding:10px;border-radius:8px;background:rgba(9,17,28,.7);text-align:center}
.kc-stat b{display:block;font-size:20px;color:#9ad7ff}.kc-stat span{font-size:10px;color:#8ea6c2;letter-spacing:.5px}
.kc-row{display:flex;gap:8px;margin-top:14px}
.kc-btn{flex:1;padding:10px;border-radius:7px;border:1px solid rgba(255,210,74,.5);background:rgba(73,45,12,.6);color:#ffe39a;font-family:inherit;font-weight:bold;letter-spacing:1px;cursor:pointer}
.kc-btn:hover:not(:disabled){border-color:#fff0a8}
.kc-btn:disabled{opacity:.5;cursor:default}
.kc-continue{margin-top:12px;border-color:rgba(125,211,252,.5);background:rgba(12,34,54,.7);color:#cfe8ff}
.kc-corrective{margin-top:14px;padding:12px;border-radius:9px;border:1px solid rgba(255,210,74,.34);background:rgba(40,30,10,.35)}
.kc-consequence{margin:0 0 8px;font-size:12px;line-height:1.4;color:#f0d9a8}.kc-consequence b{color:#ffd24a}
.kc-decisive{margin:0 0 10px;font-size:12px;line-height:1.4;color:#cfe0f2}.kc-decisive b{color:#9ad7ff}
.kc-corrective-q{margin:0 0 10px;font-size:14px;color:#fff}
.kc-instruction{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#9ad7ff;margin-bottom:6px}
.kc-answers.kc-two{grid-template-columns:1fr 1fr}
.kc-answers.kc-grid-opts{grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}
.kc-bank{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 12px}
.kc-chip{padding:9px 12px;border-radius:20px;border:1px solid rgba(125,211,252,.3);background:rgba(9,17,28,.85);color:#dbe7f6;cursor:pointer;font-family:inherit;font-size:12px}
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
`;

globalThis.BlockcraftKnowledgeChallenge = Object.freeze({
  open, close, start,
  get active() { return !!shift; },
  handle(type, m) {
    const map = { kcShiftStarted: onStarted, kcCase: onCase, kcResult: onResult, kcCorrective: onCorrective, kcCorrectiveResult: onCorrectiveResult, kcShiftReport: onReport, kcReject: onReject };
    (map[type] || function () {})(m);
  },
});

export {};
