export type MobMidDetailPart = {
  name: string;
  size: readonly [number, number, number];
  at: readonly [number, number, number];
  angle?: readonly [number, number, number];
};

/**
 * Three strong masses preserve the creature's silhouette at middle distance.
 * Fine limbs, eyes and accessories remain exclusive to the close combat rig.
 */
export function mobMidDetailParts(archetype: string): readonly MobMidDetailPart[] {
  if (archetype === "stone_brute") return [
    { name: "brute-torso", size: [1.18, 1.45, .92], at: [0, .84, 0] },
    { name: "brute-shoulders", size: [1.56, .36, .84], at: [0, 1.38, .02] },
    { name: "brute-head", size: [.76, .58, .68], at: [0, 1.83, .16] },
  ];
  if (archetype === "cinder_ram") return [
    { name: "ram-body", size: [1.2, .82, 1.62], at: [0, .72, -.18] },
    { name: "ram-shoulders", size: [1.36, .52, .75], at: [0, 1.02, .42], angle: [-8, 0, 0] },
    { name: "ram-head", size: [.86, .63, .78], at: [0, .96, 1.02] },
  ];
  if (archetype === "fen_bloater") return [
    { name: "bloater-body", size: [1.28, .84, 1.34], at: [0, .7, -.08] },
    { name: "bloater-belly", size: [1.02, .44, 1.03], at: [0, .4, .13] },
    { name: "bloater-head", size: [1.02, .48, .68], at: [0, .78, .73] },
  ];
  if (archetype === "thornbinder") return [
    { name: "thorn-trunk", size: [.68, 1.28, .54], at: [0, 1.02, 0], angle: [0, 0, -4] },
    { name: "thorn-mantle", size: [.95, .3, .7], at: [0, 1.52, -.04], angle: [-8, 0, 0] },
    { name: "thorn-mask", size: [.58, .56, .46], at: [0, 1.78, .08] },
  ];
  if (archetype === "cave_spitter" || archetype === "shard_sentry") return [
    { name: "spitter-body", size: [1.04, .7, 1.16], at: [0, .58, -.06] },
    { name: "spitter-shell", size: [.88, .28, .78], at: [0, .93, -.16], angle: [-8, 0, 0] },
    { name: "spitter-head", size: [.72, .43, .67], at: [0, .6, .7] },
  ];
  if (archetype === "ridge_stalker" || archetype === "ember_hound") return [
    { name: "stalker-body", size: [.68, .56, 1.28], at: [0, .62, -.15] },
    { name: "stalker-mane", size: [.82, .62, .56], at: [0, .82, .34], angle: [-10, 0, 0] },
    { name: "stalker-head", size: [.58, .42, .58], at: [0, .72, .78] },
  ];
  return [
    { name: "crawler-body", size: [.76, .58, 1.12], at: [0, .55, -.08] },
    { name: "crawler-shell", size: [.84, .28, .72], at: [0, .82, -.16], angle: [-8, 0, 0] },
    { name: "crawler-head", size: [.58, .4, .55], at: [0, .58, .64] },
  ];
}
