import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEPTHS_ROUTE_NODES } from "./silver-depths-map.js";

describe("Silver Depths route shell", () => {
  it("renders exactly the route nodes required by the route model", () => {
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const renderedNodeIds = [...html.matchAll(/data-depths-node="([^"]+)"/g)].map(
      ([, nodeId]) => nodeId,
    );

    expect(renderedNodeIds).toEqual(DEPTHS_ROUTE_NODES.map(({ id }) => id));
    expect([...html.matchAll(/data-depths-wing="([^"]+)"/g)].map(([, wing]) => wing)).toEqual(["iron", "silver"]);
    for (const id of ["depths-wing-rewards", "depths-reward-ore-name", "depths-reward-ore-state", "depths-reward-gear-name", "depths-reward-gear-state", "depths-reward-party"]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain("Bastion Plate + 5 iron");
    expect(html).toContain("Echo Prism + 3 silver");
  });
});
