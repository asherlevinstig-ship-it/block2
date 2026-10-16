import { ASHEN_SPIRE_POSITION, Block, GREENWOOD_CRAWLER_HOMES, GREENWOOD_REGION, MISTFEN_BEHEMOTH_HOME, REALM_WARDEN_GATE_POSITION, RENEWABLE_MINERAL_DEPOSITS, ROADSIDE_DISCOVERIES, SILVER_DEPTHS_ROOMS, silverDepthsPingLocation, SURFACE_HEIGHT, TOWN_CENTER_X, TOWN_CENTER_Z, TOWN_BLACKSMITH_STALL_POSITION, TOWN_SAFE_RADIUS, isInAshenReach, isInMistfenMarsh, isInNorthwatchHighlands, isMistfenBoardwalk, isMistfenToxicPool, isRegionalRoad, southernQuarryTierAt, wildernessTerritoryAt } from "@blockcraft/voxel-world";
import { ITEM_DEFINITIONS, type EquipmentHuntTarget, type MineralDepositStatus, type SilverDepthsCacheStatus, type SilverDepthsGateStatus, type SilverDepthsPing } from "@blockcraft/protocol";
import { MINE_ENTRANCE, caveDepth, type CaveMapState } from "./cave-navigation.js";
import { SILVER_DEPTHS_MAP_GATES, silverDepthsMapRoute, type DungeonMapRoute } from "./silver-depths-navigation.js";

export const MAP_SIZE = 220;
export const MAP_RANGE = 72;
const SURFACE_TERRAIN_SIZE = MAP_SIZE / 2;
export const DISCOVERY_RADIUS = 10;
export const THREAT_GUIDANCE_RADIUS = 28;
export const MAP_THREAT_DISPLAY_RADIUS = 24;
type MapColor = readonly [number, number, number];
type SurfaceMapRegion = { readonly id: string; readonly name: string };
const SURFACE_MAP_REGIONS = {
  town: { id: "town", name: "Town of Beginnings" },
  outskirts: { id: "outskirts", name: "Iron Outskirts" },
  wilds: { id: "wilds", name: "Silver Wilds" },
  frontier: { id: "frontier", name: "Stone Frontier" },
  greenwood: { id: "greenwood", name: "Greenwood" },
  mistfen: { id: "mistfen", name: "Mistfen Marsh" },
  causeway: { id: "causeway", name: "Southern Causeway" },
  quarry: { id: "quarry", name: "Sunfall Quarry" },
  redstone: { id: "redstone", name: "Redstone Pit" },
  northwatch: { id: "northwatch", name: "Northwatch Highlands" },
  ashen: { id: "ashen", name: "Ashen Reach" },
} as const satisfies Record<string, SurfaceMapRegion>;
const SURFACE_MAP_COLORS = {
  town: [35, 74, 60], outskirts: [58, 79, 54], wilds: [71, 78, 57], frontier: [83, 73, 55],
  greenwood: [38, 82, 45], mistfen: [35, 65, 58], mistfenPool: [22, 88, 75],
  causeway: [79, 87, 57], quarry: [111, 88, 60], redstone: [116, 66, 52],
  northwatch: [67, 81, 88], ashen: [106, 65, 50], road: [165, 137, 85], boardwalk: [176, 152, 96],
} as const satisfies Record<string, MapColor>;
const MUTED_SURFACE_MAP_COLORS = new Map<MapColor, MapColor>(Object.values(SURFACE_MAP_COLORS).map(color =>
  [color, [Math.round(color[0] * .38 + 10), Math.round(color[1] * .38 + 13), Math.round(color[2] * .38 + 11)]]));
