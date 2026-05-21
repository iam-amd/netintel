import { Activity, AlertTriangle, BarChart3, FileUp, Radar, ShieldCheck, Upload } from "lucide-react";
import type { ChangeEvent } from "react";
import { useMemo, useState } from "react";
import { parseAndScoreCsv } from "./csv";
import {
  formatPercent,
  groupAverage,
  modelArtifact,
  scoreCustomer,
  type CustomerInput,
  type ScoredCustomer,
} from "./modelScorer";

const presets: Record<string, CustomerInput> = {
  "Healthy customer": {
    customer_id: "DEMO-CUST-0104",
    plan_type: "Standard_100Mbps",
    area_type: "Residential",
    region: "South",
    monthly_revenue_inr: 799,
    tenure_months: 32,
    data_usage_gb: 215,
    support_tickets_30d: 0,
    late_payments_6m: 0,
    payment_delay_days: 0,
    days_since_last_contact: 18,
    outages_30d: 0,
    avg_rx_power_dbm: -19.4,
    plan_change_count: 1,
    has_fiber: 1,
    auto_pay: 1,
    referrals_brought: 2,
  },
  "Payment risk": {
    customer_id: "DEMO-CUST-0742",
    plan_type: "Basic_50Mbps",
    area_type: "Apartment",
    region: "West",
    monthly_revenue_inr: 499,
    tenure_months: 6,
    data_usage_gb: 125,
    support_tickets_30d: 1,
    late_payments_6m: 4,
    payment_delay_days: 18,
    days_since_last_contact: 95,
    outages_30d: 1,
    avg_rx_power_dbm: -22.4,
    plan_change_count: 0,
    has_fiber: 1,
    auto_pay: 0,
    referrals_brought: 0,
  },
  "Network quality risk": {
    customer_id: "DEMO-CUST-1188",
    plan_type: "Premium_200Mbps",
    area_type: "PG",
    region: "Central",
    monthly_revenue_inr: 1299,
    tenure_months: 11,
    data_usage_gb: 520,
    support_tickets_30d: 3,
    late_payments_6m: 1,
    payment_delay_days: 4,
    days_since_last_contact: 58,
    outages_30d: 5,
    avg_rx_power_dbm: -29.1,
    plan_change_count: 1,
    has_fiber: 1,
    auto_pay: 0,
    referrals_brought: 0,
  },
};

function numberValue(value: number, update: (value: number) => void, min = 0, max = 9999) {
  return {
    value,
    min,
    max,
    onChange: (event: ChangeEvent<HTMLInputElement>) => update(Number(event.target.value)),
  };
}

