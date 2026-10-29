// Package main implements the automated Credit Clock & Lockout Enforcement Worker.
//
// Execution Cadence: Runs every 5 minutes in production (or on-demand in tests)
// to evaluate contract countdown timers, dispatch T-5d / T-1d payment reminders,
// enforce the 48-hour Grace Period, and trigger STANDBY_LOCKED state transitions
// without wearing out Growatt EEPROM flash memory.
package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/vfs_store"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/usecases"
)

// GracePeriodDuration defines the 48-hour post-expiry buffer before AC output lockout.
const GracePeriodDuration = 48 * time.Hour

// EvaluateContractCadence inspects a single contract against the current timestamp
// and returns the new status, relay state, and notification action required.
func EvaluateContractCadence(c usecases.ContractState, now time.Time) (newStatus string, relayState string, notification string) {
	// Guardrail 1: Never unlock a hardware-tampered inverter via time cadence
	if c.Status == "LOCKED_TAMPER" {
		return "LOCKED_TAMPER", "STANDBY_LOCKED", "CRITICAL_TAMPER_LOCKOUT_ACTIVE"
	}

	// Guardrail 2: Permanently owned systems (36th payment cleared) never expire
	if c.Status == "FULLY_OWNED" {
		return "FULLY_OWNED", "ACTIVE_ON", "NONE"
	}

	timeRemaining := c.PaidUntilAt.Sub(now)

	// Case A: Credit timer has expired (timeRemaining <= 0)
	if timeRemaining <= 0 {
		overdueDuration := now.Sub(c.PaidUntilAt)
		if overdueDuration <= GracePeriodDuration {
			return "GRACE_PERIOD", "ACTIVE_ON", "URGENT_GRACE_PERIOD_WARNING_48H"
		}
		// Past 48-hour grace period -> Lock AC output, keep Solar MPPT active
		return "LOCKED_DEFAULT", "STANDBY_LOCKED", "AC_OUTPUT_LOCKED_DEFAULT_MPPT_CHARGING_ACTIVE"
	}

	// Case B: Active contract with <= 24 hours left (T-1 Day Reminder with DVA details)
	if timeRemaining <= 24*time.Hour {
		return "ACTIVE", "ACTIVE_ON", "REMINDER_T_MINUS_1_DAY_WITH_DVA"
	}

	// Case C: Active contract with <= 5 days left (T-5 Days Push/SMS Reminder)
	if timeRemaining <= 5*24*time.Hour {
		return "ACTIVE", "ACTIVE_ON", "REMINDER_T_MINUS_5_DAYS"
	}

	return "ACTIVE", "ACTIVE_ON", "NONE"
}

func main() {
	vfsRoot := os.Getenv("PAYG_VFS_ROOT")
	if vfsRoot == "" {
		vfsRoot = "/tmp/payg-vfs-dev"
	}

	vfsManager, err := vfs_store.NewVFSManager(vfsRoot)
	if err != nil {
		log.Fatalf("[FATAL] Cron Scheduler failed to mount VFS at %s: %v", vfsRoot, err)
	}

	tokenEngine := usecases.NewOfflineTokenEngine(os.Getenv("STS_MASTER_SECRET"))
	ledger := usecases.NewLedgerProcessor(vfsManager, tokenEngine)

	log.Printf("[INFO] Growatt PAYG Credit Clock & Lockout Worker started (5-minute evaluation loop)")

	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	runEvaluationCycle(ledger, vfsManager)

	for {
		select {
		case <-ticker.C:
			runEvaluationCycle(ledger, vfsManager)
		case sig := <-sigChan:
			log.Printf("[INFO] Received signal %v, shutting down Credit Clock Worker cleanly", sig)
			return
		}
	}
}

func runEvaluationCycle(ledger *usecases.LedgerProcessor, vfs *vfs_store.VFSManager) {
	now := time.Now().UTC()
	contracts := ledger.ListActiveContracts()

	for _, c := range contracts {
		newStatus, targetRelayState, notif := EvaluateContractCadence(c, now)

		if newStatus != c.Status {
			_ = ledger.UpdateContractStatus(c.ContractID, newStatus)
			log.Printf("[CREDIT-CLOCK] Contract %s transitioned: %s -> %s (Relay: %s)",
				c.ContractID, c.Status, newStatus, targetRelayState)

			// Sync updated relay state to VFS state.json only on state transition
			_ = vfs.WriteDeviceState(c.DeviceID, vfs_store.DeviceDynamicState{
				DeviceID:          c.DeviceID,
				RelayState:        targetRelayState,
				TamperSwitchState: "SEALED",
				PaidUntilUnix:     c.PaidUntilAt.Unix(),
				LastHeartbeatUnix: now.Unix(),
				UpdatedAt:         now.Format(time.RFC3339),
			})
		}

		if notif != "NONE" {
			log.Printf("[DISPATCH-ALERT] Contract=%s Phone=%s Action=%s", c.ContractID, c.CustomerPhone, notif)
		}
	}
}