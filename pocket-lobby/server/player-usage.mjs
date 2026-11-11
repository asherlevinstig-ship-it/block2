// Connected manual-play time, sampled once per minute or at a mode/room exit.
// Auto time is measured by AutoActor, so its owner's socket is excluded here.
export function recordPlayUsage(env,meta,now,{flush=false}={}){
 if(!Number.isFinite(meta.usageAt)){meta.usageAt=now;return;}
 const at=meta.usageAt??now,elapsed=Math.max(0,now-at);
 if(!flush&&elapsed<60000)return;
 meta.usageAt=now;
 if(meta.serverAuto||meta.auto||!elapsed)return;
 const exact=env.AUTO_METRICS_LOG==='1';
 if(exact||Math.random()<0.05)console.log({event:'player_usage_v1',mode:'play',playerMs:elapsed,weight:exact?1:20});
}