const VALID_SURFACE_REGIONS = new Set(Object.keys(SURFACE_MAP_REGIONS));
export function parseVisitedSurfaceRegions(raw: string | null): Set<string> {
  try {
    const values: unknown = JSON.parse(raw ?? "[]");
    return new Set(Array.isArray(values) ? values.filter((value): value is string => typeof value === "string" && VALID_SURFACE_REGIONS.has(value)) : []);
  } catch { return new Set(); }
}
export function surfaceMapRegionAt(x: number, z: number): SurfaceMapRegion {
  const cellX = Math.floor(x), cellZ = Math.floor(z);
  if (Math.hypot(x - TOWN_CENTER_X, z - TOWN_CENTER_Z) < TOWN_SAFE_RADIUS) return SURFACE_MAP_REGIONS.town;
  const southernTier = southernQuarryTierAt(cellX, cellZ);
  if (southernTier) return southernTier === 1 ? SURFACE_MAP_REGIONS.causeway
    : southernTier === 2 ? SURFACE_MAP_REGIONS.quarry : SURFACE_MAP_REGIONS.redstone;
  if (isInNorthwatchHighlands(cellX, cellZ)) return SURFACE_MAP_REGIONS.northwatch;
  if (isInMistfenMarsh(cellX, cellZ)) return SURFACE_MAP_REGIONS.mistfen;
  if (isInAshenReach(cellX, cellZ)) return SURFACE_MAP_REGIONS.ashen;
  if (cellX >= GREENWOOD_REGION.minX && cellX <= GREENWOOD_REGION.maxX
    && cellZ >= GREENWOOD_REGION.minZ && cellZ <= GREENWOOD_REGION.maxZ) return SURFACE_MAP_REGIONS.greenwood;
  const tier = wildernessTerritoryAt(x, z)?.tier;
  return tier === 3 ? SURFACE_MAP_REGIONS.frontier : tier === 2 ? SURFACE_MAP_REGIONS.wilds : SURFACE_MAP_REGIONS.outskirts;
}
/** Use the same region and road boundaries as the generated surface world. */
export function surfaceMapColorAt(x: number, z: number, visitedRegions?: ReadonlySet<string>): MapColor {
  const cellX = Math.floor(x), cellZ = Math.floor(z);
  const region = surfaceMapRegionAt(x, z);
  const color = isMistfenBoardwalk(cellX, cellZ) && region.id === "mistfen" ? SURFACE_MAP_COLORS.boardwalk
    : isRegionalRoad(cellX, cellZ) ? SURFACE_MAP_COLORS.road
      : region.id === "mistfen" && isMistfenToxicPool(cellX, cellZ) ? SURFACE_MAP_COLORS.mistfenPool
        : SURFACE_MAP_COLORS[region.id as keyof typeof SURFACE_MAP_COLORS];
  return visitedRegions && !visitedRegions.has(region.id) ? MUTED_SURFACE_MAP_COLORS.get(color)! : color;
}
type Position = { x: number; z: number };
export type ThreatMapTarget = Position & { y: number; name: string };
export function nearbyThreatMapTarget(
  player: Position & { y: number },
  threat: ThreatMapTarget | null,
  radius = THREAT_GUIDANCE_RADIUS,
): ThreatMapTarget | null {
  return threat && Math.abs(threat.y - player.y) <= 2.5
    && Math.hypot(threat.x - player.x, threat.z - player.z) <= radius ? threat : null;
}
export type EliteMapTarget = Position & { id: string; name: string; y: number; alive: boolean; isElite: boolean; isMiniBoss?: boolean };
export function activeEliteMapTargets(player: Position & { y: number }, elites: readonly EliteMapTarget[], radius = MAP_THREAT_DISPLAY_RADIUS): EliteMapTarget[] {
  return elites.filter(elite => elite.alive && elite.isElite && !elite.isMiniBoss && Math.abs(elite.y - player.y) <= 2.5
    && Math.hypot(elite.x - player.x, elite.z - player.z) <= radius);
}
export const miniBossDiscoveryKey = (id: string): string => `leader:${id}`;
export const roadsideDiscoveryKey = (id: string): string => `landmark:${id}`;
export function discoverRoadsideLandmarks(player: Position & { y: number }, discovered: Set<string>): boolean {
  if (player.y < SURFACE_HEIGHT - 1) return false;
  let changed = false;
  for (const landmark of ROADSIDE_DISCOVERIES) {
    const key = roadsideDiscoveryKey(landmark.id);
    if (discovered.has(key) || Math.hypot(player.x - landmark.x, player.z - landmark.z) > 9) continue;
    discovered.add(key); changed = true;
  }
  return changed;
}
export function discoverMiniBosses(player: Position & { y: number }, mobs: readonly EliteMapTarget[], discovered: Set<string>): boolean {
  let changed = false;
  for (const mob of mobs) {
    const key = miniBossDiscoveryKey(mob.id);
    if (!mob.isMiniBoss || mob.id === CHAMPION_WAYPOINT.id || !mob.alive || discovered.has(key)
      || Math.abs(mob.y - player.y) > 2.5 || Math.hypot(mob.x - player.x, mob.z - player.z) > DISCOVERY_RADIUS) continue;
    discovered.add(key);
    changed = true;
  }
  return changed;
}
export function discoveredMiniBossTargets(mobs: readonly EliteMapTarget[], discovered: Set<string>): EliteMapTarget[] {
  return mobs.filter(mob => mob.isMiniBoss && mob.id !== CHAMPION_WAYPOINT.id && discovered.has(miniBossDiscoveryKey(mob.id)));
}
export function nearbyDiscoveredMiniBossTargets(player: Position & { y: number }, mobs: readonly EliteMapTarget[], discovered: Set<string>, radius = MAP_THREAT_DISPLAY_RADIUS): EliteMapTarget[] {
  return discoveredMiniBossTargets(mobs, discovered).filter(mob => mob.alive && Math.abs(mob.y - player.y) <= 2.5
    && Math.hypot(mob.x - player.x, mob.z - player.z) <= radius);
}
export type ThreatMapCluster = { x: number; z: number; members: EliteMapTarget[] };
/** Merge markers that would land almost on top of one another at the current map scale. */
export function clusterThreatMapTargets(targets: readonly EliteMapTarget[], worldDistance = 7): ThreatMapCluster[] {
  const clusters: ThreatMapCluster[] = [];
  for (const target of targets) {
    const cluster = clusters.find(candidate => Math.hypot(candidate.x - target.x, candidate.z - target.z) <= worldDistance);
    if (!cluster) { clusters.push({ x: target.x, z: target.z, members: [target] }); continue; }
    cluster.members.push(target);
    cluster.x = cluster.members.reduce((sum, member) => sum + member.x, 0) / cluster.members.length;
    cluster.z = cluster.members.reduce((sum, member) => sum + member.z, 0) / cluster.members.length;
  }
  return clusters;
}
export function mapMarkerLabelVisible(player: Position, point: Position, selected: boolean, radius = DISCOVERY_RADIUS): boolean {
  return selected || Math.hypot(point.x - player.x, point.z - player.z) <= radius;
}
export function isPathChampionName(name: string): boolean {
  return /Razorhide Pack Sovereign|Viridian Brood Oracle|Worldsplitter Colossus/i.test(name);
}
export type DungeonMapState = { objective: Position & { title: string }; teammates: (Position & { id: string; name: string; y: number; state: "fighting" | "fallen" })[] };
export function dungeonMapPoints(player: Position & { y: number }, state: DungeonMapState) {
  return { objective: mapPoint(player, state.objective), teammates: state.teammates
    .filter(teammate => Math.abs(teammate.y - player.y) <= 3)
    .map(teammate => ({ ...teammate, ...mapPoint(player, teammate) })) };
}
export function dungeonPingAtMapClick(player: Position, x: number, y: number): Position | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > MAP_SIZE || y < 0 || y > MAP_SIZE) return null;
  const scale = MAP_SIZE / (MAP_RANGE * 2);
  return silverDepthsPingLocation(player.x + (x - MAP_SIZE / 2) / scale,
    player.z + (y - MAP_SIZE / 2) / scale);
}
export const MAP_DEPOSITS = RENEWABLE_MINERAL_DEPOSITS;
export function mineralStatusLabel(status: MineralDepositStatus | undefined, now: number): string {
  if (!status) return "Unknown";
  if (status.available > 0) return `Available · ${status.available}/${status.total}`;
  if (status.readyAt === null) return "Depleted";
  const seconds = Math.ceil((status.readyAt - now) / 1000);
  return seconds > 0 ? `Recovering · ${seconds}s` : "Recovering · waiting for space";
}
export const depositKey = (deposit: Position): string => `${deposit.x},${deposit.z}`;
export const mapFacing = (yaw: number): { x: number; y: number } => ({ x: Math.sin(yaw * Math.PI / 180), y: Math.cos(yaw * Math.PI / 180) });
export type Waypoint = Position & { y: number; id: string; name: string };
export const HOME_WAYPOINT: Waypoint = { x: TOWN_CENTER_X, z: TOWN_CENTER_Z, y: SURFACE_HEIGHT + 1, id: "home", name: "Town of Beginnings" };
export const CHAMPION_WAYPOINT: Waypoint = { x: -48.5, y: SURFACE_HEIGHT + 1, z: 12.5, id: "frontier-brute-west", name: "Frontier Stone Champion" };
export const ASHEN_SPIRE_WAYPOINT: Waypoint = { ...ASHEN_SPIRE_POSITION, id: "ashen-spire", name: "Ashen Reach Spire" };
export const WARDEN_GATE_WAYPOINT: Waypoint = { ...REALM_WARDEN_GATE_POSITION, id: "warden-gate", name: "Warden Gate · Ascendant Challenge" };
export const MISTFEN_WAYPOINT: Waypoint = { ...MISTFEN_BEHEMOTH_HOME, id: "mistfen-marsh", name: "Mistfen Marsh · LV 5–9" };
export const GREENWOOD_WAYPOINT: Waypoint = { ...GREENWOOD_CRAWLER_HOMES[0], id: "greenwood-camp", name: "Greenwood Camp · LV 2–5" };
export function discoverMistfen(player: Position & { y: number }, discovered: Set<string>): boolean {
  if (discovered.has(MISTFEN_WAYPOINT.id) || player.y < SURFACE_HEIGHT - 1
    || Math.hypot(player.x - MISTFEN_WAYPOINT.x, player.z - MISTFEN_WAYPOINT.z) > 22) return false;
  discovered.add(MISTFEN_WAYPOINT.id); return true;
}
export function discoverAshenSpire(player: Position & { y: number }, discovered: Set<string>): boolean {
  if (discovered.has(ASHEN_SPIRE_WAYPOINT.id) || player.y < SURFACE_HEIGHT - 1
    || Math.hypot(player.x - ASHEN_SPIRE_WAYPOINT.x, player.z - ASHEN_SPIRE_WAYPOINT.z) > 18) return false;
  discovered.add(ASHEN_SPIRE_WAYPOINT.id); return true;
}
export function discoverChampion(player: Position & { y: number }, champion: (Position & { y: number; alive: boolean }) | null, discovered: Set<string>): boolean {
  if (!champion?.alive || discovered.has(CHAMPION_WAYPOINT.id) || player.y < SURFACE_HEIGHT - 1
    || Math.abs(player.y - champion.y) > 2 || Math.hypot(player.x - champion.x, player.z - champion.z) > DISCOVERY_RADIUS) return false;
  discovered.add(CHAMPION_WAYPOINT.id); return true;
}
export function knownWaypoints(discovered: Set<string>, wardenGateUnlocked = false): Waypoint[] {
  return [HOME_WAYPOINT, { ...TOWN_BLACKSMITH_STALL_POSITION, id: "smith", name: "Blacksmith" }, MINE_ENTRANCE,
    ...(discovered.has(CHAMPION_WAYPOINT.id) ? [CHAMPION_WAYPOINT] : []),
    ...(discovered.has(ASHEN_SPIRE_WAYPOINT.id) ? [ASHEN_SPIRE_WAYPOINT] : []),
    ...(discovered.has(MISTFEN_WAYPOINT.id) ? [MISTFEN_WAYPOINT] : []),
    ...(discovered.has(GREENWOOD_WAYPOINT.id) ? [GREENWOOD_WAYPOINT] : []),
    ...(wardenGateUnlocked ? [WARDEN_GATE_WAYPOINT] : []),
    ...MAP_DEPOSITS.filter(point => discovered.has(depositKey(point))).map(point => ({ ...point, y: SURFACE_HEIGHT + 1, id: depositKey(point), name: `${point.block === Block.SilverOre ? "Silver" : "Iron"} deposit (${point.x}, ${point.z})` }))];
}
export function waypointAtMapPoint(player: Position, x: number, y: number, discovered: Set<string>, wardenGateUnlocked = false): Waypoint | null {
  let closest: Waypoint | null = null, distance = 14;
  for (const target of knownWaypoints(discovered, wardenGateUnlocked)) {
    const p = mapPoint(player, target);
    if (target.id !== "home" && p.offscreen) continue;
    const delta = Math.hypot(p.x - x, p.y - y);
    if (delta <= distance) { closest = target; distance = delta; }
  }
  return closest;
}
export function waypointDirection(player: Position & { y: number }, target: Waypoint, cameraYaw: number): { distance: number; angle: number; arrived: boolean } {
  const dx = target.x - player.x, dz = target.z - player.z;
  const distance = Math.hypot(dx, dz);
  const right = dx * Math.sin(cameraYaw) - dz * Math.cos(cameraYaw);
  const down = dx * Math.cos(cameraYaw) + dz * Math.sin(cameraYaw);
  return { distance, angle: Math.atan2(right, -down) * 180 / Math.PI, arrived: distance <= 2.5 && Math.abs(player.y - target.y) <= 1.6 };
}

