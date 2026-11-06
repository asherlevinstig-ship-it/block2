import {touchPresence} from './routines.mjs';
import {deliverCarpenterOrder} from '../public/commissions.js';
import {normalizeCharacterRules} from '../public/character-rules.js';
import { resolveIdentity } from "./identity.mjs";
import { normalizeState, startPlan, settlePlan } from "./player-state.mjs";

const COOKIE="__Host-tower-character";
const COOKIE_AGE=31536000;
const json=(data,status=200,extra={})=>Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...extra}});
const packet=row=>({state:JSON.parse(row.state_json),characterKey:row.player_id,revision:row.revision,lastOperation:row.last_request,serverTime:Date.now()});
async function read(db,id){
  return db.prepare("SELECT player_id, state_json, revision, last_request FROM tower_players WHERE player_id = ?").bind(id).first();
}
async function write(db,id,revision,state,operation){
  return db.prepare("UPDATE tower_players SET state_json = ?, revision = revision + 1, last_request = ?, updated_at = ? WHERE player_id = ? AND revision = ? RETURNING player_id, state_json, revision, last_request")
    .bind(JSON.stringify(state),operation,Date.now(),id,revision).first();
}
async function settled(db,id){
  for(let attempt=0;attempt<5;attempt++){
    const row=await read(db,id);
    if(!row)return null;
    const state=JSON.parse(row.state_json);
    if(!settlePlan(state,Date.now()))return row;
    const updated=await write(db,id,row.revision,state,"settle:"+crypto.randomUUID());
    if(updated)return updated;
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
      const existing=id&&await settled(env.TOWER_DB,id);
      if(existing)return json(packet(existing));
      const body=await bodyOf(request),state=normalizeState(body.legacy??{});
      const bytes=crypto.getRandomValues(new Uint8Array(32));
      const token=[...bytes].map(value=>value.toString(16).padStart(2,"0")).join("");
      const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
      id=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,"0")).join("");
      await env.TOWER_DB.prepare("INSERT INTO tower_players (player_id, state_json, revision, last_request, updated_at) VALUES (?, ?, 1, ?, ?)")
        .bind(id,JSON.stringify(state),"create",Date.now()).run();
      return json({state,characterKey:id,revision:1,serverTime:Date.now()},200,{"Set-Cookie":COOKIE+"="+token+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+COOKIE_AGE});
    }
    if(!id)return json({error:"Load your character first."},401);
    if(path==="/api/player/state"&&request.method==="GET"){
      const row=await settled(env.TOWER_DB,id);
      return row?json(packet(row)):json({error:"Character not found."},401);
    }
    if(request.method!=="POST")return json({error:"Not found."},404);
    const body=await bodyOf(request);
    if((body.characterKey!==undefined||identity.account)&&body.characterKey!==id)return json({error:"This tab belongs to a different character. Reload to continue."},409);
    if(typeof body.operation!=="string"||body.operation.length>80||!Number.isInteger(body.revision))return json({error:"Missing save revision."},400);
    const row=await settled(env.TOWER_DB,id);
    if(!row)return json({error:"Character not found."},401);
    if(row.last_request===body.operation)return json(packet(row));
    if(row.revision!==body.revision)return json({error:"Your character changed in another tab or completed an offline action.",...packet(row)},409);
    let state=JSON.parse(row.state_json);
    switch(path){
      case "/api/player/save":
        if(state.plan)return json({error:"Stop the work plan before playing.",...packet(row)},409);
        state={...normalizeState({...body.state,wardrobe:body.state?.wardrobe??state.wardrobe}),carpenterOrderComplete:state.carpenterOrderComplete===true,characterRules:state.characterRules??normalizeCharacterRules(),routineLastSeen:state.routineLastSeen,activityLog:state.activityLog??[],...(state.report?{report:state.report}:{})};
        break;
      case "/api/player/commissions/carpenter":
        deliverCarpenterOrder(state);
        break;
      case "/api/player/presence":
        if(!state.characterRules?.enabled||state.plan||state.report)return json(packet(row));
        touchPresence(state,Date.now());
        break;
      case "/api/player/rules/save":
        if(state.plan||state.report)return json({error:"Read your work report before changing rules.",...packet(row)},409);
        state.characterRules=normalizeCharacterRules(body.rules);state.routineLastSeen=Date.now();
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
    const updated=await write(env.TOWER_DB,id,row.revision,state,body.operation);
    if(!updated)return json({error:"Another tab saved first. Reload your character."},409);
    return json(packet(updated));
  }catch(error){
    if(error instanceof SyntaxError)return json({error:"Invalid request."},400);
    if(/Invalid|Choose|Travel|Patience|already|Read your|Unknown/.test(error.message))return json({error:error.message},400);
    console.error("Tower player service error",error.name);
    return json({error:"Your save could not be completed. Please retry."},503);
  }
}
