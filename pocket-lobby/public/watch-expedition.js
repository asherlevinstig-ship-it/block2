// One connected expedition: the road is safe; the thicket is optional danger.
export const watchAreas={
 ambermead:{number:'21',name:'Ambermead Road',region:'Beaconwatch',badge:'BEACONWATCH REACH',floor:'Peaceful road',description:'Follow the cream road to the distant watchtower. The red trail enters Thornwood; a quiet fishing pool hides by the eastern reeds.',center:[5,5],palette:['#82704a','#b69759','#e1c892'],authored:[['watchOak',1,1],['watchOak',3,1],['watchOak',1,8],['watchOak',7,8],['watchSign',4,4],['watchCache',2,7],['fishingPost',8,6],['riverReeds',9,2],['riverReeds',9,8],['riverFlowers',5,2],['riverLantern',6,4],['watchMilestone',10,1]]},
 thornwood:{number:'22',name:'Thornwood Thicket',region:'Beaconwatch',badge:'DANGER · THORN BOAR',floor:'Optional dangerous woodland',description:'A Thorn Boar guards the old trail. Mature trees yield double timber. Defeat the boar to break the seal on the hidden grotto cache.',center:[4,5],palette:['#343d4c','#525a67','#998574'],landmark:['wildboar',6,5,5,5],authored:[['watchPine',1,1],['watchPine',3,1],['watchPine',9,1],['watchPine',1,8],['watchPine',4,8],['watchPine',10,7],['watchBramble',3,3],['watchBramble',8,7],['watchRock',9,3],['watchSign',2,5],['watchMushroom',8,2],['watchMushroom',2,7]]},
 beaconwatch:{number:'23',name:'Beaconwatch Rise',region:'Beaconwatch',badge:'ANCIENT WATCHTOWER',floor:'Highland lookout',description:'The old watchtower overlooks Willowmere. Light its beacon to lower the bridge and open a permanent shortcut to Millbrook.',center:[5,5],palette:['#5c7181','#8398a1','#b7c5c1'],authored:[['watchTower',8,1],['watchBeacon',6,4],['watchRock',2,1],['watchPine',1,7],['watchPine',10,8],['watchBanner',3,2],['watchBanner',8,7],['watchMilestone',2,7],['riverFlowers',4,3]]},
 starfall:{number:'24',name:'Starfall Grotto',region:'Beaconwatch',badge:'SECRET · STARFALL GROTTO',floor:'Hidden crystal cave',description:'Starlight glimmers beneath the roots. The Thorn Boar’s defeat breaks the cache seal: 35 gold and a Sword Awakening Stone await.',center:[4,5],palette:['#263a50','#40576b','#728c9b'],authored:[['watchCrystal',1,1],['watchCrystal',4,1],['watchCrystal',9,2],['watchCrystal',10,7],['watchCrystal',2,8],['watchRock',2,2],['watchRock',7,1],['watchRock',10,4],['watchCache',7,5],['watchMushroom',4,7],['watchMushroom',6,2]]}
};
export const watchRooms=Object.keys(watchAreas);
export const watchMapPositions={ambermead:[290,910],thornwood:[490,1000],beaconwatch:[260,1105],starfall:[510,1120]};
export const watchFlags=['watchBeacon','watchBoar','meadowCache','grottoCache'];
export const watchDimensions={watchTower:[3,3]};
export const watchGuidance={ambermead:'Cream road → Beaconwatch. Red trail → Thornwood (danger).',thornwood:'Optional danger: equip a weapon. Defeat the boar to unseal the grotto treasure.',beaconwatch:'Light the beacon beside the tower to open the bridge back to Millbrook.',starfall:'A hidden cache holds 35 gold and a Sword Awakening Stone.'};
export const watchWater=(room,x,y)=>room==='ambermead'&&x>=9&&y>=3||room==='starfall'&&x>=9&&y>=8;
export function watchInteractLabel(room,type,progress={}){
 if(type==='watchBeacon')return progress.watchBeacon?'Beacon lit · Bridge open':'Light beacon · Open bridge';
 if(type==='watchCache')return progress[room==='starfall'?'grottoCache':'meadowCache']?'Empty cache':room==='starfall'?(progress.watchBoar?'Open starfall cache':'Sealed starfall cache'):'Forgotten roadside cache';
 return type==='watchSign'?'Read trail sign':null;
}
