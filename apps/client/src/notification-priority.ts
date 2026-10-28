type Entry<T> = { key: string; priority: number; remainingMs: number; value: T; order: number };

/** One presentation slot. Hidden time never consumes a message's reading time. */
export class NotificationPriorityQueue<T> {
  private entries: Entry<T>[] = [];
  private visible: Entry<T> | null = null;
  private lastTick: number | null = null;
  private order = 0;

  enqueue(key: string, priority: number, durationMs: number, value: T, replace = false): void {
    const existing = this.entries.find(entry => entry.key === key);
    if (existing && !replace) return;
    if (existing) {
      this.entries = this.entries.filter(entry => entry !== existing);
      if (this.visible === existing) { this.visible = null; this.lastTick = null; }
    }
    this.entries.push({ key, priority, remainingMs: durationMs, value, order: this.order++ });
    this.entries.sort((a, b) => b.priority - a.priority || a.order - b.order);
    // Drop low-priority backlog first, retaining the message currently being read.
    if (this.entries.length > 12) {
      let index = this.entries.length - 1;
      while (index >= 0 && this.entries[index] === this.visible) index--;
      this.entries.splice(index, 1);
    }
  }

  tick(now: number, blocked: boolean): T | null {
    if (this.visible && this.lastTick !== null) {
      this.visible.remainingMs -= Math.max(0, now - this.lastTick);
      if (this.visible.remainingMs <= 0) this.entries = this.entries.filter(entry => entry !== this.visible);
    }
    this.visible = blocked ? null : this.entries[0] ?? null;
    this.lastTick = this.visible ? now : null;
    return this.visible?.value ?? null;
  }

  hasPriorityAtLeast(priority: number): boolean { return this.entries.some(entry => entry.priority >= priority); }
  clear(): void { this.entries = []; this.visible = null; this.lastTick = null; }
}
