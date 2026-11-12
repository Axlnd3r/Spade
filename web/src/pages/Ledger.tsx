import { useState } from "react";
import { Link } from "react-router-dom";
import { CONTRACT_ID, EXPLORER, STATS_REFRESH_MS } from "../chain/config";
import { logKindLabel, taksir } from "../chain/format";
import type { LogEntry, Stats } from "../chain/types";
import { useView } from "../hooks/useView";
import { GhostButton, PageTitle } from "../ui/bits";
import { RETRY_TEXT } from "./Overview";

const PAGE = 50;

function utc(ms: number): string {
  return `${new Date(ms).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function signed(e: LogEntry): string {
  const amount = taksir(e.amount, 0);
  return e.kind.startsWith("Burn") ? `−${amount}` : `+${amount}`;
}

/** BurnFee refers to a case (appraisal id); BurnStake and Reward to a SIDAK (challenge id). */
function Ref({ e }: { e: LogEntry }) {
  if (e.kind === "BurnFee" && e.ref_id !== null) return <Link to={`/case/${e.ref_id}`}>CASE #{e.ref_id}</Link>;
  if (e.ref_id !== null) return <>SIDAK #{e.ref_id}</>;
  if (e.kind === "BurnEpoch") return <>{e.epoch_from === e.epoch_to ? `EPOCH ${e.epoch_from}` : `EPOCHS ${e.epoch_from}–${e.epoch_to}`}</>;
  return <>—</>;
}

function LogPage({ count, page }: { count: number; page: number }) {
  const end = count - page * PAGE;
  const from = Math.max(0, end - PAGE);
  const { data } = useView<LogEntry[]>("get_log", { from, limit: end - from }, STATS_REFRESH_MS);
  return (
    <div className="table-wrap">
      <table className="ledger">
        <thead>
          <tr>
            <th scope="col">TIME</th>
            <th scope="col">WHAT</th>
            <th scope="col">$TAKSIR</th>
            <th scope="col">REF</th>
            <th scope="col">ACCOUNT</th>
          </tr>
        </thead>
        <tbody>
          {[...(data ?? [])].reverse().map((e, i) => (
            <tr key={from + (data!.length - 1 - i)}>
              <td className="muted">{utc(e.ts_ms)}</td>
              <td>{logKindLabel(e.kind)}</td>
              <td className="ledger__amount">{signed(e)}</td>
              <td>
                <Ref e={e} />
              </td>
              <td className="muted">{e.account_id ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Ledger() {
  const stats = useView<Stats>("get_stats", {}, STATS_REFRESH_MS);
  const [page, setPage] = useState(0);
  const count = stats.data?.log_count ?? 0;
  const pages = Math.max(1, Math.ceil(count / PAGE));

  return (
    <main className="page">
      <PageTitle caption="06 / 07 — EVERY BURN" title="LEDGER" />
      <p className="lead">
        Every mint, burn and reward the contract has made, newest first. $TAKSIR was minted once at launch; since then
        supply only goes down.
      </p>
      <p className="muted">
        Each entry is written by the contract itself; the contract keeps no transaction hash per entry.{" "}
        <a href={`${EXPLORER}/address/${CONTRACT_ID}`} target="_blank" rel="noreferrer">
          Contract on explorer ↗
        </a>
      </p>
      {stats.error ? (
        <p className="notice" role="status">
          {RETRY_TEXT}
        </p>
      ) : null}
      {count ? <LogPage count={count} page={page} /> : null}
      {pages > 1 ? (
        <div className="row">
          <GhostButton onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            NEWER
          </GhostButton>
          <span className="caption">
            {page + 1} / {pages}
          </span>
          <GhostButton onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>
            OLDER
          </GhostButton>
        </div>
      ) : null}
    </main>
  );
}
