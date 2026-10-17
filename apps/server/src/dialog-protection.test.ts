import { describe, expect, it, vi } from "vitest";
import { WorldRoom } from "./game-room.js";
import { PlayerState, WorldState } from "./schema.js";

describe("interactive dialog protection", () => {
  function fixture() {
    const room = new WorldRoom();
    room.setState(new WorldState());
    const internal = room as any;
    internal.roomKind = "overworld";
    const player = new PlayerState();
    Object.assign(player, { x: 50, y: 8, z: 50, health: 5, maxHealth: 5, invulnerableUntil: 0 });
    room.state.players.set("hero", player);
    const client = { sessionId: "hero", send: vi.fn() };
    return { room, internal, player, client };
  }

  it("blocks incoming damage only while the dialog is open", () => {
    const { internal, player, client } = fixture();
    internal.setProtectedDialog(client, { open: true });
    expect(internal.damagePlayer("field-test", "hero", 2, Date.now(), false)).toBe(false);
    expect(player.health).toBe(5);
    internal.setProtectedDialog(client, { open: false });
    expect(internal.damagePlayer("field-test", "hero", 2, Date.now(), false)).toBe(true);
    expect(player.health).toBe(3);
  });

  it("cancels buffered actions when protection begins", () => {
    const { internal, client } = fixture();
    internal.pendingAttacks.set("hero", { requestId: "attack" });
    internal.pendingPowers.set("hero", { requestId: "power" });
    internal.setProtectedDialog(client, { open: true });
    expect(internal.pendingAttacks.has("hero")).toBe(false);
    expect(internal.pendingPowers.has("hero")).toBe(false);
    expect(internal.movementInputs.get("hero").request.forward).toBe(0);
  });
});
