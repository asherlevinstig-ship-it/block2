export const overlookRoom='keepersOverlook';
export const keeperFlags=['keeperMarkerRead','keeperRouteFound'];
export const keeperSites={
 keeperMarker:{room:'willowbank',x:4,y:12,label:'Lantern Keepers’ marker'},
 keeperCrate:{room:'waystation',x:9,y:4,label:'Crested crate'},
 keeperLedger:{room:overlookRoom,x:7,y:3,label:'Keeper’s ledger'}
};
export const overlookArea={
 number:'27',name:'Keepers’ Overlook',badge:'NORTHREACH',floor:'Hidden lookout',
 description:'From this ledge, the old road runs in view from Willowbank to Beaconwatch.',
 center:[5,5],palette:['#526269','#637b76','#bcaf8b'],
 authored:[['keeperLedger',7,3],['riverCypress',2,2],['riverCypress',11,2],['riverRock',4,2],
 ['riverLantern',4,5],['riverFlowers',8,2],['riverFlowers',9,8]]
};
export function keeperClueText(type,progress){
 if(type==='keeperMarker')return 'A lantern above three river lines. Under the crest, one word survives: Waystation. Look for the same mark on a crate there.';
 if(type==='keeperCrate')return progress.keeperRouteFound
  ?'The crest belongs to the Lantern Keepers. They carried lamp oil from Willowbank to the ridge and lit the road for travelers. Their route card marks a path behind the Waystation to their old lookout.'
  :'A lantern above three river lines. A note mentions the old river marker at Willowbank. Find it and bring the two clues together.';
 return 'The last entry reads: “Rain at Willowbank. Two travelers brought safely up the road. Leave the ridge lamp lit for whoever comes after us.” From here you can see why they chose this spot.';
}
export function drawKeeperCrest(px,py,scale,{polygon,rect}){
 const shape=points=>points.map(([x,y])=>[px+x*scale,py+y*scale]);
 polygon(shape([[-8,-11],[8,-11],[8,4],[0,9],[-8,4]]),'#203c41','#a88760');
 rect(px-scale,py-9*scale,2*scale,2*scale,'#ffe6a6');
 rect(px-2*scale,py-7*scale,4*scale,5*scale,'#f6cd78');
 rect(px-scale,py-6*scale,2*scale,3*scale,'#fff2c5');
 for(let i=0;i<3;i++)rect(px-(5-i)*scale,py+i*2*scale,(10-i*2)*scale,scale,'#94d1ce');
}

export function drawKeeperOverlook({point,block,surface,polygon,rect},path,rows,cols){
 const slate=['#83938f','#435661','#627778'];
 block(0,0,cols,rows,-13,13,['#536964','#354d58','#2f4552']);
 for(let x=3;x<cols;x++){
  const drop=26+(x*17)%20;
  polygon([point(x,rows,0),point(x+1,rows,0),point(x+.93,rows,-drop+5),point(x+.28,rows,-drop)],x%2?'#3c5360':'#465e66','#344d5b');
  polygon([point(x+.15,rows,-6),point(x+.9,rows,-8),point(x+.7,rows,-18),point(x+.28,rows,-20)],'#72837c66');
 }
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
  const onPath=path.has(x+','+y),stone=(x*23+y*17)%11;
  surface(x,y,1,1,0,onPath?'#a29b81':stone<3?'#627871':'#526765','#415660');
  if(!onPath&&stone<4)surface(x+.09,y+.23,.64,.1,.1,'#809b86');
 }
 for(const [x,start,end] of [[2,.8,2.7],[4,.25,1.25],[6,.18,1.04],[8,.28,1.34],[10,.8,2.2]]){
  block(x,start,1.8,end-start,-13,13,slate);
  polygon([point(x,start,-12),point(x+.85,start,-28),point(x+1.65,start,-16),point(x+1.8,start,0),point(x,start,0)],'#576b73','#425661');
 }
 surface(5.08,1.01,4.75,3.77,.14,'#777f79','#b8b09b');
 for(let x=5;x<=9;x++)for(let y=1;y<=4;y++){
  surface(x+.14,y+.11,.76,.76,.19,(x+y)%3?'#939486':'#868d83','#747b74');
 }
 surface(5.19,4.73,4.54,.18,.25,'#c5b99c');
 surface(5.45,5.01,3.99,.14,.26,'#aa9e85');
 for(const [x,width,height] of [[5.15,1.5,16],[6.83,.42,8],[7.48,.45,5],[8.32,1.52,16]]){
  block(x,.94,width,.31,0,height,slate);
  block(x-.03,.91,width+.06,.37,height,2,['#aab0a2','#56666c','#87938d']);
 }
 for(const x of [5.13,9.53])block(x,.86,.37,.47,0,23,slate);
 const [px,py]=point(7.5,4.26,.5);
 polygon([[px,py-11],[px+17,py],[px,py+11],[px-17,py]],'#496362','#a1a185');
 drawKeeperCrest(px,py-2,.62,{polygon,rect});
}

export function drawKeeperClue(item,{point,block,polygon,rect}){
 const {x,y,type}=item,crate=type==='keeperCrate';
 if(type==='keeperLedger'){
  const stone=['#b0b6a4','#4e6266','#7b8d8a'];
  block(x+.04,y+.04,.9,.9,0,4,stone);
  block(x+.22,y+.28,.5,.43,4,23,stone);
  block(x+.12,y+.14,.71,.66,27,3,stone);
  const [px,py]=point(x+.51,y+.53,32);
  polygon([[px-11,py],[px-4,py-4],[px+1,py-2],[px+7,py-3],[px+12,py+1],[px+4,py+6],[px,py+4],[px-5,py+5]],'#edd9ad','#685643');
  rect(px,py-1,1,5,'#9c815f');
  const [crestX,crestY]=point(x+.5,y+.69,19);
  drawKeeperCrest(crestX,crestY,.65,{polygon,rect});
  return;
 }
 const material=crate?['#bc965f','#695044','#95714e']:['#a4a69b','#515d61','#798482'];
 block(x+.15,y+.16,.7,.68,0,crate?17:24,material);
 const [px,py]=point(x+.53,y+.68,crate?16:23);
 drawKeeperCrest(px,py+2,1,{polygon,rect});
}
