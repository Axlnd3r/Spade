import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalHash, normalizeLines, validate } from "../../spike/lib.mjs";
import { refundsTo, shuffledDifferent, txId, uniqueData } from "./near.mjs";

test("txId reads the transaction id from near-cli output", () => {
  const out = "│    Gas burned: 2.3 Tgas\n│    Transaction ID: CwEwDSocVtkuVytTkDQpYk8xqHhe1b5ew8icW8Pwziqr\n│    To see";
  assert.equal(txId(out), "CwEwDSocVtkuVytTkDQpYk8xqHhe1b5ew8icW8Pwziqr");
  assert.equal(txId("Error: Smart contract panicked: deposit_low"), null);
});

test("shuffledDifferent is a deterministic reordering of the same lines", () => {
  const lines = ["a", "b", "c", "d", "e"];
  const s = shuffledDifferent(lines, 7);
  assert.deepEqual(s, shuffledDifferent(lines, 7));
  assert.notDeepEqual(s, lines);
  assert.deepEqual(s.slice().sort(), lines);
  assert.deepEqual(lines, ["a", "b", "c", "d", "e"], "input untouched");
});

test("shuffledDifferent differs even with repeated lines", () => {
  for (let seed = 0; seed < 50; seed++) {
    const lines = ["a", "a", "a", "a", "b"];
    assert.notDeepEqual(shuffledDifferent(lines, seed), lines, `seed ${seed}`);
  }
});

test("shuffledDifferent throws when every line is the same", () => {
  assert.throws(() => shuffledDifferent(["a", "a", "a", "a", "a"], 1), /same/);
});

test("uniqueData is valid data with a fresh canonical hash per call", () => {
  const a = normalizeLines(uniqueData("menu", 1_800_000_000_000));
  const b = normalizeLines(uniqueData("menu", 1_800_000_000_001));
  for (const lines of [a, b]) {
    assert.ok(lines.length >= 5 && lines.length <= 8, `${lines.length} lines`);
    assert.deepEqual(validate(lines.join("\n"), lines), { ok: true });
  }
  assert.notEqual(canonicalHash(a), canonicalHash(b));
});

test("refundsTo lists NEAR transfers to an account and who sent them", () => {
  const status = {
    receipts: [
      { predecessor_id: "outlayer.testnet", receiver_id: "me.testnet",
        receipt: { Action: { actions: [{ Transfer: { deposit: "6000" } }] } } },
      { predecessor_id: "system", receiver_id: "me.testnet",
        receipt: { Action: { actions: [{ Transfer: { deposit: "5" } }] } } },
      { predecessor_id: "v1.testnet", receiver_id: "other.testnet",
        receipt: { Action: { actions: [{ Transfer: { deposit: "9" } }] } } },
      { predecessor_id: "v1.testnet", receiver_id: "me.testnet",
        receipt: { Action: { actions: [{ FunctionCall: { method_name: "x" } }] } } },
    ],
  };
  assert.deepEqual(refundsTo(status, "me.testnet"), [
    { from: "outlayer.testnet", yocto: "6000" },
    { from: "system", yocto: "5" },
  ]);
});
