const W = require('../world');
const { hunterXpForActivity } = require('./xp-economy');
const {
  ARMOR_INFO, I, JOB_IDS, TOOL_INFO, hunterActivityXpForLevel, jobLevelFromXp, jobPerkTier,
} = require('./constants');

const STAT_KEYS = new Set(['str', 'agi', 'vit', 'int']);

// One-time starter kit handed out when the first Adventurer contract graduates.
// Declared once so placement and the client manifest can't drift. `crafted` items
// take a slot each (no stacking); `dur` pins a worn-in durability on the pick.
const GRADUATION_REWARD = Object.freeze([
  Object.freeze({ id: I.IRON_SWORD, count: 1, crafted: true }),
  Object.freeze({ id: I.IRON_PICK, count: 1, crafted: true, dur: Math.max(1, Math.floor(TOOL_INFO[I.IRON_PICK].dur * .4)) }),
  Object.freeze({ id: I.IRON_INGOT, count: 8 }),
  Object.freeze({ id: I.REPAIR_KIT, count: 1 }),
]);

// Compact trusted copies of the town quest chains. Fields: title, type, item/requirement,
// need, base gold, base XP, optional reward items.
const Q = (title, type, item, need, gold, xp, rewardItems = [], extra = {}) => ({ title, type, item, need, gold, xp, rewardItems, ...extra });
const NPC_QUEST_CHAINS = {
  'Mara Vale': [
    Q('First Hands','fetch',W.B.LOG,6,16,28,[],{levelTarget:2,desc:'Gather 6 logs beyond the walls. This first field task will take you to Level 2.'}),
    Q('Road Ready','kill',0,3,24,47,[],{levelTarget:3,desc:'Take this wooden sword and defeat 3 monsters beyond town. Return ready for Level 3 and your first Gate.'}),
    Q('The First Gate','gate',0,1,50,60,[],{gateRank:0,desc:'An E-rank Gate has opened for you. Find it, clear it, and return to Mara.'}),
    Q('A Better Sense','utility','compass',1,42,58),Q('Meat Becomes Gold','sell',I.MONSTER_MEAT,1,38,54,[{id:I.SHADOW_SIGIL,count:1}]),Q('A Shadow Companion','familiar','shade',1,52,72,[{id:W.B.EGG_INSULATOR,count:1},{id:I.DRAGON_EGG,count:1}]),Q('First Bonded Mount','mount','dragon',1,78,100),Q('Sky Legs','mount_use','dragon',1,64,88)
  ],
  'Garrik Flint': [Q('Stonehand Trial','fetch',W.B.COBBLE,18,24,34),Q('Coal Mark','mine',W.B.COAL_ORE,6,34,46),Q('Iron Below','mine',W.B.IRON_ORE,5,48,64)],
  'Tobin Ashhand': [Q('Forge Fuel','mine',W.B.COAL_ORE,5,30,42),Q('Smith Stock','fetch',I.IRON_INGOT,3,48,66),Q('A Practical Edge','fetch',I.REPAIR_KIT,1,64,84)],
  'Edda Quill': [Q('Gate Notes','gate',0,1,72,80),Q('Crystal Harmonics','mine',W.B.DIAMOND_ORE,2,90,100),Q('Scholar Supplies','fetch',W.B.GLASS,8,44,58)],
  'Bram Ledger': [Q('Crates And Claims','fetch',W.B.PLANKS,20,28,34),Q('Road Reserve','fetch',W.B.COBBLE,20,32,40),Q('Night Stock','fetch',W.B.TORCH,10,42,52)],
  'Liss Barley': [Q('Field Hands','fetch',I.WHEAT,8,30,42),Q('Bread Line','fetch',I.BREAD,3,42,54),Q('Care Feed','fetch',I.DRAGON_TREAT,1,62,74)],
  'Pippa Hearth': [Q('Warm Meals','fetch',I.COOKED_MEAT,3,36,46),Q('Travel Bread','fetch',I.BREAD,3,40,52),Q('Roost Treats','fetch',I.DRAGON_TREAT,1,64,78)],
  'Oren Mortar': [Q('Foundation Check','fetch',W.B.COBBLE,22,32,42),Q('Pane Work','fetch',W.B.GLASS,8,40,50),Q('Brick Sense','fetch',W.B.BRICK,12,50,64)],
  'Sable Venn': [Q('Quiet Watch','kill',0,3,34,48),Q('Candle Reserve','fetch',W.B.TORCH,8,38,50),Q('Stillness After Storm','gate',0,1,76,86)],
  'Pell Graywatch': [Q('Wall Patrol','kill',0,5,38,54),Q('Patrol Gear','fetch',W.B.TORCH,10,42,54),Q('Gate Duty','gate',0,1,82,92)],
  'Greta Warmug': [Q('Cellar Supper','fetch',I.COOKED_MEAT,3,38,48),Q('Breakfast Rush','fetch',I.BREAD,4,46,56),Q('House Specialty','fetch',I.HEARTY_SANDWICH,1,68,82)],
  'Rook Emberstall': [Q('Roost Manners','fetch',I.WHEAT,6,34,44),Q('Treat Training','fetch',I.DRAGON_TREAT,1,70,82),Q('Sky Stock','fetch',W.B.PLANKS,24,50,62)],
};

