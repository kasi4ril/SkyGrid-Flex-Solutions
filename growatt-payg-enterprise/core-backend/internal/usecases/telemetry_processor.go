// Package usecases implements the hardware telemetry ingestion, anti-tamper lockout,
// Growatt EEPROM flash wear protection, and field engineering commissioning logic.
package usecases

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/vfs_store"
)

// MaxSafeEarthingResistanceOhms enforces the Nigerian electrical safety standard:
// Surge arrestors and Growatt MPPT boards require earthing resistance <= 5.0 Ohms
// to survive tropical lightning transients.
const MaxSafeEarthingResistanceOhms = 5.0

// EdgeTelemetryPayload represents the JSON telemetry frame published every 5 minutes
// by the edge Modbus/IoT controller over EMQX topic `devices/{device_id}/telemetry`
// or batch-uploaded from the 7-day local flash buffer after a cellular blackout.
type EdgeTelemetryPayload struct {
	DeviceID          string  `json:"device_id"`
	ContractID        string  `json:"contract_id"`
	TimestampUnix     int64   `json:"timestamp_unix"`
	PVVolts           float64 `json:"pv_volts"`
	PVWatts           float64 `json:"pv_watts"`
	ACOutputWatts     float64 `json:"ac_output_watts"`
	ACGridVolts       float64 `json:"ac_grid_volts"`
	BatteryVolts      float64 `json:"battery_volts"`
	BatterySoCPct     float64 `json:"battery_soc_pct"`
	InverterTempC     float64 `json:"inverter_temp_c"`
	GrowattStatusCode int     `json:"growatt_status_code"` // 0:Waiting, 1:Normal, 3:Fault, 5:PV+Discharge
	GrowattFaultCode  int     `json:"growatt_fault_code"`  // e.g., 09:Bus Soft Start, 58:Output Voltage Low
	TamperPinHigh     bool    `json:"tamper_pin_high"`     // Micro-plunger switch inside lower terminal shroud
}

// StayAliveHeartbeatPacket is published every 15 minutes to `devices/{device_id}/heartbeat`.
// The edge controller inside the sealed lower shroud maintains a local countdown timer;
// if the customer defaults OR jams the GSM antenna, the local timer hits zero and cuts AC output.
type StayAliveHeartbeatPacket struct {
	DeviceID                string `json:"device_id"`
	ContractID              string `json:"contract_id"`
	PaidUntilUnix           int64  `json:"paid_until_unix"`
	TargetRelayState        string `json:"target_relay_state"`      // ACTIVE_ON or STANDBY_LOCKED
	MPPTChargerActive       bool   `json:"mppt_charger_active"`     // Always TRUE to prevent battery drain during lockout
	WriteModbusTransition   bool   `json:"write_modbus_transition"` // TRUE only on state transition to save EEPROM flash
	IssuedAtUnix            int64  `json:"issued_at_unix"`
	CryptographicHMACSHA256 string `json:"cryptographic_hmac_sha256"` // Prevents forged local MQTT packets
}

// FieldCommissioningRequest captures the installer's on-site audit and barcode provisioning data.
type FieldCommissioningRequest struct {
	QuoteID                  string   `json:"quote_id"`
	ContractID               string   `json:"contract_id"`
	DeviceID                 string   `json:"device_id"`
	FieldEngineerID          string   `json:"field_engineer_id"`
	GrowattSerial            string   `json:"growatt_serial"`
	BatterySerial            string   `json:"battery_serial"`
	EdgeControllerIMEI       string   `json:"edge_controller_imei"`
	BLEMacAddress            string   `json:"ble_mac_address"`
	LowerShroudSealSerial    string   `json:"lower_shroud_seal_serial"`
	ModelSKU                 string   `json:"model_sku"`
	GPSLat                   float64  `json:"gps_lat"`
	GPSLng                   float64  `json:"gps_lng"`
	LocalPSHFactor           float64  `json:"local_psh_factor"`
	RoofAzimuthDeg           float64  `json:"roof_azimuth_deg"`
	RoofTiltDeg              float64  `json:"roof_tilt_deg"`
	EarthingResistanceOhms   float64  `json:"earthing_resistance_ohms"`
	TamperSwitchVerifiedSeal bool     `json:"tamper_switch_verified_seal"`
	AuditPhotoURLs           []string `json:"audit_photo_urls"`
}

