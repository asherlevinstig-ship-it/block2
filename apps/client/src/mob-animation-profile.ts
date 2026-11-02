export type MobBodyMotion = {
  x: number;
  y: number;
  z: number;
  pitch: number;
  roll: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
};

const still: MobBodyMotion = { x: 0, y: 0, z: 0, pitch: 0, roll: 0, scaleX: 1, scaleY: 1, scaleZ: 1 };

/** Art-only secondary motion. Server position, collision and attack clocks remain authoritative. */
export function mobBodyMotionProfile(archetype: string, mobId: string, phase: number, walk: number,
  pursuit: number, windup: number, attack: number, recovery: number, time: number): MobBodyMotion {
  const step = Math.sin(phase), planted = Math.abs(Math.sin(phase)), stride = walk * (1 + pursuit * .16);

  if (mobId === "floor2-forgeheart") return {
    x: step * stride * .018,
    y: planted * stride * .034 - recovery * .13,
    z: attack * .5 - windup * .3,
    pitch: -windup * 16 + attack * 25 + recovery * 17,
    roll: step * stride * 2.4,
    scaleX: 1 + windup * .09 + attack * .05,
    scaleY: 1 - windup * .09 - attack * .07,
    scaleZ: 1 + attack * .12,
  };
  if (mobId === "floor1-crownkeeper") return {
    x: step * stride * .025,
    y: planted * stride * .026 - recovery * .09,
    z: attack * .46 - windup * .2,
    pitch: -windup * 11 + attack * 21 + recovery * 12,
    roll: step * stride * 3.2 + windup * 2,
    scaleX: 1 + windup * .045,
    scaleY: 1 - attack * .045,
    scaleZ: 1 + attack * .1,
  };
  if (archetype === "cinder_ram") {
    const gallop = Math.max(0, Math.sin(phase * 2));
    return {
      x: step * stride * .02,
      y: gallop * stride * .075 - windup * .08 + attack * .11,
      z: attack * .38 - windup * .24,
      pitch: step * stride * 4 + windup * 12 - attack * 17 + recovery * 8,
      roll: step * stride * 2.2,
      scaleX: 1 + windup * .08 - attack * .03,
      scaleY: 1 - windup * .12 + attack * .04,
      scaleZ: 1 + attack * .14,
    };
  }
  if (archetype === "ember_hound" || archetype === "ridge_stalker") {
    const bound = Math.max(0, Math.sin(phase * .5));
    return {
      x: step * stride * .018,
      y: bound * stride * .095 - windup * .09 + attack * .14,
      z: attack * .34 - windup * .16,
      pitch: step * stride * 5 + windup * 9 - attack * 15 + recovery * 6,
      roll: step * stride * 2.6,
      scaleX: 1 - attack * .025,
      scaleY: 1 - windup * .08 + attack * .05,
      scaleZ: 1 + attack * .12,
    };
  }
  if (archetype === "stone_brute") return {
    x: step * stride * .025,
    y: planted * stride * .042 - windup * .035 - recovery * .09,
    z: attack * .42 - windup * .23,
    pitch: -windup * 12 + attack * 19 + recovery * 14,
    roll: step * stride * 3.4,
    scaleX: 1 + windup * .065 + attack * .04,
    scaleY: 1 - attack * .08,
    scaleZ: 1 + attack * .07,
  };
  if (archetype === "shard_sentry") return {
    x: step * stride * .035,
    y: Math.sin(time * 2.8) * .055 + planted * stride * .018 + windup * .035,
    z: -attack * .2 - windup * .08,
    pitch: windup * 7 - attack * 13,
    roll: step * stride * 5 + Math.sin(time * 1.7) * 1.5,
    scaleX: 1 + windup * .045,
    scaleY: 1 + windup * .08 - attack * .04,
    scaleZ: 1 + windup * .045,
  };
  if (archetype === "fen_bloater") return {
    x: step * stride * .022,
    y: planted * stride * .05 - windup * .07 + attack * .04,
    z: -attack * .22 - windup * .1,
    pitch: windup * 10 - attack * 16 + recovery * 8,
    roll: step * stride * 4.5,
    scaleX: 1 + windup * .13 + planted * stride * .025,
    scaleY: 1 - windup * .11 - planted * stride * .02,
    scaleZ: 1 + windup * .1,
  };
  return { ...still, y: planted * stride * .018, roll: step * stride * 1.3 };
}
