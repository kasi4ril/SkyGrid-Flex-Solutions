package usecases_test

import (
	"testing"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/domain"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/usecases"
)

func TestSizingCalculatorAndNigerianGuardrails(t *testing.T) {
	svc := usecases.NewSizingCalculatorService()

	req := domain.SizingCalculationRequest{
		StateRegion:               "BENUE",
		BackupAutonomyHours:       12,
		PaymentMode:               domain.PaymentModeInstallment,
		TenureMonths:              24,
		DownPaymentPct:            20.0, // Intentionally below 30% to test guardrail enforcement
		DisCoTariffBand:           "BAND_A",
		CurrentMonthlyGridBillNGN: 80000,
		DailyGeneratorRunHours:    5.0,
		FuelPricePerLiterNGN:      1250,
		SelectedAppliances: []domain.SelectedApplianceInput{
			{ApplianceCode: "LED_BULB_15W", Quantity: 10, DaytimeHours: 2, NighttimeHours: 8},
			{ApplianceCode: "CEILING_FAN_75W", Quantity: 4, DaytimeHours: 5, NighttimeHours: 8},
			{ApplianceCode: "INVERTER_FRIDGE_180W", Quantity: 1, DaytimeHours: 6, NighttimeHours: 6},
			{ApplianceCode: "BOREHOLE_PUMP_1HP", Quantity: 1, DaytimeHours: 1, NighttimeHours: 1}, // Triggers night pump warning
		},
	}

	res, err := svc.CalculateSystemSize(req)
	if err != nil {
		t.Fatalf("CalculateSystemSize failed: %v", err)
	}

	// 1. Verify Nigerian Geo-Zone PSH Lookup (Benue = 4.9 PSH)
	if res.LocalPeakSunHours != 4.9 {
		t.Errorf("expected Benue PeakSunHours 4.9, got %.2f", res.LocalPeakSunHours)
	}

	// 2. Verify Down Payment Floor Guardrail (20% input must be clamped to >= 30%)
	if res.Amortization.DownPaymentPct < 30.0 {
		t.Errorf("expected DownPaymentPct guardrail >= 30.0%%, got %.2f%%", res.Amortization.DownPaymentPct)
	}

	// 3. Verify LiFePO4 Mandate on Installment Plans
	if res.Amortization.BatteryChemistry != domain.BatteryChemistryLiFePO4 {
		t.Errorf("expected LiFePO4 battery chemistry mandate, got %s", res.Amortization.BatteryChemistry)
	}

	// 4. Verify Engineering Advisory for Nighttime Borehole Pump
	if len(res.EngineeringWarnings) == 0 {
		t.Errorf("expected engineering warning when running 1HP borehole pump at night")
	}
}