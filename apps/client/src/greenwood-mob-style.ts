export type GreenwoodMobStyle = "moss" | "briar" | "thornbinder" | "elderthorn";

export function greenwoodMobStyle(mobId: string, archetype: string): GreenwoodMobStyle | null {
  if (!mobId.startsWith("greenwood-")) return null;
  if (mobId === "greenwood-elderthorn") return "elderthorn";
  if (archetype === "thornbinder") return "thornbinder";
  if (archetype === "briar_crawler") return "briar";
  return archetype === "moss_crawler" ? "moss" : null;
}

/** Enemies push through the forest floor for a short readable entrance. */
export function greenwoodEmergence(elapsedMs: number): { y: number; scaleY: number } {
  const t = Math.max(0, Math.min(1, elapsedMs / 520));
  if (t >= 1) return { y: 0, scaleY: 1 };
  const eased = t * t * (3 - 2 * t);
  return { y: -.62 * (1 - eased), scaleY: .58 + eased * .42 };
}
