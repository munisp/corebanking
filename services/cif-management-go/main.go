package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

var port = getEnv("PORT", "8222")

var middlewareConfig = map[string]interface{}{
	"kafka":       map[string]string{"broker": getEnv("KAFKA_BROKER", "localhost:9092"), "topics": "cif.created,cif.updated,cif.address-verified,cif.kyc-refreshed"},
	"redis":       map[string]string{"url": getEnv("REDIS_URL", "redis://localhost:6379"), "purpose": "cif-cache,address-geocode-cache"},
	"postgres":    map[string]string{"url": getEnv("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "customers,addresses,contacts,relationships,kyc_documents"},
	"opensearch":  map[string]string{"url": getEnv("OPENSEARCH_URL", "http://localhost:9200"), "index": "customer-search"},
	"keycloak":    map[string]string{"url": getEnv("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "role": "customer-service,kyc-officer"},
	"permify":     map[string]string{"url": getEnv("PERMIFY_URL", "http://localhost:3476"), "schema": "cif:create,cif:update,cif:view-pii,cif:merge"},
	"dapr":        map[string]string{"url": getEnv("DAPR_URL", "http://localhost:3500"), "pubsub": "cif-events"},
	"fluvio":      map[string]string{"url": getEnv("FLUVIO_URL", "localhost:9003"), "topic": "cif-changes"},
	"temporal":    map[string]string{"url": getEnv("TEMPORAL_URL", "localhost:7233"), "workflow": "CIFMergeWorkflow,KYCRefreshWorkflow"},
	"mojaloop":    map[string]string{"url": getEnv("MOJALOOP_URL", "http://localhost:4000"), "purpose": "customer-lookup"},
	"tigerbeetle": map[string]string{"url": getEnv("TIGERBEETLE_URL", "localhost:3000"), "purpose": "customer-account-linkage"},
	"lakehouse":   map[string]string{"url": getEnv("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "customer_360_analytics"},
	"apisix":      map[string]string{"url": getEnv("APISIX_URL", "http://localhost:9080"), "route": "/cif/*"},
	"openappsec":  map[string]string{"url": getEnv("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "pii-protection"},
}

type CIF struct {
	ID            string         `json:"id"`
	BVN           string         `json:"bvn"`
	FirstName     string         `json:"firstName"`
	LastName      string         `json:"lastName"`
	Email         string         `json:"email"`
	Phone         string         `json:"phone"`
	DOB           string         `json:"dateOfBirth"`
	Gender        string         `json:"gender"`
	KYCTier       int            `json:"kycTier"`
	Status        string         `json:"status"`
	Addresses     []Address      `json:"addresses"`
	Contacts      []Contact      `json:"contacts"`
	Relationships []Relationship `json:"relationships"`
	Documents     []KYCDoc       `json:"kycDocuments"`
	Accounts      int            `json:"accountCount"`
	TotalBalance  float64        `json:"totalBalance"`
}

type Address struct {
	Type     string `json:"type"`
	Line1    string `json:"line1"`
	Line2    string `json:"line2"`
	City     string `json:"city"`
	State    string `json:"state"`
	Country  string `json:"country"`
	PostCode string `json:"postCode"`
	Verified bool   `json:"verified"`
	Primary  bool   `json:"isPrimary"`
}

type Contact struct {
	Type     string `json:"type"`
	Value    string `json:"value"`
	Verified bool   `json:"verified"`
	Primary  bool   `json:"isPrimary"`
}

type Relationship struct {
	Type       string `json:"type"`
	RelatedCIF string `json:"relatedCifId"`
	Name       string `json:"relatedName"`
}

type KYCDoc struct {
	Type     string `json:"type"`
	Number   string `json:"number"`
	Verified bool   `json:"verified"`
	Expiry   string `json:"expiryDate"`
}

type CIFService struct {
	db *pgxpool.Pool
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func tenantID(r *http.Request) string {
	if v := r.Header.Get("x-tenant-id"); v != "" {
		return v
	}
	return r.URL.Query().Get("tenantId")
}

func initDatabase(ctx context.Context, db *pgxpool.Pool) error {
	_, err := db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS customers (
			id TEXT NOT NULL,
			bank_id TEXT NOT NULL DEFAULT '',
			bvn TEXT NOT NULL,
			first_name TEXT NOT NULL,
			last_name TEXT NOT NULL,
			email TEXT NOT NULL DEFAULT '',
			phone TEXT NOT NULL DEFAULT '',
			date_of_birth DATE NOT NULL,
			gender TEXT NOT NULL DEFAULT '',
			kyc_tier INTEGER NOT NULL DEFAULT 1,
			status TEXT NOT NULL DEFAULT 'active',
			addresses JSONB NOT NULL DEFAULT '[]',
			contacts JSONB NOT NULL DEFAULT '[]',
			relationships JSONB NOT NULL DEFAULT '[]',
			kyc_documents JSONB NOT NULL DEFAULT '[]',
			account_count INTEGER NOT NULL DEFAULT 0,
			total_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (id, bank_id)
		);
		ALTER TABLE customers ADD COLUMN IF NOT EXISTS bank_id TEXT NOT NULL DEFAULT '';
		DO $$ BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_name = 'customers' AND column_name = 'id'
			) THEN
				ALTER TABLE customers ADD COLUMN id TEXT NOT NULL DEFAULT '';
				ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_pkey;
				ALTER TABLE customers ADD PRIMARY KEY (id, bank_id);
			END IF;
		END $$;
		CREATE INDEX IF NOT EXISTS idx_customers_bank_id ON customers(bank_id);
		CREATE INDEX IF NOT EXISTS idx_customers_bvn ON customers(bvn, bank_id);
	`)
	return err
}

func jsonResponse(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "cif-management")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

const cifSelectCols = `
	id, bvn, first_name, last_name, email, phone, date_of_birth, gender,
	kyc_tier, status, addresses, contacts, relationships, kyc_documents,
	account_count, total_balance
`

func scanCIF(row interface{ Scan(...any) error }) (CIF, error) {
	var c CIF
	var dob time.Time
	var addrJSON, contactJSON, relJSON, docJSON []byte
	err := row.Scan(
		&c.ID, &c.BVN, &c.FirstName, &c.LastName, &c.Email, &c.Phone,
		&dob, &c.Gender, &c.KYCTier, &c.Status,
		&addrJSON, &contactJSON, &relJSON, &docJSON,
		&c.Accounts, &c.TotalBalance,
	)
	if err != nil {
		return c, err
	}
	c.DOB = dob.Format("2006-01-02")
	json.Unmarshal(addrJSON, &c.Addresses)
	json.Unmarshal(contactJSON, &c.Contacts)
	json.Unmarshal(relJSON, &c.Relationships)
	json.Unmarshal(docJSON, &c.Documents)
	if c.Addresses == nil {
		c.Addresses = []Address{}
	}
	if c.Contacts == nil {
		c.Contacts = []Contact{}
	}
	if c.Relationships == nil {
		c.Relationships = []Relationship{}
	}
	if c.Documents == nil {
		c.Documents = []KYCDoc{}
	}
	return c, nil
}

func (s *CIFService) listCustomers(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	if tid == "" {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "x-tenant-id header required"})
		return
	}

	rows, err := s.db.Query(r.Context(), `SELECT `+cifSelectCols+` FROM customers WHERE bank_id = $1 ORDER BY created_at DESC`, tid)
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	cifs := []CIF{}
	for rows.Next() {
		c, err := scanCIF(rows)
		if err != nil {
			jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		cifs = append(cifs, c)
	}
	jsonResponse(w, 200, map[string]interface{}{"items": cifs, "total": len(cifs)})
}

func (s *CIFService) getCustomer(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	if tid == "" {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "x-tenant-id header required"})
		return
	}

	id := r.URL.Path[len("/v1/customers/"):]
	if id == "" {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "id required"})
		return
	}

	row := s.db.QueryRow(r.Context(), `SELECT `+cifSelectCols+` FROM customers WHERE id = $1 AND bank_id = $2`, id, tid)
	c, err := scanCIF(row)
	if err != nil {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "CIF not found"})
		return
	}
	jsonResponse(w, 200, c)
}

func (s *CIFService) createCustomer(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	if tid == "" {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "x-tenant-id header required"})
		return
	}

	var c CIF
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if c.ID == "" || c.BVN == "" || c.FirstName == "" || c.LastName == "" {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "id, bvn, firstName, lastName required"})
		return
	}
	if c.Status == "" {
		c.Status = "active"
	}
	if c.KYCTier == 0 {
		c.KYCTier = 1
	}
	if c.Addresses == nil {
		c.Addresses = []Address{}
	}
	if c.Contacts == nil {
		c.Contacts = []Contact{}
	}
	if c.Relationships == nil {
		c.Relationships = []Relationship{}
	}
	if c.Documents == nil {
		c.Documents = []KYCDoc{}
	}

	addrJSON, _ := json.Marshal(c.Addresses)
	contactJSON, _ := json.Marshal(c.Contacts)
	relJSON, _ := json.Marshal(c.Relationships)
	docJSON, _ := json.Marshal(c.Documents)

	_, err := s.db.Exec(r.Context(), `
		INSERT INTO customers (id, bank_id, bvn, first_name, last_name, email, phone,
			date_of_birth, gender, kyc_tier, status, addresses, contacts,
			relationships, kyc_documents, account_count, total_balance)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
	`, c.ID, tid, c.BVN, c.FirstName, c.LastName, c.Email, c.Phone,
		c.DOB, c.Gender, c.KYCTier, c.Status,
		addrJSON, contactJSON, relJSON, docJSON,
		c.Accounts, c.TotalBalance)
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, http.StatusCreated, c)
}

func (s *CIFService) getStats(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	if tid == "" {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "x-tenant-id header required"})
		return
	}

	var totalCIFs, totalAccounts, totalDocs int
	var totalBalance float64
	s.db.QueryRow(r.Context(), `
		SELECT COUNT(*), COALESCE(SUM(account_count),0),
		       COALESCE(SUM(total_balance),0),
		       COALESCE(SUM(jsonb_array_length(kyc_documents)),0)
		FROM customers WHERE bank_id = $1
	`, tid).Scan(&totalCIFs, &totalAccounts, &totalBalance, &totalDocs)

	jsonResponse(w, 200, map[string]interface{}{
		"totalCIFs": totalCIFs, "totalAccounts": totalAccounts,
		"totalBalance": totalBalance, "totalKYCDocuments": totalDocs,
		"addressTypes": []string{"residential", "office", "mailing", "permanent"},
	})
}

func main() {
	godotenv.Load()
	ctx := context.Background()

	dbURL := getEnv("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")
	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := initDatabase(ctx, db); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	svc := &CIFService{db: db}
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		tid := tenantID(r)
		var total int
		if tid != "" {
			db.QueryRow(ctx, `SELECT COUNT(*) FROM customers WHERE bank_id = $1`, tid).Scan(&total)
		}
		jsonResponse(w, 200, map[string]interface{}{
			"status": "healthy", "service": "cif-management",
			"cifs": map[string]int{"total": total}, "middleware": middlewareConfig,
		})
	})
	mux.HandleFunc("/v1/customers", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			svc.createCustomer(w, r)
		} else {
			svc.listCustomers(w, r)
		}
	})
	mux.HandleFunc("/v1/customers/", svc.getCustomer)
	mux.HandleFunc("/v1/stats", svc.getStats)

	log.Printf("[cif-management] Listening on :%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
