import { useId } from "react";
import { diffPct, taksir } from "../chain/format";
import { appUrl, shareUrl } from "./share";

/** The bragging card for a caught bluff: before and after prices, the gap, the reward. */
export function BustCard(p: { caseId: number; p1: number; p2: number; reward: string; hunter: string }) {
  const titleId = useId();
  const gap = diffPct(p.p1, p.p2).toFixed(2);
  const text = `I called Mr. X's bluff on Spade: ${p.p1} → ${p.p2}. #NEARHackathon @NEARProtocol`;
  return (
    <section className="bust" aria-labelledby={titleId}>
      <span className="caption">$TAKSIR · CASE #{p.caseId} · VERIFIED ON-CHAIN</span>
      <h2 id={titleId} className="bust__title">
        BUSTED!
      </h2>
      <div className="bust__prices">
        <span className="bust__price">{p.p1.toLocaleString("en")}</span>
        <span aria-hidden="true">→</span>
        <span className="bust__price">{p.p2.toLocaleString("en")}</span>
      </div>
      <p className="muted">Same lines, new order: {gap}% apart. The limit is 75%.</p>
      <div className="row row--between">
        <span className="caption">HUNTER · {p.hunter}</span>
        <span className="bust__reward">+{taksir(p.reward, 0)} $TAKSIR</span>
      </div>
      <a className="link-quiet" href={shareUrl(text, appUrl(`/case/${p.caseId}`))} target="_blank" rel="noreferrer">
        SHARE ON X ↗
      </a>
    </section>
  );
}
