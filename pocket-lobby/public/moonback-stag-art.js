export const moonbackArtHeight=64;
// Moonback Stag: a tall pale stag with glowing moon marks and a wide crown of antlers. It lowers the crown before a charge.
export function drawMoonbackStag(item,time,{point,polygon,rect,surface,reduced,pose}){
 const {x,y}=item,[px,py]=point(x+.5,y+.5);
 const wind=pose.defeated?0:pose.windup??0,hit=pose.hit;
 const idle=reduced||pose.defeated?0:Math.round(Math.sin(time/470)*1.2);
 const dip=Math.round(wind*13),reach=Math.round(wind*5);
 const ink='#1f2c3d',fur=hit?'#c8d6cf':'#7f948f',shade=hit?'#9db0ad':'#566b72',light=hit?'#f1f7e6':'#bccbb6',ruff=hit?'#ffffff':'#d3dfc8';
 const horn='#efe8c0',hornShade='#b9b18c',glow=wind>.5?'#ffd587':'#e9f9c4';
 const shape=(pts,fill,edge)=>polygon(pts.map(([u,v])=>[px+u,py+v]),fill,edge);
 const body=(pts,fill,edge)=>shape(pts.map(([u,v])=>[u,v+idle]),fill,edge);
 const head=(pts,fill,edge)=>shape(pts.map(([u,v])=>[u+reach,v+dip+idle]),fill,edge);
 const mark=(u,v,w,h,fill)=>rect(px+u,py+v,w,h,fill);
 surface(x-.2,y-.08,1.4,1.16,.2,'#16293776');
 if(!reduced)surface(x-.05,y+.05,1.1,.9,.25,'#c4ecd61c');
 const paw=wind>.3&&!reduced?Math.round(Math.abs(Math.sin(time/120))*4):0;
 shape([[-13,-17+idle],[-9,-17+idle],[-10,-7],[-8,0],[-12,0],[-13,-7]],shade,ink);
 shape([[9,-17+idle],[12,-17+idle],[12,-8],[14,-1],[10,-1],[9,-8]],shade,ink);
 mark(-12,-2,4,2,'#2b3947');mark(10,-3,4,2,'#2b3947');
 shape([[-18,-19+idle],[-11,-20+idle],[-12,-11],[-14,-6],[-12,1],[-16,1],[-18,-6],[-16,-11]],fur,ink);
 shape([[3,-19+idle],[8,-19+idle],[7,-9-paw],[8,1-paw],[4,1-paw],[3,-9-paw]],fur,ink);
 mark(-16,-1,5,2,'#2b3947');mark(4,-1-paw,5,2,'#2b3947');
 body([[-20,-19],[-19,-27],[-12,-31],[0,-30],[9,-32],[14,-27],[13,-19],[7,-15],[-8,-14],[-16,-15]],fur,ink);
 body([[-18,-18],[-8,-17],[7,-18],[12,-20],[7,-15],[-8,-14],[-16,-15]],shade);
 body([[-17,-27],[-11,-30],[0,-29],[8,-30],[2,-26],[-10,-26]],light);
 body([[-20,-26],[-25,-30],[-26,-25],[-21,-22]],ruff,ink);
 body([[-11,-24],[-8,-27],[-4,-25],[-6,-23],[-8,-24]],glow);
 for(const [u,v] of [[-1,-23],[3,-26],[-14,-22],[-4,-20]])mark(u,v+idle,2,2,glow);
 shape([[7,-29+idle],[11+reach*.6,-37+dip*.6+idle],[16+reach,-43+dip+idle],[21+reach,-41+dip+idle],[19+reach*.7,-33+dip*.7+idle],[15,-22+idle],[10,-20+idle]],fur,ink);
 body([[8,-30],[14,-27],[15,-20],[11,-15],[7,-17],[9,-23]],ruff,ink);
 const antler=(dx,dy,fill)=>{
  head([[16+dx,-47+dy],[19+dx,-47+dy],[18+dx,-54+dy],[14+dx,-60+dy],[9+dx,-64+dy],[8+dx,-62+dy],[11+dx,-59+dy],[14+dx,-54+dy]],fill,ink);
  head([[15+dx,-56+dy],[20+dx,-61+dy],[21+dx,-67+dy],[19+dx,-67+dy],[17+dx,-61+dy],[14+dx,-58+dy]],fill,ink);
  head([[11+dx,-60+dy],[13+dx,-67+dy],[11+dx,-71+dy],[10+dx,-66+dy],[9+dx,-62+dy]],fill,ink);
  head([[17+dx,-50+dy],[23+dx,-53+dy],[25+dx,-57+dy],[22+dx,-56+dy],[18+dx,-53+dy]],fill,ink);
 };
 antler(6,2,hornShade);
 head([[15,-45],[11,-50],[13,-43]],fur,ink);
 head([[14,-44],[19,-47],[24,-45],[29,-40],[30,-37],[27,-35],[21,-36],[16,-38]],fur,ink);
 head([[24,-41],[29,-40],[30,-37],[27,-35],[23,-37]],ruff);
 antler(0,0,horn);
 mark(29+reach,-39+dip+idle,2,2,'#2b3947');
 mark(20+reach,-43+dip+idle,2,2,pose.defeated?ink:glow);
 if(!pose.defeated&&!reduced){mark(11+reach,-70+dip+idle,1,1,'#fbffe4');mark(20+reach,-66+dip+idle,1,1,'#fbffe4');mark(25+reach,-56+dip+idle,1,1,'#fbffe4');}
}
