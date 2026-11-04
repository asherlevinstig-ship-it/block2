import { MEDITATION_SITES, type MeditationSite, type MeditationSiteId } from "@blockcraft/protocol";
import * as pc from "playcanvas";

type SiteVisual = {
  site: MeditationSite;
  root: pc.Entity;
  halo: pc.Entity;
  core: pc.Entity;
  runes: pc.Entity;
  embers: pc.Entity;
  flames: pc.Entity[];
  threads: pc.Entity[];
  motes: pc.Entity[];
  light: pc.Entity;
};

export type MeditationSiteVisuals = {
  sites: SiteVisual[];
  completion: { siteId: MeditationSiteId; until: number } | null;
};

function material(colour: pc.Color, emissive = 0, opacity = 1): pc.StandardMaterial {
  const result = new pc.StandardMaterial();
  result.diffuse = colour.clone();
  result.metalness = .05; result.gloss = .48;
  if (emissive > 0) { result.emissive = colour.clone(); result.emissiveIntensity = emissive; }
  if (opacity < 1) { result.opacity = opacity; result.blendType = pc.BLEND_NORMAL; result.depthWrite = false; }
  result.update();
  return result;
}

function shape(parent: pc.Entity, name: string, type: "box" | "cylinder" | "sphere" | "cone",
  mat: pc.StandardMaterial, scale: readonly [number, number, number], position: readonly [number, number, number]): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent("render", { type, castShadows: false, receiveShadows: type !== "sphere" });
  if (entity.render) entity.render.material = mat;
  entity.setLocalScale(scale[0], scale[1], scale[2]);
  entity.setLocalPosition(position[0], position[1], position[2]);
  parent.addChild(entity);
  return entity;
}

/** A broad, grounded meditation hearth with a physical stone ring, logs,
 * golden fire and rising embers. Animation is transform-only, keeping the
 * effect tablet-friendly. */
export function createMeditationSiteVisuals(app: pc.Application, parent: pc.Entity): MeditationSiteVisuals {
  const stone = material(new pc.Color(.19, .17, .12));
  const stoneLight = material(new pc.Color(.39, .33, .21));
  const sites = MEDITATION_SITES.map(site => {
    const colour = new pc.Color(site.colour[0], site.colour[1], site.colour[2]);
    const glow = material(colour, 4.2, .84);
    const hotGlow = material(new pc.Color(1, .94, .63), 5.2, .92);
    const softGlow = material(colour, 2.5, .2);
    const root = new pc.Entity(`meditation:${site.id}`);
    root.setPosition(site.x, site.y, site.z); parent.addChild(root);
    shape(root, "meditation-hearth-foundation", "cylinder", stone, [6.4, .12, 6.4], [0, .06, 0]);
    shape(root, "meditation-hearth-inlay", "cylinder", stoneLight, [5.65, .06, 5.65], [0, .15, 0]);
    const halo = shape(root, "meditation-golden-groundlight", "cylinder", softGlow, [4.7, .025, 4.7], [0, .205, 0]);
    for (let i = 0; i < 12; i++) {
      const angle = i / 12 * Math.PI * 2;
      const slab = shape(root, "meditation-hearth-stone", "box", i % 2 ? stone : stoneLight, [.92, .48, 1.25],
        [Math.cos(angle) * 2.25, .42 + (i % 2) * .035, Math.sin(angle) * 2.25]);
      slab.setLocalEulerAngles(0, -angle * 180 / Math.PI + 90, 0);
    }
    for (let i = 0; i < 4; i++) {
      const angle = i / 4 * Math.PI * 2;
      const seat = shape(root, "meditation-kneeling-stone", "box", stoneLight, [1.55, .18, .92],
        [Math.cos(angle) * 3.75, .12, Math.sin(angle) * 3.75]);
      seat.setLocalEulerAngles(0, -angle * 180 / Math.PI + 90, 0);
    }
    const logMaterial = material(new pc.Color(.18, .075, .025));
    for (const [yaw, y] of [[45, .55], [-45, .63], [90, .71]] as const) {
      const log = shape(root, "meditation-hearth-log", "box", logMaterial, [2.35, .3, .34], [0, y, 0]);
      log.setLocalEulerAngles(0, yaw, 0);
    }
    const coal = shape(root, "meditation-golden-coals", "cylinder", glow, [2.3, .16, 2.3], [0, .42, 0]);
    coal.setLocalEulerAngles(0, 0, 0);
    const core = shape(root, "meditation-spectral-fire", "cone", hotGlow, [1.25, 2.45, 1.25], [0, 1.75, 0]);
    const flames = [
      shape(root, "meditation-flame-left", "cone", glow, [.82, 1.85, .82], [-.68, 1.48, .1]),
      shape(root, "meditation-flame-right", "cone", glow, [.72, 1.55, .72], [.72, 1.36, -.12]),
      shape(root, "meditation-flame-high", "cone", hotGlow, [.58, 2.75, .58], [.08, 2.12, .05]),
    ];
    flames[0]!.setLocalEulerAngles(0, 0, -16); flames[1]!.setLocalEulerAngles(0, 0, 18);
    const embers = shape(root, "meditation-ember-column", "cylinder", softGlow, [1.5, 4.2, 1.5], [0, 2.45, 0]);
    const runes = new pc.Entity("meditation-golden-spiral"); root.addChild(runes);
    const threads: pc.Entity[] = [];
    for (let i = 0; i < 18; i++) {
      const t = i / 17;
      const angle = t * Math.PI * 4.4;
      const radius = 1.45 - t * .72;
      const thread = shape(runes, "meditation-light-thread", "sphere", i % 4 === 0 ? hotGlow : glow,
        [.13, .13, .13], [Math.cos(angle) * radius, .72 + t * 3.7, Math.sin(angle) * radius]);
      threads.push(thread);
    }
    const motes = Array.from({ length: 18 }, (_, index) => shape(root, `meditation-golden-particle-${index}`, "sphere", index % 3 ? glow : hotGlow,
      [.09, .09, .09], [0, .5, 0]));
    const light = new pc.Entity("waystone-light");
    light.addComponent("light", { type: "omni", color: colour, intensity: 2.4, range: 10, castShadows: false });
    light.setLocalPosition(0, 1.3, 0); root.addChild(light);
    return { site, root, halo, core, runes, embers, flames, threads, motes, light };
  });
  return { sites, completion: null };
}

