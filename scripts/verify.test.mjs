import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bs58, diffParams, expectedFromDoc, ledgerTotals } from "./verify.mjs";

const doc = readFileSync(new URL("../docs/TESTNET.md", import.meta.url), "utf8");

test("bs58 turns the taksir.wasm sha256 into the code_hash NEAR reports", () => {
  assert.equal(
    bs58(Buffer.from("a8b90d5a9d54ce1fb9085ee0e2980780acd8c8f4431d5ae2f92b5b7c0b6b0127", "hex")),
    "CMd9x3xLmM3dm9HDsxhZMz1Z4Etzcs3RgasvMnarWV4J",
  );
  assert.equal(bs58(Buffer.from([0, 0, 1])), "112");
});

test("expectedFromDoc reads the v2 contract hash, enclave hash and wasm_url from docs/TESTNET.md", () => {
  assert.deepEqual(expectedFromDoc(doc, "v2.spade-taksir.testnet"), {
    contractSha256: "a8b90d5a9d54ce1fb9085ee0e2980780acd8c8f4431d5ae2f92b5b7c0b6b0127",
    wasmHash: "0206187e1ba0c53acb5c5e991b1d559c20eafb01d617a387be5a0848c7348ee2",
    wasmUrl: "https://github.com/Axlnd3r/Spade/releases/download/enclave-v1/appraiser.wasm",
  });
});

test("expectedFromDoc refuses a contract the doc does not describe", () => {
  assert.throws(() => expectedFromDoc(doc, "v9.spade-taksir.testnet"), /v9\.spade-taksir\.testnet/);
});

test("diffParams lists changed, missing and extra keys, comparing numbers and strings by value", () => {
  const want = { a: "1", b: 2, c: "x" };
  assert.deepEqual(diffParams(want, { a: "1", b: 2, c: "x" }), []);
  assert.deepEqual(diffParams(want, { a: 1, b: "2", c: "x" }), []);
  assert.deepEqual(diffParams(want, { a: "1", c: "y", d: 0 }), [
    "b: expected 2, got (missing)",
    "c: expected x, got y",
    "d: expected (missing), got 0",
  ]);
});

test("ledgerTotals sums the mints and every kind of burn", () => {
  const log = [
    { kind: "Mint", amount: "1000" },
    { kind: "Faucet", amount: "5" },
    { kind: "BurnFee", amount: "50" },
    { kind: "BurnStake", amount: "25" },
    { kind: "Reward", amount: "50" },
    { kind: "BurnEpoch", amount: "7" },
  ];
  assert.deepEqual(ledgerTotals(log), { mints: 1, minted: 1000n, burned: 82n });
});
