// Server-side mob senses & projectile physics, parameterized over a
// solid-block getter so the same code serves the overworld and any
// dungeon instance world buffer.

const W = require('./world');

const NON_SOLID = new Set([0, W.B.WATER, W.B.TORCH]);

// solid(x,y,z) factory for a space ('' = overworld, otherwise an instance buffer)
function makeSolid(instWorld, overworld) {
  if (!instWorld) {
    const world = overworld || W;
    return (x, y, z) => world.isSolid(world.getB(x, y, z));
  }
  return (x, y, z) => {
    if (!instWorld.inBounds(x, y, z)) return true;
    return !NON_SOLID.has(instWorld.getB(x, y, z));
  };
}

// grid-sampled line of sight
function losClear(solid, x1, y1, z1, x2, y2, z2) {
  const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
  const d = Math.hypot(dx, dy, dz);
  if (d < .001) return true;
  const steps = Math.ceil(d / .6);
  for (let k = 1; k < steps; k++) {
    const f = k / steps;
    if (solid(Math.floor(x1 + dx * f), Math.floor(y1 + dy * f), Math.floor(z1 + dz * f))) return false;
  }
  return true;
}

// one substep of an arrow/bolt; returns 'fly' | 'block' | {hit: playerEntry}
function arrowStep(a, dt, solid, targets) {
  if (!a.bolt) a.vy -= 4.5 * dt;
  a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt;
  if (solid(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z))) return 'block';
  for (const tgt of targets) {
    if (Math.hypot(a.x - tgt.p.x, a.z - tgt.p.z) < .55 &&
        a.y > tgt.p.y && a.y < tgt.p.y + 1.8) return { hit: tgt };
  }
  return 'fly';
}

module.exports = { makeSolid, losClear, arrowStep, NON_SOLID };
