/** Canonical greybox manifest for Floor 2. Rendering, movement and portal
 * travel consume these coordinates so the forge cannot drift apart visually
 * and authoritatively while its art pass evolves. */
export const TOWER_FLOOR_TWO = {
  id: "tower-floor-2",
  name: "Floor 2 · The Emberworks",
  levelMin: 4,
  levelMax: 8,
  bounds: { minX: 410, maxX: 542, minZ: 42, maxZ: 170 },
  entry: { x: 416.5, y: 8, z: 106.5 },
  returnPortal: { x: 413.5, y: 8, z: 106.5 },
  ascentPortal: { x: 538.5, y: 9.25, z: 106.5 },
  coolingHub: { x: 458, z: 106, radius: 13 },
  northRegulator: { x: 480, z: 70, radius: 11 },
  southRegulator: { x: 480, z: 142, radius: 11 },
  crucibleGate: { x: 505, z: 106 },
  bossCourt: { x: 525, z: 106, radius: 16 },
} as const;

export type TowerFloorTwoRoomKind = "arrival" | "tutorial" | "hub" | "branch" | "regulator" | "approach" | "boss";
export type TowerFloorTwoRoom = {
  id: string;
  name: string;
  kind: TowerFloorTwoRoomKind;
  x: number;
  z: number;
  radius: number;
};

export const TOWER_FLOOR_TWO_ROOMS: readonly TowerFloorTwoRoom[] = [
  { id: "floor2-entry", name: "Pressure Vestibule", kind: "arrival", x: 417, z: 106, radius: 8 },
  { id: "floor2-intake", name: "Intake Hall", kind: "tutorial", x: 436, z: 106, radius: 12 },
  { id: "floor2-hub", name: "Cooling Hub", kind: "hub", x: 458, z: 106, radius: 13 },
  { id: "floor2-bellows", name: "Bellows Gallery", kind: "branch", x: 460, z: 76, radius: 8 },
  { id: "floor2-furnace-regulator", name: "Furnace Regulator", kind: "regulator", x: 480, z: 70, radius: 11 },
  { id: "floor2-quenchworks", name: "Quenchworks", kind: "branch", x: 460, z: 136, radius: 8 },
  { id: "floor2-quench-regulator", name: "Quench Regulator", kind: "regulator", x: 480, z: 142, radius: 11 },
  { id: "floor2-crucible", name: "Crucible Approach", kind: "approach", x: 503, z: 106, radius: 11 },
  { id: "floor2-forgeheart", name: "Forgeheart Arena", kind: "boss", x: 525, z: 106, radius: 16 },
] as const;

export type TowerFloorTwoRoute = {
  id: string;
  from: readonly [number, number];
  to: readonly [number, number];
  width: number;
};

/** Every route is at least five metres wide and both regulator routes rejoin
 * the Crucible approach instead of forcing a full return through the hub. */
export const TOWER_FLOOR_TWO_ROUTES: readonly TowerFloorTwoRoute[] = [
  { id: "entry-intake", from: [416, 106], to: [448, 106], width: 7 },
  { id: "intake-hub", from: [448, 106], to: [458, 106], width: 7 },
  { id: "hub-bellows", from: [458, 96], to: [458, 76], width: 6 },
  { id: "bellows-regulator", from: [458, 70], to: [480, 70], width: 6 },
  { id: "furnace-forward", from: [489, 74], to: [502, 98], width: 6 },
  { id: "hub-quenchworks", from: [458, 116], to: [458, 136], width: 6 },
  { id: "quenchworks-regulator", from: [458, 142], to: [480, 142], width: 6 },
  { id: "quench-forward", from: [489, 138], to: [502, 114], width: 6 },
  { id: "crucible-approach", from: [492, 106], to: [509, 106], width: 8 },
  { id: "boss-ascent", from: [509, 106], to: [539, 106], width: 8 },
] as const;

export type TowerFloorTwoSpawn = {
  id: string;
  archetype: "ember_hound" | "cinder_ram" | "shard_sentry" | "cave_spitter" | "stone_brute" | "fen_bloater";
  name: string;
  level: number;
  respawnMs: number;
  x: number;
  y: number;
  z: number;
  leader?: boolean;
  floorBoss?: boolean;
};

