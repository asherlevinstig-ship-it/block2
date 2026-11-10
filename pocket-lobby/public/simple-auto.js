export const battleBatchLimit=3;
export const simpleAutoModes={
 fishing:{name:'Auto fish',icon:'fish',loop:'Buy bait → Catch fish → Sell fish → Repeat',detail:'Uses your equipped rod. Buys bait in packs of 10 and sells each batch. Needs a discovered fishing pond.'},
 gambling:{name:'Auto gamble',icon:'lounge',loop:'Visit lounge → Play your table → Repeat',detail:'Uses game gold. Fixed bets; stops at your loss limit. Requires a smart outfit.'},
 exploring:{name:'Auto explore',icon:'map',loop:'Walk trails → Discover places → Return → Repeat',detail:'Explore the courtyard, trail, creek, pond and Timber Hollow. Riskier settings can add suitable hunts along the way.'},
 battle:{name:'Auto battle',icon:'combat',loop:'Fight up to '+battleBatchLimit+' times → Sell loot → Recover as needed',detail:'Checks health, food and bag space between fights. Uses your equipped weapon, powers and Auto dodge.'},
 rest:{name:'Auto rest',icon:'home',loop:'Return home → Recover → Stay resting',detail:'Recover at home and stay there. No supplies or gold needed.'},
 hunting:{name:'Auto hunt',icon:'hunt',loop:'Hunt boars → Sell meat → Rest → Repeat',detail:'Hunts wildlife with your equipped weapon. Recovers before the next fight.'},
 random:{name:'Random',icon:'rules',loop:'Check needs → Eat or recover → Earn, battle or explore → Reassess',detail:'Handles hunger and recovery first. Low gold favours affordable work; healthy, fed adventurers are more likely to fight. Visits the bakery within your bread budget. Never gambles.'}
};
export const simpleAutoRisks={
 safe:{name:'Safe',batch:3,baitStock:10,minHealth:100,remainingHealth:60,fleeBelow:40,style:'cautious',bet:5,lossLimit:25},
 balanced:{name:'Balanced',batch:5,baitStock:20,minHealth:80,remainingHealth:40,fleeBelow:25,style:'balanced',bet:10,lossLimit:50},
 bold:{name:'Bold',batch:10,baitStock:30,minHealth:60,remainingHealth:20,fleeBelow:15,style:'aggressive',bet:25,lossLimit:100}
};
export function simpleAutoRiskDetail(mode,risk='balanced'){
 const p=simpleAutoRisks[risk];if(!p)throw new Error('Choose a valid Auto risk level.');
 if(mode==='rest')return 'Rest is always safe: return home, recover fully and stay resting. No gold spent.';
 if(mode==='fishing')return p.batch+' fish per batch; stock up to '+p.baitStock+' bait, then sell. Larger batches carry more unsold fish and commit more gold to bait. Fish odds are unchanged.';
 if(mode==='gambling')return 'Preset: '+p.bet+' gold per bet; stop after '+p.lossLimit+' gold in total losses. You can lower or adjust these limits below. Higher stakes can lose gold faster; odds are unchanged.';
 const combat='Start fights at '+p.minHealth+'+ HP; retreat at '+p.fleeBelow+' HP. '+p.name+' combat tactics. Survival checks still apply.';
 if(mode==='exploring')return (risk==='safe'?'Peaceful trails only. No battles.':risk==='balanced'?'Peaceful trails plus a suitable boar hunt.':'Peaceful trails plus the strongest suitable unlocked monster.')+(risk==='safe'?'':' '+combat+' Skip fights without suitable gear.');
 if(mode==='random')return (risk==='safe'?'Gathering and peaceful exploration only. No combat.':'Mix gathering, exploration and '+(risk==='bold'?'the strongest suitable unlocked monsters.':'suitable boar hunts.'))+' '+p.batch+' items per gathering batch. Never gambles.'+(risk==='safe'?'':' '+combat);
 return (mode==='battle'&&risk==='safe'?'Prefer boars; try beetles only if no suitable boar fight is available. ':'')+combat;
}
export function simpleAutoRules(mode,{risk='balanced',enabled=true,reserveGold=0,bet,lossLimit,game='roulette',breadBudget=mode==='random'?30:0,food}={}){
 if(!Object.hasOwn(simpleAutoModes,mode))throw new Error('Choose an Auto activity.');
 if(!Object.hasOwn(simpleAutoRisks,risk))throw new Error('Choose a valid Auto risk level.');
 if(mode==='rest')risk='safe';
 const profile=simpleAutoRisks[risk];if(!profile)throw new Error('Choose a valid Auto risk level.');
 return {...(breadBudget||food?{food:{...food,breadBudget}}:{}),simpleMode:mode,simpleRisk:risk,enabled,activity:'rest',strategy:mode==='gambling'?'gambling':'routine',keepBait:0,timberTarget:1000000,goldPolicy:{reserveGold,budget:100000,keepFish:0,keepTimber:0,keepMeat:0,keepShells:0,minHealth:profile.minHealth},gambling:{game,color:'red',bet:bet??profile.bet,lossLimit:lossLimit??profile.lossLimit,reserveGold,profitTarget:100000,maxRounds:1000},combat:{enabled:true,q:true,e:true,dodge:true,style:profile.style,fleeBelow:profile.fleeBelow}};
}

