import { describe, expect, it } from "vitest";
import { TAVERN_ROOM_ZONES } from "./tavern-room.js";

describe("Hearth & Hammer room composition", () => {
  it("keeps a central arrival lane and separates its three activity zones", () => {
    expect(TAVERN_ROOM_ZONES.entrance.x).toBe(0);
    expect(TAVERN_ROOM_ZONES.entrance.z).toBeGreaterThan(4);
    expect(TAVERN_ROOM_ZONES.bar.x).toBeLessThan(-3);
    expect(TAVERN_ROOM_ZONES.hearth.x).toBeGreaterThan(3);
    expect(Math.hypot(
      TAVERN_ROOM_ZONES.bar.x - TAVERN_ROOM_ZONES.hearth.x,
      TAVERN_ROOM_ZONES.bar.z - TAVERN_ROOM_ZONES.hearth.z,
    )).toBeGreaterThan(TAVERN_ROOM_ZONES.bar.radius + TAVERN_ROOM_ZONES.hearth.radius);
  });
});