export type TowerFloorTwoEncounter = {
  id: string;
  name: string;
  branch: "intake" | "furnace" | "quench" | "crucible";
  kind: "required" | "regulator" | "boss";
  memberIds: readonly string[];
  lesson: string;
};

const floorTwoSpawn = (spawn: Omit<TowerFloorTwoSpawn, "y">): TowerFloorTwoSpawn => ({
  ...spawn,
  y: towerFloorTwoGroundHeight(spawn.x, spawn.z),
});

/** Floor 2 is a deliberate combat circuit. The boss is registered only after
 * both regulator leaders are defeated, so an early visit to the court cannot
 * skip the branch objectives. */
export const TOWER_FLOOR_TWO_SPAWNS: readonly TowerFloorTwoSpawn[] = [
  floorTwoSpawn({ id: "floor2-intake-hound", archetype: "ember_hound", name: "Soot Hound", level: 4,
    respawnMs: 300_000, x: 433, z: 102 }),
  floorTwoSpawn({ id: "floor2-intake-sentry", archetype: "shard_sentry", name: "Pressure Sentry", level: 4,
    respawnMs: 300_000, x: 439, z: 110 }),
  floorTwoSpawn({ id: "floor2-intake-ram", archetype: "cinder_ram", name: "Intake Ram", level: 5,
    respawnMs: 300_000, x: 445, z: 106 }),

  floorTwoSpawn({ id: "floor2-bellows-hound-a", archetype: "ember_hound", name: "Bellows Hound", level: 5,
    respawnMs: 300_000, x: 458, z: 86 }),
  floorTwoSpawn({ id: "floor2-bellows-hound-b", archetype: "ember_hound", name: "Bellows Hound", level: 5,
    respawnMs: 300_000, x: 462, z: 79 }),
  floorTwoSpawn({ id: "floor2-furnace-escort", archetype: "cinder_ram", name: "Furnace Ram", level: 6,
    respawnMs: 300_000, x: 473, z: 72 }),
  floorTwoSpawn({ id: "floor2-furnace-regulator", archetype: "cinder_ram", name: "Furnace Overseer", level: 7,
    respawnMs: 300_000, x: 480, z: 70, leader: true }),

  floorTwoSpawn({ id: "floor2-quench-sentry-a", archetype: "shard_sentry", name: "Quench Sentry", level: 5,
    respawnMs: 300_000, x: 458, z: 126 }),
  floorTwoSpawn({ id: "floor2-quench-sentry-b", archetype: "cave_spitter", name: "Steamcaster", level: 5,
    respawnMs: 300_000, x: 463, z: 135 }),
  floorTwoSpawn({ id: "floor2-quench-bloater", archetype: "fen_bloater", name: "Coolant Vessel", level: 6,
    respawnMs: 300_000, x: 473, z: 140 }),
  floorTwoSpawn({ id: "floor2-quench-regulator", archetype: "stone_brute", name: "Quench Warden", level: 7,
    respawnMs: 300_000, x: 480, z: 142, leader: true }),

  floorTwoSpawn({ id: "floor2-crucible-ram", archetype: "cinder_ram", name: "Crucible Ram", level: 6,
    respawnMs: 300_000, x: 501, z: 101 }),
  floorTwoSpawn({ id: "floor2-crucible-sentry", archetype: "shard_sentry", name: "Crucible Sentry", level: 6,
    respawnMs: 300_000, x: 501, z: 111 }),
  floorTwoSpawn({ id: "floor2-forgeheart", archetype: "stone_brute", name: "The Forgeheart", level: 8,
    respawnMs: 300_000, x: 525, z: 106, leader: true, floorBoss: true }),
] as const;

export const TOWER_FLOOR_TWO_FURNACE_REGULATOR_ID = "floor2-furnace-regulator";
export const TOWER_FLOOR_TWO_QUENCH_REGULATOR_ID = "floor2-quench-regulator";
export const TOWER_FLOOR_TWO_REGULATORS = [TOWER_FLOOR_TWO_FURNACE_REGULATOR_ID,
  TOWER_FLOOR_TWO_QUENCH_REGULATOR_ID] as const;
export const TOWER_FLOOR_TWO_BOSS_ID = "floor2-forgeheart";

