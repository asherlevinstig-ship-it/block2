import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");

describe("tablet navigation", () => {
  it("provides a universal Back control that shares Escape popup behavior", () => {
    expect(html).toContain('id="tablet-back-button"');
    expect(main).toContain('tabletBackButton.addEventListener("click"');
    expect(main).toContain("closePopupFromEscape(popup)");
  });

  it("does not offer Back for a mandatory choice", () => {
    expect(main).toContain("popup && !requiredPopup(popup.id)");
  });

  it("localizes both initial and dynamically inserted guidance", () => {
    expect(main).toContain("localizeTouchGuidance(document.body)");
    expect(main).toContain("localizeTouchGuidance(record.target)");
    expect(main).toContain("localizeTouchGuidance(node)");
  });
});

