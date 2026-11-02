import { describe, expect, it } from "vitest";
import { XStateEncounterDirector } from "./encounter-director.js";

const definitions = [
  { id: "forge", memberIds: ["hound-a", "hound-b", "sentry"] },
  { id: "boss", memberIds: ["forgeheart"] },
] as const;

describe("XState encounter intelligence", () => {
  it("shares one target and lifecycle across an authored encounter", () => {
    const director = new XStateEncounterDirector(definitions);
    expect(director.contact("hound-a", "hero", 1_000)).toMatchObject({
      encounterId: "forge", phase: "alert", targetId: "hero",
    });
    expect(director.directive("sentry", 1_250)).toMatchObject({
      phase: "engaged", targetId: "hero", members: ["hound-a", "hound-b", "sentry"],
    });
    director.stop();
  });

  it("forgets stale targets without alerting another encounter", () => {
    const director = new XStateEncounterDirector(definitions);
    director.contact("hound-a", "hero", 2_000);
    expect(director.directive("forgeheart", 2_500)).toMatchObject({ phase: "dormant", targetId: "" });
    expect(director.directive("hound-b", 8_000)).toMatchObject({ phase: "dormant", targetId: "" });
    director.stop();
  });

  it("can secure and reset an encounter deterministically", () => {
    const director = new XStateEncounterDirector(definitions);
    director.contact("forgeheart", "hero", 3_000);
    director.secure("forgeheart");
    expect(director.directive("forgeheart", 3_500)).toMatchObject({ phase: "secured", targetId: "" });
    director.reset();
    expect(director.directive("forgeheart", 3_600)).toMatchObject({ phase: "dormant", targetId: "" });
    director.stop();
  });

  it("shares and expires tactical responses without extending them forever", () => {
    const director = new XStateEncounterDirector(definitions);
    expect(director.signal("hound-a", "press-ranged", "archer", 4_000, 2_000)).toMatchObject({
      phase: "alert", targetId: "archer", tactic: "press-ranged", tacticTargetId: "archer", tacticUntil: 6_000,
    });
    expect(director.directive("sentry", 5_000)).toMatchObject({ phase: "engaged", tactic: "press-ranged" });
    expect(director.directive("sentry", 6_000)).toMatchObject({ phase: "engaged", tactic: "hold" });
    director.stop();
  });
});
