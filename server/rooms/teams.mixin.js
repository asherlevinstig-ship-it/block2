// Persistent teams: registry mirroring, session attach/detach, create/join/leave,
// and team-scoped discovery sharing. Lifted verbatim out of GameRoom.js and mixed
// into its prototype. (Pure team logic lives in ../teams.js TeamManager.)
const {
  I,
} = require('./constants');
const { State, Player, Mob, Team, Gate } = require('../schema');
const { TeamManager } = require('../teams');
const W = require('../world');
const D = require('../dungeon');
const AI = require('../ai');
const { createStore, sanitizeProfile, mergeClientSave, defaultProfile, cleanToken, sanitizeUtilityLoadout } = require('../store');

class TeamsMixin {
  syncTeam(t) {
    let st = this.state.teams.get(t.id);
    if (!st) { st = new Team(); this.state.teams.set(t.id, st); }
    st.name = t.name;
    st.leader = t.leader;
    const persistent = this.teamRecords && this.teamRecords.get(t.id);
    st.memberCount = persistent ? persistent.members.size : t.members.size;
    st.private = !!(persistent && persistent.private);
    st.lfg = !!(persistent && persistent.lfg);
  }
  restoreSavedTeams(savedTeams) {
    let count = 0;
    for (const id in savedTeams || {}) {
      const raw = savedTeams[id];
      const rec = {
        id: raw.id, name: raw.name, leader: raw.leader,
        members: new Set(raw.members || []),
        highestGateRankCleared: raw.highestGateRankCleared | 0,
        private: !!raw.private,
        lfg: !!raw.lfg,
        invites: new Set(raw.invites || []),
      };
      this.teamRecords.set(rec.id, rec);
      this.teamMgr.teams.set(rec.id, { id: rec.id, name: rec.name, leader: '', members: new Set() });
      const seq = /^T(\d+)$/.exec(rec.id);
      if (seq) this.teamMgr.seq = Math.max(this.teamMgr.seq, seq[1] | 0);
      this.syncTeam(this.teamMgr.teams.get(rec.id));
      count++;
    }
    return count;
  }
  findTeamRecord(key) {
    const clean = this.cleanTeamId(key);
    if (clean && this.teamRecords.has(clean)) return this.teamRecords.get(clean);
    const name = this.teamMgr.sanitize(key);
    if (!name) return null;
    const lower = name.toLowerCase();
    for (const rec of this.teamRecords.values()) if (rec.name.toLowerCase() === lower) return rec;
    return null;
  }
  tokenForSid(sid) {
    return this.tokens.get(sid) || '';
  }
  onlineSidForToken(token) {
    for (const [sid, t] of this.tokens.entries()) if (t === token) return sid;
    return '';
  }
  attachTeamSession(sid, rec) {
    if (!sid || !rec) return null;
    let live = this.teamMgr.teams.get(rec.id);
    if (!live) {
      live = { id: rec.id, name: rec.name, leader: '', members: new Set() };
      this.teamMgr.teams.set(rec.id, live);
    }
    live.name = rec.name;
    live.members.add(sid);
    const leaderSid = this.onlineSidForToken(rec.leader);
    live.leader = leaderSid || live.leader || sid;
    this.teamMgr.bySid.set(sid, rec.id);
    this.syncTeam(live);
    this.setPlayerTeam(sid, rec.id);
    const client = this.clients.find(c => c.sessionId === sid);
    if (client) {
      this.unlockUtility(client, 'party_compass', 'Team navigation unlocked');
      this.syncOnlineTeamDiscoveries(client);
    }
    return live;
  }
  createPersistentTeam(client, name, isPrivate = false) {
    const token = this.clientToken(client);
    if (!token) return { err: 'sign in before creating a team' };
    if (this.teamMgr.bySid.has(client.sessionId)) return { err: 'you are already in a team' };
    const n = this.teamMgr.sanitize(name);
    if (!n) return { err: 'invalid team name' };
    if (this.findTeamRecord(n)) return { err: 'that name is taken' };
    const id = 'T' + (++this.teamMgr.seq);
    const rec = { id, name: n, leader: token, members: new Set([token]), highestGateRankCleared: -1, private: isPrivate, lfg: false, invites: new Set() };
    this.teamRecords.set(id, rec);
    this.dirtyTeams = true;
    return { team: this.attachTeamSession(client.sessionId, rec) };
  }
  joinPersistentTeam(client, key) {
    const token = this.clientToken(client);
    if (!token) return { err: 'sign in before joining a team' };
    if (this.teamMgr.bySid.has(client.sessionId)) return { err: 'you are already in a team' };
    const rec = this.findTeamRecord(key);
    if (!rec) return { err: 'no such team' };
    if (!rec.members.has(token)) {
      if (rec.private && !(rec.invites && rec.invites.has(token))) return { err: 'that team is invite-only' };
      if (rec.members.size >= this.teamMgr.max) return { err: 'that team is full (' + this.teamMgr.max + ')' };
      rec.members.add(token);
      if (rec.invites) rec.invites.delete(token);
      this.dirtyTeams = true;
    }
    return { team: this.attachTeamSession(client.sessionId, rec) };
  }
  currentTeamRecordFor(client) {
    const p = client && this.state.players.get(client.sessionId);
    const id = p && p.team;
    return id ? this.teamRecords.get(id) : null;
  }
  isTeamLeader(client, rec) {
    return !!(client && rec && this.clientToken(client) && rec.leader === this.clientToken(client));
  }
  findOnlinePlayerByNameOrSid(key) {
    const raw = typeof key === 'string' ? key.trim() : '';
    if (!raw) return null;
    for (const c of this.clients) {
      if (c.sessionId === raw) return c;
      const p = this.state.players.get(c.sessionId);
      if (p && p.name && p.name.toLowerCase() === raw.toLowerCase()) return c;
    }
    return null;
  }
  handleTeamPrivacy(client, m) {
    const rec = this.currentTeamRecordFor(client);
    if (!rec) return client.send('teamResult', { ok: false, reason: 'none' });
    if (!this.isTeamLeader(client, rec)) return client.send('teamResult', { ok: false, reason: 'leader' });
    rec.private = !!(m && m.private);
    this.dirtyTeams = true;
    const live = this.teamMgr.teams.get(rec.id);
    if (live) this.syncTeam(live);
    this.broadcast('chat', { name: '[Team]', text: '<' + rec.name + '> is now ' + (rec.private ? 'invite-only' : 'open to join') });
    client.send('teamResult', { ok: true, action: 'privacy', private: rec.private });
  }
  handleTeamLfg(client, m) {
    const rec = this.currentTeamRecordFor(client);
    if (!rec) return client.send('teamResult', { ok: false, reason: 'none' });
    if (!this.isTeamLeader(client, rec)) return client.send('teamResult', { ok: false, reason: 'leader' });
    rec.lfg = !!(m && m.lfg);
    this.dirtyTeams = true;
    const live = this.teamMgr.teams.get(rec.id);
    if (live) this.syncTeam(live);
    this.broadcast('chat', { name: '[Team]', text: '<' + rec.name + '> is ' + (rec.lfg ? 'looking for a dungeon' : 'no longer looking for a dungeon') });
    client.send('teamResult', { ok: true, action: 'lfg', lfg: rec.lfg });
  }
  handleTeamInvite(client, m) {
    const rec = this.currentTeamRecordFor(client);
    if (!rec) return client.send('teamResult', { ok: false, reason: 'none' });
    if (!this.isTeamLeader(client, rec)) return client.send('teamResult', { ok: false, reason: 'leader' });
    if (rec.members.size >= this.teamMgr.max) return client.send('teamResult', { ok: false, reason: 'full' });
    const target = this.findOnlinePlayerByNameOrSid(m && (m.sid || m.name));
    if (!target) return client.send('teamResult', { ok: false, reason: 'target' });
    const targetToken = this.clientToken(target);
    if (!targetToken) return client.send('teamResult', { ok: false, reason: 'target' });
    if (rec.members.has(targetToken)) return client.send('teamResult', { ok: false, reason: 'member' });
    if (!rec.invites) rec.invites = new Set();
    rec.invites.add(targetToken);
    this.dirtyTeams = true;
    target.send('teamInvite', { id: rec.id, name: rec.name, from: (this.state.players.get(client.sessionId) || {}).name || 'Team leader', private: !!rec.private });
    client.send('teamResult', { ok: true, action: 'invite', target: (this.state.players.get(target.sessionId) || {}).name || 'Hunter' });
  }
  handleTeamKick(client, m) {
    const rec = this.currentTeamRecordFor(client);
    if (!rec) return client.send('teamResult', { ok: false, reason: 'none' });
    if (!this.isTeamLeader(client, rec)) return client.send('teamResult', { ok: false, reason: 'leader' });
    const target = this.clients.find(c => c.sessionId === (m && m.sid));
    if (!target) return client.send('teamResult', { ok: false, reason: 'target' });
    const targetToken = this.clientToken(target);
    if (!targetToken || !rec.members.has(targetToken)) return client.send('teamResult', { ok: false, reason: 'target' });
    if (targetToken === rec.leader) return client.send('teamResult', { ok: false, reason: 'leader_self' });
    rec.members.delete(targetToken);
    this.dirtyTeams = true;
    this.detachTeamSession(target.sessionId);
    target.send('teamLeft', { id: rec.id, name: rec.name, kicked: true });
    const live = this.teamMgr.teams.get(rec.id);
    if (live) this.syncTeam(live);
    const tp = this.state.players.get(target.sessionId);
    this.broadcast('chat', { name: '[Team]', text: (tp ? tp.name : 'A hunter') + ' was removed from <' + rec.name + '>' });
    client.send('teamResult', { ok: true, action: 'kick' });
  }
  handleTeamTransfer(client, m) {
    const rec = this.currentTeamRecordFor(client);
    if (!rec) return client.send('teamResult', { ok: false, reason: 'none' });
    if (!this.isTeamLeader(client, rec)) return client.send('teamResult', { ok: false, reason: 'leader' });
    const target = this.clients.find(c => c.sessionId === (m && m.sid));
    const targetToken = target && this.clientToken(target);
    if (!targetToken || !rec.members.has(targetToken)) return client.send('teamResult', { ok: false, reason: 'target' });
    rec.leader = targetToken;
    this.dirtyTeams = true;
    const live = this.teamMgr.teams.get(rec.id);
    if (live) { live.leader = target.sessionId; this.syncTeam(live); }
    const tp = this.state.players.get(target.sessionId);
    this.broadcast('chat', { name: '[Team]', text: (tp ? tp.name : 'A hunter') + ' now leads <' + rec.name + '>' });
    client.send('teamResult', { ok: true, action: 'transfer' });
    target.send('teamResult', { ok: true, action: 'leader', id: rec.id, name: rec.name });
  }
  detachTeamSession(sid) {
    const id = this.teamMgr.bySid.get(sid);
    if (!id) return;
    const live = this.teamMgr.teams.get(id);
    this.teamMgr.bySid.delete(sid);
    if (live) {
      live.members.delete(sid);
      if (live.leader === sid) live.leader = [...live.members][0] || '';
      this.syncTeam(live);
    }
    this.setPlayerTeam(sid, '');
  }
  setPlayerTeam(sid, id) {
    const p = this.state.players.get(sid);
    if (p) p.team = id || '';
  }
  onlineTeamClients(client) {
    const p = client && this.state.players.get(client.sessionId);
    const teamId = p && p.team;
    if (!teamId) return [];
    const out = [];
    for (const c of this.clients) {
      if (!c || c.sessionId === client.sessionId) continue;
      const q = this.state.players.get(c.sessionId);
      if (q && q.team === teamId) out.push(c);
    }
    return out;
  }
  syncOnlineTeamDiscoveries(client) {
    const rec = this.profileFor(client);
    if (!rec || !Array.isArray(rec.prof.discoveries)) return;
    for (const mate of this.onlineTeamClients(client)) {
      const mrec = this.profileFor(mate);
      if (!mrec || !Array.isArray(mrec.prof.discoveries)) continue;
      for (const id of rec.prof.discoveries) {
        const s = this.explorationSpec(id);
        if (s) this.shareDiscoveryWithClient(mate, s, client);
      }
      for (const id of mrec.prof.discoveries) {
        const s = this.explorationSpec(id);
        if (s) this.shareDiscoveryWithClient(client, s, mate);
      }
    }
  }
  doTeamLeave(sid, announceErrors) {
    const id = this.teamMgr.bySid.get(sid);
    if (!id) {
      if (announceErrors) {
        const c = this.clients.find(c => c.sessionId === sid);
        if (c) c.send('chat', { name: '[Team]', text: 'you are not in a team' });
      }
      return;
    }
    const live = this.teamMgr.teams.get(id);
    const rec = this.teamRecords.get(id);
    const token = this.tokenForSid(sid);
    if (rec && token) {
      rec.members.delete(token);
      if (rec.leader === token) rec.leader = [...rec.members][0] || '';
      if (rec.invites) rec.invites.delete(token);
      this.dirtyTeams = true;
    }
    this.detachTeamSession(sid);
    this.setPlayerTeam(sid, '');
    const p = this.state.players.get(sid);
    if (!rec || rec.members.size === 0) {
      this.teamRecords.delete(id);
      this.teamMgr.teams.delete(id);
      this.state.teams.delete(id);
      const c = this.clients.find(c => c.sessionId === sid);
      if (c) c.send('teamLeft', { id, name: live ? live.name : id, disbanded: true });
      this.broadcast('chat', { name: '[System]', text: 'Team <' + (live ? live.name : id) + '> disbanded' });
    } else {
      const updated = this.teamMgr.teams.get(id) || { id, name: rec.name, leader: '', members: new Set() };
      const leaderSid = this.onlineSidForToken(rec.leader);
      updated.leader = leaderSid || updated.leader || [...updated.members][0] || '';
      this.teamMgr.teams.set(id, updated);
      this.syncTeam(updated);
      this.broadcast('chat', { name: '[System]', text: (p ? p.name : 'A hunter') + ' left <' + rec.name + '>' });
      const c = this.clients.find(c => c.sessionId === sid);
      if (c) c.send('teamLeft', { id, name: rec.name });
      if (leaderSid) {
        const np = this.state.players.get(leaderSid);
        this.broadcast('chat', { name: '[System]', text: (np ? np.name : 'A hunter') + ' now leads <' + rec.name + '>' });
      }
    }
  }
}

module.exports = TeamsMixin.prototype;
