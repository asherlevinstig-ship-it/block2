import {moonwood} from '../public/moonwood.js';
import {isTimberTree,timberTreeRules,timberFacing} from '../public/woodcutting.js';
import {isFishingRoom} from '../public/region-catalog.js';

export const treeKey=(room,tree)=>room+':'+tree.x+','+tree.y;
export const forestTrees=room=>(moonwood.layouts[room]?.scenery??[]).filter(isTimberTree);
// Forest sessions must agree on the shared-tree protocol. A fresh namespace
// keeps them separate from sockets still attached to pre-tree room instances.
export const publicRoomNamespace=room=>(isFishingRoom(room)?'fishing-v1:':forestTrees(room).length?'forest-v1:':'public:')+room;
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
 let row=await db.prepare('SELECT * FROM tower_trees WHERE tree_key = ?').bind(key).first();
 if(!row){
  await db.prepare('INSERT OR IGNORE INTO tower_trees (tree_key,room) VALUES (?,?)').bind(key,room).run();
  row=await db.prepare('SELECT * FROM tower_trees WHERE tree_key = ?').bind(key).first();
 }
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
export async function writeTreePlayer(db,id,revision,state,operation,mutation,extra=[]){
 const now=Date.now(),work=state.plan?.treeWork;
 const receipt=state.timberReceipt?.id===mutation.cutId;
 const pendingManual=state.timberCut?.key===mutation.key;
 const pendingAuto=!!work&&(work.cut?.key===mutation.key||work.tree?.x===mutation.tree.x&&work.tree?.y===mutation.tree.y);
 state.woodcutting.trees??={};state.woodcutting.trees[mutation.key]={cuts:mutation.cuts,regrowsAt:mutation.regrowsAt};
 if(receipt)Object.assign(state.timberReceipt,{at:now,room:mutation.room,tree:{x:mutation.tree.x,y:mutation.tree.y}});
 // Concurrent cuts within this generation use the current count in SQL, rather
 // than reading/rebasing/retrying it. The paid tree token gates the player save.
 // Patch the actual felling result into that same save, including pending poses.
 const result=await db.batch([
  db.prepare(`UPDATE tower_trees SET
   cuts=CASE WHEN regrows_at>0 THEN 1 ELSE cuts+1 END,
   regrows_at=CASE WHEN regrows_at=0 AND cuts=2 THEN ? ELSE 0 END,
   generation=generation+CASE WHEN regrows_at=0 AND cuts=2 THEN 1 ELSE 0 END,
   version=version+1,hit_at=?,fall_direction=?,last_cut_id=?,last_player_id=?
   WHERE tree_key=? AND generation=? AND ((regrows_at=0 AND cuts<3) OR (regrows_at>0 AND regrows_at<=?))
   AND EXISTS (SELECT 1 FROM tower_players WHERE player_id=? AND revision=?)`)
   .bind(now+timberTreeRules.regrowMs,now,mutation.fallDirection,mutation.cutId,id,mutation.key,mutation.generation,now,id,revision),
  db.prepare(`WITH paid_tree AS (
    SELECT cuts,regrows_at FROM tower_trees WHERE tree_key=? AND last_cut_id=? AND last_player_id=?
   ), draft AS (SELECT ? AS body), patched AS (
    SELECT json_set(body,?,cuts,?,regrows_at) AS body,cuts FROM draft,paid_tree
   ), receipt AS (
    SELECT CASE WHEN ? THEN json_set(body,'$.timberReceipt.felled',json(CASE WHEN cuts=3 THEN 'true' ELSE 'false' END)) ELSE body END AS body,cuts FROM patched
   ), pose AS (
    SELECT CASE WHEN cuts=3 AND ? THEN json_set(json_remove(body,'$.plan.treeWork.cut'),'$.plan.treeWork.phase','choose') ELSE body END AS body,cuts FROM receipt
   ) UPDATE tower_players SET
    state_json=(SELECT CASE WHEN cuts=3 AND ? THEN json_remove(body,'$.timberCut') ELSE body END FROM pose),
    revision=revision+1,last_request=?,updated_at=?
    WHERE player_id=? AND revision=? AND EXISTS (SELECT 1 FROM paid_tree)
    RETURNING player_id,state_json,revision,last_request`)
   .bind(mutation.key,mutation.cutId,id,JSON.stringify(state),'$.woodcutting.trees.'+JSON.stringify(mutation.key)+'.cuts','$.woodcutting.trees.'+JSON.stringify(mutation.key)+'.regrowsAt',receipt?1:0,pendingAuto?1:0,pendingManual?1:0,operation,now,id,revision),
   ...extra
 ]);
 return result[1].results?.[0]??null;
}
