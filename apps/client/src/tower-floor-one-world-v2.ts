import * as pc from "playcanvas";
import { towerFloorOneGroundHeight } from "@blockcraft/protocol";

function finish(color: pc.Color, emissive = 0, opacity = 1): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.emissive = color.clone().mulScalar(emissive);
  material.gloss = emissive > 0 ? .42 : .12;
  material.metalness = emissive > 0 ? .08 : 0;
  material.opacity = opacity;
  if (opacity < 1) { material.blendType = pc.BLEND_NORMAL; material.depthWrite = false; }
  material.update();
  return material;
}

type Rotation = number | [number, number, number];

function shape(parent: pc.Entity, name: string, type: "box" | "cylinder" | "cone" | "sphere",
  material: pc.StandardMaterial, scale: [number, number, number], position: [number, number, number],
  rotation: Rotation = 0): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent("render", { type, castShadows: true, receiveShadows: true });
  if (entity.render) entity.render.material = material;
  const euler: [number, number, number] = typeof rotation === "number" ? [0, rotation, 0] : rotation;
  entity.setLocalScale(...scale);
  entity.setLocalPosition(...position);
  entity.setLocalEulerAngles(euler[0], euler[1], euler[2]);
  parent.addChild(entity);
  return entity;
}

function tree(parent: pc.Entity, x: number, z: number, scale: number, trunk: pc.StandardMaterial,
  leaves: pc.StandardMaterial, darkLeaves: pc.StandardMaterial): void {
  const ground = towerFloorOneGroundHeight(x, z);
  shape(parent, "floor1-ancient-trunk", "cylinder", trunk, [.55 * scale, 3.4 * scale, .55 * scale],
    [x, ground + 1.65 * scale, z], [4, (x * 19 + z * 7) % 360, 3]);
  shape(parent, "floor1-canopy", "sphere", leaves, [2.1 * scale, 1.65 * scale, 2.1 * scale],
    [x, ground + 4.15 * scale, z]);
  shape(parent, "floor1-canopy-shadow", "sphere", darkLeaves, [1.45 * scale, 1.25 * scale, 1.45 * scale],
    [x + .9, ground + 3.6 * scale, z - .7]);
}

function causeway(parent: pc.Entity, name: string, from: [number, number], to: [number, number],
  segments: number, width: number, stone: pc.StandardMaterial, earth: pc.StandardMaterial,
  broken: readonly number[] = []): void {
  const dx = to[0] - from[0], dz = to[1] - from[1];
  const yaw = -Math.atan2(dz, dx) * 180 / Math.PI;
  const segmentLength = Math.hypot(dx, dz) / segments;
  for (let index = 0; index < segments; index++) {
    if (broken.includes(index)) continue;
    const t = (index + .5) / segments;
    const x = from[0] + dx * t, z = from[1] + dz * t;
    const top = towerFloorOneGroundHeight(x, z);
    const chip = index % 3 === 1 ? .34 : 0;
    shape(parent, `${name}-stone`, "box", stone,
      [segmentLength + .18 - chip, .42, width - (index % 4 === 2 ? .55 : 0)], [x, top - .19, z], yaw);
    shape(parent, `${name}-earth`, "box", earth,
      [segmentLength - .18 - chip, .055, width - .58], [x, top + .045, z], yaw);
  }
}

