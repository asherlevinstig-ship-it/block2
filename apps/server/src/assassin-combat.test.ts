import { describe, expect, it } from "vitest";
import { advanceAssassinEdge, assassinOpening, venombladeStrike } from "./assassin-combat.js";

describe("Assassin opening and Edge combat", () => {
  it("prioritizes deliberate openings over a generic flank", () => {
    expect(assassinOpening({ concealed: false, dodgeCounter: true, behind: true, interrupted: false,
      staggered: false, marked: false })).toBe("counter");
    expect(assassinOpening({ concealed: false, dodgeCounter: false, behind: true, interrupted: false,
      staggered: false, marked: false })).toBe("flank");
  });

  it("rewards varied openings without allowing rapid repetition to farm Edge", () => {
    const first = advanceAssassinEdge(undefined, "counter", 1_000);
    const repeated = advanceAssassinEdge(first.state, "counter", 1_500);
    const varied = advanceAssassinEdge(repeated.state, "flank", 1_600);
    expect(first.state.segments).toBe(1);
    expect(repeated).toMatchObject({ gained: false, state: { segments: 1 } });
    expect(varied).toMatchObject({ gained: true, state: { segments: 2 } });
  });

  it("decays stale Edge and detonates Venomblade buildup only through an opening", () => {
    const stale = advanceAssassinEdge({ segments: 4, lastOpening: "ambush", lastGainAt: 0 }, null, 12_100);
    expect(stale.state.segments).toBe(2);
    expect(advanceAssassinEdge(stale.state, null, 18_100).state.segments).toBe(1);
    expect(venombladeStrike(2, null)).toEqual({ stacks: 3, bonusDamage: 0, catalytic: false });
    expect(venombladeStrike(2, "marked")).toEqual({ stacks: 0, bonusDamage: 3, catalytic: true });
  });
});
