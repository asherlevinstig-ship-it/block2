import * as pc from "playcanvas";
import { towerFloorOneGroundHeight } from "@blockcraft/protocol";
import { createPaintedGroundMaterial, fitOrganicGroundPatch } from "./fast-world-texture.js";

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

function rootCluster(parent: pc.Entity, x: number, z: number, yaw: number, length: number,
  bark: pc.StandardMaterial, moss: pc.StandardMaterial): void {
  const ground = towerFloorOneGroundHeight(x, z);
  for (let index = 0; index < 3; index++) {
    const spread = (index - 1) * 18;
    const radians = (yaw + spread) * Math.PI / 180;
    const branchLength = length * (1 - index * .08);
    shape(parent, "floor1-rampart-root", "cylinder", bark, [.28 - index * .025, branchLength, .28 - index * .025],
      [x + Math.cos(radians) * branchLength * .38, ground + .22 + index * .08,
        z - Math.sin(radians) * branchLength * .38], [90, yaw + spread, 0]);
    shape(parent, "floor1-root-moss", "sphere", moss, [.52, .18, .42],
      [x + Math.cos(radians) * branchLength * .7, ground + .11, z - Math.sin(radians) * branchLength * .7]);
  }
}

function ivyCurtain(parent: pc.Entity, x: number, y: number, z: number, yaw: number,
  width: number, height: number, leaf: pc.StandardMaterial, darkLeaf: pc.StandardMaterial): void {
  for (let strand = 0; strand < 5; strand++) {
    const offset = (strand - 2) * width / 5;
    const length = height * (.55 + ((strand * 37) % 5) * .1);
    const radians = yaw * Math.PI / 180;
    const px = x + Math.cos(radians) * offset;
    const pz = z - Math.sin(radians) * offset;
    shape(parent, "floor1-ivy-strand", "cylinder", strand % 2 ? leaf : darkLeaf, [.07, length, .07],
      [px, y - length * .5, pz], [0, yaw, strand % 2 ? 4 : -5]);
    for (let leafIndex = 0; leafIndex < 3; leafIndex++)
      shape(parent, "floor1-ivy-leaf", "sphere", leaf, [.2, .08, .13],
        [px + (leafIndex % 2 ? .12 : -.1), y - length * (.22 + leafIndex * .25), pz], yaw + leafIndex * 31);
  }
}

function banner(parent: pc.Entity, name: string, x: number, y: number, z: number, yaw: number,
  cloth: pc.StandardMaterial, wood: pc.StandardMaterial): void {
  shape(parent, `${name}-pole`, "cylinder", wood, [.11, 4.8, .11], [x, y + 2.3, z]);
  shape(parent, `${name}-cloth`, "box", cloth, [1.65, 2.15, .08], [x + .8, y + 3.2, z], [0, yaw, 4]);
}

function guardianStatue(parent: pc.Entity, name: string, x: number, z: number, yaw: number,
  stone: pc.StandardMaterial, accent: pc.StandardMaterial): void {
  const ground = towerFloorOneGroundHeight(x, z);
  shape(parent, `${name}-plinth`, "box", stone, [1.8, .7, 1.8], [x, ground + .35, z], yaw);
  shape(parent, `${name}-body`, "box", stone, [1.15, 2.8, .9], [x, ground + 2.05, z], yaw);
  shape(parent, `${name}-head`, "sphere", stone, [.78, .72, .7], [x, ground + 3.9, z]);
  shape(parent, `${name}-crest`, "cone", accent, [.55, 1.15, .55], [x, ground + 4.75, z], yaw);
  shape(parent, `${name}-shield`, "cylinder", accent, [1.35, .25, 1.35], [x + .65, ground + 2.25, z], [0, 0, 90]);
}

function brokenSupply(parent: pc.Entity, name: string, x: number, z: number, yaw: number,
  wood: pc.StandardMaterial, canvas: pc.StandardMaterial, metal: pc.StandardMaterial): void {
  const ground = towerFloorOneGroundHeight(x, z);
  shape(parent, `${name}-crate`, "box", wood, [1.4, 1.2, 1.4], [x, ground + .6, z], yaw);
  shape(parent, `${name}-strap`, "box", metal, [1.47, .12, 1.47], [x, ground + .72, z], yaw);
  shape(parent, `${name}-roll`, "cylinder", canvas, [.55, 1.45, .55], [x + 1.25, ground + .48, z - .35], [90, yaw, 0]);
}

