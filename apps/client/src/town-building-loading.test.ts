import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("authored town building loading", () => {
  it("hides procedural buildings before asynchronous asset loading starts", () => {
    const source = readFileSync(fileURLToPath(new URL("./main.ts", import.meta.url)), "utf8");
    const hide = source.indexOf('hideRapidTownFallback("complete-buildings");');
    const load = source.indexOf("populateTownAssetKit(app, rapidPrototypeRoot");
    const eager = source.indexOf("if (!tavernRoomRequested) requestRapidTownAssets();");
    expect(hide).toBeGreaterThan(0);
    expect(load).toBeGreaterThan(hide);
    expect(eager).toBeGreaterThan(load);
  });
});
