import { describe, expect, it } from "vitest";
import { activeEliteMapTargets, clusterThreatMapTargets, discoveredMiniBossTargets, discoverMiniBosses, miniBossDiscoveryKey, mineralStatusLabel, discoverChampion, CHAMPION_WAYPOINT, ASHEN_SPIRE_WAYPOINT, MISTFEN_WAYPOINT, WARDEN_GATE_WAYPOINT, discoverAshenSpire, discoverMistfen, discoverRoadsideLandmarks, roadsideDiscoveryKey, isPathChampionName, mapMarkerLabelVisible, nearbyDiscoveredMiniBossTargets, nearbyThreatMapTarget, THREAT_GUIDANCE_RADIUS } from "./minimap.js";
import { ROADSIDE_DISCOVERIES, SURFACE_HEIGHT } from "@blockcraft/voxel-world";
import { HOME_WAYPOINT, MAP_DEPOSITS, MAP_SIZE, DISCOVERY_RADIUS, clampWorldMapRange, depositKey, discoverDeposits, dungeonMapPoints, dungeonPingAtMapClick, knownWaypoints, mapPoint, mapFacing, panWorldMapCenter, parseDiscoveries, parseExploredSurfaceCells, parseVisitedSurfaceRegions, revealSurfaceCells, surfaceCellExplored, surfaceMapColorAt, surfaceMapRegionAt, waypointAtMapPoint, waypointDirection } from "./minimap.js";

