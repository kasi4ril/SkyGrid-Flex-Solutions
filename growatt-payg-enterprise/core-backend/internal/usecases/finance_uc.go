// Package usecases implements core application business logic.
package usecases

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/payments"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/repositories"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/domain"
)

var (
	ErrInvoiceAlreadyPaid   = errors.New("invoice is already fully paid")
	ErrPaymentAlreadyProcessed = errors.New("payment has already been verified or rejected")
	ErrInvalidPaymentAmount = errors.New("payment amount must be greater than zero")
)

type FinanceService struct {
	erpRepo         repositories.ERPRepository
	ledgerProcessor *LedgerProcessor
	tokenEngine     *OfflineTokenEngine
}

func NewFinanceService(
	erpRepo repositories.ERPRepository,
	ledgerProcessor *LedgerProcessor,
	tokenEngine *OfflineTokenEngine,
) *FinanceService {
	return &FinanceService{
		erpRepo:         erpRepo,
		ledgerProcessor: ledgerProcessor,
		tokenEngine:     tokenEngine,
	}
}

// ----------------------------------------------------------------------------
// Invoicing Engine
// ----------------------------------------------------------------------------

type CreateInvoiceDTO struct {
	CustomerID    string `json:"customer_id"`
	CustomerName  string `json:"customer_name"`
	CustomerEmail string `json:"customer_email"`
	RelatedType   string `json:"related_type"` // INSTALLATION, MAINTENANCE, CONTRACT, RECHARGE
	RelatedID     string `json:"related_id"`
	AmountKobo    int64  `json:"amount_kobo"`
	DueDays       int    `json:"due_days"`
}

func (s *FinanceService) CreateInvoice(ctx context.Context, dto CreateInvoiceDTO) (*domain.Invoice, error) {
	if dto.AmountKobo <= 0 {
		return nil, ErrInvalidPaymentAmount
	}
	if strings.TrimSpace(dto.CustomerName) == "" {
		return nil, errors.New("customer_name is required")
	}

	dueDays := dto.DueDays
	if dueDays <= 0 {
		dueDays = 14
	}

	invNumber := fmt.Sprintf("INV-2026-%s", strings.ToUpper(newRandomTokenHex(3)))

	invoice := &domain.Invoice{
		InvoiceNumber:  invNumber,
		CustomerID:     dto.CustomerID,
		CustomerName:   dto.CustomerName,
		CustomerEmail:  dto.CustomerEmail,
		RelatedType:    dto.RelatedType,
		RelatedID:      dto.RelatedID,
		AmountKobo:     dto.AmountKobo,
		PaidAmountKobo: 0,
		Status:         domain.InvoiceStatusIssued,
		DueDate:        time.Now().UTC().Add(time.Duration(dueDays) * 24 * time.Hour),
	}

	if err := s.erpRepo.CreateInvoice(ctx, invoice); err != nil {
		return nil, fmt.Errorf("failed to create invoice: %w", err)
	}

	return invoice, nil
}

func (s *FinanceService) GetInvoice(ctx context.Context, id string) (*domain.Invoice, error) {
	return s.erpRepo.GetInvoiceByID(ctx, id)
}

func (s *FinanceService) ListInvoices(ctx context.Context, status, customerID string) ([]domain.Invoice, error) {
	return s.erpRepo.ListInvoices(ctx, status, customerID)
}

// ----------------------------------------------------------------------------
// Payment Ingestion & Verification Queue
// ----------------------------------------------------------------------------

type RecordPaymentDTO struct {
	PaymentReference    string `json:"payment_reference"`
	CustomerID          string `json:"customer_id"`
	CustomerName        string `json:"customer_name"`
	InvoiceID           string `json:"invoice_id"`
	AmountKobo          int64  `json:"amount_kobo"`
	PaymentMethod       string `json:"payment_method"`
	BankTellerReference string `json:"bank_teller_ref,omitempty"`
	BankName            string `json:"bank_name,omitempty"`
	AutoVerify          bool   `json:"auto_verify"` // True for webhook-cleared instant rail transfers
}

type PaymentVerificationResult struct {
	Payment            domain.FinancePayment `json:"payment"`
	Invoice            *domain.Invoice       `json:"invoice,omitempty"`
	STSTokenIssued     string                `json:"sts_token_issued,omitempty"`
	CreditDaysExtended float64               `json:"credit_days_extended"`
}

