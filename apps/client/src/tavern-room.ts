import * as pc from "playcanvas";
import type { TavernMealId } from "@blockcraft/protocol";
import { addCallingParticleLayers } from "./calling-particles.js";
import { bindTownNpcRig, loadTownNpcAssets, TOWN_NPC_MODEL_YAW, transitionTownNpcRig } from "./town-npc-assets.js";
import { tavernPatronSchedule, type TavernPatronPhase } from "./tavern-patron-schedule.js";

const DUNGEON_ASSET_ROOT = "/assets/kaykit-dungeon";
const TORCH_URL = `${DUNGEON_ASSET_ROOT}/torch_lit.gltf.glb`;
const TROPHY_LOCKED_URL = `${DUNGEON_ASSET_ROOT}/sword_shield_broken.gltf.glb`;
const TROPHY_VICTORY_URL = `${DUNGEON_ASSET_ROOT}/sword_shield_gold.gltf.glb`;
const CHEST_URL = `${DUNGEON_ASSET_ROOT}/chest.glb`;
const VICTORY_BANNER_URL = `${DUNGEON_ASSET_ROOT}/banner_triple_yellow.gltf.glb`;
const FANTASY_PROP_ROOT = "/assets/quaternius-fantasy-props";
const propUrl = (name: string): string => `${FANTASY_PROP_ROOT}/${name}.gltf`;
const CHAIR_URL = propUrl("Chair_1");
const TABLE_URL = propUrl("Table_Large");
const STOOL_URL = propUrl("Stool");
const BENCH_URL = propUrl("Bench");
const BAR_URL = propUrl("Workbench");
const SHELF_BOTTLES_URL = propUrl("Shelf_Small_Bottles");
const BOOKCASE_URL = propUrl("Bookcase_2");
const CABINET_URL = propUrl("Cabinet");
const MUG_URL = propUrl("Mug");
const PLATE_URL = propUrl("Table_Plate");
const CANDLE_URL = propUrl("CandleStick_Triple");
const BARREL_URL = propUrl("Barrel");
const CRATE_URL = propUrl("Crate_Wooden");
const BUCKET_URL = propUrl("Bucket_Wooden_1");

export const TAVERN_ROOM_ZONES = {
  entrance: { x: 0, z: 5.6, radius: 2.2 },
  bar: { x: -7.2, z: -1.5, radius: 3.2 },
  hearth: { x: 3.8, z: -6.2, radius: 3.1 },
  dining: { x: 4.6, z: 2.8, radius: 3.4 },
  guestRoom: { x: 0, z: -3.4, y: 15, radius: 6.2 },
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
  placements: { position: [number, number, number]; yaw?: number;
    scale?: number | [number, number, number] }[]): void {
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
      if (Array.isArray(scale)) entity.setLocalScale(...scale);
      else entity.setLocalScale(scale, scale, scale);
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

interface TavernSeatRig {
  upperLeft: pc.GraphNode;
  upperRight: pc.GraphNode;
  lowerLeft: pc.GraphNode;
  lowerRight: pc.GraphNode;
}
interface TavernPersonMotion {
  entity: pc.Entity;
  route: readonly [number, number, number][];
  seat: readonly [number, number, number];
  seatYaw: number;
  scheduleOffset: number;
  phase: TavernPatronPhase | null;
  nextGesture: number;
  gestureEnds: number;
  seatRig?: TavernSeatRig;
}

function tavernSeatRig(entity: pc.Entity): TavernSeatRig | undefined {
  const upperLeft = entity.findByName("upperleg.l"), upperRight = entity.findByName("upperleg.r");
  const lowerLeft = entity.findByName("lowerleg.l"), lowerRight = entity.findByName("lowerleg.r");
  return upperLeft && upperRight && lowerLeft && lowerRight ? { upperLeft, upperRight, lowerLeft, lowerRight } : undefined;
}

/** KayKit does not include a seated clip. Apply a compact chair pose after the
 * animation system updates so hips stay on the seat and shins hang in front. */
function applyTavernSeatPose(rig: TavernSeatRig): void {
  rig.upperLeft.setLocalEulerAngles(91, 0, -4);
  rig.upperRight.setLocalEulerAngles(91, 0, 4);
  rig.lowerLeft.setLocalEulerAngles(88, 0, 1);
  rig.lowerRight.setLocalEulerAngles(88, 0, -1);
}

function routePosition(route: readonly [number, number, number][], progress: number): pc.Vec3 {
  const lengths = route.slice(1).map((point, index) => Math.hypot(
    point[0] - route[index]![0], point[1] - route[index]![1], point[2] - route[index]![2]));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let distance = Math.max(0, Math.min(1, progress)) * total;
  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index]!;
    if (distance <= length || index === lengths.length - 1) {
      const start = route[index]!, end = route[index + 1]!;
      const amount = length <= 0 ? 1 : Math.max(0, Math.min(1, distance / length));
      return new pc.Vec3(start[0] + (end[0] - start[0]) * amount,
        start[1] + (end[1] - start[1]) * amount,
        start[2] + (end[2] - start[2]) * amount);
    }
    distance -= length;
  }
  return new pc.Vec3(...route[route.length - 1]!);
}

