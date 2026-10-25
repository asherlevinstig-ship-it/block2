import * as pc from "playcanvas";

export type WoodlandTreeShape = "oak" | "crooked" | "sapling";
const foliageMaterials = new WeakMap<pc.Material, pc.StandardMaterial>();
const shapes = new WeakMap<pc.Mesh, Map<WoodlandTreeShape, pc.Mesh>>();

/** Reuse three meshes across the woodland. Keep the trunk narrow and spread
 * the crown above head height rather than inflating the whole imported model. */
export function shapeWoodlandTree(device: pc.GraphicsDevice, entity: pc.Entity, shape: WoodlandTreeShape): void {
  for (const node of entity.find(node => Boolean((node as pc.Entity).render))) {
    for (const instance of (node as pc.Entity).render!.meshInstances) {
      const source = instance.mesh;
      let variants = shapes.get(source);
      if (!variants) { variants = new Map(); shapes.set(source, variants); }
      let mesh = variants.get(shape);
      if (!mesh) {
        const positions: number[] = [], uv: number[] = [], indices: number[] = [], colors: number[] = [];
        source.getPositions(positions); source.getUvs(0, uv); source.getIndices(indices);
        for (let i = 0; i < positions.length; i += 3) {
          const y = positions[i + 1]!;
          const crown = Math.max(0, Math.min(1, (y - .7) / .5));
          // Restrain the imported mint-green canopy without tinting its bark.
          colors.push(1 - crown * .13, 1 - crown * .2, 1 - crown * .45, 1);
          const width = shape === "oak" ? 2.8 : shape === "crooked" ? 2 : .85;
          positions[i] = positions[i]! * (1 + crown * (width - 1));
          positions[i + 2] = positions[i + 2]! * (1 + crown * (width * .87 - 1));
          // Raised, compressed crown reads as a spreading deciduous tree.
          positions[i + 1] = y < .8 ? y * 1.6 : 1.28 + (y - .8) * (shape === "oak" ? .8 : 1);
          if (shape === "crooked") positions[i] = positions[i]! + crown * .32;
        }
        mesh = new pc.Mesh(device);
        mesh.setPositions(positions); mesh.setNormals(pc.calculateNormals(positions, indices));
        mesh.setUvs(0, uv); mesh.setColors(colors); mesh.setIndices(indices); mesh.update();
        variants.set(shape, mesh);
      }
      instance.mesh = mesh;
      if (instance.material instanceof pc.StandardMaterial) {
        const sourceMaterial = instance.material;
        let material = foliageMaterials.get(sourceMaterial);
        if (!material) {
          material = sourceMaterial.clone(); material.diffuseVertexColor = true;
          material.update(); foliageMaterials.set(sourceMaterial, material);
        }
        instance.material = material;
      }
    }
  }
}
