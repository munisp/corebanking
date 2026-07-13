package main

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/scrypt"
)

// Prometheus metrics
var (
	offlinePINVerifications = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "offline_pin_verifications_total",
			Help: "Total offline PIN verifications",
		},
		[]string{"status", "method"},
	)

	offlinePINSyncTime = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "offline_pin_sync_time_seconds",
			Help:    "Time taken to sync offline PIN data",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"operation"},
	)

	offlinePINAttempts = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "offline_pin_attempts_total",
			Help: "Total offline PIN attempts",
		},
		[]string{"device_id", "result"},
	)
)

// OfflinePINConfig holds configuration for offline PIN verification
type OfflinePINConfig struct {
	MaxOfflineAttempts     int           // Max failed attempts before lockout
	OfflineLockoutDuration time.Duration // Duration of lockout after max attempts
	PINDataTTL             time.Duration // How long offline PIN data is valid
	MaxOfflineTransactions int           // Max transactions allowed offline
	MaxOfflineAmount       float64       // Max total amount for offline transactions
	RequireOnlineSync      time.Duration // Force online sync after this duration
	EncryptionKeyRotation  time.Duration // How often to rotate encryption keys
}

// DefaultOfflinePINConfig provides sensible defaults
var DefaultOfflinePINConfig = OfflinePINConfig{
	MaxOfflineAttempts:     3,
	OfflineLockoutDuration: 30 * time.Minute,
	PINDataTTL:             7 * 24 * time.Hour, // 7 days
	MaxOfflineTransactions: 10,
	MaxOfflineAmount:       50000, // NGN 50,000
	RequireOnlineSync:      24 * time.Hour,
	EncryptionKeyRotation:  30 * 24 * time.Hour, // 30 days
}

// OfflinePINData represents encrypted PIN data stored on device
type OfflinePINData struct {
	UserID              string    `json:"user_id"`
	DeviceID            string    `json:"device_id"`
	EncryptedPINHash    string    `json:"encrypted_pin_hash"`
	Salt                string    `json:"salt"`
	IV                  string    `json:"iv"`
	CreatedAt           time.Time `json:"created_at"`
	ExpiresAt           time.Time `json:"expires_at"`
	LastSyncAt          time.Time `json:"last_sync_at"`
	FailedAttempts      int       `json:"failed_attempts"`
	LockedUntil         *time.Time `json:"locked_until,omitempty"`
	OfflineTransactions int       `json:"offline_transactions"`
	OfflineAmount       float64   `json:"offline_amount"`
	Version             int       `json:"version"`
	Checksum            string    `json:"checksum"`
}

// OfflinePINVerificationResult represents the result of offline PIN verification
type OfflinePINVerificationResult struct {
	Valid              bool      `json:"valid"`
	RemainingAttempts  int       `json:"remaining_attempts"`
	LockedUntil        *time.Time `json:"locked_until,omitempty"`
	RequiresOnlineSync bool      `json:"requires_online_sync"`
	Message            string    `json:"message"`
}

// OfflinePINService handles offline PIN verification
type OfflinePINService struct {
	db            *pgxpool.Pool
	config        OfflinePINConfig
	masterKey     []byte
	deviceKeys    map[string][]byte
	mutex         sync.RWMutex
	smsProvider   SMSProvider
}

// SMSProvider interface for sending SMS alerts
type SMSProvider interface {
	SendSMS(ctx context.Context, phone string, message string) error
}

// NewOfflinePINService creates a new offline PIN service
func NewOfflinePINService(db *pgxpool.Pool, masterKey []byte, smsProvider SMSProvider) *OfflinePINService {
	return &OfflinePINService{
		db:          db,
		config:      DefaultOfflinePINConfig,
		masterKey:   masterKey,
		deviceKeys:  make(map[string][]byte),
		smsProvider: smsProvider,
	}
}

