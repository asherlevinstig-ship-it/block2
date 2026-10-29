import * as pc from "playcanvas";

const finishes = new WeakMap<pc.GraphicsDevice, Map<pc.StandardMaterial, pc.StandardMaterial>>();
/** Repair the FBX conversion's uniform metalness while retaining the pack's
 * authored flat-colour, low-poly finish. Do not add small procedural normal
 * maps here: when a complete building is enlarged, their texels become a
 * conspicuous speckled grid across plaster, stone, roofs and timber. */
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
      material.update(); materials.set(original, material);
    }
    instance.material = material;
  }
}
