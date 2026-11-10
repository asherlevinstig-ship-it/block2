const sampleRate=0.05;

export function autoUsage(env,previous,trigger,now){
 const local=env.AUTO_METRICS_LOG==='1';
 if(!local&&Math.random()>=sampleRate)return null;
 return {
  event:'auto_usage_v1',weight:local?1:1/sampleRate,
  trigger,phase:previous?.phase??'startup',audience:previous?.audience??'unknown',
  activeMs:previous?Math.max(0,Math.min(now,previous.until)-previous.at):0,
  presence:0,activity:0,spot:0,saves:0,
 };
}

export function autoUsagePhase(state,motion,activity){
 if(motion.moving)return 'travel';
 if(state.plan?.physicalFishing&&state.location==='pond')return 'fishing';
 if(state.plan?.treeWork||activity==='regrowth')return 'woodcutting';
 if(state.plan?.activeHunt||state.plan?.kind==='dungeon'||activity==='combat'||activity==='hunting')return 'combat';
 return ['fishing','woodcutting','gambling','rest'].includes(activity)?activity:'other';
}

export function recordAutoUsage(usage){
 if(!usage)return;
 if(usage.weight===1)console.log('AUTO_USAGE '+JSON.stringify(usage));
 else console.log(usage);
}
