import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");

describe("responsive RPG HUD chrome", () => {
  it("uses a shared gold and teal chrome system across the persistent HUD", () => {
    expect(styles).toContain("--rpg-hud-gold-bright: #f4d77d");
    expect(styles).toContain("--rpg-hud-teal: #39e0bd");
    expect(styles).toContain("#fast-world-badge,");
    expect(styles).toContain("#player-hud-root,");
    expect(styles).toContain("#combat-action-bar {");
  });

  it("keeps the location banner semantic and free from brittle inline styling", () => {
    expect(main).toContain("fast-world-badge-emblem");
    expect(main).toContain('aria-hidden=\\"true\\"');
    expect(main).not.toContain("badge.style.cssText");
    expect(main).not.toContain("detail.style.cssText");
  });

  it("has compact and reduced-motion fallbacks", () => {
    expect(styles).toContain("@media (max-width: 760px)");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain("html.fast-world-active #world-objective { display: none; }");
  });

  it("places the final map and utility chrome after legacy fast-world rules", () => {
    expect(styles.lastIndexOf("/* Final HUD cascade")).toBeGreaterThan(styles.lastIndexOf("#fast-world-map .fast-world-nearby-leader span"));
    expect(styles).toContain("#inventory-toggle,");
    expect(styles).toContain("#camera-mode-toggle,");
    expect(styles).toContain("#performance-toggle {");
  });
});
