import { defineConfig } from "vitest/config";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [{
    name: "sandbox-assets",
    resolveId(id) { if (id === "virtual:fleet-assets") return "\0fleet-assets"; },
    load(id) {
      if (id !== "\0fleet-assets") return;
      const assets: Record<string, string> = {};
      for (const [folder, mime] of [["audio", "audio/wav"]]) {
        const root = resolve("public/assets", folder!);
        for (const name of readdirSync(root).sort()) {
          if (!/\.(png|wav)$/.test(name)) continue;
          assets[`${folder}/${name}`] = `data:${mime};base64,${readFileSync(resolve(root, name)).toString("base64")}`;
        }
      }
      return `export const assets = ${JSON.stringify(assets)};`;
    },
  }],
  base: "./",
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: { manualChunks: { phaser: ["phaser"] } },
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
