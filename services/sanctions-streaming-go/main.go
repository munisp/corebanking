package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
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

var serviceName = "sanctions-streaming-go"

type SanctionEntry struct {
	ListSource  string   `json:"list_source"` // OFAC, EU, UN, UK, NFIU
	EntityName  string   `json:"entity_name"`
	EntityType  string   `json:"entity_type"` // individual, entity, vessel, aircraft
	Aliases     []string `json:"aliases"`
	DateOfBirth string   `json:"date_of_birth,omitempty"`
	Nationality string   `json:"nationality,omitempty"`
	Programs    []string `json:"programs"`
	AddedDate   string   `json:"added_date"`
}

type ScreenResult struct {
	ScreenID   string  `json:"screen_id"`
	QueryName  string  `json:"query_name"`
	MatchScore float64 `json:"match_score"`
	Matched    bool    `json:"matched"`
	Matches    []struct {
		Entry      SanctionEntry `json:"entry"`
		Score      float64       `json:"score"`
		MatchType  string        `json:"match_type"` // exact, fuzzy, alias, partial
	} `json:"matches"`
	ScreenedAt time.Time `json:"screened_at"`
	ListsChecked []string `json:"lists_checked"`
}

type App struct {
	mu         sync.RWMutex
	sanctions  []SanctionEntry
	screenLogs []ScreenResult
}

var app = &App{
	sanctions:  make([]SanctionEntry, 0),
	screenLogs: make([]ScreenResult, 0),
}

func init() {
	// Seed sample sanctions entries
	app.sanctions = []SanctionEntry{
		{ListSource: "OFAC", EntityName: "AL-QAIDA", EntityType: "entity", Programs: []string{"SDGT"}, AddedDate: "2001-10-12"},
		{ListSource: "UN", EntityName: "BOKO HARAM", EntityType: "entity", Programs: []string{"UN_1267"}, AddedDate: "2014-05-22"},
		{ListSource: "NFIU", EntityName: "SUSPECT COMPANY LTD", EntityType: "entity", Programs: []string{"NFIU_TF"}, AddedDate: "2025-03-15"},
		{ListSource: "EU", EntityName: "SANCTIONED BANK PLC", EntityType: "entity", Programs: []string{"EU_SANCTIONS"}, AddedDate: "2024-01-01"},
	}
}

func fuzzyMatch(query, target string) float64 {
	q := strings.ToLower(strings.TrimSpace(query))
	t := strings.ToLower(strings.TrimSpace(target))
	if q == t { return 1.0 }
	if strings.Contains(t, q) || strings.Contains(q, t) { return 0.85 }
	// Simple Jaccard similarity on words
	qWords := strings.Fields(q)
	tWords := strings.Fields(t)
	if len(qWords) == 0 || len(tWords) == 0 { return 0 }
	intersection := 0
	for _, qw := range qWords {
		for _, tw := range tWords {
			if qw == tw { intersection++; break }
		}
	}
	union := len(qWords) + len(tWords) - intersection
	if union == 0 { return 0 }
	return float64(intersection) / float64(union)
}

func screenHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string   `json:"name"`
		DateOfBirth string   `json:"date_of_birth,omitempty"`
		Nationality string   `json:"nationality,omitempty"`
		Lists       []string `json:"lists,omitempty"` // which lists to check
		Threshold   float64  `json:"threshold,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}
	threshold := req.Threshold
	if threshold == 0 { threshold = 0.80 }
	lists := req.Lists
	if len(lists) == 0 { lists = []string{"OFAC", "EU", "UN", "UK", "NFIU"} }

	app.mu.RLock()
	var matches []struct {
		Entry     SanctionEntry `json:"entry"`
		Score     float64       `json:"score"`
		MatchType string        `json:"match_type"`
	}
	for _, entry := range app.sanctions {
		listMatch := false
		for _, l := range lists { if l == entry.ListSource { listMatch = true; break } }
		if !listMatch { continue }
		
		score := fuzzyMatch(req.Name, entry.EntityName)
		matchType := "none"
		if score >= 1.0 { matchType = "exact" } else if score >= 0.85 { matchType = "fuzzy" } else if score >= threshold { matchType = "partial" }
		
		// Also check aliases
		for _, alias := range entry.Aliases {
			aliasScore := fuzzyMatch(req.Name, alias)
			if aliasScore > score { score = aliasScore; matchType = "alias" }
		}
		
		if score >= threshold {
			matches = append(matches, struct {
				Entry     SanctionEntry `json:"entry"`
				Score     float64       `json:"score"`
				MatchType string        `json:"match_type"`
			}{entry, score, matchType})
		}
	}
	app.mu.RUnlock()

	result := ScreenResult{
		ScreenID:     fmt.Sprintf("SCR-%d", time.Now().UnixNano()),
		QueryName:    req.Name,
		MatchScore:   0,
		Matched:      len(matches) > 0,
		ScreenedAt:   time.Now(),
		ListsChecked: lists,
	}
	if len(matches) > 0 {
		result.MatchScore = matches[0].Score
	}
	
	app.mu.Lock()
	app.screenLogs = append(app.screenLogs, result)
	app.mu.Unlock()

	status := 200
	if len(matches) > 0 { status = 200 } // return 200 but with matched=true

	respondJSON(w, status, map[string]interface{}{
		"screen_id": result.ScreenID, "matched": result.Matched,
		"match_count": len(matches), "highest_score": result.MatchScore,
		"matches": matches, "lists_checked": lists,
		"action": func() string { if result.Matched { return "BLOCK_AND_ESCALATE" }; return "ALLOW" }(),
	})
}

func healthz(w http.ResponseWriter, r *http.Request) {
	app.mu.RLock()
	defer app.mu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"status": "healthy", "service": serviceName, "version": "1.0.0",
		"sanctions_entries": len(app.sanctions), "lists": []string{"OFAC", "EU", "UN", "UK", "NFIU"},
	})
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(code); json.NewEncoder(w).Encode(data)
}

func main() {
	port := os.Getenv("PORT"); if port == "" { port = "9048" }
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/api/v1/sanctions/screen", screenHandler)
	srv := &http.Server{Addr: ":" + port, Handler: mux}
	go func() { log.Printf("[%s] Starting on :%s", serviceName, port); if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed { log.Fatalf("[%s] error: %v", serviceName, err) } }()
	quit := make(chan os.Signal, 1); signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM); <-quit
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second); defer cancel(); srv.Shutdown(ctx)
	_ = context.Background; _ = net.Dial; _ = strings.NewReader; _ = atomic.AddInt64; _ = sync.Once{}
}
func init() { _ = sql.Drivers }
