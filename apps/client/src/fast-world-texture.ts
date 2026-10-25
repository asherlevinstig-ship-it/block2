import * as pc from "playcanvas";
import { FAST_WORLD_REGION_DEFINITIONS } from "@blockcraft/protocol";

export interface PaintedGroundStyle {
  name: string;
  base: string;
  mottles: readonly string[];
  litter: readonly string[];
  seed: number;
  roughness?: number;
  pattern?: "stone" | "grass" | "sand" | "water" | "bark" | "soil";
}

const textureCache = new WeakMap<pc.GraphicsDevice, Map<string, pc.Texture>>();

/** Ground slabs share materials but use metre-scaled UVs, allowing static batching
 * without stretching the same texture across both long and short road axes. */
export function fitGroundTexture(device: pc.GraphicsDevice, entity: pc.Entity, material: pc.StandardMaterial,
  scale: readonly [number, number, number], position: readonly [number, number, number]): void {
  if (!entity.render || !material.diffuseMap || scale[1] > .5 || Math.min(scale[0], scale[2]) < 1) return;
  const region = FAST_WORLD_REGION_DEFINITIONS.find(r => entity.name.startsWith(`${r.id}-ground:`));
  const road = /road|forecourt|approach/.test(entity.name);
  const feather = !!region || road || entity.name === "west-green";
  const spacing = road ? .5 : 1.5;
  const nx = Math.max(2, Math.ceil(scale[0] / spacing)), nz = Math.max(2, Math.ceil(scale[2] / spacing));
  const positions: number[] = [], uvs: number[] = [], colors: number[] = [], indices: number[] = [], normals: number[] = [];
  const tileSize = /plaza/.test(material.name) ? 6 : 5;
  for (let z = 0; z <= nz; z++) for (let x = 0; x <= nx; x++) {
    const lx = x / nx - .5, lz = z / nz - .5;
    const wx = position[0] + lx * scale[0], wz = position[2] + lz * scale[2];
    const variation = .88 + .08 * Math.sin(wx * .17 + Math.sin(wz * .12)) + .04 * Math.cos(wz * .31 - wx * .08);
    let alpha = 1;
    if (region) {
      const b = region.bounds;
      const edge = Math.min(wx - b.minX, b.maxX - wx, wz - b.minZ, b.maxZ - wz);
      alpha = Math.max(0, Math.min(1, (edge - .8 - Math.sin(wx * .6 + wz * .43) * .8) / 4));
    } else if (feather) {
      const edge = Math.min((.5 - Math.abs(lx)) * scale[0], (.5 - Math.abs(lz)) * scale[2]);
      alpha = Math.max(0, Math.min(1, (edge - .14 + Math.sin(wx * 1.3 + wz * .9) * .3) / .45));
    }
    positions.push(lx, .5, lz); normals.push(0, 1, 0);
    uvs.push(wx / tileSize / material.diffuseMapTiling.x, wz / tileSize / material.diffuseMapTiling.y);
    colors.push(variation, variation, variation, alpha);
    if (x < nx && z < nz) { const i = z * (nx + 1) + x; indices.push(i, i + nx + 1, i + 1, i + 1, i + nx + 1, i + nx + 2); }
  }
  const mesh = new pc.Mesh(device);
  mesh.setPositions(positions); mesh.setNormals(normals); mesh.setUvs(0, uvs); mesh.setColors(colors); mesh.setIndices(indices); mesh.update();
  entity.render.meshInstances = [new pc.MeshInstance(mesh, terrainVertexMaterial(material, feather), entity)];
  entity.render.meshInstances[0]!.drawBucket = region ? 240 : road ? 230 : 245;
  entity.render.castShadows = false;

}

