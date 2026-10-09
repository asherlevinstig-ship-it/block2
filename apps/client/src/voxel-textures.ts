import { Block, SURFACE_HEIGHT, TOWN_CENTER_X, TOWN_CENTER_Z, TOWN_SAFE_RADIUS, isInGreenwoodRegion, townOfBeginningsBlock, townTavernBlock, townWallBlock } from "@blockcraft/voxel-world";

export type VoxelTextureKind = "bedrock" | "stone" | "dirt" | "grass-top" | "grass-side" | "iron" | "silver"
  | "forest-grass-top" | "forest-grass-side" | "oak-bark" | "oak-rings" | "leaves"
  | "timber" | "slate-roof" | "paving" | "path" | "dressed-stone" | "bronze";

type Rgb = readonly [number, number, number];

function hashPixel(x: number, y: number, salt: number): number {
  let value = Math.imul(x + 31, 0x45d9f3b) ^ Math.imul(y + 17, 0x119de1f3) ^ salt;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}

function vary(color: Rgb, amount: number): Rgb {
  return [
    Math.max(0, Math.min(255, color[0] + amount)),
    Math.max(0, Math.min(255, color[1] + amount)),
    Math.max(0, Math.min(255, color[2] + amount)),
  ];
}

/** Only authored town blocks get architectural finishes; mining keeps the real block IDs. */
export function voxelTextureKind(block: number, normalY: number, x: number, y: number, z: number): VoxelTextureKind {
  // Skip the authored lookup for wilderness and underground faces.
  const withinTown = x >= TOWN_CENTER_X - TOWN_SAFE_RADIUS - 1 && x <= TOWN_CENTER_X + TOWN_SAFE_RADIUS
    && z >= TOWN_CENTER_Z - TOWN_SAFE_RADIUS - 1 && z <= TOWN_CENTER_Z + TOWN_SAFE_RADIUS
    && y >= SURFACE_HEIGHT && y <= 16;
  if (withinTown && townOfBeginningsBlock(x, y, z) === block) {
    if (townWallBlock(x, y, z) === block) return block === Block.IronOre ? "bronze" : "dressed-stone";
    if (townTavernBlock(x, y, z) === block) {
      if (block === Block.Dirt) return "timber";
      if (block === Block.Stone) return y >= 12 && y <= 14 ? "slate-roof" : "dressed-stone";
    }
    if (block === Block.Dirt) return y > SURFACE_HEIGHT ? "timber" : "path";
    if (block === Block.IronOre) return "bronze";
    if (block === Block.Stone) {
      return y === SURFACE_HEIGHT && normalY > 0 ? "paving" : "dressed-stone";
    }
  }
  if (block === Block.Bedrock) return "bedrock";
  if (block === Block.SilverOre) return "silver";
  if (block === Block.Stone) return "stone";
  if (block === Block.Dirt) return "dirt";
  if (block === Block.OakLog) return normalY === 0 ? "oak-bark" : "oak-rings";
  if (block === Block.Leaves) return "leaves";
  if (block === Block.Grass && isInGreenwoodRegion(x, z)) return normalY > 0 ? "forest-grass-top" : normalY < 0 ? "dirt" : "forest-grass-side";
  if (block === Block.Grass) return normalY > 0 ? "grass-top" : normalY < 0 ? "dirt" : "grass-side";
  return "iron";
}

/** Small world-anchored shifts break repeated tiles without a distracting checkerboard. */
export function voxelTint(x: number, y: number, z: number, kind: VoxelTextureKind): Rgb {
  const broad = (hashPixel(Math.floor(x / 4), Math.floor(z / 4), 71) % 9 - 4) * 0.004;
  const detail = (hashPixel(x, z, y * 97) % 9 - 4) * 0.004;
  const amount = 0.96 + detail + (kind.includes("grass") || kind === "leaves" ? broad : 0);
  return [amount, amount, amount];
}

