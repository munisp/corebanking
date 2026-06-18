---
name: testing-ml-pipeline
description: Test the 54Bank ML inference server, continuous training pipeline, drift detection, champion-challenger, model promoter, and monitoring dashboard end-to-end. Use when verifying ML model changes, training pipeline modifications, or monitoring API updates.
---

# Testing the 54Bank ML Pipeline

## Prerequisites

- Python 3.12+ with packages: torch, pandas, numpy, sklearn, pyarrow, deltalake, scipy
- Weight files in `ml/weights/` (6 .pt files: fraud_detector, credit_scorer, anomaly_vae, churn_predictor, gnn_fraud_ring, aml_scorer)
- Training data parquet files in `ml/data/datasets/`
- Ports 8500 (inference) and 8501 (monitoring) must be free

## Devin Secrets Needed

None — all testing runs locally with CPU inference.

## Quick Check: Are Ports Free?

```bash
fuser -k 8500/tcp 2>/dev/null; fuser -k 8501/tcp 2>/dev/null
```

## Step 1: Start Inference Server

```bash
cd /home/ubuntu/repos/corebanking
python -m ml.inference.server 2>&1 &
sleep 5
curl -s http://localhost:8500/healthz
```

**Expected**: `{"status": "healthy", "models_loaded": 6, "device": "cpu"}`

If `models_loaded` < 6, check that all .pt weight files exist in `ml/weights/`.

**Tip**: The server starts fast (~0.06s to load all 6 models on CPU). If it takes longer than 10s, something is wrong.

## Step 2: Test Inference Endpoints

All 5 working endpoints (note: `/v1/gnn/predict` might not be routed — check `do_POST` in `ml/inference/server.py`):

```bash
# Fraud — suspicious transaction
curl -s -X POST http://localhost:8500/v1/fraud/predict \
  -H "Content-Type: application/json" \
  -d '{"amount":5000000,"hour":2,"day_of_week":6,"velocity_1h":5,"velocity_24h":15,"amount_vs_avg":50.0,"geo_distance_km":800,"device_age_days":1,"is_new_beneficiary":1,"is_international":1,"account_age_days":30,"balance_ratio":0.95}'

# Credit — good borrower
curl -s -X POST http://localhost:8500/v1/credit/predict \
  -H "Content-Type: application/json" \
  -d '{"age":42,"monthly_income":450000,"total_debt":50000,"dti_ratio":0.11,"employment_years":8,"num_prior_loans":3,"num_defaults":0,"loan_amount_requested":2000000,"loan_tenure_months":36,"collateral_value":3000000,"has_guarantor":1,"account_age_months":60,"avg_monthly_balance":600000,"num_dependents":2,"sector_idx":1,"state_idx":5}'

# AML — PEP with structuring
curl -s -X POST http://localhost:8500/v1/aml/predict \
  -H "Content-Type: application/json" \
  -d '{"transaction_count_30d":45,"unique_counterparties_30d":20,"cash_ratio":0.8,"international_ratio":0.5,"avg_transaction_amount":950000,"max_transaction_amount":4900000,"round_amount_ratio":0.7,"night_ratio":0.4,"structuring_score":0.9,"days_since_last_kyc_update":400,"pep_flag":1,"high_risk_country":1,"account_type_idx":0,"kyc_level_idx":0}'

# Anomaly — normal transaction
curl -s -X POST http://localhost:8500/v1/anomaly/score \
  -H "Content-Type: application/json" \
  -d '{"amount":15000,"hour":14,"day_of_week":2,"velocity_1h":1,"velocity_24h":3,"amount_vs_avg":1.0,"balance_ratio":0.05,"merchant_cat_idx":2,"channel_idx":1}'

# Churn — declining activity (12 months)
curl -s -X POST http://localhost:8500/v1/churn/predict \
  -H "Content-Type: application/json" \
  -d '{"monthly_activity":[[10,500000,5,3,1,0,200000,1],[8,400000,4,2,1,0,180000,1],[7,350000,3,2,1,0,160000,1],[5,250000,3,1,1,0,120000,1],[4,200000,2,1,0,0,100000,0],[3,150000,2,1,0,0,80000,0],[2,100000,1,0,0,0,50000,0],[1,50000,1,0,0,0,30000,0],[1,30000,0,0,0,0,20000,0],[0,10000,0,0,0,1,10000,0],[0,5000,0,0,0,1,5000,0],[0,0,0,0,0,1,0,0]]}'
```

