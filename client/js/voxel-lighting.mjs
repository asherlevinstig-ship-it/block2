const DIRECTIONS=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

function clamp(value,min,max){return Math.max(min,Math.min(max,value));}

export function buildChunkLightField({cx,cz,chunkSize,worldBounds,getBlock,isOpaque,sources,cellSize=2,halo=12}){
  const minX=Math.max(worldBounds.minX,Math.floor((cx*chunkSize-halo)/cellSize)*cellSize);
  const maxX=Math.min(worldBounds.maxX,Math.ceil(((cx+1)*chunkSize+halo)/cellSize)*cellSize-1);
  const minY=Math.max(worldBounds.minY,Math.floor(worldBounds.minY/cellSize)*cellSize);
  const maxY=worldBounds.maxY;
  const minZ=Math.max(worldBounds.minZ,Math.floor((cz*chunkSize-halo)/cellSize)*cellSize);
  const maxZ=Math.min(worldBounds.maxZ,Math.ceil(((cz+1)*chunkSize+halo)/cellSize)*cellSize-1);
  const nx=Math.ceil((maxX-minX+1)/cellSize),ny=Math.ceil((maxY-minY+1)/cellSize),nz=Math.ceil((maxZ-minZ+1)/cellSize);
  const count=nx*ny*nz,level=new Float32Array(count),red=new Float32Array(count),green=new Float32Array(count),blue=new Float32Array(count),blocked=new Int8Array(count).fill(-1);
  const index=(gx,gy,gz)=>(gy*nz+gz)*nx+gx;
  const cellBlocked=(gx,gy,gz)=>{
    const at=index(gx,gy,gz);
    if(blocked[at]>=0)return blocked[at]===1;
    let occupied=0,total=0;
    for(let oy=0;oy<cellSize;oy++)for(let oz=0;oz<cellSize;oz++)for(let ox=0;ox<cellSize;ox++){
      const x=minX+gx*cellSize+ox,y=minY+gy*cellSize+oy,z=minZ+gz*cellSize+oz;
      if(x>maxX||y>maxY||z>maxZ)continue;
      total++;if(isOpaque(getBlock(x,y,z)))occupied++;
    }
    // Partial cells include doors, stairs and torch mounts: allow light through.
    blocked[at]=total>0&&occupied===total?1:0;
    return blocked[at]===1;
  };
  const queue=[];
  for(const source of sources||[]){
    if(source.x<minX||source.x>maxX||source.y<minY||source.y>maxY||source.z<minZ||source.z>maxZ)continue;
    const gx=clamp(Math.floor((source.x-minX)/cellSize),0,nx-1),gy=clamp(Math.floor((source.y-minY)/cellSize),0,ny-1),gz=clamp(Math.floor((source.z-minZ)/cellSize),0,nz-1),at=index(gx,gy,gz);
    const strength=clamp(Number(source.strength)||0,0,1);
    if(strength<=level[at])continue;
    level[at]=strength;red[at]=source.color[0];green[at]=source.color[1];blue[at]=source.color[2];queue.push(at);
  }
  for(let cursor=0;cursor<queue.length;cursor++){
    const at=queue[cursor],gx=at%nx,gz=Math.floor(at/nx)%nz,gy=Math.floor(at/(nx*nz)),current=level[at];
    for(const [dx,dy,dz] of DIRECTIONS){
      const qx=gx+dx,qy=gy+dy,qz=gz+dz;
      if(qx<0||qx>=nx||qy<0||qy>=ny||qz<0||qz>=nz)continue;
      const next=index(qx,qy,qz),candidate=current-(dy===0?.13:.16);
      if(candidate<=.035||candidate<=level[next]+.012||cellBlocked(qx,qy,qz))continue;
      level[next]=candidate;red[next]=red[at];green[next]=green[at];blue[next]=blue[at];queue.push(next);
    }
  }
  return {minX,minY,minZ,maxX,maxY,maxZ,nx,ny,nz,cellSize,level,red,green,blue};
}

export function sampleChunkLight(field,x,y,z,out=[0,1,1,1]){
  if(!field||x<field.minX||x>field.maxX+1||y<field.minY||y>field.maxY+1||z<field.minZ||z>field.maxZ+1){out[0]=0;out[1]=1;out[2]=1;out[3]=1;return out;}
  const fx=(x-field.minX)/field.cellSize-.5,fy=(y-field.minY)/field.cellSize-.5,fz=(z-field.minZ)/field.cellSize-.5;
  const x0=clamp(Math.floor(fx),0,field.nx-1),y0=clamp(Math.floor(fy),0,field.ny-1),z0=clamp(Math.floor(fz),0,field.nz-1);
  const x1=Math.min(x0+1,field.nx-1),y1=Math.min(y0+1,field.ny-1),z1=Math.min(z0+1,field.nz-1),tx=clamp(fx-x0,0,1),ty=clamp(fy-y0,0,1),tz=clamp(fz-z0,0,1);
  let total=0,r=0,g=0,b=0;
  for(const [gx,wx] of [[x0,1-tx],[x1,tx]])for(const [gy,wy] of [[y0,1-ty],[y1,ty]])for(const [gz,wz] of [[z0,1-tz],[z1,tz]]){
    const weight=wx*wy*wz;if(weight<=0)continue;
    const at=(gy*field.nz+gz)*field.nx+gx,value=field.level[at]*weight;
    total+=value;r+=field.red[at]*value;g+=field.green[at]*value;b+=field.blue[at]*value;
  }
  out[0]=clamp(total,0,1);
  if(total>.001){out[1]=r/total;out[2]=g/total;out[3]=b/total;}else{out[1]=1;out[2]=1;out[3]=1;}
  return out;
}
