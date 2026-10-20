import { describe, expect, it } from "vitest";
import { WorldRoom } from "./game-room.js";
import { PlayerState, WorldState } from "./schema.js";
import { REALM_EVENT_DEFINITIONS, REGIONAL_EVENT_DISCOVERY_RADIUS } from "./realm-event-director.js";

describe("Realm-style event discovery", () => {
  it("keeps regional calls hidden until the player approaches, while preserving the live event", () => {
    const room = new WorldRoom();
    room.setState(new WorldState());
    const internal = room as any;
    const player = new PlayerState();
    const event = REALM_EVENT_DEFINITIONS.find(candidate => candidate.key === "stoneheart")!;
    Object.assign(player, { x: event.position.x + REGIONAL_EVENT_DISCOVERY_RADIUS + 1, y: event.position.y, z: event.position.z });
    room.state.players.set("tester", player);
    for (const id of event.triggerIds) internal.realmEvents.recordTrigger(id, 1_000, false);

    expect(internal.realmEventUpdateFor({ sessionId: "tester" }, 1_000)).toMatchObject({
      phase: "idle", eventId: null,
    });
    player.x = event.position.x;
    expect(internal.realmEventUpdateFor({ sessionId: "tester" }, 1_000)).toMatchObject({
      phase: "warning", eventId: event.id, eventName: event.name,
    });
  });

  it("broadcasts the realm boss call beyond the regional discovery radius", () => {
    const room = new WorldRoom();
    room.setState(new WorldState());
    const internal = room as any;
    const player = new PlayerState();
    Object.assign(player, { x: 0, y: 8, z: 0 });
    room.state.players.set("tester", player);
    internal.realmEvents.recordLeader("one", 1_000);
    internal.realmEvents.recordLeader("two", 1_001);
    internal.realmEvents.recordLeader("three", 1_002);

    expect(internal.realmEventUpdateFor({ sessionId: "tester" }, 1_002)).toMatchObject({
      phase: "warning", eventId: "realm-stone-warden", realmBoss: true,
    });
  });
});
