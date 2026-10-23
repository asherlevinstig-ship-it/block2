import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { decodeLootBagItems } from "@blockcraft/protocol";
import { WorldRoom } from "../src/game-room.js";
import { PlayerState, WorldState } from "../src/schema.js";
import { STARTER_KIT_ITEMS, starterKitClaimed } from "../src/starter-kit.js";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("new-character starter supplies", () => {
  it("spawns a personal sword-and-robes bag, renews it if missed, and never repeats it after collection", () => {
    vi.useFakeTimers(); vi.setSystemTime(10_000);
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any;
    Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
    vi.spyOn(room, "broadcast").mockImplementation(() => {});
    vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
    const player = new PlayerState(); Object.assign(player, { x: 8.5, y: 8, z: 8.5 });
    room.state.players.set("new-player", player);
    internal.ensureStarterKit("new-player", player, 10_000);
    const id = "starter-kit:new-player";
    const first = room.state.lootDrops.get(id)!;
    expect({ x: first.x, z: first.z, ownerId: first.ownerId }).toEqual({ x: 8.5, z: 11.5, ownerId: "new-player" });
    expect(decodeLootBagItems(first.contentsJson)).toEqual([...STARTER_KIT_ITEMS]);
    internal.ensureStarterKit("new-player", player, 10_001);
    expect(room.state.lootDrops.size).toBe(1);

    internal.resolveLootPickups(first.expiresAt);
    expect(room.state.lootDrops.has(id)).toBe(true);
    player.x = 8.5; player.z = 11.5;
    vi.setSystemTime(first.expiresAt + 1);
    internal.handleLootCollect({ sessionId: "new-player", send: vi.fn() }, { dropId: id, action: "keep" });
    expect(player.inventory.get("forged_sword")?.quantity).toBe(1);
    expect(player.inventory.get("wanderer_robes")?.quantity).toBe(1);
    expect(starterKitClaimed(player.huntLoadoutsJson)).toBe(true);
    internal.setPlayerBuildData(player, []);
    expect(starterKitClaimed(player.huntLoadoutsJson)).toBe(true);
    internal.setEquipmentAttunements(player, {}, 0, {});
    expect(starterKitClaimed(player.huntLoadoutsJson)).toBe(true);
    internal.ensureStarterKit("new-player", player, first.expiresAt + 2);
    expect(room.state.lootDrops.has(id)).toBe(false);
  });

  it("places the personal bag beside the fast-mode town spawn", () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any;
    internal.rapidPractice = true;
    const player = new PlayerState(); Object.assign(player, { x: 99.5, y: 8, z: 106.5 });
    room.state.players.set("fast-new-player", player);

    internal.ensureStarterKit("fast-new-player", player, 20_000);

    const drop = room.state.lootDrops.get("starter-kit:fast-new-player")!;
    expect({ x: drop.x, y: drop.y, z: drop.z }).toEqual({ x: 99.5, y: 8.22, z: 109.5 });
    expect(decodeLootBagItems(drop.contentsJson)).toEqual([...STARTER_KIT_ITEMS]);
  });
});
