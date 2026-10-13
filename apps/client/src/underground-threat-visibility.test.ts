import { describe, expect, it } from "vitest";
import { undergroundThreatVisible } from "./underground-threat-visibility.js";

const state = { underground: true, known: false, cutawayHidden: true, verticalDistance: 1, distance: 8, lineClear: true };

describe("underground threat visibility", () => {
  it("reveals a nearby line-of-sight enemy even when cave fog hid its cell", () => {
    expect(undergroundThreatVisible(state)).toBe(true);
  });

  it("does not reveal enemies through terrain or across remote cave areas", () => {
    expect(undergroundThreatVisible({ ...state, lineClear: false })).toBe(false);
    expect(undergroundThreatVisible({ ...state, distance: 20.01 })).toBe(false);
    expect(undergroundThreatVisible({ ...state, verticalDistance: 3.01 })).toBe(false);
  });

  it("preserves ordinary discovered-cell and surface cutaway rules", () => {
    expect(undergroundThreatVisible({ ...state, known: true, cutawayHidden: false })).toBe(true);
    expect(undergroundThreatVisible({ ...state, underground: false })).toBe(false);
  });
});
