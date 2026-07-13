package main

// middleware_events.go — real TigerBeetle ledger posting + Kafka event publishing
// for credit facility disbursements. Posts a balanced double-entry transfer
// (Dr loans receivable, Cr cash at bank) to the TigerBeetle HTTP gateway and
// publishes a domain event to the Kafka REST proxy. Both degrade gracefully.

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"
)

const (
	mwServiceName  = "credit-service"
	mwDebitAcct    = "1200" // Loans & advances (asset)
	mwCreditAcct   = "1100" // Cash at bank (asset)
	mwTxnCode      = 3002
	mwKafkaTopic   = "credit-facility.ledger"
	mwLedgerDomain = "Credit"
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

// postLedgerTransfer posts a balanced double-entry transfer to TigerBeetle.
// amountNaira is converted to kobo (fixed point) before posting.
func postLedgerTransfer(ref string, amountNaira float64, tenantID, currency string) {
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
		log.Printf("[%s] ledger post error (non-fatal) ref=%s: %v", mwServiceName, ref, err)
		return
	}
	defer resp.Body.Close()
	log.Printf("[%s] ledger posted ref=%s amount=%d code=%d", mwServiceName, ref, amountKobo, mwTxnCode)
}

// publishDomainEvent publishes a domain event to Kafka via the REST proxy.
func publishDomainEvent(eventType, tenantID string, payload interface{}) {
	body, err := json.Marshal(map[string]interface{}{
		"eventType": eventType,
		"tenantID":  tenantID,
		"service":   mwServiceName,
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
		log.Printf("[%s] kafka publish error (non-fatal) type=%s: %v", mwServiceName, eventType, err)
		return
	}
	defer resp.Body.Close()
}
