package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/handlers"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/repositories"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/vfs_store"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/domain"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/usecases"
)

type erpTestHarness struct {
	base            *testHarness
	instService     *usecases.InstallationService
	maintService    *usecases.MaintenanceService
	financeService  *usecases.FinanceService
	instHandler     *handlers.InstallationHandler
	maintHandler    *handlers.MaintenanceHandler
	financeHandler  *handlers.FinanceHandler
	opsManagerToken string
	engineerToken   string
	financeToken    string
}

func setupERPHarness(t *testing.T) *erpTestHarness {
	base := setupTestHarness(t)
	erpRepo := repositories.NewMemoryERPRepository()
	vfsRoot := t.TempDir()
	vfs, _ := vfs_store.NewVFSManager(vfsRoot)
	tokenEngine := usecases.NewOfflineTokenEngine("test-sts-master-key-2026")
	ledgerProc := usecases.NewLedgerProcessor(vfs, tokenEngine)

	financeService := usecases.NewFinanceService(erpRepo, ledgerProc, tokenEngine)
	instService := usecases.NewInstallationService(erpRepo, financeService)
	maintService := usecases.NewMaintenanceService(erpRepo, financeService)

	instHandler := handlers.NewInstallationHandler(instService)
	maintHandler := handlers.NewMaintenanceHandler(maintService)
	financeHandler := handlers.NewFinanceHandler(financeService)

	opsToken, _, _ := base.authService.GenerateSandboxToken(domain.RoleOperationsManager)
	engToken, _, _ := base.authService.GenerateSandboxToken(domain.RoleFieldEngineer)
	finToken, _, _ := base.authService.GenerateSandboxToken(domain.RoleFinanceOfficer)

	return &erpTestHarness{
		base:            base,
		instService:     instService,
		maintService:    maintService,
		financeService:  financeService,
		instHandler:     instHandler,
		maintHandler:    maintHandler,
		financeHandler:  financeHandler,
		opsManagerToken: opsToken,
		engineerToken:   engToken,
		financeToken:    finToken,
	}
}

func TestERPHandlers_InstallationRBACAndEarthingHTTP(t *testing.T) {
	h := setupERPHarness(t)

	// Create endpoint guarded by installations.create
	createRoute := h.base.authMiddleware.AuthenticateJWTFunc(
		h.base.authMiddleware.RequirePermissionFunc(domain.PermInstallationsCreate, h.instHandler.HandleCreateInstallation),
	)

	payload := map[string]any{
		"customer_name":       "Alhaji Sani Bello",
		"customer_phone":      "08034455667",
		"site_address":        "5 Independence Way, Kaduna",
		"gps_lat":             10.5105,
		"gps_lng":             7.4165,
		"state_region":        "Kaduna",
		"inverter_sku":        "GROWATT_SPF_5000ES",
		"total_amount_kobo":   450000000,
		"pv_kwp_planned":      5.4,
		"battery_kwh_planned": 10.24,
	}
	body, _ := json.Marshal(payload)

	// Case A: Customer Support token (lacks installations.create) -> 403 Forbidden
	req := httptest.NewRequest(http.MethodPost, "/api/v1/installations", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+h.base.supportToken)
	w := httptest.NewRecorder()
	createRoute.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden for unauthorized role, got %d", w.Code)
	}

	// Case B: Operations Manager token (has installations.create) -> 201 Created
	req = httptest.NewRequest(http.MethodPost, "/api/v1/installations", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+h.opsManagerToken)
	w = httptest.NewRecorder()
	createRoute.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created for authorized role, got %d: %s", w.Code, w.Body.String())
	}

	var res map[string]any
	_ = json.NewDecoder(w.Body).Decode(&res)
	wo := res["work_order"].(map[string]any)
	woID := wo["id"].(string)

	// Test Transition Handler with Earthing Check
	transRoute := h.base.authMiddleware.AuthenticateJWTFunc(
		h.base.authMiddleware.RequirePermissionFunc(domain.PermInstallationsUpdate, h.instHandler.HandleTransitionStatus),
	)

	// Step through up to Step 12
	steps := []domain.InstallationStatus{
		domain.InstallStatus2OpsReviewed,
		domain.InstallStatus3SiteAssessmentScheduled,
		domain.InstallStatus4SiteAssessed,
		domain.InstallStatus5QuotationPrepared,
		domain.InstallStatus6QuotationApproved,
		domain.InstallStatus7WorkOrderCreated,
		domain.InstallStatus8TechnicianAssigned,
		domain.InstallStatus9InstallationScheduled,
		domain.InstallStatus10InProgress,
		domain.InstallStatus11BOMDocumented,
		domain.InstallStatus12PhotosUploaded,
	}
	for _, nextStep := range steps {
		sBody, _ := json.Marshal(map[string]any{"next_status": nextStep})
		sReq := httptest.NewRequest(http.MethodPost, "/api/v1/installations/"+woID+"/transition", bytes.NewReader(sBody))
		sReq.Header.Set("Authorization", "Bearer "+h.engineerToken)
		sW := httptest.NewRecorder()
		transRoute.ServeHTTP(sW, sReq)
		if sW.Code != http.StatusOK {
			t.Fatalf("transition to %s failed: %d (%s)", nextStep, sW.Code, sW.Body.String())
		}
	}

	// Step 13: Failing Earthing Resistance (6.50 Ohms > 5.00 Ohms) -> 422 Unprocessable Entity
	badEarthBody, _ := json.Marshal(map[string]any{
		"next_status":              domain.InstallStatus13CORENInspected,
		"earthing_resistance_ohms": 6.50,
		"coren_certificate_no":     "COREN-FAIL-001",
	})
	eReq := httptest.NewRequest(http.MethodPost, "/api/v1/installations/"+woID+"/transition", bytes.NewReader(badEarthBody))
	eReq.Header.Set("Authorization", "Bearer "+h.engineerToken)
	eW := httptest.NewRecorder()
	transRoute.ServeHTTP(eW, eReq)
	if eW.Code != http.StatusUnprocessableEntity {
		t.Errorf("expected 422 Unprocessable Entity for earthing > 5.00 Ohms, got %d", eW.Code)
	}

	// Step 13: Passing Earthing Resistance (3.40 Ohms <= 5.00 Ohms) -> 200 OK
	goodEarthBody, _ := json.Marshal(map[string]any{
		"next_status":              domain.InstallStatus13CORENInspected,
		"earthing_resistance_ohms": 3.40,
		"coren_certificate_no":     "COREN-PASS-2026-99",
	})
	eReq = httptest.NewRequest(http.MethodPost, "/api/v1/installations/"+woID+"/transition", bytes.NewReader(goodEarthBody))
	eReq.Header.Set("Authorization", "Bearer "+h.engineerToken)
	eW = httptest.NewRecorder()
	transRoute.ServeHTTP(eW, eReq)
	if eW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for valid earthing, got %d: %s", eW.Code, eW.Body.String())
	}
}

