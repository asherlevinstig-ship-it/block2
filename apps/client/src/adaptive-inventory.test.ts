import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

describe("adaptive inventory layout", () => {
  it("uses the inventory panel width rather than input type for layout changes", () => {
    expect(styles).toContain("container: inventory / inline-size");
    expect(styles).toContain("@container inventory (max-width: 940px)");
    expect(styles).toContain("@container inventory (max-width: 700px)");
  });

  it("collapses the comparison and gear layouts before they overflow", () => {
    expect(styles).toContain("#inventory-decision-panel { position: static; order: -1; max-height: none; }");
    expect(styles).toContain('grid-template-areas: "doll" "weapons" "armour"');
    expect(styles).toContain("grid-template-columns: repeat(auto-fit, minmax(126px, 1fr))");
  });

  it("provides full-screen mobile and short-landscape layouts", () => {
    expect(styles).toContain("@media (max-width: 560px)");
    expect(styles).toContain("@media (max-height: 650px) and (min-width: 700px)");
    expect(styles).toContain("inset: 0;");
  });
});
