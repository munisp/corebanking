#!/usr/bin/env python3
"""54Bank — Synthetic Data Generator for ML Training
Generates realistic Nigerian banking datasets for all ML models:
1. Transaction fraud detection
2. Credit scoring
3. AML risk scoring
4. Customer churn prediction
5. GNN fraud ring detection (graph data)
6. Anomaly detection (unlabeled normal transactions)
Outputs: Parquet files + Delta Lake tables
"""
import os
import sys
import json
import random
import math
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

SEED = 54
random.seed(SEED)
np.random.seed(SEED)

DATA_DIR = Path(__file__).parent / "datasets"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ── Nigerian Context ─────────────────────────────────────────────────────────
NIGERIAN_STATES = [
    "Lagos", "Abuja", "Kano", "Rivers", "Oyo", "Kaduna", "Enugu",
    "Delta", "Ogun", "Anambra", "Edo", "Kwara", "Imo", "Borno",
    "Cross River", "Abia", "Osun", "Niger", "Katsina", "Plateau"
]

NIGERIAN_CITIES = {
    "Lagos": ["Ikeja", "Victoria Island", "Lekki", "Surulere", "Yaba", "Ajah"],
    "Abuja": ["Garki", "Wuse", "Maitama", "Asokoro", "Gwarinpa"],
    "Kano": ["Nassarawa", "Fagge", "Tarauni", "Dala"],
    "Rivers": ["Port Harcourt", "Obio-Akpor", "Eleme"],
    "Oyo": ["Ibadan North", "Ibadan South", "Ogbomoso"],
}

MERCHANT_CATEGORIES = [
    "grocery", "fuel", "restaurant", "electronics", "clothing",
    "pharmacy", "telecom", "utilities", "transport", "education",
    "healthcare", "entertainment", "real_estate", "agriculture",
    "government", "insurance", "pos_terminal", "atm_withdrawal",
    "online_shopping", "p2p_transfer"
]

TRANSACTION_CHANNELS = ["mobile", "web", "ussd", "pos", "atm", "branch", "api"]
CARD_TYPES = ["verve", "mastercard", "visa"]
ACCOUNT_TYPES = ["savings", "current", "domiciliary", "fixed_deposit", "corporate"]
LOAN_TYPES = ["personal", "mortgage", "sme", "agriculture", "trade_finance", "overdraft"]
SECTORS = ["oil_gas", "manufacturing", "agriculture", "telecom", "fintech",
           "real_estate", "healthcare", "education", "retail", "transport"]

FIRST_NAMES_M = ["Adebayo", "Chukwuemeka", "Olumide", "Ibrahim", "Usman",
                 "Obinna", "Tunde", "Yusuf", "Emeka", "Abubakar",
                 "Femi", "Chinedu", "Danjuma", "Segun", "Ifeanyi"]
FIRST_NAMES_F = ["Ngozi", "Amina", "Folake", "Chidinma", "Halima",
                 "Funke", "Aisha", "Blessing", "Kemi", "Fatima",
                 "Nneka", "Zainab", "Yetunde", "Ifeoma", "Hadiza"]
LAST_NAMES = ["Okafor", "Abdullahi", "Adeyemi", "Nwosu", "Balogun",
              "Eze", "Musa", "Ogundimu", "Aliyu", "Nnamdi",
              "Oluwole", "Mohammed", "Afolabi", "Uche", "Suleiman"]

BANKS = ["Access Bank", "Zenith Bank", "GTBank", "First Bank", "UBA",
         "Stanbic IBTC", "Fidelity Bank", "Sterling Bank", "Union Bank"]


def generate_bvn():
    return f"22{''.join([str(random.randint(0,9)) for _ in range(9)])}"

def generate_nin():
    return f"{''.join([str(random.randint(0,9)) for _ in range(11)])}"

def generate_phone():
    prefix = random.choice(["0803", "0805", "0806", "0813", "0814",
                            "0703", "0706", "0903", "0906", "0916"])
    return prefix + "".join([str(random.randint(0,9)) for _ in range(7)])

def generate_account_number():
    return "".join([str(random.randint(0,9)) for _ in range(10)])


