const props={
 bookcase:{file:'library-bookcase.png',anchor:[140,448],scale:.35},
 chest:{file:'dungeon-chest-closed.png',anchor:[128,448],scale:.39},
 openChest:{file:'dungeon-chest-open.png',anchor:[128,448],scale:.39},
 arch:{file:'dungeon-arch.png',anchor:[159,424],scale:.22}
};
const images=new Map();

export function drawMapProp(ctx,id,x,y){
 if(typeof Image!=='function')return false;
 const {file,anchor,scale}=props[id];
 if(!images.has(id)){
  const image=new Image();
  image.decoding='async';
  image.src='assets/map-props/'+file;
  images.set(id,image);
 }
 const image=images.get(id);
 if(!image.complete||!image.naturalWidth)return false;
 ctx.drawImage(image,Math.round(x-anchor[0]*scale),Math.round(y-anchor[1]*scale),Math.round(image.width*scale),Math.round(image.height*scale));
 return true;
}
