// Package integration tests payment processing flows:
// NIP Transfer, NEFT Settlement, Bill Payment, Airtime Purchase
package integration

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"
)

var (
	nipURL      = envOr("NIP_URL", "http://nip-gateway-go:8080")
	neftURL     = envOr("NEFT_URL", "http://neft-settlement-go:8080")
	billURL     = envOr("BILL_URL", "http://bill-payment-go:8080")
	airtimeURL  = envOr("AIRTIME_URL", "http://airtime-purchase-go:8080")
	posURL      = envOr("POS_URL", "http://pos-terminal-go:8080")
	ussdURL     = envOr("USSD_URL", "http://ussd-banking-go:8080")
	qrURL       = envOr("QR_URL", "http://nqr-payments-go:8080")
)

func TestNIPTransfer(t *testing.T) {
	t.Run("name_enquiry", func(t *testing.T) {
		body := map[string]interface{}{
			"destination_bank_code": "000014",
			"account_number":       "0123456789",
		}

		resp, err := postJSON(nipURL+"/v1/nip-gateway/name-enquiry", body)
		if err != nil {
			t.Skipf("NIP gateway not reachable: %v", err)
			return
		}
		defer resp.Body.Close()

		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		t.Logf("Name enquiry response: %v", result)
	})

	t.Run("funds_transfer", func(t *testing.T) {
		body := map[string]interface{}{
			"source_account":        "0123456789",
			"destination_account":   "9876543210",
			"destination_bank_code": "000014",
			"amount_kobo":           250000, // ₦2,500
			"narration":             "NIP integration test",
			"channel":               "web",
			"idempotency_key":       fmt.Sprintf("nip-test-%d", time.Now().UnixNano()),
		}

		resp, err := postJSON(nipURL+"/v1/nip-gateway/transfer", body)
		if err != nil {
			t.Skipf("NIP gateway not reachable: %v", err)
			return
		}
		defer resp.Body.Close()

		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)

		if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated {
			sessionID, _ := result["session_id"].(string)
			t.Logf("NIP transfer initiated: session=%s", sessionID)

			// Check status
			if sessionID != "" {
				t.Run("check_status", func(t *testing.T) {
					statusResp, err := http.Get(nipURL + "/v1/nip-gateway/status/" + sessionID)
					if err != nil {
						t.Logf("Status check failed: %v", err)
						return
					}
					defer statusResp.Body.Close()

					var statusResult map[string]interface{}
					json.NewDecoder(statusResp.Body).Decode(&statusResult)
					t.Logf("Transfer status: %v", statusResult)
				})
			}
		} else {
			t.Logf("NIP transfer returned %d: %v", resp.StatusCode, result)
		}
	})
}

func TestNEFTSettlement(t *testing.T) {
	body := map[string]interface{}{
		"source_account":        "0123456789",
		"destination_account":   "9876543210",
		"destination_bank_code": "000014",
		"amount_kobo":           1000000, // ₦10,000
		"settlement_cycle":      "T0",
		"narration":             "NEFT integration test",
		"idempotency_key":       fmt.Sprintf("neft-test-%d", time.Now().UnixNano()),
	}

	resp, err := postJSON(neftURL+"/v1/neft-settlement/submit", body)
	if err != nil {
		t.Skipf("NEFT service not reachable: %v", err)
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	t.Logf("NEFT submission: status=%d result=%v", resp.StatusCode, result)
}

func TestBillPayment(t *testing.T) {
	t.Run("validate_biller", func(t *testing.T) {
		body := map[string]interface{}{
			"biller_code":   "IKEDC",
			"customer_id":   "04141234567",
			"payment_item":  "prepaid",
		}

		resp, err := postJSON(billURL+"/v1/bill-payment/validate", body)
		if err != nil {
			t.Skipf("Bill payment not reachable: %v", err)
			return
		}
		defer resp.Body.Close()

		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		t.Logf("Biller validation: %v", result)
	})

	t.Run("pay_bill", func(t *testing.T) {
		body := map[string]interface{}{
			"biller_code":    "IKEDC",
			"customer_id":    "04141234567",
			"amount_kobo":    500000, // ₦5,000
			"source_account": "0123456789",
			"payment_item":   "prepaid",
			"idempotency_key": fmt.Sprintf("bill-test-%d", time.Now().UnixNano()),
		}

		resp, err := postJSON(billURL+"/v1/bill-payment/pay", body)
		if err != nil {
			t.Skipf("Bill payment not reachable: %v", err)
			return
		}
		defer resp.Body.Close()

		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		t.Logf("Bill payment: status=%d result=%v", resp.StatusCode, result)
	})
}

func TestAirtimePurchase(t *testing.T) {
	body := map[string]interface{}{
		"phone_number":   "+2348012345678",
		"network":        "MTN",
		"amount_kobo":    100000, // ₦1,000
		"source_account": "0123456789",
		"idempotency_key": fmt.Sprintf("airtime-test-%d", time.Now().UnixNano()),
	}

	resp, err := postJSON(airtimeURL+"/v1/airtime-purchase/buy", body)
	if err != nil {
		t.Skipf("Airtime service not reachable: %v", err)
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	t.Logf("Airtime purchase: status=%d result=%v", resp.StatusCode, result)
}

func TestPOSTransaction(t *testing.T) {
	body := map[string]interface{}{
		"terminal_id":    "2054TL01",
		"merchant_id":    "MER001234567",
		"card_pan":       "506099XXXXXX1234",
		"amount_kobo":    350000, // ₦3,500
		"transaction_type": "purchase",
		"idempotency_key":  fmt.Sprintf("pos-test-%d", time.Now().UnixNano()),
	}

	resp, err := postJSON(posURL+"/v1/pos-terminal/transact", body)
	if err != nil {
		t.Skipf("POS service not reachable: %v", err)
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	t.Logf("POS transaction: status=%d result=%v", resp.StatusCode, result)
}

func TestUSSDSession(t *testing.T) {
	body := map[string]interface{}{
		"session_id":  fmt.Sprintf("ussd-%d", time.Now().UnixNano()),
		"phone":       "+2348012345678",
		"ussd_code":   "*901#",
		"input":       "",
		"service_code": "*901#",
	}

	resp, err := postJSON(ussdURL+"/v1/ussd-banking/session", body)
	if err != nil {
		t.Skipf("USSD service not reachable: %v", err)
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	t.Logf("USSD session: status=%d result=%v", resp.StatusCode, result)
}

func TestQRPayment(t *testing.T) {
	t.Run("generate_qr", func(t *testing.T) {
		body := map[string]interface{}{
			"merchant_id":  "MER001234567",
			"amount_kobo":  200000, // ₦2,000
			"narration":    "QR test payment",
		}

		resp, err := postJSON(qrURL+"/v1/nqr-payments/generate", body)
		if err != nil {
			t.Skipf("QR service not reachable: %v", err)
			return
		}
		defer resp.Body.Close()

		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		t.Logf("QR generation: status=%d result=%v", resp.StatusCode, result)
	})
}
