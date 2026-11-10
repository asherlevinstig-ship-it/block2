export const cellarFlags=['millCellarFound','millCellarCleared','millCellarClaimed'];
export const cellarEntrance={x:7,y:2};
export const cellarChest={x:9,y:3};
export const cellarReward={gold:125,stone:'shield',quantity:1};
export const cellarArea={number:'20·S',name:'The Forgotten Mill Cellar',description:'Dust turns in slanted lamplight beneath the watermill. An old clockwork custodian still protects the millkeeper’s chest.',badge:'HIDDEN DISCOVERY',floor:'Millkeeper’s storeroom',center:[4,6],palette:['#434651','#585a60','#8a7860'],landmark:['cellarCustodian',6,5,5,5],authored:[['cellarStairs',1,7],['cellarShelf',2,1],['cellarShelf',6,1],['cellarPillar',4,3],['cellarPillar',3,6],['cellarSacks',2,4],['cellarSacks',9,7],['cellarLantern',4,2],['cellarLantern',9,5],['cellarChest',cellarChest.x,cellarChest.y],['cellarJournal',3,7]]};
export const cellarFloor=(x,y)=>x>=1&&x<=10&&y>=1&&y<=8||x===0&&y===6;
