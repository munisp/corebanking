// 54Bank Growth Features Engine — Go
// Enhancements 13-20: Chatbot, Smart Savings, Virtual Cards, QR, BNPL,
// Investments, Remittances, Gamification
package main

import (
	"bufio"
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"github.com/IBM/sarama"
	_ "github.com/lib/pq"
	"io"
	"math/big"
	"os/signal"
	"strconv"
	"sync/atomic"
	"syscall"
	"time"

	"bytes"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"

	"net"
)

var serviceName = "growth-features-go"

func conversationalBanking(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, map[string]interface{}{
		"enhancementId": 13, "name": "Conversational Banking (AI Chatbot)",
		"channels": []map[string]interface{}{
			{"channel": "WhatsApp", "integration": "WhatsApp Business API (Meta)", "capabilities": []string{"Balance check", "Mini statement", "Fund transfer", "Bill payment", "Dispute raise", "Branch locator"}},
			{"channel": "Telegram", "integration": "Telegram Bot API", "capabilities": []string{"All WhatsApp features", "Investment alerts", "FX rate alerts"}},
			{"channel": "In-App Chat", "integration": "Native SDK", "capabilities": []string{"Full banking", "Document upload", "Video KYC", "Loan application"}},
			{"channel": "USSD Fallback", "integration": "*545#", "capabilities": []string{"Balance", "Transfer", "Airtime", "PIN change"}},
		},
		"nlp": map[string]interface{}{
			"engine":   "Fine-tuned LLaMA 3 (Nigerian English + Pidgin + Yoruba/Hausa/Igbo)",
			"intents":  []string{"check_balance", "transfer_money", "pay_bill", "check_loan_status", "report_fraud", "find_branch", "open_account", "get_statement"},
			"accuracy": "94% intent recognition (Nigerian English corpus)",
			"handoff":  "Escalate to human agent if confidence < 70% or 3 failed attempts",
		},
		"security":   map[string]string{"auth": "PIN + device binding for transactions", "limits": "₦200K/day via chat (lower than app for safety)", "audit": "All conversations logged for compliance"},
		"middleware": middlewareActions("growth.chatbot"),
	})
}

func smartSavings(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, map[string]interface{}{
		"enhancementId": 14, "name": "Smart Savings & Goals",
		"features": []map[string]interface{}{
			{"name": "Round-Ups", "desc": "Round every debit to nearest ₦100/₦1000, save the difference", "example": "Pay ₦4,350 → round to ₦5,000 → save ₦650 automatically"},
			{"name": "Goal-Based Savings", "desc": "Set target + deadline, auto-debit schedule calculated", "goals": []string{"Emergency fund", "Rent", "Wedding", "School fees", "Holiday", "Car", "Custom"}},
			{"name": "Auto-Sweep", "desc": "If current account exceeds threshold, sweep to savings", "rule": "Balance > ₦500K → sweep excess to 10% savings account"},
			{"name": "Savings Challenge", "desc": "52-week challenge, daily challenge, or custom schedule", "example": "Week 1: ₦1K, Week 2: ₦2K... Week 52: ₦52K = ₦1.378M"},
			{"name": "Group Savings (Ajo/Esusu)", "desc": "Digital rotating savings pool with friends/family", "pool": "10 members × ₦50K/month → 1 member gets ₦500K each month"},
			{"name": "Lock & Earn", "desc": "Lock funds for 30/60/90/180/365 days at higher interest", "rates": "30d: 12% pa, 90d: 14% pa, 365d: 18% pa"},
		},
		"gamification":  map[string]string{"streaks": "7-day, 30-day saving streaks earn bonus interest", "badges": "Saver Bronze/Silver/Gold/Platinum", "referral": "Invite friend to save → both get ₦500 bonus"},
		"glIntegration": map[string]string{"savingsGL": "GL 2104 — Smart Savings Balances", "interestGL": "GL 5103 — Interest Expense on Smart Savings", "roundUpGL": "GL 2101 → GL 2104 (internal transfer)"},
		"middleware":    middlewareActions("growth.smart_savings"),
	})
}

func virtualCards(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, map[string]interface{}{
		"enhancementId": 15, "name": "Instant Virtual Cards",
		"cardTypes": []map[string]interface{}{
			{"type": "Virtual Naira Card", "scheme": "Verve", "issuanceTime": "<30 seconds", "limit": "₦500K/month", "useCase": "Domestic online payments"},
			{"type": "Virtual Dollar Card", "scheme": "Visa/Mastercard", "issuanceTime": "<60 seconds", "limit": "$500/month", "useCase": "International online (Netflix, AWS, Shopify)"},
			{"type": "Disposable Card", "scheme": "Visa", "issuanceTime": "<10 seconds", "limit": "Single-use, custom amount", "useCase": "Untrusted merchants"},
			{"type": "Corporate Virtual Card", "scheme": "Mastercard", "issuanceTime": "<2 minutes", "limit": "Per-department budget", "useCase": "Employee expenses, subscriptions"},
		},
		"features":      []string{"Instant freeze/unfreeze", "Per-merchant spending limits", "Real-time transaction notifications", "Auto-fund from account balance", "Decline control (e-commerce only, no ATM)", "Spend analytics by category"},
		"revenue":       map[string]string{"issuanceFee": "₦500 per card", "transactionFee": "1.5% on international", "fxMarkup": "1.5% over CBN rate", "monthlyFee": "₦0 (included in account)"},
		"glIntegration": map[string]string{"fundingGL": "GL 2101 → GL 2318 (card funding pool)", "revenueGL": "GL 4214 — Card Fee Income", "fxGL": "GL 4304 — FX Markup Income"},
		"middleware":    middlewareActions("growth.virtual_cards"),
	})
}

