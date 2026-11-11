import {ownedGold} from '../public/bank.js';
import {migrateProgression} from '../public/skill-curve.js';
import {normalizeState} from './player-state.mjs';
import {playerPower} from '../public/progression.js';

export async function readRankings(db,playerId,account){
  const {results}=await db.prepare(
    "SELECT a.player_id, a.username, p.state_json, (SELECT COALESCE(SUM(remaining*price),0) FROM tower_timber_orders WHERE buyer_id=a.player_id) AS held_gold FROM tower_accounts a JOIN tower_players p ON p.player_id = a.player_id WHERE json_extract(p.state_json, '$.rankingJoined') = 1"
  ).all();
  const players=[];
  for(const row of results){
    try{
      const saved=JSON.parse(row.state_json);migrateProgression(saved);
      const state=normalizeState(saved);
      if(state.characterCreated===false)continue;
      const power=playerPower(state.stats,state.combatGear);
      players.push({
        id:row.player_id,
        name:state.avatar.name,
        username:row.username,
        gold:ownedGold(state)+row.held_gold,
        earned:state.goldEarned,
        power:power.total,
        breakdown:power.parts
      });
    }catch{
      // Invalid legacy saves are excluded until their owner repairs the character.
    }
  }
  function board(metric){
    const sorted=[...players].sort((a,b)=>b[metric]-a[metric]||a.username.localeCompare(b.username));
    let lastScore=null;
    let rank=0;
    const ranked=sorted.map((player,index)=>{
      if(player[metric]!==lastScore)rank=index+1;
      lastScore=player[metric];
      const {id,...publicPlayer}=player;
      return {...publicPlayer,rank,isYou:id===playerId};
    });
    return {top:ranked.slice(0,10),you:ranked.find(player=>player.isYou)??null};
  }
  return {
    mode:'testing',
    accountRequired:!account,
    joined:players.some(player=>player.id===playerId),
    participants:players.length,
    wealth:board('gold'),
    power:board('power'),
    updatedAt:Date.now()
  };
}
