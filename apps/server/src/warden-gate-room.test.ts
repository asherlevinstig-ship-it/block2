import { describe, expect, it } from "vitest";
import { Block, REALM_WARDEN_GATE_POSITION } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { ForestPortalState, PlayerState, WorldState } from "./schema.js";

function fixture(unlocked: boolean) {
  const room = new WorldRoom(); room.setState(new WorldState());
  Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
  const player = new PlayerState(); Object.assign(player, REALM_WARDEN_GATE_POSITION, { realmWardenCleared: unlocked });
  room.state.players.set("hero", player);
  const gate = new ForestPortalState(); Object.assign(gate, REALM_WARDEN_GATE_POSITION, { kind: "warden-gate" });
  room.state.portals.set("warden-gate", gate);
  const notices: string[] = [];
  const client = { sessionId: "hero", send: (type: string, value: unknown) => { if (type === "portal:notice") notices.push(String(value)); } };
  return { room, player, client, notices };
}

describe("persistent Warden Gate", () => {
  it("keeps the repeat challenge locked before the first Realm Warden clear", () => {
    const { room, client, notices } = fixture(false);
    (room as any).useRealmWardenGate(client, { id: "warden-gate" });
    expect(room.state.mobs.has("realm-stone-warden")).toBe(false);
    expect(notices.join(" ")).toContain("LOCKED");
  });

  it("awakens a stronger Ascendant Warden for an unlocked character", () => {
    const { room, client } = fixture(true);
    (room as any).useRealmWardenGate(client, { id: "warden-gate" });
    const boss = room.state.mobs.get("realm-stone-warden")!;
    expect(boss.name).toBe("Ascendant Realm Stone Warden");
    expect(boss.maxHealth).toBeGreaterThan(54);
    expect(boss.attackDamage).toBeGreaterThanOrEqual(4);
    expect((room as any).realmWardenRepeatActive).toBe(true);
  });
});
