#!/usr/bin/env bash
# 54Bank Microservice Seed Data — realistic Nigerian banking data
# Seeds ALL 41 microservices via their HTTP POST endpoints
# Usage: bash scripts/seed-microservices.sh
# Prerequisites: All target services must be running on their respective ports

set -euo pipefail
PASS=0; FAIL=0; SKIP=0

post() {
  local url=$1 data=$2 label=$3
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$url" -H "Content-Type: application/json" -d "$data" 2>/dev/null || echo "000")
  if [[ "$code" =~ ^2 ]]; then
    echo "  ✓ $label (HTTP $code)"
    ((PASS++))
  elif [ "$code" = "000" ]; then
    echo "  ⊘ $label (service not running)"
    ((SKIP++))
  else
    echo "  ✗ $label (HTTP $code)"
    ((FAIL++))
  fi
}

echo "══════════════════════════════════════════════════"
echo "  54Bank Microservice Seed Data"
echo "  $(date -u +"%Y-%m-%d %H:%M UTC")"
echo "══════════════════════════════════════════════════"
echo ""

# ── Teller Operations :8091 ──
echo "▸ Teller Operations (:8091)"
post "http://localhost:8091/v1/teller/sessions" \
  '{"tellerId":"TEL-001","tellerName":"Adebayo Ogundimu","branchCode":"BR-LOS-001","branchName":"Victoria Island Main","windowNumber":1,"openingBalance":5000000}' \
  "Teller session (Adebayo, VI Main)"
post "http://localhost:8091/v1/teller/sessions" \
  '{"tellerId":"TEL-002","tellerName":"Chidinma Okafor","branchCode":"BR-ABJ-001","branchName":"Abuja Central","windowNumber":3,"openingBalance":8500000}' \
  "Teller session (Chidinma, Abuja)"
post "http://localhost:8091/v1/teller/sessions" \
  '{"tellerId":"TEL-003","tellerName":"Emeka Nwosu","branchCode":"BR-KAN-001","branchName":"Kano Main","windowNumber":2,"openingBalance":3200000}' \
  "Teller session (Emeka, Kano)"
echo ""

# ── Account Opening :8114 ──
echo "▸ Account Opening (:8114)"
post "http://localhost:8114/v1/accounts/applications" \
  '{"customerId":"CUST-001","productType":"savings","currency":"NGN","tier":"tier1","bvn":"22001234567","fullName":"Fatima Abdullahi","dateOfBirth":"1990-03-15","phoneNumber":"+2348012345678","email":"fatima@example.ng","address":"12 Ahmadu Bello Way, Kaduna","monthlyIncome":250000,"dailyLimit":50000,"singleTxnLimit":50000,"maxBalance":300000}' \
  "Account application (Fatima, Tier 1 savings)"
post "http://localhost:8114/v1/accounts/applications" \
  '{"customerId":"CUST-002","productType":"current","currency":"NGN","tier":"tier3","bvn":"22009876543","nin":"12345678901","fullName":"Ibrahim Musa","dateOfBirth":"1985-07-22","phoneNumber":"+2348098765432","email":"ibrahim.musa@corporate.ng","address":"Plot 44, Lekki Phase 1, Lagos","employerName":"FirstBank Nigeria PLC","monthlyIncome":2500000,"dailyLimit":5000000,"singleTxnLimit":2000000,"maxBalance":999999999}' \
  "Account application (Ibrahim, Tier 3 current)"
post "http://localhost:8114/v1/accounts/applications" \
  '{"customerId":"CUST-003","productType":"domiciliary","currency":"USD","tier":"tier2","bvn":"22005551234","fullName":"Jumoke Adeyemi","dateOfBirth":"1992-11-08","phoneNumber":"+2348055512345","email":"jumoke.a@trade.ng","address":"7 Marina Road, Lagos Island","employerName":"Sterling Bank","monthlyIncome":800000,"dailyLimit":1000000,"singleTxnLimit":500000,"maxBalance":50000000}' \
  "Account application (Jumoke, Tier 2 domiciliary USD)"
echo ""

# ── Beneficiary Management :8116 ──
echo "▸ Beneficiary Management (:8116)"
post "http://localhost:8116/v1/beneficiaries" \
  '{"customerId":"CUST-001","accountNumber":"0012345678","bankCode":"011","bankName":"First Bank","accountName":"Kelechi Eze","nickname":"Kelechi rent","currency":"NGN","category":"rent"}' \
  "Beneficiary (Kelechi, First Bank)"
