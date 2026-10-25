import { describe, expect, it } from "vitest";
import { FAST_WORLD_ENCOUNTER_NAVIGATION, GREENWOOD_ENCOUNTER_NAVIGATION, MISTFEN_ENCOUNTER_NAVIGATION,
  ASHEN_REACH_ENCOUNTER_NAVIGATION,
  fastWorldEncounterAllows, fastWorldMistfenBoardwalkAt, fastWorldMistfenToxicAt,
  fastWorldNavigationGroundAllows, fastWorldSpawnAllows, SUNKEN_COAST_ENCOUNTER_NAVIGATION,
  fastWorldAshenLavaAt, fastWorldEruptingHeatVentAt, fastWorldHeatVentPhase,
  fastWorldSunkenCoastSandbarAt, fastWorldSunkenCoastTideAt,
  SOUTHERN_QUARRY_ENCOUNTER_NAVIGATION, ARCHIVED_FAST_WORLD_COLLISION_QUERY } from "@blockcraft/protocol";
import { playerCollides } from "@blockcraft/voxel-world";
import { obstacleQueryReader } from "../src/world-collision.js";
import { fastWorldFiringSites, fastWorldPatrolDestination } from "../src/fast-world-navigation.js";

const FAST_WORLD_BLOCK_READER = obstacleQueryReader(ARCHIVED_FAST_WORLD_COLLISION_QUERY);

