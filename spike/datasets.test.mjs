import { test } from "node:test";
import assert from "node:assert/strict";
import { validate, canonicalHash, permutations } from "./lib.mjs";
import { loadDatasets } from "./datasets.mjs";

const datasets = loadDatasets();

test("there are exactly 30 normal and 10 adversarial datasets", () => {
  assert.equal(datasets.filter((d) => d.category === "normal").length, 30);
  assert.equal(datasets.filter((d) => d.category === "adversarial").length, 10);
});

test("every dataset passes contract validation and has 5-40 rows", () => {
  for (const d of datasets) {
    assert.deepEqual(validate(d.text, d.lines), { ok: true }, d.name);
    assert.ok(d.lines.length >= 5 && d.lines.length <= 40, `${d.name}: ${d.lines.length} rows`);
  }
});

test("canonical hashes are unique across all datasets", () => {
  const hashes = datasets.map((d) => canonicalHash(d.lines));
  assert.equal(new Set(hashes).size, datasets.length);
});

test("every dataset has at least 3 permutations for seed 42", () => {
  for (const d of datasets) assert.ok(permutations(d.lines, 3, 42).length >= 3, d.name);
});
