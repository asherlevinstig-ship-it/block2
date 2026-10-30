import * as pc from "playcanvas";
import { bindTownNpcRig, loadTownNpcAssets, TOWN_NPC_MODEL_YAW } from "./town-npc-assets.js";

const DUNGEON_ASSET_ROOT = "/assets/kaykit-dungeon";
const CHAIR_URL = `${DUNGEON_ASSET_ROOT}/chair.gltf.glb`;
const BARRELS_URL = `${DUNGEON_ASSET_ROOT}/barrel_small_stack.gltf.glb`;
const CRATES_URL = `${DUNGEON_ASSET_ROOT}/crates_stacked.gltf.glb`;
const TORCH_URL = `${DUNGEON_ASSET_ROOT}/torch_lit.gltf.glb`;
const RED_BANNER_URL = `${DUNGEON_ASSET_ROOT}/banner_patternA_red.gltf.glb`;
const BLUE_BANNER_URL = `${DUNGEON_ASSET_ROOT}/banner_patternA_blue.gltf.glb`;

export const TAVERN_ROOM_ZONES = {
  entrance: { x: 0, z: 5.6, radius: 2.2 },
  bar: { x: -5.1, z: -4.15, radius: 3.4 },
  hearth: { x: 5.5, z: -4.8, radius: 3.5 },
  dining: { x: 3.4, z: 2.8, radius: 4 },
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
  cylinder(parent, `${name}-top`, oakLight, [2.45, .18, 2.45], [x, 9.05, z]);
  cylinder(parent, `${name}-leg`, oak, [.42, 1.05, .42], [x, 8.5, z]);
  cylinder(parent, `${name}-foot`, oak, [1.05, .12, 1.05], [x, 8.1, z]);
  cylinder(parent, `${name}-candle`, brass, [.09, .38, .09], [x, 9.38, z]);
}

function addWallTimbers(parent: pc.Entity, oak: pc.Material): void {
  for (const x of [-9.25, 9.25]) for (const z of [-7.7, -2.55, 2.6, 7.7])
    box(parent, "wall-post", oak, [.48, 5.65, .48], [x, 10.75, z]);
  for (const z of [-7.86, 7.86]) {
    box(parent, "wall-beam-low", oak, [18.7, .38, .32], [0, 9.02, z]);
    box(parent, "wall-beam-high", oak, [18.7, .38, .32], [0, 12.72, z]);
  }
  for (const x of [-9.38, 9.38]) {
    box(parent, "side-beam-low", oak, [.32, .38, 15.6], [x, 9.02, 0]);
    box(parent, "side-beam-high", oak, [.32, .38, 15.6], [x, 12.72, 0]);
  }
  for (const [x, z, yaw] of [[-5.9, -7.72, -36], [5.9, -7.72, 36], [-5.9, 7.72, 36], [5.9, 7.72, -36]] as const)
    box(parent, "wall-cross-brace", oak, [5.2, .24, .26], [x, 10.85, z], [0, 0, yaw]);
}

function addBalcony(parent: pc.Entity, oak: pc.Material, oakLight: pc.Material, stone: pc.Material): void {
  box(parent, "gallery-floor", oakLight, [4.2, .24, 7.5], [7.15, 11.48, 2.6]);
  box(parent, "gallery-edge", oak, [.28, 1.15, 7.5], [5.05, 12, 2.6]);
  for (const z of [-.5, 1.5, 3.5, 5.5]) {
    box(parent, "gallery-rail-post", oak, [.22, 1.45, .22], [4.85, 12.15, z]);
    box(parent, "gallery-wall-bracket", stone, [.42, .42, .42], [9.05, 11.15, z]);
  }
  box(parent, "gallery-rail-top", oakLight, [.34, .22, 7.8], [4.85, 12.82, 2.6]);
  for (let step = 0; step < 8; step++) {
    const y = 8.12 + step * .42, z = 6.35 - step * .72;
    box(parent, "gallery-stair", oakLight, [3.1, .42, 1.1], [7.55, y, z]);
  }
  box(parent, "gallery-stair-stringer", oak, [.22, 3.55, 6.2], [9.02, 9.75, 3.85], [35, 0, 0]);
}

