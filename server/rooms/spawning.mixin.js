// Overworld density-budgeted mob/animal spawning, elite camps, discovery nests,
// public gate spawning, and the boss pattern machine. Lifted verbatim out of
// GameRoom.js and mixed into its prototype; update() stays as the orchestrator.
const {
  ANIMAL_BASE_KIND, ANIMAL_DESPAWN_RADIUS, ANIMAL_SPAWN_INTERVAL, BIOME_ANIMAL, BIOME_HOSTILE, DANGER_RINGS, ELITE_FAMILIES,
  GATE_DISTANCE_BANDS, HOSTILE_DESPAWN_RADIUS, HOSTILE_SPAWN_INTERVAL, I, LOCAL_ANIMAL_COUNT_RADIUS,
  LOCAL_DENSITY_CLUSTER_RADIUS, LOCAL_HOSTILE_COUNT_RADIUS, animalBudgetFor, dangerRingAt, hostileBudgetFor, townDistance,
  weatherSpawnMods,
} = require('./constants');
const { State, Player, Mob, Team, Gate } = require('../schema');
const { TeamManager } = require('../teams');
const W = require('../world');
const D = require('../dungeon');
const AI = require('../ai');
const { createStore, sanitizeProfile, mergeClientSave, defaultProfile, cleanToken, sanitizeUtilityLoadout } = require('../store');

class SpawningMixin {
  // ---------------- boss pattern machine ----------------
  // returns true when the boss consumed its turn (skip shared movement)
  bossBrain(m, id, meta, dt, best, bd, candidates, ground, solid) {
    if (!meta.sum1 && m.hp <= m.maxHp * .66) { meta.sum1 = true; this.bossSummon(m, meta); }
    if (!meta.sum2 && m.hp <= m.maxHp * .33) { meta.sum2 = true; this.bossSummon(m, meta); }
    if (!meta.enraged && m.hp <= m.maxHp * .2) {
      meta.enraged = true; meta.speed *= 1.4;
      this.broadcast('chat', { name: '[System]', text: 'The Gate boss enrages!' });
    }
    const haste = meta.enraged ? .65 : 1;
    meta.stateT -= dt;
    meta.gcd -= dt;
    const faceBest = () => { if (best) m.yaw = Math.atan2(best.p.x - m.x, best.p.z - m.z); };

    // One-time wake-up: the first time a hunter closes in with line of sight, the boss
    // roars and opens with an extra-long, clearly telegraphed slam so a first-timer
    // learns the dodge. Reuses the slamWind pose + roar/warn fx the client already renders.
    if (!meta.woke) {
      const engaged = best && bd < 14 &&
        AI.losClear(solid, m.x, m.y + 1.4, m.z, best.p.x, best.p.y + 1.4, best.p.z);
      if (!engaged) return false;     // lumber toward the hunter until it sees them up close
      meta.woke = true;
      faceBest();
      this.sendSpace(m.dgn, 'fx', { t: 'roar', dgn: m.dgn || '' });
      this.sendSpace(m.dgn, 'fx', { t: 'warn', dgn: m.dgn || '' });
      this.broadcast('chat', { name: '[Gate]', text: 'The Gate Boss awakens with a roar!' });
      m.state = 'slamWind'; meta.stateT = 1.6;   // longer than the usual 1.1s tell
      return true;
    }

    const st = m.state || '';
    if (st === 'slamWind') {
      faceBest();
      if (meta.stateT <= 0) {
        this.sendSpace(m.dgn, 'fx', { t: 'slam', x: m.x, y: m.y, z: m.z, dgn: m.dgn || '' });
        for (const s of candidates) {
          if (Math.hypot(s.p.x - m.x, s.p.z - m.z) < 4.6 && Math.abs(s.p.y - m.y) < 2.8) {
            const c = this.clients.find(c => c.sessionId === s.sid);
            if (c) this.hurtPlayer(c, meta.slamDmg);
          }
        }
        m.state = 'recover'; meta.stateT = .9 * haste; meta.gcd = (2.6 + Math.random()) * haste;
      }
      return true;
    }
    if (st === 'chargeWind') {
      faceBest();
      if (meta.stateT <= 0) {
        m.state = 'charge'; meta.stateT = 1.0; meta.chargedHit = new Set();
        this.sendSpace(m.dgn, 'fx', { t: 'roar', dgn: m.dgn || '' });
      }
      return true;
    }
    if (st === 'charge') {
      const spd2 = 11;
      const nx = m.x + meta.cdx * spd2 * dt, nz = m.z + meta.cdz * spd2 * dt;
      const gy = ground(nx, nz, m.y + 1);
      if (gy > 0 && gy - m.y <= 1.05) {
        m.x = nx; m.z = nz; m.y = gy;
        m.yaw = Math.atan2(meta.cdx, meta.cdz);
        for (const s of candidates) {
          if (meta.chargedHit.has(s.sid)) continue;
          if (Math.hypot(s.p.x - m.x, s.p.z - m.z) < 1.9 && Math.abs(s.p.y - m.y) < 2.3) {
            meta.chargedHit.add(s.sid);
            const c = this.clients.find(c => c.sessionId === s.sid);
            if (c) this.hurtPlayer(c, meta.slamDmg + 2);
          }
        }
        if (meta.stateT <= 0) { m.state = 'recover'; meta.stateT = .7 * haste; meta.gcd = (2.8 + Math.random()) * haste; }
      } else {
        m.state = 'stun'; meta.stateT = 1.7;
        this.sendSpace(m.dgn, 'fx', { t: 'crash', x: m.x, y: m.y, z: m.z, dgn: m.dgn || '' });
      }
      return true;
    }
    if (st === 'volleyWind') {
      faceBest();
      if (meta.stateT <= 0 && best) {
        const bd2 = bd || 1;
        const bx = (best.p.x - m.x) / bd2, bz = (best.p.z - m.z) / bd2;
        const by = ((best.p.y + 1.2) - (m.y + 1.6)) / bd2;
        for (const off of [-.24, 0, .24]) {
          const ca = Math.cos(off), sa = Math.sin(off);
          this.fireArrow(m, m.dgn,
            m.x + (bx * ca - bz * sa) * 10, m.y + 1.6 + by * 10, m.z + (bx * sa + bz * ca) * 10,
            3 + meta.rank, true);
        }
        m.state = 'recover'; meta.stateT = .6 * haste; meta.gcd = (3 + Math.random()) * haste;
      }
      if (meta.stateT <= 0 && !best) { m.state = 'recover'; meta.stateT = .5; }
      return true;
    }
    if (st === 'spikeWind') {
      faceBest();
      if (meta.stateT <= 0) {
        m.state = 'spikes'; meta.stateT = .95; meta.spikeK = 0; meta.spikeT = 0;
        this.sendSpace(m.dgn, 'fx', { t: 'spikes', x: m.x, y: m.y, z: m.z, dx: meta.cdx, dz: meta.cdz, dgn: m.dgn || '' });
      }
      return true;
    }
    if (st === 'spikes') {
      meta.spikeT -= dt;
      while (meta.spikeT <= 0 && meta.spikeK < 7) {
        meta.spikeT += .11; meta.spikeK++;
        const sx2 = m.x + meta.cdx * meta.spikeK * 1.35, sz2 = m.z + meta.cdz * meta.spikeK * 1.35;
        for (const s of candidates) {
          if (Math.hypot(s.p.x - sx2, s.p.z - sz2) < 1.4 && Math.abs(s.p.y - m.y) < 2.6) {
            const c = this.clients.find(c => c.sessionId === s.sid);
            if (c) this.hurtPlayer(c, 3 + meta.rank);
          }
        }
      }
      if (meta.stateT <= 0 && meta.spikeK >= 7) { m.state = 'recover'; meta.stateT = .6 * haste; meta.gcd = (2.8 + Math.random()) * haste; }
      return true;
    }
    if (st === 'stun') {
      if (meta.stateT <= 0) { m.state = 'chase'; meta.gcd = 1.2; }
      return true;
    }
    if (st === 'recover') {
      faceBest();
      if (meta.stateT <= 0) m.state = 'chase';
      return true;
    }
    // 'chase' (or fresh ''): maybe start a pattern, otherwise fall through to pursuit
    if (st === '') m.state = 'chase';
    if (meta.gcd <= 0 && best) {
      const picks = [];
      if (bd < 6) { picks.push('slam', 'slam'); if (meta.rank >= 2) picks.push('spikes'); }
      if (bd > 5 && bd < 16) picks.push('charge', 'charge');
      if (bd > 6 && bd < 18) picks.push('volley');
      if (picks.length) {
        let pat = picks[(Math.random() * picks.length) | 0];
        if (pat === meta.lastPat && picks.some(q => q !== pat)) pat = picks.find(q => q !== pat);
        meta.lastPat = pat;
        const bd2 = bd || 1;
        meta.cdx = (best.p.x - m.x) / bd2; meta.cdz = (best.p.z - m.z) / bd2;
        if (pat === 'slam') {
          m.state = 'slamWind'; meta.stateT = 1.1 * haste;
          this.sendSpace(m.dgn, 'fx', { t: 'warn', dgn: m.dgn || '' });
        } else if (pat === 'charge') {
          m.state = 'chargeWind'; meta.stateT = .8 * haste;
          this.sendSpace(m.dgn, 'fx', { t: 'growl', dgn: m.dgn || '' });
          this.sendSpace(m.dgn, 'fx', { t: 'cwind', id, dx: meta.cdx, dz: meta.cdz, dgn: m.dgn || '' });
        } else if (pat === 'volley') {
          m.state = 'volleyWind'; meta.stateT = .7 * haste;
          this.sendSpace(m.dgn, 'fx', { t: 'growl', dgn: m.dgn || '' });
        } else {
          m.state = 'spikeWind'; meta.stateT = .7 * haste;
          this.sendSpace(m.dgn, 'fx', { t: 'warn', dgn: m.dgn || '' });
          this.sendSpace(m.dgn, 'fx', { t: 'swind', id, dx: meta.cdx, dz: meta.cdz, dgn: m.dgn || '' });
        }
        return true;
      }
    }
    return false;   // pursue via shared movement
  }

