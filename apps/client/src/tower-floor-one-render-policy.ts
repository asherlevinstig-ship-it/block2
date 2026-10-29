export interface FloorOneRenderPolicy {
  dynamic: boolean;
  castShadows: boolean;
  receiveShadows: boolean;
}

// Floor 1 contains hundreds of small primitives. Sending every ivy leaf,
// paving overlay and glowing rune through the directional-light shadow pass
// made the room substantially more expensive than the town. Keep silhouettes
// from architecture and trees, but make flat/detail geometry shadow receivers
// only. Animated or fading pieces must remain outside the static batch.
export function towerFloorOneRenderPolicy(name: string): FloorOneRenderPolicy {
  const dynamic = /(?:warden-seal|seal-chain|seal-barrier|ground-mist|spore|falling-leaf)/.test(name);
  const unlitDetail = /(?:light-shaft|ground-mist|spore|seal-barrier)/.test(name);
  const noShadow = /(?:ivy-|flagstone|wall-moss|root-moss|fern|falling-leaf|earth|rune|sigil|glow|flame|bloom|inlay|banner|cloth|strap|chain)/.test(name);
  return {
    dynamic,
    castShadows: !dynamic && !unlitDetail && !noShadow,
    receiveShadows: !unlitDetail,
  };
}
