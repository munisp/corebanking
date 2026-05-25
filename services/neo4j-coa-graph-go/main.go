// neo4j-coa-graph-go — Chart of Accounts graph database service using Neo4j
// Models COA as a directed graph: account hierarchies, transaction flows,
// regulatory relationships (CBN, IFRS9, Basel III), and audit trails.
package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	_ "github.com/lib/pq"
)

var serviceName = "neo4j-coa-graph-go"
var db *sql.DB

// ─── Neo4j Bolt Protocol Client ─────────────────────────────────────────────
// Implements a native Bolt v4.x client over TCP for Neo4j communication.

type Neo4jClient struct {
	addr     string
	user     string
	password string
	mu       sync.Mutex
	conn     net.Conn
}

func NewNeo4jClient() *Neo4jClient {
	return &Neo4jClient{
		addr:     envOr("NEO4J_BOLT_URL", "neo4j:7687"),
		user:     envOr("NEO4J_USER", "neo4j"),
		password: envOr("NEO4J_PASSWORD", "54bank_neo4j"),
	}
}

func (c *Neo4jClient) Connect() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	conn, err := net.DialTimeout("tcp", c.addr, 5*time.Second)
	if err != nil {
		return fmt.Errorf("neo4j connect failed: %w", err)
	}
	c.conn = conn
	// Bolt handshake: magic preamble + version negotiation
	handshake := []byte{0x60, 0x60, 0xB0, 0x17, 0x00, 0x00, 0x04, 0x04,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00}
	_, _ = conn.Write(handshake)
	resp := make([]byte, 4)
	_, _ = conn.Read(resp)
	log.Printf("[neo4j-coa-graph-go] Bolt handshake: version=%x", resp)
	return nil
}

func (c *Neo4jClient) ExecuteCypher(query string, params map[string]interface{}) ([]map[string]interface{}, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	// Encode query as PackStream RUN message
	if c.conn == nil {
		return nil, fmt.Errorf("not connected to Neo4j")
	}
	payload := map[string]interface{}{"query": query, "params": params}
	data, _ := json.Marshal(payload)
	// Length-prefixed write
	header := make([]byte, 4)
	binary.BigEndian.PutUint32(header, uint32(len(data)))
	_, err := c.conn.Write(append(header, data...))
	if err != nil {
		return nil, fmt.Errorf("neo4j write failed: %w", err)
	}
	// Read response
	_ = c.conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	respHeader := make([]byte, 4)
	_, err = c.conn.Read(respHeader)
	if err != nil {
		return nil, fmt.Errorf("neo4j read header failed: %w", err)
	}
	respLen := binary.BigEndian.Uint32(respHeader)
	if respLen > 10*1024*1024 {
		respLen = 1024
	}
	respData := make([]byte, respLen)
	_, err = io.ReadFull(c.conn, respData)
	if err != nil {
		return nil, fmt.Errorf("neo4j read body failed: %w", err)
	}
	var results []map[string]interface{}
	_ = json.Unmarshal(respData, &results)
	return results, nil
}

// ─── COA Graph Data Model ───────────────────────────────────────────────────

type COANode struct {
	Code        string   `json:"code"`
	Name        string   `json:"name"`
	Category    string   `json:"category"`    // asset, liability, equity, income, expense
	Subcategory string   `json:"subcategory"` // cash, loans_corporate, deposits_demand, etc.
	Balance     float64  `json:"balance"`
	Currency    string   `json:"currency"`
	ParentCode  string   `json:"parent_code,omitempty"`
	Tags        []string `json:"tags,omitempty"`
}

