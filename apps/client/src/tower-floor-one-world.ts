import * as pc from "playcanvas";
import { TOWER_FLOOR_ONE } from "@blockcraft/protocol";

function finish(color: pc.Color, emissive = 0, opacity = 1): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.emissive = color.clone().mulScalar(emissive);
  material.gloss = emissive > 0 ? .45 : .16;
  material.opacity = opacity;
  if (opacity < 1) { material.blendType = pc.BLEND_NORMAL; material.depthWrite = false; }
  material.update();
  return material;
}

function shape(parent: pc.Entity, name: string, type: "box" | "cylinder" | "cone" | "sphere",
  material: pc.StandardMaterial, scale: [number, number, number], position: [number, number, number], yaw = 0): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent("render", { type, castShadows: true, receiveShadows: true });
  if (entity.render) entity.render.material = material;
  entity.setLocalScale(...scale); entity.setLocalPosition(...position); entity.setLocalEulerAngles(0, yaw, 0);
  parent.addChild(entity);
  return entity;
}

function tree(parent: pc.Entity, x: number, z: number, scale: number, trunk: pc.StandardMaterial,
  leaves: pc.StandardMaterial, darkLeaves: pc.StandardMaterial): void {
  shape(parent, "floor1-ancient-trunk", "cylinder", trunk, [.55 * scale, 3.4 * scale, .55 * scale], [x, 9.55, z]);
  shape(parent, "floor1-canopy", "sphere", leaves, [2.1 * scale, 1.65 * scale, 2.1 * scale], [x, 12.1, z]);
  shape(parent, "floor1-canopy-shadow", "sphere", darkLeaves, [1.45 * scale, 1.25 * scale, 1.45 * scale], [x + .9, 11.55, z - .7]);
}

