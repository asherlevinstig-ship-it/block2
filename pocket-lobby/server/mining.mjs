import {quarryRoom,quarryMiner,oreDeposits,oreProducts,miningRules,miningLevel,besideDeposit} from '../public/mining.js';
import {exertionDuration,useHunger} from '../public/player-vitals.js';
import {MAX_SKILL_XP} from '../public/skill-curve.js';
const invalid=message=>Object.assign(new Error(message),{status:400});
export async function readOreDeposits(db,now=Date.now()){
 const {results}=await db.prepare('SELECT node_id,hits,ready_at,revision FROM tower_ore_deposits').all();
 return Object.fromEntries(oreDeposits.map(node=>{
  const row=results.find(row=>row.node_id===node.id);
  return [node.id,{hits:row?.ready_at&&row.ready_at<=now?0:row?.hits??0,readyAt:row?.ready_at>now?row.ready_at:0,revision:row?.revision??0}];
 }));
}
export async function mineAction(db,row,state,body,action,now){
 if(action==='mineCancel'){delete state.miningCut;return {state};}
 if(state.characterCreated===false||state.controlMode==='auto'||state.plan||state.report||state.hunting?.encounter||state.hunting?.recoveryUntil||state.fishingCast||state.timberCut||state.health<=0)throw invalid('Finish your current activity before mining.');
 if(action==='mineEquip'){
  if(!state.mining.pickOwned)throw invalid('Collect your free pickaxe from the quarry miner.');
  if(typeof body.equipped!=='boolean')throw invalid('Choose whether to equip your pickaxe.');
  state.mining.equipped=body.equipped;delete state.miningCut;return {state};
 }
 if(state.location!==quarryRoom)throw invalid('Travel to the quarry to mine.');
 if(action==='minePick'){
  if(!besideDeposit(state.position,quarryMiner))throw invalid('Walk beside the quarry miner first.');
  state.mining.pickOwned=true;state.mining.equipped=true;return {state};
 }
 if(!['mineStart','mineHit'].includes(action))throw invalid('Choose a mining action.');
 if(!state.mining.pickOwned||!state.mining.equipped)throw invalid('Equip your pickaxe in Inventory first.');
 const node=oreDeposits.find(node=>node.id===(action==='mineHit'?state.miningCut?.node:body.node));
 if(!node||!besideDeposit(state.position,node))throw invalid('Walk beside a deposit before mining.');
 const ore=oreProducts[node.ore];
 if(miningLevel(state.mining)<ore.level)throw invalid('This deposit needs Mining '+ore.level+'. Mine copper to train.');
 if((state.huntingLoot[node.ore]??0)>=1000000)throw invalid('Make room in your bag before mining more ore.');
 await db.prepare('INSERT OR IGNORE INTO tower_ore_deposits (node_id) VALUES (?)').bind(node.id).run();
 const saved=await db.prepare('SELECT * FROM tower_ore_deposits WHERE node_id=?').bind(node.id).first();
 if(saved.ready_at>now)throw invalid('This deposit is depleted. Try another while it recovers.');
 const hits=saved.ready_at?0:saved.hits;
 if(action==='mineStart'){
  if(state.miningCut)return {state};
  state.miningCut={id:crypto.randomUUID(),node:node.id,revision:saved.revision,started:now,endsAt:now+exertionDuration(miningRules.duration,state.vitals)};
  return {state};
 }
 const cut=state.miningCut;
 if(cut.id!==body.cutId||now<cut.endsAt)throw invalid('Finish the pickaxe swing before collecting ore.');
 if(cut.revision!==saved.revision)throw invalid('Another miner struck this deposit. Start a new swing.');
 state.huntingLoot[node.ore]=(state.huntingLoot[node.ore]??0)+1;
 state.mining.xp=Math.min(MAX_SKILL_XP,state.mining.xp+ore.xp);useHunger(state);
 state.miningReceipt={id:cut.id,ore:node.ore,xp:ore.xp,at:now,node:node.id};
 delete state.miningCut;
 const nextHits=hits+1,readyAt=nextHits===miningRules.hits?now+miningRules.respawnMs:0,operation=crypto.randomUUID();
 const [,updated]=await db.batch([
  db.prepare('UPDATE tower_ore_deposits SET hits=?,ready_at=?,revision=revision+1,mutation=? WHERE node_id=? AND revision=? AND EXISTS (SELECT 1 FROM tower_players WHERE player_id=? AND revision=?) RETURNING node_id')
   .bind(nextHits,readyAt,operation,node.id,saved.revision,row.player_id,row.revision),
  db.prepare('UPDATE tower_players SET state_json=?,revision=revision+1,last_request=?,updated_at=? WHERE player_id=? AND revision=? AND EXISTS (SELECT 1 FROM tower_ore_deposits WHERE node_id=? AND mutation=?) RETURNING *')
   .bind(JSON.stringify(state),body.operation,now,row.player_id,row.revision,node.id,operation)
 ]);
 if(!updated.results[0])throw invalid('This deposit changed. Refresh and start a new swing.');
 return {updated:updated.results[0]};
}