post "http://localhost:8116/v1/beneficiaries" \
  '{"customerId":"CUST-001","accountNumber":"2098765432","bankCode":"058","bankName":"GTBank","accountName":"Lateefat Balogun","nickname":"Lateefat school fees","currency":"NGN","category":"education"}' \
  "Beneficiary (Lateefat, GTBank)"
post "http://localhost:8116/v1/beneficiaries" \
  '{"customerId":"CUST-002","accountNumber":"3034567890","bankCode":"033","bankName":"UBA","accountName":"Maryam Suleiman","nickname":"Maryam supplies","currency":"NGN","category":"vendor"}' \
  "Beneficiary (Maryam, UBA)"
echo ""

# ── Notification Service :8113 ──
echo "▸ Notification Service (:8113)"
post "http://localhost:8113/v1/notifications/send" \
  '{"customerId":"CUST-001","channel":"sms","templateId":"transaction-alert","subject":"Transaction Alert","body":"You have received ₦250,000.00 from Ibrahim Musa. Balance: ₦5,250,000.00","phoneNumber":"+2348012345678"}' \
  "SMS notification (transaction alert)"
post "http://localhost:8113/v1/notifications/send" \
  '{"customerId":"CUST-002","channel":"email","templateId":"monthly-statement","subject":"Your January 2026 Statement","body":"Dear Ibrahim, your monthly statement is ready for download.","email":"ibrahim.musa@corporate.ng"}' \
  "Email notification (monthly statement)"
post "http://localhost:8113/v1/notifications/send" \
  '{"customerId":"CUST-003","channel":"push","templateId":"loan-due","subject":"Loan Payment Due","body":"Your mortgage payment of ₦185,000 is due in 3 days.","deviceToken":"fcm-token-abc123"}' \
  "Push notification (loan due)"
echo ""

# ── Savings Products :8115 ── (actually standing-orders is 8115)
echo "▸ Standing Orders (:8115)"
post "http://localhost:8115/v1/standing-orders" \
  '{"customerId":"CUST-001","type":"recurring_transfer","sourceAccount":"0012345678","destinationAccount":"2098765432","destinationBank":"058","amount":150000,"currency":"NGN","frequency":"monthly","description":"Monthly rent payment","nextExecutionDate":"2026-02-01"}' \
  "Standing order (monthly rent ₦150K)"
post "http://localhost:8115/v1/standing-orders" \
  '{"customerId":"CUST-002","type":"salary_sweep","sourceAccount":"3034567890","destinationAccount":"0012345678","destinationBank":"011","amount":500000,"currency":"NGN","frequency":"monthly","description":"Salary sweep to savings","nextExecutionDate":"2026-01-28"}' \
  "Standing order (salary sweep ₦500K)"
post "http://localhost:8115/v1/mandates" \
  '{"customerId":"CUST-003","mandateType":"direct_debit","creditorName":"DSTV Nigeria","creditorAccount":"1234567890","maxAmount":25000,"currency":"NGN","frequency":"monthly","status":"active"}' \
  "Direct debit mandate (DSTV)"
echo ""

# ── Savings Products :8107 ──
echo "▸ Savings Products (:8107)"
post "http://localhost:8107/v1/savings/accounts" \
  '{"customerId":"CUST-001","productType":"fixed_deposit","currency":"NGN","initialDeposit":2000000,"interestRate":12.5,"tenorMonths":12,"maturityAction":"rollover"}' \
  "Fixed deposit (₦2M, 12.5%, 12mo)"
post "http://localhost:8107/v1/savings/accounts" \
  '{"customerId":"CUST-002","productType":"target_savings","currency":"NGN","initialDeposit":100000,"targetAmount":5000000,"interestRate":8.0,"targetDate":"2026-12-31"}' \
  "Target savings (₦5M goal)"
post "http://localhost:8107/v1/savings/accounts" \
  '{"customerId":"CUST-003","productType":"high_yield","currency":"NGN","initialDeposit":10000000,"interestRate":15.0,"tenorMonths":6}' \
  "High yield savings (₦10M, 15%)"
echo ""

# ── Card Management :8108 ──
echo "▸ Card Management (:8108)"
post "http://localhost:8108/v1/cards" \
  '{"customerId":"CUST-001","cardType":"debit","scheme":"verve","currency":"NGN","accountNumber":"0012345678","nameOnCard":"FATIMA ABDULLAHI","dailyLimit":200000,"posLimit":500000,"webLimit":100000}' \
  "Verve debit card (Fatima)"
post "http://localhost:8108/v1/cards" \
  '{"customerId":"CUST-002","cardType":"credit","scheme":"mastercard","currency":"NGN","accountNumber":"3034567890","nameOnCard":"IBRAHIM MUSA","creditLimit":5000000,"dailyLimit":2000000}' \
  "Mastercard credit card (Ibrahim)"
