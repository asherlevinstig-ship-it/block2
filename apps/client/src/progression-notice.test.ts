import { describe, expect, it } from "vitest";
import { progressionNotice } from "./progression-notice.js";

const base = {
  level: 4, unspentPoints: 0, statDismissed: false, hasCalling: true, canChooseCalling: true,
  callingDismissed: false, newAbilityNames: [] as string[], equipDismissed: false,
  equippedAbilityName: "Vanish", equippedAbilityUsed: true, useDismissed: false,
};

describe("progression notice priority", () => {
  it("puts new abilities ahead of stat points without losing the stat action", () => {
    const input = { ...base, unspentPoints: 1, newAbilityNames: ["Blade Dance"] };
    expect(progressionNotice(input)?.action).toBe("OPEN KIT TO EQUIP");
    expect(progressionNotice({ ...input, equipDismissed: true })?.action).toBe("SPEND POINT");
  });

  it("names the exact G-slot actions", () => {
    expect(progressionNotice({ ...base, newAbilityNames: ["Blade Dance"] }))
      .toMatchObject({ kind: "equip", action: "OPEN KIT TO EQUIP", title: "Blade Dance unlocked" });
    expect(progressionNotice({ ...base, equippedAbilityUsed: false }))
      .toMatchObject({ kind: "use", action: "PRESS G TO USE", title: "Vanish equipped" });
  });

  it("offers the first Calling wherever the server permits it", () => {
    expect(progressionNotice({ ...base, hasCalling: false, canChooseCalling: true })?.action).toBe("CHOOSE CALLING");
    expect(progressionNotice({ ...base, hasCalling: false, canChooseCalling: false })?.action).toBe("RETURN TO SURFACE");
  });
});