func (s *FinanceService) RecordInboundPayment(ctx context.Context, dto RecordPaymentDTO) (*domain.FinancePayment, error) {
	if dto.AmountKobo <= 0 {
		return nil, ErrInvalidPaymentAmount
	}

	ref := dto.PaymentReference
	if strings.TrimSpace(ref) == "" {
		ref = fmt.Sprintf("PAY-REF-%s", strings.ToUpper(newRandomTokenHex(4)))
	}

	status := domain.PaymentStatusPendingVerification
	var verifiedAt *time.Time
	if dto.AutoVerify {
		status = domain.PaymentStatusVerified
		now := time.Now().UTC()
		verifiedAt = &now
	}

	payment := &domain.FinancePayment{
		PaymentReference:    ref,
		CustomerID:          dto.CustomerID,
		CustomerName:        dto.CustomerName,
		InvoiceID:           dto.InvoiceID,
		AmountKobo:          dto.AmountKobo,
		PaymentMethod:       dto.PaymentMethod,
		BankTellerReference: dto.BankTellerReference,
		BankName:            dto.BankName,
		Status:              status,
		VerifiedAt:          verifiedAt,
	}

	if err := s.erpRepo.CreateFinancePayment(ctx, payment); err != nil {
		return nil, fmt.Errorf("failed to record payment: %w", err)
	}

	return payment, nil
}

// VerifyPayment verifies a pending bank transfer or DVA payment, updates linked invoices,
// generates STS tokens for contract extensions, and updates VFS state.
func (s *FinanceService) VerifyPayment(
	ctx context.Context,
	paymentID string,
	verifiedByUserID string,
	contractID string,
	deviceID string,
	growattSerial string,
) (*PaymentVerificationResult, error) {
	payment, err := s.erpRepo.GetFinancePaymentByID(ctx, paymentID)
	if err != nil {
		return nil, err
	}

	if payment.Status != domain.PaymentStatusPendingVerification {
		return nil, ErrPaymentAlreadyProcessed
	}

	now := time.Now().UTC()
	payment.Status = domain.PaymentStatusVerified
	payment.VerifiedByUserID = verifiedByUserID
	payment.VerifiedAt = &now

	result := &PaymentVerificationResult{
		Payment: *payment,
	}

	// 1. Reconcile with Invoice if attached
	if payment.InvoiceID != "" {
		inv, err := s.erpRepo.GetInvoiceByID(ctx, payment.InvoiceID)
		if err == nil {
			inv.PaidAmountKobo += payment.AmountKobo
			if inv.PaidAmountKobo >= inv.AmountKobo {
				inv.Status = domain.InvoiceStatusPaid
			} else {
				inv.Status = domain.InvoiceStatusPartiallyPaid
			}
			_ = s.erpRepo.UpdateInvoice(ctx, inv)
			result.Invoice = inv
		}
	}

	// 2. Generate STS Token & Extend Credit Clock if linked to active contract/device
	if contractID != "" && deviceID != "" && s.tokenEngine != nil && s.ledgerProcessor != nil {
		// Calculate energy hours proportional to amount: standard installment rate 145,000 NGN = 30 days
		daysExtended := float64(payment.AmountKobo) / (145000.0 * 100.0) * 30.0
		if daysExtended < 1.0 {
			daysExtended = 1.0
		}
		energySeconds := int64(daysExtended * 24 * 3600)

		token, err := s.tokenEngine.GenerateToken(
			contractID,
			deviceID,
			growattSerial,
			time.Now().Unix()%9000+1000,
			energySeconds,
		)
		if err == nil && token != nil {
			payment.STSTokenIssued = token.Formatted20DigitCode
			payment.CreditDaysExtended = daysExtended
			result.STSTokenIssued = token.Formatted20DigitCode
			result.CreditDaysExtended = daysExtended

			// Forward to LedgerProcessor for atomic VFS ledger_snap.json sync
			_, _ = s.ledgerProcessor.ProcessVerifiedPayment(payments.NormalizedWebhookEvent{
				Provider:         payments.ProviderMoniepoint,
				ContractID:       contractID,
				AmountKobo:       payment.AmountKobo,
				IdempotencyTxRef: payment.PaymentReference,
				PaidAt:           now,
				Currency:         "NGN",
			})
		}
	}

	if err := s.erpRepo.UpdateFinancePayment(ctx, payment); err != nil {
		return nil, fmt.Errorf("failed to update payment record: %w", err)
	}
	result.Payment = *payment

	return result, nil
}

func (s *FinanceService) RejectPayment(
	ctx context.Context,
	paymentID string,
	reason string,
	rejectedByUserID string,
) (*domain.FinancePayment, error) {
	payment, err := s.erpRepo.GetFinancePaymentByID(ctx, paymentID)
	if err != nil {
		return nil, err
	}

	if payment.Status != domain.PaymentStatusPendingVerification {
		return nil, ErrPaymentAlreadyProcessed
	}

	payment.Status = domain.PaymentStatusRejected
	payment.VerifiedByUserID = rejectedByUserID
	payment.RejectionReason = reason
	payment.UpdatedAt = time.Now().UTC()

	if err := s.erpRepo.UpdateFinancePayment(ctx, payment); err != nil {
		return nil, fmt.Errorf("failed to reject payment: %w", err)
	}

	return payment, nil
}

func (s *FinanceService) GetVerificationQueue(ctx context.Context) ([]domain.FinancePayment, error) {
	return s.erpRepo.ListFinancePayments(ctx, string(domain.PaymentStatusPendingVerification), "")
}

func newRandomTokenHex(nBytes int) string {
	b := make([]byte, nBytes)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