export type TowerFloorTwoVentGroup = "intake" | "furnace" | "quench" | "boss";
export type TowerFloorTwoVentPhase = "idle" | "warning" | "erupting" | "recovery";
export const TOWER_FLOOR_TWO_VENTS = [
  { id: "intake-teaching-vent", group: "intake" as const, x: 442, z: 106, radius: 1.35, offsetMs: 0 },
  { id: "furnace-vent-west", group: "furnace" as const, x: 465, z: 72, radius: 1.25, offsetMs: 1_100 },
  { id: "furnace-vent-east", group: "furnace" as const, x: 476, z: 77, radius: 1.25, offsetMs: 4_000 },
  { id: "quench-vent-west", group: "quench" as const, x: 465, z: 140, radius: 1.25, offsetMs: 2_100 },
  { id: "quench-vent-east", group: "quench" as const, x: 476, z: 135, radius: 1.25, offsetMs: 5_000 },
  { id: "boss-vent-nw", group: "boss" as const, x: 518, z: 98, radius: 1.5, offsetMs: 0 },
  { id: "boss-vent-ne", group: "boss" as const, x: 532, z: 98, radius: 1.5, offsetMs: 1_750 },
  { id: "boss-vent-se", group: "boss" as const, x: 532, z: 114, radius: 1.5, offsetMs: 3_500 },
  { id: "boss-vent-sw", group: "boss" as const, x: 518, z: 114, radius: 1.5, offsetMs: 5_250 },
] as const;

export function towerFloorTwoVentPhase(offsetMs: number, now: number): TowerFloorTwoVentPhase {
  const phase = ((now + offsetMs) % 7_000 + 7_000) % 7_000;
  return phase >= 5_500 ? "erupting" : phase >= 4_200 ? "warning" : phase >= 900 ? "idle" : "recovery";
}

export function towerFloorTwoEruptingVentAt(x: number, z: number, now: number,
  enabled: (group: TowerFloorTwoVentGroup) => boolean = () => true) {
  return TOWER_FLOOR_TWO_VENTS.find(vent => enabled(vent.group)
    && towerFloorTwoVentPhase(vent.offsetMs, now) === "erupting"
    && Math.hypot(x - vent.x, z - vent.z) <= vent.radius);
}

export const TOWER_FLOOR_TWO_ENCOUNTERS: readonly TowerFloorTwoEncounter[] = [
  { id: "floor2-intake", name: "Pressure Intake", branch: "intake", kind: "required",
    memberIds: ["floor2-intake-hound", "floor2-intake-sentry", "floor2-intake-ram"],
    lesson: "Read a charging lane while closing down a ranged threat." },
  { id: "floor2-furnace", name: "Furnace Regulator", branch: "furnace", kind: "regulator",
    memberIds: ["floor2-bellows-hound-a", "floor2-bellows-hound-b", "floor2-furnace-escort", TOWER_FLOOR_TWO_FURNACE_REGULATOR_ID],
    lesson: "Keep moving through burning charge trails, then punish the Overseer's recovery." },
  { id: "floor2-quench", name: "Quench Regulator", branch: "quench", kind: "regulator",
    memberIds: ["floor2-quench-sentry-a", "floor2-quench-sentry-b", "floor2-quench-bloater", TOWER_FLOOR_TWO_QUENCH_REGULATOR_ID],
    lesson: "Break ranged crossfire and interrupt the coolant cloud before space disappears." },
  { id: "floor2-crucible", name: "Crucible Breach", branch: "crucible", kind: "required",
    memberIds: ["floor2-crucible-ram", "floor2-crucible-sentry"],
    lesson: "Use either branch breach to attack the mixed final guard from a favourable angle." },
  { id: "floor2-forgeheart", name: "Forgeheart Court", branch: "crucible", kind: "boss",
    memberIds: [TOWER_FLOOR_TWO_BOSS_ID],
    lesson: "Learn its fixed sequence, leave telegraphed pressure zones and punish recovery windows." },
] as const;

export const TOWER_FLOOR_TWO_FORGEHEART_COMBAT = {
  health: 78,
  phaseTwoAt: .62,
  finalPhaseAt: .28,
} as const;

