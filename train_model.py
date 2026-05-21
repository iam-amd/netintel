"""Train NetIntel's explainable churn model and export a JSON scorer.

The deployed Vercel app does not run Python. This script trains Logistic
Regression, saves evaluation metrics, and exports every value the React app
needs to score customers in the browser.

Run:
    python generate_dataset.py
    python train_model.py
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


DATA_PATH = Path("data/customers.csv")
MODEL_DIR = Path("model")
ARTIFACT_PATH = MODEL_DIR / "model_artifact.json"
METRICS_PATH = MODEL_DIR / "model_metrics.json"

NUMERIC_FEATURES = [
    "monthly_revenue_inr",
    "tenure_months",
    "data_usage_gb",
    "support_tickets_30d",
    "late_payments_6m",
    "payment_delay_days",
    "days_since_last_contact",
    "outages_30d",
    "avg_rx_power_dbm",
    "plan_change_count",
    "referrals_brought",
]
CATEGORICAL_FEATURES = ["plan_type", "area_type", "region"]
BINARY_FEATURES = ["has_fiber", "auto_pay"]
FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES + BINARY_FEATURES
TARGET = "churned"


def build_pipeline() -> Pipeline:
    preprocessor = ColumnTransformer([
        ("num", StandardScaler(), NUMERIC_FEATURES),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES),
        ("bin", "passthrough", BINARY_FEATURES),
    ])
    return Pipeline([
        ("prep", preprocessor),
        ("clf", LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42)),
    ])


def evaluate(model: Pipeline, x_test: pd.DataFrame, y_test: pd.Series) -> dict[str, Any]:
    predictions = model.predict(x_test)
    probabilities = model.predict_proba(x_test)[:, 1]
    tn, fp, fn, tp = confusion_matrix(y_test, predictions).ravel()
    return {
        "accuracy": round(float(accuracy_score(y_test, predictions)), 4),
        "precision": round(float(precision_score(y_test, predictions, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, predictions, zero_division=0)), 4),
        "f1": round(float(f1_score(y_test, predictions, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_test, probabilities)), 4),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }


def clean_name(name: str) -> str:
    return name.replace("cat__", "").replace("num__", "").replace("bin__", "")


def build_artifact(model: Pipeline, metrics: dict[str, Any], df: pd.DataFrame) -> dict[str, Any]:
    prep = model.named_steps["prep"]
    clf = model.named_steps["clf"]
    scaler: StandardScaler = prep.named_transformers_["num"]
    encoder: OneHotEncoder = prep.named_transformers_["cat"]

    transformed_names = [
        clean_name(name)
        for name in prep.get_feature_names_out()
    ]
    coefficients = clf.coef_[0].astype(float)
    top_indices = np.argsort(np.abs(coefficients))[::-1][:12]

    numeric_stats = {
        feature: {
            "mean": float(scaler.mean_[index]),
            "scale": float(scaler.scale_[index] if scaler.scale_[index] else 1.0),
        }
        for index, feature in enumerate(NUMERIC_FEATURES)
    }
    categories = {
        feature: [str(value) for value in encoder.categories_[index]]
        for index, feature in enumerate(CATEGORICAL_FEATURES)
    }

    return {
        "project": "NetIntel",
        "version": "1.0.0",
        "model_type": "Logistic Regression",
        "target": TARGET,
        "features": FEATURES,
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "binary_features": BINARY_FEATURES,
        "transformed_features": transformed_names,
        "numeric_stats": numeric_stats,
        "categories": categories,
        "intercept": float(clf.intercept_[0]),
        "coefficients": {
            transformed_names[index]: float(coefficients[index])
            for index in range(len(transformed_names))
        },
        "top_features": [
            {
                "feature": transformed_names[index],
                "coefficient": round(float(coefficients[index]), 5),
                "direction": "raises risk" if coefficients[index] > 0 else "lowers risk",
            }
            for index in top_indices
        ],
        "metrics": {
            "dataset_rows": int(len(df)),
            "churn_rate": round(float(df[TARGET].mean()), 4),
            "test_size": metrics["test_size"],
            "model": metrics["model"],
            "accuracy": metrics["accuracy"],
            "precision": metrics["precision"],
            "recall": metrics["recall"],
            "f1": metrics["f1"],
            "roc_auc": metrics["roc_auc"],
            "confusion_matrix": metrics["confusion_matrix"],
        },
    }


def main() -> None:
    if not DATA_PATH.exists():
        raise FileNotFoundError("data/customers.csv not found. Run `python generate_dataset.py` first.")

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(DATA_PATH)
    x = df[FEATURES]
    y = df[TARGET]

    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    model = build_pipeline()
    model.fit(x_train, y_train)

    metrics = evaluate(model, x_test, y_test)
    metrics = {"model": "Logistic Regression", "test_size": int(len(y_test)), **metrics}
    artifact = build_artifact(model, metrics, df)

    ARTIFACT_PATH.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    METRICS_PATH.write_text(json.dumps(artifact["metrics"], indent=2), encoding="utf-8")

    print("Trained Logistic Regression churn model")
    print(f"Precision: {metrics['precision']:.3f}")
    print(f"Recall:    {metrics['recall']:.3f}")
    print(f"F1:        {metrics['f1']:.3f}")
    print(f"ROC-AUC:   {metrics['roc_auc']:.3f}")
    print(f"Saved {ARTIFACT_PATH}")
    print(f"Saved {METRICS_PATH}")


if __name__ == "__main__":
    main()
