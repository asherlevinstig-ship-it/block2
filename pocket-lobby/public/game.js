'use strict';
const $ = id => document.getElementById(id);
const canvas = $('game');
let ctx = canvas.getContext('2d');
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
const types = {woodStool:'Wooden Stool',woodTable:'Small Table',bookcase:'Bookshelf',bed:'Single bed', moonbloom:'Moonbloom', sofa:'Velvet sofa', stool:'Bar stool', plant:'Potted palm', table:'Coffee table', lamp:'Floor lamp', chair:'Club chair'};
const outfits = ['#edaa66','#6da9be','#e58aa0','#91ba85','#af93d9'];
const jacketShadows = ['#a85e49','#3d667e','#a34e73','#527c61','#7655a2'];
const hairColors = ['#533343','#2b2a3d','#9c4f3d','#e6ae65','#786293'];
const hairLights = ['#9c604c','#55516d','#d58259','#ffe09a','#ae91b9'];
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
  ['table',3,7,1],['chair',4,8,0],['lamp',1,6],['plant',7,8],['plant',.3,4.9]
].map(([type,x,y,rot=0],id)=>({id,type,x,y,rot}));
const gamingTables=[
  {id:'blackjack',type:'blackjack',x:6,y:3,rot:0},
  {id:'roulette',type:'roulette',x:3,y:7,rot:1}
];
const isGamingTable=item=>item.type==='blackjack'||item.type==='roulette';
const initial=[...classicLounge.filter(item=>item.type!=='table'),...gamingTables];
const fixed = item => item.type==='bar'||item.type==='shelf'||isGamingTable(item);
const savedPlayerState = window.towerInitialState??load('player-state',null);
const hasGamingLayout=savedPlayerState?.loungeLayout==='gaming';
const savedLounge=savedPlayerState?.furniture??load('room',null);
const retiredTables=hasGamingLayout?[]:(savedLounge??[]).filter(item=>item.type==='table'&&
  classicLounge.some(old=>old.type==='table'&&old.id===item.id&&old.x===item.x&&old.y===item.y&&old.rot===item.rot));
let loungeFurniture=initial;
if(savedLounge)loungeFurniture=hasGamingLayout?savedLounge:installGamingTables(savedLounge.filter(item=>!retiredTables.includes(item)));
let homeFurniture = savedPlayerState?.homeFurniture??[];
let credits = savedPlayerState?.credits??100;
let displayedCredits=credits,walletTween=null;
const countFurniture = (items,type)=>items.filter(item=>item.type===type).length;
const previousStock = savedPlayerState?.ownedFurniture??{};
const hasBedStarter = Object.hasOwn(previousStock,'bed');
const ownedFurniture=Object.fromEntries(Object.keys(types).map(type=>{
  const placed=countFurniture(homeFurniture,type),oldLounge=savedLounge?countFurniture(savedLounge,type):0;
  return [type,Math.max(previousStock[type]??(type==='bed'?1:0),placed+oldLounge)];
}));
const availableFurniture=type=>(ownedFurniture[type]??0)-countFurniture(homeFurniture,type);
const adventure={lantern:false,groveTrail:false,bridge:false,shrine:false,shortcut:false,discovered:[],silverfin:0,...savedPlayerState?.adventure};
const playerStats={strengthXp:0,agilityXp:0,vitalityXp:0,patienceXp:adventure.silverfin*10,...savedPlayerState?.stats};
const PATIENCE_XP_PER_CATCH=10, PATIENCE_XP_PER_LEVEL=50;
const patienceLevel=()=>1+Math.floor(playerStats.patienceXp/PATIENCE_XP_PER_LEVEL);
const maxHealth=()=>100;
let health=Math.min(maxHealth(),Math.max(0,savedPlayerState?.health??maxHealth()));
const fishingGear=normalizeFishingGear(savedPlayerState?.fishingGear);
const fishStock={...savedPlayerState?.fishStock};
if(!savedPlayerState?.fishStock&&adventure.silverfin>0)fishStock.silverfin=adventure.silverfin;
delete adventure.silverfin;
const caughtFishCount=()=>Object.values(fishStock).reduce((total,count)=>total+count,0);
const caughtFishValue=()=>Object.entries(fishStock).reduce((total,[id,count])=>total+count*(fishProducts[id]?.price??0),0);
const huntingLoot={rabbit:0,boar:0,deer:0,...savedPlayerState?.huntingLoot};
const history=normalizeHistory({...savedPlayerState,stats:playerStats,fishStock,huntingLoot});
const tradeCatalog={
  ...fishProducts,
  rabbit:{name:'Rabbit',price:12,icon:'♧',group:'hunting'},
  boar:{name:'Boar Meat',price:30,icon:'♧',group:'hunting'},
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
  const level=woodcuttingLevel(woodcutting),busy=!!woodSession;
  const logging=currentRoom==='logging',item=focusedTimber();
  const regrowing=!!item&&!!treeState(item).regrowsAt;
  $('woodPanel').hidden=!moonwood.has(currentRoom)||(!logging&&!woodcutting.axeOwned);
  $('openWorkbench').hidden=!logging;
  $('woodOfflineControls').hidden=!logging;
  $('woodAction').hidden=!logging&&(!woodcutting.equipped?false:!item);
  $('woodInventory').hidden=!woodcutting.axeOwned;
  $('woodInventoryText').textContent='Timber ×'+woodcutting.timber+' · Sell for '+woodRules.price+' gold each at the Trading Post';
  $('woodAxeStatus').textContent=(woodcutting.equipped?'Equipped':'In inventory')+' · Woodcutting '+level+' · '+woodcutting.xp%50+' / 50 XP';
  $('equipAxe').textContent=woodcutting.equipped?'Unequip axe':'Equip axe';$('equipAxe').disabled=busy;
  $('woodSkill').textContent='Woodcutting '+level+' · '+woodcutting.xp%50+' / 50 XP';
  $('woodTimber').textContent=woodcutting.timber+' timber in your bag · '+woodcutting.timber*woodRules.price+' gold value';
  $('woodAction').textContent=!woodcutting.axeOwned?'Meet woodcutter · Free axe':!woodcutting.equipped?'Equip basic axe':busy?'Chopping…':regrowing?'Waiting for regrowth':'Chop timber';
  $('woodAction').disabled=busy||(regrowing&&woodcutting.equipped)||health<=0||woodcutting.timber>=1000000;
  updateTreeStatus();
  $('woodChopProgress').hidden=!busy;
  $('startOfflineWoodcutting').disabled=!woodcutting.axeOwned||!woodcutting.equipped||busy||health<=0||woodcutting.timber>=1000000;
  $('attribute-wood-level').textContent=level;$('attribute-wood-progress').value=woodcutting.xp%50;$('attribute-wood-xp').textContent=woodcutting.xp%50+' / 50 XP';
}
function equipAxe(){
  if(!woodcutting.axeOwned||woodSession)return;
  woodcutting.equipped=!woodcutting.equipped;savePlayerState();
}
function cancelWoodcutting(){if(!woodSession)return;woodSession=null;updateWoodPanel();}
function beginChopping(tree=focusedTimber()){
  if(!moonwood.has(currentRoom)||!isTimberTree(tree)||woodSession||unavailable()||health<=0)return;
  if(!woodcutting.axeOwned){note('Meet the woodcutter for your free basic axe.');return;}
  if(!woodcutting.equipped){note('Equip your basic axe in Inventory or the work panel.');return;}
  if(woodcutting.timber>=1000000){note('Sell some timber before gathering more.');return;}
  if(treeState(tree).regrowsAt){note('The tree is regrowing. Try again shortly.');return;}
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
  if(!woodSession||reducedMotion.matches)return;
  const phase=((time-woodSession.started)%700)/700;
  if(phase<.55||phase>.9)return;
  const scatter=(phase-.55)/.35,side=player.direction==='right'?-1:1;
  const tree=woodSession.tree,[x,y]=point(tree.x+.5,tree.y+.5,12);
  ctx.save();ctx.globalAlpha=1-scatter;ctx.fillStyle='#e3bb83';
  for(let i=0;i<5;i++)ctx.fillRect(Math.round(x+side*(3+scatter*(12+i*3))),Math.round(y-6+scatter*scatter*12-i*2),2,1);
  ctx.restore();
}

function drawTimberTree(item,time){
  const tree=treeState(item);
  const [x,y]=point(item.x+.5,item.y+.5);
  const drawTree=()=>moonwood.drawProp(item,time,{...worldDrawing,ctx,reduced:reducedMotion.matches,progress:adventure});
  if(tree.regrowsAt){
    const fall=treeFall?.key===timberKey(item)?Math.min(1,Math.max(0,(time-treeFall.started)/timberTreeRules.fallMs)):1;
    if(fall<1&&!reducedMotion.matches){
      ctx.save();
      ctx.translate(x,y-5);
      ctx.rotate(treeFall.direction*Math.PI/2*fall*fall);
      ctx.translate(-x,-y+5);
      ctx.globalAlpha=1-Math.max(0,(fall-.7)/.3);
      drawTree();
      ctx.restore();
    }
    block(item.x+.30,item.y+.31,.40,.38,0,6,['#ddba84','#785741','#9d7252']);
    rect(x-3,y-7,6,1,'#aa7a50');
    return;
  }
  const phase=woodSession?.tree===item?((time-woodSession.started)%700)/700:0;
  const impact=phase>=.55&&phase<.72&&!reducedMotion.matches;
  ctx.save();
  if(impact)ctx.translate(player.direction==='right'?1:-1,0);
  drawTree();
  if(tree.cuts||impact){
    const width=Math.min(7,2+tree.cuts*2);
    rect(x-Math.floor(width/2),y-12,width,2,'#eac38b');
    rect(x-Math.floor(width/2),y-10,width,1,'#734d42');
  }
  ctx.restore();
}


