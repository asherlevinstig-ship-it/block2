const { performance } = require('perf_hooks');
const { Room, matchMaker } = require('colyseus');
const { State, Player, Mob, Team, Gate } = require('../schema');
const { TeamManager } = require('../teams');
const W = require('../world');
const D = require('../dungeon');
const AI = require('../ai');
const { createStore, sanitizeProfile, mergeClientSave, defaultProfile, cleanToken, sanitizeUtilityLoadout, TUTORIAL_VERSIONS } = require('../store');
const { getAuthService } = require('../auth');
const { hunterXpForActivity } = require('./xp-economy');
const { PHRASES: QUICK_CHAT, RULES: COMMS_RULES } = require('../../shared/comms-rules');
const JOB_SYSTEM = require('../../shared/job-system');
const GEAR_SYSTEM = require('../../shared/gear-system');
const LOOT_ECONOMY = require('../../shared/loot-economy');
const { takeHandoff, drainConsumedGates } = require('./dungeon-handoff');

// Blockcraft is one persistent global world, not a set of independent room
// shards. Colyseus normally creates another room when the first reaches
// maxClients; allowing that would give two simulations write access to the
// same world persistence. Keep a process-local lease so overflow fails closed
// instead of starting a second, divergent world writer.
let activeGlobalRoom = null;
function claimGlobalWorld(room) {
  if (activeGlobalRoom && activeGlobalRoom !== room) {
    throw new Error('the global Blockcraft world is already active; refusing a second persistence writer');
  }
  activeGlobalRoom = room;
}
function releaseGlobalWorld(room) {
  if (activeGlobalRoom === room) activeGlobalRoom = null;
}

const {
  ANIMAL_BASE_KIND, ANIMAL_KINDS, ARMOR_INFO, BETA_FARM_TEST, BIOME_COLLECTIBLE, BOSS_CONTRIB_MS,
  BOSS_REWARD_RANGE, CROP_GROW_MS, DANGER_RINGS, DAY_MS, DRAGON_EGG_OF, DRAGON_TYPE_SET, EVENT_FIRST_DELAY_MS,
  EVENT_KING, FOOD_VALUES, GUILD_BOARD_POS, I, JOB_IDS, LAND_BASE_PRICE, LAND_FREE_RADIUS,
  LAND_NEAR_TOWN_BONUS, LAND_PRICE_FADE, MAX_HUNGER, MINE_REQUIRE, RANGED_ENEMY_KINDS, SHARD_ITEM_IDS,
  SHARD_TIERS, SKYSHIP_AWAY_MS, SKYSHIP_BOARD_GOLD, SKYSHIP_BOARD_RANK, SKYSHIP_CYCLE_MS, SKYSHIP_DOCK_MS,
  SKYSHIP_TRAVEL_MS, SOLO_KEYS, TEAM_KEYS, TOOL_INFO, UTILITY_IDS, dangerRingAt, dayTimeAt, dragonMountType,
  gateRankIndexForLevel, hunterActivityXpForLevel, hunterRankIndexForLevel, isDragonMount, jobLevelFromXp, jobPerkChance, jobPerkTier,
  nextHunterRankLevel,
  mobTargetInRange, shadeMitigation, skyshipSnapshot, sstep, clampN, cleanName, cleanDragonName, townDistance, xpNeedForLevel,
} = require('./constants');

class GameRoom extends Room {
  static async onAuth(_token, request) {
    const account = getAuthService().authenticateRequest(request);
    if (!account) throw new Error('authentication required');
    return account;
  }

  async onCreate() {
    claimGlobalWorld(this);
    try {
    this.maxClients = 16;
    this.bootId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
    this.setState(new State());
    this.world = W.createWorld();
    this.world.generate();

    // ---- persistence ----
    this.store = createStore();
    this.initPersistenceState();   // dirty-tracking + profile/save bookkeeping (defined below)

    // ---- per-session bookkeeping (rate limiting, PvP, vitals) ----
    this.lastMoveMsg = new Map();
    this.lastAttackMsg = new Map();
    this.rateBuckets = new Map();   // sessionId -> Map(bucket -> {tokens,last}) for handler flood control
    this.playerLastHit = new Map();
    this.aegisBounties = new Map();
    this.playerHp = new Map();
    this.playerHunger = new Map();
    this.biomeStatuses = new Map();
    this.bossContrib = new Map();
    this.recentApprovedComms = [];
    this.moderationReports = [];
    this.restartRecoveries = new Map();
    this.tutorialReturns = new Map();

    // ---- dungeon / gate lifecycle (dungeon.mixin.js) ----
    this.initDungeonState();        // must precede restoreSavedGates (populates gateSeq/gateTtls)

    // ---- land claims & farming (handled inline in GameRoom; no mixin) ----
    this.landClaims = new Map();
    this.cropTimers = new Map();
    this.cropMeta = new Map();
    this.cropGrowAcc = 0;

    // ---- dragon incubation / nesting (dragons.mixin.js) ----
    this.initDragonState();         // must precede the incubation/nest restore loaders below

    // ---- server events / day cycle (events.mixin.js) ----
    this.initEventsState();
    const saved = await this.store.loadWorldEdits();
    this.worldProgress = { highestGateRankCleared: -1, roadSafety: 50, roadSafetyUpdatedAt: Date.now(), cropKinds: {} };
    let applied = 0;
    for (const k in saved) {
      const [x, y, z] = k.split(',').map(Number);
      const id = saved[k] | 0;
      if (!W.inWorld(x, y, z) || id < 0 || id > W.MAX_BLOCK_ID) continue;
      this.world.setB(x, y, z, id);
      this.state.edits.set(k, id);
      applied++;
    }
    try {
      this.worldProgress = await this.store.loadWorldProgress();
      for (const [key, kind] of Object.entries(this.worldProgress.cropKinds || {})) this.cropMeta.set(key, { kind, level: 1 });
      if ((this.worldProgress.highestGateRankCleared | 0) >= 0) console.log('[persist] world gate progress rank ' + 'EDCBA'[this.worldProgress.highestGateRankCleared | 0]);
    } catch (e) { console.warn('[persist] world progress load failed:', e.message); }
    try {
      const savedClaims = await this.store.loadLandClaims();
      let claimCount = 0;
      for (const key in savedClaims) {
        this.landClaims.set(key, savedClaims[key]);
        claimCount++;
      }
      if (claimCount) console.log('[persist] restored ' + claimCount + ' land claims');
    } catch (e) { console.warn('[persist] land claim load failed:', e.message); }
    this.chests = new Map();
    this.furnaces = new Map();
    if (applied) console.log('[persist] restored ' + applied + ' world edits');
    try {
      const savedChests = await this.store.loadChests();
      let chestCount = 0;
      for (const key in savedChests) {
        this.chests.set(key, savedChests[key]);
        chestCount++;
      }
      if (chestCount) console.log('[persist] restored ' + chestCount + ' chests');
    } catch (e) { console.warn('[persist] chest load failed:', e.message); }
    try {
      const savedFurnaces = await this.store.loadFurnaces();
      let furnaceCount = 0;
      for (const key in savedFurnaces) {
        this.furnaces.set(key, savedFurnaces[key]);
        furnaceCount++;
      }
      if (furnaceCount) console.log('[persist] restored ' + furnaceCount + ' furnaces');
    } catch (e) { console.warn('[persist] furnace load failed:', e.message); }
    try {
      const savedInc = await this.store.loadIncubations();
      let incCount = 0;
      for (const key in savedInc) {
        const inc = savedInc[key];
        // drop incubations whose insulator was removed while the server was down (unclaimable, and the egg can't be returned)
        if (this.world.getB(inc.x, inc.y, inc.z) !== W.B.EGG_INSULATOR) continue;
        inc.ownerSid = '';                   // session ids don't survive a restart; rebound when the owner rejoins
        this.dragonIncubations.set(key, inc);
        incCount++;
      }
      if (incCount) console.log('[persist] restored ' + incCount + ' dragon incubations');
    } catch (e) { console.warn('[persist] incubation load failed:', e.message); }
    try {
      const savedNests = await this.store.loadNestDragons();
      let nestCount = 0;
      for (const key in savedNests) {
        const nx = key.split('#')[0].split(',').map(Number);
        if (this.world.getB(nx[0], nx[1], nx[2]) !== W.B.EGG_INSULATOR) continue;  // nest block gone
        this.nestDragons.set(key, savedNests[key]);
        nestCount++;
      }
      if (nestCount) console.log('[persist] restored ' + nestCount + ' nesting dragons');
    } catch (e) { console.warn('[persist] nest load failed:', e.message); }
    try {
      const savedGates = await this.store.loadGates();
      const gateCount = this.restoreSavedGates(savedGates);
      if (gateCount) console.log('[persist] restored ' + gateCount + ' gates');
    } catch (e) { console.warn('[persist] gate load failed:', e.message); }
    this.clock.setInterval(() => this.flush(), 30000);
    this.clock.setInterval(() => this.logMetrics(), 60000);
    this.clock.setInterval(() => this.completeFurnaces(true), 1000);
    this.clock.setInterval(() => this.broadcastSkyshipSync(), 30000);
    this.clock.setInterval(() => this.broadcastDayCycleSync(), 30000);

    // ---- sim state ----
    this.mobSeq = 0;
    this.mobMeta = {};
    this.instances = {};
    this.initCombatState();     // combat-domain sim state lives in combat.mixin.js
    this.teamMgr = new TeamManager(5);
    this.teamRecords = new Map();
    try {
      const savedTeams = await this.store.loadTeams();
      const teamCount = this.restoreSavedTeams(savedTeams);
      if (teamCount) console.log('[persist] restored ' + teamCount + ' teams');
    } catch (e) { console.warn('[persist] team load failed:', e.message); }
    this.guilds = new Map();
    this.guildSeq = 0;
    try {
      const savedGuilds = await this.store.loadGuilds();
      for (const id in savedGuilds) {
        const g = savedGuilds[id];
        g.members = new Set(g.members || [g.leader]);
        g.invites = new Set(g.invites || []);
        g.roles = new Map(Object.entries(g.roles || {}).filter(([, role]) => role === 'officer'));
        this.guilds.set(id, g);
        const seq = id.match(/^G(\d+)$/);
        if (seq) this.guildSeq = Math.max(this.guildSeq, seq[1] | 0);
      }
      for (const g of this.guilds.values()) if (g.floor > 0) this.buildGuildHallFloor(g.floor, false);
    } catch (e) { console.warn('[persist] guild load failed:', e.message); }
    this.spawnAcc = 0;
    this.animalSpawnAcc = 0;

    // ---- message handlers ----
    this.onMessage('move', (client, m) => this.handleMove(client, m));

    this.onMessage('mount', (client, m) => this.handleMount(client, m));
    this.onMessage('dismount', (client) => this.handleDismount(client));
    this.onMessage('hatchDragonEgg', (client, m) => this.handleHatchDragonEgg(client, m));
    this.onMessage('renameDragon', (client, m) => this.handleRenameDragon(client, m));
    this.onMessage('perchDragon', (client, m) => this.handlePerchDragon(client, m));
    this.onMessage('recallDragon', (client, m) => this.handleRecallDragon(client, m));
    this.onMessage('feedDragon', (client, m) => this.handleFeedDragon(client, m));
    this.onMessage('dragonBreath', (client, m) => this.handleDragonBreath(client, m));
    this.onMessage('bindFamiliar', (client, m) => this.handleBindFamiliar(client, m));
    this.onMessage('summonFamiliar', (client, m) => this.handleSummonFamiliar(client, m));
    this.onMessage('dismissFamiliar', (client) => { const p = this.state.players.get(client.sessionId); if (p) p.familiar = ''; });
    this.onMessage('feedMountedDragon', (client, m) => this.handleFeedMountedDragon(client, m));
    this.onMessage('skyshipSyncRequest', (client) => this.sendSkyshipSync(client));
    this.onMessage('skyshipBoard', (client) => this.handleSkyshipBoard(client));
    this.onMessage('dayCycleSyncRequest', (client) => this.sendDayCycleSync(client));
    this.onMessage('sleep', (client, m) => this.handleSleep(client, m));

    this.onMessage('meta', (client, m) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !m) return;
      if (typeof m.name === 'string') p.name = cleanName(m.name);
      if (['shadow', 'mage', 'guardian'].includes(m.path)) this.setPath(client, m.path);
      p.heldId = clampN(m.heldId, 0, 999) | 0;
    });

    this.onMessage('spendStat', (client, m) => this.handleSpendStat(client, m));
    this.onMessage('setJob', (client, m) => this.handleSetJob(client, m));
    this.onMessage('jobContract', (client, m) => this.handleJobContract(client, m));
    this.onMessage('meditateTick', (client) => this.handleMeditateTick(client));
    this.onMessage('equipArmor', (client, m) => this.handleEquipArmor(client, m));
    this.onMessage('equipWeapon', (client, m) => this.handleEquipWeapon(client, m));
    this.onMessage('npcQuest', (client, m) => this.handleNpcQuest(client, m));
    this.onMessage('claimAegisTrial', (client) => this.handleClaimAegisTrial(client));

    this.onMessage('edit', (client, m) => this.handleWorldEdit(client, m));
    this.onMessage('trainingReset', (client) => this.handleTutorialEnter(client, { kind: 'onboarding' }));
    this.onMessage('tutorialEnter', (client, m) => this.handleTutorialEnter(client, m));
    this.onMessage('tutorialExit', (client) => this.handleTutorialExit(client));
    this.onMessage('landClaimBuy', (client, m) => this.handleLandClaimBuy(client, m));
    this.onMessage('useFood', (client, m) => this.handleUseFood(client, m));
    this.onMessage('useRepairKit', (client, m) => this.handleUseRepairKit(client, m));
    this.onMessage('blacksmithRepair', (client, m) => this.handleBlacksmithRepair(client, m));
    this.onMessage('blacksmithUpgrade', (client, m) => this.handleBlacksmithUpgrade(client, m));
    this.onMessage('blacksmithReforge', (client, m) => this.handleBlacksmithReforge(client, m));
    this.onMessage('blacksmithSalvage', (client, m) => this.handleBlacksmithSalvage(client, m));
    this.onMessage('lootRecovery', (client, m) => this.handleLootRecovery(client, m));
    this.onMessage('gearLock', (client, m) => this.handleGearLock(client, m));

    this.onMessage('dedit', (client, m) => this.handleDungeonEdit(client, m));

    this.onMessage('attack', (client, m) => this.handleAttack(client, m));
    this.onMessage('banditSpare', (client, m) => this.handleBanditSpare(client, m));
    this.onMessage('roadsideInteract', (client, m) => this.handleRoadsideInteract(client, m));
    this.onMessage('eventHit', (client, m) => this.handleEventHit(client, m));
    this.onMessage('requestAegisBounty', (client) => this.handleRequestAegisBounty(client));
    this.onMessage('pvpBountyHit', (client, m) => this.handlePvpBountyHit(client, m));

    this.onMessage('blackhole', (client, m) => this.handleBlackholeStaff(client, m));
    this.onMessage('legendaryWeapon', (client, m) => this.handleLegendaryWeapon(client, m));
    this.onMessage('craftLegendary', (client, m) => this.handleCraftLegendary(client, m));
    this.onMessage('ability', (client, m) => this.handleAbility(client, m));
    this.onMessage('dragonAbility', (client, m) => this.handleDragonAbility(client, m));
    this.onMessage('utilityLoadout', (client, m) => this.handleUtilityLoadout(client, m));

    this.onMessage('save', (client, m) => {
      const token = this.tokens.get(client.sessionId);
      if (!token || !m) return;
      const now = Date.now();
      if (now - (this.lastSaveMsg.get(client.sessionId) || 0) < 5000) return;
      let raw; try { raw = JSON.stringify(m); } catch (e) { return; }
      if (raw.length > 20000) return;
      this.lastSaveMsg.set(client.sessionId, now);
      const existing = this.profiles.get(token) || defaultProfile();
      const prof = mergeClientSave(existing, m);
      if (existing.noPersist) prof.noPersist = true;   // a failed-load session stays non-persistable across saves
      const p = this.state.players.get(client.sessionId);
      if (p) {
        prof.name = p.name;
        p.lvl = prof.S.lvl;
        p.path = prof.S.path;
        p.job = JOB_IDS.has(prof.job) ? prof.job : '';
        p.jobLvl = p.job ? jobLevelFromXp((prof.jobXpByJob && prof.jobXpByJob[p.job]) || prof.jobXp) : 0;
        if (!p.dgn) prof.pos = [p.x, p.y, p.z];
        else {
          const prev = this.profiles.get(token);
          if (prev) prof.pos = prev.pos;
        }
      }
      this.profiles.set(token, prof);
      this.dirtyPlayers.add(token);
    });

    this.onMessage('claimFirstQuestReward', client => this.handleClaimFirstQuestReward(client));
    this.onMessage('ackFirstPromotion', client => this.handleAckFirstPromotion(client));
    this.onMessage('tutorialComplete', (client, m) => this.handleTutorialComplete(client, m));
    this.onMessage('dungeonRecoveryRequest', client => {
      const token = this.tokens.get(client.sessionId);
      const recovery = token && this.restartRecoveries.get(token);
      if (!recovery) return;
      client.send('dungeonRestartRecovery', recovery);
      this.restartRecoveries.delete(token);
    });
    if (process.env.BLOCKCRAFT_E2E === '1') {
      this.onMessage('e2eJourney', (client, m) => this.handleE2EJourney(client, m));
    }

