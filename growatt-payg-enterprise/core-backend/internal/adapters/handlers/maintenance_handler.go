// Package handlers provides HTTP transport adapters, routing, and security middleware.
package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/domain"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/usecases"
)

type MaintenanceHandler struct {
	maintenanceService *usecases.MaintenanceService
}

func NewMaintenanceHandler(service *usecases.MaintenanceService) *MaintenanceHandler {
	return &MaintenanceHandler{maintenanceService: service}
}

func (h *MaintenanceHandler) HandleReportFault(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var dto usecases.ReportFaultDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request payload: "+err.Error())
		return
	}

	claims, ok := GetClaims(r.Context())
	if ok && dto.CustomerID == "" && claims.CustomerID != "" {
		dto.CustomerID = claims.CustomerID
	}

	ticket, err := h.maintenanceService.ReportFault(r.Context(), dto)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusCreated, map[string]any{
		"status": "success",
		"ticket": ticket,
	})
}

func (h *MaintenanceHandler) HandleListTickets(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	status := r.URL.Query().Get("status")
	deviceID := r.URL.Query().Get("device_id")
	techID := r.URL.Query().Get("technician_id")

	claims, ok := GetClaims(r.Context())
	if ok && claims.UserType == string(domain.UserTypeCustomer) {
		// Only list customer tickets
	}

	tickets, err := h.maintenanceService.ListTickets(r.Context(), status, deviceID, techID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]any{
		"status": "success",
		"count":  len(tickets),
		"items":  tickets,
	})
}

func (h *MaintenanceHandler) HandleGetTicket(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	id := parts[len(parts)-1]
	if id == "" || id == "tickets" {
		writeJSONError(w, http.StatusBadRequest, "ticket id is required")
		return
	}

	ticket, err := h.maintenanceService.GetTicket(r.Context(), id)
	if err != nil {
		writeJSONError(w, http.StatusNotFound, "maintenance ticket not found")
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]any{
		"status": "success",
		"ticket": ticket,
	})
}

func (h *MaintenanceHandler) HandleTransitionStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	// Expected path: /api/v1/maintenance/tickets/{id}/transition
	if len(parts) < 4 {
		writeJSONError(w, http.StatusBadRequest, "invalid url format; expected /api/v1/maintenance/tickets/{id}/transition")
		return
	}
	id := parts[len(parts)-2]

	var dto usecases.TransitionMaintenanceDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request payload: "+err.Error())
		return
	}

	claims, ok := GetClaims(r.Context())
	if ok && dto.SupervisorUserID == "" {
		for _, role := range claims.Roles {
			if role == domain.RoleOperationsManager || role == domain.RoleSuperAdmin {
				dto.SupervisorUserID = claims.UserID
				break
			}
		}
	}

	ticket, err := h.maintenanceService.TransitionStatus(r.Context(), id, dto)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]any{
		"status": "success",
		"ticket": ticket,
	})
}
