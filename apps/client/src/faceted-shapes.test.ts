import { expect, it } from "vitest";
import { facetedBoxGeometry } from "./faceted-shapes.js";

it("keeps rig dimensions with outward faces and a bounded triangle budget", () => {
  for (const bevel of [.06, .12, .25]) {
    const { positions: p, normals: n, indices } = facetedBoxGeometry(bevel);
    expect(indices.length / 3).toBe(44);
    expect(Math.min(...p)).toBe(-.5);
    expect(Math.max(...p)).toBe(.5);
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i]! * 3, b = indices[i + 1]! * 3, c = indices[i + 2]! * 3;
      const u = [p[b]! - p[a]!, p[b + 1]! - p[a + 1]!, p[b + 2]! - p[a + 2]!];
      const v = [p[c]! - p[a]!, p[c + 1]! - p[a + 1]!, p[c + 2]! - p[a + 2]!];
      const dot = (u[1]! * v[2]! - u[2]! * v[1]!) * n[a]!
        + (u[2]! * v[0]! - u[0]! * v[2]!) * n[a + 1]!
        + (u[0]! * v[1]! - u[1]! * v[0]!) * n[a + 2]!;
      expect(dot).toBeGreaterThan(0);
    }
  }
});
