import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { AIM_EYE_HEIGHT, type MainHandId } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { MobState, PlayerState, WorldState } from "./schema.js";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture(mainHandId: MainHandId, targetY: number, wall = false, distance = 3) {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
  internal.rapidPractice = true;
  Object.defineProperty(room, "readWorldBlock", { value: (x: number) => wall && x === 201 ? Block.Stone : Block.Air });
  const player = new PlayerState(); Object.assign(player, { x: 200, y: 8, z: 200, mainHandId });
  const target = new MobState(); Object.assign(target, { x: 200 + distance, y: targetY, z: 200, health: 30, maxHealth: 30 });
  room.state.players.set("hero", player); room.state.mobs.set("target", target);
  const client = { sessionId: "hero", send: vi.fn() } as any; room.clients.push(client);
  const events: { type: string; payload: any }[] = [];
  vi.spyOn(room, "broadcast").mockImplementation((type, payload) => { events.push({ type: String(type), payload }); });
  const fire = (elevation?: number) => {
    internal.handleAttack(client, { requestId: "attack-1", yaw: 90, ...(elevation === undefined ? {} : { elevation }) });
    const contactAt = internal.pendingAttacks.get("hero").impactAt;
    for (let now = contactAt - 50; now <= contactAt + 500; now += 10) {
      internal.resolvePendingAttacks(now); internal.resolveWeaponProjectiles(now);
    }
  };
  return { internal, target, events, fire, client };
}

describe("first-person elevation on authoritative attacks", () => {
  for (const weapon of ["forged_sword", "matriarch_edge", "cinderfang_blade", "forged_bow", "forged_focus"] as const)
    it.each([6.5, 8, 9.55])(`${weapon} hits a clear target standing at height %s`, targetY => {
      const { target, events, fire } = fixture(weapon, targetY);
      const elevation = Math.atan2(targetY + .72 - (8 + AIM_EYE_HEIGHT), 3);
      fire(elevation);
      expect(target.health).toBeLessThan(30);
      const release = events.find(event => event.type === "combat:projectile")!.payload;
      expect(release.origin).toEqual({ x: 200, y: 8 + AIM_EYE_HEIGHT, z: 200 });
      expect(Math.atan2(release.end.y - release.origin.y, release.end.x - release.origin.x)).toBeCloseTo(elevation);
    });
  it.each([6.5, 9.55])("terrain still blocks an aimed attack toward height %s", targetY => {
    const { target, events, fire } = fixture("forged_sword", targetY, true);
    fire(Math.atan2(targetY + .72 - (8 + AIM_EYE_HEIGHT), 3));
    expect(target.health).toBe(30);
    expect(events.find(event => event.type === "combat:projectile-resolved")?.payload.reason).toBe("terrain");
  });
  it("does not steer an aimed projectile toward an enemy above a level crosshair", () => {
    const { target, fire } = fixture("forged_sword", 9.55); fire(0);
    expect(target.health).toBe(30);
  });
  it("preserves the old horizontal flight when elevation is omitted", () => {
    const { target, events, fire } = fixture("forged_sword", 8); fire();
    expect(target.health).toBe(28);
    const release = events.find(event => event.type === "combat:projectile")!.payload;
    expect(release.origin).toBeUndefined(); expect(release.end).toBeUndefined(); expect(release.targetY).toBe(8);
  });
  it.each([7, 9])("lets a close-range dagger follow the view toward height %s", targetY => {
    const { target, fire } = fixture("fang_dagger", targetY, false, 1);
    fire(targetY > 8 ? Math.PI / 4 : -Math.PI / 4);
    expect(target.health).toBeLessThan(30);
  });
  it("ignores first-person elevation in the archived combat mode", () => {
    const { internal, client } = fixture("forged_sword", 8); internal.rapidPractice = false;
    internal.handleAttack(client, { requestId: "legacy", yaw: 90, elevation: .5 });
    expect(internal.pendingAttacks.get("hero").elevation).toBeUndefined();
  });
});
