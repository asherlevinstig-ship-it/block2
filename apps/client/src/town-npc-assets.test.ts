import { describe, expect, it } from "vitest";
import * as pc from "playcanvas";
import { vi } from "vitest";
import { bindTownNpcRig, TOWN_NPC_MODEL_FILES, transitionTownNpcRig } from "./town-npc-assets.js";

describe("town NPC assets", () => {
  it("provides an optimized role model for every town occupation", () => {
    expect(Object.keys(TOWN_NPC_MODEL_FILES).sort()).toEqual(["guard", "healer", "resident", "smith", "vendor"]);
    for (const url of Object.values(TOWN_NPC_MODEL_FILES)) {
      expect(url).toMatch(/^\/assets\/kaykit-town-npcs\/[a-z-]+\.glb$/);
    }
  });

  it("binds imported AnimTracks to the modern skeletal animation component", () => {
    let currentTime = 0;
    const layer = {
      states: ["Idle", "Walking_A", "Interact"], activeStateDuration: 2,
      play: vi.fn(), transition: vi.fn(),
      get activeStateCurrentTime() { return currentTime; },
      set activeStateCurrentTime(value: number) { currentTime = value; },
    };
    const anim = { assignAnimation: vi.fn(), baseLayer: layer, playing: false, speed: 1 };
    const entity = {
      anim: undefined,
      addComponent: vi.fn(function (this: { anim?: typeof anim }, kind: string) {
        expect(kind).toBe("anim");
        this.anim = anim;
      }),
    } as unknown as pc.Entity;
    const clips = ["Idle", "Walking_A", "Interact"].map((name, index) => ({
      name: `guard.glb/animation/${index}`, resource: new pc.AnimTrack(name, 2, [], [], []),
    }));

    expect(bindTownNpcRig(entity, clips, "Idle", .4)).toBe(true);
    expect(anim.assignAnimation).toHaveBeenCalledTimes(3);
    expect(anim.assignAnimation).toHaveBeenCalledWith("Walking_A", clips[1]!.resource, undefined, 1, true);
    expect(anim.assignAnimation).toHaveBeenCalledWith("Interact", clips[2]!.resource, undefined, 1, false);
    expect(layer.play).toHaveBeenCalledWith("Idle");
    expect(currentTime).toBe(.8);
    expect(anim.playing).toBe(true);

    expect(transitionTownNpcRig(entity, "Walking_A", .2)).toBe(true);
    expect(layer.transition).toHaveBeenCalledWith("Walking_A", .2);
  });

  it("also accepts unpacked AnimTracks when a loader returns them directly", () => {
    const layer = { states: ["Idle"], activeStateDuration: 1, play: vi.fn(), transition: vi.fn() };
    const anim = { assignAnimation: vi.fn(), baseLayer: layer, playing: false, speed: 1 };
    const entity = {
      anim: undefined,
      addComponent: vi.fn(function (this: { anim?: typeof anim }) { this.anim = anim; }),
    } as unknown as pc.Entity;
    const idle = new pc.AnimTrack("Idle", 1, [], [], []);

    expect(bindTownNpcRig(entity, [idle], "Idle")).toBe(true);
    expect(anim.assignAnimation).toHaveBeenCalledWith("Idle", idle, undefined, 1, true);
  });

  it("keeps the visible fallback when a requested skeletal clip is missing", () => {
    const entity = { addComponent: vi.fn() } as unknown as pc.Entity;
    const clips = [{ name: "Idle", resource: new pc.AnimTrack("Idle", 1, [], [], []) }];
    expect(bindTownNpcRig(entity, clips, "Walking_A")).toBe(false);
    expect(entity.addComponent).not.toHaveBeenCalled();
  });
});
