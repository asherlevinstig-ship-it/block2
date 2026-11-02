import { afterEach, describe, expect, it, vi } from "vitest";
import { TOWER_FLOOR_ONE, TOWER_FLOOR_TWO, withTowerFloorCleared } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { ForestPortalState, PlayerState, WorldState } from "./schema.js";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

function fixture() {
  vi.useFakeTimers(); vi.setSystemTime(20_000);
  const room = new WorldRoom(); room.setState(new WorldState());
  const internal = room as any;
  internal.roomKind = "practice"; internal.rapidPractice = true;
  vi.spyOn(internal, "bootstrapPayload").mockReturnValue({});
  vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
  vi.spyOn(internal, "refreshNearbyObjectives").mockImplementation(() => {});
  const player = new PlayerState();
  Object.assign(player, TOWER_FLOOR_ONE.townPortal, { health: 20, maxHealth: 20 });
  room.state.players.set("hero", player);
  const portal = new ForestPortalState();
  Object.assign(portal, TOWER_FLOOR_ONE.townPortal, { kind: "tower-entry", expiresAt: 0 });
  room.state.portals.set("tower-floor-1-entry", portal);
  const client = { sessionId: "hero", send: vi.fn() };
  internal.clients.push(client);
  return { room, internal, player, client };
}

describe("tower floor selection", () => {
  it("shows every built floor as available without requiring an earlier clear", () => {
    const f = fixture();
    f.internal.sendTowerFloorDirectory(f.client);
    expect(f.client.send).toHaveBeenCalledWith("tower:floor-directory", expect.objectContaining({
      highestFloorCleared: 0,
      entries: expect.arrayContaining([expect.objectContaining({ floor: 1, unlocked: true }),
        expect.objectContaining({ floor: 2, unlocked: true })]),
    }));
    f.internal.useTowerPortal(f.client, "tower-floor-1-entry", 2);
    expect(f.player).toMatchObject(TOWER_FLOOR_TWO.entry);
  });

  it("travels directly from Town to an unlocked Floor 2", () => {
    const f = fixture();
    f.player.huntLoadoutsJson = withTowerFloorCleared(f.player.huntLoadoutsJson, 1).json;
    f.internal.useTowerPortal(f.client, "tower-floor-1-entry", 2);
    expect(f.player).toMatchObject(TOWER_FLOOR_TWO.entry);
    expect(f.client.send).toHaveBeenCalledWith("player:portal", expect.objectContaining({
      ...TOWER_FLOOR_TWO.entry, entering: true,
    }));
  });
});
