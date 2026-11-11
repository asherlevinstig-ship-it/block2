import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runCombatCostScenario} from '../tests/helpers/combat-cost-harness.mjs';

const rows=[],originalLog=console.log;
try{
 console.log=()=>{};
 for(const flee of [false,true]){
  const old=await runCombatCostScenario({fixedPolling:true,flee}),next=await runCombatCostScenario({flee});
  for(const key of ['outcome','health','stats','loot','hunts'])assert.deepEqual(next[key],old[key],key);
  rows.push(old,next);
 }
 rows.push({...await runCombatCostScenario({sessionCapMs:1000}),scenario:'session expires during fight'});
}finally{console.log=originalLog;}
const report={description:'Local simulations using the real AutoActor and SQLite settlement. The baseline overrides its next fighting alarm to the previous fixed 500 ms interval; the event-driven version uses the shared combat clock with a 50 ms delivery window. Room transport is simulated. Counts measure operations, not Cloudflare billing or concurrent-player capacity. All paired outcomes/rewards are checked for equality.',rows};
const text=JSON.stringify(report,null,2)+'\n',index=process.argv.indexOf('--output');
if(index>=0)await writeFile(process.argv[index+1],text);else process.stdout.write(text);