function faceRoute(entity: pc.Entity, from: pc.Vec3, to: pc.Vec3): void {
  const dx = to.x - from.x, dz = to.z - from.z;
  if (Math.hypot(dx, dz) > .001) entity.setLocalEulerAngles(0, TOWN_NPC_MODEL_YAW + Math.atan2(dx, dz) * 180 / Math.PI, 0);
}

function loadTavernPeople(app: pc.Application, root: pc.Entity, proceduralMara: pc.Entity,
  movingPeople: TavernPersonMotion[]): void {
  void loadTownNpcAssets(app).then(result => {
    const placements = [
      { role: "vendor" as const, position: [-8.2, 8.02, -1.5] as [number, number, number], yaw: 90, phase: .2, seated: false },
      { role: "resident" as const, position: [4.72, 8.31, 2.22] as [number, number, number], yaw: 0, phase: .8, seated: true,
        scheduleOffset: 25, route: [[0, 8.02, 7.55], [2.1, 8.02, 6.1], [3.7, 8.02, 4.2], [4.72, 8.31, 2.22]] as [number, number, number][] },
      { role: "resident" as const, position: [6.42, 8.31, 4.42] as [number, number, number], yaw: 180, phase: .45, seated: true,
        scheduleOffset: 40, route: [[0, 8.02, 7.55], [2.5, 8.02, 6.35], [5.1, 8.02, 5.55], [6.42, 8.31, 4.42]] as [number, number, number][] },
      { role: "healer" as const, position: [.95, 8.31, -4.88] as [number, number, number], yaw: 90, phase: .65, seated: true,
        scheduleOffset: 7, route: [[0, 8.02, 7.55], [-2.2, 8.02, 5.4], [-3.1, 8.02, -.7], [-1.1, 8.02, -4.85], [.95, 8.31, -4.88]] as [number, number, number][] },
    ];
    for (const [index, placement] of placements.entries()) {
      const asset = result.loaded.get(placement.role);
      const resource = asset?.resource as (pc.ContainerResource & { animations: pc.Asset[] }) | undefined;
      if (!resource) continue;
      const model = resource.instantiateRenderEntity({ castShadows: true, receiveShadows: true });
      model.name = index === 0 ? "mara-innkeeper" : `tavern-patron-${index}`;
      model.setLocalPosition(...placement.position);
      model.setLocalEulerAngles(0, TOWN_NPC_MODEL_YAW + placement.yaw, 0);
      model.setLocalScale(placement.seated ? .8 : .86, placement.seated ? .8 : .86, placement.seated ? .8 : .86);
      root.addChild(model);
      if (!bindTownNpcRig(model, resource.animations, "Idle", placement.phase)) {
        model.destroy();
        continue;
      }
      const seatRig = placement.seated ? tavernSeatRig(model) : undefined;
      const route = "route" in placement ? placement.route : undefined;
      const scheduleOffset = "scheduleOffset" in placement ? placement.scheduleOffset : undefined;
      if (seatRig && route && scheduleOffset !== undefined) {
        model.enabled = false;
        movingPeople.push({ entity: model, route, seat: placement.position,
          seatYaw: placement.yaw, scheduleOffset, phase: null,
          nextGesture: 0, gestureEnds: 0, seatRig });
      }
      if (index === 0) proceduralMara.enabled = false;
    }
  });
}