// GenerateOfflinePINData generates encrypted PIN data for offline storage
func (s *OfflinePINService) GenerateOfflinePINData(ctx context.Context, userID, deviceID, pin string) (*OfflinePINData, error) {
	start := time.Now()
	defer func() {
		offlinePINSyncTime.WithLabelValues("generate").Observe(time.Since(start).Seconds())
	}()

	// Generate device-specific key
	deviceKey, err := s.getOrCreateDeviceKey(deviceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get device key: %w", err)
	}

	// Generate salt
	salt := make([]byte, 32)
	if _, err := rand.Read(salt); err != nil {
		return nil, fmt.Errorf("failed to generate salt: %w", err)
	}

	// Hash PIN using Argon2id (memory-hard, resistant to GPU attacks)
	pinHash := argon2.IDKey([]byte(pin), salt, 3, 64*1024, 4, 32)

	// Encrypt the PIN hash with device key
	encryptedHash, iv, err := s.encryptData(pinHash, deviceKey)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt PIN hash: %w", err)
	}

	now := time.Now()
	data := &OfflinePINData{
		UserID:              userID,
		DeviceID:            deviceID,
		EncryptedPINHash:    base64.StdEncoding.EncodeToString(encryptedHash),
		Salt:                base64.StdEncoding.EncodeToString(salt),
		IV:                  base64.StdEncoding.EncodeToString(iv),
		CreatedAt:           now,
		ExpiresAt:           now.Add(s.config.PINDataTTL),
		LastSyncAt:          now,
		FailedAttempts:      0,
		OfflineTransactions: 0,
		OfflineAmount:       0,
		Version:             1,
	}

	// Generate checksum for integrity verification
	data.Checksum = s.generateChecksum(data)

	// Store in database for sync tracking
	_, err = s.db.Exec(ctx, `
		INSERT INTO offline_pin_data (
			user_id, device_id, encrypted_pin_hash, salt, iv,
			created_at, expires_at, last_sync_at, version
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (user_id, device_id) DO UPDATE SET
			encrypted_pin_hash = $3, salt = $4, iv = $5,
			last_sync_at = $8, version = offline_pin_data.version + 1
	`, data.UserID, data.DeviceID, data.EncryptedPINHash, data.Salt, data.IV,
		data.CreatedAt, data.ExpiresAt, data.LastSyncAt, data.Version)

	if err != nil {
		return nil, fmt.Errorf("failed to store offline PIN data: %w", err)
	}

	return data, nil
}

// VerifyOfflinePIN verifies PIN offline using stored encrypted data
func (s *OfflinePINService) VerifyOfflinePIN(ctx context.Context, data *OfflinePINData, pin string) (*OfflinePINVerificationResult, error) {
	// Verify checksum
	if s.generateChecksum(data) != data.Checksum {
		offlinePINVerifications.WithLabelValues("failed", "checksum").Inc()
		return &OfflinePINVerificationResult{
			Valid:              false,
			RequiresOnlineSync: true,
			Message:            "Data integrity check failed. Please sync online.",
		}, nil
	}

	// Check if data has expired
	if time.Now().After(data.ExpiresAt) {
		offlinePINVerifications.WithLabelValues("failed", "expired").Inc()
		return &OfflinePINVerificationResult{
			Valid:              false,
			RequiresOnlineSync: true,
			Message:            "Offline PIN data has expired. Please sync online.",
		}, nil
	}

	// Check if account is locked
	if data.LockedUntil != nil && time.Now().Before(*data.LockedUntil) {
		offlinePINVerifications.WithLabelValues("failed", "locked").Inc()
		return &OfflinePINVerificationResult{
			Valid:             false,
			RemainingAttempts: 0,
			LockedUntil:       data.LockedUntil,
			Message:           fmt.Sprintf("Account locked until %s", data.LockedUntil.Format("15:04")),
		}, nil
	}

	// Check if online sync is required
	if time.Since(data.LastSyncAt) > s.config.RequireOnlineSync {
		offlinePINVerifications.WithLabelValues("failed", "sync_required").Inc()
		return &OfflinePINVerificationResult{
			Valid:              false,
			RequiresOnlineSync: true,
			Message:            "Online sync required. Please connect to the internet.",
		}, nil
	}

	// Get device key
	deviceKey, err := s.getOrCreateDeviceKey(data.DeviceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get device key: %w", err)
	}

	// Decrypt stored PIN hash
	encryptedHash, err := base64.StdEncoding.DecodeString(data.EncryptedPINHash)
	if err != nil {
		return nil, fmt.Errorf("failed to decode encrypted hash: %w", err)
	}

	iv, err := base64.StdEncoding.DecodeString(data.IV)
	if err != nil {
		return nil, fmt.Errorf("failed to decode IV: %w", err)
	}

	storedHash, err := s.decryptData(encryptedHash, deviceKey, iv)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt PIN hash: %w", err)
	}

	// Hash the provided PIN
	salt, err := base64.StdEncoding.DecodeString(data.Salt)
	if err != nil {
		return nil, fmt.Errorf("failed to decode salt: %w", err)
	}

	providedHash := argon2.IDKey([]byte(pin), salt, 3, 64*1024, 4, 32)

	// Compare hashes using constant-time comparison
	if !hmac.Equal(storedHash, providedHash) {
		data.FailedAttempts++
		remainingAttempts := s.config.MaxOfflineAttempts - data.FailedAttempts

		if remainingAttempts <= 0 {
			lockUntil := time.Now().Add(s.config.OfflineLockoutDuration)
			data.LockedUntil = &lockUntil
			data.FailedAttempts = 0

			offlinePINVerifications.WithLabelValues("failed", "max_attempts").Inc()
			offlinePINAttempts.WithLabelValues(data.DeviceID, "locked").Inc()

			return &OfflinePINVerificationResult{
				Valid:             false,
				RemainingAttempts: 0,
				LockedUntil:       &lockUntil,
				Message:           fmt.Sprintf("Too many failed attempts. Locked until %s", lockUntil.Format("15:04")),
			}, nil
		}

		offlinePINVerifications.WithLabelValues("failed", "wrong_pin").Inc()
		offlinePINAttempts.WithLabelValues(data.DeviceID, "failed").Inc()

		return &OfflinePINVerificationResult{
			Valid:             false,
			RemainingAttempts: remainingAttempts,
			Message:           fmt.Sprintf("Invalid PIN. %d attempts remaining.", remainingAttempts),
		}, nil
	}

	// PIN is valid - reset failed attempts
	data.FailedAttempts = 0
	data.LockedUntil = nil

	offlinePINVerifications.WithLabelValues("success", "verified").Inc()
	offlinePINAttempts.WithLabelValues(data.DeviceID, "success").Inc()

	return &OfflinePINVerificationResult{
		Valid:             true,
		RemainingAttempts: s.config.MaxOfflineAttempts,
		Message:           "PIN verified successfully",
	}, nil
}

