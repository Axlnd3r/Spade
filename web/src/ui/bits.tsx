import { useId, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { appraisalLabel, challengeLabel } from "../chain/format";
import type { AppraisalStatus, ChallengeStatus } from "../chain/types";

export function GhostButton(props: {
  to?: string;
  onClick?(): void;
  disabled?: boolean;
  children: ReactNode;
}) {
  if (props.to)
    return (
      <Link to={props.to} className="ghost">
        {props.children}
      </Link>
    );
  return (
    <button type="button" className="ghost" onClick={props.onClick} disabled={props.disabled}>
      {props.children}
    </button>
  );
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="stat">
      <dt className="caption">{label}</dt>
      <dd className="stat__value">{value}</dd>
      {note ? <dd className="stat__note">{note}</dd> : null}
    </div>
  );
}

/** A hairline gauge: how much of `max` is used, with a tick where `min` starts. */
export function Meter({ label, value, min, max }: { label: string; value: number; min?: number; max: number }) {
  const id = useId();
  const state = value > max ? "over" : min !== undefined && value < min ? "under" : "ok";
  return (
    <div className={`meter meter--${state}`}>
      <span id={id} className="caption">
        {label}
      </span>
      <span className="meter__value">
        {value.toLocaleString("en")} / {max.toLocaleString("en")}
      </span>
      <div className="meter__track" role="meter" aria-labelledby={id} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <span className="meter__fill" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
        {min !== undefined ? <span className="meter__min" style={{ left: `${(min / max) * 100}%` }} /> : null}
      </div>
    </div>
  );
}

export function StatusTag(
  p: { kind: "appraisal"; status: AppraisalStatus } | { kind: "challenge"; status: ChallengeStatus },
) {
  const label = p.kind === "appraisal" ? appraisalLabel(p.status) : challengeLabel(p.status);
  return <span className={`tag tag--${p.status.toLowerCase()}`}>{label}</span>;
}

export function Glossary() {
  return (
    <p className="glossary">
      <span>
        <b>TAKSIR</b>: Indonesian for <i>to appraise</i>.
      </span>{" "}
      <span>
        <b>SIDAK</b>: Indonesian for <i>surprise inspection</i>.
      </span>
    </p>
  );
}

export function PageTitle({ caption, title }: { caption: string; title: string }) {
  return (
    <div className="page-title">
      <span className="caption">{caption}</span>
      <h1>{title}</h1>
    </div>
  );
}
