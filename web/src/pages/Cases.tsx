import { useState } from "react";
import { STATS_REFRESH_MS } from "../chain/config";
import type { Appraisal, Params, Stats } from "../chain/types";
import { useNow } from "../hooks/useNow";
import { useView } from "../hooks/useView";
import { GhostButton, PageTitle } from "../ui/bits";
import { CaseRow } from "../ui/CaseRow";
import { RETRY_TEXT } from "./Overview";

const PAGE = 20;

function CasePage({ count, page, windowMs, now }: { count: number; page: number; windowMs?: number; now: number }) {
  const end = count - page * PAGE;
  const from = Math.max(0, end - PAGE);
  const { data } = useView<Appraisal[]>("get_appraisals", { from, limit: end - from }, STATS_REFRESH_MS);
  return (
    <ol className="case-list">
      {[...(data ?? [])].reverse().map((a) => (
        <CaseRow key={a.id} a={a} windowMs={windowMs} now={now} />
      ))}
    </ol>
  );
}

export default function Cases() {
  const stats = useView<Stats>("get_stats", {}, STATS_REFRESH_MS);
  const params = useView<Params>("get_params");
  const [page, setPage] = useState(0);
  const now = useNow(10000);
  const count = stats.data?.appraisal_count ?? 0;
  const pages = Math.max(1, Math.ceil(count / PAGE));

  return (
    <main className="page">
      <PageTitle caption="04 / 06 — CALL HIS BLUFF" title="CASES" />
      <p className="lead">
        Every list Mr. X has priced, newest first. Open one, change the order of its lines and call SIDAK while the
        1-hour window is open.
      </p>
      {stats.error ? (
        <p className="notice" role="status">
          {RETRY_TEXT}
        </p>
      ) : null}
      {stats.data ? (
        count ? (
          <CasePage count={count} page={page} windowMs={params.data?.challenge_window_ms} now={now} />
        ) : (
          <p className="muted">No cases yet.</p>
        )
      ) : null}
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