const terrainMaterials = new WeakMap<pc.StandardMaterial, Map<boolean, pc.StandardMaterial>>();
function terrainVertexMaterial(source: pc.StandardMaterial, feather: boolean): pc.StandardMaterial {
  let variants = terrainMaterials.get(source);
  if (!variants) { variants = new Map(); terrainMaterials.set(source, variants); }
  let material = variants.get(feather);
  if (!material) {
    material = source.clone(); material.diffuseVertexColor = true;
    if (feather) { material.opacityVertexColor = true; material.opacityVertexColorChannel = "a";
      material.blendType = pc.BLEND_NORMAL; material.depthWrite = false; }
    material.update(); variants.set(feather, material);
  }
  return material;
}

/** Soft irregular patches replace obvious circular stamps; geometry stays on the
 * authoritative ground plane and shares cached materials for static batching. */
export function fitOrganicGroundPatch(device: pc.GraphicsDevice, entity: pc.Entity, material: pc.StandardMaterial,
  scale: readonly [number, number, number], position: readonly [number, number, number]): void {
  if (!entity.render || Math.min(scale[0], scale[2]) < 1 || /plaza|civic/.test(entity.name)) return;
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], colors: number[] = [], indices: number[] = [];
  const segments = 32, rings = [0, .55, .8, 1];
  for (let ring = 0; ring < rings.length; ring++) for (let i = 0; i <= segments; i++) {
    const angle = i / segments * Math.PI * 2;
    const radius = rings[ring]! * (.44 + .035 * Math.sin(angle * 5 + position[0]) + .025 * Math.cos(angle * 7 + position[2]));
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    const height = scale[1] > .1 ? Math.pow(1 - rings[ring]!, 1.7) - .36 : .5;
    positions.push(x, height, z); normals.push(0, 1, 0);
    uvs.push((position[0] + x * scale[0]) / 5 / material.diffuseMapTiling.x,
      (position[2] + z * scale[2]) / 5 / material.diffuseMapTiling.y);
    colors.push(1, 1, 1, ring === 3 ? 0 : ring === 2 ? .72 : 1);
    if (ring < rings.length - 1 && i < segments) { const n = ring * (segments + 1) + i;
      indices.push(n, n + 1, n + segments + 1, n + 1, n + segments + 2, n + segments + 1); }
  }
  const mesh = new pc.Mesh(device); mesh.setPositions(positions); mesh.setNormals(normals); mesh.setUvs(0, uvs);
  mesh.setColors(colors); mesh.setIndices(indices); mesh.update();
  entity.render.meshInstances = [new pc.MeshInstance(mesh, terrainVertexMaterial(material, true), entity)];
  entity.render.meshInstances[0]!.drawBucket = /rim|foam/.test(entity.name) ? 225 : 220;
  entity.render.castShadows = false;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ state >>> 15, 1 | state);
    state ^= state + Math.imul(state ^ state >>> 7, 61 | state);
    return ((state ^ state >>> 14) >>> 0) / 4_294_967_296;
  };
}

/** A small deterministic painted texture is cheaper than a large downloaded
 * ground map and keeps the low-poly world legible on tablet-class GPUs. */
