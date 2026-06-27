// Combat & abilities: melee attack, class/dragon abilities, legendary weapons,
// area damage helpers, and kill / mine / loot rewards. Lifted verbatim out of
// GameRoom.js and mixed into its prototype.
const {
  ABILITY_BREAKABLE, ABILITY_PATHS, ABILITY_UNLOCK, ANIMAL_LOOT, BETA_LEGENDARY_TEST, BIOME_COLLECTIBLE,
  DANGER_RINGS, DRAGON_BREATH, DRAGON_BREATH_CD_MS, DRAGON_BREATH_RANGE, DRAGON_BREATH_SPEED, DRAGON_TYPE_SET,
  I, KEY_LOOT, MINE_DROPS, REWARD_ITEMS, dangerRingAt, dragonMountType, isDragonMount, jobPerkChance,
  keyForRank, spriteForageChance,
} = require('./constants');
const { State, Player, Mob, Team, Gate } = require('../schema');
const { TeamManager } = require('../teams');
const W = require('../world');
const D = require('../dungeon');
const AI = require('../ai');
const { createStore, sanitizeProfile, mergeClientSave, defaultProfile, cleanToken, sanitizeUtilityLoadout } = require('../store');

class CombatMixin {
  // Combat-domain simulation state. Co-located here (rather than inline in
  // GameRoom.onCreate) so this mixin owns the fields it reads and writes:
  // server-simulated projectiles, ability/legendary/dragon cooldowns, and
  // per-player ability state. Called once from onCreate. `pvel` is read here
  // for shot leading but written by the core `move` handler in GameRoom.
  initCombatState() {
    this.sArrows = [];          // server-simulated projectiles
    this.sFireballs = [];       // server-simulated ability projectiles (and dragon breath)
    this.sMeteors = [];         // delayed legendary weapon impacts
    this.dragonBreathCd = new Map();   // sessionId -> next breath time
    this.blackholeCd = new Map();
    this.legendaryCd = new Map();
    this.dragonAbilityCd = new Map();
    this.phoenixUsed = new Set();
    this.abilityState = new Map();
    this.abilityBuffs = new Map();
    this.pvel = new Map();      // sessionId -> {x,z} horizontal velocity estimate (written by the move handler)
  }

