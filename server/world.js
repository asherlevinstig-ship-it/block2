// Deterministic world model, mirroring the client's generator.
// The same seeded hash-noise means client and server agree on terrain
// without ever shipping the 1MB world array — only edits are synced.
//
// The server uses this for: mob ground heights, gate placement,
// and validating block edits. Building interiors are approximated as
// solid footprints (mobs never need to path inside them).
const { DimensionGrid } = require('../shared/dimension-grid');

const CHUNK = 16, WORLD_SIZE = 1000, WORLD_CH = Math.ceil(WORLD_SIZE / CHUNK);
const WX = WORLD_SIZE, WH = 64, SEA = 13;
const LAVA_BORDER_WIDTH = 12, LAVA_BORDER_TOP = WH - 2;
const TOWN = { TC: WX / 2, HS: 72, G: 15 };
const TRAINING_MEADOW = { x: 560, z: 840, G: 18, R: 58 };
const TRAINING_MEADOW_TOWN_PORTAL = Object.freeze({ dx: 0, dz: 40, range: 5.8 });
const OLD_TOWN_TC = 64;
const TOWN_SPACING = 1.14;
const tc = v => Math.round(TOWN.TC + (v - OLD_TOWN_TC) * TOWN_SPACING);
const tp = v => TOWN.TC + (v - OLD_TOWN_TC) * TOWN_SPACING;
const TOWN_DISTRICTS = Object.freeze({
  guild: { x: -18, z: -24 },
  shrine: { x: 34, z: -26 },
  forge: { x: 24, z: -22 },
  tavern: { x: -44, z: 18 },
  roost: { x: 12, z: 24 },
  skyport: { x: -18, z: 20 },
  farm: { x: 36, z: 24 },
  market: { x: -28, z: 0 },
});
const dtx = (v, district) => tc(v) + (TOWN_DISTRICTS[district]?.x || 0);
const dtz = (v, district) => tc(v) + (TOWN_DISTRICTS[district]?.z || 0);
const dpx = (v, district) => tp(v) + (TOWN_DISTRICTS[district]?.x || 0);
const dpz = (v, district) => tp(v) + (TOWN_DISTRICTS[district]?.z || 0);
const townPos = (x, z, district) => ({ x: dpx(x, district), z: dpz(z, district) });
const townBlockPos = (x, z, district) => ({ x: dtx(x, district), z: dtz(z, district) });
const HUB = Object.freeze({
  guide: { x: TOWN.TC + 8.5, z: TOWN.TC - 4.5 },
  jobs: { x: TOWN.TC + 4.5, z: TOWN.TC - 8.5 },
  cartographer: { x: TOWN.TC - 22.5, z: TOWN.TC - 11.5 },
  quarry: townPos(79, 39, 'forge'),
  farm: townPos(56, 79, 'farm'),
  roost: townPos(96, 65, 'roost'),
  skyport: { ...townPos(32, 64, 'skyport'), y: TOWN.G + 24 },
  guardian: { x: TOWN.TC + .5, z: TOWN.TC - 24.5 },
  guild: townPos(54.5, 26.5, 'guild'),
  guildNoticeBoard: townPos(47, 26.7, 'guild'),
  socialMentor: townPos(43.5, 34, 'guild'),
  shrine: townPos(47.5, 48, 'shrine'),
  meditate: townPos(47.5, 46.5, 'shrine'),
  smith: townPos(78.5, 50, 'forge'),
  tavern: townPos(83.5, 77.5, 'tavern'),
  northGate: { x: TOWN.TC + .5, z: TOWN.TC - TOWN.HS + .5 },
});
function isTownFarmWorksite(x, z) {
  const fx = HUB.farm.x | 0, fz = HUB.farm.z | 0;
  x |= 0; z |= 0;
  return x >= fx - 3 && x <= fx + 3 && z >= fz - 2 && z <= fz + 2;
}
function isCentralCourtProtectedEdit(x, y, z) {
  return y >= TOWN.G - 3 && y <= TOWN.G + 12 && Math.hypot(x - TOWN.TC, z - TOWN.TC) <= 34;
}

const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, LOG: 5, LEAVES: 6, PLANKS: 7,
  COBBLE: 8, GLASS: 9, WATER: 10, BEDROCK: 11, BRICK: 12, TABLE: 13, FURNACE: 14,
  COAL_ORE: 15, IRON_ORE: 16, DIAMOND_ORE: 17, CONCRETE: 18, TORCH: 19, BED: 20,
  CHEST: 21, FARMLAND: 22, WHEAT_1: 23, WHEAT_2: 24, WHEAT_3: 25, LAVA: 26,
  SNOW: 27, ICE: 28, RED_SAND: 29, TERRACOTTA: 30, CACTUS: 31, LANTERN: 32, CAMPFIRE: 33,
  EGG_INSULATOR: 34, BARRIER: 35,
};
const MAX_BLOCK_ID = 35;
const NON_SOLID = new Set([B.AIR, B.WATER, B.LAVA, B.TORCH, B.LANTERN, B.CAMPFIRE, B.EGG_INSULATOR, B.WHEAT_1, B.WHEAT_2, B.WHEAT_3]);

const idx = (x, y, z) => y * WX * WX + z * WX + x;
const inWorld = (x, y, z) => x >= 0 && x < WX && y >= 0 && y < WH && z >= 0 && z < WX;
const worldGrid = new DimensionGrid({ kind: 'overworld', id: 'global', width: WX, height: WH, depth: WX, empty: B.AIR, outside: B.AIR });
const getB = (x, y, z) => worldGrid.getB(x, y, z);
const setB = (x, y, z, v) => worldGrid.setB(x, y, z, v);
const isSolid = id => !NON_SOLID.has(id);

function buildTownFarmWorksite(setBlock, groundY = TOWN.G) {
  const fx = HUB.farm.x | 0, fz = HUB.farm.z | 0;
  for (let x = fx - 3; x <= fx + 3; x++) for (let z = fz - 2; z <= fz + 2; z++) {
    setBlock(x, groundY, z, B.FARMLAND);
    setBlock(x, groundY + 1, z, ((x + z) & 1) ? B.WHEAT_3 : B.AIR);
  }
}

function hash2(x, z) {
  let n = (x * 374761393 + z * 668265263) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function noise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  const ab = a + (b - a) * u, cd = c + (d - c) * u;
  return ab + (cd - ab) * v;
}
function fbm(x, z) {
  return noise2(x * .04, z * .04) * .6 + noise2(x * .09, z * .09) * .28 + noise2(x * .22, z * .22) * .12;
}

