import { afterEach, describe, expect, it, vi } from "vitest";
import { Block, type WorldBlockReader } from "@blockcraft/voxel-world";
import { WorldRoom } from "../src/game-room.js";
import { MobState, PlayerState, WorldState } from "../src/schema.js";

const flat: WorldBlockReader = (_x, y) => y <= 0 ? Block.Stone : Block.Air;

function fixture() {
  const room = new WorldRoom(); room.setState(new WorldState());
  Object.defineProperty(room, "readWorldBlock", { value: flat });
  const events: { type: string; payload: any }[] = [];
  vi.spyOn(room, "broadcast").mockImplementation((type, payload) => { events.push({ type: String(type), payload }); });
  vi.spyOn(room as any, "persistPlayer").mockResolvedValue(undefined);
  const player = new PlayerState(); Object.assign(player, { x: 100.5, y: 1, z: 100.5, health: 5, maxHealth: 5 });
  const mob = new MobState(); Object.assign(mob, { x: 102, y: 1, z: 100.5, health: 30, maxHealth: 30 });
  room.state.players.set("player", player); room.state.mobs.set("mob", mob);
  return { room, internal: room as any, player, mob, events };
}

afterEach(() => vi.restoreAllMocks());

describe("authoritative Hunt set bonuses", () => {
  it("restores Fang finisher stamina and executes a weakened target", () => {
    const { internal, player, mob, events } = fixture();
    player.armourId = "fangstalker_wrap"; player.stamina = 50; mob.health = 8;
    internal.applyWeaponHit("player", { mainHandId: "fang_dagger", step: 3 }, "mob", 10_000);
    const hit = events.find(event => event.type === "combat:hit")!.payload;
    expect(hit).toMatchObject({ setBonus: "fang", setBonusDamage: 2, staminaRestored: 12 });
    expect(player.stamina).toBe(62);
  });

  it("creates a ticking Venom pool and advances the Special cooldown", () => {
    const { internal, player, mob, events } = fixture();
    player.armourId = "venomweave_mantle"; player.specialCooldownUntil = 20_000;
    internal.applyWeaponHit("player", { mainHandId: "acid_gland_focus", step: 1 }, "mob", 9_000);
    internal.applyWeaponHit("player", { mainHandId: "acid_gland_focus", step: 1 }, "mob", 9_500);
    internal.applyWeaponHit("player", { mainHandId: "acid_gland_focus", step: 1 }, "mob", 10_000);
    const hit = events.filter(event => event.type === "combat:hit" && !event.payload.secondary).at(-1)!.payload;
    expect(hit).toMatchObject({ setBonus: "venom", cooldownReducedMs: 1_500 });
    expect(player.specialCooldownUntil).toBe(18_500);
    expect(internal.venomSetPools.size).toBe(1);
    const healthAfterBolt = mob.health;
    internal.resolveVenomSetPools(10_700);
    expect(mob.health).toBeLessThan(healthAfterBolt);
    expect(events.some(event => event.type === "combat:mob-hazard" && event.payload.kind === "acid")).toBe(true);
  });

  it("turns a Crusher stagger hit into a shockwave and temporary armour", () => {
    const { internal, player, mob, events } = fixture();
    player.armourId = "worldsplitter_plate"; mob.combatState = "stagger";
    internal.applyWeaponHit("player", { mainHandId: "stone_core_hammer", step: 1 }, "mob", 10_000);
    expect(events.find(event => event.type === "combat:hit" && !event.payload.secondary)?.payload)
      .toMatchObject({ setBonus: "crusher", setBonusDamage: 1 });
    expect(internal.crusherSetGuardUntil.get("player")).toBe(13_000);
    player.health = 5;
    internal.damagePlayer("mob", "player", 5, 10_500, false);
    expect(player.health).toBe(4);
  });
});
