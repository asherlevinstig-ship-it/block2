import { describe, expect, it } from "vitest";
import { INTERACTION_TEST_PLAYER } from "@blockcraft/protocol";
import { createInteractionTestPlayerState, resetInteractionTestPlayerState } from "./interaction-test-player.js";
import { WorldRoom } from "./game-room.js";
import { WorldState } from "./schema.js";

describe("server interaction test player", () => {
  it("uses a normal player state that can be targeted by player systems", () => {
    const player = createInteractionTestPlayerState();
    expect(player.name).toBe(INTERACTION_TEST_PLAYER.name);
    expect(player.health).toBe(4);
    expect(player.maxHealth).toBe(10);
    expect(player.mainHandId).toBe("longsword");
    expect(player.huntLoadoutsJson).toContain("interactionTestPlayer");
  });

  it("returns to its wounded test pose after an interaction", () => {
    const player = createInteractionTestPlayerState();
    Object.assign(player, { x: 300, health: 10, stamina: 12, defending: true });
    resetInteractionTestPlayerState(player);
    expect(player.x).toBe(INTERACTION_TEST_PLAYER.x);
    expect(player.health).toBe(INTERACTION_TEST_PLAYER.health);
    expect(player.stamina).toBe(100);
    expect(player.defending).toBe(false);
  });

  it("is recreated and reset by the active Town room", () => {
    const room = new WorldRoom();
    room.setState(new WorldState());
    const internal = room as any;
    internal.roomKind = "practice";
    internal.rapidPractice = true;
    internal.maintainInteractionTestPlayer(1_000);
    const player = room.state.players.get(INTERACTION_TEST_PLAYER.id)!;
    expect(player.name).toBe(INTERACTION_TEST_PLAYER.name);
    player.health = 10;
    internal.maintainInteractionTestPlayer(2_000);
    expect(player.health).toBe(10);
    internal.maintainInteractionTestPlayer(7_000);
    expect(player.health).toBe(INTERACTION_TEST_PLAYER.health);
  });
});
