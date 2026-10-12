import { describe, expect, it } from "vitest";
import { parseSignaturePity, resolveSignatureDrop, serializeSignaturePity, signatureLootHint } from "./signature-loot.js";

describe("signature loot protection", () => {
  it("guarantees a signature item the first time", () => {
    expect(resolveSignatureDrop("matriarch_edge", false, 0, .99)).toMatchObject({ drop: true, firstClear: true, nextMisses: 0 });
  });

  it("uses chance on repeats and guarantees the configured clear", () => {
    expect(resolveSignatureDrop("matriarch_edge", true, 0, .24)).toMatchObject({ drop: true, pityTriggered: false });
    expect(resolveSignatureDrop("matriarch_edge", true, 0, .99)).toMatchObject({ drop: false, nextMisses: 1, guaranteedIn: 3 });
    expect(resolveSignatureDrop("matriarch_edge", true, 3, .99)).toMatchObject({ drop: true, pityTriggered: true, nextMisses: 0 });
  });

  it("sanitizes persisted counters and reports player-facing odds", () => {
    const pity = parseSignaturePity('{"matriarch_edge":2,"venom_focus":99,"bad":5}');
    expect(pity).toEqual({ matriarch_edge: 2, venom_focus: 4 });
    expect(parseSignaturePity(serializeSignaturePity(pity))).toEqual(pity);
    expect(signatureLootHint("matriarch_edge", true, pity)).toContain("guaranteed within 2 clears");
    expect(signatureLootHint("venom_focus", false, pity)).toContain("First victory guarantees");
  });
});
