import {quarryRoom,quarryMiner,oreDeposits,oreProducts,pickaxes,miningDuration,miningRules,miningLevel,besideDeposit,miningFind} from '../public/mining.js';
import {quarryForge,barProducts,forgeCraftReason,pickaxeIngredients} from '../public/forge.js';
import {requireActionPoint,spendActionPoint} from './action-points.mjs';
import {exertionDuration,useHunger} from '../public/player-vitals.js';
import {MAX_SKILL_XP} from '../public/skill-curve.js';
import {miningRooms,depositRoom,deepMiningRoom,deepMiningRequirement,miningGuardAwake,miningBonusOre} from '../public/mining.js';
import {outfitVeilUntil} from '../public/outfit-magic.js';
import {huntEnemies,canUseWeapon} from '../public/hunting.js';
import {startCombatEncounter} from './activities.mjs';
const invalid=message=>Object.assign(new Error(message),{status:400});
export function awardOreStrike(state,node,cut,now,broken=false){
 const ore=oreProducts[node.ore],before=state.mining.xp;
 const base=node.yield??1,bonus=Math.min(miningBonusOre(state.mining,cut.id),Math.max(0,1000000-(state.huntingLoot[node.ore]??0)-base)),amount=base+bonus;
 state.huntingLoot[node.ore]=(state.huntingLoot[node.ore]??0)+amount;
 state.mining.xp=Math.min(MAX_SKILL_XP,before+ore.xp*base);useHunger(state);
 const find=broken?miningFind(cut.id,state.stats?.luckXp??0):null;
 const awarded=find&&(state.huntingLoot[find]??0)<1000000?find:null;
 if(awarded){
  state.huntingLoot[awarded]=(state.huntingLoot[awarded]??0)+1;
  if(state.plan){state.plan.miningFinds??={};state.plan.miningFinds[awarded]=(state.plan.miningFinds[awarded]??0)+1;}
 }
 state.miningReceipt={id:cut.id,ore:node.ore,amount,bonus,room:depositRoom(node),xp:state.mining.xp-before,at:now,node:node.id,broken,find:awarded};
 return state.miningReceipt.xp;
}
export async function writeOreStrike(db,row,state,operation,now,{node,revision,hits,readyAt}){
 const mutation=crypto.randomUUID();
 const [,updated]=await db.batch([
  db.prepare('UPDATE tower_ore_deposits SET hits=?,ready_at=?,revision=revision+1,mutation=? WHERE node_id=? AND revision=? AND EXISTS (SELECT 1 FROM tower_players WHERE player_id=? AND revision=?) RETURNING node_id')
   .bind(hits,readyAt,mutation,node,revision,row.player_id,row.revision),
  db.prepare('UPDATE tower_players SET state_json=?,revision=revision+1,last_request=?,updated_at=? WHERE player_id=? AND revision=? AND EXISTS (SELECT 1 FROM tower_ore_deposits WHERE node_id=? AND mutation=?) RETURNING *')
   .bind(JSON.stringify(state),operation,now,row.player_id,row.revision,node,mutation)
 ]);
 return updated.results[0]??null;
}
export async function readOreDeposits(db,now=Date.now()){
 const {results}=await db.prepare('SELECT node_id,hits,ready_at,revision FROM tower_ore_deposits').all();
 const rows=new Map(results.map(row=>[row.node_id,row]));
 return Object.fromEntries(oreDeposits.map(node=>{
  return [node.id,logicalOreDeposit(rows.get(node.id),now)];
 }));
}
function logicalOreDeposit(row,now){return {hits:row?.ready_at&&row.ready_at<=now?0:row?.hits??0,readyAt:row?.ready_at>now?row.ready_at:0,revision:row?.revision??0};}
export async function readOreDeposit(db,node,now=Date.now()){
 let row=await db.prepare('SELECT node_id,hits,ready_at,revision FROM tower_ore_deposits WHERE node_id=?').bind(node).first();
 if(!row){
  await db.prepare('INSERT OR IGNORE INTO tower_ore_deposits (node_id) VALUES (?)').bind(node).run();
  row=await db.prepare('SELECT node_id,hits,ready_at,revision FROM tower_ore_deposits WHERE node_id=?').bind(node).first();
 }
 return logicalOreDeposit(row,now);
}
export async function mineAction(db,row,state,body,action,now){
 if(['mineStart','mineHit','mineSmelt','mineCraft'].includes(action))requireActionPoint(state);
 if(action==='mineCancel'){delete state.miningCut;return {state};}
 if(state.characterCreated===false||state.controlMode==='auto'||state.plan||state.report||state.hunting?.encounter||state.hunting?.recoveryUntil||state.fishingCast||state.timberCut||state.health<=0)throw invalid('Finish your current activity before mining.');
 if(action==='mineEquip'){
  if(!state.mining.pickOwned)throw invalid('Collect your free pickaxe from the quarry miner.');
  if(typeof body.equipped!=='boolean')throw invalid('Choose whether to equip your pickaxe.');
  if(body.pick!==undefined){
   if(!Object.hasOwn(pickaxes,body.pick)||body.pick!=='basic'&&!state.mining.upgrades.includes(body.pick))throw invalid('Choose a pickaxe you own.');
   state.mining.pick=body.pick;
  }
  state.mining.equipped=body.equipped;delete state.miningCut;return {state};
 }
 if(!miningRooms.includes(state.location))throw invalid('Travel to a mining area first.');
 if(action==='mineSmelt'||action==='mineCraft'){
  if(state.location!==quarryRoom)throw invalid('Return to the quarry forge to craft or smelt.');
  if(state.miningCut)throw invalid('Stop mining before using the forge.');
  if(!besideDeposit(state.position,quarryForge))throw invalid('Walk beside the quarry forge first.');
  if(action==='mineSmelt'){
   const bar=Object.hasOwn(barProducts,body.id)?barProducts[body.id]:null,quantity=body.quantity;
   if(!bar||!Number.isSafeInteger(quantity)||quantity<1||quantity>1000000)throw invalid('Choose a bar and a whole quantity greater than zero.');
   if(miningLevel(state.mining)<bar.level)throw invalid('This bar needs Mining '+bar.level+'.');
   if((state.huntingLoot[bar.ore]??0)<quantity*bar.amount)throw invalid('Bring '+quantity*bar.amount+' '+bar.oreName+' to smelt these bars.');
   if((state.huntingLoot[body.id]??0)+quantity>1000000)throw invalid('Make room in your bag for these bars.');
   state.huntingLoot[bar.ore]-=quantity*bar.amount;
   state.huntingLoot[body.id]=(state.huntingLoot[body.id]??0)+quantity;
  }else{
   const reason=forgeCraftReason(state,body.id);if(reason)throw invalid(reason);
   for(const [id,quantity] of Object.entries(pickaxeIngredients(body.id))){if(id==='timber')state.woodcutting.timber-=quantity;else state.huntingLoot[id]-=quantity;}
   state.mining.pickOwned=true;state.mining.upgrades.push(body.id);state.mining.pick=body.id;state.mining.equipped=true;
  }
  spendActionPoint(state,now);return {state};
 }
 if(action==='minePick'){
  if(state.location!==quarryRoom)throw invalid('Collect your pickaxe in the quarry.');
  if(!besideDeposit(state.position,quarryMiner))throw invalid('Walk beside the quarry miner first.');
  state.mining.pickOwned=true;state.mining.equipped=true;return {state};
 }
 if(!['mineStart','mineHit'].includes(action))throw invalid('Choose a mining action.');
 if(!state.mining.pickOwned||!state.mining.equipped)throw invalid('Equip your pickaxe in Inventory first.');
 const node=oreDeposits.find(node=>node.id===(action==='mineHit'?state.miningCut?.node:body.node));
 if(!node||depositRoom(node)!==state.location||!besideDeposit(state.position,node))throw invalid('Walk beside a deposit in this area before mining.');
 if(state.location===deepMiningRoom){const reason=deepMiningRequirement(state);if(reason)throw invalid(reason);}
 const ore=oreProducts[node.ore];
 if(miningLevel(state.mining)<ore.level)throw invalid('This deposit needs Mining '+ore.level+'. Mine copper to train.');
 if((state.huntingLoot[node.ore]??0)+(node.yield??1)>1000000)throw invalid('Make room in your bag before mining more ore.');
 const saved=await readOreDeposit(db,node.id,now);
 if(saved.readyAt>now)throw invalid('This deposit is depleted. Try another while it recovers.');
 const hits=saved.hits;
 if(node.guarded&&miningGuardAwake(state,now)&&outfitVeilUntil(state)<=now){
  if(!state.combatGear.equippedWeapon||!canUseWeapon(state.stats,state.combatGear.equippedWeapon))throw invalid('The Shardback Guardian guards this vein. Equip a weapon, use Veilstep, or mine outer copper.');
  startCombatEncounter(state,huntEnemies.crystalGuardian,now);return {state};
 }
 if(action==='mineStart'){
  if(state.miningCut)return {state};
  state.miningCut={id:crypto.randomUUID(),node:node.id,revision:saved.revision,started:now,endsAt:now+exertionDuration(miningDuration(state.mining),state.vitals)};
  return {state};
 }
 const cut=state.miningCut;
 if(cut.id!==body.cutId||now<cut.endsAt)throw invalid('Finish the pickaxe swing before collecting ore.');
 if(cut.revision!==saved.revision)throw invalid('Another miner struck this deposit. Start a new swing.');
 awardOreStrike(state,node,cut,now,hits+1===miningRules.hits);
 spendActionPoint(state,now);
 delete state.miningCut;
 const nextHits=hits+1,readyAt=nextHits===miningRules.hits?now+miningRules.respawnMs:0;
 const updated=await writeOreStrike(db,row,state,body.operation,now,{node:node.id,revision:saved.revision,hits:nextHits,readyAt});
 if(!updated)throw invalid('This deposit changed. Refresh and start a new swing.');
 return {updated};
}
