import { describe, expect, it } from "vitest";
import { queueWorldNotice, type WorldNotice } from "./notification-lane.js";

const discovery: WorldNotice = { kind: "discovery", heading: "REGION DISCOVERED", title: "Greenwood", detail: "Added to your map", durationMs: 3800 };
const objective: WorldNotice = { kind: "objective", heading: "OBJECTIVE COMPLETE", title: "Camp cleared", detail: "+10 gold", durationMs: 4500 };

describe("notification lane", () => {
  it("puts completed objectives ahead of discoveries", () => {
    expect(queueWorldNotice([discovery], objective)).toEqual([objective, discovery]);
  });
  it("deduplicates repeat announcements and caps the waiting lane", () => {
    expect(queueWorldNotice([discovery], discovery)).toEqual([discovery]);
    expect(queueWorldNotice([discovery, discovery, discovery, discovery], objective, 2)).toEqual([objective, discovery]);
  });
});
