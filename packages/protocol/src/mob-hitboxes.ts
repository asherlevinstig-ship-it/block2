import type { AttackBodyBox } from "./first-person-aim.js";

type MobBody = { archetype: string; yaw?: number; isChampion?: boolean; isMiniBoss?: boolean; isElite?: boolean };
// Local-space core volumes measured from mob-art.ts. Antennae, horns, tails and
// animated extremities deliberately do not enlarge the entire hurt volume.
const box = (x: number, y: number, z: number, width: number, height: number, depth: number): AttackBodyBox =>
  ({ x, y, z, width, height, depth });
const crawler = [box(0, .57, -.1, .9, .72, 1.05), box(0, .55, .57, .65, .48, .58)];
const hound = [box(0, .65, -.14, .62, .65, 1.24), box(0, .84, .23, .78, .6, .5), box(0, .69, .7, .57, .42, .8)];
export const MOB_BODY_BOXES: Readonly<Record<string, readonly AttackBodyBox[]>> = {
  moss_crawler: crawler, briar_crawler: crawler,
  stone_brute: [box(0, .85, 0, 1.22, 1.25, .84), box(0, 1.62, .06, .76, .65, .68)],
  cave_spitter: [box(0, .48, -.16, .92, .58, 1.13), box(0, .62, .65, .8, .5, .64), box(0, .73, -.4, 1.04, .4, .46)],
  ridge_stalker: hound, ember_hound: hound,
  shard_sentry: [box(0, 1.04, 0, .9, .85, .9), box(0, 1.43, .08, .7, .44, .65)],
  thornbinder: [box(0, 1.02, 0, .7, 1.25, .56), box(0, 1.5, -.04, .9, .3, .68), box(0, 1.72, .08, .62, .56, .47)],
  fen_bloater: [box(0, .7, -.08, 1.28, .86, 1.34), box(0, .76, .66, 1.08, .52, .72)],
  cinder_ram: [box(0, .82, -.18, 1.16, .8, 1.72), box(0, 1.02, .44, 1.38, .65, .74), box(0, .95, .96, 1.02, .6, .78)],
};

export function mobBodyScale(id: string, mob: MobBody): number {
  return id === "forest-guardian" ? 1.38 : mob.isChampion ? 1.25 : mob.isMiniBoss ? 1.18 : mob.isElite ? 1.12 : 1;
}

const scaledBodies = new Map<string, readonly AttackBodyBox[]>();

/** Shared by crosshair selection and authority; schema fields are read explicitly. */
export function mobAttackBody(id: string, mob: MobBody) {
  const matriarch = id === "greenwood-venom-matriarch" || id === "crystal-matriarch";
  const scale = mobBodyScale(id, mob);
  const [sx, sy, sz] = matriarch ? [1.55, 1.45, 1.7] : [scale, scale, scale];
  const key = `${mob.archetype}:${matriarch ? "matriarch" : scale}`;
  let body = scaledBodies.get(key);
  if (!body) {
    const boxes = MOB_BODY_BOXES[mob.archetype] ?? crawler;
    body = (matriarch ? [...boxes, box(0, 1.05, -.36, .65, .62, .82)] : boxes)
      .map(b => box(b.x * sx!, b.y * sy!, b.z * sz!, b.width * sx!, b.height * sy!, b.depth * sz!));
    scaledBodies.set(key, body);
  }
  return { body, yaw: mob.yaw ?? 0 };
}