# ═══════════════════════════════════════════════════════════════════════════════
# 1. TRANSACTION FRAUD DETECTION DATASET
# ═══════════════════════════════════════════════════════════════════════════════
def generate_fraud_dataset(n_samples=100000, fraud_ratio=0.03):
    """Generate labeled transaction dataset for fraud detection.
    Features: amount, hour, day_of_week, merchant_category, channel,
              velocity_1h, velocity_24h, amount_vs_avg, geo_distance,
              device_age_days, is_new_beneficiary, is_international,
              account_age_days, balance_ratio
    Label: is_fraud (0/1)
    """
    print(f"Generating {n_samples} transactions for fraud detection...")

    n_fraud = int(n_samples * fraud_ratio)
    n_normal = n_samples - n_fraud

    records = []
    base_date = datetime(2025, 1, 1, tzinfo=timezone.utc)

    # Generate normal transactions
    for i in range(n_normal):
        hour = int(np.random.normal(14, 4)) % 24
        amount = max(100, np.random.lognormal(mean=9.0, sigma=1.5))
        if amount > 10_000_000:
            amount = random.uniform(100, 500_000)
        day_of_week = random.randint(0, 6)
        merchant_cat = random.choice(MERCHANT_CATEGORIES)
        channel = random.choice(TRANSACTION_CHANNELS)
        velocity_1h = max(0, int(np.random.exponential(1.5)))
        velocity_24h = velocity_1h + max(0, int(np.random.exponential(3)))
        avg_txn = amount * random.uniform(0.7, 1.3)
        amount_vs_avg = amount / max(avg_txn, 1)
        geo_distance_km = max(0, np.random.exponential(15))
        device_age_days = random.randint(30, 1800)
        is_new_beneficiary = 1 if random.random() < 0.15 else 0
        is_international = 1 if random.random() < 0.02 else 0
        account_age_days = random.randint(90, 3650)
        balance = max(1000, np.random.lognormal(mean=12, sigma=1.5))
        balance_ratio = amount / max(balance, 1)
        state = random.choice(NIGERIAN_STATES)
        ts = base_date + timedelta(days=random.randint(0, 364),
                                    hours=hour, minutes=random.randint(0, 59))

        records.append({
            "transaction_id": str(uuid.uuid4()),
            "timestamp": ts.isoformat(),
            "amount": round(amount, 2),
            "hour": hour,
            "day_of_week": day_of_week,
            "merchant_category": merchant_cat,
            "channel": channel,
            "velocity_1h": velocity_1h,
            "velocity_24h": velocity_24h,
            "amount_vs_avg": round(amount_vs_avg, 4),
            "geo_distance_km": round(geo_distance_km, 2),
            "device_age_days": device_age_days,
            "is_new_beneficiary": is_new_beneficiary,
            "is_international": is_international,
            "account_age_days": account_age_days,
            "balance_ratio": round(min(balance_ratio, 5.0), 4),
            "state": state,
            "card_type": random.choice(CARD_TYPES),
            "is_fraud": 0,
        })

    # Generate fraudulent transactions with distinct patterns
    for i in range(n_fraud):
        fraud_type = random.choice(["velocity", "amount", "geo", "new_device",
                                     "night", "international", "structuring"])
        hour = random.choice([0, 1, 2, 3, 4, 22, 23]) if fraud_type == "night" else int(np.random.normal(14, 6)) % 24
        if fraud_type == "amount":
            amount = random.uniform(500_000, 10_000_000)
        elif fraud_type == "structuring":
            amount = random.uniform(900_000, 999_999)  # just below CBN reporting threshold
        else:
            amount = max(1000, np.random.lognormal(mean=10.5, sigma=1.8))
            if amount > 50_000_000:
                amount = random.uniform(50_000, 2_000_000)
        day_of_week = random.randint(0, 6)
        merchant_cat = random.choice(MERCHANT_CATEGORIES)
        channel = random.choice(["web", "mobile", "api"]) if fraud_type in ("velocity", "international") else random.choice(TRANSACTION_CHANNELS)

        if fraud_type == "velocity":
            velocity_1h = random.randint(8, 25)
            velocity_24h = velocity_1h + random.randint(15, 50)
        else:
            velocity_1h = max(0, int(np.random.exponential(2)))
            velocity_24h = velocity_1h + max(0, int(np.random.exponential(4)))

        avg_txn = max(100, np.random.lognormal(mean=8.5, sigma=1.0))
        amount_vs_avg = amount / max(avg_txn, 1)
        geo_distance_km = random.uniform(500, 5000) if fraud_type == "geo" else max(0, np.random.exponential(50))
        device_age_days = random.randint(0, 3) if fraud_type == "new_device" else random.randint(0, 365)
        is_new_beneficiary = 1 if random.random() < 0.65 else 0
        is_international = 1 if fraud_type == "international" or random.random() < 0.3 else 0
        account_age_days = random.randint(1, 180) if random.random() < 0.4 else random.randint(90, 3650)
        balance = max(1000, np.random.lognormal(mean=11, sigma=1.5))
        balance_ratio = amount / max(balance, 1)
        state = random.choice(NIGERIAN_STATES)
        ts = base_date + timedelta(days=random.randint(0, 364),
                                    hours=hour, minutes=random.randint(0, 59))

        records.append({
            "transaction_id": str(uuid.uuid4()),
            "timestamp": ts.isoformat(),
            "amount": round(amount, 2),
            "hour": hour,
            "day_of_week": day_of_week,
            "merchant_category": merchant_cat,
            "channel": channel,
            "velocity_1h": velocity_1h,
            "velocity_24h": velocity_24h,
            "amount_vs_avg": round(min(amount_vs_avg, 50.0), 4),
            "geo_distance_km": round(geo_distance_km, 2),
            "device_age_days": device_age_days,
            "is_new_beneficiary": is_new_beneficiary,
            "is_international": is_international,
            "account_age_days": account_age_days,
            "balance_ratio": round(min(balance_ratio, 10.0), 4),
            "state": state,
            "card_type": random.choice(CARD_TYPES),
            "is_fraud": 1,
        })

    random.shuffle(records)
    df = pd.DataFrame(records)
    out_path = DATA_DIR / "fraud_detection.parquet"
    df.to_parquet(out_path, index=False)
    print(f"  → {out_path} ({len(df)} rows, {df['is_fraud'].sum()} fraud, {(1-df['is_fraud'].mean())*100:.1f}% legitimate)")
    return df


