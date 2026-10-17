import { describe, expect, it, vi } from "vitest";
import { WorldRoom } from "./game-room.js";
import { PlayerState, WorldState } from "./schema.js";

describe("starter ability progression", () => {
  it("rejects early casts and equips until their level milestones", () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any;
    const player = new PlayerState();
    player.equippedPower = "shockwave";
    player.equippedSpecial = "hunters_mark";
    room.state.players.set("newcomer", player);
    const client = { sessionId: "newcomer", send: vi.fn() } as any;
    internal.handlePower(client, { requestId: "power-cast", powerId: "shockwave", yaw: 0 });
    internal.handlePowerEquip(client, { requestId: "power-equip", powerId: "shockwave" });
    internal.handleSpecial(client, { requestId: "special-cast", specialId: "hunters_mark", yaw: 0 });
    internal.handleSpecialEquip(client, { requestId: "special-equip", specialId: "bramble_snare" });
    expect(client.send).toHaveBeenCalledTimes(4);
    expect(client.send.mock.calls.map(([, message]: [string, { reason: string }]) => message.reason))
      .toEqual(["missing", "missing", "missing", "missing"]);
    player.level = 2;
    client.send.mockClear();
    internal.handlePowerEquip(client, { requestId: "power-equip-2", powerId: "eruption" });
    expect(player.equippedPower).toBe("shockwave");
    internal.handleSpecialEquip(client, { requestId: "special-equip-2", specialId: "bramble_snare" });
    expect(client.send).toHaveBeenCalledWith("action:rejected", expect.objectContaining({ reason: "missing" }));
    player.level = 4;
    internal.handleSpecialEquip(client, { requestId: "special-equip-4", specialId: "bramble_snare" });
    expect(player.equippedSpecial).toBe("hunters_mark");
    player.level = 5;
    internal.handlePowerEquip(client, { requestId: "power-equip-5", powerId: "eruption" });
    internal.handlePower(client, { requestId: "power-cast-5", powerId: "shockwave", yaw: 0 });
    internal.handleSeismicMasteryEquip(client, { requestId: "mastery-5", masteryId: "tectonic_stand" });
    expect(player.equippedPower).toBe("shockwave");
    expect(client.send).toHaveBeenCalledWith("action:rejected", expect.objectContaining({ requestId: "power-equip-5", reason: "missing" }));
    expect(client.send).toHaveBeenCalledWith("action:rejected", expect.objectContaining({ requestId: "power-cast-5", reason: "missing" }));
    expect(client.send).toHaveBeenCalledWith("action:rejected", expect.objectContaining({ requestId: "mastery-5", reason: "missing" }));
    internal.handleSpecialEquip(client, { requestId: "special-equip-5", specialId: "bramble_snare" });
    expect(player.equippedSpecial).toBe("bramble_snare");
  });
});
