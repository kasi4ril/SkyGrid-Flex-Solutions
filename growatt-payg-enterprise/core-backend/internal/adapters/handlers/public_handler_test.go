package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/handlers"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/usecases"
)

func TestPublicShowroomHandler_RegisterCustomer(t *testing.T) {
	calculator := usecases.NewSizingCalculatorService()
	h := handlers.NewPublicShowroomHandler(calculator)

	payload := map[string]any{
		"nin":                 "11223344556",
		"first_name":          "Fatima",
		"last_name":           "Bello",
		"phone":               "08031234567",
		"email":               "f.bello@example.com",
		"state_region":        "Abuja FCT",
		"street_address":      "Plot 14 Gana St, Maitama",
		"gps_lat":             9.0765,
		"gps_lng":             7.3986,
		"package_name":        "5.4 kWp Executive Solar Home",
		"down_payment_ngn":    "₦1,890,000",
		"monthly_installment": "₦175,000",
		"total_asset_cost":    "₦6,300,000",
	}

	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/public/register-customer", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.HandleRegisterCustomer(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected status 201 Created, got %d: %s", w.Code, w.Body.String())
	}

	var res map[string]any
	if err := json.NewDecoder(w.Body).Decode(&res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if res["status"] != "success" {
		t.Errorf("expected status 'success', got %v", res["status"])
	}
	if res["full_name"] != "Fatima Bello" {
		t.Errorf("expected full_name 'Fatima Bello', got %v", res["full_name"])
	}
	dva, ok := res["dva"].(map[string]any)
	if !ok || dva["account_number"] == nil {
		t.Errorf("expected valid DVA account number, got %v", dva)
	}
}

func TestPublicShowroomHandler_VerifyNIN(t *testing.T) {
	calculator := usecases.NewSizingCalculatorService()
	h := handlers.NewPublicShowroomHandler(calculator)

	// Test 1: Verify known demo NIN
	req := httptest.NewRequest(http.MethodGet, "/api/v1/public/verify-nin?nin=11223344556", nil)
	w := httptest.NewRecorder()
	h.HandleVerifyNIN(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var res map[string]any
	if err := json.NewDecoder(w.Body).Decode(&res); err != nil {
		t.Fatalf("failed to decode json: %v", err)
	}

	if res["first_name"] != "Babatunde" || res["last_name"] != "Adeyemi" {
		t.Errorf("expected Babatunde Adeyemi, got %v %v", res["first_name"], res["last_name"])
	}
	if res["gender"] != "Male" {
		t.Errorf("expected Male, got %v", res["gender"])
	}
	if res["dob"] != "1988-06-14" {
		t.Errorf("expected 1988-06-14, got %v", res["dob"])
	}

	// Test 2: Invalid length returns 400
	badReq := httptest.NewRequest(http.MethodGet, "/api/v1/public/verify-nin?nin=123", nil)
	badW := httptest.NewRecorder()
	h.HandleVerifyNIN(badW, badReq)

	if badW.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request for short NIN, got %d", badW.Code)
	}
}

