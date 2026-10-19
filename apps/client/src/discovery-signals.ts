import type { RoadsideDiscoveryKind } from "@blockcraft/voxel-world";

export type DiscoverySignalKind = "smoke" | "beacon" | "omens" | "glint" | "trail";

export function discoverySignalKind(site: RoadsideDiscoveryKind, encounter?: string): DiscoverySignalKind {
  if (encounter === "cache") return "glint";
  if (encounter === "trail") return "trail";
  if (site === "shrine") return "beacon";
  if (site === "camp") return "smoke";
  if (site === "ruin" || site === "grove") return "omens";
  return "glint";
}

export type DiscoveryBreadcrumb = { x: number; z: number; yaw: number };

/** Low physical clues point away from a landmark without becoming a HUD route. */
export function discoveryBreadcrumbs(x: number, z: number, dx: number, dz: number, count = 4): DiscoveryBreadcrumb[] {
  if (!Number.isFinite(dx) || !Number.isFinite(dz) || count <= 0 || Math.hypot(dx, dz) < 1) return [];
  const yaw = Math.atan2(dx, dz) * 180 / Math.PI;
  return Array.from({ length: count }, (_, index) => {
    const progress = (index + 1) / (count + 1);
    const side = index % 2 ? .24 : -.24;
    const length = Math.hypot(dx, dz);
    return {
      x: x + dx * progress + dz / length * side,
      z: z + dz * progress - dx / length * side,
      yaw: yaw + (index % 2 ? 13 : -11),
    };
  });
}

