package main

// W12-C3-P2-B2 (GO-SVC-FIELD-MAPS, register items main.go:247-248): the
// shadow InMemoryGraph (nodes map[string]COANode + edges []COAEdge, seeded
// from hardcoded data and mutated at runtime) was removed. Neo4j is the
// graph-of-record: seed data is MERGEd at boot, all reads/writes go through
// the Bolt client, and graph analytics (PageRank, BFS traversal, Basel III,
// liquidity) are computed over a snapshot fetched from Neo4j per request —
// no divergent in-memory copy is retained. When Neo4j is unavailable the
// handlers fail closed (503) instead of serving stale shadow state.

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
)

// connectedNeo4j returns a Bolt-connected client (the pre-existing
// coaCypherHandler constructed a client but never called Connect, so the
// "neo4j" path always fell back — part of the shadow divergence).
func connectedNeo4j() (*Neo4jClient, error) {
	c := NewNeo4jClient()
	if err := c.Connect(); err != nil {
		return nil, err
	}
	return c, nil
}

// seedGraphToNeo4j MERGEs the canonical COA seed graph (idempotent).
func seedGraphToNeo4j() error {
	c, err := connectedNeo4j()
	if err != nil {
		return err
	}
	for _, n := range getSeedCOA() {
		if err := mergeNode(c, n); err != nil {
			return fmt.Errorf("seed node %s: %w", n.Code, err)
		}
	}
	for _, e := range getSeedEdges() {
		if err := mergeEdge(c, e); err != nil {
			return fmt.Errorf("seed edge %s->%s: %w", e.FromCode, e.ToCode, err)
		}
	}
	return nil
}

// mergeNode upserts one COA node (idempotent on code).
func mergeNode(c *Neo4jClient, n COANode) error {
	tags, _ := json.Marshal(n.Tags)
	_, err := c.ExecuteCypher(
		`MERGE (n:COANode {code: $code})
		 SET n.name = $name, n.category = $category, n.subcategory = $subcategory,
		     n.balance = $balance, n.currency = $currency, n.parent_code = $parent_code,
		     n.tags_json = $tags_json`,
		map[string]interface{}{
			"code": n.Code, "name": n.Name, "category": n.Category,
			"subcategory": n.Subcategory, "balance": n.Balance, "currency": n.Currency,
			"parent_code": n.ParentCode, "tags_json": string(tags),
		})
	return err
}

// mergeEdge upserts one COA relationship (idempotent on
// from/to/type triple; weight + metadata updated on match).
func mergeEdge(c *Neo4jClient, e COAEdge) error {
	meta, _ := json.Marshal(e.Metadata)
	_, err := c.ExecuteCypher(
		`MATCH (a:COANode {code: $from}), (b:COANode {code: $to})
		 MERGE (a)-[r:COA_EDGE {relation_type: $rel}]->(b)
		 SET r.weight = $weight, r.metadata_json = $metadata_json`,
		map[string]interface{}{
			"from": e.FromCode, "to": e.ToCode, "rel": e.RelationType,
			"weight": e.Weight, "metadata_json": string(meta),
		})
	return err
}

func rowString(row map[string]interface{}, key string) string {
	if v, ok := row[key].(string); ok {
		return v
	}
	return ""
}

func rowFloat(row map[string]interface{}, key string) float64 {
	switch v := row[key].(type) {
	case float64:
		return v
	case int64:
		return float64(v)
	case json.Number:
		f, _ := v.Float64()
		return f
	}
	return 0
}

func rowToNode(row map[string]interface{}) COANode {
	n := COANode{
		Code:        rowString(row, "code"),
		Name:        rowString(row, "name"),
		Category:    rowString(row, "category"),
		Subcategory: rowString(row, "subcategory"),
		Balance:     rowFloat(row, "balance"),
		Currency:    rowString(row, "currency"),
		ParentCode:  rowString(row, "parent_code"),
	}
	if tj := rowString(row, "tags_json"); tj != "" {
		_ = json.Unmarshal([]byte(tj), &n.Tags)
	}
	return n
}

func rowToEdge(row map[string]interface{}) COAEdge {
	e := COAEdge{
		FromCode:     rowString(row, "from_code"),
		ToCode:       rowString(row, "to_code"),
		RelationType: rowString(row, "relation_type"),
		Weight:       rowFloat(row, "weight"),
	}
	if mj := rowString(row, "metadata_json"); mj != "" {
		_ = json.Unmarshal([]byte(mj), &e.Metadata)
	}
	return e
}

