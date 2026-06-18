#!/usr/bin/env python3
"""
54Bank — Seed Data Generator (Remaining 256 tables)
=====================================================
Generates INSERT statements for all tables not covered by generate-seed-data.py.
Reads schema.ts to auto-discover column names and types, then generates
contextually appropriate Nigerian banking data.

Outputs: drizzle/seed-remaining-comprehensive.sql
"""

import re
import random
import uuid
import json
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Any

random.seed(54)

NOW = datetime(2026, 5, 9, 12, 0, 0)
BASE = datetime(2025, 1, 1)

# Reference IDs from the primary seed (must match generate-seed-data.py output)
TENANT_IDS = ["tenant-lagos-main", "tenant-abuja-digital", "tenant-kano-north", "tenant-portharcourt", "tenant-whitelabel-zenith"]

# ─── Nigerian context data ───────────────────────────────────────────────────

NAMES_M = ["Adewale","Babajide","Chukwuemeka","Damilola","Emeka","Femi","Gbenga","Hassan","Ibrahim","Jide","Kunle","Lanre","Musa","Nnamdi","Olumide","Pelumi","Rasheed","Segun","Tunde","Uche"]
NAMES_F = ["Adaeze","Bukola","Chidinma","Dorcas","Esther","Fatima","Grace","Hauwa","Ifeoma","Jumoke","Kemi","Lilian","Maryam","Nneka","Oluchi","Patience","Rahma","Sade","Titilayo","Uzo"]
SURNAMES = ["Adeyemi","Balogun","Chukwu","Danladi","Eze","Fashola","Garba","Hassan","Igwe","Jimoh","Kalu","Lawal","Mohammed","Nwosu","Okafor","Peterside","Sanusi","Taiwo","Usman","Yakubu","Dangote","Elumelu","Otedola","Adenuga"]
STATES = ["Lagos","Abuja FCT","Kano","Rivers","Oyo","Kaduna","Ogun","Enugu","Anambra","Delta","Edo","Imo","Kwara","Osun","Plateau","Borno","Cross River","Akwa Ibom"]
CITIES = ["Ikeja","Victoria Island","Lekki","Wuse","Garki","Maitama","Kano","Port Harcourt","Ibadan","Zaria","Abeokuta","Enugu","Awka","Asaba","Warri","Benin City"]
COMPANIES = ["Dangote Industries","MTN Nigeria","BUA Group","Transcorp Plc","Oando Plc","Seplat Energy","Flour Mills","Nestle Nigeria","Nigerian Breweries","GTBank","Zenith Bank","Access Bank"]
CROPS = ["Maize","Rice","Cassava","Yam","Sorghum","Millet","Groundnut","Cowpea","Cocoa","Oil Palm","Cashew","Sesame"]
LIVESTOCK = ["Cattle","Goat","Sheep","Poultry","Catfish","Tilapia","Pig"]

def uid(prefix="REC"): return f"{prefix}-{uuid.uuid4().hex[:12]}"
def ts(dt=None):
    if dt is None: dt = rand_dt()
    return dt.strftime("%Y-%m-%d %H:%M:%S")
def rand_dt(start=BASE, end=NOW):
    delta = end - start
    return start + timedelta(seconds=random.randint(0, int(delta.total_seconds())))
def rand_name():
    first = random.choice(NAMES_M + NAMES_F)
    last = random.choice(SURNAMES)
    return f"{first} {last}"
def rand_phone(): return f"0{random.choice([803,805,806,807,808,809,810,813,814,903,906])}{random.randint(1000000,9999999)}"
def rand_bvn(): return f"22{''.join([str(random.randint(0,9)) for _ in range(9)])}"
def rand_nuban(): return ''.join([str(random.randint(0,9)) for _ in range(10)])
def esc(s): return str(s).replace("'", "''")
def money(lo=1000, hi=50000000): return round(random.uniform(lo, hi), 2)

# ─── Parse schema.ts ──────────────────────────────────────────────────────────

def parse_schema():
    with open("/home/ubuntu/repos/corebanking/drizzle/schema.ts") as f:
        content = f.read()
    tables = {}
    for match in re.finditer(r'pgTable\("([^"]+)"', content):
        name = match.group(1)
        start = match.start()
        depth = 0
        for i in range(start, len(content)):
            if content[i] == '{': depth += 1
            elif content[i] == '}':
                depth -= 1
                if depth == 0: break
        block = content[start:i+1]
        cols = re.findall(r'(\w+):\s*(serial|varchar|text|integer|doublePrecision|timestamp|jsonb|boolean)', block)
        tables[name] = [(c[0], c[1]) for c in cols]
    return tables

