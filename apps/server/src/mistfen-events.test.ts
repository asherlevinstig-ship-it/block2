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

  it("uses a fixed Mistfen profile instead of scaling to the arriving party", () => {
    expect(mistfenEventScale("toxic-bloom")).toMatchObject({
      players: 3, level: 7, followerCount: 3, healthMultiplier: 1, damageBonus: 0, rewardMultiplier: 1,
    });
    expect(mistfenEventScale("bog-hunt").followerCount).toBe(4);
  });

  it("gives every variant a distinct pressure pattern and formation", () => {
    const patterns = MISTFEN_DYNAMIC_EVENTS.map(event => mistfenEventPattern(event.kind, 0, 30, 30));
    expect(patterns).toEqual(["bog-charge", "toxic-eruption", "slam"]);
    for (const event of MISTFEN_DYNAMIC_EVENTS) {
      expect(mistfenEventFollowers(event.kind, event.followerCount, { x: -99.5, y: 8, z: -42.5 }))
        .toHaveLength(event.followerCount);
    }
  });

  it("spawns and cleans up one authoritative regional encounter", () => {
    const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
    Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
    vi.spyOn(room, "broadcast").mockImplementation(() => {}); vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
    const player = new PlayerState(); Object.assign(player, { x: -99.5, y: 8, z: -42.5 });
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
