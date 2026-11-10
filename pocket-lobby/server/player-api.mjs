import {readFactions,changeFaction} from './factions.mjs';
import {factionHallAccess} from './faction-projects.mjs';
import {factionHall,factionHallSpawn} from '../public/faction-hall.js';
import {watchFlags} from '../public/region-catalog.js';
import {normalizeVitals} from '../public/player-vitals.js';
import {publishWorldActivity} from './world-activity.mjs';
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
import {touchPresence} from './routines.mjs';
import {deliverCarpenterOrder} from '../public/commissions.js';
import {normalizeCharacterRules,AWAY_GRACE_MS} from '../public/character-rules.js';
import { resolveIdentity } from "./identity.mjs";
import { normalizeState, startPlan, settlePlan } from "./player-state.mjs";

const COOKIE="__Host-tower-character";
const COOKIE_AGE=31536000;
const json=(data,status=200,extra={})=>Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...extra}});
function readPlayerState(row){
  const state=JSON.parse(row.state_json);
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
const packet=row=>({state:publicPlayerState(readPlayerState(row)),characterKey:row.player_id,revision:row.revision,lastOperation:row.last_request,serverTime:Date.now()});
async function read(db,id){
  return db.prepare("SELECT player_id, state_json, revision, last_request, updated_at FROM tower_players WHERE player_id = ?").bind(id).first();
}
async function write(db,id,revision,state,operation,factionId=null){
  return db.prepare("UPDATE tower_players SET state_json = ?, revision = revision + 1, last_request = ?, updated_at = ? WHERE player_id = ? AND revision = ? AND (? IS NULL OR EXISTS (SELECT 1 FROM tower_faction_members WHERE player_id=tower_players.player_id AND faction_id=?)) RETURNING player_id, state_json, revision, last_request")
    .bind(JSON.stringify(state),operation,Date.now(),id,revision,factionId,factionId).first();
}
async function settled(env,id,activities=false){
  const db=env.TOWER_DB;
  for(let attempt=0;attempt<5;attempt++){
    const row=await read(db,id);
    if(!row)return null;
    const state=readPlayerState(row);
    const now=Date.now();
    let planChanged=settlePlan(state,now);if(state.autoSwitch){touchPresence(state,now,{active:false});planChanged=true;}
    const activityChanged=activities&&settleActivities(state,now);
    const before=JSON.parse(row.state_json);
    const migrated=before.progressionVersion!==progressionVersion||before.safeVersion!==1;
    if(!planChanged&&!activityChanged&&!migrated)return row;
    const updated=await write(db,id,row.revision,state,"settle:"+crypto.randomUUID());
    if(updated){await publishWorldActivity(env,id,JSON.parse(row.state_json),state,updated.revision,{fresh:now-(row.updated_at??0)<10000});return updated;}
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
      const body=await bodyOf(request),legacy={...body.legacy};migrateProgression(legacy);
      const state=normalizeState({...legacy,outfitMagic:undefined,...(legacy.location===factionHall?{location:'hub',position:{x:8,y:12}}:{}),stats:{...legacy.stats,leadershipXp:0},adventure:{...legacy.adventure,...Object.fromEntries(watchFlags.map(key=>[key,false]))},vitals:undefined,familiars:undefined,autoConfigured:undefined,pendingCharacterRules:undefined,autoSwitch:undefined,bedRest:undefined,safeVersion:1,ownedFurniture:{...(legacy.ownedFurniture??{bed:1}),safe:0},homeFurniture:(legacy.homeFurniture??[]).filter(item=>item.type!=='safe'),bank:undefined,controlMode:'play',meals:{},magic:undefined,...(body.newCharacter===true?{characterCreated:false,welcomeSeen:false,autoLesson:'required'}:{})});
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
    if(path==="/api/player/factions"){
      if(request.method==="GET")return json(await readFactions(env.TOWER_DB,id,new URL(request.url).searchParams.get('q')));
      const body=await bodyOf(request);
      if(body.characterKey!==id)return json({error:"This tab belongs to a different character. Reload to continue."},409);
      const result=await changeFaction(env.TOWER_DB,id,body);
      return json(['create','donate'].includes(body.action)?{...result,...packet(await read(env.TOWER_DB,id))}:result);
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
    if(row.last_request===body.operation)return json(packet(row));
    if(row.revision!==body.revision)return json({error:"Your character changed in another tab or completed an offline action.",...packet(row)},409);
    let state=readPlayerState(row),factionId=null;
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
        applyGameplayAction(state,gameplay,body);
      }
    }else switch(path){
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
        state=normalizeState({avatar:{name:state.avatar.name,outfit:0,hair:state.avatar.hair},furniture:[],ownedFurniture:{bed:1},characterCreated:false,welcomeSeen:false,autoLesson:'required'});
        break;
      case "/api/player/save":
        if(body.state?.location===factionHall&&(state.location!==factionHall||!await factionHallAccess(env.TOWER_DB,id)))return json({error:"Enter the hall through your faction board."},403);
        if(state.plan)return json({error:"Stop the work plan before playing.",...packet(row)},409);
        if(body.state?.location==='lounge'&&state.location!=='lounge'&&!isSmartlyDressed(normalizeWardrobe(body.state.wardrobe??state.wardrobe)))throw new Error('Choose smart clothing in Wardrobe before entering the Sunset Lounge: Tailored Suit or Moonlit Dress.');
        state={...protectFishingState(state,normalizeState(protectFishingState(state,{...body.state,wardrobe:body.state?.wardrobe??state.wardrobe}))),rankingJoined:state.rankingJoined===true,goldEarned:state.goldEarned??0,welcomeSeen:state.welcomeSeen!==false,characterCreated:state.characterCreated!==false,carpenterOrderComplete:state.carpenterOrderComplete===true,characterRules:state.characterRules??normalizeCharacterRules(),controlMode:state.controlMode??'play',routineLastSeen:state.routineLastSeen,activityLog:state.activityLog??[],...(state.report?{report:state.report}:{})};
        break;
      case "/api/player/commissions/carpenter":
        deliverCarpenterOrder(state);
        break;
      case "/api/player/presence":
        if(body.active!==undefined&&typeof body.active!=='boolean'||body.idleForMs!==undefined&&(!Number.isInteger(body.idleForMs)||body.idleForMs<0||body.idleForMs>AWAY_GRACE_MS))throw new Error('Invalid activity status.');
        if((!state.characterRules?.enabled&&state.controlMode!=='auto'&&!state.plan)||(state.plan&&state.plan.source!=='rules')||state.report&&!state.autoSwitch)return json(packet(row));
        settleActivities(state,Date.now());
        touchPresence(state,Date.now(),{active:body.active!==false,activityAt:Date.now()-(body.idleForMs??0)});
        settleActivities(state,Date.now());
        break;
      case "/api/player/control":{
        if(!['play','auto'].includes(body.mode))throw new Error('Choose Play or Auto.');
        const now=Date.now();settlePlan(state,now);
        if(body.mode==='auto'){
          if(state.autoLesson==='required')throw new Error('Choose your starter exploration job in the Auto quest first.');
          if(state.controlMode==='auto'&&state.plan?.source==='rules')break;
          if(state.report?.source==='rules')delete state.report;
          if(state.characterCreated===false||state.plan||state.report||state.depthsRun||state.hunting?.encounter||state.hunting?.recoveryUntil||state.health<=0||state.gambling?.round?.status==='playing'||state.fishingCast||state.timberCut)throw new Error('Choose Auto after finishing your activity, reading your report and leaving the dungeon.');
          state.controlMode='auto';state.routineLastSeen=now;touchPresence(state,now,{active:false,forceStart:true});
        }else{
          if(state.plan&&state.plan.source!=='rules')throw new Error('Choose Stop work to finish your job-board shift.');
          delete state.autoSwitch;state.controlMode='play';state.routineLastSeen=now;
          if(state.plan?.source==='rules')settlePlan(state,now,{stop:true});
        }
        break;
      }
      case "/api/player/auto/explore/setup":{
        const now=Date.now();configureExplorerLesson(state,now);
        state.controlMode='auto';touchPresence(state,now,{active:false,forceStart:true});break;
      }
      case "/api/player/auto/simple":{
        const now=Date.now();
        if(state.depthsRun||state.fishingCast||state.timberCut||state.gambling?.round?.status==='playing')throw new Error('Choose Auto after finishing your current activity and leaving the dungeon.');
        const rules=simpleAutoRules(body.mode,body.options??{});
        saveAutoSettings(state,rules,now);
        if(state.plan?.source==='rules'){
          state.autoSwitch=true;settlePlan(state,now,{stop:true});touchPresence(state,now,{active:false});
        }else{delete state.report;state.controlMode='auto';touchPresence(state,now,{active:false,forceStart:true});}
        break;
      }
      case "/api/player/rules/save":
        saveAutoSettings(state,body.rules,Date.now());
        break;
      case "/api/player/plan/start":
        startPlan(state,body,Date.now());
        break;
      case "/api/player/plan/stop":
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
    const updated=await write(env.TOWER_DB,id,row.revision,state,body.operation,factionId);
    if(!updated)return json({error:"Another tab saved first. Reload your character."},409);
    await publishWorldActivity(env,id,JSON.parse(row.state_json),state,updated.revision,{fresh:Date.now()-(row.updated_at??0)<10000});
    return json(packet(updated));
  }catch(error){
    if(error.status===400||error.status===409)return json({error:error.message},error.status);
    if(error instanceof SyntaxError)return json({error:"Invalid request."},400);
    if(/Invalid|Choose|Travel|Your hearts are already full|Awaken|Patience|already|Read your|Unknown|Defeat the Cache Guardian|Defeat the Treasury Guardian|Defeat the Rune Sentinel|Clear Shell Gallery|Make room/.test(error.message))return json({error:error.message},400);
    console.error("Tower player service error",error.name);
    return json({error:"Your save could not be completed. Please retry."},503);
  }
}
