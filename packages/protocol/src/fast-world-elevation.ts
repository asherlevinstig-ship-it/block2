/** Shared authored heightfield. Keeping this in protocol means rendering,
 * movement, targeting and server reconciliation agree on the same terrain. */
export function fastWorldGroundHeight(x: number, z: number): number {
  const mound=(cx:number,cz:number,rx:number,rz:number,h:number):number=>{
    const r2=((x-cx)/rx)**2+((z-cz)/rz)**2;
    return r2>=1?0:h*(1-r2)**3;
  };
  if (x >= 40 && x <= 104 && z >= 148 && z <= 188) {
    // Low dune ridges frame the routes while the southern shore falls gently
    // towards the sea. Encounter centres remain broad and readable.
    const shoreDrop = z <= 179 ? 0 : -.34 * Math.min(1, (z - 179) / 8);
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
