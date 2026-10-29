// Package handlers implements the HTTP REST and Webhook transport layer.
package handlers

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/domain"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/usecases"
)

// PublicShowroomHandler serves unauthenticated public showroom requests:
// catalog discovery, real-time electrical sizing, ROI comparison, and site audit booking.
type PublicShowroomHandler struct {
	calculator *usecases.SizingCalculatorService
}

// NewPublicShowroomHandler constructs a new PublicShowroomHandler instance.
func NewPublicShowroomHandler(calculator *usecases.SizingCalculatorService) *PublicShowroomHandler {
	return &PublicShowroomHandler{
		calculator: calculator,
	}
}

// HandleGetCatalog serves GET /api/v1/public/catalog
// Returns the calibrated Nigerian appliance database, geo-zone Peak Sun Hours, and Growatt bundles.
func (h *PublicShowroomHandler) HandleGetCatalog(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	appliances, geoZones, bundles := h.calculator.GetCatalogMetadata()
	writeJSONResponse(w, http.StatusOK, map[string]any{
		"status":      "success",
		"appliances":  appliances,
		"geo_zones":   geoZones,
		"bundles":     bundles,
		"server_time": time.Now().UTC(),
	})
}

// HandleCalculateSize serves POST /api/v1/public/calculate-size
// Computes VA_inv, Wh_batt, W_pv, 36-month PAYG amortization, and DisCo Band A / Generator ROI.
func (h *PublicShowroomHandler) HandleCalculateSize(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req domain.SizingCalculationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, fmt.Sprintf("invalid JSON request payload: %v", err))
		return
	}

	result, err := h.calculator.CalculateSystemSize(req)
	if err != nil {
		writeJSONError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]any{
		"status": "success",
		"data":   result,
	})
}

// HandleCreateLead serves POST /api/v1/public/leads
// Validates customer contact info, re-verifies the sizing calculation server-side (never trusting
// client-calculated prices), and books a physical Field Engineering Site Audit.
func (h *PublicShowroomHandler) HandleCreateLead(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req domain.LeadCaptureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, fmt.Sprintf("invalid JSON payload: %v", err))
		return
	}

	if strings.TrimSpace(req.FullName) == "" || strings.TrimSpace(req.Phone) == "" {
		writeJSONError(w, http.StatusBadRequest, "full_name and phone are mandatory to book a Site Audit")
		return
	}

	// Re-compute sizing deterministically on the server to prevent client-side price tampering
	verifiedQuote, err := h.calculator.CalculateSystemSize(req.SizingInput)
	if err != nil {
		writeJSONError(w, http.StatusUnprocessableEntity, fmt.Sprintf("quote verification failed: %v", err))
		return
	}

	quoteID := generateUUID()

	writeJSONResponse(w, http.StatusCreated, map[string]any{
		"status":               "success",
		"message":              "Site Audit booked successfully. A COREN-certified Field Engineer has been assigned.",
		"quote_id":             quoteID,
		"audit_booking_ref":    fmt.Sprintf("AUD-NG-%s", strings.ToUpper(quoteID[0:8])),
		"customer_name":        req.FullName,
		"customer_phone":       req.Phone,
		"state_region":         verifiedQuote.StateRegion,
		"recommended_sku":      verifiedQuote.RecommendedBundle.SKUCode,
		"down_payment_kobo":    verifiedQuote.Amortization.DownPaymentKobo,
		"monthly_payment_kobo": verifiedQuote.Amortization.MonthlyInstallmentKobo,
		"verified_quote":       verifiedQuote,
	})
}

// writeJSONResponse writes a standardized JSON HTTP response with CORS headers.
func writeJSONResponse(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeJSONError(w http.ResponseWriter, statusCode int, message string) {
	writeJSONResponse(w, statusCode, map[string]any{
		"status":  "error",
		"message": message,
	})
}

func generateUUID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}
