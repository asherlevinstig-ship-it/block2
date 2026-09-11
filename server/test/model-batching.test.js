const test = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');

test('static batching preserves transformed surfaces and animated pivots', async () => {
  const { batchStaticModelParts } = await import('../../client/js/model-batching.mjs');
  const root = new THREE.Group();
  const arm = new THREE.Group();
  root.add(arm);
  const material = new THREE.MeshBasicMaterial();
  for (let i = 0; i < 3; i++) {
    const part = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), material);
    part.position.set(i * 2, i, 0);
    part.rotation.z = i * 0.3;
    arm.add(part);
  }
  const leg = new THREE.Mesh(new THREE.BoxGeometry(), material);
  root.add(leg);
  const surfaces = () => {
    root.updateMatrixWorld(true);
    const points = [];
    root.traverse(mesh => {
      if (!mesh.isMesh) return;
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
        points.push([p.x, p.y, p.z]);
      }
      if (geometry !== mesh.geometry) geometry.dispose();
    });
    return points;
  };
  const before = surfaces();
  arm.rotation.y = 0.8;
  const animatedBefore = surfaces();
  arm.rotation.y = 0;
  batchStaticModelParts({ THREE, root, animated: [arm, leg] });
  assert.equal(arm.children.length, 1);
  assert.equal(leg.parent, root);
  assert.equal(arm.children[0].material, material);
  const close = (actual, expected) => {
    assert.equal(actual.length, expected.length);
    actual.forEach((p, i) => p.forEach((v, axis) => assert.ok(Math.abs(v - expected[i][axis]) < 0.00001)));
  };
  close(surfaces(), before);
  arm.rotation.y = 0.8;
  close(surfaces(), animatedBefore);
});
