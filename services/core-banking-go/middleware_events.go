package main

// middleware_events.go — real TigerBeetle ledger posting + Kafka event publishing
// for core banking journal postings. The posting handler submits a balanced
// double-entry transfer to the TigerBeetle HTTP gateway and publishes a
// domain event to the Kafka REST proxy. Both degrade gracefully.

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"
)

const (
	mwTxnCode    = 1000
	mwKafkaTopic = "core-banking.postings"
)

func mwTigerBeetleURL() string {
	if v := os.Getenv("TIGERBEETLE_URL"); v != "" {
		return v
	}
	return "http://tigerbeetle-adapter:3000"
}

func mwKafkaURL() string {
	if v := os.Getenv("KAFKA_REST_URL"); v != "" {
		return v
	}
	if v := os.Getenv("KAFKA_BROKER_URL"); v != "" {
		return v
	}
	return "http://kafka-rest-proxy:8082"
}

var mwHTTP = &http.Client{Timeout: 5 * time.Second}

// postLedgerTransferAccounts posts a balanced double-entry transfer to TigerBeetle
// using the debit/credit accounts supplied on the posting request.
func postLedgerTransferAccounts(ref, debitAcct, creditAcct string, amountNaira float64, currency, tenantID string) {
	amountKobo := int64(amountNaira * 100)
	if amountKobo <= 0 {
		return
	}
	if currency == "" {
		currency = "NGN"
	}
	payload, err := json.Marshal(map[string]interface{}{
		"transfers": []map[string]interface{}{
			{
				"id":            ref,
				"debitAccount":  debitAcct,
				"creditAccount": creditAcct,
				"amount":        amountKobo,
				"currency":      currency,
				"ledger":        1,
				"code":          mwTxnCode,
				"flags":         0,
				"timestamp":     time.Now().UnixNano(),
			},
		},
	})
	if err != nil {
		return
	}
	req, err := http.NewRequest("POST", mwTigerBeetleURL()+"/transfers", bytes.NewBuffer(payload))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	if tenantID != "" {
		req.Header.Set("X-Tenant-ID", tenantID)
	}
	resp, err := mwHTTP.Do(req)
	if err != nil {
		log.Printf("[%s] ledger post error (non-fatal) ref=%s: %v", serviceName, ref, err)
		return
	}
	defer resp.Body.Close()
	log.Printf("[%s] ledger posted ref=%s dr=%s cr=%s amount=%d", serviceName, ref, debitAcct, creditAcct, amountKobo)
}

// publishDomainEvent publishes a domain event to Kafka via the REST proxy.
func publishDomainEvent(eventType, tenantID string, payload interface{}) {
	body, err := json.Marshal(map[string]interface{}{
		"eventType": eventType,
		"tenantID":  tenantID,
		"service":   serviceName,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"payload":   payload,
	})
	if err != nil {
		return
	}
	req, err := http.NewRequest("POST", mwKafkaURL()+"/topics/"+mwKafkaTopic, bytes.NewBuffer(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	if tenantID != "" {
		req.Header.Set("X-Tenant-ID", tenantID)
	}
	resp, err := mwHTTP.Do(req)
	if err != nil {
		log.Printf("[%s] kafka publish error (non-fatal) type=%s: %v", serviceName, eventType, err)
		return
	}
	defer resp.Body.Close()
}
