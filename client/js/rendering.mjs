export function configureRendererColorPipeline(THREE, renderer) {
  // Canvas and authored colour textures are painted in display (sRGB) space.
  // Decode them for lighting, then encode once at the backbuffer. ACES gives
  // emissive combat effects highlight roll-off without a post-process pass.
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  return renderer;
}

export function createRenderingRuntime({ THREE, mount, width, height, pixelRatio }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, width / height, 0.08, 300);
  const renderer = new THREE.WebGLRenderer({ antialias: false, stencil: false, precision: 'mediump', powerPreference: 'high-performance' });
  configureRendererColorPipeline(THREE, renderer);
  const basePixelRatio = Math.min(pixelRatio, 2);
  let resolutionScale = 1;
  renderer.setSize(width, height);
  renderer.setPixelRatio(basePixelRatio);
  mount.appendChild(renderer.domElement);

  function resize(nextWidth, nextHeight) {
    camera.aspect = nextWidth / nextHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(nextWidth, nextHeight);
  }
  function setResolutionScale(nextScale=1) {
    const clamped=Math.max(.5,Math.min(1,Number(nextScale)||1));
    if(Math.abs(clamped-resolutionScale)<.01)return;
    resolutionScale=clamped;
    renderer.setPixelRatio(basePixelRatio*resolutionScale);
  }
  const render = () => renderer.render(scene, camera);
  return { scene, camera, renderer, resize, render, setResolutionScale, getResolutionScale:()=>resolutionScale };
}