# ═══════════════════════════════════════════════════════════════════════════════
# 2. CREDIT SCORING DATASET
# ═══════════════════════════════════════════════════════════════════════════════
def generate_credit_dataset(n_samples=50000, default_ratio=0.08):
    """Generate labeled credit dataset for credit risk prediction.
    Features: monthly_income, total_debt, dti_ratio, employment_years,
              num_prior_loans, num_defaults, age, sector, loan_amount_requested,
              loan_tenure_months, collateral_value, has_guarantor, account_age_months,
              avg_monthly_balance, num_dependents
    Label: will_default (0/1)
    """
    print(f"Generating {n_samples} credit applications...")

    records = []
    for i in range(n_samples):
        age = random.randint(22, 65)
        monthly_income = max(30000, np.random.lognormal(mean=11.5, sigma=0.8))
        if monthly_income > 50_000_000:
            monthly_income = random.uniform(50000, 2_000_000)
        total_debt = max(0, monthly_income * random.uniform(0, 3.0))
        dti = total_debt / max(monthly_income, 1)
        employment_years = max(0, min(40, np.random.exponential(5)))
        num_prior_loans = max(0, int(np.random.poisson(2)))
        num_defaults = 0
        age_group = "young" if age < 30 else "mid" if age < 45 else "senior"
        sector = random.choice(SECTORS)
        loan_amount = max(50000, np.random.lognormal(mean=13.5, sigma=1.2))
        if loan_amount > 500_000_000:
            loan_amount = random.uniform(100_000, 20_000_000)
        loan_tenure = random.choice([6, 12, 18, 24, 36, 48, 60, 84, 120, 180, 240])
        collateral_value = loan_amount * random.uniform(0, 2.5) if random.random() < 0.6 else 0
        has_guarantor = 1 if random.random() < 0.4 else 0
        account_age_months = random.randint(1, 240)
        avg_monthly_balance = max(0, np.random.lognormal(mean=11, sigma=1.5))
        if avg_monthly_balance > 100_000_000:
            avg_monthly_balance = random.uniform(10_000, 5_000_000)
        num_dependents = max(0, int(np.random.poisson(2)))
        state = random.choice(NIGERIAN_STATES)

        # Default probability influenced by features
        default_prob = 0.03  # base rate
        if dti > 0.6:
            default_prob += 0.15
        elif dti > 0.4:
            default_prob += 0.05
        if employment_years < 1:
            default_prob += 0.10
        elif employment_years < 2:
            default_prob += 0.04
        if num_prior_loans == 0:
            default_prob += 0.03
        if num_defaults > 0:
            default_prob += 0.20 * num_defaults
        if collateral_value < loan_amount * 0.3:
            default_prob += 0.05
        if account_age_months < 6:
            default_prob += 0.08
        if avg_monthly_balance < monthly_income * 0.1:
            default_prob += 0.06
        if age < 25:
            default_prob += 0.04
        if sector in ("agriculture", "real_estate"):
            default_prob += 0.03
        if loan_amount > monthly_income * 48:
            default_prob += 0.10

        # Add noise
        default_prob = min(0.95, max(0.01, default_prob + np.random.normal(0, 0.03)))
        will_default = 1 if random.random() < default_prob else 0
        if will_default:
            num_defaults = max(num_defaults, random.randint(0, 2))

        records.append({
            "application_id": str(uuid.uuid4()),
            "customer_bvn": generate_bvn(),
            "age": age,
            "monthly_income": round(monthly_income, 2),
            "total_debt": round(total_debt, 2),
            "dti_ratio": round(dti, 4),
            "employment_years": round(employment_years, 1),
            "num_prior_loans": num_prior_loans,
            "num_defaults": num_defaults,
            "sector": sector,
            "loan_amount_requested": round(loan_amount, 2),
            "loan_tenure_months": loan_tenure,
            "collateral_value": round(collateral_value, 2),
            "has_guarantor": has_guarantor,
            "account_age_months": account_age_months,
            "avg_monthly_balance": round(avg_monthly_balance, 2),
            "num_dependents": num_dependents,
            "state": state,
            "will_default": will_default,
        })

    df = pd.DataFrame(records)
    out_path = DATA_DIR / "credit_scoring.parquet"
    df.to_parquet(out_path, index=False)
    print(f"  → {out_path} ({len(df)} rows, {df['will_default'].sum()} defaults, {df['will_default'].mean()*100:.1f}% default rate)")
    return df