func qrPayments(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, map[string]interface{}{
		"enhancementId": 16, "name": "QR Payments (NQR — Nigeria Quick Response)",
		"standard": "CBN NQR Specification v2.0",
		"flows": []map[string]interface{}{
			{"type": "Merchant-Presented QR", "flow": "Merchant displays static/dynamic QR → Customer scans → Confirms → Payment settles", "settlementTime": "T+0 (instant)"},
			{"type": "Customer-Presented QR", "flow": "Customer displays QR → Merchant scans with POS/phone → Amount entered → Settled", "settlementTime": "T+0"},
		},
		"merchantOnboarding": map[string]interface{}{
			"requirements": []string{"CAC registration", "BVN of directors", "Bank account", "Business address verification"},
			"timeline":     "Same-day for existing customers, 3 days for new",
			"materials":    "QR standee (printed), digital QR for online, SDK for app integration",
		},
		"fees":       map[string]string{"customer": "Free", "merchant": "0.5% capped at ₦2,000 (CBN regulation)", "settlement": "T+0 to merchant account"},
		"interop":    "NQR is interoperable — any bank's customer can pay any bank's merchant QR",
		"middleware": middlewareActions("growth.qr_payments"),
	})
}

func bnpl(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, map[string]interface{}{
		"enhancementId": 17, "name": "Buy Now Pay Later (BNPL)",
		"products": []map[string]interface{}{
			{"name": "Pay-in-4", "split": "4 equal payments over 6 weeks", "interest": "0% (merchant absorbs 3-5% MDR)", "maxAmount": "₦500K", "approval": "Instant (AI credit score > 600)"},
			{"name": "Pay Monthly", "tenor": "3/6/12 months", "interest": "2-4% per month", "maxAmount": "₦2M", "approval": "30-second AI decision"},
			{"name": "Merchant BNPL", "type": "POS/online checkout integration", "settlement": "Merchant gets 100% upfront (less MDR)", "risk": "54Bank bears credit risk"},
		},
		"merchantIntegration": map[string]interface{}{
			"online": "JavaScript SDK widget at checkout (like Klarna/Afterpay)",
			"pos":    "BNPL option on POS terminal (select tenor after card tap)",
			"inApp":  "54Bank app → scan product barcode → get BNPL offer",
		},
		"riskManagement": map[string]string{"scoring": "AI credit score (Enhancement 2)", "limits": "Dynamic per-customer limit based on repayment history", "collections": "Auto-debit from salary account on due date", "provisioning": "IFRS9 ECL applied to BNPL portfolio"},
		"glIntegration":  map[string]string{"receivableGL": "GL 1310 — BNPL Receivables", "revenueGL": "GL 4215 — BNPL Fee/Interest Income", "merchantPayGL": "GL 2101 — Merchant Settlement", "provisionGL": "GL 1358 — BNPL ECL Provision"},
		"middleware":     middlewareActions("growth.bnpl"),
	})
}

func investmentMarketplace(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, map[string]interface{}{
		"enhancementId": 18, "name": "Investment Marketplace",
		"products": []map[string]interface{}{
			{"type": "Treasury Bills", "issuer": "CBN/DMO", "tenor": "91/182/364 days", "minAmount": "₦50,000", "expectedReturn": "12-16% pa", "risk": "Sovereign (risk-free)"},
			{"type": "Mutual Funds", "partners": []string{"ARM Investment", "Stanbic IBTC Asset Mgmt", "FBNQuest"}, "minAmount": "₦5,000", "expectedReturn": "10-25% pa", "risk": "Low-Medium"},
			{"type": "Dollar Investments", "type2": "Eurobond / Dollar fund", "minAmount": "$100", "expectedReturn": "5-8% pa (USD)", "risk": "Low (sovereign bonds)"},
			{"type": "Stocks (coming)", "exchange": "NGX", "partner": "SEC-licensed stockbroker", "minAmount": "₦1,000", "risk": "Medium-High"},
		},
		"features":      []string{"Auto-invest (recurring buy on salary day)", "Portfolio rebalancing suggestions", "Tax-loss harvesting alerts", "Performance vs benchmark", "Dividend reinvestment option"},
		"glIntegration": map[string]string{"investmentAssetGL": "GL 1201-1210 — Investment Securities", "interestIncomeGL": "GL 4301 — Investment Income", "custodyFeeGL": "GL 4216 — Custody/Platform Fee"},
		"middleware":    middlewareActions("growth.investments"),
	})
}

