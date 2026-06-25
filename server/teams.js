// Team registry: pure logic, no colyseus dependencies (unit-testable).
// Teams are room-scoped and ephemeral; the GameRoom mirrors them into
// synced schema state and handles announcements.

class TeamManager {
  constructor(max = 5) {
    this.max = max;
    this.seq = 0;
    this.teams = new Map();   // id -> {id, name, leader, members:Set<sid>}
    this.bySid = new Map();   // sid -> teamId
  }
  sanitize(name) {
    if (typeof name !== 'string') return null;
    const n = name.replace(/[<>]/g, '').trim().slice(0, 20);
    return n.length ? n : null;
  }
  findByName(name) {
    const k = String(name).toLowerCase();
    for (const t of this.teams.values())
      if (t.name.toLowerCase() === k) return t;
    return null;
  }
  create(sid, name) {
    if (this.bySid.has(sid)) return { err: 'you are already in a team' };
    const n = this.sanitize(name);
    if (!n) return { err: 'invalid team name' };
    if (this.findByName(n)) return { err: 'that name is taken' };
    const id = 'T' + (++this.seq);
    const t = { id, name: n, leader: sid, members: new Set([sid]) };
    this.teams.set(id, t);
    this.bySid.set(sid, id);
    return { team: t };
  }
  join(sid, key) {
    if (this.bySid.has(sid)) return { err: 'you are already in a team' };
    let t = this.teams.get(key);
    if (!t && typeof key === 'string') {
      const n = this.sanitize(key);
      if (n) t = this.findByName(n);
    }
    if (!t) return { err: 'no such team' };
    if (t.members.size >= this.max) return { err: 'that team is full (' + this.max + ')' };
    t.members.add(sid);
    this.bySid.set(sid, t.id);
    return { team: t };
  }
  leave(sid) {
    const id = this.bySid.get(sid);
    if (!id) return { err: 'you are not in a team' };
    const t = this.teams.get(id);
    this.bySid.delete(sid);
    t.members.delete(sid);
    if (t.members.size === 0) {
      this.teams.delete(id);
      return { team: t, disbanded: true };
    }
    let promoted = null;
    if (t.leader === sid) {
      t.leader = [...t.members][0];
      promoted = t.leader;
    }
    return { team: t, promoted };
  }
  teamOf(sid) {
    const id = this.bySid.get(sid);
    return id ? this.teams.get(id) : null;
  }
}

module.exports = { TeamManager };
