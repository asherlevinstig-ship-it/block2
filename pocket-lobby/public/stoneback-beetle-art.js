export const stonebackArtHeight=38;
// Stoneback Beetle: a mossy three-slab dome on stubby legs. It rears before a slam and rolls onto its back when exposed.
export function drawStonebackBeetle(item,time,{point,polygon,rect,surface,reduced,pose,exposed}){
 const {x,y}=item,[px,py]=point(x+.5,y+.5);
 const flipped=!!pose.defeated||!!exposed;
 const wind=flipped?0:pose.windup??0;
 const gilded=item.cacheGuardian===true||item.archetype==='armoured';
 const ink='#1f2b35',hit=pose.hit;
 const stone=hit?'#c9b8a6':gilded?'#a08f72':'#72878a',deep=hit?'#9c8a82':gilded?'#6d5f62':'#52656d',pale=hit?'#f0e2c8':gilded?'#e6cc8c':'#a9bbb2';
 const moss=gilded?'#d9b96a':'#6f9c62',leg='#3c4a55',eye=wind>.4?'#ffb576':'#c9e6a4';
 const shape=(pts,fill,edge)=>polygon(pts.map(([u,v])=>[px+u,py+v]),fill,edge);
 const mark=(u,v,w,h,fill)=>rect(px+u,py+v,w,h,fill);
 surface(x-.22,y-.12,1.44,1.26,.22,'#1c232c80');
 if(flipped){
  const twitch=reduced||pose.defeated?0:Math.round(Math.sin(time/90));
  shape([[-24,-7],[-21,-12],[20,-11],[23,-6],[15,-1],[-16,-1]],deep,ink);
  shape([[-21,-9],[-17,-17],[-6,-21],[8,-20],[17,-15],[20,-8],[12,-4],[-13,-4]],'#a7c98a',ink);
  shape([[-16,-12],[-8,-18],[6,-18],[14,-13],[4,-14],[-7,-14]],'#c9e0a4');
  for(const u of [-9,-1,7])mark(u,-16,1,10,'#6f9068');
  for(const [i,u] of [-14,-6,3,11].entries()){
   const curl=i%2?twitch:-twitch;
   shape([[u-2,-17],[u+2,-17],[u+4+curl,-24],[u+1+curl,-28],[u-1+curl,-23]],leg,ink);
  }
  shape([[16,-9],[23,-10],[26,-6],[22,-3],[17,-4]],deep,ink);
  mark(20,-8,2,2,pose.defeated?ink:'#eddf9c');
  if(!pose.defeated){mark(-2,-13,4,3,'#fff3b8');mark(-1,-14,2,5,'#eddf9c');}
  return;
 }
 const rise=Math.round(wind*7),tilt=Math.round(wind*3);
 const stride=i=>reduced||wind?0:Math.round(Math.sin(time/210+i*2));
 for(const [i,u] of [-7,6].entries())shape([[u-2,-10],[u+3,-10],[u+4,-5+stride(i)],[u,-5+stride(i)]],'#2b3742',ink);
 for(const [i,u] of [-13,-2,10].entries()){
  const s=stride(i+1),front=i===2?rise*.5:0;
  shape([[u-3,-10-front],[u+3,-10-front],[u+6,-4-front],[u+6+s,1],[u+1+s,1],[u+1,-4-front]],leg,ink);
  mark(u+1+s,-1,5,2,'#6a7b7e');
 }
 shape([[-21,-10],[18,-10-tilt],[21,-6-tilt],[14,-3],[-15,-3],[-23,-6]],'#2f3d47',ink);
 const slope=u=>Math.round(tilt*(u+24)/44);
 const dome=pts=>pts.map(([u,v])=>[u,v-slope(u)]);
 shape(dome([[-23,-9],[-24,-17],[-19,-25],[-10,-31],[1,-33],[11,-30],[18,-23],[20,-14],[17,-8],[-18,-7]]),stone,ink);
 shape(dome([[-23,-9],[-24,-17],[-19,-25],[-12,-29],[-10,-18],[-13,-8]]),deep,ink);
 shape(dome([[4,-32],[11,-30],[18,-23],[20,-14],[17,-8],[2,-8],[6,-19]]),deep,ink);
 shape(dome([[-17,-24],[-10,-29],[-2,-31],[-4,-27],[-12,-24]]),pale);
 shape(dome([[6,-30],[11,-28],[15,-23],[10,-25]]),pale);
 shape(dome([[-22,-10],[18,-10],[17,-8],[-18,-7]]),pale);
 shape(dome([[-21,-19],[-16,-25],[-12,-24],[-15,-18]]),moss);
 shape(dome([[-1,-33],[4,-35],[7,-31],[2,-30]]),moss,ink);
 for(const [u,v,w,h] of [[-7,-25,1,4],[-6,-21,1,3],[-8,-18,2,1],[10,-21,1,3],[11,-18,1,2],[-18,-14,3,1],[0,-14,4,1]])mark(u,v-slope(u),w,h,'#33434d');
 for(const [u,v] of [[-14,-13],[-3,-25],[13,-15]])mark(u,v-slope(u),2,1,moss);
 if(gilded){
  shape(dome([[-5,-33],[-1,-40],[3,-33],[-1,-30]]),'#a9edec',ink);mark(-2,-38-Math.round(tilt/2),1,3,'#f2ffff');
  for(const u of [-12,6])mark(u,-12-slope(u),2,4,'#e6cc8c');
 }
 shape([[14,-15-rise],[21,-18-rise],[27,-14-rise],[29,-8-rise],[23,-4-rise*.5],[15,-6]],'#465862',ink);
 shape([[15,-16-rise],[21,-19-rise],[26,-15-rise],[19,-13-rise]],stone,ink);
 mark(21,-12-rise,3,2,eye);mark(22,-12-rise,1,1,'#fffbe0');
 shape([[25,-9-rise],[31,-11-rise-wind*3],[34,-6-rise],[30,-3-rise],[28,-6-rise]],'#ddd6b8',ink);
 shape([[22,-5-rise*.5],[28,-4-rise*.5],[31,0-rise*.3],[27,1-rise*.3],[25,-2-rise*.5]],'#b7b59b',ink);
 if(wind>.5&&!reduced)for(let i=0;i<3;i++)mark(-26-i*3,-2-i*2,2,2,'#d8cdb088');
}