function loadTavernPeople(app: pc.Application, root: pc.Entity, proceduralMara: pc.Entity): void {
  void loadTownNpcAssets(app).then(result => {
    const placements = [
      { role: "vendor" as const, position: [-4.6, 8.02, -6] as [number, number, number], yaw: 0, phase: .2 },
      { role: "resident" as const, position: [4.15, 8.02, -2.8] as [number, number, number], yaw: 30, phase: .55 },
      { role: "resident" as const, position: [6.6, 8.02, 2.7] as [number, number, number], yaw: 210, phase: .8 },
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
  const plaster = material(new pc.Color(.63, .53, .35), undefined, .08);
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
  for (let z = -6.8; z <= 6.8; z += 3.4)
    box(root, "ceiling-rafter", oakLight, [19.75, .42, .46], [0, 13.72, z]);

  addWindow(root, "west-window-a", -9.42, -1.7, 0, oak, stoneLight, daylight);
  addWindow(root, "west-window-b", -9.42, 3.8, 0, oak, stoneLight, daylight);
  addWindow(root, "east-window", 9.42, -1.8, 180, oak, stoneLight, daylight);
  box(root, "entrance-lintel", stoneLight, [3.45, .5, .55], [0, 12.7, 7.82]);
  box(root, "entrance-frame-left", stone, [.52, 4.5, .65], [-1.65, 10.08, 7.82]);
  box(root, "entrance-frame-right", stone, [.52, 4.5, .65], [1.65, 10.08, 7.82]);
  box(root, "entrance-runner", rugGreen, [3.2, .035, 5.2], [0, 8.02, 5.25]);

  box(root, "bar-front", oak, [9.2, 1.65, .9], [-4.75, 8.82, -4.65]);
  box(root, "bar-panel", oakLight, [8.55, 1.08, .12], [-4.75, 8.78, -4.14]);
  box(root, "bar-top", oakLight, [9.7, .24, 1.45], [-4.75, 9.72, -4.65]);
  for (const x of [-7.65, -5.65, -3.65, -1.65]) {
    cylinder(root, "bar-stool-seat", oakLight, [.92, .25, .92], [x, 9, -2.95]);
    cylinder(root, "bar-stool-leg", oak, [.2, .9, .2], [x, 8.48, -2.95]);
    box(root, "bottle-shelf", oakLight, [1.55, .15, .42], [x, 10.45, -7.68]);
    cylinder(root, "bottle", x % 2 ? rugGreen : brass, [.15, .56, .15], [x, 10.83, -7.6]);
    cylinder(root, "bottle-neck", brass, [.07, .25, .07], [x, 11.18, -7.6]);
  }
  box(root, "back-bar-upper", oak, [8.8, .26, .45], [-4.75, 11.58, -7.7]);
  box(root, "bar-menu-board", iron, [2.25, 1.45, .16], [-4.75, 12.32, -7.68]);
  for (let line = 0; line < 4; line++)
    box(root, "bar-menu-line", brass, [1.45 - line * .12, .045, .035], [-4.75, 12.7 - line * .28, -7.56]);

  box(root, "hearth-plinth", stoneLight, [5.4, .55, 2.3], [5.8, 8.25, -6.72]);
  box(root, "hearth-masonry", stone, [5.25, 4.65, .72], [5.8, 10.15, -7.55]);
  box(root, "hearth-opening", iron, [2.95, 2.15, .25], [5.8, 9.3, -7.08]);
  box(root, "hearth-mantle", stoneLight, [5.85, .4, 1.12], [5.8, 11.58, -7.12]);
  box(root, "hearth-chimney", stone, [2.45, 2.55, .8], [5.8, 12.88, -7.52]);
  for (const yaw of [-22, 22])
    cylinder(root, "hearth-log", oak, [.22, 1.3, .22], [5.8, 8.58, -6.82], [0, 0, yaw]);
  const flames = [-.58, 0, .58].map((offset, index) =>
    shape(root, `hearth-flame-${index}`, "cone", index === 1 ? ember : fire,
      [.48 + index % 2 * .12, 1.15 + (index === 1 ? .45 : 0), .48], [5.8 + offset, 9, -6.72]));
  const hearthLight = new pc.Entity("hearth-light");
  hearthLight.addComponent("light", { type: "omni", color: new pc.Color(1, .39, .1), intensity: 3.1, range: 15, castShadows: true, shadowResolution: 512 });
  hearthLight.setLocalPosition(5.8, 9.6, -5.9);
  root.addChild(hearthLight);
  box(root, "hearth-rug", rugRed, [6.4, .04, 4.1], [4.8, 8.025, -3.8]);
  for (const [x, z, yaw] of [[3.05, -3.65, 90], [6.55, -2.55, 0]] as const) {
    box(root, "hearth-bench-seat", oakLight, [2.8, .28, .75], [x, 8.68, z], [0, yaw, 0]);
    box(root, "hearth-bench-back", oak, [2.8, 1.1, .26], [x, 9.24, z + (yaw ? 0 : .5)], [0, yaw, 0]);
  }

  addRoundTable(root, "quiz-table", 3.6, -1.4, oak, oakLight, brass);
  addRoundTable(root, "dining-table-a", 5.9, 3.5, oak, oakLight, brass);
  addRoundTable(root, "dining-table-b", -4.8, 3.3, oak, oakLight, brass);
  box(root, "quiz-rug", rugGreen, [5.2, .038, 4.2], [3.6, 8.022, -1.4]);
  box(root, "quiz-rug-border-a", brass, [5.35, .045, .11], [3.6, 8.045, -3.48]);
  box(root, "quiz-rug-border-b", brass, [5.35, .045, .11], [3.6, 8.045, .68]);
  addBalcony(root, oak, oakLight, stone);

  box(root, "notice-board", oak, [3.4, 2.25, .18], [-6.8, 10.55, 7.68]);
  for (const [x, y, tint] of [[-7.65, 11.05, plaster], [-6.75, 10.42, brass], [-5.9, 11, plaster]] as const)
    box(root, "notice-sheet", tint, [.58, .72, .045], [x, y, 7.55], [0, 0, x === -6.75 ? -7 : 4]);

  const maraFallback = new pc.Entity("mara-procedural-fallback");
  root.addChild(maraFallback);
  cylinder(maraFallback, "mara-body", rugRed, [.66, 1.25, .66], [-4.6, 9.28, -6]);
  shape(maraFallback, "mara-head", "sphere", brass, [.46, .46, .46], [-4.6, 10.62, -6]);

  loadProp(app, CHAIR_URL, root, [
    { position: [1.45, 8.02, -1.4], yaw: 90, scale: 1.2 },
    { position: [5.75, 8.02, -1.4], yaw: -90, scale: 1.2 },
    { position: [5.9, 8.02, 1.25], yaw: 0, scale: 1.2 },
    { position: [5.9, 8.02, 5.75], yaw: 180, scale: 1.2 },
    { position: [-7, 8.02, 3.3], yaw: 90, scale: 1.2 },
    { position: [-2.6, 8.02, 3.3], yaw: -90, scale: 1.2 },
  ]);
  loadProp(app, BARRELS_URL, root, [
    { position: [-8.25, 8.02, -6.45], yaw: 20, scale: 1.45 },
    { position: [-7.85, 8.02, 5.9], yaw: -15, scale: 1.35 },
  ]);
  loadProp(app, CRATES_URL, root, [{ position: [-7.6, 8.02, 4.8], yaw: 12, scale: 1.25 }]);
  loadProp(app, TORCH_URL, root, [
    { position: [-9.25, 10.2, -4.2], yaw: 90, scale: 1.25 },
    { position: [9.25, 10.2, -4.2], yaw: -90, scale: 1.25 },
  ]);
  loadProp(app, RED_BANNER_URL, root, [{ position: [-2.5, 11.9, -7.75], yaw: 0, scale: 1.35 }]);
  loadProp(app, BLUE_BANNER_URL, root, [{ position: [2.2, 11.9, -7.75], yaw: 0, scale: 1.35 }]);
  loadTavernPeople(app, root, maraFallback);

  const coolFill = new pc.Entity("tavern-cool-fill");
  coolFill.addComponent("light", { type: "omni", color: new pc.Color(.34, .48, .58), intensity: .48, range: 32, castShadows: false });
  coolFill.setLocalPosition(0, 12.8, 2.5);
  root.addChild(coolFill);
  for (const [x, z] of [[-4.5, 1.5], [4.5, 4.5]] as const) {
    const light = new pc.Entity("tavern-candle-cluster-light");
    light.addComponent("light", { type: "omni", color: new pc.Color(1, .64, .3), intensity: .75, range: 8, castShadows: false });
    light.setLocalPosition(x, 11.3, z);
    root.addChild(light);
    cylinder(root, "chandelier-stem", iron, [.08, 1.25, .08], [x, 12.45, z]);
    cylinder(root, "chandelier-ring", brass, [1.15, .09, 1.15], [x, 11.3, z]);
  }

  let elapsed = 0;
  app.on("update", (dt: number) => {
    if (!root.enabled) return;
    elapsed += dt;
    const flicker = Math.sin(elapsed * 9.7) * .08 + Math.sin(elapsed * 17.3) * .045;
    if (hearthLight.light) hearthLight.light.intensity = 3.05 + flicker * 2.2;
    flames.forEach((flame, index) => flame.setLocalScale(.48 + index % 2 * .12,
      1.15 + (index === 1 ? .45 : 0) + Math.sin(elapsed * (7 + index)) * .12, .48));
  });
  return root;
}
