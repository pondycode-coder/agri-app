// Copies the built index.html to 404.html so static hosts
// (GitHub Pages, etc.) serve the SPA on deep links instead of a hard 404.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const src = join(dist, "index.html");
const dest = join(dist, "404.html");

if (!existsSync(dist)) {
  console.error("dist/ not found. Run `vite build` first.");
  process.exit(1);
}
mkdirSync(dist, { recursive: true });
copyFileSync(src, dest);
console.log("Copied dist/index.html -> dist/404.html");