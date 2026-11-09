export const simpleAutoModes={
 fishing:{name:'Auto fish',icon:'fish',loop:'Buy bait → Catch fish → Sell fish → Repeat',detail:'Uses your equipped rod. Buys bait in packs of 10 and sells each batch. Needs a discovered fishing pond.'},
 gambling:{name:'Auto gamble',icon:'lounge',loop:'Visit lounge → Play your table → Repeat',detail:'Uses game gold. Fixed bets; stops at your loss limit. Requires a smart outfit.'},
 exploring:{name:'Auto explore',icon:'map',loop:'Walk peaceful trails → Visit places → Repeat',detail:'Explore the courtyard, trail, creek, pond and Timber Hollow. No fighting or spending.'},
 battle:{name:'Auto battle',icon:'combat',loop:'Choose a safe monster → Fight → Sell loot → Rest → Repeat',detail:'Chooses the strongest safe unlocked monster. Uses your equipped weapon, powers and Auto dodge.'},
 rest:{name:'Auto rest',icon:'home',loop:'Return home → Recover → Stay resting',detail:'Recover at home and stay there. No supplies or gold needed.'},
 hunting:{name:'Auto hunt',icon:'hunt',loop:'Hunt boars → Sell meat → Rest → Repeat',detail:'Hunts wildlife with your equipped weapon. Recovers before the next fight.'},
 random:{name:'Random',icon:'rules',loop:'Do a job → Pick a different activity → Repeat',detail:'Mixes suitable fishing, hunting, timber gathering and peaceful exploration. Never gambles.'}
};
export function simpleAutoRules(mode,{enabled=true,reserveGold=0,bet=5,lossLimit=25,game='roulette',combat}={}){
 if(!Object.hasOwn(simpleAutoModes,mode))throw new Error('Choose an Auto activity.');
 return {simpleMode:mode,enabled,activity:'rest',strategy:mode==='gambling'?'gambling':'routine',keepBait:0,timberTarget:1000000,goldPolicy:{reserveGold,budget:100000,keepFish:0,keepTimber:0,keepMeat:0,keepShells:0,minHealth:80},gambling:{game,color:'red',bet,lossLimit,reserveGold,profitTarget:100000,maxRounds:1000},combat:{enabled:true,q:true,e:true,dodge:true,style:'balanced',fleeBelow:20,...combat}};
}
