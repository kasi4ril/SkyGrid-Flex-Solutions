package usecases_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/payments"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/vfs_store"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/usecases"
)

func TestIdempotentLedgerAndWebhookVerification(t *testing.T) {
	tmpVFS := t.TempDir()
	vfs, err := vfs_store.NewVFSManager(tmpVFS)
	if err != nil {
		t.Fatalf("failed to create VFS: %v", err)
	}

	paystackSecret := "sk_test_paystack_secret_2026"
	paymentEngine := payments.NewMultiRailPaymentEngine(payments.GatewaySecrets{
		PaystackSecretKey:   paystackSecret,
		MoniepointSecretKey: "mk_test_moniepoint_2026",
		OPaySecretKey:       "op_test_opay_2026",
	})

	tokenEngine := usecases.NewOfflineTokenEngine("master-factory-key-2026")
	ledger := usecases.NewLedgerProcessor(vfs, tokenEngine)

	contractID := "CTR-NG-2026-001"
	deviceID := "DEV-8F3A-GROWATT-00421"
	growattSerial := "GW-SPF5000ES-99881"

	// Register a contract with ₦300,000 remaining balance and ₦150,000 monthly installment
	ledger.RegisterContract(usecases.ContractState{
		ContractID:             contractID,
		CustomerID:             "CUST-001",
		CustomerPhone:          "08031234567",
		DeviceID:               deviceID,
		GrowattSerial:          growattSerial,
		TotalPriceKobo:         300000 * 100, // ₦300,000 total for test
		DownPaymentKobo:        0,
		MonthlyInstallmentKobo: 150000 * 100, // ₦150,000 / month
		TenureMonths:           2,
		PaidUntilAt:            time.Now().UTC(),
		Status:                 "ACTIVE",
	})

	// 1. Construct a signed Paystack Webhook Payload for Installment #1 (₦150,000)
	rawWebhook1, _ := json.Marshal(map[string]any{
		"event": "charge.success",
		"data": map[string]any{
			"reference":              "PSTK_TX_REF_99001",
			"amount_kobo":            150000 * 100,
			"currency":               "NGN",
			"channel":                "DEDICATED_NUBAN",
			"contract_id":            contractID,
			"virtual_account_number": "9938471029",
			"paid_at":                time.Now().UTC().Format(time.RFC3339),
		},
	})

	// Test invalid HMAC signature rejection
	if _, err := paymentEngine.VerifyAndNormalizeWebhook(payments.ProviderPaystack, "forged_signature", rawWebhook1); err == nil {
		t.Fatal("expected forged HMAC signature to be rejected")
	}

	// Test valid HMAC-SHA512 signature verification
	validSig1 := payments.ComputeWebhookSignature(paystackSecret, rawWebhook1)
	evt1, err := paymentEngine.VerifyAndNormalizeWebhook(payments.ProviderPaystack, validSig1, rawWebhook1)
	if err != nil {
		t.Fatalf("VerifyAndNormalizeWebhook failed: %v", err)
	}

	// 2. Process Payment #1 and verify 30 days (2,592,000 seconds) granted
	res1, err := ledger.ProcessVerifiedPayment(*evt1)
	if err != nil {
		t.Fatalf("ProcessVerifiedPayment #1 failed: %v", err)
	}
	if res1.IdempotentReplay {
		t.Fatal("expected first execution not to be marked as replay")
	}
	if res1.LedgerEntry.EnergySecondsDelta != usecases.SecondsPerBillingMonth {
		t.Errorf("expected %d energy seconds, got %d", usecases.SecondsPerBillingMonth, res1.LedgerEntry.EnergySecondsDelta)
	}

	// 3. Replay the EXACT same webhook 3 times to test Idempotency Guardrail
	for i := 0; i < 3; i++ {
		replayRes, err := ledger.ProcessVerifiedPayment(*evt1)
		if err != nil {
			t.Fatalf("idempotent replay failed: %v", err)
		}
		if !replayRes.IdempotentReplay {
			t.Fatalf("expected replay flag true on duplicate webhook attempt %d", i+1)
		}
		if replayRes.TotalPaidToDateKobo != 150000*100 {
			t.Fatalf("double-crediting bug detected! TotalPaidToDateKobo = %d", replayRes.TotalPaidToDateKobo)
		}
	}

	// 4. Verify the 20-Digit Offline Keypad/BLE Token on the Simulated Growatt Edge Controller
	tokenCode := res1.OfflineUnlockToken.Formatted20DigitCode
	newCounter, grantedSec, err := tokenEngine.VerifyTokenOnEdge(deviceID, growattSerial, 0, tokenCode)
	if err != nil {
		t.Fatalf("edge token verification failed for %s: %v", tokenCode, err)
	}
	if grantedSec != usecases.SecondsPerBillingMonth {
		t.Errorf("expected edge token to grant %d seconds, got %d", usecases.SecondsPerBillingMonth, grantedSec)
	}

	// Verify that entering the same 20-digit token a second time on the inverter keypad is rejected
	if _, _, err := tokenEngine.VerifyTokenOnEdge(deviceID, growattSerial, newCounter, tokenCode); err == nil {
		t.Fatal("expected edge controller to reject replayed 20-digit token")
	}

	// 5. Process Final Installment #2 (₦150,000) and verify automatic transition to FULLY_OWNED
	rawWebhook2, _ := json.Marshal(map[string]any{
		"event": "charge.success",
		"data": map[string]any{
			"reference":   "MNFY_TX_REF_99002",
			"amount_kobo": 150000 * 100,
			"contract_id": contractID,
		},
	})
	validSig2 := payments.ComputeWebhookSignature(paystackSecret, rawWebhook2)
	evt2, _ := paymentEngine.VerifyAndNormalizeWebhook(payments.ProviderPaystack, validSig2, rawWebhook2)
	res2, err := ledger.ProcessVerifiedPayment(*evt2)
	if err != nil {
		t.Fatalf("ProcessVerifiedPayment #2 failed: %v", err)
	}
	if res2.UpdatedContract.Status != "FULLY_OWNED" {
		t.Errorf("expected contract status FULLY_OWNED upon full amortization, got %s", res2.UpdatedContract.Status)
	}
}

func TestNigerianKYCUnderwriting(t *testing.T) {
	kyc := usecases.NewKYCUnderwritingService()

	decision, err := kyc.EvaluateCreditEligibility(usecases.KYCUnderwritingRequest{
		CustomerID:                   "CUST-NG-101",
		NIN:                          "12345678901",
		BVN:                          "22345678901",
		LivenessConfidencePct:        98.5,
		CreditBureauScore:            670,
		VerifiedMonthlyInflowKobo:    650000 * 100, // ₦650,000/month salary/business inflow
		ExistingMonthlyDebtKobo:      40000 * 100,
		ProposedSolarInstallmentKobo: 125000 * 100, // Total debt = ₦165k / ₦650k = 25.38% DTI (< 35%)
	})
	if err != nil {
		t.Fatalf("EvaluateCreditEligibility failed: %v", err)
	}
	if decision.Status != "VERIFIED" {
		t.Errorf("expected VERIFIED status for healthy DTI, got %s (%v)", decision.Status, decision.DecisionReasons)
	}
}