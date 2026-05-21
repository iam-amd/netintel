# NetIntel

NetIntel is a clean portfolio demo for ISP customer churn-risk scoring.

It uses Python to generate realistic synthetic telecom data and train an
explainable churn model. The trained model is exported as JSON, then a React
app scores customers directly in the browser. That keeps the live demo simple:
no Python server is needed on Vercel.

> This project does not contain real Rico Net customer data. All records are
> synthetic and made for demo use.

## Why I Built It

While building Rico Net, I noticed that ISP software should not only store
customers, tickets, and network data. It should also help operators decide which
customers need attention before they leave.

NetIntel is a small first version of that idea: a retention-support dashboard
that turns ISP signals into a practical churn-risk score.

## Live Demo

Add the Vercel URL after deployment:

```text
https://netintel.vercel.app
```

## What It Does

- Scores one customer manually using an explainable churn model
- Lets users upload a CSV and score their own customer dataset
- Shows high-risk customers, average risk, and risk by plan/area
- Gives simple operator actions like retention call, payment follow-up, or line-quality check
- Runs fully in the browser using a model artifact exported from Python

## Tech Stack

- Python, Pandas, NumPy, scikit-learn
- React, TypeScript, Vite
- Vercel-ready static deployment

## Project Structure

```text
netintel/
|-- data/
|   `-- customers.csv
|-- model/
|   |-- model_artifact.json
|   `-- model_metrics.json
|-- src/
|   |-- App.tsx
|   |-- csv.ts
|   |-- modelScorer.ts
|   `-- styles.css
|-- generate_dataset.py
|-- train_model.py
|-- MODEL_CARD.md
|-- package.json
|-- requirements.txt
|-- vite.config.ts
`-- README.md
```

## Run Locally

Install frontend dependencies:

```bash
npm install
```

Create the demo dataset and model artifact:

```bash
pip install -r requirements.txt
python generate_dataset.py
python train_model.py
```

Start the app:

```bash
npm run dev
```

## Train the Model

The model is intentionally simple: Logistic Regression with standardized numeric
features and one-hot encoded categories.

Why Logistic Regression?

- Easy to explain in interviews
- Easy to export to JSON
- Works well for a clean tabular demo
- Lets the React app score customers without a backend

The training script exports:

```text
model/model_artifact.json
model/model_metrics.json
```

## Dataset Format

The CSV upload expects these columns:

```text
customer_id
plan_type
area_type
region
monthly_revenue_inr
tenure_months
data_usage_gb
support_tickets_30d
late_payments_6m
payment_delay_days
days_since_last_contact
outages_30d
avg_rx_power_dbm
plan_change_count
has_fiber
auto_pay
referrals_brought
```

Use `data/customers.csv` as a sample file.

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the repo in Vercel.
3. Use these settings:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

The model files are already static JSON files, so Vercel does not need Python.

## Limitations

- The data is synthetic.
- This is a decision-support demo, not a production AI system.
- The model is not validated on real customer outcomes.
- Before real use, it would need anonymized production data, privacy review,
  retraining, drift checks, and operator feedback.

## What I Learned

- A small explainable model can be more useful than a complicated black box.
- Product clarity matters as much as model accuracy.
- Deployment constraints change architecture decisions.
- A portfolio project becomes stronger when it is honest about its limits.

## Author

Bagrudeen Ali Ahamed

Built as a public-safe ML demo inspired by my Rico Net ISP management project.
