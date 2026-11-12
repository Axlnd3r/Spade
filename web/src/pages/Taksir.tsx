import { useEffect, useRef, useState } from "react";
import { FAUCET_DEPOSIT, POLL_MS, SOFT_TIMEOUT_MS } from "../chain/config";
import { normalizeLines, validateData } from "../chain/data";
import { contractErrorMessage, near, taksir } from "../chain/format";
import { view } from "../chain/rpc";
import type { Appraisal, Params, Stats } from "../chain/types";
import { awaitResult, findNewAppraisal, isAbort } from "../hooks/awaitResult";
import { useNow } from "../hooks/useNow";
import { useView } from "../hooks/useView";
import { useStage } from "../scene/SceneCanvas";
import { GhostButton, Meter, PageTitle } from "../ui/bits";
import { ResultCard } from "../ui/ResultCard";
import { txErrorMessage } from "../wallet/tx";
import { useWallet } from "../wallet/WalletProvider";

const SAMPLE = [
  "Specialty coffee bar menu",
  "iced palm-sugar latte 28000",
  "pour-over single origin 35000",
  "matcha latte 32000",
  "almond croissant 27000",
  "cinnamon roll 24000",
].join("\n");

const LIMITS = { min_rows: 5, max_rows: 100, max_data_bytes: 2000 };

type Phase = "idle" | "sending" | "thinking";

export default function Taksir() {
  const { accountId, signIn, call } = useWallet();
  const { trigger } = useStage();
  const params = useView<Params>("get_params");
  const balance = useView<string>("ft_balance_of", accountId ? { account_id: accountId } : null);
  const [text, setText] = useState(SAMPLE);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [result, setResult] = useState<Appraisal | null>(null);
  /** When Mr. X started thinking, for the seconds shown beside the status. */
  const [since, setSince] = useState<number | null>(null);
  const now = useNow();
  const gutter = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  // Leaving the page stops the polling, and the card stops "thinking".
  useEffect(() => () => abort.current?.abort(), []);

  const p = params.data;
  const limits = p ?? LIMITS;
  const lines = normalizeLines(text);
  const bytes = new TextEncoder().encode(text).length;
  const problem = validateData(text, lines, limits);
  const deposit = p ? (BigInt(p.exec_deposit) + BigInt(p.storage_fee)).toString() : null;
  const fee = p ? taksir(p.appraisal_fee, 0) : null;
  const busy = phase !== "idle";

  async function claimFaucet() {
    setMessage(null);
    try {
      await call("faucet", {}, FAUCET_DEPOSIT);
      balance.reload();
    } catch (e) {
      setMessage(txErrorMessage(e));
    }
  }

  async function appraise() {
    if (!accountId || !deposit) return;
    setMessage(null);
    setResult(null);
    setSlow(false);
    setPhase("sending");
    trigger("thinking");
    let event: "idle" | "reveal" = "idle";
    try {
      const { appraisal_count } = await view<Stats>("get_stats");
      await call("appraise", { data: text }, deposit);
      setPhase("thinking");
      setSince(Date.now());
      const created = await findNewAppraisal(appraisal_count, accountId, text);
      if (!created) throw new Error("Sent, but the new case was not found yet. Check Cases in a minute.");
      abort.current = new AbortController();
      const done = await awaitResult<Appraisal>(
        () => view<Appraisal>("get_appraisal", { id: created.id }),
        (a) => a.status !== "Pending",
        { intervalMs: POLL_MS, softTimeoutMs: SOFT_TIMEOUT_MS, onSoftTimeout: () => setSlow(true), signal: abort.current.signal },
      );
      if (done.status === "Failed") {
        setMessage("Mr. X didn't answer. Your fee was refunded.");
      } else {
        setResult(done);
        event = "reveal";
      }
      balance.reload();
    } catch (e) {
      if (!isAbort(e)) setMessage(txErrorMessage(e));
    } finally {
      setPhase("idle");
      setSlow(false);
      setSince(null);
      trigger(event);
    }
  }

  return (
    <main className="page page--form">
      <PageTitle caption="02 / 05 — GET A PRICE" title="TAKSIR" />
      <p className="lead">
        Give Mr. X a list, one item per line. He answers with a price from 1 to 10,000 and one line on why. The answer is
        signed inside the TEE and stored on-chain, so anyone can check it, and anyone can call his bluff.
      </p>

      {accountId && balance.data === "0" ? (
        <section className="panel">
          <p>You have no $TAKSIR yet. Claim the testnet faucet once: 500 $TAKSIR for 0.01 NEAR of storage.</p>
          <GhostButton onClick={claimFaucet}>CLAIM 500 $TAKSIR</GhostButton>
        </section>
      ) : null}

      <section className="panel" aria-labelledby="form-title">
        <h2 id="form-title" className="caption">
          YOUR LIST
        </h2>
        <label htmlFor="data" className="muted">
          One item per line, 5–100 lines, up to 2,000 bytes. The same lines in any order can only be priced once.
        </label>
        <div className="data-field">
          <div ref={gutter} className="data-gutter" aria-hidden="true">
            {Array.from({ length: text.split("\n").length }, (_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
          <textarea
            id="data"
            className="data-input"
            rows={8}
            wrap="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onScroll={(e) => {
              if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
            }}
            disabled={busy}
            spellCheck={false}
          />
        </div>
        <div className="meters" aria-live="polite">
          <Meter label="LINES" value={lines.length} min={limits.min_rows} max={limits.max_rows} />
          <Meter label="BYTES" value={bytes} max={limits.max_data_bytes} />
        </div>
        {problem ? <p className="form-error">{contractErrorMessage(problem)}</p> : null}
        <dl className="receipt">
          <div>
            <dt className="caption">FEE</dt>
            <dd>{fee ? `${fee} $TAKSIR, burned` : "…"}</dd>
          </div>
          <div>
            <dt className="caption">DEPOSIT</dt>
            <dd>{deposit ? `${near(deposit)} for the enclave run and storage` : "…"}</dd>
          </div>
          <div>
            <dt className="caption">COMES BACK</dt>
            <dd>about 0.006 NEAR</dd>
          </div>
          {accountId && balance.data ? (
            <div>
              <dt className="caption">YOUR BALANCE</dt>
              <dd>{taksir(balance.data, 0)} $TAKSIR</dd>
            </div>
          ) : null}
        </dl>
        <div className="row">
          {accountId ? (
            <GhostButton onClick={appraise} disabled={busy || !!problem || !deposit}>
              {fee ? `APPRAISE (${fee} $TAKSIR)` : "APPRAISE"}
            </GhostButton>
          ) : (
            <GhostButton onClick={signIn}>CONNECT WALLET</GhostButton>
          )}
          {phase === "sending" ? <span className="caption">CONFIRM IN YOUR WALLET…</span> : null}
          {phase === "thinking" ? (
            <>
              <span className="caption">
                {slow ? "MR. X IS STILL THINKING. THIS PAGE UPDATES WHEN HE ANSWERS." : "MR. X IS THINKING…"}
              </span>
              {since !== null ? <span className="caption muted">{Math.max(0, Math.floor((now - since) / 1000))} S</span> : null}
            </>
          ) : null}
        </div>
        {message ? (
          <p className="notice" role="alert">
            {message}
          </p>
        ) : null}
      </section>

      {result ? <ResultCard a={result} /> : null}
    </main>
  );
}
