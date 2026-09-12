// Merge rigid sibling details, preserving the nodes that combat animates.
export function batchStaticModelParts({THREE,root,animated=[]}){
  const protectedNodes=new Set(animated);
  const visit=parent=>{
    for(const child of [...parent.children])visit(child);
    const batches=new Map();
    for(const child of parent.children){
      if(!child.isMesh||child.children.length||protectedNodes.has(child)||Array.isArray(child.material)||!child.visible)continue;
      if(!child.geometry.attributes.normal||!child.geometry.attributes.uv)continue;
      const group=batches.get(child.material)||[];group.push(child);batches.set(child.material,group);
    }
    for(const [material,parts] of batches){
      if(parts.length<2)continue;
      const geometries=parts.map(part=>{
        part.updateMatrix();return (part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone()).applyMatrix4(part.matrix);
      });
      const merged=new THREE.BufferGeometry();
      for(const name of ['position','normal','uv']){
        const size=geometries[0].attributes[name].itemSize;
        const array=new Float32Array(geometries.reduce((n,g)=>n+g.attributes[name].array.length,0));
        let offset=0;
        for(const g of geometries){array.set(g.attributes[name].array,offset);offset+=g.attributes[name].array.length;}
        merged.setAttribute(name,new THREE.BufferAttribute(array,size));
      }
      merged.computeBoundingSphere();
      const mesh=new THREE.Mesh(merged,material);mesh.name='batched-model-details';parent.add(mesh);
      // These constructors own their box geometries; materials remain shared.
      for(const part of parts){parent.remove(part);part.geometry.dispose();}
      for(const g of geometries)g.dispose();
    }
  };
  visit(root);
  root.traverse(node=>{
    if(node!==root&&!protectedNodes.has(node)){node.updateMatrix();node.matrixAutoUpdate=false;}
  });
}

// Build a rigid, single-pose version of a model for dense scenes. The authored
// model remains untouched and can be restored as soon as the crowd clears.
export function createStaticModelProxy({THREE,root,roots=[root],materials=null}){
  root.updateMatrixWorld(true);
  const allowed=materials?new Set(materials):null;
  const inverseRoot=root.matrixWorld.clone().invert(),batches=new Map();
  for(const branch of roots)branch.traverse(node=>{
    if(!node.isMesh||Array.isArray(node.material)||(allowed&&!allowed.has(node.material))||!node.geometry?.attributes?.position)return;
    const transform=new THREE.Matrix4().multiplyMatrices(inverseRoot,node.matrixWorld);
    const geometry=(node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone()).applyMatrix4(transform);
    const batch=batches.get(node.material)||[];batch.push(geometry);batches.set(node.material,batch);
  });
  const proxy=new THREE.Group();proxy.name='crowded-combat-model';
  for(const [material,geometries] of batches){
    const names=['position'];
    if(geometries.every(g=>g.attributes.normal))names.push('normal');
    if(geometries.every(g=>g.attributes.uv))names.push('uv');
    const merged=new THREE.BufferGeometry();
    for(const name of names){
      const size=geometries[0].attributes[name].itemSize;
      const array=new Float32Array(geometries.reduce((n,g)=>n+g.attributes[name].array.length,0));
      let offset=0;for(const geometry of geometries){array.set(geometry.attributes[name].array,offset);offset+=geometry.attributes[name].array.length;}
      merged.setAttribute(name,new THREE.BufferAttribute(array,size));
    }
    merged.computeBoundingSphere();proxy.add(new THREE.Mesh(merged,material));
    for(const geometry of geometries)geometry.dispose();
  }
  proxy.visible=false;root.add(proxy);return proxy;
}
