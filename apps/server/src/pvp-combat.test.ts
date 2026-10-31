import { describe, expect, it, vi } from "vitest";
import { PVP_MURDERER_DURATION_MS, pvpMurdererUntil } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { PlayerState, WorldState } from "./schema.js";

function fixture(attackerPosition = { x: 340, z: 106 }, targetPosition = { x: 342, z: 106 }) {
  const room = new WorldRoom();
  room.setState(new WorldState());
  const internal = room as any;
  internal.roomKind = "practice";
  internal.rapidPractice = true;
  internal.persistPlayer = vi.fn(async () => {});
  const broadcast = vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const attacker = new PlayerState();
  Object.assign(attacker, { name: "Redblade", x: attackerPosition.x, y: 8, z: attackerPosition.z,
    health: 5, maxHealth: 5, mainHandId: "longsword" });
  const target = new PlayerState();
  Object.assign(target, { name: "Wayfarer", x: targetPosition.x, y: 8, z: targetPosition.z,
    health: 5, maxHealth: 5 });
  room.state.players.set("attacker", attacker);
  room.state.players.set("target", target);
  return { room, internal, attacker, target, broadcast };
}

const attack = { requestId: "attack-pvp", mainHandId: "longsword", step: 1, yaw: 90, impactAt: 1_000 };

describe("server-authoritative tower PvP", () => {
  it("rejects player damage in the Floor 1 sanctuary", () => {
    const { internal, target, broadcast } = fixture({ x: 305, z: 106 }, { x: 307, z: 106 });
    expect(internal.applyPvpWeaponHit("attacker", attack, "target", 1_000)).toBe(false);
    expect(target.health).toBe(5);
    expect(broadcast).not.toHaveBeenCalledWith("combat:pvp-hit", expect.anything());
  });

  it("damages players in Floor 1 combat areas", () => {
    const { internal, target, broadcast } = fixture();
    expect(internal.applyPvpWeaponHit("attacker", attack, "target", 1_000)).toBe(true);
    expect(target.health).toBeLessThan(5);
    expect(broadcast).toHaveBeenCalledWith("combat:pvp-hit", expect.objectContaining({
      attackerId: "attacker", targetId: "target", defeated: false,
    }));
  });

  it("marks a confirmed player killer for three days without deleting equipment", () => {
    const { internal, attacker, target, broadcast } = fixture();
    target.health = 1;
    target.mainHandId = "forged_sword";
    const now = 10_000;
    expect(internal.applyPvpWeaponHit("attacker", attack, "target", now)).toBe(true);
    expect(target.health).toBe(0);
    expect(target.mainHandId).toBe("forged_sword");
    expect(pvpMurdererUntil(attacker.huntLoadoutsJson)).toBe(now + PVP_MURDERER_DURATION_MS);
    expect(broadcast).toHaveBeenCalledWith("combat:pvp-kill", expect.objectContaining({
      attackerId: "attacker", targetId: "target", murdererUntil: now + PVP_MURDERER_DURATION_MS,
    }));
  });
});
