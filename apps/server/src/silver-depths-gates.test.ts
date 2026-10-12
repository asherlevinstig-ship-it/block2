import { describe, expect, it, vi } from "vitest";
import { SILVER_DEPTHS_GALLERY_GATE, SILVER_DEPTHS_IRON_GATE } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { WorldState } from "./schema.js";

describe("Silver Depths gate map updates", () => {
  it("broadcasts authoritative gate states when the wing and gallery open", () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any;
    internal.roomKind = "silver-depths";
    const broadcast = vi.spyOn(room, "broadcast").mockImplementation(() => {});
    internal.setSilverDepthsWingGate(SILVER_DEPTHS_IRON_GATE, true, "iron-wing-gate");
    expect(broadcast).toHaveBeenCalledWith("depths:gates", {
      seal: false, iron: true, silver: false, gallery: false, boss: false,
    });
    internal.setSilverDepthsGate(SILVER_DEPTHS_GALLERY_GATE, true, "gallery-gate");
    expect(broadcast).toHaveBeenCalledWith("depths:gates", {
      seal: false, iron: true, silver: false, gallery: true, boss: false,
    });
    internal.setSilverDepthsWingGate(SILVER_DEPTHS_IRON_GATE, false, "iron-wing-gate");
    expect(internal.silverDepthsGates).toMatchObject({ iron: false, gallery: true });
  });
});
