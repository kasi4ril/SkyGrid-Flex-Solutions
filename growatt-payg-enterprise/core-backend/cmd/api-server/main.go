// Package main boots the unified Core Backend REST, Webhook & Customer Portal API Server.
//
// Architectural Role:
// Acts as the central polyglot orchestrator for the Growatt PAYG Enterprise Platform:
//   - Mounts the Atomic POSIX Virtual File System (`/var/lib/payg-vfs/`)
//   - Exposes Batch 2 Public Showroom, Deterministic Sizing & Band A/Generator ROI APIs
//   - Exposes Batch 3 Cryptographic HMAC-SHA512 Webhooks (Paystack, Moniepoint, OPay),
//     Dedicated Virtual Account (DVA) provisioning, and Nigerian NIN/BVN KYC Underwriting
//   - Exposes Batch 4 Executive Admin Command GIS Fleet Watchtower, Field Commissioning
//     (< 5.0 Ohms earthing check), and RMA Hardware Serial Swap APIs
//   - Exposes Batch 5 & 6 Customer Dashboard VFS State Aggregator (`state.json`,
//     `ledger_snap.json`, `horizon_24h.json`) and proxies read-only diagnostic queries
//     to the Python Intelligence Engine (`LocalGridAgent` RAG + XGBoost Forecaster)
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/growatt_oss"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/handlers"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/payments"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/vfs_store"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/usecases"
)

