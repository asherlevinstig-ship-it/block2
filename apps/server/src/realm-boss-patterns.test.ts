import { describe, expect, it } from "vitest";
import { ASHGLASS_ORACLE_ID, GREENWOOD_MATRIARCH_ID, REALM_WARDEN_ID, STONEHEART_LORD_ID,
  fallingRockSites, realmBossPattern, realmBossPhase, usesFallingRockZones, usesRockVolley } from "./realm-boss-patterns.js";
import { spitterShotOffsets } from "@blockcraft/protocol";

describe("realm boss patterns", () => {
  it("advances through three health phases", () => {
    expect(realmBossPhase(90, 90)).toBe(1);
    expect(realmBossPhase(60, 90)).toBe(2);
    expect(realmBossPhase(30, 90)).toBe(3);
  });

  it("gives each public boss a readable identity", () => {
    expect(realmBossPattern(GREENWOOD_MATRIARCH_ID, 1, 20, 24)).toBe("fan");
    expect(realmBossPattern(STONEHEART_LORD_ID, 0, 32, 32)).toBe("rocks");
    expect(realmBossPattern(ASHGLASS_ORACLE_ID, 0, 10, 36)).toBe("teleport-burst");
    expect(realmBossPattern(REALM_WARDEN_ID, 0, 18, 60)).toBe("warden-barrage");
  });

  it("classifies rock volleys and leaves gaps between marked impacts", () => {
    expect(usesRockVolley("falling-rocks")).toBe(true);
    expect(usesRockVolley("toxic-eruption")).toBe(true);
    expect(usesFallingRockZones("warden-barrage")).toBe(true);
    const sites = fallingRockSites({ x: 10, y: 8, z: 10 }, 0);
    expect(sites).toHaveLength(3);
    expect(Math.hypot(sites[1]!.x - sites[2]!.x, sites[1]!.z - sites[2]!.z)).toBeGreaterThan(5);
    const barrage = fallingRockSites({ x: 10, y: 8, z: 10 }, 0, 4);
    expect(new Set(barrage.map(site => `${site.x.toFixed(2)}:${site.z.toFixed(2)}`))).toHaveLength(4);
  });

  it("keeps radial projectile patterns evenly spaced with dodge gaps", () => {
    expect(spitterShotOffsets("venom-ring")).toHaveLength(8);
    expect(spitterShotOffsets("teleport-burst")).toHaveLength(6);
    expect(spitterShotOffsets("venom-ring")).not.toContain(0);
  });
});
