import {reserveWater,wildlifeView} from './wildlife.js';
const {cols,rows}=wildlifeView;
const field={green:['#576e4d','#627a52','#6b8456'],amber:['#8a7847','#998451','#a69158'],ridge:['#4f6462','#566e66','#607870'],reed:['#597d5b','#628768','#6b8c64']};
export function drawReserveGround({point,polygon,surface,block}){
 polygon([point(-.4,-.35,-9),point(cols+.45,-.35,-9),point(cols+.45,rows+.45,-9),point(-.4,rows+.45,-9)],'#111d2d');
 block(0,0,cols,rows,-11,11,['#638252','#293e44','#354d46']);
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
  const pond=reserveWater(x,y),shore=!pond&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>reserveWater(x+dx,y+dy));
  const trail=y===9||x===11&&y>=4&&y<=15||y===4&&x>=11&&x<=15||y===15&&x>=11&&x<=16||x===8&&y>=9&&y<=16;
  const biome=x>=12&&y<9?'ridge':x>=12&&y>10?'amber':x<10&&y>9?'reed':'green';
  const seed=(x*17+y*23+x*y*7)%17;
  const tint=pond?['#3c7687','#427f90','#4b8994'][seed%3]:shore?'#88a385':trail?['#b5a37d','#bda988','#a79775'][seed%3]:field[biome][seed%3];
  surface(x,y,1,1,0,tint,pond?'#578d98':trail?'#9f8f70':'#536c5266');
  if(shore){for(let i=0;i<3;i++)surface(x+.2+i*.14,y+.21+(i%2)*.15,.035,.15,1,'#b8cb7d');}
  else if(trail){surface(x+.19,y+.66,.11,.06,.4,'#e7d2a7');if(seed<4)surface(x+.68,y+.25,.12,.1,.4,'#958570');}
  else if(!pond&&seed<11){
   for(let i=0;i<3;i++)surface(x+.16+i*.14,y+.23+(i%2)*.1,.026,.14,.45,biome==='amber'?'#d1b776':'#95b28a');
   if(seed<3)surface(x+.7,y+.66,.1,.08,.5,biome==='ridge'?'#d7baff':'#eed297');
  }
 }
}
export function drawReserveWater(time,{point,surface,reduced}){
 const phase=reduced?0:time/1750;
 for(let y=11;y<=16;y++)for(let x=2;x<=7;x++)if(reserveWater(x,y)){
  const drift=(phase+x*.18+y*.27)%1;
  surface(x+.08+drift*.35,y+.18,.35,.03,.3,'#aae8df85');
  if((x+y)%3===0)surface(x+.17+(1-drift)*.31,y+.71,.31,.033,.31,'#bce7e497');
 }
}
