import { describe, expect, it } from "vitest";
import { holdStopMessage, holdStopReason } from "./interaction-feedback.js";

const normal = { connected: true, defeated: false, menuOpen: false, inRange: true, released: false };
describe("interaction interruptions", () => {
  it("explains combat rather than misleadingly blaming distance after a hit", () => {
    expect(holdStopReason({ ...normal, combat: true, inRange: false })).toBe("combat");
    expect(holdStopReason({ ...normal, connected: false, inRange: false })).toBe("connection");
    expect(holdStopReason(normal)).toBeNull();
  });
  it("does not add another notice over defeat or an opened menu", () => {
    expect(holdStopMessage("loot", "menu", false)).toBeNull();
    expect(holdStopMessage("portal", "defeated", false)).toBeNull();
  });
  it("gives an actionable retry using the correct control and target", () => {
    expect(holdStopMessage("portal", "range", false)).toContain("portal");
    expect(holdStopMessage("loot", "released", false)).toContain("Keep E held");
    expect(holdStopMessage("portal", "released", true)).toContain("holding the button");
    expect(holdStopMessage("loot", "damage", false)).toContain("hit");
  });
});
