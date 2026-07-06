const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const W = require('../world');
const serverDungeon = require('../dungeon');
const { DimensionGrid, isDimensionGrid } = require('../../shared/dimension-grid');
const serverCommsRules = require('../../shared/comms-rules');
const sharedJobs = require('../../shared/job-system');
const sharedGear = require('../../shared/gear-system');

const clientModule = name => import(pathToFileURL(path.join(__dirname, '..', '..', 'client', 'js', name)).href);

test('GameContext owns shared services, state slices, module APIs, and runtime lifecycle', async () => {
  const { createGameContext } = await clientModule('game-context.mjs');
  const clock = { now: () => 42 };
  const context = createGameContext({ services: { clock }, state: { session: { connected: false } } });

  assert.equal(context.requireService('clock'), clock);
  assert.equal(context.requireState('session').connected, false);
  context.registerState('world', { dimension: 'overworld' });
  context.registerModule('world', { getBlock: () => 7 });
  context.markModuleLoaded('world');
  context.markModuleLoaded('world');
  context.setPhase('ready');

  assert.equal(context.requireModule('world').getBlock(), 7);
  assert.deepEqual(context.snapshot(), {
    phase: 'ready',
    services: ['clock'],
    state: ['session', 'world'],
    modules: ['world'],
    loadedModules: ['world'],
  });
  assert.throws(() => context.provide('clock', {}), /already registered/);
  assert.throws(() => context.requireService('missing'), /Unknown service/);
  assert.throws(() => context.registerState('bad', null), /must be an object/);
});

test('DimensionGrid provides one origin-aware storage contract for every dimension kind', () => {
  const grid = new DimensionGrid({kind:'tutorial',id:'training',originX:100,originY:5,originZ:200,width:4,height:3,depth:5,empty:0,outside:9});
  assert.equal(isDimensionGrid(grid), true);
  assert.deepEqual(grid.bounds, {minX:100,minY:5,minZ:200,maxX:103,maxY:7,maxZ:204});
  assert.equal(grid.getB(99,5,200), 9);
  assert.equal(grid.setB(102,6,203,7), true);
  assert.equal(grid.getB(102,6,203), 7);
  assert.equal(grid.index(102,6,203), 34);
  assert.equal(grid.setB(104,6,203,1), false);
  grid.fill(3);
  assert.equal(grid.getB(100,5,200), 3);
  assert.equal(grid.byteLength, 60);
  assert.equal(W.createWorld() instanceof DimensionGrid, true);
  assert.equal(serverDungeon.generateDungeon(0,1).world instanceof DimensionGrid, true);
});

