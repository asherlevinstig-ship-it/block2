(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BlockcraftDragonShrine=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const site=Object.freeze({x:540.5,z:372.5,y:23,name:'Emberwatch Shrine',guards:3});
  function build(setB,B,terrainHeight){
    const x=Math.floor(site.x),z=Math.floor(site.z);
    for(let dx=-9;dx<=9;dx++)for(let dz=-9;dz<=9;dz++){
      for(let y=1;y<site.y;y++)setB(x+dx,y,z+dz,B.STONE);
      setB(x+dx,site.y-1,z+dz,B.COBBLE);
      for(let y=site.y;y<64;y++)setB(x+dx,y,z+dz,B.AIR);
    }
    for(const dx of [-7,7])for(const dz of [-7,7]){
      for(let y=site.y;y<site.y+5;y++)setB(x+dx,y,z+dz,B.BRICK);
      setB(x+dx,site.y+5,z+dz,B.TORCH);
    }
    setB(x,site.y,z,B.BRICK);
    const end=terrainHeight?terrainHeight(x,z+36):site.y-1;
    for(let i=10;i<=36;i++)for(let dx=-2;dx<=2;dx++){
      const floor=Math.round((site.y-1)+(end-(site.y-1))*(i-9)/27);
      for(let y=1;y<=floor;y++)setB(x+dx,y,z+i,y===floor?B.COBBLE:B.STONE);
      for(let y=floor+1;y<64;y++)setB(x+dx,y,z+i,B.AIR);
    }
  }
  return {site,build};
});
