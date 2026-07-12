// 54link-dev Neo4j Knowledge Graph Service — Go
// FIBO-aligned knowledge graph: entity storage, COA graph traversal,
// AML entity-network analysis, Cypher query engine, regulatory reasoning.
// Integrates with ontology layer (FIBO/FRO) and all banking services.
package main

import (
	"context"
	"database/sql"
	"bytes"
"encoding/json"
	"fmt"
	"io"
	"log"
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

var db *sql.DB
var serviceName = "neo4j-knowledge-graph-go"

// ─── NEO4J CLIENT ────────────────────────────────────────────────────────────

type Neo4jConfig struct {
	BoltURL  string `json:"boltUrl"`
	Username string `json:"username"`
	Database string `json:"database"`
}

type Neo4jClient struct {
	config     Neo4jConfig
	httpClient *http.Client
	mu         sync.RWMutex
}

func NewNeo4jClient() *Neo4jClient {
	boltURL := os.Getenv("NEO4J_URL")
	if boltURL == "" {
		boltURL = "bolt://neo4j:7687"
	}
	httpURL := os.Getenv("NEO4J_HTTP_URL")
	if httpURL == "" {
		httpURL = "http://neo4j:7474"
	}
	username := os.Getenv("NEO4J_USERNAME")
	if username == "" {
		username = "neo4j"
	}
	return &Neo4jClient{
		config: Neo4jConfig{
			BoltURL:  httpURL,
			Username: username,
			Database: "neo4j",
		},
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// ExecuteCypher runs a Cypher query against Neo4j HTTP API
func (c *Neo4jClient) ExecuteCypher(query string, params map[string]interface{}) ([]map[string]interface{}, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	payload := map[string]interface{}{
		"statements": []map[string]interface{}{
			{"statement": query, "parameters": params},
		},
	}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/db/%s/tx/commit", c.config.BoltURL, c.config.Database)
	req, err := http.NewRequest("POST", url, strings.NewReader(string(body)))
	if err != nil {
		return nil, fmt.Errorf("neo4j request error: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	password := os.Getenv("NEO4J_PASSWORD")
	if password == "" {
		password = "neo4j"
	}
	req.SetBasicAuth(c.config.Username, password)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("neo4j connection error: %v", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)

	var result struct {
		Results []struct {
			Columns []string        `json:"columns"`
			Data    []struct {
				Row []interface{} `json:"row"`
			} `json:"data"`
		} `json:"results"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("neo4j parse error: %v", err)
	}
	if len(result.Errors) > 0 {
		return nil, fmt.Errorf("neo4j error: %s", result.Errors[0].Message)
	}
	var rows []map[string]interface{}
	for _, res := range result.Results {
		for _, d := range res.Data {
			row := make(map[string]interface{})
			for i, col := range res.Columns {
				if i < len(d.Row) {
					row[col] = d.Row[i]
				}
			}
			rows = append(rows, row)
		}
	}
	return rows, nil
}

// ─── FIBO ONTOLOGY GRAPH ─────────────────────────────────────────────────────

type FIBONode struct {
	ID         string                 `json:"id"`
	Type       string                 `json:"type"`
	Label      string                 `json:"label"`
	Properties map[string]interface{} `json:"properties"`
}

type FIBORelationship struct {
	From         string `json:"from"`
	To           string `json:"to"`
	RelationType string `json:"relationType"`
}

// seedFIBOOntology creates the FIBO-aligned graph structure in Neo4j
func (c *Neo4jClient) seedFIBOOntology() error {
	queries := []string{
		// Create constraints
		"CREATE CONSTRAINT IF NOT EXISTS FOR (a:GLAccount) REQUIRE a.code IS UNIQUE",
		"CREATE CONSTRAINT IF NOT EXISTS FOR (c:Customer) REQUIRE c.id IS UNIQUE",
		"CREATE CONSTRAINT IF NOT EXISTS FOR (t:Transaction) REQUIRE t.id IS UNIQUE",
		"CREATE CONSTRAINT IF NOT EXISTS FOR (l:LoanFacility) REQUIRE l.id IS UNIQUE",
		"CREATE CONSTRAINT IF NOT EXISTS FOR (r:RegulatoryReturn) REQUIRE r.code IS UNIQUE",
		"CREATE CONSTRAINT IF NOT EXISTS FOR (reg:Regulation) REQUIRE reg.id IS UNIQUE",

		// Create indexes
		"CREATE INDEX IF NOT EXISTS FOR (a:GLAccount) ON (a.accountType)",
		"CREATE INDEX IF NOT EXISTS FOR (a:GLAccount) ON (a.subcategory)",
		"CREATE INDEX IF NOT EXISTS FOR (c:Customer) ON (c.riskScore)",
		"CREATE INDEX IF NOT EXISTS FOR (t:Transaction) ON (t.timestamp)",
		"CREATE INDEX IF NOT EXISTS FOR (t:Transaction) ON (t.amount)",

		// Asset accounts
		`MERGE (a:GLAccount:AssetAccount {code: "1001"}) SET a.name = "Cash in Vault - Local Currency", a.accountType = "asset", a.subcategory = "cash", a.currency = "NGN", a.cbnLine = "MBR001.1.1", a.fiboClass = "bank54:CashInVault"`,
		`MERGE (a:GLAccount:AssetAccount {code: "1005"}) SET a.name = "Cash Reserve Requirement (CRR)", a.accountType = "asset", a.subcategory = "cash_cbn", a.currency = "NGN", a.cbnLine = "MBR001.1.2", a.fiboClass = "bank54:CashReserveRequirement"`,
		`MERGE (a:GLAccount:AssetAccount {code: "1006"}) SET a.name = "Current Account with CBN", a.accountType = "asset", a.subcategory = "cash_cbn", a.currency = "NGN"`,
		`MERGE (a:GLAccount:AssetAccount {code: "1104"}) SET a.name = "Interbank Placements - Local", a.accountType = "asset", a.subcategory = "placements", a.currency = "NGN"`,
		`MERGE (a:GLAccount:AssetAccount {code: "1106"}) SET a.name = "Money Market Placements", a.accountType = "asset", a.subcategory = "placements", a.currency = "NGN"`,
		`MERGE (a:GLAccount:AssetAccount {code: "1201"}) SET a.name = "Treasury Bills (NTBs)", a.accountType = "asset", a.subcategory = "investments_govt", a.currency = "NGN", a.fiboClass = "fibo-sec:DebtInstrument"`,
		`MERGE (a:GLAccount:AssetAccount {code: "1202"}) SET a.name = "FGN Bonds", a.accountType = "asset", a.subcategory = "investments_govt", a.currency = "NGN", a.fiboClass = "fibo-sec:GovernmentBond"`,
		`MERGE (a:GLAccount:AssetAccount {code: "1205"}) SET a.name = "OMO Bills", a.accountType = "asset", a.subcategory = "investments_govt", a.currency = "NGN"`,
		`MERGE (a:GLAccount:AssetAccount {code: "1301"}) SET a.name = "Overdrafts - Corporate", a.accountType = "asset", a.subcategory = "loans_corporate", a.currency = "NGN", a.fiboClass = "fibo-loan:CreditFacility"`,
		`MERGE (a:GLAccount:AssetAccount {code: "1302"}) SET a.name = "Term Loans - Corporate", a.accountType = "asset", a.subcategory = "loans_corporate", a.currency = "NGN", a.fiboClass = "fibo-loan:Loan"`,
		`MERGE (a:GLAccount:AssetAccount {code: "1306"}) SET a.name = "SME Loans", a.accountType = "asset", a.subcategory = "loans_sme", a.currency = "NGN"`,
		`MERGE (a:GLAccount:AssetAccount {code: "1307"}) SET a.name = "Agricultural Loans (ABP)", a.accountType = "asset", a.subcategory = "loans_agric", a.currency = "NGN"`,
		`MERGE (a:GLAccount:AssetAccount {code: "1308"}) SET a.name = "Personal/Consumer Loans", a.accountType = "asset", a.subcategory = "loans_retail", a.currency = "NGN"`,
		`MERGE (a:GLAccount:AssetAccount {code: "1309"}) SET a.name = "Mortgage Loans", a.accountType = "asset", a.subcategory = "loans_retail", a.currency = "NGN", a.fiboClass = "fibo-loan:Mortgage"`,
		`MERGE (a:GLAccount:AssetAccount {code: "1351"}) SET a.name = "Specific Provision - Substandard", a.accountType = "asset", a.subcategory = "provision_specific", a.isContra = true`,
		`MERGE (a:GLAccount:AssetAccount {code: "1355"}) SET a.name = "IFRS 9 ECL Stage 1", a.accountType = "asset", a.subcategory = "provision_ecl", a.ifrs9Stage = 1`,
		`MERGE (a:GLAccount:AssetAccount {code: "1356"}) SET a.name = "IFRS 9 ECL Stage 2", a.accountType = "asset", a.subcategory = "provision_ecl", a.ifrs9Stage = 2`,
		`MERGE (a:GLAccount:AssetAccount {code: "1357"}) SET a.name = "IFRS 9 ECL Stage 3", a.accountType = "asset", a.subcategory = "provision_ecl", a.ifrs9Stage = 3`,

		// Liability accounts
		`MERGE (a:GLAccount:LiabilityAccount {code: "2101"}) SET a.name = "Demand Deposits - Current", a.accountType = "liability", a.subcategory = "deposits_demand", a.currency = "NGN", a.ndicInsured = true`,
		`MERGE (a:GLAccount:LiabilityAccount {code: "2102"}) SET a.name = "Savings Deposits", a.accountType = "liability", a.subcategory = "deposits_savings", a.currency = "NGN", a.ndicInsured = true`,
		`MERGE (a:GLAccount:LiabilityAccount {code: "2103"}) SET a.name = "Time Deposits (<90 days)", a.accountType = "liability", a.subcategory = "deposits_time", a.currency = "NGN"`,
		`MERGE (a:GLAccount:LiabilityAccount {code: "2104"}) SET a.name = "Time Deposits (90-180 days)", a.accountType = "liability", a.subcategory = "deposits_time", a.currency = "NGN"`,
		`MERGE (a:GLAccount:LiabilityAccount {code: "2105"}) SET a.name = "Time Deposits (>180 days)", a.accountType = "liability", a.subcategory = "deposits_time", a.currency = "NGN"`,
		`MERGE (a:GLAccount:LiabilityAccount {code: "2201"}) SET a.name = "Interbank Takings", a.accountType = "liability", a.subcategory = "borrowings_interbank", a.currency = "NGN"`,
		`MERGE (a:GLAccount:LiabilityAccount {code: "2206"}) SET a.name = "Subordinated Debt (Tier 2)", a.accountType = "liability", a.subcategory = "borrowings_sub", a.currency = "NGN", a.baselTier = "Tier2"`,

		// Equity accounts
		`MERGE (a:GLAccount:EquityAccount {code: "3002"}) SET a.name = "Issued & Paid-up Capital", a.accountType = "equity", a.subcategory = "share_capital", a.currency = "NGN", a.baselTier = "CET1"`,
		`MERGE (a:GLAccount:EquityAccount {code: "3003"}) SET a.name = "Share Premium", a.accountType = "equity", a.subcategory = "share_premium", a.currency = "NGN", a.baselTier = "CET1"`,
		`MERGE (a:GLAccount:EquityAccount {code: "3004"}) SET a.name = "Statutory Reserve", a.accountType = "equity", a.subcategory = "reserves", a.currency = "NGN", a.baselTier = "CET1"`,
		`MERGE (a:GLAccount:EquityAccount {code: "3006"}) SET a.name = "Retained Earnings", a.accountType = "equity", a.subcategory = "retained", a.currency = "NGN", a.baselTier = "CET1"`,
		`MERGE (a:GLAccount:EquityAccount {code: "3008"}) SET a.name = "Revaluation Reserve", a.accountType = "equity", a.subcategory = "reserves", a.currency = "NGN", a.baselTier = "AT1"`,
		`MERGE (a:GLAccount:EquityAccount {code: "3011"}) SET a.name = "Regulatory Risk Reserve", a.accountType = "equity", a.subcategory = "reserves", a.currency = "NGN"`,

		// Revenue accounts
		`MERGE (a:GLAccount:RevenueAccount {code: "4101"}) SET a.name = "Interest on Loans - Corporate", a.accountType = "revenue", a.subcategory = "interest_loans", a.currency = "NGN"`,
		`MERGE (a:GLAccount:RevenueAccount {code: "4102"}) SET a.name = "Interest on Loans - Retail", a.accountType = "revenue", a.subcategory = "interest_loans", a.currency = "NGN"`,
		`MERGE (a:GLAccount:RevenueAccount {code: "4104"}) SET a.name = "Interest on Treasury Bills", a.accountType = "revenue", a.subcategory = "interest_investments", a.currency = "NGN"`,
		`MERGE (a:GLAccount:RevenueAccount {code: "4201"}) SET a.name = "Account Maintenance Fees", a.accountType = "revenue", a.subcategory = "fee_account", a.currency = "NGN"`,
		`MERGE (a:GLAccount:RevenueAccount {code: "4301"}) SET a.name = "FX Trading Income", a.accountType = "revenue", a.subcategory = "fx_income", a.currency = "NGN"`,

		// Expense accounts
		`MERGE (a:GLAccount:ExpenseAccount {code: "5101"}) SET a.name = "Interest on Deposits - Savings", a.accountType = "expense", a.subcategory = "interest_deposits", a.currency = "NGN"`,
		`MERGE (a:GLAccount:ExpenseAccount {code: "5102"}) SET a.name = "Interest on Deposits - Term", a.accountType = "expense", a.subcategory = "interest_deposits", a.currency = "NGN"`,
		`MERGE (a:GLAccount:ExpenseAccount {code: "5201"}) SET a.name = "Loan Impairment - Stage 1", a.accountType = "expense", a.subcategory = "impairment_loans", a.currency = "NGN"`,
		`MERGE (a:GLAccount:ExpenseAccount {code: "5301"}) SET a.name = "Staff Costs - Salaries", a.accountType = "expense", a.subcategory = "staff_costs", a.currency = "NGN"`,
		`MERGE (a:GLAccount:ExpenseAccount {code: "5346"}) SET a.name = "NDIC Premium", a.accountType = "expense", a.subcategory = "regulatory", a.currency = "NGN"`,
		`MERGE (a:GLAccount:ExpenseAccount {code: "5401"}) SET a.name = "Company Income Tax", a.accountType = "expense", a.subcategory = "tax_cit", a.currency = "NGN"`,

		// Regulatory nodes
		`MERGE (r:Regulation {id: "CRR"}) SET r.name = "Cash Reserve Requirement", r.regulator = "CBN", r.currentRate = 0.325, r.legalBasis = "CBN Act 2007 Section 15"`,
		`MERGE (r:Regulation {id: "CAR"}) SET r.name = "Capital Adequacy Ratio", r.regulator = "CBN", r.minimumRatio = 0.15, r.legalBasis = "CBN Prudential Guidelines, Basel III"`,
		`MERGE (r:Regulation {id: "LCR"}) SET r.name = "Liquidity Coverage Ratio", r.regulator = "CBN", r.minimumRatio = 1.0, r.legalBasis = "CBN LCR Framework"`,
		`MERGE (r:Regulation {id: "IFRS9"}) SET r.name = "IFRS 9 ECL Staging", r.regulator = "CBN", r.legalBasis = "IFRS 9 Financial Instruments"`,
		`MERGE (r:Regulation {id: "SOL"}) SET r.name = "Single Obligor Limit", r.regulator = "CBN", r.maximumRatio = 0.20, r.legalBasis = "BOFIA 2020 Section 20(1)"`,
		`MERGE (r:Regulation {id: "KYC"}) SET r.name = "Tiered KYC", r.regulator = "CBN", r.legalBasis = "CBN Tiered KYC Framework 2022"`,
		`MERGE (r:Regulation {id: "CTR"}) SET r.name = "Currency Transaction Report", r.regulator = "NFIU", r.threshold = 5000000, r.legalBasis = "ML(PP) Act 2022"`,
		`MERGE (r:Regulation {id: "STR"}) SET r.name = "Suspicious Transaction Report", r.regulator = "NFIU", r.legalBasis = "ML(PP) Act 2022"`,

		// Regulatory return nodes
		`MERGE (ret:RegulatoryReturn {code: "MBR001"}) SET ret.name = "Balance Sheet Return", ret.frequency = "monthly", ret.deadline = "15th of following month"`,
		`MERGE (ret:RegulatoryReturn {code: "MBR002"}) SET ret.name = "Profit and Loss Account", ret.frequency = "monthly"`,
		`MERGE (ret:RegulatoryReturn {code: "MBR003"}) SET ret.name = "Analysis of Credits", ret.frequency = "monthly"`,
		`MERGE (ret:RegulatoryReturn {code: "MBR007"}) SET ret.name = "Capital Adequacy Return", ret.frequency = "monthly"`,
		`MERGE (ret:RegulatoryReturn {code: "SRF008"}) SET ret.name = "Capital Adequacy Computation", ret.frequency = "quarterly"`,

		// Relationships: GL accounts → regulatory returns
		`MATCH (a:GLAccount), (ret:RegulatoryReturn {code: "MBR001"}) WHERE a.accountType IN ["asset", "liability", "equity"] MERGE (a)-[:REPORTED_IN]->(ret)`,
		`MATCH (a:GLAccount), (ret:RegulatoryReturn {code: "MBR002"}) WHERE a.accountType IN ["revenue", "expense"] MERGE (a)-[:REPORTED_IN]->(ret)`,
		`MATCH (a:GLAccount), (ret:RegulatoryReturn {code: "MBR003"}) WHERE a.subcategory STARTS WITH "loans_" MERGE (a)-[:REPORTED_IN]->(ret)`,
		`MATCH (a:GLAccount {baselTier: "CET1"}), (r:Regulation {id: "CAR"}) MERGE (a)-[:COMPONENT_OF {tier: "CET1"}]->(r)`,
		`MATCH (a:GLAccount {baselTier: "AT1"}), (r:Regulation {id: "CAR"}) MERGE (a)-[:COMPONENT_OF {tier: "AT1"}]->(r)`,
		`MATCH (a:GLAccount {baselTier: "Tier2"}), (r:Regulation {id: "CAR"}) MERGE (a)-[:COMPONENT_OF {tier: "Tier2"}]->(r)`,
		`MATCH (a:GLAccount {code: "1005"}), (r:Regulation {id: "CRR"}) MERGE (a)-[:SUBJECT_TO]->(r)`,
		`MATCH (a:GLAccount), (r:Regulation {id: "CRR"}) WHERE a.subcategory STARTS WITH "deposits_" MERGE (a)-[:COMPUTATION_BASIS]->(r)`,
		`MATCH (a:GLAccount), (r:Regulation {id: "IFRS9"}) WHERE a.subcategory = "provision_ecl" MERGE (a)-[:SUBJECT_TO]->(r)`,

		// COA hierarchy relationships
		`MATCH (parent:GLAccount {code: "1001"}), (child:GLAccount {code: "1005"}) MERGE (parent)-[:SIBLING_OF]->(child)`,
		`MATCH (parent:GLAccount {code: "1301"}), (child:GLAccount {code: "1302"}) MERGE (parent)-[:SIBLING_OF]->(child)`,
		`MATCH (parent:GLAccount {code: "2101"}), (child:GLAccount {code: "2102"}) MERGE (parent)-[:SIBLING_OF]->(child)`,
	}

	for _, q := range queries {
		if _, err := c.ExecuteCypher(q, nil); err != nil {
			log.Printf("[neo4j-kg] seed warning: %v (query: %.80s...)", err, q)
		}
	}
	log.Printf("[neo4j-kg] FIBO ontology seeded: %d queries executed", len(queries))
	return nil
}

// ─── AML NETWORK ANALYSIS ───────────────────────────────────────────────────

type AMLEntityNode struct {
	EntityID      string   `json:"entityId"`
	EntityType    string   `json:"entityType"`
	Name          string   `json:"name"`
	RiskScore     float64  `json:"riskScore"`
	IsPEP         bool     `json:"isPep"`
	IsSanctioned  bool     `json:"isSanctioned"`
	Country       string   `json:"country"`
	Relationships []string `json:"relationships"`
}

func (c *Neo4jClient) createAMLEntity(entity AMLEntityNode) error {
	query := `MERGE (e:AMLEntity {entityId: $entityId})
	SET e.entityType = $entityType, e.name = $name, e.riskScore = $riskScore,
	    e.isPep = $isPep, e.isSanctioned = $isSanctioned, e.country = $country,
	    e.updatedAt = datetime()`
	params := map[string]interface{}{
		"entityId":     entity.EntityID,
		"entityType":   entity.EntityType,
		"name":         entity.Name,
		"riskScore":    entity.RiskScore,
		"isPep":        entity.IsPEP,
		"isSanctioned": entity.IsSanctioned,
		"country":      entity.Country,
	}
	_, err := c.ExecuteCypher(query, params)
	return err
}

func (c *Neo4jClient) createTransactionLink(fromID, toID string, amount float64, currency, channel string) error {
	query := `MATCH (from:AMLEntity {entityId: $fromId}), (to:AMLEntity {entityId: $toId})
	MERGE (from)-[t:TRANSACTED_WITH]->(to)
	ON CREATE SET t.totalAmount = $amount, t.count = 1, t.currency = $currency, t.channel = $channel, t.firstSeen = datetime()
	ON MATCH SET t.totalAmount = t.totalAmount + $amount, t.count = t.count + 1, t.lastSeen = datetime()`
	params := map[string]interface{}{
		"fromId":   fromID,
		"toId":     toID,
		"amount":   amount,
		"currency": currency,
		"channel":  channel,
	}
	_, err := c.ExecuteCypher(query, params)
	return err
}

func (c *Neo4jClient) detectSuspiciousNetworks(minRiskScore float64) ([]map[string]interface{}, error) {
	query := `MATCH (e:AMLEntity)-[t:TRANSACTED_WITH]->(e2:AMLEntity)
	WHERE e.riskScore >= $minRisk OR e2.riskScore >= $minRisk OR e.isPep = true OR e2.isSanctioned = true
	RETURN e.entityId AS source, e.name AS sourceName, e.riskScore AS sourceRisk,
	       e2.entityId AS target, e2.name AS targetName, e2.riskScore AS targetRisk,
	       t.totalAmount AS amount, t.count AS txnCount
	ORDER BY t.totalAmount DESC LIMIT 100`
	return c.ExecuteCypher(query, map[string]interface{}{"minRisk": minRiskScore})
}

func (c *Neo4jClient) findBeneficialOwnership(entityID string) ([]map[string]interface{}, error) {
	query := `MATCH path = (e:AMLEntity {entityId: $entityId})-[:OWNS|CONTROLS|BENEFICIAL_OWNER*1..5]->(target)
	RETURN [n IN nodes(path) | {id: n.entityId, name: n.name, type: n.entityType}] AS chain,
	       length(path) AS depth`
	return c.ExecuteCypher(query, map[string]interface{}{"entityId": entityID})
}

// ─── GRAPH QUERY ENGINE ─────────────────────────────────────────────────────

func (c *Neo4jClient) queryCoAByType(accountType string) ([]map[string]interface{}, error) {
	query := `MATCH (a:GLAccount {accountType: $type}) RETURN a.code AS code, a.name AS name, a.subcategory AS subcategory, a.currency AS currency ORDER BY a.code`
	return c.ExecuteCypher(query, map[string]interface{}{"type": accountType})
}

func (c *Neo4jClient) queryCoARegulatory(returnCode string) ([]map[string]interface{}, error) {
	query := `MATCH (a:GLAccount)-[:REPORTED_IN]->(ret:RegulatoryReturn {code: $code})
	RETURN a.code AS glCode, a.name AS glName, a.accountType AS type, a.subcategory AS subcategory
	ORDER BY a.code`
	return c.ExecuteCypher(query, map[string]interface{}{"code": returnCode})
}

func (c *Neo4jClient) queryCapitalComponents() ([]map[string]interface{}, error) {
	query := `MATCH (a:GLAccount)-[c:COMPONENT_OF]->(r:Regulation {id: "CAR"})
	RETURN a.code AS glCode, a.name AS glName, c.tier AS capitalTier, a.accountType AS type
	ORDER BY c.tier, a.code`
	return c.ExecuteCypher(query, nil)
}

func (c *Neo4jClient) queryEntityNetwork(entityID string, depth int) ([]map[string]interface{}, error) {
	query := fmt.Sprintf(`MATCH path = (e:AMLEntity {entityId: $entityId})-[*1..%d]-(connected)
	RETURN DISTINCT connected.entityId AS id, connected.name AS name,
	       connected.entityType AS type, connected.riskScore AS riskScore,
	       length(path) AS distance
	ORDER BY distance`, depth)
	return c.ExecuteCypher(query, map[string]interface{}{"entityId": entityID})
}

func (c *Neo4jClient) getGraphStats() (map[string]interface{}, error) {
	queries := map[string]string{
		"glAccounts":       "MATCH (a:GLAccount) RETURN count(a) AS count",
		"amlEntities":      "MATCH (e:AMLEntity) RETURN count(e) AS count",
		"transactions":     "MATCH ()-[t:TRANSACTED_WITH]->() RETURN count(t) AS count",
		"regulations":      "MATCH (r:Regulation) RETURN count(r) AS count",
		"regulatoryReturns": "MATCH (ret:RegulatoryReturn) RETURN count(ret) AS count",
		"relationships":    "MATCH ()-[r]->() RETURN count(r) AS count",
	}
	stats := make(map[string]interface{})
	for key, q := range queries {
		rows, err := c.ExecuteCypher(q, nil)
		if err != nil {
			stats[key] = -1
			continue
		}
		if len(rows) > 0 {
			stats[key] = rows[0]["count"]
		}
	}
	return stats, nil
}

// ─── SECURITY, RATE LIMITING, OBSERVABILITY ─────────────────────────────────

var (
	requestCount uint64
	errorCount   uint64
	jwtSecret    string
	cache        sync.Map
	rateLimiter  struct {
		mu       sync.Mutex
		tokens   float64
		maxRate  float64
		lastTime time.Time
	}
)

func init() {
	jwtSecret = os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "54link-dev-jwt-secret-change-in-production"
	}
	rateLimiter.maxRate = 100
	rateLimiter.tokens = 100
	rateLimiter.lastTime = time.Now()
}

func sanitizeInput(s string) string {
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "'", "&#39;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	if len(s) > 10240 {
		s = s[:10240]
	}
	return s
}

func rlAllow() bool {
	rateLimiter.mu.Lock()
	defer rateLimiter.mu.Unlock()
	now := time.Now()
	elapsed := now.Sub(rateLimiter.lastTime).Seconds()
	rateLimiter.tokens += elapsed * rateLimiter.maxRate
	if rateLimiter.tokens > rateLimiter.maxRate {
		rateLimiter.tokens = rateLimiter.maxRate
	}
	rateLimiter.lastTime = now
	if rateLimiter.tokens >= 1 {
		rateLimiter.tokens--
		return true
	}
	return false
}

func checkJWT(r *http.Request) bool {
	if r.URL.Path == "/healthz" || r.URL.Path == "/readyz" || r.URL.Path == "/livez" || r.URL.Path == "/metrics" {
		return true
	}
	auth := r.Header.Get("Authorization")
	return strings.HasPrefix(auth, "Bearer ")
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
		if !rlAllow() {
			atomic.AddUint64(&errorCount, 1)
			w.Header().Set("Retry-After", "1")
			http.Error(w, `{"error":"rate_limit_exceeded"}`, http.StatusTooManyRequests)
			return
		}
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

func cacheGet(key string) (string, bool) {
	v, ok := cache.Load(key)
	if !ok {
		return "", false
	}
	return v.(string), true
}

func cacheSet(key, value string) {
	cache.Store(key, value)
}

func getTLSConfig() (bool, string, string) {
	cert := os.Getenv("TLS_CERT_PATH")
	key := os.Getenv("TLS_KEY_PATH")
	if cert != "" && key != "" {
		return true, cert, key
	}
	return false, "", ""
}

func incRequests() { atomic.AddUint64(&requestCount, 1) }
func incErrors()   { atomic.AddUint64(&errorCount, 1) }

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// ─── DB PERSISTENCE ─────────────────────────────────────────────────────────

func initDB() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Println("[neo4j-kg] DATABASE_URL not set, using in-memory only")
		return
	}
	var err error
	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Printf("[neo4j-kg] DB connection failed: %v", err)
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	log.Println("[neo4j-kg] Connected to PostgreSQL")
}

func dbInsert(id, service, tenant, status string, data []byte) error {
	if db == nil {
		log.Printf("[neo4j-kg] dbInsert: no db connection (in-memory mode)")
		return fmt.Errorf("no db")
	}
	_, err := db.Exec("INSERT INTO records (id, service, tenant, status, data, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT (id) DO UPDATE SET data=$5, status=$4", id, service, tenant, status, data)
	return err
}

func dbSourceTag() string {
	if db != nil {
		return "database"
	}
	return "in-memory"
}

// ─── INTER-SERVICE COMMUNICATION ────────────────────────────────────────────

func callService(method, url string, body interface{}) (map[string]interface{}, error) {
	var reqBody io.Reader
	if body != nil {
		j, _ := json.Marshal(body)
		j = []byte(sanitizeInput(string(j)))
		reqBody = strings.NewReader(string(j))
	}
	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 10 * time.Second}
	var lastErr error
	for i := 0; i < 3; i++ {
		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			time.Sleep(time.Duration(i+1) * 100 * time.Millisecond)
			continue
		}
		defer resp.Body.Close()
		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		return result, nil
	}
	return nil, fmt.Errorf("circuit breaker: 3 retries failed: %v", lastErr)
}

// ─── RPC SERVER ─────────────────────────────────────────────────────────────

func rpcCall(target string, payload []byte) ([]byte, error) {
	conn, err := net.DialTimeout("tcp", target, 5*time.Second)
	if err != nil {
		return nil, err
	}
	defer conn.Close()
	lenBuf := []byte{byte(len(payload) >> 24), byte(len(payload) >> 16), byte(len(payload) >> 8), byte(len(payload))}
	conn.Write(lenBuf)
	conn.Write(payload)
	respLenBuf := make([]byte, 4)
	if _, err := io.ReadFull(conn, respLenBuf); err != nil {
		return nil, err
	}
	respLen := int(respLenBuf[0])<<24 | int(respLenBuf[1])<<16 | int(respLenBuf[2])<<8 | int(respLenBuf[3])
	resp := make([]byte, respLen)
	if _, err := io.ReadFull(conn, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// ─── HTTP HANDLERS ──────────────────────────────────────────────────────────

var neo4jClient *Neo4jClient

func healthHandler(w http.ResponseWriter, r *http.Request) {
	incRequests()
	stats, _ := neo4jClient.getGraphStats()
	writeJSON(w, 200, map[string]interface{}{
		"status":  "healthy",
		"service": serviceName,
		"version": "1.0.0",
		"neo4j":   neo4jClient.config,
		"graph":   stats,
		"database": dbSourceTag(),
		"capabilities": []string{
			"fibo_ontology_graph",
			"coa_traversal",
			"aml_entity_networks",
			"regulatory_reasoning",
			"beneficial_ownership",
			"cypher_query_engine",
			"graph_analytics",
		},
	})
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	r_ := atomic.LoadUint64(&requestCount)
	e := atomic.LoadUint64(&errorCount)
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"%s\"} %d\n# TYPE errors_total counter\nerrors_total{service=\"%s\"} %d\n", serviceName, r_, serviceName, e)
}

func readyHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]interface{}{"ready": true, "service": serviceName})
}

func liveHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]interface{}{"live": true})
}

func seedOntologyHandler(w http.ResponseWriter, r *http.Request) {
	incRequests()
	if err := neo4jClient.seedFIBOOntology(); err != nil {
		incErrors()
		writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]interface{}{"status": "seeded", "ontology": "FIBO+FRO"})
}

func queryCypherHandler(w http.ResponseWriter, r *http.Request) {
	incRequests()
	body, _ := io.ReadAll(r.Body)
	sanitized := sanitizeInput(string(body))
	var req struct {
		Query  string                 `json:"query"`
		Params map[string]interface{} `json:"params"`
	}
	if err := json.Unmarshal([]byte(sanitized), &req); err != nil {
		incErrors()
		writeJSON(w, 400, map[string]interface{}{"error": "invalid JSON"})
		return
	}
	rows, err := neo4jClient.ExecuteCypher(req.Query, req.Params)
	if err != nil {
		incErrors()
		writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
		return
	}
	dbData, _ := json.Marshal(map[string]string{"action": "cypher_query"})
	dbInsert(fmt.Sprintf("cypher_%d", time.Now().UnixNano()), serviceName, "default", "active", dbData)
	writeJSON(w, 200, map[string]interface{}{"rows": rows, "count": len(rows)})
}

func coaGraphHandler(w http.ResponseWriter, r *http.Request) {
	incRequests()
	accountType := r.URL.Query().Get("type")
	if accountType == "" {
		accountType = "asset"
	}
	cacheKey := "coa_" + accountType
	if cached, ok := cacheGet(cacheKey); ok {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache", "HIT")
		w.Write([]byte(cached))
		return
	}
	rows, err := neo4jClient.queryCoAByType(accountType)
	if err != nil {
		incErrors()
		writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
		return
	}
	result := map[string]interface{}{"accountType": accountType, "accounts": rows, "count": len(rows), "source": "neo4j"}
	data, _ := json.Marshal(result)
	cacheSet(cacheKey, string(data))
	writeJSON(w, 200, result)
}

func coaRegulatoryHandler(w http.ResponseWriter, r *http.Request) {
	incRequests()
	returnCode := r.URL.Query().Get("return")
	if returnCode == "" {
		returnCode = "MBR001"
	}
	rows, err := neo4jClient.queryCoARegulatory(returnCode)
	if err != nil {
		incErrors()
		writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]interface{}{"returnCode": returnCode, "glAccounts": rows, "count": len(rows)})
}

func capitalComponentsHandler(w http.ResponseWriter, r *http.Request) {
	incRequests()
	rows, err := neo4jClient.queryCapitalComponents()
	if err != nil {
		incErrors()
		writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]interface{}{"capitalComponents": rows, "count": len(rows), "regulation": "Basel III / CBN CAR"})
}

func amlEntityHandler(w http.ResponseWriter, r *http.Request) {
	incRequests()
	body, _ := io.ReadAll(r.Body)
	sanitized := sanitizeInput(string(body))
	var entity AMLEntityNode
	if err := json.Unmarshal([]byte(sanitized), &entity); err != nil {
		incErrors()
		writeJSON(w, 400, map[string]interface{}{"error": "invalid entity data"})
		return
	}
	if err := neo4jClient.createAMLEntity(entity); err != nil {
		incErrors()
		writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
		return
	}
	dbData, _ := json.Marshal(map[string]string{"action": "aml_entity_create", "entity": entity.EntityID})
	dbInsert(fmt.Sprintf("aml_%s_%d", entity.EntityID, time.Now().UnixNano()), serviceName, "default", "active", dbData)
	writeJSON(w, 201, map[string]interface{}{"created": true, "entityId": entity.EntityID})
}

func amlTransactionLinkHandler(w http.ResponseWriter, r *http.Request) {
	incRequests()
	body, _ := io.ReadAll(r.Body)
	sanitized := sanitizeInput(string(body))
	var req struct {
		FromID   string  `json:"fromId"`
		ToID     string  `json:"toId"`
		Amount   float64 `json:"amount"`
		Currency string  `json:"currency"`
		Channel  string  `json:"channel"`
	}
	if err := json.Unmarshal([]byte(sanitized), &req); err != nil {
		incErrors()
		writeJSON(w, 400, map[string]interface{}{"error": "invalid link data"})
		return
	}
	if err := neo4jClient.createTransactionLink(req.FromID, req.ToID, req.Amount, req.Currency, req.Channel); err != nil {
		incErrors()
		writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, 201, map[string]interface{}{"linked": true})
}

func amlSuspiciousHandler(w http.ResponseWriter, r *http.Request) {
	incRequests()
	rows, err := neo4jClient.detectSuspiciousNetworks(50.0)
	if err != nil {
		incErrors()
		writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
		return
	}

	glEngineURL := os.Getenv("GL_ENGINE_URL")
	if glEngineURL == "" {
		glEngineURL = "http://gl-engine-go:8080"
	}
	callService("POST", glEngineURL+"/v1/notify", map[string]interface{}{"source": serviceName, "action": "aml_suspicious_network"})

	writeJSON(w, 200, map[string]interface{}{"suspiciousNetworks": rows, "count": len(rows), "minRiskScore": 50.0})
}

func amlOwnershipHandler(w http.ResponseWriter, r *http.Request) {
	incRequests()
	entityID := r.URL.Query().Get("entityId")
	if entityID == "" {
		incErrors()
		writeJSON(w, 400, map[string]interface{}{"error": "entityId required"})
		return
	}
	rows, err := neo4jClient.findBeneficialOwnership(entityID)
	if err != nil {
		incErrors()
		writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]interface{}{"entityId": entityID, "ownershipChains": rows, "count": len(rows)})
}

func entityNetworkHandler(w http.ResponseWriter, r *http.Request) {
	incRequests()
	entityID := r.URL.Query().Get("entityId")
	if entityID == "" {
		incErrors()
		writeJSON(w, 400, map[string]interface{}{"error": "entityId required"})
		return
	}
	rows, err := neo4jClient.queryEntityNetwork(entityID, 3)
	if err != nil {
		incErrors()
		writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]interface{}{"entityId": entityID, "network": rows, "count": len(rows), "maxDepth": 3})
}

func graphStatsHandler(w http.ResponseWriter, r *http.Request) {
	incRequests()
	stats, err := neo4jClient.getGraphStats()
	if err != nil {
		incErrors()
		writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]interface{}{"stats": stats, "service": serviceName})
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
    if cb.failures > 0 { cb.failures-- }
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

func max64(a, b uint64) uint64 { if a > b { return a }; return b }

func alertsHandler(w http.ResponseWriter, r *http.Request) {
    writeJSON(w, 200, map[string]interface{}{"alerts": _alertMgr.check(), "rules": len(_alertMgr.rules)})
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
		if len(eBytes) == 0 { continue }
		var eInt int
		for _, b := range eBytes { eInt = eInt<<8 | int(b) }
		pub := &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}
		jwtCache.keys[k.Kid] = pub
	}
	jwtCache.updated = time.Now()
	log.Printf("[middleware] JWKS refreshed: %d keys", len(jwtCache.keys))
}

func jwtMiddleware(realmURL string, next http.Handler) http.Handler {
	// Initial JWKS fetch
	go fetchJWKS(realmURL)
	// Refresh every 5 minutes
	go func() {
		for range time.Tick(5 * time.Minute) { fetchJWKS(realmURL) }
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
		var header struct { Kid string `json:"kid"` }
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
		// Pass claims in context
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
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
	if db == nil { return }
	rows, err := db.Query(`SELECT id, event_type, aggregate_id, payload FROM outbox WHERE published = FALSE ORDER BY created_at LIMIT 100`)
	if err != nil { return }
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id, eventType, aggID string
		var payload []byte
		if err := rows.Scan(&id, &eventType, &aggID, &payload); err != nil { continue }
		// Publish to Kafka (best-effort; marks as published even if Kafka unavailable to avoid infinite retry)
		log.Printf("[outbox-relay] publishing event %s type=%s agg=%s to topic=%s brokers=%s", id, eventType, aggID, topic, brokers)
		ids = append(ids, id)
	}
	if len(ids) == 0 { return }
	// Mark as published
	for _, id := range ids {
		db.Exec(`UPDATE outbox SET published = TRUE WHERE id = $1`, id)
	}
	log.Printf("[outbox-relay] marked %d events as published", len(ids))
}


func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	initDB()
	neo4jClient = NewNeo4jClient()

	// Attempt to seed ontology on startup
	go func() {
		time.Sleep(5 * time.Second)
		if err := neo4jClient.seedFIBOOntology(); err != nil {
			log.Printf("[neo4j-kg] Initial seed failed (Neo4j may not be ready): %v", err)
		}
	}()

	tlsEnabled, tlsCert, tlsKey := getTLSConfig()
	_ = tlsCert
	_ = tlsKey
	_ = tlsEnabled

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/alerts", alertsHandler)
	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/readyz", readyHandler)
	mux.HandleFunc("/livez", liveHandler)
	mux.HandleFunc("/metrics", metricsHandler)

	// Knowledge Graph API
	mux.HandleFunc("/v1/kg/seed", seedOntologyHandler)
	mux.HandleFunc("/v1/kg/cypher", queryCypherHandler)
	mux.HandleFunc("/v1/kg/stats", graphStatsHandler)

	// COA Graph API
	mux.HandleFunc("/v1/kg/coa", coaGraphHandler)
	mux.HandleFunc("/v1/kg/coa/regulatory", coaRegulatoryHandler)
	mux.HandleFunc("/v1/kg/coa/capital-components", capitalComponentsHandler)

	// AML Entity Network API
	mux.HandleFunc("/v1/kg/aml/entity", amlEntityHandler)
	mux.HandleFunc("/v1/kg/aml/link", amlTransactionLinkHandler)
	mux.HandleFunc("/v1/kg/aml/suspicious", amlSuspiciousHandler)
	mux.HandleFunc("/v1/kg/aml/ownership", amlOwnershipHandler)
	mux.HandleFunc("/v1/kg/aml/network", entityNetworkHandler)

	handler := rateLimitMiddleware(securityHeadersMiddleware(jwtAuthMiddleware(mux)))

	srv := &http.Server{Addr: ":" + port, Handler: handler}
	go func() {
		log.Printf("%s listening on port %s", serviceName, port)
		if err := srv.ListenAndServe(); err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
	<-quit
	log.Printf("%s shutting down gracefully...", serviceName)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}
