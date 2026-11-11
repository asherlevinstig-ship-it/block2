import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runCombatCostScenario} from '../tests/helpers/combat-cost-harness.mjs';
import {prepareDungeonBuild,prepareBeetleHunter} from '../tests/helpers/combat-fixtures.mjs';

const scenarios=[['starter boar',{}],['boar with spells',{configureState:prepareDungeonBuild}],['beetle',{configureState:prepareBeetleHunter}],['safety retreat',{flee:true}],['failed retreat and defeat',{flee:true,random:()=>.99}],['session cap during combat',{sessionCapMs:1000}]],rows=[];
const log=console.log;
try{
 console.log=()=>{};
 for(const [scenario,options] of scenarios){
  const watched=await runCombatCostScenario({...options,observed:true}),quiet=await runCombatCostScenario({...options,observed:false});
  for(const key of ['outcome','health','stats','loot','hunts','magic','vitals'])assert.deepEqual(quiet[key],watched[key],scenario+' '+key);
  rows.push({scenario,watched:watched.counts,quiet:quiet.counts,outcome:quiet.outcome,health:quiet.health,loot:quiet.loot});
 }
}finally{console.log=log;}
const report={description:'Local real-actor/SQLite comparison of watched event-driven combat and unobserved three-second solo hunt batches. Every paired outcome, HP, XP, loot, spell cooldown and mana state is checked for equality. Room transport is simulated. Operation counts are not a production bill or capacity test.',rows};
const text=JSON.stringify(report,null,2)+'\n',index=process.argv.indexOf('--output');
if(index>=0)await writeFile(process.argv[index+1],text);else process.stdout.write(text);
