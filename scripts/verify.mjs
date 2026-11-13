// Read-only check of the live contract against docs/TESTNET.md and scripts/params.testnet.json.
// Sends no transaction and needs no key. Exit 1 if anything does not match.
//
//   node scripts/verify.mjs [contract] [--offline] [--require-locked]
//
// --offline         skip downloading the enclave release
// --require-locked  fail (instead of warn) while the contract still has access keys
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { RPC, rpc } from "./lib/near.mjs";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Base58 (Bitcoin alphabet), the encoding NEAR uses for `code_hash`. */
export function bs58(bytes) {
  let n = BigInt(`0x${Buffer.from(bytes).toString("hex") || "0"}`);
  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = `1${out}`;
  }
  return out;
}

function match(text, re, what) {
  const m = re.exec(text);
  if (!m) throw new Error(`docs/TESTNET.md: ${what} not found`);
  return m[1];
}

/** The hashes and URL docs/TESTNET.md records for `contract` and for the enclave release. */
export function expectedFromDoc(doc, contract) {
  const heading = doc.indexOf(`### Deploy \`${contract}\``);
  if (heading < 0) throw new Error(`docs/TESTNET.md has no "### Deploy \`${contract}\`" section`);
  const section = doc.slice(heading).split(/\n### /)[0];
  return {
    contractSha256: match(section, /sha256 `([0-9a-f]{64})`/, `taksir.wasm sha256 for ${contract}`),
    wasmHash: match(doc, /\*\*sha256 \(`wasm_hash`\): `([0-9a-f]{64})`\*\*/, "enclave wasm_hash"),
    wasmUrl: match(doc, /\*\*`wasm_url`:\*\* `(https:[^`]+)`/, "wasm_url"),
  };
}

/** One line per key whose value differs; numbers and strings compare by value (U128 is a JSON string). */
export function diffParams(want, got) {
  const keys = [...new Set([...Object.keys(want), ...Object.keys(got)])].sort();
  const show = (o, k) => (k in o ? String(o[k]) : "(missing)");
  return keys.filter((k) => show(want, k) !== show(got, k)).map((k) => `${k}: expected ${show(want, k)}, got ${show(got, k)}`);
}

/** Mint count, total minted and total burned according to the contract's log. */
export function ledgerTotals(log) {
  let mints = 0;
  let minted = 0n;
  let burned = 0n;
  for (const e of log) {
    if (e.kind === "Mint") {
      mints += 1;
      minted += BigInt(e.amount);
    } else if (e.kind.startsWith("Burn")) {
      burned += BigInt(e.amount);
    }
  }
  return { mints, minted, burned };
}

const TAKSIR = 10n ** 18n;
const fmt = (yocto) => `${(BigInt(yocto) / TAKSIR).toLocaleString("en")} TAKSIR`;

async function main(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const contract = argv.find((a) => !a.startsWith("--")) ?? "v2.spade-taksir.testnet";
  const root = new URL("../", import.meta.url);
  const want = expectedFromDoc(readFileSync(new URL("docs/TESTNET.md", root), "utf8"), contract);
  const wantParams = JSON.parse(readFileSync(new URL("scripts/params.testnet.json", root), "utf8"));

  // Every read below is taken at one final block, so the numbers belong to the same state.
  const block = await rpc("block", { finality: "final" });
  const at = { block_id: block.header.height };
  const query = (params) => rpc("query", { ...at, ...params });
  const view = async (method, args = {}) => {
    const r = await query({
      request_type: "call_function",
      account_id: contract,
      method_name: method,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
    });
    return JSON.parse(Buffer.from(r.result).toString());
  };

  console.log(`Contract ${contract}, block ${at.block_id}, RPC ${RPC}\n`);
  let failed = 0;
  const report = (status, label, detail) => {
    if (status === "FAIL") failed += 1;
    console.log(`${status.padEnd(4)}  ${label}${detail ? `\n      ${detail}` : ""}`);
  };
  const check = (ok, label, detail) => report(ok ? "PASS" : "FAIL", label, detail);

  const account = await query({ request_type: "view_account", account_id: contract });
  const wantCode = bs58(Buffer.from(want.contractSha256, "hex"));
  check(
    account.code_hash === wantCode,
    "contract code is the taksir.wasm in docs/TESTNET.md",
    `code_hash ${account.code_hash} (expected ${wantCode} = sha256 ${want.contractSha256})`,
  );

  const keys = (await query({ request_type: "view_access_key_list", account_id: contract })).keys;
  if (keys.length === 0) {
    report("PASS", "0 access keys: nobody can change or upgrade the contract");
  } else {
    report(
      flags.has("--require-locked") ? "FAIL" : "WARN",
      `${keys.length} access key(s): the final lock has not happened yet`,
      keys.map((k) => `${k.public_key} (${k.access_key.permission === "FullAccess" ? "full access" : "function call"})`).join(", "),
    );
  }

  const params = await view("get_params");
  const diff = diffParams(wantParams, params);
  check(diff.length === 0, "get_params equals scripts/params.testnet.json", diff.join("\n      "));
  check(params.wasm_hash === want.wasmHash, "pinned enclave hash equals the reproducible build", params.wasm_hash);
  check(params.wasm_url === want.wasmUrl, "pinned enclave URL equals the GitHub release", params.wasm_url);

  if (flags.has("--offline")) {
    report("SKIP", "enclave release download (--offline)");
  } else {
    const res = await fetch(params.wasm_url);
    if (!res.ok) {
      check(false, "enclave release downloads", `HTTP ${res.status} from ${params.wasm_url}`);
    } else {
      const bytes = Buffer.from(await res.arrayBuffer());
      const sha = createHash("sha256").update(bytes).digest("hex");
      check(sha === params.wasm_hash, "downloaded appraiser.wasm hashes to the pinned wasm_hash", `sha256 ${sha}, ${bytes.length} bytes`);
    }
  }

  const stats = await view("get_stats");
  const log = [];
  while (log.length < stats.log_count) {
    const page = await view("get_log", { from: log.length, limit: 50 });
    if (page.length === 0) break;
    log.push(...page);
  }
  const ledger = ledgerTotals(log);
  const supply = BigInt(await view("ft_total_supply"));
  const burned = BigInt(stats.burned_total);
  check(log.length === stats.log_count, "ledger read in full", `${log.length} of ${stats.log_count} entries`);
  check(ledger.mints === 1 && log[0]?.kind === "Mint", "exactly one mint, the genesis entry", `${ledger.mints} Mint entr${ledger.mints === 1 ? "y" : "ies"}`);
  check(
    supply + burned === ledger.minted,
    "supply + burned = genesis (no tokens appeared from anywhere)",
    `${fmt(supply)} + ${fmt(burned)} = ${fmt(supply + burned)}; genesis ${fmt(ledger.minted)}`,
  );
  check(ledger.burned === burned, "burns in the ledger add up to burned_total", `${fmt(ledger.burned)} in the ledger`);
  check(supply === BigInt(stats.total_supply), "ft_total_supply equals get_stats.total_supply");

  const held = BigInt(await view("ft_balance_of", { account_id: contract }));
  const pools = BigInt(stats.treasury) + BigInt(stats.faucet_pool) + BigInt(stats.escrow);
  check(
    held === pools,
    "I-2: contract balance = treasury + faucet pool + escrow",
    `${fmt(held)} held; ${fmt(stats.treasury)} + ${fmt(stats.faucet_pool)} + ${fmt(stats.escrow)}`,
  );

  console.log(failed ? `\n${failed} check(s) failed.` : "\nAll checks passed.");
  return failed ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(`verify: ${e.message}`);
      process.exit(2);
    },
  );
}