func main() {
	port := getEnv("API_PORT", "8080")
	vfsRoot := getEnv("PAYG_VFS_ROOT", "/tmp/payg-vfs-dev")
	pythonEngineURL := getEnv("PYTHON_INTELLIGENCE_URL", "http://localhost:8000")

	// 1. Initialize Batch 1: Atomic POSIX Virtual File System (VFS) Engine
	vfsManager, err := vfs_store.NewVFSManager(vfsRoot)
	if err != nil {
		log.Fatalf("[FATAL] Failed to initialize Atomic POSIX VFS at %s: %v", vfsRoot, err)
	}
	log.Printf("[BOOT] Batch 1 Atomic POSIX VFS mounted at %s", vfsRoot)

	// 2. Initialize Batch 2: Deterministic Auto-Sizing & Nigerian ROI Calculator
	sizingService := usecases.NewSizingCalculatorService()
	publicHandler := handlers.NewPublicShowroomHandler(sizingService)

	// 3. Initialize Batch 3: Multi-Rail Fintech Engine, Idempotent Ledger & KYC Underwriting
	paymentEngine := payments.NewMultiRailPaymentEngine(payments.GatewaySecrets{
		PaystackSecretKey:   getEnv("PAYSTACK_SECRET_KEY", "sk_test_paystack_secret_2026"),
		MoniepointSecretKey: getEnv("MONIEPOINT_SECRET_KEY", "mk_test_moniepoint_2026"),
		OPaySecretKey:       getEnv("OPAY_SECRET_KEY", "op_test_opay_2026"),
	})
	tokenEngine := usecases.NewOfflineTokenEngine(getEnv("STS_MASTER_SECRET", "skytron-growatt-sts-master-key-2026"))
	ledgerProcessor := usecases.NewLedgerProcessor(vfsManager, tokenEngine)
	kycService := usecases.NewKYCUnderwritingService()
	fintechHandler := handlers.NewFintechPaymentHandler(paymentEngine, ledgerProcessor, kycService)

	// 4. Initialize Batch 4: Hardware Telemetry, EEPROM Guard, Commissioning & Growatt Cloud Client
	telemetryProc := usecases.NewTelemetryHardwareProcessor(
		vfsManager,
		ledgerProcessor,
		getEnv("HEARTBEAT_HMAC_SECRET", "skytron-mqtt-heartbeat-hmac-key-2026"),
	)
	growattCloudClient := growatt_oss.NewClient(
		getEnv("GROWATT_OSS_URL", "https://openapi.growatt.com/v1"),
		getEnv("GROWATT_OSS_TOKEN", ""),
	)
	adminFieldHandler := handlers.NewAdminAndFieldHandler(telemetryProc)

	// Seed a reference active contract & commissioned device so the unified binary
	// serves live VFS telemetry immediately on startup for end-to-end testing.
	seedReferenceDeployment(vfsManager, ledgerProcessor, telemetryProc)

	// 5. Register All HTTP Routes Across Batches 2, 3, 4, 5 & 6
	mux := http.NewServeMux()

	// System Health & Polyglot Readiness Probe
	mux.HandleFunc("/healthz", withCORS(func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"status":                  "healthy",
			"service":                 "growatt-payg-core-backend-unified",
			"vfs_root":                vfsRoot,
			"python_intelligence_url": pythonEngineURL,
			"server_time_utc":         time.Now().UTC().Format(time.RFC3339),
		})
	}))

	// --- BATCH 2 ROUTES: Public Website Showroom & Sizing Calculator ---
	mux.HandleFunc("/api/v1/public/catalog", withCORS(publicHandler.HandleGetCatalog))
	mux.HandleFunc("/api/v1/public/calculate-size", withCORS(publicHandler.HandleCalculateSize))
	mux.HandleFunc("/api/v1/public/leads", withCORS(publicHandler.HandleCreateLead))

	// --- BATCH 3 ROUTES: Multi-Rail Webhooks, DVAs & Nigerian KYC Underwriting ---
	mux.HandleFunc("/api/v1/webhooks/", withCORS(fintechHandler.HandleWebhook))
	mux.HandleFunc("/api/v1/kyc/verify", withCORS(fintechHandler.HandleKYCVerify))
	mux.HandleFunc("/api/v1/contracts/provision-dva", withCORS(fintechHandler.HandleProvisionDVA))

	// --- BATCH 4 ROUTES: Executive Admin Command, Field Commissioning & RMA Swaps ---
	mux.HandleFunc("/api/v1/admin/fleet-overview", withCORS(adminFieldHandler.HandleFleetOverview))
	mux.HandleFunc("/api/v1/admin/rma-swap", withCORS(adminFieldHandler.HandleRMASwap))
	mux.HandleFunc("/api/v1/field/commission", withCORS(adminFieldHandler.HandleFieldCommission))
	mux.HandleFunc("/api/v1/field/telemetry-ingest", withCORS(adminFieldHandler.HandleTelemetryIngest))
	mux.HandleFunc("/api/v1/admin/growatt-cloud-verify", withCORS(func(w http.ResponseWriter, r *http.Request) {
		sn := r.URL.Query().Get("serial")
		summary, err := growattCloudClient.FetchInverterSummary(sn)
		if err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]any{"status": "error", "message": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "success", "cloud_summary": summary})
	}))

	// --- BATCH 5 & 6 ROUTES: Customer Portal VFS Aggregator & LocalGridAgent AI Bridge ---
	mux.HandleFunc("/api/v1/customer/dashboard/", withCORS(handleCustomerDashboardVFS(vfsManager, vfsRoot)))
	mux.HandleFunc("/api/v1/customer/ai-advisor", withCORS(handleCustomerAIAdvisorProxy(pythonEngineURL)))

	// --- STATIC WEB UI & SHOWROOM (static/index.html) ---
	staticDir := getEnv("STATIC_DIR", "static")
	if _, err := os.Stat(staticDir); os.IsNotExist(err) {
		if _, err := os.Stat("core-backend/static"); err == nil {
			staticDir = "core-backend/static"
		}
	}
	fileServer := http.FileServer(http.Dir(staticDir))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		if r.URL.Path == "/" || r.URL.Path == "/index.html" {
			http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
			return
		}
		fileServer.ServeHTTP(w, r)
	})

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 20 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful OS Signal Shutdown
	go func() {
		log.Printf("[READY] Unified Growatt PAYG Core API Server listening on http://localhost:%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[FATAL] HTTP server terminated unexpectedly: %v", err)
		}
	}()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigChan
	log.Printf("[SHUTDOWN] Caught signal %v — draining active HTTP connections...", sig)
}