export function createPaintedGroundMaterial(
  app: pc.Application,
  style: PaintedGroundStyle,
  tiling: readonly [number, number],
): pc.StandardMaterial {
  let textures = textureCache.get(app.graphicsDevice);
  if (!textures) { textures = new Map(); textureCache.set(app.graphicsDevice, textures); }
  const key = JSON.stringify(style);
  const pattern = style.pattern ?? (/plaza|stone|basalt/.test(style.name) ? "stone"
    : /sand/.test(style.name) ? "sand" : /water|shallows/.test(style.name) ? "water"
      : /bark/.test(style.name) ? "bark" : /meadow|verge|moss|forest|marsh/.test(style.name) ? "grass" : "soil");
  let texture = textures.get(key);
  if (!texture) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  const random = seededRandom(style.seed);
  context.fillStyle = style.base;
  context.fillRect(0, 0, size, size);

  // Broad translucent mottles stop large terrain slabs reading as one colour.
  for (let index = 0; index < 120; index++) {
    const radius = 8 + random() * 28;
    context.globalAlpha = .08 + random() * .13;
    context.fillStyle = style.mottles[index % style.mottles.length]!;
    const x = random() * size, y = random() * size, ry = radius * (.45 + random() * .8), rotation = random() * Math.PI;
    // Wrap broad marks at the texture boundary to avoid a grid of visible seams.
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      const gradient = context.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, radius);
      gradient.addColorStop(0, style.mottles[index % style.mottles.length]!);
      gradient.addColorStop(1, `${style.mottles[index % style.mottles.length]}00`);
      context.fillStyle = gradient;
      context.beginPath(); context.ellipse(x + dx, y + dy, radius, ry, rotation, 0, Math.PI * 2); context.fill();
    }
  }

  // Tiny leaves, needles and stones supply texture without visual noise at combat distance.
  context.globalAlpha = pattern === "water" ? .09 : .25;
  for (let index = 0; index < (pattern === "grass" ? 640 : 220); index++) {
    const x = random() * size;
    const y = random() * size;
    const length = pattern === "grass" ? 3 + random() * 6 : 1 + random() * 3;
    context.save();
    context.translate(x, y);
    context.rotate(random() * Math.PI);
    context.fillStyle = style.litter[index % style.litter.length]!;
    context.beginPath();
    context.moveTo(-length * .5, 0); context.lineTo(length * .5, -.5);
    context.lineTo(0, 1.1 + random()); context.closePath(); context.fill();
    context.restore();
  }
  context.globalAlpha = 1;

  if (pattern === "stone" && !/plaza/.test(style.name)) {
    // Natural fractured bedrock, without the regular mortar of town paving.
    context.strokeStyle = style.litter[1 % style.litter.length]!; context.globalAlpha = .28;
    context.lineWidth = 1.5;
    for (let index = 0; index < 36; index++) {
      const x = random() * size, y = random() * size;
      context.beginPath(); context.moveTo(x, y);
      context.lineTo(x + 8 + random() * 12, y + 5);
      context.lineTo(x + 15, y + 15 + random() * 14); context.stroke();
    }
  } else if (pattern === "stone") {
    // Staggered paving has recessed mortar, chipped outlines and sunlit edges.
    for (let row = 0; row < 8; row++) for (let column = -1; column < 5; column++) {
      const x = column * 64 + (row % 2) * 32, y = row * 32;
      context.globalAlpha = .22;
      context.fillStyle = style.mottles[(row * 3 + column + 7) % style.mottles.length]!;
      context.fillRect(x + 2, y + 2, 60, 28);
      context.globalAlpha = .36; context.strokeStyle = style.litter[1 % style.litter.length]!;
      context.lineWidth = 1.8; context.strokeRect(x + 1, y + 1, 62, 30);
      context.globalAlpha = .2; context.strokeStyle = style.litter[0]!; context.lineWidth = 1;
      context.beginPath(); context.moveTo(x + 4, y + 28); context.lineTo(x + 4, y + 4); context.lineTo(x + 59, y + 4); context.stroke();
    }
  } else if (pattern === "sand" || pattern === "water" || pattern === "bark") {
    context.strokeStyle = style.litter[0]!; context.lineWidth = pattern === "water" ? 1.6 : 1;
    context.globalAlpha = pattern === "bark" ? .2 : .14;
    for (let row = -1; row < 18; row++) {
      context.beginPath();
      for (let x = 0; x <= size; x += 4) {
        const wave = row * 16 + Math.sin(x / size * Math.PI * 4 + row * .7) * 3;
        if (pattern === "bark") context.lineTo(wave, x); else context.lineTo(x, wave);
      }
      context.stroke();
    }
  }
  context.globalAlpha = 1;

  texture = new pc.Texture(app.graphicsDevice, {
    name: style.name,
    width: size,
    height: size,
    mipmaps: true,
    minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
    magFilter: pc.FILTER_LINEAR,
    addressU: pc.ADDRESS_REPEAT,
    addressV: pc.ADDRESS_REPEAT,
    anisotropy: 4,
  });
  texture.setSource(canvas);
  textures.set(key, texture);
  }

  const material = new pc.StandardMaterial();
  material.name = style.name;
  material.diffuse = new pc.Color(1, 1, 1);
  material.diffuseMap = texture;
  material.diffuseMapTiling = new pc.Vec2(tiling[0], tiling[1]);
  material.specular = new pc.Color(.025, .03, .022);
  material.gloss = style.roughness ?? (pattern === "water" ? .52 : .06);
  material.update();
  return material;
}