function contractPools(job, scale) {
  return {
    adventurer: [
      { type: 'kill', need: 8 + scale * 2, title: 'Road Patrol', desc: 'Defeat hostile creatures beyond town.', rewardGold: 30 + scale * 5, rewardJobXp: 18 + scale * 4 },
      { type: 'gate', need: 1 + Math.min(2, (scale / 3) | 0), title: 'Gate Watch', desc: 'Clear active gates for the Hunter Guild.', rewardGold: 48 + scale * 6, rewardJobXp: 28 + scale * 5 },
      { type: 'event', need: 1, title: 'Server Duty', desc: 'Complete a server event.', rewardGold: 44 + scale * 5, rewardJobXp: 24 + scale * 5 },
    ],
    miner: [
      { type: 'mine', target: W.B.STONE, need: 20 + scale * 4, title: 'Stone Quota', desc: 'Mine stone or cobblestone for town repairs.', rewardGold: 24 + scale * 4, rewardJobXp: 16 + scale * 4 },
      { type: 'mine', target: W.B.IRON_ORE, need: 5 + scale, title: 'Iron Survey', desc: 'Mine iron ore for the forge.', rewardGold: 38 + scale * 5, rewardJobXp: 22 + scale * 5 },
    ],
    farmer: [
      { type: 'farm', need: 14 + scale * 3, title: 'Field Hand', desc: 'Till, plant, and harvest crops for town stores.', rewardGold: 26 + scale * 4, rewardJobXp: 16 + scale * 4 },
      { type: 'farm', target: W.B.WHEAT_3, need: 5 + scale, title: 'Harvest Basket', desc: 'Harvest ripe wheat for the tavern kitchen.', rewardGold: 34 + scale * 4, rewardJobXp: 20 + scale * 4 },
    ],
    cook: [
      { type: 'cook', need: 5 + scale, title: 'Kitchen Shift', desc: 'Cook, bake, or prepare meals for hungry townsfolk.', rewardGold: 34 + scale * 5, rewardJobXp: 20 + scale * 4 },
      { type: 'sell', need: 6 + scale * 2, title: 'Tavern Supplier', desc: 'Sell food to the tavern counter.', rewardGold: 30 + scale * 4, rewardJobXp: 18 + scale * 4 },
    ],
    blacksmith: [
      { type: 'smith', need: 5 + scale, title: 'Forge Work', desc: 'Smelt, craft tools, make armor, or build repair kits.', rewardGold: 38 + scale * 5, rewardJobXp: 22 + scale * 5 },
      { type: 'repair', need: 2 + Math.min(3, scale), title: 'Tool Doctor', desc: 'Repair worn tools.', rewardGold: 42 + scale * 5, rewardJobXp: 24 + scale * 5 },
    ],
    monk: [
      { type: 'meditate', need: 60 + scale * 15, title: 'Quiet Vigil', desc: 'Meditate inside the Town Shrine and hold focus.', rewardGold: 24 + scale * 4, rewardJobXp: 22 + scale * 5 },
      { type: 'meditate', need: 90 + scale * 20, title: 'Deep Stillness', desc: 'Keep a longer meditation so the shrine can settle around you.', rewardGold: 36 + scale * 5, rewardJobXp: 30 + scale * 6 },
    ],
  }[job] || [];
}