post "http://localhost:8108/v1/cards/virtual" \
  '{"customerId":"CUST-003","currency":"USD","purpose":"online_shopping","maxAmount":500,"expiryDays":30}' \
  "Virtual USD card (Jumoke, online shopping)"
echo ""

# ── Payments Hub :8109 ──
echo "▸ Payments Hub (:8109)"
post "http://localhost:8109/v1/payments/nip" \
  '{"sourceAccount":"0012345678","destinationAccount":"2098765432","destinationBank":"058","amount":750000,"currency":"NGN","narration":"Invoice payment - Jan 2026","senderName":"Fatima Abdullahi","receiverName":"Kelechi Eze"}' \
  "NIP transfer (₦750K)"
post "http://localhost:8109/v1/payments/bill-pay" \
  '{"customerId":"CUST-002","billerCode":"EKEDC","billerName":"Eko Electricity","amount":15000,"currency":"NGN","meterNumber":"45-1234-5678-9","customerReference":"CUST-002-ELEC"}' \
  "Bill payment (EKEDC electricity)"
post "http://localhost:8109/v1/payments/ussd" \
  '{"phoneNumber":"+2348012345678","amount":50000,"destinationAccount":"3034567890","pin":"1234","sessionId":"USSD-001"}' \
  "USSD transfer (₦50K)"
echo ""

# ── Trade Finance :8093 ──
echo "▸ Trade Finance (:8093)"
post "http://localhost:8093/v1/trade-finance/lcs" \
  '{"applicant":"Ibrahim Musa Enterprises","beneficiary":"Shanghai Electronics Co.","amount":25000000,"currency":"NGN","lcType":"irrevocable","expiryDate":"2026-06-30","goodsDescription":"Electronic components - 500 units","portOfLoading":"Shanghai Port","portOfDischarge":"Lagos Apapa Port","incoterms":"CIF","advisingBank":"Standard Chartered Nigeria"}' \
  "Letter of Credit (₦25M, Shanghai Electronics)"
post "http://localhost:8093/v1/trade-finance/guarantees" \
  '{"applicant":"Fatima Construction Ltd","beneficiary":"Federal Ministry of Works","amount":50000000,"currency":"NGN","guaranteeType":"bid_bond","expiryDate":"2026-09-30","projectDescription":"Lagos-Ibadan expressway section 4B","claimPeriodDays":180}' \
  "Bank guarantee (₦50M bid bond)"
echo ""

# ── Islamic Banking :8092 ──
echo "▸ Islamic Banking (:8092)"
post "http://localhost:8092/v1/islamic/murabaha" \
  '{"customerId":"CUST-001","assetDescription":"Toyota Hilux 2025 model","costPrice":28000000,"profitMargin":15,"sellingPrice":32200000,"tenorMonths":48,"monthlyInstallment":670833}' \
  "Murabaha contract (Toyota Hilux)"
post "http://localhost:8092/v1/islamic/ijara" \
  '{"customerId":"CUST-002","assetDescription":"Office space, 200sqm, Lekki Phase 1","leaseAmount":3000000,"tenorMonths":24,"monthlyRental":125000,"purchaseOptionPrice":2500000}' \
  "Ijara contract (office lease)"
echo ""

# ── Dispute Management :8094 ──
echo "▸ Dispute Management (:8094)"
post "http://localhost:8094/v1/disputes/cases" \
  '{"customerId":"CUST-001","transactionId":"TXN-20260115-001","amount":125000,"currency":"NGN","category":"unauthorized_transaction","channel":"card","merchantName":"Unknown POS Lagos","description":"I did not authorize this POS transaction at an unknown location","cardLast4":"4567"}' \
  "Dispute case (unauthorized POS ₦125K)"
post "http://localhost:8094/v1/disputes/cases" \
  '{"customerId":"CUST-002","transactionId":"TXN-20260118-042","amount":2500000,"currency":"NGN","category":"service_not_rendered","channel":"transfer","merchantName":"ABC Supplies Ltd","description":"Paid for goods but vendor has not delivered after 30 days"}' \
  "Dispute case (service not rendered ₦2.5M)"
post "http://localhost:8094/v1/disputes/cases" \
  '{"customerId":"CUST-003","transactionId":"TXN-20260120-007","amount":45000,"currency":"NGN","category":"duplicate_charge","channel":"web","merchantName":"Jumia Nigeria","description":"Charged twice for the same order #JUM-987654"}' \
  "Dispute case (duplicate charge ₦45K)"
echo ""

