// Package payments provides cryptographic verification and idempotency enforcement
// for Nigerian payment gateways (Moniepoint, Paystack, OPay).
package payments

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"errors"
	"strings"
	"sync"
	"time"
)

var (
	// ErrDuplicateWebhook is returned when a webhook transaction reference has already been processed.
	ErrDuplicateWebhook = errors.New("duplicate webhook transaction reference: replay attempt rejected")
	// ErrInvalidSignature is returned when HMAC comparison fails.
	ErrInvalidSignature = errors.New("invalid cryptographic webhook signature")
)

// WebhookVerifier coordinates signature validation and transaction reference replay prevention.
type WebhookVerifier struct {
	mu            sync.RWMutex
	processedRefs map[string]time.Time
}

// NewWebhookVerifier instantiates a thread-safe webhook verifier with idempotency tracking.
func NewWebhookVerifier() *WebhookVerifier {
	return &WebhookVerifier{
		processedRefs: make(map[string]time.Time),
	}
}

// Global default verifier singleton for package-level convenience functions.
var defaultVerifier = NewWebhookVerifier()

// VerifyMoniepointSignature validates that the raw payload matches Moniepoint's
// HMAC-SHA512 signature header in constant time to prevent timing attacks.
func VerifyMoniepointSignature(payload []byte, signatureHeader string, secret string) bool {
	return verifyHmacSha512(payload, signatureHeader, secret)
}

// VerifyPaystackSignature validates that the raw payload matches Paystack's
// HMAC-SHA512 x-paystack-signature header in constant time.
func VerifyPaystackSignature(payload []byte, signatureHeader string, secret string) bool {
	return verifyHmacSha512(payload, signatureHeader, secret)
}

// CheckAndRecordWebhookReference checks whether a transaction reference has already
// been recorded. If it is new, it records it and returns true. If it was already
// processed, it returns false (replay rejected) to ensure customers are never double-credited.
func CheckAndRecordWebhookReference(ref string) bool {
	return defaultVerifier.CheckAndRecordWebhookReference(ref)
}

// CheckAndRecordWebhookReference checks and records idempotency on the verifier instance.
func (v *WebhookVerifier) CheckAndRecordWebhookReference(ref string) bool {
	cleanRef := strings.TrimSpace(ref)
	if cleanRef == "" {
		return false
	}

	v.mu.Lock()
	defer v.mu.Unlock()

	if _, exists := v.processedRefs[cleanRef]; exists {
		return false // Duplicate transaction reference
	}

	v.processedRefs[cleanRef] = time.Now().UTC()
	return true
}

// IsReferenceProcessed checks whether a transaction reference has been processed.
func (v *WebhookVerifier) IsReferenceProcessed(ref string) bool {
	v.mu.RLock()
	defer v.mu.RUnlock()
	_, exists := v.processedRefs[strings.TrimSpace(ref)]
	return exists
}

// Reset clears the processed references cache (primarily used in test suites).
func (v *WebhookVerifier) Reset() {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.processedRefs = make(map[string]time.Time)
}

// Helper to compute and compare HMAC-SHA512 in constant time.
func verifyHmacSha512(payload []byte, signatureHeader, secret string) bool {
	if len(payload) == 0 || strings.TrimSpace(secret) == "" || strings.TrimSpace(signatureHeader) == "" {
		return false
	}

	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write(payload)
	expectedHex := hex.EncodeToString(mac.Sum(nil))

	cleanSig := strings.ToLower(strings.TrimSpace(signatureHeader))
	return hmac.Equal([]byte(cleanSig), []byte(strings.ToLower(expectedHex)))
}
