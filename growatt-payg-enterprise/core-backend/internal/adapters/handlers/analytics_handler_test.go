package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/handlers"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/vfs_store"
)

func TestCustomerAnalyticsHandler_BuildAnalyticsPayload(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "vfs-analytics-test-*")
	if err != nil {
		t.Fatalf("failed to create temp vfs: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	vfs, err := vfs_store.NewVFSManager(tmpDir)
	if err != nil {
		t.Fatalf("failed to create vfs manager: %v", err)
	}
	h := handlers.NewCustomerAnalyticsHandler(vfs, tmpDir)

	segments := []string{"residential", "commercial", "industrial"}
	for _, seg := range segments {
		payload := h.BuildAnalyticsPayload("DEV-8F3A-GROWATT-00421", seg)
		if payload["status"] != "success" {
			t.Errorf("expected status 'success' for segment %s, got %v", seg, payload["status"])
		}
		if payload["active_segment"] != seg {
			t.Errorf("expected active_segment %s, got %v", seg, payload["active_segment"])
		}

		narrative, ok := payload["narrative_story"].(map[string]any)
		if !ok || narrative["headline"] == nil {
			t.Errorf("missing narrative_story headline for segment %s", seg)
		}

		financial, ok := payload["financial_triple_comparison"].(map[string]any)
		if !ok || financial["solar_payg"] == nil || financial["national_grid"] == nil || financial["fuel_generator"] == nil {
			t.Errorf("missing complete triple-source comparison for segment %s", seg)
		}

		graph, ok := payload["core_energy_graph"].(map[string]any)
		if !ok || graph["autonomy_transition_point"] == nil {
			t.Errorf("missing autonomy_transition_point for segment %s", seg)
		}

		wallet, ok := payload["paygo_wallet"].(map[string]any)
		if !ok || wallet["total_asset_cost_ngn"] == nil || wallet["accumulated_sum_paid_ngn"] == nil || wallet["balance_left_ngn"] == nil {
			t.Errorf("missing complete paygo_wallet balance and cost fields for segment %s", seg)
		}

		hw, ok := payload["hardware_passport"].(map[string]any)
		if !ok || hw["inverter"] == nil || hw["battery"] == nil || hw["panels"] == nil || hw["protection_components"] == nil || hw["installer_authority"] == nil {
			t.Errorf("missing complete hardware_passport for segment %s", seg)
		}

		ml, ok := payload["ml_forecast_and_advisory"].(map[string]any)
		if !ok || ml["predicted_metrics_24h"] == nil || ml["ai_agent_advisory"] == nil {
			t.Errorf("missing ml_forecast_and_advisory for segment %s", seg)
		}
	}
}

func TestCustomerAnalyticsHandler_HandleGetAnalytics(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "vfs-analytics-http-*")
	if err != nil {
		t.Fatalf("failed to create temp vfs: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	vfs, err := vfs_store.NewVFSManager(tmpDir)
	if err != nil {
		t.Fatalf("failed to create vfs manager: %v", err)
	}
	h := handlers.NewCustomerAnalyticsHandler(vfs, tmpDir)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/customer/analytics/DEV-8F3A-GROWATT-00421?segment=commercial", nil)
	w := httptest.NewRecorder()

	h.HandleGetAnalytics(w, req)
	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}

	var resBody map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&resBody); err != nil {
		t.Fatalf("failed to decode response JSON: %v", err)
	}

	if resBody["active_segment"] != "commercial" {
		t.Errorf("expected active_segment commercial, got %v", resBody["active_segment"])
	}
}

func TestFormatSI(t *testing.T) {
	tests := []struct {
		val      float64
		baseUnit string
		expected string
	}{
		{540, "W", "540 W"},
		{3420, "W", "3.42 kW"},
		{1250000, "W", "1.25 MW"},
		{14500, "Wh", "14.50 kWh"},
	}

	for _, tc := range tests {
		actual := handlers.FormatSI(tc.val, tc.baseUnit)
		if actual != tc.expected {
			t.Errorf("FormatSI(%v, %s) = %s, expected %s", tc.val, tc.baseUnit, actual, tc.expected)
		}
	}
}
