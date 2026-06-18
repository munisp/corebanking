#!/usr/bin/env python3
"""
54Bank — Comprehensive Seed Data Generator
==========================================
Generates relationally consistent, realistic Nigerian banking data for:
  - Postgres (296 tables)
  - TigerBeetle (double-entry ledger accounts & transfers)

All IDs, names, BVNs, NINs, phone numbers, addresses, and business entities
are realistic Nigerian data. Foreign keys are respected across the entire
dataset so the seeded database is immediately queryable and consistent.

Usage:
    python3 scripts/generate-seed-data.py
    # Outputs:
    #   drizzle/seed-comprehensive.sql   (Postgres)
    #   scripts/tigerbeetle-seed.sh      (TigerBeetle CLI commands)
"""

import random
import uuid
import json
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple

# ─── Configuration ───────────────────────────────────────────────────────────

SEED = 54  # deterministic
random.seed(SEED)

NUM_TENANTS = 5
NUM_USERS = 30
NUM_CUSTOMERS_PER_TENANT = 40  # 200 total
NUM_ACCOUNTS_PER_CUSTOMER = 2   # ~400 total
NUM_TRANSACTIONS = 2000
NUM_LOANS = 120
NUM_TRANSFERS = 300
NUM_AGENTS = 60
NUM_FARMERS = 80
NUM_GL_CODES = 220  # from COA
NUM_KYC_VERIFICATIONS = 200
NUM_AML_ALERTS = 50
NUM_FX_TRADES = 40
NUM_NIP_TRANSACTIONS = 150
NUM_CARD_TRANSACTIONS = 300
NUM_JOURNAL_ENTRIES = 800
NUM_LOAN_REPAYMENTS = 300
NUM_SETTLEMENTS = 20
NUM_SWIFT_MESSAGES = 30
NUM_AUDIT_TRAIL = 500

BASE_DATE = datetime(2025, 1, 1)
NOW = datetime(2026, 5, 9, 12, 0, 0)

# ─── Nigerian Reference Data ────────────────────────────────────────────────

NIGERIAN_FIRST_NAMES_M = [
    "Adewale", "Babajide", "Chukwuemeka", "Damilola", "Emeka", "Femi",
    "Gbenga", "Hassan", "Ibrahim", "Jide", "Kunle", "Lanre", "Musa",
    "Nnamdi", "Olumide", "Pelumi", "Rasheed", "Segun", "Tunde", "Uche",
    "Yusuf", "Abdullahi", "Bello", "Chinedu", "Dare", "Ebuka", "Folarin",
    "Godwin", "Haruna", "Ikenna", "Jelani", "Kayode", "Lawal", "Mustapha",
    "Nnadi", "Obinna", "Peter", "Quadri", "Rotimi", "Suleiman", "Tobi",
]
NIGERIAN_FIRST_NAMES_F = [
    "Adaeze", "Bukola", "Chidinma", "Dorcas", "Esther", "Fatima",
    "Grace", "Hauwa", "Ifeoma", "Jumoke", "Kemi", "Lilian", "Maryam",
    "Nneka", "Oluchi", "Patience", "Rahma", "Sade", "Titilayo", "Uzo",
    "Victoria", "Wunmi", "Yetunde", "Zainab", "Aisha", "Binta", "Chidi",
    "Deborah", "Eunice", "Funke", "Gladys", "Helen", "Idara", "Janet",
    "Kubra", "Lola", "Modupe", "Ngozi", "Ogechi", "Precious",
]
NIGERIAN_LAST_NAMES = [
    "Adeyemi", "Balogun", "Chukwu", "Danladi", "Eze", "Fashola",
    "Garba", "Hassan", "Igwe", "Jimoh", "Kalu", "Lawal", "Mohammed",
    "Nwosu", "Okafor", "Peterside", "Quadri", "Rabiu", "Sanusi", "Taiwo",
    "Usman", "Vatsa", "Williams", "Yakubu", "Zango", "Abubakar", "Bakare",
    "Chibuzor", "Dabiri", "Ekwueme", "Falana", "Gowon", "Hamza", "Ibe",
    "Johnson", "Kingibe", "Lateef", "Muazu", "Nnaji", "Okonkwo",
    "Pam", "Rufai", "Shagari", "Tinubu", "Udoh", "Wali", "Yar-Adua",
    "Zubairu", "Adenuga", "Dangote", "Otedola", "Elumelu", "Alakija",
]

NIGERIAN_STATES = [
    "Lagos", "Abuja FCT", "Kano", "Rivers", "Oyo", "Kaduna", "Ogun",
    "Enugu", "Anambra", "Delta", "Edo", "Imo", "Kwara", "Osun",
    "Plateau", "Borno", "Cross River", "Akwa Ibom", "Abia", "Bauchi",
    "Benue", "Ekiti", "Gombe", "Jigawa", "Katsina", "Kebbi", "Kogi",
    "Nasarawa", "Niger", "Ondo", "Sokoto", "Taraba", "Yobe", "Zamfara", "Bayelsa", "Ebonyi",
]

NIGERIAN_CITIES = {
    "Lagos": ["Ikeja", "Victoria Island", "Lekki", "Ikoyi", "Surulere", "Yaba", "Ajah", "Gbagada", "Maryland", "Festac"],
    "Abuja FCT": ["Wuse", "Garki", "Maitama", "Asokoro", "Gwarinpa", "Jabi", "Utako", "Kubwa", "Lugbe", "Nyanya"],
    "Kano": ["Fagge", "Nassarawa", "Tarauni", "Dala", "Kumbotso", "Ungogo", "Gwale", "Municipal"],
    "Rivers": ["Port Harcourt", "Obio-Akpor", "Eleme", "Bonny", "Degema", "Ahoada"],
    "Oyo": ["Ibadan", "Ogbomoso", "Oyo Town", "Iseyin", "Saki"],
    "Kaduna": ["Kaduna", "Zaria", "Kafanchan", "Kagoro"],
    "Ogun": ["Abeokuta", "Sagamu", "Ijebu-Ode", "Ota"],
    "Enugu": ["Enugu", "Nsukka", "Agbani", "Udi"],
    "Anambra": ["Awka", "Onitsha", "Nnewi", "Ekwulobia"],
    "Delta": ["Asaba", "Warri", "Sapele", "Agbor"],
}

NIGERIAN_BANKS = [
    ("000001", "Sterling Bank"),
    ("000002", "Keystone Bank"),
    ("000003", "FCMB"),
    ("000004", "United Bank for Africa"),
    ("000005", "Diamond Bank (Access)"),
    ("000006", "JAIZ Bank"),
    ("000007", "Fidelity Bank"),
    ("000008", "Polaris Bank"),
    ("000009", "Citi Bank"),
    ("000010", "Ecobank"),
    ("000011", "Unity Bank"),
    ("000012", "StanbicIBTC"),
    ("000013", "GTBank"),
    ("000014", "Access Bank"),
    ("000015", "Zenith Bank"),
    ("000016", "First Bank"),
    ("000017", "Wema Bank"),
    ("000018", "Union Bank"),
    ("000019", "Heritage Bank"),
    ("000020", "Standard Chartered"),
    ("000021", "Providus Bank"),
    ("000022", "TAJ Bank"),
    ("000023", "Globus Bank"),
    ("000024", "SunTrust Bank"),
    ("000025", "Titan Trust Bank"),
]

NIGERIAN_COMPANIES = [
    "Dangote Industries Ltd", "MTN Nigeria Communications Plc",
    "BUA Group", "Transcorp Plc", "Zenith Bank Plc",
    "Oando Plc", "Seplat Energy Plc", "Flour Mills of Nigeria Plc",
    "Nestle Nigeria Plc", "Nigerian Breweries Plc",
    "Guaranty Trust Holding Plc", "Lafarge Africa Plc",
    "Julius Berger Nigeria Plc", "Presco Plc",
    "UAC of Nigeria Plc", "Cadbury Nigeria Plc",
    "PZ Cussons Nigeria Plc", "Airtel Africa Plc",
    "Geregu Power Plc", "TotalEnergies Marketing Nigeria Plc",
    "Conoil Plc", "May & Baker Nigeria Plc",
    "Champion Breweries Plc", "Fidson Healthcare Plc",
    "Berger Paints Nigeria Plc", "ABC Transport Plc",
    "Chams Holding Plc", "Custodian Investment Plc",
    "Sovereign Trust Insurance Plc", "Consolidated Hallmark Insurance Plc",
]

BRANCH_CODES = [
    "BR-LG01", "BR-LG02", "BR-LG03", "BR-LG04", "BR-LG05",
    "BR-AB01", "BR-AB02", "BR-AB03",
    "BR-KN01", "BR-KN02", "BR-KN03",
    "BR-PH01", "BR-PH02",
    "BR-IB01", "BR-IB02",
    "BR-KD01", "BR-EN01", "BR-ON01", "BR-AN01", "BR-DT01",
]

CORRESPONDENT_BANKS = [
    ("Citibank New York", "USD", "36128467", "CITIUS33"),
    ("Standard Chartered London", "GBP", "80147265", "SCBLGB2L"),
    ("Deutsche Bank Frankfurt", "EUR", "DE62700700100938810600", "DEUTDEFF"),
    ("HSBC Hong Kong", "HKD", "808265732001", "HSBCHKHH"),
    ("JPMorgan Chase New York", "USD", "93752186", "CHASUS33"),
    ("Barclays Bank London", "GBP", "20325567", "BARCGB22"),
]

SWAP_BICS = [
    "ABORNGLA", "ABORNGLA", "ABORNGLA",
    "ABORNGLA", "UNLOIGLA", "UNLOIGLA",
]

MERCHANT_CATEGORIES = [
    ("5411", "Grocery Stores"), ("5812", "Restaurants"), ("5541", "Gas Stations"),
    ("5311", "Department Stores"), ("5912", "Drug Stores"), ("5999", "Retail"),
    ("4814", "Telecom"), ("5732", "Electronics"), ("7011", "Hotels"),
    ("4111", "Transportation"), ("5691", "Clothing"), ("5942", "Bookstores"),
]

CROP_TYPES = ["Maize", "Rice", "Cassava", "Yam", "Sorghum", "Millet", "Groundnut", "Cowpea", "Cocoa", "Oil Palm", "Cashew", "Sesame"]
LIVESTOCK_TYPES = ["Cattle", "Goat", "Sheep", "Poultry", "Fish (Catfish)", "Fish (Tilapia)", "Pig", "Rabbit"]

# ─── Helper Functions ────────────────────────────────────────────────────────

def uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"

