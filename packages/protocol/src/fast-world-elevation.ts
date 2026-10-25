/** Shared authored heightfield; compact support keeps town and other regions flat. */
export function fastWorldGroundHeight(x: number, z: number): number {
  if (x < 108 || x > 138 || z < 75 || z > 116) return 8;
  const mound=(cx:number,cz:number,rx:number,rz:number,h:number):number=>{
    const r2=((x-cx)/rx)**2+((z-cz)/rz)**2;
    return r2>=1?0:h*(1-r2)**3;
  };
  // The clearing remains level. Hollows are the low ground between these rises.
  const clearing=Math.hypot(x-123.5,z-90.5);
  const t=Math.max(0,Math.min(1,(clearing-6.5)/3));
  const mask=t*t*(3-2*t);
  return 8+mask*(mound(114,102,6,7,.55)+mound(130,108,8,8,.65)
    +mound(124,80,10,5,1.8)+mound(113,89,4,8,1.1)+mound(133,92,4,7,1.05));
}
