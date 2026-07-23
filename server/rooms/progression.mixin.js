const W = require('../world');
const JOB_SYSTEM = require('../../shared/job-system');
const GEAR_SYSTEM = require('../../shared/gear-system');
const NPC_QUEST_REGISTRY = require('../../shared/npc-quest-chains');
const { hunterXpForActivity } = require('./xp-economy');
const {
  ARMOR_INFO, I, JOB_IDS, TOOL_INFO, hunterActivityXpForLevel, jobLevelFromXp, jobPerkTier,
} = require('./constants');
const { sanitizeMeditationGrowth, meditationGrowthCapsForLevel } = require('../store');

const STAT_KEYS = new Set(['str', 'agi', 'vit', 'int']);
const PROFESSION_IDS = new Set(['', ...JOB_SYSTEM.PROFESSION_IDS]);
const JOB_XP_IDS = JOB_SYSTEM.JOB_IDS;
function ensureJobXpMap(prof) {
  if (!prof.jobXpByJob || typeof prof.jobXpByJob !== 'object') {
    prof.jobXpByJob = Object.fromEntries(JOB_XP_IDS.map(id => [id, 0]));
    prof.jobXpByJob[prof.job || 'adventurer'] = Math.max(0, prof.jobXp | 0);
  }
  for (const id of JOB_XP_IDS) prof.jobXpByJob[id] = Math.max(0, prof.jobXpByJob[id] | 0);
  prof.jobXp = prof.jobXpByJob[prof.job || 'adventurer'] | 0;
  return prof.jobXpByJob;
}

