import { afterEach, describe, expect, it, vi } from "vitest";
import { Block, chunkIndex, generateChunk, isPlayerSupported, playerCollides, SILVER_GUARD_HOMES, SILVER_GUARD_COVER, silverGuardEncounterBlock, isSilverRetreatTrail, worldToChunk } from "@blockcraft/voxel-world";
import { projectileImpact } from "../src/combat-impact.js";
import { SilverGuardVolley, SILVER_VOLLEY_GAP_MS } from "../src/silver-guard-volley.js";
import { SILVER_GUARD_IDS } from "../src/wilderness-encounters.js";
import { WorldRoom } from "../src/game-room.js";
import { PlayerState, WorldState } from "../src/schema.js";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function terrain(seed: string) {
  const chunks = new Map<string, ReturnType<typeof generateChunk>>();
  return (x: number, y: number, z: number) => {
    if (y < 0 || y >= 24) return Block.Air;
    const a = worldToChunk(x, z), key = `${a.chunkX},${a.chunkZ}`;
    let chunk = chunks.get(key); if (!chunk) { chunk = generateChunk(seed, a.chunkX, a.chunkZ); chunks.set(key, chunk); }
    return chunk.blocks[chunkIndex(a.localX, y, a.localZ)] as Block;
  };
}
describe("silver guard clearing", () => {
  it.each(["blockcraft-dev", "different-seed"])("has exposed silver, clear spawns and a supported retreat trail (%s)", seed => {
    const read = terrain(seed);
    expect(read(48, 7, 28)).toBe(Block.SilverOre);
    for (const home of SILVER_GUARD_HOMES) {
      expect(playerCollides(read, home.x, home.y, home.z)).toBe(false);
      expect(isPlayerSupported(read, home.x, home.y, home.z)).toBe(true);
    }
    const route = [[9, 30], [9, 32], [20, 32], [39, 32], [40, 28], [45, 28]];
    for (const [x, z] of route) {
      expect(isSilverRetreatTrail(x!, z!)).toBe(true);
      expect(playerCollides(read, x! + .5, 8, z! + .5)).toBe(false);
      expect(isPlayerSupported(read, x! + .5, 8, z! + .5)).toBe(true);
    }
    expect(silverGuardEncounterBlock(48, 4, 28)).toBeNull();
    for (let x = 44; x <= 55; x++) for (let z = 25; z <= 33; z++) expect(read(x, 12, z)).toBe(Block.Air);
  });
  it("uses actual solid cover to stop projectiles, without blocking the retreat lane", () => {
    const read = terrain("blockcraft-dev");
    for (const rock of SILVER_GUARD_COVER) {
      expect(read(rock.x, 8, rock.z)).toBe(Block.Stone); expect(read(rock.x, 9, rock.z)).toBe(Block.Stone);
      expect(projectileImpact({ x: rock.x - 2, y: 9, z: rock.z + .5 }, { x: rock.x + 4, y: 9, z: rock.z + .5 }, [], read)?.kind).toBe("terrain");
    }
    expect(projectileImpact({ x: 41.5, y: 9, z: 28.5 }, { x: 48.5, y: 9, z: 28.5 }, [], read)).toBeNull();
  });
  it("reserves the pair's firing rhythm, but leaves unrelated mobs independent", () => {
    const volley = new SilverGuardVolley(); expect(volley.canStart(SILVER_GUARD_IDS[0], 10000)).toBe(true);
    volley.started(SILVER_GUARD_IDS[0], 10000);
    expect(volley.canStart(SILVER_GUARD_IDS[1], 11399)).toBe(false);
    expect(volley.canStart(SILVER_GUARD_IDS[1], 11400)).toBe(true);
    expect(volley.canStart("deep-cave-spitter", 10001)).toBe(true);
  });
  it("stays staggered over a real multi-volley combat simulation", () => {
    vi.useFakeTimers(); vi.setSystemTime(10000);
    const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
    Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
    const releases = new Map<string, { mobId: string; at: number }>();
    vi.spyOn(room, "broadcast").mockImplementation((type, payload: any) => {
      if (type === "combat:mob-projectile") releases.set(`${payload.mobId}:${payload.releasedAt}`, { mobId: payload.mobId, at: payload.releasedAt });
    });
    for (const [i, id] of SILVER_GUARD_IDS.entries()) internal.registerMob(id, "cave_spitter", SILVER_GUARD_HOMES[i]);
    const player = new PlayerState(); Object.assign(player, { x: 48.5, y: 8, z: 28.5, invulnerableUntil: 1000000 }); room.state.players.set("tester", player);
    for (let tick = 0; tick < 250; tick++) { vi.setSystemTime(10000 + tick * 100); internal.simulatePlayers(.1); }
    const shots = [...releases.values()].sort((a, b) => a.at - b.at);
    expect(new Set(shots.map(shot => shot.mobId)).size).toBe(2); expect(shots.length).toBeGreaterThanOrEqual(6);
    for (let i = 1; i < shots.length; i++) expect(shots[i]!.at - shots[i - 1]!.at).toBeGreaterThanOrEqual(SILVER_VOLLEY_GAP_MS);
  });
});
