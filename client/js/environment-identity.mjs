// Environment colors affect terrain and existing lights, never warning materials.
export const SURFACE_PALETTES = Object.freeze([
  { name: 'plains', tint: 0xfff9ec, horizon: 0xaecfdf, sky: 0xd9efff, ground: 0x88735b, key: 0xffefc2, fogNear: 44, fogFar: 120, sun: 1.00, ambient: 1.00 },
  { name: 'forest', tint: 0xdcebdd, horizon: 0x789e95, sky: 0xaecbc4, ground: 0x465f48, key: 0xdcebd9, fogNear: 28, fogFar: 84, sun: 0.72, ambient: 0.82 },
  { name: 'desert', tint: 0xffebcf, horizon: 0xe7cda8, sky: 0xf7e6cc, ground: 0xa17a50, key: 0xffc66f, fogNear: 52, fogFar: 138, sun: 1.18, ambient: 0.78 },
  { name: 'mesa', tint: 0xffdfce, horizon: 0xd8a58e, sky: 0xf4c3ae, ground: 0x97634d, key: 0xffb278, fogNear: 40, fogFar: 112, sun: 1.04, ambient: 0.88 },
  { name: 'snowy', tint: 0xe5f3ff, horizon: 0xb8d9e9, sky: 0xecf8ff, ground: 0x687f96, key: 0xf1f9ff, fogNear: 42, fogFar: 112, sun: 0.92, ambient: 1.18 },
  { name: 'swamp', tint: 0xdce5cf, horizon: 0x7f8f69, sky: 0xaab39b, ground: 0x515a3e, key: 0xc8c18e, fogNear: 22, fogFar: 68, sun: 0.60, ambient: 0.70 },
]);
// Civic warmth is distinct from the surrounding plains without tinting warning VFX.
export const TOWN_PALETTE = Object.freeze({ name: 'town', tint: 0xffedce, horizon: 0xd5bd9d, sky: 0xf6ddbd, ground: 0x806449, key: 0xffd39a, fogNear: 46, fogFar: 122, sun: 1.04, ambient: 1.02 });
// Dungeons receive almost no directional skylight. Their authored local palette
// supplies the remaining ambient and key colour for torches, crystals and magic.
const stone = { tint: 0xc0b5a4, sky: 0x77818c, ground: 0x493d32, key: 0xffcf91, ambient: 0.34, sun: 0.025, fogNear: 8, fogFar: 34 };
const cold = { tint: 0xb6cad3, sky: 0x7899aa, ground: 0x38485d, key: 0xb9e5ff, ambient: 0.32, sun: 0.018, fogNear: 7, fogFar: 27 };
const moss = { tint: 0xc2ceb0, sky: 0x829477, ground: 0x35452d, key: 0xd6e89d, ambient: 0.36, sun: 0.020, fogNear: 7, fogFar: 29 };
const ember = { tint: 0xd3b4a0, sky: 0x936f58, ground: 0x542e26, key: 0xff9b52, ambient: 0.30, sun: 0.015, fogNear: 8, fogFar: 31 };
const arcane = { tint: 0xc0b5d1, sky: 0x81759b, ground: 0x443753, key: 0xc9aaff, ambient: 0.31, sun: 0.012, fogNear: 6, fogFar: 28 };
export const DUNGEON_PALETTES = Object.freeze({
  mine: stone, crypt: cold, overgrown: moss, catacombs: stone,
  blighted: moss, vault: cold, forge: ember, keep: stone, sanctum: cold,
  void: arcane, frozen: cold, storm: cold, royal_tomb: stone,
  abyssal: cold, worldscar: arcane,
});

export function createEnvironmentIdentity(THREE) {
  const surface = SURFACE_PALETTES.map(p => ({
    ...p, tint: new THREE.Color(p.tint), horizon: new THREE.Color(p.horizon), sky: new THREE.Color(p.sky),
    ground: new THREE.Color(p.ground), key: new THREE.Color(p.key),
  }));
  const townSurface={...TOWN_PALETTE,tint:new THREE.Color(TOWN_PALETTE.tint),horizon:new THREE.Color(TOWN_PALETTE.horizon),sky:new THREE.Color(TOWN_PALETTE.sky),ground:new THREE.Color(TOWN_PALETTE.ground),key:new THREE.Color(TOWN_PALETTE.key)};
  const dungeons = Object.fromEntries(Object.entries(DUNGEON_PALETTES).map(([name, p]) => [name, {
    tint: new THREE.Color(p.tint), sky: new THREE.Color(p.sky),
    ground: new THREE.Color(p.ground), key: new THREE.Color(p.key),
  }]));
  const tint = surface[0].tint.clone(), horizon = surface[0].horizon.clone(), sky=surface[0].sky.clone(), ground = surface[0].ground.clone(), key=surface[0].key.clone();
  let fogNear=surface[0].fogNear,fogFar=surface[0].fogFar,sunStrength=surface[0].sun,ambientStrength=surface[0].ambient;
  const multiplier = new THREE.Color();
  return {
    surface({ biome, town, dt, day, opaque, transparent, fog, backdrop, hemi, sun }) {
      const target = town ? townSurface : surface[biome] || surface[0];
      const alpha = 1 - Math.exp(-Math.max(0, dt) * 1.5);
      tint.lerp(target.tint, alpha); horizon.lerp(target.horizon, alpha); sky.lerp(target.sky,alpha); ground.lerp(target.ground, alpha); key.lerp(target.key,alpha);
      fogNear+=(target.fogNear-fogNear)*alpha;fogFar+=(target.fogFar-fogFar)*alpha;sunStrength+=(target.sun-sunStrength)*alpha;ambientStrength+=(target.ambient-ambientStrength)*alpha;
      multiplier.set(0xffffff).lerp(tint, 0.38);
      opaque.color.multiply(multiplier); transparent.color.multiply(multiplier);
      // Night retains its darkness; weather and interior overrides run afterwards.
      fog.color.lerp(horizon, 0.16 * day);
      fog.near=fogNear;fog.far=fogFar;
      backdrop.copy(fog.color);
      hemi.groundColor.lerp(ground, 0.65);
      hemi.color.lerp(sky,0.42+day*0.28);
      if(Number.isFinite(hemi.intensity))hemi.intensity*=ambientStrength;
      if(sun){sun.color.lerp(key,0.46);sun.intensity*=sunStrength;}
    },
    dungeon(theme) { return dungeons[theme] || dungeons.void; },
  };
}
