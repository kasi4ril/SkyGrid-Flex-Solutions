package usecases_test

import (
	"testing"
	"time"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/vfs_store"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/usecases"
)

func TestBatch4HardwareTamperEEPROMAndCommissioning(t *testing.T) {
	tmpVFS := t.TempDir()
	vfs, err := vfs_store.NewVFSManager(tmpVFS)
	if err != nil {
		t.Fatalf("failed to create VFS: %v", err)
	}

	tokenEngine := usecases.NewOfflineTokenEngine("test-secret")
	ledger := usecases.NewLedgerProcessor(vfs, tokenEngine)
	proc := usecases.NewTelemetryHardwareProcessor(vfs, ledger, "heartbeat-hmac-secret")

	deviceID := "DEV-8F3A-GROWATT-00421"
	contractID := "CTR-NG-2026-004"

	ledger.RegisterContract(usecases.ContractState{
		ContractID:             contractID,
		CustomerID:             "CUST-004",
		DeviceID:               deviceID,
		GrowattSerial:          "GW-SPF5000ES-99881",
		TotalPriceKobo:         4450000 * 100,
		MonthlyInstallmentKobo: 145000 * 100,
		PaidUntilAt:            time.Now().UTC().Add(15 * 24 * time.Hour),
		Status:                 "ACTIVE",
	})

	// 1. Test Earthing Resistance Guardrail (> 5.0 Ohms must be rejected)
	_, err = proc.CommissionDevice(usecases.FieldCommissioningRequest{
		ContractID:               contractID,
		DeviceID:                 deviceID,
		GrowattSerial:            "GW-SPF5000ES-99881",
		BatterySerial:            "LFP-512V-100AH-441",
		EdgeControllerIMEI:       "864209051123456",
		LowerShroudSealSerial:    "SEAL-NG-00421",
		ModelSKU:                 "GROWATT_SPF_5000ES",
		EarthingResistanceOhms:   8.5, // Unsafe earthing!
		TamperSwitchVerifiedSeal: true,
	})
	if err == nil {
		t.Fatal("expected commissioning with 8.5 Ohms earthing resistance to be rejected")
	}

	// 2. Test Valid Commissioning (< 5.0 Ohms)
	_, err = proc.CommissionDevice(usecases.FieldCommissioningRequest{
		ContractID:               contractID,
		DeviceID:                 deviceID,
		GrowattSerial:            "GW-SPF5000ES-99881",
		BatterySerial:            "LFP-512V-100AH-441",
		EdgeControllerIMEI:       "864209051123456",
		LowerShroudSealSerial:    "SEAL-NG-00421",
		ModelSKU:                 "GROWATT_SPF_5000ES",
		EarthingResistanceOhms:   2.3, // Safe earthing (< 5.0 Ohms)
		TamperSwitchVerifiedSeal: true,
	})
	if err != nil {
		t.Fatalf("expected valid commissioning to succeed, got: %v", err)
	}

	// 3. Test Growatt EEPROM Flash Wear Protection on 15-Minute Stay-Alive Heartbeats
	paidUntil := time.Now().UTC().Add(15 * 24 * time.Hour)
	hb1 := proc.BuildStayAliveHeartbeat(deviceID, contractID, paidUntil, "ACTIVE")
	if !hb1.WriteModbusTransition {
		t.Error("expected first heartbeat transition to set WriteModbusTransition=true")
	}

	// Subsequent steady-state 15-minute heartbeats MUST NOT write to EEPROM flash
	hb2 := proc.BuildStayAliveHeartbeat(deviceID, contractID, paidUntil, "ACTIVE")
	if hb2.WriteModbusTransition {
		t.Error("EEPROM WEAR BUG: steady-state heartbeat set WriteModbusTransition=true")
	}

	// 4. Test Lower Terminal Shroud Tamper Switch Instant Lockout
	stateAfterTamper, err := proc.IngestTelemetryFrame(usecases.EdgeTelemetryPayload{
		DeviceID:      deviceID,
		ContractID:    contractID,
		PVVolts:       320.0,
		PVWatts:       2800.0,
		BatterySoCPct: 90.0,
		InverterTempC: 38.0,
		TamperPinHigh: true, // Physical breach of lower terminal shroud!
	})
	if err != nil {
		t.Fatalf("IngestTelemetryFrame failed: %v", err)
	}
	if stateAfterTamper.RelayState != "STANDBY_LOCKED" || stateAfterTamper.TamperSwitchState != "TRIPPED" {
		t.Fatalf("expected immediate STANDBY_LOCKED & TRIPPED state upon tamper, got %+v", stateAfterTamper)
	}

	// Heartbeat after tamper must trigger a single Modbus transition to STANDBY_LOCKED while keeping MPPT active
	hbTamper := proc.BuildStayAliveHeartbeat(deviceID, contractID, paidUntil, "LOCKED_TAMPER")
	if !hbTamper.WriteModbusTransition || hbTamper.TargetRelayState != "STANDBY_LOCKED" {
		t.Errorf("expected transition to STANDBY_LOCKED on tamper heartbeat, got %+v", hbTamper)
	}
	if !hbTamper.MPPTChargerActive {
		t.Error("expected MPPTChargerActive=true during lockout to prevent parasitic LiFePO4 battery drain")
	}
}