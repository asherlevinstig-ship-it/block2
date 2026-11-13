import {smartAttacks} from './enemy-brain.js';
import {arenaInDanger,arenaBehindCover} from './dungeon-arena.js';
export const vaultCoopRules={limit:4,lifetime:30*60000,health:420,scale:.65};
export const vaultPhaseDetails=[
 {name:'Ironclad',color:'#e6c080',hint:'Heavy hits break the plating. Leave the slam ring; punish its exposed core.',moves:['bossIronSmash','bossHarpoon','bossIronSweep']},
 {name:'Unbound',color:'#ffab89',hint:'The first cut has a follow-up. Dodge, then counter while its blades recover.',moves:['bossCleave','bossLunge','bossDelayed']},
 {name:'Runic heart',color:'#c6a4ff',hint:'Interrupt the charged volley with Storm or three weapon hits. Allies clear the Wisps.',moves:['bossFan','bossErupt','bossPulse']}
];
export const coopPhase=raid=>raid.hp>raid.max*2/3?1:raid.hp>raid.max/3?2:3;
export const coopMove=raid=>smartAttacks[raid.move]??smartAttacks.bossIronSmash;
export function coopEncounter(raid){return {enemy:'depthsGuardian',bossVersion:1,brainVersion:2,brainMaxHealth:raid.max,health:raid.hp,nextPlayerAt:raid.self?.nextStrikeAt??0,brainMove:raid.move,arenaVersion:1,arenaRoom:'depthsVault',arenaEnemy:raid.origin??{x:6,y:5},brainOrigin:raid.origin??{x:6,y:5},arenaTarget:raid.targetTile??{x:5,y:5},arenaLockedFor:raid.landsAt,nextBoarAt:raid.landsAt,staggerWeakUntil:raid.exposedUntil??0,exposedUntil:raid.exposedUntil??0};}
export function coopDanger(raid,position){const e={...coopEncounter(raid),arenaPlayer:position};return arenaInDanger(e,coopMove(raid))&&!arenaBehindCover(e,coopMove(raid));}
export function vaultDefeatTip(move){
 const name=typeof move==='string'?move:move?.name??'The Guardian';
 if(/Smash|Detonation|Pulse|Overhead|Slam|Blast/i.test(name))return 'Move out of the marked ring before it fills. Save stamina; a ward can cushion a late escape.';
 if(/Volley|Bolt/i.test(name))return 'Move sideways or use a pillar for cover. Storm or three quick weapon hits can interrupt the charged volley.';
 if(/Cleave|Lunge|Sweep|Harpoon/i.test(name))return 'Step out of the marked lane or arc. Expect a follow-up after the first cut, then counter during recovery.';
 if(/Wisp|Hatchling/i.test(name))return 'Clear the smaller enemies before focusing the Guardian. In a party, let an ally handle adds.';
 return 'Watch the attack warning, keep a dodge available and use the recovery window to strike.';
}
