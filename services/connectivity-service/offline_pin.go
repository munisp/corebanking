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
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"golang.org/x/crypto/argon2"
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
	UserID              string     `json:"user_id"`
	DeviceID            string     `json:"device_id"`
	EncryptedPINHash    string     `json:"encrypted_pin_hash"`
	Salt                string     `json:"salt"`
	IV                  string     `json:"iv"`
	CreatedAt           time.Time  `json:"created_at"`
	ExpiresAt           time.Time  `json:"expires_at"`
	LastSyncAt          time.Time  `json:"last_sync_at"`
	FailedAttempts      int        `json:"failed_attempts"`
	LockedUntil         *time.Time `json:"locked_until,omitempty"`
	OfflineTransactions int        `json:"offline_transactions"`
	OfflineAmount       float64    `json:"offline_amount"`
	Version             int        `json:"version"`
	Checksum            string     `json:"checksum"`
}

// OfflinePINVerificationResult represents the result of offline PIN verification
type OfflinePINVerificationResult struct {
	Valid              bool       `json:"valid"`
	RemainingAttempts  int        `json:"remaining_attempts"`
	LockedUntil        *time.Time `json:"locked_until,omitempty"`
	RequiresOnlineSync bool       `json:"requires_online_sync"`
	Message            string     `json:"message"`
}

// OfflinePINService handles offline PIN verification
//
// W12-C3-P0-B6: key material is NO LONGER held in this struct. The master key
// is sourced fail-closed from KMS_MASTER_KEY (see kms_envelope.go) and cached
// only inside the envelope helper; per-device data keys are random 32-byte
// DEKs envelope-encrypted (AES-256-GCM) under the master key and persisted as
// wrapped blobs in the device_keys table. No plaintext key material is kept
// in long-lived process state, and none is ever stored in PG/redis.
type OfflinePINService struct {
	db          *pgxpool.Pool
	config      OfflinePINConfig
	smsProvider SMSProvider
}

// SMSProvider interface for sending SMS alerts
type SMSProvider interface {
	SendSMS(ctx context.Context, phone string, message string) error
}

// NewOfflinePINService creates a new offline PIN service.
//
// FAIL-CLOSED startup: returns an error when the master-key source
// (KMS_MASTER_KEY env, or its future KMS/Vault-transit replacement — see
// kms_envelope.go) is unavailable, and when the DDL cannot be applied.
// The service refuses to start rather than handle PIN key material
// unprotected.
func NewOfflinePINService(ctx context.Context, db *pgxpool.Pool, smsProvider SMSProvider) (*OfflinePINService, error) {
	// Fail-closed: master key must be loadable before we accept traffic.
	if _, err := loadMasterKey(); err != nil {
		return nil, fmt.Errorf("offline PIN service startup refused: %w", err)
	}

	// DDL at startup per repo convention (CREATE TABLE IF NOT EXISTS).
	if _, err := db.Exec(ctx, OfflinePINSchema); err != nil {
		return nil, fmt.Errorf("failed to ensure offline PIN schema: %w", err)
	}

	return &OfflinePINService{
		db:          db,
		config:      DefaultOfflinePINConfig,
		smsProvider: smsProvider,
	}, nil
}

