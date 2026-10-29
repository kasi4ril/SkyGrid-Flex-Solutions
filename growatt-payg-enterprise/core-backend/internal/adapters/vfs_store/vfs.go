package vfs_store

import (
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// DefaultVFSRoot is the production POSIX block store mount path.
const DefaultVFSRoot = "/var/lib/payg-vfs"

// DeviceIdentity represents the immutable identity.json file in the device VFS block.
type DeviceIdentity struct {
	DeviceID              string  `json:"device_id"`
	GrowattSerial         string  `json:"growatt_serial"`
	BatterySerial         string  `json:"battery_serial"`
	EdgeControllerIMEI    string  `json:"edge_controller_imei"`
	LowerShroudSealSerial string  `json:"lower_shroud_seal_serial"`
	ModelSKU              string  `json:"model_sku"`
	GPSLat                float64 `json:"gps_lat"`
	GPSLng                float64 `json:"gps_lng"`
	LocalPSHFactor        float64 `json:"local_psh_factor"`
	InstalledAt           string  `json:"installed_at"`
}

// DeviceDynamicState represents state.json updated atomically by MQTT gateway & heartbeats.
type DeviceDynamicState struct {
	DeviceID             string  `json:"device_id"`
	RelayState           string  `json:"relay_state"`            // ACTIVE_ON, STANDBY_LOCKED, FAULT_OFF
	TamperSwitchState    string  `json:"tamper_switch_state"`    // SEALED, TRIPPED
	PaidUntilUnix        int64   `json:"paid_until_unix"`        // Dead-man's switch local countdown target
	LastHeartbeatUnix    int64   `json:"last_heartbeat_unix"`    // Last 15-min Stay-Alive Heartbeat
	BatterySoCPct        float64 `json:"battery_soc_pct"`
	PVWatts              float64 `json:"pv_watts"`
	ACOutputWatts        float64 `json:"ac_output_watts"`
	InverterTempC        float64 `json:"inverter_temp_c"`
	GrowattFaultCode     int     `json:"growatt_fault_code"`
	HarmattanDustWarning bool    `json:"harmattan_dust_warning"`
	UpdatedAt            string  `json:"updated_at"`
}

// LedgerSnapshot represents ledger_snap.json updated atomically upon cleared webhook payments.
type LedgerSnapshot struct {
	ContractID           string  `json:"contract_id"`
	DeviceID             string  `json:"device_id"`
	ContractStatus       string  `json:"contract_status"`
	PaidDaysRemaining    float64 `json:"paid_days_remaining"`
	PaidUntilISO         string  `json:"paid_until_iso"`
	TotalPaidKobo        int64   `json:"total_paid_kobo"`
	RemainingBalanceKobo int64   `json:"remaining_balance_kobo"`
	NextInstallmentKobo  int64   `json:"next_installment_kobo"`
	LastTxRef            string  `json:"last_tx_ref"`
	LastOfflineToken     string  `json:"last_offline_token,omitempty"`
	UpdatedAt            string  `json:"updated_at"`
}

// TelemetryFrame represents a single 5-minute sensor frame appended to telemetry_wal.
type TelemetryFrame struct {
	Timestamp         time.Time
	DeviceID          string
	PVVolts           float64
	PVWatts           float64
	ACOutputWatts     float64
	ACGridVolts       float64
	BatteryVolts      float64
	BatterySoCPct     float64
	InverterTempC     float64
	GrowattStatusCode int
	GrowattFaultCode  int
	TamperPinHigh     bool
}

// VFSManager coordinates thread-safe, atomic POSIX file operations across device blocks.
type VFSManager struct {
	baseDir string
	locks   sync.Map // map[string]*sync.RWMutex keyed by resolved file path
}

// NewVFSManager initializes the VFS directory hierarchy.
func NewVFSManager(baseDir string) (*VFSManager, error) {
	if strings.TrimSpace(baseDir) == "" {
		baseDir = DefaultVFSRoot
	}
	absBase, err := filepath.Abs(baseDir)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve absolute VFS path: %w", err)
	}

	for _, sub := range []string{"catalog", "blocks"} {
		if err := os.MkdirAll(filepath.Join(absBase, sub), 0750); err != nil {
			return nil, fmt.Errorf("failed to create VFS subdirectory %s: %w", sub, err)
		}
	}

	return &VFSManager{
		baseDir: absBase,
	}, nil
}