// ---- biomes (MUST stay byte-identical to the client's copy in index.html) ----
const BIO = { PLAINS: 0, FOREST: 1, DESERT: 2, MESA: 3, SNOWY: 4, SWAMP: 5 };
const SNOWLINE = 30;
function lowN(x, z, ox, oz) { return noise2((x + ox) * 0.011, (z + oz) * 0.011); }
function mountainBoost(x, z) { const m = noise2((x + 1234) * 0.006, (z + 5678) * 0.006); const t = Math.max(0, (m - 0.6) / 0.4); return t * t * 44; }
function terrainHeight(x, z) { return Math.floor(7 + fbm(x + 311, z + 97) * 22 + mountainBoost(x, z)); }
function biomeAt(x, z) {
  const temp = lowN(x, z, 0, 0), moist = lowN(x, z, 777, 3210);
  if (temp < 0.34) return BIO.SNOWY;
  if (temp > 0.66) { if (moist < 0.30) return BIO.MESA; if (moist < 0.55) return BIO.DESERT; return BIO.PLAINS; }
  if (moist > 0.70) return BIO.SWAMP;
  if (moist > 0.52) return BIO.FOREST;
  return BIO.PLAINS;
}
function isTrainingMeadowLand(x, z, pad = 0) {
  return Math.hypot(x - TRAINING_MEADOW.x, z - TRAINING_MEADOW.z) <= TRAINING_MEADOW.R + pad;
}
function trainingMeadowTownPortalPoint() {
  return { x: TRAINING_MEADOW.x + TRAINING_MEADOW_TOWN_PORTAL.dx + .5, y: TRAINING_MEADOW.G + 1.05, z: TRAINING_MEADOW.z + TRAINING_MEADOW_TOWN_PORTAL.dz + .5 };
}
function buildTrainingMeadow(setBlock) {
  const { x: cx, z: cz, G, R } = TRAINING_MEADOW;
  const flat = (x, z, top = B.GRASS, under = B.DIRT) => { for (let y = 1; y < G - 4; y++) setBlock(x, y, z, B.STONE); for (let y = Math.max(1, G - 4); y < G; y++) setBlock(x, y, z, under); setBlock(x, G, z, top); for (let y = G + 1; y < WH; y++) setBlock(x, y, z, B.AIR); };
  const disk = (ox, oz, r, top = B.GRASS, under = B.DIRT) => { for (let x = cx + ox - r; x <= cx + ox + r; x++) for (let z = cz + oz - r; z <= cz + oz + r; z++) if (Math.hypot(x - (cx + ox), z - (cz + oz)) <= r) flat(x, z, top, under); };
  const rect = (x1, z1, x2, z2, top = B.COBBLE, under = B.STONE) => { for (let x = cx + x1; x <= cx + x2; x++) for (let z = cz + z1; z <= cz + z2; z++) flat(x, z, top, under); };
  const pillar = (ox, oz, h, mat = B.LOG, cap = B.LANTERN) => { for (let y = G + 1; y <= G + h; y++) setBlock(cx + ox, y, cz + oz, mat); if (cap) setBlock(cx + ox, G + h + 1, cz + oz, cap); };
  const tree = (ox, oz, h = 6, spread = 4) => { for (let y = G + 1; y <= G + h; y++) setBlock(cx + ox, y, cz + oz, B.LOG); for (let lx = -spread; lx <= spread; lx++) for (let lz = -spread; lz <= spread; lz++) for (let ly = h - 2; ly <= h + 4; ly++) { const crown = Math.abs(lx) + Math.abs(lz) + Math.abs(ly - (h + 1)) * 1.35; if (crown < spread + 3 && !(lx === 0 && lz === 0 && ly <= h)) setBlock(cx + ox + lx, G + ly, cz + oz + lz, B.LEAVES); } setBlock(cx + ox, G + h + 5, cz + oz, B.LANTERN); };
  const garden = (ox, oz, r = 4) => {
    for (let x = cx + ox - r; x <= cx + ox + r; x++) for (let z = cz + oz - r; z <= cz + oz + r; z++) {
      const d = Math.hypot(x - (cx + ox), z - (cz + oz));
      if (d <= r) flat(x, z, d > r - 1.15 ? B.COBBLE : (hash2(x, z) > .72 ? B.SAND : B.GRASS), d > r - 1.15 ? B.STONE : B.DIRT);
    }
    setBlock(cx + ox, G, cz + oz, B.GLASS); setBlock(cx + ox, G + 1, cz + oz, B.LANTERN);
    for (const [dx, dz] of [[r - 1, 0], [-r + 1, 0], [0, r - 1], [0, -r + 1]]) { setBlock(cx + ox + dx, G + 1, cz + oz + dz, B.LEAVES); setBlock(cx + ox + dx, G + 2, cz + oz + dz, B.LANTERN); }
  };
  const skyline = () => {
    const z0 = 47, tower = (ox, w, h, mat = B.STONE, spire = 2) => {
      for (let x = cx + ox; x < cx + ox + w; x++) for (let z = cz + z0; z <= cz + z0 + 1; z++) {
        flat(x, z, B.STONE, B.STONE);
        for (let y = G + 1; y <= G + h; y++) setBlock(x, y, z, mat);
        if ((x - (cx + ox)) % 3 === 1) for (let y = G + 3; y <= G + h - 2; y += 3) setBlock(x, y, z, B.GLASS);
      }
      for (let x = cx + ox - 1; x <= cx + ox + w; x++) if ((x - (cx + ox)) % 2 === 0) setBlock(x, G + h + 1, cz + z0, B.COBBLE);
      for (let y = G + h + 2; y <= G + h + spire + 1; y++) setBlock(cx + ox + Math.floor(w / 2), y, cz + z0, B.BRICK);
      setBlock(cx + ox + Math.floor(w / 2), G + h + spire + 2, cz + z0, B.LANTERN);
    };
    for (let x = cx - 42; x <= cx + 42; x++) for (let z = cz + 45; z <= cz + 49; z++) if (Math.abs(x - cx) > 5) flat(x, z, B.COBBLE, B.STONE);
    tower(-41, 7, 12, B.COBBLE, 3); tower(-30, 8, 17, B.BRICK, 4); tower(-17, 7, 11, B.STONE, 2); tower(10, 7, 11, B.STONE, 2); tower(22, 8, 16, B.BRICK, 4); tower(35, 7, 12, B.COBBLE, 3);
    for (const ox of [-6, 6]) for (let y = G + 1; y <= G + 13; y++) { setBlock(cx + ox, y, cz + 47, B.BRICK); if (y % 3 === 0) setBlock(cx + ox, y, cz + 46, B.GLASS); }
    for (let x = cx - 6; x <= cx + 6; x++) if (Math.abs(x - cx) > 2) setBlock(x, G + 14, cz + 47, B.COBBLE);
    for (let y = G + 1; y <= G + 17; y++) for (let x = cx - 2; x <= cx + 2; x++) setBlock(x, y, cz + 47, B.AIR);
    for (const ox of [-43, 43, -19, 19, -6, 6]) setBlock(cx + ox, G + 14, cz + 45, B.LANTERN);
  };
  const townPortalArch = () => {
    const px = cx + TRAINING_MEADOW_TOWN_PORTAL.dx, pz = cz + TRAINING_MEADOW_TOWN_PORTAL.dz;
    for (let x = px - 7; x <= px + 7; x++) for (let z = pz - 4; z <= pz + 4; z++) if (Math.hypot(x - px, z - pz) <= 7.8) flat(x, z, Math.abs(x - px) <= 2 && Math.abs(z - pz) <= 2 ? B.GLASS : B.COBBLE, B.STONE);
    for (let x = px - 2; x <= px + 2; x++) for (let z = pz - 1; z <= pz + 1; z++) { setBlock(x, G, z, B.GLASS); setBlock(x, G + 1, z, B.AIR); }
    for (const sx of [-5, 5]) {
      for (let y = G + 1; y <= G + 10; y++) {
        setBlock(px + sx, y, pz, B.BRICK);
        if (y % 3 === 0) { setBlock(px + sx, y, pz - 1, B.GLASS); setBlock(px + sx, y, pz + 1, B.GLASS); }
      }
      for (const dz of [-2, 2]) for (let y = G + 1; y <= G + 5; y++) setBlock(px + sx, y, pz + dz, y === G + 5 ? B.LANTERN : B.COBBLE);
    }
    for (let x = px - 5; x <= px + 5; x++) {
      const rise = Math.max(0, 3 - Math.floor(Math.abs(x - px) / 2));
      for (let y = G + 9; y <= G + 10 + rise; y++) setBlock(x, y, pz, Math.abs(x - px) <= 2 && y < G + 12 ? B.GLASS : B.BRICK);
      if (Math.abs(x - px) > 1) setBlock(x, G + 11 + rise, pz, B.COBBLE);
    }
    for (let y = G + 1; y <= G + 7; y++) for (let x = px - 2; x <= px + 2; x++) setBlock(x, y, pz, B.AIR);
    for (const sx of [-6, 6]) { setBlock(px + sx, G + 1, pz - 3, B.LANTERN); setBlock(px + sx, G + 1, pz + 3, B.LANTERN); }
    setBlock(px, G + 8, pz, B.LANTERN);
  };
  const invisibleBoundary = () => {
    for (let x = Math.floor(cx - R - 2); x <= Math.ceil(cx + R + 2); x++) for (let z = Math.floor(cz - R - 2); z <= Math.ceil(cz + R + 2); z++) {
      const d = Math.hypot(x - cx, z - cz);
      if (d < R - 1 || d > R + 2) continue;
      for (let y = G + 1; y <= G + 13; y++) setBlock(x, y, z, B.BARRIER);
    }
  };
  const floatingBackdrop = () => {
    for (let x = Math.floor(cx - R - 2); x <= Math.ceil(cx + R + 2); x++) for (let z = Math.floor(cz - R - 2); z <= Math.ceil(cz + R + 2); z++) {
      const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
      if (d < R - 30 || d > R - 1) continue;
      const rim = Math.max(0, Math.min(1, (R - d) / 30)), noise = Math.sin((x + 7) * .22) + Math.cos((z - 11) * .19);
      const bellyTop = G - 3 - Math.round(rim * 4) + Math.round(noise * .45);
      const bellyBottom = Math.max(2, G - 13 + Math.round(rim * 5) + Math.round(noise * .35));
      for (let y = 1; y < bellyBottom; y++) setBlock(x, y, z, B.AIR);
      for (let y = bellyBottom; y <= bellyTop; y++) setBlock(x, y, z, y > bellyTop - 2 ? B.DIRT : B.STONE);
    }
    for (let x = Math.floor(cx - R - 96); x <= Math.ceil(cx + R + 96); x++) for (let z = Math.floor(cz - R - 96); z <= Math.ceil(cz + R + 96); z++) {
      const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
      if (d < R + 38 || d > R + 94) continue;
      const fade = Math.max(0, Math.min(1, (R + 94 - d) / 24)), shape = Math.sin((x - 5) * .08) + Math.cos((z + 19) * .09) + Math.sin((x + z) * .031);
      if (fade < .28 && shape < .25) continue;
      const y = Math.max(2, Math.min(G - 15, 3 + Math.round(shape * .9) + Math.round(fade)));
      for (let yy = 1; yy < y - 2; yy++) setBlock(x, yy, z, B.STONE);
      setBlock(x, y - 2, z, B.STONE); setBlock(x, y - 1, z, B.DIRT);
      const top = hash2(x, z) > .82 ? B.SAND : hash2(x + 13, z - 9) > .88 ? B.COBBLE : B.GRASS;
      setBlock(x, y, z, top);
      for (let yy = y + 1; yy <= G - 12; yy++) setBlock(x, yy, z, B.AIR);
      if (hash2(x - 31, z + 17) > .992) setBlock(x, y + 1, z, B.LEAVES);
      if (hash2(x + 41, z - 23) > .996) { setBlock(x, y, z, B.WATER); setBlock(x, y + 1, z, B.AIR); }
    }
    const cloud = (ox, oz, y, rx, rz) => {
      for (let x = cx + ox - rx; x <= cx + ox + rx; x++) for (let z = cz + oz - rz; z <= cz + oz + rz; z++) for (let yy = y - 1; yy <= y + 1; yy++) {
        const puff = ((x - (cx + ox)) / rx) ** 2 + ((z - (cz + oz)) / rz) ** 2 + ((yy - y) / 1.4) ** 2;
        if (puff <= 1 && (hash2(x, z) > .18 || puff < .62)) setBlock(x, yy, z, puff > .74 ? B.GLASS : B.SNOW);
      }
    };
    cloud(-76, 18, G - 8, 13, 6); cloud(-58, -48, G - 10, 18, 8); cloud(52, -55, G - 9, 16, 7); cloud(82, 12, G - 8, 20, 8); cloud(14, 78, G - 11, 22, 9); cloud(-22, 62, G - 9, 14, 6);
  };
  for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) for (let z = Math.floor(cz - R); z <= Math.ceil(cz + R); z++) {
    if (!inWorld(x, 0, z) || !isTrainingMeadowLand(x, z)) continue;
    const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz), edge = Math.max(0, Math.min(1, (R - d) / 10));
    const safe = Math.abs(dx) <= 4 && dz >= -33 && dz <= 28 || Math.abs(dz + 12) <= 4 && dx >= -32 && dx <= 40 || Math.hypot(dx - 22, dz + 6) <= 9 || Math.hypot(dx + 22, dz + 20) <= 10 || Math.hypot(dx + 32, dz - 4) <= 11 || Math.hypot(dx, dz - 40) <= 10;
    const lift = safe ? 0 : Math.max(0, Math.min(7, Math.round((Math.sin((x + 13) * .18) + Math.cos((z - 31) * .16) + Math.sin((x - z) * .07) - .45) * 1.7)));
    const ground = edge < 1 ? G + Math.round((terrainHeight(x, z) - G) * (1 - edge)) : G + lift;
    for (let y = 1; y < ground - 3; y++) setBlock(x, y, z, B.STONE);
    for (let y = Math.max(1, ground - 3); y < ground; y++) setBlock(x, y, z, B.DIRT);
    setBlock(x, ground, z, B.GRASS);
    for (let y = ground + 1; y < WH; y++) setBlock(x, y, z, B.AIR);
  }
  const route = [[-32, 24], [-20, 18], [-14, 15], [-8, 12], [4, 6], [14, 0], [22, -6], [30, -12], [40, -18], [10, -28], [-8, -28], [-22, -20], [-28, -14], [-32, -8], [-32, 4], [0, 40]];
  floatingBackdrop();
  for (let i = 0; i < route.length - 1; i++) { const [ax, az] = route[i], [bx, bz] = route[i + 1], steps = Math.max(Math.abs(bx - ax), Math.abs(bz - az)); for (let s = 0; s <= steps; s++) { const t = s / Math.max(1, steps), px = Math.round(ax + (bx - ax) * t), pz = Math.round(az + (bz - az) * t); for (let ox = -2; ox <= 2; ox++) for (let oz = -2; oz <= 2; oz++) if (Math.abs(ox) + Math.abs(oz) <= 2) flat(cx + px + ox, cz + pz + oz, (Math.abs(ox) + Math.abs(oz) === 2 && hash2(cx + px + ox, cz + pz + oz) > .55) ? B.SAND : B.COBBLE, B.STONE); } }
  disk(-32, 24, 7, B.COBBLE, B.STONE); disk(22, -6, 9, B.GRASS); disk(30, -12, 6, B.PLANKS, B.DIRT); disk(40, -18, 5, B.COBBLE, B.STONE); disk(10, -28, 7, B.GRASS); disk(-22, -20, 9, B.COBBLE, B.STONE); disk(-32, -6, 8, B.BRICK, B.STONE); disk(0, 40, 9, B.GLASS, B.STONE);
  for (let z = cz - 46; z <= cz + 28; z++) for (let x = cx - 6; x <= cx - 1; x++) { const bend = Math.round(Math.sin((z - cz) * .16) * 3); if (Math.abs((x - cx) - bend) <= 1) { flat(x, z, B.WATER, B.SAND); setBlock(x, G + 1, z, B.AIR); } else if (Math.abs((x - cx) - bend) === 2 && hash2(x, z) > .4) flat(x, z, B.SAND, B.DIRT); }
  rect(-8, 8, 2, 12, B.PLANKS, B.STONE); for (const ox of [-8, -4, 0, 2]) { setBlock(cx + ox, G + 1, cz + 7, B.LOG); setBlock(cx + ox, G + 1, cz + 13, B.LOG); }
  rect(-8, -14, 2, -10, B.PLANKS, B.STONE); for (const ox of [-8, -4, 0, 2]) { setBlock(cx + ox, G + 1, cz - 15, B.LOG); setBlock(cx + ox, G + 1, cz - 9, B.LOG); }
  for (const [ox, oz, h] of [[-46, 32, 6], [-18, 32, 6], [-46, 20, 3], [-18, 20, 3]]) pillar(ox, oz, h, B.LOG, h > 5 ? B.LANTERN : B.TORCH);
  for (let x = cx - 46; x <= cx - 18; x++) for (let y = G + 7; y <= G + 8; y++) setBlock(x, y, cz + 32, Math.abs(x - (cx - 32)) < 5 && y === G + 7 ? B.AIR : B.BRICK);
  setBlock(cx - 32, G + 9, cz + 32, B.GLASS); setBlock(cx - 32, G + 10, cz + 32, B.LANTERN);
  for (let dx = -7; dx <= 7; dx++) { const rise = Math.max(0, 3 - Math.floor(Math.abs(dx) / 2)); setBlock(cx - 32 + dx, G + 9 + rise, cz + 32, Math.abs(dx) <= 1 ? B.GLASS : B.BRICK); }
  for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [3, 3], [-3, 3], [3, -3], [-3, -3]]) setBlock(cx - 32 + dx, G, cz + 24 + dz, B.GLASS);
  tree(22, -6, 10, 6); for (const [ox, oz] of [[13, -7], [30, -5], [18, 3], [27, 3]]) tree(ox, oz, 4, 3);
  for (let a = 0; a < 32; a++) { const ang = a * Math.PI * 2 / 32, x = Math.round(cx + 22 + Math.cos(ang) * 8), z = Math.round(cz - 6 + Math.sin(ang) * 8); if (Math.abs(Math.sin(ang * 2)) > .28) setBlock(x, G, z, a % 2 ? B.GLASS : B.COBBLE); }
  for (const [ox, oz] of [[14, -6], [30, -6], [22, -14], [22, 2]]) { setBlock(cx + ox, G, cz + oz, B.GLASS); setBlock(cx + ox, G + 1, cz + oz, B.LANTERN); }
  setBlock(cx + 30, G + 1, cz - 12, B.TABLE);
  setBlock(cx + 29, G + 1, cz - 14, B.CAMPFIRE); setBlock(cx + 33, G + 1, cz - 12, B.CHEST); for (const [ox, oz] of [[27, -15], [33, -15], [27, -9], [33, -9]]) pillar(ox, oz, 3, B.LOG, B.TORCH);
  for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) setBlock(cx + 40 + ox, G, cz - 18 + oz, B.COBBLE);
  for (const [ox, oz] of [[36, -22], [44, -22], [36, -14], [44, -14]]) pillar(ox, oz, 3, B.COBBLE, B.LANTERN);
  for (let x = cx + 36; x <= cx + 44; x++) for (const z of [cz - 22, cz - 14]) setBlock(x, G + 1, z, B.LOG);
  for (let z = cz - 22; z <= cz - 14; z++) for (const x of [cx + 36, cx + 44]) setBlock(x, G + 1, z, B.LOG);
  for (let x = cx + 8; x <= cx + 12; x++) {
    setBlock(x, G, cz - 28, B.FARMLAND);
    if ((x - cx) % 2 === 0) setBlock(x, G + 1, cz - 28, B.WHEAT_3);
  }
  for (let x = cx + 4; x <= cx + 16; x++) for (let z = cz - 32; z <= cz - 24; z++) { if ((x - cx) % 3 === 0 && z !== cz - 28) { setBlock(x, G, z, B.FARMLAND); if (hash2(x, z) > .35) setBlock(x, G + 1, z, B.WHEAT_3); } else if (Math.abs(z - (cz - 28)) === 4) setBlock(x, G, z, B.LOG); }
  setBlock(cx - 22, G + 1, cz - 20, B.CAMPFIRE); for (const [ox, oz] of [[-30, -24], [-14, -24], [-30, -16], [-14, -16]]) pillar(ox, oz, 3, B.LOG, B.TORCH);
  for (let a = 0; a < 32; a++) { const ang = a * Math.PI * 2 / 32, x = Math.round(cx - 22 + Math.cos(ang) * 9), z = Math.round(cz - 20 + Math.sin(ang) * 9); setBlock(x, G, z, a % 2 ? B.BRICK : B.COBBLE); }
  for (const [ox, oz, h, mat] of [[-36, -9, 5, B.BRICK], [-28, -1, 5, B.BRICK], [-36, 1, 4, B.COBBLE], [-28, -11, 4, B.COBBLE]]) pillar(ox, oz, h, mat, B.LANTERN);
  setBlock(cx - 32, G + 2, cz - 6, B.GLASS); setBlock(cx - 32, G + 3, cz - 6, B.LANTERN);
  for (let y = G + 1; y <= G + 9; y++) { setBlock(cx - 4, y, cz + 40, y % 3 === 0 ? B.GLASS : B.BRICK); setBlock(cx + 4, y, cz + 40, y % 3 === 0 ? B.GLASS : B.BRICK); }
  for (let x = cx - 4; x <= cx + 4; x++) if (Math.abs(x - cx) > 1) setBlock(x, G + 10, cz + 40, B.GLASS);
  for (let y = G + 1; y <= G + 14; y++) setBlock(cx, y, cz + 40, B.AIR);
  for (const ox of [-2, 2]) { setBlock(cx + ox, G, cz + 40, B.GLASS); setBlock(cx + ox, G + 1, cz + 40, B.LANTERN); }
  const lessonTargets = route.slice(1);
  for (let i = 0; i < lessonTargets.length; i++) {
    const target = lessonTargets[i], prev = route[i], dx = Math.sign(target[0] - prev[0]), dz = Math.sign(target[1] - prev[1]), px = -dz, pz = dx;
    for (const side of [-1, 1]) { const lx = target[0] + px * side * 4, lz = target[1] + pz * side * 4; setBlock(cx + lx, G, cz + lz, B.GLASS); setBlock(cx + lx, G + 1, cz + lz, B.LANTERN); }
  }
  garden(11, 22, 5); garden(-19, 7, 4); garden(29, 18, 4); garden(-8, -41, 5);
  skyline();
  townPortalArch();
  invisibleBoundary();
  for (const [ox, oz] of [[-46, 0], [-43, 18], [-18, 36], [18, 34], [42, 14], [44, -26], [-44, -34], [32, -44]]) tree(ox, oz, 5 + (Math.abs(ox + oz) % 3), 4);
}

