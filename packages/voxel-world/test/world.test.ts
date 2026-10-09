import { describe, expect, it } from "vitest";
import {
  Block,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  GRAVITY,
  GREENWOOD_CAMP,
  GREENWOOD_CRAWLER_HOMES,
  GREENWOOD_IRON_SEAM,
  STONE_BRUTE_ARENA,
  STONE_BRUTE_ARENA_HOME,
  isInStoneBruteArena,
  MILESTONE_CAVE_X_OFFSET,
  SURFACE_HEIGHT,
  TERMINAL_VELOCITY,
  TOWN_BUILDINGS,
  TOWN_BEACON_POSITION,
  TOWN_BLACKSMITH_STALL_POSITION,
  TOWN_TAVERN,
  generateChunk,
  getBlock,
  highestSolidY,
  isInGreenwoodRegion,
  isPlayerSupported,
  isProtectedVoxel,
  playerCollides,
  resolvePlayerMotion,
  resolveSweptHorizontalMotion,
  townWallBlock,
  voxelRaycast,
  worldToChunk,
} from "../src/index.js";

describe("deterministic voxel world", () => {
  it("provides a flat open brute arena and a supported trail beyond the crawler camp", () => {
    const cache = new Map<string, ReturnType<typeof generateChunk>>();
    const read = (x: number, y: number, z: number) => {
      const a = worldToChunk(x, z); const key = `${a.chunkX},${a.chunkZ}`;
      if (!cache.has(key)) cache.set(key, generateChunk("test-world", a.chunkX, a.chunkZ));
      return getBlock(cache.get(key)!, a.localX, y, a.localZ);
    };
    for (let z = 25; z <= STONE_BRUTE_ARENA.maxZ; z++) {
      expect(isPlayerSupported(read, 41.5, 8, z + 0.5)).toBe(true);
      expect(playerCollides(read, 41.5, 8, z + 0.5)).toBe(false);
    }
    for (let x = STONE_BRUTE_ARENA.minX; x <= STONE_BRUTE_ARENA.maxX; x++) {
      for (let z = STONE_BRUTE_ARENA.minZ; z <= STONE_BRUTE_ARENA.maxZ; z++) {
        expect(read(x, 6, z)).toBe(Block.Stone);
        expect(isPlayerSupported(read, x + 0.5, 8, z + 0.5)).toBe(true);
        for (let y = 8; y <= 17; y++) expect(read(x, y, z)).toBe(Block.Air);
      }
    }
    expect(isInStoneBruteArena(STONE_BRUTE_ARENA_HOME.x, STONE_BRUTE_ARENA_HOME.z)).toBe(true);
    expect(STONE_BRUTE_ARENA.minZ).toBeGreaterThan(GREENWOOD_CAMP.maxZ + 8);
  });
  it("generates identical chunks from the same seed", () => {
    const first = generateChunk("test-world", 0, 0);
    const second = generateChunk("test-world", 0, 0);
    expect([...first.blocks]).toEqual([...second.blocks]);
  });

  it("keeps the base layer unbreakable bedrock", () => {
    const chunk = generateChunk("test-world", 0, 0);
    for (let z = 0; z < CHUNK_SIZE; z += 1) {
      for (let x = 0; x < CHUNK_SIZE; x += 1) expect(getBlock(chunk, x, 0, z)).toBe(Block.Bedrock);
    }
  });

  it("addresses negative world coordinates without negative local positions", () => {
    expect(worldToChunk(-1, -17)).toEqual({ chunkX: -1, chunkZ: -2, localX: 15, localZ: 15 });
  });

  it("protects the spawn but not the surrounding wilderness", () => {
    expect(isProtectedVoxel(8, 8)).toBe(true);
    expect(isProtectedVoxel(16, 8)).toBe(true);
    expect(isProtectedVoxel(17, 8)).toBe(true);
    expect(isProtectedVoxel(23, 8)).toBe(true);
    expect(isProtectedVoxel(30, 8)).toBe(true);
    expect(isProtectedVoxel(31, 8)).toBe(false);
    expect(isProtectedVoxel(-14, 8)).toBe(true);
    expect(isProtectedVoxel(-15, 8)).toBe(false);
  });

  it("builds a navigable Town of Beginnings around the spawn", () => {
    const centre = generateChunk("test-world", 0, 0);
    const eastGate = generateChunk("test-world", 1, 0);
    const westQuarter = generateChunk("test-world", -1, 0);
    const northQuarter = generateChunk("test-world", 0, -1);
    const southQuarter = generateChunk("test-world", 0, 1);
    expect(getBlock(centre, 8, SURFACE_HEIGHT, 8)).toBe(Block.Stone);
    expect(getBlock(centre, 8, SURFACE_HEIGHT + 1, 8)).toBe(Block.Air);
    expect(TOWN_BUILDINGS).toHaveLength(1);
    expect(getBlock(centre, 2, 8, 4)).toBe(Block.Air);
    expect(getBlock(centre, 2, 10, 4)).toBe(Block.Air);
    expect(getBlock(westQuarter, TOWN_BEACON_POSITION.x + 16, 11, TOWN_BEACON_POSITION.z)).toBe(Block.IronOre);
    expect(getBlock(southQuarter, 8, 7, 0)).toBe(Block.Dirt);
    expect(getBlock(southQuarter, 8, 8, 0)).toBe(Block.Air);
    expect(getBlock(southQuarter, 8, 10, 0)).toBe(Block.Air);
    expect(getBlock(southQuarter, 8, 11, 0)).toBe(Block.Dirt);
    expect(getBlock(southQuarter, 8, 12, 4)).toBe(Block.Stone);
    expect(getBlock(southQuarter, 8, 14, 4)).toBe(Block.Stone);
    expect(getBlock(southQuarter, 4, 8, 3)).toBe(Block.Air);
    expect(getBlock(southQuarter, 12, 8, 0)).toBe(Block.Stone);
    expect(getBlock(southQuarter, 3, 8, 0)).toBe(Block.Stone);
    expect(getBlock(southQuarter, 3, 9, 0)).toBe(Block.Dirt);
    expect(getBlock(eastGate, 14, 11, 7)).toBe(Block.IronOre);
    expect(getBlock(eastGate, 14, 8, 8)).toBe(Block.Air);
    expect(getBlock(westQuarter, 3, 10, 10)).toBe(Block.Air);
    expect(getBlock(northQuarter, 8, 8, 2)).toBe(Block.Air);
    expect(getBlock(southQuarter, 8, 8, 9)).toBe(Block.Air);
    expect(getBlock(southQuarter, 8, 12, 9)).toBe(Block.Stone);
    expect(getBlock(eastGate, 0, SURFACE_HEIGHT, 8)).toBe(Block.Dirt);
  });

  it("keeps the blacksmith stall on solid ground and its counter physically blocked", () => {
    const centre = generateChunk("test-world", 0, 0);
    const east = generateChunk("test-world", 1, 0);
    const read = (x: number, y: number, z: number) => getBlock(x >= 16 ? east : centre, x >= 16 ? x - 16 : x, y, z);
    expect(read(22, SURFACE_HEIGHT, 2)).toBe(Block.Dirt);
    expect(playerCollides(read, 22.5, 8, 2.5)).toBe(true);
    expect(playerCollides(read, 22.5, 8, 4.3)).toBe(false);
  });

  it("spaces the tavern, blacksmith, and beacon across connected safe-town paths", () => {
    const tavernFront = { x: (TOWN_TAVERN.minX + TOWN_TAVERN.maxX + 1) / 2, z: TOWN_TAVERN.minZ };
    expect(Math.hypot(tavernFront.x - TOWN_BLACKSMITH_STALL_POSITION.x, tavernFront.z - TOWN_BLACKSMITH_STALL_POSITION.z)).toBeGreaterThan(18);
    expect(Math.hypot(TOWN_BEACON_POSITION.x - TOWN_BLACKSMITH_STALL_POSITION.x, TOWN_BEACON_POSITION.z - TOWN_BLACKSMITH_STALL_POSITION.z)).toBeGreaterThan(20);
    for (const point of [tavernFront, TOWN_BLACKSMITH_STALL_POSITION, TOWN_BEACON_POSITION]) {
      expect(isProtectedVoxel(point.x, point.z)).toBe(true);
    }
    const center = generateChunk("test-world", 0, 0);
    const east = generateChunk("test-world", 1, 0);
    expect(getBlock(center, 8, SURFACE_HEIGHT, 14)).toBe(Block.Dirt);
    expect(getBlock(east, 6, SURFACE_HEIGHT, 8)).toBe(Block.Dirt);
    expect(getBlock(east, 6, SURFACE_HEIGHT, 2)).toBe(Block.Dirt);
  });

  it("surrounds the town with solid walls while keeping each cardinal gate passable", () => {
    for (const [wallX, wallZ, gateX, gateZ] of [
      [-14, 5, -14, 8], [30, 5, 30, 8], [5, -14, 8, -14], [5, 30, 8, 30],
    ]) {
      expect(townWallBlock(wallX, 8, wallZ)).toBe(Block.Stone);
      expect(townWallBlock(wallX, 9, wallZ)).toBe(Block.Stone);
      expect(townWallBlock(gateX, 8, gateZ)).toBe(Block.Air);
      expect(townWallBlock(gateX, 9, gateZ)).toBe(Block.Air);
      expect(townWallBlock(gateX, 10, gateZ)).toBe(Block.Stone);
    }
    const north = generateChunk("test-world", 0, -1);
    expect(getBlock(north, 5, 8, 2)).toBe(Block.Stone);
    expect(getBlock(north, 8, 8, 2)).toBe(Block.Air);
  });

  it("blocks a walking player at the rampart but lets them leave through a gate", () => {
    const loaded = new Map<string, ReturnType<typeof generateChunk>>();
    const read = (x: number, y: number, z: number) => {
      const address = worldToChunk(x, z);
      const key = `${address.chunkX},${address.chunkZ}`;
      if (!loaded.has(key)) loaded.set(key, generateChunk("test-world", address.chunkX, address.chunkZ));
      return getBlock(loaded.get(key)!, address.localX, y, address.localZ);
    };
    const blocked = resolveSweptHorizontalMotion({ x: 5.5, y: 8, z: -12.5 }, { x: 0, z: -4 }, read);
    const throughGate = resolveSweptHorizontalMotion({ x: 8.5, y: 8, z: -12.5 }, { x: 0, z: -4 }, read);
    expect(blocked.z).toBeGreaterThan(-14);
    expect(throughGate.z).toBeLessThan(-15);
  });

  it("lets a player walk from the plaza into the tavern through its wide entrance", () => {
    const loaded = new Map<string, ReturnType<typeof generateChunk>>();
    const read = (x: number, y: number, z: number) => {
      const address = worldToChunk(x, z);
      const key = `${address.chunkX},${address.chunkZ}`;
      if (!loaded.has(key)) loaded.set(key, generateChunk("test-world", address.chunkX, address.chunkZ));
      return getBlock(loaded.get(key)!, address.localX, y, address.localZ);
    };
    const entered = resolveSweptHorizontalMotion({ x: 8.5, y: 8, z: 8.5 }, { x: 0, z: 5 }, read);
    expect(entered.z).toBeGreaterThan(13);
    expect(entered.y).toBe(8);
  });

  it("blocks tables, benches, the bar, and hearth without stepping onto them", () => {
    const loaded = new Map<string, ReturnType<typeof generateChunk>>();
    const read = (x: number, y: number, z: number) => {
      const address = worldToChunk(x, z);
      const key = `${address.chunkX},${address.chunkZ}`;
      if (!loaded.has(key)) loaded.set(key, generateChunk("test-world", address.chunkX, address.chunkZ));
      return getBlock(loaded.get(key)!, address.localX, y, address.localZ);
    };
    const table = resolveSweptHorizontalMotion({ x: 8.5, y: 8, z: 19.5 }, { x: -4, z: 0 }, read);
    const bench = resolveSweptHorizontalMotion({ x: 4.5, y: 8, z: 17 }, { x: 0, z: 3 }, read);
    const bar = resolveSweptHorizontalMotion({ x: 5.1, y: 8, z: 22.3 }, { x: 0, z: 2 }, read);
    const hearth = resolveSweptHorizontalMotion({ x: 5.5, y: 8, z: 22.5 }, { x: -2, z: 0 }, read);
    expect(table.x).toBeGreaterThan(6);
    expect(bench.z).toBeLessThan(18.5);
    expect(bar.z).toBeLessThan(23.4);
    expect(hearth.x).toBeGreaterThan(4.3);
    for (const result of [table, bench, bar, hearth]) {
      expect(result.y).toBe(8);
      expect(result.stepped).toBe(false);
      expect(playerCollides(read, result.x, result.y, result.z)).toBe(false);
    }
    const aisle = resolveSweptHorizontalMotion({ x: 8.5, y: 8, z: 16.5 }, { x: 0, z: 7.5 }, read);
    expect(aisle.z).toBeGreaterThan(23.8);
  });

  it("finds a stable standing surface inside a generated column", () => {
    const chunk = generateChunk("test-world", 0, 0);
    const surface = highestSolidY(chunk, 8, 8);
    expect(surface).toBeGreaterThan(0);
    expect(getBlock(chunk, 8, surface, 8)).not.toBe(Block.Air);
    expect(getBlock(chunk, 8, surface + 1, 8)).toBe(Block.Air);
  });

  it("keeps the terrain plane flat beneath authored wilderness features", () => {
    for (const [chunkX, chunkZ] of [[-2, -1], [-1, 2], [0, -2], [2, 2]]) {
      const chunk = generateChunk("test-world", chunkX, chunkZ);
      for (let z = 0; z < CHUNK_SIZE; z += 1) {
        for (let x = 0; x < CHUNK_SIZE; x += 1) {
          expect(getBlock(chunk, x, SURFACE_HEIGHT, z)).not.toBe(Block.Air);
          const above = getBlock(chunk, x, SURFACE_HEIGHT + 1, z);
          expect([Block.Air, Block.OakLog, Block.Leaves]).toContain(above);
        }
      }
    }
  });

  it("authors a harvestable Greenwood region beyond the east gate", () => {
    expect(isInGreenwoodRegion(31, 8)).toBe(true);
    expect(isInGreenwoodRegion(30, 8)).toBe(false);
    const chunks = [generateChunk("test-world", 2, -1), generateChunk("test-world", 2, 0), generateChunk("test-world", 2, 1)];
    const blocks = chunks.flatMap(chunk => [...chunk.blocks]);
    expect(blocks.filter(block => block === Block.OakLog).length).toBeGreaterThan(6);
    expect(blocks.filter(block => block === Block.Leaves).length).toBeGreaterThan(20);
    const camp = generateChunk("test-world", 2, 0);
    expect(getBlock(camp, GREENWOOD_CAMP.minX - 32, SURFACE_HEIGHT, GREENWOOD_CAMP.minZ)).toBe(Block.Dirt);
  });
  it.each(["test-world", "another-seed"])("keeps crawler camp sightlines, approach, and mining foundation clear for %s", seed => {
    const cache = new Map<string, ReturnType<typeof generateChunk>>();
    const read = (x: number, y: number, z: number) => {
      const a = worldToChunk(x, z); const key = `${a.chunkX},${a.chunkZ}`;
      if (!cache.has(key)) cache.set(key, generateChunk(seed, a.chunkX, a.chunkZ));
      return getBlock(cache.get(key)!, a.localX, y, a.localZ);
    };
    for (let x = GREENWOOD_CAMP.minX; x <= GREENWOOD_CAMP.maxX; x++) {
      for (let z = GREENWOOD_CAMP.minZ; z <= GREENWOOD_CAMP.maxZ; z++) {
        expect(read(x, 7, z)).toBe(Block.Dirt);
        expect(read(x, 6, z)).toBe(Block.Stone);
        for (let y = 8; y <= 15; y++) expect(read(x, y, z)).toBe(Block.Air);
      }
    }
    for (let x = 31; x <= 40; x++) {
      expect(read(x, 7, 12)).toBe(Block.Dirt);
      expect(playerCollides(read, x + 0.5, 8, 12.5)).toBe(false);
      expect(isPlayerSupported(read, x + 0.5, 8, 12.5)).toBe(true);
    }
    for (const home of GREENWOOD_CRAWLER_HOMES) {
      expect(Math.hypot(home.x - 8.5, home.z - 8.5)).toBeGreaterThan(30);
      expect(playerCollides(read, home.x, home.y, home.z)).toBe(false);
      expect(isPlayerSupported(read, home.x, home.y, home.z)).toBe(true);
    }
    let ore = 0;
    for (let x = GREENWOOD_IRON_SEAM.minX; x <= GREENWOOD_IRON_SEAM.maxX; x++) {
      for (let z = GREENWOOD_IRON_SEAM.minZ; z <= GREENWOOD_IRON_SEAM.maxZ; z++) {
        expect(isProtectedVoxel(x, 7, z)).toBe(false);
        for (const y of [6, 7]) { expect(read(x, y, z)).toBe(Block.IronOre); ore++; }
        expect(read(x, 5, z)).toBe(Block.Stone);
      }
    }
    expect(ore).toBe(18);
  });

  it("raycasts to the first solid voxel and reports the preceding cell", () => {
    const hit = voxelRaycast(
      { x: 0.5, y: 1.5, z: 0.5 },
      { x: 1, y: 0, z: 0 },
      8,
      x => (x === 3 ? Block.Stone : Block.Air),
    );
    expect(hit).toMatchObject({ x: 3, y: 1, z: 0, block: Block.Stone, distance: 2.5, previous: { x: 2, y: 1, z: 0 } });
  });

  it("handles diagonal and zero-length voxel rays", () => {
    const diagonal = voxelRaycast(
      { x: -0.5, y: 3.5, z: -0.5 },
      { x: -1, y: -1, z: -1 },
      10,
      (x, y, z) => (x === -3 && y === 1 && z === -3 ? Block.IronOre : Block.Air),
    );
    expect(diagonal).toMatchObject({ x: -3, y: 1, z: -3, block: Block.IronOre });
    expect(voxelRaycast({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 4, () => Block.Stone)).toBeNull();
  });

  it("cuts a guaranteed descending entrance into the flat ground east of spawn", () => {
    const chunk = generateChunk("test-world", 2, 0);
    expect(getBlock(chunk, 0, 7, 8)).toBe(Block.Air);
    expect(getBlock(chunk, 0, 6, 8)).not.toBe(Block.Air);
    expect(getBlock(chunk, 1, 6, 8)).toBe(Block.Air);
    expect(getBlock(chunk, 1, 5, 8)).not.toBe(Block.Air);
    expect(getBlock(chunk, 2, 5, 8)).toBe(Block.Air);
    expect(getBlock(chunk, 3, 7, 8)).not.toBe(Block.Air);
    expect(getBlock(chunk, 4, 3, 8)).toBe(Block.Air);
    expect(getBlock(chunk, 4, 2, 8)).not.toBe(Block.Air);
  });

  it("steps onto a one-block ledge but cannot pass through a two-block wall", () => {
    const oneBlockStep = (x: number, y: number) => (y === 0 || (x === 2 && y === 1) ? Block.Stone : Block.Air);
    const stepped = resolvePlayerMotion({ x: 1.5, y: 1, z: 0.5 }, { x: 1, y: 0, z: 0 }, oneBlockStep);
    expect(stepped.stepped).toBe(true);
    expect(stepped.y).toBe(2);

    const wall = (x: number, y: number) => (y === 0 || (x === 2 && (y === 1 || y === 2)) ? Block.Stone : Block.Air);
    const blocked = resolvePlayerMotion({ x: 1.5, y: 1, z: 0.5 }, { x: 1, y: 0, z: 0 }, wall);
    expect(blocked.x).toBe(1.5);
    expect(blocked.stepped).toBe(false);
  });

  it("recognizes a one-block step when approaching in normal frame-sized increments", () => {
    const step = (x: number, y: number) => (y === 0 || (x === 2 && y === 1) ? Block.Stone : Block.Air);
    let position = { x: 1.5, y: 1, z: 0.5 };
    let stepped = false;
    for (let frame = 0; frame < 5; frame += 1) {
      const next = resolvePlayerMotion(position, { x: 0.21, y: 0, z: 0 }, step);
      position = next;
      stepped ||= next.stepped;
    }
    expect(stepped).toBe(true);
    expect(position.x).toBeGreaterThan(2);
    expect(position.y).toBe(2);
  });

  it("does not auto-step into a low underground ceiling", () => {
    const crampedStep = (x: number, y: number) => (
      y === 0 || (x === 2 && (y === 1 || y === 3)) ? Block.Stone : Block.Air
    );
    const approach = resolvePlayerMotion({ x: 1.5, y: 1, z: 0.5 }, { x: 0.21, y: 0, z: 0 }, crampedStep);
    const blocked = resolvePlayerMotion(approach, { x: 0.21, y: 0, z: 0 }, crampedStep);
    expect(blocked.x).toBe(approach.x);
    expect(blocked.stepped).toBe(false);
  });

  it("sweeps long horizontal movement so a lunge cannot tunnel through walls", () => {
    const wall = (x: number, y: number) => (y === 0 || (x === 2 && (y === 1 || y === 2)) ? Block.Stone : Block.Air);
    const lunged = resolveSweptHorizontalMotion({ x: 0.5, y: 1, z: 0.5 }, { x: 4, z: 0 }, wall);
    expect(lunged.x).toBeLessThan(2);
    expect(playerCollides(wall, lunged.x, lunged.y, lunged.z)).toBe(false);
  });

  it("keeps the complete underground entrance and chamber route supported", () => {
    const chunks = new Map<string, ReturnType<typeof generateChunk>>();
    const readWorld = (x: number, y: number, z: number) => {
      if (y < 0) return Block.Bedrock;
      if (y >= CHUNK_HEIGHT) return Block.Air;
      const address = worldToChunk(x, z);
      const key = `${address.chunkX},${address.chunkZ}`;
      let chunk = chunks.get(key);
      if (!chunk) {
        chunk = generateChunk("collision-regression", address.chunkX, address.chunkZ);
        chunks.set(key, chunk);
      }
      return getBlock(chunk, address.localX, y, address.localZ);
    };

    for (const [x, y] of [[17.5, 8], [18.5, 7], [19.5, 6], [20.5, 5], [21.5, 4], [22.5, 3], [26.5, 3]]) {
      expect(playerCollides(readWorld, x + MILESTONE_CAVE_X_OFFSET, y, 8.5)).toBe(false);
      expect(isPlayerSupported(readWorld, x + MILESTONE_CAVE_X_OFFSET, y, 8.5)).toBe(true);
    }
    for (let z = 5; z <= 11; z += 1) {
      for (let x = 22; x <= 27; x += 1) expect(readWorld(x + MILESTONE_CAVE_X_OFFSET, 2, z)).toBe(Block.Stone);
    }

    let position = { x: 17.5 + MILESTONE_CAVE_X_OFFSET, y: 8, z: 8.5 };
    let verticalVelocity = 0;
    const simulate = (direction: number, frames: number) => {
      for (let frame = 0; frame < frames; frame += 1) {
        const grounded = isPlayerSupported(readWorld, position.x, position.y, position.z);
        verticalVelocity = grounded && verticalVelocity < 0
          ? 0
          : Math.max(-TERMINAL_VELOCITY, verticalVelocity - GRAVITY * 0.05);
        const next = resolvePlayerMotion(position, { x: direction * 0.21, y: verticalVelocity * 0.05, z: 0 }, readWorld);
        if (next.hitVertical || next.grounded) verticalVelocity = 0;
        position = next;
        expect(playerCollides(readWorld, position.x, position.y, position.z)).toBe(false);
      }
    };

    simulate(1, 48);
    expect(position.x).toBeGreaterThan(26 + MILESTONE_CAVE_X_OFFSET);
    expect(position.y).toBeCloseTo(3, 1);
    simulate(-1, 55);
    expect(position.x).toBeLessThan(18 + MILESTONE_CAVE_X_OFFSET);
    expect(position.y).toBeCloseTo(8, 1);
  });

  it("lands on voxel terrain without passing through it", () => {
    const floor = (_x: number, y: number) => (y === 0 ? Block.Stone : Block.Air);
    const landed = resolvePlayerMotion({ x: 0.5, y: 3, z: 0.5 }, { x: 0, y: -3, z: 0 }, floor);
    expect(landed.hitVertical).toBe(true);
    expect(landed.grounded).toBe(true);
    expect(landed.y).toBeGreaterThan(0.9);
  });
});
