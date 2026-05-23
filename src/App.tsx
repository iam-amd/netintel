import { useEffect, useMemo, useState, type CSSProperties } from "react";
import demoCsv from "../data/customers.csv?raw";
import { parseAndScoreCsv } from "./csv";
import { Hero } from "./components/Hero";
import { SimulatorPanel } from "./components/Simulator";
import { TopBar } from "./components/TopBar";
import {
  DatasetSection,
  type Dataset,
  type DatasetKey,
} from "./components/Dataset";
import {
  applyProfile,
  defaultProfile,
  emptyCustomer,
  scoreCustomer,
  stratifiedSample,
  toProfile,
  toUi,
  type SimulatorProfile,
  type UiCustomer,
} from "./uiData";
import type { ScoredCustomer } from "./modelScorer";

const demoRows: ScoredCustomer[] = parseAndScoreCsv(demoCsv).rows;
const demoUi: UiCustomer[] = demoRows.map(toUi);

const watchlistUi: UiCustomer[] = [...demoUi]
  .sort((a, b) => b.risk - a.risk)
  .slice(0, 50);

const sampleUi: UiCustomer[] = stratifiedSample(demoUi, 100, 42);

function makeDatasets(userCount: number): Dataset[] {
  return [
    {
      key: "demo-small",
      label: "Watchlist · top 50",
      sub: "Highest-risk subscribers",
      count: watchlistUi.length,
    },
    {
      key: "demo-sample",
      label: "Sample · 100",
      sub: "Realistic mix of risk levels",
      count: sampleUi.length,
    },
    {
      key: "demo-full",
      label: "All subscribers",
      sub: "Full 2,500 customer base",
      count: demoUi.length,
    },
    {
      key: "user",
      label: "Your data",
      sub: userCount ? "Uploaded CSV" : "Upload to populate",
      count: userCount,
    },
  ];
}

export default function App() {
  const [datasetKey, setDatasetKey] = useState<DatasetKey>("demo-small");
  const [userRows, setUserRows] = useState<UiCustomer[]>([]);
  const [userErrors, setUserErrors] = useState<string[]>([]);
  const [profile, setProfile] = useState<SimulatorProfile>(defaultProfile);

  const datasets = useMemo(
    () => makeDatasets(userRows.length),
    [userRows.length],
  );

  const customers: UiCustomer[] = useMemo(() => {
    if (datasetKey === "user") return userRows;
    if (datasetKey === "demo-full") return demoUi;
    if (datasetKey === "demo-sample") return sampleUi;
    return watchlistUi;
  }, [datasetKey, userRows]);

  const simulatorProbability = useMemo(() => {
    const base = applyProfile(emptyCustomer(), profile);
    return scoreCustomer(base).probability;
  }, [profile]);

  async function handleUpload(file: File) {
    try {
      const text = await file.text();
      const result = parseAndScoreCsv(text);
      const ui = result.rows.map(toUi);
      setUserRows(ui);
      setUserErrors(result.errors);
      setDatasetKey("user");
      if (ui[0]) {
        setProfile(toProfile(ui[0].raw));
      }
    } catch (error) {
      setUserErrors([
        error instanceof Error ? error.message : "Could not read this CSV.",
      ]);
    }
  }

  useEffect(() => {
    if (userErrors.length) {
      // eslint-disable-next-line no-console
      console.warn("[NetIntel] CSV warnings:", userErrors);
    }
  }, [userErrors]);

  return (
    <div className="app">
      <TopBar />
      <main className="page">
        <Hero />

        <div
          className="reveal reveal-sim"
          style={{ "--d": "1600ms" } as CSSProperties}
        >
          <SimulatorPanel
            profile={profile}
            setProfile={setProfile}
            probability={simulatorProbability}
          />
        </div>

        <div
          className="reveal reveal-data"
          style={{ "--d": "1750ms" } as CSSProperties}
        >
          <DatasetSection
            datasets={datasets}
            datasetKey={datasetKey}
            setDatasetKey={setDatasetKey}
            customers={customers}
            onUpload={handleUpload}
          />
        </div>

        <footer
          className="page-foot reveal"
          style={{ "--d": "1900ms" } as CSSProperties}
        >
          <span>
            NetIntel · Synthetic demo · Logistic Regression scored in-browser
          </span>
          <span>Last sync: today, 09:12</span>
        </footer>
      </main>
    </div>
  );
}
