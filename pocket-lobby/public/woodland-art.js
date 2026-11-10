const palettes=[
 {shadow:'#193c39',body:'#285b4c',lit:'#3b7861',tip:'#60947b',bark:'#715d50'},
 {shadow:'#243943',body:'#35565a',lit:'#47726c',tip:'#7ca48a',bark:'#918376'},
 {shadow:'#283d47',body:'#335961',lit:'#49797b',tip:'#6f9c91',bark:'#796057'}
];

export function drawWoodlandTree(x,y,{point,polygon,surface,block,rect}){
 const variant=(x*7+y*5)%3,p=palettes[variant],[px,py]=point(x+.5,y+.5);
 const poly=(pts,fill,edge)=>polygon(pts.map(([a,b])=>[px+a,py+b]),fill,edge);
 const bark=(u,v,w,d,z,h)=>block(x+u,y+v,w,d,z,h,[p.bark,'#493f42','#5f4c46']);
 surface(x-.15,y+.08,1.38,.97,.1,'#14273566');
 surface(x+.19,y+.29,.75,.61,.2,'#14282c66');
 bark(.38,.4,.23,.24,0,26);bark(.24,.45,.26,.12,0,3);bark(.46,.34,.3,.13,0,4);
 poly([[-5,-4],[-4,-24],[1,-31],[3,-22],[0,-3]],p.bark,'#4a4244');
 if(variant===1){
  poly([[-5,-22],[-15,-33],[-12,-37],[-2,-29],[9,-39],[13,-37],[4,-24]],'#7b7065');
  for(let i=0;i<4;i++)rect(px-4+(i%2)*2,py-5-i*5,4,1,'#b1a093');
 }
 if(variant===2){
  // Offset tiers and broken edges give the pine a distinct profile at game scale.
  for(const [top,width,shift] of [[-36,23,0],[-44,19,-2],[-53,13,1]]){
   poly([[shift,top],[shift+width*.63,top+13],[shift+width,top+18],[shift+width*.58,top+21],[shift-3,top+19],[shift-width*.72,top+22],[shift-width,top+18],[shift-width*.5,top+13]],p.shadow);
   poly([[shift-1,top+2],[shift+width*.42,top+13],[shift+width*.1,top+16],[shift-width*.56,top+18],[shift-width*.77,top+17]],p.body);
   poly([[shift-1,top+2],[shift+2,top+7],[shift-3,top+9],[shift-width*.5,top+15],[shift-width*.72,top+16]],p.lit);
  }
 }else{
  const clumps=variant===0?[[-13,-31,13],[12,-32,15],[-5,-40,16],[4,-30,15]]:[[-13,-32,12],[14,-39,12],[-3,-42,15],[6,-28,13]];
  for(const [a,b,r] of clumps){
   poly([[a-r,b+1],[a-r*.7,b-r*.59],[a-r*.22,b-r*.8],[a+r*.54,b-r*.61],[a+r,b-r*.12],[a+r*.76,b+r*.55],[a+r*.28,b+r*.77],[a-r*.6,b+r*.55]],p.shadow);
   poly([[a-r*.83,b],[a-r*.54,b-r*.59],[a-r*.1,b-r*.7],[a+r*.52,b-r*.52],[a+r*.76,b-r*.14],[a+r*.22,b+r*.3],[a-r*.5,b+r*.32]],p.body);
   poly([[a-r*.74,b-r*.12],[a-r*.47,b-r*.53],[a-r*.1,b-r*.64],[a+r*.34,b-r*.47],[a+r*.11,b-r*.25],[a-r*.34,b-r*.22]],p.lit);
  }
 }
 for(let i=0;i<7;i++){
  const a=(i*13+x*5+y*3)%29-15,b=-23-(i*11+x+y)%20;
  if(variant!==2||Math.abs(a)<12)rect(px+a,py+b,i%2?2:3,1,i%3?p.lit:p.tip);
 }
}

export function drawWoodlandRock(x,y,{point,polygon,surface}){
 const [px,py]=point(x+.5,y+.5),h=9+(x*3+y*7)%7;
 const poly=(p,fill,edge)=>polygon(p.map(([a,b])=>[px+a,py+b]),fill,edge);
 surface(x+.05,y+.2,.96,.69,.2,'#172b3277');
 poly([[-14,-3],[-11,-h+2],[-4,-h-2],[7,-h],[13,-5],[8,1],[-6,3]],'#4d5268','#313e4c');
 poly([[-11,-h+2],[-4,-h-2],[7,-h],[10,-h+4],[1,-h+7],[-7,-h+6]],'#838a9c');
 poly([[-10,-h+4],[-4,-h+7],[1,-h+7],[-3,0],[-10,-2]],'#646f82');
 poly([[1,-h+6],[7,-h+4],[11,-5],[5,-4],[4,-h+8]],'#719285');
}
