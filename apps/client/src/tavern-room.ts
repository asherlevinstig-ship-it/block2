import * as pc from "playcanvas";
import { addCallingParticleLayers } from "./calling-particles.js";
import { bindTownNpcRig, loadTownNpcAssets, TOWN_NPC_MODEL_YAW } from "./town-npc-assets.js";

const DUNGEON_ASSET_ROOT = "/assets/kaykit-dungeon";
const CHAIR_URL = `${DUNGEON_ASSET_ROOT}/chair.gltf.glb`;
const BARRELS_URL = `${DUNGEON_ASSET_ROOT}/barrel_small_stack.gltf.glb`;
const CRATES_URL = `${DUNGEON_ASSET_ROOT}/crates_stacked.gltf.glb`;
const TORCH_URL = `${DUNGEON_ASSET_ROOT}/torch_lit.gltf.glb`;

export const TAVERN_ROOM_ZONES = {
  entrance: { x: 0, z: 5.6, radius: 2.2 },
  bar: { x: -7.2, z: -1.5, radius: 3.2 },
  hearth: { x: 3.8, z: -6.2, radius: 3.1 },
  dining: { x: 4.6, z: 2.8, radius: 3.4 },
} as const;

function material(color: pc.Color, emissive?: pc.Color, gloss = .2): pc.StandardMaterial {
  const result = new pc.StandardMaterial();
  result.diffuse = color;
  if (emissive) result.emissive = emissive;
  result.gloss = gloss;
  result.metalness = 0;
  result.update();
  return result;
}

function shape(parent: pc.Entity, name: string, type: "box" | "cylinder" | "sphere" | "cone",
  mat: pc.Material, scale: readonly [number, number, number], position: readonly [number, number, number],
  euler?: readonly [number, number, number]): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent("render", { type, castShadows: true, receiveShadows: true });
  if (entity.render) entity.render.material = mat;
  entity.setLocalScale(...scale);
  entity.setLocalPosition(...position);
  if (euler) entity.setLocalEulerAngles(...euler);
  parent.addChild(entity);
  return entity;
}

const box = (parent: pc.Entity, name: string, mat: pc.Material, scale: readonly [number, number, number],
  position: readonly [number, number, number], euler?: readonly [number, number, number]): pc.Entity =>
  shape(parent, name, "box", mat, scale, position, euler);
const cylinder = (parent: pc.Entity, name: string, mat: pc.Material, scale: readonly [number, number, number],
  position: readonly [number, number, number], euler?: readonly [number, number, number]): pc.Entity =>
  shape(parent, name, "cylinder", mat, scale, position, euler);

function loadProp(app: pc.Application, url: string, parent: pc.Entity,
  placements: { position: [number, number, number]; yaw?: number; scale?: number }[]): void {
  app.assets.loadFromUrl(url, "container", (error, asset) => {
    const resource = asset?.resource as pc.ContainerResource | undefined;
    if (error || !resource) {
      console.warn(`[tavern-assets] Could not load ${url}; authored furniture remains.`, error);
      return;
    }
    for (const placement of placements) {
      const entity = resource.instantiateRenderEntity({ castShadows: true, receiveShadows: true });
      entity.setLocalPosition(...placement.position);
      entity.setLocalEulerAngles(0, placement.yaw ?? 0, 0);
      const scale = placement.scale ?? 1;
      entity.setLocalScale(scale, scale, scale);
      parent.addChild(entity);
    }
  });
}

function addWindow(parent: pc.Entity, name: string, x: number, z: number, yaw: number,
  oak: pc.Material, stone: pc.Material, daylight: pc.Material): void {
  const root = new pc.Entity(name);
  root.setLocalPosition(x, 10.8, z);
  root.setLocalEulerAngles(0, yaw, 0);
  parent.addChild(root);
  box(root, "window-recess", stone, [.24, 2.25, 2.35], [0, 0, 0]);
  box(root, "window-daylight", daylight, [.255, 1.62, 1.72], [-.03, 0, 0]);
  box(root, "window-frame-vertical", oak, [.3, 1.78, .13], [-.29, 0, 0]);
  box(root, "window-frame-horizontal", oak, [.3, .13, 1.9], [-.3, 0, 0]);
  box(root, "window-sill", stone, [.45, .18, 2.55], [-.05, -1.22, 0]);
}

