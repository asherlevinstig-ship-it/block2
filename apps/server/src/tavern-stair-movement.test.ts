import { describe, expect, it } from "vitest";
import { tavernRoomFurnitureCellSolid } from "@blockcraft/protocol";
import { Block, resolvePlayerMotion } from "@blockcraft/voxel-world";

const readTavernBlock = (x: number, y: number, z: number) =>
  y < 8 || tavernRoomFurnitureCellSolid(x, y, z) ? Block.Stone : Block.Air;

describe("tavern guest-room staircase", () => {
  it("lets the shared movement solver walk continuously onto the upper landing", () => {
    let position = { x: 6.5, y: 8, z: 7.65 };
    let steps = 0;
    for (let index = 0; index < 78; index++) {
      const next = resolvePlayerMotion(position, { x: 0, y: 0, z: -.1 }, readTavernBlock);
      if (next.stepped) steps++;
      position = next;
    }
    expect(position.z).toBeLessThan(.2);
    expect(position.y).toBe(15);
    expect(steps).toBe(7);
  });
});
