import type { CombatTimingEvent } from "@blockcraft/protocol";

type Action = CombatTimingEvent["action"];
interface PendingAction { action: Action; sentAt: number; acceptedAt?: number }

/** Local-only, bounded timing log. Server timestamps are diagnostic, never trusted for gameplay. */
export class CombatSyncRecorder {
  private readonly pending = new Map<string, PendingAction>();
  private readonly warnings = new Set<string>();
  private readonly lines: string[] = [];

  start(action: Action, requestId: string, at: number): void {
    this.pending.set(requestId, { action, sentAt: at });
    while (this.pending.size > 64) this.pending.delete(this.pending.keys().next().value!);
  }

  receive(event: CombatTimingEvent, receivedAt: number, serverOffset: number, clockSynced: boolean): void {
    const action = this.pending.get(event.requestId);
    const elapsed = action ? Math.max(0, receivedAt - action.sentAt) : null;
    const uplink = action && event.phase === "accepted" && clockSynced
      ? Math.round(event.serverTime - action.sentAt - serverOffset) : null;
    const downlink = clockSynced ? Math.round(receivedAt + serverOffset - event.serverTime) : null;
    const serverElapsed = action?.acceptedAt === undefined ? null : Math.round(event.serverTime - action.acceptedAt);
    const scheduled = event.scheduledAt === undefined ? "" : ` due=${Math.round(event.scheduledAt - event.serverTime)}ms`;
    const outcome = event.outcome ? ` ${event.outcome.toUpperCase()}` : "";
    this.add(`${event.action.toUpperCase()} ${event.requestId} ${event.phase.toUpperCase()}${outcome}`
      + ` receive=${elapsed === null ? "untracked" : `${Math.round(elapsed)}ms`}`
      + (event.phase === "accepted" ? ` up=${uplink === null ? "?" : `${uplink}ms`}`
        : ` server=${serverElapsed === null ? "?" : `${serverElapsed}ms`}`)
      + ` down=${downlink === null ? "?" : `${downlink}ms`}${scheduled}`);
    if (action && event.phase === "accepted") action.acceptedAt = event.serverTime;
    if (event.phase === "resolved") this.pending.delete(event.requestId);
  }

  reject(requestId: string | undefined, action: string, reason: string, receivedAt: number): void {
    const pending = requestId ? this.pending.get(requestId) : undefined;
    this.add(`${action.toUpperCase()} ${requestId ?? "?"} REJECT ${reason}`
      + ` receive=${pending ? `${Math.round(Math.max(0, receivedAt - pending.sentAt))}ms` : "untracked"}`);
    if (requestId) this.pending.delete(requestId);
  }

  warning(mobId: string, sequence: number, startedAt: number, contactAt: number, visibleAt: number): void {
    if (startedAt <= 0 || contactAt <= 0) return;
    const key = `${mobId}:${sequence}:${startedAt}`;
    if (this.warnings.has(key)) return;
    this.warnings.add(key);
    while (this.warnings.size > 256) this.warnings.delete(this.warnings.values().next().value!);
    this.add(`WARNING ${mobId} #${sequence} first-visible=${Math.round(visibleAt - startedAt)}ms`
      + ` lead=${Math.round(contactAt - visibleAt)}ms`);
  }

  snapshot(): string {
    return this.lines.join("\n") || "No combat timing events yet.";
  }

  clear(): void {
    this.pending.clear();
    this.warnings.clear();
    this.lines.length = 0;
  }

  private add(line: string): void {
    this.lines.push(line);
    if (this.lines.length > 128) this.lines.shift();
  }
}
