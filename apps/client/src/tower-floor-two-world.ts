import * as pc from "playcanvas";
import { TOWER_FLOOR_TWO, TOWER_FLOOR_TWO_COLLIDERS, TOWER_FLOOR_TWO_ROOMS,
  TOWER_FLOOR_TWO_ROUTES, TOWER_FLOOR_TWO_VENTS, towerFloorTwoGroundHeight,
  towerFloorTwoVentPhase } from "@blockcraft/protocol";
import { createPaintedGroundMaterial } from "./fast-world-texture.js";

function finish(colour: pc.Color, emissive = 0, opacity = 1): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = colour;
  material.emissive = colour.clone().mulScalar(emissive);
  material.metalness = emissive ? .18 : .08;
  material.gloss = emissive ? .48 : .18;
  material.opacity = opacity;
  if (opacity < 1) { material.blendType = pc.BLEND_NORMAL; material.depthWrite = false; }
  material.update();
  return material;
}

function shape(parent: pc.Entity, name: string, type: "box" | "cylinder" | "cone" | "sphere",
  material: pc.Material, scale: [number, number, number], position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0], castShadows = false): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent("render", { type, castShadows, receiveShadows: true });
  if (entity.render) entity.render.material = material;
  entity.setLocalScale(...scale);
  entity.setLocalPosition(...position);
  entity.setLocalEulerAngles(...rotation);
  parent.addChild(entity);
  return entity;
}

function routeSlab(parent: pc.Entity, route: (typeof TOWER_FLOOR_TWO_ROUTES)[number],
  floor: pc.Material, edge: pc.Material): void {
  const [ax, az] = route.from, [bx, bz] = route.to;
  const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz);
  const yaw = -Math.atan2(dz, dx) * 180 / Math.PI;
  // Short sections follow the same sampled height field used by movement.
  // A single average-height slab visibly floated at one end and sank at the
  // other whenever a route climbed onto a regulator or boss terrace.
  const sectionCount = Math.max(1, Math.ceil(length / 2.5));
  const sectionLength = length / sectionCount;
  for (let index = 0; index < sectionCount; index++) {
    const t = (index + .5) / sectionCount;
    const x = ax + dx * t, z = az + dz * t;
    const y = towerFloorTwoGroundHeight(x, z);
    shape(parent, `floor2-route-edge:${route.id}:${index}`, "box", edge,
      [sectionLength + .12, .42, route.width + .8], [x, y - .18, z], [0, yaw, 0]);
    shape(parent, `floor2-route:${route.id}:${index}`, "box", floor,
      [sectionLength + .16, .12, route.width], [x, y + .03, z], [0, yaw, 0]);
  }
}

function arch(parent: pc.Entity, name: string, x: number, z: number, yaw: number,
  width: number, height: number, stone: pc.Material, hotIron: pc.Material): void {
  const y = towerFloorTwoGroundHeight(x, z);
  const radians = yaw * Math.PI / 180;
  const sideX = Math.cos(radians) * width * .5;
  const sideZ = -Math.sin(radians) * width * .5;
  for (const side of [-1, 1])
    shape(parent, `${name}:pier`, "box", stone, [1.1, height, 1.3],
      [x + sideX * side, y + height * .5, z + sideZ * side], [0, yaw, 0], true);
  shape(parent, `${name}:lintel`, "box", hotIron, [width + 2, 1.1, 1.45],
    [x, y + height - .5, z], [0, yaw, 0], true);
}

/** Navigation-first representation of the Emberworks. Deliberately limited
 * to structural masses and landmarks until traversal and collision pass. */