  handleBlackholeStaff(client, m) {
    const rec = this.profileFor(client);
    const p = this.state.players.get(client.sessionId);
    if (!rec || !p || !m) return;
    const slot = Math.max(0, Math.min(35, m.slot | 0));
    const held = Array.isArray(rec.prof.inv) ? rec.prof.inv[slot] : null;
    const testWeapon = BETA_LEGENDARY_TEST && !!m.testWeapon;
    if (!testWeapon && (!held || held.id !== I.BLACKHOLE_STAFF)) return client.send('blackholeReject', { reason: 'staff' });
    const now = Date.now();
    const last = this.blackholeCd.get(client.sessionId) || 0;
    if (now - last < 9000) return client.send('blackholeReject', { reason: 'cooldown' });
    const mobId = String(m.id || '');
    const mob = this.state.mobs.get(mobId);
    const meta = this.mobMeta[mobId];
    if (!mob || !meta || (p.dgn || '') !== (mob.dgn || '')) return client.send('blackholeReject', { reason: 'target' });
    if (Math.hypot(mob.x - p.x, mob.z - p.z) > 26) return client.send('blackholeReject', { reason: 'range' });
    if (meta.blackhole) return client.send('blackholeReject', { reason: 'busy' });
    this.blackholeCd.set(client.sessionId, now);
    meta.blackhole = {
      t: 0,
      total: 2.8,
      sx: mob.x,
      sy: mob.y,
      sz: mob.z,
      cx: mob.x,
      cy: mob.y + 4.8,
      cz: mob.z,
      caster: client.sessionId,
      damage: mob.kind === 'boss' ? 34 : 9999,
    };
    meta.alert = true;
    mob.state = 'blackhole';
    this.sendSpace(mob.dgn || '', 'fx', { t: 'blackhole', id: mobId, x: mob.x, y: mob.y, z: mob.z, dgn: mob.dgn || '' });
  }
  handleLegendaryWeapon(client, m) {
    const rec = this.profileFor(client);
    const p = this.state.players.get(client.sessionId);
    if (!rec || !p || !m || !this.isPlayerAlive(client)) return;
    const kind = String(m.kind || '');
    const defs = {
      chrono: { id: I.CHRONO_DAGGER, cd: 12000, range: 5.2, damage: 10 },
      titan: { id: I.TITAN_HAMMER, cd: 11000, radius: 5.6, damage: 15 },
      meteor: { id: I.METEOR_STAFF, cd: 14000, range: 28, radius: 4.5, damage: 24 },
      soul: { id: I.SOUL_REAPER_SCYTHE, cd: 10000, range: 5.8, damage: 18 },
      gravity: { id: I.GRAVITY_BOW, cd: 11000, range: 28, damage: 14 },
      warden: { id: I.WARDEN_CLEAVER, cd: 12000, range: 14, damage: 20 },
      eclipse: { id: I.ECLIPSE_KATANA, cd: 10000, range: 9, damage: 16 },
      phoenix: { id: I.PHOENIX_SWORD, cd: 16000, range: 5.8, damage: 18 },
      frostbite: { id: I.FROSTBITE_CHAKRAM, cd: 12000, range: 26, damage: 14 },
      midas: { id: I.MIDAS_BLADE, cd: 8000, range: 5.8, damage: 12 },
      leviathan: { id: I.LEVIATHAN_TRIDENT, cd: 13000, range: 28, damage: 18 },
      anchor: { id: I.VOID_ANCHOR, cd: 18000, radius: 5.0, damage: 8 },
    };
    const def = defs[kind];
    if (!def) return client.send('legendaryReject', { kind, reason: 'invalid' });
    const slot = Math.max(0, Math.min(35, m.slot | 0));
    const held = Array.isArray(rec.prof.inv) ? rec.prof.inv[slot] : null;
    const testWeapon = BETA_LEGENDARY_TEST && !!m.testWeapon;
    if (!testWeapon && (!held || held.id !== def.id)) return client.send('legendaryReject', { kind, reason: 'weapon' });
    const now = Date.now();
    const key = client.sessionId + ':' + kind;
    const last = this.legendaryCd.get(key) || 0;
    if (now - last < def.cd) return client.send('legendaryReject', { kind, reason: 'cooldown' });
    const dgn = p.dgn || '';

    if (kind === 'titan') {
      this.legendaryCd.set(key, now);
      this.damageMobsInRadius(client, p.x, p.y + .5, p.z, def.radius, def.damage, { knock: 5.2, stun: .8 });
      this.breakBlocksInRadius(client, p.x, p.y + .2, p.z, 3.0, 18);
      this.sendSpace(dgn, 'fx', { t: 'legendary', kind: 'titan', x: p.x, y: p.y, z: p.z, dgn });
      return;
    } else if (kind === 'warden') {
      let dx = Number(m.dx), dz = Number(m.dz);
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      this.legendaryCd.set(key, now);
      this.state.mobs.forEach((mob, id) => {
        if ((mob.dgn || '') !== dgn || mob.hp <= 0) return;
        const rx = mob.x - p.x, rz = mob.z - p.z;
        const along = rx * dx + rz * dz;
        const side = Math.abs(rx * dz - rz * dx);
        if (along <= 0 || along > def.range || side > 1.7) return;
        this.damageMobByAbility(client, id, mob, def.damage * Math.max(.45, 1 - along / (def.range * 1.35)));
        const live = this.state.mobs.get(id);
        if (live) this.stunMobByAbility(id, live, .45);
      });
      for (let k = 1; k <= 8; k++) this.breakBlocksInRadius(client, p.x + dx * k * 1.4, p.y + .8, p.z + dz * k * 1.4, 1.1, 4);
      this.sendSpace(dgn, 'fx', { t: 'legendary', kind: 'warden', x: p.x, y: p.y, z: p.z, dx, dz, dgn });
      return;
    } else if (kind === 'anchor') {
      const x = Math.max(1, Math.min(W.WX - 2, Number.isFinite(+m.x) ? +m.x : p.x));
      const z = Math.max(1, Math.min(W.WX - 2, Number.isFinite(+m.z) ? +m.z : p.z));
      const y = Number.isFinite(+m.y) ? +m.y : p.y;
      if (Math.hypot(x - p.x, z - p.z) > 7) return client.send('legendaryReject', { kind, reason: 'range' });
      this.legendaryCd.set(key, now);
      this.damageMobsInRadius(client, x, y + .7, z, def.radius, def.damage, { slow: 4.2, stun: .9, knock: 1.2 });
      this.breakBlocksInRadius(client, x, y + .3, z, 1.7, 8);
      this.sendSpace(dgn, 'fx', { t: 'legendary', kind: 'anchor', x, y, z, dgn });
      return;
    }

    const mobId = String(m.id || '');
    const mob = this.state.mobs.get(mobId);
    const meta = this.mobMeta[mobId];
    if (!mob || !meta || (mob.dgn || '') !== dgn) return client.send('legendaryReject', { kind, reason: 'target' });
    const dist = Math.hypot(mob.x - p.x, mob.z - p.z);
    if (dist > def.range) return client.send('legendaryReject', { kind, reason: 'range' });
    if (!AI.losClear(this.spaceSolid(dgn), p.x, p.y + 1.2, p.z, mob.x, mob.y + 0.9, mob.z))
      return client.send('legendaryReject', { kind, reason: 'sight' });   // no hitting a target through a wall
    this.legendaryCd.set(key, now);

    if (kind === 'chrono') {
      const snap = { x: mob.x, y: mob.y, z: mob.z, dgn };
      meta.slowT = Math.max(meta.slowT || 0, 4);
      this.sendSpace(dgn, 'fx', { t: 'legendary', kind: 'chronoMark', x: snap.x, y: snap.y, z: snap.z, dgn });
      this.clock.setTimeout(() => {
        const live = this.state.mobs.get(mobId);
        if (!live || live.hp <= 0 || (live.dgn || '') !== dgn) return;
        live.x = snap.x; live.y = snap.y; live.z = snap.z;
        this.damageMobByAbility(client, mobId, live, def.damage);
        this.sendSpace(dgn, 'fx', { t: 'legendary', kind: 'chronoSnap', x: snap.x, y: snap.y, z: snap.z, dgn });
      }, 4000);
    } else if (kind === 'meteor') {
      this.sendSpace(dgn, 'fx', { t: 'legendary', kind: 'meteorMark', id: mobId, x: mob.x, y: mob.y, z: mob.z, dgn });
      this.sMeteors.push({ caster: client.sessionId, dgn, id: mobId, x: mob.x, y: mob.y, z: mob.z, t: 1.25, radius: def.radius, damage: def.damage });
    } else if (kind === 'soul') {
      const hpBefore = mob.hp;
      this.damageMobByAbility(client, mobId, mob, def.damage);
      const hp = this.ensurePlayerHp(client);
      hp.hp = Math.min(hp.max, hp.hp + 8);
      client.send('hurt', { n: -8 });
      const live = this.state.mobs.get(mobId);
      if (hpBefore > 0 && !live) client.send('chat', { name: '[Soul Reaper]', text: 'Soul captured.' });
      this.sendSpace(dgn, 'fx', { t: 'legendary', kind: 'soul', id: mobId, x: mob.x, y: mob.y, z: mob.z, dgn });
    } else if (kind === 'gravity') {
      meta.slowT = Math.max(meta.slowT || 0, 2.6);
      meta.gravityT = Math.max(meta.gravityT || 0, 2.2);
      meta.gravityBaseY = mob.y;
      this.stunMobByAbility(mobId, mob, 2.2);
      mob.y += 3.8;
      this.clock.setTimeout(() => {
        const live = this.state.mobs.get(mobId);
        if (!live || live.hp <= 0 || (live.dgn || '') !== dgn) return;
        live.y = Math.max(meta.gravityBaseY || live.y, live.y - 3.8);
        this.damageMobByAbility(client, mobId, live, def.damage);
      }, 2200);
      this.sendSpace(dgn, 'fx', { t: 'legendary', kind: 'gravity', id: mobId, x: mob.x, y: mob.y, z: mob.z, dgn });
    } else if (kind === 'eclipse') {
      let dx = Number(m.dx), dz = Number(m.dz);
      let len = Math.hypot(dx, dz) || Math.hypot(mob.x - p.x, mob.z - p.z) || 1;
      if (!Number.isFinite(dx) || !Number.isFinite(dz) || Math.hypot(dx, dz) < .01) { dx = (mob.x - p.x) / len; dz = (mob.z - p.z) / len; }
      else { dx /= len; dz /= len; }
      const from = { x: p.x, y: p.y, z: p.z };
      p.x = Math.max(1, Math.min(W.WX - 2, mob.x + dx * 1.35));
      p.z = Math.max(1, Math.min(W.WX - 2, mob.z + dz * 1.35));
      const gy = this.world.standHeight(p.x, p.z, p.y + 5);
      if (gy > 0) p.y = gy + .01;
      this.damageMobByAbility(client, mobId, mob, def.damage);
      const live = this.state.mobs.get(mobId);
      if (live) this.stunMobByAbility(mobId, live, .9);
      this.sendSpace(dgn, 'fx', { t: 'legendary', kind: 'eclipse', fromX: from.x, fromY: from.y, fromZ: from.z, x: p.x, y: p.y, z: p.z, dgn });
    } else if (kind === 'phoenix') {
      this.damageMobsInRadius(client, mob.x, mob.y + 1, mob.z, 2.9, def.damage, { knock: 2.0, stun: .45 });
      this.sendSpace(dgn, 'fx', { t: 'legendary', kind: 'phoenix', x: mob.x, y: mob.y, z: mob.z, dgn });
    } else if (kind === 'frostbite') {
      const jumps = [];
      const hit = new Set();
      let prevId = mobId, prev = mob;
      for (let i = 0; i < 4 && prev; i++) {
        hit.add(prevId);
        const dmg = Math.max(6, def.damage - i * 2);
        const pm = this.mobMeta[prevId];
        if (pm) pm.slowT = Math.max(pm.slowT || 0, 3.2);
        this.damageMobByAbility(client, prevId, prev, dmg);
        jumps.push({ id: prevId, x: prev.x, y: prev.y, z: prev.z });
        let nextId = '', next = null, best = 6.2;
        this.state.mobs.forEach((o, oid) => {
          if (hit.has(String(oid)) || (o.dgn || '') !== dgn || o.hp <= 0) return;
          const dd = Math.hypot(o.x - prev.x, o.z - prev.z);
          if (dd < best) { best = dd; nextId = String(oid); next = o; }
        });
        prevId = nextId; prev = next;
      }
      this.sendSpace(dgn, 'fx', { t: 'legendary', kind: 'frostbite', points: [{ x: p.x, y: p.y, z: p.z }, ...jumps], dgn });
    } else if (kind === 'midas') {
      const bonus = Math.min(18, Math.floor((rec.prof.gold || 0) / 50));
      this.damageMobByAbility(client, mobId, mob, def.damage + bonus);
      this.sendSpace(dgn, 'fx', { t: 'legendary', kind: 'midas', bonus, x: mob.x, y: mob.y, z: mob.z, dgn });
    } else if (kind === 'leviathan') {
      const jumps = [];
      const hit = new Set();
      let prevId = mobId, prev = mob;
      for (let i = 0; i < 4 && prev; i++) {
        hit.add(prevId);
        const dmg = Math.max(8, def.damage - i * 3);
        this.damageMobByAbility(client, prevId, prev, dmg);
        const pm = this.mobMeta[prevId];
        if (pm) pm.slowT = Math.max(pm.slowT || 0, 1.2);
        jumps.push({ id: prevId, x: prev.x, y: prev.y, z: prev.z });
        let nextId = '', next = null, best = 7.2;
        this.state.mobs.forEach((o, oid) => {
          if (hit.has(String(oid)) || (o.dgn || '') !== dgn || o.hp <= 0) return;
          const dd = Math.hypot(o.x - prev.x, o.z - prev.z);
          if (dd < best) { best = dd; nextId = String(oid); next = o; }
        });
        prevId = nextId; prev = next;
      }
      this.sendSpace(dgn, 'fx', { t: 'legendary', kind: 'leviathan', points: [{ x: p.x, y: p.y, z: p.z }, ...jumps], dgn });
    }
  }
  handleAbility(client, m) {
    const rec = this.profileFor(client);
    const p = this.state.players.get(client.sessionId);
    if (!rec || !p || !m || !this.isPlayerAlive(client)) return;
    const path = String(m.path || rec.prof.S.path || '');
    const slot = Math.max(0, Math.min(2, m.slot | 0));
    const def = ABILITY_PATHS[path] && ABILITY_PATHS[path][slot];
    if (!def || def.kind === 'passive') return client.send('abilityReject', { slot, reason: 'invalid' });
    if (rec.prof.S.lvl < ABILITY_UNLOCK[slot]) return client.send('abilityReject', { slot, reason: 'level' });
    if (rec.prof.S.path && rec.prof.S.path !== path) return client.send('abilityReject', { slot, reason: 'path' });
    const now = Date.now();
    const st = this.regenAbilityState(client, now);
    const cdKey = path + ':' + slot;
    if ((st.cds[cdKey] || 0) > now) {
      this.sendAbilitySync(client, st);
      return client.send('abilityReject', { slot, reason: 'cooldown' });
    }
    if (st.mp + .001 < def.mp) {
      this.sendAbilitySync(client, st);
      return client.send('abilityReject', { slot, reason: 'mana' });
    }
    st.mp -= def.mp;
    st.cds[cdKey] = now + def.cd;
    this.sendAbilitySync(client, st);

    const fx = { t: 'ability', path, slot, kind: def.kind, x: p.x, y: p.y, z: p.z, dgn: p.dgn || '' };
    let target = null, targetId = String(m.targetId || '');
    if (targetId) {
      const mob = this.state.mobs.get(targetId);
      if (mob && (mob.dgn || '') === (p.dgn || '')) target = { id: targetId, mob, meta: this.mobMeta[targetId] };
    }

    if (def.kind === 'buff') {
      const buffs = this.abilityBuffs.get(client.sessionId) || {};
      buffs.umbralUntil = now + 10000;
      this.abilityBuffs.set(client.sessionId, buffs);
    } else if (def.kind === 'armor') {
      const buffs = this.abilityBuffs.get(client.sessionId) || {};
      buffs.ironUntil = now + 15000;
      this.abilityBuffs.set(client.sessionId, buffs);
    } else if (def.kind === 'fireball') {
      this.spawnAbilityFireball(client, p, m, def, rec.prof);
      client.send('abilityResult', { path, slot, kind: def.kind, mp: Math.floor(st.mp), maxMp: st.maxMp });
      return;
    } else if (def.kind === 'frost') {
      this.damageMobsInRadius(client, p.x, p.y + .7, p.z, def.radius, 6 + Math.max(0, rec.prof.S.int - 1) * .4, { slow: 4 });
      this.breakBlocksInRadius(client, p.x, p.y + .4, p.z, 2.0, 8);
    } else if (def.kind === 'lightning') {
      if (!target || !target.meta || Math.hypot(target.mob.x - p.x, target.mob.z - p.z) > def.range ||
          !AI.losClear(this.spaceSolid(p.dgn || ''), p.x, p.y + 1.2, p.z, target.mob.x, target.mob.y + 0.9, target.mob.z)) {
        st.mp = Math.min(st.maxMp, st.mp + def.mp);
        st.cds[cdKey] = 0;
        this.sendAbilitySync(client, st);
        return client.send('abilityReject', { slot, reason: 'target' });
      }
      const jumps = this.resolveChainLightning(client, target.id, target.mob, rec.prof);
      fx.x = target.mob.x; fx.y = target.mob.y; fx.z = target.mob.z; fx.id = target.id;
      fx.jumps = jumps;
      this.breakBlocksInRadius(client, target.mob.x, target.mob.y + .5, target.mob.z, 1.2, 4);
    } else if (def.kind === 'shockwave') {
      this.damageMobsInRadius(client, p.x, p.y + .4, p.z, def.radius, 5 + Math.max(0, rec.prof.S.str - 1) * .3, { knock: 3.8 });
      this.breakBlocksInRadius(client, p.x, p.y + .2, p.z, 2.8, 16);
    }
    this.sendSpace(p.dgn || '', 'fx', fx);
    client.send('abilityResult', { path, slot, kind: def.kind, mp: Math.floor(st.mp), maxMp: st.maxMp });
  }
  dragonAbilityDir(p, m) {
    let dx = Number(m && m.dx), dy = Number(m && m.dy), dz = Number(m && m.dz);
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(dz) || Math.hypot(dx, dy, dz) < .01) {
      dx = -Math.sin(p.yaw || 0);
      dy = 0;
      dz = -Math.cos(p.yaw || 0);
    }
    const len = Math.hypot(dx, dy, dz) || 1;
    return { dx: dx / len, dy: dy / len, dz: dz / len };
  }
  safeDragonDashPoint(p, dir, range) {
    const dgn = p.dgn || '';
    const inst = dgn ? this.instances[dgn] : null;
    const get = (x, y, z) => {
      if (!W.inWorld(x, y, z)) return W.B.AIR;
      return inst ? inst.world[W.idx(x, y, z)] : this.world.getB(x, y, z);
    };
    let best = { x: p.x, y: p.y, z: p.z };
    for (let t = .75; t <= range; t += .45) {
      const x = Math.max(1.25, Math.min(W.WX - 1.25, p.x + dir.dx * t));
      const z = Math.max(1.25, Math.min(W.WX - 1.25, p.z + dir.dz * t));
      const gy = dgn && inst ? D.standHeightIn(inst.world, x, z, p.y + 6) : this.world.standHeight(x, z, p.y + 6);
      const y = gy > 0 ? gy + .01 : p.y;
      if (W.isSolid(get(Math.floor(x), Math.floor(y + .45), Math.floor(z))) ||
          W.isSolid(get(Math.floor(x), Math.floor(y + 1.35), Math.floor(z)))) break;
      best = { x, y, z };
    }
    return best;
  }
  damageMobsInCone(client, x, y, z, dir, range, width, damage, opts = {}) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return 0;
    const dgn = p.dgn || '';
    let hit = 0;
    this.state.mobs.forEach((mob, id) => {
      if ((mob.dgn || '') !== dgn || mob.hp <= 0) return;
      const vx = mob.x - x, vz = mob.z - z;
      const dist = Math.hypot(vx, vz);
      if (dist > range || dist < .01) return;
      const forward = (vx * dir.dx + vz * dir.dz) / dist;
      const side = Math.abs(vx * dir.dz - vz * dir.dx);
      if (forward < .42 || side > width + dist * .18) return;
      if (opts.slow) {
        const meta = this.mobMeta[id];
        if (meta) meta.slowT = Math.max(meta.slowT || 0, opts.slow);
      }
      if (opts.stun) {
        const live = this.state.mobs.get(id);
        if (live) this.stunMobByAbility(id, live, opts.stun);
      }
      const scaled = damage * Math.max(.4, 1 - dist / (range * 1.4));
      this.damageMobByAbility(client, id, mob, scaled);
      hit++;
    });
    return hit;
  }
  healDragonAllies(client, p, radius, amount) {
    const team = this.cleanTeamId(p.team);
    let healed = 0, healingDone = 0;
    for (const c of this.clients) {
      const op = this.state.players.get(c.sessionId);
      if (!op || (op.dgn || '') !== (p.dgn || '')) continue;
      if (team ? this.cleanTeamId(op.team) !== team : c.sessionId !== client.sessionId) continue;
      if (Math.hypot(op.x - p.x, op.z - p.z) > radius) continue;
      const hp = this.ensurePlayerHp(c);
      const before = hp.hp;
      hp.hp = Math.min(hp.max, hp.hp + amount);
      const gain = Math.round(hp.hp - before);
      if (gain > 0) {
        c.send('hurt', { n: -gain });
        healed++;
        if (c.sessionId !== client.sessionId) healingDone += gain;
      }
    }
    if (p.dgn && healingDone > 0) this.recordBossSupport(client, p.dgn, healingDone);
    return healed;
  }
  handleDragonAbility(client, m) {
    const rec = this.profileFor(client);
    const p = this.state.players.get(client.sessionId);
    if (!rec || !p || !this.isPlayerAlive(client)) return;
    if (!isDragonMount(p.mount)) return client.send('dragonAbilityReject', { reason: 'mount' });
    const type = dragonMountType(p.mount);
    const kind = 'dragon:' + type;
    if (!DRAGON_TYPE_SET.has(type) || !Array.isArray(rec.prof.mountUnlocks) || !rec.prof.mountUnlocks.includes(kind))
      return client.send('dragonAbilityReject', { reason: 'unowned' });
    if (!this.dragonAbilityCd) this.dragonAbilityCd = new Map();
    const now = Date.now();
    const cooldowns = { ember: 7000, frost: 9000, storm: 6500, verdant: 12000, void: 10000 };
    const care = this.dragonCareFor(rec.prof, type) || { happiness: 50 };
    const happyBonus = Math.max(0, Math.min(0.18, (care.happiness - 50) / 50 * 0.18));
    const cd = Math.round((cooldowns[type] || 9000) * (1 - happyBonus));
    const key = client.sessionId + ':' + type;
    const readyAt = this.dragonAbilityCd.get(key) || 0;
    if (readyAt > now) return client.send('dragonAbilityReject', { reason: 'cooldown', left: Math.ceil((readyAt - now) / 1000) });
    this.dragonAbilityCd.set(key, now + cd);

    const dir = this.dragonAbilityDir(p, m || {});
    const from = { x: p.x, y: p.y, z: p.z };
    const dgn = p.dgn || '';
    const fx = { t: 'dragonAbility', kind: type, x: p.x, y: p.y, z: p.z, dx: dir.dx, dy: dir.dy, dz: dir.dz, dgn };
    if (type === 'ember') {
      this.damageMobsInCone(client, p.x, p.y + 1, p.z, dir, 9, 1.25, 14, { stun: .25 });
      this.breakBlocksInRadius(client, p.x + dir.dx * 4.2, p.y + .6, p.z + dir.dz * 4.2, 1.35, 5);
    } else if (type === 'frost') {
      this.damageMobsInCone(client, p.x, p.y + 1, p.z, dir, 8, 1.65, 8, { slow: 5.5, stun: .35 });
    } else if (type === 'storm') {
      const to = this.safeDragonDashPoint(p, dir, 8.5);
      p.x = to.x; p.y = to.y; p.z = to.z;
      this.damageMobsInCone(client, from.x, from.y + 1, from.z, dir, 8.5, .95, 10, { stun: .65 });
      fx.fromX = from.x; fx.fromY = from.y; fx.fromZ = from.z; fx.x = p.x; fx.y = p.y; fx.z = p.z;
    } else if (type === 'verdant') {
      this.healDragonAllies(client, p, 7.5, 8);
    } else if (type === 'void') {
      const to = this.safeDragonDashPoint(p, dir, 10.5);
      p.x = to.x; p.y = to.y; p.z = to.z;
      this.damageMobsInRadius(client, p.x, p.y + 1, p.z, 2.4, 6, { slow: 2.2, stun: .35 });
      fx.fromX = from.x; fx.fromY = from.y; fx.fromZ = from.z; fx.x = p.x; fx.y = p.y; fx.z = p.z;
    }
    this.sendSpace(dgn, 'fx', fx);
    client.send('dragonAbilityResult', { type, cd: Math.ceil(cd / 1000), happiness: care.happiness | 0 });
  }
  spawnAbilityFireball(client, p, m, def, prof) {
    let dx = Number(m.dx), dy = Number(m.dy), dz = Number(m.dz);
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len; dy /= len; dz /= len;
    const speed = 15;
    const sx = p.x + dx * .8, sy = p.y + 1.25 + dy * .35, sz = p.z + dz * .8;
    const fb = {
      x: sx, y: sy, z: sz,
      vx: dx * speed, vy: dy * speed, vz: dz * speed,
      life: Math.max(.5, (def.range || 24) / speed),
      dgn: p.dgn || '',
      caster: client.sessionId,
      damage: 8 + Math.max(0, ((prof && prof.S && prof.S.int) | 0) - 1) * .6,
      radius: def.radius || 3,
    };
    this.sFireballs.push(fb);
    this.sendSpace(fb.dgn, 'arrow', { fireball: true, bolt: true, x: fb.x, y: fb.y, z: fb.z, vx: fb.vx, vy: fb.vy, vz: fb.vz, dgn: fb.dgn });
  }
  explodeAbilityFireball(fb) {
    const caster = this.clients.find(c => c.sessionId === fb.caster);
    if (caster) {
      this.damageMobsInRadius(caster, fb.x, fb.y, fb.z, fb.radius, fb.damage, fb.dmgOpts || { knock: 2.2 });
      if (!fb.breath) this.breakBlocksInRadius(caster, fb.x, fb.y, fb.z, 1.8, 8);   // breath is combat-only
    }
    if (fb.breath) this.sendSpace(fb.dgn || '', 'fx', { t: 'dragonBreath', element: fb.element, x: fb.x, y: fb.y, z: fb.z, dgn: fb.dgn || '' });
    else this.sendSpace(fb.dgn || '', 'fx', { t: 'ability', path: 'mage', slot: 0, kind: 'fireball', x: fb.x, y: fb.y, z: fb.z, dgn: fb.dgn || '' });
  }
  handleDragonBreath(client, m) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !m || !isDragonMount(p.mount)) return;
    const cfg = DRAGON_BREATH[dragonMountType(p.mount)];
    if (!cfg) return;
    const now = Date.now();
    if (now < (this.dragonBreathCd.get(client.sessionId) || 0)) return;
    this.dragonBreathCd.set(client.sessionId, now + DRAGON_BREATH_CD_MS);
    let dx = Number(m.dx), dy = Number(m.dy), dz = Number(m.dz);
    const len = Math.hypot(dx, dy, dz) || 1; dx /= len; dy /= len; dz /= len;
    const sp = DRAGON_BREATH_SPEED;
    const fb = {
      x: p.x + dx * 1.1, y: p.y + 1.5 + dy * 0.5, z: p.z + dz * 1.1,
      vx: dx * sp, vy: dy * sp, vz: dz * sp,
      life: DRAGON_BREATH_RANGE / sp,
      dgn: p.dgn || '', caster: client.sessionId,
      damage: cfg.dmg, radius: cfg.radius,
      breath: true, element: dragonMountType(p.mount), dmgOpts: cfg.opts,
    };
    this.sFireballs.push(fb);
    this.sendSpace(fb.dgn, 'arrow', { breath: true, element: fb.element, x: fb.x, y: fb.y, z: fb.z, vx: fb.vx, vy: fb.vy, vz: fb.vz, dgn: fb.dgn });
  }
  stunMobByAbility(mobId, mob, seconds) {
    const meta = this.mobMeta[String(mobId)];
    if (!mob || !meta) return;
    meta.stateT = Math.max(meta.stateT || 0, seconds);
    mob.state = 'stun';
  }
  resolveChainLightning(client, firstId, firstMob, prof) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !firstMob) return [];
    const base = 18 + Math.max(0, ((prof && prof.S && prof.S.int) | 0) - 1) * .8;
    const dgn = firstMob.dgn || '';
    const jumps = [];
    const hit = new Set();
    let prevId = String(firstId), prev = firstMob;
    for (let i = 0; i < 3 && prev; i++) {
      const dmg = base * Math.pow(.62, i);
      const stun = i === 0 ? 1.05 : .65;
      hit.add(prevId);
      this.damageMobByAbility(client, prevId, prev, dmg);
      const still = this.state.mobs.get(prevId);
      if (still) this.stunMobByAbility(prevId, still, stun);
      jumps.push({ id: prevId, x: prev.x, y: prev.y, z: prev.z, fromX: i ? jumps[i - 1].x : p.x, fromY: i ? jumps[i - 1].y + 1 : p.y + 1.3, fromZ: i ? jumps[i - 1].z : p.z, damage: Math.round(dmg) });
      let nextId = '', next = null, best = 5.8;
      this.state.mobs.forEach((m, id) => {
        if (hit.has(String(id)) || (m.dgn || '') !== dgn || m.hp <= 0) return;
        const dist = Math.hypot(m.x - prev.x, (m.y + 1) - (prev.y + 1), m.z - prev.z);
        if (dist < best) { best = dist; nextId = String(id); next = m; }
      });
      prevId = nextId; prev = next;
    }
    return jumps;
  }
  damageMobsInRadius(client, x, y, z, radius, damage, opts = {}) {
    this.state.mobs.forEach((mob, id) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || (mob.dgn || '') !== (p.dgn || '')) return;
      const d = Math.hypot(mob.x - x, (mob.y + 1) - y, mob.z - z);
      if (d > radius) return;
      const scaled = damage * Math.max(.35, 1 - d / (radius * 1.35));
      if (opts.slow) {
        const meta = this.mobMeta[id];
        if (meta) meta.slowT = Math.max(meta.slowT || 0, opts.slow);
      }
      if (opts.knock && d > .01) {
        mob.x += (mob.x - x) / d * .45;
        mob.z += (mob.z - z) / d * .45;
      }
      this.damageMobByAbility(client, id, mob, scaled);
      if (opts.stun) {
        const live = this.state.mobs.get(id);
        if (live) this.stunMobByAbility(id, live, opts.stun);
      }
    });
  }
  damageMobByAbility(client, mobId, mob, damage) {
    if (!mob || mob.hp <= 0) return;
    if (!this.isAnimalKind(mob.kind)) this.alertPack(String(mobId));
    if (mob.kind === 'boss' && mob.dgn) this.recordBossContribution(client, mob.dgn, damage);
    this.emitDamageNumber(client, mob, damage, false);
    mob.hp -= Math.max(0, damage);
    if (mob.hp <= 0) this.finishMobKill(client, mobId, mob);
  }
  // Tell the attacker the actual damage their hit dealt, so the client can float a
  // number over the mob. Server-authoritative — no client-side damage prediction.
  emitDamageNumber(client, mob, damage, crit) {
    if (!client || !mob) return;
    const n = Math.round(damage);
    if (n <= 0) return;
    client.send('dmgnum', { x: mob.x, y: mob.y, z: mob.z, n, crit: !!crit });
  }
  handleAttack(client, m) {
    if (!m) return;
    const mobId = String(m.id);
    const mob = this.state.mobs.get(mobId);
    if (!mob) return;
    const p = this.state.players.get(client.sessionId);
    if (!p || (p.dgn || '') !== (mob.dgn || '')) return;
    if (!this.isPlayerAlive(client)) return;
    const now = Date.now();
    if (!this.lastAttackMsg) this.lastAttackMsg = new Map();
    const profile = this.meleeProfile(p, client.sessionId);
    if (now - (this.lastAttackMsg.get(client.sessionId) || 0) < profile.cd) return;   // per-weapon swing cadence
    this.lastAttackMsg.set(client.sessionId, now);
    if (Math.hypot(mob.x - p.x, mob.z - p.z) > 4.5 || Math.abs(mob.y - p.y) > 3) return;   // melee reach (3D)
    // require line of sight, matching the mob side — no hitting through walls
    if (!AI.losClear(this.spaceSolid(p.dgn || ''), p.x, p.y + 1.2, p.z, mob.x, mob.y + 0.9, mob.z)) return;
    const crit = mob.state === 'stun';
    let dmg = this.serverDamageFor(p, client.sessionId);
    if (crit) dmg *= 1.5;
    if (!this.isAnimalKind(mob.kind)) this.alertPack(mobId);
    if (mob.kind === 'boss' && mob.dgn) this.recordBossContribution(client, mob.dgn, dmg);
    this.emitDamageNumber(client, mob, dmg, crit);
    mob.hp -= dmg;
    if (mob.hp <= 0) this.finishMobKill(client, mobId, mob);
  }
  breakBlocksInRadius(client, x, y, z, radius, maxBreaks) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return 0;
    const dgn = p.dgn || '';
    const inst = dgn ? this.instances[dgn] : null;
    const out = [];
    const minX = Math.floor(x - radius), maxX = Math.ceil(x + radius);
    const minY = Math.floor(y - radius), maxY = Math.ceil(y + radius);
    const minZ = Math.floor(z - radius), maxZ = Math.ceil(z + radius);
    for (let bx = minX; bx <= maxX; bx++) for (let by = minY; by <= maxY; by++) for (let bz = minZ; bz <= maxZ; bz++) {
      if (!W.inWorld(bx, by, bz)) continue;
      if (Math.hypot(bx + .5 - x, by + .5 - y, bz + .5 - z) > radius) continue;
      if (!dgn && W.isLavaBorderLand(bx, bz)) continue;
      if (!dgn && this.isTownProtected(bx, bz)) continue;
      if (!dgn && this.isLandOwnedByOther(client, bx, bz)) continue;
      if (!dgn && this.isEventProtectedBlock(bx, by, bz)) continue;
      const id = inst ? inst.world[W.idx(bx, by, bz)] : this.world.getB(bx, by, bz);
      if (!ABILITY_BREAKABLE.has(id)) continue;
      if (id === W.B.BEDROCK || id === W.B.CHEST || id === W.B.FURNACE) continue;
      out.push({ x: bx, y: by, z: bz, id, score: Math.hypot(bx + .5 - x, by + .5 - y, bz + .5 - z) });
    }
    out.sort((a, b) => a.score - b.score);
    let n = 0;
    for (const b of out.slice(0, maxBreaks)) {
      if (inst) {
        inst.world[W.idx(b.x, b.y, b.z)] = W.B.AIR;
        inst.edits.push({ x: b.x, y: b.y, z: b.z, id: W.B.AIR });
        this.sendSpace(dgn, 'dedit', { x: b.x, y: b.y, z: b.z, id: W.B.AIR });
      } else {
        this.world.setB(b.x, b.y, b.z, W.B.AIR);
        this.state.edits.set(b.x + ',' + b.y + ',' + b.z, W.B.AIR);
        this.dirtyWorld = true;
      }
      n++;
    }
    return n;
  }
  finishMobKill(client, mobId, mob) {
    const wasBoss = mob.kind === 'boss', dgn = mob.dgn, kind = mob.kind;
    const killedMeta = this.mobMeta[mobId] || {};
    const dx = mob.x, dy = mob.y, dz = mob.z;
    this.state.mobs.delete(String(mobId));
    delete this.mobMeta[mobId];
    if (dgn) this.removeTransient(dgn, String(mobId));
    if (wasBoss && dgn) this.onBossDown(dgn);
    else if (kind === 'orb' || kind === 'ghost') { /* hazard entities: no reward */ }
    else if (client) {
      const ring = dgn ? 0 : Math.max(0, Math.min(3, killedMeta.dangerRing | 0));
      let items = dgn ? [] : this.rollOverworldKeyDrops(ring);
      if (!dgn && this.isAnimalKind(kind)) items = (ANIMAL_LOOT[kind] || [{ id: I.MONSTER_MEAT, count: 1 }]).map(it => ({ ...it }));
      else if (!dgn) {
        items.push({ id: I.MONSTER_MEAT, count: 1 + Math.floor(ring / 2) });
        if (killedMeta.elite) {
          items.push({ id: ring >= 3 ? I.DIAMOND : I.IRON_INGOT, count: ring >= 3 ? 2 : 1 + ring });
          const regional = BIOME_COLLECTIBLE[W.biomeAt(dx, dz)];
          if (regional) items.push({ id: regional.item, count: 1 + ring });
        }
      }
      const baseXp = this.isAnimalKind(kind) ? 4 : 12;
      this.awardGrant(client, { source: this.isAnimalKind(kind) ? 'hunt' : 'mob', xp: Math.round(baseXp * DANGER_RINGS[ring].loot * (killedMeta.elite ? 1.75 : 1)), items, dangerRing: ring, elite: !!killedMeta.elite });
      this.recordKillProgress(client);
      if (!dgn && killedMeta.elite && killedMeta.campId)
        this.progressRegionalContract(client, 'clear_elite_camp', { targetId: killedMeta.campId });
      if (dgn) this.onDungeonTrashDeath(dgn, dx, dy, dz);
    }
  }
  awardMine(client, blockId, slot, x, y, z) {
    const rec = this.profileFor(client);
    if (rec && !this.canMineDrop(rec.prof, blockId, slot)) {
      client.send('mineNoDrop', { block: blockId, reason: 'tool' });
      return;
    }
    this.damageTool(client, rec, slot, blockId);
    let drop = MINE_DROPS[blockId];
    if (drop === undefined) drop = { item: blockId, count: 1 };
    if (drop === null) return;
    const items = [{ id: drop.item, count: drop.count || 1 }];
    if (rec && Math.random() < jobPerkChance(rec.prof, 'miner', 0.08)) items[0].count += 1;
    const fp = this.state.players.get(client.sessionId);
    if (fp && fp.familiar === 'sprite' && Math.random() < spriteForageChance(fp.lvl)) items[0].count += 1;   // Sprite foraging bonus

    if (blockId === W.B.GRASS && Math.random() < 0.35) items.push({ id: I.WHEAT_SEEDS, count: 1 });
    if (Number.isFinite(x) && Number.isFinite(z)) {
      const ring = dangerRingAt(x, z);
      const regional = BIOME_COLLECTIBLE[W.biomeAt(x, z)];
      const findRoll = W.hash2(x * 131 + blockId * 17, z * 197 + (y | 0) * 29);
      if (ring > 0 && W.hash2(x * 59 + blockId, z * 83 + (y | 0)) > .9 - ring * .08) items[0].count += 1;
      if (regional && regional.blocks.has(blockId) && findRoll > .78 - ring * .04) {
        const count = 1 + Math.floor(ring / 2);
        items.push({ id: regional.item, count });
        client.send('biomeFind', { item: regional.item, name: regional.name, count, ring });
      }
    }
    this.awardGrant(client, {
      source: 'mine',
      block: blockId,
      xp: Math.round((drop.xp || 0) * DANGER_RINGS[Number.isFinite(x) && Number.isFinite(z) ? dangerRingAt(x, z) : 0].loot),
      items,
    });
    this.recordMineProgress(client, blockId);
  }
  rollBossKeyDrops(rank) {
    const next = Math.min(4, (rank | 0) + 1);
    const items = [{ id: keyForRank('solo', next), count: 1 }];
    if (Math.random() < KEY_LOOT.bossTeamByRank[Math.max(0, Math.min(4, rank | 0))]) items.push({ id: keyForRank('team', next), count: 1 });
    return items;
  }
  rollOverworldKeyDrops(ring = 0) {
    const items = [];
    const mul = 1 + Math.max(0, Math.min(3, ring | 0)) * .8;
    if (Math.random() < KEY_LOOT.overworldSolo * mul) items.push({ id: keyForRank('solo', Math.min(2, ring)), count: 1 });
    if (Math.random() < KEY_LOOT.overworldTeam * mul) items.push({ id: keyForRank('team', Math.min(2, ring)), count: 1 });
    return items;
  }
  awardLoot(client, loot) {
    const rec = this.profileFor(client);
    if (rec) {
      if (loot.xp) {
        const S = rec.prof.S;
        S.xp += Math.max(0, loot.xp | 0);
        while (S.xp >= this.xpNeed(S.lvl)) {
          S.xp -= this.xpNeed(S.lvl);
          S.lvl++;
          S.pts += 3;
        }
      }
      rec.prof.gold = Math.max(0, Math.min(1e9, (rec.prof.gold | 0) + (loot.gold | 0)));
      if (loot.coal) this.addRewardItem(rec.prof, REWARD_ITEMS.coal, loot.coal);
      if (loot.iron) this.addRewardItem(rec.prof, REWARD_ITEMS.iron, loot.iron);
      if (loot.dia) this.addRewardItem(rec.prof, REWARD_ITEMS.dia, loot.dia);
      for (const item of loot.items || []) this.addRewardItem(rec.prof, item.id, item.count);
      this.syncPlayerProfile(client, rec.prof);
      this.dirtyPlayers.add(rec.token);
    }
    client.send('loot', loot);
  }
  markGateCleared(client, rank) {
    const rec = this.profileFor(client);
    if (!rec) return null;
    const ri = Math.max(0, Math.min(4, rank | 0));
    const before = Math.max(-1, Math.min(4, rec.prof.highestGateRankCleared | 0));
    if (!this.worldProgress) this.worldProgress = { highestGateRankCleared: -1 };
    if ((this.worldProgress.highestGateRankCleared | 0) < ri) {
      this.worldProgress.highestGateRankCleared = ri;
      this.dirtyWorldProgress = true;
    }
    const p = this.state.players.get(client.sessionId);
    const teamId = p ? this.cleanTeamId(p.team) : '';
    const team = teamId ? this.teamRecords.get(teamId) : null;
    if (team && (team.highestGateRankCleared | 0) < ri) {
      team.highestGateRankCleared = ri;
      this.dirtyTeams = true;
    }
    if ((rec.prof.highestGateRankCleared | 0) < ri) {
      rec.prof.highestGateRankCleared = ri;
      this.dirtyPlayers.add(rec.token);
      client.send('profile', rec.prof);
    }
    const after = Math.max(-1, Math.min(4, rec.prof.highestGateRankCleared | 0));
    this.recordGateProgress(client, ri);
    return {
      clearedRank: ri,
      highestGateRankCleared: after,
      newClear: before < ri,
      nextUnlockedRank: ri < 4 ? ri + 1 : null,
    };
  }
  dungeonRewardProgress(rank, clearResult) {
    const ri = Math.max(0, Math.min(4, rank | 0));
    return {
      clearedRank: ri,
      highestGateRankCleared: clearResult ? clearResult.highestGateRankCleared : null,
      newClear: !!(clearResult && clearResult.newClear),
      nextUnlockedRank: ri < 4 ? ri + 1 : null,
    };
  }
  setPath(client, path) {
    const rec = this.profileFor(client);
    if (!rec || rec.prof.S.path || rec.prof.S.lvl < 2) return;
    rec.prof.S.path = path;
    this.syncPlayerProfile(client, rec.prof);
    this.dirtyPlayers.add(rec.token);
  }
  alertPack(mobId) {
    const meta = this.mobMeta[mobId];
    const mob = this.state.mobs.get(String(mobId));
    if (!meta || !mob || meta.alert) return;
    meta.alert = true;
    if (mob.dgn) this.sendSpace(mob.dgn, 'fx', { t: 'growl', dgn: mob.dgn });
    this.state.mobs.forEach((o, oid) => {
      const om = this.mobMeta[oid];
      if (!om || om.alert || (o.dgn || '') !== (mob.dgn || '')) return;
      if (Math.hypot(o.x - mob.x, o.z - mob.z) < 12) { om.alert = true; }
    });
  }
  fireArrow(mob, dgn, tx, ty, tz, dmg, bolt) {
    const sx = mob.x, sy = mob.y + (bolt ? 1.6 : 1.35), sz = mob.z;
    const d = Math.hypot(tx - sx, ty - sy, tz - sz) || 1;
    const spd = bolt ? 10 : 16;
    const a = {
      x: sx, y: sy, z: sz,
      vx: (tx - sx) / d * spd, vy: (ty - sy) / d * spd, vz: (tz - sz) / d * spd,
      dgn: dgn || '', dmg, bolt: !!bolt, life: bolt ? 2.4 : 3,
    };
    if (!bolt) { a.vx += (Math.random() - .5) * 1.1; a.vz += (Math.random() - .5) * 1.1; }   // slight spread
    this.sArrows.push(a);
    this.sendSpace(dgn, 'arrow', { x: a.x, y: a.y, z: a.z, vx: a.vx, vy: a.vy, vz: a.vz, bolt: !!bolt, dgn: dgn || '' });
  }
}

module.exports = CombatMixin.prototype;
