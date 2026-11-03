export interface FloorTwoRenderPolicy {
  dynamic: boolean;
  castShadows: boolean;
  receiveShadows: boolean;
}

/** Floor 2 is assembled from many repeated structural primitives. Keep only
 * genuinely animated or state-swapped pieces outside the static batch, and
 * reserve shadow casting for the large silhouettes that materially shape a
 * room. */
export function towerFloorTwoRenderPolicy(name: string): FloorTwoRenderPolicy {
  const dynamic = name.includes("vent-warning") || name.includes("vent-jet")
    || name.includes("sconce-flame") || name.includes("sealed-signal")
    || name.includes("open-signal") || name.includes("regulator-ring")
    || name.includes("regulator-core");
  const castShadows = name.includes("pressure-door") || name.includes("crucible-gate")
    || name.includes("breach") || name.includes("ascent-frame") || name.includes("chimney");
  return { dynamic, castShadows, receiveShadows: !name.includes("vent-") && !name.includes("sconce-flame") };
}
