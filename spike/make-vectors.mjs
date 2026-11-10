// Writes enclave/appraiser/vectors/vectors.json: shared normalization and hash
// cases that the contract (S2) and enclave (S3) tests must reproduce exactly.
// Usage: node spike/make-vectors.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { normalizeLines, validate, rawHash, canonicalHash } from "./lib.mjs";

const rows = (n) => Array.from({ length: n }, (_, i) => `row ${i + 1}`).join("\n");
const padTo = (text, bytes) => text + "x".repeat(bytes - Buffer.byteLength(text, "utf8"));
const dataset = (path) => readFileSync(new URL(`./datasets/${path}`, import.meta.url), "utf8");

const cases = [
  ["crlf", "one\r\ntwo\r\nthree\r\nfour\r\nfive\r\n"],
  ["edge_whitespace", "  a \t\n\tb\r\n c\n d \n\n\ne  \n"],
  ["non_ascii_whitespace_kept", " x﻿\nb\nc\nd\ne"],
  ["utf8_sort_order", "😀\nｚ\né\nZ\nz"],
  ["duplicate_lines", "a\na\nb\nc\nd"],
  ["rows_4", rows(4)],
  ["rows_5", rows(5)],
  ["rows_100", rows(100)],
  ["rows_101", rows(101)],
  ["bytes_2000", padTo(rows(5) + "\n", 2000)],
  ["bytes_2001", padTo(rows(5) + "\n", 2001)],
  ["only_blank_lines", "\n\n \t\n\r\n"],
  ["dataset_n01", dataset("normal/n01.txt")],
  ["dataset_n16_cjk", dataset("normal/n16.txt")],
  ["dataset_a03_adversarial", dataset("adversarial/a03.txt")],
];

const vectors = cases.map(([name, input]) => {
  const lines = normalizeLines(input);
  const res = validate(input, lines);
  return {
    name,
    input,
    lines,
    raw_hash: rawHash(lines),
    canonical_hash: canonicalHash(lines),
    valid: res.ok,
    ...(res.ok ? {} : { error_code: res.code }),
  };
});

const out = new URL("../enclave/appraiser/vectors/vectors.json", import.meta.url);
writeFileSync(out, JSON.stringify(vectors, null, 2) + "\n");
console.log(`wrote ${vectors.length} vectors`);
