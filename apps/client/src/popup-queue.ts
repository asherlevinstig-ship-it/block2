export interface PopupOpenResult { hide: string[] }
export interface PopupCloseResult { show: string | null }

export interface PopupPresentationState {
  hidden: unknown;
  dataset: { popupQueued?: string };
}

/** True only when a popup is genuinely on screen, not merely waiting in the queue. */
export function popupIsPresented(popup: PopupPresentationState): boolean {
  return popup.hidden === false && popup.dataset.popupQueued !== "true";
}

/** Wrap keyboard focus within the active popup. A missing current item starts at an edge. */
export function popupFocusIndex(current: number, count: number, backwards: boolean): number {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return backwards ? count - 1 : 0;
  return (current + (backwards ? -1 : 1) + count) % count;
}

/** Gameplay is blocked by UI that is actually presented, never by a future/pending tutorial state. */
export function gameplayBlockedByPopup(activePopupId: string | null, protectedDialogPresented: boolean): boolean {
  return activePopupId !== null || protectedDialogPresented;
}

/** Serialises blocking UI without coupling the individual feature systems. */
export class ExclusivePopupQueue {
  private current: string | null = null;
  private waiting: string[] = [];

  active(): string | null { return this.current; }
  pending(): readonly string[] { return this.waiting; }

  open(id: string, priority = false): PopupOpenResult {
    if (id === this.current) return { hide: [] };
    if (this.waiting.includes(id)) return { hide: [id] };
    if (this.current === null) {
      this.current = id;
      return { hide: [] };
    }
    if (priority) {
      this.waiting.unshift(this.current);
      const previous = this.current;
      this.current = id;
      return { hide: [previous] };
    }
    this.waiting.push(id);
    return { hide: [id] };
  }

  close(id: string): PopupCloseResult {
    if (id !== this.current) {
      this.waiting = this.waiting.filter(candidate => candidate !== id);
      return { show: null };
    }
    this.current = this.waiting.shift() ?? null;
    return { show: this.current };
  }
}
