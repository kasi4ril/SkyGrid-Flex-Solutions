// Package usecases implements core application business logic.
package usecases

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/payments"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/vfs_store"
)

// SecondsPerBillingMonth is the standard 30-day energy credit window (2,592,000 seconds).
const SecondsPerBillingMonth int64 = 30 * 24 * 3600

// ContractState represents the active PAYG contract record managed by the ledger engine.
type ContractState struct {
	ContractID             string    `json:"contract_id"`
	CustomerID             string    `json:"customer_id"`
	CustomerPhone          string    `json:"customer_phone"`
	DeviceID               string    `json:"device_id"`
	GrowattSerial          string    `json:"growatt_serial"`
	TotalPriceKobo         int64     `json:"total_price_kobo"`
	DownPaymentKobo        int64     `json:"down_payment_kobo"`
	MonthlyInstallmentKobo int64     `json:"monthly_installment_kobo"`
	TenureMonths           int       `json:"tenure_months"`
	PaidUntilAt            time.Time `json:"paid_until_at"`
	Status                 string    `json:"status"` // ACTIVE, GRACE_PERIOD, LOCKED_DEFAULT, LOCKED_TAMPER, FULLY_OWNED
	OfflineTokenCounter    int64     `json:"offline_token_counter"`
}

// ImmutableLedgerEntry models a single append-only row in the ledger_entries table.
type ImmutableLedgerEntry struct {
	ID                 string            `json:"id"`
	ContractID         string            `json:"contract_id"`
	Provider           payments.Provider `json:"provider"`
	IdempotencyTxRef   string            `json:"idempotency_tx_ref"`
	EntryType          string            `json:"entry_type"` // CREDIT or DEBIT
	AmountKobo         int64             `json:"amount_kobo"`
	EnergySecondsDelta int64             `json:"energy_seconds_delta"`
	OfflineTokenCode   string            `json:"offline_token_code"`
	CreatedAt          time.Time         `json:"created_at"`
}

// PaymentProcessingResult is returned after an ACID webhook transaction completes.
type PaymentProcessingResult struct {
	IdempotentReplay     bool                  `json:"idempotent_replay"`
	LedgerEntry          ImmutableLedgerEntry  `json:"ledger_entry"`
	UpdatedContract      ContractState         `json:"updated_contract"`
	TotalPaidToDateKobo  int64                 `json:"total_paid_to_date_kobo"`
	RemainingBalanceKobo int64                 `json:"remaining_balance_kobo"`
	OfflineUnlockToken   *OfflineUnlockToken   `json:"offline_unlock_token"`
}

// LedgerProcessor coordinates idempotent double-entry accounting, credit countdown
// extensions, offline token generation, and atomic VFS snapshot synchronization.
type LedgerProcessor struct {
	mu          sync.Mutex
	vfs         *vfs_store.VFSManager
	tokenEngine *OfflineTokenEngine
	contracts   map[string]*ContractState
	entriesByTx map[string]ImmutableLedgerEntry
	entriesByCt map[string][]ImmutableLedgerEntry
}

// NewLedgerProcessor initializes the ledger engine with VFS and Offline Token support.
func NewLedgerProcessor(vfs *vfs_store.VFSManager, tokenEngine *OfflineTokenEngine) *LedgerProcessor {
	return &LedgerProcessor{
		vfs:         vfs,
		tokenEngine: tokenEngine,
		contracts:   make(map[string]*ContractState),
		entriesByTx: make(map[string]ImmutableLedgerEntry),
		entriesByCt: make(map[string][]ImmutableLedgerEntry),
	}
}

// RegisterContract registers or seeds a contract into the ledger engine.
func (lp *LedgerProcessor) RegisterContract(c ContractState) {
	lp.mu.Lock()
	defer lp.mu.Unlock()
	cp := c
	lp.contracts[c.ContractID] = &cp
}