const MINOR_LANDMARK_TYPES = ['ruins', 'shrine', 'hunter_camp', 'bandit_camp', 'graveyard'];
const MAJOR_LANDMARK_TYPES = ['abandoned_tower', 'cave', 'giant_tree', 'crashed_airship'];
const LANDMARK_NAMES = {
  ruins: 'Weathered Ruins', shrine: 'Wayside Shrine', hunter_camp: 'Hunter Camp', bandit_camp: 'Bandit Camp', graveyard: 'Forgotten Graveyard',
  abandoned_tower: 'Abandoned Watchtower', cave: 'Deepmouth Cave', giant_tree: 'Elderheart Tree', crashed_airship: 'Fallen Airship',
};
function regionalLandmarkSpecs() {
  const majors = [], minors = [];
  let n = 0;
  for (let gx = 125; gx < WX - 100; gx += 250) for (let gz = 125; gz < WX - 100; gz += 250) {
    const x = Math.round(gx + (hash2(gx + 1701, gz + 913) - .5) * 70);
    const z = Math.round(gz + (hash2(gx + 2719, gz + 1877) - .5) * 70);
    const y = terrainHeight(x, z), r = 8;
    const hs = [terrainHeight(x-r,z-r),terrainHeight(x+r,z-r),terrainHeight(x-r,z+r),terrainHeight(x+r,z+r),y];
    if (x < 30 || z < 30 || x >= WX-30 || z >= WX-30 || y <= SEA+1 || y > 38 || Math.max(...hs)-Math.min(...hs)>5) { n++; continue; }
    if (Math.max(Math.abs(x-TOWN.TC),Math.abs(z-TOWN.TC)) < TOWN.HS+55) { n++; continue; }
    const type = MAJOR_LANDMARK_TYPES[majors.length % MAJOR_LANDMARK_TYPES.length]; n++;
    majors.push({ id:'major_'+gx+'_'+gz, type, name:LANDMARK_NAMES[type], x, y, z, major:true, radius:18 });
  }
  n = 0;
  for (let gx = 65; gx < WX - 55; gx += 100) for (let gz = 65; gz < WX - 55; gz += 100) {
    const x = Math.round(gx + (hash2(gx + 431, gz + 337) - .5) * 40);
    const z = Math.round(gz + (hash2(gx + 883, gz + 617) - .5) * 40);
    const y = terrainHeight(x, z), r = 5;
    const hs = [terrainHeight(x-r,z-r),terrainHeight(x+r,z-r),terrainHeight(x-r,z+r),terrainHeight(x+r,z+r),y];
    if (x < 24 || z < 24 || x >= WX-24 || z >= WX-24 || y <= SEA+1 || y > 38 || Math.max(...hs)-Math.min(...hs)>4) { n++; continue; }
    if (Math.max(Math.abs(x-TOWN.TC),Math.abs(z-TOWN.TC)) < TOWN.HS+35 || majors.some(m=>Math.hypot(m.x-x,m.z-z)<38)) { n++; continue; }
    const type = MINOR_LANDMARK_TYPES[minors.length % MINOR_LANDMARK_TYPES.length]; n++;
    minors.push({ id:'minor_'+gx+'_'+gz, type, name:LANDMARK_NAMES[type], x, y, z, major:false, radius:11 });
  }
  return majors.concat(minors);
}
function roadNetworkSpecs() {
  const majors = regionalLandmarkSpecs().filter(s => s.major);
  const connected = [{ id: 'town', x: TOWN.TC, y: TOWN.G, z: TOWN.TC }], roads = [];
  for (const node of majors) {
    let best = connected[0], bd = Infinity;
    for (const other of connected) {
      const d = Math.hypot(node.x - other.x, node.z - other.z);
      if (d < bd) { bd = d; best = other; }
    }
    roads.push({ id: 'road_' + best.id + '_' + node.id, a: best, b: node, length: bd });
    connected.push(node);
  }
  return roads;
}
function roadBreadcrumbSpecs() {
  const types = ['broken_signpost', 'campfire', 'banner', 'lantern_post'], out = [];
  let n = 0;
  for (const road of roadNetworkSpecs()) {
    const dx = (road.b.x - road.a.x) / road.length, dz = (road.b.z - road.a.z) / road.length;
    for (let d = 34; d < road.length - 24; d += 42) {
      const side = n % 2 ? -1 : 1;
      const x = Math.round(road.a.x + dx * d - dz * 4 * side);
      const z = Math.round(road.a.z + dz * d + dx * 4 * side);
      const y = Math.min(WH - 7, Math.max(SEA + 1, terrainHeight(x, z)));
      out.push({ id: 'crumb_' + n, roadId: road.id, type: types[n % types.length], x, y, z, dx, dz });
      n++;
    }
  }
  return out;
}
function buildRoadNetwork(setBlock) {
  for (const road of roadNetworkSpecs()) {
    const steps = Math.ceil(road.length / 1.25), dx = (road.b.x - road.a.x) / road.length, dz = (road.b.z - road.a.z) / road.length;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, cx = Math.round(road.a.x + (road.b.x - road.a.x) * t), cz = Math.round(road.a.z + (road.b.z - road.a.z) * t);
      const y = Math.min(WH - 5, Math.max(SEA + 1, terrainHeight(cx, cz)));
      for (let w = -1; w <= 1; w++) {
        const x = Math.round(cx - dz * w), z = Math.round(cz + dx * w);
        setBlock(x, y - 2, z, B.DIRT); setBlock(x, y - 1, z, B.DIRT);
        setBlock(x, y, z, y === SEA + 1 ? B.PLANKS : (i % 7 === 0 ? B.BRICK : B.COBBLE));
        for (let h = 1; h <= 3; h++) setBlock(x, y + h, z, B.AIR);
      }
    }
  }
  for (const s of roadBreadcrumbSpecs()) {
    const x = s.x, y = s.y, z = s.z;
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) setBlock(x + ox, y, z + oz, B.COBBLE);
    for (let h = 1; h <= 5; h++) setBlock(x, y + h, z, B.AIR);
    if (s.type === 'broken_signpost') {
      setBlock(x, y + 1, z, B.LOG); setBlock(x, y + 2, z, B.LOG);
      setBlock(x + Math.round(s.dx), y + 2, z + Math.round(s.dz), B.PLANKS);
      setBlock(x - Math.round(s.dx), y + 2, z - Math.round(s.dz), B.PLANKS);
    } else if (s.type === 'campfire') {
      setBlock(x, y + 1, z, B.CAMPFIRE);
    } else if (s.type === 'banner') {
      for (let h = 1; h <= 4; h++) setBlock(x, y + h, z, B.LOG);
      setBlock(x + Math.round(s.dx), y + 3, z + Math.round(s.dz), B.TERRACOTTA);
      setBlock(x + Math.round(s.dx), y + 4, z + Math.round(s.dz), B.TERRACOTTA);
    } else {
      for (let h = 1; h <= 3; h++) setBlock(x, y + h, z, B.LOG);
      setBlock(x, y + 4, z, B.LANTERN);
    }
  }
  return roadBreadcrumbSpecs();
}
const SMALL_DISCOVERY_TYPES = ['rare_plant','buried_chest','lore_tablet','monster_nest','fishing_pool','ore_outcrop','traveling_merchant','puzzle_shrine','rain_bloom','storm_crystal','sun_dial'];
function smallDiscoverySpecs() {
  const out = [], landmarks = regionalLandmarkSpecs(), roads = roadNetworkSpecs(); let n = 0;
  const segDist = (px,pz,r) => { const vx=r.b.x-r.a.x,vz=r.b.z-r.a.z,l2=vx*vx+vz*vz; const t=Math.max(0,Math.min(1,((px-r.a.x)*vx+(pz-r.a.z)*vz)/l2)); return Math.hypot(px-(r.a.x+vx*t),pz-(r.a.z+vz*t)); };
  for(let gx=55;gx<WX-45;gx+=105) for(let gz=55;gz<WX-45;gz+=105){
    const x=Math.round(gx+(hash2(gx+811,gz+337)-.5)*54),z=Math.round(gz+(hash2(gx+1297,gz+919)-.5)*54),y=terrainHeight(x,z),type=SMALL_DISCOVERY_TYPES[n%SMALL_DISCOVERY_TYPES.length];n++;
    if(x<22||z<22||x>=WX-22||z>=WX-22||y<=SEA+1||y>39)continue;
    if(Math.hypot(x-TOWN.TC,z-TOWN.TC)<TOWN.HS+32||landmarks.some(s=>Math.hypot(x-s.x,z-s.z)<26)||roads.some(r=>segDist(x,z,r)<10))continue;
    const r=3,hs=[terrainHeight(x-r,z-r),terrainHeight(x+r,z-r),terrainHeight(x-r,z+r),terrainHeight(x+r,z+r),y];
    if(Math.max(...hs)-Math.min(...hs)>5)continue;
    const spec={id:'discovery_'+gx+'_'+gz,type,x,y,z,radius:type==='fishing_pool'?7:5};
    if(type==='puzzle_shrine'){const ox=[-2,0,2][Math.floor(hash2(x*17,z*19)*3)];spec.target={x:x+ox,y:y+2,z};}
    out.push(spec);
  }
  return out;
}
function buildSmallDiscoveries(setBlock){
  for(const s of smallDiscoverySpecs()){const x=s.x,y=s.y,z=s.z;
    for(let h=1;h<=5;h++)for(let ox=-3;ox<=3;ox++)for(let oz=-3;oz<=3;oz++)if(Math.abs(ox)<=1||Math.abs(oz)<=1)setBlock(x+ox,y+h,z+oz,B.AIR);
    if(s.type==='rare_plant'){
      setBlock(x,y+1,z,B.LEAVES);for(const [ox,oz] of [[1,0],[-1,0],[0,1],[0,-1]])setBlock(x+ox,y+1,z+oz,B.LEAVES);setBlock(x,y+2,z,B.LANTERN);
    }else if(s.type==='buried_chest'){
      setBlock(x,y-1,z,B.CHEST);setBlock(x,y,z,B.DIRT);setBlock(x+1,y+1,z,B.TORCH);setBlock(x+1,y,z,B.COBBLE);
    }else if(s.type==='lore_tablet'){
      setBlock(x,y+1,z,B.BRICK);setBlock(x,y+2,z,B.BRICK);setBlock(x,y+3,z,B.LANTERN);for(const ox of [-1,1])setBlock(x+ox,y,z,B.COBBLE);
    }else if(s.type==='monster_nest'){
      for(let ox=-3;ox<=3;ox++)for(let oz=-3;oz<=3;oz++)if(Math.abs(ox)===3||Math.abs(oz)===3)setBlock(x+ox,y+1,z+oz,B.LOG);setBlock(x,y+1,z,B.CAMPFIRE);setBlock(x,y,z,B.COBBLE);
    }else if(s.type==='fishing_pool'){
      for(let ox=-3;ox<=3;ox++)for(let oz=-3;oz<=3;oz++)if(ox*ox+oz*oz<=10){setBlock(x+ox,y-1,z+oz,B.SAND);setBlock(x+ox,y,z+oz,B.WATER);setBlock(x+ox,y+1,z+oz,B.AIR);}setBlock(x+4,y+1,z,B.LANTERN);
    }else if(s.type==='ore_outcrop'){
      for(let ox=-2;ox<=2;ox++)for(let oz=-2;oz<=2;oz++){const h=3-Math.min(2,Math.abs(ox)+Math.abs(oz));for(let k=1;k<=h;k++){const ring=Math.min(3,Math.floor(Math.hypot(x-TOWN.TC,z-TOWN.TC)/100));const roll=hash2(x+ox*31+k,z+oz*47);setBlock(x+ox,y+k,z+oz,roll>.88?(ring>=3?B.DIAMOND_ORE:ring>=2?B.IRON_ORE:B.COAL_ORE):B.STONE);}}
    }else if(s.type==='traveling_merchant'){
      setBlock(x,y+1,z,B.CAMPFIRE);for(const ox of [-2,2]){setBlock(x+ox,y+1,z-2,B.LOG);setBlock(x+ox,y+2,z-2,B.LOG);}for(let ox=-2;ox<=2;ox++)setBlock(x+ox,y+3,z-2,B.PLANKS);setBlock(x,y+1,z-2,B.CHEST);
    }else if(s.type==='rain_bloom'){
      setBlock(x,y+1,z,B.LEAVES);setBlock(x,y+2,z,B.WATER);for(const [ox,oz] of [[1,0],[-1,0],[0,1],[0,-1]])setBlock(x+ox,y+1,z+oz,B.LEAVES);
    }else if(s.type==='storm_crystal'){
      for(let h=1;h<=4;h++)setBlock(x,y+h,z,h===4?B.DIAMOND_ORE:B.GLASS);for(const [ox,oz] of [[1,0],[-1,0],[0,1],[0,-1]])setBlock(x+ox,y+1,z+oz,B.IRON_ORE);
    }else if(s.type==='sun_dial'){
      for(let ox=-2;ox<=2;ox++)for(let oz=-2;oz<=2;oz++)setBlock(x+ox,y,z+oz,B.SAND);setBlock(x,y+1,z,B.BRICK);setBlock(x,y+2,z,B.LOG);setBlock(x+1,y+1,z,B.TORCH);
    }else{
      for(const ox of [-2,0,2]){setBlock(x+ox,y,z,B.BRICK);setBlock(x+ox,y+1,z,B.BRICK);setBlock(x+ox,y+2,z,x+ox===s.target.x?B.TORCH:B.LANTERN);}setBlock(x,y,z+2,B.BRICK);
    }
  }
  return smallDiscoverySpecs();
}
function treasureCacheSpecs() {
  const out = [], landmarks = regionalLandmarkSpecs(), roads = roadNetworkSpecs(), discoveries = smallDiscoverySpecs();
  const segDist = (px, pz, r) => { const vx = r.b.x - r.a.x, vz = r.b.z - r.a.z, l2 = vx * vx + vz * vz; const t = Math.max(0, Math.min(1, ((px - r.a.x) * vx + (pz - r.a.z) * vz) / l2)); return Math.hypot(px - (r.a.x + vx * t), pz - (r.a.z + vz * t)); };
  for (let gx = 85; gx < WX - 70; gx += 90) for (let gz = 85; gz < WX - 70; gz += 90) {
    const x = Math.round(gx + (hash2(gx + 9401, gz + 1723) - .5) * 58);
    const z = Math.round(gz + (hash2(gx + 5527, gz + 8831) - .5) * 58);
    const y = terrainHeight(x, z), ring = Math.min(3, Math.floor(Math.hypot(x - TOWN.TC, z - TOWN.TC) / 100));
    if (x < LAVA_BORDER_WIDTH + 18 || z < LAVA_BORDER_WIDTH + 18 || x >= WX - LAVA_BORDER_WIDTH - 18 || z >= WX - LAVA_BORDER_WIDTH - 18 || y <= SEA + 1 || y > 40) continue;
    if (Math.hypot(x - TOWN.TC, z - TOWN.TC) < TOWN.HS + 90 || isTrainingMeadowLand(x, z, 24)) continue;
    if (landmarks.some(s => Math.hypot(x - s.x, z - s.z) < 30) || discoveries.some(s => Math.hypot(x - s.x, z - s.z) < 22) || roads.some(r => segDist(x, z, r) < 14)) continue;
    const hs = [terrainHeight(x - 2, z - 2), terrainHeight(x + 2, z - 2), terrainHeight(x - 2, z + 2), terrainHeight(x + 2, z + 2), y];
    if (Math.max(...hs) - Math.min(...hs) > 3) continue;
    out.push({ id: 'cache_' + gx + '_' + gz, type: 'treasure_cache', x, y, z, ring, radius: 4 });
  }
  return out;
}
function buildTreasureCaches(setBlock) {
  for (const s of treasureCacheSpecs()) {
    const { x, y, z, ring } = s;
    for (let h = 1; h <= 4; h++) for (let ox = -2; ox <= 2; ox++) for (let oz = -2; oz <= 2; oz++) if (Math.abs(ox) <= 1 || Math.abs(oz) <= 1) setBlock(x + ox, y + h, z + oz, B.AIR);
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) setBlock(x + ox, y, z + oz, ring >= 2 ? B.COBBLE : B.DIRT);
    setBlock(x, y + 1, z, B.CHEST);
    setBlock(x + 1, y + 1, z, B.TORCH);
    if (ring >= 2) setBlock(x - 1, y + 1, z, B.BRICK);
    if (ring >= 3) setBlock(x, y + 2, z - 1, B.LANTERN);
  }
  return treasureCacheSpecs();
}
function caveNetworkSpecs() {
  return regionalLandmarkSpecs().filter(s => s.type === 'cave').map((s, caveIndex) => {
    const points = [];
    let x = s.x, z = s.z + 12, y = Math.max(7, Math.min(WH - 10, s.y - 3));
    let angle = hash2(s.x + 3101, s.z + 8807) * Math.PI * 2;
    points.push({ x, y, z, r: 2.4 });
    for (let i = 0; i < 6; i++) {
      angle += (hash2(s.x + i * 97 + 41, s.z + i * 131 + 73) - .5) * 1.45;
      const len = 15 + Math.floor(hash2(s.x + i * 53 + 11, s.z + i * 71 + 29) * 13);
      x = Math.max(24, Math.min(WX - 25, Math.round(x + Math.cos(angle) * len)));
      z = Math.max(24, Math.min(WX - 25, Math.round(z + Math.sin(angle) * len)));
      y = Math.max(6, Math.min(Math.min(WH - 12, terrainHeight(x, z) - 5), y + Math.floor((hash2(s.x + i * 173, s.z + i * 199) - .58) * 5)));
      points.push({ x, y, z, r: 2.2 + hash2(x + 17, z + 23) * .8 });
    }
    const caverns = points.filter((_, i) => i === 2 || i === 4 || i === points.length - 1).map((p, i) => ({
      x: p.x, y: p.y, z: p.z,
      rx: 5 + Math.floor(hash2(p.x + 503, p.z + 907) * 4) + (i === 2 ? 1 : 0),
      ry: 3 + Math.floor(hash2(p.x + 911, p.z + 317) * 2),
      rz: 5 + Math.floor(hash2(p.x + 223, p.z + 613) * 4),
    }));
    return { id: 'cave_network_' + caveIndex, entrance: { x: s.x, y: s.y - 3, z: s.z + 11 }, points, caverns };
  });
}
function buildCaveNetworks(setBlock, getBlock = getB) {
  const safeColumn = (x, z) =>
    x > LAVA_BORDER_WIDTH + 8 && z > LAVA_BORDER_WIDTH + 8 &&
    x < WX - LAVA_BORDER_WIDTH - 8 && z < WX - LAVA_BORDER_WIDTH - 8 &&
    Math.hypot(x - TOWN.TC, z - TOWN.TC) > TOWN.HS + 65 &&
    !isTrainingMeadowLand(x, z, 18);
  const putAir = (x, y, z) => {
    if (!inWorld(x, y, z) || y <= 1 || y >= WH - 2 || !safeColumn(x, z)) return;
    const cur = getBlock(x, y, z);
    if (cur === B.BEDROCK || cur === B.CHEST || cur === B.FURNACE) return;
    setBlock(x, y, z, B.AIR);
  };
  const carveEllipsoid = (cx, cy, cz, rx, ry, rz, openToSky = false) => {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
          if (!openToSky && y >= terrainHeight(x, z) - 1) continue;
          const dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
          if (dx * dx + dy * dy + dz * dz <= 1) putAir(x, y, z);
        }
  };
  const solidForOre = id => id === B.STONE || id === B.COBBLE || id === B.COAL_ORE || id === B.IRON_ORE || id === B.DIAMOND_ORE;
  const placeOreSeam = (cx, cy, cz, salt) => {
    const ring = Math.min(3, Math.floor(Math.hypot(cx - TOWN.TC, cz - TOWN.TC) / 100));
    const roll = hash2(cx + salt * 17, cz + salt * 31);
    const ore = cy < 10 && (ring >= 2 || roll > .82) ? B.DIAMOND_ORE : cy < 25 && (ring >= 1 || roll > .35) ? B.IRON_ORE : B.COAL_ORE;
    for (let i = 0; i < 7; i++) {
      const ox = Math.round((hash2(cx + salt + i * 19, cz + 7) - .5) * 3);
      const oy = Math.round((hash2(cx + 11, cz + salt + i * 23) - .5) * 3);
      const oz = Math.round((hash2(cx + salt + i * 29, cz + 13) - .5) * 3);
      const x = cx + ox, y = cy + oy, z = cz + oz;
      if (inWorld(x, y, z) && y > 1 && y < terrainHeight(x, z) - 1 && safeColumn(x, z) && solidForOre(getBlock(x, y, z))) setBlock(x, y, z, ore);
    }
  };
  const layFloor = (cx, cy, cz, radius = 1) => {
    const fy = Math.max(1, Math.floor(cy - 2));
    for (let ox = -radius; ox <= radius; ox++) for (let oz = -radius; oz <= radius; oz++) {
      const x = Math.round(cx + ox), z = Math.round(cz + oz);
      if (safeColumn(x, z) && fy < terrainHeight(x, z) - 1) setBlock(x, fy, z, Math.abs(ox) + Math.abs(oz) <= 1 ? B.COBBLE : B.STONE);
    }
  };
  const lightRoute = (cx, cy, cz, salt) => {
    const x = Math.round(cx + (hash2(cx + salt, cz) > .5 ? 2 : -2)), y = Math.max(2, Math.floor(cy - 1)), z = Math.round(cz);
    if (safeColumn(x, z) && getBlock(x, y, z) !== B.CHEST) {
      setBlock(x, y, z, B.COBBLE);
      setBlock(x, y + 1, z, salt % 3 === 0 ? B.LANTERN : B.TORCH);
    }
  };
  const carveTunnel = (a, b, salt) => {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) * 1.2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, wobble = Math.sin((t + salt) * Math.PI * 2) * .7;
      const cx = a.x + dx * t + wobble, cy = a.y + dy * t, cz = a.z + dz * t - wobble * .35;
      const r = 1.8 + hash2(Math.round(cx) + salt, Math.round(cz) - salt) * .8;
      carveEllipsoid(cx, cy, cz, r, 1.75, r);
      if (i % 5 === 0) layFloor(cx, cy, cz, 1);
      if (i > 0 && i % 18 === 0) lightRoute(cx, cy, cz, salt + i);
      if (i > 0 && i % 13 === 0) placeOreSeam(Math.round(cx + (hash2(i + salt, salt) > .5 ? r + 1 : -r - 1)), Math.round(cy), Math.round(cz), salt + i);
    }
  };
  for (const net of caveNetworkSpecs()) {
    const entry = net.entrance;
    carveEllipsoid(entry.x, entry.y + 2, entry.z - 2, 3.2, 2.4, 5.5, true);
    layFloor(entry.x, entry.y + 2, entry.z - 2, 2);
    lightRoute(entry.x, entry.y + 3, entry.z - 4, 101);
    for (let i = 1; i < net.points.length; i++) carveTunnel(net.points[i - 1], net.points[i], i * 101 + entry.x);
    for (let i = 0; i < net.caverns.length; i++) {
      const c = net.caverns[i], floorY = Math.max(1, Math.floor(c.y - c.ry));
      carveEllipsoid(c.x, c.y, c.z, c.rx, c.ry, c.rz);
      for (let x = c.x - c.rx + 1; x <= c.x + c.rx - 1; x++)
        for (let z = c.z - c.rz + 1; z <= c.z + c.rz - 1; z++)
          if (((x - c.x) * (x - c.x)) / (c.rx * c.rx) + ((z - c.z) * (z - c.z)) / (c.rz * c.rz) < .75 && safeColumn(x, z)) setBlock(x, floorY, z, hash2(x + i, z - i) > .8 ? B.COBBLE : B.STONE);
      for (const [ox, oz] of [[-c.rx + 1, 0], [c.rx - 1, 0], [0, -c.rz + 1], [0, c.rz - 1]]) {
        const x = c.x + ox, z = c.z + oz;
        setBlock(x, floorY + 1, z, B.LOG); setBlock(x, floorY + 2, z, B.LOG); setBlock(x, floorY + 3, z, B.LANTERN);
      }
      placeOreSeam(c.x - c.rx + 1, c.y, c.z, i * 211 + 3);
      placeOreSeam(c.x + c.rx - 1, c.y - 1, c.z + 1, i * 211 + 7);
      placeOreSeam(c.x, c.y - 1, c.z - c.rz + 1, i * 211 + 11);
    }
  }
  return caveNetworkSpecs();
}
function ancientCitySpecs() {
  return caveNetworkSpecs().map((net, cityIndex) => {
    const end = net.points[net.points.length - 1];
    const prev = net.points[net.points.length - 2] || net.points[0] || end;
    const x = Math.max(LAVA_BORDER_WIDTH + 32, Math.min(WX - LAVA_BORDER_WIDTH - 33, Math.round(end.x + (end.x - prev.x) * .45)));
    const z = Math.max(LAVA_BORDER_WIDTH + 32, Math.min(WX - LAVA_BORDER_WIDTH - 33, Math.round(end.z + (end.z - prev.z) * .45)));
    const y = 10 + Math.floor(hash2(net.entrance.x + 7127, net.entrance.z + 3301) * 9);
    const axis = hash2(x + 4049, z + 2707) > .5 ? 'x' : 'z';
    const vaults = [
      { id: 'vault_a', x: x + (axis === 'x' ? 15 : -10), y, z: z + (axis === 'x' ? -9 : 15), chestKey: 'ancient_city_' + cityIndex + '_vault_a' },
      { id: 'vault_b', x: x + (axis === 'x' ? -15 : 10), y, z: z + (axis === 'x' ? 9 : -15), chestKey: 'ancient_city_' + cityIndex + '_vault_b' },
    ];
    const tablets = [
      { id: 'tablet_origin', x: x - 6, y, z: z - 2, hook: 'ancient_city_origin' },
      { id: 'tablet_core', x: x + 6, y, z: z + 2, hook: 'ancient_core_recall' },
    ];
    return {
      id: 'ancient_city_' + cityIndex,
      type: 'ancient_city',
      name: 'Ancient City',
      caveNetworkId: net.id,
      x, y, z, axis,
      radius: 24,
      entrance: { x: end.x, y: end.y, z: end.z },
      core: { x, y, z, hook: 'ancient_core', bossKind: 'ancient_warden' },
      vaults,
      tablets,
    };
  });
}
function ancientCityLootTable() {
  return [
    { id: 'ancient_fragment', label: 'Ancient Fragment', weight: 22, tier: 'rare', use: 'Ancient crafting and Warden ability unlocks' },
    { id: 'echo_glyph', label: 'Echo Glyph', weight: 10, tier: 'epic', use: 'Glyph-based ability and relic recipes' },
    { id: 'relic_armor_piece', label: 'Relic Armor Piece', weight: 7, tier: 'epic', use: 'Collect pieces toward relic armor sets' },
    { id: 'unique_gear', label: 'Unique dungeon gear', weight: 5, tier: 'epic', use: 'Rolls from the unique weapon and armor pool' },
    { id: 'ancient_core_ability', label: 'Rare ability: Echo Step', weight: 1, tier: 'mythic', requires: 'ancient_warden' },
  ];
}
function ancientCityDiscoverySpecs() {
  const out = [];
  for (const city of ancientCitySpecs()) {
    out.push({ id: city.id, type: 'ancient_city', name: 'Ancient City', x: city.x, y: city.y, z: city.z, radius: city.radius, cityId: city.id });
    for (const tablet of city.tablets) out.push({
      id: city.id + '_' + tablet.id,
      type: 'ancient_tablet',
      name: tablet.id === 'tablet_core' ? 'Ancient Core Tablet' : 'Ancient Lore Tablet',
      x: tablet.x, y: tablet.y, z: tablet.z, radius: 4, cityId: city.id, hook: tablet.hook,
    });
    for (const vault of city.vaults) out.push({
      id: vault.chestKey,
      type: 'ancient_vault',
      name: 'Ancient Vault',
      x: vault.x, y: vault.y + 1, z: vault.z, radius: 4, cityId: city.id,
    });
    out.push({
      id: city.id + '_core',
      type: 'ancient_core',
      name: 'Ancient Core',
      x: city.core.x, y: city.core.y + 1, z: city.core.z, radius: 5, cityId: city.id, hook: city.core.hook, bossKind: city.core.bossKind,
    });
  }
  return out;
}
function buildAncientCities(setBlock, getBlock = getB) {
  const box = (x1, y1, z1, x2, y2, z2, id) => {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
        for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) if (inWorld(x, y, z)) setBlock(x, y, z, id);
  };
  const room = (cx, cy, cz, rx, rz, salt) => {
    for (let x = cx - rx; x <= cx + rx; x++) for (let z = cz - rz; z <= cz + rz; z++) {
      for (let y = cy - 1; y <= cy + 5; y++) {
        const wall = x === cx - rx || x === cx + rx || z === cz - rz || z === cz + rz || y === cy - 1 || y === cy + 5;
        if (wall) {
          const cracked = hash2(x + salt * 17 + y, z - salt * 23) > .82;
          setBlock(x, y, z, y === cy - 1 ? (cracked ? B.COBBLE : B.BRICK) : (cracked ? B.COBBLE : B.BRICK));
        } else setBlock(x, y, z, B.AIR);
      }
    }
  };
  const hall = (x1, y, z1, x2, z2, salt) => {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(z2 - z1), 1);
    for (let i = 0; i <= steps; i++) {
      const cx = Math.round(x1 + (x2 - x1) * i / steps), cz = Math.round(z1 + (z2 - z1) * i / steps);
      for (let ox = -2; ox <= 2; ox++) for (let oz = -2; oz <= 2; oz++) {
        const side = Math.abs(ox) === 2 || Math.abs(oz) === 2;
        const x = cx + ox, z = cz + oz;
        setBlock(x, y - 1, z, side ? B.BRICK : (hash2(x + salt, z - salt) > .75 ? B.COBBLE : B.BRICK));
        for (let h = 0; h <= 4; h++) setBlock(x, y + h, z, side && h > 0 && hash2(x + h * 31 + salt, z - h * 17) > .28 ? B.BRICK : B.AIR);
      }
      if (i > 0 && i % 10 === 0) {
        setBlock(cx + 2, y, cz, B.COBBLE); setBlock(cx + 2, y + 1, cz, B.LANTERN);
        setBlock(cx - 2, y, cz, B.COBBLE); setBlock(cx - 2, y + 1, cz, B.TORCH);
      }
    }
  };
  const tablet = t => {
    setBlock(t.x, t.y - 1, t.z, B.BRICK);
    setBlock(t.x, t.y, t.z, B.BRICK);
    setBlock(t.x, t.y + 1, t.z, B.BRICK);
    setBlock(t.x, t.y + 2, t.z, B.LANTERN);
    for (const [ox, oz] of [[1, 0], [-1, 0]]) setBlock(t.x + ox, t.y - 1, t.z + oz, B.COBBLE);
  };
  for (const city of ancientCitySpecs()) {
    const { x, y, z } = city;
    hall(city.entrance.x, city.entrance.y, city.entrance.z, x, z, x + z);
    room(x, y, z, 9, 9, 300 + x);
    for (const v of city.vaults) {
      hall(x, y, z, v.x, v.z, v.x + v.z);
      room(v.x, v.y, v.z, 6, 5, 700 + v.x);
      box(v.x - 2, v.y, v.z - 2, v.x + 2, v.y + 2, v.z + 2, B.AIR);
      setBlock(v.x, v.y, v.z, B.BRICK);
      setBlock(v.x, v.y + 1, v.z, B.CHEST);
      setBlock(v.x - 3, v.y + 1, v.z - 3, B.LANTERN);
      setBlock(v.x + 3, v.y + 1, v.z + 3, B.LANTERN);
    }
    room(x, y - 1, z, 7, 7, 1100 + x);
    for (const [ox, oz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
      box(x + ox, y - 1, z + oz, x + ox, y + 3, z + oz, B.BRICK);
      setBlock(x + ox, y + 4, z + oz, B.LANTERN);
    }
    setBlock(x, y - 1, z, B.DIAMOND_ORE);
    setBlock(x, y, z, B.GLASS);
    setBlock(x, y + 1, z, B.LANTERN);
    setBlock(x, y + 2, z, B.DIAMOND_ORE);
    for (const t of city.tablets) tablet(t);
    for (const [ox, oz] of [[0, -8], [8, 0], [0, 8], [-8, 0]]) {
      setBlock(x + ox, y, z + oz, B.BRICK);
      setBlock(x + ox, y + 1, z + oz, B.TORCH);
    }
  }
  return ancientCitySpecs();
}
function buildRegionalLandmarks(setBlock) {
  const specs = regionalLandmarkSpecs();
  const box = (x1,y1,z1,x2,y2,z2,id) => { for(let x=x1;x<=x2;x++) for(let y=y1;y<=y2;y++) for(let z=z1;z<=z2;z++) setBlock(x,y,z,id); };
  const prep = (s,r,floor=B.COBBLE) => {
    for(let x=s.x-r;x<=s.x+r;x++) for(let z=s.z-r;z<=s.z+r;z++) {
      for(let y=Math.max(1,s.y-3);y<s.y;y++) setBlock(x,y,z,B.DIRT);
      setBlock(x,s.y,z,floor);
      for(let y=s.y+1;y<=Math.min(WH-1,s.y+20);y++) setBlock(x,y,z,B.AIR);
    }
  };
  for(const s of specs){ const x=s.x,y=s.y,z=s.z;
    if(s.type==='ruins'){
      prep(s,5); for(let i=-4;i<=4;i++){ if(i!==1) setBlock(x+i,y+1,z-4,B.BRICK); if(i!==-2)setBlock(x-4,y+1,z+i,B.COBBLE); }
      for(const [ox,oz,h] of [[-4,-4,4],[4,-4,3],[-4,4,2],[4,4,4]]) for(let k=1;k<=h;k++) setBlock(x+ox,y+k,z+oz,k===h?B.COBBLE:B.BRICK);
      setBlock(x,y+1,z,B.LANTERN);
    } else if(s.type==='shrine'){
      prep(s,4,B.BRICK); for(const [ox,oz] of [[-3,-3],[3,-3],[-3,3],[3,3]]) for(let k=1;k<=4;k++) setBlock(x+ox,y+k,z+oz,B.LOG);
      box(x-3,y+4,z-3,x+3,y+4,z+3,B.PLANKS); box(x-1,y+1,z-1,x+1,y+1,z+1,B.COBBLE); setBlock(x,y+2,z,B.LANTERN);
    } else if(s.type==='hunter_camp'){
      prep(s,5,B.GRASS); setBlock(x,y+1,z,B.CAMPFIRE); for(const ox of [-3,3]){ box(x+ox-1,y+1,z-2,x+ox+1,y+1,z+2,B.PLANKS); box(x+ox,y+2,z-1,x+ox,y+3,z+1,B.LOG); }
      for(const [ox,oz] of [[-4,-4],[4,-4],[-4,4],[4,4]]){ setBlock(x+ox,y+1,z+oz,B.LOG); setBlock(x+ox,y+2,z+oz,B.TORCH); }
      setBlock(x,y+1,z+3,B.CHEST);
    } else if(s.type==='bandit_camp'){
      prep(s,4,B.DIRT); setBlock(x,y+1,z,B.CAMPFIRE); setBlock(x,y+1,z+2,B.CHEST);
      for(const ox of [-3,3]){ setBlock(x+ox,y+1,z-2,B.LOG); setBlock(x+ox,y+2,z-2,B.LOG); setBlock(x+ox,y+3,z-2,B.TERRACOTTA); }
      for(const [ox,oz] of [[-4,-3],[4,-3]]){ setBlock(x+ox,y+1,z+oz,B.LOG); setBlock(x+ox,y+2,z+oz,B.TORCH); }
      for(let h=1;h<=5;h++) setBlock(x-5,y+h,z+3,B.LOG);
      setBlock(x-4,y+4,z+3,B.TERRACOTTA); setBlock(x-4,y+5,z+3,B.TERRACOTTA);
      for(const [ox,oz] of [[-5,-5],[5,-5],[-5,5],[5,5]]){ setBlock(x+ox,y+1,z+oz,B.COBBLE); setBlock(x+ox,y+2,z+oz,B.LOG); }
    } else if(s.type==='graveyard'){
      prep(s,5,B.GRASS); for(let gx=-3;gx<=3;gx+=3) for(let gz=-3;gz<=3;gz+=3){ setBlock(x+gx,y+1,z+gz,B.COBBLE); setBlock(x+gx,y+2,z+gz,B.BRICK); }
      for(let i=-5;i<=5;i++){ setBlock(x+i,y+1,z-5,B.LOG); setBlock(x+i,y+1,z+5,B.LOG); setBlock(x-5,y+1,z+i,B.LOG); setBlock(x+5,y+1,z+i,B.LOG); } setBlock(x,y+1,z,B.LANTERN);
    } else if(s.type==='abandoned_tower'){
      prep(s,8,B.COBBLE); for(let k=1;k<=12;k++) for(let ox=-5;ox<=5;ox++) for(let oz=-5;oz<=5;oz++) if(Math.abs(ox)===5||Math.abs(oz)===5){ if(!(oz===5&&Math.abs(ox)<=1&&k<=3) && hash2(x+ox+k,z+oz-k)>.08) setBlock(x+ox,y+k,z+oz,k%3?B.COBBLE:B.BRICK); }
      box(x-6,y+12,z-6,x+6,y+12,z+6,B.PLANKS); for(const [ox,oz] of [[-6,-6],[6,-6],[-6,6],[6,6]]) setBlock(x+ox,y+13,z+oz,B.LANTERN);
    } else if(s.type==='cave'){
      prep(s,7,B.STONE); for(let dz=-6;dz<=8;dz++){ const fy=y-Math.floor((dz+6)/4); for(let ox=-2;ox<=2;ox++) for(let oy=1;oy<=4;oy++) setBlock(x+ox,fy+oy,z+dz,B.AIR); for(let ox=-2;ox<=2;ox++) setBlock(x+ox,fy,z+dz,B.COBBLE); }
      for(let ox=-5;ox<=5;ox++) for(let oz=7;oz<=15;oz++) for(let oy=-4;oy<=3;oy++) if((ox*ox)/25+(oz-11)*(oz-11)/20+(oy*oy)/16<1) setBlock(x+ox,y-3+oy,z+oz,B.AIR);
      for(const ox of [-3,3]) for(let k=1;k<=5;k++) setBlock(x+ox,y+k,z-6,B.COBBLE); box(x-3,y+5,z-6,x+3,y+5,z-6,B.BRICK); setBlock(x,y+3,z-5,B.TORCH);
    } else if(s.type==='giant_tree'){
      prep(s,8,B.GRASS); box(x-2,y+1,z-2,x+2,y+15,z+2,B.LOG); for(let dy=11;dy<=20;dy++) for(let ox=-7;ox<=7;ox++) for(let oz=-7;oz<=7;oz++) if(Math.abs(ox)+Math.abs(oz)+Math.abs(dy-16)*1.4<11) setBlock(x+ox,y+dy,z+oz,B.LEAVES);
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) for(let k=0;k<7;k++) setBlock(x+dx*(3+k),y+1+Math.floor(k/3),z+dz*(3+k),B.LOG); setBlock(x,y+2,z-3,B.LANTERN);
    } else if(s.type==='crashed_airship'){
      prep(s,9,B.GRASS); for(let i=-8;i<=8;i++){ const yy=y+2+Math.floor((i+8)/7); box(x+i,yy,z-2,x+i,yy+2,z+2,B.PLANKS); if(i%3===0){ setBlock(x+i,yy-1,z-3,B.LOG); setBlock(x+i,yy-1,z+3,B.LOG); } }
      box(x-6,y+1,z,x+8,y+1,z,B.LOG); for(let i=-6;i<=5;i+=3){ box(x+i,y+6,z-4,x+i+2,y+8,z-1,B.TERRACOTTA); box(x+i,y+5,z+2,x+i+2,y+7,z+4,B.TERRACOTTA); } setBlock(x+7,y+5,z,B.LANTERN);
    }
  }
  return specs;
}

