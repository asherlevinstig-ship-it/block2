import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { WorldRoom } from "../src/game-room.js";
import { InventoryItemState, MobState, PlayerState, WorldState } from "../src/schema.js";
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture() {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
  Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 0 ? Block.Stone : Block.Air });
  vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
  vi.spyOn(Math, "random").mockReturnValue(.99);
  const rewards: any[] = []; vi.spyOn(room, "broadcast").mockImplementation((type, payload) => { if (type === "combat:reward") rewards.push(payload); });
  const mob = new MobState(); Object.assign(mob, { x: 100.5, y: 1, z: 100.5, health: 8, maxHealth: 8, armor: 0, archetype: "moss_crawler" });
  room.state.mobs.set("mob", mob);
  for (const id of ["a", "b", "watcher"]) { const p = new PlayerState(); Object.assign(p, { x: 101, y: 1, z: 100.5 }); room.state.players.set(id, p); }
  const contribute = (id: string, damage: number) => internal.combatContributions.record("mob", id, damage, 10000);
  const defeat = () => internal.defeatMob("mob", mob, "b", 10000);
  return { room, internal, mob, rewards, contribute, defeat };
}
describe("cooperative personal loot", () => {
  it("gives both contributors independent drops and rewards, but none to bystanders or repeated defeats", () => {
    const { room, contribute, defeat, rewards } = fixture(); contribute("a", 4); contribute("b", 4); defeat();
    expect(rewards.map(reward => reward.playerId)).toEqual(["a", "b"]);
    for (const owner of ["a", "b"]) expect([...room.state.lootDrops.values()].filter(drop => drop.ownerId === owner).map(drop => drop.itemId)).toEqual(["moss_fibre", "crawler_fang"]);
    expect(room.state.players.get("a")!.coins).toBe(22); expect(room.state.players.get("b")!.coins).toBe(22);
    expect(room.state.players.get("watcher")!.coins).toBe(20);
    defeat(); expect(room.state.lootDrops.size).toBe(4); expect(rewards).toHaveLength(2);
  });
  it("rolls optional equipment separately for each contributor", () => {
    const { room, contribute, defeat } = fixture(); vi.mocked(Math.random)
      .mockReturnValueOnce(.99).mockReturnValueOnce(.99).mockReturnValueOnce(.01)
      .mockReturnValueOnce(.99).mockReturnValueOnce(.99).mockReturnValueOnce(.99);
    contribute("a", 4); contribute("b", 4); defeat();
    expect([...room.state.lootDrops.values()].filter(drop => drop.itemId === "leather_armour").map(drop => drop.ownerId)).toEqual(["a"]);
  });
  it("prevents stealing and duplicate collection of another player's equipment", () => {
    const { room, internal, contribute, defeat } = fixture(); vi.mocked(Math.random)
      .mockReturnValueOnce(.99).mockReturnValueOnce(.01).mockReturnValue(.99); contribute("a", 8); defeat();
    const [id] = [...room.state.lootDrops].find(([, drop]) => drop.itemId === "fang_dagger")!;
    const send = vi.fn(); internal.handleLootCollect({ sessionId: "b", send }, { dropId: id, equip: false });
    expect(send).toHaveBeenLastCalledWith("loot:result", expect.objectContaining({ ok: false })); expect(room.state.lootDrops.has(id)).toBe(true);
    internal.handleLootCollect({ sessionId: "a", send }, { dropId: id, equip: false });
    internal.handleLootCollect({ sessionId: "a", send }, { dropId: id, equip: false });
    expect(room.state.players.get("a")!.inventory.get("fang_dagger")?.quantity).toBe(1);
    expect(room.state.players.get("b")!.inventory.size).toBe(0);
  });
  it("requires the owner to collect materials, leaving full stacks and expiring leftovers", () => {
    const { room, internal, contribute, defeat } = fixture(); contribute("a", 8); defeat();
    const a = room.state.players.get("a")!; a.x = 110;
    internal.resolveLootPickups(10000); expect(room.state.players.get("b")!.inventory.size).toBe(0);
    a.x = 101; const full = new InventoryItemState(); full.quantity = 65535; a.inventory.set("moss_fibre", full);
    const fangId = [...room.state.lootDrops].find(([, drop]) => drop.ownerId === "a" && drop.itemId === "crawler_fang")![0];
    const fibreId = [...room.state.lootDrops].find(([, drop]) => drop.ownerId === "a" && drop.itemId === "moss_fibre")![0];
    const send = vi.fn(); internal.handleLootCollect({ sessionId: "a", send }, { dropId: fangId, action: "keep" });
    internal.handleLootCollect({ sessionId: "a", send }, { dropId: fibreId, action: "keep" });
    expect(a.inventory.get("crawler_fang")?.quantity).toBe(1);
    expect(room.state.lootDrops.has(fibreId)).toBe(true);
    expect(send).toHaveBeenLastCalledWith("loot:result", expect.objectContaining({ ok: false }));
    internal.resolveLootPickups(70000); expect(room.state.lootDrops.size).toBe(0);
  });
  it("records actual weapon damage and caps overkill at remaining health", () => {
    const { room, internal, mob, rewards } = fixture(); mob.maxHealth = 20; mob.health = 1;
    internal.applyWeaponHit("a", { mainHandId: "stone_core_hammer", step: 3 }, "mob", 10000);
    expect(mob.health).toBe(0); expect(rewards).toEqual([]); expect(room.state.lootDrops.size).toBe(0);
    const next = new MobState(); Object.assign(next, { x: 100.5, y: 1, z: 100.5, health: 2, maxHealth: 8, armor: 0 }); room.state.mobs.set("next", next);
    internal.applyWeaponHit("a", { mainHandId: "longsword", step: 1 }, "next", 10000);
    internal.applyWeaponHit("b", { mainHandId: "longsword", step: 1 }, "next", 10000);
    expect(rewards.map(reward => reward.playerId)).toEqual(["a", "b"]);
  });
  it("records power and projectile contributions only when damage resolves", () => {
    const { room, internal, mob } = fixture();
    internal.pendingPowers.set("a", { requestId: "power", powerId: "shockwave", yaw: -90, impactAt: 10000 });
    expect(internal.combatContributions.eligible("mob", mob, room.state.players, 10000)).toEqual([]);
    internal.resolvePendingPowers(10000);
    expect(internal.combatContributions.eligible("mob", mob, room.state.players, 10000)).toContain("a");
    internal.pendingAttacks.set("b", { requestId: "arrow", mainHandId: "bow", step: 1, yaw: -90, impactAt: 10000 });
    internal.resolvePendingAttacks(10000);
    expect(internal.combatContributions.eligible("mob", mob, room.state.players, 10000)).not.toContain("b");
    internal.resolveWeaponProjectiles(10500);
    expect(internal.combatContributions.eligible("mob", mob, room.state.players, 10500)).toContain("b");
  });
});