# ─── Already seeded tables (from seed-comprehensive.sql) ─────────────────────

ALREADY_SEEDED = {
    "accounts","agentBankingAgents","agriLoans","amlAlerts","auditEntries","auditTrail",
    "billingAccounts","billingRateCards","cardTransactions","customerBillPayments",
    "customerCards","customerNotifications","customerStatements","customerTransfers",
    "customers","disputeCases","escrow_accounts","exportJobs","farmers","fxTrades",
    "identityProfiles","journalEntries","kycVerifications","loanRepayments","loans",
    "nipTransactions","nostroAccounts","operatorActions","regulatoryReports","settlements",
    "swiftMessages","tenantFeatureFlags","tenants","transactions","transfers","trialBalances",
    "users","workflowCases",
}

# ─── Value generators per column type ─────────────────────────────────────────

def gen_value(col_name: str, col_type: str, table_name: str) -> str:
    """Generate a contextually appropriate SQL value for a column."""
    cn = col_name.lower()

    # Skip serial/id columns
    if col_type == "serial":
        return None  # skip

    # Tenant IDs
    if cn in ("tenantid", "tenant_id"):
        return f"'{random.choice(TENANT_IDS)}'"

    # Customer references
    if cn in ("customerid", "customer_id"):
        return f"'CUST-{uuid.uuid4().hex[:12]}'"

    # Account references
    if cn in ("accountid", "account_id"):
        return f"'ACCT-{uuid.uuid4().hex[:12]}'"

    # Farmer references
    if cn in ("farmerid", "farmer_id"):
        return f"'FARM-{uuid.uuid4().hex[:12]}'"

    # Loan references
    if cn in ("loanid", "loan_id"):
        return f"'LOAN-{uuid.uuid4().hex[:12]}'"

    # Card references
    if cn in ("cardid", "card_id"):
        return f"'CARD-{uuid.uuid4().hex[:12]}'"

    # Generic record IDs
    if cn in ("recordid", "record_id"):
        return f"'{uid()}'"
    if cn.endswith("id") and col_type in ("text", "varchar"):
        prefix = col_name[:4].upper()
        return f"'{uid(prefix)}'"

    # Names
    if cn in ("name", "customername", "customer_name", "entityname", "entity_name", "staffname", "staff_name", "agentname", "agent_name", "applicantname", "applicant_name", "beneficiaryname"):
        return f"'{esc(rand_name())}'"
    if cn in ("merchantname",):
        return f"'{esc(random.choice(['Shoprite Ikeja','SPAR Lekki','Chicken Republic','Dominos Wuse','Total Station']))}'"

    # Status fields
    if cn == "status":
        return f"'{random.choice(['active','pending','completed','approved','processing'])}'"

    # Category fields
    if cn == "category":
        cats = {
            "aml": ["transaction_monitoring","sanctions","pep","structuring"],
            "kyc": ["bvn_verification","nin_verification","liveness","address","document"],
            "loan": ["term_loan","overdraft","mortgage","sme","agricultural"],
            "card": ["debit","credit","prepaid","virtual"],
            "insurance": ["crop","livestock","multi_peril","area_yield","parametric"],
            "agri": ["crop","livestock","fisheries","poultry","irrigation"],
        }
        for prefix, vals in cats.items():
            if prefix in table_name.lower():
                return f"'{random.choice(vals)}'"
        return f"'{random.choice(['general','operations','compliance','finance','technology'])}'"

    # Description fields
    if cn in ("description", "detail", "details", "notes", "note", "headline"):
        return f"'{esc(f'{rand_name()} - {random.choice(CITIES)}, {random.choice(STATES)} - {table_name} record')}'"

    # Amount/money fields
    if cn in ("amount", "balance", "totalamount", "total_amount", "principalamount", "suminsured", "premiumamount", "collateralvalue", "outstandingbalance", "accruedamount"):
        return str(money())
    if col_type == "doublePrecision":
        if "rate" in cn or "ratio" in cn or "score" in cn or "percentage" in cn:
            return str(round(random.uniform(0, 100), 4))
        if "lat" in cn:
            return str(round(random.uniform(4.0, 14.0), 6))  # Nigeria latitude
        if "lon" in cn or "lng" in cn:
            return str(round(random.uniform(2.0, 15.0), 6))  # Nigeria longitude
        if "size" in cn or "hectare" in cn or "area" in cn:
            return str(round(random.uniform(0.5, 500), 2))
        return str(round(random.uniform(0, 10000000), 2))

    # Integer fields
    if col_type == "integer":
        if "count" in cn or "total" in cn: return str(random.randint(0, 10000))
        if "score" in cn: return str(random.randint(0, 100))
        if "days" in cn or "hours" in cn: return str(random.randint(1, 365))
        if "version" in cn: return str(random.randint(1, 10))
        if "limit" in cn: return str(random.randint(1000, 1000000))
        if "port" in cn: return str(random.randint(3000, 9999))
        return str(random.randint(0, 1000))

    # Boolean fields
    if col_type == "boolean":
        return "true" if random.random() < 0.7 else "false"

    # Timestamp fields
    if col_type == "timestamp":
        return f"'{ts()}'"

    # JSONB fields
    if col_type == "jsonb":
        if "metadata" in cn or "meta" in cn:
            obj = {"source": "seed", "tenant": random.choice(TENANT_IDS)}
            return f"'{esc(json.dumps(obj))}'::jsonb"
        if "config" in cn or "configuration" in cn:
            obj = {"enabled": True, "version": 1}
            return f"'{esc(json.dumps(obj))}'::jsonb"
        if "schedule" in cn:
            obj = {"monthly": True}
            return f"'{esc(json.dumps(obj))}'::jsonb"
        if "response" in cn or "result" in cn:
            obj = {"status": "ok", "score": round(random.uniform(0, 1), 4)}
            return f"'{esc(json.dumps(obj))}'::jsonb"
        obj = {"data": "seed"}
        return f"'{esc(json.dumps(obj))}'::jsonb"

    # Text/varchar fallbacks
    if col_type in ("text", "varchar"):
        # Phone
        if "phone" in cn: return f"'{rand_phone()}'"
        # BVN/NIN
        if "bvn" in cn: return f"'{rand_bvn()}'"
        if "nin" in cn: return f"'{rand_bvn()}'"  # same format
        # Email
        if "email" in cn:
            n = rand_name().lower().replace(" ", ".")
            return f"'{n}@54bank.ng'"
        # URL
        if "url" in cn or "uri" in cn:
            return f"'https://cdn.54bank.ng/{table_name}/{uuid.uuid4().hex[:8]}'"
        # IP address
        if "ip" in cn:
            return f"'10.0.{random.randint(0,255)}.{random.randint(1,254)}'"
        # Currency
        if cn == "currency":
            return f"'{random.choice(['NGN','NGN','NGN','USD','EUR','GBP'])}'"
        # Region/state
        if cn in ("region", "state", "lga"):
            return f"'{random.choice(STATES)}'"
        # City/location
        if cn in ("location", "city"):
            return f"'{random.choice(CITIES)}'"
        # Reference
        if "ref" in cn or "reference" in cn:
            return f"'REF-{uuid.uuid4().hex[:12].upper()}'"
        # Role
        if cn in ("role", "actorrole", "actor_role", "requiredRole", "required_role"):
            return f"'{random.choice(['admin','operator','compliance','treasury','credit','teller','auditor'])}'"
        # Channel
        if cn == "channel":
            return f"'{random.choice(['mobile','web','ussd','pos','atm','branch','whatsapp','voice'])}'"
        # Provider
        if cn == "provider":
            return f"'{random.choice(['NIBSS','NIMC','Smile Identity','Youverify','Prembly','Dojah'])}'"
        # Risk
        if "risk" in cn:
            return f"'{random.choice(['low','medium','high','critical'])}'"
        # Type
        if cn.endswith("type"):
            return f"'{random.choice(['standard','premium','basic','enhanced','full'])}'"
        # Period
        if cn == "period" or "period" in cn:
            return f"'2025-{random.randint(1,12):02d}'"
        # Generic
        return f"'{esc(uid(table_name[:6].upper()))}'"

    return "NULL"


