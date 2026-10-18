import { describe, expect, it } from "vitest";
import { selectWarbandTargets, warbandChallengeTargets } from "./warband-targeting.js";

describe("mixed warband role targeting", () => {
  const party = [
    { id: "tank", x: 0, z: 0, mainHandId: "longsword" },
    { id: "healer", x: 1, z: 0, mainHandId: "magic_focus" },
    { id: "ranger", x: 9, z: 0, mainHandId: "bow" },
  ];

  it("keeps the brute on the frontline while the crawler hunts an isolated ranged player", () => {
    const plan = selectWarbandTargets(party, "tank")!;
    expect(plan.brute.id).toBe("tank");
    expect(plan.crawler.id).toBe("ranger");
    expect(plan.spitter.id).toBe("healer");
  });

  it("respects an authoritative taunt or decoy override for the crawler", () => {
    expect(selectWarbandTargets(party, "tank", "healer")!.crawler.id).toBe("healer");
  });

  it("keeps the fixed solo encounter intact", () => {
    const plan = selectWarbandTargets([party[0]!], "tank")!;
    expect(new Set([plan.brute.id, plan.crawler.id, plan.spitter.id])).toEqual(new Set(["tank"]));
  });

  it("lets Challenge pull a nearby brute without collapsing specialist escort roles", () => {
    const targets = warbandChallengeTargets([
      { id: "brute", isLeader: true },
      { id: "crawler", leaderId: "brute" },
      { id: "spitter", leaderId: "brute" },
      { id: "stray" },
    ]);
    expect(targets.map(target => target.id)).toEqual(["brute", "stray"]);
  });

  it("still challenges an escort when its leader is outside the ability radius", () => {
    expect(warbandChallengeTargets([{ id: "crawler", leaderId: "distant-brute" }])).toHaveLength(1);
  });
});
