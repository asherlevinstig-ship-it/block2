// Old expeditions retain the original crossing. New runs vary the revealed route.
export const floodCrossingRow=run=>run?.floodCrossing===6?6:4;
export const floodCrossingOpen=(run,x,y)=>x===8&&y===floodCrossingRow(run)&&run?.finds?.includes('sluiceLever')===true;
export const floodedCacheChoices={
 careful:{name:'Unseal with magic',mana:20,gold:25,detail:'1 AP · 20 mana · 25 unbanked gold. No injury.'},
 force:{name:'Force the rusted lid',health:12,gold:40,detail:'1 AP · Lose 12 HP · 40 unbanked gold. Cannot kill you.'}
};