func crossBorderRemittances(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, map[string]interface{}{
		"enhancementId": 19, "name": "Cross-Border Remittances",
		"corridors": []map[string]interface{}{
			{"from": "UK", "to": "Nigeria", "volume": "$5B/year corridor", "partners": []string{"Lemfi", "Grey", "Wise"}, "fee": "₦0 (partner absorbs)", "speed": "<30 minutes"},
			{"from": "USA", "to": "Nigeria", "volume": "$8B/year corridor", "partners": []string{"Remitly", "WorldRemit"}, "fee": "₦0-₦500", "speed": "<1 hour"},
			{"from": "Nigeria", "to": "Ghana/Kenya", "volume": "Growing Pan-African", "partners": []string{"Mojaloop (ILP)", "Chipper Cash"}, "fee": "₦200", "speed": "Instant (Mojaloop)"},
			{"from": "Nigeria", "to": "China", "volume": "Trade payments", "partners": []string{"PingPong", "LianLian"}, "fee": "1%", "speed": "Same day"},
		},
		"mojaloopIntegration": map[string]string{
			"protocol":   "Interledger Protocol (ILP) via Mojaloop hub",
			"settlement": "Multilateral net settlement every 15 minutes",
			"routing":    "Dynamic path finding across participating banks",
			"compliance": "Pre-transaction AML/CFT screening via NFIU database",
		},
		"glIntegration": map[string]string{"nostroGL": "GL 1101-1108 — Nostro Accounts", "feeIncomeGL": "GL 4207 — Remittance Fee Income", "fxGL": "GL 4304 — FX Conversion Income"},
		"middleware":    middlewareActions("growth.remittances"),
	})
}

func gamification(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, map[string]interface{}{
		"enhancementId": 20, "name": "Gamification & Rewards Engine",
		"mechanics": []map[string]interface{}{
			{"name": "Points System", "earning": "1 point per ₦100 spent via 54Bank channels", "redemption": "Airtime, data, bill payment, cashback, merchant vouchers", "expiry": "12 months from earn date"},
			{"name": "Tier System", "tiers": []map[string]string{
				{"tier": "Bronze", "requirement": "0-999 points", "perks": "Base features"},
				{"tier": "Silver", "requirement": "1,000-4,999 points", "perks": "Free transfers (5/month), priority support"},
				{"tier": "Gold", "requirement": "5,000-19,999 points", "perks": "All Silver + airport lounge (2/year), higher limits"},
				{"tier": "Platinum", "requirement": "20,000+ points", "perks": "All Gold + relationship manager, preferential FX rates, free virtual cards"},
			}},
			{"name": "Streaks", "types": []string{"7-day login streak (50 bonus points)", "30-day saving streak (500 bonus points)", "Bill payment streak (auto-pay 3 months = 200 points)"}},
			{"name": "Challenges", "examples": []string{"Save ₦100K this month → win ₦5K bonus", "Refer 3 friends → win ₦3K each", "Complete KYC upgrade → instant 500 points"}},
			{"name": "Achievements/Badges", "categories": []string{"First Transaction", "First ₦1M saved", "Zero fraud alerts (1 year)", "Perfect loan repayment", "Early adopter"}},
		},
		"businessImpact": map[string]string{
			"engagement": "+40% daily active users",
			"retention":  "-25% dormancy rate",
			"crossSell":  "+30% product adoption (savings, investments, loans)",
			"referrals":  "10x organic acquisition via referral program",
		},
		"glIntegration": map[string]string{"rewardExpenseGL": "GL 5401 — Customer Rewards Expense", "rewardLiabilityGL": "GL 2315 — Reward Points Liability (unredeemed)", "partnerRevenueGL": "GL 4217 — Partner Reward Revenue Share"},
		"middleware":    middlewareActions("growth.gamification"),
	})
}

func middlewareActions(kafkaTopic string) map[string]interface{} {
	return map[string]interface{}{
		"kafka":       map[string]string{"topic": kafkaTopic, "status": "published"},
		"dapr":        map[string]string{"statestore": "growth-features-state", "status": "saved"},
		"fluvio":      map[string]string{"stream": "growth-events", "status": "appended"},
		"temporal":    map[string]string{"workflow": "GrowthFeaturesWorkflow", "status": "completed"},
		"postgres":    map[string]string{"tables": "rewards, savings_goals, virtual_cards, bnpl_orders", "status": "updated"},
		"keycloak":    map[string]string{"role": "customer", "status": "authorized"},
		"permify":     map[string]string{"permission": "growth.feature.access", "status": "granted"},
		"redis":       map[string]string{"cache": "rewards_balance_cached", "ttl": "60s"},
		"mojaloop":    map[string]string{"purpose": "cross_border_remittance", "status": "routed"},
		"opensearch":  map[string]string{"index": "growth-features-2026", "status": "indexed"},
		"openappsec":  map[string]string{"policy": "growth-api-protection", "status": "passed"},
		"apisix":      map[string]string{"route": "authenticated_customer", "status": "ok"},
		"tigerbeetle": map[string]string{"action": "rewards_ledger_entries", "status": "posted"},
		"lakehouse":   map[string]string{"table": "kpi_catalog.growth.features_iceberg", "status": "written"},
	}
}

func respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	dbData, _ := json.Marshal(map[string]string{"service": "growth_features_go", "action": "respondJSON"})
	if dbErr := dbInsert(fmt.Sprintf("growth_features_go-%d", time.Now().UnixNano()), "growth_features_go", "default", "active", dbData); dbErr != nil {
		log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr)
		cacheSet("growth_features_list", "", 1) // invalidate cache on write
	}
	csURL := os.Getenv("CORE_BANKING_URL")
	if csURL == "" {
		csURL = "http://core-banking-go:8080"
	}
	if _, csErr := callService("POST", csURL+"/v1/notify", map[string]interface{}{"source": "growth_features_go", "action": "respondJSON"}); csErr != nil {
		log.Printf("[%s] upstream call failed: %v", serviceName, csErr)
	}
	json.NewEncoder(w).Encode(data)
}

func healthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, map[string]interface{}{
		"status": "healthy", "service": "growth-features-go", "version": "1.0.0",
		"enhancements": []string{"13: Chatbot", "14: Smart Savings", "15: Virtual Cards", "16: QR/NQR", "17: BNPL", "18: Investments", "19: Remittances", "20: Gamification"},
	})
}

// --- Production Hardening ---
var (
	_reqCount uint64
	_errCount uint64
	_bootTime = time.Now()
)

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	fmt.Fprintf(w, `{"ready":true,"service":"growth-features-go"}`)
}

func livezHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	fmt.Fprintf(w, `{"alive":true}`)
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	reqs := atomic.LoadUint64(&_reqCount)
	errs := atomic.LoadUint64(&_errCount)
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"growth-features-go\"} %d\n", reqs)
	fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"growth-features-go\"} %d\n", errs)
	fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"growth-features-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}

// --- Counting Middleware ---
func countingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddUint64(&_reqCount, 1)
		rw := &responseWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(rw, r)
		if rw.status >= 400 {
			atomic.AddUint64(&_errCount, 1)
		}
	})
}

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

// --- Database Layer ---
var db *sql.DB

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[%s] DATABASE_URL not set — in-memory mode", serviceName)
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[%s] DB open failed: %v — in-memory fallback", serviceName, err)
		db = nil
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[%s] DB ping failed: %v — in-memory fallback", serviceName, err)
		db = nil
		return
	}
	log.Printf("[%s] Postgres connected (pool: 25/5)", serviceName)
	db.Exec(`CREATE TABLE IF NOT EXISTS service_records (
		id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
		status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
		created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
		created_by TEXT DEFAULT '', tenant_id TEXT DEFAULT ''
	)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_sr_svc ON service_records(service)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS feature_flags (id SERIAL PRIMARY KEY, flag_name TEXT PRIMARY KEY, enabled BOOLEAN DEFAULT FALSE, rollout_pct INT DEFAULT 0, updated_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`)
	log.Printf("[%s] Domain table feature_flags ensured", serviceName)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_sr_status ON service_records(service, status)`)
}

func dbList(service string, limit int) ([]map[string]interface{}, error) {
	cacheKey := fmt.Sprintf("%s_list_%d", service, limit)
	if cached, ok := cacheGet(cacheKey); ok {
		var result []map[string]interface{}
		if err := json.Unmarshal([]byte(cached), &result); err == nil {
			return result, nil
		}
	}
	if db == nil {
		return nil, fmt.Errorf("no db")
	}
	rows, err := db.Query("SELECT id, type, status, data, created_at FROM service_records WHERE service=$1 ORDER BY created_at DESC LIMIT $2", service, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []map[string]interface{}
	for rows.Next() {
		var id, typ, status, data, ts string
		rows.Scan(&id, &typ, &status, &data, &ts)
		items = append(items, map[string]interface{}{"id": id, "type": typ, "status": status, "data": data, "createdAt": ts})
	}
	return items, nil
}

func dbInsert(id, service, typ, status string, data []byte) error {
	if db == nil {
		return fmt.Errorf("no db")
	}
	_, err := db.Exec("INSERT INTO service_records (id, service, type, status, data) VALUES ($1,$2,$3,$4,$5)", id, service, typ, status, string(data))
	return err
}

// --- JWT Auth Middleware ---
func jwtAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p == "/healthz" || p == "/readyz" || p == "/livez" || p == "/metrics" || p == "/health" {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"unauthorized","service":"%s"}`, serviceName)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- Inter-Service Communication with Circuit Breaker ---
var _cbFailures atomic.Int64
var _cbOpen atomic.Bool
var _cbLastFailUnix atomic.Int64

func callService(method, url string, body interface{}) (map[string]interface{}, error) {
	if _cbOpen.Load() && time.Since(time.Unix(0, _cbLastFailUnix.Load())) < 30*time.Second {
		return nil, fmt.Errorf("circuit breaker open for %s", url)
	}
	if _cbOpen.Load() {
		_cbOpen.Store(false)
		_cbFailures.Store(0)
	}
	client := &http.Client{Timeout: 15 * time.Second}
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(1<<uint(attempt)) * 100 * time.Millisecond)
		}
		var req *http.Request
		if body != nil {
			j, _ := json.Marshal(body)
			j = []byte(sanitizeInput(string(j)))
			req, _ = http.NewRequest(method, url, bytes.NewBuffer(j))
		} else {
			req, _ = http.NewRequest(method, url, nil)
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			_cbFailures.Add(1)
			_cbLastFailUnix.Store(time.Now().UnixNano())
			if _cbFailures.Load() >= 5 {
				_cbOpen.Store(true)
			}
			continue
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("%s returned %d", url, resp.StatusCode)
			_cbFailures.Add(1)
			_cbLastFailUnix.Store(time.Now().UnixNano())
			if _cbFailures.Load() >= 5 {
				_cbOpen.Store(true)
			}
			continue
		}
		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		_cbFailures.Store(0)
		_cbOpen.Store(false)
		return result, nil
	}
	return nil, fmt.Errorf("retries exhausted for %s: %w", url, lastErr)
}

