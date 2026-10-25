import * as pc from "playcanvas";

const PORTAL_ASSET = "/assets/hippo-low-poly-portal/portal.glb";
const SPIRAL_ASSET = "/assets/hippo-low-poly-portal/spiral.png";
const TOWER_ASSET = "/assets/quaternius-medieval-village/bell-tower.glb";

function material(color: pc.Color, opacity = 1, additive = false): pc.StandardMaterial {
  const result = new pc.StandardMaterial();
  result.diffuse = color;
  result.emissive = color.clone().mulScalar(additive ? .75 : .15);
  result.useLighting = false;
  result.opacity = opacity;
  if (opacity < 1 || additive) {
    result.blendType = additive ? pc.BLEND_ADDITIVE : pc.BLEND_NORMAL;
    result.depthWrite = false;
    result.cull = pc.CULLFACE_NONE;
  }
  result.update();
  return result;
}

function shape(parent: pc.Entity, name: string, type: "box" | "cylinder" | "cone" | "plane" | "sphere",
  finish: pc.StandardMaterial, scale: [number, number, number], position: [number, number, number]): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent("render", { type, castShadows: false, receiveShadows: false });
  if (entity.render) entity.render.material = finish;
  entity.setLocalScale(...scale);
  entity.setLocalPosition(...position);
  parent.addChild(entity);
  return entity;
}

function loadContainer(app: pc.Application, url: string, onReady: (resource: pc.ContainerResource) => void): void {
  app.assets.loadFromUrl(url, "container", (error, asset) => {
    if (error || !asset?.resource) {
      console.warn(`[town-landmarks] Could not load ${url}; keeping the simple silhouette.`, error);
      return;
    }
    onReady(asset.resource as pc.ContainerResource);
  });
}

function cloudTexture(device: pc.GraphicsDevice, seed: number): pc.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d")!;
  const pixels = context.createImageData(canvas.width, canvas.height);
  const puffs = Array.from({ length: 8 }, (_, index) => ({
    x: .1 + index * .115 + Math.sin(seed * 3.1 + index * 2.7) * .025,
    y: .52 + Math.sin(seed * 1.7 + index * 2.1) * .18,
    rx: .13 + (index % 3) * .014,
    ry: .19 + (index % 4) * .025,
  }));
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const u = x / (canvas.width - 1), v = y / (canvas.height - 1);
    let density = 0;
    for (const puff of puffs) {
      const dx = (u - puff.x) / puff.rx, dy = (v - puff.y) / puff.ry;
      density = Math.max(density, Math.exp(-(dx * dx + dy * dy) * 1.25));
    }
    const ripple = Math.sin(u * 53 + seed * 5 + Math.sin(v * 21) * 2) * .035
      + Math.sin(u * 91 - v * 34 + seed * 7) * .018;
    const edge = Math.max(0, Math.min(1, (density + ripple - .17) / .43));
    const fade = Math.min(1, u * 12, (1 - u) * 12, v * 11, (1 - v) * 11);
    const alpha = edge * edge * (3 - 2 * edge) * fade;
    const shade = Math.round(250 - v * 18 + Math.sin(u * 17 + seed) * 3);
    const offset = (y * canvas.width + x) * 4;
    pixels.data[offset] = shade;
    pixels.data[offset + 1] = Math.min(255, shade + 5);
    pixels.data[offset + 2] = Math.min(255, shade + 9);
    pixels.data[offset + 3] = Math.round(alpha * 244);
  }
  context.putImageData(pixels, 0, 0);
  const texture = new pc.Texture(device, { width: canvas.width, height: canvas.height, mipmaps: true });
  texture.setSource(canvas);
  return texture;
}

function cloudMaterial(texture: pc.Texture): pc.StandardMaterial {
  const finish = new pc.StandardMaterial();
  finish.diffuse = new pc.Color(1, 1, 1);
  finish.diffuseMap = texture;
  finish.emissive = new pc.Color(.68, .72, .74);
  finish.useLighting = false;
  finish.opacityMap = texture;
  finish.opacityMapChannel = "a";
  finish.blendType = pc.BLEND_NORMAL;
  finish.depthWrite = false;
  finish.cull = pc.CULLFACE_NONE;
  finish.update();
  return finish;
}

