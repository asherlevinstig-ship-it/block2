import * as pc from "playcanvas";

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
  const mesh = pc.createBox(device, {});
  const positions: number[] = [], uvs: number[] = [];
  mesh.getPositions(positions);
  const tileSize = /plaza/.test(material.name) ? 6 : 5;
  for (let i = 0; i < positions.length; i += 3) {
    uvs.push((positions[i]! * scale[0] + position[0]) / tileSize / material.diffuseMapTiling.x,
      (positions[i + 2]! * scale[2] + position[2]) / tileSize / material.diffuseMapTiling.y);
  }
  mesh.setUvs(0, uvs); mesh.update();
  entity.render.meshInstances[0]!.mesh = mesh;
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
