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

  const cloudLight = material(new pc.Color(.82, .87, .88));
  const cloudShade = material(new pc.Color(.66, .75, .78));
  const cloudLayout = [
    [-18, 31, -9, 19, 5, 9], [-14, 35, 8, 21, 5, 9],
    [-20, 48, 2, 24, 6, 10], [-12, 60, -10, 23, 6, 10],
    [-17, 75, 9, 25, 7, 11],
  ] as const;
  const clouds = cloudLayout.map(([x, y, z, sx, sy, sz], index) => {
    const bank = new pc.Entity(`tower-cloud-bank-${index}`);
    tower.addChild(bank);
    shape(bank, "cloud-middle", "sphere", cloudLight, [sx, sy, sz], [0, 0, 0]);
    shape(bank, "cloud-left", "sphere", cloudShade, [sx * .68, sy * .9, sz * .85], [-sx * .37, -sy * .13, .9]);
    shape(bank, "cloud-right", "sphere", cloudLight, [sx * .73, sy * .78, sz * .9], [sx * .35, -sy * .17, -.8]);
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
