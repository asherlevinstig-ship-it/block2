import { describe, expect, it } from "vitest";
import { advanceTrackedLeaderCollectionHunt, leaderCollectionProgress, leaderCollectionRematchTier, leaderCollectionTarget,
  parseLeaderCollectionDiscoveries, parseTrackedLeaderCollectionHunt, trackedLeaderArenaPresentation } from "./leader-collection-journal.js";

describe("regional leader collection journal", () => {
  it("reads permanent discoveries and ignores invalid items", () => {
    const result = parseLeaderCollectionDiscoveries(JSON.stringify({ leaderCollections: { discovered: {
      greenwood: ["forged_bow", "not_an_item", "forged_bow"], ashen: ["emberheart_focus"], unknown: ["forged_sword"],
    } } }));
    expect(result).toEqual({ greenwood: ["forged_bow"], ashen: ["emberheart_focus"] });
  });

  it("treats all four regional pieces as a completed cosmetic crest", () => {
    const discoveries = parseLeaderCollectionDiscoveries(JSON.stringify({ leaderCollections: { discovered: {
      quarry: ["stone_core_hammer", "forged_sword", "quarry_hauberk", "bastion_plate"],
    } } }));
    expect(leaderCollectionProgress("quarry", discoveries)).toEqual({ discovered: 4, total: 4, complete: true });
  });

  it("fails safely for old or malformed player data", () => {
    expect(parseLeaderCollectionDiscoveries("bad json")).toEqual({});
    expect(parseLeaderCollectionDiscoveries(JSON.stringify({ loadouts: [] }))).toEqual({});
  });

  it("routes missing pieces to their authored leader arena and truthful rematch tier", () => {
    expect(leaderCollectionTarget("quarry", "bastion_plate")).toMatchObject({
      x: 8.5, z: 171.5, id: "leader-collection-quarry", name: "Redstone Quarrymaster · Empowered Rematch III",
    });
    expect(leaderCollectionRematchTier("northwatch", "northwatch_cloak")).toBe(2);
    expect(leaderCollectionRematchTier("greenwood", "forged_bow")).toBe(0);
  });

  it("restores only valid tracked regional items", () => {
    expect(parseTrackedLeaderCollectionHunt(JSON.stringify({ collectionId: "mistfen", itemId: "mirebreaker_mantle" })))
      .toEqual({ collectionId: "mistfen", itemId: "mirebreaker_mantle" });
    expect(parseTrackedLeaderCollectionHunt(JSON.stringify({ collectionId: "mistfen", itemId: "forged_bow" }))).toBeNull();
    expect(parseTrackedLeaderCollectionHunt("broken")).toBeNull();
  });

  it("advances a discovered target to the next hidden piece and ends on set completion", () => {
    const tracked = { collectionId: "greenwood", itemId: "forged_bow" } as const;
    expect(advanceTrackedLeaderCollectionHunt(tracked, { greenwood: ["forged_bow"] }))
      .toEqual({ collectionId: "greenwood", itemId: "fang_dagger" });
    expect(advanceTrackedLeaderCollectionHunt(tracked, { greenwood: ["forged_bow", "fang_dagger", "forager_wrap", "rootstalker_wrap"] }))
      .toBeNull();
    expect(advanceTrackedLeaderCollectionHunt(tracked, {})).toEqual(tracked);
  });

  it("presents fixed arena difficulty and suppressible combat state near the tracked leader", () => {
    const tracked = { collectionId: "northwatch", itemId: "northwatch_cloak" } as const;
    const player = { x: 15.5, y: 8, z: -70, alive: true };
    const ready = trackedLeaderArenaPresentation(tracked,
      { id: "northwatch-watchbreaker", alive: true, combatState: "idle", targetId: "", respawnAt: 0 }, player, 10_000);
    expect(ready).toMatchObject({ phase: "ready", difficulty: "EMPOWERED II", party: "2–3 PLAYERS RECOMMENDED",
      slot: "COLLECTION SLOT 4 · UNKNOWN" });
    expect(trackedLeaderArenaPresentation(tracked,
      { id: "northwatch-watchbreaker", alive: true, combatState: "windup", targetId: "player", respawnAt: 0 }, player, 10_000)?.phase)
      .toBe("battle");
    expect(trackedLeaderArenaPresentation(tracked,
      { id: "northwatch-watchbreaker", alive: false, combatState: "idle", targetId: "", respawnAt: 16_200 }, player, 10_000))
      .toMatchObject({ phase: "respawning", respawnSeconds: 7 });
  });

  it("does not present a tracked arena for the wrong leader or a distant player", () => {
    const tracked = { collectionId: "quarry", itemId: "forged_sword" } as const;
    const mob = { id: "south-quarrymaster", alive: true, combatState: "idle", targetId: "", respawnAt: 0 };
    expect(trackedLeaderArenaPresentation(tracked, mob, { x: 8.5, y: 8, z: 40, alive: true }, 0)).toBeNull();
    expect(trackedLeaderArenaPresentation(tracked, { ...mob, id: "stone-brute" }, { x: 8.5, y: 8, z: 171.5, alive: true }, 0)).toBeNull();
  });
});