function arch(parent: pc.Entity, name: string, x: number, z: number, ground: number,
  width: number, height: number, yaw: number, stone: pc.StandardMaterial,
  darkStone: pc.StandardMaterial, bark: pc.StandardMaterial): void {
  const radians = yaw * Math.PI / 180;
  const offsetX = Math.cos(radians) * width * .5;
  const offsetZ = -Math.sin(radians) * width * .5;
  for (const side of [-1, 1]) {
    shape(parent, `${name}-pier`, "box", side < 0 ? stone : darkStone, [1.45, height, 1.65],
      [x + offsetX * side, ground + height * .5, z + offsetZ * side], yaw);
    shape(parent, `${name}-foot`, "box", darkStone, [2.1, .7, 2.25],
      [x + offsetX * side, ground + .35, z + offsetZ * side], yaw);
  }
  shape(parent, `${name}-lintel`, "box", stone, [width + 2.6, 1.35, 1.75],
    [x, ground + height - .3, z], yaw);
  shape(parent, `${name}-broken-crown`, "box", darkStone, [width * .42, .75, 2],
    [x - offsetX * .25, ground + height + .55, z - offsetZ * .25], [0, yaw, -8]);
  shape(parent, `${name}-root`, "cylinder", bark, [.32, height * .72, .32],
    [x + offsetX * .7, ground + height * .47, z + offsetZ * .7], [0, yaw, 68]);
}

/** Structural art pass for Floor 1. Walkable height is shared with the server;
 * hard bounds and encounter rules remain authoritative. */
