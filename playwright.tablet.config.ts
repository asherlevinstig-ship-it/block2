import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tablet-tests",
  fullyParallel: true,
  reporter: "line",
  use: {
    browserName: "chromium",
    channel: "chrome",
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
    headless: true,
  },
  projects: [
    { name: "iPad Mini landscape", use: { viewport: { width: 1024, height: 768 } } },
    { name: "iPad Air landscape", use: { viewport: { width: 1180, height: 820 } } },
    { name: "Compact Android landscape", use: { viewport: { width: 960, height: 600 } } },
  ],
});
