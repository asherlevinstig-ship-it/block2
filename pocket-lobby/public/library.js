import {skillLevel} from './skill-curve.js';
export const libraryLayout=[['bookcase',1,1],['bookcase',4,1],['bookcase',7,1],['table',4,5],['chair',4,6,2],['table',7,6],['chair',7,7,2],['lamp',8,3],['plant',1,8],['moonCrystal',8,8]];
export const skillBooks={
 firstLight:{name:'The First Light',subtitle:'A beginner’s guide to magic',level:1,xp:15,color:'#74c8d8',text:'Magic begins with attention. Watch the ripple before the wave, the spark before the flame. A patient mind notices the energy that hurried eyes overlook.'},
 livingWeave:{name:'The Living Weave',subtitle:'Understanding magical forces',level:2,xp:25,color:'#bd98ec',text:'No force exists alone. Heat stirs the air, water shapes the earth, and shadows follow light. Study their relationships before trying to command their strength.'},
 willAndWonder:{name:'Will & Wonder',subtitle:'Advanced magical understanding',level:4,xp:40,color:'#e8bb6c',text:'Power follows purpose. A traveller and a protector may study the same magic and discover very different gifts. Knowledge opens possibilities; your actions reveal which ones belong to you.'}
};
export const readingDuration=12000,bookCooldown=60000;
export function normalizeLibrary(input){
 const times=Object.fromEntries(Object.keys(skillBooks).filter(id=>Number.isSafeInteger(input?.readyAt?.[id])&&input.readyAt[id]>0).map(id=>[id,input.readyAt[id]]));
 const r=input?.reading,valid=Object.hasOwn(skillBooks,r?.book)&&Number.isSafeInteger(r.startedAt)&&r.startedAt>0&&r.until===r.startedAt+readingDuration&&typeof r.id==='string'&&r.id.length<=80&&Number.isInteger(r.x)&&Number.isInteger(r.y);
 const last=input?.lastRead;
 return {readyAt:times,...(valid?{reading:{id:r.id,book:r.book,startedAt:r.startedAt,until:r.until,x:r.x,y:r.y}}:{}),...(Object.hasOwn(skillBooks,last?.book)&&Number.isSafeInteger(last.at)&&Number.isSafeInteger(last.xp)?{lastRead:{book:last.book,at:last.at,xp:last.xp}}:{})};
}
export function besideLibraryBooks(state){return state.location==='library'&&libraryLayout.filter(([type])=>['bookcase','table'].includes(type)).some(([type,x,y])=>Math.abs(state.position.y-y)+Math.max(x-state.position.x,0,state.position.x-(x+(type==='bookcase'?1:0)))===1);}
export const magicKnowledgeLevel=state=>skillLevel(state.stats?.magicKnowledgeXp);
