// Synthesizes the intro's two sound effects into public/sfx/: a soft whoosh for the card's turns and a low
// thud for the BUSTED stamp. Plain maths and a seeded noise source, so every run writes the same files.
//
//   node capture/sfx.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const RATE = 44100;
const OUT = new URL("../public/sfx/", import.meta.url);

/** A small seeded generator (mulberry32) giving noise in -1..1. */
function noise(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 2147483648 - 1;
  };
}

/** 16-bit stereo WAV from two channels of floats, scaled so the loudest sample sits at `peak`. */
function wav(left, right, peak) {
  const top = Math.max(...left.map(Math.abs), ...right.map(Math.abs));
  const data = Buffer.alloc(left.length * 4);
  for (let i = 0; i < left.length; i++) {
    data.writeInt16LE(Math.round((left[i] / top) * peak * 32767), i * 4);
    data.writeInt16LE(Math.round((right[i] / top) * peak * 32767), i * 4 + 2);
  }
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write("WAVEfmt ", 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(2, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 4, 28);
  head.writeUInt16LE(4, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

/** Air moving past: noise through a band-pass filter whose pitch rises and falls, drifting left to right. */
function whoosh(seconds = 0.75) {
  const n = Math.round(seconds * RATE);
  const rand = noise(7);
  const left = new Array(n);
  const right = new Array(n);
  let low = 0;
  let band = 0;
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const cutoff = 350 + 2400 * Math.sin(Math.PI * k ** 0.8);
    const f = 2 * Math.sin((Math.PI * cutoff) / RATE);
    const high = rand() - low - 0.9 * band; // state-variable filter, damping 0.9
    band += f * high;
    low += f * band;
    const env = k ** 0.7 * (1 - k) ** 1.8;
    const pan = (0.3 + 0.4 * k) * (Math.PI / 2);
    left[i] = band * env * Math.cos(pan);
    right[i] = band * env * Math.sin(pan);
  }
  return wav(left, right, 0.5);
}

/** A stamp coming down: a sine that drops from about 130 Hz to 40 Hz, with a short click on top. */
function thud(seconds = 0.9) {
  const n = Math.round(seconds * RATE);
  const rand = noise(11);
  const mono = new Array(n);
  let phase = 0;
  let click = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    phase += (2 * Math.PI * (40 + 90 * Math.exp(-t / 0.045))) / RATE;
    click += 0.25 * (rand() - click); // a one-pole low-pass keeps the click from hissing
    const body = Math.sin(phase) * Math.exp(-t / 0.2) + 0.25 * Math.sin(2 * phase) * Math.exp(-t / 0.07);
    const tail = Math.min(1, (seconds - t) / 0.03);
    mono[i] = Math.tanh(1.3 * (body + 0.6 * click * Math.exp(-t / 0.006))) * tail;
  }
  return wav(mono, mono, 0.85);
}

mkdirSync(OUT, { recursive: true });
for (const [name, bytes] of [["whoosh.wav", whoosh()], ["thud.wav", thud()]]) {
  writeFileSync(new URL(name, OUT), bytes);
  console.log(`${name}: ${(bytes.length / 1024).toFixed(0)} KB`);
}
