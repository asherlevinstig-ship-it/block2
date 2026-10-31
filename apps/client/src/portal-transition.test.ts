import { describe, expect, it } from "vitest";
import { PRACTICE_ROOM, TAVERN_ROOM } from "@blockcraft/protocol";
import { portalTransitionFrame, portalTravelUsesVeil, type PortalTransitionState } from "./portal-transition.js";
describe("portal transition lifecycle", () => {
  const travelling: PortalTransitionState = { phase: "travelling", startedAt: 1000, charge: 1, arrived: false };
  it("keeps travel covered until arrival is acknowledged and the world is ready", () => {
    expect(portalTransitionFrame(travelling, 2000, true).state.phase).toBe("travelling");
    expect(portalTransitionFrame({ ...travelling, arrived: true }, 2000, false).state.phase).toBe("travelling");
    expect(portalTransitionFrame({ ...travelling, arrived: true }, 1100, true).state.phase).toBe("travelling");
    expect(portalTransitionFrame({ ...travelling, arrived: true }, 2000, true).state.phase).toBe("arriving");
  });
  it("fades completely and recovers if a travel response is lost", () => {
    const next = portalTransitionFrame(travelling, 9500, false);
    expect(next.state.phase).toBe("arriving");
    expect(portalTransitionFrame(next.state, 10150, false)).toMatchObject({ opacity: 0, state: { phase: "idle" } });
  });
  it("builds a light veil during the interaction hold", () => {
    expect(portalTransitionFrame({ ...travelling, phase: "charging", charge: .5 }, 1000, true).opacity).toBe(.2);
  });
  it("keeps tavern doors immediate while preserving portal travel effects elsewhere", () => {
    expect(portalTravelUsesVeil("practice", "tavern")).toBe(false);
    expect(portalTravelUsesVeil("tavern", "practice")).toBe(false);
    expect(portalTravelUsesVeil(PRACTICE_ROOM, TAVERN_ROOM)).toBe(false);
    expect(portalTravelUsesVeil(TAVERN_ROOM, PRACTICE_ROOM)).toBe(false);
    expect(portalTravelUsesVeil("practice", "silver-depths")).toBe(true);
  });
});
