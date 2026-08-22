package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Prometheus metrics
var (
	searchRequests = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "unified_search_requests_total",
			Help: "Total unified search requests",
		},
		[]string{"index", "status"},
	)

	searchLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "unified_search_latency_seconds",
			Help:    "Latency of unified search requests",
			Buckets: []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5},
		},
		[]string{"index"},
	)

	indexOperations = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "unified_search_index_operations_total",
			Help: "Total index operations",
		},
		[]string{"index", "operation", "status"},
	)
)

// OpenSearch index names
const (
	IndexCustomers     = "customers"
	IndexAccounts      = "accounts"
	IndexTransactions  = "transactions"
	IndexLoans         = "loans"
	IndexDisputes      = "disputes"
	IndexDocuments     = "documents"
	IndexEmployees     = "employees"
	IndexProducts      = "products"
	IndexNotifications = "notifications"
	IndexTradeFinance  = "trade_finance"
)

// UnifiedSearchService provides platform-wide search capabilities
type UnifiedSearchService struct {
	opensearchURL string
	client        *http.Client
	indexQueue    chan *IndexRequest
	wg            sync.WaitGroup
	ctx           context.Context
	cancel        context.CancelFunc
}

// IndexRequest represents a request to index a document
type IndexRequest struct {
	Index    string                 `json:"index"`
	ID       string                 `json:"id"`
	Document map[string]interface{} `json:"document"`
	TenantID string                 `json:"tenant_id"`
}

// SearchRequest represents a search request
type SearchRequest struct {
	Query        string                 `json:"query"`
	TenantID     string                 `json:"tenant_id"`
	Indices      []string               `json:"indices,omitempty"`
	Filters      map[string]interface{} `json:"filters,omitempty"`
	From         int                    `json:"from,omitempty"`
	Size         int                    `json:"size,omitempty"`
	SortBy       string                 `json:"sort_by,omitempty"`
	SortOrder    string                 `json:"sort_order,omitempty"`
	Highlight    bool                   `json:"highlight,omitempty"`
	Aggregations map[string]interface{} `json:"aggregations,omitempty"`
}

// SearchResponse represents a search response
type SearchResponse struct {
	Total        int64                  `json:"total"`
	Hits         []SearchHit            `json:"hits"`
	Aggregations map[string]interface{} `json:"aggregations,omitempty"`
	Took         int64                  `json:"took_ms"`
}

// SearchHit represents a single search result
type SearchHit struct {
	Index     string                 `json:"index"`
	ID        string                 `json:"id"`
	Score     float64                `json:"score"`
	Source    map[string]interface{} `json:"source"`
	Highlight map[string][]string    `json:"highlight,omitempty"`
}

// NewUnifiedSearchService creates a new unified search service
func NewUnifiedSearchService() *UnifiedSearchService {
	ctx, cancel := context.WithCancel(context.Background())

	service := &UnifiedSearchService{
		opensearchURL: getEnvOrDefault("OPENSEARCH_URL", "http://opensearch:9200"),
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		indexQueue: make(chan *IndexRequest, 10000),
		ctx:        ctx,
		cancel:     cancel,
	}

	// Initialize indices
	service.initializeIndices()

	// Start background indexer
	service.wg.Add(1)
	go service.backgroundIndexer()

	return service
}

// RegisterRoutes registers search API routes
func (s *UnifiedSearchService) RegisterRoutes(router *mux.Router) {
	api := router.PathPrefix("/api/v1/search").Subrouter()

	// Unified search
	api.HandleFunc("/", s.unifiedSearch).Methods("POST")
	api.HandleFunc("/multi", s.multiIndexSearch).Methods("POST")

	// Domain-specific search endpoints
	api.HandleFunc("/customers", s.searchCustomers).Methods("POST")
	api.HandleFunc("/accounts", s.searchAccounts).Methods("POST")
	api.HandleFunc("/transactions", s.searchTransactions).Methods("POST")
	api.HandleFunc("/loans", s.searchLoans).Methods("POST")
	api.HandleFunc("/disputes", s.searchDisputes).Methods("POST")
	api.HandleFunc("/documents", s.searchDocuments).Methods("POST")
	api.HandleFunc("/employees", s.searchEmployees).Methods("POST")
	api.HandleFunc("/products", s.searchProducts).Methods("POST")
	api.HandleFunc("/notifications", s.searchNotifications).Methods("POST")
	api.HandleFunc("/trade-finance", s.searchTradeFinance).Methods("POST")

	// Indexing endpoints (for internal use)
	api.HandleFunc("/index", s.indexDocument).Methods("POST")
	api.HandleFunc("/index/bulk", s.bulkIndex).Methods("POST")
	api.HandleFunc("/index/{index}/{id}", s.deleteDocument).Methods("DELETE")

	// Suggestions/autocomplete
	api.HandleFunc("/suggest/customers", s.suggestCustomers).Methods("GET")
	api.HandleFunc("/suggest/accounts", s.suggestAccounts).Methods("GET")
	api.HandleFunc("/suggest/products", s.suggestProducts).Methods("GET")

	// Admin endpoints
	api.HandleFunc("/admin/reindex/{index}", s.reindexIndex).Methods("POST")
	api.HandleFunc("/admin/stats", s.getStats).Methods("GET")
}