const progressNodes = new WeakMap<pc.Entity, { northSeal: pc.Entity; southSeal: pc.Entity;
  barrier: pc.Entity; northChain: pc.Entity; southChain: pc.Entity }>();

/** Synchronises the physical seals with authoritative Warden state. Missing
 * streamed mobs are treated as alive by the caller, avoiding a false unlock. */
export function updateTowerFloorOneProgress(root: pc.Entity, northAlive: boolean, southAlive: boolean): void {
  const nodes = progressNodes.get(root);
  if (!nodes) return;
  nodes.northSeal.enabled = northAlive;
  nodes.southSeal.enabled = southAlive;
  nodes.northChain.enabled = northAlive;
  nodes.southChain.enabled = southAlive;
  nodes.barrier.enabled = northAlive || southAlive;
}

/** Structural art pass for Floor 1. Walkable height is shared with the server;
 * hard bounds and encounter rules remain authoritative. */
export function createTowerFloorOneWorld(app: pc.Application, parent: pc.Entity): pc.Entity {
  const root = new pc.Entity("tower-floor-1-world");
  parent.addChild(root);

  const stone = createPaintedGroundMaterial(app, { name: "floor1-shadow-stone", base: "#29302a",
    mottles: ["#374038", "#202620", "#4b5045"], litter: ["#596052", "#171c18"], seed: 811,
    roughness: .96, pattern: "stone" }, [2.2, 2.2]);
  const stoneLight = createPaintedGroundMaterial(app, { name: "floor1-weathered-stone", base: "#596052",
    mottles: ["#74796b", "#414a42", "#65604c"], litter: ["#8b8c78", "#303832"], seed: 812,
    roughness: .93, pattern: "stone" }, [2.6, 2.6]);
  const stoneWarm = finish(new pc.Color(.43, .39, .29));
  const moss = createPaintedGroundMaterial(app, { name: "floor1-deep-moss", base: "#244528",
    mottles: ["#315d31", "#172f1d", "#516b31"], litter: ["#71854a", "#142619"], seed: 813,
    roughness: .96, pattern: "grass" }, [3.2, 3.2]);
  const mossLight = createPaintedGroundMaterial(app, { name: "floor1-court-moss", base: "#477339",
    mottles: ["#60884b", "#315b32", "#80784a"], litter: ["#91a15b", "#223e26"], seed: 814,
    roughness: .95, pattern: "grass" }, [3.4, 3.4]);
  const earth = createPaintedGroundMaterial(app, { name: "floor1-root-soil", base: "#55402a",
    mottles: ["#74563a", "#33291f", "#756948"], litter: ["#9b7a50", "#241d16"], seed: 815,
    roughness: .98, pattern: "soil" }, [2.7, 2.7]);
  const bark = finish(new pc.Color(.17, .09, .045));
  const leaf = finish(new pc.Color(.075, .27, .1));
  const leafDark = finish(new pc.Color(.025, .12, .055));
  const sanctuary = finish(new pc.Color(.08, .68, .92), .72, .7);
  const bossGlow = finish(new pc.Color(.58, .16, .78), .58, .76);
  const gold = finish(new pc.Color(.78, .52, .13), .15);
  const voidMaterial = finish(new pc.Color(.006, .01, .016));
  const shaftMaterial = finish(new pc.Color(.8, .88, .64), .18, .075);
  const mistMaterial = finish(new pc.Color(.17, .3, .24), .05, .12);
  const moteMaterial = finish(new pc.Color(.62, .76, .41), .5, .68);
  const deadLeafMaterial = finish(new pc.Color(.5, .31, .12), .04, .86);
  const sanctuaryStone = finish(new pc.Color(.48, .6, .56), .04);
  const expeditionCanvas = finish(new pc.Color(.48, .38, .24));
  const timber = finish(new pc.Color(.25, .13, .06));
  const iron = finish(new pc.Color(.16, .18, .18));
  const northRed = finish(new pc.Color(.55, .085, .045), .12);
  const northSealGlow = finish(new pc.Color(.92, .18, .06), .85, .78);
  const southGreen = finish(new pc.Color(.16, .5, .18), .12);
  const southSealGlow = finish(new pc.Color(.22, .95, .32), .8, .78);
  const poison = finish(new pc.Color(.35, .82, .2), .48, .82);
  const sealBarrier = finish(new pc.Color(.67, .24, .82), .62, .2);

  shape(root, "floor1-abyss", "box", voidMaterial, [138, 4, 142], [344, 1.9, 106]);
  shape(root, "floor1-fortress-skirt", "cylinder", stone, [99, 7.6, 104], [344, 4.15, 106]);
  shape(root, "floor1-fortress-platform", "cylinder", stoneLight, [96, .8, 100], [344, 7.6, 106]);
  const floor = shape(root, "floor1-overgrown-floor", "cylinder", moss, [90, .09, 94], [344, 8.02, 106]);
  fitOrganicGroundPatch(app.graphicsDevice, floor, moss, [90, .09, 94], [344, 8.02, 106]);

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
  const sanctuaryCap = shape(root, "floor1-sanctuary-cap", "cylinder", stoneLight, [23.5, .34, 23.5], [306, 8.83, 106]);
  fitOrganicGroundPatch(app.graphicsDevice, sanctuaryCap, stoneLight, [23.5, .34, 23.5], [306, 8.83, 106]);
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
  guardianStatue(root, "floor1-sanctuary-guardian-north", 310.5, 98.2, 155, sanctuaryStone, sanctuary);
  guardianStatue(root, "floor1-sanctuary-guardian-south", 310.5, 113.8, 25, sanctuaryStone, sanctuary);
  brokenSupply(root, "floor1-sanctuary-supply-a", 301.5, 98.5, 18, timber, expeditionCanvas, iron);
  brokenSupply(root, "floor1-sanctuary-supply-b", 301, 114, -23, timber, expeditionCanvas, iron);

  shape(root, "floor1-opening-foundation", "cylinder", stone, [30, .48, 30], [329, 7.94, 106]);
  const openingCourt = shape(root, "floor1-opening-court", "cylinder", mossLight, [27.5, .09, 27.5], [329, 8.2, 106]);
  fitOrganicGroundPatch(app.graphicsDevice, openingCourt, mossLight, [27.5, .09, 27.5], [329, 8.2, 106]);
  causeway(root, "floor1-arrival-causeway", [317, 106], [329, 106], 5, 7.2, stoneLight, earth);

  // A destroyed expedition camp supplies the first environmental story beat.
  for (const [name, x, z, yaw] of [["cart-a",325,99,22],["cart-b",329,115,-18],["cache",333,101,8]] as const)
    brokenSupply(root, `floor1-expedition-${name}`, x, z, yaw, timber, expeditionCanvas, iron);
  shape(root, "floor1-broken-cart-bed", "box", timber, [3.8, .45, 1.8], [328, towerFloorOneGroundHeight(328, 99) + .55, 99], [0, -18, 8]);
  for (const side of [-1, 1])
    shape(root, "floor1-broken-cart-wheel", "cylinder", iron, [1.1, .22, 1.1],
      [328 + side * .85, towerFloorOneGroundHeight(328, 99) + .55, 99 + side * .7], [90, 0, 0]);
  shape(root, "floor1-fallen-expedition-standard", "cylinder", timber, [.1, 4.2, .1],
    [333, towerFloorOneGroundHeight(333, 113) + .45, 113], [0, 0, 72]);
  shape(root, "floor1-torn-expedition-banner", "box", expeditionCanvas, [1.8, 1.2, .07],
    [334.2, towerFloorOneGroundHeight(333, 113) + 1.15, 113], [12, 0, 18]);

  for (const [name, x, z] of [["north", 350, 80], ["south", 350, 132]] as const) {
    shape(root, `floor1-${name}-terrace-base`, "cylinder", stone, [28, 1.36, 28], [x, 8, z]);
    shape(root, `floor1-${name}-terrace-rim`, "cylinder", stoneWarm, [26.6, .18, 26.6], [x, 8.61, z]);
    const court = shape(root, `floor1-${name}-warden-court`, "cylinder", mossLight, [24.5, .09, 24.5], [x, 8.72, z]);
    fitOrganicGroundPatch(app.graphicsDevice, court, mossLight, [24.5, .09, 24.5], [x, 8.72, z]);
  }
  causeway(root, "floor1-north-causeway", [333, 101], [345, 86], 6, 5.4, stoneLight, earth, [2]);
  causeway(root, "floor1-south-causeway", [333, 111], [345, 126], 6, 5.4, stoneLight, earth, [3]);

  // North is a crushed military gate: red standards, massive rubble and roots.
  banner(root, "floor1-north-banner-a", 344, 8.68, 69.5, 0, northRed, timber);
  banner(root, "floor1-north-banner-b", 356, 8.68, 69.5, 180, northRed, timber);
  for (const [x,z,s] of [[342,75,1.6],[358,74,1.9],[361,84,1.35],[339,85,1.2]] as const)
    shape(root, "floor1-north-rubble", "box", x % 2 ? stone : stoneLight, [s, s * .72, s * 1.15],
      [x, towerFloorOneGroundHeight(x, z) + s * .28, z], [x % 17, z % 43, x % 11]);
  rootCluster(root, 350, 72.5, 90, 8.4, bark, mossLight);
  rootCluster(root, 341, 79, 12, 6.8, bark, mossLight);

  // South is a corrupted thorn shrine with a poisoned botanical silhouette.
  for (let index = 0; index < 7; index++) {
    const angle = index / 7 * Math.PI * 2;
    const x = 350 + Math.cos(angle) * 8.4, z = 132 + Math.sin(angle) * 8.4;
    const ground = towerFloorOneGroundHeight(x, z);
    shape(root, "floor1-south-thorn", "cone", index % 2 ? southGreen : leafDark,
      [.58, 3.2 + index % 3, .58], [x, ground + 1.5, z], -angle * 180 / Math.PI);
    shape(root, "floor1-south-poison-bloom", "sphere", poison, [.38, .22, .38],
      [x, ground + 3.1 + index % 3, z]);
  }
  shape(root, "floor1-south-shrine", "cylinder", stone, [5.5, 1.25, 5.5], [350, 9.05, 132]);
  shape(root, "floor1-south-shrine-crystal", "cone", southSealGlow, [1.5, 3.8, 1.5], [350, 11.2, 132]);

  arch(root, "floor1-opening-gate", 320.5, 106, 8.55, 6.4, 6.5, 90, stoneLight, stone, bark);
  arch(root, "floor1-north-breach", 339, 94, towerFloorOneGroundHeight(339, 94), 5.4, 5.8, 49,
    stoneLight, stone, bark);
  arch(root, "floor1-south-breach", 339, 118, towerFloorOneGroundHeight(339, 118), 5.4, 5.8, -49,
    stoneLight, stone, bark);

  for (const [x, z, yaw, length] of [[315, 89, 26, 6], [316, 124, -31, 5.5], [333, 73, 12, 7],
    [338, 141, -17, 6.5], [363, 72, 48, 5.8], [366, 139, -52, 6.4], [383, 91, 74, 5.2]] as const)
    rootCluster(root, x, z, yaw, length, bark, mossLight);
  ivyCurtain(root, 322, 14.8, 92.55, 0, 8.5, 4.8, leaf, leafDark);
  ivyCurtain(root, 349, 14.5, 68.7, 0, 10, 4.2, leaf, leafDark);
  ivyCurtain(root, 360.7, 14.3, 124, 90, 7.5, 3.8, leaf, leafDark);

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
  const northSeal = shape(root, "floor1-north-warden-seal", "sphere", northSealGlow, [1.25, 1.25, .48], [361.35, 14.9, 103.7]);
  const southSeal = shape(root, "floor1-south-warden-seal", "sphere", southSealGlow, [1.25, 1.25, .48], [361.35, 14.9, 108.3]);
  const northChain = shape(root, "floor1-north-seal-chain", "box", northSealGlow, [.15, 6.7, .15], [361.25, 12.2, 104.8], [0, 0, 54]);
  const southChain = shape(root, "floor1-south-seal-chain", "box", southSealGlow, [.15, 6.7, .15], [361.25, 12.2, 107.2], [0, 0, -54]);
  const barrier = shape(root, "floor1-crown-seal-barrier", "box", sealBarrier, [.18, 6.8, 7.6], [362.3, 12.85, 106]);
  northSeal.enabled = southSeal.enabled = northChain.enabled = southChain.enabled = barrier.enabled = true;
  progressNodes.set(root, { northSeal, southSeal, barrier, northChain, southChain });
  shape(root, "floor1-boss-fortress", "cylinder", stone, [32, 3.1, 32], [375, 8, 106]);
  shape(root, "floor1-boss-court-rim", "cylinder", gold, [30.5, .2, 30.5], [375, 9.47, 106]);
  const bossCourt = shape(root, "floor1-boss-court", "cylinder", stoneLight, [29.2, .18, 29.2], [375, 9.57, 106]);
  fitOrganicGroundPatch(app.graphicsDevice, bossCourt, stoneLight, [29.2, .18, 29.2], [375, 9.57, 106]);
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
  guardianStatue(root, "floor1-crown-statue-north", 381.5, 96, 180, stoneWarm, gold);
  guardianStatue(root, "floor1-crown-statue-south", 381.5, 116, 180, stoneWarm, gold);
  banner(root, "floor1-crown-banner-north", 385.5, 9.55, 99.5, 180, bossGlow, gold);
  banner(root, "floor1-crown-banner-south", 385.5, 9.55, 112.5, 180, bossGlow, gold);
  // The ascent portal is always visible behind the throne but remains server-
  // locked until the Crownkeeper falls.
  arch(root, "floor1-ascent-portal-frame", 388, 106, 9.55, 5.4, 7.3, 90, stoneWarm, stone, bark);

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

  // Broken ceiling light and low mist establish an interior tower atmosphere
  // without full-screen post processing or unbounded particles.
  for (const [x, z, scale, tilt] of [[319, 90, 1.15, 8], [347, 119, .92, -6], [373, 98, 1.25, 5]] as const)
    shape(root, "floor1-light-shaft", "cone", shaftMaterial, [8 * scale, 34, 8 * scale],
      [x, 25, z], [tilt, 0, tilt * .35]);
  for (const [x, z, sx, sz] of [[327,82,17,9],[340,130,20,8],[374,106,24,13]] as const)
    shape(root, "floor1-ground-mist", "sphere", mistMaterial, [sx, .48, sz],
      [x, towerFloorOneGroundHeight(x, z) + .38, z]);

  const atmosphericMotes: Array<{ entity: pc.Entity; x: number; y: number; z: number; phase: number }> = [];
  for (let index = 0; index < 18; index++) {
    const x = 311 + (index * 23 % 72), z = 66 + (index * 31 % 78);
    const y = towerFloorOneGroundHeight(x, z) + 1.5 + (index % 5) * .72;
    const entity = shape(root, "floor1-spore", "sphere", moteMaterial, [.055, .055, .055], [x, y, z]);
    atmosphericMotes.push({ entity, x, y, z, phase: index * .83 });
  }
  const fallingLeaves: Array<{ entity: pc.Entity; x: number; y: number; z: number; phase: number }> = [];
  for (let index = 0; index < 10; index++) {
    const x = 315 + (index * 19 % 67), z = 69 + (index * 27 % 72);
    const y = towerFloorOneGroundHeight(x, z) + 3.2 + index % 4;
    const entity = shape(root, "floor1-falling-leaf", "box", deadLeafMaterial, [.16, .025, .09], [x, y, z], index * 37);
    fallingLeaves.push({ entity, x, y, z, phase: index * 1.17 });
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
    for (const mote of atmosphericMotes) {
      const drift = elapsed + mote.phase;
      mote.entity.setLocalPosition(mote.x + Math.sin(drift * .72) * .42,
        mote.y + Math.sin(drift * 1.15) * .3, mote.z + Math.cos(drift * .63) * .42);
    }
    for (const leaf of fallingLeaves) {
      const travel = (elapsed * .12 + leaf.phase * .11) % 1;
      leaf.entity.setLocalPosition(leaf.x + Math.sin(elapsed + leaf.phase) * .8,
        leaf.y - travel * 4.6, leaf.z + Math.cos(elapsed * .7 + leaf.phase) * .65);
      leaf.entity.setLocalEulerAngles(travel * 210, leaf.phase * 80 + elapsed * 26, Math.sin(elapsed + leaf.phase) * 34);
    }
  });
  return root;
}