test('client dimensions and server consume the shared grid contract', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'index.html'), 'utf8');
  const runtimeFiles = ['world.mjs', 'dimensions.mjs', 'combat.mjs', 'hud.mjs', 'menus.mjs', 'networking.mjs', 'frame-loop.mjs'];
  const runtimeSource = runtimeFiles.map(name =>
    fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', name), 'utf8')
  ).join('\n');
  const dimensionScript = html.indexOf('<script src="/shared/dimension-grid.js"></script>');
  const commsScript = html.indexOf('<script src="/shared/comms-rules.js"></script>');
  const jobsScript = html.indexOf('<script src="/shared/job-system.js"></script>');
  const dungeonScript = html.indexOf('<script src="/shared/dungeon-generation.js"></script>');
  assert.equal(dimensionScript >= 0 && commsScript > dimensionScript && jobsScript > commsScript && dungeonScript > jobsScript, true);
  assert.match(html, /<script src="\/shared\/comms-rules\.js"><\/script>/);
  assert.match(html, /<script src="\/shared\/job-system\.js"><\/script>/);
  assert.match(html, /<script src="\/shared\/gear-system\.js"><\/script>/);
  assert.match(html, /<script src="\/shared\/dungeon-generation\.js"><\/script>/);
  assert.match(html, /import\('\.\/js\/game-context\.mjs'\)/);
  assert.match(html, /createGameContext\(\{\s*services:/);
  let previousModule = -1;
  for (const name of runtimeFiles) {
    const offset = html.indexOf(`'./js/${name}'`);
    assert.ok(offset > previousModule, `${name} is loaded in runtime order`);
    previousModule = offset;
  }
  assert.ok(Buffer.byteLength(html) < 20_000, 'index.html remains a small markup and bootstrap shell');
  assert.match(html, /id="playbtn" disabled/);
  assert.match(html, /id="registerbtn" type="button" disabled/);
  assert.match(html, /id="gearrewardwin"/);
  assert.match(html, /dataset\.gamePhase='ready'[\s\S]*button\.disabled=false/);
  assert.doesNotMatch(html, /\.\/js\/ui\.js/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'hud.mjs'), 'utf8'), /HUD hotbar/);
  const menusSource = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'menus.mjs'), 'utf8');
  assert.match(menusSource, /inventory \/ crafting UI/);
  assert.match(menusSource, /registerModule\('menus'/);
  assert.match(menusSource, /export const api=gameContext\.requireModule\('menus'\)/);
  assert.match(menusSource, /function renderGearComparison/);
  assert.match(menusSource, /SELECTED GEAR/);
  assert.match(menusSource, /UPGRADE/);
  assert.match(menusSource, /REPAIR AT TOBIN/);
  assert.match(menusSource, /STAMINA COST/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8'), /armorMovement[\s\S]*staminaCostMultiplier[\s\S]*moveMultiplier/);
  const networkingSource = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8');
  assert.match(networkingSource, /registerState\('networking'/);
  assert.match(networkingSource, /registerModule\('networking'/);
  assert.match(networkingSource, /export const api=gameContext\.requireModule\('networking'\)/);
  assert.match(networkingSource, /multiplayer \(colyseus\)/);
  assert.match(networkingSource, /Event'[\s\S]*Hunter XP/, 'event completion names its exact XP reward');
  assert.match(menusSource, /Boss clear reward:[\s\S]*Hunter XP/, 'Gate lobby previews authoritative boss XP');
  for (const [file, factory] of [
    ['network-session.mjs', 'createNetworkSession'],
    ['social.mjs', 'createSocialSystem'],
    ['network-frame-pump.mjs', 'createNetworkFramePump'],
    ['companions.mjs', 'createCompanionSystem'],
    ['replication-visuals.mjs', 'createReplicationVisuals'],
    ['gear-rewards.mjs', 'createGearRewardPresenter'],
    ['combat-feedback.mjs', 'createCombatFeedback'],
  ]) {
    const extractedSource = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', file), 'utf8');
    assert.match(extractedSource, new RegExp(`export function ${factory}\\(`));
    assert.match(networkingSource, new RegExp(`import \\{${factory}\\} from '\\./${file}'`));
  }
  const compatibilityBindings = (networkingSource.match(/get:\(\)=>/g) || []).length;
  assert.ok(compatibilityBindings <= 89, 'networking compatibility surface must not grow');
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8'), /main loop/);
  assert.match(runtimeSource, /BlockcraftDungeonGeneration\.createDungeonGeneration/);
  assert.match(runtimeSource, /bandit_camp/);
  assert.match(html, /id="activitytracker"/);
  assert.match(runtimeSource, /Caravan Under Attack/);
  assert.match(runtimeSource, /utilityEquipped\('compass'\)/);
  assert.match(runtimeSource, /mapUtility&&overworldActivity/);
  assert.match(runtimeSource, /Talk to Caravan Merchant/);
  assert.match(html, /id="kinghud"/);
  assert.match(runtimeSource, /CROWN · SQUAD/);
  assert.match(runtimeSource, /Final minute!/);
  assert.match(runtimeSource, /CLAIM THE CROWN/);
  assert.match(runtimeSource, /new THREE\.RingGeometry\(2\.75,3\.05,64\)/);
  assert.match(runtimeSource, /function kingCrownTransferFx\(m\)/);
  assert.match(networkingSource, /kingCrownChanged\(m\)/);
  assert.match(html, /id="parkourhud"/);
  assert.match(runtimeSource, /function ensureParkourObjectiveVisuals\(course\)/);
  assert.match(runtimeSource, /function parkourCheckpointReached\(m\)/);
  assert.match(networkingSource, /eventCheckpoint/);
  assert.match(html, /id="caravanhud"/);
  assert.match(runtimeSource, /function buildCaravanWorld\(arena\)/);
  assert.match(runtimeSource, /function renderCaravanHud\(\)/);
  assert.match(runtimeSource, /BASED ON WAGON HEALTH/);
  assert.match(runtimeSource, /Maximum event reward is now/);
  assert.match(networkingSource, /eventCaravanWave/);
  assert.match(networkingSource, /roadsideEncounterResult/);
  assert.match(networkingSource, /roadSafetyChanged/);
  assert.match(runtimeSource, /Wounded Hunter/);
  assert.match(runtimeSource, /Shared regional safety/);
  assert.match(runtimeSource, /function rebuildRoadSafetyScenes\(force=false\)/);
  assert.match(runtimeSource, /ROAD PATROL/);
  assert.match(runtimeSource, /BANDIT ROAD/);
  assert.match(networkingSource, /roadSafetyChanged[\s\S]*refreshRoadSafetyScenes\(\)/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'replication-visuals.mjs'), 'utf8'), /Bandit Captain[\s\S]*Merchant Wagon/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'replication-visuals.mjs'), 'utf8'), /bandit_archer/);
  assert.doesNotMatch(runtimeSource, /function generateDungeon\(ri, seed\)/);
  for (const kind of ['overworld','tutorial','event']) assert.match(runtimeSource, new RegExp("new DimensionGrid\\(\\{kind:'"+kind));
  assert.doesNotMatch(runtimeSource, /new Uint8Array\(WX\*WH\*WX\)/);
  assert.match(runtimeSource, /export const api=gameContext\.requireModule\('world'\)/);
  assert.match(runtimeSource, /import \{api as worldApi,state as worldState\} from '\.\/world\.mjs'/);
  assert.match(runtimeSource, /export const api=gameContext\.requireModule\('dimensions'\)/);
  assert.match(runtimeSource, /import \{api as worldApi,state as worldState\} from '\.\/world\.mjs'/);
  assert.match(runtimeSource, /import \{api as dimensionsApi,state as dimensionsState\} from '\.\/dimensions\.mjs'/);
  assert.match(runtimeSource, /export const api=gameContext\.requireModule\('combat'\)/);
  assert.match(runtimeSource, /export const api=gameContext\.requireModule\('hud'\)/);
  assert.match(runtimeSource, /export const api=gameContext\.requireModule\('ui'\)/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'onboarding.mjs'), 'utf8'), /TRAINING COMPLETE/);
  for (const name of ['world','dimensions','combat','ui']) {
    assert.match(runtimeSource, new RegExp(`gameContext\\.registerState\\('${name}'`));
    assert.match(runtimeSource, new RegExp(`gameContext\\.registerModule\\('${name}'`));
  }
});

