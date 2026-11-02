import { describe, expect, it } from "vitest";
import { receiveTownHealerCare } from "./town-healer.js";

describe("Lyra's Town healer service", () => {
  it("restores health and stamina without changing progression", () => {
    const player = { health: 2, maxHealth: 8, stamina: 17, maxStamina: 110 };
    const update = receiveTownHealerCare(player, "tank");
    expect(player).toEqual({ health: 8, maxHealth: 8, stamina: 110, maxStamina: 110 });
    expect(update).toMatchObject({ ok: true, health: 8, stamina: 110 });
    expect(update.message).toContain("Recovered 6 HP and 93 stamina");
  });

  it("teaches Healers their three distinct jobs and exposes practice", () => {
    const update = receiveTownHealerCare({ health: 5, maxHealth: 5, stamina: 100, maxStamina: 100 }, "healer");
    expect(update.practiceCalling).toBe("healer");
    expect(update.message).toContain("Field Mend");
    expect(update.message).toContain("Renewal");
    expect(update.message).toContain("Resurrection");
    expect(update.message).toContain("2.5 second");
  });
});

