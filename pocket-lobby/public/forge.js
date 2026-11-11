import {pickaxes,miningLevel,miningFinds} from './mining.js';
export const quarryForge={x:9,y:7};
export const barProducts={
 copperBar:{name:'Copper Bar',ore:'copperOre',oreName:'Copper Ore',amount:3,level:1,price:18,icon:'▰',group:'materials',color:'#dfaa77'},
 ironBar:{name:'Iron Bar',ore:'ironOre',oreName:'Iron Ore',amount:3,level:3,price:30,icon:'▰',group:'materials',color:'#b7cedb'}
};
export function barArt(id){
 const color=barProducts[id].color;
 return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="m10 39 8-20 30-4 9 20-30 13z" fill="'+color+'" stroke="#344858" stroke-width="2"/><path d="m18 19 12 16 27 0M30 35l-3 13" fill="none" stroke="#f0e6ce" stroke-width="2"/><path d="m10 39 20-4-3 13z" fill="#674f4c" opacity=".4"/></svg>';
}
export const pickaxeIngredients=id=>({[pickaxes[id].bar]:pickaxes[id].bars,timber:pickaxes[id].timber,...pickaxes[id].materials});
export const forgeMaterialName=id=>id==='timber'?'timber':barProducts[id]?.name??miningFinds[id]?.name??id;
export const pickaxeRecipe=id=>Object.entries(pickaxeIngredients(id)).map(([key,n])=>n+' '+forgeMaterialName(key)).join(' + ');
export function forgeCraftReason(state,id){
 if(!Object.hasOwn(pickaxes,id)||id==='basic')return 'Choose a craftable pickaxe.';
 const pick=pickaxes[id];
 if(state.mining.upgrades.includes(id))return 'Already crafted · Equip it from Inventory.';
 if(miningLevel(state.mining)<pick.level)return 'Needs Mining '+pick.level+'.';
 if(pick.requires&&!state.mining.upgrades.includes(pick.requires))return 'Craft the '+pickaxes[pick.requires].name+' first.';
 if(Object.entries(pickaxeIngredients(id)).some(([key,n])=>(key==='timber'?state.woodcutting.timber:state.huntingLoot[key]??0)<n))return 'Bring '+pickaxeRecipe(id)+'.';
 return '';
}
export function drawQuarryForge(item,time,{point,block,rect,ctx,reduced}){
 const {x,y}=item,stone=['#9ba2a3','#3a4954','#667782'];
 block(x+.08,y+.10,.84,.8,0,29,stone);
 block(x+.09,y+.12,.36,.32,29,17,stone);
 const [px,py]=point(x+.5,y+.74,5);
 rect(px-11,py-20,22,16,'#23323b');
 const flicker=reduced?0:Math.sin(time/130)*2;
 rect(px-8,py-14,16,9,'#b75a36');rect(px-5,py-15-flicker,10,8+flicker,'#ffb751');rect(px-2,py-11,4,5,'#fff3b5');
 ctx.save();ctx.globalAlpha=.2;ctx.fillStyle='#ffae5c';ctx.beginPath();ctx.ellipse(px,py+1,22,8,0,0,Math.PI*2);ctx.fill();ctx.restore();
 if(!reduced){
  const [sx,sy]=point(x+.28,y+.28,48);
  for(let i=0;i<3;i++){const t=(time/2700+i/3)%1;ctx.save();ctx.globalAlpha=(1-t)*.22;ctx.fillStyle='#a4a4b1';ctx.beginPath();ctx.ellipse(sx+t*6,sy-t*26,3+t*4,3+t*3,0,0,Math.PI*2);ctx.fill();ctx.restore();}
 }
}
