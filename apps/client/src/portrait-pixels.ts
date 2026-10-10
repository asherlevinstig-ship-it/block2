/** WebGL reads bottom-up; a canvas image uses top-down rows. */
export function flipPortraitRows(source: Uint8Array, destination: Uint8ClampedArray, width: number, height: number): void {
  const stride = width * 4;
  for (let y = 0; y < height; y++) {
    destination.set(source.subarray(y * stride, (y + 1) * stride), (height - y - 1) * stride);
  }
}
