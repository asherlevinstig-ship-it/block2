export function createRenderingRuntime({ THREE, mount, width, height, pixelRatio }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, width / height, 0.08, 300);
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(pixelRatio, 2));
  mount.appendChild(renderer.domElement);

  function resize(nextWidth, nextHeight) {
    camera.aspect = nextWidth / nextHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(nextWidth, nextHeight);
  }
  const render = () => renderer.render(scene, camera);
  return { scene, camera, renderer, resize, render };
}
