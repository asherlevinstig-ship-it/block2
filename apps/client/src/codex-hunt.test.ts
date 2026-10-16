import { describe, expect, it } from "vitest";
import { codexHuntPlan, nextSetPiece } from "./codex-hunt.js";

describe("Codex equipment hunts", () => {
  it("turns a desired drop into one clear destination", () => {
    expect(codexHuntPlan("fang_dagger")).toMatchObject({ source: "Mossback Alpha", level: "LV 2–5" });
    expect(codexHuntPlan("fang_dagger")?.protection).toContain("Guaranteed");
  });

  it("routes dungeon equipment to the correct entrance", () => {
    expect(codexHuntPlan("matriarch_edge")?.target.id).toBe("codex-depths");
    expect(codexHuntPlan("rootbound_hammer")?.target.id).toBe("codex-forest");
  });

  it("suggests the matching build-set piece after a successful hunt", () => {
    expect(nextSetPiece("fang_dagger")).toBe("fangstalker_wrap");
    expect(nextSetPiece("venomweave_mantle")).toBe("acid_gland_focus");
    expect(nextSetPiece("matriarch_edge")).toBeNull();
  });
});