/** A composed, asset-backed RPG interior for the dedicated Hearth & Hammer room. */
export function createTavernRoom(app: pc.Application): pc.Entity {
  const root = new pc.Entity("hearth-and-hammer-room");
  app.root.addChild(root);
  const upperRoomShell = new pc.Entity("tavern-upper-room-shell");
  root.addChild(upperRoomShell);
  const lowerRoomShell = new pc.Entity("tavern-lower-room-shell");
  root.addChild(lowerRoomShell);
  const lowerRoomRoof = new pc.Entity("tavern-lower-room-roof");
  root.addChild(lowerRoomRoof);

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
  const cardIvory = material(new pc.Color(.92, .84, .66), undefined, .28);
  const cardRed = material(new pc.Color(.58, .045, .035), undefined, .2);
  const cardBlack = material(new pc.Color(.045, .04, .038), undefined, .2);
  const broth = material(new pc.Color(.38, .12, .025), new pc.Color(.08, .015, .004), .2);
  const tea = material(new pc.Color(.38, .25, .055), new pc.Color(.04, .025, .005), .28);
  const pastry = material(new pc.Color(.72, .38, .09), undefined, .18);
  const vegetable = material(new pc.Color(.12, .42, .08), undefined, .12);

  box(root, "timber-floor", oakLight, [19.5, .22, 16.5], [0, 7.88, 0]);
  for (let x = -9; x <= 9; x += 1.5)
    box(root, "floor-board-seam", oak, [.028, .028, 16.1], [x, 8.012, 0]);
  for (const [name, scale, position] of [
    ["back-wall", [19.5, 6.1, .35], [0, 11, -8.15]],
    ["left-wall", [.35, 6.1, 16.5], [-9.65, 11, 0]],
    ["right-wall", [.35, 6.1, 16.5], [9.65, 11, 0]],
    ["front-wall-left", [8.25, 6.1, .35], [-5.55, 11, 8.15]],
    ["front-wall-right", [8.25, 6.1, .35], [5.55, 11, 8.15]],
  ] as const) box(lowerRoomShell, name, plaster, scale, position);
  for (const [scale, position] of [
    [[19.15, 1.05, .45], [0, 8.52, -7.93]], [[19.15, 1.05, .45], [0, 8.52, 7.93]],
    [[.45, 1.05, 15.7], [-9.43, 8.52, 0]], [[.45, 1.05, 15.7], [9.43, 8.52, 0]],
  ] as const) box(lowerRoomShell, "stone-wainscot", stone, scale, position);
  addWallTimbers(lowerRoomShell, oak);
  // Frame the upper floor around a genuine stairwell. A single full slab made
  // the staircase visibly terminate in a ceiling even though travel worked.
  box(lowerRoomRoof, "upper-floor-main", oak, [14.15, .3, 16.5], [-2.675, 14.85, 0]);
  box(lowerRoomRoof, "upper-floor-east-rear", oak, [5.35, .3, 8.35], [7.075, 14.85, -4.075]);
  box(lowerRoomRoof, "upper-floor-east-front", oak, [5.35, .3, 1], [7.075, 14.85, 7.75]);
  box(lowerRoomRoof, "ceiling-rafter", oakLight, [19.75, .42, .46], [0, 13.72, -5.2]);
  // The rafters beside the staircase stop at the well instead of forming a
  // waist-high bar across the player's view at the top step.
  for (const z of [0, 5.2])
    box(lowerRoomRoof, "ceiling-rafter-trimmed", oakLight, [14.05, .42, .46], [-2.7, 13.72, z]);

  // The inn's upper floor is a real guest suite, reached from the stair landing.
  // It deliberately uses the same footprint as the common room so the building
  // reads as a coherent two-storey structure instead of a disconnected menu.
  for (const [name, scale, position] of [
    ["upper-back-wall", [19.5, 5.8, .35], [0, 17.25, -8.15]],
    ["upper-left-wall", [.35, 5.8, 16.5], [-9.65, 17.25, 0]],
    ["upper-right-wall", [.35, 5.8, 16.5], [9.65, 17.25, 0]],
    ["upper-front-wall", [19.5, 5.8, .35], [0, 17.25, 8.15]],
  ] as const) box(upperRoomShell, name, plaster, scale, position);
  box(upperRoomShell, "upper-ceiling", oak, [19.5, .35, 16.5], [0, 20.2, 0]);
  for (const z of [-7.7, 0, 7.7])
    box(upperRoomShell, "upper-wall-beam", oak, [19.2, .34, .34], [0, 19.45, z]);
  for (const x of [-9.25, 0, 9.25])
    box(upperRoomShell, "upper-wall-post", oak, [.42, 5.35, .42], [x, 17.15, -7.72]);
  box(upperRoomShell, "guest-partition-west", oak, [8.05, 4.5, .3], [-5.48, 17.25, 2.9]);
  // The east partition ends before the stairwell so the landing has a clear
  // route into the guest room instead of opening into a wall.
  box(upperRoomShell, "guest-partition-east", oak, [2.8, 4.5, .3], [2.85, 17.25, 2.9]);
  box(upperRoomShell, "guest-door-lintel", oakLight, [2.9, .42, .46], [0, 19.2, 2.9]);
  box(root, "upper-hall-runner", rugGreen, [11.2, .04, 3.15], [-3.3, 15.02, 5.2]);
  box(root, "stairwell-frame-left", oakLight, [.28, .42, 7.2], [4.38, 15.02, 3.7]);
  box(root, "stairwell-frame-rear", oakLight, [5.25, .42, .28], [7.02, 15.02, .18]);
  box(root, "stairwell-frame-front", oakLight, [5.25, .42, .28], [7.02, 15.02, 7.22]);
  for (const z of [.45, 2.7, 4.95, 7.05])
    box(root, "stairwell-rail-post", oakLight, [.18, 1.65, .18], [4.48, 15.84, z]);
  box(root, "stairwell-handrail", oakLight, [.22, .22, 7.1], [4.48, 16.66, 3.7]);
  box(root, "guest-room-rug", rugRed, [7.7, .04, 6.9], [0, 15.02, -3.65]);

  // A substantial, readable bed: resting here also binds the inn return point.
  box(root, "guest-bed-frame", oak, [3.15, .55, 4.15], [0, 15.28, -4.55]);
  box(root, "guest-bed-mattress", plaster, [2.82, .48, 3.75], [0, 15.71, -4.42]);
  box(root, "guest-bed-blanket", rugGreen, [2.86, .18, 2.28], [0, 16.01, -3.85]);
  for (const x of [-.72, .72]) shape(root, "guest-pillow", "sphere", cardIvory, [.65, .22, .48], [x, 16.01, -5.72]);
  for (const x of [-1.38, 1.38]) for (const z of [-6.28, -2.83])
    cylinder(root, "guest-bed-post", oakLight, [.12, .8, .12], [x, 15.4, z]);

  // Five trophy bays make future floors tangible even while still locked.
  for (let index = 0; index < 5; index++) {
    const x = -5.6 + index * 2.8;
    box(upperRoomShell, `inn-trophy-plaque-${index + 1}`, stone, [2.15, 2.2, .24], [x, 17.55, -7.72]);
    const locked = new pc.Entity(`inn-trophy-floor-${index + 1}-locked`);
    locked.setLocalPosition(x, 17.55, -7.42); upperRoomShell.addChild(locked);
    const victory = new pc.Entity(`inn-trophy-floor-${index + 1}-victory`);
    victory.setLocalPosition(x, 17.55, -7.42); victory.enabled = false; upperRoomShell.addChild(victory);
    loadProp(app, TROPHY_LOCKED_URL, locked, [{ position: [0, 0, 0], yaw: 0, scale: .78 }]);
    loadProp(app, TROPHY_VICTORY_URL, victory, [{ position: [0, 0, 0], yaw: 0, scale: .78 }]);
  }
  const innBanner = new pc.Entity("inn-victory-banner"); innBanner.enabled = false; upperRoomShell.addChild(innBanner);
  loadProp(app, VICTORY_BANNER_URL, innBanner, [{ position: [0, 18.85, -7.46], yaw: 0, scale: 1.15 }]);
  // Render the same seven one-metre steps used by authoritative collision.
  // The previous imported mesh reported bounds that did not match its visible
  // treads, leaving its top several metres below the real upper floor.
  for (let step = 0; step < 7; step++) {
    const z = 6.5 - step;
    const height = step + 1;
    const top = 8 + height;
    box(root, `guest-stair-riser-${step + 1}`, oak, [4.8, height, .96], [7.02, 8 + height / 2, z]);
    box(root, `guest-stair-tread-${step + 1}`, oakLight, [5.02, .12, 1.08], [7.02, top + .02, z]);
    if (step % 2 === 0 || step === 6) for (const x of [4.5, 9.54])
      box(root, "guest-stair-rail-post", oakLight, [.16, 1.15, .16], [x, top + .57, z]);
  }
  for (const x of [4.5, 9.54])
    box(root, "guest-stair-sloped-rail", oakLight, [.2, .2, 8.48], [x, 12.5, 3.5], [45, 0, 0]);
  loadProp(app, CHEST_URL, root, [{ position: [-6.25, 15, -4.85], yaw: 90, scale: 1.3 }]);
  loadProp(app, CABINET_URL, root, [{ position: [6.35, 15, -6.55], yaw: 0, scale: 1.25 }]);
  loadProp(app, BOOKCASE_URL, root, [{ position: [7.6, 15, -.5], yaw: 0, scale: 1.08 }]);
  loadProp(app, CANDLE_URL, root, [
    { position: [-3.15, 15.7, -5.6], yaw: 0, scale: 1.05 },
    { position: [3.15, 15.7, -5.6], yaw: 0, scale: 1.05 },
  ]);
  const guestLight = new pc.Entity("guest-room-light");
  guestLight.addComponent("light", { type: "omni", color: new pc.Color(1, .62, .3), intensity: .82, range: 13, castShadows: false });
  guestLight.setLocalPosition(0, 18.4, -2.5); root.addChild(guestLight);

  addWindow(lowerRoomShell, "west-window-a", -9.42, -1.7, 0, oak, stoneLight, daylight);
  addWindow(lowerRoomShell, "west-window-b", -9.42, 3.8, 0, oak, stoneLight, daylight);
  addWindow(lowerRoomShell, "east-window", 9.42, -1.8, 180, oak, stoneLight, daylight);
  box(lowerRoomShell, "entrance-lintel", stoneLight, [3.45, .5, .55], [0, 12.7, 7.82]);
  box(lowerRoomShell, "entrance-frame-left", stone, [.52, 4.5, .65], [-1.65, 10.08, 7.82]);
  box(lowerRoomShell, "entrance-frame-right", stone, [.52, 4.5, .65], [1.65, 10.08, 7.82]);
  box(root, "entrance-runner", rugGreen, [3.2, .035, 5.2], [0, 8.02, 5.25]);

  // Mara serves the local player's prepared meal on the counter. Each dish has
  // a distinct silhouette so the selected one reads without relying on UI.
  const mealService = new pc.Entity("tavern-prepared-meal");
  mealService.setLocalPosition(-6.72, 9.22, -1.5); mealService.enabled = false; root.addChild(mealService);
  cylinder(mealService, "meal-serving-plate", cardIvory, [.7, .045, .7], [0, 0, 0]);
  const addMealRoot = (id: TavernMealId): pc.Entity => {
    const entity = new pc.Entity(`tavern-meal-${id}`); entity.enabled = false;
    mealService.addChild(entity); return entity;
  };
  const stew = addMealRoot("hearty_stew");
  cylinder(stew, "stew-bowl", stoneLight, [.52, .22, .52], [0, .2, 0]);
  cylinder(stew, "stew-broth", broth, [.43, .035, .43], [0, .42, 0]);
  for (const [x, z, tint] of [[-.2, -.08, pastry], [.12, -.14, vegetable], [.18, .16, pastry], [-.12, .18, vegetable]] as const)
    shape(stew, "stew-piece", "sphere", tint, [.1, .055, .1], [x, .47, z]);
  const runnersTea = addMealRoot("runners_tea");
  cylinder(runnersTea, "tea-cup", cardIvory, [.31, .34, .31], [0, .27, 0]);
  cylinder(runnersTea, "tea-surface", tea, [.245, .025, .245], [0, .61, 0]);
  box(runnersTea, "tea-handle", cardIvory, [.12, .22, .08], [.34, .31, 0]);
  const fortunePie = addMealRoot("fortune_pie");
  cylinder(fortunePie, "pie-crust", pastry, [.55, .17, .55], [0, .18, 0]);
  cylinder(fortunePie, "pie-top", brass, [.49, .035, .49], [0, .37, 0]);
  for (const angle of [-45, 45]) box(fortunePie, "pie-lattice", pastry, [.82, .045, .08], [0, .42, 0], [0, angle, 0]);
  const mealSteam = new pc.Entity("tavern-meal-steam"); mealSteam.setLocalPosition(0, .55, 0); mealService.addChild(mealSteam);
  addCallingParticleLayers(app, mealSteam, [
    { kind: "smoke", texture: "smoke", count: 5, life: 2.2, radius: .18, speed: .025,
      rise: .42, size: .2, color: [.84, .82, .74], opacity: .18 },
  ], true, .42);

  // The asset-backed west-wall bar leaves the entrance-to-hearth axis open.
  box(lowerRoomShell, "bar-menu-board", iron, [.16, 1.5, 2.2], [-9.26, 12.05, -1.4]);
  for (let line = 0; line < 4; line++)
    box(lowerRoomShell, "bar-menu-line", brass, [.035, .045, 1.35 - line * .1], [-9.15, 12.42 - line * .28, -1.4]);

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
  const trophyLocked = new pc.Entity("tavern-trophy-locked");
  trophyLocked.setLocalPosition(hearthX, 12.05, -6.72); root.addChild(trophyLocked);
  const trophyVictory = new pc.Entity("tavern-trophy-victory");
  trophyVictory.setLocalPosition(hearthX, 12.05, -6.72); trophyVictory.enabled = false; root.addChild(trophyVictory);
  loadProp(app, TROPHY_LOCKED_URL, trophyLocked, [{ position: [0, 0, 0], yaw: 0, scale: 1.15 }]);
  loadProp(app, TROPHY_VICTORY_URL, trophyVictory, [{ position: [0, 0, 0], yaw: 0, scale: 1.15 }]);
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
  box(root, "quiz-rug", rugGreen, [4.35, .038, 3.55], [0, 8.022, 1.35]);
  box(root, "dining-rug", rugGreen, [4.5, .038, 3.8], [5.6, 8.022, 3.35]);

  box(lowerRoomShell, "notice-board", oak, [3.4, 2.25, .18], [-6.8, 10.55, 7.68]);
  for (const [x, y, tint] of [[-7.65, 11.05, plaster], [-6.75, 10.42, brass], [-5.9, 11, plaster]] as const)
    box(lowerRoomShell, "notice-sheet", tint, [.58, .72, .045], [x, y, 7.55], [0, 0, x === -6.75 ? -7 : 4]);

  const maraFallback = new pc.Entity("mara-procedural-fallback");
  root.addChild(maraFallback);
  cylinder(maraFallback, "mara-body", rugRed, [.66, 1.25, .66], [-8.2, 9.28, -1.5]);
  shape(maraFallback, "mara-head", "sphere", brass, [.46, .46, .46], [-8.2, 10.62, -1.5]);

  loadProp(app, BAR_URL, root, [-3.75, -1.25, 1.25].map(z =>
    ({ position: [-7.25, 8.02, z] as [number, number, number], yaw: 90, scale: 1.2 })));
  loadProp(app, STOOL_URL, root, [-3.75, -1.25, 1.25].map(z =>
    ({ position: [-5.75, 8.02, z] as [number, number, number], yaw: 90, scale: 1.35 })));
  loadProp(app, SHELF_BOTTLES_URL, root, [-3.5, -1.2, 1.1].map(z =>
    ({ position: [-9.22, 10.25, z] as [number, number, number], yaw: 90, scale: 1.45 })));
  loadProp(app, BOOKCASE_URL, root, [{ position: [-9.1, 8.02, 5.75], yaw: 90, scale: 1.05 }]);
  loadProp(app, CABINET_URL, root, [{ position: [-9.12, 8.02, 3.95], yaw: 90, scale: 1.15 }]);
  loadProp(app, TABLE_URL, root, [
    { position: [0, 8.02, 1.35], yaw: 0, scale: 1.25 },
    { position: [5.6, 8.02, 3.35], yaw: 0, scale: 1.25 },
  ]);
  // The eastern dining table doubles as the Higher or Lower card table.
  box(root, "high-low-felt", rugRed, [2.75, .045, 1.55], [5.6, 9.075, 3.35]);
  box(root, "high-low-card-red", cardIvory, [.62, .035, .9], [5.22, 9.105, 3.32], [0, -14, 0]);
  box(root, "high-low-card-black", cardIvory, [.62, .035, .9], [5.96, 9.11, 3.34], [0, 12, 0]);
  box(root, "high-low-heart", cardRed, [.18, .045, .18], [5.22, 9.145, 3.32], [0, -14, 0]);
  box(root, "high-low-spade", cardBlack, [.18, .045, .18], [5.96, 9.15, 3.34], [0, 12, 0]);
  loadProp(app, CHAIR_URL, root, [
    { position: [-.85, 8.02, .25], yaw: 0, scale: 1.05 },
    { position: [.85, 8.02, 2.45], yaw: 180, scale: 1.05 },
    { position: [4.75, 8.02, 2.25], yaw: 0, scale: 1.05 },
    { position: [6.45, 8.02, 4.45], yaw: 180, scale: 1.05 },
  ]);
  loadProp(app, BENCH_URL, root, [
    { position: [.95, 8.02, -4.9], yaw: 90, scale: 1.02 },
    { position: [6.65, 8.02, -4.9], yaw: 90, scale: 1.02 },
  ]);
  loadProp(app, MUG_URL, root, [
    { position: [-6.82, 9.15, -3.75], yaw: 15, scale: 1.35 },
    { position: [-6.82, 9.15, -1.25], yaw: -20, scale: 1.35 },
    { position: [-6.82, 9.15, 1.25], yaw: 8, scale: 1.35 },
    { position: [-.55, 9.08, 1.3], yaw: -15, scale: 1.25 },
  ]);
  loadProp(app, PLATE_URL, root, [
    { position: [.55, 9.07, 1.35], yaw: 0, scale: 1.25 },
  ]);
  loadProp(app, CANDLE_URL, root, [
    { position: [0, 9.07, 1.35], yaw: 0, scale: 1.05 },
  ]);
  loadProp(app, BARREL_URL, root, [
    { position: [-8.35, 8.02, -6.35], yaw: 20, scale: 1.05 },
    { position: [8.5, 8.02, 5.9], yaw: -15, scale: .95 },
  ]);
  loadProp(app, CRATE_URL, root, [{ position: [-8.25, 8.02, 6.4], yaw: 12, scale: 1.05 }]);
  loadProp(app, BUCKET_URL, root, [{ position: [7.95, 8.02, -6.6], yaw: -18, scale: 1.1 }]);
  loadProp(app, TORCH_URL, lowerRoomShell, [
    { position: [-9.25, 10.2, -4.2], yaw: 90, scale: 1.25 },
    { position: [9.25, 10.2, -4.2], yaw: -90, scale: 1.25 },
  ]);
  const movingPeople: TavernPersonMotion[] = [];
  loadTavernPeople(app, root, maraFallback, movingPeople);

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
    for (const person of movingPeople) {
      const schedule = tavernPatronSchedule(elapsed, person.scheduleOffset);
      if (schedule.phase === "away") {
        person.entity.enabled = false;
        person.phase = schedule.phase;
        person.gestureEnds = 0;
        continue;
      }
      person.entity.enabled = true;
      const walking = schedule.phase === "entering" || schedule.phase === "leaving";
      if (person.phase !== schedule.phase) {
        transitionTownNpcRig(person.entity, walking ? "Walking_A" : "Idle", .22);
        person.phase = schedule.phase;
        person.gestureEnds = 0;
        person.nextGesture = elapsed + (schedule.phase === "settling" ? 1.2 : .55);
      }
      if (walking) {
        const routeProgress = schedule.phase === "entering" ? schedule.progress : 1 - schedule.progress;
        const position = routePosition(person.route, routeProgress);
        const aheadProgress = schedule.phase === "entering"
          ? Math.min(1, routeProgress + .015) : Math.max(0, routeProgress - .015);
        const ahead = routePosition(person.route, aheadProgress);
        person.entity.setLocalPosition(position);
        faceRoute(person.entity, position, ahead);
        continue;
      }
      person.entity.setLocalPosition(...person.seat);
      person.entity.setLocalEulerAngles(0, TOWN_NPC_MODEL_YAW + person.seatYaw, 0);
      if (person.gestureEnds > 0 && elapsed >= person.gestureEnds) {
        transitionTownNpcRig(person.entity, "Idle", .2);
        person.gestureEnds = 0;
      } else if ((schedule.phase === "eating" || schedule.phase === "talking")
        && person.gestureEnds === 0 && elapsed >= person.nextGesture) {
        if (transitionTownNpcRig(person.entity, "Interact", .18)) person.gestureEnds = elapsed + 1.5;
        person.nextGesture = elapsed + (schedule.phase === "eating" ? 3.2 : 4.4);
      }
      if (person.seatRig) applyTavernSeatPose(person.seatRig);
    }
  });
  return root;
}

