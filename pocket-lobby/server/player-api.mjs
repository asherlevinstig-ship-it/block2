import {readHearth,changeHearth} from './hearth.mjs';
import {pvpStrike,reportPvp,mostWanted} from './pvp.mjs';
import {overlookRoom,keeperFlags} from '../public/lantern-keepers.js';
import {waystationRoom} from '../public/waystation.js';
import {readWaystation,useWaystation} from './waystation.mjs';
import {readGift,sendGift} from './gifts.mjs';
import {contributeSilverfinSupper,giftSilverfinSupper,readSilverfinSupper} from './silverfin-supper.mjs';
import {readSilverfinWatch,silverfinContribution} from './silverfin-watch.mjs';
import {readPublicRequests,deliverPublicRequest} from './public-requests.mjs';
import {advanceAutoCooking} from './auto-cooking.mjs';
import {robberyAction} from './robbery.mjs';
import {cellarFlags} from '../public/mill-cellar.js';
import {normalizeActionPoints,availableActionPoints} from '../public/action-points.js';
import {autoHasNoPoints,requireActionPoint,spendActionPoint,stopForActionPoints} from './action-points.mjs';
import {learningAction} from './learning.mjs';
import {liveWeaveStudent,curriculumRequest} from './liveweave-questions.mjs';
import {readFactions,changeFaction} from './factions.mjs';
import {readMillRaid,publicMillRaid,writeMillRaid} from './mill-raid.mjs';
import {readVaultParty,writeVaultParty} from './vault-coop.mjs';
import {readTrailCamp,refuelTrailCamp} from './trail-camp.mjs';
import {readOreDeposits,mineAction,writeOreStrike} from './mining.mjs';
import {advanceMiningWork} from './mining-work.mjs';
import {normalizeMining} from '../public/mining.js';
import {trailCamp} from '../public/trail-camp.js';
import {readMarketStalls,changeMarketStall} from './market-stalls.mjs';
import {readTimberOrders,changeTimberOrder,atTradingPost,matchAutoTimberOrders,writeAutoTimberSale} from './timber-orders.mjs';
import {timberMarketCounter,timberMarketSurplus,completeTimberMarketTrip,completeOreSale} from './routine-queue.mjs';
import {GOLD_CAP} from '../public/bank.js';
import {factionHallAccess} from './faction-projects.mjs';
import {factionHall,factionHallSpawn} from '../public/faction-hall.js';
import {watchFlags,willowbankFlags} from '../public/region-catalog.js';
import {normalizeVitals} from '../public/player-vitals.js';
import {publishWorldActivity} from './world-activity.mjs';
import {prepareManualTree,describeTreeCut,writeTreePlayer,publicRoomNamespace} from './shared-trees.mjs';
import {enablePhysicalTimber,advanceTreeWork} from './tree-work.mjs';
import {advanceFishingWork,settleFishingBatch} from './fishing-work.mjs';
import {finishRoutineReport} from './routine-report.mjs';
import {buyAutoWorkBread} from './auto-food.mjs';
import {towerBread} from '../public/cooking.js';
import {simpleAutoRules} from '../public/simple-auto.js';
import {saveAutoSettings} from './auto-settings.mjs';
import {isSmartlyDressed,normalizeWardrobe,isFreeClothing} from '../public/wardrobe.js';
import {configureExplorerLesson} from './exploration-plan.mjs';
import {migrateHomeSafe} from '../public/home-safe.js';
import {migrateProgression,progressionVersion} from '../public/skill-curve.js';
import {normalizeMagic} from '../public/essences.js';
import {awardExplorationXp} from './activity-xp.mjs';
import {changeShopLicence,shopLicenceBoard,shopSaleStatements} from './shop-licences.mjs';
import {applyGameplayAction,protectFishingState} from './gameplay.mjs';
import {settleActivities} from './activities.mjs';
import {publicPlayerState} from './gambling.mjs';
import {readRankings} from './rankings.mjs';
import {touchPresence as updatePresence} from './routines.mjs';
import {deliverCarpenterOrder} from '../public/commissions.js';
import {normalizeCharacterRules,AWAY_GRACE_MS} from '../public/character-rules.js';
import { resolveIdentity } from "./identity.mjs";
import { finishAutoFoodWork, normalizeState, startPlan, settlePlan } from "./player-state.mjs";

