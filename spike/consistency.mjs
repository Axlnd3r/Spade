// SIDAK consistency experiment: appraise every dataset in its original order
// and in 3 permutations, then refresh the generated block of docs/EXPERIMENT.md.
// Usage:
//   node spike/consistency.mjs --list-models
//   node spike/consistency.mjs --model <id> [--seed 42] [--concurrency 4]
//   node spike/consistency.mjs --dry-run        (fake prices, prints to stdout, writes nothing)
//
// Exit codes are set through process.exitCode, never process.exit(): on Windows,
// process.exit() after fetch() aborts Node with a libuv assertion (exit 127).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import {
  permutations, rawHash, buildMessages, parseReply, summarize, renderExperimentMd,
  mergeGenerated, parseRunOptions, classifyStatus, readCompletion,
} from "./lib.mjs";
import { loadDatasets } from "./datasets.mjs";

const API = "https://cloud-api.near.ai/v1";
const TIMEOUT_MS = 30000;
const MAX_TOKENS = 120;
const PERMUTATIONS = 3;
const RETRY_DELAYS_MS = [2000, 4000];
const MAX_RETRY_AFTER_MS = 30000;
const KEPT_BODY_CHARS = 500;

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
const headers = {
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
  "x-no-aliasing": "true",
};

class FatalApiError extends Error {}
const stop = new AbortController();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const transportError = (e) => (e.name === "TimeoutError" ? "timeout" : "network");

function retryDelayMs(res, attempt) {
  const after = Number(res.headers.get("retry-after"));
  return Number.isFinite(after) && after > 0 ? Math.min(after * 1000, MAX_RETRY_AFTER_MS) : RETRY_DELAYS_MS[attempt];
}

async function listModels() {
  const res = await fetch(`${API}/models`, { headers });
  if (!res.ok) {
    console.error(`GET /models failed: HTTP ${res.status}`);
    return 1;
  }
  const body = await res.json();
  for (const m of body.data ?? body.models ?? body) console.log(JSON.stringify(m));
  return 0;
}

async function appraise(model, prompt, lines) {
  if (args["dry-run"]) {
    return { price: (parseInt(rawHash(lines).slice(0, 8), 16) % 10000) + 1, reason: "dry run", latencyMs: 0, attempts: 1 };
  }
  const body = JSON.stringify({ model, messages: buildMessages(prompt, lines), temperature: 0, max_tokens: MAX_TOKENS });
  for (let attempt = 0; ; attempt++) {
    const attempts = attempt + 1;
    const t0 = performance.now();
    const elapsed = () => Math.round(performance.now() - t0);
    let res;
    let text;
    try {
      res = await fetch(`${API}/chat/completions`, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.any([AbortSignal.timeout(TIMEOUT_MS), stop.signal]),
      });
      const kind = classifyStatus(res.status);
      if (kind === "fatal") throw new FatalApiError(`HTTP ${res.status} from NEAR AI: check NEAR_AI_API_KEY and its credits or spending limit`);
      if (kind === "retry" && attempt < RETRY_DELAYS_MS.length) {
        const delay = retryDelayMs(res, attempt);
        await res.body?.cancel();
        await sleep(delay);
        continue;
      }
      text = await res.text();
    } catch (e) {
      if (e instanceof FatalApiError) throw e;
      return { price: null, latencyMs: elapsed(), attempts, error: transportError(e) };
    }
    const latencyMs = elapsed();
    if (!res.ok) return { price: null, latencyMs, attempts, error: `http_${res.status}`, content: text.slice(0, KEPT_BODY_CHARS) };

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { price: null, latencyMs, attempts, error: "bad_body", content: text.slice(0, KEPT_BODY_CHARS) };
    }
    const c = readCompletion(data);
    const info = { latencyMs, attempts, finishReason: c.finishReason, chatId: c.chatId };
    if (!c.ok) return { price: null, ...info, error: "bad_body", content: text.slice(0, KEPT_BODY_CHARS) };
    const parsed = parseReply(c.content);
    if (!parsed) return { price: null, ...info, error: "unparsable", content: c.content };
    return { ...parsed, ...info };
  }
}

async function runExperiment() {
  const model = args["dry-run"] ? "dry-run" : args.model ?? process.env.NEAR_AI_MODEL;
  if (!model) {
    console.error("Pass --model <id> or set NEAR_AI_MODEL. List models with --list-models.");
    return 1;
  }
  let opts;
  try {
    opts = parseRunOptions({ seed: args.seed, concurrency: args.concurrency });
  } catch (e) {
    console.error(e.message);
    return 1;
  }
  const { seed, concurrency } = opts;
  const prompt = readFileSync(new URL("../enclave/appraiser/prompt.txt", import.meta.url), "utf8");
  const promptSha256 = createHash("sha256").update(prompt, "utf8").digest("hex");

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
  let fatal = null;
  async function worker() {
    while (next < jobs.length && !stop.signal.aborted) {
      const job = jobs[next++];
      let r;
      try {
        r = await appraise(model, prompt, job.lines);
      } catch (e) {
        if (!(e instanceof FatalApiError)) throw e;
        fatal ??= e;
        stop.abort();
        return;
      }
      records.push({ dataset: job.dataset, category: job.category, order: job.order, rawHash: rawHash(job.lines), ...r });
      process.stderr.write(`\r${records.length}/${jobs.length}`);
    }
  }
  // Workers stop on the first fatal error; every in-flight request settles before we return.
  await Promise.all(Array.from({ length: concurrency }, worker));
  process.stderr.write("\n");
  if (fatal) {
    console.error(`${fatal.message}. Nothing was written.`);
    return 1;
  }

  const date = new Date().toISOString();
  let commit = "unknown";
  try {
    commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    // Not a git checkout.
  }
  const meta = { model, date, seed, runs: records.length, promptSha256, commit, concurrency };
  const generated = renderExperimentMd(summarize(records), meta);

  if (args["dry-run"]) {
    // Fake hash-derived prices: show the report, never touch committed files.
    console.log(generated);
    return 0;
  }

  const resultsDir = new URL("./results/", import.meta.url);
  mkdirSync(resultsDir, { recursive: true });
  const resultFile = new URL(`${date.replace(/[:.]/g, "-")}-${model.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`, resultsDir);
  writeFileSync(resultFile, JSON.stringify({ ...meta, records }, null, 2) + "\n");

  const mdFile = new URL("../docs/EXPERIMENT.md", import.meta.url);
  const existing = existsSync(mdFile) ? readFileSync(mdFile, "utf8") : null;
  writeFileSync(mdFile, mergeGenerated(existing, generated));
  console.log(`wrote ${fileURLToPath(resultFile)} and docs/EXPERIMENT.md`);
  return 0;
}

if (!args["dry-run"] && !apiKey) {
  console.error("NEAR_AI_API_KEY is not set. Copy .env.example to .env and fill it in.");
  process.exitCode = 1;
} else {
  process.exitCode = args["list-models"] ? await listModels() : await runExperiment();
}
