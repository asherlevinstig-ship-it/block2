export const overlookRoom='keepersOverlook';
export const keeperFlags=['keeperMarkerRead','keeperRouteFound'];
export const keeperSites={
 keeperMarker:{room:'willowbank',x:4,y:12,label:'Faded trail marker'},
 keeperCrate:{room:'waystation',x:9,y:4,label:'Crested crate'},
 keeperLedger:{room:overlookRoom,x:7,y:3,label:'Keeper’s ledger'}
};
export const overlookArea={
 number:'27',name:'Keepers’ Overlook',badge:'NORTHREACH',floor:'Hidden lookout',
 description:'From this ledge, the old road runs in view from Willowbank to Beaconwatch.',
 center:[5,5],palette:['#526269','#637b76','#bcaf8b'],
 authored:[['keeperLedger',7,3],['riverCypress',2,2],['riverCypress',10,6],['riverRock',4,2],
 ['riverBench',6,5],['riverLantern',4,5],['riverFlowers',8,2],['riverFlowers',9,8]]
};
export function keeperClueText(type,progress){
 if(type==='keeperMarker')return 'A lantern above three river lines. Under the crest, one word survives: Waystation. Look for the same mark on a crate there.';
 if(type==='keeperCrate')return progress.keeperRouteFound
  ?'The crest belongs to the Lantern Keepers. They carried lamp oil from Willowbank to the ridge and lit the road for travelers. Their route card marks a path behind the Waystation to their old lookout.'
  :'A lantern above three river lines. A note mentions the old river marker at Willowbank. Find it and bring the two clues together.';
 return 'The last entry reads: “Rain at Willowbank. Two travelers brought safely up the road. Leave the ridge lamp lit for whoever comes after us.” From here you can see why they chose this spot.';
}
export function drawKeeperClue(item,{point,block,polygon,rect}){
 const {x,y,type}=item,crate=type==='keeperCrate';
 const material=crate?['#bc965f','#695044','#95714e']:['#a4a69b','#515d61','#798482'];
 block(x+.15,y+.16,.7,.68,0,crate?17:24,material);
 const [px,py]=point(x+.53,y+.68,crate?16:23);
 polygon([[px-10,py-3],[px+10,py-3],[px+10,py+10],[px-10,py+10]],'#3d5459');
 rect(px-2,py-2,4,5,'#ebcc89');rect(px-1,py-4,2,2,'#ebcc89');
 for(let i=0;i<3;i++)rect(px-6+i,py+4+2*i,11-i*2,1,'#8fbebc');
}
