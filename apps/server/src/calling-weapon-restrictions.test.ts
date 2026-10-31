import { describe, expect, it, vi } from "vitest";
import { WorldRoom } from "./game-room.js";
import { InventoryItemState, PlayerState, WorldState } from "./schema.js";
import { chooseBuildPath, parseBuildPathState, serializeBuildPathState } from "./build-paths.js";
import type { BuildPathId, ItemId, MainHandId } from "@blockcraft/protocol";

function fixture(pathId: BuildPathId, mainHandId: MainHandId, owned: ItemId[] = []) {
  const room = new WorldRoom(); room.setState(new WorldState());
  const internal = room as any;
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const player = new PlayerState();
  Object.assign(player, { x: 99.5, y: 8, z: 106.5, health: 5, maxHealth: 5, level: 5,
    mainHandId, mainHandTag: mainHandId === "forged_bow" ? "ranged" : mainHandId === "forged_focus" ? "focus" : "melee" });
  player.huntLoadoutsJson = serializeBuildPathState(chooseBuildPath(parseBuildPathState("{}"), pathId));
  for (const itemId of owned) { const item = new InventoryItemState(); item.quantity = 1; player.inventory.set(itemId, item); }
  room.state.players.set("hero", player);
  const client = { sessionId: "hero", send: vi.fn() };
  internal.clients.push(client);
  vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
  return { room, internal, player, client };
}

describe("Calling weapon equip restrictions", () => {
  it("rejects an owned weapon from another Calling on the server", () => {
    const f = fixture("tank", "forged_sword", ["forged_bow"]);
    f.internal.handleMainHandEquip(f.client, { requestId: "cross-role", mainHandId: "forged_bow" });
    expect(f.player.mainHandId).toBe("forged_sword");
    expect(f.client.send).toHaveBeenCalledWith("chat:notice", expect.stringContaining("Ranger"));
    expect(f.client.send).not.toHaveBeenCalledWith("main-hand:equipped", expect.anything());
  });

  it("allows the active Calling to equip its owned weapon", () => {
    const f = fixture("ranger", "bow", ["forged_bow"]);
    f.internal.handleMainHandEquip(f.client, { requestId: "own-role", mainHandId: "forged_bow" });
    expect(f.player.mainHandId).toBe("forged_bow");
    expect(f.client.send).toHaveBeenCalledWith("main-hand:equipped", { requestId: "own-role", mainHandId: "forged_bow" });
  });

  it("moves an incompatible weapon back to the pack when Calling changes", () => {
    const f = fixture("tank", "forged_sword");
    f.internal.rapidPractice = true;
    f.internal.handleBuildPath(f.client, { action: "choose", pathId: "mage" });
    expect(f.player.mainHandId).toBe("magic_focus");
    expect(parseBuildPathState(f.player.huntLoadoutsJson).selectedPathId).toBe("mage");
    expect(f.client.send).toHaveBeenCalledWith("main-hand:equipped",
      expect.objectContaining({ mainHandId: "magic_focus" }));
  });
});
