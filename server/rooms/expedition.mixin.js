// A compact, server-authoritative overworld expedition that reuses permanent landmarks.
const W = require('../world');
const { I } = require('./constants');

const ROUTE_ID = 'elderheart_road';
const ROUTE_TITLE = 'Roads of the Elderheart';
const STEP_TEXT = [
  'Reach the watchtower. Press G at its base to inspect the broken signal.',
  'Clear the marked bandit camp, then press G there to recover its stolen road manifest.',
  'Reach the Elderheart and press G by its roots to trace the old route.',
  'Return to Orin Mapwell in town to claim the expedition reward.',
];

class ExpeditionMixin {
  elderheartRouteSites() {
    if (this._elderheartRouteSites) return this._elderheartRouteSites;
    const sites = W.regionalLandmarkSpecs();
    const town = W.TOWN.TC;
    const nearest = (list, x, z) => list.slice().sort((a, b) =>
      Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
    const tree = nearest(sites.filter(s => s.type === 'giant_tree'), town, town);
    const tower = nearest(sites.filter(s => s.type === 'abandoned_tower'), tree.x, tree.z);
    const camp = nearest(sites.filter(s => s.type === 'bandit_camp'), (tower.x + tree.x) / 2, (tower.z + tree.z) / 2);
    this._elderheartRouteSites = [tower, camp, tree];
    return this._elderheartRouteSites;
  }
  elderheartExpeditionPayload(prof) {
    const active = prof && prof.elderheartExpedition && prof.elderheartExpedition.id === ROUTE_ID
      ? prof.elderheartExpedition : null;
    const stage = active ? Math.max(0, Math.min(3, active.stage | 0)) : -1;
    const site = stage >= 0 && stage < 3 ? this.elderheartRouteSites()[stage] : null;
    const campLead = stage === 0 ? this.elderheartRouteSites()[1] : null;
    return {
      active: !!active, done: !!(prof && prof.elderheartExpeditionDone),
      id: ROUTE_ID, title: ROUTE_TITLE, stage, total: 3,
      target: site ? { id: site.id, name: site.name, type: site.type, x: site.x, y: site.y, z: site.z, radius: site.radius } : null,
      lead: campLead ? { id: campLead.id, name: campLead.name, x: campLead.x, z: campLead.z } : null,
      instruction: active ? STEP_TEXT[stage] : '',
      claimable: stage === 3, startedAt: active ? active.startedAt || 0 : 0,
    };
  }
  sendElderheartExpedition(client) {
    const rec = this.profileFor(client);
    if (rec) client.send('elderheartExpedition', this.elderheartExpeditionPayload(rec.prof));
  }
  startElderheartExpedition(client) {
    const rec = this.profileFor(client);
    if (!rec || !this.cartographerInRange(client)) return client.send('elderheartExpeditionReject', { reason: 'range' });
    if (rec.prof.elderheartExpeditionDone) return client.send('elderheartExpeditionReject', { reason: 'done' });
    if (rec.prof.elderheartExpedition) return this.sendElderheartExpedition(client);
    const start = target => {
      const r = this.profileFor(target);
      if (!r || r.prof.elderheartExpedition || r.prof.elderheartExpeditionDone) return false;
      r.prof.elderheartExpedition = { id: ROUTE_ID, stage: 0, startedAt: Date.now() };
      this.dirtyPlayers.add(r.token);
      this.sendElderheartExpedition(target);
      return true;
    };
    start(client);
    for (const mate of this.onlineTeamClients(client)) {
      const p = this.state.players.get(mate.sessionId);
      if (p && !p.dgn && Math.hypot(p.x - W.HUB.cartographer.x, p.z - W.HUB.cartographer.z) <= 18) start(mate);
    }
  }
  abandonElderheartExpedition(client) {
    const rec = this.profileFor(client);
    if (!rec || !rec.prof.elderheartExpedition) return;
    rec.prof.elderheartExpedition = null;
    this.dirtyPlayers.add(rec.token);
    this.sendElderheartExpedition(client);
  }
  elderheartAtSite(client, stage, id) {
    const p = client && this.state.players.get(client.sessionId);
    const site = this.elderheartRouteSites()[stage];
    return !!(p && site && !p.dgn && p.dim === 'overworld' && id === site.id &&
      Math.hypot(p.x - site.x, p.z - site.z) <= site.radius + 3 &&
      Math.abs(p.y - (site.y + 1)) <= 9);
  }
  elderheartBearing() {
    const [tower, camp] = this.elderheartRouteSites();
    return (camp.z < tower.z ? 'N' : 'S') + (camp.x < tower.x ? 'W' : 'E');
  }
  advanceElderheartExpedition(client, stage) {
    const site = this.elderheartRouteSites()[stage];
    const recipients = [client, ...this.onlineTeamClients(client)];
    let advanced = 0;
    for (const target of recipients) {
      const rec = this.profileFor(target), active = rec && rec.prof.elderheartExpedition;
      if (!active || active.id !== ROUTE_ID || active.stage !== stage || !this.elderheartAtSite(target, stage, site.id)) continue;
      active.stage = stage + 1;
      this.dirtyPlayers.add(rec.token);
      this.markDiscovery(target, site);
      this.sendElderheartExpedition(target);
      advanced++;
    }
    if (advanced && this.sendSpace) this.sendSpace('', 'fx', { t: 'expeditionSignal', x: site.x, y: site.y + 2, z: site.z, stage, dgn: '' });
    return advanced;
  }
  interactElderheartExpedition(client, m) {
    const rec = this.profileFor(client), active = rec && rec.prof.elderheartExpedition;
    if (!active || active.id !== ROUTE_ID || active.stage >= 3) return client.send('elderheartExpeditionReject', { reason: 'inactive' });
    const stage = active.stage | 0, site = this.elderheartRouteSites()[stage];
    if (!this.elderheartAtSite(client, stage, m && m.id)) return client.send('elderheartExpeditionReject', { reason: 'range' });
    if (stage === 0) return client.send('elderheartExpeditionPrompt', {
      stage, title: 'ALIGN THE WATCHTOWER SIGNAL',
      text: 'The camp marker B is on your world map. Face north with the map upright, then compare it with this tower E: which way should the beacon face?',
      choices: ['NW', 'NE', 'SW', 'SE'], targetId: site.id,
    });
    if (stage === 1) {
      const camp = this.banditCampStates && this.banditCampStates.get(site.id);
      if (!camp || camp.phase !== 'cleared' || camp.respawnAt <= Date.now())
        return client.send('elderheartExpeditionReject', { reason: 'camp' });
    }
    this.advanceElderheartExpedition(client, stage);
  }
  chooseElderheartSignal(client, m) {
    const rec = this.profileFor(client), active = rec && rec.prof.elderheartExpedition;
    const site = this.elderheartRouteSites()[0];
    if (!active || active.id !== ROUTE_ID || active.stage !== 0 || !this.elderheartAtSite(client, 0, m && m.id))
      return client.send('elderheartExpeditionReject', { reason: 'range' });
    if (!m || m.choice !== this.elderheartBearing()) return client.send('elderheartExpeditionReject', { reason: 'bearing' });
    this.advanceElderheartExpedition(client, 0);
  }
  claimElderheartExpedition(client) {
    const rec = this.profileFor(client), active = rec && rec.prof.elderheartExpedition;
    if (!rec || !active || active.stage !== 3 || !this.cartographerInRange(client))
      return client.send('elderheartExpeditionReject', { reason: 'claim' });
    const material = { id: I.HEARTWOOD_RESIN, count: 2 };
    const draft = { ...rec.prof, inv: (rec.prof.inv || []).map(slot => slot ? { ...slot } : null) };
    if (this.addRewardItem(draft, material.id, material.count)) return client.send('elderheartExpeditionReject', { reason: 'full' });
    const gold = 100, xp = 90;
    this.addRewardItem(rec.prof, material.id, material.count);
    rec.prof.gold = Math.min(1e9, (rec.prof.gold | 0) + gold);
    this.grantHunterXp(rec.prof, xp, client, 'elderheart_expedition');
    rec.prof.elderheartExpeditionDone = true;
    rec.prof.elderheartExpedition = null;
    this.dirtyPlayers.add(rec.token);
    this.recordEconomyGold(client, gold, 'cartographer_faucet', 'elderheart_expedition');
    this.syncPlayerProfile(client, rec.prof);
    this.sendElderheartExpedition(client);
    const p = this.state.players.get(client.sessionId);
    const gates = [];
    this.state.gates.forEach(g => { if (g.active && g.kind === 'public' && this.canEnterGate(client, g)) gates.push(g); });
    gates.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    const gate = gates[0];
    client.send('elderheartExpeditionComplete', { title: ROUTE_TITLE, gold, xp, items: [material],
      durationMs: Math.max(0, Date.now() - (active.startedAt || Date.now())),
      roadSafety: this.roadSafetySnapshot ? this.roadSafetySnapshot().score : 0,
      nextGate: gate ? { id: gate.id, rank: gate.rank | 0, x: gate.x, z: gate.z } : null });
  }
}

module.exports = ExpeditionMixin.prototype;