# ═══════════════════════════════════════════════════════════════════════════════
# 3. AML RISK SCORING DATASET
# ═══════════════════════════════════════════════════════════════════════════════
def generate_aml_dataset(n_samples=50000, suspicious_ratio=0.05):
    """Generate labeled AML dataset for suspicious activity detection.
    Features: transaction_count_30d, unique_counterparties_30d,
              cash_ratio, international_ratio, avg_transaction_amount,
              max_transaction_amount, round_amount_ratio, night_ratio,
              structuring_score, pep_flag, high_risk_country, account_type,
              kyc_level, days_since_last_kyc_update
    Label: is_suspicious (0/1)
    """
    print(f"Generating {n_samples} AML risk profiles...")

    records = []
    for i in range(n_samples):
        is_suspicious = 1 if random.random() < suspicious_ratio else 0

        if is_suspicious:
            sus_type = random.choice(["structuring", "layering", "pep",
                                       "high_risk_country", "rapid_movement", "smurfing"])
            txn_count = random.randint(30, 200) if sus_type in ("layering", "smurfing") else random.randint(5, 80)
            unique_cps = random.randint(15, 80) if sus_type == "smurfing" else random.randint(3, 30)
            cash_ratio = random.uniform(0.5, 0.95) if sus_type == "structuring" else random.uniform(0.0, 0.5)
            intl_ratio = random.uniform(0.4, 0.9) if sus_type == "high_risk_country" else random.uniform(0.0, 0.3)
            avg_amount = random.uniform(800_000, 999_000) if sus_type == "structuring" else random.uniform(50_000, 5_000_000)
            max_amount = avg_amount * random.uniform(1.0, 3.0)
            round_ratio = random.uniform(0.6, 0.95) if sus_type == "structuring" else random.uniform(0.0, 0.3)
            night_ratio = random.uniform(0.3, 0.7) if sus_type == "rapid_movement" else random.uniform(0.0, 0.2)
            struct_score = random.uniform(0.6, 1.0) if sus_type == "structuring" else random.uniform(0.0, 0.4)
            pep_flag = 1 if sus_type == "pep" or random.random() < 0.2 else 0
            high_risk = 1 if sus_type == "high_risk_country" or random.random() < 0.15 else 0
        else:
            txn_count = random.randint(1, 50)
            unique_cps = random.randint(1, 15)
            cash_ratio = random.uniform(0.0, 0.3)
            intl_ratio = random.uniform(0.0, 0.1)
            avg_amount = max(100, np.random.lognormal(mean=9, sigma=1.5))
            if avg_amount > 10_000_000:
                avg_amount = random.uniform(5_000, 500_000)
            max_amount = avg_amount * random.uniform(1.0, 5.0)
            round_ratio = random.uniform(0.0, 0.2)
            night_ratio = random.uniform(0.0, 0.1)
            struct_score = random.uniform(0.0, 0.2)
            pep_flag = 1 if random.random() < 0.02 else 0
            high_risk = 1 if random.random() < 0.01 else 0

        account_type = random.choice(ACCOUNT_TYPES)
        kyc_level = random.choice(["tier1", "tier2", "tier3"])
        days_since_kyc = random.randint(1, 730)

        records.append({
            "profile_id": str(uuid.uuid4()),
            "transaction_count_30d": txn_count,
            "unique_counterparties_30d": unique_cps,
            "cash_ratio": round(cash_ratio, 4),
            "international_ratio": round(intl_ratio, 4),
            "avg_transaction_amount": round(avg_amount, 2),
            "max_transaction_amount": round(max_amount, 2),
            "round_amount_ratio": round(round_ratio, 4),
            "night_ratio": round(night_ratio, 4),
            "structuring_score": round(struct_score, 4),
            "pep_flag": pep_flag,
            "high_risk_country": high_risk,
            "account_type": account_type,
            "kyc_level": kyc_level,
            "days_since_last_kyc_update": days_since_kyc,
            "is_suspicious": is_suspicious,
        })

    df = pd.DataFrame(records)
    out_path = DATA_DIR / "aml_risk.parquet"
    df.to_parquet(out_path, index=False)
    print(f"  → {out_path} ({len(df)} rows, {df['is_suspicious'].sum()} suspicious, {df['is_suspicious'].mean()*100:.1f}% suspicious)")
    return df


