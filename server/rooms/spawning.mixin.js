// Overworld density-budgeted mob/animal spawning, elite camps, discovery nests,
// public gate spawning, and the boss pattern machine. Lifted verbatim out of
// GameRoom.js and mixed into its prototype; update() stays as the orchestrator.
const {
  ANIMAL_BASE_KIND, ANIMAL_DESPAWN_RADIUS, ANIMAL_SPAWN_INTERVAL, BIOME_ANIMAL, DANGER_RINGS, ELITE_FAMILIES,
  GATE_DISTANCE_BANDS, HOSTILE_DESPAWN_RADIUS, HOSTILE_SPAWN_INTERVAL, I, LOCAL_ANIMAL_COUNT_RADIUS,
  LOCAL_DENSITY_CLUSTER_RADIUS, LOCAL_HOSTILE_COUNT_RADIUS, animalBudgetFor, dangerRingAt, hostileBudgetFor,
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
    for (const c of clusters) {
      c.ring = c.players.reduce((r, e) => Math.max(r, dangerRingAt(e.p.x, e.p.z)), dangerRingAt(c.x, c.z));
      c.key = Math.round(c.x / 80) + ',' + Math.round(c.z / 80);
      c.hostileBudget = hostileBudgetFor(c.players.length, c.ring);
      c.animalBudget = animalBudgetFor(c.players.length);
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
    return this.countOverworldMobsNear(x, z, LOCAL_HOSTILE_COUNT_RADIUS, m => !this.isAnimalKind(m.kind));
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
      this.state.mobs.forEach((m, id) => { if (!m.dgn) dead.push(id); });
      for (const id of dead) { this.state.mobs.delete(id); delete this.mobMeta[id]; }
      return;
    }
    const dead = [];
    this.state.mobs.forEach((m, id) => {
      if (m.dgn) return;
      const radius = this.isAnimalKind(m.kind) ? ANIMAL_DESPAWN_RADIUS : HOSTILE_DESPAWN_RADIUS;
      if (!this.nearestSurfaceCluster(m.x, m.z, clusters, radius)) dead.push(id);
    });
    for (const id of dead) { this.state.mobs.delete(id); delete this.mobMeta[id]; }
  }
  tickLocalHostileSpawns(dt, clusters) {
    if (!clusters || !clusters.length) return;
    if (!this.hostileSpawnAccByCluster) this.hostileSpawnAccByCluster = new Map();
    const liveKeys = new Set(clusters.map(c => c.key));
    for (const key of [...this.hostileSpawnAccByCluster.keys()]) if (!liveKeys.has(key)) this.hostileSpawnAccByCluster.delete(key);
    for (const c of clusters) {
      const count = this.localHostileCount(c.x, c.z);
      if (count >= c.hostileBudget) { this.hostileSpawnAccByCluster.set(c.key, 0); continue; }
      const acc = (this.hostileSpawnAccByCluster.get(c.key) || 0) + dt;
      if (acc < HOSTILE_SPAWN_INTERVAL) { this.hostileSpawnAccByCluster.set(c.key, acc); continue; }
      this.hostileSpawnAccByCluster.set(c.key, 0);
      this.trySpawnMob({ x: c.x, z: c.z }, c);
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

  trySpawnMob(near, cluster = null) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, d = 26 + Math.random() * 22;
      const x = near.x + Math.cos(a) * d, z = near.z + Math.sin(a) * d;
      if (x < 2 || x > W.WX - 2 || z < 2 || z > W.WX - 2) continue;
      if (Math.max(Math.abs(x - W.TOWN.TC), Math.abs(z - W.TOWN.TC)) < W.TOWN.HS + 2) continue;
      if (W.isTrainingMeadowLand && W.isTrainingMeadowLand(x, z, 18)) continue;
      if (cluster && this.countOverworldMobsNear(x, z, LOCAL_HOSTILE_COUNT_RADIUS, m => !this.isAnimalKind(m.kind)) >= cluster.hostileBudget) continue;
      const gy = this.world.standHeight(x, z, W.WH - 2);
      if (gy < 2) continue;
      let lvl = 1;
      this.state.players.forEach(p => { lvl = Math.max(lvl, p.lvl); });
      const ring = dangerRingAt(x, z), cfg = DANGER_RINGS[ring];
      const ranged = Math.random() < .35;
      const kind = cfg.family[ranged ? 1 : 0];
      const id = String(++this.mobSeq);
      const mob = new Mob();
      mob.x = x; mob.y = gy; mob.z = z;
      mob.kind = kind;
      mob.maxHp = mob.hp = Math.round(((ranged ? 8 : 10) + Math.floor((lvl - 1) * 1.5)) * cfg.hp);
      this.state.mobs.set(id, mob);
      const meta = this.freshMeta(x, z, Math.round((3 + Math.floor(lvl / 4)) * cfg.dmg), (ranged ? 1.35 : 1.6) + Math.random() * .5, mob.kind, ring, true);
      meta.arrowDmg = Math.round((2 + Math.floor(lvl / 3)) * cfg.dmg);
      meta.dangerRing = ring;
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
      if (W.isTrainingMeadowLand && W.isTrainingMeadowLand(x, z, 18)) continue;
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
    const side = (Math.random() * 4) | 0;
    const span = Math.floor(-d + Math.random() * (d * 2 + 1));
    const cx = W.TOWN.TC, cz = W.TOWN.TC;
    if (side === 0) return { x: Math.floor(cx + span), z: Math.floor(cz - d) };
    if (side === 1) return { x: Math.floor(cx + d), z: Math.floor(cz + span) };
    if (side === 2) return { x: Math.floor(cx + span), z: Math.floor(cz + d) };
    return { x: Math.floor(cx - d), z: Math.floor(cz + span) };
  }

  spawnGate(forceRank) {
    const ri = forceRank == null ? this.maxUnlockedPublicRank() : Math.max(0, Math.min(4, forceRank | 0));
    const band = GATE_DISTANCE_BANDS[ri];
    for (let i = 0; i < 80; i++) {
      const pos = this.gateSpawnCandidate(ri);
      const x = pos.x, z = pos.z;
      if (x < 6 || x > W.WX - 6 || z < 6 || z > W.WX - 6) continue;
      const ring = Math.max(Math.abs(x - W.TOWN.TC), Math.abs(z - W.TOWN.TC));
      if (ring < band.min || ring > band.max) continue;
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
