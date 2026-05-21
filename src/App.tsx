import { AlertTriangle, FileUp, Radio, Search, Upload } from "lucide-react";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import demoCsv from "../data/customers.csv?raw";
import { parseAndScoreCsv } from "./csv";
import {
  formatPercent,
  groupAverage,
  modelArtifact,
  normalizeCustomer,
  scoreCustomer,
  type CustomerInput,
  type ScoredCustomer,
} from "./modelScorer";

const demoRows = parseAndScoreCsv(demoCsv).rows;
const initialCustomer = [...demoRows].sort((a, b) => b.probability - a.probability)[0] ?? normalizeCustomer({});

const csvColumns = [
  "customer_id",
  "username",
  "first_name",
  "last_name",
  "phone",
  "locality",
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

function fullName(customer: Partial<CustomerInput>) {
  const name = `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim();
  return name || customer.username || customer.customer_id || "Demo customer";
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

function customerToRaw(customer: CustomerInput): Record<string, string> {
  return Object.fromEntries(
    Object.entries(customer).map(([key, value]) => [key, String(value ?? "")]),
  );
}

export default function App() {
  const [customers, setCustomers] = useState<ScoredCustomer[]>(demoRows);
  const [selected, setSelected] = useState<CustomerInput>(initialCustomer);
  const [search, setSearch] = useState("");
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  const selectedScore = useMemo(() => scoreCustomer(selected), [selected]);
  const rows = customers.length > 0 ? customers : [selectedScore];
  const highRisk = rows.filter((row) => row.band === "High").length;
  const averageRisk = rows.reduce((sum, row) => sum + row.probability, 0) / rows.length;
  const byPlan = useMemo(() => groupAverage(rows, "plan_type"), [rows]);
  const topRisk = [...rows].sort((a, b) => b.probability - a.probability).slice(0, 6);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = [...rows].sort((a, b) => b.probability - a.probability);
    if (!term) return source.slice(0, 10);
    return source.filter((customer) => {
      const text = [
        customer.customer_id,
        customer.username,
        customer.first_name,
        customer.last_name,
        customer.phone,
        customer.locality,
      ].join(" ").toLowerCase();
      return text.includes(term);
    }).slice(0, 10);
  }, [rows, search]);

  function update<K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) {
    setSelected((current) => ({ ...current, [key]: value }));
  }

  function chooseCustomer(customer: ScoredCustomer) {
    setSelected(normalizeCustomer(customerToRaw(customer)));
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    const result = parseAndScoreCsv(await file.text());
    setCustomers(result.rows);
    setCsvErrors(result.errors);
    if (result.rows[0]) chooseCustomer(result.rows[0]);
  }

  return (
    <main>
      <section className="hero">
        <div>
          <div className="eyebrow"><Radio size={16} /> NetIntel</div>
          <h1>Find ISP customers who need attention first.</h1>
          <p>
            Search a simulated subscriber, review their risk report, or upload a customer CSV to create a priority list for the support team.
          </p>
        </div>
        <div className="problem-card">
          <strong>Demo dataset included</strong>
          <p>2,500 simulated subscribers with names, usernames, phone numbers, plans, payment history, outage count, and fiber signal values.</p>
        </div>
      </section>

      <section className="stats-grid">
        <div className="stat-card"><span>Checked</span><strong>{rows.length.toLocaleString()}</strong></div>
        <div className="stat-card"><span>Need attention</span><strong>{highRisk}</strong></div>
        <div className="stat-card"><span>Average risk</span><strong>{formatPercent(averageRisk)}</strong></div>
      </section>

      <section className="dashboard-grid">
        <div className="panel customer-panel">
          <div className="section-title">
            <h2>Customer lookup</h2>
            <p>Search by name, username, customer ID, phone, or locality.</p>
          </div>
          <label className="search-box">
            <Search size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, ID, phone, locality..." />
          </label>
          <div className="customer-list">
            {filteredCustomers.map((customer) => (
              <button
                className={customer.customer_id === selected.customer_id ? "customer-row active" : "customer-row"}
                key={customer.customer_id}
                onClick={() => chooseCustomer(customer)}
                type="button"
              >
                <span>
                  <strong>{fullName(customer)}</strong>
                  <small>{customer.username} - {customer.customer_id}</small>
                </span>
                <span>
                  <RiskPill band={customer.band} />
                  <b>{formatPercent(customer.probability)}</b>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel simulator-panel">
          <div className="section-title">
            <h2>Profile simulator</h2>
            <p>Adjust common ISP signals for the selected customer.</p>
          </div>
          <div className="selected-profile">
            <strong>{fullName(selected)}</strong>
            <span>{selected.username} - {selected.phone} - {selected.locality}</span>
          </div>
          <div className="slider-list">
            <Slider label="Complaints" helper="Tickets raised in last 30 days" min={0} max={8} value={selected.support_tickets_30d} onChange={(value) => update("support_tickets_30d", value)} />
            <Slider label="Late payments" helper="Delayed payments in 6 months" min={0} max={8} value={selected.late_payments_6m} onChange={(value) => update("late_payments_6m", value)} />
            <Slider label="Outages" helper="Service interruptions this month" min={0} max={8} value={selected.outages_30d} onChange={(value) => update("outages_30d", value)} />
            <Slider label="Fiber signal" helper="Below -27 dBm needs field check" min={-35} max={-12} step={0.5} suffix=" dBm" value={selected.avg_rx_power_dbm} onChange={(value) => update("avg_rx_power_dbm", value)} />
            <Slider label="Months with ISP" helper="Longer tenure usually lowers risk" min={1} max={72} suffix=" mo" value={selected.tenure_months} onChange={(value) => update("tenure_months", value)} />
          </div>
          <label className="simple-check">
            <input type="checkbox" checked={Boolean(selected.auto_pay)} onChange={(event) => update("auto_pay", event.target.checked ? 1 : 0)} />
            Auto-pay is enabled
          </label>
        </div>

        <aside className="panel report-card">
          <div className="risk-gauge">
            <div className="gauge-ring" style={{ "--risk": selectedScore.probability } as CSSProperties}>
              <div>
                <strong>{formatPercent(selectedScore.probability)}</strong>
                <span>{selectedScore.band} risk</span>
              </div>
            </div>
          </div>
          <div className="report-section">
            <h2>Customer report</h2>
            <p>{fullName(selected)} is on {cleanText(selected.plan_type)} in {selected.locality || "demo locality"}.</p>
          </div>
          <div className="report-section">
            <h3>Signals</h3>
            <ul>
              {selectedScore.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </div>
          <div className="action-box">
            <h3>Action plan</h3>
            <p>{selectedScore.action}</p>
          </div>
        </aside>
      </section>

      <section className="lower-grid">
        <div className="panel upload-panel">
          <div className="section-title split">
            <div>
              <h2>Use your own data</h2>
              <p>Upload CSV in the same format as the simulated dataset.</p>
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
                  <strong>{fullName(row)}</strong>
                  <span>{row.customer_id} - {cleanText(String(row.plan_type))}</span>
                </div>
                <div>
                  <RiskPill band={row.band} />
                  <b>{formatPercent(row.probability)}</b>
                </div>
              </div>
            ))}
          </div>
          <div className="plan-risk">
            <h3>Risk by plan</h3>
            <MiniBar rows={byPlan} />
          </div>
        </div>
      </section>

      <section className="how-it-works">
        <AlertTriangle size={18} />
        <p>All visible customer data is simulated. Python trains the model, exports JSON, and the React app scores customers in the browser.</p>
      </section>
    </main>
  );
}