# ═══════════════════════════════════════════════════════════════════════════════
# 4. CUSTOMER CHURN PREDICTION DATASET
# ═══════════════════════════════════════════════════════════════════════════════
def generate_churn_dataset(n_customers=20000, seq_length=12, churn_ratio=0.12):
    """Generate sequential customer activity data for churn prediction.
    Each customer has `seq_length` months of activity features.
    Features per month: transaction_count, total_amount, avg_balance,
                        product_count, complaint_count, login_count,
                        channel_diversity, nps_score
    Label: churned (0/1)
    """
    print(f"Generating {n_customers} customer sequences (seq_len={seq_length})...")

    all_features = []
    all_labels = []
    metadata = []

    for i in range(n_customers):
        churned = 1 if random.random() < churn_ratio else 0

        # Base activity level
        base_txns = max(1, int(np.random.lognormal(mean=2, sigma=0.8)))
        base_amount = max(1000, np.random.lognormal(mean=10, sigma=1.5))
        if base_amount > 50_000_000:
            base_amount = random.uniform(10_000, 2_000_000)
        base_balance = max(5000, np.random.lognormal(mean=11, sigma=1.2))
        if base_balance > 100_000_000:
            base_balance = random.uniform(50_000, 5_000_000)
        product_count = random.randint(1, 5)
        base_logins = max(1, int(np.random.exponential(10)))

        sequence = []
        for month in range(seq_length):
            # Churn pattern: declining activity in later months
            if churned and month >= seq_length - 4:
                decay = 1.0 - (month - (seq_length - 4)) * 0.25
                decay = max(0.05, decay)
            else:
                decay = 1.0

            txn_count = max(0, int(base_txns * decay * random.uniform(0.5, 1.5)))
            total_amount = max(0, base_amount * decay * random.uniform(0.3, 1.7))
            avg_balance = max(0, base_balance * decay * random.uniform(0.5, 1.3))
            complaint_count = 0
            if churned and month >= seq_length - 3:
                complaint_count = random.randint(0, 3)
            elif random.random() < 0.05:
                complaint_count = 1
            login_count = max(0, int(base_logins * decay * random.uniform(0.3, 1.5)))
            channel_div = min(1.0, random.uniform(0.2, 0.8) * decay)
            nps_score = random.randint(1, 10)
            if churned and month >= seq_length - 3:
                nps_score = random.randint(1, 4)

            sequence.append([
                txn_count, round(total_amount, 2), round(avg_balance, 2),
                product_count, complaint_count, login_count,
                round(channel_div, 3), nps_score
            ])

        all_features.append(sequence)
        all_labels.append(churned)
        metadata.append({
            "customer_id": str(uuid.uuid4()),
            "bvn": generate_bvn(),
            "state": random.choice(NIGERIAN_STATES),
            "account_type": random.choice(ACCOUNT_TYPES),
            "churned": churned,
        })

    features_flat = []
    for idx, seq in enumerate(all_features):
        for month_idx, month_data in enumerate(seq):
            features_flat.append({
                "customer_idx": idx,
                "month": month_idx,
                "transaction_count": month_data[0],
                "total_amount": month_data[1],
                "avg_balance": month_data[2],
                "product_count": month_data[3],
                "complaint_count": month_data[4],
                "login_count": month_data[5],
                "channel_diversity": month_data[6],
                "nps_score": month_data[7],
            })

    df_features = pd.DataFrame(features_flat)
    df_meta = pd.DataFrame(metadata)
    df_features.to_parquet(DATA_DIR / "churn_sequences.parquet", index=False)
    df_meta.to_parquet(DATA_DIR / "churn_labels.parquet", index=False)

    # Also save as numpy for direct training
    np.save(DATA_DIR / "churn_features.npy", np.array(all_features, dtype=np.float32))
    np.save(DATA_DIR / "churn_labels.npy", np.array(all_labels, dtype=np.int64))

    print(f"  → {DATA_DIR / 'churn_sequences.parquet'} ({len(df_features)} rows)")
    print(f"  → {DATA_DIR / 'churn_labels.parquet'} ({len(df_meta)} rows, {sum(all_labels)} churned, {sum(all_labels)/len(all_labels)*100:.1f}% churn)")
    return np.array(all_features), np.array(all_labels)


