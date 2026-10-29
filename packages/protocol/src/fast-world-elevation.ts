import { towerFloorOneGroundHeight } from "./tower-floor-one.js";

/** Shared authored heightfield. Keeping this in protocol means rendering,
 * movement, targeting and server reconciliation agree on the same terrain. */
export function fastWorldCoastShorelineZ(x: number): number {
  const coastX = Math.max(40, Math.min(104, x));
  const bend = 177 + 2.5 * Math.sin((coastX - 40) * .13)
    + 1.3 * Math.sin((coastX - 40) * .31);
  return bend + Math.max(0, coastX - 90) * .23;
}

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const smoothBand = (value: number, start: number, end: number, feather: number): number =>
  smoothstep(start - feather, start + feather, value) * (1 - smoothstep(end - feather, end + feather, value));

/** The Town of Beginnings uses the same elevation profile on the server and
 * client. Its long feathers are deliberate: players, NPCs and dodges traverse
 * these as broad ramps rather than colliding with decorative steps. */
export function fastWorldTownTerraceOffset(x: number, z: number): number {
  if (x < 39 || x > 109 || z < 65 || z > 147) return 0;

  // Founders' Hall sits above the town. The eastern falloff is the ceremonial
  // stair/ramp; the northern and southern falloffs form landscaped banks.
  const founders = (1 - smoothstep(52, 65, x)) * smoothBand(z, 65, 86, 2.2);

  // Two market courts descend from the civic plaza. Keeping the central east
  // gate lane level protects the spawn/portal sightline and makes both lower
  // courts visible from the plaza overlooks.
  const marketAccess = smoothstep(76, 86, x);
  const northMarket = marketAccess * smoothBand(z, 84, 101, 2.6);
  const southMarket = marketAccess * smoothBand(z, 111, 129, 2.6);
  return founders * 1.45 - Math.max(northMarket, southMarket) * .72;
}

export function fastWorldGroundHeight(x: number, z: number): number {
  const mound=(cx:number,cz:number,rx:number,rz:number,h:number):number=>{
    const r2=((x-cx)/rx)**2+((z-cz)/rz)**2;
    return r2>=1?0:h*(1-r2)**3;
  };
  if (x >= 296 && x <= 392 && z >= 56 && z <= 156) return towerFloorOneGroundHeight(x, z);
  if (x >= 39 && x <= 109 && z >= 65 && z <= 147) return 8 + fastWorldTownTerraceOffset(x, z);
  if (x >= 40 && x <= 104 && z >= 148 && z <= 188) {
    // Low dune ridges frame the routes while the southern shore falls gently
    // towards the sea. Encounter centres remain broad and readable.
    const shoreProgress = Math.max(0, Math.min(1, (z - fastWorldCoastShorelineZ(x)) / 9));
    const shoreDrop = -.34 * shoreProgress * shoreProgress * (3 - 2 * shoreProgress);
    return 8 + shoreDrop
      + mound(43.5,153,7.5,5.2,.62) + mound(55,166.5,6.4,4.7,.42)
      + mound(75,153,9.5,4.9,.72) + mound(87.5,171.5,7.2,4.6,.48)
      + mound(99.5,150.5,6.2,4.8,.58);
  }
  if (x < 108 || x > 138 || z < 75 || z > 116) return 8;
  // The clearing remains level. Hollows are the low ground between these rises.
  const clearing=Math.hypot(x-123.5,z-90.5);
  const t=Math.max(0,Math.min(1,(clearing-6.5)/3));
  const mask=t*t*(3-2*t);
  return 8+mask*(mound(114,102,6,7,.55)+mound(130,108,8,8,.65)
    +mound(124,80,10,5,1.8)+mound(113,89,4,8,1.1)+mound(133,92,4,7,1.05));
}
