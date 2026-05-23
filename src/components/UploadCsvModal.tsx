import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./primitives";

type CsvColumn = {
  name: string;
  type: string;
  required: boolean;
  desc: string;
};

const COLUMNS: CsvColumn[] = [
  { name: "customer_id", type: "string", required: true, desc: "Unique customer ID" },
  { name: "first_name", type: "string", required: true, desc: "Given name" },
  { name: "last_name", type: "string", required: true, desc: "Family name" },
  { name: "plan_type", type: "string", required: true, desc: "e.g. Standard_100Mbps, Premium_200Mbps" },
  { name: "locality", type: "string", required: false, desc: "City or area" },
  { name: "tenure_months", type: "integer", required: true, desc: "Months with ISP (0–120)" },
  { name: "avg_rx_power_dbm", type: "number", required: true, desc: "Fiber signal in dBm (e.g. -22)" },
  { name: "late_payments_6m", type: "integer", required: true, desc: "Late payments in last 6 months" },
  { name: "outages_30d", type: "integer", required: true, desc: "Outages in last 30 days" },
  { name: "support_tickets_30d", type: "integer", required: true, desc: "Tickets in last 30 days" },
  { name: "auto_pay", type: "boolean", required: true, desc: "1 / 0" },
  { name: "monthly_revenue_inr", type: "number", required: false, desc: "Monthly revenue (INR)" },
];

const EXAMPLE = `customer_id,first_name,last_name,plan_type,locality,tenure_months,avg_rx_power_dbm,late_payments_6m,outages_30d,support_tickets_30d,auto_pay,monthly_revenue_inr
DEMO-CUST-00001,Arun,Kumar,Standard_100Mbps,Orikkai,18,-20.4,0,0,1,1,799
DEMO-CUST-00002,Priya,Iyer,Premium_200Mbps,Velachery,8,-29.1,3,4,5,0,1199`;

export function UploadCsvModal({
  onClose,
  onAnalyze,
}: {
  onClose: () => void;
  onAnalyze: (file: File) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function handleFile(picked: File | null | undefined) {
    if (!picked) return;
    if (!/\.csv$/i.test(picked.name)) {
      alert("Please choose a .csv file");
      return;
    }
    setFile(picked);
  }

  function copyExample() {
    navigator.clipboard?.writeText(EXAMPLE);
  }

  function downloadTemplate() {
    const blob = new Blob([EXAMPLE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "netintel-template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function onDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragOver(false);
    handleFile(event.dataTransfer.files?.[0] ?? null);
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="modal-head">
          <div>
            <div className="modal-eyebrow">Upload</div>
            <h3 className="modal-title">Bring your own customers</h3>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg
              viewBox="0 0 16 16"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="modal-body">
          <p className="modal-lead">
            Upload a .csv export of your subscriber base. NetIntel will score
            every row against the churn model — your data stays in this browser
            tab.
          </p>

          <section className="modal-section">
            <div className="modal-section-head">
              <h4 className="modal-h4">CSV format</h4>
              <div className="modal-actions-inline">
                <button type="button" className="link-btn" onClick={copyExample}>
                  Copy example
                </button>
                <span className="dot-sep">·</span>
                <button
                  type="button"
                  className="link-btn"
                  onClick={downloadTemplate}
                >
                  Download template
                </button>
              </div>
            </div>

            <div className="csv-table-wrap">
              <table className="csv-table">
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Type</th>
                    <th>Required</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {COLUMNS.map((c) => (
                    <tr key={c.name}>
                      <td className="mono">{c.name}</td>
                      <td className="muted">{c.type}</td>
                      <td>
                        {c.required ? (
                          <span className="req-yes">Required</span>
                        ) : (
                          <span className="req-no">Optional</span>
                        )}
                      </td>
                      <td>{c.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <details className="csv-example">
              <summary>Show example rows</summary>
              <pre className="csv-pre">
                <code>{EXAMPLE}</code>
              </pre>
            </details>
          </section>

          <section className="modal-section">
            <h4 className="modal-h4">Your file</h4>
            <label
              className={`drop-zone ${dragOver ? "is-over" : ""} ${file ? "has-file" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
              {file ? (
                <div className="drop-file">
                  <div className="drop-file-icon">
                    <Icon name="upload" size={18} />
                  </div>
                  <div className="drop-file-meta">
                    <div className="drop-file-name">{file.name}</div>
                    <div className="drop-file-sub mono">
                      {(file.size / 1024).toFixed(1)} KB · ready to analyze
                    </div>
                  </div>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={(event) => {
                      event.preventDefault();
                      setFile(null);
                      if (inputRef.current) inputRef.current.value = "";
                    }}
                  >
                    Choose another
                  </button>
                </div>
              ) : (
                <div className="drop-empty">
                  <div className="drop-icon">
                    <Icon name="upload" size={20} />
                  </div>
                  <div className="drop-title">Drop your .csv here</div>
                  <div className="drop-sub">
                    or click to browse · max 25 MB · UTF-8
                  </div>
                </div>
              )}
            </label>
          </section>
        </div>

        <footer className="modal-foot">
          <div className="modal-foot-note muted">
            Data is processed locally — nothing is uploaded to a server.
          </div>
          <div className="modal-foot-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="primary-btn"
              disabled={!file}
              onClick={() => {
                if (file) {
                  onAnalyze(file);
                  onClose();
                }
              }}
            >
              Analyze {file ? `· ${file.name}` : ""}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
