package main

// LN-03 (L3): COA journal outbox. Journal entries are PERSISTED before the
// money path completes and posted by a retrying background worker — replacing
// fire-and-forget PostAsync, which could silently lose the journal of record.

import (
	"encoding/json"
	"fmt"
	"log"
	"time"
)

// enqueueCoAOutbox persists a journal entry for later posting. A nil error
// means the entry is durable and will be posted (with retries) by the worker.
func enqueueCoAOutbox(tenantID, userID, userRole string, entry CreateJournalEntryRequest) error {
	payload, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("failed to marshal journal entry: %w", err)
	}
	_, err = db.Exec(`
		INSERT INTO coa_outbox (tenant_id, user_id, user_role, entry_json, status)
		VALUES ($1, $2, $3, $4, 'pending')`,
		tenantID, userID, userRole, payload)
	if err != nil {
		return fmt.Errorf("failed to persist journal outbox row: %w", err)
	}
	return nil
}

// startCoAOutboxWorker drains pending outbox rows every 30 seconds, posting
// each to the COA service synchronously and recording the outcome. Rows that
// keep failing stay pending with last_error — never dropped.
func startCoAOutboxWorker() {
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			drainCoAOutbox()
		}
	}()
	// Best-effort immediate drain at boot.
	go drainCoAOutbox()
}

func drainCoAOutbox() {
	if db == nil || coaClient == nil {
		return
	}
	rows, err := db.Query(`
		SELECT id, tenant_id, COALESCE(user_id, ''), COALESCE(user_role, ''), entry_json
		FROM coa_outbox WHERE status = 'pending' AND attempts < 50
		ORDER BY id LIMIT 50`)
	if err != nil {
		log.Printf("WARN [coa-outbox] query failed: %v", err)
		return
	}
	defer rows.Close()

	type outboxRow struct {
		id       int
		tenantID string
		userID   string
		userRole string
		entry    CreateJournalEntryRequest
	}
	var pending []outboxRow
	for rows.Next() {
		var r outboxRow
		var raw []byte
		if err := rows.Scan(&r.id, &r.tenantID, &r.userID, &r.userRole, &raw); err != nil {
			continue
		}
		if err := json.Unmarshal(raw, &r.entry); err != nil {
			db.Exec(`UPDATE coa_outbox SET status = 'dead', last_error = $1 WHERE id = $2`,
				"undecodable entry: "+err.Error(), r.id)
			continue
		}
		pending = append(pending, r)
	}

	for _, r := range pending {
		_, err := coaClient.CreateJournalEntry(r.tenantID, r.userID, r.userRole, r.entry)
		if err != nil {
			if _, uerr := db.Exec(`UPDATE coa_outbox SET attempts = attempts + 1, last_error = $1 WHERE id = $2`,
				err.Error(), r.id); uerr != nil {
				log.Printf("WARN [coa-outbox] failed to record attempt for row %d: %v", r.id, uerr)
			}
			continue
		}
		if _, err := db.Exec(`UPDATE coa_outbox SET status = 'posted', posted_at = $1 WHERE id = $2`,
			time.Now(), r.id); err != nil {
			log.Printf("WARN [coa-outbox] posted row %d but status update failed: %v", r.id, err)
		}
	}
}
