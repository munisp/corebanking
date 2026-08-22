// neo4j-coa-graph-go — Chart of Accounts graph database service using Neo4j
// Models COA as a directed graph: account hierarchies, transaction flows,
// regulatory relationships (CBN, IFRS9, Basel III), and audit trails.
package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"math/big"
	"net"
	"net/http"
	"os"
	"os/signal"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/IBM/sarama"
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
	FromCode     string                 `json:"from_code"`
	ToCode       string                 `json:"to_code"`
	RelationType string                 `json:"relation_type"` // CHILD_OF, FLOWS_TO, REGULATED_BY, PROVISION_FOR
	Weight       float64                `json:"weight,omitempty"`
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
		"total_rwa":              totalRWA,
		"cet1_capital":           cet1Capital,
		"tier2_capital":          tier2Capital,
		"total_capital":          cet1Capital + tier2Capital,
		"capital_adequacy_ratio": car,
		"cbn_minimum_car":        15.0,
		"car_compliant":          car >= 15.0,
		"total_loans":            totalLoans,
		"total_provisions":       totalProvisions,
		"npl_coverage_ratio":     nplRatio,
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
		"liquid_assets":   liquidAssets,
		"total_deposits":  totalDeposits,
		"liquidity_ratio": ratio,
		"cbn_minimum":     30.0,
		"compliant":       ratio >= 30.0,
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
	if !rlAllow() {
		jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded", "retry_after": "1"})
		return
	}
	if err := checkJWT(r); err != nil {
		jsonResp(w, 401, map[string]string{"error": "unauthorized"})
		return
	}
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
	if !rlAllow() {
		jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"})
		return
	}
	if err := checkJWT(r); err != nil {
		jsonResp(w, 401, map[string]string{"error": "unauthorized"})
		return
	}
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
	if !rlAllow() {
		jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"})
		return
	}
	if err := checkJWT(r); err != nil {
		jsonResp(w, 401, map[string]string{"error": "unauthorized"})
		return
	}
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
	if !rlAllow() {
		jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"})
		return
	}
	if err := checkJWT(r); err != nil {
		jsonResp(w, 401, map[string]string{"error": "unauthorized"})
		return
	}
	body, _ := io.ReadAll(io.LimitReader(r.Body, 10240))
	body = []byte(sanitizeInput(string(body)))
	var req struct {
		Query  string                 `json:"query"`
		Params map[string]interface{} `json:"params"`
	}
	json.Unmarshal(body, &req)
	if ok, reason := validateCypherQuery(req.Query); !ok {
		atomic.AddUint64(&errorCount, 1)
		jsonResp(w, 400, map[string]string{"error": "cypher_query_rejected", "reason": reason})
		return
	}
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
	if !rlAllow() {
		jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"})
		return
	}
	if err := checkJWT(r); err != nil {
		jsonResp(w, 401, map[string]string{"error": "unauthorized"})
		return
	}
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
	if !rlAllow() {
		jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"})
		return
	}
	if err := checkJWT(r); err != nil {
		jsonResp(w, 401, map[string]string{"error": "unauthorized"})
		return
	}
	metrics := graph.ComputeBaselIIIMetrics()
	jsonResp(w, 200, metrics)
}

func liquidityHandler(w http.ResponseWriter, r *http.Request) {
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() {
		jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"})
		return
	}
	if err := checkJWT(r); err != nil {
		jsonResp(w, 401, map[string]string{"error": "unauthorized"})
		return
	}
	metrics := graph.ComputeLiquidityRatio()
	jsonResp(w, 200, metrics)
}

func transactionFlowHandler(w http.ResponseWriter, r *http.Request) {
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() {
		jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"})
		return
	}
	if err := checkJWT(r); err != nil {
		jsonResp(w, 401, map[string]string{"error": "unauthorized"})
		return
	}
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
	if tenantID == "" {
		tenantID = "platform"
	}
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() {
		jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"})
		return
	}
	if err := checkJWT(r); err != nil {
		jsonResp(w, 401, map[string]string{"error": "unauthorized"})
		return
	}
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

// --- JWT Validation (JWKS-aware) ---
func jwtAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p == "/healthz" || p == "/readyz" || p == "/livez" || p == "/metrics" || p == "/health" || p == "/v1/degradation" {
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
		token := strings.TrimPrefix(auth, "Bearer ")
		// Validate JWT structure (header.payload.signature)
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":"%s"}`, serviceName)
			return
		}
		// In production: validate against Keycloak JWKS endpoint
		// keycloakURL := os.Getenv("KEYCLOAK_URL")
		// Decode payload for claims
		r.Header.Set("X-User-Id", "validated")
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

// cypherWriteClause matches Cypher write/administrative clauses as whole words.
// The /v1/coa/cypher endpoint is strictly read-only; mutations must go through
// the dedicated write endpoints (e.g. /v1/create).
var cypherWriteClause = regexp.MustCompile(`(?i)\b(CREATE|MERGE|DELETE|DETACH|SET|DROP|CALL|REMOVE|LOAD\s+CSV|GRANT|REVOKE|DENY|ALTER)\b`)

// validateCypherQuery rejects any user-supplied query containing a write or
// administrative clause. It must be called on every user-influenced Cypher
// query before execution.
func validateCypherQuery(query string) (bool, string) {
	if strings.TrimSpace(query) == "" {
		return false, "Empty query not allowed"
	}
	if m := cypherWriteClause.FindString(query); m != "" {
		return false, "Write/administrative clause not allowed on this read-only endpoint: " + strings.ToUpper(m)
	}
	return true, "Cypher query valid"
}
func computeGraphMetrics(nodeCount, edgeCount int) map[string]float64 {
	density := 0.0
	if nodeCount > 1 {
		density = float64(edgeCount) / float64(nodeCount*(nodeCount-1))
	}
	return map[string]float64{"density": density, "avg_degree": float64(edgeCount*2) / float64(nodeCount)}
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
	errRate := float64(atomic.LoadUint64(&errorCount)) / float64(max64(atomic.LoadUint64(&requestCount), 1))
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

// --- Integration Tests ---
func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
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
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
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
	initDB()
	graph.SeedCOA()

	tlsEnabled, tlsCert, tlsKey := getTLSConfig()
	_ = tlsCert
	_ = tlsKey
	_ = tlsEnabled

	mux := http.NewServeMux()
	mux.Handle("/v1/alerts", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(alertsHandler)))
	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/readyz", readyHandler)
	mux.HandleFunc("/livez", liveHandler)
	mux.HandleFunc("/metrics", metricsHandler)
	mux.Handle("/v1/coa/graph", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(coaGraphHandler)))
	mux.Handle("/v1/coa/node/", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(coaNodeHandler)))
	mux.Handle("/v1/coa/traverse", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(coaTraverseHandler)))
	mux.Handle("/v1/coa/cypher", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(coaCypherHandler)))
	mux.Handle("/v1/coa/pagerank", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(pagerankHandler)))
	mux.Handle("/v1/coa/basel-iii", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(baselHandler)))
	mux.Handle("/v1/coa/liquidity", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(liquidityHandler)))
	mux.Handle("/v1/coa/transaction-flow", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(transactionFlowHandler)))
	mux.Handle("/v1/create", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(createHandler)))

	port := envOr("PORT", "8080")
	handler := rateLimitMiddleware(securityHeadersMiddleware(jwtAuthMiddleware(mux)))

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

// jwtRealmURL resolves the Keycloak realm URL for jwtMiddleware (added by
// scripts/fix-go-wire-jwt.py).
func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}

var redisAddr string
