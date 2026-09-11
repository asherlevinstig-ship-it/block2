// Environment colors affect terrain and existing lights, never warning materials.
export const SURFACE_PALETTES = Object.freeze([
  { name: 'plains', tint: 0xfff9ec, horizon: 0xb9d9df, ground: 0x88735b },
  { name: 'forest', tint: 0xe3f0dc, horizon: 0x93b5a4, ground: 0x526b48 },
  { name: 'desert', tint: 0xffebcf, horizon: 0xe5c79e, ground: 0xa17a50 },
  { name: 'mesa', tint: 0xffdfce, horizon: 0xd8ad99, ground: 0x97634d },
  { name: 'snowy', tint: 0xe5f3ff, horizon: 0xc0dce9, ground: 0x728b9d },
  { name: 'swamp', tint: 0xe3ece0, horizon: 0x96aba0, ground: 0x58634b },
]);
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
    tint: new THREE.Color(p.tint), horizon: new THREE.Color(p.horizon), ground: new THREE.Color(p.ground),
  }));
  const dungeons = Object.fromEntries(Object.entries(DUNGEON_PALETTES).map(([name, p]) => [name, {
    tint: new THREE.Color(p.tint), sky: new THREE.Color(p.sky),
    ground: new THREE.Color(p.ground), key: new THREE.Color(p.key),
  }]));
  const tint = surface[0].tint.clone(), horizon = surface[0].horizon.clone(), ground = surface[0].ground.clone();
  const multiplier = new THREE.Color();
  return {
    surface({ biome, town, dt, day, opaque, transparent, fog, backdrop, hemi }) {
      const target = surface[town ? 0 : biome] || surface[0];
      const alpha = 1 - Math.exp(-Math.max(0, dt) * 1.5);
      tint.lerp(target.tint, alpha); horizon.lerp(target.horizon, alpha); ground.lerp(target.ground, alpha);
      multiplier.set(0xffffff).lerp(tint, 0.38);
      opaque.color.multiply(multiplier); transparent.color.multiply(multiplier);
      // Night retains its darkness; weather and interior overrides run afterwards.
      fog.color.lerp(horizon, 0.16 * day);
      backdrop.copy(fog.color);
      hemi.groundColor.lerp(ground, 0.65);
    },
    dungeon(theme) { return dungeons[theme] || dungeons.void; },
  };
}
