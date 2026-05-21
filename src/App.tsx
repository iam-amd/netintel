import { Activity, AlertTriangle, BarChart3, FileUp, Radio, ShieldCheck, Upload } from "lucide-react";
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
  "Stable customer": {
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
  "Payment follow-up": {
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
  "Line quality issue": {
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

const csvColumns = [
  "customer_id",
  "plan_type",
  "area_type",
  "monthly_revenue_inr",
  "tenure_months",
  "support_tickets_30d",
  "late_payments_6m",
  "outages_30d",
  "avg_rx_power_dbm",
  "auto_pay",
];

function cleanText(value: string) {
  return value.replace(/_/g, " ");
}

function RiskPill({ band }: { band: ScoredCustomer["band"] }) {
  return <span className={`risk-pill ${band.toLowerCase()}`}>{band}</span>;
}

function ChoiceGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="field-block">
      <span className="field-label">{label}</span>
      <div className="chip-row">
        {options.map((option) => (
          <button
            className={value === option ? "chip active" : "chip"}
            key={option}
            onClick={() => onChange(option)}
            type="button"
          >
            {cleanText(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Slider({
  label,
  helper,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  helper: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="slider-field">
      <span className="slider-head">
        <span>
          <strong>{label}</strong>
          <small>{helper}</small>
        </span>
        <b>{value}{suffix}</b>
      </span>
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
    </label>
  );
}

function BarList({ rows }: { rows: { name: string; value: number; count: number }[] }) {
  if (rows.length === 0) return <p className="muted">Upload customers to see this chart.</p>;

  return (
    <div className="bar-list">
      {rows.map((row) => (
        <div className="bar-row" key={row.name}>
          <div className="bar-label">
            <span>{cleanText(row.name)}</span>
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

export default function App() {
  const [form, setForm] = useState<CustomerInput>(presets["Stable customer"]);
  const [batchRows, setBatchRows] = useState<ScoredCustomer[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  const manualScore = useMemo(() => scoreCustomer(form), [form]);
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
    setForm(presets[name]);
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
          <div className="eyebrow"><Radio size={16} /> NetIntel</div>
          <h1>Find ISP customers who need attention before they disconnect.</h1>
          <p>
            NetIntel turns everyday ISP signals like complaints, payment delay, outages, and fiber signal quality into a clear retention priority list.
          </p>
        </div>
        <div className="hero-panel">
          <h2>Why this helps</h2>
          <p>Small ISPs usually react after a customer complains or leaves. This tool helps the operator decide who needs a call, payment reminder, or line check first.</p>
        </div>
      </section>

      <section className="metrics-grid">
        <div className="metric-card">
          <Activity size={18} />
          <span>Customers checked</span>
          <strong>{allRows.length}</strong>
        </div>
        <div className="metric-card">
          <AlertTriangle size={18} />
          <span>Need attention</span>
          <strong>{highRisk}</strong>
        </div>
        <div className="metric-card">
          <BarChart3 size={18} />
          <span>Average risk</span>
          <strong>{formatPercent(averageRisk)}</strong>
        </div>
        <div className="metric-card">
          <ShieldCheck size={18} />
          <span>Demo data</span>
          <strong>{modelArtifact.metrics.dataset_rows.toLocaleString()} rows</strong>
        </div>
      </section>

      <section className="workspace">
        <div className="panel form-panel">
          <div className="section-title">
            <div>
              <h2>Try a customer situation</h2>
              <p>Move the sliders. The result updates instantly.</p>
            </div>
          </div>

          <div className="field-block">
            <span className="field-label">Quick examples</span>
            <div className="chip-row">
              {Object.keys(presets).map((name) => (
                <button className="chip" key={name} onClick={() => loadPreset(name)} type="button">{name}</button>
              ))}
            </div>
          </div>

          <ChoiceGroup
            label="Plan"
            onChange={(value) => update("plan_type", value)}
            options={modelArtifact.categories.plan_type}
            value={form.plan_type}
          />
          <ChoiceGroup
            label="Customer type"
            onChange={(value) => update("area_type", value)}
            options={modelArtifact.categories.area_type}
            value={form.area_type}
          />

          <div className="slider-grid">
            <Slider label="Monthly bill" helper="What the customer pays" max={3000} min={300} onChange={(value) => update("monthly_revenue_inr", value)} step={50} suffix=" INR" value={form.monthly_revenue_inr} />
            <Slider label="Time with ISP" helper="Longer tenure usually lowers risk" max={72} min={1} onChange={(value) => update("tenure_months", value)} suffix=" mo" value={form.tenure_months} />
            <Slider label="Data usage" helper="Approx monthly usage" max={900} min={10} onChange={(value) => update("data_usage_gb", value)} step={10} suffix=" GB" value={form.data_usage_gb} />
            <Slider label="Complaints" helper="Support tickets in last 30 days" max={10} min={0} onChange={(value) => update("support_tickets_30d", value)} value={form.support_tickets_30d} />
            <Slider label="Late payments" helper="Missed or delayed payments in 6 months" max={8} min={0} onChange={(value) => update("late_payments_6m", value)} value={form.late_payments_6m} />
            <Slider label="Payment delay" helper="Average delay after due date" max={45} min={0} onChange={(value) => update("payment_delay_days", value)} suffix=" days" value={form.payment_delay_days} />
            <Slider label="No-contact days" helper="How long since the team contacted them" max={210} min={1} onChange={(value) => update("days_since_last_contact", value)} suffix=" days" value={form.days_since_last_contact} />
            <Slider label="Service outages" helper="Recent network interruptions" max={10} min={0} onChange={(value) => update("outages_30d", value)} value={form.outages_30d} />
            <Slider label="Fiber signal" helper="Lower than -27 dBm is weak" max={-12} min={-35} onChange={(value) => update("avg_rx_power_dbm", value)} step={0.1} suffix=" dBm" value={form.avg_rx_power_dbm} />
            <Slider label="Referrals" helper="Customers who refer others are usually loyal" max={8} min={0} onChange={(value) => update("referrals_brought", value)} value={form.referrals_brought} />
          </div>

          <div className="toggle-row">
            <label><input type="checkbox" checked={Boolean(form.has_fiber)} onChange={(event) => update("has_fiber", event.target.checked ? 1 : 0)} /> Fiber connection</label>
            <label><input type="checkbox" checked={Boolean(form.auto_pay)} onChange={(event) => update("auto_pay", event.target.checked ? 1 : 0)} /> Auto-pay enabled</label>
          </div>
        </div>

        <div className="panel result-panel">
          <div className="section-title">
            <div>
              <h2>What should the operator do?</h2>
              <p>Simple output, not a black-box score.</p>
            </div>
            <RiskPill band={manualScore.band} />
          </div>
          <div className="score-number">{formatPercent(manualScore.probability)}</div>
          <div className="progress-track">
            <div className={`progress-fill ${manualScore.band.toLowerCase()}`} style={{ width: `${manualScore.probability * 100}%` }} />
          </div>
          <h3>Why this result?</h3>
          <ul className="reason-list">
            {manualScore.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
          <h3>Next action</h3>
          <p className="action-box">{manualScore.action}</p>
        </div>
      </section>

      <section className="panel upload-panel">
        <div className="section-title">
          <div>
            <h2>Check a full customer list</h2>
            <p>Upload a CSV and NetIntel will rank the customers who need attention first.</p>
          </div>
          <FileUp size={22} />
        </div>
        <div className="csv-help">
          <strong>CSV format</strong>
          <p>Use <code>data/customers.csv</code> as the sample. These are the most important columns:</p>
          <div className="column-list">
            {csvColumns.map((column) => <code key={column}>{column}</code>)}
          </div>
        </div>
        <label className="upload-box">
          <Upload size={22} />
          <span>Upload customer CSV</span>
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
          <h2>Risk by customer type</h2>
          <BarList rows={byArea} />
        </div>
      </section>

      <section className="panel table-panel">
        <div className="section-title">
          <div>
            <h2>Priority list</h2>
            <p>Highest predicted churn risk first.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Plan</th>
                <th>Type</th>
                <th>Risk</th>
                <th>Main signal</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {topRisk.map((row, index) => (
                <tr key={`${row.customer_id}-${index}`}>
                  <td>{row.customer_id ?? `Customer ${index + 1}`}</td>
                  <td>{cleanText(String(row.plan_type ?? "Unknown"))}</td>
                  <td>{cleanText(String(row.area_type ?? "Unknown"))}</td>
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
        <h2>How it works</h2>
        <p>
          The Python script creates realistic synthetic ISP records and trains a Logistic Regression model. The model is exported as JSON, and this React app calculates the score in the browser. No real customer data is used.
        </p>
        <div className="note-grid">
          <span>Precision: {modelArtifact.metrics.precision.toFixed(3)}</span>
          <span>Recall: {modelArtifact.metrics.recall.toFixed(3)}</span>
          <span>F1: {modelArtifact.metrics.f1.toFixed(3)}</span>
          <span>ROC-AUC: {modelArtifact.metrics.roc_auc.toFixed(3)}</span>
        </div>
      </section>
    </main>
  );
}