# ── Education Loans :8095 ──
echo "▸ Education Loans (:8095)"
post "http://localhost:8095/v1/education-loans/loans" \
  '{"studentId":"STU-001","studentName":"Ngozi Uche","institution":"University of Lagos","program":"MSc Computer Science","amount":3500000,"currency":"NGN","tenorMonths":48,"interestRate":9.0,"guarantorName":"Olumide Ajayi","guarantorBVN":"22003334444","disbursementAccount":"0012345678"}' \
  "Education loan (UNILAG MSc, ₦3.5M)"
post "http://localhost:8095/v1/education-loans/loans" \
  '{"studentId":"STU-002","studentName":"Patience Osagie","institution":"Covenant University","program":"BSc Accounting","amount":1800000,"currency":"NGN","tenorMonths":36,"interestRate":7.5,"guarantorName":"Rasheed Olanrewaju","guarantorBVN":"22005556666","disbursementAccount":"2098765432"}' \
  "Education loan (Covenant BSc, ₦1.8M)"
echo ""

# ── ERPNext Sync :8096 ──
echo "▸ ERPNext Sync (:8096)"
post "http://localhost:8096/v1/erpnext/sync-jobs" \
  '{"type":"journal_entry","direction":"push","status":"completed","entries":[{"account":"Cash - 54Bank","debit":5000000,"credit":0},{"account":"Customer Deposits","debit":0,"credit":5000000}],"reference":"JV-2026-0042"}' \
  "Journal entry sync (₦5M cash deposit)"
post "http://localhost:8096/v1/erpnext/sync-jobs" \
  '{"type":"invoice","direction":"pull","status":"pending","entries":[{"account":"Service Revenue","debit":0,"credit":250000},{"account":"Accounts Receivable","debit":250000,"credit":0}],"reference":"INV-2026-0108"}' \
  "Invoice sync (₦250K service revenue)"
echo ""

# ── Esusu Groups :8097 ──
echo "▸ Esusu Groups (:8097)"
post "http://localhost:8097/v1/esusu/groups" \
  '{"name":"Market Women Savings Circle","description":"Monthly savings for Balogun Market traders","contributionAmount":50000,"currency":"NGN","frequency":"monthly","members":["Fatima Abdullahi","Jumoke Adeyemi","Lateefat Balogun","Maryam Suleiman","Ngozi Uche"],"maxMembers":10,"startDate":"2026-01-01"}' \
  "Esusu group (Market Women, ₦50K/month)"
post "http://localhost:8097/v1/esusu/groups" \
  '{"name":"Tech Bros Fund","description":"Weekly contribution for Yaba tech workers","contributionAmount":25000,"currency":"NGN","frequency":"weekly","members":["Emeka Nwosu","Kelechi Eze","Obinna Okonkwo"],"maxMembers":8,"startDate":"2026-01-06"}' \
  "Esusu group (Tech Bros, ₦25K/week)"
echo ""

# ── Group Lending :8098 ──
echo "▸ Group Lending (:8098)"
post "http://localhost:8098/v1/group-lending/groups" \
  '{"name":"Farmers Cooperative Kaduna","purpose":"Agricultural input financing","members":[{"name":"Dauda Sani","role":"chairman"},{"name":"Yusuf Danjuma","role":"secretary"},{"name":"Halima Garba","role":"treasurer"},{"name":"Amina Bello","role":"member"}],"loanAmount":2000000,"currency":"NGN","interestRate":5.0,"tenorMonths":12,"repaymentFrequency":"monthly"}' \
  "Group lending (Farmers Coop Kaduna, ₦2M)"
echo ""

# ── Agent Banking :8099 ──
echo "▸ Agent Banking (:8099)"
post "http://localhost:8099/v1/agents" \
  '{"agentId":"AGT-001","name":"Mama Nkechi Mobile Money","location":"Oshodi Market, Lagos","phoneNumber":"+2348077889900","commissionTier":"gold","floatBalance":500000,"transactionsToday":45,"status":"active","geoLocation":{"lat":6.5568,"lng":3.3515}}' \
  "Agent (Mama Nkechi, Oshodi)"
post "http://localhost:8099/v1/agents" \
  '{"agentId":"AGT-002","name":"Alhaji Musa POS Hub","location":"Sabon Gari, Kano","phoneNumber":"+2348066778899","commissionTier":"silver","floatBalance":250000,"transactionsToday":22,"status":"active","geoLocation":{"lat":12.0022,"lng":8.5920}}' \
  "Agent (Alhaji Musa, Kano)"
echo ""

# ── Virtual Accounts :8100 ──
echo "▸ Virtual Accounts (:8100)"
post "http://localhost:8100/v1/virtual-accounts/accounts" \
  '{"customerId":"CUST-002","accountName":"Ibrahim Musa - Payroll","purpose":"salary_disbursement","currency":"NGN","parentAccount":"3034567890","dailyLimit":50000000}' \
  "Virtual account (Payroll)"
