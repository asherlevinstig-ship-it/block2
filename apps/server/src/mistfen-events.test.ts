import { describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { PlayerState, WorldState } from "./schema.js";
import { MISTFEN_DYNAMIC_EVENTS, mistfenEventFollowers, mistfenEventForSequence, mistfenEventPattern, mistfenEventScale } from "./mistfen-events.js";

describe("Mistfen dynamic regional events", () => {
  it("rotates through stampede, toxic bloom and bog hunt", () => {
    expect([0, 1, 2, 3].map(index => mistfenEventForSequence(index).kind)).toEqual([
      "mireback-stampede", "toxic-bloom", "bog-hunt", "mireback-stampede",
    ]);
  });

  it("scales with level and party size while capping both", () => {
    const solo = mistfenEventScale("toxic-bloom", 1, 5);
    const party = mistfenEventScale("toxic-bloom", 20, 30);
    expect(solo).toMatchObject({ players: 1, level: 5, followerCount: 3, damageBonus: 0 });
    expect(party).toMatchObject({ players: 6, level: 20, followerCount: 4, damageBonus: 2 });
    expect(party.healthMultiplier).toBeGreaterThan(solo.healthMultiplier);
  });

  it("gives every variant a distinct pressure pattern and formation", () => {
    const patterns = MISTFEN_DYNAMIC_EVENTS.map(event => mistfenEventPattern(event.kind, 0, 30, 30));
    expect(patterns).toEqual(["bog-charge", "toxic-eruption", "slam"]);
    for (const event of MISTFEN_DYNAMIC_EVENTS) {
      expect(mistfenEventFollowers(event.kind, event.followerCount, { x: -47.5, y: 8, z: -31.5 }))
        .toHaveLength(event.followerCount);
    }
  });

  it("spawns and cleans up one authoritative regional encounter", () => {
    const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
    Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
    vi.spyOn(room, "broadcast").mockImplementation(() => {}); vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
    const player = new PlayerState(); Object.assign(player, { x: -47.5, y: 8, z: -31.5 });
    room.state.players.set("tester", player);
    for (const id of ["mistfen-behemoth", "mistfen-briar-west", "mistfen-briar-east", "mistfen-spitter"])
      internal.realmEvents.recordTrigger(id, 1_000, false);
    internal.advanceRealmEvent(9_000);
    const boss = room.state.mobs.get("mistfen-mireheart")!;
    expect(boss).toMatchObject({ alive: true, name: "Stampeding Mireheart", attackPattern: "bog-charge" });
    expect([...room.state.mobs.keys()].filter(id => id.startsWith("mistfen-event-follower-"))).toHaveLength(2);
    internal.combatContributions.record("mistfen-mireheart", "tester", boss.maxHealth, 10_000);
    internal.defeatMob("mistfen-mireheart", boss, "tester", 10_000);
    expect([...room.state.mobs.keys()].some(id => id.startsWith("mistfen-event-follower-"))).toBe(false);
  });
});