export function createTowerFloorTwoWorld(app: pc.Application, parent: pc.Entity): pc.Entity {
  const root = new pc.Entity("tower-floor-2-world");
  parent.addChild(root);

  const floor = createPaintedGroundMaterial(app, { name: "floor2-forge-floor", base: "#34383b",
    mottles: ["#454b4e", "#25292b", "#5a4a39"], litter: ["#191b1c", "#7a4b28"], seed: 921,
    roughness: .9, pattern: "stone" }, [2.6, 2.6]);
  const darkStone = createPaintedGroundMaterial(app, { name: "floor2-forge-wall", base: "#25282b",
    mottles: ["#33383b", "#17191b", "#49382d"], litter: ["#60676a", "#140d09"], seed: 922,
    roughness: .94, pattern: "stone" }, [2.2, 2.2]);
  const iron = finish(new pc.Color(.16, .18, .19));
  const hotIron = finish(new pc.Color(.52, .18, .045), .22);
  const ember = finish(new pc.Color(1, .22, .025), .95, .88);
  const coolant = finish(new pc.Color(.06, .62, .86), .65, .78);
  const brass = finish(new pc.Color(.58, .38, .1), .12);
  const voidMaterial = finish(new pc.Color(.004, .006, .009));

  const centreX = (TOWER_FLOOR_TWO.bounds.minX + TOWER_FLOOR_TWO.bounds.maxX) * .5;
  const centreZ = (TOWER_FLOOR_TWO.bounds.minZ + TOWER_FLOOR_TWO.bounds.maxZ) * .5;
  shape(root, "floor2-abyss", "box", voidMaterial, [150, 4, 146], [centreX, 1.8, centreZ]);
  shape(root, "floor2-foundation", "box", darkStone, [132, 1.2, 128], [centreX, 7.35, centreZ]);

  for (const route of TOWER_FLOOR_TWO_ROUTES) routeSlab(root, route, floor, iron);

  for (const room of TOWER_FLOOR_TWO_ROOMS) {
    const y = towerFloorTwoGroundHeight(room.x, room.z);
    const roomFloor = room.kind === "boss" ? hotIron : room.kind === "regulator" ? iron : floor;
    shape(root, `floor2-room-rim:${room.id}`, "cylinder", iron,
      [room.radius * 2 + 1.2, .55, room.radius * 2 + 1.2], [room.x, y - .24, room.z]);
    shape(root, `floor2-room:${room.id}`, "cylinder", roomFloor,
      [room.radius * 2, .14, room.radius * 2], [room.x, y + .02, room.z]);
  }

  const ventWarning = finish(new pc.Color(1, .57, .06), .72, .78);
  for (const vent of TOWER_FLOOR_TWO_VENTS) {
    const y = towerFloorTwoGroundHeight(vent.x, vent.z);
    shape(root, `floor2-vent-grate:${vent.id}`, "cylinder", iron,
      [vent.radius * 1.6, .14, vent.radius * 1.6], [vent.x, y + .05, vent.z]);
    const warning = shape(root, `floor2-vent-warning:${vent.id}`, "cylinder", ventWarning,
      [vent.radius * 2.05, .05, vent.radius * 2.05], [vent.x, y + .12, vent.z]);
    warning.enabled = false;
    const activeMaterial = vent.group === "quench" ? coolant : ember;
    const jet = shape(root, `floor2-vent-jet:${vent.id}`, "cone", activeMaterial,
      [vent.radius * 1.35, 4.2, vent.radius * 1.35], [vent.x, y + 2.05, vent.z]);
    jet.enabled = false;
  }

  // Visible wall runs are generated from the same boxes used by authority.
  for (const wall of TOWER_FLOOR_TWO_COLLIDERS) {
    const width = wall.maxX - wall.minX, depth = wall.maxZ - wall.minZ, height = wall.maxY - wall.minY;
    shape(root, `floor2-wall:${wall.id}`, "box", darkStone, [width, height, depth],
      [(wall.minX + wall.maxX) * .5, wall.minY + height * .5, (wall.minZ + wall.maxZ) * .5], [0, 0, 0], true);
    shape(root, `floor2-wall-cap:${wall.id}`, "box", iron, [width + .3, .32, depth + .3],
      [(wall.minX + wall.maxX) * .5, wall.maxY + .14, (wall.minZ + wall.maxZ) * .5]);
  }

  // Entry framing keeps the arrival view clear while immediately showing the forge axis.
  arch(root, "floor2-pressure-door", 423, 106, 90, 7, 7, darkStone, hotIron);
  arch(root, "floor2-crucible-gate", TOWER_FLOOR_TWO.crucibleGate.x, TOWER_FLOOR_TWO.crucibleGate.z,
    90, 8, 9, darkStone, hotIron);
  const gateY = towerFloorTwoGroundHeight(TOWER_FLOOR_TWO.crucibleGate.x, TOWER_FLOOR_TWO.crucibleGate.z);
  shape(root, "floor2-crucible-sealed-signal", "box", ember, [5.8, .32, .4],
    [TOWER_FLOOR_TWO.crucibleGate.x, gateY + 7.15, TOWER_FLOOR_TWO.crucibleGate.z]);
  const openSignal = shape(root, "floor2-crucible-open-signal", "box", coolant, [5.8, .32, .4],
    [TOWER_FLOOR_TWO.crucibleGate.x, gateY + 7.15, TOWER_FLOOR_TWO.crucibleGate.z]);
  openSignal.enabled = false;
  arch(root, "floor2-furnace-breach", 500, 95, 0, 6, 6.5, darkStone, hotIron);
  arch(root, "floor2-quench-breach", 500, 117, 0, 6, 6.5, darkStone, coolant);
  arch(root, "floor2-ascent-frame", 538, 106, 90, 6, 7, darkStone, brass);

  // Hub turbine is a single unmistakable landmark visible from all three exits.
  const hubY = towerFloorTwoGroundHeight(458, 106);
  shape(root, "floor2-hub-turbine-base", "cylinder", iron, [8, 1, 8], [458, hubY + .45, 106]);
  shape(root, "floor2-hub-turbine", "cylinder", brass, [4.6, 8, 4.6], [458, hubY + 4.4, 106]);
  shape(root, "floor2-hub-core", "sphere", coolant, [2.4, 2.4, 2.4], [458, hubY + 4.5, 106]);
  for (let blade = 0; blade < 4; blade++)
    shape(root, "floor2-hub-blade", "box", iron, [.55, 5.8, 2.1], [458, hubY + 4.5, 106],
      [0, blade * 45, blade % 2 ? 38 : -38]);

  // The regulators read from the hub before detailed machinery is added.
  for (const [name, x, z, material] of [
    ["furnace", 480, 70, ember], ["quench", 480, 142, coolant],
  ] as const) {
    const y = towerFloorTwoGroundHeight(x, z);
    shape(root, `floor2-${name}-regulator-base`, "cylinder", iron, [7, 1.1, 7], [x, y + .5, z]);
    shape(root, `floor2-${name}-regulator-ring`, "cylinder", material, [5.4, .22, 5.4], [x, y + 1.12, z]);
    shape(root, `floor2-${name}-regulator-column`, "cylinder", brass, [2.1, 6, 2.1], [x, y + 3.4, z]);
    shape(root, `floor2-${name}-regulator-core`, "sphere", material, [1.45, 1.45, 1.45], [x, y + 6.7, z]);
  }

  // The court stays visibly dormant until the authoritative boss awakens.
  // Its character model is rendered by the normal mob pipeline, avoiding a
  // duplicate static boss occupying the same space.
  const bossY = towerFloorTwoGroundHeight(525, 106);
  shape(root, "floor2-forgeheart-plinth", "cylinder", iron, [9, .8, 9], [525, bossY + .36, 106]);
  for (const side of [-1, 1])
    shape(root, "floor2-forgeheart-dormant-coil", "cylinder", hotIron, [2.4, 4.5, 2.4],
      [525, bossY + 2.55, 106 + side * 6.2], [0, 0, 90], true);

  // Chimneys establish the floor's destination and vertical scale from entry.
  for (const [x, z, height] of [[501, 96, 22], [501, 116, 18], [535, 94, 27], [535, 118, 24]] as const) {
    const y = towerFloorTwoGroundHeight(x, z);
    shape(root, "floor2-chimney", "cylinder", darkStone, [3.4, height, 3.4], [x, y + height * .5, z], [0, 0, 0], true);
    shape(root, "floor2-chimney-rim", "cylinder", iron, [4.2, .8, 4.2], [x, y + height, z]);
  }

  const orangeLight = new pc.Entity("floor2-crucible-light");
  orangeLight.addComponent("light", { type: "omni", color: new pc.Color(1, .25, .04), intensity: 1.1,
    range: 35, castShadows: false });
  orangeLight.setLocalPosition(510, 17, 106); root.addChild(orangeLight);
  const blueLight = new pc.Entity("floor2-quench-light");
  blueLight.addComponent("light", { type: "omni", color: new pc.Color(.08, .55, 1), intensity: .7,
    range: 24, castShadows: false });
  blueLight.setLocalPosition(480, 15, 142); root.addChild(blueLight);

  return root;
}

