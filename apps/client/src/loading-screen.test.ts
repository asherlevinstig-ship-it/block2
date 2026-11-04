import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { nextLoadingProgress } from "./loading-screen.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("game loading screen", () => {
  it("never moves real loading progress backwards", () => {
    expect(nextLoadingProgress(58, 42)).toBe(58);
    expect(nextLoadingProgress(58, 81)).toBe(81);
    expect(nextLoadingProgress(81, 140)).toBe(100);
  });

  it("is present in initial HTML before the game module downloads", () => {
    expect(html.indexOf('id="game-loading-screen"')).toBeGreaterThan(0);
    expect(html.indexOf('id="game-loading-screen"')).toBeLessThan(html.indexOf('src="/src/main.ts"'));
    expect(html).toMatch(/id="game-loading-track"[^>]*role="progressbar"/);
    expect(html).toContain('id="game-loading-retry"');
  });
});
