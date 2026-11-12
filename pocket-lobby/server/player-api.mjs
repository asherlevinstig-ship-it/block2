import {cellarFlags} from '../public/mill-cellar.js';
import {normalizeActionPoints,availableActionPoints} from '../public/action-points.js';
import {autoHasNoPoints,requireActionPoint,spendActionPoint,stopForActionPoints} from './action-points.mjs';
import {learningAction} from './learning.mjs';
import {readFactions,changeFaction} from './factions.mjs';
import {readMillRaid,publicMillRaid,writeMillRaid} from './mill-raid.mjs';
import {readTrailCamp,refuelTrailCamp} from './trail-camp.mjs';
import {readOreDeposits,mineAction,writeOreStrike} from './mining.mjs';
import {advanceMiningWork} from './mining-work.mjs';
import {normalizeMining} from '../public/mining.js';
import {trailCamp} from '../public/trail-camp.js';
import {readTimberOrders,changeTimberOrder,atTradingPost,matchAutoTimberOrders,writeAutoTimberSale} from './timber-orders.mjs';
import {timberMarketCounter,timberMarketSurplus,completeTimberMarketTrip,completeOreSale} from './routine-queue.mjs';
import {GOLD_CAP} from '../public/bank.js';
import {factionHallAccess} from './faction-projects.mjs';
import {factionHall,factionHallSpawn} from '../public/faction-hall.js';
import {watchFlags} from '../public/region-catalog.js';
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
function readPlayerState(row){
  const state=JSON.parse(row.state_json);
  state.actionPoints=normalizeActionPoints(state.actionPoints);
  state.mining=normalizeMining(state.mining);
  migrateProgression(state);
  migrateHomeSafe(state);
  state.vitals=normalizeVitals(state.vitals);
  state.wardrobe=normalizeWardrobe(state.wardrobe,state.avatar);
  if(state.magic)state.magic=normalizeMagic(state.magic);
  // Existing shifts keep their scheduled pace until they finish.
  if(state.adventure)delete state.adventure.rootstone;
  if(state.hunting?.encounter)delete state.hunting.encounter.rootboundUntil;
  if(state.plan)delete state.plan.deepRoots;
  if(state.report)delete state.report.deepRoots;
  return state;
}
export const packet=row=>({state:publicPlayerState(readPlayerState(row)),characterKey:row.player_id,revision:row.revision,lastOperation:row.last_request,serverTime:Date.now()});
async function read(db,id){
  return db.prepare("SELECT player_id, state_json, revision, last_request, updated_at FROM tower_players WHERE player_id = ?").bind(id).first();
}
async function write(db,id,revision,state,operation,factionId=null,treeMutation=null){
  if(treeMutation)return writeTreePlayer(db,id,revision,state,operation,treeMutation);
  return db.prepare("UPDATE tower_players SET state_json = ?, revision = revision + 1, last_request = ?, updated_at = ? WHERE player_id = ? AND revision = ? AND (? IS NULL OR EXISTS (SELECT 1 FROM tower_faction_members WHERE player_id=tower_players.player_id AND faction_id=?)) RETURNING player_id, state_json, revision, last_request")
    .bind(JSON.stringify(state),operation,Date.now(),id,revision,factionId,factionId).first();
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
    const state=readPlayerState(row);
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
    const state=readPlayerState(row);
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
    settlePlan(state,now);if(state.autoSwitch)touchPresence(state,now,{active:false},env);
    if(idle)touchPresence(state,now,{active:false},env);
    enablePhysicalWork(state,env);
    const treeMutation=idle?await advanceTreeWork(env,state,now,motion):null;
    const oreMutation=idle?await advanceMiningWork(db,state,now,motion):null;
    if(state.autoDisconnected&&state.report?.reason==='action-points')finishRoutineReport(state,now);
    if(idle&&state.plan?.oreSaleTrip&&motion?.room==='market'&&motion.x===timberMarketCounter.x&&motion.y===timberMarketCounter.y){
      completeOreSale(state,now);
      if(!state.plan)finishRoutineReport(state,now);
    }
    if(idle&&state.plan?.physicalFishing){
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
    const migrated=before.progressionVersion!==progressionVersion||before.safeVersion!==1;
    if(initial===JSON.stringify(state)&&!migrated)return row;
    const operation="settle:"+crypto.randomUUID();
    const updated=oreMutation?await writeOreStrike(db,row,state,operation,now,oreMutation)
      :timberSale.length?await writeAutoTimberSale(db,row,state,operation,now,timberSale):await write(db,id,row.revision,state,operation,null,treeMutation);
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
      if(existing)return json(packet(existing));
      const body=await bodyOf(request);
      const serverStart=env.SERVER_CHARACTER_STARTS===true;
      const legacy=serverStart?{}:{...body.legacy};migrateProgression(legacy);
      delete legacy.actionPoints;delete legacy.autoDisconnected;delete legacy.learning;delete legacy.autoTravelReceipt;
      if(['moonbackStag','millCustodian'].includes(legacy.hunting?.encounter?.enemy))legacy.hunting={...legacy.hunting,encounter:null};
      if(legacy.location==='millCellar'){legacy.location='millbrook';legacy.position={x:6,y:2};}
      const state=normalizeState({...legacy,outfitMagic:undefined,...(legacy.location===factionHall?{location:'hub',position:{x:8,y:12}}:{}),stats:{...legacy.stats,leadershipXp:0},adventure:{...legacy.adventure,...Object.fromEntries([...watchFlags,...cellarFlags].map(key=>[key,false]))},vitals:undefined,familiars:undefined,autoConfigured:undefined,pendingCharacterRules:undefined,autoSwitch:undefined,bedRest:undefined,safeVersion:1,ownedFurniture:{...(legacy.ownedFurniture??{bed:1}),safe:0},homeFurniture:(legacy.homeFurniture??[]).filter(item=>item.type!=='safe'),bank:undefined,controlMode:'play',meals:{},magic:undefined,...(serverStart||body.newCharacter===true?{characterCreated:false,welcomeSeen:false,autoLesson:'required',actionPoints:{value:0,at:Date.now(),active:false}}:{})});
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
      if(state.depthsRun){delete state.depthsRun.shardEarned;delete state.depthsRun.sideWins;delete state.depthsRun.sideStone;delete state.depthsRun.finds;delete state.depthsRun.cacheGuardDefeated;delete state.depthsRun.cacheStone;}
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
    if(path==='/api/player/mill-raid'&&request.method==='GET')return json({raid:publicMillRaid(await readMillRaid(env.TOWER_DB),id)});
    if(path==='/api/player/trail-camp'&&request.method==='GET')return json({camp:await readTrailCamp(env.TOWER_DB),serverTime:Date.now()});
    if(path==='/api/player/mining'&&request.method==='GET')return json({deposits:await readOreDeposits(env.TOWER_DB),serverTime:Date.now()});
    if(path==='/api/player/timber-orders'&&request.method==='GET'){
      const row=await read(env.TOWER_DB,id);
      if(!row)return json({error:'Character not found.'},401);
      if(!atTradingPost(readPlayerState(row)))return json({error:'Visit the Trading Post to browse player orders.'},400);
      return json(await readTimberOrders(env.TOWER_DB,id));
    }
    if(path==="/api/player/factions"){
      if(request.method==="GET")return json(await readFactions(env.TOWER_DB,id,new URL(request.url).searchParams.get('q')));
      const body=await bodyOf(request);
      if(body.characterKey!==id)return json({error:"This tab belongs to a different character. Reload to continue."},409);
      const result=await changeFaction(env.TOWER_DB,id,body);
      return json(['create','donate','feastDonate','feastClaim'].includes(body.action)?{...result,...packet(await read(env.TOWER_DB,id))}:result);
    }
    if(path==="/api/player/state"&&request.method==="GET"){
      const row=await settled(env,id,true);
      return row?json(packet(row)):json({error:"Character not found."},401);
    }
    if(path==="/api/player/rankings"&&request.method==="GET"){
      const row=await settled(env,id);
      if(!row)return json({error:"Character not found."},401);
      return json(await readRankings(env.TOWER_DB,id,identity.account));
    }
    if(request.method!=="POST")return json({error:"Not found."},404);
    const body=await bodyOf(request);
    if((body.characterKey!==undefined||identity.account)&&body.characterKey!==id)return json({error:"This tab belongs to a different character. Reload to continue."},409);
    if(typeof body.operation!=="string"||body.operation.length>80||!Number.isInteger(body.revision))return json({error:"Missing save revision."},400);
    const row=["/api/player/presence","/api/player/control"].includes(path)?await read(env.TOWER_DB,id):await settled(env,id);
    if(!row)return json({error:"Character not found."},401);
    if(row.last_request===body.operation){
      if(path==='/api/player/gameplay/campRefuel')return json({...packet(row),camp:await readTrailCamp(env.TOWER_DB)});
      return json(path==='/api/player/timber-orders'?{...packet(row),board:await readTimberOrders(env.TOWER_DB,id)}:packet(row));
    }
    if(row.revision!==body.revision)return json({error:"Your character changed in another tab or completed an offline action.",...packet(row)},409);
    if(path==='/api/player/mill-raid'){
      const result=await writeMillRaid(env.TOWER_DB,row,body);
      if(!result)return json({error:'Your character changed. Refresh the mill event.',...packet(await read(env.TOWER_DB,id))},409);
      const before=JSON.parse(row.state_json),after=JSON.parse(result.updated.state_json),at=Date.now(),extraEvents=[];
      for(const [kind,amount,label] of [['damage',Math.max(0,before.health-after.health),'HP'],['heal',Math.max(0,after.health-before.health),'HP'],['gold',Math.max(0,after.credits-before.credits),'gold'],['loss',Math.max(0,before.credits-after.credits),'gold']])if(amount)extraEvents.push({id:'raid:'+body.operation+':'+kind,kind,amount,label:(['damage','loss'].includes(kind)?'-':'+')+amount+' '+label,at,room:'millbrook'});
      await publishWorldActivity(env,id,before,after,result.updated.revision,{fresh:true,extraEvents});
      if(env.SHARED_ROOMS){
        const stub=env.SHARED_ROOMS.get(env.SHARED_ROOMS.idFromName(publicRoomNamespace('millbrook')));
        await stub.fetch(new Request('https://room.internal/raid',{method:'POST',body:JSON.stringify({raid:{...result.raid,self:undefined},playerId:id,receipt:result.receipt,cast:['heal','power'].includes(body.kind)})})).catch(()=>{});
      }
      return json({...packet(result.updated),raid:result.raid,receipt:result.receipt});
    }
    let state=readPlayerState(row),factionId=null,treeMutation=null;
    if(path.startsWith('/api/player/gameplay/mine')){
      const result=await mineAction(env.TOWER_DB,row,state,body,path.split('/').at(-1),Date.now());
      const updated=result.updated??await write(env.TOWER_DB,id,row.revision,result.state,body.operation);
      if(!updated)return json({error:'Your character changed. Reload to continue.',...packet(await read(env.TOWER_DB,id))},409);
      await publishWorldActivity(env,id,JSON.parse(row.state_json),JSON.parse(updated.state_json),updated.revision);
      return json({...packet(updated),deposits:await readOreDeposits(env.TOWER_DB)});
    }
    if(path==='/api/player/gameplay/campRefuel'){
      const now=Date.now();settleActivities(state,now);
      const result=await refuelTrailCamp(env.TOWER_DB,row,state,body.operation,now);
      if(!result)return json({error:'Your character changed. Refresh the camp.',...packet(await read(env.TOWER_DB,id))},409);
      if(env.SHARED_ROOMS){
        const room=env.SHARED_ROOMS.get(env.SHARED_ROOMS.idFromName(publicRoomNamespace(trailCamp.room)));
        await room.fetch(new Request('https://room.internal/trail-camp',{method:'POST',body:JSON.stringify(result.camp)})).catch(()=>{});
      }
      return json({...packet(result.updated),camp:result.camp});
    }
    if(path==='/api/player/timber-orders'){
      const result=await changeTimberOrder(env.TOWER_DB,row,state,body,Date.now());
      if(!result)return json({error:'Another tab saved first. Reload your character.',...packet(await read(env.TOWER_DB,id))},409);
      return json({...packet(result.updated),board:await readTimberOrders(env.TOWER_DB,id),receipt:result.receipt});
    }
    enablePhysicalWork(state,env);
    if(path.startsWith('/api/player/gameplay/')){
      if(state.characterCreated===false)return json({error:'Finish creating your character first.'},400);
      Object.assign(state,normalizeState(state));
      const gameplay=path.slice('/api/player/gameplay/'.length);
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
        applyGameplayAction(state,gameplay,body,now,Math.random,{millRaid,camp});
        if(shared&&state.timberCut)state.timberCut.treeGeneration=shared.generation;
        if(shared&&gameplay==='cut')treeMutation=describeTreeCut(state,shared,body.cutId);
      }
    }else switch(path){
      case "/api/player/learning/next":
      case "/api/player/learning/answer":
        learningAction(state,path.split('/').at(-1),body);
        break;
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
          return saved.results[0]?json(packet(saved.results[0])):json({error:'Another tab saved first. Reload your character.'},409);
        }
      case "/api/player/save":
        if(body.state?.location&&body.state.location!==state.location)requireActionPoint(state);
        if(body.state?.location==='millCellar'&&(state.location!=='millCellar'||!state.adventure.millCellarFound))throw new Error('Choose the loose bricks at the watermill to enter the cellar.');
        if(state.location==='millCellar'&&body.state?.location&&body.state.location!=='millCellar')throw new Error('Choose the cellar stairs to return to Millbrook.');
        if(body.state?.location===factionHall&&(state.location!==factionHall||!await factionHallAccess(env.TOWER_DB,id)))return json({error:"Enter the hall through your faction board."},403);
        if(state.plan)return json({error:"Stop the work plan before playing.",...packet(row)},409);
        if(body.state?.location==='lounge'&&state.location!=='lounge'&&!isSmartlyDressed(normalizeWardrobe(body.state.wardrobe??state.wardrobe)))throw new Error('Choose smart clothing in Wardrobe before entering the Sunset Lounge: Tailored Suit or Moonlit Dress.');
        state={...protectFishingState(state,normalizeState(protectFishingState(state,{...body.state,wardrobe:body.state?.wardrobe??state.wardrobe}))),rankingJoined:state.rankingJoined===true,goldEarned:state.goldEarned??0,welcomeSeen:state.welcomeSeen!==false,characterCreated:state.characterCreated!==false,carpenterOrderComplete:state.carpenterOrderComplete===true,characterRules:state.characterRules??normalizeCharacterRules(),controlMode:state.controlMode??'play',routineLastSeen:state.routineLastSeen,activityLog:state.activityLog??[],...(state.report?{report:state.report}:{})};
        break;
      case "/api/player/commissions/carpenter":
        deliverCarpenterOrder(state);
        break;
      case "/api/player/presence":{
        if(body.active!==undefined&&typeof body.active!=='boolean'||body.idleForMs!==undefined&&(!Number.isInteger(body.idleForMs)||body.idleForMs<0||body.idleForMs>AWAY_GRACE_MS))throw new Error('Invalid activity status.');
        if((!state.characterRules?.enabled&&state.controlMode!=='auto'&&!state.plan)||(state.plan&&state.plan.source!=='rules')||state.report&&!state.autoSwitch)return json(packet(row));
        if(state.plan?.fishingWork?.batchUntil&&(state.controlMode==='auto'||body.active===false))return json(packet(row));
        const before=body.active===false?JSON.stringify(state):null;
        settleActivities(state,Date.now());
        const resume=state.plan?.source==='rules'&&state.controlMode!=='auto'&&body.active!==false?await actorMotion(env,id):null;
        if(body.active!==false)await settleBeforeLeavingFishing(env,id,state,Date.now(),resume);
        touchPresence(state,Date.now(),{active:body.active!==false,activityAt:Date.now()-(body.idleForMs??0)},env);
        if(resume&&!state.plan){state.location=resume.room;state.position={x:resume.x,y:resume.y};}
        settleActivities(state,Date.now());
        if(before!==null&&JSON.stringify(state)===before)return json(packet(row));
        break;
      }
      case "/api/player/reconnect":{
        if(state.autoDisconnected){
          const at=Date.now();state.actionPoints={...state.actionPoints,value:availableActionPoints(state.actionPoints,at),at,active:false};
          delete state.autoDisconnected;state.controlMode='play';state.routineLastSeen=at;
          if(state.report?.reason==='action-points')delete state.report;
        }
        break;
      }
      case "/api/player/control":{
        if(!['play','auto'].includes(body.mode))throw new Error('Choose Play or Auto.');
        const now=Date.now();
        if(body.mode==='auto'&&state.controlMode==='auto'&&state.plan?.fishingWork?.batchUntil)return json(packet(row));
        const motion=body.mode==='play'?await actorMotion(env,id):null;
        await settleBeforeLeavingFishing(env,id,state,now,motion);
        settlePlan(state,now);
        if(body.mode==='auto'){
          if(state.autoLesson==='required')throw new Error('Choose your starter exploration job in the Auto quest first.');
          if(state.controlMode==='auto'&&state.plan?.source==='rules'){
            if(JSON.stringify(state)===row.state_json)return json(packet(row));
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
    const oldRoom=JSON.parse(row.state_json).location;
    if(['/api/player/save','/api/player/gameplay/factionHall','/api/player/plan/start'].includes(path)&&state.location!==oldRoom){
      spendActionPoint(state,Date.now());
      if(state.plan&&state.actionPoints.value===0){stopForActionPoints(state,Date.now());finishRoutineReport(state,Date.now());}
    }
    const updated=await write(env.TOWER_DB,id,row.revision,state,body.operation,factionId,treeMutation);
    if(!updated&&treeMutation){const latest=await read(env.TOWER_DB,id);if(latest?.revision===row.revision)return json({error:'Invalid cut: another player felled this tree. Choose a standing tree.'},400);}
    if(!updated)return json({error:"Another tab saved first. Reload your character."},409);
    await publishWorldActivity(env,id,JSON.parse(row.state_json),JSON.parse(updated.state_json),updated.revision,{fresh:!!treeMutation||Date.now()-(row.updated_at??0)<10000});
    return json(packet(updated));
  }catch(error){
    if(error.status===402)return json({error:error.message,code:'action-points'},402);
    if(error.status===400||error.status===409)return json({error:error.message},error.status);
    if(error instanceof SyntaxError)return json({error:"Invalid request."},400);
    if(/Invalid|Choose|Travel|Your hearts are already full|Awaken|Patience|already|Read your|Unknown|Defeat the Cache Guardian|Defeat the Treasury Guardian|Defeat the Rune Sentinel|Clear Shell Gallery|Make room/.test(error.message))return json({error:error.message},400);
    console.error("Tower player service error",error.name);
    return json({error:"Your save could not be completed. Please retry."},503);
  }
}
