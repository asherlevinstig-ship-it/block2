export function cleanChatText(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, "").trim();
}
export function hearsNearbyChat(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }): boolean {
  return Math.abs(from.y - to.y) <= 2.5 && Math.hypot(from.x - to.x, from.z - to.z) <= 24;
}
