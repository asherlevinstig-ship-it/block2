(function exposeDimensionGrid(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BlockcraftDimensions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function dimensionGridFactory() {
  'use strict';

  class DimensionGrid {
    constructor({
      kind = 'dimension', id = '', width, height, depth = width,
      originX = 0, originY = 0, originZ = 0,
      empty = 0, outside = empty, data = null,
    } = {}) {
      for (const [name, value] of [['width', width], ['height', height], ['depth', depth]]) {
        if (!Number.isInteger(value) || value <= 0) throw new RangeError(name + ' must be a positive integer');
      }
      this.kind = String(kind || 'dimension');
      this.id = String(id || '');
      this.width = width;
      this.height = height;
      this.depth = depth;
      this.originX = originX | 0;
      this.originY = originY | 0;
      this.originZ = originZ | 0;
      this.empty = empty | 0;
      this.outside = outside | 0;
      const size = width * height * depth;
      if (data != null && (!(data instanceof Uint8Array) || data.length !== size)) {
        throw new RangeError('data must be a Uint8Array matching the grid dimensions');
      }
      this.data = data || new Uint8Array(size);
      if (!data && this.empty !== 0) this.data.fill(this.empty);
    }

    inBounds(x, y, z) {
      return x >= this.originX && x < this.originX + this.width &&
        y >= this.originY && y < this.originY + this.height &&
        z >= this.originZ && z < this.originZ + this.depth;
    }
    index(x, y, z) {
      return (y - this.originY) * this.width * this.depth +
        (z - this.originZ) * this.width + (x - this.originX);
    }
    getB(x, y, z) { return this.inBounds(x, y, z) ? this.data[this.index(x, y, z)] : this.outside; }
    setB(x, y, z, value) {
      if (!this.inBounds(x, y, z)) return false;
      this.data[this.index(x, y, z)] = value;
      return true;
    }
    fill(value = this.empty) { this.data.fill(value); return this; }
    get length() { return this.data.length; }
    get byteLength() { return this.data.byteLength; }
    get buffer() { return this.data; }
    get bounds() {
      return {
        minX: this.originX, minY: this.originY, minZ: this.originZ,
        maxX: this.originX + this.width - 1,
        maxY: this.originY + this.height - 1,
        maxZ: this.originZ + this.depth - 1,
      };
    }
  }

  function isDimensionGrid(value) {
    return value instanceof DimensionGrid || !!(value && typeof value.inBounds === 'function' &&
      typeof value.getB === 'function' && typeof value.setB === 'function' && value.data instanceof Uint8Array);
  }

  return { DimensionGrid, isDimensionGrid };
});
