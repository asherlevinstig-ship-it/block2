export const autoWalkStepMs=200;

export function autoWalkPosition(walk,now){
 const {tiles,startedAt}=walk;
 const progress=Math.max(0,Math.min(tiles.length-1,(now-startedAt)/autoWalkStepMs));
 const index=Math.floor(progress),tile=tiles[index],next=tiles[index+1];
 const from=next?tile:tiles[index-1]??tile,to=next??tile;
 const dx=to.x-from.x,dy=to.y-from.y,fraction=progress-index;
 return {
  x:tile.x,y:tile.y,rx:tile.x+dx*fraction,ry:tile.y+dy*fraction,
  direction:dx-dy>=0?'right':'left',back:dx+dy<0,moving:!!next,
 };
}