  bossSummon(m, meta) {
    const inst = this.instances[m.dgn];
    if (!inst) return;
    const n = 2 + Math.floor(meta.rank / 2);
    const mul = D.RANK_MUL[meta.rank];
    for (let k = 0; k < n; k++) {
      const skel = meta.rank >= 1 && Math.random() < .35;
      this.addDungeonMob(m.dgn,
        m.x + (Math.random() * 4 - 2), m.z + (Math.random() * 4 - 2),
        skel ? 'skeleton' : 'zombie',
        Math.round((skel ? 6 : 8) + 8 * mul), 3 + meta.rank, 1.6 + Math.random() * .5,
        inst.world, meta.rank);
    }
    // summons join the fight already angry
    this.state.mobs.forEach((o, oid) => {
      if (o.dgn === m.dgn && this.mobMeta[oid]) this.mobMeta[oid].alert = true;
    });
    this.sendSpace(m.dgn, 'fx', { t: 'roar', dgn: m.dgn || '' });
    this.broadcast('chat', { name: '[System]', text: 'The boss summons reinforcements!' });
  }

  surfaceDensityClusters(surface) {
    const clusters = [];
    for (const entry of surface || []) {
      const p = entry && entry.p;
      if (!p) continue;
      let best = null, bd = Infinity;
      for (const c of clusters) {
        const d = Math.hypot(p.x - c.x, p.z - c.z);
        if (d < bd) { bd = d; best = c; }
      }
      if (best && bd <= LOCAL_DENSITY_CLUSTER_RADIUS) {
        best.players.push(entry);
        const n = best.players.length;
        best.x += (p.x - best.x) / n;
        best.z += (p.z - best.z) / n;
      } else {
        clusters.push({ x: p.x, z: p.z, players: [entry], hostileAcc: 0, animalAcc: 0 });
      }
    }
    const wmods = weatherSpawnMods((this.state && this.state.weather) || 'clear');
    for (const c of clusters) {
      c.ring = c.players.reduce((r, e) => Math.max(r, dangerRingAt(e.p.x, e.p.z)), dangerRingAt(c.x, c.z));
      c.key = Math.round(c.x / 80) + ',' + Math.round(c.z / 80);
      // foul weather emboldens hostiles away from town while animals shelter from the rain
      c.hostileBudget = hostileBudgetFor(c.players.length, c.ring) + (c.ring > 0 ? wmods.hostileBonus : 0);
      c.animalBudget = Math.round(animalBudgetFor(c.players.length) * wmods.animalMul);
    }
    return clusters;
  }
  nearestSurfaceCluster(x, z, clusters, maxDist = Infinity) {
    let best = null, bd = maxDist;
    for (const c of clusters || []) {
      const d = Math.hypot(x - c.x, z - c.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  countOverworldMobsNear(x, z, radius, pred) {
    let n = 0;
    this.state.mobs.forEach((m, id) => {
      if (m.dgn) return;
      const meta = this.mobMeta[id] || {};
      if (pred && !pred(m, meta, id)) return;
      if (Math.hypot(m.x - x, m.z - z) <= radius) n++;
    });
    return n;
  }
  localHostileCount(x, z) {
    return this.countOverworldMobsNear(x, z, LOCAL_HOSTILE_COUNT_RADIUS, (m, meta) => !meta.friendly && !this.isAnimalKind(m.kind));
  }
  localAnimalCount(x, z) {
    return this.countOverworldMobsNear(x, z, LOCAL_ANIMAL_COUNT_RADIUS, m => this.isAnimalKind(m.kind));
  }
  localHostileBudgetAllows(x, z, clusters, reserve = 0) {
    const c = this.nearestSurfaceCluster(x, z, clusters, LOCAL_HOSTILE_COUNT_RADIUS);
    if (!c) return false;
    return this.localHostileCount(x, z) + reserve < c.hostileBudget;
  }
  cleanupFarOverworldMobs(clusters) {
    if (!clusters || !clusters.length) {
      const dead = [];
      this.state.mobs.forEach((m, id) => { if (!m.dgn && !(this.mobMeta[id] && this.mobMeta[id].friendly)) dead.push(id); });
      for (const id of dead) { this.state.mobs.delete(id); delete this.mobMeta[id]; }
      return;
    }
    const dead = [];
    this.state.mobs.forEach((m, id) => {
      if (m.dgn) return;
      if (this.mobMeta[id] && this.mobMeta[id].friendly) return;
      const radius = this.isAnimalKind(m.kind) ? ANIMAL_DESPAWN_RADIUS : HOSTILE_DESPAWN_RADIUS;
      if (!this.nearestSurfaceCluster(m.x, m.z, clusters, radius)) dead.push(id);
    });
    for (const id of dead) { this.state.mobs.delete(id); delete this.mobMeta[id]; }
  }
  tickLocalHostileSpawns(dt, clusters, phase='night') {
    if (!clusters || !clusters.length) return;
    if (!this.hostileSpawnAccByCluster) this.hostileSpawnAccByCluster = new Map();
    const liveKeys = new Set(clusters.map(c => phase+':'+c.key));
    for (const key of [...this.hostileSpawnAccByCluster.keys()]) if (!liveKeys.has(key)) this.hostileSpawnAccByCluster.delete(key);
    for (const c of clusters) {
      const key=phase+':'+c.key;
      const count=phase==='day'?this.countOverworldMobsNear(c.x,c.z,LOCAL_HOSTILE_COUNT_RADIUS,(m,meta)=>!!meta.dayActive):this.localHostileCount(c.x,c.z);
      const budget=phase==='day'?Math.min(2,c.hostileBudget):c.hostileBudget;
      if (count >= budget) { this.hostileSpawnAccByCluster.set(key, 0); continue; }
      const acc = (this.hostileSpawnAccByCluster.get(key) || 0) + dt;
      if (acc < HOSTILE_SPAWN_INTERVAL) { this.hostileSpawnAccByCluster.set(key, acc); continue; }
      this.hostileSpawnAccByCluster.set(key, 0);
      this.trySpawnMob({ x: c.x, z: c.z }, c, phase);
    }
  }
  tickLocalAnimalSpawns(dt, clusters) {
    if (!clusters || !clusters.length) return;
    if (!this.animalSpawnAccByCluster) this.animalSpawnAccByCluster = new Map();
    const liveKeys = new Set(clusters.map(c => c.key));
    for (const key of [...this.animalSpawnAccByCluster.keys()]) if (!liveKeys.has(key)) this.animalSpawnAccByCluster.delete(key);
    for (const c of clusters) {
      if (this.localAnimalCount(c.x, c.z) >= c.animalBudget) { this.animalSpawnAccByCluster.set(c.key, 0); continue; }
      const acc = (this.animalSpawnAccByCluster.get(c.key) || 0) + dt;
      if (acc < ANIMAL_SPAWN_INTERVAL) { this.animalSpawnAccByCluster.set(c.key, acc); continue; }
      this.animalSpawnAccByCluster.set(c.key, 0);
      this.trySpawnAnimal({ x: c.x, z: c.z }, c);
    }
  }

  maintainEliteCamps(dt, clusters = null) {
    this.eliteCampAcc = (this.eliteCampAcc || 0) + dt;
    if (this.eliteCampAcc < 8) return;
    this.eliteCampAcc = 0;
    const activePlayers = [];
    this.state.players.forEach(p => { if (!p.dgn) activePlayers.push(p); });
    if (!activePlayers.length) return;
    const camps = W.regionalLandmarkSpecs().filter(s => s.type === 'hunter_camp');
    for (const camp of camps) {
      const ring = dangerRingAt(camp.x, camp.z);
      if (ring < 1 || !activePlayers.some(p => Math.hypot(p.x - camp.x, p.z - camp.z) < 95)) continue;
      let living = 0;
      this.state.mobs.forEach((m, id) => { if (!m.dgn && this.mobMeta[id] && this.mobMeta[id].campId === camp.id) living++; });
      const desired = Math.min(4, 1 + ring);
      for (; living < desired; living++) {
        if (clusters && !this.localHostileBudgetAllows(camp.x, camp.z, clusters, 0)) break;
        const a = (living / desired) * Math.PI * 2 + W.hash2(camp.x + living, camp.z) * .8;
        const x = camp.x + Math.cos(a) * (5 + ring), z = camp.z + Math.sin(a) * (5 + ring);
        const gy = this.world.standHeight(x, z, W.WH - 2);
        if (gy < 2) continue;
        const cfg = DANGER_RINGS[ring], id = String(++this.mobSeq), kind = ELITE_FAMILIES[ring - 1];
        const mob = new Mob();
        mob.x = x; mob.y = gy; mob.z = z; mob.kind = kind;
        mob.maxHp = mob.hp = Math.round(24 * cfg.hp);
        this.state.mobs.set(id, mob);
        const meta = this.freshMeta(x, z, Math.round(5 * cfg.dmg), 1.45 + ring * .08, kind, ring, true);
        meta.elite = true; meta.campId = camp.id; meta.dangerRing = ring;
        meta.sx = camp.x; meta.sz = camp.z; meta.tx = camp.x; meta.tz = camp.z;
        this.mobMeta[id] = meta;
      }
    }
  }

  maintainBanditCamps(dt, clusters = null) {
    this.banditCampAcc = (this.banditCampAcc || 0) + dt;
    if (this.banditCampAcc < 7) return;
    this.banditCampAcc = 0;
    const players = []; this.state.players.forEach(p => { if (!p.dgn && (p.dim || 'overworld') === 'overworld') players.push(p); });
    const roadSafety = this.roadSafetySnapshot().score;
    if (!this.banditCampStates) this.banditCampStates = new Map();
    for (const camp of W.regionalLandmarkSpecs().filter(s => s.type === 'bandit_camp')) {
      if (!players.some(p => Math.hypot(p.x - camp.x, p.z - camp.z) < 105)) continue;
      let state = this.banditCampStates.get(camp.id);
      if (state && state.phase === 'cleared' && Date.now() < state.respawnAt) continue;
      if (!state || (state.phase === 'cleared' && Date.now() >= state.respawnAt)) {
        state = { phase: 'guards', respawnAt: 0 };
        this.banditCampStates.set(camp.id, state);
      }
      if (state.phase === 'captain') {
        let captainAlive = false;
        this.state.mobs.forEach((m, id) => { const meta = this.mobMeta[id]; if (meta && meta.banditCampId === camp.id && meta.banditCaptain) captainAlive = true; });
        if (!captainAlive) this.spawnBanditCaptain(camp.id);
        continue;
      }
      const ring = dangerRingAt(camp.x, camp.z), baseDesired = Math.min(5, 3 + ring);
      const desired = Math.max(2, Math.min(6, baseDesired + (roadSafety < 30 ? 1 : roadSafety >= 70 ? -1 : 0))); let living = 0;
      this.state.mobs.forEach((m, id) => { if (!m.dgn && this.mobMeta[id] && this.mobMeta[id].banditCampId === camp.id) living++; });
      let attempts = 0;
      while (living < desired && attempts < desired * 4) {
        if (clusters && !this.localHostileBudgetAllows(camp.x, camp.z, clusters, 0)) break;
        const angle = attempts++ / (desired * 4) * Math.PI * 2, x = camp.x + Math.cos(angle) * 5, z = camp.z + Math.sin(angle) * 5;
        const gy = this.world.standHeight(x, z, W.WH - 2); if (gy < 2) continue;
        const cfg = DANGER_RINGS[ring], roles = ['bandit_shield','bandit','bandit_archer','bandit_scout','bandit_brute'];
        const kind = roles[living % roles.length], ranged = kind === 'bandit_archer';
        const id = String(++this.mobSeq), mob = new Mob(); mob.x = x; mob.y = gy; mob.z = z; mob.kind = kind;
        const roleHp = kind==='bandit_brute'?24:kind==='bandit_shield'?19:ranged?10:14;
        mob.maxHp = mob.hp = Math.round(roleHp * cfg.hp); this.state.mobs.set(id, mob);
        const meta = this.freshMeta(x, z, Math.round((kind==='bandit_brute'?6:ranged?3:4) * cfg.dmg), (kind==='bandit_brute'?1.2:ranged?1.35:1.65) + ring * .06, kind, ring, false);
        meta.bandit = true; meta.banditCampId = camp.id; meta.dangerRing = ring; meta.groupIndex = living;
        meta.banditRole = kind.slice(8); meta.brute = kind==='bandit_brute'; meta.scout = kind==='bandit_scout'; meta.shield = kind==='bandit_shield';
        meta.sx = camp.x; meta.sz = camp.z; meta.tx = camp.x + Math.cos(angle) * 18; meta.tz = camp.z + Math.sin(angle) * 18;
        const patrolSize = roadSafety >= 70 ? 1 : roadSafety < 30 ? 3 : 2;
        if (living < patrolSize) {
          const route = this.banditPatrolRoute(camp);
          meta.banditPatrol = true; meta.patrolId = camp.id + ':road'; meta.patrolRoute = route.points; meta.patrolStep = 0;
          meta.caravanId = route.caravanId; meta.formationSide = living ? 1 : -1;
        }
        meta.patrolT = 5 + living * .4; meta.arrowDmg = Math.round((2 + ring) * cfg.dmg); this.mobMeta[id] = meta;
        living++;
      }
      this.warnOfBanditPatrol(camp);
    }
  }

  tickRoadCaravans(dt, daytime) {
    if (!this.roadCaravans) this.roadCaravans = new Map();
    const now = Date.now(), roads = W.roadNetworkSpecs();
    this.tickRoadsideEncounters(dt, daytime, roads, now);
    const storming = this.state && this.state.weather === 'storm';   // merchants wait out storms
    if (daytime && !storming && !this.roadCaravans.size && now >= (this.nextCaravanAt || 0) && roads.length) {
      let hasSurface = false; this.state.players.forEach(p => { if (!p.dgn) hasSurface = true; });
      if (hasSurface) this.spawnRoadCaravan(roads[Math.floor(now / 600000) % roads.length]);
    }
    for (const caravan of [...this.roadCaravans.values()]) {
      const wagon = this.state.mobs.get(caravan.wagonId);
      if (!wagon || wagon.hp <= 0) { this.failRoadCaravan(caravan); continue; }
      let threat = null, threatId = '', threatDist = 15;
      this.state.mobs.forEach((m, id) => {
        const meta = this.mobMeta[id]; if (!meta || !meta.bandit) return;
        const d = Math.hypot(m.x - wagon.x, m.z - wagon.z); if (d < threatDist) { threatDist = d; threat = m; threatId = id; }
      });
      caravan.attackT = Math.max(0, (caravan.attackT || 0) - dt);
      if (threat) {
        caravan.state = 'ambushed';
        if (caravan.attackT <= 0) {
          caravan.attackT = 1.5;
          const guards = caravan.guardIds.map(id => this.state.mobs.get(id)).filter(Boolean);
          const victim = guards.find(g => g.hp > 0) || wagon; victim.hp -= 2 + (this.mobMeta[threatId].dangerRing | 0);
          if (guards.length) {
            threat.hp -= 3 * guards.length;
            if (threat.hp <= 0) this.finishMobKill(null, threatId, threat);
          }
          if (victim.hp <= 0 && victim !== wagon) {
            const id = caravan.guardIds.find(id => this.state.mobs.get(id) === victim);
            this.state.mobs.delete(id); delete this.mobMeta[id];
          }
        }
      } else {
        caravan.state = 'moving'; caravan.progress = Math.min(1, caravan.progress + dt * 1.35 / caravan.road.length);
      }
      const t = caravan.progress, x = caravan.road.a.x + (caravan.road.b.x - caravan.road.a.x) * t, z = caravan.road.a.z + (caravan.road.b.z - caravan.road.a.z) * t;
      const dx = (caravan.road.b.x - caravan.road.a.x) / caravan.road.length, dz = (caravan.road.b.z - caravan.road.a.z) / caravan.road.length;
      const formation = [[caravan.wagonId,0,0],[caravan.merchantId,-2,0],[caravan.muleId,2,0],[caravan.guardIds[0],-1,-2],[caravan.guardIds[1],-1,2]];
      for (const [id, back, side] of formation) {
        const m = this.state.mobs.get(id); if (!m) continue;
        m.x = x + dx * back - dz * side; m.z = z + dz * back + dx * side; m.y = this.world.standHeight(m.x, m.z, W.WH - 2); m.yaw = Math.atan2(dx, dz); m.state = caravan.state;
      }
      this.state.players.forEach((p, sid) => { if (!p.dgn && caravan.state === 'moving' && Math.hypot(p.x - x, p.z - z) < 22) caravan.escorts.add(sid); });
      if (caravan.progress >= 1) this.completeRoadCaravan(caravan);
    }
    this.activitySyncAcc = (this.activitySyncAcc || 0) + dt;
    if (this.activitySyncAcc >= 1) { this.activitySyncAcc = 0; this.sendOverworldActivities(); }
  }

  roadSafetySnapshot(now = Date.now()) {
    if (!this.worldProgress) this.worldProgress = { highestGateRankCleared: -1, roadSafety: 50, roadSafetyUpdatedAt: now };
    let score = Math.max(0, Math.min(100, this.worldProgress.roadSafety == null ? 50 : this.worldProgress.roadSafety | 0));
    const updatedAt = Math.max(0, Number(this.worldProgress.roadSafetyUpdatedAt) || 0) || now;
    const steps = Math.floor(Math.max(0, now - updatedAt) / (20 * 60 * 1000));
    if (steps > 0 && score !== 50) {
      score += score > 50 ? -Math.min(steps, score - 50) : Math.min(steps, 50 - score);
      this.worldProgress.roadSafety = score;
      this.worldProgress.roadSafetyUpdatedAt = updatedAt + steps * 20 * 60 * 1000;
      this.dirtyWorldProgress = true;
    } else {
      this.worldProgress.roadSafety = score;
      if (!this.worldProgress.roadSafetyUpdatedAt) this.worldProgress.roadSafetyUpdatedAt = now;
    }
    const tier = score >= 80 ? 'secure' : score >= 60 ? 'patrolled' : score >= 40 ? 'contested' : score >= 20 ? 'dangerous' : 'overrun';
    return { score, tier };
  }

  adjustRoadSafety(delta, reason = '') {
    const now = Date.now(), before = this.roadSafetySnapshot(now).score;
    const score = Math.max(0, Math.min(100, before + Math.round(Number(delta) || 0)));
    if (score === before) return this.roadSafetySnapshot(now);
    this.worldProgress.roadSafety = score; this.worldProgress.roadSafetyUpdatedAt = now; this.dirtyWorldProgress = true;
    const snapshot = this.roadSafetySnapshot(now);
    for (const client of this.clients) {
      const p = this.state.players.get(client.sessionId); if (p && !p.dgn) client.send('roadSafetyChanged', { ...snapshot, delta: score - before, reason });
    }
    return snapshot;
  }

  roadsideEncounterPoint(roads) {
    let best = null, bestDistance = Infinity;
    this.state.players.forEach(p => {
      if (p.dgn || this.isTownProtected(p.x, p.z)) return;
      for (const road of roads) {
        const vx = road.b.x - road.a.x, vz = road.b.z - road.a.z, len2 = vx * vx + vz * vz || 1;
        const raw = ((p.x - road.a.x) * vx + (p.z - road.a.z) * vz) / len2;
        const t = Math.max(.12, Math.min(.88, raw + .08));
        const x = road.a.x + vx * t, z = road.a.z + vz * t;
        const distance = Math.hypot(x - p.x, z - p.z);
        if (distance < bestDistance) { bestDistance = distance; best = { road, t, x, z }; }
      }
    });
    return best;
  }

  spawnRoadsideEncounter(type, point, now = Date.now()) {
    if (!point || !point.road) return null;
    if (!this.roadsideEncounters) this.roadsideEncounters = new Map();
    const id = 'roadside-' + (++this.mobSeq) + '-' + now.toString(36), ring = dangerRingAt(point.x, point.z);
    const encounter = {
      id, type, x: point.x, z: point.z, roadId: point.road.id, ring,
      state: type === 'pursuit' ? 'escaping' : type === 'merchant_rescue' ? 'attacked' : 'waiting',
      entityIds: new Set(), hostileIds: new Set(), contributors: new Set(), actorId: '',
      expiresAt: now + (type === 'pursuit' ? 75 : 120) * 1000, attackAt: now + 2000,
    };
    const add = (kind, hp, x, z, friendly = false) => {
      const mobId = String(++this.mobSeq), mob = new Mob(), y = this.world.standHeight(x, z, W.WH - 2);
      mob.kind = kind; mob.x = x; mob.y = y > 0 ? y : point.road.a.y; mob.z = z; mob.hp = mob.maxHp = hp;
      this.state.mobs.set(mobId, mob);
      const meta = this.freshMeta(x, z, friendly ? 0 : 3 + ring, friendly ? 0 : 1.75 + ring * .08, kind, ring, false);
      meta.friendly = friendly; meta.roadEncounterId = id; meta.dangerRing = ring;
      if (!friendly) { meta.bandit = true; meta.banditRole = kind.replace('bandit_', ''); }
      this.mobMeta[mobId] = meta; encounter.entityIds.add(mobId); if (!friendly) encounter.hostileIds.add(mobId);
      return mobId;
    };
    if (type === 'wounded_hunter') {
      encounter.actorId = add('wounded_hunter', 20, point.x, point.z, true);
      this.state.mobs.get(encounter.actorId).state = 'downed';
    } else if (type === 'merchant_rescue') {
      encounter.actorId = add('caravan_merchant', 20, point.x, point.z, true);
      for (let i = 0; i < 3 + Math.min(1, ring); i++) {
        const angle = i / (3 + Math.min(1, ring)) * Math.PI * 2;
        add(i === 1 ? 'bandit_archer' : i === 2 ? 'bandit_shield' : 'bandit', 14 + ring * 4,
          point.x + Math.cos(angle) * 6, point.z + Math.sin(angle) * 6);
      }
    } else {
      encounter.actorId = add('caravan_wagon', 30, point.x, point.z, true);
      const vx = point.road.b.x - point.road.a.x, vz = point.road.b.z - point.road.a.z, len = Math.hypot(vx, vz) || 1;
      for (const side of [-1, 1]) {
        const mobId = add('bandit_scout', 13 + ring * 3, point.x + vx / len * 7 - vz / len * side * 2, point.z + vz / len * 7 + vx / len * side * 2);
        const meta = this.mobMeta[mobId]; meta.retreating = true; meta.alert = false; meta.sx = point.road.b.x; meta.sz = point.road.b.z;
      }
    }
    this.roadsideEncounters.set(id, encounter);
    this.notifyRoadsideEncounter(encounter, 'started');
    return encounter;
  }

  notifyRoadsideEncounter(encounter, state, extra = {}) {
    if (!encounter) return;
    for (const client of this.clients) {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.dgn || Math.hypot(p.x - encounter.x, p.z - encounter.z) > 150) continue;
      client.send('roadsideEncounter', { id: encounter.id, type: encounter.type, state, x: encounter.x, z: encounter.z, ...extra });
    }
  }

  roadsideEncounterReward(encounter) {
    if (encounter.type === 'wounded_hunter') return { source: 'roadside_aid', xp: 18 + encounter.ring * 6, items: [{ id: I.COOKED_MEAT, count: 1 + encounter.ring }] };
    if (encounter.type === 'merchant_rescue') return { source: 'roadside_rescue', xp: 25 + encounter.ring * 10, items: [{ id: I.IRON_INGOT, count: 1 + encounter.ring }] };
    return { source: 'roadside_recovery', xp: 30 + encounter.ring * 12, items: [{ id: I.IRON_INGOT, count: 2 + encounter.ring }, { id: I.COAL, count: 3 + encounter.ring }] };
  }

  completeRoadsideEncounter(encounter, finisherSid = '') {
    if (!encounter || encounter.state === 'complete' || encounter.state === 'failed') return;
    encounter.state = 'complete'; if (finisherSid) encounter.contributors.add(finisherSid);
    for (const client of this.clients) {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.dgn || Math.hypot(p.x - encounter.x, p.z - encounter.z) > 32) continue;
      encounter.contributors.add(client.sessionId);
    }
    for (const sid of encounter.contributors) {
      const client = this.clients.find(c => c.sessionId === sid); if (!client) continue;
      this.awardGrant(client, this.roadsideEncounterReward(encounter));
      if (encounter.type === 'merchant_rescue') this.progressRegionalContract(client, 'road_rescue', {});
      else if (encounter.type === 'pursuit') this.progressRegionalContract(client, 'road_recover', {});
      client.send('roadsideEncounterResult', { id: encounter.id, type: encounter.type, outcome: 'complete' });
    }
    this.notifyRoadsideEncounter(encounter, 'complete');
    this.adjustRoadSafety(encounter.type === 'wounded_hunter' ? 3 : encounter.type === 'merchant_rescue' ? 6 : 5, encounter.type);
    this.removeRoadsideEncounter(encounter); this.nextRoadsideEncounterAt = Date.now() + 90 * 1000;
  }

  failRoadsideEncounter(encounter, reason = 'expired') {
    if (!encounter || encounter.state === 'complete' || encounter.state === 'failed') return;
    encounter.state = 'failed'; this.notifyRoadsideEncounter(encounter, 'failed', { reason });
    this.adjustRoadSafety(encounter.type === 'merchant_rescue' ? -6 : encounter.type === 'pursuit' ? -5 : -2, reason);
    this.removeRoadsideEncounter(encounter); this.nextRoadsideEncounterAt = Date.now() + 60 * 1000;
  }

  removeRoadsideEncounter(encounter) {
    for (const id of encounter.entityIds || []) { this.state.mobs.delete(id); delete this.mobMeta[id]; }
    if (this.roadsideEncounters) this.roadsideEncounters.delete(encounter.id);
  }

  tickRoadsideEncounters(dt, daytime, roads, now = Date.now()) {
    if (!this.roadsideEncounters) this.roadsideEncounters = new Map();
    if (!daytime) {
      for (const encounter of [...this.roadsideEncounters.values()]) this.failRoadsideEncounter(encounter, 'night');
      return;
    }
    if (!this.roadsideEncounters.size && now >= (this.nextRoadsideEncounterAt || 0) && !(this.state && this.state.weather === 'storm')) {
      const point = this.roadsideEncounterPoint(roads);
      const safety = this.roadSafetySnapshot(now).score;
      const types = safety >= 70 ? ['wounded_hunter', 'merchant_rescue', 'wounded_hunter'] : safety < 35 ? ['pursuit', 'merchant_rescue', 'pursuit'] : ['wounded_hunter', 'merchant_rescue', 'pursuit'];
      if (point) this.spawnRoadsideEncounter(types[Math.floor(now / 90000) % types.length], point, now);
      this.nextRoadsideEncounterAt = now + (point ? 2 * 60 * 1000 : 10 * 1000);
    }
    for (const encounter of [...this.roadsideEncounters.values()]) {
      if (now >= encounter.expiresAt) { this.failRoadsideEncounter(encounter, 'escaped'); continue; }
      encounter.hostileIds = new Set([...encounter.hostileIds].filter(id => this.state.mobs.has(id)));
      if (encounter.type === 'wounded_hunter') continue;
      if (!encounter.hostileIds.size) {
        if (encounter.contributors.size) this.completeRoadsideEncounter(encounter);
        else this.failRoadsideEncounter(encounter, 'escaped');
        continue;
      }
      if (encounter.type === 'merchant_rescue' && now >= encounter.attackAt) {
        encounter.attackAt = now + 2000;
        const merchant = this.state.mobs.get(encounter.actorId);
        if (!merchant || (merchant.hp = Math.max(0, merchant.hp - 2 - encounter.ring)) <= 0) { this.failRoadsideEncounter(encounter, 'merchant'); continue; }
      }
      if (encounter.type === 'pursuit') {
        let escaped = false;
        for (const id of encounter.hostileIds) {
          const mob = this.state.mobs.get(id), meta = this.mobMeta[id];
          if (mob && meta && Math.hypot(mob.x - meta.sx, mob.z - meta.sz) < 4) escaped = true;
        }
        if (escaped) this.failRoadsideEncounter(encounter, 'escaped');
      }
    }
  }

  onRoadsideBanditKilled(meta, client) {
    const encounter = meta && this.roadsideEncounters && this.roadsideEncounters.get(meta.roadEncounterId);
    if (!encounter) return false;
    if (client) encounter.contributors.add(client.sessionId);
    encounter.hostileIds = new Set([...encounter.hostileIds].filter(id => this.state.mobs.has(id)));
    if (!encounter.hostileIds.size) this.completeRoadsideEncounter(encounter, client && client.sessionId);
    return true;
  }

  handleRoadsideInteract(client, m) {
    const encounter = this.roadsideEncounters && this.roadsideEncounters.get(String(m && m.id || ''));
    const p = this.state.players.get(client.sessionId), actor = encounter && this.state.mobs.get(encounter.actorId);
    if (!encounter || encounter.type !== 'wounded_hunter' || encounter.state !== 'waiting' || !p || p.dgn || !actor || Math.hypot(p.x - actor.x, p.z - actor.z) > 5)
      return client.send('roadsideEncounterReject', { reason: 'range' });
    this.completeRoadsideEncounter(encounter, client.sessionId);
  }

  sendOverworldActivities() {
    if (!this.roadCaravans) this.roadCaravans = new Map();
    if (!this.roadsideEncounters) this.roadsideEncounters = new Map();
    const camps = W.regionalLandmarkSpecs().filter(s => s.type === 'bandit_camp');
    for (const client of this.clients) {
      const p = this.state.players.get(client.sessionId); if (!p || p.dgn) continue;
      let caravanPayload = null, caravanBest = Infinity;
      for (const caravan of this.roadCaravans.values()) {
        const wagon = this.state.mobs.get(caravan.wagonId); if (!wagon) continue;
        const d = Math.hypot(wagon.x - p.x, wagon.z - p.z); if (d < caravanBest) { caravanBest = d; caravanPayload = { x: wagon.x, z: wagon.z, hp: wagon.hp, maxHp: wagon.maxHp, progress: caravan.progress, state: caravan.state, guards: caravan.guardIds.filter(id => this.state.mobs.has(id)).length }; }
      }
      let campPayload = null, campBest = 180;
      for (const camp of camps) {
        const d = Math.hypot(camp.x - p.x, camp.z - p.z); if (d >= campBest) continue;
        const state = this.banditCampStates && this.banditCampStates.get(camp.id); if (!state) continue;
        let guards = 0; this.state.mobs.forEach((m,id) => { const meta=this.mobMeta[id]; if(meta&&meta.banditCampId===camp.id&&!meta.banditCaptain)guards++; });
        campBest=d;campPayload={id:camp.id,x:camp.x,z:camp.z,phase:state.phase,guards,respawnAt:state.respawnAt||0};
      }
      let patrolPayload = null, patrolBest = 130;
      this.state.mobs.forEach((m,id) => { const meta=this.mobMeta[id]; if(!meta||!meta.banditPatrol)return;const d=Math.hypot(m.x-p.x,m.z-p.z);if(d<patrolBest){patrolBest=d;patrolPayload={x:m.x,z:m.z,campId:meta.banditCampId};} });
      let recoveryCamp = null;
      if (this.caravanRecoveryByCamp && this.caravanRecoveryByCamp.size) {
        const id = [...this.caravanRecoveryByCamp.keys()][0], camp = camps.find(s => s.id === id); if (camp) recoveryCamp = { id, x: camp.x, z: camp.z };
      }
      let encounterPayload = null, encounterBest = 180;
      for (const encounter of (this.roadsideEncounters || new Map()).values()) {
        const d = Math.hypot(encounter.x - p.x, encounter.z - p.z); if (d >= encounterBest) continue;
        encounterBest = d;
        encounterPayload = {
          id: encounter.id, type: encounter.type, state: encounter.state, x: encounter.x, z: encounter.z,
          remaining: encounter.hostileIds ? encounter.hostileIds.size : 0, expiresAt: encounter.expiresAt,
        };
      }
      const rec = this.profileFor(client), discountUntil = rec && this.caravanDiscounts && (this.caravanDiscounts.get(rec.token) || 0) || 0;
      client.send('overworldActivity', { caravan: caravanPayload, camp: campPayload, patrol: patrolPayload, recoveryCamp, encounter: encounterPayload, roadSafety: this.roadSafetySnapshot(), discountUntil, now: Date.now() });
    }
  }

  spawnRoadCaravan(road) {
    if (!this.roadCaravans) this.roadCaravans = new Map();
    const caravan = { id: 'caravan_' + road.id, road, progress: .01, escorts: new Set(), guardIds: [], state: 'moving', attackT: 0 };
    const add = (kind, hp, friendly = true) => {
      const id = String(++this.mobSeq), m = new Mob(); m.kind = kind; m.hp = m.maxHp = hp; m.x = road.a.x; m.y = road.a.y; m.z = road.a.z; this.state.mobs.set(id, m);
      const meta = this.freshMeta(m.x, m.z, 0, 0, kind, 0, false); meta.friendly = friendly; meta.caravanId = caravan.id; this.mobMeta[id] = meta; return id;
    };
    caravan.wagonId = add('caravan_wagon', 45); caravan.merchantId = add('caravan_merchant', 18); caravan.muleId = add('pack_mule', 22);
    caravan.guardIds.push(add('caravan_guard', 28), add('caravan_guard', 28));
    this.roadCaravans.set(caravan.id, caravan); this.sendSpace('', 'caravanState', { state: 'departed', roadId: road.id });
  }

  completeRoadCaravan(caravan) {
    if (!this.caravanDiscounts) this.caravanDiscounts = new Map();
    for (const sid of caravan.escorts) {
      const client = this.clients.find(c => c.sessionId === sid); if (!client) continue;
      const rec = this.profileFor(client); if (!rec) continue;
      this.caravanDiscounts.set(rec.token, Date.now() + 10 * 60 * 1000);
      this.awardGrant(client, { source: 'caravan_escort', xp: 50, items: [{ id: I.IRON_INGOT, count: 2 }] });
      this.progressRegionalContract(client,'road_escort',{});
      client.send('caravanState', { state: 'arrived', discountUntil: Date.now() + 10 * 60 * 1000 });
    }
    const safety = this.adjustRoadSafety(5, 'caravan_arrived').score;
    this.removeRoadCaravan(caravan); this.nextCaravanAt = Date.now() + (safety >= 70 ? 2 : safety < 30 ? 5 : 3) * 60 * 1000;
  }

  failRoadCaravan(caravan) {
    const wagon = this.state.mobs.get(caravan.wagonId);
    if (wagon) { wagon.kind = 'caravan_wreck'; wagon.hp = wagon.maxHp = 1; const meta = this.mobMeta[caravan.wagonId]; if (meta) meta.friendly = true; }
    const camps = W.regionalLandmarkSpecs().filter(s => s.type === 'bandit_camp').sort((a,b) => Math.hypot(a.x-(wagon?.x||0),a.z-(wagon?.z||0))-Math.hypot(b.x-(wagon?.x||0),b.z-(wagon?.z||0)));
    if (!this.caravanRecoveryByCamp) this.caravanRecoveryByCamp = new Map();
    if (camps[0]) this.caravanRecoveryByCamp.set(camps[0].id, (this.caravanRecoveryByCamp.get(camps[0].id) || 0) + 1);
    this.sendSpace('', 'caravanState', { state: 'wrecked', campId: camps[0]?.id || '' });
    const keep = caravan.wagonId; for (const id of [caravan.merchantId, caravan.muleId, ...caravan.guardIds]) { this.state.mobs.delete(id); delete this.mobMeta[id]; }
    const safety = this.adjustRoadSafety(-7, 'caravan_lost').score;
    this.roadCaravans.delete(caravan.id); this.nextCaravanAt = Date.now() + (safety >= 70 ? 3 : safety < 30 ? 7 : 5) * 60 * 1000;
  }

  removeRoadCaravan(caravan) {
    for (const id of [caravan.wagonId, caravan.merchantId, caravan.muleId, ...caravan.guardIds]) { this.state.mobs.delete(id); delete this.mobMeta[id]; }
    this.roadCaravans.delete(caravan.id);
  }

  banditPatrolRoute(camp) {
    let roadPoint = null, roadBest = Infinity;
    for (const road of W.roadNetworkSpecs()) {
      const vx = road.b.x - road.a.x, vz = road.b.z - road.a.z, len2 = vx * vx + vz * vz || 1;
      const t = Math.max(0, Math.min(1, ((camp.x - road.a.x) * vx + (camp.z - road.a.z) * vz) / len2));
      const point = { x: road.a.x + vx * t, z: road.a.z + vz * t };
      const d = Math.hypot(point.x - camp.x, point.z - camp.z);
      if (d < roadBest) { roadBest = d; roadPoint = point; }
    }
    let caravan = null, caravanBest = 150;
    for (const site of W.smallDiscoverySpecs().filter(s => s.type === 'traveling_merchant')) {
      const d = Math.hypot(site.x - (roadPoint ? roadPoint.x : camp.x), site.z - (roadPoint ? roadPoint.z : camp.z));
      if (d < caravanBest) { caravanBest = d; caravan = site; }
    }
    const points = [roadPoint || { x: camp.x + 24, z: camp.z }];
    if (caravan) points.push({ x: caravan.x, z: caravan.z });
    points.push({ x: camp.x, z: camp.z });
    return { points, caravanId: caravan ? caravan.id : '' };
  }

  warnOfBanditPatrol(camp) {
    if (!this.banditTrailSightings) this.banditTrailSightings = new Map();
    for (const client of this.clients) {
      const p = this.state.players.get(client.sessionId); if (!p || p.dgn) continue;
      const seen = this.banditTrailSightings.get(client.sessionId) || new Set();
      if (seen.has(camp.id)) continue;
      let near = false;
      this.state.mobs.forEach((m, id) => { const meta = this.mobMeta[id]; if (meta && meta.banditCampId === camp.id && meta.banditPatrol && Math.hypot(m.x - p.x, m.z - p.z) < 45) near = true; });
      if (!near) continue;
      seen.add(camp.id); this.banditTrailSightings.set(client.sessionId, seen);
      client.send('banditPatrolSighted', { campId: camp.id, x: camp.x, z: camp.z, text: 'Fresh boot prints and wagon ruts lead toward a bandit patrol.' });
    }
  }

  spawnBanditCaptain(campId) {
    const camp = W.regionalLandmarkSpecs().find(s => s.id === campId && s.type === 'bandit_camp');
    if (!camp) return false;
    const ring = dangerRingAt(camp.x, camp.z), cfg = DANGER_RINGS[ring];
    const x = camp.x, z = camp.z - 3, gy = this.world.standHeight(x, z, W.WH - 2);
    if (gy < 2) return false;
    const id = String(++this.mobSeq), mob = new Mob();
    mob.x = x; mob.y = gy; mob.z = z; mob.kind = 'bandit_captain';
    mob.maxHp = mob.hp = Math.round(34 * cfg.hp);
    this.state.mobs.set(id, mob);
    const meta = this.freshMeta(x, z, Math.round(7 * cfg.dmg), 1.72 + ring * .06, mob.kind, ring, true);
    meta.bandit = true; meta.banditCaptain = true; meta.banditCampId = camp.id; meta.dangerRing = ring;
    meta.commandT = 2.5;
    meta.sx = camp.x; meta.sz = camp.z; this.mobMeta[id] = meta;
    for (const side of [-1, 1]) {
      const rid=String(++this.mobSeq),retainer=new Mob();retainer.x=camp.x+side*2;retainer.z=camp.z-2;retainer.y=this.world.standHeight(retainer.x,retainer.z,W.WH-2);retainer.kind=side<0?'bandit_shield':'bandit_brute';retainer.maxHp=retainer.hp=Math.round((side<0?19:24)*cfg.hp);this.state.mobs.set(rid,retainer);
      const rm=this.freshMeta(retainer.x,retainer.z,Math.round((side<0?4:6)*cfg.dmg),side<0?1.55:1.2,retainer.kind,ring,true);rm.bandit=true;rm.banditCampId=camp.id;rm.dangerRing=ring;rm.captainRetainer=true;rm.shield=side<0;rm.brute=side>0;rm.sx=camp.x;rm.sz=camp.z;this.mobMeta[rid]=rm;
    }
    this.sendSpace('', 'banditCampState', { id: camp.id, phase: 'captain', name: camp.name });
    return true;
  }

  onBanditKilled(meta, client) {
    if (meta && meta.roadEncounterId && this.onRoadsideBanditKilled(meta, client)) return;
    if (!meta || !meta.banditCampId) return;
    if (!this.banditCampStates) this.banditCampStates = new Map();
    const campId = meta.banditCampId;
    const camp = W.regionalLandmarkSpecs().find(s => s.id === campId && s.type === 'bandit_camp');
    if (!camp) return;
    if (meta.banditPatrol && meta.patrolId) {
      let patrolAlive = false;
      this.state.mobs.forEach((m, id) => { const other = this.mobMeta[id]; if (other && other.patrolId === meta.patrolId) patrolAlive = true; });
      if (!patrolAlive && meta.caravanId) {
        if (!this.rescuedBanditCaravans) this.rescuedBanditCaravans = new Set();
        if (!this.rescuedBanditCaravans.has(meta.patrolId)) {
          this.rescuedBanditCaravans.add(meta.patrolId);
          if (client) {
            this.awardGrant(client, { source: 'bandit_rescue', xp: 20 + (meta.dangerRing | 0) * 12, items: [{ id: I.IRON_INGOT, count: 1 + (meta.dangerRing | 0) }], dangerRing: meta.dangerRing | 0 });
            this.progressRegionalContract(client,'road_rescue',{});
            client.send('banditCaravanRescued', { campId, caravanId: meta.caravanId });
          }
          this.adjustRoadSafety(4, 'patrol_rescue');
        }
      }
    }
    if (meta.banditCaptain) {
      this.banditCampStates.set(campId, { phase: 'cleared', respawnAt: Date.now() + 5 * 60 * 1000 });
      if(client)this.progressRegionalContract(client,'road_clear_camp',{targetId:campId});
      this.adjustRoadSafety(8, 'camp_cleared');
      this.state.mobs.forEach((m,id)=>{const other=this.mobMeta[id];if(!other||other.banditCampId!==campId||other.banditCaptain)return;if(Math.random()<.6){other.surrendered=true;other.friendly=true;other.alert=false;m.state='surrender';}else{other.retreating=true;other.alert=false;m.state='retreat';}});
      for (const c of this.clients) {
        const p = this.state.players.get(c.sessionId);
        if (!p || p.dgn || Math.hypot(p.x - camp.x, p.z - camp.z) > 90) continue;
        this.markDiscovery(c, camp);
        c.send('banditCampState', { id: camp.id, phase: 'cleared', name: camp.name, respawnAt: Date.now() + 5 * 60 * 1000 });
      }
      const stolen = this.caravanRecoveryByCamp && (this.caravanRecoveryByCamp.get(campId) || 0);
      if (stolen && client) {
        this.awardGrant(client, { source: 'caravan_recovery', xp: 30 * stolen, items: [{ id: I.IRON_INGOT, count: 3 * stolen }, { id: I.COAL, count: 5 * stolen }] });
        this.progressRegionalContract(client,'road_recover',{});
        client.send('caravanState', { state: 'recovered', count: stolen }); this.caravanRecoveryByCamp.delete(campId);
      }
      return;
    }
    let guards = 0;
    this.state.mobs.forEach((m, id) => { const other = this.mobMeta[id]; if (other && other.banditCampId === campId && !other.banditCaptain) guards++; });
    const state = this.banditCampStates.get(campId);
    if (!guards && state && state.phase === 'guards' && this.spawnBanditCaptain(campId)) state.phase = 'captain';
  }

  maintainDiscoveryNests(dt, clusters = null) {
    this.discoveryNestAcc = (this.discoveryNestAcc || 0) + dt;
    if (this.discoveryNestAcc < 9) return;
    this.discoveryNestAcc = 0;
    const players = []; this.state.players.forEach(p => { if (!p.dgn) players.push(p); });
    for (const nest of W.smallDiscoverySpecs().filter(s => s.type === 'monster_nest')) {
      if (!players.some(p => Math.hypot(p.x - nest.x, p.z - nest.z) < 80)) continue;
      const ring = dangerRingAt(nest.x, nest.z), desired = Math.min(4, 2 + ring); let living = 0;
      this.state.mobs.forEach((m, id) => { if (this.mobMeta[id] && this.mobMeta[id].nestId === nest.id) living++; });
      for (; living < desired; living++) {
        if (clusters && !this.localHostileBudgetAllows(nest.x, nest.z, clusters, 0)) break;
        const a = living / desired * Math.PI * 2, x = nest.x + Math.cos(a) * 4, z = nest.z + Math.sin(a) * 4;
        const gy = this.world.standHeight(x, z, W.WH - 2); if (gy < 2) continue;
        const cfg = DANGER_RINGS[ring], kind = cfg.family[living % 2], id = String(++this.mobSeq), mob = new Mob();
        mob.x=x;mob.y=gy;mob.z=z;mob.kind=kind;mob.maxHp=mob.hp=Math.round(14*cfg.hp);this.state.mobs.set(id,mob);
        const meta=this.freshMeta(x,z,Math.round(4*cfg.dmg),1.5+ring*.08,kind,ring,true);
        meta.discoveryNest=true;meta.nestId=nest.id;meta.dangerRing=ring;this.mobMeta[id]=meta;
      }
    }
  }

  trySpawnMob(near, cluster = null, phase='night') {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, d = 26 + Math.random() * 22;
      const x = near.x + Math.cos(a) * d, z = near.z + Math.sin(a) * d;
      if (x < 2 || x > W.WX - 2 || z < 2 || z > W.WX - 2) continue;
      if (Math.max(Math.abs(x - W.TOWN.TC), Math.abs(z - W.TOWN.TC)) < W.TOWN.HS + 2) continue;
      if (cluster && this.countOverworldMobsNear(x, z, LOCAL_HOSTILE_COUNT_RADIUS, (m, meta) => !meta.friendly && !this.isAnimalKind(m.kind)) >= cluster.hostileBudget) continue;
      const gy = this.world.standHeight(x, z, W.WH - 2);
      if (gy < 2) continue;
      let lvl = 1;
      this.state.players.forEach(p => { lvl = Math.max(lvl, p.lvl); });
      const ring = dangerRingAt(x, z), cfg = DANGER_RINGS[ring],biome=W.biomeAt(x,z),family=BIOME_HOSTILE[biome];
      if(!family||family.day!==(phase==='day'))continue;
      const ranged = Math.random() < .35;
      const kind = ranged?family.ranged:family.melee;
      const id = String(++this.mobSeq);
      const mob = new Mob();
      mob.x = x; mob.y = gy; mob.z = z;
      mob.kind = kind;
      mob.maxHp = mob.hp = Math.round(((ranged ? 8 : 10) + Math.floor((lvl - 1) * 1.5)) * cfg.hp*family.hp);
      this.state.mobs.set(id, mob);
      const meta = this.freshMeta(x, z, Math.round((3 + Math.floor(lvl / 4)) * cfg.dmg*family.dmg), ((ranged ? 1.35 : 1.6) + Math.random() * .5)*family.speed, mob.kind, ring, true);
      meta.arrowDmg = Math.round((2 + Math.floor(lvl / 3)) * cfg.dmg*family.dmg);
      meta.dangerRing=ring;meta.biome=biome;meta.biomeDrop=family.drop;meta.biomeBehavior=family.behavior;meta.dayActive=!!family.day;
      if(family.behavior==='brute'&&!ranged)meta.brute=true;
      if(family.behavior==='quickshot'&&ranged)meta.quickShot=true;
      if(family.behavior==='flanker')meta.flank*=1.6;
      this.mobMeta[id] = meta;
      return true;
    }
    return false;
  }
  trySpawnAnimal(near, cluster = null) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 34;
      const x = near.x + Math.cos(a) * d, z = near.z + Math.sin(a) * d;
      if (x < 3 || x > W.WX - 3 || z < 3 || z > W.WX - 3) continue;
      if (Math.max(Math.abs(x - W.TOWN.TC), Math.abs(z - W.TOWN.TC)) < W.TOWN.HS + 5) continue;
      if (cluster && this.countOverworldMobsNear(x, z, LOCAL_ANIMAL_COUNT_RADIUS, m => this.isAnimalKind(m.kind)) >= cluster.animalBudget) continue;
      const gy = this.world.standHeight(x, z, W.WH - 2);
      const ground = this.world.getB(Math.floor(x), gy - 1, Math.floor(z));
      const biome = W.biomeAt(x, z), kind = BIOME_ANIMAL[biome];
      const allowed = biome === W.BIO.DESERT ? ground === W.B.SAND
        : biome === W.BIO.MESA ? (ground === W.B.RED_SAND || ground === W.B.TERRACOTTA)
          : biome === W.BIO.SNOWY ? (ground === W.B.SNOW || ground === W.B.ICE) : ground === W.B.GRASS;
      if (gy < 3 || !kind || !allowed) continue;
      const baseKind = ANIMAL_BASE_KIND[kind] || kind;
      const id = String(++this.mobSeq);
      const mob = new Mob();
      mob.x = x; mob.y = gy; mob.z = z;
      mob.kind = kind;
      mob.maxHp = mob.hp = baseKind === 'boar' ? 10 : baseKind === 'deer' ? 7 : 3;
      this.state.mobs.set(id, mob);
      const meta = this.freshMeta(x, z, 0, baseKind === 'rabbit' ? 2.5 : baseKind === 'deer' ? 2.0 : 1.55, kind, 0, false);
      meta.patrolT = .2 + Math.random() * 1.5;
      this.mobMeta[id] = meta;
      return true;
    }
    return false;
  }

  spawnMissingPublicGates(maxPublicRank, publicRanks) {
    let spawned = 0;
    for (let r = 0; r <= maxPublicRank; r++) {
      if (!publicRanks.has(r) && this.spawnGate(r)) spawned++;
    }
    return spawned;
  }

  ensurePublicGateRank(rank) {
    const ri = Math.max(0, Math.min(4, rank | 0));
    let gate = null;
    this.state.gates.forEach(g => {
      if (!gate && g && g.active && g.kind === 'public' && (g.rank | 0) === ri) gate = g;
    });
    if (gate) return gate;
    if (this.spawnGate(ri)) {
      this.state.gates.forEach(g => {
        if (!gate && g && g.active && g.kind === 'public' && (g.rank | 0) === ri) gate = g;
      });
      if (gate) return gate;
    }

    // The introductory Gate is a progression promise, so random placement is
    // allowed to fail over to a deterministic scan of the same legal band.
    const band = GATE_DISTANCE_BANDS[ri];
    for (let d = band.min; d <= band.max; d += 2) {
      for (let span = -d; span <= d; span += 4) {
        const candidates = [
          { x: W.TOWN.TC + span, z: W.TOWN.TC - d },
          { x: W.TOWN.TC + d, z: W.TOWN.TC + span },
          { x: W.TOWN.TC + span, z: W.TOWN.TC + d },
          { x: W.TOWN.TC - d, z: W.TOWN.TC + span },
        ];
        for (const pos of candidates) {
          if (pos.x < 6 || pos.x > W.WX - 6 || pos.z < 6 || pos.z > W.WX - 6) continue;
          const distance = townDistance(pos.x, pos.z);
          if (distance < band.min || distance > band.max) continue;
          const gy = this.world.standHeight(pos.x + .5, pos.z + .5, W.WH - 2);
          if (gy < 3 || gy > 34) continue;
          gate = this.createGate({ x: pos.x + .5, y: gy, z: pos.z + .5, rank: ri, kind: 'public', ttl: 180 });
          this.broadcast('chat', { name: '[System]', text: 'A guaranteed ' + 'EDCBA'[ri] + '-Rank Gate has opened for the new Hunter' });
          return gate;
        }
      }
    }
    return null;
  }

  gateSpawnCandidate(rank) {
    const band = GATE_DISTANCE_BANDS[Math.max(0, Math.min(4, rank | 0))] || GATE_DISTANCE_BANDS[0];
    const d = Math.floor(band.min + Math.random() * (band.max - band.min + 1));
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.round(W.TOWN.TC + Math.cos(angle) * d),
      z: Math.round(W.TOWN.TC + Math.sin(angle) * d),
    };
  }

  spawnGate(forceRank) {
    const ri = forceRank == null ? this.maxUnlockedPublicRank() : Math.max(0, Math.min(4, forceRank | 0));
    const band = GATE_DISTANCE_BANDS[ri];
    for (let i = 0; i < 80; i++) {
      const pos = this.gateSpawnCandidate(ri);
      const x = pos.x, z = pos.z;
      if (x < 6 || x > W.WX - 6 || z < 6 || z > W.WX - 6) continue;
      const distance = townDistance(x, z);
      if (distance < band.min || distance > band.max) continue;
      const gy = this.world.standHeight(x + .5, z + .5, W.WH - 2);
      if (gy < 3 || gy > 34) continue;
      this.createGate({ x: x + .5, y: gy, z: z + .5, rank: ri, kind: 'public', ttl: 75 });
      this.broadcast('chat', { name: '[System]', text: 'A ' + 'EDCBA'[ri] + '-Rank Gate has opened — party up and enter together' });
      return true;
    }
    return false;
  }
}

module.exports = SpawningMixin.prototype;
