/** Only background graphics are throttled: updates and networking keep running. */
export function inventoryRenderDue(now: number, lastFrame: number): boolean {
  return now < lastFrame || now - lastFrame >= 50;
}