// One-time starter kit handed out when the first Adventurer contract graduates.
// Declared once so placement and the client manifest can't drift. `crafted` items
// take a slot each (no stacking); `dur` pins a worn-in durability on the pick.
const GRADUATION_REWARD = Object.freeze([
  Object.freeze({ id: I.IRON_SWORD, count: 1, crafted: true }),
  Object.freeze({ id: I.IRON_PICK, count: 1, crafted: true, dur: Math.max(1, Math.floor(TOOL_INFO[I.IRON_PICK].dur * .4)) }),
  Object.freeze({ id: I.IRON_INGOT, count: 8 }),
  Object.freeze({ id: I.REPAIR_KIT, count: 1 }),
]);
const PROGRESSION_MILESTONE_REWARDS = Object.freeze({
  first_e_gate: Object.freeze({
    title: 'First Dungeon Cleared',
    text: 'The E-rank Gate paid for your first workshop. Build a station before the next push.',
    modal: true,
    subtitle: 'FIRST E-RANK GATE PAYOFF',
    action: 'CRAFT FIRST STATION',
    items: Object.freeze([
      Object.freeze({ id: W.B.PLANKS, count: 8 }),
      Object.freeze({ id: W.B.COBBLE, count: 8 }),
      Object.freeze({ id: W.B.TORCH, count: 8 }),
    ]),
  }),
  craft_station: Object.freeze({
    title: 'Station Built',
    text: 'Your base can now grow into a workshop.',
    items: Object.freeze([Object.freeze({ id: W.B.TORCH, count: 8 }), Object.freeze({ id: I.BREAD, count: 2 })]),
  }),
  land_claim: Object.freeze({
    title: 'First Claim Secured',
    text: 'This land is yours: you can build here, untrusted hunters cannot edit it, and wilderness outside remains open.',
    modal: true,
    subtitle: 'YOUR FIRST PROTECTED BASE',
    action: 'PLACE STORAGE AND LIGHT',
    items: Object.freeze([Object.freeze({ id: W.B.CHEST, count: 1 }), Object.freeze({ id: W.B.TORCH, count: 8 })]),
  }),
  base_setup: Object.freeze({
    title: 'Base Established',
    text: 'Your protected base now has storage, light, and a working station. Take a contract when you are ready.',
    modal: true,
    subtitle: 'HOME BASE READY',
    action: 'TAKE FIRST CONTRACT',
    items: Object.freeze([Object.freeze({ id: I.REPAIR_KIT, count: 1 }), Object.freeze({ id: I.BREAD, count: 2 })]),
  }),
  first_contract: Object.freeze({
    title: 'Work Accepted',
    text: 'Pack a small lunch before heading into the field.',
    items: Object.freeze([Object.freeze({ id: I.BREAD, count: 2 })]),
  }),
});
const MEDITATION_CHALLENGES = Object.freeze([
  Object.freeze({ type: 'fill_gap', prompt: 'A variable stores a value that can ____ while a program runs.', answers: Object.freeze(['change', 'vary', 'be changed']), explanation: 'Variables are named storage for values that can change during a program.' }),
  Object.freeze({ type: 'fill_gap', prompt: 'In a sentence, a verb usually describes an ____.', answers: Object.freeze(['action']), explanation: 'Verbs often describe actions, states, or occurrences.' }),
  Object.freeze({ type: 'fill_gap', prompt: 'Plants use light energy to make ____ during photosynthesis.', answers: Object.freeze(['glucose', 'sugar']), explanation: 'Photosynthesis uses light energy to make glucose from carbon dioxide and water.' }),
  Object.freeze({ type: 'sort', prompt: 'Sort these steps into a simple algorithm order.', choices: Object.freeze(['Start', 'Input', 'Process', 'Output']), explanation: 'A basic algorithm begins, receives input, processes it, then produces output.' }),
  Object.freeze({ type: 'sort', prompt: 'Sort these numbers from smallest to largest.', choices: Object.freeze(['2', '5', '8', '13']), explanation: 'Ascending order goes from the smallest value to the largest.' }),
  Object.freeze({ type: 'sort', prompt: 'Sort the food chain from producer to predator.', choices: Object.freeze(['Grass', 'Rabbit', 'Fox', 'Wolf']), explanation: 'Energy passes from producer to herbivore and then to predators.' }),
]);
function cleanMeditationAnswer(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function meditationChallengeForClient(client) {
  const base = MEDITATION_CHALLENGES[Math.floor(Math.random() * MEDITATION_CHALLENGES.length)];
  const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  if (base.type === 'sort') {
    const ordered = base.choices.map((text, i) => ({ id: String.fromCharCode(97 + i), text }));
    const shuffled = ordered.slice().sort(() => Math.random() - .5);
    if (shuffled.every((c, i) => c.id === ordered[i].id)) shuffled.push(shuffled.shift());
    return { id, type: 'sort', prompt: base.prompt, choices: shuffled, correct: ordered.map(c => c.id), explanation: base.explanation };
  }
  return { id, type: 'fill_gap', prompt: base.prompt, answers: base.answers, explanation: base.explanation };
}
const PROFESSION_MILESTONE_STARTERS = Object.freeze({
  'blacksmith:2': Object.freeze({ title: 'Basic Reforge Supplies', text: 'Tobin sets aside iron for your first reforge. Try it on a sword, axe, or pick.', items: Object.freeze([Object.freeze({ id: I.IRON_INGOT, count: 1 })]) }),
  'farmer:5': Object.freeze({ title: 'Prairie Windseed Starter', text: 'Plant these in farmland to try Windseed Cultivation immediately.', items: Object.freeze([Object.freeze({ id: I.WINDSEED, count: 2 })]) }),
  'farmer:10': Object.freeze({ title: 'Fieldcraft Starter', text: 'Use Compost on young crops to feel the Fieldcraft speed-up right away.', items: Object.freeze([Object.freeze({ id: I.COMPOST, count: 2 })]) }),
  'cook:5': Object.freeze({ title: 'Golden Broth Sample', text: 'Taste the recovery meal you can now cook at Lv 5.', items: Object.freeze([Object.freeze({ id: I.GOLDEN_BROTH, count: 1 })]) }),
  'cook:10': Object.freeze({ title: 'Trail Ration Sample', text: 'Pack this before your next Gate to feel the new expedition food loop.', items: Object.freeze([Object.freeze({ id: I.TRAIL_RATION, count: 1 })]) }),
  'cook:20': Object.freeze({ title: 'Feast Platter Sample', text: 'Share this with nearby party members before a serious Gate pull.', items: Object.freeze([Object.freeze({ id: I.FEAST_PLATTER, count: 1 })]) }),
  'miner:20': Object.freeze({ title: 'Geode Mastery Sample', text: 'Crack this open at the forge loop so Geode Mastery has an immediate payoff.', items: Object.freeze([Object.freeze({ id: I.GEODE, count: 1 })]) }),
});
const HOMESTEAD_WORK_ORDER_SPECS = Object.freeze([
  Object.freeze({ type: 'stock', job: 'miner', target: W.B.COBBLE, need: 20, rewardGold: 24, rewardJobXp: 18, title: 'Foundation Stock', desc: 'Contribute cobblestone for repairs and future rooms.' }),
  Object.freeze({ type: 'stock', job: 'blacksmith', target: W.B.TORCH, need: 8, rewardGold: 20, rewardJobXp: 16, title: 'Lantern Reserve', desc: 'Keep spare torches ready so the homestead stays workable at night.' }),
  Object.freeze({ type: 'craft', job: 'cook', target: I.BREAD, need: 3, rewardGold: 22, rewardJobXp: 18, title: 'Pantry Ledger', desc: 'Set aside travel bread for the next dungeon run.' }),
  Object.freeze({ type: 'craft', job: 'blacksmith', target: I.REPAIR_KIT, need: 1, rewardGold: 30, rewardJobXp: 22, title: 'Tool Bench Reserve', desc: 'Add a repair kit to the homestead supplies.' }),
]);
const FIRST_TUTORIAL_CONTRACT_TYPE = Object.freeze({
  miner: 'mine',
  farmer: 'farm',
  cook: 'cook',
  blacksmith: 'smith',
  monk: 'meditate',
  pet_tamer: 'pet_care',
});
const FIRST_TUTORIAL_CONTRACT_NEED = Object.freeze({
  miner: 8,
  farmer: 3,
  cook: 1,
  blacksmith: 1,
  monk: 30,
  pet_tamer: 1,
});
const FIRST_TUTORIAL_CONTRACT_OVERRIDES = Object.freeze({
  miner: Object.freeze({
    title: 'First Quarry Shift',
    desc: 'Mine 8 useful blocks at the quarry or in a nearby cave, then claim your first Miner pay at the Job Board.',
    focus: 'learn the quarry-to-board loop',
    reward: 'stone supply, Miner XP, and a reason to revisit caves',
    location: 'Quarry Work',
    nextAction: 'Mine quarry stone or cave blocks',
  }),
  farmer: Object.freeze({
    title: 'First Field Shift',
    desc: 'Till soil, plant seeds, or harvest wheat 3 times at the town farm, then claim your Farmer pay at the Job Board.',
    focus: 'learn the crop cycle',
    reward: 'food economy progress and Farmer XP',
    location: 'Farm Plots',
    nextAction: 'Use the hoe and seeds at the farm',
  }),
  cook: Object.freeze({
    title: 'First Kitchen Order',
    desc: 'Cook or craft 1 food item for the tavern kitchen, then claim your Cook pay at the Job Board.',
    focus: 'turn ingredients into food',
    reward: 'Cook XP and food economy progress',
    location: 'Tavern & Inn',
    nextAction: 'Cook food at a kitchen station',
  }),
  blacksmith: Object.freeze({
    title: 'First Forge Order',
    desc: 'Craft, smelt, repair, upgrade, or salvage 1 forge item at the smithy, then claim your Blacksmith pay at the Job Board.',
    focus: 'make gear useful',
    reward: 'Blacksmith XP and gear economy progress',
    location: 'Smithy',
    nextAction: 'Use the smithy forge or workbench',
  }),
  monk: Object.freeze({
    title: 'First Quiet Vigil',
    desc: 'Hold 30 seconds of focus in the Meditation Hall, then claim your Monk pay at the Job Board.',
    focus: 'learn calm resource recovery',
    reward: 'Monk XP and meditation growth progress',
    location: 'Meditation Hall',
    nextAction: 'Meditate inside the hall circle',
  }),
  pet_tamer: Object.freeze({
    title: 'First Care Shift',
    desc: 'Prepare 1 companion care item or feed a dragon treat, then claim your Pet Tamer pay at the Job Board.',
    focus: 'care for companions',
    reward: 'Pet Tamer XP and dragon-care practice',
    location: 'Dragon Roost',
    nextAction: 'Craft or use a companion treat',
  }),
});
const FIRST_TUTORIAL_STARTER_KITS = Object.freeze({
  miner: Object.freeze({ tools: Object.freeze([I.WOOD_PICK]), stacks: Object.freeze([]), title: 'Miner starter kit' }),
  farmer: Object.freeze({ tools: Object.freeze([I.WOOD_HOE]), stacks: Object.freeze([Object.freeze({ id: I.WHEAT_SEEDS, count: 8 })]), title: 'Farmer starter kit' }),
  cook: Object.freeze({ tools: Object.freeze([]), stacks: Object.freeze([Object.freeze({ id: I.WHEAT, count: 3 })]), title: 'Cook starter kit' }),
  blacksmith: Object.freeze({ tools: Object.freeze([]), stacks: Object.freeze([Object.freeze({ id: I.IRON_INGOT, count: 1 }), Object.freeze({ id: I.STICK, count: 1 }), Object.freeze({ id: W.B.PLANKS, count: 1 })]), title: 'Blacksmith starter kit' }),
  pet_tamer: Object.freeze({ tools: Object.freeze([]), stacks: Object.freeze([
    Object.freeze({ id: I.DRAGON_TREAT, count: 1 }),
    Object.freeze({ id: I.COOKED_MEAT, count: 2 }),
    Object.freeze({ id: I.COAL, count: 1 }),
  ]), title: 'Pet Tamer starter kit' }),
});

const NPC_QUEST_CHAINS = NPC_QUEST_REGISTRY.createNpcQuestChains({ B: W.B, I });
const NPC_QUEST_CHAIN_ERRORS = NPC_QUEST_REGISTRY.validateNpcQuestChains(NPC_QUEST_CHAINS);
if (NPC_QUEST_CHAIN_ERRORS.length) throw new Error('Invalid NPC quest chains: ' + NPC_QUEST_CHAIN_ERRORS.join('; '));

function contractPools(job, scale, level) {
  return JOB_SYSTEM.contractPool(job, scale, level, { STONE: W.B.STONE, IRON_ORE: W.B.IRON_ORE, WHEAT_3: W.B.WHEAT_3 });
}

class ProgressionMixin {
  homesteadContextForClient(client) {
    const actorRec = this.profileFor(client);
    const p = this.state.players.get(client.sessionId);
    if (!actorRec || !p || p.dgn || typeof this.connectedOwnedLandClaims !== 'function') return null;
    const x = Math.floor(p.x || 0), z = Math.floor(p.z || 0);
    const claim = this.landClaimFor(x, z);
    if (!claim || this.isLandClaimAbandoned(claim) || !this.hasLandPermission(client, claim)) return null;
    const ownerToken = claim.owner || '';
    const group = ownerToken ? this.connectedOwnedLandClaims(x, z, ownerToken) : [];
    if (group.length < 3) return null;
    const ownerProf = this.profiles && this.profiles.get(ownerToken);
    return {
      actorRec,
      ownerRec: ownerProf ? { token: ownerToken, prof: ownerProf } : null,
      ownerToken,
      group,
      own: actorRec.token === ownerToken,
      claim,
    };
  }

  homesteadGroupForClient(client) {
    const ctx = this.homesteadContextForClient(client);
    return ctx && ctx.own ? ctx.group : null;
  }

  makeHomesteadWorkOrder(rec, group) {
    const now = Date.now();
    let seed = Math.floor(now / 86400000) + (group && group.length || 0);
    for (const ch of String(rec && rec.token || 'homestead')) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const spec = HOMESTEAD_WORK_ORDER_SPECS[seed % HOMESTEAD_WORK_ORDER_SPECS.length];
    return {
      ...spec,
      id: ['home', now, spec.job, spec.target].join('_'),
      have: 0,
      offeredAt: now,
      completedAt: 0,
    };
  }

  homesteadChestEntries(group, ownerToken, client) {
    const entries = [];
    if (!group || !ownerToken || !this.world || !this.chests) return entries;
    const actorToken = this.clientToken(client);
    const p = client && this.state.players.get(client.sessionId);
    const actorTeam = p ? this.cleanTeamId(p.team) : '';
    for (const cell of group) {
      for (let y = 0; y < W.WH; y++) {
        if (this.world.getB(cell.x, y, cell.z) !== W.B.CHEST) continue;
        const key = 'overworld:' + cell.x + ',' + y + ',' + cell.z;
        const rec = this.getChestRecord(key);
        if (!rec) continue;
        const supplyChest = rec.scope === 'personal' && rec.supply === true && rec.owner === ownerToken;
        const ownChest = rec.scope === 'personal' && rec.owner === ownerToken && actorToken === ownerToken;
        const helperChest = rec.scope === 'personal' && rec.owner === actorToken;
        const teamChest = rec.scope === 'team' && rec.team && rec.team === actorTeam;
        if (!supplyChest && !ownChest && !helperChest && !teamChest) continue;
        entries.push({ key, rec, x: cell.x, y, z: cell.z, supply: supplyChest });
      }
    }
    return entries.sort((a, b) => (b.supply === true) - (a.supply === true));
  }

  homesteadStorageSummary(group, ownerToken, itemId = 0, client = null) {
    const chests = this.homesteadChestEntries(group, ownerToken, client);
    let have = 0, supplyHave = 0;
    if (itemId) {
      for (const chest of chests) {
        for (const slot of chest.rec.slots) {
          if (slot && slot.id === itemId && slot.dur == null) {
            const count = Math.max(0, slot.count | 0);
            have += count;
            if (chest.supply === true) supplyHave += count;
          }
        }
      }
    }
    return { chests: chests.length, have, supplyChests: chests.filter(chest => chest.supply === true).length, supplyHave };
  }

  consumeHomesteadChestItem(group, ownerToken, itemId, count = 1, client = null) {
    let left = Math.max(1, count | 0);
    const chests = this.homesteadChestEntries(group, ownerToken, client);
    for (const chest of chests) {
      for (let i = 0; i < chest.rec.slots.length && left > 0; i++) {
        const slot = chest.rec.slots[i];
        if (!slot || slot.id !== itemId || slot.dur != null) continue;
        const take = Math.min(left, slot.count | 0);
        slot.count -= take;
        left -= take;
        if (slot.count <= 0) chest.rec.slots[i] = null;
      }
      if (left <= 0) break;
    }
    if (left > 0) return false;
    this.dirtyChests = true;
    return true;
  }

  recordHomesteadContributor(order, actorRec) {
    if (!order || !actorRec) return;
    if (!order.contributors || typeof order.contributors !== 'object') order.contributors = {};
    const entry = order.contributors[actorRec.token] || { name: actorRec.prof.name || 'Hunter', count: 0 };
    entry.name = actorRec.prof.name || entry.name || 'Hunter';
    entry.count = Math.max(0, (entry.count | 0) + 1);
    order.contributors[actorRec.token] = entry;
  }

  grantHomesteadAssistXp(client, actorRec, ownerToken, order) {
    if (!actorRec || actorRec.token === ownerToken) return 0;
    const job = JOB_XP_IDS.includes(order && order.job) ? order.job : '';
    if (!job) return 0;
    const amount = Math.max(1, Math.round(Math.max(0, order.rewardJobXp | 0) * .25 / Math.max(1, order.need | 0)));
    const xpMap = ensureJobXpMap(actorRec.prof);
    xpMap[job] = Math.max(0, (xpMap[job] | 0) + amount);
    actorRec.prof.jobXp = xpMap[actorRec.prof.job || 'adventurer'] | 0;
    this.dirtyPlayers.add(actorRec.token);
    this.syncPlayerProfile(client, actorRec.prof);
    client.send('jobProgress', { job, jobXp: xpMap[job] | 0, jobXpByJob: xpMap, contract: actorRec.prof.jobContract || null });
    return amount;
  }

  sendHomesteadWorkOrder(client, action = 'sync', extra = {}, ctx = null) {
    ctx = ctx || this.homesteadContextForClient(client);
    const rec = ctx && ctx.ownerRec;
    if (!rec) return false;
    let storage = extra.storage;
    if (!storage) {
      const order = rec.prof.homesteadWorkOrder;
      storage = ctx ? this.homesteadStorageSummary(ctx.group, rec.token, order && (order.target | 0), client) : { chests: 0, have: 0 };
    }
    client.send('homesteadWorkOrder', { action, order: rec.prof.homesteadWorkOrder || null, storage, own: !!(ctx && ctx.own), ...extra });
    return true;
  }

  rejectHomesteadWorkOrder(client, reason) {
    client.send('homesteadWorkOrderReject', { reason });
    return false;
  }

  handleHomesteadWorkOrder(client, m) {
    const action = m && typeof m.action === 'string' ? m.action : '';
    const actorRec = this.profileFor(client);
    if (!actorRec) return this.rejectHomesteadWorkOrder(client, 'profile');
    if (this.rateLimited(client, 'progression', 8, 16)) return this.rejectHomesteadWorkOrder(client, 'rate');
    const ctx = this.homesteadContextForClient(client);
    if (!ctx) return this.rejectHomesteadWorkOrder(client, 'homestead');
    const rec = ctx.ownerRec;
    if (!rec) return this.rejectHomesteadWorkOrder(client, 'owner');
    if (action === 'status') return this.sendHomesteadWorkOrder(client, 'status', { groupSize: ctx.group.length }, ctx);
    if (action === 'request') {
      if (!ctx.own) return this.rejectHomesteadWorkOrder(client, 'owner');
      if (!rec.prof.homesteadWorkOrder) {
        rec.prof.homesteadWorkOrder = this.makeHomesteadWorkOrder(rec, ctx.group);
        this.dirtyPlayers.add(rec.token);
      }
      return this.sendHomesteadWorkOrder(client, 'request', { groupSize: ctx.group.length }, ctx);
    }
    const order = rec.prof.homesteadWorkOrder;
    if (!order) return this.rejectHomesteadWorkOrder(client, 'missing');
    if (action === 'contribute') {
      if ((order.have | 0) >= (order.need | 0)) return this.sendHomesteadWorkOrder(client, 'contribute', { groupSize: ctx.group.length }, ctx);
      const storage = this.homesteadStorageSummary(ctx.group, rec.token, order.target | 0, client);
      if (!storage.chests) return this.rejectHomesteadWorkOrder(client, 'storage');
      if (storage.have <= 0 || !this.consumeHomesteadChestItem(ctx.group, rec.token, order.target | 0, 1, client)) {
        return this.rejectHomesteadWorkOrder(client, 'item');
      }
      order.have = Math.min(order.need | 0, (order.have | 0) + 1);
      this.recordHomesteadContributor(order, actorRec);
      const assistRewardJobXp = this.grantHomesteadAssistXp(client, actorRec, rec.token, order);
      if ((order.have | 0) >= (order.need | 0)) order.completedAt = Date.now();
      this.dirtyPlayers.add(rec.token);
      return this.sendHomesteadWorkOrder(client, 'contribute', { groupSize: ctx.group.length, assistRewardJobXp, assistJob: order.job }, ctx);
    }
    if (action === 'claim') {
      if (!ctx.own) return this.rejectHomesteadWorkOrder(client, 'owner');
      if ((order.have | 0) < (order.need | 0)) return this.rejectHomesteadWorkOrder(client, 'incomplete');
      const xpMap = ensureJobXpMap(rec.prof);
      const job = JOB_XP_IDS.includes(order.job) ? order.job : 'miner';
      const rewardGold = Math.max(0, order.rewardGold | 0);
      const rewardJobXp = Math.max(0, order.rewardJobXp | 0);
      const jobLevelBefore = JOB_SYSTEM.jobLevelFromXp(xpMap[job] | 0);
      rec.prof.gold = Math.min(1e9, (rec.prof.gold | 0) + rewardGold);
      if (this.recordEconomyGold) this.recordEconomyGold(client, rewardGold, 'contract_faucet', 'homestead_work_order', { job, title: order.title || '' });
      xpMap[job] = Math.max(0, (xpMap[job] | 0) + rewardJobXp);
      const jobLevelAfter = JOB_SYSTEM.jobLevelFromXp(xpMap[job] | 0);
      const milestones = JOB_SYSTEM.milestonesFor(job)
        .filter(milestone => milestone.level > jobLevelBefore && milestone.level <= jobLevelAfter)
        .map(milestone => ({ ...milestone, reward: milestone.reward || JOB_SYSTEM.milestoneReward(job, milestone.level) }));
      const milestoneStarterItems = this.grantProfessionMilestoneStarters(client, job, milestones);
      rec.prof.jobXp = xpMap[rec.prof.job || 'adventurer'] | 0;
      const completed = order;
      rec.prof.homesteadWorkOrder = null;
      this.syncPlayerProfile(client, rec.prof);
      this.dirtyPlayers.add(rec.token);
      client.send('homesteadWorkOrderResult', {
        order: completed,
        rewardGold,
        rewardJobXp,
        job,
        jobXp: xpMap[job] | 0,
        jobXpByJob: xpMap,
        jobLevelBefore,
        jobLevelAfter,
        milestones,
        milestoneStarterItems,
        gold: rec.prof.gold | 0,
      });
      return true;
    }
    return this.rejectHomesteadWorkOrder(client, 'action');
  }

  baseSetupStatusForClient(client) {
    const token = this.clientToken(client);
    const status = { storage: false, light: false, station: false };
    if (!token || !this.landClaims || !this.world) return status;
    this.landClaims.forEach((claim, key) => {
      if (status.storage && status.light && status.station) return;
      if (!claim || this.isLandClaimAbandoned(claim) || !this.hasLandPermission(client, claim)) return;
      const [x, z] = key.split(',').map(Number);
      for (let y = 0; y < W.WH; y++) {
        const id = this.world.getB(x, y, z);
        if (id === W.B.CHEST) status.storage = true;
        else if (id === W.B.TORCH || id === W.B.LANTERN || id === W.B.CAMPFIRE) status.light = true;
        else if (id === W.B.TABLE || id === W.B.FURNACE) status.station = true;
        if (status.storage && status.light && status.station) return;
      }
    });
    return status;
  }

  hasBaseSetup(client) {
    const status = this.baseSetupStatusForClient(client);
    return !!(status.storage && status.light && status.station);
  }

  checkBaseSetupProgress(client) {
    const rec = this.profileFor(client);
    if (!rec || !rec.prof || rec.prof.progressionFocus !== 'first_base_setup') return false;
    if (!this.hasBaseSetup(client)) return false;
    return this.advanceProgressionDirector(client, 'base_setup_completed', { profile: false });
  }

  grantProgressionMilestoneReward(client, key) {
    const rec = this.profileFor(client), spec = PROGRESSION_MILESTONE_REWARDS[key];
    if (!rec || !rec.prof || !spec) return false;
    const prof = rec.prof;
    if (!Array.isArray(prof.progressionMilestoneRewards)) prof.progressionMilestoneRewards = [];
    if (prof.progressionMilestoneRewards.includes(key)) return false;
    const delivered = [];
    for (const item of spec.items) {
      const count = Math.max(0, item.count | 0);
      const left = this.addRewardItem(prof, item.id | 0, count);
      const placed = Math.max(0, count - left);
      if (placed > 0) delivered.push({ id: item.id | 0, count: placed });
    }
    if (!delivered.length) return false;
    prof.progressionMilestoneRewards.push(key);
    this.dirtyPlayers.add(rec.token);
    client.send('progressionMilestoneReward', { key, title: spec.title, text: spec.text, items: delivered, modal: spec.modal === true, subtitle: spec.subtitle || '', action: spec.action || '' });
    return true;
  }

  grantProfessionMilestoneStarters(client, job, milestones) {
    const rec = this.profileFor(client);
    if (!rec || !rec.prof || !Array.isArray(milestones) || !milestones.length) return [];
    const prof = rec.prof;
    if (!Array.isArray(prof.progressionMilestoneRewards)) prof.progressionMilestoneRewards = [];
    const granted = [];
    for (const milestone of milestones) {
      const level = milestone && (milestone.level | 0);
      const kitKey = `${job}:${level}`;
      const spec = PROFESSION_MILESTONE_STARTERS[kitKey];
      const saveKey = `profession:${kitKey}`;
      if (!spec || prof.progressionMilestoneRewards.includes(saveKey)) continue;
      const delivered = [];
      for (const item of spec.items) {
        const count = Math.max(0, item.count | 0);
        const left = this.addRewardItem(prof, item.id | 0, count);
        const placed = Math.max(0, count - left);
        if (placed > 0) delivered.push({ id: item.id | 0, count: placed });
      }
      if (!delivered.length) continue;
      prof.progressionMilestoneRewards.push(saveKey);
      granted.push({ key: saveKey, title: spec.title, text: spec.text, items: delivered });
      client.send('progressionMilestoneReward', { key: saveKey, title: spec.title, text: spec.text, items: delivered, modal: false, subtitle: 'PROFESSION STARTER', action: 'CONTINUE' });
    }
    if (granted.length) {
      this.dirtyPlayers.add(rec.token);
      this.syncPlayerProfile(client, prof);
    }
    return granted;
  }

  advanceProgressionDirector(client, event, detail = {}) {
    const rec = this.profileFor(client);
    if (!rec || !rec.prof) return false;
    const prof = rec.prof;
    const hasStation = () => this.countItem(prof, W.B.TABLE) > 0 || this.countItem(prof, W.B.FURNACE) > 0;
    const hasLand = () => {
      if (!this.landClaims) return false;
      for (const claim of this.landClaims.values()) if (claim && claim.owner === rec.token) return true;
      return false;
    };
    const hasExpandedLand = () => typeof this.largestOwnedLandGroupSize === 'function'
      ? this.largestOwnedLandGroupSize(rec.token) >= 3
      : hasLand();
    let next = '';
    if (event === 'first_hands_claimed' && !prof.progressionFocus) next = 'first_road_ready';
    else if (event === 'first_e_gate_cleared' && ['first_road_ready', 'first_e_gate', ''].includes(prof.progressionFocus || '')) next = hasExpandedLand() ? 'first_base_setup' : hasLand() ? 'first_claim_expand' : hasStation() ? 'first_land_claim' : 'first_craft_station';
    else if (event === 'crafted_station' && prof.progressionFocus === 'first_craft_station') next = hasExpandedLand() ? 'first_base_setup' : hasLand() ? 'first_claim_expand' : 'first_land_claim';
    else if (event === 'land_claimed' && ['first_craft_station', 'first_land_claim'].includes(prof.progressionFocus)) next = hasExpandedLand() ? 'first_base_setup' : 'first_claim_expand';
    else if (event === 'land_claimed' && ['first_claim_expand', 'first_land_claim'].includes(prof.progressionFocus) && hasExpandedLand()) next = 'first_base_setup';
    else if (event === 'base_setup_completed' && prof.progressionFocus === 'first_base_setup') next = 'first_profession_contract';
    else if (event === 'job_contract_taken' && prof.progressionFocus === 'first_profession_contract') next = 'e_rank_climb';
    if (next === prof.progressionFocus) return false;
    if (!next && event !== 'job_contract_taken') return false;
    prof.progressionFocus = next;
    this.dirtyPlayers.add(rec.token);
    if (event === 'crafted_station') this.grantProgressionMilestoneReward(client, 'craft_station');
    else if (event === 'first_e_gate_cleared') {
      this.unlockUtility(client, 'feather_step', 'First E-rank Gate cleared');
      this.grantProgressionMilestoneReward(client, 'first_e_gate');
    }
    else if (event === 'land_claimed') this.grantProgressionMilestoneReward(client, 'land_claim');
    else if (event === 'base_setup_completed') this.grantProgressionMilestoneReward(client, 'base_setup');
    else if (event === 'job_contract_taken') this.grantProgressionMilestoneReward(client, 'first_contract');
    if (detail.profile !== false) this.sendProfile ? this.sendProfile(client, prof) : client.send('profile', prof);
    else client.send('progressionFocus', {
      progressionFocus: next,
      activeObjectives: this.activeQuestObjectives ? this.activeQuestObjectives(client, prof) : [],
    });
    if (next === 'first_base_setup') this.checkBaseSetupProgress(client);
    return true;
  }

  progressionChanged(client, type, extra = {}) {
    const rec = this.profileFor(client);
    if (!rec) return false;
    this.syncPlayerProfile(client, rec.prof);
    this.dirtyPlayers.add(rec.token);
    this.sendProfile ? this.sendProfile(client, rec.prof) : client.send('profile', rec.prof);
    client.send('progressionResult', { ok: true, type, ...extra });
    return true;
  }

  progressionReject(client, type, reason) {
    if (type === 'armor') {
      const rec = this.profileFor(client);
      if (rec) this.sendProfile ? this.sendProfile(client, rec.prof) : client.send('profile', rec.prof);
    }
    client.send('progressionResult', { ok: false, type, reason });
    return false;
  }

  handleSpendStat(client, m) {
    const rec = this.profileFor(client);
    const stat = m && typeof m.stat === 'string' ? m.stat : '';
    const amount = Math.max(1, Math.min(10, (m && m.amount) | 0 || 1));
    if (!rec || !STAT_KEYS.has(stat)) return this.progressionReject(client, 'stat', 'invalid');
    if (this.rateLimited(client, 'progression', 8, 16)) return this.progressionReject(client, 'stat', 'rate');
    if ((rec.prof.S.pts | 0) < amount) return this.progressionReject(client, 'stat', 'points');
    if ((rec.prof.S[stat] | 0) + amount > 999) return this.progressionReject(client, 'stat', 'cap');
    rec.prof.S.pts -= amount;
    rec.prof.S[stat] += amount;
    if (stat === 'vit') {
      const hp = this.ensurePlayerHp(client);
      hp.max = 20 + Math.max(0, rec.prof.S.vit - 1) * 2;
      hp.hp = Math.min(hp.max, hp.hp + amount * 2);
      client.send('hp', { hp: Math.ceil(hp.hp), maxHp: hp.max });
    }
    if (stat === 'int') this.regenAbilityState(client);
    return this.progressionChanged(client, 'stat', { stat, amount });
  }

  handleSetJob(client, m) {
    const rec = this.profileFor(client);
    const requestedJob = m && typeof m.job === 'string' ? m.job : '';
    const job = requestedJob === 'adventurer' ? '' : requestedJob;
    if (!rec || !PROFESSION_IDS.has(job)) return this.progressionReject(client, 'job', 'invalid');
    if (this.rateLimited(client, 'progression', 8, 16)) return this.progressionReject(client, 'job', 'rate');
    if (rec.prof.job !== job) {
      rec.prof.job = job;
      rec.prof.jobContractOffers = [];
      rec.prof.jobContractOffersAt = 0;
      rec.prof.jobContractOfferJob = '';
    }
    ensureJobXpMap(rec.prof);
    rec.prof.jobXp = rec.prof.jobXpByJob[job || 'adventurer'] | 0;
    if (rec.prof.progressionFocus === 'first_promotion_job') {
      rec.prof.progressionFocus = 'first_promotion_contract';
    }
    return this.progressionChanged(client, 'job', { job });
  }

  makeServerJobContract(prof, requested = '') {
    const job = requested === 'adventurer' ? 'adventurer' : ((prof && prof.job) || 'adventurer');
    if (!job) return null;
    const xpMap = ensureJobXpMap(prof);
    const scale = JOB_SYSTEM.contractScaleFromXp(xpMap[job]);
    const level = Math.max(1, prof && prof.S ? prof.S.lvl | 0 : 1);
    if (job === 'adventurer' && !(prof.adventurerContractsCompleted | 0)) {
      return { ...JOB_SYSTEM.firstHunterContract(), rewardXp: hunterXpForActivity(level, 'job_contract') };
    }
    const pool = contractPools(job, scale, level);
    if (!pool.length) return null;
    return { ...pool[(Math.random() * pool.length) | 0], job, have: 0, rewardXp: hunterXpForActivity(level, 'job_contract') };
  }

  seedFirstTutorialJobContract(client, requestedJob = '') {
    const rec = this.profileFor(client);
    const job = typeof requestedJob === 'string' ? requestedJob : '';
    if (!rec || !JOB_SYSTEM.PROFESSION_IDS.includes(job) || rec.prof.jobContract) return null;
    if (rec.prof.job !== job) rec.prof.job = job;
    const xpMap = ensureJobXpMap(rec.prof);
    const level = Math.max(1, rec.prof.S ? rec.prof.S.lvl | 0 : 1);
    const type = FIRST_TUTORIAL_CONTRACT_TYPE[job] || '';
    const pool = contractPools(job, JOB_SYSTEM.contractScaleFromXp(xpMap[job]), level);
    const base = pool.find(c => c.type === type) || pool[0];
    if (!base) return null;
    const now = Date.now();
    const starter = FIRST_TUTORIAL_CONTRACT_OVERRIDES[job] || {};
    const contract = this.decorateMinerUndergroundOffer({
      ...base,
      ...starter,
      id: ['job', job, 'tutorial', now, base.type].join('_'),
      job,
      need: Math.max(1, Math.min(base.need | 0, FIRST_TUTORIAL_CONTRACT_NEED[job] || (base.need | 0) || 1)),
      have: 0,
      rewardXp: hunterXpForActivity(level, 'job_contract'),
      lifecycleState: 'active',
      acceptedAt: now,
      difficulty: 'starter',
      difficultyLabel: 'First Real Shift',
      estimate: job === 'monk' && level < 4 ? 'Unlocks fully at Level 4' : 'About 5 minutes',
      offeredAt: now,
      expiresAt: now + JOB_SYSTEM.OFFER_REFRESH_MS,
    }, rec, now);
    rec.prof.jobContract = contract;
    rec.prof.jobContractOffers = [];
    rec.prof.jobContractOffersAt = 0;
    rec.prof.jobContractOfferJob = job;
    if (!rec.prof.jobContractOfferBoards || typeof rec.prof.jobContractOfferBoards !== 'object') rec.prof.jobContractOfferBoards = {};
    rec.prof.jobContractOfferBoards[job] = { at: now, offers: [] };
    this.grantFirstTutorialJobStarterKit(client, job);
    this.dirtyPlayers.add(rec.token);
    client.send('jobProgress', { job, jobXp: xpMap[job] | 0, contract });
    if (rec.prof.progressionFocus === 'first_profession_contract') {
      this.advanceProgressionDirector(client, 'job_contract_taken', { profile: false });
    }
    if (this.sendQuestOutcome) this.sendQuestOutcome(client, {
      source: 'job',
      questType: 'job',
      title: contract.title || 'First Real Shift',
      outcome: 'accepted',
      reason: 'tutorial_complete',
      location: contract.location || 'Job Board',
      text: contract.nextAction || contract.desc || 'Follow your first job contract.',
      noReward: true,
    });
    return contract;
  }

  firstGateBridgeFocus(prof) {
    if (!prof || prof.activeNpcQuest) return '';
    const chains = prof.npcQuestChains && typeof prof.npcQuestChains === 'object' ? prof.npcQuestChains : {};
    const maraStep = Math.max(0, chains['Mara Vale'] | 0);
    const highestGateRankCleared = Number.isFinite(Number(prof.highestGateRankCleared)) ? (Number(prof.highestGateRankCleared) | 0) : -1;
    if (highestGateRankCleared >= 0) return '';
    return maraStep >= 2 ? 'first_e_gate' : 'first_road_ready';
  }

  grantFirstTutorialJobStarterKit(client, job) {
    const rec = this.profileFor(client);
    const kit = FIRST_TUTORIAL_STARTER_KITS[job];
    if (!rec || !rec.prof || !kit) return [];
    const prof = rec.prof;
    if (!Array.isArray(prof.progressionMilestoneRewards)) prof.progressionMilestoneRewards = [];
    const key = `tutorial-job-starter:${job}`;
    if (prof.progressionMilestoneRewards.includes(key)) return [];
    const delivered = [];
    let blocked = false;
    for (const id of kit.tools || []) {
      const hasTool = Array.isArray(prof.inv) && prof.inv.some(s => s && (s.id | 0) === (id | 0));
      if (hasTool) continue;
      if (typeof this.ensureProfileTool === 'function' && this.ensureProfileTool(prof, id | 0)) delivered.push({ id: id | 0, count: 1 });
      else blocked = true;
    }
    for (const stack of kit.stacks || []) {
      const id = stack.id | 0;
      const target = Math.max(1, stack.count | 0);
      const before = typeof this.profileItemCount === 'function' ? this.profileItemCount(prof, id) : 0;
      if (before >= target) continue;
      if (typeof this.ensureProfileStack === 'function' && this.ensureProfileStack(prof, id, target)) {
        delivered.push({ id, count: Math.max(0, target - before) });
      } else blocked = true;
    }
    if (blocked) return delivered;
    prof.progressionMilestoneRewards.push(key);
    if (delivered.length) {
      this.dirtyPlayers.add(rec.token);
      client.send('progressionMilestoneReward', {
        key,
        title: kit.title || 'Starter kit',
        text: 'A small real-world kit for your first job contract.',
        items: delivered,
        modal: false,
        subtitle: 'FIRST REAL SHIFT',
        action: 'CONTINUE',
      });
    }
    return delivered;
  }

  minerUndergroundTarget(type, salt = 0) {
    const sites = type === 'ancient_map'
      ? W.ancientCitySpecs()
      : W.regionalLandmarkSpecs().filter(s => s.type === 'cave');
    if (!sites.length) return null;
    const idx = Math.floor(W.hash2((salt | 0) + 7109, sites.length * 3571 + (type === 'ancient_map' ? 19 : 7)) * sites.length) % sites.length;
    const s = sites[idx];
    return {
      targetId: s.id,
      targetType: type === 'ancient_map' ? 'ancient_city' : 'cave',
      targetName: s.name || (type === 'ancient_map' ? 'Ancient City' : 'Deepmouth Cave'),
      targetX: s.x | 0,
      targetZ: s.z | 0,
    };
  }

  decorateMinerUndergroundOffer(c, rec, salt = 0) {
    if (!c || c.job !== 'miner' || !['cave_survey', 'ancient_map'].includes(c.type)) return c;
    const target = this.minerUndergroundTarget(c.type, salt + String(rec && rec.token || '').length * 97);
    if (!target) return c;
    return {
      ...c,
      ...target,
      location: c.type === 'ancient_map' ? 'Ancient City treasure route' : target.targetName + ' entrance',
      focus: c.type === 'ancient_map' ? 'ancient city treasure map' : 'descend and survey underground',
      reward: c.type === 'ancient_map' ? 'ancient fragments, glyphs, and Miner XP' : 'Miner XP plus cave loot chances',
    };
  }

  jobContractOffers(rec, requested = '') {
    const prof=rec.prof,job=requested==='adventurer'?'adventurer':(prof.job||'adventurer'),actualNow=Date.now();
    if(job!=='adventurer'&&job!==prof.job)return [];
    if(!prof.jobContractOfferBoards||typeof prof.jobContractOfferBoards!=='object')prof.jobContractOfferBoards={};
    const board=prof.jobContractOfferBoards[job]||{at:0,offers:[]},current=Array.isArray(board.offers)?board.offers:[];
    if(Number(board.at||0)>0&&actualNow<Number(board.at||0)+JOB_SYSTEM.OFFER_REFRESH_MS){prof.jobContractOffers=current;prof.jobContractOffersAt=board.at;prof.jobContractOfferJob=job;return current;}
    const previousOfferAt=current.reduce((max,c)=>Math.max(max,Number(c&&c.offeredAt)||0),0);
    const now=Math.max(actualNow,Number(board.at||0)+1,previousOfferAt+1);
    const level=Math.max(1,prof.S&&prof.S.lvl|0),xpMap=ensureJobXpMap(prof),hunterXp=hunterXpForActivity(level,'job_contract');
    let offers;
    if(job==='adventurer'&&!(prof.adventurerContractsCompleted|0))offers=[{...JOB_SYSTEM.firstHunterContract(),difficulty:'balanced',difficultyLabel:'First Assignment',estimate:'About 5 minutes',location:'Beyond the town walls',focus:'first combat lesson',reward:'Compass Sense unlock path',party:'Solo',rewardXp:hunterXp}];
    else{
      let rotation=0;for(const ch of String(rec.token||'hunter')+job)rotation=(rotation*31+ch.charCodeAt(0))>>>0;
      rotation+=Math.floor(now/JOB_SYSTEM.OFFER_REFRESH_MS);
      offers=JOB_SYSTEM.contractOffers(job,JOB_SYSTEM.contractScaleFromXp(xpMap[job]),level,{STONE:W.B.STONE,IRON_ORE:W.B.IRON_ORE,WHEAT_3:W.B.WHEAT_3,IRON_INGOT:I.IRON_INGOT},hunterXp,rotation)
        .map((c,i)=>this.decorateMinerUndergroundOffer(c,rec,rotation+i));
    }
    const expiresAt=now+JOB_SYSTEM.OFFER_REFRESH_MS;
    prof.jobContractOffers=offers.map((c,i)=>({...c,id:['job',job,now,i,c.type].join('_'),offeredAt:now,expiresAt}));
    prof.jobContractOffersAt=now;prof.jobContractOfferJob=job;this.dirtyPlayers.add(rec.token);
    prof.jobContractOfferBoards[job]={at:now,offers:prof.jobContractOffers};
    return prof.jobContractOffers;
  }

  sendJobContractOffers(client,requested=''){
    const rec=this.profileFor(client);if(!rec)return false;
    const offers=this.jobContractOffers(rec,requested);
    client.send('jobContractOffers',{job:requested==='adventurer'?'adventurer':(rec.prof.job||'adventurer'),offers,refreshAt:(rec.prof.jobContractOffersAt||0)+JOB_SYSTEM.OFFER_REFRESH_MS});
    return true;
  }

  handleJobContract(client, m) {
    const rec = this.profileFor(client);
    const action = m && typeof m.action === 'string' ? m.action : '';
    if (!rec) return this.progressionReject(client, 'jobContract', 'job');
    if (this.rateLimited(client, 'progression', 8, 16)) return this.progressionReject(client, 'jobContract', 'rate');
    if(action==='offers')return this.sendJobContractOffers(client,m&&m.job);
    if (action === 'take') {
      if (rec.prof.jobContract) return this.progressionReject(client, 'jobContract', 'active');
      const requestedJob = m && typeof m.job === 'string' ? m.job : '';
      const contractJob = requestedJob === 'adventurer' ? 'adventurer' : (rec.prof.job || 'adventurer');
      if (!contractJob) return this.progressionReject(client, 'jobContract', 'job');
      if (contractJob !== 'adventurer' && contractJob !== rec.prof.job) return this.progressionReject(client, 'jobContract', 'job');
      const offerId=m&&typeof m.offerId==='string'?m.offerId:'';
      if(offerId){
        const board=rec.prof.jobContractOfferBoards&&rec.prof.jobContractOfferBoards[contractJob];
        const cached=[
          ...(Array.isArray(rec.prof.jobContractOffers)?rec.prof.jobContractOffers:[]),
          ...(board&&Array.isArray(board.offers)?board.offers:[]),
        ];
        const offers=this.jobContractOffers(rec,contractJob);
        const offer=[...offers,...cached].find(c=>c&&c.id===offerId&&Date.now()<(c.expiresAt||0));
        if(!offer)return this.progressionReject(client,'jobContract','offer');
        rec.prof.jobContract={...offer,have:0};
        rec.prof.jobContractOffers=[]; // one choice per rotation; abandon cannot become a free reroll
        if(rec.prof.jobContractOfferBoards&&rec.prof.jobContractOfferBoards[contractJob])rec.prof.jobContractOfferBoards[contractJob].offers=[];
      }else rec.prof.jobContract = this.makeServerJobContract(rec.prof, contractJob); // legacy/test compatibility
      rec.prof.jobContract.lifecycleState = 'active';
      rec.prof.jobContract.acceptedAt = rec.prof.jobContract.acceptedAt || Date.now();
      if (rec.prof.progressionFocus === 'first_promotion_job' && contractJob === 'adventurer') rec.prof.progressionFocus = 'first_promotion_contract';
      // 'first_promotion_contract' specifically guides taking the first adventurer
      // contract; 'next_adventurer_contract' just nudges back to the board, so any
      // contract take clears it (otherwise a job switch could strand the objective).
      if (rec.prof.progressionFocus === 'next_adventurer_contract' ||
          rec.prof.progressionFocus === 'first_promotion_contract') {
        rec.prof.progressionFocus = '';
      }
      this.advanceProgressionDirector(client, 'job_contract_taken', { profile: false });
    } else if (action === 'abandon') {
      const abandoned = rec.prof.jobContract;
      rec.prof.jobContract = null;
      if (abandoned && this.sendQuestOutcome) this.sendQuestOutcome(client, {
        source: 'job',
        questType: 'job',
        title: abandoned.title || 'Job Contract',
        outcome: 'abandoned',
        reason: 'player',
        location: 'Job Board',
        canReaccept: true,
        noReward: true,
      });
    } else if (action === 'claim') {
      const c = rec.prof.jobContract;
      if (!c || (c.have | 0) < (c.need | 0)) return this.progressionReject(client, 'jobContract', 'incomplete');
      const graduation = c.job === 'adventurer' && !(rec.prof.adventurerContractsCompleted | 0);
      let graduationInventory = null;
      if (graduation) {
        // Place the whole bundle on a draft inventory; commit only if every item
        // fits, so a near-full inventory is rejected cleanly with nothing granted.
        const draft = { ...rec.prof, inv: (rec.prof.inv || []).map(slot => slot ? { ...slot } : null) };
        const placed = GRADUATION_REWARD.every(r => (r.crafted
          ? this.addCraftedRewardItem(draft, r.id, r.count, r.dur)
          : this.addRewardItem(draft, r.id, r.count)) === 0);
        if (!placed) return this.progressionReject(client, 'jobContract', 'full');
        graduationInventory = draft.inv;
      }
      let rewardGold = c.rewardGold | 0;
      if (c.job === 'adventurer' && jobPerkTier(rec.prof, 'adventurer')) rewardGold = Math.round(rewardGold * (1 + jobPerkTier(rec.prof, 'adventurer') * .06));
      rec.prof.gold = Math.max(0, (rec.prof.gold | 0) + rewardGold);
      if (this.recordEconomyGold) this.recordEconomyGold(client, rewardGold, 'contract_faucet', 'job_contract', { job: c.job, type: c.type, title: c.title || '' });
      const rewardXp = Math.max(0, c.rewardXp | 0);
      this.grantHunterXp(rec.prof, rewardXp, client, 'job_contract');
      const xpMap = ensureJobXpMap(rec.prof);
      const jobLevelBefore = JOB_SYSTEM.jobLevelFromXp(xpMap[c.job] | 0);
      xpMap[c.job] = Math.max(0, (xpMap[c.job] | 0) + Math.max(0, c.rewardJobXp | 0));
      const jobLevelAfter = JOB_SYSTEM.jobLevelFromXp(xpMap[c.job] | 0);
      const milestones = JOB_SYSTEM.milestonesFor(c.job)
        .filter(m => m.level > jobLevelBefore && m.level <= jobLevelAfter)
        .map(m => ({ ...m, reward: m.reward || JOB_SYSTEM.milestoneReward(c.job, m.level) }));
      const milestoneStarterItems = this.grantProfessionMilestoneStarters(client, c.job, milestones);
      rec.prof.jobXp = xpMap[rec.prof.job || 'adventurer'] | 0;
      if (c.job === 'adventurer') rec.prof.adventurerContractsCompleted = Math.max(0, (rec.prof.adventurerContractsCompleted | 0) + 1);
      if (graduation) {
        rec.prof.inv = graduationInventory;
        this.unlockUtility(client, 'compass', 'First Adventurer contract complete');
        rec.prof.progressionFocus = 'first_d_gate';
        this.ensurePublicGateRank(1);
      }
      const milestoneRewards = Array.isArray(rec.prof.progressionMilestoneRewards) ? rec.prof.progressionMilestoneRewards : (rec.prof.progressionMilestoneRewards = []);
      const firstShiftComplete = !milestoneRewards.includes('first_shift_complete');
      if (firstShiftComplete) milestoneRewards.push('first_shift_complete');
      const starterShift = !graduation && firstShiftComplete && (c.difficulty === 'starter' || c.difficultyLabel === 'First Real Shift');
      const firstGateBridgeFocus = starterShift ? this.firstGateBridgeFocus(rec.prof) : '';
      if (firstGateBridgeFocus) {
        rec.prof.progressionFocus = firstGateBridgeFocus;
        if (firstGateBridgeFocus === 'first_e_gate') this.ensurePublicGateRank(0);
      }
      rec.prof.jobContract = null;
      rec.prof.jobContractOffers = [];
      rec.prof.jobContractOffersAt = 0;
      rec.prof.jobContractOfferJob = c.job;
      if (rec.prof.jobContractOfferBoards && typeof rec.prof.jobContractOfferBoards === 'object' && rec.prof.jobContractOfferBoards[c.job]) {
        rec.prof.jobContractOfferBoards[c.job] = { at: 0, offers: [] };
      }
      if (this.sendQuestRewardSummary) this.sendQuestRewardSummary(client, {
        source: 'job',
        questType: 'job',
        title: c.title || 'Job Contract',
        gold: rewardGold,
        xp: rewardXp,
        jobXp: Math.max(0, c.rewardJobXp | 0),
        job: c.job,
        contractType: c.type || '',
        graduation,
        items: graduation ? GRADUATION_REWARD.map(r => ({ id: r.id, count: r.count })) : [],
        claimLocation: 'Job Board',
        inventoryOverflow: false,
        nextStep: graduation ? 'D-Rank Prep: craft armor, pack food, check repairs, then clear a D-rank Gate.'
          : firstGateBridgeFocus === 'first_e_gate' ? 'Return to Mara Vale and accept The First Gate.'
          : firstGateBridgeFocus === 'first_road_ready' ? 'Return to Mara Vale for Road Ready, then your first E-rank Gate.'
          : undefined,
      });
      return this.progressionChanged(client, 'jobContract', {
        action, contract: c, rewardGold, rewardXp, rewardJobXp: Math.max(0, c.rewardJobXp | 0), job: c.job, jobLevelBefore, jobLevelAfter, milestones, milestoneStarterItems, graduation, firstShiftComplete, firstGateBridgeFocus,
        nextStep: graduation ? 'D-Rank Prep: craft armor, pack food, check repairs, then clear a D-rank Gate.'
          : firstGateBridgeFocus === 'first_e_gate' ? 'Return to Mara Vale and accept The First Gate.'
          : firstGateBridgeFocus === 'first_road_ready' ? 'Return to Mara Vale for Road Ready, then your first E-rank Gate.'
          : '',
        rewardItems: graduation ? GRADUATION_REWARD.map(r => ({ id: r.id, count: r.count })) : [],
      });
    } else return this.progressionReject(client, 'jobContract', 'action');
    return this.progressionChanged(client, 'jobContract', { action });
  }

  grantJobXp(client, job, amount) {
    const rec = this.profileFor(client);
    amount = Math.max(0, Math.min(1000, Math.round(Number(amount) || 0)));
    if (!rec || !amount || (job !== 'adventurer' && rec.prof.job !== job)) return false;
    const xpMap = ensureJobXpMap(rec.prof);
    const jobLevelBefore = JOB_SYSTEM.jobLevelFromXp(xpMap[job] | 0);
    xpMap[job] = Math.max(0, (xpMap[job] | 0) + amount);
    const jobLevelAfter = JOB_SYSTEM.jobLevelFromXp(xpMap[job] | 0);
    const milestones = JOB_SYSTEM.milestonesFor(job)
      .filter(m => m.level > jobLevelBefore && m.level <= jobLevelAfter)
      .map(m => ({ ...m, reward: m.reward || JOB_SYSTEM.milestoneReward(job, m.level) }));
    const milestoneStarterItems = this.grantProfessionMilestoneStarters(client, job, milestones);
    rec.prof.jobXp = xpMap[rec.prof.job || 'adventurer'] | 0;
    this.dirtyPlayers.add(rec.token);
    this.syncPlayerProfile(client, rec.prof);
    client.send('jobProgress', { job, jobXp: xpMap[job] | 0, jobXpByJob: xpMap, contract: rec.prof.jobContract || null, jobLevelBefore, jobLevelAfter, milestones, milestoneStarterItems });
    return true;
  }

  progressJobContract(client, type, count = 1, target = 0) {
    const rec = this.profileFor(client);
    const c = rec && rec.prof.jobContract;
    if (!c || (c.job !== 'adventurer' && c.job !== rec.prof.job) || c.type !== type || (c.have | 0) >= (c.need | 0)) return false;
    if (c.target && target && (c.target | 0) !== (target | 0)) {
      const stonePair = type === 'mine' && [W.B.STONE, W.B.COBBLE].includes(c.target | 0) && [W.B.STONE, W.B.COBBLE].includes(target | 0);
      if (!stonePair) return false;
    }
    c.have = Math.min(c.need | 0, (c.have | 0) + Math.max(1, count | 0));
    if ((c.have | 0) >= (c.need | 0) && c.lifecycleState !== 'claimable') {
      c.lifecycleState = 'claimable';
      c.claimableAt = Date.now();
    }
    this.dirtyPlayers.add(rec.token);
    client.send('jobProgress', { job: rec.prof.job, jobXp: rec.prof.jobXp | 0, contract: c });
    return true;
  }

  handleMeditateTick(client) {
    const rec = this.profileFor(client);
    const p = this.state.players.get(client.sessionId);
    if (!rec || !p || rec.prof.job !== 'monk' || p.dgn) return this.progressionReject(client, 'meditate', 'invalid');
    if (((rec.prof.S && rec.prof.S.lvl) | 0) < 4) return this.progressionReject(client, 'meditate', 'level');
    if (this.rateLimited(client, 'meditate', 1, 2)) return this.progressionReject(client, 'meditate', 'rate');
    const sx = W.HUB.meditate.x, sz = W.HUB.meditate.z;
    if (Math.hypot(p.x - sx, p.z - sz) > 9) return this.progressionReject(client, 'meditate', 'range');
    this.grantJobXp(client, 'monk', 2);
    this.progressJobContract(client, 'meditate', 5, 0);
    const rules = JOB_SYSTEM.MONK_RULES;
    const level = JOB_SYSTEM.jobLevelFromXp((rec.prof.jobXpByJob && rec.prof.jobXpByJob.monk) || 0);
    const tier = JOB_SYSTEM.perkTierFromLevel(level);
    if (!tier) return true;
    const now = Date.now(), duration = (rules.durationByTier[tier] || 0) * 1000;
    const applyFocus = (target, shared) => {
      const targetRec = this.profileFor(target);
      const targetProf = targetRec && targetRec.prof;
      const st = targetProf && typeof this.ensureAbilityState === 'function' ? this.ensureAbilityState(target) : null;
      const maxSp = targetProf && typeof this.maxStaminaForProfile === 'function' ? this.maxStaminaForProfile(targetProf) : 0;
      let mpRestore = 0, spRestore = 0, nextSp = null;
      if (level >= rules.regenLevel && st) {
        const beforeMp = st.mp;
        st.mp = Math.min(st.maxMp, st.mp + Math.max(1, Math.ceil(st.maxMp * (rules.resourceRestoreFraction || .08))));
        mpRestore = Math.max(0, Math.round(st.mp - beforeMp));
        if (typeof this.sendAbilitySync === 'function') this.sendAbilitySync(target, st);
      }
      if (level >= rules.regenLevel && targetProf && maxSp > 0) {
        const raw = targetProf.vitals && typeof targetProf.vitals === 'object' ? targetProf.vitals : {};
        const current = Number.isFinite(+raw.sp) ? +raw.sp : maxSp;
        nextSp = Math.max(0, Math.min(maxSp, current + Math.max(1, Math.ceil(maxSp * (rules.resourceRestoreFraction || .08)))));
        spRestore = Math.max(0, Math.round(nextSp - current));
        targetProf.vitals = { ...raw, sp: nextSp };
        targetProf.vitalsSavedAt = Date.now();
        if (typeof this.syncProfileVitals === 'function') this.syncProfileVitals(target, targetProf);
        if (targetRec && this.dirtyPlayers) this.dirtyPlayers.add(targetRec.token);
      }
      const buffs = this.abilityBuffs.get(target.sessionId) || {};
      if (level >= rules.regenLevel) buffs.monkRegenUntil = Math.max(buffs.monkRegenUntil || 0, now + duration);
      if (level >= rules.speedLevel) buffs.monkSpeedUntil = Math.max(buffs.monkSpeedUntil || 0, now + duration);
      if (level >= rules.stoneLevel) buffs.monkStoneUntil = Math.max(buffs.monkStoneUntil || 0, now + duration);
      this.abilityBuffs.set(target.sessionId, buffs);
      target.send('meditateFocus', { level, tier, durationMs: duration, regen: level >= rules.regenLevel, speed: level >= rules.speedLevel, stone: level >= rules.stoneLevel, shared: !!shared, by: p.name || 'a monk', mana: mpRestore, mp: st ? Math.floor(st.mp) : null, maxMp: st ? st.maxMp : null, stamina: spRestore, sp: nextSp, maxSp });
    };
    applyFocus(client, false);
    if (level >= rules.auraLevel) {
      if (!this.monkAuraAt) this.monkAuraAt = new Map();
      const last = this.monkAuraAt.get(client.sessionId) || 0;
      if (now - last >= rules.auraCooldownMs) {
        this.monkAuraAt.set(client.sessionId, now);
        for (const other of this.clients || []) {
          if (other === client) continue;
          const q = this.state.players.get(other.sessionId);
          if (q && p.team && q.team === p.team && !q.dgn && Math.hypot(q.x - p.x, q.z - p.z) <= rules.auraRange) applyFocus(other, true);
        }
      }
    }
    return true;
  }

  meditationAccessReason(client) {
    const rec = this.profileFor(client);
    const p = this.state.players.get(client.sessionId);
    if (!rec || !p || p.dgn) return 'invalid';
    if (((rec.prof.S && rec.prof.S.lvl) | 0) < 4) return 'level';
    const sx = W.HUB.meditate.x, sz = W.HUB.meditate.z;
    if (Math.hypot(p.x - sx, p.z - sz) > 9) return 'range';
    return '';
  }

  ensureMeditationChallenges() {
    if (!this.meditationChallenges) this.meditationChallenges = new Map();
    return this.meditationChallenges;
  }

  handleMeditationChallenge(client) {
    const reason = this.meditationAccessReason(client);
    if (reason) return client.send('meditationQuestion', { ok: false, reason });
    if (this.rateLimited(client, 'meditationChallenge', 1, 3)) return client.send('meditationQuestion', { ok: false, reason: 'rate' });
    const challenge = meditationChallengeForClient(client);
    const record = {
      id: challenge.id,
      type: challenge.type,
      acceptedAt: 0,
      createdAt: Date.now(),
      explanation: challenge.explanation || '',
      answer: challenge.type === 'sort'
        ? challenge.correct.join('|')
        : challenge.answers.map(cleanMeditationAnswer),
    };
    this.ensureMeditationChallenges().set(client.sessionId, record);
    const payload = { ok: true, id: challenge.id, type: challenge.type, prompt: challenge.prompt, explanation: challenge.explanation };
    if (challenge.type === 'sort') payload.choices = challenge.choices;
    client.send('meditationQuestion', payload);
    return true;
  }

  handleMeditationAnswer(client, message = {}) {
    const reason = this.meditationAccessReason(client);
    if (reason) return client.send('meditationAnswerResult', { ok: false, correct: false, reason });
    const record = this.ensureMeditationChallenges().get(client.sessionId);
    if (!record || record.id !== String(message && message.id || '') || Date.now() - record.createdAt > 60000) {
      return client.send('meditationAnswerResult', { ok: false, correct: false, reason: 'expired' });
    }
    let correct = false;
    if (record.type === 'sort') {
      const order = Array.isArray(message.order) ? message.order.map(v => String(v || '')).join('|') : '';
      correct = order === record.answer;
    } else {
      correct = record.answer.includes(cleanMeditationAnswer(message.answer));
    }
    if (correct) {
      record.acceptedAt = Date.now();
      client.send('meditationAnswerResult', { ok: true, correct: true, id: record.id, explanation: record.explanation });
    } else {
      this.ensureMeditationChallenges().delete(client.sessionId);
      client.send('meditationAnswerResult', { ok: true, correct: false, explanation: record.explanation, reason: 'wrong' });
    }
    return true;
  }

  handleMeditationComplete(client, message = {}) {
    const rec = this.profileFor(client);
    const p = this.state.players.get(client.sessionId);
    if (!rec || !p || p.dgn) return client.send('meditationGrowth', { ok: false, reason: 'invalid' });
    if (((rec.prof.S && rec.prof.S.lvl) | 0) < 4) return client.send('meditationGrowth', { ok: false, reason: 'level' });
    const sx = W.HUB.meditate.x, sz = W.HUB.meditate.z;
    if (Math.hypot(p.x - sx, p.z - sz) > 9) return client.send('meditationGrowth', { ok: false, reason: 'range' });
    const seconds = Math.max(0, Math.min(120, message && message.seconds | 0));
    if (seconds < 8) return client.send('meditationGrowth', { ok: false, reason: 'short' });
    if (this.rateLimited(client, 'meditationComplete', 1, 6)) return client.send('meditationGrowth', { ok: false, reason: 'rate' });
    const challenge = this.ensureMeditationChallenges().get(client.sessionId);
    if (!challenge || !challenge.acceptedAt || Date.now() - challenge.acceptedAt > 90000) return client.send('meditationGrowth', { ok: false, reason: 'question' });
    const prof = rec.prof;
    const before = sanitizeMeditationGrowth(prof.meditationGrowth, prof.S && prof.S.lvl || 1);
    const growth = { ...before, completed: before.completed + 1 };
    let award = null, capped = false;
    if (growth.completed >= growth.next) {
      const caps = meditationGrowthCapsForLevel(prof.S && prof.S.lvl || 1);
      const choices = [];
      if (growth.mp < caps.mp) choices.push({ stat: 'mp', amount: 1 });
      if (choices.length) {
        award = choices[Math.floor(Math.random() * choices.length)];
        growth[award.stat] = Math.min(caps[award.stat], growth[award.stat] + award.amount);
        award.amount = growth[award.stat] - before[award.stat];
      } else capped = true;
      growth.next = growth.completed < 8 ? 8 : growth.completed < 15 ? 15 : growth.completed < 25 ? 25 : Math.ceil((growth.completed + 1) / 15) * 15;
    }
    prof.meditationGrowth = sanitizeMeditationGrowth(growth, prof.S && prof.S.lvl || 1);
    if (award) {
      const vitals = this.cleanProfileVitals ? this.cleanProfileVitals(prof) : prof.vitals || {};
      prof.vitals = {
        ...vitals,
        hp: Math.min(this.maxHpForProfile(prof), (vitals.hp || this.maxHpForProfile(prof)) + (award.stat === 'hp' ? award.amount : 0)),
        mp: Math.min(this.maxMpForProfile(prof), (vitals.mp || this.maxMpForProfile(prof)) + (award.stat === 'mp' ? award.amount : 0)),
        sp: Math.min(this.maxStaminaForProfile(prof), (vitals.sp || this.maxStaminaForProfile(prof)) + (award.stat === 'sp' ? award.amount : 0)),
        hunger: Math.min(this.maxHungerForProfile(prof), (vitals.hunger || this.maxHungerForProfile(prof)) + (award.stat === 'hunger' ? award.amount : 0)),
      };
      prof.vitalsSavedAt = Date.now();
      if (typeof this.ensurePlayerHp === 'function') this.ensurePlayerHp(client);
      if (typeof this.ensurePlayerHunger === 'function') this.ensurePlayerHunger(client);
      if (typeof this.ensureAbilityState === 'function') this.ensureAbilityState(client);
    }
    this.ensureMeditationChallenges().delete(client.sessionId);
    this.dirtyPlayers.add(rec.token);
    client.send('meditationGrowth', { ok: true, completed: true, growth: prof.meditationGrowth, award, capped });
    this.sendProfile ? this.sendProfile(client, prof) : client.send('profile', prof);
    return true;
  }

  buildNpcQuest(prof, giver, role = 'town') {
    const chain = NPC_QUEST_CHAINS[giver];
    const step = Math.max(0, Math.min(chain ? chain.length : 0, (prof.npcQuestChains && prof.npcQuestChains[giver]) | 0));
    if (!chain || step >= chain.length) return null;
    const def = chain[step], lvl = Math.max(1, prof.S.lvl | 0);
    const rewards = {
      gold: Math.round(def.gold + lvl * 2 + step * 4),
      xp: Math.max(Math.round(def.xp + lvl * 5 + step * 6), hunterXpForActivity(lvl, 'town_quest')),
    };
    if ((def.levelTarget | 0) > lvl) {
      let targetXp = 0, targetLvl = lvl, carriedXp = Math.max(0, prof.S.xp | 0);
      while (targetLvl < (def.levelTarget | 0)) {
        targetXp += Math.max(0, this.xpNeed(targetLvl) - carriedXp);
        targetLvl++;
        carriedXp = 0;
      }
      // The two opening lessons are paced milestones, not scalable repeatables:
      // land exactly on the advertised level even when the wider XP economy rises.
      rewards.xp = targetXp;
    }
    return NPC_QUEST_REGISTRY.buildRuntimeNpcQuest(def, {
      giver, role, step, total: chain.length, level: lvl, gold: rewards.gold, xp: rewards.xp, lifecycleState: 'offered', now: Date.now(),
    });
  }

  rehydrateNpcQuestFromAuthoring(prof, q) {
    if (!prof || !q || typeof q !== 'object') return null;
    const giver = NPC_QUEST_REGISTRY.npcChainKey(q.giver);
    const chain = NPC_QUEST_CHAINS[giver];
    const step = Math.max(0, q.chainStep | 0);
    if (!chain || step >= chain.length) return null;
    const currentStep = Math.max(0, prof.npcQuestChains && prof.npcQuestChains[giver] | 0);
    if (step !== currentStep) return null;
    const def = chain[step];
    if (!NPC_QUEST_REGISTRY.runtimeQuestMatchesDefinition(q, def, giver, step, chain.length)) return null;
    const rebuilt = this.buildNpcQuest(prof, giver, q.role || 'town');
    if (!rebuilt) return null;
    return {
      ...rebuilt,
      have: Math.max(0, Math.min(rebuilt.need | 0, q.have | 0)),
      lifecycleState: ['offered', 'active', 'claimable', 'completed', 'failed', 'expired'].includes(q.lifecycleState) ? q.lifecycleState : 'active',
      offeredAt: Math.max(0, Number(q.offeredAt) || 0),
      acceptedAt: Math.max(0, Number(q.acceptedAt) || 0),
      claimableAt: Math.max(0, Number(q.claimableAt) || 0),
      completedAt: Math.max(0, Number(q.completedAt) || 0),
      expiresAt: Math.max(0, Number(q.expiresAt) || 0),
    };
  }

  npcQuestReady(client, quest) {
    const rec = this.profileFor(client), p = this.state.players.get(client.sessionId);
    if (!rec || !quest) return false;
    if (quest.type === 'fetch') return this.countItem(rec.prof, quest.item | 0) >= (quest.need | 0);
    if (quest.type === 'utility') return Array.isArray(rec.prof.utilityUnlocks) && rec.prof.utilityUnlocks.includes(quest.utility);
    if (quest.type === 'familiar') return Array.isArray(rec.prof.familiarUnlocks) && rec.prof.familiarUnlocks.includes(quest.familiar);
    if (quest.type === 'mount') return Array.isArray(rec.prof.mountUnlocks) && rec.prof.mountUnlocks.some(k => String(k).startsWith('dragon:'));
    if (quest.type === 'mount_use') return !!(p && String(p.mount || '').startsWith('dragon:'));
    return (quest.have | 0) >= (quest.need | 0);
  }

  handleNpcQuest(client, m) {
    const rec = this.profileFor(client), action = m && String(m.action || '');
    if (!rec) return this.progressionReject(client, 'npcQuest', 'invalid');
    if (this.rateLimited(client, 'progression', 8, 16)) return this.progressionReject(client, 'npcQuest', 'rate');
    if (this.profileQuestTrace) this.profileQuestTrace(client, 'npcQuest.request', rec.prof, {
      action,
      giver: m && m.giver || '',
      role: m && m.role || '',
    });
    if (action === 'accept') {
      if (rec.prof.activeNpcQuest) return this.progressionReject(client, 'npcQuest', 'active');
      const giver = String(m.giver || '').replace(/[<>]/g, '').trim().slice(0, 64);
      const q = this.buildNpcQuest(rec.prof, giver, m.role);
      if (!q) return this.progressionReject(client, 'npcQuest', 'offer');
      if (q.type === 'gate' && q.gateRank >= 0 && !this.ensurePublicGateRank(q.gateRank)) {
        return this.progressionReject(client, 'npcQuest', 'gate');
      }
      q.lifecycleState = 'active';
      q.acceptedAt = Date.now();
      const grantRoadReadySword = q.giver === 'Mara Vale' && (q.chainStep | 0) === 1 && !rec.prof.maraRoadReadySwordGranted;
      if (grantRoadReadySword) {
        const draft = { ...rec.prof, inv: (rec.prof.inv || []).map(slot => slot ? { ...slot } : null) };
        if (this.addCraftedRewardItem(draft, I.WOOD_SWORD, 1) !== 0) return this.progressionReject(client, 'npcQuest', 'full');
        rec.prof.inv = draft.inv;
        rec.prof.maraRoadReadySwordGranted = true;
      }
      rec.prof.activeNpcQuest = q;
      if (q.giver === 'Mara Vale' && q.title === 'Road Ready' && ['first_road_ready', ''].includes(rec.prof.progressionFocus || '')) {
        rec.prof.progressionFocus = 'first_road_ready';
      } else if (q.giver === 'Mara Vale' && q.title === 'The First Gate' && ['first_road_ready', 'first_e_gate', ''].includes(rec.prof.progressionFocus || '')) {
        rec.prof.progressionFocus = 'first_e_gate';
      }
      this.dirtyPlayers.add(rec.token);
      if (grantRoadReadySword) this.sendProfile ? this.sendProfile(client, rec.prof) : client.send('profile', rec.prof);
      client.send('npcQuest', {
        action,
        quest: q,
        grantedItems: grantRoadReadySword ? [{ id: I.WOOD_SWORD, count: 1 }] : [],
      });
      if (this.profileQuestTrace) this.profileQuestTrace(client, 'npcQuest.accepted', rec.prof, {
        title: q.title || '',
        giver: q.giver || '',
        chainStep: q.chainStep | 0,
      });
      if (this.refreshNpcQuestReadiness) this.refreshNpcQuestReadiness(client);
      return true;
    }
    if (action === 'abandon') {
      const abandoned = rec.prof.activeNpcQuest;
      rec.prof.activeNpcQuest = null;
      this.dirtyPlayers.add(rec.token);
      client.send('npcQuest', { action, quest: null, abandoned });
      if (abandoned && this.sendQuestOutcome) this.sendQuestOutcome(client, {
        source: abandoned.type === 'manhunt' ? 'manhunt' : 'story',
        questType: abandoned.type === 'manhunt' ? 'manhunt' : 'npc',
        title: abandoned.title || abandoned.chainTitle || 'Town Quest',
        outcome: 'abandoned',
        reason: 'player',
        location: abandoned.giver || 'Quest giver',
        canReaccept: true,
        noReward: true,
      });
      return true;
    }
    if (action !== 'claim') return this.progressionReject(client, 'npcQuest', 'action');
    const q = rec.prof.activeNpcQuest;
    if (!q || !this.npcQuestReady(client, q)) return this.progressionReject(client, 'npcQuest', 'incomplete');
    if (q.type === 'fetch' && !this.consumeItem(rec.prof, q.item | 0, q.need | 0)) return this.progressionReject(client, 'npcQuest', 'items');
    q.lifecycleState = 'completed';
    q.completedAt = Date.now();
    rec.prof.gold = Math.max(0, (rec.prof.gold | 0) + (q.gold | 0));
    if (this.recordEconomyGold) this.recordEconomyGold(client, q.gold | 0, 'quest_faucet', 'npc_quest', { giver: q.giver || '', title: q.title || '' });
    this.grantHunterXp(rec.prof, q.xp, client, 'town_quest');
    let rewardItemOverflow = false;
    for (const it of q.rewardItems || []) if (this.addRewardItem(rec.prof, it.id, it.count)) rewardItemOverflow = true;
    rec.prof.npcQuestChains[q.giver] = Math.max((rec.prof.npcQuestChains[q.giver] | 0), (q.chainStep | 0) + 1);
    let firstQuestMilestone = null;
    if (q.giver === 'Mara Vale' && q.title === 'First Hands' && !rec.prof.firstQuestRewardClaimed) {
      rec.prof.firstQuestRewardClaimed = true;
      rec.prof.gold = Math.max(0, (rec.prof.gold | 0) + 100);
      if (this.recordEconomyGold) this.recordEconomyGold(client, 100, 'quest_faucet', 'first_quest_bonus', { giver: q.giver || '', title: q.title || '' });
      firstQuestMilestone = { gold: 100, totalGold: rec.prof.gold | 0 };
      this.advanceProgressionDirector(client, 'first_hands_claimed', { profile: false });
    }
    if (q.giver === 'Mara Vale' && q.title === 'Road Ready' && (q.chainStep | 0) === 1 && ['first_road_ready', ''].includes(rec.prof.progressionFocus || '')) {
      rec.prof.progressionFocus = 'first_e_gate';
    }
    if (q.giver === 'Mara Vale' && q.type === 'gate' && (q.gateRank | 0) === 0 && (q.chainStep | 0) === 2) {
      this.advanceProgressionDirector(client, 'first_e_gate_cleared', { profile: false });
    }
    rec.prof.activeNpcQuest = null;
    this.grantJobXp(client, 'adventurer', 12);
    this.progressJobContract(client, 'quest', 1, 0);
    client.send('npcQuest', { action, quest: null, completed: q, firstQuestMilestone });
    if (this.profileQuestTrace) this.profileQuestTrace(client, 'npcQuest.claimed', rec.prof, {
      title: q.title || '',
      giver: q.giver || '',
      chainStep: q.chainStep | 0,
      firstQuestMilestone: !!firstQuestMilestone,
    });
    if (firstQuestMilestone) client.send('firstQuestReward', { ok: true, gold: 100, totalGold: firstQuestMilestone.totalGold });
    if (this.sendQuestRewardSummary) this.sendQuestRewardSummary(client, {
      source: q.type === 'manhunt' ? 'manhunt' : 'story',
      questType: q.type === 'manhunt' ? 'manhunt' : 'npc',
      title: q.title || q.chainTitle || 'Town Quest',
      gold: q.gold | 0,
      xp: q.xp | 0,
      jobXp: 12,
      job: 'adventurer',
      contractType: q.type || '',
      chainStep: q.chainStep | 0,
      giver: q.giver || '',
      items: q.rewardItems || [],
      claimLocation: q.giver || 'Quest giver',
      inventoryOverflow: rewardItemOverflow,
    });
    // Present completion before the profile update that may cross a level
    // threshold; the client can then hold path selection behind the reward.
    this.progressionChanged(client, 'npcQuest', { action, rewardGold: q.gold | 0, rewardXp: q.xp | 0, giver: q.giver });
    return true;
  }

  progressNpcQuest(client, type, count = 1, target = 0) {
    const rec = this.profileFor(client), q = rec && rec.prof.activeNpcQuest;
    const compatible = q && (q.type === type || (q.type === 'manhunt' && type === 'kill'));
    if (!compatible || (q.have | 0) >= (q.need | 0)) return false;
    if (q.item && target && (q.item | 0) !== (target | 0)) return false;
    if (type === 'gate' && q.gateRank >= 0 && (q.gateRank | 0) !== (target | 0)) return false;
    q.have = Math.min(q.need | 0, (q.have | 0) + Math.max(1, count | 0));
    if ((q.have | 0) >= (q.need | 0)) {
      q.lifecycleState = 'claimable';
      q.claimableAt = Date.now();
    }
    this.dirtyPlayers.add(rec.token);
    client.send('npcQuest', { action: 'progress', quest: q });
    if (this.activeQuestObjectives) client.send('progressionFocus', { focus: rec.prof.progressionFocus || '', activeObjectives: this.activeQuestObjectives(client, rec.prof) });
    return true;
  }

  refreshNpcQuestReadiness(client) {
    const rec = this.profileFor(client), q = rec && rec.prof.activeNpcQuest, p = this.state.players.get(client.sessionId);
    if (!rec || !q) return false;
    const need = Math.max(1, q.need | 0);
    let current = -1;
    if (q.type === 'fetch') current = this.countItem(rec.prof, q.item | 0);
    else if (q.type === 'utility') current = Array.isArray(rec.prof.utilityUnlocks) && rec.prof.utilityUnlocks.includes(q.utility) ? need : 0;
    else if (q.type === 'familiar') current = Array.isArray(rec.prof.familiarUnlocks) && rec.prof.familiarUnlocks.includes(q.familiar) ? need : 0;
    else if (q.type === 'mount') current = Array.isArray(rec.prof.mountUnlocks) && rec.prof.mountUnlocks.some(k => String(k).startsWith('dragon:')) ? need : 0;
    else if (q.type === 'mount_use') current = p && String(p.mount || '').startsWith('dragon:') ? need : 0;
    else return false;
    current = Math.max(0, Math.min(need, current));
    const previous = Math.max(0, Math.min(need, q.have | 0));
    const previousState = q.lifecycleState || 'active';
    q.have = current;
    if (current >= need) q.lifecycleState = 'claimable';
    else q.lifecycleState = 'active';
    if (q.lifecycleState === 'claimable' && previousState !== 'claimable') q.claimableAt = Date.now();
    const changed = current !== previous || (q.lifecycleState || 'active') !== previousState;
    if (!changed) return false;
    this.dirtyPlayers.add(rec.token);
    client.send('npcQuest', { action: 'progress', quest: q });
    if (this.activeQuestObjectives) client.send('progressionFocus', { focus: rec.prof.progressionFocus || '', activeObjectives: this.activeQuestObjectives(client, rec.prof) });
    return true;
  }

  handleClaimAegisTrial(client) {
    const rec = this.profileFor(client);
    if (!rec || !rec.prof.aegisTrialReady) return this.progressionReject(client, 'aegisTrial', 'incomplete');
    const lvl = Math.max(1, rec.prof.S.lvl | 0), rewardGold = 135 + lvl * 8;
    const rewardXp = Math.max(130 + lvl * 12, hunterXpForActivity(lvl, 'aegis_trial'));
    rec.prof.aegisTrialReady = false;
    rec.prof.aegisTrial = null;
    rec.prof.gold = Math.max(0, (rec.prof.gold | 0) + rewardGold);
    if (this.recordEconomyGold) this.recordEconomyGold(client, rewardGold, 'quest_faucet', 'aegis_trial', { level: lvl });
    this.grantHunterXp(rec.prof, rewardXp, client, 'aegis_trial');
    let reward;
    const roll = Math.random();
    if (roll < .45) reward = { kind: 'Rare Weapon', id: Math.random() < .5 ? I.DIA_SWORD : I.IRON_SWORD };
    else if (roll < .8) {
      const armorPool = [I.CHAIN_ARMOR, I.IRON_ARMOR, I.DIA_ARMOR, I.STORMGLASS_ARMOR];
      reward = { kind: 'Rare Armor', id: armorPool[(Math.random() * armorPool.length) | 0] };
    }
    else if (!rec.prof.familiarUnlocks.includes('shade')) {
      rec.prof.familiarUnlocks.push('shade');
      if (this.refreshNpcQuestReadiness) this.refreshNpcQuestReadiness(client);
      reward = { kind: 'Shade Familiar', id: I.SHADOW_SIGIL, unlocked: true };
    } else reward = { kind: 'Shade Sigil', id: I.SHADOW_SIGIL };
    let aegisOverflow = false;
    if (!reward.unlocked) {
      if(ARMOR_INFO[reward.id]){
        const types=['scout','vanguard','bulwark'],armorType=types[(Math.random()*types.length)|0];
        aegisOverflow = !!this.addGearRewardItem(rec.prof,{id:reward.id,count:1,rarity:'rare',armorType,source:'aegis_trial',gear:true});
        reward.armorType=armorType;reward.rarity='rare';
      }else aegisOverflow = !!this.addRewardItem(rec.prof, reward.id, 1);
    }
    this.grantJobXp(client, 'adventurer', 12);
    this.progressJobContract(client, 'quest', 1, 0);
    this.progressionChanged(client, 'aegisTrial', { rewardGold, rewardXp });
    if (this.sendQuestRewardSummary) this.sendQuestRewardSummary(client, {
      source: 'aegis',
      questType: 'manhunt',
      title: 'Silent Bounty',
      gold: rewardGold,
      xp: rewardXp,
      jobXp: 12,
      job: 'adventurer',
      items: reward.id && !ARMOR_INFO[reward.id] ? [{ id: reward.id, count: 1 }] : [],
      gear: reward.id && ARMOR_INFO[reward.id] ? { id: reward.id, count: 1, rarity: reward.rarity || 'rare', name: reward.kind || 'Rare Armor' } : null,
      claimLocation: 'Aegis Guardian',
      inventoryOverflow: aegisOverflow,
    });
    client.send('aegisTrialReward', { rewardGold, rewardXp, reward });
    return true;
  }

  handleEquipArmor(client, m) {
    const rec = this.profileFor(client);
    const id = Math.max(0, (m && m.id) | 0);
    if (!rec) return this.progressionReject(client, 'armor', 'invalid');
    if (!Array.isArray(rec.prof.inv)) rec.prof.inv = [];
    const equipped = rec.prof.armor && ARMOR_INFO[rec.prof.armor.id] ? rec.prof.armor : null;
    if (id === 0) {
      if (equipped) {
        if (this.inventorySpaceFor(rec.prof, equipped.id, 1) < 1) return this.progressionReject(client, 'armor', 'full');
        rec.prof.armor = null;
        const target=rec.prof.inv.findIndex(s=>!s);
        const index=target>=0?target:rec.prof.inv.length;
        rec.prof.inv[index]={...equipped,count:1};
      }
      rec.prof.armor = null;
    } else {
      if (!ARMOR_INFO[id]) return this.progressionReject(client, 'armor', 'item');
      const requestedRank=GEAR_SYSTEM.RANKS.some((r,i)=>i<6&&r.id===m.gearRank)?m.gearRank:'';
      const requestedRarity=GEAR_SYSTEM.RARITIES.some(r=>r.id===m.rarity)?m.rarity:'';
      const requestedType=GEAR_SYSTEM.ARMOR_ARCHETYPES[m.armorType]?m.armorType:'';
      const hinted=Math.max(0,Math.min(35,m&&m.slot|0));
      const matches=s=>s&&(s.id|0)===id&&(s.count|0)>0&&(!requestedRank||s.gearRank===requestedRank)&&(!requestedRarity||(s.rarity||'common')===requestedRarity)&&(!requestedType||(s.armorType||ARMOR_INFO[id].armorType||'vanguard')===requestedType);
      const slot=matches(rec.prof.inv[hinted])?hinted:rec.prof.inv.findIndex(matches);
      if (slot < 0) return this.progressionReject(client, 'armor', 'unowned');
      const incoming = rec.prof.inv[slot];
      const equippedStack={...incoming,count:1};
      if (equipped) rec.prof.inv[slot] = {...equipped,count:1};
      else if ((incoming.count | 0) > 1) incoming.count--;
      else rec.prof.inv[slot] = null;
      rec.prof.armor = equippedStack;
    }
    return this.progressionChanged(client, 'armor', { id });
  }

  handleEquipWeapon(client,m){
    const rec=this.profileFor(client);
    if(!rec||!Array.isArray(rec.prof.inv))return this.progressionReject(client,'weaponEquip','invalid');
    const slot=Math.max(0,Math.min(35,m&&m.slot|0)),hotbar=Math.max(0,Math.min(8,m&&m.hotbar|0));
    const stack=rec.prof.inv[slot],info=stack&&TOOL_INFO[stack.id];
    if(!info||!['sword','axe'].includes(info.cls))return this.progressionReject(client,'weaponEquip','item');
    if(slot!==hotbar)[rec.prof.inv[slot],rec.prof.inv[hotbar]]=[rec.prof.inv[hotbar]||null,stack];
    this.progressionChanged(client,'weaponEquip',{slot:hotbar,id:stack.id});
    client.send('weaponEquipResult',{ok:true,slot:hotbar,id:stack.id});
    return true;
  }

  recordMineProgress(client, blockId) {
    const xp = blockId === W.B.DIAMOND_ORE ? 8 : blockId === W.B.IRON_ORE ? 5 : 2;
    this.grantJobXp(client, 'miner', xp);
    this.progressJobContract(client, 'mine', 1, blockId);
    this.progressNpcQuest(client, 'mine', 1, blockId);
  }

  recordTreasureProgress(client) {
    this.grantJobXp(client, 'miner', 6);
    this.progressJobContract(client, 'treasure', 1, 0);
    this.progressNpcQuest(client, 'treasure', 1, 0);
  }

  recordAncientMapProgress(client) {
    this.grantJobXp(client, 'miner', 10);
    this.progressJobContract(client, 'ancient_map', 1, 0);
  }

  playerNearCaveRoute(p) {
    if (!p || p.dgn) return null;
    const surface = W.terrainHeight(Math.floor(p.x), Math.floor(p.z));
    if (p.y > Math.min(surface - 4, 32)) return null;
    for (const net of W.caveNetworkSpecs()) {
      for (const point of net.points) {
        if (Math.hypot(p.x - point.x, p.z - point.z) <= 15 && Math.abs(p.y - point.y) <= 8) return { id: net.id, type: 'cave_network', x: point.x, y: point.y, z: point.z };
      }
      for (const c of net.caverns) {
        if (Math.hypot(p.x - c.x, p.z - c.z) <= Math.max(c.rx, c.rz) + 8 && Math.abs(p.y - c.y) <= c.ry + 6) return { id: net.id, type: 'cavern', x: c.x, y: c.y, z: c.z };
      }
    }
    for (const city of W.ancientCitySpecs()) {
      if (Math.hypot(p.x - city.x, p.z - city.z) <= city.radius + 8 && Math.abs(p.y - city.y) <= 10) return { id: city.id, type: 'ancient_city', x: city.x, y: city.y, z: city.z };
    }
    return null;
  }

  tickCaveSurveyContracts(now = Date.now()) {
    if (!this.caveSurveyProgressAt) this.caveSurveyProgressAt = new Map();
    if (!this.caveSurveySites) this.caveSurveySites = new Map();
    this.state.players.forEach((p, sid) => {
      const client = this.clients.find(c => c.sessionId === sid);
      const rec = client && this.profileFor(client);
      const c = rec && rec.prof.jobContract;
      if (!client || !c || c.type !== 'cave_survey' || (c.have | 0) >= (c.need | 0)) return;
      const route = this.playerNearCaveRoute(p);
      if (!route) return;
      const contractKey = sid + ':' + String(c.id || 'cave_survey');
      let visited = this.caveSurveySites.get(contractKey);
      if (!visited) { visited = new Set(); this.caveSurveySites.set(contractKey, visited); }
      const routeKey = route.id + ':' + route.type;
      if (visited.has(routeKey)) return;
      const key = contractKey + ':' + routeKey;
      if (now < (this.caveSurveyProgressAt.get(key) || 0)) return;
      this.caveSurveyProgressAt.set(key, now + 9000);
      visited.add(routeKey);
      this.grantJobXp(client, 'miner', route.type === 'ancient_city' ? 8 : 5);
      if (this.progressJobContract(client, 'cave_survey', 1, 0)) client.send('chat', { name: '[Miner]', text: route.type === 'ancient_city' ? 'Ancient survey marker recorded.' : 'Cave survey marker recorded.' });
    });
  }

  recordFarmProgress(client, action) {
    const target = action === 'harvest' ? W.B.WHEAT_3 : action === 'plant' ? I.WHEAT_SEEDS : W.B.FARMLAND;
    this.grantJobXp(client, 'farmer', action === 'harvest' ? 5 : 1);
    this.progressJobContract(client, 'farm', 1, target);
    this.progressNpcQuest(client, 'farm', 1, target);
  }

  recordCraftProgress(client, id, count) {
    count = Math.max(1, count | 0);
    if ([I.BREAD, I.HEARTY_SANDWICH, I.DRAGON_TREAT, I.COOKED_MEAT, I.GOLDEN_BROTH, I.TRAIL_RATION, I.FEAST_PLATTER].includes(id)) {
      const xp = id === I.FEAST_PLATTER ? 20 : id === I.TRAIL_RATION ? 10 : id === I.GOLDEN_BROTH ? 8 : id === I.DRAGON_TREAT ? 6 : id === I.COOKED_MEAT ? 4 : 5;
      this.grantJobXp(client, 'cook', xp * count);
      this.progressJobContract(client, 'cook', count, id);
      this.progressNpcQuest(client, 'cook', count, id);
      const rec = this.profileFor(client);
      if (id === I.DRAGON_TREAT && rec && rec.prof && rec.prof.job === 'pet_tamer') {
        this.grantJobXp(client, 'pet_tamer', 8 * count);
        this.progressJobContract(client, 'pet_care', count, id);
      }
    }
    if (TOOL_INFO[id] || ARMOR_INFO[id] || id === I.REPAIR_KIT || id === I.IRON_INGOT) {
      const xp = ARMOR_INFO[id] ? 14 : TOOL_INFO[id] ? 8 : id === I.REPAIR_KIT ? 6 : 3;
      this.grantJobXp(client, 'blacksmith', xp * count);
      this.progressJobContract(client, 'smith', count, id);
      this.progressNpcQuest(client, 'smith', count, id);
    }
  }

  recordRepairProgress(client, upgraded = false) {
    this.grantJobXp(client, 'blacksmith', upgraded ? 10 : 5);
    if (upgraded) this.progressJobContract(client, 'upgrade', 1, 0) || this.progressJobContract(client, 'smith', 1, 0);
    else this.progressJobContract(client, 'repair', 1, 0);
  }

  recordSalvageProgress(client, itemId = 0) {
    this.grantJobXp(client, 'blacksmith', 6);
    this.progressJobContract(client, 'salvage', 1, itemId) || this.progressJobContract(client, 'smith', 1, itemId);
  }

  recordKillProgress(client, hostile = true) {
    // Kill objectives ("defeat hostile creatures") must not be satisfied by
    // slaughtering passive animals, which have their own 'hunt' reward path.
    if (!hostile) return;
    this.grantJobXp(client, 'adventurer', 3);
    this.progressJobContract(client, 'kill', 1, 0);
    this.progressNpcQuest(client, 'kill', 1, 0);
  }

  recordHuntProgress(client) {
    const rec = this.profileFor(client);
    if (rec && rec.prof && rec.prof.job === 'pet_tamer') this.grantJobXp(client, 'pet_tamer', 4);
    else this.grantJobXp(client, 'cook', 4);
    this.progressJobContract(client, 'hunt', 1, 0);
  }

  recordGateProgress(client, rank = 0) {
    const rec = this.profileFor(client);
    this.grantJobXp(client, 'adventurer', 18);
    this.progressJobContract(client, 'gate', 1, 0);
    this.progressNpcQuest(client, 'gate', 1, rank);
    if (rec && rec.prof.progressionFocus === 'first_d_gate' && (rank | 0) >= 1) {
      rec.prof.progressionFocus = 'next_adventurer_contract';
      this.dirtyPlayers.add(rec.token);
      this.sendProfile ? this.sendProfile(client, rec.prof) : client.send('profile', rec.prof);
    }
  }

  recordEventProgress(client) {
    this.grantJobXp(client, 'adventurer', 12);
    this.progressJobContract(client, 'event', 1, 0);
  }

  recordTavernSaleProgress(client, id, count) {
    if (![I.WHEAT, I.GOLDEN_WHEAT, I.BREAD, I.POT_STEW, I.MONSTER_MEAT, I.COOKED_MEAT, I.GOLDEN_BROTH, I.TRAIL_RATION].includes(id)) return;
    this.grantJobXp(client, 'cook', 3 * Math.max(1, count | 0));
    this.progressJobContract(client, 'sell', Math.max(1, count | 0), id);
    this.progressNpcQuest(client, 'sell', Math.max(1, count | 0), id);
  }
}

module.exports = ProgressionMixin.prototype;
