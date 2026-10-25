import { describe, expect, it } from "vitest";
import { GREENWOOD_ENCOUNTER_NAVIGATION, fastWorldEncounterAllows, fastWorldSpawnAllows } from "@blockcraft/protocol";
import { playerCollides } from "@blockcraft/voxel-world";
import { FAST_WORLD_BLOCK_READER } from "../src/world-collision.js";
import { fastWorldFiringSites, fastWorldPatrolDestination } from "../src/fast-world-navigation.js";

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
});
