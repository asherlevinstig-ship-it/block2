// Dragons, familiars, mounts, nests, egg incubation and breeding. Lifted verbatim
// out of GameRoom.js and mixed into its prototype. (Dragon combat abilities stay
// with the shared combat helpers for a later abilities mixin.)
const {
  DRAGON_BREED_CD_MS, DRAGON_BREED_MS, DRAGON_EGG_OF, DRAGON_LOVE_MS, DRAGON_PERCH_SLOTS, DRAGON_TYPE_BY_EGG,
  DRAGON_TYPE_SET, FAMILIAR_BIND_ITEM, FAMILIAR_KINDS, FANG_RANGE, I,
  MOTE_BURST_MIN_TIER, MOTE_BURST_RANGE, dragonIncubationMs, dragonMountType, dragonOffspring, famTier,
  fangDamage, isDragonMount, isUnlockableMount, isValidMount, moteBurst, moteRegen, cleanDragonName,
  SHADE_STEP_MIN_TIER, SHADE_STEP_CD_MS, fangCooldown, fangStrikes, moteBurstCooldown,
  shadeStepCharges, shadeStepDistance,
} = require('./constants');
const { State, Player, Mob, Team, Gate } = require('../schema');
const { TeamManager } = require('../teams');
const W = require('../world');
const D = require('../dungeon');
const AI = require('../ai');
const { createStore, sanitizeProfile, mergeClientSave, defaultProfile, cleanToken, sanitizeUtilityLoadout, DRAGON_GROW_MS } = require('../store');
const FAMILIAR_SYSTEM = require('../../shared/familiar-system');
const DRAGON_LOAN_MS = 12 * 60 * 60 * 1000;
const DRAGON_LOAN_MAX_FEE = 1000000;

class DragonsMixin {
  // Dragon incubation and nesting state, co-located with the mixin that owns it.
  // Called once from onCreate, before the incubation/nest restore loaders run.
  initDragonState() {
    this.dragonIncubations = new Map();
    this.nestDragons = new Map();        // "x,y,z#slot" -> { type, token, loveUntil, breedCdUntil, breedAccum }
    this.dragonFollowBondTravel = new Map();
    this.dragonTraining = new Map();      // sessionId -> { type, role, progress, need, lastX, lastZ, until }
    this.dragonLoanOffers = new Map();    // offerId -> pending dragon training loan
    this.dragonLoanSeq = 0;
  }

