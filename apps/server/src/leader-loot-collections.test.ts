import { describe, expect, it } from "vitest";
import { LEADER_COLLECTIONS, discoverLeaderItem, leaderCollectionFor, parseLeaderCollectionState,
  resolveLeaderCollectionDrop } from "./leader-loot-collections.js";

describe("regional leader loot collections", () => {
  it("maps authored leaders to a compact regional pool", () => {
    expect(leaderCollectionFor("wild-crawler")?.id).toBe("greenwood");
    expect(leaderCollectionFor("northwatch-watchbreaker")?.id).toBe("northwatch");
    expect(leaderCollectionFor("ordinary-crawler")).toBeNull();
    expect(LEADER_COLLECTIONS.greenwood.items).toHaveLength(4);
  });

  it("protects a player's first missing item", () => {
    const state = parseLeaderCollectionState(null);
    const roll = resolveLeaderCollectionDrop(LEADER_COLLECTIONS.greenwood, state, 0, new Set(), .99);
    expect(roll.protected).toBe(true);
    expect(LEADER_COLLECTIONS.greenwood.items.slice(0, 3).map(entry => entry.itemId)).toContain(roll.itemId);
    expect(roll.nextMisses).toBe(0);
  });

  it("guarantees a missing item after two duplicate rolls", () => {
    const state = parseLeaderCollectionState({ discovered: { greenwood: ["forged_bow"] }, misses: { greenwood: 2 } });
    const roll = resolveLeaderCollectionDrop(LEADER_COLLECTIONS.greenwood, state, 0, new Set(["forged_bow"]), .99);
    expect(roll.protected).toBe(true);
    expect(roll.itemId).not.toBe("forged_bow");
  });

  it("unlocks the fourth regional item on empowered rematches", () => {
    const known = new Set(["forged_bow", "fang_dagger", "forager_wrap"] as const);
    const low = resolveLeaderCollectionDrop(LEADER_COLLECTIONS.greenwood, parseLeaderCollectionState(null), 2, known, .99);
    const high = resolveLeaderCollectionDrop(LEADER_COLLECTIONS.greenwood, parseLeaderCollectionState({ misses: { greenwood: 2 } }), 3, known, .99);
    expect(low.itemId).not.toBe("rootstalker_wrap");
    expect(high.itemId).toBe("rootstalker_wrap");
  });

  it("records permanent discovery progress and detects duplicates", () => {
    const first = discoverLeaderItem(parseLeaderCollectionState(null), "mistfen", "fenwalker_mantle");
    expect(first).toMatchObject({ duplicate: false, discovered: 1, total: 4 });
    const repeat = discoverLeaderItem(first.state, "mistfen", "fenwalker_mantle");
    expect(repeat).toMatchObject({ duplicate: true, discovered: 1, total: 4 });
  });
});