class ProgressionMixin {
  progressionChanged(client, type, extra = {}) {
    const rec = this.profileFor(client);
    if (!rec) return false;
    this.syncPlayerProfile(client, rec.prof);
    this.dirtyPlayers.add(rec.token);
    client.send('profile', rec.prof);
    client.send('progressionResult', { ok: true, type, ...extra });
    return true;
  }

  progressionReject(client, type, reason) {
    if (type === 'armor') {
      const rec = this.profileFor(client);
      if (rec) client.send('profile', rec.prof);
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
    const job = m && typeof m.job === 'string' ? m.job : '';
    if (!rec || !JOB_IDS.has(job)) return this.progressionReject(client, 'job', 'invalid');
    if (this.rateLimited(client, 'progression', 8, 16)) return this.progressionReject(client, 'job', 'rate');
    if (rec.prof.job !== job) {
      rec.prof.job = job;
      rec.prof.jobContract = null;
    }
    if (rec.prof.progressionFocus === 'first_promotion_job' && job === 'adventurer') {
      rec.prof.progressionFocus = 'first_promotion_contract';
    }
    return this.progressionChanged(client, 'job', { job });
  }

  makeServerJobContract(prof) {
    const job = prof && prof.job;
    if (!job) return null;
    const scale = Math.max(0, jobLevelFromXp(prof.jobXp) - 1);
    const level = Math.max(1, prof && prof.S ? prof.S.lvl | 0 : 1);
    if (job === 'adventurer' && !(prof.adventurerContractsCompleted | 0)) {
      return {
        job, type: 'kill', need: 3, have: 0,
        title: "Mara's Field Work", desc: 'Defeat 3 hostile creatures beyond the town walls.',
        rewardGold: 34, rewardJobXp: 20, rewardXp: hunterXpForActivity(level, 'job_contract'),
      };
    }
    const pool = contractPools(job, scale).filter(contract => contract.type !== 'gate' || level >= 3);
    if (!pool.length) return null;
    return { ...pool[(Math.random() * pool.length) | 0], job, have: 0, rewardXp: hunterXpForActivity(level, 'job_contract') };
  }

  handleJobContract(client, m) {
    const rec = this.profileFor(client);
    const action = m && typeof m.action === 'string' ? m.action : '';
    if (!rec || !rec.prof.job) return this.progressionReject(client, 'jobContract', 'job');
    if (this.rateLimited(client, 'progression', 8, 16)) return this.progressionReject(client, 'jobContract', 'rate');
    if (action === 'take') {
      if (rec.prof.jobContract) return this.progressionReject(client, 'jobContract', 'active');
      rec.prof.jobContract = this.makeServerJobContract(rec.prof);
      // 'first_promotion_contract' specifically guides taking the first adventurer
      // contract; 'next_adventurer_contract' just nudges back to the board, so any
      // contract take clears it (otherwise a job switch could strand the objective).
      if (rec.prof.progressionFocus === 'next_adventurer_contract' ||
          (rec.prof.progressionFocus === 'first_promotion_contract' && rec.prof.job === 'adventurer')) {
        rec.prof.progressionFocus = '';
      }
    } else if (action === 'abandon') {
      rec.prof.jobContract = null;
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
      const rewardXp = Math.max(0, c.rewardXp | 0);
      this.grantHunterXp(rec.prof, rewardXp, client, 'job_contract');
      rec.prof.jobXp = Math.max(0, (rec.prof.jobXp | 0) + Math.max(0, c.rewardJobXp | 0));
      if (c.job === 'adventurer') rec.prof.adventurerContractsCompleted = Math.max(0, (rec.prof.adventurerContractsCompleted | 0) + 1);
      if (graduation) {
        rec.prof.inv = graduationInventory;
        this.unlockUtility(client, 'compass', 'First Adventurer contract complete');
        rec.prof.progressionFocus = 'first_d_gate';
        this.ensurePublicGateRank(1);
      }
      rec.prof.jobContract = null;
      return this.progressionChanged(client, 'jobContract', {
        action, rewardGold, rewardXp, graduation,
        rewardItems: graduation ? GRADUATION_REWARD.map(r => ({ id: r.id, count: r.count })) : [],
      });
    } else return this.progressionReject(client, 'jobContract', 'action');
    return this.progressionChanged(client, 'jobContract', { action });
  }

  grantJobXp(client, job, amount) {
    const rec = this.profileFor(client);
    amount = Math.max(0, Math.min(1000, Math.round(Number(amount) || 0)));
    if (!rec || !amount || rec.prof.job !== job) return false;
    rec.prof.jobXp = Math.max(0, (rec.prof.jobXp | 0) + amount);
    this.dirtyPlayers.add(rec.token);
    this.syncPlayerProfile(client, rec.prof);
    client.send('jobProgress', { job, jobXp: rec.prof.jobXp | 0, contract: rec.prof.jobContract || null });
    return true;
  }

  progressJobContract(client, type, count = 1, target = 0) {
    const rec = this.profileFor(client);
    const c = rec && rec.prof.jobContract;
    if (!c || c.job !== rec.prof.job || c.type !== type || (c.have | 0) >= (c.need | 0)) return false;
    if (c.target && target && (c.target | 0) !== (target | 0)) {
      const stonePair = type === 'mine' && [W.B.STONE, W.B.COBBLE].includes(c.target | 0) && [W.B.STONE, W.B.COBBLE].includes(target | 0);
      if (!stonePair) return false;
    }
    c.have = Math.min(c.need | 0, (c.have | 0) + Math.max(1, count | 0));
    this.dirtyPlayers.add(rec.token);
    client.send('jobProgress', { job: rec.prof.job, jobXp: rec.prof.jobXp | 0, contract: c });
    return true;
  }

  handleMeditateTick(client) {
    const rec = this.profileFor(client);
    const p = this.state.players.get(client.sessionId);
    if (!rec || !p || rec.prof.job !== 'monk' || p.dgn) return this.progressionReject(client, 'meditate', 'invalid');
    if (this.rateLimited(client, 'meditate', 1, 2)) return this.progressionReject(client, 'meditate', 'rate');
    // Meditation hall center mirrors the deterministic town build (47.5, 48 in town-local coordinates).
    const sx = W.TOWN.TC - 16.5, sz = W.TOWN.TC - 16;
    if (Math.hypot(p.x - sx, p.z - sz) > 9) return this.progressionReject(client, 'meditate', 'range');
    this.grantJobXp(client, 'monk', 2);
    this.progressJobContract(client, 'meditate', 5, 0);
    return true;
  }

  buildNpcQuest(prof, giver, role = 'town') {
    const chain = NPC_QUEST_CHAINS[giver];
    const step = Math.max(0, Math.min(chain ? chain.length : 0, (prof.npcQuestChains && prof.npcQuestChains[giver]) | 0));
    if (!chain || step >= chain.length) return null;
    const def = chain[step], lvl = Math.max(1, prof.S.lvl | 0);
    const textTarget = typeof def.item === 'string' ? def.item : def.item ? 'the listed supplies' : 'the objective';
    const quest = {
      source: 'npc', giver, role: String(role || 'town').slice(0, 32), chainKey: giver, chainStep: step, chainTotal: chain.length,
      chainTitle: def.title, title: def.title, type: def.type, need: def.need, have: 0,
      gold: Math.round(def.gold + lvl * 2 + step * 4),
      xp: Math.max(Math.round(def.xp + lvl * 5 + step * 6), hunterXpForActivity(lvl, 'town_quest')),
      desc: def.desc || (def.type === 'fetch' ? `Bring ${def.need} of ${textTarget}.` : `Complete ${def.need} ${def.type} objective${def.need === 1 ? '' : 's'}.`),
      rewardItems: def.rewardItems || [],
    };
    if ((def.levelTarget | 0) > lvl) {
      let targetXp = 0, targetLvl = lvl, carriedXp = Math.max(0, prof.S.xp | 0);
      while (targetLvl < (def.levelTarget | 0)) {
        targetXp += Math.max(0, this.xpNeed(targetLvl) - carriedXp);
        targetLvl++;
        carriedXp = 0;
      }
      quest.xp = Math.max(quest.xp, targetXp);
      quest.levelTarget = def.levelTarget | 0;
    }
    if (def.gateRank != null) quest.gateRank = Math.max(0, Math.min(4, def.gateRank | 0));
    if (typeof def.item === 'number') quest.item = def.item;
    else if (def.type === 'utility') quest.utility = def.item;
    else if (def.type === 'familiar') quest.familiar = def.item;
    else if (def.type === 'mount' || def.type === 'mount_use') quest.mount = def.item;
    return quest;
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
    if (action === 'accept') {
      if (rec.prof.activeNpcQuest) return this.progressionReject(client, 'npcQuest', 'active');
      const giver = String(m.giver || '').replace(/[<>]/g, '').trim().slice(0, 64);
      const q = this.buildNpcQuest(rec.prof, giver, m.role);
      if (!q) return this.progressionReject(client, 'npcQuest', 'offer');
      if (q.type === 'gate' && q.gateRank >= 0 && !this.ensurePublicGateRank(q.gateRank)) {
        return this.progressionReject(client, 'npcQuest', 'gate');
      }
      const grantRoadReadySword = q.giver === 'Mara Vale' && (q.chainStep | 0) === 1 && !rec.prof.maraRoadReadySwordGranted;
      if (grantRoadReadySword) {
        const draft = { ...rec.prof, inv: (rec.prof.inv || []).map(slot => slot ? { ...slot } : null) };
        if (this.addCraftedRewardItem(draft, I.WOOD_SWORD, 1) !== 0) return this.progressionReject(client, 'npcQuest', 'full');
        rec.prof.inv = draft.inv;
        rec.prof.maraRoadReadySwordGranted = true;
      }
      rec.prof.activeNpcQuest = q;
      this.dirtyPlayers.add(rec.token);
      if (grantRoadReadySword) client.send('profile', rec.prof);
      client.send('npcQuest', {
        action,
        quest: q,
        grantedItems: grantRoadReadySword ? [{ id: I.WOOD_SWORD, count: 1 }] : [],
      });
      return true;
    }
    if (action === 'abandon') {
      rec.prof.activeNpcQuest = null;
      this.dirtyPlayers.add(rec.token);
      client.send('npcQuest', { action, quest: null });
      return true;
    }
    if (action !== 'claim') return this.progressionReject(client, 'npcQuest', 'action');
    const q = rec.prof.activeNpcQuest;
    if (!q || !this.npcQuestReady(client, q)) return this.progressionReject(client, 'npcQuest', 'incomplete');
    if (q.type === 'fetch' && !this.consumeItem(rec.prof, q.item | 0, q.need | 0)) return this.progressionReject(client, 'npcQuest', 'items');
    rec.prof.gold = Math.max(0, (rec.prof.gold | 0) + (q.gold | 0));
    this.grantHunterXp(rec.prof, q.xp, client, 'town_quest');
    for (const it of q.rewardItems || []) this.addRewardItem(rec.prof, it.id, it.count);
    rec.prof.npcQuestChains[q.giver] = Math.max((rec.prof.npcQuestChains[q.giver] | 0), (q.chainStep | 0) + 1);
    if (q.giver === 'Mara Vale' && q.type === 'gate' && (q.gateRank | 0) === 0 && (q.chainStep | 0) === 2) {
      rec.prof.progressionFocus = rec.prof.job === 'adventurer'
        ? (rec.prof.jobContract ? '' : 'first_promotion_contract')
        : 'first_promotion_job';
      rec.prof.firstPromotionSeen = false;
    }
    rec.prof.activeNpcQuest = null;
    this.grantJobXp(client, 'adventurer', 12);
    this.progressJobContract(client, 'quest', 1, 0);
    this.progressionChanged(client, 'npcQuest', { action, rewardGold: q.gold | 0, rewardXp: q.xp | 0, giver: q.giver });
    client.send('npcQuest', { action, quest: null, completed: q });
    return true;
  }

  progressNpcQuest(client, type, count = 1, target = 0) {
    const rec = this.profileFor(client), q = rec && rec.prof.activeNpcQuest;
    if (!q || q.type !== type || (q.have | 0) >= (q.need | 0)) return false;
    if (q.item && target && (q.item | 0) !== (target | 0)) return false;
    if (type === 'gate' && q.gateRank >= 0 && (q.gateRank | 0) !== (target | 0)) return false;
    q.have = Math.min(q.need | 0, (q.have | 0) + Math.max(1, count | 0));
    this.dirtyPlayers.add(rec.token);
    client.send('npcQuest', { action: 'progress', quest: q });
    return true;
  }

  handleClaimAegisTrial(client) {
    const rec = this.profileFor(client);
    if (!rec || !rec.prof.aegisTrialReady) return this.progressionReject(client, 'aegisTrial', 'incomplete');
    const lvl = Math.max(1, rec.prof.S.lvl | 0), rewardGold = 135 + lvl * 8;
    const rewardXp = Math.max(130 + lvl * 12, hunterXpForActivity(lvl, 'aegis_trial'));
    rec.prof.aegisTrialReady = false;
    rec.prof.gold = Math.max(0, (rec.prof.gold | 0) + rewardGold);
    this.grantHunterXp(rec.prof, rewardXp, client, 'aegis_trial');
    let reward;
    const roll = Math.random();
    if (roll < .45) reward = { kind: 'Rare Weapon', id: Math.random() < .5 ? I.DIA_SWORD : I.IRON_SWORD };
    else if (roll < .8) reward = { kind: 'Rare Armor', id: Math.random() < .5 ? I.DIA_ARMOR : I.IRON_ARMOR };
    else if (!rec.prof.familiarUnlocks.includes('shade')) {
      rec.prof.familiarUnlocks.push('shade');
      reward = { kind: 'Shade Familiar', id: I.SHADOW_SIGIL, unlocked: true };
    } else reward = { kind: 'Shade Sigil', id: I.SHADOW_SIGIL };
    if (!reward.unlocked) this.addRewardItem(rec.prof, reward.id, 1);
    this.grantJobXp(client, 'adventurer', 12);
    this.progressJobContract(client, 'quest', 1, 0);
    this.progressionChanged(client, 'aegisTrial', { rewardGold, rewardXp });
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
        this.addRewardItem(rec.prof, equipped.id, 1);
      }
      rec.prof.armor = null;
    } else {
      if (!ARMOR_INFO[id]) return this.progressionReject(client, 'armor', 'item');
      if (equipped && equipped.id === id) return this.progressionChanged(client, 'armor', { id });
      const slot = rec.prof.inv.findIndex(s => s && (s.id | 0) === id && (s.count | 0) > 0);
      if (slot < 0) return this.progressionReject(client, 'armor', 'unowned');
      const incoming = rec.prof.inv[slot];
      if (equipped) rec.prof.inv[slot] = { id: equipped.id, count: 1 };
      else if ((incoming.count | 0) > 1) incoming.count--;
      else rec.prof.inv[slot] = null;
      rec.prof.armor = { id, count: 1 };
    }
    return this.progressionChanged(client, 'armor', { id });
  }

  recordMineProgress(client, blockId) {
    const xp = blockId === W.B.DIAMOND_ORE ? 8 : blockId === W.B.IRON_ORE ? 5 : 2;
    this.grantJobXp(client, 'miner', xp);
    this.progressJobContract(client, 'mine', 1, blockId);
    this.progressNpcQuest(client, 'mine', 1, blockId);
  }

  recordFarmProgress(client, action) {
    const target = action === 'harvest' ? W.B.WHEAT_3 : action === 'plant' ? I.WHEAT_SEEDS : W.B.FARMLAND;
    this.grantJobXp(client, 'farmer', action === 'harvest' ? 5 : 1);
    this.progressJobContract(client, 'farm', 1, target);
  }

  recordCraftProgress(client, id, count) {
    count = Math.max(1, count | 0);
    if ([I.BREAD, I.HEARTY_SANDWICH, I.DRAGON_TREAT, I.COOKED_MEAT].includes(id)) {
      this.grantJobXp(client, 'cook', (id === I.DRAGON_TREAT ? 6 : id === I.COOKED_MEAT ? 4 : 5) * count);
      this.progressJobContract(client, 'cook', count, id);
    }
    if (TOOL_INFO[id] || ARMOR_INFO[id] || id === I.REPAIR_KIT || id === I.IRON_INGOT) {
      const xp = ARMOR_INFO[id] ? 14 : TOOL_INFO[id] ? 8 : id === I.REPAIR_KIT ? 6 : 3;
      this.grantJobXp(client, 'blacksmith', xp * count);
      this.progressJobContract(client, 'smith', count, id);
    }
  }

  recordRepairProgress(client, upgraded = false) {
    this.grantJobXp(client, 'blacksmith', upgraded ? 10 : 5);
    this.progressJobContract(client, upgraded ? 'smith' : 'repair', 1, 0);
  }

  recordKillProgress(client, hostile = true) {
    this.grantJobXp(client, 'adventurer', 3);
    // Kill objectives ("defeat hostile creatures") must not be satisfied by
    // slaughtering passive animals, which have their own 'hunt' reward path.
    if (!hostile) return;
    this.progressJobContract(client, 'kill', 1, 0);
    this.progressNpcQuest(client, 'kill', 1, 0);
  }

  recordGateProgress(client, rank = 0) {
    const rec = this.profileFor(client);
    this.grantJobXp(client, 'adventurer', 18);
    this.progressJobContract(client, 'gate', 1, 0);
    this.progressNpcQuest(client, 'gate', 1, rank);
    if (rec && rec.prof.progressionFocus === 'first_d_gate' && (rank | 0) >= 1) {
      rec.prof.progressionFocus = 'next_adventurer_contract';
      this.dirtyPlayers.add(rec.token);
      client.send('profile', rec.prof);
    }
  }

  recordEventProgress(client) {
    this.grantJobXp(client, 'adventurer', 12);
    this.progressJobContract(client, 'event', 1, 0);
  }

  recordTavernSaleProgress(client, id, count) {
    if (![I.WHEAT, I.BREAD, I.POT_STEW, I.MONSTER_MEAT, I.COOKED_MEAT].includes(id)) return;
    this.grantJobXp(client, 'cook', 3 * Math.max(1, count | 0));
    this.progressJobContract(client, 'sell', Math.max(1, count | 0), id);
    this.progressNpcQuest(client, 'sell', Math.max(1, count | 0), id);
  }
}

module.exports = ProgressionMixin.prototype;
