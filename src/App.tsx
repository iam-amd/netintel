import { AlertTriangle, FileUp, Radio, Upload } from "lucide-react";
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

const baseCustomer: CustomerInput = {
  customer_id: "DEMO-CUST-0104",
  plan_type: "Standard_100Mbps",
  area_type: "Residential",
  region: "South",
  monthly_revenue_inr: 799,
  tenure_months: 18,
  data_usage_gb: 210,
  support_tickets_30d: 1,
  late_payments_6m: 1,
  payment_delay_days: 5,
  days_since_last_contact: 45,
  outages_30d: 1,
  avg_rx_power_dbm: -21,
  plan_change_count: 0,
  has_fiber: 1,
  auto_pay: 1,
  referrals_brought: 0,
};

const scenarios: Record<string, CustomerInput> = {
  "Normal subscriber": {
    ...baseCustomer,
    customer_id: "DEMO-CUST-0104",
    tenure_months: 30,
    support_tickets_30d: 0,
    late_payments_6m: 0,
    payment_delay_days: 0,
    outages_30d: 0,
    avg_rx_power_dbm: -19.5,
    auto_pay: 1,
    referrals_brought: 2,
  },
  "Payment follow-up": {
    ...baseCustomer,
    customer_id: "DEMO-CUST-0742",
    plan_type: "Basic_50Mbps",
    area_type: "Apartment",
    monthly_revenue_inr: 499,
    tenure_months: 6,
    support_tickets_30d: 1,
    late_payments_6m: 4,
    payment_delay_days: 18,
    outages_30d: 1,
    avg_rx_power_dbm: -22,
    auto_pay: 0,
  },
  "Network complaint": {
    ...baseCustomer,
    customer_id: "DEMO-CUST-1188",
    plan_type: "Premium_200Mbps",
    area_type: "PG",
    monthly_revenue_inr: 1299,
    tenure_months: 11,
    data_usage_gb: 520,
    support_tickets_30d: 4,
    late_payments_6m: 1,
    payment_delay_days: 4,
    outages_30d: 5,
    avg_rx_power_dbm: -29,
    auto_pay: 0,
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
      <span className="slider-top">
        <span>
          <strong>{label}</strong>
          <small>{helper}</small>
        </span>
        <b>{value}{suffix}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function MiniBar({ rows }: { rows: { name: string; value: number; count: number }[] }) {
  return (
    <div className="mini-bars">
      {rows.slice(0, 4).map((row) => (
        <div key={row.name}>
          <div className="bar-label">
            <span>{cleanText(row.name)}</span>
            <span>{formatPercent(row.value)}</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.max(row.value * 100, 5)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [customer, setCustomer] = useState<CustomerInput>(scenarios["Normal subscriber"]);
  const [batchRows, setBatchRows] = useState<ScoredCustomer[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  const score = useMemo(() => scoreCustomer(customer), [customer]);
  const rows = batchRows.length > 0 ? batchRows : [score];
  const highRisk = rows.filter((row) => row.band === "High").length;
  const averageRisk = rows.reduce((sum, row) => sum + row.probability, 0) / rows.length;
  const topRisk = [...rows].sort((a, b) => b.probability - a.probability).slice(0, 6);
  const byPlan = useMemo(() => groupAverage(rows, "plan_type"), [rows]);

  function update<K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) {
    setCustomer((current) => ({ ...current, [key]: value }));
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    const result = parseAndScoreCsv(await file.text());
    setBatchRows(result.rows);
    setCsvErrors(result.errors);
  }

  return (
    <main>
      <section className="hero">
        <div>
          <div className="eyebrow"><Radio size={16} /> NetIntel</div>
          <h1>Know which ISP customers need attention first.</h1>
          <p>
            A simple retention dashboard for small ISPs. It looks at complaints, payments, outages, and fiber signal quality, then suggests the next action.
          </p>
        </div>
        <div className="problem-card">
          <strong>The problem</strong>
          <p>Operators usually notice risk after a customer complains. NetIntel helps sort the customer list before the issue becomes a disconnection.</p>
        </div>
      </section>

      <section className="summary-strip">
        <div><span>Checked</span><strong>{rows.length}</strong></div>
        <div><span>Need attention</span><strong>{highRisk}</strong></div>
        <div><span>Average risk</span><strong>{formatPercent(averageRisk)}</strong></div>
      </section>

      <section className="tool-grid">
        <div className="panel">
          <div className="section-title">
            <h2>Try a situation</h2>
            <p>Pick one example, then move only the important sliders.</p>
          </div>

          <div className="scenario-grid">
            {Object.entries(scenarios).map(([name, value]) => (
              <button key={name} className="scenario-card" type="button" onClick={() => setCustomer(value)}>
                <strong>{name}</strong>
                <span>{cleanText(value.plan_type)} · {cleanText(value.area_type)}</span>
              </button>
            ))}
          </div>

          <div className="slider-list">
            <Slider label="Complaints" helper="Tickets raised in the last 30 days" min={0} max={8} value={customer.support_tickets_30d} onChange={(value) => update("support_tickets_30d", value)} />
            <Slider label="Late payments" helper="Delayed payments in the last 6 months" min={0} max={8} value={customer.late_payments_6m} onChange={(value) => update("late_payments_6m", value)} />
            <Slider label="Recent outages" helper="Service interruptions this month" min={0} max={8} value={customer.outages_30d} onChange={(value) => update("outages_30d", value)} />
            <Slider label="Fiber signal" helper="Weak signal is below -27 dBm" min={-35} max={-12} step={0.5} suffix=" dBm" value={customer.avg_rx_power_dbm} onChange={(value) => update("avg_rx_power_dbm", value)} />
            <Slider label="Months with ISP" helper="Long-term customers are usually safer" min={1} max={72} suffix=" mo" value={customer.tenure_months} onChange={(value) => update("tenure_months", value)} />
          </div>

          <label className="simple-check">
            <input type="checkbox" checked={Boolean(customer.auto_pay)} onChange={(event) => update("auto_pay", event.target.checked ? 1 : 0)} />
            Auto-pay is enabled
          </label>
        </div>

        <aside className="panel result-card">
          <div className="result-head">
            <div>
              <span>Churn risk</span>
              <strong>{formatPercent(score.probability)}</strong>
            </div>
            <RiskPill band={score.band} />
          </div>
          <div className="progress-track">
            <div className={`progress-fill ${score.band.toLowerCase()}`} style={{ width: `${score.probability * 100}%` }} />
          </div>
          <div className="answer-block">
            <h3>Why?</h3>
            <ul>
              {score.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </div>
          <div className="answer-block action">
            <h3>Do this next</h3>
            <p>{score.action}</p>
          </div>
        </aside>
      </section>

      <section className="panel upload-panel">
        <div className="section-title split">
          <div>
            <h2>Check many customers</h2>
            <p>Upload a CSV to create a priority list for the team.</p>
          </div>
          <FileUp size={22} />
        </div>
        <div className="csv-help">
          <strong>CSV format</strong>
          <p>Use <code>data/customers.csv</code> as the sample. Important columns:</p>
          <div className="column-list">{csvColumns.map((column) => <code key={column}>{column}</code>)}</div>
        </div>
        <label className="upload-box">
          <Upload size={22} />
          <span>Upload customer CSV</span>
          <input type="file" accept=".csv,text/csv" onChange={(event) => handleFile(event.target.files?.[0] ?? null)} />
        </label>
        {csvErrors.map((error) => <p className="error-text" key={error}>{error}</p>)}
      </section>

      <section className="insight-grid">
        <div className="panel">
          <h2>Risk by plan</h2>
          <MiniBar rows={byPlan} />
        </div>
        <div className="panel">
          <div className="section-title">
            <h2>Priority list</h2>
            <p>Highest risk first.</p>
          </div>
          <div className="priority-list">
            {topRisk.map((row, index) => (
              <div className="priority-row" key={`${row.customer_id}-${index}`}>
                <div>
                  <strong>{row.customer_id ?? `Customer ${index + 1}`}</strong>
                  <span>{cleanText(String(row.plan_type))}</span>
                </div>
                <div>
                  <RiskPill band={row.band} />
                  <b>{formatPercent(row.probability)}</b>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="how-it-works">
        <AlertTriangle size={18} />
        <p>
          Built with synthetic data for public demo use. Python trains the model, exports JSON, and the React app scores customers in the browser.
        </p>
      </section>
    </main>
  );
}
