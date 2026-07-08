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
const { createStore, sanitizeProfile, mergeClientSave, defaultProfile, cleanToken, sanitizeUtilityLoadout } = require('../store');
const FAMILIAR_SYSTEM = require('../../shared/familiar-system');

class DragonsMixin {
  // Dragon incubation and nesting state, co-located with the mixin that owns it.
  // Called once from onCreate, before the incubation/nest restore loaders run.
  initDragonState() {
    this.dragonIncubations = new Map();
    this.nestDragons = new Map();        // "x,y,z#slot" -> { type, token, loveUntil, breedCdUntil, breedAccum }
  }

  hasMountUnlock(client, kind) {
    const rec = this.profileFor(client);
    return !!(rec && Array.isArray(rec.prof.mountUnlocks) && rec.prof.mountUnlocks.includes(kind));
  }
  hasFamiliarUnlock(client, kind) {
    const rec = this.profileFor(client);
    return !!(rec && Array.isArray(rec.prof.familiarUnlocks) && rec.prof.familiarUnlocks.includes(kind));
  }
  familiarPowerLevel(client, kind) {
    const rec=this.profileFor(client), xp=rec&&rec.prof.familiarXp&&rec.prof.familiarXp[kind]||0;
    return FAMILIAR_SYSTEM.bondLevel(xp);
  }
  awardFamiliarXp(client, kind, amount, reason) {
    const rec=this.profileFor(client), p=client&&this.state.players.get(client.sessionId);
    if(!rec||!p||p.familiar!==kind||!FAMILIAR_KINDS.has(kind))return 0;
    if(!rec.prof.familiarXp)rec.prof.familiarXp={shade:0,fang:0,mote:0,sprite:0};
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
    const now=Date.now(),since=now-3600000,kinds=['shade','fang','mote','sprite'];
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
    if (!this.consumeItem(rec.prof, FAMILIAR_BIND_ITEM[kind], 1)) return client.send('familiarReject', { reason: 'item' });
    rec.prof.familiarUnlocks.push(kind);
    if(!rec.prof.familiarXp)rec.prof.familiarXp={shade:0,fang:0,mote:0,sprite:0};
    this.dirtyPlayers.add(rec.token);
    this.syncPlayerProfile(client, rec.prof);
    client.send('familiarBound', { kind });
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
      this.broadcast('dragonIncubationReady', { x: inc.x, y: inc.y, z: inc.z, type: inc.type, eggId: inc.eggId, ownerSid: inc.ownerSid || '' });
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
    this.dirtyPlayers.add(rec.token);
    this.syncPlayerProfile(client, rec.prof);
    this.ensureDragonIncubations().delete(key);
    this.dirtyIncubations = true;
    this.broadcast('dragonIncubationComplete', { x: inc.x, y: inc.y, z: inc.z, type: inc.type, eggId: inc.eggId, kind, ownerSid: client.sessionId });
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
    const inc = { x, y, z, type, eggId: egg.id | 0, token: rec.token, ownerSid: client.sessionId, slot, startedAt: now, finishAt: now + incubationMs };
    incubations.set(key, inc);
    this.dirtyIncubations = true;
    this.broadcast('dragonIncubationStart', { x, y, z, type, eggId: inc.eggId, slot, startedAt: inc.startedAt, finishAt: inc.finishAt, incubationMs, now });
  }

  // ---------------- dragon breeding: perch two dragons at a nest, feed treats, lay an egg ----------------
  nestSlotKey(x, y, z, slot) { return x + ',' + y + ',' + z + '#' + slot; }
  sendNestDragons(client) {
    const now = Date.now();
    for (const [key, n] of this.nestDragons) {
      const [coord, slotStr] = key.split('#');
      const [x, y, z] = coord.split(',').map(Number);
      client.send('dragonPerchAdd', { key, x, y, z, slot: +slotStr, type: n.type, loveUntil: n.loveUntil || 0, now });
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
    let slot = -1;
    for (let s = 0; s < DRAGON_PERCH_SLOTS; s++) if (!this.nestDragons.has(this.nestSlotKey(x, y, z, s))) { slot = s; break; }
    if (slot < 0) return client.send('perchReject', { reason: 'full' });
    const type = dragonMountType(kind);
    this.nestDragons.set(this.nestSlotKey(x, y, z, slot), { type, token: rec.token, loveUntil: 0, breedCdUntil: 0, breedStart: 0 });
    this.dirtyNests = true;
    if (p.mount === kind) p.mount = '';                  // the dragon is now nesting, not ridden
    this.broadcast('dragonPerchAdd', { key: this.nestSlotKey(x, y, z, slot), x, y, z, slot, type, loveUntil: 0, now: Date.now() });
  }
  handleRecallDragon(client, m) {
    const rec = this.profileFor(client);
    if (!rec || !m) return;
    const key = typeof m.key === 'string' ? m.key : '';
    const n = this.nestDragons.get(key);
    if (!n || n.token !== rec.token) return client.send('perchReject', { reason: 'notyours' });
    this.nestDragons.delete(key);
    this.dirtyNests = true;
    this.broadcast('dragonPerchRemove', { key });
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
    if (this.countItem(rec.prof, I.DRAGON_TREAT) < 1) return client.send('perchReject', { reason: 'treat' });
    this.consumeItem(rec.prof, I.DRAGON_TREAT, 1);
    const care = this.feedDragonCare(rec.prof, n.type, 16);
    this.dirtyPlayers.add(rec.token);
    this.syncPlayerProfile(client, rec.prof);
    n.loveUntil = now + DRAGON_LOVE_MS;
    this.dirtyNests = true;
    const [coord, slotStr] = key.split('#');
    const [x, y, z] = coord.split(',').map(Number);
    this.broadcast('dragonPerchLove', { key, x, y, z, slot: +slotStr, type: n.type, loveUntil: n.loveUntil, happiness: care ? care.happiness : 0, now });
    client.send('dragonCare', { type: n.type, happiness: care ? care.happiness : 0, fedAt: care ? care.fedAt : now });
  }
  handleFeedMountedDragon(client, m) {
    const rec = this.profileFor(client);
    const p = this.state.players.get(client.sessionId);
    if (!rec || !p || !m || !this.isPlayerAlive(client)) return client.send('feedDragonReject', { reason: 'invalid' });
    if (!isDragonMount(p.mount)) return client.send('feedDragonReject', { reason: 'mount' });
    const type = dragonMountType(p.mount);
    if (!DRAGON_TYPE_SET.has(type) || !Array.isArray(rec.prof.mountUnlocks) || !rec.prof.mountUnlocks.includes(p.mount))
      return client.send('feedDragonReject', { reason: 'unowned' });
    const slot = Math.max(0, Math.min(35, m.slot | 0));
    if (!this.consumeSlotItem(rec.prof, slot, I.DRAGON_TREAT, 1)) return client.send('feedDragonReject', { reason: 'treat' });
    const care = this.feedDragonCare(rec.prof, type, 20);
    this.dirtyPlayers.add(rec.token);
    this.syncPlayerProfile(client, rec.prof);
    client.send('feedDragonResult', { slot, type, happiness: care ? care.happiness : 0, fedAt: care ? care.fedAt : Date.now() });
    this.sendSpace(p.dgn || '', 'fx', { t: 'dragonCare', kind: type, x: p.x, y: p.y, z: p.z, happiness: care ? care.happiness : 0, dgn: p.dgn || '' });
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
      const fertile = offspring && a.loveUntil > now && b.loveUntil > now && now >= (a.breedCdUntil || 0) && now >= (b.breedCdUntil || 0);
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
