const test = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');

test('static batching preserves transformed surfaces and animated pivots', async () => {
  const { batchStaticModelParts } = await import('../../client/js/model-batching.mjs');
  const root = new THREE.Group();
  const arm = new THREE.Group();
  root.add(arm);
  const material = new THREE.MeshBasicMaterial();
  for (let i = 0; i < 3; i++) {
    const part = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), material);
    part.position.set(i * 2, i, 0);
    part.rotation.z = i * 0.3;
    arm.add(part);
  }
  const leg = new THREE.Mesh(new THREE.BoxGeometry(), material);
  root.add(leg);
  const surfaces = () => {
    root.updateMatrixWorld(true);
    const points = [];
    root.traverse(mesh => {
      if (!mesh.isMesh) return;
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
        points.push([p.x, p.y, p.z]);
      }
      if (geometry !== mesh.geometry) geometry.dispose();
    });
    return points;
  };
  const before = surfaces();
  arm.rotation.y = 0.8;
  const animatedBefore = surfaces();
  arm.rotation.y = 0;
  batchStaticModelParts({ THREE, root, animated: [arm, leg] });
  assert.equal(arm.children.length, 1);
  assert.equal(leg.parent, root);
  assert.equal(arm.children[0].material, material);
  const close = (actual, expected) => {
    assert.equal(actual.length, expected.length);
    actual.forEach((p, i) => p.forEach((v, axis) => assert.ok(Math.abs(v - expected[i][axis]) < 0.00001)));
  };
  close(surfaces(), before);
  arm.rotation.y = 0.8;
  close(surfaces(), animatedBefore);
});

test('crowded-combat proxy merges allowed model material without mutating detailed parts',async()=>{
  const {createStaticModelProxy}=await import('../../client/js/model-batching.mjs');
  const root=new THREE.Group(),limb=new THREE.Group();root.add(limb);
  const bodyMaterial=new THREE.MeshLambertMaterial(),detailMaterial=new THREE.MeshBasicMaterial();
  const body=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),bodyMaterial);body.position.set(1,.5,0);limb.add(body);
  const arm=new THREE.Mesh(new THREE.BoxGeometry(.4,1,.4),bodyMaterial);arm.position.set(-.8,1,0);root.add(arm);
  const eye=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),detailMaterial);eye.position.set(1,1,-.5);limb.add(eye);
  const bodyVertexCount=body.geometry.toNonIndexed().attributes.position.count+arm.geometry.toNonIndexed().attributes.position.count;
  const proxy=createStaticModelProxy({THREE,root,roots:[limb,arm],materials:[bodyMaterial]});
  assert.equal(proxy.visible,false);
  assert.equal(proxy.children.length,1);
  assert.equal(proxy.children[0].material,bodyMaterial);
  assert.equal(proxy.children[0].geometry.attributes.position.count,bodyVertexCount);
  assert.equal(body.parent,limb);
  assert.equal(arm.parent,root);
  assert.equal(eye.parent,limb);
});

test('model atlas keeps face UVs, pivots and combat tint controls', async () => {
  const {atlasModelMaterials}=await import('../../client/js/model-atlas.mjs');
  const previousDocument=global.document;
  const draws=[];
  global.document={createElement:()=>({getContext:()=>({drawImage:(...args)=>draws.push(args)})})};
  try {
    const root=new THREE.Group();
    const mats=Array.from({length:6},()=>new THREE.MeshLambertMaterial({map:new THREE.Texture({width:16,height:16})}));
    const head=new THREE.Mesh(new THREE.BoxGeometry(),mats.slice());root.add(head);
    const originalPositions=head.geometry.toNonIndexed().attributes.position.array.slice();
    atlasModelMaterials({THREE,root,mats});
    assert.equal(draws.length,6);
    assert.equal(mats.length,1);
    assert.equal(head.material,mats[0]);
    assert.equal(head.parent,root);
    assert.deepEqual(head.geometry.attributes.position.array,originalPositions);
    assert.equal(head.geometry.groups.length,0);
    const uv=head.geometry.attributes.uv;
    for(let face=0;face<6;face++)for(let i=face*6;i<face*6+6;i++){
      const u=uv.getX(i),v=uv.getY(i);
      assert.ok(u>face%4/4&&u<(face%4+1)/4);
      assert.ok(v>(1-Math.floor(face/4))/2&&v<(2-Math.floor(face/4))/2);
    }
    mats.forEach(m=>{m.color.setRGB(1,.2,.2);m.opacity=.5;});
    assert.equal(head.material.color.g,.2);
    assert.equal(head.material.opacity,.5);
  } finally {if(previousDocument===undefined)delete global.document;else global.document=previousDocument;}
});

test('villager atlasing preserves shared source textures and separates transparent shadows',async()=>{
  const {atlasModelMaterials}=await import('../../client/js/model-atlas.mjs');
  const previousDocument=global.document;
  global.document={createElement:()=>({getContext:()=>({drawImage:()=>{}})})};
  try{
    const root=new THREE.Group(),source=new THREE.Texture({width:16,height:16});
    let disposed=0;source.dispose=()=>{disposed++;};
    const bodyMat=new THREE.MeshLambertMaterial({map:source});
    const shadowMat=new THREE.MeshBasicMaterial({map:source,transparent:true});
    const body=new THREE.Mesh(new THREE.BoxGeometry(),bodyMat),shadow=new THREE.Mesh(new THREE.PlaneGeometry(),shadowMat);
    root.add(body,shadow);
    const mats=[bodyMat];
    atlasModelMaterials({THREE,root,mats,disposeSourceTextures:false});
    assert.equal(disposed,0);
    assert.equal(body.material,mats[0]);
    assert.equal(shadow.material,shadowMat);
    assert.equal(body.material.map===source,false);
  }finally{if(previousDocument===undefined)delete global.document;else global.document=previousDocument;}
});
