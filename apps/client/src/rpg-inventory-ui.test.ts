import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

describe("RPG inventory presentation", () => {
  it("frames the inventory with the shared fantasy artwork", () => {
    expect(styles).toContain("/* RPG inventory presentation pass.");
    expect(styles).toContain("#inventory-panel::after");
    expect(styles).toContain("kenney-fantasy-ui-borders/panel-transparent-border-000.png");
    expect(styles).toContain("kenney-fantasy-ui-borders/divider-fade-000.png");
  });

  it("gives the essential inventory decisions dedicated visual hierarchy", () => {
    expect(styles).toContain(".inventory-tabs button[aria-selected=\"true\"]");
    expect(styles).toContain(".inventory-selection-actions button:first-child");
    expect(styles).toContain("#inventory-decision-panel .inventory-comparison section");
    expect(styles).toContain(".equipment-slot-ring button:is(:hover, :focus-visible)");
  });

  it("retains a tablet and narrow-screen layout", () => {
    expect(styles).toContain("@media (max-width: 820px)");
    expect(styles).toContain("#inventory-decision-panel { position: static; order: -1; }");
    expect(styles).toContain("@media (max-width: 540px)");
  });
});
