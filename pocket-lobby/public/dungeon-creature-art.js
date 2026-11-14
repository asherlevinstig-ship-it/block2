import {guardianCue} from './dungeon-guardian-art.js';

// These poses use the encounter's attack clock; they never move the enemy's tile.
export function drawDungeonCreature(type,time,{ctx,px,py,polygon,rect,reduced,pose={},combat}){
 const cue=guardianCue(combat,pose,time,reduced);
 const wind=cue.gesture&&!cue.release?cue.strength:0;
 const release=cue.release?cue.strength:0;
 const dead=!!pose.defeated,death=dead?(reduced?1:pose.death??1):0;
 const hit=pose.hit,ink='#142c39';
 const poly=(points,c,edge)=>polygon(points.map(([x,y])=>[Math.round(px+x),Math.round(py+y)]),c,edge);
 const pixel=(x,y,w,h,c)=>rect(Math.round(px+x),Math.round(py+y),w,h,c);
 const line=(points,c,width=1)=>{
  ctx.strokeStyle=c;ctx.lineWidth=width;ctx.beginPath();
  points.forEach(([x,y],i)=>i?ctx.lineTo(Math.round(px+x),Math.round(py+y)):ctx.moveTo(Math.round(px+x),Math.round(py+y)));ctx.stroke();
 };
 if(type==='depthsSkitter'){
  const shell=hit?'#f3ceae':'#468c83',light=hit?'#fff0ce':'#b1d5ad',dark='#244e57';
  const crouch=reduced?0:wind*5,leap=reduced?0:release*7;
  const lift=dead?death*9:crouch-leap;
  const body=(points,c,edge)=>poly(points.map(([x,y])=>[x,y+lift]),c,edge);
  // Wide hooked legs make a low silhouette; planted feet brace during the tell.
  for(const side of [-1,1])for(let i=0;i<3;i++){
   const stride=reduced||wind||dead?0:Math.sin(time/160+i*2)*1.4;
   const spread=dead?death*7:wind*5,root=side*(6+i*2),k=-14+i*5;
   const knee=side*(19+i*2+spread),foot=side*(26+i*2+spread);
   poly([[root,k+lift],[knee,k-8+stride],[foot,k+5],[foot-2*side,k+8],[knee-3*side,k-3+stride],[root,k+4+lift]],dark,ink);
   line([[root,k+lift],[knee,k-6+stride],[foot,k+5]],shell,2);
   pixel(foot-1,k+5,3,2,light);
  }
  body([[-19,-14],[-17,-24],[-8,-31],[4,-32],[15,-25],[19,-15],[12,-7],[-6,-6]],dark,ink);
  body([[-17,-20],[-11,-28],[0,-31],[12,-26],[16,-20],[8,-15],[-5,-13]],shell,ink);
  body([[-13,-23],[-7,-28],[0,-29],[3,-26],[-4,-22],[-11,-20]],light);
  // Interlocking chitin ribs, pale spines and amber sensory nodes.
  for(let i=0;i<3;i++){
   const x=-8+i*7;
   body([[x,-28],[x+3,-27],[x+5,-21],[x+1,-15],[x-2,-16],[x+1,-22]],dark);
   body([[x,-28],[x+1,-33],[x+4,-27]],light,ink);
   pixel(x,-12+lift,2,2,'#b9c77a');
  }
  body([[9,-20],[18,-19],[24,-13],[22,-6],[15,-3],[9,-8]],dark,ink);
  body([[12,-19],[18,-18],[22,-14],[14,-13]],shell);
  if(dead){line([[14,-12+lift],[18,-8+lift]],'#718b80',2);line([[18,-12+lift],[14,-8+lift]],'#718b80',2);}
  else{pixel(14,-13+lift,3,3,wind?'#ffbb68':'#f3e59d');pixel(20,-12+lift,2,2,'#fff2bc');}
  const jaw=dead?0:wind*4;
  body([[19,-7],[25,-10-jaw],[30,-5-jaw],[27,0-jaw],[27,-4-jaw],[20,-3]],'#d7c89e',ink);
  body([[14,-5],[20,-1],[22,4+jaw],[18,5+jaw],[18,1+jaw],[12,-2]],'#a2bba3',ink);
  if(wind&&!reduced)line([[-18,-33],[-21,-38],[-17,-40]],'#efc77d',1);
  if(release&&!reduced)for(let i=0;i<3;i++)line([[-31-i*3,-16+i*6],[-23-i*3,-16+i*6]],'#9dcfb2');
  return;
 }
 // Rune Channeler: an empty hood, floating shoulder shards and suspended hands.
 const float=reduced?0:Math.sin(time/610)*2;
 const z=dead?death*14:float+(reduced?0:wind*5);
 const robe=hit?'#d9bfdc':'#71639f',light=hit?'#fff0df':'#b6a5df';
 const rune=dead?'#615f83':hit?'#fff4de':'#c6e6ff';
 const body=(points,c,edge)=>poly(points.map(([x,y])=>[x,y-z]),c,edge);
 if(!dead){
  for(let i=0;i<5;i++){
   const x=-13+i*6,sway=reduced?0:Math.sin(time/460+i)*2;
   body([[x,-26],[x+7,-25],[x+5+sway,-7+(i%2)*4],[x+1+sway,-11]],i%2?'#363956':'#514879',ink);
  }
  body([[-16,-26],[-12,-43],[0,-55],[13,-43],[17,-26],[7,-19],[-6,-20]],robe,ink);
  body([[-9,-40],[0,-51],[9,-40],[7,-29],[-6,-29]],'#17263e',ink);
  body([[-12,-42],[0,-56],[13,-42],[8,-42],[0,-49],[-7,-39]],light);
  pixel(-5,-38-z,3,2,'#d4eeff');pixel(3,-38-z,3,2,'#d4eeff');
  body([[-2,-28],[3,-28],[2,-15],[-1,-12],[-4,-22]],'#d4ba82',ink);
  body([[0,-25],[3,-21],[0,-17],[-3,-21]],rune);
  for(const side of [-1,1]){
   body([[side*12,-45],[side*23,-41],[side*18,-31],[side*12,-34]],'#484369',ink);
   line([[side*14,-43-z],[side*20,-40-z],[side*17,-35-z]],'#ccb587');
   const hx=side*(23-wind*8+release*6),hy=-26-z-wind*6;
   poly([[hx-4,hy-3],[hx+3,hy-4],[hx+5,hy+2],[hx,hy+5],[hx-4,hy+2]],light,ink);
  }
 }
 // Runes close into a spell above the hands, then burst outward at release.
 const spread=dead?18+death*22:release?18+release*18:26-wind*13;
 for(let i=0;i<5;i++){
  const a=i/5*Math.PI*2+(reduced?0:time/3000),x=Math.cos(a)*spread,y=-31-z+Math.sin(a)*spread*.5;
  const size=dead?2:wind?3:2;
  line([[x-size,y+size],[x-size,y-size],[x+size,y-size],[x+size,y],[x,y],[x,y+size]],rune,1);
  if(wind)line([[x,y],[x*.35,-35-z]],'#8d82b57a');
 }
 if(wind||release){
  const r=wind?5+wind*4:3+release*8;
  poly([[0,-35-z-r],[r,-35-z],[0,-35-z+r],[-r,-35-z]],'#8579b9',rune);
  pixel(-1,-38-z,2,6,'#f4f4ff');
 }
 if(dead)for(let i=0;i<4;i++){
  const x=(i-1.5)*(8+death*8),y=-18-z+(i%2)*7;
  poly([[x-4,y-5],[x+5,y-2],[x+2,y+7],[x-3,y+3]],i%2?robe:'#363956',ink);
 }
}
