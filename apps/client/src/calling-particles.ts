import * as pc from "playcanvas";
import type { ParticleKind, ParticleLayer, ParticleTexture } from "./calling-vfx-presets.js";

export const CALLING_PARTICLE_TEXTURE_URLS: Record<ParticleTexture, string> = {
  smoke: "/assets/vfx/kenney-particles/smoke.png",
  debris: "/assets/vfx/kenney-particles/debris.png",
  orb: "/assets/vfx/kenney-particles/arcane-orb.png",
  rune: "/assets/vfx/kenney-particles/arcane-rune.png",
  lightning: "/assets/vfx/kenney-particles/lightning.png",
  streak: "/assets/vfx/kenney-particles/streak.png",
};

const authoredTextureCache = new Map<ParticleTexture, pc.Texture>();
const generatedTextureCache = new Map<ParticleKind, pc.Texture>();
let preloadStarted = false;

/** Warm a compact local texture library. Effects remain functional with generated fallbacks while loading. */
export function preloadCallingParticleTextures(app: pc.Application): void {
  if (preloadStarted) return;
  preloadStarted = true;
  for (const [id, url] of Object.entries(CALLING_PARTICLE_TEXTURE_URLS) as [ParticleTexture, string][]) {
    app.assets.loadFromUrl(url, "texture", (error, asset) => {
      if (!error && asset?.resource) authoredTextureCache.set(id, asset.resource as pc.Texture);
    });
  }
}

const defaultTexture: Record<ParticleKind, ParticleTexture> = {
  smoke: "smoke", dust: "debris", glow: "orb", spark: "rune", streak: "streak",
};

function textureFor(app: pc.Application, kind: ParticleKind, authored = defaultTexture[kind]): pc.Texture {
  const authoredTexture = authoredTextureCache.get(authored);
  if (authoredTexture) return authoredTexture;
  const cached = generatedTextureCache.get(kind);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d")!;
  const pixels = context.createImageData(64, 64);
  for (let y = 0; y < 64; y += 1) for (let x = 0; x < 64; x += 1) {
    const dx = (x - 31.5) / 31.5;
    const dy = (y - 31.5) / 31.5;
    const distance = Math.sqrt(dx * dx + dy * dy * (kind === "streak" ? 4 : 1));
    const noise = .78 + .13 * Math.sin(x * .37 + y * .19) * Math.sin(y * .31 - x * .17)
      + .09 * Math.sin(x * .13 + y * .24);
    const edge = Math.max(0, 1 - distance);
    const alpha = kind === "glow" ? Math.exp(-distance * distance * 6)
      : kind === "streak" ? edge ** 2.5 : edge ** 1.65 * noise;
    const i = (y * 64 + x) * 4;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255;
    pixels.data[i + 3] = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
  }
  context.putImageData(pixels, 0, 0);
  const texture = new pc.Texture(app.graphicsDevice, { width: 64, height: 64, mipmaps: true });
  texture.setSource(canvas);
  generatedTextureCache.set(kind, texture);
  return texture;
}

/** Texture-backed, GPU-batched particles. No per-frame CPU mesh animation. */
export function addCallingParticleLayers(app: pc.Application, root: pc.Entity,
  layers: readonly ParticleLayer[], loop = false, density = 1): void {
  for (const layer of layers) {
    const emitter = new pc.Entity(`calling-${layer.kind}`);
    emitter.setLocalPosition(0, layer.offsetY ?? 0, 0);
    root.addChild(emitter);
    const smoky = layer.kind === "smoke" || layer.kind === "dust";
    const particleSpeed = layer.forward ? 0 : layer.speed;
    const particleCount = Math.max(4, Math.round(layer.count * density));
    emitter.addComponent("particlesystem", {
      autoPlay: true,
      numParticles: particleCount,
      lifetime: layer.life,
      // Impact layers should arrive as one readable beat. The old fixed 12ms rate
      // smeared large effects across almost a second and made the impact look absent.
      rate: loop ? Math.max(.025, layer.life / particleCount) : Math.max(.0025, .24 / particleCount),
      loop,
      emitterShape: pc.EMITTERSHAPE_SPHERE,
      emitterRadius: layer.radius,
      localSpace: true,
      colorMap: textureFor(app, layer.kind, layer.texture),
      colorGraph: new pc.CurveSet([
        [0, layer.color[0], 1, layer.color[0] * (smoky ? .62 : .85)],
        [0, layer.color[1], 1, layer.color[1] * (smoky ? .62 : .85)],
        [0, layer.color[2], 1, layer.color[2] * (smoky ? .62 : .85)],
      ]),
      alphaGraph: new pc.Curve([0, 0, .12, layer.opacity, .52, layer.opacity * .72, 1, 0]),
      scaleGraph: new pc.Curve([0, layer.size * .35, .28, layer.size, 1, layer.size * (smoky ? 1.8 : .4)]),
      radialSpeedGraph: new pc.Curve([0, particleSpeed, .6, particleSpeed * .55, 1, particleSpeed * .2]),
      localVelocityGraph: new pc.CurveSet([
        [0, 0, 1, 0],
        [0, layer.rise, 1, layer.rise * .3],
        [0, layer.forward ? layer.speed : 0, 1, layer.forward ? layer.speed * .35 : 0],
      ]),
      startAngle: 0,
      startAngle2: 360,
      blendType: smoky ? pc.BLEND_NORMAL : pc.BLEND_ADDITIVE,
      depthWrite: false,
      lighting: false,
      noFog: true,
      intensity: smoky ? 1.15 : 1.65,
      alignToMotion: layer.kind === "streak",
      stretch: layer.kind === "streak" ? .09 : 0,
    });
  }
}
