// Package handlers provides HTTP transport adapters, routing, and security middleware.
package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/domain"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/usecases"
)

type FinanceHandler struct {
	financeService *usecases.FinanceService
}

func NewFinanceHandler(service *usecases.FinanceService) *FinanceHandler {
	return &FinanceHandler{financeService: service}
}

type VerifyPaymentRequestDTO struct {
	ContractID    string `json:"contract_id,omitempty"`
	DeviceID      string `json:"device_id,omitempty"`
	GrowattSerial string `json:"growatt_serial,omitempty"`
}

type RejectPaymentRequestDTO struct {
	Reason string `json:"reason"`
}

func (h *FinanceHandler) HandleListInvoices(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	status := r.URL.Query().Get("status")
	customerID := r.URL.Query().Get("customer_id")

	claims, ok := GetClaims(r.Context())
	if ok && claims.UserType == string(domain.UserTypeCustomer) {
		customerID = claims.CustomerID
	}

	invoices, err := h.financeService.ListInvoices(r.Context(), status, customerID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]any{
		"status": "success",
		"count":  len(invoices),
		"items":  invoices,
	})
}

func (h *FinanceHandler) HandleGetVerificationQueue(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	payments, err := h.financeService.GetVerificationQueue(r.Context())
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]any{
		"status": "success",
		"count":  len(payments),
		"queue":  payments,
	})
}

func (h *FinanceHandler) HandleRecordPayment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var dto usecases.RecordPaymentDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request payload: "+err.Error())
		return
	}

	claims, ok := GetClaims(r.Context())
	if ok && dto.CustomerID == "" && claims.CustomerID != "" {
		dto.CustomerID = claims.CustomerID
	}

	payment, err := h.financeService.RecordInboundPayment(r.Context(), dto)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusCreated, map[string]any{
		"status":  "success",
		"payment": payment,
	})
}

func (h *FinanceHandler) HandleVerifyPayment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	claims, ok := GetClaims(r.Context())
	if !ok {
		writeJSONError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	// Expected: /api/v1/finance/payments/{id}/verify
	if len(parts) < 4 {
		writeJSONError(w, http.StatusBadRequest, "invalid url format; expected /api/v1/finance/payments/{id}/verify")
		return
	}
	paymentID := parts[len(parts)-2]

	var req VerifyPaymentRequestDTO
	_ = json.NewDecoder(r.Body).Decode(&req)

	result, err := h.financeService.VerifyPayment(
		r.Context(),
		paymentID,
		claims.UserID,
		req.ContractID,
		req.DeviceID,
		req.GrowattSerial,
	)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]any{
		"status":               "success",
		"verification_result":  result,
	})
}

func (h *FinanceHandler) HandleRejectPayment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	claims, ok := GetClaims(r.Context())
	if !ok {
		writeJSONError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	// Expected: /api/v1/finance/payments/{id}/reject
	if len(parts) < 4 {
		writeJSONError(w, http.StatusBadRequest, "invalid url format; expected /api/v1/finance/payments/{id}/reject")
		return
	}
	paymentID := parts[len(parts)-2]

	var req RejectPaymentRequestDTO
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Reason) == "" {
		writeJSONError(w, http.StatusBadRequest, "rejection reason is required")
		return
	}

	payment, err := h.financeService.RejectPayment(r.Context(), paymentID, req.Reason, claims.UserID)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]any{
		"status":  "success",
		"payment": payment,
	})
}
