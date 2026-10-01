export type VoxelTextureKind = "bedrock" | "stone" | "dirt" | "grass-top" | "grass-side" | "iron";

type Rgb = readonly [number, number, number];

const BASE_COLORS: Record<VoxelTextureKind, Rgb> = {
  bedrock: [42, 48, 53],
  stone: [101, 108, 111],
  dirt: [112, 73, 39],
  "grass-top": [67, 139, 55],
  "grass-side": [112, 73, 39],
  iron: [101, 108, 111],
};

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

export function createVoxelTexturePixels(kind: VoxelTextureKind, size = 16): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(size * size * 4);
  const salt = [...kind].reduce((value, character) => value + character.charCodeAt(0), 0);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const hash = hashPixel(x, y, salt);
      const coarseHash = hashPixel(x >> 1, y >> 1, salt ^ 0x9e37);
      let color = vary(BASE_COLORS[kind], ((coarseHash % 5) - 2) * 5 + ((hash % 3) - 1) * 3);

      if (kind === "grass-top") {
        if (hash % 17 === 0) color = [43, 104, 40];
        else if (hash % 19 === 0) color = [103, 164, 67];
      } else if (kind === "grass-side") {
        const grassDepth = 2 + (hashPixel(x, 0, salt) % 3);
        if (y < grassDepth) color = vary([64, 137, 54], ((hash % 5) - 2) * 4);
        else if (hash % 13 === 0) color = [82, 49, 29];
      } else if (kind === "dirt") {
        if (hash % 13 === 0) color = [78, 48, 29];
        else if (hash % 23 === 0) color = [142, 94, 50];
      } else if (kind === "stone") {
        if (hash % 19 === 0) color = [73, 80, 84];
        else if (hash % 29 === 0) color = [132, 138, 137];
      } else if (kind === "bedrock") {
        if (hash % 7 === 0) color = [24, 29, 33];
        else if (hash % 11 === 0) color = [70, 76, 79];
      } else if (kind === "iron") {
        const ore = ((x - 5) ** 2 + (y - 6) ** 2 < 8) || ((x - 11) ** 2 + (y - 10) ** 2 < 7);
        if (ore && hash % 5 !== 0) color = vary([174, 104, 55], ((hash % 5) - 2) * 7);
      }

      const offset = (y * size + x) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}