post "http://localhost:8100/v1/virtual-accounts/accounts" \
  '{"customerId":"CUST-001","accountName":"Fatima Collections","purpose":"collections","currency":"NGN","parentAccount":"0012345678","dailyLimit":10000000}' \
  "Virtual account (Collections)"
echo ""

# ── Mortgage Servicing :8101 ──
echo "▸ Mortgage Servicing (:8101)"
post "http://localhost:8101/v1/mortgage/applications" \
  '{"customerId":"CUST-002","propertyAddress":"Plot 15, Banana Island, Ikoyi, Lagos","propertyValue":150000000,"loanAmount":120000000,"interestRate":12.5,"tenorYears":20,"employerName":"FirstBank Nigeria PLC","monthlyIncome":2500000,"monthlyExpenses":800000,"downPayment":30000000}' \
  "Mortgage application (Banana Island, ₦120M)"
post "http://localhost:8101/v1/mortgage/applications" \
  '{"customerId":"CUST-003","propertyAddress":"Block C, Flat 4, Jabi District, Abuja","propertyValue":45000000,"loanAmount":36000000,"interestRate":14.0,"tenorYears":15,"employerName":"Sterling Bank","monthlyIncome":800000,"monthlyExpenses":300000,"downPayment":9000000,"nhfEligible":true}' \
  "Mortgage application (Jabi Abuja, ₦36M, NHF)"
echo ""

# ── Identity & Channels :8102 ──
echo "▸ Identity & Channels (:8102)"
post "http://localhost:8102/v1/identity/profiles" \
  '{"customerId":"CUST-001","bvn":"22001234567","nin":"98765432101","channels":["mobile","ussd","internet_banking"],"kycLevel":2,"lastVerified":"2026-01-10"}' \
  "Identity profile (Fatima, KYC L2)"
post "http://localhost:8102/v1/identity/profiles" \
  '{"customerId":"CUST-002","bvn":"22009876543","nin":"12345678901","channels":["mobile","internet_banking","corporate_portal","api"],"kycLevel":3,"lastVerified":"2026-01-05"}' \
  "Identity profile (Ibrahim, KYC L3)"
echo ""

# ── Regulatory Reporting :8103 ──
echo "▸ Regulatory Reporting (:8103)"
post "http://localhost:8103/v1/regulatory/reports" \
  '{"reportType":"ctr","title":"Currency Transaction Report - January 2026","period":"2026-01","status":"submitted","submittedTo":"CBN","transactionCount":1247,"totalAmount":8500000000,"flaggedCount":12}' \
  "CTR report (Jan 2026)"
post "http://localhost:8103/v1/regulatory/reports" \
  '{"reportType":"ndic_returns","title":"NDIC Quarterly Returns - Q4 2025","period":"2025-Q4","status":"approved","submittedTo":"NDIC","totalDeposits":125000000000,"totalLoans":78000000000,"nplRatio":3.2}' \
  "NDIC returns (Q4 2025)"
post "http://localhost:8103/v1/regulatory/reports" \
  '{"reportType":"aml_str","title":"Suspicious Transaction Report","period":"2026-01","status":"pending_review","submittedTo":"NFIU","transactionCount":3,"totalAmount":45000000,"flaggedCount":3}' \
  "AML/STR report (3 flagged)"
echo ""

# ── Customer Engagement :8104 ──
echo "▸ Customer Engagement (:8104)"
post "http://localhost:8104/v1/engagement/referrals" \
  '{"referrerId":"CUST-001","referredName":"Blessing Ehigiator","referredPhone":"+2348033445566","product":"savings","status":"converted","rewardAmount":5000}' \
  "Referral (Fatima → Blessing)"
post "http://localhost:8104/v1/engagement/referrals" \
  '{"referrerId":"CUST-002","referredName":"Chukwuma Okoro","referredPhone":"+2348044556677","product":"current","status":"pending","rewardAmount":10000}' \
  "Referral (Ibrahim → Chukwuma)"
echo ""

# ── Fraud Detection :8105 ──
echo "▸ Fraud Detection (:8105)"
post "http://localhost:8105/v1/fraud/screenings" \
  '{"transactionId":"TXN-20260115-089","customerId":"CUST-001","amount":9500000,"currency":"NGN","channel":"internet_banking","destinationCountry":"NG","riskScore":0.82,"flags":["high_amount","unusual_time","new_beneficiary"],"decision":"review","ipAddress":"105.112.45.67"}' \
  "Fraud screening (₦9.5M, high risk)"