test('browser and Node adapters generate byte-identical dungeons', () => {
  const dimensionSource = fs.readFileSync(path.join(__dirname, '..', '..', 'shared', 'dimension-grid.js'), 'utf8');
  const dungeonSource = fs.readFileSync(path.join(__dirname, '..', '..', 'shared', 'dungeon-generation.js'), 'utf8');
  const browser = { Uint8Array, Set, Math, Number, TypeError };
  vm.createContext(browser);
  vm.runInContext(dimensionSource, browser);
  vm.runInContext(dungeonSource, browser);
  const browserDungeon = browser.BlockcraftDungeonGeneration.createDungeonGeneration({
    B: W.B,
    hash2: W.hash2,
  });

  for (const [rank, seed] of [[0, 1], [2, 0x12345678], [4, 0xfedcba98]]) {
    const nodeResult = serverDungeon.generateDungeon(rank, seed);
    const browserResult = browserDungeon.generateDungeon(rank, seed);
    assert.deepEqual(JSON.parse(JSON.stringify(browserResult.rooms)), nodeResult.rooms);
    assert.deepEqual(JSON.parse(JSON.stringify(browserResult.spawns)), nodeResult.spawns);
    assert.deepEqual(Buffer.from(browserResult.world.data), Buffer.from(nodeResult.world.data));
  }
});

test('onboarding building counts a three-block stack above the stone pad', async () => {
  const { isOnboardingBuildPlacement, countOnboardingBuildBlocks } = await clientModule('onboarding.mjs');
  const meadow = { x: 100, z: 200, G: 12 };
  assert.deepEqual([13, 14, 15].map(y => isOnboardingBuildPlacement(140, y, 182, meadow)), [true, true, true]);
  assert.equal(isOnboardingBuildPlacement(140, 18, 182, meadow), false, 'placements above the cleared tutorial volume do not count');
  assert.equal(isOnboardingBuildPlacement(142, 13, 182, meadow), false, 'placements outside the stone pad do not count');
  const stack = new Set(['140,13,182', '140,14,182', '140,15,182']);
  assert.equal(countOnboardingBuildBlocks(meadow, (x, y, z) => stack.has(`${x},${y},${z}`) ? 5 : 0, 5), 3,
    'progress is recovered from the blocks in the world even if a placement event was missed');
});

test('onboarding resource manifest restores every tutorial log and mature crop', async () => {
  const { onboardingResourceCells } = await clientModule('onboarding.mjs');
  const cells = onboardingResourceCells({ x: 100, z: 200, G: 12 }, { LOG: 5, WHEAT_3: 25 });
  assert.deepEqual(cells.filter(cell => cell.id === 5).map(cell => [cell.x, cell.y, cell.z]), [
    [122, 13, 194], [122, 14, 194], [122, 15, 194], [122, 16, 194],
  ]);
  assert.deepEqual(cells.filter(cell => cell.id === 25).map(cell => [cell.x, cell.y, cell.z]), [
    [108, 13, 172], [110, 13, 172], [112, 13, 172],
  ]);
});

test('browser and server consume one shared profession and contract ruleset', () => {
  assert.deepEqual(sharedJobs.PROFESSION_IDS, ['miner','farmer','cook','blacksmith','monk']);
  assert.equal(sharedJobs.jobLevelFromXp(sharedJobs.jobXpNeed(1)), 2);
  assert.equal(sharedJobs.titleFor('miner', 10), 'Prospector');
  assert.equal(sharedJobs.perkTierFromLevel(20), 4);
  for(const id of sharedJobs.JOB_IDS){
    const milestones=sharedJobs.milestonesFor(id);
    assert.deepEqual(milestones.map(m=>m.level),[2,5,10,20],`${id} has the shared milestone ladder`);
    assert.equal(sharedJobs.milestoneState(id,1).next.level,2);
    assert.equal(sharedJobs.milestoneState(id,10).earned.length,3);
    assert.equal(sharedJobs.milestoneAt(id,5).title.length>0,true);
  }
  assert.deepEqual(Object.keys(sharedJobs.REFORGE_MODIFIERS),['keen','swift','sturdy']);
  assert.deepEqual(Object.values(sharedJobs.REFORGE_ACTIONS).map(a=>a.level),[2,5,10,20]);
  assert.equal(sharedJobs.reforgeCost('masterwork').diamond,3);
  assert.equal(sharedJobs.FARMER_RULES.windseedLevel,5);
  assert.equal(sharedJobs.FARMER_RULES.fieldcraftGrowthMultiplier,.75);
  assert.equal(sharedJobs.FARMER_RULES.goldenWheatChance,.25);
  assert.equal(sharedJobs.COOK_RULES.brothLevel,5);
  assert.equal(sharedJobs.COOK_RULES.feastLevel,20);
  assert.equal(sharedJobs.COOK_RULES.feastRange,20);
  assert.equal(sharedJobs.MONK_RULES.regenLevel,2);
  assert.equal(sharedJobs.MONK_RULES.stoneMitigation,.35);
  assert.equal(sharedJobs.MONK_RULES.auraCooldownMs,15000);
  assert.equal(sharedJobs.MINER_RULES.oreSenseLevel,2);
  assert.equal(sharedJobs.MINER_RULES.deepSurveyRadius,18);
  assert.equal(sharedJobs.MINER_RULES.geodeChance,.08);
  assert.deepEqual(sharedJobs.PROFESSION_REWARD_MULTIPLIER,{miner:1,farmer:1.25,cook:1.5,blacksmith:1.5,monk:1});
  const objectiveXp={miner:c=>c.need*(c.target===W.B.IRON_ORE?5:2),farmer:c=>c.need*3,cook:c=>c.need*(c.type==='sell'?3:4),blacksmith:c=>c.need*(c.type==='repair'?5:6),monk:c=>c.need*.4};
  const runway=sharedJobs.PROFESSION_IDS.map(job=>{let xp=0,contracts=0;while(sharedJobs.jobLevelFromXp(xp)<20&&contracts<200){const pool=sharedJobs.contractPool(job,sharedJobs.contractScaleFromXp(xp),20,{STONE:W.B.STONE,IRON_ORE:W.B.IRON_ORE,WHEAT_3:W.B.WHEAT_3});xp+=pool.reduce((sum,c)=>sum+c.rewardJobXp+objectiveXp[job](c),0)/pool.length;contracts++;}return contracts;});
  assert.equal(Math.max(...runway)/Math.min(...runway)<1.2,true,'profession Lv20 runways remain within 20% of each other');
  const targets = {STONE:W.B.STONE,IRON_ORE:W.B.IRON_ORE,WHEAT_3:W.B.WHEAT_3};
  const miner = sharedJobs.contractPool('miner', 2, 5, targets);
  assert.deepEqual(miner.map(c=>c.title), ['Stone Quota','Iron Survey']);
  assert.equal(miner[0].target, W.B.STONE);
  assert.equal(miner[0].need, 28);
  assert.match(sharedJobs.guideSteps('mine').join(' '), /stone or cobble/i);
  const offers=sharedJobs.contractOffers('miner',2,5,targets,100,0);
  assert.deepEqual(offers.map(o=>o.difficulty),['quick','balanced','demanding']);
  assert.ok(offers[0].rewardXp<offers[1].rewardXp&&offers[1].rewardXp<offers[2].rewardXp);
  assert.deepEqual(offers.map(o=>o.estimate),['About 5 minutes','About 10 minutes','About 15–20 minutes']);
  const worldSource = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'world.mjs'), 'utf8');
  const progressionSource = fs.readFileSync(path.join(__dirname, '..', 'rooms', 'progression.mixin.js'), 'utf8');
  assert.match(worldSource, /BlockcraftJobSystem/);
  assert.match(progressionSource, /shared\/job-system/);
  assert.doesNotMatch(worldSource, /const pools=\{[\s\S]*Stone Order/);
  const menusSource=fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'menus.mjs'), 'utf8');
  assert.match(menusSource,/HUNTER OFFERS/);
  assert.match(menusSource,/offerId:offer\.id/);
  assert.match(menusSource,/function jobMilestoneHTML/);
  assert.match(menusSource,/Next at Lv/);
  assert.match(menusSource,/requestBlacksmithReforge/);
  assert.match(menusSource,/Temper Reroll/);
});

