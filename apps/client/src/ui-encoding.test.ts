import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("UI source encoding", () => {
  it("contains no Windows-1252/UTF-8 mojibake markers", () => {
    const sources = [
      readFileSync(new URL("./main.ts", import.meta.url), "utf8"),
      readFileSync(new URL("./styles.css", import.meta.url), "utf8"),
      readFileSync(new URL("../index.html", import.meta.url), "utf8"),
    ];
    for (const source of sources) expect(source).not.toMatch(/[\u00c2\u00c3\u00e2]/u);
  });

  it("keeps the HUD level separator as a real middle dot", () => {
    const source = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
    expect(source).toContain("`${update.level} · ${update.experience}/${required} XP`");
  });
});