export function mapPoint(player: Position, point: Position): { x: number; y: number; offscreen: boolean } {
  const scale = MAP_SIZE / (MAP_RANGE * 2);
  const dx = (point.x - player.x) * scale;
  const dz = (point.z - player.z) * scale;
  const limit = MAP_SIZE / 2 - 14;
  const factor = Math.min(1, limit / Math.max(Math.abs(dx), Math.abs(dz), 0.001));
  return { x: MAP_SIZE / 2 + dx * factor, y: MAP_SIZE / 2 + dz * factor, offscreen: factor < 1 };
}

export function parseDiscoveries(raw: string | null): Set<string> {
  try {
    const values: unknown = JSON.parse(raw ?? "[]");
    const allowed = new Set(MAP_DEPOSITS.map(depositKey));
    allowed.add(CHAMPION_WAYPOINT.id);
    allowed.add(ASHEN_SPIRE_WAYPOINT.id);
    allowed.add(MISTFEN_WAYPOINT.id);
    allowed.add(GREENWOOD_WAYPOINT.id);
    for (const landmark of ROADSIDE_DISCOVERIES) allowed.add(roadsideDiscoveryKey(landmark.id));
    return new Set(Array.isArray(values) ? values.filter((value): value is string => typeof value === "string"
      && (allowed.has(value) || /^leader:[a-z0-9:-]+$/.test(value))) : []);
  } catch { return new Set(); }
}

export function discoverDeposits(player: Position & { y: number }, discovered: Set<string>): boolean {
  let changed = false;
  if (player.y < SURFACE_HEIGHT - 1) return false;
  for (const deposit of MAP_DEPOSITS) {
    const key = depositKey(deposit);
    if (!discovered.has(key) && Math.hypot(player.x - deposit.x, player.z - deposit.z) <= DISCOVERY_RADIUS) {
      discovered.add(key); changed = true;
    }
  }
  return changed;
}