function fillBox(xa, ya, za, xb, yb, zb, id) {
  for (let x = Math.min(xa, xb); x <= Math.max(xa, xb); x++)
    for (let y = Math.min(ya, yb); y <= Math.max(ya, yb); y++)
      for (let z = Math.min(za, zb); z <= Math.max(za, zb); z++) setB(x, y, z, id);
}

function buildSkyportBlocks(setBlock) {
  const cx = dtx(32, 'skyport'), cz = dtz(64, 'skyport'), r = 7, top = TOWN.G + 24;
  const rampOpening = new Set();
  // Four broad switchback ramps rise six blocks apiece. Each run reverses at a
  // full-width landing, and the six-block separation leaves generous headroom.
  for (let run = 0; run < 4; run++) {
    const baseY = TOWN.G + run * 6;
    const forward = run % 2 === 0;
    const laneX = cx + (run % 2 === 0 ? -4 : 4);
    for (let step = 0; step <= 12; step++) {
      const z = cz + (forward ? -6 + step : 6 - step);
      const y = baseY + Math.floor(step / 2);
      for (let x = laneX - 1; x <= laneX + 1; x++) setBlock(x, y, z, B.PLANKS);
      // Rails track the slope on both sides without narrowing the three-block ramp.
      // Keep both ends open so the rails cannot wall off a cross-landing.
      if (step > 0 && step < 12) {
        setBlock(laneX - 2, y + 1, z, B.LOG);
        setBlock(laneX + 2, y + 1, z, B.LOG);
      }
      // Remove the deck ceiling above the complete final approach. The wider
      // opening accounts for the player's collision box while jumping.
      if (run === 3 && step < 12)
        for (let x = laneX - 2; x <= laneX + 2; x++) rampOpening.add(`${x},${z}`);
    }
    // A broad landing crosses the tower and connects to the next ramp lane.
    const landingZ = cz + (forward ? 6 : -6);
    for (let x = cx - 5; x <= cx + 5; x++) setBlock(x, baseY + 6, landingZ, B.PLANKS);
    for (let x = cx - 5; x <= cx + 5; x++)
      setBlock(x, baseY + 7, landingZ + (forward ? 1 : -1), B.LOG);
  }
  for (const [ox, oz] of [[-7, -7], [7, -7], [-7, 7], [7, 7]])
    for (let y = TOWN.G + 1; y < top; y++) setBlock(cx + ox, y, cz + oz, B.LOG);
  for (let x = cx - r; x <= cx + r; x++) for (let z = cz - r; z <= cz + r; z++) {
    if (!rampOpening.has(`${x},${z}`)) setBlock(x, top, z, B.PLANKS);
  }
  for (let x = cx - r; x <= cx + r; x++) for (const z of [cz - r, cz + r]) {
    if (!(z === cz - r && x >= cx + r - 2)) setBlock(x, top + 1, z, B.LOG);
  }
  for (let z = cz - r + 1; z < cz + r; z++) for (const x of [cx - r, cx + r]) {
    if (!(x === cx - r && Math.abs(z - cz) <= 2)) setBlock(x, top + 1, z, B.LOG);
  }
  for (const [ox, oz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) setBlock(cx + ox, top + 2, cz + oz, B.LANTERN);
  // Solid dock bridge beneath the decorative gangway. The ship itself is
  // visual-only, so an end guard prevents players stepping into empty air.
  for (let x = cx - 14; x <= cx - r; x++) for (let z = cz - 1; z <= cz + 1; z++)
    setBlock(x, top, z, B.PLANKS);
  for (let x = cx - 14; x <= cx - r; x++) for (const z of [cz - 2, cz + 2])
    setBlock(x, top + 1, z, B.LOG);
  // Locked boarding gate: the airship is a destination interaction, not
  // walkable geometry. This prevents jumping into its visual-only hull.
  for (let z = cz - 1; z <= cz + 1; z++) setBlock(cx - 14, top + 1, z, B.LOG);
  for (let z = cz - 2; z <= cz + 2; z++) setBlock(cx - 15, top + 1, z, B.LOG);
  for (let x = cx - 3; x <= TOWN.TC; x++) setBlock(x, TOWN.G, cz - 6, B.COBBLE);
}

function generate() {
  // --- terrain (biome math identical to the client; cave ore seams are authored later) ---
  for (let x = 0; x < WX; x++) for (let z = 0; z < WX; z++) {
    const biome = biomeAt(x, z), h = terrainHeight(x, z);
    for (let y = 0; y <= h; y++) {
      let id;
      if (y === 0) id = B.BEDROCK;
      else if (y < h - 3) id = B.STONE;
      else if (y < h) id = (biome === BIO.DESERT) ? B.SAND : (biome === BIO.MESA) ? B.TERRACOTTA : B.DIRT;
      else {
        if (h > SNOWLINE) id = B.SNOW;
        else if (biome === BIO.DESERT) id = B.SAND;
        else if (biome === BIO.MESA) id = B.RED_SAND;
        else if (biome === BIO.SNOWY) id = B.SNOW;
        else id = (h <= SEA + 1) ? B.SAND : B.GRASS;
      }
      setB(x, y, z, id);
    }
    for (let y = h + 1; y <= SEA; y++) setB(x, y, z, (biome === BIO.SNOWY && y === SEA) ? B.ICE : B.WATER);
  }
  // --- vegetation: biome-varied trees + desert cactus (same hashes as the client) ---
  for (let x = 3; x < WX - 3; x++) for (let z = 3; z < WX - 3; z++) {
    const biome = biomeAt(x, z);
    const treeThresh = biome === BIO.FOREST ? 0.978 : (biome === BIO.PLAINS || biome === BIO.SWAMP) ? 0.992 : (biome === BIO.SNOWY ? 0.987 : 1.1);
    if (hash2(x * 5 + 1, z * 5 + 7) > treeThresh) {
      let y = WH - 1; while (y > 0 && getB(x, y, z) === B.AIR) y--;
      const t0 = getB(x, y, z);
      if (t0 !== B.GRASS && t0 !== B.SNOW) continue;
      const th = 4 + Math.floor(hash2(x, z) * 2);
      for (let i = 1; i <= th; i++) setB(x, y + i, z, B.LOG);
      const top = y + th;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        const dist = Math.abs(dx) + Math.abs(dz) + Math.abs(dy) * 1.5;
        if (dist > 3.4) continue;
        const bx = x + dx, by = top + dy + 1, bz = z + dz;
        if (getB(bx, by, bz) === B.AIR && hash2(bx * 3 + by, bz * 3 - by) > 0.08) setB(bx, by, bz, B.LEAVES);
      }
    } else if (biome === BIO.DESERT && hash2(x * 7 + 3, z * 7 + 9) > 0.978) {
      let y = WH - 1; while (y > 0 && getB(x, y, z) === B.AIR) y--;
      if (getB(x, y, z) === B.SAND) { const ch = 2 + Math.floor(hash2(x * 3, z * 3) * 2); for (let i = 1; i <= ch; i++) setB(x, y + i, z, B.CACTUS); }
    }
  }
  buildRoadNetwork(setB);
  buildSmallDiscoveries(setB);
  buildRegionalLandmarks(setB);
  buildCaveNetworks(setB, getB);
  buildAncientCities(setB, getB);
  buildTreasureCaches(setB);
  buildLavaBorder();
  buildTown();
}
function isLavaBorderLand(x, z) {
  return x < LAVA_BORDER_WIDTH || z < LAVA_BORDER_WIDTH || x >= WX - LAVA_BORDER_WIDTH || z >= WX - LAVA_BORDER_WIDTH;
}
function buildLavaBorder() {
  for (let x = 0; x < WX; x++) for (let z = 0; z < WX; z++) {
    if (!isLavaBorderLand(x, z)) continue;
    setB(x, 0, z, B.BEDROCK);
    for (let y = 1; y <= SEA; y++) setB(x, y, z, B.LAVA);                  // lava sea (ocean floor)
    for (let y = SEA + 1; y <= LAVA_BORDER_TOP; y++) setB(x, y, z, B.AIR); // open sky above, not a wall
  }
}

