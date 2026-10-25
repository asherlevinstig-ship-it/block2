import * as pc from "playcanvas";

function skyTexture(device: pc.GraphicsDevice): pc.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 256;
  const context = canvas.getContext("2d")!;
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#477fa6");
  gradient.addColorStop(.3, "#77a8c3");
  gradient.addColorStop(.5, "#a6c5ce");
  gradient.addColorStop(.62, "#b7cbd0");
  gradient.addColorStop(.82, "#718f9b");
  gradient.addColorStop(1, "#52717c");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new pc.Texture(device, { width: canvas.width, height: canvas.height, mipmaps: false });
  texture.setSource(canvas);
  return texture;
}

function sunTexture(device: pc.GraphicsDevice): pc.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  const glow = context.createRadialGradient(128, 128, 8, 128, 128, 124);
  glow.addColorStop(0, "rgba(255,251,226,1)");
  glow.addColorStop(.16, "rgba(255,245,197,1)");
  glow.addColorStop(.23, "rgba(255,218,149,.94)");
  glow.addColorStop(.31, "rgba(255,201,139,.42)");
  glow.addColorStop(.58, "rgba(255,216,163,.12)");
  glow.addColorStop(1, "rgba(255,226,182,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new pc.Texture(device, { width: canvas.width, height: canvas.height, mipmaps: true });
  texture.setSource(canvas);
  return texture;
}

/** Camera-centred sky keeps the suspended town's empty horizon free of a hard backdrop edge. */
export function createFastWorldSky(app: pc.Application, camera: pc.Entity): void {
  const sky = new pc.Entity("fast-world-sky");
  sky.addComponent("render", { type: "sphere", castShadows: false, receiveShadows: false });
  const skyMaterial = new pc.StandardMaterial();
  skyMaterial.diffuse = new pc.Color(0, 0, 0);
  skyMaterial.emissive = new pc.Color(1, 1, 1);
  skyMaterial.emissiveMap = skyTexture(app.graphicsDevice);
  skyMaterial.useLighting = false;
  skyMaterial.useFog = false;
  skyMaterial.cull = pc.CULLFACE_NONE;
  skyMaterial.depthWrite = false;
  skyMaterial.update();
  if (sky.render) sky.render.material = skyMaterial;
  sky.setLocalScale(220, 220, 220);
  app.root.addChild(sky);

  const sun = new pc.Entity("fast-world-sun-disc");
  sun.addComponent("render", { type: "plane", castShadows: false, receiveShadows: false });
  const sunMap = sunTexture(app.graphicsDevice);
  const sunMaterial = new pc.StandardMaterial();
  sunMaterial.diffuse = new pc.Color(0, 0, 0);
  sunMaterial.emissive = new pc.Color(1, .97, .9);
  sunMaterial.emissiveMap = sunMap;
  sunMaterial.opacityMap = sunMap;
  sunMaterial.opacityMapChannel = "a";
  sunMaterial.useLighting = false;
  sunMaterial.useFog = false;
  sunMaterial.blendType = pc.BLEND_NORMAL;
  sunMaterial.depthWrite = false;
  sunMaterial.cull = pc.CULLFACE_NONE;
  sunMaterial.update();
  if (sun.render) sun.render.material = sunMaterial;
  sun.setLocalScale(32, 1, 32);
  app.root.addChild(sun);

  app.on("update", () => {
    const position = camera.getPosition();
    sky.setPosition(position);
    sun.setPosition(position.x + 82, position.y + 38, position.z - 28);
    sun.lookAt(position);
    sun.rotateLocal(90, 0, 0);
  });
}
