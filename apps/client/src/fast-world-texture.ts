import * as pc from "playcanvas";

export interface PaintedGroundStyle {
  name: string;
  base: string;
  mottles: readonly string[];
  litter: readonly string[];
  seed: number;
  roughness?: number;
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
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  const random = seededRandom(style.seed);
  context.fillStyle = style.base;
  context.fillRect(0, 0, size, size);

  // Broad translucent mottles stop large terrain slabs reading as one colour.
  for (let index = 0; index < 120; index++) {
    const radius = 3 + random() * 12;
    context.globalAlpha = .12 + random() * .18;
    context.fillStyle = style.mottles[index % style.mottles.length]!;
    context.beginPath();
    context.ellipse(random() * size, random() * size, radius, radius * (.45 + random() * .8), random() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }

  // Tiny leaves, needles and stones supply texture without visual noise at combat distance.
  context.globalAlpha = .72;
  for (let index = 0; index < 210; index++) {
    const x = random() * size;
    const y = random() * size;
    const length = 1.2 + random() * 3.6;
    context.save();
    context.translate(x, y);
    context.rotate(random() * Math.PI);
    context.fillStyle = style.litter[index % style.litter.length]!;
    context.fillRect(-length * .5, -.45, length, .9 + random() * .6);
    context.restore();
  }
  context.globalAlpha = 1;

  const texture = new pc.Texture(app.graphicsDevice, {
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

  const material = new pc.StandardMaterial();
  material.name = style.name;
  material.diffuse = new pc.Color(1, 1, 1);
  material.diffuseMap = texture;
  material.diffuseMapTiling = new pc.Vec2(tiling[0], tiling[1]);
  material.specular = new pc.Color(.025, .03, .022);
  material.gloss = style.roughness ?? .06;
  material.update();
  return material;
}
