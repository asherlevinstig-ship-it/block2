export type GameExperience = "fast-world" | "legacy-voxel" | "legacy-practice" | "silver-depths";

/** The fast low-poly world is the canonical game. The retired voxel runtime is
 * still reachable for migration checks, but only through an explicit route. */
export function gameExperience(query: URLSearchParams): GameExperience {
  const room = query.get("room");
  if (room === "silver-depths") return "silver-depths";
  if (query.get("mode") === "fast") return "fast-world";
  if (room === "practice") return query.get("prototype") === "2d" ? "fast-world" : "legacy-practice";
  if (query.get("legacy") === "voxel" || room === "world" || query.has("returnFrom") || query.has("qa"))
    return "legacy-voxel";
  return "fast-world";
}

export function usesFastWorld(query: URLSearchParams): boolean {
  return gameExperience(query) === "fast-world";
}

export const LEGACY_VOXEL_ROUTE = "?legacy=voxel";
