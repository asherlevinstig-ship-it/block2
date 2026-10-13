import { afterEach, describe, expect, it, vi } from "vitest";
import { Block, CAVE_SHALLOW_HOME, CAVE_DEEP_HOME, CAVE_HIDDEN_HOME, playerCollides } from "@blockcraft/voxel-world";
import { decodeLootBagItems } from "@blockcraft/protocol";
import { CAVE_ENCOUNTERS, caveEncounterAllows } from "../src/cave-encounters.js";
import { WorldRoom } from "../src/game-room.js";
import { WorldState, PlayerState, InventoryItemState } from "../src/schema.js";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture() {
  vi.useFakeTimers(); vi.setSystemTime(10_000);
  const room = new WorldRoom(); room.setState(new WorldState());
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const internal = room as any;
  internal.registerMob("shallow-cave-crawler", "moss_crawler", CAVE_SHALLOW_HOME);
  internal.registerMob("deep-cave-spitter", "cave_spitter", CAVE_DEEP_HOME);
  internal.registerMob("buried-vault-crawler", "moss_crawler", { x: 54.5, y: 1, z: 10.5 });
  internal.registerMob("buried-chamber-brute", "stone_brute", CAVE_HIDDEN_HOME);
  return { room, internal };
}
describe("chamber-specific encounters", () => {
  it("excludes stairs, other floors and neighbouring chambers", () => {
    expect(caveEncounterAllows("shallow-cave-crawler", CAVE_SHALLOW_HOME)).toBe(true);
    expect(caveEncounterAllows("shallow-cave-crawler", { x: 35.5, y: 4, z: 8.5 })).toBe(false);
    expect(caveEncounterAllows("deep-cave-spitter", { ...CAVE_DEEP_HOME, y: 8 })).toBe(false);
    expect(caveEncounterAllows("deep-cave-spitter", CAVE_HIDDEN_HOME)).toBe(false);
    expect(caveEncounterAllows("buried-chamber-brute", CAVE_DEEP_HOME)).toBe(false);
    expect(caveEncounterAllows("buried-vault-crawler", CAVE_HIDDEN_HOME)).toBe(true);
    expect(caveEncounterAllows("ordinary-surface-mob", { x: 100, y: 8, z: 100 })).toBe(true);
  });
  it("keeps the iron and silver route fights inside their separate wings", () => {
    const ironWing = { x: 101.5, y: 1, z: -6.5 };
    const silverWing = { x: 103.5, y: 1, z: 30.5 };
    expect(caveEncounterAllows("depths-iron-warden", ironWing)).toBe(true);
    expect(caveEncounterAllows("depths-iron-warden", silverWing)).toBe(false);
    expect(caveEncounterAllows("depths-silver-spitter-a", silverWing)).toBe(true);
    expect(caveEncounterAllows("depths-silver-spitter-a", ironWing)).toBe(false);
  });
  it("patrols real cave terrain without entering walls or leaving its chamber", () => {
    const { room, internal } = fixture();
    const travelled = new Map<string, number>();
    for (let tick = 0; tick < 500; tick++) {
      vi.setSystemTime(10_000 + tick * 100);
      const previous = new Map([...room.state.mobs].map(([id, mob]) => [id, { x: mob.x, z: mob.z }]));
      internal.simulatePlayers(0.1);
      for (const [id, mob] of room.state.mobs) {
        expect(caveEncounterAllows(id, mob)).toBe(true);
        expect(playerCollides(internal.readWorldBlock, mob.x, mob.y, mob.z)).toBe(false);
        const before = previous.get(id)!;
        const distance = Math.hypot(mob.x - before.x, mob.z - before.z);
        expect(distance).toBeLessThanOrEqual(0.091);
        travelled.set(id, (travelled.get(id) ?? 0) + distance);
      }
    }
    for (const id of Object.keys(CAVE_ENCOUNTERS)) expect(travelled.get(id)).toBeGreaterThan(2);
  });
  it("keeps knockback and lunges inside the room", () => {
    const { room, internal } = fixture();
    for (const [id, mob] of room.state.mobs) {
      internal.displaceMob(id, mob, { x: -20, z: 0 });
      expect(caveEncounterAllows(id, mob)).toBe(true);
      internal.mobCommittedAim.set(id, { x: mob.x - 10, y: mob.y, z: mob.z, yaw: -90 });
      internal.updateMobStrikeOrigin(id, mob);
      expect(caveEncounterAllows(id, { x: mob.attackStrikeX, y: mob.attackStrikeY, z: mob.attackStrikeZ })).toBe(true);
    }
  });
  it("abandons windup when the player leaves, without healing or teleporting", () => {
    const { room, internal } = fixture();
    const mob = room.state.mobs.get("buried-chamber-brute")!;
    const player = new PlayerState(); Object.assign(player, CAVE_DEEP_HOME); room.state.players.set("visitor", player);
    mob.health -= 2; const health = mob.health, x = mob.x, z = mob.z;
    mob.combatState = "windup"; mob.targetId = "visitor"; mob.stateUntil = 10_100;
    internal.simulatePlayers(0.1);
    expect(mob.combatState).toBe("recover"); expect(mob.targetId).toBe("");
    expect(mob.health).toBe(health); expect(mob.x).toBe(x); expect(mob.z).toBe(z);
    expect(internal.damagePlayer("buried-chamber-brute", "visitor", 2, 10_000)).toBe(false);
  });
  it("keeps pursuit bounded and ignores players on the surface overhead", () => {
    const { room, internal } = fixture();
    const player = new PlayerState(); Object.assign(player, { ...CAVE_DEEP_HOME, y: 8 }); room.state.players.set("visitor", player);
    internal.simulatePlayers(0.1);
    expect(internal.mobPatrols.has("deep-cave-spitter")).toBe(true);
    Object.assign(player, { x: 51.5, y: 1, z: 10.5 });
    for (let tick = 0; tick < 100; tick++) {
      vi.setSystemTime(11_000 + tick * 100); internal.simulatePlayers(0.1);
      expect(caveEncounterAllows("deep-cave-spitter", room.state.mobs.get("deep-cave-spitter")!)).toBe(true);
    }
  });
  it("drops the Stone Warden's guaranteed core and personal lantern once on defeat", () => {
    // Keep optional equipment rolls out of this guaranteed-reward assertion.
    vi.spyOn(Math, "random").mockReturnValue(.99);
    const { room, internal } = fixture();
    const mob = room.state.mobs.get("buried-chamber-brute")!;
    const visitor = new PlayerState(); visitor.x = mob.x + 3; visitor.y = mob.y; visitor.z = mob.z; visitor.miningExpeditionStage = 5;
    room.state.players.set("visitor", visitor);
    internal.combatContributions.record("buried-chamber-brute", "visitor", mob.maxHealth, 10_000);
    internal.defeatMob("buried-chamber-brute", mob, "visitor", 10_000);
    expect(visitor.miningExpeditionStage).toBe(6);
    const bag = [...room.state.lootDrops.values()][0]!;
    expect(decodeLootBagItems(bag.contentsJson)).toEqual([{ itemId: "stone_core", quantity: 1 }, { itemId: "miners_lantern", quantity: 1 },
      { itemId: "stone_warden_lantern", quantity: 1 }]);
    internal.simulatePlayers(0.1);
    expect(room.state.lootDrops.size).toBe(1);
  });
  it("converts the utility lantern on repeat clears while retaining the Warden signature drop", () => {
    vi.spyOn(Math, "random").mockReturnValue(.99);
    const { room, internal } = fixture();
    const mob = room.state.mobs.get("buried-chamber-brute")!;
    const visitor = new PlayerState(); const lantern = new InventoryItemState(); lantern.quantity = 1;
    const relic = new InventoryItemState(); relic.quantity = 1;
    visitor.inventory.set("miners_lantern", lantern); visitor.inventory.set("stone_warden_lantern", relic); room.state.players.set("visitor", visitor);
    internal.spawnLootDrops("buried-chamber-brute", mob, 10_000, "visitor");
    const bag = [...room.state.lootDrops.values()][0]!;
    expect(decodeLootBagItems(bag.contentsJson)).toEqual([
      { itemId: "stone_core", quantity: 2 }, { itemId: "silver_ore", quantity: 3 },
      { itemId: "stone_warden_lantern", quantity: 1 },
    ]);
  });
});