def gen_generic_service_table(table_name: str, n_rows: int = 8) -> List[str]:
    """Generate INSERT for a 13-column generic service table."""
    lines = []
    rows = []
    for _ in range(n_rows):
        tid = random.choice(TENANT_IDS)
        rid = uid()
        name = rand_name()
        cat = random.choice(["operations","compliance","finance","technology","lending","payments","risk"])
        desc = f"{name} - {random.choice(CITIES)} - {table_name.replace('_',' ').title()}"
        status = random.choice(["active","pending","completed","approved","processing"])
        amt = money(1000, 10000000)
        region = random.choice(STATES)
        ref = f"REF-{uuid.uuid4().hex[:10].upper()}"
        meta = json.dumps({"source": "seed", "table": table_name})
        rows.append(f"  ('{tid}', '{rid}', '{esc(name)}', '{cat}', '{esc(desc)}', '{status}', {amt}, '{esc(region)}', '{ref}', '{esc(meta)}'::jsonb, '{ts()}', '{ts(NOW)}')")
    lines.append(f'INSERT INTO "{table_name}" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES')
    lines.append(",\n".join(rows))
    lines.append("ON CONFLICT DO NOTHING;")
    return lines


def gen_custom_table(table_name: str, cols: List[Tuple[str, str]], n_rows: int = 8) -> List[str]:
    """Generate INSERT for a custom-schema table."""
    # Filter out serial (auto-increment) columns
    insert_cols = [(name, typ) for name, typ in cols if typ != "serial"]
    if not insert_cols:
        return []

    lines = []
    col_names = [c[0] for c in insert_cols]
    rows = []
    for _ in range(n_rows):
        vals = []
        for cname, ctype in insert_cols:
            v = gen_value(cname, ctype, table_name)
            if v is None:
                continue
            vals.append(v)
        # Only include cols that got values (skip None)
        actual_cols = []
        actual_vals = []
        for (cname, ctype), v in zip(insert_cols, [gen_value(cn, ct, table_name) for cn, ct in insert_cols]):
            if v is not None:
                actual_cols.append(cname)
                actual_vals.append(v)
        rows.append(f"  ({', '.join(actual_vals)})")

    # Rebuild col names matching actual_vals structure
    final_cols = [cn for cn, ct in insert_cols if ct != "serial"]
    col_sql = ", ".join([f'"{c}"' for c in final_cols])
    lines.append(f'INSERT INTO "{table_name}" ({col_sql}) VALUES')
    lines.append(",\n".join(rows))
    lines.append("ON CONFLICT DO NOTHING;")
    return lines


