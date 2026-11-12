import {writeFile} from 'node:fs/promises';
import {runGatheringContention} from '../tests/helpers/gathering-cost-harness.mjs';
import {runMiningActorCost} from '../tests/helpers/gathering-actor-cost-harness.mjs';
const rows=[];
for(const kind of ['tree','ore'])for(const manualPlayers of [0,1])rows.push(await runGatheringContention({kind,players:20,manualPlayers}));
const report={description:'Twenty simultaneous gatherers contend on one resource, including mixed manual/Auto cases. Real SQLite transactions and revision checks are used; clock and room transport are simulated. Tests include regrowth and stale-generation rejection. Counts are queries/returned rows, not Cloudflare billing or network-capacity measurements.',rows,miningActor:await runMiningActorCost()};
const text=JSON.stringify(report,null,2)+'\n',i=process.argv.indexOf('--output');
if(i>=0)await writeFile(process.argv[i+1],text);else process.stdout.write(text);
