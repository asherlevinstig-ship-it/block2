import * as pc from "playcanvas";
import { fastWorldCoastShorelineZ, fastWorldGroundHeight } from "@blockcraft/protocol";

/** A single sea surface runs beyond the camera's far plane. The two narrow
 * shoreline layers are optional and share its authored, irregular edge. */
export function createCoastOceanMesh(device: pc.GraphicsDevice, material: pc.StandardMaterial,
  layer: "water" | "wet" | "surf"): pc.Entity {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const firstX = layer === "water" ? -100 : 40;
  const lastX = layer === "water" ? 110 : 104;
  const step = 2;
  const count = (lastX - firstX) / step;
  for (let i = 0; i <= count; i++) {
    const x = firstX + i * step;
    const shore = fastWorldCoastShorelineZ(x);
    const nearZ = layer === "wet" ? shore - 2.2 : layer === "surf" ? shore + .18 : shore;
    const farZ = layer === "wet" ? shore + .05 : layer === "surf" ? shore + .31 : 340;
    for (const z of [nearZ, farZ]) {
      const y = layer === "water" ? 8.075 : fastWorldGroundHeight(x, z) + (layer === "surf" ? .095 : .045);
      positions.push(x, y, z);
      uvs.push(x / 5, z / 5);
    }
    if (i < count && (layer !== "surf" || i % 7 < 3)) {
      const n = i * 2;
      indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
  }
  const mesh = new pc.Mesh(device);
  const normals = pc.calculateNormals(positions, indices);
  mesh.setPositions(positions);
  mesh.setNormals(normals);
  mesh.setUvs(0, uvs);
  mesh.setVertexStream(pc.SEMANTIC_TANGENT, pc.calculateTangents(positions, normals, uvs, indices), 4);
  mesh.setIndices(indices);
  mesh.update();
  const entity = new pc.Entity(`coast-ocean-${layer}`);
  entity.addComponent("render", { meshInstances: [new pc.MeshInstance(mesh, material, entity)], castShadows: false });
  return entity;
}

/** A small tileable normal map keeps the shoreline moving without a screen-space
 * reflection pass or per-frame geometry updates. */
export function createCoastWaterNormalMap(app: pc.Application): pc.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!;
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x * Math.PI * 2 / size;
    const v = y * Math.PI * 2 / size;
    const nx = Math.cos(u * 3 + Math.sin(v * 2) * .45) * .19
      + Math.cos(u * 7 - v * 2) * .075;
    const ny = Math.cos(v * 4 + Math.sin(u * 2) * .4) * .17
      + Math.cos(v * 9 + u * 2) * .055;
    const index = (y * size + x) * 4;
    image.data[index] = Math.round(128 + nx * 127);
    image.data[index + 1] = Math.round(128 + ny * 127);
    image.data[index + 2] = Math.round(255 * Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)));
    image.data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const texture = new pc.Texture(app.graphicsDevice, {
    name: "sunken-coast-water-normal",
    width: size, height: size, mipmaps: true,
    minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
    magFilter: pc.FILTER_LINEAR,
    addressU: pc.ADDRESS_REPEAT, addressV: pc.ADDRESS_REPEAT,
  });
  texture.setSource(canvas);
  return texture;
}

/** Throttled material updates are enough for visible current at combat speed. */
export function createCoastWaterAnimator(materials: readonly pc.StandardMaterial[]): (dt: number, active: boolean) => void {
  let elapsed = 0;
  let offset = 0;
  return (dt, active) => {
    if (!active) return;
    elapsed += dt;
    if (elapsed < 1 / 12) return;
    offset += elapsed * .012;
    elapsed = 0;
    for (let index = 0; index < materials.length; index++) {
      const material = materials[index]!;
      const speed = index === 0 ? 1 : .55;
      material.diffuseMapOffset.set(offset * speed, offset * speed * .34);
      material.normalMapOffset.set(offset * speed * 1.4, -offset * speed * .7);
      material.update();
    }
  };
}
