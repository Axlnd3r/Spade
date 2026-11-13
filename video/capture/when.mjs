// Prints the mean brightness of a region of a footage file over time, to line captions up with what is
// on screen: node capture/when.mjs <file> <x> <y> <w> <h> <from> <to> <step>
import { spawnSync } from "node:child_process";
import { inflateSync } from "node:zlib";

const [file, x, y, w, h, from, to, step] = process.argv.slice(2);
const ff = new URL("../node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe", import.meta.url).pathname.slice(1);

/** Mean of a grey PNG written with `-pred none` (every row uses filter 0). */
function meanOfPng(png) {
  const idat = [];
  for (let o = 8; o < png.length; ) {
    const len = png.readUInt32BE(o);
    if (png.toString("latin1", o + 4, o + 8) === "IDAT") idat.push(png.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const width = png.readUInt32BE(16);
  let sum = 0;
  let n = 0;
  for (let r = 0; r * (width + 1) < raw.length; r++) {
    for (let c = 1; c <= width; c++) sum += raw[r * (width + 1) + c];
    n += width;
  }
  return sum / n;
}

const out = [];
for (let t = Number(from); t <= Number(to) + 1e-9; t += Number(step)) {
  const r = spawnSync(ff, ["-loglevel", "error", "-ss", `${t}`, "-i", file, "-frames:v", "1", "-vf", `crop=${w}:${h}:${x}:${y}`,
    "-pix_fmt", "gray", "-pred", "none", "-c:v", "png", "-f", "image2pipe", "-"], { maxBuffer: 1 << 24 });
  out.push(`${t.toFixed(1)}:${meanOfPng(r.stdout).toFixed(0)}`);
}
console.log(out.join(" "));
