// Model constructors own these textures. All registered materials share the
// same Lambert settings and receive the same combat tint/opacity updates.
export function atlasModelMaterials({THREE,root,mats}){
  if(!mats.length||mats.some(m=>!m.isMeshLambertMaterial||!m.map?.image))return;
  const tile=32,columns=4,rows=Math.ceil(mats.length/columns);
  const canvas=document.createElement('canvas');canvas.width=columns*tile;canvas.height=rows*tile;
  const context=canvas.getContext('2d');context.imageSmoothingEnabled=false;
  mats.forEach((m,i)=>context.drawImage(m.map.image,i%columns*tile,Math.floor(i/columns)*tile,tile,tile));
  const texture=new THREE.CanvasTexture(canvas);
  texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;
  const material=mats[0].clone();material.map=texture;
  const indices=new Map(mats.map((m,i)=>[m,i]));
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    if(materials.some(m=>!indices.has(m)))return;
    const previous=mesh.geometry;
    const geometry=previous.index?previous.toNonIndexed():previous.clone();
    const uv=geometry.attributes.uv;
    const groups=Array.isArray(mesh.material)?geometry.groups:[{start:0,count:uv.count,materialIndex:0}];
    for(const group of groups){
      const index=indices.get(materials[group.materialIndex]);
      const x=index%columns*tile,y=(rows-1-Math.floor(index/columns))*tile;
      for(let i=group.start;i<group.start+group.count;i++){
        // Half-texel inset prevents neighboring tiles bleeding at UV edges.
        uv.setXY(i,(x+.5+uv.getX(i)*(tile-1))/canvas.width,(y+.5+uv.getY(i)*(tile-1))/canvas.height);
      }
    }
    geometry.clearGroups();mesh.geometry=geometry;mesh.material=material;previous.dispose();
  });
  for(const m of mats){m.map.dispose();m.dispose();}
  mats.splice(0,mats.length,material);
}
