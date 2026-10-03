package main

// ── Postgres persistence (W13-FIX-CRIT C7: in-memory srv.msgs → Postgres) ──
// Outbound/inbound Telegram messages were appended to a process-local slice
// (seeded with fabricated TG-001/TG-002 rows) and never delivered or
// persisted. telegram_messages is now the system of record. INSERT-first:
// every send writes a durable row ('queued'), then — when TELEGRAM_BOT_TOKEN
// is configured — the real Telegram Bot API is called and the row is updated
// to 'sent'/'failed'. Fail-closed: DB down => 503, never a 201 for a dropped
// message. No fake seed rows.

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

// openTelegramStore opens and schema-checks the Postgres store. Returns nil
// (handlers will 503) when DATABASE_URL is unset or unreachable.
func openTelegramStore() *sql.DB {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[telegram-service] DATABASE_URL not set — persistent store unavailable (message endpoints will 503)")
		return nil
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[telegram-service] postgres open failed: %v — endpoints will 503", err)
		return nil
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		log.Printf("[telegram-service] postgres ping failed: %v — endpoints will 503", err)
		db.Close()
		return nil
	}
	schema := []string{
		`CREATE TABLE IF NOT EXISTS telegram_messages (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL DEFAULT '',
			chat_id BIGINT NOT NULL,
			direction TEXT NOT NULL,
			text TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'queued',
			sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_telegram_messages_chat ON telegram_messages (chat_id, sent_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_telegram_messages_status ON telegram_messages (status)`,
	}
	for _, stmt := range schema {
		if _, err := db.Exec(stmt); err != nil {
			log.Printf("[telegram-service] schema init failed: %v — endpoints will 503", err)
			db.Close()
			return nil
		}
	}
	log.Printf("[telegram-service] postgres store ready (table telegram_messages)")
	return db
}

func storeUnavailableTG(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusServiceUnavailable)
	fmt.Fprintf(w, `{"error":"store_unavailable","service":"telegram-service"}`)
}

// persistMessage INSERTs a durable row (INSERT-first) and returns it.
func persistMessage(db *sql.DB, tenantID string, m *Message) error {
	if m.ID == "" {
		m.ID = "TG-" + uuid.NewString()[:8]
	}
	if m.Status == "" {
		m.Status = "queued"
	}
	var sentAt time.Time
	if err := db.QueryRow(
		`INSERT INTO telegram_messages (id, tenant_id, chat_id, direction, text, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING sent_at`,
		m.ID, tenantID, m.ChatID, m.Direction, m.Text, m.Status).Scan(&sentAt); err != nil {
		return err
	}
	m.SentAt = sentAt.UTC().Format(time.RFC3339)
	return nil
}

// updateMessageStatus marks a persisted row sent/failed after the Bot API call.
func updateMessageStatus(db *sql.DB, id, status string) {
	if _, err := db.Exec(`UPDATE telegram_messages SET status = $2, updated_at = NOW() WHERE id = $1`, id, status); err != nil {
		log.Printf("[telegram-service] status update failed for %s: %v", id, err)
	}
}

// deliverViaBotAPI calls the real Telegram Bot API sendMessage endpoint.
// Returns true only when Telegram accepted the message.
func deliverViaBotAPI(chatID int64, text string) bool {
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	if token == "" {
		return false // no bot configured: row stays 'queued' (durable)
	}
	payload, _ := json.Marshal(map[string]interface{}{"chat_id": chatID, "text": text})
	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)
	resp, err := sharedHTTPClient.Post(url, "application/json", bytes.NewReader(payload))
	if err != nil {
		log.Printf("[telegram-service] bot API call failed: %v", err)
		return false
	}
	defer resp.Body.Close()
	var body struct {
		OK bool `json:"ok"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		log.Printf("[telegram-service] bot API response decode failed: %v", err)
		return false
	}
	return resp.StatusCode == http.StatusOK && body.OK
}