function craftingState(){return {location:currentRoom,position:{x:player.cx,y:player.cy},woodcutting,ownedFurniture,plan:savedPlayerState?.plan};}
function updateCraftingUI(){
  $('craftTimber').textContent=woodcutting.timber+' timber';
  const ready=isAtWorkbench(craftingState())&&!unavailable()&&!woodSession;
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
function openCrafting(){
  if(!isAtWorkbench(craftingState())||unavailable())return;
  updateCraftingUI();$('craftStatus').textContent='Choose a recipe. Crafting uses timber, with no gold charge.';
  if(!$('craftDialog').open)$('craftDialog').showModal();
}
function makeFurniture(id){
  if(unavailable()||woodSession)return;
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
let draft;
let messages = [];
let multiplayer=null;
const remotePeers=new Map();
function receivePeers(peers){
  const keep=new Set();
  for(const peer of peers.slice(0,20)){
    if(!peer.id||!Number.isFinite(peer.x)||!Number.isFinite(peer.y))continue;
    keep.add(peer.id);const old=remotePeers.get(peer.id);
    if(old)Object.assign(old,peer);
    else remotePeers.set(peer.id,{...peer,rx:peer.x,ry:peer.y,lastFrame:performance.now(),label:null});
  }
  for(const [id,peer] of remotePeers)if(!keep.has(id)){peer.label?.remove();remotePeers.delete(id);}
}
function drawRemote(peer,time){
  const [x,y]=peer.seat?seatAnchor(peer.seat):point(peer.rx+.5,peer.ry+.5);
  surface(peer.rx+.2,peer.ry+.25,.6,.55,.2,'#43324452');
  const moving=Math.hypot(peer.x-peer.rx,peer.y-peer.ry)>.03,waveAge=Date.now()-(peer.waveAt??0);
  sprite(ctx,x,y,{outfit:peer.outfit,hair:peer.hair},{direction:peer.direction,back:peer.back,cycle:moving?time/STEP_MS:0,seated:!!peer.seat,wave:waveAge>=0&&waveAge<WAVE_MS?waveAge/WAVE_MS:null,sheathed:!!peer.weapon,weaponTier:peer.weapon,time});
}
function updatePeerLabels(time){
  const p=canvasBounds(),cx=view.width/2,cy=view.height/2-4;
  for(const peer of remotePeers.values()){
    if(!peer.label){peer.label=document.createElement('span');peer.label.className='player-label';$('playerLabels').append(peer.label);}
    const caption=peer.name+'|'+peer.weapon;
    if(peer.caption!==caption){peer.caption=caption;peer.label.textContent=peer.name;peer.label.title=peer.name+(peer.weapon?' · '+(weaponCatalog[peer.weapon]?.name??peer.weapon):'');peer.labelWidth=peer.label.offsetWidth||Math.min(120,peer.name.length*6+10);}
    const [x,y]=peer.seat?seatAnchor(peer.seat):point(peer.rx+.5,peer.ry+.5);
    peer.label.style.left=Math.round(p.x+((x-cx)*zoom+cx)*p.scale-(peer.labelWidth??60)/2)+'px';
    peer.label.style.top=Math.round(p.y+((y-43-cy)*zoom+cy)*p.scale)+'px';
  }
}
function connectRoom(){
  if(!multiplayer)return;
  const state=window.playerCloud?.initial;
  if(state?.plan||state?.report){multiplayer.disconnect();$('networkStatus').textContent='Away · Work plan';return;}
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
}
let route=[],step=null,interaction=null,hover=null,hoverItem=null,target=null;
const combatGear=normalizeCombatGear(savedPlayerState?.combatGear);
const hunting=normalizeHunting(savedPlayerState?.hunting);
const quest=normalizeQuest(savedPlayerState?.quest);
function nearWarden(){return currentRoom==='hub'&&Math.abs(player.cx-10)+Math.abs(player.cy-3)<=1;}
function updateQuestUI(){
  const stage=questStage(quest);
  const objectives=[
    'Speak to the Tower Warden in the Grand Lobby to begin.',
    'Catch fish at Silverfin Pond · '+quest.fish+' / 3 · Moonwood → Glass Creek → Pond',
    'Defeat a Wild Boar · '+quest.boars+' / 1 · Lantern Trail → Bramble Clearing',
    'Sell fish or Boar Meat at the Trading Post in the Tower.',
    'Your tasks are complete. Return to the Tower Warden in the Grand Lobby.',
    'First Steps complete · Warden’s Blade earned. Keep exploring Moonwood.'
  ];
  $('questTrackerTitle').textContent=stage===5?'First Steps · Complete':'First Steps';
  $('questTrackerText').textContent=objectives[stage];
  $('wardenDirectoryStatus').textContent=stage===0?'First Steps · Quest available':stage===4?'First Steps · Claim your reward':stage===5?'First Steps · Completed':'First Steps · Quest in progress';
  $('wardenMessage').textContent=[
    'Welcome, adventurer. Learn to provide for yourself, stand against Moonwood’s beasts, and trade with our people. Complete these tasks in order and I will reward you with gold and my blade.',
    'Start at Silverfin Pond. Catch three fish of any quality. Your offline fishing plan counts too.',
    'Now test your courage against a Wild Boar in Bramble Clearing. Equip your sword, and return to the Tower to rest if you are wounded.',
    'Take your spoils to the Moonwood Trading Post. Sell at least one fish or piece of Boar Meat there.',
    'You have earned your place here. Speak to me in the Grand Lobby to receive your gold and Warden’s Blade.',
    'Well done, adventurer. Your Warden’s Blade is yours to keep. May it serve you well in Moonwood.'
  ][stage];
  const rows=[['questFish','Catch 3 fish · '+quest.fish+' / 3',quest.fish===3],['questBoar','Defeat 1 Wild Boar · '+quest.boars+' / 1',quest.boars===1],['questTrade','Sell spoils at the Trading Post',quest.sold],['questReturn','Return to the Tower Warden',quest.claimed]];
  for(let i=0;i<rows.length;i++){
    const [id,text,done]=rows[i];$(id).textContent=(done?'✓ ':'')+text;
    $(id).classList.toggle('done',done);$(id).classList.toggle('current',stage===i+1);
  }
  const canSpeak=nearWarden()&&!unavailable();
  $('questAction').disabled=!canSpeak||![0,4].includes(stage);
  $('questAction').textContent=stage===0?'Accept quest':stage===4?'Claim 75 gold + Warden’s Blade':stage===5?'Reward received':'Quest in progress';
  $('questStatus').textContent=stage===5?'Reward saved to your character.':!canSpeak?'Visit the Warden in the Grand Lobby to accept or claim your quest.':stage===0?'Only progress made after accepting counts.':stage===4?'Your new blade will be equipped automatically.':objectives[stage];
}
function openQuest(){updateQuestUI();if(!$('questDialog').open)$('questDialog').showModal();}
function questAction(){
  if(!nearWarden()||unavailable())return;
  if(questStage(quest)===0){
    quest.accepted=true;savePlayerState();note('First Steps accepted. Catch 3 fish at Silverfin Pond.');return;
  }
  if(credits>100000000-firstQuestReward.gold)return;
  const reward=claimFirstQuest(quest);if(!reward)return;
  credits+=reward.gold;
  if(!combatGear.ownedWeapons.includes(reward.weapon))combatGear.ownedWeapons.push(reward.weapon);
  combatGear.equippedWeapon=reward.weapon;$('weaponSelect').value='';
  savePlayerState();
  showTransaction('First Steps complete!',[{icon:'⚔',text:'Warden’s Blade · equipped'},{icon:'✦',text:'18 base damage · Thank you, adventurer.'}],reward.gold);
  note('Quest complete! +75 gold and Warden’s Blade.');
}

let combatMessage='',combatFeedback=null,lastCombatUi=0;
const combatArt={strikeAt:-Infinity,hurtAt:-Infinity,dodgeAt:-Infinity,boarAttackAt:-Infinity,boarHitAt:-Infinity,victoryAt:-Infinity};
function resetCombatArt(){for(const key of Object.keys(combatArt))combatArt[key]=-Infinity;}

const unavailable=()=>player.inCombat||hunting.recoveryUntil>0;
function stopForCombat(){
  route=[];step=null;interaction=null;target=null;
  player.x=player.cx;player.y=player.cy;player.seat=null;player.waveStarted=null;
}
function startBoarEncounter(){
  if(currentRoom!=='clearing'||unavailable())return;
  if(combatGear.equippedWeapon&&!canUseWeapon(playerStats,combatGear.equippedWeapon)){note('Your stats do not meet this weapon’s requirements.');return;}
  if(!combatGear.equippedWeapon){note('Equip your Training Sword in Inventory before hunting.');return;}
  if(health<=0){note('Return to the Tower and rest to restore your hearts.');return;}
  if(Date.now()<hunting.respawnAt){note('The clearing is quiet. Another boar will arrive shortly.');return;}
  stopForCombat();resetCombatArt();
  player.direction=(6-player.cx)-(5-player.cy)>=0?'right':'left';player.back=11<player.cx+player.cy;
  hunting.encounter=createHunt(Date.now());
  setPlayerCombat(true);
  combatMessage='You engage the boar. Both fighters attack automatically. Dodge the charge with Space, or Flee.';
  updateCombatPanel();savePlayerState();
  note('Combat is live! Press Space just before the charge lands to dodge. F flees.');
}
function combatAction(action){
  if(!player.inCombat||currentRoom!=='clearing'||!['flee','dodge'].includes(action))return;
  const result=huntingTurn(hunting.encounter,health,playerStats,action,Date.now(),Math.random,combatGear.equippedWeapon);
  if(!result&&action==='dodge'){
    combatMessage=combatStamina(hunting.encounter,playerStats,Date.now())<boarRules.dodgeCost?'Not enough stamina. Let it recover.':'Your dodge is recovering.';
    updateCombatPanel();return;
  }
  applyCombatResult(result);
}
function applyCombatResult(result){
  if(!result)return;
  const action=result.action,artTime=performance.now();
  if(result.damage){combatArt.strikeAt=artTime;combatArt.boarHitAt=artTime;}
  if(action==='enemy')combatArt.boarAttackAt=artTime;
  if(result.taken)combatArt.hurtAt=artTime;
  if(result.dodgeStarted||(result.dodged&&!result.timedDodge))combatArt.dodgeAt=artTime;
  if(result.outcome==='victory')combatArt.victoryAt=artTime;
  hunting.encounter=result.encounter;health=result.health;
  combatFeedback={started:performance.now(),damage:result.damage,taken:result.taken,dodged:result.dodged};
  combatMessage=(result.damage?'You hit for '+result.damage+'. ':action==='flee'&&result.outcome!=='escaped'?'Your escape was blocked. ':'')+(result.dodged?'You dodge the boar’s attack.':result.taken?'The boar hits for '+result.taken+'.':'');
  if(result.dodgeStarted)combatMessage='You sidestep. Time your dodge just before the charge lands!';
  if(result.timedDodge)combatMessage='Perfect dodge! You avoided the charge.';
  if(result.taken){
    $('healthHud').classList.remove('injured');void $('healthHud').offsetWidth;$('healthHud').classList.add('injured');
  }
  if(result.outcome!=='fighting')setPlayerCombat(false);
  if(result.outcome==='victory'){
    hunting.respawnAt=Date.now()+boarRules.respawn;
    huntingLoot.boar=(huntingLoot.boar??0)+1;
    recordQuest(quest,'boar');history.boarDefeated=true;
    playerStats.strengthXp+=15;playerStats.agilityXp+=10;playerStats.vitalityXp+=15;
    combatMessage='Victory! Boar Meat added to inventory. Take it to the Trading Post.';
    showTransaction('Wild Boar defeated',[{icon:'✦',text:'Boar Meat ×1 · sell for 30 credits'},{icon:'⚔',text:'+15 Strength XP · +10 Agility XP · +15 Vitality XP'}]);
    updateInventory();
  }else if(result.outcome==='escaped'){
    combatMessage='You escape to Lantern Trail. Your remaining hearts are saved.';
    enterRoom('trail',{x:7,y:1});
  }else if(result.outcome==='defeat'){
    hunting.recoveryUntil=Date.now()+boarRules.recovery;
    combatMessage='The Tower wardens bring you home. Resting restores all five hearts.';
    enterRoom('hub');
  }
  updatePlayerStats();updateCombatPanel();savePlayerState();note(combatMessage);
}
function restAtTower(){
  if(!['hub','home'].includes(currentRoom)||unavailable()||health>=100)return;
  stopForCombat();hunting.recoveryUntil=Date.now()+boarRules.recovery;
  combatMessage='Resting at the Tower. Your hearts will be restored shortly.';
  updateCombatPanel();savePlayerState();
}
function updateCombatPanel(){
  const now=Date.now(),encounter=hunting.encounter;
  $('equipWeapon').disabled=player.inCombat||!canUseWeapon(playerStats,$('weaponSelect').value||combatGear.equippedWeapon||'trainingSword');
  $('wave').disabled=editing||!!fishingSession||!!woodSession||unavailable();
  $('combatPanel').hidden=currentRoom!=='clearing';
  $('scene').classList.toggle('in-combat',player.inCombat);
  $('restAtTower').hidden=!['hub','home'].includes(currentRoom)||health>=100&&!hunting.recoveryUntil;
  $('restAtTower').disabled=!!hunting.recoveryUntil;
  $('restAtTower').textContent=hunting.recoveryUntil?'Resting · '+Math.max(0,Math.ceil((hunting.recoveryUntil-now)/1000))+'s':'Rest · restore hearts';
  const notice=$('combatNotice');
  notice.hidden=!hunting.recoveryUntil;
  if(hunting.recoveryUntil)notice.textContent='Recovering at the Tower · '+Math.max(0,Math.ceil((hunting.recoveryUntil-now)/1000))+'s · Five hearts restored after rest';
  if(currentRoom!=='clearing')return;
  const remaining=Math.max(0,(encounter?.nextFleeAt??0)-now);
  $('boarHealth').textContent=encounter?encounter.health+' / '+boarRules.health+' HP':now<hunting.respawnAt?'Boar returns in '+Math.ceil((hunting.respawnAt-now)/1000)+'s':boarRules.health+' / '+boarRules.health+' HP';
  $('boarProgress').value=encounter?.health??(now<hunting.respawnAt?0:boarRules.health);
  $('combatAttack').textContent=encounter?'Auto-attacking':'Auto-attack';
  $('combatFlee').disabled=!encounter||remaining>0;
  const stamina=encounter?combatStamina(encounter,playerStats,now):100;
  $('combatStamina').value=stamina;$('combatStaminaValue').textContent=Math.floor(stamina)+' / 100';
  $('combatDodge').disabled=!encounter||now<(encounter.nextDodgeAt??0)||stamina<boarRules.dodgeCost;
  const timing=!!encounter&&encounter.nextBoarAt-now>0&&encounter.nextBoarAt-now<=boarRules.dodgeWindow;
  $('combatDodge').classList.toggle('dodge-ready',timing&&!$('combatDodge').disabled);
  $('combatDodge').textContent=encounter&&stamina<boarRules.dodgeCost?'Dodge · Low stamina':encounter&&now<(encounter.nextDodgeAt??0)?'Dodge · Recovering':timing?'Dodge now! · Space':'Dodge · Space';
  $('combatCooldown').textContent=encounter?'Next strike '+Math.max(0,(encounter.nextPlayerAt-now)/1000).toFixed(1)+'s · Boar '+Math.max(0,(encounter.nextBoarAt-now)/1000).toFixed(1)+'s'+(remaining?' · Flee '+(remaining/1000).toFixed(1)+'s':' · F: Flee'):'Click the boar to engage. Combat runs in real time.';
  $('combatLog').textContent=combatMessage||'The boar watches the trail. It will not attack until you approach.';
  const attributes=huntingAttributes(playerStats,combatGear.equippedWeapon);
  $('combatGuide').textContent=(weaponCatalog[combatGear.equippedWeapon]?.name??'No weapon equipped')+' · Attack '+attributes.damage+'–'+(attributes.damage+4)+' every '+(attributes.attackInterval/1000).toFixed(1)+'s · Dodge '+Math.round(attributes.dodge*100)+'% · Escape '+Math.round(attributes.escape*100)+'% · Armor '+attributes.armor;
  $('adventureLandmark').hidden=!!encounter||now<hunting.respawnAt;
  $('adventureLandmark').textContent='Approach boar';
  $('adventureLandmark').disabled=health<=0||unavailable()||!combatGear.equippedWeapon;
}
function updateCombatMoment(time){
  if(player.inCombat&&currentRoom==='clearing')applyCombatResult(advanceHunt(hunting.encounter,health,playerStats,Date.now(),Math.random,combatGear.equippedWeapon));
  if(hunting.recoveryUntil&&Date.now()>=hunting.recoveryUntil){
    hunting.recoveryUntil=0;health=100;
    combatMessage='All five hearts restored. You are ready to explore again.';
    updatePlayerStats();savePlayerState();note(combatMessage);
  }
  if(time-lastCombatUi>100){lastCombatUi=time;updateCombatPanel();}
}
function drawCombatFeedback(time){
  if(!combatFeedback||currentRoom!=='clearing')return;
  const age=time-combatFeedback.started;
  if(age>900){combatFeedback=null;return;}
  const offset=reducedMotion.matches?0:age/70;
  ctx.save();ctx.globalAlpha=1-age/1000;ctx.font='bold 9px monospace';ctx.textAlign='center';
  const [bx,by]=point(6.5,5.5,30),[px,py]=point(player.x+.5,player.y+.5,52);
  if(combatFeedback.damage){ctx.fillStyle='#ffe0a6';ctx.fillText('−'+combatFeedback.damage,bx,by-offset);}
  ctx.fillStyle=combatFeedback.dodged?'#bce5d0':'#ff9eaf';
  if(combatFeedback.taken||combatFeedback.dodged)ctx.fillText(combatFeedback.dodged?'DODGE':'−'+combatFeedback.taken,px,py-offset);
  ctx.restore();
}

let editing=false,selection=null,zoom=1,hitboxes=[],bounds=null,bubbleUntil=0,noticeUntil=0;
const hubFurniture=[
  ['reception',3,2],['warden',10,3],
  ['plant',1,1],['plant',16,1],
  ['sofa',2,10],['bench',2,12],
  ['sofa',13,8,2],['bench',13,10,2]
].map(([type,x,y,rot=0],id)=>({id,type,x,y,rot}));
const courtyardFurniture=[
  ['fountain',6,5],['streetlamp',1,3],['streetlamp',1,8],['streetlamp',11,1],
  ['streetlamp',11,10],['bench',3,8],['bench',10,3,1],['bench',9,9,2],
  ['plant',0,1],['plant',0,10],['plant',13,1],['plant',13,10]
].map(([type,x,y,rot=0],id)=>({id,type,x,y,rot}));
const storeFurniture=[
  {id:'merchant',type:'tackleCounter',x:3,y:2,rot:0},
  {id:'rods',type:'rodRack',x:7,y:1,rot:0},
  {id:'bait',type:'baitCrates',x:7,y:4,rot:0},
  {id:'fern',type:'plant',x:1,y:1,rot:0},
  {id:'stool',type:'stool',x:4,y:4,rot:0}
];
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
  {id:'forge',type:'brazier',x:1,y:1,rot:0},
  {id:'stool',type:'stool',x:4,y:4,rot:0}
];
let currentRoom='home';
const atHome=()=>currentRoom==='home';
const canDecorate=()=>atHome();
function roomFurniture(){
  if(atHome())return homeFurniture;
  if(currentRoom==='lounge')return initial;
  if(currentRoom==='store')return storeFurniture;
  if(currentRoom==='market')return marketFurniture;
  if(currentRoom==='armory')return armoryFurniture;
  if(moonwood.has(currentRoom))return moonwood.layouts[currentRoom].scenery.filter(item=>item.type!=='wildboar'||Date.now()>=hunting.respawnAt);
  return currentRoom==='hub'?hubFurniture:courtyardFurniture;
}
function setRoomFurniture(items){
  if(atHome())homeFurniture=items;
  else loungeFurniture=items;
}
const homeExit={to:'hub',side:'left',tile:{x:0,y:5},start:4.88,end:6.12,height:49,label:'EXIT'};
const hubDoors=[
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
const roomDoors={home:[homeExit],hub:hubDoors,lounge:[],store:[storeExit],market:[storeExit],armory:[{...storeExit,arrival:{x:3,y:1}}],outside:[towerEntrance,moonwoodEntrance],...moonwood.doors};
const roomDetails={
  home:{number:'00',name:'Entry Room',description:'Walk through the exit to reach the Grand Lobby.',badge:'ROOM NO. 00',floor:'Private room'},
  hub:{number:'01',name:'The Grand Lobby',description:'Visit the Warden, browse the shops, or head outside into Moonwood.',badge:'MAIN HUB',floor:'Ground floor'},
  lounge:{number:'02',name:'The Sunset Lounge',description:'Find blackjack and roulette on the gaming floor, or take a seat by the bar.',badge:'GAMING LOUNGE',floor:'Ground floor'},
  store:{number:'11',name:'Silverfin Outfitters',description:'Stock up on bait, find a better rod, and sell your catch.',badge:'FISHING STORE',floor:'Tower shops'},
  armory:{number:'14',name:'The Tower Armory',description:'Trade your earnings for a weapon that suits your fighting style.',badge:'ARMORY',floor:'Tower shops'},
  market:{number:'12',name:'Moonwood Trading Post',description:'Bring your catch and hunting spoils to the tower’s traders.',badge:'TRADING POST',floor:'Tower market'},
  outside:{number:'03',name:'The Courtyard',description:'Rest by the fountain, or follow the Moonwood steps into the forest.',badge:'OUTSIDE',floor:'Tower grounds'},
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
  const floors=empty?['#8b8191','#918696','#897f90','#94899a','#8e8394']:['#b47c68','#bd826a','#b77a64','#bb7c64','#c4866d'];
  block(0,0,10,10,-7,7,empty?['#8b8191','#494355','#3b354a']:['#ac745c','#624250','#4d394d']);
  for(let y=0;y<view.rows;y++)for(let x=0;x<view.cols;x++){
    surface(x,y,1,1,0,floors[(x*7+y*13)%5],empty?'#776c80':'#9f675d');
    if(empty)continue;
    for(let i=0;i<3;i++){
      const u=(x*7+y*13+i*11)%53/100+.11;
      surface(x+u,y+.23+i*.24,.19,.026,.02,i===0?'#ce9477':'#a56c62');
    }
  }
  if(empty){
    drawEntryWalls();
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
  wall('left',0,10,0,70,'#595970');
  wall('right',0,10,0,70,'#69677e');
  wall('left',0,10,66,71,'#85829a');
  wall('right',0,10,66,71,'#9791a6');
  wall('left',0,10,0,4,'#49475e');
  wall('right',0,10,0,4,'#58536c');
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
  wall('right',left+.07,right+.07,28,top-1,'#48445a');
  wall('right',left,right,30,top,'#ab8b75');
  wall('right',left+.12,right-.12,32,top-2,'#403948');
  wall('right',left+.3,left+.42,44,46,'#cea98b');
  wall('right',right-.42,right-.3,44,46,'#cea98b');
}
function drawGrandLobby(){
  const {cols,rows}=view;
  polygon([point(-.25,-.25,-8),point(cols+.44,-.25,-9),point(cols+.44,rows+.46,-10),point(-.25,rows+.46,-9)],'#1210208c');
  block(0,0,cols,rows,-9,9,['#b8a79c','#716574','#514959']);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    surface(x,y,1,1,0,(x+y)%2?'#b8aaa0':'#bcaea3','#a39692');
    if((x*7+y*3)%5===0)surface(x+.32,y+.46,.24,.02,.1,'#d0bfb0');
  }
  for(const edge of [.35,cols-.4])surface(edge,.35,.06,rows-.7,.2,'#91827f');
  for(const edge of [.35,rows-.4])surface(.35,edge,cols-.7,.06,.2,'#91827f');
  surface(7,4,3,10.5,.25,'#9c8d83');
  surface(7.10,4.10,2.8,10.3,.3,'#6d7775');
  surface(7.19,4.19,2.62,10.12,.35,'#68736f');
  const [cx,cy]=point(8.5,9,1);
  polygon([[cx,cy-11],[cx+14,cy],[cx,cy+11],[cx-14,cy]],'#b8aa87');
  polygon([[cx,cy-7],[cx+9,cy],[cx,cy+7],[cx-9,cy]],'#68736f');
  rect(cx-1,cy-4,2,8,'#d3c099');rect(cx-4,cy-1,8,2,'#d3c099');
  for(const side of ['left','right']){
    const length=side==='left'?rows:cols;
    wall(side,0,length,0,80,side==='left'?'#4c515e':'#606572');
    wall(side,0,length,77,81,'#a6988e');
    wall(side,0,length,0,15,side==='left'?'#373e4c':'#48505e');
    wall(side,0,length,14,16,'#a59584');
    for(const u of (side==='left'?[.35,8.05,12.1,15.5]:[.3,6,12.2,17.3])){
      wall(side,u,u+.17,1,76,'#777881');
      wall(side,u+.03,u+.08,3,74,'#a39b96');
    }
  }
  for(const [start,end] of [[6.55,8.6],[9.25,11.3]]){
    wall('right',start,end,28,66,'#a59b93');
    wall('right',start+.09,end-.09,30,64,'#536477');
    wall('right',start+.09,end-.09,30,47,'#829193');
    wall('right',start+.09,end-.09,30,36,'#b7aca0');
    wall('right',(start+end)/2-.025,(start+end)/2+.025,30,64,'#9ca9aa');
    wall('right',start,end,45,46,'#9ca9aa');
    wall('right',start-.05,end+.05,26,29,'#c3b19d');
  }
  wall('left',1,4.4,39,65,'#303d49');
  wall('left',1.08,4.32,40,64,'#a79680');
  wall('left',1.16,4.24,41,63,'#414d59');
  hubDoors.forEach(drawDoor);
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
function dimensions(item) {
  if(item.type==='bookcase'||item.type==='workbench'||item.type==='sofa'||item.type==='bed'||item.type==='bench'||isGamingTable(item))return item.rot%2?[1,2]:[2,1];
  if(item.type==='armoryCounter'||item.type==='reception'||item.type==='tackleCounter'||item.type==='tradeCounter')return [3,1];
  if(item.type==='rodRack'||item.type==='weaponRack')return [2,1];
  if(item.type==='fountain')return [2,2];
  return item.type==='bar'?[1.5,4.1]:item.type==='shelf'?[.35,3.5]:[1,1];
}
function object(item,highlight=false,time=0) {
  const {x,y,type,rot}=item;
  const [w,d]=dimensions(item);
  if(highlight)surface(x,y,w,d,1,'#f9c48968','#ffd18a');
  if(type==='woodcutter'){
    const [wx,wy]=point(x+.5,y+.5);
    sprite(ctx,wx,wy,{outfit:3,hair:2},{direction:'right',time,weapon:true,weaponTier:'basicAxe',pose:{angle:-.4}});return;
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
    }else if(type==='wildboar'){
      const pose=boarCombatPose({time,now:Date.now(),encounter:player.inCombat?hunting.encounter:null,events:combatArt,reduced:reducedMotion.matches,defeated:!!item.defeated});
      const [bx,by]=point(x+.5,y+.5),[px,py]=point(player.x+.5,player.y+.5);
      const shift=pose.charge-pose.recoil;
      ctx.save();ctx.globalAlpha*=pose.alpha;
      ctx.translate(bx+Math.sign(px-bx)*shift,by+Math.sign(py-by)*shift+pose.fall);
      ctx.scale((px<bx?-1:1)*(1+(1-pose.squash)*.25),pose.squash);ctx.translate(-bx,-by);
      moonwood.drawProp(item,time,{...worldDrawing,ctx,reduced:reducedMotion.matches,progress:adventure,combat:player.inCombat?hunting.encounter:null,pose});
      ctx.restore();
    }else moonwood.drawProp(item,time,{...worldDrawing,ctx,reduced:reducedMotion.matches,progress:adventure});
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
  }else if(type==='woodStool'){
    for(const u of [.17,.70])for(const v of [.16,.70])part(u,v,.12,.12,0,10,'wood');
    part(.09,.10,.82,.80,10,3,['#d0a36d','#7d5854','#a97d59']);
    part(.19,.16,.025,.68,13,.2,'cream');
  }else if(type==='woodTable'){
    for(const u of [.12,.76])for(const v of [.12,.75])part(u,v,.10,.10,0,15,'wood');
    part(.03,.04,.94,.92,15,3,['#cda776','#7e5c57','#a78261']);
    for(const u of [.26,.51,.76])part(u,.08,.018,.82,18,.2,['#e3bf8a','#a78261','#c19b70']);
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
    part(.08,.07,2.84,.87,23,.65,'pink');
    part(.28,.43,.46,.29,23,1,'cream');
    part(1.63,.63,.20,.19,23,3,'gold');
    part(1.68,.68,.09,.08,26,1,'cream');
    part(2.4,.27,.32,.42,23,7,'trim');
    part(2.39,.25,.34,.41,30,1,'blue');
  } else if(type==='bed'){
    for(const i of [.13,1.75])for(const j of [.12,.76])part(i,j,.12,.12,0,4,'black');
    part(.02,.02,1.95,.94,3,5,'wood');
    part(.13,.075,1.73,.83,8,4,'cream');
    part(.04,.045,.12,.9,7,16,'wood');
    part(.03,.028,.16,.94,23,1,'gold');
    part(.25,.19,.42,.6,12,3,['#ffebc9','#bc938e','#dec0a9']);
    part(.76,.08,1.12,.83,12,2,'blue');
    part(.75,.08,.16,.83,14,1,'trim');
    part(1.55,.105,.04,.78,14,.3,'trim');
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
    part(.27,.25,.46,.46,0,9,'clay');
    part(.24,.22,.52,.52,8,3,'clay');
    part(.3,.28,.4,.4,11,.3,'black');
    const [px,py]=point(x+.5,y+.5,10);
    rect(px-1,py-16,2,17,'#477658');
    for(const [a,b,n,c] of [[-10,-16,1,'#447864'],[1,-19,-1,'#598e75'],[-9,-22,1,'#619877'],[2,-25,-1,'#76aa7b'],[-4,-30,1,'#8ab284']]){
      polygon([[px,py+b+8],[px+a,py+b],[px+a+n*3,py+b-2],[px+a+n*7,py+b+1],[px,py+b+5]],c);
    }
    rect(px-2,py-14,2,8,'#9bad72');
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
function pixelHead(target,appearance,back,blink){
  const hair=hairColors[appearance.hair]??hairColors[0];
  const shine=hairLights[appearance.hair]??hairLights[0];
  const p=(x,y,w,h,color)=>{target.fillStyle=color;target.fillRect(x,y,w,h);};
  p(-6,-35,12,3,'#282337');
  p(-9,-32,17,11,'#282337');
  p(-6,-21,14,3,'#382638');
  p(-5,-34,10,2,hair);
  p(-8,-32,15,9,hair);
  p(-6,-33,8,1,shine);
  p(-7,-31,5,1,shine);
  p(-7,-29,2,2,shine);
  if(back){
    p(-7,-25,13,4,hair);
    p(-5,-21,9,2,hair);
    p(1,-20,4,1,'#d79476');
    p(6,-25,2,4,'#e8a686');
    p(-6,-22,4,1,'#ffffff25');
    return;
  }
  p(-6,-26,3,4,'#d58f78');
  p(-5,-25,2,1,'#ffcf9e');
  p(-3,-28,10,7,'#f2bb92');
  p(-3,-29,4,2,hair);
  p(1,-29,5,1,shine);
  p(-2,-23,9,3,'#e6a17f');
  p(0,-21,6,2,'#f3b38a');
  p(7,-25,2,3,'#e7a984');
  p(7,-24,2,1,'#ffd4aa');
  p(-1,-27,3,1,'#9f685f');
  p(4,-27,2,1,'#9f685f');
  p(0,-25,blink?2:1,blink?1:2,'#3c2d3d');
  p(5,-25,blink?2:1,blink?1:2,'#3c2d3d');
  p(4,-21,2,1,'#994f56');
  p(-1,-22,2,1,'#f6c3a0');
}
function sprite(target,x,y,appearance,{direction='right',back=false,cycle=0,seated=false,wave=null,fishing=false,weapon=false,sheathed=false,weaponTier=null,strike=0,pose={},time=0}={}){
  const p=(x,y,w,h,color)=>{target.fillStyle=color;target.fillRect(x,y,w,h);};
  const jacket=outfits[appearance.outfit]??outfits[0];
  const shade=jacketShadows[appearance.outfit]??jacketShadows[0];
  const outline='#282337', denim='#3b4565', denimLight='#626c88';
  const lowMotion=reducedMotion.matches;
  const swing=lowMotion?0:Math.round(Math.sin(cycle*Math.PI)*3);
  const bounce=cycle?Math.round(Math.abs(Math.sin(cycle*Math.PI))*2):0;
  const breath=Number(!cycle&&!pose.ready&&!lowMotion&&time%2300>1430);
  target.save();
  target.translate(Math.round(x),Math.round(y));
  target.scale(direction==='right'?1:-1,1);
  if(sheathed){
    const length=weaponTier==='huntingSpear'?30:weaponTier==='quickDagger'?15:22;
    p(-9,-27,3,length,outline);p(-8,-27,1,length-1,weaponTier==='huntingSpear'?'#b18967':'#a7bfc1');p(-11,-24,7,2,'#d2ad73');
  }
  if(seated){
    p(-6,-5,12,7,outline);p(-5,-4,9,5,denim);p(1,-4,5,3,denimLight);
    p(-1,0,4,5,denim);p(4,-1,4,5,outline);p(4,0,3,3,denimLight);
    p(-1,4,6,2,outline);p(4,3,6,2,outline);
    p(0,4,4,1,'#ebd5bc');p(5,3,4,1,'#f6e2c4');
  }else{
    for(const [side,base,ink] of [[-1,-5,denim],[1,1,denimLight]]){
      const offset=side*swing+(pose.ready?side*2:0),lift=Math.max(0,-side*swing);
      p(base+offset,-4-lift,6,4,outline);
      p(base+offset+1,-3-lift,5,2,'#e5c9ad');
      p(base+Math.trunc(offset/2),-11,5,8-lift,outline);
      p(base+Math.trunc(offset/2)+1,-10,3,6-lift,ink);
      p(base+offset+1,-5-lift,3,2,ink);
    }
  }
  target.translate(0,(seated?6:0)-(lowMotion?0:bounce)-breath+(pose.crouch??0)-(pose.lift??0));
  const farArm=-Math.round(swing/2), nearArm=Math.round(swing/2);
  p(-8+farArm,-19,4,9,outline);
  p(-8+farArm,-18,3,6,shade);
  p(-8+farArm,-12,3,2,'#cb846c');
  p(-6,-21,12,12,outline);
  p(-5,-20,10,9,shade);
  p(-4,-19,8,6,jacket);
  p(-5,-11,10,2,'#3d3248');
  if(back){
    p(-2,-19,5,3,shade);p(-1,-18,3,1,'#fff2d855');
    p(-3,-14,7,1,'#fff2d840');
  }else{
    p(-2,-21,5,2,'#d78f76');
    p(-3,-19,2,2,'#f8e2bf');p(2,-19,2,2,'#f8e2bf');
    p(0,-17,1,6,'#fff1d4');
    p(-3,-14,2,1,shade);p(2,-14,2,1,shade);
  }
  if(weapon){
    p(5,-19,4,5,outline);p(6,-18,3,3,jacket);
    p(7,-16,5,3,outline);p(8,-15,4,2,'#f2bb92');
    target.save();target.translate(12,-14);target.rotate(weaponTier==='huntingSpear'?1.1-(pose.lunge??0)*.035:pose.angle??(-.35+strike*1.8));
    if(weaponTier==='basicAxe'){
      p(-1,-19,2,26,'#674e49');p(0,-19,1,24,'#bb8d62');p(-5,-20,10,7,'#4b596a');p(1,-20,6,7,'#c5d8d2');p(5,-19,2,5,'#f0e8c8');
    }else if(weaponTier==='huntingSpear'){
      p(-1,-29,2,38,outline);p(0,-25,1,33,'#b18864');p(-2,-29,4,9,'#adc5c7');p(-1,-32,2,5,'#eef0d0');p(-3,-21,6,2,'#c69b69');
    }else if(weaponTier==='quickDagger'){
      p(-2,-11,4,9,outline);p(-1,-11,2,8,'#d5e4df');p(-3,-3,6,2,'#91bcc1');p(-1,-1,2,5,'#7b637c');
    }else{
      p(-2,-17,4,14,outline);p(-1,-16,2,12,weaponTier==='wardenSword'?'#a9cbbd':weaponTier==='ironSword'?'#8dabb8':'#bacbd3');p(-1,-16,1,10,weaponTier==='wardenSword'?'#eef4c9':'#eef2da');p(0,-12,1,5,'#8cabbc');
      p(-1,-19,2,3,outline);p(0,-18,1,2,'#dae5dc');
      p(-4,-4,8,2,outline);p(-3,-4,6,1,weaponTier==='wardenSword'?'#f2cf7e':'#d8b079');
      p(-1,-2,2,5,'#875b50');p(-2,2,4,2,'#d8b079');
    }
    target.restore();
  }else if(wave!==null){
    const reach=lowMotion?1:Math.round(Math.sin(wave*Math.PI*6)*2);
    p(4,-19,6,5,outline);p(5,-18,4,3,jacket);
    p(8,-23,4,7,outline);p(9,-23,2,6,jacket);
    p(8+reach,-27,5,5,outline);p(9+reach,-27,3,4,'#f2bb92');
    p(9+reach,-28,2,1,'#ffd4aa');
  }else if(fishing){
    const crank=fishing==='landing'&&!lowMotion?Math.round(Math.sin(time/70)):0;
    p(4,-19,4,4,outline);p(5,-18,3,2,jacket);
    p(6,-17+crank,5,3,outline);p(7,-17+crank,3,2,'#f2bb92');
  }else{
    p(5+nearArm,-19,4,9,outline);
    p(5+nearArm,-18,3,6,jacket);
    p(6+nearArm,-12,3,2,'#f2bb92');
  }
  const blink=!lowMotion&&time%3700>3530&&time%3700<3660;
  pixelHead(target,appearance,back,blink);
  if(pose.ready&&!back){p(2,-27,3,1,outline);p(7,-26,2,1,outline);}

  target.restore();
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
  hub:makeRoomLayer(drawGrandLobby,hubView),
  lounge:makeRoomLayer(room),
  outside:makeRoomLayer(drawCourtyard,courtyardView),
  store:makeRoomLayer(drawFishingStore),
  market:makeRoomLayer(()=>drawFishingStore(true)),
  armory:makeRoomLayer(()=>drawFishingStore('armory'))
};
for(const id of Object.keys(moonwood.areas)){
  roomLayers[id]=makeRoomLayer(()=>moonwood.drawGround(id,worldDrawing),moonwood.view);
}
function drawMoonwoodDetails(time){
  moonwood.drawWater(currentRoom,time,{...worldDrawing,ctx,reduced:reducedMotion.matches});
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
let worldLabelKey='';
function updateWorldLabels(){
  const p=canvasBounds(),doors=roomDoors[currentRoom].filter(door=>moonwood.open(door,adventure));
  const stump=currentRoom==='logging'&&!!treeState(timberTree()).regrowsAt;
  const key=[currentRoom,stump,doors.map(door=>door.to).join(','),avatar.name,questStage(quest),zoom,p.scale,p.x,p.y,canvas.clientWidth,canvas.clientHeight].join('|');
  if(key===worldLabelKey)return;
  worldLabelKey=key;
  const container=$('worldLabels');container.replaceChildren();
  const add=(text,x,y,kind='door',action=null,subtitle='')=>{
    const label=document.createElement(action?'button':'div');label.className='world-label world-label-'+kind;
    if(action){label.type='button';label.onclick=action;label.setAttribute('aria-label',kind==='door'?'Go to '+text:text);}
    const title=document.createElement('span');title.textContent=text;label.append(title);
    if(subtitle){const detail=document.createElement('small');detail.textContent=subtitle;label.append(detail);}
    label.title=text+(subtitle?' · '+subtitle:'');container.append(label);
    const centerX=view.width/2,centerY=view.height/2-4;
    const screenX=p.x+((x-centerX)*zoom+centerX)*p.scale,screenY=p.y+((y-centerY)*zoom+centerY)*p.scale;
    const width=label.offsetWidth||text.length*7+16,height=label.offsetHeight||(subtitle?30:19);
    const availableWidth=canvas.clientWidth||view.width*p.scale,availableHeight=canvas.clientHeight||view.height*p.scale;
    label.style.left=Math.round(Math.max(5,Math.min(availableWidth-width-5,screenX-width/2)))+'px';
    label.style.top=Math.round(Math.max(5,Math.min(availableHeight-height-5,screenY-height/2)))+'px';
  };
  for(const door of doors){
    let anchor;
    if(door.side==='wild'){anchor=point(door.tile.x+.5,door.tile.y+.5,18);}
    else if(door.side==='front'){anchor=point((door.start+door.end)/2,view.rows-.45,12);}
    else anchor=door.side==='right'?point((door.start+door.end)/2,0,door.height+9):point(0,(door.start+door.end)/2,door.height+9);
    add(door.label,...anchor,'door',()=>travelDoor(door));
  }
  if(currentRoom==='home')add('Your Home',...point(5,0,43),'sign',null,avatar.name);
  if(currentRoom==='hub'){
    add('Job board',...point(4.5,2,39),'npc',openJobBoard);
    add('TOWER OF',...point(0,2.7,51),'sign',null,'BEGINNINGS');
    const symbol=questStage(quest)===0?'! ':questStage(quest)===4?'? ':'';
    add(symbol+'Tower Warden',...point(10.5,3.5,43),'npc',()=>use(hubFurniture.find(item=>item.type==='warden')));
  }
  if(currentRoom==='logging'){
    add('Workbench',...point(6,3.5,26),'npc',()=>use(roomFurniture().find(item=>item.type==='workbench')));
    add('Woodcutter',...point(4.5,3.5,43),'npc',()=>use(roomFurniture().find(item=>item.type==='woodcutter')));
    if(stump)add('Regrowing',...point(6.5,5.5,13),'sign');
    else add('Timber',...point(6.5,5.5,54),'npc',()=>use(timberTree()));
  }
  if(currentRoom==='lounge')add('SUNSET LOUNGE',...point(0,2.3,51),'sign');
  if(['store','market','armory'].includes(currentRoom)){
    const names={store:['SILVERFIN','OUTFITTERS'],market:['MOONWOOD','TRADING POST'],armory:['TOWER','ARMORY']};
    add(names[currentRoom][0],...point(3.42,0,46),'sign',null,names[currentRoom][1]);
  }
}
function draw(time){
  const {width,height}=view,centerX=width/2,centerY=height/2-4;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,width,height);
  const [shakeX,shakeY]=currentRoom==='clearing'?combatShake(time,combatArt,reducedMotion.matches):[0,0];
  ctx.translate(shakeX,shakeY);ctx.translate(centerX,centerY);ctx.scale(zoom,zoom);ctx.translate(-centerX,-centerY);
  ctx.imageSmoothingEnabled=false;ctx.drawImage(roomLayers[currentRoom],0,0);
  if(moonwood.has(currentRoom))drawMoonwoodDetails(time);
  if(currentRoom==='clearing')drawCombatGroundFx({ctx,point,time,now:Date.now(),encounter:hunting.encounter,player,reduced:reducedMotion.matches});
  if(target)surface(target.x+.1,target.y+.1,.8,.8,1,'#fff3bc30','#ffcf8f');
  if(hover){
    const [w,d]=editing&&selection?dimensions(selection):[1,1];
    const valid=editing&&selection?canPlace({...selection,x:hover.x,y:hover.y}):!blocked(hover.x,hover.y);
    surface(hover.x+.035,hover.y+.035,w-.07,d-.07,1,valid?'#fff3bc34':'#eb6c7144',valid?'#ffe0a3':'#e58b87');
  }
  let ghost;
  if(editing&&selection&&hover&&canPlace({...selection,...hover})){
    ghost={...selection,...hover,id:-1};
  }
  for(const peer of remotePeers.values()){
    const amount=reducedMotion.matches?1:Math.min(1,Math.max(0,time-peer.lastFrame)/90);
    peer.rx+=(peer.x-peer.rx)*amount;peer.ry+=(peer.y-peer.ry)*amount;peer.lastFrame=time;
  }
  const items=[...roomFurniture(),...[...remotePeers.values()].map(peer=>({type:'remotePlayer',x:peer.rx,y:peer.ry,peer}))];
  if(currentRoom==='clearing'&&time-combatArt.victoryAt>=0&&time-combatArt.victoryAt<1300){
    const boar=moonwood.layouts.clearing.scenery.find(item=>item.type==='wildboar');
    items.push({...boar,id:'defeated-boar',defeated:true});
  }
  if(ghost)items.push(ghost);
  const drawPlayer = ()=>{
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
    const pose=playerCombatPose({time,now:Date.now(),encounter:player.inCombat?hunting.encounter:null,events:combatArt,reduced:reducedMotion.matches});
    const swingPhase=woodSession?((time-woodSession.started)%700)/700:0;
    const swingAngle=swingPhase<.55?-1.5+2.8*(swingPhase/.55)**3:1.3-2.8*((swingPhase-.55)/.45);
    const spritePose=woodSession?{...pose,angle:reducedMotion.matches?.75:swingAngle}:pose;
    const [enemyX,enemyY]=point(6.5,5.5);
    const thrust=currentRoom==='clearing'?pose.lunge-pose.recoil:0;
    sprite(ctx,x+Math.sign(enemyX-x)*thrust-pose.dodge,y+Math.sign(enemyY-y)*thrust+pose.dodge*.4,avatar,{direction:player.direction,back:player.back,cycle,seated:!!seat,wave,weapon:!!woodSession||pose.armed&&!!combatGear.equippedWeapon,sheathed:!woodSession&&!pose.armed&&Object.hasOwn(socialRooms,currentRoom)&&!!combatGear.equippedWeapon,weaponTier:woodSession?'basicAxe':combatGear.equippedWeapon,pose:spritePose,fishing:fishingSession?fishingMoments.phase(fishingSession,time):null,time});
    if(fishingSession)drawFishingMoment(x,y,time);
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
    ctx.globalAlpha=item===ghost?.52:ghost&&selection?.id===item.id?.4:1;

    const treeHover=isTimberTree(item)&&item===hoverItem&&!treeState(item).regrowsAt;
    object(item,treeHover||editing&&(selection?.id===item.id||hoverItem?.id===item.id)&&!fixed(item),time);
    ctx.globalAlpha=1;
    if(item.defeated||item===ghost||(fixed(item)&&!isGamingTable(item)))continue;
    const [w,d]=dimensions(item), h=moonwood.heights[item.type]??{armoryCounter:32,weaponRack:37,anvil:19,brazier:25,workbench:23,woodStool:13,woodTable:18,bookcase:37,woodcutter:43,warden:43,tradeCounter:32,harvestCrates:16,tackleCounter:32,rodRack:36,baitCrates:16,blackjack:19,roulette:22,reception:32,bed:24,sofa:24,chair:24,table:17,plant:40,stool:18,lamp:39,bench:22,streetlamp:55,fountain:37}[item.type];
    const height=isTimberTree(item)&&treeState(item).regrowsAt?6:h;
    const shape=[point(item.x,item.y+d),point(item.x+w,item.y+d),point(item.x+w,item.y),point(item.x+w,item.y,height),point(item.x,item.y,height),point(item.x,item.y+d,height)];
    hitboxes.push({item,shape});
  }
  if(!drawn)drawPlayer();
  if(currentRoom==='clearing')drawCombatWorldFx({ctx,point,time,events:combatArt,player,reduced:reducedMotion.matches});
  drawWoodEffects(time);
  drawCombatFeedback(time);
  if(currentRoom==='clearing')drawCombatOverlayFx({ctx,width,height,time,now:Date.now(),events:combatArt,encounter:hunting.encounter,health,reduced:reducedMotion.matches});
  updateWorldLabels();
  updatePeerLabels(time);
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
  return !inRoom(x,y)||moonwood.blocked(currentRoom,x,y,adventure)||items.some(item=>item.type!=='shelf'&&overlap(item,{x,y}));
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
  const door=roomDoors[currentRoom].find(portal=>moonwood.open(portal,adventure)&&hitDoor(x,y,portal));
  return {tile:door?.tile??(inRoom(gx,gy)?{x:gx,y:gy}:null),door,item:hitboxes.findLast(h=>inShape(x,y,h.shape))?.item??null};
}
function note(message){
  $('hint').textContent='✦  '+message;
  noticeUntil=performance.now()+3000;
}
function setHint(){
  const guide={home:'Click a tile to walk · Click the exit to visit the lobby',hub:'Click a doorway or the Outside steps to travel',lounge:defaultHint,outside:'Click the Moonwood steps to explore · Tower returns indoors',store:'Buy supplies at the counter · Use Lobby to leave',armory:'Compare damage, attack speed and requirements · Buy & equip from the Armory panel',market:'Sell fish and hunting loot at the counter · Use Lobby to leave'};
  const message=editing?'Choose furniture to place or select a piece in the room':guide[currentRoom]??'Follow marked trails · Use the field journal for routes';
  $('hint').textContent='✦  '+message;
}
function startPosition(){return step?.to??{x:player.cx,y:player.cy};}
function walkTo(tile){
  if(unavailable()){note(player.inCombat?"Combat is live. Use Flee to escape.":"Rest until your hearts recover.");return;}
  if(blocked(tile.x,tile.y)){note('That tile is occupied.');return;}
  const path=findPath(startPosition(),tile);
  if(!path){note('There’s no clear path to that tile.');return;}
  cancelFishing();
  player.seat=null;player.waveStarted=null;
  route=path;interaction=null;target=path.length?tile:null;
}
function travelDoor(door){
  if(unavailable()){note(player.inCombat?"Use Flee to leave combat.":"Your hearts are recovering.");return;}
  if(currentRoom==='creek'&&door.to==='ruins'&&!adventure.bridge){
    note('Light your lantern to reveal a crossing.');
    return;
  }
  if(!moonwood.open(door,adventure))return;
  if(!step&&player.cx===door.tile.x&&player.cy===door.tile.y)enterRoom(door.to,door.arrival);
  else walkTo(door.tile);
}
function use(item){
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
  return point(item.x+x,item.y+y,item.type==='woodStool'?12:item.type==='stool'?17:13);
}
function reelFish(){
  if(!fishingSession||!fishingMoments.reel(fishingSession,performance.now()))return;
  fishingMoments.sound('reel');
  note('Well timed! Reeling in · +5 bonus Patience XP.');
  updateAdventurePanel();
}
function drawFishingMoment(x,y,time){
  const session=fishingSession,phase=fishingMoments.phase(session,time);
  const still=reducedMotion.matches;
  const [waterX,waterY]=point(7.4,5.45);
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
    fishingMoments.drawFish(ctx,bx,by,session.fishId,fish.quality);
  }
  ctx.beginPath();ctx.moveTo(x+9,y-17);
  ctx.quadraticCurveTo(x+20,y-23,tipX,tipY);
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
  fishingSession=null;fishingStarted=null;
  fishingGear.bait--;
  const fishId=session.fishId,fish=fishProducts[fishId];
  fishStock[fishId]=(fishStock[fishId]??0)+1;
  recordQuest(quest,'fish');history.fishCaught=true;
  const before=playerStats.patienceXp,oldLevel=patienceLevel(),earned=PATIENCE_XP_PER_CATCH+session.bonus;
  playerStats.patienceXp+=earned;
  patienceTween={from:before,to:playerStats.patienceXp,started:time};
  recordAdventure('Caught '+fish.name+'! +'+earned+' Patience XP.');
  const levelUp=patienceLevel()>oldLevel;
  $('catchTier').textContent=fishingCatalog.qualities[fish.quality].name+' catch';
  $('catchName').textContent=fish.name;
  $('catchReward').textContent='+1 fish · +'+earned+' Patience XP'+(session.bonus?' · Well timed!':'');
  $('catchLevel').textContent='Patience increased to '+patienceLevel();
  $('catchLevel').hidden=!levelUp;
  const reveal=$('catchReveal');
  reveal.className='catch-reveal quality-'+fish.quality;reveal.hidden=false;
  const picture=$('catchPicture'),pictureContext=picture.getContext('2d');
  pictureContext.clearRect(0,0,picture.width,picture.height);
  fishingMoments.drawFish(pictureContext,30,15,fishId,fish.quality,2);
  catchReveal={until:time+4000};
  fishingMoments.sound(levelUp?'level':fish.quality==='rare'?'rare':'catch');
  showTransaction(levelUp?'Patience level '+patienceLevel()+'!':'Catch landed',[
    {text:'+1 '+fish.name,icon:'⋈'},{text:'+'+earned+' Patience XP'+(session.bonus?' · Reel bonus':''),icon:'✦'}
  ]);
}
function updateFishingMoment(time){
  if(!fishingSession)return;
  const session=fishingSession,phase=fishingMoments.phase(session,time);
  if((phase==='landing'||phase==='complete')&&!session.fishId){
    session.fishId=rollFishingCatch(castProfile.level,castProfile.rod);
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
function finishInteraction(){
  const item=interaction;interaction=null;
  if(item.type==='workbench'){
    openCrafting();
  }else if(item.type==='woodcutter'){
    if(grantBasicAxe(woodcutting)){
      savePlayerState();showTransaction('A gift from the woodcutter',[{icon:'⚒',text:'Basic Axe · Free · Equipped'}]);
      note('Your basic axe is ready. Click the marked tree or Chop timber to begin.');
    }else note('You already have your basic axe. Equip it in Inventory to gather timber.');
  }else if(isTimberTree(item)){
    beginChopping(item);
  }else if(item.type==='warden'){
    openQuest();
  }else if(item.type==='wildboar'){
    startBoarEncounter();
  }else if(item.type==='fishingPost'){
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
    adventure.shrine=true;
    recordAdventure('The moths circle your lantern. You record the shrine in your journal.');
  }else if(item.type==='moonwell'){
    if(adventure.shortcut){note('The Moonwell glows. The root passage is open.');return;}
    adventure.shortcut=true;
    ownedFurniture.moonbloom=(ownedFurniture.moonbloom??0)+1;
    recordAdventure('Moonbloom added to inventory. The root passage opens.');
  }else if(['armoryCounter','weaponRack','anvil','brazier'].includes(item.type)){
    note('Welcome to the Armory. Compare weapons and choose Buy & equip in the shop panel.');
  }else if(item.type==='tradeCounter'||item.type==='harvestCrates'||(currentRoom==='market'&&item.type==='baitCrates')){
    note('The trader offers credits for fish and hunting spoils. Choose what to sell in the market panel.');
  }else if(['tackleCounter','rodRack','baitCrates'].includes(item.type)){
    note('Welcome to Silverfin Outfitters. Choose supplies from the shop panel.');
  }else if(item.type==='reception'){
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
function animation(time){
  updateWoodMoment(time);
  updateCombatMoment(time);
  updateFishingMoment(time);
  if(patienceTween){
    const t=reducedMotion.matches?1:Math.min(1,(time-patienceTween.started)/1000);
    const absolute=patienceTween.from+(patienceTween.to-patienceTween.from)*t;
    const remainder=absolute%PATIENCE_XP_PER_LEVEL;
    $('patienceProgress').value=remainder;
    $('catchXpFill').style.width=(remainder/PATIENCE_XP_PER_LEVEL*100)+'%';
    if(t>=1)patienceTween=null;
  }
  if(walletTween){
    const progress=Math.min(1,Math.max(0,(time-walletTween.started)/650));
    displayedCredits=Math.round(walletTween.from+(credits-walletTween.from)*(1-Math.pow(1-progress,3)));
    $('credits').textContent=new Intl.NumberFormat().format(displayedCredits);
    if(progress===1)walletTween=null;
  }
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
      const door=roomDoors[currentRoom].find(portal=>portal.tile.x===to.x&&portal.tile.y===to.y&&moonwood.open(portal,adventure));
      if(door)enterRoom(door.to,door.arrival);
      else if(!route.length)savePlayerState();
    }
  }
  if(!step&&!route.length){target=null;if(interaction)finishInteraction();}
  if(player.waveStarted!==null&&time>=player.waveStarted+WAVE_MS)player.waveStarted=null;
  if(noticeUntil&&time>noticeUntil){noticeUntil=0;setHint();}
  draw(time);
  if($('avatarDialog').open)drawAvatarPreview(time);
  requestAnimationFrame(animation);
}
function updateWeaponInventory(){
  $('weaponCard').hidden=combatGear.ownedWeapons.length===0;
  if(!combatGear.ownedWeapons.length)return;
  const selector=$('weaponSelect'),previous=selector.value;
  selector.replaceChildren();
  for(const id of combatGear.ownedWeapons){
    const option=document.createElement('option');option.value=id;option.textContent=weaponCatalog[id].name;selector.append(option);
  }
  const selected=combatGear.ownedWeapons.includes(previous)?previous:combatGear.equippedWeapon??combatGear.ownedWeapons[0];
  selector.value=selected;selector.disabled=player.inCombat;
  const weapon=weaponCatalog[selected],equipped=combatGear.equippedWeapon===selected;
  $('weaponName').textContent=weapon.name;
  $('weaponPicture').innerHTML=selected==='huntingSpear'?'<path d="M11 8h2v21h-2z" fill="#bd9064"/><path d="M12 1l4 8-4 3-4-3z" fill="#c5dcd7"/>':selected==='quickDagger'?'<path d="M11 7l4 7-2 6h-3l-1-6z" fill="#d4e6de"/><path d="M7 20h10v2H7z" fill="#8dbec4"/><path d="M11 22h2v6h-2z" fill="#99779d"/>':'<path d="M10 2h4v16h-4z" fill="#bacbd3"/><path d="M10 2h2v15h-2z" fill="#eef2da"/><path d="M7 18h10v3H7z" fill="#d8b079"/><path d="M11 21h2v6h-2z" fill="#986b59"/><path d="M10 27h4v2h-4z" fill="#d8b079"/>';

  $('weaponStatus').textContent=(equipped?'Equipped':'In inventory')+' · '+weapon.damage+' base damage + Strength · '+(weapon.interval/1000).toFixed(1)+'s per attack';
  $('equipWeapon').textContent=equipped?'Unequip':'Equip weapon';
  $('equipWeapon').disabled=player.inCombat||!canUseWeapon(playerStats,selected);
  $('weaponHelp').textContent=player.inCombat?'Finish combat before changing your weapon.':weapon.description+' Drawn automatically during combat.';
}
function toggleWeapon(){
  if(player.inCombat)return;
  const selected=$('weaponSelect').value;
  if(!combatGear.ownedWeapons.includes(selected)||!canUseWeapon(playerStats,selected))return;
  combatGear.equippedWeapon=combatGear.equippedWeapon===selected?null:selected;
  updateWeaponInventory();updateCombatPanel();savePlayerState();
}
function updateInventory(){
  if($('craftDialog').open)updateCraftingUI();
  updateWoodPanel();
  $('starterSwordStatus').textContent='Owned ×1'+(combatGear.equippedWeapon==='trainingSword'?' · Equipped':'');
  $('starterRodStatus').textContent='Owned ×1'+(fishingGear.equippedRod==='reed'?' · Equipped':'');
  updateQuestUI();
  updateWeaponInventory();
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
function updatePlayerStats(){
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
  for(const [id,name] of [['strength','Strength'],['agility','Agility'],['vitality','Vitality'],['patience','Patience']]){
    const experience=playerStats[id+'Xp'],rank=1+Math.floor(experience/50),towardNext=experience%50;
    $('attribute-'+id+'-level').textContent=rank;
    $('attribute-'+id+'-xp').textContent=towardNext+' / 50 XP';
    $('attribute-'+id+'-progress').value=towardNext;
    $('attribute-'+id+'-progress').setAttribute('aria-label',name+' level '+rank+', '+towardNext+' of 50 XP toward the next level');
  }
  $('attributeName').textContent=avatar.name;
  const level=patienceLevel(),xp=playerStats.patienceXp%PATIENCE_XP_PER_LEVEL;
  $('patienceValue').textContent=level;
  $('patienceLevel').textContent='Patience '+level;
  $('patienceProgress').value=xp;
  $('patienceProgress').setAttribute('aria-label','Patience '+level+', '+xp+' of 50 XP toward the next level');
  $('patienceXp').textContent=xp+' / 50 XP to level '+(level+1);
  const odds=fishingChances(level,fishingGear.equippedRod);
  $('fishingStats').textContent='Patience '+level+' · '+xp+'/50 XP · Bait '+fishingGear.bait+' · Fish '+caughtFishCount()+'\nQuality chances · Common '+odds.common.toFixed(1)+'% · Fine '+odds.fine.toFixed(1)+'% · Rare '+odds.rare.toFixed(1)+'%';
}
function equipFishingRod(id){
  const rod=fishingCatalog.rods[id];
  if(!rod||!fishingGear.ownedRods.includes(id)||patienceLevel()<rod.patience)return;
  cancelFishing();
  fishingGear.equippedRod=id;
  savePlayerState();
  updateAdventurePanel();
}
function buyArmoryWeapon(id){
  const state={credits,combatGear,stats:playerStats,location:currentRoom,hunting};
  try{
    const result=purchaseWeapon(state,id);credits=state.credits;
    $('weaponSelect').value='';savePlayerState();
    $('armoryStatus').textContent=result.name+' equipped.';
    showTransaction(result.spent?'Weapon purchased':'Weapon equipped',[{icon:'⚔',text:result.name+' · Equipped'}],-result.spent);
  }catch(error){$('armoryStatus').textContent=error.message;}
}
function updateArmoryShop(){
  const equipped=weaponCatalog[combatGear.equippedWeapon],current=huntingAttributes(playerStats,combatGear.equippedWeapon);
  const strength=1+Math.floor(playerStats.strengthXp/50),agility=1+Math.floor(playerStats.agilityXp/50);
  $('armoryBalance').textContent=new Intl.NumberFormat().format(credits)+' G';
  $('armoryStats').textContent='Strength '+strength+' · Agility '+agility;
  $('armoryComparison').textContent=equipped?equipped.name+' · '+current.damage+'–'+(current.damage+4)+' damage · '+(current.attackInterval/1000).toFixed(1)+'s / attack':'Nothing equipped · Your free Training Sword is in Inventory';
  const offers=$('weaponOffers');offers.replaceChildren();
  for(const [id,weapon] of Object.entries(weaponCatalog).filter(([,weapon])=>weapon.price)){
    const owned=combatGear.ownedWeapons.includes(id),active=combatGear.equippedWeapon===id,skill=canUseWeapon(playerStats,id);
    const damage=huntingAttributes(playerStats,id).damage,difference=damage-current.damage,speed=(current.attackInterval-weapon.interval)/1000;
    const missing=[strength<weapon.strength?'Strength +'+(weapon.strength-strength):'',agility<weapon.agility?'Agility +'+(weapon.agility-agility):''].filter(Boolean);
    const reason=!skill?'Need '+missing.join(' and '):!owned&&credits<weapon.price?'Need '+(weapon.price-credits)+' more gold':active?'Ready for your next fight':owned?'Yours to keep · Free to equip':'Purchased gear equips automatically';
    const deltas=active?[{text:'Your equipped weapon',tone:'neutral'}]:[
      {text:(difference>0?'+':'')+difference+' damage',tone:difference>0?'up':difference<0?'down':'neutral'},
      {text:speed===0?'Same attack speed':Math.abs(speed).toFixed(1)+'s '+(speed>0?'faster':'slower'),tone:speed>0?'up':speed<0?'down':'neutral'}
    ];
    offers.append(renderShopCard({document,id,name:weapon.name,category:id==='huntingSpear'?'HEAVY':id==='quickDagger'?'QUICK':'BALANCED',price:weapon.price,owned,equipped:active,stats:[['DAMAGE',damage+'–'+(damage+4)],['PER ATTACK',(weapon.interval/1000).toFixed(1)+'s']],deltas,requirements:'STR '+weapon.strength+'  ·  AGI '+weapon.agility,reason,action:active?'Equipped':!skill?'Stats required':owned?'Equip weapon':credits<weapon.price?'Not enough gold':'Buy & equip',disabled:active||!skill||(!owned&&credits<weapon.price),onBuy:()=>buyArmoryWeapon(id)}));
  }
}
function buyFishingRod(id){
  const rod=fishingCatalog.rods[id];
  if(currentRoom!=='store'||!rod)return;
  if(fishingGear.ownedRods.includes(id)){equipFishingRod(id);return;}
  if(patienceLevel()<rod.patience||credits<rod.price){
    $('shopStatus').textContent='You need '+rod.price+' credits and Patience '+rod.patience+'.';return;
  }
  credits-=rod.price;
  fishingGear.ownedRods.push(id);
  fishingGear.equippedRod=id;
  savePlayerState();
  $('shopStatus').textContent=rod.name+' purchased and equipped.';
  showTransaction('Rod purchased',[{text:'+1 '+rod.name,icon:'♓'},{text:'Equipped and ready',icon:'✓'}],-rod.price);
}
function showTransaction(title,items,creditChange=0){
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
    delta.textContent=(gain?'+':'−')+new Intl.NumberFormat().format(Math.abs(creditChange))+' credits';
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
    burst.className='wallet-delta '+(gain?'credit-gain':'credit-spend');
    burst.textContent=(gain?'+':'−')+Math.abs(creditChange);
    burst.setAttribute('aria-hidden','true');
    $('creditWallet').append(burst);
    setTimeout(()=>burst.remove(),1400);
  }
  const notices=$('transactions');
  while(notices.children.length>=4)notices.children[0].remove();
  notices.append(card);
  setTimeout(()=>card.remove(),5200);
}
function updateFishingShop(){
  if(!walletTween)$('credits').textContent=new Intl.NumberFormat().format(credits);
  $('shopBalance').textContent=new Intl.NumberFormat().format(credits)+' G';
  $('shopSkill').textContent='Patience '+patienceLevel();
  $('shopRodSummary').textContent=fishingCatalog.rods[fishingGear.equippedRod].name+' · '+(fishingCatalog.rods[fishingGear.equippedRod].duration/1000).toFixed(1)+'s / catch';
  $('shopBaitCount').textContent=fishingGear.bait+' bait in your bag · One per catch';
  $('shopCatchSummary').textContent=caughtFishCount()+' fish in your bag · Worth '+caughtFishValue()+' G';
  $('fishingEquipment').textContent='Equipped: '+fishingCatalog.rods[fishingGear.equippedRod].name+' · Bait ×'+fishingGear.bait;
  const selector=$('equippedFishingRod');
  selector.replaceChildren();
  for(const id of fishingGear.ownedRods){
    const option=document.createElement('option');
    option.value=id;option.textContent=fishingCatalog.rods[id].name;selector.append(option);
  }
  selector.value=fishingGear.equippedRod;
  const offers=$('rodOffers');offers.replaceChildren();
  const currentRod=fishingCatalog.rods[fishingGear.equippedRod],currentOdds=fishingChances(patienceLevel(),fishingGear.equippedRod);
  for(const [id,rod] of Object.entries(fishingCatalog.rods)){
    const odds=fishingChances(patienceLevel(),id),owned=fishingGear.ownedRods.includes(id),equipped=fishingGear.equippedRod===id;
    const skill=patienceLevel()>=rod.patience,afford=credits>=rod.price;
    const speed=(currentRod.duration-rod.duration)/1000,quality=odds.fine+odds.rare-currentOdds.fine-currentOdds.rare;
    const deltas=equipped?[{text:'Your equipped rod',tone:'neutral'}]:[
      {text:speed===0?'Same catch speed':Math.abs(speed).toFixed(1)+'s '+(speed>0?'faster':'slower'),tone:speed>0?'up':speed<0?'down':'neutral'},
      {text:(quality>0?'+':'')+quality.toFixed(1)+'% better-quality fish',tone:quality>0?'up':quality<0?'down':'neutral'}
    ];
    offers.append(renderShopCard({document,id,name:rod.name,category:rod.quality.toUpperCase(),price:rod.price,owned,equipped,stats:[['PER CATCH',(rod.duration/1000).toFixed(1)+'s'],['FINE / RARE',odds.fine.toFixed(0)+' / '+odds.rare.toFixed(0)+'%']],deltas,requirements:'PATIENCE '+rod.patience,reason:!skill?'Need '+(rod.patience-patienceLevel())+' more Patience levels':!owned&&!afford?'Need '+(rod.price-credits)+' more gold':equipped?'Ready to cast · Uses one bait':owned?'Owned · Free to equip':'Quality chances at your current Patience',action:equipped?'Equipped':!skill?'Patience required':owned?'Equip rod':!afford?'Not enough gold':'Buy & equip',disabled:equipped||!skill||(!owned&&!afford),onBuy:()=>buyFishingRod(id)}));
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
    woodcutting.timber=state.woodcutting.timber;
    status.textContent='Order complete. The carpenter paid you '+carpenterOrder.reward+' gold.';
    showTransaction('Carpenter’s Order delivered',[{text:'−'+carpenterOrder.timber+' timber',icon:'▤'}],carpenterOrder.reward);
    updateInventory();
  }catch(error){
    status.textContent=error.message;
  }finally{
    deliveringCarpenterOrder=false;
    shell.inert=false;
    updateCarpenterOrder();
    if(!$('carpenterDeliver').disabled)$('carpenterDeliver').focus();
    else $('carpenterTitle').focus();
  }
}
function sellTradeLoot(id,quantity,statusId='tradeStatus'){
  const item=tradeCatalog[id];
  if(!item||!Number.isSafeInteger(quantity)||quantity<1||quantity>tradeQuantity(id))return;
  if(currentRoom!=='market'&&!(currentRoom==='store'&&item.group==='fish'))return;
  const earned=quantity*item.price;
  if(!Number.isSafeInteger(earned)||!Number.isSafeInteger(credits+earned))return;
  if(id==='timber')woodcutting.timber-=quantity;
  else if(item.group==='fish')fishStock[id]-=quantity;
  else huntingLoot[id]-=quantity;
  credits+=earned;
  if(currentRoom==='market'&&item.group!=='materials')recordQuest(quest,'marketSale',quantity);
  savePlayerState();
  $(statusId).textContent='Sold '+quantity+' '+item.name+' for '+earned+' credits.';
  showTransaction('Trade completed',[{text:'−'+quantity+' '+item.name,icon:item.icon}],earned);
}
function updateTradingPost(){
  $('tradeBalance').textContent='Your wallet · '+new Intl.NumberFormat().format(credits)+' credits';
  updateCarpenterOrder();
  const offers=$('tradeOffers');offers.replaceChildren();
  for(const [id,item] of Object.entries(tradeCatalog)){
    const quantity=tradeQuantity(id),card=document.createElement('div');
    if(item.group==='fish'&&item.quality!=='common'&&quantity===0)continue;
    const title=document.createElement('b'),detail=document.createElement('p'),actions=document.createElement('div');
    card.className='rod-offer';card.dataset.loot=id;
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
    if(item.group==='hunting'&&quantity===0){
      const empty=document.createElement('small');
      empty.className='trade-empty';empty.textContent='Bring this hunting loot to sell it here.';
      card.append(empty);
    }
    offers.append(card);
  }
}
function savePlayerState(){
  const snapshot={credits,health,woodcutting,history,quest,combatGear,hunting,ownedFurniture,furniture:[],homeFurniture,loungeLayout:'gaming',adventure,stats:playerStats,fishingGear,huntingLoot,fishStock,avatar,location:currentRoom,position:{x:player.cx,y:player.cy}};
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
  $('roomLayout').classList.toggle('shopping',['store','armory'].includes(currentRoom));
  $('questTracker').hidden=currentRoom==='hub';
  $('roomSide').hidden=(atHome()&&!editing)||currentRoom==='outside';
  $('chatPanel').hidden=editing||currentRoom!=='lounge';
  if(currentRoom==='lounge'){
    for(const button of $('gamingGuide').querySelectorAll('[data-game-table]')){
      button.hidden=!loungeFurniture.some(item=>item.type===button.dataset.gameTable);
    }
  }
  $('editorPanel').hidden=!editing;
  $('directoryPanel').hidden=currentRoom!=='hub';
  $('fishingShop').hidden=currentRoom!=='store';
  $('tradingPost').hidden=currentRoom!=='market';
  $('armoryShop').hidden=currentRoom!=='armory';
  const exploring=moonwood.has(currentRoom);
  $('adventurePanel').hidden=!exploring;
  $('panelTitle').textContent=editing?(atHome()?'Home editor':'Room editor'):currentRoom==='hub'?'Tower directory':currentRoom==='store'?'Fishing supplies':currentRoom==='market'?'Trade your spoils':currentRoom==='armory'?'Choose your weapon':exploring?'Field journal':'Room chat';
  $('panelSub').textContent=editing?(atHome()?'YOUR HOME':'FURNITURE & DECOR'):roomDetails[currentRoom].name.toUpperCase();
  $('resetRoom').textContent=atHome()?'Clear home furniture':'Restore original room';
  $('mode').textContent=editing?'DECORATE':currentRoom==='hub'?'MAIN HUB':currentRoom==='outside'?'OPEN AIR':exploring?'EXPLORING':'FREE ROAM';
  updateAdventurePanel();
  updateFishingShop();
  updateTradingPost();
  updateArmoryShop();
  noticeUntil=0;setHint();cancelSelection();
}
function updateAdventurePanel(){
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
    logging:!woodcutting.axeOwned?'Meet the woodcutter for a free basic axe. Then chop the marked tree, or set a timed offline shift.':'Chop timber to gain Woodcutting XP. Each timber sells for 4 gold at the Trading Post.',
    clearing:'A Wild Boar guards this clearing. Approach to hunt. Rest in the Tower to refill your hearts.',
    trail:adventure.lantern?'Your lantern reveals hidden trails and crossings.':'Take the lantern from the waystone before heading deeper.',
    grove:adventure.groveTrail?'The lantern revealed a trail to the Moth Shrine.':'Light your lantern to look for a trail through the grove.',
    creek:adventure.bridge?'Moonlit stepping stones cross the creek.':'Light your lantern to reveal a way across the creek.',
    shrine:adventure.shrine?'You recorded the Moth Shrine in your journal.':'Approach the altar to examine the moths.',
    ruins:adventure.shortcut?'The root passage is open. Your Moonbloom is in inventory.':'Search the Moonwell for a keepsake and a shortcut back.',
    roots:'Follow the roots back to Lantern Trail.',
    pond:fishingSession?({casting:'Casting your line…',waiting:'Watch the float. Your character will reel automatically.',twitch:'A nibble! Keep watching the float…',bite:'Bite! Reel now for +5 Patience XP. Your character will also reel automatically.',landing:'Reeling in your catch…'}[fishingMoments.phase(fishingSession,performance.now())]):fishingGear.bait<1?'Out of bait. Visit Silverfin Outfitters through the Fishing door in the Grand Lobby.':'Cast with your '+fishingCatalog.rods[fishingGear.equippedRod].name+'. Better rods and Patience improve catch quality. Fish in inventory: '+caughtFishCount()+'.'
  };
  $('adventureStatus').textContent=fieldNotes[currentRoom];
  $('fishingStats').hidden=currentRoom!=='pond';
  $('offlinePlanPanel').hidden=currentRoom!=='pond';
  $('startOfflineFishing').disabled=fishingGear.bait<1||!!fishingSession;
  $('planBait').max=fishingGear.bait;
  $('planPace').textContent='One catch about every '+Math.round(60*fishingCatalog.rods[fishingGear.equippedRod].duration/4500)+' seconds with your '+fishingCatalog.rods[fishingGear.equippedRod].name+'. Each catch uses one bait and earns 10 Patience XP.';
  updatePlayerStats();
  $('adventureProgress').textContent=adventure.discovered.length+' of '+Object.keys(moonwood.areas).length+' places discovered';
  const landmark=$('adventureLandmark');
  const bite=!!fishingSession&&fishingMoments.phase(fishingSession,performance.now())==='bite';
  const action={clearing:!player.inCombat&&Date.now()>=hunting.respawnAt?'Approach boar':'',trail:!adventure.lantern?'Take lantern':'',shrine:!adventure.shrine?'Examine altar':'',ruins:!adventure.shortcut?'Search Moonwell':'',pond:bite?'Reel! +5 Patience XP':fishingSession?'Fishing…':'Cast a line'}[currentRoom];
  landmark.hidden=!action;
  landmark.disabled=(!!fishingSession&&!bite)||(currentRoom==='pond'&&fishingGear.bait<1);
  landmark.classList.toggle('bite-ready',bite);
  landmark.textContent=action??'';
  const links=$('adventureRoutes');
  links.replaceChildren();
  for(const door of roomDoors[currentRoom].filter(item=>moonwood.open(item,adventure))){
    const button=document.createElement('button');
    button.type='button';
    button.className='adventure-route';
    button.dataset.roomLink=door.to;
    button.textContent=roomDetails[door.to].name;
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
  fishingStarted=null;fishingSession=null;
  updateAdventurePanel();
}
function revealByLantern(){
  if(!lanternLit)return;
  if(currentRoom==='grove'&&!adventure.groveTrail){
    adventure.groveTrail=true;
    recordAdventure('A hidden trail to the Moth Shrine appears.');
  }else if(currentRoom==='creek'&&!adventure.bridge){
    adventure.bridge=true;
    recordAdventure('Stepping stones shine through the water.');
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
  if(currentRoom!=='store'||credits<fishingCatalog.bait.price)return;
  credits-=fishingCatalog.bait.price;
  fishingGear.bait+=fishingCatalog.bait.quantity;
  savePlayerState();
  $('shopStatus').textContent='Bought 10 Riverworms.';
  showTransaction('Bait purchased',[{text:'+10 Riverworms',icon:'≋'}],-fishingCatalog.bait.price);
};
$('sellFish').onclick=()=>{
  if(currentRoom!=='store')return;
  const count=caughtFishCount(),earned=caughtFishValue();
  if(count<1||!Number.isSafeInteger(earned)||!Number.isSafeInteger(credits+earned))return;
  for(const id of Object.keys(fishStock))fishStock[id]=0;
  credits+=earned;
  savePlayerState();
  $('shopStatus').textContent='Sold '+count+' fish for '+earned+' credits.';
  showTransaction('Catch sold',[{text:'−'+count+' fish · All qualities',icon:'⋈'}],earned);
};
if(hasBedStarter&&hasGamingLayout)updateInventory();else savePlayerState();
function openInventory(equipmentRoom=null){
  $('inventoryTitle').textContent=equipmentRoom==='pond'?'Equip for fishing':equipmentRoom==='clearing'?'Equip for hunting':'Inventory';
  $('weaponCard').classList.toggle('onboarding-focus',equipmentRoom==='clearing');
  $('fishingGearCard').classList.toggle('onboarding-focus',equipmentRoom==='pond');
  $('inventoryGuide').textContent=!canDecorate()
    ?'Visit your home to place furniture from storage.'
    :'Choose a piece to place it in '+(atHome()?'your home':'the Sunset Lounge')+'. Pick it up in Decorate mode to return it here.';
  if(equipmentRoom==='pond')$('inventoryGuide').textContent='Before your first catch, choose a fishing rod below. Your free Reed Rod is '+(fishingGear.equippedRod==='reed'?'already equipped.':'in your inventory.');
  if(equipmentRoom==='clearing')$('inventoryGuide').textContent='Before your first boar hunt, equip a sword below. '+(combatGear.equippedWeapon?'Your '+weaponCatalog[combatGear.equippedWeapon].name+' is already equipped.':'Choose a sword, then press Equip weapon.');
  updateInventory();
  if(!$('inventoryDialog').open)$('inventoryDialog').showModal();
  if(equipmentRoom){
    const control=$(equipmentRoom==='pond'?'equippedFishingRod':combatGear.equippedWeapon?'weaponSelect':'equipWeapon');
    control.focus({preventScroll:true});control.scrollIntoView({block:'center',behavior:'instant'});
  }
}
function showFirstEquipment(room){
  if(!needsEquipmentGuide(room,history)||hunting.encounter||hunting.recoveryUntil||savedPlayerState?.plan||savedPlayerState?.report)return;
  openInventory(room);
}
$('inventory').onclick=()=>openInventory();
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
  if(fishingSound)fishingMoments.enable(true);
  if(fishingSession){reelFish();return;}
  const landmark=roomFurniture().find(item=>item.id==='landmark');
  if(landmark)use(landmark);
};
$('combatFlee').onclick=()=>combatAction('flee');
$('combatDodge').onclick=()=>combatAction('dodge');
$('woodAction').onclick=woodAction;
$('openWorkbench').onclick=()=>{if(currentRoom==='logging')use(roomFurniture().find(item=>item.type==='workbench'));};
$('carpenterDeliver').onclick=handInCarpenterOrder;
$('equipAxe').onclick=equipAxe;
$('equipWeapon').onclick=toggleWeapon;
$('weaponSelect').onchange=updateWeaponInventory;
$('questJournal').onclick=openQuest;
$('questAction').onclick=questAction;
$('visitWarden').onclick=()=>use(hubFurniture.find(item=>item.type==='warden'));
$('restAtTower').onclick=restAtTower;

let savingRules=false;
function draftCharacterRules(){return normalizeCharacterRules({enabled:$('rulesEnabled').checked,activity:$('rulesActivity').value,keepBait:Number($('rulesKeepBait').value),timberTarget:Number($('rulesTimberTarget').value)});}
function updateCharacterRulesPreview(){
  const activity=$('rulesActivity').value;$('rulesBaitField').hidden=activity!=='fishing';$('rulesTimberField').hidden=activity!=='woodcutting';
  try{
    const rules=draftCharacterRules();$('rulesPreview').textContent=describeCharacterRules(rules);
    let detail='You keep control while playing. The eight-hour cap applies to each period away.';
    if(rules.enabled&&activity!=='rest'){
      const bait=Math.min(1000,Math.max(0,fishingGear.bait-rules.keepBait));
      const preview=jobPreview(jobState(),activity,8,bait);
      detail=activity==='woodcutting'&&woodcutting.timber>=rules.timberTarget?'Your timber target is already met. Your character will rest.':activity==='fishing'&&bait===0?'Your bait reserve is already reached. Your character will rest.':preview.allowed?'Ready with your current equipment. Supplies stay in Inventory until you sell or use them.':'Will rest with current equipment: '+preview.reason;
    }
    $('rulesRequirements').textContent=detail;$('rulesSave').disabled=savingRules||!window.playerCloud;
  }catch(error){$('rulesPreview').textContent=error.message;$('rulesSave').disabled=true;}
}
function openCharacterRules(){
  if(player.inCombat){note('Finish combat before changing your away rules.');return;}
  window.towerPauseForAccount();
  const state=window.playerCloud?.initial??savedPlayerState??{},rules=normalizeCharacterRules(state.characterRules);
  $('rulesEnabled').checked=rules.enabled;$('rulesActivity').value=rules.activity;$('rulesKeepBait').value=rules.keepBait;$('rulesTimberTarget').value=rules.timberTarget;$('rulesStatus').textContent='';
  const log=$('rulesActivityLog');log.replaceChildren();
  for(const item of [...(state.activityLog??[])].reverse()){
    const row=document.createElement('li'),title=document.createElement('b'),detail=document.createElement('p');
    title.textContent=item.kind==='rest'?'Rest at home':item.kind==='fishing'?'Fishing':'Woodcutting';
    detail.textContent=(item.kind==='rest'?'':item.count+' '+(item.kind==='fishing'?'fish':'timber')+' · +'+item.xp+' XP · ')+({'bait-reserve':'Bait reserve protected','target-reached':'Timber target reached','away-cap':'Eight-hour cap reached',returned:'Returned to game',combat:'Skipped during combat / recovery',requirements:item.summary,rest:'Rested at home'}[item.reason]??item.reason);
    row.append(title,detail);log.append(row);
  }
  if(!log.children.length){const row=document.createElement('li');row.textContent='Your next away routine will appear here.';log.append(row);}
  updateCharacterRulesPreview();$('characterRulesDialog').showModal();
}
$('openCharacterRules').onclick=openCharacterRules;
for(const id of ['rulesEnabled','rulesActivity','rulesKeepBait','rulesTimberTarget'])$(id).oninput=updateCharacterRulesPreview;
$('characterRulesDialog').oncancel=event=>{if(savingRules)event.preventDefault();};
$('characterRulesForm').onsubmit=async event=>{
  event.preventDefault();if(savingRules)return;
  try{
    const rules=draftCharacterRules();savingRules=true;updateCharacterRulesPreview();$('characterRulesDialog').querySelector('.close').disabled=true;
    window.towerPauseForAccount();savePlayerState();await window.playerCloud.saveRules(rules);
    $('rulesStatus').textContent=rules.enabled?'Rules saved. Your character will follow them next time you’re away.':'Away actions switched off.';
  }catch(error){$('rulesStatus').textContent=error.message;}
  finally{savingRules=false;updateCharacterRulesPreview();$('characterRulesDialog').querySelector('.close').disabled=false;}
};

let selectedJob='fishing',startingJob=false;
function jobState(){return {location:currentRoom,health,hunting,woodcutting,fishingGear,stats:playerStats,adventure,history,...(window.playerCloud?.initial?.plan?{plan:window.playerCloud.initial.plan}:{}),...(window.playerCloud?.initial?.report?{report:window.playerCloud.initial.report}:{})};}
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
  if(currentRoom!=='hub'||unavailable())return;
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

$('reception').onclick=()=>use(hubFurniture[0]);
for(const button of $('gamingGuide').querySelectorAll('[data-game-table]')){
  button.onclick=()=>{
    const destination=loungeFurniture.find(item=>item.type===button.dataset.gameTable);
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
  if(!editing){if(door)travelDoor(door);else if(item)use(item);else if(tile)walkTo(tile);return;}
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
document.addEventListener('keydown',e=>{
  if(player.inCombat&&['Space','KeyF'].includes(e.code)&&!e.target.matches('input,textarea,select')&&!document.querySelector('dialog[open]')){
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
  if(!document.hidden&&player.inCombat)hunting.encounter=resumeHunt(hunting.encounter,Date.now(),playerStats);
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
  const preview=$('avatarPreview'), target=preview.getContext('2d');
  target.clearRect(0,0,preview.width,preview.height);
  target.fillStyle='#1717258f';target.fillRect(20,54,16,2);
  sprite(target,28,54,draft,{time});
}
function updateAvatarPreview(){
  drawAvatarPreview(performance.now());
  for(const group of ['outfits','hair']){
    for(const [index,button] of Array.from($(group).children).entries())button.setAttribute('aria-pressed',String(draft[group==='outfits'?'outfit':'hair']===index));
  }
}
for(const [group,key,colors,names] of [
  ['outfits','outfit',outfits,['Amber','Sky','Rose','Sage','Lavender']],
  ['hair','hair',hairColors,['Chestnut','Midnight','Copper','Honey','Violet']]
]){
  colors.forEach((color,index)=>{
    const button=document.createElement('button');
    button.title=names[index];button.setAttribute('aria-label',names[index]);
    button.style.setProperty('--swatch',color);button.onclick=()=>{draft[key]=index;updateAvatarPreview();};$(group).append(button);
  });
}
function openAvatar(){
  draft={...avatar};$('guestName').value=draft.name;updateAvatarPreview();$('avatarDialog').showModal();
}
function updateName(){
  $('profile').children[1].firstChild.textContent=avatar.name;
  roomLayers.home=makeRoomLayer(()=>room(true));
  if(atHome())updateRoomLabel();
  const portrait=$('portrait').getContext('2d');
  portrait.clearRect(0,0,24,24);
  portrait.save();portrait.translate(12,39);pixelHead(portrait,avatar,false,false);portrait.restore();
}
$('profile').onclick=openAvatar;$('looks').onclick=openAvatar;
$('attributes').onclick=()=>{updatePlayerStats();$('attributesDialog').showModal();};
$('help').onclick=()=>$('helpDialog').showModal();
for(const button of document.querySelectorAll('dialog .close'))button.onclick=()=>button.closest('dialog').close();
$('saveAvatar').onclick=()=>{
  avatar={...draft,name:$('guestName').value.trim()||'Guest'};
  save('avatar',avatar);updateName();savePlayerState();$('avatarDialog').close();
};
function updateRoomLabel(){
  const landmarks={
    home:'The wall sign reads Your Home, '+avatar.name+'. Use the exit to reach the Grand Lobby.',
    hub:'Use a doorway, the Outside steps, or the Tower directory to travel.',
    lounge:'Click furniture to interact. Use the Lobby button to go back.',
    outside:'Use the Moonwood steps to explore or the Tower door to return indoors.',
    store:'Buy bait and rods from Fishing supplies. Use Lobby to return.',
    market:'Sell fish and hunting loot using Trade your spoils. Use Lobby to return.'
  };
  canvas.setAttribute('aria-label',roomDetails[currentRoom].name+'. Click a floor tile or use arrow keys to walk. '+(landmarks[currentRoom]??'Use the marked trails or the field journal to travel.'));
}
function enterRoom(next,arrival){
  if(player.inCombat||(hunting.recoveryUntil&&next!=="hub"&&next!=="home")){note("Finish combat or recovery before travelling.");return;}
  cancelFishing();selectedTimber=null;resetCombatArt();
  catchReveal=null;$('catchReveal').hidden=true;
  const focusRoom=!!document.activeElement.closest('[data-room-link]');
  currentRoom=next;
  const exploring=moonwood.has(next);
  const nextView=exploring?moonwood.view:next==='hub'?hubView:next==='outside'?courtyardView:standardView;
  if(view!==nextView){
    view=nextView;
    canvas.width=view.width;
    canvas.height=view.height;
    setZoom(1);
  }
  const {number,name,description,badge,floor}=roomDetails[next];
  $('roomLayout').classList.toggle('entry',atHome());
  $('roomLayout').classList.toggle('hub',next==='hub');
  $('roomLayout').classList.toggle('outside',next==='outside');
  $('roomLayout').classList.toggle('moonwood',exploring);
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
  $('returnLobby').hidden=!['lounge','outside','store','market','armory'].includes(next);
  $('enterMoonwood').hidden=next!=='outside';
  $('fishingSound').hidden=next!=='pond';
  $('edit').hidden=!canDecorate();
  $('bubble').hidden=true;
  updateRoomLabel();
  document.title='Tower of Beginnings • '+name;
  movePlayerToSpawn(arrival);
  if(exploring&&!adventure.discovered.includes(next)){
    adventure.discovered.push(next);
    savePlayerState();
  }
  switchMode(false);
  savePlayerState();
  if(exploring)revealByLantern();
  bounds=null;worldLabelKey='';$('worldLabels').replaceChildren();
  connectRoom();
  showFirstEquipment(next);
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
if(hunting.encounter){
  if(currentRoom==='clearing'&&combatGear.equippedWeapon){
    hunting.encounter=resumeHunt(hunting.encounter,Date.now(),playerStats);
    setPlayerCombat(true);combatMessage='Combat resumes! Both fighters attack automatically. Flee if you need to escape.';
  }else hunting.encounter=null;
}
if(hunting.recoveryUntil&&!['hub','home'].includes(currentRoom))enterRoom('hub');
updateCombatPanel();
window.towerPauseForAccount=()=>{
  if(player.inCombat)throw new Error('Finish combat before changing accounts.');
  cancelFishing();route=[];step=null;interaction=null;target=null;player.x=player.cx;player.y=player.cy;
};
window.towerSaveNow=savePlayerState;
window.towerJoinRoom=connectRoom;
window.towerHasActiveCast=()=>!!fishingSession||!!woodSession;
if(window.playerCloud)window.playerCloud.attach();
if(window.playerCloud&&typeof WebSocket!=='undefined'){
  multiplayer=createRoomConnection({
    getLocal:()=>({room:currentRoom,x:player.cx,y:player.cy,direction:player.direction,back:player.back,seat:player.seat?{type:player.seat.type,x:player.seat.x,y:player.seat.y,rot:player.seat.rot}:null,profileKey:JSON.stringify([avatar,combatGear.equippedWeapon,homeFurniture])}),
    flush:()=>window.playerCloud.flush(),onPeers:receivePeers,onChat:receiveRoomChat,
    onHistory:history=>{$('messages').replaceChildren();$('roomChatMessages').replaceChildren();for(const message of history)receiveRoomChat(message);},
    onStatus:text=>{$('networkStatus').textContent=text;$('roomChatStatus').textContent=text;$('openRoomChat').disabled=!Object.hasOwn(socialRooms,currentRoom);},
    onCorrection:position=>{route=[];step=null;player.x=player.cx=position.x;player.y=player.cy=position.y;player.seat=null;savePlayerState();},
    onUnseat:()=>{player.seat=null;},onSessionChanged:message=>window.playerCloud.invalidate?.(message)
  });
  window.towerMultiplayer=multiplayer;connectRoom();
}else $('networkStatus').textContent='Local preview';
requestAnimationFrame(animation);
