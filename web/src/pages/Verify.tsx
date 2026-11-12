import { useEffect, useState } from "react";
import { CONTRACT_CODE_HASH, CONTRACT_ID, CONTRACT_WASM_SHA256, EXPLORER, RELEASE_WASM_URL, WASM_HASH } from "../chain/config";
import { near, taksir } from "../chain/format";
import { accessKeyCount, viewAccount } from "../chain/rpc";
import type { Appraisal, Params, Stats } from "../chain/types";
import { useView } from "../hooks/useView";
import { PageTitle } from "../ui/bits";

const TAKSIR_FIELDS = new Set(["appraisal_fee", "challenge_stake", "faucet_amount"]);
const NEAR_FIELDS = new Set(["exec_deposit", "storage_fee"]);

function paramValue(key: string, value: unknown): string {
  if (TAKSIR_FIELDS.has(key)) return `${taksir(String(value), 0)} $TAKSIR`;
  if (NEAR_FIELDS.has(key)) return near(String(value));
  if (key.endsWith("_ms")) return `${Number(value).toLocaleString("en")} ms (${Number(value) / 60000} min)`;
  return String(value);
}

function keysText(n: number): string {
  if (n === 0) return "0 access keys. Nobody can change this contract.";
  return `${n} access key${n > 1 ? "s" : ""}. Becomes 0 after the final lock.`;
}

function Check({ ok }: { ok: boolean }) {
  return <span className={`tag ${ok ? "" : "tag--caught"}`}>{ok ? "MATCHES docs/TESTNET.md" : "DOES NOT MATCH"}</span>;
}

function LatestProof({ count }: { count: number }) {
  const { data: a } = useView<Appraisal | null>("get_appraisal", count ? { id: count - 1 } : null);
  if (!a) return <p className="muted">No case yet.</p>;
  return (
    <dl className="proof">
      <dt>Case</dt>
      <dd>#{a.id}</dd>
      <dt>Model</dt>
      <dd>{a.model}</dd>
      <dt>Chat id</dt>
      <dd>{a.chat_id}</dd>
      <dt>Signing address</dt>
      <dd>{a.signing_address}</dd>
      <dt>Signature</dt>
      <dd>{a.signature}</dd>
      <dt>Response hash</dt>
      <dd>{a.response_hash}</dd>
    </dl>
  );
}

export default function Verify() {
  const params = useView<Params>("get_params");
  const stats = useView<Stats>("get_stats");
  const [codeHash, setCodeHash] = useState<string | null>(null);
  const [keys, setKeys] = useState<number | null>(null);

  useEffect(() => {
    viewAccount(CONTRACT_ID).then((a) => setCodeHash(a.code_hash)).catch(() => {});
    accessKeyCount(CONTRACT_ID).then(setKeys).catch(() => {});
  }, []);

  const p = params.data;
  return (
    <main className="page">
      <PageTitle caption="07 / 07 — CHECK THE SEALS" title="VERIFY" />
      <p className="lead">
        Don't trust this page: every value below is read live from NEAR testnet, and each one can be checked with your own
        tools.
      </p>

      <section className="section" aria-labelledby="contract-title">
        <h2 id="contract-title" className="caption">
          1 · THE CONTRACT HOLDS ALL THE RULES
        </h2>
        <dl className="proof">
          <dt>Contract</dt>
          <dd>
            <a href={`${EXPLORER}/address/${CONTRACT_ID}`} target="_blank" rel="noreferrer">
              {CONTRACT_ID} ↗
            </a>
          </dd>
          <dt>Access keys</dt>
          <dd>{keys === null ? "…" : keysText(keys)}</dd>
          <dt>Code hash (live)</dt>
          <dd>
            {codeHash ?? "…"} {codeHash ? <Check ok={codeHash === CONTRACT_CODE_HASH} /> : null}
          </dd>
          <dt>taksir.wasm sha256</dt>
          <dd>{CONTRACT_WASM_SHA256}</dd>
        </dl>
      </section>

      <section className="section" aria-labelledby="params-title">
        <h2 id="params-title" className="caption">
          2 · PARAMETERS, FIXED AT LAUNCH (NO SETTERS)
        </h2>
        {p ? (
          <dl className="proof">
            {Object.entries(p).map(([k, v]) => (
              <div key={k} className="proof__pair">
                <dt>{k}</dt>
                <dd>{paramValue(k, v)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </section>

      <section className="section" aria-labelledby="enclave-title">
        <h2 id="enclave-title" className="caption">
          3 · MR. X'S CODE IS PINNED BY HASH
        </h2>
        <p className="muted">
          OutLayer only runs a WASM file whose sha256 equals the hash the contract pins. Download the release and compare:
        </p>
        <dl className="proof">
          <dt>Pinned in contract</dt>
          <dd>
            {p?.wasm_hash ?? "…"} {p ? <Check ok={p.wasm_hash === WASM_HASH} /> : null}
          </dd>
          <dt>Release</dt>
          <dd>
            <a href={RELEASE_WASM_URL} target="_blank" rel="noreferrer">
              enclave-v1/appraiser.wasm ↗
            </a>
          </dd>
          <dt>Expected sha256</dt>
          <dd>{WASM_HASH}</dd>
        </dl>
        <pre className="code">curl -sL {RELEASE_WASM_URL} | sha256sum</pre>
      </section>

      <section className="section" aria-labelledby="ai-title">
        <h2 id="ai-title" className="caption">
          4 · EVERY ANSWER IS SIGNED BY NEAR AI CLOUD
        </h2>
        <p className="muted">
          The model runs in a TEE and signs MODEL:sha256(request):sha256(response). The enclave checks that signature and
          the contract stores it with each case. Latest case:
        </p>
        {stats.data ? <LatestProof count={stats.data.appraisal_count} /> : null}
      </section>

      <section className="section" aria-labelledby="cli-title">
        <h2 id="cli-title" className="caption">
          5 · CHECK FROM A TERMINAL
        </h2>
        <pre className="code">{`near contract call-function as-read-only ${CONTRACT_ID} get_params json-args {} network-config testnet now
near contract call-function as-read-only ${CONTRACT_ID} get_stats json-args {} network-config testnet now
near account list-keys ${CONTRACT_ID} network-config testnet now`}</pre>
      </section>
    </main>
  );
}
