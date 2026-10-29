package usecases

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"fmt"
	"strings"
	"time"
)

// OfflineUnlockToken represents a generated 20-digit cryptographic keypad/BLE token.
type OfflineUnlockToken struct {
	ContractID           string    `json:"contract_id"`
	DeviceID             string    `json:"device_id"`
	SequenceCounter      int64     `json:"sequence_counter"`
	Formatted20DigitCode string    `json:"formatted_20_digit_code"` // e.g., "4829-1049-3821-9044-1182"
	TokenHashHex         string    `json:"token_hash_hex"`          // Stored in PostgreSQL (never store raw token unmasked)
	EnergySecondsGranted int64     `json:"energy_seconds_granted"`
	GeneratedAt          time.Time `json:"generated_at"`
}

// OfflineTokenEngine generates and validates deterministic, replay-proof 20-digit
// unlock tokens bound to a specific Growatt device serial and monotonic sequence counter.
//
// Embedded Hardware Verification Logic:
// The edge controller inside the sealed Growatt lower shroud shares a burned-in
// root key derived from (MasterFactoryKey + GrowattSerial + EdgeControllerIMEI).
// Because the token embeds the monotonic SequenceCounter and EnergyHours, a token
// can NEVER be replayed twice or used on a neighbor's inverter.
type OfflineTokenEngine struct {
	masterFactorySecret []byte
}

// NewOfflineTokenEngine creates a new token generator initialized with the factory root key.
func NewOfflineTokenEngine(masterSecret string) *OfflineTokenEngine {
	if strings.TrimSpace(masterSecret) == "" {
		masterSecret = "skytron-growatt-sts-master-key-2026"
	}
	return &OfflineTokenEngine{
		masterFactorySecret: []byte(masterSecret),
	}
}

// GenerateToken produces a 20-digit STS-inspired numeric unlock code for a cleared payment.
// Digit Layout (20 Digits):
// - Digits 01..04: Monotonic Sequence Counter (0001 to 9999) — prevents replay attacks
// - Digits 05..09: Energy Hours Granted (00001 to 99999 hours)
// - Digits 10..20: 11-digit Cryptographic HMAC-SHA256 Truncated MAC over (DeviceID + GrowattSerial + Counter + Hours)
func (e *OfflineTokenEngine) GenerateToken(
	contractID string,
	deviceID string,
	growattSerial string,
	sequenceCounter int64,
	energySecondsGranted int64,
) (*OfflineUnlockToken, error) {
	if sequenceCounter <= 0 {
		return nil, errors.New("sequence_counter must be >= 1 to prevent token replay")
	}
	if energySecondsGranted <= 0 {
		return nil, errors.New("energy_seconds_granted must be positive")
	}

	energyHours := energySecondsGranted / 3600
	if energyHours <= 0 {
		energyHours = 1
	}
	if energyHours > 99999 {
		energyHours = 99999
	}

	counterMod := sequenceCounter % 10000
	macDigits := e.compute11DigitMAC(deviceID, growattSerial, counterMod, energyHours)

	raw20Digits := fmt.Sprintf("%04d%05d%s", counterMod, energyHours, macDigits)
	formatted := fmt.Sprintf(
		"%s-%s-%s-%s-%s",
		raw20Digits[0:4],
		raw20Digits[4:8],
		raw20Digits[8:12],
		raw20Digits[12:16],
		raw20Digits[16:20],
	)

	hashSum := sha256.Sum256([]byte(raw20Digits + ":" + deviceID))

	return &OfflineUnlockToken{
		ContractID:           contractID,
		DeviceID:             deviceID,
		SequenceCounter:      sequenceCounter,
		Formatted20DigitCode: formatted,
		TokenHashHex:         fmt.Sprintf("%x", hashSum[:]),
		EnergySecondsGranted: energySecondsGranted,
		GeneratedAt:          time.Now().UTC(),
	}, nil
}

// VerifyTokenOnEdge simulates the exact verification algorithm running in C/Golang
// on the sealed Growatt edge controller when a customer enters a 20-digit code via
// keypad or Bluetooth Low Energy (BLE).
func (e *OfflineTokenEngine) VerifyTokenOnEdge(
	deviceID string,
	growattSerial string,
	lastRedeemedCounter int64,
	inputToken string,
) (newCounter int64, grantedSeconds int64, err error) {
	clean := strings.ReplaceAll(strings.ReplaceAll(strings.TrimSpace(inputToken), "-", ""), " ", "")
	if len(clean) != 20 {
		return 0, 0, errors.New("invalid token length: must be exactly 20 numeric digits")
	}

	var parsedCounter, parsedHours int64
	if _, err := fmt.Sscanf(clean[0:4], "%04d", &parsedCounter); err != nil {
		return 0, 0, errors.New("malformed sequence counter digits")
	}
	if _, err := fmt.Sscanf(clean[4:9], "%05d", &parsedHours); err != nil {
		return 0, 0, errors.New("malformed energy hours digits")
	}

	// Anti-replay invariant: token counter must be strictly greater than last redeemed counter
	if parsedCounter <= (lastRedeemedCounter % 10000) {
		return 0, 0, fmt.Errorf("replay attack rejected: token sequence %d already used (last=%d)", parsedCounter, lastRedeemedCounter)
	}

	expectedMAC := e.compute11DigitMAC(deviceID, growattSerial, parsedCounter, parsedHours)
	providedMAC := clean[9:20]

	if !hmac.Equal([]byte(expectedMAC), []byte(providedMAC)) {
		return 0, 0, errors.New("cryptographic MAC mismatch: token forged or belongs to another inverter")
	}

	return parsedCounter, parsedHours * 3600, nil
}

func (e *OfflineTokenEngine) compute11DigitMAC(deviceID, growattSerial string, counter, hours int64) string {
	// Derive per-device key
	deviceKeyMAC := hmac.New(sha256.New, e.masterFactorySecret)
	deviceKeyMAC.Write([]byte(strings.TrimSpace(deviceID) + "|" + strings.TrimSpace(growattSerial)))
	deviceKey := deviceKeyMAC.Sum(nil)

	// Sign (counter || hours)
	msgMAC := hmac.New(sha256.New, deviceKey)
	payload := fmt.Sprintf("CNT:%04d|HRS:%05d", counter, hours)
	msgMAC.Write([]byte(payload))
	digest := msgMAC.Sum(nil)

	// Convert first 8 bytes into a deterministic 11-digit decimal string
	val := binary.BigEndian.Uint64(digest[0:8]) % 100000000000
	return fmt.Sprintf("%011d", val)
}