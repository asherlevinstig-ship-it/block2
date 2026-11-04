import { MEDITATION_SITES, type MeditationSite, type MeditationSiteId } from "@blockcraft/protocol";
import * as pc from "playcanvas";

type SiteVisual = {
  site: MeditationSite;
  root: pc.Entity;
  halo: pc.Entity;
  core: pc.Entity;
  runes: pc.Entity;
  beacon: pc.Entity;
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

/** Golden spectral rest points share one unmistakable silhouette: a weathered
 * circular seat, a flame-like energy fountain, a rising spiral and a distant
 * beacon. Animation is transform-only, keeping the effect tablet-friendly. */
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
    shape(root, "waystone-dais", "cylinder", stone, [2.35, .15, 2.35], [0, .04, 0]);
    shape(root, "waystone-step", "cylinder", stoneLight, [1.86, .12, 1.86], [0, .2, 0]);
    const halo = shape(root, "waystone-ground-halo", "cylinder", softGlow, [2.15, .018, 2.15], [0, .34, 0]);
    for (let i = 0; i < 7; i++) {
      const angle = i / 7 * Math.PI * 2;
      const slab = shape(root, "waystone-weathered-seat", "box", i % 2 ? stone : stoneLight, [.48, .16, .78],
        [Math.cos(angle) * 1.58, .38 + (i % 2) * .035, Math.sin(angle) * 1.58]);
      slab.setLocalEulerAngles(0, -angle * 180 / Math.PI + 90, 0);
    }
    shape(root, "waystone-brazier", "cone", stoneLight, [.78, .42, .78], [0, .58, 0]);
    const core = shape(root, "waystone-spectral-flame", "cone", hotGlow, [.38, 1.18, .38], [0, 1.28, 0]);
    const flames = [
      shape(root, "waystone-flame-left", "cone", glow, [.24, .88, .24], [-.22, 1.2, .04]),
      shape(root, "waystone-flame-right", "cone", glow, [.2, .72, .2], [.25, 1.12, -.05]),
      shape(root, "waystone-flame-high", "cone", hotGlow, [.18, 1.35, .18], [.04, 1.55, .02]),
    ];
    flames[0]!.setLocalEulerAngles(0, 0, -16); flames[1]!.setLocalEulerAngles(0, 0, 18);
    const beacon = shape(root, "waystone-distant-beacon", "cylinder", softGlow, [.11, 5.2, .11], [0, 3.05, 0]);
    const runes = new pc.Entity("waystone-golden-spiral"); root.addChild(runes);
    const threads: pc.Entity[] = [];
    for (let i = 0; i < 18; i++) {
      const t = i / 17;
      const angle = t * Math.PI * 4.4;
      const radius = .82 - t * .48;
      const thread = shape(runes, "waystone-light-thread", "sphere", i % 4 === 0 ? hotGlow : glow,
        [.095, .095, .095], [Math.cos(angle) * radius, .72 + t * 2.85, Math.sin(angle) * radius]);
      threads.push(thread);
    }
    const motes = Array.from({ length: 14 }, (_, index) => shape(root, `waystone-mote-${index}`, "sphere", index % 3 ? glow : hotGlow,
      [.065, .065, .065], [0, .5, 0]));
    const light = new pc.Entity("waystone-light");
    light.addComponent("light", { type: "omni", color: colour, intensity: 2.4, range: 10, castShadows: false });
    light.setLocalPosition(0, 1.3, 0); root.addChild(light);
    return { site, root, halo, core, runes, beacon, flames, threads, motes, light };
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
    visual.halo.setLocalScale(2.15 * pulse, .018, 2.15 * pulse);
    visual.core.setLocalScale(.38 * (1 + Math.sin(now / 145) * .12 + energy * .28),
      1.18 * (1 + Math.sin(now / 210) * .09 + energy * .24), .38 * (1 + Math.sin(now / 145) * .12 + energy * .28));
    visual.beacon.setLocalScale(.11 * (1 + energy * 1.2), 5.2 * (1 + energy * .32), .11 * (1 + energy * 1.2));
    visual.flames.forEach((flame, index) => {
      const flicker = 1 + Math.sin(now / (120 + index * 31) + index * 2) * .16 + energy * .3;
      const base: readonly [number, number, number] = index === 2 ? [.18, 1.35, .18]
        : index === 0 ? [.24, .88, .24] : [.2, .72, .2];
      flame.setLocalScale(base[0] * flicker,
        base[1] * (1 + Math.sin(now / 180 + index) * .12 + energy * .3), base[2] * flicker);
    });
    visual.threads.forEach((thread, index) => {
      const sparkle = .72 + Math.sin(now / 115 + index * 1.7) * .28 + energy * .55;
      thread.setLocalScale(.095 * sparkle, .095 * sparkle, .095 * sparkle);
    });
    if (visual.light.light) visual.light.light.intensity = 2.25 + energy * 4.4 + Math.sin(now / 260) * .32;
    visual.motes.forEach((mote, index) => {
      const cycle = (now / (1_420 - energy * 480) + index / visual.motes.length) % 1;
      const angle = now / 950 + index * 2.08;
      const radius = .38 + (index % 3) * .24;
      mote.setLocalPosition(Math.cos(angle) * radius, .4 + cycle * (3.5 + energy * 1.7), Math.sin(angle) * radius);
      const scale = (.55 + (1 - cycle) * .8) * (1 + energy * .7);
      mote.setLocalScale(.065 * scale, .065 * scale, .065 * scale);
    });
  }
  if (visuals.completion && now >= visuals.completion.until) visuals.completion = null;
}
