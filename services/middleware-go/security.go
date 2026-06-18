package middleware

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"sync"
	"time"
)

// D1: Transaction Signing — Cryptographic signatures for all financial transactions
// D2: Fraud Detection Engine — Real-time risk scoring
// D3: Data Encryption — AES-256 field-level encryption

// --- Transaction Signing (D1) ---

type TransactionSignature struct {
	TransactionID string    `json:"transactionId"`
	SignerID      string    `json:"signerId"`
	SignerRole    string    `json:"signerRole"`
	Signature     string    `json:"signature"`
	Algorithm     string    `json:"algorithm"`
	Timestamp     time.Time `json:"timestamp"`
	PublicKeyID   string    `json:"publicKeyId"`
}

type SigningService struct {
	mu         sync.RWMutex
	signatures map[string][]TransactionSignature
	hmacKey    []byte
}

func NewSigningService() *SigningService {
	key := make([]byte, 32)
	rand.Read(key)
	return &SigningService{
		signatures: make(map[string][]TransactionSignature),
		hmacKey:    key,
	}
}

func (s *SigningService) SignTransaction(txnID, signerID, signerRole string, data []byte) (*TransactionSignature, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	mac := hmac.New(sha256.New, s.hmacKey)
	mac.Write(data)
	sig := hex.EncodeToString(mac.Sum(nil))

	txnSig := TransactionSignature{
		TransactionID: txnID,
		SignerID:      signerID,
		SignerRole:    signerRole,
		Signature:     sig,
		Algorithm:     "HMAC-SHA256",
		Timestamp:     time.Now().UTC(),
		PublicKeyID:   fmt.Sprintf("key-%s", signerID),
	}

	s.signatures[txnID] = append(s.signatures[txnID], txnSig)
	log.Printf("[Signing] Transaction %s signed by %s (%s)", txnID, signerID, signerRole)
	return &txnSig, nil
}

func (s *SigningService) VerifySignature(txnID string, data []byte) (bool, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	sigs, ok := s.signatures[txnID]
	if !ok || len(sigs) == 0 {
		return false, fmt.Errorf("no signatures found for transaction %s", txnID)
	}

	mac := hmac.New(sha256.New, s.hmacKey)
	mac.Write(data)
	expected := hex.EncodeToString(mac.Sum(nil))

	for _, sig := range sigs {
		if sig.Signature == expected {
			return true, nil
		}
	}
	return false, nil
}

func (s *SigningService) RequireMultiSig(txnID string, requiredCount int) (bool, int) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sigs := s.signatures[txnID]
	return len(sigs) >= requiredCount, len(sigs)
}

// --- Fraud Detection Engine (D2) ---

type FraudScore struct {
	TransactionID string    `json:"transactionId"`
	Score         float64   `json:"score"`          // 0-100, higher = more risky
	RiskLevel     string    `json:"riskLevel"`       // "low", "medium", "high", "critical"
	Factors       []string  `json:"factors"`
	Decision      string    `json:"decision"`        // "allow", "review", "block"
	Timestamp     time.Time `json:"timestamp"`
}

type FraudDetector struct {
	mu              sync.RWMutex
	velocityTracker map[string][]time.Time // customerID -> recent transaction timestamps
	deviceTracker   map[string]string      // customerID -> last known device
	geoTracker      map[string]string      // customerID -> last known location
	thresholds      FraudThresholds
}

type FraudThresholds struct {
	HighValueAmount    float64 `json:"highValueAmount"`    // NGN
	VelocityWindow     int     `json:"velocityWindow"`     // seconds
	MaxVelocityCount   int     `json:"maxVelocityCount"`
	GeoVelocityMinutes int     `json:"geoVelocityMinutes"` // impossible travel
}

func NewFraudDetector() *FraudDetector {
	return &FraudDetector{
		velocityTracker: make(map[string][]time.Time),
		deviceTracker:   make(map[string]string),
		geoTracker:      make(map[string]string),
		thresholds: FraudThresholds{
			HighValueAmount:    5_000_000, // ₦5M
			VelocityWindow:     300,       // 5 minutes
			MaxVelocityCount:   5,
			GeoVelocityMinutes: 30,
		},
	}
}

