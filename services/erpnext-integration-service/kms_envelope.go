package main

// W12-C3-PX (c3-0517): KMS-envelope encryption for ERP connection credentials
// at rest (API keys/secrets, OAuth tokens, webhook secrets stored in
// erp_connections / related tables).
//
// This is a faithful in-service replication of the verified
// connectivity-service envelope implementation (W12-C3-P0-B6,
// services/connectivity-service/kms_envelope.go), itself a Go port of the
// tranche-1 reference infrastructure/new/server/lib/kmsEnvelope.ts.
//
// Design: envelope-encrypt with AES-256-GCM under a master key sourced from
// the KMS_MASTER_KEY environment variable. Ciphertext format is versioned:
//
//	v1:<kid>:<iv_hex>:<tag_hex>:<ct_hex>
//
// so a later swap to a real KMS (Vault transit / AWS KMS / HSM) only requires
// replacing loadMasterKey() + introducing a `v2:` prefix — the storage schema
// (opaque ciphertext columns) does not change.
//
// KMS swap notes:
//   - Replace loadMasterKey() with a data-key decrypt call against the KMS
//     (envelope: KMS-wrapped DEK stored alongside ciphertext) and bump the
//     version prefix. Keep kid for key rotation.
//   - FAIL-CLOSED: encryption/decryption return errors when KMS_MASTER_KEY is
//     unset or malformed; plaintext is never persisted and malformed
//     ciphertext is never returned as plaintext.
//
// Key-source decision (W12-C3-PX): the repo has no shared Go Vault/KMS
// client package (the only Vault reference is documentation in
// platform-hardening-rs; the TS fleet standard is KMS_MASTER_KEY, see
// lib/kmsEnvelope.ts). We therefore follow the fleet TS convention:
// KMS_MASTER_KEY env var, 64 hex chars (32 bytes) preferred; any other
// non-empty value is stretched with scrypt (static per-purpose salt) to
// 32 bytes. In deployment the env var is injected from Vault via
// Kubernetes ServiceAccount -> Vault token (per platform-hardening-rs docs),
// so key material never lives in source, static config, PG, or redis.
//
// This replaces the previous scheme: an ENCRYPTION_KEY env var with a
// hardcoded fallback key literal compiled into the binary. That fallback
// was a repository secret and has been removed (fail-closed instead).
//
// Rotation: KMS_MASTER_KEY_ID identifies the active master key (`kid`).
// To rotate: (1) provision the new key, (2) run with both keys available and
// re-wrap the *_encrypted columns, (3) switch KMS_MASTER_KEY/_ID and restart.
// Old ciphertext carries its kid, so mixed-version rows are detectable and
// fail closed instead of silently mis-decrypting.

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"regexp"
	"strings"
	"sync"

	"golang.org/x/crypto/scrypt"
)

const (
	envelopeVersion   = "v1"
	envelopeSalt      = "54bank-kms-envelope-v1"
	envelopeKeyLength = 32 // AES-256
)

var hexKeyPattern = regexp.MustCompile(`^[0-9a-fA-F]{64}$`)

// masterKeyCache holds the single cached copy of the master key. It is
// loaded once from the environment (fail-closed) and never persisted.
var masterKeyCache struct {
	sync.Mutex
	key []byte
}

func envelopeKeyID() string {
	if kid := os.Getenv("KMS_MASTER_KEY_ID"); kid != "" {
		return kid
	}
	return "kms-master-1"
}

// loadMasterKey returns the cached master key, loading it from KMS_MASTER_KEY
// on first use. Fail-closed: returns an error when the env var is unset or
// empty — callers must never fall back to a generated or hardcoded key.
func loadMasterKey() ([]byte, error) {
	masterKeyCache.Lock()
	defer masterKeyCache.Unlock()

	if masterKeyCache.key != nil {
		return masterKeyCache.key, nil
	}

	raw := os.Getenv("KMS_MASTER_KEY")
	if raw == "" {
		return nil, fmt.Errorf(
			"KMS_MASTER_KEY is not set — refusing to handle ERP connection credentials " +
				"unprotected (envelope encryption is mandatory; see kms_envelope.go for the KMS swap path)")
	}

	var key []byte
	if hexKeyPattern.MatchString(raw) {
		k, err := hex.DecodeString(raw)
		if err != nil {
			return nil, fmt.Errorf("KMS_MASTER_KEY hex decode failed: %w", err)
		}
		key = k
	} else {
		k, err := scrypt.Key([]byte(raw), []byte(envelopeSalt), 32768, 8, 1, envelopeKeyLength)
		if err != nil {
			return nil, fmt.Errorf("KMS_MASTER_KEY stretch failed: %w", err)
		}
		key = k
	}

	masterKeyCache.key = key
	return masterKeyCache.key, nil
}

// envelopeEncrypt encrypts plaintext with AES-256-GCM under the master key.
// Returns versioned ciphertext `v1:<kid>:<iv_hex>:<tag_hex>:<ct_hex>`.
// Fail-closed: errors when no master key is available.
func envelopeEncrypt(plaintext []byte) (string, error) {
	key, err := loadMasterKey()
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	iv := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(iv); err != nil {
		return "", fmt.Errorf("failed to generate envelope IV: %w", err)
	}

	sealed := gcm.Seal(nil, iv, plaintext, nil) // ct || tag
	ct := sealed[:len(sealed)-gcm.Overhead()]
	tag := sealed[len(sealed)-gcm.Overhead():]

	return fmt.Sprintf("%s:%s:%s:%s:%s",
		envelopeVersion, envelopeKeyID(),
		hex.EncodeToString(iv), hex.EncodeToString(tag), hex.EncodeToString(ct)), nil
}

// envelopeDecrypt decrypts versioned envelope ciphertext. Fail-closed:
// malformed input, unknown version/kid, or GCM tag-verification failure all
// return errors; plaintext is never returned for tampered ciphertext.
func envelopeDecrypt(ciphertext string) ([]byte, error) {
	parts := strings.Split(ciphertext, ":")
	if len(parts) != 5 || parts[0] != envelopeVersion {
		return nil, fmt.Errorf("malformed envelope ciphertext — refusing to return plaintext (fail closed)")
	}
	kid, ivHex, tagHex, ctHex := parts[1], parts[2], parts[3], parts[4]

	if kid != envelopeKeyID() {
		return nil, fmt.Errorf("unknown envelope key id %q — cannot decrypt (fail closed)", kid)
	}

	key, err := loadMasterKey()
	if err != nil {
		return nil, err
	}

	iv, err := hex.DecodeString(ivHex)
	if err != nil {
		return nil, fmt.Errorf("malformed envelope IV: %w", err)
	}
	tag, err := hex.DecodeString(tagHex)
	if err != nil {
		return nil, fmt.Errorf("malformed envelope tag: %w", err)
	}
	ct, err := hex.DecodeString(ctHex)
	if err != nil {
		return nil, fmt.Errorf("malformed envelope ciphertext body: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(iv) != gcm.NonceSize() {
		return nil, fmt.Errorf("malformed envelope IV length — refusing to decrypt (fail closed)")
	}

	// GCM auth-tag verification failure returns an error here — it propagates.
	sealed := make([]byte, 0, len(ct)+len(tag))
	sealed = append(sealed, ct...)
	sealed = append(sealed, tag...)
	return gcm.Open(nil, iv, sealed, nil)
}
