import { defineConfig } from "vite";
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const assetDirectory = fileURLToPath(new URL("./dist/assets", import.meta.url));

function preserveOpenGameAssets() {
  return {
    name: "preserve-open-game-assets",
    closeBundle() {
      const aliases = [
        ["index.css", "index-DOyyG1l4.css"],
        ["index.css", "index-BZDvdp8L.css"],
        ["game.js", "index-QH2u70CO.js"],
      ] as const;
      for (const [current, legacy] of aliases) {
        const source = `${assetDirectory}/${current}`;
        if (existsSync(source)) copyFileSync(source, `${assetDirectory}/${legacy}`);
      }
    },
  };
}

export default defineConfig({
  server: { host: "127.0.0.1", port: 5173 },
  plugins: [preserveOpenGameAssets()],
  build: {
    rolldownOptions: {
      output: {
        entryFileNames: "assets/game.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