/** Town landmarks are visual only. The force field and travel rules stay server-owned. */
export function createTownPortalLandmarks(app: pc.Application, parent: pc.Entity): void {
  const portal = new pc.Entity("tower-portal");
  portal.setLocalPosition(104.5, 8, 106);
  parent.addChild(portal);

  const stone = material(new pc.Color(.23, .28, .35));
  const trim = material(new pc.Color(.31, .57, .64));
  const energy = material(new pc.Color(.09, .025, .17), .78);
  const rune = material(new pc.Color(.46, .18, .84));
  shape(portal, "portal-plinth", "cylinder", stone, [5.2, .35, 5.2], [0, .12, 0]);
  shape(portal, "portal-plinth-rim", "cylinder", trim, [5.4, .08, 5.4], [0, .28, 0]);
  const veil = shape(portal, "portal-energy", "cylinder", energy, [3.7, .07, 3.7], [-.05, 2, 0]);
  veil.setLocalEulerAngles(0, 0, 90);
  for (let index = 0; index < 16; index++) {
    const angle = index * Math.PI / 8;
    shape(portal, `portal-rune-${index}`, "sphere", rune, [.17, .17, .17],
      [-.68, 2 + Math.sin(angle) * 2.25, Math.cos(angle) * 2.25]);
  }

  const fallback = new pc.Entity("portal-frame-fallback");
  portal.addChild(fallback);
  for (let index = 0; index < 16; index++) {
    const angle = index * Math.PI / 8;
    shape(fallback, `portal-frame-stone-${index}`, "box", index % 4 === 0 ? trim : stone,
      [.68, .7, .7], [0, 2 + Math.sin(angle) * 2.35, Math.cos(angle) * 2.35]);
  }
  loadContainer(app, PORTAL_ASSET, resource => {
    const frame = resource.instantiateRenderEntity({ castShadows: false, receiveShadows: false });
    frame.name = "portal-frame-asset";
    frame.setLocalScale(.93, .93, .93);
    for (const node of frame.find(candidate => Boolean((candidate as pc.Entity).render))) {
      const render = (node as pc.Entity).render;
      if (render) for (const mesh of render.meshInstances) mesh.material = stone;
    }
    portal.addChild(frame);
    fallback.enabled = false;
  });

  const spiralPivot = new pc.Entity("portal-spiral-pivot");
  spiralPivot.setLocalPosition(-.11, 2, 0);
  spiralPivot.setLocalEulerAngles(0, 0, 90);
  portal.addChild(spiralPivot);
  const spiralMaterial = new pc.StandardMaterial();
  spiralMaterial.diffuse = new pc.Color(0, 0, 0);
  spiralMaterial.emissive = new pc.Color(.72, .32, 1);
  spiralMaterial.useLighting = false;
  spiralMaterial.opacity = .9;
  spiralMaterial.blendType = pc.BLEND_NORMAL;
  spiralMaterial.depthWrite = false;
  spiralMaterial.cull = pc.CULLFACE_NONE;
  spiralMaterial.update();
  const spiral = shape(spiralPivot, "portal-spiral", "plane", spiralMaterial, [3, 1, 3], [0, 0, 0]);
  spiral.enabled = false;
  app.assets.loadFromUrl(SPIRAL_ASSET, "texture", (error, asset) => {
    if (error || !asset?.resource) return;
    const texture = asset.resource as pc.Texture;
    spiralMaterial.emissiveMap = texture;
    spiralMaterial.opacityMap = texture;
    spiralMaterial.opacityMapChannel = "a";
    spiralMaterial.update();
    spiral.enabled = true;
  });

  // Reuse the village tower as an unreachable monument. Its upper roof is
  // beyond the camera range, while cloud banks conceal the shaft above town.
  const tower = new pc.Entity("distant-tower-silhouette");
  tower.setLocalPosition(150, -10, 122);
  parent.addChild(tower);
  const silhouette = material(new pc.Color(.045, .065, .09));
  // The town is a suspended island. Continue the monument far below its floor
  // so looking over the edge never reveals the tower ending in mid-air.
  shape(tower, "tower-deep-shaft", "box", silhouette, [18, 320, 18], [0, -160, 0]);
  const towerFallback = new pc.Entity("tower-silhouette-fallback");
  tower.addChild(towerFallback);
  shape(towerFallback, "tower-base", "box", silhouette, [18, 125, 18], [0, 62.5, 0]);
  shape(towerFallback, "tower-upper", "box", silhouette, [13, 80, 13], [0, 165, 0]);
  loadContainer(app, TOWER_ASSET, resource => {
    const model = resource.instantiateRenderEntity({ castShadows: false, receiveShadows: false });
    model.name = "tower-bell-model";
    model.setLocalScale(10, 34, 10);
    for (const node of model.find(candidate => Boolean((candidate as pc.Entity).render))) {
      const render = (node as pc.Entity).render;
      if (render) for (const mesh of render.meshInstances) mesh.material = silhouette;
    }
    tower.addChild(model);
    towerFallback.enabled = false;
  });

  const cloudFinishes = [0, 1, 2].map(seed => cloudMaterial(cloudTexture(app.graphicsDevice, seed)));
  const cloudLayout = [
    [-19, 33, 2, 26, 10], [-17, 42, -12, 34, 11],
    [-22, 63, 0, 42, 13], [-15, 79, -12, 38, 12],
    [-19, 95, 11, 43, 14],
  ] as const;
  const clouds = cloudLayout.map(([x, y, z, width, height], index) => {
    const bank = shape(tower, `tower-cloud-bank-${index}`, "plane", cloudFinishes[index % cloudFinishes.length]!,
      [height, 1, width], [x, y, z]);
    bank.setLocalEulerAngles(0, 0, 90);
    return { entity: bank, x, y, z, phase: index * 1.3 };
  });

  app.on("update", () => {
    if (!parent.enabled) return;
    const now = performance.now();
    if (spiral.enabled) spiral.setLocalEulerAngles(0, now * .022, 0);
    for (const cloud of clouds) cloud.entity.setLocalPosition(
      cloud.x + Math.sin(now * .00012 + cloud.phase) * 1.7, cloud.y,
      cloud.z + Math.cos(now * .00009 + cloud.phase) * .7);
  });
}
