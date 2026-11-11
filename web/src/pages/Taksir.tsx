import { useRef, useState } from "react";
import { FAUCET_DEPOSIT, POLL_MS, SOFT_TIMEOUT_MS } from "../chain/config";
import { normalizeLines, validateData } from "../chain/data";
import { contractErrorMessage, near, taksir } from "../chain/format";
import { view } from "../chain/rpc";
import type { Appraisal, Params, Stats } from "../chain/types";
import { awaitResult, findNewAppraisal } from "../hooks/awaitResult";
import { useView } from "../hooks/useView";
import { useStage } from "../scene/SceneCanvas";
import { GhostButton, PageTitle } from "../ui/bits";
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
  const abort = useRef<AbortController | null>(null);

  const p = params.data;
  const lines = normalizeLines(text);
  const bytes = new TextEncoder().encode(text).length;
  const problem = validateData(text, lines, p ?? LIMITS);
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
    try {
      const { appraisal_count } = await view<Stats>("get_stats");
      await call("appraise", { data: text }, deposit);
      setPhase("thinking");
      const created = await findNewAppraisal(appraisal_count, accountId, text);
      if (!created) throw new Error("Sent, but the new case was not found yet. Check Cases in a minute.");
      abort.current = new AbortController();
      const done = await awaitResult<Appraisal>(
        () => view<Appraisal>("get_appraisal", { id: created.id }),
        (a) => a.status !== "Pending",
        { intervalMs: POLL_MS, softTimeoutMs: SOFT_TIMEOUT_MS, onSoftTimeout: () => setSlow(true), signal: abort.current.signal },
      );
      if (done.status === "Failed") setMessage("Mr. X didn't answer. Your fee was refunded.");
      else setResult(done);
      balance.reload();
    } catch (e) {
      setMessage(txErrorMessage(e));
    } finally {
      setPhase("idle");
      setSlow(false);
      trigger("idle");
    }
  }

  return (
    <main className="page">
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
        <textarea
          id="data"
          className="data-input"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
          spellCheck={false}
        />
        <p className="caption" aria-live="polite">
          {lines.length} LINES · {bytes.toLocaleString("en")} / 2,000 BYTES
        </p>
        {problem ? <p className="form-error">{contractErrorMessage(problem)}</p> : null}
        <p className="muted">
          {fee && deposit
            ? `You pay ${fee} $TAKSIR (burned) + ${near(deposit)} for the enclave run and storage; about 0.006 NEAR comes back.`
            : "Loading the contract's fees…"}
          {accountId && balance.data ? ` Balance: ${taksir(balance.data, 0)} $TAKSIR.` : ""}
        </p>
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
            <span className="caption">
              {slow ? "MR. X IS STILL THINKING. THIS PAGE UPDATES WHEN HE ANSWERS." : "MR. X IS THINKING…"}
            </span>
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