// CanPerformOfflineTransaction checks if an offline transaction is allowed
func (s *OfflinePINService) CanPerformOfflineTransaction(data *OfflinePINData, amount float64) (bool, string) {
	// Check transaction count
	if data.OfflineTransactions >= s.config.MaxOfflineTransactions {
		return false, fmt.Sprintf("Maximum offline transactions (%d) reached. Please sync online.", s.config.MaxOfflineTransactions)
	}

	// Check total amount
	if data.OfflineAmount+amount > s.config.MaxOfflineAmount {
		return false, fmt.Sprintf("Offline transaction limit (N%.2f) exceeded. Please sync online.", s.config.MaxOfflineAmount)
	}

	return true, ""
}

// RecordOfflineTransaction records an offline transaction
func (s *OfflinePINService) RecordOfflineTransaction(data *OfflinePINData, amount float64) {
	data.OfflineTransactions++
	data.OfflineAmount += amount
	data.Checksum = s.generateChecksum(data)
}

// SyncOfflineData syncs offline PIN data with server
func (s *OfflinePINService) SyncOfflineData(ctx context.Context, data *OfflinePINData) error {
	start := time.Now()
	defer func() {
		offlinePINSyncTime.WithLabelValues("sync").Observe(time.Since(start).Seconds())
	}()

	// Update last sync time
	data.LastSyncAt = time.Now()
	data.Version++

	// Reset offline counters
	data.OfflineTransactions = 0
	data.OfflineAmount = 0

	// Update checksum
	data.Checksum = s.generateChecksum(data)

	// Update database
	_, err := s.db.Exec(ctx, `
		UPDATE offline_pin_data SET
			last_sync_at = $1,
			version = $2,
			failed_attempts = $3,
			locked_until = $4
		WHERE user_id = $5 AND device_id = $6
	`, data.LastSyncAt, data.Version, data.FailedAttempts, data.LockedUntil,
		data.UserID, data.DeviceID)

	return err
}

// Helper methods

func (s *OfflinePINService) getOrCreateDeviceKey(deviceID string) ([]byte, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if key, exists := s.deviceKeys[deviceID]; exists {
		return key, nil
	}

	// Derive device-specific key from master key and device ID
	key, err := scrypt.Key(s.masterKey, []byte(deviceID), 32768, 8, 1, 32)
	if err != nil {
		return nil, err
	}

	s.deviceKeys[deviceID] = key
	return key, nil
}

