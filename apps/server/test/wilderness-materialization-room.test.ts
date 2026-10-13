import { afterEach, describe, expect, it, vi } from "vitest";
import { Block, type WorldBlockReader } from "@blockcraft/voxel-world";
import { WorldRoom } from "../src/game-room.js";
import { MobState, PlayerState, WorldState } from "../src/schema.js";
import { WILDERNESS_MATERIALIZE_MS, WILDERNESS_RESPAWN_RECHECK_MS } from "../src/wilderness-respawn.js";

const flat: WorldBlockReader = (_x, y) => y <= 7 ? Block.Stone : Block.Air;

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("wilderness materialization", () => {
  it("waits for room, telegraphs, then makes the enemy alive", () => {
    vi.useFakeTimers(); vi.setSystemTime(10_000);
    const room = new WorldRoom(); room.setState(new WorldState());
    Object.defineProperty(room, "readWorldBlock", { value: flat });
    vi.spyOn(room, "broadcast").mockImplementation(() => {});
    const internal = room as any;
    internal.registerMob("moss-crawler", "moss_crawler", { x: 35.5, y: 8, z: -8.5 });
    const mob = room.state.mobs.get("moss-crawler") as MobState;
    const player = new PlayerState(); Object.assign(player, { x: mob.x, y: mob.y, z: mob.z, health: 5 });
    room.state.players.set("player", player);
    mob.alive = false; mob.respawnAt = 10_000;

    internal.simulatePlayers(.033);
    expect(mob.alive).toBe(false);
    expect(mob.materializeUntil).toBe(0);
    expect(mob.respawnAt).toBe(10_000 + WILDERNESS_RESPAWN_RECHECK_MS);

    player.x += 20;
    vi.setSystemTime(mob.respawnAt);
    internal.simulatePlayers(.033);
    expect(mob.alive).toBe(false);
    expect(mob.materializeUntil).toBe(11_000 + WILDERNESS_MATERIALIZE_MS);

    vi.setSystemTime(mob.materializeUntil);
    internal.simulatePlayers(.033);
    expect(mob.alive).toBe(true);
    expect(mob.materializeUntil).toBe(0);
  });

  it("cancels the cue if a player enters its safety bubble", () => {
    vi.useFakeTimers(); vi.setSystemTime(20_000);
    const room = new WorldRoom(); room.setState(new WorldState());
    Object.defineProperty(room, "readWorldBlock", { value: flat });
    vi.spyOn(room, "broadcast").mockImplementation(() => {});
    const internal = room as any;
    internal.registerMob("moss-crawler", "moss_crawler", { x: 35.5, y: 8, z: -8.5 });
    const mob = room.state.mobs.get("moss-crawler") as MobState;
    const player = new PlayerState(); Object.assign(player, { x: mob.x + 20, y: mob.y, z: mob.z, health: 5 });
    room.state.players.set("player", player);
    mob.alive = false; mob.respawnAt = 20_000;

    internal.simulatePlayers(.033);
    expect(mob.materializeUntil).toBe(20_000 + WILDERNESS_MATERIALIZE_MS);
    player.x = mob.x;
    vi.setSystemTime(mob.materializeUntil);
    internal.simulatePlayers(.033);
    expect(mob.alive).toBe(false);
    expect(mob.materializeUntil).toBe(0);
    expect(mob.respawnAt).toBe(21_500 + WILDERNESS_RESPAWN_RECHECK_MS);
  });

  it("reveals a distant area leader during materialization and preserves its stronger profile", () => {
    vi.useFakeTimers(); vi.setSystemTime(30_000);
    vi.spyOn(Math, "random").mockReturnValue(.01);
    const room = new WorldRoom(); room.setState(new WorldState());
    Object.defineProperty(room, "readWorldBlock", { value: flat });
    vi.spyOn(room, "broadcast").mockImplementation(() => {});
    const internal = room as any;
    internal.registerMob("wild-spitter-west-north", "cave_spitter", { x: -30.5, y: 8, z: 3.5 });
    const mob = room.state.mobs.get("wild-spitter-west-north") as MobState;
    const ordinaryHealth = mob.maxHealth;
    mob.alive = false; mob.respawnAt = 30_000;

    internal.simulatePlayers(.033);
    expect(mob.alive).toBe(false);
    expect(mob.isElite).toBe(false);
    expect(mob.name).toBe("Gloomfang Spitter");

    vi.setSystemTime(mob.materializeUntil);
    internal.simulatePlayers(.033);
    expect(mob.alive).toBe(true);
    expect(mob.maxHealth).toBe(ordinaryHealth);
    expect(mob.attackDamage).toBeGreaterThan(1);
    expect(mob.rewardMultiplier).toBeGreaterThan(1);
  });
});