function addRoundTable(parent: pc.Entity, name: string, x: number, z: number,
  oak: pc.Material, oakLight: pc.Material, brass: pc.Material): void {
  cylinder(parent, `${name}-top`, oakLight, [2.05, .18, 2.05], [x, 9.05, z]);
  cylinder(parent, `${name}-leg`, oak, [.42, 1.05, .42], [x, 8.5, z]);
  cylinder(parent, `${name}-foot`, oak, [1.05, .12, 1.05], [x, 8.1, z]);
  cylinder(parent, `${name}-candle`, brass, [.09, .38, .09], [x, 9.38, z]);
}

function addWallTimbers(parent: pc.Entity, oak: pc.Material): void {
  for (const x of [-9.25, 9.25]) for (const z of [-7.7, 0, 7.7])
    box(parent, "wall-post", oak, [.48, 5.65, .48], [x, 10.75, z]);
  for (const z of [-7.86, 7.86]) {
    box(parent, "wall-beam-high", oak, [18.7, .38, .32], [0, 12.72, z]);
  }
  for (const x of [-9.38, 9.38]) {
    box(parent, "side-beam-high", oak, [.32, .38, 15.6], [x, 12.72, 0]);
  }
}

function loadTavernPeople(app: pc.Application, root: pc.Entity, proceduralMara: pc.Entity): void {
  void loadTownNpcAssets(app).then(result => {
    const placements = [
      { role: "vendor" as const, position: [-8.2, 8.02, -1.5] as [number, number, number], yaw: 90, phase: .2 },
      { role: "resident" as const, position: [5.9, 8.02, 2.8] as [number, number, number], yaw: 210, phase: .8 },
    ];
    for (const [index, placement] of placements.entries()) {
      const asset = result.loaded.get(placement.role);
      const resource = asset?.resource as (pc.ContainerResource & { animations: pc.Asset[] }) | undefined;
      if (!resource) continue;
      const model = resource.instantiateRenderEntity({ castShadows: true, receiveShadows: true });
      model.name = index === 0 ? "mara-innkeeper" : `tavern-patron-${index}`;
      model.setLocalPosition(...placement.position);
      model.setLocalEulerAngles(0, TOWN_NPC_MODEL_YAW + placement.yaw, 0);
      model.setLocalScale(.86, .86, .86);
      root.addChild(model);
      if (!bindTownNpcRig(model, resource.animations, "Idle", placement.phase)) {
        model.destroy();
        continue;
      }
      if (index === 0) proceduralMara.enabled = false;
    }
  });
}

