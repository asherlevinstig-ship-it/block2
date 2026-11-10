import {moonwood} from '../public/moonwood.js';
import {isTimberTree,timberTreeRules,timberFacing} from '../public/woodcutting.js';

export const treeKey=(room,tree)=>room+':'+tree.x+','+tree.y;
export const forestTrees=room=>(moonwood.layouts[room]?.scenery??[]).filter(isTimberTree);
// Forest sessions must agree on the shared-tree protocol. A fresh namespace
// keeps them separate from sockets still attached to pre-tree room instances.
export const publicRoomNamespace=room=>(forestTrees(room).length?'forest-v1:':'public:')+room;
export function logicalTree(row,now=Date.now()){
 const regrowing=(row?.regrows_at??row?.regrowsAt??0)>now;
 return {cuts:regrowing?3:(row?.regrows_at??row?.regrowsAt)?0:row?.cuts??0,regrowsAt:regrowing?(row.regrows_at??row.regrowsAt):0,generation:row?.generation??0,version:row?.version??0,hitAt:row?.hit_at??row?.hitAt??0,fallDirection:row?.fall_direction??row?.fallDirection??1};
}
export async function roomTreeSnapshot(db,room,now=Date.now()){
 const trees=forestTrees(room);if(!trees.length)return {room,trees:{},serverTime:now};
 const {results}=await db.prepare('SELECT * FROM tower_trees WHERE room = ?').bind(room).all(),rows=new Map(results.map(row=>[row.tree_key,row]));
 return {room,trees:Object.fromEntries(trees.map(tree=>{const key=treeKey(room,tree);return [key,logicalTree(rows.get(key),now)];})),serverTime:now};
}
export async function readSharedTree(db,room,tree,now=Date.now()){
 const key=treeKey(room,tree);
 await db.prepare('INSERT OR IGNORE INTO tower_trees (tree_key,room) VALUES (?,?)').bind(key,room).run();
 const row=await db.prepare('SELECT * FROM tower_trees WHERE tree_key = ?').bind(key).first();
 return {key,...logicalTree(row,now)};
}
export async function prepareManualTree(env,state,action,body,now=Date.now()){
 if(!env.SHARED_ROOMS||!env.TOWER_DB.batch)return null;
 const tree=forestTrees(state.location).find(t=>t.x===body.x&&t.y===body.y);if(!tree)return null;
 const shared=await readSharedTree(env.TOWER_DB,state.location,tree,now);
 state.woodcutting.trees??={};state.woodcutting.trees[shared.key]={cuts:shared.cuts,regrowsAt:shared.regrowsAt};
 if(state.timberCut?.key===shared.key&&state.timberCut.treeGeneration!==undefined&&state.timberCut.treeGeneration!==shared.generation){
  if(action==='cut')throw new Error('Invalid cut: another player felled this tree. Choose a standing tree.');
  delete state.timberCut;
 }
 return {...shared,room:state.location,tree,at:now,fallDirection:timberFacing({cx:state.position?.x,cy:state.position?.y},tree).direction==='right'?1:-1};
}
export function describeTreeCut(state,shared,cutId){
 const tree=state.woodcutting.trees[shared.key];
 return {...shared,cuts:tree.cuts,regrowsAt:tree.regrowsAt,cutId};
}

// Both updates run atomically. A failed player revision or tree generation can
// never consume a tree hit without paying its player, or pay a duplicate hit.
export async function writeTreePlayer(db,id,revision,state,operation,mutation){
 for(let attempt=0;attempt<4;attempt++){
  const now=Date.now(),generation=mutation.generation+(mutation.cuts===3?1:0);
  if(mutation.cuts===3)mutation.regrowsAt=now+timberTreeRules.regrowMs;
  state.woodcutting.trees??={};state.woodcutting.trees[mutation.key]={cuts:mutation.cuts,regrowsAt:mutation.regrowsAt};
  if(mutation.cuts===3&&state.timberCut?.key===mutation.key)delete state.timberCut;
  if(state.timberReceipt?.id===mutation.cutId)Object.assign(state.timberReceipt,{at:now,felled:mutation.cuts===3,room:mutation.room,tree:{x:mutation.tree.x,y:mutation.tree.y}});
  const result=await db.batch([
   db.prepare('UPDATE tower_trees SET cuts=?,regrows_at=?,generation=?,version=version+1,hit_at=?,fall_direction=?,last_cut_id=?,last_player_id=? WHERE tree_key=? AND version=? AND generation=? AND (regrows_at=0 OR regrows_at<=?) AND EXISTS (SELECT 1 FROM tower_players WHERE player_id=? AND revision=?)').bind(mutation.cuts,mutation.regrowsAt,generation,now,mutation.fallDirection,mutation.cutId,id,mutation.key,mutation.version,mutation.generation,now,id,revision),
   db.prepare('UPDATE tower_players SET state_json=?,revision=revision+1,last_request=?,updated_at=? WHERE player_id=? AND revision=? AND EXISTS (SELECT 1 FROM tower_trees WHERE tree_key=? AND last_cut_id=? AND last_player_id=?) RETURNING player_id,state_json,revision,last_request').bind(JSON.stringify(state),operation,now,id,revision,mutation.key,mutation.cutId,id)
  ]);
  const updated=result[1].results?.[0];if(updated)return updated;
  const player=await db.prepare('SELECT revision FROM tower_players WHERE player_id=?').bind(id).first();if(player?.revision!==revision)return null;
  const latest=await readSharedTree(db,mutation.room,mutation.tree,now);
  if(latest.regrowsAt||latest.generation!==mutation.generation)return null;
  mutation={...mutation,version:latest.version,cuts:latest.cuts+1,regrowsAt:latest.cuts===2?now+timberTreeRules.regrowMs:0};
 }
 return null;
}