describe("Greenwood authored navigation", () => {
  it("gives every encounter bounded spawns and purposeful combat nodes", () => {
    expect(GREENWOOD_ENCOUNTER_NAVIGATION).toHaveLength(5);
    for (const encounter of GREENWOOD_ENCOUNTER_NAVIGATION) {
      expect(encounter.spawnRadius).toBeLessThan(encounter.leashRadius);
      expect(encounter.nodes.filter(node => node.kind === "patrol").length).toBeGreaterThanOrEqual(2);
      expect(encounter.nodes.some(node => node.kind === "flank")).toBe(true);
      for (const mobId of encounter.encounterIds) {
        expect(fastWorldSpawnAllows(mobId, encounter.center)).toBe(true);
        expect(fastWorldEncounterAllows(mobId, { x: encounter.center.x + encounter.leashRadius + 1, z: encounter.center.z })).toBe(false);
      }
    }
  });

  it("selects patrol anchors which are supported and outside scenery", () => {
    for (const encounter of GREENWOOD_ENCOUNTER_NAVIGATION) for (const mobId of encounter.encounterIds) {
      const destination = fastWorldPatrolDestination(mobId, 0, FAST_WORLD_BLOCK_READER,
        pose => fastWorldEncounterAllows(mobId, pose));
      expect(destination, mobId).not.toBeNull();
      expect(playerCollides(FAST_WORLD_BLOCK_READER, destination!.x, destination!.y, destination!.z), mobId).toBe(false);
    }
  });

  it("offers a clear authored firing perch when one exists", () => {
    const mobId = "greenwood-root-thornbinder";
    const mob = { x: 130.5, y: 8, z: 123 };
    const target = { x: 128.5, y: 8, z: 121 };
    const sites = fastWorldFiringSites(mobId, mob, target, FAST_WORLD_BLOCK_READER,
      pose => fastWorldEncounterAllows(mobId, pose));
    expect(sites.length).toBeGreaterThan(0);
    expect(sites.every(site => !playerCollides(FAST_WORLD_BLOCK_READER, site.x, site.y, site.z))).toBe(true);
  });

  it("authors all five Mistfen pockets with dry patrol, flank and firing choices", () => {
    expect(MISTFEN_ENCOUNTER_NAVIGATION).toHaveLength(5);
    expect(FAST_WORLD_ENCOUNTER_NAVIGATION).toHaveLength(22);
    for (const encounter of MISTFEN_ENCOUNTER_NAVIGATION) {
      expect(encounter.nodes.filter(node => node.kind === "patrol").length).toBeGreaterThanOrEqual(2);
      expect(encounter.nodes.some(node => node.kind === "flank")).toBe(true);
      for (const mobId of encounter.encounterIds) for (const node of encounter.nodes)
        expect(fastWorldNavigationGroundAllows(mobId, node), `${mobId}:${node.id}`).toBe(true);
    }
  });

  it("treats toxic water as blocked navigation but keeps visible boardwalks safe", () => {
    expect(fastWorldMistfenToxicAt(169, 59)).toBe(true);
    expect(fastWorldMistfenBoardwalkAt(169, 59)).toBe(true);
    expect(fastWorldNavigationGroundAllows("mistfen-drowned-spitter", { x: 158, z: 43 })).toBe(false);
    expect(fastWorldNavigationGroundAllows("mistfen-drowned-spitter", { x: 169, z: 59 })).toBe(true);
  });

  it("gives Miremother escorts distinct approach roles", () => {
    const basin = MISTFEN_ENCOUNTER_NAVIGATION.find(encounter => encounter.id === "miremother-basin")!;
    expect(basin.nodes.filter(node => node.kind === "flank")).toHaveLength(2);
    expect(basin.nodes.filter(node => node.kind === "firing")).toHaveLength(1);
    for (const mobId of basin.encounterIds) {
      const destination = fastWorldPatrolDestination(mobId, 1, FAST_WORLD_BLOCK_READER,
        pose => fastWorldEncounterAllows(mobId, pose) && fastWorldNavigationGroundAllows(mobId, pose));
      expect(destination, mobId).not.toBeNull();
    }
  });

  it("authors three coast encounters and a role-based Tidecaller shoal", () => {
    expect(SUNKEN_COAST_ENCOUNTER_NAVIGATION).toHaveLength(4);
    for (const encounter of SUNKEN_COAST_ENCOUNTER_NAVIGATION) {
      expect(encounter.nodes.filter(node => node.kind === "patrol")).toHaveLength(2);
      expect(encounter.nodes.some(node => node.kind === "flank")).toBe(true);
      for (const mobId of encounter.encounterIds) for (const navNode of encounter.nodes)
        expect(fastWorldNavigationGroundAllows(mobId, navNode), `${mobId}:${navNode.id}`).toBe(true);
    }
    const shoal = SUNKEN_COAST_ENCOUNTER_NAVIGATION.find(encounter => encounter.id === "tidecaller-shoal")!;
    expect(shoal.nodes.some(node => node.kind === "firing")).toBe(true);
    expect(shoal.nodes.filter(node => node.kind === "flank")).toHaveLength(2);
  });

  it("keeps coast mobs out of deep tide lanes while allowing visible sandbars", () => {
    expect(fastWorldSunkenCoastTideAt(47, 170)).toBe(true);
    expect(fastWorldNavigationGroundAllows("coast-spitter-a", { x: 47, z: 170 })).toBe(false);
    expect(fastWorldSunkenCoastSandbarAt(51.5, 159)).toBe(true);
    expect(fastWorldNavigationGroundAllows("coast-spitter-a", { x: 51.5, z: 159 })).toBe(true);
  });

  it("authors the Quarry as three shelf fights and a coordinated leader pit", () => {
    expect(SOUTHERN_QUARRY_ENCOUNTER_NAVIGATION).toHaveLength(4);
    for (const encounter of SOUTHERN_QUARRY_ENCOUNTER_NAVIGATION) {
      expect(encounter.nodes.filter(node => node.kind === "patrol")).toHaveLength(2);
      expect(encounter.nodes.some(node => node.kind === "flank")).toBe(true);
      for (const navNode of encounter.nodes)
        expect(playerCollides(FAST_WORLD_BLOCK_READER, navNode.x, 8, navNode.z), navNode.id).toBe(false);
      for (const mobId of encounter.encounterIds) {
        expect(fastWorldSpawnAllows(mobId, encounter.center)).toBe(true);
        const destination = fastWorldPatrolDestination(mobId, 0, FAST_WORLD_BLOCK_READER,
          pose => fastWorldEncounterAllows(mobId, pose));
        expect(destination, mobId).not.toBeNull();
      }
    }
    const pit = SOUTHERN_QUARRY_ENCOUNTER_NAVIGATION.find(encounter => encounter.id === "quarrymaster-pit")!;
    expect(pit.nodes.filter(node => node.kind === "firing")).toHaveLength(1);
    expect(pit.nodes.filter(node => node.kind === "flank")).toHaveLength(2);
  });

  it("authors three Ashen warbands and a safe-lane Cinderlord caldera", () => {
    expect(ASHEN_REACH_ENCOUNTER_NAVIGATION).toHaveLength(4);
    for (const encounter of ASHEN_REACH_ENCOUNTER_NAVIGATION) for (const navNode of encounter.nodes) {
      expect(fastWorldAshenLavaAt(navNode.x, navNode.z), navNode.id).toBe(false);
      expect(playerCollides(FAST_WORLD_BLOCK_READER, navNode.x, 8, navNode.z), navNode.id).toBe(false);
    }
    const caldera = ASHEN_REACH_ENCOUNTER_NAVIGATION.find(encounter => encounter.id === "cinderlord-caldera")!;
    expect(caldera.nodes.some(node => node.kind === "firing")).toBe(true);
    expect(caldera.nodes.filter(node => node.kind === "flank")).toHaveLength(2);
  });

  it("cycles heat vents through a readable warning before damaging eruption", () => {
    expect(fastWorldHeatVentPhase(0, 3_499)).toBe("idle");
    expect(fastWorldHeatVentPhase(0, 3_500)).toBe("warning");
    expect(fastWorldHeatVentPhase(0, 4_800)).toBe("erupting");
    expect(fastWorldEruptingHeatVentAt(218, 94, 4_800)).toBe(true);
    expect(fastWorldEruptingHeatVentAt(218, 94, 3_600)).toBe(false);
  });
});
