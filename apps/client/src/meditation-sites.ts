import { MEDITATION_SITES, type MeditationSite, type MeditationSiteId } from "@blockcraft/protocol";
import * as pc from "playcanvas";

type SiteVisual = {
  site: MeditationSite;
  root: pc.Entity;
  halo: pc.Entity;
  core: pc.Entity;
  runes: pc.Entity;
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

/** Three restrained, low-cost Waystones share a silhouette while using each
 * sanctuary's palette. Animation is transform-only, keeping the rest VFX
 * cheap enough for tablets. */
export function createMeditationSiteVisuals(app: pc.Application, parent: pc.Entity): MeditationSiteVisuals {
  const stone = material(new pc.Color(.17, .21, .2));
  const stoneLight = material(new pc.Color(.32, .38, .35));
  const sites = MEDITATION_SITES.map(site => {
    const colour = new pc.Color(site.colour[0], site.colour[1], site.colour[2]);
    const glow = material(colour, 2.8, .72);
    const softGlow = material(colour, 1.7, .24);
    const root = new pc.Entity(`meditation:${site.id}`);
    root.setPosition(site.x, site.y, site.z); parent.addChild(root);
    shape(root, "waystone-dais", "cylinder", stone, [2.65, .18, 2.65], [0, .05, 0]);
    shape(root, "waystone-step", "cylinder", stoneLight, [2.15, .12, 2.15], [0, .22, 0]);
    const halo = shape(root, "waystone-ground-halo", "cylinder", softGlow, [1.65, .018, 1.65], [0, .36, 0]);
    for (let i = 0; i < 6; i++) {
      const angle = i / 6 * Math.PI * 2;
      const slab = shape(root, "waystone-seat-rune", "box", stoneLight, [.55, .18, .92],
        [Math.cos(angle) * 1.75, .4, Math.sin(angle) * 1.75]);
      slab.setLocalEulerAngles(0, -angle * 180 / Math.PI + 90, 0);
    }
    const core = shape(root, "waystone-core", "box", glow, [.38, 1.28, .38], [0, 1.35, 0]);
    core.setLocalEulerAngles(0, 45, 7);
    shape(root, "waystone-lower-crystal", "cone", stoneLight, [.82, .72, .82], [0, .68, 0]);
    const runes = new pc.Entity("waystone-orbit"); root.addChild(runes);
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2;
      const rune = shape(runes, "waystone-floating-rune", "box", glow, [.14, .34, .08],
        [Math.cos(angle) * 1.1, 1.42 + Math.sin(angle * 2) * .16, Math.sin(angle) * 1.1]);
      rune.setLocalEulerAngles(0, -angle * 180 / Math.PI, 18);
    }
    const motes = Array.from({ length: 10 }, (_, index) => shape(root, `waystone-mote-${index}`, "sphere", glow,
      [.065, .065, .065], [0, .5, 0]));
    const light = new pc.Entity("waystone-light");
    light.addComponent("light", { type: "omni", color: colour, intensity: 1.25, range: 7, castShadows: false });
    light.setLocalPosition(0, 1.3, 0); root.addChild(light);
    return { site, root, halo, core, runes, motes, light };
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
    visual.runes.setLocalEulerAngles(0, now * (.018 + energy * .05), 0);
    const pulse = 1 + Math.sin(now / 430) * .08 + energy * .28;
    visual.halo.setLocalScale(1.65 * pulse, .018, 1.65 * pulse);
    visual.core.setLocalScale(.38 * (1 + energy * .25), 1.28 * (1 + energy * .18), .38 * (1 + energy * .25));
    if (visual.light.light) visual.light.light.intensity = 1.15 + energy * 3.2 + Math.sin(now / 380) * .18;
    visual.motes.forEach((mote, index) => {
      const cycle = (now / (1_600 - energy * 520) + index / visual.motes.length) % 1;
      const angle = now / 950 + index * 2.08;
      const radius = .38 + (index % 3) * .24;
      mote.setLocalPosition(Math.cos(angle) * radius, .42 + cycle * (2.2 + energy * 1.5), Math.sin(angle) * radius);
      const scale = (.55 + (1 - cycle) * .8) * (1 + energy * .7);
      mote.setLocalScale(.065 * scale, .065 * scale, .065 * scale);
    });
  }
  if (visuals.completion && now >= visuals.completion.until) visuals.completion = null;
}
