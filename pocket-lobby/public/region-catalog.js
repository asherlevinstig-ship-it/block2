export * from './waystation-travelers.js';
export * from './willowbank-wildlife.js';
export * from './waystation.js';
export * from './lantern-keepers.js';
export * from './outdoor-weather.js';
export {watchAreas,watchRooms,watchMapPositions,watchDimensions,watchFlags,watchGuidance,watchWater,watchInteractLabel} from './watch-expedition.js';
export const willowbankView={width:680,height:425,cols:18,rows:16,originX:309,originY:100};
export const willowbankLatch={x:7,y:6};
export const willowbankNook={x:13,y:2};
export const willowbankShortcut={x:8,y:7};
export const willowbankFlags=['willowbankShortcut','willowbankNook'];
export function willowbankBarrier(x,y,progress={}){
 return y===7&&x<14&&x!==3&&x!==11&&(x!==willowbankShortcut.x||!progress.willowbankShortcut);
}
export function willowbankTrail(x,y){
 if(x===12&&y>=1&&y<=2)return 'nook';
 if(x===3&&y<=13||y===13&&x<=11||x===7&&y>=13||x===8&&y<=1||y===1&&x>=3&&x<=11)return 'inland';
 if(x===8&&y>=2&&y<=13&&y!==7||y===6&&x>=3&&x<=11||y===8&&x>=3&&x<=11)return 'bank';
 if(x===11&&y>=1&&y<=13||y===10&&x>=8&&x<=13)return 'river';
 return null;
}
// Shared identities and authored metadata for the first Willowmere slice.
export const willowmereAreas={
 reedwater:{number:'18',name:'Reedwater Crossing',description:'An old stone bridge crosses a luminous river. Follow the cream-coloured road toward Willowbank.',badge:'WILLOWMERE VALLEY',floor:'River crossing',region:'Willowmere',center:[3,4],palette:['#496e62','#62816b','#d1c1a0'],authored:[['riverWillow',1,1],['riverCypress',10,1],['riverWillow',1,8],['riverReeds',4,1],['riverReeds',7,8],['riverLantern',3,3],['riverLantern',8,5],['riverFlowers',2,7],['riverFlowers',9,2],['riverRock',8,8]]},
 willowbank:{
  number:'19',name:'Willowbank',description:'Take the pale inland trail or the timber riverside walk to Millbrook. Both start at the Reedwater fork.',badge:'WILLOWMERE VALLEY',floor:'River trails and fishing',region:'Willowmere',center:[5,11],palette:['#426d60','#608574','#c4b78d'],
  authored:[
   ['riverWillow',1,2],['riverCypress',1,9],['riverWillow',2,11],['riverWillow',4,8],['riverWillow',9,9],['riverWillow',12,3],
   ['riverWillow',10,14],['riverCypress',4,15],['riverCypress',5,3],['riverCypress',6,3],
   ['fishingPost',6,2],['fishingPost',6,5],['fishingPost',6,8],['riverBench',8,11],
   ['riverLantern',2,12],['riverLantern',10,12],['riverLantern',4,1],['riverLantern',10,2],
   ['riverFlowers',4,3],['riverFlowers',2,10],['riverFlowers',13,0],['riverFlowers',12,11],
   ['riverRock',8,9],['keeperMarker',4,12],['riverRock',5,12],['riverRock',12,4],
   ['riverReeds',14,0],['riverReeds',14,8],['riverReeds',14,13],
   ['willowLatch',willowbankLatch.x,willowbankLatch.y],['willowNook',willowbankNook.x,willowbankNook.y]
  ]
 },
 millbrook:{number:'20',name:'Millbrook Hamlet',description:'A waterwheel turns beside warm cottages. Sell fish to the river trader, rest on the bench, then follow the northern road to Beaconwatch.',badge:'WILLOWMERE VALLEY',floor:'Watermill village',region:'Willowmere',center:[5,6],palette:['#64745e','#81916b','#d8c29c'],authored:[['riverMill',8,1],['riverCottage',1,1],['riverCottage',4,0],['riverTrader',3,4],['riverBench',4,7],['riverLantern',6,3],['riverLantern',6,8],['riverFlowers',1,7],['riverFlowers',7,6],['riverReeds',9,8],['riverCrates',7,4],['cellarCrack',7,2]]}
};
export const willowmereRooms=Object.keys(willowmereAreas);
export const willowmereMapPositions={reedwater:[490,640],willowbank:[295,720],millbrook:[510,805]};
export const moonfinPool={room:'millbrook',spots:[{x:8,y:4},{x:8,y:5}],water:{x:9.7,y:4.8}};
export const fishingSites={ambermead:{stations:[{x:8,y:6}],waterX:10.2},pond:{stations:[{x:5,y:5}],waterX:7.4},willowbank:{stations:[{x:6,y:2},{x:6,y:5},{x:6,y:8}],waterX:7.45}};
export const isFishingRoom=room=>Object.hasOwn(fishingSites,room);
export const besideFishingStation=(room,position)=>!!position&&fishingSites[room]?.stations.some(p=>Math.abs(p.x-position.x)+Math.abs(p.y-position.y)===1);
export function riverWater(room,x,y){return room==='reedwater'?x>=5&&x<=6:room==='willowbank'?x>=14||y===5&&x>=9||x===7&&(y===2||y===5||y===8):room==='millbrook'?x>=9:false;}
export const riverBridge=(room,x,y)=>room==='willowbank'&&x===11&&y===5||room==='reedwater'&&x>=4&&x<=7&&y>=4&&y<=5||room==='millbrook'&&x>=9&&y===6;
export const riverDimensions={riverMill:[3,3],riverCottage:[2,2],riverBench:[2,1]};