const nodeReturn = `n.code AS code, n.name AS name, n.category AS category, n.subcategory AS subcategory, n.balance AS balance, n.currency AS currency, n.parent_code AS parent_code, n.tags_json AS tags_json`

// fetchNodes returns every COA node keyed by code.
func fetchNodes(c *Neo4jClient) (map[string]COANode, error) {
	rows, err := c.ExecuteCypher(`MATCH (n:COANode) RETURN `+nodeReturn, nil)
	if err != nil {
		return nil, err
	}
	nodes := make(map[string]COANode, len(rows))
	for _, row := range rows {
		n := rowToNode(row)
		nodes[n.Code] = n
	}
	return nodes, nil
}

// fetchEdges returns every COA relationship.
func fetchEdges(c *Neo4jClient) ([]COAEdge, error) {
	rows, err := c.ExecuteCypher(
		`MATCH (a:COANode)-[r:COA_EDGE]->(b:COANode)
		 RETURN a.code AS from_code, b.code AS to_code, r.relation_type AS relation_type, r.weight AS weight, r.metadata_json AS metadata_json`, nil)
	if err != nil {
		return nil, err
	}
	edges := make([]COAEdge, 0, len(rows))
	for _, row := range rows {
		edges = append(edges, rowToEdge(row))
	}
	return edges, nil
}

// fetchNode returns one node by code (nil, nil when absent).
func fetchNode(c *Neo4jClient, code string) (*COANode, error) {
	rows, err := c.ExecuteCypher(`MATCH (n:COANode {code: $code}) RETURN `+nodeReturn,
		map[string]interface{}{"code": code})
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	n := rowToNode(rows[0])
	return &n, nil
}

// fetchNeighbors returns edges incident to code, optionally filtered by type
// (mirrors the legacy InMemoryGraph.GetNeighbors semantics).
func fetchNeighbors(c *Neo4jClient, code, relType string) ([]COAEdge, error) {
	edges, err := fetchEdges(c)
	if err != nil {
		return nil, err
	}
	var result []COAEdge
	for _, e := range edges {
		if (e.FromCode == code || e.ToCode == code) && (relType == "" || e.RelationType == relType) {
			result = append(result, e)
		}
	}
	return result, nil
}

// ─── Pure graph analytics (operate on a Neo4j-fetched snapshot) ─────────────

// traversePathBFS finds a path from→to up to maxDepth hops (same algorithm as
// the removed InMemoryGraph.bfs).
func traversePathBFS(edges []COAEdge, from, to string, maxDepth int, visited map[string]bool) []string {
	if from == to {
		return []string{from}
	}
	if maxDepth <= 0 {
		return nil
	}
	visited[from] = true
	for _, e := range edges {
		next := ""
		if e.FromCode == from {
			next = e.ToCode
		} else if e.ToCode == from {
			next = e.FromCode
		}
		if next == "" || visited[next] {
			continue
		}
		if path := traversePathBFS(edges, next, to, maxDepth-1, visited); path != nil {
			return append([]string{from}, path...)
		}
	}
	return nil
}

// computePageRank is the removed InMemoryGraph.ComputePageRank as a pure
// function over a Neo4j snapshot.
func computePageRank(nodes map[string]COANode, edges []COAEdge, iterations int, damping float64) map[string]float64 {
	n := len(nodes)
	if n == 0 {
		return map[string]float64{}
	}
	rank := make(map[string]float64)
	for code := range nodes {
		rank[code] = 1.0 / float64(n)
	}
	outDegree := make(map[string]int)
	for _, e := range edges {
		outDegree[e.FromCode]++
	}
	for i := 0; i < iterations; i++ {
		newRank := make(map[string]float64)
		for code := range nodes {
			newRank[code] = (1 - damping) / float64(n)
		}
		for _, e := range edges {
			if outDegree[e.FromCode] > 0 {
				newRank[e.ToCode] += damping * rank[e.FromCode] / float64(outDegree[e.FromCode])
			}
		}
		rank = newRank
	}
	return rank
}

// computeBaselIIIMetrics is the removed InMemoryGraph.ComputeBaselIIIMetrics
// as a pure function over a Neo4j snapshot.
func computeBaselIIIMetrics(nodes map[string]COANode) map[string]interface{} {
	var totalRWA, cet1Capital, tier2Capital, totalLoans, totalProvisions float64
	for _, n := range nodes {
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

// computeLiquidityRatio is the removed InMemoryGraph.ComputeLiquidityRatio as
// a pure function over a Neo4j snapshot.
func computeLiquidityRatio(nodes map[string]COANode) map[string]interface{} {
	var liquidAssets, totalDeposits float64
	for _, n := range nodes {
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
