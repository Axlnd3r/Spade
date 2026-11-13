// Records the live site into public/footage/<shot>.mp4 with headless Chrome.
// Frames come from the CDP screencast and are resampled to a constant 30 fps, then encoded with the
// ffmpeg that ships with Remotion (it lacks the filters Puppeteer's own recorder needs).
//
//   node capture/record.mjs [shot ...]     # no argument records every shot
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
import { SHOTS } from "./shots.mjs";

export const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FFMPEG = new URL("../node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe", import.meta.url);
export const OUT = new URL("../public/footage/", import.meta.url);
const FPS = 30;

export async function encode(frames, file) {
  const ff = spawn(
    FFMPEG.pathname.slice(1),
    ["-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", `${FPS}`, "-i", "-",
      "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", file],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const t0 = frames[0].t;
  const end = frames[frames.length - 1].t;
  let i = 0;
  let written = 0;
  for (let t = t0; t <= end; t += 1 / FPS) {
    while (i + 1 < frames.length && frames[i + 1].t <= t) i++;
    if (!ff.stdin.write(frames[i].data)) await new Promise((r) => ff.stdin.once("drain", r));
    written++;
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exit ${c}`)))));
  return { written, captured: frames.length, seconds: end - t0 };
}

async function recordShot(browser, name, shot) {
  const page = await browser.newPage();
  await page.goto(`https://axlnd3r.github.io/Spade/#${shot.path}`, { waitUntil: "networkidle2" });
  await shot.prepare?.(page);
  await new Promise((r) => setTimeout(r, 2500));

  const stop = await startCapture(page);
  await shot.act(page);
  const frames = await stop();
  await page.close();

  const file = new URL(`${name}.mp4`, OUT).pathname.slice(1);
  const r = await encode(frames, file);
  console.log(`${name}: ${r.seconds.toFixed(1)} s, ${r.captured} frames captured (${(r.captured / r.seconds).toFixed(1)}/s), ${r.written} written`);
}

/** Headless Chrome with WebGL on the GPU, a 1920×1080 viewport and no scrollbars. */
export function launch(extra = {}) {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    defaultViewport: { width: 1920, height: 1080 },
    args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--window-size=1920,1080", "--hide-scrollbars"],
    ...extra,
  });
}

/** Starts the CDP screencast on `page`; the returned function stops it and gives the frames. */
export async function startCapture(page) {
  const cdp = await page.createCDPSession();
  const frames = [];
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    frames.push({ data: Buffer.from(data, "base64"), t: metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 95, maxWidth: 1920, maxHeight: 1080 });
  return async () => {
    await cdp.send("Page.stopScreencast");
    return frames;
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(OUT, { recursive: true });
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOTS);
  const browser = await launch();
  try {
    for (const name of names) {
      if (!SHOTS[name]) throw new Error(`unknown shot ${name}; known: ${Object.keys(SHOTS).join(", ")}`);
      await recordShot(browser, name, SHOTS[name]);
    }
  } finally {
    await browser.close();
  }
}