function buildGuildHallBase(setBlock = setB) {
  const G = TOWN.G, gx = v => dtx(v, 'guild'), gz = v => dtz(v, 'guild');
  const x1 = gx(25), x2 = gx(60), z1 = gz(24), z2 = gz(36), doorX = gx(57);
  const box = (xa, ya, za, xb, yb, zb, id) => {
    for (let x = xa; x <= xb; x++) for (let y = ya; y <= yb; y++) for (let z = za; z <= zb; z++) setBlock(x, y, z, id);
  };
  box(x1, G, z1, x2, G, z2, B.BRICK);
  box(x1 + 1, G, z1 + 1, x2 - 1, G, z2 - 1, B.PLANKS);
  for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) {
    if (x !== x1 && x !== x2 && z !== z1 && z !== z2) continue;
    const pillar = ((x === x1 || x === x2) && (z === z1 || z === z2)) || ((x - x1) % 6 === 0 && (z === z1 || z === z2));
    for (let y = G + 1; y <= G + 5; y++) setBlock(x, y, z, pillar ? B.LOG : B.BRICK);
  }
  for (let x = x1 + 3; x <= x2 - 3; x += 5) { setBlock(x, G + 3, z1, B.GLASS); setBlock(x, G + 3, z2, B.GLASS); }
  box(doorX - 1, G + 1, z2, doorX + 1, G + 3, z2, B.AIR);
  for (let z = gz(29); z <= gz(35); z++) for (let x = gx(54); x <= gx(59); x++) setBlock(x, G, z, (x === gx(54) || x === gx(59)) ? B.BRICK : B.COBBLE);
  box(gx(48), G, gz(25), gx(59), G, gz(28), B.BRICK);
  box(gx(48), G + 1, gz(28), gx(59), G + 1, gz(28), B.PLANKS);
  box(gx(48), G + 1, gz(26), gx(48), G + 1, gz(28), B.PLANKS);
  setBlock(gx(48), G + 1, gz(28), B.LOG); setBlock(gx(59), G + 1, gz(28), B.LOG);
  for (const z of [gz(29), gz(33)]) {
    box(gx(34), G + 1, z, gx(43), G + 1, z, B.PLANKS);
    setBlock(gx(34), G + 1, z, B.LOG); setBlock(gx(43), G + 1, z, B.LOG);
  }
  for (const [x, z] of [[gx(32), gz(27)], [gx(32), gz(34)], [gx(51), gz(26)]]) {
    box(x, G + 1, z, x, G + 3, z, B.LOG); setBlock(x, G + 4, z, B.TORCH);
  }
  box(x1, G + 6, z1, x2, G + 6, z2, B.PLANKS);
  for (let z = z2 + 1; z <= TOWN.TC - 12; z++) for (let x = doorX - 1; x <= doorX + 1; x++) setBlock(x, G, z, B.COBBLE);
  for (let x = doorX; x <= TOWN.TC; x++) for (let z = TOWN.TC - 14; z <= TOWN.TC - 12; z++) setBlock(x, G, z, B.COBBLE);
  setBlock(doorX - 2, G + 1, z2 + 1, B.TORCH); setBlock(doorX + 2, G + 1, z2 + 1, B.TORCH);
}

