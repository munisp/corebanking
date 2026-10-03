package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

// group-lending-go — W13-RISK-11: this service was a health-only stub; a
// money-path service name with zero endpoints and zero persistence. It now
// implements the wave-12 canonical service_records store (PG-authoritative,
// ensured idempotently at boot) for its declared domain (lending groups and
// member contributions). Fail-closed: with no DATABASE_URL, mutating
// endpoints return 503 — nothing is ever stored in volatile memory.

var db *sql.DB

const serviceName = "group-lending-go"

func main() {
	initDB()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	http.HandleFunc("/healthz", healthHandler)
	http.HandleFunc("/v1/group-lending/groups", groupsHandler)
	http.HandleFunc("/v1/group-lending/groups/", groupByIDHandler)
	http.HandleFunc("/v1/group-lending/contributions", contributionsHandler)
	http.HandleFunc("/", rootHandler)

	log.Printf("[%s] listening on :%s", serviceName, port)
	if err := (&http.Server{Addr: ":" + port, Handler: nil, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}).ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}

// --- Database layer (canonical W12 service_records idiom) ---

// ensureRecordsSchema creates the PG-authoritative record/audit stores
// (canonical W12 idiom). Idempotent.
func ensureRecordsSchema() {
	if db == nil {
		return
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS service_records (
		id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
		status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
		created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
		created_by TEXT DEFAULT '', tenant_id TEXT DEFAULT ''
	)`); err != nil {
		log.Printf("[%s] service_records schema init failed: %v", serviceName, err)
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS audit_log (
		id TEXT PRIMARY KEY, service TEXT NOT NULL, action TEXT NOT NULL,
		record_id TEXT DEFAULT '', actor TEXT DEFAULT '', timestamp TEXT DEFAULT '',
		details TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW()
	)`); err != nil {
		log.Printf("[%s] audit_log schema init failed: %v", serviceName, err)
	}
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_service_records_svc_type ON service_records(service, type, created_at DESC)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_svc_created ON audit_log(service, created_at DESC)`)
}

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[%s] DATABASE_URL not set — mutating endpoints will fail closed (503)", serviceName)
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[%s] DB open failed: %v — failing closed", serviceName, err)
		db = nil
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[%s] DB ping failed: %v — failing closed", serviceName, err)
		db = nil
		return
	}
	ensureRecordsSchema()
	log.Printf("[%s] connected to postgres (service_records store)", serviceName)
}

func newID(prefix string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(b))
}

func respondJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func respondError(w http.ResponseWriter, status int, msg string) {
	respondJSON(w, status, map[string]string{"error": msg})
}

// requireDB fails closed: money-path writes must never be accepted without
// durable persistence.
func requireDB(w http.ResponseWriter) bool {
	if db == nil {
		respondError(w, http.StatusServiceUnavailable, "persistence unavailable: DATABASE_URL not configured")
		return false
	}
	return true
}

func insertRecord(id, typ, status string, data interface{}, tenantID, createdBy string) error {
	dataBytes, err := json.Marshal(data)
	if err != nil {
		return err
	}
	_, err = db.Exec(
		"INSERT INTO service_records (id, service, type, status, data, tenant_id, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)",
		id, serviceName, typ, status, string(dataBytes), tenantID, createdBy)
	if err != nil {
		return err
	}
	_, _ = db.Exec(
		"INSERT INTO audit_log (id, service, action, record_id, actor, timestamp, details) VALUES ($1,$2,$3,$4,$5,$6,$7)",
		newID("aud"), serviceName, "create", id, createdBy, time.Now().UTC().Format(time.RFC3339), typ)
	return nil
}

type record struct {
	ID        string          `json:"id"`
	Service   string          `json:"service"`
	Type      string          `json:"type"`
	Status    string          `json:"status"`
	Data      json.RawMessage `json:"data"`
	CreatedAt time.Time       `json:"created_at"`
}

func listRecords(typ, tenantID string) ([]record, error) {
	query := "SELECT id, service, type, status, data, created_at FROM service_records WHERE service = $1 AND type = $2"
	args := []interface{}{serviceName, typ}
	if tenantID != "" {
		query += " AND tenant_id = $3"
		args = append(args, tenantID)
	}
	query += " ORDER BY created_at DESC LIMIT 100"
	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]record, 0)
	for rows.Next() {
		var r record
		if err := rows.Scan(&r.ID, &r.Service, &r.Type, &r.Status, &r.Data, &r.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

func getRecord(id string) (*record, error) {
	var r record
	err := db.QueryRow(
		"SELECT id, service, type, status, data, created_at FROM service_records WHERE id = $1 AND service = $2",
		id, serviceName).Scan(&r.ID, &r.Service, &r.Type, &r.Status, &r.Data, &r.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// --- Domain handlers ---

// groupsHandler: POST creates a lending group; GET lists groups.
func groupsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		if !requireDB(w) {
			return
		}
		var body map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			respondError(w, http.StatusBadRequest, "invalid body")
			return
		}
		name, _ := body["name"].(string)
		if name == "" {
			respondError(w, http.StatusBadRequest, "name is required")
			return
		}
		id := newID("grp")
		tenantID := r.Header.Get("X-Tenant-ID")
		createdBy := r.Header.Get("X-Keycloak-ID")
		if err := insertRecord(id, "lending_group", "active", body, tenantID, createdBy); err != nil {
			respondError(w, http.StatusInternalServerError, fmt.Sprintf("create failed: %v", err))
			return
		}
		body["id"] = id
		body["status"] = "active"
		respondJSON(w, http.StatusCreated, body)
	case http.MethodGet:
		if !requireDB(w) {
			return
		}
		items, err := listRecords("lending_group", r.Header.Get("X-Tenant-ID"))
		if err != nil {
			respondError(w, http.StatusInternalServerError, fmt.Sprintf("list failed: %v", err))
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": len(items)})
	default:
		respondError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

// groupByIDHandler: GET one lending group by id.
func groupByIDHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if !requireDB(w) {
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/v1/group-lending/groups/")
	if id == "" || strings.Contains(id, "/") {
		respondError(w, http.StatusBadRequest, "invalid group id")
		return
	}
	rec, err := getRecord(id)
	if err == sql.ErrNoRows {
		respondError(w, http.StatusNotFound, "group not found")
		return
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("get failed: %v", err))
		return
	}
	respondJSON(w, http.StatusOK, rec)
}

// contributionsHandler: POST records a member contribution (money path —
// persisted durably before success is returned); GET lists contributions.
func contributionsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		if !requireDB(w) {
			return
		}
		var body map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			respondError(w, http.StatusBadRequest, "invalid body")
			return
		}
		groupID, _ := body["group_id"].(string)
		memberID, _ := body["member_id"].(string)
		amountKobo, _ := body["amount_kobo"].(float64)
		if groupID == "" || memberID == "" || amountKobo <= 0 {
			respondError(w, http.StatusBadRequest, "group_id, member_id and positive amount_kobo are required")
			return
		}
		id := newID("ctb")
		tenantID := r.Header.Get("X-Tenant-ID")
		createdBy := r.Header.Get("X-Keycloak-ID")
		if err := insertRecord(id, "contribution", "recorded", body, tenantID, createdBy); err != nil {
			respondError(w, http.StatusInternalServerError, fmt.Sprintf("create failed: %v", err))
			return
		}
		body["id"] = id
		body["status"] = "recorded"
		respondJSON(w, http.StatusCreated, body)
	case http.MethodGet:
		if !requireDB(w) {
			return
		}
		items, err := listRecords("contribution", r.Header.Get("X-Tenant-ID"))
		if err != nil {
			respondError(w, http.StatusInternalServerError, fmt.Sprintf("list failed: %v", err))
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": len(items)})
	default:
		respondError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

// healthHandler serves /healthz.
func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": serviceName})
}

// rootHandler serves / and 404s unknown paths.
func rootHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"service":"%s","status":"running"}`, serviceName)
}
