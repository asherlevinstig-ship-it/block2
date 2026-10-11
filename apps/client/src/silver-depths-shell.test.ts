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
  });
});