/** Two touching side blocks fully occlude a corner, even if its diagonal is open. */
export function voxelCornerLight(sideA: boolean, sideB: boolean, diagonal: boolean): number {
  const occlusion = sideA && sideB ? 3 : Number(sideA) + Number(sideB) + Number(diagonal);
  return [1, 0.88, 0.74, 0.62][occlusion]!;
}

function earthPixel(x: number, y: number): Rgb {
  const shelf = y + (Math.floor(x / 8) % 2 === 0 ? 0 : 2);
  const band = Math.floor(shelf / 8) % 4;
  const palette: Rgb[] = [[132, 96, 65], [143, 105, 71], [123, 88, 60], [137, 98, 66]];
  let color = palette[band]!;
  const cluster = hashPixel(Math.floor(x / 3), Math.floor(y / 2), 49);
  if (cluster % 23 === 0) color = [108, 78, 55];
  else if (cluster % 31 === 0) color = [159, 122, 83];
  if (shelf % 8 === 7) color = vary(color, -5);
  return color;
}

function grassPixel(x: number, y: number): Rgb {
  // Broad, irregular islands are legible at game scale and mip cleanly into a calm meadow.
  const px = Math.floor(x / 2) * 2;
  const py = Math.floor(y / 2) * 2;
  const island = ((px - 8) ** 2 / 74 + (py - 7) ** 2 / 36 < 1)
    || ((px - 27) ** 2 / 70 + (py - 25) ** 2 / 43 < 1);
  const deep = (px - 7) ** 2 / 39 + (py - 24) ** 2 / 22 < 1;
  let color: Rgb = island ? [111, 140, 92] : deep ? [104, 133, 86] : [108, 137, 89];
  if ((x === 5 && y >= 5 && y <= 7) || (x === 6 && y === 6) || (x === 23 && y >= 22 && y <= 24)) color = [125, 151, 102];
  if ((x === 19 && y === 11) || (x === 20 && y === 10)) color = [99, 128, 82];
  return color;
}

function forestPixel(x: number, y: number): Rgb {
  const cluster = hashPixel(Math.floor(x / 3), Math.floor(y / 3), 0x33aa77);
  if (cluster % 11 === 0) return [57, 100, 54];
  if (cluster % 7 === 0) return [72, 118, 60];
  return (x + y) % 5 === 0 ? [64, 109, 56] : [68, 113, 58];
}

function oakPixel(kind: "oak-bark" | "oak-rings", x: number, y: number): Rgb {
  if (kind === "oak-rings") {
    const distance = Math.hypot(x - 15.5, y - 15.5);
    return Math.floor(distance / 3) % 2 === 0 ? [156, 111, 59] : [115, 73, 37];
  }
  const groove = (x + Math.floor(y / 5) * 3) % 9;
  if (groove <= 1) return [61, 40, 27];
  if (groove === 2) return [119, 78, 42];
  return vary([91, 58, 34], hashPixel(Math.floor(x / 3), Math.floor(y / 4), 91) % 9 - 4);
}

function leavesPixel(x: number, y: number): Rgb {
  const cluster = hashPixel(Math.floor(x / 4), Math.floor(y / 4), 0x667733);
  if (cluster % 9 === 0) return [112, 145, 64];
  if (cluster % 5 === 0) return [48, 91, 45];
  return [69, 116, 51];
}

function stonePixel(x: number, y: number): Rgb {
  const offset = Math.floor(y / 10) % 2 === 0 ? 0 : 11;
  const seamX = (x + offset) % 24;
  const seamY = (y + Math.floor(x / 13)) % 12;
  let color: Rgb = Math.floor((x + offset) / 12) % 2 === 0 ? [119, 132, 137] : [110, 124, 130];
  if (seamY === 0 || seamX === 0 && seamY < 7) color = [88, 103, 113];
  else if (seamY === 1) color = [139, 150, 151];
  else if (seamY > 8) color = vary(color, -5);
  return color;
}

