export function boarArtHeight(item){
 if(item.type!=='wildboar')return null;
 if(item.trackedPrey)return 26;
 return item.room==='thornwood'?40:item.room==='brokenRoad'?36:34;
}
const hides={
 wild:{ink:'#382832',hide:'#895044',dark:'#50333a',light:'#b97052',mane:'#684044'},
 thorn:{ink:'#292b30',hide:'#7c8150',dark:'#41493a',light:'#aba765',mane:'#454636'},
 dusk:{ink:'#29202f',hide:'#765062',dark:'#473047',light:'#a96f83',mane:'#533648'}
};
export function drawWildBoar(item,time,{point,polygon,rect,surface,reduced,pose}){
 const variant=item.trackedPrey?'dusk':item.room==='thornwood'?'thorn':'wild';
 const thorn=variant==='thorn',dusk=variant==='dusk';
 const width=thorn?1.10:dusk?1.08:1,height=thorn?1.06:dusk?.78:1;
 const {ink,dark,mane,hide:coat,light:highlight}=hides[variant];
 const {x,y}=item,[px,py]=point(x+.5,y+.5);
 const wind=pose.defeated?0:pose.windup??0;
 const age=pose.attackAge??Infinity;
 const attacking=!pose.defeated&&!pose.staggered&&age>=0&&age<240;
 const recovering=!pose.defeated&&!pose.staggered&&age>=240&&age<620;
 const fatigue=recovering?(620-age)/380:0;
 const dip=Math.round(wind*8+(attacking?4:fatigue*2));
 const reach=attacking?5:wind>.45?-2:0;
 const idle=!reduced&&!pose.defeated&&!attacking&&!recovering?Math.round(Math.sin(time/430)*.8):0;
 const shoulder=Math.round(wind*2-fatigue*3);
 const shape=(pts,fill,edge)=>polygon(pts.map(([u,v])=>[px+u*width,py+v*height]),fill,edge);
 const mark=(u,v,w,h,fill)=>rect(px+u*width,py+v*height,w,h,fill);
 const hide=pose.hit?'#bb7966':coat,light=pose.hit?'#e4a68a':highlight;
 const head=(pts,fill,edge)=>shape(pts.map(([u,v])=>[u+reach,v+dip+idle]),fill,edge);
 const feet=attacking?[[-18,4],[-10,-3],[11,-5],[20,1]]:recovering?[[-15,2],[-8,0],[3,2],[14,1]]:[[-15,1],[-8,0],[7,1],[14,0]];

 surface(x-.20,y+.08,thorn?1.55:1.4,.91,.3,'#27303480');
 if(!reduced&&(attacking||recovering&&age<430)){
  const drift=Math.floor(age/44);
  for(let i=0;i<4;i++)rect(px-14-i*4-drift,py-1+i%2-drift%3,i%2?3:2,2,'#d9b68788');
 }
 for(const [index,[footX,footY]] of feet.entries()){
  const rootX=index<2?-13+index*5:7+(index-2)*5;
  const front=index>=2?dip*.32:0;
  shape([[rootX-4,-14+front],[rootX+4,-13+front],[footX+3,footY-2],[footX+3,footY],[footX-4,footY],[footX-3,footY-3]],index%2?hide:dark,ink);
  mark(footX-3,footY-2,thorn?7:6,2,dark);
 }
 const back=thorn?[[-23,-13],[-23,-22],[-17,-28],[-8,-30],[5,-31-shoulder],[15,-27],[20,-20],[17,-10],[9,-6],[-12,-7]]
  :dusk?[[-22,-13],[-24,-22],[-18,-25],[-8,-24],[4,-27-shoulder],[14,-24],[18,-19],[13,-12],[8,-8],[-7,-10],[-16,-9]]
  :[[-20,-13],[-22,-20],[-17,-24],[-9,-27],[2,-28-shoulder],[10,-26-shoulder],[17,-20],[15,-11],[9,-7],[-8,-7],[-16,-9]];
 shape(back,hide,ink);
 shape([[-20,-16],[-14,-13],[-6,-12],[6,-15],[13,-13],[9,-7],[-8,-7],[-16,-9]],dark);
 shape([[-19,-20],[-13,-24],[-7,-24],[-10,-18],[-17,-15]],light);
 if(thorn){
  shape([[-22,-22],[-18,-30],[-20,-35],[-13,-31],[-11,-37],[-5,-30],[-1,-33],[3,-39],[7,-34],[12,-37],[13,-28],[19,-25],[10,-23],[-6,-24]],'#4d5f3b',ink);
  shape([[-21,-25],[-12,-27],[-4,-32],[5,-30],[13,-33],[15,-30],[5,-27],[-3,-28],[-11,-24]],'#a58263');
  shape([[-14,-29],[-15,-35],[-10,-31],[-8,-29]],'#8d9c60');
  shape([[4,-31],[5,-37],[9,-33],[9,-31]],'#a4a66b');
  for(const [u,v] of [[-8,-27],[0,-31],[12,-27]])mark(u,v,2,2,'#b65d54');
 }else if(dusk)shape([[-19,-22],[-15,-27],[-6,-25],[5,-29-shoulder],[15,-25],[9,-22],[-7,-22]],mane,ink);
 else shape([[-7,-25],[0,-30-shoulder],[1,-26-shoulder],[5,-32-shoulder],[7,-27-shoulder],[11,-30-shoulder],[13,-24],[7,-20],[-3,-21]],mane,ink);
 shape([[-20,-19],[-25,-23],[-26,-19],[-23,-16]],'#79504a',ink);
 head([[8,-24],[9,-31],[16,-27],[17,-23]],'#855052',ink);
 head([[9,-27],[11,-28],[14,-25],[11,-24]],'#c58070');
 head([[7,-23],[13,-24],[19,-20],[22,-15],[27,-14],[28,-9],[23,-6],[13,-8],[8,-13]],hide,ink);
 head([[11,-22],[17,-20],[20,-16],[13,-17],[10,-19]],light);
 head([[20,-14],[27,-14],[28,-10],[25,-8],[21,-10]],'#c0907d','#684245');
 if(dusk){
  head([[22,-12],[28,-14],[33,-20],[33,-16],[30,-11],[25,-9]],'#c0a393','#584352');
  head([[19,-9],[24,-8],[29,-10],[34,-17],[36,-18],[35,-12],[31,-6],[25,-4],[20,-6]],'#f6dfbf','#725656');
 }else head([[20,-9],[23,-8],[26,-10],[26,-13],[28,-11],[27,-7],[23,-5],[20,-6]],'#f4dbb3','#725656');
 mark(15+reach,-18+dip+idle,3,2,pose.defeated?ink:wind>.55?'#ffd587':'#251d27');
 if(!pose.defeated)mark(16+reach,-18+dip+idle,1,1,'#fff2c6');
 mark(26+reach,-12+dip+idle,1,1,'#684245');
}