post "http://localhost:8105/v1/fraud/screenings" \
  '{"transactionId":"TXN-20260116-012","customerId":"CUST-003","amount":150000,"currency":"NGN","channel":"pos","destinationCountry":"NG","riskScore":0.15,"flags":[],"decision":"approve","ipAddress":""}' \
  "Fraud screening (₦150K POS, low risk)"
echo ""

# ── Treasury & Liquidity :8110 ──
echo "▸ Treasury & Liquidity (:8110)"
post "http://localhost:8110/v1/treasury/investments" \
  '{"type":"treasury_bill","amount":500000000,"currency":"NGN","interestRate":11.5,"tenorDays":91,"maturityDate":"2026-04-15","counterparty":"CBN","status":"active"}' \
  "T-bill investment (₦500M, 91-day)"
post "http://localhost:8110/v1/treasury/investments" \
  '{"type":"fixed_income","amount":1000000000,"currency":"NGN","interestRate":14.0,"tenorDays":365,"maturityDate":"2027-01-10","counterparty":"FGN Bonds","status":"active"}' \
  "FGN Bond (₦1B, 14%)"
post "http://localhost:8110/v1/treasury/fx-positions" \
  '{"currencyPair":"USD/NGN","buyAmount":5000000,"sellAmount":7500000000,"rate":1500.00,"dealType":"spot","counterparty":"JP Morgan","status":"settled"}' \
  "FX position (USD/NGN spot)"
echo ""

# ── Batch Processing :8117 ──
echo "▸ Batch Processing (:8117)"
post "http://localhost:8117/v1/batch/jobs" \
  '{"jobType":"eod_processing","status":"completed","startedAt":"2026-01-15T23:00:00Z","completedAt":"2026-01-15T23:45:00Z","recordsProcessed":125000,"recordsFailed":3,"description":"End of day processing - Jan 15"}' \
  "EOD batch job (125K records)"
post "http://localhost:8117/v1/batch/jobs" \
  '{"jobType":"interest_accrual","status":"completed","startedAt":"2026-01-15T23:50:00Z","completedAt":"2026-01-16T00:15:00Z","recordsProcessed":89000,"recordsFailed":0,"description":"Monthly interest accrual - January"}' \
  "Interest accrual batch (89K records)"
post "http://localhost:8117/v1/batch/jobs" \
  '{"jobType":"statement_generation","status":"running","startedAt":"2026-01-16T01:00:00Z","recordsProcessed":45000,"description":"Monthly statement generation - January"}' \
  "Statement generation batch (in progress)"
echo ""

# ── FX & Rates Engine :8118 ──
echo "▸ FX & Rates Engine (:8118)"
post "http://localhost:8118/v1/fx/deals" \
  '{"dealType":"spot","currencyPair":"USD/NGN","buyAmount":100000,"sellAmount":150000000,"rate":1500.00,"customerId":"CUST-002","status":"executed","settlement":"T+2"}' \
  "FX spot deal (USD/NGN, $100K)"
post "http://localhost:8118/v1/fx/deals" \
  '{"dealType":"forward","currencyPair":"GBP/NGN","buyAmount":50000,"sellAmount":97500000,"rate":1950.00,"customerId":"CUST-003","status":"pending","settlement":"T+30","maturityDate":"2026-02-15"}' \
  "FX forward deal (GBP/NGN, £50K)"
echo ""

# ── Loan Calculator :8119 ──
echo "▸ Loan Calculator (:8119)"
post "http://localhost:8119/v1/loan-calculator" \
  '{"principal":5000000,"interestRate":18.0,"tenorMonths":24,"type":"reducing_balance","purpose":"SME working capital"}' \
  "Loan calculation (₦5M SME, 18%)"
post "http://localhost:8119/v1/loan-calculator" \
  '{"principal":50000000,"interestRate":12.5,"tenorMonths":240,"type":"fixed_rate","purpose":"mortgage"}' \
  "Loan calculation (₦50M mortgage, 12.5%)"
echo ""

# ── Branch Operations :8120 ──
echo "▸ Branch Operations (:8120)"
post "http://localhost:8120/v1/branches" \
  '{"branchCode":"BR-LOS-001","name":"Victoria Island Main Branch","address":"Plot 252, Ajose Adeogun Street, Victoria Island, Lagos","manager":"Tolulope Akinwale","phoneNumber":"+2341234567890","status":"open","cashPosition":125000000,"atmCount":4,"staffCount":35,"geoLocation":{"lat":6.4281,"lng":3.4219}}' \
  "Branch (Victoria Island Main)"
