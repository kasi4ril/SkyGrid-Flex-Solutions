// Package main boots the Core Backend REST & Webhook API Server.
package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/handlers"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/vfs_store"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/usecases"
)

func main() {
	port := os.Getenv("API_PORT")
	if port == "" {
		port = "8080"
	}

	vfsRoot := os.Getenv("PAYG_VFS_ROOT")
	if vfsRoot == "" {
		vfsRoot = "/tmp/payg-vfs-dev"
	}

	// 1. Initialize Atomic POSIX Virtual File System (VFS)
	vfsManager, err := vfs_store.NewVFSManager(vfsRoot)
	if err != nil {
		log.Fatalf("[FATAL] Failed to initialize VFS Manager at %s: %v", vfsRoot, err)
	}
	log.Printf("[INFO] Atomic POSIX VFS mounted at %s", vfsRoot)
	_ = vfsManager // Wired into Batch 3 & 4 handlers

	// 2. Initialize Deterministic Auto-Sizing & Nigerian ROI Engine
	sizingService := usecases.NewSizingCalculatorService()
	publicHandler := handlers.NewPublicShowroomHandler(sizingService)

	// 3. Register HTTP Routes with CORS Middleware
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"healthy","service":"growatt-payg-core-backend"}`))
	})

	mux.HandleFunc("/api/v1/public/catalog", withCORS(publicHandler.HandleGetCatalog))
	mux.HandleFunc("/api/v1/public/calculate-size", withCORS(publicHandler.HandleCalculateSize))
	mux.HandleFunc("/api/v1/public/leads", withCORS(publicHandler.HandleCreateLead))

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("[INFO] Growatt PAYG Core API Server listening on http://localhost:%s", port)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("[FATAL] HTTP server crashed: %v", err)
	}
}

func withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Paystack-Signature, X-Moniepoint-Signature")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}
