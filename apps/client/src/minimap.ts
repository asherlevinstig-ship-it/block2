import { ASHEN_SPIRE_POSITION, Block, REALM_WARDEN_GATE_POSITION, RENEWABLE_MINERAL_DEPOSITS, SILVER_DEPTHS_ROOMS, silverDepthsPingLocation, SURFACE_HEIGHT, TOWN_CENTER_X, TOWN_CENTER_Z, TOWN_BLACKSMITH_STALL_POSITION, TOWN_SAFE_RADIUS, WILDS_MINIMUM_RADIUS, FRONTIER_MINIMUM_RADIUS } from "@blockcraft/voxel-world";
import { ITEM_DEFINITIONS, type MineralDepositStatus, type SilverDepthsCacheStatus, type SilverDepthsGateStatus, type SilverDepthsPing } from "@blockcraft/protocol";
import { MINE_ENTRANCE, caveDepth, type CaveMapState } from "./cave-navigation.js";
import { SILVER_DEPTHS_MAP_GATES, silverDepthsMapRoute, type DungeonMapRoute } from "./silver-depths-navigation.js";

export const MAP_SIZE = 220;
export const MAP_RANGE = 72;
export const DISCOVERY_RADIUS = 10;
export const THREAT_GUIDANCE_RADIUS = 28;
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
export function activeEliteMapTargets(player: Position & { y: number }, elites: readonly EliteMapTarget[]): EliteMapTarget[] {
  return elites.filter(elite => elite.alive && elite.isElite && Math.abs(elite.y - player.y) <= 2.5);
}
export const miniBossDiscoveryKey = (id: string): string => `leader:${id}`;
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