  normalizeDragonLoans(prof) {
    if (!prof || typeof prof !== 'object') return [];
    const out = [];
    const raw = Array.isArray(prof.dragonLoans) ? prof.dragonLoans : [];
    for (const loan of raw.slice(-24)) {
      if (!loan || typeof loan !== 'object') continue;
      const type = typeof loan.type === 'string' && DRAGON_TYPE_SET.has(loan.type) ? loan.type : '';
      const ownerToken = cleanToken(loan.ownerToken);
      const tamerToken = cleanToken(loan.tamerToken);
      const id = typeof loan.id === 'string' ? loan.id.replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 64) : '';
      if (!id || !type || !ownerToken || !tamerToken || ownerToken === tamerToken) continue;
      const status = ['active', 'returned', 'expired', 'cancelled'].includes(loan.status) ? loan.status : 'active';
      out.push({
        id, type, ownerToken, tamerToken, status,
        ownerName: typeof loan.ownerName === 'string' ? loan.ownerName.slice(0, 16) : 'Hunter',
        tamerName: typeof loan.tamerName === 'string' ? loan.tamerName.slice(0, 16) : 'Hunter',
        feeGold: Math.max(0, Math.min(DRAGON_LOAN_MAX_FEE, loan.feeGold | 0)),
        startedAt: Math.max(0, Math.min(4102444800000, Math.round(Number(loan.startedAt) || 0))),
        dueAt: Math.max(0, Math.min(4102444800000, Math.round(Number(loan.dueAt) || 0))),
        endedAt: Math.max(0, Math.min(4102444800000, Math.round(Number(loan.endedAt) || 0))),
        dragonName: typeof loan.dragonName === 'string' ? loan.dragonName.slice(0, 18) : '',
        gender: loan.gender === 'male' || loan.gender === 'female' ? loan.gender : '',
        personality: ['bold', 'gentle', 'proud', 'playful', 'skittish', 'hungry'].includes(loan.personality) ? loan.personality : '',
        hatchedAt: Math.max(0, Math.min(4102444800000, Math.round(Number(loan.hatchedAt) || 0))),
      });
    }
    prof.dragonLoans = out;
    return out;
  }

  dragonLoanStatus(loan, now = Date.now()) {
    if (!loan || loan.status !== 'active') return loan && loan.status || '';
    return loan.dueAt && now >= loan.dueAt ? 'expired' : 'active';
  }

  reconcileDragonLoansForProfile(token, prof, now = Date.now()) {
    const loans = this.normalizeDragonLoans(prof);
    let changed = false;
    for (const loan of loans) {
      if (loan.status === 'active' && loan.dueAt && now >= loan.dueAt) {
        loan.status = 'expired';
        loan.endedAt = now;
        changed = true;
        const otherToken = token === loan.ownerToken ? loan.tamerToken : token === loan.tamerToken ? loan.ownerToken : '';
        const otherProf = otherToken && this.profiles && this.profiles.get(otherToken);
        if (otherProf) {
          const otherLoans = this.normalizeDragonLoans(otherProf);
          const otherLoan = otherLoans.find(row => row.id === loan.id);
          if (otherLoan && otherLoan.status === 'active') {
            otherLoan.status = 'expired';
            otherLoan.endedAt = now;
            if (this.dirtyPlayers) this.dirtyPlayers.add(otherToken);
          }
        }
      }
    }
    if (changed && token && this.dirtyPlayers) this.dirtyPlayers.add(token);
    return loans;
  }

  activeDragonLoansFor(token, prof, now = Date.now()) {
    token = cleanToken(token);
    return this.reconcileDragonLoansForProfile(token, prof, now)
      .filter(loan => loan.status === 'active' && (!loan.dueAt || now < loan.dueAt) && (loan.ownerToken === token || loan.tamerToken === token));
  }

  effectiveMountUnlocksFor(token, prof, now = Date.now()) {
    const base = Array.isArray(prof && prof.mountUnlocks) ? [...new Set(prof.mountUnlocks)] : [];
    const loans = this.activeDragonLoansFor(token, prof, now);
    const outgoing = new Set(loans.filter(loan => loan.ownerToken === token).map(loan => 'dragon:' + loan.type));
    const out = base.filter(kind => !outgoing.has(kind));
    for (const loan of loans) {
      if (loan.tamerToken !== token) continue;
      const kind = 'dragon:' + loan.type;
      if (!out.includes(kind)) out.push(kind);
    }
    return out;
  }

  activeDragonLoanForType(token, prof, type, role = '', now = Date.now()) {
    if (!DRAGON_TYPE_SET.has(type)) return null;
    const loans = this.activeDragonLoansFor(token, prof, now);
    return loans.find(loan => loan.type === type && (!role || loan[role + 'Token'] === token)) || null;
  }

  dragonPublicProfileFor(token, prof, type) {
    const kind = 'dragon:' + type;
    const own = Array.isArray(prof && prof.mountUnlocks) && prof.mountUnlocks.includes(kind);
    const outgoing = this.activeDragonLoanForType(token, prof, type, 'owner');
    if (own && !outgoing) return { token, prof, borrowed: false, loan: null };
    const incoming = this.activeDragonLoanForType(token, prof, type, 'tamer');
    if (incoming) {
      const ownerProf = this.profiles && this.profiles.get(incoming.ownerToken);
      return { token: incoming.ownerToken, prof: ownerProf || prof, borrowed: true, loan: incoming };
    }
    return { token, prof, borrowed: false, loan: null };
  }

  dragonAccessForClient(client, type, requireOwnerLoaded = true) {
    const rec = this.profileFor(client);
    if (!rec || !DRAGON_TYPE_SET.has(type)) return null;
    const kind = 'dragon:' + type;
    const own = Array.isArray(rec.prof.mountUnlocks) && rec.prof.mountUnlocks.includes(kind);
    const outgoing = this.activeDragonLoanForType(rec.token, rec.prof, type, 'owner');
    if (own && !outgoing) return { token: rec.token, prof: rec.prof, ownerRec: rec, clientRec: rec, borrowed: false, loan: null };
    const incoming = this.activeDragonLoanForType(rec.token, rec.prof, type, 'tamer');
    if (!incoming) return null;
    const ownerProf = this.profiles && this.profiles.get(incoming.ownerToken);
    if (!ownerProf && requireOwnerLoaded) return null;
    return {
      token: incoming.ownerToken,
      prof: ownerProf || rec.prof,
      ownerRec: ownerProf ? { token: incoming.ownerToken, prof: ownerProf } : null,
      clientRec: rec,
      borrowed: true,
      loan: incoming,
    };
  }

  dragonLoanSnapshot(ownerProf, type) {
    return {
      dragonName: ownerProf && ownerProf.dragonNames && ownerProf.dragonNames[type] || '',
      gender: this.ensureDragonGender(ownerProf, type),
      personality: this.ensureDragonPersonality(ownerProf, type),
      hatchedAt: this.ensureDragonHatchedAt(ownerProf, type),
    };
  }

  mirrorDragonLoan(loan, ownerRec, tamerRec) {
    for (const rec of [ownerRec, tamerRec]) {
      if (!rec || !rec.prof) continue;
      const list = this.normalizeDragonLoans(rec.prof);
      const i = list.findIndex(row => row.id === loan.id);
      if (i >= 0) list[i] = { ...list[i], ...loan };
      else list.push({ ...loan });
      rec.prof.dragonLoans = list.slice(-24);
      if (this.dirtyPlayers) this.dirtyPlayers.add(rec.token);
    }
  }

  publicDragonLoan(loan, token) {
    if (!loan) return null;
    return {
      id: loan.id,
      type: loan.type,
      status: this.dragonLoanStatus(loan),
      role: loan.ownerToken === token ? 'owner' : loan.tamerToken === token ? 'tamer' : '',
      ownerName: loan.ownerName || 'Hunter',
      tamerName: loan.tamerName || 'Hunter',
      feeGold: loan.feeGold | 0,
      startedAt: loan.startedAt || 0,
      dueAt: loan.dueAt || 0,
      endedAt: loan.endedAt || 0,
      dragonName: loan.dragonName || '',
    };
  }

  publicDragonLoansFor(token, prof) {
    return this.reconcileDragonLoansForProfile(token, prof).map(loan => this.publicDragonLoan(loan, token)).filter(Boolean);
  }

  dirtyAndSyncDragonAccess(client, access) {
    if (!access) return;
    if (access.token && this.dirtyPlayers) this.dirtyPlayers.add(access.token);
    if (access.borrowed && access.clientRec && access.clientRec.token && this.dirtyPlayers) this.dirtyPlayers.add(access.clientRec.token);
    const ownerClient = access.borrowed && access.token ? this.clients.find(c => this.tokens.get(c.sessionId) === access.token) : null;
    if (ownerClient && access.prof) this.syncPlayerProfile(ownerClient, access.prof);
    if (client && access.clientRec && access.clientRec.prof) this.syncPlayerProfile(client, access.clientRec.prof);
  }

  handleDragonLoanOffer(client, m = {}) {
    const ownerRec = this.profileFor(client);
    const target = this.findTradeTarget ? this.findTradeTarget(client, m) : null;
    const tamerRec = target && this.profileFor(target);
    const reject = (reason, extra = {}) => client.send('dragonLoanReject', { reason, ...extra });
    if (!ownerRec || !target || !tamerRec || target === client) return reject('target');
    if (this.rateLimited && this.rateLimited(client, 'dragonLoan', 3, 8)) return reject('rate');
    if (this.tradePlayersClose && !this.tradePlayersClose(client, target)) return reject('range', this.tradeDistanceInfo ? this.tradeDistanceInfo(client, target) : {});
    const type = typeof m.type === 'string' ? m.type : '';
    const kind = 'dragon:' + type;
    if (!DRAGON_TYPE_SET.has(type) || !Array.isArray(ownerRec.prof.mountUnlocks) || !ownerRec.prof.mountUnlocks.includes(kind)) return reject('unowned');
    if (!this.isDragonAdult(ownerRec.prof, type)) return reject('young', { type, stage: this.dragonStage(ownerRec.prof, type) });
    if (this.dragonIsNested(ownerRec.token, type)) return reject('nested', { type });
    if (this.activeDragonLoanForType(ownerRec.token, ownerRec.prof, type, 'owner')) return reject('loaned', { type });
    if (this.effectiveMountUnlocksFor(tamerRec.token, tamerRec.prof).includes(kind)) return reject('targetOwned', { type, targetName: tamerRec.prof.name || 'Hunter' });
    if (tamerRec.prof.job !== 'pet_tamer') return reject('job', { targetName: tamerRec.prof.name || 'Hunter' });
    const feeGold = Math.max(0, Math.min(DRAGON_LOAN_MAX_FEE, m.gold | 0));
    if (feeGold <= 0) return reject('fee');
    if ((tamerRec.prof.gold | 0) < feeGold) return reject('targetGold', { targetName: tamerRec.prof.name || 'Hunter' });
    const id = 'dl_' + (++this.dragonLoanSeq) + '_' + Date.now().toString(36);
    const ownerName = (this.state.players.get(client.sessionId) || {}).name || ownerRec.prof.name || 'Hunter';
    const tamerName = (this.state.players.get(target.sessionId) || {}).name || tamerRec.prof.name || 'Hunter';
    const snapshot = this.dragonLoanSnapshot(ownerRec.prof, type);
    const offer = {
      id, type, ownerSid: client.sessionId, tamerSid: target.sessionId,
      ownerToken: ownerRec.token, tamerToken: tamerRec.token, ownerName, tamerName,
      feeGold, createdAt: Date.now(), ...snapshot,
    };
    if (!this.dragonLoanOffers) this.dragonLoanOffers = new Map();
    this.dragonLoanOffers.set(id, offer);
    client.send('dragonLoanPending', { ...offer, toSid: target.sessionId, toName: tamerName });
    const payload = { ...offer, fromSid: client.sessionId, fromName: ownerName, toSid: target.sessionId };
    target.send('dragonLoanOffer', payload);
    if (typeof this.broadcast === 'function') this.broadcast('dragonLoanOfferBroadcast', payload);
  }

  handleDragonLoanAccept(client, m = {}) {
    const id = String(m.loanId || m.id || '');
    const offer = this.dragonLoanOffers && this.dragonLoanOffers.get(id);
    const reject = (reason, extra = {}) => client.send('dragonLoanReject', { reason, id, ...extra });
    if (!offer || offer.tamerSid !== client.sessionId) return reject('missing');
    const owner = this.clients.find(c => c.sessionId === offer.ownerSid);
    const ownerRec = owner && this.profileFor(owner), tamerRec = this.profileFor(client);
    if (!owner || !ownerRec || !tamerRec) { this.dragonLoanOffers.delete(id); return reject('offline'); }
    if (Date.now() - offer.createdAt > 45000) { this.dragonLoanOffers.delete(id); return reject('expired'); }
    if (this.tradePlayersClose && !this.tradePlayersClose(owner, client)) return reject('range');
    if (tamerRec.prof.job !== 'pet_tamer') return reject('job');
    if ((tamerRec.prof.gold | 0) < (offer.feeGold | 0)) return reject('gold');
    const kind = 'dragon:' + offer.type;
    if (!Array.isArray(ownerRec.prof.mountUnlocks) || !ownerRec.prof.mountUnlocks.includes(kind)) return reject('unowned');
    if (this.effectiveMountUnlocksFor(tamerRec.token, tamerRec.prof).includes(kind)) return reject('targetOwned');
    if (this.activeDragonLoanForType(ownerRec.token, ownerRec.prof, offer.type, 'owner')) return reject('loaned');
    const now = Date.now();
    const loan = {
      id, type: offer.type, ownerToken: ownerRec.token, tamerToken: tamerRec.token,
      ownerName: offer.ownerName, tamerName: offer.tamerName, feeGold: offer.feeGold | 0,
      startedAt: now, dueAt: now + DRAGON_LOAN_MS, endedAt: 0, status: 'active',
      dragonName: offer.dragonName || '', gender: offer.gender || '', personality: offer.personality || '', hatchedAt: offer.hatchedAt || 0,
    };
    tamerRec.prof.gold = Math.max(0, (tamerRec.prof.gold | 0) - loan.feeGold);
    ownerRec.prof.gold = Math.min(1e9, (ownerRec.prof.gold | 0) + loan.feeGold);
    this.mirrorDragonLoan(loan, ownerRec, tamerRec);
    const ownerPlayer = this.state.players.get(owner.sessionId);
    if (ownerPlayer && ownerPlayer.mount === kind) ownerPlayer.mount = '';
    this.dragonLoanOffers.delete(id);
    this.syncPlayerProfile(owner, ownerRec.prof);
    this.syncPlayerProfile(client, tamerRec.prof);
    this.sendProfile(owner, ownerRec.prof);
    this.sendProfile(client, tamerRec.prof);
    if (this.recordEconomyGold) {
      this.recordEconomyGold(client, -loan.feeGold, 'dragon_loan', 'dragon_training_fee', { loanId: id, owner: owner.sessionId });
      this.recordEconomyGold(owner, loan.feeGold, 'dragon_loan', 'dragon_training_fee_received', { loanId: id, tamer: client.sessionId });
    }
    owner.send('dragonLoanResult', { ok: true, action: 'accepted', loan: this.publicDragonLoan(loan, ownerRec.token) });
    client.send('dragonLoanResult', { ok: true, action: 'accepted', loan: this.publicDragonLoan(loan, tamerRec.token) });
  }

  handleDragonLoanCancel(client, m = {}) {
    const id = String(m.loanId || m.id || '');
    const offer = this.dragonLoanOffers && this.dragonLoanOffers.get(id);
    if (!offer || (offer.ownerSid !== client.sessionId && offer.tamerSid !== client.sessionId)) return;
    this.dragonLoanOffers.delete(id);
    const otherSid = offer.ownerSid === client.sessionId ? offer.tamerSid : offer.ownerSid;
    const other = this.clients.find(c => c.sessionId === otherSid);
    client.send('dragonLoanCancel', { id, reason: 'cancelled' });
    if (other) other.send('dragonLoanCancel', { id, reason: 'cancelled' });
  }

  handleDragonLoanReturn(client, m = {}) {
    const rec = this.profileFor(client);
    const id = String(m.loanId || m.id || '');
    const reject = reason => client.send('dragonLoanReject', { reason, id });
    if (!rec || !id) return reject('missing');
    const list = this.normalizeDragonLoans(rec.prof);
    const loan = list.find(row => row.id === id && row.status === 'active' && (row.ownerToken === rec.token || row.tamerToken === rec.token));
    if (!loan) return reject('missing');
    const ownerProf = this.profiles.get(loan.ownerToken), tamerProf = this.profiles.get(loan.tamerToken);
    if (!ownerProf || !tamerProf) return reject('offline');
    const now = Date.now();
    const returned = { ...loan, status: 'returned', endedAt: now };
    this.mirrorDragonLoan(returned, { token: loan.ownerToken, prof: ownerProf }, { token: loan.tamerToken, prof: tamerProf });
    const owner = this.clients.find(c => this.tokens.get(c.sessionId) === loan.ownerToken);
    const tamer = this.clients.find(c => this.tokens.get(c.sessionId) === loan.tamerToken);
    if (tamer) {
      const p = this.state.players.get(tamer.sessionId);
      if (p && p.mount === 'dragon:' + loan.type) p.mount = '';
    }
    if (owner) { this.syncPlayerProfile(owner, ownerProf); this.sendProfile(owner, ownerProf); owner.send('dragonLoanReturn', { loan: this.publicDragonLoan(returned, loan.ownerToken) }); }
    if (tamer) { this.syncPlayerProfile(tamer, tamerProf); this.sendProfile(tamer, tamerProf); tamer.send('dragonLoanReturn', { loan: this.publicDragonLoan(returned, loan.tamerToken) }); }
  }

  hasMountUnlock(client, kind) {
    const rec = this.profileFor(client);
    if (!rec) return false;
    if (!isDragonMount(kind)) return !!(Array.isArray(rec.prof.mountUnlocks) && rec.prof.mountUnlocks.includes(kind));
    const type = dragonMountType(kind);
    const access = this.dragonAccessForClient(client, type, false);
    if (!access) return false;
    if (!isDragonMount(kind)) return true;
    if (access.prof) return this.isDragonAdult(access.prof, type);
    const hatchedAt = access.loan && access.loan.hatchedAt || 0;
    return hatchedAt ? Date.now() - hatchedAt >= DRAGON_GROW_MS : true;
  }
  hasFamiliarUnlock(client, kind) {
    const rec = this.profileFor(client);
    return !!(rec && Array.isArray(rec.prof.familiarUnlocks) && rec.prof.familiarUnlocks.includes(kind));
  }
  familiarPowerLevel(client, kind) {
    const rec=this.profileFor(client), xp=rec&&rec.prof.familiarXp&&rec.prof.familiarXp[kind]||0;
    return FAMILIAR_SYSTEM.bondLevel(xp);
  }
  ensureFamiliarXpBag(prof) {
    if (!prof.familiarXp || typeof prof.familiarXp !== 'object') prof.familiarXp = {};
    for (const kind of FAMILIAR_KINDS) if (!Number.isFinite(prof.familiarXp[kind])) prof.familiarXp[kind] = 0;
    return prof.familiarXp;
  }
  activeFamiliarIs(client, kind) {
    const p = client && this.state.players.get(client.sessionId);
    return !!(p && p.familiar === kind && this.hasFamiliarUnlock(client, kind) && !this.familiarMechanicsSuspended(client.sessionId));
  }
  awardFamiliarXp(client, kind, amount, reason) {
    const rec=this.profileFor(client), p=client&&this.state.players.get(client.sessionId);
    if(!rec||!p||p.familiar!==kind||!FAMILIAR_KINDS.has(kind))return 0;
    this.ensureFamiliarXpBag(rec.prof);
    if(!this.familiarXpPace)this.familiarXpPace=new Map();
    const paceKey=client.sessionId+':'+kind+':'+reason,now=Date.now();let pace=this.familiarXpPace.get(paceKey);
    if(!pace||now-pace.since>=3600000)pace={since:now,count:0};pace.count++;this.familiarXpPace.set(paceKey,pace);
    const scale=pace.count<=20?1:pace.count<=40?.5:.25;
    const base=Math.max(1,Math.round(Math.max(0,amount|0)*scale));
    const challenge=this.recordFamiliarChallenge(rec.prof,kind,reason,amount);
    const reward=challenge&&challenge.justCompleted?FAMILIAR_SYSTEM.DAILY_CHALLENGE_REWARD:0;
    const before=rec.prof.familiarXp[kind]|0, after=Math.min(1000000,before+base+reward);
    if(after===before)return 0;
    rec.prof.familiarXp[kind]=after;this.dirtyPlayers.add(rec.token);
    if(!this.familiarTelemetryLog)this.familiarTelemetryLog=[];
    this.familiarTelemetryLog.push({at:now,sid:client.sessionId,kind,gained:after-before,diminished:scale<1,challenge:!!(challenge&&challenge.justCompleted)});
    if(this.familiarTelemetryLog.length>2000)this.familiarTelemetryLog.splice(0,this.familiarTelemetryLog.length-2000);
    p.familiarTier=FAMILIAR_SYSTEM.bondTier(after);
    client.send('familiarBond',{kind,xp:after,gained:after-before,reason,tier:FAMILIAR_SYSTEM.bondTier(after),challenge});
    return after-before;
  }
  familiarTelemetrySnapshot(client){
    const now=Date.now(),since=now-3600000,kinds=[...FAMILIAR_KINDS];
    const recent=(this.familiarTelemetryLog||[]).filter(e=>e.at>=since),own=recent.filter(e=>e.sid===client.sessionId);
    const byKind=Object.fromEntries(kinds.map(kind=>{const rows=own.filter(e=>e.kind===kind);return[kind,{xp:rows.reduce((n,e)=>n+e.gained,0),actions:rows.length,diminished:rows.filter(e=>e.diminished).length,challenges:rows.filter(e=>e.challenge).length}];}));
    const tiers=Object.fromEntries(kinds.map(kind=>[kind,[0,0,0,0,0]]));let completed=0,profiles=0;
    for(const prof of this.profiles.values()){profiles++;for(const kind of kinds){tiers[kind][FAMILIAR_SYSTEM.bondTier(prof.familiarXp&&prof.familiarXp[kind]||0)]++;const state=prof.familiarChallenges&&prof.familiarChallenges[kind];if(state&&state.day===FAMILIAR_SYSTEM.dayKey(now)&&state.claimed)completed++;}}
    return {at:now,windowMs:3600000,profiles,byKind,tiers,dailyCompleted:completed};
  }
  recordFamiliarChallenge(prof,kind,reason,value){
    if(!prof.familiarChallenges)prof.familiarChallenges={};
    const day=FAMILIAR_SYSTEM.dayKey(),def=FAMILIAR_SYSTEM.dailyChallenge(kind,day);if(!def)return null;
    let state=prof.familiarChallenges[kind];if(!state||state.day!==day)state={day,progress:0,claimed:false};
    let justCompleted=false;
    if(!state.claimed&&def.reason===reason){state.progress=Math.min(def.need,state.progress+(def.metric==='count'?1:Math.max(0,value|0)));if(state.progress>=def.need){state.claimed=true;justCompleted=true;}}
    prof.familiarChallenges[kind]=state;
    return {day,title:def.title,need:def.need,progress:state.progress,claimed:state.claimed,justCompleted};
  }
  handleBindFamiliar(client, m) {
    const rec = this.profileFor(client);
    if (!rec) return client.send('familiarReject', { reason: 'invalid' });
    const kind = m && typeof m.kind === 'string' ? m.kind : 'shade';
    if (!FAMILIAR_KINDS.has(kind)) return client.send('familiarReject', { reason: 'kind' });
    if (!Array.isArray(rec.prof.familiarUnlocks)) rec.prof.familiarUnlocks = [];
    if (rec.prof.familiarUnlocks.includes(kind)) return client.send('familiarReject', { reason: 'owned' });
    const itemId = FAMILIAR_BIND_ITEM[kind];
    const slot = Math.max(0, Math.min(35, m && m.slot | 0));
    const usedSlot = this.consumeSlotItem(rec.prof, slot, itemId, 1);
    if (!usedSlot && !this.consumeItem(rec.prof, itemId, 1)) return client.send('familiarReject', { reason: 'item', kind });
    rec.prof.familiarUnlocks.push(kind);
    this.ensureFamiliarXpBag(rec.prof);
    if (rec.prof.job === 'pet_tamer' && typeof this.grantJobXp === 'function') {
      this.grantJobXp(client, 'pet_tamer', 14);
      if (typeof this.progressJobContract === 'function') this.progressJobContract(client, 'tame', 1, 0);
    }
    this.dirtyPlayers.add(rec.token);
    this.syncPlayerProfile(client, rec.prof);
    client.send('familiarBound', { kind, slot: usedSlot ? slot : -1 });
    if (this.refreshNpcQuestReadiness) this.refreshNpcQuestReadiness(client);
  }
  handleSummonFamiliar(client, m) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return client.send('familiarReject', { action: 'summon', reason: 'invalid' });
    const kind = m && typeof m.kind === 'string' ? m.kind : 'shade';
    if (!FAMILIAR_KINDS.has(kind)) return client.send('familiarReject', { action: 'summon', kind, reason: 'kind' });
    if (!this.hasFamiliarUnlock(client, kind)) return client.send('familiarReject', { action: 'summon', kind, reason: 'locked' });
    if (p.familiar !== kind && this.moteAcc) this.moteAcc.delete(client.sessionId);
    p.familiar = kind;
    p.familiarTier=FAMILIAR_SYSTEM.bondTier(this.profileFor(client).prof.familiarXp&&this.profileFor(client).prof.familiarXp[kind]||0);
    client.send('familiarSummoned', { kind });
    this.sendSpace(p.dgn || '', 'fx', { t:'familiarSummon', kind, x:p.x, y:p.y, z:p.z, sid:client.sessionId, dgn:p.dgn || '' });
  }
  handleDismissFamiliar(client) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    const kind = p.familiar;
    p.familiar = '';
    p.familiarTier=0;
    if (this.moteAcc) this.moteAcc.delete(client.sessionId);
    client.send('familiarDismissed', {});
    if (kind) this.sendSpace(p.dgn || '', 'fx', { t:'familiarDismiss', kind, x:p.x, y:p.y, z:p.z, sid:client.sessionId, dgn:p.dgn || '' });
  }
  dismissFamiliarFor(client, reason = 'dismissed') {
    const p = client && this.state.players.get(client.sessionId);
    if (!p || !p.familiar) return false;
    const kind = p.familiar;
    p.familiar = '';
    p.familiarTier=0;
    if (this.moteAcc) this.moteAcc.delete(client.sessionId);
    client.send('familiarDismissed', { reason });
    this.sendSpace(p.dgn || '', 'fx', { t:'familiarDismiss', kind, x:p.x, y:p.y, z:p.z, sid:client.sessionId, dgn:p.dgn || '' });
    return true;
  }
  clearFamiliarRuntime(sid) {
    for (const map of [this.fangCd, this.moteAcc, this.moteBurstCd, this.shadeStepCd]) if (map) map.delete(sid);
    if(this.familiarXpPace)for(const key of this.familiarXpPace.keys())if(key.startsWith(sid+':'))this.familiarXpPace.delete(key);
  }
  familiarMechanicsSuspended(sid) {
    const hp = this.playerHp && this.playerHp.get(sid);
    return !!((hp && hp.hp <= 0)
      || (this.skyshipPassengers && this.skyshipPassengers.has(sid))
      || (typeof this.eventMovementLocked === 'function' && this.eventMovementLocked(sid)));
  }
  handleShadeStep(client, m) {
    const p = this.state.players.get(client.sessionId);
    const reject = reason => client.send('shadeStepReject', { reason });
    if (!p || p.familiar !== 'shade' || !this.hasFamiliarUnlock(client, 'shade')) return reject('familiar');
    const powerLevel=this.familiarPowerLevel(client,'shade');
    if (famTier(powerLevel) < SHADE_STEP_MIN_TIER) return reject('tier');
    if ((this.skyshipPassengers && this.skyshipPassengers.has(client.sessionId))
      || (typeof this.eventMovementLocked === 'function' && this.eventMovementLocked(client.sessionId))) return reject('locked');
    const now = Date.now();
    if (!this.shadeStepCd) this.shadeStepCd = new Map();
    const maxCharges = shadeStepCharges(powerLevel);
    let chargeState = this.shadeStepCd.get(client.sessionId) || { charges:maxCharges, updated:now };
    const restored = Math.floor((now-chargeState.updated)/SHADE_STEP_CD_MS);
    if(restored>0){ chargeState={charges:Math.min(maxCharges,chargeState.charges+restored),updated:chargeState.updated+restored*SHADE_STEP_CD_MS}; }
    if(chargeState.charges<=0) return client.send('shadeStepReject', { reason:'cooldown', cd:Math.max(0,SHADE_STEP_CD_MS-(now-chargeState.updated)), charges:0, maxCharges });
    let dx = Number(m && m.x), dz = Number(m && m.z);
    const len = Math.hypot(dx, dz);
    if (!Number.isFinite(len) || len < 0.5) return reject('direction');
    dx /= len; dz /= len;
    const start = { x: p.x, y: p.y, z: p.z };
    const solid = this.spaceSolid(p.dgn || '');
    const borderMin = W.LAVA_BORDER_WIDTH + 1.35, borderMax = W.WX - W.LAVA_BORDER_WIDTH - 1.35;
    const distance = shadeStepDistance(powerLevel);
    const steps = Math.ceil(distance / 0.24);
    let x = p.x, z = p.z;
    for (let i = 0; i < steps; i++) {
      const step = Math.min(0.24, distance - i * 0.24);
      const nx = Math.max(borderMin, Math.min(borderMax, x + dx * step));
      const nz = Math.max(borderMin, Math.min(borderMax, z + dz * step));
      if (solid(Math.floor(nx), Math.floor(p.y + .2), Math.floor(nz))
        || solid(Math.floor(nx), Math.floor(p.y + 1.5), Math.floor(nz))) break;
      x = nx; z = nz;
    }
    if (Math.hypot(x - p.x, z - p.z) < 0.2) return reject('blocked');
    p.x = x; p.z = z;
    this.pvel.set(client.sessionId, { x: 0, z: 0 });
    const wasFull=chargeState.charges>=maxCharges;
    chargeState={charges:chargeState.charges-1,updated:wasFull?now:chargeState.updated};
    this.shadeStepCd.set(client.sessionId, chargeState);
    this.awardFamiliarXp(client,'shade',8,'shadow_jump');
    const rechargeCd=Math.max(0,SHADE_STEP_CD_MS-(now-chargeState.updated));
    client.send('shadeStepResult', { x, y: p.y, z, cd:chargeState.charges?0:rechargeCd, rechargeCd, charges:chargeState.charges, maxCharges });
    this.sendSpace(p.dgn || '', 'fx', { t: 'shadeStep', sx: start.x, sy: start.y, sz: start.z, x, y: p.y, z, sid: client.sessionId, dgn: p.dgn || '' });
  }
  // pick a species from the rank pool, favoring ones this player hasn't hatched yet
  pickDragonEggForPlayer(client, pool) {
    const rec = this.profileFor(client);
    const owned = new Set((rec && Array.isArray(rec.prof.mountUnlocks) ? rec.prof.mountUnlocks : [])
      .filter(k => isDragonMount(k)).map(k => dragonMountType(k)));
    const fresh = pool.filter(t => !owned.has(t));
    const arr = fresh.length ? fresh : pool;
    return arr[(Math.random() * arr.length) | 0];
  }
  handleMount(client, m) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    if (p.dim !== 'overworld') return;          // mounts are overworld-only
    const kind = m && typeof m.kind === 'string' ? m.kind : 'horse';
    if (!isValidMount(kind)) return;
    if (isUnlockableMount(kind) && !this.hasMountUnlock(client, kind)) return;  // must be earned
    p.mount = kind;
    if (this.refreshNpcQuestReadiness) this.refreshNpcQuestReadiness(client);
  }
  handleDismount(client) {
    const p = this.state.players.get(client.sessionId);
    if (p) p.mount = '';
  }
  dragonIncubationKey(x, y, z) { return x + ',' + y + ',' + z; }
  ensureDragonIncubations() {
    if (!this.dragonIncubations) this.dragonIncubations = new Map();
    return this.dragonIncubations;
  }
  sendDragonIncubations(client) {
    const now = Date.now();
    const token = this.tokens.get(client.sessionId);
    for (const inc of this.ensureDragonIncubations().values()) {
      if (token && inc.token === token) inc.ownerSid = client.sessionId;
      client.send('dragonIncubationStart', {
        x: inc.x, y: inc.y, z: inc.z, type: inc.type, eggId: inc.eggId,
        gender: inc.gender || this.defaultDragonGender(inc.type),
        startedAt: inc.startedAt, finishAt: inc.finishAt, ready: !!inc.ready, now,
      });
    }
  }
  cancelDragonIncubationAt(x, y, z) {
    const key = this.dragonIncubationKey(x, y, z);
    const incubations = this.ensureDragonIncubations();
    if (!incubations.has(key)) return false;
    incubations.delete(key);
    this.dirtyIncubations = true;
    this.broadcast('dragonIncubationRemove', { x, y, z });
    return true;
  }
  completeDragonIncubations() {
    const now = Date.now();
    const incubations = this.ensureDragonIncubations();
    for (const inc of incubations.values()) {
      if (inc.ready || now < inc.finishAt) continue;
      inc.ready = true;
      this.dirtyIncubations = true;
      this.broadcast('dragonIncubationReady', { x: inc.x, y: inc.y, z: inc.z, type: inc.type, eggId: inc.eggId, gender: inc.gender || this.defaultDragonGender(inc.type), ownerSid: inc.ownerSid || '' });
    }
  }
  claimDragonIncubation(client, key, inc) {
    const rec = this.profileFor(client);
    if (!rec || rec.token !== inc.token) return client.send('hatchDragonReject', { reason: 'busy' });
    if (Date.now() < inc.finishAt && !inc.ready) return client.send('hatchDragonReject', { reason: 'waiting' });
    const kind = 'dragon:' + inc.type;
    if (!Array.isArray(rec.prof.mountUnlocks)) rec.prof.mountUnlocks = [];
    if (rec.prof.mountUnlocks.includes(kind)) return client.send('hatchDragonReject', { reason: 'owned', type: inc.type });
    rec.prof.mountUnlocks.push(kind);
    this.ensureDragonGender(rec.prof, inc.type, inc.gender);
    const personality = this.ensureDragonPersonality(rec.prof, inc.type, inc.personality || this.randomDragonPersonality());
    const hatchedAt = this.ensureDragonHatchedAt(rec.prof, inc.type, Date.now());
    this.dirtyPlayers.add(rec.token);
    this.syncPlayerProfile(client, rec.prof);
    this.ensureDragonIncubations().delete(key);
    this.dirtyIncubations = true;
    this.broadcast('dragonIncubationComplete', { x: inc.x, y: inc.y, z: inc.z, type: inc.type, eggId: inc.eggId, gender: rec.prof.dragonGenders[inc.type], personality, hatchedAt, kind, ownerSid: client.sessionId });
    if (this.refreshNpcQuestReadiness) this.refreshNpcQuestReadiness(client);
  }
  handleRenameDragon(client, m) {
    const rec = this.profileFor(client);
    if (!rec || !m) return client.send('dragonRenameReject', { reason: 'invalid' });
    const type = typeof m.type === 'string' ? m.type : '';
    const kind = 'dragon:' + type;
    if (!DRAGON_TYPE_SET.has(type) || !Array.isArray(rec.prof.mountUnlocks) || !rec.prof.mountUnlocks.includes(kind))
      return client.send('dragonRenameReject', { reason: 'unowned', type });
    const name = cleanDragonName(m.name, '');
    if (!name) return client.send('dragonRenameReject', { reason: 'name', type });
    if (!rec.prof.dragonNames || typeof rec.prof.dragonNames !== 'object') rec.prof.dragonNames = {};
    rec.prof.dragonNames[type] = name;
    this.dirtyPlayers.add(rec.token);
    this.syncPlayerProfile(client, rec.prof);
    client.send('dragonRenameResult', { type, name });
  }
  handleHatchDragonEgg(client, m) {
    const p = this.state.players.get(client.sessionId);
    const rec = this.profileFor(client);
    if (!p || !rec || !m || p.dim !== 'overworld') return client.send('hatchDragonReject', { reason: 'invalid' });
    const x = m.x | 0, y = m.y | 0, z = m.z | 0;
    if (!W.inWorld(x, y, z) || this.world.getB(x, y, z) !== W.B.EGG_INSULATOR) {
      return client.send('hatchDragonReject', { reason: 'insulator' });
    }
    if (Math.hypot(x + .5 - p.x, z + .5 - p.z) > 6) return client.send('hatchDragonReject', { reason: 'range' });
    const key = this.dragonIncubationKey(x, y, z);
    const incubations = this.ensureDragonIncubations();
    const existing = incubations.get(key);
    if (existing) return this.claimDragonIncubation(client, key, existing);
    let slot = Math.max(0, Math.min(35, m.slot | 0));
    let egg = Array.isArray(rec.prof.inv) ? rec.prof.inv[slot] : null;
    let type = egg ? DRAGON_TYPE_BY_EGG[egg.id | 0] : '';
    if (!type) {
      slot = this.findInventoryItemSlot(rec.prof, s => !!DRAGON_TYPE_BY_EGG[s.id | 0]);
      egg = slot >= 0 && Array.isArray(rec.prof.inv) ? rec.prof.inv[slot] : null;
      type = egg ? DRAGON_TYPE_BY_EGG[egg.id | 0] : '';
    }
    if (!type) return client.send('hatchDragonReject', { reason: 'egg' });
    const kind = 'dragon:' + type;
    if (!Array.isArray(rec.prof.mountUnlocks)) rec.prof.mountUnlocks = [];
    if (rec.prof.mountUnlocks.includes(kind)) return client.send('hatchDragonReject', { reason: 'owned', type });
    if (!this.consumeSlotItem(rec.prof, slot, egg.id | 0, 1)) return client.send('hatchDragonReject', { reason: 'egg' });
    this.dirtyPlayers.add(rec.token);
    const now = Date.now();
    const incubationMs = dragonIncubationMs(type);
    const inc = { x, y, z, type, eggId: egg.id | 0, gender: this.randomDragonGender(), personality: this.randomDragonPersonality(), token: rec.token, ownerSid: client.sessionId, slot, startedAt: now, finishAt: now + incubationMs };
    incubations.set(key, inc);
    this.dirtyIncubations = true;
    this.broadcast('dragonIncubationStart', { x, y, z, type, eggId: inc.eggId, gender: inc.gender, slot, startedAt: inc.startedAt, finishAt: inc.finishAt, incubationMs, now });
  }

  // ---------------- dragon breeding: perch two dragons at a nest, feed treats, lay an egg ----------------
  nestSlotKey(x, y, z, slot) { return x + ',' + y + ',' + z + '#' + slot; }
  sendNestDragons(client) {
    const now = Date.now();
    for (const [key, n] of this.nestDragons) {
      const [coord, slotStr] = key.split('#');
      const [x, y, z] = coord.split(',').map(Number);
      client.send('dragonPerchAdd', { key, x, y, z, slot: +slotStr, type: n.type, gender: n.gender || this.defaultDragonGender(n.type), loveUntil: n.loveUntil || 0, now });
    }
  }
  cancelNestDragonsAt(x, y, z) {
    let changed = false;
    for (let s = 0; s < DRAGON_PERCH_SLOTS; s++) {
      const key = this.nestSlotKey(x, y, z, s);
      if (this.nestDragons.delete(key)) { this.broadcast('dragonPerchRemove', { key }); changed = true; }
    }
    if (changed) this.dirtyNests = true;
    return changed;
  }
  handlePerchDragon(client, m) {
    const p = this.state.players.get(client.sessionId);
    const rec = this.profileFor(client);
    if (!p || !rec || !m || p.dim !== 'overworld') return client.send('perchReject', { reason: 'invalid' });
    const x = m.x | 0, y = m.y | 0, z = m.z | 0;
    if (!W.inWorld(x, y, z) || this.world.getB(x, y, z) !== W.B.EGG_INSULATOR) return client.send('perchReject', { reason: 'nest' });
    if (Math.hypot(x + .5 - p.x, z + .5 - p.z) > 6) return client.send('perchReject', { reason: 'range' });
    const kind = typeof m.kind === 'string' ? m.kind : '';
    if (!isDragonMount(kind) || !DRAGON_TYPE_SET.has(dragonMountType(kind))) return client.send('perchReject', { reason: 'kind' });
    if (!Array.isArray(rec.prof.mountUnlocks) || !rec.prof.mountUnlocks.includes(kind)) return client.send('perchReject', { reason: 'unowned' });
    if (!this.isDragonAdult(rec.prof, dragonMountType(kind))) return client.send('perchReject', { reason: 'young', stage: this.dragonStage(rec.prof, dragonMountType(kind)) });
    let slot = -1;
    for (let s = 0; s < DRAGON_PERCH_SLOTS; s++) if (!this.nestDragons.has(this.nestSlotKey(x, y, z, s))) { slot = s; break; }
    if (slot < 0) return client.send('perchReject', { reason: 'full' });
    const type = dragonMountType(kind);
    const gender = this.ensureDragonGender(rec.prof, type);
    this.nestDragons.set(this.nestSlotKey(x, y, z, slot), { type, gender, token: rec.token, loveUntil: 0, breedCdUntil: 0, breedStart: 0 });
    this.dirtyNests = true;
    if (p.mount === kind) p.mount = '';                  // the dragon is now nesting, not ridden
    this.broadcast('dragonPerchAdd', { key: this.nestSlotKey(x, y, z, slot), x, y, z, slot, type, gender, loveUntil: 0, now: Date.now() });
  }
  handleRecallDragon(client, m) {
    const rec = this.profileFor(client);
    if (!rec || !m) return;
    const key = typeof m.key === 'string' ? m.key : '';
    if (key) {
      const n = this.nestDragons.get(key);
      if (!n || n.token !== rec.token) return client.send('perchReject', { reason: 'notyours' });
      this.nestDragons.delete(key);
      this.dirtyNests = true;
      this.broadcast('dragonPerchRemove', { key });
      return;
    }
    const p = this.state.players.get(client && client.sessionId);
    if (!p || !this.isPlayerAlive(client)) return client.send('dragonRecallReject', { reason: 'invalid' });
    const type = typeof m.type === 'string' ? m.type : '';
    const access = this.dragonAccessForClient(client, type);
    if (!DRAGON_TYPE_SET.has(type) || !access)
      return client.send('dragonRecallReject', { reason: 'unowned' });
    if (!this.isDragonAdult(access.prof, type)) return client.send('dragonRecallReject', { reason: 'young', type, stage: this.dragonStage(access.prof, type) });
    if ((p.dim || 'overworld') !== 'overworld' || (p.dgn || '')) return client.send('dragonRecallReject', { reason: 'overworld' });
    if (this.dragonIsNested(access.token, type)) return client.send('dragonRecallReject', { reason: 'nested', type });
    const role = this.ensureDragonRole(access.prof, type);
    const hasPost = !!(access.prof.dragonStaySpots && access.prof.dragonStaySpots[type]);
    if (role === 'stay' && hasPost && m.clearStaySpot !== true) return client.send('dragonRecallReject', { reason: 'stay', type });
    let clearedStaySpot = false;
    if (hasPost && m.clearStaySpot === true) {
      delete access.prof.dragonStaySpots[type];
      clearedStaySpot = true;
    }
    if (role === 'stay') access.prof.dragonRoles[type] = 'follow';
    this.dirtyAndSyncDragonAccess(client, access);
    client.send('dragonRecallResult', { type, role: this.ensureDragonRole(access.prof, type), clearedStaySpot, x: p.x, y: p.y, z: p.z });
    this.sendSpace(p.dgn || '', 'fx', { t: 'dragonRecall', kind: type, x: p.x, y: p.y, z: p.z, owner: client.sessionId, clearedStaySpot, dgn: p.dgn || '' });
  }
  handleFeedDragon(client, m) {
    const rec = this.profileFor(client);
    if (!rec || !m) return;
    const key = typeof m.key === 'string' ? m.key : '';
    const n = this.nestDragons.get(key);
    if (!n || n.token !== rec.token) return client.send('perchReject', { reason: 'notyours' });
    const now = Date.now();
    if (n.loveUntil > now) return client.send('perchReject', { reason: 'already' });
    if (now < (n.breedCdUntil || 0)) return client.send('perchReject', { reason: 'tired' });
    const slot = Math.max(0, Math.min(35, m.slot | 0));
    let consumedSlot = slot;
    if (!this.consumeSlotItem(rec.prof, consumedSlot, I.DRAGON_TREAT, 1)) {
      consumedSlot = -1;
      const inv = Array.isArray(rec.prof.inv) ? rec.prof.inv : [];
      for (let i = 0; i < 36; i++) if (inv[i] && inv[i].id === I.DRAGON_TREAT && this.consumeSlotItem(rec.prof, i, I.DRAGON_TREAT, 1)) { consumedSlot = i; break; }
      if (consumedSlot < 0) return client.send('perchReject', { reason: 'treat' });
    }
    const care = this.feedDragonCare(rec.prof, n.type, 16);
    const bond = this.awardDragonBondXp(rec.prof, n.type, 12, 'care');
    this.dirtyPlayers.add(rec.token);
    this.syncPlayerProfile(client, rec.prof);
    n.loveUntil = now + DRAGON_LOVE_MS;
    this.dirtyNests = true;
    const [coord, slotStr] = key.split('#');
    const [x, y, z] = coord.split(',').map(Number);
    this.broadcast('dragonPerchLove', { key, x, y, z, slot: +slotStr, type: n.type, loveUntil: n.loveUntil, happiness: care ? care.happiness : 0, now });
    client.send('dragonCare', { type: n.type, slot: consumedSlot, happiness: care ? care.happiness : 0, fedAt: care ? care.fedAt : now, bondXp: bond ? bond.xp : 0, bondLevel: bond ? bond.level : 1, bondGained: bond ? bond.gained : 0, dragonChallenge: bond ? bond.challenge : null });
  }
  handleCareDragon(client, m) {
    const rec = this.profileFor(client);
    if (!rec || !m || !this.isPlayerAlive(client)) return client.send('feedDragonReject', { reason: 'invalid' });
    const type = typeof m.type === 'string' ? m.type : '';
    const access = this.dragonAccessForClient(client, type);
    if (!access)
      return client.send('feedDragonReject', { reason: 'unowned' });
    const slot = Math.max(0, Math.min(35, m.slot | 0));
    if (!this.consumeSlotItem(rec.prof, slot, I.DRAGON_TREAT, 1)) return client.send('feedDragonReject', { reason: 'treat' });
    const sage = this.dragonSpecialization && this.dragonSpecialization(access.prof, type) === 'sage';
    const care = this.feedDragonCare(access.prof, type, (this.isDragonAdult(access.prof, type) ? 12 : 18) + (sage ? 4 : 0));
    const bond = this.awardDragonBondXp(access.prof, type, this.isDragonAdult(access.prof, type) ? 10 : 16, 'care');
    const now = Date.now();
    this.dirtyAndSyncDragonAccess(client, access);
    client.send('feedDragonResult', { slot, type, happiness: care ? care.happiness : 0, fedAt: care ? care.fedAt : now, bondXp: bond ? bond.xp : 0, bondLevel: bond ? bond.level : 1, bondGained: bond ? bond.gained : 0, dragonChallenge: bond ? bond.challenge : null, careOnly: true });
  }
  handleSetDragonRole(client, m) {
    const rec = this.profileFor(client);
    const p = this.state.players.get(client && client.sessionId);
    if (!rec || !p || !m || !this.isPlayerAlive(client)) return client.send('dragonRoleReject', { reason: 'invalid' });
    const type = typeof m.type === 'string' ? m.type : '';
    const role = typeof m.role === 'string' ? m.role : '';
    const access = this.dragonAccessForClient(client, type);
    if (!access)
      return client.send('dragonRoleReject', { reason: 'unowned' });
    if (!['follow', 'stay', 'guard', 'rest'].includes(role)) return client.send('dragonRoleReject', { reason: 'role' });
    const clearOnly = role === 'stay' && m.clearStaySpot === true;
    if ((role === 'guard' || role === 'stay') && !this.isDragonAdult(access.prof, type)) return client.send('dragonRoleReject', { reason: 'young', type, role, stage: this.dragonStage(access.prof, type) });
    if (role === 'stay' && !clearOnly && (p.dgn || '')) return client.send('dragonRoleReject', { reason: 'overworld' });
    this.ensureDragonRole(access.prof, type, role);
    const staySpot = role === 'stay' && !clearOnly ? this.setDragonStaySpot(access.prof, type, p) : null;
    const clearStaySpot = clearOnly || (role !== 'stay' && !!(access.prof.dragonStaySpots && access.prof.dragonStaySpots[type]));
    if (clearStaySpot && access.prof.dragonStaySpots) delete access.prof.dragonStaySpots[type];
    this.dirtyAndSyncDragonAccess(client, access);
    client.send('dragonRoleResult', { type, role, staySpot, clearStaySpot });
  }
  handleChooseDragonSpecialization(client, m) {
    const rec = this.profileFor(client);
    if (!rec || !m || !this.isPlayerAlive(client)) return client.send('dragonSpecializationReject', { reason: 'invalid' });
    const type = typeof m.type === 'string' ? m.type : '';
    const specialization = typeof m.specialization === 'string' ? m.specialization : '';
    const kind = 'dragon:' + type;
    if (!DRAGON_TYPE_SET.has(type) || !Array.isArray(rec.prof.mountUnlocks) || !rec.prof.mountUnlocks.includes(kind))
      return client.send('dragonSpecializationReject', { reason: 'unowned' });
    if (!['scout', 'defender', 'sage'].includes(specialization)) return client.send('dragonSpecializationReject', { reason: 'choice' });
    if (this.dragonSpecialization && this.dragonSpecialization(rec.prof, type)) return client.send('dragonSpecializationReject', { reason: 'chosen', type, specialization: this.dragonSpecialization(rec.prof, type) });
    if (!this.isDragonAdult(rec.prof, type)) return client.send('dragonSpecializationReject', { reason: 'young', type, stage: this.dragonStage(rec.prof, type) });
    if (this.dragonBondLevel(rec.prof, type) < 4) return client.send('dragonSpecializationReject', { reason: 'bond', type, level: this.dragonBondLevel(rec.prof, type), need: 4 });
    const chosen = this.setDragonSpecialization ? this.setDragonSpecialization(rec.prof, type, specialization) : '';
    if (!chosen) return client.send('dragonSpecializationReject', { reason: 'chosen', type, specialization: this.dragonSpecialization ? this.dragonSpecialization(rec.prof, type) : '' });
    this.dirtyPlayers.add(rec.token);
    this.syncPlayerProfile(client, rec.prof);
    client.send('dragonSpecializationResult', { type, specialization: chosen });
  }
  dragonTrainingSpec(role) {
    return {
      follow: { title: 'Follow Drill', need: 42, unit: 'm', award: 6 },
      guard: { title: 'Guard Drill', need: 10, unit: 's', award: 5 },
      stay: { title: 'Stay Drill', need: 10, unit: 's', award: 5 },
      rest: { title: 'Rest Drill', need: 10, unit: 's', award: 5 },
    }[role] || null;
  }
  handleStartDragonTraining(client, m) {
    const rec = this.profileFor(client);
    const p = this.state.players.get(client && client.sessionId);
    if (!rec || !p || !m || !this.isPlayerAlive(client)) return client.send('dragonTrainingReject', { reason: 'invalid' });
    const type = typeof m.type === 'string' ? m.type : '';
    const access = this.dragonAccessForClient(client, type);
    const role = typeof m.role === 'string' ? m.role : access ? this.ensureDragonRole(access.prof, type) : '';
    const kind = 'dragon:' + type, spec = this.dragonTrainingSpec(role);
    if (!DRAGON_TYPE_SET.has(type) || !access)
      return client.send('dragonTrainingReject', { reason: 'unowned' });
    if (!spec || !['follow', 'guard', 'stay', 'rest'].includes(role)) return client.send('dragonTrainingReject', { reason: 'role' });
    if (!this.isDragonAdult(access.prof, type)) return client.send('dragonTrainingReject', { reason: 'young', type, role, stage: this.dragonStage(access.prof, type) });
    if ((p.dim || 'overworld') !== 'overworld' || (p.dgn || '')) return client.send('dragonTrainingReject', { reason: 'overworld' });
    if (this.dragonIsNested(access.token, type)) return client.send('dragonTrainingReject', { reason: 'nested' });
    if (role === 'stay') {
      const s = access.prof.dragonStaySpots && access.prof.dragonStaySpots[type];
      if (!s || !Number.isFinite(Number(s.x)) || !Number.isFinite(Number(s.z))) return client.send('dragonTrainingReject', { reason: 'post' });
    }
    if (!this.dragonTraining) this.dragonTraining = new Map();
    const session = { type, role, progress: 0, need: spec.need, unit: spec.unit, title: spec.title, award: spec.award, lastX: p.x, lastZ: p.z, until: Date.now() + 90000 };
    this.dragonTraining.set(client.sessionId, session);
    client.send('dragonTrainingUpdate', { type, role, title: spec.title, progress: 0, need: spec.need, unit: spec.unit, started: true });
  }
  cancelDragonTrainingFor(sid, reason = 'cancelled') {
    if (!this.dragonTraining || !this.dragonTraining.has(sid)) return false;
    this.dragonTraining.delete(sid);
    const client = this.clients.find(c => c.sessionId === sid);
    if (client) client.send('dragonTrainingCancel', { reason });
    return true;
  }
  tickDragonTraining(now, dt) {
    if (!this.dragonTraining || !this.dragonTraining.size) return;
    for (const [sid, tr] of [...this.dragonTraining.entries()]) {
      const client = this.clients.find(c => c.sessionId === sid), rec = client && this.profileFor(client), p = this.state.players.get(sid);
      if (!client || !rec || !p || !this.isPlayerAlive(client) || now > (tr.until || 0)) { this.cancelDragonTrainingFor(sid, 'expired'); continue; }
      const access = this.dragonAccessForClient(client, tr.type);
      if (!access || (p.dim || 'overworld') !== 'overworld' || (p.dgn || '') || this.dragonIsNested(access.token, tr.type)) { this.cancelDragonTrainingFor(sid, 'interrupted'); continue; }
      const role = tr.role;
      if (role === 'follow') {
        const step = Math.hypot((p.x || 0) - (tr.lastX || p.x || 0), (p.z || 0) - (tr.lastZ || p.z || 0));
        tr.lastX = p.x; tr.lastZ = p.z;
        if (!p.mount && step >= .03 && step <= 12) tr.progress += step;
      } else if (role === 'stay') {
        const s = access.prof.dragonStaySpots && access.prof.dragonStaySpots[tr.type];
        if (!s || Math.hypot((p.x || 0) - Number(s.x), (p.z || 0) - Number(s.z)) > 18) { client.send('dragonTrainingUpdate', { type: tr.type, role, progress: Math.floor(tr.progress), need: tr.need, unit: tr.unit, waiting: 'post' }); continue; }
        tr.progress += Math.max(0, dt || 0);
      } else if (role === 'guard') {
        if (p.mount && isDragonMount(p.mount)) { client.send('dragonTrainingUpdate', { type: tr.type, role, progress: Math.floor(tr.progress), need: tr.need, unit: tr.unit, waiting: 'dismount' }); continue; }
        tr.progress += Math.max(0, dt || 0);
      } else if (role === 'rest') {
        const care = this.dragonCareFor(access.prof, tr.type);
        if (care && care.happiness >= 95) { client.send('dragonTrainingUpdate', { type: tr.type, role, progress: Math.floor(tr.progress), need: tr.need, unit: tr.unit, waiting: 'calm' }); continue; }
        tr.progress += Math.max(0, dt || 0);
      }
      if (tr.progress >= tr.need) {
        const mastery = this.awardDragonRoleMastery ? this.awardDragonRoleMastery(access.prof, tr.type, role, tr.award || 1) : null;
        const bond = this.awardDragonBondXp(access.prof, tr.type, 2, role);
        this.dirtyAndSyncDragonAccess(client, access);
        client.send('dragonTrainingComplete', { type: tr.type, role, title: tr.title, progress: tr.need, need: tr.need, unit: tr.unit, roleMastery: mastery, bondXp: bond ? bond.xp : undefined, bondLevel: bond ? bond.level : undefined, bondGained: bond ? bond.gained : 0, dragonChallenge: bond ? bond.challenge : null });
        this.dragonTraining.delete(sid);
      } else {
        client.send('dragonTrainingUpdate', { type: tr.type, role, title: tr.title, progress: Math.floor(tr.progress), need: tr.need, unit: tr.unit });
      }
    }
  }
  handleFeedMountedDragon(client, m) {
    const rec = this.profileFor(client);
    const p = this.state.players.get(client.sessionId);
    if (!rec || !p || !m || !this.isPlayerAlive(client)) return client.send('feedDragonReject', { reason: 'invalid' });
    if (!isDragonMount(p.mount)) return client.send('feedDragonReject', { reason: 'mount' });
    const type = dragonMountType(p.mount);
    const access = this.dragonAccessForClient(client, type);
    if (!DRAGON_TYPE_SET.has(type) || !access)
      return client.send('feedDragonReject', { reason: 'unowned' });
    const slot = Math.max(0, Math.min(35, m.slot | 0));
    if (!this.consumeSlotItem(rec.prof, slot, I.DRAGON_TREAT, 1)) return client.send('feedDragonReject', { reason: 'treat' });
    const care = this.feedDragonCare(access.prof, type, 20 + (this.dragonSpecialization && this.dragonSpecialization(access.prof, type) === 'sage' ? 4 : 0));
    const bond = this.awardDragonBondXp(access.prof, type, 18, 'care');
    this.dirtyAndSyncDragonAccess(client, access);
    client.send('feedDragonResult', { slot, type, happiness: care ? care.happiness : 0, fedAt: care ? care.fedAt : Date.now(), bondXp: bond ? bond.xp : 0, bondLevel: bond ? bond.level : 1, bondGained: bond ? bond.gained : 0, dragonChallenge: bond ? bond.challenge : null });
    this.sendSpace(p.dgn || '', 'fx', { t: 'dragonCare', kind: type, x: p.x, y: p.y, z: p.z, happiness: care ? care.happiness : 0, dgn: p.dgn || '' });
  }
  dragonIsNested(token, type) {
    if (!token || !type || !this.nestDragons || !this.nestDragons.size) return false;
    for (const n of this.nestDragons.values()) if (n && n.token === token && n.type === type) return true;
    return false;
  }
  dragonGuardDamage(type, bondLevel = 1) {
    const base = { ember: 7, frost: 5, storm: 6, verdant: 4, void: 5 }[type] || 5;
    return base + Math.max(0, Math.min(5, bondLevel | 0) - 1);
  }
  dragonStayDamage(type, bondLevel = 1) {
    return Math.max(3, Math.ceil(this.dragonGuardDamage(type, bondLevel) * .72));
  }
  dragonStayPostActive(anchor) {
    const radius = 80;
    let active = false;
    this.state.players.forEach((p, sid) => {
      if (active || !p || (p.dim || 'overworld') !== 'overworld' || (p.dgn || '') !== (anchor.dgn || '')) return;
      const client = this.clients.find(c => c.sessionId === sid);
      if (!client || !this.isPlayerAlive(client)) return;
      if (Math.hypot((p.x || 0) - anchor.x, (p.z || 0) - anchor.z) <= radius) active = true;
    });
    return active;
  }
  tickDragonRest(now, dt) {
    if (!this.dragonRestAcc) this.dragonRestAcc = new Map();
    const baseCap = 75;
    const perSecond = 12 / 3600;
    for (const client of this.clients) {
      const rec = this.profileFor(client);
      const p = this.state.players.get(client.sessionId);
      if (!rec || !p || !Array.isArray(rec.prof.mountUnlocks)) continue;
      for (const kind of this.effectiveMountUnlocksFor(rec.token, rec.prof, now)) {
        if (!isDragonMount(kind)) continue;
        const type = dragonMountType(kind);
        const access = this.dragonAccessForClient(client, type);
        if (!access || !DRAGON_TYPE_SET.has(type) || this.ensureDragonRole(access.prof, type) !== 'rest') continue;
        if (!this.isDragonAdult(access.prof, type, now) || this.dragonIsNested(access.token, type) || p.mount === kind) continue;
        const cap = this.dragonSpecialization && this.dragonSpecialization(access.prof, type) === 'sage' ? 90 : baseCap;
        const care = this.dragonCareFor(access.prof, type);
        if (!care || care.happiness >= cap) continue;
        const key = access.token + ':' + type;
        const personality = this.ensureDragonPersonality(access.prof, type);
        const restMastery = typeof this.dragonRoleMasteryLevel === 'function' ? this.dragonRoleMasteryLevel(access.prof, type, 'rest') : 1;
        const rate = (personality === 'gentle' ? perSecond * 1.25 : perSecond) * (1 + Math.max(0, restMastery - 1) * .08) * (this.dragonSpecialization && this.dragonSpecialization(access.prof, type) === 'sage' ? 1.25 : 1);
        let acc = (this.dragonRestAcc.get(key) || 0) + Math.max(0, dt || 0) * rate;
        const gain = Math.min(cap - care.happiness, Math.floor(acc));
        if (gain <= 0) { this.dragonRestAcc.set(key, acc); continue; }
        acc -= gain;
        care.happiness = Math.min(cap, care.happiness + gain);
        care.fedAt = now;
        this.dragonRestAcc.set(key, acc);
        const bond = this.awardDragonBondXp(access.prof, type, 1, 'rest');
        const mastery = this.awardDragonRoleMastery ? this.awardDragonRoleMastery(access.prof, type, 'rest', gain) : null;
        this.dirtyAndSyncDragonAccess(client, access);
        client.send('dragonCare', { type, happiness: care.happiness, fedAt: care.fedAt, rest: true, bondXp: bond ? bond.xp : undefined, bondLevel: bond ? bond.level : undefined, bondGained: bond ? bond.gained : 0, dragonChallenge: bond ? bond.challenge : null, roleMastery: mastery });
        this.sendSpace(p.dgn || '', 'fx', { t: 'dragonRest', kind: type, x: p.x, y: p.y, z: p.z, owner: client.sessionId, gain, happiness: care.happiness, masteryLevel: mastery ? mastery.level : restMastery, dgn: p.dgn || '' });
      }
    }
  }
  tickDragonFollowBond(now) {
    if (!this.dragonFollowBondTravel) this.dragonFollowBondTravel = new Map();
    for (const client of this.clients) {
      const rec = this.profileFor(client);
      const p = this.state.players.get(client.sessionId);
      if (!rec || !p || !Array.isArray(rec.prof.mountUnlocks)) continue;
      const movingInWorld = (p.dim || 'overworld') === 'overworld' && !(p.dgn || '') && !p.mount && this.isPlayerAlive(client);
      for (const kind of this.effectiveMountUnlocksFor(rec.token, rec.prof, now)) {
        if (!isDragonMount(kind)) continue;
        const type = dragonMountType(kind);
        const access = this.dragonAccessForClient(client, type);
        if (!access || !DRAGON_TYPE_SET.has(type) || this.ensureDragonRole(access.prof, type) !== 'follow') continue;
        const key = access.token + ':' + type;
        let travel = this.dragonFollowBondTravel.get(key);
        if (!travel || !movingInWorld) {
          this.dragonFollowBondTravel.set(key, { x: p.x, z: p.z, dist: travel ? travel.dist || 0 : 0, lastAward: travel ? travel.lastAward || 0 : 0 });
          continue;
        }
        const step = Math.hypot(p.x - travel.x, p.z - travel.z);
        travel.x = p.x; travel.z = p.z;
        if (!this.isDragonAdult(access.prof, type, now) || this.dragonIsNested(access.token, type) || step < 0.05 || step > 12) {
          this.dragonFollowBondTravel.set(key, travel);
          continue;
        }
        travel.dist = Math.min(240, (travel.dist || 0) + step);
        const followMastery = typeof this.dragonRoleMasteryLevel === 'function' ? this.dragonRoleMasteryLevel(access.prof, type, 'follow') : 1;
        const scout = this.dragonSpecialization && this.dragonSpecialization(access.prof, type) === 'scout';
        const needDist = Math.max(70, (120 - Math.max(0, followMastery - 1) * 8) * (scout ? .9 : 1));
        const needMs = Math.max(26000, (45000 - Math.max(0, followMastery - 1) * 2500) * (scout ? .9 : 1));
        if (travel.dist < needDist || now - (travel.lastAward || 0) < needMs) {
          this.dragonFollowBondTravel.set(key, travel);
          continue;
        }
        travel.dist -= needDist;
        travel.lastAward = now;
        const bond = this.awardDragonBondXp(access.prof, type, 1, 'follow');
        const mastery = this.awardDragonRoleMastery ? this.awardDragonRoleMastery(access.prof, type, 'follow', 1) : null;
        this.dragonFollowBondTravel.set(key, travel);
        this.dirtyAndSyncDragonAccess(client, access);
        client.send('dragonBond', { type, bondXp: bond ? bond.xp : undefined, bondLevel: bond ? bond.level : undefined, bondGained: bond ? bond.gained : 0, reason: 'follow', dragonChallenge: bond ? bond.challenge : null, roleMastery: mastery });
      }
    }
  }
  tickDragonGuards(now) {
    if (!this.dragonGuardCd) this.dragonGuardCd = new Map();
    this.state.players.forEach((p, sid) => {
      const client = this.clients.find(c => c.sessionId === sid);
      const rec = client && this.profileFor(client);
      if (!client || !rec || !this.isPlayerAlive(client)) return;
      const unlocks = this.effectiveMountUnlocksFor(rec.token, rec.prof, now);
      for (const kind of unlocks) {
        if (!isDragonMount(kind)) continue;
        const type = dragonMountType(kind);
        const access = this.dragonAccessForClient(client, type);
        if (!access) continue;
        const role = this.ensureDragonRole(access.prof, type);
        if (!DRAGON_TYPE_SET.has(type) || (role !== 'guard' && role !== 'stay')) continue;
        if (!this.isDragonAdult(access.prof, type, now) || this.dragonIsNested(access.token, type)) continue;
        if (p.mount === kind || (role === 'guard' && isDragonMount(p.mount))) continue;
        const spots = access.prof.dragonStaySpots && typeof access.prof.dragonStaySpots === 'object' ? access.prof.dragonStaySpots : {};
        const spot = role === 'stay' ? spots[type] : null;
        if (role === 'stay' && (!spot || !Number.isFinite(Number(spot.x)) || !Number.isFinite(Number(spot.z)))) continue;
        const anchor = role === 'stay' ? { x: Number(spot.x), y: Number(spot.y) || p.y, z: Number(spot.z), dgn: '' } : p;
        if (role === 'stay' && !this.dragonStayPostActive(anchor)) continue;
        const key = sid + ':' + type + ':' + role;
        if (now < (this.dragonGuardCd.get(key) || 0)) continue;
        const masteryLevel = typeof this.dragonRoleMasteryLevel === 'function' ? this.dragonRoleMasteryLevel(access.prof, type, role) : 1;
        const defender = this.dragonSpecialization && this.dragonSpecialization(access.prof, type) === 'defender';
        let best = null, bestId = '', bd = (role === 'stay' ? 9.5 : 7.5) + Math.max(0, masteryLevel - 1) * .35 + (defender ? 1 : 0);
        this.state.mobs.forEach((mob, id) => {
          const meta = this.mobMeta[id];
          if (!mob || mob.hp <= 0 || (mob.dgn || '') !== (anchor.dgn || '') || this.isAnimalKind(mob.kind) || (meta && meta.friendly)) return;
          const d = Math.hypot(mob.x - anchor.x, mob.z - anchor.z);
          if (d < bd) { bd = d; best = mob; bestId = id; }
        });
        if (!best) continue;
        const level = this.dragonBondLevel(access.prof, type);
        const personality = this.ensureDragonPersonality(access.prof, type);
        const cooldownBase = role === 'stay'
          ? (personality === 'bold' ? 8500 : personality === 'gentle' ? 10500 : 9500)
          : (personality === 'bold' ? 3800 : personality === 'gentle' ? 5200 : 4600);
        const cooldown = Math.round(cooldownBase * (defender ? .9 : 1) * (1 - Math.min(.15, (level - 1) * .025) - Math.min(.1, Math.max(0, masteryLevel - 1) * .025)));
        this.dragonGuardCd.set(key, now + cooldown);
        const damage = (role === 'stay' ? this.dragonStayDamage(type, level) : this.dragonGuardDamage(type, level)) + Math.floor(Math.max(0, masteryLevel - 1) / 2) + (defender ? 1 : 0);
        this.damageMobByAbility(client, bestId, best, damage);
        const bond = this.awardDragonBondXp(access.prof, type, role === 'stay' ? (personality === 'bold' ? 2 : 1) : (personality === 'bold' ? 3 : 2), role);
        const mastery = this.awardDragonRoleMastery ? this.awardDragonRoleMastery(access.prof, type, role, 1) : null;
        this.dirtyAndSyncDragonAccess(client, access);
        client.send('dragonBond', { type, bondXp: bond ? bond.xp : undefined, bondLevel: bond ? bond.level : undefined, bondGained: bond ? bond.gained : 0, reason: role, dragonChallenge: bond ? bond.challenge : null, roleMastery: mastery });
        this.sendSpace(anchor.dgn || '', 'fx', { t: 'dragonGuard', kind: type, role, x: best.x, y: best.y + .8, z: best.z, postX: anchor.x, postY: anchor.y, postZ: anchor.z, owner: sid, damage, bondGained: bond ? bond.gained : 0, masteryLevel: mastery ? mastery.level : masteryLevel, dgn: anchor.dgn || '' });
      }
    });
  }
  tickNestBreeding() {
    if (!this.nestDragons || !this.nestDragons.size) return;
    const now = Date.now();
    const byNest = new Map();
    for (const [key, n] of this.nestDragons) {
      const coord = key.split('#')[0];
      if (!byNest.has(coord)) byNest.set(coord, []);
      byNest.get(coord).push(n);
    }
    for (const [coord, list] of byNest) {
      if (list.length < DRAGON_PERCH_SLOTS) { for (const n of list) n.breedStart = 0; continue; }
      const [a, b] = list;
      const offspring = a.token === b.token ? dragonOffspring(a.type, b.type) : '';   // breed only your own pair
      const compatibleGender = a.type === b.type || ((a.gender || this.defaultDragonGender(a.type)) !== (b.gender || this.defaultDragonGender(b.type)));
      const fertile = offspring && compatibleGender && a.loveUntil > now && b.loveUntil > now && now >= (a.breedCdUntil || 0) && now >= (b.breedCdUntil || 0);
      if (!fertile) { a.breedStart = 0; b.breedStart = 0; continue; }
      if (!a.breedStart) { a.breedStart = b.breedStart = now; }
      if (now - a.breedStart < DRAGON_BREED_MS) continue;
      // lay the egg into the owner's inventory
      const token = a.token, eggId = DRAGON_EGG_OF(offspring);
      const c = this.clients.find(cl => this.tokens.get(cl.sessionId) === token);
      if (c) this.awardGrant(c, { source: 'breed', items: [{ id: eggId, count: 1 }] });
      else { const prof = this.profiles.get(token); if (prof) { this.addRewardItem(prof, eggId, 1); this.dirtyPlayers.add(token); } }
      a.loveUntil = 0; b.loveUntil = 0; a.breedStart = 0; b.breedStart = 0;
      a.breedCdUntil = now + DRAGON_BREED_CD_MS; b.breedCdUntil = now + DRAGON_BREED_CD_MS;
      this.dirtyNests = true;
      const [x, y, z] = coord.split(',').map(Number);
      this.broadcast('dragonPerchBreed', { x, y, z, offspring, parents: [a.type, b.type] });
    }
  }
  // Fang familiar: its bodies bite the nearest hostile mob near the owner on a cooldown.
  tickFangCombat(now) {
    if (!this.fangCd) this.fangCd = new Map();
    this.state.players.forEach((p, sid) => {
      if (p.familiar !== 'fang') return;
      if (this.familiarMechanicsSuspended(sid)) return;
      const hp = this.playerHp.get(sid);
      if (!hp || hp.hp <= 0) return;
      if (now < (this.fangCd.get(sid) || 0)) return;
      let best = null, bestId = '', bd = FANG_RANGE;
      this.state.mobs.forEach((m, id) => {
        if ((m.dgn || '') !== (p.dgn || '') || m.hp <= 0 || this.isAnimalKind(m.kind)) return;
        const d = Math.hypot(m.x - p.x, m.z - p.z);
        if (d < bd) { bd = d; best = m; bestId = id; }
      });
      if (!best) return;
      const c = this.clients.find(cl => cl.sessionId === sid);
      if(!c)return;
      const lvl=this.familiarPowerLevel(c,'fang'), strikes=fangStrikes(lvl), lethal=best.hp<=fangDamage(lvl)*strikes;
      this.fangCd.set(sid, now + fangCooldown(lvl));
      this.damageMobByAbility(c, bestId, best, fangDamage(lvl)*strikes);
      this.awardFamiliarXp(c,'fang',lethal?12:2,lethal?'pack_kill':'pack_attack');
      this.sendSpace(p.dgn || '', 'fx', { t: 'fangBite', x: best.x, y: best.y + 0.6, z: best.z, strikes, dgn: p.dgn || '' });
    });
  }
  // Mote familiar: passively regenerates the owner's HP, with an emergency heal-burst near threats at higher ranks.
  tickMote(dt) {
    if (!this.moteAcc) { this.moteAcc = new Map(); this.moteBurstCd = new Map(); }
    const now = Date.now();
    this.state.players.forEach((p, sid) => {
      if (p.familiar !== 'mote') { if (this.moteAcc.get(sid)) this.moteAcc.set(sid, 0); return; }
      if (this.familiarMechanicsSuspended(sid)) return;
      const hp = this.playerHp.get(sid);
      if (!hp || hp.hp <= 0) return;
      const c = this.clients.find(cl => cl.sessionId === sid);
      if (!c) return;
      const lvl=this.familiarPowerLevel(c,'mote');
      const token = this.tokens.get(sid);
      if (hp.hp < hp.max) {                                   // passive regen (fractional accumulator)
        let acc = (this.moteAcc.get(sid) || 0) + dt * moteRegen(lvl);
        const whole = Math.floor(acc);
        if (whole > 0) {
          acc -= whole;
          const heal = Math.min(whole, hp.max - hp.hp);
          if (heal > 0) { hp.hp += heal; c.send('hurt', { n: -heal, reason:'mote_regen' }); this.awardFamiliarXp(c,'mote',heal,'effective_heal'); if (token) this.dirtyPlayers.add(token); }
        }
        this.moteAcc.set(sid, acc);
      }
      if (famTier(lvl) >= MOTE_BURST_MIN_TIER && hp.hp < hp.max && now >= (this.moteBurstCd.get(sid) || 0)) {
        let threat = false;
        this.state.mobs.forEach(m => { if (threat || (m.dgn || '') !== (p.dgn || '') || m.hp <= 0 || this.isAnimalKind(m.kind)) return; if (Math.hypot(m.x - p.x, m.z - p.z) < MOTE_BURST_RANGE) threat = true; });
        if (threat) {
          this.moteBurstCd.set(sid, now + moteBurstCooldown(lvl));
          const heal = Math.min(moteBurst(lvl), hp.max - hp.hp);
          if (heal > 0) { hp.hp += heal; c.send('hurt', { n: -heal, reason:'mote_burst' }); this.awardFamiliarXp(c,'mote',heal*2,'emergency_bloom'); if (token) this.dirtyPlayers.add(token); }
          this.sendSpace(p.dgn || '', 'fx', { t: 'moteBurst', x: p.x, y: p.y + 1, z: p.z, dgn: p.dgn || '' });
        }
      }
    });
  }
}

module.exports = DragonsMixin.prototype;
