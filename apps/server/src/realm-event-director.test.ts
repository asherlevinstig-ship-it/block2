import { describe, expect, it } from "vitest";
import { RealmEventDirector, REALM_BOSS_RETRY_MS, REALM_EVENT_DEFINITIONS, realmEventScale } from "./realm-event-director.js";

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

  it("turns every two elite victories into one Realm Threat pip", () => {
    const director = new RealmEventDirector();
    expect(director.recordElite(1_000)).toMatchObject({ bossArmed: false, eliteKills: 1, eliteRequired: 2 });
    expect(director.recordElite(2_000)).toMatchObject({ bossArmed: false, eliteKills: 0 });
    expect(director.status(2_000)).toMatchObject({ completed: 1, eliteKills: 0, eliteRequired: 2 });
    director.recordElite(3_000); director.recordElite(4_000); director.recordElite(5_000);
    expect(director.recordElite(6_000).bossArmed).toBe(true);
    expect(director.status(6_000)).toMatchObject({ phase: "warning", eventId: "realm-stone-warden", completed: 3 });
  });

  it("credits each distinct area leader once and awakens the realm boss after three", () => {
    const director = new RealmEventDirector();
    expect(director.recordLeader("mossback", 1_000)).toEqual({ credited: true, bossArmed: false, completed: 1, required: 3 });
    expect(director.recordLeader("mossback", 2_000)).toEqual({ credited: false, bossArmed: false, completed: 1, required: 3 });
    expect(director.recordLeader("stonehide", 3_000).completed).toBe(2);
    expect(director.recordLeader("silverfang", 4_000)).toEqual({ credited: true, bossArmed: true, completed: 3, required: 3 });
    expect(director.status(4_000)).toMatchObject({ phase: "warning", eventId: "realm-stone-warden", realmBoss: true });
  });

  it("re-arms an abandoned realm boss without consuming threat progress", () => {
    const director = new RealmEventDirector();
    director.recordLeader("one", 1_000); director.recordLeader("two", 1_001); director.recordLeader("three", 1_002);
    const warning = director.status(1_002);
    director.release(warning.warningUntil);
    expect(director.abandon("realm-stone-warden", warning.warningUntil + 1)?.realmBoss).toBe(true);
    expect(director.status(warning.warningUntil + 1)).toMatchObject({ phase: "cooldown", completed: 3 });
    expect(director.status(warning.warningUntil + REALM_BOSS_RETRY_MS + 1)).toMatchObject({
      phase: "warning", eventId: "realm-stone-warden", completed: 3,
    });
  });

  it("assigns personal signature gear to every public boss", () => {
    expect(REALM_EVENT_DEFINITIONS.map(event => [event.key, event.signatureRewards])).toEqual([
      ["greenwood", ["venom_focus"]],
      ["stoneheart", ["stone_core_hammer"]],
      ["ashglass", ["echo_prism"]],
      ["realm-warden", ["rootbound_hammer", "rootguard_armour"]],
    ]);
  });
});