export function celebrateMeditationSite(visuals: MeditationSiteVisuals, siteId: MeditationSiteId, now = performance.now()): void {
  visuals.completion = { siteId, until: now + 2_600 };
}

export function updateMeditationSiteVisuals(visuals: MeditationSiteVisuals, now: number,
  player: { x: number; y: number; z: number }, holdingSiteId: MeditationSiteId | null, holdProgress: number): void {
  for (const visual of visuals.sites) {
    const distance = Math.hypot(player.x - visual.site.x, player.z - visual.site.z);
    visual.root.enabled = distance < 58 && Math.abs(player.y - visual.site.y) < 12;
    if (!visual.root.enabled) continue;
    const completing = visuals.completion?.siteId === visual.site.id && now < visuals.completion.until;
    const holding = holdingSiteId === visual.site.id;
    const energy = completing ? 1 : holding ? holdProgress : 0;
    visual.runes.setLocalEulerAngles(0, now * (.022 + energy * .065), 0);
    const pulse = 1 + Math.sin(now / 330) * .1 + energy * .3;
    visual.halo.setLocalScale(4.7 * pulse, .025, 4.7 * pulse);
    visual.core.setLocalScale(1.25 * (1 + Math.sin(now / 145) * .12 + energy * .28),
      2.45 * (1 + Math.sin(now / 210) * .09 + energy * .24), 1.25 * (1 + Math.sin(now / 145) * .12 + energy * .28));
    visual.embers.setLocalScale(1.5 * (1 + energy * .28), 4.2 * (1 + energy * .32), 1.5 * (1 + energy * .28));
    visual.flames.forEach((flame, index) => {
      const flicker = 1 + Math.sin(now / (120 + index * 31) + index * 2) * .16 + energy * .3;
      const base: readonly [number, number, number] = index === 2 ? [.58, 2.75, .58]
        : index === 0 ? [.82, 1.85, .82] : [.72, 1.55, .72];
      flame.setLocalScale(base[0] * flicker,
        base[1] * (1 + Math.sin(now / 180 + index) * .12 + energy * .3), base[2] * flicker);
    });
    visual.threads.forEach((thread, index) => {
      const sparkle = .72 + Math.sin(now / 115 + index * 1.7) * .28 + energy * .55;
      thread.setLocalScale(.13 * sparkle, .13 * sparkle, .13 * sparkle);
    });
    if (visual.light.light) visual.light.light.intensity = 2.25 + energy * 4.4 + Math.sin(now / 260) * .32;
    visual.motes.forEach((mote, index) => {
      const cycle = (now / (1_420 - energy * 480) + index / visual.motes.length) % 1;
      const angle = now / 950 + index * 2.08;
      const radius = .55 + (index % 4) * .34;
      mote.setLocalPosition(Math.cos(angle) * radius, .4 + cycle * (3.5 + energy * 1.7), Math.sin(angle) * radius);
      const scale = (.55 + (1 - cycle) * .8) * (1 + energy * .7);
      mote.setLocalScale(.09 * scale, .09 * scale, .09 * scale);
    });
  }
  if (visuals.completion && now >= visuals.completion.until) visuals.completion = null;
}
