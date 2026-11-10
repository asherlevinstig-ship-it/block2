import {wildlifeRoom,wildlifeView,wildlifeArea,reserveWater} from './wildlife.js';
import {watchRooms,watchAreas,watchWater,watchDimensions,willowmereRooms,willowmereAreas,riverDimensions,riverWater,riverBridge} from './region-catalog.js';
import {factionRegistrar} from './faction-registry.js';
import {factionHall,factionHallLayout} from './faction-hall.js';
import {furnitureCatalog,catalogFurnitureSize} from './furniture-catalog.js';
export * from './outfit-magic.js';
import {bakeryLayout} from './cooking.js';
import {cellarFloor} from './mill-cellar.js';
export {factionRegistrar,factionHall,factionHallLayout,furnitureCatalog,catalogFurnitureSize};
export const socialRooms={[wildlifeRoom]:[wildlifeView.cols,wildlifeView.rows],...Object.fromEntries([...willowmereRooms,...watchRooms].map(id=>[id,[12,10]])),grove:[12,10],shrine:[12,10],roots:[12,10],pond:[12,10],logging:[12,10],clearing:[12,10],ruins:[12,10],trail:[12,10],creek:[12,10],tailor:[10,10],furnishings:[10,10],hub:[18,16],lounge:[10,10],outside:[14,12],store:[10,10],market:[10,10],bakery:[10,10],[factionHall]:[10,10],armory:[10,10],home:[10,10]};
const layouts={[wildlifeRoom]:wildlifeArea.authored,...Object.fromEntries(watchRooms.map(id=>[id,watchAreas[id].authored])),...Object.fromEntries(willowmereRooms.map(id=>[id,willowmereAreas[id].authored])),
  tailor:[['reception',3,2],['sofa',7,6],['lamp',8,1],['plant',1,1],['plant',8,8]],
  furnishings:[['reception',3,1],['bed',6,2],['lamp',8,2],['bookcase',1,1],['sofa',6,6],['table',6,8],['chair',8,8,2],['plant',1,8],['safe',8,1],['silverfinTank',2,7],['moonCrystal',7,3]],
  hub:[['reception',3,2],['warden',10,3],['factionRegistrar',factionRegistrar.x,factionRegistrar.y],['plant',1,1],['plant',16,1],['sofa',2,10],['bench',2,12],['sofa',13,8,2]],
  lounge:[['bar',.05,.25],['shelf',.02,.48],['plant',.3,8.7],['plant',8.9,.2],['sofa',5,1],['chair',8,3,1],['lamp',8,1],['stool',2,1],['stool',2,2],['stool',2,3],['chair',2,6,1],['chair',4,8],['lamp',1,6],['plant',7,8],['plant',.3,7.2],['blackjack',6,3],['roulette',3,7,1]],
  outside:[['fountain',6,5],['streetlamp',1,3],['streetlamp',1,8],['streetlamp',11,1],['streetlamp',11,10],['bench',3,8],['bench',10,3,1],['bench',9,9,2],['plant',0,1],['plant',0,10],['plant',13,1],['plant',13,10]],
  store:[['tackleCounter',3,2],['rodRack',7,1],['baitCrates',7,4],['plant',1,1],['stool',4,4]],
  bakery:bakeryLayout,
  [factionHall]:factionHallLayout,
  market:[['tradeCounter',3,2],['harvestCrates',7,3],['baitCrates',7,5],['plant',1,1],['stool',4,4]],
  armory:[['armoryCounter',3,2],['weaponRack',7,1],['anvil',7,5],['enchanter',6,5],['brazier',1,1],['stool',4,4]]
};
export function furnitureBox(item){
  const {type,x,y,rot=0}=item;
  const wide=['bookcase','workbench','sofa','bed','comfortBed','royalBed','bench','blackjack','roulette'].includes(type);
  const [w,d]=watchDimensions[type]??riverDimensions[type]??catalogFurnitureSize(item)??(wide?(rot%2?[1,2]:[2,1]):['reception','tackleCounter','tradeCounter','armoryCounter'].includes(type)?[3,1]:['rodRack','weaponRack'].includes(type)?[2,1]:type==='fountain'?[2,2]:type==='bar'?[1.5,4.1]:[1,1]);
  return {x,y,w,d};
}
export function roomBoxes(room,homeFurniture=[]){return (room==='home'?homeFurniture:(layouts[room]??[]).map(([type,x,y,rot])=>({type,x,y,rot}))).filter(item=>item.type!=='shelf').map(furnitureBox);}
export function validRoomTile(room,x,y,boxes=[]){const size=socialRooms[room]??(room==='millCellar'?[12,10]:null);return !!size&&Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<size[0]&&y<size[1]&&(room!=='millCellar'||cellarFloor(x,y))&&(room!==wildlifeRoom||!reserveWater(x,y))&&(!watchRooms.includes(room)||!watchWater(room,x,y))&&(!willowmereRooms.includes(room)||!riverWater(room,x,y)||riverBridge(room,x,y))&&!boxes.some(b=>x<b.x+b.w&&x+1>b.x&&y<b.y+b.d&&y+1>b.y);}
export function reachableMove(room,from,to,boxes,maxSteps){
  if(!validRoomTile(room,to.x,to.y,boxes))return false;
  const queue=[{x:from.x,y:from.y,n:0}],seen=new Set();
  while(queue.length){const p=queue.shift(),key=p.x+','+p.y;if(seen.has(key))continue;seen.add(key);if(p.x===to.x&&p.y===to.y)return true;if(p.n>=maxSteps)continue;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(validRoomTile(room,p.x+dx,p.y+dy,boxes))queue.push({x:p.x+dx,y:p.y+dy,n:p.n+1});}
  return false;
}

export function roomSeats(room,homeFurniture=[]){return (room==='home'?homeFurniture:(layouts[room]??[]).map(([type,x,y,rot=0])=>({type,x,y,rot}))).filter(item=>['sofa','chair','stool','woodStool','bench','riverBench'].includes(item.type));}
