export function createPrng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
export function varyColor(color,amount,random){const d=(random()*2-1)*amount;return[color[0]+d,color[1]+d,color[2]+d];}
export function paintAtlasTile(context,tileSize,tx,ty,pixel){
  const image=context.createImageData(tileSize,tileSize),random=createPrng(tx*977+ty*4127+7);
  for(let y=0;y<tileSize;y++)for(let x=0;x<tileSize;x++){
    const color=pixel(x,y,random),i=(y*tileSize+x)*4;
    image.data[i]=color[0];image.data[i+1]=color[1];image.data[i+2]=color[2];image.data[i+3]=color.length>3?color[3]:255;
  }
  context.putImageData(image,tx*tileSize,ty*tileSize);
}
