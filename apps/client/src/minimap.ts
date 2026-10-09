import { Block, GREENWOOD_IRON_SEAM, MINERAL_DEPOSITS, SURFACE_HEIGHT, TOWN_CENTER_X, TOWN_CENTER_Z, TOWN_BLACKSMITH_STALL_POSITION, TOWN_SAFE_RADIUS, WILDS_MINIMUM_RADIUS, FRONTIER_MINIMUM_RADIUS } from "@blockcraft/voxel-world";

export const MAP_SIZE = 220;
export const MAP_RANGE = 72;
export const DISCOVERY_RADIUS = 10;
type Position = { x: number; z: number };
export const MAP_DEPOSITS = [...MINERAL_DEPOSITS, { x: (GREENWOOD_IRON_SEAM.minX + GREENWOOD_IRON_SEAM.maxX) / 2, z: (GREENWOOD_IRON_SEAM.minZ + GREENWOOD_IRON_SEAM.maxZ) / 2, block: Block.IronOre }];
export const depositKey = (deposit: Position): string => `${deposit.x},${deposit.z}`;
export const mapFacing = (yaw: number): { x: number; y: number } => ({ x: Math.sin(yaw * Math.PI / 180), y: Math.cos(yaw * Math.PI / 180) });
export type Waypoint = Position & { y: number; id: string; name: string };
export const HOME_WAYPOINT: Waypoint = { x: TOWN_CENTER_X, z: TOWN_CENTER_Z, y: SURFACE_HEIGHT + 1, id: "home", name: "Town of Beginnings" };
export function knownWaypoints(discovered: Set<string>): Waypoint[] {
  return [HOME_WAYPOINT, { ...TOWN_BLACKSMITH_STALL_POSITION, id: "smith", name: "Blacksmith" },
    ...MAP_DEPOSITS.filter(point => discovered.has(depositKey(point))).map(point => ({ ...point, y: SURFACE_HEIGHT + 1, id: depositKey(point), name: `${point.block === Block.SilverOre ? "Silver" : "Iron"} deposit (${point.x}, ${point.z})` }))];
}
export function waypointAtMapPoint(player: Position, x: number, y: number, discovered: Set<string>): Waypoint | null {
  let closest: Waypoint | null = null, distance = 14;
  for (const target of knownWaypoints(discovered)) {
    const p = mapPoint(player, target);
    if (target.id === "smith" && p.offscreen) continue;
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
    return new Set(Array.isArray(values) ? values.filter((value): value is string => typeof value === "string" && allowed.has(value)) : []);
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
  update(player: Position & { y: number }, yaw: number, now: number, visible: boolean, cameraYaw?: number, active?: boolean): void;
} {
  const context = canvas.getContext("2d");
  let discovered: Set<string>;
  try { discovered = parseDiscoveries(localStorage.getItem(storageKey)); } catch { discovered = new Set(); }
  let lastUpdate = -Infinity;
  let lastPlayer: (Position & { y: number }) | null = null;
  let waypoint: Waypoint | null = null;
  const homeButton = document.querySelector<HTMLButtonElement>("#minimap-home")!;
  const destinations = document.querySelector<HTMLSelectElement>("#minimap-destination")!;
  const guide = document.querySelector<HTMLElement>("#waypoint-guide")!;
  const guideName = document.querySelector<HTMLElement>("#waypoint-name")!;
  const guideDistance = document.querySelector<HTMLElement>("#waypoint-distance")!;
  const guideArrow = document.querySelector<HTMLElement>("#waypoint-arrow")!;
  const setWaypoint = (target: Waypoint | null) => {
    waypoint = target; lastUpdate = -Infinity;
    destinations.value = target?.id ?? "";
    guide.hidden = target === null;
    if (target) { guideName.textContent = target.name; guideDistance.textContent = "Guiding…"; }
  };
  const refreshDestinations = () => {
    destinations.replaceChildren(new Option("Choose a destination…", ""), ...knownWaypoints(discovered).map(target => new Option(target.name, target.id)));
    destinations.value = waypoint?.id ?? "";
  };
  refreshDestinations();
  homeButton.addEventListener("click", () => setWaypoint(HOME_WAYPOINT));
  for (const control of [homeButton, destinations, document.querySelector<HTMLButtonElement>("#waypoint-clear")!]) {
    control.addEventListener("keydown", event => event.stopPropagation());
  }
  destinations.addEventListener("change", () => setWaypoint(knownWaypoints(discovered).find(target => target.id === destinations.value) ?? null));
  document.querySelector<HTMLButtonElement>("#waypoint-clear")!.addEventListener("click", () => setWaypoint(null));
  canvas.addEventListener("click", event => {
    if (!lastPlayer) return;
    const bounds = canvas.getBoundingClientRect();
    const target = waypointAtMapPoint(lastPlayer, (event.clientX - bounds.left) * MAP_SIZE / bounds.width, (event.clientY - bounds.top) * MAP_SIZE / bounds.height, discovered);
    if (target) setWaypoint(target);
  });
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = MAP_SIZE * ratio; canvas.height = MAP_SIZE * ratio;
  return {
    update(player, yaw, now, visible, cameraYaw = 0, active = true) {
      if (now - lastUpdate < 100 || !Number.isFinite(player.x + player.y + player.z + yaw)) return;
      lastUpdate = now;
      lastPlayer = { x: player.x, y: player.y, z: player.z };
      if (discoverDeposits(player, discovered)) {
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
          guideArrow.style.transform = `rotate(${direction.angle}deg)`;
          guideDistance.textContent = `${Math.ceil(direction.distance)}m${Math.abs(player.y - waypoint.y) > 1.6 ? " · return to surface" : ""}`;
        }
      }
      if (!visible || !context) return;
      const ctx = context;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
      ctx.fillStyle = "#482329"; ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
      // Draw the real radial zones in world coordinates, not the clamped marker coordinates.
      const scale = MAP_SIZE / (MAP_RANGE * 2);
      const townX = MAP_SIZE / 2 + (TOWN_CENTER_X - player.x) * scale;
      const townY = MAP_SIZE / 2 + (TOWN_CENTER_Z - player.z) * scale;
      for (const [radius, fill] of [[FRONTIER_MINIMUM_RADIUS, "#52432a"], [WILDS_MINIMUM_RADIUS, "#465038"], [TOWN_SAFE_RADIUS, "#234a3c"]] as const) {
        ctx.beginPath(); ctx.arc(townX, townY, radius * scale, 0, Math.PI * 2);
        ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = "#dfd1a344"; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.strokeStyle = "#ffffff0b";
      for (let i = 0; i < MAP_SIZE; i += 22) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, MAP_SIZE); ctx.moveTo(0, i); ctx.lineTo(MAP_SIZE, i); ctx.stroke();
      }
      const marker = (point: Position, label: string, color: string, square: boolean) => {
        const p = mapPoint(player, point);
        if (p.offscreen && label === "SMITH") return;
        ctx.fillStyle = color; ctx.strokeStyle = "#071514"; ctx.lineWidth = 2;
        ctx.beginPath();
        if (square) ctx.rect(p.x - 4, p.y - 4, 8, 8); else ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.font = "bold 10px system-ui"; ctx.textAlign = "center";
        ctx.strokeText(label, p.x, p.y - 8); ctx.fillText(label, p.x, p.y - 8);
        if (p.offscreen) { ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke(); }
      };
      marker({ x: TOWN_CENTER_X, z: TOWN_CENTER_Z }, "HOME", "#abe3a0", true);
      marker(TOWN_BLACKSMITH_STALL_POSITION, "SMITH", "#ffd173", true);
      for (const deposit of MAP_DEPOSITS) {
        if (!discovered.has(depositKey(deposit))) continue;
        const silver = deposit.block === Block.SilverOre;
        marker(deposit, silver ? "Ag" : "Fe", silver ? "#b4eaff" : "#e3a76b", false);
      }
      if (waypoint) {
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
      detail.textContent = `${distance}m from town · ${discovered.size} deposits found${player.y < SURFACE_HEIGHT - 1 ? " · underground" : ""}`;
      canvas.setAttribute("aria-label", `North-up map. Town ${distance} metres away. ${discovered.size} mineral deposits discovered. White arrow shows your facing.`);
    },
  };
}
