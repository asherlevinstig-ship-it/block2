import { expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

it("makes equipped armour control the full outfit colour", () => {
  expect(source).toContain("const ARMOUR_OUTFIT_COLORS: Record<ArmourId, pc.Color>");
  expect(source).toContain("rig.appearanceMaterials.coat.diffuse = ARMOUR_OUTFIT_COLORS[armourId]");
  expect(source).toContain('rig.scarf.enabled = armourId === "none"');
  expect(source).toContain('style.enabled = id === "explorer"');
});

it("gives regional armour recognisable silhouette details and icons", () => {
  for (const detail of ["mirebreaker-cowl", "rootstalker-leaf", "fangstalker-sash", "leather-pouch"])
    expect(source).toContain(detail);
  expect(css).toContain('article:is([data-item="leather_armour"]');
  expect(css).toContain("clip-path: polygon");
});