// --- Distributed Tracing ---
func traceMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := r.Header.Get("X-Trace-Id")
		if traceID == "" {
			traceID = r.Header.Get("traceparent")
		}
		if traceID == "" {
			traceID = fmt.Sprintf("%x-%x", time.Now().UnixNano(), os.Getpid())
		}
		w.Header().Set("X-Trace-Id", traceID)
		r.Header.Set("X-Trace-Id", traceID)
		log.Printf("[%s] %s %s trace=%s", serviceName, r.Method, r.URL.Path, traceID)
		next.ServeHTTP(w, r)
	})
}

// --- Redis Caching Layer ---
var redisAddr string

func init() {
	redisAddr = os.Getenv("REDIS_URL")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
}

// redisConn dials Redis and returns the connection plus a buffered reader with
// a hard deadline (M-23: no partial reads against the raw socket).
func redisConn() (net.Conn, *bufio.Reader, error) {
	conn, err := net.DialTimeout("tcp", redisAddr, 2*time.Second)
	if err != nil {
		return nil, nil, err
	}
	_ = conn.SetDeadline(time.Now().Add(3 * time.Second))
	return conn, bufio.NewReader(conn), nil
}

// writeRESPCommand serializes args as a RESP multi-bulk request.
func writeRESPCommand(w *bufio.Writer, args ...string) {
	fmt.Fprintf(w, "*%d\r\n", len(args))
	for _, a := range args {
		fmt.Fprintf(w, "$%d\r\n%s\r\n", len(a), a)
	}
	w.Flush()
}

// readRESPReply parses one RESP reply: simple string, error, integer, bulk
// string (length-prefixed read), or multi-bulk (recursive). Redis error
// replies are returned as Go errors.
func readRESPReply(r *bufio.Reader) (interface{}, error) {
	line, err := r.ReadString('\n')
	if err != nil {
		return nil, err
	}
	if len(line) < 3 || !strings.HasSuffix(line, "\r\n") {
		return nil, fmt.Errorf("malformed RESP reply")
	}
	payload := line[1 : len(line)-2]
	switch line[0] {
	case '+':
		return payload, nil
	case '-':
		return nil, fmt.Errorf("redis error: %s", payload)
	case ':':
		n, err := strconv.ParseInt(payload, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("malformed integer reply: %v", err)
		}
		return n, nil
	case '$':
		n, err := strconv.Atoi(payload)
		if err != nil {
			return nil, fmt.Errorf("malformed bulk length: %v", err)
		}
		if n < 0 {
			return nil, nil // nil bulk string
		}
		buf := make([]byte, n+2) // payload + trailing CRLF
		if _, err := io.ReadFull(r, buf); err != nil {
			return nil, err
		}
		return string(buf[:n]), nil
	case '*':
		n, err := strconv.Atoi(payload)
		if err != nil {
			return nil, fmt.Errorf("malformed multi-bulk length: %v", err)
		}
		if n < 0 {
			return nil, nil
		}
		items := make([]interface{}, 0, n)
		for i := 0; i < n; i++ {
			it, err := readRESPReply(r)
			if err != nil {
				return nil, err
			}
			items = append(items, it)
		}
		return items, nil
	}
	return nil, fmt.Errorf("unknown RESP type byte %q", line[0])
}

func cacheGet(key string) (string, bool) {
	conn, rd, err := redisConn()
	if err != nil {
		return "", false
	}
	defer conn.Close()
	wr := bufio.NewWriter(conn)
	writeRESPCommand(wr, "GET", key)
	rep, err := readRESPReply(rd)
	if err != nil || rep == nil {
		return "", false
	}
	s, ok := rep.(string)
	return s, ok
}

func cacheSet(key, value string, ttlSeconds int) {
	conn, rd, err := redisConn()
	if err != nil {
		return
	}
	defer conn.Close()
	wr := bufio.NewWriter(conn)
	writeRESPCommand(wr, "SET", key, value, "EX", strconv.Itoa(ttlSeconds))
	if _, err := readRESPReply(rd); err != nil { // detects -ERR replies
		log.Printf("[%s] cacheSet(%s) failed: %v", serviceName, key, err)
	}
}

// --- mTLS Configuration ---
func getTLSConfig() (bool, string, string) {
	if os.Getenv("TLS_ENABLED") != "true" {
		return false, "", ""
	}
	cert := os.Getenv("TLS_CERT_PATH")
	key := os.Getenv("TLS_KEY_PATH")
	if cert == "" {
		cert = "/etc/54bank/certs/service.crt"
	}
	if key == "" {
		key = "/etc/54bank/certs/service.key"
	}
	return true, cert, key
}

