// Architectural crowns sit above the existing walls; the street-level collision
// and seven-block gate openings remain defined by the shared voxel world.
export function createTownLandmarks({THREE,town,textureFor}){
  const group=new THREE.Group();group.name='town-landmark-crowns';
  group.position.set(town.TC+.5,town.G,town.TC+.5);
  const batches={stone:[],brass:[],teal:[],rune:[]};
  const box=(material,x,y,z,w,h,d,rotation=0)=>batches[material].push({x,y,z,w,h,d,rotation});
  for(const side of [-1,1]){
    const x=side*7,z=-town.HS;
    // Unequal tiers make the adventure gate recognizable at a distance.
    box('stone',x,9,z,4,6,2.8);
    box('stone',x,12.4,z,4.8,.8,3.4);
    box('stone',x,15.1,z,3.2,4.6,2.4);
    box('brass',x,17.5,z,3.8,.3,2.8);
    box('stone',x,18.6,z,2.4,2,2);
    box('stone',x,20.1,z,1.3,1,1.3);
    box('rune',x,15.2,z+1.23,.55,2.3,.08);
    box('rune',x,20.9,z,.4,.6,.4);
    box('teal',x,9.3,z+1.46,1.7,3.3,.08);
    box('brass',x,7.8,z+1.51,1.7,.18,.08);
    for(const offset of [-1.65,1.65])box('stone',x+offset,13.35,z,.65,1.2,2.8);
  }
  box('stone',0,11.6,-town.HS,10,1.4,2.4);
  box('brass',0,10.85,-town.HS+1.25,10,.15,.1);
  box('stone',0,13,-town.HS,3,1.5,2.2);
  box('rune',0,14.6,-town.HS+.1,1.2,1.2,.7,Math.PI/4);
  // Arrival has a lower, warmer silhouette, distinct from the adventure exit.
  for(const side of [-1,1]){
    const x=side*6,z=town.HS;
    box('stone',x,7.3,z,3,2.6,2.5);
    box('brass',x,8.8,z,3.6,.4,2.9);
    box('stone',x,9.5,z,2,.9,1.8);
    box('brass',x,10.2,z,1.2,.5,1.2);
    box('teal',x,7.2,z-1.3,1.6,2.2,.08);
    box('brass',x,6.25,z-1.36,1.6,.16,.08);
  }
  const materials={
    stone:new THREE.MeshLambertMaterial({color:0x394456}),
    brass:new THREE.MeshLambertMaterial({color:0xcfa35c}),
    teal:new THREE.MeshLambertMaterial({color:0x267e86}),
    rune:new THREE.MeshLambertMaterial({color:0xc5a0ec,emissive:0x7545ad,emissiveIntensity:.65}),
  };
  for(const name of ['stone','brass','teal']){
    const material=materials[name];
    material.map=textureFor('#'+material.color.getHexString()).map;
    material.color.set(0xffffff);
  }
  const geometry=new THREE.BoxGeometry(1,1,1),transform=new THREE.Object3D();
  for(const [name,parts] of Object.entries(batches)){
    const mesh=new THREE.InstancedMesh(geometry,materials[name],parts.length);
    mesh.name='town-crown-'+name;
    for(let i=0;i<parts.length;i++){
      const p=parts[i];transform.position.set(p.x,p.y,p.z);transform.scale.set(p.w,p.h,p.d);
      transform.rotation.set(0,0,p.rotation);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);
    }
    // r128 has no aggregate instance bounds. Parent follows overworld visibility.
    mesh.frustumCulled=false;group.add(mesh);
  }
  return group;
}