post "http://localhost:8120/v1/branches" \
  '{"branchCode":"BR-ABJ-001","name":"Abuja Central Branch","address":"Plot 1780, Cadastral Zone, Central Business District, Abuja","manager":"Samuel Okafor","phoneNumber":"+2349876543210","status":"open","cashPosition":95000000,"atmCount":3,"staffCount":28,"geoLocation":{"lat":9.0579,"lng":7.4951}}' \
  "Branch (Abuja Central)"
post "http://localhost:8120/v1/branches" \
  '{"branchCode":"BR-KAN-001","name":"Kano Main Branch","address":"7 Bompai Road, Nassarawa GRA, Kano","manager":"Yusuf Danjuma","phoneNumber":"+2348011223344","status":"open","cashPosition":68000000,"atmCount":2,"staffCount":22,"geoLocation":{"lat":12.0022,"lng":8.5920}}' \
  "Branch (Kano Main)"
echo ""

# ── TigerBeetle Ledger :8121 ──
echo "▸ TigerBeetle Ledger (:8121)"
post "http://localhost:8121/v1/ledger/transfers" \
  '{"debitAccount":"ASSET:CASH:NGN","creditAccount":"LIABILITY:DEPOSITS:SAVINGS:NGN","amount":5000000,"currency":"NGN","narration":"Customer deposit - Fatima Abdullahi","reference":"DEP-2026-0001"}' \
  "Ledger transfer (₦5M cash deposit)"
post "http://localhost:8121/v1/ledger/transfers" \
  '{"debitAccount":"EXPENSE:INTEREST:SAVINGS:NGN","creditAccount":"LIABILITY:INTEREST_PAYABLE:NGN","amount":125000,"currency":"NGN","narration":"Monthly interest accrual - January 2026","reference":"INT-2026-0001"}' \
  "Ledger transfer (₦125K interest accrual)"
echo ""

# ── Event Bus :8122 ──
echo "▸ Event Bus (:8122)"
post "http://localhost:8122/v1/events/topics" \
  '{"name":"transaction.completed","description":"Published when any financial transaction completes","schema":"v1","partitions":12,"retentionDays":90}' \
  "Event topic (transaction.completed)"
post "http://localhost:8122/v1/events/topics" \
  '{"name":"kyc.status.changed","description":"Published when customer KYC status changes","schema":"v1","partitions":6,"retentionDays":365}' \
  "Event topic (kyc.status.changed)"
post "http://localhost:8122/v1/events/topics" \
  '{"name":"fraud.alert.triggered","description":"Published when fraud detection flags a transaction","schema":"v1","partitions":3,"retentionDays":730}' \
  "Event topic (fraud.alert.triggered)"
echo ""

# ── Workflow Engine :8123 ──
echo "▸ Workflow Engine (:8123)"
post "http://localhost:8123/v1/workflows" \
  '{"name":"loan-origination","description":"End-to-end loan approval workflow","steps":["application","credit_check","collateral_valuation","committee_review","disbursement"],"status":"active","currentStep":"committee_review","assignee":"Loan Committee","customerId":"CUST-001"}' \
  "Workflow (loan origination)"
post "http://localhost:8123/v1/workflows" \
  '{"name":"account-closure","description":"Account closure and balance settlement","steps":["request","balance_check","pending_txn_check","final_statement","closure"],"status":"active","currentStep":"balance_check","assignee":"Operations","customerId":"CUST-003"}' \
  "Workflow (account closure)"
echo ""

# ── Mojaloop Connector :8124 ──
echo "▸ Mojaloop Connector (:8124)"
post "http://localhost:8124/v1/mojaloop/transfers" \
  '{"transferId":"MLT-001","payerFsp":"54bank","payeeFsp":"access-bank","amount":250000,"currency":"NGN","payerName":"Fatima Abdullahi","payeeName":"Kehinde Adesanya","status":"committed","initiatedAt":"2026-01-15T10:30:00Z"}' \
  "Mojaloop transfer (₦250K interop)"
post "http://localhost:8124/v1/mojaloop/transfers" \
  '{"transferId":"MLT-002","payerFsp":"wema-bank","payeeFsp":"54bank","amount":1500000,"currency":"NGN","payerName":"External Customer","payeeName":"Ibrahim Musa","status":"reserved","initiatedAt":"2026-01-15T11:45:00Z"}' \
  "Mojaloop transfer (₦1.5M inbound)"
echo ""

# ── OpenSearch Analytics :8125 ──
echo "▸ OpenSearch Analytics (:8125)"
post "http://localhost:8125/v1/search/indices" \
  '{"name":"transactions-2026-01","description":"January 2026 transaction logs","documentCount":125000,"sizeBytes":2500000000,"status":"green","replicas":1,"shards":5}' \
  "Search index (transactions Jan 2026)"
