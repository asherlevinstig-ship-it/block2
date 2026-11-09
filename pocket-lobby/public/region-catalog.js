export {watchAreas,watchRooms,watchMapPositions,watchDimensions,watchFlags,watchGuidance,watchWater,watchInteractLabel} from './watch-expedition.js';
// Shared identities and authored metadata for the first Willowmere slice.
export const willowmereAreas={
 reedwater:{number:'18',name:'Reedwater Crossing',description:'An old stone bridge crosses a luminous river. Follow the cream-coloured road toward Willowbank.',badge:'WILLOWMERE VALLEY',floor:'River crossing',region:'Willowmere',center:[3,4],palette:['#496e62','#62816b','#d1c1a0'],authored:[['riverWillow',1,1],['riverCypress',10,1],['riverWillow',1,8],['riverReeds',4,1],['riverReeds',7,8],['riverLantern',3,3],['riverLantern',8,5],['riverFlowers',2,7],['riverFlowers',9,2],['riverRock',8,8]]},
 willowbank:{number:'19',name:'Willowbank',description:'Willow branches brush the clear river. Choose a free fishing station, or follow the waterside path to Millbrook.',badge:'WILLOWMERE VALLEY',floor:'Shared fishing bank',region:'Willowmere',center:[3,5],palette:['#426d60','#608574','#c4b78d'],authored:[['riverWillow',1,1],['riverWillow',3,8],['riverCypress',1,8],['fishingPost',6,2],['fishingPost',6,5],['fishingPost',6,8],['riverReeds',7,0],['riverReeds',7,9],['riverFlowers',3,2],['riverFlowers',2,7],['riverLantern',4,4],['riverBench',2,3]]},
 millbrook:{number:'20',name:'Millbrook Hamlet',description:'A waterwheel turns beside warm cottages. Sell fish to the river trader, rest on the bench, then follow the northern road to Beaconwatch.',badge:'WILLOWMERE VALLEY',floor:'Watermill village',region:'Willowmere',center:[5,6],palette:['#64745e','#81916b','#d8c29c'],authored:[['riverMill',8,1],['riverCottage',1,1],['riverCottage',4,0],['riverTrader',3,4],['riverBench',4,7],['riverLantern',6,3],['riverLantern',6,8],['riverFlowers',1,7],['riverFlowers',7,6],['riverReeds',9,8],['riverCrates',7,4]]}
};
export const willowmereRooms=Object.keys(willowmereAreas);
export const willowmereMapPositions={reedwater:[490,640],willowbank:[295,720],millbrook:[510,805]};
export const fishingSites={ambermead:{stations:[{x:8,y:6}],waterX:10.2},pond:{stations:[{x:5,y:5}],waterX:7.4},willowbank:{stations:[{x:6,y:2},{x:6,y:5},{x:6,y:8}],waterX:8.5}};
export const isFishingRoom=room=>Object.hasOwn(fishingSites,room);
export const besideFishingStation=(room,position)=>!!position&&fishingSites[room]?.stations.some(p=>Math.abs(p.x-position.x)+Math.abs(p.y-position.y)===1);
export function riverWater(room,x,y){return room==='reedwater'?x>=5&&x<=6:room==='willowbank'?x>=7:room==='millbrook'?x>=9:false;}
export const riverBridge=(room,x,y)=>room==='reedwater'&&x>=4&&x<=7&&y>=4&&y<=5||room==='millbrook'&&x>=9&&y===6;
export const riverDimensions={riverMill:[3,3],riverCottage:[2,2],riverBench:[2,1]};
