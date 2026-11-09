// Shared geometry and attack footprints. Rendering and server damage use the same cells.
export const dungeonRooms=['depthsGate','depthsGallery','depthsCache','depthsTreasury','depthsRest','depthsTrial','depthsVault'];
export const dungeonMobTypes=['depthsSkitter','depthsWarden','depthsSeer','depthsSentinel','depthsColossus'];
export const isDungeonMob=type=>dungeonMobTypes.includes(type);
export const dungeonCover=[{x:4,y:3},{x:3,y:6}];
export function dungeonFloor(room,x,y){
 if(!dungeonRooms.includes(room))return true;
 if(x<1||x>10||y<1||y>8)return false;
 if(room==='depthsGate')return x<=7?(x>=2&&y>=2||y>=4&&y<=6):x===8?y>=2&&y<=7:x>=9&&y>=2&&y<=7;
 if(room==='depthsVault')return ((x-6)**2/25+(y-5)**2/15<=1.35)||x>=2&&x<=5&&y>=4&&y<=6;
 if(room==='depthsGallery')return (x>=2&&x<=9&&y>=2&&y<=8)||(y>=4&&y<=6);
 return x>=2&&x<=10&&y>=2&&y<=8||x===1&&y>=4&&y<=6;
}
export function dungeonWalkable(room,tile,scenery=[]){
 return Number.isInteger(tile?.x)&&Number.isInteger(tile?.y)&&dungeonFloor(room,tile.x,tile.y)&&!scenery.some(p=>!isDungeonMob(p.type)&&p.x===tile.x&&p.y===tile.y);
}
export const arenaEnemy=encounter=>encounter?.arenaEnemy??{x:6,y:5};
export const arenaPlayer=encounter=>encounter?.arenaPlayer??{x:5,y:5};
export function arenaWarningAt(e,move){return e?.arenaVersion===1&&e.arenaLockedFor!==e.nextBoarAt?Math.max(0,e.nextBoarAt-move.tell):Infinity;}
export function lockArenaAttack(e,move,enemy){
 const next={...e,arenaLockedFor:e.nextBoarAt,arenaTarget:{...arenaPlayer(e)}};
 if(enemy.id==='depthsBoar'){
  const tiles=[{x:6,y:5},{x:6,y:4},{x:7,y:5},{x:6,y:6}];
  next.arenaCycle=(e.arenaCycle??0)+1;next.arenaEnemy=tiles.slice(next.arenaCycle%tiles.length).concat(tiles).find(p=>p.x!==arenaPlayer(e).x||p.y!==arenaPlayer(e).y);
 }
 if(enemy.id!=='depthsBoar'){
  const from=arenaEnemy(e),hero=arenaPlayer(e),distance=Math.hypot(from.x-hero.x,from.y-hero.y),caster=enemy.archetype==='caster';
  if(distance>1.5&&!caster||caster&&(distance<1.5||distance>3.5)){
   const tiles=[[1,0],[-1,0],[0,1],[0,-1]].map(([x,y])=>({x:from.x+x,y:from.y+y})).filter(p=>dungeonFloor(e.arenaRoom,p.x,p.y)&&!(p.x===hero.x&&p.y===hero.y)&&!(e.arenaSolids??[]).some(s=>s.x===p.x&&s.y===p.y)&&!(e.arenaRoom==='depthsGate'&&p.x===8));
   tiles.sort((a,b)=>(Math.hypot(a.x-hero.x,a.y-hero.y)-Math.hypot(b.x-hero.x,b.y-hero.y))*(caster&&distance<1.5?-1:1));
   if(tiles[0])next.arenaEnemy=tiles[0];
  }
 }
 return next;
}
function lineDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/d)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
export function arenaInDanger(e,move,tile=arenaPlayer(e)){
 const enemy=arenaEnemy(e),target=e.arenaTarget??arenaPlayer(e);
 if(move.shape==='ring')return Math.hypot(tile.x-enemy.x,tile.y-enemy.y)<=1.65;
 if(move.shape==='bolt')return Math.hypot(tile.x-target.x,tile.y-target.y)<.75;
 if(move.shape==='arc')return Math.hypot(tile.x-enemy.x,tile.y-enemy.y)<=1.8;
 return lineDistance(tile,enemy,target)<.6&&Math.hypot(tile.x-enemy.x,tile.y-enemy.y)<=Math.hypot(target.x-enemy.x,target.y-enemy.y)+.7;
}
export function arenaBehindCover(e,move,tile=arenaPlayer(e)){
 if(move.shape!=='bolt')return false;
 const enemy=arenaEnemy(e),distance=Math.hypot(tile.x-enemy.x,tile.y-enemy.y);
 return dungeonCover.some(p=>lineDistance(p,enemy,tile)<.65&&Math.hypot(p.x-enemy.x,p.y-enemy.y)<distance-.4);
}
export function arenaMoveEvent(state,tile,now,scenery=[]){
 const e=state.hunting?.encounter,from=e&&arenaPlayer(e);
 if(e?.arenaVersion!==1||!tile||now<(e.arenaStepAt??0)||Math.abs(tile.x-from.x)+Math.abs(tile.y-from.y)!==1||!dungeonWalkable(state.location,tile,scenery))return null;
 if(state.location==='depthsGate'&&tile.x===8&&!(tile.y===4&&state.depthsRun?.finds?.includes('sluiceLever')))return null;
 const foe=arenaEnemy(e);if(tile.x===foe.x&&tile.y===foe.y)return null;
 const next={...e,arenaPlayer:{x:tile.x,y:tile.y},arenaStepAt:now+240};
 state.position={...next.arenaPlayer};
 return {action:'move',encounter:next,health:state.health,damage:0,taken:0,outcome:'fighting',tile:next.arenaPlayer};
}
