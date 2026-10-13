import { describe, expect, it } from "vitest";
import { realmEventLabel } from "./realm-event-ui.js";

const base = {
  phase: "idle" as const, eventId: null, eventName: null, eventTitle: null,
  targetX: 0, targetY: 0, targetZ: 0, warningUntil: 0,
  completed: 2, required: 3, realmBoss: false,
};

describe("realm event meter", () => {
  it("shows regional escalation without presenting it as a quest", () => {
    expect(realmEventLabel(base)).toEqual({
      eyebrow: "REALM THREAT",
      title: "2 / 3 threats defeated",
      detail: "Clear marked regional encounters to draw out public bosses",
    });
  });

  it("counts down an awakening realm boss", () => {
    expect(realmEventLabel({ ...base, phase: "warning", realmBoss: true, eventName: "Realm Stone Warden", warningUntil: 9_000 }, 1_000))
      .toEqual({ eyebrow: "REALM BOSS AWAKENING", title: "Realm Stone Warden", detail: "Arrives in 8s · rally at the marker" });
  });
});