/** One continuous ribbon per route, with metre-scaled UVs and feathered verges. */
export function createWoodlandTrailMesh(device: pc.GraphicsDevice, entity: pc.Entity,
  material: pc.StandardMaterial, points: readonly (readonly [number, number, number])[]): void {
  const vertices: number[] = [], normals: number[] = [], uv: number[] = [], colors: number[] = [], indices: number[] = [];
  const lanes = [-1, -.78, -.35, .35, .78, 1];
  points.forEach((point,i) => {
    const before = points[Math.max(0,i-1)]!, after = points[Math.min(points.length-1,i+1)]!;
    const dx=after[0]-before[0], dz=after[1]-before[1], length=Math.hypot(dx,dz)||1;
    lanes.forEach((lane,j) => {
      const width=point[2]*.5 + Math.sin(i*.71)*.12;
      const x=point[0]-dz/length*lane*width, z=point[1]+dx/length*lane*width;
      vertices.push(x,8.095,z); normals.push(0,1,0);
      uv.push(x/5/material.diffuseMapTiling.x,z/5/material.diffuseMapTiling.y);
      const tone = .78 + Math.abs(lane)*.13 + Math.sin(i*.21)*.025;
      colors.push(tone,tone,tone,j===0||j===lanes.length-1?0:1);
      if(i<points.length-1 && j<lanes.length-1) {
        const n=i*lanes.length+j; indices.push(n,n+1,n+lanes.length,n+1,n+lanes.length+1,n+lanes.length);
      }
    });
  });
  const mesh=new pc.Mesh(device); mesh.setPositions(vertices); mesh.setNormals(normals); mesh.setUvs(0,uv);
  mesh.setColors(colors); mesh.setIndices(indices); mesh.update();
  entity.addComponent("render",{meshInstances:[new pc.MeshInstance(mesh,terrainVertexMaterial(material,true),entity)],castShadows:false});
  entity.render!.meshInstances[0]!.drawBucket=230;
}

const woodlandFernMeshes = new WeakMap<pc.GraphicsDevice, pc.Mesh>();
/** Twenty triangles for a whole fern, shared by every placement. */
export function woodlandFernMesh(device: pc.GraphicsDevice): pc.Mesh {
  const cached=woodlandFernMeshes.get(device); if(cached) return cached;
  const positions:number[]=[], indices:number[]=[];
  for(let leaf=0;leaf<5;leaf++) {
    const a=leaf*Math.PI*2/5, dx=Math.cos(a), dz=Math.sin(a), n=positions.length/3;
    positions.push(0,0,0,dx*.32-dz*.12,.18,dz*.32+dx*.12,
      dx*.72,.1,dz*.72,dx*.32+dz*.12,.18,dz*.32-dx*.12,dx*.34,.23,dz*.34);
    indices.push(n,n+1,n+4,n+1,n+2,n+4,n+2,n+3,n+4,n+3,n,n+4);
  }
  const mesh=new pc.Mesh(device);mesh.setPositions(positions);mesh.setNormals(pc.calculateNormals(positions,indices));
  mesh.setIndices(indices);mesh.update();woodlandFernMeshes.set(device,mesh);return mesh;
}
