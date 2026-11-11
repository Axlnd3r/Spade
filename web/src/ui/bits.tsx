import type { ReactNode } from "react";
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