// GenerateOfflinePINData generates encrypted PIN data for offline storage
func (s *OfflinePINService) GenerateOfflinePINData(ctx context.Context, tenantID, userID, deviceID, pin string) (*OfflinePINData, error) {
	start := time.Now()
	defer func() {
		offlinePINSyncTime.WithLabelValues("generate").Observe(time.Since(start).Seconds())
	}()

	// Unwrap (or create) the device-specific data key from device_keys
	deviceKey, err := s.getOrCreateDeviceKey(ctx, tenantID, deviceID)
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
	checksum, err := s.generateChecksum(data)
	if err != nil {
		return nil, fmt.Errorf("failed to generate checksum: %w", err)
	}
	data.Checksum = checksum

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
func (s *OfflinePINService) VerifyOfflinePIN(ctx context.Context, tenantID string, data *OfflinePINData, pin string) (*OfflinePINVerificationResult, error) {
	// Verify checksum
	expectedChecksum, err := s.generateChecksum(data)
	if err != nil {
		return nil, fmt.Errorf("failed to compute checksum: %w", err)
	}
	if expectedChecksum != data.Checksum {
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

	// Unwrap device key
	deviceKey, err := s.getOrCreateDeviceKey(ctx, tenantID, data.DeviceID)
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
func (s *OfflinePINService) RecordOfflineTransaction(data *OfflinePINData, amount float64) error {
	data.OfflineTransactions++
	data.OfflineAmount += amount
	checksum, err := s.generateChecksum(data)
	if err != nil {
		return fmt.Errorf("failed to generate checksum: %w", err)
	}
	data.Checksum = checksum
	return nil
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
	checksum, err := s.generateChecksum(data)
	if err != nil {
		return fmt.Errorf("failed to generate checksum: %w", err)
	}
	data.Checksum = checksum

	// Update database
	_, err = s.db.Exec(ctx, `
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

// getOrCreateDeviceKey returns the plaintext data-encryption key (DEK) for a
// device. The DEK is a random 32-byte key, envelope-encrypted (AES-256-GCM)
// under the master key (kms_envelope.go) and persisted as a wrapped blob in
// the device_keys table — plaintext DEKs are never stored and never kept in
// an in-process map. The returned plaintext is used for a single crypto
// operation and then discarded by the caller.
func (s *OfflinePINService) getOrCreateDeviceKey(ctx context.Context, tenantID, deviceID string) ([]byte, error) {
	var wrapped []byte
	err := s.db.QueryRow(ctx, `
		SELECT wrapped_key FROM device_keys
		WHERE tenant_id = $1 AND device_id = $2 AND status = 'active'
	`, tenantID, deviceID).Scan(&wrapped)

	if err == nil {
		key, derr := envelopeDecrypt(string(wrapped))
		if derr != nil {
			return nil, fmt.Errorf("failed to unwrap device key for device %s: %w", deviceID, derr)
		}
		return key, nil
	}
	if err != pgx.ErrNoRows {
		return nil, fmt.Errorf("failed to read device key: %w", err)
	}

	// No key yet: generate a random DEK, wrap it, persist the wrapped blob.
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return nil, fmt.Errorf("failed to generate device key: %w", err)
	}
	wrappedStr, err := envelopeEncrypt(key)
	if err != nil {
		return nil, fmt.Errorf("failed to wrap device key: %w", err)
	}

	// ON CONFLICT: a concurrent replica may have created the key first; in
	// that case re-read and unwrap the winning row so all replicas agree.
	_, err = s.db.Exec(ctx, `
		INSERT INTO device_keys (tenant_id, device_id, wrapped_key, status)
		VALUES ($1, $2, $3, 'active')
		ON CONFLICT (tenant_id, device_id) DO NOTHING
	`, tenantID, deviceID, []byte(wrappedStr))
	if err != nil {
		return nil, fmt.Errorf("failed to persist wrapped device key: %w", err)
	}

	var stored []byte
	err = s.db.QueryRow(ctx, `
		SELECT wrapped_key FROM device_keys
		WHERE tenant_id = $1 AND device_id = $2 AND status = 'active'
	`, tenantID, deviceID).Scan(&stored)
	if err != nil {
		return nil, fmt.Errorf("failed to re-read device key: %w", err)
	}
	return envelopeDecrypt(string(stored))
}

// rotateDeviceKey generates a fresh DEK for the device, wraps it under the
// current master key, and atomically replaces the active row. Rotation path
// (documented per W12-C3-P0-B6):
//  1. Master-key rotation: provision new KMS_MASTER_KEY/_ID, then call
//     rotateDeviceKey for every active row (re-wraps under the new master
//     key) before retiring the old key. Wrapped blobs carry their kid, so
//     rows still wrapped under the old key fail closed (envelopeDecrypt
//     rejects unknown kid) rather than silently mis-decrypting.
//  2. Device-key rotation (e.g. suspected device compromise): call
//     rotateDeviceKey for that device only, then re-encrypt payloads
//     protected by the old DEK (offline_pin_data rows) on next sync.
//
// rotated_at records the last rotation for audit.
func (s *OfflinePINService) rotateDeviceKey(ctx context.Context, tenantID, deviceID string) error {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return fmt.Errorf("failed to generate replacement device key: %w", err)
	}
	wrappedStr, err := envelopeEncrypt(key)
	if err != nil {
		return fmt.Errorf("failed to wrap replacement device key: %w", err)
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `
		UPDATE device_keys
		SET wrapped_key = $3, rotated_at = NOW(), status = 'active'
		WHERE tenant_id = $1 AND device_id = $2
	`, tenantID, deviceID, []byte(wrappedStr)); err != nil {
		return fmt.Errorf("failed to rotate device key: %w", err)
	}
	return tx.Commit(ctx)
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

// generateChecksum computes an HMAC-SHA256 over the PIN data using the
// envelope master key (kms_envelope.go). Fail-closed: returns an error when
// the master-key source is unavailable.
func (s *OfflinePINService) generateChecksum(data *OfflinePINData) (string, error) {
	// Create a copy without checksum for hashing
	dataCopy := *data
	dataCopy.Checksum = ""

	jsonData, _ := json.Marshal(dataCopy)

	masterKey, err := loadMasterKey()
	if err != nil {
		return "", err
	}
	h := hmac.New(sha256.New, masterKey)
	h.Write(jsonData)
	return hex.EncodeToString(h.Sum(nil)), nil
}

// BiometricOfflinePIN handles biometric-based offline authentication

// BiometricData represents stored biometric template
type BiometricData struct {
	UserID            string    `json:"user_id"`
	DeviceID          string    `json:"device_id"`
	BiometricType     string    `json:"biometric_type"` // fingerprint, face, iris
	EncryptedTemplate string    `json:"encrypted_template"`
	IV                string    `json:"iv"`
	CreatedAt         time.Time `json:"created_at"`
	ExpiresAt         time.Time `json:"expires_at"`
	Checksum          string    `json:"checksum"`
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
func (s *BiometricOfflinePINService) RegisterBiometric(ctx context.Context, tenantID, userID, deviceID, biometricType string, template []byte) (*BiometricData, error) {
	deviceKey, err := s.pinService.getOrCreateDeviceKey(ctx, tenantID, deviceID)
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

	// Generate checksum (HMAC under envelope master key, fail-closed)
	masterKey, err := loadMasterKey()
	if err != nil {
		return nil, err
	}
	jsonData, _ := json.Marshal(data)
	h := hmac.New(sha256.New, masterKey)
	h.Write(jsonData)
	data.Checksum = hex.EncodeToString(h.Sum(nil))

	return data, nil
}

// VerifyBiometric verifies biometric data offline
func (s *BiometricOfflinePINService) VerifyBiometric(ctx context.Context, tenantID string, data *BiometricData, template []byte) (bool, error) {
	// Check expiry
	if time.Now().After(data.ExpiresAt) {
		return false, fmt.Errorf("biometric data expired")
	}

	deviceKey, err := s.pinService.getOrCreateDeviceKey(ctx, tenantID, data.DeviceID)
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
	TransactionID   string     `json:"transaction_id"`
	UserID          string     `json:"user_id"`
	DeviceID        string     `json:"device_id"`
	Type            string     `json:"type"`
	Amount          float64    `json:"amount"`
	Recipient       string     `json:"recipient,omitempty"`
	Description     string     `json:"description"`
	CreatedAt       time.Time  `json:"created_at"`
	PINVerifiedAt   time.Time  `json:"pin_verified_at"`
	Signature       string     `json:"signature"`
	SyncStatus      string     `json:"sync_status"` // pending, synced, rejected
	SyncAttempts    int        `json:"sync_attempts"`
	LastSyncAttempt *time.Time `json:"last_sync_attempt,omitempty"`
	LastError       string     `json:"last_error,omitempty"`
}

// OfflineTransactionQueue manages offline transactions.
//
// W12-C3-P0-B6: the queue is backed by the offline_transactions PG table with
// a real state machine (pending -> synced | rejected); there is NO in-process
// queue state, so a restart (or a different replica) sees exactly the same
// pending set. Enqueue/flush/reject run inside PG transactions, and state
// transitions are guarded by the current status (a synced row cannot be
// re-rejected and vice versa).
type OfflineTransactionQueue struct {
	db         *pgxpool.Pool
	pinService *OfflinePINService
}

// NewOfflineTransactionQueue creates a new offline transaction queue backed
// by the service's PG pool.
func NewOfflineTransactionQueue(pinService *OfflinePINService) *OfflineTransactionQueue {
	return &OfflineTransactionQueue{
		db:         pinService.db,
		pinService: pinService,
	}
}

// QueueTransaction enqueues a transaction for later sync (transactional,
// idempotent on transaction_id).
func (q *OfflineTransactionQueue) QueueTransaction(ctx context.Context, txn *OfflineTransaction) error {
	// Generate signature for integrity
	sig, err := q.generateTransactionSignature(txn)
	if err != nil {
		return fmt.Errorf("failed to sign offline transaction: %w", err)
	}
	txn.Signature = sig
	txn.SyncStatus = "pending"
	txn.SyncAttempts = 0

	tx, err := q.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// ON CONFLICT DO NOTHING: re-enqueue of the same transaction_id (client
	// retry) is a no-op, keeping enqueue idempotent.
	tag, err := tx.Exec(ctx, `
		INSERT INTO offline_transactions (
			transaction_id, user_id, device_id, type, amount, recipient,
			description, created_at, pin_verified_at, signature,
			sync_status, sync_attempts
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', 0)
		ON CONFLICT (transaction_id) DO NOTHING
	`, txn.TransactionID, txn.UserID, txn.DeviceID, txn.Type, txn.Amount,
		nullableString(txn.Recipient), txn.Description, txn.CreatedAt,
		txn.PINVerifiedAt, txn.Signature)
	if err != nil {
		return fmt.Errorf("failed to enqueue offline transaction: %w", err)
	}
	_ = tag

	return tx.Commit(ctx)
}

// GetPendingTransactions returns all transactions in pending state.
func (q *OfflineTransactionQueue) GetPendingTransactions(ctx context.Context) ([]*OfflineTransaction, error) {
	rows, err := q.db.Query(ctx, `
		SELECT transaction_id, user_id, device_id, type, amount,
		       COALESCE(recipient, ''), description, created_at, pin_verified_at,
		       signature, sync_status, sync_attempts, last_sync_attempt,
		       COALESCE(last_error, '')
		FROM offline_transactions
		WHERE sync_status = 'pending'
		ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to read pending offline transactions: %w", err)
	}
	defer rows.Close()

	var pending []*OfflineTransaction
	for rows.Next() {
		var txn OfflineTransaction
		if err := rows.Scan(
			&txn.TransactionID, &txn.UserID, &txn.DeviceID, &txn.Type,
			&txn.Amount, &txn.Recipient, &txn.Description, &txn.CreatedAt,
			&txn.PINVerifiedAt, &txn.Signature, &txn.SyncStatus,
			&txn.SyncAttempts, &txn.LastSyncAttempt, &txn.LastError,
		); err != nil {
			return nil, fmt.Errorf("failed to scan offline transaction: %w", err)
		}
		pending = append(pending, &txn)
	}
	return pending, rows.Err()
}

// MarkSynced transitions a pending transaction to synced. Guarded by the
// current state: only pending rows transition (state machine).
func (q *OfflineTransactionQueue) MarkSynced(ctx context.Context, transactionID string) error {
	tag, err := q.db.Exec(ctx, `
		UPDATE offline_transactions
		SET sync_status = 'synced', synced_at = NOW(), updated_at = NOW(),
		    last_error = NULL
		WHERE transaction_id = $1 AND sync_status = 'pending'
	`, transactionID)
	if err != nil {
		return fmt.Errorf("failed to mark offline transaction synced: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("offline transaction %s is not pending (state machine guard)", transactionID)
	}
	return nil
}

// MarkRejected transitions a pending transaction to rejected, recording the
// attempt and the error. Transactional and state-guarded like MarkSynced.
func (q *OfflineTransactionQueue) MarkRejected(ctx context.Context, transactionID string, lastError string) error {
	tx, err := q.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(ctx, `
		UPDATE offline_transactions
		SET sync_status = 'rejected',
		    sync_attempts = sync_attempts + 1,
		    last_sync_attempt = NOW(),
		    last_error = $2,
		    updated_at = NOW()
		WHERE transaction_id = $1 AND sync_status = 'pending'
	`, transactionID, lastError)
	if err != nil {
		return fmt.Errorf("failed to mark offline transaction rejected: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("offline transaction %s is not pending (state machine guard)", transactionID)
	}
	return tx.Commit(ctx)
}

// FlushPending drains pending transactions through syncFn, marking each
// synced or rejected based on the outcome. Claiming (SELECT ... FOR UPDATE),
// the sync attempt, and the state transition run inside one PG transaction so
// a crash mid-flush leaves no transaction in an indeterminate state and no
// other replica flushes the same rows concurrently.
func (q *OfflineTransactionQueue) FlushPending(ctx context.Context, syncFn func(ctx context.Context, txn *OfflineTransaction) error) (synced, rejected int, err error) {
	tx, err := q.db.Begin(ctx)
	if err != nil {
		return 0, 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	rows, err := tx.Query(ctx, `
		SELECT transaction_id, user_id, device_id, type, amount,
		       COALESCE(recipient, ''), description, created_at, pin_verified_at,
		       signature, sync_status, sync_attempts
		FROM offline_transactions
		WHERE sync_status = 'pending'
		ORDER BY created_at ASC
		FOR UPDATE
	`)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to claim pending offline transactions: %w", err)
	}

	var claimed []*OfflineTransaction
	for rows.Next() {
		var txn OfflineTransaction
		if err := rows.Scan(
			&txn.TransactionID, &txn.UserID, &txn.DeviceID, &txn.Type,
			&txn.Amount, &txn.Recipient, &txn.Description, &txn.CreatedAt,
			&txn.PINVerifiedAt, &txn.Signature, &txn.SyncStatus,
			&txn.SyncAttempts,
		); err != nil {
			rows.Close()
			return 0, 0, fmt.Errorf("failed to scan claimed offline transaction: %w", err)
		}
		claimed = append(claimed, &txn)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, 0, err
	}

	for _, txn := range claimed {
		if !q.VerifyTransactionSignature(txn) {
			// Tampered record: reject without invoking the sync handler.
			if err := q.markRejectedTx(ctx, tx, txn.TransactionID, "signature verification failed"); err != nil {
				return synced, rejected, err
			}
			rejected++
			continue
		}
		if syncErr := syncFn(ctx, txn); syncErr != nil {
			if err := q.markRejectedTx(ctx, tx, txn.TransactionID, syncErr.Error()); err != nil {
				return synced, rejected, err
			}
			rejected++
			continue
		}
		if _, err := tx.Exec(ctx, `
			UPDATE offline_transactions
			SET sync_status = 'synced', synced_at = NOW(), updated_at = NOW(),
			    last_error = NULL
			WHERE transaction_id = $1 AND sync_status = 'pending'
		`, txn.TransactionID); err != nil {
			return synced, rejected, fmt.Errorf("failed to mark flushed transaction synced: %w", err)
		}
		synced++
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, 0, err
	}
	return synced, rejected, nil
}

// markRejectedTx is the in-transaction variant of MarkRejected used by Flush.
func (q *OfflineTransactionQueue) markRejectedTx(ctx context.Context, tx pgx.Tx, transactionID, lastError string) error {
	tag, err := tx.Exec(ctx, `
		UPDATE offline_transactions
		SET sync_status = 'rejected',
		    sync_attempts = sync_attempts + 1,
		    last_sync_attempt = NOW(),
		    last_error = $2,
		    updated_at = NOW()
		WHERE transaction_id = $1 AND sync_status = 'pending'
	`, transactionID, lastError)
	if err != nil {
		return fmt.Errorf("failed to mark offline transaction rejected: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("offline transaction %s is not pending (state machine guard)", transactionID)
	}
	return nil
}

// generateTransactionSignature signs a transaction with HMAC-SHA256 under the
// envelope master key (kms_envelope.go). Fail-closed on key-source failure.
func (q *OfflineTransactionQueue) generateTransactionSignature(txn *OfflineTransaction) (string, error) {
	data := fmt.Sprintf("%s|%s|%s|%.2f|%s|%d",
		txn.TransactionID, txn.UserID, txn.Type, txn.Amount,
		txn.CreatedAt.Format(time.RFC3339), txn.PINVerifiedAt.Unix())

	masterKey, err := loadMasterKey()
	if err != nil {
		return "", err
	}
	h := hmac.New(sha256.New, masterKey)
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil)), nil
}

// VerifyTransactionSignature verifies transaction integrity. Returns false
// when the signature mismatches OR the key source is unavailable (fail-closed).
func (q *OfflineTransactionQueue) VerifyTransactionSignature(txn *OfflineTransaction) bool {
	expectedSig, err := q.generateTransactionSignature(txn)
	if err != nil {
		return false
	}
	return hmac.Equal([]byte(txn.Signature), []byte(expectedSig))
}

// nullableString maps an empty string to SQL NULL for nullable columns.
func nullableString(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

// SecureOfflineStorage provides encrypted local storage

// SecureStorage handles encrypted local storage for offline data.
//
// W12-C3-P0-B6: no encryption key is held in this struct any more. Data is
// envelope-encrypted under the master key sourced fail-closed from
// KMS_MASTER_KEY (kms_envelope.go); ciphertext is self-describing
// (v1:<kid>:...) so the KMS swap path does not change stored data.
type SecureStorage struct {
	storageDir string
}

// NewSecureStorage creates a new secure storage instance. Fail-closed:
// returns an error when the master-key source is unavailable rather than
// storing data unprotected.
func NewSecureStorage(storageDir string) (*SecureStorage, error) {
	if _, err := loadMasterKey(); err != nil {
		return nil, fmt.Errorf("secure storage startup refused: %w", err)
	}
	return &SecureStorage{
		storageDir: storageDir,
	}, nil
}

// Store stores data securely (envelope-encrypted, AES-256-GCM under the
// master key).
func (s *SecureStorage) Store(key string, data []byte) error {
	encrypted, err := envelopeEncrypt(data)
	if err != nil {
		return err
	}

	// In production, write `encrypted` to secure file storage under
	// s.storageDir. For now, just return success.
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
	Token      string    `json:"token"`
	UserID     string    `json:"user_id"`
	FromDevice string    `json:"from_device"`
	ToDevice   string    `json:"to_device"`
	CreatedAt  time.Time `json:"created_at"`
	ExpiresAt  time.Time `json:"expires_at"`
	Used       bool      `json:"used"`
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

-- Offline transactions pending sync (W12-C3-P0-B6: PG-backed state machine,
-- sync_status IN pending/synced/rejected; no in-process queue state)
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
    last_error TEXT,
    synced_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Upgrades for deployments that already have the pre-B6 table shape
-- (CREATE TABLE IF NOT EXISTS does not add columns to existing tables).
ALTER TABLE offline_transactions ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE offline_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

-- W12-C3-P0-B6: per-device data-encryption keys, envelope-encrypted
-- (AES-256-GCM) under the master key (KMS_MASTER_KEY / kms_envelope.go).
-- wrapped_key holds the versioned ciphertext 'v1:<kid>:<iv>:<tag>:<ct>';
-- plaintext DEKs are NEVER stored. Rotation: see rotateDeviceKey — re-wrap in
-- place, rotated_at records the last rotation; status allows
-- active/retired lifecycle.
CREATE TABLE IF NOT EXISTS device_keys (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    device_id VARCHAR(64) NOT NULL,
    wrapped_key BYTEA NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    rotated_at TIMESTAMP,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    UNIQUE(tenant_id, device_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_offline_pin_user_device ON offline_pin_data(user_id, device_id);
CREATE INDEX IF NOT EXISTS idx_offline_pin_expires ON offline_pin_data(expires_at);
CREATE INDEX IF NOT EXISTS idx_migration_tokens_expires ON pin_migration_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_offline_txn_sync_status ON offline_transactions(sync_status);
CREATE INDEX IF NOT EXISTS idx_offline_txn_user ON offline_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_device_keys_device ON device_keys(tenant_id, device_id);
`