func (f *FraudDetector) ScoreTransaction(customerID string, amount float64, channel, device, location, merchantCategory string) *FraudScore {
	f.mu.Lock()
	defer f.mu.Unlock()

	score := 0.0
	var factors []string
	now := time.Now()

	// 1. High-value transaction check
	if amount >= f.thresholds.HighValueAmount {
		score += 25
		factors = append(factors, fmt.Sprintf("high_value_transaction: ₦%.0f exceeds ₦%.0f threshold", amount, f.thresholds.HighValueAmount))
	}

	// 2. Velocity check
	window := now.Add(-time.Duration(f.thresholds.VelocityWindow) * time.Second)
	var recentTxns []time.Time
	for _, t := range f.velocityTracker[customerID] {
		if t.After(window) {
			recentTxns = append(recentTxns, t)
		}
	}
	if len(recentTxns) >= f.thresholds.MaxVelocityCount {
		score += 30
		factors = append(factors, fmt.Sprintf("velocity_exceeded: %d transactions in %d seconds", len(recentTxns), f.thresholds.VelocityWindow))
	}
	f.velocityTracker[customerID] = append(recentTxns, now)

	// 3. Device change detection
	if lastDevice, ok := f.deviceTracker[customerID]; ok && lastDevice != device && device != "" {
		score += 15
		factors = append(factors, "device_changed: new device detected")
	}
	if device != "" {
		f.deviceTracker[customerID] = device
	}

	// 4. Geo-velocity (impossible travel)
	if lastLoc, ok := f.geoTracker[customerID]; ok && lastLoc != location && location != "" {
		score += 20
		factors = append(factors, fmt.Sprintf("geo_velocity: location changed from %s to %s", lastLoc, location))
	}
	if location != "" {
		f.geoTracker[customerID] = location
	}

	// 5. Channel risk
	channelRisk := map[string]float64{
		"internet": 15, "mobile": 10, "pos": 5, "atm": 8, "branch": 2,
	}
	if risk, ok := channelRisk[channel]; ok {
		score += risk
		factors = append(factors, fmt.Sprintf("channel_risk: %s (%.0f points)", channel, risk))
	}

	// 6. Time-of-day risk
	hour := now.Hour()
	if hour >= 0 && hour < 6 {
		score += 10
		factors = append(factors, "unusual_time: transaction between midnight and 6am")
	}

	// Cap at 100
	score = math.Min(score, 100)

	riskLevel := "low"
	decision := "allow"
	if score >= 70 {
		riskLevel = "critical"
		decision = "block"
	} else if score >= 50 {
		riskLevel = "high"
		decision = "review"
	} else if score >= 30 {
		riskLevel = "medium"
		decision = "allow"
	}

	result := &FraudScore{
		TransactionID: fmt.Sprintf("fraud-%d", now.UnixNano()),
		Score:         score,
		RiskLevel:     riskLevel,
		Factors:       factors,
		Decision:      decision,
		Timestamp:     now,
	}

	log.Printf("[FraudDetector] Customer %s: score=%.0f level=%s decision=%s", customerID, score, riskLevel, decision)
	return result
}

// --- Field-Level Encryption (D3) ---

type FieldEncryptor struct {
	key []byte
}

func NewFieldEncryptor() *FieldEncryptor {
	key := make([]byte, 32)
	rand.Read(key)
	return &FieldEncryptor{key: key}
}

func (e *FieldEncryptor) Encrypt(plaintext string) (string, error) {
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", err
	}
	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, aesGCM.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := aesGCM.Seal(nonce, nonce, []byte(plaintext), nil)
	return hex.EncodeToString(ciphertext), nil
}

func (e *FieldEncryptor) Decrypt(cipherHex string) (string, error) {
	ciphertext, err := hex.DecodeString(cipherHex)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", err
	}
	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonceSize := aesGCM.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := aesGCM.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

// Encrypt sensitive fields in a record
func (e *FieldEncryptor) EncryptSensitiveFields(record map[string]interface{}, fields []string) (map[string]interface{}, error) {
	result := make(map[string]interface{})
	for k, v := range record {
		result[k] = v
	}
	for _, field := range fields {
		if val, ok := result[field]; ok {
			encrypted, err := e.Encrypt(fmt.Sprintf("%v", val))
			if err != nil {
				return nil, err
			}
			result[field] = encrypted
			result[field+"_encrypted"] = true
		}
	}
	return result, nil
}

// FraudDetection HTTP handler
func FraudDetectionHandler(detector *FraudDetector) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" {
			var req struct {
				CustomerID       string  `json:"customerId"`
				Amount           float64 `json:"amount"`
				Channel          string  `json:"channel"`
				Device           string  `json:"device"`
				Location         string  `json:"location"`
				MerchantCategory string  `json:"merchantCategory"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, `{"error":"invalid request"}`, 400)
				return
			}
			score := detector.ScoreTransaction(req.CustomerID, req.Amount, req.Channel, req.Device, req.Location, req.MerchantCategory)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(score)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service":    "fraud-detection",
			"status":     "healthy",
			"thresholds": detector.thresholds,
		})
	}
}
