import { describe, expect, it, vi } from "vitest";
import { WorldRoom } from "../src/game-room.js";
import { lootForArchetype } from "../src/loot-rules.js";
import { MOB_ARCHETYPES, isThornbinder, mobArchetype } from "../src/mob-archetypes.js";
import { PlayerState, WorldState } from "../src/schema.js";
import { GREENWOOD_CAMP_IDS, WILDERNESS_ENCOUNTERS, greenwoodCampAllows, isGreenwoodCampMob } from "../src/wilderness-encounters.js";

describe("Greenwood Thornbinder", () => {
  it("is an authored ranged Greenwood enemy without changing the original three-threat objective", () => {
    const spawn = WILDERNESS_ENCOUNTERS.find(entry => entry.id === "greenwood-thornbinder");
    expect(spawn).toEqual({ id: "greenwood-thornbinder", archetype: "thornbinder", x: 47.5, y: 8, z: 17.5 });
    expect(greenwoodCampAllows(spawn!)).toBe(true);
    expect(isGreenwoodCampMob(spawn!.id)).toBe(true);
    expect(GREENWOOD_CAMP_IDS).toHaveLength(3);
    expect(isThornbinder(spawn!.archetype)).toBe(true);
  });

  it("uses a slow readable single-target casting rhythm and regional loot", () => {
    expect(mobArchetype("thornbinder")).toBe(MOB_ARCHETYPES.thornbinder);
    expect(MOB_ARCHETYPES.thornbinder).toMatchObject({ attackKind: "projectile", damage: 0, windupMs: 1_150, cooldownMs: 3_250 });
    expect(lootForArchetype("thornbinder", "greenwood-thornbinder", 1)).toEqual([{ itemId: "moss_fibre", quantity: 2 }]);
  });

  it("pins a struck player until two weapon cuts break the world binding", () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    const player = new PlayerState(); Object.assign(player, { x: 47.5, y: 8, z: 18.5, health: 5, maxHealth: 5 });
    room.state.players.set("hero", player);
    const events: { type: string; payload: { phase?: string; health?: number } }[] = [];
    vi.spyOn(room, "broadcast").mockImplementation((type: string, payload: unknown) => {
      events.push({ type, payload: payload as { phase?: string; health?: number } });
    });
    const internal = room as any;
    internal.applyThornBinding("greenwood-thornbinder", "hero", 1_000);
    expect(internal.thornBindings.get("hero")).toMatchObject({ health: 2, expiresAt: 4_500 });
    expect(internal.damageThornBinding("hero", "hero")).toBe(true);
    expect(internal.thornBindings.get("hero")?.health).toBe(1);
    expect(internal.damageThornBinding("hero", "ally")).toBe(true);
    expect(internal.thornBindings.has("hero")).toBe(false);
    expect(events.filter(event => event.type === "combat:thorn-binding").map(event => event.payload.phase))
      .toEqual(["applied", "damaged", "broken"]);
  });
});