export function towerFloorTwoForgeheartPhase(health: number, maxHealth: number): 1 | 2 | 3 {
  const ratio = maxHealth > 0 ? health / maxHealth : 0;
  return ratio <= TOWER_FLOOR_TWO_FORGEHEART_COMBAT.finalPhaseAt ? 3
    : ratio <= TOWER_FLOOR_TWO_FORGEHEART_COMBAT.phaseTwoAt ? 2 : 1;
}

export function towerFloorTwoForgeheartPattern(actionSequence: number, phase: 1 | 2 | 3): string {
  const rotations = {
    1: ["smash", "slam", "rocks"],
    2: ["charge", "rocks", "slam", "smash"],
    3: ["warden-barrage", "charge", "smash", "rocks"],
  } as const;
  const rotation = rotations[phase];
  return rotation[Math.abs(Math.trunc(actionSequence)) % rotation.length]!;
}

export function towerFloorTwoSpawn(id: string): TowerFloorTwoSpawn | undefined {
  return TOWER_FLOOR_TWO_SPAWNS.find(spawn => spawn.id === id);
}

export function towerFloorTwoEncounterForMember(id: string): TowerFloorTwoEncounter | undefined {
  return TOWER_FLOOR_TWO_ENCOUNTERS.find(encounter => encounter.memberIds.includes(id));
}

/**
 * Encounter-wide combat bounds prevent ranged players from abusing the old
 * ten-metre leash around each individual spawn. The margin leaves room for
 * flanking and retreat without letting one pull roam into another room.
 */
export function towerFloorTwoEncounterBounds(id: string) {
  const encounter = towerFloorTwoEncounterForMember(id);
  if (!encounter) return null;
  const members = encounter.memberIds
    .map(memberId => towerFloorTwoSpawn(memberId))
    .filter((spawn): spawn is TowerFloorTwoSpawn => Boolean(spawn));
  if (!members.length) return null;
  const margin = encounter.kind === "boss" ? TOWER_FLOOR_TWO.bossCourt.radius
    : encounter.kind === "regulator" ? 9 : 10;
  return {
    minX: Math.min(...members.map(spawn => spawn.x)) - margin,
    maxX: Math.max(...members.map(spawn => spawn.x)) + margin,
    minZ: Math.min(...members.map(spawn => spawn.z)) - margin,
    maxZ: Math.max(...members.map(spawn => spawn.z)) + margin,
  };
}

export function towerFloorTwoEncounterAllows(id: string, position: { x: number; y: number; z: number }): boolean {
  const spawn = towerFloorTwoSpawn(id);
  const bounds = towerFloorTwoEncounterBounds(id);
  return Boolean(spawn && bounds) && isInsideTowerFloorTwo(position.x, position.z, 2)
    && Math.abs(position.y - towerFloorTwoGroundHeight(position.x, position.z)) <= 1.75
    && position.x >= bounds!.minX && position.x <= bounds!.maxX
    && position.z >= bounds!.minZ && position.z <= bounds!.maxZ;
}

