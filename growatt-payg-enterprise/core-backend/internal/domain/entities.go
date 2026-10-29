// Package domain contains the core enterprise business entities, value objects,
// and invariant rules for the Growatt PAYG Solar & Fintech platform.
//
// Architectural Standard: Clean Architecture / Domain-Driven Design (DDD).
// Zero external framework dependencies are permitted in this package.
package domain

import "time"

// PaymentMode defines whether a solar acquisition is an outright cash sale
// or a lease-to-own PAYG credit contract.
type PaymentMode string

const (
	PaymentModeOutright    PaymentMode = "OUTRIGHT"
	PaymentModeInstallment PaymentMode = "INSTALLMENT"
)

// BatteryChemistry enforces the physical engineering mandate:
// Lease-to-own plans (>12m up to 36m) MUST strictly use LiFePO4 chemistry
// (4,000–6,000 cycles @ 80% DoD) so the battery outlives the credit amortization period.
type BatteryChemistry string

const (
	BatteryChemistryLiFePO4         BatteryChemistry = "LIFEPO4"
	BatteryChemistryLeadAcidTubular BatteryChemistry = "LEAD_ACID_TUBULAR"
)

// NigerianGeoZone models regional solar irradiance (Peak Sun Hours) across Nigeria.
// Relying on a static 4.5h constant causes undersizing in the Niger Delta/Coast
// and oversizing in the Sahel/Northern belt.
type NigerianGeoZone struct {
	StateName      string  `json:"state_name"`
	GeoBelt        string  `json:"geo_belt"`         // NORTHERN_SAHEL, MIDDLE_BELT, SOUTHERN_COASTAL
	PeakSunHours   float64 `json:"peak_sun_hours"`   // Worst-case rainy-season adjusted PSH
	DefaultLat     float64 `json:"default_lat"`
	DefaultLng     float64 `json:"default_lng"`
}

// ApplianceCatalogItem represents a pre-calibrated Nigerian residential or SME electrical load.
// Inductive loads (compressors, borehole submersible pumps) require surge multipliers (2.5x–3.5x)
// to prevent Growatt MOSFET/IGBT overload faults (Fault Code 07 / 51).
type ApplianceCatalogItem struct {
	Code             string  `json:"code"`
	Name             string  `json:"name"`
	Category         string  `json:"category"`          // COOLING, REFRIGERATION, PUMPING, LIGHTING, ENTERTAINMENT, OFFICE
	RatedWatts       int     `json:"rated_watts"`       // Continuous steady-state running power (W)
	SurgeMultiplier  float64 `json:"surge_multiplier"`  // Starting inrush VA factor (1.0 for resistive/LED, up to 3.2 for pumps)
	IsMotorInductive bool    `json:"is_motor_inductive"`
	DefaultDayHours  float64 `json:"default_day_hours"`  // 08:00 - 17:00 solar harvest window
	DefaultNightHours float64 `json:"default_night_hours"` // 17:00 - 08:00 LiFePO4 battery discharge window
}

// SelectedApplianceInput captures the user's interactive appliance configuration from the website.
type SelectedApplianceInput struct {
	ApplianceCode string  `json:"appliance_code"`
	Quantity      int     `json:"quantity"`
	DaytimeHours  float64 `json:"daytime_hours"`   // Hours operated during sunlight (08:00 - 17:00)
	NighttimeHours float64 `json:"nighttime_hours"` // Hours operated at night on battery (17:00 - 08:00)
}

// GrowattBundleSKU represents an engineered, factory-validated solar hardware package.
type GrowattBundleSKU struct {
	SKUCode               string           `json:"sku_code"`
	MarketingName         string           `json:"marketing_name"`
	InverterModel         string           `json:"inverter_model"`
	RatedOutputWatts      int              `json:"rated_output_watts"`
	MaxSurgeVA            int              `json:"max_surge_va"`
	RecommendedBatteryKWh float64          `json:"recommended_battery_kwh"`
	RecommendedPVKWp      float64          `json:"recommended_pv_kwp"`
	BatteryChemistry      BatteryChemistry `json:"battery_chemistry"`
	BaseCashPriceKobo     int64            `json:"base_cash_price_kobo"`
	IdealCustomerProfile  string           `json:"ideal_customer_profile"`
}

