package payments

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"testing"
)

func TestVerifyMoniepointSignature(t *testing.T) {
	secret := "test_moniepoint_secret_key_5519"
	payload := []byte(`{"event":"SUCCESSFUL_TRANSACTION","data":{"reference":"MNFY-2026-001","amount_kobo":14500000}}`)

	// Compute valid signature
	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write(payload)
	validSig := hex.EncodeToString(mac.Sum(nil))

	// 1. Valid signature passes
	if !VerifyMoniepointSignature(payload, validSig, secret) {
		t.Errorf("expected valid Moniepoint signature to pass")
	}

	// 2. Tampered payload fails
	tamperedPayload := []byte(`{"event":"SUCCESSFUL_TRANSACTION","data":{"reference":"MNFY-2026-001","amount_kobo":99999999}}`)
	if VerifyMoniepointSignature(tamperedPayload, validSig, secret) {
		t.Errorf("expected tampered payload to fail signature check")
	}

	// 3. Invalid secret fails
	if VerifyMoniepointSignature(payload, validSig, "wrong_secret_key") {
		t.Errorf("expected wrong secret key to fail signature check")
	}

	// 4. Empty payload or secret fails
	if VerifyMoniepointSignature(nil, validSig, secret) {
		t.Errorf("expected nil payload to fail")
	}
	if VerifyMoniepointSignature(payload, "", secret) {
		t.Errorf("expected empty signature header to fail")
	}
}

func TestVerifyPaystackSignature(t *testing.T) {
	secret := "sk_test_paystack_secret_9941"
	payload := []byte(`{"event":"charge.success","data":{"reference":"PSTK-REF-8841","amount":3500000}}`)

	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write(payload)
	validSig := hex.EncodeToString(mac.Sum(nil))

	// 1. Valid signature passes
	if !VerifyPaystackSignature(payload, validSig, secret) {
		t.Errorf("expected valid Paystack signature to pass")
	}

	// 2. Tampered signature fails
	invalidSig := validSig[:len(validSig)-4] + "abcd"
	if VerifyPaystackSignature(payload, invalidSig, secret) {
		t.Errorf("expected tampered signature to fail")
	}
}

func TestCheckAndRecordWebhookReference_Idempotency(t *testing.T) {
	verifier := NewWebhookVerifier()
	ref := "TX-UNIQUE-NUBAN-2026-88192"

	// 1. First presentation of reference must be accepted
	if !verifier.CheckAndRecordWebhookReference(ref) {
		t.Fatalf("expected first presentation of reference %q to be accepted", ref)
	}

	// 2. Immediate duplicate replay must be rejected
	if verifier.CheckAndRecordWebhookReference(ref) {
		t.Fatalf("expected duplicate presentation of reference %q to be rejected (replay attack/retry)", ref)
	}

	// 3. Different reference must be accepted
	otherRef := "TX-UNIQUE-NUBAN-2026-88193"
	if !verifier.CheckAndRecordWebhookReference(otherRef) {
		t.Fatalf("expected different reference %q to be accepted", otherRef)
	}

	// 4. Empty reference must be rejected
	if verifier.CheckAndRecordWebhookReference("   ") {
		t.Fatalf("expected whitespace/empty reference to be rejected")
	}

	// 5. Global helper test
	defaultVerifier.Reset()
	globalRef := "GLOBAL-TX-REF-100"
	if !CheckAndRecordWebhookReference(globalRef) {
		t.Errorf("expected global CheckAndRecordWebhookReference to accept new ref")
	}
	if CheckAndRecordWebhookReference(globalRef) {
		t.Errorf("expected global CheckAndRecordWebhookReference to reject duplicate ref")
	}
}
