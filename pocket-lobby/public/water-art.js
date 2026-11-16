// Shared water bed. Every pond and river is painted as one seamless body, pale in the shallows
// along the bank and darker toward open water, so no tile grid shows through the surface.
const channel=(hex,i)=>parseInt(hex.slice(1+i*2,3+i*2),16);
export function mixColor(from,to,amount){
 const t=Math.max(0,Math.min(1,amount));
 return '#'+[0,1,2].map(i=>Math.round(channel(from,i)+(channel(to,i)-channel(from,i))*t).toString(16).padStart(2,'0')).join('');
}
// Distance in tiles from a point to the nearest dry tile. The map edge counts as open water.
export function shoreDistance(cols,rows,wet){
 const land=[];
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(!wet(x,y))land.push([x,y]);
 return (u,v)=>{
  let best=Infinity;
  for(const [x,y] of land){
   const gap=Math.hypot(Math.max(x-u,0,u-x-1),Math.max(y-v,0,v-y-1));
   if(gap<best)best=gap;
  }
  return best;
 };
}
// reach: how far from the bank the water reaches full depth, in tiles. The bed is drawn in quarter-tile
// cells that overlap slightly, and the depth is banded so the contours read as pixel art, not a gradient.
export function drawWaterTile({x,y,distance,surface,z=0,shallow,deep,reach=2.6,cells=4,bands=6}){
 const size=1/cells;
 for(let j=0;j<cells;j++)for(let i=0;i<cells;i++){
  const depth=Math.min(1,distance(x+(i+.5)*size,y+(j+.5)*size)/reach);
  surface(x+i*size-.012,y+j*size-.012,size+.024,size+.024,z,mixColor(shallow,deep,Math.round(depth*bands)/bands));
 }
}
export function drawWaterBed({cols,rows,wet,...tile}){
 const distance=shoreDistance(cols,rows,wet);
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(wet(x,y))drawWaterTile({x,y,distance,...tile});
}
