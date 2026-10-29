import { describe, expect, it } from "vitest";
import { CALLING_PARTICLE_TEXTURE_URLS } from "./calling-particles.js";

describe("calling particle texture library", () => {
  it("uses only local authored textures with a small fixed atlas budget", () => {
    const urls = Object.values(CALLING_PARTICLE_TEXTURE_URLS);
    expect(urls).toHaveLength(6);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      expect(url.startsWith("/assets/vfx/kenney-particles/")).toBe(true);
      expect(url.endsWith(".png")).toBe(true);
      expect(url).not.toMatch(/^https?:/);
    }
  });
});