/** Visual-only scene for the first tower floor. Collision and travel remain server-owned. */
export function createTowerFloorOneWorld(app: pc.Application, parent: pc.Entity): pc.Entity {
  const root = new pc.Entity("tower-floor-1-world");
  parent.addChild(root);
  const stone = finish(new pc.Color(.18, .22, .19));
  const stoneLight = finish(new pc.Color(.31, .35, .29));
  const moss = finish(new pc.Color(.16, .34, .16));
  const mossLight = finish(new pc.Color(.28, .48, .2));
  const earth = finish(new pc.Color(.31, .25, .16));
  const bark = finish(new pc.Color(.2, .12, .065));
  const leaf = finish(new pc.Color(.1, .3, .12));
  const leafDark = finish(new pc.Color(.045, .17, .075));
  const sanctuary = finish(new pc.Color(.12, .72, .9), .65, .66);
  const bossGlow = finish(new pc.Color(.62, .22, .82), .52, .72);
  const gold = finish(new pc.Color(.8, .58, .18), .18);
  const voidMaterial = finish(new pc.Color(.012, .018, .025));

  const { bounds } = TOWER_FLOOR_ONE;
  shape(root, "floor1-void-slab", "box", voidMaterial, [130, 3, 134], [344, 3.8, 106]);
  shape(root, "floor1-fortress-platform", "box", stone, [bounds.maxX - bounds.minX, .65, bounds.maxZ - bounds.minZ], [344, 7.65, 106]);
  shape(root, "floor1-overgrown-floor", "box", moss, [88, .09, 90], [344, 8.02, 106]);

  // Outer rampart: high enough to make this feel like a floor inside an
  // impossible tower, with broken crenellations showing the void beyond.
  for (const [x, z, sx, sz] of [[344,57,96,2],[344,155,96,2],[297,106,2,100],[391,106,2,100]] as const)
    shape(root, "floor1-outer-rampart", "box", stoneLight, [sx, 5.5, sz], [x, 10.5, z]);
  for (let x = 300; x <= 388; x += 8) for (const z of [58.4,153.6])
    shape(root, "floor1-crenellation", "box", stoneLight, [3.2, 1.3, 2.2], [x, 13.8, z]);
  for (let z = 62; z <= 150; z += 8) for (const x of [298.4,389.6])
    shape(root, "floor1-crenellation", "box", stoneLight, [2.2, 1.3, 3.2], [x, 13.8, z]);

  // Sanctuary arrival – no enemies live in this blue-lit refuge.
  shape(root, "floor1-sanctuary-dais", "cylinder", stoneLight, [13, .35, 13], [306, 8.2, 106]);
  shape(root, "floor1-sanctuary-rune", "cylinder", sanctuary, [10.8, .06, 10.8], [306, 8.42, 106]);
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2;
    shape(root, "floor1-sanctuary-pillar", "cylinder", stoneLight, [.5, 3.2, .5],
      [306 + Math.cos(angle) * 7.2, 9.7, 106 + Math.sin(angle) * 7.2]);
    shape(root, "floor1-sanctuary-flame", "sphere", sanctuary, [.38, .65, .38],
      [306 + Math.cos(angle) * 7.2, 12.2, 106 + Math.sin(angle) * 7.2]);
  }

  // Three connected spaces: opening court, split warden courts, boss court.
  shape(root, "floor1-main-road", "box", earth, [65, .12, 7], [345, 8.13, 106]);
  shape(root, "floor1-north-road", "box", earth, [24, .12, 5], [344, 8.13, 84], 48);
  shape(root, "floor1-south-road", "box", earth, [24, .12, 5], [344, 8.13, 128], -48);
  for (const [x,z] of [[329,106],[350,80],[350,132]] as const)
    shape(root, "floor1-encounter-court", "cylinder", mossLight, [13, .11, 13], [x, 8.12, z]);

  // Ruined walls create combat lanes and readable cover.
  for (const [x,z,sx,sz] of [[322,92,11,1.2],[322,120,11,1.2],[338,96,1.2,10],[338,116,1.2,10],
    [348,68,18,1.3],[348,144,18,1.3],[360,88,1.3,12],[360,124,1.3,12]] as const) {
    shape(root, "floor1-ruined-wall", "box", stoneLight, [sx, 2.4, sz], [x, 9.15, z]);
    shape(root, "floor1-wall-moss", "box", mossLight, [sx * .72, .14, sz * 1.08], [x, 10.42, z]);
  }

  const trees = [[319,75,1],[326,136,.9],[337,67,1.15],[341,145,.95],[356,70,.95],[356,142,1.05],
    [367,83,.85],[368,130,.95],[383,72,1.1],[383,140,1.05]] as const;
  for (const [x,z,s] of trees) tree(root, x, z, s, bark, leaf, leafDark);
  for (let i = 0; i < 38; i++) {
    const x = 314 + (i * 17 % 69), z = 64 + (i * 29 % 83);
    if (Math.abs(z - 106) < 7 || Math.hypot(x - 350, z - 80) < 11 || Math.hypot(x - 350, z - 132) < 11) continue;
    shape(root, "floor1-fern", "cone", i % 3 ? leaf : mossLight, [.35 + i % 4 * .08, .8, .35 + i % 4 * .08], [x, 8.45, z], i * 47);
  }

  // The floor boss occupies a ceremonial crown court at the far end.
  shape(root, "floor1-boss-court-rim", "cylinder", gold, [29, .35, 29], [375, 8.16, 106]);
  shape(root, "floor1-boss-court", "cylinder", stoneLight, [26.5, .38, 26.5], [375, 8.34, 106]);
  shape(root, "floor1-boss-sigil", "cylinder", bossGlow, [12, .055, 12], [375, 8.58, 106]);
  for (let i = 0; i < 10; i++) {
    const angle = i / 10 * Math.PI * 2;
    shape(root, "floor1-crown-pillar", "box", stone, [1.15, 4.5, 1.15],
      [375 + Math.cos(angle) * 11.2, 10.6, 106 + Math.sin(angle) * 11.2], -angle * 180 / Math.PI);
  }
  shape(root, "floor1-crown-throne", "box", stone, [3.7, 5.2, 2.6], [384, 10.7, 106]);
  shape(root, "floor1-crown-inlay", "box", gold, [.18, 3.6, 1.8], [382.08, 10.8, 106]);

  const floorLight = new pc.Entity("floor1-sanctuary-light");
  floorLight.addComponent("light", { type: "omni", color: new pc.Color(.2,.75,1), intensity: 1.4, range: 22, castShadows: false });
  floorLight.setLocalPosition(306, 11, 106); root.addChild(floorLight);
  app.on("update", () => {
    if (!root.enabled || !floorLight.light) return;
    floorLight.light.intensity = 1.35 + Math.sin(performance.now() / 420) * .18;
  });
  return root;
}
