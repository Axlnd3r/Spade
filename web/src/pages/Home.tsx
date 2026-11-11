import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { STATS_REFRESH_MS } from "../chain/config";
import { taksir } from "../chain/format";
import type { Appraisal, LogEntry, Params, Stats } from "../chain/types";
import { useNow } from "../hooks/useNow";
import { useView } from "../hooks/useView";
import { useStage } from "../scene/SceneCanvas";
import { GhostButton, Stat } from "../ui/bits";
import { CaseRow } from "../ui/CaseRow";
import { mmss, nextEpochMs } from "./epoch";

export const RETRY_TEXT = "Can't reach NEAR testnet. Retrying…";

function RecentCases({ count, windowMs, now }: { count: number; windowMs?: number; now: number }) {
  const limit = Math.min(5, count);
  const { data } = useView<Appraisal[]>("get_appraisals", { from: count - limit, limit }, STATS_REFRESH_MS);
  if (!count) return <p className="muted">No cases yet. Be the first: give Mr. X something to price.</p>;
  return (
    <ol className="case-list">
      {[...(data ?? [])].reverse().map((a) => (
        <CaseRow key={a.id} a={a} windowMs={windowMs} now={now} />
      ))}
    </ol>
  );
}

export default function Home() {
  const stats = useView<Stats>("get_stats", {}, STATS_REFRESH_MS);
  const params = useView<Params>("get_params");
  const genesis = useView<LogEntry[]>("get_log", { from: 0, limit: 1 });
  const now = useNow();
  const { trigger } = useStage();

  // Embers rise from the floor whenever more $TAKSIR has been burned.
  const lastBurned = useRef<string | undefined>(undefined);
  const burned = stats.data?.burned_total;
  useEffect(() => {
    if (burned && lastBurned.current && BigInt(burned) > BigInt(lastBurned.current)) trigger("burn");
    lastBurned.current = burned;
  }, [burned, trigger]);

  const s = stats.data;
  const epochMs = params.data?.epoch_ms;
  const genesisMs = genesis.data?.[0]?.ts_ms;
  const countdown = epochMs && genesisMs ? mmss(nextEpochMs(genesisMs, epochMs, now) - now) : "—";

  return (
    <main className="page page--home">
      <section className="hero" aria-labelledby="hero-title">
        <span className="caption">MEET MR. X</span>
        <h1 id="hero-title" className="display">
          RUG THE AI, NOT THE HOLDERS.
        </h1>
        <p className="lead">
          Mr. X is an AI sealed inside a TEE. He prices your data. Shuffle the lines and ask again: if his price jumps,
          you caught him bluffing, and the treasury pays you.
        </p>
        <div className="row">
          <GhostButton to="/cases">CALL HIS BLUFF</GhostButton>
          <Link to="/taksir" className="link-quiet">
            GET A PRICE →
          </Link>
        </div>
      </section>

      <section aria-labelledby="live-title" className="section">
        <h2 id="live-title" className="caption">
          LIVE FROM NEAR TESTNET
        </h2>
        {stats.error ? (
          <p className="notice" role="status">
            {RETRY_TEXT}
          </p>
        ) : null}
        <dl className="stats">
          <Stat label="SUPPLY" value={s ? taksir(s.total_supply, 0) : "—"} note="$TAKSIR, never minted again" />
          <Stat label="BURNED" value={s ? taksir(s.burned_total, 0) : "—"} note="fees, lost stakes, unused budget" />
          <Stat label="MINTED SINCE LAUNCH" value="0" note="no mint function" />
          <Stat label="TREASURY" value={s ? taksir(s.treasury, 0) : "—"} note="pays rewards for catches" />
          <Stat label="NEXT EPOCH IN" value={countdown} note="unclaimed budget burns at each turn" />
          <Stat
            label="REWARD BUDGET LEFT"
            value={s ? taksir(s.budget_left, 0) : "—"}
            note={s ? `of ${taksir(s.budget, 0)} this epoch` : undefined}
          />
          <Stat label="EPOCHS SINCE MR. X GOT BUSTED" value={s ? s.clean_streak : "—"} />
          <Stat label="LONGEST CLEAN RUN" value={s ? s.best_streak : "—"} note="epochs" />
        </dl>
      </section>

      <section aria-labelledby="how-title" className="section">
        <h2 id="how-title" className="caption">
          HOW IT WORKS
        </h2>
        <ol className="steps">
          <li>
            <span className="steps__n">01</span>
            <h3>TAKSIR</h3>
            <p>Mr. X prices your list. 50 $TAKSIR fee, burned.</p>
          </li>
          <li>
            <span className="steps__n">02</span>
            <h3>SIDAK</h3>
            <p>Same lines, new order. Stake 25 $TAKSIR.</p>
          </li>
          <li>
            <span className="steps__n">03</span>
            <h3>VERDICT</h3>
            <p>
              Price moves more than 75%? BUSTED: stake back + 50 $TAKSIR from the treasury. Holds steady? Your stake
              burns.
            </p>
          </li>
        </ol>
      </section>

      <section aria-labelledby="recent-title" className="section">
        <div className="row row--between">
          <h2 id="recent-title" className="caption">
            LATEST CASES
          </h2>
          <Link to="/cases" className="link-quiet">
            ALL CASES →
          </Link>
        </div>
        {s ? <RecentCases count={s.appraisal_count} windowMs={params.data?.challenge_window_ms} now={now} /> : null}
      </section>
    </main>
  );
}
