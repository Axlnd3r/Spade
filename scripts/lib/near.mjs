// Testnet helpers for scripts/e2e.mjs: views and tx status over RPC,
// calls through near-cli-rs (legacy keychain), test data.
import { spawnSync } from "node:child_process";

export const RPC = process.env.NEAR_RPC ?? "https://rpc.testnet.near.org";
export const NEAR_EXE = process.env.NEAR_EXE ?? "C:/Users/User/bin/near.exe";

/** The `Transaction ID: <base58>` near-cli prints, or null. */
export function txId(output) {
  const m = /Transaction ID:\s*([1-9A-HJ-NP-Za-km-z]{43,44})/.exec(output);
  return m ? m[1] : null;
}

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "e2e", method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}

export async function view(contract, method, args = {}) {
  const r = await rpc("query", {
    request_type: "call_function",
    finality: "optimistic",
    account_id: contract,
    method_name: method,
    args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
  });
  return JSON.parse(Buffer.from(r.result).toString());
}

/** Calls `method` as `signer`; `deposit` is a near-cli amount such as "0.01 NEAR". Never goes through a shell. */
export function call(signer, contract, method, args, { deposit = "0 NEAR", tgas = 300 } = {}) {
  const argv = [
    "contract", "call-function", "as-transaction", contract, method, "json-args", JSON.stringify(args),
    "prepaid-gas", `${tgas} Tgas`, "attached-deposit", deposit,
    "sign-as", signer, "network-config", "testnet", "sign-with-legacy-keychain", "send",
  ];
  const r = spawnSync(NEAR_EXE, argv, { encoding: "utf8", maxBuffer: 16 << 20 });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  return { ok: r.status === 0, tx: txId(out), out };
}

export async function txStatus(hash, sender) {
  return rpc("EXPERIMENTAL_tx_status", { tx_hash: hash, sender_account_id: sender, wait_until: "FINAL" });
}

/** NEAR transfers to `account` in a transaction's receipts, with their sender. */
export function refundsTo(status, account) {
  const out = [];
  for (const r of status.receipts ?? []) {
    if (r.receiver_id !== account) continue;
    for (const a of r.receipt?.Action?.actions ?? []) {
      if (a.Transfer) out.push({ from: r.predecessor_id, yocto: a.Transfer.deposit });
    }
  }
  return out;
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

/** A seeded shuffle of `lines` whose order is guaranteed to differ from the input. */
export function shuffledDifferent(lines, seed) {
  if (lines.every((l) => l === lines[0])) throw new Error("all lines are the same: no other order exists");
  const rand = mulberry32(seed);
  const out = lines.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.every((l, i) => l === lines[i])) {
    // Same order by chance: swap the first line with the first one that differs from it.
    const j = out.findIndex((l) => l !== out[0]);
    [out[0], out[j]] = [out[j], out[0]];
  }
  return out;
}

/** 6 lines of plausible data; one carries `now`, so every run gets a fresh canonical hash. */
export function uniqueData(tag, now) {
  return [
    `${tag} price list, batch ${now}`,
    "nasi goreng 25000",
    "mie ayam 18000",
    "es teh manis 5000",
    "sate ayam 10 tusuk 30000",
    "kerupuk 2000",
  ].join("\n");
}
