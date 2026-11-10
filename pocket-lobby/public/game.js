'use strict';
const $ = id => document.getElementById(id);
const canvas = $('game');
let ctx = canvas.getContext('2d');
let trainingController=null;
const standardView={width:480,height:310,cols:10,rows:10,originX:240,originY:94};
const hubView={width:720,height:465,cols:18,rows:16,originX:342,originY:115};
const courtyardView={width:600,height:388,cols:14,rows:12,originX:282,originY:108};
let view=standardView;
const point = (x,y,z=0) => [view.originX+(x-y)*18,view.originY+(x+y)*9-z];
const tileKey = (x,y) => x+','+y;
const shades = {
  wood:['#ba754c','#75424a','#995547'], gold:['#ffd289','#9b674f','#c38756'],
  blue:['#6388a7','#36466a','#446082'], trim:['#38516b','#262c47','#303d5d'],
  coral:['#ec998b','#935670','#be6a75'], pink:['#af718b','#634364','#835470'],
  cream:['#ffe0a5','#bd8d71','#e8b182'], green:['#81b486','#365e58','#518366'],
  clay:['#d5896b','#8c4c59','#ab5f5b'], black:['#3d344c','#211f33','#302a43']
};
const types = {...Object.fromEntries(Object.entries(furnitureCatalog).map(([id,item])=>[id,item.name])),moonbloom:'Moonbloom'};
const hairColors = ['#704832','#383848','#a15a39','#d6ac60','#7b638a'];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const STEP_MS = 141, WAVE_MS = 1100;
const defaultAvatar = {name:'Guest',outfit:0,hair:0};
function load(key,fallback) {
  try { return JSON.parse(localStorage.getItem('pocket-lobby:'+key)) ?? fallback; }
  catch { return fallback; }
}
function save(key,value) {
  try { localStorage.setItem('pocket-lobby:'+key,JSON.stringify(value)); } catch {}
}
const classicLounge = [
  ['bar',.05,.25],['shelf',.02,.48],['plant',.3,8.7],['plant',8.9,.2],
  ['sofa',5,1,0],['chair',8,3,1],['table',6,3,0],['lamp',8,1,0],
  ['stool',2,1],['stool',2,2],['stool',2,3],['chair',2,6,1],
  ['table',3,7,1],['chair',4,8,0],['lamp',1,6],['plant',7,8],['plant',.3,7.2]
].map(([type,x,y,rot=0],id)=>({id,type,x,y,rot}));
const gamingTables=[
  {id:'blackjack',type:'blackjack',x:6,y:3,rot:0},
  {id:'roulette',type:'roulette',x:3,y:7,rot:1}
];
const isGamingTable=item=>item.type==='blackjack'||item.type==='roulette';
const initial=[...classicLounge.filter(item=>item.type!=='table'),...gamingTables];
const fixed = item => item.type==='bar'||item.type==='shelf'||isGamingTable(item);
const savedPlayerState = window.towerInitialState??load('player-state',null);
if(savedPlayerState)migrateProgression(savedPlayerState);
const hasGamingLayout=savedPlayerState?.loungeLayout==='gaming';
const savedLounge=savedPlayerState?.furniture??load('room',null);
const retiredTables=hasGamingLayout?[]:(savedLounge??[]).filter(item=>item.type==='table'&&
  classicLounge.some(old=>old.type==='table'&&old.id===item.id&&old.x===item.x&&old.y===item.y&&old.rot===item.rot));
let loungeFurniture=initial;
if(savedLounge)loungeFurniture=hasGamingLayout?savedLounge:installGamingTables(savedLounge.filter(item=>!retiredTables.includes(item)));
let homeFurniture = savedPlayerState?.homeFurniture??[];
const firstUpgrade={unlocked:false,choice:null,complete:false,sale:null,...savedPlayerState?.firstUpgrade};
let tradingPostGuideComplete=savedPlayerState?.tradingPostGuideComplete===true||(savedPlayerState?.location==='market'&&savedPlayerState?.quest?.claimed===true);
let tradeGuideRouteCache=null,upgradeTrackedDestination=null;
let bedLessonComplete=savedPlayerState?.bedLessonComplete===true||homeFurniture.some(item=>item.type==='bed');
let serverActionBusy=false,activityBusy=false,pendingCombatInputs=[],nextCombatPoll=0;
let serverCombatId=savedPlayerState?.combatId,lastCombatReceipt=null;
let combatReports=savedPlayerState?.combatReports??[],activeCombatRecap=null,combatRecapBusy=false,combatRecapKey='';
let credits = savedPlayerState?.credits??100;
let autoJourney=null,autoJourneyState=null,autoJourneyTransition=false;
let autoArrivalKey=null,autoWorkAnimation=null;
let loungeDressGuiding=false;
let goldEarned=savedPlayerState?.goldEarned??0;
function recordGoldEarned(amount){goldEarned=Math.min(Number.MAX_SAFE_INTEGER,goldEarned+amount);}
let displayedCredits=credits,walletTween=null;
const countFurniture = (items,type)=>items.filter(item=>item.type===type).length;
const previousStock = savedPlayerState?.ownedFurniture??{};
const hasBedStarter = Object.hasOwn(previousStock,'bed');
const ownedFurniture=Object.fromEntries(Object.keys(types).map(type=>{
  const placed=countFurniture(homeFurniture,type),oldLounge=savedLounge?countFurniture(savedLounge,type):0;
  return [type,Math.max(previousStock[type]??(type==='bed'?1:0),placed+oldLounge)];
}));
const availableFurniture=type=>(ownedFurniture[type]??0)-countFurniture(homeFurniture,type);
let familiarState=normalizeFamiliars(savedPlayerState?.familiars),selectedWildAnimal=null,wildlifeAffection=null,wildlifeFeedback=null,wildlifeTrialEffect=null;
let familiarReaction=null;
const familiarFollowers=new Map(),familiarPortraits=[];
const renderedActors=[],actorNameplates=new Map();
let lastFamiliarPortraitFrame=0;
const adventure={lantern:false,groveTrail:false,bridge:false,shrine:false,shortcut:false,discovered:[],silverfin:0,...savedPlayerState?.adventure};
let depthsRun=savedPlayerState?.depthsRun??null,depthsExploring=false;
let depthsDiscovered=savedPlayerState?.depthsDiscovered===true||!!depthsRun
  ||savedPlayerState?.hunting?.beetleRespawnAt>0||savedPlayerState?.huntingLoot?.stonebackShell>0
  ||savedPlayerState?.combatGear?.stonebackVestOwned===true;
const playerStats={strengthXp:0,agilityXp:0,vitalityXp:0,luckXp:0,patienceXp:adventure.silverfin*10,...savedPlayerState?.stats};
const PATIENCE_XP_PER_CATCH=10;
const patienceLevel=()=>skillLevel(playerStats.patienceXp);
const maxHealth=()=>100;
let health=Math.min(maxHealth(),Math.max(0,savedPlayerState?.health??maxHealth()));
let playerVitals=normalizeVitals(savedPlayerState?.vitals);
let homeBedRest=savedPlayerState?.bedRest??null,bedRestPolling=false,nextBedPoll=0;
const fishingGear=normalizeFishingGear(savedPlayerState?.fishingGear);
const fishStock={...savedPlayerState?.fishStock};
if(!savedPlayerState?.fishStock&&adventure.silverfin>0)fishStock.silverfin=adventure.silverfin;
delete adventure.silverfin;
const caughtFishCount=()=>Object.values(fishStock).reduce((total,count)=>total+count,0);
const caughtFishValue=()=>Object.entries(fishStock).reduce((total,[id,count])=>total+count*(fishProducts[id]?.price??0),0);
const huntingLoot={rabbit:0,boar:0,deer:0,...savedPlayerState?.huntingLoot};
let meals={...savedPlayerState?.meals};
let magicState=savedPlayerState?.magic?normalizeMagic(savedPlayerState.magic):null;
let characterRules=normalizeCharacterRules(savedPlayerState?.characterRules);
const history=normalizeHistory({...savedPlayerState,stats:playerStats,fishStock,huntingLoot});
const tradeCatalog={
  ...fishProducts,
  rabbit:{name:'Rabbit',price:12,icon:'♧',group:'hunting'},
  boar:{name:'Boar Meat',price:30,icon:'♧',group:'hunting'},
  stonebackShell:{name:huntEnemies.beetle.lootName,price:huntEnemies.beetle.sellPrice,icon:'⬡',group:'hunting'},
  [moonwellShard.id]:{...moonwellShard,icon:'✦',group:'materials'},
  timber:{name:'Timber',price:4,icon:'▤',group:'materials'},
  deer:{name:'Forest deer',price:24,icon:'♧',group:'hunting'}
};
let fishingDuration=4500;
let castProfile=null;
let fishingStarted=null;
let fishingSession=null,catchReveal=null,patienceTween=null;
const woodcutting=normalizeWoodcutting(savedPlayerState?.woodcutting);
let woodSession=null,treeFall=null,lastTreeCountdown=-1,selectedTimber=null;
function timberTree(){return moonwood.layouts.logging.scenery.find(item=>item.type==='timberTree');}
const timberKey=item=>currentRoom+':'+item.x+','+item.y;
const treeState=item=>timberTreeState(woodcutting,Date.now(),timberKey(item));
const focusedTimber=()=>selectedTimber??(currentRoom==='logging'?timberTree():null);
const treeCountdown=item=>item?Math.max(0,Math.ceil((treeState(item).regrowsAt-Date.now())/1000)):0;
function updateTreeStatus(){
  const item=focusedTimber(),seconds=treeCountdown(item);
  $('woodTreeStatus').textContent=seconds?'Tree felled · Regrows in '+seconds+'s':item?'Tree · '+(timberTreeRules.cuts-treeState(item).cuts)+' cuts left':'Click a tree to start chopping.';
  lastTreeCountdown=seconds;
}
function updateWoodPanel(){
  const {level,progress,target}=skillProgress(woodcutting.xp),busy=!!woodSession;
  const logging=currentRoom==='logging',item=focusedTimber();
  const regrowing=!!item&&!!treeState(item).regrowsAt;
  $('woodPanel').hidden=!moonwood.has(currentRoom)||depthsStageIndex(currentRoom)>=0||(!logging&&!woodcutting.axeOwned);
  $('openWorkbench').hidden=!logging;
  $('woodOfflineControls').hidden=!logging;
  $('woodAction').hidden=!logging&&(!woodcutting.equipped?false:!item);
  $('woodInventory').hidden=!woodcutting.axeOwned;
  $('woodInventoryText').textContent='Timber ×'+woodcutting.timber+' · Sell for '+woodRules.price+' gold each at the Trading Post';
  $('woodAxeStatus').textContent=(woodcutting.equipped?'Equipped':'In inventory')+' · Woodcutting '+level+' · '+progress+' / '+target+' XP';
  $('equipAxe').textContent=woodcutting.equipped?'Unequip axe':'Equip axe';$('equipAxe').disabled=busy;
  $('woodSkill').textContent='Woodcutting '+level+' · '+progress+' / '+target+' XP';
  $('woodTimber').textContent=woodcutting.timber+' timber in your bag · '+woodcutting.timber*woodRules.price+' gold value';
  $('woodAction').textContent=!woodcutting.axeOwned?'Meet woodcutter · Free axe':!woodcutting.equipped?'Equip basic axe':busy?'Chopping…':regrowing?'Waiting for regrowth':'Chop timber';
  $('woodAction').disabled=busy||(regrowing&&woodcutting.equipped)||health<=0||woodcutting.timber>=1000000;
  updateTreeStatus();
  $('woodChopProgress').hidden=!busy;
  $('startOfflineWoodcutting').disabled=!woodcutting.axeOwned||!woodcutting.equipped||busy||health<=0||woodcutting.timber>=1000000;
  $('attribute-wood-level').textContent=level;$('attribute-wood-progress').max=target;$('attribute-wood-progress').value=progress;$('attribute-wood-xp').textContent=progress+' / '+target+' XP';
}
function equipAxe(){
  if(!woodcutting.axeOwned||woodSession)return;
  woodcutting.equipped=!woodcutting.equipped;savePlayerState();
}
function cancelWoodcutting(){if(!woodSession)return;woodSession=null;updateWoodPanel();}
async function beginServerChopping(tree){
  try{
    const packet=await serverGameplay('chop',{x:tree.x,y:tree.y});
    restoreServerTimber(packet.state.timberCut,packet.serverTime,tree);
  }catch(error){note(error.message);}
}
function restoreServerTimber(cut,serverTime,tree){
  if(!cut)return;
  selectedTimber=tree;
  Object.assign(player,timberFacing(player,tree));
  woodSession={tree,cutId:cut.id,started:performance.now()+cut.started-serverTime,duration:cut.endsAt-cut.started};
  updateWoodPanel();
}
async function completeServerTimber(session,time){
  if(session.completing||serverActionBusy)return;
  session.completing=true;
  const oldLevel=woodcuttingLevel(woodcutting),key=timberKey(session.tree);
  try{
    const packet=await serverGameplay('cut',{cutId:session.cutId,x:session.tree.x,y:session.tree.y});
    if(woodSession!==session)return;
    const amount=packet.state.timberReceipt.amount,felled=!!treeState(session.tree).regrowsAt;
    woodSession=null;
    if(felled)treeFall={key,started:performance.now(),direction:player.direction==='right'?1:-1};
    else restoreServerTimber(packet.state.timberCut,packet.serverTime,session.tree);
    showTransaction(felled?'Timber! Tree felled':woodcuttingLevel(woodcutting)>oldLevel?'Woodcutting level '+woodcuttingLevel(woodcutting)+'!':'Timber gathered',[
      {icon:'▤',text:'Timber +'+amount},{icon:'✦',text:'+'+woodRules.xp*amount+' Woodcutting XP'}]);
    note(felled?'Timber! The tree will regrow in 30 seconds.':'Timber +'+amount+' · +'+woodRules.xp*amount+' Woodcutting XP.');
    savePlayerState();
  }catch(error){woodSession=null;updateWoodPanel();note(error.message);}
}
function beginChopping(tree=focusedTimber()){
  if(!moonwood.has(currentRoom)||!isTimberTree(tree)||woodSession||unavailable()||health<=0)return;
  if(!woodcutting.axeOwned){note('Meet the woodcutter for your free basic axe.');return;}
  if(!woodcutting.equipped){note('Equip your basic axe in Inventory or the work panel.');return;}
  if(woodcutting.timber>=1000000){note('Sell some timber before gathering more.');return;}
  if(treeState(tree).regrowsAt){note('The tree is regrowing. Try again shortly.');return;}
  if(window.playerCloud?.gameplay){beginServerChopping(tree);return;}
  selectedTimber=tree;
  Object.assign(player,timberFacing(player,tree));
  woodSession={tree,started:performance.now(),duration:choppingDuration(woodcutting)};
  $('woodChopProgress').value=0;
  updateWoodPanel();note('Keep chopping until the tree falls. Walk away to stop.');
}
function updateWoodMoment(time){
  if(moonwood.has(currentRoom)){
    const seconds=treeCountdown(focusedTimber());
    if(seconds!==lastTreeCountdown)updateWoodPanel();
  }
  if(!woodSession)return;
  const progress=Math.max(0,Math.min(1,(time-woodSession.started)/woodSession.duration));
  $('woodChopProgress').value=progress*100;
  if(progress<1)return;
  if(woodSession.cutId){completeServerTimber(woodSession,time);return;}
  const {tree}=woodSession,key=timberKey(tree),oldLevel=woodcuttingLevel(woodcutting);
  const amount=cutTimberTree(woodcutting,Date.now(),key),felled=amount>0&&!!treeState(tree).regrowsAt;
  if(felled){
    treeFall={key,started:time,direction:player.direction==='right'?1:-1};
  }
  woodSession=amount&&!felled&&woodcutting.timber<1000000?{tree,started:time,duration:choppingDuration(woodcutting)}:null;
  if(woodSession)$('woodChopProgress').value=0;
  savePlayerState();
  if(!amount)return;
  const rewards=[{icon:'▤',text:'Timber +'+amount},{icon:'✦',text:'+'+woodRules.xp*amount+' Woodcutting XP'}];
  if(felled&&woodcuttingLevel(woodcutting)>oldLevel)rewards.push({icon:'✦',text:'Woodcutting level '+woodcuttingLevel(woodcutting)});
  showTransaction(felled?'Timber! Tree felled':woodcuttingLevel(woodcutting)>oldLevel?'Woodcutting level '+woodcuttingLevel(woodcutting)+'!':'Timber gathered',rewards);
  note(felled?'Timber! The tree will regrow in 30 seconds.':'Timber +'+amount+' · +'+woodRules.xp*amount+' Woodcutting XP.');
}
function woodAction(){
  if(!moonwood.has(currentRoom))return;
  if(!woodcutting.axeOwned){
    if(currentRoom==='logging')use(roomFurniture().find(item=>item.type==='woodcutter'));
  }
  else if(!woodcutting.equipped)equipAxe();
  else if(focusedTimber())use(focusedTimber());
}
function drawWoodEffects(time){
  const automatic=autoActivityAnimation(time),session=woodSession??(automatic?.task==='woodcutting'?automatic:null);
  if(!session?.tree||reducedMotion.matches)return;
  const phase=((time-session.started)%(session.automatic?1000:700))/(session.automatic?1000:700);
  if(phase<.55||phase>.9)return;
  const scatter=(phase-.55)/.35,side=player.direction==='right'?-1:1;
  const tree=session.tree,[x,y]=point(tree.x+.5,tree.y+.5,12);
  ctx.save();
  try{
    ctx.globalAlpha=1-scatter;ctx.fillStyle='#e3bb83';
    for(let i=0;i<5;i++)ctx.fillRect(Math.round(x+side*(3+scatter*(12+i*3))),Math.round(y-6+scatter*scatter*12-i*2),2,1);
  }finally{ctx.restore();}
}

function drawTimberTree(item,time){
  const tree=treeState(item);
  const [x,y]=point(item.x+.5,item.y+.5);
  const drawTree=()=>moonwood.drawProp(item,time,{...worldDrawing,ctx,reduced:reducedMotion.matches,progress:adventure});
  if(tree.regrowsAt){
    const fall=treeFall?.key===timberKey(item)?Math.min(1,Math.max(0,(time-treeFall.started)/timberTreeRules.fallMs)):1;
    if(fall<1&&!reducedMotion.matches){
      ctx.save();
      try{
        ctx.translate(x,y-5);
        ctx.rotate(treeFall.direction*Math.PI/2*fall*fall);
        ctx.translate(-x,-y+5);
        ctx.globalAlpha=1-Math.max(0,(fall-.7)/.3);
        drawTree();
      }finally{ctx.restore();}
    }
    block(item.x+.30,item.y+.31,.40,.38,0,6,['#ddba84','#785741','#9d7252']);
    rect(x-3,y-7,6,1,'#aa7a50');
    return;
  }
  const phase=woodSession?.tree===item?((time-woodSession.started)%700)/700:0;
  const impact=phase>=.55&&phase<.72&&!reducedMotion.matches;
  ctx.save();
  try{
    if(impact)ctx.translate(player.direction==='right'?1:-1,0);
    drawTree();
    if(tree.cuts||impact){
      const width=Math.min(7,2+tree.cuts*2);
      rect(x-Math.floor(width/2),y-12,width,2,'#eac38b');
      rect(x-Math.floor(width/2),y-10,width,1,'#734d42');
    }
  }finally{ctx.restore();}
}


function craftingState(){return {location:currentRoom,position:{x:player.cx,y:player.cy},woodcutting,ownedFurniture,plan:savedPlayerState?.plan};}
function updateSwordWorkbench(ready){
  const active=combatGear.activeSwordUpgrade;
  const current=weaponProfile('trainingSword',active,combatGear.weaponEnchantments);
  $('swordUpgradeCurrent').textContent=(current.upgradeName??'Standard fittings')+' · '+current.damage+' base damage · '+attackSeconds(current.interval)+' per attack';
  $('swordUpgradeGold').textContent=credits+' gold';
  const choices=$('swordUpgradeChoices');
  choices.replaceChildren();
  for(const [id,upgrade] of Object.entries(swordUpgrades)){
    const owned=combatGear.swordUpgrades?.includes(id),fitted=active===id;
    const card=document.createElement('article');
    card.className='sword-upgrade-card';
    card.dataset.upgrade=id;
    card.tabIndex=-1;
    const title=document.createElement('h4'),stats=document.createElement('p'),cost=document.createElement('small'),button=document.createElement('button');
    title.textContent=upgrade.name;
    stats.textContent=weaponProfile('trainingSword',id,combatGear.weaponEnchantments).damage+' base damage · '+attackSeconds(upgrade.interval)+' per attack';
    cost.textContent=owned?'Crafted · Free to refit':upgrade.timber+' timber + '+upgrade.gold+' gold';
    button.type='button';
    button.textContent=fitted?'Fitted ✓':owned?'Refit for free':'Craft & fit';
    button.disabled=!ready||fitted||(!owned&&(woodcutting.timber<upgrade.timber||credits<upgrade.gold));
    button.setAttribute('aria-label',button.textContent+' · '+upgrade.name);
    button.onclick=()=>makeSwordUpgrade(id);
    card.append(title,stats,cost,button);
    choices.append(card);
  }
}
function makeSwordUpgrade(id){
  if(unavailable()||woodSession)return;
  if(window.playerCloud?.gameplay){
    const owned=combatGear.swordUpgrades?.includes(id);
    serverGameplay('sword',{id}).then(()=>{
      savePlayerState();$('craftStatus').textContent=swordUpgrades[id].name+' fitted.';
      showTransaction('Sword upgrade fitted',[{text:swordUpgrades[id].name,icon:'⚔'}],owned?0:-swordUpgrades[id].gold);
    }).catch(error=>{$('craftStatus').textContent=error.message;});
    return;
  }
  try{
    const state={...craftingState(),credits,combatGear,hunting};
    const result=fitSwordUpgrade(state,id);
    if(!result)return;
    credits=state.credits;
    savePlayerState();
    $('craftStatus').textContent=result.name+' fitted to your Training Sword.';
    const details=[{icon:'⚔',text:result.name+' · Training Sword'}];
    if(result.timber)details.push({icon:'▤',text:'−'+result.timber+' timber'});
    showTransaction(result.timber?'Sword upgrade crafted':'Sword upgrade refitted',details,-result.gold);
    $('swordUpgradeChoices').querySelector('[data-upgrade="'+id+'"]')?.focus();
  }catch(error){$('craftStatus').textContent=error.message;}
}
function updateVestWorkbench(ready){
  const owned=combatGear.stonebackVestOwned;
  const fragments=huntingLoot[stonebackVest.fragment]??0;
  const button=$('craftStonebackVest');
  $('vestMaterials').textContent=owned?'Already crafted · Equip or remove it in Inventory.':fragments+' / 1 Shell Fragment · '+woodcutting.timber+' / '+stonebackVest.timber+' timber';
  button.disabled=!ready||owned||fragments<1||woodcutting.timber<stonebackVest.timber;
  button.textContent=owned?'Crafted ✓':'Craft vest';
}
function makeStonebackVest(){
  if(unavailable()||woodSession)return;
  if(window.playerCloud?.gameplay){
    serverGameplay('vest').then(()=>{
      savePlayerState();$('craftStatus').textContent='Stoneback Vest crafted. Equip it from Inventory.';
      showTransaction('Stoneback Vest crafted',[{icon:'⬡',text:'Stoneback Vest · In inventory'},{icon:'▤',text:'−1 Shell Fragment · −'+stonebackVest.timber+' timber'}]);
    }).catch(error=>{$('craftStatus').textContent=error.message;});return;
  }
  try{
    const crafted=craftStonebackVest({...craftingState(),combatGear,hunting,huntingLoot});
    if(!crafted)return;
    savePlayerState();
    $('craftStatus').textContent='Stoneback Vest crafted. Equip it from Inventory.';
    showTransaction('Stoneback Vest crafted',[
      {icon:'⬡',text:'Stoneback Vest · In inventory'},
      {icon:'▤',text:'−1 Shell Fragment · −'+stonebackVest.timber+' timber'}
    ]);
  }catch(error){$('craftStatus').textContent=error.message;}
}
function updateCharmWorkbench(ready){
  const owned=combatGear.moonwellCharmOwned;
  const shards=huntingLoot[moonwellShard.id]??0;
  const button=$('craftMoonwellCharm');
  $('moonwellCharmBenefit').textContent='Recover '+moonwellCharm.staminaRegen+' more dodge stamina per second.';
  $('moonwellCharmMaterials').textContent=owned?'Crafted · Manage your charm in Inventory.':shards+' / 1 Moonwell Shard · '+woodcutting.timber+' / '+moonwellCharm.timber+' timber';
  button.disabled=!ready||owned||shards<1||woodcutting.timber<moonwellCharm.timber;
  button.textContent=owned?'Crafted ✓':'Craft & equip';
}
async function makeMoonwellCharm(){
  if(unavailable()||woodSession||fishingSession)return;
  try{
    if(window.playerCloud?.gameplay)await serverGameplay('charm');
    else craftMoonwellCharm({...craftingState(),combatGear,huntingLoot});
    savePlayerState();
    $('craftStatus').textContent='Moonwell Charm crafted and equipped.';
    showTransaction('Moonwell Charm equipped',[
      {icon:'✦',text:'+'+moonwellCharm.staminaRegen+' stamina per second'},
      {icon:'▤',text:'−1 Moonwell Shard · −'+moonwellCharm.timber+' timber'}
    ]);
  }catch(error){$('craftStatus').textContent=error.message;}
}
async function toggleMoonwellCharm(){
  if(unavailable()||woodSession||fishingSession||!combatGear.moonwellCharmOwned)return;
  const equipped=!combatGear.moonwellCharmEquipped;
  try{
    if(window.playerCloud?.gameplay)await serverGameplay('wearCharm',{equipped});
    else combatGear.moonwellCharmEquipped=equipped;
    savePlayerState();
    if($('inventoryDialog').open)renderBag();
    note(equipped?'Moonwell Charm equipped. Dodge stamina recovers faster.':'Moonwell Charm removed.');
  }catch(error){note(error.message);}
}
function updateCraftingUI(){
  $('craftTimber').textContent=woodcutting.timber+' timber';
  const ready=isAtWorkbench(craftingState())&&!unavailable()&&!woodSession;
  updateSwordWorkbench(ready);
  updateVestWorkbench(ready);
  updateCharmWorkbench(ready);
  const recipes=$('craftRecipes');recipes.replaceChildren();
  for(const [id,recipe] of Object.entries(craftingRecipes)){
    const card=document.createElement('article');card.className='craft-recipe';card.dataset.recipe=id;card.tabIndex=-1;
    const art=document.createElement('div');art.className='craft-art';art.append(thumbnail(id));
    const name=document.createElement('h3');name.textContent=recipe.name;
    const description=document.createElement('p');description.textContent=recipe.description;
    const cost=document.createElement('b');cost.className='craft-cost';cost.textContent=recipe.cost+' timber';
    const stock=document.createElement('small');stock.textContent=availableFurniture(id)+' in storage';
    const button=document.createElement('button');button.textContent='Craft one';button.disabled=!ready||woodcutting.timber<recipe.cost;
    button.setAttribute('aria-label','Craft '+recipe.name+' for '+recipe.cost+' timber');button.onclick=()=>makeFurniture(id);
    const hint=document.createElement('small');hint.className='craft-hint';hint.textContent=!ready?'Use the workbench to craft.':woodcutting.timber<recipe.cost?'Need '+(recipe.cost-woodcutting.timber)+' more timber':'Added to inventory · Ready to place at home';
    card.append(art,name,description,cost,stock,button,hint);recipes.append(card);
  }
}
let enchantSelection=null,enchantBusy=false;
function openEnchanter(){
  if(unavailable())return;
  if(!isAtEnchanter({location:currentRoom,position:{x:player.cx,y:player.cy}})){note('Visit the Enchanter beside the Armory anvil.');return;}
  if($('merchantDialog').open)$('merchantDialog').close();
  $('enchantFeedback').textContent='';renderEnchanter();$('enchantDialog').showModal();
}
function renderEnchanter(){
  const owned=combatGear.ownedWeapons;
  if(!owned.includes(enchantSelection))enchantSelection=combatGear.equippedWeapon??owned[0];
  const selector=$('enchantWeapon');selector.replaceChildren();
  for(const id of owned){
    const option=document.createElement('option');option.value=id;
    option.textContent=weaponCatalog[id].name+(combatGear.weaponEnchantments?.[id]?' · Enchantment '+combatGear.weaponEnchantments[id]:'');selector.append(option);
  }
  selector.value=enchantSelection;selector.disabled=enchantBusy;
  const id=enchantSelection,level=combatGear.weaponEnchantments?.[id]??0,cost=weaponEnchantments[level];
  const before=weaponProfile(id,combatGear.activeSwordUpgrade,combatGear.weaponEnchantments);
  const future={...combatGear.weaponEnchantments,[id]:Math.min(3,level+1)};
  const after=weaponProfile(id,combatGear.activeSwordUpgrade,future);
  const current=huntingAttributes(playerStats,id,combatGear.activeSwordUpgrade,false,combatGear.weaponEnchantments);
  const next=huntingAttributes(playerStats,id,combatGear.activeSwordUpgrade,false,future);
  $('enchantGold').textContent=credits.toLocaleString()+' gold';
  $('enchantShards').textContent=(huntingLoot[moonwellShard.id]??0)+' Moonwell Shards';
  $('enchantArt').innerHTML=shopItemArt(id);
  $('enchantName').textContent=before.name+' · '+(level?'Enchantment '+level:'Unenchanted');
  $('enchantDamage').textContent=cost?'Weapon damage '+before.damage+' → '+after.damage+' (+2)':'Weapon damage '+before.damage+' · Fully enchanted';
  $('enchantHit').textContent=cost?'Your hit '+current.damage+'–'+(current.damage+4)+' → '+next.damage+'–'+(next.damage+4):'Your hit '+current.damage+'–'+(current.damage+4);
  $('enchantSpeed').textContent=attackSeconds(before.interval)+' per strike'+(before.upgradeName?' · '+before.upgradeName:'');
  for(const [index,upgrade] of weaponEnchantments.entries()){
    const item=$('enchantLevel'+(index+1));
    item.textContent='Level '+(index+1)+' · +'+upgrade.damage+' damage';
    const price=document.createElement('small');price.textContent=upgrade.gold+' gold + '+upgrade.shards+' shard'+(upgrade.shards===1?'':'s');item.append(price);
    item.dataset.earned=String(level>index);item.setAttribute('aria-current',level===index?'step':'false');
  }
  const missing=[],shards=huntingLoot[moonwellShard.id]??0;
  if(cost&&credits<cost.gold)missing.push((cost.gold-credits)+' more gold');
  if(cost&&shards<cost.shards){
    const needed=cost.shards-shards;
    missing.push(needed+' more Moonwell Shard'+(needed===1?'':'s'));
  }
  $('enchantCost').textContent=cost?'Cost for this level · '+cost.gold+' gold + '+cost.shards+' Moonwell Shard'+(cost.shards===1?'':'s'):'All three enchantments complete.';
  $('enchantRequirements').textContent=missing.length?'You need '+missing.join(' and ')+'.':'Moonwell Shards are found in the Sunken Vault.';
  $('enchantBuy').textContent=enchantBusy?'Enchanting…':cost?'Enchant to level '+(level+1):'Fully enchanted';
  $('enchantBuy').disabled=enchantBusy||!cost||missing.length>0||unavailable();
}
async function buyEnchantment(){
  if(enchantBusy||unavailable())return;
  const id=enchantSelection,level=(combatGear.weaponEnchantments?.[id]??0)+1,cost=weaponEnchantments[level-1];
  if(!cost)return;
  const before=weaponProfile(id,combatGear.activeSwordUpgrade,combatGear.weaponEnchantments);
  enchantBusy=true;renderEnchanter();
  try{
    if(window.playerCloud?.gameplay)await serverGameplay('enchant',{id,level});
    else{
      const state={location:currentRoom,position:{x:player.cx,y:player.cy},combatGear,health,credits,hunting,huntingLoot,plan:savedPlayerState?.plan};
      enchantWeapon(state,id,level);credits=state.credits;savePlayerState();
    }
    const after=weaponProfile(id,combatGear.activeSwordUpgrade,combatGear.weaponEnchantments);
    $('enchantFeedback').textContent=after.name+' enchanted to level '+level+'. Damage '+before.damage+' → '+after.damage+'.';
    updateInventory();updateArmoryShop();
    showTransaction('Enchantment complete',[{icon:'⚔',text:after.name+' · Enchantment '+level+' · +2 damage'},{icon:'◆',text:'−'+cost.shards+' Moonwell Shard'+(cost.shards===1?'':'s')}],-cost.gold);
    const preview=$('enchantPreview');preview.classList.remove('enchant-success');void preview.offsetWidth;preview.classList.add('enchant-success');
    setTimeout(()=>preview.classList.remove('enchant-success'),1000);
  }catch(error){$('enchantFeedback').textContent=error.message;}
  finally{enchantBusy=false;renderEnchanter();}
}
function openCrafting(){
  if(!isAtWorkbench(craftingState())||unavailable())return;
  updateCraftingUI();$('craftStatus').textContent='Choose a sword fitting, armor, or a piece of furniture.';
  if(!$('craftDialog').open)$('craftDialog').showModal();
}
function makeFurniture(id){
  if(unavailable()||woodSession)return;
  if(window.playerCloud?.gameplay){
    serverGameplay('furniture',{id}).then(()=>{
      savePlayerState();$('craftStatus').textContent=craftingRecipes[id].name+' crafted! Place it from Inventory at home.';
      showTransaction('Furniture crafted',[{icon:'▤',text:'−'+craftingRecipes[id].cost+' timber'},{icon:'✦',text:craftingRecipes[id].name+' +1 · In inventory'}]);
    }).catch(error=>{$('craftStatus').textContent=error.message;});return;
  }
  try{
    const result=craftFurniture(craftingState(),id);savePlayerState();
    $('craftStatus').textContent=result.name+' crafted! Open Inventory in your home and choose Place.';
    showTransaction('Furniture crafted',[{icon:'▤',text:'−'+result.cost+' timber'},{icon:'✦',text:result.name+' +1 · In inventory'}]);
    $('craftRecipes').querySelector('[data-recipe="'+id+'"]')?.focus({preventScroll:true});
  }catch(error){$('craftStatus').textContent=error.message;}
}

let fishingSound=load('fishing-sound',false)===true;
let lanternLit=false;
let nextId = Math.max(0,...[...loungeFurniture,...homeFurniture].map(item=>item.id).filter(Number.isInteger))+1;
let avatar = {...defaultAvatar,...(savedPlayerState?.avatar??load('avatar',defaultAvatar))};
const wardrobe=normalizeWardrobe(savedPlayerState?.wardrobe,avatar);
let outfitMagic=normalizeOutfitMagic(savedPlayerState?.outfitMagic);
let veilBusy=false,outfitPowerBusy=false;
function updateOutfitPowersHud(now=combatNow()){
 for(const [id,power] of Object.entries(outfitPowers)){
  const button=$(id),worn=wearsClothing(wardrobe,power.item);
  button.hidden=!worn;
  if(!worn)continue;
  const cooldown=Math.ceil((outfitMagic.readyAt[id]-now)/1000);
  const context=power.combat&&!player.inCombat?'In combat':!power.combat&&player.inCombat?'After combat':null;
  const full=!power.combat&&health>=100;
  button.querySelector('.dock-label').textContent=cooldown>0?'Ready in '+cooldown+'s':context??power.name;
  button.disabled=outfitPowerBusy||serverActionBusy||routineControlled()||cooldown>0||!!context||full;
  button.title=power.name+' ('+power.key+') · '+(power.combat?'Restore dodge stamina in combat':'Restore health between fights');
  button.setAttribute('aria-label',button.title);
 }
}
async function useOutfitPower(id){
 if($(id).disabled||outfitPowerBusy||!window.playerCloud?.gameplay)return;
 outfitPowerBusy=true;updateOutfitPowersHud();
 try{
  if(outfitPowers[id].combat){await sendServerCombat(id);return;}
  const before=health;
  await serverGameplay(id);
  showTransaction(outfitPowers[id].name,[{icon:'♥',text:'+'+(health-before)+' HP'}]);
 }catch(error){note(error.message);}
 finally{outfitPowerBusy=false;updateOutfitPowersHud();}
}
function updateVeilHud(now=combatNow()){
 const button=$('veilstep'),wearing=wearsVeilCloak(wardrobe);
 button.hidden=!wearing;
 if(!wearing)return;
 const remaining=Math.ceil((outfitMagic.veilUntil-now)/1000),cooldown=Math.ceil((outfitMagic.veilReadyAt-now)/1000);
 const active=remaining>0;
 $('veilstepState').textContent=active?'Hidden '+remaining+'s':cooldown>0?'Ready in '+cooldown+'s':'Veilstep';
 button.dataset.active=String(active);
 button.disabled=veilBusy||serverActionBusy||routineControlled()||!active&&cooldown>0;
 button.title=active?'End Veilstep (V)':'Veilstep (V) · Hide for 10 seconds or escape combat';
 button.setAttribute('aria-label',button.title);
}
async function useVeilstep(){
 if(!wearsVeilCloak(wardrobe)||veilBusy||$('veilstep').disabled||!window.playerCloud?.gameplay)return;
 veilBusy=true;updateVeilHud();
 try{
  if(player.inCombat){await sendServerCombat('veil');return;}
  const {state}=await serverGameplay('veil');
  if(state.outfitMagic.veilUntil>combatNow())note('Veilstep · Hidden from other players for 10 seconds. Press V again to reappear.');
  else note('Veilstep ended.');
 }catch(error){note(error.message);}
 finally{veilBusy=false;updateVeilHud();}
}

avatar=outfitAppearance(wardrobe,avatar);
let draft;
let messages = [];
let multiplayer=null;
const remotePeers=new Map();
const worldActivityTracker=typeof createWorldActivityTracker==='function'?createWorldActivityTracker(savedPlayerState):null;
const worldFloats=[],worldFloatSeen=new Set();
function addWorldFloat(actor,event){
 if(!event||event.room!==currentRoom||!['gold','loss','push','catch','damage','heal','dodge'].includes(event.kind)||typeof event.id!=='string'||typeof event.label!=='string'||event.label.length>100)return;
 if(actor!=='self'&&!remotePeers.has(actor))return;
 const key=actor+':'+event.id;if(worldFloatSeen.has(key))return;worldFloatSeen.add(key);if(worldFloatSeen.size>500)worldFloatSeen.delete(worldFloatSeen.values().next().value);
 const existing=worldFloats.filter(f=>f.actor===actor);if(existing.length>=4){existing[0].node.remove();worldFloats.splice(worldFloats.indexOf(existing[0]),1);}
 if(worldFloats.length>=80){worldFloats.shift().node.remove();}
 const node=document.createElement('span');node.className='world-float';node.dataset.kind=event.kind;node.textContent=event.label;$('worldFloats').append(node);
 const peer=remotePeers.get(actor);
 worldFloats.push({actor,room:currentRoom,node,started:performance.now(),lane:existing.length%4,anchor:peer?{rx:peer.rx,ry:peer.ry,seat:peer.seat}:null});
 if(event.kind==='damage'&&remotePeers.has(actor))remotePeers.get(actor).hurtUntil=performance.now()+250;
}
function receiveWorldActivity(actor,events){for(const event of events.slice(-16))addWorldFloat(actor,event);}
function updateWorldFloats(time){
 const bounds=canvasBounds(),cx=view.width/2,cy=view.height/2-4;
 for(let i=worldFloats.length-1;i>=0;i--){
  const f=worldFloats[i],age=time-f.started,peer=f.actor==='self'?player:remotePeers.get(f.actor)??f.anchor;
  if(age>1800||f.room!==currentRoom||!peer){f.node.remove();worldFloats.splice(i,1);continue;}
  const [x,y]=peer.seat?seatAnchor(peer.seat):point((f.actor==='self'?player.x:peer.rx)+.5,(f.actor==='self'?player.y:peer.ry)+.5);
  f.node.style.left=Math.round(bounds.x+((x-cx)*zoom+cx)*bounds.scale+(f.lane%2?12:-12))+'px';
  f.node.style.top=Math.round(bounds.y+((y-52-cy)*zoom+cy)*bounds.scale-f.lane*18-(reducedMotion.matches?0:age/55))+'px';
  f.node.style.opacity=String(Math.min(1,(1800-age)/500));
 }
}
function receivePeers(peers){
  const keep=new Set();
  for(const peer of peers.slice(0,20)){
    if(!peer.id||!Number.isFinite(peer.x)||!Number.isFinite(peer.y))continue;
    keep.add(peer.id);const old=remotePeers.get(peer.id);
    if(old)Object.assign(old,peer,{familiar:peer.familiar,familiarName:peer.familiarName});
    else remotePeers.set(peer.id,{...peer,rx:peer.x,ry:peer.y,lastFrame:performance.now()});
  }
  for(const id of remotePeers.keys())if(!keep.has(id))remotePeers.delete(id);
  const state=window.playerCloud?.initial;
  if(isFishingRoom(currentRoom)&&state?.plan?.source==='rules'&&autoTaskFor(state.plan)==='fishing'&&!autoJourney&&multiplayer?.selfId&&[...remotePeers.values()].some(peer=>peer.id<multiplayer.selfId&&peer.x===player.cx&&peer.y===player.cy)){
    const destination=autoWorkTile(state);if(destination?.path.length){autoJourneyState=state;autoJourney={room:currentRoom,blocked:false};route=destination.path;target={x:destination.x,y:destination.y};}
  }
}
function drawRemote(peer,time){
  const [x,y]=peer.seat?seatAnchor(peer.seat):point(peer.rx+.5,peer.ry+.5);
  surface(peer.rx+.2,peer.ry+.25,.6,.55,.2,'#43324452');
  const moving=Math.hypot(peer.x-peer.rx,peer.y-peer.ry)>.03,waveAge=Date.now()-(peer.waveAt??0);
  ctx.save();if((peer.hurtUntil??0)>time)ctx.globalAlpha=.55;
  sprite(ctx,x,y,{outfit:peer.outfit,trousers:peer.trousers,boots:peer.boots,hair:peer.hair},{direction:peer.direction,back:peer.back,cycle:moving?time/STEP_MS:0,seated:!!peer.seat,wave:waveAge>=0&&waveAge<WAVE_MS?waveAge/WAVE_MS:null,sheathed:!!peer.weapon,weaponTier:peer.weapon,vest:peer.armour,fishing:isFishingRoom(currentRoom)&&peer.activity==='fishing'&&!moving?'waiting':null,fishingAge:time,time});
  if(isFishingRoom(currentRoom)&&peer.activity==='fishing'&&!moving)drawFishingMoment(x,y,time,{started:time-2000,castEnds:time-1500,biteAt:Infinity,landAt:Infinity},{y:peer.ry,direction:peer.direction,back:peer.back});
  const familiar=drawFollowingFamiliar(peer.id,peer.familiar,peer.rx,peer.ry,peer.direction,time);
  const activity=peer.activity==='combat'?Array.from({length:5},(_,i)=>peer.health>i*20?'♥':'♡').join(''):peer.activity==='fishing'?'Fishing':peer.activity==='gambling'?'Gambling':'';
  renderedActors.push({id:peer.id,name:peer.name,activity,x,y:y-(peer.seat?30:43),familiar,familiarName:peer.familiarName});
  ctx.restore();
}
function updateActorNameplates(){
 const layer=$('playerLabels'),seen=new Set();
 if(renderedActors.length){
  const p=canvasBounds(),layerBox=layer.getBoundingClientRect(),cx=view.width/2,cy=view.height/2-4;
  const toScreen=(x,y)=>({x:p.left-layerBox.left+p.x+((x-cx)*zoom+cx)*p.scale,y:p.top-layerBox.top+p.y+((y-cy)*zoom+cy)*p.scale});
  const render=(key,name,detail,position,kind,color,action)=>{
   seen.add(key);
   let plate=actorNameplates.get(key);
   if(!plate){
    const node=document.createElement(kind==='enemy-label'?'button':'span');
    if(kind==='enemy-label')node.type='button';
    node.className='player-label '+kind;node.dataset.actor=key;layer.append(node);
    plate={node};actorNameplates.set(key,plate);
   }
   const caption=detail?name+' · '+detail:name;
   if(plate.caption!==caption){plate.caption=caption;plate.node.textContent=caption;plate.node.title=caption;}
   if(color&&plate.color!==color){plate.color=color;plate.node.style.setProperty('--pet-label-color',color);}
   if(kind==='enemy-label'){plate.node.onclick=action;plate.node.disabled=!action;plate.node.dataset.target=String(detail==='Target');}
   plate.node.style.left=Math.round(position.x)+'px';plate.node.style.top=Math.round(position.y)+'px';
  };
  for(const actor of renderedActors){
   const owner=toScreen(actor.x,actor.y);
   if(actor.enemy){render(actor.id,actor.name,actor.detail,owner,'enemy-label',null,actor.action);continue;}
   if(actor.familiar){
    const {id,x,y}=actor.familiar,pet=toScreen(x,y),species=familiars[id];
    const petName=actor.familiarName||species.name;
    const ownerWidth=Math.min(130,((actor.name?.length??5)+(actor.activity?.length??0))*6+14),petWidth=Math.min(130,petName.length*6+19);
    if(Math.abs(owner.x-pet.x)<(ownerWidth+petWidth)/2+3)owner.y=Math.min(owner.y,pet.y-21);
    render(actor.id+':familiar',petName,'',pet,'familiar-label',species.color);
   }
   render(actor.id,actor.name||'Guest',actor.activity,owner,actor.id==='self'?'own-player-label':'remote-player-label');
  }
 }
 for(const [key,plate] of actorNameplates)if(!seen.has(key)){plate.node.remove();actorNameplates.delete(key);}
}

function connectRoom(){
  if(!multiplayer)return;
  const state=window.playerCloud?.initial;
  if(autoJourney||state?.plan&&state.plan.source!=='rules'||state?.report){multiplayer.disconnect();$('networkStatus').textContent='Travelling · Auto Mode';return;}
  if(multiplayer.room===currentRoom&&(multiplayer.connected||multiplayer.connecting))return;
  multiplayer.join(currentRoom);
}
function receiveRoomChat(message){
  if(!message||typeof message.text!=='string'||typeof message.name!=='string')return;
  showMessage(message);showMessage(message,'roomChatMessages');
  if(message.player===multiplayer?.selfId){$('bubble').textContent=message.text;$('bubble').hidden=false;bubbleUntil=performance.now()+4500;}
}
function sendRoomChat(input){
  const text=input.value.trim();if(!text)return;
  if(multiplayer?.sendChat(text))input.value='';else note('Join a shared social room to chat.');
}

const player = {x:5,y:7,cx:5,cy:7,direction:'right',back:false,seat:null,stride:0,waveStarted:null,inCombat:false};
function setPlayerCombat(active){
  player.inCombat=active===true;
  $('healthHud').hidden=!player.inCombat;
  if(!player.inCombat)combatMoveGoal=null;
}
let route=[],step=null,interaction=null,hover=null,hoverItem=null,target=null,combatMoveGoal=null;
const combatGear=normalizeCombatGear(savedPlayerState?.combatGear);
const hunting=normalizeHunting(savedPlayerState?.hunting);
const quest=normalizeQuest(savedPlayerState?.quest);
function lobbyRoutesOpen(){return quest.accepted||adventure.discovered.length>0||history.fishCaught||history.boarDefeated;}
function nearWarden(){return currentRoom==='hub'&&Math.abs(player.cx-10)+Math.abs(player.cy-3)<=1;}
function bedLessonApplies(){return (savedPlayerState?.bedLessonComplete!==undefined||savedPlayerState?.characterCreated===true&&savedPlayerState?.welcomeSeen===true)&&!quest.accepted&&!history.fishCaught&&!history.boarDefeated;}
function needsBedLesson(){return atHome()&&bedLessonApplies()&&!bedLessonComplete&&availableFurniture('bed')>0;}
function updateBedGuide(){
  const visible=atHome()&&bedLessonApplies(),inBag=$('inventoryDialog').open===true;
  $('bedGuide').hidden=!visible||inBag;$('scene').dataset.bedTutorial=String(visible);
  $('railInventory').classList.toggle('tutorial-focus',visible&&!bedLessonComplete&&!editing&&!inBag);
  $('bedInventoryGuide').hidden=!visible||bedLessonComplete;
  $('bagAction').classList.toggle('tutorial-focus',visible&&!bedLessonComplete&&bagSelection==='furniture:bed');
  if(!visible)return;
  const placing=editing&&selection?.type==='bed';
  $('bedGuide').dataset.phase=bedLessonComplete?'complete':placing?'placing':'inventory';
  $('questTracker').hidden=true;$('hudHomeDecor').hidden=true;
  $('bedGuideStep').textContent=bedLessonComplete?'MAKE YOURSELF AT HOME · COMPLETE':placing?'MAKE YOURSELF AT HOME · 3 / 3':'MAKE YOURSELF AT HOME · 1 / 3';
  $('bedGuideTitle').textContent=bedLessonComplete?'Your bed is ready!':placing?'Choose the perfect spot':'Open your inventory';
  $('bedGuideText').textContent=bedLessonComplete?'Nicely done! Head to the lobby and meet the Tower Warden.':placing?'Click a clear floor tile to place your bed. Press R to turn it.':'A free bed is waiting for you. Open your bag to find it.';
  for(const [id,done] of [['bedStepInventory',placing||bedLessonComplete],['bedStepPlace',placing||bedLessonComplete],['bedStepFloor',bedLessonComplete]])$(id).classList.toggle('done',done);
  $('bedGuideAction').hidden=placing;$('bedGuideAction').textContent=bedLessonComplete?'Next: visit the lobby':'Open Inventory';
}
function needsAutoLesson(){return (window.playerCloud?.initial??savedPlayerState)?.autoLesson==='required';}
function updateAutoLessonGuide(){
  const visible=needsAutoLesson()&&!loungeDressGuiding&&quest.accepted&&!routineControlled()&&!player.inCombat&&!editing&&$('bedGuide').hidden&&!document.querySelector('dialog[open]');
  $('autoLessonGuide').hidden=!visible;
  $('autoStart').classList.toggle('tutorial-focus',visible);
  if(visible){$('questTracker').hidden=true;$('contextGuide').hidden=true;}
}
function openAutoLesson(){
  if(player.inCombat||routineControlled()){note('Finish your current activity before setting your first Auto job.');return;}
  window.towerPauseForAccount();
  $('autoLessonStatus').textContent=quest.accepted?'Required quest · Set up once, then choose how you play.':'Meet the Tower Warden in the lobby to start this quest.';
  $('autoLessonStart').disabled=!quest.accepted;
  if(!$('autoLessonDialog').open)$('autoLessonDialog').showModal();
}
let startingAutoLesson=false;
$('autoLessonOpen').onclick=openAutoLesson;
$('autoLessonDialog').oncancel=event=>{if(startingAutoLesson)event.preventDefault();};
$('autoLessonStart').onclick=async()=>{
  if(startingAutoLesson)return;
  startingAutoLesson=true;$('autoLessonStart').disabled=true;$('autoLessonDialog').querySelector('.close').disabled=true;
  $('autoLessonStatus').textContent='Saving your exploration job…';
  try{
    window.towerPauseForAccount();savePlayerState();await window.playerCloud.setupExplorer();
    $('autoLessonDialog').close();updateAutoLessonGuide();
    showTransaction('First Auto job · Quest complete',[{icon:'↻',text:'Explore the map saved · Idle start ON'},{icon:'✦',text:'Take control whenever you want to play.'}]);
  }catch(error){$('autoLessonStatus').textContent=error.message;}
  finally{startingAutoLesson=false;$('autoLessonStart').disabled=false;$('autoLessonDialog').querySelector('.close').disabled=false;}
};
function updateQuestUI(){
  updateBedGuide();updateTradeGuide();updateUpgradeGuide();
  $('resumeUpgradeGuide').hidden=!firstUpgrade.deferred||!(firstUpgrade.unlocked&&!firstUpgrade.complete||firstUpgrade.oakTrialPending||firstUpgrade.ironTrialPending);
  const stage=questStage(quest);
  $('questTracker').hidden=stage===5||currentRoom==='hub'||!$('bedGuide').hidden;
  const routesOpen=lobbyRoutesOpen();
  $('lobbyDestinations').hidden=!routesOpen;
  $('lobbyFirstVisit').hidden=routesOpen;
  $('receptionMessage').hidden=!routesOpen;
  $('openJobBoard').hidden=!routesOpen;
  $('reception').hidden=!routesOpen;
  const objectives=[
    'Your aim: become the richest and most powerful player in the game. Visit the Tower Warden in the Grand Lobby to get started.',
    'Catch fish at Silverfin Pond · '+quest.fish+' / 3 · Moonwood → Glass Creek → Pond',
    'Defeat a Wild Boar · '+quest.boars+' / 1 · Lantern Trail → Bramble Clearing',
    'Sell fish or Boar Meat at the Trading Post in the Tower.',
    'Your tasks are complete. Return to the Tower Warden in the Grand Lobby.',
    'Keep growing your gold: sell fish, timber and hunting spoils at the Trading Post.'
  ];
  $('questTrackerTitle').textContent=stage===5?'First Steps · Complete':'First Steps';
  const checklist='Any order · Fish '+quest.fish+'/3 · Boar '+quest.boars+'/1 · Sale '+(quest.sold?'complete':'needed');
  $('questTrackerText').textContent=stage>0&&stage<4?checklist:objectives[stage];
  $('wardenDirectoryStatus').textContent=stage===0?'First Steps · Quest available':stage===4?'First Steps · Claim your reward':stage===5?'First Steps · Completed':'First Steps · Quest in progress';
  $('wardenMessage').textContent=[
    'Welcome, adventurer! Your aim is to become the richest and most powerful player in the game. Catch fish, chop trees and hunt monsters, then sell what you gather at the Trading Post. Spend wisely on better gear to earn more. Start with these tasks and I will reward you with 75 gold and my blade.',
    'Start at Silverfin Pond. Catch three fish of any quality. Your offline fishing plan counts too.',
    'Now test your courage against a Wild Boar in Bramble Clearing. Equip your sword, and return to the Tower to rest if you are wounded.',
    'Take your spoils to the Moonwood Trading Post. Sell at least one fish or piece of Boar Meat there.',
    'You have earned your place here. Speak to me in the Grand Lobby to receive your gold and Warden’s Blade.',
    'Well done, adventurer. Your Warden’s Blade is yours to keep. May it serve you well in Moonwood.'
  ][stage];
  if(stage>0&&stage<4)$('wardenMessage').textContent='Complete these tasks in any order: catch three fish at Silverfin Pond, defeat a Wild Boar in Bramble Clearing, and sell fish or Boar Meat at the Trading Post. Offline fishing counts too. Come back when all three are done.';
  const rows=[['questFish','Catch 3 fish · '+quest.fish+' / 3',quest.fish===3],['questBoar','Defeat 1 Wild Boar · '+quest.boars+' / 1',quest.boars===1],['questTrade','Sell spoils at the Trading Post',quest.sold],['questReturn','Return to the Tower Warden',quest.claimed]];
  for(let i=0;i<rows.length;i++){
    const [id,text,done]=rows[i];$(id).textContent=(done?'✓ ':'')+text;
    $(id).classList.toggle('done',done);$(id).classList.toggle('current',stage>0&&!done&&(i<3?stage<4:stage===4));
  }
  const canSpeak=nearWarden()&&!unavailable();
  $('questAction').disabled=!canSpeak||![0,4].includes(stage);
  $('questAction').textContent=stage===0?'Accept quest':stage===4?(needsAutoLesson()?'Set your first Auto job':'Claim 75 gold + Warden’s Blade'):stage===5?'Reward received':'Quest in progress';
  $('questStatus').textContent=stage===5?'Reward saved to your character.':!canSpeak?'Visit the Warden in the Grand Lobby to accept or claim your quest.':stage===0?'Only progress made after accepting counts.':stage===4?'Your new blade will be equipped automatically.':checklist;
}
function openQuest(){$('questRewardArt').innerHTML=shopItemArt('wardenSword');updateQuestUI();if(!$('questDialog').open)$('questDialog').showModal();}
function questAction(){
  if(!nearWarden()||unavailable())return;
  if(questStage(quest)===4&&needsAutoLesson()){$('questDialog').close();openAutoLesson();return;}
  if(questStage(quest)===0){
    const unlocksLobby=!lobbyRoutesOpen();
    quest.accepted=true;
    savePlayerState();
    if(unlocksLobby){
      $('questDialog').close();
      note(needsAutoLesson()?'The lobby doors are open. Set your first Auto job, then fish, hunt and trade in any order.':'The lobby doors are open. Fish, hunt and trade in any order.');
    }else note('First Steps accepted. Catch 3 fish, defeat a boar and sell spoils in any order.');
    return;
  }
  if(window.playerCloud?.gameplay){
    const previousLeadership=playerStats.leadershipXp??0;
    serverGameplay('quest').then(()=>{
      savePlayerState();$('questDialog').close();
      const gained=(playerStats.leadershipXp??0)-previousLeadership;
      showTransaction('First Steps complete!',[{icon:'⚔',text:'Warden’s Blade · Equipped'},...(gained>0?[{icon:'⚑',text:'+'+gained+' Leadership XP'}]:[])],firstQuestReward.gold);
    }).catch(error=>note(error.message));
    return;
  }
  if(credits>100000000-firstQuestReward.gold)return;
  const reward=claimFirstQuest(quest);if(!reward)return;
  credits+=reward.gold;
  recordGoldEarned(reward.gold);
  if(!combatGear.ownedWeapons.includes(reward.weapon))combatGear.ownedWeapons.push(reward.weapon);
  combatGear.equippedWeapon=reward.weapon;$('weaponSelect').value='';
  savePlayerState();
  showTransaction('First Steps complete!',[{icon:'⚔',text:'Warden’s Blade · equipped'},{icon:'✦',text:'18 base damage · Thank you, adventurer.'}],reward.gold);
  $('questDialog').close();
  updateTradeGuide();
  note('Quest complete! +75 gold and Warden’s Blade.');
}

function combatNow(){return window.playerCloud?.combatNow?.()??Date.now();}
let combatMessage='',lastCombatUi=0;
let dungeonLootState=normalizeDungeonLoot(savedPlayerState?.dungeonLoot),selectedDungeonRelic=null,activeDungeonDrop=null,dungeonLootBusy=false,lastDungeonLootUi='';
function dungeonLootView(){return {bank:(window.playerCloud?.initial??savedPlayerState)?.bank,stats:playerStats,combatGear,dungeonLoot:dungeonLootState};}
function updateDungeonLootUi(){
  const p=dungeonLootProgress(dungeonLootView()),text=p.complete?'Dungeon arsenal complete · All 3 relics collected':weaponCatalog[p.target].name+' · Guaranteed within '+p.remaining+' more Vault clear'+(p.remaining===1?'':'s');
  $('dungeonRelicEntrance').textContent=text;$('dungeonRelicCamp').textContent=p.complete?'Review dungeon relics':'Relic hunt · '+p.remaining+' clears or fewer';
  const key=JSON.stringify([p,combatGear,playerStats,selectedDungeonRelic,activeDungeonDrop?.id,dungeonLootBusy]);
  if($('dungeonLootDialog').open&&key!==lastDungeonLootUi){lastDungeonLootUi=key;renderDungeonLoot();}
}
function renderDungeonLoot(){
  const p=dungeonLootProgress(dungeonLootView()),id=selectedDungeonRelic??p.target??dungeonRelics[0],comparison=compareDungeonWeapon(dungeonLootView(),id);
  $('dungeonLootTitle').textContent=activeDungeonDrop?'Rare weapon found!':'The dungeon arsenal';
  $('dungeonLootProgress').textContent=p.complete?'All three relics are yours.':weaponCatalog[p.target].name+' · '+p.streak+' / 5 toward a guaranteed drop · At most '+p.remaining+' more Sunken Vault clears';
  $('dungeonLootMeter').value=p.complete?5:p.streak;
  const cloakOwned=wardrobe.owned.includes(veilCloakId);
  $('challengeClothingSources').textContent=Object.values(outfitPowers).map(power=>clothingCatalog[power.item].name+' · '+(wardrobe.owned.includes(power.item)?'Owned':'Defeat the '+power.guardian+' and bank a full Vault clear')).join(' • ');
  $('veilCloakSource').textContent=cloakOwned?'Veilweaver Cloak owned · Add it to an outfit in Inventory.'
    :'Rare clothing · Bank a full Vault clear after defeating the Cache Guardian on the dangerous passage. Veilweaver Cloak has an 8% drop chance and is guaranteed within '+(veilRules.guarantee-outfitMagic.cloakMisses)+' eligible clears.';
  $('dungeonLootInfo').textContent=activeDungeonDrop?(activeDungeonDrop.guaranteed?'Guaranteed drop earned. ':'Lucky drop! ')+'Already added to Inventory. Yours to keep; equipment stays unchanged until you choose.':'Every full Sunken Vault victory has a 15% chance to drop your chosen unowned relic. The fifth clear without a drop guarantees it. Progress carries across visits and target changes. No duplicate drops.';
  const list=$('dungeonLootChoices');list.replaceChildren();for(const weapon of dungeonRelics){const button=document.createElement('button');button.type='button';button.className='relic-choice';button.setAttribute('aria-pressed',String(id===weapon));button.textContent=weaponCatalog[weapon].name+(combatGear.ownedWeapons.includes(weapon)?' · Owned':p.target===weapon?' · Hunting':'');button.onclick=()=>{selectedDungeonRelic=weapon;renderDungeonLoot();};list.append(button);}
  $('dungeonLootArt').innerHTML=shopItemArt(id);$('dungeonLootName').textContent=comparison.item.name;$('dungeonLootTrait').textContent=comparison.item.description;
  $('dungeonLootRequirements').textContent='Requires Strength '+comparison.item.strength+' · Agility '+comparison.item.agility+(vaultedItem('weapon',id)?' · Stored in vault; withdraw to equip':comparison.canEquip?' · Requirements met':' · Train these stats to equip');
  $('dungeonLootCurrent').textContent=comparison.current.name;
  const rows=$('dungeonLootComparison');rows.replaceChildren();for(const [label,key,suffix,lower] of [['Damage / hit','damage','',false],['Attack interval','interval',' ms',true],['Stagger / hit','stagger','',false],['Counter bonus','counter','%',false]]){
    const row=document.createElement('tr');for(const text of [label,comparison.current[key]+suffix,comparison.found[key]+suffix]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}rows.append(row);
  }
  $('dungeonLootTarget').hidden=comparison.owned;$('dungeonLootTarget').textContent=p.target===id?'Selected hunt target':'Hunt this relic';$('dungeonLootTarget').disabled=dungeonLootBusy||p.target===id;
  $('dungeonLootEquip').hidden=!comparison.owned;$('dungeonLootEquip').textContent=combatGear.equippedWeapon===id?'Equipped':'Equip '+comparison.item.name;$('dungeonLootEquip').disabled=dungeonLootBusy||!comparison.canEquip||combatGear.equippedWeapon===id||unavailable();
  $('dungeonLootKeep').textContent=activeDungeonDrop?'Keep current weapon & continue':'Close';
}
function openDungeonLoot(id=null,notice=null){
  if(unavailable()||window.playerCloud?.initial?.plan||window.playerCloud?.initial?.report)return;
  window.towerPauseForAccount();selectedDungeonRelic=id;activeDungeonDrop=notice;$('dungeonLootError').textContent='';renderDungeonLoot();$('dungeonLootDialog').showModal();
}
async function changeDungeonTarget(){
  if(dungeonLootBusy||!selectedDungeonRelic)return;dungeonLootBusy=true;
  try{await serverGameplay('dungeonLootTarget',{id:selectedDungeonRelic});updateDungeonLootUi();}
  catch(error){$('dungeonLootError').textContent=error.message;}
  finally{dungeonLootBusy=false;renderDungeonLoot();}
}
async function closeDungeonLoot(equip=false){
  if(dungeonLootBusy)return;dungeonLootBusy=true;
  try{
    if(equip&&selectedDungeonRelic&&combatGear.ownedWeapons.includes(selectedDungeonRelic)&&canUseWeapon(playerStats,selectedDungeonRelic)){combatGear.equippedWeapon=selectedDungeonRelic;savePlayerState();await window.playerCloud?.flush();}
    if(activeDungeonDrop)await serverGameplay('dungeonLootAck',{id:activeDungeonDrop.id});
    activeDungeonDrop=null;$('dungeonLootDialog').close();updateWeaponInventory();updateCombatPanel();canvas.focus();
  }catch(error){$('dungeonLootError').textContent=error.message;}
  finally{dungeonLootBusy=false;if($('dungeonLootDialog').open)renderDungeonLoot();}
}
let vaultVictoryBusy=false;
function showVaultVictory(){
 if(currentRoom!=='depthsVault'||depthsRun?.cleared!==3||!depthsRun.shardEarned||depthsRun.victorySeen)return false;
 if(document.hidden||player.inCombat||activityBusy||serverActionBusy||document.querySelector('dialog[open]'))return true;
 if(performance.now()-combatArt.victoryAt<1400)return true;
 const haul=depthsSpoils(depthsRun),progress=dungeonLootProgress(dungeonLootView());
 $('vaultVictoryGold').textContent=haul.gold+' gold';
 $('vaultVictoryMaterials').textContent=Object.entries(haul.loot).map(([id,count])=>(tradeCatalog[id]?.name??id)+' ×'+count).join(' · ');
 $('vaultVictoryRelic').textContent=depthsRun.vaultWeapon?'Rare weapon found · '+weaponCatalog[depthsRun.vaultWeapon].name:progress.complete?'All three relics collected':weaponCatalog[progress.target].name+' · '+progress.streak+' / 5 toward a guaranteed relic';
 $('vaultVictoryProgress').value=depthsRun.vaultWeapon||progress.complete?5:progress.streak;
 $('vaultVictoryHunt').textContent=depthsRun.vaultWeapon?(progress.complete?'Relic collection complete':'Relic earned · Next hunt: '+weaponCatalog[progress.target].name+' · 0 / 5'):progress.complete?'Relic collection complete':'Guaranteed within '+progress.remaining+' more Vault clears';
 $('vaultVictoryDialog').showModal();return true;
}
async function closeVaultVictory(){
 if(vaultVictoryBusy)return;vaultVictoryBusy=true;$('vaultVictoryContinue').disabled=true;
 try{if(window.playerCloud?.gameplay)await serverGameplay('vaultVictoryAck');else{depthsRun.victorySeen=true;savePlayerState();}$('vaultVictoryDialog').close();}
 catch(error){$('vaultVictoryError').textContent=error.message;}
 finally{vaultVictoryBusy=false;$('vaultVictoryContinue').disabled=false;}
}
function showPendingDungeonLoot(){
  if(document.hidden||unavailable()||window.playerCloud?.initial?.plan||window.playerCloud?.initial?.report||document.querySelector('dialog[open]'))return;
  const notice=dungeonLootState.notices[0];if(notice)openDungeonLoot(notice.weapon,notice);
}

let combatSoundEnabled=typeof load==='function'?load('combat-sound',false)===true:false;
const combatAudio=typeof createCombatSound==='function'?createCombatSound():{enable(){},play(){}};
const combatArt={strikeAt:-Infinity,castAt:-Infinity,hurtAt:-Infinity,dodgeAt:-Infinity,boarAttackAt:-Infinity,boarHitAt:-Infinity,victoryAt:-Infinity,bursts:[]};
function resetCombatArt(){
  for(const key of Object.keys(combatArt))combatArt[key]=key==='bursts'?[]:-Infinity;
}

const routineControlled=()=>!!autoJourney||!!window.playerCloud?.initial?.plan||!!window.playerCloud?.initial?.report;
const unavailable=()=>routineControlled()||serverActionBusy||activityBusy||player.inCombat||hunting.recoveryUntil>0;
function combatRecapAction(report){
  if(hunting.recoveryUntil)return null;
  if(depthsRun&&depthsStageIndex(currentRoom)>=0){
    if(currentRoom===depthsCacheRoom&&depthsRun.cacheGuardDefeated&&!depthsRun.finds?.includes('essenceCache'))return {type:'cache',label:'Open Essence Cache'};
    return {type:'expedition',label:'Continue expedition'};
  }
  if(health<maxHealth()){
    if(['hub','home'].includes(currentRoom))return {type:'rest',label:'Rest at the Tower'};
    if(hudNextDoor('hub'))return {type:'tower',label:'Return to the Tower'};
  }
  return report.outcome==='victory'?{type:'inventory',label:'Open Inventory'}:null;
}
function renderCombatRecap(report){
  const enemy=huntEnemies[report.enemy]?.name??'Creature',summary=report.summary,rewards=report.rewards;
  $('combatRecapDialog').dataset.outcome=report.outcome;
  $('combatRecapTitle').textContent=({victory:'Victory against ',escaped:'Escaped from ',defeat:'Defeated by '}[report.outcome]??'Encounter with ')+enemy;
  $('combatRecapEmblem').textContent=report.outcome==='victory'?'✦':report.outcome==='escaped'?'↗':'♥';
  $('combatRecapHealth').textContent=health+' / '+maxHealth()+' HP now'+(hunting.recoveryUntil?' · Recovering':'');
  $('combatRecapEndHealth').hidden=health===report.endedHealth;
  $('combatRecapEndHealth').textContent=report.endedHealth+' HP when the encounter ended';
  const list=$('combatRecapRewards');list.replaceChildren();
  const row=text=>{const item=document.createElement('li');item.textContent=text;list.append(item);};
  for(const [id,count] of Object.entries(rewards.loot??{}))row('Inventory · '+(tradeCatalog[id]?.name??id)+' ×'+count);
  const xp=Object.entries(rewards.xp??{}).filter(([,value])=>value>0).map(([key,value])=>'+'+value+' '+({strengthXp:'Strength',agilityXp:'Agility',vitalityXp:'Vitality',leadershipXp:'Leadership'}[key]??key));
  if(xp.length)row('Combat XP · '+xp.join(' · '));
  for(const [form,count] of Object.entries(rewards.stones??{}))row('Inventory · '+stoneForms[form].name+' Awakening Stone ×'+count);
  for(const award of rewards.mastery??[])row(essenceGems[award.gem].name+' Mastery · +'+award.xp+' XP'+(award.leveled?' · Level '+award.level+'!':''));
  if(rewards.held&&(rewards.held.gold||Object.keys(rewards.held.loot).length))row('Unbanked · '+formatDepthsSpoils(rewards.held));
  if(rewards.cacheUnlocked)row('Essence Cache unlocked · '+essenceCacheGold+' gold + an Awakening Stone to collect');
  if(report.lostSpoils&&(report.lostSpoils.gold||Object.keys(report.lostSpoils.loot).length))row('Unbanked spoils lost · '+formatDepthsSpoils(report.lostSpoils));
  if(rewards.weapon)row(weaponCatalog[rewards.weapon].name+' · Rare weapon added to Inventory');
  if(!list.children.length)row('Rewards · 0');
  $('combatRecapSpells').textContent=Object.entries(summary.spells).map(([id,count])=>essencePower(id).name+' ×'+count).join(' · ')||'Recorded spell casts · 0';
  $('combatRecapInterrupts').textContent=summary.interrupts;
  $('combatRecapBlocked').textContent=summary.prevented;
  $('combatRecapDodges').textContent=summary.dodges;
  $('combatRecapAutomatic').textContent=summary.staggers+' stagger breaks · '+summary.weakSpotHits+' weak-spot hits · '+summary.perfectDodges+' perfect dodges · '+summary.counters+' counterattacks · +'+summary.counterBonus+' counter bonus damage · '+summary.automaticDodges+' automatic dodges · '+summary.automaticCasts+' automatic spell casts · '+summary.fleeAttempts+' flee attempts ('+summary.automaticFlees+' automatic)';
  $('combatRecapDuration').textContent=summary.partial?'Recorded from the latest update.':'Encounter duration · '+Math.max(0,Math.round((report.endedAt-summary.startedAt)/1000))+'s';
  const action=combatRecapAction(report);
  $('combatRecapNext').hidden=!action;
  $('combatRecapNext').textContent=action?.label??'';
  $('combatRecapClose').classList.toggle('primary',!action);
}
function showPendingCombatRecap(){
  const state=window.playerCloud?.initial??savedPlayerState??{};
  if(document.hidden||player.inCombat||activityBusy||serverActionBusy||state.plan||state.report)return;
  const dialog=$('combatRecapDialog');
  if(!dialog.open){
    if(document.querySelector('dialog[open]')||!combatReports.length)return;
    activeCombatRecap=combatReports[0];combatRecapKey='';$('combatRecapError').textContent='';
    renderCombatRecap(activeCombatRecap);dialog.showModal();
  }
  const key=[activeCombatRecap.id,health,currentRoom,hunting.recoveryUntil,depthsRun?.cleared,depthsRun?.finds?.join(',')].join('|');
  if(key!==combatRecapKey){combatRecapKey=key;renderCombatRecap(activeCombatRecap);}
}
async function dismissCombatRecap(takeNext=false){
  if(combatRecapBusy||!activeCombatRecap)return;
  combatRecapBusy=true;
  for(const id of ['combatRecapDismiss','combatRecapClose','combatRecapNext'])$(id).disabled=true;
  const report=activeCombatRecap;
  try{
    if(window.playerCloud?.gameplay)await serverGameplay('combatReportAck',{id:report.id});
    else combatReports=combatReports.filter(item=>item.id!==report.id);
    $('combatRecapDialog').close();activeCombatRecap=null;combatRecapKey='';
    const action=takeNext?combatRecapAction(report):null;
    if(action?.type==='cache')$('depthsOpenCache').onclick();
    else if(action?.type==='expedition'){depthsExploring=false;updateDepthsPanel();}
    else if(action?.type==='rest')restAtTower();
    else if(action?.type==='tower')navigateHud('hub');
    else if(action?.type==='inventory')openInventory();
    else canvas.focus();
  }catch(error){$('combatRecapError').textContent=error.message;}
  finally{
    combatRecapBusy=false;
    for(const id of ['combatRecapDismiss','combatRecapClose','combatRecapNext'])$(id).disabled=false;
  }
}
function stopForCombat(){
  route=[];step=null;interaction=null;target=null;
  player.x=player.cx;player.y=player.cy;player.seat=null;player.waveStarted=null;
}
function enterMoonwellDepths(){
  if(currentRoom!=='ruins'||!depthsDiscovered||depthsRun||unavailable()||health<=0||!combatGear.equippedWeapon)return;
  if(window.playerCloud?.gameplay){serverTravel('depthsEnter');return;}
  depthsRun={cleared:0,routeChoice:'pending'};
  enterRoom(depthsStages[0].room);
  note('Moonwell Depths. Your current health carries through all three chambers.');
}
async function chooseDungeonPassage(choice){
  if(unavailable()||serverActionBusy||depthsRun?.routeChoice!=='pending')return;
  const before=health;
  try{
    if(window.playerCloud?.gameplay){
      const packet=await serverGameplay('depthsPassage',{choice});enterRoom(packet.state.location,packet.state.position);
    }else{
      const state={depthsRun,location:currentRoom,health,credits,goldEarned};
      chooseDepthsPassage(state,choice);health=state.health;credits=state.credits;goldEarned=state.goldEarned;
      enterRoom(state.location,state.position);savePlayerState();
    }
    if(choice==='safe')showTransaction('Safe passage',[{icon:'♥',text:health>before?'Restored '+(health-before)+' HP':'Hearts already full'}],depthsSafePassage.gold);
    else note('Dangerous passage. Defeat the elite guardian and open its cache, then continue to Shell Gallery.',8000);
    updatePlayerStats();updateDepthsPanel();
  }catch(error){$('depthsBankError').textContent=error.message;$('depthsBankError').hidden=false;}
}
let visitingDungeonSide=false;
function openDungeonSideChoices(){
  if(unavailable()||currentRoom!=='depthsGallery'||depthsRun?.cleared!==2)return;
  $('sideRoomHealth').textContent=health+' / 100 HP · At risk: '+formatDepthsSpoils(depthsSpoils(depthsRun));
  for(const [id,side] of Object.entries(depthsSideRooms)){
    const button=$('sideVisit'+id[0].toUpperCase()+id.slice(1)),done=id==='rest'?depthsRun.shrineUsed:depthsRun.sideWins?.includes(id);
    const status=done?(id==='rest'?'Blessing used this expedition':id==='trial'&&!depthsRun.finds?.includes('sideSeal')?'Won · Stone waiting to claim':'Cleared · No repeat rewards'):side.danger;
    $('sideStatus'+id[0].toUpperCase()+id.slice(1)).textContent=status;button.disabled=visitingDungeonSide;button.textContent=done?'Revisit room':'Enter '+side.name;
  }
  $('sideRoomError').textContent='';$('depthsSideDialog').showModal();
}
async function visitDungeonSide(id){
  if(unavailable()||visitingDungeonSide)return;visitingDungeonSide=true;
  try{
    if(window.playerCloud?.gameplay){const packet=await serverGameplay('depthsSide',{id});$('depthsSideDialog').close();enterRoom(packet.state.location,packet.state.position);}
    else{const state={location:currentRoom,depthsRun};visitDepthsSide(state,id);$('depthsSideDialog').close();enterRoom(state.location,state.position);savePlayerState();}
  }catch(error){$('sideRoomError').textContent=error.message;note(error.message);}
  finally{visitingDungeonSide=false;}
}
async function useDungeonShrine(){
  if(unavailable())return;const before=health;
  try{
    if(window.playerCloud?.gameplay)await serverGameplay('depthsShrine');else{const state={location:currentRoom,depthsRun,health};useDepthsRest(state);health=state.health;savePlayerState();}
    updatePlayerStats();updateDepthsPanel();showTransaction('Shrine blessing',[{icon:'♥',text:'Restored '+(health-before)+' HP'},{icon:'◈',text:'15 unbanked gold spent · Wallet unchanged'}]);
  }catch(error){note(error.message);}
}
function visitDepthsCache(){
  if(unavailable()||!depthsRun)return;
  const entering=currentRoom!==depthsCacheRoom;
  if(entering&&!canEnterDepthsCache(depthsRun,currentRoom))return;
  const destination=entering?depthsCacheRoom:depthsCacheReturn(depthsRun);
  if(window.playerCloud?.gameplay)serverTravel(entering?'depthsCacheEnter':'depthsCacheLeave');
  else enterRoom(destination,entering?{x:3,y:5}:destination==='depthsGate'?{x:4,y:5}:{x:9,y:5});
}
function revealEssenceCache(){
  const stone=depthsRun?.cacheStone;
  if(!stone)return;
  $('cacheRewardGold').textContent='+'+essenceCacheGold+' gold';
  $('cacheRewardStone').textContent=stoneForms[stone].name+' Awakening Stone';
  $('cacheRewardHelp').textContent=magicState?.picks.length
    ?'Use this stone to awaken a '+stoneForms[stone].power+' power in any bonded Gem. Equip it to Q or E.'
    :'Keep the stone in Inventory. Bond your first Gems at the Moonwell to unlock its magic.';
  $('cacheRewardAwaken').hidden=!magicState?.picks.length;
  $('cacheRewardDialog').showModal();
}
function advanceMoonwellDepths(){
  const index=depthsStageIndex(currentRoom);
  if(unavailable()||depthsSideForRoom(currentRoom)||currentRoom===depthsCacheRoom||!depthsRun||index<0||depthsRun.cleared!==index+1)return;
  if(index===0&&(depthsRun.routeChoice==='pending'||depthsRun.routeChoice==='dangerous'&&!depthsRun.cacheGuardDefeated))return;
  const next=depthsStages[index+1];
  if(next){if(window.playerCloud?.gameplay)serverTravel('depthsNext');else enterRoom(next.room);}
}
function leaveMoonwellDepths(){
  const index=depthsStageIndex(currentRoom);
  if(unavailable()||!depthsRun||index<0)return;
  if(depthsRun.cleared===0){
    if(window.playerCloud?.gameplay){serverTravel('depthsLeave');return;}
    depthsRun=null;
    enterRoom('ruins',{x:5,y:7});
    return;
  }
  if(window.playerCloud?.gameplay){
    const reward=depthsSpoils(depthsRun),previousClothing=new Set(wardrobe.owned);
    serverGameplay('bank').then(result=>{
      depthsRun=null;
      enterRoom(result.state.location,result.state.position);
      const loot=Object.entries(reward.loot).map(([id,count])=>({icon:'✦',text:tradeCatalog[id].name+' ×'+count}));
      const rare=wardrobe.owned.filter(id=>clothingCatalog[id].loot&&!previousClothing.has(id));
      for(const id of rare)loot.push({icon:'◆',text:clothingCatalog[id].name+' · Add it to an outfit in Inventory'});
      showTransaction(rare.length===1?clothingCatalog[rare[0]].name+' found!':rare.length?'Rare clothing found!':'Moonwell Depths spoils banked',loot,reward.gold);
    }).catch(error=>{
      $('depthsBankError').textContent=error.message;
      $('depthsBankError').hidden=false;
    });
    return;
  }
  try{
    const state={depthsRun,location:currentRoom,health,hunting,credits,huntingLoot};
    const spoils=bankDepthsSpoils(state);
    credits=state.credits;recordGoldEarned(spoils.gold);depthsRun=state.depthsRun;
    enterRoom(state.location,state.position);
    const items=Object.entries(spoils.loot).map(([id,count])=>({icon:'✦',text:tradeCatalog[id].name+' ×'+count}));
    showTransaction('Moonwell Depths spoils banked',items,spoils.gold);
    note('Spoils banked. You return to the ruins with your remaining health.');
  }catch(error){
    const feedback=$('depthsBankError');
    feedback.textContent=error.message;
    feedback.hidden=false;
  }
}
function formatDepthsSpoils({gold,loot}){
  const items=Object.entries(loot).map(([id,count])=>tradeCatalog[id].name+' ×'+count);
  return [gold+' gold',...items].join(' · ');
}
function reviewDepthsEntrance(){
  if($('depthsEntrance').hidden)return;
  $('depthsEntryTitle').scrollIntoView({block:'nearest'});
  $('depthsEntryTitle').focus({preventScroll:true});
}
async function examineDepths(item){
  if(unavailable()||!depthsRun)return;
  const find=depthsFinds[item.type],already=depthsRun.finds?.includes(item.type);
  const before=health;
  try{
    if(!already){
      if(window.playerCloud?.gameplay)await serverGameplay('depthsInspect',{id:item.type});
      else{
        const state={depthsRun,location:currentRoom,position:{x:player.cx,y:player.cy},health,credits,goldEarned,magic:magicState};
        inspectDepthsFind(state,item);
        health=state.health;credits=state.credits;goldEarned=state.goldEarned;magicState=state.magic;
      }
      savePlayerState();
    }
    if(item.type==='sluiceLever'&&depthsRun.cleared===1&&depthsRun.routeChoice==='pending')depthsExploring=false;
    updateDepthsPanel();
    if(item.type==='sideSeal'){
      if(already){note('You have already claimed this expedition’s stone.');return;}
      updatePlayerStats();updateEssenceHotbar();showTransaction('Challenge reward claimed',[{icon:'◆',text:'+1 '+stoneForms[depthsRun.sideStone].name+' Awakening Stone · Yours to keep'}]);return;
    }
    if(item.type==='essenceCache'){
      if(already){note('The Essence Cache is empty. You’ve collected this run’s reward.');return;}
      updatePlayerStats();updateEssenceHotbar();
      showTransaction('Essence Cache opened',[{icon:'◆',text:'+1 '+stoneForms[depthsRun.cacheStone].name+' Awakening Stone'}],essenceCacheGold);
      revealEssenceCache();return;
    }
    if(find.healing){
      note(already?'The chest is empty.':find.text+' Restored '+(health-before)+' HP.',7000);
    }else{
      note(find.text,8000);
    }
    if(!already&&find.gold)showTransaction('Hidden cache discovered',[{icon:'✦',text:find.gold+' gold added to unbanked spoils'}]);
  }catch(error){note(error.message,6500);}
}
function updateDepthsPanel(){
  updateDungeonLootUi();
  const index=depthsStageIndex(currentRoom);
  const inDepths=index>=0&&!!depthsRun;
  const showEntrance=currentRoom==='ruins'&&depthsDiscovered&&!unavailable();
  const entrance=$('depthsEntrance');
  entrance.hidden=!showEntrance;
  if(showEntrance){
    const weapon=weaponProfile(combatGear.equippedWeapon,combatGear.activeSwordUpgrade,combatGear.weaponEnchantments);
    $('depthsEntryHealth').textContent=health+' / '+maxHealth()+' HP';
    $('depthsEntryWeapon').textContent=weapon?weapon.name+(weapon.upgradeName?' · '+weapon.upgradeName:''):'None equipped';
    $('depthsEntryArmour').textContent=armourProfile(armourSelection(combatGear))?.name??'None equipped';
    $('depthsEntryReward').textContent=formatDepthsSpoils(depthsSpoils({cleared:depthsStages.length,shardEarned:true}));
    $('depthsShardChoice').textContent='Vault treasure · Sell the Moonwell Shard for '+moonwellShard.price+' gold, or craft a Moonwell Charm with '+moonwellCharm.timber+' timber for +'+moonwellCharm.staminaRegen+' dodge stamina per second.';
    $('depthsEntryAdvice').textContent=!weapon?'Equip a weapon in Inventory to enter.':health<maxHealth()
      ?'Your current health carries in. You can rest at the Tower before entering.'
      :'Elite foes chain attacks. Equip powers, save stamina, and punish recovery openings. Defeat costs unbanked spoils.';
    $('enterDepths').disabled=!weapon||health<=0;
  }

  const sideId=depthsSideForRoom(currentRoom),side=sideId?depthsSideRooms[sideId]:null;
  const cacheRoom=currentRoom===depthsCacheRoom;
  const cleared=inDepths&&!depthsEnemyAvailable(depthsRun,currentRoom);
  const canVisitCache=canEnterDepthsCache(depthsRun,currentRoom);
  const atFork=currentRoom==='depthsGate'&&depthsRun?.cleared===1&&depthsRun.routeChoice==='pending';
  const choosingPassage=atFork&&floodgateOpen(depthsRun);
  const needsSluice=atFork&&!choosingPassage;
  const pendingGuardian=currentRoom==='depthsGate'&&depthsRun?.routeChoice==='dangerous'&&!depthsRun.cacheGuardDefeated;
  $('depthsSideOptions').hidden=unavailable()||currentRoom!=='depthsGallery'||depthsRun?.cleared!==2;
  $('depthsSideReturn').hidden=unavailable()||!side;
  $('depthsShrineUse').hidden=unavailable()||sideId!=='rest';
  $('depthsShrineUse').disabled=health>=100||!!depthsRun?.shrineUsed||depthsSpoils(depthsRun).gold<depthsSideRooms.rest.cost;
  $('depthsShrineUse').textContent=depthsRun?.shrineUsed?'Blessing used this expedition':'Restore up to 30 HP · Spend 15 unbanked gold';
  $('depthsSideClaim').hidden=unavailable()||sideId!=='trial'||!depthsRun?.sideWins?.includes('trial')||!!depthsRun?.finds?.includes('sideSeal');
  $('depthsSideFieldReturn').hidden=!side||unavailable();
  $('depthsFork').hidden=!choosingPassage;
  $('depthsGateLever').hidden=!needsSluice;
  $('depthsMainOptions').hidden=choosingPassage;
  $('depthsExplore').hidden=choosingPassage;
  $('depthsSafeReward').textContent='+'+Math.min(depthsSafePassage.healing,maxHealth()-health)+' HP · +'+depthsSafePassage.gold+' gold';
  $('depthsDangerReward').textContent=essenceCacheGold+' gold + Awakening Stone';
  $('depthsDangerEnemy').textContent='Cache Guardian · '+dungeonEnemyPreview(huntEnemies.cacheGuardian).health+' HP · Elite';
  $('depthsForkSpoils').textContent='Unbanked · '+formatDepthsSpoils(depthsSpoils(depthsRun));
  $('depthsForkBank').textContent='Bank spoils & leave';
  $('depthsSafePassage').disabled=$('depthsDangerPassage').disabled=unavailable();
  $('depthsCacheRoute').hidden=unavailable()||!(cacheRoom||canVisitCache);
  $('depthsCacheRoute').textContent=cacheRoom?(depthsCacheReturn(depthsRun)==='depthsGate'?'Back to Flooded Gate':'Continue to Shell Gallery'):pendingGuardian?'Return to the dangerous passage':'Elite cache · '+essenceCacheGold+' gold + stone';
  $('depthsOpenCache').hidden=!cacheRoom||!cleared||!!depthsRun?.finds?.includes('essenceCache');
  const atCamp=cleared&&!unavailable();
  const canDecide=atCamp&&!depthsExploring;
  $('depthsCampRibbon').hidden=!atCamp||!depthsExploring;
  const decision=$('depthsDecision');
  const newlyCleared=canDecide&&decision.hidden;
  if(!canDecide)$('depthsBankError').hidden=true;
  decision.hidden=!canDecide;
  $('depthsPanel').hidden=!inDepths||atCamp;
  if(!inDepths)return;

  const stage=depthsStages[index];
  const next=cacheRoom||side?null:depthsStages[index+1];
  const spoils=depthsSpoils(depthsRun);
  $('depthsTitle').textContent=side?side.name:cacheRoom?'The Sealed Alcove':stage.name;
  $('depthsStatus').textContent=(side?'Optional side room':cacheRoom?'Optional chamber':'Chamber '+(index+1)+' / '+depthsStages.length)+' · '+health+' / '+maxHealth()+' HP';
  $('depthsSpoils').textContent=spoils.gold?formatDepthsSpoils(spoils):'No unbanked spoils yet.';
  const preview=side?'Return to Shell Gallery to choose another room, face the Vault, or bank your haul.':cacheRoom?'Return to Shell Gallery to continue the expedition.':next?'Next: '+huntEnemies[next.enemy].name+' ('+dungeonEnemyPreview(huntEnemies[next.enemy]).health+' HP) · '+formatDepthsSpoils(depthsStageSpoils(next))+'.':'All three chambers cleared. Bank your spoils to leave the vault.';
  $('depthsPreview').textContent=cleared?preview:roomDetails[currentRoom].description;
  $('depthsRetreat').hidden=unavailable()||depthsRun.cleared!==0;
  $('depthsNext').hidden=!canDecide||!next||atFork||pendingGuardian;
  $('depthsLeave').hidden=!canDecide;
  if(!canDecide)return;

  $('depthsDecisionStep').textContent='MOONWELL DEPTHS · '+depthsRun.cleared+' / '+depthsStages.length+' CLEARED';
  $('depthsDecisionTitle').textContent=side?(sideId==='rest'?'A moment to recover':sideId==='trial'?(depthsRun.finds?.includes('sideSeal')?'Challenge reward collected':'The Awakening Seal is open'):'Treasury secured'):choosingPassage?'Choose your passage':cacheRoom?(depthsRun.finds?.includes('essenceCache')?'Essence Cache collected':'The seal is broken'):needsSluice?'Drain the flooded crossing':(next?stage.name+' cleared':'Expedition complete');
  $('depthsBankNow').textContent=formatDepthsSpoils(spoils);
  $('depthsDecisionHealth').textContent=health+' / '+maxHealth()+' HP · Your health carries into the next fight.';
  if(!next)$('depthsDecisionHealth').textContent=health+' / '+maxHealth()+' HP remaining.';
  $('depthsRisk').hidden=!next||choosingPassage||pendingGuardian;
  $('depthsMeal').hidden=!next||health>=maxHealth()||!Object.values(meals).some(count=>count>0);
  if(next){
    $('depthsNextReward').textContent='Earn '+formatDepthsSpoils(depthsStageSpoils(next));
    $('depthsNextEnemy').textContent=next.name+' · '+huntEnemies[next.enemy].name+' · '+dungeonEnemyPreview(huntEnemies[next.enemy]).health+' HP';
    $('depthsRiskText').textContent='If you fall, you lose the unbanked spoils above. A successful flee returns you to this chamber.';
  }
  if(newlyCleared)$('depthsDecisionTitle').focus({preventScroll:true});
}
function startMonsterEncounter(enemy){
  combatAudio.enable(combatSoundEnabled);
  if(currentRoom!==enemy.room||unavailable())return;
  const index=depthsStageIndex(currentRoom);
  if(index>=0&&!depthsEnemyAvailable(depthsRun,currentRoom))return;
  if(combatGear.equippedWeapon&&!canUseWeapon(playerStats,combatGear.equippedWeapon)){note('Your stats do not meet this weapon’s requirements.');return;}
  if(!combatGear.equippedWeapon){note('Equip your Training Sword in Inventory before hunting.');return;}
  if(health<=0){note('Return to the Tower and rest to restore your hearts.');return;}
  if(index<0&&combatNow()<huntRespawnAt(hunting,enemy)){note('The '+enemy.name+' will return shortly.');return;}
  stopForCombat();resetCombatArt();
  player.direction=(6-player.cx)-(5-player.cy)>=0?'right':'left';player.back=11<player.cx+player.cy;
  if(window.playerCloud?.gameplay){
    serverGameplay('fight').then(packet=>{
      serverCombatId=packet.state.combatId;setPlayerCombat(true);nextCombatPoll=0;canvas.focus({preventScroll:true});
      combatMessage='You engage the '+enemy.name+'. Dodge with Space, or Flee.';
      updateCombatPanel();note('Press Space just before the '+enemyAttack(hunting.encounter,enemy).name+' lands. F flees.');
    }).catch(error=>note(error.message));return;
  }
  hunting.encounter=createHunt(combatNow(),enemy.health,enemy.id);
  setPlayerCombat(true);
  combatMessage='You engage the '+enemy.name+'. Dodge '+enemyAttack(hunting.encounter,enemy).name+' with Space, or Flee.';
  updateCombatPanel();savePlayerState();
  note('Press Space just before the '+enemyAttack(hunting.encounter,enemy).name+' lands. F flees.');
}
function combatAction(action){
  if(routineControlled()){note('Use Take control to stop your routine.');return;}
  combatAudio.enable(combatSoundEnabled);
  if(!player.inCombat||!['flee','dodge'].includes(action))return;
  if(window.playerCloud?.gameplay){sendServerCombat(action);return;}
  const result=huntingTurn(hunting.encounter,health,playerStats,action,combatNow(),Math.random,combatGear.equippedWeapon,combatGear.activeSwordUpgrade,armourSelection(combatGear),combatGear.moonwellCharmEquipped,combatGear.weaponEnchantments);
  if(!result&&action==='dodge'){
    combatMessage=combatStamina(hunting.encounter,playerStats,combatNow(),combatGear.moonwellCharmEquipped)<combatDodgeCost(armourSelection(combatGear))?'Not enough stamina. Let it recover.':'Your dodge is recovering.';
    updateCombatPanel();return;
  }
  applyCombatResult(result);
}
function applyCombatResult(result,authoritative=null,playEffects=true){
  if(!result)return;
  const action=result.action,enemy=huntEnemies[result.enemyId]??(result.targetId?Object.values(addKinds).find(a=>a.id===result.enemyId):null)??huntEnemy(hunting.encounter);
  if(playEffects)recordCombatFx(combatArt,result,performance.now());
  hunting.encounter=result.encounter;health=result.health;
  combatMessage=(result.damage?'You hit for '+result.damage+(result.shellGuarded?' through the shell.':'. '):action==='flee'&&result.outcome!=='escaped'?'Your escape was blocked. ':'')+(result.dodged?'You dodge the attack.':result.taken?(result.move??enemy.name)+' hits for '+result.taken+'.':'');
  if(action==='burn')combatMessage='Burn deals '+result.damage+' damage.';
  if(result.power)combatMessage=result.power+' '+result.effect+'.';
  if(result.weakened)combatMessage+=(combatMessage?' ':'')+'Shadow prevented '+result.weakened+' damage.';
  if(result.warded)combatMessage+=(combatMessage?' ':'')+'Your ward blocked '+result.warded+' damage.';
  if(result.absorbed)combatMessage+=(combatMessage?' ':'')+'Your armour absorbed '+result.absorbed+' damage.';
  if(result.outOfRange)combatMessage='Move closer to strike. Your weapon reaches 2 tiles.';
  if(result.spatialAvoided)combatMessage=result.covered?'Cover blocked the spell.':'You moved clear of the attack!';
  if(result.behaviour)combatMessage=result.behaviour;
  if(result.action==='reinforcements'&&result.spawned)combatMessage='Reinforcements are summoning!';
  if(result.addKill)combatMessage=enemy.name+' defeated.';
  if(result.action==='move')combatMessage='Repositioning · Keep clear of marked tiles.';
  if(result.dodgeStarted)combatMessage='You sidestep. Time your dodge just before the '+enemy.move+' lands!';
  if(result.timedDodge)combatMessage='Perfect dodge! '+(result.shellExposed?'Shell open · ':'')+'Next strike +'+(result.counterPercent??50)+'% damage for 1.8 seconds.';
  if(result.counter)combatMessage='Counterattack! '+result.damage+' damage · +'+result.counterBonus+' bonus.';
  if(result.weakSpot)combatMessage+=' Weak spot · +'+result.staggerBonus+' damage.';
  if(result.staggered){combatMessage+=' Stagger break! Enemy stunned · Weak spot open.';if(playEffects)combatAudio.play('stagger');}
  if(result.phaseChange)combatMessage='Phase '+result.phaseChange.index+' · '+result.phaseChange.name+'. '+result.phaseChange.hint;
  if(result.automaticDodge)combatMessage='Auto dodge · Attack avoided.';
  if(result.decision)combatMessage=result.decision.reason+' '+combatMessage;
  if(result.automatic)combatMessage='Tactic · '+combatMessage;
  if(result.nextMove&&result.outcome==='fighting')combatMessage+=(combatMessage?' ':'')+'Next: '+result.nextMove+'.';
  if(result.taken&&playEffects){
    $('healthHud').classList.remove('injured');void $('healthHud').offsetWidth;$('healthHud').classList.add('injured');
  }
  if(result.outcome!=='fighting')setPlayerCombat(false);
  if(result.outcome==='victory'){
    const [strength,agility,vitality]=enemy.xp;
    if(!authoritative){playerStats.strengthXp+=strength;playerStats.agilityXp+=agility;playerStats.vitalityXp+=vitality;}
    const xpReceipt={icon:'⚔',text:'+'+strength+' Strength XP · +'+agility+' Agility XP · +'+vitality+' Vitality XP'};
    const stoneReceipt=result.stone?[{icon:'◆',text:stoneForms[result.stone].name+' Awakening Stone · +1'}]:[];
    const masteryReceipt=(result.mastery??[]).map(award=>({icon:'◆',text:essenceGems[award.gem].name+' · +'+award.xp+' Mastery XP'}));
    if(depthsRun){
      if(authoritative)depthsRun=authoritative.depthsRun;else clearDepthsStage(depthsRun,currentRoom);
      combatMessage=depthsSideForRoom(currentRoom)?(currentRoom==='depthsTrial'?'Challenge won! Claim the Awakening Seal.':'Treasury secured. Your extra loot is unbanked.'):currentRoom===depthsCacheRoom?'The guardian’s seal is broken. Open the Essence Cache.':depthsRun.cleared===depthsStages.length?'Vault cleared. Bank your spoils.':'Chamber cleared. Bank your spoils or press deeper.';
      showTransaction(currentRoom===depthsCacheRoom?'Essence Cache unlocked':'Chamber cleared',[{icon:'✦',text:currentRoom===depthsCacheRoom?'Open the glowing cache to claim its gold and stone':'Spoils held until you bank them'},xpReceipt,...stoneReceipt,...masteryReceipt]);
    }else{
      if(!authoritative){hunting[enemy.id==='thornBoar'?'thornRespawnAt':enemy.id==='beetle'?'beetleRespawnAt':'respawnAt']=combatNow()+enemy.respawn;
      huntingLoot[enemy.loot]=(huntingLoot[enemy.loot]??0)+1;}
      if(enemy.id==='beetle'&&!depthsDiscovered){
        depthsDiscovered=true;
        showTransaction('Expedition unlocked',[{icon:'✦',text:'Review the Moonwell Depths entrance when you’re ready.'}]);
      }
      if(!authoritative&&enemy.id==='boar'){recordQuest(quest,'boar');history.boarDefeated=true;}
      combatMessage='Victory! '+enemy.lootName+' added to Inventory.';
      const ironTrial=firstUpgrade.ironTrialPending&&enemy.id==='beetle'&&combatGear.equippedWeapon==='ironSword';
      if(ironTrial)firstUpgrade.ironTrialPending=false;
      const receipt=[{icon:'✦',text:enemy.lootName+' ×1 · sell for '+enemy.sellPrice+' gold'},xpReceipt,...stoneReceipt,...masteryReceipt];
      if(ironTrial){
        combatMessage='Iron Sword trial complete! Sell the Shell Fragment for '+enemy.sellPrice+' gold or save it for a Stoneback Vest.';
        receipt.push({icon:'⬡',text:'Or keep it for a Stoneback Vest · add '+stonebackVest.timber+' timber at the Timber Hollow workbench'});
      }
      showTransaction(ironTrial?'Iron Sword trial complete!':enemy.name+' defeated',receipt);
    }
    for(const award of (result.mastery??[]).filter(item=>item.leveled))showTransaction(essenceGems[award.gem].name+' Mastery · Level '+award.level+'!',[{icon:'◆',text:masteryBenefit(award.gem,award.level)}]);
    updateInventory();
  }else if(result.outcome==='escaped'){
    if(authoritative){depthsRun=authoritative.depthsRun??null;enterRoom(authoritative.location,authoritative.position);combatMessage=result.power==='Veilstep'?'Veilstep broke pursuit. You escaped and are briefly hidden.':'You escaped with your remaining hearts.';}
    else if(depthsRun){
      const previous=depthsStages[depthsRun.cleared-1];
      if(previous)enterRoom(previous.room);
      else{depthsRun=null;enterRoom('ruins',{x:5,y:7});}
      combatMessage='You retreat with your remaining health and any earned spoils.';
    }else{
      const beetle=enemy.id==='beetle';
      combatMessage='You escape to '+(beetle?'Glass Creek':'Lantern Trail')+'. Your remaining hearts are saved.';
      if(beetle)enterRoom('creek',{x:10,y:4});
      else enterRoom('trail',{x:7,y:1});
    }
  }else if(result.outcome==='defeat'){
    const lostSpoils=!!depthsRun?.cleared;
    depthsRun=null;
    hunting.recoveryUntil=authoritative?authoritative.hunting.recoveryUntil:combatNow()+boarRules.recovery;
    combatMessage=lostSpoils?'The wardens bring you back. The unbanked spoils from this run were lost.':'The Tower wardens bring you home. Resting restores all five hearts.';
    enterRoom('hub');
  }
  updatePlayerStats();updateCombatPanel();savePlayerState();note(combatMessage);
}
function beginBedRest(item){
  if(health>=100){note('Your hearts are already full. Come back after your next adventure.');return;}
  if(!window.playerCloud?.gameplay){note('Connect to the server to rest in your bed.');return;}
  player.seat=null;
  serverGameplay('bedRest',{id:item.id}).then(()=>{nextBedPoll=performance.now()+700;note('Resting in your '+bedProfiles[item.type].name+'. Get up whenever you’re ready.');}).catch(error=>note(error.message));
}
function updateRiverBenchRest(){
 const seated=currentRoom==='millbrook'&&player.seat?.type==='riverBench';$('riverBenchRestPanel').hidden=!seated;
 if(!seated)return;
 const seconds=Math.max(0,Math.ceil((hunting.recoveryUntil-combatNow())/1000));
 $('riverBenchRestStatus').textContent=seconds?'Recovering · '+seconds+'s · '+health+' / 100 HP':'Fully rested · Enjoy the river';
 $('riverBenchGetUp').disabled=serverActionBusy||activityBusy;
}
async function standFromRiverBench(){
 if(serverActionBusy||activityBusy)return false;
 try{if(currentRoom==='millbrook'&&hunting.recoveryUntil)await serverGameplay('riverRestStop');player.seat=null;updateRiverBenchRest();updateCombatPanel();savePlayerState();return true;}
 catch(error){note(error.message);return false;}
}
$('riverBenchGetUp').onclick=()=>standFromRiverBench();
function updateBedRestPanel(time){
  const panel=$('bedRestPanel');panel.hidden=!homeBedRest;$('hint').classList.toggle('bed-rest-hidden',!!homeBedRest);
  if(!homeBedRest)return;
  for(const id of ['bedGuide','tradeGuide','upgradeGuide','contextGuide'])$(id).hidden=true;
  const projected=bedRestHealth(homeBedRest,combatNow()),rate=bedProfiles[homeBedRest.type].rate;
  $('bedRestTitle').textContent='Resting in your '+bedProfiles[homeBedRest.type].name;
  $('bedRestHealth').textContent=projected+' / 100 HP';$('bedRestProgress').value=projected;
  $('bedRestTime').textContent=projected>=100?'Finishing your rest…':Math.ceil((100-projected)/rate)+'s to full health · '+rate+' HP / sec';
  for(let i=0;i<5;i++)$('bedRestHeart'+i).style.setProperty('--heart-fill',Math.max(0,Math.min(100,(projected-i*20)*5))+'%');
  $('bedRestStop').disabled=serverActionBusy||bedRestPolling;
  if(window.playerCloud?.gameplay&&!bedRestPolling&&!serverActionBusy&&!activityBusy&&time>=nextBedPoll){
    nextBedPoll=time+1000;bedRestPolling=true;
    serverGameplay('recover').catch(error=>note(error.message)).finally(()=>{bedRestPolling=false;nextBedPoll=performance.now()+700;});
  }
}
function restAtTower(){
  if(!['hub','home'].includes(currentRoom)||unavailable()||health>=100)return;
  if(atHome()){const bed=bestHomeBed({homeFurniture,ownedFurniture});if(bed){use(bed);return;}}
  if(window.playerCloud?.gameplay){
    serverGameplay('rest').then(()=>{combatMessage='Resting at the Tower. Your hearts will be restored shortly.';updateCombatPanel();savePlayerState();}).catch(error=>note(error.message));return;
  }
  stopForCombat();hunting.recoveryUntil=combatNow()+boarRules.recovery;
  combatMessage='Resting at the Tower. Your hearts will be restored shortly.';
  updateCombatPanel();savePlayerState();
}
function updateCombatPanel(){
  updateRiverBenchRest();
  const now=combatNow(),encounter=hunting.encounter;
  const status=enemyStatusEffects(encounter,now).map(effect=>effect.name+' '+Math.ceil(effect.remaining/1000)+'s · '+effect.detail).join('  /  ');
  $('enemyEffects').hidden=!status;
  if($('enemyEffects').textContent!==status)$('enemyEffects').textContent=status;
  updateEssenceHotbar(now);
  const staggerEnemy=huntEnemy(encounter),stagger=staggerProfile(staggerEnemy),stunned=!!encounter&&now<encounter.staggerUntil,weak=!!encounter&&now<encounter.staggerWeakUntil,recovering=!!encounter&&now<encounter.staggerResistUntil;
  $('enemyStagger').hidden=!encounter;$('enemyStagger').dataset.state=stunned?'stunned':weak?'weak':recovering?'recovering':'building';
  $('staggerLabel').textContent=stunned?'Staggered! · Weak spot open':weak?'Weak spot · Weapon damage +25%':recovering?'Stagger resistance · '+Math.ceil((encounter.staggerResistUntil-now)/1000)+'s':'Stagger · '+(encounter?.stagger??0)+' / '+stagger.limit;
  $('staggerProgress').max=stagger.limit;$('staggerProgress').value=stunned||weak?stagger.limit:encounter?.stagger??0;$('staggerProgress').setAttribute('aria-valuetext',$('staggerLabel').textContent);
  const enemy=encounter?huntEnemy(encounter):dungeonEnemyPreview(huntEnemyForRoom(currentRoom));
  const stage=depthsStageIndex(currentRoom),chamberCleared=stage>=0&&!depthsEnemyAvailable(depthsRun,currentRoom);
  updateDepthsPanel();
  $('equipStonebackVest').disabled=unavailable();
  $('equipWeapon').disabled=player.inCombat||!canUseWeapon(playerStats,$('weaponSelect').value||combatGear.equippedWeapon||'trainingSword');
  $('wave').disabled=editing||!!fishingSession||!!woodSession||unavailable();
  $('combatPanel').hidden=!enemy||chamberCleared;
  $('scene').classList.toggle('in-combat',player.inCombat);
  $('restAtTower').hidden=!!homeBedRest||!['hub','home'].includes(currentRoom)||health>=100&&!hunting.recoveryUntil;
  $('restAtTower').disabled=!!hunting.recoveryUntil;
  $('restAtTower').textContent=hunting.recoveryUntil?'Resting · '+Math.max(0,Math.ceil((hunting.recoveryUntil-now)/1000))+'s':'Rest · restore hearts';
  const notice=$('combatNotice');
  notice.hidden=!hunting.recoveryUntil||!!homeBedRest||player.seat?.type==='riverBench';
  if(hunting.recoveryUntil)notice.textContent=(currentRoom==='millbrook'?'Resting by the mill · ':'Recovering at the Tower · ')+Math.max(0,Math.ceil((hunting.recoveryUntil-now)/1000))+'s · Five hearts restored after rest';
  const attack=enemyAttack(encounter,enemy);
  const ironTrialFight=firstUpgrade.ironTrialPending&&encounter?.enemy==='beetle'&&combatGear.equippedWeapon==='ironSword';
  if(ironTrialFight){
    const untilSlam=encounter.nextBoarAt-now;
    const exposed=encounter.exposedUntil>now;
    const dodgeNow=untilSlam>0&&untilSlam<=boarRules.dodgeWindow
      &&now>=encounter.nextDodgeAt&&combatStamina(encounter,playerStats,now,combatGear.moonwellCharmEquipped)>=combatDodgeCost(armourSelection(combatGear));
    const cue=dodgeNow?'Dodge '+attack.name+' now! Press Space or tap Dodge.':exposed?'Shell open! Your next auto-strike hits the weak spot.':'Watch for '+attack.name+'. Dodge just before it lands.';
    notice.hidden=false;
    if(notice.textContent!==cue)notice.textContent=cue;
    notice.dataset.cue=dodgeNow?'dodge':exposed?'exposed':'watch';
  }else if(enemy?.elite&&!encounter&&!chamberCleared){
    notice.hidden=false;notice.dataset.cue='watch';
    notice.textContent=enemy.tactic??(enemy.id==='sealGuardian'?'Rune Sentinel · 210 HP · Win and claim 1 guaranteed Awakening Stone.':'Elite guardian · Strike → Runic Slam → open shell. Reward '+essenceCacheGold+' gold + a stone.');
  }else notice.dataset.cue='';
  if(enemy?.id==='depthsGuardian'&&!encounter&&!chamberCleared){notice.hidden=false;notice.textContent='VAULT GUARDIAN · 3 phases: stagger its armour, dodge and counter its blades, then interrupt or dodge its magic.';}
  if(enemy?.tactic&&!hunting.recoveryUntil&&!chamberCleared){notice.hidden=false;notice.textContent=enemy.tactic;}
  if(!enemy||chamberCleared)return;
  const beetle=!!enemy.shellArmor,respawn=stage>=0?0:huntRespawnAt(hunting,enemy);
  $('combatTitle').textContent=enemy.name;
  $('combatChapter').textContent=enemy.archetype?enemy.archetype.toUpperCase()+' · MOONWELL DEPTHS':enemy.elite?'ELITE · ESSENCE CACHE':stage>=0?'MOONWELL DEPTHS':beetle?'MOONWELL RUINS':'FIRST HUNT';
  const [strength,agility,vitality]=enemy.xp;
  $('combatReward').textContent=stage>=0?(magicState?.picks.length?'Combat XP and Awakening Stones are kept after a win. Bank your gold and loot.':'Combat XP is kept after a win. Gold and items are held until you bank them.'):'Victory: '+enemy.lootName+' ×1 · +'+strength+' Strength, +'+agility+' Agility, +'+vitality+' Vitality XP. Sell loot for '+enemy.sellPrice+' gold.';
  if(enemy.id==='sealGuardian')$('combatReward').textContent='Win, then claim 1 guaranteed Awakening Stone from the seal. Claimed stones and earned combat XP are yours to keep.';
  else if(enemy.elite)$('combatReward').textContent='Open the cache after victory for '+essenceCacheGold+' gold + an Awakening Stone. Your collected cache rewards are yours to keep.';
  const approach=$('approachBeetle');
  approach.hidden=(!beetle&&!enemy.archetype&&stage<0)||!!encounter||now<respawn;
  approach.textContent='Approach '+enemy.name;
  approach.disabled=health<=0||unavailable()||!combatGear.equippedWeapon;
  const shell=$('beetleShell');
  shell.hidden=(!beetle&&!enemy.archetype)||now<respawn;
  const opening=Math.max(0,((encounter?.exposedUntil??0)-now)/1000);
  shell.textContent=enemy.archetype==='caster'?'Cast pressure · '+(encounter?.castDeadline===encounter?.nextBoarAt?encounter?.castHits??0:0)+' / 3 hits · Strike during the purple warning':enemy.archetype==='duelist'?'Counter weakness · Perfect dodge → next weapon hit +25% extra':enemy.archetype==='armoured'&&!opening?'Heavy plating · Half damage until stagger breaks the shell':opening?'Weak spot exposed · '+opening.toFixed(1)+'s':enemy.elite?'Armoured shell · Dodge Runic Slam, then attack during recovery. A Storm interrupt opens it early.':'Armored shell · Dodge the slam to expose its weak spot.';
  shell.classList.toggle('exposed',opening>0);
  $('boarProgress').max=enemy.health;
  $('boarProgress').setAttribute('aria-label',enemy.name+' health');
  const remaining=Math.max(0,(encounter?.nextFleeAt??0)-now);
  $('boarHealth').textContent=encounter?encounter.health+' / '+enemy.health+' HP':now<respawn?'Returns in '+Math.ceil((respawn-now)/1000)+'s':enemy.health+' / '+enemy.health+' HP';
  $('boarProgress').value=encounter?.health??(now<respawn?0:enemy.health);
  const counterReady=!!encounter&&now<encounter.counterUntil;
  $('combatAttack').classList.toggle('counter-ready',counterReady);
  $('combatAttack').textContent=counterReady?'Counter ready · +'+(encounter.counterPercent??50)+'%':encounter?(characterRules.combat.enabled?'Auto-attack · Tactics active':'Auto-attacking'):'Auto-attack';
  $('combatFlee').disabled=!encounter||remaining>0;
  const stamina=encounter?combatStamina(encounter,playerStats,now,combatGear.moonwellCharmEquipped):100;
  const dodgeCost=combatDodgeCost(armourSelection(combatGear));
  $('combatStamina').value=stamina;$('combatStaminaValue').textContent=Math.floor(stamina)+' / 100';
  $('combatDodgeHelp').textContent='Dodge costs '+dodgeCost+' stamina'+(armourSelection(combatGear)?' with '+armourProfile(armourSelection(combatGear)).name:'')+'. Dodge just before impact to empower your next strike by '+Math.round((weaponProfile(combatGear.equippedWeapon)?.counterMultiplier??.5)*100)+'%.'+(combatGear.moonwellCharmEquipped?' Moonwell Charm: +'+moonwellCharm.staminaRegen+' stamina per second.':' Agility improves recovery.');
  $('combatDodge').disabled=!encounter||now<(encounter.nextDodgeAt??0)||stamina<dodgeCost;
  const timing=!!encounter&&encounter.nextBoarAt-now>=0&&encounter.nextBoarAt-now<=boarRules.dodgeWindow;
  $('combatDodge').classList.toggle('dodge-ready',timing&&!$('combatDodge').disabled);
  $('combatDodge').textContent=encounter&&stamina<dodgeCost?'Dodge · Low stamina':encounter&&now<(encounter.nextDodgeAt??0)?'Dodge · Recovering':timing?'Dodge now! · Space':'Dodge · Space';
  $('combatCooldown').textContent=encounter?'Next strike '+Math.max(0,(encounter.nextPlayerAt-now)/1000).toFixed(1)+'s · '+attack.name+' '+Math.max(0,(encounter.nextBoarAt-now)/1000).toFixed(1)+'s'+(remaining?' · Flee '+(remaining/1000).toFixed(1)+'s':' · F: Flee'):'Click the '+enemy.name+' to engage. Combat runs in real time.';
  $('combatLog').textContent=combatMessage||'The '+enemy.name+' waits. It attacks when you approach.';
  const weapon=weaponProfile(combatGear.equippedWeapon,combatGear.activeSwordUpgrade,combatGear.weaponEnchantments);
  const attributes=huntingAttributes(playerStats,combatGear.equippedWeapon,combatGear.activeSwordUpgrade,false,combatGear.weaponEnchantments);
  $('combatIntelligence').hidden=!encounter||!characterRules.combat.enabled;
  $('combatIntelligence').textContent=characterRules.combat.enabled?combatStyles[characterRules.combat.style].name+' · '+(encounter?.lastDecision?.reason??'Watching health and enemy warnings.') :'';
  $('combatGuide').textContent=(weapon?.name??'No weapon equipped')+(weapon?.upgradeName?' · '+weapon.upgradeName:'')+' · Attack '+attributes.damage+'–'+(attributes.damage+4)+' every '+attackSeconds(attributes.attackInterval)+' · Dodge '+Math.round(attributes.dodge*100)+'% · Escape '+Math.round(attributes.escape*100)+'% · Armor '+attributes.armor;
  if(stage>=0)$('adventureLandmark').hidden=true;
  else if(beetle)$('adventureLandmark').hidden=!!encounter;
  else{
    $('adventureLandmark').hidden=!!encounter||now<respawn;
    $('adventureLandmark').textContent='Approach boar';
    $('adventureLandmark').disabled=health<=0||unavailable()||!combatGear.equippedWeapon;
  }
}
function familiarSeconds(){return Math.max(0,Math.ceil(((familiarState.readyAt[familiarState.equipped]??0)-combatNow())/1000));}
function canScoutHere(){return moonwood.has(currentRoom)&&!dungeonRooms.includes(currentRoom);}
function foxTargetReady(e=hunting.encounter){
 const add=activeAdd(e),now=combatNow();return !!add&&add.spawnAt<=now&&add.lockedFor===add.attackAt&&add.attackAt>now;
}
function familiarFeedback(message){
 if($('familiarsDialog').open)$('familiarStatus').textContent=message;else note(message);
}
function otterAbilityBlock(session=fishingSession){
 if(familiarState.equipped!=='otter')return 'Equip the Reed Otter first.';
 if(session?.completing)return 'That fish is landing. Try Second Chance on your next bite.';
 return secondChanceBlock(isFishingRoom(currentRoom)&&session?.serverCastId?session:null,performance.now());
}
async function useFamiliar(){
 const id=familiarState.equipped;if(!id||!window.playerCloud?.gameplay)return;
 if(familiarSeconds()){familiarFeedback(familiars[id].ability+' is ready in '+familiarSeconds()+'s.');return;}
 if(id==='fox'){
  if(!player.inCombat||!foxTargetReady()){note('Select a dungeon add during its attack warning.');return;}
  if($('familiarsDialog').open)$('familiarsDialog').close();
  sendServerCombat('familiar');return;
 }
 const session=fishingSession;
 if(id==='otter'){const blocked=otterAbilityBlock(session);if(blocked){familiarFeedback(blocked);return;}}
 try{
  const packet=await serverGameplay('familiarUse',{castId:session?.serverCastId});
  if(id==='otter'&&session&&fishingSession===session&&packet.state.fishingCast){familiarReaction={id,pose:'cast',at:performance.now()};session.bonus=packet.state.fishingCast.bonus;familiarFeedback('Second Chance · +5 bonus Patience XP');}
  if(id==='owl'){familiarReaction={id,pose:'cast',at:performance.now()};if($('familiarsDialog').open)$('familiarsDialog').close();if($('hudMapDialog').open)$('hudMapDialog').close();note(moonTrailActive()?'Trail Memory · Open the map to see scouted routes.':'Moon Sight · Follow the silver marks.');}
 }catch(error){familiarFeedback(error.message);}
}
function drawMoonSight(time){
 const clues=new Set(['lanternStand','moonwell','mothAltar','watchBeacon','meadowCache','grottoCache','watchCache','riverBridge']);
 const markers=[...roomDoors[currentRoom].filter(doorAvailable).map(door=>door.tile),...roomFurniture().filter(item=>clues.has(item.type))];
 for(const {x,y} of markers){
  surface(x+.12,y+.12,.76,.76,1,'#b2baff44','#d6dbff');
  const [px,py]=point(x+.5,y+.5,14+(reducedMotion.matches?0:Math.sin(time/250)*3));
  polygon([[px,py-5],[px+4,py],[px,py+5],[px-4,py]],'#e3e5ff','#909ad6');
 }
}
function renderFamiliars(renaming=null,focusRename=null){
 const cards=$('familiarCards');cards.replaceChildren();familiarPortraits.length=0;
 for(const [id,item] of Object.entries(familiars)){
  const owned=familiarState.owned.includes(id),equipped=familiarState.equipped===id;
  const card=document.createElement('article');card.className='familiar-card';card.dataset.equipped=String(equipped);card.style.setProperty('--familiar-color',item.color);
  const header=document.createElement('header'),art=document.createElement('canvas'),copy=document.createElement('div'),title=document.createElement('h3'),tag=document.createElement('small');
  art.width=84;art.height=66;art.setAttribute('aria-hidden','true');familiarPortraits.push({id,ctx:art.getContext('2d')});drawFamiliarPortrait(familiarPortraits.at(-1),performance.now());
  const customName=familiarState.names[id],name=customName??item.name;
  title.textContent=name;
  const status=equipped?'Equipped':owned?'Bonded':item.unlock;
  tag.textContent=customName?item.name+' · '+status:status;
  const tier=wildlifeHabitats[id].rarity,badge=document.createElement('span');
  badge.className='familiar-rarity';badge.dataset.rarity=tier;badge.textContent=familiarRarities[tier].name;
  copy.append(title,tag,badge);header.append(art,copy);card.append(header);
  for(const [name,detail] of [[item.passive,item.perk],[item.ability,item.detail]]){const p=document.createElement('p'),b=document.createElement('b');b.textContent=name;const description=document.createElement('span');description.textContent=detail;p.append(b,description);card.append(p);}
  const actions=document.createElement('div'),button=document.createElement('button');actions.className='familiar-actions';button.type='button';button.textContent=equipped?'Unequip':owned?'Equip':'Find in reserve';
  button.onclick=async()=>{if(!owned){guideToWildlife(id);return;}try{await serverGameplay('familiarEquip',{id:equipped?null:id});if(!equipped)familiarReaction={id,pose:'bond',at:performance.now()};$('familiarStatus').textContent=equipped?'Familiar unequipped.':name+' equipped.';renderFamiliars();}catch(error){$('familiarStatus').textContent=error.message;}};
  actions.append(button);
  if(owned&&renaming!==id){
   const rename=document.createElement('button');rename.type='button';rename.textContent='Rename';
   rename.setAttribute('aria-label','Rename '+name);rename.onclick=()=>{$('familiarStatus').textContent='';renderFamiliars(id);};actions.append(rename);
   if(focusRename===id)queueMicrotask(()=>rename.focus());
  }
  if(equipped){const use=document.createElement('button');use.type='button';use.textContent=item.ability;use.onclick=()=>useFamiliar();actions.append(use);}
  if(owned)card.append(familiarBondCard(id));
  card.append(actions);
  if(renaming===id&&owned)card.append(familiarNameForm(id,customName,item.name));
  cards.append(card);
 }
}
function familiarBondCard(id){
 const bond=familiarBond(familiarState,id),training=familiarTraining[id];
 const section=document.createElement('section'),heading=document.createElement('b'),progress=document.createElement('progress');
 section.className='familiar-bond';heading.textContent='Rank '+bond.rank+' · '+bond.name;
 progress.value=bond.xp;progress.max=bond.next?.xp??BOND_RANKS.at(-1).xp;
 progress.setAttribute('aria-label',familiars[id].name+' bond XP');
 const xp=document.createElement('small');xp.textContent=bond.next?bond.xp+' / '+bond.next.xp+' Bond XP':'Max bond · Both tricks unlocked';
 const practice=document.createElement('p');practice.textContent=training.practice;
 const tricks=document.createElement('ul');
 for(const [index,trick] of training.tricks.entries()){
  const item=document.createElement('li'),unlocked=bond.rank>=index+2;
  item.dataset.unlocked=String(unlocked);item.textContent=(unlocked?'✓ ':'Rank '+(index+2)+' · ')+trick;tricks.append(item);
 }
 section.append(heading,progress,xp,practice,tricks);return section;
}
function familiarNameForm(id,name,species){
 const form=document.createElement('form'),label=document.createElement('label'),input=document.createElement('input'),save=document.createElement('button'),cancel=document.createElement('button');
 form.className='familiar-name-form';
 input.id='familiarName-'+id;input.maxLength=FAMILIAR_NAME_MAX;input.value=name??'';input.placeholder=species;input.autocomplete='off';
 label.htmlFor=input.id;label.textContent='Name (blank uses species name)';
 save.type='submit';save.textContent='Save name';cancel.type='button';cancel.textContent='Cancel';cancel.onclick=()=>{$('familiarStatus').textContent='';renderFamiliars(null,id);};
 form.append(label,input,save,cancel);
 form.onsubmit=async event=>{
  event.preventDefault();
  save.disabled=cancel.disabled=true;
  try{
   await serverGameplay('familiarRename',{id,name:input.value});
   $('familiarStatus').textContent='Name saved as '+(familiarState.names[id]??species)+'.';
   renderFamiliars(null,id);
  }catch(error){$('familiarStatus').textContent=error.message;save.disabled=cancel.disabled=false;input.focus();}
 };
 queueMicrotask(()=>{input.focus();input.select();});
 return form;
}
$('openFamiliars').onclick=()=>{$('familiarStatus').textContent='';renderFamiliars();if(!$('familiarsDialog').open)$('familiarsDialog').showModal();};

function guideToWildlife(kind){
 $('familiarsDialog').close();
 if(currentRoom===wildlifeRoom){if(kind)seekWildSpecies(kind);return;}
 const path=hudRoute(wildlifeRoom);
 if(!path.length){note('Speak to the Tower Warden to open the outdoor routes.');return;}
 setExplorationDestination(wildlifeRoom);note('Follow the marked route through Lantern Trail to the reserve.');
}
$('familiarReserveRoute').onclick=()=>guideToWildlife();
for(const [id,kind] of [['wildlifeOtter','otter'],['wildlifeFox','fox'],['wildlifeOwl','owl']]){
 $(id).onclick=()=>seekWildSpecies(kind);
}
function seekWildSpecies(kind){
 const animals=wildlifeAnimals(combatNow()).filter(animal=>animal.kind===kind);
 animals.sort((a,b)=>(familiarState.trust[b.id]?.step??0)-(familiarState.trust[a.id]?.step??0)||Math.hypot(a.x-player.cx,a.y-player.cy)-Math.hypot(b.x-player.cx,b.y-player.cy));
 if(animals[0])selectWildAnimal(animals[0].id);
}
function selectWildAnimal(id){
 const animal=wildAnimal(id,combatNow());if(currentRoom!==wildlifeRoom||!animal)return;
 if(selectedWildAnimal!==id)wildlifeFeedback=null;
 selectedWildAnimal=id;
 const {trial}=bondStep(familiarState,animal);
 if(trial){if(!nearWildAnimal(startPosition(),trial.tile))walkTo(trial.tile);return;}
 if(nearWildAnimal(startPosition(),animal))return;
 const candidates=directions.map(([dx,dy])=>({x:Math.round(animal.x)+dx,y:Math.round(animal.y)+dy}));
 const paths=candidates.filter(tile=>!blocked(tile.x,tile.y)).map(tile=>({tile,path:walkingPath(startPosition(),tile)})).filter(p=>p.path);
 paths.sort((a,b)=>a.path.length-b.path.length);if(paths[0])walkTo(paths[0].tile);
}
function updateWildlifeGuide(){
 const guide=$('wildlifeGuide');guide.hidden=currentRoom!==wildlifeRoom;
 if(guide.hidden)return;
 const now=combatNow(),animal=wildAnimal(selectedWildAnimal,now),action=$('wildlifeAction'),gather=$('wildlifeForage'),oddsLabel=$('wildlifeOdds'),calls=$('wildlifeCalls');
 if(!animal){
  $('wildlifeEyebrow').textContent='WILDLIFE RESERVE';$('wildlifeTitle').textContent='Meet the wild animals';
  $('wildlifeHint').textContent='Choose an animal, offer its favorite food, and learn what earns its trust.';
  action.hidden=gather.hidden=oddsLabel.hidden=calls.hidden=$('wildlifeRarity').hidden=true;return;
 }
 const species=familiars[animal.kind],bonded=familiarState.owned.includes(animal.kind);
 const {habitat,trust,stage,trial,waiting,food}=bondStep(familiarState,animal);
 const odds=bondOdds(playerStats,animal.kind,stage,trust.misses);
 oddsLabel.hidden=bonded||!!trial||stage==='echo';
 oddsLabel.textContent=odds.percent+'% success · Lv. '+odds.level+' · Luck '+odds.luck+' · Patience '+odds.patience+(odds.bonus.retry?' · Retry +'+odds.bonus.retry+'%':'');
 oddsLabel.title='Level averages Strength, Agility and Vitality. This attempt: base '+odds.base+'%, level +'+odds.bonus.level+'%, Luck +'+odds.bonus.luck+'%, Patience +'+odds.bonus.patience+'%, retry +'+odds.bonus.retry+'%. Max 97%.';
 const position={x:player.cx,y:player.cy},moving=!!step||route.length>0,busy=moving||serverActionBusy||unavailable();
 const near=nearWildAnimal(position,animal),missingFood=stage==='feed'&&food===0;
 const canEcho=stage==='echo'&&near&&animal.resting&&!waiting&&!bonded;
 calls.hidden=!canEcho;
 if(canEcho)for(const id of ['owlCallTwo','owlCallLongShort','owlCallShortLong'])$(id).disabled=busy;
 const atForage=nearWildAnimal(position,habitat.forage),regrow=Math.max(0,Math.ceil(((familiarState.forage[animal.kind]?.readyAt??0)-now)/1000));
 $('wildlifeEyebrow').textContent=bonded?'BONDED · '+habitat.name:habitat.name.toUpperCase()+' · TRUST '+trust.step+' / '+habitat.steps.length;
 const rarity=$('wildlifeRarity');rarity.hidden=false;
 rarity.dataset.rarity=habitat.rarity;rarity.textContent=familiarRarities[habitat.rarity].name;
 $('wildlifeTitle').textContent=species.name;
 const feedback=wildlifeFeedback?.until>now?wildlifeFeedback.text:null;
 let hint='Let it see you before you reach out.';
 if(bonded)hint='This species is in your Familiars collection.';
 else if(trial)hint=trial.hint;
 else if(missingFood)hint='Gather a '+habitat.food+' from the marked foraging spot.';
 else if(!animal.resting)hint='It is roaming. Wait for its next stop.';
 else if(waiting)hint='You earned trust at this stop. Follow the same animal to its next rest.';
 else if(!near)hint='Walk beside the animal while it is resting.';
 else if(stage==='feed')hint='Offer its favorite food to earn more trust.';
 else if(stage==='echo')hint='The owl calls: '+owlCalls[owlCallFor(animal.id)]+'. Echo that rhythm.';
 else if(stage==='perch')hint='Hold still and let the owl perch on your arm.';
 else if(stage==='bond')hint='It trusts you. Reach out to form a bond.';
 $('wildlifeHint').textContent=feedback??hint;
 action.hidden=bonded||canEcho;action.disabled=busy||!trial&&(!animal.resting||waiting||missingFood);
 action.textContent=trial?(nearWildAnimal(position,trial.tile)?trial.action:'Walk to marked spot'):near?{observe:'Sit quietly',feed:'Offer '+habitat.food,echo:'Echo the owl',perch:'Offer your arm',bond:'Form a bond'}[stage]:'Walk closer';
 gather.hidden=bonded||trust.step>1;gather.disabled=busy||food>=FORAGE_CAP||atForage&&regrow>0;
 gather.textContent=(food>=FORAGE_CAP?habitat.food+' pouch full':atForage?(regrow?'Forage regrows in '+regrow+'s':'Gather '+habitat.food):'Find '+habitat.food)+' · '+food+'/'+FORAGE_CAP;
}
$('wildlifeForage').onclick=async()=>{
 const animal=wildAnimal(selectedWildAnimal,combatNow());
 if(!animal||$('wildlifeForage').disabled||!window.playerCloud?.gameplay)return;
 const habitat=wildlifeHabitats[animal.kind];
 if(!nearWildAnimal({x:player.cx,y:player.cy},habitat.forage)){walkTo(habitat.forage);return;}
 try{
  await serverGameplay('familiarForage',{id:animal.kind});
  wildlifeFeedback={text:'Gathered a '+habitat.food+'.',until:combatNow()+2200};
 }catch(error){wildlifeFeedback={text:error.message,until:combatNow()+3000};}
 updateWildlifeGuide();
};
$('wildlifeAction').onclick=()=>attemptWildlifeTrust();
for(const [button,reply] of [['owlCallTwo','two'],['owlCallLongShort','longShort'],['owlCallShortLong','shortLong']]){
 $(button).onclick=()=>attemptWildlifeTrust(reply);
}
async function attemptWildlifeTrust(reply){
 const animal=wildAnimal(selectedWildAnimal,combatNow());
 if(!animal||serverActionBusy||unavailable()||!window.playerCloud?.gameplay)return;
 const {trust,stage,trial}=bondStep(familiarState,animal),position={x:player.cx,y:player.cy};
 if(reply?$('wildlifeCalls').hidden||step||route.length:$('wildlifeAction').disabled)return;
 if(trial&&!nearWildAnimal(position,trial.tile)){walkTo(trial.tile);return;}
 if(!trial&&!nearWildAnimal(position,animal)){selectWildAnimal(animal.id);return;}
 try{
  await serverGameplay('familiarTame',{id:animal.id,step:trust.step,reply});
  if(!familiarState.owned.includes(animal.kind)&&familiarState.trust[animal.id]?.step===trust.step){
   wildlifeFeedback={text:'It stayed wary. Your trust and treats are safe. Try again at its next rest.',until:combatNow()+5000};
   updateWildlifeGuide();return;
  }
  wildlifeFeedback=null;
  if(trial){
   const message={pebble:'The otter perks up at the ripples. Go back when it rests.',tracks:'The prints turn toward the far edge of the meadow.',trailEnd:'You found where the fox has been playing. Meet it at a rest.',listen:'You heard '+owlCalls[owlCallFor(animal.id)]+'. Go back to the owl and echo it.'}[stage];
   wildlifeFeedback={text:message,until:combatNow()+4500};
   if(stage==='pebble')wildlifeTrialEffect={at:performance.now(),tile:trial.tile};
  }else wildlifeAffection={id:animal.id,at:performance.now()};
  if(familiarState.owned.includes(animal.kind)){
   familiarReaction={id:animal.kind,pose:'bond',at:performance.now()};
   showTransaction('Familiar bonded',[{icon:'✦',text:familiars[animal.kind].name+(familiarState.equipped===animal.kind?' · Equipped':' · Find it in Familiars')}]);
  }
  updateWildlifeGuide();
 }catch(error){wildlifeFeedback={text:error.message,until:combatNow()+3000};updateWildlifeGuide();}
}
function drawFamiliarPortrait(portrait,time){
 const {id,ctx:target}=portrait;
 target.clearRect(0,0,84,66);
 drawFamiliar(target,id,id==='fox'?45:42,57,time,{scale:2,reduced:reducedMotion.matches});
}
function drawFollowingFamiliar(key,id,x,y,direction,time){
 if(!isFamiliar(id)){familiarFollowers.delete(key);return;}
 const side=direction==='left'?1:-1;
 const owner={x,y};
 let follower=familiarFollowers.get(key);
 if(!follower||follower.id!==id||Math.hypot(x-follower.owner.x,y-follower.owner.y)>2){
  follower={id,x:x+side*.64,y:y+.45,owner,dx:-side,dy:0,flipped:side===1,time};
  familiarFollowers.set(key,follower);
 }
 const dx=x-follower.owner.x,dy=y-follower.owner.y,moving=Math.hypot(dx,dy)>.006;
 if(moving){const length=Math.hypot(dx,dy);follower.dx=dx/length;follower.dy=dy/length;}
 // Keep the companion behind and slightly off the path so it clears the player's feet.
 const desiredX=x-follower.dx*.87-follower.dy*.48;
 const desiredY=y-follower.dy*.87+follower.dx*.48;
 const tx=Math.max(-.3,Math.min(view.cols-.6,desiredX)),ty=Math.max(-.3,Math.min(view.rows-.6,desiredY));
 const followX=tx-follower.x,followY=ty-follower.y,distance=Math.hypot(followX,followY);
 const elapsed=Math.min(65,Math.max(0,time-follower.time)),amount=reducedMotion.matches?1:1-Math.exp(-elapsed/115);
 follower.x+=followX*amount;follower.y+=followY*amount;follower.owner=owner;follower.time=time;
 if(distance>.18&&Math.abs(followX-followY)>.09)follower.flipped=followX-followY<0;
 const reaction=key==='self'&&familiarReaction?.id===id?time-familiarReaction.at:Infinity;
 const reacting=reaction>=0&&reaction<950,active=moving||distance>.22;
 const pose=reacting?familiarReaction.pose:active?(id==='owl'?'fly':'walk'):'idle';
 const airborne=id==='owl'&&(active||reacting);
 follower.flight=(follower.flight??0)+(Number(airborne)-(follower.flight??0))*(1-Math.exp(-elapsed/165));
 const [px,py]=point(follower.x+.5,follower.y+.5);
 drawFamiliar(ctx,id,px,py+1,reacting?reaction:time,{flipped:follower.flipped,reduced:reducedMotion.matches,pose,flightBlend:follower.flight});
 const flight=reducedMotion.matches?Number(airborne):follower.flight;
 const height=id==='owl'?23+Math.round(flight*17):id==='fox'?21:17;
 return {id,x:px,y:py-height-(reacting?3:0)};
}

function drawWildAnimal(animal,time){
 const [x,y]=point(animal.x+.5,animal.y+.5);
 const selected=selectedWildAnimal===animal.id,near=nearWildAnimal(player,animal),color=familiars[animal.kind].color;
 if(selected||near)surface(animal.x+.08,animal.y+.08,.84,.84,.7,color+'24',color);
 const age=wildlifeAffection?.id===animal.id?time-wildlifeAffection.at:Infinity;
 const reacting=age>=0&&age<900,pose=reacting?'bond':animal.resting?'idle':animal.kind==='owl'?'fly':'walk';
 drawFamiliar(ctx,animal.kind,x,y+1,reacting?age:time,{flipped:animal.flipped,reduced:reducedMotion.matches,pose});
 const height=animal.kind==='owl'&&pose!=='idle'?47:32;
 if(age>=0&&age<900){
  const top=y-height-5-(reducedMotion.matches?0:age/65);
  ctx.save();ctx.globalAlpha=1-age/900;
  polygon([[x,top+5],[x-5,top],[x-3,top-4],[x,top-2],[x+3,top-4],[x+5,top]],'#fac7a3');ctx.restore();
 }
 if(selected||near){
  const trust=familiarState.trust[animal.id]?.step??0;
  const total=wildlifeHabitats[animal.kind].steps.length;
  for(let i=0;i<total;i++)rect(x-total*3+i*6,y-height,4,3,i<trust?color:'#243948');
 }else if(animal.resting){rect(x-1,y-height,3,3,color);}
 hitboxes.push({item:{type:'wildAnimal',animalId:animal.id},shape:[[x-14,y+5],[x+14,y+5],[x+14,y-height-4],[x-14,y-height-4]]});
}

function updateDungeonArenaHud(){
 const floorCount=$('dungeonEnemyCount');
 floorCount.hidden=!depthsRun||depthsStageIndex(currentRoom)<0;
 if(!floorCount.hidden){
  const encounter=hunting.encounter,adds=(encounter?.adds??[]).filter(add=>add.health>0);
  const alive=(encounter?Number(encounter.health>0):Number(depthsEnemyAvailable(depthsRun,currentRoom)))+adds.length;
  const summoning=adds.filter(add=>add.spawnAt>combatNow()).length;
  floorCount.textContent='Enemies on this floor · '+alive+(summoning?' · '+summoning+' summoning':'');
  floorCount.title='Counts living enemies in this zone, including reinforcements being summoned. More may arrive during combat.';
 }

 const e=hunting.encounter,enemy=e?huntEnemy(e):dungeonEnemyPreview(huntEnemyForRoom(currentRoom)),panel=$('dungeonArenaHud');
 panel.hidden=!depthsRun||!enemy||!depthsEnemyAvailable(depthsRun,currentRoom);if(panel.hidden)return;
 panel.dataset.adds=String(e?.addsVersion===1);
 const selected=e&&activeAdd(e),targetEnemy=selected?addKinds[selected.kind]:enemy;
 $('dungeonEnemyName').textContent=(selected?'Target · ':enemy.elite?'Elite · ':'')+targetEnemy.name;
 const ability=$('dungeonFamiliar'),fox=!!e&&familiarState.equipped==='fox',cooldown=fox?familiarSeconds():0;
 ability.hidden=!fox;ability.disabled=!fox||!!cooldown||!foxTargetReady(e);ability.textContent=cooldown?'Pounce · '+cooldown+'s':'Cinder Pounce';ability.title='Select an add during its attack warning · G';
 const phase=vaultPhase(e);$('dungeonPhase').hidden=!phase;$('dungeonPhase').textContent=phase?'Phase '+phase.index+' · '+phase.name:'';
 $('dungeonStamina').hidden=!e;const stamina=e?combatStamina(e,playerStats,combatNow(),combatGear.moonwellCharmEquipped):100;$('dungeonStaminaBar').value=stamina;$('dungeonStaminaValue').textContent=Math.floor(stamina);
 $('dungeonDodge').title='Costs '+combatDodgeCost(armourSelection(combatGear))+' stamina · Space'+(e?.brainVersion===2?' · Each step costs '+ARENA_STEP_COST:'');
 $('dungeonEnemyHealth').textContent=(selected?.health??e?.health??enemy.health)+' / '+targetEnemy.health;
 $('dungeonEnemyBar').max=targetEnemy.health;$('dungeonEnemyBar').value=selected?.health??e?.health??enemy.health;
 const targets=$('dungeonTargets');targets.hidden=!e?.adds?.length;
 const targetKey=e?.adds?.length?JSON.stringify([e.combatTarget,e.health,e.adds.map(a=>[a.id,a.health,a.spawnAt<=combatNow()])]):'';
 if(targets.dataset.key!==targetKey){targets.dataset.key=targetKey;const focused=document.activeElement?.dataset.target;targets.replaceChildren();
  if(e?.adds?.length){for(const t of [{id:'leader',name:enemy.name,health:e.health,ready:true},...e.adds.map(a=>({id:a.id,name:addKinds[a.kind].name,health:a.health,ready:a.spawnAt<=combatNow()}))]){const b=document.createElement('button');b.type='button';b.dataset.target=t.id;b.textContent=t.ready?t.name+' · '+t.health:t.name+' · Summoning';b.disabled=!t.ready;b.setAttribute('aria-pressed',String((e.combatTarget??'leader')===t.id));b.onclick=()=>sendServerCombat('target',t.id);targets.append(b);if(focused===t.id)b.focus({preventScroll:true});}}
 }
 $('dungeonEngage').hidden=!!e;$('dungeonDodge').hidden=!e;$('dungeonFlee').hidden=!e;
 $('dungeonEngage').disabled=!combatGear.equippedWeapon||unavailable();
 $('dungeonDodge').disabled=$('combatDodge').disabled;$('dungeonFlee').disabled=$('combatFlee').disabled;
 let cue='Approach to fight · Click the floor to explore.';
 if(e){const move=enemyAttack(e),warn=e.nextBoarAt-combatNow()<=move.tell;
  cue=warn?(arenaInDanger(e,move)?'Move out of marked tiles!':'You are clear · Close in after the attack.'):'Click floor / arrows to move · Space to dodge';
  if(Math.hypot(arenaPlayer(e).x-arenaEnemy(e).x,arenaPlayer(e).y-arenaEnemy(e).y)>(e.brainVersion===2?playerMeleeReach(combatGear.equippedWeapon):2.5))cue='Move closer to strike · Watch the marked tiles';
  if(e.brainVersion===2){
   const left=Math.max(0,(e.nextBoarAt-combatNow())/1000);
   if(combatNow()<e.brainRecoveryUntil)cue='Enemy recovering · Close in and punish the opening';
   else if(warn)cue=move.name+' · '+left.toFixed(1)+'s · '+(arenaBehindCover(e,move)?'Cover blocks this spell':arenaInDanger(e,move)?'Move or dodge!':'Clear of this attack');
   else cue=(e.brainCombo?'Follow-up coming · ':'')+'Step '+ARENA_STEP_COST+' stamina · Space: dodge';
  }
 }
 const summoning=e?.adds?.some(a=>a.spawnAt>combatNow()),incoming=e&&addThreats(e,combatNow()).sort((a,b)=>a.actor.attackAt-b.actor.attackAt)[0];
 if(summoning)cue='Reinforcements! · Click an enemy to change target';
 else if(incoming&&incoming.actor.attackAt<e.nextBoarAt)cue=incoming.move.name+' · '+Math.max(0,(incoming.actor.attackAt-combatNow())/1000).toFixed(1)+'s · '+(arenaBehindCover(incoming.encounter,incoming.move)?'Cover blocks this spell':arenaInDanger(incoming.encounter,incoming.move)?'Move or dodge!':'Stay clear of the marked tiles');
 $('dungeonArenaCue').textContent=cue;panel.dataset.danger=String(!!incoming&&arenaInDanger(incoming.encounter,incoming.move)&&!arenaBehindCover(incoming.encounter,incoming.move)||!!e&&e.nextBoarAt-combatNow()<=enemyAttack(e).tell&&arenaInDanger(e,enemyAttack(e))&&!arenaBehindCover(e,enemyAttack(e)));
}
$('dungeonEngage').onclick=()=>{const enemy=huntEnemyForRoom(currentRoom),item=roomFurniture().find(i=>i.type===enemy?.prop);if(item)use(item);};
$('dungeonDodge').onclick=()=>combatAction('dodge');
$('dungeonFamiliar').onclick=()=>useFamiliar();
$('dungeonFlee').onclick=()=>combatAction('flee');

function updateCombatMoment(time){
  updateDungeonArenaHud();
  if(player.inCombat&&hunting.encounter?.arenaVersion===1&&combatMoveGoal&&!step&&!route.length&&!activityBusy&&!serverActionBusy&&combatNow()>=(hunting.encounter.arenaStepAt??0)&&(hunting.encounter.brainVersion!==2||combatStamina(hunting.encounter,playerStats,combatNow(),combatGear.moonwellCharmEquipped)>=ARENA_STEP_COST)){
    const p=arenaPlayer(hunting.encounter);
    if(p.x===combatMoveGoal.x&&p.y===combatMoveGoal.y)combatMoveGoal=null;
    else{const path=walkingPath(p,combatMoveGoal);if(path?.length){sendServerCombat('move',path[0]);return;}else combatMoveGoal=null;}
  }
  if(routineControlled()){if(time-lastCombatUi>100){lastCombatUi=time;updateCombatPanel();}return;}
  if(window.playerCloud?.gameplay){
    const tactic=nextCombatTactic({hunting,health,vitals:playerVitals,stats:playerStats,combatGear,magic:magicState,characterRules});
    const due=hunting.encounter?Math.min(addDueAt(hunting.encounter),hunting.encounter.nextPlayerAt,hunting.encounter.nextBoarAt,hunting.encounter.burn?.nextAt??Infinity,hunting.encounter.brainVersion===2?hunting.encounter.brainNextThinkAt:Infinity,arenaWarningAt(hunting.encounter,enemyAttack(hunting.encounter)),tactic?.at??Infinity):Infinity;
    if(player.inCombat&&combatNow()>=due&&time>=nextCombatPoll)sendServerCombat();
    if(!homeBedRest&&hunting.recoveryUntil&&combatNow()>=hunting.recoveryUntil&&!serverActionBusy&&!activityBusy){
      serverGameplay('recover').then(()=>{updatePlayerStats();updateCombatPanel();savePlayerState();}).catch(error=>note(error.message));
    }
    if(time-lastCombatUi>100){lastCombatUi=time;updateCombatPanel();}
    return;
  }
  if(player.inCombat)applyCombatResult(advanceHunt(hunting.encounter,health,playerStats,combatNow(),Math.random,combatGear.equippedWeapon,combatGear.activeSwordUpgrade,armourSelection(combatGear),combatGear.moonwellCharmEquipped,combatGear.weaponEnchantments));
  if(hunting.recoveryUntil&&combatNow()>=hunting.recoveryUntil){
    hunting.recoveryUntil=0;health=100;
    combatMessage='All five hearts restored. You are ready to explore again.';
    updatePlayerStats();savePlayerState();note(combatMessage);
  }
  if(time-lastCombatUi>100){lastCombatUi=time;updateCombatPanel();}
}
let editing=false,selection=null,zoom=1,hitboxes=[],bounds=null,bubbleUntil=0,noticeUntil=0;
const hubFurniture=[
  ['reception',3,2],['warden',10,3],['factionRegistrar',factionRegistrar.x,factionRegistrar.y],
  ['plant',1,1],['plant',16,1],
  ['sofa',2,10],['bench',2,12],
  ['sofa',13,8,2]
].map(([type,x,y,rot=0],id)=>({id,type,x,y,rot}));
const courtyardFurniture=[
  ['trainingDummy',9,4],
  ['fountain',6,5],['streetlamp',1,3],['streetlamp',1,8],['streetlamp',11,1],
  ['streetlamp',11,10],['bench',3,8],['bench',11,7,1],['bench',9,9,2],
  ['plant',0,1],['plant',0,10],['plant',13,1],['plant',13,10]
].map(([type,x,y,rot=0],id)=>({id,type,x,y,rot}));
const storeFurniture=[
  {id:'merchant',type:'tackleCounter',x:3,y:2,rot:0},
  {id:'rods',type:'rodRack',x:7,y:1,rot:0},
  {id:'bait',type:'baitCrates',x:7,y:4,rot:0},
  {id:'fern',type:'plant',x:1,y:1,rot:0},
  {id:'stool',type:'stool',x:4,y:4,rot:0}
];
const tailorFurniture=[['reception',3,2],['sofa',7,6],['lamp',8,1],['plant',1,1],['plant',8,8]].map(([type,x,y,rot=0],id)=>({id,type,x,y,rot}));
const factionHallFurniture=factionHallLayout.map(([type,x,y,rot=0],id)=>({id,type,x,y,rot}));
const bakeryFurniture=bakeryLayout.map(([type,x,y,rot=0],id)=>({id,type,x,y,rot}));
const furnishingsFurniture=[['reception',3,1],['bed',6,2],['lamp',8,2],['bookcase',1,1],['sofa',6,6],['table',6,8],['chair',8,8,2],['plant',1,8],['safe',8,1],['silverfinTank',2,7],['moonCrystal',7,3]].map(([type,x,y,rot=0],id)=>({id,type,x,y,rot}));
const marketFurniture=[
  {id:'trader',type:'tradeCounter',x:3,y:2,rot:0},
  {id:'produce',type:'harvestCrates',x:7,y:3,rot:0},
  {id:'fish',type:'baitCrates',x:7,y:5,rot:0},
  {id:'plant',type:'plant',x:1,y:1,rot:0},
  {id:'stool',type:'stool',x:4,y:4,rot:0}
];
const armoryFurniture=[
  {id:'smith',type:'armoryCounter',x:3,y:2,rot:0},
  {id:'weapons',type:'weaponRack',x:7,y:1,rot:0},
  {id:'anvil',type:'anvil',x:7,y:5,rot:0},
  {id:'enchanter',type:'enchanter',x:6,y:5,rot:0},
  {id:'forge',type:'brazier',x:1,y:1,rot:0},
  {id:'stool',type:'stool',x:4,y:4,rot:0}
];
let currentRoom='home',pendingFurniturePlacement=null,pendingFurnitureShopItem=null;
const atHome=()=>currentRoom==='home';
const canDecorate=()=>atHome();
function roomFurniture(){
  if(atHome())return homeFurniture;
  if(currentRoom==='lounge')return initial;
  if(currentRoom==='tailor')return tailorFurniture;
  if(currentRoom==='furnishings')return furnishingsFurniture;
  if(currentRoom==='bakery')return bakeryFurniture;
  if(currentRoom===factionHall)return factionHallFurniture;
  if(currentRoom==='store')return storeFurniture;
  if(currentRoom==='market')return marketFurniture;
  if(currentRoom==='armory')return armoryFurniture;
  if(moonwood.has(currentRoom)){
    const enemy=huntEnemyForRoom(currentRoom);
    const index=depthsStageIndex(currentRoom);
    const available=index>=0?depthsEnemyAvailable(depthsRun,currentRoom):!enemy||combatNow()>=huntRespawnAt(hunting,enemy);
    return [...moonwood.layouts[currentRoom].scenery.filter(item=>{
      if(item.type===enemy?.prop)return available;
      if(item.type==='galleryCache')return !!depthsRun?.finds?.includes('shellChime');
      return true;
    }).map(item=>item.type===enemy?.prop&&hunting.encounter?.arenaVersion===1?{...item,...arenaEnemy(hunting.encounter)}:item),...(hunting.encounter?.adds??[]).map(a=>({type:addKinds[a.kind].prop,x:a.x,y:a.y,addId:a.id,add:a}))];
  }
  return currentRoom==='hub'?hubFurniture:courtyardFurniture;
}
function setRoomFurniture(items){
  if(atHome())homeFurniture=items;
  else loungeFurniture=items;
}
const homeExit={to:'hub',side:'left',tile:{x:0,y:5},start:4.88,end:6.12,height:49,label:'EXIT'};
const hubDoors=[
  {to:'tailor',side:'left',tile:{x:0,y:2},start:1.2,end:3.2,height:51,label:'TAILOR'},
  {to:'furnishings',side:'right',tile:{x:9,y:0},start:8.1,end:10.2,height:51,label:'FURNITURE'},
  {to:'home',side:'left',tile:{x:0,y:6},start:5.72,end:7.28,height:51,label:'HOME'},
  {to:'armory',side:'right',tile:{x:3,y:0},start:2.35,end:4.65,height:51,label:'ARMORY'},
  {to:'lounge',side:'right',tile:{x:14,y:0},start:13.6,end:15.4,height:51,label:'LOUNGE'},
  {to:'store',side:'left',tile:{x:0,y:10},start:9.4,end:11.3,height:51,label:'FISHING'},
  {to:'market',side:'left',tile:{x:0,y:14},start:13.25,end:15.15,height:51,label:'MARKET'},
  {to:'outside',side:'front',tile:{x:8,y:15},start:7.24,end:9.76,label:'OUTSIDE'}
];
const towerEntrance={to:'hub',side:'left',tile:{x:0,y:5},start:4.58,end:6.42,height:54,label:'TOWER'};
const moonwoodEntrance={to:'trail',side:'front',tile:{x:6,y:11},arrival:{x:1,y:5},start:5.03,end:7.62,label:'MOONWOOD'};
const storeExit={to:'hub',side:'left',tile:{x:0,y:5},start:4.6,end:6.4,height:49,label:'LOBBY'};
const bakeryDoor={to:'bakery',side:'right',tile:{x:7,y:0},start:6.55,end:8.45,height:49,label:'BAKERY',arrival:{x:1,y:5}};
const bakeryExit={...storeExit,to:'market',label:'MARKET',arrival:{x:7,y:1}};
const roomDoors={[factionHall]:[storeExit],bakery:[bakeryExit],tailor:[storeExit],furnishings:[storeExit],home:[homeExit],hub:hubDoors,lounge:[storeExit],store:[storeExit],market:[storeExit,bakeryDoor],armory:[{...storeExit,arrival:{x:3,y:1}}],outside:[towerEntrance,moonwoodEntrance],...moonwood.doors};
const roomDetails={
  tailor:{number:'17',name:'The Gilded Thread',description:'Visit the tailor counter to preview and buy distinctive outfit sets and clothing pieces.',badge:'TAILOR',floor:'Tower shops'},
  furnishings:{number:'16',name:'Tower Furnishings',description:'Furniture, lighting and storage for your own corner of the Tower.',badge:'FURNITURE SHOP',floor:'Tower shops'},
  home:{number:'00',name:'Entry Room',description:'Your aim: become the richest and most powerful player in the game. Use the exit and meet the Tower Warden to get started.',badge:'ROOM NO. 00',floor:'Private room'},
  hub:{number:'01',name:'The Grand Lobby',description:'Visit the Warden, browse the shops, or head outside into Moonwood.',badge:'MAIN HUB',floor:'Ground floor'},
  lounge:{number:'02',name:'The Sunset Lounge',description:'Find blackjack and roulette on the gaming floor, or take a seat by the bar.',badge:'GAMING LOUNGE',floor:'Ground floor'},
  store:{number:'11',name:'Silverfin Outfitters',description:'Stock up on bait, find a better rod, and sell your catch.',badge:'FISHING STORE',floor:'Tower shops'},
  armory:{number:'14',name:'The Tower Armory',description:'Trade your earnings for a weapon that suits your fighting style.',badge:'ARMORY',floor:'Tower shops'},
  [factionHall]:{number:'18',name:'Faction Hall',description:'A private gathering place built by your faction. Review projects, rest, and prepare together.',badge:'MEMBERS ONLY',floor:'Faction headquarters'},
  bakery:{number:'17',name:'Tower Bakery',description:'Fresh bread from the oven. Pick up rations before your next trip.',badge:'BAKERY',floor:'Tower shops'},
  market:{number:'12',name:'Moonwood Trading Post',description:'Bring your catch and hunting spoils to the tower’s traders.',badge:'TRADING POST',floor:'Tower market'},
  outside:{number:'03',name:'The Courtyard',description:'Practise combat at the training dummy, rest by the fountain, or explore Moonwood.',badge:'OUTSIDE',floor:'Tower grounds'},
  ...moonwood.areas
};
const defaultHint = 'Click a tile to walk · Click furniture to interact';

function polygon(points,color,line) {
  ctx.beginPath(); points.forEach(([x,y],i)=>i?ctx.lineTo(Math.round(x),Math.round(y)):ctx.moveTo(Math.round(x),Math.round(y)));
  ctx.closePath(); ctx.fillStyle=color; ctx.fill();
  if(line){ctx.strokeStyle=line;ctx.lineWidth=1;ctx.stroke();}
}
function rect(x,y,w,h,c) {
  ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
}
function surface(x,y,w,d,z,c,line) {
  polygon([point(x,y,z),point(x+w,y,z),point(x+w,y+d,z),point(x,y+d,z)],c,line);
}
function block(x,y,w,d,bottom,height,colors) {
  const [top,left,right]=colors, z=bottom+height;
  polygon([point(x,y+d,z),point(x+w,y+d,z),point(x+w,y+d,bottom),point(x,y+d,bottom)],left);
  polygon([point(x+w,y,z),point(x+w,y+d,z),point(x+w,y+d,bottom),point(x+w,y,bottom)],right);
  surface(x,y,w,d,z,top);
}
function wallFace(side,a,b,lo,hi){
  const at=(u,z)=>side==='right'?point(u,0,z):point(0,u,z);
  return [at(a,lo),at(b,lo),at(b,hi),at(a,hi)];
}
function wall(side,a,b,lo,hi,c) {
  polygon(wallFace(side,a,b,lo,hi),c);
}
function windows(){
  for(let pane=0;pane<3;pane++){
    const a=.63+pane*2.7,b=a+2.51;
    wall('right',a-.08,b+.08,21,63,'#342839');
    wall('right',a,b,24,60,'#825d7a');
    wall('right',a,b,24,51,'#b47689');
    wall('right',a,b,24,42,'#d98c8a');
    wall('right',a,b,24,34,'#eaa484');
    if(pane===1){
      const p=(u,z)=>point(u,0,z);
      const mid=a+1.4;
      polygon([p(mid-.17,47),p(mid+.19,47),p(mid+.37,44),p(mid+.37,39),p(mid+.18,36),p(mid-.17,36),p(mid-.36,39),p(mid-.36,44)],'#ffd494');
      wall('right',a+.12,a+.91,49,50,'#d6969a');
      wall('right',a+1.82,b-.1,39,40,'#f5b196');
    }
    for(let i=0;i<10;i++){
      const x=a+i*.247;
      const h=3+(i*13+pane*7)%10;
      wall('right',x,x+.225,24,24+h,i%2?'#554765':'#674d69');
      if(i%3===1) wall('right',x+.07,x+.11,26+h*.28,27+h*.28,'#e6a788');
    }
    wall('right',a,b,23,25,'#9c6972');
    wall('right',a,b,61,62,'#e3a080');
    wall('right',a+1.16,a+1.23,24,60,'#5c435d');
  }
}
function room(empty=false){
  polygon([[240,106],[430,191],[244,291],[51,198]],'#10142168');
  const floors=empty?['#8c6555','#956e5a','#896252','#9b735e','#906854']:['#b47c68','#bd826a','#b77a64','#bb7c64','#c4866d'];
  block(0,0,10,10,-7,7,empty?['#966c56','#43384b','#302d41']:['#ac745c','#624250','#4d394d']);
  for(let y=0;y<view.rows;y++)for(let x=0;x<view.cols;x++){
    if(empty){
      // Long staggered boards keep the floor readable without a heavy square grid.
      surface(x,y,1,1,0,floors[(x*3+Math.floor(y/2)*7)%5]);
      surface(x+.96,y,.035,1,.02,'#604a4544');
      if(y%2===x%2)surface(x,y+.96,.96,.025,.025,'#604a4566');
      if((x+y)%3===0)surface(x+.14,y+.22,.018,.55,.03,'#d5a17540');
      continue;
    }
    surface(x,y,1,1,0,floors[(x*7+y*13)%5],'#9f675d');
    for(let i=0;i<3;i++){
      const u=(x*7+y*13+i*11)%53/100+.11;
      surface(x+u,y+.23+i*.24,.19,.026,.02,i===0?'#ce9477':'#a56c62');
    }
  }
  if(empty){
    drawEntryWalls();
    // Inlaid perimeter and door light are part of the room, not inventory furniture.
    surface(.12,.12,9.76,.035,.08,'#dbb878');
    surface(.12,.12,.035,9.76,.08,'#dbb878');
    surface(.12,9.82,9.76,.035,.08,'#d0a675');
    surface(9.82,.12,.035,9.76,.08,'#d0a675');
    for(let i=0;i<7;i++)surface(.2+i*.16,homeExit.start+.08,.16,homeExit.end-homeExit.start-.16,.1,'#7ed5c0'+['22','1d','18','13','0e','09','04'][i]);
    return;
  }
  wall('left',0,10,0,70,'#56445d');
  wall('right',0,10,0,70,'#735469');
  wall('left',0,10,66,71,'#9d6e79');
  wall('right',0,10,66,71,'#bf8588');
  wall('left',0,10,0,14,'#43384e');
  wall('right',0,10,0,14,'#604558');
  for(let i=.05;i<10;i+=.46){
    wall('left',i,Math.min(i+.035,10),0,14,'#302c43');
    wall('right',i,Math.min(i+.035,10),0,14,'#513c50');
  }
  wall('left',0,10,13,15,'#a16d78');
  wall('right',0,10,13,15,'#b47a7c');
  windows();
  wall('right',9.07,9.65,35,54,'#9d6f78');
  wall('right',9.15,9.57,37,52,'#3d344c');
  wall('right',9.21,9.51,40,48,'#d49a86');
  wall('right',9.24,9.46,41,44,'#ecb781');
  // Wall sign and framed art.
  wall('left',.69,3.93,42,61,'#3d334b');
  wall('left',.78,3.83,44,59,'#b77382');
  wall('left',.86,3.75,45,58,'#58405c');
  wall('left',5.75,7.51,28,55,'#3a3047');
  wall('left',5.84,7.42,30,53,'#cf9b8e');
  wall('left',5.98,7.28,33,50,'#84738e');
  wall('left',6.15,6.62,40,46,'#e8a98e');
  wall('left',5.98,7.28,33,38,'#466279');
  wall('left',8.17,8.87,37,56,'#3a3047');
  wall('left',8.24,8.8,39,54,'#b27a82');
  wall('left',8.32,8.72,41,52,'#574462');
  wall('left',8.38,8.67,44,49,'#e9b186');
  // Woven rugs and the small entry plaque.
  surface(4.62,1.85,4.83,4.25,.5,'#66465e');
  surface(4.74,1.97,4.59,4.01,.6,'#b16b78');
  surface(4.85,2.08,4.37,3.79,.7,'#855268');
  surface(5.03,2.25,4,3.43,.8,'#945a6e');
  for(let i=0;i<12;i++){
    surface(4.75+i*.39,1.76,.035,.21,.5,'#d48a84');
    surface(4.75+i*.39,5.97,.035,.21,.5,'#d48a84');
  }
  for(let i=0;i<4;i++)surface(5.17+i*.93,3.73,.25,.25,.9,'#cf8c88');
  surface(1.57,5.75,3.95,3.8,.5,'#5a526b');
  surface(1.68,5.86,3.73,3.58,.6,'#b27e76');
  surface(1.77,5.95,3.55,3.4,.7,'#6f6076');
  for(let i=0;i<5;i++)surface(1.87,6.17+i*.64,3.35,.04,.8,'#8e7482');
  block(8,9.7,1.45,.32,-1,2,shades.black);
  surface(8.12,9.73,1.2,.21,1.1,'#a16c71');
}
function drawEntryWalls(){
  wall('left',0,10,0,70,'#354359');
  wall('right',0,10,0,70,'#44516a');
  // Plaster above inset panelling, with narrow brass rails and capped masonry.
  for(const side of ['left','right']){
    const lit=side==='right';
    wall(side,0,10,0,18,lit?'#26364e':'#1e2d43');
    for(let u=.18;u<10;u+=1.4){
      wall(side,u,Math.min(u+1.17,9.85),3,15,lit?'#35465e':'#2b3b52');
      wall(side,u,Math.min(u+.025,9.85),3,15,'#728099');
    }
    wall(side,0,10,17,19,'#ad9164');
    wall(side,0,10,19,20,'#dbba7f');
    wall(side,0,10,0,2,'#131e31');
    wall(side,0,10,65,68,lit?'#738199':'#65738a');
    wall(side,0,10,68,71,lit?'#a5acba':'#8e9bad');
    wall(side,0,10,64,65,'#ceb17b');
    // Subtle plaster seams retain detail without competing with the home plaque.
    for(let u=1.4;u<10;u+=1.4)wall(side,u,u+.018,23,62,lit?'#546179':'#435168');
  }
  wall('left',0,.13,0,68,'#65758e');wall('right',0,.13,0,68,'#7a89a0');
  drawHomeSign();
  drawDoor(homeExit);
}
function drawDoor(door){
  const {side,start,end,height,label}=door;
  if(side==='front'){
    drawOutsideSteps(door);
    return;
  }
  const brass=door!==homeExit;
  wall(side,start-.09,end+.09,0,height+2,brass?'#bc8862':'#39374c');
  wall(side,start+.09,end-.09,0,height-3,'#242839');
  wall(side,start+.12,start+.24,0,height-4,brass?'#634857':'#3d4859');
  wall(side,end-.23,end-.1,0,height-4,brass?'#765561':'#535065');
  wall(side,start+.27,end-.27,1,3,brass?'#f3b97a':'#a1c6ad');
  if(side==='left')surface(0,start,.29,end-start,.55,brass?'#bd946e':'#5e8b83');
  else surface(start,0,end-start,.29,.55,'#bd946e');
  wall(side,start-.025,end+.025,height+4,height+15,brass?'#493044':'#35534f');
}
function doorHitShape({side,start,end,height}){
  if(side!=='front')return wallFace(side,start-.09,end+.09,0,height+15);
  const y=view.rows;
  return [point(start,y-.93),point(end,y-.93),point(end,y+.75,-10),point(start,y+.75,-10)];
}
function hitDoor(x,y,door){
  if(door.side!=='wild')return inShape(x,y,doorHitShape(door));
  const [px,py]=point(door.tile.x+.5,door.tile.y+.5);
  return Math.abs(x-px)<20&&y>py-24&&y<py+10;
}
function drawOutsideSteps({start,end,label}){
  const y=view.rows,span=end-start;
  block(start,y-.06,span,.83,-11,4,['#9a7882','#674d63','#553d54']);
  block(start+.06,y-.12,span-.12,.57,-7,4,['#c09b8d','#805f72','#694e65']);
  surface(start+.11,y-.91,span-.22,.84,.62,'#e4b180');
  surface(start+.17,y-.85,span-.34,.72,.66,'#50364b');
  const [x,sy]=point((start+end)/2,y-.45,1);
  for(const u of [start-.09,end+.02]){
    block(u,y-.33,.13,.18,0,18,shades.black);
    block(u-.045,y-.38,.22,.27,18,5,shades.gold);
    block(u-.013,y-.345,.16,.2,23,2,shades.cream);
  }
}
function drawHomeSign(){
  const left=2.45,right=7.55,top=59;
  wall('right',left+.07,right+.07,28,top-1,'#1d293e');
  wall('right',left,right,30,top,'#bd9b61');
  wall('right',left+.12,right-.12,32,top-2,'#14253d');
  wall('right',left+.3,left+.42,44,46,'#cea98b');
  wall('right',right-.42,right-.3,44,46,'#cea98b');
}
function lobbyLight(x,y,radius,color,flatten=1){
  ctx.save();
  ctx.translate(x,y);
  ctx.scale(1,flatten);
  const glow=ctx.createRadialGradient(0,0,1,0,0,radius);
  glow.addColorStop(0,color);
  glow.addColorStop(1,'#00000000');
  ctx.fillStyle=glow;
  ctx.fillRect(-radius,-radius,radius*2,radius*2);
  ctx.restore();
}
function drawLobbySky(){
  const {width,height}=view;
  lobbyLight(width*.54,height*.38,350,'#29467999',.8);
  const ridge=(base,heights,color)=>{
    const peaks=heights.map((rise,i)=>[i*width/(heights.length-1),base-rise]);
    polygon([...peaks,[width,height],[0,height]],color);
  };
  ridge(260,[52,85,40,106,73,113,60,96,49,109,63,96,70],'#142440');
  ridge(294,[73,46,78,40,75,53,77,58,99,68,96,44,65],'#101c33');
  for(let i=0;i<39;i++){
    const x=17+(i*137)%686,y=12+(i*47)%158;
    rect(x,y,i%8===0?2:1,1,i%4===0?'#a4c7d7ad':'#7690b46e');
  }
}
function lobbyWallPoint(side,u,z){
  return side==='right'?point(u,0,z):point(0,u,z);
}
function drawLobbyBanner(side,at){
  const tip=(u,z)=>lobbyWallPoint(side,at+u,z);
  polygon([tip(-.53,66),tip(.53,66),tip(.53,27),tip(0,21),tip(-.53,27)],'#213657','#98734e');
  polygon([tip(-.43,63),tip(.43,63),tip(.43,29),tip(0,24),tip(-.43,29)],'#24416c','#b9945d');
  polygon([tip(-.28,47),tip(.28,47),tip(.25,38),tip(0,33),tip(-.25,38)],'#bd9a59');
  polygon([tip(-.21,46),tip(.21,46),tip(.18,39),tip(0,35),tip(-.18,39)],'#1a3153');
  wall(side,at-.13,at+.13,40,45,'#f0ce83');
  for(const u of [-.13,-.025,.08])wall(side,at+u,at+u+.05,44,48,'#f0ce83');
  wall(side,at-.02,at+.025,40,42,'#1a3153');
  wall(side,at-.64,at+.64,65,68,'#c7a476');
}
function drawLobbySconce(side,u){
  const [x,y]=lobbyWallPoint(side,u,37);
  lobbyLight(x,y,37,'#ffc68088');
  const floor=lobbyWallPoint(side,u,0);lobbyLight(floor[0],floor[1],34,'#fbc58048',.48);
  rect(x-4,y-6,8,13,'#39303c');
  rect(x-3,y-5,6,10,'#bb8051');
  rect(x-2,y-4,4,8,'#ffe6a8');
  rect(x-1,y-3,2,6,'#fff6d1');
  rect(x-4,y+4,8,2,'#d6a766');
}
function drawLobbyWindow(a,b){
  const at=(u,z)=>lobbyWallPoint('right',u,z);
  wall('right',a-.08,b+.08,25,68,'#292e44');
  wall('right',a,b,28,65,'#ac9a82');
  wall('right',a+.10,b-.10,30,63,'#446697');
  wall('right',a+.10,b-.10,30,53,'#699bb9');
  wall('right',a+.10,b-.10,30,41,'#abc9cc');
  polygon([at(a+.1,33),at(a+.47,48),at(a+.71,40),at(a+1.22,55),at(b-.1,38),at(b-.1,30),at(a+.1,30)],'#455f88');
  polygon([at(a+.96,47),at(a+1.22,55),at(a+1.47,48),at(a+1.24,50)],'#cbdee0');
  const mid=(a+b)/2;
  wall('right',mid-.035,mid+.035,30,63,'#b3bbbf');
  wall('right',a+.08,b-.08,46,47,'#b3bbbf');
  wall('right',a-.11,b+.11,26,29,'#bfad92');
}
const lobbyPortalColors={
  tailor:['#42304b','#ffd7ef','#d78fbd'],
  furnishings:['#2d3e35','#e4e9a0','#c3cd83'],
  home:['#3d2c42','#ffc78a','#f6ae6b'],store:['#152d4c','#91dcff','#55baff'],
  market:['#432d34','#ffcd85','#edac61'],armory:['#422841','#ffae9e','#ff7769'],
  lounge:['#332752','#e8bdff','#c583ec'],outside:['#3a3048','#ffe0a1','#f2b06d']
};
const lobbyPortalIcons={
  tailor:['0100010','1111111','1101011','0101010','0101010','0111110','0111110'],
  furnishings:['0111110','0100010','1100011','1100011','1111111','0100010','0100010'],
  home:['0001000','0011100','0111110','1111111','0101010','0110110','0110110'],
  store:['0000001','0110011','1111111','1011110','1111111','0110011','0000001'],
  market:['0011100','0111110','1111111','1010101','0111110','0100010','0111110'],
  armory:['1100000','1110000','0111000','0011100','0001101','0000110','0000101'],
  lounge:['0000100','0010010','1111111','1010101','0111100','0011000','1111110']
};
function drawLobbyPortal(door){
  if(door.side==='front'){drawOutsideSteps(door);return;}
  const {side,start,end,height,to}=door;
  const [ink,light,edge]=lobbyPortalColors[to];
  const arch=(inset,top)=>{
    const a=start+inset,b=end-inset,at=(u,z)=>lobbyWallPoint(side,u,z);
    return [at(a,0),at(b,0),at(b,top-9),at(b-.20,top-3),at((a+b)/2,top),at(a+.20,top-3),at(a,top-9)];
  };
  polygon(arch(-.11,height+5),'#232638');
  polygon(arch(-.04,height+2),'#83604b');
  polygon(arch(.045,height),edge);
  polygon(arch(.125,height-3),ink);
  const [x,y]=lobbyWallPoint(side,(start+end)/2,22);
  lobbyLight(x,y,18,edge+'64');
  for(const [row,line] of lobbyPortalIcons[to].entries()){
    for(let col=0;col<line.length;col++)if(line[col]==='1')rect(x-7+col*2,y-8+row*2,2,2,light);
  }
  wall(side,start+.12,end-.12,0,2,light);
  wall(side,start-.16,end+.16,height+3,height+15,'#b99a68');
  wall(side,start-.11,end+.11,height+4,height+14,'#14243b');
}

function drawLobbyCrest(x,y){
  polygon([[x-14,y-9],[x+14,y-9],[x+13,y+2],[x,y+11],[x-13,y+2]],'#bb9459');
  polygon([[x-11,y-7],[x+11,y-7],[x+10,y+1],[x,y+8],[x-10,y+1]],'#1e3963');
  rect(x-5,y-3,10,5,'#f1d28e');
  rect(x-4,y-6,2,3,'#f1d28e');rect(x-1,y-7,2,4,'#f1d28e');rect(x+3,y-6,2,3,'#f1d28e');
  rect(x-1,y,2,2,'#1e3963');
}
function drawLobbyCrystal(x,y,time){
  const [cx,cy]=point(x+.5,y+.5,9);
  const bob=reducedMotion.matches?0:Math.round(Math.sin(time/580)*2);
  block(x+.08,y+.08,.84,.84,0,6,['#696f82','#363d56','#414d67']);
  block(x+.16,y+.16,.68,.68,6,2,['#b69a69','#73614e','#5c5360']);
  surface(x+.23,y+.23,.54,.54,8.2,'#28496c','#8ecbd1');
  lobbyLight(cx,cy-12,24,'#5bbdf06a');
  polygon([[cx,cy-34-bob],[cx+8,cy-23-bob],[cx+6,cy-11-bob],[cx,cy-5-bob],[cx-7,cy-14-bob],[cx-8,cy-23-bob]],'#60b8dc','#aee4ef');
  polygon([[cx,cy-34-bob],[cx+1,cy-19-bob],[cx,cy-5-bob],[cx-7,cy-14-bob],[cx-8,cy-23-bob]],'#3484b7');
  polygon([[cx,cy-34-bob],[cx+8,cy-23-bob],[cx+1,cy-19-bob]],'#b8edf3');
  rect(cx+11,cy-19+bob,2,2,'#bcf2e7');
  rect(cx-12,cy-26-bob,2,2,'#86cfed');
}
function drawGrandLobby(showDoors=true){
  const {cols,rows}=view;
  drawLobbySky();
  polygon([point(-.25,-.25,-9),point(cols+.44,-.25,-10),point(cols+.44,rows+.46,-14),point(-.25,rows+.46,-11)],'#080f1bc9');
  block(0,0,cols,rows,-13,13,['#9f9ca1','#555568','#363e55']);
  block(0,rows-.07,cols,.08,-10,2,['#9a785d','#b79265','#72584d']);
  block(cols-.07,0,.08,rows,-10,2,['#9a785d','#846750','#a4805c']);
  const stone=['#b0a69c','#aaa195','#ada499','#a69d94'];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const border=x===0||y===0||x===cols-1||y===rows-1;
    surface(x,y,1,1,0,border?'#646779':stone[(x*7+y*3)%stone.length],border?'#55596c':'#948c89');
    surface(x+.04,y+.05,.92,.033,.08,'#d1c8c32e');
    if((x*3+y*7)%6===0)surface(x+.34,y+.54,.28,.025,.1,'#d4ccca64');
  }
  for(const edge of [.32,cols-.37])surface(edge,.32,.055,rows-.64,.17,'#d5b080');
  for(const edge of [.32,rows-.37])surface(.32,edge,cols-.64,.055,.17,'#d5b080');
  surface(6.89,3.98,3.22,10.56,.22,'#584a51');
  surface(7,4.07,3,10.38,.27,'#182943','#b28a5c');
  surface(7.13,4.22,2.74,10.08,.31,'#223b65','#d6ae6e');
  surface(7.26,4.37,2.48,9.78,.34,'#263e66','#765f54');
  for(const y of [4.58,13.68])for(const x of [7.32,9.34]){
    surface(x,y,.33,.08,.4,'#d5b071');surface(x,y,.08,.33,.4,'#d5b071');
  }
  // The embroidered shield follows the carpet plane, rather than facing the camera.
  const crest=(x,y)=>point(x,y,.6);
  polygon([crest(7.72,8.45),crest(9.28,8.45),crest(9.18,9.2),crest(8.5,9.9),crest(7.82,9.2)],'#cba968');
  polygon([crest(7.86,8.58),crest(9.14,8.58),crest(9.04,9.16),crest(8.5,9.72),crest(7.96,9.16)],'#1e3557');
  surface(8.13,8.9,.74,.33,.7,'#e4c583');
  for(const x of [8.13,8.43,8.73])surface(x,8.62,.14,.36,.7,'#e4c583');
  surface(8.44,9.05,.13,.18,.75,'#1e3557');
  for(let y=4.8;y<13.5;y+=.42){surface(7.18,y,.035,.12,.5,'#caa465');surface(9.78,y,.035,.12,.5,'#caa465');}
  // Seating bays use architectural inlays, leaving all existing walking tiles free.
  for(const [x,y] of [[1.4,9.55],[12.4,7.55]]){
    surface(x,y,3.6,3.7,.15,'#8d909c','#bbad93');
    surface(x+.12,y+.12,3.36,3.46,.18,'#9696a0');
  }
  for(const [x,y] of [[2.3,2.9],[4.4,4.1],[12.9,8.5],[6.7,14.2]]){
    lobbyLight(...point(x,y),63,'#ffd39a60',.47);
  }
  if(showDoors)for(const door of hubDoors){
    const middle=(door.start+door.end)/2;
    const spot=door.side==='front'?point(middle,rows-.8):door.side==='left'?point(.86,middle):point(middle,.86);
    lobbyLight(...spot,32,lobbyPortalColors[door.to][2]+'63',.55);
  }
  for(const side of ['left','right']){
    const length=side==='left'?rows:cols;
    wall(side,0,length,0,80,side==='left'?'#303c54':'#44516a');
    for(let course=0;course<5;course++){
      const bottom=15+course*12;
      wall(side,0,length,bottom,bottom+.45,'#27334a');
      for(let u=course%2?.6:1.6;u<length;u+=2)wall(side,u,u+.035,bottom,bottom+12,'#2c364f');
    }
    wall(side,0,length,0,13,'#292f45');
    wall(side,0,length,12,14,'#a58669');
    wall(side,0,length,77,81,'#8b8190');
    wall(side,0,length,79,81,'#c0ab99');
    for(const u of (side==='left'?[.20,4.4,8,12.05,15.54]:[.20,5.6,12.0,17.5])){
      wall(side,u,u+.25,1,76,'#2b354d');
      wall(side,u+.04,u+.18,3,76,'#718096');
      wall(side,u+.04,u+.065,8,71,'#9ba5b4');
      wall(side,u-.10,u+.34,72,74,'#c7ae86');
      wall(side,u-.10,u+.34,5,7,'#bc9f78');
      wall(side,u-.04,u+.28,71,77,'#a88d77');
      wall(side,u-.04,u+.28,2,8,'#8d7769');
    }
  }
  if(showDoors){drawLobbyWindow(6.3,7.7);drawLobbyWindow(10.7,11.9);}
  else{drawLobbyWindow(6.55,8.6);drawLobbyWindow(9.25,11.3);}
  drawLobbyBanner('left',4.9);drawLobbyBanner('right',1.05);drawLobbyBanner('right',16.25);
  if(!showDoors){
    wall('left',1,4.4,39,65,'#171f34');
    wall('left',1.08,4.32,40,64,'#bc9563');
    wall('left',1.16,4.24,41,63,'#232d48');
  }
  if(showDoors)hubDoors.forEach(drawLobbyPortal);
  for(const u of [5.27,8.72,12.53])drawLobbySconce('left',u);
  for(const u of [2.12,5.92,12.8,17.05])drawLobbySconce('right',u);
}
function drawChandelier(){
  const glow=ctx.createRadialGradient(240,74,5,240,74,53);
  glow.addColorStop(0,'#ffc37658');glow.addColorStop(1,'#ffc37600');
  ctx.fillStyle=glow;ctx.fillRect(185,20,110,108);
  rect(237,14,7,4,'#f0bb82');rect(239,18,3,27,'#be886c');
  rect(240,18,1,27,'#ffde9e');
  polygon([[240,39],[270,56],[255,71],[225,71],[210,56]],'#926476');
  polygon([[240,42],[266,57],[252,66],[228,66],[214,57]],'#dba376');
  polygon([[240,47],[256,56],[240,64],[224,56]],'#664459');
  for(const [x,y] of [[214,57],[225,65],[239,68],[253,65],[265,57],[240,47]]){
    rect(x-2,y-5,5,8,'#e7a46e');rect(x-1,y-6,3,6,'#fff0b3');
    rect(x,y+3,1,8,'#d5a5a4');rect(x-1,y+10,3,3,'#e9c2ad');
  }
  polygon([[240,63],[250,71],[240,88],[230,71]],'#c68780');
  polygon([[240,64],[245,72],[240,85],[235,72]],'#f9d2a0');
  rect(239,69,2,12,'#fff2b9');
}
function drawCourtyard(){
  const {cols,rows}=view;
  for(let x=.28;x<cols-.25;x+=.58){
    const top=22+(Math.round(x*41)%28);
    wall('right',x,x+.47,5,top,'#2b334c');
    if(top>30){
      wall('right',x+.10,x+.14,top-12,top-10,'#aa8b86');
      wall('right',x+.29,x+.33,top-17,top-15,'#716580');
    }
  }
  polygon([point(-.3,-.2,-8),point(cols+.35,-.2,-9),point(cols+.4,rows+.42,-10),point(-.3,rows+.4,-9)],'#0c142385');
  block(0,0,cols,rows,-8,8,['#727984','#45495e','#373e52']);
  const coolStone=['#75828d','#687886','#72818f','#79848e'];
  const warmStone=['#aa9695','#b29c98','#9d8e92','#b6a39a'];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const terrace=(y>=4&&y<=7)||(x>=5&&x<=8&&y>=2&&y<=9);
    const stones=terrace?warmStone:coolStone;
    surface(x,y,1,1,0,stones[(x*9+y*13)%4],terrace?'#827684':'#57687c');
    surface(x+.14,y+.24,.16,.028,.08,terrace?'#c0aea5':'#8b9ba4');
  }
  for(const y of [4.06,7.86])surface(.35,y,cols-.7,.07,.25,'#dac0a4');
  for(const x of [.3,cols-.38])surface(x,.36,.08,rows-.72,.25,'#4e6174');
  for(const [x,y,w,d] of [[1.1,.67,3.36,1.75],[9.6,8.68,3.3,1.75]]){
    surface(x,y,w,d,.25,'#464f63');
    surface(x+.07,y+.07,w-.14,d-.14,.3,'#a18f90');
    surface(x+.16,y+.16,w-.32,d-.32,.34,'#46666a');
    for(let i=.35;i<w-.2;i+=.42){
      surface(x+i,y+.36,.13,.13,.4,'#e6a2a5');
      surface(x+i+.14,y+d-.44,.10,.12,.4,'#c98491');
      surface(x+i,y+.66,.15,.16,.4,'#70978a');
    }
  }
  surface(5.58,4.58,2.84,2.84,.34,'#5e687e');
  surface(5.68,4.68,2.64,2.64,.38,'#d2b3a0');
  surface(5.79,4.79,2.42,2.42,.42,'#79808d');
  wall('right',0,cols,0,12,'#454b63');
  wall('right',0,cols,10,13,'#897b8c');
  for(let x=.21;x<cols-.1;x+=.42)wall('right',x,x+.05,1,10,'#ac9291');
  wall('left',0,rows,0,73,'#786377');
  wall('left',0,rows,64,74,'#ac8b8e');
  wall('left',0,rows,70,74,'#d0a49a');
  wall('left',0,rows,0,18,'#53495f');
  for(const z of [5,10,15])wall('left',0,rows,z,z+1,'#847185');
  for(const u of [.4,3.82,7.25,10.9]){
    wall('left',u,u+.23,0,67,'#54475f');
    wall('left',u+.035,u+.12,2,66,'#ad8790');
  }
  for(const a of [.95,2.42,7.75,9.28]){
    wall('left',a,a+1.10,24,57,'#51455e');
    wall('left',a+.085,a+1.015,25,55,'#c58d78');
    wall('left',a+.14,a+.96,27,53,'#a97276');
    wall('left',a+.14,a+.96,27,47,'#de9c78');
    wall('left',a+.18,a+.91,29,45,'#f2bd89');
    wall('left',a+.49,a+.57,27,53,'#99677a');
    wall('left',a+.12,a+.98,37,39,'#96687a');
    wall('left',a-.07,a+1.17,23,26,'#cb9b91');
  }
  drawDoor(towerEntrance);
  drawDoor(moonwoodEntrance);
  for(const u of [4.26,6.69]){
    wall('left',u,u+.16,30,39,'#493c52');
    wall('left',u+.025,u+.13,32,37,'#ffd89b');
  }
}
function drawFishingStore(market=false){
  const armory=market==='armory';
  block(0,0,10,10,-8,8,['#998b83','#53465c','#443c53']);
  for(let y=0;y<10;y++)for(let x=0;x<10;x++){
    surface(x,y,1,1,0,(x+y)%2?'#aa9485':'#a08b80','#7f6d71');
    surface(x+.14,y+.28,.69,.025,.1,'#c0a38b');
  }
  wall('left',0,10,0,70,'#46606a');
  wall('right',0,10,0,70,'#5b7680');
  for(const side of ['left','right']){
    wall(side,0,10,0,15,'#384e5a');
    wall(side,0,10,14,17,'#bd9e81');
    wall(side,0,10,66,71,'#b7967e');
    for(let i=.3;i<10;i+=.4)wall(side,i,i+.04,1,14,'#708891');
  }
  wall('right',1.25,5.6,37,61,'#d1ac86');
  wall('right',1.36,5.49,39,59,'#314e5c');
  wall('left',1.3,3.5,30,56,'#c4a284');
  wall('left',1.42,3.38,32,54,'#395767');
  wall('left',1.49,3.31,33,46,'#7b9da3');
  wall('left',1.51,3.29,33,37,'#b5c1b0');
  surface(3.1,4.9,3.8,3.7,.3,'#516d74');
  surface(3.22,5.02,3.56,3.46,.35,'#c3aa89');
  surface(3.35,5.15,3.3,3.2,.4,'#526e73');
  for(let i=0;i<5;i++)surface(3.54,5.4+i*.54,2.9,.035,.45,'#779395');
  drawDoor(storeExit);
}
function drawFactionHall(){
  block(0,0,10,10,-8,8,['#8b897e','#414452','#303545']);
  for(let y=0;y<10;y++)for(let x=0;x<10;x++)surface(x,y,1,1,0,(x+y)%2?'#8b8b87':'#828783','#5b646a');
  for(const side of ['left','right']){
    wall(side,0,10,0,65,side==='left'?'#485c61':'#53696d');
    wall(side,0,10,0,12,'#314449');wall(side,0,10,63,67,'#b6a17a');
  }
  drawLobbyBanner('right',5.2);
  surface(3,3.25,3.9,4.8,.2,'#63445e','#dfb875');
  surface(3.2,3.46,3.5,4.37,.3,'#7a4f68','#bb8a65');
  drawDoor(storeExit);
}
function drawBakery(){
  block(0,0,10,10,-8,8,['#ae815f','#5b3e42','#49353e']);
  for(let y=0;y<10;y++)for(let x=0;x<10;x++){
    surface(x,y,1,1,0,(x+y)%2?'#b68c6e':'#ad8061','#8e634f');
    surface(x+.12,y+.66,.74,.025,.1,'#c39573');
  }
  for(const side of ['left','right']){
    wall(side,0,10,0,65,side==='left'?'#815b51':'#9e7059');
    wall(side,0,10,0,16,'#5d4142');
    wall(side,0,10,15,17,'#d6a46c');
    wall(side,0,10,62,66,'#e1b581');
    for(const i of [2.6,5.2,8.1])wall(side,i,i+.11,18,62,'#73514b');
  }
  surface(3.2,5.4,3.1,2.6,.2,'#693944','#e5ad71');
  surface(3.38,5.57,2.74,2.25,.3,'#a3514c','#cf8866');
  drawDoor(bakeryExit);
}
const dungeonMobMotion=new Map();
function dungeonMobOffset(item,time){
 if(!hunting.encounter){dungeonMobMotion.clear();return [0,0];}
 if(reducedMotion.matches)return [0,0];
 const key=serverCombatId+':'+(item.addId??'leader'),to={x:item.x,y:item.y};
 for(const [id,motion] of dungeonMobMotion)if(time-motion.seen>1000)dungeonMobMotion.delete(id);
 let motion=dungeonMobMotion.get(key)??{from:to,to,at:time};
 if(motion.to.x!==to.x||motion.to.y!==to.y)motion={from:motion.to,to,at:time};
 motion.seen=time;dungeonMobMotion.set(key,motion);
 const t=Math.max(0,Math.min(1,(time-motion.at)/260)),[x,y]=point(motion.from.x+(to.x-motion.from.x)*t,motion.from.y+(to.y-motion.from.y)*t),[tx,ty]=point(to.x,to.y);
 return [x-tx,y-ty];
}

function dimensions(item) {
  if(watchDimensions[item.type])return watchDimensions[item.type];
  if(riverDimensions[item.type])return riverDimensions[item.type];
  const catalogSize=catalogFurnitureSize(item);
  if(catalogSize)return catalogSize;
  if(item.type==='workbench'||item.type==='bench'||isGamingTable(item))return item.rot%2?[1,2]:[2,1];
  if(item.type==='armoryCounter'||item.type==='reception'||item.type==='tackleCounter'||item.type==='tradeCounter')return [3,1];
  if(item.type==='rodRack'||item.type==='weaponRack')return [2,1];
  if(item.type==='fountain')return [2,2];
  return item.type==='bar'?[1.5,4.1]:item.type==='shelf'?[.35,3.5]:[1,1];
}
function object(item,highlight=false,time=0) {
  const {x,y,type,rot}=item;
  const [w,d]=dimensions(item);
  if(highlight)surface(x,y,w,d,1,'#f9c48968','#ffd18a');
  if(currentRoom==='hub'&&type==='plant'&&x===16&&y===1){
    drawLobbyCrystal(x,y,time);return;
  }
  if(type==='trainingDummy'){
    surface(x-.35,y-.35,1.7,1.7,.5,'#314762','#ad9565');const [dx,dy]=point(x+.5,y+.5);if(typeof drawTrainingDummy==='function')drawTrainingDummy(ctx,dx,dy,{time,reduced:reducedMotion.matches});return;
  }
  if(type==='enchanter'){
    const [ex,ey]=point(x+.5,y+.5);
    sprite(ctx,ex,ey,{outfit:4,hair:1},{direction:'left',time});
    rect(ex+9,ey-25,2,25,'#b99668');
    polygon([[ex+10,ey-34],[ex+14,ey-28],[ex+10,ey-22],[ex+6,ey-28]],'#b8a4f4');
    rect(ex+9,ey-30,1,5,'#fff0d0');return;
  }
  if(type==='woodcutter'){
    const [wx,wy]=point(x+.5,y+.5);
    sprite(ctx,wx,wy,{outfit:3,hair:2},{direction:'right',time,weapon:true,weaponTier:'basicAxe',pose:{angle:-.4}});return;
  }
  if(type==='hallBoard'){
    block(x+.17,y+.22,.66,.38,0,24,['#c2a078','#523948','#795460']);
    const [bx,by]=point(x+.52,y+.58,22);
    rect(bx-9,by-7,17,13,'#402b38');rect(bx-6,by-4,11,7,'#e8c99b');
    rect(bx-4,by-2,7,1,'#9f7356');rect(bx-4,by+1,5,1,'#9f7356');return;
  }
  if(type==='bakeryOven'){
    block(x+.05,y+.05,.9,.9,0,33,['#c28868','#7c554f','#9e6555']);
    const [ox,oy]=point(x+.52,y+.91,19);
    polygon([[ox-9,oy+4],[ox-9,oy-4],[ox-5,oy-11],[ox+5,oy-6],[ox+9,oy+1],[ox+9,oy+12]],'#402d34');
    rect(ox-5,oy+1,10,5,'#e8904f');rect(ox-2,oy-1,5,6,'#ffd285');return;
  }
  if(type==='breadRack'){
    block(x+.1,y+.1,.8,.8,0,29,['#c59164','#63403d','#815244']);
    for(const z of [9,18,29]){
      surface(x+.1,y+.5,.83,.45,z,'#b37b54');
      for(const shift of [.18,.47])surface(x+shift,y+.63,.24,.21,z+.5,'#ecb46b');
    }
    return;
  }
  if(type==='foodStall'){
    const [fx,fy]=point(x+.5,y+.5);
    sprite(ctx,fx,fy,{outfit:3,hair:2},{direction:'right',time});
    surface(x+.08,y+.63,.84,.30,10,'#9d653e','#e8b26b');
    surface(x+.22,y+.69,.26,.17,11,'#e2a050');
    surface(x+.55,y+.68,.26,.18,11,'#f7c477');return;
  }
  if(type==='factionRegistrar'){
    const [rx,ry]=point(x+.5,y+.5);
    surface(x+.14,y+.14,.72,.72,.3,'#c79d503c');
    sprite(ctx,rx,ry,{outfit:4,hair:2},{direction:'left',time});
    rect(rx+8,ry-17,8,9,'#543b46');rect(rx+9,ry-17,6,7,'#ebcf9e');rect(rx+10,ry-15,4,1,'#aa7b59');
    return;
  }
  if(type==='warden'){
    const [wx,wy]=point(x+.5,y+.5);
    surface(x+.14,y+.14,.72,.72,.3,'#9ab7a73c');
    sprite(ctx,wx,wy,{outfit:1,hair:1},{direction:'left',time});
    rect(wx-7,wy-34,13,3,'#809f9b');rect(wx-4,wy-36,7,2,'#bdc6ad');rect(wx-2,wy-34,3,3,'#e6c385');
    return;
  }
  if(Object.hasOwn(moonwood.heights,type)){
    if(isTimberTree(item)){
      drawTimberTree(item,time);
    }else if(type==='wildboar'||type==='stonebackBeetle'||isDungeonMob(type)){
      const actorEncounter=item.add?addEncounter(hunting.encounter,item.add):hunting.encounter;
      const addEffects=item.add?(combatArt.bursts??[]).filter(fx=>fx.targetId===item.addId):[];
      const pose=boarCombatPose({time,now:combatNow(),encounter:player.inCombat?actorEncounter:null,events:item.add?{boarAttackAt:addEffects.findLast(fx=>fx.action==='enemy')?.time,boarHitAt:addEffects.findLast(fx=>fx.damage)?.time}:combatArt,reduced:reducedMotion.matches,defeated:!!item.defeated});
      const [bx,by]=point(x+.5,y+.5),[px,py]=point(player.x+.5,player.y+.5);
      const shift=(type==='wildboar'||huntEnemyForRoom(currentRoom)?.archetype==='duelist'?pose.charge:0)-pose.recoil;
      const [mx,my]=isDungeonMob(type)?dungeonMobOffset(item,time):[0,0];
      ctx.save();ctx.translate(mx,my);ctx.globalAlpha*=pose.alpha;
      ctx.translate(bx+Math.sign(px-bx)*shift,by+Math.sign(py-by)*shift+pose.fall);
      ctx.scale((px<bx?-1:1)*(1+(1-pose.squash)*.25)*(item.add?.kind==='skitter'?.65:1),pose.squash*(item.add?.kind==='skitter'?.65:1));if(item.add&&combatNow()<item.add.spawnAt)ctx.globalAlpha*=.25;ctx.translate(-bx,-by);
      moonwood.drawProp(item,time,{...worldDrawing,ctx,reduced:reducedMotion.matches,progress:adventure,combat:player.inCombat?hunting.encounter:null,pose});
      ctx.restore();
      if(!item.defeated){
        const enemy=item.add?addKinds[item.add.kind]:huntEnemyForRoom(currentRoom);
        if(enemy){
          const summoning=item.add&&combatNow()<item.add.spawnAt;
          const key=item.addId??'leader',selected=player.inCombat&&hunting.encounter?.combatTarget===key;
          renderedActors.push({id:'enemy:'+key,enemy:true,name:enemy.name,detail:summoning?'Summoning':selected?'Target':'',
            x:bx+Math.sign(px-bx)*shift+mx,y:by+Math.sign(py-by)*shift+my+pose.fall-(item.add?46:(moonwood.heights[type]??34)+8),
            action:summoning||player.inCombat&&hunting.encounter?.addsVersion!==1?null:()=>use(item)});
        }
      }
      if(item.add){
       rect(bx-13,by-42,26,4,'#17253b');rect(bx-12,by-41,24*item.add.health/addKinds[item.add.kind].health,2,'#e8ac91');
       if(hunting.encounter.combatTarget===item.addId){ctx.strokeStyle='#ffe3a0';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(bx,by,14,7,0,0,Math.PI*2);ctx.stroke();}
      }
    }else moonwood.drawProp(item,time,{...worldDrawing,ctx,reduced:reducedMotion.matches,progress:adventure,depthsRun});
    return;
  }
  if(type!=='bar'&&type!=='shelf')surface(x+.04,y+.08,w-.04,d-.03,.3,'#4931434a');
  const part=(u,v,a,b,z,h,c)=>{
    const p=rot%2?[v,u,b,a]:[u,v,a,b];
    if(rot>=2){p[0]=w-p[0]-p[2];p[1]=d-p[1]-p[3];}
    block(x+p[0],y+p[1],p[2],p[3],z,h,shades[c]??c);
  };
  if(type==='workbench'){
    for(const u of [.12,1.72])for(const v of [.13,.74])part(u,v,.13,.13,0,15,'wood');
    part(.03,.05,1.94,.90,15,4,'wood');part(.09,.10,1.82,.78,19,.6,['#d1ad7b','#88635c','#ab835f']);
    part(.18,.18,.44,.22,20,1,'cream');part(1.3,.37,.38,.09,20,1,'black');part(1.52,.29,.1,.27,20,2,'trim');
  }else if(type==='amberLantern'){
    const [lx,ly]=point(x+.5,y+.5,12);
    const glow=ctx.createRadialGradient(lx,ly,2,lx,ly,20);
    glow.addColorStop(0,'#ffc37875');glow.addColorStop(1,'#ffc37800');
    ctx.fillStyle=glow;ctx.fillRect(lx-20,ly-20,40,40);
    part(.19,.20,.62,.60,0,3,'black');part(.26,.26,.48,.48,3,12,['#ffcb7c','#d37d48','#ed9955']);
    for(const u of [.23,.70])for(const v of [.23,.70])part(u,v,.07,.07,3,13,'gold');
    part(.43,.74,.14,.03,6,6,'cream');part(.74,.43,.03,.14,6,6,'cream');
    part(.20,.20,.60,.60,15,2,'gold');part(.28,.28,.44,.44,17,2,'black');
    ctx.strokeStyle='#e3b776';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(lx-4,ly-7);ctx.lineTo(lx-4,ly-11);ctx.lineTo(lx-1,ly-14);
    ctx.lineTo(lx+2,ly-14);ctx.lineTo(lx+5,ly-11);ctx.lineTo(lx+5,ly-7);ctx.stroke();
  }else if(type==='moonCrystal'){
    drawLobbyCrystal(x,y,time);
  }else if(type==='jadeBonsai'){
    part(.14,.21,.72,.58,0,6,['#78aaa0','#325b57','#51877a']);
    part(.10,.17,.80,.66,6,2,['#b0c7a7','#426d62','#76a792']);part(.19,.25,.62,.50,8,.4,'black');
    const [tx,ty]=point(x+.5,y+.5,8);
    polygon([[tx-3,ty],[tx+2,ty],[tx+3,ty-8],[tx-2,ty-13],[tx+1,ty-23],[tx-3,ty-24],[tx-7,ty-14],[tx-1,ty-7]],'#a87956');
    polygon([[tx-3,ty-14],[tx-12,ty-17],[tx-10,ty-20],[tx-3,ty-17],[tx+8,ty-19],[tx+8,ty-16]],'#80553e');
    for(const [u,v,width,dark,light] of [[-10,-18,7,'#315d51','#70a175'],[9,-20,7,'#396d58','#86b287'],[0,-29,8,'#4c825c','#a0bd82']]){
      polygon([[tx+u-width,ty+v],[tx+u-width+3,ty+v-5],[tx+u+width-3,ty+v-5],[tx+u+width,ty+v-1],[tx+u+width-3,ty+v+4],[tx+u-width+3,ty+v+4]],dark);
      polygon([[tx+u-width+2,ty+v-2],[tx+u-2,ty+v-5],[tx+u+width-3,ty+v-5],[tx+u+width-1,ty+v-2],[tx+u+1,ty+v]],light);
    }
  }else if(type==='explorersGlobe'){
    part(.28,.27,.44,.46,0,3,'wood');part(.45,.44,.10,.12,3,9,'gold');
    const [gx,gy]=point(x+.5,y+.5,19);
    ctx.beginPath();ctx.ellipse(gx,gy,10,12,-.35,0,2*Math.PI);ctx.fillStyle='#c99b55';ctx.fill();
    ctx.beginPath();ctx.ellipse(gx,gy,8,8,0,0,2*Math.PI);ctx.fillStyle='#4c92a3';ctx.fill();
    polygon([[gx-6,gy-4],[gx-1,gy-6],[gx+3,gy-3],[gx+1,gy],[gx-2,gy+2],[gx-4,gy+5],[gx-5,gy+1]],'#adc58b');
    polygon([[gx+4,gy+1],[gx+7,gy],[gx+7,gy+3],[gx+4,gy+6],[gx+2,gy+4]],'#c1cd98');
  }else if(type==='wardenStatue'){
    part(.09,.10,.82,.80,0,4,['#9fa1ab','#4c536a','#6b7284']);
    part(.15,.16,.70,.68,4,5,['#aeb3be','#525d6f','#778392']);part(.14,.15,.72,.70,9,1,'gold');
    const [wx,wy]=point(x+.5,y+.5,10),facing=rot===1||rot===2?-1:1;
    const shape=(points,color,edge)=>polygon(points.map(([u,v])=>[wx+u*facing,wy+v]),color,edge);
    shape([[-11,-4],[-12,-25],[-8,-29],[7,-28],[10,-13],[8,-4]],'#475464','#2d3649');
    shape([[-7,0],[-6,-13],[0,-14],[1,0]],'#8998a8','#3e4b5c');
    shape([[1,0],[2,-14],[8,-13],[9,0]],'#b6c0c7','#3e4b5c');
    shape([[-11,-27],[-5,-31],[6,-29],[11,-24],[7,-13],[-6,-13]],'#a7b3be','#445366');
    shape([[-6,-30],[-6,-39],[-1,-44],[5,-43],[9,-39],[8,-29],[0,-27]],'#bec8cb','#394b61');
    shape([[-4,-36],[7,-37],[7,-34],[-3,-33]],'#29364a');
    shape([[0,-43],[3,-44],[4,-38],[1,-37]],'#e6e9db');
    shape([[8,-12],[13,-37],[15,-40],[16,-36],[12,-11]],'#d7e0df','#59677d');
    shape([[6,-14],[15,-12],[15,-10],[6,-12]],'#e2bd7a');
    shape([[-15,-24],[-8,-27],[1,-23],[-1,-10],[-7,-5],[-13,-12]],'#dcb77b','#424f62');
    shape([[-13,-23],[-8,-25],[-1,-22],[-3,-11],[-7,-8],[-11,-13]],'#355d80');
    shape([[-10,-20],[-8,-21],[-7,-18],[-5,-21],[-4,-20],[-4,-15],[-10,-15]],'#efd197');
  }else if(type==='silverfinTank'){
    part(.05,.10,1.90,.80,0,5,'wood');part(.08,.13,1.84,.74,5,2,'gold');
    part(.11,.16,1.78,.68,7,21,['#8ecbc9','#357b94','#5599a7']);
    part(.14,.19,1.72,.62,27,.7,['#9bd8d8','#528ca4','#75b7c1']);
    part(.09,.14,1.82,.045,28,1,'cream');part(.09,.82,1.82,.045,28,1,'cream');
    for(const u of [.09,1.86]){
      part(u,.14,.045,.72,28,1,'cream');
      for(const v of [.14,.82])part(u,v,.045,.045,7,22,['#c3e8da','#79b5c2','#a4d6d7']);
    }
    const tankPoint=(u,v,z)=>{
      if(rot%2)[u,v]=[v,u];
      if(rot>=2){u=w-u;v=d-v;}
      return point(x+u,y+v,z);
    };
    const [ax,ay]=tankPoint(.99,.5,14);
    polygon([[ax-14,ay+4],[ax-11,ay-1],[ax-9,ay-5],[ax-9,ay+2],[ax-6,ay-2],[ax-7,ay+7]],'#3e7265');
    polygon([[ax+8,ay+6],[ax+8,ay+1],[ax+12,ay-3],[ax+11,ay+3],[ax+15,ay-1],[ax+12,ay+7]],'#82ae81');
    const motion=reducedMotion.matches?0:Math.sin(time/620)*3;
    for(const [offset,depth,dir,ink] of [[-6+motion,-5,1,'#dcf4d9'],[6-motion,2,-1,'#ffca80']]){
      const fx=Math.round(ax+offset),fy=Math.round(ay+depth);
      polygon([[fx-7*dir,fy-3],[fx-4*dir,fy-1],[fx-1*dir,fy-3],[fx+4*dir,fy-2],[fx+6*dir,fy],[fx+3*dir,fy+2],[fx-2*dir,fy+2],[fx-4*dir,fy+1],[fx-7*dir,fy+3]],ink,'#356176');
      rect(fx+3*dir,fy-1,1,1,'#233d50');
    }
    rect(ax+12,ay-9,2,2,'#c0e5dc');rect(ax+15,ay-13,1,1,'#c0e5dc');
    part(.06,.12,1.88,.76,6,1,['#c0b58f','#6b7b82','#a1b6b0']);
  }else if(type==='silkScreen'){
    for(const [index,u] of [.07,.70,1.33].entries()){
      part(u,.37,.57,.11,2,35,'wood');part(u+.04,.49,.49,.05,7,28,['#c2d8d5','#597986','#7ea0ae']);
      part(u+.09,.55,.41,.02,8,9,['#9fb198','#536c78','#6a8990']);
      for(const [shift,width,high] of [[.09,.12,16],[.20,.12,index===1?23:19],[.31,.15,14]]){
        part(u+shift,.55,width,.02,10,high,'blue');
        part(u+shift+.018,.57,width-.042,.015,10+high-3,2,'cream');
      }
      part(u,.36,.57,.15,35,2,'gold');part(u,.36,.57,.15,5,2,'gold');
      part(u,.35,.09,.26,0,5,'gold');
    }
  }else if(type==='woodStool'){
    for(const u of [.24,.66])for(const v of [.24,.66])part(u,v,.10,.10,0,8,'wood');
    part(.18,.22,.64,.56,8,3,['#d4a065','#6d4c46','#9e694c']);
    part(.23,.26,.54,.42,11,.5,['#e3b77a','#90604b','#b6845c']);
    part(.43,.30,.11,.32,11.5,.3,'trim');
  }else if(type==='woodTable'){
    for(const u of [.09,.81])for(const v of [.11,.77])part(u,v,.10,.10,0,17,'wood');
    part(.03,.08,.94,.84,17,3,['#cda776','#7e5c57','#a78261']);
    for(const u of [.24,.51,.78])part(u,.12,.022,.74,20,.2,['#e3bf8a','#a78261','#c19b70']);
    part(.23,.36,.30,.17,20,.7,'blue');part(.23,.37,.26,.15,20.7,.5,'cream');
    part(.67,.53,.13,.14,20,3,'cream');
  }else if(type==='bookcase'){
    part(.08,.08,1.84,.78,0,3,'wood');part(.10,.08,1.80,.12,3,31,'wood');
    for(const u of [.08,1.78])part(u,.12,.14,.68,3,32,'wood');
    for(const z of [3,16,30]){
      part(.11,.12,1.77,.65,z,2,'wood');
      if(z<30)for(let i=0;i<7;i++)part(.28+i*.20,.35,.12,.30,z+2,8+(i%3),['blue','cream','green','coral'][i%4]);
    }
    part(.04,.05,1.92,.82,35,2,'wood');
  }else if(type==='sofa'||type==='chair'){
    const length=type==='sofa'?2:1, cloth=type==='sofa'?'blue':'coral';
    for(const i of [.1,length-.22])for(const j of [.12,.77])part(i,j,.12,.12,0,4,'black');
    part(.02,.02,length-.04,.95,3,7,type==='sofa'?'trim':'pink');
    part(.06,.01,length-.12,.24,9,15,cloth);
    part(.025,.24,.14,.66,9,7,cloth);
    part(length-.165,.24,.14,.66,9,7,cloth);
    part(.18,.26,length-.36,.65,9,4,cloth);
    if(type==='sofa'){
      part(.22,.35,.32,.24,13,5,'gold');
      part(1.43,.32,.33,.27,13,5,'cream');
      part(.99,.33,.035,.55,13,.3,'trim');
    }else part(.24,.34,.25,.2,13,5,'cream');
  } else if(type==='bench'){
    for(const i of [.14,1.74]){
      part(i,.18,.14,.62,0,7,'black');
      part(i,.19,.11,.14,6,14,'black');
    }
    for(const y of [.30,.46,.62])part(.09,y,1.82,.13,7,2,'wood');
    for(const z of [12,16,20])part(.10,.15,1.8,.12,z,2,'wood');
    part(.08,.27,.13,.45,11,2,'black');
    part(1.79,.27,.13,.45,11,2,'black');
  } else if(type==='streetlamp'){
    const [px,py]=point(x+.5,y+.5,45);
    const glow=ctx.createRadialGradient(px,py,1,px,py,28);
    glow.addColorStop(0,'#ffce8c72');glow.addColorStop(1,'#ffce8c00');
    ctx.fillStyle=glow;ctx.fillRect(px-28,py-28,56,56);
    part(.25,.25,.5,.5,0,3,'black');
    part(.41,.41,.18,.18,3,9,'trim');
    part(.453,.453,.095,.095,12,29,'black');
    part(.34,.34,.32,.32,41,2,'black');
    part(.37,.37,.26,.26,43,8,'gold');
    part(.405,.405,.19,.19,44,7,'cream');
    part(.32,.32,.36,.36,51,2,'black');
    part(.43,.43,.14,.14,53,2,'gold');
  } else if(type==='fountain'){
    const stone=['#aab6bf','#687185','#8791a1'];
    part(.035,.035,1.93,1.93,0,4,stone);
    part(.09,.09,1.82,1.82,4,6,stone);
    part(.20,.20,1.60,1.60,10,1,['#44617a','#394a65','#41566d']);
    part(.26,.26,1.48,1.48,11,.5,['#6396a6','#4e758d','#558b9c']);
    for(const i of [.33,.63,1.05,1.36])part(i,.39,.21,.028,11.6,.2,['#9cc5c9','#80adb8','#91bbc0']);
    part(.78,.78,.44,.44,11.6,8,stone);
    part(.67,.67,.66,.66,19.6,2,stone);
    part(.83,.83,.34,.34,21.6,1,['#80aebd','#678a9d','#70a0ae']);
    const [px,py]=point(x+1,y+1,23);
    rect(px-1,py-13,2,14,'#c8e2df');
    rect(px,py-16,1,11,'#edf4de');
    const ripple=reducedMotion.matches?0:Math.floor(time/125)%7;
    for(const side of [-1,1]){
      for(let i=0;i<3;i++)rect(px+side*(3+i*3),py-10+i*4+(ripple+i)%3,2,2,'#a9d4db');
      rect(px+side*(8+ripple),py+10+(ripple%3),3,1,'#bee0df');
    }
  } else if(isGamingTable(item)){
    for(const i of [.19,1.68])for(const j of [.20,.68])part(i,j,.13,.13,0,10,'black');
    part(.13,.14,1.74,.72,6,4,'wood');
    part(.045,.075,1.91,.85,10,4,'wood');
    part(.09,.10,1.82,.80,14,1,'gold');
    part(.16,.155,1.68,.69,15,1,type==='blackjack'
      ?['#477f69','#2f5d58','#36665a']
      :['#95586f','#58354d','#70445c']);
    if(type==='blackjack'){
      for(const x of [.46,.92,1.38]){
        part(x,.60,.20,.16,16,.3,'cream');
        part(x+.03,.62,.14,.12,16.3,.3,'green');
      }
      part(.71,.26,.15,.19,16,.8,'cream');
      part(.84,.30,.15,.19,16,.8,'cream');
      part(.88,.34,.045,.035,16.8,.4,'coral');
      part(1.51,.25,.20,.21,16,2.6,'black');
      part(1.50,.28,.11,.15,18.6,.45,'cream');
      part(.27,.28,.12,.12,16,1.5,'coral');
      part(.32,.43,.11,.11,16,1.8,'blue');
    }else{
      const [u,v]=rot%2?[.50,.53]:[.53,.50];
      drawRouletteWheel(...point(x+(rot>=2?w-u:u),y+(rot>=2?d-v:v),19));
      part(.85,.26,.84,.47,16,.35,'trim');
      for(let row=0;row<3;row++)for(let col=0;col<5;col++){
        part(.88+col*.156,.282+row*.142,.129,.108,16.4,.25,(row+col)%2?'coral':'black');
      }
      part(1.66,.74,.105,.10,16,1.4,'gold');
    }
  } else if(type==='anvil'){
    part(.23,.21,.54,.58,0,8,'wood');part(.34,.3,.32,.34,8,7,'black');
    part(.12,.18,.76,.56,15,4,['#bcc4bd','#4f5364','#818995']);
    part(.80,.31,.18,.20,16,2,['#d2d7c9','#596070','#9ca8ae']);
  } else if(type==='brazier'){
    part(.2,.2,.6,.6,0,5,'black');part(.3,.3,.4,.4,5,7,'trim');
    const [fx,fy]=point(x+.5,y+.5,12),flicker=reducedMotion.matches?0:Math.round(Math.sin(time/130)*2);
    rect(fx-5,fy-6,10,6,'#c77558');rect(fx-3,fy-12-flicker,6,11+flicker,'#f3b36e');rect(fx-1,fy-9,3,8,'#ffe2a0');
  } else if(type==='weaponRack'){
    part(.04,.07,1.90,.83,0,3,'wood');part(.08,.12,1.82,.12,3,30,'wood');
    for(let i=0;i<3;i++){
      const [rx,ry]=point(x+.35+i*.55,y+.5,3);
      rect(rx-1,ry-30,2,29,'#826153');rect(rx-2,ry-31,4,15-i*4,'#c4d4d0');
      rect(rx-4,ry-16+i*4,8,2,'#e1bf82');
    }
  } else if(type==='rodRack'){
    part(.06,.26,1.88,.49,0,4,'wood');
    part(.1,.33,.14,.15,4,31,'wood');part(1.75,.33,.14,.15,4,31,'wood');
    part(.1,.33,1.79,.15,29,3,'wood');
    for(let i=0;i<4;i++){
      const [rx,ry]=point(x+.38+i*.39,y+.56,3);
      rect(rx,ry-32,1,33,['#c7af8c','#cf9568','#b6d6d4','#d1aedc'][i]);
      rect(rx-1,ry-5,3,5,'#42394d');
      rect(rx+1,ry-12,2,3,'#cfbda7');
    }
  } else if(type==='harvestCrates'){
    part(.07,.09,.86,.83,0,8,'wood');
    part(.13,.15,.74,.71,8,.5,'black');
    part(.20,.20,.59,.52,8.5,3,'clay');
    part(.27,.24,.39,.33,11.5,2,'cream');
    part(.16,.14,.10,.72,8.5,5,'wood');part(.75,.14,.10,.72,8.5,5,'wood');
  } else if(type==='baitCrates'){
    part(.08,.1,.84,.8,0,10,'wood');
    part(.11,.13,.78,.74,10,1,'gold');
    for(let i=0;i<3;i++)part(.22+i*.20,.26,.13,.4,11,5,i%2?'blue':'cream');
  } else if(type==='armoryCounter'||type==='reception'||type==='tackleCounter'||type==='tradeCounter'){
    const [sx,sy]=point(x+1.46,y-.2,2);
    sprite(ctx,sx,sy,{outfit:4,hair:1});
    part(.06,.08,2.88,.87,0,19,'wood');
    part(.13,.91,2.73,.045,4,11,'black');
    for(let i=.25;i<2.85;i+=.23)part(i,.938,.055,.025,3,13,'gold');
    part(.01,.025,2.98,.97,19,4,'black');
    part(.08,.07,2.84,.87,23,.65,type==='reception'?['#41546b','#2c3b57','#526179']:'pink');
    if(type==='reception'){
      part(.06,.93,2.86,.055,19,2,['#f2d197','#a47959','#c09066']);
      drawLobbyCrest(...point(x+1.5,y+.98,11));
    }
    part(.28,.43,.46,.29,23,1,'cream');
    part(1.63,.63,.20,.19,23,3,'gold');
    part(1.68,.68,.09,.08,26,1,'cream');
    part(2.4,.27,.32,.42,23,7,'trim');
    part(2.39,.25,.34,.41,30,1,'blue');
  } else if(type==='stove'){
    part(.09,.09,.82,.82,0,3,'black');part(.06,.06,.88,.88,3,21,['#758a91','#35444f','#4b6067']);
    part(.12,.91,.76,.035,6,14,'black');part(.19,.95,.62,.025,8,10,['#e0a568','#854e45','#b77751']);
    part(.23,.978,.54,.02,10,6,'gold');
    part(.04,.04,.92,.92,24,3,'black');
    for(const u of [.24,.63])for(const v of [.24,.63]){part(u-.1,v-.1,.23,.23,27,.5,'gold');part(u-.06,v-.06,.15,.15,27.6,.4,'black');}
    part(.27,.27,.38,.38,28,6,'trim');part(.24,.25,.45,.07,33,1,'gold');part(.30,.31,.30,.30,34,.5,'clay');
    const [sx,sy]=point(x+.48,y+.48,38);ctx.save();ctx.globalAlpha=.38;ctx.fillStyle='#d8dfcc';const drift=reducedMotion.matches?0:(time%1800)/1800;ctx.fillRect(sx-2,sy-drift*10,2,3);ctx.fillRect(sx+3,sy-4-drift*13,2,3);ctx.restore();
  } else if(type==='safe'){
    for(const i of [.17,.72])for(const j of [.17,.72])part(i,j,.10,.10,0,3,'black');
    part(.08,.08,.84,.84,3,22,['#71849b','#29374e','#425570']);
    part(.065,.065,.87,.87,25,2,'gold');
    part(.14,.90,.72,.035,6,17,'black');
    part(.19,.94,.62,.025,8,14,['#526985','#28364c','#344a66']);
    for(const i of [.20,.72]){part(i,.955,.055,.025,9,2,'gold');part(i,.955,.055,.025,19,2,'gold');}
    part(.43,.97,.16,.025,13,5,'gold');
    part(.49,.997,.045,.025,12,7,'cream');
    part(.40,.997,.23,.025,14,.8,'cream');
  } else if(isRestBed(type)){
    for(const i of [.13,1.75])for(const j of [.12,.76])part(i,j,.12,.12,0,4,'black');
    part(.02,.02,1.95,.94,3,5,'wood');
    part(.13,.075,1.73,.83,8,4,'cream');
    part(.04,.045,.12,.9,7,16,'wood');
    part(.03,.028,.16,.94,23,1,'gold');
    part(.25,.19,.42,.6,12,3,['#ffebc9','#bc938e','#dec0a9']);
    part(.76,.08,1.12,.83,12,2,type==='royalBed'?['#a18acb','#554371','#796190']:type==='comfortBed'?['#7cbeb5','#345e69','#518e92']:'blue');
    if(type==='comfortBed'){
      part(.08,.14,.16,.72,13,10,['#7facad','#45616f','#5f8c8f']);
      for(const v of [.30,.54])part(.25,v,.02,.045,18,1,'cream');
    }
    if(type==='royalBed'){
      part(.04,.07,.18,.86,12,16,['#ab8fbd','#563c68','#76548a']);
      for(const v of [.035,.81]){
        part(.015,v,.17,.15,7,23,'gold');part(.03,v+.02,.13,.11,30,3,'cream');
      }
      part(.16,.27,.09,.46,26,4,'gold');part(.17,.40,.08,.20,30,3,'gold');
      part(1.80,.05,.15,.90,6,7,'wood');part(1.81,.04,.16,.92,13,1,'gold');
      part(.76,.08,1.03,.055,14,.5,'gold');
    }
    part(.75,.08,.16,.83,14,1,'trim');
    part(1.55,.105,.04,.78,14,.3,'trim');
    if(homeBedRest&&atHome()&&homeBedRest.bedId===item.id){
      let u=.43,v=.5;if(rot%2)[u,v]=[v,u];if(rot>=2){u=w-u;v=d-v;}
      const [hx,hy]=point(x+u,y+v,16);ctx.save();ctx.translate(hx,hy+17);ctx.scale(.65,.65);pixelHead(ctx,avatar,false,true);ctx.restore();
      const drift=reducedMotion.matches?0:(time%1600)/1600;ctx.save();ctx.fillStyle='#b4e9d2';ctx.font='bold 7px monospace';ctx.fillText('z Z',hx+8,hy-8-drift*10);ctx.restore();
    }
  } else if(type==='table'){
    for(const i of [.15,.7])for(const j of [.14,.72])part(i,j,.09,.09,0,10,'black');
    part(.065,.075,.86,.85,10,3,'wood');
    part(.25,.26,.32,.24,13,1,'pink');
    part(.27,.27,.28,.18,14,1,'cream');
    part(.65,.55,.16,.17,13,4,'cream');
    part(.674,.574,.108,.118,17,.3,'black');
  } else if(type==='stool'){
    part(.25,.24,.5,.5,0,2,'black');
    part(.44,.43,.11,.11,2,12,'gold');
    part(.2,.2,.6,.6,14,4,'coral');
  } else if(type==='lamp'){
    const [sx,sy]=point(x+.5,y+.5,29);
    const glow=ctx.createRadialGradient(sx,sy,2,sx,sy,21);glow.addColorStop(0,'#ffc06b44');glow.addColorStop(1,'#ffc06b00');
    ctx.fillStyle=glow;ctx.fillRect(sx-22,sy-22,44,44);
    part(.26,.26,.48,.48,0,2,'black');
    part(.47,.47,.06,.06,2,27,'gold');
    part(.24,.23,.52,.54,28,9,'gold');
    part(.34,.33,.32,.34,37,2,'cream');
  } else if(type==='plant'){
    part(.25,.24,.50,.52,0,9,'clay');part(.21,.20,.58,.60,8,3,'clay');part(.27,.26,.46,.48,11,.4,'black');
    const [px,py]=point(x+.5,y+.5,10);
    polygon([[px-3,py],[px+1,py],[px+2,py-24],[px-1,py-24]],'#6a8658');
    for(const [u,v,tint] of [[-16,-15,'#527b62'],[14,-13,'#4a795e'],[-13,-25,'#659270'],[14,-23,'#76a876'],[-6,-33,'#97b981'],[8,-31,'#83ad73']]){
      const dir=Math.sign(u);
      polygon([[px,py-19],[px+u*.55,py+v-3],[px+u,py+v],[px+u-dir*2,py+v+5],[px+u*.45,py+v+4],[px,py-16]],tint,'#3a5e50');
    }
  } else if(type==='bar'){
    block(x+.1,y+.14,1.25,3.98,0,19,shades.wood);
    for(let i=.3;i<3.9;i+=.34)block(x+1.345,y+i,.021,.07,2,15,shades.gold);
    block(x+.02,y+.04,1.42,4.13,19,4,shades.black);
    surface(x+.11,y+.15,1.25,3.92,23.1,'#966470');
    for(let i=0;i<3;i++)block(x+.93,y+.52+i*1.16,.16,.19,23,3,shades.cream);
    block(x+.26,y+2.88,.43,.63,23,9,shades.trim);
    block(x+.21,y+2.83,.56,.71,31,2,shades.blue);
    block(x+.39,y+2.97,.24,.31,23,2,shades.cream);
    block(x+.29,y+.54,.15,.31,23,7,shades.green);
  } else if(type==='shelf'){
    for(const z of [34,42]){
      block(x,y+.13,.27,3.38,z,2,shades.wood);
      for(let i=0;i<10;i++){
        const c=[shades.green,shades.gold,shades.coral,shades.blue][(i+z)%4];
        block(x+.035,y+.23+i*.31,.14,.13,z+2,3+i%3,c);
        block(x+.06,y+.25+i*.31,.08,.09,z+5+i%3,1,c);
      }
    }
  }
}
function drawRouletteWheel(x,y){
  const ellipse=(rx,ry,color,offset=0)=>{
    ctx.beginPath();ctx.ellipse(x,y+offset,rx,ry,0,0,2*Math.PI);ctx.fillStyle=color;ctx.fill();
  };
  ellipse(9,4.9,'#39293e',2);
  ellipse(9,4.8,'#e7ad73');
  ellipse(7.5,3.9,'#4f3146');
  for(let i=0;i<12;i++){
    ctx.beginPath();ctx.moveTo(x,y);
    ctx.ellipse(x,y,6.5,3.2,0,i*Math.PI/6,(i+1)*Math.PI/6);
    ctx.closePath();ctx.fillStyle=i===0?'#638e75':i%2?'#cb787c':'#3a3044';ctx.fill();
  }
  ellipse(3.3,1.6,'#a26858');
  rect(x-1,y-2,2,2,'#ffd193');
  rect(x+4,y-2,1,1,'#fff1d7');
}
function pixelHead(target,appearance,back,blink){window.towerCharacterArt.head(target,appearance,back,blink);}
function sprite(target,x,y,appearance,options={}){
  return window.towerCharacterArt.draw(target,x,y,appearance,{...options,reduced:reducedMotion.matches});
}
function makeRoomLayer(drawLayer,layerView=standardView){
  const layer=document.createElement('canvas');
  layer.width=layerView.width;layer.height=layerView.height;
  const previousContext=ctx,previousView=view;
  ctx=layer.getContext('2d');view=layerView;
  drawLayer();
  ctx=previousContext;view=previousView;
  return layer;
}
const worldDrawing={point,polygon,surface,block,rect};
const roomLayers={
  tailor:makeRoomLayer(()=>{drawFishingStore('tailor');for(const [x,y,index] of [[7.7,.7,7],[.7,2,8],[.7,8,9]]){const [px,py]=point(x,y,24);sprite(ctx,px,py,{outfit:index,trousers:index-3,boots:index-3,hair:1},{time:0});}surface(3.3,5,3.4,3,.5,'#603d62','#c4a078');}),
  hub:makeRoomLayer(()=>drawGrandLobby(),hubView),
  hubIntro:makeRoomLayer(()=>drawGrandLobby(false),hubView),
  lounge:makeRoomLayer(()=>{room();drawDoor(storeExit);}),
  outside:makeRoomLayer(drawCourtyard,courtyardView),
  store:makeRoomLayer(drawFishingStore),
  market:makeRoomLayer(()=>{drawFishingStore(true);drawDoor(bakeryDoor);}),
  bakery:makeRoomLayer(drawBakery),
  [factionHall]:makeRoomLayer(drawFactionHall),
  furnishings:makeRoomLayer(()=>drawFishingStore('furnishings')),
  armory:makeRoomLayer(()=>drawFishingStore('armory'))
};
for(const id of Object.keys(moonwood.areas)){
  roomLayers[id]=makeRoomLayer(()=>moonwood.drawGround(id,worldDrawing),id===wildlifeRoom?wildlifeView:moonwood.view);
}
function drawMoonwoodDetails(time){
  moonwood.drawWater(currentRoom,time,{...worldDrawing,ctx,reduced:reducedMotion.matches,depthsRun,progress:adventure});
  if(currentRoom==='grove'&&adventure.groveTrail){
    for(const [x,y] of moonwood.layouts.grove.hiddenTrail){
      surface(x+.06,y+.06,.88,.88,.25,'#6d8195','#8fb6b9');
      surface(x+.42,y+.42,.16,.16,.35,'#bedace');
    }
  }
  if(currentRoom==='creek'&&adventure.bridge){
    for(let i=0;i<3;i++){
      block(5.05+i*.31,4.25+(i%2)*.07,.26,.50,-1,3,['#afc9c7','#577489','#779da7']);
      surface(5.10+i*.31,4.32+(i%2)*.07,.12,.15,2.2,'#e0ded0');
    }
  }
  for(const door of roomDoors[currentRoom]){
    if(!moonwood.open(door,adventure))continue;
    const {x,y}=door.tile;
    surface(x+.09,y+.09,.82,.82,.55,'#638c9a','#a5c7c7');
    const [px,py]=point(x+.5,y+.5);
    const label=door.label,width=label.length*4+8;
    rect(px-1,py-12,2,12,'#597984');
    rect(px-width/2,py-23,width,11,'#233646');
    rect(px-width/2,py-23,width,1,'#85b4b3');
  }
}
const explorationRegions={
  'The Tower':['home','hub','outside','lounge','market','bakery','armory','store','furnishings','tailor'],
  Willowmere:willowmereRooms,
  Beaconwatch:watchRooms,
  Moonwood:['trail',wildlifeRoom,'logging','clearing','grove','shrine','creek','pond','ruins','roots']
};
let trackedDestination=null,trackedMoonTrail=null,roomMoonTrails=[],trailListKey='';
function openMoonTrail(trail){
  if(trail.until<=combatNow())return false;
  const index=[trail.room,...trail.route].indexOf(currentRoom);
  if(index<0)return false;
  let from=currentRoom;
  for(const to of trail.route.slice(index)){
    if(!hudRoomExits(from).some(door=>door.to===to))return false;
    from=to;
  }
  return true;
}
function updateSharedTrailList(){
  if(!$('hudMapDialog').open)return;
  const trails=$('hudMapTitle').textContent==='Tower shops'?[]:roomMoonTrails.filter(openMoonTrail);
  const key=JSON.stringify(trails);
  if(key===trailListKey)return;
  trailListKey=key;
  const list=$('mapSharedTrails');list.replaceChildren();
  for(const trail of trails){
    const button=document.createElement('button');button.type='button';
    button.textContent='✧ Follow '+explorationName(trail.route.at(-1))+' · '+trail.name;
    button.onclick=()=>{
      if(!openMoonTrail(trail)){updateSharedTrailList();return;}
      setExplorationDestination(trail.route.at(-1));trackedMoonTrail=trail;
      updateExplorationNav();$('hudMapDialog').close();canvas.focus();
    };
    list.append(button);
  }
  previewMapRoute();
}
function receiveMoonTrails(trails){
  roomMoonTrails=trails.filter(trail=>trail&&trail.player!==multiplayer?.selfId&&Array.isArray(trail.route)&&trail.route.length&&trail.route.length<=3&&trail.route.every(room=>Object.hasOwn(roomDetails,room))).map(trail=>({...trail,room:currentRoom}));
  updateSharedTrailList();
}
function explorationName(room){
  if(room===wildlifeRoom)return 'Wildlife Reserve';
  if(room==='starfall'&&!adventure.discovered.includes('starfall'))return 'Root crack · Explore';
  return {home:'Your Home',hub:'Grand Lobby',market:'Trading Post',store:'Silverfin Outfitters',outside:'Tower Courtyard'}[room]??roomDetails[room].name;
}
function nextExplorationDoor(){
  if(trackedMoonTrail){
    if(!openMoonTrail(trackedMoonTrail))return null;
    const index=[trackedMoonTrail.room,...trackedMoonTrail.route].indexOf(currentRoom);
    return hudRoomExits(currentRoom).find(door=>door.to===trackedMoonTrail.route[index])??null;
  }
  return trackedDestination&&!depthsRun?hudNextDoor(trackedDestination):null;
}
let worldLabelKey='';
function updateWorldLabels(){
  const p=canvasBounds(),doors=roomDoors[currentRoom].filter(door=>doorAvailable(door));
  const stump=currentRoom==='logging'&&!!treeState(timberTree()).regrowsAt;
  const key=[currentRoom,watchFlags.map(k=>adventure[k]).join(','),player.seat?.type,homeBedRest?.bedId,editing,currentRoom==='home'?homeFurniture.map(i=>[i.id,i.type,i.x,i.y,i.rot].join(':')).join(';'):'',stump,depthsRun?.finds?.join(','),depthsRun?.cleared,depthsRun?.routeChoice,depthsRun?.cacheGuardDefeated,doors.map(door=>door.to).join(','),avatar.name,questStage(quest),depthsDiscovered,player.inCombat,firstUpgrade.choice,firstUpgrade.complete,firstUpgrade.oakTrialPending,firstUpgrade.unlocked,firstUpgradeDestination()?.to,tradingPostGuideComplete,bedLessonComplete,trackedDestination,zoom,p.scale,p.x,p.y,canvas.clientWidth,canvas.clientHeight].join('|');
  if(key===worldLabelKey)return;
  worldLabelKey=key;
  const container=$('worldLabels');container.replaceChildren();container.dataset.room=currentRoom;
  const add=(text,x,y,kind='door',action=null,subtitle='',mount=null)=>{
    const label=document.createElement(action?'button':'div');label.className='world-label world-label-'+kind;
    if(action){label.type='button';label.onclick=action;label.setAttribute('aria-label',kind==='door'?'Go to '+text:text);}
    const title=document.createElement('span');title.textContent=text;label.append(title);
    if(subtitle){const detail=document.createElement('small');detail.textContent=subtitle;label.append(detail);}
    label.title=text+(subtitle?' · '+subtitle:'');

    container.append(label);
    const centerX=view.width/2,centerY=view.height/2-4;
    const screenX=p.x+((x-centerX)*zoom+centerX)*p.scale,screenY=p.y+((y-centerY)*zoom+centerY)*p.scale;
    if(currentRoom==='home'&&kind!=='npc'){
      const scale=p.scale*zoom;
      label.dataset.wall=kind==='sign'?'right':'left';
      const sign=kind==='sign';
      label.style.width=Math.round((sign?79:20)*scale)+'px';
      label.style.maxWidth='none';label.style.padding='0';
      label.style.fontSize=Math.max(9,Math.round((sign?5.2:6)*scale))+'px';
      label.style.lineHeight='1.25';
      label.style.transform=sign?'skewY(26.565deg)':'skewY(-26.565deg)';
      if(subtitle){label.children[1].style.fontSize=Math.max(12,Math.round(8*scale))+'px';label.children[1].style.lineHeight='1.3';}
    }
    if(mount){
      const scale=p.scale*zoom;label.dataset.wall=mount.side;
      label.style.width=Math.round(mount.width*scale)+'px';label.style.maxWidth='none';
      label.style.padding='0';label.style.fontSize=Math.max(9,Math.round((mount.font??6)*scale))+'px';
      label.style.lineHeight='1.2';label.style.transform=mount.side==='right'?'skewY(26.565deg)':'skewY(-26.565deg)';
      if(subtitle){label.children[1].style.fontSize=Math.max(9,Math.round((mount.font??6)*scale))+'px';label.children[1].style.lineHeight='1.2';}
    }
    const width=label.offsetWidth||text.length*7+16,height=label.offsetHeight||(subtitle?30:19);
    const availableWidth=canvas.clientWidth||view.width*p.scale,availableHeight=canvas.clientHeight||view.height*p.scale;
    label.style.left=Math.round(Math.max(5,Math.min(availableWidth-width-5,screenX-width/2)))+'px';
    label.style.top=Math.round(Math.max(5,Math.min(availableHeight-height-5,screenY-height/2)))+'px';
    return label;
  };
  const guidedDoor=nextExplorationDoor()??(tradingGuideActive()?tradingGuideDestination():firstUpgradeDestination());
  for(const door of doors){
    let anchor;
    if(door.side==='wild'){anchor=point(door.tile.x+.5,door.tile.y+.5,18);}
    else if(door.side==='front'){anchor=point((door.start+door.end)/2,view.rows-.45,12);}
    else anchor=door.side==='right'?point((door.start+door.end)/2,0,door.height+9):point(0,(door.start+door.end)/2,door.height+9);
    const label=currentRoom==='creek'&&door.to==='ruins'?'Cross to the Ruins':door.side==='wild'?explorationName(door.to):door.label;
    const sign=add(label,...anchor,'door',()=>travelDoor(door),'',currentRoom!=='home'&&['left','right'].includes(door.side)?{side:door.side,width:(door.end-door.start+.08)*18,font:5.6}:null);
    if(door.to===guidedDoor?.to)sign.dataset.guided='true';
  }
  if(currentRoom==='tailor')add('Tailor · Browse outfits',...point(4.5,2.5,39),'npc',()=>use(tailorFurniture[0]),'The Gilded Thread');
  if(currentRoom==='furnishings')add('Browse furniture',...point(4.5,1.5,39),'npc',()=>use(furnishingsFurniture.find(item=>item.type==='reception')),'Tower Furnishings');
  if(currentRoom==='home'&&!homeBedRest&&!editing){const stove=homeFurniture.find(i=>i.type==='stove');if(stove)add('Cook',...point(stove.x+.5,stove.y+.5,36),'npc',()=>use(stove),'Home kitchen');}
  if(currentRoom==='home'&&!homeBedRest&&!editing){const item=bestHomeBed({homeFurniture,ownedFurniture});if(item)add('Rest',...point(item.x+.5,item.y+.5,29),'npc',()=>use(item),bedProfiles[item.type].rate+' HP / sec');}
  if(currentRoom==='home')for(const item of homeFurniture.filter(item=>item.type==='safe'))add('Home safe',...point(item.x+.5,item.y+.5,31),'npc',()=>use(item),'Gold & item storage');
  if(currentRoom==='home')add('YOUR HOME',...point(5,0,44),'sign',null,avatar.name);
  if(currentRoom===factionHall){
    for(const [type,label,height] of [['hallBoard','Project board',37],['bench','Rest',27],['stove','Field kitchen',35]]){
      const item=factionHallFurniture.find(entry=>entry.type===type);
      add(label,...point(item.x+.5,item.y+.5,height),'npc',()=>use(item));
    }
  }
  if(currentRoom==='bakery')add('Baker',...point(foodStall.x+.5,foodStall.y+.5,47),'npc',()=>use(bakeryFurniture[0]),'Buy Tower Bread');
  if(currentRoom==='hub'){
    const registrar=hubFurniture.find(item=>item.type==='factionRegistrar');
    add(factionRegistrar.name,...point(registrar.x+.5,registrar.y+.5,45),'npc',()=>use(registrar));
    if(lobbyRoutesOpen())add('Job board',...point(4.5,2,39),'npc',openJobBoard);
    if(!lobbyRoutesOpen())add('TOWER OF',...point(0,2.7,52),'sign',null,'BEGINNINGS',{side:'left',width:51,font:6});
    const symbol=questStage(quest)===0?'! ':questStage(quest)===4?'? ':'';
    add(symbol+'Tower Warden',...point(10.5,3.5,46),'npc',()=>use(hubFurniture.find(item=>item.type==='warden')),questStage(quest)===0?'Start here · Earn your first gold':'');
  }
  if(currentRoom==='outside')add('Training courtyard',...point(9.5,4.5,66),'npc',()=>use(courtyardFurniture.find(item=>item.type==='trainingDummy')),'Safe combat practice');
  if(currentRoom===wildlifeRoom)for(const habitat of Object.values(wildlifeHabitats))add(habitat.name,...point(habitat.anchor.x+.5,habitat.anchor.y+.5,19),'sign');
  if(currentRoom==='trail'){
    const campfire=roomFurniture().find(item=>item.type==='campfire');
    add('Campfire',...point(campfire.x+.5,campfire.y+.5,32),'npc',()=>use(campfire));
  }
  if(currentRoom==='armory')add('Enchanter',...point(6.5,5.5,45),'npc',()=>use(roomFurniture().find(item=>item.type==='enchanter')));
  if(willowmereRooms.includes(currentRoom)){
    for(const item of roomFurniture())if(['riverTrader','riverBench','fishingPost'].includes(item.type)&&!(item.type==='riverBench'&&player.seat===item))add(item.type==='riverTrader'?'River trader':item.type==='riverBench'?(currentRoom==='millbrook'?'Rest by the mill':'Riverside bench'):'Fishing station',...point(item.x+.5,item.y+.5,item.type==='riverTrader'?42:25),'npc',()=>use(item));
  }
  if(watchRooms.includes(currentRoom)){
    for(const item of roomFurniture()){
      const label=watchInteractLabel(currentRoom,item.type,adventure);
      if(label)add(label,...point(item.x+.5,item.y+.5,moonwood.heights[item.type]+9),'npc',()=>use(item));
      if(item.type==='fishingPost')add('Hidden fishing pool',...point(item.x+.5,item.y+.5,31),'npc',()=>use(item));
    }
  }
  if(currentRoom==='logging'){
    add('Workbench',...point(6,3.5,26),'npc',()=>use(roomFurniture().find(item=>item.type==='workbench')));
    add('Woodcutter',...point(4.5,3.5,43),'npc',()=>use(roomFurniture().find(item=>item.type==='woodcutter')));
    if(stump)add('Regrowing',...point(6.5,5.5,13),'sign');
    else add('Timber',...point(6.5,5.5,54),'npc',()=>use(timberTree()));
  }
  if(depthsRun&&!player.inCombat){
    for(const item of roomFurniture().filter(i=>i.type==='dungeonArch'||i.type==='dungeonExit')){
      const name=item.type==='dungeonArch'?(depthsRun.cleared?'Bank spoils & leave':'Return to the ruins')
        :depthsEnemyAvailable(depthsRun,currentRoom)?'Passage locked'
        :currentRoom==='depthsVault'?'Bank spoils & leave'
        :currentRoom==='depthsGallery'?'To the Sunken Vault'
        :depthsRun.routeChoice==='pending'?'Choose a passage'
        :depthsRun.routeChoice==='dangerous'&&!depthsRun.cacheGuardDefeated?'To the Sealed Alcove':'To Shell Gallery';
      add(name,...point(item.x+.5,item.y+.5,60),'npc',()=>use(item));
    }
    const passage=roomFurniture().find(item=>item.type==='cachePassage');
    if(passage&&depthsSideForRoom(currentRoom))add('Shell Gallery ←',...point(passage.x+.5,passage.y+.5,38),'npc',()=>visitDungeonSide('return'));
    if(currentRoom==='depthsGallery'&&depthsRun.cleared===2)add('Optional rooms',...point(4.5,2.5,35),'npc',openDungeonSideChoices,'Treasure · Rest · Challenge');
    if(currentRoom==='depthsRest')add('Rest shrine',...point(6.5,4.5,40),'npc',useDungeonShrine,depthsRun.shrineUsed?'Blessing used':'30 HP · 15 unbanked gold');
    if(passage&&(currentRoom===depthsCacheRoom||canEnterDepthsCache(depthsRun,currentRoom)))add(currentRoom===depthsCacheRoom?(depthsCacheReturn(depthsRun)==='depthsGate'?'Flooded Gate ←':'Shell Gallery →'):'Essence Cache →',...point(passage.x+.5,passage.y+.5,38),'npc',()=>use(passage));
    for(const item of roomFurniture()){
      const find=Object.hasOwn(depthsFinds,item.type)?depthsFinds[item.type]:null;
      if(!find||depthsRun.finds?.includes(item.type)&&item.type!=='vaultRelief')continue;
      const label=item.type==='essenceCache'&&!depthsRun.cacheGuardDefeated?'Essence Cache · Sealed':find.label;
      add(label,...point(item.x+.5,item.y+.5,moonwood.heights[item.type]+8),'npc',()=>use(item));
    }
  }
  if(currentRoom==='shrine'||currentRoom==='ruins'){
    const landmark=roomFurniture().find(item=>item.id==='landmark');
    add(currentRoom==='shrine'?'Moth Shrine':'Moonwell',...point(landmark.x+.5,landmark.y+.5,35),'npc',()=>use(landmark));
  }
  if(currentRoom==='ruins'&&depthsDiscovered&&!unavailable()){
    add('Moonwell Depths',...point(7.4,3.4,19),'npc',reviewDepthsEntrance,'Review expedition');
  }
  if(currentRoom==='lounge')add('SUNSET LOUNGE',...point(0,2.3,51),'sign',null,'',{side:'left',width:48,font:5.2});
  if(['store','market','armory','furnishings'].includes(currentRoom)){
    const names={furnishings:['TOWER','FURNISHINGS'],store:['SILVERFIN','OUTFITTERS'],market:['MOONWOOD','TRADING POST'],armory:['TOWER','ARMORY']};
    add(names[currentRoom][0],...point(3.42,0,46),'sign',null,names[currentRoom][1],{side:'right',width:58,font:5.7});
  }
}
function draw(time){
  renderedActors.length=0;
  const {width,height}=view,centerX=width/2,centerY=height/2-4;
  const enemy=huntEnemyForRoom(currentRoom);
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,width,height);
  const [shakeX,shakeY]=enemy?combatShake(time,combatArt,reducedMotion.matches):[0,0];
  ctx.translate(shakeX,shakeY);ctx.translate(centerX,centerY);ctx.scale(zoom,zoom);ctx.translate(-centerX,-centerY);
  const layer=currentRoom==='hub'&&!lobbyRoutesOpen()?'hubIntro':currentRoom;
  ctx.imageSmoothingEnabled=false;ctx.drawImage(roomLayers[layer],0,0);
  if(currentRoom==='hub'&&!lobbyRoutesOpen()){
    const [wx,wy]=point(10.5,3.5);
    lobbyLight(wx,wy,25,'#efc87955',.48);
    const pulse=reducedMotion.matches?1:.72+Math.sin(time/600)*.18;
    ctx.save();ctx.globalAlpha=pulse;
    surface(10.06,3.06,.88,.88,.5,'#f5cf7d12','#dfbb76');
    ctx.restore();
  }
  if(moonwood.has(currentRoom))drawMoonwoodDetails(time);
  if(roomMoonTrails.length||trackedMoonTrail)for(const door of hudRoomExits(currentRoom)){
    if(!door.tile)continue;
    const marked=roomMoonTrails.some(trail=>trail.until>combatNow()&&trail.route[0]===door.to)
      ||trackedMoonTrail&&nextExplorationDoor()?.to===door.to;
    if(marked)surface(door.tile.x+.08,door.tile.y+.08,.84,.84,1,'#b8adff55','#ded6ff');
  }
  if(currentRoom===wildlifeRoom){
   const animal=wildAnimal(selectedWildAnimal,combatNow());
   if(animal&&!familiarState.owned.includes(animal.kind)){
    const {trial,stage,habitat,trust}=bondStep(familiarState,animal),color=familiars[animal.kind].color;
    const spot=trial?.tile??(trust.step<=1?habitat.forage:null);
    if(spot){
     const {x,y}=spot;surface(x+.13,y+.13,.74,.74,.6,color+'44',color);
     const [px,py]=point(x+.5,y+.5,12);
     polygon([[px,py-5],[px+5,py],[px,py+5],[px-5,py]],color,'#223f40');
     if(stage==='tracks'||stage==='trailEnd'){rect(px-4,py+4,2,2,color);rect(px+2,py+7,2,2,color);}
    }
   }
   const age=time-(wildlifeTrialEffect?.at??-Infinity);
   if(age>=0&&age<950){
    const {x,y}=wildlifeTrialEffect.tile,[px,py]=point(x+.7,y+1.7,1);
    const span=reducedMotion.matches?12:5+age/45;
    ctx.save();ctx.globalAlpha=1-age/950;ctx.strokeStyle='#c8f0e6';ctx.beginPath();ctx.ellipse(px,py,span,span*.45,0,0,Math.PI*2);ctx.stroke();ctx.restore();
   }
  }
  drawEnvironmentFx({room:currentRoom,ctx,point,time,reduced:reducedMotion.matches,inCombat:player.inCombat,
    sluiceOpen:depthsRun?.finds?.includes('sluiceLever')});
  drawTradingGuide(time);
  if(enemy)drawCombatGroundFx({ctx,point,time,now:combatNow(),encounter:hunting.encounter,player,reduced:reducedMotion.matches});
  if(target)surface(target.x+.1,target.y+.1,.8,.8,1,currentRoom==='home'?'#b7e9e220':'#fff3bc30',currentRoom==='home'?'#98cec9':'#ffcf8f');
  if(hover){
    const [w,d]=editing&&selection?dimensions(selection):[1,1];
    const valid=editing&&selection?canPlace({...selection,x:hover.x,y:hover.y}):!blocked(hover.x,hover.y);
    const homeHover=currentRoom==='home'&&!editing;
    surface(hover.x+.035,hover.y+.035,w-.07,d-.07,1,valid?(homeHover?'#c8e5e81c':'#fff3bc34'):'#eb6c7144',valid?(homeHover?'#acd2d8':'#ffe0a3'):'#e58b87');
  }
  let ghost;
  if(editing&&selection&&hover&&canPlace({...selection,...hover})){
    ghost={...selection,...hover,id:-1};
  }
  for(const peer of remotePeers.values()){
    const amount=reducedMotion.matches?1:Math.min(1,Math.max(0,time-peer.lastFrame)/90);
    peer.rx+=(peer.x-peer.rx)*amount;peer.ry+=(peer.y-peer.ry)*amount;peer.lastFrame=time;
  }
  const wild=currentRoom===wildlifeRoom?wildlifeAnimals(combatNow()).map(animal=>({...animal,type:'wildAnimal'})):[];
  const items=[...roomFurniture(),...wild,...[...remotePeers.values()].map(peer=>({type:'remotePlayer',x:peer.rx,y:peer.ry,peer}))];
  if(enemy&&time-combatArt.victoryAt>=0&&time-combatArt.victoryAt<1300){
    const monster=moonwood.layouts[currentRoom].scenery.find(item=>item.type===enemy.prop);
    items.push({...monster,id:'defeated-'+enemy.id,defeated:true});
  }
  if(ghost)items.push(ghost);
  const drawPlayer = ()=>{
    if(homeBedRest&&atHome())return;
    const seat=player.seat;
    const [x,y]=seat?seatAnchor(seat):point(player.x+.5,player.y+.5,0);
    if(moonwood.has(currentRoom)&&lanternLit){
      const glow=ctx.createRadialGradient(x,y-8,3,x,y-8,34);
      glow.addColorStop(0,'#ffe5aa60');glow.addColorStop(1,'#ffe5aa00');
      ctx.fillStyle=glow;ctx.fillRect(x-34,y-42,68,68);
    }
    if(!seat){
      surface(player.x+.17,player.y+.23,.71,.61,.2,'#43324452');
      surface(player.x+.27,player.y+.34,.50,.38,.3,'#43324462');
    }
    const cycle=step?(player.stride%2)+Math.min(1,(time-step.started)/STEP_MS):0;
    const wave=player.waveStarted===null?null:(time-player.waveStarted)/WAVE_MS;
    const pose=playerCombatPose({time,now:combatNow(),encounter:player.inCombat?hunting.encounter:null,events:combatArt,reduced:reducedMotion.matches});
    const automatic=autoActivityAnimation(time),autoChop=automatic?.task==='woodcutting',cast=fishingSession??(automatic?.task==='fishing'?automatic.cast:null);
    const swingPhase=autoChop?((time-automatic.started)%1000)/1000:woodSession?((time-woodSession.started)%700)/700:0;
    const spritePose=woodSession||autoChop?{...pose,chop:swingPhase}:pose;
    const foe=combatTargetTile(hunting.encounter);const [enemyX,enemyY]=point(foe.x+.5,foe.y+.5);
    const thrust=enemy?pose.lunge-pose.recoil:0;
    const veiled=wearsVeilCloak(wardrobe)&&outfitMagic.veilUntil>combatNow()&&!player.inCombat&&!routineControlled();
    ctx.save();if(veiled)ctx.globalAlpha=.40;
    sprite(ctx,x+Math.sign(enemyX-x)*thrust-pose.dodge,y+Math.sign(enemyY-y)*thrust+pose.dodge*.4,avatar,{direction:player.direction,back:player.back,cycle,seated:!!seat,wave,weapon:autoChop||!!woodSession||pose.armed&&!!combatGear.equippedWeapon,sheathed:!autoChop&&!woodSession&&!pose.armed&&Object.hasOwn(socialRooms,currentRoom)&&!!combatGear.equippedWeapon,weaponTier:woodSession||autoChop?'basicAxe':combatGear.equippedWeapon,pose:spritePose,vest:armourSelection(combatGear),fishing:cast?fishingMoments.phase(cast,time):null,fishingAge:cast?time-cast.started:0,time});
    const familiar=drawFollowingFamiliar('self',familiarState.equipped,player.x,player.y,player.direction,time);
    renderedActors.push({id:'self',name:avatar.name,x:x+Math.sign(enemyX-x)*thrust-pose.dodge,y:y-(seat?30:player.inCombat?49:43),familiar,familiarName:familiarState.names[familiarState.equipped]});
    ctx.restore();
    if(veiled){
      ctx.save();ctx.strokeStyle='#a3e6eb';ctx.globalAlpha=reducedMotion.matches?.45:.38+.16*Math.sin(time/180);
      ctx.beginPath();ctx.ellipse(x,y,14,6,0,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    if(cast)drawFishingMoment(x,y,time,cast);
    drawCatchReveal(x,y,time);
    if(player.inCombat){
      const heartPixels=['0110110','1111111','1111111','0111110','0011100','0001000'];
      for(let heart=0;heart<5;heart++){
        const filled=Math.max(0,Math.min(1,(health-heart*20)/20));
        for(let row=0;row<heartPixels.length;row++)for(let col=0;col<7;col++){
          if(heartPixels[row][col]==='1')rect(x-22+heart*9+col,y-44+row,1,1,col<7*filled?'#f07891':'#49364d');
        }
      }
    }
    if(!$('bubble').hidden){
      if(time>bubbleUntil)$('bubble').hidden=true;
      else{
        const p=canvasBounds();
        $('bubble').style.left=(p.x+((x-centerX)*zoom+centerX)*p.scale)+'px';
        $('bubble').style.top=(p.y+((y-49-centerY)*zoom+centerY)*p.scale)+'px';
      }
    }
  };
  const depth=item=>item.type==='remotePlayer'?(item.peer.seat?depth(item.peer.seat)+.001:item.x+item.y+1):item.x+item.y+dimensions(item).reduce((a,b)=>a+b,0)-.55;
  items.sort((a,b)=>depth(a)-depth(b));
  const playerDepth=player.seat?depth(player.seat)+.001:player.x+player.y+1;
  let drawn=false;hitboxes=[];
  for(const item of items){
    if(!drawn&&playerDepth<depth(item)){drawPlayer();drawn=true;}
    if(item.type==='remotePlayer'){drawRemote(item.peer,time);continue;}
    if(item.type==='wildAnimal'){drawWildAnimal(item,time);continue;}
    ctx.globalAlpha=item===ghost?.52:ghost&&selection?.id===item.id?.4:1;

    const treeHover=isTimberTree(item)&&item===hoverItem&&!treeState(item).regrowsAt;
    object(item,treeHover||editing&&(selection?.id===item.id||hoverItem?.id===item.id)&&!fixed(item),time);
    ctx.globalAlpha=1;
    if(item.defeated||item===ghost||(fixed(item)&&!isGamingTable(item)))continue;
    const [w,d]=dimensions(item), h=moonwood.heights[item.type]??{armoryCounter:32,weaponRack:37,anvil:19,brazier:25,workbench:23,woodStool:13,woodTable:18,bookcase:37,woodcutter:43,amberLantern:26,moonCrystal:43,jadeBonsai:43,explorersGlobe:31,wardenStatue:54,silverfinTank:30,silkScreen:38,hallBoard:27,bakeryOven:33,breadRack:30,foodStall:43,factionRegistrar:43,warden:43,enchanter:43,tradeCounter:32,harvestCrates:16,tackleCounter:32,rodRack:36,baitCrates:16,blackjack:19,roulette:22,reception:32,stove:28,safe:25,bed:24,comfortBed:24,royalBed:28,sofa:24,chair:24,table:17,plant:40,stool:18,lamp:39,bench:22,streetlamp:55,fountain:37}[item.type];
    const height=isTimberTree(item)&&treeState(item).regrowsAt?6:h;
    const shape=[point(item.x,item.y+d),point(item.x+w,item.y+d),point(item.x+w,item.y),point(item.x+w,item.y,height),point(item.x,item.y,height),point(item.x,item.y+d,height)];
    hitboxes.push({item,shape});
  }
  if(!drawn)drawPlayer();
  if(moonSightActive(familiarState,currentRoom,combatNow()))drawMoonSight(time);
  if(enemy)drawCombatWorldFx({ctx,point,time,now:combatNow(),events:combatArt,player,reduced:reducedMotion.matches,encounter:hunting.encounter});
  drawWoodEffects(time);
  if(enemy)drawCombatOverlayFx({ctx,width,height,time,now:combatNow(),events:combatArt,encounter:hunting.encounter,health,reduced:reducedMotion.matches,enemy});
  updateWorldLabels();
  drawHudMiniMap();
  updateActorNameplates();
  updateWorldFloats(time);
  for(const key of familiarFollowers.keys())if(key!=='self'&&!remotePeers.has(key))familiarFollowers.delete(key);
}


function overlap(a,b){
  const [aw,ad]=dimensions(a),[bw,bd]=dimensions(b);
  return a.x<b.x+bw&&a.x+aw>b.x&&a.y<b.y+bd&&a.y+ad>b.y;
}
function installGamingTables(items){
  const layout=[...items];
  for(const table of gamingTables){
    const candidates=[table];
    for(let y=0;y<standardView.rows;y++)for(let x=0;x<standardView.cols;x++){
      candidates.push({...table,x,y},{...table,x,y,rot:(table.rot+1)%4});
    }
    candidates.sort((a,b)=>Math.abs(a.x-table.x)+Math.abs(a.y-table.y)-Math.abs(b.x-table.x)-Math.abs(b.y-table.y));
    const spot=candidates.find(item=>{
      const [w,d]=dimensions(item);
      return item.x+w<=standardView.cols&&item.y+d<=standardView.rows&&
        !overlap(item,{x:5,y:7})&&!layout.some(other=>other.type!=='shelf'&&overlap(item,other));
    });
    if(spot)layout.push(spot);
  }
  return layout;
}
function inRoom(x,y){return x>=0&&y>=0&&x<view.cols&&y<view.rows;}
function blocked(x,y,items=roomFurniture()){
  return !inRoom(x,y)||moonwood.blocked(currentRoom,x,y,adventure,depthsRun)||items.some(item=>item.type!=='shelf'&&overlap(item,{x,y}));
}
function canPlace(item){
  const [w,d]=dimensions(item);
  return inRoom(item.x,item.y)&&item.x+w<=view.cols&&item.y+d<=view.rows&&
    !overlap(item,{x:player.cx,y:player.cy})&&(!step||!overlap(item,step.to))&&
    (!atHome()||!overlap(item,homeExit.tile))&&
    !roomFurniture().some(other=>other.id!==item.id&&other.type!=='shelf'&&overlap(item,other));
}
const directions=[[1,0],[0,1],[-1,0],[0,-1]];
function findPath(start,goal,items=roomFurniture(),avoid=null){
  const estimate=(x,y)=>Math.abs(x-goal.x)+Math.abs(y-goal.y);
  const open=[{...start,g:0,f:estimate(start.x,start.y),previous:null}];
  const best=new Map([[tileKey(start.x,start.y),0]]);
  while(open.length){
    open.sort((a,b)=>a.f-b.f);
    const node=open.shift();
    if(node.x===goal.x&&node.y===goal.y){
      const path=[];
      for(let n=node;n.previous;n=n.previous)path.unshift({x:n.x,y:n.y});
      return path;
    }
    for(const [dx,dy] of directions){
      const x=node.x+dx,y=node.y+dy,k=tileKey(x,y),g=node.g+1;
      if(avoid?.has(k)||blocked(x,y,items)||g>=(best.get(k)??Infinity))continue;
      best.set(k,g);open.push({x,y,g,f:g+estimate(x,y),previous:node});
    }
  }
  return null;
}
function canvasBounds(){
  if(bounds)return bounds;
  const {width,height}=view;
  const box=canvas.getBoundingClientRect(),scale=Math.min(box.width/width,box.height/height);
  return bounds={left:box.left,top:box.top,x:(box.width-width*scale)/2,y:(box.height-height*scale)/2,scale};
}
function inShape(x,y,shape){
  let inside=false;
  for(let i=0,j=shape.length-1;i<shape.length;j=i++){
    const [a,b]=shape[i],[c,d]=shape[j];
    if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;
  }
  return inside;
}
function pointer(e){
  bounds=null;
  const p=canvasBounds();
  const centerX=view.width/2,centerY=view.height/2-4;
  const x=((e.clientX-p.left-p.x)/p.scale-centerX)/zoom+centerX;
  const y=((e.clientY-p.top-p.y)/p.scale-centerY)/zoom+centerY;
  const gx=Math.floor(((x-view.originX)/18+(y-view.originY)/9)/2);
  const gy=Math.floor(((y-view.originY)/9-(x-view.originX)/18)/2);
  const door=roomDoors[currentRoom].find(portal=>doorAvailable(portal)&&hitDoor(x,y,portal));
  return {tile:door?.tile??(inRoom(gx,gy)?{x:gx,y:gy}:null),door,item:hitboxes.findLast(h=>inShape(x,y,h.shape))?.item??null};
}
let homeNavigationLearned=load('movement-learned',false);
function note(message,duration=3000){
  $('hint').dataset.kind='notice';
  $('hint').textContent='✦  '+message;
  noticeUntil=performance.now()+duration;
}
function setHint(){
  const guide={home:homeNavigationLearned?'Next: select EXIT to visit the Grand Lobby':'Click the floor to move your character',hub:'Click a doorway or the Outside steps to travel',lounge:defaultHint,outside:'Click the Moonwood steps to explore · Tower returns indoors',store:'Buy supplies at the counter · Use Lobby to leave',armory:'Compare damage, attack speed and requirements · Buy & equip from the Armory panel',market:'Trade your spoils or visit the Bakery',bakery:'Speak to the baker · Use Market to leave',creek:'Tap Cross to the Ruins to walk across the creek.'};
  const message=editing?'Choose furniture to place or select a piece in the room':currentRoom==='hub'&&!lobbyRoutesOpen()?'Talk to the Tower Warden to open the lobby doors.':guide[currentRoom]??'Follow marked trails · Use the field journal for routes';
  $('hint').dataset.kind=currentRoom==='home'&&!editing?'movement':'guide';
  $('hint').textContent=needsBedLesson()?(editing?'Place your bed on a clear floor spot · R to rotate':'Step 1: open Inventory to place your free bed'):message;
}
function startPosition(){return step?.to??{x:player.cx,y:player.cy};}
function walkingPath(start,goal){
  const exits=new Set(roomDoors[currentRoom].filter(door=>doorAvailable(door)&&(door.tile.x!==goal.x||door.tile.y!==goal.y)).map(door=>tileKey(door.tile.x,door.tile.y)));
  return findPath(start,goal,roomFurniture(),exits);
}
function walkTo(tile){
  if(player.inCombat&&hunting.encounter?.arenaVersion===1){
    if(blocked(tile.x,tile.y)){note('Choose a clear floor tile.');return;}
    combatMoveGoal={...tile};interaction=null;return;
  }
  if(routineControlled()){note('Your routine is running. Use Take control to move.');return;}
  if(player.seat?.type==='riverBench'&&currentRoom==='millbrook'&&hunting.recoveryUntil){standFromRiverBench().then(ok=>{if(ok)walkTo(tile);});return;}
  if(unavailable()){note(player.inCombat?"Combat is live. Use Flee to escape.":"Rest until your hearts recover.");return;}
  if(blocked(tile.x,tile.y)){note('That tile is occupied.');return;}
  const path=walkingPath(startPosition(),tile);
  if(!path){note('There’s no clear path to that tile.');return;}
  cancelFishing();
  player.seat=null;player.waveStarted=null;
  route=path;interaction=null;target=path.length?tile:null;
  if(currentRoom==='home'&&path.length&&!homeNavigationLearned){homeNavigationLearned=true;save('movement-learned',true);setHint();}
}
window.towerSmartLoungeReady=()=>isSmartlyDressed(wardrobe);
window.towerRequireLoungeDress=()=>requestLoungeDress();
function requestLoungeDress(){
  route=[];target=null;interaction=null;loungeDressGuiding=true;
  if(!$('loungeDressDialog').open)$('loungeDressDialog').showModal();
}
function openLoungeWardrobe(){
  $('loungeDressDialog').close();openAvatar();
  $('formalSets').scrollIntoView?.({block:'center'});
}
function continueToLounge(){
  if(!isSmartlyDressed(wardrobe)){openLoungeWardrobe();return;}
  $('avatarDialog').close();$('loungeDressDialog').close();
  if(currentRoom==='lounge'){loungeDressGuiding=false;return;}
  navigateHud('lounge');
}
function updateLoungeDressGuide(){
  const smart=isSmartlyDressed(wardrobe),visible=loungeDressGuiding&&!routineControlled()&&!player.inCombat&&!document.querySelector('dialog[open]');
  $('loungeDressGuide').hidden=!visible;
  if(visible)for(const id of ['bedGuide','tradeGuide','upgradeGuide','autoLessonGuide','contextGuide'])$(id).hidden=true;
  if(visible){$('loungeDressGuideTitle').textContent=smart?'Looking smart. You’re ready!':'Put on your smart outfit';$('loungeDressGuideText').textContent=smart?'Your lounge outfit is equipped. Head back to the lounge door.':'Open Wardrobe → Formal Collection → Save & wear the Tailored Suit or Moonlit Dress.';$('loungeDressGuideAction').textContent=smart?'Enter lounge':'Open Wardrobe';}
  $('loungeWardrobeGuide').hidden=!loungeDressGuiding;
  if(loungeDressGuiding){$('loungeWardrobeGuideTitle').textContent=smart?'✓ Dress code met':'LOUNGE ENTRY · CHOOSE A SMART LOOK';$('loungeWardrobeGuideText').textContent=smart?'Your smart outfit is on. You can enter the lounge now.':'Choose Save & wear on either formal look below. This equips it on your character.';$('loungeWardrobeContinue').hidden=!smart;}
}
$('loungeDressWardrobe').onclick=openLoungeWardrobe;
$('loungeWardrobeContinue').onclick=continueToLounge;
$('loungeDressGuideAction').onclick=()=>isSmartlyDressed(wardrobe)?continueToLounge():openLoungeWardrobe();
function doorAvailable(door,room=currentRoom){return (room!=='hub'||lobbyRoutesOpen())&&moonwood.open(door,adventure);}
function travelDoor(door){
  if(routineControlled()){note('Use Take control before travelling.');return;}
  if(player.seat?.type==='riverBench'&&currentRoom==='millbrook'&&hunting.recoveryUntil){standFromRiverBench().then(ok=>{if(ok)walkTo(tile);});return;}
  if(unavailable()){note(player.inCombat?"Use Flee to leave combat.":"Your hearts are recovering.");return;}
  if(!doorAvailable(door))return;
  if(door.to==='lounge'&&!isSmartlyDressed(wardrobe)){requestLoungeDress();return;}
  if(currentRoom==='creek'&&door.to==='ruins'&&!adventure.bridge){
    adventure.lantern=true;
    lanternLit=true;
    revealByLantern();
  }
  if(!step&&player.cx===door.tile.x&&player.cy===door.tile.y)enterRoom(door.to,door.arrival);
  else walkTo(door.tile);
}
function hudRoomExits(room){
  if(room==='lounge')return roomDoors.lounge;
  return (roomDoors[room]??[]).filter(door=>doorAvailable(door,room));
}
function upgradePlan(path=firstUpgrade.choice){
  if(!['fishing','combat'].includes(path))return null;
  const fishing=path==='fishing',id=fishing?'oak':'ironSword',item=fishing?fishingCatalog.rods[id]:weaponCatalog[id];
  const owned=fishing?fishingGear.ownedRods.includes(id):combatGear.ownedWeapons.includes(id);
  const xp=playerStats[fishing?'patienceXp':'strengthXp'],required=fishing?item.patience:item.strength;
  const missingXp=Math.max(0,skillXpForLevel(required)-xp),missingGold=Math.max(0,item.price-credits);
  const loot=caughtFishCount()+Object.values(huntingLoot).reduce((sum,n)=>sum+n,0)+woodcutting.timber;
  const activity=fishing?'pond':'clearing',shop=fishing?'store':'armory';
  const needsBait=fishing&&fishingGear.bait<1&&(missingXp>0||missingGold>0&&!loot);
  const destination=needsBait?'store':missingXp?activity:missingGold?(loot?'market':activity):shop;
  const current=fishing?fishingCatalog.rods[fishingGear.equippedRod]:weaponProfile(combatGear.equippedWeapon,combatGear.activeSwordUpgrade,combatGear.weaponEnchantments);
  let benefit;
  if(fishing){const before=fishingChances(patienceLevel(),fishingGear.equippedRod,playerStats.luckXp),after=fishingChances(patienceLevel(),id,playerStats.luckXp);benefit=(current.duration/1000).toFixed(1)+'s → '+(item.duration/1000).toFixed(1)+'s per catch · '+(after.fine+after.rare-before.fine-before.rare).toFixed(1)+' percentage points for fine / rare fish.';}
  else benefit=(current?.damage??0)+' → '+item.damage+' base damage · '+((current?.interval??0)/1000).toFixed(1)+'s → '+(item.interval/1000).toFixed(1)+'s per attack.';
  const needs=[missingXp?missingXp+' '+(fishing?'Patience':'Strength')+' XP to reach level '+required:'Stats ready',missingGold?missingGold+' more gold':'Gold ready'].join(' · ');
  return {path,fishing,id,item,owned,missingXp,missingGold,needsBait,activity,shop,destination,benefit,needs};
}
function unlockFirstUpgrade(name,quantity,gold){
  if(firstUpgrade.unlocked)return false;
  Object.assign(firstUpgrade,{unlocked:true,sale:{name,quantity,gold}});
  if(fishingGear.ownedRods.includes('oak')&&combatGear.ownedWeapons.includes('ironSword'))firstUpgrade.complete=true;
  return !firstUpgrade.complete;
}
function openUpgradeChoice(){
  if(!firstUpgrade.unlocked||firstUpgrade.complete)return;
  const sale=firstUpgrade.sale;$('upgradeSale').textContent=sale?sale.quantity+' × '+sale.name+' → +'+sale.gold+' gold':'Turn your earnings into better equipment';
  $('upgradeWallet').textContent='Your wallet: '+credits+' gold';
  for(const [path,prefix] of [['fishing','upgradeFishing'],['combat','upgradeCombat']]){
    const plan=upgradePlan(path);$(prefix).disabled=plan.owned;
    $(prefix+'Art').innerHTML=shopItemArt(plan.id);
    $(prefix+'Needs').textContent=plan.owned?'Already owned':plan.needs;
    $(prefix).querySelector('p').textContent=plan.benefit;
  }
  if(!$('upgradeDialog').open)$('upgradeDialog').showModal();
}
function chooseFirstUpgrade(path){
  const plan=upgradePlan(path);if(!firstUpgrade.unlocked||!plan||plan.owned)return;
  firstUpgrade.choice=path;delete firstUpgrade.deferred;tradeGuideRouteCache=null;worldLabelKey='';
  $('upgradeDialog').close();if($('merchantDialog').open)$('merchantDialog').close();
  savePlayerState();updateUpgradeGuide();
}
function oakTrialDestination(){
  if(fishingGear.equippedRod!=='oak')return currentRoom;
  return fishingGear.bait>0?'pond':'store';
}
function ironTrialDestination(){
  return combatGear.equippedWeapon==='ironSword'?'ruins':currentRoom;
}
function firstUpgradeDestination(){
  if(firstUpgrade.deferred)return null;
  if(depthsRun||tradingGuideActive())return null;
  if(firstUpgrade.ironTrialPending){
    const destination=ironTrialDestination();
    return currentRoom===destination?null:hudNextDoor(destination);
  }
  if(firstUpgrade.oakTrialPending){
    const destination=oakTrialDestination();
    return currentRoom===destination?null:hudNextDoor(destination);
  }
  if(!firstUpgrade.unlocked||firstUpgrade.complete||!firstUpgrade.choice||depthsRun||tradingGuideActive())return null;
  const plan=upgradePlan();return currentRoom===plan.destination?null:hudNextDoor(plan.destination);
}
function updateUpgradeGuide(){
  const pendingTrial=firstUpgrade.oakTrialPending&&!fishingSession;
  const choosingUpgrade=firstUpgrade.unlocked&&!firstUpgrade.complete;
  const pendingHunt=firstUpgrade.ironTrialPending&&!hunting.recoveryUntil;
  const active=!firstUpgrade.deferred&&(pendingTrial||pendingHunt||choosingUpgrade)&&!tradingGuideActive()&&!editing&&!depthsRun&&!player.inCombat;
  if(!active&&!tradingGuideActive())$('scene').dataset.bedTutorial=String(!$('bedGuide').hidden);
  $('upgradeGuide').hidden=!active;
  if(!active)return;
  $('bedGuide').hidden=true;$('scene').dataset.bedTutorial='true';
  if(pendingHunt){
    $('upgradeChange').hidden=true;
    $('upgradeGuideArt').innerHTML=shopItemArt('ironSword');
    $('upgradeGuideTitle').textContent='Test your Iron Sword';
    const needsSword=combatGear.equippedWeapon!=='ironSword';
    const atRuins=currentRoom==='ruins';
    const atCreek=currentRoom==='creek'&&!adventure.bridge;
    $('upgradeGuideText').textContent=needsSword
      ?'Equip your Iron Sword from Inventory to take it into the ruins.'
      :atRuins?'Wait for the slam cue, then dodge. Your sword strikes automatically while the shell is open.'
      :atCreek?'Cross Glass Creek on the stepping stones to reach the Stoneback Beetle.'
      :'Follow the gold markers to Moonwell Ruins and face the Stoneback Beetle.';
    $('upgradeGuideAction').textContent=needsSword?'Equip Iron Sword':atRuins?'Approach Stoneback Beetle':atCreek?'Cross to the Ruins':'Head to Moonwell Ruins';
    return;
  }
  if(pendingTrial){
    const destination=oakTrialDestination();
    $('upgradeChange').hidden=true;
    $('upgradeGuideArt').innerHTML=shopItemArt('oak');
    $('upgradeGuideTitle').textContent='Land your first Oak Rod catch';
    if(fishingGear.equippedRod!=='oak'){
      $('upgradeGuideText').textContent='Equip the Oak Rod from Inventory to try it out.';
      $('upgradeGuideAction').textContent='Equip Oak Rod';
    }else if(destination==='store'){
      $('upgradeGuideText').textContent='Pick up Riverworms at Silverfin Outfitters before casting.';
      $('upgradeGuideAction').textContent=currentRoom==='store'?'View bait supplies':'Head to Silverfin Outfitters';
    }else{
      $('upgradeGuideText').textContent='Catch a fish with your Oak Rod at Silverfin Pond to see what your upgrade does.';
      $('upgradeGuideAction').textContent=isFishingRoom(currentRoom)?'Cast with Oak Rod':'Head to Silverfin Pond';
    }
    return;
  }
  const plan=upgradePlan();$('upgradeChange').hidden=!plan;
  $('upgradeGuideArt').innerHTML=plan?shopItemArt(plan.id):'✦';
  if(!plan){$('upgradeGuideTitle').textContent='Make your first upgrade';$('upgradeGuideText').textContent='Your first sale earned gold. Choose better fishing gear or a stronger weapon.';$('upgradeGuideAction').textContent='Choose my upgrade';return;}
  $('upgradeGuideTitle').textContent='Work toward '+plan.item.name;
  $('upgradeGuideText').textContent=plan.item.price+' gold · '+plan.needs+'. '+(plan.needsBait?'Buy Riverworms at Silverfin Outfitters before training.':plan.missingXp?'Train by '+(plan.fishing?'catching fish.':'hunting boars.'):plan.missingGold?'Sell your supplies or gather more to afford it.':plan.benefit);
  $('upgradeGuideAction').textContent=plan.needsBait&&currentRoom==='store'?'View bait supplies':currentRoom===plan.shop&&!plan.missingXp&&!plan.missingGold?'View '+plan.item.name:currentRoom===plan.destination?(plan.destination==='market'?'Open trading window':plan.fishing?'Go fishing':'Approach boar'):'Head to '+roomDetails[plan.destination].name;
}
function followFirstUpgrade(){
  if(firstUpgrade.deferred){delete firstUpgrade.deferred;savePlayerState();}
  if(firstUpgrade.ironTrialPending){
    if(unavailable())return;
    if(combatGear.equippedWeapon!=='ironSword'){
      openInventory();
      bagCategory='gear';
      bagSelection='weapon:ironSword';
      renderBag();
    }else if(currentRoom==='ruins'){
      const beetle=roomFurniture().find(item=>item.type===huntEnemies.beetle.prop);
      if(beetle)use(beetle);
    }else{
      const door=firstUpgradeDestination();
      if(door)followHudDoor(door);
    }
    return;
  }
  if(firstUpgrade.oakTrialPending){
    if(unavailable())return;
    if(fishingGear.equippedRod!=='oak'){
      openInventory();bagCategory='gear';bagSelection='rod:oak';renderBag();
      return;
    }
    const destination=oakTrialDestination();
    if(currentRoom!==destination){
      const door=firstUpgradeDestination();
      if(door)followHudDoor(door);
    }else if(destination==='store'){
      openMerchant();$('buyBait').focus();
    }else if(!fishingSession){
      const post=roomFurniture().find(item=>item.type==='fishingPost');
      if(post)use(post);
    }
    return;
  }
  const plan=upgradePlan();if(!plan){openUpgradeChoice();return;}
  if(unavailable())return;
  if(currentRoom!==plan.destination){const door=firstUpgradeDestination();if(door){upgradeTrackedDestination=plan.destination;setExplorationDestination(plan.destination);followHudDoor(door);}else note('No open route. You can pause this guide with Not now.');return;}
  if(['store','armory','market','furnishings'].includes(currentRoom)){
    openMerchant();const offer=$(plan.fishing?'rodOffers':'weaponOffers').querySelector('[data-item="'+plan.id+'"]');
    if(plan.needsBait){$('buyBait').focus();return;}
    if(offer&&currentRoom===plan.shop&&!plan.missingXp&&!plan.missingGold){offer.classList.add('recommended-upgrade');offer.scrollIntoView({block:'center',behavior:reducedMotion.matches?'instant':'smooth'});offer.focus({preventScroll:true});}
    return;
  }
  if(plan.fishing){if(!fishingGear.bait){note('Buy Riverworms at Silverfin Outfitters before fishing.');return;}const post=roomFurniture().find(item=>item.type==='fishingPost');if(post)use(post);}
  else{if(!combatGear.equippedWeapon){openInventory('clearing');return;}const boar=roomFurniture().find(item=>item.type==='wildboar');if(boar)use(boar);}
}
function finishFirstUpgrade(path,id){
  const plan=upgradePlan(path);
  if(!firstUpgrade.unlocked||firstUpgrade.complete||firstUpgrade.choice!==path||id!==plan?.id)return false;
  firstUpgrade.complete=true;tradeGuideRouteCache=null;worldLabelKey='';
  note('First upgrade complete! '+plan.item.name+' is equipped.');return true;
}

function tradingGuideEligible(){return questStage(quest)===3;}
function tradingGuideActive(){return tradingGuideEligible()&&currentRoom!=='market'&&!depthsRun;}
function tradingGuideDestination(){
  if(!tradingGuideActive())return null;
  if(currentRoom==='hub'&&!lobbyRoutesOpen())return {warden:true,tile:{x:10,y:4},label:'Tower Warden'};
  return hudNextDoor('market');
}
function updateTradeGuide(){
  const active=tradingGuideActive(),destination=tradingGuideDestination();
  $('tradeGuide').hidden=!active||!destination||editing||player.inCombat||!!hunting.recoveryUntil;
  if(!active||!destination)return;
  $('bedGuide').hidden=true;$('scene').dataset.bedTutorial='true';
  $('tradeGuideTitle').textContent=destination.warden?'First, meet the Warden':'Follow the golden trail';
  $('tradeGuideText').textContent=destination.warden?'Speak to the Tower Warden to open the Trading Post doors.':destination.to==='market'?'The MARKET door leads to the Trading Post. Follow the gold markers to reach it.':'Follow the gold markers to '+(destination.label??roomDetails[destination.to]?.name??'the lobby')+'. Your route continues from there.';
  $('tradeGuideAction').textContent=destination.warden?'Walk to the Warden':'Walk to '+(destination.label??'next exit');
}
function drawTradingGuide(time){
  if(editing||unavailable())return;
  const destination=nextExplorationDoor()??(tradingGuideActive()?tradingGuideDestination():firstUpgradeDestination());
  if(!destination?.tile)return;
  // Before crossing, guide players to the near bank. The crossing action opens the stones.
  const goal=currentRoom==='creek'&&destination.to==='ruins'&&!adventure.bridge?{x:4,y:4}:destination.tile;
  const start=startPosition();
  const key=[currentRoom,start.x,start.y,goal.x,goal.y,roomFurniture().map(item=>[item.id,item.x,item.y,item.rot].join(':')).join(';')].join('|');
  if(tradeGuideRouteCache?.key!==key)tradeGuideRouteCache={key,path:walkingPath(start,goal)??[]};
  const path=tradeGuideRouteCache.path;
  for(let i=0;i<path.length;i++){
    const tile=path[i],bright=reducedMotion.matches?true:Math.floor(time/160)%Math.max(1,path.length)===i;
    surface(tile.x+.30,tile.y+.30,.40,.40,.7,'#4a341dcc');
    surface(tile.x+.34,tile.y+.34,.32,.32,.8,bright?'#fff0ab':'#edc46d');
    if(bright){const [px,py]=point(tile.x+.5,tile.y+.5,1);lobbyLight(px,py,9,'#ffdb8055',.5);}
  }
  const pulse=reducedMotion.matches?1:.65+Math.sin(time/450)*.22;
  ctx.save();ctx.globalAlpha=pulse;surface(goal.x+.06,goal.y+.06,.88,.88,.8,'#ffd78b22','#f8d58b');ctx.restore();
}
function hudRoute(destination){
  if(depthsRun||currentRoom===destination)return [];
  const visited=new Set([currentRoom]);
  const queue=[{room:currentRoom,path:[]}];
  for(const {room,path} of queue){
    for(const door of hudRoomExits(room)){
      if(visited.has(door.to))continue;
      const next=[...path,door];
      if(door.to===destination)return next;
      visited.add(door.to);
      queue.push({room:door.to,path:next});
    }
  }
  return [];
}
function hudNextDoor(destination){return hudRoute(destination)[0]??null;}
function updateExplorationNav(){
  bounds=null;
  const next=nextExplorationDoor();
  const outside=explorationRegions.Moonwood.includes(currentRoom)||willowmereRooms.includes(currentRoom)||watchRooms.includes(currentRoom)||currentRoom==='outside';
  const nav=$('explorationNav');
  nav.hidden=!!depthsRun||(!outside&&!trackedDestination);
  if(nav.hidden)return;
  $('explorationRegion').textContent=watchRooms.includes(currentRoom)?'BEACONWATCH':willowmereRooms.includes(currentRoom)?'WILLOWMERE':explorationRegions.Moonwood.includes(currentRoom)?'MOONWOOD':'THE TOWER';
  $('explorationPlace').textContent=explorationName(currentRoom);
  let guidance=watchRooms.includes(currentRoom)?(currentRoom==='beaconwatch'&&adventure.watchBeacon?'Beacon restored. The Mill Bridge is now open.':currentRoom==='starfall'&&adventure.grottoCache?'Treasure recovered. Follow the root tunnel back to Thornwood.':watchGuidance[currentRoom]):currentRoom==='millbrook'?'Northern road → Beaconwatch expedition.':'Choose a destination on the map';
  if(currentRoom===wildlifeRoom)guidance='Click an animal or choose a habitat to start taming.';
  if(next)guidance='Next: '+explorationName(next.to)+' · Heading to '+explorationName(trackedDestination);
  else if(trackedDestination===currentRoom)guidance='Arrived at '+explorationName(currentRoom);
  else if(trackedDestination)guidance='No open route to '+explorationName(trackedDestination)+' from here';
  $('explorationNext').textContent=guidance;
  $('explorationReturn').hidden=!outside||!!next||!hudNextDoor('hub');
  $('explorationFollow').hidden=!next;
  $('explorationFollow').textContent=next?'Walk to '+explorationName(next.to):'';
  $('explorationClear').hidden=!trackedDestination;
}
function setExplorationDestination(destination){
  if(destination&&!hudRoute(destination).length)return;
  trackedMoonTrail=null;trackedDestination=destination;
  worldLabelKey='';
  updateExplorationNav();
}
function followHudDoor(door){
  if(unavailable()){note('Finish combat or rest before travelling.');return;}
  if(editing)switchMode(false);
  if(door.loungeExit){enterRoom('hub');return;}
  travelDoor(door);
}
function navigateHud(destination){
  if(currentRoom===destination){canvas.focus();return;}
  const next=hudNextDoor(destination);
  if(next?.to===destination){followHudDoor(next);return;}
  showHudMap(destination);
}
window.towerVisitFactionHall=()=>{
  if(currentRoom===factionHall)return;
  if(currentRoom!=='hub'){navigateHud('hub');note('Visit the Grand Lobby, then open Factions to enter your hall.');return;}
  if(!unavailable())serverTravel('factionHall');
};
window.towerFindFactionRegistrar=()=>{
  if(currentRoom===factionRegistrar.room)use(hubFurniture.find(item=>item.type==='factionRegistrar'));
  else navigateHud(factionRegistrar.room);
};
window.towerApplyFactionPurchase=(state,fee)=>{
  applyServerGameplay(state);updateInventory();
  showTransaction('Faction registered',[{icon:'⚑',text:'You are the founding leader'}],-fee,{auto:true});
};
function moonTrailActive(){return familiarBond(familiarState,'owl').rank>=3&&moonSightActive(familiarState,currentRoom,combatNow());}
function worldMapVisibility(){
 const scout=familiarState.equipped==='owl'&&canScoutHere()?(moonTrailActive()?3:2):false;
 return explorationVisibility({currentRoom,discovered:adventure.discovered,knownRooms:explorationRegions['The Tower'],rooms:Object.keys(roomDetails),exits:hudRoomExits,scout});
}
function mapPlaceName(room){
 const fog=worldMapVisibility();
 return room===wildlifeRoom||fog.known.has(room)||moonTrailActive()&&fog.scouted.has(room)?explorationName(room):'Unexplored';
}
function mapRouteVisible(room){
 const fog=worldMapVisibility(),path=hudRoute(room),scouting=moonTrailActive();
 return fog.status(room)!=='hidden'&&path.every((door,i)=>fog.known.has(door.to)||scouting&&fog.scouted.has(door.to)||i===path.length-1);
}
function moonRouteToShare(destination){
  if(!multiplayer?.connected||!moonSightActive(familiarState,currentRoom,combatNow())||!canScoutHere())return [];
  const path=hudRoute(destination),limit=familiarBond(familiarState,'owl').rank>=3?3:2;
  return path.length<=limit&&path.every(door=>moonwood.has(door.to)&&Object.hasOwn(socialRooms,door.to))?path.map(door=>door.to):[];
}
function previewMapRoute(){
  const destination=$('mapDestination').value;
  const path=destination&&mapRouteVisible(destination)?hudRoute(destination):[];
  $('mapTrack').disabled=!path.length;
  $('mapShareTrail').hidden=!moonRouteToShare(destination).length;
  $('mapJourney').textContent=path.length?[currentRoom,...path.map(door=>door.to)].map(mapPlaceName).join(' → '):'Select a place to preview the full route.';
  renderWorldMap(path);
}
function showHudMap(destination=null){
  const dialog=$('hudMapDialog'),routes=$('hudMapRoutes'),shops=destination==='shops';
  if(destination&&destination!=='shops'&&!mapRouteVisible(destination))destination=null;
  const next=destination&&!shops?hudNextDoor(destination):null;
  $('hudMapTitle').textContent=shops?'Tower shops':'World map';
  $('mapTrailStatus').textContent='';
  const moonButton=$('mapMoonSight');moonButton.hidden=shops||familiarState.equipped!=='owl'||!canScoutHere();moonButton.disabled=!!familiarSeconds()||unavailable();moonButton.textContent=familiarSeconds()?'Moon Sight · '+familiarSeconds()+'s':'Moon Sight';
  $('hudMapIntro').textContent=shops
    ?'Choose a shop to see the way there.'
    :next?'To reach '+mapPlaceName(destination)+', start with '+mapPlaceName(next.to)+'.'
    :depthsRun?'Use the chamber controls to bank your spoils or go deeper.'
    :currentRoom==='hub'&&!lobbyRoutesOpen()?'Talk to the Tower Warden to open the lobby doors.'
    :destination?'There’s no open route to '+roomDetails[destination].name+' from here.':'Choose an open exit from this room.';
  routes.replaceChildren();
  const add=(label,action,highlight=false)=>{
    const button=document.createElement('button');
    button.type='button';
    button.textContent=label;
    button.classList.toggle('route-next',highlight);
    button.onclick=()=>{dialog.close();action();};
    routes.append(button);
  };
  if(shops&&lobbyRoutesOpen()){
    for(const [room,label] of [['tailor','Tailor'],['armory','Armory'],['store','Fishing supplies'],['market','Trading Post'],['bakery','Bakery'],['furnishings','Furniture shop']])add(label,()=>navigateHud(room));
  }else if(!shops){
    for(const door of hudRoomExits(currentRoom))add(mapPlaceName(door.to)+(worldMapVisibility().frontier.has(door.to)?' · Explore':''),()=>followHudDoor(door),door.to===next?.to);
  }
  const picker=$('mapDestination');
  picker.replaceChildren();
  $('mapPlanner').hidden=shops||!!depthsRun;
  const placeholder=document.createElement('option');
  placeholder.value='';placeholder.textContent='Select a place';
  picker.append(placeholder);
  for(const [region,rooms] of Object.entries(explorationRegions)){
    const group=document.createElement('optgroup');group.label=region;
    for(const room of rooms){
      if(!hudNextDoor(room)||!mapRouteVisible(room)&&!moonRouteToShare(room).length)continue;
      const option=document.createElement('option');
      option.value=room;option.textContent=(moonRouteToShare(room).length?explorationName(room):mapPlaceName(room))+(worldMapVisibility().frontier.has(room)?' · Explore':'');
      group.append(option);
    }
    if(group.children.length)picker.append(group);
  }
  const preferred=destination&&!shops?destination:trackedDestination;
  picker.value=preferred&&hudNextDoor(preferred)&&mapRouteVisible(preferred)?preferred:'';
  previewMapRoute();
  if(!dialog.open)dialog.showModal();
  updateSharedTrailList();
}
let hudMapKey='';
function drawHudMiniMap(){
  const doors=hudRoomExits(currentRoom);
  const key=[currentRoom,player.cx,player.cy,doors.map(door=>door.to).join(','),lobbyRoutesOpen()].join('|');
  if(key===hudMapKey)return;
  hudMapKey=key;
  $('railHome').hidden=$('hudHome').hidden=currentRoom==='hub'&&!lobbyRoutesOpen();
  $('hudShops').hidden=!lobbyRoutesOpen();
  for(const [id,room] of [['hudHome','home'],['hudLobby','hub']]){
    const button=$(id);
    if(currentRoom===room)button.setAttribute('aria-current','location');
    else button.removeAttribute('aria-current');
  }
  const mini=$('hudMiniMap'),ink=mini.getContext('2d');
  const unit=Math.min(86/(view.cols+view.rows),48/((view.cols+view.rows)*.52));
  const at=(x,y)=>[55+(x-y-(view.cols-view.rows)/2)*unit,5+(x+y)*unit*.52];
  const trace=points=>{
    ink.beginPath();
    points.forEach(([x,y],index)=>index?ink.lineTo(x,y):ink.moveTo(x,y));
    ink.closePath();
  };
  ink.clearRect(0,0,110,58);
  trace([at(0,0),at(view.cols,0),at(view.cols,view.rows),at(0,view.rows)]);
  ink.fillStyle='#273d65';ink.fill();ink.strokeStyle='#6e8db8';ink.stroke();
  for(const door of doors){
    if(!door.tile)continue;
    const [x,y]=at(door.tile.x+.5,door.tile.y+.5);
    ink.fillStyle='#8ed4db';ink.fillRect(x-1.5,y-1,3,2);
  }
  const [x,y]=at(player.cx+.5,player.cy+.5);
  trace([[x,y-5],[x+4,y+2],[x,y+1],[x-4,y+2]]);
  ink.fillStyle='#ffe2a0';ink.fill();
  ink.strokeStyle='#72583b';ink.stroke();
}
function use(item){
  if(item.type==='wildAnimal'){selectWildAnimal(item.animalId);return;}
  if(player.inCombat&&hunting.encounter?.addsVersion===1&&(item.addId||item.type===huntEnemyForRoom(currentRoom)?.prop)){sendServerCombat('target',item.addId??'leader');return;}
  if(isTimberTree(item)){
    if(woodSession?.tree===item){note('Your chop is already in progress.');return;}
    if(treeState(item).regrowsAt){note('The tree is regrowing. Try again shortly.');return;}
    if(!woodcutting.axeOwned&&currentRoom!=='logging'){note('Get your free axe from the woodcutter at Timber Hollow.');return;}
  }
  if(unavailable())return;
  if(item.type==='fishingPost'&&fishingSession){reelFish();return;}
  cancelFishing();
  const start=startPosition(),[w,d]=dimensions(item);
  const items=roomFurniture();
  const exits=new Set(roomDoors[currentRoom].filter(door=>moonwood.open(door,adventure)).map(({tile})=>tileKey(tile.x,tile.y)));
  let shortest=null;
  for(let y=Math.floor(item.y)-1;y<=Math.ceil(item.y+d);y++){
    for(let x=Math.floor(item.x)-1;x<=Math.ceil(item.x+w);x++){
      if(item.type==='fishingPost'&&[...remotePeers.values()].some(peer=>peer.x===x&&peer.y===y))continue;
      if(exits.has(tileKey(x,y))||blocked(x,y,items)||!directions.some(([dx,dy])=>overlap(item,{x:x+dx,y:y+dy})))continue;
      const path=findPath(start,{x,y},items,exits);
      if(path&&(!shortest||path.length<shortest.length))shortest=path;
    }
  }
  if(!shortest){note('There’s no clear path to that furniture.');return;}
  player.seat=null;player.waveStarted=null;route=shortest;interaction=item;target=route.at(-1)??null;
}
function seatAnchor(item){
  const [w,d]=dimensions(item);
  const offsets=[[w/2,.63],[.63,d/2],[w/2,.37],[.37,d/2]];
  const [x,y]=offsets[item.rot];
  return point(item.x+x,item.y+y,item.type==='woodStool'?12:item.type==='stool'?17:item.type==='riverBench'?11:13);
}
function reelFish(){
  if(fishingSession?.serverCastId){
    if(serverActionBusy)return;
    const session=fishingSession;
    serverGameplay('reel',{castId:session.serverCastId}).then(result=>{
      if(fishingSession!==session)return;
      const cast=result.state.fishingCast;
      if(!cast)return;
      const offset=performance.now()-result.serverTime;
      session.landAt=cast.landAt+offset;session.bonus=cast.bonus;
      if(cast.bonus){fishingMoments.sound('reel');note('Well timed! +5 bonus Patience XP.');}
      updateAdventurePanel();
    }).catch(error=>note(error.message));
    return;
  }
  if(!fishingSession||!fishingMoments.reel(fishingSession,performance.now()))return;
  fishingMoments.sound('reel');
  note('Well timed! Reeling in · +5 bonus Patience XP.');
  updateAdventurePanel();
}
function drawFishingMoment(x,y,time,session=fishingSession,spot={y:player.y}){
  const phase=fishingMoments.phase(session,time);
  const still=reducedMotion.matches;
  const [waterX,waterY]=point(fishingSites[currentRoom]?.waterX??7.4,Math.max(.7,Math.min(9.3,spot.y+.45)));
  let bx=waterX,by=waterY;
  let tipX=x+19,tipY=y-33;
  if(phase==='casting'&&!still){
    const t=Math.min(1,(time-session.started)/fishingMoments.CAST_MS);
    tipX=x+7+Math.sin(t*Math.PI)*14;tipY=y-31-Math.sin(t*Math.PI)*8;
    bx=x+9+(waterX-x-9)*t;by=y-16+(waterY-y+16)*t-Math.sin(t*Math.PI)*24;
  }
  if(phase==='bite'){
    tipY+=still?2:Math.sin(time/80)*2;
    by+=4;bx+=still?0:Math.sin(time/70)*2;
  }else if(phase==='twitch'){
    bx+=still?0:Math.sin(time/50)*2;
  }else if(phase==='waiting'){
    by+=still?0:Math.sin(time/250)*1.5;
  }
  if(phase==='landing'){
    const t=still?1:Math.min(1,(time-session.landAt)/fishingMoments.LAND_MS);
    bx=waterX+(x+11-waterX)*t;
    by=waterY+(y-21-waterY)*t-(still?0:Math.sin(t*Math.PI)*39);
    tipX=x+12;tipY=y-42;
    const fish=fishProducts[session.fishId];
    if(fish)fishingMoments.drawFish(ctx,bx,by,session.fishId,fish.quality);
  }
  const [gripX,gripY]=window.towerCharacterArt.grip(x,y,{direction:spot.direction??player.direction,back:spot.back??player.back,fishing:phase,fishingAge:time-session.started,time,reduced:still});
  ctx.beginPath();ctx.moveTo(gripX,gripY);
  ctx.quadraticCurveTo((gripX+tipX)/2+3,(gripY+tipY)/2,tipX,tipY);
  ctx.strokeStyle='#c8a77e';ctx.lineWidth=2;ctx.stroke();
  ctx.beginPath();ctx.moveTo(tipX,tipY);ctx.lineTo(bx,by);
  ctx.strokeStyle='#d7e0ce';ctx.lineWidth=1;ctx.stroke();
  if(phase!=='landing')rect(bx-1,by-3,3,phase==='bite'?2:4,phase==='bite'?'#ffc091':'#efadac');
  const splash=phase==='bite'||phase==='twitch'||(phase==='waiting'&&time-session.castEnds<450);
  if(splash){
    const pulse=still?.5:(time%420)/420;
    ctx.beginPath();ctx.ellipse(waterX,waterY+1,5+pulse*10,2+pulse*4,0,0,2*Math.PI);
    ctx.strokeStyle='#c2e2df';ctx.lineWidth=1;ctx.stroke();
    if(phase==='bite'){
      for(const side of [-1,1])rect(waterX+side*7,waterY-5-(still?0:Math.round(pulse*5)),2,2,'#dfefe0');
      ctx.save();ctx.textAlign='center';ctx.fillStyle='#ffe0a4';ctx.font='bold 10px monospace';
      ctx.fillText('BITE!',waterX,waterY-16);ctx.restore();
    }
  }
}
function drawCatchReveal(x,y,time){
  const element=$('catchReveal');
  if(!catchReveal||time>catchReveal.until){element.hidden=true;catchReveal=null;return;}
  const p=canvasBounds(),cx=view.width/2,cy=view.height/2-4;
  const anchorX=p.x+((x-cx)*zoom+cx)*p.scale;
  const anchorY=p.y+((y-53-cy)*zoom+cy)*p.scale;
  const half=element.offsetWidth/2||95;
  element.style.left=Math.max(half+8,Math.min(canvas.clientWidth-half-8,anchorX))+'px';
  element.style.top=Math.max(element.offsetHeight+8,anchorY)+'px';
}
function finishFishing(time){
  const session=fishingSession;
  if(session.serverCastId&&!session.serverResult){completeServerCast(session);return;}
  fishingSession=null;fishingStarted=null;
  if(!session.serverResult)fishingGear.bait--;
  const fishId=session.fishId,fish=fishProducts[fishId];
  const receipt=session.serverResult;
  if(!receipt){
    fishStock[fishId]=(fishStock[fishId]??0)+1;
    recordQuest(quest,'fish');history.fishCaught=true;
  }
  const before=receipt?.before??playerStats.patienceXp;
  const oldLevel=skillLevel(before);
  const earned=receipt?.xp??PATIENCE_XP_PER_CATCH+session.bonus;
  if(!receipt)playerStats.patienceXp+=earned;
  patienceTween={from:before,to:playerStats.patienceXp,started:time};
  const oakTrial=firstUpgrade.oakTrialPending&&castProfile?.rod==='oak'&&isFishingRoom(currentRoom);
  if(oakTrial)firstUpgrade.oakTrialPending=false;
  recordAdventure('Caught '+fish.name+'! +'+earned+' Patience XP.');
  const levelUp=patienceLevel()>oldLevel;
  $('catchTier').textContent=fishingCatalog.qualities[fish.quality].name+' catch';
  $('catchName').textContent=fish.name;
  $('catchReward').textContent='+1 fish · +'+earned+' Patience XP'+(receipt?.baitSaved?' · Bait saved':session.bonus?' · Well timed!':'')+(receipt?.bondXp?' · +'+receipt.bondXp+' Bond XP':'');
  $('catchLevel').textContent='Patience increased to '+patienceLevel();
  $('catchLevel').hidden=!levelUp;
  const reveal=$('catchReveal');
  reveal.className='catch-reveal quality-'+fish.quality;reveal.hidden=false;
  const picture=$('catchPicture'),pictureContext=picture.getContext('2d');
  pictureContext.clearRect(0,0,picture.width,picture.height);
  fishingMoments.drawFish(pictureContext,30,15,fishId,fish.quality,2);
  const oakBiteSavings=((fishingCatalog.rods.reed.duration-fishingCatalog.rods.oak.duration)/1000).toFixed(1);
  if(oakTrial)$('catchReward').textContent=oakBiteSavings+'s shorter average bite wait · Sells for '+fish.price+' gold';
  catchReveal={until:time+(oakTrial?6500:4000)};
  fishingMoments.sound(levelUp?'level':fish.quality==='rare'?'rare':'catch');
  showTransaction(oakTrial?'First Oak Rod catch!':levelUp?'Patience level '+patienceLevel()+'!':'Catch landed',[
    {text:'+1 '+fish.name,icon:'⋈'},{text:'+'+earned+' Patience XP'+(session.bonus?' · Reel bonus':''),icon:'✦'},
    ...(oakTrial?[{text:oakBiteSavings+'s shorter average bite wait than Reed Rod',icon:'♓'},{text:'Sells for '+fish.price+' gold at the Trading Post',icon:'◈'}]:[])
  ]);
}
function updateFishingMoment(time){
  if(!fishingSession)return;
  const session=fishingSession,phase=fishingMoments.phase(session,time);
  if((phase==='landing'||phase==='complete')&&!session.fishId){
    session.fishId=session.serverCastId?'silverfin':rollFishingCatch(castProfile.level,castProfile.rod,Math.random,playerStats.luckXp);
  }
  if(phase==='complete'){finishFishing(time);return;}
  if(phase!==session.stage){
    session.stage=phase;
    if(phase==='waiting')fishingMoments.sound('splash');
    if(phase==='bite'){fishingMoments.sound('bite');note('Bite! Reel now for +5 Patience XP, or let your character reel automatically.');}
    if(phase==='landing')fishingMoments.sound('reel');
    updateAdventurePanel();
  }
}
let thornwoodConfirmed=false,watchDialogAction=null;
function openWatchDialog(title,text,action=null,run=null){
 $('watchDialogTitle').textContent=title;$('watchDialogText').textContent=text;$('watchDialogError').textContent='';
 $('watchDialogAction').hidden=!action;$('watchDialogAction').textContent=action??'';$('watchDialogAction').disabled=false;
 $('watchDialogCancel').textContent=action?'Not now':'Close';watchDialogAction=run;
 if(!$('watchDialog').open)$('watchDialog').showModal();
}
$('watchDialogCancel').onclick=()=>{$('watchDialog').close();watchDialogAction=null;};
$('watchDialogAction').onclick=async()=>{
 if(!watchDialogAction)return;const action=watchDialogAction;$('watchDialogAction').disabled=true;
 try{await action();if(watchDialogAction===action){$('watchDialog').close();watchDialogAction=null;}}
 catch(error){$('watchDialogError').textContent=error.message;}
 finally{$('watchDialogAction').disabled=false;}
};
function openWatchLandmark(item){
 if(item.type==='watchSign'){
  openWatchDialog(currentRoom==='ambermead'?'Two roads. One watchtower.':'Thornwood trail notes',currentRoom==='ambermead'?'Cream road: safe passage to Beaconwatch. Red trail: dangerous Thornwood, double timber and a hidden grotto. Follow the eastern reeds to a peaceful fishing pool.':'Mature trees yield 2 timber per cut. The Thorn Boar guards a seal: defeat it to unlock the grotto cache. The root crack lies on the eastern edge.');return;
 }
 const beacon=item.type==='watchBeacon',cave=currentRoom==='starfall',flag=beacon?'watchBeacon':cave?'grottoCache':'meadowCache';
 if(adventure[flag]){openWatchDialog(beacon?'The beacon is burning.':'You already opened this cache.',beacon?'The Mill Bridge is open permanently. Use the western bridge to walk straight back to Millbrook.':'This discovery stays recorded. Explore the other paths for more discoveries.');return;}
 if(cave&&!adventure.watchBoar){openWatchDialog('The cache is sealed.','Defeat the Thorn Boar in the thicket to break this seal. Inside: 35 gold and a Sword Awakening Stone.');return;}
 openWatchDialog(beacon?'Bring Beaconwatch back to life.':cave?'A treasure beneath the roots.':'A forgotten roadside cache.',beacon?'Light the beacon and lower the old Mill Bridge. You can then walk directly between Beaconwatch and Millbrook.':cave?'Claim 35 gold and 1 Sword Awakening Stone. Your discovery is saved permanently.':'Claim 15 gold. This is a one-time discovery reward.',beacon?'Light beacon':'Open cache',async()=>{
  const before=credits;await serverGameplay('watchFind',{id:item.type});worldLabelKey='';updateExplorationNav();savePlayerState();
  showTransaction(beacon?'Beacon restored':cave?'Starfall treasure found':'Roadside cache opened',[{icon:beacon?'✦':'◆',text:beacon?'Mill Bridge unlocked · Walk back to Millbrook':cave?'+1 Sword Awakening Stone':'A discovery worth exploring for'}],credits-before);
 });
}

function finishInteraction(){
  const item=interaction;interaction=null;
  if(item.type==='dungeonExit'||item.type==='dungeonArch'){
    if(depthsSideForRoom(currentRoom))visitDungeonSide('return');
    else if(currentRoom===depthsCacheRoom)visitDepthsCache();
    else if(item.type==='dungeonArch')leaveMoonwellDepths();
    else if(depthsEnemyAvailable(depthsRun,currentRoom))note('Defeat the guardian before using the deeper passage.');
    else if(currentRoom==='depthsGate'&&depthsRun.routeChoice==='pending'){
      if(!floodgateOpen(depthsRun))note('Pull the sluice lever to open the crossing.');
      depthsExploring=false;updateDepthsPanel();
    }else if(currentRoom==='depthsGate'&&depthsRun.routeChoice==='dangerous'&&!depthsRun.cacheGuardDefeated)visitDepthsCache();
    else if(currentRoom==='depthsVault')leaveMoonwellDepths();
    else advanceMoonwellDepths();
  }else if(['watchBeacon','watchCache','watchSign'].includes(item.type)){
    openWatchLandmark(item);
  }else if(isRestBed(item.type)&&atHome()){
    beginBedRest(item);
  }else if(item.type==='safe'&&atHome()){
    window.towerOpenSafe?.();
  }else if(item.type==='trainingDummy'){
    openTrainingCourtyard();
  }else if(item.type==='cachePassage'){
    if(depthsSideForRoom(currentRoom))visitDungeonSide('return');else visitDepthsCache();
  }else if(item.type==='restAltar'){useDungeonShrine();
  }else if(Object.hasOwn(depthsFinds,item.type)){
    examineDepths(item);
  }else if(item.type==='hallBoard'){
    $('openFactions').onclick?.();
  }else if(currentRoom===factionHall&&item.type==='bench'){
    const sit=()=>{player.seat=item;player.back=false;player.direction='left';note(health<100?'Resting · Hearts recover in 15 seconds.':'You sit down in the faction hall.');};
    if(health>=100)sit();
    else serverGameplay('factionRest').then(sit).catch(error=>note(error.message));
  }else if(currentRoom===factionHall&&item.type==='stove'){
    window.towerReadFactionProject?.().then(hall=>{if(currentRoom!==factionHall)return;if(hall?.kitchen)openCampfire();else note('Complete the field kitchen upgrade to use the stove.');}).catch(error=>note(error.message));
  }else if(item.type==='stove'&&atHome()){
    openCampfire();
  }else if(item.type==='campfire'){
    openCampfire();
  }else if(isGamingTable(item)&&currentRoom==='lounge'){
    openLoungeGame(item.type);
  }else if(item.type==='workbench'){
    openCrafting();
  }else if(item.type==='woodcutter'){
    if(window.playerCloud?.gameplay){
      const owned=woodcutting.axeOwned;
      serverGameplay('axe').then(()=>{savePlayerState();if(!owned)showTransaction('A gift from the woodcutter',[{icon:'⚒',text:'Basic Axe · Free · Equipped'}]);note('Your basic axe is ready. Click a tree to begin.');}).catch(error=>note(error.message));return;
    }
    if(grantBasicAxe(woodcutting)){
      savePlayerState();showTransaction('A gift from the woodcutter',[{icon:'⚒',text:'Basic Axe · Free · Equipped'}]);
      note('Your basic axe is ready. Click the marked tree or Chop timber to begin.');
    }else note('You already have your basic axe. Equip it in Inventory to gather timber.');
  }else if(isTimberTree(item)){
    beginChopping(item);
  }else if(item.type==='foodStall'){
    openFoodStall();
  }else if(item.type==='factionRegistrar'){
    window.towerOpenFactionRegistrar?.();
  }else if(item.type==='warden'){
    openQuest();
  }else if(item.type===huntEnemyForRoom(currentRoom)?.prop){
    startMonsterEncounter(huntEnemyForRoom(currentRoom));
  }else if(item.type==='riverTrader'){
    if(!caughtFishCount()){note('The river trader buys fish. Catch some at Willowbank, then return here.');return;}
    serverGameplay('sell',{id:'allFish'}).then(packet=>{const r=packet.state.tradeReceipt;savePlayerState();showTransaction('Fish sold at Millbrook',[{icon:'⋈',text:r.quantity+' fish sold'}],r.gold);note('Your catch has been sold.');}).catch(error=>note(error.message));
  }else if(item.type==='riverBench'){
    if(currentRoom!=='millbrook'){note('A quiet place to watch the river. Rest at Millbrook to recover your hearts.');return;}
    if([...remotePeers.values()].some(peer=>peer.seat?.type==='riverBench'&&peer.seat.x===item.x&&peer.seat.y===item.y)){note('Someone is already sitting here. Try the bench again when it is free.');return;}
    const sit=()=>{player.seat=item;player.back=false;player.direction='right';updateRiverBenchRest();note(health>=100?'You sit by the waterwheel. Choose Get up or click a tile to stand.':'Resting on the bench · Your hearts recover in 15 seconds.');};
    if(health>=100){sit();return;}
    serverGameplay('riverRest').then(()=>{sit();updateCombatPanel();}).catch(error=>note(error.message));
  }else if(item.type==='fishingPost'){
    if(window.playerCloud?.gameplay){startServerCast();return;}
    if(fishingGear.bait<1){note('You need bait. Visit Silverfin Outfitters in the tower.');return;}
    const rod=fishingCatalog.rods[fishingGear.equippedRod];
    if(!fishingGear.ownedRods.includes(fishingGear.equippedRod)||patienceLevel()<rod.patience){
      note('Equip a rod that matches your Patience level.');return;
    }
    player.direction='right';player.back=false;
    fishingDuration=rod.duration;
    castProfile={level:patienceLevel(),rod:fishingGear.equippedRod};
    fishingStarted=performance.now();
    fishingSession=fishingMoments.create(fishingStarted,fishingDuration);
    if(firstUpgrade.oakTrialPending)updateUpgradeGuide();
    catchReveal=null;$('catchReveal').hidden=true;
    fishingMoments.sound('cast');
    updateAdventurePanel();
    note('Line cast. Watch the float…');
  }else if(item.type==='lanternStand'){
    if(adventure.lantern){note('You already carry the waystone lantern.');return;}
    adventure.lantern=true;
    lanternLit=true;
    recordAdventure('You take the waystone lantern. Its light reveals hidden paths.');
  }else if(item.type==='mothAltar'){
    if(!adventure.shrine){
      adventure.shrine=true;
      recordAdventure('Moth Shrine discovered. Return here to change your bonded Gems.');
    }
    openEssences();
  }else if(item.type==='moonwell'){
    if(!adventure.shortcut){
      adventure.shortcut=true;
      ownedFurniture.moonbloom=(ownedFurniture.moonbloom??0)+1;
      recordAdventure('Moonbloom added to inventory. The root passage opens.');
    }
    openEssences();
  }else if(item.type==='enchanter'||currentRoom==='armory'&&item.type==='anvil'){
    openEnchanter();
  }else if(['armoryCounter','weaponRack','brazier'].includes(item.type)){
    note('Welcome to the Armory. Compare weapons and choose Buy & equip in the shop panel.');
  }else if(item.type==='tradeCounter'||item.type==='harvestCrates'||(currentRoom==='market'&&item.type==='baitCrates')){
    note('The trader offers credits for fish and hunting spoils. Choose what to sell in the market panel.');
  }else if(['tackleCounter','rodRack','baitCrates'].includes(item.type)){
    note('Welcome to Silverfin Outfitters. Choose supplies from the shop panel.');
  }else if(currentRoom==='tailor'){
    openTailor();
  }else if(currentRoom==='furnishings'){
    window.towerFurnitureShop?.open(Object.hasOwn(types,item.type)?item.type:pendingFurnitureShopItem);pendingFurnitureShopItem=null;
  }else if(item.type==='reception'){
    if(!lobbyRoutesOpen()){note('The Tower Warden is waiting to welcome you.');return;}
    $('receptionMessage').textContent='Welcome, '+avatar.name+'! Choose a shift at the job board, then return home with your earnings.';openJobBoard();
    note('The concierge welcomes you to Tower of Beginnings.');
  }else if(['sofa','chair','stool','woodStool','bench'].includes(item.type)){
    player.seat=item;player.back=item.rot>=2;player.direction=item.rot%2?'right':'left';
    note('You took a seat. Click a tile to stand up.');
  }else{
    const descriptions={woodTable:'A small table crafted from Moonwood timber.',bookcase:'A bookshelf you made from gathered timber.',blackjack:'Blackjack table · Green felt, cards, and chips.',roulette:'Roulette table · A brass wheel and a red-and-black betting layout.',bed:'A neatly made bed.',plant:'The palm is enjoying the evening light.',lamp:'A warm glow from the floor lamp.',table:'A fresh cup of coffee and a book.',fountain:'The fountain ripples in the evening light.',streetlamp:'A warm light over the courtyard.'};
    note(descriptions[item.type]??'Moonwood glows quietly around you.');
  }
}
let lastFrameError='';
function animation(time){
  // Keep the next frame alive even if optional feedback fails in this one.
  requestAnimationFrame(animation);
  try{advanceAnimation(time);lastFrameError='';}
  catch(error){
    const message=String(error?.stack??error);
    window.towerLastFrameError={message,room:currentRoom,at:Date.now(),fishing:!!fishingSession,chopping:!!woodSession,treeFalling:!!treeFall,catchFeedback:!!catchReveal||!!patienceTween};
    if(message!==lastFrameError){console.error('Game animation error',error);lastFrameError=message;}
    // Stop transient activity visuals so the next frame can process movement.
    // Server receipts already applied stay awarded; an interrupted cut pays nothing.
    catchReveal=null;patienceTween=null;$('catchReveal').hidden=true;
    if(woodSession||treeFall){
      woodSession=null;treeFall=null;
      try{updateWoodPanel();updateAdventurePanel();note('Chopping paused. You can move or choose a tree to continue.');}catch{}
    }
  }
}
let lastVitalsPaint=-Infinity;
function updateVitalsHud(){
 const values={health:Math.ceil(homeBedRest?bedRestHealth(homeBedRest,combatNow()):health),hunger:playerVitals.hunger,mana:manaAvailable(playerVitals,combatNow())};
 const hungerStatus=$('hungerStatus');
 const condition=values.hunger===0?'Exhausted':values.hunger<=LOW_HUNGER?'Hungry':'';
 if(hungerStatus.textContent!==condition){
  hungerStatus.hidden=!condition;
  hungerStatus.textContent=condition;
 }
 for(const [id,value] of Object.entries(values)){
  const meter=$('vital'+id),number=$('vital'+id+'Value');
  meter.value=value;meter.setAttribute('aria-label',id[0].toUpperCase()+id.slice(1)+' '+value+' of 100');
  number.textContent=value+' / 100';$('vital'+id+'Row').dataset.low=String(value<=20);
 }
}
function advanceAnimation(time){
  if(time-lastVitalsPaint>=250){updateVitalsHud();updateVeilHud();updateOutfitPowersHud();lastVitalsPaint=time;}
  updateBedRestPanel(time);
  if(!showVaultVictory()){showPendingDungeonLoot();showPendingCombatRecap();}
  if(serverActionBusy){draw(time);return;}
  updateWoodMoment(time);
  updateCombatMoment(time);updateWildlifeGuide();
  if(trackedMoonTrail&&!openMoonTrail(trackedMoonTrail))setExplorationDestination(null);
  if($('hudMapDialog').open){
    updateSharedTrailList();
    if(!moonSightActive(familiarState,currentRoom,combatNow()))$('mapShareTrail').hidden=true;
  }
  if($('familiarsDialog').open&&!reducedMotion.matches&&time-lastFamiliarPortraitFrame>=95){
   lastFamiliarPortraitFrame=time;for(const portrait of familiarPortraits)drawFamiliarPortrait(portrait,time);
  }
  updateFishingMoment(time);
  if(patienceTween){
    const t=reducedMotion.matches?1:Math.min(1,(time-patienceTween.started)/1000);
    const absolute=patienceTween.from+(patienceTween.to-patienceTween.from)*t;
    const {progress:remainder,target}=skillProgress(absolute);
    $('patienceProgress').max=target;
    $('patienceProgress').value=remainder;
    $('catchXpFill').style.width=(remainder/target*100)+'%';
    if(t>=1)patienceTween=null;
  }
  if(walletTween){
    const progress=Math.min(1,Math.max(0,(time-walletTween.started)/650));
    displayedCredits=Math.round(walletTween.from+(credits-walletTween.from)*(1-Math.pow(1-progress,3)));
    $('credits').textContent=new Intl.NumberFormat().format(displayedCredits);
    if(progress===1)walletTween=null;
  }
  advanceAutoJourney();
  if(!step&&route.length){
    const to=route.shift(),from={x:player.cx,y:player.cy};
    player.direction=(to.x-from.x)-(to.y-from.y)>0?'right':'left';
    player.back=to.x+to.y<from.x+from.y;
    step={from,to,started:time};
  }
  if(step){
    const {from,to,started}=step,progress=Math.min(1,(time-started)/STEP_MS);
    player.x=from.x+(to.x-from.x)*progress;player.y=from.y+(to.y-from.y)*progress;
    if(progress===1){
      player.cx=to.x;player.cy=to.y;player.stride++;step=null;
      const door=roomDoors[currentRoom].find(portal=>portal.tile.x===to.x&&portal.tile.y===to.y&&doorAvailable(portal));
      if(door){if(autoJourney){const reverse=roomDoors[door.to]?.find(d=>d.to===currentRoom);autoJourneyTransition=true;enterRoom(door.to,door.arrival??reverse?.inside??reverse?.tile,{automatic:true});autoJourneyTransition=false;}else enterRoom(door.to,door.arrival);}
      else if(!route.length&&!player.inCombat)savePlayerState();
    }
  }
  if(!step&&!route.length){target=null;if(interaction)finishInteraction();}
  if(player.waveStarted!==null&&time>=player.waveStarted+WAVE_MS)player.waveStarted=null;
  if(noticeUntil&&time>noticeUntil){noticeUntil=0;setHint();}
  updateActivityPrompt();
  renderAutoTable(time);
  draw(time);
  if($('avatarDialog').open)drawAvatarPreview(time);
  if($('tailorDialog').open)drawTailorPreview(time);
  renderAutoJourneyHud();
}

var bagCategory='all',bagSelection=null,bagOutfitTarget=null;
function windowItemArt(kind){
  if(kind==='shard'||kind==='charm')return '<svg viewBox="0 0 64 64" aria-hidden="true">'+(kind==='charm'?'<path d="M16 12q16 15 32 0M20 14l12 16 12-16" fill="none" stroke="#debc82" stroke-width="3"/>':'')+'<path d="m32 10 14 14-5 23-10 8-12-13 2-20z" fill="#6386cf" stroke="#c1e5ff" stroke-width="2"/><path d="m32 10 5 19-6 26m-12-13 18-13 9-5" fill="none" stroke="#ace8fa" stroke-width="2"/></svg>';
  if(kind==='axe')return '<svg viewBox="0 0 64 64" aria-hidden="true" shape-rendering="crispEdges"><path d="M18 52l24-38 5 3-24 38z" fill="#ba855c"/><path d="M30 13l14-5 12 9-8 13-17-6z" fill="#a8c4dc"/><path d="M30 13l2 10 16 7-3-11z" fill="#e4eee1"/></svg>';
  if(kind==='timber')return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 26l29-13 13 13-29 17z" fill="#9d684b" stroke="#e4b778" stroke-width="2"/><path d="M12 39l29-13 13 13-29 17z" fill="#85583f" stroke="#d6a168" stroke-width="2"/><ellipse cx="23" cy="43" rx="11" ry="12" fill="#e2b77a"/><ellipse cx="23" cy="43" rx="6" ry="7" fill="none" stroke="#ac744c" stroke-width="2"/></svg>';
  if(kind==='fish')return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M11 32L3 21v22z" fill="#5f98bd"/><path d="M10 32c9-23 32-23 47 0-15 23-38 23-47 0z" fill="#96d2d8" stroke="#d9ece2" stroke-width="2"/><path d="M26 18l10-10 7 12M25 46l9 9 8-10" fill="#69a5bb"/><circle cx="45" cy="29" r="3" fill="#182a43"/></svg>';
  if(kind==='bait')return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M17 20h30l-3 34H20z" fill="#866147" stroke="#d8af74" stroke-width="2"/><path d="M15 16h34v8H15z" fill="#caa369"/><path d="M27 17c-10-16 18-15 8-3s15 11 6 20" fill="none" stroke="#e7a59e" stroke-width="5" stroke-linecap="round"/></svg>';
  if(kind==='vest')return '<svg viewBox="0 0 64 64" aria-hidden="true" shape-rendering="crispEdges"><path d="M22 9l10 5 10-5 13 13-9 9-3 25H21l-3-25-9-9z" fill="#6f9d9c" stroke="#d1e3d4" stroke-width="2"/><path d="M26 15v36h12V15l-6 4z" fill="#446e80"/><path d="M23 30h18v6H23z" fill="#bcba83"/></svg>';
  return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 18h28l7 32-21 8-21-8z" fill="#a78050" stroke="#edca87" stroke-width="2"/><path d="M24 18V9h16v9M12 34h40" fill="none" stroke="#edca87" stroke-width="3"/></svg>';
}
function mealArt(id){
  if(id===towerBread.id)return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 38c-3-13 7-24 20-24h14c11 0 17 10 14 20-2 9-8 14-17 14H17c-5 0-8-4-9-10z" fill="#d69043" stroke="#ffcf83" stroke-width="2"/><path d="m20 21 5 8m7-11 5 8m7-7 5 7" stroke="#fff0be" stroke-width="3" stroke-linecap="round"/></svg>';

  const fish='<path d="M8 35 3 23l13 5q15-16 37-2l6 6-6 6Q32 50 16 36L3 41z" fill="#83b2c5" stroke="#d5e6dc" stroke-width="2"/><path d="m26 25 4 14m6-16 4 15" stroke="#416d7d" stroke-width="3"/><circle cx="49" cy="31" r="2" fill="#243443"/>';
  const stew='<path d="M9 29h46l-5 17q-18 13-36 0z" fill="#b57557" stroke="#edb787" stroke-width="2"/><ellipse cx="32" cy="29" rx="23" ry="8" fill="#835142" stroke="#edb787" stroke-width="2"/><path d="m21 29 5-3 4 4-5 2zm13-2 5-2 5 4-6 2z" fill="#e4ae62"/><path d="M25 17q-5-4 0-9m12 10q-5-4 0-10" fill="none" stroke="#e4dcc2" stroke-width="2"/>';
  return '<svg viewBox="0 0 64 64" aria-hidden="true">'+(id==='boarStew'||id==='heartyStew'?stew:fish)+'</svg>';
}
let buyingBread=false;
function renderFoodStall(){
  $('foodStallStock').textContent=(meals[towerBread.id]??0)+' in bag · '+credits+' gold in wallet';
  for(const button of $('foodStallDialog').querySelectorAll('[data-bread-quantity]')){
    const quantity=Number(button.dataset.breadQuantity);
    button.textContent='Buy '+quantity+' · '+quantity*towerBread.price+' gold';
    button.disabled=buyingBread||credits<quantity*towerBread.price||!window.playerCloud?.gameplay;
  }
}
function openFoodStall(){
  $('foodStallArt').innerHTML=mealArt(towerBread.id);
  $('foodStallStatus').textContent='';renderFoodStall();$('foodStallDialog').showModal();
}
for(const button of $('foodStallDialog').querySelectorAll('[data-bread-quantity]')){
  button.onclick=async()=>{
    if(buyingBread)return;
    buyingBread=true;renderFoodStall();
    const quantity=Number(button.dataset.breadQuantity);
    try{
      await serverGameplay('buyBread',{quantity});
      $('foodStallStatus').textContent=quantity+' Tower Bread added to Inventory.';
      showTransaction('Rations purchased',[{icon:'♨',text:'+'+quantity+' Tower Bread'}],-quantity*towerBread.price,{auto:true});
    }catch(error){$('foodStallStatus').textContent=error.message;}
    finally{buyingBread=false;renderFoodStall();}
  };
}
let pendingCookingId=null;
function openCampfire(){
  if(unavailable())return;
  const dialog=$('campfireDialog');
  renderCampfire();
  $('campfireStatus').textContent='';
  savePlayerState();if(!dialog.open)dialog.showModal();
  if(pendingCookingId){const id=pendingCookingId;pendingCookingId=null;setTimeout(()=>cookMeal(id),0);}
}
function renderCampfire(){
  const state={stats:playerStats,fishStock,huntingLoot,woodcutting,meals},progress=skillProgress(playerStats.cookingXp??0);
  $('campfireTitle').textContent=atHome()?'Your home kitchen':currentRoom===factionHall?'Field kitchen':'Campfire cooking';$('cookingPlace').textContent=atHome()?'HOME · COOKING STOVE':currentRoom===factionHall?'FACTION HALL':'LANTERN TRAIL';
  $('cookingSkill').textContent='Cooking '+progress.level;$('cookingXp').textContent=progress.progress+' / '+progress.target+' XP';$('cookingProgress').max=progress.target;$('cookingProgress').value=progress.progress;
  $('cookingNext').textContent=progress.level<2?'Cooking 2 unlocks Hearty Stew · 60 HP':progress.level<4?'Cooking 4 unlocks Silverfin Feast · 80 HP':'All recipes unlocked · Keep preparing for your next adventure.';
  const cards=$('campfireRecipes');cards.replaceChildren();
  for(const [id,recipe] of Object.entries(mealRecipes)){
    const plan=cookingPlan(state,id),locked=progress.level<recipe.level,card=document.createElement('article');card.className='campfire-recipe';card.dataset.recipe=id;
    const art=document.createElement('div');art.className='campfire-meal-art';art.innerHTML=mealArt(id);
    const content=document.createElement('div'),title=document.createElement('h3'),cost=document.createElement('p'),supply=document.createElement('small');
    title.textContent=recipe.name;cost.textContent=recipe.amount+' '+recipe.ingredient+' + '+recipe.timber+' timber';
    supply.textContent=locked?'Unlock at Cooking '+recipe.level:plan.reason?plan.message:(meals[id]??0)+' in bag · +'+recipe.xp+' Cooking XP';content.append(title,cost,supply);
    const button=document.createElement('button');button.type='button';button.textContent=locked?'Cooking '+recipe.level:'Cook · '+recipe.healing+' HP';button.setAttribute('aria-label','Cook '+recipe.name+' to restore up to '+recipe.healing+' HP');button.disabled=!!plan.reason||!window.playerCloud?.gameplay;button.onclick=()=>cookMeal(id,button);
    card.append(art,content,button);cards.append(card);
  }
}
async function cookMeal(id,button){
  if(unavailable())return;
  const station=atHome()?(homeFurniture.find(i=>i.type==='stove'&&Math.abs(player.cx-i.x)+Math.abs(player.cy-i.y)===1)??homeFurniture.find(i=>i.type==='stove')):currentRoom===factionHall?factionHallFurniture.find(i=>i.type==='stove'):moonwood.layouts.trail.scenery.find(i=>i.type==='campfire');
  if(station&&Math.abs(player.cx-station.x)+Math.abs(player.cy-station.y)!==1){pendingCookingId=id;$('campfireDialog').close();use(station);note('Walking back to the stove to prepare your meal.');return;}
  if(button)button.disabled=true;savePlayerState();
  try{
    const level=skillLevel(playerStats.cookingXp??0);await serverGameplay('cook',{id});
    const after=skillLevel(playerStats.cookingXp??0);$('campfireStatus').textContent=mealRecipes[id].name+' added to Inventory.'+(after>level?' Cooking '+after+' reached!':'');
    showTransaction(after>level?'Cooking '+after+'!':'Meal prepared',[{icon:'♨',text:'+1 '+mealRecipes[id].name},{icon:'✦',text:'+'+mealRecipes[id].xp+' Cooking XP'}]);
  }catch(error){$('campfireStatus').textContent=error.message;}
  finally{renderCampfire();}
}
async function eatMeal(id){
  if(unavailable()||health>=100&&playerVitals.hunger>=100)return;
  const status=$('bagMealStatus');
  const before=health,beforeHunger=playerVitals.hunger;
  status.hidden=false;
  try{
    await serverGameplay('eat',{id});
    updateDepthsPanel();
    const message=foodItems[id].name+' restored '+(foodItems[id].healing?(health-before)+' HP and ':'')+(playerVitals.hunger-beforeHunger)+' hunger.';
    status.textContent=message;
    note(message);
  }catch(error){status.textContent=error.message;}
}
const vaultedItem=(kind,id)=>!!(window.playerCloud?.initial??savedPlayerState)?.bank?.vault?.items?.[kind+':'+id];
function bagEntries(){
  const entries=[];
  const outfit=wardrobe.outfits.find(outfit=>outfit.id===bagOutfitTarget)??wardrobe.outfits.find(outfit=>outfit.id===wardrobe.active);
  for(const id of combatGear.ownedWeapons.filter(id=>!vaultedItem('weapon',id))){
    const w=weaponProfile(id,combatGear.activeSwordUpgrade,combatGear.weaponEnchantments),equipped=combatGear.equippedWeapon===id;
    entries.push({key:'weapon:'+id,name:w.name+(w.enchantmentLevel?' · Enchantment '+w.enchantmentLevel:''),category:'gear',art:shopItemArt(id),quantity:1,equipped,description:w.description,stats:w.damage+' base damage · '+attackSeconds(w.interval)+' per attack · '+weaponStagger(id,combatGear.activeSwordUpgrade)+' stagger/hit',action:equipped?'Unequip weapon':'Equip weapon',disabled:player.inCombat||!canUseWeapon(playerStats,id),note:player.inCombat?'Finish combat before changing equipment.':'Requires Strength '+w.strength+' · Agility '+w.agility+(w.rarity?' · Rare dungeon relic':''),run:()=>{$('weaponSelect').value=id;toggleWeapon();}});
  }
  for(const id of fishingGear.ownedRods.filter(id=>!vaultedItem('rod',id))){
    const rod=fishingCatalog.rods[id],equipped=fishingGear.equippedRod===id,odds=fishingChances(patienceLevel(),id,playerStats.luckXp);
    entries.push({key:'rod:'+id,name:rod.name,category:'gear',art:shopItemArt(id),quantity:1,equipped,description:rod.quality+' fishing rod. Uses one bait per catch.',stats:(rod.duration/1000).toFixed(1)+'s / catch · '+odds.fine.toFixed(1)+'% fine · '+odds.rare.toFixed(1)+'% rare',action:equipped?'Equipped':'Equip rod',disabled:equipped||patienceLevel()<rod.patience,note:'Requires Patience '+rod.patience,run:()=>equipFishingRod(id)});
  }
  if(woodcutting.axeOwned)entries.push({key:'axe',name:'Basic Axe',category:'gear',art:windowItemArt('axe'),quantity:1,equipped:woodcutting.equipped,description:'Your trusty tool for felling trees.',stats:'Train Woodcutting with every log.',action:woodcutting.equipped?'Unequip axe':'Equip axe',disabled:unavailable(),run:()=>$('equipAxe').onclick()});
  for(const id of combatGear.ownedArmour??[]){const item=armourCatalog[id],equipped=combatGear.equippedArmour===id;entries.push({key:'armour:'+id,name:item.name,category:'gear',art:shopItemArt(id),quantity:1,equipped,description:item.description,stats:'Absorbs '+item.absorption+' damage per hit · Dodge '+item.dodgeCost+' stamina',action:equipped?'Remove armour':'Equip armour',disabled:unavailable(),run:()=>equipArmour(equipped?null:id)});}
  if(combatGear.stonebackVestOwned)entries.push({key:'vest',name:'Stoneback Vest',category:'gear',art:windowItemArt('vest'),quantity:1,equipped:combatGear.stonebackVestEquipped,description:'Crafted from the Stoneback Beetle’s shell.',stats:'Absorbs 4 damage · Dodge costs 50 stamina',action:combatGear.stonebackVestEquipped?'Remove vest':'Equip vest',disabled:unavailable(),run:toggleStonebackVest});
  for(const id of wardrobe.owned){
    const item=clothingCatalog[id],included=outfit[item.slot]===id;
    entries.push({key:'clothing:'+id,name:item.name,category:'clothing',art:clothingArt(id),quantity:1,equipped:wardrobe.outfits.find(look=>look.id===wardrobe.active)[item.slot]===id,description:item.description??'Starter clothing. Yours to keep and reuse in any outfit.',stats:(item.loot?'Rare loot · Grants '+item.power:item.dress?'Full dress · Covers trousers':item.slot==='jacket'?'Top slot':item.slot[0].toUpperCase()+item.slot.slice(1)+' slot')+(item.slot==='trousers'&&clothingCatalog[outfit.jacket].dress?' · Hidden under this dress':'')+(!included?' · Replaces '+clothingCatalog[outfit[item.slot]].name:''),action:included?'In '+outfit.name:'Add to '+outfit.name,disabled:included,note:outfit.id===wardrobe.active?'You are wearing this outfit. Changes appear immediately.':'Wear this look from Wardrobe when you are ready.',run:()=>{addClothingToOutfit(wardrobe,outfit.id,id);applyWornOutfit();}});
  }
  for(const [type,name] of Object.entries(types)){
    const quantity=availableFurniture(type);if(!quantity)continue;
    entries.push({key:'furniture:'+type,name,category:'furniture',type,quantity,description:type==='safe'?'Your private gold and item storage. Click it once placed to open.':'Make a space that feels like yours.',stats:quantity+' available in storage',action:'Place in room',disabled:!canDecorate(),note:canDecorate()?'Choose Place, then click a clear floor tile.':'Visit your home to place furniture.',run:()=>{$('inventoryDialog').close();switchMode(true);choose({type,id:null,rot:0});canvas.focus();}});
  }
  if(fishingGear.bait)entries.push({key:'bait',name:'Riverworms',category:'materials',art:windowItemArt('bait'),quantity:fishingGear.bait,description:'Bait for your next fishing trip.',stats:'One used per catch',note:'Used automatically while fishing.'});
  if(woodcutting.timber)entries.push({key:'timber',name:'Timber',category:'materials',art:windowItemArt('timber'),quantity:woodcutting.timber,description:'Gathered by chopping trees.',stats:tradeCatalog.timber.price+' gold each',note:'Craft at the Timber Hollow workbench or sell at the Trading Post.'});
  for(const [id,quantity] of Object.entries(fishStock))if(quantity&&fishProducts[id]){
    const fish=fishProducts[id];entries.push({key:'fish:'+id,name:fish.name,category:'materials',quality:fish.quality,art:windowItemArt('fish'),quantity,description:'Caught in the waters of Silverfin Pond.',stats:fish.price+' gold each · '+quantity*fish.price+' gold total',note:'Sell at the Trading Post or Silverfin Outfitters.'});
  }
  if(combatGear.moonwellCharmOwned)entries.push({key:'charm',name:moonwellCharm.name,category:'gear',art:windowItemArt('charm'),quantity:1,
    equipped:combatGear.moonwellCharmEquipped,description:'A piece of the Moonwell’s magic, shaped at the Timber Hollow workbench.',
    stats:'+'+moonwellCharm.staminaRegen+' dodge stamina per second',action:combatGear.moonwellCharmEquipped?'Remove charm':'Equip charm',
    disabled:unavailable()||!!woodSession||!!fishingSession,run:toggleMoonwellCharm});
  for(const [form,quantity] of Object.entries(magicState?.stones??{})){
    if(!quantity)continue;
    const stone=stoneForms[form];
    entries.push({key:'awakening:'+form,name:stone.name+' Awakening Stone',category:'materials',art:windowItemArt('shard'),quantity,
      description:'Awakens one '+stone.name.toLowerCase()+' power in a bonded Magic Gem.',stats:'Use it in your Essences journal.',
      action:'Open Essences',disabled:unavailable(),run:openEssences});
  }
  for(const [id,quantity] of Object.entries(meals)){
    const recipe=foodItems[id];
    if(!quantity||!recipe)continue;
    const busy=unavailable()||!!woodSession||!!fishingSession;
    entries.push({key:'meal:'+id,name:recipe.name,category:'materials',quantity,art:mealArt(id),
      description:recipe.description,stats:'Restores '+foodFullness(recipe)+' hunger'+(recipe.healing?' and up to '+recipe.healing+' HP':'')+' · Hunger '+playerVitals.hunger+' / 100',
      note:busy?'Finish your current activity before eating.':'Eat between fights.',
      action:(health>=100||!recipe.healing)&&playerVitals.hunger>=100?'Already full':id===towerBread.id?'Eat bread':'Eat meal',disabled:busy||(health>=100||!recipe.healing)&&playerVitals.hunger>=100||!window.playerCloud?.gameplay,run:()=>eatMeal(id)});
  }
  for(const [id,quantity] of Object.entries(huntingLoot))if(quantity&&tradeCatalog[id])entries.push({key:'loot:'+id,name:tradeCatalog[id].name,category:'materials',art:windowItemArt(id===moonwellShard.id?'shard':'loot'),quantity,description:'Spoils from your adventures.',stats:tradeCatalog[id].price+' gold each',note:id===moonwellShard.id?'Enchant weapons at the Tower Armory, sell for '+moonwellShard.price+' gold, or craft a Moonwell Charm with '+moonwellCharm.timber+' timber.':id===stonebackVest.fragment?'Sell at the Trading Post, or combine with '+stonebackVest.timber+' timber at the Timber Hollow workbench to craft a Stoneback Vest.':'Sell at the Trading Post. Some loot is used in crafting.'});
  return entries;
}
function renderBag(){
  const entries=bagEntries(),visible=entries.filter(item=>bagCategory==='all'||item.category===bagCategory);
  const selected=visible.find(item=>item.key===bagSelection)??(bagCategory==='all'?visible.find(item=>item.category==='gear'):null)??visible[0];bagSelection=selected?.key??null;
  const grid=$('bagGrid');grid.replaceChildren();
  for(const item of visible){
    const slot=document.createElement('button'),art=document.createElement('div'),name=document.createElement('span'),count=document.createElement('small');
    slot.type='button';slot.className='bag-slot'+(item.equipped?' is-equipped':'')+(item.quality?' quality-'+item.quality:'');slot.dataset.item=item.key;
    slot.setAttribute('aria-pressed',String(item.key===bagSelection));slot.setAttribute('aria-label',item.name+', '+item.quantity+(item.equipped?', equipped':''));
    art.className='bag-slot-art';if(item.type)art.append(thumbnail(item.type));else art.innerHTML=item.art;
    name.textContent=item.name;count.textContent=item.equipped?'Equipped':'×'+item.quantity;
    slot.append(art,name,count);slot.onclick=()=>{bagSelection=item.key;renderBag();$('bagGrid').querySelector('[data-item="'+item.key+'"]')?.focus({preventScroll:true});};grid.append(slot);
  }
  $('bagEmpty').hidden=visible.length>0;
  $('bagCount').textContent=entries.length+' item types';$('bagGold').textContent=new Intl.NumberFormat().format(credits)+' gold';
  $('bagPlayerName').textContent=avatar.name;
  const loadout=$('bagLoadout');loadout.replaceChildren();
  for(const [label,key] of [['Weapon','weapon:'+combatGear.equippedWeapon],['Rod','rod:'+fishingGear.equippedRod],['Armour',combatGear.equippedArmour?'armour:'+combatGear.equippedArmour:combatGear.stonebackVestEquipped?'vest':null],...(combatGear.moonwellCharmOwned?[['Charm','charm']]:[])]){
    const item=entries.find(item=>item.key===key),button=document.createElement('button');button.type='button';button.textContent=label+' · '+(item?.name??'None equipped');button.disabled=!item;button.onclick=()=>{bagCategory='gear';bagSelection=key;renderBag();};loadout.append(button);
  }
  const picture=$('bagAvatar'),ink=picture.getContext('2d');ink.clearRect(0,0,56,62);sprite(ink,28,54,avatar,{time:performance.now(),vest:armourSelection(combatGear)});
  for(const category of ['all','gear','clothing','materials','furniture'])$('bagTab'+category[0].toUpperCase()+category.slice(1)).setAttribute('aria-pressed',String(category===bagCategory));
  const art=$('bagDetailArt');art.replaceChildren();
  if(selected?.type)art.append(thumbnail(selected.type));else art.innerHTML=selected?.art??windowItemArt('bag');
  $('bagOutfitField').hidden=selected?.category!=='clothing';
  const outfitSelect=$('bagOutfitTarget');outfitSelect.replaceChildren();
  for(const outfit of wardrobe.outfits){const option=document.createElement('option');option.value=outfit.id;option.textContent=outfit.name+(outfit.id===wardrobe.active?' (wearing)':'');outfitSelect.append(option);}
  outfitSelect.value=bagOutfitTarget??wardrobe.active;
  $('bagDetailCategory').textContent=selected?(selected.equipped?'EQUIPPED':selected.category==='clothing'?'CLOTHING':selected.category==='gear'?'EQUIPMENT':selected.category==='furniture'?'HOME FURNITURE':'LOOT & SUPPLIES'):'';
  $('bagDetailName').textContent=selected?.name??'Your bag is empty';$('bagDetailText').textContent=selected?.description??'Find something on your next adventure.';
  $('bagDetailStats').textContent=selected?.stats??'';$('bagDetailNote').textContent=selected?.note??'';
  const action=$('bagAction');action.hidden=!selected?.action;action.textContent=selected?.action??'';action.disabled=!!selected?.disabled||routineControlled();
  action.onclick=()=>{if(!selected?.run||selected.disabled||routineControlled())return;selected.run();if($('inventoryDialog').open)updateInventory();};
  updateBedGuide();
}
function openMerchant(){
  if(currentRoom==='furnishings'){use(furnishingsFurniture.find(item=>item.type==='reception'));return;}
  if(!['store','armory','market','furnishings'].includes(currentRoom))return;
  updateFishingShop();updateArmoryShop();updateTradingPost();
  $('merchantTitle').textContent=roomDetails[currentRoom].name;
  if(!$('merchantDialog').open)$('merchantDialog').showModal();
  if(firstUpgrade.choice&&!firstUpgrade.complete){
    const plan=upgradePlan();
    if(currentRoom===plan.shop&&!plan.missingXp&&!plan.missingGold){const offer=$(plan.fishing?'rodOffers':'weaponOffers').querySelector('[data-item="'+plan.id+'"]');if(offer){offer.classList.add('recommended-upgrade');offer.scrollIntoView({block:'nearest',behavior:'instant'});}}
  }
}

function renderWorldMap(route=[]){
  const positions={...watchMapPositions,...willowmereMapPositions,home:[100,55],hub:[340,110],armory:[265,48],market:[465,48],bakery:[550,129],tailor:[180,70],furnishings:[435,145],lounge:[580,75],store:[118,133],
    outside:[340,205],trail:[340,315],logging:[107,288],clearing:[109,380],[wildlifeRoom]:[514,411],grove:[563,274],shrine:[563,354],
    creek:[338,423],pond:[138,497],ruins:[340,549],roots:[549,493],depthsGate:[340,120],depthsGallery:[340,120],depthsCache:[340,120],depthsTreasury:[340,120],depthsRest:[340,120],depthsTrial:[340,120],depthsVault:[340,120]};
  const rooms=Object.keys(positions).filter(room=>roomDetails[room]&&(room===currentRoom||hudNextDoor(room)));
  const fog=worldMapVisibility(),scouting=moonTrailActive();
  const sharedEdges=new Set(),sharedPlaces=new Set();
  for(const trail of roomMoonTrails.filter(openMoonTrail)){
    let from=trail.room;
    for(const to of trail.route){
      sharedPlaces.add(to);sharedEdges.add([from,to].sort().join('|'));from=to;
    }
  }
  let links='',nodes='',clearings='';
  const linked=new Set();
  const routeEdges=new Set(route.map((door,index)=>[index?route[index-1].to:currentRoom,door.to].sort().join('|')));
  for(const room of rooms){
    const [x,y]=positions[room],status=sharedPlaces.has(room)&&!fog.known.has(room)?'frontier':fog.status(room);
    if(status==='hidden')continue;
    clearings+='<ellipse cx="'+x+'" cy="'+y+'" rx="'+(status==='discovered'?105:54)+'" ry="'+(status==='discovered'?62:45)+'" fill="black"/>';
    for(const door of hudRoomExits(room)){
      const key=[room,door.to].sort().join('|'),shared=sharedEdges.has(key);
      if(!rooms.includes(door.to)||!shared&&(fog.status(door.to)==='hidden'||status!=='discovered'&&!fog.known.has(door.to)&&!(scouting&&fog.scouted.has(room)&&fog.scouted.has(door.to))))continue;
      if(linked.has(key))continue;linked.add(key);
      const [dx,dy]=positions[door.to];links+='<path class="'+(routeEdges.has(key)?'map-route-line':shared?'map-shared-trail':'')+'" d="M'+x+' '+y+'L'+dx+' '+dy+'"/>';
    }
    const scouted=sharedPlaces.has(room)||scouting&&fog.scouted.has(room);
    const name=status==='frontier'&&room!==wildlifeRoom&&!scouted?'Unexplored':explorationName(room);
    nodes+='<g class="map-place'+(room===currentRoom?' map-current':'')+(status==='frontier'?' map-frontier':'')+(scouted?' map-scouted':'')+'"><circle cx="'+x+'" cy="'+y+'" r="'+(room===currentRoom?13:8)+'"/>'+(status==='frontier'?'<text class="map-question" x="'+x+'" y="'+(y+4)+'" text-anchor="middle">'+(scouted?'✧':'?')+'</text>':'')+'<text x="'+x+'" y="'+(y+29)+'" text-anchor="middle">'+name+'</text>'+(room===currentRoom?'<text class="map-you" x="'+x+'" y="'+(y-22)+'" text-anchor="middle">YOU ARE HERE</text>':'')+'</g>';
  }
  const ys=rooms.map(room=>positions[room][1]),bottom=Math.max(160,...ys)+48;
  const regions=rooms.some(room=>explorationRegions.Moonwood.includes(room))
    ?'<path class="map-region-divider" d="M30 251H610"/><text class="map-region-text" x="30" y="241">THE TOWER</text><text class="map-region-text" x="30" y="266">MOONWOOD</text>':'';

  const veil='<defs><filter id="map-fog-soft"><feGaussianBlur stdDeviation="12"/></filter><mask id="map-fog-mask"><rect width="640" height="'+bottom+'" fill="white"/><g filter="url(#map-fog-soft)">'+clearings+'</g></mask><pattern id="map-fog-texture" width="90" height="70" patternUnits="userSpaceOnUse"><path d="M0 40Q25 0 60 28T100 35M-20 60Q25 20 70 55" fill="none" stroke="#7994b0" stroke-opacity=".08" stroke-width="20"/></pattern></defs><g mask="url(#map-fog-mask)"><rect width="640" height="'+bottom+'" fill="#071323"/><rect width="640" height="'+bottom+'" fill="url(#map-fog-texture)"/></g>';
  $('mapFogSummary').textContent=explorationRegions.Moonwood.filter(room=>fog.known.has(room)).length+' / '+explorationRegions.Moonwood.length+' Moonwood places discovered · '+willowmereRooms.filter(room=>fog.known.has(room)).length+' / 3 Willowmere · '+watchRooms.filter(room=>fog.known.has(room)).length+' / 4 Beaconwatch · '+(scouting?'Trail Memory reveals nearby routes.':'Explore to clear fog.');
  const valley=rooms.some(room=>willowmereRooms.includes(room)&&fog.status(room)!=='hidden')?'<path class="map-region-divider" d="M30 594H610"/><text class="map-region-text" x="30" y="614">WILLOWMERE VALLEY</text>':'';
  $('worldMap').innerHTML='<svg viewBox="0 0 640 '+bottom+'" role="img" aria-label="Exploration map. Fog hides undiscovered places. You are in '+roomDetails[currentRoom].name+'.">'+regions+valley+(rooms.some(room=>watchRooms.includes(room)&&fog.status(room)!=='hidden')?'<path class="map-region-divider" d="M30 861H610"/><text class="map-region-text" x="30" y="883">BEACONWATCH REACH</text>':'')+'<g class="map-links">'+links+'</g>'+veil+nodes+'</svg>';
}

function updateWeaponInventory(){
  $('weaponCard').hidden=combatGear.ownedWeapons.length===0;
  if(!combatGear.ownedWeapons.length)return;
  const selector=$('weaponSelect'),previous=selector.value;
  selector.replaceChildren();
  for(const id of combatGear.ownedWeapons.filter(id=>!vaultedItem('weapon',id))){
    const option=document.createElement('option');option.value=id;option.textContent=weaponCatalog[id].name+(combatGear.weaponEnchantments?.[id]?' · Enchantment '+combatGear.weaponEnchantments[id]:'');selector.append(option);
  }
  const selected=combatGear.ownedWeapons.includes(previous)&&!vaultedItem('weapon',previous)?previous:combatGear.equippedWeapon??combatGear.ownedWeapons[0];
  selector.value=selected;selector.disabled=player.inCombat;
  const weapon=weaponProfile(selected,combatGear.activeSwordUpgrade,combatGear.weaponEnchantments),equipped=combatGear.equippedWeapon===selected;
  $('weaponName').textContent=weapon.name+(weapon.enchantmentLevel?' · Enchantment '+weapon.enchantmentLevel:'');
  $('weaponPicture').innerHTML=selected==='huntingSpear'?'<path d="M11 8h2v21h-2z" fill="#bd9064"/><path d="M12 1l4 8-4 3-4-3z" fill="#c5dcd7"/>':selected==='quickDagger'?'<path d="M11 7l4 7-2 6h-3l-1-6z" fill="#d4e6de"/><path d="M7 20h10v2H7z" fill="#8dbec4"/><path d="M11 22h2v6h-2z" fill="#99779d"/>':'<path d="M10 2h4v16h-4z" fill="#bacbd3"/><path d="M10 2h2v15h-2z" fill="#eef2da"/><path d="M7 18h10v3H7z" fill="#d8b079"/><path d="M11 21h2v6h-2z" fill="#986b59"/><path d="M10 27h4v2h-4z" fill="#d8b079"/>';

  $('weaponStatus').textContent=(equipped?'Equipped':'In inventory')+(weapon.upgradeName?' · '+weapon.upgradeName:'')+' · '+weapon.damage+' base damage + Strength · '+attackSeconds(weapon.interval)+' per attack';
  $('equipWeapon').textContent=equipped?'Unequip':'Equip weapon';
  $('equipWeapon').disabled=player.inCombat||!canUseWeapon(playerStats,selected);
  $('weaponHelp').textContent=player.inCombat?'Finish combat before changing your weapon.':weapon.description+' Drawn automatically during combat.';
}
function toggleWeapon(){
  if(player.inCombat)return;
  const selected=$('weaponSelect').value;if(vaultedItem('weapon',selected)){note('Withdraw this weapon from the vault first.');return;}
  if(!combatGear.ownedWeapons.includes(selected)||!canUseWeapon(playerStats,selected))return;
  combatGear.equippedWeapon=combatGear.equippedWeapon===selected?null:selected;
  updateWeaponInventory();updateCombatPanel();savePlayerState();
}
function toggleStonebackVest(){
  if(unavailable()||!combatGear.stonebackVestOwned)return;
  combatGear.stonebackVestEquipped=!combatGear.stonebackVestEquipped;if(combatGear.stonebackVestEquipped)combatGear.equippedArmour=null;
  savePlayerState();
  updateCombatPanel();
}
function updateInventory(){
  if($('craftDialog').open)updateCraftingUI();
  updateWoodPanel();
  $('starterSwordStatus').textContent='Owned ×1'+(combatGear.equippedWeapon==='trainingSword'?' · Equipped':'');
  $('starterRodStatus').textContent='Owned ×1'+(fishingGear.equippedRod==='reed'?' · Equipped':'');
  updateQuestUI();
  updateWeaponInventory();
  $('vestInventory').hidden=!combatGear.stonebackVestOwned;
  $('vestInventoryStatus').textContent=combatGear.stonebackVestEquipped?'Equipped':'In inventory';
  $('equipStonebackVest').textContent=combatGear.stonebackVestEquipped?'Remove vest':'Equip vest';
  $('equipStonebackVest').disabled=unavailable();
  updatePlayerStats();
  updateFishingShop();
  updateTradingPost();
  updateArmoryShop();
  let total=0;
  for(const type of Object.keys(types)){
    const available=availableFurniture(type);
    total+=available;
    const editorButton=$('catalog').querySelector('[data-type="'+type+'"]');
    editorButton.querySelector('.quantity').textContent=available+' available';
    editorButton.hidden=available===0;
    const row=$('inventoryItems').querySelector('[data-type="'+type+'"]');
    row.hidden=available===0;
    row.querySelector('.quantity').textContent='×'+available;
    row.querySelector('button').hidden=!canDecorate();
  }
  $('inventoryCount').textContent=total?total+(total===1?' item in storage':' items in storage'):'Storage is empty';
  const catches=Object.entries(fishStock).filter(([id,count])=>fishProducts[id]&&count>0);
  $('fishInventory').textContent=catches.length?catches.map(([id,count])=>fishProducts[id].name+' ×'+count+' · '+fishProducts[id].price+' credits each').join('\n'):'Fish collection is empty. Cast a line at Silverfin Pond.';
  const spoils=Object.entries(huntingLoot).filter(([id,count])=>tradeCatalog[id]&&count>0);
  $('huntingInventory').hidden=spoils.length===0;
  $('huntingInventory').textContent=spoils.map(([id,count])=>tradeCatalog[id].name+' ×'+count).join(' · ');
}
function renderProgress(){
  $('progressGold').textContent=new Intl.NumberFormat().format(credits);
  $('progressEarned').textContent=new Intl.NumberFormat().format(goldEarned);
  const power=playerPower(playerStats,combatGear);
  $('progressPower').textContent=power.total;
  const breakdown=$('powerBreakdown');
  breakdown.replaceChildren();
  for(const part of power.parts){
    const row=document.createElement('div'),name=document.createElement('dt'),value=document.createElement('dd'),detail=document.createElement('small');
    name.textContent=part.name;value.textContent='+'+part.points;detail.textContent=part.detail;
    row.append(name,value,detail);breakdown.append(row);
  }
  const milestones=progressMilestones({goldEarned,bedLessonComplete,quest,firstUpgrade,combatGear,fishingGear,depthsDiscovered});
  const next=milestones.find(item=>!item.done);
  $('progressNextTitle').textContent=next?.name??'Milestones complete';
  $('progressNextText').textContent=next?.detail??'Keep growing your wealth and combat skills.';
  const progress=$('progressNextBar');progress.hidden=!next?.max;
  if(next?.max){progress.max=next.max;progress.value=next.value;}
  const completed=$('progressMilestones');completed.replaceChildren();
  for(const milestone of milestones.filter(item=>item.done)){
    const row=document.createElement('li');row.textContent='✓ '+milestone.name;completed.append(row);
  }
  $('progressMilestonesEmpty').hidden=completed.children.length>0;
}
function updatePlayerStats(){
  updateUpgradeGoalHud();
  health=Math.min(health,maxHealth());
  const totalHealth=maxHealth();
  const hearts=Array.from({length:5},(_,i)=>{
    const fill=Math.max(0,Math.min(1,(health-i*20)/20));
    return '<span class="health-heart" aria-hidden="true">&#9829;<i style="clip-path:inset(0 '+((1-fill)*100)+'% 0 0)">&#9829;</i></span>';
  }).join('');
  $('healthValue').textContent=health+' / '+totalHealth+' HP';
  for(const id of ['healthHud','healthHearts']){
    $(id).innerHTML=hearts;
    $(id).setAttribute('aria-label','Health '+health+' of '+totalHealth+'. Five hearts, 20 HP each.');
    $(id).title=health+' / '+totalHealth+' HP - 20 HP per heart';
  }
  for(const [id,name] of [['strength','Strength'],['agility','Agility'],['vitality','Vitality'],['patience','Patience'],['luck','Luck'],['leadership','Leadership']]){
    const {level:rank,progress:towardNext,target}=skillProgress(playerStats[id+'Xp']);
    $('attribute-'+id+'-level').textContent=rank;
    $('attribute-'+id+'-xp').textContent=towardNext+' / '+target+' XP';
    $('attribute-'+id+'-progress').max=target;$('attribute-'+id+'-progress').value=towardNext;
    $('attribute-'+id+'-progress').setAttribute('aria-label',name+' level '+rank+', '+towardNext+' of '+target+' XP toward the next level');
  }
  $('attributeName').textContent=avatar.name;
  const {level,progress:xp,target}=skillProgress(playerStats.patienceXp);
  $('patienceValue').textContent=level;
  $('patienceLevel').textContent='Patience '+level;
  $('patienceProgress').max=target;$('patienceProgress').value=xp;
  $('patienceProgress').setAttribute('aria-label','Patience '+level+', '+xp+' of '+target+' XP toward the next level');
  $('patienceXp').textContent=xp+' / '+target+' XP to level '+(level+1);
  const odds=fishingChances(level,fishingGear.equippedRod,playerStats.luckXp);
  const luck=fishingLuckBonus(playerStats.luckXp);
  const luckText='+'+luck.fine.toFixed(1)+' fine / +'+luck.rare.toFixed(1)+' rare percentage points';
  $('attribute-luck-fishing').textContent=luck.rare?'Fishing bonus · '+luckText:'Higher Luck improves fish quality. Train it at the Sunset Lounge.';
  $('fishingStats').textContent='Patience '+level+' · '+xp+'/'+target+' XP · Bait '+fishingGear.bait+' · Fish '+caughtFishCount()+'\nQuality chances · Common '+odds.common.toFixed(1)+'% · Fine '+odds.fine.toFixed(1)+'% · Rare '+odds.rare.toFixed(1)+'%'+(luck.rare?'\nLuck bonus · '+luckText:'');
}
function applyServerGameplay(state){
  const floats=worldActivityTracker?.update(state,window.playerCloud?.serverTime??Date.now())??[];
  if(!document.hidden)for(const event of floats)if(!['damage','heal','dodge'].includes(event.kind))addWorldFloat('self',event);
  credits=state.credits;goldEarned=state.goldEarned??0;Object.assign(firstUpgrade,state.firstUpgrade);
  characterRules=normalizeCharacterRules(state.characterRules);dungeonLootState=normalizeDungeonLoot(state.dungeonLoot);
  combatReports=state.combatReports??[];
  if(state.wardrobe)Object.assign(wardrobe,normalizeWardrobe(state.wardrobe,state.avatar));
  outfitMagic=normalizeOutfitMagic(state.outfitMagic);
  Object.assign(fishingGear,state.fishingGear);
  for(const id of Object.keys(fishStock))delete fishStock[id];
  Object.assign(fishStock,state.fishStock);
  Object.assign(playerStats,state.stats);
  loungeRound=state.gambling?.round??null;
  const previousRest=homeBedRest;homeBedRest=state.bedRest??null;
  health=state.health;playerVitals=normalizeVitals(state.vitals);updateVitalsHud();
  if(previousRest&&!homeBedRest&&health>=100){showTransaction('Rest complete',[{icon:'♥',text:'+'+(100-previousRest.startHealth)+' HP · All five hearts restored'}]);note('Fully rested. Ready for your next adventure.');}
  meals={...state.meals};
  const previousFamiliar=familiarState;
  familiarState=normalizeFamiliars(state.familiars);
  for(const id of familiarState.owned){
   const rank=familiarBond(familiarState,id);
   if(rank.rank>familiarBond(previousFamiliar,id).rank)showTransaction((familiarState.names[id]??familiars[id].name)+' · '+rank.name,[{icon:'✦',text:familiarTraining[id].tricks[rank.rank-2]}]);
  }
  magicState=state.magic?normalizeMagic(state.magic):null;
  Object.assign(hunting,state.hunting);
  if(player.inCombat&&hunting.encounter?.arenaVersion===1&&!step&&!route.length){const p=arenaPlayer(hunting.encounter);if(p.x!==player.cx||p.y!==player.cy)route=walkingPath({x:player.cx,y:player.cy},p)??[];}
  depthsRun=state.depthsRun??null;depthsDiscovered=state.depthsDiscovered===true;
  Object.assign(quest,state.quest);Object.assign(history,state.history);Object.assign(adventure,state.adventure);
  Object.assign(combatGear,state.combatGear);
  for(const key of Object.keys(woodcutting))delete woodcutting[key];
  Object.assign(woodcutting,state.woodcutting);
  for(const key of Object.keys(ownedFurniture))ownedFurniture[key]=state.ownedFurniture?.[key]??0;
  for(const id of Object.keys(huntingLoot))delete huntingLoot[id];
  Object.assign(huntingLoot,state.huntingLoot);
  updateEssenceHotbar();updateUpgradeGoalHud();if($('hudMapDialog').open)previewMapRoute();
}
async function serverGameplay(name,body={}){
  if(serverActionBusy)throw new Error('Wait for the current action.');
  serverActionBusy=true;
  route=[];step=null;interaction=null;target=null;
  player.x=player.cx;player.y=player.cy;
  $('gameShell').inert=true;
  try{
    const result=await window.playerCloud.gameplay(name,body);
    applyServerGameplay(result.state);
    return result;
  }finally{
    serverActionBusy=false;
    $('gameShell').inert=false;
    updateInventory();
  }
}
async function serverTravel(action){
  try{const packet=await serverGameplay(action);enterRoom(packet.state.location,packet.state.position);}
  catch(error){note(error.message);}
}
async function sendServerCombat(input,slot){
  if(activityBusy){
    if(input&&pendingCombatInputs.length<3&&!pendingCombatInputs.some(queued=>queued.input===input&&queued.slot===slot))pendingCombatInputs.push({input,slot});
    return;
  }
  if(serverActionBusy||!player.inCombat)return;
  activityBusy=true;
  try{
    const packet=await window.playerCloud.gameplay('combat',{combatId:serverCombatId,input,...(input==='move'?{tile:slot}:{slot}),reviewing:!document.hidden});
    const receipt=packet.state.combatReceipt;
    if(receipt&&receipt.id!==lastCombatReceipt){
      lastCombatReceipt=receipt.id;
      for(const event of receipt.events){
        const recent=event.at===undefined||packet.serverTime-event.at<=750;
        applyCombatResult(event,packet.state,recent||event.outcome==='victory');
      }
    }
    applyServerGameplay(packet.state);
    setPlayerCombat(!!hunting.encounter);updatePlayerStats();updateCombatPanel();
    nextCombatPoll=performance.now()+80;
  }catch(error){nextCombatPoll=performance.now()+1000;note(error.message);}
  finally{
    activityBusy=false;
    if(!player.inCombat)savePlayerState();
    const queued=pendingCombatInputs.shift();
    if(queued&&player.inCombat)sendServerCombat(queued.input,queued.slot);
    if(!player.inCombat)pendingCombatInputs=[];
  }
}
let loungeTable='blackjack',loungeRound=savedPlayerState?.gambling?.round??null;
let loungeBusy=false,loungeTimer=null,loungeClockOffset=0;
const loungeNames={blackjack:'Blackjack',roulette:'Roulette'};
function openLoungeGame(table){
  if(!isSmartlyDressed(wardrobe)){requestLoungeDress();return;}
  if(unavailable())return;
  if(!window.playerCloud?.gameplay){note('Connect to the game server to play at the lounge.');return;}
  loungeTable=table;
  loungeClockOffset=0;
  const dialog=$('loungeGameDialog');
  renderLoungeGame();
  if(!dialog.open)dialog.showModal();
}
function loungeHand(label,cards,animateFrom=cards.length){
  const row=document.createElement('section'),heading=document.createElement('strong'),total=document.createElement('b');
  row.className='lounge-hand-row';heading.textContent=label;
  const score=loungeHandValue(cards);total.textContent=score===null?'Hidden':score>21?score+' · Bust':score===21?'21':String(score);
  total.className='lounge-total'+(score>21?' is-bust':'');
  const header=document.createElement('div');header.className='lounge-hand-heading';header.append(heading,total);
  const hand=document.createElement('div');hand.className='lounge-hand';
  cards.forEach((card,index)=>{
    const tile=document.createElement('span');tile.className='lounge-card';
    if(index>=animateFrom){tile.classList.add('is-dealt');tile.style.setProperty('--deal-delay',((index-animateFrom)*75)+'ms');}
    if(card){
      const rank=({1:'A',11:'J',12:'Q',13:'K'}[card.rank]??card.rank),suit=['♠','♥','♣','♦'][card.suit];
      const corner=document.createElement('small'),symbol=document.createElement('b');corner.textContent=rank+' '+suit;symbol.textContent=suit;
      tile.append(corner,symbol);tile.setAttribute('aria-label',rank+' of '+['spades','hearts','clubs','diamonds'][card.suit]);
      if(card.suit%2)tile.classList.add('red');
    }else{tile.textContent='◆';tile.classList.add('card-back');tile.setAttribute('aria-label','Face-down card');}
    hand.append(tile);
  });
  row.append(header,hand);return row;
}
let loungeBoardKey='',loungeBoardRound=null,loungeSound=load('lounge-sound',false)===true,loungeAudio=null;
const loungeCelebrated=new Set(loungeRound?.status==='complete'?[loungeRound.id]:[]);
function loungeSoundReady(){
  if(!loungeSound)return;
  try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;loungeAudio??=new Audio();if(loungeAudio.state==='suspended')loungeAudio.resume().catch(()=>{});}catch{}
}
function celebrateLoungeRound(round){
  if(round?.status!=='complete'||loungeCelebrated.has(round.id))return;
  loungeCelebrated.add(round.id);if(loungeCelebrated.size>60)loungeCelebrated.delete(loungeCelebrated.values().next().value);
  const banner=$('loungeOutcome');banner.classList.remove('is-revealed');void banner.offsetWidth;banner.classList.add('is-revealed');
  if(!loungeSound||!loungeAudio||document.hidden)return;
  try{
    const notes=round.outcome==='win'?[440,554,659]:round.outcome==='push'?[392,392]:[294,247];
    notes.forEach((frequency,index)=>{const osc=loungeAudio.createOscillator(),gain=loungeAudio.createGain(),at=loungeAudio.currentTime+index*.12;
      osc.type='sine';osc.frequency.value=frequency;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.045,at+.015);gain.gain.exponentialRampToValueAtTime(.001,at+.22);
      osc.connect(gain);gain.connect(loungeAudio.destination);osc.start(at);osc.stop(at+.24);
    });
  }catch{}
}
function renderLoungeGame(message){
  clearTimeout(loungeTimer);
  const otherTable=loungeRound?.status==='playing'&&loungeRound.game!==loungeTable;
  const round=loungeRound?.game===loungeTable?loungeRound:null;
  const playing=round?.status==='playing',blackjack=loungeTable==='blackjack',complete=round?.status==='complete';
  const now=Date.now()+loungeClockOffset,xp=playerStats.luckXp??0,stake=Number($('loungeGameStake').value)||5;
  $('loungeGameTitle').textContent=loungeNames[loungeTable];$('loungeGameEmblem').textContent=blackjack?'♠':'◉';
  $('loungeGameIntro').textContent=blackjack?'A hand of cards. A little luck. Your call.':'Choose your color and watch the wheel settle.';
  $('loungeGameGold').textContent=credits.toLocaleString()+' gold';
  $('loungeGameLuck').textContent='Level '+skillLevel(xp)+' · '+skillProgress(xp).progress+' / '+skillProgress(xp).target+' XP';
  $('loungeGameLuckBar').max=skillProgress(xp).target;$('loungeGameLuckBar').value=skillProgress(xp).progress;
  $('loungeLuckAward').textContent=complete?(round.luckXp?'+'+round.luckXp+' Luck XP'+(skillLevel(round.luckBefore)<skillLevel(xp)?' · Level up!':''):'No Luck XP this round · 30-second XP cooldown'):playing?'Luck XP is checked when the round ends.':'Up to +2 Luck XP per completed round';
  $('loungeTablePhase').textContent=playing?(blackjack?'YOUR MOVE':'WHEEL SPINNING'):complete?'ROUND COMPLETE':'TAKE A SEAT';
  $('loungeTableStake').textContent=round?round.bet+' gold stake'+(!blackjack?' · '+round.color:''):'No stake placed';
  const board=$('loungeGameBoard'),key=JSON.stringify([loungeTable,round?.id,round?.status,round?.player,round?.dealer,round?.number]);
  if(key!==loungeBoardKey){
    const before=loungeBoardRound?.id===round?.id?loungeBoardRound:null;board.replaceChildren();
    if(blackjack&&round){
      const dealerFrom=before?(before.dealer?.some(c=>!c)&&complete?1:before.dealer?.length??0):0;
      board.append(loungeHand('Dealer',round.dealer,dealerFrom),loungeHand('Your hand',round.player,before?.player?.length??0));
    }else if(round){
      const wheel=document.createElement('div'),disc=document.createElement('span'),number=document.createElement('strong'),caption=document.createElement('p');
      wheel.className='lounge-wheel '+(playing?'spinning':round.resultColor);disc.className='lounge-wheel-disc';disc.setAttribute('aria-hidden','true');
      number.textContent=playing?'?':round.number;wheel.append(disc,number);wheel.setAttribute('aria-label',playing?'Wheel spinning':round.number+' '+round.resultColor);
      caption.className='lounge-wheel-caption';caption.textContent=playing?'Your stake is on '+round.color:round.number+' · '+round.resultColor;board.append(wheel,caption);
    }else{
      const mark=document.createElement('div'),title=document.createElement('b'),hint=document.createElement('p');mark.className='lounge-empty-mark';mark.textContent=blackjack?'♠ ♥ ♣ ♦':'◉';
      title.textContent=blackjack?'The table is yours':'Red or black?';hint.textContent=blackjack?'Choose a stake. Aim for 21 without going over.':'Pick a color. Green 0 wins neither color.';board.append(mark,title,hint);
    }
    loungeBoardKey=key;loungeBoardRound=round?JSON.parse(JSON.stringify(round)):null;
  }
  const feedback=loungeRoundFeedback(round),outcome=$('loungeOutcome');outcome.hidden=!feedback;
  $('loungeSettlement').hidden=!feedback;
  if(feedback){
    outcome.dataset.outcome=feedback.outcome;$('loungeOutcomeIcon').textContent=feedback.outcome==='win'?'✦':feedback.outcome==='push'?'↔':'−';
    $('loungeOutcomeTitle').textContent=feedback.title;$('loungeOutcomeAmount').textContent=feedback.amount;$('loungeOutcomeDetail').textContent=feedback.detail;
    $('loungeWager').textContent=feedback.bet+' gold';$('loungeReturn').textContent=feedback.payout+' gold';$('loungeNet').textContent=feedback.net>0?'+'+feedback.net+' gold':feedback.net<0?'−'+Math.abs(feedback.net)+' gold':'0 gold';
    $('loungeWinSparks').hidden=feedback.outcome!=='win';
  }else outcome.classList.remove('is-revealed');
  $('loungeGameBet').hidden=playing||otherTable;$('loungeGameColorField').hidden=blackjack;
  for(const value of [5,10,25]){const button=$('loungeStake'+value);button.setAttribute('aria-pressed',String(value===stake));button.disabled=loungeBusy||credits<value;}
  for(const color of ['red','black']){$('loungeColor'+(color==='red'?'Red':'Black')).setAttribute('aria-pressed',String($('loungeGameColor').value===color));$('loungeColor'+(color==='red'?'Red':'Black')).disabled=loungeBusy;}
  $('loungePayoutPreview').textContent=blackjack?'Stake '+stake+' gold · A standard win pays back '+stake*2+' gold.':'Stake '+stake+' gold · A matching color pays back '+stake*2+' gold.';
  const retrySpin=playing&&!blackjack&&!!message;
  $('loungeGameActions').hidden=!playing||(!blackjack&&!retrySpin);$('loungeGameHit').hidden=$('loungeGameStand').hidden=!blackjack;$('loungeGameReveal').hidden=!retrySpin;
  $('loungeGameHit').disabled=$('loungeGameStand').disabled=$('loungeGameReveal').disabled=loungeBusy;
  const wait=Math.max(0,(loungeRound?.startedAt??0)+5000-now);
  $('loungeGameStart').disabled=loungeBusy||!!wait||credits<stake;
  $('loungeGameStart').textContent=loungeBusy?'Placing stake…':wait?'Table ready shortly':(blackjack?'Deal':'Spin')+' · '+stake+' gold';
  $('loungeGameResult').textContent=message??(otherTable?'Finish your round at the '+loungeNames[loungeRound.game]+' table first.':loungeBusy?'Waiting for the table…':playing?(blackjack?'Hit for another card, or Stand to reveal the dealer’s hand.':'The wheel is spinning. Your result arrives shortly.'):credits<stake?'Choose a stake within your wallet balance.':complete?'Round settled. You can leave the table or choose another stake.':'Your stake is deducted when the round begins.');
  $('loungeGameResult').dataset.error=String(!!message);
  $('loungeTableRules').textContent=blackjack?'Get closer to 21 than the dealer without going over. Aces count as 1 or 11. The dealer draws to 17. A standard win pays back 2× your stake. A two-card 21 pays back 2.5×, rounded down. Equal totals return your stake.':'A single-zero wheel has 18 red, 18 black and one green number. A matching color pays back 2× your stake. Green 0 loses both color bets. Each spin is independent.';
  if(!loungeBusy&&wait&&!playing)loungeTimer=setTimeout(()=>renderLoungeGame(),wait+30);
  if(!loungeBusy&&playing&&!blackjack&&!message)loungeTimer=setTimeout(()=>{if($('loungeGameDialog').open)playLoungeRound('reveal');},Math.max(0,round.revealAt-now)+100);
}
async function playLoungeRound(move){
  if(loungeBusy)return;
  loungeSoundReady();
  loungeBusy=true;
  renderLoungeGame();
  let errorText;
  try{
    const packet=move
      ?await serverGameplay('gambleMove',{roundId:loungeRound?.id,move})
      :await serverGameplay('gamble',{game:loungeTable,bet:Number($('loungeGameStake').value),color:$('loungeGameColor').value});
    loungeClockOffset=packet.serverTime-Date.now();
    // Update the HUD even while the native table dialog covers the scene.
    displayedCredits=credits;walletTween=null;
    $('credits').textContent=credits.toLocaleString();
    updatePlayerStats();
  }catch(error){errorText=error.message;}
  finally{loungeBusy=false;renderLoungeGame(errorText);if(!errorText)celebrateLoungeRound(loungeRound);}
}
function restoreServerCast(cast,serverTime){
  const offset=performance.now()-serverTime;
  fishingSession={...cast,serverCastId:cast.id,started:cast.started+offset,castEnds:cast.castEnds+offset,
    biteAt:cast.biteAt+offset,landAt:cast.landAt+offset,stage:'casting',fishId:null};
  fishingStarted=fishingSession.started;
  fishingDuration=fishingCatalog.rods[cast.rod].duration;
  castProfile={rod:cast.rod,level:patienceLevel()};
}
async function startServerCast(){
  try{
    const result=await serverGameplay('cast');
    restoreServerCast(result.state.fishingCast,result.serverTime);
    fishingMoments.sound('cast');
    catchReveal=null;$('catchReveal').hidden=true;
    updateAdventurePanel();updateUpgradeGuide();
  }catch(error){note(error.message);}
}
async function completeServerCast(session){
  if(session.completing)return;
  session.completing=true;
  try{
    const result=await serverGameplay('catch',{castId:session.serverCastId});
    if(fishingSession!==session)return;
    const receipt=result.state.fishingReceipt;
    session.serverResult=receipt;
    session.fishId=receipt.fish;session.bonus=receipt.bonus;
    finishFishing(performance.now());
  }catch(error){
    session.completing=false;
    cancelFishing();note(error.message);
  }
}
function equipFishingRod(id){
  if(vaultedItem('rod',id)){note('Withdraw this rod from the vault first.');return;}
  if(window.playerCloud?.gameplay){
    serverGameplay('rod',{id}).then(()=>{fishingSession=null;fishingStarted=null;savePlayerState();updateAdventurePanel();}).catch(error=>note(error.message));
    return;
  }
  const rod=fishingCatalog.rods[id];
  if(!rod||!fishingGear.ownedRods.includes(id)||patienceLevel()<rod.patience)return;
  cancelFishing();
  fishingGear.equippedRod=id;
  savePlayerState();
  updateAdventurePanel();
}
function buyArmoryWeapon(id){
  if(vaultedItem('weapon',id)){note('Withdraw this weapon from the vault first.');return;}
  if(window.playerCloud?.gameplay){
    const owned=combatGear.ownedWeapons.includes(id);
    serverGameplay('weapon',{id}).then(()=>{
      const upgraded=finishFirstUpgrade('combat',id);
      if(upgraded)firstUpgrade.ironTrialPending=true;
      savePlayerState();$('armoryStatus').textContent=weaponCatalog[id].name+' equipped.';
      showTransaction(upgraded?'First upgrade complete!':'Weapon equipped',[{text:weaponCatalog[id].name+' · Equipped',icon:'⚔'}],owned?0:-weaponCatalog[id].price);
    }).catch(error=>{$('armoryStatus').textContent=error.message;});
    return;
  }
  const state={credits,combatGear,stats:playerStats,location:currentRoom,hunting};
  try{
    const result=purchaseWeapon(state,id);credits=state.credits;
    $('weaponSelect').value='';
    const upgraded=finishFirstUpgrade('combat',id);
    if(upgraded)firstUpgrade.ironTrialPending=true;
    savePlayerState();
    $('armoryStatus').textContent=result.name+' equipped.'+(upgraded?' Next, test it against the Stoneback Beetle in Moonwell Ruins.':'');
    showTransaction(upgraded?'First upgrade complete!':result.spent?'Weapon purchased':'Weapon equipped',[{icon:'⚔',text:result.name+' · Equipped'},{icon:'✦',text:upgraded?'Next hunt · Stoneback Beetle at Moonwell Ruins':'Ready for combat'}],-result.spent);
  }catch(error){$('armoryStatus').textContent=error.message;}
}
function updateArmoryShop(){
  const equipped=weaponProfile(combatGear.equippedWeapon,combatGear.activeSwordUpgrade,combatGear.weaponEnchantments),current=huntingAttributes(playerStats,combatGear.equippedWeapon,combatGear.activeSwordUpgrade,false,combatGear.weaponEnchantments);
  const strength=skillLevel(playerStats.strengthXp),agility=skillLevel(playerStats.agilityXp);
  $('armoryBalance').textContent=new Intl.NumberFormat().format(credits)+' G';
  $('armoryStats').textContent='Strength '+strength+' · Agility '+agility;
  $('armoryComparison').textContent=equipped?equipped.name+(equipped.upgradeName?' · '+equipped.upgradeName:'')+' · '+current.damage+'–'+(current.damage+4)+' damage · '+attackSeconds(current.attackInterval)+' / attack':'Nothing equipped · Your free Training Sword is in Inventory';
  const offers=$('weaponOffers');offers.replaceChildren();
  for(const [id,weapon] of Object.entries(weaponCatalog).filter(([,weapon])=>weapon.price)){
    const owned=combatGear.ownedWeapons.includes(id),active=combatGear.equippedWeapon===id,skill=canUseWeapon(playerStats,id);
    const damage=huntingAttributes(playerStats,id,combatGear.activeSwordUpgrade,false,combatGear.weaponEnchantments).damage,difference=damage-current.damage,speed=(current.attackInterval-weapon.interval)/1000;
    const missing=[strength<weapon.strength?'Strength +'+(weapon.strength-strength):'',agility<weapon.agility?'Agility +'+(weapon.agility-agility):''].filter(Boolean);
    const reason=vaultedItem('weapon',id)?'Stored in your vault · Withdraw before equipping':!skill?'Need '+missing.join(' and '):!owned&&credits<weapon.price?'Need '+(weapon.price-credits)+' more gold':active?'Ready for your next fight':owned?'Yours to keep · Free to equip':'Purchased gear equips automatically';
    const deltas=active?[{text:'Your equipped weapon',tone:'neutral'}]:[
      {text:(difference>0?'+':'')+difference+' damage',tone:difference>0?'up':difference<0?'down':'neutral'},
      {text:speed===0?'Same attack speed':attackSeconds(Math.abs(current.attackInterval-weapon.interval))+' '+(speed>0?'faster':'slower'),tone:speed>0?'up':speed<0?'down':'neutral'}
    ];
    offers.append(renderShopCard({document,id,name:weapon.name,category:id==='huntingSpear'?'HEAVY':id==='quickDagger'?'QUICK':'BALANCED',price:weapon.price,owned,equipped:active,stats:[['DAMAGE',damage+'–'+(damage+4)],['PER ATTACK',(weapon.interval/1000).toFixed(1)+'s']],deltas,requirements:'STR '+weapon.strength+'  ·  AGI '+weapon.agility,reason,action:vaultedItem('weapon',id)?'In vault':active?'Equipped':!skill?'Stats required':owned?'Equip weapon':credits<weapon.price?'Not enough gold':'Buy & equip',disabled:vaultedItem('weapon',id)||active||!skill||(!owned&&credits<weapon.price),onBuy:()=>buyArmoryWeapon(id)}));
  }
  for(const [id,item] of Object.entries(armourCatalog)){
    const owned=combatGear.ownedArmour?.includes(id),active=combatGear.equippedArmour===id,eligible=canUseArmour(playerStats,id);
    offers.append(renderShopCard({document,id,name:item.name,category:'ARMOUR',price:item.price,owned,equipped:active,stats:[['ABSORBS',item.absorption+' / hit'],['DODGE',item.dodgeCost+' stamina']],deltas:[{text:item.description,tone:'neutral'}],requirements:'VITALITY '+item.vitality,reason:!eligible?'Train Vitality to '+item.vitality:!owned&&credits<item.price?'Need '+(item.price-credits)+' more gold':'One armour piece at a time · Replaces your vest',action:active?'Equipped':!eligible?'Stats required':owned?'Equip armour':'Buy & equip',disabled:active||!eligible||(!owned&&credits<item.price)||serverActionBusy,onBuy:()=>equipArmour(id)}));
  }
}
async function equipArmour(id){
  if(unavailable())return;
  const item=armourCatalog[id],owned=combatGear.ownedArmour?.includes(id);
  try{await serverGameplay('armour',{id});updateInventory();updateCombatPanel();savePlayerState();showTransaction(id?(owned?'Armour equipped':'Armour purchased'):'Armour removed',id?[{icon:'⬡',text:item.name+' · Absorbs '+item.absorption+' · Dodge '+item.dodgeCost}]:[{icon:'⬡',text:'No armour equipped'}],id&&!owned?-item.price:0);}
  catch(error){$('shopStatus').textContent=error.message;note(error.message);}

}
function buyFishingRod(id){
  if(vaultedItem('rod',id)){note('Withdraw this rod from the vault first.');return;}
  if(window.playerCloud?.gameplay){
    const owned=fishingGear.ownedRods.includes(id),rod=fishingCatalog.rods[id];
    if(!rod)return;
    serverGameplay('rod',{id}).then(()=>{
      const upgraded=finishFirstUpgrade('fishing',id);
      if(upgraded)firstUpgrade.oakTrialPending=true;
      savePlayerState();$('shopStatus').textContent=rod.name+' equipped.';
      showTransaction(upgraded?'First upgrade complete!':owned?'Rod equipped':'Rod purchased',[{text:rod.name+' · Equipped',icon:'♓'}],owned?0:-rod.price);
    }).catch(error=>{$('shopStatus').textContent=error.message;});
    return;
  }
  const rod=fishingCatalog.rods[id];
  if(currentRoom!=='store'||!rod)return;
  if(fishingGear.ownedRods.includes(id)){equipFishingRod(id);return;}
  if(patienceLevel()<rod.patience||credits<rod.price){
    $('shopStatus').textContent='You need '+rod.price+' credits and Patience '+rod.patience+'.';return;
  }
  credits-=rod.price;
  fishingGear.ownedRods.push(id);
  fishingGear.equippedRod=id;
  const upgraded=finishFirstUpgrade('fishing',id);
  const includedBait=upgraded&&fishingGear.bait===0;
  if(upgraded)firstUpgrade.oakTrialPending=true;
  if(includedBait)fishingGear.bait=1;
  savePlayerState();
  $('shopStatus').textContent=rod.name+' purchased and equipped.'+(upgraded?' Next, try it at Silverfin Pond.':'')+(includedBait?' One Riverworm included for your first cast.':'');
  showTransaction(upgraded?'First upgrade complete!':'Rod purchased',[{text:'+1 '+rod.name,icon:'♓'},{text:upgraded?'3.8s per catch · Better-quality fish chances':'Equipped and ready',icon:'✓'},...(includedBait?[{text:'1 Riverworm for your first cast',icon:'≋'}]:[])],-rod.price);
}
function showTransaction(title,items,creditChange=0,options={}){
  const card=document.createElement('div'),heading=document.createElement('b');
  card.className='transaction-card';
  heading.textContent=title;card.append(heading);
  for(const {text,icon} of items){
    const row=document.createElement('div'),symbol=document.createElement('span'),label=document.createElement('span');
    row.className='transaction-item';symbol.className='transaction-icon';
    symbol.textContent=icon;symbol.setAttribute('aria-hidden','true');label.textContent=text;
    row.append(symbol,label);card.append(row);
  }
  if(creditChange!==0){
    const gain=creditChange>0;
    const delta=document.createElement('div');
    delta.className='transaction-credits '+(gain?'credit-gain':'credit-spend');
    delta.textContent=(gain?'+':'−')+new Intl.NumberFormat().format(Math.abs(creditChange))+(options.auto?' gold':' credits');
    const balance=document.createElement('small');
    balance.textContent='Balance '+new Intl.NumberFormat().format(credits);
    delta.append(balance);card.append(delta);
    if(reducedMotion.matches){
      displayedCredits=credits;walletTween=null;
    }else{
      walletTween={from:displayedCredits,started:performance.now()};
    }
    $('credits').textContent=new Intl.NumberFormat().format(displayedCredits);
    for(const previous of $('creditWallet').querySelectorAll('.wallet-delta'))previous.remove();
    const burst=document.createElement('span');
    const walletChange=options.walletDelta??creditChange;
    burst.className='wallet-delta '+(walletChange>0?'credit-gain':'credit-spend');
    burst.textContent=walletChange?(walletChange>0?'+':'−')+Math.abs(walletChange):'';
    burst.setAttribute('aria-hidden','true');
    $('creditWallet').append(burst);
    setTimeout(()=>burst.remove(),1400);
  }
  if(options.auto){card.dataset.auto='true';card.dataset.outcome=options.outcome??'progress';}
  const notices=options.auto?$('transactions'):$('enchantDialog').open?$('enchantTransactions'):$('merchantDialog').open?$('merchantTransactions'):$('craftDialog').open?$('craftTransactions'):$('transactions');
  while(notices.children.length>=4)notices.children[0].remove();
  notices.append(card);
  setTimeout(()=>card.remove(),5200);
}
function updateFishingShop(){
  if(!walletTween)$('credits').textContent=new Intl.NumberFormat().format(credits);
  $('shopBalance').textContent=new Intl.NumberFormat().format(credits)+' G';
  $('shopSkill').textContent='Patience '+patienceLevel()+' · Luck '+skillLevel(playerStats.luckXp);
  $('shopRodSummary').textContent=fishingCatalog.rods[fishingGear.equippedRod].name+' · '+(fishingCatalog.rods[fishingGear.equippedRod].duration/1000).toFixed(1)+'s / catch';
  $('shopBaitCount').textContent=fishingGear.bait+' bait in your bag · One per catch';
  $('shopCatchSummary').textContent=caughtFishCount()+' fish in your bag · Worth '+caughtFishValue()+' G';
  $('fishingEquipment').textContent='Equipped: '+fishingCatalog.rods[fishingGear.equippedRod].name+' · Bait ×'+fishingGear.bait;
  const selector=$('equippedFishingRod');
  selector.replaceChildren();
  for(const id of fishingGear.ownedRods.filter(id=>!vaultedItem('rod',id))){
    const option=document.createElement('option');
    option.value=id;option.textContent=fishingCatalog.rods[id].name;selector.append(option);
  }
  selector.value=fishingGear.equippedRod;
  const offers=$('rodOffers');offers.replaceChildren();
  const currentRod=fishingCatalog.rods[fishingGear.equippedRod],currentOdds=fishingChances(patienceLevel(),fishingGear.equippedRod,playerStats.luckXp);
  for(const [id,rod] of Object.entries(fishingCatalog.rods)){
    const odds=fishingChances(patienceLevel(),id,playerStats.luckXp),owned=fishingGear.ownedRods.includes(id),equipped=fishingGear.equippedRod===id;
    const skill=patienceLevel()>=rod.patience,afford=credits>=rod.price;
    const speed=(currentRod.duration-rod.duration)/1000,quality=odds.fine+odds.rare-currentOdds.fine-currentOdds.rare;
    const deltas=equipped?[{text:'Your equipped rod',tone:'neutral'}]:[
      {text:speed===0?'Same catch speed':Math.abs(speed).toFixed(1)+'s '+(speed>0?'faster':'slower'),tone:speed>0?'up':speed<0?'down':'neutral'},
      {text:(quality>0?'+':'')+quality.toFixed(1)+'% better-quality fish',tone:quality>0?'up':quality<0?'down':'neutral'}
    ];
    offers.append(renderShopCard({document,id,name:rod.name,category:rod.quality.toUpperCase(),price:rod.price,owned,equipped,stats:[['PER CATCH',(rod.duration/1000).toFixed(1)+'s'],['FINE / RARE',odds.fine.toFixed(1)+'% / '+odds.rare.toFixed(1)+'%']],deltas,requirements:'PATIENCE '+rod.patience,reason:vaultedItem('rod',id)?'Stored in vault · Withdraw to equip':!skill?'Need '+(rod.patience-patienceLevel())+' more Patience levels':!owned&&!afford?'Need '+(rod.price-credits)+' more gold':equipped?'Ready to cast · Uses one bait':owned?'Owned · Free to equip':'Quality chances with your Patience and Luck',action:vaultedItem('rod',id)?'In vault':equipped?'Equipped':!skill?'Patience required':owned?'Equip rod':!afford?'Not enough gold':'Buy & equip',disabled:vaultedItem('rod',id)||equipped||!skill||(!owned&&!afford),onBuy:()=>buyFishingRod(id)}));
  }
  $('buyBait').disabled=credits<fishingCatalog.bait.price;
  $('sellFish').disabled=caughtFishCount()<1;
  $('sellFish').textContent=caughtFishCount()?'Sell all · '+caughtFishValue()+' G':'No fish to sell';
}
function tradeQuantity(id){
  return id==='timber'?woodcutting.timber:fishProducts[id]?fishStock[id]??0:huntingLoot[id]??0;
}
let deliveringCarpenterOrder=false;
function updateCarpenterOrder(){
  const complete=window.playerCloud?.initial?.carpenterOrderComplete===true;
  const ready=woodcutting.timber>=carpenterOrder.timber;
  $('carpenterProgress').value=complete?carpenterOrder.timber:Math.min(carpenterOrder.timber,woodcutting.timber);
  $('carpenterCount').textContent=complete?'Order fulfilled':Math.min(carpenterOrder.timber,woodcutting.timber)+' / '+carpenterOrder.timber+' timber ready';
  $('carpenterDeliver').textContent=complete?'Delivered ✓':deliveringCarpenterOrder?'Delivering…':ready?'Deliver 12 timber':'Gather '+(carpenterOrder.timber-woodcutting.timber)+' more timber';
  $('carpenterDeliver').disabled=complete||!ready||deliveringCarpenterOrder||!window.playerCloud?.deliverCarpenter;
}
async function handInCarpenterOrder(){
  if(currentRoom!=='market'||$('carpenterDeliver').disabled)return;
  deliveringCarpenterOrder=true;
  const shell=$('gameShell'),status=$('carpenterStatus');
  shell.inert=true;
  status.textContent='Delivering your timber…';
  updateCarpenterOrder();
  try{
    window.towerPauseForAccount();
    const state=await window.playerCloud.deliverCarpenter();
    credits=state.credits;
    goldEarned=state.goldEarned??goldEarned;
    for(const key of Object.keys(woodcutting))delete woodcutting[key];
  Object.assign(woodcutting,state.woodcutting);
  for(const key of Object.keys(ownedFurniture))ownedFurniture[key]=state.ownedFurniture?.[key]??0;
    status.textContent='Order complete. The carpenter paid you '+carpenterOrder.reward+' gold.';
    showTransaction('Carpenter’s Order delivered',[{text:'−'+carpenterOrder.timber+' timber',icon:'▤'}],carpenterOrder.reward);
    updateInventory();
  }catch(error){
    status.textContent=error.message;
  }finally{
    deliveringCarpenterOrder=false;
    shell.inert=false;$('merchantDialog').inert=false;
    updateCarpenterOrder();
    if(!$('carpenterDeliver').disabled)$('carpenterDeliver').focus();
    else $('carpenterTitle').focus();
  }
}
function sellTradeLoot(id,quantity,statusId='tradeStatus'){
  const item=tradeCatalog[id];
  if(!item||!Number.isSafeInteger(quantity)||quantity<1||quantity>tradeQuantity(id))return;
  if(currentRoom!=='market'&&!(currentRoom==='store'&&item.group==='fish'))return;
  if(window.playerCloud?.gameplay){
    serverGameplay('sell',{id,quantity}).then(result=>{
      const receipt=result.state.tradeReceipt;
      const firstSale=unlockFirstUpgrade(item.name,receipt.quantity,receipt.gold);
      savePlayerState();
      $(statusId).textContent='Sold '+receipt.quantity+' '+item.name+' for '+receipt.gold+' gold.';
      showTransaction('Trade completed',[{text:'−'+receipt.quantity+' '+item.name,icon:item.icon}],receipt.gold);
      if(firstSale)openUpgradeChoice();
    }).catch(error=>{$(statusId).textContent=error.message;});
    return;
  }
  const earned=quantity*item.price;
  if(!Number.isSafeInteger(earned)||!Number.isSafeInteger(credits+earned))return;
  if(id==='timber')woodcutting.timber-=quantity;
  else if(item.group==='fish')fishStock[id]-=quantity;
  else huntingLoot[id]-=quantity;
  credits+=earned;
  recordGoldEarned(earned);
  const firstSale=unlockFirstUpgrade(item.name,quantity,earned);
  if(currentRoom==='market'&&item.group!=='materials')recordQuest(quest,'marketSale',quantity);
  savePlayerState();
  $(statusId).textContent='Sold '+quantity+' '+item.name+' for '+earned+' credits.';
  showTransaction('Trade completed',[{text:'−'+quantity+' '+item.name,icon:item.icon}],earned);
  if(firstSale)openUpgradeChoice();
}
function updateTradingPost(){
  $('tradeBalance').textContent='Your wallet · '+new Intl.NumberFormat().format(credits)+' credits';
  updateCarpenterOrder();
  const offers=$('tradeOffers');offers.replaceChildren();
  for(const [id,item] of Object.entries(tradeCatalog)){
    const quantity=tradeQuantity(id),card=document.createElement('div');
    if(quantity===0&&(item.group==='fish'&&item.quality!=='common'||id===moonwellShard.id))continue;
    const title=document.createElement('b'),detail=document.createElement('p'),actions=document.createElement('div');
    card.className='rod-offer trade-card';card.dataset.loot=id;
    const art=document.createElement('div');art.className='trade-art';art.innerHTML=windowItemArt(item.group==='fish'?'fish':id==='timber'?'timber':id===moonwellShard.id?'shard':'loot');card.append(art);
    title.textContent=item.name;
    detail.textContent=item.price+' credits each · '+quantity+' in inventory';
    actions.className='trade-actions';
    for(const [count,label] of [[1,'Sell one'],[quantity,'Sell all · '+quantity*item.price+' credits']]){
      const button=document.createElement('button');
      button.type='button';button.textContent=label;
      button.setAttribute('aria-label',label+' '+item.name);
      button.disabled=quantity===0;
      button.onclick=()=>sellTradeLoot(id,count);
      actions.append(button);
    }
    card.append(title,detail,actions);
    if(id===moonwellShard.id){
      const hint=document.createElement('small');
      hint.className='trade-empty';
      hint.textContent='Keep one to craft a Moonwell Charm at the Timber Hollow workbench.';
      card.append(hint);
    }
    if(item.group==='hunting'&&quantity===0){
      const empty=document.createElement('small');
      empty.className='trade-empty';empty.textContent='Bring this hunting loot to sell it here.';
      card.append(empty);
    }
    offers.append(card);
  }
}
function savePlayerState(){
  if(activityBusy||autoJourney||window.playerCloud?.initial?.plan||window.playerCloud?.initial?.report)return;
  const snapshot={safeVersion:1,progressionVersion,goldEarned,firstUpgrade,tradingPostGuideComplete,bedLessonComplete,credits,health,vitals:playerVitals,familiars:familiarState,woodcutting,history,quest,combatGear,hunting,depthsRun,depthsDiscovered,ownedFurniture,furniture:[],homeFurniture,loungeLayout:'gaming',adventure,stats:playerStats,fishingGear,huntingLoot,fishStock,avatar,wardrobe,location:currentRoom,position:{x:player.cx,y:player.cy}};
  save('player-state',snapshot);
  if(window.playerCloud)window.playerCloud.enqueue(JSON.parse(JSON.stringify(snapshot)));
  updateInventory();
}
function editStatus(message){
  $('editStatus').textContent=message;
  $('rotate').disabled=!selection;$('remove').disabled=!selection||selection.id===null;
  $('cancelEdit').disabled=!selection;
  for(const button of $('catalog').children)button.classList.toggle('selected',selection?.id===null&&selection.type===button.dataset.type);
}
function choose(item){
  if(item.id===null&&availableFurniture(item.type)===0)return;
  selection={...item};editStatus(types[item.type]+' selected. Click a clear tile to '+(item.id===null?'place':'move')+' it.');
  if(needsBedLesson()&&item.type==='bed'){
    for(let y=1;y<7&&!hover;y++)for(let x=1;x<7&&!hover;x++)if(canPlace({...selection,x,y})&&keepsExitClear({...selection,x,y}))hover={x,y};
    note('Click a clear floor spot to place your bed · R rotates it.');
  }
  updateBedGuide();
}
function cancelSelection(){selection=null;editStatus('Select a piece to get started.');}
function switchMode(next){
  cancelFishing();
  editing=next&&canDecorate();
  route=[];target=null;interaction=null;player.seat=null;player.waveStarted=null;hover=null;hoverItem=null;
  bounds=null;
  $('wave').disabled=editing;
  $('edit').classList.toggle('active',editing);$('walk').classList.toggle('active',!editing);
  $('edit').setAttribute('aria-pressed',String(editing));$('walk').setAttribute('aria-pressed',String(!editing));
  $('roomLayout').classList.toggle('decorating',editing);
  $('roomLayout').classList.toggle('shopping',['store','armory','furnishings'].includes(currentRoom));
  $('questTracker').hidden=currentRoom==='hub'||quest.claimed;
  $('roomSide').hidden=(atHome()&&!editing)||['outside','store','armory','market','furnishings'].includes(currentRoom);
  $('merchantEntry').hidden=!['store','armory','market','furnishings'].includes(currentRoom);
  $('merchantEntryTitle').textContent=currentRoom==='furnishings'?'Browse furniture':currentRoom==='market'?'Sell your spoils':'Browse equipment';
  $('merchantEntry').querySelector('small').textContent=currentRoom==='furnishings'?'Preview, buy & decorate your home':'Equipment, prices & trading';
  $('hudHomeDecor').hidden=!atHome()||editing;
  $('furnitureShopHome').hidden=!atHome()||editing;
  $('chatPanel').hidden=editing||currentRoom!=='lounge';
  if(currentRoom==='lounge'){
    for(const button of $('gamingGuide').querySelectorAll('[data-game-table]')){
      button.hidden=!roomFurniture().some(item=>item.type===button.dataset.gameTable);
    }
  }
  $('editorPanel').hidden=!editing;
  $('directoryPanel').hidden=currentRoom!=='hub';
  $('fishingShop').hidden=currentRoom!=='store';
  $('tradingPost').hidden=currentRoom!=='market';
  $('armoryShop').hidden=currentRoom!=='armory';
  const exploring=moonwood.has(currentRoom);
  $('adventurePanel').hidden=!exploring;
  $('panelTitle').textContent=editing?(atHome()?'Home editor':'Room editor'):currentRoom==='hub'?'Tower directory':currentRoom==='store'?'Fishing supplies':currentRoom==='market'?'Trade your spoils':currentRoom==='armory'?'Choose your weapon':exploring?'Activities':'Room chat';
  $('panelSub').textContent=editing?(atHome()?'YOUR HOME':'FURNITURE & DECOR'):roomDetails[currentRoom].name.toUpperCase();
  $('resetRoom').textContent=atHome()?'Clear home furniture':'Restore original room';
  $('mode').textContent=editing?'DECORATE':currentRoom==='hub'?'MAIN HUB':currentRoom==='outside'?'OPEN AIR':exploring?'EXPLORING':'FREE ROAM';
  updateAdventurePanel();
  updateFishingShop();
  updateTradingPost();
  updateArmoryShop();
  noticeUntil=0;setHint();cancelSelection();updateBedGuide();updateTradeGuide();updateUpgradeGuide();
}
let gemDraft=[],viewedEssence=null,essenceBusy=false,essenceSlot='q';
function openEssences(gem=null,slot='q'){
  if(unavailable())return;
  if(!window.playerCloud?.gameplay){note('Connect to the game server to manage Essences.');return;}
  essenceSlot=slot;
  gemDraft=[...(magicState?.picks??[])];
  viewedEssence=typeof gem==='string'?gem:gemDraft[0]??null;
  if($('inventoryDialog').open)$('inventoryDialog').close();
  $('essenceStatus').textContent='';
  renderEssences();
  $('essenceDialog').showModal();
}
function essenceGemButton(gem,selected,click){
  const button=document.createElement('button'),icon=document.createElement('span');
  button.type='button';
  button.setAttribute('aria-pressed',String(selected));
  icon.className='essence-gem';icon.style.setProperty('--gem-color',gem.color);icon.setAttribute('aria-hidden','true');
  button.append(icon,gem.name);button.onclick=click;
  return button;
}
function renderEssences(){
  const magic=magicState??normalizeMagic();
  const fusion=confluence(gemDraft);
  const bonded=bondedEssences(magic.picks);
  const changed=gemDraft.length!==magic.picks.length||gemDraft.some(id=>!magic.picks.includes(id));
  const altar=['ruins','shrine'].includes(currentRoom)&&Math.abs(player.cx-6)+Math.abs(player.cy-4)===1;
  const canBond=altar&&currentRoom===(bonded.length?'shrine':'ruins');
  $('essenceIntro').textContent=canBond?'Bond three Gems to form a fourth. Awakening Stones unlock one power from a bonded Gem.':'Your first bonded victory and every fifth victory earn a Stone. Vault Guardians and Essence Caches guarantee Stones. Visit the Moth Shrine to change Gems.';
  $('essenceBuild').hidden=!canBond;
  const choices=$('essenceChoices');choices.replaceChildren();
  if(canBond){
    for(const [id,gem] of Object.entries(essenceGems)){
      const selected=gemDraft.includes(id);
      const button=essenceGemButton(gem,selected,()=>{
        gemDraft=selected?gemDraft.filter(pick=>pick!==id):[...gemDraft,id];
        renderEssences();
      });
      button.disabled=essenceBusy||!selected&&gemDraft.length===3;choices.append(button);
    }
  }
  $('essenceFusion').textContent=fusion?fusion.name+' · Confluence Gem':gemDraft.length+' / 3 Gems selected';
  $('essenceBond').textContent=bonded.length?'Change Gems':'Bond Gems · Get a Sword Stone';
  $('essenceBond').disabled=essenceBusy||!canBond||!fusion||!changed;
  $('essencePowers').hidden=!bonded.length;
  if(!bonded.length){if(!canBond)$('essenceIntro').textContent='Visit the Moonwell in Moonwell Ruins to choose your first three Gems.';return;}
  if(!bonded.includes(viewedEssence))viewedEssence=bonded[0];
  const count=magic.unlocked.filter(id=>bonded.includes(essencePower(id)?.gem)).length;
  for(const slot of ['q','e']){
    const button=$('essenceSlot'+slot.toUpperCase());
    button.textContent=slot.toUpperCase()+' · '+(essencePower(magic.slots[slot],playerStats,magic)?.name??'Empty slot');
    button.setAttribute('aria-pressed',String(slot===essenceSlot));
    button.disabled=essenceBusy;
    button.onclick=()=>{essenceSlot=slot;renderEssences();};
  }
  $('essenceProgress').textContent=count+' / 20 awakened · Magic rank '+magicRank(playerStats)+' · Next victory Stone in '+(magic.battleWins===0?1:5-magic.battleWins%5)+' victories';
  $('essenceEquipped').textContent='Choose Q or E, then equip an awakened power. Each spell has its own cooldown.';
  const tabs=$('essenceTabs');tabs.replaceChildren();
  for(const id of bonded)tabs.append(essenceGemButton(allEssences[id],id===viewedEssence,()=>{viewedEssence=id;renderEssences();}));
  const mastery=essenceMastery(magic,viewedEssence),gem=allEssences[viewedEssence];
  $('essenceMastery').style.setProperty('--mastery-color',gem.color);
  $('essenceMasteryTitle').textContent=mastery?gem.name+' Mastery · Level '+mastery.level+' / 5':gem.name+' Confluence · Magic rank '+magicRank(playerStats);
  $('essenceMasteryXp').textContent=mastery?(mastery.level===5?'Mastered · '+mastery.xp+' XP':mastery.progress+' / '+mastery.target+' XP to level '+(mastery.level+1)):'';
  const progress=$('essenceMasteryProgress');progress.hidden=!mastery;
  if(mastery){progress.max=mastery.target;progress.value=mastery.progress;progress.setAttribute('aria-label',gem.name+' mastery level '+mastery.level+', '+$('essenceMasteryXp').textContent);}
  $('essenceMasteryBonus').textContent=mastery?masteryBenefit(viewedEssence,mastery.level):'Confluence powers grow with your combat attributes.';
  $('essenceMasteryHint').textContent=mastery?'Use this Gem in a victory: Boar +10 mastery XP · Beetle +15 · Depths +20 to +50. Later mastery levels take longer.':'';
  const list=$('essencePowerList');list.replaceChildren();
  for(const [form,stone] of Object.entries(stoneForms)){
    const id=viewedEssence+':'+form,power=essencePower(id,playerStats,magic);
    const awakened=magic.unlocked.includes(id),active=magic.slots[essenceSlot]===id;
    const assigned=['q','e'].find(slot=>magic.slots[slot]===id);
    const row=document.createElement('article'),info=document.createElement('div');
    const title=document.createElement('strong'),description=document.createElement('small'),button=document.createElement('button');
    title.textContent=awakened?power.name+(assigned?' · '+assigned.toUpperCase():''):stone.name+' power · Locked';
    description.textContent=awakened?powerDescription(power)+' · '+power.cooldown/1000+'s cooldown':magic.stones[form]+' '+stone.name+' Stones in your bag';
    info.append(title,description);
    button.type='button';button.textContent=active?'Unequip '+essenceSlot.toUpperCase():awakened?(assigned?'Swap to ':'Equip ')+essenceSlot.toUpperCase():'Awaken';
    button.disabled=essenceBusy||!awakened&&!magic.stones[form];
    button.onclick=()=>changeEssences(awakened?'equipPower':'awakenPower',{id:active?null:id,slot:essenceSlot});
    row.append(info,button);list.append(row);
  }
}
async function changeEssences(action,body){
  if(essenceBusy||unavailable())return;
  essenceBusy=true;renderEssences();
  try{
    await serverGameplay(action,body);
    $('essenceStatus').textContent=action==='bondEssences'
      ?confluence(magicState.picks).name+' formed from your three Gems. Win fights to earn more Awakening Stones.'
      :action==='awakenPower'?'Awakened '+essencePower(body.id,playerStats,magicState).name+'.'
      :body.id?essencePower(body.id,playerStats,magicState).name+' equipped to '+body.slot.toUpperCase()+'.':'Slot '+body.slot.toUpperCase()+' cleared.';
  }catch(error){$('essenceStatus').textContent=error.message;}
  finally{essenceBusy=false;renderEssences();}
}
const hotbarPowerSymbols={sword:'⚔',shield:'⬡',speed:'ϟ',focus:'✧',renewal:'✚'};
let hotbarGemsKey='';
function equippedEssenceStatus(now,slot='q'){
  const power=essencePower(magicState?.slots[slot],playerStats,magicState);
  const remaining=Math.max(0,(magicState?.cooldowns[power?.id]??0)-now);
  const fullHealth=power?.form==='renewal'&&health>=maxHealth();
  const lowMana=manaAvailable(playerVitals,combatNow())<MANA_COST;
  return {power,remaining,fullHealth,lowMana,canCast:!!power&&player.inCombat&&!!hunting.encounter&&!remaining&&!fullHealth&&!lowMana};
}
function updateEssenceHotbar(now=Date.now()){
  const bar=$('essenceHotbar');
  bar.hidden=!magicState?.picks.length||editing;
  if(bar.hidden)return;
  const activeGems=['q','e'].map(slot=>equippedEssenceStatus(now,slot).power?.gem);
  const gems=bondedEssences(magicState.picks);
  const key=[gems.join(','),activeGems.join(','),player.inCombat].join('|');
  if(key!==hotbarGemsKey){
    hotbarGemsKey=key;
    const slots=gems.map((id,index)=>{
      const gem=allEssences[id],fusion=index===3;
      const slot=essenceGemButton(gem,activeGems.includes(id),()=>openEssences(id));
      slot.dataset.fusion=String(fusion);
      slot.title=gem.name+(fusion?' · Confluence Gem':' Essence');
      slot.setAttribute('aria-label',slot.title+(activeGems.includes(id)?' · source of an equipped power':''));
      slot.disabled=player.inCombat;
      return slot;
    });
    $('essenceHotbarGems').replaceChildren(...slots);
  }
  for(const slot of ['q','e']){
    const suffix=slot==='q'?'':'E';
    const {power,remaining,fullHealth,lowMana,canCast}=equippedEssenceStatus(now,slot);
    const button=$('essenceHotbarPower'+suffix);
    let status=!power?(player.inCombat?'Equip between fights':'Open Essences'):remaining?'Recharging · '+Math.ceil(remaining/1000)+'s'
      :!player.inCombat?allEssences[power.gem].name+' · Cast in combat'
      :lowMana?'Needs '+MANA_COST+' mana':fullHealth?'Hearts are full':power.gem==='storm'?(now<(hunting.encounter?.interruptResistUntil??0)?'Enemy resists interrupts':'Ready · Interrupt during warning'):allEssences[power.gem].name+' · Ready';
    const automated=characterRules.combat.enabled&&characterRules.combat[slot];
    if(automated&&player.inCombat&&power&&!remaining&&!fullHealth&&!lowMana)status='Auto · Waiting for tactic';
    button.dataset.automatic=String(automated);
    button.dataset.ready=String(canCast);
    button.dataset.equipped=String(!!power);
    button.disabled=player.inCombat&&!canCast;
    button.style.setProperty('--power-color',power?.color??'#b7a4ed');
    if(power)status+=' · '+MANA_COST+' MP';
    button.title=power?powerDescription(power)+' · Costs '+MANA_COST+' mana · Regenerates '+MANA_REGEN+'/sec'+(automated?' '+describeCombatSpell(power,characterRules.combat.style):''):'Open Essences to equip a power';
    button.setAttribute('aria-label',power?(canCast?'Cast ':'')+power.name+' · '+status:'Equip a power in Essences');
    const name=$('essenceHotbarName'+suffix),label=$('essenceHotbarStatus'+suffix),symbol=$('essenceHotbarSymbol'+suffix);
    if(name.textContent!==(power?.name??'Equip a power'))name.textContent=power?.name??'Equip a power';
    if(label.textContent!==status)label.textContent=status;
    const glyph=power?hotbarPowerSymbols[power.form]:'✦';
    if(symbol.textContent!==glyph)symbol.textContent=glyph;
    $('essenceHotbarMeter'+suffix).style.transform='scaleX('+(power?Math.max(0,1-remaining/power.cooldown):0)+')';
  }
}
function castEquippedEssence(slot='q'){
  if(equippedEssenceStatus(Date.now(),slot).canCast)sendServerCombat('essence',slot);
}
function currentActivityPrompt(){
  if(playerVitals.hunger<=LOW_HUNGER&&(meals[towerBread.id]??0)>0&&!fishingSession&&!woodSession&&!player.inCombat)
    return {label:'FOOD FOR THE ROAD',title:playerVitals.hunger===0?'You’re exhausted':'You’re hungry',text:'Tower Bread restores 25 hunger. Open your bag to eat a ration.',action:'rationBag'};
  if(currentRoom===wildlifeRoom)return null;
  if(currentRoom==='outside')return {label:'SAFE COMBAT PRACTICE',title:'Training courtyard',text:'Learn dodge, counter, stagger and weak spots. Try weapons without health loss or item use.',action:'courtyardPractice'};
  if(currentRoom==='hub'&&!lobbyRoutesOpen()){
    return {label:'YOUR NEXT STEP',title:'Meet the Tower Warden',text:'Speak to the Warden to begin your adventure.',action:'visitWarden'};
  }
  if(currentRoom==='logging'){
    const tree=focusedTimber();
    if(woodSession)return {label:'WOODCUTTING',title:'Chopping timber',text:'Walk away to stop. Each cut earns timber and Woodcutting XP.'};
    if(!woodcutting.axeOwned)return {label:'START WOODCUTTING',title:'Collect your free axe',text:'The woodcutter will give you an axe to start gathering timber.',action:'woodAction'};
    if(!woodcutting.equipped)return {label:'WOODCUTTING',title:'Equip your axe',text:'Get your axe ready before chopping a tree.',action:'woodAction'};
    if(tree&&treeState(tree).regrowsAt)return {label:'TREE FELLED',title:'Choose another tree',text:'Click another tree to keep gathering while this stump regrows.'};
    return {label:'WOODCUTTING',title:'Gather some timber',text:'Three cuts fell a tree. Your timber can be sold or used for crafting.',action:'woodAction'};
  }
  if(isFishingRoom(currentRoom)){
    if(fishingSession){
      const phase=fishingMoments.phase(fishingSession,performance.now());
      const otterReady=!otterAbilityBlock(fishingSession)&&!familiarSeconds();
      if(phase==='landing'&&otterReady)return {label:'REED OTTER',title:'Second Chance',text:'Recover the missed +5 Patience XP bonus.',action:'familiarAction',button:'Second Chance · G'};
      if(phase==='bite')return {label:'FISH ON!',title:'Reel now',text:'Reel in time for bonus Patience XP.',action:'adventureLandmark',secondChance:otterReady};
      return null;
    }
    if(fishingGear.bait<1)return {label:'FISHING SUPPLIES',title:'You need bait',text:'Riverworms are sold at Silverfin Outfitters in the Tower.',action:'baitRoute'};
    return {label:'FISHING',title:'Cast a line',text:'Watch the float. Reel when you see a bite for bonus Patience XP.',action:'adventureLandmark'};
  }
  if(currentRoom==='beaconwatch'&&!adventure.watchBeacon)return {label:'BEACONWATCH EXPEDITION',title:'Light the watchtower beacon',text:'Restore the beacon to open a permanent bridge back to Millbrook.',action:'watchBeaconGuide'};
  if(currentRoom==='creek'&&!adventure.bridge)return {label:'CREEK CROSSING',title:'Continue to the ruins',text:'Use the stepping stones to cross Glass Creek.',action:'adventureLandmark'};
  if(currentRoom==='trail'&&!adventure.lantern)return {label:'EXPLORATION',title:'Take the waystone lantern',text:'Its light reveals hidden paths through Moonwood.',action:'adventureLandmark'};
  if(currentRoom==='ruins'&&!magicState?.picks.length)return {label:'MAGIC GEMS',title:'Choose your first Gems',text:'Visit the Moonwell to bond three Gems and get a free Awakening Stone.',action:'adventureLandmark'};
  if(currentRoom==='clearing'&&combatNow()>=hunting.respawnAt){
    if(!combatGear.equippedWeapon)return {label:'PREPARE TO HUNT',title:'Equip a weapon',text:'Open Inventory and equip a sword before approaching the boar.',action:'equipHunting'};
    return {label:'HUNTING',title:'Wild Boar ahead',text:'Approach when you’re ready. Dodge its charge and flee if your hearts run low.',action:'adventureLandmark'};
  }
  return null;
}
let activityPromptKey='';
function updateActivityPrompt(){
  updateAutoLessonGuide();updateLoungeDressGuide();
  const blocked=editing||unavailable()||depthsRun||trackedDestination||step||route.length||interaction
    ||!$('loungeDressGuide').hidden||!$('autoLessonGuide').hidden||!$('bedGuide').hidden||!$('tradeGuide').hidden||!$('upgradeGuide').hidden
    ||!$('depthsDecision').hidden||document.querySelector('dialog[open]');
  const prompt=blocked?null:currentActivityPrompt();
  const visible=!!prompt;
  $('contextGuide').hidden=!visible;
  $('roomLayout').dataset.contextual=String(visible);
  const proxyControl=prompt?.action&&!['baitRoute','equipHunting','familiarAction','rationBag'].includes(prompt.action)?$(prompt.action):null;
  $('contextGuideAction').disabled=proxyControl?.disabled===true||prompt?.action==='familiarAction'&&serverActionBusy;
  $('contextGuideSecondChance').hidden=!prompt?.secondChance;
  $('contextGuideSecondChance').disabled=serverActionBusy;
  const key=prompt?JSON.stringify(prompt):'';
  if(key===activityPromptKey)return;
  activityPromptKey=key;
  if(!prompt)return;
  $('contextGuideLabel').textContent=prompt.label;
  $('contextGuideTitle').textContent=prompt.title;
  $('contextGuideText').textContent=prompt.text;
  const button=$('contextGuideAction');
  button.hidden=!prompt.action;
  if(!prompt.action)return;
  if(prompt.action==='familiarAction')button.textContent=prompt.button;
  else if(prompt.action==='rationBag')button.textContent='Open food in Inventory';
  else if(prompt.action==='baitRoute')button.textContent='Show route to bait shop';
  else if(prompt.action==='equipHunting')button.textContent='Open Inventory';
  else if(prompt.action==='visitWarden')button.textContent='Speak to the Warden';
  else button.textContent=$(prompt.action).textContent||prompt.title;
}
function updateAdventurePanel(){
  updateExplorationNav();
  updateWoodPanel();
  updateCombatPanel();
  $('wave').disabled=editing||!!fishingSession||!!woodSession||unavailable();
  const exploring=moonwood.has(currentRoom);
  const lantern=$('lantern');
  lantern.hidden=!exploring||!adventure.lantern;
  lantern.setAttribute('aria-pressed',String(lanternLit));
  lantern.classList.toggle('active',lanternLit);
  if(!exploring)return;
  const fieldNotes={
    reedwater:'Follow the stone bridge across the river. Willowbank lies beyond the eastern path.',
    willowbank:'Choose any free station along the river. Your bait, catches and Patience are your own. Millbrook lies to the north.',
    millbrook:'The river trader buys fish. Rest on the bench to restore your hearts, or return along the riverside path.',
    logging:!woodcutting.axeOwned?'Meet the woodcutter for a free basic axe. Then chop the marked tree, or set a timed offline shift.':'Chop timber to gain Woodcutting XP. Each timber sells for 4 gold at the Trading Post.',
    clearing:'A Wild Boar guards this clearing. Approach to hunt. Rest in the Tower to refill your hearts.',
    trail:adventure.lantern?'Your lantern reveals hidden trails and crossings.':'Take the lantern from the waystone before heading deeper.',
    grove:adventure.groveTrail?'The lantern revealed a trail to the Moth Shrine.':'Light your lantern to look for a trail through the grove.',
    creek:adventure.bridge?'Tap the button to walk across the stepping stones.':'Tap the button to light the way and walk across. There’s a spare lantern if you need one.',
    shrine:'Visit the Moonwell to bond your first Gems. Return to this altar to change your combination.',
    ruins:'Visit the Moonwell to choose your first Magic Gems, or approach the Stoneback Beetle to hunt.',
    roots:'Follow the roots back to Lantern Trail.',
    pond:fishingSession?({casting:'Casting your line…',waiting:'Watch the float. Your character will reel automatically.',twitch:'A nibble! Keep watching the float…',bite:'Bite! Reel now for +5 Patience XP. Your character will also reel automatically.',landing:'Reeling in your catch…'}[fishingMoments.phase(fishingSession,performance.now())]):fishingGear.bait<1?'Out of bait. Visit Silverfin Outfitters through the Fishing door in the Grand Lobby.':'Cast with your '+fishingCatalog.rods[fishingGear.equippedRod].name+'. Better rods and Patience improve catch quality. Fish in inventory: '+caughtFishCount()+'.'
  };
  const depthsIndex=depthsStageIndex(currentRoom);
  $('adventureStatus').textContent=fieldNotes[currentRoom]??roomDetails[currentRoom].description;
  $('fishingStats').hidden=!isFishingRoom(currentRoom);
  $('offlinePlanPanel').hidden=currentRoom!=='pond';
  $('startOfflineFishing').disabled=routineControlled()||fishingGear.bait<1||!!fishingSession;
  $('planBait').max=fishingGear.bait;
  $('planPace').textContent='One catch about every '+Math.round(60*fishingCatalog.rods[fishingGear.equippedRod].duration/4500)+' seconds with your '+fishingCatalog.rods[fishingGear.equippedRod].name+'. Each catch uses one bait and earns 10 Patience XP.';
  updatePlayerStats();
  $('adventureProgress').hidden=depthsIndex>=0;
  $('adventureProgress').textContent=adventure.discovered.length+' of '+Object.keys(moonwood.areas).filter(room=>depthsStageIndex(room)<0).length+' places discovered';
  const landmark=$('adventureLandmark');
  const bite=!!fishingSession&&fishingMoments.phase(fishingSession,performance.now())==='bite';
  const action=(currentRoom==='willowbank'||currentRoom==='ambermead')?(bite?'Reel! +5 Patience XP':fishingSession?'Fishing…':'Choose a fishing station'):{clearing:!player.inCombat&&combatNow()>=hunting.respawnAt?'Approach boar':'',trail:!adventure.lantern?'Take lantern':'',shrine:'Examine altar',creek:'Cross to the Ruins',ruins:'Visit the Moonwell',pond:bite?'Reel! +5 Patience XP':fishingSession?'Fishing…':'Cast a line'}[currentRoom];
  landmark.hidden=!action||player.inCombat;
  landmark.disabled=(!!fishingSession&&!bite)||(isFishingRoom(currentRoom)&&fishingGear.bait<1);
  landmark.classList.toggle('bite-ready',bite);
  landmark.classList.toggle('cross-creek',currentRoom==='creek');
  landmark.textContent=action??'';
  const links=$('adventureRoutes');
  links.replaceChildren();
  for(const door of roomDoors[currentRoom].filter(item=>moonwood.open(item,adventure))){
    if(currentRoom==='creek'&&door.to==='ruins')continue;
    const button=document.createElement('button');
    button.type='button';
    button.className='adventure-route';
    button.dataset.roomLink=door.to;
    button.textContent=explorationName(door.to);
    button.setAttribute('aria-label',button.textContent);
    button.onclick=()=>travelDoor(door);
    links.append(button);
  }
}
function recordAdventure(message){
  savePlayerState();
  updateAdventurePanel();
  note(message);
}
function cancelFishing(){
  cancelWoodcutting();
  if(fishingStarted===null)return;
  const castId=fishingSession?.serverCastId;
  fishingStarted=null;fishingSession=null;
  if(castId&&window.playerCloud?.gameplay){
    serverGameplay('cancel',{castId}).catch(error=>note(error.message));
  }
  if(firstUpgrade.oakTrialPending)updateUpgradeGuide();
  updateAdventurePanel();
}
function revealByLantern(){
  if(!lanternLit)return;
  if(currentRoom==='grove'&&!adventure.groveTrail){
    adventure.groveTrail=true;
    recordAdventure('A hidden trail to the Moth Shrine appears.');
  }else if(currentRoom==='creek'&&!adventure.bridge){
    adventure.bridge=true;
    recordAdventure('The stepping stones light up. Follow them to the ruins.');
  }
}
function keepsExitClear(item){
  if(!atHome())return true;
  const proposed=homeFurniture.filter(other=>other.id!==item.id);
  proposed.push(item);
  return findPath(startPosition(),homeExit.tile,proposed)!==null;
}
function place(tile){
  const item={...selection,...tile};
  if(item.id===null&&availableFurniture(item.type)===0){editStatus('There are none left in your inventory.');return;}
  if(!canPlace(item)){editStatus('That spot is occupied or outside the room.');return;}
  if(!keepsExitClear(item)){editStatus('Keep a walkable path to the exit.');return;}
  if(item.id===null){item.id=nextId++;roomFurniture().push(item);}
  else setRoomFurniture(roomFurniture().map(other=>other.id===item.id?item:other));
  if(atHome()&&item.type==='bed')bedLessonComplete=true;
  savePlayerState();
  switchMode(false);
  note(types[item.type]+' placed. Click a tile to walk.');
}
function rotate(){
  if(!selection)return;
  const rotated={...selection,rot:(selection.rot+1)%4};
  if(rotated.id!==null){
    if(!canPlace(rotated)){editStatus('This piece needs more space to rotate.');return;}
    if(!keepsExitClear(rotated)){editStatus('Keep a walkable path to the exit.');return;}
    setRoomFurniture(roomFurniture().map(other=>other.id===rotated.id?rotated:other));savePlayerState();
  }
  selection=rotated;editStatus(types[rotated.type]+' rotated '+(rotated.rot*90)+'°.');
}
function thumbnail(type){
  const el=document.createElement('canvas');
  el.width=54;el.height=44;el.setAttribute('aria-hidden','true');
  const previous=ctx;ctx=el.getContext('2d');
  const item={type,x:0,y:0,rot:0};
  const [w,d]=dimensions(item);
  ctx.translate(27-point(w/2,d/2)[0],40-point(w,d)[1]);object(item);
  ctx=previous;
  return el;
}
for(const [type,name] of Object.entries(types)){
  const item={type,id:null,rot:0};
  const button=document.createElement('button'),editorQuantity=document.createElement('small');
  editorQuantity.className='quantity';
  button.dataset.type=type;button.append(thumbnail(type),name,editorQuantity);
  button.onclick=()=>choose(item);$('catalog').append(button);

  const row=document.createElement('li'),label=document.createElement('b');
  const quantity=document.createElement('span'),placeButton=document.createElement('button');
  row.dataset.type=type;label.textContent=name;quantity.className='quantity';
  placeButton.textContent='Place';placeButton.setAttribute('aria-label','Place '+name);
  placeButton.onclick=()=>{
    $('inventoryDialog').close();
    switchMode(true);choose(item);canvas.focus();
  };
  row.append(thumbnail(type),label,quantity,placeButton);$('inventoryItems').append(row);
}
$('credits').textContent=new Intl.NumberFormat().format(credits);
$('equippedFishingRod').onchange=event=>equipFishingRod(event.target.value);
$('buyBait').onclick=()=>{
  if(window.playerCloud?.gameplay){
    serverGameplay('bait').then(()=>{
      savePlayerState();showTransaction('Bait purchased',[{text:'+10 Riverworms',icon:'≋'}],-fishingCatalog.bait.price);
    }).catch(error=>{$('shopStatus').textContent=error.message;});
    return;
  }
  if(currentRoom!=='store'||credits<fishingCatalog.bait.price)return;
  credits-=fishingCatalog.bait.price;
  fishingGear.bait+=fishingCatalog.bait.quantity;
  savePlayerState();
  $('shopStatus').textContent='Bought 10 Riverworms.';
  showTransaction('Bait purchased',[{text:'+10 Riverworms',icon:'≋'}],-fishingCatalog.bait.price);
};
$('sellFish').onclick=()=>{
  if(window.playerCloud?.gameplay){
    serverGameplay('sell',{id:'allFish'}).then(result=>{
      const receipt=result.state.tradeReceipt;
      const firstSale=unlockFirstUpgrade('Fish',receipt.quantity,receipt.gold);
      savePlayerState();showTransaction('Catch sold',[{text:'−'+receipt.quantity+' fish',icon:'⋈'}],receipt.gold);
      if(firstSale)openUpgradeChoice();
    }).catch(error=>{$('shopStatus').textContent=error.message;});
    return;
  }
  if(currentRoom!=='store')return;
  const count=caughtFishCount(),earned=caughtFishValue();
  if(count<1||!Number.isSafeInteger(earned)||!Number.isSafeInteger(credits+earned))return;
  for(const id of Object.keys(fishStock))fishStock[id]=0;
  credits+=earned;
  recordGoldEarned(earned);
  const firstSale=unlockFirstUpgrade('Fish',count,earned);savePlayerState();
  $('shopStatus').textContent='Sold '+count+' fish for '+earned+' credits.';
  showTransaction('Catch sold',[{text:'−'+count+' fish · All qualities',icon:'⋈'}],earned);
  if(firstSale)openUpgradeChoice();
};
if(hasBedStarter&&hasGamingLayout)updateInventory();else savePlayerState();
function openInventory(equipmentRoom=null){
  $('bagMealStatus').hidden=true;
  $('bagMealStatus').textContent='';
  bagCategory=equipmentRoom?'gear':'all';bagSelection=equipmentRoom==='pond'?'rod:'+fishingGear.equippedRod:equipmentRoom==='clearing'?'weapon:'+(combatGear.equippedWeapon??'trainingSword'):null;
  $('inventoryTitle').textContent=equipmentRoom==='pond'?'Equip for fishing':equipmentRoom==='clearing'?'Equip for hunting':'Inventory';
  $('weaponCard').classList.toggle('onboarding-focus',equipmentRoom==='clearing');
  $('fishingGearCard').classList.toggle('onboarding-focus',equipmentRoom==='pond');
  $('inventoryGuide').textContent=!canDecorate()
    ?'Visit your home to place furniture from storage.'
    :'Choose a piece to place it in '+(atHome()?'your home':'the Sunset Lounge')+'. Pick it up in Decorate mode to return it here.';
  if(!equipmentRoom&&needsBedLesson()){bagCategory='furniture';bagSelection='furniture:bed';$('inventoryTitle').textContent='Step 1 · Your starter bed';$('inventoryGuide').textContent='Your free Single bed is selected. Choose Place in room, then click a clear floor spot. R rotates the preview.';}
  if(equipmentRoom==='pond')$('inventoryGuide').textContent='Before your first catch, choose a fishing rod below. Your free Reed Rod is '+(fishingGear.equippedRod==='reed'?'already equipped.':'in your inventory.');
  if(equipmentRoom==='clearing')$('inventoryGuide').textContent='Before your first boar hunt, equip a sword below. '+(combatGear.equippedWeapon?'Your '+weaponCatalog[combatGear.equippedWeapon].name+' is already equipped.':'Choose a sword, then press Equip weapon.');
  updateInventory();
  $('bagHint').textContent=$('inventoryGuide').textContent;renderBag();
  if(!$('inventoryDialog').open)$('inventoryDialog').showModal();
  updateBedGuide();
  if(equipmentRoom){
    const control=$('bagAction').disabled?$('bagGrid').querySelector('[data-item="'+bagSelection+'"]'):$('bagAction');
    control.focus({preventScroll:true});control.scrollIntoView({block:'center',behavior:'instant'});
  }
}
function showFirstEquipment(room){
  const state=window.playerCloud?.initial??savedPlayerState;
  if(!needsEquipmentGuide(room,history)||hunting.encounter||hunting.recoveryUntil||state?.plan||state?.report)return;
  openInventory(room);
}


$('bagOutfitTarget').onchange=()=>{bagOutfitTarget=$('bagOutfitTarget').value;renderBag();};
$('bagManageOutfits').onclick=()=>{$('inventoryDialog').close();openAvatar();};
$('wardrobeInventory').onclick=()=>openClothingInventory(wardrobe.active);
$('createOutfitForm').onsubmit=event=>{event.preventDefault();try{const outfit=createSavedOutfit(wardrobe,$('newOutfitName').value);$('newOutfitName').value='';savePlayerState();renderWardrobe();$('wardrobeStatus').textContent=outfit.name+' saved. Choose Edit clothing to build this look.';}catch(error){$('wardrobeStatus').textContent=error.message;}};

$('merchantEntry').onclick=openMerchant;
for(const id of ['furnitureShopInventory','furnitureShopHome','furnitureShopEditor'])$(id).onclick=()=>{for(const modal of ['inventoryDialog','hudMapDialog'])if($(modal).open)$(modal).close();window.towerFurnitureShop?.open();};
$('bagAppearance').onclick=()=>{$('inventoryDialog').close();openAvatar();};
for(const category of ['all','gear','clothing','materials','furniture'])$('bagTab'+category[0].toUpperCase()+category.slice(1)).onclick=()=>{bagCategory=category;bagSelection=null;renderBag();};
for(const name of ['Furniture','Weapons','Armour'])$('craftTab'+name).onclick=()=>{for(const page of ['Furniture','Weapons','Armour']){$('craftPage'+page).hidden=page!==name;$('craftTab'+page).setAttribute('aria-pressed',String(page===name));}};
for(const activity of ['rest','fishing','woodcutting','exploring'])$('routine'+activity[0].toUpperCase()+activity.slice(1)).onclick=()=>{$('rulesActivity').value=activity;updateCharacterRulesPreview();};

$('inventory').onclick=()=>openInventory();
$('depthsMeal').onclick=()=>{
  const id=Object.keys(meals).find(key=>meals[key]>0);
  if(!id)return;
  openInventory();
  bagCategory='materials';bagSelection='meal:'+id;renderBag();
  $('bagAction').focus({preventScroll:true});
};
$('walk').onclick=()=>switchMode(false);
$('edit').onclick=()=>switchMode(true);
for(const button of document.querySelectorAll('[data-room-link]')){
  button.onclick=()=>{
    const to=button.dataset.roomLink;
    const door=roomDoors[currentRoom].find(portal=>portal.to===to);
    if(editing)switchMode(false);
    if(door)travelDoor(door);
    else if(currentRoom==='lounge'&&to==='hub')enterRoom(to);
  };
}
$('lantern').onclick=()=>{
  if(!adventure.lantern||!moonwood.has(currentRoom))return;
  lanternLit=!lanternLit;
  updateAdventurePanel();
  note(lanternLit?'Lantern lit.':'Lantern dimmed.');
  revealByLantern();
};
$('adventureLandmark').onclick=()=>{
  if(currentRoom==='creek'){
    travelDoor(roomDoors.creek.find(door=>door.to==='ruins'));
    return;
  }
  if(fishingSound)fishingMoments.enable(true);
  if(fishingSession){reelFish();return;}
  const landmark=isFishingRoom(currentRoom)?roomFurniture().filter(item=>item.type==='fishingPost').sort((a,b)=>Math.abs(a.x-player.cx)+Math.abs(a.y-player.cy)-Math.abs(b.x-player.cx)-Math.abs(b.y-player.cy))[0]:roomFurniture().find(item=>item.id==='landmark');
  if(landmark)use(landmark);
};
$('combatFlee').onclick=()=>combatAction('flee');
$('courtyardPractice').onclick=openTrainingCourtyard;
$('visitTraining').onclick=()=>{navigateHud('outside');note('Head outside and select the Training courtyard dummy.');};
$('combatDodge').onclick=()=>combatAction('dodge');
$('combatSound').setAttribute('aria-pressed',String(combatSoundEnabled));$('combatSound').textContent=combatSoundEnabled?'Combat sound on':'Combat sound off';
$('combatSound').onclick=()=>{combatSoundEnabled=!combatSoundEnabled;save('combat-sound',combatSoundEnabled);combatAudio.enable(combatSoundEnabled);$('combatSound').setAttribute('aria-pressed',String(combatSoundEnabled));$('combatSound').textContent=combatSoundEnabled?'Combat sound on':'Combat sound off';};
$('approachBeetle').onclick=()=>{
  const monster=roomFurniture().find(item=>item.type===huntEnemyForRoom(currentRoom)?.prop);
  if(monster)use(monster);
};
$('enterDepths').onclick=enterMoonwellDepths;
$('combatRecapDismiss').onclick=()=>dismissCombatRecap();
$('combatRecapClose').onclick=()=>dismissCombatRecap();
$('combatRecapNext').onclick=()=>dismissCombatRecap(true);
$('combatRecapDialog').oncancel=event=>{event.preventDefault();dismissCombatRecap();};
$('enchantWeapon').onchange=()=>{enchantSelection=$('enchantWeapon').value;$('enchantFeedback').textContent='';renderEnchanter();};
$('enchantBuy').onclick=buyEnchantment;
$('visitEnchanter').onclick=()=>{$('merchantDialog').close();use(roomFurniture().find(item=>item.type==='enchanter'));};
$('depthsSafePassage').onclick=()=>chooseDungeonPassage('safe');
$('depthsDangerPassage').onclick=()=>chooseDungeonPassage('dangerous');
$('depthsForkBank').onclick=leaveMoonwellDepths;
$('depthsCacheRoute').onclick=visitDepthsCache;
$('dungeonRelicCamp').onclick=$('dungeonRelicEntrance').onclick=()=>openDungeonLoot();
$('bagRelics').onclick=()=>{$('inventoryDialog').close();openDungeonLoot();};
$('dungeonLootTarget').onclick=changeDungeonTarget;$('dungeonLootEquip').onclick=()=>closeDungeonLoot(true);$('dungeonLootKeep').onclick=$('dungeonLootClose').onclick=()=>closeDungeonLoot();
$('dungeonLootDialog').oncancel=event=>{event.preventDefault();closeDungeonLoot();};
$('depthsSideOptions').onclick=openDungeonSideChoices;
$('depthsSideReturn').onclick=$('depthsSideFieldReturn').onclick=()=>visitDungeonSide('return');
$('depthsShrineUse').onclick=useDungeonShrine;
$('depthsSideClaim').onclick=()=>{depthsExploring=true;updateDepthsPanel();use(roomFurniture().find(item=>item.type==='sideSeal'));};
for(const id of Object.keys(depthsSideRooms))$('sideVisit'+id[0].toUpperCase()+id.slice(1)).onclick=()=>visitDungeonSide(id);
$('sideBank').onclick=()=>{$('depthsSideDialog').close();leaveMoonwellDepths();};
$('depthsOpenCache').onclick=()=>{depthsExploring=true;updateDepthsPanel();use(roomFurniture().find(item=>item.type==='essenceCache'));};
$('cacheRewardContinue').onclick=()=>$('cacheRewardDialog').close();
$('cacheRewardAwaken').onclick=()=>{
  const stone=depthsRun?.cacheStone;
  $('cacheRewardDialog').close();openEssences();
  if(stone)$('essenceStatus').textContent='Choose a bonded Gem, then awaken its '+stoneForms[stone].name+' power with your new stone.';
};
$('depthsGateLever').onclick=()=>{
  const lever=roomFurniture().find(item=>item.type==='sluiceLever');
  if(lever){depthsExploring=true;updateDepthsPanel();use(lever);}
};
$('depthsNext').onclick=advanceMoonwellDepths;
$('depthsExplore').onclick=()=>{
  depthsExploring=true;
  updateDepthsPanel();
  $('depthsCampRibbon').focus({preventScroll:true});
};
$('depthsCampRibbon').onclick=()=>{
  depthsExploring=false;
  updateDepthsPanel();
};
$('depthsLeave').onclick=leaveMoonwellDepths;
$('depthsRetreat').onclick=leaveMoonwellDepths;
for(const slot of ['q','e'])$('essenceHotbarPower'+(slot==='q'?'':'E')).onclick=()=>{
  if(player.inCombat)castEquippedEssence(slot);
  else openEssences(equippedEssenceStatus(Date.now(),slot).power?.gem,slot);
};
$('openEssences').onclick=()=>openEssences();
$('essenceBond').onclick=()=>changeEssences('bondEssences',{picks:[...gemDraft]});
$('contextGuideSecondChance').onclick=()=>useFamiliar();
$('contextGuideAction').onclick=()=>{
  const prompt=currentActivityPrompt();
  if(!prompt?.action||unavailable())return;
  if(prompt.action==='familiarAction')useFamiliar();
  else if(prompt.action==='rationBag'){openInventory();bagCategory='materials';bagSelection='meal:'+towerBread.id;renderBag();$('bagAction').focus({preventScroll:true});}
  else if(prompt.action==='baitRoute')setExplorationDestination('store');
  else if(prompt.action==='equipHunting')openInventory('clearing');
  else if(!$(prompt.action).disabled)$(prompt.action).onclick();
  updateActivityPrompt();
};
$('woodAction').onclick=woodAction;
$('openWorkbench').onclick=()=>{if(currentRoom==='logging')use(roomFurniture().find(item=>item.type==='workbench'));};
$('carpenterDeliver').onclick=handInCarpenterOrder;
$('equipAxe').onclick=equipAxe;
$('craftStonebackVest').onclick=makeStonebackVest;
$('craftMoonwellCharm').onclick=makeMoonwellCharm;
$('equipStonebackVest').onclick=toggleStonebackVest;
$('equipWeapon').onclick=toggleWeapon;
$('weaponSelect').onchange=updateWeaponInventory;
$('questJournal').onclick=openQuest;
$('hudQuests').onclick=openQuest;
$('hudHome').onclick=()=>navigateHud('home');
$('hudLobby').onclick=()=>navigateHud('hub');
$('mapDestination').onchange=previewMapRoute;
$('mapMoonSight').onclick=()=>useFamiliar();
$('mapShareTrail').onclick=()=>{
  const route=moonRouteToShare($('mapDestination').value);
  if(route.length&&multiplayer.shareTrail(route))$('mapTrailStatus').textContent='Sharing trail…';
};
$('mapTrack').onclick=()=>{
  const destination=$('mapDestination').value;
  if(!destination||!hudRoute(destination).length)return;
  setExplorationDestination(destination);
  $('hudMapDialog').close();
  canvas.focus();
};
$('explorationMap').onclick=()=>showHudMap();
$('explorationReturn').onclick=()=>setExplorationDestination('hub');
$('explorationClear').onclick=()=>setExplorationDestination(null);
$('explorationFollow').onclick=()=>{const next=nextExplorationDoor();if(next)followHudDoor(next);};
$('hudMap').onclick=()=>showHudMap();
$('hudMapPreview').onclick=()=>showHudMap();
$('hudShops').onclick=()=>showHudMap('shops');
$('railHome').onclick=()=>navigateHud('home');
$('railInventory').onclick=()=>$('inventory').onclick();
$('railWardrobe').onclick=()=>$('looks').onclick();
$('railDecorate').onclick=()=>$('edit').onclick();
$('hudHomeDecor').onclick=()=>$('edit').onclick();
$('upgradeFishing').onclick=()=>chooseFirstUpgrade('fishing');
$('upgradeCombat').onclick=()=>chooseFirstUpgrade('combat');
$('upgradeNotNow').onclick=()=>{
  firstUpgrade.deferred=true;tradeGuideRouteCache=null;worldLabelKey='';
  if(upgradeTrackedDestination&&trackedDestination===upgradeTrackedDestination)setExplorationDestination(null);
  upgradeTrackedDestination=null;savePlayerState();updateQuestUI();updateActivityPrompt();note('Upgrade guide paused. Resume it from Quests whenever you’re ready.');
};
$('resumeUpgradeGuide').onclick=()=>{delete firstUpgrade.deferred;savePlayerState();$('questDialog').close();worldLabelKey='';updateUpgradeGuide();};
$('upgradeChange').onclick=openUpgradeChoice;
$('upgradeGuideAction').onclick=followFirstUpgrade;
$('tradeGuideAction').onclick=()=>{const destination=tradingGuideDestination();if(!destination)return;if(destination.warden)use(hubFurniture.find(item=>item.type==='warden'));else followHudDoor(destination);};
$('inventoryDialog').addEventListener('close',updateBedGuide);
$('bedGuideAction').onclick=()=>{if(bedLessonComplete)travelDoor(homeExit);else openInventory();};
$('hudChatPrompt').onclick=()=>$('openRoomChat').onclick();
$('questAction').onclick=questAction;
$('visitWarden').onclick=()=>use(hubFurniture.find(item=>item.type==='warden'));
$('restAtTower').onclick=restAtTower;
$('bedRestStop').onclick=()=>{if(!homeBedRest||bedRestPolling||serverActionBusy)return;serverGameplay('bedRestStop').then(()=>{updateBedGuide();updateActivityPrompt();note('You got up with '+health+' / 100 HP.');}).catch(error=>note(error.message));};

let savingRules=false,ruleQueueDraft=[];
function currentGoalState(){return {...(window.playerCloud?.initial??savedPlayerState??{}),credits,stats:playerStats,combatGear,fishingGear,characterRules};}
function updateUpgradeGoalHud(){
  const g=upgradeGoalProgress(currentGoalState()),button=$('upgradeGoalHud');button.hidden=!g;
  if(!g)return;
  button.textContent=(g.receipt?.status==='purchased'?'Equipped: ':g.receipt||g.owned?'Goal reached: ':'Goal: ')+g.item.name+(!g.receipt&&!g.owned?' · '+Math.min(g.goldPercent,...g.requirements.map(r=>r.percent))+'%':'');
  button.title=g.item.name+' · '+g.gold+' / '+g.item.price+' gold · '+g.requirements.map(r=>r.label+' '+r.current+'/'+r.level).join(' · ');
}
function renderUpgradeGoalProgress(goal){
  const list=$('rulesGoalProgress');list.replaceChildren();
  const g=upgradeGoalProgress(currentGoalState(),goal);$('rulesGoalAutoBuy').disabled=!g||savingRules;
  if(!g)return;
  const heading=document.createElement('b');heading.textContent=g.item.name+' · '+g.item.price+' gold';list.append(heading);
  for(const row of [{label:'Gold',current:g.gold,needed:g.item.price,percent:g.goldPercent},...g.requirements.map(r=>({label:r.label+' level',current:r.current,needed:r.level,percent:r.percent}))]){
    const label=document.createElement('label'),bar=document.createElement('progress');label.textContent=row.label+' · '+row.current+' / '+row.needed;bar.max=100;bar.value=row.percent;bar.setAttribute('aria-label',label.textContent);label.append(bar);list.append(label);
  }
  const status=document.createElement('small');status.textContent=g.receipt?.status==='purchased'?'Purchased and equipped. Choose your next goal.':g.receipt||g.owned?'Goal reached. Choose your next goal or clear this one to resume.':g.ready?'Requirements met. Your next idle queue will stop for this upgrade.':'Earn gold and train the required stats through your queue. Sell your catches or hunting loot to turn them into gold.';list.append(status);
}

function renderHuntingPreview(){
 const list=$('rulesHuntingPreview');list.replaceChildren();
 const state={...currentGoalState(),history,depthsDiscovered};
 for(const id of ['boar','beetle']){
  const preview=huntingTargetPreview(state,id),enemy=preview.enemy,card=document.createElement('article');card.dataset.danger=id;
  const title=document.createElement('h4'),danger=document.createElement('b'),reward=document.createElement('p'),advice=document.createElement('p'),unlock=document.createElement('small');
  title.textContent=enemy.name;danger.textContent=preview.danger;reward.textContent=enemy.health+' HP · '+preview.xp+' combat XP · '+enemy.lootName+' worth '+enemy.sellPrice+' gold per victory';
  advice.textContent=id==='beetle'?'Recommended: Iron Sword or similar damage per second, Strength 2+, Vitality 2+ and 80+ HP. Shell armour reduces your hits; spell tactics can help.':'Recommended: Training Sword and 60+ HP. A safer way to build combat skills.';
  unlock.textContent=preview.unlocked?'Idle hunting unlocked · Health and flee rules still apply.':'Locked: defeat a Stoneback Beetle in the Ruins yourself first. Previous victories count.';
  card.append(title,danger,reward,advice,unlock);
  if(id==='beetle'){
   const button=document.createElement('button');button.type='button';button.textContent='Show route to the Ruins';button.onclick=()=>{$('characterRulesDialog').close();setExplorationDestination('ruins');navigateHud('ruins');};card.append(button);
  }
  list.append(card);
 }
}
function renderRuleQueue(){
  const list=$('rulesQueueSteps');list.replaceChildren();
  ruleQueueDraft.forEach((step,index)=>{
    const row=document.createElement('li'),number=document.createElement('b'),type=document.createElement('select'),amount=document.createElement('input'),field=document.createElement('label'),controls=document.createElement('div');
    number.textContent=index+1;number.className='queue-step-number';
    for(const [id,label] of Object.entries(queueActions)){const option=document.createElement('option');option.value=id;option.textContent=label;if(id==='huntBeetles'&&!beetleHuntUnlocked({...currentGoalState(),history,depthsDiscovered})){option.disabled=true;option.textContent+=' · Win a manual fight first';}type.append(option);}
    type.value=step.type;type.setAttribute('aria-label','Step '+(index+1)+' activity');
    const keep=['sellFish','sellTimber','sellMeat','sellShells'].includes(step.type);field.textContent=keep?'Keep':(step.type==='buyBait'||step.type.startsWith('cook'))?'Stock to':Object.hasOwn(queueHuntEnemies,step.type)?'Max fights':'Gather';
    amount.type='number';amount.min=keep?'0':'1';amount.max=Object.hasOwn(queueHuntEnemies,step.type)?'20':'1000';amount.value=step.amount;amount.disabled=step.type==='rest';amount.setAttribute('aria-label','Step '+(index+1)+' '+field.textContent.toLowerCase()+' quantity');field.hidden=step.type==='rest';field.append(amount);
    amount.oninput=()=>{step.amount=Number(amount.value);updateCharacterRulesPreview();};
    type.onchange=()=>{step.type=type.value;if(Object.hasOwn(queueHuntEnemies,step.type))$('rulesHuntingDetails').open=true;step.amount=step.type==='rest'?0:Math.max(['sellFish','sellTimber','sellMeat','sellShells'].includes(step.type)?0:1,step.amount);if(Object.hasOwn(queueHuntEnemies,step.type))step.amount=Math.min(20,step.amount);renderRuleQueue();updateCharacterRulesPreview();};
    controls.className='queue-step-controls';
    for(const [label,title,run,disabled] of [['↑','Move step up',()=>{[ruleQueueDraft[index-1],ruleQueueDraft[index]]=[step,ruleQueueDraft[index-1]];},index===0],['↓','Move step down',()=>{[ruleQueueDraft[index+1],ruleQueueDraft[index]]=[step,ruleQueueDraft[index+1]];},index===ruleQueueDraft.length-1],['×','Remove step',()=>ruleQueueDraft.splice(index,1),false]]){
      const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-label',title+' '+(index+1));button.disabled=disabled;button.onclick=()=>{run();renderRuleQueue();updateCharacterRulesPreview();};controls.append(button);
    }
    row.append(number,type,field,controls);list.append(row);
  });
  $('rulesQueueAdd').disabled=ruleQueueDraft.length>=8;
}
function draftCharacterRules(){return normalizeCharacterRules({food:{breadBudget:Number($('rulesBreadBudget').value),enabled:$('rulesFoodEnabled').checked,eatBelow:Number($('rulesFoodBelow').value),keepMeals:Number($('rulesFoodKeep').value)},enabled:$('rulesEnabled').checked,activity:$('rulesActivity').value,strategy:$('rulesStrategy').value,gambling:{game:$('gambleAutoGame').value,color:$('gambleAutoColor').value,bet:Number($('gambleAutoBet').value),lossLimit:Number($('gambleAutoLoss').value),reserveGold:Number($('gambleAutoReserve').value),profitTarget:Number($('gambleAutoProfit').value),maxRounds:Number($('gambleAutoRounds').value)},goldPolicy:{budget:Number($('goldBudget').value),reserveGold:Number($('goldReserve').value),keepFish:Number($('goldKeepFish').value),keepTimber:Number($('goldKeepTimber').value),keepMeat:Number($('goldKeepMeat').value),keepShells:Number($('goldKeepShells').value),minHealth:Number($('goldMinHealth').value)},keepBait:Number($('rulesKeepBait').value),timberTarget:Number($('rulesTimberTarget').value),queue:{enabled:$('rulesUseQueue').checked,steps:ruleQueueDraft.map(step=>({...step})),repeats:Number($('rulesQueueRepeats').value),budget:Number($('rulesQueueBudget').value),reserveGold:Number($('rulesQueueReserve').value),minHealth:Number($('rulesQueueHealth').value)},goal:{target:$('rulesGoalTarget').value||null,autoBuy:$('rulesGoalAutoBuy').checked},combat:{enabled:$('rulesCombatEnabled').checked,q:$('rulesAutoQ').checked,e:$('rulesAutoE').checked,fleeBelow:Number($('rulesCombatFlee').value),style:$('rulesCombatStyle').value,dodge:$('rulesAutoDodge').checked}});}
let autoModePage='activity';
function selectAutoModePage(page){
  autoModePage=page;
  for(const name of ['activity','food','combat','history']){const cap=name[0].toUpperCase()+name.slice(1),selected=page===name;const button=$('autoModeTab'+cap);button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;$('autoModePage'+cap).hidden=!selected;}
  $('autoModePage'+page[0].toUpperCase()+page.slice(1)).parentElement?.scrollTo?.({top:0});
}
function renderAutoModeSummary(rules){
  const running=routineControlled(),queued=rules.strategy==='routine'&&rules.queue?.enabled;
  $('autoModeState').textContent=window.playerCloud?.initial?.pendingCharacterRules?'Changes saved for next session':running?'Session in progress':rules.enabled?'Idle start enabled':'Manual start';$('autoModeState').dataset.active=String(rules.enabled);
  $('autoPlanName').textContent=rules.strategy==='earnGold'?'Earn gold':rules.strategy==='gambling'?'Table session':queued?'Your activity queue':rules.activity==='exploring'?'Explore the map':rules.activity==='fishing'?'Go fishing':rules.activity==='woodcutting'?'Chop timber':'Rest at home';
  $('autoPlanAction').textContent=rules.strategy==='earnGold'?'Choose safe work, sell surplus and protect your reserves.':rules.strategy==='gambling'?(rules.gambling.game==='roulette'?'Roulette':'Blackjack')+' · '+rules.gambling.bet+' gold per round':queued?rules.queue.steps.length+' steps · '+rules.queue.repeats+' cycle'+(rules.queue.repeats===1?'':'s'):rules.activity==='exploring'?'Walk peaceful trails and return home. No gold or gear needed.':rules.activity==='fishing'?'Keep '+rules.keepBait+' bait, then return home.':rules.activity==='woodcutting'?'Gather up to '+rules.timberTarget.toLocaleString()+' timber.':'Return home and recover your hearts.';
  $('autoPlanFood').textContent=rules.food?.enabled?'Eat below '+rules.food.eatBelow+' HP · Keep '+rules.food.keepMeals:'Use meals manually';
  $('autoPlanCombat').textContent=rules.combat.enabled?combatStyles[rules.combat.style].name+(rules.combat.dodge?' · Auto dodge':''): 'Manual tactics';
  $('autoPlanStart').textContent=rules.enabled?'After 3 minutes idle or offline':'When you choose Auto';
  $('autoSaveHint').textContent=window.playerCloud?.initial?.plan?.source==='rules'?'Save changes for your next session. The current session keeps its existing plan.':'Save your plan, then choose Auto whenever you’re ready.';
  $('rulesPreview').textContent=rules.strategy==='gambling'?'Stop at +'+rules.gambling.profitTarget+' gold, '+rules.gambling.maxRounds+' rounds, or your loss limit.':queued?rules.queue.steps.map(step=>queueActions[step.type]).join(' → '):'Up to 8 hours per session. Take control whenever you return.';
  for(const button of $('characterRulesDialog').querySelectorAll('[data-auto-strategy]'))button.setAttribute('aria-pressed',String(button.dataset.autoStrategy===rules.strategy));
  $('characterRulesDialog').dataset.strategy=rules.strategy;
}
for(const page of ['activity','food','combat','history']){const button=$('autoModeTab'+page[0].toUpperCase()+page.slice(1));button.onclick=()=>selectAutoModePage(page);button.onkeydown=event=>{const pages=['activity','food','combat','history'],index=pages.indexOf(page);let next;if(event.key==='ArrowRight'||event.key==='ArrowDown')next=pages[(index+1)%4];if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=pages[(index+3)%4];if(event.key==='Home')next=pages[0];if(event.key==='End')next=pages[3];if(next){event.preventDefault();selectAutoModePage(next);$('autoModeTab'+next[0].toUpperCase()+next.slice(1)).focus();}};}
for(const button of $('characterRulesDialog').querySelectorAll('[data-auto-strategy]'))button.onclick=()=>{$('rulesStrategy').value=button.dataset.autoStrategy;updateCharacterRulesPreview();};
function updateCharacterRulesPreview(){
  const activity=$('rulesActivity').value;
  for(const name of ['rest','fishing','woodcutting','exploring'])$('routine'+name[0].toUpperCase()+name.slice(1)).setAttribute('aria-pressed',String(activity===name));
  const adaptive=$('rulesStrategy').value==='earnGold',gambling=$('rulesStrategy').value==='gambling',queued=$('rulesUseQueue').checked;
  $('rulesGoldPolicy').hidden=!adaptive;$('rulesGamblingPolicy').hidden=!gambling;$('gambleAutoColorField').hidden=$('gambleAutoGame').value!=='roulette';
  $('rulesExactQueue').hidden=adaptive||gambling;
  $('autoSingleHeading').hidden=queued||adaptive||gambling;$('rulesQueuePanel').hidden=!queued;$('rulesSingleActivities').hidden=queued||adaptive||gambling;
  $('rulesBaitField').hidden=gambling||!adaptive&&activity!=='fishing'&&!(queued&&ruleQueueDraft.some(step=>step.type==='fishing'));$('rulesTimberField').hidden=gambling||!adaptive&&activity!=='woodcutting'&&!(queued&&ruleQueueDraft.some(step=>step.type==='woodcutting'));
  try{
    const rules=draftCharacterRules();renderHuntingPreview();if(rules.strategy==='routine'&&rules.queue?.enabled&&rules.queue.steps.some(step=>step.type==='huntBeetles')&&!beetleHuntUnlocked({...currentGoalState(),history,depthsDiscovered}))throw new Error('Win a manual Stoneback Beetle fight in the Ruins before scheduling idle hunts.');renderUpgradeGoalProgress(rules.goal);renderAutoModeSummary(rules);
    $('rulesFoodEnabled').disabled=savingRules;
    $('rulesFoodBelow').disabled=savingRules||!rules.food.enabled;
    $('rulesFoodKeep').disabled=savingRules;
    $('rulesFoodPreview').textContent='Eat at 20 hunger or less'+(rules.food.enabled?' or below '+rules.food.eatBelow+' HP':'')+'. Keep '+rules.food.keepMeals+' meals in your bag and protect per-item reserves.'+(rules.food.enabled?' Return home to recover if you fall below your health threshold without usable food.':'');
    $('rulesCombatEnabled').disabled=savingRules;
    $('rulesCombatFlee').disabled=savingRules||!rules.combat.enabled&&!ruleQueueDraft.some(step=>Object.hasOwn(queueHuntEnemies,step.type));
    $('rulesStyleDescription').textContent=combatStyles[rules.combat.style].description;
    $('rulesCombatStyle').disabled=$('rulesAutoDodge').disabled=savingRules||!rules.combat.enabled;
    for(const slot of ['q','e']){
      const key=slot.toUpperCase(),power=essencePower(magicState?.slots?.[slot],playerStats,magicState);
      $('rulesAuto'+key).disabled=savingRules||!rules.combat.enabled||!power;
      $('rules'+key+'Power').textContent=key+' · '+(power?.name??'Empty slot');
      $('rules'+key+'Policy').textContent=describeCombatSpell(power,rules.combat.style);
    }
    $('rulesCombatPreview').textContent=rules.combat.enabled
      ?combatStyles[rules.combat.style].name+' tactics run online and offline. '+(rules.combat.dodge?'Automatic dodging is enabled. ':'Automatic dodging is off. ')+(rules.combat.fleeBelow?'Attempt to flee at '+rules.combat.fleeBelow+' HP or lower.':'Keep fighting until the encounter ends.')
      :'Combat is under your manual control.';
    let detail='Choose Auto to start now. Your saved routine also begins after three minutes without input, including while the game is open. It runs for up to eight hours.';
    if(rules.enabled&&!rules.queue?.enabled&&!['rest','exploring'].includes(activity)){
      const bait=Math.min(1000,Math.max(0,fishingGear.bait-rules.keepBait));
      const preview=jobPreview(jobState(),activity,8,bait);
      detail=activity==='woodcutting'&&woodcutting.timber>=rules.timberTarget?'Your timber target is already met. Your character will rest.':activity==='fishing'&&bait===0?'Your bait reserve is already reached. Your character will rest.':preview.allowed?'Ready with your current equipment. Supplies stay in Inventory until you sell or use them.':'Will rest with current equipment: '+preview.reason;
    }
    if(activity==='exploring'&&!rules.queue?.enabled)detail='Explore five peaceful stops in about four minutes, then return home. No combat, equipment or supplies required. Starts after three minutes idle or offline when enabled.';
    if(rules.queue?.enabled)detail='Choose Auto to start now, or enable idle start to start after three minutes idle. It stops when you return, a limit is reached, or all cycles finish. Unsold supplies stay in Inventory. Hunting uses your equipped weapon and flee threshold. Returning during a fight finishes that fight before stopping.';
    if(adaptive)detail='Auto starts now or after three minutes idle when enabled. It sells only surplus fish, timber, Boar Meat and Shell Fragments; buys bait only within your limits; and reassesses after each batch or fight. If gear or health makes hunting unsafe, it gathers or rests instead.';
    if(gambling)detail=(isSmartlyDressed(wardrobe)?'Smart dress code met. ':'Equip a Tailored Suit or Moonlit Dress in Wardrobe before starting Auto gambling. ')+'Auto starts your table session now; enabling away actions also starts it after three minutes idle. The session ends at the first loss, reserve, profit, round or eight-hour limit. It never switches to Earn gold safely or raises the bet.';
    $('rulesRequirements').textContent=depthsRun?'Away routines pause while you’re in Moonwell Depths. '+detail:detail;
    const state=window.playerCloud?.initial,board=state?.plan&&state.plan.source!=='rules'||state?.report&&state.report.source!=='rules';
    $('rulesSave').disabled=savingRules||!window.playerCloud||!!board;
    $('rulesSave').textContent=savingRules?'Saving…':state?.plan?.source==='rules'?'Save for next session':'Save Auto Mode';
    if(board)$('rulesStatus').textContent='Finish your job-board shift and read its report before saving Auto Mode.';
    else if($('rulesStatus').dataset.validation==='true'){$('rulesStatus').textContent='';$('rulesStatus').dataset.validation='false';}
  }catch(error){$('rulesPreview').textContent=error.message;$('rulesStatus').textContent=error.message;$('rulesStatus').dataset.validation='true';$('rulesSave').disabled=true;}

}
function openAdvancedCharacterRules({focusGoal=false}={}){
  if(needsAutoLesson()){openAutoLesson();return;}
  if(player.inCombat&&window.playerCloud?.initial?.plan?.source!=='rules'){note('Finish combat before changing your Auto Mode settings.');return;}
  if(!routineControlled())window.towerPauseForAccount();
  const state=window.playerCloud?.initial??savedPlayerState??{},rules=normalizeCharacterRules(state.pendingCharacterRules??characterRules);
  for(const [id,key] of [['gambleAutoGame','game'],['gambleAutoColor','color'],['gambleAutoBet','bet'],['gambleAutoLoss','lossLimit'],['gambleAutoReserve','reserveGold'],['gambleAutoProfit','profitTarget'],['gambleAutoRounds','maxRounds']])$(id).value=rules.gambling[key];
  $('rulesStrategy').value=rules.strategy;for(const [id,key] of [['goldBudget','budget'],['goldReserve','reserveGold'],['goldKeepFish','keepFish'],['goldKeepTimber','keepTimber'],['goldKeepMeat','keepMeat'],['goldKeepShells','keepShells'],['goldMinHealth','minHealth']])$(id).value=rules.goldPolicy[key];
  $('rulesEnabled').checked=rules.enabled;$('rulesActivity').value=rules.activity;$('rulesKeepBait').value=rules.keepBait;$('rulesTimberTarget').value=rules.timberTarget;$('rulesStatus').textContent='';
  const food=rules.food??{enabled:false,eatBelow:50,keepMeals:2};$('rulesFoodEnabled').checked=food.enabled;$('rulesFoodBelow').value=food.eatBelow;$('rulesFoodKeep').value=food.keepMeals;$('rulesBreadBudget').value=food.breadBudget??0;
  $('rulesCombatStyle').value=rules.combat.style;$('rulesAutoDodge').checked=rules.combat.dodge;
  $('rulesCombatEnabled').checked=rules.combat.enabled;$('rulesAutoQ').checked=rules.combat.q;$('rulesAutoE').checked=rules.combat.e;$('rulesCombatFlee').value=rules.combat.fleeBelow;
  ruleQueueDraft=(rules.queue?.steps??[{type:'fishing',amount:5},{type:'sellFish',amount:0},{type:'rest',amount:0}]).map(step=>({...step}));
  $('rulesUseQueue').checked=rules.queue?.enabled===true;$('rulesQueueRepeats').value=rules.queue?.repeats??1;$('rulesQueueBudget').value=rules.queue?.budget??0;$('rulesQueueReserve').value=rules.queue?.reserveGold??100;$('rulesQueueHealth').value=rules.queue?.minHealth??60;renderRuleQueue();
  const target=$('rulesGoalTarget');target.replaceChildren();for(const [id,item] of [['',{name:'No upgrade goal'}],...Object.entries(upgradeTargets)]){const option=document.createElement('option');option.value=id;option.textContent=item.name+(item.price?' · '+item.price+' gold':'');target.append(option);}target.value=rules.goal?.target??'';$('rulesGoalAutoBuy').checked=rules.goal?.autoBuy===true;
  const log=$('rulesActivityLog');log.replaceChildren();
  for(const item of [...(state.activityLog??[])].reverse()){
    const row=document.createElement('li'),title=document.createElement('b'),detail=document.createElement('p');
    title.textContent=item.kind==='exploring'?'Explored the map':item.kind==='gambling'?'Auto gambling':item.kind==='queue'?'Activity queue':item.kind==='rest'?'Rest at home':item.kind==='fishing'?'Fishing':'Woodcutting';
    detail.textContent=(item.cookedMeals?'Cooked '+Object.entries(item.cookedMeals).map(([id,n])=>n+' × '+mealRecipes[id].name).join(', ')+' · ':'')+(item.kind==='exploring'?item.count+' peaceful stops · No gold spent · ':item.kind==='rest'?'':item.count+' '+(item.kind==='gambling'?'rounds':item.kind==='queue'?'items gathered':item.kind==='fishing'?'fish':'timber')+' · +'+item.xp+' XP · ')+({'exploration-complete':'Peaceful tour complete','gamble-loss-limit':'Total-loss limit reached','gamble-profit-target':'Net profit target reached','gamble-round-limit':'Round limit reached','beetle-trial-required':'Win a Stoneback Beetle fight yourself first','goal-reached':'Upgrade goal reached','queue-complete':'All queue cycles complete','spending-limit':'Queue spending limit reached','gold-reserve':'Gold reserve protected','wallet-full':'Wallet is full','bait-reserve':'Bait reserve protected','target-reached':'Timber target reached','away-cap':'Eight-hour cap reached',returned:'Returned to game',combat:'Skipped during combat / recovery',requirements:item.summary,rest:'Rested at home'}[item.reason]??item.reason);
    if(item.foodUsed)detail.textContent+=' · Ate '+Object.values(item.foodUsed).reduce((a,b)=>a+b,0)+' meals, restored '+item.foodHealed+' HP';
    if(item.storedItems)detail.textContent+=' · '+Object.values(item.storedItems).reduce((a,b)=>a+b,0)+' items stored in vault';
    if(item.bankedGold)detail.textContent+=' · Saved to bank '+item.bankedGold+' gold';
    if(item.gambling)detail.textContent+=' · Net '+(item.gambling.net>=0?'+':'')+item.gambling.net+' gold · Total losses '+item.gambling.totalLost+' gold';
    if(item.hunts)detail.textContent+=' · '+Object.entries(item.hunts).map(([id,record])=>huntEnemies[id].name+': '+record.wins+' wins, '+record.xp+' XP, '+(item.huntSales?.[id]??0)+' gold sold').join(' · ');
    row.append(title,detail);log.append(row);
  }
  if(!log.children.length){const row=document.createElement('li');row.textContent='Your next away routine will appear here.';log.append(row);}
  $('rulesHuntingDetails').open=false;selectAutoModePage('activity');updateCharacterRulesPreview();if(!$('characterRulesDialog').open)$('characterRulesDialog').showModal();if(focusGoal){$('autoUpgradeOptions').open=true;$('autoUpgradeOptions').scrollIntoView?.({block:'center'});$('rulesGoalTarget').focus({preventScroll:true});}
}
let simpleAutoChoice='fishing',simpleAutoRisk='balanced',simpleAutoBusy=false;
function renderSimpleAuto(){
 const resting=simpleAutoChoice==='rest';
 $('simpleAutoRiskDetail').textContent=simpleAutoRiskDetail(simpleAutoChoice,simpleAutoRisk);
 $('simpleAutoRiskNote').textContent=resting?'Rest is always safe':'Choose how far to push your loop';
 for(const button of document.querySelectorAll('[data-auto-risk]')){button.setAttribute('aria-pressed',String(button.dataset.autoRisk===(resting?'safe':simpleAutoRisk)));button.disabled=resting||simpleAutoBusy;}
 const info=simpleAutoModes[simpleAutoChoice];$('simpleAutoLoop').textContent=info.loop;$('simpleAutoDetail').textContent=info.detail;$('simpleAutoGamble').hidden=simpleAutoChoice!=='gambling';
 for(const button of $('simpleAutoChoices').children)button.setAttribute('aria-pressed',String(button.dataset.mode===simpleAutoChoice));
 $('simpleAutoStart').disabled=$('simpleAutoSave').disabled=simpleAutoBusy;$('simpleAutoStart').textContent=simpleAutoBusy?'Starting…':window.playerCloud?.initial?.plan?'Switch Auto':'Start Auto';
}
function openCharacterRules(options={}){
 if(options.focusGoal||options.advanced){openAdvancedCharacterRules(options);return;}
 if(needsAutoLesson()){openAutoLesson();return;}
 if(!routineControlled())window.towerPauseForAccount();
 const state=window.playerCloud?.initial??{},rules=normalizeCharacterRules(state.pendingCharacterRules??characterRules);
 simpleAutoRisk=rules.simpleRisk??'balanced';
 simpleAutoChoice=rules.simpleMode??(['fishing','exploring','rest'].includes(rules.activity)?rules.activity:'random');
 $('simpleAutoBreadBudget').value=rules.food?.breadBudget??0;
 $('simpleAutoIdle').checked=rules.enabled;$('simpleAutoReserve').value=rules.simpleMode?rules.goldPolicy.reserveGold:0;
 $('simpleAutoTable').value=rules.gambling.game;$('simpleAutoBet').value=rules.gambling.bet;$('simpleAutoLoss').value=rules.gambling.lossLimit;
 $('simpleAutoStatus').textContent=rules.simpleMode?'':state.autoConfigured?'Choose a loop to replace your existing custom plan.':'';
 const list=$('simpleAutoChoices');list.replaceChildren();
 for(const [id,mode] of Object.entries(simpleAutoModes)){
 const button=document.createElement('button');button.type='button';button.dataset.mode=id;
 const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('class','hud-icon');icon.setAttribute('aria-hidden','true');
 const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','#hud-i-'+mode.icon);icon.append(use);
 const label=document.createElement('b');label.textContent=mode.name;button.append(icon,label);button.onclick=()=>{simpleAutoChoice=id;if(id==='gambling'){$('simpleAutoBet').value=simpleAutoRisks[simpleAutoRisk].bet;$('simpleAutoLoss').value=simpleAutoRisks[simpleAutoRisk].lossLimit;}$('simpleAutoStatus').textContent='';renderSimpleAuto();};list.append(button);
 }
 renderSimpleAuto();$('simpleAutoDialog').showModal();
}
function simpleAutoOptions(){return {food:characterRules.food,breadBudget:Number($('simpleAutoBreadBudget').value),risk:simpleAutoChoice==='rest'?'safe':simpleAutoRisk,enabled:$('simpleAutoIdle').checked,reserveGold:Number($('simpleAutoReserve').value),game:$('simpleAutoTable').value,bet:Number($('simpleAutoBet').value),lossLimit:Number($('simpleAutoLoss').value)};}
async function saveSimpleAuto(start){
 if(simpleAutoBusy||!$('simpleAutoForm').reportValidity())return;
 try{
 simpleAutoBusy=true;renderSimpleAuto();$('simpleAutoStatus').textContent='';
 const options=simpleAutoOptions(),rules=normalizeCharacterRules(simpleAutoRules(simpleAutoChoice,options));
 if(!routineControlled())savePlayerState();
 const state=start?await window.playerCloud.startSimpleAuto(simpleAutoChoice,options):await window.playerCloud.saveRules(rules);
 characterRules=normalizeCharacterRules(state.characterRules);updateUpgradeGoalHud();
 if(start){$('simpleAutoDialog').close();note(state.autoSwitch?'Finishing this fight, then switching Auto.':simpleAutoModes[simpleAutoChoice].name+' started.');}
 else $('simpleAutoStatus').textContent=state.pendingCharacterRules?'Saved. Your new loop starts next session.':'Saved. Choose Auto whenever you are ready.';
 }catch(error){$('simpleAutoStatus').textContent=error.message;}
 finally{simpleAutoBusy=false;renderSimpleAuto();}
}
for(const button of document.querySelectorAll('[data-auto-risk]'))button.onclick=()=>{
 simpleAutoRisk=button.dataset.autoRisk;
 $('simpleAutoBet').value=simpleAutoRisks[simpleAutoRisk].bet;$('simpleAutoLoss').value=simpleAutoRisks[simpleAutoRisk].lossLimit;
 renderSimpleAuto();
};
$('simpleAutoForm').onsubmit=event=>{event.preventDefault();saveSimpleAuto(true);};
$('simpleAutoSave').onclick=()=>saveSimpleAuto(false);
$('simpleAutoAdvanced').onclick=()=>{$('simpleAutoDialog').close();openAdvancedCharacterRules();};
$('simpleAutoDialog').oncancel=event=>{if(simpleAutoBusy)event.preventDefault();};
$('openCharacterRules').onclick=openCharacterRules;$('upgradeGoalHud').onclick=openCharacterRules;
$('clearAutoUpgradeGoal').onclick=()=>{$('rulesGoalTarget').value='';$('rulesGoalAutoBuy').checked=false;updateCharacterRulesPreview();$('rulesStatus').textContent='Completed goal cleared. Save Auto Mode to use your routine again.';};
$('rulesQueueAdd').onclick=()=>{if(ruleQueueDraft.length<8)ruleQueueDraft.push({type:'fishing',amount:5});renderRuleQueue();updateCharacterRulesPreview();};
for(const id of ['rulesFoodEnabled','rulesFoodBelow','rulesFoodKeep','rulesBreadBudget','gambleAutoGame','gambleAutoColor','gambleAutoBet','gambleAutoLoss','gambleAutoReserve','gambleAutoProfit','gambleAutoRounds','rulesStrategy','goldBudget','goldReserve','goldKeepFish','goldKeepTimber','goldKeepMeat','goldKeepShells','goldMinHealth','rulesUseQueue','rulesQueueRepeats','rulesQueueBudget','rulesQueueReserve','rulesQueueHealth','rulesGoalTarget','rulesGoalAutoBuy','rulesEnabled','rulesActivity','rulesKeepBait','rulesTimberTarget','rulesCombatEnabled','rulesCombatStyle','rulesAutoDodge','rulesAutoQ','rulesAutoE','rulesCombatFlee'])$(id).oninput=updateCharacterRulesPreview;
$('characterRulesForm').addEventListener('invalid',event=>{const panel=event.target.closest('[role=tabpanel]');if(panel){const page=panel.id.replace('autoModePage','').toLowerCase();selectAutoModePage(page);}},true);
$('characterRulesDialog').oncancel=event=>{if(savingRules)event.preventDefault();};
$('characterRulesForm').onsubmit=async event=>{
  event.preventDefault();if(savingRules)return;
  try{
    const rules=draftCharacterRules();savingRules=true;updateCharacterRulesPreview();$('characterRulesDialog').querySelector('.close').disabled=true;
    if(!routineControlled()){window.towerPauseForAccount();savePlayerState();}const state=await window.playerCloud.saveRules(rules);
    characterRules=normalizeCharacterRules(state?.characterRules??rules);updateUpgradeGoalHud();
    $('rulesStatus').dataset.validation='false';$('rulesStatus').textContent=state?.pendingCharacterRules?'Saved for your next Auto session. Your current session keeps its existing plan.':rules.combat.enabled?'Auto Mode saved. Combat tactics are ready for your next encounter.':'Auto Mode saved.';
  }catch(error){$('rulesStatus').textContent=error.message;}
  finally{savingRules=false;updateCharacterRulesPreview();$('characterRulesDialog').querySelector('.close').disabled=false;}
};

let selectedJob='fishing',startingJob=false;
function jobState(){return {familiars:familiarState,location:currentRoom,health,hunting,woodcutting,fishingGear,stats:playerStats,adventure,history,...(window.playerCloud?.initial?.plan?{plan:window.playerCloud.initial.plan}:{}),...(window.playerCloud?.initial?.report?{report:window.playerCloud.initial.report}:{})};}
function updateJobBoard(){
  for(const id of ['jobFishing','jobWoodcutting','jobHours','jobBait'])$(id).disabled=startingJob;
  $('jobBoardDialog').querySelector('.close').disabled=startingJob;
  const wood=selectedJob==='woodcutting',hours=Number($('jobHours').value)||1,bait=Number($('jobBait').value);
  const preview=jobPreview(jobState(),selectedJob,hours,bait);
  $('jobFishing').setAttribute('aria-pressed',String(!wood));$('jobWoodcutting').setAttribute('aria-pressed',String(wood));
  $('jobBaitField').hidden=wood;$('jobBait').max=Math.min(1000,fishingGear.bait);
  $('jobEstimate').textContent=preview.count.toLocaleString()+(wood?' timber':' fish');
  $('jobExperience').textContent='+'+preview.xp.toLocaleString()+' '+preview.skill+' XP';
  $('jobTool').textContent=preview.tool+' · '+Math.round(preview.interval/1000)+' seconds per '+(wood?'timber':'catch');
  const minutes=Math.ceil(preview.duration/60000);
  $('jobValue').textContent='Sale value: '+preview.valueMin.toLocaleString()+(wood?'':'–'+preview.valueMax.toLocaleString())+' gold · About '+minutes+' minutes of work. '+(!wood?'Ends early when the bait limit is reached.':'');
  $('jobRequirement').textContent=preview.reason||(wood?'Ready · Equipped axe · No supplies consumed':'Ready · Equipped rod · Uses up to '+preview.count+' bait');
  $('jobRequirement').className=preview.allowed?'job-ready':'job-locked';
  $('jobStart').disabled=startingJob||!preview.allowed||currentRoom!=='hub'||!window.playerCloud;
}
function openJobBoard(){
  if(currentRoom!=='hub'||!lobbyRoutesOpen()||unavailable())return;
  route=[];step=null;interaction=null;target=null;player.x=player.cx;player.y=player.cy;
  $('jobBait').value=Math.min(10,fishingGear.bait);$('jobError').textContent='';updateJobBoard();$('jobBoardDialog').showModal();
}
$('openJobBoard').onclick=openJobBoard;
$('jobBoardDialog').oncancel=event=>{if(startingJob)event.preventDefault();};
$('jobFishing').onclick=()=>{selectedJob='fishing';updateJobBoard();};
$('jobWoodcutting').onclick=()=>{selectedJob='woodcutting';updateJobBoard();};
$('jobHours').onchange=updateJobBoard;$('jobBait').oninput=updateJobBoard;
$('jobStart').onclick=async()=>{
  if(startingJob||currentRoom!=='hub')return;
  const options={kind:selectedJob,hours:Number($('jobHours').value),baitLimit:Number($('jobBait').value)};
  if(!jobPreview(jobState(),options.kind,options.hours,options.baitLimit).allowed)return;
  startingJob=true;updateJobBoard();$('jobError').textContent='Preparing your shift…';
  try{window.towerPauseForAccount();savePlayerState();await window.playerCloud.startJob(options);}
  catch(error){$('jobError').textContent=error.message;startingJob=false;updateJobBoard();}
};

$('loungeGameStart').onclick=()=>playLoungeRound();
$('loungeGameHit').onclick=()=>playLoungeRound('hit');
$('loungeGameStand').onclick=()=>playLoungeRound('stand');
$('loungeGameReveal').onclick=()=>playLoungeRound('reveal');
$('loungeGameStake').onchange=()=>renderLoungeGame();
for(const value of [5,10,25])$('loungeStake'+value).onclick=()=>{$('loungeGameStake').value=String(value);renderLoungeGame();};
for(const color of ['red','black'])$('loungeColor'+(color==='red'?'Red':'Black')).onclick=()=>{$('loungeGameColor').value=color;renderLoungeGame();};
$('loungeSound').setAttribute('aria-pressed',String(loungeSound));
$('loungeSound').textContent=loungeSound?'Sound on':'Sound off';
$('loungeSound').onclick=()=>{loungeSound=!loungeSound;save('lounge-sound',loungeSound);$('loungeSound').setAttribute('aria-pressed',String(loungeSound));$('loungeSound').textContent=loungeSound?'Sound on':'Sound off';loungeSoundReady();};
$('loungeGameDialog').addEventListener('close',()=>clearTimeout(loungeTimer));
$('reception').onclick=()=>use(hubFurniture[0]);
for(const button of $('gamingGuide').querySelectorAll('[data-game-table]')){
  button.onclick=()=>{
    const destination=roomFurniture().find(item=>item.type===button.dataset.gameTable);
    if(destination)use(destination);
  };
}
$('wave').onclick=waveHello;
$('rotate').onclick=rotate;
$('cancelEdit').onclick=cancelSelection;
$('remove').onclick=()=>{
  if(!selection||selection.id===null)return;
  const name=types[selection.type];
  setRoomFurniture(roomFurniture().filter(item=>item.id!==selection.id));savePlayerState();
  selection=null;editStatus(name+' returned to your inventory.');
};
$('resetRoom').onclick=()=>{
  if(!atHome()&&Object.keys(types).some(type=>countFurniture(homeFurniture,type)+countFurniture(initial,type)>ownedFurniture[type])){
    editStatus('Pick up furniture from your home before restoring the lounge.');return;
  }
  if(!confirm(atHome()?'Return all home furniture to your inventory?':'Restore the original lounge furniture?'))return;
  setRoomFurniture(atHome()?[]:initial.map(item=>({...item})));savePlayerState();
  step=null;route=[];player.seat=null;movePlayerToSpawn();selection=null;
  editStatus(atHome()?'Home furniture returned to your inventory.':'The original lounge has been restored.');
};
canvas.addEventListener('pointermove',e=>{
  const p=pointer(e);hover=p.tile;hoverItem=p.item;
  canvas.style.cursor=p.item||p.door?'pointer':'crosshair';
});
canvas.addEventListener('pointerleave',()=>{hover=null;hoverItem=null;});
canvas.addEventListener('click',e=>{
  if(fishingSound)fishingMoments.enable(true);
  const {tile,item,door}=pointer(e);
  if(!editing){if(item?.addId||player.inCombat&&item?.type===huntEnemyForRoom(currentRoom)?.prop)use(item);else if(door)travelDoor(door);else if(item)use(item);else if(tile)walkTo(tile);return;}
  if(item&&!fixed(item)&&selection?.id!==null&&item.id!==selection?.id){choose(item);return;}
  if(selection&&tile)place(tile);
});
const arrows={ArrowRight:[1,0],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowUp:[0,-1]};
function waveHello(){
  if(editing||woodSession||unavailable())return;
  if(step||route.length){note('Stop walking to wave.');return;}
  if(!player.seat)player.back=false;
  player.waveStarted=performance.now();multiplayer?.wave();
  note(avatar.name+' waves hello!');
}
canvas.addEventListener('keydown',e=>{
  if(e.code==='Space'&&woodSession){e.preventDefault();return;}
  if(e.code==='Space'&&fishingSession){
    e.preventDefault();
    if(!e.repeat)reelFish();
    return;
  }
  const delta=arrows[e.key];

  if(!editing&&e.code==='Space'){
    e.preventDefault();
    if(!e.repeat)waveHello();
  }
  if(!editing&&delta){
    e.preventDefault();
    const p=startPosition();walkTo({x:p.x+delta[0],y:p.y+delta[1]});
  }
});
$('veilstep').onclick=useVeilstep;
for(const id of Object.keys(outfitPowers))$(id).onclick=()=>useOutfitPower(id);
document.addEventListener('keydown',e=>{
  const outfitPower=Object.keys(outfitPowers).find(id=>e.code==='Key'+outfitPowers[id].key&&wearsClothing(wardrobe,outfitPowers[id].item));
  if(outfitPower&&!e.target.matches('input,textarea,select,[contenteditable]')&&!document.querySelector('dialog[open]')){e.preventDefault();if(!e.repeat)useOutfitPower(outfitPower);return;}
  if(e.code==='KeyV'&&wearsVeilCloak(wardrobe)&&!e.target.matches('input,textarea,select,[contenteditable]')&&!document.querySelector('dialog[open]')){e.preventDefault();if(!e.repeat)useVeilstep();return;}
  if(e.code==='KeyG'&&familiarState.equipped&&!e.target.matches('input,textarea,select,[contenteditable]')&&!document.querySelector('dialog[open]')){e.preventDefault();if(!e.repeat)useFamiliar();return;}
  if(player.inCombat&&['Space','KeyF','KeyQ','KeyE'].includes(e.code)&&!e.target.matches('input,textarea,select')&&!document.querySelector('dialog[open]')){
    if(['KeyQ','KeyE'].includes(e.code)){e.preventDefault();if(!e.repeat)castEquippedEssence(e.code==='KeyQ'?'q':'e');return;}
    if(e.code==='Space'&&e.target.matches('button'))return;
    e.preventDefault();if(!e.repeat)combatAction(e.code==='Space'?'dodge':'flee');return;
  }
  if(!editing||e.target.matches('input')||document.querySelector('dialog[open]'))return;
  if(e.key.toLowerCase()==='r'){e.preventDefault();rotate();}
  if(e.key==='Escape'){
    if(selection)cancelSelection();
    else switchMode(false);
    canvas.focus({preventScroll:true});
  }
});
function setZoom(value){
  zoom=Math.max(.75,Math.min(1.5,value));hover=null;hoverItem=null;
  $('plus').disabled=zoom===1.5;$('minus').disabled=zoom===.75;
}
$('plus').onclick=()=>setZoom(zoom+.125);
$('minus').onclick=()=>setZoom(zoom-.125);
$('resetView').onclick=()=>setZoom(1);
window.addEventListener('resize',()=>{bounds=null;});
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&player.inCombat){if(window.playerCloud?.gameplay)sendServerCombat();else hunting.encounter=resumeHunt(hunting.encounter,Date.now(),playerStats,combatGear.moonwellCharmEquipped);}
});
function showMessage(msg,targetId='messages'){
  const row=document.createElement('div');row.className='message';
  const icon=document.createElement('div');icon.className='bot';icon.textContent='☺';
  const body=document.createElement('div'),name=document.createElement('b'),text=document.createElement('p');
  name.textContent=msg.name;text.textContent=msg.text;body.append(name,text);row.append(icon,body);
  const target=$(targetId);target.append(row);while(target.children.length>40)target.children[0].remove();target.scrollTop=target.scrollHeight;
}
for(const msg of messages)showMessage(msg);
$('chatForm').addEventListener('submit',e=>{e.preventDefault();sendRoomChat($('chatInput'));});
$('roomChatForm').addEventListener('submit',e=>{e.preventDefault();sendRoomChat($('roomChatInput'));});
$('openRoomChat').onclick=()=>{$('roomChatTitle').textContent=roomDetails[currentRoom].name;$('roomChatDialog').showModal();};
function drawAvatarPreview(time){
  for(const preview of $('formalSets').querySelectorAll('canvas')){
    const set=clothingSets[preview.dataset.formalPreview],target=preview.getContext('2d');target.clearRect(0,0,preview.width,preview.height);target.save();target.scale(2,2);
    sprite(target,25,61,{...draft,outfit:clothingCatalog[set.jacket].index,trousers:clothingCatalog[set.trousers].index,boots:clothingCatalog[set.boots].index},{time});target.restore();
  }
  const preview=$('avatarPreview'), target=preview.getContext('2d');
  target.clearRect(0,0,preview.width,preview.height);
  target.fillStyle='#1717258f';target.fillRect(20,54,16,2);
  sprite(target,28,54,draft,{time});
}
function updateAvatarPreview(){
  drawAvatarPreview(performance.now());
  for(const group of ['hair']){
    for(const [index,button] of Array.from($(group).children).entries())button.setAttribute('aria-pressed',String(draft.hair===index));
  }
}
for(const [group,key,colors,names] of [
  ['hair','hair',hairColors,['Chestnut','Midnight','Copper','Honey','Violet']]
]){
  colors.forEach((color,index)=>{
    const button=document.createElement('button');
    button.title=names[index];button.setAttribute('aria-label',names[index]);
    button.style.setProperty('--swatch',color);button.onclick=()=>{draft[key]=index;updateAvatarPreview();};$(group).append(button);
  });
}

function applyWornOutfit(){
  if(routineControlled())return;
  avatar=outfitAppearance(wardrobe,avatar);
  if(!wearsVeilCloak(wardrobe))outfitMagic.veilUntil=0;
  updateVeilHud();updateOutfitPowersHud();save('avatar',avatar);updateName();savePlayerState();
}
function openClothingInventory(id){
  if($('avatarDialog').open)$('avatarDialog').close();
  openInventory();bagCategory='clothing';bagSelection=null;bagOutfitTarget=id;renderBag();
}
let tailorSelection='fishing',tailorBusy=false,tailorFacing=0;
function visitTailor(){
  if(unavailable())return;
  if(currentRoom==='tailor')use(tailorFurniture[0]);else navigateHud('tailor');
}
function openTailor(){
  if(currentRoom!=='tailor')return;
  if(unavailable())return;
  tailorFacing=0;$('tailorStatus').textContent='Purchases go to Inventory → Clothing. No stat bonuses.';renderTailor();$('tailorDialog').showModal();
}
function renderTailor(){
  const set=clothingSets[tailorSelection],quote=tailorQuote(wardrobe,tailorSelection),list=$('tailorSets');list.replaceChildren();
  $('tailorGold').textContent=credits.toLocaleString()+' gold';
  for(const [id,look] of Object.entries(clothingSets).filter(([,s])=>s.shop)){
    const button=document.createElement('button');button.type='button';button.dataset.tailorSet=id;button.setAttribute('aria-pressed',String(id===tailorSelection));button.textContent=look.name+' · '+tailorQuote(wardrobe,id).price+' gold';button.disabled=tailorBusy;button.onclick=()=>{tailorSelection=id;renderTailor();};list.append(button);
  }
  $('tailorName').textContent=set.name;$('tailorDescription').textContent=set.description;
  const pieces=$('tailorPieces');pieces.replaceChildren();
  for(const slot of clothingSlots){
    const id=set[slot],item=clothingCatalog[id],owned=wardrobe.owned.includes(id),row=document.createElement('div'),name=document.createElement('span'),button=document.createElement('button');
    name.textContent=item.name;button.type='button';button.dataset.tailorPiece=id;button.textContent=owned?'Owned':'Buy · '+item.price+' gold';button.disabled=owned||tailorBusy||credits<item.price;button.onclick=()=>buyTailor(id,'piece');row.append(name,button);pieces.append(row);
  }
  $('tailorBuySet').textContent=quote.ids.length?'Buy missing pieces · '+quote.price+' gold':'Complete set owned';$('tailorBuySet').disabled=!quote.ids.length||tailorBusy||credits<quote.price;
  $('tailorWear').hidden=quote.ids.length>0;$('tailorWear').disabled=tailorBusy;
  $('tailorTurn').disabled=tailorBusy;
}
function drawTailorPreview(time){
  const c=$('tailorPreview'),target=c.getContext('2d'),set=clothingSets[tailorSelection];target.clearRect(0,0,c.width,c.height);
  target.fillStyle='#263750';target.beginPath();target.ellipse(120,232,52,11,0,0,Math.PI*2);target.fill();target.save();target.scale(4,4);
  sprite(target,30,58,{...avatar,outfit:clothingCatalog[set.jacket].index,trousers:clothingCatalog[set.trousers].index,boots:clothingCatalog[set.boots].index},{direction:tailorFacing<2?'right':'left',back:tailorFacing%2===1,time});target.restore();
}
async function buyTailor(id,kind){
  if(tailorBusy)return;
  const quote=tailorQuote(wardrobe,id,kind);tailorBusy=true;$('tailorDialog').querySelector('.close').disabled=true;renderTailor();$('tailorStatus').textContent='Completing your purchase…';
  try{const result=await serverGameplay('buyClothing',{id,kind});Object.assign(wardrobe,normalizeWardrobe(result.state.wardrobe));renderBag();
    $('tailorStatus').textContent='Purchased! Find your new pieces in Inventory → Clothing, or wear the complete set here.';
    showTransaction('New clothing',[...quote.ids.map(key=>({icon:'✦',text:clothingCatalog[key].name+' · Added to Inventory'}))],-quote.price);
  }catch(error){$('tailorStatus').textContent=error.message;}
  finally{tailorBusy=false;$('tailorDialog').querySelector('.close').disabled=false;renderTailor();}
}
$('tailorBuySet').onclick=()=>buyTailor(tailorSelection,'set');
$('tailorTurn').onclick=()=>{tailorFacing=(tailorFacing+1)%4;};
$('tailorWear').onclick=()=>{try{const outfit=wearClothingSet(wardrobe,tailorSelection);applyWornOutfit();$('tailorStatus').textContent='Now wearing '+outfit.name+'. Saved to Wardrobe.';}catch(error){$('tailorStatus').textContent=error.message;}};
$('tailorDialog').oncancel=event=>{if(tailorBusy)event.preventDefault();};
function renderWardrobe(){
  $('wearingOutfitName').textContent=wardrobe.outfits.find(outfit=>outfit.id===wardrobe.active).name;
  $('wardrobeTailor').onclick=()=>{$('avatarDialog').close();visitTailor();};
  const sets=$('formalSets');sets.replaceChildren();
  for(const [id,set] of Object.entries(clothingSets).filter(([,set])=>!set.shop)){
    const card=document.createElement('article'),preview=document.createElement('canvas'),name=document.createElement('b'),detail=document.createElement('p'),button=document.createElement('button');
    card.className='formal-set';card.dataset.set=id;preview.width=100;preview.height=130;preview.setAttribute('aria-label',set.name+' character preview');preview.dataset.formalPreview=id;
    name.textContent=set.name;detail.textContent=set.description;button.type='button';const replaceWorn=loungeDressGuiding&&wardrobe.outfits.length>=6&&!wardrobe.outfits.some(outfit=>clothingSlots.every(slot=>outfit[slot]===set[slot]));button.textContent=replaceWorn?'Update worn look':'Save & wear';if(replaceWorn)detail.textContent+=' · All six slots used: updates your current outfit.';button.dataset.wearSet=id;button.disabled=routineControlled();
    button.onclick=()=>{try{let outfit;if(replaceWorn){outfit=wardrobe.outfits.find(o=>o.id===wardrobe.active);for(const slot of clothingSlots)addClothingToOutfit(wardrobe,outfit.id,set[slot]);}else outfit=wearClothingSet(wardrobe,id);applyWornOutfit();draft=outfitAppearance(wardrobe,draft);renderWardrobe();updateAvatarPreview();$('wardrobeStatus').textContent='Now wearing '+outfit.name+'. Edit individual pieces in Inventory.';}catch(error){$('wardrobeStatus').textContent=error.message;}};
    card.append(preview,name,detail,button);sets.append(card);
  }
  updateLoungeDressGuide();
  const list=$('wardrobeOutfits');list.replaceChildren();
  for(const outfit of wardrobe.outfits){
    const card=document.createElement('article'),picture=document.createElement('canvas'),name=document.createElement('b'),items=document.createElement('p'),wear=document.createElement('button'),edit=document.createElement('button'),actions=document.createElement('div');
    const active=outfit.id===wardrobe.active;card.className='saved-outfit'+(active?' is-worn':'');card.dataset.outfit=outfit.id;
    picture.width=56;picture.height=62;picture.setAttribute('aria-hidden','true');sprite(picture.getContext('2d'),28,54,outfitAppearance(wardrobe,avatar,outfit.id),{time:performance.now()});
    name.textContent=outfit.name;items.textContent=clothingSlots.filter(slot=>slot!=='trousers'||!clothingCatalog[outfit.jacket].dress).map(slot=>clothingCatalog[outfit[slot]].name).join(' · ');
    wear.type='button';wear.textContent=active?'Wearing':'Wear outfit';wear.disabled=active||routineControlled();wear.onclick=()=>{wearSavedOutfit(wardrobe,outfit.id);applyWornOutfit();draft=outfitAppearance(wardrobe,draft);renderWardrobe();updateAvatarPreview();$('wardrobeStatus').textContent='Now wearing '+outfit.name+'.';};
    edit.type='button';edit.textContent='Edit clothing';edit.onclick=()=>openClothingInventory(outfit.id);actions.className='outfit-actions';actions.append(wear,edit);card.append(picture,name,items,actions);list.append(card);
  }
  $('outfitCapacity').textContent=wardrobe.outfits.length+' / 6 saved outfits. Clothing can be reused.';$('createOutfit').disabled=wardrobe.outfits.length>=6||routineControlled();$('saveAvatar').disabled=routineControlled();
}

function openAvatar(){
  draft={...avatar};$('guestName').value=draft.name;$('wardrobeStatus').textContent='';renderWardrobe();updateAvatarPreview();$('avatarDialog').showModal();
}
function updateName(){
  $('profile').children[1].firstChild.textContent=avatar.name;
  roomLayers.home=makeRoomLayer(()=>room(true));
  if(atHome())updateRoomLabel();
  const portrait=$('portrait').getContext('2d');
  portrait.clearRect(0,0,24,24);
  portrait.save();portrait.translate(12,39);pixelHead(portrait,avatar,false,false);portrait.restore();
}
$('watchBeaconGuide').onclick=()=>{const beacon=roomFurniture().find(i=>i.type==='watchBeacon');if(beacon)use(beacon);};
$('profile').onclick=openAvatar;$('looks').onclick=openAvatar;
$('attributes').onclick=()=>{const ink=$('statsAvatar').getContext('2d');ink.clearRect(0,0,56,62);sprite(ink,28,54,avatar,{time:performance.now(),vest:armourSelection(combatGear)});updatePlayerStats();renderProgress();$('attributesDialog').showModal();};
$('help').onclick=()=>$('helpDialog').showModal();
for(const button of document.querySelectorAll('dialog .close'))button.onclick=()=>button.closest('dialog').close();
$('saveAvatar').onclick=()=>{
  avatar=outfitAppearance(wardrobe,{...draft,name:$('guestName').value.trim()||'Guest'});
  save('avatar',avatar);updateName();savePlayerState();$('avatarDialog').close();
};
function updateRoomLabel(){
  const landmarks={
    home:'The wall sign reads Your Home, '+avatar.name+'. Use the exit to reach the Grand Lobby.',
    hub:'Use a doorway, the Outside steps, or the Tower directory to travel.',
    furnishings:'Browse the showroom or click a display to shop. Use the LOBBY exit to leave.',
    lounge:'Click furniture to interact. Use the Lobby button to go back.',
    outside:'Use the Moonwood steps to explore or the Tower door to return indoors.',
    store:'Buy bait and rods from Fishing supplies. Use Lobby to return.',
    market:'Trade your spoils or walk through the Bakery door for rations.',
    bakery:'Speak to the baker to buy rations. Use the Market door to return.'
  };
  canvas.setAttribute('aria-label',roomDetails[currentRoom].name+'. Click a floor tile or use arrow keys to walk. '+(landmarks[currentRoom]??'Use the marked trails or the field journal to travel.'));
}
function enterRoom(next,arrival,{automatic=false}={}){
  if(next==='thornwood'&&!adventure.discovered.includes('thornwood')&&!thornwoodConfirmed&&savedPlayerState?.location!=='thornwood'){
    openWatchDialog('The trail turns dangerous.','Thornwood is optional. A Thorn Boar has 115 HP and hits harder than the Wild Boar. Bring a weapon and meals. The cream road reaches Beaconwatch safely.','Enter Thornwood',()=>{thornwoodConfirmed=true;enterRoom(next,arrival,{automatic});});return;
  }
  if(next==='lounge'&&!isSmartlyDressed(wardrobe)&&!autoJourneyTransition){requestLoungeDress();return;}
  if(next==='lounge'&&isSmartlyDressed(wardrobe))loungeDressGuiding=false;
  if(!autoJourneyTransition&&(player.inCombat||(hunting.recoveryUntil&&next!=="hub"&&next!=="home"))){note("Finish combat or recovery before travelling.");return;}
  const depthsIndex=depthsStageIndex(next);
  if(depthsRun?!canVisitDepthsRoom(depthsRun,next):depthsIndex>=0)return;
  cancelFishing();selectedTimber=null;resetCombatArt();
  if(next!==currentRoom&&huntEnemyForRoom(next))combatMessage='';
  catchReveal=null;$('catchReveal').hidden=true;
  const focusRoom=!!document.activeElement.closest('[data-room-link]');
  if(next==='market'&&tradingGuideActive()){if(quest.claimed)tradingPostGuideComplete=true;tradeGuideRouteCache=null;}
  currentRoom=next;selectedWildAnimal=null;wildlifeAffection=null;wildlifeFeedback=null;wildlifeTrialEffect=null;familiarFollowers.clear();familiarReaction=null;$('gameShell').dataset.expedition=watchRooms.includes(next)?next:'';
  depthsExploring=false;
  const exploring=moonwood.has(next);
  const nextView=next===wildlifeRoom?wildlifeView:exploring?moonwood.view:next==='hub'?hubView:next==='outside'?courtyardView:standardView;
  if(view!==nextView){
    view=nextView;
    canvas.width=view.width;
    canvas.height=view.height;
    setZoom(1);
  }
  if($('merchantDialog').open)$('merchantDialog').close();
  window.towerFurnitureShop?.close();
  const {number,name,description,badge,floor}=roomDetails[next];
  $('roomLayout').classList.toggle('entry',atHome());
  $('roomLayout').classList.toggle('hub',next==='hub');
  $('roomLayout').classList.toggle('outside',next==='outside');
  $('roomLayout').classList.toggle('moonwood',exploring);
  $('roomLayout').dataset.depths=depthsIndex>=0?next:'';
  $('roomLayout').dataset.wildlife=String(next===wildlifeRoom);
  $('roomNumber').textContent=number;
  $('roomName').textContent=name;
  $('roomDescription').textContent=description;
  $('roomBadge').textContent=badge;
  $('roomFloor').textContent=floor;
  $('roomLabel').textContent=name.toUpperCase();
  $('sceneNumber').textContent=number;
  $('footerRoom').textContent='ROOM '+number;
  $('gridSize').textContent=view.cols+' × '+view.rows;
  $('exitRoom').hidden=!atHome();
  $('returnLobby').hidden=!['tailor','lounge','outside','store','market','armory'].includes(next);
  $('enterMoonwood').hidden=next!=='outside';
  $('fishingSound').hidden=!isFishingRoom(next);
  $('railDecorate').hidden=$('edit').hidden=!canDecorate();
  $('bubble').hidden=true;
  updateRoomLabel();
  document.title='Tower of Beginnings • '+name;
  // Older saves can be standing beyond the new flooded channel.
  if(next==='depthsGate'&&arrival?.x>=8&&!depthsRun.finds?.includes('sluiceLever'))arrival={x:7,y:4};
  movePlayerToSpawn(arrival);
  if(depthsIndex>=0)setZoom(1.35);
  if(exploring&&depthsIndex<0&&!adventure.discovered.includes(next)){
    adventure.discovered.push(next);
    showTransaction('New place discovered',[{icon:'✦',text:name+' · Map fog cleared'}]);
    savePlayerState();
  }
  switchMode(false);
  savePlayerState();
  if(exploring)revealByLantern();
  bounds=null;worldLabelKey='';$('worldLabels').replaceChildren();
  connectRoom();
  if(!automatic){
    showFirstEquipment(next);
    if(['store','armory'].includes(next))openMerchant();
  }
  if(atHome()&&pendingFurniturePlacement){const type=pendingFurniturePlacement;pendingFurniturePlacement=null;trackedDestination=null;if(availableFurniture(type)>0){switchMode(true);choose({type,id:null,rot:0});note('You’re home. Click a clear floor tile to place your '+types[type]+'.');}}
  if(focusRoom&&!$('inventoryDialog').open)canvas.focus();
}
function movePlayerToSpawn(arrival){
  const openTiles=[];
  const doors=roomDoors[currentRoom];
  for(let y=0;y<view.rows;y++)for(let x=0;x<view.cols;x++){
    if(!blocked(x,y)&&!doors.some(({tile})=>tile.x===x&&tile.y===y))openTiles.push({x,y});
  }
  const spawn=arrival??(currentRoom==='hub'?{x:8,y:12}:currentRoom==='outside'?{x:2,y:5}:{x:5,y:7});
  const distance=tile=>Math.abs(tile.x-spawn.x)+Math.abs(tile.y-spawn.y);
  openTiles.sort((a,b)=>distance(a)-distance(b));
  const {x,y}=openTiles.find(tile=>!atHome()||findPath(tile,homeExit.tile)!==null)??spawn;
  Object.assign(player,{x,y,cx:x,cy:y,direction:'right',back:false,stride:0});
}
$('fishingSound').textContent=fishingSound?'Sound on':'Sound off';
$('fishingSound').setAttribute('aria-pressed',String(fishingSound));
$('fishingSound').onclick=()=>{
  fishingSound=!fishingSound;
  save('fishing-sound',fishingSound);
  fishingMoments.enable(fishingSound);
  $('fishingSound').textContent=fishingSound?'Sound on':'Sound off';
  $('fishingSound').setAttribute('aria-pressed',String(fishingSound));
  if(fishingSound)fishingMoments.sound('catch');
};
movePlayerToSpawn();updateName();switchMode(false);
if(savedPlayerState?.location&&roomDetails[savedPlayerState.location])enterRoom(savedPlayerState.location,savedPlayerState.position);
if(hunting.encounter&&!savedPlayerState?.plan?.activeHunt){
  if(currentRoom===huntEnemy(hunting.encounter).room&&combatGear.equippedWeapon){
    if(!window.playerCloud?.gameplay)hunting.encounter=resumeHunt(hunting.encounter,Date.now(),playerStats,combatGear.moonwellCharmEquipped);
    setPlayerCombat(true);combatMessage='Combat resumes! Both fighters attack automatically. Flee if you need to escape.';
  }else hunting.encounter=null;
}
if(savedPlayerState?.timberCut){
  const cut=savedPlayerState.timberCut;
  const tree=moonwood.layouts[currentRoom]?.scenery.find(item=>timberKey(item)===cut.key);
  if(tree)restoreServerTimber(cut,window.playerCloud?.serverTime??Date.now(),tree);
}
if(currentRoom==='millbrook'&&hunting.recoveryUntil){player.seat=roomFurniture().find(item=>item.type==='riverBench');player.direction='right';player.back=false;}
if(hunting.recoveryUntil&&!['hub','home','millbrook'].includes(currentRoom))enterRoom('hub');
updateCombatPanel();
window.towerPauseForAccount=()=>{
  if(player.inCombat)throw new Error('Finish combat before changing accounts.');
  cancelFishing();route=[];step=null;interaction=null;target=null;player.x=player.cx;player.y=player.cy;
};
window.towerSaveNow=savePlayerState;
window.towerJoinRoom=connectRoom;
window.towerHasActiveCast=()=>!!fishingSession||!!woodSession;
// Presentation only: server plans own all work, catches, rewards and combat decisions.
function autoTaskFor(plan){return plan?(plan.kind==='queue'?plan.queue?.steps?.[plan.stepIndex]?.type:plan.kind??'fishing'):null;}
function autoActivityKey(state){const p=state?.plan;return [state?.location,p?.routineId??p?.startedAt??'',p?.stepIndex??'',p?.cycle??'',autoTaskFor(p)].join(':');}
function autoActivityAnimation(time){
  const state=window.playerCloud?.initial,plan=state?.plan,task=autoTaskFor(plan);
  if(!plan||autoJourney||step||route.length||currentRoom!==state.location){autoWorkAnimation=null;return null;}
  const key=autoActivityKey(state);
  if(autoWorkAnimation?.key!==key){
    autoWorkAnimation={key,task,started:time,automatic:true,catches:{...plan.catches},cast:null};
    if(task==='woodcutting')autoWorkAnimation.tree=autoWorkTile(state)?.item;
  }
  const work=autoWorkAnimation;
  if(task==='fishing'&&isFishingRoom(currentRoom)){
    const catches=plan.catches??{},caught=Object.keys(catches).find(id=>(catches[id]??0)>(work.catches[id]??0));
    work.catches={...catches};
    // A landed fish is shown only after a new server-confirmed catch, never on reconnect.
    if(caught){work.cast={started:work.cast?.started??time,castEnds:time,biteAt:time,landAt:time+650,fishId:caught};work.recastAt=time+1550;}
    else if(!work.cast||work.recastAt&&time>=work.recastAt){
      const remaining=Math.max(900,(plan.nextCatchAt??plan.nextAt??0)-(window.playerCloud?.serverTime??Date.now()));
      work.cast={started:time,castEnds:time+450,biteAt:time+remaining-650,landAt:Infinity,fishId:null};work.recastAt=null;
    }
  }
  return work;
}
function autoRoomRoute(from,to){
  const seen=new Set([from]),queue=[{room:from,path:[]}];if(from===to)return [];
  for(const entry of queue)for(const door of roomDoors[entry.room]??[]){if(seen.has(door.to)||!doorAvailable(door,entry.room))continue;const path=[...entry.path,door];if(door.to===to)return path;seen.add(door.to);queue.push({room:door.to,path});}
  return null;
}
function autoWorkTile(state){
  const task=state.plan?.kind==='queue'?state.plan.queue?.steps?.[state.plan.stepIndex]?.type:state.plan?.kind;
  const interactionType=task==='buyBait'?'tackleCounter':task?.startsWith('sell')?'tradeCounter':task?.startsWith('cook')?'stove':null;
  const item=interactionType?roomFurniture().find(i=>i.type===interactionType):task==='woodcutting'?roomFurniture().filter(i=>isTimberTree(i)&&!treeState(i).regrowsAt).sort((a,b)=>Math.abs(a.x-player.cx)+Math.abs(a.y-player.cy)-Math.abs(b.x-player.cx)-Math.abs(b.y-player.cy))[0]:null;
  const goal=state.position??{x:5,y:7},exits=new Set((roomDoors[currentRoom]??[]).map(d=>tileKey(d.tile.x,d.tile.y)));
  const candidates=[];
  for(let y=0;y<view.rows;y++)for(let x=0;x<view.cols;x++){
    if(blocked(x,y)||exits.has(tileKey(x,y)))continue;
    if(task==='fishing'&&[...remotePeers.values()].some(peer=>peer.x===x&&peer.y===y))continue;
    if(task==='fishing'&&!besideFishingStation(currentRoom,{x,y}))continue;
    if(item&&!directions.some(([dx,dy])=>overlap(item,{x:x+dx,y:y+dy})))continue;
    candidates.push({x,y,distance:Math.abs(x-goal.x)+Math.abs(y-goal.y),walk:Math.abs(x-player.cx)+Math.abs(y-player.cy)});
  }
  candidates.sort((a,b)=>item?a.walk-b.walk:a.distance-b.distance||a.walk-b.walk);
  for(const tile of candidates){const path=walkingPath(startPosition(),tile);if(path)return {...tile,path,item};}return null;
}
function renderAutoJourneyHud(){
  if(!autoJourney)return;
  const state=window.playerCloud?.initial,active=state?.plan?.source==='rules';
  $('autoPanel').hidden=false;$('autoModeLabel').textContent=active?'Auto · Walking':'Returning home';
  $('autoCurrent').textContent=autoJourney.blocked?'Path blocked':'Walking to '+(roomDetails[autoJourney.room]?.name??autoJourney.room);
  $('autoWhere').textContent=roomDetails[currentRoom].name+' · Following the room paths';
  $('autoDecision').textContent=autoJourney.blocked?'There is no clear route. Clear the doorway or adjust your home layout.':'Your adventurer is walking through the doors to the next activity.';
  if(!state?.plan&&!state?.report){$('autoTakeControl').disabled=true;$('autoTakeControl').textContent='Walking home…';}
}
function finishAutoJourney(){
  const state=autoJourneyState;autoArrivalKey=autoActivityKey(state);autoJourney=null;route=[];target=null;interaction=null;player.seat=null;
  if(isFishingRoom(currentRoom)&&autoTaskFor(state?.plan)==='fishing'){player.direction='right';player.back=false;}
  setPlayerCombat(!!state?.plan?.activeHunt&&!!hunting.encounter&&currentRoom===state.location);
  updateInventory();updateAdventurePanel();updateCombatPanel();window.towerRefreshAutoStatus?.();if(state?.plan?.source==='rules')connectRoom();
  if(!state?.plan&&!state?.report){$('autoPanel').hidden=true;savePlayerState();connectRoom();}
}
function advanceAutoJourney(){
  if(!autoJourney||step||route.length)return;
  const state=autoJourneyState;
  if(currentRoom!==autoJourney.room){
    const path=autoRoomRoute(currentRoom,autoJourney.room),door=path?.[0];
    if(!door){autoJourney.blocked=true;return;}
    const tiles=walkingPath(startPosition(),door.tile);if(!tiles){autoJourney.blocked=true;return;}
    if(!tiles.length){const reverse=roomDoors[door.to]?.find(d=>d.to===currentRoom);autoJourneyTransition=true;enterRoom(door.to,door.arrival??reverse?.inside??reverse?.tile,{automatic:true});autoJourneyTransition=false;return;}
    route=tiles;target=door.tile;autoJourney.blocked=false;return;
  }
  const destination=autoWorkTile(state);if(!destination){autoJourney.blocked=true;return;}
  if(!destination.path.length){if(destination.item){const [w,d]=dimensions(destination.item),dx=destination.item.x+w/2-player.cx,dy=destination.item.y+d/2-player.cy;player.direction=dx-dy>=0?'right':'left';player.back=dx+dy<0;}finishAutoJourney();return;}
  route=destination.path;target={x:destination.x,y:destination.y};autoJourney.blocked=false;
}
window.towerAutoTravelStatus=()=>autoJourney?{destination:roomDetails[autoJourney.room]?.name??autoJourney.room,room:roomDetails[currentRoom]?.name??currentRoom,blocked:!!autoJourney.blocked}:null;
const autoFeedbackTracker=typeof createAutoFeedbackTracker==='function'?createAutoFeedbackTracker(savedPlayerState):null;
let autoTableState=null,autoTableServerAt=0,autoTableLocalAt=0,autoTableKey='',autoFishingKey='';
function renderAutoTable(time){
 const fishing=typeof autoFishingProgress==='function'?autoFishingProgress(autoTableState,autoTableServerAt+Math.max(0,time-autoTableLocalAt)):null;
 $('autoWorkProgress').hidden=!fishing;
 const fishingKey=fishing?[fishing.label,fishing.seconds,fishing.detail,fishing.intervalSeconds].join(':'):'';
 if(!fishing)autoFishingKey='';
 if(fishing&&fishingKey!==autoFishingKey){
  autoFishingKey=fishingKey;
  $('autoWorkLabel').textContent=fishing.label;$('autoWorkCountdown').textContent=fishing.seconds>0?fishing.seconds+'s':'';
  $('autoCastProgress').value=fishing.progress;$('autoCastProgress').setAttribute('aria-valuetext',fishing.seconds>0?fishing.seconds+' seconds until the next catch':fishing.label);
  $('autoCatchCount').textContent=fishing.detail;$('autoCastSpeed').textContent='Auto catch · About '+fishing.intervalSeconds+' seconds per fish';
  $('autoWorkProgress').dataset.waiting=String(fishing.waiting);
 }
 if(typeof autoTableView!=='function')return;
 const view=autoTableView(autoTableState,autoTableServerAt+Math.max(0,time-autoTableLocalAt));
 const board=$('autoTable');board.hidden=!view;
 if(!view)return;
 const key=[view.phase,view.remaining,view.rounds,view.game,view.outcome].join(':');if(key===autoTableKey)return;autoTableKey=key;
 board.dataset.game=view.game;board.dataset.phase=view.phase;board.dataset.outcome=view.outcome;
 $('autoTableTitle').textContent=view.title;$('autoTableDetail').textContent=view.detail;$('autoTableAmount').textContent=view.amount;$('autoTableNumber').textContent=view.phase==='result'?view.number:'✦';
 const hands=$('autoTableHands');hands.replaceChildren();
 if(view.game==='blackjack')for(const [label,cards] of [['You',view.cards?.player],['Dealer',view.cards?.dealer]]){
  const row=document.createElement('div'),name=document.createElement('small');name.textContent=label;row.append(name);
  for(const card of cards??[null,null]){const tile=document.createElement('span');tile.className='auto-playing-card';tile.textContent=card?(card.rank===1?'A':card.rank===11?'J':card.rank===12?'Q':card.rank===13?'K':card.rank)+(typeof card.suit==='string'?card.suit:['♠','♥','♦','♣'][card.suit]??''):'◆';row.append(tile);}hands.append(row);
 }
}
window.towerApplyRoutineState=state=>{
  trainingController?.close();
  fishingSession=null;fishingStarted=null;woodSession=null;treeFall=null;catchReveal=null;patienceTween=null;
  $('catchReveal').hidden=true;interaction=null;player.seat=null;autoJourneyState=state;
  const serverNow=window.playerCloud?.serverTime??Date.now();
  const feedback=autoFeedbackTracker?.update(state,{now:serverNow,visible:!document.hidden})??[];
  applyServerGameplay(state);
  autoTableState=state;autoTableServerAt=serverNow;autoTableLocalAt=performance.now();autoTableKey='';renderAutoTable(autoTableLocalAt);
  for(const event of feedback)showTransaction(event.title,[{icon:event.outcome==='win'?'✦':event.outcome==='lose'?'♠':'↻',text:event.detail},...(event.banked?[{icon:'◈',text:event.banked+' gold saved to your safe'}]:[])],event.gold,{auto:true,outcome:event.outcome,walletDelta:event.walletDelta});
  const alreadyThere=currentRoom===state.location&&!step&&!route.length&&(autoArrivalKey===autoActivityKey(state)||Math.abs(player.cx-(state.position?.x??player.cx))+Math.abs(player.cy-(state.position?.y??player.cy))===0);
  if(!alreadyThere||autoJourney){if(!autoJourney||autoJourney.room!==state.location){route=[];target=null;}autoJourney={room:state.location,blocked:false};setPlayerCombat(false);}
  else {autoArrivalKey=autoActivityKey(state);setPlayerCombat(!!state.plan?.activeHunt&&!!hunting.encounter);}
  if(state.combatReceipt&&state.combatReceipt.id!==lastCombatReceipt){lastCombatReceipt=state.combatReceipt.id;if(!autoJourney)for(const event of state.combatReceipt.events??[])if((window.playerCloud?.serverTime??Date.now())-(event.at??0)<2500)recordCombatFx(combatArt,event,performance.now());}
  updateInventory();updateAdventurePanel();updateCombatPanel();if(!autoJourney)connectRoom();
};

function openTrainingCourtyard(){
  if(currentRoom!=='outside'){navigateHud('outside');return;}
  if(unavailable()||window.playerCloud?.initial?.plan||window.playerCloud?.initial?.report){note('Finish your current activity before practising.');return;}
  trainingController?.open();
}
if(typeof initializeTrainingCourtyard==='function')trainingController=initializeTrainingCourtyard({getState:()=>({...currentGoalState(),avatar,stats:playerStats,combatGear}),canOpen:()=>currentRoom==='outside'&&!unavailable()&&!window.playerCloud?.initial?.plan&&!window.playerCloud?.initial?.report,pause:()=>{cancelFishing();window.towerPauseForAccount();},onClose:()=>canvas.focus(),renderer:window.towerCharacterArt});
if(window.playerCloud)window.playerCloud.attach();
function correctRoomPosition(position){
  const goal=target??route.at(-1)??step?.to,item=interaction;
  route=[];step=null;interaction=null;target=null;
  player.x=player.cx=position.x;player.y=player.cy=position.y;player.seat=null;savePlayerState();
  // Joining a new room may correct movement begun while its socket connected.
  if(item)use(item);else if(goal&&(goal.x!==position.x||goal.y!==position.y))walkTo(goal);
}
if(window.playerCloud&&typeof WebSocket!=='undefined'){
  multiplayer=createRoomConnection({
    getLocal:()=>({room:currentRoom,x:player.cx,y:player.cy,direction:player.direction,back:player.back,seat:player.seat?{type:player.seat.type,x:player.seat.x,y:player.seat.y,rot:player.seat.rot}:null,profileKey:JSON.stringify([avatar,combatGear.equippedWeapon,armourSelection(combatGear),homeFurniture,familiarState.equipped,familiarState.names[familiarState.equipped]])}),
    flush:()=>window.playerCloud.flush(),checkRoom:async room=>{
      const response=await fetch('/api/world/connect?check=1&room='+encodeURIComponent(room),{credentials:'same-origin',cache:'no-store'});
      if(!response.ok){const data=await response.json().catch(()=>({})),error=new Error(data.error??'Room unavailable');error.status=response.status;throw error;}
    },onPeers:receivePeers,onTrails:receiveMoonTrails,onTrailNotice:message=>{$('mapTrailStatus').textContent=message;},onActivity:receiveWorldActivity,onChat:receiveRoomChat,
    onHistory:history=>{$('messages').replaceChildren();$('roomChatMessages').replaceChildren();for(const message of history)receiveRoomChat(message);},
    onStatus:text=>{$('networkStatus').textContent=text;$('roomChatStatus').textContent=text;$('openRoomChat').disabled=!Object.hasOwn(socialRooms,currentRoom);},
    onCorrection:correctRoomPosition,
    onUnseat:()=>{if(player.seat?.type==='riverBench'&&hunting.recoveryUntil)standFromRiverBench();else player.seat=null;},onSessionChanged:message=>window.playerCloud.invalidate?.(message)
  });
  window.towerMultiplayer=multiplayer;connectRoom();
}else $('networkStatus').textContent='Local preview';
if(window.playerCloud?.initial?.fishingCast&&isFishingRoom(currentRoom)){
  restoreServerCast(window.playerCloud.initial.fishingCast,window.playerCloud.serverTime);
}
requestAnimationFrame(animation);

$('vaultVictoryContinue').onclick=()=>closeVaultVictory();
$('vaultVictoryDialog').addEventListener('cancel',event=>{event.preventDefault();closeVaultVictory();});

window.towerOpenAutoRules=options=>openCharacterRules(options);

window.towerApplyBankState=state=>{applyServerGameplay(state);updateInventory();window.towerRefreshBank?.();};
window.towerFurnitureFeedback=(name,quantity,cost)=>showTransaction('Furniture purchased',[{icon:'✦',text:'+'+quantity+' '+name+' · In inventory'}],-cost);
window.towerFurniturePreview=(type,rot=0)=>{
  const image=document.createElement('canvas');image.width=360;image.height=260;image.setAttribute('aria-hidden','true');
  const previous=ctx,previousView=view;ctx=image.getContext('2d');view=standardView;
  try{const item={type,x:0,y:0,rot},[w,d]=dimensions(item),[cx,cy]=point(w/2,d/2);ctx.imageSmoothingEnabled=false;ctx.translate(180,176);ctx.scale(3,3);ctx.translate(-cx,-cy);surface(-.3,-.3,w+.6,d+.6,-.2,'#26354b','#bba168');object(item);}
  finally{ctx=previous;view=previousView;}return image;
};
window.towerFurnitureThumbnail=type=>{
  const image=document.createElement('canvas');image.width=108;image.height=88;image.setAttribute('aria-hidden','true');
  const previous=ctx,previousView=view;ctx=image.getContext('2d');view=standardView;
  try{const item={type,x:0,y:0,rot:0},[w,d]=dimensions(item),[cx,cy]=point(w/2,d/2);ctx.translate(54,67);ctx.scale(1.3,1.3);ctx.translate(-cx,-cy);object(item);}
  finally{ctx=previous;view=previousView;}return image;
};
window.towerFurnitureState=()=>({location:currentRoom,credits,ownedFurniture,homeFurniture,blocked:unavailable()||routineControlled()});
window.towerFurnitureVisit=id=>{
  window.towerFurnitureShop?.close();if(id)pendingFurnitureShopItem=id;
  if(unavailable()||routineControlled()){note('Take control and finish your activity before visiting the furniture shop.');return;}
  if(currentRoom==='furnishings'){use(furnishingsFurniture.find(item=>item.type==='reception'));return;}
  if(!lobbyRoutesOpen()){note('Meet the Tower Warden in the lobby to open the shop doors.');navigateHud('hub');return;}
  setExplorationDestination('furnishings');const next=hudNextDoor('furnishings');if(next){note('Follow the golden trail to Tower Furnishings.');followHudDoor(next);}
};
window.towerFurniturePlace=type=>{
  window.towerFurnitureShop?.close();
  if(!atHome()){pendingFurniturePlacement=type;note('Follow the home route to place your '+types[type]+'.');setExplorationDestination('home');const next=hudNextDoor('home');if(next)followHudDoor(next);return;}
  if(availableFurniture(type)<1)return;
  switchMode(true);choose({type,id:null,rot:0});canvas.focus();
};
window.towerSafeNearby=()=>atHome()&&ownedFurniture.safe>0&&homeFurniture.some(item=>item.type==='safe'&&Math.abs(player.cx-item.x)+Math.abs(player.cy-item.y)===1);
window.towerVisitSafe=()=>{
  if(!atHome()){note('Your safe is at home. Use Home, then click your safe.');return;}
  if(!ownedFurniture.safe){window.towerShowSafeShop?.();return;}
  const safe=homeFurniture.find(item=>item.type==='safe');
  if(!safe){openInventory();bagCategory='furniture';bagSelection='furniture:safe';renderBag();note('Place your Home safe from Furniture, then click it to open storage.');return;}
  use(safe);
};
window.towerBankFeedback=message=>showTransaction('Home safe',[{icon:'◈',text:message}]);
