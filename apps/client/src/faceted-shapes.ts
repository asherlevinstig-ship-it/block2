import * as pc from "playcanvas";

/** A clipped cube: 26 flat faces / 44 triangles, shared by every rig.
 * Unlike a sphere it keeps the authored extents, attachment points and flat face. */
export function facetedBoxGeometry(bevel: number) {
  const core = .5 - Math.max(.01, Math.min(.3, bevel));
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  const face = (vertices: number[][], normal: number[]) => {
    const a = vertices[0]!, b = vertices[1]!, c = vertices[2]!;
    const ab = b.map((v, i) => v - a[i]!), ac = c.map((v, i) => v - a[i]!);
    const cross = [ab[1]! * ac[2]! - ab[2]! * ac[1]!, ab[2]! * ac[0]! - ab[0]! * ac[2]!, ab[0]! * ac[1]! - ab[1]! * ac[0]!];
    if (cross.reduce((sum, v, i) => sum + v * normal[i]!, 0) < 0) vertices.reverse();
    const start = positions.length / 3, length = Math.hypot(...normal);
    vertices.forEach((v, i) => { positions.push(...v); normals.push(...normal.map(n => n / length)); uvs.push(i === 1 || i === 2 ? 1 : 0, i >= 2 ? 1 : 0); });
    for (let i = 1; i < vertices.length - 1; i++) indices.push(start, start + i, start + i + 1);
  };
  for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    const n = [0, 0, 0]; n[axis] = sign;
    face([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
      const v = [0, 0, 0]; v[axis] = sign * .5; v[(axis + 1) % 3] = a! * core; v[(axis + 2) % 3] = b! * core; return v;
    }), n);
  }
  for (let free = 0; free < 3; free++) for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const i = (free + 1) % 3, j = (free + 2) % 3;
    const n = [0, 0, 0]; n[i] = a; n[j] = b;
    face([[.5, core, -core], [core, .5, -core], [core, .5, core], [.5, core, core]].map(([x, y, z]) => {
      const v = [0, 0, 0]; v[i] = x! * a; v[j] = y! * b; v[free] = z!; return v;
    }), n);
  }
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1])
    face([[.5 * x, core * y, core * z], [core * x, .5 * y, core * z], [core * x, core * y, .5 * z]], [x, y, z]);
  return { positions, normals, uvs, indices };
}

const cache = new WeakMap<pc.GraphicsDevice, Map<number, pc.Mesh>>();
export function facetedBoxMesh(device: pc.GraphicsDevice, bevel = .12): pc.Mesh {
  let meshes = cache.get(device);
  if (!meshes) { meshes = new Map(); cache.set(device, meshes); }
  let mesh = meshes.get(bevel);
  if (!mesh) {
    const geometry = facetedBoxGeometry(bevel);
    mesh = new pc.Mesh(device);
    mesh.setPositions(geometry.positions); mesh.setNormals(geometry.normals);
    mesh.setUvs(0, geometry.uvs); mesh.setIndices(geometry.indices); mesh.update();
    // Retain cached geometry when individual entity render components are destroyed.
    mesh.incRefCount();
    meshes.set(bevel, mesh);
  }
  return mesh;
}
