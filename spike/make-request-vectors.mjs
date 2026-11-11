// Writes enclave/appraiser/vectors/request.json: sha256 of the exact chat
// completion body the spike sends, so the enclave (S3) can prove its body is
// byte-identical (the NEAR AI signature covers sha256 of the request body).
// Rerun after any change to prompt.txt.
// Usage: node spike/make-request-vectors.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { normalizeLines, buildMessages } from "./lib.mjs";

const MODEL = "Qwen/Qwen3-VL-30B-A3B-Instruct";
const MAX_TOKENS = 120;
const prompt = readFileSync(new URL("../enclave/appraiser/prompt.txt", import.meta.url), "utf8");
const dataset = (path) => readFileSync(new URL(`./datasets/${path}`, import.meta.url), "utf8");

const cases = [
  ["two_lines", ["a", "b"]],
  ["order_kept", ["b", "a"]],
  ["quote_and_backslash", ['say "hi"', "path C:\\tmp", "c", "d", "e"]],
  ["inner_tab_and_control", ["a\tb", "x\u0001y", "c", "d", "e"]],
  ["cjk_and_emoji", ["東京 1400万", "😀 smile", "é", "ｚ", "Z"]],
  ["dataset_n01", normalizeLines(dataset("normal/n01.txt"))],
];

// Same object shape and key order as spike/consistency.mjs.
const body = (lines) =>
  JSON.stringify({ model: MODEL, messages: buildMessages(prompt, lines), temperature: 0, max_tokens: MAX_TOKENS });

const vectors = cases.map(([name, lines]) => ({
  name,
  lines,
  body_sha256: createHash("sha256").update(body(lines)).digest("hex"),
}));

const out = new URL("../enclave/appraiser/vectors/request.json", import.meta.url);
writeFileSync(out, JSON.stringify(vectors, null, 2) + "\n");
console.log(`wrote ${vectors.length} request vectors to enclave/appraiser/vectors/request.json`);
