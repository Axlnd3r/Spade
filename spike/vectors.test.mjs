import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeLines, validate, rawHash, canonicalHash } from "./lib.mjs";

const vectors = JSON.parse(
  readFileSync(new URL("../enclave/appraiser/vectors/vectors.json", import.meta.url), "utf8"),
);

test("vectors cover the review-focus cases and every limit boundary", () => {
  const names = vectors.map((v) => v.name);
  for (const n of ["crlf", "edge_whitespace", "non_ascii_whitespace_kept", "utf8_sort_order", "duplicate_lines",
    "rows_4", "rows_5", "rows_100", "rows_101", "bytes_2000", "bytes_2001", "only_blank_lines"]) {
    assert.ok(names.includes(n), `missing vector ${n}`);
  }
});

for (const v of vectors) {
  test(`vector ${v.name} matches lib.mjs`, () => {
    const lines = normalizeLines(v.input);
    assert.deepEqual(lines, v.lines);
    assert.equal(rawHash(lines), v.raw_hash);
    assert.equal(canonicalHash(lines), v.canonical_hash);
    const res = validate(v.input, lines);
    assert.equal(res.ok, v.valid);
    assert.equal(res.ok ? undefined : res.code, v.error_code);
  });
}
