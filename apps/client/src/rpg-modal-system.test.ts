import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");

describe("shared RPG modal presentation", () => {
  it("frames every important choice and progression popup with the shared asset", () => {
    for (const selector of [
      ".level-up-card",
      ".calling-intro-card",
      ".calling-awakening-card",
      ".ability-reveal-card",
      ".defeat-card",
      ".floor-upgrade-shell",
      ".rapid-reward-shell",
      ".loot-card",
    ]) expect(css).toContain(selector);
    expect(css).toContain("/assets/kenney-fantasy-ui-borders/panel-transparent-border-000.png");
    expect(css).toContain("/assets/kenney-fantasy-ui-borders/divider-fade-000.png");
  });

  it("ships the two CC0 assets referenced by the frame", () => {
    const root = new URL("../public/assets/kenney-fantasy-ui-borders/", import.meta.url);
    expect(existsSync(new URL("panel-transparent-border-000.png", root))).toBe(true);
    expect(existsSync(new URL("divider-fade-000.png", root))).toBe(true);
    expect(existsSync(new URL("LICENSE.txt", root))).toBe(true);
  });

  it("keeps wave rewards in CSS rather than rebuilding their look inline", () => {
    expect(main).toContain('rapidPracticeRewardPanel.dataset.rarity = reward.rare ? "rare" : "standard"');
    expect(main).not.toContain("rapidPracticeRewardChoices.querySelectorAll<HTMLElement>(\"button\").forEach");
  });
});
