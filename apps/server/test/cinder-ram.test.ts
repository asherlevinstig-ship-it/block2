import { describe, expect, it, vi } from "vitest";
import { CINDER_RAM_CHARGE, crawlerRushDistance } from "@blockcraft/protocol";
import { Block } from "@blockcraft/voxel-world";
import { WorldRoom } from "../src/game-room.js";
import { lootForArchetype } from "../src/loot-rules.js";
import { MOB_ARCHETYPES, mobArchetype } from "../src/mob-archetypes.js";
import { PlayerState, WorldState } from "../src/schema.js";
import { ASHEN_COMBAT_GROUP_IDS, ASHEN_HOUND_IDS, ASHEN_SENTRY_IDS, WILDERNESS_ENCOUNTERS, ashenSentryAllows, isAshenMob } from "../src/wilderness-encounters.js";

describe("Ashen Reach Cinder Ram", () => {
  it("is an authored Ashen enemy without changing the two-sentry objective", () => {
    const spawn = WILDERNESS_ENCOUNTERS.find(entry => entry.id === "ashen-cinder-ram");
    expect(spawn).toEqual({ id: "ashen-cinder-ram", archetype: "cinder_ram", x: 103.5, y: 8, z: 52.5 });
    expect(ashenSentryAllows(spawn!)).toBe(true);
    expect(isAshenMob(spawn!.id)).toBe(true);
    expect(ASHEN_SENTRY_IDS).toHaveLength(2);
    expect(ASHEN_HOUND_IDS).toHaveLength(2);
    expect(ASHEN_COMBAT_GROUP_IDS).toHaveLength(5);
    expect(WILDERNESS_ENCOUNTERS.filter(entry => ASHEN_HOUND_IDS.some(id => id === entry.id))).toEqual([
      { id: "ashen-ember-hound-west", archetype: "ember_hound", x: 99.5, y: 8, z: 55.5 },
      { id: "ashen-ember-hound-east", archetype: "ember_hound", x: 107.5, y: 8, z: 56.5 },
    ]);
  });

  it("uses a fixed long charge and drops valuable scorched materials", () => {
    expect(mobArchetype("cinder_ram")).toBe(MOB_ARCHETYPES.cinder_ram);
    expect(MOB_ARCHETYPES.cinder_ram).toMatchObject({
      maxHealth: 18, armor: 1, speed: 1.05, windupMs: 1_600,
      cooldownMs: 4_800, respawnMs: 50_000,
    });
    expect(CINDER_RAM_CHARGE).toMatchObject({ distance: 7.2, durationMs: 950, recoveryMs: 3_000 });
    expect(lootForArchetype("cinder_ram", "ashen-cinder-ram", 1)).toEqual([
      { itemId: "ember_ore", quantity: 2 },
      { itemId: "stone_core", quantity: 1 },
    ]);
  });

  it("uses fast opposite-flank hounds with smaller rewards than the Ram", () => {
    expect(MOB_ARCHETYPES.ember_hound).toMatchObject({ maxHealth: 8, speed: 2.25, damage: 1, respawnMs: 45_000 });
    expect(crawlerRushDistance("ember_hound")).toBe(2.05);
    expect(lootForArchetype("ember_hound", ASHEN_HOUND_IDS[0], 1)).toEqual([
      { itemId: "ember_ore", quantity: 1 },
    ]);
  });

  it("rallies every surviving Ashen group member when one detects a player", () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any;
    Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
    for (const spawn of WILDERNESS_ENCOUNTERS.filter(entry => isAshenMob(entry.id)))
      internal.registerMob(spawn.id, spawn.archetype, spawn);
    const player = new PlayerState(); Object.assign(player, { x: 103.5, y: 8, z: 54.5, health: 5 });
    room.state.players.set("hero", player);

    internal.rallyAshenCombatGroup("ashen-cinder-ram", "hero", 10_000);

    for (const id of ASHEN_COMBAT_GROUP_IDS.filter(id => id !== "ashen-cinder-ram")) {
      expect(internal.mobAwareness.get(id)?.targetId).toBe("hero");
      expect(room.state.mobs.get(id)?.awarenessState).toBe("engaged");
    }
  });

  it("exposes its vents and leaves fire when terrain stops its charge", () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    const events: { type: string; payload: Record<string, unknown> }[] = [];
    vi.spyOn(room, "broadcast").mockImplementation((type: string, payload: unknown) => {
      events.push({ type, payload: payload as Record<string, unknown> });
    });
    const internal = room as any;
    internal.registerMob("ashen-cinder-ram", "cinder_ram", { x: 103.5, y: 8, z: 52.5 });
    const ram = room.state.mobs.get("ashen-cinder-ram")!;
    Object.assign(ram, { x: 103.5, y: 8, z: 52.5, yaw: 0, combatState: "strike", attackPattern: "furnace-charge", actionSequence: 2 });
    Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number, z: number) =>
      y <= 7 || Math.floor(z) === 55 && y <= 10 ? Block.Stone : Block.Air });
    internal.championCharges.set("ashen-cinder-ram", { yaw: 0, startedAt: 1_000, progress: 0, hit: new Set() });

    internal.advanceChampionCharges(1_950);

    expect(ram.combatState).toBe("recover");
    expect(ram.stateUntil).toBe(4_950);
    expect(internal.cinderRamExposedUntil.get("ashen-cinder-ram")).toBe(4_950);
    expect(events).toContainEqual({ type: "combat:cinder-impact", payload: expect.objectContaining({ phase: "impact", durationMs: 3_000 }) });
    expect(events.some(event => event.type === "combat:mob-hazard" && event.payload.kind === "fire-trail")).toBe(true);
    expect([...internal.mobHazards.values()]).toEqual(expect.arrayContaining([
      expect.objectContaining({ mobId: "ashen-cinder-ram", radius: .72, damage: 1 }),
    ]));
  });

  it("reduces frontal damage but rewards attacks on exposed vents", () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    vi.spyOn(room, "broadcast").mockImplementation(() => room as any);
    const internal = room as any;
    internal.registerMob("ashen-cinder-ram", "cinder_ram", { x: 103.5, y: 8, z: 52.5 });
    const ram = room.state.mobs.get("ashen-cinder-ram")!;
    Object.assign(ram, { health: 100, maxHealth: 100, armor: 0, yaw: 0, combatState: "idle" });
    const player = new PlayerState(); Object.assign(player, { x: ram.x, y: ram.y, z: ram.z + 1 });
    room.state.players.set("hero", player);

    internal.applyWeaponHit("hero", { mainHandId: "stone_core_hammer", step: 3 }, "ashen-cinder-ram", 10_000);
    const frontalDamage = 100 - ram.health;
    Object.assign(ram, { health: 100, combatState: "idle" }); player.z = ram.z - 1;
    internal.applyWeaponHit("hero", { mainHandId: "stone_core_hammer", step: 3 }, "ashen-cinder-ram", 10_100);
    const rearDamage = 100 - ram.health;
    Object.assign(ram, { health: 100, combatState: "recover" }); player.z = ram.z + 1;
    internal.cinderRamExposedUntil.set("ashen-cinder-ram", 13_200);
    internal.applyWeaponHit("hero", { mainHandId: "stone_core_hammer", step: 3 }, "ashen-cinder-ram", 10_200);
    const exposedDamage = 100 - ram.health;

    expect(frontalDamage).toBeLessThan(rearDamage);
    expect(exposedDamage).toBe(rearDamage + 2);
  });
});
