import * as pc from "playcanvas";
import { fastWorldCoastInletCenter, fastWorldCoastInletWaterRadius,
  fastWorldGroundHeight } from "@blockcraft/protocol";

/** Three narrow strips form the visible tidal approach with only three draw
 * calls. The channel is shallow and uses the same height as server movement. */
export function createCoastTidalInletMesh(device: pc.GraphicsDevice, material: pc.StandardMaterial,
  layer: "water" | "wet" | "foam"): pc.Entity {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const banks = layer === "water" ? 1 : 2;
  const segments = 30;
  for (let bank = 0; bank < banks; bank++) {
    const start = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const z = 154 + i;
      const center = fastWorldCoastInletCenter(z);
      const radius = fastWorldCoastInletWaterRadius(z);
      const offsets = layer === "water" ? [-radius, radius]
        : layer === "wet" ? bank === 0 ? [-radius - 1.15, -radius + .08] : [radius - .08, radius + 1.15]
          : bank === 0 ? [-radius - .2, -radius + .12] : [radius - .12, radius + .2];
      for (const offset of offsets) {
        const x = center + offset;
        positions.push(x, fastWorldGroundHeight(x, z) + (layer === "foam" ? .075 : layer === "water" ? .062 : .042), z);
        uvs.push(x / 5, z / 5);
      }
      if (i < segments) {
        const n = start + i * 2;
        indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
      }
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
  const entity = new pc.Entity(`coast-tidal-inlet-${layer}`);
  entity.addComponent("render", { meshInstances: [new pc.MeshInstance(mesh, material, entity)], castShadows: false });
  return entity;
}

/** Irregular oval water and its narrow foam edge replace visible rectangular
 * primitive sheets. The shallow surface rides the shared terrain height. */
export function createCoastShallowMesh(device: pc.GraphicsDevice, material: pc.StandardMaterial,
  x: number, z: number, width: number, depth: number, yaw: number, foam = false): pc.Entity {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const segments = 40;
  const radians = yaw * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const rings = foam ? [.91, 1.02] : [0, .5, 1];
  for (let ring = 0; ring < rings.length; ring++) for (let i = 0; i <= segments; i++) {
    const angle = i / segments * Math.PI * 2;
    const radius = rings[ring]! * (1 + .065 * Math.sin(angle * 5 + x) + .035 * Math.cos(angle * 9 + z));
    const dx = Math.cos(angle) * width * .5 * radius;
    const dz = Math.sin(angle) * depth * .5 * radius;
    const wx = x + dx * cos - dz * sin, wz = z + dx * sin + dz * cos;
    positions.push(wx, fastWorldGroundHeight(wx, wz) + (foam ? .072 : .058), wz);
    uvs.push(wx / 5, wz / 5);
    if (ring && i < segments) {
      const n = (ring - 1) * (segments + 1) + i;
      indices.push(n, n + 1, n + segments + 1, n + 1, n + segments + 2, n + segments + 1);
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
  const entity = new pc.Entity(foam ? "coast-foam-edge" : "coast-shallow-water");
  entity.addComponent("render", { meshInstances: [new pc.MeshInstance(mesh, material, entity)], castShadows: false });
  return entity;
}

/** A narrow irregular wet-sand band follows the real ground, instead of
 * floating as a flat cylinder at the edge of each shallow sheet. */
export function createCoastWetShoreMesh(device: pc.GraphicsDevice, material: pc.StandardMaterial,
  x: number, z: number, width: number, depth: number): pc.Entity {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const segments = Math.ceil(width / 1.2);
  for (let i = 0; i <= segments; i++) {
    const wx = x + (i / segments - .5) * width;
    const wave = Math.sin(wx * .67) * .24 + Math.sin(wx * 1.31) * .09;
    const nearZ = z - depth * .5 - .7 + wave;
    for (const edgeZ of [nearZ - .85, nearZ + .48]) {
      positions.push(wx, fastWorldGroundHeight(wx, edgeZ) + .045, edgeZ);
      uvs.push(wx / 5, edgeZ / 5);
    }
    if (i < segments) {
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
  const entity = new pc.Entity("coast-wet-shore");
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