test('weapons share E-to-Legendary ranks and Common-to-Mythic rarity rules', () => {
  assert.deepEqual(sharedGear.RANKS.map(r=>r.id),['E','D','C','B','A','S','LEGENDARY']);
  assert.deepEqual(sharedGear.RARITIES.map(r=>r.id),['common','uncommon','rare','epic','mythic']);
  assert.equal(sharedGear.profile({tier:1},{}).rank.id,'E');
  assert.equal(sharedGear.profile({tier:3},{plus:2}).rank.id,'A');
  assert.equal(sharedGear.profile({tier:4},{plus:2,forge:'keen'}).rank.id,'S');
  assert.equal(sharedGear.profile({tier:3},{forge:'keen'}).rarity.id,'rare');
  assert.equal(sharedGear.profile({tier:4},{masterwork:true}).rarity.id,'mythic');
  assert.equal(sharedGear.profile({tier:5,legendary:true},{}).rank.id,'LEGENDARY');
  assert.equal(sharedGear.profile({tier:5},{}).rarity.id,'mythic');
  assert.equal(sharedGear.profile({tier:3},{rarity:'rare'}).rarity.damage,1.08);
  assert.equal(sharedGear.rollRarity(.95).id,'epic');
  assert.equal(sharedGear.rollRarity(.95,.06).id,'epic');
  const sword=sharedGear.weaponCombatProfile({tier:3,cls:'sword'},{});
  const axe=sharedGear.weaponCombatProfile({tier:3,cls:'axe'},{});
  assert.equal(sword.damage,10);assert.equal(sword.cooldownMs,250);assert.equal(sword.dps,40);
  assert.equal(axe.damage,15);assert.equal(axe.cooldownMs,480);assert.equal(axe.dps,31.3);
  assert.ok(axe.damage>sword.damage&&axe.dps<sword.dps);
  const first=sharedGear.nextMomentum({},1000,'mob-a'),second=sharedGear.nextMomentum(first,1100,'mob-a');
  assert.equal(first.stacks,1);assert.equal(second.stacks,2);
  assert.equal(sharedGear.nextMomentum(second,1200,'mob-b').stacks,1);
  assert.equal(sharedGear.nextMomentum(second,second.expiresAt,'mob-a').stacks,1);
  assert.equal(sharedGear.momentumMultiplier(3),1.12);
  assert.equal(sharedGear.WEAPON_IDENTITY.stagger.bossMoveMultiplier,.75);
});

test('gear reward presentation compares authoritative drops and labels their source', async()=>{
  const {compareGearReward,gearRewardSource}=await clientModule('gear-rewards.mjs');
  const item={tool:{tier:3,cls:'sword',dur:480}};
  const baseline={stack:{id:1,gearRank:'D',rarity:'common'},item};
  const result=compareGearReward({
    stack:{id:1,gearRank:'C',rarity:'rare'},item,baseline,gearSystem:sharedGear,
    toolMaxDur:stack=>480+(stack.plus|0)*20,
  });
  assert.equal(result.verdict,'UPGRADE');
  assert.equal(result.rows.some(row=>row[0]==='DPS'&&parseFloat(row[2])>0),true);
  assert.equal(gearRewardSource('captain'),'Bandit captain');
  assert.equal(gearRewardSource('aegis_trial'),'Aegis trial');
});

