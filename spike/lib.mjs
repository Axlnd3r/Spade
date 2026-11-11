// Pure logic for the SIDAK consistency spike. The normalization, hashing and
// catch rule here are the reference for the contract and the enclave
// (docs/DECISIONS.md D-2, D-3); vectors in enclave/appraiser/vectors pin them.
import { createHash } from "node:crypto";

export const DEFAULT_LIMITS = { minRows: 5, maxRows: 100, maxDataBytes: 2000 };
export const THRESHOLDS_BPS = [500, 1000, 2500, 5000];
export const PRICE_MIN = 1;
export const PRICE_MAX = 10000;
export const REASON_MAX_CHARS = 140;

const EDGE_WS = /^[ \t\r]+|[ \t\r]+$/g;
const CONTROL = /[\u0000-\u001F\u007F]/g;

export function normalizeLines(text) {
  return text
    .split("\n")
    .map((line) => line.replace(EDGE_WS, ""))
    .filter((line) => line.length > 0);
}

export function validate(text, lines, p = DEFAULT_LIMITS) {
  if (Buffer.byteLength(text, "utf8") > p.maxDataBytes) return { ok: false, code: "too_large" };
  if (lines.length < p.minRows) return { ok: false, code: "too_few_rows" };
  if (lines.length > p.maxRows) return { ok: false, code: "too_many_rows" };
  return { ok: true };
}

export function rawHash(lines) {
  return createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");
}

export function canonicalHash(lines) {
  const sorted = lines.slice().sort((x, y) => Buffer.compare(Buffer.from(x, "utf8"), Buffer.from(y, "utf8")));
  return rawHash(sorted);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAX_SHUFFLE_ATTEMPTS = 200;

export function permutations(lines, count, seed) {
  const rand = mulberry32(seed);
  const seen = new Set([rawHash(lines)]);
  const out = [];
  for (let attempt = 0; attempt < MAX_SHUFFLE_ATTEMPTS && out.length < count; attempt++) {
    const p = lines.slice();
    for (let i = p.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    const h = rawHash(p);
    if (seen.has(h)) continue;
    seen.add(h);
    out.push(p);
  }
  return out;
}

export function isCaught(p1, p2, thresholdBps) {
  const hi = BigInt(Math.max(p1, p2));
  const lo = BigInt(Math.min(p1, p2));
  return (hi - lo) * 10000n > BigInt(thresholdBps) * hi;
}

export function relDiffBps(p1, p2) {
  const hi = Math.max(p1, p2);
  const lo = Math.min(p1, p2);
  return Math.floor(((hi - lo) * 10000) / hi);
}

export function buildMessages(prompt, lines) {
  return [
    { role: "system", content: prompt },
    { role: "user", content: lines.join("\n") },
  ];
}

function toPrice(v) {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(PRICE_MAX, Math.max(PRICE_MIN, Math.round(n)));
}

export function parseReply(content) {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  let obj;
  try {
    obj = JSON.parse(content.slice(start, end + 1));
  } catch {
    return null;
  }
  const price = toPrice(obj?.price);
  if (price === null) return null;
  const reasonRaw = typeof obj.reason === "string" ? obj.reason : "";
  const reason = [...reasonRaw.replace(CONTROL, "")].slice(0, REASON_MAX_CHARS).join("");
  return { price, reason };
}

export function summarize(records, thresholdsBps = THRESHOLDS_BPS) {
  const byDataset = new Map();
  for (const r of records) {
    if (!byDataset.has(r.dataset)) byDataset.set(r.dataset, []);
    byDataset.get(r.dataset).push(r);
  }

  const byCategory = {};
  for (const recs of byDataset.values()) {
    const orig = recs.find((r) => r.order === "orig");
    const cat = (byCategory[recs[0].category] ??= { pairs: 0, failed: 0, caught: {}, diffs: [] });
    for (const r of recs) {
      if (r.order === "orig") continue;
      if (orig?.price == null || r.price == null) {
        cat.failed++;
        continue;
      }
      cat.pairs++;
      cat.diffs.push(relDiffBps(orig.price, r.price));
      for (const t of thresholdsBps) {
        if (isCaught(orig.price, r.price, t)) cat.caught[t] = (cat.caught[t] ?? 0) + 1;
      }
    }
  }
  for (const cat of Object.values(byCategory)) {
    cat.rate = Object.fromEntries(
      thresholdsBps.map((t) => [t, cat.pairs ? (cat.caught[t] ?? 0) / cat.pairs : null]),
    );
    delete cat.caught;
  }

  const lat = records.filter((r) => typeof r.latencyMs === "number").map((r) => r.latencyMs);
  const latency = {
    avgMs: lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : null,
    maxMs: lat.length ? Math.max(...lat) : null,
    timeouts: records.filter((r) => r.error === "timeout").length,
    httpErrors: records.filter((r) => typeof r.error === "string" && r.error.startsWith("http_")).length,
  };
  const byError = {};
  for (const r of records) if (r.error) byError[r.error] = (byError[r.error] ?? 0) + 1;
  const calls = {
    total: records.length,
    failed: records.filter((r) => r.error).length,
    byError,
    retried: records.filter((r) => (r.attempts ?? 1) > 1).length,
  };
  return { byCategory, latency, calls };
}

export function parseRunOptions({ seed, concurrency }) {
  if (!/^\d+$/.test(String(seed))) throw new Error(`--seed must be a non-negative integer, got "${seed}"`);
  if (!/^[1-4]$/.test(String(concurrency))) throw new Error(`--concurrency must be 1..4, got "${concurrency}"`);
  return { seed: Number(seed), concurrency: Number(concurrency) };
}

export function classifyStatus(status) {
  if (status >= 200 && status < 300) return "ok";
  if (status === 401 || status === 402 || status === 403) return "fatal";
  if (status === 429 || status >= 500) return "retry";
  return "fail";
}

export function readCompletion(data) {
  const choice = data?.choices?.[0];
  const content = choice?.message?.content ?? null;
  return {
    ok: typeof content === "string",
    content,
    finishReason: choice?.finish_reason ?? null,
    chatId: data?.id ?? null,
  };
}

const GEN_START = "<!-- generated:start -->";
const GEN_END = "<!-- generated:end -->";

export function mergeGenerated(existing, generated) {
  const block = `${GEN_START}\n${generated.trimEnd()}\n${GEN_END}`;
  if (existing == null) {
    return `${block}\n\n## Analysis\n\n_Written by hand after each run; the runner never touches this section._\n`;
  }
  const start = existing.indexOf(GEN_START);
  const end = existing.indexOf(GEN_END);
  if (start < 0 || end < start) {
    throw new Error("docs/EXPERIMENT.md has no generated:start/end markers; refusing to overwrite it");
  }
  return existing.slice(0, start) + block + existing.slice(end + GEN_END.length);
}

function percentile(values, q) {
  if (!values.length) return null;
  const s = values.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)];
}

