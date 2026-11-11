import test from 'node:test';
import assert from 'node:assert/strict';
import {readJsonRecords,usageEvents,buildUsageReport} from '../scripts/usage-report.mjs';

test('usage reports weight samples, separate manual/Auto and require matching windows for cost ratios',()=>{
 const events=[{event:'auto_usage_v1',weight:20,activeMs:180000,phase:'gambling',audience:'empty',saves:1},{event:'player_usage_v1',weight:1,playerMs:3600000}];
 const metrics={todayWorker:[{sum:{requests:100}}],todayObjects:[{sum:{requests:50}}],todayDuration:[{sum:{duration:10}}],todayD1:[{sum:{rowsRead:200,rowsWritten:20}}]};
 const result=buildUsageReport(events,metrics,{window:'same interval'});
 assert.deepEqual(result.playerHours,{auto:1,play:1,total:2});assert.equal(result.autoOperationsPerHour.saves,20);
 assert.equal(result.resourceUnitsPerPlayerHour.workerRequests,50);
 assert.equal(result.resourceUnitsPerPlayerHour.databaseRowsWritten,10);
 assert.equal(buildUsageReport(events,metrics).resourceUnitsPerPlayerHour,null);
 assert.equal(buildUsageReport([],metrics,{window:'empty'}).resourceUnitsPerPlayerHour,null);
});

test('tail exports and JSONL extract only usage events without copying request credentials',()=>{
 const event={event:'auto_usage_v1',weight:20,activeMs:60000,phase:'rest'},raw=JSON.stringify({event:{request:{headers:{Cookie:'secret'}}},logs:[{message:[event]}]})+'\n'+JSON.stringify({logs:[{message:['AUTO_USAGE '+JSON.stringify(event)]}]});
 const events=usageEvents(readJsonRecords(raw));assert.equal(events.length,2);
 assert(!JSON.stringify(buildUsageReport(events)).includes('secret'));
 assert.equal(readJsonRecords('[{"a":1},{"b":2}]').length,2);
});