test('combat feedback classifies escalating armor durability warnings',async()=>{
  const {armorCondition}=await clientModule('combat-feedback.mjs');
  assert.deepEqual(armorCondition(100,100),{ratio:1,band:'sound'});
  assert.equal(armorCondition(25,100).band,'low');
  assert.equal(armorCondition(10,100).band,'critical');
  assert.equal(armorCondition(0,100).band,'broken');
});

test('browser and server consume one shared safeguarded comms ruleset', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'shared', 'comms-rules.js'), 'utf8');
  const context = vm.createContext({});
  vm.runInContext(source, context);
  const browserRules = JSON.parse(JSON.stringify(context.BlockcraftCommsRules));
  assert.deepEqual(browserRules.PHRASES, serverCommsRules.PHRASES);
  assert.deepEqual(browserRules.CONTEXTS, serverCommsRules.CONTEXTS);
  assert.deepEqual(browserRules.CHANNELS, serverCommsRules.CHANNELS);
  assert.deepEqual(browserRules.RULES, serverCommsRules.RULES);
  assert.equal(serverCommsRules.phrase('dungeon_boss'), 'Focus the boss!');
  assert.deepEqual(serverCommsRules.phraseIdsFor('gate').slice(0, 3), ['gate_ready','gate_need_one','gate_enter']);
});

test('first D-rank clear produces a one-time repeatable-loop handoff', async () => {
  const { gateMilestoneHandoff, rankPromotionDetails } = await clientModule('onboarding.mjs');
  assert.deepEqual(gateMilestoneHandoff({ firstClear: { rank: 1, nextRank: 2 } }, true), {
    label: 'ADVENTURER LOOP UNLOCKED',
    text: 'Contracts, Gates, quests, events, and hostile threats all grant Hunter XP. Exit through the return portal, then follow Compass Sense to the Job Board and work toward C-Rank at Level 8.',
    action: 'TRACK NEXT CONTRACT',
  });
  assert.equal(gateMilestoneHandoff({ firstClear: { rank: 0 } }, true), null);
  assert.equal(gateMilestoneHandoff({ firstClear: { rank: 1 } }, false), null);
  assert.equal(gateMilestoneHandoff({}, true), null);
  assert.deepEqual(rankPromotionDetails({
    fromRank: 1, rank: 2, gateRank: 2, level: 8, statPoints: 3, nextRankLevel: 13,
  }), {
    rank: 2,
    letter: 'C',
    title: 'C-RANK HUNTER',
    gateAccess: 'C-RANK GATES',
    level: 8,
    statPoints: 3,
    next: 'B-Rank begins at Level 13',
  });
  assert.equal(rankPromotionDetails({ fromRank: 2, rank: 2 }), null);
});

test('reconnect policy retries with bounded exponential delays', async () => {
  const { reconnectWithBackoff } = await clientModule('reconnect.mjs');
  const attempts = [], delays = [];
  const room = await reconnectWithBackoff(async attempt => {
    attempts.push(attempt);
    if (attempt < 3) throw new Error('offline');
    return { id: 'restored' };
  }, { attempts: 4, baseDelay: 10, wait: async ms => delays.push(ms) });
  assert.equal(room.id, 'restored');
  assert.deepEqual(attempts, [1, 2, 3]);
  assert.deepEqual(delays, [10, 20]);
});

test('progression module reconciles authoritative updates and rejection messages', async () => {
  const { bindProgressionMessages } = await clientModule('progression.mjs');
  const handlers = new Map(), events = [];
  const room = { onMessage(type, fn) { handlers.set(type, fn); } };
  let xp = 0, contract = null;
  bindProgressionMessages(room, {
    getJobXp: () => xp, setJobXp: value => { xp = value; },
    setContract: value => { contract = value; }, clampContract: value => value,
    jobLevel: value => value >= 10 ? 2 : 1, contractReady: () => !!contract && contract.have >= contract.need,
    onJobLevel: level => events.push(['level', level]), onContractReady: () => events.push(['ready']),
    reconcileArmor: () => events.push(['armor']), reject: text => events.push(['reject', text]),
    accept: message => events.push(['accept', message.type]), refresh: () => events.push(['refresh']),
  });
  handlers.get('jobProgress')({ jobXp: 10, contract: { have: 1, need: 1 } });
  handlers.get('progressionResult')({ ok: false, type: 'armor', reason: 'unowned' });
  assert.equal(xp, 10);
  assert.deepEqual(events, [['level', 2], ['ready'], ['refresh'], ['armor'], ['reject', 'You do not own that armor']]);
});