// ResolveDeviceBlockDir computes the deterministic 2-level hexadecimal hash path:
// {baseDir}/blocks/{h1}/{h2}/{deviceID}
func (v *VFSManager) ResolveDeviceBlockDir(deviceID string) (string, error) {
	cleanID := strings.TrimSpace(deviceID)
	if cleanID == "" || strings.Contains(cleanID, "..") || strings.ContainsAny(cleanID, `/\`) {
		return "", errors.New("invalid or unsafe device_id for VFS resolution")
	}

	hash := sha256.Sum256([]byte(cleanID))
	hexStr := hex.EncodeToString(hash[:])
	h1 := hexStr[0:2]
	h2 := hexStr[2:4]

	return filepath.Join(v.baseDir, "blocks", h1, h2, cleanID), nil
}

// InitializeDeviceBlock provisions the full directory tree for a newly commissioned Growatt unit
// and writes the immutable identity.json file if it does not already exist.
func (v *VFSManager) InitializeDeviceBlock(identity DeviceIdentity) (string, error) {
	blockDir, err := v.ResolveDeviceBlockDir(identity.DeviceID)
	if err != nil {
		return "", err
	}

	subdirs := []string{
		blockDir,
		filepath.Join(blockDir, "forecasts"),
		filepath.Join(blockDir, "telemetry_wal"),
		filepath.Join(blockDir, "audit_vault"),
	}

	for _, dir := range subdirs {
		if err := os.MkdirAll(dir, 0750); err != nil {
			return "", fmt.Errorf("failed to provision VFS directory %s: %w", dir, err)
		}
	}

	identityRelPath, err := filepath.Rel(v.baseDir, filepath.Join(blockDir, "identity.json"))
	if err != nil {
		return "", err
	}

	// Immutable guardrail: do not overwrite identity.json if already commissioned
	fullIdentityPath := filepath.Join(v.baseDir, identityRelPath)
	if _, err := os.Stat(fullIdentityPath); err == nil {
		return blockDir, nil
	}

	if err := v.WriteJSONAtomic(identityRelPath, identity); err != nil {
		return "", fmt.Errorf("failed to write immutable identity.json: %w", err)
	}

	return blockDir, nil
}

// WriteJSONAtomic serializes payload to a temporary file in the same directory,
// executes fsync on both the file descriptor and parent directory, and performs
// an atomic POSIX os.Rename() to guarantee readers never see partial writes.
func (v *VFSManager) WriteJSONAtomic(relPath string, payload any) error {
	targetPath, err := v.sanitizeRelPath(relPath)
	if err != nil {
		return err
	}

	mu := v.getPathMutex(targetPath)
	mu.Lock()
	defer mu.Unlock()

	parentDir := filepath.Dir(targetPath)
	if err := os.MkdirAll(parentDir, 0750); err != nil {
		return fmt.Errorf("failed to ensure parent directory: %w", err)
	}

	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON payload: %w", err)
	}
	data = append(data, '\n')

	// Create a unique temporary file in the exact same directory (same POSIX filesystem/mount)
	tmpFile, err := os.CreateTemp(parentDir, filepath.Base(targetPath)+".*.tmp")
	if err != nil {
		return fmt.Errorf("failed to create atomic temp file: %w", err)
	}
	tmpPath := tmpFile.Name()

	cleanupTmp := func() {
		_ = tmpFile.Close()
		_ = os.Remove(tmpPath)
	}

	if _, err := tmpFile.Write(data); err != nil {
		cleanupTmp()
		return fmt.Errorf("failed to write payload to temp file: %w", err)
	}

	if err := tmpFile.Chmod(0640); err != nil {
		cleanupTmp()
		return fmt.Errorf("failed to chmod temp file: %w", err)
	}

	// Flush file buffers to physical disk
	if err := tmpFile.Sync(); err != nil {
		cleanupTmp()
		return fmt.Errorf("failed to fsync temp file: %w", err)
	}

	if err := tmpFile.Close(); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("failed to close temp file: %w", err)
	}

	// Atomic POSIX rename
	if err := os.Rename(tmpPath, targetPath); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("failed to execute atomic os.Rename: %w", err)
	}

	// Sync parent directory entry for crash durability
	if dirFD, err := os.Open(parentDir); err == nil {
		_ = dirFD.Sync()
		_ = dirFD.Close()
	}

	return nil
}

// ReadJSON safely reads and unmarshals a JSON file from the VFS into targetStruct.
func (v *VFSManager) ReadJSON(relPath string, targetStruct any) error {
	targetPath, err := v.sanitizeRelPath(relPath)
	if err != nil {
		return err
	}

	mu := v.getPathMutex(targetPath)
	mu.RLock()
	defer mu.RUnlock()

	rawBytes, err := os.ReadFile(targetPath)
	if err != nil {
		return fmt.Errorf("failed to read VFS file %s: %w", relPath, err)
	}

	if err := json.Unmarshal(rawBytes, targetStruct); err != nil {
		return fmt.Errorf("failed to unmarshal JSON from %s: %w", relPath, err)
	}

	return nil
}

// WriteDeviceState is a convenience wrapper for atomically updating a device's state.json.
func (v *VFSManager) WriteDeviceState(deviceID string, state DeviceDynamicState) error {
	blockDir, err := v.ResolveDeviceBlockDir(deviceID)
	if err != nil {
		return err
	}
	relPath, err := filepath.Rel(v.baseDir, filepath.Join(blockDir, "state.json"))
	if err != nil {
		return err
	}
	return v.WriteJSONAtomic(relPath, state)
}

// WriteLedgerSnapshot is a convenience wrapper for atomically updating ledger_snap.json.
func (v *VFSManager) WriteLedgerSnapshot(deviceID string, snap LedgerSnapshot) error {
	blockDir, err := v.ResolveDeviceBlockDir(deviceID)
	if err != nil {
		return err
	}
	relPath, err := filepath.Rel(v.baseDir, filepath.Join(blockDir, "ledger_snap.json"))
	if err != nil {
		return err
	}
	return v.WriteJSONAtomic(relPath, snap)
}

// AppendTelemetryWAL appends a 5-minute sensor telemetry frame to the daily Write-Ahead Log
// inside /var/lib/payg-vfs/blocks/{h1}/{h2}/{device_id}/telemetry_wal/YYYY-MM-DD.csv
func (v *VFSManager) AppendTelemetryWAL(frame TelemetryFrame) error {
	blockDir, err := v.ResolveDeviceBlockDir(frame.DeviceID)
	if err != nil {
		return err
	}

	walDir := filepath.Join(blockDir, "telemetry_wal")
	if err := os.MkdirAll(walDir, 0750); err != nil {
		return fmt.Errorf("failed to create telemetry_wal directory: %w", err)
	}

	ts := frame.Timestamp.UTC()
	if ts.IsZero() {
		ts = time.Now().UTC()
	}

	fileName := ts.Format("2006-01-02") + ".csv"
	walFilePath := filepath.Join(walDir, fileName)

	mu := v.getPathMutex(walFilePath)
	mu.Lock()
	defer mu.Unlock()

	isNewFile := false
	if _, err := os.Stat(walFilePath); errors.Is(err, os.ErrNotExist) {
		isNewFile = true
	}

	f, err := os.OpenFile(walFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0640)
	if err != nil {
		return fmt.Errorf("failed to open daily telemetry WAL file: %w", err)
	}
	defer f.Close()

	writer := csv.NewWriter(f)
	if isNewFile {
		header := []string{
			"timestamp_utc", "device_id", "pv_volts", "pv_watts",
			"ac_output_watts", "ac_grid_volts", "battery_volts",
			"battery_soc_pct", "inverter_temp_c", "growatt_status_code",
			"growatt_fault_code", "tamper_pin_high",
		}
		if err := writer.Write(header); err != nil {
			return fmt.Errorf("failed to write WAL CSV header: %w", err)
		}
	}

	record := []string{
		ts.Format(time.RFC3339),
		frame.DeviceID,
		fmt.Sprintf("%.2f", frame.PVVolts),
		fmt.Sprintf("%.2f", frame.PVWatts),
		fmt.Sprintf("%.2f", frame.ACOutputWatts),
		fmt.Sprintf("%.2f", frame.ACGridVolts),
		fmt.Sprintf("%.2f", frame.BatteryVolts),
		fmt.Sprintf("%.2f", frame.BatterySoCPct),
		fmt.Sprintf("%.2f", frame.InverterTempC),
		fmt.Sprintf("%d", frame.GrowattStatusCode),
		fmt.Sprintf("%d", frame.GrowattFaultCode),
		fmt.Sprintf("%t", frame.TamperPinHigh),
	}

	if err := writer.Write(record); err != nil {
		return fmt.Errorf("failed to append WAL CSV record: %w", err)
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		return fmt.Errorf("csv writer flush error: %w", err)
	}

	return f.Sync()
}

// sanitizeRelPath prevents path traversal attacks outside the VFS root.
func (v *VFSManager) sanitizeRelPath(relPath string) (string, error) {
	cleaned := filepath.Clean(relPath)
	if filepath.IsAbs(cleaned) || strings.HasPrefix(cleaned, "..") {
		return "", errors.New("security violation: path traversal outside VFS root is prohibited")
	}
	fullPath := filepath.Join(v.baseDir, cleaned)
	if !strings.HasPrefix(fullPath, v.baseDir) {
		return "", errors.New("security violation: resolved path escapes VFS root")
	}
	return fullPath, nil
}

func (v *VFSManager) getPathMutex(fullPath string) *sync.RWMutex {
	actual, _ := v.locks.LoadOrStore(fullPath, &sync.RWMutex{})
	return actual.(*sync.RWMutex)
}

