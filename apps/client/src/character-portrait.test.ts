import { describe, expect, it, vi } from "vitest";
import * as pc from "playcanvas";
import { createCharacterPortrait } from "./character-portrait.js";

describe("on-demand character portrait", () => {
  it("draws visible boxes from the existing rig, then restores worn gear", () => {
    const context = {
      fillStyle: "", fillRect: vi.fn(), beginPath: vi.fn(), ellipse: vi.fn(),
      fill: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(),
    };
    const canvas = {
      width: 240, height: 280, getContext: vi.fn(() => context),
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    } as unknown as HTMLCanvasElement;
    const transform = new pc.Mat4();
    const root = { enabled: true, parent: null, getWorldTransform: () => transform, findComponents: vi.fn() } as unknown as pc.Entity;
    const box = { enabled: true, parent: root, getWorldTransform: () => transform } as unknown as pc.Entity;
    const material = new pc.StandardMaterial(); material.diffuse = new pc.Color(.3, .6, .5);
    const render = { entity: box, type: "box", material } as unknown as pc.RenderComponent;
    vi.mocked(root.findComponents).mockReturnValue([render]);
    const restore = vi.fn();
    const select = vi.fn(() => restore);
    const portrait = createCharacterPortrait(canvas, root, select);
    portrait.refresh("longsword", "none", "warm:swept");
    expect(context.fill.mock.calls.length).toBeGreaterThan(1);
    expect(select).toHaveBeenCalledOnce();
    expect(restore).toHaveBeenCalledOnce();
    portrait.refresh("longsword", "none", "warm:swept");
    expect(select).toHaveBeenCalledOnce();
    portrait.turn(45);
    expect(select).toHaveBeenCalledTimes(2);
    portrait.destroy();
    expect(canvas.removeEventListener).toHaveBeenCalledTimes(4);
  });
});