post "http://localhost:8125/v1/search/indices" \
  '{"name":"audit-logs-2026","description":"2026 audit trail and compliance logs","documentCount":890000,"sizeBytes":8900000000,"status":"green","replicas":2,"shards":10}' \
  "Search index (audit logs 2026)"
echo ""

# ── Dapr Sidecar :8128 ──
echo "▸ Dapr Sidecar Manager (:8128)"
post "http://localhost:8128/v1/dapr/apps" \
  '{"appId":"teller-service","port":8091,"protocol":"http","healthEndpoint":"/healthz","status":"running","lastHealthCheck":"2026-01-15T12:00:00Z"}' \
  "Dapr app (teller-service)"
post "http://localhost:8128/v1/dapr/apps" \
  '{"appId":"payments-hub","port":8109,"protocol":"http","healthEndpoint":"/healthz","status":"running","lastHealthCheck":"2026-01-15T12:00:00Z"}' \
  "Dapr app (payments-hub)"
echo ""

# ── Permify AuthZ :8129 ──
echo "▸ Permify Authorization (:8129)"
# Already seeded with 10 roles and 13 policies, just add a few more permission tuples
post "http://localhost:8129/v1/authz/permissions" \
  '{"entity":"mortgage","relation":"approver","subject":"role:branch_manager","description":"Branch managers can approve mortgages under ₦50M"}' \
  "Permission (branch_manager → mortgage approver)"
post "http://localhost:8129/v1/authz/permissions" \
  '{"entity":"fx_deal","relation":"dealer","subject":"role:treasury_officer","description":"Treasury officers can execute FX deals"}' \
  "Permission (treasury_officer → FX dealer)"
echo ""

# ── Keycloak Identity :8130 ──
echo "▸ Keycloak Identity (:8130)"
post "http://localhost:8130/v1/identity/users" \
  '{"username":"fadullahi","firstName":"Fatima","lastName":"Abdullahi","email":"fatima@54bank.ng","roles":["teller","customer_service"],"enabled":true,"realm":"54bank"}' \
  "Keycloak user (Fatima, teller)"
post "http://localhost:8130/v1/identity/users" \
  '{"username":"imusa","firstName":"Ibrahim","lastName":"Musa","email":"ibrahim@54bank.ng","roles":["branch_manager","treasury_officer"],"enabled":true,"realm":"54bank"}' \
  "Keycloak user (Ibrahim, branch_manager)"
post "http://localhost:8130/v1/identity/users" \
  '{"username":"jadeyemi","firstName":"Jumoke","lastName":"Adeyemi","email":"jumoke@54bank.ng","roles":["compliance_officer","aml_analyst"],"enabled":true,"realm":"54bank"}' \
  "Keycloak user (Jumoke, compliance)"
echo ""

# ── Agriculture Banking :8090 ──
echo "▸ Agriculture Banking (:8090)"
post "http://localhost:8090/v1/agriculture/loans" \
  '{"farmerId":"FRM-001","farmerName":"Dauda Sani","cropType":"Maize","landSize":15.5,"loanAmount":2500000,"currency":"NGN","season":"2026-wet","interestRate":5.0,"insuranceCoverage":true,"geoZone":"North West"}' \
  "Agri loan (Dauda, Maize, ₦2.5M)"
post "http://localhost:8090/v1/agriculture/insurance" \
  '{"farmerId":"FRM-001","policyType":"crop_insurance","crop":"Maize","coverage":2500000,"premium":125000,"season":"2026-wet","region":"Kaduna","status":"active"}' \
  "Crop insurance (Maize, ₦2.5M coverage)"
echo ""

# ── Ledger Reconciliation :8111 ──
echo "▸ Ledger Reconciliation (:8111)"
post "http://localhost:8111/v1/ledger-recon/runs" \
  '{"reconType":"daily_nostro","sourceSystem":"core_banking","targetSystem":"cbn_rtgs","period":"2026-01-15","status":"completed","matchedCount":1247,"unmatchedCount":3,"totalAmount":45000000000}' \
  "Recon run (daily nostro, 3 unmatched)"
post "http://localhost:8111/v1/ledger-recon/runs" \
  '{"reconType":"atm_settlement","sourceSystem":"card_switch","targetSystem":"core_banking","period":"2026-01-15","status":"completed","matchedCount":8900,"unmatchedCount":12,"totalAmount":890000000}' \
  "Recon run (ATM settlement)"
echo ""

echo ""
echo "══════════════════════════════════════════════════"
echo "  Seed Complete: $PASS passed, $FAIL failed, $SKIP skipped"
echo "══════════════════════════════════════════════════"
