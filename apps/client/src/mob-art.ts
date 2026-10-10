import * as pc from "playcanvas";

type MobKind = "stone_brute" | "cave_spitter" | "moss_crawler";
type Triple = [number, number, number];

interface Limb {
  pivot: pc.Entity;
  knee: pc.Entity | null;
  side: number;
  offset: number;
}

/** Art-only rig: the authoritative mob's transform and combat clock stay outside it. */
export interface MobArtRig {
  kind: MobKind;
  head: pc.Entity;
  jaw: pc.Entity;
  limbs: Limb[];
  arms: Limb[];
  sacs: pc.Entity[];
  phase: number;
  walk: number;
  matriarch: boolean;
  phaseSurfaces: pc.Entity[];
  enraged: boolean;
  defeated: boolean;
  glowSurfaces: { part: pc.Entity; liveMaterial: pc.StandardMaterial }[];
}

function material(name: string, color: Triple, glow?: Triple): pc.StandardMaterial {
  const result = new pc.StandardMaterial();
  result.name = name;
  result.diffuse.set(...color);
  result.shininess = 14;
  result.specular.set(0.12, 0.13, 0.14);
  if (glow) result.emissive.set(...glow);
  result.update();
  return result;
}

// Shared non-flashing surfaces avoid multiplying materials for each enemy.
const shellDark = material("crawler-bark", [0.14, 0.23, 0.18]);
const shellLight = material("crawler-moss", [0.42, 0.59, 0.24]);
const mossTip = material("crawler-lichen", [0.66, 0.72, 0.34]);
const ivory = material("creature-ivory", [0.84, 0.78, 0.57]);
const crawlerEye = material("crawler-amber-eyes", [1, 0.64, 0.16], [0.5, 0.2, 0.025]);
const rockDark = material("brute-rock-shadow", [0.23, 0.27, 0.32]);
const rockLight = material("brute-rock-edge", [0.52, 0.56, 0.6]);
const rockMoss = material("brute-lichen", [0.36, 0.45, 0.34]);
const core = material("brute-amber-core", [1, 0.62, 0.18], [0.9, 0.32, 0.035]);
const spitterDark = material("spitter-carapace", [0.2, 0.18, 0.29]);
const spitterLight = material("spitter-shell-edge", [0.47, 0.39, 0.58]);
const acid = material("spitter-acid-sacs", [0.63, 0.85, 0.24], [0.19, 0.3, 0.025]);
const mouth = material("creature-mouth", [0.085, 0.06, 0.1]);
const matriarchVenom = material("matriarch-jade-venom", [.2, .95, .65], [.08, .5, .25]);
const matriarchEnragedVenom = material("matriarch-enraged-venom", [1, .35, .12], [.65, .12, .025]);
const matriarchArmour = material("matriarch-dark-jade-armour", [.12, .28, .26]);
const dimGlowMaterials = new Map<pc.StandardMaterial, pc.StandardMaterial>([core, acid, crawlerEye, matriarchVenom, matriarchEnragedVenom]
  .map(live => [live, material(`defeated-${live.name}`, [live.diffuse.r * .5, live.diffuse.g * .5, live.diffuse.b * .5])]));

function box(parent: pc.Entity, name: string, surface: pc.StandardMaterial, size: Triple, at: Triple, angle?: Triple): pc.Entity {
  const result = new pc.Entity(name);
  result.addComponent("render", { type: "box", material: surface, castShadows: true, receiveShadows: true });
  result.setLocalPosition(...at);
  result.setLocalScale(...size);
  if (angle) result.setLocalEulerAngles(...angle);
  parent.addChild(result);
  return result;
}

function pivot(parent: pc.Entity, name: string, at: Triple): pc.Entity {
  const result = new pc.Entity(name);
  result.setLocalPosition(...at);
  parent.addChild(result);
  return result;
}

