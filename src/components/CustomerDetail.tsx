import { useMemo } from "react";
import {
  contributorFactors,
  recommendation,
  riskTier,
  toProfile,
  type UiCustomer,
} from "../uiData";
import { Gauge, Sparkline } from "./primitives";

export function CustomerDetail({
  customer,
  pinned,
}: {
  customer: UiCustomer;
  pinned: boolean;
}) {
  const factors = useMemo(
    () => contributorFactors(toProfile(customer.raw)),
    [customer.raw],
  );
  const { tier, label } = riskTier(customer.risk);
  const topFactors = [...factors].sort((a, b) => b.weight - a.weight).slice(0, 4);
  const reco = recommendation(customer);
  const strokeColor =
    tier === "high"
      ? "var(--risk-high)"
      : tier === "elevated"
        ? "var(--risk-mid)"
        : "var(--risk-low)";

  return (
    <div className={`sidecar-card tier-${tier}`}>
      <div className="sidecar-head">
        <div>
          <div className="sidecar-name mono">{customer.username}</div>
          <div className="sidecar-acct">
            {customer.fullName} · {customer.acct}
          </div>
        </div>
        {pinned ? <span className="pinned-tag">Pinned</span> : null}
      </div>

      <div className="sidecar-gauge">
        <Gauge value={customer.risk} size={132} />
      </div>

      <div className="sidecar-section">
        <div className="sidecar-section-head">
          <span className="sidecar-eyebrow">Top contributors</span>
          <span className={`tier-chip tier-${tier}`}>{label}</span>
        </div>
        {topFactors.map((f) => (
          <div className="factor-row" key={f.key}>
            <div className="factor-label">{f.label}</div>
            <div className="factor-bar-wrap">
              <div
                className="factor-bar"
                style={{ width: `${Math.max(4, f.weight * 100)}%` }}
              />
            </div>
            <div className="factor-val">{f.value}</div>
          </div>
        ))}
      </div>

      <div className="sidecar-section">
        <div className="sidecar-eyebrow">Risk trend · 30 days</div>
        <div className="sidecar-trend">
          <Sparkline
            values={customer.trend}
            width={264}
            height={48}
            stroke={strokeColor}
            fill="none"
            dotLast={false}
          />
          <div className="sidecar-trend-axis mono">
            <span>30d</span>
            <span>now</span>
          </div>
        </div>
      </div>

      <div className="sidecar-section">
        <div className="sidecar-eyebrow">Signals</div>
        <div className="signal-grid">
          <div className="signal">
            <div className="signal-label">Plan</div>
            <div className="signal-val">{customer.plan}</div>
          </div>
          <div className="signal">
            <div className="signal-label">MRR</div>
            <div className="signal-val mono">₹{customer.arpu}</div>
          </div>
          <div className="signal">
            <div className="signal-label">Autopay</div>
            <div className="signal-val">
              <span className={`signal-dot ${customer.autopay ? "on" : "off"}`} />
              {customer.autopay ? "Enrolled" : "Off"}
            </div>
          </div>
          <div className="signal">
            <div className="signal-label">Region</div>
            <div className="signal-val">{customer.region}</div>
          </div>
        </div>
      </div>

      <div className="sidecar-section">
        <div className="sidecar-eyebrow">Suggested next step</div>
        <div className="reco-card">
          <div className="reco-title">{reco.title}</div>
          <div className="reco-detail">{reco.detail}</div>
        </div>
      </div>
    </div>
  );
}
