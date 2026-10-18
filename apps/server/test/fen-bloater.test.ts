import { describe, expect, it, vi } from "vitest";
import { WorldRoom } from "../src/game-room.js";
import { lootForArchetype } from "../src/loot-rules.js";
import { MOB_ARCHETYPES, mobArchetype } from "../src/mob-archetypes.js";
import { WorldState } from "../src/schema.js";
import { MISTFEN_IDS, WILDERNESS_ENCOUNTERS, isMistfenMob, mistfenAllows } from "../src/wilderness-encounters.js";

describe("Mistfen Fen Bloater", () => {
  it("is an authored Mistfen enemy without changing the original regional objective", () => {
    const spawn = WILDERNESS_ENCOUNTERS.find(entry => entry.id === "mistfen-bloater");
    expect(spawn).toEqual({ id: "mistfen-bloater", archetype: "fen_bloater", x: -36.5, y: 8, z: -34.5 });
    expect(mistfenAllows(spawn!)).toBe(true);
    expect(isMistfenMob(spawn!.id)).toBe(true);
    expect(MISTFEN_IDS).toHaveLength(4);
  });

  it("uses a slow radial casting rhythm and drops extra Mistfen materials", () => {
    expect(mobArchetype("fen_bloater")).toBe(MOB_ARCHETYPES.fen_bloater);
    expect(MOB_ARCHETYPES.fen_bloater).toMatchObject({
      attackKind: "melee", speed: .68, windupMs: 2_000, cooldownMs: 5_200,
      hazardDurationMs: 5_500, hazardRadius: 3.4, respawnMs: 45_000,
    });
    expect(lootForArchetype("fen_bloater", "mistfen-bloater", 1)).toEqual([
      { itemId: "acid_gland", quantity: 2 },
      { itemId: "moss_fibre", quantity: 1 },
    ]);
  });

  it("interrupts after two gland strikes or leaves an authoritative toxic cloud", () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    const events: { type: string; payload: Record<string, unknown> }[] = [];
    vi.spyOn(room, "broadcast").mockImplementation((type: string, payload: unknown) => {
      events.push({ type, payload: payload as Record<string, unknown> });
    });
    const internal = room as any;
    const definition = MOB_ARCHETYPES.fen_bloater;
    internal.registerMob("mistfen-bloater", "fen_bloater", definition.spawn);
    const bloater = room.state.mobs.get("mistfen-bloater")!;
    Object.assign(bloater, { combatState: "windup", attackPattern: "toxic-bloom", stateUntil: 12_000 });
    internal.fenBloaterGlandHits.set("mistfen-bloater", { hits: 0, expiresAt: 12_000 });

    expect(internal.strikeFenBloaterGland("mistfen-bloater", bloater, "hero", 10_000)).toBe(true);
    expect(bloater.combatState).toBe("windup");
    expect(internal.fenBloaterGlandHits.get("mistfen-bloater")?.hits).toBe(1);
    expect(internal.strikeFenBloaterGland("mistfen-bloater", bloater, "hero", 10_100)).toBe(true);
    expect(bloater.combatState).toBe("stagger");
    expect(bloater.stateUntil).toBe(12_700);
    expect(internal.fenBloaterGlandHits.has("mistfen-bloater")).toBe(false);
    expect(events.filter(event => event.type === "combat:bloater-gland").map(event => event.payload.interrupted))
      .toEqual([false, true]);

    Object.assign(bloater, { alive: true, health: definition.maxHealth, combatState: "idle", actionSequence: 3 });
    internal.placeFenBloaterCloud("mistfen-bloater", bloater, 20_000);
    const cloud = [...internal.mobHazards.values()].find((hazard: { mobId: string }) => hazard.mobId === "mistfen-bloater");
    expect(cloud).toMatchObject({ radius: 3.4, expiresAt: 25_500, nextDamageAt: 20_650 });
    expect(events.find(event => event.type === "combat:mob-hazard")?.payload.kind).toBe("toxic-cloud");
  });
});
