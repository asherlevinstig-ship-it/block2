/** Authored gate-to-Mosswatch section. Distances are world metres. */
export type TrailPoint = readonly [number, number, number]; // x, z, width
export const GREENWOOD_MAIN_TRAIL: readonly TrailPoint[] = [
  [106, 106, 6.25], [112, 105.4, 5.7], [118, 107.1, 5.2],
  [125, 108, 5.1], [132, 106.9, 5.2], [139, 106, 5.2],
];
export const GREENWOOD_CAMP_TRAIL: readonly TrailPoint[] = [
  [116, 106.3, 3.6], [117.5, 101.7, 3.3], [120.3, 98, 3.1],
  [122.2, 95, 3.6], [123.5, 91.5, 5.2],
];
export const MOSSWATCH_CLEARING = { x: 123.5, z: 90.5, radius: 6.5 } as const;
export const GREENWOOD_THICKETS = [
  [110.5, 91, 2.8], [113, 97, 2.5], [111.5, 116.5, 3.1],
  [118, 115.5, 2.8], [126, 116, 3.3], [132, 98, 2.6],
  [133, 88.5, 3], [126, 80.3, 2.9], [116, 82, 3.1],
] as const;

const catmull = (a: number, b: number, c: number, d: number, t: number): number =>
  .5 * ((2 * b) + (-a + c) * t + (2*a - 5*b + 4*c - d)*t*t + (-a + 3*b - 3*c + d)*t*t*t);
export function sampleWoodlandTrail(points: readonly TrailPoint[], steps = 12): TrailPoint[] {
  const result: TrailPoint[] = [];
  for (let i = 0; i < points.length - 1; i++) for (let j = 0; j < steps; j++) {
    const a = points[Math.max(0,i-1)]!, b = points[i]!, c = points[i+1]!, d = points[Math.min(points.length-1,i+2)]!;
    result.push([catmull(a[0],b[0],c[0],d[0],j/steps), catmull(a[1],b[1],c[1],d[1],j/steps), b[2]+(c[2]-b[2])*j/steps]);
  }
  result.push(points[points.length-1]!); return result;
}
const trails = [sampleWoodlandTrail(GREENWOOD_MAIN_TRAIL), sampleWoodlandTrail(GREENWOOD_CAMP_TRAIL)];
export function woodlandPlantAllowed(x: number, z: number): boolean {
  if (Math.hypot(x-MOSSWATCH_CLEARING.x,z-MOSSWATCH_CLEARING.z) < MOSSWATCH_CLEARING.radius + 1.2) return false;
  return trails.every(trail => trail.every(p => Math.hypot(x-p[0],z-p[1]) > p[2]*.5 + 1.1));
}
export const GREENWOOD_CLUSTER_PLANTS = GREENWOOD_THICKETS.flatMap(([x,z,radius], cluster) =>
  Array.from({length: 9}, (_,i) => {
    const angle = i*2.39996 + cluster, distance = radius*Math.sqrt((i+.5)/9);
    return { x:x+Math.cos(angle)*distance, z:z+Math.sin(angle)*distance,
      scale: .9 + (i%4)*.22, yaw: (i*137+cluster*41)%360, tree: i%3===0 };
  }).filter(p => woodlandPlantAllowed(p.x,p.z)));
