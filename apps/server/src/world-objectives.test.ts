import { describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { PlayerState, WorldState } from "./schema.js";
import { nearbyObjective } from "./world-objectives.js";
const player = (x: number, z: number, y = 8) => ({ x, y, z, health: 5, level: 10, inventory: new Map<string, { quantity: number }>() });
const mob = (x: number, z: number, more = {}) => ({ x, y: 8, z, alive: true, name: "Crawler", difficultyTier: 1, combatState: "idle", targetId: "", ...more });
const select = (pose = player(48, 28), mobs = new Map([["cave-spitter", mob(46.5, 31.5)], ["frontier-spitter", mob(50.5, 25.5)]]), previous: string | null = null) => nearbyObjective("tester", pose, mobs, [], [], 10000, previous);

describe("world objective director", () => {
  it("never exposes the hidden mining milestones as an overworld quest chain", () => {
    const pose = { ...player(8.5, 8.5), miningExpeditionStage: 0 };
    for (const stage of [0, 1, 2, 3, 4, 7]) {
      pose.miningExpeditionStage = stage;
      const update = nearbyObjective("tester", pose, [], [], [], 10000, null);
      expect(update.objectiveId).toBe("leave-town");
      expect(update.progressLabel).toBeUndefined();
    }
  });
  it("temporarily shows nearby wilderness activity instead of a distant expedition step", () => {
    const pose = { ...player(8.5, 8.5), miningExpeditionStage: 0 };
    const sentries = new Map([["ashglass-sentry-west", mob(88.5, 57.5, { name: "Ashglass Sentry", difficultyTier: 3, level: 11 })],
      ["ashglass-sentry-east", mob(106.5, 67.5, { name: "Ashglass Sentry", difficultyTier: 3, level: 11 })]]);
    expect(nearbyObjective("tester", pose, sentries, [], [], 10000, null).objectiveId).toBe("leave-town");
    Object.assign(pose, { x: 98, z: 62 });
    expect(nearbyObjective("tester", pose, sentries, [], [], 10000, null).objectiveId).toBe("ashen-sentries");
    const defeated = new Map([...sentries].map(([id, enemy]) => [id, { ...enemy, alive: false }]));
    expect(nearbyObjective("tester", pose, defeated, [], [], 10000, "ashen-sentries").objectiveId).toBe("ashen-spire");
    Object.assign(pose, { x: 135, z: 80 });
    expect(nearbyObjective("tester", pose, defeated, [], [], 10000, "ashen-spire").objectiveId).toBe("explore");
    Object.assign(pose, { x: 23, z: 3 });
    expect(nearbyObjective("tester", pose, defeated, [], [], 10000, "explore").objectiveId).toBe("leave-town");
  });
  it("uses nearby threats in the mine and room guidance inside a dungeon", () => {
    const expedition = { ...player(39.5, 6.5, 3), miningExpeditionStage: 2 };
    expect(nearbyObjective("tester", expedition, [["deep-cave-spitter", { ...mob(40, 6), y: 3 }]], [], [], 10000, null).objectiveId).toBe("mob-deep-cave-spitter");
    const depths = { ...player(94, 14, 1), miningExpeditionStage: 8, silverDepthsStage: 3, silverDepthsRunStage: 3, silverDepthsWing: "" };
    const update = nearbyObjective("tester", depths, [], [], [], 10000, null, 0, "silver-depths");
    expect(update.objectiveId).toBe("depths-route-choice");
    expect(update.progressLabel).toBe("SILVER DEPTHS");
  });
  it("groups the mixed frontier enemies into one nearby encounter", () => {
    const mobs = new Map([["frontier-crawler", mob(63.5, 35.5)], ["frontier-support-spitter", mob(68.5, 36.5)],
      ["frontier-brute-east", mob(70.5, 32.5)]]);
    const objective = select(player(67, 35), mobs);
    expect(objective.objectiveId).toBe("frontier-mixed");
    expect(objective.targetMobIds).toHaveLength(3);
    expect(objective.kind).toBe("miniboss");
    expect(objective.targetMobId).toBe("frontier-brute-east");
    expect(objective.title).toBe("Frontier Warleader");
    expect(objective.progressLabel).toBe("MINI-BOSS · HIGHEST LOOT");
  });
  it("guides Silver Depths players to their chosen wing instead of unspawned enemies", () => {
    const pose = { ...player(94, 14, 1), miningExpeditionStage: 8, silverDepthsStage: 3,
      silverDepthsRunStage: 3, silverDepthsWing: "" };
    const selectDepths = (loot: Iterable<readonly [string, any]> = []) => nearbyObjective("tester", pose, [], [], loot, 10000, null, 0, "silver-depths");
    expect(selectDepths().title).toBe("Choose a Crystal Wing");
    pose.silverDepthsWing = "silver";
    const update = selectDepths();
    expect(update.title).toBe("Clear the Silver Echo");
    expect(update.targetMobIds).toEqual(["depths-silver-spitter-a", "depths-silver-crawler", "depths-silver-spitter-b"]);
    expect(update.targetMobIds).not.toContain("depths-iron-warden");
    pose.silverDepthsRunStage = 4;
    const personalGear = { x: 106.5, y: 1.22, z: 33.5, ownerId: "tester", itemId: "echo_prism", expiresAt: 20_000 };
    expect(selectDepths([["depths-wing-gear:tester", personalGear]]).title).toBe("Claim Echo Prism");
    expect(selectDepths([["depths-wing-gear:other", { ...personalGear, ownerId: "other" }]]).title).toBe("Clear the Crystal Antechamber");
  });
  it("uses the separate dungeon room's run stage even when the saved town quest is unfinished", () => {
    const pose = { ...player(63.5, 12.5, 1), miningExpeditionStage: 0, silverDepthsStage: 0, silverDepthsRunStage: 1, silverDepthsWing: "" };
    const selectDungeon = () => nearbyObjective("tester", pose, [], [], [], 10000, null, 0, "silver-depths");
    expect(selectDungeon().objectiveId).toBe("depths-moonstone");
    pose.silverDepthsRunStage = 2; expect(selectDungeon().objectiveId).toBe("depths-gallery");
    pose.silverDepthsRunStage = 3; expect(selectDungeon().objectiveId).toBe("depths-route-choice");
    pose.silverDepthsRunStage = 4; expect(selectDungeon().objectiveId).toBe("depths-antechamber");
    pose.silverDepthsRunStage = 5; expect(selectDungeon().objectiveId).toBe("depths-matriarch");
    pose.silverDepthsRunStage = 6; expect(selectDungeon().objectiveId).toBe("depths-recover");
    pose.silverDepthsRunStage = 7; expect(selectDungeon().objectiveId).toBe("depths-return");
    pose.silverDepthsStage = 7;
    pose.silverDepthsRunStage = 1; expect(selectDungeon().objectiveId).toBe("depths-moonstone");
  });
  it("sends a dungeon objective from the room instead of a blacksmith banner", () => {
    const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
    internal.roomKind = "silver-depths";
    const pose = new PlayerState(); Object.assign(pose, { x: 63.5, y: 1, z: 12.5, miningExpeditionStage: 0, silverDepthsRunStage: 1 });
    room.state.players.set("tester", pose);
    const client = { sessionId: "tester", send: vi.fn() } as any;
    internal.sendObjectiveState(client);
    expect(client.send.mock.calls[0][1].objectiveId).toBe("depths-moonstone");
    pose.silverDepthsRunStage = 2;
    internal.sendObjectiveState(client);
    expect(client.send.mock.calls[1][1].objectiveId).toBe("depths-gallery");
  });
  it("shows the local forest encounter over an unfinished town quest", () => {
    const pose = { ...player(172, 165), miningExpeditionStage: 0 };
    const update = nearbyObjective("tester", pose, [["forest-room2-a", mob(176.5, 161.5)]], [], [], 10000, null);
    expect(update.objectiveId).toBe("forest-stage-2");
  });
  it("holds Frontier contracts until level 10 without preventing exploration", () => {
    const mobs = new Map([["frontier-crawler", mob(63.5, 35.5)], ["frontier-support-spitter", mob(68.5, 36.5)],
      ["frontier-brute-east", mob(70.5, 32.5)]]);
    const objective = select({ ...player(67, 35), level: 9 }, mobs);
    expect(objective.objectiveId).toBe("frontier-locked");
    expect(objective.showMarker).toBe(false);
    expect(objective.detail).toContain("level 10");
  });
  it("selects the nearby silver encounter without a prerequisite quest", () => {
    expect(select().objectiveId).toBe("silver-guards");
    expect(select().targetMobIds).toEqual(["cave-spitter", "frontier-spitter"]);
    expect(select().kind).toBe("miniboss");
    expect(select().targetMobId).toBe("frontier-spitter");
  });

  it("returns to map-only area guidance after its mini-boss is defeated", () => {
    const mobs = new Map([["cave-spitter", mob(46.5, 31.5)], ["frontier-spitter", mob(50.5, 25.5, { alive: false })]]);
    const objective = select(player(48, 28), mobs, "silver-guards");
    expect(objective.kind).toBe("encounter");
    expect(objective.targetMobId).toBe("cave-spitter");
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
  it("reveals the Realm Warden marker only after the player gets nearby", () => {
    const warning = { phase: "warning" as const, eventId: "realm-stone-warden", eventName: "Realm Stone Warden",
      eventTitle: "Realm Stone Warden · Realm Boss", targetX: 68.5, targetY: 8, targetZ: 34.5,
      warningUntil: 18_000, completed: 3, required: 3, realmBoss: true, eliteKills: 0, eliteRequired: 2 };
    expect(nearbyObjective("tester", player(130, 34), [], [], [], 10_000, null, warning).objectiveId).toBe("realm-boss-warning");
    expect(nearbyObjective("tester", player(140, 34), [], [], [], 10_000, null, warning).objectiveId).toBe("explore");
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
  it("stops counting cavern enemies after the Warden and points to the guaranteed lantern", () => {
    const pose = { ...player(58, 10, 1), miningExpeditionStage: 6 };
    const mobs = [["buried-vault-crawler", { ...mob(56, 10), y: 1 }],
      ["buried-chamber-brute", { ...mob(56.5, 9.5, { alive: false, name: "Stone Warden" }), y: 1 }]] as const;
    const lantern = { x: 56.5, y: 1.22, z: 9.5, itemId: "miners_lantern", ownerId: "tester", expiresAt: 130_000 };
    const update = nearbyObjective("tester", pose, mobs, [], [["first-expedition-lantern:tester", lantern]], 10_000, "buried-vault");
    expect(update.kind).toBe("loot");
    expect(update.title).toBe("Claim the Miner's Lantern");
    expect(update.targetMobIds).toEqual([]);
    expect(update.detail).toContain("no more enemies required");
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
    const pose = new PlayerState(); Object.assign(pose, { x: 40, y: 8, z: 16, level: 10, miningExpeditionStage: 8 }); room.state.players.set("tester", pose);
    const client = { sessionId: "tester", send: vi.fn() } as any;
    internal.sendObjectiveState(client); expect(client.send.mock.calls[0][1].objectiveId).toBe("greenwood");
    internal.sendObjectiveState(client); expect(client.send).toHaveBeenCalledTimes(1);
    internal.sendObjectiveState(client, true); expect(client.send).toHaveBeenCalledTimes(2);
    Object.assign(pose, { x: 65, z: 23 }); internal.sendObjectiveState(client);
    expect(client.send.mock.calls[2][1].objectiveId).toBe("frontier-ruins");
  });
  it("updates the live banner when a new player leaves town for Ashen Reach", () => {
    const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
    Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
    const pose = new PlayerState(); Object.assign(pose, { x: 22.5, y: 8, z: 2.5, miningExpeditionStage: 0 });
    room.state.players.set("tester", pose);
    const client = { sessionId: "tester", send: vi.fn() } as any;
    internal.sendObjectiveState(client);
    expect(client.send.mock.calls[0][1].objectiveId).toBe("leave-town");
    Object.assign(pose, { x: 97.5, z: 62.5 });
    internal.sendObjectiveState(client);
    expect(client.send.mock.calls[1][1].objectiveId).toBe("ashen-spire");
    internal.sendObjectiveState(client);
    expect(client.send).toHaveBeenCalledTimes(2);
  });
  it("keeps actual kill rewards without adding fixed-checklist completion gold", () => {
    const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
    Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
    vi.spyOn(room, "broadcast").mockImplementation(() => {}); vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
    const pose = new PlayerState(); Object.assign(pose, { x: 40, y: 8, z: 16, miningExpeditionStage: 8 }); room.state.players.set("tester", pose);
    internal.registerMob("greenwood-briar", "briar_crawler", { x: 39.5, y: 8, z: 16.5 });
    const target = room.state.mobs.get("greenwood-briar")!;
    internal.combatContributions.record("greenwood-briar", "tester", target.maxHealth, 10000);
    internal.defeatMob("greenwood-briar", target, "tester", 10000);
    expect(pose.coins).toBe(22);
  });
});
