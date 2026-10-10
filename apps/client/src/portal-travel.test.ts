import { describe, expect, it } from "vitest";
import { portalArrivalSnapshot } from "./portal-travel.js";
describe("portal movement handoff", () => {
  it("ignores delayed wilderness snapshots until the arrival patch is received", () => {
    const destination = { x: 160.5, y: 8, z: 165.5 };
    expect(portalArrivalSnapshot(destination, { x: 46.5, y: 8, z: 28.5 })).toBe(false);
    expect(portalArrivalSnapshot(destination, destination)).toBe(true);
    expect(portalArrivalSnapshot(destination, { ...destination, x: 161 })).toBe(true);
  });
  it("also ignores old dungeon patches during return travel", () => {
    expect(portalArrivalSnapshot({ x: 46.5, y: 8, z: 28.5 }, { x: 160.5, y: 8, z: 165.5 })).toBe(false);
  });
});
