// An authored route through the two generated cave networks and ancient cities.
const W = require('../world');
const { I } = require('./constants');

const ROUTE_REWARD = [
  { id: I.ANCIENT_FRAGMENT, count: 3 },
  { id: I.ECHO_GLYPH, count: 1 },
  { id: I.RELIC_ARMOR_PIECE, count: 1 },
  { id: I.DIAMOND, count: 1 },
];

class AncientCityRunMixin {
  ancientCityRoute(cityId) {
    const city = W.ancientCitySpecs().find(s => s.id === cityId);
    if (!city) return null;
    const caveIndex = Number(city.caveNetworkId.split('_').at(-1));
    const cave = W.regionalLandmarkSpecs().filter(s => s.type === 'cave')[caveIndex];
    const net = W.caveNetworkSpecs().find(s => s.id === city.caveNetworkId);
    if (!cave || !net) return null;
    const mouth = { id: cave.id, name: 'Deepmouth Cave entrance', x: cave.x, y: cave.y + 1, z: cave.z - 7, radius: 9 };
    const tablet = city.tablets[0];
    return { city, mouth, tablet: { id: city.id + '_' + tablet.id, name: 'Origin Tablet', x: tablet.x, y: tablet.y + 1, z: tablet.z, radius: 5 },
      vaults: city.vaults.map(v => ({ id: v.chestKey, name: 'Ancient Vault', x: v.x, y: v.y + 1, z: v.z, radius: 6 })),
      core: { id: city.id + '_core', name: 'Ancient Core', x: city.core.x, y: city.core.y + 1, z: city.core.z, radius: 7 } };
  }
  ancientCityRunPayload(prof) {
    const run = prof && prof.ancientCityRun, route = run && this.ancientCityRoute(run.cityId);
    const stage = route ? Math.max(0, Math.min(5, run.stage | 0)) : -1;
    const pending = route && (prof.ancientWardenPending || []).some(v => v.coreId === route.core.id);
    const targets = !route ? [] : stage === 0 || stage === 5 && !pending ? [route.mouth]
      : stage === 1 ? [route.tablet] : stage === 2 ? route.vaults : [route.core];
    const instruction = !route ? '' : [
      'Find the marked cave mouth. Enter the northern opening and press G at the threshold.',
      'Follow the lantern tunnel to the Origin Tablet. Press G to read it.',
      'Choose either ancient vault and press G to break its seal. The other vault remains optional.',
      'Reach the Ancient Core. Press G to raise each alarm only when your party is ready.',
      'Defeat the Ancient Warden together. Its sonic warnings are dangerous.',
      pending ? 'Your Warden reward is reserved. Make inventory space and press G at the core.'
        : 'Retrace the lantern tunnel to the cave mouth and press G to finish the expedition.',
    ][stage];
    return { active: !!route, cityId: route ? route.city.id : '', stage, total: 6,
      target: targets[0] || null, targets, instruction, vaultId: route ? run.vaultId || '' : '',
      pending: !!pending, clears: Array.isArray(prof && prof.ancientCityClears) ? prof.ancientCityClears : [],
      startedAt: route ? run.startedAt || 0 : 0 };
  }
  sendAncientCityRun(client) {
    const rec = this.profileFor(client);
    if (rec) client.send('ancientCityRun', this.ancientCityRunPayload(rec.prof));
  }
  startAncientCityRun(client) {
    const rec = this.profileFor(client);
    if (!rec || !this.cartographerInRange(client)) return client.send('ancientCityRunReject', { reason: 'range' });
    if (rec.prof.ancientCityRun) return this.sendAncientCityRun(client);
    if (rec.prof.treasureMap) return client.send('ancientCityRunReject', { reason: 'map' });
    const cities = W.ancientCitySpecs().filter(s => !(rec.prof.ancientCityClears || []).includes(s.id));
    if (!cities.length) return client.send('ancientCityRunReject', { reason: 'done' });
    const city = cities[0];
    const start = target => {
      const r = this.profileFor(target);
      if (!r || r.prof.ancientCityRun || r.prof.treasureMap || (r.prof.ancientCityClears || []).includes(city.id)) return;
      r.prof.ancientCityRun = { cityId: city.id, stage: 0, vaultId: '', startedAt: Date.now() };
      this.dirtyPlayers.add(r.token);
      this.sendAncientCityRun(target);
    };
    start(client);
    for (const mate of this.onlineTeamClients(client)) if (this.cartographerInRange(mate)) start(mate);
  }
  abandonAncientCityRun(client) {
    const rec = this.profileFor(client);
    if (!rec || !rec.prof.ancientCityRun) return;
    rec.prof.ancientCityRun = null;
    this.dirtyPlayers.add(rec.token);
    this.sendAncientCityRun(client);
  }
  ancientCityAt(client, site, radius = site && site.radius || 6) {
    const p = client && this.state.players.get(client.sessionId);
    return !!(p && !p.dgn && p.dim === 'overworld' && site &&
      Math.hypot(p.x - site.x, p.z - site.z) <= radius && Math.abs(p.y - site.y) <= 8);
  }
  advanceAncientCityRun(client, stage, site, vaultId = '') {
    const source = this.profileFor(client), cityId = source && source.prof.ancientCityRun && source.prof.ancientCityRun.cityId;
    const recipients = [client, ...this.onlineTeamClients(client)];
    for (const target of recipients) {
      const rec = this.profileFor(target), run = rec && rec.prof.ancientCityRun;
      if (!run || run.cityId !== cityId || run.stage !== stage || !this.ancientCityAt(target, site)) continue;
      run.stage = stage + 1;
      if (vaultId) run.vaultId = vaultId;
      this.dirtyPlayers.add(rec.token);
      this.sendAncientCityRun(target);
    }
    if (this.sendSpace) this.sendSpace('', 'fx', { t: 'expeditionSignal', x: site.x, y: site.y + 1, z: site.z, stage, dgn: '' });
  }
  interactAncientCityRun(client, m = {}) {
    const rec = this.profileFor(client), run = rec && rec.prof.ancientCityRun;
    if (!run) return client.send('ancientCityRunReject', { reason: 'inactive' });
    const route = this.ancientCityRoute(run.cityId), stage = run.stage | 0;
    if (!route) return client.send('ancientCityRunReject', { reason: 'inactive' });
    if (stage === 5 && (rec.prof.ancientWardenPending || []).some(v => v.coreId === route.core.id)) {
      if (m.id !== route.core.id || !this.ancientCityAt(client, route.core)) return client.send('ancientCityRunReject', { reason: 'range' });
      return this.claimAncientWardenPending(client, route.core);
    }
    if (stage === 5) {
      if (m.id !== route.mouth.id || !this.ancientCityAt(client, route.mouth)) return client.send('ancientCityRunReject', { reason: 'range' });
      return this.finishAncientCityRun(client);
    }
    if (stage === 4) return client.send('ancientCityRunReject', { reason: 'warden' });
    const sites = stage === 0 ? [route.mouth] : stage === 1 ? [route.tablet] : stage === 2 ? route.vaults : [route.core];
    const site = sites.find(s => s.id === m.id);
    if (!site || !this.ancientCityAt(client, site)) return client.send('ancientCityRunReject', { reason: 'range' });
    if (stage === 3) {
      if ((rec.prof.claimedDiscoveries || []).includes(this.ancientWardenDefeatKey(route.core.id))) {
        for (const target of [client, ...this.onlineTeamClients(client)]) {
          const r = this.profileFor(target), active = r && r.prof.ancientCityRun;
          if (!active || active.cityId !== route.city.id || active.stage !== 3 || !this.ancientCityAt(target, route.core)) continue;
          active.stage = 5;
          this.dirtyPlayers.add(r.token);
          this.sendAncientCityRun(target);
        }
        return;
      }
      this.triggerAncientWardenAlarm(client, this.discoverySpec(route.core.id), 2);
      if (this.activeAncientWarden(route.city.id)) this.advanceAncientCityRun(client, 3, route.core);
      return;
    }
    if (stage === 1 || stage === 2) {
      if (!(rec.prof.claimedDiscoveries || []).includes(site.id)) this.handleDiscoveryInteract(client, { id: site.id });
    }
    this.advanceAncientCityRun(client, stage, site, stage === 2 ? site.id.endsWith('vault_a') ? 'vault_a' : 'vault_b' : '');
  }
  ancientWardenRewardItems(ring) {
    return [
      { id: I.WARDEN_CLEAVER, count: 1, rarity: 'mythic', locked: true, gear: true, source: 'ancient_warden' },
      { id: I.LEGEND_TOKEN, count: 1 + Math.floor(ring / 2) },
      { id: I.GEODE, count: 2 + ring },
      { id: I.ANCIENT_FRAGMENT, count: 4 + ring },
      { id: I.ECHO_GLYPH, count: 1 + Math.floor(ring / 2) },
      { id: I.RELIC_ARMOR_PIECE, count: 1 },
    ];
  }
  claimAncientWardenPending(client, core) {
    const rec = this.profileFor(client), pending = rec && (rec.prof.ancientWardenPending || []).find(v => v.coreId === core.id);
    if (!pending || !this.ancientCityAt(client, core)) return false;
    const items = this.ancientWardenRewardItems(pending.ring);
    const draft = { ...rec.prof, inv: (rec.prof.inv || []).map(slot => slot ? { ...slot } : null) };
    if (items.some(item => item.gear ? this.addGearRewardItem(draft, item) : this.addRewardItem(draft, item.id, item.count))) {
      client.send('ancientWardenRewardPending', { reason: 'full', cityId: pending.cityId });
      return true;
    }
    const xp = 220 + pending.ring * 90;
    this.awardGrant(client, { source: 'ancient_warden', xp, items, dangerRing: pending.ring, elite: true });
    rec.prof.ancientWardenPending = rec.prof.ancientWardenPending.filter(v => v.coreId !== core.id);
    if (!Array.isArray(rec.prof.claimedDiscoveries)) rec.prof.claimedDiscoveries = [];
    const claimKey = this.ancientWardenDefeatKey(core.id);
    if (!rec.prof.claimedDiscoveries.includes(claimKey)) rec.prof.claimedDiscoveries.push(claimKey);
    this.dirtyPlayers.add(rec.token);
    client.send('wardenDefeated', { cityId: pending.cityId, coreId: core.id, ability: 'Warden Cleaver', items });
    this.sendAncientCityRun(client);
    return true;
  }
  finishAncientWardenForParty(client, meta, x, y, z) {
    const route = this.ancientCityRoute(meta.cityId);
    if (!route) return;
    const ring = Math.max(0, Math.min(3, meta.dangerRing | 0));
    const killer = client && this.state.players.get(client.sessionId);
    for (const target of this.clients) {
      const p = this.state.players.get(target.sessionId), rec = this.profileFor(target);
      const run = rec && rec.prof.ancientCityRun;
      const teammate = killer && p && killer.team && p.team === killer.team;
      if (!p || !rec || p.dgn || p.dim !== 'overworld' || Math.hypot(p.x - x, p.z - z) > 45 || Math.abs(p.y - y) > 12 ||
        !(target === client || teammate || run && run.cityId === meta.cityId && run.stage === 4)) continue;
      if (run && run.cityId === meta.cityId && run.stage === 4) {
        run.stage = 5;
        this.dirtyPlayers.add(rec.token);
      }
      const claimKey = this.ancientWardenDefeatKey(route.core.id);
      if (!(rec.prof.claimedDiscoveries || []).includes(claimKey) && !(rec.prof.ancientWardenPending || []).some(v => v.coreId === route.core.id)) {
        rec.prof.ancientWardenPending = [...(rec.prof.ancientWardenPending || []), { cityId: meta.cityId, coreId: route.core.id, ring }].slice(-2);
        this.dirtyPlayers.add(rec.token);
      }
      const claimed = this.claimAncientWardenPending(target, route.core);
      if (!claimed && (rec.prof.ancientWardenPending || []).some(v => v.coreId === route.core.id))
        target.send('ancientWardenRewardPending', { reason: 'collect', cityId: meta.cityId, x: route.core.x, y: route.core.y, z: route.core.z });
      this.sendAncientCityRun(target);
    }
  }
  finishAncientCityRun(client) {
    const rec = this.profileFor(client), run = rec && rec.prof.ancientCityRun;
    if (!run || run.stage !== 5) return client.send('ancientCityRunReject', { reason: 'inactive' });
    const route = this.ancientCityRoute(run.cityId);
    if (!route || !this.ancientCityAt(client, route.mouth)) return client.send('ancientCityRunReject', { reason: 'range' });
    if ((rec.prof.ancientWardenPending || []).some(v => v.coreId === route.core.id)) return client.send('ancientCityRunReject', { reason: 'pending' });
    if ((rec.prof.ancientCityClears || []).includes(run.cityId)) return client.send('ancientCityRunReject', { reason: 'done' });
    const draft = { ...rec.prof, inv: (rec.prof.inv || []).map(slot => slot ? { ...slot } : null) };
    if (ROUTE_REWARD.some(item => this.addRewardItem(draft, item.id, item.count))) return client.send('ancientCityRunReject', { reason: 'full' });
    for (const item of ROUTE_REWARD) this.addRewardItem(rec.prof, item.id, item.count);
    rec.prof.gold = Math.min(1e9, (rec.prof.gold | 0) + 260);
    rec.prof.ancientCityClears = [...(rec.prof.ancientCityClears || []), run.cityId];
    rec.prof.ancientCityRun = null;
    this.dirtyPlayers.add(rec.token);
    this.recordEconomyGold(client, 260, 'cartographer_faucet', 'ancient_city_run', { cityId: run.cityId });
    if (this.recordAncientMapProgress) this.recordAncientMapProgress(client);
    this.syncPlayerProfile(client, rec.prof);
    this.sendAncientCityRun(client);
    client.send('ancientCityRunComplete', { cityId: run.cityId, durationMs: Math.max(0, Date.now() - (run.startedAt || Date.now())),
      vaultId: run.vaultId, gold: 260, items: ROUTE_REWARD });
  }
}

module.exports = AncientCityRunMixin.prototype;
