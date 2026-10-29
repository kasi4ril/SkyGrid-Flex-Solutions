package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/payments"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/usecases"
)

// FintechPaymentHandler exposes multi-rail payment webhooks, DVA provisioning,
// and Nigerian NIN/BVN KYC underwriting endpoints.
type FintechPaymentHandler struct {
	paymentEngine *payments.MultiRailPaymentEngine
	ledger        *usecases.LedgerProcessor
	kycService    *usecases.KYCUnderwritingService
}

// NewFintechPaymentHandler constructs the Fintech HTTP handler.
func NewFintechPaymentHandler(
	paymentEngine *payments.MultiRailPaymentEngine,
	ledger *usecases.LedgerProcessor,
	kycService *usecases.KYCUnderwritingService,
) *FintechPaymentHandler {
	return &FintechPaymentHandler{
		paymentEngine: paymentEngine,
		ledger:        ledger,
		kycService:    kycService,
	}
}

// HandleWebhook serves POST /api/v1/webhooks/{provider}
// Enforces cryptographic HMAC-SHA512 verification before invoking the idempotent ledger.
func (h *FintechPaymentHandler) HandleWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	// Extract provider from URL path: /api/v1/webhooks/paystack | moniepoint | opay
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	providerStr := strings.ToUpper(parts[len(parts)-1])
	provider := payments.Provider(providerStr)

	// Read raw body bytes (bounded to 1MB to prevent memory exhaustion DoS)
	rawBody, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "failed to read webhook body")
		return
	}

	// Extract signature header based on Nigerian payment rail convention
	sigHeader := r.Header.Get("X-Paystack-Signature")
	if sigHeader == "" {
		sigHeader = r.Header.Get("Monnify-Signature")
	}
	if sigHeader == "" {
		sigHeader = r.Header.Get("X-OPay-Signature")
	}

	normalizedEvt, err := h.paymentEngine.VerifyAndNormalizeWebhook(provider, sigHeader, rawBody)
	if err != nil {
		writeJSONError(w, http.StatusUnauthorized, err.Error())
		return
	}

	result, err := h.ledger.ProcessVerifiedPayment(*normalizedEvt)
	if err != nil {
		writeJSONError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]any{
		"status": "success",
		"result": result,
	})
}

// HandleKYCVerify serves POST /api/v1/kyc/verify
// Evaluates NIN/BVN hashes, facial liveness, and 6-month bank statement DTI cashflow.
func (h *FintechPaymentHandler) HandleKYCVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req usecases.KYCUnderwritingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, fmt.Sprintf("invalid JSON: %v", err))
		return
	}

	decision, err := h.kycService.EvaluateCreditEligibility(req)
	if err != nil {
		writeJSONError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]any{
		"status":   "success",
		"decision": decision,
	})
}

// HandleProvisionDVA serves POST /api/v1/contracts/provision-dva
// Provisions Dedicated Virtual Accounts across Moniepoint, Paystack, and OPay.
func (h *FintechPaymentHandler) HandleProvisionDVA(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req struct {
		ContractID    string `json:"contract_id"`
		CustomerName  string `json:"customer_name"`
		CustomerPhone string `json:"customer_phone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid JSON payload")
		return
	}

	dvas, err := h.paymentEngine.ProvisionDedicatedVirtualAccounts(req.ContractID, req.CustomerName, req.CustomerPhone)
	if err != nil {
		writeJSONError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusCreated, map[string]any{
		"status":           "success",
		"virtual_accounts": dvas,
	})
}