const pct = (x) => (x == null ? "n/a" : `${(x * 100).toFixed(1)}%`);
const bpsPct = (x) => (x == null ? "n/a" : `${(x / 100).toFixed(2)}%`);

export function renderExperimentMd(summary, meta) {
  const cats = ["normal", "adversarial"].filter((c) => summary.byCategory[c]);
  const thresholds = Object.keys(summary.byCategory[cats[0]]?.rate ?? {}).map(Number);
  const row = (cells) => `| ${cells.join(" | ")} |`;
  const lines = [
    "# Experiment: SIDAK consistency",
    "",
    `- Model: \`${meta.model}\``,
    `- Date: ${meta.date}`,
    `- Seed: ${meta.seed}`,
    `- Calls: ${meta.runs}`,
    `- Prompt sha256: \`${meta.promptSha256}\``,
    `- Commit: \`${meta.commit}\``,
    `- Concurrency: ${meta.concurrency}`,
    "- Method: each dataset is appraised in its original order and in 3 random permutations; each (original, permutation) pair counts as one challenge. Percentiles use the nearest-rank method. `temperature: 0` reduces but does not remove run-to-run variation.",
    "",
    "## Catch rate per threshold",
    "",
    row(["Threshold", ...cats]),
    row(["---", ...cats.map(() => "---")]),
    ...thresholds.map((t) =>
      row([`${t / 100}%`, ...cats.map((c) => {
        const k = summary.byCategory[c];
        const caught = Math.round((k.rate[t] ?? 0) * k.pairs);
        return `${pct(k.rate[t])} (${caught}/${k.pairs})`;
      })]),
    ),
    "",
    "## Relative difference |p1-p2|/max",
    "",
    row(["Category", "pairs", "failed", "p50", "p90", "max"]),
    row(["---", "---", "---", "---", "---", "---"]),
    ...cats.map((c) => {
      const k = summary.byCategory[c];
      return row([c, k.pairs, k.failed, bpsPct(percentile(k.diffs, 0.5)), bpsPct(percentile(k.diffs, 0.9)), bpsPct(percentile(k.diffs, 1))]);
    }),
    "",
    "## Latency",
    "",
    `- Average: ${summary.latency.avgMs} ms`,
    `- Max: ${summary.latency.maxMs} ms`,
    `- Timeouts: ${summary.latency.timeouts}`,
    `- HTTP errors: ${summary.latency.httpErrors}`,
    "",
    "## Calls",
    "",
    `- Failed calls: ${summary.calls.failed} of ${summary.calls.total} (${
      Object.entries(summary.calls.byError).sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${k} ${n}`).join(", ") || "none"
    })`,
    `- Calls retried: ${summary.calls.retried}`,
    "",
  ];
  return lines.join("\n");
}
