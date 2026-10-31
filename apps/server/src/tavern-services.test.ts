import { describe, expect, it } from "vitest";
import { TAVERN_INN_SLEEP_POSITION, TAVERN_INN_WAKE_POSITION, TAVERN_REST_DURATION_MS } from "@blockcraft/protocol";
import { beginTavernRest, canUseTavernKeeperService, completeTavernRest, tavernRestActive,
  tavernReturnBound, wakeTavernRestEarly, withTavernReturnBound } from "./tavern-services.js";
import { PlayerState } from "./schema.js";
import { applyPlayerSave, parsePlayerSave, snapshotPlayerSave } from "./player-save.js";

describe("tavern services", () => {
  it("preserves existing progression while binding the tavern return", () => {
    const source = JSON.stringify({ loadouts: [{ slot: 1 }], buildPath: { selectedPathId: "mage" } });
    const updated = withTavernReturnBound(source);
    expect(tavernReturnBound(updated)).toBe(true);
    expect(JSON.parse(updated)).toMatchObject({ loadouts: [{ slot: 1 }], buildPath: { selectedPathId: "mage" } });
  });

  it("migrates legacy loadout arrays without losing them", () => {
    const updated = withTavernReturnBound(JSON.stringify([{ slot: 1 }]));
    expect(JSON.parse(updated)).toMatchObject({ loadouts: [{ slot: 1 }], tavernReturn: true });
  });

  it("requires the player to stand at Mara's customer side", () => {
    expect(canUseTavernKeeperService({ x: -5.5, y: 9, z: -1.5 })).toBe(true);
    expect(canUseTavernKeeperService({ x: 0, y: 9, z: 1.5 })).toBe(false);
  });

  it("keeps the bound return point across a saved session", () => {
    const player = new PlayerState();
    player.huntLoadoutsJson = withTavernReturnBound("{}");
    const saved = parsePlayerSave(JSON.stringify(snapshotPlayerSave(player)));
    const restored = new PlayerState(); applyPlayerSave(restored, saved!);
    expect(tavernReturnBound(restored.huntLoadoutsJson)).toBe(true);
  });

  it("requires a real five-minute sleep before granting the rest benefits", () => {
    const player = new PlayerState();
    player.health = 1; player.stamina = 7;
    const until = beginTavernRest(player, 10_000);
    expect(until).toBe(10_000 + TAVERN_REST_DURATION_MS);
    expect(player).toMatchObject(TAVERN_INN_SLEEP_POSITION);
    expect(tavernRestActive(until, until - 1)).toBe(true);
    expect(completeTavernRest(player, until, until - 1)).toBe(false);
    expect(player.health).toBe(1);
    expect(completeTavernRest(player, until, until)).toBe(true);
    expect(player).toMatchObject({ ...TAVERN_INN_WAKE_POSITION, health: player.maxHealth, stamina: player.maxStamina });
    expect(tavernReturnBound(player.huntLoadoutsJson)).toBe(true);
  });

  it("wakes early without granting recovery", () => {
    const player = new PlayerState(); player.health = 2; player.stamina = 11;
    beginTavernRest(player, 10_000); wakeTavernRestEarly(player);
    expect(player).toMatchObject({ ...TAVERN_INN_WAKE_POSITION, health: 2, stamina: 11 });
    expect(tavernReturnBound(player.huntLoadoutsJson)).toBe(false);
  });
});