function buildTown() {
  const { TC, HS, G } = TOWN;
  const x1 = TC - HS, x2 = TC + HS, z1 = TC - HS, z2 = TC + HS;
  // flatten
  for (let x = x1 - 2; x <= x2 + 2; x++) for (let z = z1 - 2; z <= z2 + 2; z++) {
    for (let y = G + 1; y < WH; y++) setB(x, y, z, B.AIR);
    for (let y = 1; y < G; y++) {
      const cur = getB(x, y, z);
      if (cur === B.AIR || cur === B.WATER) setB(x, y, z, y < G - 3 ? B.STONE : B.DIRT);
    }
    const inside = x >= x1 && x <= x2 && z >= z1 && z <= z2;
    setB(x, G, z, inside ? B.CONCRETE : B.GRASS);
  }
  // walls with gates (mobs must respect these when chasing into town)
  for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) {
    const ex = Math.max(Math.abs(x - TC), Math.abs(z - TC));
    if (ex < HS - 1) continue;
    const onXWall = Math.abs(x - TC) >= HS - 1;
    const onZWall = Math.abs(z - TC) >= HS - 1;
    const gateO = (onXWall && Math.abs(z - TC) <= 1 && !onZWall) || (onZWall && Math.abs(x - TC) <= 1 && !onXWall);
    for (let y = G + 1; y <= G + 5; y++) setB(x, y, z, gateO && y <= G + 4 ? B.AIR : B.BRICK);
  }
  // Deterministic cleared approaches prevent generated hills, vegetation,
  // snow, or water from blocking the four functional town gates.
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let i = HS - 2; i <= HS + 20; i++) for (let w = -1; w <= 1; w++) {
      const x = TC + dx * i + (dz !== 0 ? w : 0);
      const z = TC + dz * i + (dx !== 0 ? w : 0);
      setB(x, G, z, B.COBBLE);
      for (let y = G + 1; y <= G + 4; y++) setB(x, y, z, B.AIR);
    }
  }
  // corner towers
  for (const [cx, cz] of [[x1, z1], [x1, z2], [x2, z1], [x2, z2]])
    fillBox(cx - 2, G + 1, cz - 2, cx + 2, G + 7, cz + 2, B.BRICK);
  // Central court fountain base. Keep collision broad and flat so the plaza reads
  // cleanly; the client renders the water as a non-blocking visual.
  for (let x = TC - 8; x <= TC + 8; x++) for (let z = TC - 8; z <= TC + 8; z++) {
    const d = Math.hypot(x - TC, z - TC);
    if (d > 7.4) continue;
    for (let y = G + 1; y <= G + 6; y++) setB(x, y, z, B.AIR);
    setB(x, G, z, d > 6.3 ? B.COBBLE : d > 4.6 ? B.BRICK : d > 2.2 ? B.COBBLE : B.CONCRETE);
  }
  for (const [ox, oz] of [[-5, 0], [5, 0], [0, -5], [0, 5]]) setB(TC + ox, G + 1, TC + oz, B.LANTERN);
  // Open district footprints replacing the old NPC cottages. These are
  // ground-level only so server collision agrees with the cleaned client town.
  const paveDistrict = (xa, za, xb, zb, fill = B.COBBLE, edge = B.BRICK) => {
    for (let x = xa; x <= xb; x++) for (let z = za; z <= zb; z++) {
      const border = x === xa || x === xb || z === za || z === zb;
      setB(x, G, z, border ? edge : fill);
    }
  };
  paveDistrict(dtx(40, 'tavern'), dtz(70, 'tavern'), dtx(61, 'tavern'), dtz(89, 'tavern'), B.COBBLE, B.BRICK);
  paveDistrict(dtx(68, 'forge'), dtz(37, 'forge'), dtx(89, 'forge'), dtz(44, 'forge'), B.COBBLE, B.BRICK);
  paveDistrict(dtx(26, 'skyport'), dtz(56, 'skyport'), dtx(38, 'skyport'), dtz(72, 'skyport'), B.CONCRETE, B.BRICK);
  for (let x = tc(38); x <= tc(83); x++) for (let w = -1; w <= 1; w++) {
    setB(x, G, tc(64) + w, B.COBBLE);
    setB(x, G, tc(60) + w, B.COBBLE);
  }
  for (let z = tc(42); z <= tc(94); z++) for (let w = -1; w <= 1; w++) {
    setB(tc(64) + w, G, z, B.COBBLE);
    setB(tc(40) + w, G, z, B.COBBLE);
  }
  // buildings as solid collision footprints (visual detail lives on the client)
  // The tavern is a hollow shell with a west door instead of a solid block, so the
  // server's collision matches the client's walkable interior and players can enter.
  {
    const vx1 = dtx(71, 'tavern'), vx2 = dtx(87, 'tavern'), vz1 = dtz(69, 'tavern'), vz2 = dtz(94, 'tavern');
    for (let x = vx1; x <= vx2; x++) for (let z = vz1; z <= vz2; z++) {
      if (x === vx1 || x === vx2 || z === vz1 || z === vz2) fillBox(x, G + 1, z, x, G + 4, z, B.PLANKS);
    }
    const vdz = dtz(76, 'tavern');
    // Clear the full collision column: standHeight() scans from above, so a solid
    // lintel here makes the server snap players onto the doorway instead of in.
    fillBox(vx1, G + 1, vdz - 1, vx1, G + 4, vdz, B.AIR);
  }
  fillBox(dtx(74, 'forge'), G + 1, dtz(45, 'forge'), dtx(83, 'forge'), G + 4, dtz(54, 'forge'), B.COBBLE); // smithy
  fillBox(dtx(42, 'shrine'), G + 1, dtz(40, 'shrine'), dtx(52, 'shrine'), G + 5, dtz(56, 'shrine'), B.BRICK); // meditation hall
  // Dragon roost: a big open pen for bonded dragons (paved yard + low fence, nothing inside).
  {
    const rx1 = dtx(88, 'roost'), rz1 = dtz(48, 'roost'), rx2 = dtx(105, 'roost'), rz2 = dtz(82, 'roost');
    for (let x = rx1; x <= rx2; x++) for (let z = rz1; z <= rz2; z++) {
      const border = x === rx1 || x === rx2 || z === rz1 || z === rz2;
      setB(x, G, z, border ? B.BRICK : B.COBBLE);
      if (border && !(x === rx1 && z >= dtz(64, 'roost') && z <= dtz(66, 'roost'))) { setB(x, G + 1, z, B.LOG); setB(x, G + 2, z, B.LOG); }
    }
  }
  buildGuildHallBase(setB);
  buildSkyportBlocks(setB);
  buildTownFarmWorksite(setB, G);
  // Reopen gate approaches after every district has been generated. Without
  // this final pass, the dragon pen can overwrite the east gate corridor.
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let i = HS - 2; i <= HS + 20; i++) for (let w = -1; w <= 1; w++) {
      const x = TC + dx * i + (dz !== 0 ? w : 0);
      const z = TC + dz * i + (dx !== 0 ? w : 0);
      setB(x, G, z, B.COBBLE);
      for (let y = G + 1; y <= G + 4; y++) setB(x, y, z, B.AIR);
    }
  }
}