/** A composed, asset-backed RPG interior for the dedicated Hearth & Hammer room. */
export function createTavernRoom(app: pc.Application): pc.Entity {
  const root = new pc.Entity("hearth-and-hammer-room");
  app.root.addChild(root);

  const oak = material(new pc.Color(.105, .045, .018), undefined, .14);
  const oakLight = material(new pc.Color(.31, .145, .045), undefined, .2);
  const plaster = material(new pc.Color(.52, .46, .34), undefined, .08);
  const stone = material(new pc.Color(.22, .235, .24), undefined, .12);
  const stoneLight = material(new pc.Color(.38, .39, .36), undefined, .16);
  const iron = material(new pc.Color(.055, .065, .07), undefined, .32);
  const rugRed = material(new pc.Color(.33, .035, .025));
  const rugGreen = material(new pc.Color(.055, .19, .12));
  const brass = material(new pc.Color(.68, .39, .07), undefined, .38);
  const daylight = material(new pc.Color(.12, .25, .34), new pc.Color(.06, .18, .28), .45);
  const fire = material(new pc.Color(1, .27, .025), new pc.Color(1, .12, .005), .15);
  const ember = material(new pc.Color(1, .62, .12), new pc.Color(.9, .22, .015), .1);

  box(root, "timber-floor", oakLight, [19.5, .22, 16.5], [0, 7.88, 0]);
  for (let x = -9; x <= 9; x += 1.5)
    box(root, "floor-board-seam", oak, [.028, .028, 16.1], [x, 8.012, 0]);
  for (const [name, scale, position] of [
    ["back-wall", [19.5, 6.1, .35], [0, 11, -8.15]],
    ["left-wall", [.35, 6.1, 16.5], [-9.65, 11, 0]],
    ["right-wall", [.35, 6.1, 16.5], [9.65, 11, 0]],
    ["front-wall-left", [8.25, 6.1, .35], [-5.55, 11, 8.15]],
    ["front-wall-right", [8.25, 6.1, .35], [5.55, 11, 8.15]],
  ] as const) box(root, name, plaster, scale, position);
  for (const [scale, position] of [
    [[19.15, 1.05, .45], [0, 8.52, -7.93]], [[19.15, 1.05, .45], [0, 8.52, 7.93]],
    [[.45, 1.05, 15.7], [-9.43, 8.52, 0]], [[.45, 1.05, 15.7], [9.43, 8.52, 0]],
  ] as const) box(root, "stone-wainscot", stone, scale, position);
  addWallTimbers(root, oak);
  box(root, "raised-ceiling", oak, [19.5, .3, 16.5], [0, 14.18, 0]);
  for (const z of [-5.2, 0, 5.2])
    box(root, "ceiling-rafter", oakLight, [19.75, .42, .46], [0, 13.72, z]);

  addWindow(root, "west-window-a", -9.42, -1.7, 0, oak, stoneLight, daylight);
  addWindow(root, "west-window-b", -9.42, 3.8, 0, oak, stoneLight, daylight);
  addWindow(root, "east-window", 9.42, -1.8, 180, oak, stoneLight, daylight);
  box(root, "entrance-lintel", stoneLight, [3.45, .5, .55], [0, 12.7, 7.82]);
  box(root, "entrance-frame-left", stone, [.52, 4.5, .65], [-1.65, 10.08, 7.82]);
  box(root, "entrance-frame-right", stone, [.52, 4.5, .65], [1.65, 10.08, 7.82]);
  box(root, "entrance-runner", rugGreen, [3.2, .035, 5.2], [0, 8.02, 5.25]);

  // The bar lives along the west wall, leaving the entrance-to-hearth axis open.
  box(root, "bar-front", oak, [.9, 1.55, 8.2], [-7.35, 8.8, -1.4]);
  box(root, "bar-panel", oakLight, [.12, 1.02, 7.5], [-6.84, 8.76, -1.4]);
  box(root, "bar-top", oakLight, [1.45, .22, 8.7], [-7.35, 9.68, -1.4]);
  for (const z of [-4.2, -1.4, 1.4]) {
    cylinder(root, "bar-stool-seat", oakLight, [.78, .22, .78], [-5.85, 8.9, z]);
    cylinder(root, "bar-stool-leg", oak, [.18, .82, .18], [-5.85, 8.42, z]);
    box(root, "bottle-shelf", oakLight, [.38, .14, 1.35], [-9.25, 10.4, z]);
    cylinder(root, "bottle", z < 0 ? rugGreen : brass, [.14, .5, .14], [-8.95, 10.75, z]);
    cylinder(root, "bottle-neck", brass, [.065, .2, .065], [-8.95, 11.08, z]);
  }
  box(root, "bar-menu-board", iron, [.16, 1.5, 2.2], [-9.26, 12.05, -1.4]);
  for (let line = 0; line < 4; line++)
    box(root, "bar-menu-line", brass, [.035, .045, 1.35 - line * .1], [-9.15, 12.42 - line * .28, -1.4]);

  // A restrained stone hearth anchors the back wall without swallowing the room.
  const hearthX = 3.8;
  box(root, "hearth-plinth", stoneLight, [5.25, .36, 1.7], [hearthX, 8.18, -6.82]);
  box(root, "hearth-back", stone, [4.85, 4.35, .58], [hearthX, 10.05, -7.58]);
  box(root, "hearth-recess", iron, [2.55, 2.2, .3], [hearthX, 9.25, -6.98]);
  for (const x of [hearthX - 1.72, hearthX + 1.72]) {
    box(root, "hearth-pier", stoneLight, [.7, 3.25, .92], [x, 9.72, -6.9]);
    for (const y of [8.55, 9.45, 10.35])
      box(root, "hearth-pier-course", stone, [.78, .08, .98], [x, y, -6.86]);
  }
  box(root, "hearth-lintel", stoneLight, [4.05, .68, 1], [hearthX, 10.96, -6.9]);
  box(root, "hearth-corbel-left", stoneLight, [.72, .5, .95], [hearthX - 1.34, 10.55, -6.88], [0, 0, -22]);
  box(root, "hearth-corbel-right", stoneLight, [.72, .5, .95], [hearthX + 1.34, 10.55, -6.88], [0, 0, 22]);
  box(root, "hearth-mantle", stone, [4.75, .28, 1.22], [hearthX, 11.42, -6.88]);
  box(root, "hearth-chimney", stone, [2.25, 2.45, .74], [hearthX, 12.65, -7.52]);
  for (const yaw of [-28, 28])
    cylinder(root, "hearth-log", oak, [.2, 1.08, .2], [hearthX, 8.46, -6.46], [0, 0, yaw]);
  for (const offset of [-.72, -.36, 0, .36, .72])
    shape(root, "hearth-ember", "sphere", ember, [.15, .08, .12], [hearthX + offset, 8.5, -6.28]);
  const flameSpecs = [
    [-.58, .38, .62], [-.22, .46, .86], [.16, .42, .72], [.52, .34, .56],
  ] as const;
  const flames = flameSpecs.map(([offset, width, height], index) =>
    shape(root, `hearth-flame-${index}`, "sphere", index % 2 ? ember : fire,
      [width, height, .19], [hearthX + offset, 8.68 + height * .45, -6.22]));
  const fireParticles = new pc.Entity("hearth-particles");
  fireParticles.setLocalPosition(hearthX, 8.54, -6.16);
  root.addChild(fireParticles);
  addCallingParticleLayers(app, fireParticles, [
    { kind: "glow", texture: "orb", count: 13, life: .62, radius: .52, speed: .14, rise: .82, size: .34, color: [1, .23, .02], opacity: .78 },
    { kind: "spark", texture: "rune", count: 7, life: 1.05, radius: .48, speed: .24, rise: 1.35, size: .08, color: [1, .62, .1], opacity: .75 },
    { kind: "smoke", texture: "smoke", count: 5, life: 2.5, radius: .4, speed: .05, rise: .52, size: .38, color: [.13, .12, .11], opacity: .2 },
  ], true, .72);
  const hearthLight = new pc.Entity("hearth-light");
  hearthLight.addComponent("light", { type: "omni", color: new pc.Color(1, .36, .1), intensity: 1.75, range: 8, castShadows: true, shadowResolution: 512 });
  hearthLight.setLocalPosition(hearthX, 9.05, -5.9);
  root.addChild(hearthLight);
  box(root, "hearth-rug", rugRed, [5.25, .04, 2.55], [hearthX, 8.025, -4.75]);
  for (const [x, z, yaw] of [[.9, -5.0, 90], [6.7, -5.0, 90]] as const) {
    box(root, "hearth-bench-seat", oakLight, [2.15, .28, .68], [x, 8.68, z], [0, yaw, 0]);
    box(root, "hearth-bench-back", oak, [2.15, .94, .24], [x, 9.17, z], [0, yaw, 0]);
  }

  addRoundTable(root, "quiz-table", 0, 1.35, oak, oakLight, brass);
  addRoundTable(root, "dining-table", 5.6, 3.35, oak, oakLight, brass);
  box(root, "quiz-rug", rugGreen, [4.35, .038, 3.55], [0, 8.022, 1.35]);
  box(root, "dining-rug", rugGreen, [4.5, .038, 3.8], [5.6, 8.022, 3.35]);

  box(root, "notice-board", oak, [3.4, 2.25, .18], [-6.8, 10.55, 7.68]);
  for (const [x, y, tint] of [[-7.65, 11.05, plaster], [-6.75, 10.42, brass], [-5.9, 11, plaster]] as const)
    box(root, "notice-sheet", tint, [.58, .72, .045], [x, y, 7.55], [0, 0, x === -6.75 ? -7 : 4]);

  const maraFallback = new pc.Entity("mara-procedural-fallback");
  root.addChild(maraFallback);
  cylinder(maraFallback, "mara-body", rugRed, [.66, 1.25, .66], [-8.2, 9.28, -1.5]);
  shape(maraFallback, "mara-head", "sphere", brass, [.46, .46, .46], [-8.2, 10.62, -1.5]);

  loadProp(app, CHAIR_URL, root, [
    { position: [-1.85, 8.02, 1.35], yaw: 90, scale: 1.05 },
    { position: [1.85, 8.02, 1.35], yaw: -90, scale: 1.05 },
    { position: [3.75, 8.02, 3.35], yaw: 90, scale: 1.05 },
    { position: [7.45, 8.02, 3.35], yaw: -90, scale: 1.05 },
  ]);
  loadProp(app, BARRELS_URL, root, [
    { position: [-8.25, 8.02, -6.35], yaw: 20, scale: 1.15 },
    { position: [-8.15, 8.02, 5.85], yaw: -15, scale: 1.1 },
  ]);
  loadProp(app, CRATES_URL, root, [{ position: [-8.1, 8.02, 4.55], yaw: 12, scale: .95 }]);
  loadProp(app, TORCH_URL, root, [
    { position: [-9.25, 10.2, -4.2], yaw: 90, scale: 1.25 },
    { position: [9.25, 10.2, -4.2], yaw: -90, scale: 1.25 },
  ]);
  loadTavernPeople(app, root, maraFallback);

  const coolFill = new pc.Entity("tavern-cool-fill");
  coolFill.addComponent("light", { type: "omni", color: new pc.Color(.34, .46, .54), intensity: .36, range: 32, castShadows: false });
  coolFill.setLocalPosition(0, 12.8, 2.5);
  root.addChild(coolFill);
  for (const [x, z] of [[-4.5, 1.5], [4.5, 4.5]] as const) {
    const light = new pc.Entity("tavern-candle-cluster-light");
    light.addComponent("light", { type: "omni", color: new pc.Color(1, .64, .3), intensity: .75, range: 8, castShadows: false });
    light.setLocalPosition(x, 11.3, z);
    root.addChild(light);
    cylinder(root, "chandelier-stem", iron, [.06, 1.15, .06], [x, 12.45, z]);
    box(root, "chandelier-arm-x", iron, [1.15, .08, .08], [x, 11.35, z]);
    box(root, "chandelier-arm-z", iron, [.08, .08, 1.15], [x, 11.35, z]);
    for (const [dx, dz] of [[-.52, 0], [.52, 0], [0, -.52], [0, .52]] as const)
      cylinder(root, "chandelier-candle", brass, [.065, .3, .065], [x + dx, 11.55, z + dz]);
  }

  let elapsed = 0;
  app.on("update", (dt: number) => {
    if (!root.enabled) return;
    elapsed += dt;
    const flicker = Math.sin(elapsed * 9.7) * .08 + Math.sin(elapsed * 17.3) * .045;
    if (hearthLight.light) hearthLight.light.intensity = 1.75 + flicker * .85;
    flames.forEach((flame, index) => {
      const [, width, height] = flameSpecs[index]!;
      flame.setLocalScale(width * (1 + Math.sin(elapsed * (6.4 + index)) * .09),
        height * (1 + Math.sin(elapsed * (7.2 + index * .7)) * .14), .19);
    });
  });
  return root;
}
