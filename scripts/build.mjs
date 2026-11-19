import { cp, mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";

const root = new URL("../", import.meta.url);
const webDir = new URL("../www/", import.meta.url);
await rm(webDir, { recursive: true, force: true });
await mkdir(webDir, { recursive: true });
for (const file of ["index.html", "styles.css", "app.js"]) {
  await cp(new URL(`../${file}`, import.meta.url), new URL(`../www/${file}`, import.meta.url));
}
await build({
  entryPoints: [new URL("../native-bridge-src.js", import.meta.url).pathname],
  outfile: new URL("../www/native-bridge.js", import.meta.url).pathname,
  bundle: true,
  platform: "browser",
  format: "iife",
  target: ["es2020"],
  sourcemap: false
});
await cp(new URL("../assets", import.meta.url), new URL("../www/assets", import.meta.url), { recursive: true });
console.log("duitw web assets prepared in www/");
