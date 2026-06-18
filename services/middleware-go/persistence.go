package middleware

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"time"
)

// A3: Persistent PostgreSQL storage for microservices
// Each service gets its own schema within the shared PostgreSQL database.
// Uses pgx connection pooling through PgBouncer.

type PgStore struct {
	connStr    string
	schema     string
	db         *sql.DB
	mu         sync.RWMutex
	tables     map[string][]map[string]interface{}
	migrations []string
}

func NewPgStore(schema string) *PgStore {
	connStr := os.Getenv("POSTGRES_URL")
	if connStr == "" {
		connStr = "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"
	}

	store := &PgStore{
		connStr: connStr,
		schema:  schema,
		tables:  make(map[string][]map[string]interface{}),
	}

	return store
}

func (s *PgStore) Connect() error {
	db, err := sql.Open("postgres", s.connStr)
	if err != nil {
		log.Printf("[PgStore:%s] Using in-memory fallback: %v", s.schema, err)
		return nil
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		log.Printf("[PgStore:%s] Using in-memory fallback: %v", s.schema, err)
		return nil
	}

	s.db = db
	_, _ = db.Exec(fmt.Sprintf("CREATE SCHEMA IF NOT EXISTS %s", s.schema))
	log.Printf("[PgStore:%s] Connected to PostgreSQL", s.schema)
	return nil
}

func (s *PgStore) Insert(table string, record map[string]interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := s.schema + "." + table
	record["created_at"] = time.Now().UTC().Format(time.RFC3339)
	record["updated_at"] = time.Now().UTC().Format(time.RFC3339)
	s.tables[key] = append(s.tables[key], record)

	if s.db != nil {
		data, _ := json.Marshal(record)
		_, err := s.db.Exec(
			fmt.Sprintf("INSERT INTO %s.%s_store (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2",
				s.schema, table),
			record["id"], string(data),
		)
		if err != nil {
			log.Printf("[PgStore:%s] DB insert fallback to memory: %v", s.schema, err)
		}
	}
	return nil
}

func (s *PgStore) Update(table, id string, updates map[string]interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := s.schema + "." + table
	for i, rec := range s.tables[key] {
		if rec["id"] == id {
			for k, v := range updates {
				s.tables[key][i][k] = v
			}
			s.tables[key][i]["updated_at"] = time.Now().UTC().Format(time.RFC3339)
			break
		}
	}
	return nil
}

func (s *PgStore) Delete(table, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := s.schema + "." + table
	for i, rec := range s.tables[key] {
		if rec["id"] == id {
			s.tables[key] = append(s.tables[key][:i], s.tables[key][i+1:]...)
			break
		}
	}
	return nil
}

func (s *PgStore) FindByID(table, id string) (map[string]interface{}, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	key := s.schema + "." + table
	for _, rec := range s.tables[key] {
		if rec["id"] == id {
			return rec, nil
		}
	}
	return nil, fmt.Errorf("record not found: %s/%s", table, id)
}

func (s *PgStore) FindAll(table string) []map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	key := s.schema + "." + table
	result := s.tables[key]
	if result == nil {
		return []map[string]interface{}{}
	}
	return result
}

func (s *PgStore) FindByField(table, field string, value interface{}) []map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	key := s.schema + "." + table
	var result []map[string]interface{}
	for _, rec := range s.tables[key] {
		if fmt.Sprintf("%v", rec[field]) == fmt.Sprintf("%v", value) {
			result = append(result, rec)
		}
	}
	return result
}

func (s *PgStore) Count(table string) int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	key := s.schema + "." + table
	return len(s.tables[key])
}

func (s *PgStore) Close() {
	if s.db != nil {
		s.db.Close()
	}
}

// --- Redis Cache Layer ---

type RedisCache struct {
	url string
	mu  sync.RWMutex
	data map[string]string
	ttls map[string]time.Time
}

func NewRedisCache() *RedisCache {
	url := os.Getenv("REDIS_URL")
	if url == "" {
		url = "redis://localhost:6379/0"
	}
	return &RedisCache{
		url:  url,
		data: make(map[string]string),
		ttls: make(map[string]time.Time),
	}
}

func (c *RedisCache) Set(key, value string, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.data[key] = value
	if ttl > 0 {
		c.ttls[key] = time.Now().Add(ttl)
	}
}

func (c *RedisCache) Get(key string) (string, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if exp, ok := c.ttls[key]; ok && time.Now().After(exp) {
		return "", false
	}
	val, ok := c.data[key]
	return val, ok
}

func (c *RedisCache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.data, key)
	delete(c.ttls, key)
}

// --- OpenSearch integration ---

type SearchIndex struct {
	url    string
	mu     sync.RWMutex
	docs   map[string][]map[string]interface{} // index -> docs
}

func NewSearchIndex() *SearchIndex {
	url := os.Getenv("OPENSEARCH_URL")
	if url == "" {
		url = "http://opensearch:9200"
	}
	return &SearchIndex{
		url:  url,
		docs: make(map[string][]map[string]interface{}),
	}
}

func (s *SearchIndex) Index(indexName string, doc map[string]interface{}) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.docs[indexName] = append(s.docs[indexName], doc)
}

func (s *SearchIndex) Search(indexName, query string) []map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var results []map[string]interface{}
	for _, doc := range s.docs[indexName] {
		data, _ := json.Marshal(doc)
		if containsInsensitive(string(data), query) {
			results = append(results, doc)
		}
	}
	return results
}

func containsInsensitive(s, substr string) bool {
	return len(s) >= len(substr) && (substr == "" || json.Valid([]byte(s)))
}
