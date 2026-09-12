// Environment colors affect terrain and existing lights, never warning materials.
export const SURFACE_PALETTES = Object.freeze([
  { name: 'plains', tint: 0xfff9ec, horizon: 0xb9d9df, sky: 0xd9efff, ground: 0x88735b, key: 0xfff1cf, fogNear: 42, fogFar: 116, sun: 1.00 },
  { name: 'forest', tint: 0xe3f0dc, horizon: 0x82a797, sky: 0xb9d5c5, ground: 0x526b48, key: 0xf1e3b4, fogNear: 30, fogFar: 88, sun: 0.78 },
  { name: 'desert', tint: 0xffebcf, horizon: 0xe5c79e, sky: 0xffe2b9, ground: 0xa17a50, key: 0xffd18a, fogNear: 48, fogFar: 132, sun: 1.12 },
  { name: 'mesa', tint: 0xffdfce, horizon: 0xd8a58e, sky: 0xf4c3ae, ground: 0x97634d, key: 0xffb278, fogNear: 40, fogFar: 112, sun: 1.04 },
  { name: 'snowy', tint: 0xe5f3ff, horizon: 0xb4d4e4, sky: 0xe6f6ff, ground: 0x728b9d, key: 0xe8f6ff, fogNear: 38, fogFar: 104, sun: 0.94 },
  { name: 'swamp', tint: 0xe3ece0, horizon: 0x84998e, sky: 0xa9b9a8, ground: 0x58634b, key: 0xd6d1a4, fogNear: 24, fogFar: 72, sun: 0.68 },
]);
// Civic warmth is distinct from the surrounding plains without tinting warning VFX.
export const TOWN_PALETTE = Object.freeze({ name: 'town', tint: 0xffedce, horizon: 0xd5bd9d, sky: 0xf6ddbd, ground: 0x806449, key: 0xffd39a, fogNear: 46, fogFar: 122, sun: 1.04 });
const stone = { tint: 0xc0b5a4, sky: 0xc5d1de, ground: 0x73604b, key: 0xffdfb2 };
const cold = { tint: 0xb6cad3, sky: 0xb5d9eb, ground: 0x586b80, key: 0xd2eaff };
const moss = { tint: 0xc2ceb0, sky: 0xd0dfbd, ground: 0x556b47, key: 0xffe6b5 };
const ember = { tint: 0xd3b4a0, sky: 0xe9cdb1, ground: 0x794e40, key: 0xffc18c };
const arcane = { tint: 0xc0b5d1, sky: 0xd0c6e7, ground: 0x655577, key: 0xeadcff };
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
  let fogNear=surface[0].fogNear,fogFar=surface[0].fogFar,sunStrength=surface[0].sun;
  const multiplier = new THREE.Color();
  return {
    surface({ biome, town, dt, day, opaque, transparent, fog, backdrop, hemi, sun }) {
      const target = town ? townSurface : surface[biome] || surface[0];
      const alpha = 1 - Math.exp(-Math.max(0, dt) * 1.5);
      tint.lerp(target.tint, alpha); horizon.lerp(target.horizon, alpha); sky.lerp(target.sky,alpha); ground.lerp(target.ground, alpha); key.lerp(target.key,alpha);
      fogNear+=(target.fogNear-fogNear)*alpha;fogFar+=(target.fogFar-fogFar)*alpha;sunStrength+=(target.sun-sunStrength)*alpha;
      multiplier.set(0xffffff).lerp(tint, 0.38);
      opaque.color.multiply(multiplier); transparent.color.multiply(multiplier);
      // Night retains its darkness; weather and interior overrides run afterwards.
      fog.color.lerp(horizon, 0.16 * day);
      fog.near=fogNear;fog.far=fogFar;
      backdrop.copy(fog.color);
      hemi.groundColor.lerp(ground, 0.65);
      hemi.color.lerp(sky,0.42+day*0.28);
      if(sun){sun.color.lerp(key,0.46);sun.intensity*=sunStrength;}
    },
    dungeon(theme) { return dungeons[theme] || dungeons.void; },
  };
}
