import { describe, expect, it } from "vitest";
import { tabletContextAction } from "./tablet-context-action.js";

describe("tablet context action", () => {
  it("stays hidden when there is nothing nearby to interact with", () => {
    expect(tabletContextAction({})).toBeNull();
  });

  it("uses a hold action for loot and a tap action for NPCs", () => {
    expect(tabletContextAction({ loot: true })).toEqual({ label: "Pick Up", hold: true });
    expect(tabletContextAction({ keeper: true })).toEqual({ label: "Talk", hold: false });
  });

  it("prioritises a player interaction over overlapping world interactions", () => {
    expect(tabletContextAction({ tradePlayer: true, loot: true, portal: true }))
      .toEqual({ label: "Player", hold: false });
  });

  it("preserves the action name supplied by a role opportunity", () => {
    expect(tabletContextAction({ roleAction: "Track" })).toEqual({ label: "Track", hold: false });
  });
});
