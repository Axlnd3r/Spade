// Renders review stills of SpadeDemo: node capture/stills.mjs <outDir> <frame> [frame ...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
const [out, ...frames] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: new URL("../src/index.ts", import.meta.url).pathname.slice(1) });
const composition = await selectComposition({ serveUrl, id: "SpadeDemo" });
for (const f of frames) {
  await renderStill({ serveUrl, composition, frame: Number(f), output: `${out}/f${f}.jpg`, imageFormat: "jpeg", scale: 0.5 });
  console.log(`f${f}`);
}
