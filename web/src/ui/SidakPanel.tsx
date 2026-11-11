import { useRef, useState } from "react";
import { POLL_MS, SOFT_TIMEOUT_MS } from "../chain/config";
import { near, taksir } from "../chain/format";
import { view } from "../chain/rpc";
import { reversed, shuffledDifferent } from "../chain/shuffle";
import type { Appraisal, Challenge, Params } from "../chain/types";
import { awaitResult } from "../hooks/awaitResult";
import { windowLeftMs } from "../pages/epoch";
import { useStage } from "../scene/SceneCanvas";
import { txErrorMessage } from "../wallet/tx";
import { useWallet } from "../wallet/WalletProvider";
import { BustCard } from "./BustCard";
import { GhostButton } from "./bits";

/** Why SIDAK can't be called on this case right now, or null when it can. */
export function sidakBlocked(a: Appraisal, p: Params, now: number): string | null {
  if (a.status === "Pending") return "Mr. X is still pricing this case.";
  if (a.status === "Caught") return "Mr. X was already busted on this case.";
  if (a.status === "Failed") return "Mr. X never answered this case.";
  if (a.priced_ms === null || windowLeftMs(a.priced_ms, p.challenge_window_ms, now) === 0)
    return "The 1-hour SIDAK window has closed.";
  if (a.active_challenges >= p.max_challenges) return "This case already has 3 inspections.";
  return null;
}

export function SidakPanel({ a, p, now, onDone }: { a: Appraisal; p: Params; now: number; onDone(): void }) {
  const { accountId, signIn, call } = useWallet();
  const { trigger } = useStage();
  const lines = a.data.split("\n");
  const [order, setOrder] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [bust, setBust] = useState<Challenge | null>(null);
  const abort = useRef<AbortController | null>(null);

  const blocked = sidakBlocked(a, p, now);
  const deposit = (BigInt(p.exec_deposit) + BigInt(p.storage_fee)).toString();
  const stake = taksir(p.challenge_stake, 0);

  function pick(fn: () => string[]) {
    setMessage(null);
    try {
      setOrder(fn());
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  async function submit() {
    if (!accountId || !order) return;
    setBusy(true);
    setMessage(null);
    setSlow(false);
    trigger("thinking");
    let event: "idle" | "held" | "busted" = "idle";
    try {
      const before = (await view<Challenge[]>("get_challenges", { appraisal_id: a.id })).length;
      await call("challenge", { appraisal_id: a.id, variant: order.join("\n") }, deposit);
      abort.current = new AbortController();
      const mine = (list: Challenge[]) => list.slice(before).find((c) => c.challenger === accountId);
      const done = await awaitResult<Challenge>(
        async () => mine(await view<Challenge[]>("get_challenges", { appraisal_id: a.id })),
        (c) => c.status !== "Pending",
        { intervalMs: POLL_MS, softTimeoutMs: SOFT_TIMEOUT_MS, onSoftTimeout: () => setSlow(true), signal: abort.current.signal },
      );
      if (done.status === "Caught") {
        event = "busted";
        setBust(done);
      } else if (done.status === "Survived") {
        event = "held";
        setMessage(`HELD. Mr. X said ${done.price} again (close enough). Your ${stake} $TAKSIR stake was burned.`);
      } else if (done.status === "Voided") {
        setMessage("Someone busted him first. Your stake was refunded.");
      } else {
        setMessage("Mr. X didn't answer. Your stake was refunded.");
      }
      onDone();
    } catch (e) {
      setMessage(txErrorMessage(e));
    } finally {
      setBusy(false);
      setSlow(false);
      trigger(event);
    }
  }

  if (bust && bust.price !== null && a.price !== null)
    return <BustCard caseId={a.id} p1={a.price} p2={bust.price} reward={bust.reward} hunter={bust.challenger} />;

  return (
    <section className="panel" aria-labelledby="sidak-title">
      <h2 id="sidak-title" className="caption">
        SIDAK · CALL HIS BLUFF
      </h2>
      {blocked ? (
        <p>{blocked}</p>
      ) : (
        <>
          <p className="muted">
            Ask again with the same lines in a new order. If the new price is more than 75% away from {a.price}, Mr. X is
            BUSTED: your stake comes back with {taksir((BigInt(p.challenge_stake) * BigInt(p.reward_multiplier)).toString(), 0)}{" "}
            $TAKSIR from the treasury. If he holds steady, your {stake} $TAKSIR stake burns.
          </p>
          <div className="row">
            <GhostButton onClick={() => pick(() => shuffledDifferent(lines, Date.now() % 2 ** 31))} disabled={busy}>
              SHUFFLE
            </GhostButton>
            <GhostButton onClick={() => pick(() => reversed(lines))} disabled={busy}>
              REVERSE
            </GhostButton>
          </div>
          {order ? (
            <ol className="lines" aria-label="SIDAK order">
              {order.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ol>
          ) : null}
          <p className="muted">
            You stake {stake} $TAKSIR + {near(deposit)} for the enclave run and storage; about 0.006 NEAR comes back.
          </p>
          <div className="row">
            {accountId ? (
              <GhostButton onClick={submit} disabled={busy || !order}>
                CALL SIDAK (STAKE {stake} $TAKSIR)
              </GhostButton>
            ) : (
              <GhostButton onClick={signIn}>CONNECT WALLET</GhostButton>
            )}
            {busy ? (
              <span className="caption">
                {slow ? "MR. X IS STILL THINKING. THIS PAGE UPDATES WHEN HE ANSWERS." : "MR. X IS THINKING…"}
              </span>
            ) : null}
          </div>
        </>
      )}
      {message ? (
        <p className="notice" role="alert">
          {message}
        </p>
      ) : null}
    </section>
  );
}