function smoothStep(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function terrace(x: number, z: number, cx: number, cz: number, inner: number, outer: number, height: number): number {
  const distance = Math.hypot(x - cx, z - cz);
  if (distance <= inner) return height;
  if (distance >= outer) return 0;
  return height * (1 - smoothStep((distance - inner) / (outer - inner)));
}

function routeHeight(x: number, z: number, route: TowerFloorTwoRoute, fromHeight: number, toHeight: number): number {
  const [ax, az] = route.from, [bx, bz] = route.to;
  const dx = bx - ax, dz = bz - az, lengthSquared = dx * dx + dz * dz;
  const length = Math.sqrt(lengthSquared);
  const rawT = ((x - ax) * dx + (z - az) * dz) / lengthSquared;
  const t = Math.max(0, Math.min(1, rawT));
  const lateralDistance = Math.abs(dx * (z - az) - dz * (x - ax)) / length;
  const distanceBeyondEnd = rawT < 0 ? -rawT * length : rawT > 1 ? (rawT - 1) * length : 0;
  if (lateralDistance >= route.width * .5 + 1.5 || distanceBeyondEnd >= 1.5) return 0;
  const lateralFade = 1 - smoothStep((lateralDistance - route.width * .5) / 1.5);
  const endFade = 1 - smoothStep(distanceBeyondEnd / 1.5);
  return (fromHeight + (toHeight - fromHeight) * t)
    * lateralFade * endFade;
}

export function towerFloorTwoGroundHeight(x: number, z: number): number {
  if (!isInsideTowerFloorTwo(x, z)) return 8;
  const hub = terrace(x, z, 458, 106, 10.5, 15, .35);
  const north = terrace(x, z, 480, 70, 9.5, 13.5, .65);
  const south = terrace(x, z, 480, 142, 9.5, 13.5, .65);
  const boss = terrace(x, z, 525, 106, 14, 19, 1.25);
  const routes = TOWER_FLOOR_TWO_ROUTES.map(route => routeHeight(x, z, route,
    route.id.includes("forward") ? .65 : route.id === "boss-ascent" ? 1.25 : 0,
    route.id === "crucible-approach" || route.id === "boss-ascent" ? 1.25
      : route.id.includes("regulator") || route.id.includes("forward") ? .65
        : route.id.includes("hub") ? .35 : 0));
  return 8 + Math.max(hub, north, south, boss, ...routes);
}

export function isInsideTowerFloorTwo(x: number, z: number, inset = 0): boolean {
  const bounds = TOWER_FLOOR_TWO.bounds;
  return x >= bounds.minX + inset && x <= bounds.maxX - inset
    && z >= bounds.minZ + inset && z <= bounds.maxZ - inset;
}

/** Structural wall runs only. Their gaps are the authored five-to-eight metre
 * doors; machinery and clutter remain non-solid during greybox validation. */
export const TOWER_FLOOR_TWO_COLLIDERS = [
  { id: "floor2-intake-north", kind: "building" as const, minX: 423, maxX: 448, minY: 8, maxY: 15, minZ: 91.5, maxZ: 93.5 },
  { id: "floor2-intake-south", kind: "building" as const, minX: 423, maxX: 448, minY: 8, maxY: 15, minZ: 118.5, maxZ: 120.5 },
  { id: "floor2-entry-north", kind: "building" as const, minX: 410.5, maxX: 423, minY: 8, maxY: 15, minZ: 96, maxZ: 98 },
  { id: "floor2-entry-south", kind: "building" as const, minX: 410.5, maxX: 423, minY: 8, maxY: 15, minZ: 114, maxZ: 116 },
  { id: "floor2-bellows-west", kind: "building" as const, minX: 451.5, maxX: 453.5, minY: 8, maxY: 15, minZ: 70, maxZ: 96 },
  { id: "floor2-bellows-east", kind: "building" as const, minX: 462.5, maxX: 464.5, minY: 8, maxY: 15, minZ: 78, maxZ: 96 },
  { id: "floor2-bellows-north", kind: "building" as const, minX: 453.5, maxX: 469, minY: 8, maxY: 15, minZ: 63, maxZ: 65 },
  { id: "floor2-quench-west", kind: "building" as const, minX: 451.5, maxX: 453.5, minY: 8, maxY: 15, minZ: 116, maxZ: 142 },
  { id: "floor2-quench-east", kind: "building" as const, minX: 462.5, maxX: 464.5, minY: 8, maxY: 15, minZ: 116, maxZ: 134 },
  { id: "floor2-quench-south", kind: "building" as const, minX: 453.5, maxX: 469, minY: 8, maxY: 15, minZ: 147, maxZ: 149 },
  // Split wall runs leave six-metre breaches where the forward branch routes
  // enter the Crucible. These openings are authored traversal, not missing art.
  { id: "floor2-crucible-north-west", kind: "building" as const, minX: 491, maxX: 497, minY: 8, maxY: 17, minZ: 94, maxZ: 96 },
  { id: "floor2-crucible-north-east", kind: "building" as const, minX: 503, maxX: 510, minY: 8, maxY: 17, minZ: 94, maxZ: 96 },
  { id: "floor2-crucible-south-west", kind: "building" as const, minX: 491, maxX: 497, minY: 8, maxY: 17, minZ: 116, maxZ: 118 },
  { id: "floor2-crucible-south-east", kind: "building" as const, minX: 503, maxX: 510, minY: 8, maxY: 17, minZ: 116, maxZ: 118 },
] as const;

