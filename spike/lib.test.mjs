import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  normalizeLines,
  validate,
  rawHash,
  canonicalHash,
  permutations,
  isCaught,
  relDiffBps,
  buildMessages,
  parseReply,
  summarize,
  renderExperimentMd,
} from "./lib.mjs";

const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");

test("normalizeLines trims ASCII space/tab/CR at both ends and drops empty lines", () => {
  assert.deepEqual(normalizeLines("  a \r\n\r\nb\t\n\n"), ["a", "b"]);
});

test("normalizeLines keeps non-ASCII whitespace (NBSP, BOM)", () => {
  assert.deepEqual(normalizeLines(" x﻿"), [" x﻿"]);
});

test("CRLF and LF inputs hash identically", () => {
  const lf = "one\ntwo\nthree\n";
  const crlf = "one\r\ntwo\r\nthree\r\n";
  assert.equal(rawHash(normalizeLines(crlf)), rawHash(normalizeLines(lf)));
});

test("rawHash is sha256 of lines joined by \\n", () => {
  assert.equal(rawHash(["a", "b"]), sha("a\nb"));
});

test("canonicalHash ignores order, rawHash does not", () => {
  assert.equal(canonicalHash(["b", "a"]), canonicalHash(["a", "b"]));
  assert.notEqual(canonicalHash(["b", "a"]), rawHash(["b", "a"]));
});

test("canonicalHash sorts by UTF-8 bytes, not UTF-16 code units", () => {
  // UTF-16 puts the emoji (0xD83D) before fullwidth z (0xFF5A); UTF-8 puts it after.
  assert.deepEqual(["😀", "ｚ"].sort(), ["😀", "ｚ"]);
  assert.equal(canonicalHash(["😀", "ｚ", "é", "Z"]), rawHash(["Z", "é", "ｚ", "😀"]));
});

test("validate enforces row and byte limits on the raw text", () => {
  const rows = (n) => Array.from({ length: n }, (_, i) => `r${i}`).join("\n");
  const check = (text) => validate(text, normalizeLines(text));
  assert.deepEqual(check(rows(4)), { ok: false, code: "too_few_rows" });
  assert.deepEqual(check(rows(5)), { ok: true });
  assert.deepEqual(check(rows(100)), { ok: true });
  assert.deepEqual(check(rows(101)), { ok: false, code: "too_many_rows" });
  const base = rows(5) + "\n";
  const exact = base + "x".repeat(2000 - Buffer.byteLength(base));
  assert.equal(Buffer.byteLength(exact), 2000);
  assert.deepEqual(check(exact), { ok: true });
  assert.deepEqual(check(exact + "x"), { ok: false, code: "too_large" });
});

test("validate counts bytes before normalization", () => {
  const text = rows5WithPadding(2001);
  assert.deepEqual(validate(text, normalizeLines(text)), { ok: false, code: "too_large" });
});

function rows5WithPadding(totalBytes) {
  const body = "a\nb\nc\nd\ne";
  return body + " ".repeat(totalBytes - body.length);
}

test("isCaught applies the M-11 integer formula", () => {
  assert.equal(isCaught(100, 125, 2500), false);
  assert.equal(isCaught(100, 134, 2500), true);
  assert.equal(isCaught(134, 100, 2500), true);
  assert.equal(isCaught(7, 7, 500), false);
  assert.equal(isCaught(10000, 1, 5000), true);
});

test("relDiffBps floors (max-min)*10000/max", () => {
  assert.equal(relDiffBps(100, 125), 2000);
  assert.equal(relDiffBps(130, 100), 2307);
  assert.equal(relDiffBps(5, 5), 0);
});

test("permutations are deterministic, distinct, and keep the canonical hash", () => {
  const lines = ["a", "a", "b", "c", "d"];
  const perms = permutations(lines, 3, 42);
  assert.equal(perms.length, 3);
  const hashes = new Set(perms.map(rawHash));
  assert.equal(hashes.size, 3);
  assert.ok(!hashes.has(rawHash(lines)));
  for (const p of perms) assert.equal(canonicalHash(p), canonicalHash(lines));
  assert.deepEqual(permutations(lines, 3, 42), perms);
});

test("permutations stop at the number of distinct orders", () => {
  assert.deepEqual(permutations(["x", "x", "x", "x", "x"], 3, 42), []);
  assert.equal(permutations(["a", "a", "a", "a", "b"], 10, 1).length, 4);
});

test("buildMessages sends the prompt as system and lines in received order as user", () => {
  assert.deepEqual(buildMessages("P", ["b", "a"]), [
    { role: "system", content: "P" },
    { role: "user", content: "b\na" },
  ]);
});

test("parseReply reads clean, fenced, and wrapped JSON", () => {
  assert.deepEqual(parseReply('{"price": 300, "reason": "ok"}'), { price: 300, reason: "ok" });
  assert.equal(parseReply('```json\n{"price": 42, "reason": "x"}\n```').price, 42);
  assert.equal(parseReply('Here: {"price": 77, "reason": "y"} thanks').price, 77);
});

test("parseReply coerces and clamps price into 1..10000", () => {
  const p = (v) => parseReply(JSON.stringify({ price: v, reason: "r" }))?.price;
  assert.equal(p("300"), 300);
  assert.equal(p(3.7), 4);
  assert.equal(p(0), 1);
  assert.equal(p(-5), 1);
  assert.equal(p(20000), 10000);
});

test("parseReply returns null when there is no usable price", () => {
  assert.equal(parseReply("I cannot appraise this."), null);
  assert.equal(parseReply('{"reason": "no price"}'), null);
  assert.equal(parseReply('{"price": "abc", "reason": "r"}'), null);
  assert.equal(parseReply('{"price": null, "reason": "r"}'), null);
});

test("parseReply strips control characters and cuts reason to 140 code points", () => {
  const r = (v) => parseReply(JSON.stringify({ price: 1, reason: v })).reason;
  assert.equal(r("a\u0000b\nc\u007F"), "abc");
  assert.equal([...r("😀".repeat(150))].length, 140);
  assert.equal(parseReply('{"price": 5}').reason, "");
});

const records = [
  { dataset: "d1", category: "normal", order: "orig", price: 100, latencyMs: 1000 },
  { dataset: "d1", category: "normal", order: "perm1", price: 130, latencyMs: 3000 },
  { dataset: "d1", category: "normal", order: "perm2", price: null, latencyMs: 30000, error: "timeout" },
  { dataset: "d2", category: "adversarial", order: "orig", price: 1000, latencyMs: 2000 },
  { dataset: "d2", category: "adversarial", order: "perm1", price: 100, latencyMs: 4000 },
];

test("summarize pairs each permutation with its original and counts catches per threshold", () => {
  const s = summarize(records);
  assert.deepEqual(s.byCategory.normal, {
    pairs: 1,
    failed: 1,
    rate: { 500: 1, 1000: 1, 2500: 0, 5000: 0 },
    diffs: [2307],
  });
  assert.deepEqual(s.byCategory.adversarial.rate, { 500: 1, 1000: 1, 2500: 1, 5000: 1 });
  assert.deepEqual(s.latency, { avgMs: 8000, maxMs: 30000, timeouts: 1, httpErrors: 0 });
});

test("renderExperimentMd shows every threshold and the model", () => {
  const md = renderExperimentMd(summarize(records), { model: "m-x", date: "2026-11-10", seed: 42, runs: 5 });
  assert.match(md, /m-x/);
  for (const t of ["5%", "10%", "25%", "50%"]) assert.match(md, new RegExp(`\\| ${t} \\|`));
});