// ProcessVerifiedPayment executes the idempotent ACID payment state machine:
// 1. Checks idempotency_tx_ref; if already processed, returns the existing ledger record without double-crediting.
// 2. Calculates exact energy_seconds_delta proportional to the contract's monthly installment.
// 3. Appends an immutable CREDIT entry and computes cumulative balance from append-only history.
// 4. Advances paid_until_at (or permanently unlocks to FULLY_OWNED if 100% amortized).
// 5. Generates a 20-digit Offline Unlock Token and atomically updates VFS ledger_snap.json + state.json.
func (lp *LedgerProcessor) ProcessVerifiedPayment(
	evt payments.NormalizedWebhookEvent,
) (*PaymentProcessingResult, error) {
	lp.mu.Lock()
	defer lp.mu.Unlock()

	if evt.IdempotencyTxRef == "" {
		return nil, errors.New("idempotency_tx_ref cannot be empty")
	}

	// 1. Idempotency Guardrail: Return existing entry if webhook was already processed
	if existingEntry, exists := lp.entriesByTx[evt.IdempotencyTxRef]; exists {
		c := lp.contracts[existingEntry.ContractID]
		totalPaid := lp.sumCreditsLocked(existingEntry.ContractID)
		remBal := maxInt64(0, c.TotalPriceKobo-totalPaid)
		return &PaymentProcessingResult{
			IdempotentReplay:     true,
			LedgerEntry:          existingEntry,
			UpdatedContract:      *c,
			TotalPaidToDateKobo:  totalPaid,
			RemainingBalanceKobo: remBal,
		}, nil
	}

	contract, ok := lp.contracts[evt.ContractID]
	if !ok {
		return nil, fmt.Errorf("contract %s not found", evt.ContractID)
	}

	if contract.MonthlyInstallmentKobo <= 0 {
		return nil, errors.New("contract monthly_installment_kobo must be > 0")
	}

	// 2. Convert cleared Kobo into exact active_energy_seconds
	// Formula: EnergySeconds = (AmountKobo / MonthlyInstallmentKobo) * 2,592,000 seconds (30 days)
	ratio := float64(evt.AmountKobo) / float64(contract.MonthlyInstallmentKobo)
	energySecondsDelta := int64(math.Round(ratio * float64(SecondsPerBillingMonth)))
	if energySecondsDelta <= 0 {
		energySecondsDelta = 3600 // Minimum 1 hour credit for micro-payments
	}

	// 3. Increment monotonic offline token counter & generate 20-digit keypad/BLE unlock code
	contract.OfflineTokenCounter++
	offlineToken, err := lp.tokenEngine.GenerateToken(
		contract.ContractID,
		contract.DeviceID,
		contract.GrowattSerial,
		contract.OfflineTokenCounter,
		energySecondsDelta,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to generate offline unlock token: %w", err)
	}

	// 4. Append Immutable Ledger Entry (NEVER overwrite raw balance columns)
	entry := ImmutableLedgerEntry{
		ID:                 generateUUID(),
		ContractID:         contract.ContractID,
		Provider:           evt.Provider,
		IdempotencyTxRef:   evt.IdempotencyTxRef,
		EntryType:          "CREDIT",
		AmountKobo:         evt.AmountKobo,
		EnergySecondsDelta: energySecondsDelta,
		OfflineTokenCode:   offlineToken.Formatted20DigitCode,
		CreatedAt:          time.Now().UTC(),
	}

	lp.entriesByTx[evt.IdempotencyTxRef] = entry
	lp.entriesByCt[contract.ContractID] = append(lp.entriesByCt[contract.ContractID], entry)

	// 5. Compute Total Cumulative Paid from Immutable Ledger History
	totalPaidKobo := lp.sumCreditsLocked(contract.ContractID)
	remainingBalanceKobo := maxInt64(0, contract.TotalPriceKobo-totalPaidKobo)

	now := time.Now().UTC()
	// If contract was expired/locked in the past, start adding new time from NOW
	// If contract still had active time remaining, add to existing PaidUntilAt
	baseTime := contract.PaidUntilAt
	if baseTime.Before(now) {
		baseTime = now
	}
	contract.PaidUntilAt = baseTime.Add(time.Duration(energySecondsDelta) * time.Second)

	// 6. Evaluate Contract Status Transition (Check for 36th Payment / Full Ownership)
	if remainingBalanceKobo == 0 {
		contract.Status = "FULLY_OWNED"
		// Permanent 100-year unlock horizon so the edge dead-man's switch never locks again
		contract.PaidUntilAt = now.AddDate(100, 0, 0)
	} else if contract.Status != "LOCKED_TAMPER" {
		// Note: A tampered lower shroud cannot be unlocked merely by paying; it requires field inspection.
		// All other states (PENDING_INSTALL, GRACE_PERIOD, LOCKED_DEFAULT) transition to ACTIVE.
		contract.Status = "ACTIVE"
	}

	// 7. Atomically synchronize ledger_snap.json in the POSIX VFS
	paidDaysRemaining := math.Max(0, contract.PaidUntilAt.Sub(now).Hours()/24.0)
	snap := vfs_store.LedgerSnapshot{
		ContractID:           contract.ContractID,
		DeviceID:             contract.DeviceID,
		ContractStatus:       contract.Status,
		PaidDaysRemaining:    math.Round(paidDaysRemaining*100) / 100,
		PaidUntilISO:         contract.PaidUntilAt.Format(time.RFC3339),
		TotalPaidKobo:        totalPaidKobo,
		RemainingBalanceKobo: remainingBalanceKobo,
		NextInstallmentKobo:  contract.MonthlyInstallmentKobo,
		LastTxRef:            evt.IdempotencyTxRef,
		LastOfflineToken:     offlineToken.Formatted20DigitCode,
		UpdatedAt:            now.Format(time.RFC3339),
	}

	if lp.vfs != nil {
		if err := lp.vfs.WriteLedgerSnapshot(contract.DeviceID, snap); err != nil {
			return nil, fmt.Errorf("failed to sync VFS ledger_snap.json: %w", err)
		}
	}

	return &PaymentProcessingResult{
		IdempotentReplay:     false,
		LedgerEntry:          entry,
		UpdatedContract:      *contract,
		TotalPaidToDateKobo:  totalPaidKobo,
		RemainingBalanceKobo: remainingBalanceKobo,
		OfflineUnlockToken:   offlineToken,
	}, nil
}

// ListActiveContracts returns a snapshot of all registered contracts for the Cron Scheduler.
func (lp *LedgerProcessor) ListActiveContracts() []ContractState {
	lp.mu.Lock()
	defer lp.mu.Unlock()
	out := make([]ContractState, 0, len(lp.contracts))
	for _, c := range lp.contracts {
		out = append(out, *c)
	}
	return out
}

// UpdateContractStatus transitions a contract's status (used by the Cron Scheduler).
func (lp *LedgerProcessor) UpdateContractStatus(contractID, newStatus string) error {
	lp.mu.Lock()
	defer lp.mu.Unlock()
	c, ok := lp.contracts[contractID]
	if !ok {
		return fmt.Errorf("contract %s not found", contractID)
	}
	c.Status = newStatus
	return nil
}

func (lp *LedgerProcessor) sumCreditsLocked(contractID string) int64 {
	var sum int64
	for _, e := range lp.entriesByCt[contractID] {
		if e.EntryType == "CREDIT" {
			sum += e.AmountKobo
		} else if e.EntryType == "DEBIT" {
			sum -= e.AmountKobo
		}
	}
	return sum
}

func maxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

func generateUUID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}
