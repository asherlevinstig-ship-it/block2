import { describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ entities: [] as any[], textures: [] as any[] }));
vi.mock("playcanvas", () => {
  class Entity {
    enabled = true;
    constructor(public name: string) { mock.entities.push(this); }
    addComponent = vi.fn(); setPosition = vi.fn(); lookAt = vi.fn(); setEulerAngles = vi.fn(); destroy = vi.fn();
  }
  class Texture {
    constructor() { mock.textures.push(this); }
    read = vi.fn(async () => new Uint8Array(4)); destroy = vi.fn();
  }
  return { Entity, Texture, Layer: class { id = 17; }, RenderTarget: class { destroy = vi.fn(); }, Color: class {},
    PIXELFORMAT_R8_G8_B8_A8: 1, FILTER_LINEAR: 1, PROJECTION_ORTHOGRAPHIC: 1, TONEMAP_ACES: 1, GAMMA_SRGB: 1 };
});
import { createInventoryPortrait } from "./inventory-preview.js";
function setup() {
  mock.entities.length = 0; mock.textures.length = 0;
  const callbacks = new Map<string, () => Promise<void>>();
  const app = { graphicsDevice: {}, scene: { layers: { push: vi.fn(), remove: vi.fn() } },
    root: { addChild: vi.fn() }, on: (name: string, cb: () => Promise<void>) => callbacks.set(name, cb), off: vi.fn() };
  const render = { layers: [0], castShadows: true };
  const character = { enabled: true, findComponents: () => [render], destroy: vi.fn() };
  const context = { createImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData: vi.fn() };
  const canvas = { width: 1, height: 1, getContext: () => context };
  const portrait = createInventoryPortrait(app as any, canvas as any, character as any);
  return { portrait, character, render, context, texture: mock.textures[0], capture: callbacks.get("postrender")!, app };
}
describe("inventory portrait lifecycle", () => {
  it("uses an isolated layer and stays off until requested", async () => {
    const view = setup();
    expect(view.render.layers).toEqual([17]);
    expect(view.character.enabled).toBe(false);
    await view.capture(); expect(view.texture.read).not.toHaveBeenCalled();
    view.portrait.refresh(); expect(view.character.enabled).toBe(true);
    await view.capture(); expect(view.context.putImageData).toHaveBeenCalledOnce();
    expect(view.character.enabled).toBe(false);
    await view.capture(); expect(view.texture.read).toHaveBeenCalledOnce();
  });
  it("discards a capture if the inventory closed during readback", async () => {
    const view = setup();
    let complete!: () => void;
    view.texture.read.mockImplementation(() => new Promise<void>(resolve => { complete = resolve; }));
    view.portrait.refresh(); const reading = view.capture(); view.portrait.hide(); complete(); await reading;
    expect(view.context.putImageData).not.toHaveBeenCalled();
    expect(view.character.enabled).toBe(false);
  });
  it("reuses unchanged gear across inventory reopen and only captures a new appearance", async () => {
    const view = setup();
    view.portrait.refresh("sword:none"); await view.capture();
    view.portrait.hide(); view.portrait.refresh("sword:none"); await view.capture();
    expect(view.texture.read).toHaveBeenCalledOnce();
    expect(view.character.enabled).toBe(false);
    view.portrait.refresh("sword:iron"); await view.capture();
    expect(view.texture.read).toHaveBeenCalledTimes(2);
    expect(view.app).toHaveProperty("renderNextFrame", true);
  });
  it("coalesces identical requests while capture is pending", async () => {
    const view = setup();
    view.portrait.refresh("bow:leather"); view.portrait.refresh("bow:leather");
    await view.capture();
    expect(view.texture.read).toHaveBeenCalledOnce();
    expect(view.context.putImageData).toHaveBeenCalledOnce();
  });
  it("cancels a pending new look when returning to the cached appearance", async () => {
    const view = setup();
    view.portrait.refresh("sword:none"); await view.capture();
    view.portrait.refresh("bow:iron"); view.portrait.refresh("sword:none"); await view.capture();
    expect(view.texture.read).toHaveBeenCalledOnce();
    expect(view.character.enabled).toBe(false);
  });
  it("releases render resources and listeners", () => {
    const view = setup(); view.portrait.destroy();
    expect(view.texture.destroy).toHaveBeenCalledOnce();
    expect(view.character.destroy).toHaveBeenCalledOnce();
    expect(view.app.off).toHaveBeenCalledWith("postrender", view.capture);
    expect(view.app.scene.layers.remove).toHaveBeenCalledOnce();
  });
});
