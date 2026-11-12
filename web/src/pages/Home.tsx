import { useEffect, useRef, type CSSProperties } from "react";
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

const RECENT = 5;

const two = (n: number) => String(n).padStart(2, "0");

/** The "days since the last accident" board: epochs since Mr. X was last busted. */
function StreakBoard({ s, epochMs, lastBust }: { s?: Stats; epochMs?: number; lastBust?: Appraisal }) {
  return (
    <section className="streak" aria-labelledby="streak-title">
      <p className="streak__value">{s ? two(s.clean_streak) : "—"}</p>
      <div className="streak__side">
        <h2 id="streak-title" className="streak__label">
          EPOCHS SINCE MR. X GOT BUSTED
        </h2>
        <dl className="streak__facts">
          <div>
            <dt className="caption">LONGEST CLEAN RUN</dt>
            <dd>{s ? two(s.best_streak) : "—"}</dd>
          </div>
        </dl>
        {epochMs ? <p className="caption muted">1 EPOCH = {epochMs / 60000} MIN. A BUST RESETS THE COUNT.</p> : null}
        {lastBust ? (
          <Link to={`/case/${lastBust.id}`} className="link-quiet">
            LAST BUST · CASE #{lastBust.id} →
          </Link>
        ) : null}
      </div>
    </section>
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
  const count = s?.appraisal_count;
  const recentArgs = count ? { from: count - Math.min(RECENT, count), limit: Math.min(RECENT, count) } : null;
  const recent = [...(useView<Appraisal[]>("get_appraisals", recentArgs, STATS_REFRESH_MS).data ?? [])].reverse();
  const lastBust = recent.find((a) => a.status === "Caught");
  const epochMs = params.data?.epoch_ms;
  const genesisMs = genesis.data?.[0]?.ts_ms;
  const countdown = epochMs && genesisMs ? mmss(nextEpochMs(genesisMs, epochMs, now) - now) : "—";

  return (
    <main className="page page--home">
      <section className="hero" aria-labelledby="hero-title">
        <span className="caption hero__in" style={{ "--i": 0 } as CSSProperties}>
          MEET MR. X
        </span>
        <h1 id="hero-title" className="hero__title">
          <span className="hero__in" style={{ "--i": 1 } as CSSProperties}>
            RUG THE AI,
          </span>{" "}
          <span className="hero__in" style={{ "--i": 2 } as CSSProperties}>
            NOT THE HOLDERS.
          </span>
        </h1>
        <p className="lead hero__in" style={{ "--i": 3 } as CSSProperties}>
          Mr. X is an AI sealed inside a TEE. He prices your data. Shuffle the lines and ask again: if his price jumps,
          you caught him bluffing, and the treasury pays you.
        </p>
        <div className="row hero__in" style={{ "--i": 4 } as CSSProperties}>
          <GhostButton to="/cases">CALL HIS BLUFF</GhostButton>
          <Link to="/taksir" className="link-quiet">
            GET A PRICE →
          </Link>
        </div>
        <span className="hero__scroll" aria-hidden="true">
          SCROLL
        </span>
      </section>

      <StreakBoard s={s} epochMs={epochMs} lastBust={lastBust} />

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
          <Stat label="SUPPLY" value={s ? taksir(s.total_supply, 0) : "—"} note="$TAKSIR, only goes down" />
          <Stat label="BURNED" value={s ? taksir(s.burned_total, 0) : "—"} note="fees, lost stakes, spare budget" />
          <Stat label="MINTED SINCE LAUNCH" value="0" note="no mint function" />
          <Stat label="TREASURY" value={s ? taksir(s.treasury, 0) : "—"} note="pays rewards for catches" />
          <Stat label="NEXT EPOCH IN" value={countdown} note="spare budget burns then" />
          <Stat
            label="REWARD BUDGET LEFT"
            value={s ? taksir(s.budget_left, 0) : "—"}
            note={s ? `of ${taksir(s.budget, 0)} this epoch` : undefined}
          />
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
        {s && !count ? (
          <p className="muted">No cases yet. Be the first: give Mr. X something to price.</p>
        ) : (
          <ol className="case-list">
            {recent.map((a) => (
              <CaseRow key={a.id} a={a} windowMs={params.data?.challenge_window_ms} now={now} />
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