test('Hunter XP curve has explicit rank thresholds and steepens at high rank', async () => {
  const progression = await clientModule('progression.mjs');
  const serverProgression = require('../rooms/constants');
  const { hunterActivityXpForLevel, hunterRankIndexForLevel, gateRankIndexForLevel, nextHunterRankLevel, xpNeedForLevel } = progression;
  assert.deepEqual([1, 4, 8, 13, 19, 27].map(hunterRankIndexForLevel), [0, 1, 2, 3, 4, 5]);
  assert.equal(gateRankIndexForLevel(99), 4, 'gate tiers stop at A while Hunter rank reaches S');
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(nextHunterRankLevel), [4, 8, 13, 19, 27, 0]);
  assert.equal(xpNeedForLevel(3), 130, 'the polished onboarding still reaches Level 3 on schedule');
  assert.ok(xpNeedForLevel(18) > xpNeedForLevel(7) * 4);
  assert.ok(xpNeedForLevel(26) > xpNeedForLevel(18) * 2);
  for (let level = 1; level <= 40; level++) {
    assert.equal(xpNeedForLevel(level), serverProgression.xpNeedForLevel(level), `client/server XP parity at Level ${level}`);
    assert.equal(hunterRankIndexForLevel(level), serverProgression.hunterRankIndexForLevel(level), `client/server rank parity at Level ${level}`);
    assert.equal(hunterActivityXpForLevel(level, .75), serverProgression.hunterActivityXpForLevel(level, .75), `client/server reward parity at Level ${level}`);
  }
});

test('restored Mara progress clears provisional first-quest town guidance', async () => {
  const combatSource = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'combat.mjs'), 'utf8');
  const networkingSource = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8');
  assert.match(networkingSource, /const JOB_SYSTEM=globalThis\.BlockcraftJobSystem/);
  assert.match(combatSource, /const JOB_SYSTEM=globalThis\.BlockcraftJobSystem/);
  assert.match(combatSource, /townGuidanceStep==='quest'\s*&&\s*\(quest\s*\|\|\s*firstQuestMilestoneComplete\(\)\)/);
  assert.match(combatSource, /townGuidanceActive=false;[\s\S]*tutorialPillarGroup\.visible=false;[\s\S]*tutorialEl\.classList\.add\('hidden'\)/);
});