// y the feet should stand at, or -1 (used by mob AI and gate placement)
function standHeight(x, z, fromY) {
  const bx = Math.floor(x), bz = Math.floor(z);
  if (bx < 0 || bx >= WX || bz < 0 || bz >= WX) return -1;
  for (let y = Math.min(WH - 2, Math.floor(fromY) + 1); y >= 1; y--)
    if (isSolid(getB(bx, y, bz))) return y + 1;
  return -1;
}

function createWorld() {
  const grid = new DimensionGrid({ kind: 'overworld', id: 'global', width: WX, height: WH, depth: WX, empty: B.AIR, outside: B.AIR });
  const buf = grid.data;
  const getLocal = (x, y, z) => grid.getB(x, y, z);
  const setLocal = (x, y, z, v) => grid.setB(x, y, z, v);
  const fillLocal = (xa, ya, za, xb, yb, zb, id) => {
    for (let x = Math.min(xa, xb); x <= Math.max(xa, xb); x++)
      for (let y = Math.min(ya, yb); y <= Math.max(ya, yb); y++)
        for (let z = Math.min(za, zb); z <= Math.max(za, zb); z++) setLocal(x, y, z, id);
  };
  const buildTownLocal = () => {
    const { TC, HS, G } = TOWN;
    const x1 = TC - HS, x2 = TC + HS, z1 = TC - HS, z2 = TC + HS;
    const reopenGateApproachesLocal = () => {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (let i = HS - 2; i <= HS + 20; i++) for (let w = -1; w <= 1; w++) {
          const x = TC + dx * i + (dz !== 0 ? w : 0);
          const z = TC + dz * i + (dx !== 0 ? w : 0);
          setLocal(x, G, z, B.COBBLE);
          for (let y = G + 1; y <= G + 4; y++) setLocal(x, y, z, B.AIR);
        }
      }
    };
    for (let x = x1 - 2; x <= x2 + 2; x++) for (let z = z1 - 2; z <= z2 + 2; z++) {
      for (let y = G + 1; y < WH; y++) setLocal(x, y, z, B.AIR);
      for (let y = 1; y < G; y++) {
        const cur = getLocal(x, y, z);
    if (cur === B.AIR || cur === B.WATER) setLocal(x, y, z, y < G - 3 ? B.STONE : B.DIRT);
      }
      const inside = x >= x1 && x <= x2 && z >= z1 && z <= z2;
      setLocal(x, G, z, inside ? B.CONCRETE : B.GRASS);
    }
    for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) {
      const ex = Math.max(Math.abs(x - TC), Math.abs(z - TC));
      if (ex < HS - 1) continue;
      const onXWall = Math.abs(x - TC) >= HS - 1;
      const onZWall = Math.abs(z - TC) >= HS - 1;
      const gateO = (onXWall && Math.abs(z - TC) <= 1 && !onZWall) || (onZWall && Math.abs(x - TC) <= 1 && !onXWall);
      for (let y = G + 1; y <= G + 5; y++) setLocal(x, y, z, gateO && y <= G + 4 ? B.AIR : B.BRICK);
    }
    reopenGateApproachesLocal();
    for (const [cx, cz] of [[x1, z1], [x1, z2], [x2, z1], [x2, z2]])
      fillLocal(cx - 2, G + 1, cz - 2, cx + 2, G + 7, cz + 2, B.BRICK);
    for (let x = TC - 4; x <= TC + 4; x++) for (let z = TC - 4; z <= TC + 4; z++) {
      const d = Math.hypot(x - TC, z - TC);
      if (d >= 3 && d < 4) setLocal(x, G + 1, z, B.BRICK);
      else if (d < 3) setLocal(x, G + 1, z, B.WATER);
    }
    const paveDistrict = (xa, za, xb, zb, fill = B.COBBLE, edge = B.BRICK) => {
      for (let x = xa; x <= xb; x++) for (let z = za; z <= zb; z++) {
        const border = x === xa || x === xb || z === za || z === zb;
        setLocal(x, G, z, border ? edge : fill);
      }
    };
    paveDistrict(dtx(40, 'tavern'), dtz(70, 'tavern'), dtx(61, 'tavern'), dtz(89, 'tavern'), B.COBBLE, B.BRICK);
    paveDistrict(dtx(68, 'forge'), dtz(37, 'forge'), dtx(89, 'forge'), dtz(44, 'forge'), B.COBBLE, B.BRICK);
    paveDistrict(dtx(26, 'skyport'), dtz(56, 'skyport'), dtx(38, 'skyport'), dtz(72, 'skyport'), B.CONCRETE, B.BRICK);
    for (let x = tc(38); x <= tc(83); x++) for (let w = -1; w <= 1; w++) {
      setLocal(x, G, tc(64) + w, B.COBBLE);
      setLocal(x, G, tc(60) + w, B.COBBLE);
    }
    for (let z = tc(42); z <= tc(94); z++) for (let w = -1; w <= 1; w++) {
      setLocal(tc(64) + w, G, z, B.COBBLE);
      setLocal(tc(40) + w, G, z, B.COBBLE);
    }
    // Match the client tavern: walkable interior with a west doorway.
    // GameRoom uses createWorld(), so this collision shell must stay in sync
    // with buildTown() above or players get pushed back at the visible door.
    {
      const vx1 = dtx(71, 'tavern'), vx2 = dtx(87, 'tavern'), vz1 = dtz(69, 'tavern'), vz2 = dtz(94, 'tavern');
      for (let x = vx1; x <= vx2; x++) for (let z = vz1; z <= vz2; z++) {
        if (x === vx1 || x === vx2 || z === vz1 || z === vz2) fillLocal(x, G + 1, z, x, G + 4, z, B.PLANKS);
      }
      const vdz = dtz(76, 'tavern');
      // Clear the full collision column: standHeight() scans from above, so a solid
      // lintel here makes the server snap players onto the doorway instead of in.
      fillLocal(vx1, G + 1, vdz - 1, vx1, G + 4, vdz, B.AIR);
    }
    fillLocal(dtx(74, 'forge'), G + 1, dtz(45, 'forge'), dtx(83, 'forge'), G + 4, dtz(54, 'forge'), B.COBBLE);
    fillLocal(dtx(42, 'shrine'), G + 1, dtz(40, 'shrine'), dtx(52, 'shrine'), G + 5, dtz(56, 'shrine'), B.BRICK);
    {
      const rx1 = dtx(88, 'roost'), rz1 = dtz(48, 'roost'), rx2 = dtx(105, 'roost'), rz2 = dtz(82, 'roost');
      for (let x = rx1; x <= rx2; x++) for (let z = rz1; z <= rz2; z++) {
        const border = x === rx1 || x === rx2 || z === rz1 || z === rz2;
        setLocal(x, G, z, border ? B.BRICK : B.COBBLE);
        if (border && !(x === rx1 && z >= dtz(64, 'roost') && z <= dtz(66, 'roost'))) { setLocal(x, G + 1, z, B.LOG); setLocal(x, G + 2, z, B.LOG); }
      }
    }
    buildGuildHallBase(setLocal);
    buildSkyportBlocks(setLocal);
    buildTownFarmWorksite(setLocal, G);
    // Keep createWorld() aligned with the global/client generator. GameRoom uses
    // this local world for movement authority, so the four visible exits must be
    // cleared here as well as in buildTown().
    reopenGateApproachesLocal();
  };
  const generateLocal = () => {
    buf.fill(B.AIR);
    for (let x = 0; x < WX; x++) for (let z = 0; z < WX; z++) {
      const biome = biomeAt(x, z), h = terrainHeight(x, z);
      for (let y = 0; y <= h; y++) {
        let id;
        if (y === 0) id = B.BEDROCK;
        else if (y < h - 3) id = B.STONE;
        else if (y < h) id = (biome === BIO.DESERT) ? B.SAND : (biome === BIO.MESA) ? B.TERRACOTTA : B.DIRT;
        else {
          if (h > SNOWLINE) id = B.SNOW;
          else if (biome === BIO.DESERT) id = B.SAND;
          else if (biome === BIO.MESA) id = B.RED_SAND;
          else if (biome === BIO.SNOWY) id = B.SNOW;
          else id = (h <= SEA + 1) ? B.SAND : B.GRASS;
        }
        setLocal(x, y, z, id);
      }
      for (let y = h + 1; y <= SEA; y++) setLocal(x, y, z, (biome === BIO.SNOWY && y === SEA) ? B.ICE : B.WATER);
    }
    for (let x = 3; x < WX - 3; x++) for (let z = 3; z < WX - 3; z++) {
      const biome = biomeAt(x, z);
      const treeThresh = biome === BIO.FOREST ? 0.978 : (biome === BIO.PLAINS || biome === BIO.SWAMP) ? 0.992 : (biome === BIO.SNOWY ? 0.987 : 1.1);
      if (hash2(x * 5 + 1, z * 5 + 7) > treeThresh) {
        let y = WH - 1; while (y > 0 && getLocal(x, y, z) === B.AIR) y--;
        const t0 = getLocal(x, y, z);
        if (t0 !== B.GRASS && t0 !== B.SNOW) continue;
        const th = 4 + Math.floor(hash2(x, z) * 2);
        for (let i = 1; i <= th; i++) setLocal(x, y + i, z, B.LOG);
        const top = y + th;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
          const dist = Math.abs(dx) + Math.abs(dz) + Math.abs(dy) * 1.5;
          if (dist > 3.4) continue;
          const bx = x + dx, by = top + dy + 1, bz = z + dz;
          if (getLocal(bx, by, bz) === B.AIR && hash2(bx * 3 + by, bz * 3 - by) > 0.08) setLocal(bx, by, bz, B.LEAVES);
        }
      } else if (biome === BIO.DESERT && hash2(x * 7 + 3, z * 7 + 9) > 0.978) {
        let y = WH - 1; while (y > 0 && getLocal(x, y, z) === B.AIR) y--;
        if (getLocal(x, y, z) === B.SAND) {
          const ch = 2 + Math.floor(hash2(x * 3, z * 3) * 2);
          for (let i = 1; i <= ch; i++) setLocal(x, y + i, z, B.CACTUS);
        }
      }
    }
    buildRoadNetwork(setLocal);
    buildSmallDiscoveries(setLocal);
    buildRegionalLandmarks(setLocal);
    buildCaveNetworks(setLocal, getLocal);
    buildAncientCities(setLocal, getLocal);
    buildTreasureCaches(setLocal);
    buildLavaBorderLocal();
    buildTownLocal();
  };
  const isLavaBorderLandLocal = (x, z) => x < LAVA_BORDER_WIDTH || z < LAVA_BORDER_WIDTH || x >= WX - LAVA_BORDER_WIDTH || z >= WX - LAVA_BORDER_WIDTH;
  const buildLavaBorderLocal = () => {
    for (let x = 0; x < WX; x++) for (let z = 0; z < WX; z++) {
      if (!isLavaBorderLandLocal(x, z)) continue;
      setLocal(x, 0, z, B.BEDROCK);
      for (let y = 1; y <= SEA; y++) setLocal(x, y, z, B.LAVA);                  // lava sea (ocean floor)
      for (let y = SEA + 1; y <= LAVA_BORDER_TOP; y++) setLocal(x, y, z, B.AIR); // open sky above, not a wall
    }
  };
  const standHeightLocal = (x, z, fromY) => {
    const bx = Math.floor(x), bz = Math.floor(z);
    if (bx < 0 || bx >= WX || bz < 0 || bz >= WX) return -1;
    for (let y = Math.min(WH - 2, Math.floor(fromY) + 1); y >= 1; y--)
      if (isSolid(getLocal(bx, y, bz))) return y + 1;
    return -1;
  };
  grid.generate = generateLocal;
  grid.standHeight = standHeightLocal;
  grid.isSolid = isSolid;
  return grid;
}

module.exports = {
  WX, WH, TOWN, TOWN_SPACING, TOWN_DISTRICTS, HUB, TRAINING_MEADOW, TRAINING_MEADOW_TOWN_PORTAL, LAVA_BORDER_WIDTH, B, BIO, MAX_BLOCK_ID,
  townPos, townBlockPos,
  generate, getB, setB, idx, inWorld, isSolid, standHeight, terrainHeight, hash2, isLavaBorderLand, createWorld, worldGrid,
  biomeAt, regionalLandmarkSpecs, buildRegionalLandmarks, roadNetworkSpecs, roadBreadcrumbSpecs, buildRoadNetwork,
  SMALL_DISCOVERY_TYPES, smallDiscoverySpecs, buildSmallDiscoveries, treasureCacheSpecs, buildTreasureCaches, caveNetworkSpecs, buildCaveNetworks,
  ancientCitySpecs, ancientCityLootTable, ancientCityDiscoverySpecs, buildAncientCities, isTrainingMeadowLand, trainingMeadowTownPortalPoint, buildTrainingMeadow,
  buildGuildHallBase, isCentralCourtProtectedEdit, isTownFarmWorksite,
};