    this.onMessage('teamCreate', (client, m) => {
      const r = this.createPersistentTeam(client, m && m.name, !!(m && m.private));
      if (r.err) return client.send('chat', { name: '[Team]', text: r.err });
      this.syncTeam(r.team);
      this.setPlayerTeam(client.sessionId, r.team.id);
      this.unlockUtility(client, 'party_compass', 'Team navigation unlocked');
      const p = this.state.players.get(client.sessionId);
      this.broadcast('chat', { name: '[System]', text: (p ? p.name : 'A hunter') + ' founded team <' + r.team.name + '>' });
    });
    this.onMessage('teamJoin', (client, m) => {
      const r = this.joinPersistentTeam(client, m && m.key);
      if (r.err) return client.send('chat', { name: '[Team]', text: r.err });
      this.setPlayerTeam(client.sessionId, r.team.id);
      this.unlockUtility(client, 'party_compass', 'Team navigation unlocked');
      const p = this.state.players.get(client.sessionId);
      this.broadcast('chat', { name: '[System]', text: (p ? p.name : 'A hunter') + ' joined <' + r.team.name + '> (' + r.team.members.size + '/5)' });
    });
    this.onMessage('teamLeave', (client) => this.doTeamLeave(client.sessionId, true));
    this.onMessage('teamPrivacy', (client, m) => this.handleTeamPrivacy(client, m));
    this.onMessage('teamInvite', (client, m) => this.handleTeamInvite(client, m));
    this.onMessage('teamKick', (client, m) => this.handleTeamKick(client, m));
    this.onMessage('teamTransfer', (client, m) => this.handleTeamTransfer(client, m));
    this.onMessage('teamLfg', (client, m) => this.handleTeamLfg(client, m));
    this.onMessage('guildHallRequest', client => this.sendGuildHallSync(client));
    this.onMessage('guildCreate', (client, m) => this.handleGuildCreate(client, m));
    this.onMessage('guildJoin', (client, m) => this.handleGuildJoin(client, m));
    this.onMessage('guildLeave', (client) => this.handleGuildLeave(client));
    this.onMessage('guildPrivacy', (client, m) => this.handleGuildPrivacy(client, m));
    this.onMessage('guildInvite', (client, m) => this.handleGuildInvite(client, m));
    this.onMessage('guildKick', (client, m) => this.handleGuildKick(client, m));
    this.onMessage('guildRole', (client, m) => this.handleGuildRole(client, m));
    this.onMessage('guildFloorBuy', client => this.handleGuildFloorBuy(client));
    this.onMessage('tchat', (client, m) => {
      const t = this.teamMgr.teamOf(client.sessionId);
      const p = this.state.players.get(client.sessionId);
      if (!t || !p || !m) return;
      const text = QUICK_CHAT[m.phrase];
      if (!text) return client.send('commsReject', { reason: 'phrase' });
      for (const sid of t.members) {
        const c = this.clients.find(c => c.sessionId === sid);
        if (c) c.send('tchat', { name: p.name, text });
      }
    });
    this.onMessage('comms', (client, m) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !m) return;
      const text = QUICK_CHAT[m.phrase];
      const mode = ['local', 'party', 'whisper'].includes(m.mode) ? m.mode : 'local';
      if (!text) return client.send('commsReject', { reason: 'phrase' });
      const now = Date.now(), signature = mode + ':' + String(m.target || '') + ':' + m.phrase;
      if (now - (client._lastCommsAt || 0) < COMMS_RULES.rapidCooldownMs) return client.send('commsReject', { reason: 'rate' });
      if (client._lastCommsSignature === signature && now - (client._lastCommsSignatureAt || 0) < COMMS_RULES.duplicateCooldownMs) return client.send('commsReject', { reason: 'duplicate' });
      client._lastCommsAt = now; client._lastCommsSignature = signature; client._lastCommsSignatureAt = now;
      const senderToken = this.tokens.get(client.sessionId) || '';
      this.recentApprovedComms.push({ at: now, from: senderToken, phrase: m.phrase, mode });
      if (this.recentApprovedComms.length > 200) this.recentApprovedComms.splice(0, this.recentApprovedComms.length - 200);
      const send = c => { if (c === client || !(c._mutedComms instanceof Set) || !c._mutedComms.has(senderToken)) c.send('comms', { mode, fromSid: client.sessionId, name: p.name || 'Hunter', text }); };
      if (mode === 'party') {
        const team = this.teamMgr.teamOf(client.sessionId);
        if (!team) return client.send('commsReject', { reason: 'party' });
        for (const sid of team.members) { const c = this.clients.find(other => other.sessionId === sid); if (c) send(c); }
        return;
      }
      if (mode === 'whisper') {
        const targetKey = typeof m.target === 'string' ? m.target.trim().toLowerCase() : '';
        const target = this.clients.find(other => {
          const q = this.state.players.get(other.sessionId);
          return other.sessionId.toLowerCase() === targetKey || (q && String(q.name).toLowerCase() === targetKey);
        });
        if (!target) return client.send('commsReject', { reason: 'target' });
        if (target !== client && target._mutedComms instanceof Set && target._mutedComms.has(senderToken)) return client.send('commsReject', { reason: 'muted' });
        send(client); if (target !== client) send(target);
        return;
      }
      for (const c of this.clients) {
        const q = this.state.players.get(c.sessionId);
        if (q && (q.dim || 'overworld') === (p.dim || 'overworld') && (q.dgn || '') === (p.dgn || '') && Math.hypot(q.x - p.x, q.z - p.z) <= COMMS_RULES.localRange) send(c);
      }
    });
    this.onMessage('commsMute', (client, m) => {
      const target = m && typeof m.target === 'string' ? m.target : '';
      const targetClient = this.clients.find(other => other.sessionId === target);
      const targetToken = targetClient ? this.tokens.get(targetClient.sessionId) : cleanToken(m && m.targetToken);
      if (!targetToken || targetToken === this.tokens.get(client.sessionId)) return client.send('commsMuteResult', { ok: false, target });
      if (!(client._mutedComms instanceof Set)) client._mutedComms = new Set();
      if (m.muted === false) client._mutedComms.delete(targetToken); else client._mutedComms.add(targetToken);
      const rec = this.profileFor(client); if (rec) { rec.prof.mutedPlayers = [...client._mutedComms]; this.dirtyPlayers.add(rec.token); }
      client.send('commsMuteResult', { ok: true, target, targetToken, muted: client._mutedComms.has(targetToken) });
    });
    this.onMessage('commsBlockList', client => {
      const entries = [...(client._mutedComms || [])].map(targetToken => ({ targetToken, name: this.profiles.get(targetToken)?.name || 'Blocked Hunter' }));
      client.send('commsBlockList', { entries });
    });
    this.onMessage('commsReport', (client, m) => {
      const target = this.clients.find(other => other.sessionId === (m && m.target));
      const reporter = this.tokens.get(client.sessionId), reported = target && this.tokens.get(target.sessionId);
      if (!reporter || !reported || reporter === reported) return client.send('commsReportResult', { ok: false });
      const now = Date.now(), duplicate = this.moderationReports.some(r => r.reporter === reporter && r.reported === reported && now - r.at < COMMS_RULES.reportCooldownMs);
      if (duplicate) return client.send('commsReportResult', { ok: false, reason: 'rate' });
      const history = this.recentApprovedComms.filter(entry => entry.from === reported && now - entry.at < COMMS_RULES.reportHistoryMs).slice(-12).map(entry => ({ at: entry.at, phrase: entry.phrase, mode: entry.mode }));
      const record = { id: 'report_' + now.toString(36) + '_' + this.moderationReports.length, at: now, reporter, reported, reportedName: this.state.players.get(target.sessionId)?.name || 'Hunter', history };
      this.moderationReports.push(record); if (this.moderationReports.length > 500) this.moderationReports.shift();
      console.warn('[moderation]', JSON.stringify(record));
      Promise.resolve(this.store.saveModerationReport(record)).catch(error => console.warn('[moderation] report persistence failed:', error.message));
      client.send('commsReportResult', { ok: true, id: record.id });
    });

    this.onMessage('enterGate', (client, m) => this.enterGate(client, m));
    this.onMessage('dungeonLobbyReady', (client, m) => this.handleDungeonLobbyReady(client, m));
    this.onMessage('dungeonLobbyLeave', (client) => this.leaveDungeonLobby(client.sessionId, true));
    this.onMessage('dungeonMatchmakingAdvertise', (client, m) => this.handleDungeonMatchmakingAdvertise(client, m));
    this.onMessage('dungeonMatchmakingRequest', client => this.sendDungeonMatchmaking(client));
    this.onMessage('dungeonMatchmakingJoin', (client, m) => this.handleDungeonMatchmakingJoin(client, m));
    this.onMessage('dungeonPing', (client, m) => this.handleDungeonPing(client, m));
    this.onMessage('exitGate', (client) => this.leaveInstance(client.sessionId));
    this.onMessage('useGateKey', (client, m) => this.handleUseGateKey(client, m));
    this.onMessage('attuneShard', (client, m) => this.handleAttuneShard(client, m));
    this.onMessage('craft', (client, m) => this.handleCraft(client, m));
    this.onMessage('shop', (client, m) => this.handleShop(client, m));
    this.onMessage('farm', (client, m) => this.handleFarm(client, m));
    this.onMessage('prospect', client => this.handleProspect(client));
    this.onMessage('eventJoin', (client) => this.handleEventJoin(client));
    this.onMessage('eventLeave', (client) => this.handleEventLeave(client));
    this.onMessage('eventReady', (client) => this.handleEventReady(client));
    this.onMessage('eventDebugStart', (client) => this.handleEventDebugStart(client));
    this.onMessage('chestOpen', (client, m) => this.handleChestOpen(client, m));
    this.onMessage('chestDeposit', (client, m) => this.handleChestDeposit(client, m));
    this.onMessage('chestWithdraw', (client, m) => this.handleChestWithdraw(client, m));
    this.onMessage('discoveryInteract', (client, m) => this.handleDiscoveryInteract(client, m));
    this.onMessage('discoverySight', (client, m) => this.handleDiscoverySight(client, m));
    this.onMessage('regionalContracts', (client) => this.sendRegionalContracts(client));
    this.onMessage('regionalContractAccept', (client, m) => this.handleRegionalContractAccept(client, m));
    this.onMessage('caravanContractAccept', (client, m) => this.handleCaravanContractAccept(client, m));
    this.onMessage('regionalContractAbandon', (client) => this.handleRegionalContractAbandon(client));
    this.onMessage('regionalContractClaim', (client) => this.handleRegionalContractClaim(client));
    this.onMessage('regionalContractVisit', (client, m) => this.handleRegionalContractVisit(client, m));
    this.onMessage('furnaceOpen', (client, m) => this.handleFurnaceOpen(client, m));
    this.onMessage('furnaceSmelt', (client, m) => this.handleFurnaceSmelt(client, m));
    this.onMessage('furnaceTake', (client, m) => this.handleFurnaceTake(client, m));

    this.onMessage('chat', (client, m) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !m || typeof m.text !== 'string') return;
      const text = m.text.replace(/[<>]/g, '').trim().slice(0, 140);
      if (!text) return;
      if (text.startsWith('/give')) return this.handleDevGive(client, text);
      if (text.startsWith('/event')) return this.handleDevEvent(client, text);
      client.send('commsReject', { reason: 'custom' });
    });

    this.tickMetrics = { lastMs: 0, avgMs: 0, maxMs: 0, samples: 0 };
    this.setSimulationInterval(dtMs => {
      const t0 = performance.now();
      this.update(dtMs / 1000);
      this.recordTick(performance.now() - t0);
    }, 100); // 10 Hz
    } catch (e) {
      releaseGlobalWorld(this);
      throw e;
    }
  }

  async onJoin(client, options, auth) {
    const token = cleanToken(auth && auth.id);
    if (!token) throw new Error('authenticated account required');
    if (token) this.tokens.set(client.sessionId, token);
    let prof = null;
    if (token) {
      // A DungeonRoom (Phase 2c) may have just saved fresher progress for this
      // token than our own in-memory cache — which we otherwise trust forever
      // once populated (see flushDirtyPlayers/finalizeLeave). Prefer that
      // handoff over our stale copy; takeHandoff() is a no-op for every token
      // that never went through a DungeonRoom.
      const handedOff = takeHandoff(token);
      if (handedOff) prof = handedOff;
      else prof = this.profiles.get(token);
      let loadFailed = false;
      if (!prof) {
        try { prof = sanitizeProfile(await this.store.loadPlayer(token)); }
        catch (e) {
          // Couldn't read an existing save (corrupt file or I/O error). Do NOT overwrite it:
          // hand out a playable default flagged non-persistable so flush() never clobbers the file.
          console.warn('[persist] load failed for ' + token + ' — using a non-persistable default to protect the saved profile:', e.message);
          loadFailed = true;
        }
      }
      if (loadFailed) {
        prof = defaultProfile(options && options.name || auth.displayName);
        prof.noPersist = true;
        this.profiles.set(token, prof);
      } else if (prof) {
        this.profiles.set(token, prof);
      } else {
        prof = defaultProfile(options && options.name || auth.displayName);
        this.profiles.set(token, prof);
        this.dirtyPlayers.add(token);
      }
      const grantedArmor = this.ensureStarterArmor(prof);
      const grantedLegend = this.ensureStarterLegendaryWeapon(prof);
      const grantedFarm = BETA_FARM_TEST && this.ensureFarmTestKit(prof);
      if (!prof.noPersist && (grantedArmor || grantedLegend || grantedFarm)) this.dirtyPlayers.add(token);
      if (this.moveCompletedTutorialProfileToTown(prof)) this.dirtyPlayers.add(token);
      if (Array.isArray(prof.pos) && prof.pos[0] < 160 && prof.pos[2] < 160) {
        prof.pos = [W.TOWN.TC + .5, W.TOWN.G + 1, W.TOWN.TC + 7.5];
        this.dirtyPlayers.add(token);
      }
      client._mutedComms = new Set(prof.mutedPlayers || []);
      if (Array.isArray(prof.pos)) {
        const bx = Math.floor(prof.pos[0]), by = Math.floor(prof.pos[1]), bz = Math.floor(prof.pos[2]);
        const feetBlocked = W.isSolid(this.world.getB(bx, by, bz));
        const headBlocked = W.isSolid(this.world.getB(bx, by + 1, bz));
        if (feetBlocked || headBlocked) {
          prof.pos = [W.TOWN.TC + .5, W.TOWN.G + 1, W.TOWN.TC + 7.5];
          this.dirtyPlayers.add(token);
        }
      }
    }
    const restartRecovery = prof ? await this.recoverDungeonAfterRestart(token, prof) : null;
    const p = new Player();
    p.name = cleanName(options && typeof options.name === 'string' ? options.name : (prof ? prof.name : auth.displayName));
    if (prof) {
      p.lvl = prof.S.lvl;
      p.path = prof.S.path;
      p.job = JOB_IDS.has(prof.job) ? prof.job : '';
      p.jobLvl = p.job ? jobLevelFromXp((prof.jobXpByJob && prof.jobXpByJob[p.job]) || prof.jobXp) : 0;
      p.armorId = prof.armor && ARMOR_INFO[prof.armor.id] ? prof.armor.id : 0;
      p.armorType = p.armorId ? GEAR_SYSTEM.armorProfile(ARMOR_INFO[p.armorId], prof.armor).type.id : '';
      p.dragons = Array.isArray(prof.mountUnlocks)
        ? prof.mountUnlocks.filter(isDragonMount).map(dragonMountType).filter(t => DRAGON_TYPE_SET.has(t)).join(',')
        : '';
      p.dragonNames = this.publicDragonNames(prof);
      p.x = prof.pos[0]; p.y = prof.pos[1] + .01; p.z = prof.pos[2];
    } else {
      p.x = W.TOWN.TC + .5 + (Math.random() * 4 - 2);
      p.y = W.TOWN.G + 1;
      p.z = W.TOWN.TC + 7.5 + (Math.random() * 2 - 1);
    }
    this.state.players.set(client.sessionId, p);
    if (prof && prof.skyshipTransit) {
      const tr = prof.skyshipTransit, now = Date.now();
      if (tr.arriveAt > now && tr.departAt <= now) {
        this.skyshipPassengers.set(client.sessionId, { ...tr, token });
        this.placeSkyshipPassenger(client.sessionId, now);
      } else if (tr.departAt > now && skyshipSnapshot(this.skyshipEpoch, now).state === 'docked') {
        this.skyshipPassengers.set(client.sessionId, { ...tr, token });
        this.placeSkyshipPassenger(client.sessionId, now);
      } else {
        const ax = W.LAVA_BORDER_WIDTH + 32, az = W.TOWN.TC;
        p.x = ax; p.y = W.terrainHeight(ax, az) + 1.05; p.z = az;
        prof.pos = [p.x, p.y, p.z]; prof.skyshipTransit = null; this.dirtyPlayers.add(token);
        client._skyshipRecovered = true;
      }
    }
    if (prof && prof.activeNpcQuest && prof.activeNpcQuest.type === 'gate' && prof.activeNpcQuest.gateRank >= 0) {
      this.ensurePublicGateRank(prof.activeNpcQuest.gateRank);
    }
    if (token) {
      for (const rec of this.teamRecords.values()) {
        if (rec.members.has(token)) { this.attachTeamSession(client.sessionId, rec); break; }
      }
    }
    this.ensurePlayerHp(client);
    const hunger = this.ensurePlayerHunger(client);
    client.send('hunger', { hunger: Math.ceil(hunger.hunger), maxHunger: hunger.max });
    if (prof) client.send('profile', prof);
    if (restartRecovery) {
      this.restartRecoveries.set(token, restartRecovery);
      client.send('dungeonRestartRecovery', restartRecovery);
    }
    this.sendLandClaims(client);
    this.sendDragonIncubations(client);
    this.sendNestDragons(client);
    this.sendEventStatus(client);
    this.sendSkyshipSync(client);
    if (this.skyshipPassengers.has(client.sessionId)) client.send('skyshipBoardResult', { ok: true, recovered: true, ...this.skyshipPassengerPayload(client.sessionId), gold: prof.gold | 0 });
    else if (client._skyshipRecovered) client.send('skyshipArrived', { route: 'western', recovered: true, x: p.x, y: p.y, z: p.z });
    this.sendDayCycleSync(client);
    this.sendWeather(client);
    this.sendGuildHallSync(client);
    this.broadcast('chat', { name: '[System]', text: p.name + (prof ? ' has returned' : ' has entered the world') });
  }


  async onLeave(client, consented) {
    // A process shutdown is not a voluntary dungeon exit. Keep the live
    // attempt marker intact so onDispose can flush it for next-boot recovery.
    if (matchMaker && matchMaker.isGracefullyShuttingDown) return;
    if (consented === false) {
      try {
        await this.allowReconnection(client, 15);
        const token = this.tokens.get(client.sessionId);
        const profile = token && this.profiles.get(token);
        if (profile) client.send('profile', profile);
        const hunger = this.playerHunger.get(client.sessionId);
        if (hunger) client.send('hunger', { hunger: Math.ceil(hunger.hunger), maxHunger: hunger.max });
        if (!this.resumeTutorialDimension(client) && !this.resumeEventParticipant(client)) this.resumeDungeonInstance(client);
        return;
      } catch (_) {
        // The reconnect window elapsed; perform the normal durable cleanup.
      }
    }
    this.finalizeLeave(client);
  }

  finalizeLeave(client) {
    if (this.sleepingPlayers) this.sleepingPlayers.delete(client.sessionId);
    if (this.tutorialReturns) this.tutorialReturns.delete(client.sessionId);
    this.detachTeamSession(client.sessionId);
    const p = this.state.players.get(client.sessionId);
    const wasInDungeon = !!(p && p.dgn);
    this.leaveDungeonLobby(client.sessionId, false);
    this.leaveInstance(client.sessionId);
    const token = this.tokens.get(client.sessionId);
    if (token) {
      const prof = this.profiles.get(token);
      if (prof) {
        if (p && !wasInDungeon) prof.pos = [p.x, p.y, p.z];
        this.dirtyPlayers.add(token);
      }
      this.tokens.delete(client.sessionId);
    }
    this.lastSaveMsg.delete(client.sessionId);
    this.lastMoveMsg.delete(client.sessionId);
    this.lastAttackMsg.delete(client.sessionId);
    this.rateBuckets.delete(client.sessionId);
    if (this.playerLastHit) {
      this.playerLastHit.delete(client.sessionId);
      for (const [sid, hit] of [...this.playerLastHit.entries()]) {
        if (hit && hit.attackerSid === client.sessionId) this.playerLastHit.delete(sid);
      }
    }
    if (this.aegisBounties) {
      this.aegisBounties.delete(client.sessionId);
      for (const [sid, b] of [...this.aegisBounties.entries()]) {
        if (b && b.targetSid === client.sessionId) {
          this.aegisBounties.delete(sid);
          const hunter = this.clients.find(c => c.sessionId === sid);
          if (hunter) hunter.send('pvpBountyFail', { reason: 'offline' });
        }
      }
    }
    this.playerHp.delete(client.sessionId);
    this.playerHunger.delete(client.sessionId);
    this.biomeStatuses.delete(client.sessionId);
    this.abilityState.delete(client.sessionId);
    this.abilityBuffs.delete(client.sessionId);
    if (this.weaponMomentum) this.weaponMomentum.delete(client.sessionId);
    if (this.moveRejects) this.moveRejects.delete(client.sessionId);
    if (this.monkAuraAt) this.monkAuraAt.delete(client.sessionId);
    if (this.prospectAt) this.prospectAt.delete(client.sessionId);
    if (this.serverEvent) {
      if (this.serverEvent.queue) this.serverEvent.queue.delete(client.sessionId);
      if (this.serverEvent.kind === EVENT_KING.kind && this.serverEvent.crown && this.serverEvent.crown.holderSid === client.sessionId && p) {
        this.clearKingCrown(this.serverEvent, p.x, p.y + 1.2, p.z);
      }
      if (this.serverEvent.participants) this.serverEvent.participants.delete(client.sessionId);
      if (this.serverEvent.completed) this.serverEvent.completed.delete(client.sessionId);
    }
    if (this.eventInstances) {
      this.eventInstances.forEach(inst => {
        if (inst.queue) inst.queue.delete(client.sessionId);
        if (inst.kind === EVENT_KING.kind && inst.crown && inst.crown.holderSid === client.sessionId && p) {
          this.clearKingCrown(inst, p.x, p.y + 1.2, p.z);
        }
        if (inst.participants) inst.participants.delete(client.sessionId);
        if (inst.completed) inst.completed.delete(client.sessionId);
      });
    }
    this.blackholeCd.delete(client.sessionId);
    if (this.dragonBreathCd) this.dragonBreathCd.delete(client.sessionId);
    if (this.dragonAbilityCd) for (const key of [...this.dragonAbilityCd.keys()]) if (key.startsWith(client.sessionId + ':')) this.dragonAbilityCd.delete(key);
    if (this.legendaryCd) for (const key of [...this.legendaryCd.keys()]) if (key.startsWith(client.sessionId + ':')) this.legendaryCd.delete(key);
    if (this.phoenixUsed) this.phoenixUsed.delete(client.sessionId);
    this.bossContrib.forEach(byPlayer => byPlayer.delete(client.sessionId));
    this.pvel.delete(client.sessionId);
    if (p) this.broadcast('chat', { name: '[System]', text: p.name + ' has left' });
    this.state.players.delete(client.sessionId);
    this.flush();   // persist the departing player's final state now (README: flush on each departure)
  }

  // Persistence bookkeeping. Persistence has no mixin (flush() and the onCreate
  // loaders live here in GameRoom), so this stays in this file, but grouping the
  // dirty flags and save-timing maps here names the cluster and keeps onCreate lean.
  // The dirty* flags must be cleared before the onCreate restore loaders run, since
  // restoreSavedGates and friends may set them.
  initPersistenceState() {
    this.profiles = new Map();
    this.tokens = new Map();
    this.dirtyWorld = false;
    this.dirtyWorldProgress = false;
    this.dirtyLandClaims = false;
    this.dirtyChests = false;
    this.dirtyFurnaces = false;
    this.dirtyIncubations = false;
    this.dirtyGates = false;
    this.dirtyTeams = false;
    this.dirtyGuilds = false;
    this.dirtyNests = false;
    this.dirtyPlayers = new Set();
    this.lastSaveMsg = new Map();
  }

  async flush() {
    this.completeFurnaces();
    if (this.dirtyWorld) {
      this.dirtyWorld = false;
      const obj = {};
      this.state.edits.forEach((v, k) => {
        if (this.eventTransientEditKeys && this.eventTransientEditKeys.has(k)) return;
        const [x, , z] = k.split(',').map(Number);
        obj[k] = v;
      });
      try { await this.store.saveWorldEdits(obj); }
      catch (e) { console.warn('[persist] world save failed:', e.message); this.dirtyWorld = true; }
    }
    if (this.dirtyWorldProgress) {
      this.dirtyWorldProgress = false;
      try { await this.store.saveWorldProgress(this.worldProgress); }
      catch (e) { console.warn('[persist] world progress save failed:', e.message); this.dirtyWorldProgress = true; }
    }
    if (this.dirtyLandClaims) {
      this.dirtyLandClaims = false;
      const obj = {};
      this.landClaims.forEach((v, k) => { obj[k] = v; });
      try { await this.store.saveLandClaims(obj); }
      catch (e) { console.warn('[persist] land claim save failed:', e.message); this.dirtyLandClaims = true; }
    }
    if (this.dirtyChests) {
      this.dirtyChests = false;
      const obj = {};
      this.chests.forEach((v, k) => { if (k.startsWith('overworld:')) obj[k] = v; });
      try { await this.store.saveChests(obj); }
      catch (e) { console.warn('[persist] chest save failed:', e.message); this.dirtyChests = true; }
    }
    if (this.dirtyFurnaces) {
      this.dirtyFurnaces = false;
      const obj = {};
      this.furnaces.forEach((v, k) => { obj[k] = v; });
      try { await this.store.saveFurnaces(obj); }
      catch (e) { console.warn('[persist] furnace save failed:', e.message); this.dirtyFurnaces = true; }
    }
    if (this.dirtyIncubations) {
      this.dirtyIncubations = false;
      const obj = {};
      this.dragonIncubations.forEach((v, k) => { obj[k] = v; });
      try { await this.store.saveIncubations(obj); }
      catch (e) { console.warn('[persist] incubation save failed:', e.message); this.dirtyIncubations = true; }
    }
    if (this.dirtyNests) {
      this.dirtyNests = false;
      const obj = {};
      this.nestDragons.forEach((v, k) => { obj[k] = v; });
      try { await this.store.saveNestDragons(obj); }
      catch (e) { console.warn('[persist] nest save failed:', e.message); this.dirtyNests = true; }
    }
    if (this.dirtyGates) {
      this.dirtyGates = false;
      const obj = {};
      const now = Date.now();
      this.state.gates.forEach((g, id) => {
        const expiresAt = this.gateTtls.get(id) || 0;
        if (!g.active || expiresAt <= now) return;
        obj[id] = {
          id,
          kind: g.kind,
          rank: g.rank,
          seed: g.seed,
          owner: g.owner,
          team: g.team,
          shardPlus: g.shardPlus,
          shardName: g.shardName,
          shardMods: g.shardMods,
          refundItem: g.refundItem,
          refundOwner: g.refundOwner,
          x: g.x,
          y: g.y,
          z: g.z,
          expiresAt,
          lootedChests: [...(this.gateLootedChests.get(id) || [])],
        };
      });
      try { await this.store.saveGates(obj); }
      catch (e) { console.warn('[persist] gate save failed:', e.message); this.dirtyGates = true; }
    }
    if (this.dirtyTeams) {
      this.dirtyTeams = false;
      const obj = {};
      this.teamRecords.forEach((v, k) => {
        obj[k] = {
          id: v.id, name: v.name, leader: v.leader, members: [...v.members],
          highestGateRankCleared: v.highestGateRankCleared,
          private: !!v.private,
          lfg: !!v.lfg,
          invites: [...(v.invites || [])],
        };
      });
      try { await this.store.saveTeams(obj); }
      catch (e) { console.warn('[persist] team save failed:', e.message); this.dirtyTeams = true; }
    }
    if (this.dirtyGuilds) {
      this.dirtyGuilds = false;
      const obj = {};
      this.guilds.forEach((g, id) => {
        obj[id] = {
          ...g,
          members: [...g.members],
          invites: [...(g.invites || [])],
          roles: Object.fromEntries(g.roles || []),
        };
      });
      try { await this.store.saveGuilds(obj); }
      catch (e) { console.warn('[persist] guild save failed:', e.message); this.dirtyGuilds = true; }
    }
    await this.flushDirtyPlayers();
  }

  // Split out of flush() so DungeonRoom (which has no world/chests/furnaces/
  // gates/teams/guilds to persist) can reuse just the player-save loop
  // without inheriting flush()'s other, overworld-only side effects.
  async flushDirtyPlayers() {
    if (!this.dirtyPlayers.size) return;
    const toks = [...this.dirtyPlayers];
    this.dirtyPlayers.clear();
    for (const t of toks) {
      const prof = this.profiles.get(t);
      if (!prof || prof.noPersist) continue;   // never overwrite a save we couldn't load
      try { await this.store.savePlayer(t, prof); }
      catch (e) { console.warn('[persist] player save failed:', e.message); this.dirtyPlayers.add(t); }
    }
  }

  async onDispose() {
    try { await this.flush(); }
    finally { releaseGlobalWorld(this); }
  }

  handleClaimFirstQuestReward(client) {
    const rec = this.profileFor(client);
    if (!rec) return false;
    const prof = rec.prof;
    if (prof.firstQuestRewardClaimed) {
      client.send('firstQuestReward', { ok: false, claimed: true, totalGold: prof.gold | 0 });
      return false;
    }
    const maraStep = prof.npcQuestChains && (prof.npcQuestChains['Mara Vale'] | 0);
    if (maraStep < 1) {
      client.send('firstQuestReward', { ok: false, claimed: false, reason: 'quest', totalGold: prof.gold | 0 });
      return false;
    }
    prof.firstQuestRewardClaimed = true;
    prof.gold = Math.max(0, (prof.gold | 0) + 100);
    this.dirtyPlayers.add(rec.token);
    client.send('firstQuestReward', { ok: true, gold: 100, totalGold: prof.gold | 0 });
    return true;
  }

  handleTutorialComplete(client, m) {
    const rec = this.profileFor(client);
    const tutorial = m && typeof m.tutorial === 'string' ? m.tutorial : '';
    const expected = TUTORIAL_VERSIONS[tutorial] | 0;
    const version = m && (m.version | 0);
    if (!rec || !expected || version !== expected) {
      client.send('tutorialProgress', { ok: false, tutorial, reason: 'invalid' });
      return false;
    }
    if (!rec.prof.tutorials || typeof rec.prof.tutorials !== 'object') {
      rec.prof.tutorials = Object.fromEntries(Object.keys(TUTORIAL_VERSIONS).map(key => [key, 0]));
    }
    rec.prof.tutorials[tutorial] = Math.max(rec.prof.tutorials[tutorial] | 0, expected);
    if (tutorial === 'onboarding') {
      const spawn = [W.TOWN.TC + .5, W.TOWN.G + 1, W.TOWN.TC + 7.5];
      rec.prof.pos = spawn;
      this.leaveTutorialDimension(client, spawn);
      const p = this.state.players.get(client.sessionId);
      if (p) {
        p.dim = 'overworld'; p.dgn = '';
        p.x = spawn[0]; p.y = spawn[1]; p.z = spawn[2];
      }
    } else if (tutorial === 'ability') {
      this.leaveTutorialDimension(client);
    }
    this.dirtyPlayers.add(rec.token);
    client.send('tutorialProgress', {
      ok: true,
      tutorial,
      version: expected,
      tutorials: { ...rec.prof.tutorials },
    });
    return true;
  }

  moveCompletedTutorialProfileToTown(prof) {
    if (!prof || !prof.tutorials || (prof.tutorials.onboarding | 0) < TUTORIAL_VERSIONS.onboarding) return false;
    if (!Array.isArray(prof.pos) || !W.isTrainingMeadowLand(prof.pos[0], prof.pos[2], 4)) return false;
    prof.pos = [W.TOWN.TC + .5, W.TOWN.G + 1, W.TOWN.TC + 7.5];
    return true;
  }

  tutorialSpaceId(client, kind) {
    return 'tutorial-' + kind + '-' + String(client && client.sessionId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48);
  }

  handleTutorialEnter(client, m) {
    const p = client && this.state.players.get(client.sessionId);
    const rec = client && this.profileFor(client);
    const kind = m && String(m.kind || '');
    if (!p || !rec || !['onboarding', 'ability'].includes(kind)) return false;
    if (p.dgn && p.dim !== 'tutorial') {
      client.send('tutorialDimension', { active: false, kind, reason: 'busy' });
      return false;
    }
    if (!this.tutorialReturns) this.tutorialReturns = new Map();
    if (!this.tutorialReturns.has(client.sessionId)) {
      this.tutorialReturns.set(client.sessionId, { x: p.x, y: p.y, z: p.z, yaw: p.yaw });
    }
    const spaceId = this.tutorialSpaceId(client, kind);
    const spawn = kind === 'ability'
      ? { x: 805, y: 20, z: 847 }
      : { x: W.TRAINING_MEADOW.x - 32, y: W.TRAINING_MEADOW.G + 2, z: W.TRAINING_MEADOW.z + 24 };
    p.dim = 'tutorial';
    p.dgn = spaceId;
    p.mount = '';
    p.x = spawn.x; p.y = spawn.y; p.z = spawn.z;
    client.send('tutorialDimension', { active: true, kind, spaceId, ...spawn });
    return true;
  }

  leaveTutorialDimension(client, forcedPos = null) {
    const p = client && this.state.players.get(client.sessionId);
    if (!p || p.dim !== 'tutorial') return false;
    const ret = this.tutorialReturns && this.tutorialReturns.get(client.sessionId);
    const pos = forcedPos
      ? { x: forcedPos[0], y: forcedPos[1], z: forcedPos[2] }
      : (ret || { x: W.TOWN.TC + .5, y: W.TOWN.G + 1, z: W.TOWN.TC + 7.5 });
    p.dim = 'overworld';
    p.dgn = '';
    p.x = pos.x; p.y = pos.y; p.z = pos.z;
    if (ret && Number.isFinite(ret.yaw)) p.yaw = ret.yaw;
    if (this.tutorialReturns) this.tutorialReturns.delete(client.sessionId);
    client.send('tutorialDimension', { active: false, x: p.x, y: p.y, z: p.z });
    return true;
  }

  handleTutorialExit(client) {
    return this.leaveTutorialDimension(client);
  }

  resumeTutorialDimension(client) {
    const p = client && this.state.players.get(client.sessionId);
    if (!p || p.dim !== 'tutorial' || !p.dgn) return false;
    const kind = p.dgn.includes('-ability-') ? 'ability' : 'onboarding';
    client.send('tutorialDimension', { active: true, kind, spaceId: p.dgn, x: p.x, y: p.y, z: p.z });
    return true;
  }

  handleAckFirstPromotion(client) {
    const rec = this.profileFor(client);
    if (!rec || !rec.prof.progressionFocus) return false;
    rec.prof.firstPromotionSeen = true;
    this.dirtyPlayers.add(rec.token);
    client.send('firstPromotionAck', { ok: true, progressionFocus: rec.prof.progressionFocus });
    return true;
  }

  handleE2EJourney(client, m) {
    if (process.env.BLOCKCRAFT_E2E !== '1') return false;
    const rec = this.profileFor(client);
    const action = m && String(m.action || '');
    if (!rec) return false;
    if (action === 'positionAck') {
      const p = this.state.players.get(client.sessionId);
      client.send('e2eJourneyResult', {
        action,
        requestId: String(m && m.requestId || '').slice(0, 32),
        ok: !!p,
        x: p ? p.x : 0,
        y: p ? p.y : 0,
        z: p ? p.z : 0,
      });
      return !!p;
    }
    if (action === 'preparePrivateGateRestart') {
      rec.prof.S.lvl = Math.max(3, rec.prof.S.lvl | 0);
      rec.prof.S.path = rec.prof.S.path || 'shadow';
      this.awardGrant(client, {
        source: 'e2e-private-gate',
        items: [
          { id: I.SOLO_KEY_E, count: 1 },
          { id: I.SHARD_MINOR, count: 1 },
        ],
      });
      return this.progressionChanged(client, 'e2eJourney', { action });
    }
    if (action === 'prepareTeamGateRestart') {
      rec.prof.S.lvl = Math.max(3, rec.prof.S.lvl | 0);
      rec.prof.S.path = rec.prof.S.path || 'shadow';
      this.awardGrant(client, {
        source: 'e2e-team-gate',
        items: [{ id: I.TEAM_KEY_E, count: 1 }],
      });
      return this.progressionChanged(client, 'e2eJourney', { action });
    }
    if (action === 'prepareFirstGateFailure') {
      rec.prof.S.lvl = Math.max(3, rec.prof.S.lvl | 0);
      rec.prof.S.path = rec.prof.S.path || 'shadow';
      rec.prof.npcQuestChains['Mara Vale'] = 2;
      rec.prof.activeNpcQuest = this.buildNpcQuest(rec.prof, 'Mara Vale', 'guide');
      if (!rec.prof.activeNpcQuest || !this.ensurePublicGateRank(0)) return false;
      return this.progressionChanged(client, 'e2eJourney', { action });
    }
    if (action === 'prepareReturningHunter') {
      rec.prof.S.lvl = Math.max(3, rec.prof.S.lvl | 0);
      rec.prof.S.path = rec.prof.S.path || 'shadow';
      return this.progressionChanged(client, 'e2eJourney', { action });
    }
    if (action === 'prepareTownTutorialPersistence') {
      rec.prof.S.lvl = Math.max(2, rec.prof.S.lvl | 0);
      rec.prof.S.path = rec.prof.S.path || 'shadow';
      rec.prof.firstQuestRewardClaimed = true;
      rec.prof.npcQuestChains['Mara Vale'] = Math.max(1, rec.prof.npcQuestChains['Mara Vale'] | 0);
      rec.prof.gold = Math.max(250, rec.prof.gold | 0);
      return this.progressionChanged(client, 'e2eJourney', { action });
    }
    if (action === 'completeMaraFieldWork') {
      const c = rec.prof.jobContract;
      if (!c || c.job !== 'adventurer' || c.title !== "Mara's Field Work" || c.type !== 'kill') return false;
      while ((c.have | 0) < (c.need | 0)) this.recordKillProgress(client);
      return true;
    }
    if (action === 'failDRankGate') {
      const requestId = m && String(m.requestId || '').slice(0, 32);
      const p = this.state.players.get(client.sessionId);
      const inst = p && p.dgn && this.instances[p.dgn];
      const ok = !!(p && inst && !inst.cleared && (inst.rank | 0) === 1);
      if (ok) this.hurtPlayer(client, 999999, 'e2e-d-gate-failure');
      client.send('e2eJourneyResult', { action, requestId, ok });
      return ok;
    }
    if (action === 'defeatDRankBoss') {
      const requestId = m && String(m.requestId || '').slice(0, 32);
      const p = this.state.players.get(client.sessionId);
      const inst = p && p.dgn && this.instances[p.dgn];
      if (!p || !inst || inst.cleared || (inst.rank | 0) !== 1) {
        client.send('e2eJourneyResult', { action, requestId, ok: false });
        return false;
      }
      let bossId = '', boss = null;
      this.state.mobs.forEach((mob, id) => {
        if (!boss && mob && mob.dgn === inst.id && mob.kind === 'boss') { bossId = String(id); boss = mob; }
      });
      if (!boss) {
        client.send('e2eJourneyResult', { action, requestId, ok: false });
        return false;
      }
      p.x = inst.bossRoom.x;
      p.z = inst.bossRoom.z;
      this.recordBossContribution(client, inst.id, Math.max(1, boss.maxHp | 0));
      this.finishMobKill(client, bossId, boss);
      client.send('e2eJourneyResult', { action, requestId, ok: true });
      return true;
    }
    const q = rec.prof.activeNpcQuest;
    if (!rec || !q || q.giver !== 'Mara Vale') return false;
    if (action === 'prepareFirstQuest' && q.type === 'fetch' && (q.item | 0) === W.B.LOG) {
      const missing = Math.max(0, (q.need | 0) - this.countItem(rec.prof, W.B.LOG));
      if (missing) this.addRewardItem(rec.prof, W.B.LOG, missing);
      return this.progressionChanged(client, 'e2eJourney', { action });
    }
    if (action === 'completeRoadReady' && q.type === 'kill') {
      while ((q.have | 0) < (q.need | 0)) this.recordKillProgress(client);
      return true;
    }
    if (action === 'failFirstGate' && q.type === 'gate' && (q.gateRank | 0) === 0) {
      const requestId = m && String(m.requestId || '').slice(0, 32);
      const p = this.state.players.get(client.sessionId);
      const inst = p && p.dgn && this.instances[p.dgn];
      const ok = !!(p && inst && !inst.cleared && (inst.rank | 0) === 0);
      if (ok) this.hurtPlayer(client, 999999, 'e2e-gate-failure');
      client.send('e2eJourneyResult', { action, requestId, ok });
      return ok;
    }
    if (action === 'defeatFirstGateBoss' && q.type === 'gate' && (q.gateRank | 0) === 0) {
      const requestId = m && String(m.requestId || '').slice(0, 32);
      const p = this.state.players.get(client.sessionId);
      const inst = p && p.dgn && this.instances[p.dgn];
      if (!p || !inst || inst.cleared || (inst.rank | 0) !== 0) {
        client.send('e2eJourneyResult', { action, requestId, ok: false });
        return false;
      }
      let bossId = '', boss = null;
      this.state.mobs.forEach((mob, id) => {
        if (!boss && mob && mob.dgn === inst.id && mob.kind === 'boss') {
          bossId = String(id);
          boss = mob;
        }
      });
      if (!boss) {
        client.send('e2eJourneyResult', { action, requestId, ok: false });
        return false;
      }
      p.x = inst.bossRoom.x;
      p.z = inst.bossRoom.z;
      this.recordBossContribution(client, inst.id, Math.max(1, boss.maxHp | 0));
      this.finishMobKill(client, bossId, boss);
      client.send('e2eJourneyResult', { action, requestId, ok: true });
      return true;
    }
    return false;
  }

  // ---------------- helpers ----------------
  // Per-client token-bucket rate limiter shared by the high-frequency mutating
  // handlers. A bucket holds up to `burst` tokens and refills at `ratePerSec`;
  // each accepted message spends one. This permits short legitimate bursts
  // (rapid building, fast clicking) while capping the sustained rate a scripted
  // client can drive validation/broadcast work at. Returns true when throttled.
  rateLimited(client, bucket, ratePerSec, burst) {
    const sid = client.sessionId;
    let buckets = this.rateBuckets.get(sid);
    if (!buckets) { buckets = new Map(); this.rateBuckets.set(sid, buckets); }
    const now = Date.now();
    let b = buckets.get(bucket);
    if (!b) { b = { tokens: burst, last: now }; buckets.set(bucket, b); }
    b.tokens = Math.min(burst, b.tokens + (now - b.last) / 1000 * ratePerSec);
    b.last = now;
    if (b.tokens < 1) return true;   // throttled — caller should reject/drop
    b.tokens -= 1;
    return false;
  }
  handleWorldEdit(client, m) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !m || p.dgn) return;
    const x = m.x | 0, y = m.y | 0, z = m.z | 0, id = m.id | 0;
    if (!W.inWorld(x, y, z)) return this.rejectEdit(client, x, y, z, this.world.getB(x, y, z));
    if (id < 0 || id > W.MAX_BLOCK_ID || id === W.B.BEDROCK) return this.rejectEdit(client, x, y, z, this.world.getB(x, y, z), id);
    const prev = this.world.getB(x, y, z);
    if (this.rateLimited(client, 'edit', 30, 60)) return this.rejectEdit(client, x, y, z, prev, id);
    if (prev === W.B.BEDROCK || prev === W.B.LAVA || id === W.B.LAVA) return this.rejectEdit(client, x, y, z, prev, id);
    if (Math.hypot(x + .5 - p.x, z + .5 - p.z) > 10) return this.rejectEdit(client, x, y, z, prev, id);
    if (W.isLavaBorderLand(x, z)) return this.rejectEdit(client, x, y, z, prev, id);
    const guildFloorEdit = this.canEditGuildFloor && this.canEditGuildFloor(client, x, y, z, id, prev);
    if (this.isTownProtected(x, z) && !guildFloorEdit) return this.rejectEdit(client, x, y, z, prev, id);
    if (this.isEventProtectedBlock(x, y, z)) return this.rejectEdit(client, x, y, z, prev, id);
    if (id !== W.B.AIR && this.isLandOwnedByOther(client, x, z)) return this.rejectEdit(client, x, y, z, prev, id);
    if (id === W.B.AIR && this.isLandOwnedByOther(client, x, z)) return this.rejectEdit(client, x, y, z, prev, id);
    if (id !== W.B.AIR && prev !== W.B.AIR && prev !== W.B.WATER) return this.rejectEdit(client, x, y, z, prev, id);
    if (prev === W.B.CHEST && id === W.B.AIR && !this.canBreakChest(client, 'overworld:' + x + ',' + y + ',' + z)) {
      return this.rejectEdit(client, x, y, z, prev, id);
    }
    const naturalHarvest = id === W.B.AIR && !this.state.edits.has(x + ',' + y + ',' + z);
    if (id !== W.B.AIR && !this.consumeForPlacement(client, id)) return this.rejectEdit(client, x, y, z, prev, id);
    this.world.setB(x, y, z, id);
    this.state.edits.set(x + ',' + y + ',' + z, id);
    this.dirtyWorld = true;
    if (prev === W.B.EGG_INSULATOR && id !== W.B.EGG_INSULATOR) { this.cancelDragonIncubationAt(x, y, z); this.cancelNestDragonsAt(x, y, z); }
    if (prev === W.B.CHEST && id === W.B.AIR) this.deleteChest('overworld:' + x + ',' + y + ',' + z);
    if (id === W.B.CHEST) this.createPlacedChest(client, 'overworld:' + x + ',' + y + ',' + z, 'personal');
    if (id === W.B.AIR && prev !== W.B.AIR) this.awardMine(client, prev, m.slot, naturalHarvest ? x : undefined, y, naturalHarvest ? z : undefined);
  }
  handleDungeonEdit(client, m) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !m || !p.dgn) return;
    const inst = this.instances[p.dgn]; if (!inst) return;
    const x = m.x | 0, y = m.y | 0, z = m.z | 0, id = m.id | 0;
    if (!inst.inBounds(x, y, z)) return this.rejectEdit(client, x, y, z, W.B.AIR, id);
    if (id < 0 || id > W.MAX_BLOCK_ID || id === W.B.BEDROCK || id === W.B.LAVA) return this.rejectEdit(client, x, y, z, W.B.AIR, id);
    const prev = inst.getB(x, y, z);
    if (this.rateLimited(client, 'edit', 30, 60)) return this.rejectEdit(client, x, y, z, prev, id);
    if (prev === W.B.BEDROCK) return this.rejectEdit(client, x, y, z, prev, id);
    if (Math.hypot(x + .5 - p.x, z + .5 - p.z) > 10) return this.rejectEdit(client, x, y, z, prev, id);
    if (id !== W.B.AIR && prev !== W.B.AIR && prev !== W.B.WATER) return this.rejectEdit(client, x, y, z, prev, id);
    if (prev === W.B.CHEST && id === W.B.AIR && !this.canBreakChest(client, p.dgn + ':' + x + ',' + y + ',' + z)) {
      return this.rejectEdit(client, x, y, z, prev, id);
    }
    if (id !== W.B.AIR && !this.consumeForPlacement(client, id)) return this.rejectEdit(client, x, y, z, prev, id);
    inst.setB(x, y, z, id);
    inst.addEdit(x, y, z, id);
    if (prev === W.B.CHEST && id === W.B.AIR) this.deleteChest(p.dgn + ':' + x + ',' + y + ',' + z);
    if (id === W.B.CHEST) this.createPlacedChest(client, p.dgn + ':' + x + ',' + y + ',' + z, 'dungeon');
    if (id === W.B.AIR && prev !== W.B.AIR) this.awardMine(client, prev, m.slot);
    for (const c of this.clients) {
      if (c.sessionId === client.sessionId) continue;
      const q = this.state.players.get(c.sessionId);
      if (q && q.dgn === p.dgn) c.send('dedit', { x, y, z, id });
    }
  }
  sendSpace(dgn, type, msg) {
    for (const c of this.clients) {
      const q = this.state.players.get(c.sessionId);
      if (q && (q.dgn || '') === (dgn || '')) c.send(type, msg);
    }
  }
  spaceSolid(dgn) {
    if (dgn && typeof this.eventSpaceSolid === 'function') {
      const eventSolid = this.eventSpaceSolid(dgn);
      if (eventSolid) return eventSolid;
    }
    const inst = dgn ? this.instances[dgn] : null;
    return AI.makeSolid(inst ? inst.world : null, this.world);
  }
  serverDamageFor(p, sid) {
    const lvl = Math.max(1, Math.min(999, p.lvl | 0));
    let dmg = Math.min(28, 4 + Math.floor(lvl / 3));
    dmg += this.meleeProfile(p, sid).bonus;     // equipped weapon, validated server-side
    const buffs = this.abilityBuffs.get(sid);
    if (buffs && buffs.umbralUntil > Date.now()) dmg *= 1.6;
    if (buffs && buffs.mealMightUntil > Date.now()) dmg *= JOB_SYSTEM.COOK_RULES.mightMultiplier;
    return dmg;
  }
  // Per-class melee profile from the held weapon: swing cooldown (ms) + damage bonus by
  // tier. Validated against the server inventory (heldId alone is a client-set cosmetic
  // id), so a client can't claim a weapon it doesn't own. Swords are fast and steady;
  // axes swing slower but hit much harder. Anything else: standard speed, no bonus.
  meleeProfile(p, sid) {
    const heldId = p ? (p.heldId | 0) : 0;
    const info = TOOL_INFO[heldId];
    if (info && (info.cls === 'sword' || info.cls === 'axe')) {
      const token = this.tokens.get(sid);
      const prof = token && this.profiles.get(token);
      const heldStacks = prof && Array.isArray(prof.inv) ? prof.inv.filter(s => s && s.id === heldId) : [];
      if (heldStacks.length) {
        const stack=heldStacks.reduce((best,s)=>!best||GEAR_SYSTEM.profile(info,s).powerScore>GEAR_SYSTEM.profile(info,best).powerScore?s:best,null);
        const weapon=GEAR_SYSTEM.weaponCombatProfile(info,stack);
        return {cd:weapon.cooldownMs,bonus:weapon.damage,archetype:weapon.archetype};
      }
    }
    return { cd: 250, bonus: 0, archetype: '' };
  }
  xpNeed(lvl) {
    return xpNeedForLevel(lvl);
  }
  grantHunterXp(prof, amount, client = null, source = 'activity') {
    const S = prof && prof.S;
    const granted = Math.max(0, Math.min(1000000, Math.round(Number(amount) || 0)));
    if (!S || !granted) return { granted: 0, levels: 0 };
    const before = Math.max(1, S.lvl | 0);
    const beforeRank = hunterRankIndexForLevel(before);
    S.xp = Math.max(0, S.xp | 0) + granted;
    while (S.xp >= this.xpNeed(S.lvl)) {
      S.xp -= this.xpNeed(S.lvl);
      S.lvl++;
      S.pts += 3;
    }
    const levels = Math.max(0, (S.lvl | 0) - before);
    const rank = hunterRankIndexForLevel(S.lvl);
    if (client && rank > beforeRank) {
      const gateRank = Math.min(4, rank);
      client.send('rankUp', {
        fromRank: beforeRank,
        rank,
        rankName: 'EDCBAS'[rank] + '-Rank Hunter',
        gateRank,
        gateRankName: 'EDCBA'[gateRank] + '-Rank Gates',
        level: S.lvl | 0,
        levels,
        statPoints: levels * 3,
        nextRankLevel: nextHunterRankLevel(rank),
        source: String(source || 'activity').slice(0, 32),
      });
    }
    return { granted, levels, rankUp: rank > beforeRank, fromRank: beforeRank, rank };
  }
  profileFor(client) {
    const token = this.tokens.get(client.sessionId);
    if (!token) return null;
    let prof = this.profiles.get(token);
    if (!prof) {
      prof = defaultProfile();
      this.profiles.set(token, prof);
    }
    return { token, prof };
  }
  unlockUtility(client, id, reason = '') {
    if (!UTILITY_IDS.has(id)) return false;
    const rec = this.profileFor(client);
    if (!rec) return false;
    if (!Array.isArray(rec.prof.utilityUnlocks)) rec.prof.utilityUnlocks = [];
    if (rec.prof.utilityUnlocks.includes(id)) return false;
    rec.prof.utilityUnlocks.push(id);
    rec.prof.utilityLoadout = sanitizeUtilityLoadout(rec.prof.utilityLoadout, rec.prof.utilityUnlocks);
    const loadout = rec.prof.utilityLoadout;
    const equipped = loadout.active === id || loadout.passive.includes(id);
    if (!equipped && loadout.passive.length < 3) loadout.passive.push(id);
    this.dirtyPlayers.add(rec.token);
    client.send('utilityUnlock', { id, reason, equipped: loadout.active === id || loadout.passive.includes(id) });
    client.send('utilityLoadout', loadout);
    return true;
  }
  handleUtilityLoadout(client, m) {
    const rec = this.profileFor(client);
    if (!rec) return;
    if (!Array.isArray(rec.prof.utilityUnlocks)) rec.prof.utilityUnlocks = [];
    rec.prof.utilityLoadout = sanitizeUtilityLoadout(m, rec.prof.utilityUnlocks);
    this.dirtyPlayers.add(rec.token);
    client.send('utilityLoadout', rec.prof.utilityLoadout);
  }
  ensureStarterArmor(prof) {
    if (!prof || typeof prof !== 'object') return false;
    if (prof.armor && ARMOR_INFO[prof.armor.id]) return false;
    if (!Array.isArray(prof.inv)) prof.inv = [];
    if (prof.inv.some(s => s && ARMOR_INFO[s.id])) return false;
    let slot = prof.inv.findIndex(s => !s);
    if (slot < 0) {
      if (prof.inv.length >= 36) return false;
      slot = prof.inv.length;
    }
    prof.inv[slot] = { id: I.IRON_ARMOR, count: 1, armorType:'vanguard', dur:ARMOR_INFO[I.IRON_ARMOR].dur, source:'starter' };
    return true;
  }
  ensureStarterLegendaryWeapon(prof) {
    return false;
  }
  profileItemCount(prof, id) {
    if (!prof || !Array.isArray(prof.inv)) return 0;
    let total = 0;
    for (const slot of prof.inv) if (slot && slot.id === id && slot.dur == null) total += Math.max(0, slot.count | 0);
    return total;
  }
  ensureProfileTool(prof, id) {
    if (!prof || typeof prof !== 'object') return false;
    if (!Array.isArray(prof.inv)) prof.inv = [];
    if (prof.inv.some(s => s && s.id === id)) return false;
    let slot = prof.inv.findIndex(s => !s);
    if (slot < 0) {
      if (prof.inv.length >= 36) return false;
      slot = prof.inv.length;
    }
    const info = TOOL_INFO[id] || {};
    prof.inv[slot] = { id, count: 1, dur: info.dur || 1 };
    return true;
  }
  ensureProfileStack(prof, id, target) {
    if (!prof || typeof prof !== 'object') return false;
    if (!Array.isArray(prof.inv)) prof.inv = [];
    const need = Math.max(0, (target | 0) - this.profileItemCount(prof, id));
    if (!need) return false;
    this.addRewardItem(prof, id, need);
    return true;
  }
  ensureFarmTestKit(prof) {
    let changed = false;
    changed = this.ensureProfileTool(prof, I.WOOD_HOE) || changed;
    changed = this.ensureProfileTool(prof, I.STONE_HOE) || changed;
    changed = this.ensureProfileTool(prof, I.IRON_HOE) || changed;
    changed = this.ensureProfileTool(prof, I.DIA_HOE) || changed;
    changed = this.ensureProfileStack(prof, I.WHEAT_SEEDS, 64) || changed;
    changed = this.ensureProfileStack(prof, I.WHEAT, 16) || changed;
    changed = this.ensureProfileStack(prof, I.BREAD, 8) || changed;
    return changed;
  }
  ensureProfileItem(prof, id) {
    if (!prof || typeof prof !== 'object') return false;
    if (!Array.isArray(prof.inv)) prof.inv = [];
    if (prof.inv.some(s => s && s.id === id)) return false;
    let slot = prof.inv.findIndex(s => !s);
    if (slot < 0) {
      if (prof.inv.length >= 36) return false;
      slot = prof.inv.length;
    }
    prof.inv[slot] = { id, count: 1 };
    return true;
  }
  highestClearedForClient(client) {
    const rec = this.profileFor(client);
    return rec ? Math.max(-1, Math.min(4, rec.prof.highestGateRankCleared | 0)) : -1;
  }
  maxUnlockedGateRankForProfile(prof) {
    const lvl = prof && prof.S ? Math.max(1, prof.S.lvl | 0) : 1;
    return gateRankIndexForLevel(lvl);
  }
  playerRankGateIndexForProfile(prof) {
    const lvl = prof && prof.S ? Math.max(1, prof.S.lvl | 0) : 1;
    return gateRankIndexForLevel(lvl);
  }
  playerHunterRankIndexForProfile(prof) {
    const lvl = prof && prof.S ? Math.max(1, prof.S.lvl | 0) : 1;
    return hunterRankIndexForLevel(lvl);
  }
  maxUnlockedGateRankForClient(client) {
    const rec = this.profileFor(client);
    return rec ? this.maxUnlockedGateRankForProfile(rec.prof) : 0;
  }
  gateSystemUnlockedForProfile(prof) {
    return !!(prof && prof.S && (prof.S.lvl | 0) >= 3);
  }
  publicGateSpawningUnlocked(surface = []) {
    for (const entry of surface || []) {
      const sid = entry && entry.sid;
      const token = sid && this.tokens.get(sid);
      if (this.gateSystemUnlockedForProfile(token && this.profiles.get(token))) return true;
    }
    return false;
  }
  maxUnlockedGateRankForKey(client, kind) {
    return this.maxUnlockedGateRankForClient(client);
  }
  canAccessGateRank(client, rank) {
    return (rank | 0) <= this.maxUnlockedGateRankForClient(client);
  }
  maxUnlockedPublicRank() {
    let rank = 0;
    this.tokens.forEach(token => {
      rank = Math.max(rank, this.maxUnlockedGateRankForProfile(this.profiles.get(token)));
    });
    return rank;
  }
  keyRank(id) {
    let rank = SOLO_KEYS.indexOf(id);
    if (rank >= 0) return rank;
    rank = TEAM_KEYS.indexOf(id);
    return rank >= 0 ? rank : -1;
  }
  clientToken(client) {
    return this.tokens.get(client.sessionId) || '';
  }
  cleanTeamId(id) {
    return typeof id === 'string' ? id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) : '';
  }
  countGeneratedDungeonChests(wbuf) {
    if (!wbuf || !(wbuf.data instanceof Uint8Array)) return 0;
    const blocks = wbuf.data;
    let count = 0;
    for (let i = 0; i < blocks.length; i++) if (blocks[i] === W.B.CHEST) count++;
    return count;
  }
  isTownProtected(x, z) {
    const dx = Math.abs((x | 0) - W.TOWN.TC);
    const dz = Math.abs((z | 0) - W.TOWN.TC);
    return dx <= W.TOWN.HS + 2 && dz <= W.TOWN.HS + 2;
  }
  landKey(x, z) {
    return (x | 0) + ',' + (z | 0);
  }
  landPrice(x, z) {
    const dx = Math.abs((x | 0) - W.TOWN.TC);
    const dz = Math.abs((z | 0) - W.TOWN.TC);
    const outside = Math.max(0, Math.max(dx, dz) - LAND_FREE_RADIUS);
    const near = Math.max(0, 1 - outside / LAND_PRICE_FADE);
    return LAND_BASE_PRICE + Math.round(LAND_NEAR_TOWN_BONUS * near);
  }
  landClaimFor(x, z) {
    return this.landClaims && this.landClaims.get(this.landKey(x, z));
  }
  canEditLand(client, x, z) {
    if (W.isLavaBorderLand(x | 0, z | 0)) return false;
    if (this.isTownProtected(x, z)) return false;
    const rec = this.landClaimFor(x, z);
    return !!rec && rec.owner === this.clientToken(client);
  }
  isLandOwnedByOther(client, x, z) {
    const rec = this.landClaimFor(x, z);
    return !!rec && rec.owner !== this.clientToken(client);
  }
  landClaimsForClient(client) {
    const token = this.clientToken(client);
    const claims = [];
    if (!this.landClaims) return claims;
    this.landClaims.forEach((rec, key) => {
      const [x, z] = key.split(',').map(Number);
      claims.push({ x, z, name: rec.name || 'Hunter', price: rec.price | 0, own: rec.owner === token });
    });
    return claims;
  }
  sendLandClaims(client) {
    client.send('landClaims', { claims: this.landClaimsForClient(client) });
  }
  broadcastLandClaim(x, z, rec) {
    for (const c of this.clients) {
      const token = this.clientToken(c);
      c.send('landClaimUpdate', { x, z, name: rec.name || 'Hunter', price: rec.price | 0, own: rec.owner === token });
    }
  }
  handleLandClaimBuy(client, m) {
    const p = this.state.players.get(client.sessionId);
    const rec = this.profileFor(client);
    if (!p || !rec || p.dgn) return;
    const x = m && isFinite(+m.x) ? (m.x | 0) : -1;
    const z = m && isFinite(+m.z) ? (m.z | 0) : -1;
    if (this.rateLimited(client, 'action', 5, 10)) return client.send('landClaimReject', { reason: 'rate' });
    if (x < 0 || z < 0 || x >= W.WX || z >= W.WX) return client.send('landClaimReject', { reason: 'bounds' });
    if (W.isLavaBorderLand(x, z)) return client.send('landClaimReject', { reason: 'border', x, z });
    if (this.isTownProtected(x, z)) return client.send('landClaimReject', { reason: 'town', x, z });
    if (Math.hypot(x + .5 - p.x, z + .5 - p.z) > 64) return client.send('landClaimReject', { reason: 'range', x, z });
    const key = this.landKey(x, z);
    if (this.landClaims.has(key)) return client.send('landClaimReject', { reason: 'owned', x, z });
    const price = this.landPrice(x, z);
    if ((rec.prof.gold | 0) < price) return client.send('landClaimReject', { reason: 'gold', x, z, price, gold: rec.prof.gold | 0 });
    rec.prof.gold = Math.max(0, (rec.prof.gold | 0) - price);
    const claim = { owner: rec.token, name: p.name || rec.prof.name || 'Hunter', price, boughtAt: Date.now() };
    this.landClaims.set(key, claim);
    this.dirtyLandClaims = true;
    this.dirtyPlayers.add(rec.token);
    client.send('landClaimResult', { x, z, price, gold: rec.prof.gold | 0 });
    this.broadcastLandClaim(x, z, claim);
  }
  syncPlayerProfile(client, prof) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !prof) return;
    p.lvl = prof.S.lvl;
    p.path = prof.S.path;
    p.job = JOB_IDS.has(prof.job) ? prof.job : '';
    p.jobLvl = p.job ? jobLevelFromXp((prof.jobXpByJob && prof.jobXpByJob[p.job]) || prof.jobXp) : 0;
    p.name = prof.name || p.name;
    p.armorId = prof.armor && ARMOR_INFO[prof.armor.id] ? prof.armor.id : 0;
    p.armorType = p.armorId ? GEAR_SYSTEM.armorProfile(ARMOR_INFO[p.armorId], prof.armor).type.id : '';
    p.dragons = Array.isArray(prof.mountUnlocks)
      ? prof.mountUnlocks.filter(isDragonMount).map(dragonMountType).filter(t => DRAGON_TYPE_SET.has(t)).join(',')
      : '';
    p.dragonNames = this.publicDragonNames(prof);
  }
  publicDragonNames(prof) {
    const out = {};
    const owned = new Set((prof && Array.isArray(prof.mountUnlocks) ? prof.mountUnlocks : [])
      .filter(isDragonMount).map(dragonMountType).filter(t => DRAGON_TYPE_SET.has(t)));
    const names = prof && prof.dragonNames && typeof prof.dragonNames === 'object' ? prof.dragonNames : {};
    for (const type of owned) {
      const name = cleanDragonName(names[type], '');
      if (name) out[type] = name;
    }
    return JSON.stringify(out);
  }
  dragonCareFor(prof, type) {
    if (!prof || !DRAGON_TYPE_SET.has(type)) return null;
    if (!prof.dragonCare || typeof prof.dragonCare !== 'object') prof.dragonCare = {};
    const cur = prof.dragonCare[type] || {};
    const now = Date.now();
    const elapsedHours = cur.fedAt ? Math.max(0, (now - cur.fedAt) / 3600000) : 0;
    const decayed = Math.max(0, Math.round((cur.happiness == null ? 50 : cur.happiness) - elapsedHours * 2));
    const care = { happiness: decayed, fedAt: cur.fedAt || 0 };
    prof.dragonCare[type] = care;
    return care;
  }
  feedDragonCare(prof, type, amount) {
    const care = this.dragonCareFor(prof, type);
    if (!care) return null;
    care.happiness = Math.max(0, Math.min(100, (care.happiness | 0) + (amount | 0)));
    care.fedAt = Date.now();
    return care;
  }
  maxHpForProfile(prof) {
    const vit = prof && prof.S ? Math.max(1, prof.S.vit | 0) : 1;
    return 20 + (vit - 1) * 2;
  }
  maxMpForProfile(prof) {
    const intv = prof && prof.S ? Math.max(1, prof.S.int | 0) : 1;
    return 20 + (intv - 1) * 3;
  }
  ensureAbilityState(client) {
    const rec = this.profileFor(client);
    const maxMp = this.maxMpForProfile(rec && rec.prof);
    let st = this.abilityState.get(client.sessionId);
    if (!st) {
      st = { mp: maxMp, maxMp, cds: {}, last: Date.now() };
      this.abilityState.set(client.sessionId, st);
      return st;
    }
    if (st.maxMp !== maxMp) {
      st.mp = Math.min(maxMp, Math.max(0, st.mp + (maxMp - st.maxMp)));
      st.maxMp = maxMp;
    }
    return st;
  }
  regenAbilityState(client, now = Date.now()) {
    const rec = this.profileFor(client);
    const st = this.ensureAbilityState(client);
    const intv = rec && rec.prof && rec.prof.S ? Math.max(1, rec.prof.S.int | 0) : 1;
    const dt = Math.max(0, Math.min(5, (now - (st.last || now)) / 1000));
    st.last = now;
    st.mp = Math.min(st.maxMp, st.mp + 1.2 * (1 + 0.04 * (intv - 1)) * dt);
    return st;
  }
  sendAbilitySync(client, st) {
    if (!client || !st) return;
    const now = Date.now();
    const cds = {};
    for (const k in st.cds || {}) cds[k] = Math.max(0, Math.ceil(((st.cds[k] || 0) - now) / 1000));
    client.send('abilitySync', { mp: Math.floor(st.mp), maxMp: st.maxMp, cds });
  }
  ensurePlayerHp(client) {
    const rec = this.profileFor(client);
    const max = this.maxHpForProfile(rec && rec.prof);
    const cur = this.playerHp.get(client.sessionId);
    if (!cur) {
      this.playerHp.set(client.sessionId, { hp: max, max });
      return this.playerHp.get(client.sessionId);
    }
    if (cur.max !== max) {
      cur.hp = Math.min(max, Math.max(1, cur.hp + (max - cur.max)));
      cur.max = max;
    }
    return cur;
  }
  ensurePlayerHunger(client) {
    let cur = this.playerHunger.get(client.sessionId);
    if (!cur) {
      cur = { hunger: MAX_HUNGER, max: MAX_HUNGER, acc: 0, syncAcc: 0 };
      this.playerHunger.set(client.sessionId, cur);
    }
    cur.max = MAX_HUNGER;
    cur.hunger = Math.max(0, Math.min(cur.max, cur.hunger));
    return cur;
  }
  sendHungerSync(client, h) {
    if (client && h) client.send('hunger', { hunger: Math.ceil(h.hunger), maxHunger: h.max });
  }
  isPlayerAlive(client) {
    const hp = this.ensurePlayerHp(client);
    return !!hp && hp.hp > 0;
  }
  isTrainingMeadowPlayer(client) {
    const p = client && this.state.players.get(client.sessionId);
    return !!(p && p.dim === 'tutorial' && p.dgn);
  }
  hurtPlayer(client, amount, reason = 'combat') {
    if (!client) return;
    if (this.isTrainingMeadowPlayer(client)) {
      const hp = this.ensurePlayerHp(client);
      hp.hp = hp.max;
      client.send('hurt', { n: -hp.max, reason: 'training' });
      return;
    }
    const incoming=Math.max(0,Number(amount)||0);
    const buffs = this.abilityBuffs.get(client.sessionId);
    if (buffs && buffs.ironUntil > Date.now()) amount *= .5;
    if (buffs && buffs.monkStoneUntil > Date.now()) amount *= (1 - JOB_SYSTEM.MONK_RULES.stoneMitigation);
    const rec = this.profileFor(client);
    const armorStack = rec && rec.prof && rec.prof.armor;
    const armor = armorStack ? ARMOR_INFO[armorStack.id] : null;
    let armorFeedback=null;
    if (armor) {
      const profile=GEAR_SYSTEM.armorProfile(armor,armorStack);
      amount *= (1 - profile.mitigation);
      const current=armorStack.dur==null?profile.maxDur:Math.max(0,armorStack.dur|0);
      armorStack.dur=Math.max(0,current-1);
      armorFeedback={id:armorStack.id,type:profile.type.id,dur:armorStack.dur,maxDur:profile.maxDur,mitigation:profile.mitigation};
      if(armorStack.dur<=0){rec.prof.armor=null;client.send('armorSync',{armor:null,broke:true});}
      else client.send('armorSync',{armor:{...armorStack,count:1}});
      this.dirtyPlayers.add(rec.token);
      this.syncPlayerProfile(client,rec.prof);
    }
    const p = this.state.players.get(client.sessionId);
    if (p && p.familiar === 'shade') amount *= (1 - shadeMitigation(p.lvl));   // Guarding Shade: shadows soak part of the blow
    const hp = this.ensurePlayerHp(client);
    const dmg = Math.max(0, Math.round(amount));
    hp.hp = Math.max(0, hp.hp - dmg);
    client.send('hurt', {
      n:dmg,reason,raw:Math.round(incoming),absorbed:Math.max(0,Math.round(incoming)-dmg),
      hp:hp.hp,maxHp:hp.max,lethal:hp.hp<=0,armor:armorFeedback,
    });
    // Second Wind — Iron Guardian passive, simulated where the authoritative HP lives
    if (hp.hp > 0 && hp.hp < hp.max * .25 && rec && rec.prof && rec.prof.S
        && rec.prof.S.path === 'guardian' && rec.prof.S.lvl >= 8) {
      const now = Date.now();
      if (!this.secondWindAt) this.secondWindAt = new Map();
      if (now >= (this.secondWindAt.get(client.sessionId) || 0)) {
        this.secondWindAt.set(client.sessionId, now + 60000);
        const heal = Math.round(hp.max * .4);
        hp.hp = Math.min(hp.max, hp.hp + heal);
        client.send('hurt', { n:-heal,reason:'second_wind',hp:hp.hp,maxHp:hp.max });
        if (p) this.sendSpace(p.dgn || '', 'fx', { t: 'secondWind', x: p.x, y: p.y, z: p.z, dgn: p.dgn || '' });
      }
    }
    if (p && p.dgn) this.sendDungeonStatus(p.dgn);
    if (hp.hp <= 0) this.handlePlayerDeath(client,reason);
  }
  handleUseFood(client, m) {
    const rec = this.profileFor(client);
    if (!rec || !m || !this.isPlayerAlive(client)) return client.send('foodReject', { reason: 'invalid' });
    const slot = Math.max(0, Math.min(35, m.slot | 0));
    const stack = Array.isArray(rec.prof.inv) ? rec.prof.inv[slot] : null;
    const id = stack && (stack.id | 0);
    const food = FOOD_VALUES[id];
    if (!food) return client.send('foodReject', { reason: 'item' });
    const hp = this.ensurePlayerHp(client);
    const hunger = this.ensurePlayerHunger(client);
    const timedMeal = food.buff === 'ration' || food.buff === 'feast';
    if (!timedMeal && hp.hp >= hp.max && hunger.hunger >= hunger.max) return client.send('foodReject', { reason: 'full', hp: Math.ceil(hp.hp), maxHp: hp.max, hunger: Math.ceil(hunger.hunger), maxHunger: hunger.max });
    if (!this.consumeSlotItem(rec.prof, slot, id, 1)) return client.send('foodReject', { reason: 'item' });
    const eater = this.state.players.get(client.sessionId);
    const targets = [client];
    if (food.buff === 'feast' && eater && eater.team) {
      for (const other of this.clients) {
        if (other === client) continue;
        const p = this.state.players.get(other.sessionId);
        if (p && p.team === eater.team && (p.dgn || '') === (eater.dgn || '') && Math.hypot(p.x - eater.x, p.z - eater.z) <= JOB_SYSTEM.COOK_RULES.feastRange) targets.push(other);
      }
    }
    const now = Date.now(), duration = food.buff === 'feast' ? JOB_SYSTEM.COOK_RULES.feastDurationMs : JOB_SYSTEM.COOK_RULES.rationDurationMs;
    for (const target of targets) {
      const thp = this.ensurePlayerHp(target), thunger = this.ensurePlayerHunger(target);
      thunger.hunger = Math.min(thunger.max, thunger.hunger + food.hunger);
      thp.hp = Math.min(thp.max, thp.hp + food.heal);
      if (timedMeal) {
        const buffs = this.abilityBuffs.get(target.sessionId) || {};
        buffs.mealMightUntil = Math.max(buffs.mealMightUntil || 0, now + duration);
        buffs.mealGatherUntil = Math.max(buffs.mealGatherUntil || 0, now + duration);
        this.abilityBuffs.set(target.sessionId, buffs);
      }
      if (target !== client) target.send('foodBuff', { id, buff: food.buff, durationMs: duration, by: eater && eater.name || 'your cook', hp: Math.ceil(thp.hp), maxHp: thp.max, hunger: Math.ceil(thunger.hunger), maxHunger: thunger.max });
    }
    this.dirtyPlayers.add(rec.token);
    client.send('foodResult', { slot, id, heal: food.heal, hungerGain: food.hunger, hunger: Math.ceil(hunger.hunger), maxHunger: hunger.max, hp: Math.ceil(hp.hp), maxHp: hp.max, buff: food.buff || '', durationMs: timedMeal ? duration : 0, partyCount: targets.length });
  }
  toolPlus(slot) {
    return Math.max(0, Math.min(3, slot && slot.plus ? slot.plus | 0 : 0));
  }
  toolMaxDur(slot, info) {
    if(slot&&ARMOR_INFO[slot.id])return GEAR_SYSTEM.armorProfile(info||ARMOR_INFO[slot.id],slot).maxDur;
    const base = info && info.dur ? info.dur | 0 : 1;
    const forge=slot&&slot.forge==='sturdy'?.2:0,master=slot&&slot.masterwork?.25:0;
    const rarity=GEAR_SYSTEM.profile(info||{},slot||{}).rarity.durability;
    return Math.min(99999, Math.round(base * (1 + this.toolPlus(slot) * 0.15 + forge + master)*rarity));
  }
  blacksmithNear(client) {
    const p = this.state.players.get(client.sessionId);
    if (!p || p.dgn) return false;
    const sx = W.TOWN.TC + (78.5 - 64), sz = W.TOWN.TC + (50 - 64);
    return Math.hypot((p.x || 0) - sx, (p.z || 0) - sz) <= 10;
  }
  repairCostFor(prof, missing) {
    const disc = jobPerkTier(prof, 'blacksmith') * 2;
    return Math.max(4, 10 + Math.ceil(Math.max(1, missing | 0) / 32) - disc);
  }
  findDamagedTool(prof, slot = -1) {
    const inv = prof && Array.isArray(prof.inv) ? prof.inv : [];
    const scanOne = i => {
      const s = inv[i], info = s && (TOOL_INFO[s.id]||ARMOR_INFO[s.id]);
      if (!info) return null;
      const max = this.toolMaxDur(s, info);
      const cur = s.dur == null ? max : Math.max(0, s.dur | 0);
      return cur < max ? { i, s, info, cur, max, missing: max - cur } : null;
    };
    if (slot >= 0) return scanOne(Math.max(0, Math.min(35, slot | 0)));
    let best = null;
    for (let i = 0; i < inv.length; i++) {
      const t = scanOne(i);
      if (t && (!best || t.missing > best.missing)) best = t;
    }
    return best;
  }
  handleBlacksmithRepair(client, m) {
    const rec = this.profileFor(client);
    if (!rec || !this.isPlayerAlive(client)) return client.send('blacksmithReject', { reason: 'invalid' });
    if (!this.blacksmithNear(client)) return client.send('blacksmithReject', { reason: 'range' });
    if (this.rateLimited(client, 'blacksmith', 8, 16)) return client.send('blacksmithReject', { reason: 'rate' });
    const slot = m && (m.slot | 0);
    const target = this.findDamagedTool(rec.prof, slot == null ? -1 : slot);
    if (!target) return client.send('blacksmithReject', { reason: 'tool' });
    const cost = this.repairCostFor(rec.prof, target.missing);
    if ((rec.prof.gold | 0) < cost) return client.send('blacksmithReject', { reason: 'gold' });
    rec.prof.gold = (rec.prof.gold | 0) - cost;
    target.s.dur = target.max;
    this.dirtyPlayers.add(rec.token);
    this.recordRepairProgress(client, false);
    client.send('blacksmithRepairResult', {
      toolSlot: target.i,
      tool: { id: target.s.id, count: target.s.count || 1, dur: target.s.dur, plus: this.toolPlus(target.s), gearRank:target.s.gearRank||'', armorType:target.s.armorType||'', rarity:target.s.rarity||'', forge:target.s.forge||'', masterwork:!!target.s.masterwork, locked:!!target.s.locked, source:target.s.source||'' },
      repaired: target.max - target.cur,
      gold: -cost,
    });
    this.sendSpace('', 'fx', { t: 'blacksmith', action: 'repair', id: target.s.id, plus: this.toolPlus(target.s), name: rec.prof.name || 'Hunter', dgn: '' });
  }
  upgradeCostFor(slot) {
    const id = slot && (slot.id | 0);
    const info = id && TOOL_INFO[id];
    if (!info || !['sword', 'pick'].includes(info.cls)) return null;
    if (![I.IRON_SWORD, I.DIA_SWORD, I.IRON_PICK, I.DIA_PICK].includes(id)) return null;
    const plus = this.toolPlus(slot);
    if (plus >= 3) return { max: true, plus };
    const diamond = id === I.DIA_SWORD || id === I.DIA_PICK;
    const next = plus + 1;
    return {
      plus, next,
      matId: diamond ? I.DIAMOND : I.IRON_INGOT,
      matCount: diamond ? next : next * 2,
      goldCost: diamond ? 70 + next * 60 : 25 + next * 25,
      info,
    };
  }
  handleBlacksmithUpgrade(client, m) {
    const rec = this.profileFor(client);
    if (!rec || !this.isPlayerAlive(client)) return client.send('blacksmithReject', { reason: 'invalid' });
    if (!this.blacksmithNear(client)) return client.send('blacksmithReject', { reason: 'range' });
    if (this.rateLimited(client, 'blacksmith', 8, 16)) return client.send('blacksmithReject', { reason: 'rate' });
    const slot = Math.max(0, Math.min(35, m && (m.slot | 0)));
    const inv = Array.isArray(rec.prof.inv) ? rec.prof.inv : [];
    const s = inv[slot], cost = this.upgradeCostFor(s);
    if (!cost) return client.send('blacksmithReject', { reason: 'tool' });
    if (cost.max) return client.send('blacksmithReject', { reason: 'max' });
    if ((rec.prof.gold | 0) < cost.goldCost) return client.send('blacksmithReject', { reason: 'gold' });
    if (this.countItem(rec.prof, cost.matId) < cost.matCount) return client.send('blacksmithReject', { reason: 'materials' });
    this.consumeItem(rec.prof, cost.matId, cost.matCount);
    rec.prof.gold = (rec.prof.gold | 0) - cost.goldCost;
    s.plus = cost.next;
    s.dur = this.toolMaxDur(s, cost.info);
    this.dirtyPlayers.add(rec.token);
    this.recordRepairProgress(client, true);
    client.send('blacksmithUpgradeResult', {
      slot,
      tool: { id: s.id, count: s.count || 1, dur: s.dur, plus: s.plus, rarity:s.rarity||'', forge:s.forge||'', masterwork:!!s.masterwork, locked:!!s.locked, source:s.source||'' },
      mat: { id: cost.matId, count: cost.matCount },
      gold: -cost.goldCost,
    });
    this.sendSpace('', 'fx', { t: 'blacksmith', action: 'upgrade', id: s.id, plus: s.plus, name: rec.prof.name || 'Hunter', dgn: '' });
  }
  handleBlacksmithReforge(client,m){
    const rec=this.profileFor(client),action=m&&String(m.action||''),cost=JOB_SYSTEM.reforgeCost(action);
    if(!rec||!this.isPlayerAlive(client))return client.send('blacksmithReject',{reason:'invalid'});
    if(!this.blacksmithNear(client))return client.send('blacksmithReject',{reason:'range'});
    if(this.rateLimited(client,'blacksmith',8,16))return client.send('blacksmithReject',{reason:'rate'});
    if(rec.prof.job!=='blacksmith')return client.send('blacksmithReject',{reason:'profession'});
    const level=JOB_SYSTEM.jobLevelFromXp(rec.prof.jobXpByJob&&rec.prof.jobXpByJob.blacksmith||0);
    if(!cost||level<cost.level)return client.send('blacksmithReject',{reason:'level',level:cost&&cost.level||2});
    const slot=Math.max(0,Math.min(35,m&&m.slot|0)),s=rec.prof.inv&&rec.prof.inv[slot],info=s&&TOOL_INFO[s.id];
    if(!s||!info||!['sword','axe','pick'].includes(info.cls))return client.send('blacksmithReject',{reason:'tool'});
    if(action==='basic'&&s.forge)return client.send('blacksmithReject',{reason:'forged'});
    if(action==='reroll'&&!s.forge)return client.send('blacksmithReject',{reason:'unforged'});
    if(action==='masterwork'&&(!s.forge||s.masterwork))return client.send('blacksmithReject',{reason:s.masterwork?'masterwork':'unforged'});
    const requested=String(m&&m.modifier||''),ids=Object.keys(JOB_SYSTEM.REFORGE_MODIFIERS);let modifier=s.forge||'';
    if(action==='choose'){if(!JOB_SYSTEM.reforgeModifier(requested))return client.send('blacksmithReject',{reason:'modifier'});modifier=requested;}
    if(action==='basic')modifier=ids[(Math.random()*ids.length)|0];
    if(action==='reroll'){const choices=ids.filter(id=>id!==s.forge);modifier=choices[(Math.random()*choices.length)|0];}
    if((rec.prof.gold|0)<cost.gold)return client.send('blacksmithReject',{reason:'gold'});
    if(cost.iron&&this.countItem(rec.prof,I.IRON_INGOT)<cost.iron)return client.send('blacksmithReject',{reason:'materials'});
    if(cost.diamond&&this.countItem(rec.prof,I.DIAMOND)<cost.diamond)return client.send('blacksmithReject',{reason:'materials'});
    if(cost.iron)this.consumeItem(rec.prof,I.IRON_INGOT,cost.iron);if(cost.diamond)this.consumeItem(rec.prof,I.DIAMOND,cost.diamond);
    rec.prof.gold=(rec.prof.gold|0)-cost.gold;if(action==='masterwork')s.masterwork=true;else s.forge=modifier;
    s.dur=this.toolMaxDur(s,info);this.dirtyPlayers.add(rec.token);this.recordRepairProgress(client,true);
    client.send('blacksmithReforgeResult',{slot,tool:{id:s.id,count:s.count||1,dur:s.dur,plus:this.toolPlus(s),rarity:s.rarity||'',forge:s.forge||'',masterwork:!!s.masterwork,locked:!!s.locked,source:s.source||''},gold:-cost.gold,materials:{iron:cost.iron,diamond:cost.diamond},action});
    this.sendSpace('','fx',{t:'blacksmith',action:'reforge',id:s.id,plus:this.toolPlus(s),name:rec.prof.name||'Hunter',dgn:''});
  }
  handleBlacksmithSalvage(client,m){
    const rec=this.profileFor(client);if(!rec||!this.isPlayerAlive(client))return client.send('blacksmithReject',{reason:'invalid'});
    if(!this.blacksmithNear(client))return client.send('blacksmithReject',{reason:'range'});
    if(this.rateLimited(client,'blacksmith',8,16))return client.send('blacksmithReject',{reason:'rate'});
    const slot=Math.max(0,Math.min(35,m&&m.slot|0)),stack=rec.prof.inv&&rec.prof.inv[slot],info=stack&&(TOOL_INFO[stack.id]||ARMOR_INFO[stack.id]);
    const salvageable=info&&(ARMOR_INFO[stack.id]||['sword','axe'].includes(info.cls));
    if(!stack||!salvageable)return client.send('blacksmithReject',{reason:'tool'});
    if((info.tier|0)>=5||info.legendary)return client.send('blacksmithReject',{reason:'legendary'});
    if(stack.locked)return client.send('blacksmithReject',{reason:'locked'});
    const gear=GEAR_SYSTEM.profile(info,stack),salvage=LOOT_ECONOMY.salvageYield(gear.rankIndex,gear.rarityIndex,info.tier),iron=salvage.iron,gold=salvage.gold;
    rec.prof.inv[slot]=null;this.addRewardItem(rec.prof,I.IRON_INGOT,iron);rec.prof.gold=Math.min(1e9,(rec.prof.gold|0)+gold);
    this.dirtyPlayers.add(rec.token);client.send('blacksmithSalvageResult',{slot,iron,gold,rank:gear.rank.id,rarity:gear.rarity.id});
    this.sendSpace('','fx',{t:'blacksmith',action:'salvage',id:stack.id,plus:this.toolPlus(stack),name:rec.prof.name||'Hunter',dgn:''});
  }
  handleGearLock(client,m){
    const rec=this.profileFor(client);if(!rec||this.rateLimited(client,'gearLock',8,16))return;
    const slot=Math.max(0,Math.min(35,m&&m.slot|0)),stack=rec.prof.inv&&rec.prof.inv[slot],info=stack&&(TOOL_INFO[stack.id]||ARMOR_INFO[stack.id]);
    if(!stack||!info)return client.send('gearLockResult',{ok:false,reason:'tool',slot});
    stack.locked=m&&typeof m.locked==='boolean'?m.locked:!stack.locked;
    this.dirtyPlayers.add(rec.token);client.send('gearLockResult',{ok:true,slot,locked:!!stack.locked});
  }
  handleLootRecovery(client,m){
    const rec=this.profileFor(client);if(!rec||!this.isPlayerAlive(client))return;
    if(!this.blacksmithNear(client))return client.send('lootRecoveryResult',{ok:false,reason:'range'});
    if(this.rateLimited(client,'lootRecovery',8,16))return client.send('lootRecoveryResult',{ok:false,reason:'rate'});
    const queue=this.pruneLootRecovery(rec.prof);
    if(!m||m.action==='list')return client.send('lootRecoveryState',{items:queue});
    if(m.action!=='claim')return;
    const index=Math.max(0,Math.min(11,m.index|0)),item=queue[index];
    if(!item)return client.send('lootRecoveryResult',{ok:false,reason:'item',items:queue});
    const slot=(rec.prof.inv||[]).findIndex(s=>!s);
    const target=slot>=0?slot:(rec.prof.inv||[]).length<36?(rec.prof.inv||[]).length:-1;
    if(target<0)return client.send('lootRecoveryResult',{ok:false,reason:'full',items:queue});
    if(this.addGearRewardItem(rec.prof,item))return client.send('lootRecoveryResult',{ok:false,reason:'full',items:queue});
    queue.splice(index,1);this.dirtyPlayers.add(rec.token);this.syncPlayerProfile(client,rec.prof);
    client.send('lootRecoveryResult',{ok:true,slot:target,item:{...rec.prof.inv[target],gear:true},items:queue});
  }
  handleUseRepairKit(client, m) {
    const rec = this.profileFor(client);
    if (!rec || !m || !this.isPlayerAlive(client)) return client.send('repairReject', { reason: 'invalid' });
    const kitSlot = Math.max(0, Math.min(35, m.slot | 0));
    const inv = Array.isArray(rec.prof.inv) ? rec.prof.inv : [];
    const kit = inv[kitSlot];
    if (!kit || kit.id !== I.REPAIR_KIT || kit.dur != null || (kit.count | 0) <= 0) return client.send('repairReject', { reason: 'kit' });
    let best = null;
    for (let i = 0; i < inv.length; i++) {
      if (i === kitSlot) continue;
      const s = inv[i];
      const info = s && (TOOL_INFO[s.id]||ARMOR_INFO[s.id]);
      if (!info) continue;
      const max = this.toolMaxDur(s, info);
      const cur = s.dur == null ? max : Math.max(0, s.dur | 0);
      if (cur >= max) continue;
      const missing = max - cur;
      if (!best || missing > best.missing) best = { i, s, info, cur, missing };
    }
    if (!best) return client.send('repairReject', { reason: 'tool' });
    if (!this.consumeSlotItem(rec.prof, kitSlot, I.REPAIR_KIT, 1)) return client.send('repairReject', { reason: 'kit' });
    const tier = jobPerkTier(rec.prof, 'blacksmith');
    const max = this.toolMaxDur(best.s, best.info);
    const gain = Math.max(1, Math.ceil(max * (0.5 + tier * 0.06)));
    best.s.dur = Math.min(max, best.cur + gain);
    this.dirtyPlayers.add(rec.token);
    this.recordRepairProgress(client, false);
    client.send('repairResult', {
      kitSlot,
      toolSlot: best.i,
      tool: { id: best.s.id, count: best.s.count || 1, dur: best.s.dur, plus: this.toolPlus(best.s), gearRank:best.s.gearRank||'', armorType:best.s.armorType||'', rarity:best.s.rarity||'', forge:best.s.forge||'', masterwork:!!best.s.masterwork, locked:!!best.s.locked, source:best.s.source||'' },
      repaired: best.s.dur - best.cur,
    });
  }
  handlePlayerDeath(client,reason='combat') {
    const p = this.state.players.get(client.sessionId);
    const hp = this.ensurePlayerHp(client);
    const rec = this.profileFor(client);
    const hasPhoenix = rec && rec.prof && Array.isArray(rec.prof.inv) && rec.prof.inv.some(s => s && s.id === I.PHOENIX_SWORD);
    if (hasPhoenix && !this.phoenixUsed.has(client.sessionId)) {
      this.phoenixUsed.add(client.sessionId);
      hp.hp = Math.max(1, Math.ceil(hp.max * .35));
      client.send('hurt', { n:-hp.hp,reason:'phoenix_rebirth',hp:hp.hp,maxHp:hp.max });
      if (p) {
        this.damageMobsInRadius(client, p.x, p.y + .7, p.z, 4.2, 18, { knock: 3.5, stun: .7 });
        this.sendSpace(p.dgn || '', 'fx', { t: 'legendary', kind: 'phoenix', rebirth: true, x: p.x, y: p.y, z: p.z, dgn: p.dgn || '' });
      }
      return;
    }
    if (p && this.handleKingPlayerDeath(client, p, hp)) return;
    if (p) this.handleAegisBountyPlayerDeath(client, p);
    if (p && p.dgn) {
      const dgn = p.dgn;
      const inst = this.instances[dgn];
      const reason = inst && inst.players.size <= 1 ? 'solo' : 'wipe';
      this.ejectFromDungeon(client.sessionId);
      client.send('dungeonDeath', { reason:'death',cause:reason,x:p.x,y:p.y,z:p.z });
      if (inst && !inst.hasLivingPlayers()) {
        this.failDungeon(dgn, reason);
        const quest = rec && rec.prof && rec.prof.activeNpcQuest;
        if (quest && quest.type === 'gate' && (quest.gateRank | 0) >= 0) {
          this.ensurePublicGateRank(quest.gateRank);
        } else if (rec && rec.prof && rec.prof.progressionFocus === 'first_d_gate') {
          this.ensurePublicGateRank(1);
        }
      }
    } else {
      hp.hp = hp.max;
      client.send('worldDeath', {reason:'death',cause:reason});
    }
  }
  updatePlayerHunger(dt) {
    for (const client of this.clients || []) {
      const p = this.state.players.get(client.sessionId);
      if (!p) continue;
      const hp = this.ensurePlayerHp(client);
      const h = this.ensurePlayerHunger(client);
      if (this.isTrainingMeadowPlayer(client)) {
        h.hunger = h.max;
        h.acc = 0;
        h.syncAcc = 0;
        hp.hp = hp.max;
        this.sendHungerSync(client, h);
        continue;
      }
      if (hp.hp <= 0) continue;
      const focus = this.abilityBuffs.get(client.sessionId);
      if (focus && focus.monkRegenUntil > Date.now() && hp.hp < hp.max) hp.hp = Math.min(hp.max, hp.hp + JOB_SYSTEM.MONK_RULES.regenPerSecond * dt);
      const before = Math.ceil(h.hunger);
      const moving = (this.pvel.get(client.sessionId) || { x: 0, z: 0 });
      const moveRate = Math.min(1, Math.hypot(moving.x || 0, moving.z || 0) / 6);
      h.hunger = Math.max(0, h.hunger - dt * (0.055 + moveRate * 0.045));
      if (h.hunger <= 0) {
        h.acc = (h.acc || 0) + dt;
        if (h.acc >= 5) {
          h.acc = 0;
          hp.hp = Math.max(1, hp.hp - 1);
          client.send('hurt', { n: 1, reason: 'hunger' });
        }
      } else h.acc = 0;
      h.syncAcc = (h.syncAcc || 0) + dt;
      if (before !== Math.ceil(h.hunger) || h.syncAcc >= 5) {
        h.syncAcc = 0;
        this.sendHungerSync(client, h);
      }
    }
  }
  recordBossContribution(client, dgn, damage) {
    if (!client || !dgn) return;
    const byPlayer = this.bossContrib.get(dgn) || new Map();
    const rec = byPlayer.get(client.sessionId) || { damage: 0, support: 0, last: 0 };
    rec.damage += Math.max(0, damage);
    rec.last = Date.now();
    byPlayer.set(client.sessionId, rec);
    this.bossContrib.set(dgn, byPlayer);
    if (!rec.lastSync || rec.last - rec.lastSync >= 500) { rec.lastSync = rec.last; this.sendDungeonStatus(dgn); }
  }
  recordBossSupport(client, dgn, amount) {
    if (!client || !dgn || !(amount > 0)) return;
    const byPlayer = this.bossContrib.get(dgn) || new Map();
    const rec = byPlayer.get(client.sessionId) || { damage: 0, support: 0, last: 0 };
    rec.support += Math.max(0, amount);
    rec.last = Date.now();
    byPlayer.set(client.sessionId, rec);
    this.bossContrib.set(dgn, byPlayer);
    if (!rec.lastSync || rec.last - rec.lastSync >= 500) { rec.lastSync = rec.last; this.sendDungeonStatus(dgn); }
  }
  bossRewardEligibility(client, inst) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !inst || p.dgn !== inst.id) return { ok: false, reason: 'not_inside' };
    if (!this.isPlayerAlive(client)) return { ok: false, reason: 'dead' };
    const room = inst.bossRoom || {};
    if (Number.isFinite(room.x) && Math.hypot(p.x - room.x, p.z - room.z) > BOSS_REWARD_RANGE) return { ok: false, reason: 'range' };
    const rec = this.bossContrib.get(inst.id)?.get(client.sessionId);
    if (!rec || (rec.damage <= 0 && rec.support <= 0)) return { ok: false, reason: 'contribution' };
    if (Date.now() - rec.last > BOSS_CONTRIB_MS) return { ok: false, reason: 'stale' };
    return { ok: true, reason: '' };
  }
  bossRewardEligible(client, inst) {
    return this.bossRewardEligibility(client, inst).ok;
  }
  awardXP(client, n) {
    const rec = this.profileFor(client);
    const amount = Math.max(0, Math.min(100000, n | 0));
    if (rec && amount) {
      this.grantHunterXp(rec.prof, amount, client, 'combat');
      this.syncPlayerProfile(client, rec.prof);
      this.dirtyPlayers.add(rec.token);
    }
    client.send('xp', { n: amount });
  }
  discoverySpec(id) {
    if (!this.smallDiscoveryById) this.smallDiscoveryById = new Map(W.smallDiscoverySpecs().map(s => [s.id, s]));
    return this.smallDiscoveryById.get(String(id || '')) || null;
  }
  explorationSpec(id) {
    const small = this.discoverySpec(id); if (small) return small;
    if (!this.regionalLandmarkById) this.regionalLandmarkById = new Map(W.regionalLandmarkSpecs().map(s => [s.id, s]));
    return this.regionalLandmarkById.get(String(id || '')) || null;
  }
  regionalContractBucket(now = Date.now()) {
    return Math.floor(now / (6 * 60 * 60 * 1000));
  }
  pickContractTarget(list, bucket, salt) {
    if (!list.length) return null;
    const scored = list.map(s => ({ s, r: W.hash2((s.x | 0) + bucket * 97 + salt, (s.z | 0) + bucket * 193 - salt) }));
    scored.sort((a, b) => b.r - a.r);
    return scored[0].s;
  }
  regionalContractOffers(now = Date.now(), level = 1) {
    const bucket = this.regionalContractBucket(now);
    const landmarks = W.regionalLandmarkSpecs();
    const small = W.smallDiscoverySpecs();
    const offers = [];
    const mkReward = (s, baseGold, baseXp) => {
      const ring = dangerRingAt(s.x, s.z);
      return {
        rewardGold: Math.round(baseGold * DANGER_RINGS[ring].loot),
        rewardXp: Math.max(Math.round(baseXp * DANGER_RINGS[ring].loot), hunterXpForActivity(level, 'guild_contract')),
        rewardItems: ring >= 2 ? [{ id: ring >= 3 ? I.DIAMOND : I.IRON_INGOT, count: ring >= 3 ? 1 : 2 }] : [],
      };
    };
    const scout = this.pickContractTarget(landmarks.filter(s => s.major), bucket, 11);
    if (scout) offers.push({
      id: 'regional_' + bucket + '_scout_' + scout.id, type: 'scout_landmark', targetId: scout.id, targetType: scout.type,
      targetName: scout.name || 'Landmark', need: 1, have: 0,
      title: 'Scout ' + (scout.name || 'a Landmark'),
      desc: 'Travel to the marked site and map it for the Hunter Guild.',
      ...mkReward(scout, 42, 30), acceptedAt: 0, seed: bucket,
    });
    const camp = this.pickContractTarget(landmarks.filter(s => s.type === 'hunter_camp'), bucket, 23);
    if (camp) offers.push({
      id: 'regional_' + bucket + '_camp_' + camp.id, type: 'clear_elite_camp', targetId: camp.id, targetType: camp.type,
      targetName: camp.name || 'Hunter Camp', need: 1, have: 0,
      title: 'Break the Elite Camp',
      desc: 'Defeat an elite guard posted at ' + (camp.name || 'a hunter camp') + '.',
      ...mkReward(camp, 64, 42), acceptedAt: 0, seed: bucket,
    });
    const biomeEntries = Object.entries(BIOME_COLLECTIBLE).map(([bio, def]) => ({ bio: bio | 0, ...def }));
    const bio = biomeEntries[(Math.floor(W.hash2(bucket + 31, bucket + 73) * biomeEntries.length)) % biomeEntries.length];
    if (bio) offers.push({
      id: 'regional_' + bucket + '_collect_' + bio.item, type: 'collect_biome', targetId: 'item_' + bio.item, targetType: 'biome_collectible',
      targetName: bio.name, targetItem: bio.item, targetItemName: bio.name, need: 3 + (bucket % 2), have: 0,
      title: 'Gather ' + bio.name,
      desc: 'Bring back regional material gathered from its native biome.',
      rewardGold: 46, rewardXp: Math.max(26, hunterXpForActivity(level, 'guild_contract')), rewardItems: [], acceptedAt: 0, seed: bucket,
    });
    const cache = this.pickContractTarget(small.filter(s => s.type === 'buried_chest'), bucket, 41);
    if (cache) offers.push({
      id: 'regional_' + bucket + '_cache_' + cache.id, type: 'recover_buried_cache', targetId: cache.id, targetType: cache.type,
      targetName: 'Buried Cache', need: 1, have: 0,
      title: 'Recover a Buried Cache',
      desc: 'Locate a roadside cache and secure the supplies before scavengers do.',
      ...mkReward(cache, 50, 28), acceptedAt: 0, seed: bucket,
    });
    const puzzle = this.pickContractTarget(small.filter(s => s.type === 'puzzle_shrine'), bucket, 53);
    if (puzzle) offers.push({
      id: 'regional_' + bucket + '_puzzle_' + puzzle.id, type: 'solve_puzzle_shrine', targetId: puzzle.id, targetType: puzzle.type,
      targetName: 'Odd-Flame Shrine', need: 1, have: 0,
      title: 'Solve the Odd-Flame Shrine',
      desc: 'Find the mismatched flame at a puzzle shrine and report the result.',
      ...mkReward(puzzle, 58, 36), acceptedAt: 0, seed: bucket,
    });
    const merchant = this.pickContractTarget(small.filter(s => s.type === 'traveling_merchant'), bucket, 67);
    if (merchant) offers.push({
      id: 'regional_' + bucket + '_merchant_' + merchant.id, type: 'visit_road_merchant', targetId: merchant.id, targetType: merchant.type,
      targetName: 'Road Merchant', need: 1, have: 0,
      title: 'Check on a Road Merchant',
      desc: 'Visit a traveling merchant and confirm the road is still open.',
      ...mkReward(merchant, 38, 22), acceptedAt: 0, seed: bucket,
    });
    const banditCamp=this.pickContractTarget(landmarks.filter(s=>s.type==='bandit_camp'),bucket,79);
    if(banditCamp)offers.push({id:'regional_'+bucket+'_roadcamp_'+banditCamp.id,type:'road_clear_camp',targetId:banditCamp.id,targetType:'bandit_camp',targetName:banditCamp.name,need:1,have:0,title:'Road Warden: Break the Camp',desc:'Clear the named bandit camp and defeat its captain.',...mkReward(banditCamp,78,54),acceptedAt:0,seed:bucket});
    const roadType=['road_rescue','road_recover','road_spare','road_roles'][bucket%4];
    const roadText={road_escort:['Safe Arrival','Escort a caravan safely to its destination.'],road_rescue:['Roadside Rescue','Defeat a patrol threatening a merchant caravan.'],road_recover:['Stolen Manifest','Recover supplies carried to a bandit camp.'],road_spare:['Mercy with Teeth','Spare one surrendered bandit and recover their stolen goods.'],road_roles:['Know the Enemy','Defeat three specialist bandits.']}[roadType];
    offers.push({id:'regional_'+bucket+'_'+roadType,type:roadType,targetId:'',targetType:'road_warden',targetName:'Regional Roads',need:roadType==='road_roles'?2:1,have:0,title:'Road Warden: '+roadText[0],desc:roadText[1],rewardGold:72,rewardXp:Math.max(48,hunterXpForActivity(level,'guild_contract')),rewardItems:[{id:I.IRON_INGOT,count:2}],acceptedAt:0,seed:bucket});
    return offers;
  }
  publicRegionalContract(c) {
    if (!c) return null;
    return {
      id: String(c.id || ''), type: String(c.type || ''), targetId: String(c.targetId || ''), targetType: String(c.targetType || ''),
      targetName: String(c.targetName || ''), targetItem: c.targetItem | 0, targetItemName: String(c.targetItemName || ''),
      need: Math.max(1, c.need | 0), have: Math.max(0, Math.min(Math.max(1, c.need | 0), c.have | 0)),
      rewardGold: Math.max(0, c.rewardGold | 0), rewardXp: Math.max(0, c.rewardXp | 0),
      rewardItems: Array.isArray(c.rewardItems) ? c.rewardItems.map(it => ({ id: it.id | 0, count: Math.max(1, it.count | 0) })) : [],
      title: String(c.title || 'Guild Contract'), desc: String(c.desc || ''),
      ready: (c.have | 0) >= (c.need | 0),
    };
  }
  sendRegionalContracts(client) {
    const rec = this.profileFor(client);
    if (!rec) return client.send('regionalContracts', { offers: [], active: null });
    client.send('regionalContracts', {
      offers: this.regionalContractOffers(Date.now(), rec.prof.S.lvl).map(c => this.publicRegionalContract(c)),
      active: this.publicRegionalContract(rec.prof.regionalContract),
    });
  }
  contractBoardInRange(client) {
    const p = this.state.players.get(client.sessionId);
    return !!(p && !p.dgn && Math.hypot(p.x - GUILD_BOARD_POS.x, p.z - GUILD_BOARD_POS.z) < 5);
  }
  handleRegionalContractAccept(client, m) {
    const rec = this.profileFor(client);
    if (!rec || !this.contractBoardInRange(client)) return client.send('regionalContractReject', { reason: 'range' });
    if (rec.prof.regionalContract)
      return client.send('regionalContractReject', { reason: 'active' });
    const id = String(m && m.id || '');
    const offer = this.regionalContractOffers(Date.now(), rec.prof.S.lvl).find(c => c.id === id);
    if (!offer) return client.send('regionalContractReject', { reason: 'expired' });
    rec.prof.regionalContract = { ...offer, have: 0, acceptedAt: Date.now() };
    this.dirtyPlayers.add(rec.token);
    client.send('regionalContractUpdate', { active: this.publicRegionalContract(rec.prof.regionalContract) });
    for (const mate of this.onlineTeamClients(client)) {
      const mrec = this.profileFor(mate);
      if (!mrec || mrec.prof.regionalContract) continue;
      mrec.prof.regionalContract = { ...offer, have: 0, acceptedAt: Date.now() };
      this.dirtyPlayers.add(mrec.token);
      mate.send('regionalContractUpdate', { active: this.publicRegionalContract(mrec.prof.regionalContract), shared: true });
      mate.send('chat', { name: '[Guild]', text: 'Team contract accepted: ' + (offer.title || 'Guild Contract') });
    }
    this.sendRegionalContracts(client);
  }
  handleCaravanContractAccept(client, m) {
    const rec=this.profileFor(client),p=this.state.players.get(client.sessionId),id=String(m&&m.id||'');
    const caravan=this.roadCaravans&&this.roadCaravans.get(id),merchant=caravan&&this.state.mobs.get(caravan.merchantId);
    if(!rec||!p||p.dgn||!caravan||!merchant||Math.hypot(p.x-merchant.x,p.z-merchant.z)>7)
      return client.send('regionalContractReject',{reason:'range'});
    if(rec.prof.regionalContract)return client.send('regionalContractReject',{reason:'active'});
    const ring=dangerRingAt(merchant.x,merchant.z),contract={
      id:'caravan_escort_'+caravan.id+'_'+Date.now(),type:'road_escort',targetId:caravan.id,targetType:'caravan',targetName:'Road Caravan',
      need:1,have:0,title:'Safe Arrival',desc:'Stay with this caravan until it reaches its destination.',
      rewardGold:Math.round(72*DANGER_RINGS[ring].loot),rewardXp:Math.max(48,hunterXpForActivity(rec.prof.S.lvl,'guild_contract')),
      rewardItems:[{id:I.IRON_INGOT,count:2}],acceptedAt:Date.now(),seed:Date.now(),
    };
    rec.prof.regionalContract=contract;caravan.escorts.add(client.sessionId);this.dirtyPlayers.add(rec.token);
    client.send('regionalContractUpdate',{active:this.publicRegionalContract(contract),caravan:true});
    client.send('chat',{name:'[Caravan]',text:'Escort accepted. Stay near the convoy until it reaches safety.'});
  }
  handleRegionalContractAbandon(client) {
    const rec = this.profileFor(client);
    if (!rec) return;
    rec.prof.regionalContract = null;
    this.dirtyPlayers.add(rec.token);
    client.send('regionalContractUpdate', { active: null });
    this.sendRegionalContracts(client);
  }
  handleRegionalContractClaim(client) {
    const rec = this.profileFor(client);
    if (!rec || !this.contractBoardInRange(client)) return client.send('regionalContractReject', { reason: 'range' });
    const c = rec.prof.regionalContract;
    if (!c || (c.have | 0) < (c.need | 0)) return client.send('regionalContractReject', { reason: 'incomplete' });
    const rewardItems = Array.isArray(c.rewardItems) ? c.rewardItems.map(it => ({ id: it.id | 0, count: Math.max(1, it.count | 0) })) : [];
    const rewardGold = Math.max(0, c.rewardGold | 0), rewardXp = Math.max(0, c.rewardXp | 0);
    rec.prof.gold = Math.max(0, Math.min(1e9, (rec.prof.gold | 0) + rewardGold));
    this.grantHunterXp(rec.prof, rewardXp, client, 'guild_contract');
    for (const it of rewardItems) this.addRewardItem(rec.prof, it.id, it.count);
    const done = this.publicRegionalContract(c);
    rec.prof.regionalContract = null;
    let roadWardenMilestone = null, rewardGear = null, rewardGearRecovered = false;
    if(String(c.type||'').startsWith('road_')){
      const beforeRep=rec.prof.roadWardenRep|0;
      rec.prof.roadWardenRep=Math.min(9999,(rec.prof.roadWardenRep|0)+1);
      if(rec.prof.roadWardenRep>=3)this.unlockUtility(client,'trail_sense','Road Warden reputation III');
      const milestone=[
        {rep:1,name:'Roadhand',reward:'A Road Warden field cache awarded.'},
        {rep:3,name:'Trail Reader',reward:'Trail Sense unlocked and iron added to road merchant stock.'},
        {rep:6,name:'Road Warden',reward:'Cooked provisions unlocked and permanent merchant prices improved.'},
        {rep:9,name:'Highway Shield',reward:'Maximum permanent Road Warden discount unlocked.'},
      ].find(row=>beforeRep<row.rep&&rec.prof.roadWardenRep>=row.rep);
      if(milestone){
        roadWardenMilestone=milestone;
        const rank=Math.max(0,Math.min(4,hunterRankIndexForLevel(rec.prof.S.lvl)));
        rewardGear=milestone.rep===6
          ?{...this.rollArmorDrop(rank,.08+milestone.rep*.01,rank>=3?'bulwark':'vanguard'),source:'road_warden'}
          :{...this.rollWeaponDrop(rank,.08+milestone.rep*.01,this.gateWeaponArchetype(rec.prof)),source:'road_warden'};
        if(this.addGearRewardItem(rec.prof,rewardGear)){
          const queued=this.queueGearRecovery(rec.prof,rewardGear,'road_warden');
          rewardGearRecovered=!!queued;
          if(!queued)rewardGear=null;
        }
      }
      this.adjustRoadSafety(2, 'warden_contract');
    }
    this.unlockUtility(client, 'compass', 'Guild contract complete');
    this.syncPlayerProfile(client, rec.prof);
    this.dirtyPlayers.add(rec.token);
    client.send('regionalContractClaimed', { contract: done, rewardGold, rewardXp, rewardItems, rewardGear, rewardGearRecovered, roadWardenRep: rec.prof.roadWardenRep | 0, roadWardenMilestone });
    client.send('profile', rec.prof);
    this.sendRegionalContracts(client);
  }
  progressRegionalContract(client, type, opts = {}) {
    const rec = this.profileFor(client);
    if (!rec || !rec.prof.regionalContract) return false;
    const base = rec.prof.regionalContract;
    if (base.type !== type || (base.have | 0) >= (base.need | 0)) return false;
    if (base.targetId && opts.targetId && base.targetId !== opts.targetId) return false;
    if (base.targetItem && opts.itemId && (base.targetItem | 0) !== (opts.itemId | 0)) return false;
    const add = Math.max(1, opts.count | 0 || 1);
    let progressed = false;
    const targets = [{ client, rec }, ...this.onlineTeamClients(client).map(mate => ({ client: mate, rec: this.profileFor(mate) }))];
    for (const entry of targets) {
      if (!entry.rec || !entry.rec.prof.regionalContract) continue;
      const c = entry.rec.prof.regionalContract;
      if (c.id !== base.id || c.type !== type || (c.have | 0) >= (c.need | 0)) continue;
      if (c.targetId && opts.targetId && c.targetId !== opts.targetId) continue;
      if (c.targetItem && opts.itemId && (c.targetItem | 0) !== (opts.itemId | 0)) continue;
      c.have = Math.min(c.need | 0, (c.have | 0) + add);
      this.dirtyPlayers.add(entry.rec.token);
      const active = this.publicRegionalContract(c);
      entry.client.send('regionalContractUpdate', { active, progress: add, shared: entry.client !== client });
      if (active.ready) entry.client.send('regionalContractReady', { active });
      progressed = true;
    }
    return progressed;
  }
  handleRegionalContractVisit(client, m) {
    const p = this.state.players.get(client.sessionId);
    const s = m && this.discoverySpec(m.id);
    if (!p || p.dgn || !s || s.type !== 'traveling_merchant' || Math.hypot(p.x - s.x, p.z - s.z) > s.radius + 4)
      return client.send('regionalContractReject', { reason: 'range' });
    this.markDiscovery(client, s);
    this.progressRegionalContract(client, 'visit_road_merchant', { targetId: s.id });
  }
  markDiscovery(client, s) {
    const rec = this.profileFor(client); if (!rec || !s) return false;
    if (!Array.isArray(rec.prof.discoveries)) rec.prof.discoveries = [];
    if (rec.prof.discoveries.includes(s.id)) return false;
    rec.prof.discoveries.push(s.id); this.dirtyPlayers.add(rec.token);
    this.unlockUtility(client, 'minimap', 'First mapped discovery');
    if (rec.prof.discoveries.length >= 5) this.unlockUtility(client, 'world_map', 'Regional cartographer');
    client.send('discoverySighted', { id: s.id, type: s.type, name: s.name || s.type.replace(/_/g, ' ') });
    for (const mate of this.onlineTeamClients(client)) this.shareDiscoveryWithClient(mate, s, client);
    return true;
  }
  shareDiscoveryWithClient(client, s, sourceClient) {
    const rec = this.profileFor(client); if (!rec || !s) return false;
    if (!Array.isArray(rec.prof.discoveries)) rec.prof.discoveries = [];
    if (rec.prof.discoveries.includes(s.id)) return false;
    rec.prof.discoveries.push(s.id);
    this.dirtyPlayers.add(rec.token);
    this.unlockUtility(client, 'minimap', 'Team map sharing');
    if (rec.prof.discoveries.length >= 5) this.unlockUtility(client, 'world_map', 'Team cartographer');
    const src = sourceClient && this.state.players.get(sourceClient.sessionId);
    client.send('discoverySighted', {
      id: s.id,
      type: s.type,
      name: s.name || s.type.replace(/_/g, ' '),
      shared: true,
      by: src && src.name || 'teammate',
    });
    return true;
  }
  handleDiscoverySight(client, m) {
    const p=this.state.players.get(client.sessionId),s=m&&this.explorationSpec(m.id);
    if(!p||p.dgn||!s||Math.hypot(p.x-s.x,p.z-s.z)>(s.radius||8)+3)return;
    this.markDiscovery(client,s);
    this.progressRegionalContract(client, 'scout_landmark', { targetId: s.id });
  }
  handleDiscoveryInteract(client, m) {
    const p = this.state.players.get(client.sessionId), s = m && this.discoverySpec(m.id);
    if (!p || p.dgn || !s || Math.hypot(p.x - s.x, p.z - s.z) > s.radius + 2) return client.send('discoveryReject', { reason: 'range' });
    if (s.type === 'puzzle_shrine' && (!s.target || (m.x | 0) !== s.target.x || (m.y | 0) !== s.target.y || (m.z | 0) !== s.target.z))
      return client.send('discoveryReject', { reason: 'pattern', hint: 'Two flames agree. Touch the one that does not.' });
    if (!['rare_plant', 'lore_tablet', 'fishing_pool', 'puzzle_shrine', 'buried_chest'].includes(s.type)) return client.send('discoveryReject', { reason: 'inactive' });
    const rec=this.profileFor(client);if(!rec)return client.send('discoveryReject',{reason:'invalid'});
    this.markDiscovery(client,s);
    if(!Array.isArray(rec.prof.claimedDiscoveries))rec.prof.claimedDiscoveries=[];
    if (!this.discoveryClaims) this.discoveryClaims = new Map();
    const token = this.clientToken(client), claims = this.discoveryClaims.get(token) || new Set();
    const claimKey=s.type==='fishing_pool'?s.id+':'+Math.floor(Date.now()/DAY_MS):s.id;
    if ((s.type==='fishing_pool'?claims.has(claimKey):rec.prof.claimedDiscoveries.includes(s.id))) return client.send('discoveryReject', { reason: s.type==='fishing_pool'?'cooldown':'claimed' });
    if(s.type==='fishing_pool'){claims.add(claimKey);this.discoveryClaims.set(token,claims);}else{rec.prof.claimedDiscoveries.push(s.id);this.dirtyPlayers.add(rec.token);}
    const ring = dangerRingAt(s.x, s.z), regional = BIOME_COLLECTIBLE[W.biomeAt(s.x, s.z)];
    let name = 'Small Discovery', text = '', xp = 5, items = [];
    if (s.type === 'rare_plant') {
      name = 'Rare Plant'; text = 'A wild specimen found far from cultivated ground.';
      if (regional) items.push({ id: regional.item, count: 2 + ring });
    } else if (s.type === 'fishing_pool') {
      name = 'Hidden Fishing Pool'; text = 'Silverfins flash beneath the still water.'; xp = 4 + ring * 2;
      items.push({ id: I.RIVER_FISH, count: 2 + ring });
    } else if (s.type === 'lore_tablet') {
      const lore = [
        'The first hunters followed lanterns home before the walls had names.',
        'Airships once crossed the western dark in fleets. Only their bells returned.',
        'The old road builders marked safe water with three stones and a north-facing flame.',
        'Something beneath the Dreadwild learned to imitate the sound of a gate opening.',
      ];
      name = 'Lore Tablet'; text = lore[Math.floor(W.hash2(s.x, s.z) * lore.length)]; xp = 12 + ring * 4;
      if (regional) items.push({ id: regional.item, count: 1 });
    } else if (s.type === 'buried_chest') {
      name = 'Buried Cache'; text = 'You recover the cache before the wilds swallow it.'; xp = 8 + ring * 3;
      items.push({ id: ring >= 2 ? I.IRON_INGOT : I.COAL, count: 2 + ring });
      this.progressRegionalContract(client, 'recover_buried_cache', { targetId: s.id });
    } else {
      name = 'Odd-Flame Shrine'; text = 'The mismatched flame sinks. A hidden compartment opens.'; xp = 15 + ring * 5;
      items.push({ id: ring >= 2 ? I.DIAMOND : I.IRON_INGOT, count: 1 + Math.max(0, ring - 1) });
      this.progressRegionalContract(client, 'solve_puzzle_shrine', { targetId: s.id });
    }
    this.awardGrant(client, { source: 'discovery', discovery: s.type, xp, items });
    client.send('discoveryResult', { id: s.id, type: s.type, name, text, xp, items });
  }
  awardGrant(client, grant) {
    const rec = this.profileFor(client);
    if (rec) {
      this.grantHunterXp(rec.prof, grant.xp, client, grant.source || 'grant');
      const delivered=[];
      for (const item of grant.items || []) {
        const rewardItem=item&&item.gear?{...item,source:item.source||grant.source||'grant'}:item;
        const left=rewardItem&&rewardItem.gear?this.addGearRewardItem(rec.prof,rewardItem):this.addRewardItem(rec.prof,rewardItem.id,rewardItem.count);
        if(!rewardItem.gear||!left)delivered.push(rewardItem&&rewardItem.gear?{...rewardItem,locked:!!(rewardItem.locked||rewardItem.rarity==='mythic')}:rewardItem);
        else {
          const recovered=this.queueGearRecovery(rec.prof,rewardItem,grant.source||'grant');
          if(recovered)client.send('lootRecoveryState',{items:rec.prof.lootRecovery,queued:recovered});
        }
        if (item && item.id) this.progressRegionalContract(client, 'collect_biome', { itemId: item.id | 0, count: Math.max(1, item.count | 0) });
      }
      grant={...grant,items:delivered};
      this.syncPlayerProfile(client, rec.prof);
      this.dirtyPlayers.add(rec.token);
    }
    client.send('grant', grant);
  }
  equippedTool(prof, slot) {
    const i = Math.max(0, Math.min(35, slot | 0));
    const s = prof && Array.isArray(prof.inv) ? prof.inv[i] : null;
    const info = s ? TOOL_INFO[s.id] || null : null;
    return info ? { index: i, slot: s, ...info } : null;
  }
  canMineDrop(prof, blockId, slot) {
    const req = MINE_REQUIRE[blockId];
    if (!req) return true;
    if (req.tier <= 0) return true;
    const tool = this.equippedTool(prof, slot);
    return !!(tool && tool.cls === req.cls && tool.tier >= req.tier);
  }
  damageTool(client, rec, slot, blockId) {
    const req = MINE_REQUIRE[blockId];
    if (!req || !rec) return;
    const tool = this.equippedTool(rec.prof, slot);
    if (!tool || tool.cls !== req.cls) return;
    if (tool.slot.dur == null) tool.slot.dur = this.toolMaxDur(tool.slot, tool);
    const minerLevel=rec.prof.job==='miner'?JOB_SYSTEM.jobLevelFromXp((rec.prof.jobXpByJob&&rec.prof.jobXpByJob.miner)||0):0;
    if (minerLevel>=JOB_SYSTEM.MINER_RULES.stonehandLevel && Math.random() < JOB_SYSTEM.MINER_RULES.durabilitySaveChance) {
      client.send('toolSync', { slot: tool.index, item: { id: tool.slot.id, count: tool.slot.count || 1, dur: tool.slot.dur, plus: this.toolPlus(tool.slot),rarity:tool.slot.rarity||'',forge:tool.slot.forge||'',masterwork:!!tool.slot.masterwork,locked:!!tool.slot.locked }, spared: true });
      return;
    }
    tool.slot.dur--;
    if (tool.slot.dur <= 0) {
      rec.prof.inv[tool.index] = null;
      client.send('toolSync', { slot: tool.index, item: null, broke: true });
    } else {
      client.send('toolSync', { slot: tool.index, item: { id: tool.slot.id, count: tool.slot.count || 1, dur: tool.slot.dur, plus: this.toolPlus(tool.slot),rarity:tool.slot.rarity||'',forge:tool.slot.forge||'',masterwork:!!tool.slot.masterwork,locked:!!tool.slot.locked } });
    }
    this.dirtyPlayers.add(rec.token);
  }
  setWorldBlock(x, y, z, id) {
    if (id !== W.B.WHEAT_1 && id !== W.B.WHEAT_2 && id !== W.B.WHEAT_3) {
      const key = x + ',' + y + ',' + z;
      if (this.cropMeta) this.cropMeta.delete(key);
      if (this.worldProgress && this.worldProgress.cropKinds && this.worldProgress.cropKinds[key]) {
        delete this.worldProgress.cropKinds[key];
        this.dirtyWorldProgress = true;
      }
    }
    this.world.setB(x, y, z, id);
    this.state.edits.set(x + ',' + y + ',' + z, id);
    this.dirtyWorld = true;
  }
  handleFarm(client, m) {
    const p = this.state.players.get(client.sessionId);
    const rec = this.profileFor(client);
    if (!p || !rec || !m || p.dgn) return client.send('farmReject', { reason: 'invalid' });
    if (!this.cropMeta) this.cropMeta = new Map();
    if (!this.worldProgress.cropKinds) this.worldProgress.cropKinds = {};
    if (this.rateLimited(client, 'farm', 10, 20)) return client.send('farmReject', { reason: 'rate' });
    const action = String(m.action || '');
    const x = m.x | 0, y = m.y | 0, z = m.z | 0;
    const slot = Math.max(0, Math.min(35, m.slot | 0));
    const farmerLevel = rec.prof.job === 'farmer' ? JOB_SYSTEM.jobLevelFromXp((rec.prof.jobXpByJob && rec.prof.jobXpByJob.farmer) || 0) : 0;
    const farmerRules = JOB_SYSTEM.FARMER_RULES;
    if (!W.inWorld(x, y, z)) return client.send('farmReject', { reason: 'bounds' });
    if (Math.hypot(x + .5 - p.x, z + .5 - p.z) > 8) return client.send('farmReject', { reason: 'range' });
    if (W.isLavaBorderLand(x, z)) return client.send('farmReject', { reason: 'protected' });
    if (this.isTownProtected(x, z) || this.isLandOwnedByOther(client, x, z)) return client.send('farmReject', { reason: 'protected' });
    const id = this.world.getB(x, y, z);
    if (action === 'till') {
      const tool = this.equippedTool(rec.prof, slot);
      if (!tool || tool.cls !== 'hoe') return client.send('farmReject', { reason: 'hoe' });
      if (id !== W.B.GRASS && id !== W.B.DIRT) return client.send('farmReject', { reason: 'soil' });
      if (this.world.getB(x, y + 1, z) !== W.B.AIR) return client.send('farmReject', { reason: 'blocked' });
      this.setWorldBlock(x, y, z, W.B.FARMLAND);
      this.damageTool(client, rec, slot, W.B.FARMLAND);
      this.recordFarmProgress(client, action);
      return client.send('farmResult', { action, x, y, z, slot });
    }
    if (action === 'plant') {
      if (id !== W.B.AIR || this.world.getB(x, y - 1, z) !== W.B.FARMLAND) return client.send('farmReject', { reason: 'soil' });
      const seedId = rec.prof.inv[slot] && (rec.prof.inv[slot].id | 0);
      const windseed = seedId === I.WINDSEED;
      if (windseed && farmerLevel < farmerRules.windseedLevel) return client.send('farmReject', { reason: 'farmer_level', level: farmerRules.windseedLevel });
      if (!windseed && seedId !== I.WHEAT_SEEDS) return client.send('farmReject', { reason: 'seeds' });
      if (!this.consumeSlotItem(rec.prof, slot, seedId, 1)) return client.send('farmReject', { reason: 'seeds' });
      this.dirtyPlayers.add(rec.token);
      this.setWorldBlock(x, y, z, W.B.WHEAT_1);
      const key = x + ',' + y + ',' + z;
      const kind = windseed ? 'windseed' : 'wheat';
      this.cropMeta.set(key, { kind, level: farmerLevel });
      if (!this.worldProgress.cropKinds) this.worldProgress.cropKinds = {};
      if (windseed) this.worldProgress.cropKinds[key] = kind;
      else delete this.worldProgress.cropKinds[key];
      this.dirtyWorldProgress = true;
      this.cropTimers.set(key, Date.now() + this.cropGrowMs(farmerLevel));
      this.recordFarmProgress(client, action);
      return client.send('farmResult', { action, x, y, z, slot, seedId, kind });
    }
    if (action === 'fertilize') {
      if (farmerLevel < farmerRules.fieldcraftLevel) return client.send('farmReject', { reason: 'farmer_level', level: farmerRules.fieldcraftLevel });
      if (id !== W.B.WHEAT_1 && id !== W.B.WHEAT_2) return client.send('farmReject', { reason: 'growing' });
      if (!this.consumeSlotItem(rec.prof, slot, I.COMPOST, 1)) return client.send('farmReject', { reason: 'compost' });
      this.dirtyPlayers.add(rec.token);
      const next = id === W.B.WHEAT_1 ? W.B.WHEAT_2 : W.B.WHEAT_3;
      this.setWorldBlock(x, y, z, next);
      const key = x + ',' + y + ',' + z;
      if (next === W.B.WHEAT_3) this.cropTimers.delete(key);
      else this.cropTimers.set(key, Date.now() + this.cropGrowMs(farmerLevel));
      this.grantJobXp(client, 'farmer', 2);
      return client.send('farmResult', { action, x, y, z, slot, id: next });
    }
    if (action === 'harvest') {
      if (id !== W.B.WHEAT_3) return client.send('farmReject', { reason: 'ripe' });
      const key = x + ',' + y + ',' + z;
      this.cropTimers.delete(key);
      const meta = this.cropMeta.get(key) || { kind: (this.worldProgress.cropKinds || {})[key] || 'wheat', level: farmerLevel };
      this.setWorldBlock(x, y, z, W.B.AIR);
      const wheat = 1 + (Math.random() < jobPerkChance(rec.prof, 'farmer', 0.10) ? 1 : 0);
      const rich = meta.kind === 'windseed';
      const golden = rich && farmerLevel >= farmerRules.goldenHarvestLevel && Math.random() < farmerRules.goldenWheatChance;
      const items = [{ id: I.WHEAT, count: wheat + (rich ? 1 : 0) }, { id: rich ? I.WINDSEED : I.WHEAT_SEEDS, count: 1 + ((Math.random() * (rich ? 2 : 3)) | 0) }];
      if (golden) items.push({ id: I.GOLDEN_WHEAT, count: 1 });
      this.awardGrant(client, { source: 'farm', xp: rich ? 2 : 1, items });
      this.recordFarmProgress(client, action);
      return client.send('farmResult', { action, x, y, z, slot, kind: meta.kind, bonus: wheat > 1, golden });
    }
    client.send('farmReject', { reason: 'invalid' });
  }
  // rain (and storms) water the fields: crops advance twice as fast until the skies clear
  cropGrowMs(farmerLevel = 0) {
    let mult = this.state && this.state.weather && this.state.weather !== 'clear' ? .5 : 1;
    if (farmerLevel >= JOB_SYSTEM.FARMER_RULES.goldenHarvestLevel) mult *= JOB_SYSTEM.FARMER_RULES.goldenGrowthMultiplier;
    else if (farmerLevel >= JOB_SYSTEM.FARMER_RULES.fieldcraftLevel) mult *= JOB_SYSTEM.FARMER_RULES.fieldcraftGrowthMultiplier;
    return Math.round(CROP_GROW_MS * mult);
  }
  growCrops(dt) {
    this.cropGrowAcc = (this.cropGrowAcc || 0) + dt;
    if (this.cropGrowAcc < 1) return;
    this.cropGrowAcc = 0;
    if (!this.cropTimers) this.cropTimers = new Map();
    const now = Date.now();
    const growMs = this.cropGrowMs();
    const grow = [];
    this.state.edits.forEach((id, key) => {
      if (id !== W.B.WHEAT_1 && id !== W.B.WHEAT_2) return;
      const [x, y, z] = key.split(',').map(Number);
      if (this.world.getB(x, y - 1, z) !== W.B.FARMLAND) {
        this.cropTimers.delete(key);
        grow.push({ x, y, z, id: W.B.AIR });
        return;
      }
      let due = this.cropTimers.get(key);
      if (!due) {
        this.cropTimers.set(key, now + growMs);
        return;
      }
      if (due > now) return;
      const next = id === W.B.WHEAT_1 ? W.B.WHEAT_2 : W.B.WHEAT_3;
      const meta = this.cropMeta.get(key);
      if (next === W.B.WHEAT_3) this.cropTimers.delete(key);
      else this.cropTimers.set(key, now + this.cropGrowMs(meta && meta.level));
      grow.push({ x, y, z, id: next });
    });
    for (const g of grow.slice(0, 32)) this.setWorldBlock(g.x, g.y, g.z, g.id);
  }
  // dev-only inventory grant; gated behind DEV_CHEATS so production never honors it
  handleDevGive(client, text) {
    const dm = (t) => client.send('chat', { name: '[Dev]', text: t });
    if (!process.env.DEV_CHEATS) return dm('Cheats are off. Restart the server with DEV_CHEATS=1 to enable /give.');
    const parts = text.trim().split(/\s+/);            // ['/give','shard','5','2']
    const what = (parts[1] || '').toLowerCase();
    const clampCount = (raw, max) => Math.max(1, Math.min(max, parts[raw] ? (parseInt(parts[raw], 10) || 1) : 1));
    if (what === 'shard') {
      const names = ['minor', 'major', 'glimmering', 'effervescent', 'radiant'];
      let tier = parseInt(parts[2], 10);
      if (!(tier >= 1 && tier <= 5)) { const ni = names.indexOf((parts[2] || '').toLowerCase()); tier = ni >= 0 ? ni + 1 : 5; }
      const count = clampCount(3, 16);
      const t = SHARD_TIERS[tier - 1];
      this.awardGrant(client, { source: 'dev', items: [{ id: SHARD_ITEM_IDS[tier - 1], count }] });
      return dm('Granted ' + count + 'x ' + t.name + ' Shard (+' + t.plus + '). Attune at the plaza pedestal.');
    }
    if (what === 'token') {
      const count = clampCount(2, 16);
      this.awardGrant(client, { source: 'dev', items: [{ id: I.LEGEND_TOKEN, count }] });
      return dm('Granted ' + count + 'x Legendary Weapon Token.');
    }
    if (what === 'armor') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.LEGEND_ARMOR, count: 1, armorType:'aegis',rarity:'mythic',gear:true }] });
      return dm('Granted Legendary Aegis Armor.');
    }
    if (what === 'staff' || what === 'blackhole') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.BLACKHOLE_STAFF, count: 1 }] });
      return dm('Granted Blackhole Staff.');
    }
    if (what === 'chrono' || what === 'dagger') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.CHRONO_DAGGER, count: 1 }] });
      return dm('Granted Chrono Dagger.');
    }
    if (what === 'titan' || what === 'hammer') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.TITAN_HAMMER, count: 1 }] });
      return dm('Granted Titan Hammer.');
    }
    if (what === 'meteor') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.METEOR_STAFF, count: 1 }] });
      return dm('Granted Meteor Staff.');
    }
    if (what === 'soul' || what === 'scythe') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.SOUL_REAPER_SCYTHE, count: 1 }] });
      return dm('Granted Soul Reaper Scythe.');
    }
    if (what === 'gravity' || what === 'bow') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.GRAVITY_BOW, count: 1 }] });
      return dm('Granted Gravity Bow.');
    }
    if (what === 'warden' || what === 'cleaver') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.WARDEN_CLEAVER, count: 1 }] });
      return dm('Granted Warden Cleaver.');
    }
    if (what === 'eclipse' || what === 'katana') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.ECLIPSE_KATANA, count: 1 }] });
      return dm('Granted Eclipse Katana.');
    }
    if (what === 'phoenix') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.PHOENIX_SWORD, count: 1 }] });
      return dm('Granted Phoenix Sword.');
    }
    if (what === 'frostbite' || what === 'chakram') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.FROSTBITE_CHAKRAM, count: 1 }] });
      return dm('Granted Frostbite Chakram.');
    }
    if (what === 'midas') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.MIDAS_BLADE, count: 1 }] });
      return dm('Granted Midas Blade.');
    }
    if (what === 'leviathan' || what === 'trident') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.LEVIATHAN_TRIDENT, count: 1 }] });
      return dm('Granted Leviathan Trident.');
    }
    if (what === 'anchor' || what === 'void') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.VOID_ANCHOR, count: 1 }] });
      return dm('Granted Void Anchor.');
    }
    if (what === 'egg' || what === 'dragon') {
      const type = DRAGON_TYPE_SET.has(parts[2]) ? parts[2] : 'ember';
      this.awardGrant(client, { source: 'dev', items: [{ id: DRAGON_EGG_OF(type), count: 1 }] });
      return dm('Granted ' + type + ' Dragon Egg.');
    }
    if (what === 'treat') {
      const count = Math.max(1, Math.min(64, parseInt(parts[2], 10) || 4));
      this.awardGrant(client, { source: 'dev', items: [{ id: I.DRAGON_TREAT, count }] });
      return dm('Granted ' + count + ' Dragon Treat.');
    }
    if (what === 'sigil') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.SHADOW_SIGIL, count: 1 }] });
      return dm('Granted Shadow Sigil.');
    }
    if (what === 'fang' || what === 'totem') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.FANG_TOTEM, count: 1 }] });
      return dm('Granted Fang Totem.');
    }
    if (what === 'mote' || what === 'charm') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.MOTE_CHARM, count: 1 }] });
      return dm('Granted Lifebloom Charm.');
    }
    if (what === 'sprite' || what === 'forage') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.FORAGE_CHARM, count: 1 }] });
      return dm("Granted Forager's Charm.");
    }
    if (what === 'insulator' || what === 'incubator') {
      const count = clampCount(2, 16);
      this.awardGrant(client, { source: 'dev', items: [{ id: W.B.EGG_INSULATOR, count }] });
      return dm('Granted ' + count + 'x Egg Insulator.');
    }
    if (what === 'xp') {
      const amount = Math.max(1, Math.min(5000000, parseInt(parts[2], 10) || 1000));
      this.awardGrant(client, { source: 'dev', xp: amount });
      const p = this.state.players.get(client.sessionId);
      const rec = this.profileFor(client);
      if (p && rec) p.lvl = rec.prof.S.lvl;            // mirror level into synced state
      return dm('Granted ' + amount + ' XP (now level ' + (rec ? rec.prof.S.lvl : '?') + ').');
    }
    if (what === 'vit') {
      const rec = this.profileFor(client);
      if (!rec) return dm('no profile');
      rec.prof.S.vit = Math.max(1, Math.min(500, parseInt(parts[2], 10) || 50));
      const hp = this.ensurePlayerHp(client);
      hp.hp = hp.max;
      this.syncPlayerProfile(client, rec.prof);
      this.dirtyPlayers.add(rec.token);
      return dm('Set vitality to ' + rec.prof.S.vit + ' (max HP ' + hp.max + ').');
    }
    if (what === 'mana') {
      const rec = this.profileFor(client);
      if (!rec) return dm('no profile');
      const want = Math.max(20, Math.min(999, parseInt(parts[2], 10) || 100));
      rec.prof.S.int = Math.max(1, Math.ceil((want - 20) / 3) + 1);   // raise INT to reach the requested max mana
      const st = this.regenAbilityState(client);                       // recomputes maxMp from the new INT
      st.mp = st.maxMp;
      this.sendAbilitySync(client, st);
      client.send('devMana', { mp: Math.floor(st.mp), maxMp: st.maxMp, int: rec.prof.S.int });
      this.dirtyPlayers.add(rec.token);
      return dm('Mana set to ' + Math.floor(st.maxMp) + ' (INT ' + rec.prof.S.int + ').');
    }
    return dm('Usage: /give shard [1-5|name] [count]  ·  token [count]  ·  xp [amount]  ·  vit [n]  ·  mana [n]');
  }

  freshMeta(x, z, dmg, speed, kind, rank, alert) {
    return {
      tx: x, tz: z, sx: x, sz: z,
      atkCd: 0, patrolT: 0, losT: Math.random() * .25,
      alert: !!alert, dmg, speed, rank: rank || 0,
      flank: (Math.random() < .5 ? -1 : 1) * (.5 + Math.random() * .7),
      strafe: Math.random() < .5 ? -1 : 1, strafeT: 2 + Math.random() * 2,
      drawT: 0, lungeT: 0, lunging: 0, ldx: 0, ldz: 0,
      arrowDmg: 2 + (rank || 0),
      // boss
      stateT: 0, gcd: 2.5, lastPat: '', cdx: 0, cdz: 0,
      spikeK: 0, spikeT: 0, chargedHit: null,
      sum1: false, sum2: false, enraged: false,
      slamDmg: 6 + (rank || 0) * 2,
    };
  }
  isAnimalKind(kind) {
    return ANIMAL_KINDS.has(String(kind || ''));
  }
  applyBiomeStatus(client,behavior){
    if(!client||!['frost','venom','sturdy'].includes(behavior))return;
    const now=Date.now(),kind=behavior==='sturdy'?'root':behavior,durationMs=kind==='root'?1100:kind==='frost'?4200:5000;
    let state=this.biomeStatuses.get(client.sessionId);if(!state)state={};
    state[kind+'Until']=Math.max(state[kind+'Until']||0,now+durationMs);
    if(kind==='venom')state.venomAcc=0;
    this.biomeStatuses.set(client.sessionId,state);
    client.send('biomeStatus',{kind,durationMs,counter:kind==='frost'?'Stop sprinting to preserve stamina':kind==='venom'?'Use food or finish the fight quickly':'Break line of sight while the roots fade'});
  }
  tickBiomeStatuses(dt){
    const now=Date.now();
    for(const [sid,state] of this.biomeStatuses){
      const client=this.clients.find(c=>c.sessionId===sid);
      if(!client){this.biomeStatuses.delete(sid);continue;}
      if((state.venomUntil||0)>now){state.venomAcc=(state.venomAcc||0)+dt;if(state.venomAcc>=1){state.venomAcc-=1;this.hurtPlayer(client,1,'mire_poison');}}
      if((state.venomUntil||0)<=now&&(state.frostUntil||0)<=now&&(state.rootUntil||0)<=now)this.biomeStatuses.delete(sid);
    }
  }

  // ---------------- simulation ----------------
  update(dt) {
    this.state.tod = dayTimeAt(this.dayEpoch, Date.now());
    this.tickWeather(Date.now());
    this.growCrops(dt);
    this.completeDragonIncubations();
    this.tickNestBreeding();
    this.tickFangCombat(Date.now());
    this.tickShadowSoldiers(Date.now(), dt);
    this.tickMote(dt);
    this.tickServerEvent(Date.now());
    this.tickSkyship(Date.now());
    const th = this.state.tod * Math.PI * 2;
    const sy = -Math.cos(th);
    const sunE = sy / Math.hypot(Math.sin(th), sy, .22);
    const dayF = sstep(-0.12, 0.20, sunE);
    const night = dayF < 0.18;

    const spaces = { '': [] };
    this.state.players.forEach((p, sid) => {
      const k = p.dgn || '';
      (spaces[k] = spaces[k] || []).push({ p, sid });
    });
    const surface = spaces[''];
    const abilityNow = Date.now();
    this.state.players.forEach((p, sid) => {
      const c = this.clients.find(c => c.sessionId === sid);
      if (c) this.regenAbilityState(c, abilityNow);
    });
    this.abilityBuffs.forEach((b, sid) => {
      if ((b.umbralUntil || 0) <= abilityNow && (b.ironUntil || 0) <= abilityNow && (b.mealMightUntil || 0) <= abilityNow && (b.mealGatherUntil || 0) <= abilityNow && (b.monkRegenUntil || 0) <= abilityNow && (b.monkSpeedUntil || 0) <= abilityNow && (b.monkStoneUntil || 0) <= abilityNow) this.abilityBuffs.delete(sid);
    });
    this.updatePlayerHunger(dt);
    this.tickBiomeStatuses(dt);

    if (dayF > 0.5) {
      const dead = [];
      this.state.mobs.forEach((m, id) => { const meta=this.mobMeta[id]; if (!m.dgn && !this.isAnimalKind(m.kind) && !(meta && (meta.campId || meta.discoveryNest || meta.bandit || meta.friendly||meta.dayActive))) dead.push(id); });
      for (const id of dead) { this.state.mobs.delete(id); delete this.mobMeta[id]; }
    }
    const surfaceClusters = this.surfaceDensityClusters(surface);
    this.cleanupFarOverworldMobs(surfaceClusters);
    this.maintainEliteCamps(dt, surfaceClusters);
    this.maintainDiscoveryNests(dt, surfaceClusters);
    if (dayF > .35) this.maintainBanditCamps(dt, surfaceClusters);
    else {
      const gone=[];this.state.mobs.forEach((m,id)=>{if(!m.dgn&&this.mobMeta[id]&&this.mobMeta[id].bandit)gone.push(id);});
      for(const id of gone){this.state.mobs.delete(id);delete this.mobMeta[id];}
    }
    this.tickRoadCaravans(dt, dayF > .35);
    this.tickLocalAnimalSpawns(dt, surfaceClusters);
    if (night) this.tickLocalHostileSpawns(dt, surfaceClusters,'night');
    else if(dayF>.5)this.tickLocalHostileSpawns(dt,surfaceClusters,'day');

    // ---- projectiles (3 substeps for dodgeable flight) ----
    this.stepProjectiles(dt, spaces);

    // ---- mob brains: overworld inline, each live dungeon via its instance.tick() ----
    const mobsByDgn = {};
    this.state.mobs.forEach((mm, mid) => { (mobsByDgn[mm.dgn || ''] = mobsByDgn[mm.dgn || ''] || []).push(mid); });
    for (const oid of mobsByDgn[''] || []) {
      const om = this.state.mobs.get(oid); if (!om) continue;
      const ometa = this.mobMeta[oid]; if (!ometa) continue;
      this.simulateMob(om, oid, ometa, dt, spaces);
    }
    // snapshot keys: a hazard wipe can delete the instance mid-iteration
    for (const gid of Object.keys(this.instances)) {
      const inst = this.instances[gid];
      if (inst) inst.tick(this, dt, spaces, mobsByDgn[gid] || []);
    }
    this.tickGateLifecycle(dt, surface);
  }

  // Server-authoritative player movement: anti-teleport step clamp + velocity cap (used for
  // skeleton lead). Shared by GameRoom and DungeonRoom so a player moves identically in either.
  handleMove(client, m) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !m) return;
    if (this.skyshipPassengers && this.skyshipPassengers.has(client.sessionId)) {
      p.yaw = clampN(m.yaw, -10, 10); this.pvel.set(client.sessionId, { x: 0, z: 0 }); return;
    }
    if (typeof this.eventMovementLocked === 'function' && this.eventMovementLocked(client.sessionId)) {
      p.yaw = clampN(m.yaw, -10, 10);
      this.pvel.set(client.sessionId, { x: 0, z: 0 });
      return;
    }
    const nx = clampN(m.x, 0, W.WX), ny = clampN(m.y, -20, W.WH + 10), nz = clampN(m.z, 0, W.WX);
    const now = Date.now();
    const last = this.lastMoveMsg.get(client.sessionId) || now;
    const dt = Math.max(0.05, Math.min(0.5, (now - last) / 1000));
    this.lastMoveMsg.set(client.sessionId, now);
    const dx = nx - p.x, dz = nz - p.z;
    const hd = Math.hypot(dx, dz);
    // mounted players move faster, so the anti-teleport clamp is loosened to match
    const mounted = !!p.mount;
    const rec=this.profileFor(client),armorStack=rec&&rec.prof&&rec.prof.armor,armorInfo=armorStack&&ARMOR_INFO[armorStack.id];
    const armorMove=!mounted&&armorInfo?GEAR_SYSTEM.armorProfile(armorInfo,armorStack).moveMultiplier:1;
    const maxStep = (mounted ? 20 : 12*armorMove) * dt + 1.25;
    const velCap = mounted ? 16 : 9*armorMove;
    let sx = hd > maxStep ? p.x + dx / hd * maxStep : nx;
    let sz = hd > maxStep ? p.z + dz / hd * maxStep : nz;
    const borderMin = W.LAVA_BORDER_WIDTH + 1.35;
    const borderMax = W.WX - W.LAVA_BORDER_WIDTH - 1.35;
    sx = clampN(sx, borderMin, borderMax);
    sz = clampN(sz, borderMin, borderMax);
    const dy = ny - p.y;
    const maxYStep = 18 * dt + 2.5;
    let sy = Math.abs(dy) > maxYStep ? p.y + Math.sign(dy) * maxYStep : ny;
    // No-clip guard: a destination that buries the player's body in solid blocks is
    // rejected, so nobody can camp inside terrain or under the map where melee, mobs,
    // and line-of-sight checks can't reach them. Two safety valves keep honest-but-
    // desynced clients from being pinned: a player who is ALREADY embedded (sand or a
    // rival's block dropped on them) may move freely to dig out, and after three
    // consecutive rejections a destination in valid air is accepted as a lag resync.
    // A buried destination is never accepted, no matter how often it is retried.
    if (!this.moveRejects) this.moveRejects = new Map();
    const solid = this.spaceSolid(p.dgn || '');
    const buried = (x, y, z) => solid(Math.floor(x), Math.floor(y + .2), Math.floor(z))
      || solid(Math.floor(x), Math.floor(y + 1.5), Math.floor(z));
    if (!buried(p.x, p.y, p.z) && buried(sx, sy, sz)) {
      const rejects = (this.moveRejects.get(client.sessionId) || 0) + 1;
      const rx = clampN(nx, borderMin, borderMax), rz = clampN(nz, borderMin, borderMax);
      if (rejects >= 3 && !buried(rx, ny, rz)) {
        this.moveRejects.delete(client.sessionId);
        sx = rx; sy = ny; sz = rz;
      } else {
        this.moveRejects.set(client.sessionId, rejects);
        this.pvel.set(client.sessionId, { x: 0, z: 0 });
        p.yaw = clampN(m.yaw, -10, 10);
        return;
      }
    } else this.moveRejects.delete(client.sessionId);
    this.pvel.set(client.sessionId, {
      x: Math.max(-velCap, Math.min(velCap, (sx - p.x) / dt)),
      z: Math.max(-velCap, Math.min(velCap, (sz - p.z) / dt)),
    });
    p.x = sx; p.y = sy; p.z = sz;
    p.yaw = clampN(m.yaw, -10, 10);
  }

  // Step all in-flight projectiles (ability fireballs, legendary meteors, skeleton/bolt arrows)
  // for one tick, 3 substeps each so they stay dodgeable. Every projectile is dgn-scoped, so this
  // runs identically for the overworld (GameRoom) and a single dungeon (DungeonRoom). `spaces`
  // maps dgn -> [{p,sid}] players, as built by the caller's update().
  stepProjectiles(dt, spaces) {
    for (let i = this.sFireballs.length - 1; i >= 0; i--) {
      const f = this.sFireballs[i];
      f.life -= dt;
      const solid = this.spaceSolid(f.dgn);
      let done = f.life <= 0;
      for (let s = 0; s < 3 && !done; s++) {
        f.x += f.vx * dt / 3; f.y += f.vy * dt / 3; f.z += f.vz * dt / 3;
        if (solid(Math.floor(f.x), Math.floor(f.y), Math.floor(f.z))) { done = true; break; }
        this.state.mobs.forEach(m => {
          if (done || (m.dgn || '') !== (f.dgn || '') || m.hp <= 0) return;
          const hitR = m.kind === 'boss' ? 1.35 : .72;
          if (Math.hypot(m.x - f.x, (m.y + 1) - f.y, m.z - f.z) < hitR) done = true;
        });
      }
      if (done) {
        this.explodeAbilityFireball(f);
        this.sFireballs.splice(i, 1);
      }
    }
    for (let i = this.sMeteors.length - 1; i >= 0; i--) {
      const mt = this.sMeteors[i];
      mt.t -= dt;
      const target = this.state.mobs.get(mt.id);
      if (target && target.hp > 0 && (target.dgn || '') === (mt.dgn || '')) {
        mt.x = target.x; mt.y = target.y; mt.z = target.z;
      }
      if (mt.t > 0) continue;
      const caster = this.clients.find(c => c.sessionId === mt.caster);
      if (caster) {
        this.damageMobsInRadius(caster, mt.x, mt.y + 1, mt.z, mt.radius, mt.damage, { knock: 3.8, stun: .55 });
        this.breakBlocksInRadius(caster, mt.x, mt.y + .4, mt.z, 2.4, 14);
      }
      this.sendSpace(mt.dgn || '', 'fx', { t: 'legendary', kind: 'meteorImpact', x: mt.x, y: mt.y, z: mt.z, dgn: mt.dgn || '' });
      this.sMeteors.splice(i, 1);
    }
    for (let i = this.sArrows.length - 1; i >= 0; i--) {
      const a = this.sArrows[i];
      a.life -= dt;
      if (a.life <= 0) { this.sArrows.splice(i, 1); continue; }
      const solid = this.spaceSolid(a.dgn);
      const targets = spaces[a.dgn] || [];
      let done = false;
      for (let s = 0; s < 3 && !done; s++) {
        const r = AI.arrowStep(a, dt / 3, solid, targets);
        if (r === 'block') done = true;
        else if (r !== 'fly') {
          const c = this.clients.find(c => c.sessionId === r.hit.sid);
          const target = this.state.players.get(r.hit.sid);
          if (c && (a.dgn || !target || !this.isTownProtected(target.x, target.z))){this.hurtPlayer(c,a.dmg,a.effect?a.effect+'_arrow':'arrow');if(a.effect)this.applyBiomeStatus(c,a.effect);}
          done = true;
        }
      }
      if (done) this.sArrows.splice(i, 1);
    }
  }

  // Per-mob AI brain for one mob (overworld or dungeon). Extracted verbatim from the update()
  // loop so a DungeonInstance can drive its own mobs through the same code path; behaviour is
  // unchanged. `spaces` maps dgn -> [{p,sid}] players, as built in update().
  simulateMob(m, id, meta, dt, spaces) {
      const inst = m.dgn ? this.instances[m.dgn] : null;
      if (m.dgn && !inst) return;
      const ground = (x, z, fromY) => inst ? D.standHeightIn(inst.world, x, z, fromY) : this.world.standHeight(x, z, fromY);
      const solid = this.spaceSolid(m.dgn);
      const candidates = spaces[m.dgn || ''] || [];
      meta.atkCd -= dt;
      // Frenzied shard affix: wounded dungeon trash gains attack and move speed
      const frenzied = inst && inst.shardModSet && inst.shardModSet.has('Frenzied') &&
        m.kind !== 'boss' && m.hp <= m.maxHp * 0.3;
      const frenzyMove = frenzied ? 1.4 : 1;
      const frenzyDmg = frenzied ? 1.35 : 1;
      meta.slowT = Math.max(0, (meta.slowT || 0) - dt);
      meta.weaponStaggerT=Math.max(0,(meta.weaponStaggerT||0)-dt);
      const weaponStaggerMove=meta.weaponStaggerT>0&&m.kind==='boss'?GEAR_SYSTEM.WEAPON_IDENTITY.stagger.bossMoveMultiplier:1;
      const slowMove = (meta.slowT > 0 ? .4 : 1)*weaponStaggerMove;
      if (meta.slowT > 0 && !meta.blackhole && m.state !== 'stun') m.state = 'frozen';
      else if (m.state === 'frozen') m.state = 'chase';

      if (meta.blackhole) {
        const bh = meta.blackhole;
        bh.t += dt;
        const u = Math.min(1, bh.t / bh.total);
        const swirl = u * Math.PI * 8;
        const r = Math.max(0, (1 - u) * .95);
        m.x = bh.cx + Math.cos(swirl) * r;
        m.z = bh.cz + Math.sin(swirl) * r;
        m.y = bh.sy + (bh.cy - bh.sy) * Math.sin(u * Math.PI * .85);
        m.yaw += dt * 10;
        m.state = 'blackhole';
        if (u >= 1) {
          const caster = this.clients.find(c => c.sessionId === bh.caster);
          if (m.kind === 'boss' && m.dgn && caster) this.recordBossContribution(caster, m.dgn, bh.damage);
          m.hp -= bh.damage;
          this.sendSpace(m.dgn || '', 'fx', { t: 'blackholePop', x: bh.cx, y: bh.cy, z: bh.cz, dgn: m.dgn || '' });
          if (m.hp <= 0) this.finishMobKill(caster, id, m);
          else { delete meta.blackhole; m.state = 'stun'; meta.stateT = 1.2; }
        }
        return;
      }
      if (m.state === 'stun') {
        meta.stateT = Math.max(0, (meta.stateT || 0) - dt);
        if (meta.stateT <= 0) m.state = meta.slowT > 0 ? 'frozen' : 'chase';
        return;
      }

      // Friendly replicated encounter actors are positioned by their owning
      // road system and must never acquire or attack a player target.
      if (meta.friendly) return;

      let best = null, bd = meta.scout ? 42 : 26;
      for (const s of candidates) {
        // The Town of Beginnings is a hard sanctuary for overworld hostiles.
        if (!m.dgn && !this.isAnimalKind(m.kind) && this.isTownProtected(s.p.x, s.p.z)) continue;
        const d = Math.hypot(s.p.x - m.x, s.p.z - m.z);
        if (d < bd && mobTargetInRange(m.kind, m.y, s.p.y, d)) { bd = d; best = s; }
      }

      if (this.isAnimalKind(m.kind)) {
        const animalBase = ANIMAL_BASE_KIND[m.kind] || m.kind;
        let tx = meta.tx, tz = meta.tz, moveMul = .55;
        if (best && bd < (animalBase === 'rabbit' ? 9 : 7)) {
          const dx = m.x - best.p.x, dz = m.z - best.p.z, len = Math.hypot(dx, dz) || 1;
          tx = m.x + dx / len * 9;
          tz = m.z + dz / len * 9;
          moveMul = animalBase === 'boar' ? 1.15 : 1.6;
          m.state = 'flee';
        } else {
          meta.patrolT -= dt;
          if (meta.patrolT <= 0) {
            meta.patrolT = 2.5 + Math.random() * 4;
            meta.tx = meta.sx + (Math.random() * 2 - 1) * 10;
            meta.tz = meta.sz + (Math.random() * 2 - 1) * 10;
          }
          tx = meta.tx; tz = meta.tz; m.state = '';
        }
        const dx = tx - m.x, dz = tz - m.z, dist = Math.hypot(dx, dz);
        if (dist > .15) {
          const step = meta.speed * moveMul * dt;
          const nx = m.x + dx / dist * step, nz = m.z + dz / dist * step;
          const gy = ground(nx, nz, m.y + 2);
          if (gy > 0 && gy - m.y <= 1.2 && !solid(Math.floor(nx), Math.floor(gy), Math.floor(nz))) {
            m.x = nx; m.y = gy; m.z = nz;
            m.yaw = Math.atan2(dx, dz);
          }
        }
        return;
      }

      if (m.kind === 'boss') {
        if (this.bossBrain(m, id, meta, dt, best, bd, candidates, ground, solid)) return;
      }

      // ---- senses: dungeon trash sleeps until it sees someone ----
      let tx = meta.tx, tz = meta.tz, moveMul = 1, rooted = false;
      if (m.kind !== 'boss') {
        if (m.dgn && !meta.alert) {
          meta.losT -= dt;
          if (meta.losT <= 0) {
            meta.losT = .25;
            if (best && (bd < 7 ||
                (bd < 20 && AI.losClear(solid, m.x, m.y + 1.4, m.z, best.p.x, best.p.y + 1.4, best.p.z))))
              this.alertPack(id);
          }
          if (!meta.alert) {
            meta.patrolT -= dt;
            if (meta.patrolT <= 0) {
              meta.patrolT = 2.5 + Math.random() * 3;
              meta.tx = meta.sx + (Math.random() * 2 - 1) * 4;
              meta.tz = meta.sz + (Math.random() * 2 - 1) * 4;
            }
            tx = meta.tx; tz = meta.tz; moveMul = .4;
            m.state = '';
          }
        } else if (!m.dgn && meta.bandit) {
          if (meta.surrendered) { m.state='surrender'; return; }
          meta.ralliedT=Math.max(0,(meta.ralliedT||0)-dt);
          if (meta.banditCaptain && best) {
            meta.commandT=(meta.commandT||0)-dt;
            if(meta.commandT<=0){meta.commandT=6;meta.rallyT=.8;this.state.mobs.forEach((o,oid)=>{const om=this.mobMeta[oid];if(om&&om.banditCampId===meta.banditCampId&&!om.surrendered){om.alert=true;om.ralliedT=5;if(m.hp<m.maxHp*.3&&!om.banditCaptain)om.retreating=true;}});}
            if(meta.rallyT>0){meta.rallyT-=dt;m.state='rally';rooted=true;}
            else if(meta.cleaveT>0){meta.cleaveT-=dt;m.state='captainCleave';rooted=true;if(meta.cleaveT<=0){m.state='';this.sendSpace('', 'fx',{t:'banditCleave',x:m.x,y:m.y,z:m.z,dgn:''});for(const target of candidates){if(Math.hypot(target.p.x-m.x,target.p.z-m.z)<=4.2&&Math.abs(target.p.y-m.y)<2.5){const c=this.clients.find(c=>c.sessionId===target.sid);if(c)this.hurtPlayer(c,Math.round(meta.dmg*1.15),'bandit_captain');}}}}
            else if(meta.alert&&bd<4.2&&meta.atkCd<=0){meta.cleaveT=.9;meta.atkCd=4;m.state='captainCleave';rooted=true;}
          }
          if (meta.banditPatrol && !meta.banditCaptain && m.hp <= m.maxHp * .3) {
            meta.retreating = true; meta.alert = false; meta.tx = meta.sx; meta.tz = meta.sz;
          }
          if (best && !meta.retreating && !meta.alert) this.alertPack(id);
          if (!best || meta.retreating) {
            if (meta.retreating) {
              tx = meta.sx; tz = meta.sz; moveMul = 1.15; m.state = 'retreat';
            } else if (meta.banditPatrol && meta.patrolRoute && meta.patrolRoute.length) {
              const point = meta.patrolRoute[meta.patrolStep % meta.patrolRoute.length];
              if (Math.hypot(m.x - point.x, m.z - point.z) < 4) meta.patrolStep = (meta.patrolStep + 1) % meta.patrolRoute.length;
              const next = meta.patrolRoute[meta.patrolStep % meta.patrolRoute.length], side = meta.formationSide || 0;
              tx = next.x + side * 1.5; tz = next.z - side * 1.5; moveMul = .75; m.state = 'patrol';
            } else {
              meta.patrolT -= dt;
              if (meta.patrolT <= 0) {
              meta.patrolT = 5 + Math.random() * 4;
              const angle = Math.random() * Math.PI * 2, radius = 12 + Math.random() * 12;
              meta.tx = meta.sx + Math.cos(angle) * radius; meta.tz = meta.sz + Math.sin(angle) * radius;
              }
              tx = meta.tx; tz = meta.tz; moveMul = .65; m.state = '';
            }
          }
        } else if (!m.dgn) meta.alert = true;                // the overworld horde hunts

        if (meta.alert && best && !rooted) {
          if (meta.brute && ((meta.bruteT||0)>0 || (bd<3.8&&meta.atkCd<=0))) {
            if(!(meta.bruteT>0)){meta.bruteT=1.05;meta.atkCd=4.5;}meta.bruteT-=dt;m.state='bruteWind';rooted=true;
            if(meta.bruteT<=0){m.state='';this.sendSpace(m.dgn||'','fx',{t:'biomeSlam',x:m.x,y:m.y,z:m.z,effect:'brute',dgn:m.dgn||''});for(const target of candidates){if(Math.hypot(target.p.x-m.x,target.p.z-m.z)<3.8){const c=this.clients.find(c=>c.sessionId===target.sid);if(c)this.hurtPlayer(c,Math.round(meta.dmg*1.35),meta.biomeBehavior||'brute');}}}
          } else if (RANGED_ENEMY_KINDS.has(m.kind)) {
            if (meta.drawT > 0) {
              meta.drawT -= dt;
              m.state = 'draw';
              m.yaw = Math.atan2(best.p.x - m.x, best.p.z - m.z);
              rooted = true;
              if (meta.drawT <= 0) {
                m.state = '';
                const v = this.pvel.get(best.sid) || { x: 0, z: 0 };
                const lead = bd / 16 * .5;
                this.fireArrow(m, m.dgn, best.p.x + v.x * lead, best.p.y + 1.4, best.p.z + v.z * lead, meta.arrowDmg*(meta.ralliedT>0?1.25:1), false,meta.biomeBehavior||'');
                meta.shootCd = meta.quickShot ? .95+Math.random()*.45 : 1.8+Math.random()*.8;
              }
            } else {
              meta.shootCd = (meta.shootCd || 1) - dt;
              meta.strafeT -= dt;
              if (meta.strafeT <= 0) { meta.strafeT = 2 + Math.random() * 2.5; meta.strafe *= -1; }
              if (bd < 6.5) { tx = m.x - (best.p.x - m.x) / bd * 8; tz = m.z - (best.p.z - m.z) / bd * 8; }
              else if (bd > 14) { tx = best.p.x; tz = best.p.z; }
              else {
                const px2 = -(best.p.z - m.z) / (bd || 1), pz2 = (best.p.x - m.x) / (bd || 1);
                tx = m.x + px2 * meta.strafe * 3; tz = m.z + pz2 * meta.strafe * 3;
                moveMul = .6;
              }
              if (bd > 4 && bd < 18 && meta.shootCd <= 0 &&
                  AI.losClear(solid, m.x, m.y + 1.4, m.z, best.p.x, best.p.y + 1.2, best.p.z))
                meta.drawT = meta.quickShot ? .3 : .5;
            }
          } else {                                           // zombie
            if (meta.lungeT > 0) {
              meta.lungeT -= dt;
              m.state = meta.biomeBehavior==='flanker'?'packWind':'windup';
              rooted = true;
              if (meta.lungeT <= 0) {
                meta.lunging = .45;
                meta.ldx = (best.p.x - m.x) / (bd || 1);
                meta.ldz = (best.p.z - m.z) / (bd || 1);
                m.state = '';
              }
            } else if (meta.lunging > 0) {
              meta.lunging -= dt;
              tx = m.x + meta.ldx * 4; tz = m.z + meta.ldz * 4;
              moveMul = 2.6;
              if (bd < 1.5 && Math.abs(best.p.y - m.y) < 2.1 && meta.atkCd <= 0) {
                meta.atkCd = 1.1;
                const c = this.clients.find(c => c.sessionId === best.sid);
                if (c){this.hurtPlayer(c,Math.round(meta.dmg*frenzyDmg*(meta.ralliedT>0?1.25:1)),meta.biomeBehavior||'combat');if(meta.biomeBehavior)this.applyBiomeStatus(c,meta.biomeBehavior);}
                meta.lunging = 0;
              }
            } else {
              const dxp = best.p.x - m.x, dzp = best.p.z - m.z;
              const px2 = -dzp / (bd || 1), pz2 = dxp / (bd || 1);
              const off = meta.flank * Math.min(3, bd * .4);
              tx = best.p.x + px2 * off; tz = best.p.z + pz2 * off;
              if (bd < 2.4 && Math.abs(best.p.y - m.y) < 2.6 && meta.atkCd <= 0 &&
                  AI.losClear(solid, m.x, m.y + 1.2, m.z, best.p.x, best.p.y + 1.2, best.p.z)){
                meta.lungeT = meta.biomeBehavior==='flanker'?.45:.35;
                if(meta.biomeBehavior==='flanker')this.state.mobs.forEach((ally,aid)=>{const am=this.mobMeta[aid];if(aid!==id&&am&&am.biomeBehavior==='flanker'&&Math.hypot(ally.x-m.x,ally.z-m.z)<7&&!(am.lungeT>0)&&!(am.lunging>0))am.lungeT=.52;});
              }
            }
          }
        } else if (meta.alert && !best && !m.dgn) {
          // overworld: nobody near, wander
          meta.patrolT -= dt;
          if (meta.patrolT <= 0) {
            meta.patrolT = 2 + Math.random() * 3;
            meta.tx = m.x + (Math.random() * 2 - 1) * 12;
            meta.tz = m.z + (Math.random() * 2 - 1) * 12;
          }
          tx = meta.tx; tz = meta.tz; moveMul = .6;
        }
      } else {
        // boss in 'chase': pursue
        if (best) { tx = best.p.x; tz = best.p.z; moveMul = 1.25; }
        if (best && bd < 2.2 && Math.abs(best.p.y - m.y) < 2.4 && meta.atkCd <= 0) {
          meta.atkCd = 1.2;
          const c = this.clients.find(c => c.sessionId === best.sid);
          if (c) this.hurtPlayer(c, meta.dmg);
        }
      }

      // separation: spread the pack
      if (meta.alert && m.kind !== 'boss') {
        this.state.mobs.forEach((o, oid) => {
          if (oid === id || (o.dgn || '') !== (m.dgn || '')) return;
          const sx3 = m.x - o.x, sz3 = m.z - o.z;
          const sd = Math.hypot(sx3, sz3);
          if (sd > .01 && sd < 1.2) { tx += sx3 / sd * .9; tz += sz3 / sd * .9; }
        });
      }

      // shared movement
      if (meta.slowT > 0 && !rooted && m.state !== 'stun' && m.state !== 'blackhole') m.state = 'frozen';
      const dx = tx - m.x, dz = tz - m.z, d = Math.hypot(dx, dz);
      if (!rooted && d > .12) {
        const spd = meta.speed * moveMul * frenzyMove * slowMove;
        let nx = m.x + dx / d * spd * dt, nz = m.z + dz / d * spd * dt;
        if (!m.dgn && !this.isAnimalKind(m.kind) && this.isTownProtected(nx, nz)) {
          const pad = W.TOWN.HS + 3;
          const ox = m.x - W.TOWN.TC, oz = m.z - W.TOWN.TC;
          if (Math.abs(ox) >= Math.abs(oz)) {
            nx = W.TOWN.TC + (ox < 0 ? -pad : pad);
            nz = m.z;
          } else {
            nx = m.x;
            nz = W.TOWN.TC + (oz < 0 ? -pad : pad);
          }
          meta.tx = nx;
          meta.tz = nz;
          meta.lungeT = 0;
          meta.lunging = 0;
          m.state = '';
        }
        let gy = ground(nx, nz, m.y + 1);
        if (!(gy > 0 && gy - m.y <= 1.05)) {
          gy = ground(nx, m.z, m.y + 1);
          if (gy > 0 && gy - m.y <= 1.05) nz = m.z;
          else { gy = ground(m.x, nz, m.y + 1); if (gy > 0 && gy - m.y <= 1.05) nx = m.x; else gy = -1; }
        }
        if (gy > 0) { m.x = nx; m.z = nz; m.y = gy; m.yaw = Math.atan2(dx, dz); }
        else if (!meta.alert) meta.patrolT = .5;
      }
  }

  // Gate expiry + public-gate spawning, lifted out of update() so the mob/instance dispatch
  // above reads cleanly. Runs once per tick on the overworld `surface` players.
  tickGateLifecycle(dt, surface) {
    const expiredGates = [];
    const nowMs = Date.now();
    this.gateTtls.forEach((expiresAt, id) => {
      if (expiresAt <= nowMs) expiredGates.push(id);
    });
    for (const id of expiredGates) this.expireGate(id);
    // Retire gates whose DungeonRoom (flag-gated switchRoom entry) has disposed —
    // the entry never routed through enterGate, so this is the only signal the
    // overworld gets that the gate has been spent. expireGate no-ops on ids that
    // were already TTL-expired or never existed here (public gates keyed by roomId).
    for (const id of drainConsumedGates()) this.expireGate(id);
    const publicRanks = new Set();
    this.state.gates.forEach(g => { if (g.active && g.kind === 'public') publicRanks.add(g.rank | 0); });
    if (surface.length && this.publicGateSpawningUnlocked(surface)) {
      const maxPublicRank = this.maxUnlockedPublicRank();
      this.gateTimer -= dt;
      if (this.gateTimer <= 0) {
        const spawned = this.spawnMissingPublicGates(maxPublicRank, publicRanks);
        this.gateTimer = spawned ? 12 : 20;
      }
    }
  }

}

const applyMixin = require('./mixin');
applyMixin(GameRoom, require('./events.mixin'));
applyMixin(GameRoom, require('./progression.mixin'));
applyMixin(GameRoom, require('./dragons.mixin'));
applyMixin(GameRoom, require('./economy.mixin'));
applyMixin(GameRoom, require('./dungeon.mixin'));
applyMixin(GameRoom, require('./spawning.mixin'));
applyMixin(GameRoom, require('./combat.mixin'));
applyMixin(GameRoom, require('./teams.mixin'));
applyMixin(GameRoom, require('./metrics.mixin'));


module.exports = {
  GameRoom, claimGlobalWorld, releaseGlobalWorld, skyshipSnapshot,
  SKYSHIP_DOCK_MS, SKYSHIP_TRAVEL_MS, SKYSHIP_AWAY_MS, SKYSHIP_CYCLE_MS,
  SKYSHIP_BOARD_RANK, SKYSHIP_BOARD_GOLD,
  DAY_MS, dayTimeAt, DANGER_RINGS, dangerRingAt, mobTargetInRange, townDistance,
};
