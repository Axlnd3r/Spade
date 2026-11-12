import { Link } from "react-router-dom";
import type { Appraisal } from "../chain/types";
import { windowLeftMs } from "../pages/epoch";
import { StatusTag } from "./bits";

function windowNote(a: Appraisal, windowMs: number | undefined, now: number): string {
  if (a.status !== "Priced" || a.priced_ms === null || windowMs === undefined) return "";
  const left = windowLeftMs(a.priced_ms, windowMs, now);
  return left > 0 ? `SIDAK OPEN · ${Math.ceil(left / 60000)} MIN LEFT` : "SIDAK CLOSED";
}

/** One appraisal in a list: first line, price, status, inspections, SIDAK window. */
export function CaseRow({ a, windowMs, now }: { a: Appraisal; windowMs?: number; now: number }) {
  const first = a.data.split("\n")[0] ?? "";
  const lines = a.data.split("\n").length;
  return (
    <li>
      <Link to={`/case/${a.id}`} className="case-row">
        <span className="case-row__id caption">#{a.id}</span>
        <span className="case-row__main">
          <span className="case-row__title">{first}</span>
          <span className="case-row__meta">
            {[`${lines} LINES`, `${a.challenge_ids.length} SIDAK`, windowNote(a, windowMs, now)].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="case-row__price">{a.price?.toLocaleString("en") ?? "—"}</span>
        <StatusTag kind="appraisal" status={a.status} />
      </Link>
    </li>
  );
}
