export const crystaldeepArea={number:'22',name:'Crystaldeep Tunnels',description:'Mining 3 · Copper Pickaxe or better. Outer copper veins are quiet; the Shardback Guardian protects rich iron. Fight it, use Veilstep, or retreat to the quarry.',badge:'DANGEROUS MINING',floor:'Crystal cavern',center:[4,5],palette:['#242d46','#344361','#526c81'],authored:[['crystalCluster',1,1],['crystalCluster',5,1],['crystalCluster',10,1],['crystalCluster',10,8],['crystalCluster',2,8],['pillar',4,3],['pillar',3,6],['crystalGuardian',6,5]]};
export function drawCrystaldeepGround({block,surface,point,polygon}){
 const stone=['#3a4561','#1a2035','#252e46'];
 for(let x=0;x<12;x++)for(let y=0;y<10;y++){
  surface(x+.07,y+.07,.86,.86,.12,(x+y*3)%5===0?'#3f4e6c':'#2a354e','#202b42');
  if((x*3+y*7)%9===0)surface(x+.22,y+.47,.4,.025,.3,'#6ca0ba');
 }
 for(const [x,y,w,d,h] of [[0,-.35,5,.35,38],[6,-.35,6,.35,49],[12,0,.4,4,42],[12,6,.4,4,34]])block(x,y,w,d,0,h,stone);
 const [x,y]=point(6.5,5.5,.5);polygon([[x-35,y],[x,y-18],[x+35,y],[x,y+18]],'#2f465b','#547d91');
 for(let n=0;n<3;n++)surface(8.2+n*.8,1.1,.025,2.2,.4,'#7191aa55');
}
export function drawMineMouth({block,point,polygon,rect}){
 const [x,y]=point(9.5,.5);
 polygon([[x-23,y+3],[x-23,y-29],[x-13,y-45],[x+13,y-45],[x+23,y-29],[x+23,y+3]],'#111c2f','#63869a');
 for(const dx of [-.45,.4])block(9.5+dx,.22,.16,.65,0,37,['#997855','#493e3b','#735b49']);
 rect(x-23,y-39,46,6,'#a98760');rect(x-16,y-29,3,4,'#b4f0ff');rect(x+13,y-24,3,4,'#bb9af3');
}
export function drawCrystalAtmosphere(time,{point,ctx,reduced}){
 if(reduced)return;
 ctx.save();
 for(let i=0;i<17;i++){
  const t=(time/6500+i*.137)%1,[x,y]=point(1+(i*7%10),1+(i*3%8),8+t*32);
  ctx.globalAlpha=Math.sin(t*Math.PI)*.5;ctx.fillStyle=i%3?'#a8dded':'#b59de9';ctx.fillRect(Math.round(x+Math.sin(t*5+i)*5),Math.round(y),i%4===0?2:1,2);
 }
 ctx.restore();
}
export function drawCrystalProp(item,time,{point,polygon,rect,ctx,reduced,pose={}}){
 const [x,y]=point(item.x+.5,item.y+.5),pulse=reduced?0:Math.sin(time/850)*.13;
 const crystal=(dx,dy,size,color)=>{
  polygon([[x+dx,y+dy-size],[x+dx+size*.35,y+dy-size*.55],[x+dx+size*.2,y+dy],[x+dx-size*.22,y+dy],[x+dx-size*.35,y+dy-size*.55]],color,'#a8e5ef');
  polygon([[x+dx,y+dy-size],[x+dx+size*.04,y+dy-size*.25],[x+dx+size*.2,y+dy],[x+dx+size*.35,y+dy-size*.55]],'#c8f4ff88');
 };
 ctx.save();ctx.globalAlpha=.16+pulse*.3;ctx.fillStyle='#77c9ea';ctx.beginPath();ctx.ellipse(x,y,27,12,0,0,Math.PI*2);ctx.fill();ctx.restore();
 if(item.type==='crystalCluster'){
  crystal(-9,0,23,'#6685bf');crystal(6,-2,38,'#73c9df');crystal(15,4,18,'#a38bd7');return;
 }
 const wind=pose.windup??0,hit=pose.hit,body=hit?'#e9d8cf':'#4d6580';
 polygon([[x-14,y-10],[x-18,y-29-wind*4],[x-6,y-42],[x+9,y-40],[x+18,y-25-wind*4],[x+13,y-9]],body,'#202d47');
 polygon([[x-14,y-29],[x-6,y-42],[x+9,y-40],[x+3,y-23]],'#8099a6');
 for(const side of [-1,1]){
  polygon([[x+side*11,y-26],[x+side*(23+wind*5),y-24-wind*12],[x+side*(25+wind*5),y-13-wind*12],[x+side*13,y-9]],body,'#202d47');
  rect(x+side*8-3,y-12,7,13,'#697e90');
 }
 crystal(-10,-31,18,'#89c6ed');crystal(3,-38,23,'#a390eb');crystal(12,-28,17,'#79d1d9');
 rect(x-6,y-30,4,3,wind>.3?'#ffcb8e':'#e0fbff');rect(x+3,y-30,4,3,wind>.3?'#ffcb8e':'#e0fbff');
 crystal(0,-10,12,'#95d8f3');
}

