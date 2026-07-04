#!/usr/bin/env node
const {lootEconomySnapshot,simulateLootProgression}=require('../server/loot-progression');
const GEAR_SYSTEM=require('../shared/gear-system');

const rows=lootEconomySnapshot();
console.log('Weapon loot progression — one representative combat hour');
console.log('Tier | Drops | Upgrades | Salvage iron | Salvage gold | Delivered | Rank skips');
console.log('-----|-------|----------|--------------|--------------|-----------|-----------');
for(const row of rows){
  console.log(`${GEAR_SYSTEM.RANKS[row.tier].id} | ${row.dropsPerHour} | ${row.upgradesPerHour} | ${row.salvageIronPerHour} | ${row.salvageGoldPerHour} | ${row.deliveryRate}% | ${row.rankSkips}`);
}

console.log('\nCombined rarity distribution');
const rarityTotals=new Array(5).fill(0);
for(const row of rows)for(const rank of row.distribution)rank.forEach((count,i)=>rarityTotals[i]+=count);
const total=rarityTotals.reduce((sum,count)=>sum+count,0);
rarityTotals.forEach((count,i)=>console.log(`${GEAR_SYSTEM.RARITIES[i].name}: ${(count/total*100).toFixed(2)}%`));

const archetypes={sword:0,axe:0},sourceArchetypes={bandit:{sword:0,axe:0},captain:{sword:0,axe:0},gate:{sword:0,axe:0}};
for(const row of rows){
  archetypes.sword+=row.archetypes.sword;archetypes.axe+=row.archetypes.axe;
  for(const source of Object.keys(sourceArchetypes))for(const kind of ['sword','axe'])sourceArchetypes[source][kind]+=row.sourceArchetypes[source][kind];
}
console.log(`\nWeapon mix: ${(archetypes.sword/(archetypes.sword+archetypes.axe)*100).toFixed(1)}% swords · ${(archetypes.axe/(archetypes.sword+archetypes.axe)*100).toFixed(1)}% axes`);
for(const source of Object.keys(sourceArchetypes)){
  const mix=sourceArchetypes[source],n=mix.sword+mix.axe;
  console.log(`${source}: ${(mix.axe/n*100).toFixed(1)}% axes`);
}

const full=simulateLootProgression({tier:2,freeSlots:0});
console.log(`\nFull inventory safety: ${full.recoveredPerHour} gear drops recovered/hour, ${full.lostPerHour} lost, ${full.securedRate}% secured.`);
