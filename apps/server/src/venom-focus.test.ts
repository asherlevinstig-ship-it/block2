import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { InventoryItemState, PlayerState, WorldState } from "./schema.js";
import { equipmentForItem, WEAPON_ATTACK_DEFINITIONS } from "@blockcraft/protocol";
afterEach(() => vi.restoreAllMocks());
function setup(wall = false) {
  const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
  Object.defineProperty(room, "readWorldBlock", { value: (x: number, y: number) => y <= 7 || wall && x === 42 && y <= 10 ? Block.Stone : Block.Air });
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
  vi.spyOn(Date, "now").mockReturnValue(10000);
  const player = new PlayerState(); Object.assign(player, { x: 40, y: 8, z: 18 }); room.state.players.set("a", player);
  const item = new InventoryItemState(); item.quantity = 1; player.inventory.set("venom_focus", item);
  const client = { sessionId: "a", send: vi.fn() } as any;
  internal.handleMainHandEquip(client, { requestId: "equip", mainHandId: "venom_focus" });
  internal.registerMob("target", "moss_crawler", { x: 44, y: 8, z: 18 });
  const mob = room.state.mobs.get("target")!;
  return { room, internal, player, client, mob };
}
describe("Venom Focus", () => {
  it("keeps basic ranged shots on the requested yaw despite an off-axis nearby target", () => {
    const { internal, room, mob } = setup();
    mob.x = 43; mob.z = 20;
    internal.pendingAttacks.set("a", { requestId: "aim", mainHandId: "venom_focus", step: 1, yaw: 90, impactAt: 10000 });
    internal.resolvePendingAttacks(10000);
    const message = (room.broadcast as any).mock.calls.find((call: any[]) => call[0] === "combat:projectile")[1];
    expect(message.targetX).toBeCloseTo(47.5);
    expect(message.targetZ).toBeCloseTo(18);
    const before = mob.health;
    internal.resolveWeaponProjectiles(10220);
    expect(mob.health).toBe(before);
  });
  it("is owned equipment with familiar basic damage and an automatically bound special", () => {
    const { internal, player, client } = setup();
    expect(equipmentForItem("venom_focus")).toBe("venom_focus");
    expect(WEAPON_ATTACK_DEFINITIONS.venom_focus.attacks).toEqual(WEAPON_ATTACK_DEFINITIONS.acid_gland_focus.attacks);
    expect(player.equippedSpecial).toBe("venom_fan");
    internal.handleSpecialEquip(client, { requestId: "special", specialId: "bramble_snare" });
    expect(player.equippedSpecial).toBe("venom_fan");
    internal.handleMainHandEquip(client, { requestId: "unequip", mainHandId: "longsword" });
    expect(player.equippedSpecial).toBe("hunters_mark");
  });
  it("launches three diverging shots and deals damage only on actual impact", () => {
    const { internal, player, client, mob } = setup(); const before = mob.health;
    internal.handleSpecial(client, { requestId: "fan", specialId: "venom_fan", yaw: 90 });
    expect(internal.pendingWeaponProjectiles.size).toBe(3);
    expect(mob.health).toBe(before);
    expect(player.specialCooldownUntil).toBe(18000);
    const shots = [...internal.pendingWeaponProjectiles.values()] as any[];
    expect(shots[0].end.z).not.toBe(shots[1].end.z);
    expect(shots[2].end.z).not.toBe(shots[1].end.z);
    internal.handleSpecial(client, { requestId: "spam", specialId: "venom_fan", yaw: 90 });
    expect(internal.pendingWeaponProjectiles.size).toBe(3);
    expect(client.send).toHaveBeenCalledWith("action:rejected", expect.objectContaining({ reason: "cooldown" }));
    internal.resolveWeaponProjectiles(10450);
    expect(mob.health).toBeLessThan(before);
  });
  it("blocks fan damage through walls and rejects casting without the owned weapon", () => {
    const { internal, player, client, mob } = setup(true); const before = mob.health;
    internal.handleSpecial(client, { requestId: "fan", specialId: "venom_fan", yaw: 90 });
    internal.resolveWeaponProjectiles(10450); expect(mob.health).toBe(before);
    player.specialCooldownUntil = 0; player.inventory.delete("venom_focus");
    internal.handleSpecial(client, { requestId: "invalid", specialId: "venom_fan", yaw: 90 });
    expect(internal.pendingWeaponProjectiles.size).toBe(0);
    expect(client.send).toHaveBeenCalledWith("action:rejected", expect.objectContaining({ reason: "compatibility" }));
  });
});
