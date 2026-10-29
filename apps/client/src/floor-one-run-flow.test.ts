import { describe, expect, it } from "vitest";
import { floorOneRunView, type FloorOneRunInput } from "./floor-one-run-flow.js";

const state = (overrides: Partial<FloorOneRunInput> = {}): FloorOneRunInput => ({
  active: true, x: 305, z: 106, northAlive: true, southAlive: true, bossState: "sealed", ...overrides,
});

describe("Floor 1 run flow", () => {
  it("orients arrival toward the encounter fork", () => {
    const view = floorOneRunView(state());
    expect(view.stage).toBe("arrival"); expect(view.targetName).toBe("Ruined Warden Fork");
    expect(view.detail).toContain("North teaches interrupts");
  });

  it("allows either Warden route and recommends the nearer one", () => {
    expect(floorOneRunView(state({ x: 338, z: 83 })).targetName).toBe("North Root Warden");
    expect(floorOneRunView(state({ x: 338, z: 130 })).targetName).toBe("South Root Warden");
  });

  it("names the remaining seal and its combat lesson", () => {
    const north = floorOneRunView(state({ x: 340, northAlive: true, southAlive: false }));
    const south = floorOneRunView(state({ x: 340, northAlive: false, southAlive: true }));
    expect(north.stage).toBe("final-seal"); expect(north.detail).toContain("Root Slam");
    expect(south.detail).toContain("Thorn Fan");
  });

  it("moves the run to the Crownkeeper once both seals break", () => {
    const view = floorOneRunView(state({ northAlive: false, southAlive: false, bossState: "alive" }));
    expect(view.stage).toBe("crownkeeper"); expect(view.targetName).toBe("Crownkeeper Court");
  });

  it("finishes at the ascent gate after the boss falls", () => {
    const view = floorOneRunView(state({ northAlive: false, southAlive: false, bossState: "defeated" }));
    expect(view.stage).toBe("cleared"); expect(view.targetName).toBe("Floor 2 Ascent");
    expect(view).toMatchObject({ northComplete: true, southComplete: true, crownComplete: true });
  });
});