// RMASwapRequest records a warranty replacement of a Growatt inverter or security seal
// while keeping the customer's contract_id and VFS telemetry directory intact.
type RMASwapRequest struct {
	DeviceID         string `json:"device_id"`
	OldGrowattSerial string `json:"old_growatt_serial"`
	NewGrowattSerial string `json:"new_growatt_serial"`
	OldSealSerial    string `json:"old_seal_serial"`
	NewSealSerial    string `json:"new_seal_serial"`
	Reason           string `json:"reason"`
	FieldEngineerID  string `json:"field_engineer_id"`
}

// FleetDeviceStatus aggregates real-time GIS, electrical, and tamper telemetry for Admin Command.
type FleetDeviceStatus struct {
	DeviceID              string  `json:"device_id"`
	ContractID            string  `json:"contract_id"`
	CustomerName          string  `json:"customer_name"`
	City                  string  `json:"city"`
	ModelSKU              string  `json:"model_sku"`
	GrowattSerial         string  `json:"growatt_serial"`
	LowerShroudSealSerial string  `json:"lower_shroud_seal_serial"`
	GPSLat                float64 `json:"gps_lat"`
	GPSLng                float64 `json:"gps_lng"`
	PinColor              string  `json:"pin_color"` // GREEN (Active), YELLOW (Due/Low Batt), RED (Tamper/Default)
	ContractStatus        string  `json:"contract_status"`
	RelayState            string  `json:"relay_state"`
	TamperSwitchState     string  `json:"tamper_switch_state"`
	BatterySoCPct         float64 `json:"battery_soc_pct"`
	PVWatts               float64 `json:"pv_watts"`
	ACOutputWatts         float64 `json:"ac_output_watts"`
	InverterTempC         float64 `json:"inverter_temp_c"`
	PaidUntilUnix         int64   `json:"paid_until_unix"`
	LastHeartbeatAt       string  `json:"last_heartbeat_at"`
}

// TelemetryHardwareProcessor manages incoming MQTT telemetry, EEPROM-safe relay transitions,
// 15-minute heartbeats, commissioning verification, and RMA swaps.
type TelemetryHardwareProcessor struct {
	mu                sync.RWMutex
	vfs               *vfs_store.VFSManager
	ledger            *LedgerProcessor
	heartbeatSecret   []byte
	lastRelayStateMap map[string]string // device_id -> last hardware relay state (protects EEPROM)
	fleetStatusMap    map[string]*FleetDeviceStatus
	rmaHistory        []RMASwapRequest
}

// NewTelemetryHardwareProcessor initializes the hardware telemetry and heartbeat coordinator.
func NewTelemetryHardwareProcessor(
	vfs *vfs_store.VFSManager,
	ledger *LedgerProcessor,
	heartbeatSecret string,
) *TelemetryHardwareProcessor {
	if heartbeatSecret == "" {
		heartbeatSecret = "skytron-mqtt-heartbeat-hmac-key-2026"
	}
	return &TelemetryHardwareProcessor{
		vfs:               vfs,
		ledger:            ledger,
		heartbeatSecret:   []byte(heartbeatSecret),
		lastRelayStateMap: make(map[string]string),
		fleetStatusMap:    make(map[string]*FleetDeviceStatus),
	}
}

