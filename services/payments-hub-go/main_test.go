package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/IBM/sarama/mocks"
)

func setupHubTest() {
	db = nil
	redisClient = nil
	outboxEntries = nil
}

// stubRail returns an httptest server mimicking the NIP rail adapter.
func stubRail(t *testing.T, responseCode string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"responseCode":%q,"responseMessage":"ok","sessionId":"SES-1","status":"successful"}`, responseCode)
	}))
}

// injectMockProducer swaps in a mock Kafka producer for the duration of a test.
func injectMockProducer(t *testing.T) *mocks.SyncProducer {
	t.Helper()
	mockProducer := mocks.NewSyncProducer(t, nil)
	eventBus.mu.Lock()
	eventBus.producer = mockProducer
	eventBus.mu.Unlock()
	t.Cleanup(func() {
		eventBus.mu.Lock()
		eventBus.producer = nil
		eventBus.mu.Unlock()
	})
	return mockProducer
}

func TestRoutePaymentFailsWhenRailUnconfigured(t *testing.T) {
	setupHubTest()
	t.Setenv("NIP_ENGINE_URL", "")
	t.Setenv("NIBSS_BASE_URL", "")
	body := `{"source_bank":"054","dest_bank":"058","amount_kobo":100000}`
	req := httptest.NewRequest("POST", "/v1/payments-hub/route", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	routePayment(w, req)
	if w.Code != 503 {
		t.Fatalf("expected 503 when rail unconfigured, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["status"] != "failed" {
		t.Fatalf("expected status=failed, got %v", resp["status"])
	}
	if len(outboxEntries) != 0 {
		t.Fatalf("no outbox entry may exist for a payment that was never routed")
	}
}

func TestRoutePayment(t *testing.T) {
	setupHubTest()
	rail := stubRail(t, "00")
	defer rail.Close()
	t.Setenv("NIP_ENGINE_URL", rail.URL)
	mockProducer := injectMockProducer(t)
	mockProducer.ExpectSendMessageAndSucceed()

	body := `{"source_bank":"054","dest_bank":"058","amount_kobo":100000}`
	req := httptest.NewRequest("POST", "/v1/payments-hub/route", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	routePayment(w, req)
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["payment_id"] == nil || resp["payment_id"] == "" {
		t.Fatal("expected payment_id in response")
	}
	if resp["channel"] != "NIP" {
		t.Fatalf("expected channel=NIP, got %v", resp["channel"])
	}
	if resp["status"] != "routed" {
		t.Fatalf("expected status=routed, got %v", resp["status"])
	}
}

func TestRoutePaymentRailRejected(t *testing.T) {
	setupHubTest()
	rail := stubRail(t, "51")
	defer rail.Close()
	t.Setenv("NIP_ENGINE_URL", rail.URL)

	body := `{"source_bank":"054","dest_bank":"058","amount_kobo":100000}`
	req := httptest.NewRequest("POST", "/v1/payments-hub/route", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	routePayment(w, req)
	if w.Code != 502 {
		t.Fatalf("expected 502 when rail rejects, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["status"] == "routed" {
		t.Fatal("a rail-rejected payment must never be reported as routed")
	}
}

func TestRoutePaymentIdempotencyKeyPropagated(t *testing.T) {
	setupHubTest()
	rail := stubRail(t, "00")
	defer rail.Close()
	t.Setenv("NIP_ENGINE_URL", rail.URL)
	mockProducer := injectMockProducer(t)
	mockProducer.ExpectSendMessageAndSucceed()

	body := `{"source_bank":"054","dest_bank":"058","amount_kobo":50000}`
	req := httptest.NewRequest("POST", "/v1/payments-hub/route", bytes.NewBufferString(body))
	req.Header.Set("X-Idempotency-Key", "IDEMP-TEST-001")
	w := httptest.NewRecorder()
	routePayment(w, req)
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	// Verify outbox entry captured the idempotency key and was published
	if len(outboxEntries) != 1 {
		t.Fatalf("expected 1 outbox entry, got %d", len(outboxEntries))
	}
	if outboxEntries[0].IdempotencyKey != "IDEMP-TEST-001" {
		t.Fatalf("expected idemp key IDEMP-TEST-001, got %s", outboxEntries[0].IdempotencyKey)
	}
	if outboxEntries[0].Status != "published" {
		t.Fatalf("expected outbox entry published, got %s", outboxEntries[0].Status)
	}
}

func TestEventBusFailsWithoutKafka(t *testing.T) {
	eb := &EventBus{topic: "test", serviceName: "test"}
	if err := eb.Emit("test.event", map[string]interface{}{"k": "v"}); err == nil {
		t.Fatal("Emit must fail when Kafka is not configured")
	}
}

func TestOutboxStatsEmpty(t *testing.T) {
	setupHubTest()
	req := httptest.NewRequest("GET", "/v1/payments-hub/outbox/stats", nil)
	w := httptest.NewRecorder()
	outboxStatsHandler(w, req)
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if int(resp["total"].(float64)) != 0 {
		t.Fatalf("expected 0 total, got %v", resp["total"])
	}
}

func TestOutboxStatsAfterPayment(t *testing.T) {
	setupHubTest()
	rail := stubRail(t, "00")
	defer rail.Close()
	t.Setenv("NIP_ENGINE_URL", rail.URL)
	mockProducer := injectMockProducer(t)
	mockProducer.ExpectSendMessageAndSucceed()

	// Route a payment to create an outbox entry
	body := `{"amount_kobo":25000}`
	req := httptest.NewRequest("POST", "/v1/payments-hub/route", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	routePayment(w, req)
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// Check outbox stats
	req2 := httptest.NewRequest("GET", "/v1/payments-hub/outbox/stats", nil)
	w2 := httptest.NewRecorder()
	outboxStatsHandler(w2, req2)
	var resp map[string]interface{}
	json.Unmarshal(w2.Body.Bytes(), &resp)
	if int(resp["total"].(float64)) != 1 {
		t.Fatalf("expected 1 total, got %v", resp["total"])
	}
	if int(resp["pending"].(float64)) != 0 {
		t.Fatalf("expected 0 pending (published on success), got %v", resp["pending"])
	}
}

func TestNairaToKoboConversion(t *testing.T) {
	tests := []struct {
		naira float64
		want  int64
	}{
		{100.00, 10000},
		{0.01, 1},
		{999999.99, 99999999},
		{0.0, 0},
	}
	for _, tt := range tests {
		got := nairaToKobo(tt.naira)
		if got != tt.want {
			t.Errorf("nairaToKobo(%f) = %d, want %d", tt.naira, got, tt.want)
		}
	}
}

func TestKoboToNairaConversion(t *testing.T) {
	tests := []struct {
		kobo int64
		want float64
	}{
		{10000, 100.00},
		{1, 0.01},
		{0, 0.0},
	}
	for _, tt := range tests {
		got := koboToNaira(tt.kobo)
		if got != tt.want {
			t.Errorf("koboToNaira(%d) = %f, want %f", tt.kobo, got, tt.want)
		}
	}
}

func TestValidateAmount(t *testing.T) {
	tests := []struct {
		amount  float64
		wantErr bool
	}{
		{100.00, false},
		{0.01, false},
		{-1.0, true},
		{0.0, false},
	}
	for _, tt := range tests {
		err := validateAmount(tt.amount)
		if (err != nil) != tt.wantErr {
			t.Errorf("validateAmount(%f) error=%v, wantErr=%v", tt.amount, err, tt.wantErr)
		}
	}
}

func TestValidateEmail(t *testing.T) {
	valid := []string{"test@example.com", "user@bank.ng"}
	invalid := []string{"", "notanemail", "@nodomain", "user@"}
	for _, e := range valid {
		if !validateEmail(e) {
			t.Errorf("expected %s to be valid email", e)
		}
	}
	for _, e := range invalid {
		if validateEmail(e) {
			t.Errorf("expected %s to be invalid email", e)
		}
	}
}

func TestValidateNigerianPhone(t *testing.T) {
	valid := []string{"08012345678", "09087654321", "07033334444"}
	invalid := []string{"", "123456", "0901234567", "090123456789999"}
	for _, p := range valid {
		if !validateNigerianPhone(p) {
			t.Errorf("expected %s to be valid phone", p)
		}
	}
	for _, p := range invalid {
		if validateNigerianPhone(p) {
			t.Errorf("expected %s to be invalid phone", p)
		}
	}
}

func TestValidateBVN(t *testing.T) {
	if !validateBVN("12345678901") {
		t.Error("expected 11-digit BVN to be valid")
	}
	if validateBVN("123") {
		t.Error("expected short BVN to be invalid")
	}
	if validateBVN("1234567890a") {
		t.Error("expected non-numeric BVN to be invalid")
	}
}

func TestHealthEndpoint(t *testing.T) {
	mux := http.NewServeMux()
	registerRoutes(mux)
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestCORSMiddleware(t *testing.T) {
	handler := corsMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))
	req := httptest.NewRequest("OPTIONS", "/", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != 204 {
		t.Fatalf("expected 204 for OPTIONS, got %d", w.Code)
	}
	if w.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Fatal("expected CORS Allow-Origin header")
	}
}

func TestSanitizeInput(t *testing.T) {
	tests := []struct {
		input  string
		maxLen int
		expect string
	}{
		{"hello", 10, "hello"},
		{"hello<script>", 100, "helloscript"},
		{"", 5, ""},
	}
	for _, tt := range tests {
		got := sanitizeInput(tt.input, tt.maxLen)
		if len(got) > tt.maxLen {
			t.Errorf("sanitizeInput exceeded maxLen: len=%d, max=%d", len(got), tt.maxLen)
		}
	}
}