export function createMobArt(parent: pc.Entity, archetype: string, body: pc.StandardMaterial, matriarch = false): MobArtRig {
  const kind: MobKind = archetype === "stone_brute" ? "stone_brute" : archetype === "cave_spitter" ? "cave_spitter" : "moss_crawler";
  const head = pivot(parent, "head-joint", kind === "stone_brute" ? [0, 1.6, 0.06] : kind === "cave_spitter" ? [0, 0.56, 0.56] : [0, 0.53, 0.48]);
  const jaw = pivot(head, "jaw-joint", kind === "stone_brute" ? [0, -0.2, 0.14] : [0, -0.11, 0.27]);
  const rig: MobArtRig = { kind, head, jaw, limbs: [], arms: [], sacs: [], phase: 0, walk: 0, matriarch, phaseSurfaces: [], enraged: false, defeated: false, glowSurfaces: [] };

  if (kind === "moss_crawler") {
    box(parent, "bark-abdomen", shellDark, [0.82, 0.34, 1.04], [0, 0.4, -0.1]);
    box(parent, "shell-left", body, [0.45, 0.37, 0.95], [-0.22, 0.62, -0.12], [0, 0, -12]);
    box(parent, "shell-right", body, [0.45, 0.37, 0.95], [0.22, 0.62, -0.12], [0, 0, 12]);
    box(parent, "shell-ridge", shellLight, [0.16, 0.19, 0.81], [0, 0.84, -0.13]);
    box(parent, "moss-cap", shellLight, [0.49, 0.15, 0.38], [0.13, 0.85, -0.32], [0, 12, 0]);
    box(parent, "lichen-tuft", mossTip, [0.14, 0.19, 0.15], [-0.2, 0.94, -0.24], [0, 0, -12]);
    box(parent, "moss-tuft", shellLight, [0.17, 0.23, 0.14], [0.2, 0.94, -0.5], [-12, 0, 12]);
    box(head, "head", shellDark, [0.61, 0.4, 0.51], [0, 0, 0.09]);
    box(head, "moss-brow", body, [0.65, 0.13, 0.36], [0, 0.23, 0.15]);
    for (const side of [-1, 1]) {
      box(head, `eye-${side}`, crawlerEye, [0.13, 0.13, 0.1], [side * 0.21, 0.06, 0.37]);
      box(head, `antenna-${side}`, shellDark, [0.055, 0.3, 0.065], [side * 0.25, 0.37, 0.22], [24, 0, side * -24]);
      box(jaw, `mandible-${side}`, ivory, [0.12, 0.14, 0.34], [side * 0.24, -0.03, 0.19], [0, side * -20, 0]);
      box(jaw, `mandible-tip-${side}`, ivory, [0.1, 0.11, 0.17], [side * 0.14, -0.025, 0.38], [0, side * -42, 0]);
      for (let index = 0; index < 3; index += 1) {
        const leg = pivot(parent, `leg-${side}-${index}`, [side * 0.39, 0.43, 0.31 - index * 0.38]);
        box(leg, "upper", shellDark, [0.43, 0.13, 0.14], [side * 0.19, -0.035, 0], [0, side * (index - 1) * 16, side * -15]);
        const knee = pivot(leg, "knee", [side * 0.37, -0.08, 0]);
        box(knee, "shin", body, [0.11, 0.34, 0.13], [side * 0.035, -0.16, 0.025], [0, 0, side * 14]);
        rig.limbs.push({ pivot: leg, knee, side, offset: (index + (side > 0 ? 1 : 0)) * Math.PI });
      }
    }
  } else if (kind === "stone_brute") {
    box(parent, "dark-torso", rockDark, [0.97, 0.92, 0.7], [0, 0.94, 0]);
    box(parent, "left-chest-plate", body, [0.5, 0.59, 0.8], [-0.37, 1.12, 0.02], [0, 0, -10]);
    box(parent, "right-chest-plate", body, [0.46, 0.64, 0.75], [0.35, 1.14, -0.04], [0, 0, 13]);
    box(parent, "core-recess", mouth, [0.4, 0.5, 0.09], [0, 1.11, 0.38]);
    box(parent, "amber-heart", core, [0.22, 0.33, 0.14], [0, 1.13, 0.45], [0, 0, 20]);
    box(parent, "waist-plate", rockLight, [0.71, 0.25, 0.76], [0, 0.66, 0.01], [0, 0, -5]);
    box(parent, "back-slab", rockMoss, [0.88, 0.24, 0.41], [0, 1.45, -0.28], [-12, 0, 0]);
    box(head, "crag-head", body, [0.7, 0.62, 0.62], [0, 0.02, 0]);
    box(head, "broken-brow", rockLight, [0.76, 0.18, 0.25], [0, 0.21, 0.29], [0, 0, -8]);
    box(jaw, "chin", rockDark, [0.48, 0.18, 0.43], [0, -0.03, 0.02]);
    for (const side of [-1, 1]) {
      box(head, `eye-${side}`, core, [0.15, 0.09, 0.07], [side * 0.19, 0.06, 0.33]);
      box(head, `crown-${side}`, rockMoss, [0.18, side < 0 ? 0.29 : 0.18, 0.3], [side * 0.22, 0.39, -0.04], [0, 0, side * 13]);
      const arm = pivot(parent, `shoulder-joint-${side}`, [side * 0.73, 1.27, 0]);
      box(arm, "shoulder-plate", body, [0.55, 0.42, 0.67], [side * 0.06, 0.02, 0], [0, 0, side * 14]);
      box(arm, "upper-arm", rockDark, [0.34, 0.56, 0.39], [side * 0.09, -0.32, 0]);
      const elbow = pivot(arm, "elbow-joint", [side * 0.09, -0.53, 0]);
      box(elbow, "forearm", body, [0.44, 0.47, 0.49], [0, -0.2, 0.06], [0, 0, side * -6]);
      box(elbow, "fist", rockLight, [0.57, 0.33, 0.65], [0, -0.41, 0.15]);
      box(elbow, "fist-seam", rockDark, [0.035, 0.31, 0.66], [side * 0.08, -0.41, 0.16]);
      rig.arms.push({ pivot: arm, knee: elbow, side, offset: side < 0 ? 0 : Math.PI });
      const leg = pivot(parent, `hip-${side}`, [side * 0.27, 0.58, 0]);
      box(leg, "leg", body, [0.37, 0.44, 0.44], [0, -0.2, 0]);
      box(leg, "foot", rockDark, [0.48, 0.21, 0.62], [0, -0.43, 0.1]);
      rig.limbs.push({ pivot: leg, knee: null, side, offset: side < 0 ? 0 : Math.PI });
    }
  } else {
    box(parent, "abdomen", body, [0.88, 0.44, 1.13], [0, 0.42, -0.16]);
    box(parent, "shell-middle", spitterDark, [0.92, 0.18, 0.33], [0, 0.67, -0.12]);
    box(parent, "shell-back", spitterLight, [0.74, 0.16, 0.27], [0, 0.66, -0.46], [8, 0, 0]);
    box(parent, "tail", spitterDark, [0.35, 0.24, 0.4], [0, 0.38, -0.83], [-12, 0, 0]);
    box(parent, "tail-tip", spitterLight, [0.16, 0.13, 0.23], [0, 0.31, -1.09]);
    box(head, "broad-head", body, [0.77, 0.37, 0.59], [0, 0.03, 0.09]);
    box(head, "mouth-cavity", mouth, [0.53, 0.18, 0.12], [0, -0.045, 0.41]);
    box(jaw, "lower-jaw", spitterLight, [0.58, 0.12, 0.35], [0, -0.08, 0.12]);
    for (const side of [-1, 1]) {
      const sac = pivot(parent, `acid-sac-joint-${side}`, [side * 0.32, 0.73, -0.4]);
      box(sac, "acid-gland", acid, [0.39, 0.38, 0.44], [0, 0, 0], [0, 0, side * 12]);
      rig.sacs.push(sac);
      box(head, `eyelid-${side}`, spitterDark, [0.23, 0.21, 0.23], [side * 0.31, 0.19, 0.25]);
      box(head, `eye-${side}`, acid, [0.11, 0.1, 0.065], [side * 0.31, 0.2, 0.385]);
      box(head, `tooth-${side}`, ivory, [0.07, 0.12, 0.075], [side * 0.2, -0.055, 0.47]);
      for (let index = 0; index < 2; index += 1) {
        const leg = pivot(parent, `leg-${side}-${index}`, [side * 0.4, 0.4, 0.35 - index * 0.76]);
        box(leg, "thigh", spitterDark, [0.4, 0.22, 0.27], [side * 0.16, -0.04, -0.05], [0, side * 22, side * -20]);
        const knee = pivot(leg, "knee", [side * 0.3, -0.13, -0.1]);
        box(knee, "foot", spitterLight, [0.15, 0.25, 0.4], [side * 0.05, -0.11, 0.09], [-12, 0, side * 12]);
        rig.limbs.push({ pivot: leg, knee, side, offset: (index + (side > 0 ? 1 : 0)) * Math.PI });
      }
    }
  }
  if (matriarch && kind === "cave_spitter") {
    const dorsal = pivot(parent, "matriarch-dorsal-sac", [0, 1.05, -.36]);
    rig.phaseSurfaces.push(box(dorsal, "large-venom-reservoir", matriarchVenom, [.65, .62, .82], [0, 0, 0]));
    rig.sacs.push(dorsal);
    box(dorsal, "sac-armour-ridge", matriarchArmour, [.16, .15, .87], [0, .33, 0]);
    for (const side of [-1, 1]) {
      box(parent, `matriarch-flared-shell-${side}`, matriarchArmour, [.27, .52, 1.05], [side * .53, .62, -.18], [0, 0, side * -20]);
      for (let i = 0; i < 3; i++) box(parent, `matriarch-spine-${side}-${i}`, ivory, [.12, .38 - i * .05, .15], [side * .55, .98, .12 - i * .3], [-18, 0, side * -28]);
      box(head, `matriarch-horn-${side}`, ivory, [.13, .4, .16], [side * .33, .37, .2], [-24, 0, side * -22]);
      rig.phaseSurfaces.push(box(head, `matriarch-venom-eye-${side}`, matriarchVenom, [.12, .09, .08], [side * .16, .18, .4]));
    }
  }
  for (const render of parent.findComponents("render") as pc.RenderComponent[]) {
    const surface = render.material as pc.StandardMaterial;
    if (dimGlowMaterials.has(surface)) rig.glowSurfaces.push({ part: render.entity as pc.Entity, liveMaterial: surface });
  }
  return rig;
}

