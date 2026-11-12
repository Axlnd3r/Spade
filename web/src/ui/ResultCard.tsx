import { Link } from "react-router-dom";
import type { Appraisal } from "../chain/types";
import { useCountUp } from "../hooks/useCountUp";
import { appUrl, shareUrl } from "./share";

/** What Mr. X said: price, reason, and where to go next. */
export function ResultCard({ a }: { a: Appraisal }) {
  const price = a.price ?? 0;
  const shown = useCountUp(price);
  const text = `Mr. X priced my list at ${a.price} on Spade. Think he's bluffing? Call SIDAK. #NEARHackathon @NEARProtocol`;
  return (
    <section className="panel result" aria-live="polite" aria-labelledby="result-title">
      <span className="caption">MR. X SAYS · CASE #{a.id}</span>
      <p id="result-title" className="result__price">
        {/* The figure counts up on screen; a screen reader hears the final price once. */}
        <span aria-hidden="true">{shown.toLocaleString("en")}</span>
        <span className="sr-only">{price.toLocaleString("en")}</span>
      </p>
      <p className="lead">“{a.reason}”</p>
      <div className="row">
        <Link to={`/case/${a.id}`} className="ghost">
          OPEN CASE #{a.id}
        </Link>
        <a className="link-quiet" href={shareUrl(text, appUrl(`/case/${a.id}`))} target="_blank" rel="noreferrer">
          SHARE ON X ↗
        </a>
      </div>
    </section>
  );
}