func (s *OfflinePINService) encryptData(data, key []byte) ([]byte, []byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, err
	}

	iv := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return nil, nil, err
	}

	encrypted := gcm.Seal(nil, iv, data, nil)
	return encrypted, iv, nil
}

func (s *OfflinePINService) decryptData(data, key, iv []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	return gcm.Open(nil, iv, data, nil)
}

func (s *OfflinePINService) generateChecksum(data *OfflinePINData) string {
	// Create a copy without checksum for hashing
	dataCopy := *data
	dataCopy.Checksum = ""

	jsonData, _ := json.Marshal(dataCopy)

	h := hmac.New(sha256.New, s.masterKey)
	h.Write(jsonData)
	return hex.EncodeToString(h.Sum(nil))
}

// BiometricOfflinePIN handles biometric-based offline authentication

// BiometricData represents stored biometric template
type BiometricData struct {
	UserID           string    `json:"user_id"`
	DeviceID         string    `json:"device_id"`
	BiometricType    string    `json:"biometric_type"` // fingerprint, face, iris
	EncryptedTemplate string   `json:"encrypted_template"`
	IV               string    `json:"iv"`
	CreatedAt        time.Time `json:"created_at"`
	ExpiresAt        time.Time `json:"expires_at"`
	Checksum         string    `json:"checksum"`
}

// BiometricOfflinePINService handles biometric-based offline auth
type BiometricOfflinePINService struct {
	pinService *OfflinePINService
}

// NewBiometricOfflinePINService creates a new biometric offline PIN service
func NewBiometricOfflinePINService(pinService *OfflinePINService) *BiometricOfflinePINService {
	return &BiometricOfflinePINService{pinService: pinService}
}

// RegisterBiometric registers biometric data for offline use
func (s *BiometricOfflinePINService) RegisterBiometric(ctx context.Context, userID, deviceID, biometricType string, template []byte) (*BiometricData, error) {
	deviceKey, err := s.pinService.getOrCreateDeviceKey(deviceID)
	if err != nil {
		return nil, err
	}

	encryptedTemplate, iv, err := s.pinService.encryptData(template, deviceKey)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	data := &BiometricData{
		UserID:            userID,
		DeviceID:          deviceID,
		BiometricType:     biometricType,
		EncryptedTemplate: base64.StdEncoding.EncodeToString(encryptedTemplate),
		IV:                base64.StdEncoding.EncodeToString(iv),
		CreatedAt:         now,
		ExpiresAt:         now.Add(90 * 24 * time.Hour), // 90 days
	}

	// Generate checksum
	jsonData, _ := json.Marshal(data)
	h := hmac.New(sha256.New, s.pinService.masterKey)
	h.Write(jsonData)
	data.Checksum = hex.EncodeToString(h.Sum(nil))

	return data, nil
}

// VerifyBiometric verifies biometric data offline
func (s *BiometricOfflinePINService) VerifyBiometric(ctx context.Context, data *BiometricData, template []byte) (bool, error) {
	// Check expiry
	if time.Now().After(data.ExpiresAt) {
		return false, fmt.Errorf("biometric data expired")
	}

	deviceKey, err := s.pinService.getOrCreateDeviceKey(data.DeviceID)
	if err != nil {
		return false, err
	}

	encryptedTemplate, err := base64.StdEncoding.DecodeString(data.EncryptedTemplate)
	if err != nil {
		return false, err
	}

	iv, err := base64.StdEncoding.DecodeString(data.IV)
	if err != nil {
		return false, err
	}

	storedTemplate, err := s.pinService.decryptData(encryptedTemplate, deviceKey, iv)
	if err != nil {
		return false, err
	}

	// In production, use proper biometric matching algorithm
	// This is a simplified comparison
	return hmac.Equal(storedTemplate, template), nil
}

// OfflineTransactionQueue manages offline transactions pending sync

