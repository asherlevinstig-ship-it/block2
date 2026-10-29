import { describe, expect, it } from "vitest";
import type { FloorRunUpgradeUpdate } from "@blockcraft/protocol";
import { floorUpgradeTick } from "./floor-run-upgrades.js";

const readyState: FloorRunUpgradeUpdate = {
  active: true,
  earned: 1,
  pending: 1,
  picked: [],
  path: "assassin",
  offerId: "warden-1",
  choices: ["assassin_open"],
  canChoose: true,
};

describe("Floor 1 upgrade presentation", () => {
  it("keeps an opened upgrade modal visible after it becomes the active popup", () => {
    expect(floorUpgradeTick(readyState, true, false)).toEqual({ closePanel: false, readyVisible: false });
  });

  it("shows the ready button only while the valid modal is closed and presentation is safe", () => {
    expect(floorUpgradeTick(readyState, false, true)).toEqual({ closePanel: false, readyVisible: true });
    expect(floorUpgradeTick(readyState, false, false).readyVisible).toBe(false);
  });

  it("closes a stale open modal after the offer is consumed", () => {
    expect(floorUpgradeTick({ ...readyState, pending: 0, choices: [] }, true, false).closePanel).toBe(true);
  });
});
