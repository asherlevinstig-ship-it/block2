import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ROLE_FIELD_OPPORTUNITIES } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { MobState, PlayerState, WorldState } from "./schema.js";
import { chooseBuildPath, parseBuildPathState, serializeBuildPathState } from "./build-paths.js";

describe("role field opportunities", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(10_000); });
  afterEach(() => vi.useRealTimers());

  function fixture(pathId: "tank" | "mage" | "assassin" | "thief" | "ranger") {
    const opportunity = ROLE_FIELD_OPPORTUNITIES.find(candidate => candidate.pathId === pathId)!;
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any; internal.roomKind = "overworld";
    vi.spyOn(room, "broadcast").mockImplementation(() => {});
    const player = new PlayerState();
    Object.assign(player, { x: opportunity.x + .5, y: 8, z: opportunity.z + .5, stamina: 25, maxStamina: 100,
      coins: 0, powerCooldownUntil: 99_000, specialCooldownUntil: 99_000 });
    player.huntLoadoutsJson = serializeBuildPathState(chooseBuildPath(parseBuildPathState("{}"), pathId));
    room.state.players.set("hero", player);
    const client = { sessionId: "hero", send: vi.fn() };
    internal.clients.push(client);
    return { internal, player, client, opportunity };
  }

  it.each(["tank", "mage", "assassin", "thief", "ranger"] as const)("activates the %s field reward and grants mastery", pathId => {
    const { internal, player, client, opportunity } = fixture(pathId);
    internal.handleRoleOpportunity(client, { id: opportunity.id });
    expect(parseBuildPathState(player.huntLoadoutsJson).xp[pathId]).toBe(2);
    expect(client.send).toHaveBeenCalledWith("build:path-proc", expect.objectContaining({ pathId, ability: opportunity.action.toUpperCase() }));
    if (pathId === "tank") {
      expect(internal.tankFieldWards.has("hero")).toBe(true);
      internal.damagePlayer("field-test", "hero", 3, 10_000, false);
      expect(player.health).toBe(4);
      expect(internal.tankFieldWards.has("hero")).toBe(false);
    }
    if (pathId === "mage") { expect(player.powerCooldownUntil).toBe(99_000); expect(internal.callingSpecialReadyAt.get("hero")).toBe(10_000); expect(player.stamina).toBe(60); }
    if (pathId === "assassin") expect(internal.assassinShadowUntil.get("hero")).toBe(18_000);
    if (pathId === "thief") expect(player.coins).toBe(8);
    if (pathId === "ranger") {
      expect(internal.rangerFieldFocusHits.get("hero")).toBe(3);
      player.mainHandTag = "ranged";
      expect(internal.buildPathDamageBonus(player, new MobState(), "target", "hero", 10_000, "weapon")).toBe(1);
      expect(internal.rangerFieldFocusHits.get("hero")).toBe(2);
    }
  });

  it("enforces distance, Calling ownership, and a three-minute recovery", () => {
    const { internal, player, client, opportunity } = fixture("thief");
    player.x += 20;
    internal.handleRoleOpportunity(client, { id: opportunity.id });
    expect(player.coins).toBe(0);
    player.x = opportunity.x + .5;
    internal.handleRoleOpportunity(client, { id: opportunity.id });
    internal.handleRoleOpportunity(client, { id: opportunity.id });
    expect(player.coins).toBe(8);
    expect(client.send).toHaveBeenCalledWith("chat:notice", expect.stringContaining("recovers in 180s"));
    const tankSite = ROLE_FIELD_OPPORTUNITIES.find(candidate => candidate.pathId === "tank")!;
    Object.assign(player, { x: tankSite.x + .5, z: tankSite.z + .5 });
    internal.handleRoleOpportunity(client, { id: tankSite.id });
    expect(internal.tankFieldWards.has("hero")).toBe(false);
  });
});
