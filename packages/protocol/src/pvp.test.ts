import { describe, expect, it } from "vitest";
import { PVP_MURDERER_DURATION_MS, pvpCombatAllowed, pvpEnabledAt, pvpMurdererUntil,
  withPvpMurdererUntil } from "./pvp.js";

describe("tower PvP zones", () => {
  const sanctuary = { x: 305, z: 106, health: 5 };
  const rampart = { x: 340, z: 106, health: 5 };
  it("keeps Floor 0, the tavern and the Floor 1 sanctuary protected", () => {
    expect(pvpEnabledAt("practice", { x: 100, z: 106 })).toBe(false);
    expect(pvpEnabledAt("tavern", rampart)).toBe(false);
    expect(pvpEnabledAt("practice", sanctuary)).toBe(false);
  });
  it("allows combat only when both living players are in the dungeon combat zone", () => {
    expect(pvpCombatAllowed("practice", rampart, { ...rampart, x: 342 })).toBe(true);
    expect(pvpCombatAllowed("practice", rampart, sanctuary)).toBe(false);
    expect(pvpCombatAllowed("practice", rampart, { ...rampart, health: 0 })).toBe(false);
  });
  it("marks killers for exactly three days", () => {
    expect(PVP_MURDERER_DURATION_MS).toBe(259_200_000);
  });
  it("keeps the mark inside the existing progression envelope", () => {
    const until = 1_000 + PVP_MURDERER_DURATION_MS;
    const updated = withPvpMurdererUntil(JSON.stringify({ loadouts: [{ slot: 1 }], buildPath: { selectedPathId: "mage" } }), until);
    expect(pvpMurdererUntil(updated)).toBe(until);
    expect(JSON.parse(updated)).toMatchObject({ loadouts: [{ slot: 1 }], buildPath: { selectedPathId: "mage" } });
  });
});
