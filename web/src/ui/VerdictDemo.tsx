import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { diffPct, isBusted } from "../chain/format";

/** Mr. X's first answer in the demo: the top of the range, like the real bust on case #3. */
const FIRST = 10000;
const MAX = 10000;

const PRESETS = [
  { label: "HE HOLDS", value: 9500 },
  { label: "HE WOBBLES", value: 4000 },
  { label: "HE'S FOOLED", value: 1 },
] as const;

/** The verdict, playable: drag Mr. X's second answer and see the contract's rule decide, with what it
 * means in $TAKSIR. `stake` and `reward` are display amounts; `thresholdBps` is the contract's limit. */
export function VerdictDemo({ stake, reward, thresholdBps }: { stake: string; reward: string; thresholdBps: number }) {
  const id = useId();
  // Starts on the real thing: case #3 went from 10,000 to 1.
  const [second, setSecond] = useState(1);
  const busted = isBusted(FIRST, second, thresholdBps);
  const limit = thresholdBps / 100;
  // Below this share of the first answer the verdict is BUSTED.
  const zone = (((10000 - thresholdBps) / 10000) * FIRST * 100) / MAX;

  return (
    <section className="panel verdict" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="caption">
        TRY THE VERDICT
      </h2>
      <p className="muted">Mr. X's first answer was 10,000. Drag the second one: the same lines in a new order.</p>

      <div className="verdict__bars">
        <div className="verdict__row">
          <span className="caption">FIRST ANSWER</span>
          <span className="verdict__num">10,000</span>
        </div>
        <div className="verdict__track" aria-hidden="true">
          <span className="verdict__fill" style={{ width: `${(FIRST / MAX) * 100}%` }} />
        </div>
        <div className="verdict__row">
          <span className="caption">SECOND ANSWER</span>
          <span className="verdict__num" data-testid="second-answer">
            {second.toLocaleString("en")}
          </span>
        </div>
        <div className="verdict__track" aria-hidden="true">
          <span className="verdict__zone" data-testid="busted-zone" style={{ width: `${zone}%` }} />
          <span className="verdict__fill" data-testid="second-bar" style={{ width: `${(second / MAX) * 100}%` }} />
        </div>
        <p className="caption muted">THE STRIPED PART IS BUSTED: MORE THAN {limit}% BELOW THE FIRST ANSWER</p>
      </div>

      <input
        type="range"
        className="verdict__slider"
        aria-label="Second answer"
        min={1}
        max={MAX}
        step={1}
        value={second}
        onChange={(e) => setSecond(Number(e.target.value))}
      />
      <div className="row">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className="chip-btn" onClick={() => setSecond(p.value)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="verdict__result" role="status">
        <strong className={`verdict__word verdict__word--${busted ? "busted" : "held"}`}>{busted ? "BUSTED" : "HELD"}</strong>
        <span className="caption">{`${diffPct(FIRST, second).toFixed(2)}% apart (limit ${limit}%)`}</span>
        <p>
          {busted
            ? `You get your ${stake} $TAKSIR back plus ${reward} $TAKSIR from the treasury: net +${reward}.`
            : `Mr. X stayed consistent, so your ${stake} $TAKSIR stake is burned: net −${stake}. The supply gets smaller.`}
        </p>
      </div>
      <p className="caption muted">
        THIS IS WHAT HAPPENED ON <Link to="/case/3">CASE #3</Link>: 10,000, THEN 1.
      </p>
    </section>
  );
}
