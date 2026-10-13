import { describe, expect, it } from "vitest";
import { huntChampionPattern, huntChampionPhase, huntChampionRushMultiplier,
  huntChampionUsesSecondVolley, huntChampionVenomHazard } from "./hunt-champion-combat.js";

describe("Path Champion combat", () => {
  it("moves through three even health phases", () => {
    expect(huntChampionPhase(90, 90)).toBe(1);
    expect(huntChampionPhase(60, 90)).toBe(2);
    expect(huntChampionPhase(30, 90)).toBe(3);
  });

  it("gives each path a distinct final-phase rotation", () => {
    expect(huntChampionPattern("fang", 0, 3)).toBe("alpha-rush");
    expect(huntChampionPattern("venom", 0, 3)).toBe("venom-ring");
    expect(huntChampionPattern("crusher", 0, 3)).toBe("warden-barrage");
  });

  it("raises pressure without hiding the counterplay", () => {
    expect(huntChampionRushMultiplier("alpha-rush")).toBe(1.5);
    expect(huntChampionVenomHazard("pool")).toEqual({ radius: 1.75, durationMs: 5_000 });
    expect(huntChampionUsesSecondVolley("venom", "venom-ring")).toBe(true);
    expect(huntChampionUsesSecondVolley("fang", "alpha-rush")).toBe(false);
  });
});
