export const equipmentPerks={
 vampire:{label:'Vampiric Sword',color:'#f48ca9',symbol:'♥'},
 angler:{label:'Angler’s Cloak',color:'#87efdc',symbol:'✧'},
 prospector:{label:'Prospector’s Gloves',color:'#ffd27c',symbol:'◆'},
 luck:{label:'Lucky Boots',color:'#ffe49a',symbol:'✦'}
};
export function recordEquipmentEffect(state,perk,amount,at,id,room=state.location){
 if(!equipmentPerks[perk]||!Number.isInteger(amount)||amount<1||amount>4||!Number.isSafeInteger(at)||at<0||typeof id!=='string'||id.length>140)return;
 const receipt={id,perk,amount,at,room};
 if(state.equipmentEffects?.some(e=>e.id===id))return;
 state.equipmentEffects=[...(state.equipmentEffects??[]),receipt].slice(-8);
}
export function normalizeEquipmentEffects(input){
 if(!Array.isArray(input))return [];
 const state={};for(const e of input.slice(-8))if(e&&typeof e.room==='string'&&e.room.length<=40)recordEquipmentEffect(state,e.perk,e.amount,e.at,e.id,e.room);
 return state.equipmentEffects??[];
}