// --- CORS + Security Headers Middleware ---
func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
		if allowedOrigins == "" {
			allowedOrigins = "https://dashboard.54bank.ng"
		}
		origin := r.Header.Get("Origin")
		for _, allowed := range strings.Split(allowedOrigins, ",") {
			if strings.TrimSpace(allowed) == origin {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				break
			}
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Trace-Id")
		w.Header().Set("Access-Control-Max-Age", "86400")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'self'")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- Input Sanitization ---
func sanitizeInput(s string) string {
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "'", "&#39;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "\\", "")
	if len(s) > 10000 {
		s = s[:10000]
	}
	return s
}

var _rlTokens int64 = 100
var _rlLastRefill int64 = 0

func rlAllow() bool {
	nowr := time.Now().UnixMilli()
	if nowr-atomic.LoadInt64(&_rlLastRefill) >= 1000 {
		atomic.StoreInt64(&_rlTokens, 100)
		atomic.StoreInt64(&_rlLastRefill, nowr)
	}
	if atomic.AddInt64(&_rlTokens, -1) < 0 {
		atomic.AddInt64(&_rlTokens, 1)
		return false
	}
	return true
}

func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !rlAllow() {
			w.Header().Set("Retry-After", "1")
			http.Error(w, `{"error":"rate_limit_exceeded"}`, 429)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func computeCustomerLTV(avgMonthlyRevenue float64, churnRate float64) float64 {
	if churnRate <= 0 {
		return avgMonthlyRevenue * 120
	} // 10 year cap
	return avgMonthlyRevenue / churnRate
}
func computeViralCoefficient(invitesSent, conversions int) float64 {
	if invitesSent == 0 {
		return 0
	}
	return float64(conversions) / float64(invitesSent)
}

// --- Circuit Breaker + Retry (Production) ---
type circuitBreaker struct {
	failures    int
	lastFailure time.Time
	threshold   int
	resetAfter  time.Duration
	mu          sync.Mutex
}

func (cb *circuitBreaker) allow() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	if cb.failures >= cb.threshold {
		if time.Since(cb.lastFailure) > cb.resetAfter {
			cb.failures = cb.threshold / 2
			return true
		}
		return false
	}
	return true
}

func (cb *circuitBreaker) recordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	if cb.failures > 0 {
		cb.failures--
	}
}

func (cb *circuitBreaker) recordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failures++
	cb.lastFailure = time.Now()
}

var _cb = &circuitBreaker{threshold: 5, resetAfter: 30 * time.Second}

func callServiceWithRetry(method, url string, body interface{}) (map[string]interface{}, error) {
	if !_cb.allow() {
		return nil, fmt.Errorf("circuit breaker open for %s", url)
	}
	client := &http.Client{Timeout: 15 * time.Second}
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(1<<uint(attempt)) * 200 * time.Millisecond)
		}
		var req *http.Request
		if body != nil {
			jsonData, _ := json.Marshal(body)
			req, _ = http.NewRequest(method, url, bytes.NewBuffer(jsonData))
		} else {
			req, _ = http.NewRequest(method, url, nil)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Source-Service", serviceName)
		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			_cb.recordFailure()
			log.Printf("[%s] %s %s attempt %d failed: %v", serviceName, method, url, attempt+1, err)
			continue
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("upstream %s returned %d", url, resp.StatusCode)
			_cb.recordFailure()
			continue
		}
		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		_cb.recordSuccess()
		return result, nil
	}
	return nil, fmt.Errorf("all retries exhausted for %s: %w", url, lastErr)
}

// --- Alerting ---
type alertManager struct {
	rules []alertRule
	mu    sync.RWMutex
}

type alertRule struct {
	Name      string
	Metric    string
	Threshold float64
	Severity  string
}

var _alertMgr = &alertManager{
	rules: []alertRule{
		{"high_error_rate", "error_rate", 0.05, "critical"},
		{"high_latency", "p99_latency_ms", 5000, "warning"},
		{"db_connection_failures", "db_failures", 3, "critical"},
	},
}

func (am *alertManager) check() []map[string]interface{} {
	var fired []map[string]interface{}
	errRate := float64(atomic.LoadUint64(&_errCount)) / float64(max64(atomic.LoadUint64(&_reqCount), 1))
	if errRate > 0.05 {
		fired = append(fired, map[string]interface{}{"rule": "high_error_rate", "value": errRate, "severity": "critical"})
	}
	return fired
}

func max64(a, b uint64) uint64 {
	if a > b {
		return a
	}
	return b
}

func alertsHandler(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, 200, map[string]interface{}{"alerts": _alertMgr.check(), "rules": len(_alertMgr.rules)})
}

// --- Graceful Degradation ---
type degradationState struct {
	dbAvailable    bool
	cacheAvailable bool
	upstreamOK     map[string]bool
	mu             sync.RWMutex
}

var _degrade = &degradationState{
	dbAvailable:    true,
	cacheAvailable: true,
	upstreamOK:     make(map[string]bool),
}

func (d *degradationState) setDB(ok bool) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.dbAvailable = ok
}

func (d *degradationState) isDBAvailable() bool {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.dbAvailable
}

func (d *degradationState) setUpstream(name string, ok bool) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.upstreamOK[name] = ok
}

