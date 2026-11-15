export const custodianArtHeight=57;
// Clockwork Custodian: a brass barrel automaton with a wound key, a clamp arm and a piston hammer it raises before striking.
// Draws around the origin; the caller places, fades and squashes it.
export function drawClockworkCustodian(ctx,time,{pose={},reduced=false}){
 const hit=pose.hit,wind=pose.defeated?0:pose.windup??0;
 const b=reduced||pose.defeated?0:Math.round(Math.sin(time/240));
 const ink='#1b252e',brass=hit?'#fff0bf':'#b08a52',brassDark=hit?'#e0c890':'#7f6240',brassLight=hit?'#ffffff':'#dcbf85',steel=hit?'#e9edea':'#5d6b73',steelDark='#3a4650';
 const core=hit?'#fff4d0':wind>.5?'#ffcf8a':'#8dd6ce',eye=pose.defeated?'#33434d':wind>.5?'#ffb86b':'#9ee8db';
 const poly=(pts,fill,edge)=>{ctx.beginPath();pts.forEach(([u,v],i)=>i?ctx.lineTo(Math.round(u),Math.round(v)):ctx.moveTo(Math.round(u),Math.round(v)));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(edge){ctx.strokeStyle=edge;ctx.lineWidth=1;ctx.stroke();}};
 const r=(a,c,w,h,fill)=>{ctx.fillStyle=fill;ctx.fillRect(Math.round(a),Math.round(c),w,h);};
 r(-16,-3,32,5,'#13232b66');
 poly([[-11,-10],[-4,-10],[-3,0],[-12,0]],steelDark,ink);poly([[4,-10],[11,-10],[12,0],[3,0]],steelDark,ink);
 r(-11,-3,8,2,'#6a7b7e');r(4,-3,8,2,'#6a7b7e');
 poly([[-10,-14+b],[10,-14+b],[8,-8],[-8,-8]],'#5a4a44',ink);
 const turn=reduced||pose.defeated?0:Math.floor(time/190)%2;
 r(-19,-27+b,6,2,brassLight);
 if(turn){r(-23,-31+b,3,10,brass);r(-23,-31+b,3,1,brassLight);}else{r(-25,-28+b,6,4,brass);r(-25,-28+b,6,1,brassLight);}
 poly([[-19,-33+b],[-13,-34+b],[-13,-26+b],[-19,-26+b]],steel,ink);
 poly([[-20,-26+b],[-14,-26+b],[-15,-15+b],[-20,-15+b]],steelDark,ink);
 poly([[-22,-15+b],[-18,-15+b],[-19,-10+b],[-22,-11+b]],brass,ink);poly([[-16,-15+b],[-13,-15+b],[-13,-10+b],[-16,-11+b]],brass,ink);
 poly([[-14,-31+b],[-9,-35+b],[9,-35+b],[14,-31+b],[13,-14+b],[8,-11+b],[-8,-11+b],[-13,-14+b]],brass,ink);
 poly([[-14,-31+b],[-9,-35+b],[-8,-11+b],[-13,-14+b]],brassDark);
 poly([[-7,-34+b],[8,-34+b],[9,-31+b],[-6,-31+b]],brassLight);
 for(const [u,v] of [[-11,-29],[11,-29],[-10,-16],[10,-16]])r(u,v+b,1,1,'#3d3026');
 poly([[-5,-29+b],[5,-29+b],[7,-26+b],[7,-19+b],[5,-16+b],[-5,-16+b],[-7,-19+b],[-7,-26+b]],'#1f3138',ink);
 if(!pose.defeated){
  const pulse=reduced?0:Math.round(Math.sin(time/300));
  poly([[0,-28+b],[5+pulse,-22+b],[0,-17+b],[-5-pulse,-22+b]],core);r(-1,-25+b,2,5,'#f2fff8');
 }
 const lift=Math.round(wind*13),age=pose.attackAge??Infinity,slam=age>=0&&age<220&&!pose.defeated?4:0;
 poly([[12,-35+b],[19,-34+b],[20,-27+b],[13,-26+b]],steel,ink);
 poly([[14,-27+b-lift*.4],[20,-27+b-lift*.4],[21,-14+b-lift+slam],[15,-14+b-lift+slam]],steelDark,ink);
 poly([[10,-16+b-lift+slam],[26,-16+b-lift+slam],[27,-6+b-lift+slam],[9,-6+b-lift+slam]],'#b7ac86',ink);
 poly([[10,-16+b-lift+slam],[26,-16+b-lift+slam],[26,-13+b-lift+slam],[10,-13+b-lift+slam]],'#dcd4b0');
 r(16,-13+b-lift+slam,4,7,brass);
 poly([[-8,-37+b],[-8,-44+b],[-4,-49+b],[4,-49+b],[8,-44+b],[8,-37+b]],steel,ink);
 poly([[-6,-45+b],[-3,-48+b],[3,-48+b],[1,-45+b]],'#8a989c');
 r(-9,-45+b,18,3,brass);r(-9,-45+b,18,1,brassLight);
 r(-6,-41+b,12,3,'#18242e');r(-4,-41+b,3,2,eye);r(2,-41+b,3,2,eye);
 r(-1,-53+b,2,4,steelDark);r(-2,-56+b,4,3,wind>.5?'#ffb86b':'#d9655a');
 if(wind>.45&&!reduced)for(let i=0;i<3;i++){const t=(time/260+i/3)%1;r(-6+i*5,-58+b-t*8,2,2,'rgba(232,238,230,'+(.6-t*.6).toFixed(2)+')');}
}
