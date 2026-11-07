// Package handlers provides HTTP transport adapters, routing, and security middleware.
package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/domain"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/usecases"
)

type InstallationHandler struct {
	installationService *usecases.InstallationService
}

func NewInstallationHandler(service *usecases.InstallationService) *InstallationHandler {
	return &InstallationHandler{installationService: service}
}

func (h *InstallationHandler) HandleCreateInstallation(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var dto usecases.CreateInstallationDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request payload: "+err.Error())
		return
	}

	claims, ok := GetClaims(r.Context())
	if ok && dto.CustomerID == "" && claims.CustomerID != "" {
		dto.CustomerID = claims.CustomerID
	}

	order, err := h.installationService.CreateInstallation(r.Context(), dto)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusCreated, map[string]any{
		"status":      "success",
		"work_order":  order,
	})
}

func (h *InstallationHandler) HandleListInstallations(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	status := r.URL.Query().Get("status")
	customerID := r.URL.Query().Get("customer_id")
	engineerID := r.URL.Query().Get("engineer_id")

	claims, ok := GetClaims(r.Context())
	if ok && claims.UserType == string(domain.UserTypeCustomer) {
		customerID = claims.CustomerID
	}

	orders, err := h.installationService.ListInstallations(r.Context(), status, customerID, engineerID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]any{
		"status": "success",
		"count":  len(orders),
		"items":  orders,
	})
}

func (h *InstallationHandler) HandleGetInstallation(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	id := parts[len(parts)-1]
	if id == "" || id == "installations" {
		writeJSONError(w, http.StatusBadRequest, "work order id is required")
		return
	}

	order, err := h.installationService.GetInstallation(r.Context(), id)
	if err != nil {
		writeJSONError(w, http.StatusNotFound, "installation work order not found")
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]any{
		"status":     "success",
		"work_order": order,
	})
}

func (h *InstallationHandler) HandleTransitionStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	// Expected path: /api/v1/installations/{id}/transition
	if len(parts) < 4 {
		writeJSONError(w, http.StatusBadRequest, "invalid url format; expected /api/v1/installations/{id}/transition")
		return
	}
	id := parts[len(parts)-2]

	var dto usecases.TransitionInstallationDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request payload: "+err.Error())
		return
	}

	order, err := h.installationService.TransitionStatus(r.Context(), id, dto)
	if err != nil {
		if errors.Is(err, usecases.ErrEarthingResistanceTooHigh) {
			writeJSONError(w, http.StatusUnprocessableEntity, err.Error())
			return
		}
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]any{
		"status":     "success",
		"work_order": order,
	})
}
