import { describe, expect, it } from "vitest";
import { NotificationPriorityQueue } from "./notification-priority.js";

describe("notification priority", () => {
  it("preempts loot with an objective then resumes the loot's remaining reading time", () => {
    const queue = new NotificationPriorityQueue<string>();
    queue.enqueue("loot", 50, 4000, "Sword collected");
    expect(queue.tick(0, false)).toBe("Sword collected");
    queue.enqueue("gate", 80, 2000, "Court opened");
    expect(queue.tick(1000, false)).toBe("Court opened");
    expect(queue.tick(3000, false)).toBe("Sword collected");
    expect(queue.tick(5999, false)).toBe("Sword collected");
    expect(queue.tick(6000, false)).toBeNull();
  });
  it("preserves notices during combat, travel and dialogs rather than expiring unseen", () => {
    const queue = new NotificationPriorityQueue<string>();
    queue.enqueue("level", 90, 3000, "Level 2");
    expect(queue.tick(0, true)).toBeNull();
    expect(queue.tick(60000, false)).toBe("Level 2");
    expect(queue.tick(61000, true)).toBeNull();
    expect(queue.tick(90000, false)).toBe("Level 2");
    expect(queue.tick(92000, false)).toBeNull();
  });
  it("deduplicates queued events and keeps high priority messages when the backlog fills", () => {
    const queue = new NotificationPriorityQueue<string>();
    queue.enqueue("gate", 80, 100, "Gate");
    queue.enqueue("gate", 80, 100, "Duplicate");
    for (let n = 0; n < 20; n++) queue.enqueue(`landmark${n}`, 30, 100, `Landmark ${n}`);
    expect(queue.tick(0, false)).toBe("Gate");
    expect(queue.tick(100, false)).toBe("Landmark 0");
    queue.clear();
    expect(queue.tick(200, false)).toBeNull();
  });
  it("coalesces region changes so the player sees their latest location after combat", () => {
    const queue = new NotificationPriorityQueue<string>();
    queue.enqueue("region", 30, 2000, "Old region", true);
    queue.tick(0, true);
    queue.enqueue("region", 30, 2000, "Current region", true);
    expect(queue.tick(5000, false)).toBe("Current region");
    expect(queue.tick(7000, false)).toBeNull();
  });
  it("reserves the first clear moment after travel for the destination", () => {
    const queue = new NotificationPriorityQueue<string>();
    queue.enqueue("loot", 50, 2000, "Loot");
    queue.enqueue("objective", 80, 2000, "Gate opened");
    queue.enqueue("arrival", 100, 4500, "Floor 1");
    expect(queue.hasPriorityAtLeast(100)).toBe(true);
    expect(queue.tick(0, true)).toBeNull();
    expect(queue.tick(1000, false)).toBe("Floor 1");
    expect(queue.tick(5500, false)).toBe("Gate opened");
    expect(queue.hasPriorityAtLeast(100)).toBe(false);
  });
});
