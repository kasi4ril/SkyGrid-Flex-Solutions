// Package usecases implements core application business logic.
package usecases

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"
)

// KYCUnderwritingRequest contains the customer's Nigerian identity credentials
// and 6-month bank cashflow telemetry from Mono/Okra/SmileID.
type KYCUnderwritingRequest struct {
	CustomerID                  string  `json:"customer_id"`
	NIN                         string  `json:"nin"` // 11-digit National Identification Number
	BVN                         string  `json:"bvn"` // 11-digit Bank Verification Number
	LivenessConfidencePct       float64 `json:"liveness_confidence_pct"`
	CreditBureauScore           int     `json:"credit_bureau_score"`           // CRC / FirstCentral score (300 - 850)
	VerifiedMonthlyInflowKobo   int64   `json:"verified_monthly_inflow_kobo"`  // Average 6-month credit inflow
	ExistingMonthlyDebtKobo     int64   `json:"existing_monthly_debt_kobo"`    // Existing loan obligations
	ProposedSolarInstallmentKobo int64  `json:"proposed_solar_installment_kobo"`
}

// KYCUnderwritingDecision is the deterministic credit risk verdict.
type KYCUnderwritingDecision struct {
	CustomerID             string    `json:"customer_id"`
	NINHash                string    `json:"nin_hash"`
	BVNHash                string    `json:"bvn_hash"`
	Status                 string    `json:"status"` // VERIFIED, MANUAL_REVIEW, REJECTED
	DebtToIncomeRatioPct   float64   `json:"debt_to_income_ratio_pct"`
	MaxAffordableMonthlyKobo int64   `json:"max_affordable_monthly_kobo"`
	DecisionReasons        []string  `json:"decision_reasons"`
	EvaluatedAt            time.Time `json:"evaluated_at"`
}

// KYCUnderwritingService enforces Nigerian solar credit risk policies.
type KYCUnderwritingService struct{}

// NewKYCUnderwritingService constructs a new KYC underwriting engine.
func NewKYCUnderwritingService() *KYCUnderwritingService {
	return &KYCUnderwritingService{}
}

// EvaluateCreditEligibility hashes sensitive PII (NIN/BVN are never stored in plaintext)
// and determines whether the customer qualifies for a 3-to-36 month Growatt lease.
func (k *KYCUnderwritingService) EvaluateCreditEligibility(
	req KYCUnderwritingRequest,
) (*KYCUnderwritingDecision, error) {
	cleanNIN := strings.TrimSpace(req.NIN)
	cleanBVN := strings.TrimSpace(req.BVN)

	if len(cleanNIN) != 11 || len(cleanBVN) != 11 {
		return nil, errors.New("both NIN and BVN must be exactly 11 digits")
	}
	if req.VerifiedMonthlyInflowKobo <= 0 {
		return nil, errors.New("verified_monthly_inflow_kobo must be positive")
	}

	ninHash := hashPII("NIN", cleanNIN)
	bvnHash := hashPII("BVN", cleanBVN)

	totalMonthlyDebt := req.ExistingMonthlyDebtKobo + req.ProposedSolarInstallmentKobo
	dtiPct := math.Round((float64(totalMonthlyDebt)/float64(req.VerifiedMonthlyInflowKobo))*10000.0) / 100.0

	// Maximum 35% of verified monthly inflow may go toward total debt service
	maxAffordableKobo := int64(math.Floor(float64(req.VerifiedMonthlyInflowKobo)*0.35)) - req.ExistingMonthlyDebtKobo
	if maxAffordableKobo < 0 {
		maxAffordableKobo = 0
	}

	status := "VERIFIED"
	var reasons []string

	// Rule 1: Biometric Liveness Check
	if req.LivenessConfidencePct < 90.0 {
		status = "REJECTED"
		reasons = append(reasons, fmt.Sprintf("Biometric liveness confidence (%.1f%%) is below the 90.0%% anti-spoofing threshold.", req.LivenessConfidencePct))
	}

	// Rule 2: Nigerian Credit Bureau Floor (CRC / FirstCentral)
	if req.CreditBureauScore < 520 {
		status = "REJECTED"
		reasons = append(reasons, fmt.Sprintf("Credit Bureau Score (%d) indicates activeperforming defaults (< 520 minimum).", req.CreditBureauScore))
	} else if req.CreditBureauScore < 580 && status != "REJECTED" {
		status = "MANUAL_REVIEW"
		reasons = append(reasons, fmt.Sprintf("Borderline Credit Bureau Score (%d); requires Credit Officer review or 40%% down payment.", req.CreditBureauScore))
	}

	// Rule 3: Debt-to-Income (DTI) Cashflow Ratio
	if dtiPct > 42.0 {
		status = "REJECTED"
		reasons = append(reasons, fmt.Sprintf("Debt-to-Income ratio (%.2f%%) exceeds hard ceiling (42%%). Recommend longer tenure (36m) or smaller 3kVA bundle.", dtiPct))
	} else if dtiPct > 35.0 && status != "REJECTED" {
		status = "MANUAL_REVIEW"
		reasons = append(reasons, fmt.Sprintf("Debt-to-Income ratio (%.2f%%) exceeds standard 35%% auto-approval threshold.", dtiPct))
	}

	if len(reasons) == 0 {
		reasons = append(reasons, "Identity verified and cashflow DTI within safe 35% threshold.")
	}

	return &KYCUnderwritingDecision{
		CustomerID:               req.CustomerID,
		NINHash:                  ninHash,
		BVNHash:                  bvnHash,
		Status:                   status,
		DebtToIncomeRatioPct:     dtiPct,
		MaxAffordableMonthlyKobo: maxAffordableKobo,
		DecisionReasons:          reasons,
		EvaluatedAt:              time.Now().UTC(),
	}, nil
}

func hashPII(prefix, value string) string {
	sum := sha256.Sum256([]byte("SKYTRON_PII_SALT_2026:" + prefix + ":" + value))
	return hex.EncodeToString(sum[:])
}
