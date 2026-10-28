import { describe, expect, it } from "vitest";
import { attackBodyIntersection, mobAttackBody } from "./index.js";

function hit(archetype: string, height: number, x = 0, yaw = 0, id = "test", extra = {}) {
  return attackBodyIntersection({ x, y: height, z: -4 }, { x, y: height, z: 4 },
    { x: 0, y: 0, z: 0, ...mobAttackBody(id, { archetype, yaw, ...extra }) });
}

describe("enemy model body volumes", () => {
  it("hits brute head and broad torso while excluding empty space beside the head", () => {
    expect(hit("stone_brute", 1.85)).not.toBeNull();
    expect(hit("stone_brute", 1.1, .59)).not.toBeNull();
    expect(hit("stone_brute", 1.85, .59)).toBeNull();
    expect(hit("stone_brute", 2.2)).toBeNull();
  });
  it.each(["moss_crawler", "briar_crawler", "cave_spitter", "ridge_stalker", "ember_hound", "fen_bloater"])("requires aiming down at a low %s", kind => {
    expect(hit(kind, .65)).not.toBeNull();
    expect(hit(kind, 1.48)).toBeNull();
  });
  it("uses the same champion, elite and Guardian scale as the visible body", () => {
    expect(hit("stone_brute", 2.3)).toBeNull();
    expect(hit("stone_brute", 2.3, 0, 0, "champion", { isChampion: true })).not.toBeNull();
    expect(hit("stone_brute", 2.6, 0, 0, "forest-guardian")).not.toBeNull();
    expect(hit("moss_crawler", 1, 0, 0, "elite", { isElite: true })).not.toBeNull();
  });
  it("rotates the ram's long body with its facing", () => {
    expect(hit("cinder_ram", .82, 1.2, 0)).toBeNull();
    expect(hit("cinder_ram", .82, 1.2, 90)).not.toBeNull();
    expect(hit("cinder_ram", .82, 1.5, 90)).toBeNull();
  });
  it("includes the Matriarch's scaled venom reservoir but excludes empty space above it", () => {
    expect(hit("cave_spitter", 1.75, 0, 0, "crystal-matriarch")).not.toBeNull();
    expect(hit("cave_spitter", 2.2, 0, 0, "crystal-matriarch")).toBeNull();
  });
  it("finds the nearest of multiple body parts and keeps player defaults unchanged", () => {
    expect(hit("stone_brute", 1.4)).toBeGreaterThan(0);
    expect(attackBodyIntersection({ x: 0, y: 1.48, z: -4 }, { x: 0, y: 1.48, z: 4 }, { x: 0, y: 0, z: 0 })).toBeNull();
  });
});
