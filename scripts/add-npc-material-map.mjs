import { readFileSync, writeFileSync } from "node:fs";

const [, , gltfPath, materialPath] = process.argv;
if (!gltfPath || !materialPath) throw new Error("Usage: node scripts/add-npc-material-map.mjs model.gltf material.png");

const document = JSON.parse(readFileSync(gltfPath, "utf8"));
document.images ??= [];
document.textures ??= [];
const source = document.images.push({
  name: "town_npc_material_response",
  mimeType: "image/png",
  uri: materialPath.replaceAll("\\", "/"),
}) - 1;
const texture = document.textures.push({
  name: "town_npc_material_response",
  source,
  ...(document.samplers?.length ? { sampler: 0 } : {}),
}) - 1;
for (const material of document.materials ?? []) {
  material.pbrMetallicRoughness ??= {};
  material.pbrMetallicRoughness.metallicFactor = 1;
  material.pbrMetallicRoughness.roughnessFactor = 1;
  material.pbrMetallicRoughness.metallicRoughnessTexture = { index: texture };
}
writeFileSync(gltfPath, `${JSON.stringify(document, null, 2)}\n`);
