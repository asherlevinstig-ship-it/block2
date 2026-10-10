import { describe, expect, it, vi } from "vitest";
import { createInventoryPortrait } from "./inventory-preview.js";
function setup() {
  const context = { fillStyle: "", fillRect: vi.fn(), save: vi.fn(), scale: vi.fn(), restore: vi.fn() };
  const canvas = { width: 240, height: 280, getContext: vi.fn(() => context) };
  return { portrait: createInventoryPortrait(canvas as unknown as HTMLCanvasElement), context, canvas };
}
describe("lightweight inventory paper doll", () => {
  it("uses only a 2D canvas and a bounded number of rectangles", () => {
    const { portrait, context, canvas } = setup(); portrait.refresh("longsword", "none");
    expect(canvas.getContext).toHaveBeenCalledWith("2d", { alpha: false });
    expect(context.fillRect.mock.calls.length).toBeLessThan(50);
    expect(context.save).toHaveBeenCalledOnce(); expect(context.restore).toHaveBeenCalledOnce();
  });
  it("does no redraw on repeated Show Worn Gear clicks or reopening", () => {
    const { portrait, context } = setup(); portrait.refresh("longsword", "none");
    const calls = context.fillRect.mock.calls.length;
    for (let i = 0; i < 100; i++) { portrait.hide(); portrait.refresh("longsword", "none"); }
    expect(context.fillRect).toHaveBeenCalledTimes(calls);
  });
  it("redraws once when equipment changes", () => {
    const { portrait, context } = setup();
    portrait.refresh("bow", "leather_armour"); portrait.refresh("bow", "iron_armour");
    expect(context.save).toHaveBeenCalledTimes(2);
  });
  it("draws every weapon family and armour without animation", () => {
    const { portrait, context } = setup();
    for (const hand of ["longsword", "bow", "magic_focus", "forged_sword", "forged_bow", "forged_focus", "fang_dagger", "stone_core_hammer", "acid_gland_focus"] as const) {
      for (const armour of ["none", "leather_armour", "iron_armour"] as const) portrait.refresh(hand, armour);
    }
    expect(context.restore).toHaveBeenCalledTimes(27);
  });
  it("handles unavailable canvas and disposal", () => {
    createInventoryPortrait({ getContext: () => null } as unknown as HTMLCanvasElement).refresh("bow", "none");
    const { portrait, context } = setup(); portrait.destroy(); portrait.refresh("bow", "none");
    expect(context.fillRect).not.toHaveBeenCalled();
  });
});