// OfflineTransaction represents a transaction performed offline
type OfflineTransaction struct {
	TransactionID   string    `json:"transaction_id"`
	UserID          string    `json:"user_id"`
	DeviceID        string    `json:"device_id"`
	Type            string    `json:"type"`
	Amount          float64   `json:"amount"`
	Recipient       string    `json:"recipient,omitempty"`
	Description     string    `json:"description"`
	CreatedAt       time.Time `json:"created_at"`
	PINVerifiedAt   time.Time `json:"pin_verified_at"`
	Signature       string    `json:"signature"`
	SyncStatus      string    `json:"sync_status"` // pending, synced, failed
	SyncAttempts    int       `json:"sync_attempts"`
	LastSyncAttempt *time.Time `json:"last_sync_attempt,omitempty"`
}

// OfflineTransactionQueue manages offline transactions
type OfflineTransactionQueue struct {
	transactions map[string]*OfflineTransaction
	mutex        sync.RWMutex
	pinService   *OfflinePINService
}

// NewOfflineTransactionQueue creates a new offline transaction queue
func NewOfflineTransactionQueue(pinService *OfflinePINService) *OfflineTransactionQueue {
	return &OfflineTransactionQueue{
		transactions: make(map[string]*OfflineTransaction),
		pinService:   pinService,
	}
}

// QueueTransaction queues a transaction for later sync
func (q *OfflineTransactionQueue) QueueTransaction(ctx context.Context, txn *OfflineTransaction) error {
	q.mutex.Lock()
	defer q.mutex.Unlock()

	// Generate signature for integrity
	txn.Signature = q.generateTransactionSignature(txn)
	txn.SyncStatus = "pending"
	txn.SyncAttempts = 0

	q.transactions[txn.TransactionID] = txn
	return nil
}

// GetPendingTransactions returns all pending transactions
func (q *OfflineTransactionQueue) GetPendingTransactions() []*OfflineTransaction {
	q.mutex.RLock()
	defer q.mutex.RUnlock()

	var pending []*OfflineTransaction
	for _, txn := range q.transactions {
		if txn.SyncStatus == "pending" {
			pending = append(pending, txn)
		}
	}
	return pending
}

// MarkSynced marks a transaction as synced
func (q *OfflineTransactionQueue) MarkSynced(transactionID string) {
	q.mutex.Lock()
	defer q.mutex.Unlock()

	if txn, exists := q.transactions[transactionID]; exists {
		txn.SyncStatus = "synced"
	}
}

// MarkFailed marks a transaction as failed
func (q *OfflineTransactionQueue) MarkFailed(transactionID string) {
	q.mutex.Lock()
	defer q.mutex.Unlock()

	if txn, exists := q.transactions[transactionID]; exists {
		txn.SyncStatus = "failed"
		txn.SyncAttempts++
		now := time.Now()
		txn.LastSyncAttempt = &now
	}
}

func (q *OfflineTransactionQueue) generateTransactionSignature(txn *OfflineTransaction) string {
	data := fmt.Sprintf("%s|%s|%s|%.2f|%s|%d",
		txn.TransactionID, txn.UserID, txn.Type, txn.Amount,
		txn.CreatedAt.Format(time.RFC3339), txn.PINVerifiedAt.Unix())

	h := hmac.New(sha256.New, q.pinService.masterKey)
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}

// VerifyTransactionSignature verifies transaction integrity
func (q *OfflineTransactionQueue) VerifyTransactionSignature(txn *OfflineTransaction) bool {
	expectedSig := q.generateTransactionSignature(txn)
	return hmac.Equal([]byte(txn.Signature), []byte(expectedSig))
}

// SecureOfflineStorage provides encrypted local storage

// SecureStorage handles encrypted local storage for offline data
type SecureStorage struct {
	encryptionKey []byte
	storageDir    string
}

// NewSecureStorage creates a new secure storage instance
func NewSecureStorage(encryptionKey []byte, storageDir string) *SecureStorage {
	return &SecureStorage{
		encryptionKey: encryptionKey,
		storageDir:    storageDir,
	}
}

// Store stores data securely
func (s *SecureStorage) Store(key string, data []byte) error {
	block, err := aes.NewCipher(s.encryptionKey)
	if err != nil {
		return err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return err
	}

	encrypted := gcm.Seal(nonce, nonce, data, nil)

	// In production, write to secure file storage
	// For now, just return success
	_ = encrypted
	return nil
}

// Retrieve retrieves data securely
func (s *SecureStorage) Retrieve(key string) ([]byte, error) {
	// In production, read from secure file storage
	return nil, fmt.Errorf("not implemented")
}

// Delete deletes stored data
func (s *SecureStorage) Delete(key string) error {
	// In production, securely delete from storage
	return nil
}

