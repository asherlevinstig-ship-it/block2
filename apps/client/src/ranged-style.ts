import type { MainHandId } from "@blockcraft/protocol";
export function rangedStyle(weapon: MainHandId) {
  if (weapon === "bow" || weapon === "forged_bow") return {
    shape: "box" as const, color: [.93, .76, .34], scale: [.065, .065, .72], glyph: "✧", hitSound: "rangedHit" as const,
  };
  if (weapon === "acid_gland_focus") return {
    shape: "sphere" as const, color: [.58, 1, .08], scale: [.34, .34, .34], glyph: "✹", hitSound: "acidHit" as const,
  };
  if (weapon === "venom_focus") return {
    shape: "box" as const, color: [.12, .95, .65], scale: [.18, .18, .42], glyph: "✦", hitSound: "venomHit" as const,
  };
  return {
    shape: "sphere" as const, color: [.28, .68, 1], scale: [.24, .24, .24], glyph: "✦", hitSound: "rangedHit" as const,
  };
}
