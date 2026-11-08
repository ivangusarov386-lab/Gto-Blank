import { build } from "esbuild";
import { stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
await build({
  entryPoints: ["src/hero-3d.js"],
  outfile: "assets/hero-3d.js",
  bundle: true,
  minify: true,
  format: "esm",
  target: ["es2022"],
  legalComments: "eof",
});
const file = await readFile("assets/hero-3d.js");
console.log(
  `3D bundle: ${(file.length / 1024).toFixed(1)} KB / ${(gzipSync(file).length / 1024).toFixed(1)} KB gzip (lazy loaded)`,
);
