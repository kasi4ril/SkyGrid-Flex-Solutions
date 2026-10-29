package vfs_store

import (
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestResolveDeviceBlockDir(t *testing.T) {
	tempBase := filepath.Join(os.TempDir(), fmt.Sprintf("payg-vfs-test-%d", time.Now().UnixNano()))
	defer os.RemoveAll(tempBase)

	vfs, err := NewVFSManager(tempBase)
	if err != nil {
		t.Fatalf("failed to create VFSManager: %v", err)
	}

	deviceID := "DEV-8F3A-GROWATT-00421"
	hash := sha256.Sum256([]byte(deviceID))
	hexStr := hex.EncodeToString(hash[:])
	expectedDir := filepath.Join(tempBase, "blocks", hexStr[0:2], hexStr[2:4], deviceID)

	dir, err := vfs.ResolveDeviceBlockDir(deviceID)
	if err != nil {
		t.Fatalf("ResolveDeviceBlockDir failed: %v", err)
	}

	if dir != expectedDir {
		t.Fatalf("expected dir %s, got %s", expectedDir, dir)
	}

	// Test unsafe paths
	for _, badID := range []string{"", "   ", "dev/123", `dev\123`, "../secret"} {
		if _, err := vfs.ResolveDeviceBlockDir(badID); err == nil {
			t.Fatalf("expected error for unsafe device ID %q, but got nil", badID)
		}
	}
}

func TestInitializeDeviceBlock(t *testing.T) {
	tempBase := filepath.Join(os.TempDir(), fmt.Sprintf("payg-vfs-test-%d", time.Now().UnixNano()))
	defer os.RemoveAll(tempBase)

	vfs, err := NewVFSManager(tempBase)
	if err != nil {
		t.Fatalf("failed to create VFSManager: %v", err)
	}

	identity := DeviceIdentity{
		DeviceID:              "DEV-001",
		GrowattSerial:         "GW-SPF-5000-001",
		BatterySerial:         "LFP-48V-100AH-001",
		EdgeControllerIMEI:    "869402049102941",
		LowerShroudSealSerial: "SEAL-2026-X99",
		ModelSKU:              "GROWATT_SPF_5000ES",
		GPSLat:                6.5244,
		GPSLng:                3.3792,
		LocalPSHFactor:        4.5,
		InstalledAt:           time.Now().UTC().Format(time.RFC3339),
	}

	blockDir, err := vfs.InitializeDeviceBlock(identity)
	if err != nil {
		t.Fatalf("InitializeDeviceBlock failed: %v", err)
	}

	// Verify directories
	for _, sub := range []string{"forecasts", "telemetry_wal", "audit_vault"} {
		p := filepath.Join(blockDir, sub)
		fi, err := os.Stat(p)
		if err != nil || !fi.IsDir() {
			t.Fatalf("expected subdirectory %s to exist", p)
		}
	}

	// Verify identity.json
	identityFile := filepath.Join(blockDir, "identity.json")
	if _, err := os.Stat(identityFile); err != nil {
		t.Fatalf("identity.json was not created at %s", identityFile)
	}

	var readIdentity DeviceIdentity
	relPath, _ := filepath.Rel(tempBase, identityFile)
	if err := vfs.ReadJSON(relPath, &readIdentity); err != nil {
		t.Fatalf("failed to read identity.json: %v", err)
	}

	if readIdentity.DeviceID != identity.DeviceID {
		t.Fatalf("expected DeviceID %s, got %s", identity.DeviceID, readIdentity.DeviceID)
	}
	if readIdentity.GrowattSerial != identity.GrowattSerial {
		t.Fatalf("expected GrowattSerial %s, got %s", identity.GrowattSerial, readIdentity.GrowattSerial)
	}
}

func TestAtomicWriteAndReadJSON(t *testing.T) {
	tempBase := filepath.Join(os.TempDir(), fmt.Sprintf("payg-vfs-test-%d", time.Now().UnixNano()))
	defer os.RemoveAll(tempBase)

	vfs, err := NewVFSManager(tempBase)
	if err != nil {
		t.Fatalf("failed to create VFSManager: %v", err)
	}

	deviceID := "DEV-ATOMIC-001"
	_, err = vfs.InitializeDeviceBlock(DeviceIdentity{DeviceID: deviceID})
	if err != nil {
		t.Fatalf("failed initializing device block: %v", err)
	}

	state := DeviceDynamicState{
		DeviceID:          deviceID,
		RelayState:        "ACTIVE_ON",
		TamperSwitchState: "SEALED",
		PaidUntilUnix:     time.Now().Add(48 * time.Hour).Unix(),
		BatterySoCPct:     89.5,
		PVWatts:           3420.0,
		ACOutputWatts:     1250.0,
		InverterTempC:     41.2,
		UpdatedAt:         time.Now().UTC().Format(time.RFC3339),
	}

	if err := vfs.WriteDeviceState(deviceID, state); err != nil {
		t.Fatalf("WriteDeviceState failed: %v", err)
	}

	blockDir, _ := vfs.ResolveDeviceBlockDir(deviceID)
	relPath, _ := filepath.Rel(tempBase, filepath.Join(blockDir, "state.json"))

	var readState DeviceDynamicState
	if err := vfs.ReadJSON(relPath, &readState); err != nil {
		t.Fatalf("ReadJSON failed: %v", err)
	}

	if readState.DeviceID != state.DeviceID {
		t.Fatalf("expected DeviceID %s, got %s", state.DeviceID, readState.DeviceID)
	}
	if readState.RelayState != "ACTIVE_ON" {
		t.Fatalf("expected RelayState ACTIVE_ON, got %s", readState.RelayState)
	}
	if readState.BatterySoCPct != 89.5 {
		t.Fatalf("expected BatterySoCPct 89.5, got %f", readState.BatterySoCPct)
	}

	// Verify no temporary files remain
	files, err := os.ReadDir(blockDir)
	if err != nil {
		t.Fatalf("failed to read block dir: %v", err)
	}
	for _, f := range files {
		if strings.HasSuffix(f.Name(), ".tmp") {
			t.Fatalf("found lingering temp file: %s", f.Name())
		}
	}
}

func TestConcurrentAtomicWrites(t *testing.T) {
	tempBase := filepath.Join(os.TempDir(), fmt.Sprintf("payg-vfs-test-%d", time.Now().UnixNano()))
	defer os.RemoveAll(tempBase)

	vfs, err := NewVFSManager(tempBase)
	if err != nil {
		t.Fatalf("failed to create VFSManager: %v", err)
	}

	deviceID := "DEV-CONCURRENT-001"
	_, err = vfs.InitializeDeviceBlock(DeviceIdentity{DeviceID: deviceID})
	if err != nil {
		t.Fatalf("failed initializing device block: %v", err)
	}

	const numWorkers = 15
	const iterationsPerWorker = 10

	var wg sync.WaitGroup
	wg.Add(numWorkers)

	for i := 0; i < numWorkers; i++ {
		workerID := i
		go func() {
			defer wg.Done()
			for j := 0; j < iterationsPerWorker; j++ {
				st := DeviceDynamicState{
					DeviceID:          deviceID,
					RelayState:        "ACTIVE_ON",
					TamperSwitchState: "SEALED",
					BatterySoCPct:     float64((workerID*j)%100) + 0.1,
					PVWatts:           float64(workerID*100 + j),
					UpdatedAt:         time.Now().UTC().Format(time.RFC3339),
				}
				if err := vfs.WriteDeviceState(deviceID, st); err != nil {
					t.Errorf("concurrent WriteDeviceState failed: %v", err)
					return
				}

				blockDir, _ := vfs.ResolveDeviceBlockDir(deviceID)
				relPath, _ := filepath.Rel(tempBase, filepath.Join(blockDir, "state.json"))
				var readBack DeviceDynamicState
				if err := vfs.ReadJSON(relPath, &readBack); err != nil {
					t.Errorf("concurrent ReadJSON failed: %v", err)
					return
				}
				if readBack.DeviceID != deviceID {
					t.Errorf("corrupted read: expected device id %s, got %s", deviceID, readBack.DeviceID)
				}
			}
		}()
	}

	wg.Wait()

	blockDir, _ := vfs.ResolveDeviceBlockDir(deviceID)
	relPath, _ := filepath.Rel(tempBase, filepath.Join(blockDir, "state.json"))
	var finalState DeviceDynamicState
	if err := vfs.ReadJSON(relPath, &finalState); err != nil {
		t.Fatalf("final ReadJSON failed: %v", err)
	}
	if finalState.DeviceID != deviceID {
		t.Fatalf("expected device id %s, got %s", deviceID, finalState.DeviceID)
	}
}

func TestAppendTelemetryWAL(t *testing.T) {
	tempBase := filepath.Join(os.TempDir(), fmt.Sprintf("payg-vfs-test-%d", time.Now().UnixNano()))
	defer os.RemoveAll(tempBase)

	vfs, err := NewVFSManager(tempBase)
	if err != nil {
		t.Fatalf("failed to create VFSManager: %v", err)
	}

	deviceID := "DEV-WAL-001"
	_, err = vfs.InitializeDeviceBlock(DeviceIdentity{DeviceID: deviceID})
	if err != nil {
		t.Fatalf("failed initializing device block: %v", err)
	}

	now := time.Now().UTC()
	frame1 := TelemetryFrame{
		Timestamp:         now,
		DeviceID:          deviceID,
		PVVolts:           240.5,
		PVWatts:           1950.0,
		ACOutputWatts:     1100.0,
		ACGridVolts:       229.0,
		BatteryVolts:      51.2,
		BatterySoCPct:     91.5,
		InverterTempC:     37.5,
		GrowattStatusCode: 1,
		GrowattFaultCode:  0,
		TamperPinHigh:     false,
	}

	frame2 := TelemetryFrame{
		Timestamp:         now.Add(5 * time.Minute),
		DeviceID:          deviceID,
		PVVolts:           245.0,
		PVWatts:           2200.0,
		ACOutputWatts:     1250.0,
		ACGridVolts:       231.0,
		BatteryVolts:      51.8,
		BatterySoCPct:     94.0,
		InverterTempC:     39.0,
		GrowattStatusCode: 1,
		GrowattFaultCode:  0,
		TamperPinHigh:     false,
	}

	if err := vfs.AppendTelemetryWAL(frame1); err != nil {
		t.Fatalf("AppendTelemetryWAL frame1 failed: %v", err)
	}
	if err := vfs.AppendTelemetryWAL(frame2); err != nil {
		t.Fatalf("AppendTelemetryWAL frame2 failed: %v", err)
	}

	blockDir, _ := vfs.ResolveDeviceBlockDir(deviceID)
	walPath := filepath.Join(blockDir, "telemetry_wal", now.Format("2006-01-02")+".csv")

	f, err := os.Open(walPath)
	if err != nil {
		t.Fatalf("failed to open daily WAL file: %v", err)
	}
	defer f.Close()

	r := csv.NewReader(f)
	rows, err := r.ReadAll()
	if err != nil {
		t.Fatalf("failed reading WAL csv: %v", err)
	}

	// 1 header + 2 data rows = 3
	if len(rows) != 3 {
		t.Fatalf("expected 3 rows, got %d", len(rows))
	}
	if rows[0][0] != "timestamp_utc" {
		t.Fatalf("expected header 'timestamp_utc', got %s", rows[0][0])
	}
	if rows[1][1] != deviceID {
		t.Fatalf("expected deviceID %s, got %s", deviceID, rows[1][1])
	}
	if rows[1][2] != "240.50" {
		t.Fatalf("expected PVVolts 240.50, got %s", rows[1][2])
	}
	if rows[2][3] != "2200.00" {
		t.Fatalf("expected PVWatts 2200.00, got %s", rows[2][3])
	}
}

func TestPathTraversalProtection(t *testing.T) {
	tempBase := filepath.Join(os.TempDir(), fmt.Sprintf("payg-vfs-test-%d", time.Now().UnixNano()))
	defer os.RemoveAll(tempBase)

	vfs, err := NewVFSManager(tempBase)
	if err != nil {
		t.Fatalf("failed to create VFSManager: %v", err)
	}

	err = vfs.WriteJSONAtomic("../evil.json", map[string]string{"hacked": "true"})
	if err == nil {
		t.Fatal("expected error on path traversal in WriteJSONAtomic, got nil")
	}

	var target map[string]string
	err = vfs.ReadJSON("../../etc/passwd", &target)
	if err == nil {
		t.Fatal("expected error on path traversal in ReadJSON, got nil")
	}
}
