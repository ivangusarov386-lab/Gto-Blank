import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

await build({
  entryPoints: ["src/hero-3d.js"],
  outfile: "assets/hero-3d.js",
  bundle: true,
  minify: true,
  format: "esm",
  target: ["es2022"],
  legalComments: "eof",
});
await build({
  entryPoints: ["src/excel.js"],
  outfile: "assets/excel.js",
  bundle: true,
  minify: true,
  format: "esm",
  target: ["es2022"],
  legalComments: "eof",
});
const digest = (data) =>
  createHash("sha256").update(data).digest("hex").slice(0, 12);
const file = await readFile("assets/hero-3d.js");
// Version the optional dynamic import as well as direct HTML assets.
const experiencePath = "assets/experience.js";
let experience = await readFile(experiencePath, "utf8");
experience = experience.replace(
  /\.\/hero-3d\.js(?:\?v=[a-f0-9]+)?/g,
  `./hero-3d.js?v=${digest(file)}`,
);
await writeFile(experiencePath, experience);
let html = await readFile("index.html", "utf8");
const assets = [
  ...new Set(
    [
      ...html.matchAll(
        /(?:src|href)="(assets\/[^"?]+\.(?:js|css|svg))(?:\?v=[a-f0-9]+)?"/g,
      ),
    ].map((match) => match[1]),
  ),
];
for (const path of assets) {
  const version = digest(await readFile(path));
  html = html.replaceAll(
    new RegExp(
      `((?:src|href)="${path.replaceAll(".", "\\.")})(?:\\?v=[a-f0-9]+)?"`,
      "g",
    ),
    `$1?v=${version}"`,
  );
}
await writeFile("index.html", html);
console.log(`Versioned ${assets.length} page assets by content hash.`);
console.log(
  `3D bundle: ${(file.length / 1024).toFixed(1)} KB / ${(gzipSync(file).length / 1024).toFixed(1)} KB gzip (lazy loaded)`,
);
