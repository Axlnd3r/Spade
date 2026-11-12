import { Link, useParams } from "react-router-dom";
import { EXPLORER, STATS_REFRESH_MS } from "../chain/config";
import { diffPct, taksir } from "../chain/format";
import type { Appraisal, Challenge, Params } from "../chain/types";
import { useNow } from "../hooks/useNow";
import { useView } from "../hooks/useView";
import { PageTitle, StatusTag } from "../ui/bits";
import { BustCard } from "../ui/BustCard";
import { SidakPanel } from "../ui/SidakPanel";
import { RETRY_TEXT } from "./Overview";

function NotFound() {
  return (
    <main className="page">
      <PageTitle caption="CASE" title="Case not found." />
      <Link to="/cases" className="ghost">
        BACK TO CASES
      </Link>
    </main>
  );
}

function ChallengeRow({ c, p1 }: { c: Challenge; p1: number }) {
  return (
    <li className="challenge-row">
      <span className="caption">#{c.id}</span>
      <span>{c.price === null ? "—" : `${p1.toLocaleString("en")} → ${c.price.toLocaleString("en")}`}</span>
      <span className="muted">{c.price === null ? "" : `${diffPct(p1, c.price).toFixed(2)}% apart`}</span>
      <StatusTag kind="challenge" status={c.status} />
      <span className="muted">{c.status === "Caught" ? `+${taksir(c.reward, 0)} $TAKSIR` : ""}</span>
      <a className="link-quiet" href={`${EXPLORER}/address/${c.challenger}`} target="_blank" rel="noreferrer">
        {c.challenger} ↗
      </a>
    </li>
  );
}

function CaseView({ id }: { id: number }) {
  const appraisal = useView<Appraisal | null>("get_appraisal", { id }, STATS_REFRESH_MS);
  const challenges = useView<Challenge[]>("get_challenges", { appraisal_id: id }, STATS_REFRESH_MS);
  const params = useView<Params>("get_params");
  const now = useNow();

  if (appraisal.data === null) return <NotFound />;
  const a = appraisal.data;
  const list = challenges.data ?? [];
  const caught = list.find((c) => c.status === "Caught");

  return (
    <main className="page">
      <PageTitle caption={`CASE #${id}${a ? ` · ${a.owner}` : ""}`} title={a?.price != null ? a.price.toLocaleString("en") : "…"} />
      {appraisal.error ? (
        <p className="notice" role="status">
          {RETRY_TEXT}
        </p>
      ) : null}
      {a ? (
        <>
          <div className="row">
            <StatusTag kind="appraisal" status={a.status} />
            {a.reason ? <p className="lead">“{a.reason}”</p> : null}
          </div>

          {caught && caught.price !== null && a.price !== null ? (
            <BustCard caseId={a.id} p1={a.price} p2={caught.price} reward={caught.reward} hunter={caught.challenger} />
          ) : null}

          <section className="section" aria-labelledby="data-title">
            <h2 id="data-title" className="caption">
              THE LIST, AS MR. X SAW IT
            </h2>
            <ol className="lines">
              {a.data.split("\n").map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ol>
          </section>

          {params.data ? (
            <SidakPanel
              a={a}
              p={params.data}
              now={now}
              onDone={() => {
                appraisal.reload();
                challenges.reload();
              }}
            />
          ) : null}

          <section className="section" aria-labelledby="sidak-list-title">
            <h2 id="sidak-list-title" className="caption">
              SIDAK SO FAR ({list.length})
            </h2>
            {list.length && a.price !== null ? (
              <ol className="challenge-list">
                {list.map((c) => (
                  <ChallengeRow key={c.id} c={c} p1={a.price!} />
                ))}
              </ol>
            ) : (
              <p className="muted">Nobody has called his bluff on this case yet.</p>
            )}
          </section>

          <section className="section" aria-labelledby="proof-title">
            <h2 id="proof-title" className="caption">
              PROOF
            </h2>
            <dl className="proof">
              <dt>Model (NEAR AI Cloud, in a TEE)</dt>
              <dd>{a.model || "—"}</dd>
              <dt>Signed by</dt>
              <dd>{a.signing_address || "—"}</dd>
              <dt>Chat id</dt>
              <dd>{a.chat_id || "—"}</dd>
              <dt>Response hash (sha256 of the AI reply)</dt>
              <dd>{a.response_hash || "—"}</dd>
              <dt>Signature</dt>
              <dd>{a.signature || "—"}</dd>
            </dl>
            <Link to="/verify" className="link-quiet">
              HOW TO CHECK THESE →
            </Link>
          </section>
        </>
      ) : (
        <p className="muted">Loading case…</p>
      )}
    </main>
  );
}

export default function Case() {
  const { id } = useParams();
  if (!id || !/^\d+$/.test(id)) return <NotFound />;
  return <CaseView id={Number(id)} />;
}
