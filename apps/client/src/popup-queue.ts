export interface PopupOpenResult { hide: string[] }
export interface PopupCloseResult { show: string | null }

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
