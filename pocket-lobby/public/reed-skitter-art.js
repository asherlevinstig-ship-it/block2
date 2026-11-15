export function drawReedSkitter(ctx,{hurt,reduced,wind,pounce,time}){
 const outline='#132d39',shell=hurt?'#f2cb9a':'#3d7870',highlight=hurt?'#ffebbd':'#86c5a0';
 const crouch=wind>0?Math.round(2+wind*4):0;
 const lift=pounce>0&&!reduced?Math.round(7*Math.sin(Math.PI*pounce)):0;
 const body=crouch-lift;
 function poly(points,fill,edge){
  ctx.beginPath();
  for(const [i,[x,y]] of points.entries())i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  ctx.closePath();ctx.fillStyle=fill;ctx.fill();
  if(edge){ctx.strokeStyle=edge;ctx.lineWidth=1;ctx.stroke();}
 }
 for(const side of [-1,1]){
  for(let i=0;i<3;i++){
   const spread=pounce>0?4:wind>0?-3:0;
   const twitch=reduced||wind||pounce?0:Math.round(Math.sin(time/185+i+side));
   const joint=18+i*2+spread,foot=22+i*2+spread;
   const y=-17+i*6;
   poly([[side*8,y+body],[side*joint,y-5-lift+twitch],[side*foot,y+6-lift],[side*(foot-5),y+5-lift],[side*(joint-4),y+body-1]],i===1?'#64a08c':'#477d73',outline);
  }
 }
 poly([[-15,-11+body],[-15,-19+body],[-9,-25+body],[2,-27+body],[12,-22+body],[16,-14+body],[10,-6+body],[-10,-6+body]],shell,outline);
 poly([[-12,-19+body],[-7,-24+body],[2,-25+body],[11,-21+body],[5,-18+body],[-5,-17+body]],highlight);
 poly([[-9,-11+body],[-5,-15+body],[6,-15+body],[11,-10+body],[8,-4+body],[-7,-4+body]],'#244f54',outline);
 const eye=wind>.55?'#fff1a6':'#eab976';
 ctx.fillStyle=eye;ctx.fillRect(-6,-10+body,3,2);ctx.fillRect(4,-10+body,3,2);
 for(const side of [-1,1]){
  const tip=pounce>0?9:6;
  poly([[side*7,-8+body],[side*tip,-2+body],[side*3,1+body],[side*4,-4+body]],'#d6dbc0',outline);
 }
}
