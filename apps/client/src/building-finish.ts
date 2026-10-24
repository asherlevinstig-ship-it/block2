import * as pc from "playcanvas";

const finishes = new WeakMap<pc.GraphicsDevice, Map<pc.StandardMaterial, pc.StandardMaterial>>();
/** Repair the FBX conversion's uniform metalness while retaining authored colours/UVs. */
export function finishBuildingMaterials(app: pc.Application, entity: pc.Entity): void {
  let materials = finishes.get(app.graphicsDevice);
  if (!materials) { materials = new Map(); finishes.set(app.graphicsDevice, materials); }
  for (const render of entity.findComponents("render") as pc.RenderComponent[]) for (const instance of render.meshInstances) {
    const original = instance.material;
    if (!(original instanceof pc.StandardMaterial)) continue;
    let material = materials.get(original);
    if (!material) {
      material = original.clone();
      const name = original.name.toLowerCase();
      const metal = /metal|iron|steel/.test(name), glass = /window|glass/.test(name);
      material.useMetalness = true;
      material.metalness = metal ? .65 : 0;
      material.gloss = glass ? .55 : metal ? .38 : /wood|plaster/.test(name) ? .1 : .18;
      material.glossInvert = false;
      if (glass && !original.emissiveMap) material.emissive.set(.32, .17, .055);
      // Small tileable relief maps add tactile grain without replacing the asset palette.
      if (!original.normalMap && !glass && !metal) {
        const size = 64, pixels = new Uint8Array(size * size * 4);
        const wood = /wood/.test(name), roof = /roof/.test(name);
        const height = (x: number, y: number) => wood
          ? Math.sin(x * .72 + Math.sin(y * .098) * 1.2) * .13 + Math.sin(x * 2.1 + y * .05) * .04
          : roof ? ((y % 16 < 2 || (x + Math.floor(y / 16) % 2 * 16) % 32 < 2) ? -.15 : .02)
          : Math.sin(x * Math.PI / 8) * Math.cos(y * Math.PI / 8) * .035;
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          const dx = height((x + 1) % size, y) - height((x + size - 1) % size, y);
          const dy = height(x, (y + 1) % size) - height(x, (y + size - 1) % size);
          const length = Math.hypot(dx, dy, 1), offset = (y * size + x) * 4;
          pixels.set([128 - dx / length * 127, 128 - dy / length * 127, 128 + 1 / length * 127, 255], offset);
        }
        const texture = new pc.Texture(app.graphicsDevice, { name: `finish-${original.name}`, width: size, height: size,
          format: pc.PIXELFORMAT_RGBA8, mipmaps: true, minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR, magFilter: pc.FILTER_LINEAR });
        new Uint8Array(texture.lock()).set(pixels); texture.unlock();
        material.normalMap = texture; material.bumpiness = .35;
      }
      material.update(); materials.set(original, material);
    }
    instance.material = material;
  }
}
