// Bridge between the real ML-scored customer (modelScorer.ts) and the
// design system's UI shape. The probability comes from the trained
// scikit-learn model; the trend and factor weights are derived
// deterministically so the table stays stable across renders.

import {
  normalizeCustomer,
  scoreCustomer,
  type CustomerInput,
  type ScoredCustomer,
} from "./modelScorer";

export type Tier = "low" | "elevated" | "high";

export type SimulatorProfile = {
  fiberSignal: number;
  latePayments: number;
  recentOutages: number;
  monthsWithIsp: number;
  ticketsRaised: number;
  autopay: boolean;
};

export type FactorRow = {
  key: string;
  label: string;
  weight: number;
  value: string;
};

export type UiCustomer = {
  // identity
  acct: string;
  username: string;
  fullName: string;
  plan: string;
  region: string;
  // numeric inputs
  fiberSignal: number;
  latePayments: number;
  recentOutages: number;
  monthsWithIsp: number;
  ticketsRaised: number;
  autopay: boolean;
  arpu: number;
  // model output
  risk: number;
  trend: number[];
  status: "Action needed" | "Watching" | "Checking" | "Healthy";
  // original record
  raw: ScoredCustomer;
};

const PLAN_LABELS: Record<string, string> = {
  Basic_50Mbps: "Coax 200",
  Standard_100Mbps: "Fiber 500",
  Premium_200Mbps: "Fiber 1G",
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function riskTier(r: number): { tier: Tier; label: string } {
  if (r >= 0.66) return { tier: "high", label: "High" };
  if (r >= 0.33) return { tier: "elevated", label: "Elevated" };
  return { tier: "low", label: "Low" };
}

// Convert a CustomerInput (real model row) into a SimulatorProfile (design fields).
export function toProfile(row: CustomerInput): SimulatorProfile {
  return {
    fiberSignal: row.avg_rx_power_dbm ?? -25,
    latePayments: row.late_payments_6m ?? 0,
    recentOutages: row.outages_30d ?? 0,
    monthsWithIsp: row.tenure_months ?? 24,
    ticketsRaised: row.support_tickets_30d ?? 0,
    autopay: Boolean(row.auto_pay),
  };
}

// Six contributor weights for the "Top contributors" bars. Same shape as the
// design demo, just driven by the real customer's fields.
export function contributorFactors(p: SimulatorProfile): FactorRow[] {
  const signalRisk = clamp((-10 - p.fiberSignal) / 30, 0, 1);
  const lateRisk = clamp(p.latePayments / 8, 0, 1);
  const outageRisk = clamp(p.recentOutages / 12, 0, 1);
  const tenureRisk = clamp(1 - p.monthsWithIsp / 36, 0, 1);
  const ticketRisk = clamp(p.ticketsRaised / 10, 0, 1);
  const autopayRisk = p.autopay ? 0 : 0.4;

  return [
    { key: "signal", label: "Fiber signal", weight: signalRisk, value: `${p.fiberSignal} dBm` },
    { key: "late", label: "Late payments", weight: lateRisk, value: `${p.latePayments}` },
    { key: "outage", label: "Recent outages", weight: outageRisk, value: `${p.recentOutages}` },
    { key: "tenure", label: "Tenure", weight: tenureRisk, value: `${p.monthsWithIsp} mo` },
    { key: "tickets", label: "Support tickets", weight: ticketRisk, value: `${p.ticketsRaised}` },
    { key: "autopay", label: "Autopay", weight: autopayRisk, value: p.autopay ? "On" : "Off" },
  ];
}

// Mulberry32 PRNG — seeded so trend lines stay stable across renders.
function mulberry32(a: number) {
  return function rand() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// 30-day risk trend — seeded by customer id so each customer's spark is stable.
// New customers (low tenure) climb fast; long-tenure customers stay flatter.
export function makeTrend(
  probability: number,
  seed: number,
  tenureMonths: number,
): number[] {
  const rand = mulberry32(seed);
  const trend: number[] = [];
  const climb = tenureMonths < 12 ? 0.28 : tenureMonths < 36 ? 0.16 : 0.08;
  let cur = clamp(probability - climb + rand() * 0.03, 0, 0.98);
  for (let j = 0; j < 30; j++) {
    const noise = (rand() - 0.5) * 0.02;
    const drift = (probability - cur) * 0.09;
    cur = clamp(cur + noise + drift, 0, 0.98);
    trend.push(cur);
  }
  return trend;
}

function statusFor(probability: number, seed: number): UiCustomer["status"] {
  if (probability > 0.66) return "Action needed";
  if (probability > 0.4) return "Watching";
  const rand = mulberry32(seed + 9);
  if (rand() > 0.78) return "Checking";
  return "Healthy";
}

// Map locality string to a 3-letter circle code so account numbers look like
// a real regional ISP (e.g. RN-KCH-001234 for a Kanchipuram subscriber).
const LOCALITY_CODE: Record<string, string> = {
  Orikkai: "KCH",
  Pillaiyarpalayam: "KCH",
  "Little Kanchipuram": "KCH",
  "Big Kanchipuram": "KCH",
  Sevilimedu: "KCH",
  Nathapettai: "KCH",
  Walajabad: "KCH",
  Ayyampettai: "KCH",
  Enathur: "KCH",
};

function regionCode(locality: string | undefined): string {
  if (!locality) return "TN";
  if (LOCALITY_CODE[locality]) return LOCALITY_CODE[locality];
  return locality.slice(0, 3).toUpperCase();
}

function realisticAcct(
  customerId: string | undefined,
  locality: string | undefined,
): string {
  if (!customerId) return "RN-TN-000000";
  const digits = customerId.replace(/\D/g, "").slice(-6).padStart(6, "0");
  return `RN-${regionCode(locality)}-${digits}`;
}

function cleanPlan(plan: string): string {
  if (PLAN_LABELS[plan]) return PLAN_LABELS[plan];
  return plan.replace(/_/g, " ");
}

function deriveUsername(scored: ScoredCustomer): string {
  if (scored.username) return scored.username;
  const first = (scored.first_name ?? "").toLowerCase();
  const last = (scored.last_name ?? "").toLowerCase();
  const digits = (scored.customer_id ?? "").replace(/\D/g, "").slice(-4);
  if (first && last) return `${first}.${last.slice(0, 3)}${digits}`;
  if (first) return `${first}${digits}`;
  return scored.customer_id ?? "user";
}

function deriveFullName(scored: ScoredCustomer): string {
  const name = `${scored.first_name ?? ""} ${scored.last_name ?? ""}`.trim();
  return name || scored.username || "—";
}

export function toUi(scored: ScoredCustomer): UiCustomer {
  const seed = hashString(scored.customer_id ?? "") || 1;
  const trend = makeTrend(scored.probability, seed, scored.tenure_months);
  return {
    acct: realisticAcct(scored.customer_id, scored.locality),
    username: deriveUsername(scored),
    fullName: deriveFullName(scored),
    plan: cleanPlan(scored.plan_type),
    region: scored.locality || scored.region || "—",
    fiberSignal: scored.avg_rx_power_dbm,
    latePayments: scored.late_payments_6m,
    recentOutages: scored.outages_30d,
    monthsWithIsp: scored.tenure_months,
    ticketsRaised: scored.support_tickets_30d,
    autopay: Boolean(scored.auto_pay),
    arpu: scored.monthly_revenue_inr,
    risk: scored.probability,
    trend,
    status: statusFor(scored.probability, seed),
    raw: scored,
  };
}

export function recommendation(c: UiCustomer): { title: string; detail: string } {
  const tier = riskTier(c.risk).tier;
  const factors = contributorFactors(toProfile(c.raw))
    .filter((f) => f.weight > 0.15)
    .sort((a, b) => b.weight - a.weight);

  // Combination cases — these matter more than any single signal.
  if (c.fiberSignal < -28 && c.recentOutages >= 3) {
    return {
      title: "Field check + area outage review",
      detail: `Signal at ${c.fiberSignal} dBm AND ${c.recentOutages} outages in 30 days — likely a localised infrastructure issue in ${c.region}, not just one ONU.`,
    };
  }
  if (c.latePayments >= 2 && c.ticketsRaised >= 3) {
    return {
      title: "Senior agent intervention",
      detail: `${c.latePayments} late payments and ${c.ticketsRaised} tickets — customer is frustrated and at financial risk. Combine collections + care touchpoint.`,
    };
  }
  if (c.monthsWithIsp < 6 && c.ticketsRaised >= 2) {
    return {
      title: "Onboarding rescue call",
      detail: `${c.monthsWithIsp}-month tenure with ${c.ticketsRaised} tickets already — onboarding hasn't landed. Schedule a personal walkthrough this week.`,
    };
  }

  // Single dominant factor — pick the strongest one and write a specific action.
  const top = factors[0];

  if (top?.key === "signal") {
    if (c.fiberSignal < -30) {
      return {
        title: "Dispatch field tech (urgent)",
        detail: `Signal at ${c.fiberSignal} dBm is well below the -27 dBm field-check threshold. Schedule a line audit this week before service degrades further.`,
      };
    }
    return {
      title: "Schedule line audit",
      detail: `Signal at ${c.fiberSignal} dBm is drifting toward the -27 dBm threshold. Send a tech for a preventive check before the customer notices.`,
    };
  }

  if (top?.key === "late") {
    return {
      title: "Offer payment plan",
      detail: `${c.latePayments} late payment${c.latePayments === 1 ? "" : "s"} in 6 months. Send a structured payment offer before the next bill cycle to reduce involuntary churn.`,
    };
  }

  if (top?.key === "outage") {
    return {
      title: "Open network ops ticket",
      detail: `${c.recentOutages} outages in 30 days in ${c.region}. Reliability is below target — open a network ops ticket and add the customer to the affected-area list.`,
    };
  }

  if (top?.key === "tenure") {
    return {
      title: "New-customer outreach",
      detail: `${c.monthsWithIsp}-month tenure — still in the high early-churn window. Schedule an onboarding follow-up call and confirm the install is performing as expected.`,
    };
  }

  if (top?.key === "tickets") {
    return {
      title: "Senior agent call-back",
      detail: `${c.ticketsRaised} support ticket${c.ticketsRaised === 1 ? "" : "s"} in 90 days. Assign a senior agent to consolidate complaints into one resolution path.`,
    };
  }

  if (top?.key === "autopay") {
    return {
      title: "Enroll in autopay",
      detail: `Autopay is off and account risk is elevated. Autopay enrollment cuts involuntary churn by ~15% on average — offer a small one-time credit as incentive.`,
    };
  }

  // High risk but no single dominant driver — combination is the problem.
  if (tier === "high") {
    return {
      title: "Priority retention call",
      detail: `Several signals are mildly elevated — no single fix. Schedule a personal account review within 48 hours to understand the picture before they leave.`,
    };
  }

  if (tier === "elevated") {
    return {
      title: "Add to weekly watchlist",
      detail: `Risk is trending up but no signal is critical yet. Keep on the weekly review queue and re-score after the next bill cycle.`,
    };
  }

  // Truly healthy account.
  return {
    title: "Continue monitoring",
    detail: `Healthy account. ${c.fiberSignal} dBm signal, ${c.monthsWithIsp}-month tenure${c.autopay ? ", autopay enrolled" : ""}. No intervention needed.`,
  };
}

export function applyProfile(
  base: CustomerInput,
  profile: SimulatorProfile,
): CustomerInput {
  return {
    ...base,
    avg_rx_power_dbm: profile.fiberSignal,
    late_payments_6m: profile.latePayments,
    outages_30d: profile.recentOutages,
    tenure_months: profile.monthsWithIsp,
    support_tickets_30d: profile.ticketsRaised,
    auto_pay: profile.autopay ? 1 : 0,
  };
}

export const defaultProfile: SimulatorProfile = {
  fiberSignal: -25,
  latePayments: 0,
  recentOutages: 0,
  monthsWithIsp: 36,
  ticketsRaised: 2,
  autopay: true,
};

export function emptyCustomer(): CustomerInput {
  return normalizeCustomer({});
}

// Stratified sample so the demo dataset mirrors a real customer base — a few
// high-risk, more elevated, mostly healthy. Deterministic via seed.
export function stratifiedSample(
  customers: UiCustomer[],
  size: number,
  seed = 42,
): UiCustomer[] {
  const high = customers.filter((c) => c.risk > 0.66);
  const elev = customers.filter((c) => c.risk > 0.33 && c.risk <= 0.66);
  const low = customers.filter((c) => c.risk <= 0.33);

  const rand = mulberry32(seed);
  const pick = (pool: UiCustomer[], n: number): UiCustomer[] => {
    const arr = [...pool];
    const out: UiCustomer[] = [];
    for (let i = 0; i < n && arr.length > 0; i++) {
      const idx = Math.floor(rand() * arr.length);
      out.push(arr.splice(idx, 1)[0]);
    }
    return out;
  };

  const nHigh = Math.round(size * 0.15);
  const nElev = Math.round(size * 0.3);
  const nLow = size - nHigh - nElev;

  return [...pick(high, nHigh), ...pick(elev, nElev), ...pick(low, nLow)].sort(
    (a, b) => b.risk - a.risk,
  );
}

export { scoreCustomer };
export type { CustomerInput, ScoredCustomer };
