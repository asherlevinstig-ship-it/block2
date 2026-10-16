import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { decodeLootBagItems } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { InventoryItemState, MobState, PlayerState, WorldState } from "./schema.js";
import { greenwoodFirstClearWeapon } from "./greenwood-first-clear.js";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("Greenwood first clear", () => {
  it("gives every path a usable first weapon", () => {
    expect(greenwoodFirstClearWeapon(null)).toBe("forged_sword");
    expect(greenwoodFirstClearWeapon("tank")).toBe("forged_sword");
    expect(greenwoodFirstClearWeapon("ranger")).toBe("forged_bow");
    expect(greenwoodFirstClearWeapon("mage")).toBe("forged_focus");
    expect(greenwoodFirstClearWeapon("healer")).toBe("forged_focus");
    expect(greenwoodFirstClearWeapon("assassin")).toBe("fang_dagger");
    expect(greenwoodFirstClearWeapon("thief")).toBe("fang_dagger");
  });

  it("puts the path weapon in the first Broodmother bag but not repeat bags", () => {
    vi.useFakeTimers(); vi.setSystemTime(10_000);
    const room = new WorldRoom(); room.setState(new WorldState());
    Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
    const internal = room as any;
    vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
    vi.spyOn(Math, "random").mockReturnValue(1);
    const player = new PlayerState(); Object.assign(player, { x: 42.5, y: 8, z: 19.5 });
    player.huntLoadoutsJson = JSON.stringify({ buildPath: { selectedPathId: "ranger" } });
    room.state.players.set("hero", player);
    const mob = new MobState(); Object.assign(mob, { x: 42.5, y: 8, z: 19.5, archetype: "moss_crawler", difficultyTier: 1 });
    internal.spawnLootDrops("wild-crawler", mob, 10_000, "hero");
    const [firstId, first] = [...room.state.lootDrops.entries()][0]!;
    expect(firstId).toContain("greenwood-first:forged_bow:");
    expect(decodeLootBagItems(first.contentsJson)).toContainEqual({ itemId: "forged_bow", quantity: 1 });
    expect(JSON.parse(player.huntLoadoutsJson).greenwood?.firstBossGearClaimed ?? false).toBe(false);
    // Another kill while the reward bag is pending must not duplicate the weapon.
    internal.spawnLootDrops("wild-crawler", mob, 11_000, "hero");
    const repeat = [...room.state.lootDrops.values()][1]!;
    expect(decodeLootBagItems(repeat.contentsJson).some(item => item.itemId === "forged_bow")).toBe(false);
    internal.handleLootCollect({ sessionId: "hero", send: vi.fn() }, { dropId: firstId, action: "keep" });
    expect(player.inventory.get("forged_bow")?.quantity).toBe(1);
    expect(JSON.parse(player.huntLoadoutsJson).greenwood.firstBossGearClaimed).toBe(true);
    internal.grantRegionalMark("hero", "greenwood");
    expect(JSON.parse(player.huntLoadoutsJson).greenwood.firstBossGearClaimed).toBe(true);
    internal.spawnLootDrops("wild-crawler", mob, 12_000, "hero");
    const third = [...room.state.lootDrops.values()].at(-1)!;
    expect(decodeLootBagItems(third.contentsJson).some(item => item.itemId === "forged_bow")).toBe(false);
  });

  it("reoffers an uncollected weapon after its bag expires", () => {
    vi.useFakeTimers(); vi.setSystemTime(10_000);
    const room = new WorldRoom(); room.setState(new WorldState());
    Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
    const internal = room as any;
    vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
    const player = new PlayerState(); room.state.players.set("hero", player);
    const mob = new MobState(); Object.assign(mob, { x: 42.5, y: 8, z: 19.5, archetype: "moss_crawler", difficultyTier: 1 });
    internal.spawnLootDrops("wild-crawler", mob, 10_000, "hero");
    const firstId = [...room.state.lootDrops.keys()][0]!;
    internal.resolveLootPickups(room.state.lootDrops.get(firstId)!.expiresAt);
    expect(room.state.lootDrops.has(firstId)).toBe(false);
    internal.spawnLootDrops("wild-crawler", mob, 11_000, "hero");
    expect([...room.state.lootDrops.keys()][0]).toContain("greenwood-first:forged_sword:");
  });

  it("substitutes potions if the player already owns the path weapon", () => {
    vi.useFakeTimers(); vi.setSystemTime(10_000);
    const room = new WorldRoom(); room.setState(new WorldState());
    Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
    const internal = room as any;
    vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
    const player = new PlayerState(); player.huntLoadoutsJson = JSON.stringify({ buildPath: { selectedPathId: "ranger" } });
    const owned = new InventoryItemState(); owned.quantity = 1; player.inventory.set("forged_bow", owned);
    room.state.players.set("hero", player);
    const mob = new MobState(); Object.assign(mob, { x: 42.5, y: 8, z: 19.5, archetype: "moss_crawler", difficultyTier: 1 });
    internal.spawnLootDrops("wild-crawler", mob, 10_000, "hero");
    expect(decodeLootBagItems([...room.state.lootDrops.values()][0]!.contentsJson)
      .find(item => item.itemId === "healing_potion")?.quantity).toBeGreaterThanOrEqual(2);
  });
});