test('caravan escort tracking begins only after accepting work from a caravan NPC',()=>{
  const frame=fs.readFileSync(path.join(__dirname,'..','..','client','js','frame-loop.mjs'),'utf8');
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  const room=fs.readFileSync(path.join(__dirname,'..','rooms','GameRoom.js'),'utf8');
  const spawning=fs.readFileSync(path.join(__dirname,'..','rooms','spawning.mixin.js'),'utf8');
  assert.match(frame,/caravanContract&&caravanContract\.type==='road_escort'/);
  assert.match(frame,/Talk to Caravan Merchant/);
  assert.match(combat,/caravanContractAccept/);
  assert.match(room,/handleCaravanContractAccept/);
  assert.doesNotMatch(room,/\['road_escort','road_rescue'/);
  assert.match(spawning,/id: caravan\.id/);
  assert.match(spawning,/road_escort',\{targetId:caravan\.id\}/);
});

test('top-screen smart hints dismiss themselves after thirty seconds',()=>{
  const networking=fs.readFileSync(path.join(__dirname,'..','..','client','js','networking.mjs'),'utf8');
  assert.match(networking,/SMART_SUGGESTION_VISIBLE_MS=30000/);
  assert.match(networking,/expiresAt:performance\.now\(\)\+SMART_SUGGESTION_VISIBLE_MS/);
  assert.match(networking,/now>=smartSuggestion\.expiresAt[\s\S]*markSmartSuggestionDone\(smartSuggestion\.id\)[\s\S]*hideSmartSuggestion\(\)/);
});

test('regional road safety stays in the bottom-left event log instead of the side tracker',()=>{
  const frame=fs.readFileSync(path.join(__dirname,'..','..','client','js','frame-loop.mjs'),'utf8');
  const networking=fs.readFileSync(path.join(__dirname,'..','..','client','js','networking.mjs'),'utf8');
  assert.doesNotMatch(frame,/title='Regional Roads/);
  assert.match(networking,/eventLog\('Regional road safety '[\s\S]*'\[Roads\]'\)/);
  assert.doesNotMatch(networking,/sysMsg\('Regional road safety/);
});

test('the regional side tracker requires an explicitly accepted regional contract',()=>{
  const frame=fs.readFileSync(path.join(__dirname,'..','..','client','js','frame-loop.mjs'),'utf8');
  assert.match(frame,/acceptedRegionalContract=clampRegionalContract\(regionalContract\)/);
  assert.match(frame,/if\(!acceptedRegionalContract\)\{displayedRegionalOpportunity=null;activityTrackerEl\.classList\.add\('hidden'\);return;\}/);
});

test('client XP previews match the authoritative activity economy', async () => {
  const client = await clientModule('progression.mjs');
  const server = require('../rooms/xp-economy');
  assert.deepEqual({ ...client.HUNTER_ACTIVITY_XP_WEIGHTS }, { ...server.XP_ACTIVITY_WEIGHTS });
  for (const level of [1, 4, 8, 13, 19, 27]) {
    for (const type of Object.keys(server.XP_ACTIVITY_WEIGHTS)) {
      assert.equal(client.hunterXpForActivity(level, type), server.hunterXpForActivity(level, type));
    }
  }
});

test('rank progress counts all level XP remaining to the next Hunter rank', async () => {
  const { HUNTER_RANK_LEVELS, rankProgressForLevel, xpNeedForLevel } = await clientModule('progression.mjs');
  const freshD = rankProgressForLevel(4, 0);
  const dRequired = [4, 5, 6, 7].reduce((sum, level) => sum + xpNeedForLevel(level), 0);
  assert.deepEqual(freshD, {
    rank: 1,
    nextRank: 2,
    nextRankLevel: 8,
    earned: 0,
    required: dRequired,
    remaining: dRequired,
    progress: 0,
    maxRank: false,
  });
  const midD = rankProgressForLevel(6, 25);
  assert.equal(midD.earned, xpNeedForLevel(4) + xpNeedForLevel(5) + 25);
  assert.equal(midD.remaining, dRequired - midD.earned);
  assert.equal(rankProgressForLevel(HUNTER_RANK_LEVELS.at(-1), 999).maxRank, true);
});

test('progression focus states stay identical across client and server', async () => {
  const { PROGRESSION_FOCUS_STATES } = await clientModule('progression.mjs');
  const serverStates = require('../rooms/constants').PROGRESSION_FOCUS_STATES;
  assert.deepEqual([...PROGRESSION_FOCUS_STATES], [...serverStates], 'client/server onboarding focus whitelist parity');
});

test('inventory and equipment models own stacking consumption and profile restore', async () => {
  const { createInventoryModel, createEquipmentModel } = await clientModule('inventory.mjs');
  const slots = new Array(4).fill(null), changes = [];
  const items = { 1: { stack: 10 }, 2: { stack: 1, armor: { mitigation: .2 } }, 3: { stack: 1, tool: { dur: 40 } } };
  let armor = null;
  const inventory = createInventoryModel({ slots, items, size: 4, getEquippedArmor: () => armor, onChange: () => changes.push('inventory') });
  assert.equal(inventory.add(1, 14), 0);
  assert.equal(inventory.count(1), 14);
  assert.equal(inventory.remove(1, 11), true);
  assert.equal(inventory.count(1), 3);
  assert.equal(inventory.add(3, 1), 0);
  assert.equal(slots.find(s => s && s.id === 3).dur, 40);
  const equipment = createEquipmentModel({ items, inventory, getArmor: () => armor, setArmor: value => { armor = value; } });
  assert.deepEqual(equipment.restore({ id: 2, count: 99 }), { id: 2, count: 1 });
  assert.equal(equipment.owns(2), true);
  assert.equal(inventory.add(2, 1), 0, 'equipped armor is not duplicated into inventory');
  assert.equal(inventory.count(2), 0);
  assert.ok(changes.length >= 3);
});

test('quest and job model calculates progress without page globals', async () => {
  const jobs = await clientModule('quests-jobs.mjs');
  assert.equal(jobs.jobLevelFromXp(jobs.jobXpNeed(1)), 2);
  assert.deepEqual(jobs.clampJobContract({ job: 'miner', type: 'mine', need: 2, have: 99, rewardGold: 4, title: 'Stone' }, { miner: {} }).have, 2);
  const model = jobs.createQuestModel({
    countItem: id => id === 5 ? 3 : 0, utilityUnlocked: () => false, utilityUnlocks: () => [],
    familiarUnlocks: () => [], dragonUnlocks: () => [], mounted: () => false, mountKind: () => '', isDragon: () => false,
    escape: value => value, formatTime: () => '1m', utilityName: () => 'Compass', familiarName: () => 'Shade',
  });
  assert.equal(model.done({ type: 'fetch', item: 5, need: 3 }), true);
  assert.equal(model.progressText({ type: 'fetch', item: 5, need: 4 }), '3 / 4');
});

test('rendering runtime owns renderer initialization resize and draw', async () => {
  const { createRenderingRuntime } = await clientModule('rendering.mjs');
  const calls = [], canvas = {};
  class Scene {}
  class Camera { constructor(_fov, aspect) { this.aspect = aspect; } updateProjectionMatrix() { calls.push('projection'); } }
  class Renderer {
    constructor() { this.domElement = canvas; }
    setSize(w, h) { calls.push(['size', w, h]); }
    setPixelRatio(value) { calls.push(['ratio', value]); }
    render(scene, camera) { calls.push(['render', scene, camera]); }
  }
  const mount = { appendChild(value) { calls.push(['mount', value]); } };
  const runtime = createRenderingRuntime({ THREE: { Scene, PerspectiveCamera: Camera, WebGLRenderer: Renderer }, mount, width: 800, height: 400, pixelRatio: 3 });
  runtime.resize(600, 300);
  runtime.render();
  assert.equal(runtime.camera.aspect, 2);
  assert.deepEqual(calls.slice(0, 3), [['size', 800, 400], ['ratio', 2], ['mount', canvas]]);
  assert.equal(calls.at(-1)[0], 'render');
});

test('network controller joins stores resume token and reattaches after disconnect', async () => {
  const { createNetworkController } = await clientModule('network.mjs');
  const storage = new Map(), attached = [], events = [];
  const makeRoom = token => ({ reconnectionToken: token, onLeave(fn) { this.leaveHandler = fn; } });
  const first = makeRoom('room:first'), second = makeRoom('room:second');
  class Client {
    async joinOrCreate(name, options) { events.push(['join', name, options.name]); return first; }
    async reconnect(token) { events.push(['reconnect', token]); return second; }
  }
  const controller = createNetworkController({
    Client, endpoint: () => 'ws://test', roomName: 'blockcraft', tokenKey: 'resume',
    sessionStorage: { getItem: key => storage.get(key) || '', setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    onAttach: room => attached.push(room), onUnavailable() {}, onInterrupted: () => events.push(['interrupted']),
    onReconnectAttempt() {}, onRestored: () => events.push(['restored']), onFailure: error => { throw error; },
  });
  controller.connect('Hunter');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(controller.state.room, first);
  assert.equal(storage.get('resume'), 'room:first');
  first.leaveHandler();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(controller.state.room, second);
  assert.equal(controller.state.attachCount, 2);
  assert.deepEqual(attached, [first, second]);
});

test('network controller shutdown leaves deliberately without starting reconnect teardown', async () => {
  const { createNetworkController } = await clientModule('network.mjs');
  let reconnects = 0, leaves = 0;
  const room = {
    reconnectionToken: 'room:first',
    onLeave(fn) { this.leaveHandler = fn; },
    async leave() { leaves++; this.leaveHandler(); },
  };
  class Client {
    async joinOrCreate() { return room; }
    async reconnect() { reconnects++; throw new Error('shutdown must not reconnect'); }
  }
  const controller = createNetworkController({
    Client, endpoint: () => 'ws://test', roomName: 'blockcraft', tokenKey: 'resume',
    sessionStorage: { getItem: () => '', setItem() {}, removeItem() {} },
    onAttach() {}, onUnavailable() {}, onInterrupted() {}, onReconnectAttempt() {}, onRestored() {},
    onFailure: error => { throw error; },
  });
  controller.connect('Hunter');
  await new Promise(resolve => setTimeout(resolve, 0));
  await controller.shutdown();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(leaves, 1);
  assert.equal(reconnects, 0);
  assert.equal(controller.state.room, null);
  assert.equal(controller.state.on, false);
});

test('network controller falls back when a stored session resume never settles', async () => {
  const { createNetworkController } = await clientModule('network.mjs');
  const storage = new Map([['resume', 'stale:token']]), attached = [], events = [];
  const fresh = { reconnectionToken: 'fresh:token', onLeave(fn) { this.leaveHandler = fn; } };
  class Client {
    reconnect(token) {
      events.push(['resume', token]);
      return new Promise(() => {});
    }
    async joinOrCreate(name, options) {
      events.push(['join', name, options.name]);
      return fresh;
    }
  }
  const controller = createNetworkController({
    Client, endpoint: () => 'ws://test', roomName: 'blockcraft', tokenKey: 'resume', resumeTimeout: 10,
    sessionStorage: { getItem: key => storage.get(key) || '', setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    onAttach: room => attached.push(room), onUnavailable() {}, onInterrupted() {}, onReconnectAttempt() {},
    onRestored() {}, onFailure(error) { throw error; },
  });
  controller.connect('Hunter');
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.deepEqual(events, [['resume', 'stale:token'], ['join', 'blockcraft', 'Hunter']]);
  assert.deepEqual(attached, [fresh]);
  assert.equal(controller.state.on, true);
  assert.equal(storage.get('resume'), 'fresh:token');
});

test('network controller retries when a fresh room join never settles', async () => {
  const attached = [], events = [];
  const fresh = { reconnectionToken: 'fresh:token', onLeave(fn) { this.leaveHandler = fn; } };
  let joins = 0;
  class Client {
    joinOrCreate() {
      joins++;
      events.push(['join', joins]);
      return joins === 1 ? new Promise(() => {}) : Promise.resolve(fresh);
    }
  }
  const { createNetworkController } = await clientModule('network.mjs');
  const controller = createNetworkController({
    Client, endpoint: () => 'ws://test', roomName: 'blockcraft', tokenKey: 'resume',
    joinTimeout: 10, joinAttempts: 2,
    sessionStorage: { getItem: () => '', setItem() {}, removeItem() {} },
    onAttach: room => attached.push(room), onUnavailable() {}, onInterrupted() {}, onReconnectAttempt() {},
    onRestored() {}, onFailure(error) { throw error; },
  });
  controller.connect('Hunter');
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.deepEqual(events, [['join', 1], ['join', 2]]);
  assert.deepEqual(attached, [fresh]);
  assert.equal(controller.state.on, true);
});

test('network controller bounds a hung live reconnect and falls back to a fresh join', async () => {
  const attached = [], events = [];
  const first = { reconnectionToken: 'live:token', onLeave(fn) { this.leaveHandler = fn; } };
  const fresh = { reconnectionToken: 'fresh:token', onLeave(fn) { this.leaveHandler = fn; } };
  let joins = 0;
  class Client {
    joinOrCreate() {
      joins++;
      events.push(['join', joins]);
      return Promise.resolve(joins === 1 ? first : fresh);
    }
    reconnect(token) {
      events.push(['reconnect', token]);
      return new Promise(() => {});
    }
  }
  const { createNetworkController } = await clientModule('network.mjs');
  const controller = createNetworkController({
    Client, endpoint: () => 'ws://test', roomName: 'blockcraft', tokenKey: 'resume',
    liveReconnectTimeout: 10, reconnectAttempts: 1, joinTimeout: 10, joinAttempts: 1,
    sessionStorage: { getItem: () => '', setItem() {}, removeItem() {} },
    onAttach: room => attached.push(room), onUnavailable() {}, onInterrupted() {}, onReconnectAttempt() {},
    onRestored() {}, onFailure(error) { throw error; },
  });
  controller.connect('Hunter');
  await new Promise(resolve => setTimeout(resolve, 0));
  first.leaveHandler();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.deepEqual(events, [['join', 1], ['reconnect', 'live:token'], ['join', 2]]);
  assert.deepEqual(attached, [first, fresh]);
  assert.equal(controller.state.room, fresh);
  assert.equal(controller.state.on, true);
});

test('Mesa slams and Plains pack lunges have explicit replicated telegraphs',()=>{
  const server=fs.readFileSync(path.join(__dirname,'..','rooms','GameRoom.js'),'utf8');
  const visuals=fs.readFileSync(path.join(__dirname,'..','..','client','js','replication-visuals.mjs'),'utf8');
  assert.match(server,/biomeBehavior==='flanker'\?'packWind'/);
  assert.match(server,/t:'biomeSlam'/);
  assert.match(visuals,/st==='bruteWind'.*redclaw/);
  assert.match(visuals,/st==='packWind'.*gale_stalker/);
  assert.match(visuals,/RingGeometry\(radius-.11,radius,48\)/);
});