// SizingCalculationRequest is the payload sent by the Public Showroom Interactive Calculator.
type SizingCalculationRequest struct {
	StateRegion                string                   `json:"state_region"`
	BackupAutonomyHours        float64                  `json:"backup_autonomy_hours"` // Default 12h overnight
	SelectedAppliances         []SelectedApplianceInput `json:"selected_appliances"`
	PaymentMode                PaymentMode              `json:"payment_mode"`
	TenureMonths               int                      `json:"tenure_months"`         // 1 (Outright) or 3..36 months
	DownPaymentPct             float64                  `json:"down_payment_pct"`      // Strictly >= 30.0% for installments
	DisCoTariffBand            string                   `json:"disco_tariff_band"`     // BAND_A, BAND_B, BAND_C
	CurrentMonthlyGridBillNGN  int64                    `json:"current_monthly_grid_bill_ngn"`
	DailyGeneratorRunHours     float64                  `json:"daily_generator_run_hours"`
	FuelPricePerLiterNGN       int64                    `json:"fuel_price_per_liter_ngn"` // e.g., 1250 NGN/L petrol
}

// ROIComparisonMetrics quantifies the financial advantage of switching from Nigerian
// petrol/diesel generators + Band A DisCo tariffs to a Growatt PAYG lease.
type ROIComparisonMetrics struct {
	CurrentMonthlyGridSpendKobo     int64   `json:"current_monthly_grid_spend_kobo"`
	CurrentMonthlyFuelSpendKobo     int64   `json:"current_monthly_fuel_spend_kobo"`
	CurrentGeneratorMaintSpendKobo  int64   `json:"current_generator_maint_spend_kobo"`
	TotalCurrentMonthlyEnergyKobo   int64   `json:"total_current_monthly_energy_kobo"`
	ProjectedMonthlyNetSavingsKobo  int64   `json:"projected_monthly_net_savings_kobo"`
	Cumulative36MonthSavingsKobo    int64   `json:"cumulative_36_month_savings_kobo"`
	PaybackBreakEvenMonths          float64 `json:"payback_break_even_months"`
	CO2OffsetKgPerYear              float64 `json:"co2_offset_kg_per_year"`
}

// AmortizationSummary breaks down the FX-protected, insured PAYG lease schedule.
type AmortizationSummary struct {
	PaymentMode            PaymentMode      `json:"payment_mode"`
	BatteryChemistry       BatteryChemistry `json:"battery_chemistry"`
	TenureMonths           int              `json:"tenure_months"`
	TotalHardwarePriceKobo int64            `json:"total_hardware_price_kobo"`
	DownPaymentPct         float64          `json:"down_payment_pct"`
	DownPaymentKobo        int64            `json:"down_payment_kobo"`
	EquipmentInsuranceKobo int64            `json:"equipment_insurance_kobo"` // Mandatory 1.75% all-risk protection
	FinancedPrincipalKobo  int64            `json:"financed_principal_kobo"`
	MonthlyInstallmentKobo int64            `json:"monthly_installment_kobo"`
	DailyEquivalentKobo    int64            `json:"daily_equivalent_kobo"`
	TotalContractValueKobo int64            `json:"total_contract_value_kobo"`
}

// SizingCalculationResponse is returned to the Next.js Public Showroom to render
// real-time engineering specs, bundle recommendations, and ROI charts.
type SizingCalculationResponse struct {
	StateRegion            string               `json:"state_region"`
	GeoBelt                string               `json:"geo_belt"`
	LocalPeakSunHours      float64              `json:"local_peak_sun_hours"`
	PeakRunningWatts       int                  `json:"peak_running_watts"`
	PeakSurgeVA            int                  `json:"peak_surge_va"`
	LargestMotorSurgeVA    int                  `json:"largest_motor_surge_va"`
	RequiredInverterVA     int                  `json:"required_inverter_va"`
	DaytimeEnergyWh        float64              `json:"daytime_energy_wh"`
	NighttimeEnergyWh      float64              `json:"nighttime_energy_wh"`
	TotalDailyEnergyWh     float64              `json:"total_daily_energy_wh"`
	RequiredLiFePO4KWh     float64              `json:"required_lifepo4_kwh"`
	RequiredSolarPVKWp     float64              `json:"required_solar_pv_kwp"`
	RecommendedBundle      GrowattBundleSKU     `json:"recommended_bundle"`
	Amortization           AmortizationSummary  `json:"amortization"`
	ROIComparison          ROIComparisonMetrics `json:"roi_comparison"`
	EngineeringWarnings    []string             `json:"engineering_warnings"`
	CalculatedAt           time.Time            `json:"calculated_at"`
}

// LeadCaptureRequest binds a customer's contact details and site location to a calculated quote
// to schedule a physical Field Engineering Site Audit.
type LeadCaptureRequest struct {
	FullName          string                   `json:"full_name"`
	Phone             string                   `json:"phone"`
	Email             string                   `json:"email"`
	StateRegion       string                   `json:"state_region"`
	City              string                   `json:"city"`
	StreetAddress     string                   `json:"street_address"`
	GPSLat            float64                  `json:"gps_lat"`
	GPSLng            float64                  `json:"gps_lng"`
	PreferredAuditDay string                   `json:"preferred_audit_day"`
	SizingInput       SizingCalculationRequest `json:"sizing_input"`
}