export function setTavernPreparedMeal(root: pc.Entity | null, mealId: TavernMealId | null,
  state: "prepared" | "active" | null): void {
  const service = root?.findByName("tavern-prepared-meal");
  if (!service) return;
  const visible = state === "prepared" && mealId !== null;
  service.enabled = visible;
  for (const id of ["hearty_stew", "runners_tea", "fortune_pie"] as const) {
    const dish = service.findByName(`tavern-meal-${id}`);
    if (dish) dish.enabled = visible && id === mealId;
  }
}

/** Opens the active storey as a clean third-person dollhouse. Collision remains
 * authoritative: this only hides the camera-blocking roof and upper shell. */
export function setTavernThirdPersonCutaway(root: pc.Entity | null, active: boolean, upstairs: boolean): void {
  const upperShell = root?.findByName("tavern-upper-room-shell");
  const lowerShell = root?.findByName("tavern-lower-room-shell");
  const lowerRoof = root?.findByName("tavern-lower-room-roof");
  if (upperShell) upperShell.enabled = !active;
  if (lowerShell) lowerShell.enabled = !active || upstairs;
  if (lowerRoof) lowerRoof.enabled = !active || upstairs;
}

export function setTavernTrophyProgress(root: pc.Entity | null, highestFloorCleared: number): void {
  const locked = root?.findByName("tavern-trophy-locked");
  const victory = root?.findByName("tavern-trophy-victory");
  if (locked) locked.enabled = highestFloorCleared < 1;
  if (victory) victory.enabled = highestFloorCleared >= 1;
  for (let floor = 1; floor <= 5; floor++) {
    const roomLocked = root?.findByName(`inn-trophy-floor-${floor}-locked`);
    const roomVictory = root?.findByName(`inn-trophy-floor-${floor}-victory`);
    if (roomLocked) roomLocked.enabled = highestFloorCleared < floor;
    if (roomVictory) roomVictory.enabled = highestFloorCleared >= floor;
  }
  const banner = root?.findByName("inn-victory-banner");
  if (banner) banner.enabled = highestFloorCleared >= 1;
}