// IngestTelemetryFrame processes a 5-minute telemetry packet from EMQX MQTT:
//  1. Appends the raw sensor frame to the VFS Write-Ahead Log (`telemetry_wal/YYYY-MM-DD.csv`).
//  2. Checks `TamperPinHigh`: if the lower terminal box micro-plunger switch is tripped,
//     immediately transitions the contract to `LOCKED_TAMPER` and forces `STANDBY_LOCKED`.
//  3. Updates VFS `state.json` atomically so the Customer App and Admin Command see live telemetry.
func (tp *TelemetryHardwareProcessor) IngestTelemetryFrame(
	payload EdgeTelemetryPayload,
) (*vfs_store.DeviceDynamicState, error) {
	if payload.DeviceID == "" {
		return nil, errors.New("telemetry payload missing device_id")
	}

	ts := time.Now().UTC()
	if payload.TimestampUnix > 0 {
		ts = time.Unix(payload.TimestampUnix, 0).UTC()
	}

	// 1. Append to daily VFS Write-Ahead Log (supports 7-day edge store-and-forward batch uploads)
	walFrame := vfs_store.TelemetryFrame{
		Timestamp:         ts,
		DeviceID:          payload.DeviceID,
		PVVolts:           payload.PVVolts,
		PVWatts:           payload.PVWatts,
		ACOutputWatts:     payload.ACOutputWatts,
		ACGridVolts:       payload.ACGridVolts,
		BatteryVolts:      payload.BatteryVolts,
		BatterySoCPct:     payload.BatterySoCPct,
		InverterTempC:     payload.InverterTempC,
		GrowattStatusCode: payload.GrowattStatusCode,
		GrowattFaultCode:  payload.GrowattFaultCode,
		TamperPinHigh:     payload.TamperPinHigh,
	}
	if tp.vfs != nil {
		if err := tp.vfs.AppendTelemetryWAL(walFrame); err != nil {
			return nil, fmt.Errorf("failed to append telemetry WAL: %w", err)
		}
	}

	tp.mu.Lock()
	defer tp.mu.Unlock()

	relayState := "ACTIVE_ON"
	tamperState := "SEALED"
	var paidUntilUnix int64 = ts.Add(72 * time.Hour).Unix()
	contractStatus := "ACTIVE"

	// Lookup contract countdown from LedgerProcessor if registered
	if tp.ledger != nil && payload.ContractID != "" {
		for _, c := range tp.ledger.ListActiveContracts() {
			if c.ContractID == payload.ContractID {
				paidUntilUnix = c.PaidUntilAt.Unix()
				contractStatus = c.Status
				if c.Status == "LOCKED_DEFAULT" || c.Status == "LOCKED_TAMPER" {
					relayState = "STANDBY_LOCKED"
				}
				break
			}
		}
	}

	// 2. Anti-Tamper Watchtower Rule: Immediate lockout if lower shroud seal is breached
	if payload.TamperPinHigh {
		tamperState = "TRIPPED"
		relayState = "STANDBY_LOCKED"
		contractStatus = "LOCKED_TAMPER"
		if tp.ledger != nil && payload.ContractID != "" {
			_ = tp.ledger.UpdateContractStatus(payload.ContractID, "LOCKED_TAMPER")
		}
	} else if payload.GrowattFaultCode > 0 {
		relayState = "FAULT_OFF"
	}

	dynamicState := vfs_store.DeviceDynamicState{
		DeviceID:             payload.DeviceID,
		RelayState:           relayState,
		TamperSwitchState:    tamperState,
		PaidUntilUnix:        paidUntilUnix,
		LastHeartbeatUnix:    ts.Unix(),
		BatterySoCPct:        payload.BatterySoCPct,
		PVWatts:              payload.PVWatts,
		ACOutputWatts:        payload.ACOutputWatts,
		InverterTempC:        payload.InverterTempC,
		GrowattFaultCode:     payload.GrowattFaultCode,
		HarmattanDustWarning: false,
		UpdatedAt:            ts.Format(time.RFC3339),
	}

	if tp.vfs != nil {
		if err := tp.vfs.WriteDeviceState(payload.DeviceID, dynamicState); err != nil {
			return nil, fmt.Errorf("failed to update VFS state.json: %w", err)
		}
	}

	// Update in-memory GIS Fleet Map pin state
	pinColor := "GREEN"
	if tamperState == "TRIPPED" || contractStatus == "LOCKED_DEFAULT" || relayState == "FAULT_OFF" {
		pinColor = "RED"
	} else if payload.BatterySoCPct < 25.0 || contractStatus == "GRACE_PERIOD" {
		pinColor = "YELLOW"
	}

	existing, exists := tp.fleetStatusMap[payload.DeviceID]
	if !exists {
		existing = &FleetDeviceStatus{
			DeviceID:     payload.DeviceID,
			ContractID:   payload.ContractID,
			CustomerName: "Fleet Customer",
			City:         "Abuja / Middle Belt",
			ModelSKU:     "GROWATT_SPF_5000ES",
			GPSLat:       9.0765,
			GPSLng:       7.3986,
		}
		tp.fleetStatusMap[payload.DeviceID] = existing
	}
	existing.PinColor = pinColor
	existing.ContractStatus = contractStatus
	existing.RelayState = relayState
	existing.TamperSwitchState = tamperState
	existing.BatterySoCPct = payload.BatterySoCPct
	existing.PVWatts = payload.PVWatts
	existing.ACOutputWatts = payload.ACOutputWatts
	existing.InverterTempC = payload.InverterTempC
	existing.PaidUntilUnix = paidUntilUnix
	existing.LastHeartbeatAt = ts.Format(time.RFC3339)

	return &dynamicState, nil
}

