import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize, renderExperimentMd, mergeGenerated, parseRunOptions, classifyStatus, readCompletion } from "./lib.mjs";

const records = [
  { dataset: "d1", category: "normal", order: "orig", price: 100, latencyMs: 1000, attempts: 1 },
  { dataset: "d1", category: "normal", order: "perm1", price: null, latencyMs: 900, attempts: 1, error: "unparsable" },
  { dataset: "d1", category: "normal", order: "perm2", price: null, latencyMs: 30000, attempts: 1, error: "timeout" },
  { dataset: "d1", category: "normal", order: "perm3", price: 120, latencyMs: 1100, attempts: 3 },
  { dataset: "d2", category: "adversarial", order: "orig", price: null, latencyMs: 50, attempts: 3, error: "http_503" },
  { dataset: "d2", category: "adversarial", order: "perm1", price: 5, latencyMs: 40, attempts: 1, error: undefined },
];

test("summarize counts failed calls by error type and retried calls", () => {
  assert.deepEqual(summarize(records).calls, {
    total: 6,
    failed: 3,
    byError: { unparsable: 1, timeout: 1, http_503: 1 },
    retried: 2,
  });
});

test("renderExperimentMd reports failed calls and reproducibility metadata", () => {
  const md = renderExperimentMd(summarize(records), {
    model: "m", date: "d", seed: 42, runs: 6, promptSha256: "ab".repeat(32), commit: "abc1234", concurrency: 4,
  });
  assert.match(md, /Failed calls: 3 of 6 \(http_503 1, timeout 1, unparsable 1\)/);
  assert.match(md, /Calls retried: 2/);
  assert.match(md, new RegExp(`Prompt sha256: \`${"ab".repeat(32)}\``));
  assert.match(md, /Commit: `abc1234`/);
  assert.match(md, /Concurrency: 4/);
});

test("mergeGenerated replaces only the generated block and keeps hand-written analysis", () => {
  const first = mergeGenerated(null, "TABLE v1");
  assert.match(first, /<!-- generated:start -->\nTABLE v1\n<!-- generated:end -->/);
  assert.match(first, /## Analysis/);
  const edited = first.replace("## Analysis\n", "## Analysis\n\nProposal: threshold_bps = 2500\n");
  const second = mergeGenerated(edited, "TABLE v2");
  assert.match(second, /TABLE v2/);
  assert.doesNotMatch(second, /TABLE v1/);
  assert.match(second, /Proposal: threshold_bps = 2500/);
});

test("mergeGenerated refuses a file without markers instead of clobbering it", () => {
  assert.throws(() => mergeGenerated("# hand-written only\n", "TABLE"), /markers/);
});

test("parseRunOptions accepts integer seed and concurrency 1..4", () => {
  assert.deepEqual(parseRunOptions({ seed: "42", concurrency: "4" }), { seed: 42, concurrency: 4 });
  assert.deepEqual(parseRunOptions({ seed: "0", concurrency: "1" }), { seed: 0, concurrency: 1 });
});

test("parseRunOptions rejects bad seed and concurrency", () => {
  for (const bad of [{ seed: "abc", concurrency: "4" }, { seed: "1.5", concurrency: "4" },
    { seed: "42", concurrency: "0" }, { seed: "42", concurrency: "5" }, { seed: "42", concurrency: "abc" }]) {
    assert.throws(() => parseRunOptions(bad), /seed|concurrency/, JSON.stringify(bad));
  }
});

test("classifyStatus separates fatal auth errors, retryable errors, failures and success", () => {
  assert.equal(classifyStatus(200), "ok");
  assert.equal(classifyStatus(401), "fatal");
  assert.equal(classifyStatus(403), "fatal");
  assert.equal(classifyStatus(429), "retry");
  assert.equal(classifyStatus(503), "retry");
  assert.equal(classifyStatus(400), "fail");
  assert.equal(classifyStatus(404), "fail");
});

test("readCompletion extracts content, finish reason and chat id, flagging bad bodies", () => {
  assert.deepEqual(readCompletion({ id: "c1", choices: [{ message: { content: "{}" }, finish_reason: "stop" }] }),
    { ok: true, content: "{}", finishReason: "stop", chatId: "c1" });
  assert.deepEqual(readCompletion({ id: "c2", choices: [{ message: { content: null }, finish_reason: "length" }] }),
    { ok: false, content: null, finishReason: "length", chatId: "c2" });
  assert.equal(readCompletion(null).ok, false);
  assert.equal(readCompletion({ choices: [] }).ok, false);
});