def ts(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")

def rand_date(start: datetime = BASE_DATE, end: datetime = NOW) -> datetime:
    delta = end - start
    return start + timedelta(seconds=random.randint(0, int(delta.total_seconds())))

def rand_future(months: int = 12) -> datetime:
    return NOW + timedelta(days=random.randint(30, months * 30))

def rand_phone() -> str:
    prefix = random.choice(["0803", "0805", "0806", "0807", "0808", "0809", "0810", "0811", "0812", "0813", "0814", "0815", "0816", "0817", "0818", "0903", "0905", "0906", "0907", "0908", "0909", "0701", "0702", "0703", "0704", "0705", "0706"])
    return prefix + "".join([str(random.randint(0, 9)) for _ in range(7)])

def rand_bvn() -> str:
    return "22" + "".join([str(random.randint(0, 9)) for _ in range(9)])

def rand_nin() -> str:
    return "".join([str(random.randint(0, 9)) for _ in range(11)])

def rand_nuban() -> str:
    return "".join([str(random.randint(0, 9)) for _ in range(10)])

def rand_name() -> Tuple[str, str, str]:
    if random.random() < 0.5:
        first = random.choice(NIGERIAN_FIRST_NAMES_M)
        gender = "male"
    else:
        first = random.choice(NIGERIAN_FIRST_NAMES_F)
        gender = "female"
    last = random.choice(NIGERIAN_LAST_NAMES)
    return first, last, gender

def rand_state_city() -> Tuple[str, str]:
    state = random.choice(list(NIGERIAN_CITIES.keys()))
    city = random.choice(NIGERIAN_CITIES[state])
    return state, city

def esc(s: str) -> str:
    """Escape single quotes for SQL."""
    return str(s).replace("'", "''")

def json_str(obj: Any) -> str:
    return esc(json.dumps(obj, ensure_ascii=False))

def money(low: float = 1000, high: float = 50000000) -> float:
    return round(random.uniform(low, high), 2)

def rate(low: float = 3.0, high: float = 28.0) -> float:
    return round(random.uniform(low, high), 2)

# ─── Entity Pools (populated during generation, used for FK references) ──────

tenants: List[Dict] = []
users_list: List[Dict] = []
customers_list: List[Dict] = []
accounts_list: List[Dict] = []
loans_list: List[Dict] = []
transactions_list: List[Dict] = []
transfers_list: List[Dict] = []
cards_list: List[Dict] = []
agents_list: List[Dict] = []
farmers_list: List[Dict] = []
gl_accounts: List[Dict] = []
kyc_list: List[Dict] = []
aml_list: List[Dict] = []
journal_entries: List[Dict] = []
settlements_list: List[Dict] = []
fx_trades_list: List[Dict] = []
nostro_list: List[Dict] = []
billing_accounts: List[Dict] = []
tb_account_ids: List[int] = []  # TigerBeetle

# ─── SQL Output Buffer ──────────────────────────────────────────────────────

sql_lines: List[str] = []

def emit(line: str):
    sql_lines.append(line)

def emit_comment(text: str):
    emit(f"\n-- {'═' * 75}")
    emit(f"-- {text}")
    emit(f"-- {'═' * 75}\n")

# ─── 1. Tenants ─────────────────────────────────────────────────────────────

def gen_tenants():
    emit_comment("TENANTS — Multi-tenant bank instances")
    tenant_defs = [
        ("tenant-lagos-main", "54Bank Lagos", "enterprise", "Lagos", ["core_banking","lending","payments","cards","fx","aml","kyc","agents","kpi","graph","ai"]),
        ("tenant-abuja-digital", "54Bank Abuja Digital", "enterprise", "Abuja FCT", ["core_banking","lending","payments","cards","fx","aml","kyc","kpi"]),
        ("tenant-kano-north", "54Bank Kano North", "professional", "Kano", ["core_banking","lending","payments","aml","kyc","agents"]),
        ("tenant-portharcourt", "54Bank Port Harcourt", "professional", "Rivers", ["core_banking","lending","payments","cards","aml","kyc"]),
        ("tenant-whitelabel-zenith", "ZenithPay (White Label)", "white_label", "Lagos", ["core_banking","payments","cards","kyc","kpi"]),
    ]
    rows = []
    for tid, name, seg, region, modules in tenant_defs:
        wl = {
            "displayName": name,
            "legalEntity": f"{name} Financial Services Ltd",
            "supportEmail": f"support@{name.lower().replace(' ','')}.ng",
            "primaryColor": f"#{random.randint(0,0xFFFFFF):06x}",
            "accentColor": f"#{random.randint(0,0xFFFFFF):06x}",
            "logoUrl": f"https://cdn.54bank.ng/logos/{tid}.png",
            "loginHeadline": f"Welcome to {name}",
        }
        if seg == "white_label":
            wl["customDomain"] = "pay.zenithbank.com"
        t = {"tenantId": tid, "name": name, "segment": seg, "region": region, "modules": modules, "whiteLabel": wl}
        tenants.append(t)
        rows.append(f"  ('{tid}', '{esc(name)}', 'active', '{seg}', '{region}', '{json_str(modules)}'::jsonb, '{json_str(wl)}'::jsonb, '{ts(rand_date())}', '{ts(NOW)}')")
    emit(f'INSERT INTO "tenants" ("tenantId", "name", "onboardingStatus", "segment", "region", "enabledModules", "whiteLabel", "createdAt", "updatedAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 2. Users ────────────────────────────────────────────────────────────────

def gen_users():
    emit_comment("USERS — Platform operators & staff")
    roles = ["admin", "operator", "compliance", "treasury", "credit", "teller", "auditor", "user"]
    rows = []
    for i in range(NUM_USERS):
        first, last, _ = rand_name()
        oid = f"auth0|{uuid.uuid4().hex[:24]}"
        name = f"{first} {last}"
        email = f"{first.lower()}.{last.lower()}@54bank.ng"
        role = roles[i % len(roles)]
        u = {"openId": oid, "name": name, "email": email, "role": role}
        users_list.append(u)
        rows.append(f"  ('{oid}', '{esc(name)}', '{email}', 'sso', '{role}', '{ts(rand_date())}', '{ts(NOW)}', '{ts(rand_date())}')")
    emit(f'INSERT INTO "users" ("openId", "name", "email", "loginMethod", "role", "createdAt", "updatedAt", "lastSignedIn") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 3. Customers ───────────────────────────────────────────────────────────

def gen_customers():
    emit_comment("CUSTOMERS — Bank customers (200 individuals)")
    segments = ["retail", "sme", "corporate", "high_net_worth", "mass_market"]
    tiers = ["tier1", "tier2", "tier3"]
    risks = ["low", "medium", "high"]
    statuses = ["active", "active", "active", "active", "dormant", "blocked", "pending_kyc"]
    touchpoints = ["Branch visit", "Mobile app login", "USSD transaction", "WhatsApp inquiry", "Call center", "ATM withdrawal", "POS purchase", "Internet banking"]
    rows = []
    for t in tenants:
        rms = [u["name"] for u in users_list if u["role"] in ("operator", "admin")]
        for i in range(NUM_CUSTOMERS_PER_TENANT):
            first, last, gender = rand_name()
            cid = uid("CUST")
            state, city = rand_state_city()
            c = {
                "customerId": cid,
                "tenantId": t["tenantId"],
                "name": f"{first} {last}",
                "segment": random.choice(segments),
                "tier": random.choice(tiers),
                "location": f"{city}, {state}",
                "rm": random.choice(rms),
                "risk": random.choice(risks),
                "status": random.choice(statuses),
                "bvn": rand_bvn(),
                "phone": rand_phone(),
                "balance": money(5000, 100000000),
                "gender": gender,
                "state": state,
                "city": city,
            }
            customers_list.append(c)
            tp = random.choice(touchpoints)
            rows.append(f"  ('{cid}', '{t['tenantId']}', '{esc(c['name'])}', '{c['segment']}', '{c['tier']}', '{esc(c['location'])}', '{esc(c['rm'])}', '{c['risk']}', '{c['status']}', '{c['bvn']}', '{c['phone']}', {c['balance']}, '{esc(tp)}', '{ts(rand_date())}', '{ts(rand_date())}', '{ts(NOW)}')")
    emit(f'INSERT INTO "customers" ("customerId", "tenantId", "name", "segment", "tier", "location", "relationshipManager", "risk", "status", "bvn", "phone", "balance", "lastTouchpointLabel", "lastTouchpointAt", "createdAt", "updatedAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 4. Accounts ─────────────────────────────────────────────────────────────

def gen_accounts():
    emit_comment("ACCOUNTS — Customer bank accounts (~400)")
    acct_types = ["savings", "current", "domiciliary", "fixed_deposit", "corporate"]
    currencies = ["NGN", "NGN", "NGN", "NGN", "USD", "EUR", "GBP"]
    rows = []
    tb_id = 1000
    for c in customers_list:
        n_accts = random.randint(1, 3)
        for j in range(n_accts):
            aid = uid("ACCT")
            atype = random.choice(acct_types)
            curr = "NGN" if atype != "domiciliary" else random.choice(["USD", "EUR", "GBP"])
            bal = money(0, 50000000) if curr == "NGN" else money(0, 500000)
            avail = round(bal * random.uniform(0.85, 1.0), 2)
            ledger = round(bal + random.uniform(0, 100000), 2)
            tb_id += 1
            a = {
                "accountId": aid,
                "customerId": c["customerId"],
                "tenantId": c["tenantId"],
                "name": f"{c['name']} - {atype.replace('_',' ').title()}",
                "type": atype,
                "currency": curr,
                "balance": bal,
                "available": avail,
                "ledger": ledger,
                "branch": random.choice(BRANCH_CODES),
                "tbId": f"TB-{tb_id}",
            }
            accounts_list.append(a)
            tb_account_ids.append(tb_id)
            rows.append(f"  ('{aid}', '{c['customerId']}', '{c['tenantId']}', '{esc(a['name'])}', '{atype}', '{curr}', {bal}, {avail}, {ledger}, 'active', '{a['branch']}', '{ts(rand_date())}', '{ts(rand_date())}', 1, '{a['tbId']}', '{ts(rand_date())}', '{ts(NOW)}')")
    emit(f'INSERT INTO "accounts" ("accountId", "customerId", "tenantId", "accountName", "accountType", "currency", "balance", "availableBalance", "ledgerBalance", "status", "branchCode", "openedAt", "lastTransactionAt", "version", "tigerbeetleAccountId", "createdAt", "updatedAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 5. Transactions ─────────────────────────────────────────────────────────

def gen_transactions():
    emit_comment("TRANSACTIONS — 2000 realistic banking transactions")
    tx_types = ["credit", "debit", "transfer", "fee", "interest", "reversal"]
    channels = ["mobile", "web", "ussd", "pos", "atm", "branch", "nip", "rtgs"]
    narrations_credit = [
        "Salary payment from {company}", "Transfer from {name}",
        "Dividend credit", "Refund - {merchant}", "Interest credit",
        "CBN disbursement", "Loan disbursement", "Insurance claim payout",
    ]
    narrations_debit = [
        "POS purchase at {merchant}", "ATM withdrawal - {city}",
        "Airtime purchase - {telco}", "DSTV subscription",
        "Transfer to {name}", "Bill payment - {utility}",
        "School fees - {school}", "Rent payment",
    ]
    merchants = ["Shoprite Ikeja", "SPAR Lekki", "Chicken Republic VI", "Dominos Wuse", "Filmhouse Surulere", "Total Filling Station", "Oando Petrol"]
    telcos = ["MTN", "Glo", "Airtel", "9mobile"]
    utilities = ["PHCN Ikeja", "LAWMA", "Lagos Water Corp", "EEDC Enugu"]
    schools = ["University of Lagos", "Covenant University", "UNILAG", "OAU Ife", "ABU Zaria"]
    rows = []
    for i in range(NUM_TRANSACTIONS):
        acct = random.choice(accounts_list)
        ttype = random.choice(tx_types)
        ch = random.choice(channels)
        amt = money(100, 5000000)
        txid = uid("TXN")
        ref = f"REF-{uuid.uuid4().hex[:16].upper()}"
        cp_name = random.choice(customers_list)["name"]
        company = random.choice(NIGERIAN_COMPANIES)
        if ttype in ("credit", "interest"):
            narr = random.choice(narrations_credit).format(company=company, name=cp_name, merchant=random.choice(merchants))
        else:
            narr = random.choice(narrations_debit).format(merchant=random.choice(merchants), city=random.choice(["Ikeja","Lekki","Wuse","Garki","Kano"]), telco=random.choice(telcos), name=cp_name, utility=random.choice(utilities), school=random.choice(schools))
        bal_after = round(acct["balance"] + (amt if ttype == "credit" else -amt), 2)
        td = rand_date()
        cp_acct = random.choice(accounts_list)
        tx = {"txId": txid, "accountId": acct["accountId"], "tenantId": acct["tenantId"], "type": ttype, "amount": amt, "ref": ref, "date": td}
        transactions_list.append(tx)
        rows.append(f"  ('{txid}', '{acct['accountId']}', '{acct['tenantId']}', '{ttype}', {amt}, '{acct['currency']}', '{esc(narr)}', '{ref}', '{ch}', '{cp_acct['accountId']}', '{esc(cp_name)}', {bal_after}, 'completed', '{ts(td)}', '{ts(td)}')")
    emit(f'INSERT INTO "transactions" ("transactionId", "accountId", "tenantId", "type", "amount", "currency", "narration", "reference", "channel", "counterpartyAccountId", "counterpartyName", "balanceAfter", "status", "valueDate", "createdAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 6. GL Accounts (Chart of Accounts) ─────────────────────────────────────
# (Already seeded via seed-gl-coa.sql, but we reference them)

def gen_gl_accounts_ref():
    """Build in-memory GL list for journal entries without re-inserting."""
    codes = [
        ("1001", "asset", "Cash in Vault - Local Currency"),
        ("1005", "asset", "CRR with CBN"),
        ("1006", "asset", "Current Account with CBN"),
        ("1101", "asset", "Nostro Accounts - USD"),
        ("1201", "asset", "Treasury Bills"),
        ("1301", "asset", "Overdrafts - Corporate"),
        ("1302", "asset", "Term Loans - Corporate"),
        ("1306", "asset", "SME Loans"),
        ("1310", "asset", "Personal Loans"),
        ("1315", "asset", "Mortgage Loans"),
        ("1401", "asset", "Fixed Assets - Land"),
        ("2001", "liability", "Demand Deposits - Individual"),
        ("2002", "liability", "Demand Deposits - Corporate"),
        ("2101", "liability", "Savings Deposits"),
        ("2201", "liability", "Time Deposits"),
        ("2301", "liability", "Interbank Borrowings"),
        ("3001", "equity", "Share Capital"),
        ("3101", "equity", "Retained Earnings"),
        ("4001", "income", "Interest Income - Loans"),
        ("4101", "income", "Fee Income - Transfers"),
        ("4201", "income", "FX Trading Income"),
        ("5001", "expense", "Interest Expense - Deposits"),
        ("5101", "expense", "Staff Costs"),
        ("5201", "expense", "Occupancy Costs"),
        ("5301", "expense", "Technology Costs"),
        ("6001", "provision", "Loan Loss Provisions"),
    ]
    for code, cat, name in codes:
        gl_accounts.append({"code": code, "category": cat, "name": name})

# ─── 7. Journal Entries ──────────────────────────────────────────────────────

def gen_journal_entries():
    emit_comment("JOURNAL ENTRIES — Double-entry GL postings")
    rows = []
    batch_id = None
    for i in range(NUM_JOURNAL_ENTRIES):
        if i % 2 == 0:
            batch_id = uid("BATCH")
        tx = random.choice(transactions_list)
        gl = random.choice(gl_accounts)
        jtype = "debit" if i % 2 == 0 else "credit"
        amt = money(100, 5000000)
        eid = uid("JE")
        td = tx["date"]
        rows.append(f"  ('{eid}', '{tx['tenantId']}', '{tx['accountId']}', '{gl['code']}', '{jtype}', {amt}, 'NGN', '{esc(gl['name'])} - {jtype}', '{tx['ref']}', '{batch_id}', NULL, '{ts(td)}', '{ts(td)}', '{ts(td)}')")
    emit(f'INSERT INTO "journalEntries" ("entryId", "tenantId", "accountId", "glAccountCode", "type", "amount", "currency", "narration", "transactionRef", "batchId", "reversalOf", "postingDate", "valueDate", "createdAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 8. Loans ────────────────────────────────────────────────────────────────

def gen_loans():
    emit_comment("LOANS — 120 loan facilities")
    loan_types = ["term_loan", "overdraft", "mortgage", "personal", "sme", "agricultural", "trade_finance", "lpo_finance"]
    statuses = ["active", "active", "active", "fully_paid", "default", "restructured", "pending", "disbursed"]
    ifrs9 = ["stage1", "stage1", "stage1", "stage2", "stage3"]
    rows = []
    for i in range(NUM_LOANS):
        c = random.choice(customers_list)
        lid = uid("LOAN")
        ltype = random.choice(loan_types)
        principal = money(100000, 500000000)
        outstanding = round(principal * random.uniform(0.1, 1.0), 2)
        ir = rate(5, 28)
        tenor = random.choice([3, 6, 12, 18, 24, 36, 48, 60])
        disb = rand_date()
        mat = disb + timedelta(days=tenor * 30)
        nxt_pay = rand_date(disb, mat) if mat > disb else disb + timedelta(days=30)
        nxt_amt = round(principal / tenor * 1.1, 2) if tenor > 0 else 0
        status = random.choice(statuses)
        clas = random.choice(ifrs9)
        collateral = round(principal * random.uniform(0.5, 2.0), 2) if ltype != "personal" else None
        approver = random.choice(users_list)["name"]
        l = {"loanId": lid, "customerId": c["customerId"], "tenantId": c["tenantId"], "type": ltype, "principal": principal, "outstanding": outstanding, "rate": ir, "tenor": tenor, "disbDate": disb, "matDate": mat, "status": status}
        loans_list.append(l)
        coll_str = str(collateral) if collateral else "NULL"
        rows.append(f"  ('{lid}', '{c['customerId']}', '{c['tenantId']}', '{ltype}', {principal}, {outstanding}, {ir}, 'NGN', {tenor}, 'months', '{ts(disb)}', '{ts(mat)}', '{ts(nxt_pay)}', {nxt_amt}, '{status}', '{clas}', {coll_str}, '{esc(approver)}', '{ts(disb)}', '{ts(NOW)}')")
    emit(f'INSERT INTO "loans" ("loanId", "customerId", "tenantId", "loanType", "principalAmount", "outstandingBalance", "interestRate", "currency", "tenor", "tenorUnit", "disbursementDate", "maturityDate", "nextPaymentDate", "nextPaymentAmount", "status", "classificationIFRS9", "collateralValue", "approvedBy", "createdAt", "updatedAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 9. Loan Repayments ──────────────────────────────────────────────────────

def gen_loan_repayments():
    emit_comment("LOAN REPAYMENTS — Scheduled & actual repayments")
    rows = []
    for i in range(NUM_LOAN_REPAYMENTS):
        loan = random.choice(loans_list)
        rid = uid("RPMT")
        principal_p = money(10000, 5000000)
        interest_p = round(principal_p * random.uniform(0.05, 0.15), 2)
        penalty_p = round(random.uniform(0, 5000), 2) if random.random() < 0.2 else 0
        total = round(principal_p + interest_p + penalty_p, 2)
        due = rand_date(loan["disbDate"], loan["matDate"]) if loan["matDate"] > loan["disbDate"] else rand_date()
        paid = due + timedelta(days=random.randint(-5, 30)) if random.random() < 0.7 else None
        status = "paid" if paid else random.choice(["scheduled", "overdue", "partial"])
        paid_str = f"'{ts(paid)}'" if paid else "NULL"
        tref = random.choice(transactions_list)["ref"] if paid else None
        tref_str = f"'{tref}'" if tref else "NULL"
        rows.append(f"  ('{rid}', '{loan['loanId']}', '{loan['tenantId']}', {principal_p}, {interest_p}, {penalty_p}, {total}, '{ts(due)}', {paid_str}, '{status}', {tref_str}, '{ts(due)}')")
    emit(f'INSERT INTO "loanRepayments" ("repaymentId", "loanId", "tenantId", "principalPortion", "interestPortion", "penaltyPortion", "totalAmount", "dueDate", "paidDate", "status", "transactionRef", "createdAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 10. Transfers ───────────────────────────────────────────────────────────

def gen_transfers():
    emit_comment("TRANSFERS — Inter/Intra bank transfers")
    channels = ["nip", "rtgs", "internal", "mojaloop", "swift"]
    rows = []
    for i in range(NUM_TRANSFERS):
        src = random.choice(accounts_list)
        dst = random.choice(accounts_list)
        tid = uid("TRF")
        amt = money(500, 10000000)
        ch = random.choice(channels)
        bank_code, bank_name = random.choice(NIGERIAN_BANKS)
        narr = f"Transfer to {dst['name']}" if ch == "internal" else f"NIP transfer to {bank_name}"
        nip_sess = uid("NIP") if ch == "nip" else None
        moja_id = uid("MOJA") if ch == "mojaloop" else None
        status = random.choice(["completed", "completed", "completed", "pending", "failed"])
        td = rand_date()
        idem = f"IDEM-{uuid.uuid4().hex[:16].upper()}"
        t = {"transferId": tid, "src": src["accountId"], "dst": dst["accountId"], "tenantId": src["tenantId"], "amount": amt, "date": td}
        transfers_list.append(t)
        nip_str = f"'{nip_sess}'" if nip_sess else "NULL"
        moja_str = f"'{moja_id}'" if moja_id else "NULL"
        comp = f"'{ts(td + timedelta(seconds=random.randint(1,300)))}'" if status == "completed" else "NULL"
        rows.append(f"  ('{tid}', '{src['tenantId']}', '{src['accountId']}', '{dst['accountId']}', '{bank_code}', '{rand_nuban()}', '{esc(dst['name'])}', {amt}, 'NGN', '{ch}', '{esc(narr)}', {nip_str}, {moja_str}, '{status}', NULL, '{idem}', '{ts(td)}', {comp}, '{ts(td)}')")
    emit(f'INSERT INTO "transfers" ("transferId", "tenantId", "sourceAccountId", "destinationAccountId", "destinationBank", "destinationAccountNumber", "beneficiaryName", "amount", "currency", "channel", "narration", "nipSessionId", "mojaloopTransferId", "status", "failureReason", "idempotencyKey", "transferDate", "completedAt", "createdAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 11. KYC Verifications ──────────────────────────────────────────────────

def gen_kyc():
    emit_comment("KYC VERIFICATIONS — Identity verification records")
    vtypes = ["bvn", "nin", "passport", "drivers_license", "voters_card", "utility_bill", "liveness", "address_verification"]
    providers = ["NIBSS", "NIMC", "Smile Identity", "Youverify", "Prembly", "Dojah", "VerifyMe"]
    rows = []
    for i in range(NUM_KYC_VERIFICATIONS):
        c = random.choice(customers_list)
        vid = uid("KYC")
        vtype = random.choice(vtypes)
        prov = random.choice(providers)
        score = round(random.uniform(0.5, 1.0), 4) if random.random() < 0.85 else round(random.uniform(0.1, 0.5), 4)
        status = "verified" if score > 0.7 else random.choice(["pending", "failed", "expired"])
        doc_ref = f"DOC-{uuid.uuid4().hex[:10].upper()}" if vtype not in ("liveness", "bvn") else None
        vdate = rand_date()
        expires = vdate + timedelta(days=365*2) if status == "verified" else None
        resp = {"match": score > 0.7, "score": score, "provider_ref": f"PROV-{uuid.uuid4().hex[:8]}"}
        k = {"verificationId": vid, "customerId": c["customerId"], "tenantId": c["tenantId"], "type": vtype, "status": status}
        kyc_list.append(k)
        doc_str = f"'{doc_ref}'" if doc_ref else "NULL"
        vdate_str = f"'{ts(vdate)}'" if status == "verified" else "NULL"
        exp_str = f"'{ts(expires)}'" if expires else "NULL"
        rows.append(f"  ('{vid}', '{c['customerId']}', '{c['tenantId']}', '{vtype}', {doc_str}, '{prov}', '{json_str(resp)}'::jsonb, {score}, '{status}', {vdate_str}, {exp_str}, '{ts(vdate)}')")
    emit(f'INSERT INTO "kycVerifications" ("verificationId", "customerId", "tenantId", "verificationType", "documentReference", "provider", "providerResponse", "matchScore", "status", "verifiedAt", "expiresAt", "createdAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 12. AML Alerts ─────────────────────────────────────────────────────────

def gen_aml_alerts():
    emit_comment("AML ALERTS — Anti-Money Laundering detections")
    rules = [
        ("AML-R001", "Structuring Detection"), ("AML-R002", "Large Cash Transaction"),
        ("AML-R003", "Rapid Movement of Funds"), ("AML-R004", "Round Amount Pattern"),
        ("AML-R005", "Unusual Counterparty"), ("AML-R006", "High-Risk Jurisdiction"),
        ("AML-R007", "Dormant Account Reactivation"), ("AML-R008", "PEP Transaction"),
    ]
    severities = ["low", "medium", "high", "critical"]
    rows = []
    for i in range(NUM_AML_ALERTS):
        c = random.choice(customers_list)
        tx = random.choice(transactions_list)
        aid = uid("AML")
        rule_id, rule_name = random.choice(rules)
        risk = round(random.uniform(20, 99), 2)
        sev = "critical" if risk > 80 else "high" if risk > 60 else "medium" if risk > 40 else "low"
        status = random.choice(["pending", "investigating", "escalated", "closed_true_positive", "closed_false_positive"])
        assignee = random.choice([u["name"] for u in users_list if u["role"] == "compliance"]) if users_list else "Compliance Team"
        detected = rand_date()
        resolved = detected + timedelta(days=random.randint(1, 30)) if "closed" in status else None
        notes = f"Transaction {tx['txId']} flagged by {rule_name}. Customer: {c['name']}."
        a = {"alertId": aid, "customerId": c["customerId"], "tenantId": c["tenantId"]}
        aml_list.append(a)
        resolved_str = f"'{ts(resolved)}'" if resolved else "NULL"
        rows.append(f"  ('{aid}', '{c['tenantId']}', '{c['customerId']}', 'transaction', '{tx['txId']}', '{rule_id}', '{rule_name}', {risk}, '{sev}', '{status}', '{esc(assignee)}', '{esc(notes)}', '{ts(detected)}', {resolved_str}, '{ts(detected)}')")
    emit(f'INSERT INTO "amlAlerts" ("alertId", "tenantId", "customerId", "entityType", "entityId", "ruleId", "ruleName", "riskScore", "severity", "status", "assignedTo", "notes", "detectedAt", "resolvedAt", "createdAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 13. FX Trades ──────────────────────────────────────────────────────────

def gen_fx_trades():
    emit_comment("FX TRADES — Foreign exchange transactions")
    fx_pairs = [("NGN", "USD", 1550, 1620), ("NGN", "GBP", 1950, 2050), ("NGN", "EUR", 1680, 1760), ("USD", "GBP", 1.25, 1.30), ("USD", "EUR", 1.08, 1.12)]
    trade_types = ["spot", "forward", "swap"]
    rows = []
    for i in range(NUM_FX_TRADES):
        sell_curr, buy_curr, rate_lo, rate_hi = random.choice(fx_pairs)
        fxrate = round(random.uniform(rate_lo, rate_hi), 4)
        sell_amt = money(10000, 50000000)
        buy_amt = round(sell_amt / fxrate, 2) if fxrate > 100 else round(sell_amt * fxrate, 2)
        tid = uid("FX")
        tenant = random.choice(tenants)
        ttype = random.choice(trade_types)
        cp = random.choice(NIGERIAN_COMPANIES)
        trader = random.choice(users_list)["name"]
        approver = random.choice(users_list)["name"]
        vdate = rand_date()
        status = random.choice(["executed", "executed", "settled", "pending", "cancelled"])
        f = {"tradeId": tid, "tenantId": tenant["tenantId"]}
        fx_trades_list.append(f)
        rows.append(f"  ('{tid}', '{tenant['tenantId']}', '{buy_curr}', '{sell_curr}', {buy_amt}, {sell_amt}, {fxrate}, '{ttype}', '{esc(cp)}', '{ts(vdate)}', '{status}', '{esc(trader)}', '{esc(approver)}', '{ts(vdate)}')")
    emit(f'INSERT INTO "fxTrades" ("tradeId", "tenantId", "buyCurrency", "sellCurrency", "buyAmount", "sellAmount", "exchangeRate", "tradeType", "counterparty", "valueDate", "status", "traderId", "approvedBy", "createdAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 14. Nostro Accounts ────────────────────────────────────────────────────

def gen_nostro():
    emit_comment("NOSTRO ACCOUNTS — Correspondent banking")
    rows = []
    for bank_name, curr, acct_num, swift in CORRESPONDENT_BANKS:
        nid = uid("NOSTR")
        tenant = tenants[0]
        bal = money(1000000, 200000000) if curr == "USD" else money(500000, 50000000)
        n = {"nostroId": nid, "tenantId": tenant["tenantId"], "currency": curr}
        nostro_list.append(n)
        rows.append(f"  ('{nid}', '{tenant['tenantId']}', '{esc(bank_name)}', '{curr}', '{acct_num}', '{swift}', {bal}, '{ts(rand_date())}', 'active', '{ts(rand_date())}', '{ts(NOW)}')")
    emit(f'INSERT INTO "nostroAccounts" ("nostroId", "tenantId", "correspondentBank", "currency", "accountNumber", "swiftCode", "balance", "lastReconciledAt", "status", "createdAt", "updatedAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 15. Settlements ─────────────────────────────────────────────────────────

def gen_settlements():
    emit_comment("SETTLEMENTS — Settlement windows")
    models = ["deferred_net", "real_time_gross", "bilateral", "multilateral"]
    rows = []
    for i in range(NUM_SETTLEMENTS):
        sid = uid("STLMT")
        tenant = random.choice(tenants)
        wid = uid("WIN")
        model = random.choice(models)
        n_transfers = random.randint(10, 200)
        total_d = money(1000000, 500000000)
        total_c = round(total_d * random.uniform(0.95, 1.05), 2)
        net = round(total_d - total_c, 2)
        n_parts = random.randint(2, 20)
        opened = rand_date()
        status = random.choice(["settled", "settled", "settled", "open", "closed"])
        closed = opened + timedelta(hours=random.randint(1, 24)) if status != "open" else None
        settled = closed + timedelta(hours=1) if status == "settled" and closed else None
        s = {"settlementId": sid, "tenantId": tenant["tenantId"]}
        settlements_list.append(s)
        closed_str = f"'{ts(closed)}'" if closed else "NULL"
        settled_str = f"'{ts(settled)}'" if settled else "NULL"
        rows.append(f"  ('{sid}', '{tenant['tenantId']}', '{wid}', '{model}', 'NGN-NIP', {total_d}, {total_c}, {net}, 'NGN', {n_parts}, {n_transfers}, '{status}', '{ts(opened)}', {closed_str}, {settled_str}, '{ts(opened)}')")
    emit(f'INSERT INTO "settlements" ("settlementId", "tenantId", "windowId", "model", "corridor", "totalDebits", "totalCredits", "netPosition", "currency", "participantCount", "transferCount", "status", "openedAt", "closedAt", "settledAt", "createdAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 16. SWIFT Messages ─────────────────────────────────────────────────────

def gen_swift():
    emit_comment("SWIFT MESSAGES — International messaging")
    msg_types = ["MT103", "MT202", "MT199", "MT950", "MT940", "MT300"]
    rows = []
    for i in range(NUM_SWIFT_MESSAGES):
        mid = uid("SWIFT")
        tenant = tenants[0]
        mtype = random.choice(msg_types)
        direction = random.choice(["inward", "outward"])
        sender = random.choice(SWAP_BICS)
        receiver = random.choice(CORRESPONDENT_BANKS)[3]
        amt = money(50000, 100000000)
        vdate = rand_date()
        status = random.choice(["received", "processed", "acknowledged", "rejected"])
        raw = f"{{1:F01{sender}0000000000}}{{2:O{mtype[2:]}1200{receiver}N}}{{4:\\n:20:REF{uuid.uuid4().hex[:8]}\\n:32A:{vdate.strftime('%y%m%d')}NGN{amt}\\n-}}"
        trf = random.choice(transfers_list)["transferId"] if transfers_list else None
        trf_str = f"'{trf}'" if trf else "NULL"
        rows.append(f"  ('{mid}', '{tenant['tenantId']}', '{mtype}', '{direction}', '{sender}', '{receiver}', {amt}, 'NGN', '{ts(vdate)}', '{esc(raw)}', '{status}', {trf_str}, '{ts(vdate)}')")
    emit(f'INSERT INTO "swiftMessages" ("messageId", "tenantId", "messageType", "direction", "senderBic", "receiverBic", "amount", "currency", "valueDate", "rawMessage", "status", "relatedTransferId", "createdAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 17. NIP Transactions ───────────────────────────────────────────────────

def gen_nip():
    emit_comment("NIP TRANSACTIONS — NIBSS Instant Payment transfers")
    rows = []
    for i in range(NUM_NIP_TRANSACTIONS):
        nid = uid("NIP")
        tenant = random.choice(tenants)
        sess = uid("SESS")
        direction = random.choice(["inward", "outward"])
        src_bank, _ = random.choice(NIGERIAN_BANKS)
        dst_bank, _ = random.choice(NIGERIAN_BANKS)
        src_acct = rand_nuban()
        dst_acct = rand_nuban()
        amt = money(100, 10000000)
        c = random.choice(customers_list)
        narr = f"NIP transfer - {c['name']}"
        resp_code = random.choice(["00", "00", "00", "00", "51", "06", "12"])
        status = "completed" if resp_code == "00" else "failed"
        td = rand_date()
        comp = f"'{ts(td + timedelta(seconds=random.randint(1, 30)))}'" if status == "completed" else "NULL"
        rows.append(f"  ('{nid}', '{tenant['tenantId']}', '{sess}', '{direction}', '{src_bank}', '{dst_bank}', '{src_acct}', '{dst_acct}', {amt}, '{esc(narr)}', '{resp_code}', '{status}', {comp}, '{ts(td)}')")
    emit(f'INSERT INTO "nipTransactions" ("nipId", "tenantId", "sessionId", "direction", "sourceBank", "destinationBank", "sourceAccount", "destinationAccount", "amount", "narration", "responseCode", "status", "completedAt", "createdAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 18. Card Transactions ──────────────────────────────────────────────────

def gen_card_transactions():
    emit_comment("CARD TRANSACTIONS — POS, ATM, Online card activity")
    rows = []
    # First generate some cards
    emit_comment("CUSTOMER CARDS — Debit & credit cards")
    card_rows = []
    for c in customers_list[:80]:
        n_cards = random.randint(1, 2)
        for _ in range(n_cards):
            crd_id = uid("CARD")
            ctype = random.choice(["debit", "credit", "prepaid"])
            brand = random.choice(["Verve", "Mastercard", "Visa"])
            last4 = f"{random.randint(1000,9999)}"
            exp = f"{random.randint(1,12):02d}/{random.randint(27,30)}"
            bal = money(0, 5000000) if ctype == "credit" else 0
            controls = {"online": True, "atm": True, "international": random.random() < 0.3}
            limits = {"daily": random.choice([50000, 100000, 200000, 500000]), "atm": random.choice([20000, 50000, 100000]), "online": random.choice([50000, 100000, 200000])}
            color = random.choice(["midnight_blue", "forest_green", "charcoal", "royal_purple", "crimson"])
            card = {"cardId": crd_id, "customerId": c["customerId"], "type": ctype, "brand": brand}
            cards_list.append(card)
            card_rows.append(f"  ('{crd_id}', '{c['customerId']}', '{ctype}', '{brand}', '{last4}', '{exp}', '{esc(c['name'])}', {bal}, 0, '{json_str(controls)}'::jsonb, '{json_str(limits)}'::jsonb, '{color}', '{ts(NOW)}', '{ts(rand_date())}')")
    emit(f'INSERT INTO "customerCards" ("cardId", "customerId", "cardType", "brand", "lastFour", "expiryDate", "cardHolder", "balance", "isLocked", "controls", "spendingLimits", "colorTone", "updatedAt", "createdAt") VALUES')
    emit(",\n".join(card_rows))
    emit("ON CONFLICT DO NOTHING;\n")

    # Now card transactions
    for i in range(NUM_CARD_TRANSACTIONS):
        if not cards_list:
            break
        card = random.choice(cards_list)
        acct = next((a for a in accounts_list if a["customerId"] == card["customerId"]), random.choice(accounts_list))
        ctid = uid("CTXN")
        mcc, mcat_name = random.choice(MERCHANT_CATEGORIES)
        merchant = f"{mcat_name} - {random.choice(['Ikeja Mall', 'Palms Lekki', 'Jabi Lake Mall', 'Alausa', 'Wuse Market', 'Port Harcourt Mall'])}"
        amt = money(200, 500000)
        ttype = random.choice(["purchase", "purchase", "purchase", "withdrawal", "refund"])
        ch = random.choice(["pos", "atm", "online", "contactless"])
        auth = f"{random.randint(100000,999999)}"
        stan = f"{random.randint(100000,999999)}"
        rrn = f"{random.randint(100000000000, 999999999999)}"
        status = random.choice(["approved", "approved", "approved", "declined"])
        decline = None if status == "approved" else random.choice(["insufficient_funds", "card_blocked", "expired_card", "invalid_pin"])
        decline_str = f"'{decline}'" if decline else "NULL"
        td = rand_date()
        rows.append(f"  ('{ctid}', '{acct['tenantId']}', '{card['cardId']}', '{acct['accountId']}', '{esc(merchant)}', '{mcc}', {amt}, 'NGN', '{ttype}', '{ch}', '{auth}', '{stan}', '{rrn}', '{status}', {decline_str}, '{ts(td)}')")
    emit(f'INSERT INTO "cardTransactions" ("cardTxnId", "tenantId", "cardId", "accountId", "merchantName", "merchantCategory", "amount", "currency", "type", "channel", "authorizationCode", "stan", "rrn", "status", "declineReason", "createdAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 19. Audit Trail ─────────────────────────────────────────────────────────

def gen_audit_trail():
    emit_comment("AUDIT TRAIL — System-wide activity log")
    entity_types = ["account", "transaction", "loan", "customer", "transfer", "kyc", "aml_alert", "fx_trade", "card", "user"]
    actions = ["create", "update", "approve", "reject", "view", "export", "delete", "lock", "unlock", "escalate"]
    ips = ["10.0.1.15", "10.0.1.22", "10.0.2.8", "10.0.3.45", "192.168.1.100", "172.16.0.50"]
    uas = ["Mozilla/5.0 (Windows NT 10.0)", "Mozilla/5.0 (Macintosh)", "54Bank-Mobile/3.2.1 (Android)", "54Bank-Mobile/3.2.1 (iOS)", "54Bank-API/1.0"]
    rows = []
    for i in range(NUM_AUDIT_TRAIL):
        aid = uid("AUDIT")
        tenant = random.choice(tenants)
        etype = random.choice(entity_types)
        eid = uid(etype[:4].upper())
        action = random.choice(actions)
        actor = random.choice(users_list)
        changes = {"field": random.choice(["status", "balance", "risk", "tier"]), "old": "previous_value", "new": "new_value"}
        td = rand_date()
        rows.append(f"  ('{aid}', '{tenant['tenantId']}', '{etype}', '{eid}', '{action}', '{actor['openId']}', '{actor['role']}', '{json_str(changes)}'::jsonb, '{random.choice(ips)}', '{random.choice(uas)}', '{ts(td)}')")
    emit(f'INSERT INTO "auditTrail" ("auditId", "tenantId", "entityType", "entityId", "action", "actorId", "actorRole", "changes", "ipAddress", "userAgent", "createdAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 20. Trial Balances ─────────────────────────────────────────────────────

def gen_trial_balances():
    emit_comment("TRIAL BALANCES — Monthly GL trial balance snapshots")
    rows = []
    for month in range(1, 13):
        for gl in gl_accounts:
            tbid = uid("TB")
            tenant = tenants[0]
            ps = datetime(2025, month, 1)
            pe = datetime(2025, month, 28)
            opening = money(0, 5000000000)
            debits = money(0, 500000000)
            credits = money(0, 500000000)
            closing = round(opening + debits - credits, 2)
            rows.append(f"  ('{tbid}', '{tenant['tenantId']}', '{gl['code']}', '{ts(ps)}', '{ts(pe)}', {opening}, {debits}, {credits}, {closing}, 'NGN', 'final', '{ts(pe)}')")
    emit(f'INSERT INTO "trialBalances" ("trialBalanceId", "tenantId", "glAccountCode", "periodStart", "periodEnd", "openingBalance", "totalDebits", "totalCredits", "closingBalance", "currency", "status", "createdAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 21. Customer Transfers (front-end facing) ──────────────────────────────

def gen_customer_transfers():
    emit_comment("CUSTOMER TRANSFERS — Frontend transfer records")
    rows = []
    for i in range(200):
        c = random.choice(customers_list)
        tid = uid("CTRF")
        ben_name = random.choice(customers_list)["name"]
        amt = money(500, 5000000)
        narr = random.choice(["Monthly allowance", "School fees", "Rent payment", "Business payment", "Family support", "Investment"])
        ttype = random.choice(["intra_bank", "inter_bank", "international"])
        status = random.choice(["completed", "completed", "pending", "failed"])
        bank_code, bank_name = random.choice(NIGERIAN_BANKS)
        acct_num = rand_nuban()
        td = rand_date()
        rows.append(f"  ('{tid}', '{c['customerId']}', NULL, '{esc(ben_name)}', {amt}, '{esc(narr)}', '{ttype}', '{status}', '{bank_code}', '{bank_name}', '{acct_num}', '{esc(ben_name)}', NULL, NULL, NULL, '{ts(td)}', NULL, '{ts(td)}', '{ts(NOW)}')")
    emit(f'INSERT INTO "customerTransfers" ("transferId", "customerId", "beneficiaryId", "beneficiaryName", "amount", "narration", "transferType", "status", "bankCode", "bankName", "accountNumber", "accountName", "workflowId", "otpReference", "otpIssuedAt", "confirmedAt", "approvalState", "createdAt", "updatedAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 22. Customer Statements ─────────────────────────────────────────────────

def gen_customer_statements():
    emit_comment("CUSTOMER STATEMENTS — Transaction history line items")
    rows = []
    for i in range(500):
        c = random.choice(customers_list)
        sid = uid("STMT")
        direction = random.choice(["credit", "debit"])
        amt = money(100, 2000000)
        title = random.choice(["Salary Credit", "POS Purchase", "ATM Withdrawal", "Transfer In", "Transfer Out", "Airtime", "Utility Payment", "Loan Repayment", "Interest Credit"])
        detail = f"{title} - {random.choice(NIGERIAN_COMPANIES)}"
        stype = random.choice(["bank_transfer", "card_payment", "cash", "bill_payment", "fee"])
        status = "completed"
        td = rand_date()
        ref = f"REF-{uuid.uuid4().hex[:12].upper()}"
        cat = random.choice(["income", "shopping", "bills", "transport", "food", "transfers", "savings"])
        rows.append(f"  ('{sid}', '{c['customerId']}', '{esc(title)}', '{esc(detail)}', {amt}, '{direction}', '{stype}', '{status}', '{ts(td)}', '{ref}', '{cat}', '{ts(td)}')")
    emit(f'INSERT INTO "customerStatements" ("statementId", "customerId", "title", "detail", "amount", "direction", "statementType", "status", "occurredAt", "reference", "category", "createdAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 23. Customer Notifications ──────────────────────────────────────────────

def gen_notifications():
    emit_comment("CUSTOMER NOTIFICATIONS")
    rows = []
    notif_templates = [
        ("Transaction Alert", "Your account was {direction}ed with NGN{amount:,.2f}", "transaction"),
        ("Security Alert", "New login detected from {city}", "security"),
        ("Loan Update", "Your loan repayment of NGN{amount:,.2f} is due in 3 days", "loan"),
        ("Card Alert", "Your {brand} card was used at {merchant}", "card"),
        ("KYC Reminder", "Please complete your KYC verification to unlock full features", "kyc"),
        ("Promotional", "Earn up to 15% interest on fixed deposits. Apply now!", "promo"),
    ]
    for i in range(300):
        c = random.choice(customers_list)
        nid = uid("NOTIF")
        template = random.choice(notif_templates)
        title = template[0]
        msg = template[1].format(direction=random.choice(["credit","debit"]), amount=money(1000,1000000), city=random.choice(["Ikeja","Lekki","Wuse"]), brand=random.choice(["Verve","Mastercard"]), merchant=random.choice(["Shoprite","Total"]))
        ntype = template[2]
        is_read = 1 if random.random() < 0.6 else 0
        td = rand_date()
        rows.append(f"  ('{nid}', '{c['customerId']}', '{esc(title)}', '{esc(msg)}', '{ntype}', {is_read}, NULL, '{ts(td)}')")
    emit(f'INSERT INTO "customerNotifications" ("notificationId", "customerId", "title", "message", "notificationType", "isRead", "actionUrl", "createdAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 24. Tenant Feature Flags ───────────────────────────────────────────────

def gen_feature_flags():
    emit_comment("TENANT FEATURE FLAGS — Per-tenant feature toggles")
    features = [
        ("core_banking", "Core Banking", "core", "Core banking module — accounts, transactions, GL"),
        ("lending", "Lending & Credit", "core", "Loan origination, management, and collections"),
        ("payments", "Payments Hub", "core", "NIP, RTGS, card payments, bill payments"),
        ("cards", "Card Management", "payments", "Debit/credit card issuance and management"),
        ("fx", "FX Trading", "treasury", "Foreign exchange spot, forward, and swap trading"),
        ("aml", "AML/CFT Engine", "compliance", "Anti-money laundering and sanctions screening"),
        ("kyc", "KYC/KYB", "compliance", "Identity verification and business verification"),
        ("agents", "Agent Banking", "channels", "Field agent management and offline capture"),
        ("kpi", "KPI Dashboard", "analytics", "Stakeholder KPI tracking and scoring"),
        ("graph", "Graph Intelligence", "ai", "Neo4j/FalkorDB COA graph analytics"),
        ("ai_agents", "AI Banking Agents", "ai", "LangChain-powered conversational agents"),
        ("ussd", "USSD Banking", "channels", "USSD menu banking for feature phones"),
        ("whatsapp", "WhatsApp Banking", "channels", "WhatsApp business API integration"),
        ("escrow", "Escrow Services", "core", "Milestone-based escrow management"),
        ("agriculture", "Agri-Finance", "lending", "Agricultural lending, insurance, and value chain"),
    ]
    rows = []
    for t in tenants:
        for fkey, label, cat, desc in features:
            fid = uid("FF")
            enabled = 1 if fkey in t["modules"] else 0
            rollout = "ga" if enabled else "disabled"
            deps = []
            if fkey in ("cards", "fx"): deps = ["core_banking", "payments"]
            if fkey == "aml": deps = ["core_banking"]
            if fkey == "graph": deps = ["core_banking", "ai_agents"]
            rows.append(f"  ('{t['tenantId']}', '{fkey}', '{label}', '{cat}', '{esc(desc)}', {enabled}, '{rollout}', 1, '{json_str(deps)}'::jsonb, '{ts(rand_date())}', '{ts(NOW)}')")
    emit(f'INSERT INTO "tenantFeatureFlags" ("tenantId", "featureKey", "label", "category", "description", "enabled", "rolloutStage", "adminManaged", "dependsOn", "createdAt", "updatedAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 25. Agent Banking ──────────────────────────────────────────────────────

def gen_agents():
    emit_comment("AGENT BANKING — Field agents & POS agents")
    rows = []
    agent_types = ["pos_agent", "super_agent", "field_agent", "mobile_agent"]
    for i in range(NUM_AGENTS):
        first, last, gender = rand_name()
        state, city = rand_state_city()
        agent_id = uid("AGT")
        tenant = random.choice(tenants)
        atype = random.choice(agent_types)
        status = random.choice(["active", "active", "active", "suspended", "pending_activation"])
        terminal_id = f"TERM-{random.randint(10000, 99999)}"
        commission_rate = round(random.uniform(0.1, 1.5), 2)
        daily_limit = random.choice([500000, 1000000, 2000000, 5000000])
        total_txns = random.randint(100, 50000)
        a = {"agentId": agent_id, "tenantId": tenant["tenantId"], "name": f"{first} {last}"}
        agents_list.append(a)
        rows.append(f"  ('{tenant['tenantId']}', '{agent_id}', '{esc(first)} {esc(last)}', '{atype}', '{esc(city)}, {esc(state)}', '{gender}', '{rand_phone()}', '{status}', '{terminal_id}', {commission_rate}, {daily_limit}, {total_txns}, '{{}}'::jsonb, '{ts(rand_date())}', '{ts(NOW)}')")
    emit(f'INSERT INTO "agentBankingAgents" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES')
    # Using the generic service table format
    agent_rows = []
    for i in range(NUM_AGENTS):
        first, last, gender = rand_name()
        state, city = rand_state_city()
        agent_id = uid("AGT")
        tenant = random.choice(tenants)
        status = random.choice(["active", "active", "suspended", "pending"])
        commission = money(1000, 500000)
        rows_reformatted = f"  ('{tenant['tenantId']}', '{agent_id}', '{esc(first)} {esc(last)}', 'pos_agent', 'Agent in {esc(city)}, {esc(state)}', '{status}', {commission}, '{esc(state)}', 'TERM-{random.randint(10000,99999)}', '{{\"phone\": \"{rand_phone()}\", \"gender\": \"{gender}\"}}'::jsonb, '{ts(rand_date())}', '{ts(NOW)}')"
        agent_rows.append(rows_reformatted)
    # Rewrite using the actual table format
    sql_lines.pop()  # remove the incomplete INSERT
    sql_lines.pop()  # remove the VALUES line
    emit(f'INSERT INTO "agentBankingAgents" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES')
    emit(",\n".join(agent_rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 26. Billing Accounts ───────────────────────────────────────────────────

def gen_billing():
    emit_comment("BILLING ACCOUNTS — Tenant billing & rate cards")
    rows = []
    for t in tenants:
        ba_id = uid("BILL")
        model = random.choice(["flat_rate", "tiered", "per_transaction", "hybrid"])
        rc_id = uid("RC")
        min_commit = money(100000, 5000000)
        b = {"billingAccountId": ba_id, "tenantId": t["tenantId"], "rateCardId": rc_id}
        billing_accounts.append(b)
        rows.append(f"  ('{ba_id}', '{t['tenantId']}', '{esc(t['name'])} Billing', '{model}', 'NGN', 'active', '{ts(rand_date())}', NULL, '{rc_id}', {min_commit}, 'monthly', 14, '{ts(rand_date())}', '{ts(NOW)}')")
    emit(f'INSERT INTO "billingAccounts" ("billingAccountId", "tenantId", "accountName", "billingModel", "currency", "status", "contractStartAt", "contractEndAt", "defaultRateCardId", "minimumCommitAmount", "defaultBillingPeriodType", "invoiceDueDays", "createdAt", "updatedAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

    # Rate cards
    emit_comment("BILLING RATE CARDS")
    rc_rows = []
    for b in billing_accounts:
        rc_rows.append(f"  ('{b['rateCardId']}', '{b['billingAccountId']}', 'Standard Rate Card', 1, 'active', '{ts(rand_date())}', NULL, 'NGN', 'system', 'approved', '{ts(rand_date())}', '{ts(NOW)}')")
    emit(f'INSERT INTO "billingRateCards" ("rateCardId", "billingAccountId", "name", "version", "status", "effectiveFrom", "effectiveTo", "pricingCurrency", "createdBy", "approvalState", "createdAt", "updatedAt") VALUES')
    emit(",\n".join(rc_rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 27. Workflow Cases ──────────────────────────────────────────────────────

def gen_workflow_cases():
    emit_comment("WORKFLOW CASES — Operational workflow tracking")
    products = ["savings_account", "current_account", "personal_loan", "mortgage", "credit_card", "trade_finance", "fx_deal"]
    stages = ["kyc_review", "credit_assessment", "approval", "documentation", "disbursement", "quality_check", "compliance_review"]
    rows = []
    for i in range(100):
        wid = uid("WF")
        c = random.choice(customers_list)
        prod = random.choice(products)
        stage = random.choice(stages)
        status = random.choice(["in_progress", "completed", "pending_approval", "rejected", "escalated"])
        ch = random.choice(["mobile", "branch", "web", "agent"])
        amt = money(10000, 50000000)
        action = random.choice(["Review documents", "Approve application", "Request additional info", "Complete disbursement", "Schedule callback"])
        sla = random.choice([4, 8, 24, 48, 72])
        td = rand_date()
        rows.append(f"  ('{wid}', '{esc(c['name'])}', '{prod}', '{stage}', '{status}', '{ch}', {amt}, '{esc(action)}', {sla}, '{ts(td)}', '{ts(NOW)}')")
    emit(f'INSERT INTO "workflowCases" ("workflowId", "customer", "product", "stage", "status", "channel", "amount", "nextAction", "slaHours", "createdAt", "updatedAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 28. Audit Entries (application-level) ────────────────────────────────────

def gen_audit_entries():
    emit_comment("AUDIT ENTRIES — Application-level audit log")
    severities = ["info", "info", "info", "warning", "error", "critical"]
    routes = ["/api/accounts", "/api/transfers", "/api/loans", "/api/kyc", "/api/aml", "/api/fx", "/api/cards", "/api/agents", "/api/kpi", "/api/billing"]
    rows = []
    for i in range(200):
        aid = uid("AE")
        actor = random.choice(users_list)
        etype = random.choice(["account", "transfer", "loan", "kyc_verification", "aml_alert", "customer"])
        eid = uid(etype[:4].upper())
        action = random.choice(["create", "update", "approve", "reject", "view", "export"])
        sev = random.choice(severities)
        route = random.choice(routes)
        mw = ["auth", "tenant_scope", "rate_limit"]
        detail = f"{action} on {etype} {eid} by {actor['name']}"
        td = rand_date()
        rows.append(f"  ('{aid}', '{ts(td)}', '{actor['role']}', '{actor['openId']}', '{etype}', '{eid}', '{action}', '{esc(detail)}', '{sev}', '{route}', '{json_str(mw)}'::jsonb, '{esc(detail)}')")
    emit(f'INSERT INTO "auditEntries" ("auditId", "timestampAt", "actorRole", "actorId", "entityType", "entityId", "action", "outcome", "severity", "route", "middleware", "detail") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 29. Operator Actions ────────────────────────────────────────────────────

def gen_operator_actions():
    emit_comment("OPERATOR ACTIONS — Pending operational tasks")
    domains = ["kyc", "aml", "loans", "accounts", "transfers", "compliance", "cards"]
    rows = []
    for i in range(80):
        aid = uid("OA")
        domain = random.choice(domains)
        c = random.choice(customers_list)
        title = random.choice([f"Review KYC for {c['name']}", f"Approve loan for {c['name']}", f"Investigate AML alert", f"Process transfer request", f"Verify card application"])
        detail = f"Action required: {title}"
        owner = random.choice(users_list)["name"]
        due = rand_future(2)
        route = f"/operations/{domain}/{uid('ID')}"
        status = random.choice(["pending", "in_progress", "completed", "overdue"])
        roles = [random.choice(["operator", "compliance", "credit", "admin"])]
        td = rand_date()
        rows.append(f"  ('{aid}', '{domain}', '{esc(title)}', '{esc(detail)}', '{esc(owner)}', '{ts(due)}', '{route}', '{status}', '{json_str(roles)}'::jsonb, '{ts(td)}', '{ts(NOW)}')")
    emit(f'INSERT INTO "operatorActions" ("actionId", "domainKey", "title", "detail", "owner", "dueAt", "route", "status", "roles", "createdAt", "updatedAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 30. Export Jobs ─────────────────────────────────────────────────────────

def gen_export_jobs():
    emit_comment("EXPORT JOBS — Report generation & export")
    domains = ["transactions", "accounts", "loans", "aml_alerts", "kyc", "gl_trial_balance", "regulatory_returns"]
    rows = []
    for i in range(40):
        eid = uid("EXP")
        domain = random.choice(domains)
        title = f"{domain.replace('_', ' ').title()} Report - {random.choice(['Q1 2026', 'Q4 2025', 'January 2026', 'March 2026', 'Weekly'])}"
        fmt = random.choice(["csv", "xlsx", "pdf"])
        status = random.choice(["completed", "completed", "processing", "pending"])
        role = random.choice(["compliance", "treasury", "admin", "auditor"])
        route = f"/reports/{domain}"
        row_count = random.randint(100, 50000)
        approval = random.choice(["approved", "pending", "not_required"])
        sig = f"sig-{uuid.uuid4().hex[:16]}"
        url = f"https://cdn.54bank.ng/reports/{eid}.{fmt}"
        chain = [random.choice(users_list)["name"]]
        signed = chain if approval == "approved" else []
        td = rand_date()
        retain = rand_future(24)
        rows.append(f"  ('{eid}', '{domain}', '{esc(title)}', '{fmt}', '{status}', '{ts(td)}', '{role}', '{route}', {row_count}, '{approval}', '{sig}', '{url}', '{ts(retain)}', NULL, '{json_str(chain)}'::jsonb, '{json_str(signed)}'::jsonb)")
    emit(f'INSERT INTO "exportJobs" ("exportJobId", "domainKey", "title", "format", "status", "createdAt", "requestedByRole", "route", "rowCount", "approvalState", "approvalSignature", "downloadUrl", "retainedUntil", "reportVersion", "approvalChain", "signedBy") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 31. Identity Profiles & KYC tiers ──────────────────────────────────────

def gen_identity_profiles():
    emit_comment("IDENTITY PROFILES — Extended customer identity data")
    rows = []
    for c in customers_list[:100]:
        pid = uid("IDPR")
        dob = f"{random.randint(1960,2000)}-{random.randint(1,12):02d}-{random.randint(1,28):02d}"
        nationality = "Nigerian"
        mother_maiden = random.choice(NIGERIAN_LAST_NAMES)
        address = f"{random.randint(1,200)} {random.choice(['Adeniyi Jones','Adeola Odeku','Awolowo','Ahmadu Bello','Nnamdi Azikiwe','Herbert Macaulay'])} Street, {c['city']}, {c['state']}"
        risk_factors = {"pep": False, "sanctions": False, "risk_score": round(random.uniform(0, 50), 2)}
        email = f"{c['name'].split()[0].lower()}.{c['name'].split()[-1].lower()}@gmail.com"
        rows.append(f"  ('{c['customerId']}', '{c['tenantId']}', '{esc(c['name'])}', '{c['bvn']}', '{rand_nin()}', '{rand_phone()}', '{email}', '{dob}', '{c['gender']}', '{nationality}', '{esc(address)}', '{esc(mother_maiden)}', '{json_str(risk_factors)}'::jsonb, '{ts(rand_date())}', '{ts(NOW)}')")
    emit(f'INSERT INTO "identityProfiles" ("customerId", "tenantId", "fullName", "bvn", "nin", "phone", "email", "dateOfBirth", "gender", "nationality", "address", "motherMaidenName", "riskFactors", "createdAt", "updatedAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 32. Customer Bill Payments ──────────────────────────────────────────────

def gen_bill_payments():
    emit_comment("CUSTOMER BILL PAYMENTS — Utility & bill payments")
    providers = [
        ("Ikeja Electric", "electricity"), ("Eko Electric", "electricity"), ("EEDC Enugu", "electricity"),
        ("DSTV", "cable_tv"), ("GOtv", "cable_tv"), ("StarTimes", "cable_tv"),
        ("MTN", "airtime"), ("Glo", "airtime"), ("Airtel", "airtime"), ("9mobile", "airtime"),
        ("Lagos Water Corp", "water"), ("LAWMA", "waste"),
        ("FIRS", "tax"), ("LIRS", "tax"),
    ]
    rows = []
    for i in range(200):
        c = random.choice(customers_list)
        pid = uid("BPAY")
        prov_name, cat = random.choice(providers)
        amt = money(500, 100000)
        status = random.choice(["successful", "successful", "successful", "pending", "failed"])
        ref = f"BPAY-{uuid.uuid4().hex[:12].upper()}"
        td = rand_date()
        rows.append(f"  ('{pid}', '{c['customerId']}', '{cat}', '{prov_name}', {amt}, '{status}', '{ts(td)}', '{ref}', NULL, NULL, '{esc(c['name'])}', NULL, NULL, NULL, '{ts(td)}')")
    emit(f'INSERT INTO "customerBillPayments" ("paymentId", "customerId", "category", "provider", "amount", "status", "paidAt", "reference", "billerId", "customerReference", "customerName", "scheduledFor", "evidenceStatus", "channel", "createdAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 33. Dispute Cases ──────────────────────────────────────────────────────

def gen_disputes():
    emit_comment("DISPUTE CASES — Transaction disputes & chargebacks")
    rows = []
    for i in range(30):
        did = uid("DISP")
        c = random.choice(customers_list)
        tx = random.choice(transactions_list)
        tenant = random.choice(tenants)
        reason = random.choice(["unauthorized_transaction", "double_debit", "wrong_amount", "merchant_dispute", "atm_failed_withdrawal", "card_not_present_fraud"])
        status = random.choice(["open", "investigating", "resolved_customer", "resolved_bank", "escalated"])
        amt = money(1000, 500000)
        td = rand_date()
        resolved = td + timedelta(days=random.randint(1, 30)) if "resolved" in status else None
        res_str = f"'{ts(resolved)}'" if resolved else "NULL"
        desc = f"Dispute for transaction {tx['txId']}"
        region = c.get('state', 'Lagos')
        meta = json.dumps({"txn_id": tx['txId'], "channel": "pos"})
        rows.append(f"  ('{tenant['tenantId']}', '{did}', '{esc(c['name'])}', '{reason}', '{esc(desc)}', '{status}', {amt}, '{esc(region)}', '{tx['ref']}', '{esc(meta)}'::jsonb, '{ts(td)}', {res_str})")
    emit(f'INSERT INTO "disputeCases" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 34. Escrow Accounts ────────────────────────────────────────────────────

def gen_escrow():
    emit_comment("ESCROW ACCOUNTS — Milestone-based escrow")
    rows = []
    for i in range(20):
        eid = uid("ESCR")
        tenant = random.choice(tenants)
        c = random.choice(customers_list)
        purpose = random.choice(["property_purchase", "contract_payment", "trade_settlement", "investment", "vehicle_purchase"])
        amt = money(500000, 100000000)
        status = random.choice(["active", "active", "completed", "disputed", "pending_release"])
        td = rand_date()
        desc = f"Escrow for {purpose.replace('_',' ')} - {c['name']}"
        region = c.get('state', 'Lagos')
        esc_ref = f"ESC-{uuid.uuid4().hex[:8].upper()}"
        meta = json.dumps({"buyer": c['name'], "currency": "NGN"})
        rows.append(f"  ('{tenant['tenantId']}', '{eid}', '{esc(c['name'])}', '{purpose}', '{esc(desc)}', '{status}', {amt}, '{esc(region)}', '{esc_ref}', '{esc(meta)}'::jsonb, '{ts(td)}', '{ts(NOW)}')")
    emit(f'INSERT INTO "escrow_accounts" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 35. Farmers (Agriculture) ──────────────────────────────────────────────

def gen_farmers():
    emit_comment("FARMERS — Agricultural customer profiles")
    rows = []
    for i in range(NUM_FARMERS):
        first, last, gender = rand_name()
        state, city = rand_state_city()
        fid = uid("FARM")
        tenant = random.choice(tenants)
        crop = random.choice(CROP_TYPES)
        farm_size = round(random.uniform(0.5, 500), 2)
        status = random.choice(["active", "active", "seasonal", "inactive"])
        f = {"farmerId": fid, "tenantId": tenant["tenantId"], "name": f"{first} {last}"}
        farmers_list.append(f)
        desc = f"{farm_size} hectares in {city}, {state}"
        farm_ref = f"FARM-{uuid.uuid4().hex[:8].upper()}"
        meta = json.dumps({"crop": crop, "gender": gender, "phone": rand_phone(), "bvn": rand_bvn()})
        rows.append(f"  ('{tenant['tenantId']}', '{fid}', '{esc(first)} {esc(last)}', '{crop}', '{esc(desc)}', '{status}', {farm_size}, '{esc(state)}', '{farm_ref}', '{esc(meta)}'::jsonb, '{ts(rand_date())}', '{ts(NOW)}')")
    emit(f'INSERT INTO "farmers" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 36. Agricultural Loans ─────────────────────────────────────────────────

def gen_agri_loans():
    emit_comment("AGRICULTURAL LOANS — Agri-finance facilities")
    rows = []
    for i in range(40):
        f = random.choice(farmers_list)
        lid = uid("AGRL")
        crop = random.choice(CROP_TYPES)
        product = random.choice(["anchor_borrower", "commercial_agri", "smallholder", "nirsal_backed"])
        principal = money(100000, 50000000)
        rate_bps = random.randint(500, 2500)
        tenor = random.choice([3, 6, 9, 12, 18, 24])
        disb = rand_date()
        mat = disb + timedelta(days=tenor * 30)
        outstanding = round(principal * random.uniform(0.2, 1.0), 2)
        repaid = round(principal - outstanding, 2)
        status = random.choice(["active", "active", "fully_paid", "default", "restructured"])
        risk = random.choice(["A", "B", "C", "D"])
        purpose = f"Agri loan for {crop} farming"
        prod_code = f"{product[:3].upper()}{random.randint(100,999)}"
        coll_val = round(principal*1.5, 2)
        cycle = random.choice(['wet-season','dry-season','irrigated'])
        sched = json.dumps({"monthly": True})
        rows.append(f"  ('{lid}', '{f['tenantId']}', '{f['farmerId']}', '{product}', '{prod_code}', {principal}, {rate_bps}, {tenor}, 'NGN', '{esc(purpose)}', 'land', {coll_val}, '{cycle}', '{ts(mat)}', '{ts(disb)}', '{ts(mat)}', {outstanding}, {repaid}, '{status}', 'approved', '{risk}', '{esc(sched)}'::jsonb, '{ts(disb)}', '{ts(NOW)}')")
    emit(f'INSERT INTO "agriLoans" ("loanId", "tenantId", "farmerId", "loanType", "productCode", "principalAmount", "interestRateBps", "tenorMonths", "currency", "purpose", "collateralType", "collateralValue", "cropCycle", "expectedHarvestDate", "disbursementDate", "maturityDate", "outstandingBalance", "totalRepaid", "status", "approvalStatus", "riskGrade", "repaymentSchedule", "createdAt", "updatedAt") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ─── 37. Regulatory Reports (eFASS, CBN returns) ────────────────────────────

def gen_regulatory_reports():
    emit_comment("REGULATORY REPORTS — CBN eFASS & statutory returns")
    report_types = ["MBR100", "MBR200", "MBR300", "MBR400", "MBR500", "MBR600", "MBR700", "MBR900", "SRF001", "SRF002", "SRF003", "eFASS_ANNUAL"]
    rows = []
    for rtype in report_types:
        for quarter in ["Q1-2025", "Q2-2025", "Q3-2025", "Q4-2025", "Q1-2026"]:
            rid = uid("REG")
            tenant = tenants[0]
            status = random.choice(["submitted", "submitted", "submitted", "draft", "approved"])
            td = rand_date()
            desc = f"{rtype} return for {quarter}"
            reg_ref = f"REG-{uuid.uuid4().hex[:8].upper()}"
            meta = json.dumps({"quarter": quarter, "filing_date": ts(td)})
            rows.append(f"  ('{tenant['tenantId']}', '{rid}', '{rtype}', '{rtype}', '{esc(desc)}', '{status}', 0, 'CBN', '{reg_ref}', '{esc(meta)}'::jsonb, '{ts(td)}', '{ts(NOW)}')")
    emit(f'INSERT INTO "regulatoryReports" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES')
    emit(",\n".join(rows))
    emit("ON CONFLICT DO NOTHING;\n")

# ═══════════════════════════════════════════════════════════════════════════════
# TigerBeetle Seed Data
# ═══════════════════════════════════════════════════════════════════════════════

def gen_tigerbeetle_script():
    """Generate TigerBeetle CLI commands for ledger accounts & transfers."""
    lines = [
        "#!/usr/bin/env bash",
        "# 54Bank TigerBeetle Seed Data",
        "# Creates ledger accounts and sample transfers",
        "# Usage: TB_ADDRESS=localhost:3001 bash scripts/tigerbeetle-seed.sh",
        "",
        'TB_CLI="${TB_CLI:-tigerbeetle}"',
        'TB_ADDR="${TB_ADDRESS:-127.0.0.1:3001}"',
        'CLUSTER_ID="${TB_CLUSTER_ID:-0}"',
        "",
        "echo '=== Creating TigerBeetle Ledger Accounts ==='",
        "",
    ]

    # Ledger types: 1=Assets, 2=Liabilities, 3=Equity, 4=Income, 5=Expense
    ledger_map = {
        "savings": 1, "current": 1, "domiciliary": 1, "fixed_deposit": 1, "corporate": 1,
    }
    # Create accounts for each bank account
    account_cmds = []
    for i, acct in enumerate(accounts_list[:200]):  # first 200 accounts
        tb_id = tb_account_ids[i] if i < len(tb_account_ids) else 1000 + i
        ledger = ledger_map.get(acct["type"], 1)
        # TigerBeetle account flags: linked=0, debits_must_not_exceed_credits for liability accounts
        flags = 0
        code = random.randint(1, 9999)
        balance_ngn = int(acct["balance"] * 100)  # store in kobo (smallest unit)
        account_cmds.append(f'echo "create_accounts id={tb_id} ledger={ledger} code={code} flags={flags}" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR')

    lines.extend(account_cmds[:200])
    lines.append("")
    lines.append("echo '=== Creating TigerBeetle Transfers ==='")
    lines.append("")

    # Create sample transfers (double-entry)
    transfer_cmds = []
    for i in range(min(100, len(transfers_list))):
        trf = transfers_list[i]
        src_idx = next((j for j, a in enumerate(accounts_list) if a["accountId"] == trf["src"]), 0)
        dst_idx = next((j for j, a in enumerate(accounts_list) if a["accountId"] == trf["dst"]), 1)
        src_tb = tb_account_ids[src_idx] if src_idx < len(tb_account_ids) else 1001
        dst_tb = tb_account_ids[dst_idx] if dst_idx < len(tb_account_ids) else 1002
        amount_kobo = int(trf["amount"] * 100)
        transfer_id = 10000 + i
        ledger = 1
        code = 1  # transfer code
        transfer_cmds.append(f'echo "create_transfers id={transfer_id} debit_account_id={src_tb} credit_account_id={dst_tb} amount={amount_kobo} ledger={ledger} code={code}" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR')

    lines.extend(transfer_cmds)
    lines.append("")
    lines.append("echo '=== TigerBeetle seed complete ==='")
    lines.append(f"echo 'Created {len(account_cmds)} accounts and {len(transfer_cmds)} transfers'")
    lines.append("")

    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    emit("-- ═══════════════════════════════════════════════════════════════════════════")
    emit("-- 54Bank — Comprehensive Seed Data (Postgres)")
    emit(f"-- Generated: {NOW.isoformat()}")
    emit("-- Realistic Nigerian banking data with full relational consistency")
    emit("-- Tables seeded: tenants, users, customers, accounts, transactions,")
    emit("--   journal_entries, loans, loan_repayments, transfers, settlements,")
    emit("--   kyc_verifications, aml_alerts, fx_trades, nostro_accounts,")
    emit("--   swift_messages, nip_transactions, card_transactions, cards,")
    emit("--   trial_balances, audit_trail, audit_entries, operator_actions,")
    emit("--   export_jobs, workflow_cases, customer_transfers, customer_statements,")
    emit("--   customer_notifications, customer_bill_payments, tenant_feature_flags,")
    emit("--   billing_accounts, billing_rate_cards, identity_profiles,")
    emit("--   agent_banking, farmers, agri_loans, dispute_cases, escrow_accounts,")
    emit("--   regulatory_reports")
    emit("-- ═══════════════════════════════════════════════════════════════════════════")
    emit("")
    emit("BEGIN;")
    emit("")

    # Build GL reference (from existing seed-gl-coa.sql)
    gen_gl_accounts_ref()

    # Generate all tables
    gen_tenants()
    gen_users()
    gen_customers()
    gen_accounts()
    gen_feature_flags()
    gen_transactions()
    gen_journal_entries()
    gen_loans()
    gen_loan_repayments()
    gen_transfers()
    gen_settlements()
    gen_kyc()
    gen_aml_alerts()
    gen_fx_trades()
    gen_nostro()
    gen_swift()
    gen_nip()
    gen_card_transactions()
    gen_audit_trail()
    gen_trial_balances()
    gen_customer_transfers()
    gen_customer_statements()
    gen_notifications()
    gen_billing()
    gen_workflow_cases()
    gen_audit_entries()
    gen_operator_actions()
    gen_export_jobs()
    gen_identity_profiles()
    gen_bill_payments()
    gen_disputes()
    gen_escrow()
    gen_agents()
    gen_farmers()
    gen_agri_loans()
    gen_regulatory_reports()

    emit("")
    emit("COMMIT;")
    emit("")
    emit("-- ═══════════════════════════════════════════════════════════════════════════")
    emit("-- Seed Summary")
    emit(f"-- Tenants:             {len(tenants)}")
    emit(f"-- Users:               {len(users_list)}")
    emit(f"-- Customers:           {len(customers_list)}")
    emit(f"-- Accounts:            {len(accounts_list)}")
    emit(f"-- Transactions:        {NUM_TRANSACTIONS}")
    emit(f"-- Journal Entries:     {NUM_JOURNAL_ENTRIES}")
    emit(f"-- Loans:               {NUM_LOANS}")
    emit(f"-- Loan Repayments:     {NUM_LOAN_REPAYMENTS}")
    emit(f"-- Transfers:           {NUM_TRANSFERS}")
    emit(f"-- Settlements:         {NUM_SETTLEMENTS}")
    emit(f"-- KYC Verifications:   {NUM_KYC_VERIFICATIONS}")
    emit(f"-- AML Alerts:          {NUM_AML_ALERTS}")
    emit(f"-- FX Trades:           {NUM_FX_TRADES}")
    emit(f"-- NIP Transactions:    {NUM_NIP_TRANSACTIONS}")
    emit(f"-- Card Transactions:   {NUM_CARD_TRANSACTIONS}")
    emit(f"-- Cards:               ~{min(80*2, len(cards_list))}")
    emit(f"-- SWIFT Messages:      {NUM_SWIFT_MESSAGES}")
    emit(f"-- Audit Trail:         {NUM_AUDIT_TRAIL}")
    emit(f"-- Trial Balances:      {12 * len(gl_accounts)}")
    emit(f"-- TigerBeetle Accts:   {min(200, len(tb_account_ids))}")
    emit("-- ═══════════════════════════════════════════════════════════════════════════")

    # Write Postgres SQL
    sql_path = "/home/ubuntu/repos/corebanking/drizzle/seed-comprehensive.sql"
    with open(sql_path, "w") as f:
        f.write("\n".join(sql_lines))
    print(f"✓ Postgres seed: {sql_path} ({len(sql_lines)} lines)")

    # Write TigerBeetle script
    tb_path = "/home/ubuntu/repos/corebanking/scripts/tigerbeetle-seed.sh"
    tb_content = gen_tigerbeetle_script()
    with open(tb_path, "w") as f:
        f.write(tb_content)
    print(f"✓ TigerBeetle seed: {tb_path}")

    # Summary
    print(f"\n{'='*60}")
    print("54Bank Seed Data Generation Complete")
    print(f"{'='*60}")
    print(f"Tenants:           {len(tenants)}")
    print(f"Users:             {len(users_list)}")
    print(f"Customers:         {len(customers_list)}")
    print(f"Accounts:          {len(accounts_list)}")
    print(f"Transactions:      {NUM_TRANSACTIONS}")
    print(f"Journal Entries:   {NUM_JOURNAL_ENTRIES}")
    print(f"Loans:             {NUM_LOANS}")
    print(f"Transfers:         {NUM_TRANSFERS}")
    print(f"KYC Verifications: {NUM_KYC_VERIFICATIONS}")
    print(f"AML Alerts:        {NUM_AML_ALERTS}")
    print(f"FX Trades:         {NUM_FX_TRADES}")
    print(f"Cards:             {len(cards_list)}")
    print(f"NIP Transactions:  {NUM_NIP_TRANSACTIONS}")
    print(f"Card Transactions: {NUM_CARD_TRANSACTIONS}")
    print(f"Settlements:       {NUM_SETTLEMENTS}")
    print(f"SWIFT Messages:    {NUM_SWIFT_MESSAGES}")
    print(f"Audit entries:     {NUM_AUDIT_TRAIL + 200}")
    print(f"Trial Balances:    {12 * len(gl_accounts)}")
    print(f"Farmers:           {NUM_FARMERS}")
    print(f"Agents:            {NUM_AGENTS}")
    print(f"Total rows:        ~{len(tenants) + len(users_list) + len(customers_list) + len(accounts_list) + NUM_TRANSACTIONS + NUM_JOURNAL_ENTRIES + NUM_LOANS + NUM_LOAN_REPAYMENTS + NUM_TRANSFERS + NUM_SETTLEMENTS + NUM_KYC_VERIFICATIONS + NUM_AML_ALERTS + NUM_FX_TRADES + NUM_NIP_TRANSACTIONS + NUM_CARD_TRANSACTIONS + len(cards_list) + NUM_SWIFT_MESSAGES + NUM_AUDIT_TRAIL + 12*len(gl_accounts) + 200 + 500 + 300 + 200 + 100 + 80 + 40 + len(tenants)*15 + 5 + 40 + NUM_FARMERS + NUM_AGENTS + 30 + 20 + 60}")
    print(f"TigerBeetle:       {min(200, len(tb_account_ids))} accounts, {min(100, len(transfers_list))} transfers")

if __name__ == "__main__":
    main()