export function createTowerFloorOneWorld(app: pc.Application, parent: pc.Entity): pc.Entity {
  const root = new pc.Entity("tower-floor-1-world");
  parent.addChild(root);

  const stone = finish(new pc.Color(.15, .18, .16));
  const stoneLight = finish(new pc.Color(.34, .37, .31));
  const stoneWarm = finish(new pc.Color(.43, .39, .29));
  const moss = finish(new pc.Color(.12, .28, .12));
  const mossLight = finish(new pc.Color(.27, .46, .18));
  const earth = finish(new pc.Color(.32, .24, .14));
  const bark = finish(new pc.Color(.17, .09, .045));
  const leaf = finish(new pc.Color(.075, .27, .1));
  const leafDark = finish(new pc.Color(.025, .12, .055));
  const sanctuary = finish(new pc.Color(.08, .68, .92), .72, .7);
  const bossGlow = finish(new pc.Color(.58, .16, .78), .58, .76);
  const gold = finish(new pc.Color(.78, .52, .13), .15);
  const voidMaterial = finish(new pc.Color(.006, .01, .016));

  shape(root, "floor1-abyss", "box", voidMaterial, [138, 4, 142], [344, 1.9, 106]);
  shape(root, "floor1-fortress-skirt", "cylinder", stone, [99, 7.6, 104], [344, 4.15, 106]);
  shape(root, "floor1-fortress-platform", "cylinder", stoneLight, [96, .8, 100], [344, 7.6, 106]);
  shape(root, "floor1-overgrown-floor", "cylinder", moss, [90, .09, 94], [344, 8.02, 106]);

  const wallSegments = 38;
  for (let index = 0; index < wallSegments; index++) {
    const angle = index / wallSegments * Math.PI * 2;
    const westGap = Math.abs(Math.atan2(Math.sin(angle - Math.PI), Math.cos(angle - Math.PI))) < .21;
    const eastGate = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) < .18;
    const overlook = [9, 10, 28, 29].includes(index);
    if (westGap || eastGate || overlook) continue;
    const x = 344 + Math.cos(angle) * 45.7;
    const z = 106 + Math.sin(angle) * 47.6;
    const broken = index % 7 === 3;
    const height = broken ? 7.4 : 10.5 + (index % 4) * .55;
    const yaw = 90 - angle * 180 / Math.PI;
    shape(root, "floor1-curved-tower-wall", "box", index % 3 ? stone : stoneLight,
      [7.55, height, 2.4], [x, 8 + height * .5, z], yaw);
    if (!broken && index % 2 === 0)
      shape(root, "floor1-wall-merlon", "box", stoneLight, [2.4, 1.55, 2.75],
        [x, 8 + height + .72, z], yaw);
    if (index % 5 === 1) {
      const innerX = 344 + Math.cos(angle) * 42.9;
      const innerZ = 106 + Math.sin(angle) * 44.7;
      shape(root, "floor1-wall-buttress", "box", stoneWarm, [2.1, height * .7, 4.8],
        [innerX, 8 + height * .35, innerZ], yaw);
    }
  }

  shape(root, "floor1-sanctuary-foundation", "cylinder", stone, [25.5, 2, 25.5], [306, 8, 106]);
  shape(root, "floor1-sanctuary-cap", "cylinder", stoneLight, [23.5, .34, 23.5], [306, 8.83, 106]);
  shape(root, "floor1-sanctuary-rune", "cylinder", sanctuary, [18.4, .06, 18.4], [306, 9.03, 106]);
  for (let step = 0; step < 4; step++) {
    const top = 8.82 - step * .2;
    shape(root, "floor1-sanctuary-step", "box", stoneLight, [2.4, .28, 7.4 + step * .7],
      [317.2 + step * 1.35, top - .14, 106]);
  }
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2;
    shape(root, "floor1-sanctuary-pillar", "cylinder", stoneLight, [.72, 4.1, .72],
      [306 + Math.cos(angle) * 8.6, 10.9, 106 + Math.sin(angle) * 8.6]);
    shape(root, "floor1-sanctuary-flame", "sphere", sanctuary, [.48, .82, .48],
      [306 + Math.cos(angle) * 8.6, 13.45, 106 + Math.sin(angle) * 8.6]);
  }

  shape(root, "floor1-opening-foundation", "cylinder", stone, [30, .48, 30], [329, 7.94, 106]);
  shape(root, "floor1-opening-court", "cylinder", mossLight, [27.5, .09, 27.5], [329, 8.2, 106]);
  causeway(root, "floor1-arrival-causeway", [317, 106], [329, 106], 5, 7.2, stoneLight, earth);

  for (const [name, x, z] of [["north", 350, 80], ["south", 350, 132]] as const) {
    shape(root, `floor1-${name}-terrace-base`, "cylinder", stone, [28, 1.36, 28], [x, 8, z]);
    shape(root, `floor1-${name}-terrace-rim`, "cylinder", stoneWarm, [26.6, .18, 26.6], [x, 8.61, z]);
    shape(root, `floor1-${name}-warden-court`, "cylinder", mossLight, [24.5, .09, 24.5], [x, 8.72, z]);
  }
  causeway(root, "floor1-north-causeway", [333, 101], [345, 86], 6, 5.4, stoneLight, earth, [2]);
  causeway(root, "floor1-south-causeway", [333, 111], [345, 126], 6, 5.4, stoneLight, earth, [3]);

  arch(root, "floor1-opening-gate", 320.5, 106, 8.55, 6.4, 6.5, 90, stoneLight, stone, bark);
  arch(root, "floor1-north-breach", 339, 94, towerFloorOneGroundHeight(339, 94), 5.4, 5.8, 49,
    stoneLight, stone, bark);
  arch(root, "floor1-south-breach", 339, 118, towerFloorOneGroundHeight(339, 118), 5.4, 5.8, -49,
    stoneLight, stone, bark);

  for (const [x, z, sx, sz, yaw] of [[322, 92, 11, 1.2, -7], [322, 120, 11, 1.2, 7],
    [337, 96, 1.2, 9, 5], [337, 116, 1.2, 9, -5], [349, 68, 17, 1.3, 3],
    [349, 144, 17, 1.3, -3], [360, 88, 1.3, 10, 7], [360, 124, 1.3, 10, -7]] as const) {
    const ground = towerFloorOneGroundHeight(x, z);
    shape(root, "floor1-ruined-wall", "box", stoneLight, [sx, 2.5, sz], [x, ground + 1.18, z], yaw);
    shape(root, "floor1-wall-moss", "box", mossLight, [sx * .7, .13, sz * 1.08],
      [x, ground + 2.48, z], yaw);
  }

  causeway(root, "floor1-crown-causeway", [337, 106], [359, 106], 7, 6.6, stoneLight, earth, [2]);
  for (let step = 0; step < 6; step++) {
    const top = 8.35 + step * .2;
    shape(root, "floor1-crown-step", "box", stoneLight, [2.1, .34, 8.2 - step * .18],
      [357.5 + step * 1.45, top - .17, 106]);
  }
  arch(root, "floor1-crown-gate", 361.5, 106, 9.45, 8.2, 8.8, 90, stoneWarm, stone, bark);
  shape(root, "floor1-boss-fortress", "cylinder", stone, [32, 3.1, 32], [375, 8, 106]);
  shape(root, "floor1-boss-court-rim", "cylinder", gold, [30.5, .2, 30.5], [375, 9.47, 106]);
  shape(root, "floor1-boss-court", "cylinder", stoneLight, [29.2, .18, 29.2], [375, 9.57, 106]);
  shape(root, "floor1-boss-sigil", "cylinder", bossGlow, [16, .055, 16], [375, 9.68, 106]);
  for (let i = 0; i < 10; i++) {
    const angle = i / 10 * Math.PI * 2;
    shape(root, "floor1-crown-pillar", "box", i % 2 ? stone : stoneWarm, [1.2, 5.8, 1.2],
      [375 + Math.cos(angle) * 12.2, 12.45, 106 + Math.sin(angle) * 12.2],
      -angle * 180 / Math.PI);
  }
  shape(root, "floor1-crown-throne", "box", stone, [4.5, 6.8, 3.4], [385, 12.85, 106]);
  shape(root, "floor1-crown-inlay", "box", gold, [.2, 4.8, 2.35], [382.66, 12.9, 106]);
  for (const side of [-1, 1])
    shape(root, "floor1-throne-crown", "box", gold, [.3, 3.6, .3],
      [384.8, 16.65, 106 + side * 1.15], [side * 18, 0, side * 12]);

  const trees = [[318,75,1],[325,137,.9],[336,67,1.15],[340,145,.95],[357,68,.95],
    [357,144,1.05],[367,82,.85],[368,131,.95],[383,72,1.1],[383,140,1.05]] as const;
  for (const [x, z, scale] of trees) tree(root, x, z, scale, bark, leaf, leafDark);
  for (let i = 0; i < 46; i++) {
    const x = 312 + (i * 17 % 72), z = 63 + (i * 29 % 86);
    if (Math.abs(z - 106) < 6.5 || Math.hypot(x - 350, z - 80) < 10.5
      || Math.hypot(x - 350, z - 132) < 10.5 || Math.hypot(x - 375, z - 106) < 15) continue;
    const ground = towerFloorOneGroundHeight(x, z);
    shape(root, "floor1-fern", "cone", i % 3 ? leaf : mossLight,
      [.35 + i % 4 * .08, .8, .35 + i % 4 * .08], [x, ground + .4, z], i * 47);
  }

  const sanctuaryLight = new pc.Entity("floor1-sanctuary-light");
  sanctuaryLight.addComponent("light", { type: "omni", color: new pc.Color(.15, .65, 1),
    intensity: 1.45, range: 25, castShadows: false });
  sanctuaryLight.setLocalPosition(306, 12, 106);
  root.addChild(sanctuaryLight);
  const crownLight = new pc.Entity("floor1-crown-light");
  crownLight.addComponent("light", { type: "omni", color: new pc.Color(.72, .25, .9),
    intensity: 1.05, range: 20, castShadows: false });
  crownLight.setLocalPosition(375, 13, 106);
  root.addChild(crownLight);

  let elapsed = 0;
  app.on("update", (dt: number) => {
    if (!root.enabled) return;
    elapsed += dt;
    if (sanctuaryLight.light) sanctuaryLight.light.intensity = 1.4 + Math.sin(elapsed * 2.4) * .16;
    if (crownLight.light) crownLight.light.intensity = 1.02 + Math.sin(elapsed * 1.65 + 1.4) * .12;
  });
  return root;
}
