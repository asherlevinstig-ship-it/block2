import {skillBooks,normalizeLibrary,besideLibraryBooks,magicKnowledgeLevel,readingDuration,bookCooldown} from '../public/library.js';
import {MAX_SKILL_XP} from '../public/skill-curve.js';
import {requireActionPoint,spendActionPoint} from './action-points.mjs';
export function libraryAction(state,action,body,now){
 if(!['libraryRead','libraryFinish'].includes(action))return false;
 if(state.characterCreated===false||state.controlMode==='auto'||state.plan||state.report||state.health<=0||state.hunting?.encounter||state.hunting?.recoveryUntil||state.fishingCast||state.timberCut||state.miningCut||state.bedRest||state.campRest||state.gambling?.round?.status==='playing')throw new Error('Finish your activity and take control before reading.');
 if(!besideLibraryBooks(state))throw new Error('Walk beside a bookshelf or reading desk in the Library.');
 const library=normalizeLibrary(state.library);
 if(action==='libraryFinish'){
  const r=library.reading;
  if(!r||body.id!==r.id)throw new Error('This reading session has already ended.');
  if(now<r.until)throw new Error('Keep reading until the page is complete.');
  if(state.position.x!==r.x||state.position.y!==r.y)throw new Error('Return to your reading spot to finish this book.');
  const before=state.stats.magicKnowledgeXp??0;
  state.stats.magicKnowledgeXp=Math.min(MAX_SKILL_XP,before+skillBooks[r.book].xp);
  library.lastRead={book:r.book,at:now,xp:state.stats.magicKnowledgeXp-before};
  library.readyAt[r.book]=now+bookCooldown;delete library.reading;
 }else{
  const book=Object.hasOwn(skillBooks,body.book)?skillBooks[body.book]:null;
  if(!book||magicKnowledgeLevel(state)<book.level)throw new Error('Build more Magic Knowledge before reading this book.');
  if(library.reading)throw new Error('Finish your current book first.');
  if((library.readyAt[body.book]??0)>now)throw new Error('Let that lesson settle before rereading this book.');
  requireActionPoint(state);
  library.reading={id:crypto.randomUUID(),book:body.book,startedAt:now,until:now+readingDuration,x:state.position.x,y:state.position.y};
  spendActionPoint(state,now);
 }
 state.library=library;return true;
}
