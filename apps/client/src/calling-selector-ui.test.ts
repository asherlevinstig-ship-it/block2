import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

describe("professional Calling selector", () => {
  it("separates previewing a class from confirming it", () => {
    expect(html).toContain('id="calling-intro-confirm"');
    expect(main).toContain('callingIntroConfirm.addEventListener("click"');
    expect(main).toContain("previewedCallingPathId = pathId");
    expect(main).toContain('room.send("build:path", { action: "choose", pathId })');
  });

  it("does not change Calling from pointer movement or repeated state renders", () => {
    expect(main).not.toContain('button.addEventListener("pointerenter", () => focusCallingPreview(button))');
    expect(main).toContain("const wasHidden = callingIntro.hidden");
    expect(main).toContain("if (wasHidden) window.setTimeout(() => {");
    expect(main).toContain("previewed ?? buildPathCandidates.querySelector");
  });

  it("features one Calling while keeping the alternatives compact", () => {
    expect(styles).toContain("/* Calling selector v3");
    expect(styles).toContain('button[data-previewing="true"]');
    expect(styles).toContain("grid-row: 1 / 4");
    expect(styles).toContain("grid-template-rows: repeat(3, 116px)");
    expect(styles).toContain("grid-template-columns: minmax(360px, 1.28fr) repeat(2, minmax(190px, .72fr))");
  });

  it("adapts the selector for tablet and phone widths", () => {
    expect(styles).toContain("@media (max-width: 900px)");
    expect(styles).toContain("@media (max-width: 620px)");
    expect(styles).toContain("max-height: 100dvh");
  });
});