// BuildStayAliveHeartbeat generates the encrypted 15-minute Stay-Alive Heartbeat packet
// for a device.
//
// Growatt EEPROM Flash Protection Invariant:
// `WriteModbusTransition` is set to TRUE *only* when TargetRelayState differs from
// the previous state sent to the inverter. During steady-state 15-minute heartbeats,
// the edge controller updates `paid_until_unix` strictly in RAM without writing to
// the Growatt's 100,000-cycle EEPROM flash memory.
func (tp *TelemetryHardwareProcessor) BuildStayAliveHeartbeat(
	deviceID string,
	contractID string,
	paidUntil time.Time,
	contractStatus string,
) StayAliveHeartbeatPacket {
	tp.mu.Lock()
	defer tp.mu.Unlock()

	now := time.Now().UTC()
	targetRelay := "ACTIVE_ON"
	if contractStatus == "LOCKED_DEFAULT" || contractStatus == "LOCKED_TAMPER" || paidUntil.Before(now.Add(-48*time.Hour)) {
		targetRelay = "STANDBY_LOCKED"
	}

	// Check if relay state changed since last heartbeat to protect EEPROM flash
	prevRelay, seenBefore := tp.lastRelayStateMap[deviceID]
	shouldWriteModbus := !seenBefore || (prevRelay != targetRelay)
	tp.lastRelayStateMap[deviceID] = targetRelay

	paidUnix := paidUntil.Unix()
	issuedUnix := now.Unix()

	mac := hmac.New(sha256.New, tp.heartbeatSecret)
	mac.Write([]byte(fmt.Sprintf("%s|%s|%d|%s|%d", deviceID, contractID, paidUnix, targetRelay, issuedUnix)))
	sigHex := hex.EncodeToString(mac.Sum(nil))

	return StayAliveHeartbeatPacket{
		DeviceID:                deviceID,
		ContractID:              contractID,
		PaidUntilUnix:           paidUnix,
		TargetRelayState:        targetRelay,
		MPPTChargerActive:       true, // Always keep Solar MPPT active during lockout so LiFePO4 stays at 80-100% SoC
		WriteModbusTransition:   shouldWriteModbus,
		IssuedAtUnix:            issuedUnix,
		CryptographicHMACSHA256: sigHex,
	}
}