export function createMinimap(canvas: HTMLCanvasElement, detail: HTMLElement, storageKey: string): {
  setChampionState(champion: (Position & { y: number; alive: boolean }) | null): void;
  setEliteStates(elites: EliteMapTarget[]): void;
  setThreatState(threat: ThreatMapTarget | null): void;
  setWardenGateUnlocked(unlocked: boolean): void;
  setMineralStatus(statuses: MineralDepositStatus[]): void;
  setCaveState(state: CaveMapState): void;
  setDungeonState(state: DungeonMapState | null): void;
  setDungeonGateStatus(status: SilverDepthsGateStatus): void;
  setDungeonCacheStatus(status: SilverDepthsCacheStatus): void;
  setDungeonPing(ping: SilverDepthsPing): void;
  setPingHandler(handler: (x: number, z: number) => void): void;
  surfaceGuideEnabled(): boolean;
  update(player: Position & { y: number }, yaw: number, now: number, visible: boolean, cameraYaw?: number, active?: boolean): void;
} {
  const context = canvas.getContext("2d");
  let discovered: Set<string>;
  try { discovered = parseDiscoveries(localStorage.getItem(storageKey)); } catch { discovered = new Set(); }
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
  const refreshDestinations = () => {
    const targets = knownWaypoints(discovered, wardenGateUnlocked);
    if (destinations.options.length !== targets.length + 1) destinations.replaceChildren(new Option("Choose a destination…", ""), ...targets.map(target => new Option(target.name, target.id)));
    targets.forEach((target, index) => {
      destinations.options[index + 1]!.text = target.name + (target.id === "home" || target.id === "smith" || target.id === "mine" || target.id === CHAMPION_WAYPOINT.id || target.id === ASHEN_SPIRE_WAYPOINT.id || target.id === WARDEN_GATE_WAYPOINT.id ? "" : ` — ${mineralStatusLabel(statuses.get(target.id), Date.now())}`);
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
    setWaypoint(knownWaypoints(discovered, wardenGateUnlocked).find(target => target.id === destinations.value) ?? null);
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
    const target = waypointAtMapPoint(lastPlayer, x, y, discovered, wardenGateUnlocked);
    if (target) setWaypoint(target);
  });
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = MAP_SIZE * ratio; canvas.height = MAP_SIZE * ratio;
  return {
    setChampionState(value) { champion = value; },
    setEliteStates(values) { elites = values; },
    setThreatState(value) { threat = value; lastUpdate = -Infinity; },
    setWardenGateUnlocked(unlocked) {
      if (wardenGateUnlocked === unlocked) return;
      wardenGateUnlocked = unlocked; refreshDestinations(); lastUpdate = -Infinity;
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
      depthLabel.textContent = underground ? `UNDERGROUND · DEPTH ${caveDepth(player.y)} BLOCKS` : "SURFACE";
      surfaceButton.hidden = !underground;
      if (!underground && surfaceGuide) setWaypoint(null);
      const second = Math.floor(Date.now() / 1000);
      if (second !== lastStatusSecond) { lastStatusSecond = second; refreshDestinations(); }
      const depositsChanged = discoverDeposits(player, discovered);
      const championChanged = discoverChampion(player, champion, discovered);
      const miniBossesChanged = discoverMiniBosses(player, elites, discovered);
      const spireChanged = discoverAshenSpire(player, discovered);
      if (depositsChanged || championChanged || miniBossesChanged || spireChanged) {
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
      // Draw the real radial zones in world coordinates, not the clamped marker coordinates.
      const scale = MAP_SIZE / (MAP_RANGE * 2);
      const townX = MAP_SIZE / 2 + (TOWN_CENTER_X - player.x) * scale;
      const townY = MAP_SIZE / 2 + (TOWN_CENTER_Z - player.z) * scale;
      for (const [radius, fill] of (underground ? [] : [[FRONTIER_MINIMUM_RADIUS, "#52432a"], [WILDS_MINIMUM_RADIUS, "#465038"], [TOWN_SAFE_RADIUS, "#234a3c"]]) as [number, string][]) {
        ctx.beginPath(); ctx.arc(townX, townY, radius * scale, 0, Math.PI * 2);
        ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = "#dfd1a344"; ctx.lineWidth = 1; ctx.stroke();
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
      const marker = (point: Position, label: string, color: string, square: boolean, showAtEdge = false) => {
        const p = mapPoint(player, point);
        if (p.offscreen && label !== "HOME" && !showAtEdge) return;
        ctx.fillStyle = color; ctx.strokeStyle = "#071514"; ctx.lineWidth = 2;
        ctx.beginPath();
        if (square) ctx.rect(p.x - 4, p.y - 4, 8, 8); else ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.font = "bold 10px system-ui"; ctx.textAlign = "center";
        const labelY = label === "♛ CHAMP" ? p.y + 18 : p.y - 8;
        ctx.strokeText(label, p.x, labelY); ctx.fillText(label, p.x, labelY);
        if (p.offscreen) { ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke(); }
      };
      if (!underground) {
        marker({ x: TOWN_CENTER_X, z: TOWN_CENTER_Z }, "HOME", "#abe3a0", true);
        marker(TOWN_BLACKSMITH_STALL_POSITION, "SMITH", "#ffd173", true);
        if (discovered.has(CHAMPION_WAYPOINT.id)) marker(CHAMPION_WAYPOINT, "♛ CHAMP", "#ffcf65", true);
        if (discovered.has(ASHEN_SPIRE_WAYPOINT.id)) marker(ASHEN_SPIRE_WAYPOINT, "ASH SPIRE", "#ff8b58", true);
        if (wardenGateUnlocked) marker(WARDEN_GATE_WAYPOINT, "WARDEN GATE", "#ffe06f", true, true);
        for (const elite of activeEliteMapTargets(player, elites)) marker(elite, "★ ELITE", "#e890ff", false, true);
      }
      for (const leader of discoveredMiniBossTargets(elites, discovered)) if (Math.abs(leader.y - player.y) <= 2.5)
        marker(leader, leader.alive ? "♛ LEADER" : "LEADER · DOWN", leader.alive ? "#ffc95f" : "#77827c", true, true);
      if (nearbyThreat) marker(nearbyThreat, "⚔ THREAT", "#ff806f", false);
      marker(MINE_ENTRANCE, "MINE", "#ffe08c", true);
      for (const chamber of caveState.chambers) marker(chamber, `${chamber.label} · D${caveDepth(chamber.y)}`, "#a3dfeb", false);
      for (const deposit of underground ? [] : MAP_DEPOSITS) {
        if (!discovered.has(depositKey(deposit))) continue;
        const silver = deposit.block === Block.SilverOre;
        const recovering = statuses.get(depositKey(deposit))?.available === 0;
        marker(deposit, `${silver ? "Ag" : "Fe"}${recovering ? " · R" : ""}`, recovering ? "#8c929a" : silver ? "#b4eaff" : "#e3a76b", false);
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
      detail.textContent = `${underground ? `Depth ${caveDepth(player.y)} · ${caveState.chambers.length} chambers discovered` : `${distance}m from town · ${depositCount} deposits found`}${threatDetail}`;
      canvas.setAttribute("aria-label", `North-up ${underground ? `underground map at depth ${caveDepth(player.y)}, explored cells only` : "surface map"}. ${caveState.chambers.length} chambers discovered.${nearbyThreat ? ` Nearby threat: ${nearbyThreat.name}.` : ""} White arrow shows your facing.`);
    },
  };
}