const COOKIE="__Host-tower-character";
const physicalFishing=env=>!!(env.SHARED_ROOMS&&env.AUTO_ACTORS);
const enablePhysicalWork=(state,env)=>{
  enablePhysicalTimber(state,env);
  if(physicalFishing(env)&&state.plan?.source==='rules')state.plan.physicalFishing=true;
};
const touchPresence=(state,now,options,env)=>updatePresence(state,now,{...options,physicalTimber:!!(env.SHARED_ROOMS&&env.TOWER_DB.batch),physicalFishing:physicalFishing(env)});
const COOKIE_AGE=31536000;
const json=(data,status=200,extra={})=>Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...extra}});
function readPlayerState(row,env){
  const state=JSON.parse(row.state_json);
  state.actionPoints=normalizeActionPoints(state.actionPoints);
  state.mining=normalizeMining(state.mining);
  migrateProgression(state);
  migrateHomeSafe(state);
  state.vitals=normalizeVitals(state.vitals);
  state.wardrobe=normalizeWardrobe(state.wardrobe,state.avatar);
  if(env?.ESSENCES_PAUSED===true){
    state.essencesPaused=true;
    delete state.magic;
  }else{
    delete state.essencesPaused;
    if(state.magic)state.magic=normalizeMagic(state.magic);
  }
  // Existing shifts keep their scheduled pace until they finish.
  if(state.adventure)delete state.adventure.rootstone;
  if(state.hunting?.encounter)delete state.hunting.encounter.rootboundUntil;
  if(state.plan)delete state.plan.deepRoots;
  if(state.report)delete state.report.deepRoots;
  return state;
}
export const packet=(row,env)=>({state:publicPlayerState(readPlayerState(row,env)),characterKey:row.player_id,revision:row.revision,lastOperation:row.last_request,serverTime:Date.now()});
async function read(db,id){
  return db.prepare("SELECT player_id, state_json, revision, last_request, updated_at FROM tower_players WHERE player_id = ?").bind(id).first();
}
async function write(db,id,revision,state,operation,factionId=null,treeMutation=null,pondCatchAt=null){
  const sales=shopSaleStatements(db,state,id,revision+1,operation);
  if(treeMutation)return writeTreePlayer(db,id,revision,state,operation,treeMutation,sales);
  const update=db.prepare("UPDATE tower_players SET state_json = ?, revision = revision + 1, last_request = ?, updated_at = ? WHERE player_id = ? AND revision = ? AND (? IS NULL OR EXISTS (SELECT 1 FROM tower_faction_members WHERE player_id=tower_players.player_id AND faction_id=?)) RETURNING player_id, state_json, revision, last_request")
    .bind(JSON.stringify(state),operation,Date.now(),id,revision,factionId,factionId);
  if(pondCatchAt===null){
    if(!sales.length)return update.first();
    const [saved]=await db.batch([update,...sales]);
    return saved.results[0]??null;
  }
  const [saved,...rest]=await db.batch([update,...sales,silverfinContribution(db,id,state,pondCatchAt)]);
  const contribution=rest.at(-1);
  const row=saved.results[0];
  if(row&&contribution.results.length)row.silverfinContributed=true;
  return row??null;
}
async function actorMotion(env,id){
  if(!env.AUTO_ACTORS)return null;
  const stub=env.AUTO_ACTORS.get(env.AUTO_ACTORS.idFromName(id));
  const response=await stub.fetch(new Request('https://actor.internal/position',{method:'POST',body:JSON.stringify({playerId:id})}));
  return (await response.json()).motion;
}
export async function chargeAutoJourney(env,id,journey,at,usage=null){
  for(let attempt=0;attempt<5;attempt++){
    const row=await read(env.TOWER_DB,id);if(!row)return null;
    const state=readPlayerState(row,env);
    if(journey.routineId!==undefined&&journey.routineId!==(state.plan?.routineId??state.plan?.startedAt))return row;
    if(state.plan?.source!=='rules'||state.autoTravelReceipt?.id===journey.id)return row;
    if(autoHasNoPoints(state,at))settlePlan(state,at);else spendActionPoint(state,at);
    state.autoTravelReceipt=journey;
    if(!state.plan)finishRoutineReport(state,at);
    const updated=await write(env.TOWER_DB,id,row.revision,state,'journey:'+crypto.randomUUID());
    if(updated){if(usage)usage.saves++;return updated;}
  }
  throw new Error('Your journey changed. Please retry.');
}
async function settleBeforeLeavingFishing(env,id,state,now,motion){
  if(!state.plan?.fishingWork?.batchUntil)return;
  await settleFishingBatch(env,id,state,now,motion??await actorMotion(env,id),{stopping:true});
  if(!state.plan)finishRoutineReport(state,now);
}
export async function settled(env,id,activities=false,{idle=false,motion=null,observed=false,usage=null,autoRelay=false}={}){
  const db=env.TOWER_DB;
  for(let attempt=0;attempt<5;attempt++){
    const row=await read(db,id);
    if(!row)return null;
    const state=readPlayerState(row,env);
    const now=Date.now();
    if(!idle&&state.plan?.fishingWork?.batchUntil)return row;
    const initial=JSON.stringify(state);enablePhysicalWork(state,env);
    if(autoHasNoPoints(state,now))settlePlan(state,now);
    if(idle&&state.plan?.fishingWork?.batchUntil){
      await settleFishingBatch(env,id,state,now,motion,{observed});
      if(!state.plan)finishRoutineReport(state,now);
    }
    if(idle&&state.plan?.foodTrip){
      const purchase=buyAutoWorkBread(state,state.plan,now,motion);
      if(purchase?.reason){finishAutoFoodWork(state,purchase.reason,now);finishRoutineReport(state,now);}
    }
    if(idle&&state.plan?.mealStockTrip){
      advanceAutoCooking(state,now,motion);
      if(!state.plan)finishRoutineReport(state,now);
    }
    settlePlan(state,now);if(state.autoSwitch)touchPresence(state,now,{active:false},env);
    if(idle)touchPresence(state,now,{active:false},env);
    enablePhysicalWork(state,env);
    const treeMutation=idle&&!state.plan?.mealStockTrip?await advanceTreeWork(env,state,now,motion):null;
    const oreMutation=idle&&!state.plan?.mealStockTrip?await advanceMiningWork(db,state,now,motion):null;
    if(state.autoDisconnected&&state.report?.reason==='action-points')finishRoutineReport(state,now);
    if(idle&&state.plan?.oreSaleTrip&&motion?.room==='market'&&motion.x===timberMarketCounter.x&&motion.y===timberMarketCounter.y){
      completeOreSale(state,now);
      if(!state.plan)finishRoutineReport(state,now);
    }
    if(idle&&state.plan?.physicalFishing&&!state.plan.mealStockTrip){
      await advanceFishingWork(env,id,state,now,motion,Math.random,usage);
      if(!state.plan)finishRoutineReport(state,now);
    }
    let timberSale=[];
    if(idle&&state.plan?.timberMarketTrip&&motion?.room==='market'&&motion.x===timberMarketCounter.x&&motion.y===timberMarketCounter.y){
      const plan=state.plan;
      timberSale=await matchAutoTimberOrders(db,id,plan.timberMarket.minimumPrice,timberMarketSurplus(state,plan),GOLD_CAP-state.credits);
      completeTimberMarketTrip(state,now,timberSale);
      if(!state.plan)finishRoutineReport(state,now);
    }
    if(activities)settleActivities(state,now);
    const before=JSON.parse(row.state_json);
    awardExplorationXp(state,before.adventure?.discovered);
    const migrated=before.progressionVersion!==progressionVersion||before.safeVersion!==1;
    if(initial===JSON.stringify(state)&&!migrated)return row;
    const operation="settle:"+crypto.randomUUID();
    const saleStatements=shopSaleStatements(db,state,id,row.revision+1,operation);
    const updated=oreMutation?await writeOreStrike(db,row,state,operation,now,oreMutation,saleStatements)
      :timberSale.length?await writeAutoTimberSale(db,row,state,operation,now,timberSale,saleStatements):await write(db,id,row.revision,state,operation,null,treeMutation);
    if(updated){
      if(usage)usage.saves++;
      await publishWorldActivity(env,id,before,JSON.parse(updated.state_json),updated.revision,{usage,autoRelay,fresh:idle||before.plan?.source==='rules'||now-(row.updated_at??0)<10000});
      return updated;
    }
  }
  throw new Error("Your character is busy. Please retry.");
}
async function bodyOf(request){
  const text=await request.text();
  if(text.length>65536)throw new Error("Character save is too large.");
  const body=JSON.parse(text);
  if(!body||Array.isArray(body)||typeof body!=="object")throw new Error("Invalid request.");
  return body;
}
export async function handlePlayerApi(request,env){
  if(!env.TOWER_DB)return json({error:"Player storage is temporarily unavailable."},503);
  const path=new URL(request.url).pathname;
  const playerPacket=row=>packet(row,env);
  if(path==="/api/player/health"&&request.method==="GET"){
    await env.TOWER_DB.prepare("SELECT 1 AS ready").first();
    return json({ok:true,service:"tower-player-saves"});
  }
  if(request.method!=="GET"&&request.method!=="POST")return json({error:"Method not allowed."},405);
  if(request.method==="POST"){
    const origin=request.headers.get("Origin");
    if(origin!==new URL(request.url).origin||!request.headers.get("Content-Type")?.startsWith("application/json")){
      return json({error:"Use the game to update your character."},403);
    }
  }
  try{
    const identity=await resolveIdentity(request,env);
    if(identity?.expired)return json({error:"Your account session expired. Sign in to continue.",reauthenticate:true},401);
    let id=identity?.playerId;
    if(path==="/api/player/session"&&request.method==="POST"){
      const existing=id&&await settled(env,id,true);
      if(existing)return json({...playerPacket(existing),teacher:identity?.teacher===true});
      const body=await bodyOf(request);
      const serverStart=env.SERVER_CHARACTER_STARTS===true;
      const legacy=serverStart?{}:{...body.legacy};migrateProgression(legacy);
      delete legacy.vaultCoop;
      delete legacy.loadouts;delete legacy.chestItems;delete legacy.chestPurposes;delete legacy.publicRequests;
      delete legacy.actionPoints;delete legacy.autoDisconnected;delete legacy.learning;delete legacy.autoTravelReceipt;
      if(['moonbackStag','millCustodian'].includes(legacy.hunting?.encounter?.enemy))legacy.hunting={...legacy.hunting,encounter:null};
      if(legacy.location===overlookRoom){legacy.location=waystationRoom;legacy.position={x:10,y:3};}
      if(legacy.location==='millCellar'){legacy.location='millbrook';legacy.position={x:6,y:2};}
      const state=normalizeState({...legacy,outfitMagic:undefined,...(legacy.location===factionHall?{location:'hub',position:{x:8,y:12}}:{}),robbery:undefined,styleAbilities:undefined,stats:{...legacy.stats,stealthXp:0,leadershipXp:0,huntingXp:0,tradingXp:0,explorationXp:0,familiarConnectionXp:0,kindnessXp:0,evil:0},adventure:{...legacy.adventure,...Object.fromEntries([...keeperFlags,...watchFlags,...willowbankFlags,...cellarFlags].map(key=>[key,false]))},vitals:undefined,equipmentEffects:undefined,familiars:undefined,autoConfigured:undefined,pendingCharacterRules:undefined,autoSwitch:undefined,bedRest:undefined,safeVersion:1,ownedFurniture:{...(legacy.ownedFurniture??{bed:1}),safe:0},homeFurniture:(legacy.homeFurniture??[]).filter(item=>item.type!=='safe'),bank:undefined,controlMode:'play',meals:{},magic:undefined,...(serverStart||body.newCharacter===true?{characterCreated:false,welcomeSeen:false,autoLesson:'required',actionPoints:{value:0,at:Date.now(),active:false}}:{})});
      if(state.wardrobe.outfits.some(look=>['jacket','trousers','boots'].some(slot=>!isFreeClothing(look[slot]))))throw new Error('Choose free starter clothing for a new character.');
      state.wardrobe.owned=state.wardrobe.owned.filter(isFreeClothing);
      delete state.combatGear.ownedArmour;delete state.combatGear.equippedArmour;
      state.stats.luckXp=0;delete state.stats.cookingXp;
      delete state.combatGear.weaponEnchantments;
      if(state.hunting.encounter){
        delete state.hunting.encounter.magicWard;
        delete state.hunting.encounter.magicWardUntil;
        delete state.hunting.encounter.burn;
        delete state.hunting.encounter.chilledUntil;
        delete state.hunting.encounter.weakenedUntil;
        delete state.hunting.encounter.weakenPercent;
        delete state.hunting.encounter.usedEssences;
        delete state.hunting.encounter.summary;
        delete state.hunting.encounter.tacticsAt;
        delete state.hunting.encounter.interruptResistUntil;
      }
      if(state.depthsRun){delete state.depthsRun.shardEarned;delete state.depthsRun.sideWins;delete state.depthsRun.sideStone;delete state.depthsRun.finds;delete state.depthsRun.floodCacheChoice;delete state.depthsRun.galleryLight;delete state.depthsRun.vaultMechanism;delete state.depthsRun.cacheGuardDefeated;delete state.depthsRun.cacheStone;}
      delete state.huntingLoot.moonwellShard;
      delete state.combatGear.moonwellCharmOwned;
      delete state.combatGear.moonwellCharmEquipped;
      const bytes=crypto.getRandomValues(new Uint8Array(32));
      const token=[...bytes].map(value=>value.toString(16).padStart(2,"0")).join("");
      const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
      id=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,"0")).join("");
      await env.TOWER_DB.prepare("INSERT INTO tower_players (player_id, state_json, revision, last_request, updated_at) VALUES (?, ?, 1, ?, ?)")
        .bind(id,JSON.stringify(state),"create",Date.now()).run();
      return json({state,characterKey:id,revision:1,serverTime:Date.now()},200,{"Set-Cookie":COOKIE+"="+token+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+COOKIE_AGE});
    }
    if(!id)return json({error:"Load your character first."},401);
    if(path==='/api/player/silverfin-supper'&&request.method==='GET'){
      const row=await read(env.TOWER_DB,id);
      return row?json({...playerPacket(row),supper:await readSilverfinSupper(env.TOWER_DB,id,Date.now())}):json({error:'Character not found.'},401);
    }
    if(path==='/api/player/silverfin-watch'&&request.method==='GET')return json({watch:await readSilverfinWatch(env.TOWER_DB,id)});
    if(path==='/api/player/public-requests'&&request.method==='GET')return json({board:await readPublicRequests(env.TOWER_DB)});
    if(path==='/api/player/vault-coop'&&request.method==='GET'){
      const row=await read(env.TOWER_DB,id),state=row&&readPlayerState(row),code=new URL(request.url).searchParams.get('id')??state?.vaultCoop?.id;
      if(state?.location!=='depthsVault'&&!state?.vaultCoop)return json({error:'Visit the Sunken Vault to view a co-op party.'},400);
      return json({raid:(await readVaultParty(env.TOWER_DB,code,id)).public});
    }
    if(path==='/api/player/mill-raid'&&request.method==='GET')return json({raid:publicMillRaid(await readMillRaid(env.TOWER_DB),id)});
    if(path==='/api/player/hearth'&&request.method==='GET'){
      const row=await read(env.TOWER_DB,id);
      if(!row)return json({error:'Character not found.'},401);
      const state=JSON.parse(row.state_json);
      const current=state.styleAbilities?.hearth?await settled(env,id,true):row;
      return json({...playerPacket(current),hearth:await readHearth(env.TOWER_DB,id)});
    }
    if(path==='/api/player/waystation'&&request.method==='GET')return json({waystation:await readWaystation(env.TOWER_DB)});
    if(path==='/api/player/trail-camp'&&request.method==='GET')return json({camp:await readTrailCamp(env.TOWER_DB),serverTime:Date.now()});
    if(path==='/api/player/mining'&&request.method==='GET')return json({deposits:await readOreDeposits(env.TOWER_DB),serverTime:Date.now()});
    if(path==='/api/player/shop-licences'&&request.method==='GET')return json(await shopLicenceBoard(env.TOWER_DB,id));
    if(path==='/api/player/market-stalls'&&request.method==='GET'){
      const row=await read(env.TOWER_DB,id);
      if(!row||!atTradingPost(readPlayerState(row,env)))return json({error:'Visit the Trading Post to browse stalls.'},400);
      return json(await readMarketStalls(env.TOWER_DB,id,new URL(request.url).searchParams.get('item')));
    }
    if(path==='/api/player/timber-orders'&&request.method==='GET'){
      const row=await read(env.TOWER_DB,id);
      if(!row)return json({error:'Character not found.'},401);
      if(!atTradingPost(readPlayerState(row)))return json({error:'Visit the Trading Post to browse player orders.'},400);
      return json(await readTimberOrders(env.TOWER_DB,id));
    }
    if(path==="/api/player/factions"){
      if(request.method==="GET")return json(await readFactions(env.TOWER_DB,id,new URL(request.url).searchParams.get('q')));
      const current=await read(env.TOWER_DB,id);if(current&&JSON.parse(current.state_json).vaultCoop)return json({error:'Leave the co-op Vault party before changing your faction or visiting its hall.'},400);
      const body=await bodyOf(request);
      if(body.characterKey!==id)return json({error:"This tab belongs to a different character. Reload to continue."},409);
      const result=await changeFaction(env.TOWER_DB,id,body);
      return json(['create','donate','feastDonate','feastClaim'].includes(body.action)?{...result,...playerPacket(await read(env.TOWER_DB,id))}:result);
    }
    if(path==='/api/player/pvp'&&request.method==='GET')return json({wanted:await mostWanted(env)});
    if(path==="/api/player/state"&&request.method==="GET"){
      const row=await settled(env,id,true);
      return row?json({...playerPacket(row),teacher:identity?.teacher===true}):json({error:"Character not found."},401);
    }
    if(path==="/api/player/rankings"&&request.method==="GET"){
      const row=await settled(env,id);
      if(!row)return json({error:"Character not found."},401);
      return json(await readRankings(env.TOWER_DB,id,identity.account));
    }
    if(request.method!=="POST")return json({error:"Not found."},404);
    const body=await bodyOf(request);
    if(env.ESSENCES_PAUSED===true&&(
      ['/api/player/gameplay/bondEssences','/api/player/gameplay/awakenPower','/api/player/gameplay/equipPower'].includes(path)||
      path==='/api/player/gameplay/combat'&&body.input==='essence'||
      ['/api/player/vault-coop','/api/player/mill-raid'].includes(path)&&body.kind==='power'
    ))return json({error:'Essence abilities are currently unavailable.'},400);
    if((body.characterKey!==undefined||identity.account)&&body.characterKey!==id)return json({error:"This tab belongs to a different character. Reload to continue."},409);
    if(typeof body.operation!=="string"||body.operation.length>80||!Number.isInteger(body.revision))return json({error:"Missing save revision."},400);
    const row=["/api/player/presence","/api/player/control"].includes(path)?await read(env.TOWER_DB,id):await settled(env,id);
    if(!row)return json({error:"Character not found."},401);
    if(path==='/api/player/gift'){
      const previous=await readGift(env.TOWER_DB,id,body.operation);
      if(previous)return json({...playerPacket(row),gift:previous});
      if(row.revision!==body.revision)return json({error:'Your character changed. Check your bag and try again.',...playerPacket(row)},409);
      const result=await sendGift(env,row,body);
      if(result.stub)await result.stub.fetch(new Request('https://room.internal/gift-notice',{method:'POST',body:JSON.stringify({recipient:result.recipient,receipt:result.receipt})})).catch(()=>{});
      return json({...playerPacket(result.updated),gift:result.receipt});
    }
    if(path==='/api/player/hearth'){
      if(row.revision!==body.revision&&row.last_request!==body.operation)return json({error:'Your character changed. Try again.',...playerPacket(row)},409);
      await changeHearth(env,row,body);
      return json({...playerPacket(await read(env.TOWER_DB,id)),hearth:await readHearth(env.TOWER_DB,id)});
    }
    if(row.last_request===body.operation){
      if(path==='/api/player/market-stalls'){
        const appraisal=body.kind==='appraise'?await env.TOWER_DB.prepare('SELECT receipt FROM tower_market_appraisals WHERE player_id=? AND operation=?').bind(id,body.operation).first():null;
        return json({...playerPacket(row),board:await readMarketStalls(env.TOWER_DB,id,body.filter),...(appraisal?{receipt:JSON.parse(appraisal.receipt)}:{})});
      }
      if(path==='/api/player/gameplay/shopLicence')return json({...playerPacket(row),shopBoard:await shopLicenceBoard(env.TOWER_DB,id)});
      if(path==='/api/player/public-requests')return json({...playerPacket(row),board:await readPublicRequests(env.TOWER_DB)});
      if(path==='/api/player/pvp')return json({...playerPacket(row),receipt:body.kind==='strike'?JSON.parse(row.state_json).pvp?.lastStrike:undefined});
      if(path==='/api/player/robbery')return json({...playerPacket(row),receipt:JSON.parse(row.state_json).robbery?.lastAttempt});
      if(path==='/api/player/gameplay/waystation')return json({...playerPacket(row),waystation:await readWaystation(env.TOWER_DB)});
      if(path==='/api/player/gameplay/campRefuel')return json({...playerPacket(row),camp:await readTrailCamp(env.TOWER_DB)});
      return json(path==='/api/player/timber-orders'?{...playerPacket(row),board:await readTimberOrders(env.TOWER_DB,id)}:playerPacket(row));
    }
    if(path==='/api/player/silverfin-supper'){
      const expected={...row,revision:body.revision};
      if(body.kind==='gift')await giftSilverfinSupper(env.TOWER_DB,expected,body.id,Date.now());
      else if(body.kind==='contribute')await contributeSilverfinSupper(env.TOWER_DB,expected,body.id,body.fish,Date.now());
      else return json({error:'Choose a supper action.'},400);
      return json({...playerPacket(await read(env.TOWER_DB,id)),supper:await readSilverfinSupper(env.TOWER_DB,id,Date.now())});
    }
    if(path==='/api/player/pvp'&&body.kind==='report')return json({...playerPacket(row),reported:await reportPvp(env,id,body.incident)});
    if(row.revision!==body.revision)return json({error:"Your character changed in another tab or completed an offline action.",...playerPacket(row)},409);
    if(path==='/api/player/vault-coop'){
      const result=await writeVaultParty(env.TOWER_DB,env.ESSENCES_PAUSED===true?{...row,state_json:JSON.stringify(readPlayerState(row,env))}:row,body);if(!result)return json({error:'Your character changed. Refresh the Vault party.',...playerPacket(await read(env.TOWER_DB,id))},409);
      await publishWorldActivity(env,id,JSON.parse(row.state_json),JSON.parse(result.updated.state_json),result.updated.revision,{fresh:true});
      return json({...playerPacket(result.updated),raid:result.raid,receipt:result.receipt});
    }
    if(JSON.parse(row.state_json).vaultCoop&&!['/api/player/save','/api/player/presence'].includes(path)&&!path.startsWith('/api/player/learning/'))return json({error:'Leave the co-op Vault party before starting another activity.'},400);
    if(path==='/api/player/mill-raid'){
      const result=await writeMillRaid(env.TOWER_DB,env.ESSENCES_PAUSED===true?{...row,state_json:JSON.stringify(readPlayerState(row,env))}:row,body);
      if(!result)return json({error:'Your character changed. Refresh the mill event.',...playerPacket(await read(env.TOWER_DB,id))},409);
      const before=JSON.parse(row.state_json),after=JSON.parse(result.updated.state_json),at=Date.now(),extraEvents=[];
      for(const [kind,amount,label] of [['damage',Math.max(0,before.health-after.health),'HP'],['heal',Math.max(0,after.health-before.health),'HP'],['gold',Math.max(0,after.credits-before.credits),'gold'],['loss',Math.max(0,before.credits-after.credits),'gold']])if(amount)extraEvents.push({id:'raid:'+body.operation+':'+kind,kind,amount,label:(['damage','loss'].includes(kind)?'-':'+')+amount+' '+label,at,room:'millbrook'});
      await publishWorldActivity(env,id,before,after,result.updated.revision,{fresh:true,extraEvents});
      if(env.SHARED_ROOMS){
        const stub=env.SHARED_ROOMS.get(env.SHARED_ROOMS.idFromName(publicRoomNamespace('millbrook')));
        await stub.fetch(new Request('https://room.internal/raid',{method:'POST',body:JSON.stringify({raid:{...result.raid,self:undefined},playerId:id,receipt:result.receipt,cast:['heal','power'].includes(body.kind)})})).catch(()=>{});
      }
      return json({...playerPacket(result.updated),raid:result.raid,receipt:result.receipt});
    }
    let state=readPlayerState(row,env),factionId=null,treeMutation=null,pondCatchAt=null;
    if(path==='/api/player/public-requests'){
      const updated=await deliverPublicRequest(env.TOWER_DB,row,state,body.id,body.operation,Date.now());
      if(!updated)return json({error:'The board changed. Refresh it and try again.',...playerPacket(await read(env.TOWER_DB,id))},409);
      return json({...playerPacket(updated),board:await readPublicRequests(env.TOWER_DB)});
    }
    if(path==='/api/player/pvp'){
      if(body.kind!=='strike')return json({error:'Choose a PvP action.'},400);
      const result=await pvpStrike(env,row,state,body);
      return json({...playerPacket(result.row),receipt:result.receipt});
    }
    if(path==='/api/player/robbery'){
      const result=await robberyAction(env,row,state,body);
      if(result.preview)return json({...playerPacket(row),preview:result.preview});
      await publishWorldActivity(env,id,JSON.parse(row.state_json),JSON.parse(result.updated.state_json),result.updated.revision,{fresh:true});
      if(result.targetUpdated)await publishWorldActivity(env,result.targetUpdated.player_id,result.targetBefore,JSON.parse(result.targetUpdated.state_json),result.targetUpdated.revision,{fresh:true});
      return json({...playerPacket(result.updated),receipt:result.receipt});
    }
    if(path.startsWith('/api/player/gameplay/mine')){
      const result=await mineAction(env.TOWER_DB,row,state,body,path.split('/').at(-1),Date.now());
      const updated=result.updated??await write(env.TOWER_DB,id,row.revision,result.state,body.operation);
      if(!updated)return json({error:'Your character changed. Reload to continue.',...playerPacket(await read(env.TOWER_DB,id))},409);
      await publishWorldActivity(env,id,JSON.parse(row.state_json),JSON.parse(updated.state_json),updated.revision);
      return json({...playerPacket(updated),deposits:await readOreDeposits(env.TOWER_DB)});
    }
    if(path==='/api/player/gameplay/waystation'){
      const updated=await useWaystation(env.TOWER_DB,row,state,body,Date.now());
      if(!updated)return json({error:'Your character changed. Try again.',...playerPacket(await read(env.TOWER_DB,id))},409);
      const waystation=await readWaystation(env.TOWER_DB);
      if(body.kind==='donate'&&env.SHARED_ROOMS){
        const room=env.SHARED_ROOMS.get(env.SHARED_ROOMS.idFromName(publicRoomNamespace(waystationRoom)));
        await room.fetch(new Request('https://room.internal/waystation',{method:'POST',body:JSON.stringify(waystation)})).catch(()=>{});
      }
      return json({...playerPacket(updated),waystation});
    }
    if(path==='/api/player/gameplay/campRefuel'){
      const now=Date.now();settleActivities(state,now);
      const result=await refuelTrailCamp(env.TOWER_DB,row,state,body.operation,now);
      if(!result)return json({error:'Your character changed. Refresh the camp.',...playerPacket(await read(env.TOWER_DB,id))},409);
      if(env.SHARED_ROOMS){
        const room=env.SHARED_ROOMS.get(env.SHARED_ROOMS.idFromName(publicRoomNamespace(trailCamp.room)));
        await room.fetch(new Request('https://room.internal/trail-camp',{method:'POST',body:JSON.stringify(result.camp)})).catch(()=>{});
      }
      return json({...playerPacket(result.updated),camp:result.camp});
    }
    if(path==='/api/player/market-stalls'){
      const result=await changeMarketStall(env.TOWER_DB,row,state,body);
      return json({...playerPacket(result.updated),board:await readMarketStalls(env.TOWER_DB,id,body.filter),receipt:result.receipt});
    }
    if(path==='/api/player/timber-orders'){
      const result=await changeTimberOrder(env.TOWER_DB,row,state,body,Date.now());
      if(!result)return json({error:'Another tab saved first. Reload your character.',...playerPacket(await read(env.TOWER_DB,id))},409);
      return json({...playerPacket(result.updated),board:await readTimberOrders(env.TOWER_DB,id),receipt:result.receipt});
    }
    enablePhysicalWork(state,env);
    if(path.startsWith('/api/player/gameplay/')){
      if(state.characterCreated===false)return json({error:'Finish creating your character first.'},400);
      Object.assign(state,normalizeState(state));
      const gameplay=path.slice('/api/player/gameplay/'.length);
      if(gameplay==='shopLicence'){
        const updated=await changeShopLicence(env.TOWER_DB,row,state,body);
        return json({...playerPacket(updated),shopBoard:await shopLicenceBoard(env.TOWER_DB,id)});
      }
      if(gameplay==='factionHall'){
        if(state.location!=='hub'||state.plan||state.report||state.hunting.encounter||state.hunting.recoveryUntil||state.health<=0)throw new Error('Travel to the Grand Lobby and finish your current activity first.');
        const access=await factionHallAccess(env.TOWER_DB,id);
        if(!access)return json({error:'Complete your faction’s hall project to enter.'},403);
        factionId=access.id;
        state.location=factionHall;state.position=factionHallSpawn;
      }else{
        if(state.location===factionHall){
          const access=await factionHallAccess(env.TOWER_DB,id);
          if(!access)return json({error:'Your faction hall access has ended.'},403);
          if(gameplay==='cook'&&!access.kitchen)return json({error:'Complete the field kitchen project to use this stove.'},403);
        }
        const shared=['chop','cut'].includes(gameplay)?await prepareManualTree(env,state,gameplay,body):null;
        const now=Date.now();
        const millRaid=gameplay==='cast'&&state.location==='millbrook'&&!state.fishingCast?await readMillRaid(env.TOWER_DB,now):undefined;
        const camp=(gameplay==='campRest'||gameplay==='cook'&&state.location===trailCamp.room)?await readTrailCamp(env.TOWER_DB):undefined;
        const priorCatch=state.fishingReceipt?.castId;
        applyGameplayAction(state,gameplay,body,now,Math.random,{millRaid,camp});
        if(gameplay==='catch'&&state.fishingReceipt?.room==='pond'&&state.fishingReceipt.castId!==priorCatch)pondCatchAt=now;
        if(shared&&state.timberCut)state.timberCut.treeGeneration=shared.generation;
        if(shared&&gameplay==='cut')treeMutation=describeTreeCut(state,shared,body.cutId);
      }
    }else switch(path){
      case "/api/player/learning/unlimited":
        if(!identity?.teacher)return json({error:'Unlimited Action Points are available to verified LiveWeave teachers.'},403);
        if(typeof body.enabled!=='boolean')return json({error:'Choose whether to enable Unlimited AP.'},400);
        if(body.enabled)state.actionPoints.unlimited=true;
        else delete state.actionPoints.unlimited;
        break;
      case "/api/player/learning/next":
      case "/api/player/learning/answer":{
        const action=path.split('/').at(-1),attempt=state.learning?.attempt;
        const student=await liveWeaveStudent(env,identity?.account);
        let curriculum=null,selection=null;
        if(action==='next'&&body.track!==undefined&&(!student||typeof body.track!=='string'||!/^\d{4}$/.test(body.track)))
          return json({error:'Choose an available LiveWeave subject.'},400);
        if(student&&action==='next'){
          const changed=body.track!==undefined&&body.track!==state.learning?.track;
          const eligible=!changed&&state.learning?.track&&attempt?.questionId&&(await curriculumRequest(env,student,{questionId:attempt.questionId})).eligible;
          if(!eligible){
            const session=state.learning?.session;
            const seen=session?.completedAt?[]:session?.questionIds??[];
            const track=body.track??state.learning?.track;
            selection=await curriculumRequest(env,student,{seen,track});
            if(!selection.question&&body.track===undefined&&track)selection=await curriculumRequest(env,student,{seen});
            curriculum=selection.question;
            if(!curriculum)return json({error:body.track?'That subject has no enabled questions for your year group.':'No LiveWeave questions are available for your year group and enabled topics right now.'},422);
            if(attempt)delete state.learning.attempt;
          }
        }
        if(student&&action==='answer'&&attempt?.id===body.attemptId){
          if(!attempt.questionId||!(await curriculumRequest(env,student,{questionId:attempt.questionId})).eligible)
            return json({error:'This question is no longer available. Choose Next question to continue.',code:'curriculum-changed'},422);
        }
        learningAction(state,action,body,Date.now(),Math.random,curriculum);
        if(selection?.track){state.learning.track=selection.track;state.learning.subjects=selection.subjects;}
        break;
      }
      case "/api/player/rankings/participation":
        if(!identity.account)return json({error:"Create an account to join the rankings."},400);
        if(typeof body.joined!=="boolean")return json({error:"Choose whether to join the rankings."},400);
        if(state.characterCreated===false)return json({error:"Finish creating your character first."},400);
        state.rankingJoined=body.joined;
        break;
      case "/api/player/welcome/ack":
        state.welcomeSeen=true;
        break;
      case "/api/player/create":
        if(state.characterCreated!==false)return json({error:"Your character is already created."},400);
        if(typeof body.avatar?.name!=="string"||!body.avatar.name.trim()||body.avatar.name.trim().length>20)return json({error:"Choose a name using 1 to 20 characters."},400);
        {const wardrobe=normalizeWardrobe(body.wardrobe,body.avatar);if(wardrobe.outfits.some(look=>['jacket','trousers','boots'].some(slot=>!isFreeClothing(look[slot]))))throw new Error('Choose free starter clothing.');wardrobe.owned=wardrobe.owned.filter(isFreeClothing);state=normalizeState({...state,avatar:body.avatar,wardrobe,characterCreated:true,meals:{...state.meals,[towerBread.id]:1}});}
        break;
      case "/api/player/testing/reset":
        if(body.confirm!=="RESET"||body.testing!==true)return json({error:"Choose testing mode and confirm the reset."},400);
        state=normalizeState({avatar:{name:state.avatar.name,outfit:0,hair:state.avatar.hair},furniture:[],ownedFurniture:{bed:1},characterCreated:false,welcomeSeen:false,autoLesson:'required',actionPoints:{value:0,at:Date.now(),active:false}});
        {
          const [saved]=await env.TOWER_DB.batch([
            env.TOWER_DB.prepare('UPDATE tower_players SET state_json=?,revision=revision+1,last_request=?,updated_at=? WHERE player_id=? AND revision=? RETURNING *').bind(JSON.stringify(state),body.operation,Date.now(),id,row.revision),
            env.TOWER_DB.prepare('DELETE FROM tower_timber_orders WHERE buyer_id=? AND EXISTS (SELECT 1 FROM tower_players WHERE player_id=? AND revision=? AND last_request=?) RETURNING order_id').bind(id,id,row.revision+1,body.operation)
          ]);
          return saved.results[0]?json(playerPacket(saved.results[0])):json({error:'Another tab saved first. Reload your character.'},409);
        }
      case "/api/player/save":
        if(body.state?.location===overlookRoom&&(!state.adventure.keeperRouteFound||![waystationRoom,overlookRoom].includes(state.location)))throw new Error('Choose the hidden path from the Waystation after reading both clues.');
        if(body.state?.location&&body.state.location!==state.location)requireActionPoint(state);
        if((state.location==='trail'&&body.state?.location==='pond'||state.location==='pond'&&body.state?.location==='trail')&&!(await readPublicRequests(env.TOWER_DB)).open)throw new Error('Choose the Glass Creek route until Silverfin Bridge is complete.');
        if(body.state?.location==='millCellar'&&(state.location!=='millCellar'||!state.adventure.millCellarFound))throw new Error('Choose the loose bricks at the watermill to enter the cellar.');
        if(state.location==='millCellar'&&body.state?.location&&body.state.location!=='millCellar')throw new Error('Choose the cellar stairs to return to Millbrook.');
        if(body.state?.location===factionHall&&(state.location!==factionHall||!await factionHallAccess(env.TOWER_DB,id)))return json({error:"Enter the hall through your faction board."},403);
        if(state.plan)return json({error:"Stop the work plan before playing.",...playerPacket(row)},409);
        if(body.state?.location==='lounge'&&state.location!=='lounge'&&!isSmartlyDressed(normalizeWardrobe(body.state.wardrobe??state.wardrobe)))throw new Error('Choose smart clothing in Wardrobe before entering the Sunset Lounge: Tailored Suit or Moonlit Dress.');
        state={...protectFishingState(state,normalizeState(protectFishingState(state,{...body.state,wardrobe:body.state?.wardrobe??state.wardrobe}))),rankingJoined:state.rankingJoined===true,goldEarned:state.goldEarned??0,welcomeSeen:state.welcomeSeen!==false,characterCreated:state.characterCreated!==false,carpenterOrderComplete:state.carpenterOrderComplete===true,characterRules:state.characterRules??normalizeCharacterRules(),controlMode:state.controlMode??'play',routineLastSeen:state.routineLastSeen,activityLog:state.activityLog??[],...(state.report?{report:state.report}:{})};
        break;
      case "/api/player/commissions/carpenter":
        deliverCarpenterOrder(state);
        break;
      case "/api/player/presence":{
        if(body.active!==undefined&&typeof body.active!=='boolean'||body.idleForMs!==undefined&&(!Number.isInteger(body.idleForMs)||body.idleForMs<0||body.idleForMs>AWAY_GRACE_MS))throw new Error('Invalid activity status.');
        if((!state.characterRules?.enabled&&state.controlMode!=='auto'&&!state.plan)||(state.plan&&state.plan.source!=='rules')||state.report&&!state.autoSwitch)return json(playerPacket(row));
        if(state.plan?.fishingWork?.batchUntil&&(state.controlMode==='auto'||body.active===false))return json(playerPacket(row));
        const before=body.active===false?JSON.stringify(state):null;
        settleActivities(state,Date.now());
        const resume=state.plan?.source==='rules'&&state.controlMode!=='auto'&&body.active!==false?await actorMotion(env,id):null;
        if(body.active!==false)await settleBeforeLeavingFishing(env,id,state,Date.now(),resume);
        touchPresence(state,Date.now(),{active:body.active!==false,activityAt:Date.now()-(body.idleForMs??0)},env);
        if(resume&&!state.plan){state.location=resume.room;state.position={x:resume.x,y:resume.y};}
        settleActivities(state,Date.now());
        if(before!==null&&JSON.stringify(state)===before)return json(playerPacket(row));
        break;
      }
      case "/api/player/reconnect":{
        if(state.autoDisconnected){
          const at=Date.now();state.actionPoints={...state.actionPoints,at,active:false};
          delete state.autoDisconnected;state.controlMode='play';state.routineLastSeen=at;
          if(state.report?.reason==='action-points')delete state.report;
        }
        break;
      }
      case "/api/player/control":{
        if(!['play','auto'].includes(body.mode))throw new Error('Choose Play or Auto.');
        const now=Date.now();
        if(body.mode==='auto'&&state.controlMode==='auto'&&state.plan?.fishingWork?.batchUntil)return json(playerPacket(row));
        const motion=body.mode==='play'?await actorMotion(env,id):null;
        await settleBeforeLeavingFishing(env,id,state,now,motion);
        settlePlan(state,now);
        if(body.mode==='auto'){
          if(state.autoLesson==='required')throw new Error('Choose your starter exploration job in the Auto quest first.');
          if(state.controlMode==='auto'&&state.plan?.source==='rules'){
            if(JSON.stringify(state)===row.state_json)return json(playerPacket(row));
            break;
          }
          if(state.report?.source==='rules')delete state.report;
          if(state.characterCreated===false||state.plan||state.report||state.depthsRun||state.hunting?.encounter||state.hunting?.recoveryUntil||state.health<=0||state.gambling?.round?.status==='playing'||state.fishingCast||state.timberCut)throw new Error('Choose Auto after finishing your activity, reading your report and leaving the dungeon.');
          state.controlMode='auto';state.routineLastSeen=now;touchPresence(state,now,{active:false,forceStart:true},env);
        }else{
          if(state.plan&&state.plan.source!=='rules')throw new Error('Choose Stop work to finish your job-board shift.');
          delete state.autoSwitch;state.controlMode='play';state.routineLastSeen=now;
          if(state.plan?.source==='rules')settlePlan(state,now,{stop:true});
          if(motion){state.location=motion.room;state.position={x:motion.x,y:motion.y};}
        }
        break;
      }
      case "/api/player/auto/explore/setup":{
        const now=Date.now();configureExplorerLesson(state,now);
        state.controlMode='auto';touchPresence(state,now,{active:false,forceStart:true},env);break;
      }
      case "/api/player/auto/simple":{
        const now=Date.now();
        if(state.depthsRun||state.fishingCast||state.timberCut||state.gambling?.round?.status==='playing')throw new Error('Choose Auto after finishing your current activity and leaving the dungeon.');
        if(state.miningCut)throw new Error('Choose Stop at the quarry before starting Auto.');
        const rules=simpleAutoRules(body.mode,body.options??{});
        rules.goal=(state.pendingCharacterRules??state.characterRules)?.goal;
        await settleBeforeLeavingFishing(env,id,state,now);
        saveAutoSettings(state,rules,now);
        if(state.plan?.source==='rules'){
          state.autoSwitch=true;settlePlan(state,now,{stop:true});touchPresence(state,now,{active:false},env);
        }else{delete state.report;state.controlMode='auto';touchPresence(state,now,{active:false,forceStart:true},env);}
        break;
      }
      case "/api/player/rules/save":
        saveAutoSettings(state,body.rules,Date.now());
        break;
      case "/api/player/plan/start":
        startPlan(state,body,Date.now());
        break;
      case "/api/player/plan/stop":
        await settleBeforeLeavingFishing(env,id,state,Date.now());
        settlePlan(state,Date.now(),{stop:true});
        break;
      case "/api/player/report/ack":
        if(state.report?.startedAt===body.startedAt){
          delete state.report;
          state.routineLastSeen=Date.now();
        }
        break;
      default:return json({error:"Not found."},404);
    }
    enablePhysicalWork(state,env);
    const beforeSave=JSON.parse(row.state_json);
    const oldRoom=beforeSave.location;
    if(path==='/api/player/save'){
      const prior=beforeSave.adventure?.discovered??[];
      const arrived=state.location!==oldRoom&&state.adventure.discovered.includes(state.location);
      state.adventure.discovered=[...new Set([...prior,...(arrived?[state.location]:[])])];
      if(arrived)awardExplorationXp(state,prior,state.location);
    }else awardExplorationXp(state,beforeSave.adventure?.discovered);
    if(['/api/player/save','/api/player/gameplay/factionHall','/api/player/plan/start'].includes(path)&&state.location!==oldRoom){
      spendActionPoint(state,Date.now());
      if(state.plan&&!availableActionPoints(state.actionPoints)){stopForActionPoints(state,Date.now());finishRoutineReport(state,Date.now());}
    }
    const updated=await write(env.TOWER_DB,id,row.revision,state,body.operation,factionId,treeMutation,pondCatchAt);
    if(!updated&&treeMutation){const latest=await read(env.TOWER_DB,id);if(latest?.revision===row.revision)return json({error:'Invalid cut: another player felled this tree. Choose a standing tree.'},400);}
    if(!updated)return json({error:"Another tab saved first. Reload your character."},409);
    await publishWorldActivity(env,id,JSON.parse(row.state_json),JSON.parse(updated.state_json),updated.revision,{pondCatchAt,fresh:!!treeMutation||Date.now()-(row.updated_at??0)<10000});
    if(updated.silverfinContributed)return json({...playerPacket(updated),silverfinWatch:await readSilverfinWatch(env.TOWER_DB,id,pondCatchAt)});
    return json(playerPacket(updated));
  }catch(error){
    if(error.status===402)return json({error:error.message,code:'action-points'},402);
    if(error.status===409&&path==='/api/player/robbery')return json({error:error.message,...playerPacket(await read(env.TOWER_DB,(await resolveIdentity(request,env))?.playerId))},409);
    if(path.startsWith('/api/player/learning/')&&error.status===503)return json({error:error.message},503);
    if(error.status===400||error.status===409)return json({error:error.message},error.status);
    if(error instanceof SyntaxError)return json({error:"Invalid request."},400);
    if(/Invalid|Choose|Travel|Your hearts are already full|Awaken|Patience|already|Read your|Unknown|Defeat the Rune Channeler|Defeat the Ironhide Guardian|Defeat the Thornblade Duelist|Clear Shell Gallery|Make room/.test(error.message))return json({error:error.message},400);
    console.error("Tower player service error",error.name);
    return json({error:"Your save could not be completed. Please retry."},503);
  }
}