// CommissionDevice validates the Field Engineer's physical installation checklist
// (enforcing < 5.0 Ohms earthing resistance and verified lower shroud tamper seal)
// and provisions the immutable VFS device block (`identity.json` + initial `state.json`).
func (tp *TelemetryHardwareProcessor) CommissionDevice(
	req FieldCommissioningRequest,
) (*FleetDeviceStatus, error) {
	if req.DeviceID == "" {
		req.DeviceID = fmt.Sprintf("DEV-%s-GROWATT", generateUUID()[0:8])
	}
	if req.GrowattSerial == "" || req.BatterySerial == "" || req.LowerShroudSealSerial == "" {
		return nil, errors.New("growatt_serial, battery_serial, and lower_shroud_seal_serial are mandatory")
	}

	// Electrical Engineering Protection Rule: Reject unsafe earthing resistance
	if req.EarthingResistanceOhms <= 0 || req.EarthingResistanceOhms > MaxSafeEarthingResistanceOhms {
		return nil, fmt.Errorf(
			"commissioning rejected: earthing resistance (%.2f Ohms) exceeds maximum safe threshold (%.1f Ohms) required for Growatt surge protection",
			req.EarthingResistanceOhms, MaxSafeEarthingResistanceOhms,
		)
	}

	if !req.TamperSwitchVerifiedSeal {
		return nil, errors.New("commissioning rejected: lower terminal security shroud micro-plunger switch must be verified in SEALED state")
	}

	now := time.Now().UTC()
	identity := vfs_store.DeviceIdentity{
		DeviceID:              req.DeviceID,
		GrowattSerial:         req.GrowattSerial,
		BatterySerial:         req.BatterySerial,
		EdgeControllerIMEI:    req.EdgeControllerIMEI,
		LowerShroudSealSerial: req.LowerShroudSealSerial,
		ModelSKU:              req.ModelSKU,
		GPSLat:                req.GPSLat,
		GPSLng:                req.GPSLng,
		LocalPSHFactor:        req.LocalPSHFactor,
		InstalledAt:           now.Format(time.RFC3339),
	}

	if tp.vfs != nil {
		if _, err := tp.vfs.InitializeDeviceBlock(identity); err != nil {
			return nil, fmt.Errorf("failed to initialize VFS device block: %w", err)
		}
	}

	tp.mu.Lock()
	defer tp.mu.Unlock()

	status := &FleetDeviceStatus{
		DeviceID:              req.DeviceID,
		ContractID:            req.ContractID,
		CustomerName:          "Commissioned PAYG Customer",
		City:                  "Verified Site",
		ModelSKU:              req.ModelSKU,
		GrowattSerial:         req.GrowattSerial,
		LowerShroudSealSerial: req.LowerShroudSealSerial,
		GPSLat:                req.GPSLat,
		GPSLng:                req.GPSLng,
		PinColor:              "GREEN",
		ContractStatus:        "ACTIVE",
		RelayState:            "ACTIVE_ON",
		TamperSwitchState:     "SEALED",
		BatterySoCPct:         94.0,
		PVWatts:               1850.0,
		ACOutputWatts:         620.0,
		InverterTempC:         36.5,
		PaidUntilUnix:         now.Add(30 * 24 * time.Hour).Unix(),
		LastHeartbeatAt:       now.Format(time.RFC3339),
	}
	tp.fleetStatusMap[req.DeviceID] = status

	return status, nil
}

// ExecuteRMASwap replaces a faulty Growatt inverter serial number and lower shroud
// seal serial on an active device while preserving its VFS block and contract history.
func (tp *TelemetryHardwareProcessor) ExecuteRMASwap(req RMASwapRequest) (*FleetDeviceStatus, error) {
	tp.mu.Lock()
	defer tp.mu.Unlock()

	dev, ok := tp.fleetStatusMap[req.DeviceID]
	if !ok {
		return nil, fmt.Errorf("device %s not found in active fleet", req.DeviceID)
	}
	if req.NewGrowattSerial == "" || req.NewSealSerial == "" {
		return nil, errors.New("new_growatt_serial and new_seal_serial are required for RMA swap")
	}

	dev.GrowattSerial = req.NewGrowattSerial
	dev.LowerShroudSealSerial = req.NewSealSerial
	dev.RelayState = "ACTIVE_ON"
	dev.TamperSwitchState = "SEALED"
	dev.PinColor = "GREEN"

	tp.rmaHistory = append(tp.rmaHistory, req)
	return dev, nil
}

// GetFleetOverview returns all tracked devices for the Admin Command GIS map.
func (tp *TelemetryHardwareProcessor) GetFleetOverview() []FleetDeviceStatus {
	tp.mu.RLock()
	defer tp.mu.RUnlock()

	out := make([]FleetDeviceStatus, 0, len(tp.fleetStatusMap))
	for _, d := range tp.fleetStatusMap {
		out = append(out, *d)
	}
	return out
}
