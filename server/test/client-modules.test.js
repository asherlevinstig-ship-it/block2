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
const questObjectives = require('../../shared/quest-objectives');
const npcQuestChains = require('../../shared/npc-quest-chains');
const { I } = require('../rooms/constants');

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

test('client mob performance tiers reduce ordinary dungeon visual update cost', async () => {
  const { PERFORMANCE_BUDGETS, distanceTierSq, mobDistanceTierSq, remotePlayerDistanceTierSq, consumeEntityStep, createParticleBudget } = await clientModule('performance-budget.mjs');
  assert.equal(distanceTierSq(24 * 24), 0, 'remote players keep the existing near tier');
  assert.equal(mobDistanceTierSq(17 * 17), 0, 'ordinary mobs stay smooth up close');
  assert.equal(mobDistanceTierSq(24 * 24), 1, 'ordinary mobs outside melee range use the medium cadence');
  assert.equal(mobDistanceTierSq(24 * 24, true), 0, 'important mobs keep the wider near tier');
  assert.equal(PERFORMANCE_BUDGETS.mobNearSq < PERFORMANCE_BUDGETS.nearSq, true);
  assert.equal(remotePlayerDistanceTierSq(21 * 21), 0, 'ordinary teammates stay smooth nearby');
  assert.equal(remotePlayerDistanceTierSq(24 * 24), 1, 'ordinary teammates outside close range use the medium cadence');
  assert.equal(remotePlayerDistanceTierSq(24 * 24, true), 0, 'spirit or urgent teammates keep the wider near tier');
  assert.equal(PERFORMANCE_BUDGETS.remotePlayerNearSq < PERFORMANCE_BUDGETS.nearSq, true);
  assert.equal(PERFORMANCE_BUDGETS.remotePlayerCrowdedNearSq < PERFORMANCE_BUDGETS.remotePlayerNearSq, true);
  assert.equal(PERFORMANCE_BUDGETS.remotePlayerCrowdThreshold > 1, true);
  assert.equal(PERFORMANCE_BUDGETS.remoteMaintenanceNearMs < PERFORMANCE_BUDGETS.remoteMaintenanceMediumMs, true);
  assert.equal(PERFORMANCE_BUDGETS.remoteMaintenanceMediumMs < PERFORMANCE_BUDGETS.remoteMaintenanceFarMs, true);

  const mob = {};
  assert.equal(consumeEntityStep(mob, PERFORMANCE_BUDGETS.mediumStep / 2, 1), 0);
  assert.equal(consumeEntityStep(mob, PERFORMANCE_BUDGETS.mediumStep / 2, 1), PERFORMANCE_BUDGETS.mediumStep);

  const particles = createParticleBudget({ frameCap: 3, cosmeticFrameCap: 2 });
  assert.equal(particles.trySpawn(1), true);
  assert.equal(particles.trySpawn(1), true);
  assert.equal(particles.trySpawn(1), false, 'cosmetic particles yield before the hard frame cap');
  assert.equal(particles.trySpawn(2), true, 'high-priority particles can use the reserve');
  assert.equal(particles.trySpawn(2), false, 'all particles still obey the hard frame cap');
  assert.deepEqual(particles.stats(), { particleAccepted: 0, particleDropped: 0, particleAcceptedTotal: 3, particleDroppedTotal: 2 });
  particles.resetFrame();
  assert.deepEqual(particles.stats(), { particleAccepted: 3, particleDropped: 2, particleAcceptedTotal: 3, particleDroppedTotal: 2 });
});

test('client performance diagnostics separates update and render timing', async () => {
  const previousDocument = globalThis.document;
  const previousAdd = globalThis.addEventListener;
  const previousRemove = globalThis.removeEventListener;
  const listeners = new Map();
  const created = [];
  globalThis.document = {
    body: { appendChild(value) { created.push(value); } },
    createElement(tag) {
      return {
        tag,
        hidden: false,
        style: {},
        set id(value) { this._id = value; },
        get id() { return this._id; },
        remove() { this.removed = true; },
      };
    },
  };
  globalThis.addEventListener = (type, fn) => listeners.set(type, fn);
  globalThis.removeEventListener = (type, fn) => {
    if (listeners.get(type) === fn) listeners.delete(type);
  };
  try {
    const { createPerformanceDiagnostics } = await clientModule('performance-budget.mjs');
    const renderer = { info: { render: { calls: 7, triangles: 900 }, memory: { geometries: 4, textures: 3 } } };
    const diagnostics = createPerformanceDiagnostics({ renderer, getCounts: () => ({ remotes: 16, mobs: 42 }) });
    const hud = created[0];
    hud.hidden = false;
    diagnostics.beginFrame(1000);
    diagnostics.beginRender(1012);
    diagnostics.endRender(1017);
    diagnostics.beginFrame(1300);
    assert.match(hud.textContent, /update \d+\.\d ms {2}render \d+\.\d ms/);
    assert.match(hud.textContent, /7 draws {2}900 tris/);
    assert.match(hud.textContent, /remotes: 16 {2}mobs: 42/);
    diagnostics.destroy();
    assert.equal(hud.removed, true);
    assert.equal(listeners.has('keydown'), false);
  } finally {
    globalThis.document = previousDocument;
    globalThis.addEventListener = previousAdd;
    globalThis.removeEventListener = previousRemove;
  }
});

test('client soundtrack manager selects one exclusive music mode', () => {
  const menus = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'menus.mjs'), 'utf8');
  assert.match(menus, /function nextMusicMode\(inMenu, inTown, inTavern, outdoor, inCutscene, inBattle\)/);
  assert.match(menus, /if\(muted\|\|inCutscene\)return 'none';\s*if\(inMenu\)return 'menu';\s*if\(inTavern\)return 'tavern';\s*if\(inBattle\)return 'battle';\s*if\(inTown\)return 'town';\s*if\(outdoor\)return 'forest';/);
  assert.match(menus, /activeMusicMode=nextMusicMode\(inMenu, inTown, inTavern, outdoor, inCutscene, inBattle\);/);
  assert.match(menus, /updateMusicTrack\(menuMusic, activeMusicMode==='menu'/);
  assert.match(menus, /updateMusicTrack\(townMusic, activeMusicMode==='town'/);
  assert.match(menus, /updateMusicTrack\(tavernMusic, activeMusicMode==='tavern'/);
  assert.match(menus, /forestMusic=createMusic\('audio\/ancientforest\.mp3'\);/);
  assert.match(menus, /updateMusicTrack\(forestMusic, activeMusicMode==='forest'/);
  assert.match(menus, /battleMusic=createMusic\('audio\/battle\.mp3'\);/);
  assert.match(menus, /updateMusicTrack\(battleMusic, activeMusicMode==='battle'/);
  assert.match(menus, /if\(!active&&audio\.volume<MUSIC_SILENCE\)/);
});

test('client soundtrack mp3 assets exist for every referenced music mode', () => {
  for (const name of ['menu.mp3', 'townbg.mp3', 'tavern.mp3', 'ancientforest.mp3', 'battle.mp3']) {
    const file = path.join(__dirname, '..', '..', 'client', 'audio', name);
    assert.equal(fs.existsSync(file), true, `${name} is present for static hosting`);
    assert.ok(fs.statSync(file).size > 1000, `${name} is not an empty placeholder`);
  }
});

test('Town of Beginnings removes NPC cottages in favor of open districts', () => {
  const world = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'world.mjs'), 'utf8');
  const menus = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'menus.mjs'), 'utf8');
  const serverWorld = fs.readFileSync(path.join(__dirname, '..', 'world.js'), 'utf8');

  assert.match(world, /WORLD_TOWN_HS=72/);
  assert.match(world, /TOWN = \{ TC: WX\/2, HS: 72, G: 15 \}/);
  assert.match(world, /TOWN_SPACING = 1\.14/);
  assert.match(world, /TOWN_DISTRICTS = Object\.freeze/);
  assert.match(serverWorld, /TOWN = \{ TC: WX \/ 2, HS: 72, G: 15 \}/);
  assert.match(serverWorld, /TOWN_SPACING = 1\.14/);
  assert.match(serverWorld, /TOWN_DISTRICTS = Object\.freeze/);
  assert.match(serverWorld, /const townPos = \(x, z, district\) =>/);
  assert.match(serverWorld, /const townBlockPos = \(x, z, district\) =>/);
  assert.match(serverWorld, /const HUB = Object\.freeze/);
  assert.match(serverWorld, /meditate: townPos\(47\.5, 46\.5, 'shrine'\)/);
  assert.match(world, /open town districts replacing NPC houses/);
  assert.match(serverWorld, /Open district footprints replacing the old NPC cottages/);
  assert.match(world, /tavern commons and player storage yard/);
  assert.match(world, /forge district training yard/);
  assert.match(world, /airship cargo apron/);
  assert.match(world, /central court fountain base: flat collision/);
  assert.match(world, /function createCentralFountainVisual\(\)/);
  assert.match(world, /new THREE\.CircleGeometry\(3\.62,64\)/);
  assert.match(world, /\{x:HUB\.forgeChimney\.x, y:TG\+9\.6,\s+z:HUB\.forgeChimney\.z,\s+type:'smoke',\s+rate:2\.2,\s+maxDist:16\}/);
  assert.match(world, /Math\.hypot\(player\.pos\.x-e\.x,player\.pos\.z-e\.z\)>\(e\.maxDist\|\|105\)/);
  assert.match(world, /Math\.hypot\(player\.pos\.x-p\.x,player\.pos\.z-p\.z\)>38\) continue/);
  assert.match(serverWorld, /Central court fountain base/);
  assert.match(world, /TOWN_INTERACTION_ZONES = Object\.freeze/);
  assert.match(world, /meditation: \{ x: HUB\.meditate\.x, z: HUB\.meditate\.z, radius: 8\.6 \}/);
  assert.doesNotMatch(world, /buildCottage|SW house|S house|NE house/);
  assert.doesNotMatch(world, /inn sleeping alcoves|function curtain\(|propCloth|PlaneGeometry\(w,1\.35\)|TG\+1\.62/);
  assert.doesNotMatch(world, /lamp posts around the plaza/);
  assert.doesNotMatch(world, /fillBox\(lx,G\+1,lz, lx,G\+3,lz, B\.LOG\); setB\(lx,G\+4,lz,B\.GLASS\)/);
  assert.doesNotMatch(world, /fillBox\(TC,G\+1,TC, TC,G\+3,TC, B\.BRICK\)|setB\(TC,G\+2,TC,B\.WATER\)|setB\(TC,G\+4,TC,B\.WATER\)/);
  assert.doesNotMatch(world, /type:'splash', rate:20/);
  assert.doesNotMatch(menus, /SW cottage|S cottage|NE cottage|each cottage/);
  assert.doesNotMatch(serverWorld, /cottage SW|cottage S|cottage NE/);
});

