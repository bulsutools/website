// @ts-check
import { fileURLToPath } from "node:url";
import { defineConfig } from 'astro/config';

// Pin tsconfig resolution to this project. Without it, Vite's tsconfig
// auto-discovery can walk up into a parent checkout (this repo is often
// built from worktrees nested inside the main clone) and fail with
// "Tsconfig not found astro/tsconfigs/strict".
const TSCONFIG = fileURLToPath(new URL("./tsconfig.json", import.meta.url));

// https://astro.build/config
export default defineConfig({
  vite: {
    tsconfig: TSCONFIG,
  },
});
