/** Outdoor grade for Fast World only. Nearby fighting space remains haze-free. */
export function greenwoodAtmosphere(x: number, z: number) {
  const clearing = 1 - Math.max(0, Math.min(1, (Math.hypot(x - 123.5, z - 90.5) - 4) / 8));
  return {
    ambient: { r: .32 + clearing * .05, g: .39 + clearing * .04, b: .43 + clearing * .02 },
    fog: { r: .38, g: .48, b: .46 },
    sun: 1.12 + clearing * .16,
    fill: .38,
    fogStart: 32 + clearing * 6,
    fogEnd: 78,
  };
}