// initializeIndices creates all required indices with mappings
func (s *UnifiedSearchService) initializeIndices() {
	indices := map[string]map[string]interface{}{
		IndexCustomers: {
			"mappings": map[string]interface{}{
				"properties": map[string]interface{}{
					"tenant_id":       map[string]string{"type": "keyword"},
					"customer_id":     map[string]string{"type": "keyword"},
					"first_name":      map[string]interface{}{"type": "text", "analyzer": "standard", "fields": map[string]interface{}{"keyword": map[string]string{"type": "keyword"}}},
					"last_name":       map[string]interface{}{"type": "text", "analyzer": "standard", "fields": map[string]interface{}{"keyword": map[string]string{"type": "keyword"}}},
					"full_name":       map[string]interface{}{"type": "text", "analyzer": "standard"},
					"email":           map[string]interface{}{"type": "text", "fields": map[string]interface{}{"keyword": map[string]string{"type": "keyword"}}},
					"phone":           map[string]string{"type": "keyword"},
					"bvn":             map[string]string{"type": "keyword"},
					"nin":             map[string]string{"type": "keyword"},
					"account_numbers": map[string]string{"type": "keyword"},
					"status":          map[string]string{"type": "keyword"},
					"kyc_status":      map[string]string{"type": "keyword"},
					"tier":            map[string]string{"type": "keyword"},
					"created_at":      map[string]string{"type": "date"},
					"updated_at":      map[string]string{"type": "date"},
					"address":         map[string]interface{}{"type": "text"},
					"city":            map[string]string{"type": "keyword"},
					"state":           map[string]string{"type": "keyword"},
					"branch_id":       map[string]string{"type": "keyword"},
				},
			},
			"settings": map[string]interface{}{
				"number_of_shards":   3,
				"number_of_replicas": 1,
				"analysis": map[string]interface{}{
					"analyzer": map[string]interface{}{
						"phone_analyzer": map[string]interface{}{
							"type":      "custom",
							"tokenizer": "keyword",
							"filter":    []string{"lowercase"},
						},
					},
				},
			},
		},
		IndexAccounts: {
			"mappings": map[string]interface{}{
				"properties": map[string]interface{}{
					"tenant_id":             map[string]string{"type": "keyword"},
					"account_id":            map[string]string{"type": "keyword"},
					"account_number":        map[string]string{"type": "keyword"},
					"account_name":          map[string]interface{}{"type": "text", "analyzer": "standard"},
					"customer_id":           map[string]string{"type": "keyword"},
					"customer_name":         map[string]interface{}{"type": "text"},
					"account_type":          map[string]string{"type": "keyword"},
					"product_code":          map[string]string{"type": "keyword"},
					"currency":              map[string]string{"type": "keyword"},
					"status":                map[string]string{"type": "keyword"},
					"balance":               map[string]string{"type": "double"},
					"available_balance":     map[string]string{"type": "double"},
					"branch_id":             map[string]string{"type": "keyword"},
					"opened_date":           map[string]string{"type": "date"},
					"last_transaction_date": map[string]string{"type": "date"},
				},
			},
			"settings": map[string]interface{}{
				"number_of_shards":   3,
				"number_of_replicas": 1,
			},
		},
		IndexTransactions: {
			"mappings": map[string]interface{}{
				"properties": map[string]interface{}{
					"tenant_id":            map[string]string{"type": "keyword"},
					"transaction_id":       map[string]string{"type": "keyword"},
					"reference":            map[string]string{"type": "keyword"},
					"account_id":           map[string]string{"type": "keyword"},
					"account_number":       map[string]string{"type": "keyword"},
					"customer_id":          map[string]string{"type": "keyword"},
					"customer_name":        map[string]interface{}{"type": "text"},
					"type":                 map[string]string{"type": "keyword"},
					"direction":            map[string]string{"type": "keyword"},
					"amount":               map[string]string{"type": "double"},
					"currency":             map[string]string{"type": "keyword"},
					"status":               map[string]string{"type": "keyword"},
					"channel":              map[string]string{"type": "keyword"},
					"narration":            map[string]interface{}{"type": "text", "analyzer": "standard"},
					"counterparty_name":    map[string]interface{}{"type": "text"},
					"counterparty_account": map[string]string{"type": "keyword"},
					"counterparty_bank":    map[string]string{"type": "keyword"},
					"created_at":           map[string]string{"type": "date"},
					"value_date":           map[string]string{"type": "date"},
					"branch_id":            map[string]string{"type": "keyword"},
				},
			},
			"settings": map[string]interface{}{
				"number_of_shards":   5,
				"number_of_replicas": 1,
			},
		},
		IndexLoans: {
			"mappings": map[string]interface{}{
				"properties": map[string]interface{}{
					"tenant_id":           map[string]string{"type": "keyword"},
					"loan_id":             map[string]string{"type": "keyword"},
					"application_id":      map[string]string{"type": "keyword"},
					"customer_id":         map[string]string{"type": "keyword"},
					"customer_name":       map[string]interface{}{"type": "text"},
					"product_code":        map[string]string{"type": "keyword"},
					"product_name":        map[string]interface{}{"type": "text"},
					"amount":              map[string]string{"type": "double"},
					"disbursed_amount":    map[string]string{"type": "double"},
					"outstanding_balance": map[string]string{"type": "double"},
					"interest_rate":       map[string]string{"type": "double"},
					"tenure_months":       map[string]string{"type": "integer"},
					"status":              map[string]string{"type": "keyword"},
					"disbursement_date":   map[string]string{"type": "date"},
					"maturity_date":       map[string]string{"type": "date"},
					"next_payment_date":   map[string]string{"type": "date"},
					"branch_id":           map[string]string{"type": "keyword"},
					"loan_officer_id":     map[string]string{"type": "keyword"},
					"loan_officer_name":   map[string]interface{}{"type": "text"},
					"collateral_type":     map[string]string{"type": "keyword"},
					"purpose":             map[string]interface{}{"type": "text"},
				},
			},
			"settings": map[string]interface{}{
				"number_of_shards":   3,
				"number_of_replicas": 1,
			},
		},
		IndexDisputes: {
			"mappings": map[string]interface{}{
				"properties": map[string]interface{}{
					"tenant_id":        map[string]string{"type": "keyword"},
					"dispute_id":       map[string]string{"type": "keyword"},
					"ticket_number":    map[string]string{"type": "keyword"},
					"customer_id":      map[string]string{"type": "keyword"},
					"customer_name":    map[string]interface{}{"type": "text"},
					"account_id":       map[string]string{"type": "keyword"},
					"transaction_id":   map[string]string{"type": "keyword"},
					"category":         map[string]string{"type": "keyword"},
					"subcategory":      map[string]string{"type": "keyword"},
					"status":           map[string]string{"type": "keyword"},
					"priority":         map[string]string{"type": "keyword"},
					"amount":           map[string]string{"type": "double"},
					"description":      map[string]interface{}{"type": "text", "analyzer": "standard"},
					"resolution":       map[string]interface{}{"type": "text"},
					"assigned_to":      map[string]string{"type": "keyword"},
					"assigned_to_name": map[string]interface{}{"type": "text"},
					"created_at":       map[string]string{"type": "date"},
					"resolved_at":      map[string]string{"type": "date"},
					"sla_due_date":     map[string]string{"type": "date"},
					"channel":          map[string]string{"type": "keyword"},
				},
			},
			"settings": map[string]interface{}{
				"number_of_shards":   2,
				"number_of_replicas": 1,
			},
		},
		IndexDocuments: {
			"mappings": map[string]interface{}{
				"properties": map[string]interface{}{
					"tenant_id":           map[string]string{"type": "keyword"},
					"document_id":         map[string]string{"type": "keyword"},
					"customer_id":         map[string]string{"type": "keyword"},
					"customer_name":       map[string]interface{}{"type": "text"},
					"document_type":       map[string]string{"type": "keyword"},
					"document_name":       map[string]interface{}{"type": "text"},
					"file_name":           map[string]interface{}{"type": "text"},
					"mime_type":           map[string]string{"type": "keyword"},
					"status":              map[string]string{"type": "keyword"},
					"verification_status": map[string]string{"type": "keyword"},
					"extracted_text":      map[string]interface{}{"type": "text", "analyzer": "standard"},
					"ocr_confidence":      map[string]string{"type": "double"},
					"metadata":            map[string]string{"type": "object"},
					"uploaded_at":         map[string]string{"type": "date"},
					"verified_at":         map[string]string{"type": "date"},
					"expiry_date":         map[string]string{"type": "date"},
					"tags":                map[string]string{"type": "keyword"},
				},
			},
			"settings": map[string]interface{}{
				"number_of_shards":   3,
				"number_of_replicas": 1,
			},
		},
		IndexEmployees: {
			"mappings": map[string]interface{}{
				"properties": map[string]interface{}{
					"tenant_id":   map[string]string{"type": "keyword"},
					"employee_id": map[string]string{"type": "keyword"},
					"staff_id":    map[string]string{"type": "keyword"},
					"first_name":  map[string]interface{}{"type": "text", "fields": map[string]interface{}{"keyword": map[string]string{"type": "keyword"}}},
					"last_name":   map[string]interface{}{"type": "text", "fields": map[string]interface{}{"keyword": map[string]string{"type": "keyword"}}},
					"full_name":   map[string]interface{}{"type": "text"},
					"email":       map[string]interface{}{"type": "text", "fields": map[string]interface{}{"keyword": map[string]string{"type": "keyword"}}},
					"phone":       map[string]string{"type": "keyword"},
					"department":  map[string]string{"type": "keyword"},
					"role":        map[string]string{"type": "keyword"},
					"job_title":   map[string]interface{}{"type": "text"},
					"branch_id":   map[string]string{"type": "keyword"},
					"branch_name": map[string]interface{}{"type": "text"},
					"manager_id":  map[string]string{"type": "keyword"},
					"status":      map[string]string{"type": "keyword"},
					"hire_date":   map[string]string{"type": "date"},
					"last_login":  map[string]string{"type": "date"},
				},
			},
			"settings": map[string]interface{}{
				"number_of_shards":   2,
				"number_of_replicas": 1,
			},
		},
		IndexProducts: {
			"mappings": map[string]interface{}{
				"properties": map[string]interface{}{
					"tenant_id":     map[string]string{"type": "keyword"},
					"product_id":    map[string]string{"type": "keyword"},
					"product_code":  map[string]string{"type": "keyword"},
					"product_name":  map[string]interface{}{"type": "text", "analyzer": "standard"},
					"category":      map[string]string{"type": "keyword"},
					"subcategory":   map[string]string{"type": "keyword"},
					"description":   map[string]interface{}{"type": "text"},
					"features":      map[string]interface{}{"type": "text"},
					"currency":      map[string]string{"type": "keyword"},
					"min_amount":    map[string]string{"type": "double"},
					"max_amount":    map[string]string{"type": "double"},
					"interest_rate": map[string]string{"type": "double"},
					"status":        map[string]string{"type": "keyword"},
					"eligibility":   map[string]interface{}{"type": "text"},
					"terms":         map[string]interface{}{"type": "text"},
					"tags":          map[string]string{"type": "keyword"},
					"created_at":    map[string]string{"type": "date"},
				},
			},
			"settings": map[string]interface{}{
				"number_of_shards":   1,
				"number_of_replicas": 1,
			},
		},
		IndexNotifications: {
			"mappings": map[string]interface{}{
				"properties": map[string]interface{}{
					"tenant_id":       map[string]string{"type": "keyword"},
					"notification_id": map[string]string{"type": "keyword"},
					"customer_id":     map[string]string{"type": "keyword"},
					"employee_id":     map[string]string{"type": "keyword"},
					"type":            map[string]string{"type": "keyword"},
					"channel":         map[string]string{"type": "keyword"},
					"subject":         map[string]interface{}{"type": "text"},
					"body":            map[string]interface{}{"type": "text"},
					"status":          map[string]string{"type": "keyword"},
					"priority":        map[string]string{"type": "keyword"},
					"sent_at":         map[string]string{"type": "date"},
					"read_at":         map[string]string{"type": "date"},
					"reference_type":  map[string]string{"type": "keyword"},
					"reference_id":    map[string]string{"type": "keyword"},
				},
			},
			"settings": map[string]interface{}{
				"number_of_shards":   3,
				"number_of_replicas": 1,
			},
		},
		IndexTradeFinance: {
			"mappings": map[string]interface{}{
				"properties": map[string]interface{}{
					"tenant_id":            map[string]string{"type": "keyword"},
					"trade_id":             map[string]string{"type": "keyword"},
					"reference":            map[string]string{"type": "keyword"},
					"customer_id":          map[string]string{"type": "keyword"},
					"customer_name":        map[string]interface{}{"type": "text"},
					"type":                 map[string]string{"type": "keyword"},
					"instrument_type":      map[string]string{"type": "keyword"},
					"amount":               map[string]string{"type": "double"},
					"currency":             map[string]string{"type": "keyword"},
					"status":               map[string]string{"type": "keyword"},
					"counterparty":         map[string]interface{}{"type": "text"},
					"counterparty_country": map[string]string{"type": "keyword"},
					"goods_description":    map[string]interface{}{"type": "text"},
					"port_of_loading":      map[string]interface{}{"type": "text"},
					"port_of_discharge":    map[string]interface{}{"type": "text"},
					"issue_date":           map[string]string{"type": "date"},
					"expiry_date":          map[string]string{"type": "date"},
					"shipment_date":        map[string]string{"type": "date"},
				},
			},
			"settings": map[string]interface{}{
				"number_of_shards":   2,
				"number_of_replicas": 1,
			},
		},
	}

	for indexName, mapping := range indices {
		_ = s.createIndex(context.Background(), indexName, mapping)

	}
}

