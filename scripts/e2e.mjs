// Full flow on testnet: faucet -> appraise -> challenge, twice (normal data,
// then adversarial data), then stats, log and invariant I-2.
// Usage: node scripts/e2e.mjs v1.spade-taksir.testnet [signer]
// Exit 0 when every step reached a terminal status, the normal appraisal was
// priced (a missing secret or broken enclave would only give Failed), and I-2 holds.
import { readFileSync } from "node:fs";
import { normalizeLines } from "../spike/lib.mjs";
import { call, refundsTo, shuffledDifferent, txStatus, uniqueData, view } from "./lib/near.mjs";

const contract = process.argv[2];
const signer = process.argv[3] ?? "spade-taksir.testnet";
if (!contract) {
  console.error("usage: node scripts/e2e.mjs <contract> [signer]");
  process.exit(2);
}
const WAIT_MS = 90_000;
const POLL_MS = 3_000;
const steps = [];

function nearAmount(yocto) {
  const s = yocto.toString().padStart(25, "0");
  const frac = s.slice(-24).replace(/0+$/, "");
  return `${s.slice(0, -24)}${frac ? `.${frac}` : ""} NEAR`;
}

function record(step, r, extra = {}) {
  const row = { step, ok: r.ok, tx: r.tx, ...extra };
  steps.push(row);
  console.log(`${r.ok ? "ok  " : "FAIL"} ${step} ${r.tx ?? ""} ${JSON.stringify(extra)}`);
  if (!r.ok) console.log(r.out.split("\n").filter((l) => /rror|panick|Failure/.test(l)).slice(0, 5).join("\n"));
  return row;
}

async function waitFor(what, read) {
  const end = Date.now() + WAIT_MS;
  for (;;) {
    const v = await read();
    if (v && v.status !== "Pending") return v;
    if (Date.now() > end) return v;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

const params = await view(contract, "get_params");
const deposit = nearAmount(BigInt(params.exec_deposit) + BigInt(params.storage_fee));

// 1. Faucet only for an empty balance: a second run on the same contract skips it.
const balance = BigInt(await view(contract, "ft_balance_of", { account_id: signer }));
if (balance === 0n) {
  record("faucet", call(signer, contract, "faucet", {}, { deposit: "0.01 NEAR", tgas: 100 }));
} else {
  steps.push({ step: "faucet", ok: true, skipped: `balance ${balance}` });
  console.log(`skip faucet (balance ${balance})`);
}

async function appraiseAndChallenge(label, text, variantOf) {
  const id = (await view(contract, "get_stats")).appraisal_count;
  const a = record(`appraise ${label}`, call(signer, contract, "appraise", { data: text }, { deposit }), { id });
  if (!a.ok) return;
  const ap = await waitFor("appraisal", () => view(contract, "get_appraisal", { id }));
  a.status = ap?.status;
  a.price = ap?.price;
  a.response_hash = ap?.response_hash;
  if (ap?.owner !== signer) throw new Error(`appraisal ${id} belongs to ${ap?.owner}, not ${signer}: concurrent use?`);
  try {
    a.refunds = refundsTo(await txStatus(a.tx, signer), signer);
  } catch (e) {
    a.refunds = `tx status: ${e.message}`;
  }
  console.log(`     appraisal ${id}: ${ap.status} price ${ap.price} — ${ap.reason}`);
  if (ap.status !== "Priced") return;

  const variant = variantOf(normalizeLines(text)).join("\n");
  const c = record(`challenge ${label}`, call(signer, contract, "challenge", { appraisal_id: id, variant }, { deposit }));
  if (!c.ok) return;
  const ch = await waitFor("challenge", async () => (await view(contract, "get_challenges", { appraisal_id: id })).at(-1));
  Object.assign(c, { id: ch?.id, status: ch?.status, price: ch?.price, reward: ch?.reward });
  console.log(`     challenge ${ch?.id}: ${ch?.status} price ${ch?.price} (appraised ${ap.price}) reward ${ch?.reward}`);
}

// 2-3. Normal data, challenged with a seeded reordering.
const now = Date.now();
await appraiseAndChallenge("normal", uniqueData("warung", now), (lines) => shuffledDifferent(lines, now % 2 ** 31));

// 4. Adversarial a02 (highest catch rate in EXPERIMENT) plus a unique first line, challenged reversed.
const a02 = readFileSync(new URL("../spike/datasets/adversarial/a02.txt", import.meta.url), "utf8");
await appraiseAndChallenge("adversarial", `batch ${now}\n${a02}`, (lines) => lines.slice().reverse());

// 5. Stats, recent log, I-2.
const stats = await view(contract, "get_stats");
const from = Math.max(0, stats.log_count - 10);
const log = await view(contract, "get_log", { from, limit: 10 });
const held = BigInt(await view(contract, "ft_balance_of", { account_id: contract }));
const i2 = held === BigInt(stats.treasury) + BigInt(stats.faucet_pool) + BigInt(stats.escrow);

console.log("\nstats", JSON.stringify(stats));
console.log("log", JSON.stringify(log.map((e) => [e.kind, e.amount, e.ref_id, e.account_id])));
console.log(`I-2 ft_balance_of(contract) ${held} == treasury + faucet_pool + escrow: ${i2}`);

const terminal = steps.every((s) => s.ok && s.status !== "Pending");
const priced = steps.find((s) => s.step === "appraise normal")?.status === "Priced";
console.log("\nsummary", JSON.stringify({ contract, signer, steps, i2 }, null, 1));
console.log(`terminal ${terminal}, normal appraisal priced ${priced}, I-2 ${i2}`);
process.exit(terminal && priced && i2 ? 0 : 1);
