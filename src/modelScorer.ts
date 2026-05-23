import artifact from "../model/model_artifact.json";

export type CustomerInput = {
  customer_id?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  locality?: string;
  plan_type: string;
  area_type: string;
  region: string;
  monthly_revenue_inr: number;
  tenure_months: number;
  data_usage_gb: number;
  support_tickets_30d: number;
  late_payments_6m: number;
  payment_delay_days: number;
  days_since_last_contact: number;
  outages_30d: number;
  avg_rx_power_dbm: number;
  plan_change_count: number;
  has_fiber: number;
  auto_pay: number;
  referrals_brought: number;
};

export type RiskBand = "Low" | "Medium" | "High";

export type ScoredCustomer = CustomerInput & {
  probability: number;
  band: RiskBand;
  reasons: string[];
  action: string;
};

type ModelArtifact = {
  numeric_features: string[];
  categorical_features: string[];
  binary_features: string[];
  categories: Record<string, string[]>;
  numeric_stats: Record<string, { mean: number; scale: number }>;
  intercept: number;
  coefficients: Record<string, number>;
  metrics: {
    model: string;
    dataset_rows: number;
    churn_rate: number;
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    roc_auc: number;
  };
  top_features: { feature: string; coefficient: number; direction: string }[];
};

const modelArtifact = artifact as ModelArtifact;

export const requiredColumns = [
  "customer_id",
  ...modelArtifact.categorical_features,
  ...modelArtifact.numeric_features,
  ...modelArtifact.binary_features,
];

const labels: Record<string, string> = {
  monthly_revenue_inr: "monthly revenue",
  tenure_months: "short/long tenure",
  data_usage_gb: "data usage",
  support_tickets_30d: "recent support tickets",
  late_payments_6m: "late payments",
  payment_delay_days: "payment delay",
  days_since_last_contact: "days since last contact",
  outages_30d: "recent outages",
  avg_rx_power_dbm: "optical signal quality",
  plan_change_count: "plan changes",
  referrals_brought: "referrals",
  has_fiber: "fiber connection",
  auto_pay: "auto-pay status",
  plan_type: "plan type",
  area_type: "area type",
  region: "region",
};

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function transformedFeatures(row: CustomerInput): Record<string, number> {
  const output: Record<string, number> = {};

  for (const feature of modelArtifact.numeric_features) {
    const stats = modelArtifact.numeric_stats[feature];
    const raw = toNumber(row[feature as keyof CustomerInput]);
    output[feature] = (raw - stats.mean) / (stats.scale || 1);
  }

  for (const feature of modelArtifact.categorical_features) {
    const value = String(row[feature as keyof CustomerInput] ?? "");
    for (const category of modelArtifact.categories[feature] ?? []) {
      output[`${feature}_${category}`] = value === category ? 1 : 0;
    }
  }

  for (const feature of modelArtifact.binary_features) {
    output[feature] = toNumber(row[feature as keyof CustomerInput]);
  }

  return output;
}

function riskBand(probability: number): RiskBand {
  if (probability >= 0.7) return "High";
  if (probability >= 0.4) return "Medium";
  return "Low";
}

export function scoreCustomer(row: CustomerInput): ScoredCustomer {
  const features = transformedFeatures(row);
  let logit = modelArtifact.intercept;
  const impacts: { label: string; impact: number; signedImpact: number }[] = [];

  for (const [feature, value] of Object.entries(features)) {
    const coefficient = modelArtifact.coefficients[feature] ?? 0;
    const signedImpact = coefficient * value;
    logit += signedImpact;

    const baseName = feature.split("_").slice(0, -1).join("_") || feature;
    impacts.push({
      label: labels[baseName] ?? labels[feature] ?? feature.replace(/_/g, " "),
      impact: Math.abs(signedImpact),
      signedImpact,
    });
  }

  const probability = sigmoid(logit);
  const band = riskBand(probability);
  const reasons = impacts
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3)
    .map((item) => {
      const direction = item.signedImpact >= 0 ? "raises risk" : "lowers risk";
      return `${item.label} ${direction}`;
    });

  return {
    ...row,
    probability,
    band,
    reasons,
    action: recommendedAction(row, band),
  };
}

export function recommendedAction(row: CustomerInput, band: RiskBand): string {
  if (row.avg_rx_power_dbm <= -27 || row.outages_30d >= 3) {
    return "Schedule a line-quality check before offering a discount.";
  }
  if (band === "High") {
    return "Call within 48 hours and review open complaints first.";
  }
  if (band === "Medium") {
    return "Send a retention offer after checking recent payment and ticket history.";
  }
  if (row.referrals_brought > 0) {
    return "Healthy customer. Ask for a referral or review.";
  }
  return "No urgent action. Keep normal service follow-up.";
}

export function normalizeCustomer(raw: Record<string, string>): CustomerInput {
  return {
    customer_id: raw.customer_id || "Uploaded customer",
    username: raw.username || "",
    first_name: raw.first_name || "",
    last_name: raw.last_name || "",
    phone: raw.phone || "",
    locality: raw.locality || "",
    plan_type: raw.plan_type || "Standard_100Mbps",
    area_type: raw.area_type || "Residential",
    region: raw.region || "South",
    monthly_revenue_inr: toNumber(raw.monthly_revenue_inr, 799),
    tenure_months: toNumber(raw.tenure_months, 12),
    data_usage_gb: toNumber(raw.data_usage_gb, 180),
    support_tickets_30d: toNumber(raw.support_tickets_30d, 0),
    late_payments_6m: toNumber(raw.late_payments_6m, 0),
    payment_delay_days: toNumber(raw.payment_delay_days, 0),
    days_since_last_contact: toNumber(raw.days_since_last_contact, 30),
    outages_30d: toNumber(raw.outages_30d, 0),
    avg_rx_power_dbm: toNumber(raw.avg_rx_power_dbm, -20),
    plan_change_count: toNumber(raw.plan_change_count, 0),
    has_fiber: toNumber(raw.has_fiber, 1),
    auto_pay: toNumber(raw.auto_pay, 0),
    referrals_brought: toNumber(raw.referrals_brought, 0),
  };
}
