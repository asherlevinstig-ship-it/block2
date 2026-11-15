export function drawMillbreaker(ctx,{left,hurt,reduced,wind,impact}){
 const ink='#252332',coat=hurt?'#d0a38b':'#79484a',trim='#e1a66b',stone='#8d9695';
 const poly=(points,fill,stroke=ink)=>{
  ctx.beginPath();
  for(const [i,[x,y]] of points.entries())i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  ctx.closePath();ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.2;ctx.stroke();}
 };
 ctx.save();ctx.scale(left?-1:1,1);
 const lift=wind>0?reduced?1:Math.min(1,.38+wind):0;
 const crouch=impact>0?4:Math.round(lift*2);
 poly([[-18,-14],[-6,-14],[-7,-3],[-4,1],[-20,1],[-22,-3]],'#40343d');
 poly([[0,-15],[12,-15],[13,-5],[20,-2],[18,1],[0,1]],'#554049');
 poly([[-21,-33+crouch],[-15,-44+crouch],[2,-46+crouch],[15,-37+crouch],[12,-23],[7,-13],[-12,-13],[-18,-20]],coat);
 poly([[-21,-33+crouch],[-15,-44+crouch],[-7,-43+crouch],[-8,-32],[-17,-27]],'#aa785b');
 poly([[-15,-20],[9,-20],[8,-14],[-12,-14]],'#45353a');
 poly([[-5,-21],[3,-21],[3,-15],[-5,-15]],trim);
 poly([[-3,-45+crouch],[11,-43+crouch],[18,-36+crouch],[15,-29+crouch],[4,-29+crouch],[-4,-36+crouch]],'#6a5555');
 poly([[-3,-44+crouch],[12,-42+crouch],[17,-37+crouch],[4,-38+crouch]],stone);
 poly([[6,-36+crouch],[16,-35+crouch],[15,-33+crouch],[6,-34+crouch]],'#ffe6a2',null);

 const grip=impact>0?[24,-11]:[17+3*lift,-23-25*lift];
 poly([[1,-36+crouch],[7,-40+crouch],[grip[0]+3,grip[1]-4],[grip[0]+5,grip[1]+4],[grip[0]-4,grip[1]+5],[2,-29+crouch]],coat);
 ctx.translate(...grip);
 ctx.rotate(impact>0?1.10:-.38+lift*.28);
 poly([[-2,13],[2,13],[2,-19],[-2,-19]],'#ba8b63');
 poly([[-15,-29],[12,-29],[17,-25],[16,-17],[-14,-16],[-18,-21]],stone);
 poly([[-15,-28],[12,-28],[16,-25],[-13,-24]],'#cbd6cd',null);
 poly([[-12,-24],[-8,-24],[-8,-17],[-12,-17]],trim,null);
 poly([[8,-25],[12,-25],[12,-17],[8,-17]],trim,null);
 ctx.restore();
}
