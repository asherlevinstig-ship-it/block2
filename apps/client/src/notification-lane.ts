export type WorldNotice = {
  kind: "objective" | "discovery" | "roadside";
  heading: string;
  title: string;
  detail: string;
  durationMs: number;
};

// Keep short world announcements in one lane, with completed objectives first.
export function queueWorldNotice(queue: readonly WorldNotice[], notice: WorldNotice, max = 4): WorldNotice[] {
  const next = queue.filter(item => !(item.kind === notice.kind && item.title === notice.title && item.detail === notice.detail));
  if (notice.kind === "objective") next.unshift(notice);
  else next.push(notice);
  return next.slice(0, max);
}