def main():
    schema = parse_schema()
    remaining = sorted(set(schema.keys()) - ALREADY_SEEDED)

    sql = []
    sql.append("-- ═══════════════════════════════════════════════════════════════════════════")
    sql.append("-- 54Bank — Comprehensive Seed Data (Remaining Tables)")
    sql.append(f"-- Generated: {NOW.isoformat()}")
    sql.append(f"-- Tables: {len(remaining)} remaining tables with 8 rows each")
    sql.append("-- ═══════════════════════════════════════════════════════════════════════════")
    sql.append("")
    sql.append("BEGIN;")
    sql.append("")

    generic_count = 0
    custom_count = 0

    for table_name in remaining:
        cols = schema[table_name]
        col_names = [c[0] for c in cols]

        sql.append(f"\n-- ─── {table_name} ───")

        # Check if this is a generic 13-col service table
        if "tenantId" in col_names and "recordId" in col_names and "category" in col_names:
            lines = gen_generic_service_table(table_name, 8)
            generic_count += 1
        else:
            lines = gen_custom_table(table_name, cols, 8)
            custom_count += 1

        sql.extend(lines)
        sql.append("")

    sql.append("COMMIT;")
    sql.append("")
    sql.append(f"-- Generic service tables: {generic_count}")
    sql.append(f"-- Custom schema tables:   {custom_count}")
    sql.append(f"-- Total tables seeded:    {generic_count + custom_count}")
    sql.append(f"-- Total rows:             ~{(generic_count + custom_count) * 8}")

    outpath = "/home/ubuntu/repos/corebanking/drizzle/seed-remaining-comprehensive.sql"
    with open(outpath, "w") as f:
        f.write("\n".join(sql))

    print(f"✓ {outpath}")
    print(f"  Generic service tables: {generic_count}")
    print(f"  Custom schema tables:   {custom_count}")
    print(f"  Total tables seeded:    {generic_count + custom_count}")
    print(f"  Total rows:             ~{(generic_count + custom_count) * 8}")

if __name__ == "__main__":
    main()
