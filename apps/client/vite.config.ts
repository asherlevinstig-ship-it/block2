import { defineConfig } from "vite";
import { copyFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const assetDirectory = fileURLToPath(new URL("./dist/assets", import.meta.url));

function preserveOpenGameAssets() {
  return {
    name: "preserve-open-game-assets",
    closeBundle() {
      const assets = existsSync(assetDirectory) ? readdirSync(assetDirectory) : [];
      const currentGame = assets.find(file => /^game-[a-zA-Z0-9_-]+\.js$/.test(file));
      const currentCss = assets.find(file => /^index-[a-zA-Z0-9_-]+\.css$/.test(file));
      const aliases = [
        ...(currentCss ? [[currentCss, "index.css"], [currentCss, "index-DOyyG1l4.css"], [currentCss, "index-BZDvdp8L.css"]] : []),
        ...(currentGame ? [[currentGame, "game.js"], [currentGame, "index-QH2u70CO.js"]] : []),
      ];
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
        entryFileNames: "assets/game-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        manualChunks(id) {
          if (id.includes("/node_modules/playcanvas/") || id.includes("\\node_modules\\playcanvas\\")) return "engine";
          if (id.includes("/node_modules/@colyseus/") || id.includes("\\node_modules\\@colyseus\\")) return "network";
          return undefined;
        },
      },
    },
  },
});