func TestERPHandlers_FinanceVerificationQueueRBAC(t *testing.T) {
	h := setupERPHarness(t)

	// Record Payment
	payment, err := h.financeService.RecordInboundPayment(context.Background(), usecases.RecordPaymentDTO{
		CustomerID:          "CUST-0099",
		CustomerName:        "Fatima Aliyu",
		AmountKobo:          14500000,
		PaymentMethod:       "MANUAL_BANK_TRANSFER",
		BankTellerReference: "ZENITH-TELLER-44219",
		BankName:            "Zenith Bank",
	})
	if err != nil {
		t.Fatalf("failed to record payment: %v", err)
	}

	// Verification Queue Route guarded by payments.verify
	queueRoute := h.base.authMiddleware.AuthenticateJWTFunc(
		h.base.authMiddleware.RequirePermissionFunc(domain.PermPaymentsVerify, h.financeHandler.HandleGetVerificationQueue),
	)

	// Field Engineer lacks payments.verify -> 403 Forbidden
	req := httptest.NewRequest(http.MethodGet, "/api/v1/finance/payments/queue", nil)
	req.Header.Set("Authorization", "Bearer "+h.engineerToken)
	w := httptest.NewRecorder()
	queueRoute.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden for role lacking payments.verify, got %d", w.Code)
	}

	// Finance Officer has payments.verify -> 200 OK
	req = httptest.NewRequest(http.MethodGet, "/api/v1/finance/payments/queue", nil)
	req.Header.Set("Authorization", "Bearer "+h.financeToken)
	w = httptest.NewRecorder()
	queueRoute.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for Finance Officer, got %d: %s", w.Code, w.Body.String())
	}

	// Verify Payment Endpoint guarded by payments.verify
	verifyRoute := h.base.authMiddleware.AuthenticateJWTFunc(
		h.base.authMiddleware.RequirePermissionFunc(domain.PermPaymentsVerify, h.financeHandler.HandleVerifyPayment),
	)

	vBody, _ := json.Marshal(map[string]any{
		"contract_id":    "CTR-NG-2026-001",
		"device_id":      "DEV-8F3A-GROWATT-00421",
		"growatt_serial": "GW-SPF5000ES-99881",
	})
	vReq := httptest.NewRequest(http.MethodPost, "/api/v1/finance/payments/"+payment.ID+"/verify", bytes.NewReader(vBody))
	vReq.Header.Set("Authorization", "Bearer "+h.financeToken)
	vW := httptest.NewRecorder()
	verifyRoute.ServeHTTP(vW, vReq)

	if vW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for payment verification, got %d: %s", vW.Code, vW.Body.String())
	}

	var vRes map[string]any
	_ = json.NewDecoder(vW.Body).Decode(&vRes)
	resObj := vRes["verification_result"].(map[string]any)
	payObj := resObj["payment"].(map[string]any)
	if payObj["status"] != string(domain.PaymentStatusVerified) {
		t.Errorf("expected payment status VERIFIED, got %v", payObj["status"])
	}
	stsToken, ok := resObj["sts_token_issued"].(string)
	if !ok || len(stsToken) < 19 {
		t.Errorf("expected 20-digit formatted STS token in response, got %v", stsToken)
	}
}