test('Town of Beginnings gives every public building or worksite a physical sign', () => {
  const world = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'world.mjs'), 'utf8');
  assert.match(world, /const TOWN_BUILDING_SIGNS=Object\.freeze\(\[/);
  assert.match(world, /function makeTownBuildingSign\(spec\)/);
  assert.match(world, /TOWN_BUILDING_SIGNS\.forEach\(makeTownBuildingSign\)/);
  for (const title of [
    'GUILD HALL', 'TAVERN & INN', 'SMITHY', 'MEDITATION HALL', 'DRAGON ROOST',
    'WESTWIND SKYPORT', 'MARKET STALLS', 'FARM PLOTS', 'QUARRY WORK', 'DUNGEON SHARD', 'AEGIS SHRINE',
  ]) {
    assert.match(world, new RegExp(`title:'${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  }
  assert.doesNotMatch(world, /title:'GUILD HALL'[\s\S]*?x:dpx\(57,'guild'\),z:dpz\(37\.45,'guild'\)/);
  assert.doesNotMatch(world, /title:'TAVERN & INN'[\s\S]*?z:dpz\(76,'tavern'\)/);
  assert.doesNotMatch(world, /title:'SMITHY'[\s\S]*?z:dpz\(50,'forge'\)/);
  assert.doesNotMatch(world, /title:'MEDITATION HALL'[\s\S]*?x:dpx\(47,'shrine'\)/);
  assert.doesNotMatch(world, /title:'DRAGON ROOST'[\s\S]*?z:dpz\(65,'roost'\)/);
  assert.doesNotMatch(world, /makeShrineMeditationSign/);
  assert.doesNotMatch(world, /townPropX\(70\.86,76\)|townPropZ\(70\.86,76\)/);
  assert.doesNotMatch(world, /hanging tavern sign by the door/);
  assert.doesNotMatch(world, /title:'GUILD HALL'[\s\S]*?x:dpx\(52\.75,'guild'\),z:dpz\(37\.45,'guild'\)/);
  assert.doesNotMatch(world, /title:'TAVERN & INN'[\s\S]*?x:dpx\(70\.25,'tavern'\),z:dpz\(73\.25,'tavern'\)/);
  assert.doesNotMatch(world, /title:'SMITHY'[\s\S]*?x:dpx\(72\.7,'forge'\),z:dpz\(46\.6,'forge'\)/);
  assert.doesNotMatch(world, /title:'MEDITATION HALL'[\s\S]*?x:dpx\(43\.8,'shrine'\),z:dpz\(57\.15,'shrine'\)/);
  assert.doesNotMatch(world, /title:'DRAGON ROOST'[\s\S]*?x:dpx\(87\.15,'roost'\),z:dpz\(61\.5,'roost'\)/);
});

test('Town of Beginnings has explainer NPC helpers for major areas', () => {
  const world = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'world.mjs'), 'utf8');
  const combat = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'combat.mjs'), 'utf8');
  for (const [role, area] of [
    ['guide', 'central quest path'],
    ['quartermaster', 'market stalls'],
    ['scholar', 'Dungeon Shard'],
    ['smith', 'Smithy'],
    ['miner', 'Quarry Work'],
    ['farmer', 'Farm Plots'],
    ['cook', 'Tavern & Inn'],
    ['monk', 'Meditation Hall'],
    ['stablemaster', 'Dragon Roost'],
    ['guild_receptionist', 'Guild Hall'],
    ['social_mentor', 'chat and teams'],
    ['cartographer', 'Royal Cartographer'],
    ['road_warden', 'roads and regional contracts'],
    ['job_mentor', 'Job Board'],
    ['skyship_attendant', 'Westwind Skyport'],
  ]) {
    assert.match(world, new RegExp(`role:'${role}'`), `${area} needs an explainer NPC`);
  }
  assert.match(world, /fixedY:HUB\.skyport\.y\+1/);
  assert.match(world, /Number\.isFinite\(def\.fixedY\)\?def\.fixedY:TOWN\.G\+1/);
  assert.match(combat, /vill\.role==='job_mentor'/);
  assert.match(combat, /vill\.role==='scholar'/);
  assert.match(combat, /Dungeon Shards open Gates/);
  assert.match(combat, /vill\.role==='skyship_attendant'/);
  assert.match(world, /Rabbits, deer, and boars can rarely drop pet collars/);
});

test('wild pet familiar discovery is taught through hunting and familiar UI', () => {
  const networking = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8');
  const menus = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'menus.mjs'), 'utf8');
  const jobs = fs.readFileSync(path.join(__dirname, '..', '..', 'shared', 'job-system.js'), 'utf8');
  assert.match(networking, /PET_FAMILIAR_COLLAR_IDS/);
  assert.match(networking, /Pet collar found:/);
  assert.match(networking, /rabbits, deer, and boars outside town can rarely drop pet collars/);
  assert.match(networking, /press <b>K<\/b> to call your familiar/);
  assert.match(menus, /Pet collars can drop from animals outside town/);
  assert.match(menus, /COLLARS<\/b> hunt wildlife outside town/);
  assert.match(jobs, /Rare pet collars can drop from rabbits, deer, and boars/);
});

test('Town systems use district anchors instead of stale compact-town coordinates', () => {
  const combat = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'combat.mjs'), 'utf8');
  const menus = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'menus.mjs'), 'utf8');
  const networking = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8');
  const world = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'world.mjs'), 'utf8');
  const frameLoop = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8');
  const constants = fs.readFileSync(path.join(__dirname, '..', 'rooms', 'constants.js'), 'utf8');
  const events = fs.readFileSync(path.join(__dirname, '..', 'rooms', 'events.mixin.js'), 'utf8');
  const economy = fs.readFileSync(path.join(__dirname, '..', 'rooms', 'economy.mixin.js'), 'utf8');
  const room = fs.readFileSync(path.join(__dirname, '..', 'rooms', 'GameRoom.js'), 'utf8');
  const progression = fs.readFileSync(path.join(__dirname, '..', 'rooms', 'progression.mixin.js'), 'utf8');

  assert.match(world, /tavernDice: \{ x: dpx\(74\.5, 'tavern'\), z: dpz\(89\.5, 'tavern'\) \}/);
  assert.match(combat, /HUB\.tavernDice\.x/);
  assert.match(combat, /HUB\.tavernBlackjack\.x/);
  assert.match(combat, /HUB\.tavernRoulette\.x/);
  assert.match(menus, /HUB\.smith\.x/);
  assert.match(networking, /HUB\.smith\.x/);
  assert.match(menus, /MENU_TOWN_DISTRICTS=Object\.freeze/);
  assert.match(menus, /potionVapors\.push\(\{x:townPx\(x,'tavern'\)/);
  assert.match(menus, /addRug\(townPx\(78\.5,'tavern'\), townPz\(78,'tavern'\)/);
  assert.match(menus, /addPainting\(townPx\(52,'guild'\), G\+3\.15, townPz\(24\.55,'guild'\)/);
  assert.match(menus, /seedChest\(townCx\(75,'forge'\), TOWN\.G\+1, townCz\(46,'forge'\)/);
  assert.match(constants, /SKYSHIP_DOCK_X = W\.townPos\(32, 64, 'skyport'\)\.x - 23/);
  assert.match(events, /const dock = W\.townPos\(32, 64, 'skyport'\)/);
  assert.match(room, /W\.townPos\(78\.5, 50, 'forge'\)/);
  assert.match(room, /W\.townPos\(54\.5,26\.5,'guild'\)/);
  assert.match(progression, /const sx = W\.HUB\.meditate\.x, sz = W\.HUB\.meditate\.z/);
  assert.match(combat, /globalThis\.TOWN_INTERACTION_ZONES&&globalThis\.TOWN_INTERACTION_ZONES\.meditation/);
  assert.match(frameLoop, /HUB\.tavernHearth\.x/);
  assert.match(frameLoop, /HUB\.forgeFire\.x/);
  assert.match(world, /const district=townPropDistrict\(x,z\)/);
  assert.match(world, /\{x:HUB\.tavernChimney\.x, y:TG\+12\.7,\s+z:HUB\.tavernChimney\.z,\s+type:'smoke',\s+rate:4,\s+nightOnly:true,\s+maxDist:28\}/);
  assert.match(economy, /townTavernAnchor\(74\.5, 89\.5\)/);
  assert.match(economy, /townTavernAnchor\(79\.5, 89\.5\)/);
  assert.match(economy, /townTavernAnchor\(84\.5, 89\.5\)/);
  assert.doesNotMatch(combat, /TOWN\.TC\+10\.5|TOWN\.TC\+15\.5|TOWN\.TC\+20\.5/);
  assert.doesNotMatch(economy, /TOWN\.TC\+10\.5|TOWN\.TC\+15\.5|TOWN\.TC\+20\.5|TOWN\.TC\+19\.5|TOWN\.TC\+12\.5/);
  assert.doesNotMatch(menus + networking + room, /TOWN\.TC\+14\.5|TOWN\.TC-14/);
  assert.doesNotMatch(combat + progression, /tc\(43\)|tc\(51\)|tc\(41\)|tc\(55\)|TOWN\.TC - 16\.5|TOWN\.TC - 16/);
  assert.doesNotMatch(frameLoop, /tp\(79\.5\)|tp\(85\.4\)|tp\(81\.7\)|tp\(48\.5\)/);
  assert.doesNotMatch(menus, /bartender\.grp\.position\.set\(tp|tokenCashier\.grp\.position\.set\(tp|potionVapors\.push\(\{x:tp|addRug\(tp|addPainting\(tp|addFlowerPot\(tp|seedChest\(tc\(85\)|seedChest\(tc\(75\)/);
  assert.doesNotMatch(constants + events, /TOWN\.TC - 32/);
});

test('Town Map is granted by Orin and opens as a live position item', () => {
  const world = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'world.mjs'), 'utf8');
  const menus = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'menus.mjs'), 'utf8');
  const combat = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'combat.mjs'), 'utf8');
  const networking = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'styles.css'), 'utf8');
  const room = fs.readFileSync(path.join(__dirname, '..', 'rooms', 'GameRoom.js'), 'utf8');
  const constants = fs.readFileSync(path.join(__dirname, '..', 'rooms', 'constants.js'), 'utf8');
  const store = fs.readFileSync(path.join(__dirname, '..', 'store.js'), 'utf8');

  assert.match(constants, /TOWN_MAP: 217/);
  assert.match(constants, /\[I\.TOWN_MAP\]: 'Town Map'/);
  assert.match(world, /TOWN_MAP:217/);
  assert.match(world, /ITEMS\[I\.TOWN_MAP\]=\{name:'Town Map',stack:1/);
  assert.match(world, /BlockcraftTownLayout/);
  assert.match(room, /ensureTownMapIntroduction\(prof\)/);
  assert.match(room, /ensureTownMapBackfill\(prof\)/);
  assert.match(room, /first_town_map/);
  assert.match(room, /claim_town_map/);
  assert.match(room, /townMapClaimed/);
  assert.match(store, /townMapClaimed/);
  assert.match(menus, /function openTownMapUI\(\)/);
  assert.match(menus, /BlockcraftTownMap=\{open:openTownMapUI,isMovementOverlay:\(\)=>townMapMovementOverlay\}/);
  assert.match(menus, /setTownMapMovementOverlay\(true\)/);
  assert.match(menus, /lockFallback=true;\s*locked=true;\s*refreshPlayUi\(\)/);
  assert.doesNotMatch(menus, /const roads=\[/);
  assert.match(menus, /drawTownMapCanvas\(canvas\)/);
  assert.match(styles, /body\.town-map-open #crosshair\{display:none\}/);
  assert.match(menus, /action==='cartographer'/);
  assert.match(combat, /heldRC && heldRC\.id===I\.TOWN_MAP/);
  assert.match(networking, /room\.onMessage\('townMapClaimed'/);
  assert.match(styles, /\.town-map-canvas/);
});

test('overworld battle soundtrack is driven by hostile non-dungeon mobs', () => {
  const world = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'world.mjs'), 'utf8');
  const frame = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8');
  assert.match(world, /function inOverworldBattle\(\)\{/);
  assert.match(world, /if\(dim!=='overworld'\|\|isTownLand\(Math\.floor\(player\.pos\.x\),Math\.floor\(player\.pos\.z\)\)\)return false;/);
  assert.match(world, /if\(m\.ref&&\(m\.ref\.dgn\|\|''\)\)return false;/);
  assert.match(world, /BATTLE_MUSIC_STATES\.has\(state\)/);
  assert.match(world, /inOverworldBattle,/);
  assert.match(frame, /SFX\.tick\(dt, fd, 1-gDayF, dim==='overworld', inTown, isInsideTavern\(\), inMenu, !!cutscene, worldApi\.inOverworldBattle\(\)\);/);
});

test('client renders Deity power effects and stealth shimmer states', () => {
  const visuals = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'replication-visuals.mjs'), 'utf8');
  const companions = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'companions.mjs'), 'utf8');
  const frame = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8');
  const pump = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'network-frame-pump.mjs'), 'utf8');
  assert.match(visuals, /function deityPowerFx\(m\)/);
  assert.match(visuals, /m\.t==='deityPower'/);
  assert.match(visuals, /DEITY FLIGHT/);
  assert.match(visuals, /STORM CALLED/);
  assert.match(companions, /function addInvisibilityVisual\(r\)/);
  assert.match(companions, /function tickInvisibilityVisual\(r,now\)/);
  assert.match(frame, /deityFlying&&Math\.random\(\)<dt\*22/);
  assert.doesNotMatch(pump, /ref\.invisible!==true/);
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

test('overworld cave networks add explorable underground routes from cave landmarks', () => {
  const nets = W.caveNetworkSpecs();
  assert.equal(nets.length >= 2, true, 'world has multiple cave networks');
  assert.equal(nets.every(net => net.points.length >= 6 && net.caverns.length >= 3), true, 'each cave has route points and caverns');
  const world = W.createWorld(); world.generate();
  for (const net of nets) {
    let air = 0, lights = 0, ores = 0;
    for (const p of net.points) {
      for (let x = p.x - 4; x <= p.x + 4; x++) for (let y = p.y - 3; y <= p.y + 3; y++) for (let z = p.z - 4; z <= p.z + 4; z++) {
        const id = world.getB(x, y, z);
        if (id === W.B.AIR) air++;
        if (id === W.B.TORCH || id === W.B.LANTERN) lights++;
        if (id === W.B.COAL_ORE || id === W.B.IRON_ORE || id === W.B.DIAMOND_ORE) ores++;
      }
    }
    for (const c of net.caverns) {
      for (let x = c.x - c.rx; x <= c.x + c.rx; x++) for (let y = c.y - c.ry; y <= c.y + c.ry; y++) for (let z = c.z - c.rz; z <= c.z + c.rz; z++) {
        const id = world.getB(x, y, z);
        if (id === W.B.AIR) air++;
        if (id === W.B.TORCH || id === W.B.LANTERN) lights++;
        if (id === W.B.COAL_ORE || id === W.B.IRON_ORE || id === W.B.DIAMOND_ORE) ores++;
      }
    }
    assert.equal(air > 900, true, `${net.id} has carved tunnel/cavern air`);
    assert.equal(lights > 0, true, `${net.id} has readable torch or lantern routes`);
    assert.equal(ores > 0, true, `${net.id} has mineable ore seams`);
  }
  const clientWorld = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'world.mjs'), 'utf8');
  assert.match(clientWorld, /function caveNetworkSpecs\(\)/);
  assert.match(clientWorld, /function buildCaveNetworks\(setBlock,getBlock=getB\)/);
  assert.match(clientWorld, /buildCaveNetworks\(setB,getB\)/);
  assert.doesNotMatch(clientWorld, /isTrainingMeadowLandClient/);
});

test('ancient city POIs generate rare deep halls, vaults, core chambers, and lore hooks', () => {
  const cities = W.ancientCitySpecs();
  assert.equal(cities.length >= 1, true, 'world has ancient city POIs below cave routes');
  assert.equal(cities.every(city => city.y >= 10 && city.y <= 20), true, 'ancient cities sit in the deep y 10-20 band');
  assert.equal(cities.every(city => city.core && city.core.bossKind === 'ancient_warden'), true, 'core chambers reserve the Warden boss hook');
  assert.equal(cities.every(city => city.vaults.length >= 2 && city.tablets.length >= 2), true, 'cities include vault rooms and lore tablets');
  assert.equal(W.ancientCityLootTable().some(row => row.requires === 'ancient_warden'), true, 'loot table reserves the rare Warden ability reward');
  const discoveries = W.ancientCityDiscoverySpecs();
  assert.equal(discoveries.some(s => s.type === 'ancient_city' && s.name === 'Ancient City'), true, 'ancient cities are mapped as discoveries');
  assert.equal(discoveries.filter(s => s.type === 'ancient_vault').length >= cities.length * 2, true, 'vault chests have persistent discovery ids');
  assert.equal(discoveries.some(s => s.type === 'ancient_core' && s.bossKind === 'ancient_warden'), true, 'core discovery exposes the Warden hook');
  const world = W.createWorld(); world.generate();
  for (const city of cities) {
    let air = 0, brick = 0, lights = 0, chests = 0, core = 0;
    for (let x = city.x - city.radius; x <= city.x + city.radius; x++)
      for (let y = city.y - 4; y <= city.y + 8; y++)
        for (let z = city.z - city.radius; z <= city.z + city.radius; z++) {
          const id = world.getB(x, y, z);
          if (id === W.B.AIR) air++;
          if (id === W.B.BRICK || id === W.B.COBBLE) brick++;
          if (id === W.B.TORCH || id === W.B.LANTERN) lights++;
          if (id === W.B.CHEST) chests++;
          if (id === W.B.DIAMOND_ORE || id === W.B.GLASS) core++;
        }
    assert.equal(air > 1200, true, `${city.id} has carved halls and rooms`);
    assert.equal(brick > 600, true, `${city.id} has broken brick architecture`);
    assert.equal(lights >= 8, true, `${city.id} is lantern/torch readable`);
    assert.equal(chests >= 2, true, `${city.id} has treasure vault chests`);
    assert.equal(core >= 3, true, `${city.id} has an ancient core chamber`);
    for (const tablet of city.tablets) {
      assert.equal(world.getB(tablet.x, tablet.y + 1, tablet.z), W.B.BRICK, `${tablet.id} has a tablet body`);
      assert.equal(world.getB(tablet.x, tablet.y + 2, tablet.z), W.B.LANTERN, `${tablet.id} has a recall/lore marker`);
    }
  }
  const clientWorld = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'world.mjs'), 'utf8');
  const combat = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'combat.mjs'), 'utf8');
  const frame = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8');
  const menus = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'menus.mjs'), 'utf8');
  const networking = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8');
  const replication = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'replication-visuals.mjs'), 'utf8');
  const room = fs.readFileSync(path.join(__dirname, '..', 'rooms', 'GameRoom.js'), 'utf8');
  const combatMixin = fs.readFileSync(path.join(__dirname, '..', 'rooms', 'combat.mixin.js'), 'utf8');
  const spawningMixin = fs.readFileSync(path.join(__dirname, '..', 'rooms', 'spawning.mixin.js'), 'utf8');
  const progressionMixin = fs.readFileSync(path.join(__dirname, '..', 'rooms', 'progression.mixin.js'), 'utf8');
  assert.match(clientWorld, /function ancientCitySpecs\(\)/);
  assert.match(clientWorld, /function ancientCityLootTable\(\)/);
  assert.match(clientWorld, /function ancientCityDiscoverySpecs\(\)/);
  assert.match(clientWorld, /function buildAncientCities\(setBlock,getBlock=getB\)/);
  assert.match(clientWorld, /ancientCities=buildAncientCities\(setB,getB\)/);
  assert.match(clientWorld, /bossKind:'ancient_warden'/);
  assert.match(clientWorld, /buildAncientCities\(setB,getB\)/);
  assert.match(combat, /function nearbyAncientCityInteractable\(range=6,hit=null\)/);
  assert.match(combat, /function interactAncientCityDiscovery\(s\)/);
  assert.ok(combat.indexOf('interactAncientCityDiscovery(nearbyAncientCityInteractable(7,hit))') < combat.lastIndexOf('if(hit.id===B.CHEST)'), 'ancient vaults are intercepted before normal chest storage');
  assert.match(combat, /function blockInteractionPrompt\(hit\)/);
  assert.match(frame, /Ancient Vault/);
  assert.match(frame, /Ancient Core/);
  assert.match(frame, /Deep ruins - read tablets, open vaults, and approach the core carefully/);
  assert.match(room, /W\.ancientCityDiscoverySpecs\(\)/);
  assert.match(room, /'ancient_tablet','ancient_vault','ancient_core'/);
  assert.match(room, /ancientWardenAlarms = new Map/);
  assert.match(room, /triggerAncientWardenAlarm\(client, s, ring\)/);
  assert.match(room, /spawnAncientWarden\(client, s, ring, alarm\)/);
  assert.match(room, /Warden Cleaver/);
  assert.match(combatMixin, /killedMeta\.ancientWarden/);
  assert.match(combatMixin, /I\.WARDEN_CLEAVER/);
  assert.match(spawningMixin, /meta\.ancientWarden \? '\[Ancient City\]'/);
  assert.match(spawningMixin, /meta\.underground/);
  assert.match(progressionMixin, /caveSurveySites = new Map/);
  assert.match(room, /treasureMapReject',\{reason:'full'\}/);
  assert.match(room, /new Map\(\(ancient&&cities\.length \? basePool\.concat\(cities\) : basePool\)\.map\(s=>\[s\.id,s\]\)\)\.values\(\)/);
  assert.match(networking, /Make room in your inventory before claiming this treasure route/);
  assert.match(menus, /wardenAlarm\(level=1\)/);
  assert.match(networking, /room\.onMessage\('wardenAlarm'/);
  assert.match(networking, /room\.onMessage\('wardenDefeated'/);
  assert.match(replication, /ancient_warden:\{col:/);
  assert.match(replication, /m\.t==='wardenAlarm'\|\|m\.t==='wardenAwake'/);
});

test('client dimensions and server consume the shared grid contract', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'index.html'), 'utf8');
  const registerHtml = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'register.html'), 'utf8');
  const registerJs = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'register.js'), 'utf8');
  const splashAsset = path.join(__dirname, '..', '..', 'client', 'assets', 'splash-cinematic.png');
  const boot = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'boot.mjs'), 'utf8');
  const authSource = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'auth.mjs'), 'utf8');
  const runtimeFiles = ['world.mjs', 'dimensions.mjs', 'combat.mjs', 'hud.mjs', 'menus.mjs', 'networking.mjs', 'frame-loop.mjs'];
  const runtimeSource = runtimeFiles.map(name =>
    fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', name), 'utf8')
  ).join('\n');
  const dimensionScript = html.indexOf('<script src="/shared/dimension-grid.js"></script>');
  const commsScript = html.indexOf('<script src="/shared/comms-rules.js"></script>');
  const jobsScript = html.indexOf('<script src="/shared/job-system.js"></script>');
  const questObjectivesScript = html.indexOf('<script src="/shared/quest-objectives.js"></script>');
  const npcQuestChainsScript = html.indexOf('<script src="/shared/npc-quest-chains.js"></script>');
  const dungeonScript = html.indexOf('<script src="/shared/dungeon-generation.js"></script>');
  assert.equal(dimensionScript >= 0 && commsScript > dimensionScript && jobsScript > commsScript && questObjectivesScript > jobsScript && npcQuestChainsScript > questObjectivesScript && dungeonScript > npcQuestChainsScript, true);
  assert.match(html, /<script src="\/shared\/comms-rules\.js"><\/script>/);
  assert.match(html, /<script src="\/shared\/job-system\.js"><\/script>/);
  assert.match(html, /<script src="\/shared\/quest-objectives\.js"><\/script>/);
  assert.match(html, /<script src="\/shared\/npc-quest-chains\.js"><\/script>/);
  assert.match(html, /<script src="\/shared\/gear-system\.js"><\/script>/);
  assert.match(html, /<script src="\/shared\/dungeon-generation\.js"><\/script>/);
  assert.match(html, /<script type="module" src="\/js\/boot\.mjs"><\/script>/);
  assert.match(boot, /import\('\.\/game-context\.mjs'\)/);
  assert.match(boot, /createGameContext\(\{\s*services:/);
  let previousModule = -1;
  for (const name of runtimeFiles) {
    const offset = boot.indexOf(`'./${name}'`);
    assert.ok(offset > previousModule, `${name} is loaded in runtime order`);
    previousModule = offset;
  }
  assert.ok(Buffer.byteLength(html) < 20_000, 'index.html remains a small markup and bootstrap shell');
  assert.match(html, /id="playbtn" disabled/);
  assert.match(html, /id="registerbtn" class="hidden" type="button" disabled hidden aria-hidden="true"/);
  assert.match(html, /assets\/splash-cinematic\.png/);
  assert.ok(fs.statSync(splashAsset).size > 10_000, 'splash cinematic asset is packaged with the client');
  assert.match(registerHtml, /id="registerForm"/);
  assert.match(registerHtml, /name="yearGroup"/);
  assert.doesNotMatch(registerHtml, /name="school"/);
  assert.match(registerHtml, /find your school from your email address/);
  assert.match(registerJs, /\/auth\/student\/register/);
  assert.doesNotMatch(registerJs, /form\.school/);
  assert.match(authSource, /localStorage\.setItem\(sessionKey/);
  assert.match(authSource, /Authorization: 'Bearer ' \+ token/);
  assert.match(html, /id="huntersetup" class="hunter-setup hidden"/);
  assert.match(html, /id="gearrewardwin"/);
  assert.match(boot, /dataset\.gamePhase\s*=\s*'ready'[\s\S]*button\.disabled\s*=\s*false/);
  assert.doesNotMatch(html, /\.\/js\/ui\.js/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'hud.mjs'), 'utf8'), /HUD hotbar/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'hud.mjs'), 'utf8'), /function itemTriageTags/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'hud.mjs'), 'utf8'), /Storage: protected - bulk chest shortcuts leave this in your bag/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'hud.mjs'), 'utf8'), /Action: compare first; lock good gear or salvage extras at Tobin/);
  const menusSource = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'menus.mjs'), 'utf8');
  assert.match(menusSource, /inventory \/ crafting UI/);
  assert.match(menusSource, /registerModule\('menus'/);
  assert.match(menusSource, /export const api=gameContext\.requireModule\('menus'\)/);
  assert.match(menusSource, /function renderGearComparison/);
  assert.match(menusSource, /SELECTED GEAR/);
  assert.match(menusSource, /UPGRADE/);
  assert.match(menusSource, /REPAIR AT TOBIN/);
  assert.match(menusSource, /STAMINA COST/);
  assert.match(menusSource, /HOMESTEAD SUPPLY/);
  assert.match(menusSource, /MARK SUPPLY/);
  assert.match(menusSource, /chestSupplyModeHint/);
  assert.match(menusSource, /chestMode/);
  assert.match(menusSource, /treasureChestRevealSeen/);
  assert.match(menusSource, /function showTreasureChestReveal\(key, chest\)/);
  assert.match(menusSource, /TREASURE FOUND/);
  assert.match(menusSource, /SFX\.treasure\(\)/);
  assert.match(menusSource, /SORT BAG/);
  assert.match(menusSource, /requestInventorySort/);
  assert.match(menusSource, /DEPOSIT MATCHING/);
  assert.match(menusSource, /DEPOSIT MATERIALS/);
  assert.match(menusSource, /requestChestBatchDeposit/);
  assert.match(menusSource, /function sellDecisionLine/);
  assert.match(menusSource, /function salvageDecisionLine/);
  assert.match(menusSource, /Possible upgrade:/);
  assert.match(menusSource, /Sell extras only - used for crafting and reforging/);
  assert.match(menusSource, /inventoryFullHelpHTML/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8'), /armorMovement[\s\S]*staminaCostMultiplier[\s\S]*moveMultiplier/);
  const networkingSource = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8');
  assert.match(networkingSource, /registerState\('networking'/);
  assert.match(networkingSource, /registerModule\('networking'/);
  assert.match(networkingSource, /export const api=gameContext\.requireModule\('networking'\)/);
  assert.match(networkingSource, /multiplayer \(colyseus\)/);
  assert.match(networkingSource, /Event'[\s\S]*Hunter XP/, 'event completion names its exact XP reward');
  assert.match(networkingSource, /chestModeResult/);
  assert.match(networkingSource, /chestBatchResult/);
  assert.match(networkingSource, /inventorySortResult/);
  assert.match(networkingSource, /function itemTriageSummary/);
  assert.match(networkingSource, /function rewardItemsGroupedHTML/);
  assert.match(networkingSource, /Loot triage:/);
  assert.match(networkingSource, /Reward triage:/);
  assert.match(networkingSource, /Sort your bag, deposit supplies/);
  assert.match(networkingSource, /Only the owner can withdraw from Homestead Supply/);
  assert.match(networkingSource, /Supply mode unlocks inside a connected 3-claim Homestead/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'world.mjs'), 'utf8'), /Supply Chests/);
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
  assert.match(html, /shared\/familiar-system\.js/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'companions.mjs'), 'utf8'), /BlockcraftFamiliarSystem/);
  assert.match(menusSource, /Familiars grow through <b>Bond XP<\/b> earned only while they are active/);
  assert.match(menusSource, /familiarBindingSlot\(def\.sigil\)/);
  assert.match(menusSource, /Daily Bond:/);
  assert.match(menusSource, /BIND '\+def\.name\.toUpperCase\(\)/);
  assert.match(menusSource, /Rare Cat Collar from rabbits and hares outside town/);
  assert.match(menusSource, /Rare Dog Collar from deer and stags outside town/);
  assert.match(menusSource, /Rare Wolf Collar from boars outside town/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'companions.mjs'), 'utf8'), /cat:\{ name:'Cat', sigil:I\.CAT_COLLAR/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'world.mjs'), 'utf8'), /ITEMS\[I\.CAT_COLLAR\]=\{name:'Cat Collar'/);
  assert.match(runtimeSource, /Caravan Under Attack/);
  assert.match(runtimeSource, /utilityEquipped\('compass'\)/);
  assert.match(runtimeSource, /mapUtility&&overworldActivity/);
  assert.match(runtimeSource, /Talk to Caravan Merchant/);
  assert.match(html, /id="kinghud"/);
  assert.match(html, /id="eventhud"/);
  assert.match(html, /id="eventroster"/);
  assert.match(runtimeSource, /Syncing event schedule/);
  assert.match(runtimeSource, /stagingRoster/);
  assert.match(runtimeSource, /function pulseEventHud\(\)/);
  assert.match(runtimeSource, /Staging started:/);
  assert.match(runtimeSource, /Ready confirmed/);
  assert.match(runtimeSource, /All hunters ready/);
  assert.match(runtimeSource, /eventJoinBtn\.textContent=NET\.on\?'SYNCING':'CONNECTING'/);
  assert.match(runtimeSource, /serverEvent\.phase==='starting'\) confirmEventReady\(\)/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8'), /renderEventHud\(\)/);
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
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8'), /OBJECTIVE/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8'), /Rooms Cleared/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8'), /Boss locked/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8'), /Boss open/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8'), /dungeonBossHud/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8'), /Near boss room/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8'), /Reward eligible/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8'), /Hit boss to qualify/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'menus.mjs'), 'utf8'), /Boss phase/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'menus.mjs'), 'utf8'), /Boss casting/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'menus.mjs'), 'utf8'), /Punish window open/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8'), /Room cleared/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8'), /Boss gate progress/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8'), /Boss down\. Open remaining chests/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8'), /Stay as spirit for party credit/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8'), /Return to town now/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8'), /Stay for party credit/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'dimensions.mjs'), 'utf8'), /Collapses in /);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'dimensions.mjs'), 'utf8'), /gateUrgency/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8'), /Collapse imminent/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'replication-visuals.mjs'), 'utf8'), /expiresAt:g\.expiresAt/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8'), /gateBreach/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8'), /Gate Breach Emergency/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8'), /gateBreachCleared/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8'), /Gate breach contained/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8'), /Full clear rewards only come from beating the Gate before collapse/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8'), /Cleanup paid .* clear XP plus materials only, no keys/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8'), /Public cleanup bounties are for outside responders/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8'), /Gate Scar remains/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8'), /reduced XP \+ materials, no keys/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8'), /Gate Breach:/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8'), /Gate Scar:/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8'), /BREACH AFTERMATH/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8'), /Emergency bounty/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8'), /PUBLIC CLEANUP/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8'), /activityTimeLeft/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'world.mjs'), 'utf8'), /overworldActivity\.gateBreach/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'world.mjs'), 'utf8'), /overworldActivity\.gateScar/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'replication-visuals.mjs'), 'utf8'), /\^Breached /);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8'), /Gate clear recap/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8'), /Boss mastery/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8'), /Clean mastery earned/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8'), /Gate opens in /);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8'), /enterDungeonAfterCountdown/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'server', 'rooms', 'dungeon.mixin.js'), 'utf8'), /Stay together until first room/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'server', 'rooms', 'dungeon.mixin.js'), 'utf8'), /Gate collapse timer continues outside/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8'), /public cleanup pays reduced XP and materials only/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8'), /Optional chests remain/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'world.mjs'), 'utf8'), /Exit through the portal when ready/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'world.mjs'), 'utf8'), /Full clear reward awarded/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'world.mjs'), 'utf8'), /function groupedRewardLootHTML/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'world.mjs'), 'utf8'), /Rare Protected/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'world.mjs'), 'utf8'), /No clear loot, progress, keys, shards, or gear/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'styles.css'), 'utf8'), /\.dungeonrun/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'styles.css'), 'utf8'), /\.rewardgroup/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'styles.css'), 'utf8'), /small\.safety/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'styles.css'), 'utf8'), /\.recipetags/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'styles.css'), 'utf8'), /\.recipeitem\.next/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'styles.css'), 'utf8'), /\.objective-crafts/);
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
  const poolSource = fs.readFileSync(path.join(__dirname, '..', '..', 'shared', 'dungeon-pools.js'), 'utf8');
  const dungeonSource = fs.readFileSync(path.join(__dirname, '..', '..', 'shared', 'dungeon-generation.js'), 'utf8');
  const browser = { Uint8Array, Set, Math, Number, TypeError };
  vm.createContext(browser);
  vm.runInContext(dimensionSource, browser);
  vm.runInContext(poolSource, browser);
  vm.runInContext(dungeonSource, browser);
  const browserDungeon = browser.BlockcraftDungeonGeneration.createDungeonGeneration({
    B: W.B,
    hash2: W.hash2,
  });

  for (const [rank, seed, dungeonId] of [[0, 1, 'abandoned_mine'], [0, 1, 'sunken_crypt'], [0, 1, 'mossbound_cellar'], [2, 0x12345678], [4, 0xfedcba98]]) {
    const nodeResult = serverDungeon.generateDungeon(rank, seed, dungeonId);
    const browserResult = browserDungeon.generateDungeon(rank, seed, dungeonId);
    assert.equal(browserResult.dungeonId, nodeResult.dungeonId);
    assert.deepEqual(JSON.parse(JSON.stringify(browserResult.rooms)), nodeResult.rooms);
    assert.deepEqual(JSON.parse(JSON.stringify(browserResult.spawns)), nodeResult.spawns);
    assert.deepEqual(Buffer.from(browserResult.world.data), Buffer.from(nodeResult.world.data));
  }

  const variants = ['abandoned_mine', 'sunken_crypt', 'mossbound_cellar'].map(id => serverDungeon.generateDungeon(0, 7, id));
  assert.equal(new Set(variants.map(v => Buffer.from(v.world.data).toString('base64'))).size, 3, 'each E-rank identity produces a distinct world');
  assert.deepEqual(variants.map(v => v.definition.boss), ['The Foreman', 'The Drowned Regent', 'The Rootbound Keeper']);
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
  const { onboardingResourceCells, onboardingTreeTarget, isOnboardingTreeLog } = await clientModule('onboarding.mjs');
  const meadow = { x: 100, z: 200, G: 12 };
  const cells = onboardingResourceCells(meadow, { LOG: 5, WHEAT_3: 25 });
  assert.deepEqual(onboardingTreeTarget(meadow), { x: 122, z: 194 });
  assert.deepEqual(cells.filter(cell => cell.id === 5).map(cell => [cell.x, cell.y, cell.z]), [
    [122, 13, 194], [122, 14, 194], [122, 15, 194], [122, 16, 194],
  ]);
  assert.equal(isOnboardingTreeLog(122, 13, 194, meadow), true);
  assert.equal(isOnboardingTreeLog(122, 17, 194, meadow), false);
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
    assert.deepEqual(milestones.map(m=>m.level),id==='monk'?[4,5,10,20]:[2,5,10,20],`${id} has the shared milestone ladder`);
    assert.equal(milestones.every(m=>sharedJobs.milestoneReward(id,m.level)), true, `${id} milestones resolve concrete rewards`);
    assert.equal(sharedJobs.milestoneState(id,1).next.level,id==='monk'?4:2);
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
  assert.equal(sharedJobs.MONK_RULES.regenLevel,4);
  assert.equal(sharedJobs.MONK_RULES.resourceRestoreFraction,.08);
  assert.equal(sharedJobs.MONK_RULES.stoneMitigation,.35);
  assert.equal(sharedJobs.MONK_RULES.auraCooldownMs,15000);
  assert.equal(sharedJobs.MINER_RULES.oreSenseLevel,2);
  assert.equal(sharedJobs.MINER_RULES.deepSurveyRadius,18);
  assert.equal(sharedJobs.MINER_RULES.geodeChance,.08);
  assert.equal(sharedJobs.reforgeCost('basic').gold,25);
  assert.equal(sharedJobs.reforgeCost('basic').iron,1);
  assert.deepEqual(sharedJobs.PROFESSION_REWARD_MULTIPLIER,{miner:1,farmer:1.25,cook:1.5,blacksmith:1.5,monk:1});
  assert.match(sharedJobs.gameplayHooks('miner',20).join(' '), /hidden cave routes|Prismatic Geodes/);
  assert.match(sharedJobs.gameplayHooks('cook',20).join(' '), /combat meals|Feast Platters/);
  assert.match(sharedJobs.gameplayHooks('blacksmith',20).join(' '), /Repair damaged gear|Masterwork/);
  assert.match(sharedJobs.gameplayHooks('farmer',20).join(' '), /food economy|Windseed/);
  assert.match(sharedJobs.gameplayHooks('monk',20).join(' '), /Restore mana and stamina|Shared Tranquillity/);
  const objectiveXp={miner:c=>c.need*(c.type==='treasure'?6:c.target===W.B.IRON_ORE?5:2),farmer:c=>c.need*3,cook:c=>c.need*(c.type==='sell'?3:4),blacksmith:c=>c.need*(c.type==='repair'?5:c.type==='upgrade'?10:c.type==='salvage'?6:6),monk:c=>c.need*.4};
  const allTargets = {STONE:W.B.STONE,IRON_ORE:W.B.IRON_ORE,WHEAT_3:W.B.WHEAT_3,IRON_INGOT:I.IRON_INGOT};
  const earlyRunway=sharedJobs.PROFESSION_IDS.map(job=>{let xp=0,contracts=0;while(sharedJobs.jobLevelFromXp(xp)<5&&contracts<30){const pool=sharedJobs.contractPool(job,sharedJobs.contractScaleFromXp(xp),5,allTargets);xp+=pool.reduce((sum,c)=>sum+c.rewardJobXp+objectiveXp[job](c),0)/pool.length;contracts++;}return contracts;});
  assert.equal(Math.max(...earlyRunway)<=7,true,'every profession reaches its first play-changing Lv5 unlock within seven average contracts');
  const runway=sharedJobs.PROFESSION_IDS.map(job=>{let xp=0,contracts=0;while(sharedJobs.jobLevelFromXp(xp)<20&&contracts<200){const pool=sharedJobs.contractPool(job,sharedJobs.contractScaleFromXp(xp),20,allTargets);xp+=pool.reduce((sum,c)=>sum+c.rewardJobXp+objectiveXp[job](c),0)/pool.length;contracts++;}return contracts;});
  assert.equal(Math.max(...runway)/Math.min(...runway)<1.2,true,'profession Lv20 runways remain within 20% of each other');
  const targets = allTargets;
  const adventurer = sharedJobs.contractPool('adventurer', 2, 5, targets);
  assert.deepEqual(adventurer.filter(c=>c.type==='kill').map(c=>c.title), ['Road Patrol','Threat Sweep','Dusk Watch','North Gate Sweep','Campfire Culling','Outer Ring Hunt','Supply Road Guard']);
  assert.equal(adventurer.find(c=>c.title==='Outer Ring Hunt').party, 'Helpful');
  assert.match(sharedJobs.contractBestFor(adventurer.find(c=>c.title==='Dusk Watch')), /quick combat loop/);
  const rotatedKillTitles = new Set();
  for (let i = 0; i < 8; i++) {
    sharedJobs.contractOffers('adventurer', 2, 5, targets, 100, i).filter(c=>c.type==='kill').forEach(c=>rotatedKillTitles.add(c.title));
  }
  assert.equal(rotatedKillTitles.size >= 6, true, 'repeatable kill offers rotate through varied combat contracts');
  const miner = sharedJobs.contractPool('miner', 2, 5, targets);
  assert.deepEqual(miner.map(c=>c.title), ['Stone Quota','Foundation Rush','Iron Survey','Deep Iron Run','Cave Mapping Shift','Deepmouth Survey','Ancient Seam Map','Surveyor\'s Cache Map','Forgotten Seam Charts']);
  assert.equal(miner[0].target, W.B.STONE);
  assert.equal(miner[0].need, 28);
  assert.equal(miner.every(c=>c.focus&&c.reward&&c.party), true, 'profession contracts explain focus, reward hook, and party relevance');
  assert.deepEqual(miner.filter(c=>c.type==='cave_survey').map(c=>c.title), ['Deepmouth Survey']);
  assert.deepEqual(miner.filter(c=>c.type==='ancient_map').map(c=>c.title), ['Ancient Seam Map']);
  assert.deepEqual(miner.filter(c=>c.type==='treasure').map(c=>c.title), ['Surveyor\'s Cache Map','Forgotten Seam Charts']);
  assert.match(sharedJobs.contractBestFor(miner.find(c=>c.title==='Surveyor\'s Cache Map')), /treasure map/);
  assert.match(sharedJobs.guideSteps('treasure').join(' '), /Orin|buried cache/i);
  assert.match(sharedJobs.guideSteps('cave_survey').join(' '), /cave entrance marker/i);
  assert.match(sharedJobs.guideSteps('ancient_map').join(' '), /Ancient City map/i);
  const storeSource = fs.readFileSync(path.join(__dirname, '..', 'store.js'), 'utf8');
  const jobsClientSource = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'quests-jobs.mjs'), 'utf8');
  assert.match(storeSource, /targetId: cleanShortText\(c\.targetId/);
  assert.match(jobsClientSource, /targetName: String\(contract\.targetName/);
  const blacksmith = sharedJobs.contractPool('blacksmith', 2, 5, targets);
  assert.deepEqual(blacksmith.map(c=>c.title), ['Forge Work','Gate Prep Kits','Tool Doctor','Edge Upgrade Order','Scrap Recovery','Ingot Commission']);
  assert.equal(blacksmith.find(c=>c.title==='Edge Upgrade Order').type, 'upgrade');
  assert.equal(blacksmith.find(c=>c.title==='Scrap Recovery').type, 'salvage');
  assert.equal(blacksmith.find(c=>c.title==='Ingot Commission').target, I.IRON_INGOT);
  assert.deepEqual(sharedJobs.contractTags({...blacksmith.find(c=>c.title==='Scrap Recovery'),difficulty:'quick'}), ['Fast','Cleanup','Solo']);
  assert.deepEqual(sharedJobs.contractTags({...blacksmith.find(c=>c.title==='Ingot Commission'),difficulty:'balanced',difficultyLabel:'Balanced'}).slice(0,3), ['Balanced','Targeted','Craft']);
  assert.match(sharedJobs.contractBestFor(blacksmith.find(c=>c.title==='Edge Upgrade Order')), /weapon or tool to improve/);
  assert.match(sharedJobs.guideSteps('upgrade').join(' '), /Upgrade, reforge, reroll, or masterwork/i);
  assert.match(sharedJobs.guideSteps('salvage').join(' '), /salvage/i);
  assert.match(sharedJobs.guideSteps('mine').join(' '), /stone or cobble/i);
  const cook = sharedJobs.contractPool('cook', 2, 5, targets);
  assert.deepEqual(cook.filter(c=>c.type==='hunt').map(c=>c.title), ['Fresh Meat Run','Campfire Butchery']);
  assert.match(sharedJobs.contractBestFor(cook.find(c=>c.title==='Fresh Meat Run')), /kitchen ingredients/);
  assert.match(sharedJobs.guideSteps('hunt').join(' '), /Hostile monsters do not count/i);
  const offers=sharedJobs.contractOffers('miner',2,5,targets,100,0);
  assert.deepEqual(offers.map(o=>o.difficulty),['quick','balanced','demanding']);
  assert.ok(offers[0].rewardXp<offers[1].rewardXp&&offers[1].rewardXp<offers[2].rewardXp);
  assert.equal(offers.every(o=>o.focus&&o.reward&&o.party&&o.location), true, 'timed offers carry identity metadata to the client');
  assert.deepEqual(offers.map(o=>o.estimate),['About 5 minutes','About 10 minutes','About 15–20 minutes']);
  const worldSource = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'world.mjs'), 'utf8');
  const progressionSource = fs.readFileSync(path.join(__dirname, '..', 'rooms', 'progression.mixin.js'), 'utf8');
  assert.match(worldSource, /BlockcraftJobSystem/);
  assert.match(worldSource, /function craftProfessionOutcome/);
  assert.match(worldSource, /function presentProfessionCraftOutcome/);
  assert.match(worldSource, /function jobContractNextHint/);
  assert.match(worldSource, /function jobContractGuidanceTarget/);
  assert.match(worldSource, /function jobContractRouteTo/);
  assert.match(worldSource, /const jobTarget=jobContractGuidanceTarget\(\);\s*if\(jobTarget\)return jobTarget;\s*if\(!isTownLand/);
  assert.match(worldSource, /dynamic\(jobTarget\.target,'#9fd7ff',5\)/);
  assert.match(worldSource, /function economyRecapHTML/);
  assert.match(worldSource, /function goldDeltaHTML/);
  assert.match(worldSource, /silentReady/);
  assert.match(worldSource, /JOBS\[outcome\.job\]\.name\)\+' craft:<\/b>/);
  assert.match(worldSource, /Contract ready:/);
  assert.match(worldSource, /complete:<\/b> \+'/);
  assert.match(worldSource, /Next: take another contract or prep for the next gate/);
  assert.match(progressionSource, /shared\/job-system/);
  assert.match(progressionSource, /contract: c, rewardGold/);
  assert.doesNotMatch(worldSource, /const pools=\{[\s\S]*Stone Order/);
  const menusSource=fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'menus.mjs'), 'utf8');
  assert.match(menusSource,/HUNTER OFFERS/);
  assert.match(menusSource,/offerId:offer\.id/);
  assert.match(menusSource,/function jobMilestoneHTML/);
  assert.match(menusSource,/function professionNowHTML/);
  assert.match(menusSource,/Next at Lv/);
  assert.match(menusSource,/Reward earned:/);
  assert.match(menusSource,/IRON_INGOT:I\.IRON_INGOT/);
  assert.match(menusSource,/jobContractProgress\('upgrade',1,s\.id\)\|\|jobContractProgress\('smith',1,s\.id\)/);
  assert.match(menusSource,/jobContractProgress\('salvage',1,0\)\|\|jobContractProgress\('smith',1,0\)/);
  assert.match(menusSource,/function contractTagHTML/);
  assert.match(menusSource,/function contractBestForHTML/);
  assert.match(menusSource,/function jobOfferLoopHTML/);
  assert.match(menusSource,/function jobOfferRewardHTML/);
  assert.match(menusSource,/function jobOfferCardHTML/);
  assert.match(menusSource,/function jobBoardCurrentContractHTML/);
  assert.match(menusSource,/function jobBoardMilestoneSummaryHTML/);
  assert.match(menusSource,/job-board-v2/);
  assert.match(menusSource,/job-profession-grid/);
  const liveJobBoard=menusSource.slice(menusSource.indexOf('function openJobsUI('),menusSource.indexOf('function iconNode('));
  assert.match(liveJobBoard,/Current Work/);
  assert.match(liveJobBoard,/Available Contracts/);
  assert.match(liveJobBoard,/Choose A Trade/);
  assert.match(liveJobBoard,/<small>'\+jobPerkText\(id\)\+'<\/small>/);
  assert.doesNotMatch(liveJobBoard,/escHTML\(jobPerkText\(id\)\)/);
  assert.doesNotMatch(liveJobBoard,/GUILD CONTRACTS/);
  assert.doesNotMatch(liveJobBoard,/UTILITIES/);
  assert.match(menusSource,/job-offer-loop/);
  assert.match(menusSource,/job-offer-rewards/);
  assert.match(menusSource,/job-offer-card/);
  assert.match(menusSource,/contractTagHTML\(offer\)/);
  const cssSource=fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'styles.css'), 'utf8');
  assert.match(cssSource,/\.contract-tags/);
  assert.match(cssSource,/\.contract-best/);
  assert.match(cssSource,/\.job-offer-card/);
  assert.match(cssSource,/\.job-offer-loop/);
  assert.match(cssSource,/\.job-offer-rewards/);
  assert.match(cssSource,/\.job-board-summary/);
  assert.match(cssSource,/\.job-board-current/);
  assert.match(cssSource,/\.job-profession-card/);
  assert.match(menusSource,/Reward next:/);
  assert.match(menusSource,/Right now:/);
  assert.match(menusSource,/Plant Prairie Windseed/);
  assert.match(menusSource,/Craft Golden Broth/);
  assert.match(menusSource,/Reforge selected/);
  assert.match(menusSource,/refresh focus/);
  assert.match(menusSource,/function selectProfessionItem/);
  assert.match(menusSource,/SELECT COMPOST/);
  assert.match(menusSource,/SELECT WINDSEED/);
  assert.match(menusSource,/FOOD RECIPES/);
  assert.match(menusSource,/TOOL RECIPES/);
  assert.match(menusSource,/Select reforge tool/);
  assert.match(menusSource,/function recipeJobLockText/);
  assert.match(menusSource,/function recipePurposeTags/);
  assert.match(menusSource,/function recipeUsedForHint/);
  assert.match(menusSource,/function recipeProgressionFocus/);
  assert.match(menusSource,/Craft this next/);
  assert.match(menusSource,/Gate Prep/);
  assert.match(menusSource,/profession recipe/);
  assert.match(menusSource,/Missing: /);
  assert.match(menusSource,/PRO READY/);
  assert.match(menusSource,/offerWhy/);
  assert.match(menusSource,/Focus: /);
  assert.match(menusSource,/Party: /);
  assert.match(menusSource,/Hook: /);
  assert.match(menusSource,/requestBlacksmithReforge/);
  assert.match(menusSource,/Temper Reroll/);
  assert.match(menusSource,/Blacksmith reforge:/);
  assert.match(menusSource,/Cost: /);
  assert.match(menusSource,/economyRecapHTML\(m\.gold\|\|0,gold/);
  assert.match(menusSource,/Salvage return/);
  assert.match(menusSource,/recapOnly/);
  assert.match(menusSource,/jobContractNextHint\(c\.job/);
  const networkingSource=fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8');
  assert.match(networkingSource,/function presentJobMilestone|const presentJobMilestone/);
  assert.match(networkingSource,/const presentJobContractClaim/);
  assert.match(networkingSource,/Starter items granted:/);
  assert.match(networkingSource,/jobContractNextHint\(job,m\.jobLevelAfter/);
  assert.match(networkingSource,/ready to claim/);
  assert.match(networkingSource,/Dungeon gold:/);
  assert.match(networkingSource,/Contract payout/);
  assert.match(networkingSource,/Protected claim purchased/);
  assert.match(networkingSource,/Treasure cache/);
  assert.match(networkingSource,/function showLevelUpReveal\(m\)/);
  assert.match(networkingSource,/function showDeityAscension\(m\)/);
  assert.match(networkingSource,/LEVEL UP/);
  assert.match(networkingSource,/room\.onMessage\('levelUp'/);
  assert.match(networkingSource,/room\.onMessage\('deityAscended'/);
  assert.match(networkingSource,/room\.onMessage\('deityPowerResult'/);
  assert.match(networkingSource,/applyDeityState\(m&&m\.deity\)[\s\S]*if\(!onboardingDone\(\)\)/);
  const dimensionsSource=fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'dimensions.mjs'), 'utf8');
  assert.match(dimensionsSource,/deityPowerChoose/);
  assert.match(dimensionsSource,/deityPowerUse/);
  assert.match(networkingSource,/rewardGain\('rare',statPoints\|\|1,'Stat Points'/);
  assert.match(networkingSource,/rewardGain\('legendary',1,'Deity Power'/);
  assert.match(networkingSource,/rewardGain\('rare',1,reward,\{icon:'JOB'\}\)/);
  assert.match(networkingSource,/JOB_SYSTEM\.milestoneReward/);
  assert.match(networkingSource,/Windseed planted/);
  assert.match(networkingSource,/Compost worked/);
  assert.match(networkingSource,/Golden Wheat!/);
  assert.match(networkingSource,/Restoration.*Flow.*Stone/);
  const progressionClientSource=fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'progression.mjs'), 'utf8');
  assert.match(progressionClientSource,/message\.milestones/);
  assert.match(progressionClientSource,/onJobMilestone/);
});

test('browser and server share authoritative quest objective descriptors', () => {
  const normalized = questObjectives.normalizeObjective({
    id: 'story:test',
    source: 'story',
    title: 'Test Story',
    status: 'claimable',
    text: 'Return to town.',
    location: 'Mara Vale',
    progress: { current: 2, required: 2 },
    reward: { gold: 10, xp: 20 },
    action: { type: 'turn_in', label: 'TURN IN TO MARA' },
  });
  assert.equal(normalized.category, 'story');
  assert.equal(normalized.hudAction.type, 'turn_in');
  assert.equal(normalized.questLogAction.type, 'turn_in');
  assert.equal(normalized.claimAction.type, 'turn_in');
  assert.match(normalized.hudText, /Complete/);
  assert.deepEqual(normalized.progress, { current: 2, required: 2 });
});

test('NPC story and manhunt quests come from one validated authoring registry', () => {
  const chains = npcQuestChains.createNpcQuestChains({ B: W.B, I });
  assert.deepEqual(npcQuestChains.validateNpcQuestChains(chains), []);
  assert.equal(chains['Mara Vale'][0].title, 'First Hands');
  assert.equal(chains['Mara Vale'][0].levelTarget, 2);
  assert.equal(chains['Pell Graywatch'][3].type, 'manhunt');
  assert.equal(chains['Pell Graywatch'][3].metadata.category, 'manhunt');
  assert.equal(chains['Pell Graywatch'][3].metadata.objectiveAction.type, 'hunt');
  assert.equal(chains['Pell Graywatch'][3].metadata.turnInAction.type, 'turn_in');
  assert.equal(chains['Pell Graywatch'][3].rewardItems[0].id, I.FANG_TOTEM);
  assert.equal(chains['Garrik Flint'][3].type, 'treasure');
  assert.equal(chains['Garrik Flint'][3].metadata.objectiveAction.type, 'guild_contracts');
  assert.equal(chains['Liss Barley'][0].type, 'farm');
  assert.equal(chains['Pippa Hearth'][0].type, 'cook');
  assert.equal(chains['Tobin Ashhand'][1].type, 'smith');
  assert.equal(chains['Greta Warmug'][0].type, 'sell');
  assert.equal(chains['Mara Vale'][3].utility, 'compass');
  assert.equal(chains['Mara Vale'][3].metadata.objectiveAction.type, 'utility');
  assert.equal(chains['Mara Vale'][5].familiar, 'shade');
  assert.equal(chains['Mara Vale'][6].mount, 'dragon');
  const runtime = npcQuestChains.buildRuntimeNpcQuest(chains['Mara Vale'][0], {
    giver: 'Mara Vale', role: 'guide', step: 0, total: chains['Mara Vale'].length, gold: 18, xp: 33, now: 123,
  });
  assert.equal(runtime.title, 'First Hands');
  assert.equal(runtime.have, 0);
  assert.equal(runtime.gold, 18);
  assert.equal(runtime.xp, 33);
  assert.equal(runtime.category, 'story');
  assert.equal(runtime.lifecycleState, 'offered');
  assert.equal(npcQuestChains.runtimeQuestMatchesDefinition(runtime, chains['Mara Vale'][0], 'Mara Vale', 0, chains['Mara Vale'].length), true);
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
  const uniqueSword=sharedGear.weaponCombatProfile({tier:3,cls:'sword'},{unique:'stormpiercer'});
  assert.equal(uniqueSword.unique.name,'Stormpiercer');
  assert.ok(uniqueSword.damage>sword.damage);
  assert.ok(uniqueSword.cooldownMs<sword.cooldownMs);
  const uniqueArmor=sharedGear.armorProfile({tier:3,dur:480},{unique:'voidweave_harness',armorType:'scout'});
  const scoutArmor=sharedGear.armorProfile({tier:3,dur:480},{armorType:'scout'});
  assert.equal(uniqueArmor.unique.name,'Voidweave Harness');
  assert.ok(uniqueArmor.moveMultiplier>scoutArmor.moveMultiplier);
  assert.ok(uniqueArmor.staminaCostMultiplier<scoutArmor.staminaCostMultiplier);
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

test('shadow army progression scales storage, deployment, capture odds, and boss upkeep',()=>{
  const shadow=require('../../shared/shadow-army');
  assert.deepEqual(shadow.limits(1),{rank:0,storage:3,deployed:1});
  assert.deepEqual(shadow.limits(51),{rank:5,storage:36,deployed:6});
  assert.equal(shadow.captureChance(2,1),.5);
  assert.equal(shadow.captureChance(2,2),.25);
  assert.equal(shadow.captureChance(2,3),.08);
  assert.equal(shadow.captureChance(2,1,{elite:true}),.25);
  assert.equal(shadow.captureChance(2,1,{boss:true}),.1);
  assert.equal(shadow.captureChance(1,1,{boss:true}),0);
  assert.equal(shadow.bossUpkeep(5),8);
  assert.equal(shadow.combatProfile('sun_archer',2).style,'ranged');
  assert.equal(shadow.combatProfile('bandit_brute',2).style,'brute');
  assert.equal(shadow.combatProfile('boss',3,true).style,'boss');
  assert.ok(shadow.combatProfile('boss',3,true).radius>2);
});

test('client prediction applies Arcanist mana and cooldown discounts',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','..','client','js','dimensions.mjs'),'utf8');
  assert.match(source,/mp-=abilityManaCost\(a\)/);
  assert.match(source,/abCd\[i\]=abilityCooldown\(a\)/);
  assert.match(source,/abCd\[i\]\/abilityCooldown\(a\)/);
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
    text: 'Contracts, Gates, quests, events, and hostile threats all grant Hunter XP. Each rank now contains 10 levels; higher ranks demand increasingly greater mastery.',
    action: 'TRACK NEXT CONTRACT',
  });
  assert.equal(gateMilestoneHandoff({ firstClear: { rank: 0 } }, true), null);
  assert.equal(gateMilestoneHandoff({ firstClear: { rank: 1 } }, false), null);
  assert.equal(gateMilestoneHandoff({}, true), null);
  assert.deepEqual(rankPromotionDetails({
    fromRank: 1, rank: 2, gateRank: 2, level: 21, statPoints: 3, nextRankLevel: 31,
  }), {
    rank: 2,
    letter: 'C',
    title: 'C-RANK HUNTER',
    gateAccess: 'C-RANK GATES',
    level: 21,
    statPoints: 3,
    next: 'B-Rank begins at Level 31',
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
  const { DEITY_LEVEL, DEITY_POWER_IDS, DEITY_POWER_DEFS, hunterActivityXpForLevel, hunterRankIndexForLevel, gateRankIndexForLevel, isDeityLevel, nextHunterRankLevel, xpNeedForLevel } = progression;
  assert.deepEqual([1, 11, 21, 31, 41, 51].map(hunterRankIndexForLevel), [0, 1, 2, 3, 4, 5]);
  assert.equal(DEITY_LEVEL, 60);
  assert.equal(DEITY_LEVEL, serverProgression.DEITY_LEVEL);
  assert.deepEqual(DEITY_POWER_IDS, serverProgression.DEITY_POWER_IDS);
  assert.deepEqual(DEITY_POWER_DEFS.map(power => power.id), DEITY_POWER_IDS);
  assert.equal(isDeityLevel(59), false);
  assert.equal(isDeityLevel(60), true);
  assert.equal(isDeityLevel(60), serverProgression.isDeityLevel(60));
  assert.equal(gateRankIndexForLevel(99), 4, 'gate tiers stop at A while Hunter rank reaches S');
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(nextHunterRankLevel), [11, 21, 31, 41, 51, 0]);
  assert.equal(xpNeedForLevel(3), 53);
  assert.ok(xpNeedForLevel(31) > xpNeedForLevel(10) * 10, 'post-E rank requirements rise sharply');
  assert.ok(xpNeedForLevel(51) > xpNeedForLevel(31) * 2);
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

test('stale chat state cannot permanently swallow movement keys',()=>{
  const social=fs.readFileSync(path.join(__dirname,'..','..','client','js','social.mjs'),'utf8');
  assert.match(social,/chatTyping&&!document\.body\.classList\.contains\('chat-open'\)&&chatWheelEl\.classList\.contains\('hidden'\)/);
  assert.match(social,/get chatTyping\(\)\{ return chatInputActive\(\); \}/);
});

test('remote player tags receive team helpers without crashing the frame loop',()=>{
  const companions=fs.readFileSync(path.join(__dirname,'..','..','client','js','companions.mjs'),'utf8');
  const networking=fs.readFileSync(path.join(__dirname,'..','..','client','js','networking.mjs'),'utf8');
  assert.match(companions,/remoteAppearance,\s*teamCol,\s*teamName,/);
  assert.match(networking,/teamCol:\(\.\.\.args\)=>SOCIAL\.teamCol\(\.\.\.args\)/);
  assert.match(networking,/teamName:\(\.\.\.args\)=>SOCIAL\.teamName\(\.\.\.args\)/);
});

test('Recall Cast uses the dedicated P practice hotkey',()=>{
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'..','..','client','index.html'),'utf8');
  const recall=fs.readFileSync(path.join(__dirname,'..','..','client','js','recall.mjs'),'utf8');
  const room=fs.readFileSync(path.join(__dirname,'..','rooms','recall.mixin.js'),'utf8');
  assert.match(combat,/String\(e\.key\|\|''\)\.toLowerCase\(\)==='p'&&!e\.repeat&&gameInput[\s\S]*BlockcraftRecall\.start\(\);\s*return;/);
  assert.doesNotMatch(combat,/e\.code==='KeyI'[\s\S]*BlockcraftRecall\.start\(\)/);
  assert.match(html,/<kbd>P<\/kbd><\/div><b>Recall Cast<\/b>/);
  assert.doesNotMatch(html,/id="recallanswers"/);
  assert.match(recall,/recallStart',\{yaw:player\.yaw,subject:selectedSubject\(\),source:opts&&opts\.source==='lectern'\?'lectern':''\}/);
  assert.doesNotMatch(room,/recallCooldowns|reason:'cooldown'/);
});

test('cursor item follows the mouse without relying on a leaked module global',()=>{
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  assert.match(combat,/const cursorEl=document\.getElementById\('cursoritem'\);/);
  assert.match(combat,/if\(cursorEl\)\{cursorEl\.style\.left=.*cursorEl\.style\.top=/);
});

test('low mana or stamina prompts Recall recharge without interrupting active questions',()=>{
  const frame=fs.readFileSync(path.join(__dirname,'..','..','client','js','frame-loop.mjs'),'utf8');
  assert.match(frame,/function maybePromptRecallRecharge\(now\)/);
  assert.match(frame,/BlockcraftRecall&&globalThis\.BlockcraftRecall\.active/);
  assert.match(frame,/mp\/manaMax<=\.28/);
  assert.match(frame,/sp\/staminaMax<=\.24/);
  assert.match(frame,/nextRecallRechargeHintAt=now\+10000/);
  assert.match(frame,/showName\('LOW '\+what\.toUpperCase\(\)\+' - PRESS P'\)/);
  assert.match(frame,/press <b>P<\/b> for a Recall recharge question/);
  assert.match(frame,/Recall recharge question\.',\s*'minor'\)/);
  assert.match(frame,/maybePromptRecallRecharge\(now\)/);
});

test('Recall Cast restores stamina and level-one town HUD shows the stamina bar',()=>{
  const recall=fs.readFileSync(path.join(__dirname,'..','..','client','js','recall.mjs'),'utf8');
  const room=fs.readFileSync(path.join(__dirname,'..','rooms','recall.mixin.js'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'..','..','client','styles.css'),'utf8');
  assert.match(room,/restoreRecallStamina\(client,prof\)/);
  assert.match(room,/stamina:stamina\.restore,sp:stamina\.sp,maxSp:stamina\.maxSp/);
  assert.match(room,/staminaFraction:RECALL\.RESTORE_FRACTION/);
  assert.match(recall,/Number\.isFinite\(\+m\.stamina\)/);
  assert.match(recall,/Number\.isFinite\(\+m\.sp\)/);
  assert.match(recall,/renderBars\(\);setTimeout\(clearRecall/);
  assert.doesNotMatch(css,/body\.calm-town:not\(\.level-two-hud\) #stats \.mpb,body\.calm-town:not\(\.level-two-hud\) #stats \.hub\{display:none\}/);
  assert.doesNotMatch(css,/body\.calm-town:not\(\.level-two-hud\) #stats \.spb[^{}]*\{display:none\}/);
});

test('basic jumping is not blocked by empty stamina',()=>{
  const frame=fs.readFileSync(path.join(__dirname,'..','..','client','js','frame-loop.mjs'),'utf8');
  assert.match(frame,/if\(canJump\)\{\s*player\.vel\.y=mounted\?9\.4:8\.2;/);
  assert.doesNotMatch(frame,/if\(canJump && \(mounted \|\| sp>=5\)\)/);
  assert.match(frame,/if\(!mounted && sp>0\) sp=Math\.max\(0,sp-stCost\(5\)\*armorStamina\);/);
  assert.match(frame,/if\(sprint\) sp=Math\.max\(0,sp-stCost\(3\.5\)\*armorStamina\*dt\);/);
  assert.doesNotMatch(frame,/sp<maxSp\(\).*stCost/);
});

test('block placement uses Minecraft-style targeted block face at build reach',()=>{
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  const world=fs.readFileSync(path.join(__dirname,'..','..','client','js','world.mjs'),'utf8');
  const frame=fs.readFileSync(path.join(__dirname,'..','..','client','js','frame-loop.mjs'),'utf8');
  assert.match(combat,/const BLOCK_PLACE_REACH=8;/);
  assert.match(combat,/const hit=raycast\(BLOCK_PLACE_REACH\);/);
  assert.match(combat,/const px=hit\.x\+hit\.face\[0\], py=hit\.y\+hit\.face\[1\], pz=hit\.z\+hit\.face\[2\];/);
  assert.match(combat,/function buildPlacementPreview\(\)\{/);
  assert.match(combat,/ITEMS\[s\.id\]\.place===undefined/);
  assert.match(combat,/worldApi\.setBuildGhostPreview\(active\?buildPlacementPreview\(\):null\);/);
  assert.match(combat,/updateBuildPreview,/);
  assert.match(frame,/combatApi\.updateBuildPreview\(!cutscene\);/);
  assert.match(frame,/combatApi\.updateBuildPreview\(false\);/);
  assert.match(world,/const buildGhost = new THREE\.Group\(\);/);
  assert.match(world,/function setBuildGhostPreview\(preview\)\{/);
  assert.match(world,/setBuildGhostPreview,/);
});

test('narrow game HUD consolidates abilities, quest, status, and hotbar without clipping',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','..','client','styles.css'),'utf8');
  assert.match(css,/@media \(max-width:760px\)[\s\S]*#abilities\{left:50%;bottom:124px;transform:translateX\(-50%\)/);
  assert.match(css,/@media \(max-width:760px\)[\s\S]*#currentquest\{top:8px;right:8px;width:min\(270px,58vw\)/);
  assert.match(css,/@media \(max-width:760px\)[\s\S]*#coords\{top:48px;left:8px;right:auto;flex-direction:row/);
  assert.match(css,/#hotbar \.slot\{width:calc\(\(100vw - 54px\)\/9\)/);
});

test('guided overlays suppress optional side HUD panels instead of overlapping them',()=>{
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  const frame=fs.readFileSync(path.join(__dirname,'..','..','client','js','frame-loop.mjs'),'utf8');
  const styles=fs.readFileSync(path.join(__dirname,'..','..','client','styles.css'),'utf8');
  assert.match(combat,/const rightHudStackIds=\['currentquest','activitytracker','townchoices'\]/);
  assert.match(combat,/function layoutRightHudStack\(\)\{/);
  assert.match(combat,/document\.body\.classList\.toggle\('game-modal-open', gameModalOpen\);/);
  assert.match(combat,/function syncHudLayerState\(\)\{/);
  assert.match(combat,/MutationObserver\(syncHudLayerState\)/);
  assert.match(combat,/document\.body\.classList\.toggle\('tutorial-hud-active', tutorialVisible\);/);
  assert.match(combat,/document\.body\.classList\.toggle\('coach-hud-active', coachVisible&&!tutorialVisible&&!gameModalOpen\);/);
  assert.match(combat,/window\.addEventListener\('resize', syncHudLayerState\);/);
  assert.match(styles,/body\.game-modal-open #tutorialhud,body\.game-modal-open #coachhud,body\.game-modal-open #currentquest,body\.game-modal-open #activitytracker,body\.game-modal-open #townchoices,body\.game-modal-open #eventhud,body\.game-modal-open #landmap,body\.game-modal-open #coords,body\.game-modal-open #locationhud,body\.game-modal-open #hotbar,body\.game-modal-open #stats,body\.game-modal-open #abilities,body\.game-modal-open #dragonhud,body\.game-modal-open #familiarhud\{display:none!important\}/);
  assert.match(styles,/body\.claim-mode #tutorialhud,body\.claim-mode #coachhud,body\.claim-mode #currentquest,body\.claim-mode #activitytracker,body\.claim-mode #townchoices,body\.claim-mode #eventhud,body\.claim-mode #landmap\{display:none!important\}/);
  assert.match(combat,/const minimal=onboardingActive&&dim==='tutorial';/);
  assert.match(frame,/if\(onboardingActive&&dim==='tutorial'\)\{/);
  assert.match(styles,/body\.tutorial-hud-active #coachhud,body\.tutorial-hud-active #activitytracker,body\.tutorial-hud-active #townchoices\{display:none!important\}/);
  assert.match(styles,/body\.coach-hud-active #activitytracker,body\.coach-hud-active #townchoices\{display:none!important\}/);
  assert.doesNotMatch(styles,/body\.tutorial-hud-active #coachhud,body\.tutorial-hud-active #currentquest/);
  assert.doesNotMatch(styles,/body\.onboarding[^\{]*#currentquest/);
});

test('level two job chooser presents five profession tutorial cards',()=>{
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  const frame=fs.readFileSync(path.join(__dirname,'..','..','client','js','frame-loop.mjs'),'utf8');
  const menus=fs.readFileSync(path.join(__dirname,'..','..','client','js','menus.mjs'),'utf8');
  const styles=fs.readFileSync(path.join(__dirname,'..','..','client','styles.css'),'utf8');
  assert.match(combat,/const LEVEL2_JOB_CHOICE_KEY='bc_level2_job_choice_seen_v1'/);
  assert.match(combat,/const JOB_TUTORIAL_STEPS=Object\.freeze\(\{/);
  for(const job of ['miner','farmer','cook','blacksmith','monk']) assert.match(combat,new RegExp(`${job}:\\{room:`));
  assert.match(combat,/function shouldOpenLevel2JobChoice\(\)/);
  assert.match(combat,/function openLevel2JobChoice\(force=false\)/);
  assert.match(combat,/WHAT KIND OF HERO DO YOU WANT TO BE\?/);
  assert.match(combat,/ids=\['miner','farmer','cook','blacksmith','monk'\]/);
  assert.match(combat,/chooseJobFromLevel2Banner\(card\.dataset\.job\)/);
  assert.match(combat,/jobTutorialStepId\(jobId\)/);
  assert.match(combat,/Follow the pillar of light to the/);
  assert.match(frame,/combatApi\.shouldOpenLevel2JobChoice/);
  assert.match(frame,/combatApi\.openLevel2JobChoice\(\)/);
  assert.match(menus,/"chooseJob":\{get:\(\)=>chooseJob\}/);
  assert.match(styles,/#pathselect\.jobselect/);
  assert.match(styles,/#jobchoicecards\{display:grid;grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(styles,/\.job-choice-card/);
  assert.match(styles,/\.job-choice-art/);
  assert.match(styles,/#townchoices \.tcrow\.job-choice/);
});

test('status modal presents a styled RPG character sheet instead of browser-default controls',()=>{
  const dimensions=fs.readFileSync(path.join(__dirname,'..','..','client','js','dimensions.mjs'),'utf8');
  const styles=fs.readFileSync(path.join(__dirname,'..','..','client','styles.css'),'utf8');
  assert.match(dimensions,/stat-hero/);
  assert.match(dimensions,/hunterName=escHTML/);
  assert.match(dimensions,/stat-crest/);
  assert.match(dimensions,/stat-grid/);
  assert.match(styles,/#statpanel\{width:min\(820px,calc\(100vw - 36px\)\)/);
  assert.match(styles,/\.stat-hero\{display:grid/);
  assert.match(styles,/\.stat-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles,/#statpanel \.qrow button/);
  assert.match(styles,/@media\(max-width:680px\)[\s\S]*\.stat-grid\{grid-template-columns:1fr\}/);
});

test('death drops render as timed public world loot and onboarding teaches Recall and limbo',()=>{
  const networking=fs.readFileSync(path.join(__dirname,'..','..','client','js','networking.mjs'),'utf8');
  const frame=fs.readFileSync(path.join(__dirname,'..','..','client','js','frame-loop.mjs'),'utf8');
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  assert.match(networking,/function showDeathDropVisual\(m\)[\s\S]*CylinderGeometry\(\.18,\.38,12/);
  assert.match(networking,/PUBLIC LOOT[\s\S]*expiresAt-Date\.now\(\)/);
  assert.match(networking,/deathDropSnapshot[\s\S]*deathDropExpired/);
  assert.match(frame,/BlockcraftDeathDrops\)globalThis\.BlockcraftDeathDrops\.tick\(now\)/);
  assert.match(combat,/kind:'recall'[\s\S]*key:'P'/);
  assert.match(combat,/Lesson 13 \/ 14 - Recall Cast/);
  assert.match(combat,/Death sends carried items to limbo[\s\S]*mistakes become public loot/);
});

test('Left Alt opens subject focus while Escape only closes or releases cursor',()=>{
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  const menus=fs.readFileSync(path.join(__dirname,'..','..','client','js','menus.mjs'),'utf8');
  const recall=fs.readFileSync(path.join(__dirname,'..','..','client','js','recall.mjs'),'utf8');
  assert.match(combat,/if\(e\.code==='AltLeft'&&!e\.repeat&&gameInput&&!uiOpen&&!statOpen&&!uiShellState\.qOpen&&!claimMode&&!globalThis\.BlockcraftRecall\.active\)\{/);
  assert.match(combat,/if\(globalThis\.BlockcraftSubjectFocus\)globalThis\.BlockcraftSubjectFocus\.open\(\);/);
  assert.match(combat,/if\(document\.pointerLockElement===renderer\.domElement\)\{\s*e\.preventDefault\(\);\s*try\{ document\.exitPointerLock\(\); \}catch\(err\)\{\}\s*lockFallback=true;\s*locked=true;\s*refreshPlayUi\(\);\s*return;\s*\}/);
  const escapeCloseBlock=combat.slice(combat.indexOf("if(e.code==='Escape'){\n    let closed=false;"),combat.indexOf("if(locked){",combat.indexOf("if(e.code==='Escape'){\n    let closed=false;")));
  assert.match(escapeCloseBlock,/if\(uiOpen\)\{ closeUI\(\); closed=true; \}/);
  assert.match(escapeCloseBlock,/if\(statOpen\)\{ closeStat\(\); closed=true; \}/);
  assert.match(escapeCloseBlock,/if\(uiShellState\.qOpen\)\{ closeQWin\(\); closed=true; \}/);
  assert.doesNotMatch(escapeCloseBlock,/closeUI\(false\)|closeStat\(false\)|closeQWin\(false\)/);
  assert.doesNotMatch(combat,/overlay\.classList\.contains\('hidden'\)&&!limboOpen&&!globalThis\.BlockcraftRecall\.active/);
  assert.match(menus,/BlockcraftSubjectFocus[\s\S]*open:openSubjectFocusUI/);
  for(const subject of ['Computer Science','Information Technology','Religious Education','English'])assert.match(menus,new RegExp(subject));
  assert.match(recall,/recallStart',\{yaw:player\.yaw,subject:selectedSubject\(\),source:opts&&opts\.source==='lectern'\?'lectern':''\}/);
});

test('quest log hotkey works while gameplay overlay is hidden even without pointer lock',()=>{
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  const menus=fs.readFileSync(path.join(__dirname,'..','..','client','js','menus.mjs'),'utf8');
  assert.match(combat,/function gameplayInputActive\(\)\{\s*return locked\|\|overlay\.classList\.contains\('hidden'\);\s*\}/);
  assert.match(combat,/if\(e\.code==='KeyO' && !e\.repeat && !pathChoiceOpen && !jobChoiceOpen && !claimMode && !uiOpen && !statOpen && gameplayInputActive\(\)\)\{/);
  assert.match(combat,/else if\(!uiShellState\.qOpen\) openQuestLogUI\(\);/);
  assert.match(combat,/if\(e\.code==='KeyO'[\s\S]*return;\s*\}\s*if\(globalThis\.chatTyping\) return;/);
  assert.doesNotMatch(combat,/else if\(locked && !uiOpen && !statOpen\) openQuestLogUI\(\);/);
  assert.match(menus,/openQuestLog:openQuestLogUI/);
});

test('objective tracker buttons open actions on pointerdown above the HUD layer',()=>{
  const frame=fs.readFileSync(path.join(__dirname,'..','..','client','js','frame-loop.mjs'),'utf8');
  const styles=fs.readFileSync(path.join(__dirname,'..','..','client','styles.css'),'utf8');
  assert.match(frame,/const triggerObjectiveAction=e=>\{/);
  assert.match(frame,/e\.stopPropagation\(\);/);
  assert.match(frame,/currentQuestEl\.addEventListener\('pointerdown',triggerObjectiveAction,\{capture:true\}\);/);
  assert.match(frame,/currentQuestEl\.addEventListener\('click',triggerObjectiveAction\);/);
  assert.match(styles,/#currentquest\{position:fixed;right:14px;top:282px;[\s\S]*pointer-events:auto/);
  assert.match(styles,/#qwin\{position:fixed;inset:0;[\s\S]*z-index:32/);
});

test('land claim hotkey stays open after pointer lock exits and Escape closes it first',()=>{
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  const world=fs.readFileSync(path.join(__dirname,'..','..','client','js','world.mjs'),'utf8');
  assert.match(combat,/if\(e\.code==='KeyL' && !e\.repeat && !uiOpen && !statOpen && !uiShellState\.qOpen && \(gameInput \|\| claimMode\)\)\{/);
  assert.match(combat,/toggleClaimMode\(claimMode\?false:true\);/);
  assert.match(combat,/if\(claimMode\)\{ toggleClaimMode\(false\); closed=true; \}/);
  assert.doesNotMatch(combat,/else if\(claimMode && e\.code==='KeyL'/);
  assert.match(combat,/document\.body\.classList\.toggle\('claim-mode', !!claimMode\);/);
  assert.match(world,/document\.body\.classList\.toggle\('claim-mode', claimMode\);/);
});

test('menu-style gameplay hotkeys are not tied directly to pointer lock',()=>{
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  assert.match(combat,/const gameInput=gameplayInputActive\(\);/);
  assert.match(combat,/if\(e\.code==='KeyC'\)\{\s*if\(statOpen\) closeStat\(\);\s*else if\(gameInput\) openStat\(\);/);
  assert.match(combat,/if\(gameInput&&!uiOpen&&!statOpen&&!uiShellState\.qOpen\)\{/);
  for(const call of ['openTeamUI','openDragonBondUI','toggleMount','cycleDragon','cycleFamiliar']){
    assert.match(combat,new RegExp(call+'\\(\\); return;'));
  }
  assert.match(combat,/toggleClaimMode\(claimMode\?false:true\);/);
  assert.doesNotMatch(combat,/if\(e\.code==='KeyT'\) openTeamUI\(\);/);
  assert.doesNotMatch(combat,/if\(e\.code==='KeyB' && !e\.repeat\) openDragonBondUI\(\);/);
});

test('ordinary combat exposes health, telegraphs, statuses, impact pause, and death motion',()=>{
  const visuals=fs.readFileSync(path.join(__dirname,'..','..','client','js','replication-visuals.mjs'),'utf8');
  const feedback=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat-feedback.mjs'),'utf8');
  const styles=fs.readFileSync(path.join(__dirname,'..','..','client','styles.css'),'utf8');
  assert.match(visuals,/if\(!name\)name=ref\.kind==='boss'/,'generic enemies receive readable names instead of special encounters only');
  assert.match(visuals,/textSprite\('STUNNED'/);
  assert.match(visuals,/textSprite\('FROZEN'/);
  assert.match(visuals,/bossMeleeWind/);
  assert.match(visuals,/slamWarn/);
  assert.match(visuals,/meleeWarn/);
  assert.match(visuals,/rangedWarn/);
  assert.match(visuals,/volleyWarn/);
  assert.match(visuals,/const deathTick=setInterval/);
  assert.match(feedback,/SLAM - LEAVE THE CIRCLE/);
  assert.match(feedback,/DODGE OUT/);
  assert.match(feedback,/ARROW DRAW - SIDESTEP/);
  assert.match(feedback,/VOLLEY - LEAVE THE LANES/);
  assert.match(feedback,/sound\.crit/);
  assert.match(feedback,/sound\.block/);
  assert.match(styles,/#deathrecap/);
  assert.match(styles,/body\.combat-hit #game canvas/);
});

test('first ten minute guidance teaches subject focus and explicit quest acceptance',()=>{
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  const menus=fs.readFileSync(path.join(__dirname,'..','..','client','js','menus.mjs'),'utf8');
  const styles=fs.readFileSync(path.join(__dirname,'..','..','client','styles.css'),'utf8');
  const frame=fs.readFileSync(path.join(__dirname,'..','..','client','js','frame-loop.mjs'),'utf8');
  const world=fs.readFileSync(path.join(__dirname,'..','..','client','js','world.mjs'),'utf8');
  assert.match(combat,/Lesson 12 \/ 14 - Subject Focus/);
  assert.match(combat,/key:'LEFT ALT'/);
  assert.match(combat,/Press Left Alt and choose your Recall subject/);
  assert.match(menus,/BlockcraftOnboarding\)globalThis\.BlockcraftOnboarding\.markSubjectFocus\(\)/);
  assert.match(combat,/Town Step 1 - Accept First Quest/);
  assert.match(combat,/Nothing gives XP until you explicitly accept it/);
  assert.match(frame,/Accept Mara’s first quest/);
  assert.match(world,/function npcQuestMarkerState\(v\)/);
  assert.match(world,/function npcQuestMarkerVisual\(state\)/);
  assert.match(world,/source==='manhunt'\?'MANHUNT'/);
  assert.match(world,/source==='job'\?'JOB'/);
  assert.match(world,/source==='guild'\?'GUILD'/);
  assert.match(world,/source==='aegis'\?'AEGIS'/);
  assert.match(world,/return 'offer:story'/);
  assert.match(world,/return 'offer:manhunt'/);
  assert.match(world,/return 'offer:aegis'/);
  assert.match(world,/function townQuestMarkerState\(sp\)/);
  assert.match(world,/addTownQuestMarker\('jobs'/);
  assert.match(world,/addTownQuestMarker\('guild_contracts'/);
  assert.match(world,/addTownQuestMarker\('claim_aegis'/);
  assert.match(world,/serviceObjectiveFor\(type/);
  assert.match(world,/function activeServerObjectiveForGuidance\(\)/);
  assert.match(world,/function serverObjectiveGuidanceTarget\(o\)/);
  assert.match(world,/function playerStyleGuidanceTargetInfo\(\)/);
  assert.match(world,/playerStyleGuidanceTargetInfo\(\);\s*if\(styleTarget\)return styleTarget;/);
  assert.match(world,/title\.includes\('road ready'\)/);
  assert.match(world,/color=toMara\?0x9ad26b:0x7dd3fc/);
  assert.match(combat,/Walk into the pillar of light/);
  assert.match(combat,/FIND LIGHT/);
  assert.match(combat,/Follow the pillar of light to the Job Board/);
  assert.match(menus,/function openNpcDialogueShell\(v,context=''\)/);
  assert.match(menus,/npc-dialogue-shell/);
  assert.match(menus,/npc-dialogue-portrait/);
  assert.match(menus,/npcDialogueButton\('ACCEPT'/);
  assert.match(menus,/function openSocialMentorUI/);
  assert.match(menus,/openQWin\('dialog'\);\s*qpanelEl\.innerHTML='';\s*const ui=openNpcDialogueShell\(v, 'FELLOWSHIP MENTOR/);
  assert.match(styles,/#qpanel\.dialog\{width:min\(720px/);
  assert.match(styles,/\.npc-dialogue-head/);
  assert.match(styles,/\.npc-dialogue-text/);
  assert.match(styles,/\.npc-dialogue-actions \.qbtn\.npc-primary/);
  assert.match(world,/const guideBeaconGroup=new THREE\.Group/);
  assert.match(world,/new THREE\.CylinderGeometry\(\.44,\.82,13\.5,18,1,true\)/);
  assert.match(world,/const guideBeaconRing=new THREE\.Mesh\(new THREE\.TorusGeometry/);
  assert.match(world,/guideBeaconBeam\.renderOrder=28/);
  assert.match(world,/surfaceY\(info\.target\.x,info\.target\.z\)\+\.04/);
  assert.doesNotMatch(world,/const guideBeacon=new THREE\.Sprite/);
  assert.doesNotMatch(combat,/glowing pillar|follow the glow|FOLLOW LIGHT/);
});

test('server profile tutorial state overrides stale browser onboarding flags',()=>{
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  assert.match(combat,/function onboardingDone\(\)\{\s*if\(NET\.on\) return serverTutorials\.onboarding>=7;/);
  assert.match(combat,/function meadowTutorialDone\(\)\{\s*if\(NET\.on\) return false;/);
});

test('Mara opening quest is presented as the deliberate story start',()=>{
  const menus=fs.readFileSync(path.join(__dirname,'..','..','client','js','menus.mjs'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'..','..','client','styles.css'),'utf8');
  const world=fs.readFileSync(path.join(__dirname,'..','..','client','js','world.mjs'),'utf8');
  assert.match(menus,/function isMaraOpeningOffer\(v,offer\)/);
  assert.match(menus,/STORY START/);
  assert.match(menus,/Accepting starts your story tracker/);
  assert.match(menus,/Quest rewards are never passive/);
  assert.match(css,/\.mara-start/);
  assert.match(css,/\.mara-steps/);
  assert.match(world,/The first job is not glamorous/);
});

test('First Hands guides the player through the first real objective',()=>{
  const frame=fs.readFileSync(path.join(__dirname,'..','..','client','js','frame-loop.mjs'),'utf8');
  const world=fs.readFileSync(path.join(__dirname,'..','..','client','js','world.mjs'),'utf8');
  const menus=fs.readFileSync(path.join(__dirname,'..','..','client','js','menus.mjs'),'utf8');
  const networking=fs.readFileSync(path.join(__dirname,'..','..','client','js','networking.mjs'),'utf8');
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  assert.match(frame,/First Hands leave town, gather logs/);
  assert.match(frame,/Leave through the north gate and gather logs/);
  assert.match(frame,/town trees are protected[\s\S]*outside the wall/);
  assert.match(world,/function firstHandsLoggingTarget\(\)/);
  assert.match(world,/mara-first-hands/);
  assert.match(world,/HUB\.northGate\.z\+1\.2/);
  assert.match(menus,/Quest accepted: First Hands[\s\S]*north gate/);
  assert.match(menus,/First Hands complete[\s\S]*gold trail back/);
  assert.match(networking,/Quest accepted: First Hands[\s\S]*north gate/);
  assert.match(combat,/"clearTownGuidance":\{get:\(\)=>clearTownGuidance\}/);
  assert.match(networking,/if\(townGuidanceActive&&townGuidanceStep==='quest'\) clearTownGuidance\(\);/);
});

test('onboarding teaches Escape cursor release after jumping and shows a large arrow-turn counter',()=>{
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  const styles=fs.readFileSync(path.join(__dirname,'..','..','client','styles.css'),'utf8');
  assert.match(combat,/jumped:false,cursor:false,tree:false/);
  assert.match(combat,/kind:'jump'[\s\S]*kind:'cursor'[\s\S]*kind:'tree'/);
  assert.match(combat,/Lesson 5 \/ 14 - Cursor/);
  assert.match(combat,/key:'ESCAPE'/);
  assert.match(combat,/Press Escape to free the cursor/);
  assert.match(combat,/onboardingActive&&onboardingArrived&&onboardingKind\(\)==='cursor'[\s\S]*onboardingFlags\.cursor=true/);
  assert.match(combat,/ONBOARDING_STEPS\.splice\(11,0/);
  assert.match(combat,/tutprogress/);
  assert.match(styles,/#tutorialhud \.tutprogress b\{font-size:42px/);
});

test('onboarding teaches Shift sprinting after basic movement',()=>{
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  const frame=fs.readFileSync(path.join(__dirname,'..','..','client','js','frame-loop.mjs'),'utf8');
  assert.match(combat,/sprint:false,arrowLook:false/);
  assert.match(combat,/kind:'move'[\s\S]*kind:'sprint'[\s\S]*kind:'arrows'/);
  assert.match(combat,/Lesson 2 \/ 14 - Sprinting/);
  assert.match(combat,/key:'SHIFT \+ W'/);
  assert.match(combat,/Hold Shift while moving to run into the next light\./);
  assert.match(combat,/Running uses stamina\. Answer Recall questions later to recharge it\./);
  assert.match(combat,/done:\(\)=>onboardingArrived&&onboardingFlags\.sprint/);
  assert.match(frame,/onboardingActive&&onboardingArrived&&onboardingKind\(\)==='sprint'&&sprint/);
  assert.match(frame,/onboardingFlags\.sprint=true;/);
});

test('onboarding gathering pillar and completion both use the training tree',()=>{
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  const world=fs.readFileSync(path.join(__dirname,'..','..','client','js','world.mjs'),'utf8');
  assert.match(combat,/const tree=onboardingTreeTarget\(TRAINING_MEADOW\);[\s\S]*tree,[\s\S]*\{x:sx\+30, z:sz-12\}/);
  assert.match(combat,/isOnboardingTreeLog\(m\.x,m\.y,m\.z,TRAINING_MEADOW\)/);
  assert.match(world,/"onboardingTreeTarget":\{get:\(\)=>onboardingTreeTarget\}/);
  assert.match(world,/"isOnboardingTreeLog":\{get:\(\)=>isOnboardingTreeLog\}/);
});

test('onboarding farming uses the G action inside the tutorial meadow',()=>{
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  const world=fs.readFileSync(path.join(__dirname,'..','..','client','js','world.mjs'),'utf8');
  assert.match(combat,/const tutorialMeadowFarm=onboardingActive&&dim==='tutorial'&&isTrainingMeadowLand\(hit\.x,hit\.z,2\);/);
  assert.match(combat,/if\(dim!=='overworld'&&!tutorialMeadowFarm\) return false;/);
  assert.match(combat,/const townFarmWorksite=!tutorialMeadowFarm&&dim==='overworld'&&isTownFarmWorksite\(hit\.x,hit\.z\);/);
  assert.match(combat,/if\(!tutorialMeadowFarm&&!townFarmWorksite&&!canBuildHere\(hit\.x,hit\.z\)\)/);
  assert.match(world,/function isTownFarmWorksite\(x,z\)/);
  assert.match(world,/"isTownFarmWorksite":\{get:\(\)=>isTownFarmWorksite\}/);
  assert.match(combat,/if\(onboardingActive&&tutorialMeadowFarm&&onboardingKind\(\)==='farm'\) onboardingFlags\.farmed=true;/);
});

test('onboarding combat dummy can be hit inside the tutorial meadow',()=>{
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  assert.match(combat,/function tryHitTutorialDummy\(\)\{/);
  assert.match(combat,/onboardingKind\(\)!=='combat'\|\|dim!=='tutorial'/);
  assert.match(combat,/done:\(\)=>onboardingFlags\.dummy>=3/);
  assert.match(combat,/onboardingFlags\.dummy=Math\.min\(3,\(onboardingFlags\.dummy\|0\)\+1\);/);
  assert.match(combat,/if\(broken\) tutorialDummyGroup\.visible=false;/);
});

test('onboarding build lesson completes after three placed planks without an extra pillar gate',()=>{
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  assert.match(combat,/Place three plank blocks on the stone pad\.[\s\S]*done:\(\)=>onboardingFlags\.built>=3/);
  assert.doesNotMatch(combat,/done:\(\)=>onboardingArrived&&onboardingFlags\.built>=3/);
  assert.match(combat,/if\(onboardingKind\(\)==='build'\) onboardingFlags\.built=countOnboardingBuildBlocks\(TRAINING_MEADOW,getB,B\.PLANKS\);/);
});

test('onboarding recall lesson completes from a correct answer away from the waypoint',()=>{
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  const recall=fs.readFileSync(path.join(__dirname,'..','..','client','js','recall.mjs'),'utf8');
  assert.match(combat,/markRecall:\(\)=>\{if\(onboardingActive&&onboardingKind\(\)==='recall'\)onboardingFlags\.recall=true;\}/);
  assert.match(combat,/Press P and answer one knowledge challenge\.[\s\S]*done:\(\)=>onboardingFlags\.recall/);
  assert.doesNotMatch(combat,/done:\(\)=>onboardingArrived&&onboardingFlags\.recall/);
  assert.match(recall,/if\(m\.correct&&globalThis\.BlockcraftOnboarding\)globalThis\.BlockcraftOnboarding\.markRecall\(\);/);
});

test('onboarding material safety grants count cursor-held stacks before adding replacements',()=>{
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  assert.match(combat,/function countHeldCursorItem\(id\)\{/);
  assert.match(combat,/countItem\(B\.LOG\)\+countCraftCellItem\(B\.LOG\)\+countHeldCursorItem\(B\.LOG\)<=0/);
  assert.match(combat,/countItem\(B\.PLANKS\)\+countHeldCursorItem\(B\.PLANKS\)<=0/);
  assert.match(combat,/const onboardingHeldPlanks=countItem\(B\.PLANKS\)\+countHeldCursorItem\(B\.PLANKS\);/);
});

test('onboarding eat step recovers bread consumed before the lesson accepts it',()=>{
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  assert.match(combat,/if\(countItem\(I\.BREAD\)\+countHeldCursorItem\(I\.BREAD\)<=0\) ensureOnboardingItem\(I\.BREAD,1\);/);
  assert.match(combat,/if\(onboardingKind\(\)==='eat'&&!onboardingFlags\.ate\)\{/);
  assert.match(combat,/selectItemForOnboarding\(I\.BREAD\);[\s\S]*makeOnboardingPlayerHungry\(\);/);
});

test('onboarding farming prompt tells players to use the wooden hoe',()=>{
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  assert.match(combat,/key:'WOODEN HOE \+ G'/);
  assert.match(combat,/Use the wooden hoe on one mature wheat crop\./);
  assert.match(combat,/Select the hoe on your hotbar/);
});

test('online craft result restores the authoritative inventory snapshot',()=>{
  const menus=fs.readFileSync(path.join(__dirname,'..','..','client','js','menus.mjs'),'utf8');
  assert.match(menus,/function restoreInventorySnapshot\(slots\)\{/);
  assert.match(menus,/if\(!restoreInventorySnapshot\(m\.inv\)\) addCraftedItem\(m\.out\.id, made\);/);
});

test('quick chat uses Tab then click to send instead of hold and release',()=>{
  const social=fs.readFileSync(path.join(__dirname,'..','..','client','js','social.mjs'),'utf8');
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'..','..','client','index.html'),'utf8');
  assert.match(html,/Click a phrase to send/);
  assert.match(html,/Teams, quick comms, and closing open panels\./);
  assert.match(html,/aria-label="Quick comms phrase"/);
  assert.doesNotMatch(html,/chat commands/);
  assert.match(social,/Nearby quick phrase/);
  assert.match(social,/Party quick phrase/);
  assert.match(social,/Whisper quick phrase/);
  assert.match(social,/USE PARTY QUICK PHRASES TO COORDINATE/);
  assert.doesNotMatch(social,/Message nearby hunters|Message your party|Whisper privately|\/t TO TALK TO YOUR TEAM/);
  assert.match(social,/function openChat\(mode\)\{[\s\S]*if\(document\.pointerLockElement\)document\.exitPointerLock\(\);lockFallback=false;locked=false;/);
  assert.match(social,/for\(const eventName of \['pointerdown','mousedown','click','wheel'\]\)\{[\s\S]*chatBarEl\.addEventListener\(eventName,event=>event\.stopPropagation\(\)\);/);
  assert.match(social,/chatInEl\.addEventListener\('change',\(\)=>\{[\s\S]*sendQuickPhrase\(chatInEl\.value\);\s*closeChat\(true\);/);
  assert.match(combat,/addEventListener\('mousedown', e=>\{\s*if\(globalThis\.chatTyping\) return;/);
  assert.match(combat,/function isWorldPointerTarget\(target\)\{\s*return target===renderer\.domElement\|\|target===document\.body\|\|target===document\.documentElement;\s*\}/);
  assert.match(combat,/addEventListener\('mousedown', e=>\{\s*if\(globalThis\.chatTyping\) return;\s*if\(!isWorldPointerTarget\(e\.target\)\) return;/);
  assert.match(combat,/addEventListener\('wheel', e=>\{ if\(locked&&isWorldPointerTarget\(e\.target\)\) selectSlot/);
  assert.match(social,/createElement\('button'\)[\s\S]*addEventListener\('click',\(\)=>\{sendQuickPhrase\(id\);closeQuickChatWheel\(true\);\}\)/);
  assert.match(social,/if\(e\.code==='Enter'\)\{\s*e\.preventDefault\(\);\s*sendQuickPhrase\(chatInEl\.value\);\s*closeChat\(true\);\s*return;\s*\}/);
  assert.match(social,/cycleChatMode\(\);\s*renderQuickChatWheel\(\);/);
  assert.doesNotMatch(social,/event\.code==='Tab'&&chatWheel\)[\s\S]*startDragonCommandWheel\(\)/);
  assert.doesNotMatch(social,/const text=chatInEl\.value\.trim\(\);/);
  assert.doesNotMatch(social,/unknown command/);
  assert.match(combat,/e\.shiftKey && typeof startDragonCommandWheel==='function'/);
  assert.doesNotMatch(combat,/lastTabWheelAt/);
  assert.doesNotMatch(social,/held<220|movementX|movementY|Release Tab/);
});

test('social mentor NPC teaches friends chat teams and safety without creating a quest',()=>{
  const world=fs.readFileSync(path.join(__dirname,'..','..','client','js','world.mjs'),'utf8');
  const menus=fs.readFileSync(path.join(__dirname,'..','..','client','js','menus.mjs'),'utf8');
  assert.match(world,/socialMentor:\s*\{ x: dpx\(43\.5, 'guild'\), z: dpz\(34, 'guild'\) \}/);
  assert.match(world,/name:'Nia Brightbell'[\s\S]*role:'social_mentor'[\s\S]*title:'Fellowship Mentor'/);
  assert.match(world,/Tab opens quick chat, T opens teams/);
  assert.match(world,/Social Mentor - Tab Chat/);
  assert.match(menus,/function openSocialMentorUI/);
  assert.match(menus,/TAB QUICK CHAT/);
  assert.match(menus,/Local, Party, and Whisper/);
  assert.match(menus,/Friendly play means clear invites/);
  assert.match(menus,/globalThis\.startQuickChatWheel/);
  assert.match(menus,/globalThis\.openTeamUI/);
  assert.match(menus,/if\(v&&v\.role==='social_mentor'\)\{ openSocialMentorUI\(v\); return; \}/);
});

test('local quick chat remains visible in a Minecraft-style bottom-left feed',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','..','client','styles.css'),'utf8');
  const networking=fs.readFileSync(path.join(__dirname,'..','..','client','js','networking.mjs'),'utf8');
  assert.doesNotMatch(css,/body\.calm-town #chatlog/);
  assert.match(css,/#chatlog\{position:fixed;left:10px;bottom:82px[\s\S]*align-items:flex-start/);
  assert.match(css,/\.chatline\{[\s\S]*background:rgba\(0,0,0,\.48\)[\s\S]*'Courier New'/);
  assert.match(networking,/room\.onMessage\('comms',[\s\S]*chatLine\(label\+[\s\S]*m\.mode\|\|'local'/);
});

test('road safety scenes use physical signs instead of floating text sprites',()=>{
  const world=fs.readFileSync(path.join(__dirname,'..','..','client','js','world.mjs'),'utf8');
  assert.match(world,/const roadSign=\(g,text,col/);
  assert.match(world,/roadSign\(g,'ROAD PATROL'/);
  assert.match(world,/HUB\.northGate\.z\+6\.5,dx:0,dz:1,index:0,fixed:true/);
  assert.match(world,/back\.rotation\.y=Math\.PI/);
  assert.match(world,/signTexture\(text,col,true\)/);
  assert.match(world,/topY\+\.18/);
  assert.match(world,/function roadSafetyAnchorAt\(x,z,dx,dz,index\)/);
  assert.match(world,/if\(isTownLand\(x,z\)\)return null/);
  assert.match(world,/Math\.abs\(sy-y\)>\.75/);
  assert.match(world,/const roadNpc=\(g,x,z,robe,robeDark,hat,profile=\{\}\)=>/);
  assert.match(world,/const actor=makeVillager\(robe,robeDark,hat,profile\),person=actor\.grp/);
  assert.match(world,/roadNpc\(g,-1\.15,1\.2,'#486c86','#2e4558',true/);
  assert.match(world,/roadSafetyActors\.push/);
  assert.match(world,/function tickRoadSafetyScenes\(dt,t\)/);
  assert.match(world,/road-guard-spear/);
  assert.match(world,/guard:true/);
  assert.doesNotMatch(world,/side:THREE\.DoubleSide,transparent:true/);
  assert.doesNotMatch(world,/label\(g,'ROAD PATROL'/);
  assert.doesNotMatch(world,/const traveller=/);
});

test('frame loop animates road patrol guards every tick',()=>{
  const frame=fs.readFileSync(path.join(__dirname,'..','..','client','js','frame-loop.mjs'),'utf8');
  const world=fs.readFileSync(path.join(__dirname,'..','..','client','js','world.mjs'),'utf8');
  assert.match(world,/tickRoadSafetyScenes,/);
  assert.match(frame,/worldApi\.tickRoadSafetyScenes\(dt, now\/1000\)/);
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

test('the regional side tracker requires a contract except public gate breach states and active Trail Sense reveals',()=>{
  const frame=fs.readFileSync(path.join(__dirname,'..','..','client','js','frame-loop.mjs'),'utf8');
  assert.match(frame,/acceptedRegionalContract=clampRegionalContract\(regionalContract\)/);
  assert.match(frame,/const trail=a\.trailSense&&\(!a\.trailSense\.expiresAt\|\|a\.trailSense\.expiresAt>Date\.now\(\)\)\?a\.trailSense:null;/);
  assert.match(frame,/if\(!acceptedRegionalContract&&!a\.gateBreach&&!a\.gateScar&&!trail\)\{displayedRegionalOpportunity=null;activityTrackerEl\.classList\.add\('hidden'\);return;\}/);
  assert.match(frame,/PUBLIC CLEANUP/);
  assert.match(frame,/BREACH AFTERMATH/);
  assert.match(frame,/TRAIL SENSE/);
});

test('cartographer utilities split Mini Map local awareness from World Map planning',()=>{
  const world=fs.readFileSync(path.join(__dirname,'..','..','client','js','world.mjs'),'utf8');
  assert.match(world,/miniMap = utilityEquipped\('minimap'\), worldMap = utilityEquipped\('world_map'\)/);
  assert.match(world,/MINI MAP/);
  assert.match(world,/function updateLandMinimap/);
  assert.match(world,/const drawDangerRings=/);
  assert.match(world,/const cartographerMapTarget=/);
  assert.match(world,/weatherMapReq=\{rain_bloom:'rain',storm_crystal:'storm',sun_dial:'clear'\}/);
  assert.match(world,/regionalContract&&regionalContract\.targetId/);
  assert.match(world,/BlockcraftTreasureMap/);
  assert.match(world,/miniMap&&!worldMap&&!nearPlayer/);
});

test('discovery journal explains weather-site harvest state clearly',()=>{
  const menus=fs.readFileSync(path.join(__dirname,'..','..','client','js','menus.mjs'),'utf8');
  assert.match(menus,/function weatherCodexState\(entry,found\)/);
  assert.match(menus,/CURRENT SKY/);
  assert.match(menus,/ACTIVE NOW - GO HARVEST/);
  assert.match(menus,/SPOTTED - WAITING FOR/);
  assert.match(menus,/UNSEEN - NEED/);
  assert.match(menus,/function weatherEntryStatus\(e\)/);
  assert.match(menus,/SPOTTED - ACTIVE NOW/);
  assert.match(menus,/SPOTTED - RETURN IN/);
});

test('fellowship hall exposes renown and project completion controls',()=>{
  const menus=fs.readFileSync(path.join(__dirname,'..','..','client','js','menus.mjs'),'utf8');
  const networking=fs.readFileSync(path.join(__dirname,'..','..','client','js','networking.mjs'),'utf8');
  const world=fs.readFileSync(path.join(__dirname,'..','..','client','js','world.mjs'),'utf8');
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  const frame=fs.readFileSync(path.join(__dirname,'..','..','client','js','frame-loop.mjs'),'utf8');
  assert.match(menus,/function requestGuildProject\(id\)/);
  assert.match(menus,/function requestGuildWeeklyReward\(id\)/);
  assert.match(menus,/function focusGuildHallSection\(section\)/);
  assert.match(menus,/fellowship-weekly-rewards/);
  assert.match(menus,/openGuildHallUI\(focus=''\)/);
  assert.match(menus,/function requestGuildNoticePin\(id\)/);
  assert.match(menus,/function openRecallLecternUI\(\)/);
  assert.match(menus,/FELLOWSHIP STUDY LECTERN/);
  assert.match(menus,/START LECTERN RECALL/);
  assert.match(menus,/BlockcraftRecall\.start\(\{source:'lectern'\}\)/);
  assert.match(menus,/FELLOWSHIP PROJECTS/);
  assert.match(menus,/FELLOWSHIP_STATION_OVERVIEW/);
  assert.match(menus,/FELLOWSHIP_RENOWN_SOURCES/);
  assert.match(menus,/function appendFellowshipOverview\(mine,canModerate\)/);
  assert.match(menus,/function appendFellowshipRenownSources\(mine\)/);
  assert.match(menus,/function appendFellowshipWeeklyRewards\(mine\)/);
  assert.match(menus,/FELLOWSHIP OVERVIEW/);
  assert.match(menus,/WEEKLY FELLOWSHIP REWARDS/);
  assert.match(menus,/Weekly rewards are <b>per member<\/b>/);
  assert.match(menus,/BEST RENOWN SOURCES/);
  assert.match(menus,/Guild and Road Warden contracts/);
  assert.match(menus,/Map Table treasure route/);
  assert.match(menus,/Weather Vane harvest/);
  assert.match(menus,/Study Lectern/);
  assert.match(menus,/Map Table/);
  assert.match(menus,/Armory Rack/);
  assert.match(menus,/Pantry Shelf/);
  assert.match(menus,/Weather Vane/);
  assert.match(menus,/FUND NEXT:/);
  assert.match(menus,/FELLOWSHIP NOTICE BOARD/);
  assert.match(menus,/Fellowship Renown/);
  assert.match(menus,/Active guild work/);
  assert.match(menus,/requestGuildProject\(project\.id\)/);
  assert.match(menus,/requestGuildWeeklyReward\(r\.id\)/);
  assert.match(menus,/requestGuildNoticePin\(o\.id\)/);
  assert.match(networking,/projectCatalog:Array\.isArray/);
  assert.match(networking,/noticeObjectiveCatalog:Array\.isArray/);
  assert.match(networking,/function applyGuildRenownToast\(m\)/);
  assert.match(networking,/rewardGain\('renown',amount,'Renown'/);
  assert.match(networking,/fellowship-renown-progress/);
  assert.match(networking,/pulseFellowshipRenownSource\(reason,amount\)/);
  assert.match(networking,/This week:/);
  const styles=fs.readFileSync(path.join(__dirname,'..','..','client','styles.css'),'utf8');
  assert.match(styles,/rewardgain\.renown/);
  assert.match(styles,/fellowship-renown-progress/);
  assert.match(networking,/FELLOWSHIP_TUTORIAL_KEY='bc_fellowship_tutorial_seen_v1'/);
  assert.match(networking,/function showFellowshipTutorial\(m=\{\},mode='joined'\)/);
  assert.match(networking,/FELLOWSHIP UNLOCKED/);
  assert.match(networking,/SHARED UPGRADE CURRENCY/);
  assert.match(networking,/OPEN FELLOWSHIP HALL/);
  assert.match(networking,/showFellowshipTutorial\(m,'created'\)/);
  assert.match(networking,/showFellowshipTutorial\(m,'joined'\)/);
  assert.match(networking,/room\.onMessage\('guildRenown'/);
  assert.match(networking,/room\.onMessage\('guildWeeklyRewardResult'/);
  assert.match(menus,/guildWeeklyRewardClaim/);
  assert.match(networking,/WEEKLY CACHE CLAIMED/);
  assert.match(networking,/reward_locked/);
  assert.match(networking,/reward_claimed/);
  assert.match(networking,/room\.onMessage\('guildProjectResult'/);
  assert.match(networking,/noticePin/);
  assert.match(world,/makeFellowshipNoticeBoardDecor/);
  assert.match(world,/Notice Board · G/);
  assert.match(world,/pinnedFellowshipNoticeText/);
  assert.match(world,/function fellowshipClaimableWeeklyRewards\(\)/);
  assert.match(world,/function makeFellowshipWeeklyCacheProp\(\)/);
  assert.match(world,/Weekly Cache Ready/);
  assert.match(world,/kind:'fellowship_weekly_cache'/);
  assert.match(world,/function tickFellowshipWeeklyCacheProp\(dt,t\)/);
  assert.match(world,/function updateFellowshipProjectProps\(\)/);
  assert.match(world,/function makeFellowshipProjectProp\(id\)/);
  assert.match(world,/function makeFellowshipStationHubDecor\(ids,placements\)/);
  assert.match(world,/function tickFellowshipProjectProps\(dt,t\)/);
  assert.match(world,/FELLOWSHIP_STATION_POLISH/);
  assert.match(world,/Fellowship Stations/);
  assert.match(world,/LEARN · PLAN · PREP · SUSTAIN · SKY/);
  assert.match(world,/kind:'fellowship_station_hub'/);
  assert.match(world,/function pulseRecallLecternRenown\(amount=1\)/);
  assert.match(world,/globalThis\.BlockcraftFellowshipEffects=\{pulseRecallLecternRenown,pulseMapTablePlanning,pulseArmoryRack,pulsePantryShelf,pulseWeatherVane\}/);
  assert.match(world,/kind:'recall_lectern',glow,light,lowerRune,upperRune,leftPage,rightPage,sparks/);
  assert.match(world,/kind:'map_table',glow,pathLine,pins/);
  assert.match(world,/kind:'armory_rack',glow,readyRing,light/);
  assert.match(world,/kind:'pantry_shelf',glow,readyRing,jars,light/);
  assert.match(world,/kind:'weather_vane',glow,skyRing,light,crossA,crossB,arrow/);
  assert.match(world,/RENOWN \+'\+Math\.max\(1,amount\|0\)/);
  assert.match(world,/function pulseMapTablePlanning\(label='MAP PLANNED'\)/);
  assert.match(world,/function pulseArmoryRack\(label='GEAR CHECKED',ready=false\)/);
  assert.match(world,/function pulsePantryShelf\(label='RATIONS CHECKED',ready=false\)/);
  assert.match(world,/function pulseWeatherVane\(label='SKY READ',ready=false\)/);
  assert.match(world,/map_table:\[HUB\.guild\.x-3\.7/);
  assert.match(world,/armory_rack:\[HUB\.guild\.x\+3\.9/);
  assert.match(world,/pantry_shelf:\[HUB\.guild\.x-3\.75/);
  assert.match(world,/recall_lectern:\[HUB\.guild\.x\+\.25/);
  assert.match(world,/weather_vane:\[HUB\.guild\.x\+3\.65/);
  assert.match(combat,/function nearFellowshipNoticeBoard/);
  assert.match(combat,/function nearFellowshipWeeklyCache/);
  assert.match(combat,/guildHallRequest',\{source:'weekly_cache'\}/);
  assert.match(combat,/openGuildHallUI\('weekly_rewards'\)/);
  assert.match(combat,/function nearRecallLectern/);
  assert.match(combat,/function nearFellowshipMapTable/);
  assert.match(combat,/function nearFellowshipArmoryRack/);
  assert.match(combat,/function nearFellowshipPantryShelf/);
  assert.match(combat,/function nearFellowshipWeatherVane/);
  assert.match(combat,/hasFellowshipProject\('recall_lectern'\)/);
  assert.match(combat,/hasFellowshipProject\('map_table'\)/);
  assert.match(combat,/hasFellowshipProject\('armory_rack'\)/);
  assert.match(combat,/hasFellowshipProject\('pantry_shelf'\)/);
  assert.match(combat,/hasFellowshipProject\('weather_vane'\)/);
  assert.match(combat,/openFellowshipMapTableUI/);
  assert.match(combat,/openFellowshipArmoryUI/);
  assert.match(combat,/openFellowshipPantryUI/);
  assert.match(combat,/openFellowshipWeatherVaneUI/);
  assert.match(combat,/guildHallRequest/);
  assert.match(frame,/Fellowship Notice Board/);
  assert.match(frame,/Fellowship Weekly Cache/);
  assert.match(frame,/Press G to claim unlocked rewards/);
  assert.match(frame,/Fellowship Study Lectern/);
  assert.match(frame,/Fellowship Map Table/);
  assert.match(frame,/Fellowship Armory Rack/);
  assert.match(frame,/Fellowship Pantry Shelf/);
  assert.match(frame,/Fellowship Weather Vane/);
  const recall=fs.readFileSync(path.join(__dirname,'..','..','client','js','recall.mjs'),'utf8');
  assert.match(recall,/BlockcraftFellowshipEffects\.pulseRecallLecternRenown\(m\.fellowshipRenown\|0\)/);
});

test('Armory Rack acts as a fellowship combat-prep station',()=>{
  const menus=fs.readFileSync(path.join(__dirname,'..','..','client','js','menus.mjs'),'utf8');
  const world=fs.readFileSync(path.join(__dirname,'..','..','client','js','world.mjs'),'utf8');
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  const frame=fs.readFileSync(path.join(__dirname,'..','..','client','js','frame-loop.mjs'),'utf8');
  assert.match(menus,/function openFellowshipArmoryUI\(/);
  assert.match(menus,/FELLOWSHIP ARMORY RACK/);
  assert.match(menus,/COMBAT PREP STATION/);
  assert.match(menus,/gateReadinessLocal\(rank\)/);
  assert.match(menus,/armoryBestWeapon/);
  assert.match(menus,/armoryMostDamagedGear/);
  assert.match(menus,/INSPECT GEAR/);
  assert.match(menus,/TOBIN REPAIRS/);
  assert.match(menus,/CRAFT PREP/);
  assert.match(menus,/GATE PREP/);
  assert.match(menus,/openBlacksmithServicesUI\(\)/);
  assert.match(menus,/openCraftingFromNpc\('tools'\)/);
  assert.match(menus,/READY FOR/);
  assert.match(world,/pulseArmoryRack/);
  assert.match(combat,/nearFellowshipArmoryRack/);
  assert.match(frame,/Gate readiness, repairs and loadout checks/);
});

test('Pantry Shelf acts as a fellowship sustain-prep station',()=>{
  const menus=fs.readFileSync(path.join(__dirname,'..','..','client','js','menus.mjs'),'utf8');
  const world=fs.readFileSync(path.join(__dirname,'..','..','client','js','world.mjs'),'utf8');
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  const frame=fs.readFileSync(path.join(__dirname,'..','..','client','js','frame-loop.mjs'),'utf8');
  assert.match(menus,/function openFellowshipPantryUI\(/);
  assert.match(menus,/FELLOWSHIP PANTRY SHELF/);
  assert.match(menus,/SUSTAIN PREP STATION/);
  assert.match(menus,/pantrySummary\(rank/);
  assert.match(menus,/Current hunger/);
  assert.match(menus,/Gate rations/);
  assert.match(menus,/Strong meal packed/);
  assert.match(menus,/FOOD RECIPES/);
  assert.match(menus,/GRETA TAVERN/);
  assert.match(menus,/COOK JOBS/);
  assert.match(menus,/openCraftingFromNpc\('food'\)/);
  assert.match(world,/pulsePantryShelf/);
  assert.match(combat,/nearFellowshipPantryShelf/);
  assert.match(frame,/hunger, rations and Cook prep/);
});

test('Weather Vane acts as a fellowship weather-planning station',()=>{
  const menus=fs.readFileSync(path.join(__dirname,'..','..','client','js','menus.mjs'),'utf8');
  const world=fs.readFileSync(path.join(__dirname,'..','..','client','js','world.mjs'),'utf8');
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  const frame=fs.readFileSync(path.join(__dirname,'..','..','client','js','frame-loop.mjs'),'utf8');
  assert.match(menus,/function openFellowshipWeatherVaneUI\(/);
  assert.match(menus,/FELLOWSHIP WEATHER VANE/);
  assert.match(menus,/WEATHER PLANNING STATION/);
  assert.match(menus,/weatherVaneSummary\(\)/);
  assert.match(menus,/AWAKE NOW/);
  assert.match(menus,/MAPPED \+ ACTIVE/);
  assert.match(menus,/FELLOWSHIP WEATHER CODEX/);
  assert.match(menus,/OPEN DISCOVERY JOURNAL/);
  assert.match(menus,/WEATHER SENSE/);
  assert.match(world,/pulseWeatherVane/);
  assert.match(combat,/nearFellowshipWeatherVane/);
  assert.match(frame,/active weather sites and sky planning/);
});

test('Map Table affects cartographer lead cost and treasure clue messaging',()=>{
  const menus=fs.readFileSync(path.join(__dirname,'..','..','client','js','menus.mjs'),'utf8');
  const networking=fs.readFileSync(path.join(__dirname,'..','..','client','js','networking.mjs'),'utf8');
  const game=fs.readFileSync(path.join(__dirname,'..','..','server','rooms','GameRoom.js'),'utf8');
  assert.match(game,/mapLeadCost=mapTable\?15:25/);
  assert.match(game,/atFellowshipMapTable/);
  assert.match(game,/clientGuildHasProject\(client,'map_table'\)/);
  assert.match(game,/Fellowship Map Table note/);
  assert.match(menus,/function openFellowshipMapTableUI\(state=cartographerState\)/);
  assert.match(menus,/FELLOWSHIP MAP TABLE/);
  assert.match(menus,/fellowship-map-table-marker/);
  assert.match(menus,/mapTableAction\('hint'/);
  assert.match(menus,/mapTableAction\('treasure_start'/);
  assert.match(menus,/state\.mapLeadCost/);
  assert.match(menus,/MAP TABLE/);
  assert.match(networking,/openFellowshipMapTableUI\(m\)/);
  assert.match(networking,/your fellowship has sharpened this clue/);
  assert.match(networking,/clue narrowed by your fellowship/);
});

test('Party Compass prioritizes rally, dungeon pings, downed allies, and split teammates',()=>{
  const frame=fs.readFileSync(path.join(__dirname,'..','..','client','js','frame-loop.mjs'),'utf8');
  const social=fs.readFileSync(path.join(__dirname,'..','..','client','js','social.mjs'),'utf8');
  const world=fs.readFileSync(path.join(__dirname,'..','..','client','js','world.mjs'),'utf8');
  assert.match(world,/Coordinates groups: prioritizes gate rally, dungeon pings, downed or spirit allies, and separated teammates/);
  assert.match(frame,/function partyCompassTarget\(\)/);
  assert.match(frame,/activeDungeonPing&&performance\.now\(\)<activeDungeonPing\.expires/);
  assert.match(frame,/const labels=\{group:'Regroup',boss:'Boss Ping',loot:'Loot Ping'\}/);
  assert.match(frame,/party\.find\(m=>m\.downed\|\|m\.spirit\)/);
  assert.match(frame,/ref\|\|member/);
  assert.match(frame,/dungeonObjectiveState\(status,me/);
  assert.match(fs.readFileSync(path.join(__dirname,'..','..','client','js','networking.mjs'),'utf8'), /dungeonPartyStatus/);
  assert.match(fs.readFileSync(path.join(__dirname,'..','..','client','js','menus.mjs'),'utf8'), /function applyDungeonPartyStatus\(m\)/);
  assert.match(fs.readFileSync(path.join(__dirname,'..','..','client','js','dimensions.mjs'),'utf8'), /pendingDungeonPartyStatus/);
  assert.match(frame,/dungeonLobbyState&&dungeonLobbyState\.rally/);
  assert.match(frame,/bd=-1/);
  assert.match(frame,/Split: /);
  assert.match(frame,/partyCompassTarget:partyCompassTarget\(\)/);
  assert.match(social,/NET\.room&&NET\.room\.state&&NET\.room\.state\.players/);
  assert.match(social,/typeof players\.get==='function'/);
});

test('utility feedback has readable world markers and urgent party HUD states',()=>{
  const frame=fs.readFileSync(path.join(__dirname,'..','..','client','js','frame-loop.mjs'),'utf8');
  const networking=fs.readFileSync(path.join(__dirname,'..','..','client','js','networking.mjs'),'utf8');
  const styles=fs.readFileSync(path.join(__dirname,'..','..','client','styles.css'),'utf8');
  assert.match(frame,/const trailSenseGroup=new THREE\.Group\(\)/);
  assert.match(frame,/const partyCompassGroup=new THREE\.Group\(\)/);
  assert.match(frame,/function updateUtilityWorldFeedback\(now,dt\)/);
  assert.match(frame,/function showFeatherStepLandingFx\(m=\{\}\)/);
  assert.match(frame,/globalThis\.BlockcraftUtilityFeedback=\{showFeatherStepLandingFx\}/);
  assert.match(frame,/utilityPriorityClass\(t\.priority\)/);
  assert.match(frame,/utilityTargetHudLine\(t\)/);
  assert.match(networking,/showFeatherStepLandingFx\(m\)/);
  assert.match(styles,/\.statuschip\.utility\.urgent/);
  assert.match(styles,/\.statuschip\.utility\.active/);
});

test('utility ability screen explains slots, unlock sources, and gameplay use cases',()=>{
  const menus=fs.readFileSync(path.join(__dirname,'..','..','client','js','menus.mjs'),'utf8');
  const world=fs.readFileSync(path.join(__dirname,'..','..','client','js','world.mjs'),'utf8');
  const styles=fs.readFileSync(path.join(__dirname,'..','..','client','styles.css'),'utf8');
  assert.match(world,/use:'Press I to reveal nearby road danger/);
  assert.match(world,/use:'Protects risky climbs, bridges, towers, and dungeon drops/);
  assert.match(world,/Clear your first E-rank Gate or finish a Parkour event/);
  assert.match(world,/Reach Road Warden reputation III or map 10 discoveries/);
  assert.match(menus,/function utilitySlotLabel\(id\)/);
  assert.match(menus,/utility-loadout-panel/);
  assert.match(menus,/ACTIVE UTILITY/);
  assert.match(menus,/PASSIVE UTILITIES/);
  assert.match(menus,/Locked utilities show exactly where to earn them/);
  assert.match(menus,/btn\.title='Unlock from: '\+u\.unlock/);
  assert.match(styles,/\.utility-slots/);
  assert.match(styles,/\.shoprow\.utilityrow/);
});

test('utility unlocks present a reward toast with slot outcome and open-utilities action',()=>{
  const networking=fs.readFileSync(path.join(__dirname,'..','..','client','js','networking.mjs'),'utf8');
  const styles=fs.readFileSync(path.join(__dirname,'..','..','client','styles.css'),'utf8');
  assert.match(networking,/utilityUnlockToastEl\.id='utilityunlocktoast'/);
  assert.match(networking,/function utilitySlotUnlockLine\(m,u\)/);
  assert.match(networking,/Equipped in passive slot/);
  assert.match(networking,/Equipped in active slot\. Press I to use it/);
  assert.match(networking,/Utilities shape exploration\. Equip up to 3 passives and 1 active/);
  assert.match(networking,/function showUtilityUnlockToast\(m,u,firstUnlock=false\)/);
  assert.match(networking,/menusApi\.openUtilitiesUI/);
  assert.match(networking,/const firstUnlock=utilityUnlocks\.filter\(k=>UTILITY_DEFS\[k\]\)\.length===0/);
  assert.match(styles,/#utilityunlocktoast/);
  assert.match(styles,/body\.cutscene [^}]*#utilityunlocktoast/);
});

test('client XP previews match the authoritative activity economy', async () => {
  const client = await clientModule('progression.mjs');
  const server = require('../rooms/xp-economy');
  assert.deepEqual({ ...client.HUNTER_ACTIVITY_XP_WEIGHTS }, { ...server.XP_ACTIVITY_WEIGHTS });
  for (const level of [1, 11, 21, 31, 41, 51]) {
    for (const type of Object.keys(server.XP_ACTIVITY_WEIGHTS)) {
      assert.equal(client.hunterXpForActivity(level, type), server.hunterXpForActivity(level, type));
    }
  }
});

test('rank progress counts all level XP remaining to the next Hunter rank', async () => {
  const { HUNTER_RANK_LEVELS, rankProgressForLevel, xpNeedForLevel } = await clientModule('progression.mjs');
  const freshD = rankProgressForLevel(11, 0);
  const dRequired = Array.from({length:10},(_,i)=>11+i).reduce((sum, level) => sum + xpNeedForLevel(level), 0);
  assert.deepEqual(freshD, {
    rank: 1,
    nextRank: 2,
    nextRankLevel: 21,
    earned: 0,
    required: dRequired,
    remaining: dRequired,
    progress: 0,
    maxRank: false,
  });
  const midD = rankProgressForLevel(13, 25);
  assert.equal(midD.earned, xpNeedForLevel(11) + xpNeedForLevel(12) + 25);
  assert.equal(midD.remaining, dRequired - midD.earned);
  assert.equal(rankProgressForLevel(HUNTER_RANK_LEVELS.at(-1), 999).maxRank, true);
});

test('progression focus states stay identical across client and server', async () => {
  const { PROGRESSION_FOCUS_STATES } = await clientModule('progression.mjs');
  const serverStates = require('../rooms/constants').PROGRESSION_FOCUS_STATES;
  assert.deepEqual([...PROGRESSION_FOCUS_STATES], [...serverStates], 'client/server onboarding focus whitelist parity');
});

test('client restore and movement use persisted vitals and empty-hunger slowdown', () => {
  const networking = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8');
  const frameLoop = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'frame-loop.mjs'), 'utf8');
  const dimensions = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'dimensions.mjs'), 'utf8');

  assert.match(networking, /const vitals=m&&m\.vitals&&typeof m\.vitals==='object'\?m\.vitals:\{\}/);
  assert.match(networking, /sp:Math\.max\(0,Math\.min\(maxSp\(\),Number\(sp\)\|\|0\)\)/);
  assert.doesNotMatch(networking, /hp=maxHp\(\); mp=maxMp\(\); sp=maxSp\(\); hunger=maxHunger\(\);/);
  assert.match(frameLoop, /const outOfFood=!mounted && hunger<=0/);
  assert.match(frameLoop, /const sprint=.*&&\s*!outOfFood/);
  assert.match(frameLoop, /baseSpd\*\(outOfFood\?0\.62:1\)/);
  assert.match(dimensions, /if\(S\.lvl<3 && hunger<maxHunger\(\)\)/);
  assert.doesNotMatch(dimensions, /local:starvation/);
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

test('auth controller logs into the typed account instead of reusing a different stored session', async () => {
  const previousLocalStorage = globalThis.localStorage;
  const previousSessionStorage = globalThis.sessionStorage;
  const local = new Map([['blockcraft.auth.session', 'admin-session']]);
  const session = new Map([['bc_reconnect_token', 'admin-room'], ['bc_reconnect_token:auth', 'admin-session']]);
  globalThis.localStorage = {
    getItem: key => local.get(key) || '',
    setItem: (key, value) => local.set(key, value),
    removeItem: key => local.delete(key),
  };
  globalThis.sessionStorage = {
    getItem: key => session.get(key) || '',
    setItem: (key, value) => session.set(key, value),
    removeItem: key => session.delete(key),
  };
  const fakeEl = value => ({
    value,
    textContent: '',
    className: '',
    hidden: false,
    classList: { add() {}, toggle() {} },
    focus() {},
  });
  const calls = [];
  const responses = {
    '/auth/me': { ok: true, account: { id: 'u_admin', username: 'admin.levin@example.com' }, gameProfile: { name: 'Admin_Levin', nameSet: true } },
    '/auth/login': { ok: true, sessionToken: 'dylan-session', account: { id: 'u_dylan', username: 'dylan.lynee@example.com' }, gameProfile: { name: 'Dylan', nameSet: true } },
  };
  try {
    const { createAuthController } = await clientModule('auth.mjs');
    const user = fakeEl('dylan.lynee@example.com');
    const password = fakeEl('dylan12345678');
    const controller = createAuthController({
      user,
      password,
      playerName: fakeEl(''),
      status: fakeEl(''),
      play: fakeEl(''),
      register: fakeEl(''),
      logout: fakeEl(''),
      request: async (url, options = {}) => {
        calls.push([url, options.headers && options.headers.Authorization || '', options.body || '']);
        return { ok: responses[url].ok, json: async () => responses[url] };
      },
    });
    assert.equal(await controller.authenticate(), true);
    assert.equal(controller.state.account.username, 'dylan.lynee@example.com');
    assert.equal(local.get('blockcraft.auth.session'), 'dylan-session');
    assert.equal(session.has('bc_reconnect_token'), false);
    assert.equal(session.has('bc_reconnect_token:auth'), false);
    assert.deepEqual(calls.map(c => c[0]), ['/auth/me', '/auth/login']);
  } finally {
    globalThis.localStorage = previousLocalStorage;
    globalThis.sessionStorage = previousSessionStorage;
  }
});

test('auth controller clears stale hunter name when the signed-in account has no profile name', async () => {
  const previousLocalStorage = globalThis.localStorage;
  const previousSessionStorage = globalThis.sessionStorage;
  const local = new Map([['blockcraft.auth.session', 'admin-session']]);
  const session = new Map([['bc_reconnect_token', 'old-room'], ['bc_reconnect_token:auth', 'admin-session']]);
  globalThis.localStorage = {
    getItem: key => local.get(key) || '',
    setItem: (key, value) => local.set(key, value),
    removeItem: key => local.delete(key),
  };
  globalThis.sessionStorage = {
    getItem: key => session.get(key) || '',
    setItem: (key, value) => session.set(key, value),
    removeItem: key => session.delete(key),
  };
  const fakeEl = value => ({
    value,
    textContent: '',
    className: '',
    hidden: false,
    classList: { add() {}, toggle() {} },
    focus() {},
  });
  const responses = {
    '/auth/me': { ok: true, account: { id: 'u_admin', username: 'admin.levin@example.com' }, gameProfile: { name: 'Admin_Levin', nameSet: true } },
    '/auth/login': { ok: true, sessionToken: 'fresh-student-session', account: { id: 'u_new', username: 'new.student@example.com' }, gameProfile: { name: '', nameSet: false } },
  };
  try {
    const { createAuthController } = await clientModule('auth.mjs');
    const playerName = fakeEl('Admin_Levin');
    const controller = createAuthController({
      user: fakeEl('new.student@example.com'),
      password: fakeEl('newstudent12345'),
      playerName,
      status: fakeEl(''),
      play: fakeEl(''),
      register: fakeEl(''),
      logout: fakeEl(''),
      request: async (url) => ({ ok: responses[url].ok, json: async () => responses[url] }),
    });
    assert.equal(await controller.authenticate(), true);
    assert.equal(controller.state.account.username, 'new.student@example.com');
    assert.equal(playerName.value, '');
    assert.equal(local.get('blockcraft.auth.session'), 'fresh-student-session');
    assert.equal(session.has('bc_reconnect_token'), false);
  } finally {
    globalThis.localStorage = previousLocalStorage;
    globalThis.sessionStorage = previousSessionStorage;
  }
});

test('play flow does not overwrite an existing server hunter name from the input field', () => {
  const combatSource = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'combat.mjs'), 'utf8');
  assert.match(combatSource, /if\(!AUTH_UI\.hasHunterName\(\)\)\{/);
  assert.match(combatSource, /await AUTH_UI\.saveHunterName\(hunterName\);/);
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
  const networkingSource=fs.readFileSync(path.join(__dirname,'..','..','client','js','networking.mjs'),'utf8');
  assert.match(networkingSource,/function connectionNotice\(kind, attempt=0\)/);
  assert.match(networkingSource,/Connection lost[\s\S]*Reconnecting to the world/);
  assert.match(networkingSource,/Back online[\s\S]*World state restored/);
  assert.match(networkingSource,/Could not reconnect/);
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
    onReconnectAttempt: attempt => events.push(['attempt', attempt]), onRestored: () => events.push(['restored']), onFailure: error => { throw error; },
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
  assert.deepEqual(events, [
    ['join', 'blockcraft', 'Hunter'],
    ['interrupted'],
    ['attempt', 1],
    ['reconnect', 'room:first'],
    ['restored'],
  ]);
});

test('network controller sends saved auth token during room matchmaking', async () => {
  const { createNetworkController } = await clientModule('network.mjs');
  const gameRoomSource = fs.readFileSync(path.join(__dirname, '..', 'rooms', 'GameRoom.js'), 'utf8');
  assert.match(gameRoomSource, /authToken \|\| options\.sessionToken/);
  assert.match(gameRoomSource, /authorization.*Bearer/);
  let clientAuthToken = '';
  let joinedOptions = null;
  const room = { reconnectionToken: 'room:first', onLeave() {} };
  class Client {
    constructor() { this.auth = {}; }
    async joinOrCreate(_name, options) {
      clientAuthToken = this.auth.token || '';
      joinedOptions = options;
      return room;
    }
  }
  const controller = createNetworkController({
    Client, endpoint: () => 'ws://test', roomName: 'blockcraft', tokenKey: 'resume',
    authToken: () => 'session-token-123',
    sessionStorage: { getItem: () => '', setItem() {}, removeItem() {} },
    onAttach() {}, onUnavailable() {}, onInterrupted() {}, onReconnectAttempt() {}, onRestored() {},
    onFailure(error) { throw error; },
  });
  controller.connect('Hunter');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(clientAuthToken, 'session-token-123');
  assert.equal(joinedOptions.authToken, 'session-token-123');
  assert.equal(joinedOptions.name, 'Hunter');
});

test('network controller clears stale room resume token when auth session changes', async () => {
  const { createNetworkController } = await clientModule('network.mjs');
  const storage = new Map([['resume', 'admin-room-token'], ['resume:auth', 'admin-session']]);
  const events = [];
  const room = { reconnectionToken: 'dylan-room-token', onLeave() {} };
  class Client {
    constructor() { this.auth = {}; }
    async reconnect(token) {
      events.push(['reconnect', token]);
      throw new Error('stale resume token should not be used');
    }
    async joinOrCreate(name, options) {
      events.push(['join', name, options.name, options.authToken, this.auth.token]);
      return room;
    }
  }
  const controller = createNetworkController({
    Client, endpoint: () => 'ws://test', roomName: 'blockcraft', tokenKey: 'resume',
    authToken: () => 'dylan-session',
    sessionStorage: { getItem: key => storage.get(key) || '', setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    onAttach() {}, onUnavailable() {}, onInterrupted() {}, onReconnectAttempt() {}, onRestored() {},
    onFailure(error) { throw error; },
  });
  controller.connect('Dylan');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(events, [['join', 'blockcraft', 'Dylan', 'dylan-session', 'dylan-session']]);
  assert.equal(storage.get('resume'), 'dylan-room-token');
  assert.equal(storage.get('resume:auth'), 'dylan-session');
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

test('network controller tries the next overworld shard and returns to it after dungeon rooms', async () => {
  const { createNetworkController } = await clientModule('network.mjs');
  const events = [], selected = [];
  const makeRoom = token => ({
    reconnectionToken: token,
    onLeave(fn) { this.leaveHandler = fn; },
    async leave() { if (this.leaveHandler) this.leaveHandler(); },
  });
  const shard2 = makeRoom('shard-2:token'), dungeon = makeRoom('dungeon:token'), back = makeRoom('shard-2:back');
  let blockcraftJoins = 0;
  class Client {
    async joinOrCreate(name, options) {
      events.push(['join', name, options.shardId || '', options.name]);
      if (name === 'blockcraft' && options.shardId === 'main') throw new Error('shard full');
      if (name === 'blockcraft' && options.shardId === 'shard-2') return blockcraftJoins++ ? back : shard2;
      if (name === 'dungeon') return dungeon;
      throw new Error('unexpected room');
    }
  }
  const controller = createNetworkController({
    Client, endpoint: () => 'ws://test', roomName: 'blockcraft', tokenKey: 'resume',
    joinAttempts: 1, shardAttempts: 2,
    primaryJoinOptions: ({ attempt }) => ({ shardId: attempt === 0 ? 'main' : 'shard-2' }),
    onPrimaryJoinOptions: options => selected.push(options.shardId),
    sessionStorage: { getItem: () => '', setItem() {}, removeItem() {} },
    onAttach() {}, onUnavailable() {}, onInterrupted() {}, onReconnectAttempt() {}, onRestored() {},
    onFailure(error) { throw error; },
  });
  controller.connect('Hunter');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(controller.state.room, shard2);
  assert.equal(controller.state.shardId, 'shard-2');
  assert.deepEqual(selected, ['shard-2']);
  await controller.switchRoom('dungeon', { gateId: 'g1' });
  await controller.returnToPrimary();
  assert.equal(controller.state.room, back);
  assert.deepEqual(events, [
    ['join', 'blockcraft', 'main', 'Hunter'],
    ['join', 'blockcraft', 'shard-2', 'Hunter'],
    ['join', 'dungeon', '', 'Hunter'],
    ['join', 'blockcraft', 'shard-2', 'Hunter'],
  ]);
});

test('network controller waits for a booting main shard before trying overflow shards', async () => {
  const { createNetworkController } = await clientModule('network.mjs');
  const events = [], selected = [];
  const main = { reconnectionToken: 'main:token', onLeave() {} };
  let mainAttempts = 0;
  class Client {
    async joinOrCreate(name, options) {
      events.push(['join', name, options.shardId || '']);
      if (options.shardId === 'main' && ++mainAttempts < 4) throw new Error('the Blockcraft overworld shard "main" is already active; refusing a second persistence writer');
      if (options.shardId === 'main') return main;
      throw new Error('should not overflow while main is booting');
    }
  }
  const controller = createNetworkController({
    Client, endpoint: () => 'ws://test', roomName: 'blockcraft', tokenKey: 'resume',
    joinAttempts: 4, shardAttempts: 2, wait: async () => {},
    primaryJoinOptions: ({ attempt }) => ({ shardId: attempt === 0 ? 'main' : 'shard-2' }),
    onPrimaryJoinOptions: options => selected.push(options.shardId),
    sessionStorage: { getItem: () => '', setItem() {}, removeItem() {} },
    onAttach() {}, onUnavailable() {}, onInterrupted() {}, onReconnectAttempt() {}, onRestored() {},
    onFailure(error) { throw error; },
  });
  controller.connect('Hunter');
  await new Promise(resolve => setTimeout(resolve, 0));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(controller.state.room, main);
  assert.equal(controller.state.shardId, 'main');
  assert.deepEqual(selected, ['main']);
  assert.deepEqual(events, [
    ['join', 'blockcraft', 'main'],
    ['join', 'blockcraft', 'main'],
    ['join', 'blockcraft', 'main'],
    ['join', 'blockcraft', 'main'],
  ]);
});

test('network session fresh joins prefer main before a saved overflow shard', async () => {
  const previousLocalStorage = globalThis.localStorage;
  const local = new Map([['bc_shard_id', 'shard-2']]);
  globalThis.localStorage = {
    getItem: key => local.get(key) || '',
    setItem: (key, value) => local.set(key, value),
    removeItem: key => local.delete(key),
  };
  try {
    const { createNetworkSession } = await clientModule('network-session.mjs');
    let captured = null;
    createNetworkSession({
      createController: options => {
        captured = options;
        return { state: {}, connect() {} };
      },
      Client: class {},
      endpoint: () => 'ws://test',
      sessionStorage: { getItem: () => '', setItem() {}, removeItem() {} },
      attachRoom() {},
      unavailable() {},
      interrupted() {},
      reconnectAttempt() {},
      restored() {},
      failure() {},
      getPlayerName: () => 'Hunter',
      authToken: () => '',
      beforeConnect() {},
    });
    assert.equal(captured.primaryJoinOptions({ name: 'Hunter', attempt: 0 }).shardId, 'main');
    assert.equal(captured.primaryJoinOptions({ name: 'Hunter', attempt: 1 }).shardId, 'shard-2');
  } finally {
    globalThis.localStorage = previousLocalStorage;
  }
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

test('multiplayer avatars use authenticated profile names and unflipped replicated yaw', () => {
  const gameRoomSource = fs.readFileSync(path.join(__dirname, '..', 'rooms', 'GameRoom.js'), 'utf8');
  const pumpSource = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'network-frame-pump.mjs'), 'utf8');
  const avatarSource = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'companions.mjs'), 'utf8');
  const networkingSource = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'networking.mjs'), 'utf8');
  assert.match(gameRoomSource, /p\.name = cleanName\(\(prof && prof\.name\) \|\|/);
  assert.match(gameRoomSource, /defaultProfile\(auth && auth\.displayName\)/);
  assert.doesNotMatch(gameRoomSource, /defaultProfile\(options && options\.name \|\| auth\.displayName\)/);
  assert.doesNotMatch(gameRoomSource, /p\.name = cleanName\(options && typeof options\.name === 'string' \? options\.name : \(prof \? prof\.name : auth\.displayName\)\)/);
  assert.match(gameRoomSource, /JOIN_SNAPSHOT_DELAY_MS/);
  assert.match(gameRoomSource, /setTimeout\(\(\) => \{[\s\S]*client\.send\('hunger'/);
  assert.match(gameRoomSource, /\}, JOIN_SNAPSHOT_DELAY_MS\);/);
  assert.match(networkingSource, /const syncRemotePlayerSnapshot=\(\)=>/);
  assert.match(networkingSource, /const players=room&&room\.state&&room\.state\.players;/);
  assert.match(networkingSource, /players\.forEach\(\(p,sid\)=>/);
  assert.match(networkingSource, /if\(NET\.remotes\[sid\]\)NET\.remotes\[sid\]\.ref=p;\s*else netAddRemote\(sid,p\);/);
  assert.match(networkingSource, /syncRemotePlayerSnapshot\(\);/);
  assert.match(avatarSource, /blink\.push\(addBox\(head,\[\.085,\.09,\.034\],\[-\.11,\.\d+,-\.276\],eyeM\)\)/);
  assert.match(pumpSource, /angDiff\(ref\.yaw,r\.grp\.rotation\.y\)/);
  assert.doesNotMatch(pumpSource, /ref\.yaw\+Math\.PI/);
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

test('Rank Journey presents ten-level bands, promotion unlocks, and reward previews', () => {
  const menus = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'menus.mjs'), 'utf8');
  const onboarding = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'onboarding.mjs'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'styles.css'), 'utf8');
  assert.match(menus, /const HUNTER_RANK_STARTS=\[1,11,21,31,41,51\]/);
  assert.match(menus, /function openRankJourneyUI\(\)/);
  assert.match(menus, /RANK JOURNEY/);
  assert.match(menus, /quest-reward-preview/);
  assert.match(onboarding, /NEWLY UNLOCKED/);
  assert.match(css, /\.rank-journey-hero/);
});

test('tavern gambling has server-backed dice roulette and blackjack table entry points',()=>{
  const menus=fs.readFileSync(path.join(__dirname,'..','..','client','js','menus.mjs'),'utf8');
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  const networking=fs.readFileSync(path.join(__dirname,'..','..','client','js','networking.mjs'),'utf8');
  const world=fs.readFileSync(path.join(__dirname,'..','..','client','js','world.mjs'),'utf8');
  const room=fs.readFileSync(path.join(__dirname,'..','rooms','GameRoom.js'),'utf8');
  const economy=fs.readFileSync(path.join(__dirname,'..','rooms','economy.mixin.js'),'utf8');
  assert.match(menus,/function openTavernDiceUI/);
  assert.match(menus,/function openTavernRouletteUI/);
  assert.match(menus,/function openTavernBlackjackUI/);
  assert.match(menus,/NET\.room\.send\('tavernDice'/);
  assert.match(menus,/NET\.room\.send\('tavernRoulette'/);
  assert.match(menus,/NET\.room\.send\('tavernBlackjack'/);
  assert.match(menus,/LOW/);
  assert.match(menus,/LUCKY 7/);
  assert.match(menus,/HIGH/);
  assert.match(menus,/RED/);
  assert.match(menus,/ZERO/);
  assert.match(combat,/nearTavernDiceTable/);
  assert.match(combat,/nearTavernRouletteTable/);
  assert.match(combat,/nearTavernBlackjackTable/);
  assert.match(combat,/openTavernDiceUI\(\)/);
  assert.match(combat,/openTavernRouletteUI\(\)/);
  assert.match(combat,/openTavernBlackjackUI\(\)/);
  assert.match(networking,/room\.onMessage\('tavernDiceResult'/);
  assert.match(networking,/room\.onMessage\('tavernRouletteResult'/);
  assert.match(networking,/room\.onMessage\('tavernBlackjackState'/);
  assert.match(world,/Dice Table/);
  assert.match(world,/Blackjack Table · G/);
  assert.match(world,/Roulette Table · G/);
  assert.match(room,/onMessage\('tavernDice'/);
  assert.match(room,/onMessage\('tavernRoulette'/);
  assert.match(room,/onMessage\('tavernBlackjack'/);
  assert.match(economy,/handleTavernDice/);
  assert.match(economy,/handleTavernRoulette/);
  assert.match(economy,/handleTavernBlackjack/);
  assert.match(economy,/blackjackTotal/);
  assert.match(economy,/Math\.max\(1, Math\.min\(25/);
});

test('quest log progression director introduces one system at a time',()=>{
  const menus=fs.readFileSync(path.join(__dirname,'..','..','client','js','menus.mjs'),'utf8');
  const networking=fs.readFileSync(path.join(__dirname,'..','..','client','js','networking.mjs'),'utf8');
  const onboarding=fs.readFileSync(path.join(__dirname,'..','..','client','js','onboarding.mjs'),'utf8');
  const combat=fs.readFileSync(path.join(__dirname,'..','..','client','js','combat.mjs'),'utf8');
  const frame=fs.readFileSync(path.join(__dirname,'..','..','client','js','frame-loop.mjs'),'utf8');
  const world=fs.readFileSync(path.join(__dirname,'..','..','client','js','world.mjs'),'utf8');
  const room=fs.readFileSync(path.join(__dirname,'..','rooms','GameRoom.js'),'utf8');
  const store=fs.readFileSync(path.join(__dirname,'..','store.js'),'utf8');
  const earlyLoopE2E=fs.readFileSync(path.join(__dirname,'..','..','e2e','player-facing-early-loop.spec.js'),'utf8');
  assert.match(menus,/function progressionRoadmap\(\)/);
  assert.match(menus,/const PLAYER_STYLE_GUIDES=Object\.freeze\(\[/);
  for (const id of ['fighter','builder','farmer','miner','social','collector','explorer','learner']) {
    assert.match(menus, new RegExp("id:'" + id + "'"));
  }
  assert.match(menus,/function openPlayerStyleGuideUI\(\)/);
  assert.match(menus,/BlockcraftPlayerStyleGuide=Object\.freeze/);
  assert.match(menus,/safeQuestLogCard\('First Style',playerStyleGuideQuestLogCard\)/);
  assert.match(menus,/openPlayerStyleGuide:openPlayerStyleGuideUI/);
  assert.match(combat,/CHOOSE PLAYSTYLE/);
  assert.match(networking,/const focus=String\(m&& \(m\.progressionFocus\|\|m\.focus\) \|\| ''\);/);
  assert.match(menus,/function whatNextQuestLogCard\(\)/);
  assert.match(menus,/function activeObjectiveList\(\)/);
  assert.match(menus,/const QUEST_OBJECTIVES=globalThis\.BlockcraftQuestObjectives/);
  assert.match(menus,/const NPC_QUEST_REGISTRY=globalThis\.BlockcraftNpcQuestChains/);
  assert.match(menus,/NPC_QUEST_REGISTRY\.createNpcQuestChains\(\{B,I\}\)/);
  assert.match(menus,/QUEST_OBJECTIVES\.normalizeObjectiveList/);
  assert.match(menus,/function serverObjectiveQuestLogCards\(\)/);
  assert.match(menus,/function serverObjectiveQuestLogSections\(/);
  assert.match(menus,/function questHistoryQuestLogSections\(/);
  assert.match(menus,/function questLogObjectiveList\(\)/);
  assert.match(menus,/!isBoardOnlyQuestLogSource\(o\.source\|\|o\.category\)/);
  const questLogUi=menus.slice(menus.indexOf('function openQuestLogUI(){'),menus.indexOf('function firstDragonTreatSlot(){'));
  assert.doesNotMatch(questLogUi,/safeQuestLogCard\('Job Contract'/);
  assert.doesNotMatch(questLogUi,/safeQuestLogCard\('Guild Contract'/);
  assert.doesNotMatch(questLogUi,/qBtn\('JOBS'/);
  assert.doesNotMatch(questLogUi,/qBtn\('GUILD CONTRACTS'/);
  assert.match(menus,/function nextGatePrepRank\(\)/);
  assert.match(menus,/function gatePrepLoopCard\(\)/);
  assert.match(menus,/function openGatePrepUI\(rank=nextGatePrepRank\(\)\)/);
  assert.match(menus,/safeQuestLogCard\('Gate Prep',gatePrepLoopCard\)/);
  assert.match(menus,/openGatePrep:openGatePrepUI/);
  assert.match(menus,/gateReadiness:gateReadinessLocal/);
  assert.match(menus,/function questLogFilterBarHTML\(\)/);
  assert.match(menus,/data-quest-filter/);
  assert.match(menus,/function questLogActionLabel\(o\)/);
  assert.match(menus,/o\.questLogAction\|\|o\.claimAction\|\|o\.action/);
  assert.match(menus,/track_npc/);
  assert.match(menus,/Failed \/ Abandoned/);
  assert.match(menus,/function questRewardPreviewHTML\(/);
  assert.match(menus,/function questSectionHTML\(/);
  assert.match(menus,/function bindServerObjectiveActions/);
  assert.match(menus,/data-server-objective-action/);
  assert.match(menus,/data-server-objective-location/);
  assert.match(menus,/function openServerObjectiveDestination/);
  assert.match(menus,/if\(action==='quest_log'&&openServerObjectiveDestination\(meta\)\)return;/);
  assert.match(menus,/root\.addEventListener\('pointerdown',trigger,\{capture:true\}\);/);
  assert.match(menus,/openRegionalContracts:openRegionalContractsUI/);
  assert.match(menus,/openGuardian:openGuardianUI/);
  assert.match(menus,/Server Objectives/);
  assert.match(menus,/Manhunt Quest/);
  const npcQuestRegistry=fs.readFileSync(path.join(__dirname,'..','..','shared','npc-quest-chains.js'),'utf8');
  assert.match(npcQuestRegistry,/type:'manhunt'/);
  assert.match(menus,/function recoveryHubInfo\(\)/);
  assert.match(menus,/function appendRecoveryHubCard/);
  assert.match(menus,/Recovery Hub/);
  assert.match(menus,/Reward Pending/);
  assert.match(menus,/Choose Path/);
  assert.match(menus,/Start Awakening/);
  assert.match(menus,/Land Claim Recovery/);
  assert.match(menus,/Contract Recovery/);
  assert.match(menus,/appendRecoveryHubCard\(qpanelEl\)/);
  assert.match(menus,/function progressionDirectorGuidanceInfo\(\)/);
  assert.match(menus,/function objectiveCraftCandidates\(/);
  assert.match(menus,/progressionFocus==='first_craft_station'/);
  assert.match(menus,/function objectiveCraftShortcutsHTML\(/);
  assert.match(menus,/function presentObjectiveCraftCompletion\(/);
  assert.match(menus,/Objective updated: /);
  assert.match(menus,/Craft complete/);
  assert.match(menus,/Smelt complete/);
  assert.match(menus,/place it inside editable claimed land/);
  assert.match(menus,/claim at the Job Board/);
  assert.match(menus,/data-craft-output/);
  assert.match(menus,/Craftable now/);
  assert.match(menus,/STAGE RECIPE/);
  assert.match(menus,/trackerCraftAction:objectiveTrackerCraftAction/);
  assert.match(menus,/get craftResult\(\)/);
  assert.match(frame,/function currentObjectiveAction\(/);
  assert.match(frame,/function playerStyleObjectiveLine\(\)/);
  assert.match(frame,/type:'player_style',label:'CHOOSE STYLE'/);
  assert.match(frame,/if\(action==='player_style'\)/);
  assert.match(frame,/const style=currentPlayerStyleGuide\(\);\s*if\(style\)\{/);
  assert.match(frame,/function nearbyQuestClaimPrompt\(\)/);
  assert.match(frame,/combatApi\.nearbyInteractionPrompt&&combatApi\.nearbyInteractionPrompt\(\)/);
  assert.match(frame,/Turn In '\+qTitle/);
  assert.match(frame,/Claim Job Reward/);
  assert.match(frame,/Claim Guild Contract/);
  assert.match(frame,/function activeObjectiveList\(\)/);
  assert.match(frame,/const QUEST_OBJECTIVES=globalThis\.BlockcraftQuestObjectives/);
  assert.match(frame,/QUEST_OBJECTIVES\.normalizeObjectiveList/);
  assert.match(frame,/function serverObjectiveForHud\(\)/);
  assert.match(frame,/function serverObjectiveHudText\(o\)/);
  assert.match(frame,/function serverObjectiveHudAction\(o\)/);
  assert.match(frame,/const explicit=o\.hudAction\|\|o\.claimAction\|\|o\.action/);
  assert.match(frame,/function unifiedObjectiveList\(\)/);
  assert.match(frame,/function nextBestObjectiveLine\(\)/);
  assert.match(frame,/function unifiedObjectiveHud\(\)/);
  assert.match(frame,/function jobContractCompassTarget/);
  assert.match(frame,/const jobTarget=jobContractCompassTarget\(\);\s*if\(jobTarget\)return jobTarget;/);
  assert.match(frame,/type:'follow_marker',label:'FOLLOW MARKER'/);
  assert.match(frame,/if\(action==='follow_marker'\)/);
  assert.match(frame,/label:'Next Best Action'/);
  assert.match(frame,/nextBest:true,line/);
  assert.match(frame,/function gatePrepObjectiveLine\(\)/);
  assert.match(frame,/objectiveLine\('prep','Prep'/);
  assert.match(frame,/action==='gate_prep'/);
  assert.match(frame,/function currentObjectiveHud\(\)/);
  assert.match(frame,/localStoryObjectiveLine\(\)\|\|serverObjectiveLine\(serverObjectiveBySource\('story','manhunt'\),'Story'\)/);
  assert.match(frame,/localJobObjectiveLine\(\)\|\|serverObjectiveLine\(serverObjectiveBySource\('job'\),'Job'\)/);
  assert.match(frame,/localGuildObjectiveLine\(\)\|\|serverObjectiveLine\(serverObjectiveBySource\('guild'\),'Guild'\)/);
  assert.match(frame,/serverObjectiveLine\(serverObjectiveBySource\('progression'\),'Next'\)\|\|progressionObjectiveFallback\(\)/);
  assert.match(frame,/obj\.unified&&Array\.isArray\(obj\.lines\)/);
  assert.match(frame,/obj\.nextBest&&obj\.line/);
  assert.match(frame,/class="objective-line /);
  assert.match(frame,/function objectiveTurnInLabel\(o\)/);
  assert.match(frame,/CLAIM AT JOB BOARD/);
  assert.match(frame,/CLAIM GUILD CONTRACT/);
  assert.match(frame,/CLAIM AT AEGIS/);
  assert.match(frame,/action==='guild_contracts'/);
  assert.match(frame,/action==='claim_aegis'/);
  assert.match(frame,/data-location/);
  assert.match(frame,/const obj=currentObjectiveHud\(\);/);
  assert.match(frame,/progression:first_land_claim/);
  assert.match(frame,/OPEN GATE PREP/);
  assert.match(frame,/function transitionRecoveryAction\(/);
  assert.match(frame,/continue_panel/);
  assert.match(frame,/choose_path/);
  assert.match(frame,/start_awakening/);
  assert.match(frame,/use_ability/);
  assert.match(frame,/transitionPanels:transitionPanelState\(\)/);
  assert.match(frame,/function e2eCurrentObjectiveAction\(/);
  assert.match(frame,/data-objective-action/);
  assert.match(frame,/objectiveAction:e2eCurrentObjectiveAction\(\)/);
  assert.match(frame,/landClaimOverlay:!!worldState\.landClaimOverlay/);
  assert.match(frame,/OPEN JOB BOARD/);
  assert.match(frame,/TURN IN TO MARA/);
  assert.match(frame,/CLAIM LAND/);
  assert.match(frame,/FIND GATE/);
  assert.match(frame,/first_profession_contract'\|\|progressionFocus==='first_promotion_job/);
  assert.match(frame,/toggleLandClaims&&worldApi\.toggleLandClaims\(true\)/);
  assert.match(frame,/no nearby Gate is currently tracked/);
  assert.match(frame,/Quest Log opened for context/);
  assert.match(combat,/function claimReadyQuestAtService\(\)/);
  assert.match(combat,/function nearbyInteractionPrompt\(\)/);
  assert.match(combat,/function nearbyVillager\(range=3\.6\)/);
  assert.match(combat,/guardianUnderCrosshair\(8\)\|\|nearbyGuardian\(\)/);
  assert.match(combat,/villagerUnderCrosshair\(4\.5\)\|\|nearbyVillager\(3\.7\)/);
  assert.match(combat,/blockInteractionPrompt\(hit\)/);
  assert.match(combat,/NET\.room\.send\('regionalContractClaim'/);
  assert.match(combat,/Claiming Job Reward/);
  assert.match(combat,/Claiming Guild Contract/);
  assert.match(menus,/Stand beside a <b>Furnace<\/b>/);
  assert.match(onboarding,/actionHTML/);
  const styles=fs.readFileSync(path.join(__dirname,'..','..','client','styles.css'),'utf8');
  assert.match(styles,/\.qaction/);
  assert.match(styles,/overflow-wrap:anywhere/);
  assert.match(styles,/\.objective-list/);
  assert.match(styles,/\.objective-list\.next-best-list/);
  assert.match(styles,/\.objective-line/);
  assert.match(styles,/\.objective-line\.next-best/);
  assert.match(styles,/\.questcard\.prep-loop/);
  assert.match(styles,/\.gate-prep-mini/);
  assert.match(styles,/#currentquest \.objective-line\.prep/);
  assert.match(styles,/#currentquest \.objective-line\{grid-template-columns:36px minmax\(0,1fr\)/);
  assert.match(styles,/#currentquest \.oact\{grid-column:2;grid-row:2/);
  assert.match(styles,/#currentquest \.obody span\{display:none\}/);
  assert.match(styles,/\.oact/);
  assert.match(styles,/\.questsection/);
  assert.match(styles,/\.questlog-tabs/);
  assert.match(styles,/\.questcard\.recent/);
  assert.match(styles,/\.qbadge/);
  assert.match(styles,/\.qreward/);
  assert.match(styles,/\.qprogress/);
  assert.match(menus,/ACTIVATE /);
  assert.match(menus,/DISMISS GUIDE/);
  assert.match(menus,/SYSTEM JOURNEY · ONE INTRODUCTION AT A TIME/);
  assert.match(menus,/OPTIONAL · Tavern Games/);
  assert.match(networking,/m\.systemIntroductions/);
  assert.match(networking,/const QUEST_OBJECTIVES=globalThis\.BlockcraftQuestObjectives/);
  assert.match(networking,/QUEST_OBJECTIVES\.normalizeObjectiveList/);
  assert.match(networking,/progressionMilestoneReward/);
  assert.match(networking,/questRewardSummary/);
  assert.match(networking,/function questRewardSummaryLine\(m\)/);
  assert.match(networking,/function questRewardNextStep\(m\)/);
  assert.match(networking,/if\(m&&m\.nextStep\)return String\(m\.nextStep\)/);
  assert.match(networking,/function questRewardCompletionTitle\(m,sourceLabel\)/);
  assert.match(networking,/Next: '\+escHTML\(next\)/);
  assert.match(networking,/function clampQuestHistoryEntry\(raw\)/);
  assert.match(networking,/setQuestHistoryFromServer\(m\.questHistory\)/);
  assert.match(networking,/function setActiveObjectives\(next, opts=\{\}\)/);
  assert.match(networking,/READY TO CLAIM/);
  assert.match(networking,/ready to claim/);
  assert.match(networking,/Manhunt Quest/);
  assert.match(networking,/m\.subtitle/);
  assert.match(networking,/PROGRESSION MILESTONE/);
  assert.match(networking,/milestonecontinue/);
  assert.match(networking,/spotlightLandClaim/);
  assert.match(networking,/Claim protected/);
  assert.match(networking,/landClaimTrustNotice/);
  assert.match(networking,/landClaimRefresh/);
  assert.match(networking,/homesteadWorkOrder/);
  assert.match(networking,/Homestead ledger/);
  assert.match(networking,/Homestead assist/);
  assert.match(networking,/Protection active for/);
  assert.match(networking,/trusted you to build/);
  assert.match(networking,/gatePrepWarning/);
  assert.match(onboarding,/pathstrip/);
  assert.match(onboarding,/prephint/);
  assert.match(onboarding,/Craft a station/);
  assert.match(onboarding,/Then claim land/);
  assert.match(onboarding,/first_claim_expand/);
  assert.match(onboarding,/Expand your protected base to 3 connected land claims/);
  assert.match(onboarding,/first_base_setup/);
  assert.match(onboarding,/place a chest, a torch or lantern, and a Crafting Table or Furnace/);
  assert.match(onboarding,/baseSetupStatus/);
  assert.match(onboarding,/Storage/);
  assert.match(onboarding,/These only count inside editable claimed land/);
  assert.match(combat,/explainBaseSetupPlacement/);
  assert.match(menus,/gate-readiness-list/);
  assert.match(menus,/gate-party-readiness/);
  assert.match(menus,/PARTY CHECK/);
  assert.match(menus,/UNDER RANK/);
  assert.match(menus,/GATE_READINESS_HINTS/);
  assert.match(frame,/Missing: /);
  assert.match(frame,/no nearby Gate/);
  assert.match(frame,/clearInventoryItems/);
  assert.match(frame,/Homestead/);
  assert.match(world,/function spotlightLandClaim/);
  assert.match(world,/get landClaimOverlay\(\)/);
  assert.match(world,/function baseSetupStatus/);
  assert.match(world,/function explainBaseSetupPlacement/);
  assert.match(world,/function claimableObjectiveForNpc\(v\)/);
  assert.match(world,/role='guardian'/);
  assert.match(world,/claim_aegis/);
  assert.match(world,/function landClaimPermissionPreview/);
  assert.match(world,/function landClaimAreaPlace/);
  assert.match(world,/Homestead/);
  assert.match(world,/Owner rights/);
  assert.match(world,/<\/b> Build/);
  assert.match(world,/NAME HOMESTEAD/);
  assert.match(world,/TRUST HOMESTEAD/);
  assert.match(world,/REMOVE HOMESTEAD/);
  assert.match(world,/HOMESTEAD WORK ORDERS/);
  assert.match(world,/Homestead chest/);
  assert.match(world,/Trusted helper: contributions grant assist XP/);
  assert.match(world,/CHECK WORK ORDER/);
  assert.match(world,/Contributors:/);
  assert.match(world,/GET WORK ORDER/);
  assert.match(world,/CONTRIBUTE/);
  assert.match(world,/CLAIM/);
  assert.match(world,/applyGroup:true/);
  assert.match(world,/area action applies to/);
  assert.match(world,/function landClaimUpkeepLine/);
  assert.match(world,/Dormant: abandoned in/);
  assert.match(world,/Active: dormant in/);
  assert.match(world,/claimDormantMat/);
  assert.match(world,/Base setup blocks only count inside editable claimed land/);
  assert.match(world,/toggleLandClaimOverlay\(true\)/);
  assert.match(world,/function landPriceForClaim/);
  assert.match(world,/expansion discount/);
  assert.match(world,/3-tile base goal ready/);
  assert.match(world,/function firstLandClaimGuidanceHTML/);
  assert.match(world,/First claim route/);
  assert.match(world,/Shortfall: /);
  assert.match(world,/Earn gold from Mara quests/);
  assert.match(world,/function landClaimAccessRole/);
  assert.match(world,/must trust you before you can build here/);
  assert.match(world,/land-role/);
  assert.match(menus,/function objectiveCraftRecoveryHint/);
  assert.match(menus,/Recipe blocked:/);
  assert.match(menus,/craft Oak Planks/);
  assert.match(room,/prepareProgressionFocus/);
  assert.match(room,/lifecycleFor/);
  const progressionMixin=fs.readFileSync(path.join(__dirname,'..','rooms','progression.mixin.js'),'utf8');
  assert.match(progressionMixin,/NPC_QUEST_REGISTRY = require\('\.\.\/\.\.\/shared\/npc-quest-chains'\)/);
  assert.match(progressionMixin,/NPC_QUEST_REGISTRY\.createNpcQuestChains\(\{ B: W\.B, I \}\)/);
  assert.match(progressionMixin,/validateNpcQuestChains\(NPC_QUEST_CHAINS\)/);
  assert.match(progressionMixin,/buildRuntimeNpcQuest\(def/);
  assert.match(progressionMixin,/rehydrateNpcQuestFromAuthoring/);
  assert.match(npcQuestRegistry,/replace\(\/\\\{N\\\}\/g/);
  assert.match(npcQuestRegistry,/runtimeQuestMatchesDefinition/);
  assert.match(room,/recordQuestHistory\(client/);
  assert.match(room,/questType/);
  assert.match(room,/aegis:silent_bounty:active/);
  assert.match(room,/PROGRESSION_FOCUS_STATES\.includes\(focus\)/);
  assert.match(room,/rec\.prof\.activeNpcQuest = null/);
  assert.match(room,/focus === 'first_craft_station'/);
  assert.match(room,/W\.B\.PLANKS/);
  assert.match(room,/expirePublicGates/);
  assert.match(room,/noMaterials/);
  assert.match(room,/noGold/);
  assert.match(store,/systemIntroductions/);
  assert.match(store,/function sanitizeQuestHistory\(raw\)/);
  assert.match(store,/questHistory: \[\]/);
  assert.match(store,/sanitizeAegisTrial/);
  assert.match(store,/manhunt/);
  assert.match(store,/progressionMilestoneRewards/);
  assert.match(store,/first_road_ready/);
  assert.match(store,/first_e_gate/);
  assert.match(store,/first_claim_expand/);
  assert.match(store,/first_base_setup/);
  assert.match(earlyLoopE2E,/player-facing early loop tracker gives a clear next action/);
  assert.match(earlyLoopE2E,/function clickTrackerAction/);
  assert.match(earlyLoopE2E,/dispatchEvent\(new MouseEvent\('click'/);
  assert.match(earlyLoopE2E,/craftResult: \{ out: \[13, 1\] \}/);
  assert.match(earlyLoopE2E,/landClaimOverlay\)\)\.toBe\(true\)/);
  assert.match(earlyLoopE2E,/reload preserves the active objective and tracker action/);
  assert.match(earlyLoopE2E,/TURN IN TO MARA/);
  assert.match(earlyLoopE2E,/FIND GATE/);
  assert.match(earlyLoopE2E,/expirePublicGates/);
  assert.match(earlyLoopE2E,/The First Gate/);
  assert.match(earlyLoopE2E,/first_craft_station/);
  assert.match(earlyLoopE2E,/noMaterials: true/);
  assert.match(earlyLoopE2E,/clearInventoryItems/);
  assert.match(earlyLoopE2E,/status\(\)\.menu\.open/);
  assert.match(earlyLoopE2E,/OPEN RECIPE/);
  assert.match(earlyLoopE2E,/noGold: true/);
  assert.match(earlyLoopE2E,/Shortfall/);
  assert.match(earlyLoopE2E,/first_profession_contract/);
  assert.match(earlyLoopE2E,/OPEN JOB BOARD/);
  const transitionE2E=fs.readFileSync(path.join(__dirname,'..','..','e2e','transition-panel-recovery.spec.js'),'utf8');
  assert.match(transitionE2E,/transition panels recover after reload/);
  assert.match(transitionE2E,/expectRecoveryHub/);
  assert.match(transitionE2E,/Recovery Hub/);
  assert.match(transitionE2E,/CHOOSE PATH/);
  assert.match(transitionE2E,/START AWAKENING/);
  assert.match(transitionE2E,/abilityTraining/);
});
