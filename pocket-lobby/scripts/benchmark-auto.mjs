import {writeFile} from 'node:fs/promises';
import {runAutoCostScenario} from '../tests/helpers/auto-cost-harness.mjs';

const rows=[],log=console.log;
try{
 // Usage sampling is not the benchmark's output; the counters below are exact.
 console.log=()=>{};
 for(const players of [1,10,100])for(const observed of [true,false]){
  const {states,...result}=await runAutoCostScenario({players,observed});
  rows.push({...result,perPlayerHour:Object.fromEntries(Object.entries(result.counts).map(([key,n])=>[key,n/result.playerHours]))});
 }
 const {states,...rest}=await runAutoCostScenario({kind:'rest',minutes:2});rows.push(rest);
}finally{console.log=log;}
const report={description:'Local half-hour simulations using real AutoActor alarms and SQLite player settlement. Room transport is simulated. Each gambling case returns to the game at the end and must complete 60 rounds per player. This measures operation counts, not production capacity, latency or dollars.',rows};
for(const row of rows)if(row.kind==='gambling'&&row.rounds!==row.players*row.minutes*2)throw new Error('Incorrect round count in benchmark');
const text=JSON.stringify(report,null,2)+'\n',index=process.argv.indexOf('--output');
if(index>=0)await writeFile(process.argv[index+1],text);else process.stdout.write(text);
