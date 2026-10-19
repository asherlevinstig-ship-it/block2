import { describe, expect, it } from "vitest";
import { BUILD_PATHS, type BuildPathId } from "@blockcraft/protocol";
import { CALLING_AWAKENINGS, CALLING_AWAKENING_MINIMUM_MS, callingAwakeningCanContinue, callingPreviewMarkup } from "./calling-awakening.js";

describe("Calling choice presentation", () => {
  it("gives every Calling a distinct animated identity", () => {
    const paths = Object.keys(BUILD_PATHS) as BuildPathId[];
    expect(Object.keys(CALLING_AWAKENINGS)).toEqual(paths);
    expect(new Set(paths.map(path => CALLING_AWAKENINGS[path].action)).size).toBe(paths.length);
    expect(new Set(paths.map(path => CALLING_AWAKENINGS[path].colour)).size).toBe(paths.length);
  });

  it("renders an accessible preview tied to the Calling", () => {
    const markup = callingPreviewMarkup("assassin", "Assassin");
    expect(markup).toContain('data-calling="assassin"');
    expect(markup).toContain('aria-label="Assassin ability preview"');
  });

  it("holds the awakening long enough to read before continuing", () => {
    expect(callingAwakeningCanContinue(CALLING_AWAKENING_MINIMUM_MS - 1)).toBe(false);
    expect(callingAwakeningCanContinue(CALLING_AWAKENING_MINIMUM_MS)).toBe(true);
  });
});