// OfflinePINMigration handles PIN data migration between devices

// MigrationToken represents a token for migrating PIN data
type MigrationToken struct {
	Token     string    `json:"token"`
	UserID    string    `json:"user_id"`
	FromDevice string   `json:"from_device"`
	ToDevice  string    `json:"to_device"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
	Used      bool      `json:"used"`
}

// GenerateMigrationToken generates a token for migrating to a new device
func (s *OfflinePINService) GenerateMigrationToken(ctx context.Context, userID, fromDevice, toDevice string) (*MigrationToken, error) {
	// Generate random token
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return nil, err
	}

	token := &MigrationToken{
		Token:      base64.URLEncoding.EncodeToString(tokenBytes),
		UserID:     userID,
		FromDevice: fromDevice,
		ToDevice:   toDevice,
		CreatedAt:  time.Now(),
		ExpiresAt:  time.Now().Add(15 * time.Minute), // 15 minute validity
		Used:       false,
	}

	// Store in database
	_, err := s.db.Exec(ctx, `
		INSERT INTO pin_migration_tokens (token, user_id, from_device, to_device, created_at, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, token.Token, token.UserID, token.FromDevice, token.ToDevice, token.CreatedAt, token.ExpiresAt)

	if err != nil {
		return nil, err
	}

	return token, nil
}

// ValidateMigrationToken validates and uses a migration token
func (s *OfflinePINService) ValidateMigrationToken(ctx context.Context, token, toDevice string) (bool, error) {
	var migrationToken MigrationToken
	err := s.db.QueryRow(ctx, `
		SELECT token, user_id, from_device, to_device, created_at, expires_at, used
		FROM pin_migration_tokens
		WHERE token = $1
	`, token).Scan(&migrationToken.Token, &migrationToken.UserID, &migrationToken.FromDevice,
		&migrationToken.ToDevice, &migrationToken.CreatedAt, &migrationToken.ExpiresAt, &migrationToken.Used)

	if err != nil {
		return false, fmt.Errorf("token not found")
	}

	if migrationToken.Used {
		return false, fmt.Errorf("token already used")
	}

	if time.Now().After(migrationToken.ExpiresAt) {
		return false, fmt.Errorf("token expired")
	}

	if migrationToken.ToDevice != toDevice {
		return false, fmt.Errorf("device mismatch")
	}

	// Mark token as used
	_, err = s.db.Exec(ctx, `UPDATE pin_migration_tokens SET used = true WHERE token = $1`, token)
	if err != nil {
		return false, err
	}

	return true, nil
}

// Database schema for offline PIN

const OfflinePINSchema = `
-- Offline PIN data storage
CREATE TABLE IF NOT EXISTS offline_pin_data (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    device_id VARCHAR(64) NOT NULL,
    encrypted_pin_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    iv TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    last_sync_at TIMESTAMP NOT NULL DEFAULT NOW(),
    failed_attempts INT DEFAULT 0,
    locked_until TIMESTAMP,
    version INT DEFAULT 1,
    UNIQUE(user_id, device_id)
);

-- PIN migration tokens
CREATE TABLE IF NOT EXISTS pin_migration_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(64) NOT NULL UNIQUE,
    user_id VARCHAR(36) NOT NULL,
    from_device VARCHAR(64) NOT NULL,
    to_device VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE
);

-- Offline transactions pending sync
CREATE TABLE IF NOT EXISTS offline_transactions (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(36) NOT NULL UNIQUE,
    user_id VARCHAR(36) NOT NULL,
    device_id VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    recipient VARCHAR(64),
    description TEXT,
    created_at TIMESTAMP NOT NULL,
    pin_verified_at TIMESTAMP NOT NULL,
    signature TEXT NOT NULL,
    sync_status VARCHAR(16) DEFAULT 'pending',
    sync_attempts INT DEFAULT 0,
    last_sync_attempt TIMESTAMP,
    synced_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_offline_pin_user_device ON offline_pin_data(user_id, device_id);
CREATE INDEX IF NOT EXISTS idx_offline_pin_expires ON offline_pin_data(expires_at);
CREATE INDEX IF NOT EXISTS idx_migration_tokens_expires ON pin_migration_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_offline_txn_sync_status ON offline_transactions(sync_status);
CREATE INDEX IF NOT EXISTS idx_offline_txn_user ON offline_transactions(user_id);
`;