describe("north-up explorer minimap", () => {
  it("draws authored terrain and roads rather than only distance rings", () => {
    expect(surfaceMapColorAt(8.5, 8.5)).toEqual([35, 74, 60]);
    expect(surfaceMapColorAt(39.5, 18.5)).toEqual([38, 82, 45]);
    expect(surfaceMapColorAt(20.5, 70.5)).toEqual([111, 88, 60]);
    expect(surfaceMapColorAt(2.5, 101.5)).toEqual([116, 66, 52]);
    expect(surfaceMapColorAt(8.5, 70.5)).toEqual([165, 137, 85]);
    expect(surfaceMapColorAt(21.5, -60.5)).toEqual([67, 81, 88]);
    expect(surfaceMapColorAt(97.5, 62.5)).toEqual([106, 65, 50]);
    expect(surfaceMapColorAt(-30.5, -26.5)).toEqual([176, 152, 96]);
  });
  it("remembers visited regions while keeping unseen terrain muted", () => {
    expect(surfaceMapRegionAt(8.5, 8.5).id).toBe("town");
    expect(surfaceMapRegionAt(20.5, 70.5).name).toBe("Sunfall Quarry");
    expect(surfaceMapRegionAt(2.5, 101.5).id).toBe("redstone");
    expect(surfaceMapRegionAt(21.5, -60.5).id).toBe("northwatch");
    const visited = parseVisitedSurfaceRegions('["town","quarry","unknown",4]');
    expect(visited).toEqual(new Set(["town", "quarry"]));
    expect(parseVisitedSurfaceRegions("not json").size).toBe(0);
    expect(surfaceMapColorAt(20.5, 70.5, visited)).toEqual(surfaceMapColorAt(20.5, 70.5));
    expect(surfaceMapColorAt(2.5, 101.5, visited)).not.toEqual(surfaceMapColorAt(2.5, 101.5));
    expect(surfaceMapColorAt(8.5, 100.5, visited)).not.toEqual(surfaceMapColorAt(8.5, 100.5));
  });
  it("reveals and permanently remembers a trail through surface fog", () => {
    const explored = parseExploredSurfaceCells('["1,1","bad","2.5,4",7]');
    expect(explored).toEqual(new Set(["1,1"]));
    expect(surfaceCellExplored(8.5, 8.5, explored)).toBe(true);
    expect(surfaceCellExplored(40.5, 40.5, explored)).toBe(false);
    expect(revealSurfaceCells({ x: 40.5, z: 40.5 }, explored)).toBe(true);
    expect(surfaceCellExplored(40.5, 40.5, explored)).toBe(true);
    expect(revealSurfaceCells({ x: 40.5, z: 40.5 }, explored)).toBe(false);
    expect(parseExploredSurfaceCells(JSON.stringify([...explored]))).toEqual(explored);
    expect(parseExploredSurfaceCells("not json").size).toBe(0);
  });
  it("reveals dynamic threat guidance only when nearby on the same floor", () => {
    const threat = { x: 20, y: 8, z: 0, name: "Realm Warden" };
    expect(nearbyThreatMapTarget({ x: 0, y: 8, z: 0 }, threat)).toEqual(threat);
    expect(nearbyThreatMapTarget({ x: 20 + THREAT_GUIDANCE_RADIUS + .1, y: 8, z: 0 }, threat)).toBeNull();
    expect(nearbyThreatMapTarget({ x: 20, y: 3, z: 0 }, threat)).toBeNull();
  });
  it("shows living same-floor elites without permanently discovering them", () => {
    const player = { x: 0, y: 8, z: 0 };
    const elite = { id: "elite", name: "Volatile Spitter", x: 20, y: 8, z: 0, alive: true, isElite: true };
    expect(activeEliteMapTargets(player, [elite, { ...elite, id: "dead", alive: false }, { ...elite, id: "below", y: 3 }, { ...elite, id: "distant", x: 40 }]))
      .toEqual([elite]);
  });
  it("permanently reveals an area leader only after the player approaches it", () => {
    const known = new Set<string>();
    const leader = { id: "wild-crawler", name: "Greenwood Broodmother", x: 20, y: 8, z: 0,
      alive: true, isElite: false, isMiniBoss: true };
    expect(discoverMiniBosses({ x: 0, y: 8, z: 0 }, [leader], known)).toBe(false);
    expect(discoverMiniBosses({ x: 11, y: 8, z: 0 }, [leader], known)).toBe(true);
    expect(discoveredMiniBossTargets([{ ...leader, alive: false }], known)).toEqual([{ ...leader, alive: false }]);
    expect(parseDiscoveries(JSON.stringify([...known]))).toEqual(new Set([miniBossDiscoveryKey(leader.id)]));
    expect(nearbyDiscoveredMiniBossTargets({ x: 0, y: 8, z: 0 }, [leader], known)).toEqual([leader]);
    expect(nearbyDiscoveredMiniBossTargets({ x: -10, y: 8, z: 0 }, [leader], known)).toEqual([]);
  });
  it("clusters overlapping threats and reserves names for selected or approached markers", () => {
    const base = { id: "a", name: "Alpha", x: 10, y: 8, z: 10, alive: true, isElite: true };
    const clusters = clusterThreatMapTargets([base, { ...base, id: "b", x: 13 }, { ...base, id: "c", x: 30 }]);
    expect(clusters.map(cluster => cluster.members.length)).toEqual([2, 1]);
    expect(mapMarkerLabelVisible({ x: 0, z: 0 }, base, false)).toBe(false);
    expect(mapMarkerLabelVisible({ x: 2, z: 10 }, base, false)).toBe(true);
    expect(mapMarkerLabelVisible({ x: 0, z: 0 }, base, true)).toBe(true);
  });
  it("recognises the three contract champions for crown markers", () => {
    expect(isPathChampionName("Razorhide Pack Sovereign")).toBe(true);
    expect(isPathChampionName("Viridian Brood Oracle")).toBe(true);
    expect(isPathChampionName("Worldsplitter Colossus")).toBe(true);
    expect(isPathChampionName("Mossback Alpha")).toBe(false);
  });
  it("reveals the Ashen Reach spire only when approached on the surface", () => {
    const known = new Set<string>();
    expect(discoverAshenSpire({ ...ASHEN_SPIRE_WAYPOINT, x: ASHEN_SPIRE_WAYPOINT.x + 19 }, known)).toBe(false);
    expect(discoverAshenSpire({ ...ASHEN_SPIRE_WAYPOINT, y: 3 }, known)).toBe(false);
    expect(discoverAshenSpire(ASHEN_SPIRE_WAYPOINT, known)).toBe(true);
    expect(discoverAshenSpire(ASHEN_SPIRE_WAYPOINT, known)).toBe(false);
    expect(knownWaypoints(known)).toContainEqual(ASHEN_SPIRE_WAYPOINT);
    expect(parseDiscoveries(JSON.stringify([...known]))).toEqual(known);
  });
  it("reveals Mistfen only when approached on the surface and remembers it", () => {
    const known = new Set<string>();
    expect(discoverMistfen({ ...MISTFEN_WAYPOINT, x: MISTFEN_WAYPOINT.x + 22.1 }, known)).toBe(false);
    expect(discoverMistfen({ ...MISTFEN_WAYPOINT, y: 3 }, known)).toBe(false);
    expect(discoverMistfen(MISTFEN_WAYPOINT, known)).toBe(true);
    expect(discoverMistfen(MISTFEN_WAYPOINT, known)).toBe(false);
    expect(knownWaypoints(known)).toContainEqual(MISTFEN_WAYPOINT);
    expect(parseDiscoveries(JSON.stringify([...known]))).toEqual(known);
  });
  it("shows the permanent Warden Gate waypoint only after the saved first clear", () => {
    const known = new Set<string>();
    expect(knownWaypoints(known, false)).not.toContainEqual(WARDEN_GATE_WAYPOINT);
    expect(knownWaypoints(known, true)).toContainEqual(WARDEN_GATE_WAYPOINT);
    const point = mapPoint(WARDEN_GATE_WAYPOINT, WARDEN_GATE_WAYPOINT);
    expect(waypointAtMapPoint(WARDEN_GATE_WAYPOINT, point.x, point.y, known, true)).toEqual(WARDEN_GATE_WAYPOINT);
  });
  it("reveals the champion only when alive and nearby on the surface", () => {
    const known = new Set<string>(); const champion = { ...CHAMPION_WAYPOINT, alive: true };
    expect(discoverChampion({ ...champion, x: champion.x + 11 }, champion, known)).toBe(false);
    expect(discoverChampion({ ...champion, y: 3 }, champion, known)).toBe(false);
    expect(discoverChampion(champion, { ...champion, alive: false }, known)).toBe(false);
    expect(discoverChampion(champion, null, known)).toBe(false);
    expect(discoverChampion(champion, champion, known)).toBe(true);
    expect(discoverChampion(champion, champion, known)).toBe(false);
    expect(parseDiscoveries(JSON.stringify([...known]))).toEqual(known);
    expect(knownWaypoints(known)).toContainEqual(CHAMPION_WAYPOINT);
    expect(waypointAtMapPoint(champion, MAP_SIZE / 2, MAP_SIZE / 2, known)).toEqual(CHAMPION_WAYPOINT);
  });
  it("labels available, recovering and occupied deposits", () => {
    expect(mineralStatusLabel({ id: "35,-5", available: 2, total: 18, readyAt: 5000 }, 1000)).toBe("Available · 2/18");
    expect(mineralStatusLabel({ id: "35,-5", available: 0, total: 18, readyAt: 5000 }, 1000)).toBe("Recovering · 4s");
    expect(mineralStatusLabel({ id: "35,-5", available: 0, total: 18, readyAt: 5000 }, 6000)).toContain("waiting for space");
    expect(mineralStatusLabel(undefined, 1000)).toBe("Unknown");
  });
  it("never exposes or selects undiscovered deposits", () => {
    const discovered = new Set<string>();
    expect(knownWaypoints(discovered).map(target => target.id)).toEqual(["home", "smith", "mine"]);
    const deposit = MAP_DEPOSITS[0]!;
    const player = { x: deposit.x, z: deposit.z };
    expect(waypointAtMapPoint(player, MAP_SIZE / 2, MAP_SIZE / 2, discovered)).toBeNull();
    discovered.add(depositKey(deposit));
    expect(waypointAtMapPoint(player, MAP_SIZE / 2, MAP_SIZE / 2, discovered)?.id).toBe(depositKey(deposit));
    expect(knownWaypoints(discovered)).toHaveLength(4);
  });
  it("selects known markers on the edge and ignores empty map clicks", () => {
    const player = { x: 200, z: 200 };
    const p = mapPoint(player, HOME_WAYPOINT);
    expect(waypointAtMapPoint(player, p.x, p.y, new Set())?.id).toBe("home");
    expect(waypointAtMapPoint(player, 200, 200, new Set())).toBeNull();
  });
  it("uses a camera-relative guide without changing the north-up map", () => {
    const player = { x: 0, y: 8, z: 0 };
    const target = { ...HOME_WAYPOINT, x: 0, z: -10 };
    const north = waypointDirection(player, target, Math.PI / 2);
    expect(north.angle).toBeCloseTo(0); expect(north.distance).toBe(10);
    expect(north.arrived).toBe(false);
    expect(waypointDirection(player, target, 0).angle).toBeCloseTo(90);
  });
  it("arrives only near the waypoint on its floor, not directly underneath it", () => {
    expect(waypointDirection({ ...HOME_WAYPOINT, x: HOME_WAYPOINT.x + 2 }, HOME_WAYPOINT, 0).arrived).toBe(true);
    expect(waypointDirection({ ...HOME_WAYPOINT, y: 3 }, HOME_WAYPOINT, 0).arrived).toBe(false);
    expect(waypointDirection({ ...HOME_WAYPOINT, x: HOME_WAYPOINT.x + 3 }, HOME_WAYPOINT, 0).arrived).toBe(false);
  });
  it("centres the player and preserves world directions regardless of camera rotation", () => {
    const player = { x: 8.5, z: 8.5 };
    expect(mapPoint(player, player)).toEqual({ x: MAP_SIZE / 2, y: MAP_SIZE / 2, offscreen: false });
    expect(mapPoint(player, { x: 18.5, z: 8.5 }).x).toBeGreaterThan(MAP_SIZE / 2);
    expect(mapPoint(player, { x: 8.5, z: -1.5 }).y).toBeLessThan(MAP_SIZE / 2);
    expect(mapFacing(0).y).toBeCloseTo(1);
    expect(mapFacing(90).x).toBeCloseTo(1);
    expect(mapFacing(180).y).toBeCloseTo(-1);
    expect(mapFacing(-90).x).toBeCloseTo(-1);
    expect(mapFacing(450).x).toBeCloseTo(mapFacing(90).x);
  });
  it("pans and zooms the expanded world map without following the player", () => {
    expect(clampWorldMapRange(20)).toBe(55);
    expect(clampWorldMapRange(150)).toBe(150);
    expect(clampWorldMapRange(500)).toBe(220);
    expect(panWorldMapCenter({ x: 20, z: 30 }, { x: 100, z: -50 }, 110, 220))
      .toEqual({ x: -80, z: 80 });
    const fixedCenter = { x: 20, z: 30 };
    expect(mapPoint(fixedCenter, { x: 20, z: 30 }, 150)).toEqual({ x: MAP_SIZE / 2, y: MAP_SIZE / 2, offscreen: false });
    expect(mapPoint(fixedCenter, { x: 30, z: 30 }, 150).x).toBeGreaterThan(MAP_SIZE / 2);
  });
  it("keeps distant town markers on the map edge without reversing their bearing", () => {
    const point = mapPoint({ x: 200, z: 200 }, { x: 8.5, z: 8.5 });
    expect(point.offscreen).toBe(true);
    expect(point.x).toBe(14); expect(point.y).toBe(14);
  });
  it("plots the Silver Depths objective and same-floor teammates without losing distant bearings", () => {
    const player = { x: 63.5, y: 1, z: 12.5 };
    const points = dungeonMapPoints(player, { objective: { x: 137.5, z: 14.5, title: "Extract" }, teammates: [
      { id: "ally", name: "Ally", x: 70.5, y: 1, z: 12.5, state: "fighting" },
      { id: "fallen", name: "Fallen", x: 100.5, y: 1, z: 20.5, state: "fallen" },
      { id: "elsewhere", name: "Elsewhere", x: 68.5, y: 8, z: 12.5, state: "fighting" },
    ] });
    expect(points.objective.offscreen).toBe(true);
    expect(points.objective.x).toBeGreaterThan(MAP_SIZE / 2);
    expect(points.teammates.map(teammate => teammate.id)).toEqual(["ally", "fallen"]);
    expect(points.teammates[0]!.x).toBeGreaterThan(MAP_SIZE / 2);
  });
  it("converts dungeon map clicks to playable world cells and ignores empty space", () => {
    const player = { x: 63.5, z: 12.5 };
    expect(dungeonPingAtMapClick(player, MAP_SIZE / 2, MAP_SIZE / 2)).toEqual(player);
    const gallery = mapPoint(player, { x: 95.5, z: 14.5 });
    expect(dungeonPingAtMapClick(player, gallery.x, gallery.y)).toEqual({ x: 95.5, z: 14.5 });
    expect(dungeonPingAtMapClick(player, 0, 0)).toBeNull();
    expect(dungeonPingAtMapClick(player, -1, 100)).toBeNull();
  });
  it("reveals deposits only nearby at surface height and remembers them after departure", () => {
    const discovered = new Set<string>();
    expect(discoverDeposits({ x: 8.5, y: 8, z: 8.5 }, discovered)).toBe(false);
    const deposit = MAP_DEPOSITS[0]!;
    expect(discoverDeposits({ x: deposit.x, y: 3, z: deposit.z }, discovered)).toBe(false);
    expect(discoverDeposits({ x: deposit.x + DISCOVERY_RADIUS + 0.1, y: 8, z: deposit.z }, discovered)).toBe(false);
    expect(discoverDeposits({ x: deposit.x + DISCOVERY_RADIUS, y: 8, z: deposit.z }, discovered)).toBe(true);
    expect(discovered.has(depositKey(deposit))).toBe(true);
    expect(discoverDeposits({ x: 8.5, y: 8, z: 8.5 }, discovered)).toBe(false);
    expect(discovered.size).toBe(1);
    expect(parseDiscoveries(JSON.stringify([...discovered]))).toEqual(discovered);
  });
  it("quietly records roadside landmarks as permanent map knowledge", () => {
    const discovered = new Set<string>();
    const landmark = ROADSIDE_DISCOVERIES.find(site => site.id === "greenwood-root-arch")!;
    expect(discoverRoadsideLandmarks({ x: landmark.x, y: SURFACE_HEIGHT + 1, z: landmark.z - 9.1 }, discovered)).toBe(false);
    expect(discoverRoadsideLandmarks({ x: landmark.x, y: 3, z: landmark.z }, discovered)).toBe(false);
    expect(discoverRoadsideLandmarks({ x: landmark.x, y: SURFACE_HEIGHT + 1, z: landmark.z }, discovered)).toBe(true);
    expect(discovered).toEqual(new Set([roadsideDiscoveryKey(landmark.id)]));
    expect(discoverRoadsideLandmarks({ x: landmark.x, y: SURFACE_HEIGHT + 1, z: landmark.z }, discovered)).toBe(false);
    expect(parseDiscoveries(JSON.stringify([...discovered]))).toEqual(discovered);
  });
  it("rejects corrupt and unknown saved discovery IDs", () => {
    expect(parseDiscoveries("broken").size).toBe(0);
    expect(parseDiscoveries('{"fake":true}').size).toBe(0);
    expect(parseDiscoveries('["secret",123,null]').size).toBe(0);
    expect(parseDiscoveries(JSON.stringify([depositKey(MAP_DEPOSITS[0]!), "fake"])).size).toBe(1);
  });
});
