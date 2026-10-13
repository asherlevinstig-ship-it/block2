import { describe, expect, it } from "vitest";
import { RealmEventDirector, REALM_EVENT_DEFINITIONS, realmEventScale } from "./realm-event-director.js";

const clear = (director: RealmEventDirector, ids: readonly string[], now: number) => {
  let armed = null;
  for (const id of ids) armed = director.recordTrigger(id, now, false) ?? armed;
  return armed;
};

describe("Realm-style encounter director", () => {
  it("arms regional events from local encounter clears", () => {
    const director = new RealmEventDirector();
    const greenwood = REALM_EVENT_DEFINITIONS.find(event => event.key === "greenwood")!;
    expect(clear(director, greenwood.triggerIds, 1_000)?.id).toBe(greenwood.id);
    expect(director.status(1_000)).toMatchObject({ phase: "warning", completed: 0, required: 3, realmBoss: false });
    expect(director.release(8_999)).toBeNull();
    expect(director.release(9_000)?.id).toBe(greenwood.id);
  });

  it("escalates three distinct regional victories into a realm boss and resets after victory", () => {
    const director = new RealmEventDirector();
    let now = 1_000;
    for (const key of ["greenwood", "stoneheart", "ashglass"] as const) {
      const event = REALM_EVENT_DEFINITIONS.find(candidate => candidate.key === key)!;
      expect(clear(director, event.triggerIds, now)?.key).toBe(key);
      director.release(now + 8_000);
      const result = director.complete(event.id, now + 8_001)!;
      now += 53_002;
      if (key !== "ashglass") expect(director.status(now).completed).toBeGreaterThan(0);
      else expect(result.realmBossArmed).toBe(true);
    }
    const warning = director.status(now);
    expect(warning).toMatchObject({ phase: "warning", eventId: "realm-stone-warden", completed: 3, realmBoss: true });
    director.release(warning.warningUntil);
    expect(director.complete("realm-stone-warden", warning.warningUntil + 1)?.realmCleared).toBe(true);
    expect(director.status(warning.warningUntil + 1)).toMatchObject({ phase: "cooldown", completed: 0, realmBoss: false });
  });

  it("caps multiplayer scaling", () => {
    const boss = REALM_EVENT_DEFINITIONS.find(event => event.realmBoss)!;
    expect(realmEventScale(20, boss)).toEqual({ players: 6, maxHealth: 164, attackDamage: 3, rewardMultiplier: 3.75 });
  });
});
