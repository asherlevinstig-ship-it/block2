import { describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { PlayerState, WorldState } from "./schema.js";
import { nearbyObjective } from "./world-objectives.js";
const player = (x: number, z: number, y = 8) => ({ x, y, z, health: 5, inventory: new Map<string, { quantity: number }>() });
const mob = (x: number, z: number, more = {}) => ({ x, y: 8, z, alive: true, name: "Crawler", difficultyTier: 1, combatState: "idle", targetId: "", ...more });
const select = (pose = player(48, 28), mobs = new Map([["cave-spitter", mob(46.5, 31.5)], ["frontier-spitter", mob(50.5, 25.5)]]), previous: string | null = null) => nearbyObjective("tester", pose, mobs, [], [], 10000, previous);

describe("world objective director", () => {
  it("groups the mixed frontier enemies into one nearby encounter", () => {
    const mobs = new Map([["frontier-crawler", mob(63.5, 35.5)], ["frontier-support-spitter", mob(68.5, 36.5)],
      ["frontier-brute-east", mob(70.5, 32.5)]]);
    const objective = select(player(67, 35), mobs);
    expect(objective.objectiveId).toBe("frontier-mixed");
    expect(objective.targetMobIds).toHaveLength(3);
    expect(objective.title).toBe("Frontier Warband");
  });
  it("selects the nearby silver encounter without a prerequisite quest", () => {
    expect(select().objectiveId).toBe("silver-guards");
    expect(select().targetMobIds).toEqual(["cave-spitter", "frontier-spitter"]);
  });

  it("switches to a closer new encounter, but has a four-metre hysteresis margin", () => {
    const mobs = new Map([["a", mob(40, 0)], ["b", mob(50, 0)]]);
    expect(select(player(46, 0), mobs, "mob-a").objectiveId).toBe("mob-a");
    expect(select(player(49, 0), mobs, "mob-a").objectiveId).toBe("mob-b");
  });

  it("keeps an active fight selected instead of flickering to a closer bystander", () => {
    const mobs = new Map([["a", mob(40, 0, { targetId: "tester", combatState: "windup" })], ["b", mob(50, 0)]]);
    expect(select(player(49, 0), mobs, "mob-a").objectiveId).toBe("mob-a");
  });
  it("ignores distant, dead and different-floor enemies", () => {
    expect(select(player(90, 0), new Map([["a", mob(40, 0)]])).kind).toBe("explore");
    expect(select(player(40, 0), new Map([["a", mob(40, 0, { alive: false })]])).kind).toBe("explore");
    expect(select(player(40, 0, 1), new Map([["a", mob(40, 0)]])).showMarker).toBe(false);
  });
  it("changes to a newly opened portal and stops pointing to slain guards", () => {
    const update = nearbyObjective("tester", player(48, 28), [["cave-spitter", mob(46, 28, { alive: false })]],
      [["forest-entry", { x: 46.5, y: 8, z: 28.5, kind: "entry", expiresAt: 12000 }]], [], 10000, "silver-guards");
    expect(update.kind).toBe("portal"); expect(update.targetMobId).toBe(""); expect(update.title).toBe("Enter the Forest Dungeon");
  });
  it("prefers personal loot but never points to another player's or expired bag", () => {
    const drop = { x: 48, y: 8.2, z: 28, itemId: "stone_core_hammer", ownerId: "tester", expiresAt: 12000 };
    expect(nearbyObjective("tester", player(48, 28), [], [], [["bag", drop]], 10000, null).kind).toBe("loot");
    expect(nearbyObjective("tester", player(48, 28), [], [], [["bag", { ...drop, ownerId: "other" }]], 10000, null).kind).toBe("explore");
    expect(nearbyObjective("tester", player(48, 28), [], [], [["bag", drop]], 12000, null).kind).toBe("explore");
  });
  it("follows dungeon rooms and guardian, then selects the return portal", () => {
    const pose = player(172, 165), portals = [["forest-return", { x: 158.5, y: 8, z: 165.5, kind: "return", expiresAt: 0 }]] as const;
    const room = [["forest-room2-a", mob(176.5, 161.5)]] as const;
    expect(nearbyObjective("tester", pose, room, portals, [], 10000, null).objectiveId).toBe("forest-stage-2");
    expect(nearbyObjective("tester", player(187, 165), [["forest-guardian", mob(187.5, 165.5)]], [], [], 10000, null).objectiveId).toBe("forest-stage-3");
    expect(nearbyObjective("tester", player(160, 165), [], portals, [], 10000, null).kind).toBe("portal");
  });
  it("shows town trading only when carrying minerals, with no fixed quest sequence", () => {
    const pose = player(8.5, 8.5); expect(select(pose, new Map()).objectiveId).toBe("leave-town");
    pose.inventory.set("silver_ore", { quantity: 3 }); expect(select(pose, new Map()).objectiveId).toBe("blacksmith");
  });
  it("sends changing local context through the actual room and supports explicit resync without update spam", () => {
    const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
    Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
    internal.registerMob("greenwood-briar", "briar_crawler", { x: 39.5, y: 8, z: 16.5 });
    internal.registerMob("frontier-brute", "stone_brute", { x: 65.5, y: 8, z: 23.5 });
    const pose = new PlayerState(); Object.assign(pose, { x: 40, y: 8, z: 16 }); room.state.players.set("tester", pose);
    const client = { sessionId: "tester", send: vi.fn() } as any;
    internal.sendObjectiveState(client); expect(client.send.mock.calls[0][1].objectiveId).toBe("greenwood");
    internal.sendObjectiveState(client); expect(client.send).toHaveBeenCalledTimes(1);
    internal.sendObjectiveState(client, true); expect(client.send).toHaveBeenCalledTimes(2);
    Object.assign(pose, { x: 65, z: 23 }); internal.sendObjectiveState(client);
    expect(client.send.mock.calls[2][1].objectiveId).toBe("frontier-ruins");
  });
  it("keeps actual kill rewards without adding fixed-checklist completion gold", () => {
    const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
    Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
    vi.spyOn(room, "broadcast").mockImplementation(() => {}); vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
    const pose = new PlayerState(); Object.assign(pose, { x: 40, y: 8, z: 16 }); room.state.players.set("tester", pose);
    internal.registerMob("greenwood-briar", "briar_crawler", { x: 39.5, y: 8, z: 16.5 });
    const target = room.state.mobs.get("greenwood-briar")!;
    internal.combatContributions.record("greenwood-briar", "tester", target.maxHealth, 10000);
    internal.defeatMob("greenwood-briar", target, "tester", 10000);
    expect(pose.coins).toBe(22);
  });
});
