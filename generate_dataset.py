"""Generate a realistic synthetic ISP churn dataset.

This dataset is demo-only. It does not contain real Rico Net customer data.
The fields are shaped around common ISP operations: complaints, payments,
signal quality, outages, tenure, and plan behavior.

Run:
    python generate_dataset.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd


SEED = 17
ROW_COUNT = 2500
OUTPUT_PATH = Path("data/customers.csv")


def sigmoid(values: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-values))


def generate_dataset(row_count: int = ROW_COUNT, seed: int = SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    plans = np.array(["Basic_50Mbps", "Standard_100Mbps", "Premium_200Mbps", "Business_500Mbps"])
    plan_type = rng.choice(plans, size=row_count, p=[0.42, 0.34, 0.19, 0.05])

    price_map = {
        "Basic_50Mbps": 499,
        "Standard_100Mbps": 799,
        "Premium_200Mbps": 1299,
        "Business_500Mbps": 2499,
    }
    monthly_revenue_inr = np.array([price_map[plan] for plan in plan_type])

    area_type = rng.choice(
        ["Residential", "Apartment", "PG", "Small_Business"],
        size=row_count,
        p=[0.52, 0.25, 0.13, 0.10],
    )
    region = rng.choice(["North", "South", "East", "West", "Central"], size=row_count)
    tenure_months = np.clip(rng.gamma(shape=2.1, scale=8.0, size=row_count), 1, 72).round().astype(int)

    usage_base = {
        "Basic_50Mbps": 90,
        "Standard_100Mbps": 190,
        "Premium_200Mbps": 345,
        "Business_500Mbps": 540,
    }
    area_usage_lift = {"Residential": 0, "Apartment": 40, "PG": 95, "Small_Business": 130}
    data_usage_gb = np.array([
        usage_base[plan_type[i]] + area_usage_lift[area_type[i]] + rng.normal(0, 45)
        for i in range(row_count)
    ])
    data_usage_gb = np.clip(data_usage_gb, 10, 1800).round(1)

    has_fiber = (rng.random(row_count) > 0.22).astype(int)
    auto_pay = (rng.random(row_count) > 0.58).astype(int)
    support_tickets_30d = rng.poisson(lam=0.65 + (area_type == "PG") * 0.25, size=row_count)
    late_payments_6m = rng.poisson(lam=0.35 + (1 - auto_pay) * 0.42, size=row_count)
    payment_delay_days = np.clip(rng.normal(2 + late_payments_6m * 3.4, 4, size=row_count), 0, 45).round().astype(int)
    days_since_last_contact = rng.integers(1, 210, size=row_count)
    referrals_brought = rng.poisson(lam=0.42, size=row_count)
    outages_30d = rng.poisson(lam=0.25 + support_tickets_30d * 0.14 + (1 - has_fiber) * 0.28, size=row_count)
    avg_rx_power_dbm = rng.normal(-20.4 - outages_30d * 0.75 - (1 - has_fiber) * 1.7, 2.35, size=row_count)
    avg_rx_power_dbm = np.round(avg_rx_power_dbm, 2)
    plan_change_count = rng.poisson(lam=0.22 + (tenure_months > 18) * 0.12, size=row_count)

    score = (
        1.05 * support_tickets_30d
        + 0.85 * late_payments_6m
        + 0.10 * payment_delay_days
        + 0.72 * outages_30d
        + 0.18 * np.maximum(0, -24 - avg_rx_power_dbm)
        + 0.018 * days_since_last_contact
        - 0.50 * np.log1p(tenure_months)
        - 1.25 * auto_pay
        - 0.92 * has_fiber
        - 0.85 * referrals_brought
        - 0.48 * (plan_type == "Business_500Mbps")
        + rng.normal(0, 0.55, size=row_count)
    )
    churn_probability = sigmoid(score - 3.05)
    churned = (rng.random(row_count) < churn_probability).astype(int)

    return pd.DataFrame({
        "customer_id": [f"DEMO-CUST-{i:05d}" for i in range(1, row_count + 1)],
        "plan_type": plan_type,
        "area_type": area_type,
        "region": region,
        "monthly_revenue_inr": monthly_revenue_inr,
        "tenure_months": tenure_months,
        "data_usage_gb": data_usage_gb,
        "support_tickets_30d": support_tickets_30d,
        "late_payments_6m": late_payments_6m,
        "payment_delay_days": payment_delay_days,
        "days_since_last_contact": days_since_last_contact,
        "outages_30d": outages_30d,
        "avg_rx_power_dbm": avg_rx_power_dbm,
        "plan_change_count": plan_change_count,
        "has_fiber": has_fiber,
        "auto_pay": auto_pay,
        "referrals_brought": referrals_brought,
        "churned": churned,
    })


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df = generate_dataset()
    df.to_csv(OUTPUT_PATH, index=False)

    print(f"Generated {OUTPUT_PATH} with {len(df):,} rows.")
    print(f"Churn rate: {df['churned'].mean():.1%}")
    print(df.head(5).to_string(index=False))


if __name__ == "__main__":
    main()
