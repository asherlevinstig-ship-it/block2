import type { MainHandId } from "@blockcraft/protocol";
export type RapidProjectileStyle = "crescent" | "arrow" | "orb";
export function rangedStyle(weapon: MainHandId, rapidStyle?: RapidProjectileStyle) {
  if (rapidStyle === "crescent") return {
    shape: "box" as const, color: [.28, .94, 1], scale: [.72, .07, .2], glyph: "◖", hitSound: "rangedHit" as const,
  };
  if (rapidStyle === "arrow") return {
    shape: "box" as const, color: [1, .78, .22], scale: [.045, .045, .95], glyph: "➤", hitSound: "rangedHit" as const,
  };
  if (rapidStyle === "orb") return {
    shape: "sphere" as const, color: [.7, .32, 1], scale: [.42, .42, .42], glyph: "✹", hitSound: "rangedHit" as const,
  };
  if (weapon === "bow" || weapon === "forged_bow") return {
    shape: "box" as const, color: [.93, .76, .34], scale: [.065, .065, .72], glyph: "✧", hitSound: "rangedHit" as const,
  };
  if (weapon === "acid_gland_focus") return {
    shape: "sphere" as const, color: [.58, 1, .08], scale: [.34, .34, .34], glyph: "✹", hitSound: "acidHit" as const,
  };
  if (weapon === "venom_focus") return {
    shape: "box" as const, color: [.12, .95, .65], scale: [.18, .18, .42], glyph: "✦", hitSound: "venomHit" as const,
  };
  if (weapon === "echo_prism") return {
    shape: "box" as const, color: [.62, .91, 1], scale: [.2, .2, .38], glyph: "✧", hitSound: "rangedHit" as const,
  };
  return {
    shape: "sphere" as const, color: [.28, .68, 1], scale: [.24, .24, .24], glyph: "✦", hitSound: "rangedHit" as const,
  };
}
