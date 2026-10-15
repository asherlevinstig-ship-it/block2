import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CALLING_ABILITIES, type BuildPathId } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { MobState, PlayerState, WorldState } from "./schema.js";
import { chooseBuildPath, parseBuildPathState, serializeBuildPathState } from "./build-paths.js";

describe("hotbar Calling abilities", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(10_000); });
  afterEach(() => vi.useRealTimers());

  function fixture(pathId: BuildPathId) {
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any; internal.roomKind = "overworld";
    vi.spyOn(room, "broadcast").mockImplementation(() => {});
    const player = new PlayerState();
    Object.assign(player, { x: 50, y: 8, z: 50, stamina: 25, maxStamina: 100,
      powerCooldownUntil: 99_000, specialCooldownUntil: 99_000 });
    player.huntLoadoutsJson = serializeBuildPathState(chooseBuildPath(parseBuildPathState("{}"), pathId));
    room.state.players.set("hero", player);
    const client = { sessionId: "hero", send: vi.fn() };
    internal.clients.push(client);
    return { room, internal, player, client };
  }

  it.each(["tank", "mage", "assassin", "thief", "ranger"] as const)("activates %s from the dedicated slot", pathId => {
    const { internal, player, client } = fixture(pathId);
    const mob = new MobState(); Object.assign(mob, { x: 52, y: 8, z: 50, alive: true, targetId: "hero" });
    internal.state.mobs.set("pursuer", mob);
    internal.mobAwareness.set("pursuer", { targetId: "hero" });
    internal.handleCallingAbility(client, { requestId: `use-${pathId}` });

    expect(client.send).toHaveBeenCalledWith("calling:ability", expect.objectContaining({
      requestId: `use-${pathId}`, pathId, ability: CALLING_ABILITIES[pathId].name,
      cooldownUntil: 10_000 + CALLING_ABILITIES[pathId].cooldownMs,
    }));
    expect(client.send).toHaveBeenCalledWith("build:path-proc", expect.objectContaining({ pathId }));
    if (pathId === "tank") {
      expect(internal.tankBulwarkUntil.get("hero")).toBe(15_000);
      internal.damagePlayer("field-test", "hero", 3, 10_000, false);
      expect(player.health).toBe(3);
    }
    if (pathId === "mage") { expect(player.powerCooldownUntil).toBe(10_000); expect(player.stamina).toBe(55); }
    if (pathId === "assassin") {
      expect(internal.assassinShadowUntil.get("hero")).toBe(13_000);
      expect(internal.mobAwareness.has("pursuer")).toBe(false);
    }
    if (pathId === "thief") {
      expect(player.stamina).toBe(45);
      expect(internal.mobAwareness.has("pursuer")).toBe(false);
    }
    if (pathId === "ranger") expect(internal.rangerFieldFocusHits.get("hero")).toBe(3);
  });

  it("requires a Calling and enforces the server cooldown", () => {
    const { internal, player, client } = fixture("mage");
    internal.handleCallingAbility(client, { requestId: "first" });
    player.powerCooldownUntil = 77_000;
    internal.handleCallingAbility(client, { requestId: "second" });
    expect(player.powerCooldownUntil).toBe(77_000);
    expect(client.send).toHaveBeenCalledWith("chat:notice", expect.stringContaining("recovers in 16s"));

    player.huntLoadoutsJson = "{}";
    internal.callingAbilityReadyAt.clear();
    internal.handleCallingAbility(client, { requestId: "unbound" });
    expect(client.send).toHaveBeenCalledWith("chat:notice", expect.stringContaining("Choose a Calling"));
  });
});
