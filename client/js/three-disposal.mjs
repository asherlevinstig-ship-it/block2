// Dispose an object tree after it has been detached from the scene. Resources are
// de-duplicated within the tree because voxel models commonly share one material.
export function disposeObjectTree(root,{remove=true}={}){
  if(!root)return {geometries:0,materials:0,textures:0};
  if(remove&&root.parent)root.parent.remove(root);
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(node=>{
    if(node.geometry)geometries.add(node.geometry);
    const nodeMaterials=node.material?(Array.isArray(node.material)?node.material:[node.material]):[];
    for(const material of nodeMaterials){
      if(!material)continue;
      materials.add(material);
      for(const key of Object.keys(material)){
        const value=material[key];
        if(value&&value.isTexture)textures.add(value);
      }
    }
  });
  textures.forEach(texture=>texture.dispose());
  materials.forEach(material=>material.dispose());
  geometries.forEach(geometry=>geometry.dispose());
  return {geometries:geometries.size,materials:materials.size,textures:textures.size};
}
