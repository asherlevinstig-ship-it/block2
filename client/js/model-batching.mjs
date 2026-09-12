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