// createIndex creates an index with mapping
func (s *UnifiedSearchService) createIndex(ctx context.Context, index string, definition map[string]interface{}) error {
	body, statusCode, err := s.doOpenSearchRequest(ctx, http.MethodPut, fmt.Sprintf("/%s", index), definition)
	if err != nil {
		return err
	}
	if statusCode >= 300 {
		return fmt.Errorf("status %d: %s", statusCode, string(body))
	}
	return nil
}

// unifiedSearch performs search across all indices
func (s *UnifiedSearchService) unifiedSearch(w http.ResponseWriter, r *http.Request) {
	var req SearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.Size == 0 {
		req.Size = 20
	}

	// Default to all indices if none specified
	if len(req.Indices) == 0 {
		req.Indices = []string{
			IndexCustomers, IndexAccounts, IndexTransactions,
			IndexLoans, IndexDisputes, IndexDocuments,
			IndexEmployees, IndexProducts, IndexNotifications,
		}
	}

	result, err := s.search(r.Context(), req)
	if err != nil {
		searchRequests.WithLabelValues("unified", "error").Inc()
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	searchRequests.WithLabelValues("unified", "success").Inc()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// multiIndexSearch performs search across multiple specified indices
func (s *UnifiedSearchService) multiIndexSearch(w http.ResponseWriter, r *http.Request) {
	var req SearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if len(req.Indices) == 0 {
		http.Error(w, "At least one index must be specified", http.StatusBadRequest)
		return
	}

	if req.Size == 0 {
		req.Size = 20
	}

	result, err := s.search(r.Context(), req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// search performs the actual OpenSearch query
func (s *UnifiedSearchService) search(ctx context.Context, req SearchRequest) (*SearchResponse, error) {
	start := time.Now()

	// Build OpenSearch query
	query := s.buildQuery(req)

	// Join indices
	indices := strings.Join(req.Indices, ",")

	body, _ := json.Marshal(query)

	httpReq, err := http.NewRequestWithContext(ctx, "POST", fmt.Sprintf("%s/%s/_search", s.opensearchURL, indices), bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("OpenSearch error: %s", string(bodyBytes))
	}

	var osResp struct {
		Took int64 `json:"took"`
		Hits struct {
			Total struct {
				Value int64 `json:"value"`
			} `json:"total"`
			Hits []struct {
				Index     string                 `json:"_index"`
				ID        string                 `json:"_id"`
				Score     float64                `json:"_score"`
				Source    map[string]interface{} `json:"_source"`
				Highlight map[string][]string    `json:"highlight,omitempty"`
			} `json:"hits"`
		} `json:"hits"`
		Aggregations map[string]interface{} `json:"aggregations,omitempty"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&osResp); err != nil {
		return nil, err
	}

	// Convert to response
	result := &SearchResponse{
		Total:        osResp.Hits.Total.Value,
		Took:         osResp.Took,
		Aggregations: osResp.Aggregations,
	}

	for _, hit := range osResp.Hits.Hits {
		result.Hits = append(result.Hits, SearchHit{
			Index:     hit.Index,
			ID:        hit.ID,
			Score:     hit.Score,
			Source:    hit.Source,
			Highlight: hit.Highlight,
		})
	}

	searchLatency.WithLabelValues(strings.Join(req.Indices, ",")).Observe(time.Since(start).Seconds())

	return result, nil
}

// buildQuery builds an OpenSearch query from SearchRequest
func (s *UnifiedSearchService) buildQuery(req SearchRequest) map[string]interface{} {
	query := map[string]interface{}{
		"from": req.From,
		"size": req.Size,
	}

	// Build bool query
	boolQuery := map[string]interface{}{}
	var must []interface{}
	var filter []interface{}

	// Tenant filter (always required for multi-tenancy)
	if req.TenantID != "" {
		filter = append(filter, map[string]interface{}{
			"term": map[string]string{"tenant_id": req.TenantID},
		})
	}

	// Main query
	if req.Query != "" {
		must = append(must, map[string]interface{}{
			"multi_match": map[string]interface{}{
				"query":     req.Query,
				"type":      "best_fields",
				"fuzziness": "AUTO",
				"fields": []string{
					"full_name^3", "first_name^2", "last_name^2",
					"customer_name^2", "account_name^2",
					"email^2", "phone^2",
					"account_number^3", "reference^3",
					"narration", "description", "subject", "body",
					"product_name^2", "extracted_text",
					"bvn^3", "nin^3", "staff_id^3",
				},
			},
		})
	}

	// Additional filters
	for field, value := range req.Filters {
		switch v := value.(type) {
		case string:
			filter = append(filter, map[string]interface{}{
				"term": map[string]string{field: v},
			})
		case []interface{}:
			filter = append(filter, map[string]interface{}{
				"terms": map[string]interface{}{field: v},
			})
		case map[string]interface{}:
			// Range filter
			if _, ok := v["gte"]; ok {
				filter = append(filter, map[string]interface{}{
					"range": map[string]interface{}{field: v},
				})
			} else if _, ok := v["lte"]; ok {
				filter = append(filter, map[string]interface{}{
					"range": map[string]interface{}{field: v},
				})
			}
		}
	}

	if len(must) > 0 {
		boolQuery["must"] = must
	}
	if len(filter) > 0 {
		boolQuery["filter"] = filter
	}

	if len(boolQuery) > 0 {
		query["query"] = map[string]interface{}{"bool": boolQuery}
	} else {
		query["query"] = map[string]interface{}{"match_all": map[string]interface{}{}}
	}

	// Sorting
	if req.SortBy != "" {
		order := "desc"
		if req.SortOrder != "" {
			order = req.SortOrder
		}
		query["sort"] = []map[string]interface{}{
			{req.SortBy: map[string]string{"order": order}},
		}
	}

	// Highlighting
	if req.Highlight {
		query["highlight"] = map[string]interface{}{
			"fields": map[string]interface{}{
				"*": map[string]interface{}{},
			},
			"pre_tags":  []string{"<em>"},
			"post_tags": []string{"</em>"},
		}
	}

	// Aggregations
	if len(req.Aggregations) > 0 {
		query["aggs"] = req.Aggregations
	}

	return query
}

// Domain-specific search handlers
func (s *UnifiedSearchService) searchCustomers(w http.ResponseWriter, r *http.Request) {
	s.domainSearch(w, r, IndexCustomers)
}

func (s *UnifiedSearchService) searchAccounts(w http.ResponseWriter, r *http.Request) {
	s.domainSearch(w, r, IndexAccounts)
}

func (s *UnifiedSearchService) searchTransactions(w http.ResponseWriter, r *http.Request) {
	s.domainSearch(w, r, IndexTransactions)
}

func (s *UnifiedSearchService) searchLoans(w http.ResponseWriter, r *http.Request) {
	s.domainSearch(w, r, IndexLoans)
}

func (s *UnifiedSearchService) searchDisputes(w http.ResponseWriter, r *http.Request) {
	s.domainSearch(w, r, IndexDisputes)
}

func (s *UnifiedSearchService) searchDocuments(w http.ResponseWriter, r *http.Request) {
	s.domainSearch(w, r, IndexDocuments)
}

func (s *UnifiedSearchService) searchEmployees(w http.ResponseWriter, r *http.Request) {
	s.domainSearch(w, r, IndexEmployees)
}

func (s *UnifiedSearchService) searchProducts(w http.ResponseWriter, r *http.Request) {
	s.domainSearch(w, r, IndexProducts)
}

func (s *UnifiedSearchService) searchNotifications(w http.ResponseWriter, r *http.Request) {
	s.domainSearch(w, r, IndexNotifications)
}

func (s *UnifiedSearchService) searchTradeFinance(w http.ResponseWriter, r *http.Request) {
	s.domainSearch(w, r, IndexTradeFinance)
}

func (s *UnifiedSearchService) domainSearch(w http.ResponseWriter, r *http.Request, index string) {
	var req SearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	req.Indices = []string{index}
	if req.Size == 0 {
		req.Size = 20
	}

	result, err := s.search(r.Context(), req)
	if err != nil {
		searchRequests.WithLabelValues(index, "error").Inc()
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	searchRequests.WithLabelValues(index, "success").Inc()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// Suggestion/autocomplete handlers
func (s *UnifiedSearchService) suggestCustomers(w http.ResponseWriter, r *http.Request) {
	s.suggest(w, r, IndexCustomers, []string{"full_name", "email", "phone", "account_numbers"})
}

func (s *UnifiedSearchService) suggestAccounts(w http.ResponseWriter, r *http.Request) {
	s.suggest(w, r, IndexAccounts, []string{"account_number", "account_name"})
}

func (s *UnifiedSearchService) suggestProducts(w http.ResponseWriter, r *http.Request) {
	s.suggest(w, r, IndexProducts, []string{"product_name", "product_code"})
}

func (s *UnifiedSearchService) suggest(w http.ResponseWriter, r *http.Request, index string, fields []string) {
	query := r.URL.Query().Get("q")
	tenantID := r.URL.Query().Get("tenant_id")
	limit := 10

	if query == "" {
		http.Error(w, "Query parameter 'q' is required", http.StatusBadRequest)
		return
	}

	// Build prefix query
	osQuery := map[string]interface{}{
		"size": limit,
		"query": map[string]interface{}{
			"bool": map[string]interface{}{
				"must": []interface{}{
					map[string]interface{}{
						"multi_match": map[string]interface{}{
							"query":  query,
							"type":   "phrase_prefix",
							"fields": fields,
						},
					},
				},
				"filter": []interface{}{
					map[string]interface{}{
						"term": map[string]string{"tenant_id": tenantID},
					},
				},
			},
		},
		"_source": fields,
	}

	body, _ := json.Marshal(osQuery)

	req, _ := http.NewRequest("POST", fmt.Sprintf("%s/%s/_search", s.opensearchURL, index), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	var osResp struct {
		Hits struct {
			Hits []struct {
				Source map[string]interface{} `json:"_source"`
			} `json:"hits"`
		} `json:"hits"`
	}
	json.NewDecoder(resp.Body).Decode(&osResp)

	var suggestions []map[string]interface{}
	for _, hit := range osResp.Hits.Hits {
		suggestions = append(suggestions, hit.Source)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"suggestions": suggestions,
	})
}

// Indexing handlers
func (s *UnifiedSearchService) indexDocument(w http.ResponseWriter, r *http.Request) {
	var req IndexRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.ID == "" {
		req.ID = uuid.New().String()
	}

	// Add tenant_id to document
	req.Document["tenant_id"] = req.TenantID

	// Queue for async indexing
	select {
	case s.indexQueue <- &req:
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "queued", "id": req.ID})
	default:
		// Queue full, index synchronously
		if err := s.indexSync(r.Context(), &req); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "indexed", "id": req.ID})
	}
}

func (s *UnifiedSearchService) bulkIndex(w http.ResponseWriter, r *http.Request) {
	var requests []IndexRequest
	if err := json.NewDecoder(r.Body).Decode(&requests); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Build bulk request
	var bulkBody bytes.Buffer
	for _, req := range requests {
		if req.ID == "" {
			req.ID = uuid.New().String()
		}
		req.Document["tenant_id"] = req.TenantID

		action := map[string]interface{}{
			"index": map[string]string{
				"_index": req.Index,
				"_id":    req.ID,
			},
		}
		actionJSON, _ := json.Marshal(action)
		docJSON, _ := json.Marshal(req.Document)

		bulkBody.Write(actionJSON)
		bulkBody.WriteString("\n")
		bulkBody.Write(docJSON)
		bulkBody.WriteString("\n")
	}

	httpReq, _ := http.NewRequest("POST", fmt.Sprintf("%s/_bulk", s.opensearchURL), &bulkBody)
	httpReq.Header.Set("Content-Type", "application/x-ndjson")

	resp, err := s.client.Do(httpReq)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	indexOperations.WithLabelValues("bulk", "index", "success").Add(float64(len(requests)))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "indexed",
		"count":  len(requests),
	})
}

func (s *UnifiedSearchService) deleteDocument(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	index := vars["index"]
	id := vars["id"]

	req, _ := http.NewRequest("DELETE", fmt.Sprintf("%s/%s/_doc/%s", s.opensearchURL, index, id), nil)
	resp, err := s.client.Do(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	indexOperations.WithLabelValues(index, "delete", "success").Inc()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}

// indexSync indexes a document synchronously
func (s *UnifiedSearchService) indexSync(ctx context.Context, req *IndexRequest) error {
	body, _ := json.Marshal(req.Document)

	httpReq, err := http.NewRequestWithContext(ctx, "PUT",
		fmt.Sprintf("%s/%s/_doc/%s", s.opensearchURL, req.Index, req.ID),
		bytes.NewReader(body))
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("indexing error: %s", string(bodyBytes))
	}

	indexOperations.WithLabelValues(req.Index, "index", "success").Inc()
	return nil
}

// backgroundIndexer processes queued index requests
func (s *UnifiedSearchService) backgroundIndexer() {
	defer s.wg.Done()

	batch := make([]*IndexRequest, 0, 100)
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			if len(batch) > 0 {
				s.flushBatch(batch)
			}
			return
		case req, ok := <-s.indexQueue:
			if !ok {
				if len(batch) > 0 {
					s.flushBatch(batch)
				}
				return
			}
			batch = append(batch, req)
			if len(batch) >= 100 {
				s.flushBatch(batch)
				batch = make([]*IndexRequest, 0, 100)
			}
		case <-ticker.C:
			if len(batch) > 0 {
				s.flushBatch(batch)
				batch = make([]*IndexRequest, 0, 100)
			}
		}
	}
}

// flushBatch indexes a batch of documents
func (s *UnifiedSearchService) flushBatch(batch []*IndexRequest) {
	if len(batch) == 0 {
		return
	}

	var bulkBody bytes.Buffer
	for _, req := range batch {
		action := map[string]interface{}{
			"index": map[string]string{
				"_index": req.Index,
				"_id":    req.ID,
			},
		}
		actionJSON, _ := json.Marshal(action)
		docJSON, _ := json.Marshal(req.Document)

		bulkBody.Write(actionJSON)
		bulkBody.WriteString("\n")
		bulkBody.Write(docJSON)
		bulkBody.WriteString("\n")
	}

	req, _ := http.NewRequest("POST", fmt.Sprintf("%s/_bulk", s.opensearchURL), &bulkBody)
	req.Header.Set("Content-Type", "application/x-ndjson")

	resp, err := s.client.Do(req)
	if err != nil {
		fmt.Printf("Bulk indexing error: %v\n", err)
		return
	}
	defer resp.Body.Close()

	fmt.Printf("Indexed %d documents\n", len(batch))
}

// Admin handlers
func (s *UnifiedSearchService) reindexIndex(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	index := vars["index"]
	if !isSupportedIndex(index) {
		http.Error(w, fmt.Sprintf("unsupported index: %s", index), http.StatusBadRequest)
		return
	}

	startedAt := time.Now()
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Minute)
	defer cancel()

	definition, err := s.fetchIndexDefinition(ctx, index)
	if err != nil {
		indexOperations.WithLabelValues(index, "reindex", "failed").Inc()
		http.Error(w, fmt.Sprintf("failed to fetch index definition: %v", err), http.StatusBadGateway)
		return
	}

	tempIndex := fmt.Sprintf("%s_rebuild_%d", index, time.Now().Unix())
	if err := s.deleteIndexIfExists(ctx, tempIndex); err != nil {
		indexOperations.WithLabelValues(index, "reindex", "failed").Inc()
		http.Error(w, fmt.Sprintf("failed to clean temporary index: %v", err), http.StatusBadGateway)
		return
	}

	if err := s.createIndex(ctx, tempIndex, definition); err != nil {
		indexOperations.WithLabelValues(index, "reindex", "failed").Inc()
		http.Error(w, fmt.Sprintf("failed to create temporary index: %v", err), http.StatusBadGateway)
		return
	}

	copyToTemp, err := s.executeReindex(ctx, index, tempIndex)
	if err != nil {
		_ = s.deleteIndexIfExists(ctx, tempIndex)
		indexOperations.WithLabelValues(index, "reindex", "failed").Inc()
		http.Error(w, fmt.Sprintf("failed to copy source index to temporary index: %v", err), http.StatusBadGateway)
		return
	}

	if err := s.refreshIndex(ctx, tempIndex); err != nil {
		_ = s.deleteIndexIfExists(ctx, tempIndex)
		indexOperations.WithLabelValues(index, "reindex", "failed").Inc()
		http.Error(w, fmt.Sprintf("failed to refresh temporary index: %v", err), http.StatusBadGateway)
		return
	}

	if err := s.deleteIndex(ctx, index); err != nil {
		indexOperations.WithLabelValues(index, "reindex", "failed").Inc()
		http.Error(w, fmt.Sprintf("failed to replace source index: %v", err), http.StatusBadGateway)
		return
	}

	if err := s.createIndex(ctx, index, definition); err != nil {
		indexOperations.WithLabelValues(index, "reindex", "failed").Inc()
		http.Error(w, fmt.Sprintf("failed to recreate source index: %v (temporary copy retained at %s)", err, tempIndex), http.StatusBadGateway)
		return
	}

	restoreResult, err := s.executeReindex(ctx, tempIndex, index)
	if err != nil {
		indexOperations.WithLabelValues(index, "reindex", "failed").Inc()
		http.Error(w, fmt.Sprintf("failed to restore rebuilt data to source index: %v (temporary copy retained at %s)", err, tempIndex), http.StatusBadGateway)
		return
	}

	if err := s.refreshIndex(ctx, index); err != nil {
		indexOperations.WithLabelValues(index, "reindex", "failed").Inc()
		http.Error(w, fmt.Sprintf("failed to refresh rebuilt index: %v", err), http.StatusBadGateway)
		return
	}

	if err := s.deleteIndexIfExists(ctx, tempIndex); err != nil {
		indexOperations.WithLabelValues(index, "reindex", "failed").Inc()
		http.Error(w, fmt.Sprintf("reindex completed but cleanup failed for temporary index %s: %v", tempIndex, err), http.StatusBadGateway)
		return
	}

	indexOperations.WithLabelValues(index, "reindex", "success").Inc()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":              "completed",
		"index":               index,
		"temporary_index":     tempIndex,
		"copied_to_temporary": copyToTemp.Created,
		"restored_to_source":  restoreResult.Created,
		"source_total":        restoreResult.Total,
		"failures":            restoreResult.Failures,
		"took_ms":             time.Since(startedAt).Milliseconds(),
		"message":             "Reindex completed successfully using a temporary rebuild index",
	})
}

type reindexExecutionResult struct {
	Created  int64                    `json:"created"`
	Updated  int64                    `json:"updated"`
	Total    int64                    `json:"total"`
	Failures []map[string]interface{} `json:"failures,omitempty"`
}

func isSupportedIndex(index string) bool {
	switch index {
	case IndexCustomers,
		IndexAccounts,
		IndexTransactions,
		IndexLoans,
		IndexDisputes,
		IndexDocuments,
		IndexEmployees,
		IndexProducts,
		IndexNotifications,
		IndexTradeFinance:
		return true
	default:
		return false
	}
}

func (s *UnifiedSearchService) fetchIndexDefinition(ctx context.Context, index string) (map[string]interface{}, error) {
	body, statusCode, err := s.doOpenSearchRequest(ctx, http.MethodGet, fmt.Sprintf("/%s", index), nil)
	if err != nil {
		return nil, err
	}
	if statusCode >= 300 {
		return nil, fmt.Errorf("opensearch returned status %d: %s", statusCode, string(body))
	}

	var payload map[string]map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}

	indexPayload, ok := payload[index]
	if !ok {
		return nil, fmt.Errorf("index definition missing for %s", index)
	}

	settings, _ := indexPayload["settings"].(map[string]interface{})
	mappings, _ := indexPayload["mappings"].(map[string]interface{})
	aliases, _ := indexPayload["aliases"].(map[string]interface{})

	definition := map[string]interface{}{}
	if len(settings) > 0 {
		definition["settings"] = sanitizeIndexSettings(settings)
	}
	if len(mappings) > 0 {
		definition["mappings"] = mappings
	}
	if len(aliases) > 0 {
		definition["aliases"] = aliases
	}

	return definition, nil
}

func sanitizeIndexSettings(settings map[string]interface{}) map[string]interface{} {
	indexSettings, ok := settings["index"].(map[string]interface{})
	if !ok {
		return settings
	}

	sanitizedIndexSettings := map[string]interface{}{}
	for key, value := range indexSettings {
		switch key {
		case "provided_name", "uuid", "version", "creation_date", "creation_date_string", "routing", "resize", "history_uuid":
			continue
		default:
			sanitizedIndexSettings[key] = value
		}
	}

	return map[string]interface{}{"index": sanitizedIndexSettings}
}

func (s *UnifiedSearchService) deleteIndex(ctx context.Context, index string) error {
	body, statusCode, err := s.doOpenSearchRequest(ctx, http.MethodDelete, fmt.Sprintf("/%s", index), nil)
	if err != nil {
		return err
	}
	if statusCode >= 300 {
		return fmt.Errorf("status %d: %s", statusCode, string(body))
	}
	return nil
}

func (s *UnifiedSearchService) deleteIndexIfExists(ctx context.Context, index string) error {
	body, statusCode, err := s.doOpenSearchRequest(ctx, http.MethodDelete, fmt.Sprintf("/%s", index), nil)
	if err != nil {
		return err
	}
	if statusCode == http.StatusNotFound {
		return nil
	}
	if statusCode >= 300 {
		return fmt.Errorf("status %d: %s", statusCode, string(body))
	}
	return nil
}

func (s *UnifiedSearchService) refreshIndex(ctx context.Context, index string) error {
	body, statusCode, err := s.doOpenSearchRequest(ctx, http.MethodPost, fmt.Sprintf("/%s/_refresh", index), nil)
	if err != nil {
		return err
	}
	if statusCode >= 300 {
		return fmt.Errorf("status %d: %s", statusCode, string(body))
	}
	return nil
}

func (s *UnifiedSearchService) executeReindex(ctx context.Context, sourceIndex, destIndex string) (*reindexExecutionResult, error) {
	payload := map[string]interface{}{
		"source": map[string]interface{}{
			"index": sourceIndex,
		},
		"dest": map[string]interface{}{
			"index": destIndex,
		},
		"conflicts": "proceed",
	}

	body, statusCode, err := s.doOpenSearchRequest(ctx, http.MethodPost, "/_reindex?wait_for_completion=true&refresh=true", payload)
	if err != nil {
		return nil, err
	}
	if statusCode >= 300 {
		return nil, fmt.Errorf("status %d: %s", statusCode, string(body))
	}

	var result reindexExecutionResult
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	if len(result.Failures) > 0 {
		return &result, fmt.Errorf("opensearch reported %d reindex failures", len(result.Failures))
	}
	return &result, nil
}

func (s *UnifiedSearchService) doOpenSearchRequest(ctx context.Context, method, path string, payload interface{}) ([]byte, int, error) {
	var bodyReader io.Reader
	if payload != nil {
		payloadBytes, err := json.Marshal(payload)
		if err != nil {
			return nil, 0, err
		}
		bodyReader = bytes.NewReader(payloadBytes)
	}

	request, err := http.NewRequestWithContext(ctx, method, fmt.Sprintf("%s%s", s.opensearchURL, path), bodyReader)
	if err != nil {
		return nil, 0, err
	}
	if payload != nil {
		request.Header.Set("Content-Type", "application/json")
	}

	response, err := s.client.Do(request)
	if err != nil {
		return nil, 0, err
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, 0, err
	}

	return responseBody, response.StatusCode, nil
}

func (s *UnifiedSearchService) getStats(w http.ResponseWriter, r *http.Request) {
	req, _ := http.NewRequest("GET", fmt.Sprintf("%s/_stats", s.opensearchURL), nil)
	resp, err := s.client.Do(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	var stats map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&stats)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// Stop gracefully stops the service
func (s *UnifiedSearchService) Stop() {
	s.cancel()
	close(s.indexQueue)
	s.wg.Wait()
}

// Helper function
func getEnvOrDefault(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

// Global instance
var GlobalSearchService *UnifiedSearchService

// InitSearchService initializes the global search service
func InitSearchService() {
	GlobalSearchService = NewUnifiedSearchService()
}