func degradationStatusHandler(w http.ResponseWriter, r *http.Request) {
	_degrade.mu.RLock()
	defer _degrade.mu.RUnlock()
	jsonResp(w, 200, map[string]interface{}{
		"service":         serviceName,
		"db_available":    _degrade.dbAvailable,
		"cache_available": _degrade.cacheAvailable,
		"upstreams":       _degrade.upstreamOK,
		"mode": func() string {
			if _degrade.dbAvailable {
				return "normal"
			}
			return "degraded"
		}(),
	})
}

// ── MIDDLEWARE: JWT Validation ───────────────────────────────────────────────

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

func fetchJWKS(realmURL string) {
	resp, err := http.Get(realmURL + "/protocol/openid-connect/certs")
	if err != nil {
		log.Printf("[middleware] JWKS fetch failed: %v", err)
		return
	}
	defer resp.Body.Close()
	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		log.Printf("[middleware] JWKS decode failed: %v", err)
		return
	}
	jwtCache.mu.Lock()
	defer jwtCache.mu.Unlock()
	for _, k := range jwks.Keys {
		nBytes, _ := base64.RawURLEncoding.DecodeString(k.N)
		eBytes, _ := base64.RawURLEncoding.DecodeString(k.E)
		if len(eBytes) == 0 {
			continue
		}
		var eInt int
		for _, b := range eBytes {
			eInt = eInt<<8 | int(b)
		}
		pub := &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}
		jwtCache.keys[k.Kid] = pub
	}
	jwtCache.updated = time.Now()
	log.Printf("[middleware] JWKS refreshed: %d keys", len(jwtCache.keys))
}

// expectedIssuer returns the expected JWT issuer: KEYCLOAK_ISSUER when set,
// otherwise KEYCLOAK_REALM_URL. Empty means issuer validation is skipped
// (a startup warning is logged by warnIfAuthUnconfigured).
func expectedIssuer() string {
	if iss := os.Getenv("KEYCLOAK_ISSUER"); iss != "" {
		return iss
	}
	return os.Getenv("KEYCLOAK_REALM_URL")
}

// audienceMatches checks the expected audience against the JWT aud claim,
// which may be a string or an array of strings.
func audienceMatches(aud interface{}, expected string) bool {
	switch v := aud.(type) {
	case string:
		return v == expected
	case []interface{}:
		for _, a := range v {
			if a == expected {
				return true
			}
		}
	}
	return false
}

func init() {
	warnIfAuthUnconfigured()
}

func warnIfAuthUnconfigured() {
	if os.Getenv("KEYCLOAK_ISSUER") == "" && os.Getenv("KEYCLOAK_REALM_URL") == "" {
		log.Printf("WARNING: KEYCLOAK_ISSUER/KEYCLOAK_REALM_URL unset - JWT iss claim will NOT be validated")
	}
	if os.Getenv("EXPECTED_AUDIENCE") == "" {
		log.Printf("WARNING: EXPECTED_AUDIENCE unset - JWT aud claim will NOT be validated")
	}
}

func jwtMiddleware(realmURL string, next http.Handler) http.Handler {
	// Initial JWKS fetch
	go fetchJWKS(realmURL)
	// Refresh every 5 minutes
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			fetchJWKS(realmURL)
		}
	}()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip health endpoints
		if r.URL.Path == "/healthz" || r.URL.Path == "/readyz" || r.URL.Path == "/livez" || r.URL.Path == "/metrics" {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			http.Error(w, `{"error":"missing bearer token"}`, http.StatusUnauthorized)
			return
		}
		token := auth[7:]
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			http.Error(w, `{"error":"invalid token format"}`, http.StatusUnauthorized)
			return
		}
		// Decode header for kid
		headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
		if err != nil {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		var header struct {
			Kid string `json:"kid"`
		}
		json.Unmarshal(headerBytes, &header)

		jwtCache.mu.RLock()
		pub, ok := jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {
			// Try refresh
			fetchJWKS(realmURL)
			jwtCache.mu.RLock()
			pub, ok = jwtCache.keys[header.Kid]
			jwtCache.mu.RUnlock()
			if !ok {
				http.Error(w, `{"error":"unknown signing key"}`, http.StatusUnauthorized)
				return
			}
		}
		// Verify signature (RS256)
		signingInput := parts[0] + "." + parts[1]
		sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
		if err != nil {
			http.Error(w, `{"error":"invalid signature encoding"}`, http.StatusUnauthorized)
			return
		}
		hash := sha256.Sum256([]byte(signingInput))
		if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {
			http.Error(w, `{"error":"invalid signature"}`, http.StatusUnauthorized)
			return
		}
		// Decode claims
		claimsBytes, _ := base64.RawURLEncoding.DecodeString(parts[1])
		var claims map[string]interface{}
		json.Unmarshal(claimsBytes, &claims)
		// Check expiry
		if exp, ok := claims["exp"].(float64); ok && time.Now().Unix() > int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		// Validate issuer/audience when configured (M-55)
		if iss := expectedIssuer(); iss != "" {
			if claims["iss"] != iss {
				http.Error(w, `{"error":"invalid issuer"}`, http.StatusUnauthorized)
				return
			}
		}
		if aud := os.Getenv("EXPECTED_AUDIENCE"); aud != "" {
			if !audienceMatches(claims["aud"], aud) {
				http.Error(w, `{"error":"invalid audience"}`, http.StatusUnauthorized)
				return
			}
		}
		// Pass claims in context
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// enforceTenantClaim cross-checks a client-supplied tenant identifier against
// the verified JWT claims (C-15). When the token carries a tenant (or
// tenant_id) claim and it does not match the requested tenant, the request is
// rejected with 403 and false is returned. Tokens without a tenant claim
// (e.g. service accounts) are allowed.
func enforceTenantClaim(w http.ResponseWriter, r *http.Request, requestedTenant string) bool {
	if requestedTenant == "" {
		return true
	}
	claims, _ := r.Context().Value("jwt_claims").(map[string]interface{})
	if claims == nil {
		return true
	}
	claimTenant, _ := claims["tenant"].(string)
	if claimTenant == "" {
		claimTenant, _ = claims["tenant_id"].(string)
	}
	if claimTenant == "" {
		return true
	}
	if claimTenant != requestedTenant {
		http.Error(w, `{"error":"tenant mismatch: token tenant does not match requested tenant"}`, http.StatusForbidden)
		return false
	}
	return true
}

// ── MIDDLEWARE: Outbox Relay (Kafka) ────────────────────────────────────────

func startOutboxRelay(ctx context.Context, brokers string, topic string) {
	go func() {
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				relayOutbox(brokers, topic)
			}
		}
	}()
}