# ═══════════════════════════════════════════════════════════════════════════════
# 5. GNN FRAUD RING DETECTION DATASET (GRAPH)
# ═══════════════════════════════════════════════════════════════════════════════
def generate_graph_dataset(n_accounts=10000, n_transactions=80000,
                           n_fraud_rings=30, ring_size_range=(3, 12)):
    """Generate transaction graph for GNN-based fraud ring detection.
    Nodes: bank accounts with features
    Edges: transactions between accounts
    Labels: accounts involved in fraud rings (0/1)
    """
    print(f"Generating graph dataset ({n_accounts} nodes, {n_transactions} edges, {n_fraud_rings} fraud rings)...")

    # Generate account nodes
    nodes = []
    for i in range(n_accounts):
        nodes.append({
            "node_id": i,
            "account_type_idx": ACCOUNT_TYPES.index(random.choice(ACCOUNT_TYPES)),
            "balance": round(max(0, np.random.lognormal(mean=11, sigma=1.5)), 2),
            "account_age_days": random.randint(1, 3650),
            "kyc_level": random.choice([0, 1, 2]),  # tier1=0, tier2=1, tier3=2
            "num_products": random.randint(1, 5),
            "avg_incoming_amount": round(max(0, np.random.lognormal(mean=9, sigma=1.5)), 2),
            "avg_outgoing_amount": round(max(0, np.random.lognormal(mean=9, sigma=1.5)), 2),
            "is_fraud_ring": 0,
        })

    # Create fraud rings — tightly connected subgraphs
    fraud_ring_members = set()
    fraud_ring_edges = []
    for ring_idx in range(n_fraud_rings):
        ring_size = random.randint(*ring_size_range)
        ring_members = random.sample(range(n_accounts), ring_size)

        for member in ring_members:
            fraud_ring_members.add(member)
            nodes[member]["is_fraud_ring"] = 1
            # Fraud ring members have anomalous features
            nodes[member]["balance"] = round(random.uniform(100_000, 50_000_000), 2)
            nodes[member]["account_age_days"] = random.randint(1, 180)  # newer accounts
            nodes[member]["kyc_level"] = random.choice([0, 0, 1])  # lower KYC

        # Ring topology: circular + cross-connections
        for j in range(ring_size):
            src = ring_members[j]
            dst = ring_members[(j + 1) % ring_size]
            amount = round(random.uniform(500_000, 5_000_000), 2)
            fraud_ring_edges.append((src, dst, amount, 1))

        # Additional cross-connections within ring
        n_cross = random.randint(1, max(1, ring_size // 2))
        for _ in range(n_cross):
            src = random.choice(ring_members)
            dst = random.choice(ring_members)
            if src != dst:
                amount = round(random.uniform(200_000, 3_000_000), 2)
                fraud_ring_edges.append((src, dst, amount, 1))

    # Generate normal transactions
    normal_edges = []
    for _ in range(n_transactions - len(fraud_ring_edges)):
        src = random.randint(0, n_accounts - 1)
        dst = random.randint(0, n_accounts - 1)
        if src == dst:
            dst = (dst + 1) % n_accounts
        amount = round(max(100, np.random.lognormal(mean=9, sigma=1.5)), 2)
        if amount > 10_000_000:
            amount = round(random.uniform(1000, 500_000), 2)
        normal_edges.append((src, dst, amount, 0))

    all_edges = fraud_ring_edges + normal_edges
    random.shuffle(all_edges)

    df_nodes = pd.DataFrame(nodes)
    df_edges = pd.DataFrame(all_edges, columns=["src", "dst", "amount", "is_fraud_edge"])

    df_nodes.to_parquet(DATA_DIR / "graph_nodes.parquet", index=False)
    df_edges.to_parquet(DATA_DIR / "graph_edges.parquet", index=False)

    print(f"  → {DATA_DIR / 'graph_nodes.parquet'} ({len(df_nodes)} nodes, {df_nodes['is_fraud_ring'].sum()} fraud ring members)")
    print(f"  → {DATA_DIR / 'graph_edges.parquet'} ({len(df_edges)} edges, {df_edges['is_fraud_edge'].sum()} fraud edges)")
    return df_nodes, df_edges


# ═══════════════════════════════════════════════════════════════════════════════
# 6. ANOMALY DETECTION DATASET (UNLABELED)
# ═══════════════════════════════════════════════════════════════════════════════
def generate_anomaly_dataset(n_normal=80000, n_anomaly=2000):
    """Generate transaction dataset for autoencoder-based anomaly detection.
    Mostly normal transactions with a small set of anomalies for evaluation.
    Features: amount_log, hour_sin, hour_cos, day_sin, day_cos,
              velocity_1h, velocity_24h, amount_vs_avg, balance_ratio,
              merchant_cat_encoded (one-hot → 20 dims), channel_encoded (7 dims)
    """
    print(f"Generating {n_normal + n_anomaly} transactions for anomaly detection...")

    records = []
    for i in range(n_normal):
        amount = max(100, np.random.lognormal(mean=9.0, sigma=1.3))
        if amount > 10_000_000:
            amount = random.uniform(500, 500_000)
        hour = int(np.random.normal(13, 4)) % 24
        day = random.randint(0, 6)
        vel_1h = max(0, int(np.random.exponential(1.2)))
        vel_24h = vel_1h + max(0, int(np.random.exponential(2.5)))
        avg_txn = amount * random.uniform(0.7, 1.3)
        balance = max(1000, np.random.lognormal(mean=12, sigma=1.3))
        if balance > 100_000_000:
            balance = random.uniform(10_000, 5_000_000)

        records.append({
            "amount_log": round(math.log(max(amount, 1)), 4),
            "hour_sin": round(math.sin(2 * math.pi * hour / 24), 4),
            "hour_cos": round(math.cos(2 * math.pi * hour / 24), 4),
            "day_sin": round(math.sin(2 * math.pi * day / 7), 4),
            "day_cos": round(math.cos(2 * math.pi * day / 7), 4),
            "velocity_1h": vel_1h,
            "velocity_24h": vel_24h,
            "amount_vs_avg": round(amount / max(avg_txn, 1), 4),
            "balance_ratio": round(amount / max(balance, 1), 4),
            "merchant_cat_idx": MERCHANT_CATEGORIES.index(random.choice(MERCHANT_CATEGORIES)),
            "channel_idx": TRANSACTION_CHANNELS.index(random.choice(TRANSACTION_CHANNELS)),
            "is_anomaly": 0,
        })

    # Generate anomalous transactions
    for i in range(n_anomaly):
        anomaly_type = random.choice(["huge_amount", "odd_time", "velocity_spike", "ratio_spike"])
        if anomaly_type == "huge_amount":
            amount = random.uniform(5_000_000, 100_000_000)
        else:
            amount = max(100, np.random.lognormal(mean=10, sigma=2))
            if amount > 50_000_000:
                amount = random.uniform(10_000, 5_000_000)

        hour = random.choice([0, 1, 2, 3, 4]) if anomaly_type == "odd_time" else int(np.random.normal(14, 5)) % 24
        day = random.randint(0, 6)
        vel_1h = random.randint(10, 30) if anomaly_type == "velocity_spike" else max(0, int(np.random.exponential(1.5)))
        vel_24h = vel_1h + random.randint(20, 60) if anomaly_type == "velocity_spike" else vel_1h + max(0, int(np.random.exponential(3)))
        avg_txn = max(100, np.random.lognormal(mean=8.5, sigma=1.0))
        balance = max(1000, np.random.lognormal(mean=11, sigma=1.0))
        if balance > 50_000_000:
            balance = random.uniform(10_000, 2_000_000)

        records.append({
            "amount_log": round(math.log(max(amount, 1)), 4),
            "hour_sin": round(math.sin(2 * math.pi * hour / 24), 4),
            "hour_cos": round(math.cos(2 * math.pi * hour / 24), 4),
            "day_sin": round(math.sin(2 * math.pi * day / 7), 4),
            "day_cos": round(math.cos(2 * math.pi * day / 7), 4),
            "velocity_1h": vel_1h,
            "velocity_24h": vel_24h,
            "amount_vs_avg": round(min(amount / max(avg_txn, 1), 100), 4),
            "balance_ratio": round(min(amount / max(balance, 1), 100), 4),
            "merchant_cat_idx": MERCHANT_CATEGORIES.index(random.choice(MERCHANT_CATEGORIES)),
            "channel_idx": TRANSACTION_CHANNELS.index(random.choice(TRANSACTION_CHANNELS)),
            "is_anomaly": 1,
        })

    df = pd.DataFrame(records)
    out_path = DATA_DIR / "anomaly_detection.parquet"
    df.to_parquet(out_path, index=False)
    print(f"  → {out_path} ({len(df)} rows, {df['is_anomaly'].sum()} anomalies)")
    return df


# ═══════════════════════════════════════════════════════════════════════════════
# DELTA LAKE EXPORT
# ═══════════════════════════════════════════════════════════════════════════════
def export_to_delta_lake(datasets: dict):
    """Export all datasets to Delta Lake format for Lakehouse integration."""
    try:
        from deltalake import write_deltalake
        delta_dir = DATA_DIR / "delta"
        delta_dir.mkdir(parents=True, exist_ok=True)

        for name, df in datasets.items():
            table_path = str(delta_dir / name)
            write_deltalake(table_path, df, mode="overwrite")
            print(f"  → Delta Lake: {table_path}")

        print(f"Delta Lake tables written to {delta_dir}")
    except Exception as e:
        print(f"Delta Lake export failed (non-critical): {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("=" * 70)
    print("54Bank — Synthetic Data Generation for ML Training")
    print("=" * 70)

    datasets = {}

    df_fraud = generate_fraud_dataset(n_samples=100000)
    datasets["fraud_detection"] = df_fraud

    df_credit = generate_credit_dataset(n_samples=50000)
    datasets["credit_scoring"] = df_credit

    df_aml = generate_aml_dataset(n_samples=50000)
    datasets["aml_risk"] = df_aml

    churn_features, churn_labels = generate_churn_dataset(n_customers=20000)

    df_nodes, df_edges = generate_graph_dataset(n_accounts=10000, n_transactions=80000)
    datasets["graph_nodes"] = df_nodes
    datasets["graph_edges"] = df_edges

    df_anomaly = generate_anomaly_dataset(n_normal=80000, n_anomaly=2000)
    datasets["anomaly_detection"] = df_anomaly

    print("\n" + "=" * 70)
    print("Exporting to Delta Lake...")
    export_to_delta_lake(datasets)

    print("\n" + "=" * 70)
    print("DONE — All synthetic datasets generated")
    total_rows = sum(len(d) for d in datasets.values()) + len(churn_features) * 12
    print(f"Total records: {total_rows:,}")
    print(f"Output directory: {DATA_DIR}")
    print("=" * 70)
