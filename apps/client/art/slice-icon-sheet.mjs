import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const artDirectory = dirname(fileURLToPath(import.meta.url));
const source = join(artDirectory, "icon-sheet-v1.png");
const outputDirectory = join(artDirectory, "..", "public", "icons");
const tileSize = 310;
const columns = [61, 461, 860, 1260];
const rows = [116, 518];
const names = [
  ["basic-sword", "wanderer-robes", "iron-ore", "healing-potion"],
  ["guard", "dodge", "assassin-vanish", "healer-mend"],
];

for (let row = 0; row < rows.length; row += 1) {
  for (let column = 0; column < columns.length; column += 1) {
    await sharp(source)
      .extract({ left: columns[column], top: rows[row], width: tileSize, height: tileSize })
      .resize(128, 128)
      .png()
      .toFile(join(outputDirectory, `${names[row][column]}.png`));
  }
}