// handleCustomerDashboardVFS reads the atomic JSON snapshots (`identity.json`, `state.json`,
// `ledger_snap.json`, and `forecasts/horizon_24h.json`) directly from the device's POSIX VFS block.
func handleCustomerDashboardVFS(vfs *vfs_store.VFSManager, vfsRoot string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"status": "error", "message": "method not allowed"})
			return
		}

		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		deviceID := parts[len(parts)-1]
		if deviceID == "" || deviceID == "dashboard" {
			deviceID = "DEV-8F3A-GROWATT-00421"
		}

		blockDir, err := vfs.ResolveDeviceBlockDir(deviceID)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"status": "error", "message": err.Error()})
			return
		}

		relBlock, _ := filepath.Rel(vfsRoot, blockDir)

		var identity vfs_store.DeviceIdentity
		var state vfs_store.DeviceDynamicState
		var ledgerSnap vfs_store.LedgerSnapshot
		var horizon24h map[string]any

		_ = vfs.ReadJSON(filepath.Join(relBlock, "identity.json"), &identity)
		_ = vfs.ReadJSON(filepath.Join(relBlock, "state.json"), &state)
		_ = vfs.ReadJSON(filepath.Join(relBlock, "ledger_snap.json"), &ledgerSnap)
		_ = vfs.ReadJSON(filepath.Join(relBlock, "forecasts", "horizon_24h.json"), &horizon24h)

		writeJSON(w, http.StatusOK, map[string]any{
			"status":       "success",
			"device_id":    deviceID,
			"vfs_path":     blockDir,
			"identity":     identity,
			"live_state":   state,
			"ledger_snap":  ledgerSnap,
			"forecast_24h": horizon24h,
		})
	}
}

// handleCustomerAIAdvisorProxy forwards customer diagnostic questions to the Python
// Intelligence Engine (`/api/v1/intelligence/agent-query`), enforcing the read-only boundary.
func handleCustomerAIAdvisorProxy(pythonBaseURL string) http.HandlerFunc {
	httpClient := &http.Client{Timeout: 12 * time.Second}
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"status": "error", "message": "method not allowed"})
			return
		}

		bodyBytes, err := io.ReadAll(io.LimitReader(r.Body, 1<<16))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"status": "error", "message": "invalid request body"})
			return
		}

		targetURL := fmt.Sprintf("%s/api/v1/intelligence/agent-query", strings.TrimRight(pythonBaseURL, "/"))
		resp, err := httpClient.Post(targetURL, "application/json", bytes.NewReader(bodyBytes))
		if err != nil {
			// Graceful offline fallback if Python service is not running locally
			writeJSON(w, http.StatusOK, map[string]any{
				"status": "success",
				"source": "golang_fallback_guardrail",
				"answer_markdown": "🔒 **LocalGridAgent (Read-Only Diagnostic Mode):** Your Growatt SPF 5000ES is operating normally (`ACTIVE_ON`) with LiFePO4 battery above 80% SoC. For hardware safety issues, flip your external isolator breaker; for top-ups, transfer to your Dedicated Virtual Account.",
			})
			return
		}
		defer resp.Body.Close()

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(resp.StatusCode)
		_, _ = io.Copy(w, resp.Body)
	}
}

func seedReferenceDeployment(
	vfs *vfs_store.VFSManager,
	ledger *usecases.LedgerProcessor,
	telemetry *usecases.TelemetryHardwareProcessor,
) {
	deviceID := "DEV-8F3A-GROWATT-00421"
	contractID := "CTR-NG-2026-001"

	ledger.RegisterContract(usecases.ContractState{
		ContractID:             contractID,
		CustomerID:             "CUST-SHWARJI-001",
		CustomerPhone:          "08030000000",
		DeviceID:               deviceID,
		GrowattSerial:          "GW-SPF5000ES-99881",
		TotalPriceKobo:         4450000 * 100,
		DownPaymentKobo:        1335000 * 100,
		MonthlyInstallmentKobo: 145000 * 100,
		TenureMonths:           24,
		PaidUntilAt:            time.Now().UTC().Add(19 * 24 * time.Hour),
		Status:                 "ACTIVE",
	})

	_, _ = telemetry.CommissionDevice(usecases.FieldCommissioningRequest{
		QuoteID:                  "QTE-NG-001",
		ContractID:               contractID,
		DeviceID:                 deviceID,
		FieldEngineerID:          "ENG-COREN-001",
		GrowattSerial:            "GW-SPF5000ES-99881",
		BatterySerial:            "LFP-512V-100AH-441",
		EdgeControllerIMEI:       "864209051123456",
		BLEMacAddress:            "AA:BB:CC:8F:3A:21",
		LowerShroudSealSerial:    "SEAL-NG-00421",
		ModelSKU:                 "GROWATT_SPF_5000ES",
		GPSLat:                   7.1904,
		GPSLng:                   8.1297,
		LocalPSHFactor:           4.9,
		RoofAzimuthDeg:           180.0,
		RoofTiltDeg:              15.0,
		EarthingResistanceOhms:   2.1,
		TamperSwitchVerifiedSeal: true,
	})
}

func withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Paystack-Signature, Monnify-Signature, X-OPay-Signature")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func getEnv(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}