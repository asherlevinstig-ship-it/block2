// Coalesce edits and spread meshing across frames. The budget is cooperative:
// one chunk may exceed it, but we never start another chunk after it expires.
export function createChunkWorkQueue({ build, now = () => performance.now() }) {
  const pending = new Map();
  return {
    enqueue(x, z) { pending.set(`${x},${z}`, { x, z }); },
    retain(wanted) { for (const key of pending.keys()) if (!wanted.has(key)) pending.delete(key); },
    clear() { pending.clear(); },
    get size() { return pending.size; },
    drain(cx, cz, { budgetMs = 4, maxChunks = 2 } = {}) {
      const start = now();
      let built = 0;
      while (pending.size && built < maxChunks && (built === 0 || now() - start < budgetMs)) {
        let nearest, distance = Infinity;
        for (const entry of pending.values()) {
          const d = (entry.x - cx) ** 2 + (entry.z - cz) ** 2;
          if (d < distance) { nearest = entry; distance = d; }
        }
        pending.delete(`${nearest.x},${nearest.z}`);
        build(nearest.x, nearest.z);
        built++;
      }
      return built;
    },
  };
}
