export function drawWildBoar(item,time,{point,polygon,rect,surface,reduced,pose}){
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
 const shape=(pts,fill,edge)=>polygon(pts.map(([u,v])=>[px+u,py+v]),fill,edge);
 const ink='#382832',hide=pose.hit?'#bb7966':'#895044',dark='#50333a',light=pose.hit?'#e4a68a':'#b97052';
 const head=(pts,fill,edge)=>shape(pts.map(([u,v])=>[u+reach,v+dip+idle]),fill,edge);
 const feet=attacking?[[-18,4],[-10,-3],[11,-5],[20,1]]:recovering?[[-15,2],[-8,0],[3,2],[14,1]]:[[-15,1],[-8,0],[7,1],[14,0]];

 surface(x-.20,y+.08,1.4,.91,.3,'#27303480');
 if(!reduced&&(attacking||recovering&&age<430)){
  const drift=Math.floor(age/44);
  for(let i=0;i<4;i++)rect(px-14-i*4-drift,py-1+i%2-drift%3,i%2?3:2,2,'#d9b68788');
 }
 for(const [index,[footX,footY]] of feet.entries()){
  const rootX=index<2?-13+index*5:7+(index-2)*5;
  const front=index>=2?dip*.32:0;
  shape([[rootX-4,-14+front],[rootX+4,-13+front],[footX+3,footY-2],[footX+3,footY],[footX-4,footY],[footX-3,footY-3]],index%2?hide:dark,ink);
  rect(px+footX-3,py+footY-2,6,2,'#433338');
 }
 shape([[-20,-13],[-22,-20],[-17,-24],[-9,-27],[2,-28-shoulder],[10,-26-shoulder],[17,-20],[15,-11],[9,-7],[-8,-7],[-16,-9]],hide,ink);
 shape([[-20,-16],[-14,-13],[-6,-12],[6,-15],[13,-13],[9,-7],[-8,-7],[-16,-9]],dark);
 shape([[-19,-20],[-13,-24],[-7,-24],[-10,-18],[-17,-15]],light);
 shape([[-7,-25],[0,-30-shoulder],[1,-26-shoulder],[5,-32-shoulder],[7,-27-shoulder],[11,-30-shoulder],[13,-24],[7,-20],[-3,-21]],'#684044',ink);
 shape([[-20,-19],[-25,-23],[-26,-19],[-23,-16]],'#79504a',ink);
 head([[8,-24],[9,-31],[16,-27],[17,-23]],'#855052',ink);
 head([[9,-27],[11,-28],[14,-25],[11,-24]],'#c58070');
 head([[7,-23],[13,-24],[19,-20],[22,-15],[27,-14],[28,-9],[23,-6],[13,-8],[8,-13]],hide,ink);
 head([[11,-22],[17,-20],[20,-16],[13,-17],[10,-19]],light);
 head([[20,-14],[27,-14],[28,-10],[25,-8],[21,-10]],'#c0907d','#684245');
 head([[20,-9],[23,-8],[26,-10],[26,-13],[28,-11],[27,-7],[23,-5],[20,-6]],'#f4dbb3','#725656');
 rect(px+15+reach,py-18+dip+idle,3,2,pose.defeated?ink:wind>.55?'#ffd587':'#251d27');
 if(!pose.defeated)rect(px+16+reach,py-18+dip+idle,1,1,'#fff2c6');
 rect(px+26+reach,py-12+dip+idle,1,1,'#684245');
}