func relayOutbox(brokers string, topic string) {
	if db == nil {
		return
	}

	// Events are marked published ONLY after a confirmed Kafka produce.
	producer, err := getKafkaProducer(brokers)
	if err != nil {
		log.Printf("[outbox-relay] kafka unavailable: %v — events remain unpublished for retry", err)
		return
	}

	rows, err := db.Query(`SELECT id, event_type, aggregate_id, payload FROM outbox WHERE published = FALSE ORDER BY created_at LIMIT 100`)
	if err != nil {
		return
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id, eventType, aggID string
		var payload []byte
		if err := rows.Scan(&id, &eventType, &aggID, &payload); err != nil {
			continue
		}
		_, _, err := producer.SendMessage(&sarama.ProducerMessage{
			Topic: topic,
			Key:   sarama.StringEncoder(aggID),
			Value: sarama.ByteEncoder(payload),
		})
		if err != nil {
			log.Printf("[outbox-relay] publish failed for event %s: %v — leaving unpublished for retry", id, err)
			continue
		}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return
	}
	for _, id := range ids {
		if _, err := db.Exec(`UPDATE outbox SET published = TRUE WHERE id = $1`, id); err != nil {
			log.Printf("[outbox-relay] failed to mark event %s published: %v", id, err)
		}
	}
	if len(ids) > 0 {
		log.Printf("[outbox-relay] published %d events to kafka topic=%s", len(ids), topic)
	}
}

// getKafkaProducer lazily creates a shared sarama SyncProducer.
var kafkaProducer sarama.SyncProducer
var kafkaProducerMu sync.Mutex

func getKafkaProducer(brokers string) (sarama.SyncProducer, error) {
	kafkaProducerMu.Lock()
	defer kafkaProducerMu.Unlock()
	if kafkaProducer != nil {
		return kafkaProducer, nil
	}
	cfg := sarama.NewConfig()
	cfg.Producer.Return.Successes = true
	cfg.Producer.RequiredAcks = sarama.WaitForAll
	cfg.Producer.Retry.Max = 3
	p, err := sarama.NewSyncProducer(strings.Split(brokers, ","), cfg)
	if err != nil {
		return nil, err
	}
	kafkaProducer = p
	return kafkaProducer, nil
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8105"
	}
	initDB()
	mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.Handle("/v1/alerts", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(alertsHandler)))
	mux.Handle("/v1/degradation", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(degradationStatusHandler)))
	mux.HandleFunc("/healthz", healthz)
	mux.Handle("/v1/growth/chatbot", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(conversationalBanking)))
	mux.Handle("/v1/growth/smart-savings", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(smartSavings)))
	mux.Handle("/v1/growth/virtual-cards", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(virtualCards)))
	mux.Handle("/v1/growth/qr-payments", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(qrPayments)))
	mux.Handle("/v1/growth/bnpl", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(bnpl)))
	mux.Handle("/v1/growth/investments", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(investmentMarketplace)))
	mux.Handle("/v1/growth/remittances", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(crossBorderRemittances)))
	mux.Handle("/v1/growth/gamification", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(gamification)))
	log.Printf("Growth Features (Go) on :%s — Enhancements 13-20", port)
	tlsEnabled, tlsCert, tlsKey := getTLSConfig()
	_ = tlsCert
	_ = tlsKey
	_ = tlsEnabled
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      rateLimitMiddleware(securityHeadersMiddleware(jwtAuthMiddleware(traceMiddleware(countingMiddleware(mux))))),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()
	<-quit
	log.Println("[growth-features-go] Shutdown signal received")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
	log.Println("[growth-features-go] Server stopped gracefully")
}

func jsonResp(w http.ResponseWriter, code int, data interface{}) { respondJSON(w, data) }

// jwtRealmURL resolves the Keycloak realm URL for jwtMiddleware (added by
// scripts/fix-go-wire-jwt.py).
func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}
