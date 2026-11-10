export const moonbackRules={cycleMs:8*60000,stopMs:60000,cloakChance:.10};
const sites=[
  {room:'grove',x:6,y:5},
  {room:'logging',x:7,y:6},
  {room:'creek',x:3,y:5},
];
export const moonbackSite=room=>sites.find(site=>site.room===room);
export const nextMoonbackAt=now=>(Math.floor(now/moonbackRules.cycleMs)+1)*moonbackRules.cycleMs;

export function moonbackSighting(now){
  const id=Math.floor(now/moonbackRules.cycleMs),start=id*moonbackRules.cycleMs;
  const index=Math.floor((now-start)/moonbackRules.stopMs),site=sites[index];
  return site?{...site,id,until:start+(index+1)*moonbackRules.stopMs}:null;
}