**Key assertions**:
- Fraud: `fraud_probability` > 0.5 for suspicious input (typically ~0.935), `predictions` is an array
- Credit: `credit_score` is a float (e.g. 733.0), `credit_band` in [poor, fair, good, excellent]
- AML: `suspicious_probability` is a float (1.0 for high-risk PEP), `risk_tier` in [low, medium, high, critical]
- Anomaly: `anomaly_score` >= 0 (typically ~0.018 for normal), `is_anomaly` is boolean (false for normal)
- Churn: `attention_weights` is list of 12 floats summing to ~1.0, `critical_months` has 3 entries

## Step 3: Test Continuous Training Pipeline

```bash
cd /home/ubuntu/repos/corebanking

# Drift check (no drift expected on same data)
python -m ml.continuous_training.orchestrator --mode drift --model credit_scorer

# Forced retrain (takes ~45-60 seconds)
python -m ml.continuous_training.orchestrator --mode full --model credit_scorer --force
```

**Key assertions**:
- Drift check: `drift=no, retrain=no`
- Forced retrain: `retrained: true`, `val_auc_roc` > 0.5, wall-clock > 5 seconds
- Champion-challenger: `recommendation` is one of: promote, keep_champion, inconclusive
- Pipeline result saved to `ml/weights/ct_pipeline_*.json`

**Note**: Training requires parquet dataset files in `ml/data/datasets/`. If these don't exist (0 files found), training will fail but inference still works.

## Step 4: Test Model Promoter

```bash
cd /home/ubuntu/repos/corebanking
python3 -c "
import sys; sys.path.insert(0, '.')
from ml.continuous_training.model_promoter import ModelPromoter
p = ModelPromoter()
status = p.get_model_status()
for name, info in status.items():
    print(f'{name}: {info}')

# Verify approval gate for high-risk models
try:
    p.promote_to_production('fraud_detector', approved_by='auto')
    print('ERROR: Should have raised PermissionError')
except PermissionError as e:
    print(f'Approval gate works: {e}')
"
```

**Key assertions**:
- `get_model_status()` returns dict with all 6 model names
- Promoting `fraud_detector` with `approved_by='auto'` raises `PermissionError` (human approval required for high-risk models)

## Step 5: Test Monitoring Dashboard API

```bash
cd /home/ubuntu/repos/corebanking
python -m ml.monitoring.dashboard 2>&1 &
sleep 3
curl -s http://localhost:8501/api/metrics | python3 -m json.tool | head -20
curl -s http://localhost:8501/api/drift | python3 -m json.tool | head -20
```

**Key assertions**:
- `/api/metrics` returns JSON with model performance metrics
- `/api/drift` returns JSON with drift detection results

## Step 6: Cleanup

```bash
fuser -k 8500/tcp 2>/dev/null
fuser -k 8501/tcp 2>/dev/null
```

## Testing Tips

- This is all shell-only testing — do NOT start a recording
- The inference server loads all 6 models in ~0.06s on CPU — if it hangs, check for port conflicts
- Fraud detection model is highly sensitive — the test input with international + new beneficiary + high amount at 2AM reliably produces >0.9 probability
- AML model with PEP flag + structuring score 0.9 consistently returns 1.0 suspicious probability
- The churn model uses attention mechanism — verify that `attention_weights` sums to ~1.0 (within 0.95-1.05 tolerance)
- If disk space is low, model weights are ~1.8MB total — not a concern