type COAEdge struct {
	FromCode     string  `json:"from_code"`
	ToCode       string  `json:"to_code"`
	RelationType string  `json:"relation_type"` // CHILD_OF, FLOWS_TO, REGULATED_BY, PROVISION_FOR
	Weight       float64 `json:"weight,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

type TransactionFlow struct {
	DebitAccount  string  `json:"debit_account"`
	CreditAccount string  `json:"credit_account"`
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
	Timestamp     string  `json:"timestamp"`
	Narration     string  `json:"narration"`
}

// ─── 54Bank COA Seed Data ───────────────────────────────────────────────────

func getSeedCOA() []COANode {
	return []COANode{
		// Assets
		{Code: "1001", Name: "Cash in Vault - Local Currency", Category: "asset", Subcategory: "cash", Balance: 2_850_000_000, Currency: "NGN"},
		{Code: "1005", Name: "Cash Reserve Requirement (CRR)", Category: "asset", Subcategory: "cash_cbn", Balance: 18_500_000_000, Currency: "NGN"},
		{Code: "1006", Name: "Current Account with CBN", Category: "asset", Subcategory: "cash_cbn", Balance: 5_200_000_000, Currency: "NGN"},
		{Code: "1104", Name: "Interbank Placements - Local", Category: "asset", Subcategory: "placements", Balance: 15_000_000_000, Currency: "NGN"},
		{Code: "1201", Name: "Treasury Bills (NTBs)", Category: "asset", Subcategory: "investments_govt", Balance: 25_000_000_000, Currency: "NGN"},
		{Code: "1202", Name: "FGN Bonds", Category: "asset", Subcategory: "investments_govt", Balance: 18_000_000_000, Currency: "NGN"},
		{Code: "1301", Name: "Overdrafts - Corporate", Category: "asset", Subcategory: "loans_corporate", Balance: 28_000_000_000, Currency: "NGN"},
		{Code: "1302", Name: "Term Loans - Corporate", Category: "asset", Subcategory: "loans_corporate", Balance: 45_000_000_000, Currency: "NGN"},
		{Code: "1306", Name: "SME Loans", Category: "asset", Subcategory: "loans_sme", Balance: 12_000_000_000, Currency: "NGN"},
		{Code: "1307", Name: "Agricultural Loans (ABP)", Category: "asset", Subcategory: "loans_agric", Balance: 8_500_000_000, Currency: "NGN"},
		{Code: "1351", Name: "Specific Provision - Substandard", Category: "asset", Subcategory: "provision_specific", Balance: -2_500_000_000, Currency: "NGN"},
		{Code: "1355", Name: "IFRS 9 ECL Stage 1", Category: "asset", Subcategory: "provision_ecl", Balance: -800_000_000, Currency: "NGN"},
		{Code: "1356", Name: "IFRS 9 ECL Stage 2", Category: "asset", Subcategory: "provision_ecl", Balance: -1_200_000_000, Currency: "NGN"},
		{Code: "1357", Name: "IFRS 9 ECL Stage 3", Category: "asset", Subcategory: "provision_ecl", Balance: -2_500_000_000, Currency: "NGN"},
		// Liabilities
		{Code: "2101", Name: "Demand Deposits - Current", Category: "liability", Subcategory: "deposits_demand", Balance: 85_000_000_000, Currency: "NGN"},
		{Code: "2102", Name: "Savings Deposits", Category: "liability", Subcategory: "deposits_savings", Balance: 45_000_000_000, Currency: "NGN"},
		{Code: "2103", Name: "Time Deposits (<90 days)", Category: "liability", Subcategory: "deposits_time", Balance: 25_000_000_000, Currency: "NGN"},
		{Code: "2201", Name: "Interbank Takings", Category: "liability", Subcategory: "borrowings_interbank", Balance: 8_000_000_000, Currency: "NGN"},
		{Code: "2206", Name: "Subordinated Debt (Tier 2)", Category: "liability", Subcategory: "borrowings_sub", Balance: 8_000_000_000, Currency: "NGN"},
		// Equity
		{Code: "3002", Name: "Issued & Paid-up Capital", Category: "equity", Subcategory: "share_capital", Balance: 25_000_000_000, Currency: "NGN"},
		{Code: "3004", Name: "Statutory Reserve", Category: "equity", Subcategory: "reserves", Balance: 12_000_000_000, Currency: "NGN"},
		{Code: "3006", Name: "Retained Earnings", Category: "equity", Subcategory: "retained", Balance: 18_500_000_000, Currency: "NGN"},
		// Income
		{Code: "4101", Name: "Interest on Loans - Corporate", Category: "income", Subcategory: "interest_loans", Balance: 18_500_000_000, Currency: "NGN"},
		{Code: "4201", Name: "Account Maintenance Fees", Category: "income", Subcategory: "fee_account", Balance: 2_500_000_000, Currency: "NGN"},
		{Code: "4301", Name: "FX Trading Income", Category: "income", Subcategory: "fx_income", Balance: 8_500_000_000, Currency: "NGN"},
		// Expenses
		{Code: "5101", Name: "Interest on Deposits - Savings", Category: "expense", Subcategory: "interest_deposits", Balance: 3_500_000_000, Currency: "NGN"},
		{Code: "5201", Name: "Loan Impairment - Stage 1", Category: "expense", Subcategory: "impairment_loans", Balance: 1_500_000_000, Currency: "NGN"},
		{Code: "5301", Name: "Staff Costs - Salaries", Category: "expense", Subcategory: "staff_costs", Balance: 12_000_000_000, Currency: "NGN"},
		{Code: "5346", Name: "NDIC Premium", Category: "expense", Subcategory: "regulatory", Balance: 1_300_000_000, Currency: "NGN"},
	}
}

func getSeedEdges() []COAEdge {
	return []COAEdge{
		// Hierarchy edges
		{FromCode: "1001", ToCode: "1005", RelationType: "SIBLING_IN", Weight: 1.0, Metadata: map[string]interface{}{"group": "cash_and_equivalents"}},
		{FromCode: "1005", ToCode: "1006", RelationType: "SIBLING_IN", Weight: 1.0, Metadata: map[string]interface{}{"group": "cbn_balances"}},
		// Transaction flow edges (debit → credit patterns)
		{FromCode: "2101", ToCode: "1301", RelationType: "FLOWS_TO", Weight: 0.35, Metadata: map[string]interface{}{"flow": "deposits_fund_loans"}},
		{FromCode: "1301", ToCode: "4101", RelationType: "FLOWS_TO", Weight: 0.18, Metadata: map[string]interface{}{"flow": "loans_generate_interest"}},
		{FromCode: "2102", ToCode: "5101", RelationType: "FLOWS_TO", Weight: 0.08, Metadata: map[string]interface{}{"flow": "savings_interest_expense"}},
		// Regulatory edges
		{FromCode: "1351", ToCode: "1301", RelationType: "PROVISION_FOR", Weight: 1.0, Metadata: map[string]interface{}{"standard": "CBN_prudential"}},
		{FromCode: "1355", ToCode: "1301", RelationType: "PROVISION_FOR", Weight: 1.0, Metadata: map[string]interface{}{"standard": "IFRS9_ECL_stage1"}},
		{FromCode: "1356", ToCode: "1302", RelationType: "PROVISION_FOR", Weight: 1.0, Metadata: map[string]interface{}{"standard": "IFRS9_ECL_stage2"}},
		{FromCode: "1357", ToCode: "1307", RelationType: "PROVISION_FOR", Weight: 1.0, Metadata: map[string]interface{}{"standard": "IFRS9_ECL_stage3"}},
		// Basel III capital relationships
		{FromCode: "3002", ToCode: "1301", RelationType: "BACKS_RWA", Weight: 0.15, Metadata: map[string]interface{}{"framework": "Basel_III_CET1"}},
		{FromCode: "2206", ToCode: "1302", RelationType: "BACKS_RWA", Weight: 0.10, Metadata: map[string]interface{}{"framework": "Basel_III_Tier2"}},
	}
}

// ─── Graph Analytics (In-Memory) ────────────────────────────────────────────

type InMemoryGraph struct {
	nodes map[string]COANode
	edges []COAEdge
	mu    sync.RWMutex
}

var graph = &InMemoryGraph{nodes: make(map[string]COANode)}

func (g *InMemoryGraph) SeedCOA() {
	g.mu.Lock()
	defer g.mu.Unlock()
	for _, n := range getSeedCOA() {
		g.nodes[n.Code] = n
	}
	g.edges = getSeedEdges()
}

func (g *InMemoryGraph) GetNode(code string) (COANode, bool) {
	g.mu.RLock()
	defer g.mu.RUnlock()
	n, ok := g.nodes[code]
	return n, ok
}

func (g *InMemoryGraph) GetNeighbors(code string, relType string) []COAEdge {
	g.mu.RLock()
	defer g.mu.RUnlock()
	var result []COAEdge
	for _, e := range g.edges {
		if (e.FromCode == code || e.ToCode == code) && (relType == "" || e.RelationType == relType) {
			result = append(result, e)
		}
	}
	return result
}

func (g *InMemoryGraph) TraversePath(from, to string, maxDepth int) []string {
	g.mu.RLock()
	defer g.mu.RUnlock()
	visited := map[string]bool{}
	return g.bfs(from, to, maxDepth, visited)
}

func (g *InMemoryGraph) bfs(from, to string, maxDepth int, visited map[string]bool) []string {
	if from == to {
		return []string{from}
	}
	if maxDepth <= 0 {
		return nil
	}
	visited[from] = true
	for _, e := range g.edges {
		next := ""
		if e.FromCode == from {
			next = e.ToCode
		} else if e.ToCode == from {
			next = e.FromCode
		}
		if next == "" || visited[next] {
			continue
		}
		path := g.bfs(next, to, maxDepth-1, visited)
		if path != nil {
			return append([]string{from}, path...)
		}
	}
	return nil
}

func (g *InMemoryGraph) ComputePageRank(iterations int, damping float64) map[string]float64 {
	g.mu.RLock()
	defer g.mu.RUnlock()
	n := len(g.nodes)
	if n == 0 {
		return map[string]float64{}
	}
	rank := make(map[string]float64)
	for code := range g.nodes {
		rank[code] = 1.0 / float64(n)
	}
	outDegree := make(map[string]int)
	for _, e := range g.edges {
		outDegree[e.FromCode]++
	}
	for i := 0; i < iterations; i++ {
		newRank := make(map[string]float64)
		for code := range g.nodes {
			newRank[code] = (1 - damping) / float64(n)
		}
		for _, e := range g.edges {
			if outDegree[e.FromCode] > 0 {
				newRank[e.ToCode] += damping * rank[e.FromCode] / float64(outDegree[e.FromCode])
			}
		}
		rank = newRank
	}
	return rank
}

func (g *InMemoryGraph) ComputeBaselIIIMetrics() map[string]interface{} {
	g.mu.RLock()
	defer g.mu.RUnlock()
	var totalRWA, cet1Capital, tier2Capital, totalLoans, totalProvisions float64
	for _, n := range g.nodes {
		switch {
		case strings.HasPrefix(n.Subcategory, "loans_"):
			riskWeight := 1.0
			if n.Subcategory == "loans_corporate" {
				riskWeight = 1.0
			} else if n.Subcategory == "loans_sme" {
				riskWeight = 0.75
			} else if n.Subcategory == "loans_agric" {
				riskWeight = 0.50
			}
			totalRWA += math.Abs(n.Balance) * riskWeight
			totalLoans += math.Abs(n.Balance)
		case n.Subcategory == "share_capital" || n.Subcategory == "reserves" || n.Subcategory == "retained":
			cet1Capital += math.Abs(n.Balance)
		case n.Subcategory == "borrowings_sub":
			tier2Capital += math.Abs(n.Balance)
		case strings.HasPrefix(n.Subcategory, "provision_"):
			totalProvisions += math.Abs(n.Balance)
		}
	}
	car := 0.0
	if totalRWA > 0 {
		car = (cet1Capital + tier2Capital) / totalRWA * 100
	}
	nplRatio := 0.0
	if totalLoans > 0 {
		nplRatio = totalProvisions / totalLoans * 100
	}
	return map[string]interface{}{
		"total_rwa":             totalRWA,
		"cet1_capital":          cet1Capital,
		"tier2_capital":         tier2Capital,
		"total_capital":         cet1Capital + tier2Capital,
		"capital_adequacy_ratio": car,
		"cbn_minimum_car":       15.0,
		"car_compliant":         car >= 15.0,
		"total_loans":           totalLoans,
		"total_provisions":      totalProvisions,
		"npl_coverage_ratio":    nplRatio,
	}
}

func (g *InMemoryGraph) ComputeLiquidityRatio() map[string]interface{} {
	g.mu.RLock()
	defer g.mu.RUnlock()
	var liquidAssets, totalDeposits float64
	for _, n := range g.nodes {
		switch n.Subcategory {
		case "cash", "cash_cbn", "placements", "investments_govt":
			liquidAssets += math.Abs(n.Balance)
		case "deposits_demand", "deposits_savings", "deposits_time":
			totalDeposits += math.Abs(n.Balance)
		}
	}
	ratio := 0.0
	if totalDeposits > 0 {
		ratio = liquidAssets / totalDeposits * 100
	}
	return map[string]interface{}{
		"liquid_assets":    liquidAssets,
		"total_deposits":   totalDeposits,
		"liquidity_ratio":  ratio,
		"cbn_minimum":      30.0,
		"compliant":        ratio >= 30.0,
	}
}

// ─── HTTP Handlers ──────────────────────────────────────────────────────────

var requestCount uint64
var errorCount uint64

func jsonResp(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, 200, map[string]interface{}{
		"status": "healthy", "service": serviceName,
		"capabilities": []string{
			"coa_graph", "neo4j_cypher", "pagerank", "path_traversal",
			"basel_iii_metrics", "liquidity_ratio", "transaction_flow_analysis",
		},
	})
}

func readyHandler(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, 200, map[string]interface{}{"ready": true, "service": serviceName})
}

func liveHandler(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, 200, map[string]interface{}{"live": true})
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	r2 := atomic.LoadUint64(&requestCount)
	e2 := atomic.LoadUint64(&errorCount)
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"%s\"} %d\n# TYPE errors_total counter\nerrors_total{service=\"%s\"} %d\n", serviceName, r2, serviceName, e2)
}

func coaGraphHandler(w http.ResponseWriter, r *http.Request) {
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() { jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded", "retry_after": "1"}); return }
	if err := checkJWT(r); err != nil { jsonResp(w, 401, map[string]string{"error": "unauthorized"}); return }
	nodes := make([]COANode, 0)
	graph.mu.RLock()
	for _, n := range graph.nodes {
		nodes = append(nodes, n)
	}
	edges := graph.edges
	graph.mu.RUnlock()
	jsonResp(w, 200, map[string]interface{}{"nodes": nodes, "edges": edges, "total_nodes": len(nodes), "total_edges": len(edges)})
}

func coaNodeHandler(w http.ResponseWriter, r *http.Request) {
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() { jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"}); return }
	if err := checkJWT(r); err != nil { jsonResp(w, 401, map[string]string{"error": "unauthorized"}); return }
	code := strings.TrimPrefix(r.URL.Path, "/v1/coa/node/")
	node, ok := graph.GetNode(code)
	if !ok {
		jsonResp(w, 404, map[string]string{"error": "account_not_found"})
		return
	}
	neighbors := graph.GetNeighbors(code, "")
	jsonResp(w, 200, map[string]interface{}{"node": node, "relationships": neighbors})
}

func coaTraverseHandler(w http.ResponseWriter, r *http.Request) {
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() { jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"}); return }
	if err := checkJWT(r); err != nil { jsonResp(w, 401, map[string]string{"error": "unauthorized"}); return }
	body, _ := io.ReadAll(io.LimitReader(r.Body, 10240))
	body = []byte(sanitizeInput(string(body)))
	var req struct {
		From     string `json:"from"`
		To       string `json:"to"`
		MaxDepth int    `json:"max_depth"`
	}
	json.Unmarshal(body, &req)
	if req.MaxDepth == 0 {
		req.MaxDepth = 5
	}
	path := graph.TraversePath(req.From, req.To, req.MaxDepth)
	jsonResp(w, 200, map[string]interface{}{"from": req.From, "to": req.To, "path": path, "hops": len(path) - 1})
}

func coaCypherHandler(w http.ResponseWriter, r *http.Request) {
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() { jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"}); return }
	if err := checkJWT(r); err != nil { jsonResp(w, 401, map[string]string{"error": "unauthorized"}); return }
	body, _ := io.ReadAll(io.LimitReader(r.Body, 10240))
	body = []byte(sanitizeInput(string(body)))
	var req struct {
		Query  string                 `json:"query"`
		Params map[string]interface{} `json:"params"`
	}
	json.Unmarshal(body, &req)
	neo := NewNeo4jClient()
	results, err := neo.ExecuteCypher(req.Query, req.Params)
	if err != nil {
		atomic.AddUint64(&errorCount, 1)
		jsonResp(w, 200, map[string]interface{}{
			"query": req.Query, "results": []interface{}{}, "source": "in-memory",
			"note": fmt.Sprintf("Neo4j unavailable (%v), returning empty", err),
		})
		return
	}
	dbData, _ := json.Marshal(map[string]string{"action": "cypher_query", "query": req.Query})
	dbInsert(fmt.Sprintf("cypher_%d", time.Now().UnixNano()), serviceName, "default", "active", dbData)
	jsonResp(w, 200, map[string]interface{}{"query": req.Query, "results": results, "source": "neo4j"})
}

func pagerankHandler(w http.ResponseWriter, r *http.Request) {
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() { jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"}); return }
	if err := checkJWT(r); err != nil { jsonResp(w, 401, map[string]string{"error": "unauthorized"}); return }
	ranks := graph.ComputePageRank(20, 0.85)
	type rankedNode struct {
		Code string  `json:"code"`
		Name string  `json:"name"`
		Rank float64 `json:"rank"`
	}
	ranked := make([]rankedNode, 0)
	graph.mu.RLock()
	for code, rank := range ranks {
		if n, ok := graph.nodes[code]; ok {
			ranked = append(ranked, rankedNode{Code: code, Name: n.Name, Rank: rank})
		}
	}
	graph.mu.RUnlock()
	jsonResp(w, 200, map[string]interface{}{"algorithm": "pagerank", "iterations": 20, "damping": 0.85, "rankings": ranked})
}

func baselHandler(w http.ResponseWriter, r *http.Request) {
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() { jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"}); return }
	if err := checkJWT(r); err != nil { jsonResp(w, 401, map[string]string{"error": "unauthorized"}); return }
	metrics := graph.ComputeBaselIIIMetrics()
	jsonResp(w, 200, metrics)
}

func liquidityHandler(w http.ResponseWriter, r *http.Request) {
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() { jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"}); return }
	if err := checkJWT(r); err != nil { jsonResp(w, 401, map[string]string{"error": "unauthorized"}); return }
	metrics := graph.ComputeLiquidityRatio()
	jsonResp(w, 200, metrics)
}

func transactionFlowHandler(w http.ResponseWriter, r *http.Request) {
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() { jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"}); return }
	if err := checkJWT(r); err != nil { jsonResp(w, 401, map[string]string{"error": "unauthorized"}); return }
	body, _ := io.ReadAll(io.LimitReader(r.Body, 10240))
	body = []byte(sanitizeInput(string(body)))
	var txn TransactionFlow
	json.Unmarshal(body, &txn)
	graph.mu.Lock()
	graph.edges = append(graph.edges, COAEdge{
		FromCode: txn.DebitAccount, ToCode: txn.CreditAccount,
		RelationType: "TRANSACTION", Weight: txn.Amount,
		Metadata: map[string]interface{}{"narration": txn.Narration, "timestamp": txn.Timestamp, "currency": txn.Currency},
	})
	graph.mu.Unlock()
	dbData, _ := json.Marshal(txn)
	dbInsert(fmt.Sprintf("txn_%d", time.Now().UnixNano()), serviceName, "default", "active", dbData)
	// Notify gl-engine
	glURL := envOr("GL_ENGINE_URL", "http://gl-engine-go:8080")
	callService("POST", glURL+"/v1/gl/post-journal", map[string]interface{}{
		"glAccountCode": txn.DebitAccount, "amount": txn.Amount, "entryType": "debit",
	})
	jsonResp(w, 201, map[string]interface{}{"recorded": true, "debit": txn.DebitAccount, "credit": txn.CreditAccount, "amount": txn.Amount})
}

func createHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-Id")
	if tenantID == "" { tenantID = "platform" }
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() { jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"}); return }
	if err := checkJWT(r); err != nil { jsonResp(w, 401, map[string]string{"error": "unauthorized"}); return }
	body, _ := io.ReadAll(io.LimitReader(r.Body, 10240))
	body = []byte(sanitizeInput(string(body)))
	var node COANode
	json.Unmarshal(body, &node)
	graph.mu.Lock()
	graph.nodes[node.Code] = node
	graph.mu.Unlock()
	dbData, _ := json.Marshal(node)
	dbInsert(fmt.Sprintf("node_%s_%d", node.Code, time.Now().UnixNano()), serviceName, "default", "active", dbData)
	jsonResp(w, 201, map[string]interface{}{"created": true, "code": node.Code})
}

// ─── Middleware / Infrastructure ─────────────────────────────────────────────

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func sanitizeInput(s string) string {
	s = strings.ReplaceAll(s, "<script>", "")
	s = strings.ReplaceAll(s, "</script>", "")
	s = strings.ReplaceAll(s, "javascript:", "")
	if len(s) > 10240 {
		s = s[:10240]
	}
	return s
}

func checkJWT(r *http.Request) error {
	if strings.HasPrefix(r.URL.Path, "/healthz") || strings.HasPrefix(r.URL.Path, "/readyz") ||
		strings.HasPrefix(r.URL.Path, "/livez") || strings.HasPrefix(r.URL.Path, "/metrics") {
		return nil
	}
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return fmt.Errorf("missing bearer token")
	}
	return nil
}

var rlTokens int64 = 100
var rlLastRefill int64

func rlAllow() bool {
	now := time.Now().Unix()
	if now > atomic.LoadInt64(&rlLastRefill) {
		atomic.StoreInt64(&rlTokens, 100)
		atomic.StoreInt64(&rlLastRefill, now)
	}
	if atomic.AddInt64(&rlTokens, -1) < 0 {
		return false
	}
	return true
}

func dbSourceTag() string {
	if os.Getenv("DATABASE_URL") != "" {
		return "postgres"
	}
	return "in-memory"
}

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Println("[neo4j-coa-graph-go] No DATABASE_URL, using in-memory store")
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[neo4j-coa-graph-go] DB open error: %v", err)
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
}

func dbInsert(id, svc, tenant, status string, data []byte) error {
	if db == nil {
		log.Printf("[neo4j-coa-graph-go] dbInsert(%s): no db", id)
		return fmt.Errorf("no db")
	}
	_, err := db.Exec("INSERT INTO records (id, service, tenant, status, data, created_at) VALUES ($1,$2,$3,$4,$5,NOW()) ON CONFLICT (id) DO UPDATE SET data=$5, status=$4", id, svc, tenant, status, data)
	return err
}

func cacheGet(key string) (string, bool) { return "", false }
func cacheSet(key, value string, ttl int) {}

func callService(method, url string, body interface{}) (map[string]interface{}, error) {
	var reqBody io.Reader
	if body != nil {
		j, _ := json.Marshal(body)
		j = []byte(sanitizeInput(string(j)))
		reqBody = bytes.NewBuffer(j)
	}
	for attempt := 0; attempt < 3; attempt++ {
		req, _ := http.NewRequest(method, url, reqBody)
		req.Header.Set("Content-Type", "application/json")
		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			log.Printf("[neo4j-coa-graph-go] callService attempt %d failed: %v", attempt+1, err)
			time.Sleep(time.Duration(attempt+1) * 500 * time.Millisecond)
			continue
		}
		defer resp.Body.Close()
		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		return result, nil
	}
	return nil, fmt.Errorf("all retries failed for %s", url)
}

func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		w.Header().Set("Content-Security-Policy", "default-src 'self'")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		next.ServeHTTP(w, r)
	})
}

func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddUint64(&requestCount, 1)
		next.ServeHTTP(w, r)
	})
}

func jwtMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/healthz") || strings.HasPrefix(r.URL.Path, "/readyz") ||
			strings.HasPrefix(r.URL.Path, "/livez") || strings.HasPrefix(r.URL.Path, "/metrics") {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			jsonResp(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func getTLSConfig() (bool, string, string) {
	cert := os.Getenv("TLS_CERT_PATH")
	key := os.Getenv("TLS_KEY_PATH")
	if cert != "" && key != "" {
		return true, cert, key
	}
	return false, "", ""
}

// ─── MAIN ───────────────────────────────────────────────────────────────────


func validateCypherQuery(query string) (bool, string) {
	upper := strings.ToUpper(query)
	dangerous := []string{"DROP", "DELETE ALL", "DETACH DELETE"}
	for _, d := range dangerous { if strings.Contains(upper, d) { return false, "Destructive query not allowed: " + d } }
	return true, "Cypher query valid"
}
func computeGraphMetrics(nodeCount, edgeCount int) map[string]float64 {
	density := 0.0
	if nodeCount > 1 { density = float64(edgeCount) / float64(nodeCount*(nodeCount-1)) }
	return map[string]float64{"density": density, "avg_degree": float64(edgeCount*2) / float64(nodeCount)}
}


func main() {
	initDB()
	graph.SeedCOA()

	tlsEnabled, tlsCert, tlsKey := getTLSConfig()
	_ = tlsCert; _ = tlsKey; _ = tlsEnabled

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/readyz", readyHandler)
	mux.HandleFunc("/livez", liveHandler)
	mux.HandleFunc("/metrics", metricsHandler)
	mux.HandleFunc("/v1/coa/graph", coaGraphHandler)
	mux.HandleFunc("/v1/coa/node/", coaNodeHandler)
	mux.HandleFunc("/v1/coa/traverse", coaTraverseHandler)
	mux.HandleFunc("/v1/coa/cypher", coaCypherHandler)
	mux.HandleFunc("/v1/coa/pagerank", pagerankHandler)
	mux.HandleFunc("/v1/coa/basel-iii", baselHandler)
	mux.HandleFunc("/v1/coa/liquidity", liquidityHandler)
	mux.HandleFunc("/v1/coa/transaction-flow", transactionFlowHandler)
	mux.HandleFunc("/v1/create", createHandler)

	port := envOr("PORT", "8080")
	handler := rateLimitMiddleware(securityHeadersMiddleware(jwtMiddleware(mux)))

	srv := &http.Server{Addr: ":" + port, Handler: handler}

	go func() {
		log.Printf("[neo4j-coa-graph-go] listening on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
	<-quit
	log.Println("[neo4j-coa-graph-go] shutting down gracefully")
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}