function BarList({ rows }: { rows: { name: string; value: number; count: number }[] }) {
  if (rows.length === 0) return <p className="muted">Upload or score customers to see this chart.</p>;

  return (
    <div className="bar-list">
      {rows.map((row) => (
        <div className="bar-row" key={row.name}>
          <div className="bar-label">
            <span>{row.name}</span>
            <span>{formatPercent(row.value)} · {row.count}</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.max(row.value * 100, 4)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function RiskPill({ band }: { band: ScoredCustomer["band"] }) {
  return <span className={`risk-pill ${band.toLowerCase()}`}>{band}</span>;
}

export default function App() {
  const [form, setForm] = useState<CustomerInput>(presets["Healthy customer"]);
  const [manualScore, setManualScore] = useState<ScoredCustomer>(() => scoreCustomer(presets["Healthy customer"]));
  const [batchRows, setBatchRows] = useState<ScoredCustomer[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  const allRows = batchRows.length > 0 ? batchRows : [manualScore];
  const highRisk = allRows.filter((row) => row.band === "High").length;
  const averageRisk = allRows.reduce((sum, row) => sum + row.probability, 0) / allRows.length;
  const byPlan = useMemo(() => groupAverage(allRows, "plan_type"), [allRows]);
  const byArea = useMemo(() => groupAverage(allRows, "area_type"), [allRows]);
  const topRisk = [...allRows].sort((a, b) => b.probability - a.probability).slice(0, 8);

  function update<K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function loadPreset(name: string) {
    const next = presets[name];
    setForm(next);
    setManualScore(scoreCustomer(next));
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    const result = parseAndScoreCsv(text);
    setBatchRows(result.rows);
    setCsvErrors(result.errors);
  }

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><Radar size={16} /> NetIntel</div>
          <h1>ISP churn risk scoring, built as a clean portfolio demo.</h1>
          <p>
            Python trains an explainable model on synthetic telecom data. React scores customers in the browser, so the demo deploys cleanly on Vercel.
          </p>
        </div>
        <div className="hero-panel">
          <div>
            <span className="panel-label">Model</span>
            <strong>{modelArtifact.metrics.model ?? "Logistic Regression"}</strong>
          </div>
          <div>
            <span className="panel-label">Demo rows</span>
            <strong>{modelArtifact.metrics.dataset_rows.toLocaleString()}</strong>
          </div>
          <div>
            <span className="panel-label">ROC-AUC</span>
            <strong>{modelArtifact.metrics.roc_auc.toFixed(3)}</strong>
          </div>
        </div>
      </section>

      <section className="metrics-grid">
        <div className="metric-card">
          <Activity size={18} />
          <span>Rows scored</span>
          <strong>{allRows.length}</strong>
        </div>
        <div className="metric-card">
          <AlertTriangle size={18} />
          <span>High risk</span>
          <strong>{highRisk}</strong>
        </div>
        <div className="metric-card">
          <BarChart3 size={18} />
          <span>Average risk</span>
          <strong>{formatPercent(averageRisk)}</strong>
        </div>
        <div className="metric-card">
          <ShieldCheck size={18} />
          <span>Data type</span>
          <strong>Synthetic</strong>
        </div>
      </section>

      <section className="workspace">
        <div className="panel form-panel">
          <div className="section-title">
            <div>
              <h2>Score one customer</h2>
              <p>Use a preset or enter a profile manually.</p>
            </div>
          </div>

          <label>
            Preset
            <select onChange={(event) => loadPreset(event.target.value)} defaultValue="Healthy customer">
              {Object.keys(presets).map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>

          <div className="form-grid">
            <label>
              Plan
              <select value={form.plan_type} onChange={(event) => update("plan_type", event.target.value)}>
                {modelArtifact.categories.plan_type.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Area
              <select value={form.area_type} onChange={(event) => update("area_type", event.target.value)}>
                {modelArtifact.categories.area_type.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Region
              <select value={form.region} onChange={(event) => update("region", event.target.value)}>
                {modelArtifact.categories.region.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Monthly revenue
              <input type="number" {...numberValue(form.monthly_revenue_inr, (value) => update("monthly_revenue_inr", value), 0, 5000)} />
            </label>
            <label>
              Tenure months
              <input type="number" {...numberValue(form.tenure_months, (value) => update("tenure_months", value), 1, 72)} />
            </label>
            <label>
              Data usage GB
              <input type="number" {...numberValue(form.data_usage_gb, (value) => update("data_usage_gb", value), 0, 2000)} />
            </label>
            <label>
              Tickets 30d
              <input type="number" {...numberValue(form.support_tickets_30d, (value) => update("support_tickets_30d", value), 0, 20)} />
            </label>
            <label>
              Late payments 6m
              <input type="number" {...numberValue(form.late_payments_6m, (value) => update("late_payments_6m", value), 0, 20)} />
            </label>
            <label>
              Payment delay days
              <input type="number" {...numberValue(form.payment_delay_days, (value) => update("payment_delay_days", value), 0, 60)} />
            </label>
            <label>
              Days since contact
              <input type="number" {...numberValue(form.days_since_last_contact, (value) => update("days_since_last_contact", value), 0, 365)} />
            </label>
            <label>
              Outages 30d
              <input type="number" {...numberValue(form.outages_30d, (value) => update("outages_30d", value), 0, 20)} />
            </label>
            <label>
              Rx power dBm
              <input type="number" step="0.1" {...numberValue(form.avg_rx_power_dbm, (value) => update("avg_rx_power_dbm", value), -40, -5)} />
            </label>
            <label>
              Plan changes
              <input type="number" {...numberValue(form.plan_change_count, (value) => update("plan_change_count", value), 0, 12)} />
            </label>
            <label>
              Referrals
              <input type="number" {...numberValue(form.referrals_brought, (value) => update("referrals_brought", value), 0, 20)} />
            </label>
          </div>

          <div className="toggle-row">
            <label><input type="checkbox" checked={Boolean(form.has_fiber)} onChange={(event) => update("has_fiber", event.target.checked ? 1 : 0)} /> Fiber connection</label>
            <label><input type="checkbox" checked={Boolean(form.auto_pay)} onChange={(event) => update("auto_pay", event.target.checked ? 1 : 0)} /> Auto-pay enabled</label>
          </div>

          <button className="primary-button" onClick={() => {
            const next = scoreCustomer(form);
            setManualScore(next);
            if (batchRows.length === 0) setBatchRows([]);
          }}>
            Score customer
          </button>
        </div>

        <div className="panel result-panel">
          <div className="section-title">
            <div>
              <h2>Result</h2>
              <p>Risk band, top reasons, and a practical next action.</p>
            </div>
            <RiskPill band={manualScore.band} />
          </div>
          <div className="score-number">{formatPercent(manualScore.probability)}</div>
          <div className="progress-track">
            <div className={`progress-fill ${manualScore.band.toLowerCase()}`} style={{ width: `${manualScore.probability * 100}%` }} />
          </div>
          <h3>Main reasons</h3>
          <ul className="reason-list">
            {manualScore.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
          <h3>Operator action</h3>
          <p className="action-box">{manualScore.action}</p>
        </div>
      </section>

      <section className="panel upload-panel">
        <div className="section-title">
          <div>
            <h2>Upload your own CSV</h2>
            <p>Use the generated `data/customers.csv` format or your own file with matching columns.</p>
          </div>
          <FileUp size={22} />
        </div>
        <label className="upload-box">
          <Upload size={22} />
          <span>Choose CSV file</span>
          <input type="file" accept=".csv,text/csv" onChange={(event) => handleFile(event.target.files?.[0] ?? null)} />
        </label>
        {csvErrors.map((error) => <p className="error-text" key={error}>{error}</p>)}
      </section>

      <section className="insights-grid">
        <div className="panel">
          <h2>Risk by plan</h2>
          <BarList rows={byPlan} />
        </div>
        <div className="panel">
          <h2>Risk by area</h2>
          <BarList rows={byArea} />
        </div>
      </section>

      <section className="panel table-panel">
        <div className="section-title">
          <div>
            <h2>Top risky customers</h2>
            <p>Sorted by predicted churn probability.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Plan</th>
                <th>Area</th>
                <th>Risk</th>
                <th>Reason</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {topRisk.map((row, index) => (
                <tr key={`${row.customer_id}-${index}`}>
                  <td>{row.customer_id ?? `Customer ${index + 1}`}</td>
                  <td>{row.plan_type}</td>
                  <td>{row.area_type}</td>
                  <td><RiskPill band={row.band} /> {formatPercent(row.probability)}</td>
                  <td>{row.reasons[0]}</td>
                  <td>{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel notes-panel">
        <h2>Model notes</h2>
        <p>
          NetIntel uses synthetic data and a Logistic Regression model because the goal is a clear portfolio demo, not a black-box production system.
          The model runs fully in the browser using coefficients exported from Python.
        </p>
        <div className="note-grid">
          <span>Precision: {modelArtifact.metrics.precision.toFixed(3)}</span>
          <span>Recall: {modelArtifact.metrics.recall.toFixed(3)}</span>
          <span>F1: {modelArtifact.metrics.f1.toFixed(3)}</span>
          <span>Churn rate: {formatPercent(modelArtifact.metrics.churn_rate)}</span>
        </div>
      </section>
    </main>
  );
}
