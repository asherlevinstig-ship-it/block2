import { describe, expect, it } from "vitest";
import { cooldownState } from "./combat-hud.js";

describe("reactive combat HUD", () => {
  it("clamps cooldown bars and formats their countdown", () => {
    expect(cooldownState(2500, 5000, "READY · R")).toEqual({ percent: 50, label: "2.5s", ready: false });
    expect(cooldownState(-10, 5000, "READY · R")).toEqual({ percent: 0, label: "READY · R", ready: true });
    expect(cooldownState(8000, 5000, "READY · R").percent).toBe(100);
  });

  it("allows authoritative blocked states to override the timer", () => {
    expect(cooldownState(0, 5000, "READY · R", "SERVER UPDATE")).toEqual({ percent: 0, label: "SERVER UPDATE", ready: false });
  });
});
