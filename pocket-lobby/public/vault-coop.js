import {smartAttacks} from './enemy-brain.js';
import {arenaInDanger,arenaBehindCover} from './dungeon-arena.js';
export const vaultTeamCounter={move:'bossIronSweep',duration:2000,bonus:.35};
export const vaultCoopRules={limit:4,lifetime:30*60000,health:420,scale:.65};
export const vaultPhaseDetails=[
 {name:'Ironclad',color:'#e6c080',hint:'Crack the armour with Faultbreaker, or avoid the smash and strike the exposed core.',moves:['bossIronSmash','bossHarpoon','bossIronSweep']},
 {name:'Unbound',color:'#ffab89',hint:'Hunter’s Sweep locks onto its target. Reach the green lane on foot or with Shadowstep.',moves:['bossHuntSweep','bossLunge','bossCleave']},
 {name:'Runic heart',color:'#c6a4ff',hint:'Heart Marks explode at each player’s marked position. Spread out and move clear. Sanctuary absorbs damage for nearby allies.',moves:['bossHeartMarks','bossFan','bossPulse']}
];
export const coopPhase=raid=>raid.hp>raid.max*2/3?1:raid.hp>raid.max/3?2:3;
export const coopMove=raid=>smartAttacks[raid.move]??smartAttacks.bossIronSmash;
export function coopEncounter(raid){return {enemy:'depthsGuardian',bossVersion:1,brainVersion:2,brainMaxHealth:raid.max,health:raid.hp,nextPlayerAt:raid.self?.nextStrikeAt??0,brainMove:raid.move,arenaVersion:1,arenaRoom:'depthsVault',vaultMechanism:raid.vaultMechanism,arenaEnemy:raid.origin??{x:6,y:5},brainOrigin:raid.origin??{x:6,y:5},arenaTarget:raid.targetTile??{x:5,y:5},arenaMarks:raid.marks,arenaLockedFor:raid.landsAt,nextBoarAt:raid.landsAt,staggerWeakUntil:raid.exposedUntil??0,exposedUntil:raid.exposedUntil??0};}
export function coopDanger(raid,position){const e={...coopEncounter(raid),arenaPlayer:position};return arenaInDanger(e,coopMove(raid))&&!arenaBehindCover(e,coopMove(raid));}
export function vaultWarningStyle(move){
 if(move.shape==='arc')return 'sweep';
 if(move.shape==='ring'||move.shape==='marks')return 'slam';
 if(move.shape==='bolt')return 'bolt';
 return 'move';
}
export function vaultWarningPrompt(move,ms,{danger,covered,canDodge,canGuard=false,guardRaised=false,guardWindow=330}){
 if(covered)return 'In cover · Hold position';
 if(!danger)return 'Clear of this attack';
 if(move.shape==='arc'&&move.damage<6){
  if(guardRaised)return 'Shield up · Face the sweep';
  if(canGuard&&ms>0&&ms<=guardWindow)return 'GUARD NOW · B';
  if(canGuard)return 'Wait for Guard now, or step sideways';
 }
 if(move.shape==='safeLane')return 'Reach the green lane';
 if(move.shape==='marks'||move.shape==='ring')return 'Move clear of the ring';
 if(move.blockable)return 'Take green cover or step out of the bolt lane';
 if(canDodge&&ms>0&&ms<=350)return 'DODGE NOW · Space';
 if(move.shape==='arc')return 'Step sideways out of the sweep';
 return 'Step out of the marked tiles';
}
export function vaultDefeatTip(move){
 const name=typeof move==='string'?move:move?.name??'The Guardian';
 if(/Hunter’s Sweep/i.test(name))return 'Reach the green lane on foot or with Shadowstep. Time a dodge just before impact if you can’t reach it.';
 if(/Heart Marks/i.test(name))return 'Leave the marked rings. Spread out so they overlap less, or use Sanctuary to absorb damage.';
 if(/Smash|Detonation|Pulse|Overhead|Slam|Blast/i.test(name))return 'Move out of the marked ring before it fills. Save stamina; a ward can cushion a late escape.';
 if(/Volley|Bolt/i.test(name))return 'Move sideways or use a pillar for cover. Storm or three quick weapon hits can interrupt the charged volley.';
 if(/Cleave|Lunge|Sweep|Harpoon/i.test(name))return 'Step out of the marked lane or arc. Expect a follow-up after the first cut, then counter during recovery.';
 if(/Wisp|Hatchling/i.test(name))return 'Clear the smaller enemies before focusing the Guardian. In a party, let an ally handle adds.';
 return 'Watch the attack warning, keep a dodge available and use the recovery window to strike.';
}