function architecturalPixel(kind: VoxelTextureKind, x: number, y: number): Rgb | undefined {
  if (kind === "timber") {
    const beam = x < 3 || x > 28;
    if (beam) return x === 2 || x === 29 ? [141, 105, 64] : [85, 65, 46];
    const plank = Math.floor(y / 8);
    if (y % 8 === 0) return [105, 73, 45];
    if (y % 8 === 1) return [190, 151, 98];
    if ((x === 5 || x === 26) && y % 8 === 4) return [78, 69, 59];
    if (y % 8 === 5 && (x + plank * 7) % 23 > 13) return [151, 111, 66];
    return vary([173, 132, 83], plank % 2 === 0 ? 0 : -7);
  }
  if (kind === "slate-roof") {
    const row = Math.floor(y / 8);
    const tileX = (x + (row % 2) * 8) % 16;
    if (y % 8 === 7 || tileX === 0) return [53, 70, 85];
    if (y % 8 === 0) return [115, 136, 149];
    return vary([83, 107, 125], (Math.floor((x + (row % 2) * 8) / 16) + row) % 2 === 0 ? 3 : -4);
  }
  if (kind === "paving" || kind === "dressed-stone") {
    const row = Math.floor(y / 16);
    const tileX = (x + (row % 2) * 12) % 24;
    if (y % 16 === 0 || tileX === 0) return [98, 108, 107];
    if (y % 16 === 1 || tileX === 1) return [175, 179, 161];
    if (y % 16 === 15 || tileX === 23) return [128, 139, 131];
    return vary([154, 161, 145], row % 2 === 0 ? 2 : -4);
  }
  if (kind === "path") {
    const cluster = hashPixel(Math.floor(x / 3), Math.floor(y / 3), 132);
    if (cluster % 17 === 0) return [179, 156, 109];
    if (cluster % 19 === 0) return [133, 115, 78];
    return [158, 137, 92];
  }
  if (kind === "bronze") {
    const edge = x < 3 || y < 3 || x > 28 || y > 28;
    if (edge) return x === 2 || y === 2 ? [244, 201, 115] : [123, 88, 49];
    if (Math.abs(x - 16) + Math.abs(y - 16) < 7) return [250, 218, 146];
    return y < 17 ? [196, 151, 72] : [166, 117, 56];
  }
  return undefined;
}

export function createVoxelTexturePixels(kind: VoxelTextureKind, size = 32): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const x = Math.floor(px * 32 / size);
      const y = Math.floor(py * 32 / size);
      let color = architecturalPixel(kind, x, y);
      if (!color) {
        if (kind === "grass-top") color = grassPixel(x, y);
        else if (kind === "forest-grass-top") color = forestPixel(x, y);
        else if (kind === "oak-bark" || kind === "oak-rings") color = oakPixel(kind, x, y);
        else if (kind === "leaves") color = leavesPixel(x, y);
        else if (kind === "grass-side") {
          const grassDepth = 5 + (hashPixel(Math.floor(x / 4), 0, 19) % 3);
          color = y < grassDepth ? grassPixel(x, y) : earthPixel(x, y);
          if (y === grassDepth) color = [93, 101, 61];
        } else if (kind === "forest-grass-side") {
          const grassDepth = 7 + (hashPixel(Math.floor(x / 4), 0, 29) % 3);
          color = y < grassDepth ? forestPixel(x, y) : earthPixel(x, y);
          if (y === grassDepth) color = [62, 91, 48];
        } else if (kind === "dirt") color = earthPixel(x, y);
        else if (kind === "bedrock") color = vary(stonePixel(x, y), -60);
        else {
          color = stonePixel(x, y);
          if (kind === "iron" || kind === "silver") {
            const seam = Math.abs(x - (10 + Math.floor(y / 5) * 2)) < 3;
            const offshoot = y >= 16 && y <= 20 && x >= 6 && x <= 17;
            if (seam || offshoot) color = kind === "silver"
              ? x % 3 === 0 ? [234, 250, 255] : [145, 205, 225]
              : x % 3 === 0 ? [244, 194, 101] : [183, 121, 59];
          }
        }
      }
      const offset = (py * size + px) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}