/** Keeps regulator and gate readability tied to the authoritative encounter
 * state without introducing a cosmetic barrier the player can collide with. */
export function updateTowerFloorTwoProgress(root: pc.Entity, furnaceAlive: boolean, quenchAlive: boolean,
  bossAlive: boolean): void {
  const sealed = furnaceAlive || quenchAlive;
  const sealedSignal = root.findByName("floor2-crucible-sealed-signal");
  const openSignal = root.findByName("floor2-crucible-open-signal");
  if (sealedSignal) sealedSignal.enabled = sealed;
  if (openSignal) openSignal.enabled = !sealed;
  for (const [name, alive] of [["furnace", furnaceAlive], ["quench", quenchAlive]] as const) {
    const core = root.findByName(`floor2-${name}-regulator-core`);
    const ring = root.findByName(`floor2-${name}-regulator-ring`);
    if (core) core.enabled = alive;
    if (ring) ring.enabled = alive;
  }
  const now = Date.now();
  for (const vent of TOWER_FLOOR_TWO_VENTS) {
    const groupEnabled = vent.group === "intake" || vent.group === "furnace" && furnaceAlive
      || vent.group === "quench" && quenchAlive || vent.group === "boss" && bossAlive;
    const phase = towerFloorTwoVentPhase(vent.offsetMs, now);
    const warning = root.findByName(`floor2-vent-warning:${vent.id}`);
    const jet = root.findByName(`floor2-vent-jet:${vent.id}`);
    if (warning) warning.enabled = groupEnabled && phase === "warning";
    if (jet) {
      jet.enabled = groupEnabled && phase === "erupting";
      if (jet.enabled) {
        const pulse = .9 + Math.sin(now * .018 + vent.offsetMs) * .1;
        jet.setLocalScale(vent.radius * 1.35 * pulse, 4.2 * pulse, vent.radius * 1.35 * pulse);
      }
    }
  }
}
