import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { InventoryItemState, PlayerState, WorldState } from "./schema.js";
import { equipmentForItem, WEAPON_ATTACK_DEFINITIONS } from "@blockcraft/protocol";
import { chooseBuildPath, parseBuildPathState, serializeBuildPathState } from "./build-paths.js";
afterEach(() => vi.restoreAllMocks());
function setup(wall = false) {
  const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
  Object.defineProperty(room, "readWorldBlock", { value: (x: number, y: number) => y <= 7 || wall && x === 42 && y <= 10 ? Block.Stone : Block.Air });
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
  vi.spyOn(Date, "now").mockReturnValue(10000);
  const player = new PlayerState(); Object.assign(player, { x: 40, y: 8, z: 18, level: 5 }); room.state.players.set("a", player);
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
  it("keeps its basic damage without taking over the Calling Special slot", () => {
    const { internal, player, client } = setup();
    expect(equipmentForItem("venom_focus")).toBe("venom_focus");
    expect(WEAPON_ATTACK_DEFINITIONS.venom_focus.attacks[0].damage).toBe(WEAPON_ATTACK_DEFINITIONS.acid_gland_focus.attacks[0].damage);
    expect(WEAPON_ATTACK_DEFINITIONS.venom_focus.attacks[0].durationMs).toBeLessThan(WEAPON_ATTACK_DEFINITIONS.acid_gland_focus.attacks[0].durationMs);
    expect(player.equippedSpecial).toBe("");
    internal.handleSpecialEquip(client, { requestId: "special", specialId: "bramble_snare" });
    expect(player.equippedSpecial).toBe("");
    internal.handleMainHandEquip(client, { requestId: "unequip", mainHandId: "longsword" });
    expect(player.equippedSpecial).toBe("");
  });
  it("lets an Assassin use Death Mark on F while Venom Focus is equipped", () => {
    const { internal, player, client } = setup();
    player.huntLoadoutsJson = serializeBuildPathState(chooseBuildPath(parseBuildPathState("{}"), "assassin"));
    internal.handleCallingAbility(client, { requestId: "assassin-special", slot: "special", yaw: 90 });
    expect(client.send).toHaveBeenCalledWith("calling:ability", expect.objectContaining({ abilityId: "assassin_death_mark", slot: "special" }));
  });
  it("keeps Venom Fan dormant even with the weapon equipped", () => {
    const { internal, player, client, mob } = setup(); const before = mob.health;
    player.equippedSpecial = "venom_fan";
    internal.handleSpecial(client, { requestId: "fan", specialId: "venom_fan", yaw: 90 });
    expect(internal.pendingWeaponProjectiles.size).toBe(0);
    expect(mob.health).toBe(before);
    expect(player.specialCooldownUntil).toBe(0);
    expect(client.send).toHaveBeenCalledWith("action:rejected", expect.objectContaining({ requestId: "fan", reason: "missing" }));
  });
  it("rejects an old saved Venom Fan selection without creating projectiles", () => {
    const { internal, player, client, mob } = setup(true); const before = mob.health;
    player.equippedSpecial = "venom_fan";
    internal.handleSpecial(client, { requestId: "fan", specialId: "venom_fan", yaw: 90 });
    internal.resolveWeaponProjectiles(10450); expect(mob.health).toBe(before);
    player.inventory.delete("venom_focus");
    internal.handleSpecial(client, { requestId: "invalid", specialId: "venom_fan", yaw: 90 });
    expect(internal.pendingWeaponProjectiles.size).toBe(0);
    expect(client.send).toHaveBeenCalledWith("action:rejected", expect.objectContaining({ reason: "missing" }));
  });
});
