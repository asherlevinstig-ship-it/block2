import { readFileSync, writeFileSync } from "node:fs";

const [, , inputPath, outputPath, ...keptNames] = process.argv;
if (!inputPath || !outputPath || keptNames.length === 0) {
  throw new Error("Usage: node scripts/trim-gltf-animations.mjs input.glb output.glb AnimationName [...]");
}

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const source = readFileSync(inputPath);
if (source.readUInt32LE(0) !== GLB_MAGIC || source.readUInt32LE(4) !== 2) {
  throw new Error(`${inputPath} is not a glTF 2.0 binary file.`);
}

const chunks = [];
let offset = 12;
let document;
while (offset < source.length) {
  const length = source.readUInt32LE(offset);
  const type = source.readUInt32LE(offset + 4);
  const data = source.subarray(offset + 8, offset + 8 + length);
  if (type === JSON_CHUNK) document = JSON.parse(data.toString("utf8").trimEnd());
  else chunks.push({ type, data });
  offset += 8 + length;
}
if (!document) throw new Error(`${inputPath} does not contain a JSON chunk.`);

const keep = new Set(keptNames);
const available = new Set((document.animations ?? []).map(animation => animation.name));
for (const name of keep) {
  if (!available.has(name)) throw new Error(`${inputPath} does not contain animation ${name}.`);
}
document.animations = (document.animations ?? []).filter(animation => keep.has(animation.name));

const json = Buffer.from(JSON.stringify(document), "utf8");
const paddedJsonLength = Math.ceil(json.length / 4) * 4;
const jsonChunk = Buffer.alloc(paddedJsonLength, 0x20);
json.copy(jsonChunk);
const totalLength = 12 + 8 + jsonChunk.length + chunks.reduce((total, chunk) => total + 8 + chunk.data.length, 0);
const target = Buffer.alloc(totalLength);
target.writeUInt32LE(GLB_MAGIC, 0);
target.writeUInt32LE(2, 4);
target.writeUInt32LE(totalLength, 8);
target.writeUInt32LE(jsonChunk.length, 12);
target.writeUInt32LE(JSON_CHUNK, 16);
jsonChunk.copy(target, 20);
offset = 20 + jsonChunk.length;
for (const chunk of chunks) {
  target.writeUInt32LE(chunk.data.length, offset);
  target.writeUInt32LE(chunk.type, offset + 4);
  chunk.data.copy(target, offset + 8);
  offset += 8 + chunk.data.length;
}
writeFileSync(outputPath, target);
console.log(`Kept ${document.animations.length} animations: ${document.animations.map(animation => animation.name).join(", ")}`);
