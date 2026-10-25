import { describe, expect, it } from "vitest";
import { rapidPracticeCollisionCellSolid } from "@blockcraft/protocol";
import { GREENWOOD_MAIN_TRAIL, GREENWOOD_CAMP_TRAIL, GREENWOOD_CLUSTER_PLANTS, GREENWOOD_VERGE_PLANTS,
  MOSSWATCH_CLEARING, sampleWoodlandTrail, woodlandPlantAllowed } from "./greenwood-landscape.js";
import { GREENWOOD_MOB_SIGNS } from "./greenwood-visuals.js";

describe("Greenwood gate-to-Mosswatch route", () => {
  it("keeps the trail centre and walking shoulders on supported, unobstructed ground", () => {
    for(const points of [GREENWOOD_MAIN_TRAIL,GREENWOOD_CAMP_TRAIL]) {
      const trail=sampleWoodlandTrail(points);
      for(const [i,p] of trail.entries()) {
        const next=trail[Math.min(i+1,trail.length-1)]!, prev=trail[Math.max(0,i-1)]!;
        const dx=next[0]-prev[0],dz=next[1]-prev[1],len=Math.hypot(dx,dz);
        for(const side of [-.35,0,.35]) {
          const x=p[0]-dz/len*p[2]*side,z=p[1]+dx/len*p[2]*side;
          expect(rapidPracticeCollisionCellSolid(x,7,z)).toBe(true);
          expect(rapidPracticeCollisionCellSolid(x,8,z)).toBe(false);
        }
        if(i) expect(Math.hypot(p[0]-trail[i-1]![0],p[1]-trail[i-1]![1])).toBeLessThan(1);
      }
    }
  });
  it("ends inside the first encounter and reserves its dodge space", () => {
    const end=GREENWOOD_CAMP_TRAIL.at(-1)!;
    expect(Math.hypot(end[0]-MOSSWATCH_CLEARING.x,end[1]-MOSSWATCH_CLEARING.z)).toBeLessThan(2);
    expect(woodlandPlantAllowed(MOSSWATCH_CLEARING.x,MOSSWATCH_CLEARING.z)).toBe(false);
    for(const p of [...GREENWOOD_CLUSTER_PLANTS, ...GREENWOOD_VERGE_PLANTS]) expect(woodlandPlantAllowed(p.x,p.z)).toBe(true);
    for (const sign of GREENWOOD_MOB_SIGNS.filter(sign => sign.kind === "nest" || sign.kind === "broken-kit"))
      expect(Math.hypot(sign.x-MOSSWATCH_CLEARING.x,sign.z-MOSSWATCH_CLEARING.z)).toBeGreaterThan(MOSSWATCH_CLEARING.radius);
  });
});
