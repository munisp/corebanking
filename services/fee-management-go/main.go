package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	_ "github.com/lib/pq"
)

// ── Model ─────────────────────────────────────────────────────────────────────

type FeeRule struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	FeeType       string  `json:"fee_type"`
	Amount        *float64 `json:"amount,omitempty"`
	Rate          *float64 `json:"rate,omitempty"`
	ProductCode   *string  `json:"product_code,omitempty"`
	Service       *string  `json:"service,omitempty"`
	Currency      string  `json:"currency"`
	Status        string  `json:"status"`
	EffectiveFrom *string `json:"effective_from,omitempty"`
	CreatedAt     string  `json:"created_at"`
}

// ── Storage ───────────────────────────────────────────────────────────────────

type Store interface {
	List() ([]FeeRule, error)
	Create(r *FeeRule) error
	Update(id string, r *FeeRule) (*FeeRule, error)
}

// In-memory fallback

type memStore struct {
	mu    sync.RWMutex
	rules []FeeRule
}

func newMemStore() *memStore { return &memStore{} }

func (s *memStore) List() ([]FeeRule, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]FeeRule, len(s.rules))
	copy(out, s.rules)
	return out, nil
}

func (s *memStore) Create(r *FeeRule) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.rules = append(s.rules, *r)
	return nil
}

func (s *memStore) Update(id string, patch *FeeRule) (*FeeRule, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, r := range s.rules {
		if r.ID == id {
			patch.ID = id
			patch.CreatedAt = r.CreatedAt
			s.rules[i] = *patch
			return &s.rules[i], nil
		}
	}
	return nil, fmt.Errorf("not found")
}

// PostgreSQL store

type pgStore struct{ db *sql.DB }

func newPGStore(dsn string) (*pgStore, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		return nil, err
	}
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS fee_rules (
		id            TEXT PRIMARY KEY,
		name          TEXT NOT NULL,
		fee_type      TEXT NOT NULL,
		amount        DOUBLE PRECISION,
		rate          DOUBLE PRECISION,
		product_code  TEXT,
		service       TEXT,
		currency      TEXT NOT NULL DEFAULT 'NGN',
		status        TEXT NOT NULL DEFAULT 'active',
		effective_from TEXT,
		created_at    TEXT NOT NULL
	)`)
	if err != nil {
		return nil, err
	}
	return &pgStore{db: db}, nil
}

func (s *pgStore) List() ([]FeeRule, error) {
	rows, err := s.db.Query(`SELECT id,name,fee_type,amount,rate,product_code,service,currency,status,effective_from,created_at FROM fee_rules ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []FeeRule
	for rows.Next() {
		var r FeeRule
		if err := rows.Scan(&r.ID, &r.Name, &r.FeeType, &r.Amount, &r.Rate, &r.ProductCode, &r.Service, &r.Currency, &r.Status, &r.EffectiveFrom, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	if out == nil {
		out = []FeeRule{}
	}
	return out, rows.Err()
}

func (s *pgStore) Create(r *FeeRule) error {
	_, err := s.db.Exec(`INSERT INTO fee_rules(id,name,fee_type,amount,rate,product_code,service,currency,status,effective_from,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		r.ID, r.Name, r.FeeType, r.Amount, r.Rate, r.ProductCode, r.Service, r.Currency, r.Status, r.EffectiveFrom, r.CreatedAt)
	return err
}

func (s *pgStore) Update(id string, patch *FeeRule) (*FeeRule, error) {
	var createdAt string
	err := s.db.QueryRow(`SELECT created_at FROM fee_rules WHERE id=$1`, id).Scan(&createdAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("not found")
	}
	if err != nil {
		return nil, err
	}
	patch.ID = id
	patch.CreatedAt = createdAt
	_, err = s.db.Exec(`UPDATE fee_rules SET name=$2,fee_type=$3,amount=$4,rate=$5,product_code=$6,service=$7,currency=$8,status=$9,effective_from=$10 WHERE id=$1`,
		id, patch.Name, patch.FeeType, patch.Amount, patch.Rate, patch.ProductCode, patch.Service, patch.Currency, patch.Status, patch.EffectiveFrom)
	if err != nil {
		return nil, err
	}
	return patch, nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func newUUID() string {
	b := make([]byte, 16)
	rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func pathID(path, prefix string) string {
	if !strings.HasPrefix(path, prefix) {
		return ""
	}
	return strings.TrimPrefix(path, prefix)
}

// ── Handlers ──────────────────────────────────────────────────────────────────

func handleRules(store Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "*")
		w.Header().Set("Access-Control-Allow-Headers", "*")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		// /v1/fee-rules/{id}
		if id := pathID(r.URL.Path, "/v1/fee-rules/"); id != "" {
			if r.Method != http.MethodPut && r.Method != http.MethodPatch {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			var patch FeeRule
			if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
				writeErr(w, http.StatusBadRequest, "invalid JSON")
				return
			}
			updated, err := store.Update(id, &patch)
			if err != nil {
				if err.Error() == "not found" {
					writeErr(w, http.StatusNotFound, "fee rule not found")
				} else {
					writeErr(w, http.StatusInternalServerError, err.Error())
				}
				return
			}
			writeJSON(w, http.StatusOK, updated)
			return
		}

		// /v1/fee-rules
		switch r.Method {
		case http.MethodGet:
			rules, err := store.List()
			if err != nil {
				writeErr(w, http.StatusInternalServerError, err.Error())
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"items": rules, "total": len(rules)})

		case http.MethodPost:
			var rule FeeRule
			if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
				writeErr(w, http.StatusBadRequest, "invalid JSON")
				return
			}
			if rule.Name == "" {
				writeErr(w, http.StatusBadRequest, "name is required")
				return
			}
			if rule.FeeType == "" {
				writeErr(w, http.StatusBadRequest, "fee_type is required")
				return
			}
			if rule.Currency == "" {
				rule.Currency = "NGN"
			}
			if rule.Status == "" {
				rule.Status = "active"
			}
			rule.ID = newUUID()
			rule.CreatedAt = time.Now().UTC().Format(time.RFC3339)
			if err := store.Create(&rule); err != nil {
				writeErr(w, http.StatusInternalServerError, err.Error())
				return
			}
			writeJSON(w, http.StatusCreated, rule)

		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

// ── Main ──────────────────────────────────────────────────────────────────────

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	var store Store
	if dsn := os.Getenv("DATABASE_URL"); dsn != "" {
		pg, err := newPGStore(dsn)
		if err != nil {
			log.Printf("[fee-management-go] postgres unavailable (%v) — using in-memory store", err)
			store = newMemStore()
		} else {
			log.Printf("[fee-management-go] connected to postgres")
			store = pg
		}
	} else {
		log.Printf("[fee-management-go] no DATABASE_URL — using in-memory store")
		store = newMemStore()
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "fee-management-go"})
	})

	rulesHandler := handleRules(store)
	mux.HandleFunc("/v1/fee-rules/", rulesHandler)
	mux.HandleFunc("/v1/fee-rules", rulesHandler)

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"service":"fee-management-go","status":"running"}`)
	})

	log.Printf("[fee-management-go] listening on :%s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