export function setMobArtEnraged(rig: MobArtRig, enraged: boolean): void {
  if (!rig.matriarch || rig.enraged === enraged) return;
  rig.enraged = enraged;
  for (const part of rig.phaseSurfaces) if (part.render) {
    const live = enraged ? matriarchEnragedVenom : matriarchVenom;
    const glow = rig.glowSurfaces.find(surface => surface.part === part);
    if (glow) glow.liveMaterial = live;
    part.render.material = rig.defeated ? dimGlowMaterials.get(live)! : live;
  }
}

export function setMobArtDefeated(rig: MobArtRig, defeated: boolean): void {
  if (rig.defeated === defeated) return;
  rig.defeated = defeated;
  for (const glow of rig.glowSurfaces) if (glow.part.render)
    glow.part.render.material = defeated ? dimGlowMaterials.get(glow.liveMaterial)! : glow.liveMaterial;
}

/** No per-frame geometry/material creation; only transform the prebuilt joints. */
export function animateMobArt(rig: MobArtRig, dt: number, time: number, speed: number, windup: number, attack: number, hurt: number, stagger: number, defeat: number): void {
  const brute = rig.kind === "stone_brute";
  const spitter = rig.kind === "cave_spitter";
  const activity = (1 - Math.min(1, windup + stagger)) * (1 - defeat);
  const desiredWalk = Math.min(1, speed / (brute ? 0.85 : 1.4)) * activity;
  rig.walk += (desiredWalk - rig.walk) * Math.min(1, dt * 14);
  if (defeat > 0) rig.walk = 0;
  rig.phase += dt * Math.min(speed, 6) * (brute ? 3.5 : spitter ? 6.5 : 8);
  for (const leg of rig.limbs) {
    const stride = Math.sin(rig.phase + leg.offset);
    const lift = Math.max(0, Math.cos(rig.phase + leg.offset));
    if (brute) {
      leg.pivot.setLocalEulerAngles(stride * rig.walk * 23 - defeat * 16, 0, leg.side * defeat * 14);
    } else {
      leg.pivot.setLocalEulerAngles(stride * rig.walk * 16 + defeat * 35, stride * rig.walk * 15, leg.side * (lift * rig.walk * 21 + windup * 11 - defeat * 68));
      leg.knee?.setLocalEulerAngles(lift * rig.walk * -22 - defeat * 40, 0, leg.side * windup * -10);
    }
  }
  for (const arm of rig.arms) {
    const stride = Math.sin(rig.phase + arm.offset) * rig.walk;
    arm.pivot.setLocalEulerAngles(stride * -22 - windup * 118 + attack * 50 + hurt * 12, 0, arm.side * (8 + windup * 13 + defeat * 19));
    arm.knee?.setLocalEulerAngles(-windup * 32 - attack * 14 - defeat * 24, 0, 0);
  }
  rig.head.setLocalEulerAngles(
    (brute ? -windup * 12 + attack * 20 : spitter ? -windup * 20 + attack * 25 : windup * 13 - attack * 18) - hurt * 14 + defeat * 27,
    Math.sin(time * 1.3) * 3 * (1 - rig.walk) * (1 - windup) * (1 - defeat),
    Math.sin(time * 21) * stagger * 8,
  );
  rig.jaw.setLocalEulerAngles((spitter ? windup * 36 + attack * 18 : brute ? windup * 11 - attack * 13
    : windup * 32 - attack * 28) + defeat * 18, 0, 0);
  for (let index = 0; index < rig.sacs.length; index += 1) {
    const inflate = 1 + Math.sin(time * 2.5 + index * 0.4) * 0.035 + windup * 0.22 - attack * 0.16;
    rig.sacs[index]!.setLocalScale(inflate, inflate * (1 - defeat * 0.3), inflate);
  }
}
