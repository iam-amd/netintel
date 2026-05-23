import { useMemo, useState } from "react";
import { riskTier, type UiCustomer } from "../uiData";
import { CustomerDetail } from "./CustomerDetail";
import { Icon, Pill, RiskBar, Sparkline, type PillTone } from "./primitives";
import { UploadCsvModal } from "./UploadCsvModal";

export type DatasetKey = "demo-small" | "demo-sample" | "demo-full" | "user";

export type Dataset = {
  key: DatasetKey;
  label: string;
  sub: string;
  count: number;
};

type SortKey = "acct" | "username" | "risk" | "arpu";

const STATUS_TONE: Record<UiCustomer["status"], PillTone> = {
  "Action needed": "bad",
  Watching: "warn",
  Checking: "neutral",
  Healthy: "good",
};

export function DatasetSection({
  datasets,
  datasetKey,
  setDatasetKey,
  customers,
  onUpload,
}: {
  datasets: Dataset[];
  datasetKey: DatasetKey;
  setDatasetKey: (next: DatasetKey) => void;
  customers: UiCustomer[];
  onUpload: (file: File) => void;
}) {
  const [filter, setFilter] = useState<"all" | "high" | "elevated" | "low">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "risk",
    dir: "desc",
  });
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const stats = useMemo(() => {
    const total = customers.length;
    const high = customers.filter((c) => c.risk > 0.66).length;
    const elev = customers.filter((c) => c.risk > 0.33 && c.risk <= 0.66).length;
    const avg = customers.reduce((acc, c) => acc + c.risk, 0) / Math.max(1, total);
    return { total, high, elev, avg };
  }, [customers]);

  const counts = useMemo(
    () => ({
      all: customers.length,
      high: customers.filter((c) => c.risk > 0.66).length,
      elevated: customers.filter((c) => c.risk > 0.33 && c.risk <= 0.66).length,
      low: customers.filter((c) => c.risk <= 0.33).length,
    }),
    [customers],
  );

  const filtered = useMemo(() => {
    let rows = customers;
    if (filter === "high") rows = rows.filter((c) => c.risk > 0.66);
    if (filter === "elevated")
      rows = rows.filter((c) => c.risk > 0.33 && c.risk <= 0.66);
    if (filter === "low") rows = rows.filter((c) => c.risk <= 0.33);

    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter((c) =>
        [c.acct, c.username, c.fullName, c.plan, c.region]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }

    const dir = sort.dir === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * dir;
      }
      return ((av as number) - (bv as number)) * dir;
    });

    return rows.slice(0, 200);
  }, [customers, filter, query, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    );
  }

  const activeAcct = pinned ?? hovered;
  const activeCustomer = useMemo(
    () => customers.find((c) => c.acct === activeAcct) || filtered[0] || null,
    [customers, filtered, activeAcct],
  );

  return (
    <section className="panel dataset-section">
      <header className="ds-head">
        <div className="ds-head-left">
          <div className="panel-eyebrow">Datasets</div>
          <h2 className="panel-title">Customers</h2>
        </div>
        <div className="ds-head-right">
          <div className="ds-cards">
            {datasets.map((ds) => {
              const isUser = ds.key === "user";
              const active = datasetKey === ds.key;
              return (
                <button
                  type="button"
                  key={ds.key}
                  className={`ds-card ${active ? "active" : ""} ${isUser ? "is-user" : ""}`}
                  onClick={() => setDatasetKey(ds.key)}
                >
                  <div className="ds-card-top">
                    <span className="ds-card-label">{ds.label}</span>
                    {isUser && <span className="ds-card-pill">Yours</span>}
                  </div>
                  <span className="ds-card-sub">{ds.sub}</span>
                  <span className="ds-card-n">{ds.count} customers</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="upload-card"
            onClick={() => setUploadOpen(true)}
          >
            <div className="upload-icon">
              <Icon name="upload" size={16} />
            </div>
            <div className="upload-text">
              <div className="ds-card-label">Upload CSV</div>
              <div className="ds-card-sub">Drop a customer file</div>
            </div>
          </button>
        </div>
      </header>

      <div className="ds-stats">
        <div className="ds-stat">
          <div className="ds-stat-label">In dataset</div>
          <div className="ds-stat-val mono">{stats.total}</div>
        </div>
        <div className="ds-stat">
          <div className="ds-stat-label">High risk</div>
          <div className="ds-stat-val mono">
            <span className="tier-dot tier-high" /> {stats.high}
          </div>
        </div>
        <div className="ds-stat">
          <div className="ds-stat-label">Elevated</div>
          <div className="ds-stat-val mono">
            <span className="tier-dot tier-elevated" /> {stats.elev}
          </div>
        </div>
        <div className="ds-stat">
          <div className="ds-stat-label">Average risk</div>
          <div className="ds-stat-val mono">
            {(stats.avg * 100).toFixed(1)}%
          </div>
        </div>
        <div className="ds-stat-spacer" />
        <div className="search-box">
          <Icon name="search" size={12} />
          <input
            placeholder="Search username, account, plan…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <div className="filter-row">
        {[
          { k: "all" as const, label: "All", n: counts.all, tone: null },
          { k: "high" as const, label: "High", n: counts.high, tone: "high" },
          {
            k: "elevated" as const,
            label: "Elevated",
            n: counts.elevated,
            tone: "elevated",
          },
          { k: "low" as const, label: "Low", n: counts.low, tone: "low" },
        ].map((item) => (
          <button
            type="button"
            key={item.k}
            className={`filter-chip ${filter === item.k ? "active" : ""}`}
            onClick={() => setFilter(item.k)}
          >
            {item.tone ? (
              <span className={`tier-dot tier-${item.tone}`} />
            ) : null}
            {item.label} <span className="filter-n">{item.n}</span>
          </button>
        ))}
        <div className="filter-spacer" />
        <span className="filter-meta">
          Hover a row to preview · click to pin
        </span>
      </div>

      <div className="ds-split">
        <div className="ds-table-wrap" onMouseLeave={() => setHovered(null)}>
          <table className="ptable">
            <thead>
              <tr>
                <th onClick={() => toggleSort("acct")}>Account</th>
                <th onClick={() => toggleSort("username")}>Username</th>
                <th>Plan · Region</th>
                <th onClick={() => toggleSort("risk")} className="num">
                  Risk
                </th>
                <th>30-day trend</th>
                <th onClick={() => toggleSort("arpu")} className="num">
                  ARPU
                </th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const { tier } = riskTier(c.risk);
                const isHover = activeCustomer?.acct === c.acct;
                const isPinned = pinned === c.acct;
                const stroke =
                  tier === "high"
                    ? "var(--risk-high)"
                    : tier === "elevated"
                      ? "var(--risk-mid)"
                      : "var(--risk-low)";
                return (
                  <tr
                    key={c.acct}
                    className={`${isHover ? "hovered" : ""} ${isPinned ? "pinned" : ""}`}
                    onMouseEnter={() => setHovered(c.acct)}
                    onClick={() =>
                      setPinned((p) => (p === c.acct ? null : c.acct))
                    }
                  >
                    <td className="mono">{c.acct}</td>
                    <td>
                      <div className="cust-name mono">{c.username}</div>
                      <div className="region-line">{c.fullName}</div>
                    </td>
                    <td className="muted">
                      <div className="plan-line">{c.plan}</div>
                      <div className="region-line">{c.region}</div>
                    </td>
                    <td className="num">
                      <div className="risk-cell">
                        <RiskBar value={c.risk} />
                        <span className="mono risk-pct">
                          {(c.risk * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <Sparkline
                        values={c.trend}
                        width={84}
                        height={22}
                        stroke={stroke}
                        fill="none"
                      />
                    </td>
                    <td className="num mono">₹{c.arpu}</td>
                    <td>
                      <Pill tone={STATUS_TONE[c.status]} dot>
                        {c.status}
                      </Pill>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} className="empty-row">
                    No customers match this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <aside className="ds-sidecar">
          {activeCustomer ? (
            <CustomerDetail
              customer={activeCustomer}
              pinned={pinned === activeCustomer.acct}
            />
          ) : (
            <div className="sidecar-empty">
              Hover a customer to see their risk profile.
            </div>
          )}
        </aside>
      </div>

      {uploadOpen ? (
        <UploadCsvModal
          onClose={() => setUploadOpen(false)}
          onAnalyze={(file) => onUpload(file)}
        />
      ) : null}
    </section>
  );
}