export function createMinimap(canvas: HTMLCanvasElement, detail: HTMLElement, storageKey: string,
  onRegionDiscovered?: (name: string) => void): {
  setChampionState(champion: (Position & { y: number; alive: boolean }) | null): void;
  setEliteStates(elites: EliteMapTarget[]): void;
  setThreatState(threat: ThreatMapTarget | null): void;
  setWardenGateUnlocked(unlocked: boolean): void;
  setMistfenMastery(rank: number): void;
  setGreenwoodMastery(rank: number): void;
  setEquipmentHunt(target: EquipmentHuntTarget | null): void;
  setMineralStatus(statuses: MineralDepositStatus[]): void;
  setCaveState(state: CaveMapState): void;
  setDungeonState(state: DungeonMapState | null): void;
  setDungeonGateStatus(status: SilverDepthsGateStatus): void;
  setDungeonCacheStatus(status: SilverDepthsCacheStatus): void;
  setDungeonPing(ping: SilverDepthsPing): void;
  setPingHandler(handler: (x: number, z: number) => void): void;
  guideTo(target: Waypoint): void;
  clearGuide(expectedId?: string): void;
  surfaceGuideEnabled(): boolean;
  update(player: Position & { y: number }, yaw: number, now: number, visible: boolean, cameraYaw?: number, active?: boolean): void;
} {
  const context = canvas.getContext("2d");
  let discovered: Set<string>;
  try { discovered = parseDiscoveries(localStorage.getItem(storageKey)); } catch { discovered = new Set(); }
  const visitedRegionsKey = `${storageKey}:visited-regions:v1`;
  let visitedRegions: Set<string>;
  try { visitedRegions = parseVisitedSurfaceRegions(localStorage.getItem(visitedRegionsKey)); } catch { visitedRegions = new Set(); }
  let lastUpdate = -Infinity;
  let lastPlayer: (Position & { y: number }) | null = null;
  let waypoint: Waypoint | null = null;
  let surfaceGuide = false;
  let caveState: CaveMapState = { known: new Set(), chambers: [], route: [] };
  let dungeonState: DungeonMapState | null = null;
  let dungeonGates: SilverDepthsGateStatus | null = null;
  let cachedRoute: DungeonMapRoute | null = null;
  let cachedRouteKey = "";
  const dungeonPings = new Map<string, SilverDepthsPing & { expiresAt: number }>();
  let dungeonCache: SilverDepthsCacheStatus | null = null;
  let wardenGateUnlocked = false;
  let pingHandler: ((x: number, z: number) => void) | null = null;
  const panel = canvas.closest<HTMLElement>("#minimap");
  const surfaceButton = document.querySelector<HTMLButtonElement>("#minimap-surface")!;
  const depthLabel = document.querySelector<HTMLElement>("#minimap-depth")!;
  const statuses = new Map<string, MineralDepositStatus>();
  let champion: (Position & { y: number; alive: boolean }) | null = null;
  let elites: EliteMapTarget[] = [];
  let threat: ThreatMapTarget | null = null;
  let equipmentHunt: EquipmentHuntTarget | null = null;
  let lastStatusSecond = 0;
  const homeButton = document.querySelector<HTMLButtonElement>("#minimap-home")!;
  const destinations = document.querySelector<HTMLSelectElement>("#minimap-destination")!;
  const guide = document.querySelector<HTMLElement>("#waypoint-guide")!;
  const guideName = document.querySelector<HTMLElement>("#waypoint-name")!;
  const guideDistance = document.querySelector<HTMLElement>("#waypoint-distance")!;
  const guideArrow = document.querySelector<HTMLElement>("#waypoint-arrow")!;
  const setWaypoint = (target: Waypoint | null) => {
    surfaceGuide = false;
    surfaceButton.setAttribute("aria-pressed", "false");
    waypoint = target; lastUpdate = -Infinity;
    destinations.value = target?.id ?? "";
    guide.hidden = target === null;
    if (target) { guideName.textContent = target.name; guideDistance.textContent = "Guiding…"; }
  };
  const navigationTargets = (): Waypoint[] => [...knownWaypoints(discovered, wardenGateUnlocked), ...(equipmentHunt
    ? [{ x: equipmentHunt.x, y: equipmentHunt.y, z: equipmentHunt.z, id: "equipment-hunt", name: `${equipmentHunt.regionName} · ${equipmentHunt.chancePercent}% target odds` }]
    : [])];
  const refreshDestinations = () => {
    const targets = navigationTargets();
    if (destinations.options.length !== targets.length + 1) destinations.replaceChildren(new Option("Choose a destination…", ""), ...targets.map(target => new Option(target.name, target.id)));
    targets.forEach((target, index) => {
      destinations.options[index + 1]!.text = target.name + (target.id === "home" || target.id === "smith" || target.id === "mine" || target.id === "equipment-hunt" || target.id === CHAMPION_WAYPOINT.id || target.id === ASHEN_SPIRE_WAYPOINT.id || target.id === MISTFEN_WAYPOINT.id || target.id === GREENWOOD_WAYPOINT.id || target.id === WARDEN_GATE_WAYPOINT.id ? "" : ` — ${mineralStatusLabel(statuses.get(target.id), Date.now())}`);
    });
    destinations.value = waypoint?.id ?? "";
  };
  refreshDestinations();
  homeButton.addEventListener("click", () => { setWaypoint(HOME_WAYPOINT); homeButton.blur(); });
  surfaceButton.addEventListener("click", () => {
    const next = !surfaceGuide;
    setWaypoint(null);
    surfaceGuide = next;
    surfaceButton.setAttribute("aria-pressed", String(next));
    surfaceButton.blur();
  });
  for (const control of [homeButton, surfaceButton, destinations, document.querySelector<HTMLButtonElement>("#waypoint-clear")!]) {
    control.addEventListener("keydown", event => {
      if (control === destinations || (event instanceof KeyboardEvent && (event.code === "Space" || event.code === "Enter"))) event.stopPropagation();
    });
  }
  destinations.addEventListener("change", () => {
    setWaypoint(navigationTargets().find(target => target.id === destinations.value) ?? null);
    destinations.blur();
  });
  document.querySelector<HTMLButtonElement>("#waypoint-clear")!.addEventListener("click", () => setWaypoint(null));
  canvas.addEventListener("click", event => {
    if (!lastPlayer) return;
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * MAP_SIZE / bounds.width;
    const y = (event.clientY - bounds.top) * MAP_SIZE / bounds.height;
    if (dungeonState) {
      const point = dungeonPingAtMapClick(lastPlayer, x, y);
      if (point) pingHandler?.(point.x, point.z);
      return;
    }
    const huntWaypoint = equipmentHunt ? navigationTargets().find(target => target.id === "equipment-hunt") ?? null : null;
    const huntPoint = huntWaypoint ? mapPoint(lastPlayer, huntWaypoint) : null;
    const target = huntWaypoint && huntPoint && Math.hypot(huntPoint.x - x, huntPoint.y - y) <= 14
      ? huntWaypoint : waypointAtMapPoint(lastPlayer, x, y, discovered, wardenGateUnlocked);
    if (target) setWaypoint(target);
  });
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = MAP_SIZE * ratio; canvas.height = MAP_SIZE * ratio;
  const surfaceTerrainCanvas = document.createElement("canvas");
  surfaceTerrainCanvas.width = surfaceTerrainCanvas.height = SURFACE_TERRAIN_SIZE;
  const surfaceTerrainContext = surfaceTerrainCanvas.getContext("2d");
  const surfaceTerrainPixels = surfaceTerrainContext?.createImageData(SURFACE_TERRAIN_SIZE, SURFACE_TERRAIN_SIZE);
  return {
    setChampionState(value) { champion = value; },
    setEliteStates(values) { elites = values; },
    setThreatState(value) { threat = value; lastUpdate = -Infinity; },
    setWardenGateUnlocked(unlocked) {
      if (wardenGateUnlocked === unlocked) return;
      wardenGateUnlocked = unlocked; refreshDestinations(); lastUpdate = -Infinity;
    },
    setMistfenMastery(rank) {
      if (rank <= 0) return;
      let changed = false;
      for (const key of [MISTFEN_WAYPOINT.id, miniBossDiscoveryKey("mistfen-behemoth")]) {
        if (!discovered.has(key)) { discovered.add(key); changed = true; }
      }
      if (rank >= 1) for (const deposit of MAP_DEPOSITS) {
        if (deposit.block !== Block.SilverOre || Math.hypot(deposit.x - MISTFEN_WAYPOINT.x, deposit.z - MISTFEN_WAYPOINT.z) > 42) continue;
        const key = depositKey(deposit); if (!discovered.has(key)) { discovered.add(key); changed = true; }
      }
      if (!changed) return;
      refreshDestinations(); lastUpdate = -Infinity;
      try { localStorage.setItem(storageKey, JSON.stringify([...discovered])); } catch { /* Private browsing can disable storage. */ }
    },
    setGreenwoodMastery(rank) {
      if (rank <= 0) return;
      let changed = false;
      for (const key of [GREENWOOD_WAYPOINT.id, miniBossDiscoveryKey("wild-crawler")]) {
        if (!discovered.has(key)) { discovered.add(key); changed = true; }
      }
      if (!changed) return;
      refreshDestinations(); lastUpdate = -Infinity;
      try { localStorage.setItem(storageKey, JSON.stringify([...discovered])); } catch { /* Private browsing can disable storage. */ }
    },
    setEquipmentHunt(target) {
      const changed = equipmentHunt?.affixId !== target?.affixId || equipmentHunt?.regionId !== target?.regionId;
      equipmentHunt = target;
      refreshDestinations(); lastUpdate = -Infinity;
      if (!changed) return;
      if (target) setWaypoint({ x: target.x, y: target.y, z: target.z, id: "equipment-hunt",
        name: `${target.regionName} · ${target.chancePercent}% target odds` });
      else if (waypoint?.id === "equipment-hunt") setWaypoint(null);
    },
    setCaveState(state) { caveState = state; },
    setDungeonState(state) {
      dungeonState = state;
      if (!state) { dungeonPings.clear(); dungeonGates = null; dungeonCache = null; cachedRouteKey = ""; }
      if (panel && panel.dataset.dungeon !== String(state !== null)) {
        panel.dataset.dungeon = String(state !== null);
        panel.querySelector<HTMLElement>("#minimap-title")!.textContent = state ? "SILVER DEPTHS MAP" : "EXPLORER MAP";
      }
    },
    setDungeonGateStatus(status) {
      dungeonGates = status; cachedRouteKey = ""; lastUpdate = -Infinity;
    },
    setDungeonCacheStatus(status: SilverDepthsCacheStatus) {
      dungeonCache = status; lastUpdate = -Infinity;
    },
    setDungeonPing(ping) {
      if (!Number.isFinite(ping.x + ping.z) || ping.durationMs <= 0) return;
      dungeonPings.set(ping.senderId, { ...ping, expiresAt: performance.now() + Math.min(8000, ping.durationMs) });
      lastUpdate = -Infinity;
    },
    setPingHandler(handler) { pingHandler = handler; },
    guideTo(target) { setWaypoint(target); },
    clearGuide(expectedId) { if (!expectedId || waypoint?.id === expectedId) setWaypoint(null); },
    surfaceGuideEnabled() { return surfaceGuide; },
    setMineralStatus(values) {
      statuses.clear();
      for (const value of values) statuses.set(value.id, value);
      refreshDestinations();
      lastUpdate = -Infinity;
    },
    update(player, yaw, now, visible, cameraYaw = 0, active = true) {
      if (now - lastUpdate < 100 || !Number.isFinite(player.x + player.y + player.z + yaw)) return;
      lastUpdate = now;
      lastPlayer = { x: player.x, y: player.y, z: player.z };
      if (dungeonState) {
        const state = dungeonState;
        const routeKey = dungeonGates ? `${Math.floor(player.x)},${Math.floor(player.z)}:${Math.floor(state.objective.x)},${Math.floor(state.objective.z)}:${Object.values(dungeonGates).join(",")}` : "";
        if (routeKey !== cachedRouteKey) {
          cachedRouteKey = routeKey;
          cachedRoute = dungeonGates ? silverDepthsMapRoute(player, state.objective, dungeonGates) : null;
        }
        for (const [id, ping] of dungeonPings) if (ping.expiresAt <= now) dungeonPings.delete(id);
        const pings = [...dungeonPings.values()];
        const points = dungeonMapPoints(player, state);
        depthLabel.textContent = "SILVER DEPTHS · FLOOR 1";
        surfaceButton.hidden = true;
        guide.hidden = true;
        const distance = Math.round(Math.hypot(state.objective.x - player.x, state.objective.z - player.z));
        const newestPing = pings.at(-1);
        const routeDescription = !dungeonGates ? "Checking gates" : !cachedRoute ? "No route" : cachedRoute.reachesObjective ? "Route open" : "Route blocked by a closed gate";
        const cacheHint = !dungeonCache ? "" : dungeonCache.phase === "sealed"
          ? ` · Optional cache: mine wall ore for ${dungeonCache.quantity} ${ITEM_DEFINITIONS[dungeonCache.itemId].name}`
          : dungeonCache.phase === "warning" ? " · CACHE AMBUSH INCOMING · retreat west toward the gate"
          : dungeonCache.phase === "fighting" ? ` · CACHE GUARDS ${dungeonCache.guardsRemaining} LEFT · west lane open`
          : ` · Cache secured · collect ${dungeonCache.quantity} ${ITEM_DEFINITIONS[dungeonCache.itemId].name} at the seam`;
        detail.textContent = `Next: ${state.objective.title} · ${distance}m · ${routeDescription}${cacheHint}${newestPing ? ` · ${newestPing.senderName} pinged` : ""} · Click map to ping`;
        canvas.setAttribute("aria-label", `Silver Depths map. Next: ${state.objective.title}, ${distance} metres away. ${routeDescription}. ${points.teammates.map(teammate => `${teammate.name} ${teammate.state}`).join(", ") || "No teammates on this floor"}.`);
        if (!visible || !context) return;
        const ctx = context, scale = MAP_SIZE / (MAP_RANGE * 2);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
        ctx.fillStyle = "#100c19"; ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
        for (const room of SILVER_DEPTHS_ROOMS) {
          const x = MAP_SIZE / 2 + (room.minX - player.x) * scale;
          const y = MAP_SIZE / 2 + (room.minZ - player.z) * scale;
          const width = (room.maxX - room.minX + 1) * scale;
          const height = (room.maxZ - room.minZ + 1) * scale;
          ctx.fillStyle = "#413452"; ctx.fillRect(x, y, width, height);
          ctx.strokeStyle = "#a277c17a"; ctx.lineWidth = 1; ctx.strokeRect(x, y, width, height);
        }
        if (cachedRoute?.points.length) {
          ctx.beginPath(); ctx.moveTo(MAP_SIZE / 2, MAP_SIZE / 2);
          for (const point of cachedRoute.points)
            ctx.lineTo(MAP_SIZE / 2 + (point.x - player.x) * scale, MAP_SIZE / 2 + (point.z - player.z) * scale);
          if (cachedRoute.reachesObjective)
            ctx.lineTo(MAP_SIZE / 2 + (state.objective.x - player.x) * scale, MAP_SIZE / 2 + (state.objective.z - player.z) * scale);
          ctx.strokeStyle = "#ffe18a"; ctx.lineWidth = 2.5; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
        }
        for (const gate of SILVER_DEPTHS_MAP_GATES) {
          const middle = mapPoint(player, { x: (gate.start.x + gate.end.x) / 2, z: (gate.start.z + gate.end.z) / 2 });
          if (middle.offscreen) continue;
          const start = mapPoint(player, gate.start), end = mapPoint(player, gate.end);
          const known = dungeonGates !== null;
          const open = dungeonGates?.[gate.id] === true;
          ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y);
          ctx.strokeStyle = !known ? "#a6a1b4" : open ? "#76dfad" : "#ff806f"; ctx.lineWidth = open ? 3 : 5; ctx.stroke();
          ctx.fillStyle = !known ? "#e0d9ec" : open ? "#a8f9cb" : "#ffc0b5"; ctx.font = "bold 8px system-ui"; ctx.textAlign = "center";
          ctx.fillText(`${gate.label} ${!known ? "…" : open ? "OPEN" : "LOCKED"}`, middle.x, middle.y - 7);
        }
        if (dungeonCache) {
          const cache = mapPoint(player, { x: dungeonCache.x + .5, z: dungeonCache.z + .5 });
          ctx.fillStyle = dungeonCache.phase === "warning" || dungeonCache.phase === "fighting" ? "#ff806f"
            : dungeonCache.wing === "iron" ? "#ffc177" : "#bcecff";
          ctx.strokeStyle = "#251536"; ctx.lineWidth = 2;
          ctx.fillRect(cache.x - 5, cache.y - 5, 10, 10);
          ctx.strokeRect(cache.x - 5, cache.y - 5, 10, 10);
          ctx.font = "bold 8px system-ui"; ctx.textAlign = "center";
          ctx.fillText(dungeonCache.phase === "fighting" ? `GUARDS ${dungeonCache.guardsRemaining}`
            : dungeonCache.phase === "warning" ? "AMBUSH" : dungeonCache.phase === "cleared" ? "CACHE LOOT" : "ORE CACHE", cache.x, cache.y - 10);
        }
        const center = MAP_SIZE / 2, target = points.objective;
        ctx.beginPath(); ctx.moveTo(target.x, target.y - 8); ctx.lineTo(target.x + 8, target.y);
        ctx.lineTo(target.x, target.y + 8); ctx.lineTo(target.x - 8, target.y); ctx.closePath();
        ctx.fillStyle = "#ffcb71"; ctx.strokeStyle = "#251536"; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
        if (target.offscreen) { ctx.beginPath(); ctx.arc(target.x, target.y, 11, 0, Math.PI * 2); ctx.strokeStyle = "#ffcb71"; ctx.stroke(); }
        for (const teammate of points.teammates) {
          ctx.beginPath(); ctx.arc(teammate.x, teammate.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = teammate.state === "fallen" ? "#ff917e" : "#8edfff";
          ctx.strokeStyle = "#110b1b"; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
          if (teammate.offscreen) { ctx.beginPath(); ctx.arc(teammate.x, teammate.y, 10, 0, Math.PI * 2); ctx.strokeStyle = ctx.fillStyle; ctx.stroke(); }
          ctx.fillStyle = "#f7efff"; ctx.font = "bold 9px system-ui"; ctx.textAlign = "center";
          ctx.fillText(teammate.name.slice(0, 10), teammate.x, teammate.y - 10);
        }
        for (const ping of pings) {
          const point = mapPoint(player, ping);
          const pulse = 8 + Math.sin(now / 180) * 2;
          ctx.beginPath(); ctx.arc(point.x, point.y, pulse, 0, Math.PI * 2);
          ctx.strokeStyle = "#79f6c1"; ctx.lineWidth = 2; ctx.stroke();
          ctx.beginPath(); ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = "#b4ffe1"; ctx.fill();
          ctx.fillStyle = "#dcfff2"; ctx.font = "bold 9px system-ui"; ctx.textAlign = "center";
          ctx.fillText(`${ping.senderName.slice(0, 10)} PING`, point.x, point.y - 13);
          if (point.offscreen) { ctx.beginPath(); ctx.arc(point.x, point.y, 12, 0, Math.PI * 2); ctx.stroke(); }
        }
        const facing = mapFacing(yaw);
        ctx.beginPath(); ctx.moveTo(center + facing.x * 9, center + facing.y * 9);
        ctx.lineTo(center - facing.x * 5 + facing.y * 5, center - facing.y * 5 - facing.x * 5);
        ctx.lineTo(center - facing.x * 5 - facing.y * 5, center - facing.y * 5 + facing.x * 5); ctx.closePath();
        ctx.fillStyle = "#fff8da"; ctx.strokeStyle = "#100c19"; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#fff8da"; ctx.textAlign = "center"; ctx.font = "bold 11px system-ui"; ctx.fillText("N", center, 13);
        return;
      }
      const underground = caveDepth(player.y) > 0;
      const nearbyThreat = nearbyThreatMapTarget(player, threat);
      if (!underground) {
        const region = surfaceMapRegionAt(player.x, player.z);
        if (!visitedRegions.has(region.id)) {
          visitedRegions.add(region.id);
          try { localStorage.setItem(visitedRegionsKey, JSON.stringify([...visitedRegions])); } catch { /* Private browsing can disable storage. */ }
          if (region.id !== "town") onRegionDiscovered?.(region.name);
        }
      }
      depthLabel.textContent = underground ? `UNDERGROUND · DEPTH ${caveDepth(player.y)} BLOCKS` : "SURFACE";
      surfaceButton.hidden = !underground;
      if (!underground && surfaceGuide) setWaypoint(null);
      const second = Math.floor(Date.now() / 1000);
      if (second !== lastStatusSecond) { lastStatusSecond = second; refreshDestinations(); }
      const depositsChanged = discoverDeposits(player, discovered);
      const championChanged = discoverChampion(player, champion, discovered);
      const miniBossesChanged = discoverMiniBosses(player, elites, discovered);
      const spireChanged = discoverAshenSpire(player, discovered);
      const mistfenChanged = discoverMistfen(player, discovered);
      const landmarksChanged = discoverRoadsideLandmarks(player, discovered);
      if (depositsChanged || championChanged || miniBossesChanged || spireChanged || mistfenChanged || landmarksChanged) {
        refreshDestinations();
        try { localStorage.setItem(storageKey, JSON.stringify([...discovered])); } catch { /* Private browsing can disable storage. */ }
      }
      if (waypoint) {
        const direction = waypointDirection(player, waypoint, cameraYaw);
        if (direction.arrived) {
          const name = waypoint.name;
          setWaypoint(null);
          detail.textContent = `Arrived · ${name}`;
        } else {
          guide.hidden = !active;
          guideArrow.hidden = underground;
          guideArrow.style.transform = `rotate(${direction.angle}deg)`;
          guideDistance.textContent = underground ? "Use Guide to surface first" : `${Math.ceil(direction.distance)}m`;
        }
      }
      if (surfaceGuide) {
        guide.hidden = !active;
        guideName.textContent = "Return to surface";
        const next = caveState.route[1];
        guideArrow.hidden = !next;
        if (next) {
          const direction = waypointDirection(player, { ...next, id: "exit", name: "Return stairs" }, cameraYaw);
          guideArrow.style.transform = `rotate(${direction.angle}deg)`;
          const climb = next.y > Math.floor(player.y + 0.1);
          guideDistance.textContent = `${caveState.route.length - 1} steps · ${climb ? "climb the next stair" : "follow the explored path"}`;
        } else guideDistance.textContent = "No explored route · check nearby stairs or obstacles";
      }
      if (!visible || !context) return;
      const ctx = context;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
      ctx.fillStyle = underground ? "#071310" : "#482329"; ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
      const scale = MAP_SIZE / (MAP_RANGE * 2);
      if (!underground && surfaceTerrainContext && surfaceTerrainPixels) {
        const pixels = surfaceTerrainPixels.data;
        for (let py = 0; py < SURFACE_TERRAIN_SIZE; py++) {
          const worldZ = player.z + (py * 2 + 1 - MAP_SIZE / 2) / scale;
          for (let px = 0; px < SURFACE_TERRAIN_SIZE; px++) {
            const worldX = player.x + (px * 2 + 1 - MAP_SIZE / 2) / scale;
            const color = surfaceMapColorAt(worldX, worldZ, visitedRegions);
            const offset = (py * SURFACE_TERRAIN_SIZE + px) * 4;
            pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2]; pixels[offset + 3] = 255;
          }
        }
        surfaceTerrainContext.putImageData(surfaceTerrainPixels, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(surfaceTerrainCanvas, 0, 0, MAP_SIZE, MAP_SIZE);
      }
      if (underground) {
        ctx.fillStyle = "#354a49";
        for (const key of caveState.known) {
          const [wx, wz] = key.split(",").map(Number);
          const x = MAP_SIZE / 2 + (wx! - player.x) * scale, z = MAP_SIZE / 2 + (wz! - player.z) * scale;
          ctx.fillRect(x, z, scale + 0.2, scale + 0.2);
        }
      }
      ctx.strokeStyle = "#ffffff0b";
      for (let i = 0; i < MAP_SIZE; i += 22) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, MAP_SIZE); ctx.moveTo(0, i); ctx.lineTo(MAP_SIZE, i); ctx.stroke();
      }
      const marker = (point: Position, label: string, color: string, square: boolean, showAtEdge = false, glyph = "") => {
        const p = mapPoint(player, point);
        if (p.offscreen && !showAtEdge) return;
        ctx.fillStyle = color; ctx.strokeStyle = "#071514"; ctx.lineWidth = 2;
        ctx.beginPath();
        if (square) ctx.rect(p.x - 5, p.y - 5, 10, 10); else ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        if (glyph) {
          ctx.fillStyle = "#111b17"; ctx.font = "bold 8px system-ui"; ctx.textAlign = "center";
          ctx.fillText(glyph, p.x, p.y + 3);
        }
        if (label) {
          ctx.fillStyle = color; ctx.strokeStyle = "#071514"; ctx.lineWidth = 3;
          ctx.font = "bold 9px system-ui"; ctx.textAlign = "center";
          ctx.strokeText(label, p.x, p.y - 9); ctx.fillText(label, p.x, p.y - 9);
        }
        if (p.offscreen) { ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke(); }
      };
      if (!underground) {
        const staticMarker = (target: Waypoint, shortLabel: string, color: string, glyph: string, edge = false) =>
          marker(target, mapMarkerLabelVisible(player, target, waypoint?.id === target.id) ? shortLabel : "", color, true, edge, glyph);
        staticMarker(HOME_WAYPOINT, "HOME", "#abe3a0", "H", true);
        staticMarker({ ...TOWN_BLACKSMITH_STALL_POSITION, id: "smith", name: "Blacksmith" }, "SMITH", "#ffd173", "S");
        if (discovered.has(CHAMPION_WAYPOINT.id) && (waypoint?.id === CHAMPION_WAYPOINT.id
          || Math.hypot(player.x - CHAMPION_WAYPOINT.x, player.z - CHAMPION_WAYPOINT.z) <= MAP_THREAT_DISPLAY_RADIUS))
          staticMarker(CHAMPION_WAYPOINT, "CHAMPION", "#ffcf65", "♛");
        if (discovered.has(ASHEN_SPIRE_WAYPOINT.id)) staticMarker(ASHEN_SPIRE_WAYPOINT, "ASH SPIRE", "#ff8b58", "A");
        if (discovered.has(MISTFEN_WAYPOINT.id)) staticMarker(MISTFEN_WAYPOINT, "MISTFEN", "#a8d789", "M");
        if (discovered.has(GREENWOOD_WAYPOINT.id)) staticMarker(GREENWOOD_WAYPOINT, "GREENWOOD", "#c6d977", "G");
        if (wardenGateUnlocked) staticMarker(WARDEN_GATE_WAYPOINT, "WARDEN GATE", "#ffe06f", "W", true);
        if (equipmentHunt) staticMarker({ x: equipmentHunt.x, y: equipmentHunt.y, z: equipmentHunt.z,
          id: "equipment-hunt", name: equipmentHunt.regionName }, "AFFIX HUNT", "#e59cff", "◆", true);
        for (const landmark of ROADSIDE_DISCOVERIES) {
          if (!discovered.has(roadsideDiscoveryKey(landmark.id))) continue;
          marker(landmark, mapMarkerLabelVisible(player, landmark, false) ? landmark.name.toUpperCase() : "",
            "#e4cd94", false, false, "·");
        }
      }
      const nearbyCombatTargets = [...nearbyDiscoveredMiniBossTargets(player, elites, discovered), ...activeEliteMapTargets(player, elites)]
        .filter((target, index, values) => values.findIndex(candidate => candidate.id === target.id) === index)
        .filter(target => !nearbyThreat || Math.hypot(target.x - nearbyThreat.x, target.z - nearbyThreat.z) > 1.5);
      for (const cluster of clusterThreatMapTargets(nearbyCombatTargets)) {
        if (cluster.members.length > 1) marker(cluster, "", "#ffc95f", false, false, String(cluster.members.length));
        else {
          const target = cluster.members[0]!;
          const leader = target.isMiniBoss === true;
          marker(target, mapMarkerLabelVisible(player, target, false) ? target.name.slice(0, 18).toUpperCase() : "",
            leader ? "#ffc95f" : "#e890ff", leader, false, leader ? "♛" : "★");
        }
      }
      if (nearbyThreat) {
        const p = mapPoint(player, nearbyThreat);
        const pulse = 9 + Math.sin(now / 150) * 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, pulse, 0, Math.PI * 2); ctx.strokeStyle = "#ff806f"; ctx.lineWidth = 2; ctx.stroke();
        const championTarget = isPathChampionName(nearbyThreat.name);
        marker(nearbyThreat, nearbyThreat.name.slice(0, 20).toUpperCase(), championTarget ? "#ffd55f" : "#ff806f", championTarget, false, championTarget ? "♛" : "!");
      }
      const mineTarget = { ...MINE_ENTRANCE, id: "mine", name: "Mine" };
      marker(mineTarget, mapMarkerLabelVisible(player, mineTarget, waypoint?.id === "mine") ? "MINE" : "", "#ffe08c", true, false, "M");
      for (const chamber of caveState.chambers) marker(chamber,
        mapMarkerLabelVisible(player, chamber, false) ? `${chamber.label} · D${caveDepth(chamber.y)}` : "", "#a3dfeb", false, false, "○");
      for (const deposit of underground ? [] : MAP_DEPOSITS) {
        if (!discovered.has(depositKey(deposit))) continue;
        const silver = deposit.block === Block.SilverOre;
        const recovering = statuses.get(depositKey(deposit))?.available === 0;
        const selected = waypoint?.id === depositKey(deposit);
        marker(deposit, mapMarkerLabelVisible(player, deposit, selected) ? `${silver ? "SILVER" : "IRON"}${recovering ? " · R" : ""}` : "",
          recovering ? "#8c929a" : silver ? "#b4eaff" : "#e3a76b", false, false, silver ? "Ag" : "Fe");
      }
      if (surfaceGuide && caveState.route.length > 1) {
        ctx.beginPath();
        caveState.route.forEach((point, i) => {
          const p = mapPoint(player, point);
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        });
        ctx.strokeStyle = "#ffe08c"; ctx.lineWidth = 2; ctx.stroke();
      }
      if (waypoint && !underground) {
        const p = mapPoint(player, waypoint);
        ctx.beginPath(); ctx.moveTo(MAP_SIZE / 2, MAP_SIZE / 2); ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = "#fff4ad88"; ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.strokeStyle = "#fff4ad"; ctx.lineWidth = 2; ctx.stroke();
      }
      const x = MAP_SIZE / 2, y = MAP_SIZE / 2;
      const facing = mapFacing(yaw), fx = facing.x, fy = facing.y;
      ctx.beginPath(); ctx.moveTo(x + fx * 9, y + fy * 9);
      ctx.lineTo(x - fx * 5 + fy * 5, y - fy * 5 - fx * 5);
      ctx.lineTo(x - fx * 5 - fy * 5, y - fy * 5 + fx * 5); ctx.closePath();
      ctx.fillStyle = "#fff8da"; ctx.strokeStyle = "#111b17"; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff8da"; ctx.textAlign = "center"; ctx.font = "bold 11px system-ui"; ctx.fillText("N", x, 13);
      const distance = Math.round(Math.hypot(player.x - TOWN_CENTER_X, player.z - TOWN_CENTER_Z));
      const depositCount = MAP_DEPOSITS.filter(point => discovered.has(depositKey(point))).length;
      const threatDetail = nearbyThreat ? ` · Nearby threat: ${nearbyThreat.name}` : "";
      const territory = surfaceMapRegionAt(player.x, player.z).name.toUpperCase();
      detail.textContent = `${underground ? `Depth ${caveDepth(player.y)} · ${caveState.chambers.length} chambers discovered` : `${territory} · ${distance}m from town · ${depositCount} deposits found`}${threatDetail}`;
      canvas.setAttribute("aria-label", `North-up ${underground ? `underground map at depth ${caveDepth(player.y)}, explored cells only` : "surface map"}. ${caveState.chambers.length} chambers discovered.${nearbyThreat ? ` Nearby threat: ${nearbyThreat.name}.` : ""} White arrow shows your facing.`);
    },
  };
}
