import { afterEach, describe, expect, it, vi } from "vitest";
import { Block, type WorldBlockReader } from "@blockcraft/voxel-world";
import { WorldRoom } from "../src/game-room.js";
import { MobState, PlayerState, WorldState } from "../src/schema.js";
afterEach(() => vi.restoreAllMocks());
const flat: WorldBlockReader = (_x, y) => y <= 0 ? Block.Stone : Block.Air;
function fixture(read = flat) {
  const room = new WorldRoom(); room.setState(new WorldState());
  Object.defineProperty(room, "readWorldBlock", { value: read });
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const player = new PlayerState(); Object.assign(player, { x: 109, y: 1, z: 100.5 });
  room.state.players.set("player", player);
  const add = (id: string, x: number) => {
    const mob = new MobState(); Object.assign(mob, { x, y: 1, z: 100.5 });
    room.state.mobs.set(id, mob); return mob;
  };
  add("victim", 100.5);
  return { room, player, add, internal: room as any };
}
describe("authoritative mob assistance", () => {
  it("a real weapon impact recruits a direct witness but does not propagate through it", () => {
    const { room, add, internal } = fixture(); const ally = add("ally", 104); add("chain", 108);
    internal.applyWeaponHit("player", { mainHandId: "bow", step: 1 }, "victim", 10000);
    expect(internal.mobAwareness.get("ally").targetId).toBe("player");
    expect(ally.awarenessState).toBe("engaged"); expect(ally.alertUntil).toBe(10900);
    expect(internal.mobAwareness.has("chain")).toBe(false);
    expect(room.state.mobs.get("victim")!.health).toBeLessThan(8);
  });
  it("requires a clear view of the attacked ally as well as the attacker", () => {
    const { add, internal } = fixture((x, y) => y <= 0 || (x === 102 && y <= 3) ? Block.Stone : Block.Air);
    add("ally", 104); internal.alertHitMob("victim", "player", 10000);
    expect(internal.mobAwareness.has("ally")).toBe(false);
  });
  it("does not steal targets, interrupt actions, recruit bosses or override failed-route cooldowns", () => {
    const { add, internal } = fixture();
    add("busy", 102); internal.mobAwareness.set("busy", { targetId: "other", lastSeen: null, seenAt: 0 });
    add("windup", 103).combatState = "windup";
    add("boss", 104).isChampion = true;
    add("blocked", 105); internal.mobUnreachableUntil.set("blocked", 20000);
    internal.alertHitMob("victim", "player", 10000);
    expect(internal.mobAwareness.get("busy").targetId).toBe("other");
    for (const id of ["windup", "boss", "blocked"]) expect(internal.mobAwareness.has(id)).toBe(false);
  });
  it("rate-limits each victim's assistance broadcasts", () => {
    const { add, internal } = fixture(); add("first", 102);
    internal.alertHitMob("victim", "player", 10000); add("late", 103);
    internal.alertHitMob("victim", "player", 11000);
    expect(internal.mobAwareness.has("late")).toBe(false);
    internal.alertHitMob("victim", "player", 11600);
    expect(internal.mobAwareness.get("late").targetId).toBe("player");
  });
  it("does not recruit against players in town or across cave boundaries", () => {
    const { player, add, internal } = fixture(); add("ally", 103);
    Object.assign(player, { x: 8.5, z: 8.5 }); internal.alertHitMob("victim", "player", 10000);
    expect(internal.mobAwareness.size).toBe(0);
    Object.assign(player, { x: 109, z: 100.5 }); add("shallow-cave-crawler", 104);
    internal.alertHitMob("victim", "player", 12000);
    expect(internal.mobAwareness.has("shallow-cave-crawler")).toBe(false);
  });
});
