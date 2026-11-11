import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export function readJsonRecords(raw){
 raw=raw.replace(/^\uFEFF/,'');
 try{const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed:[parsed];}catch{}
 const records=[];let depth=0,start=-1,string=false,escape=false;
 for(let i=0;i<raw.length;i++){
  const c=raw[i];
  if(string){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')string=false;continue;}
  if(c==='"'){string=true;continue;}
  if(c==='{'){if(depth++===0)start=i;}
  else if(c==='}'&&depth>0&&--depth===0){try{records.push(JSON.parse(raw.slice(start,i+1)));}catch{}start=-1;}
 }
 return records;
}

export function usageEvents(records){
 const events=[];
 const visit=value=>{
  if(typeof value==='string'){for(const record of readJsonRecords(value))visit(record);return;}
  if(!value||typeof value!=='object')return;
  if(['auto_usage_v1','player_usage_v1'].includes(value.event)){events.push(value);return;}
  if(Array.isArray(value)){for(const entry of value)visit(entry);return;}
  // Only inspect the log payload; request headers/identities never enter output.
  for(const key of ['logs','message','messages','result'])if(value[key])visit(value[key]);
 };
 for(const record of records)visit(record);
 return events;
}

const total=(rows,key)=>(rows??[]).reduce((n,row)=>n+(Number(row.sum?.[key])||0),0);
export function buildUsageReport(events,analytics=null,{prefix='today',window=null}={}){
 let autoMs=0,playMs=0;const phases={},operations={presence:0,activity:0,spot:0,saves:0};
 for(const e of events){
  const weight=Number(e.weight);
  if(!Number.isFinite(weight)||weight<=0)continue;
  if(e.event==='auto_usage_v1'){
   const ms=Math.max(0,Number(e.activeMs)||0)*weight;autoMs+=ms;
   const key=String(e.phase??'unknown')+'/'+String(e.audience??'unknown');phases[key]=(phases[key]??0)+ms/3600000;
   for(const key of Object.keys(operations))operations[key]+=Math.max(0,Number(e[key])||0)*weight;
  }else playMs+=Math.max(0,Number(e.playerMs)||0)*weight;
 }
 const autoHours=autoMs/3600000,playHours=playMs/3600000,playerHours=autoHours+playHours;
 const account=analytics?.data?.viewer?.accounts?.[0]??analytics;
 const units=account?{
  workerRequests:total(account[prefix+'Worker'],'requests'),
  objectRequests:total(account[prefix+'Objects'],'requests'),
  objectGBSeconds:total(account[prefix+'Duration'],'duration'),
  databaseRowsRead:total(account[prefix+'D1'],'rowsRead'),
  databaseRowsWritten:total(account[prefix+'D1'],'rowsWritten'),
 }:null;
 // Caller must explicitly confirm matching windows before ratios are calculated.
 const perPlayerHour=units&&window&&playerHours>0?Object.fromEntries(Object.entries(units).map(([key,n])=>[key,n/playerHours])):null;
 return {window,measurement:'Sample-weighted estimates; play means connected manual play. Auto is measured by the server, including offline time. Use complete exports for the same interval; partial live tails are not daily totals.',samples:events.length,playerHours:{auto:autoHours,play:playHours,total:playerHours},autoHoursByPhase:phases,autoOperationsPerHour:autoHours>0?Object.fromEntries(Object.entries(operations).map(([key,n])=>[key,n/autoHours])):null,resourceUnits:units,resourceUnitsPerPlayerHour:perPlayerHour,limits:'Resource ratios are blended across play and Auto. They are usage, not an invoice or Cloudflare latency benchmark. Sample noise can be substantial at low player counts.'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2),arg=name=>args[args.indexOf(name)+1];
 if(!args.includes('--logs'))throw new Error('Provide --logs <export.json>. Optionally --metrics <analytics.json> --window <matching-interval-label> --output <report.json>.');
 const events=usageEvents(readJsonRecords(await readFile(arg('--logs'),'utf8')));
 const metrics=args.includes('--metrics')?JSON.parse(await readFile(arg('--metrics'),'utf8')):null;
 const report=buildUsageReport(events,metrics,{prefix:args.includes('--prefix')?arg('--prefix'):'today',window:args.includes('--window')?arg('--window'):null});
 const text=JSON.stringify(report,null,2)+'\n';
 if(args.includes('--output'))await writeFile(arg('--output'),text);else process.stdout.write(text);
}
