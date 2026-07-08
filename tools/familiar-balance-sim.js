'use strict';
const F=require('../shared/familiar-system');

// One representative active hour for each familiar. Entries are distinct
// server award reasons, preserving the live per-reason diminishing curve.
const scenarios={
  shade:[{events:30,xp:3},{events:20,xp:8}],
  fang:[{events:70,xp:2},{events:10,xp:12}],
  mote:[{events:90,xp:1},{events:3,xp:12}],
  sprite:[{events:10,xp:12}],
};
function pacedXp(events,xp){let total=0;for(let i=1;i<=events;i++){const scale=i<=20?1:i<=40?.5:.25;total+=Math.max(1,Math.round(xp*scale));}return total;}
function rateFor(kind){return scenarios[kind].reduce((n,row)=>n+pacedXp(row.events,row.xp),0)+F.DAILY_CHALLENGE_REWARD/3;}
const rows=[];
for(const kind of Object.keys(scenarios)){
  const hourly=rateFor(kind),hours=F.BOND_XP_THRESHOLDS.slice(1).map(xp=>xp/hourly);
  rows.push({kind,hourly:Math.round(hourly),tier2:hours[0].toFixed(1),tier3:hours[1].toFixed(1),tier4:hours[2].toFixed(1),tier5:hours[3].toFixed(1)});
}
console.table(rows);
const fastest=Math.max(...rows.map(r=>+r.tier5)),slowest=Math.min(...rows.map(r=>+r.tier5));
console.log('Tier 5 active-play spread:',slowest.toFixed(1)+'h–'+fastest.toFixed(1)+'h');
module.exports={scenarios,pacedXp,rateFor};
