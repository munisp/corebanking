package main

// middleware_events.go — real TigerBeetle ledger posting + Kafka event publishing.
// Posts balanced double-entry transfers to the TigerBeetle HTTP gateway and
// publishes domain events to the Kafka REST proxy. Both degrade gracefully:
// a broker/ledger outage is logged but never fails the request.

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

const (
	mwLedgerDomain = "Credit"
	mwDebitAcct    = "1200"
	mwCreditAcct   = "1100"
	mwTxnCode      = 3002
	mwKafkaTopic   = "credit-facility.ledger"
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

// mwExtractKobo resolves the monetary value of a record in kobo (fixed point).
// Accepts an explicit "amountKobo" integer or a naira "amount" float.
func mwExtractKobo(data map[string]interface{}) int64 {
	if v, ok := data["amountKobo"]; ok {
		if f, ok := v.(float64); ok {
			return int64(f)
		}
	}
	if v, ok := data["amount"]; ok {
		if f, ok := v.(float64); ok {
			return int64(f * 100)
		}
	}
	return 0
}

// postLedgerTransfer posts a balanced double-entry transfer to TigerBeetle.
func postLedgerTransfer(ref string, amountKobo int64, tenantID, currency string) {
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
				"debitAccount":  mwDebitAcct,
				"creditAccount": mwCreditAcct,
				"amount":        amountKobo,
				"currency":      currency,
				"ledger":        1,
				"code":          mwTxnCode,
				"flags":         0,
				"domain":        mwLedgerDomain,
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
	log.Printf("[%s] ledger posted ref=%s amount=%d code=%d", serviceName, ref, amountKobo, mwTxnCode)
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
	_ = fmt.Sprintf
}
