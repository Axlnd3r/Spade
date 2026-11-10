// SIDAK consistency experiment: appraise every dataset in its original order
// and in 3 permutations, then write docs/EXPERIMENT.md.
// Usage:
//   node spike/consistency.mjs --list-models
//   node spike/consistency.mjs --model <id> [--seed 42] [--concurrency 4]
//   node spike/consistency.mjs --dry-run
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { permutations, rawHash, buildMessages, parseReply, summarize, renderExperimentMd } from "./lib.mjs";
import { loadDatasets } from "./datasets.mjs";

const API = "https://cloud-api.near.ai/v1";
const TIMEOUT_MS = 30000;
const MAX_TOKENS = 120;
const PERMUTATIONS = 3;
const RETRY_DELAYS_MS = [2000, 4000];

const { values: args } = parseArgs({
  options: {
    "list-models": { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    model: { type: "string" },
    seed: { type: "string", default: "42" },
    concurrency: { type: "string", default: "4" },
  },
});

try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  // No .env file: rely on the process environment.
}
const apiKey = process.env.NEAR_AI_API_KEY;
if (!args["dry-run"] && !apiKey) {
  console.error("NEAR_AI_API_KEY is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}
const headers = {
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
  "x-no-aliasing": "true",
};

if (args["list-models"]) {
  const res = await fetch(`${API}/models`, { headers });
  if (!res.ok) {
    console.error(`GET /models failed: HTTP ${res.status}`);
    process.exit(1);
  }
  const body = await res.json();
  for (const m of body.data ?? body.models ?? body) console.log(JSON.stringify(m));
  process.exit(0);
}

const model = args["dry-run"] ? "dry-run" : args.model ?? process.env.NEAR_AI_MODEL;
if (!model) {
  console.error("Pass --model <id> or set NEAR_AI_MODEL. List models with --list-models.");
  process.exit(1);
}
const seed = Number(args.seed);
const prompt = readFileSync(new URL("../enclave/appraiser/prompt.txt", import.meta.url), "utf8");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function appraise(lines) {
  if (args["dry-run"]) {
    return { price: (parseInt(rawHash(lines).slice(0, 8), 16) % 10000) + 1, reason: "dry run", latencyMs: 0 };
  }
  const body = JSON.stringify({ model, messages: buildMessages(prompt, lines), temperature: 0, max_tokens: MAX_TOKENS });
  for (let attempt = 0; ; attempt++) {
    const t0 = performance.now();
    try {
      const res = await fetch(`${API}/chat/completions`, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const latencyMs = Math.round(performance.now() - t0);
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      if (!res.ok) return { price: null, latencyMs, error: `http_${res.status}` };
      const data = await res.json();
      const parsed = parseReply(data.choices?.[0]?.message?.content ?? "");
      if (!parsed) return { price: null, latencyMs, error: "unparsable", chatId: data.id };
      return { ...parsed, latencyMs, chatId: data.id };
    } catch (e) {
      const latencyMs = Math.round(performance.now() - t0);
      return { price: null, latencyMs, error: e.name === "TimeoutError" ? "timeout" : "network" };
    }
  }
}

const jobs = loadDatasets().flatMap((d) =>
  [d.lines, ...permutations(d.lines, PERMUTATIONS, seed)].map((lines, i) => ({
    dataset: d.name,
    category: d.category,
    order: i === 0 ? "orig" : `perm${i}`,
    lines,
  })),
);

const records = [];
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++];
    const r = await appraise(job.lines);
    records.push({ dataset: job.dataset, category: job.category, order: job.order, rawHash: rawHash(job.lines), ...r });
    process.stdout.write(`\r${records.length}/${jobs.length}`);
  }
}
await Promise.all(Array.from({ length: Number(args.concurrency) }, worker));
process.stdout.write("\n");

const date = new Date().toISOString();
const resultsDir = new URL("./results/", import.meta.url);
mkdirSync(resultsDir, { recursive: true });
const resultFile = new URL(`${date.replace(/[:.]/g, "-")}-${model.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`, resultsDir);
writeFileSync(resultFile, JSON.stringify({ model, seed, date, records }, null, 2) + "\n");

const md = renderExperimentMd(summarize(records), { model, date, seed, runs: records.length });
writeFileSync(new URL("../docs/EXPERIMENT.md", import.meta.url), md);
console.log(`wrote ${fileURLToPath(resultFile)} and docs/EXPERIMENT.md`);
