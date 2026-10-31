import { describe, expect, it } from "vitest";
import { TAVERN_PATRON_CYCLE_SECONDS, tavernPatronSchedule } from "./tavern-patron-schedule.js";

describe("tavern patron schedules", () => {
  it("runs through arrival, meal, conversation and departure", () => {
    expect(tavernPatronSchedule(2).phase).toBe("away");
    expect(tavernPatronSchedule(13)).toMatchObject({ phase: "entering", progress: .5 });
    expect(tavernPatronSchedule(25).phase).toBe("eating");
    expect(tavernPatronSchedule(40).phase).toBe("talking");
    expect(tavernPatronSchedule(63)).toMatchObject({ phase: "leaving", progress: .5 });
  });

  it("repeats cleanly and supports staggered patrons", () => {
    expect(tavernPatronSchedule(13 + TAVERN_PATRON_CYCLE_SECONDS)).toEqual(tavernPatronSchedule(13));
    expect(tavernPatronSchedule(0, 25).phase).toBe("eating");
    expect(tavernPatronSchedule(0, 40).phase).toBe("talking");
  });
});

