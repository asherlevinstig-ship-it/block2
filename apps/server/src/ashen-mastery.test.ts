import { describe, expect, it } from "vitest";
import { ASHEN_MASTERY_MAX } from "@blockcraft/protocol";
import { chooseAshenMastery, grantAshenMastery, parseAshenMastery } from "./ashen-mastery.js";

describe("Ashen equipment mastery", () => {
  it("earns capped progress without destroying the build envelope", () => {
    const result = grantAshenMastery('{"roadsideClaims":["cart"]}', "cinderfang", 100);
    expect(result.after).toBe(ASHEN_MASTERY_MAX);
    expect(result.ready).toBe(true);
    expect(JSON.parse(result.json).roadsideClaims).toEqual(["cart"]);
  });

  it("only accepts a matching branch after mastery", () => {
    const mastered = grantAshenMastery("{}", "ashguard", ASHEN_MASTERY_MAX).json;
    expect(chooseAshenMastery(mastered, "ashguard", "wildfire")).toBeNull();
    const chosen = chooseAshenMastery(mastered, "ashguard", "phoenix");
    expect(parseAshenMastery(chosen!)).toEqual({ ashguard: { xp: ASHEN_MASTERY_MAX, branch: "phoenix" } });
    expect(chooseAshenMastery(chosen!, "ashguard", "shelter")).toBeNull();
  });
});
