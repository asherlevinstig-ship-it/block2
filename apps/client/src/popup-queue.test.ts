import { describe, expect, it } from "vitest";
import { ExclusivePopupQueue, popupIsPresented } from "./popup-queue.js";

describe("exclusive popup queue", () => {
  it("shows one popup and queues later requests in order", () => {
    const queue = new ExclusivePopupQueue();
    expect(queue.open("level-up")).toEqual({ hide: [] });
    expect(queue.open("ability")).toEqual({ hide: ["ability"] });
    expect(queue.open("inventory")).toEqual({ hide: ["inventory"] });
    expect(queue.close("level-up")).toEqual({ show: "ability" });
    expect(queue.close("ability")).toEqual({ show: "inventory" });
    expect(queue.close("inventory")).toEqual({ show: null });
  });

  it("deduplicates repeated requests and can cancel a waiting popup", () => {
    const queue = new ExclusivePopupQueue();
    queue.open("loot");
    queue.open("calling");
    expect(queue.open("calling")).toEqual({ hide: ["calling"] });
    expect(queue.pending()).toEqual(["calling"]);
    expect(queue.close("calling")).toEqual({ show: null });
    expect(queue.close("loot")).toEqual({ show: null });
  });

  it("lets urgent defeat screens pre-empt and then restores the interrupted popup", () => {
    const queue = new ExclusivePopupQueue();
    queue.open("inventory");
    expect(queue.open("defeat", true)).toEqual({ hide: ["inventory"] });
    expect(queue.active()).toBe("defeat");
    expect(queue.close("defeat")).toEqual({ show: "inventory" });
  });
});

describe("popup presentation state", () => {
  it("does not treat an invisible queued popup as presented", () => {
    expect(popupIsPresented({ hidden: false, dataset: { popupQueued: "true" } })).toBe(false);
  });

  it("only presents an open popup that is not queued", () => {
    expect(popupIsPresented({ hidden: false, dataset: {} })).toBe(true);
    expect(popupIsPresented({ hidden: true, dataset: {} })).toBe(false);
  });
});
