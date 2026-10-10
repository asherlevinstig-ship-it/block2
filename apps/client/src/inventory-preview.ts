import * as pc from "playcanvas";
import { flipPortraitRows } from "./portrait-pixels.js";

/** A private render layer: never moves or renders the real player. */
export function createInventoryPortrait(app: pc.Application, canvas: HTMLCanvasElement, character: pc.Entity) {
  const layer = new pc.Layer({ name: "Inventory portrait" });
  app.scene.layers.push(layer);
  for (const component of character.findComponents("render") as pc.RenderComponent[]) {
    component.layers = [layer.id];
    component.castShadows = false;
  }
  const texture = new pc.Texture(app.graphicsDevice, {
    width: canvas.width, height: canvas.height, format: pc.PIXELFORMAT_R8_G8_B8_A8,
    mipmaps: false, minFilter: pc.FILTER_LINEAR, magFilter: pc.FILTER_LINEAR,
  });
  const target = new pc.RenderTarget({ colorBuffer: texture, depth: true });
  const camera = new pc.Entity("inventory-portrait-camera");
  camera.addComponent("camera", {
    layers: [layer.id], renderTarget: target, priority: 10,
    projection: pc.PROJECTION_ORTHOGRAPHIC, orthoHeight: 1.2,
    clearColor: new pc.Color(.055, .09, .075), farClip: 10,
    toneMapping: pc.TONEMAP_ACES, gammaCorrection: pc.GAMMA_SRGB,
  });
  camera.setPosition(2.6, 1.7, 4);
  camera.lookAt(0, .85, 0);
  const light = new pc.Entity("inventory-portrait-light");
  light.addComponent("light", { type: "directional", layers: [layer.id],
    color: new pc.Color(1, .93, .82), intensity: 1.5, castShadows: false });
  light.setEulerAngles(40, -35, 0);
  app.root.addChild(character); app.root.addChild(camera); app.root.addChild(light);
  camera.enabled = false; character.enabled = false; light.enabled = false;
  const pixels = new Uint8Array(canvas.width * canvas.height * 4);
  const context = canvas.getContext("2d")!;
  const frame = context.createImageData(canvas.width, canvas.height);
  let pending = false;
  let reading = false;
  let revision = 0;
  let cachedKey: string | undefined;
  let requestedKey: string | undefined;
  const capture = async () => {
    if (!pending || reading) return;
    pending = false; reading = true;
    const capturedRevision = revision;
    const capturedKey = requestedKey;
    camera.enabled = false; character.enabled = false; light.enabled = false;
    try {
      await texture.read(0, 0, canvas.width, canvas.height, { renderTarget: target, data: pixels, frequent: true });
      if (capturedRevision !== revision) return;
      flipPortraitRows(pixels, frame.data, canvas.width, canvas.height);
      context.putImageData(frame, 0, 0);
      cachedKey = capturedKey;
    } catch (error) {
      console.warn("Inventory portrait unavailable", error);
    } finally { reading = false; }
  };
  app.on("postrender", capture);
  return {
    refresh(key?: string) {
      if (key !== undefined && key === cachedKey) {
        // Returning to the cached look must cancel a newer pending capture.
        revision++; requestedKey = undefined; pending = false;
        character.enabled = false; camera.enabled = false; light.enabled = false;
        return;
      }
      if (key !== undefined && key === requestedKey && (pending || reading)) return;
      requestedKey = key; revision++; pending = true;
      character.enabled = true; camera.enabled = true; light.enabled = true;
      app.renderNextFrame = true;
    },
    hide() { revision++; requestedKey = undefined; pending = false; character.enabled = false; camera.enabled = false; light.enabled = false; },
    destroy() {
      revision++;
      app.off("postrender", capture); character.destroy(); camera.destroy(); light.destroy();
      app.scene.layers.remove(layer); target.destroy(); texture.destroy();
    },
  };
}
