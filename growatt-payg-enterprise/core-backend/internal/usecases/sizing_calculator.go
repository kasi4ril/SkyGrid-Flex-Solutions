// Package usecases implements the core application business rules and deterministic
// engineering calculations for the Growatt PAYG platform.
package usecases

import (
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/domain"
)

// Physical & Financial Engineering Constants (Non-Negotiable Guardrails)
const (
	// InverterEfficiencyEta represents the DC-to-AC conversion efficiency of Growatt SPF/SPH MOSFET/IGBT bridges.
	InverterEfficiencyEta = 0.92

	// LiFePO4MaxDoD enforces an 80% Depth of Discharge limit on Lithium Iron Phosphate packs
	// to guarantee 4,000 to 6,000 charge-discharge cycles (>10 years lifespan).
	LiFePO4MaxDoD = 0.80

	// SystemDeratingFactor accounts for tropical ambient panel temperature coefficient losses,
	// MPPT tracking losses, DC wiring voltage drop, and light dust soiling.
	SystemDeratingFactor = 0.78

	// SafetyHeadroomMultiplier ensures the inverter never operates above 80% continuous load.
	SafetyHeadroomMultiplier = 1.25

	// MinInstallmentDownPaymentPct protects against FX volatility and upfront installation logistics.
	MinInstallmentDownPaymentPct = 30.0
	MaxInstallmentDownPaymentPct = 60.0

	// MandatoryInsuranceRate is the 1.75% all-risk equipment protection fee (fire, lightning surge, theft).
	MandatoryInsuranceRate = 0.0175

	// MonthlyFinancingCostRate models the flat monthly credit service cost (1.85%/month) on financed principal.
	MonthlyFinancingCostRate = 0.0185
)

// SizingCalculatorService executes deterministic electrical sizing and PAYG financial modeling.
type SizingCalculatorService struct {
	appliances map[string]domain.ApplianceCatalogItem
	geoZones   map[string]domain.NigerianGeoZone
	bundles    []domain.GrowattBundleSKU
}

// NewSizingCalculatorService initializes the calculator with calibrated Nigerian electrical
// appliances, state-level solar irradiance zones, and factory Growatt LiFePO4 bundles.
func NewSizingCalculatorService() *SizingCalculatorService {
	svc := &SizingCalculatorService{
		appliances: make(map[string]domain.ApplianceCatalogItem),
		geoZones:   make(map[string]domain.NigerianGeoZone),
	}
	svc.seedNigerianAppliances()
	svc.seedNigerianGeoZones()
	svc.seedGrowattBundles()
	return svc
}

// GetCatalogMetadata returns the full appliance list, Nigerian geo-zones, and curated bundles
// for the Next.js Public Showroom initial render.
func (s *SizingCalculatorService) GetCatalogMetadata() (
	[]domain.ApplianceCatalogItem,
	[]domain.NigerianGeoZone,
	[]domain.GrowattBundleSKU,
) {
	appList := make([]domain.ApplianceCatalogItem, 0, len(s.appliances))
	for _, item := range s.appliances {
		appList = append(appList, item)
	}

	zoneList := make([]domain.NigerianGeoZone, 0, len(s.geoZones))
	for _, z := range s.geoZones {
		zoneList = append(zoneList, z)
	}

	return appList, zoneList, s.bundles
}

// CalculateSystemSize executes the deterministic 4-stage electrical engineering sizing algorithm
// and computes the 36-month PAYG amortization and Generator/Band-A ROI comparison.
func (s *SizingCalculatorService) CalculateSystemSize(
	req domain.SizingCalculationRequest,
) (*domain.SizingCalculationResponse, error) {
	if len(req.SelectedAppliances) == 0 {
		return nil, errors.New("at least one electrical appliance must be selected for load sizing")
	}

	// 1. Resolve Nigerian Geo-Zone Peak Sun Hours (PSH)
	zone, exists := s.geoZones[strings.ToUpper(strings.TrimSpace(req.StateRegion))]
	if !exists {
		// Default safely to Middle Belt / FCT Abuja irradiance if state is unrecognized
		zone = domain.NigerianGeoZone{
			StateName:    "FCT Abuja / Middle Belt Default",
			GeoBelt:      "MIDDLE_BELT",
			PeakSunHours: 5.0,
			DefaultLat:   9.0765,
			DefaultLng:   7.3986,
		}
	}

	// 2. Compute Peak Running Load (W_run), Largest Motor Surge, and Daytime/Nighttime Energy (Wh)
	var (
		totalRunningWatts int
		largestMotorSurge int
		daytimeEnergyWh   float64
		nighttimeEnergyWh float64
		warnings          []string
	)

	for _, sel := range req.SelectedAppliances {
		if sel.Quantity <= 0 {
			continue
		}
		catalogItem, ok := s.appliances[sel.ApplianceCode]
		if !ok {
			return nil, fmt.Errorf("unrecognized appliance code: %s", sel.ApplianceCode)
		}

		lineRunningWatts := catalogItem.RatedWatts * sel.Quantity
		totalRunningWatts += lineRunningWatts

		// Calculate single-unit inductive motor starting inrush delta:
		// Motors don't all start at the exact same millisecond, so IEEE/NEC off-grid sizing
		// takes total continuous running watts + the single highest motor starting surge delta.
		if catalogItem.IsMotorInductive {
			singleMotorSurgeDelta := int(math.Ceil(float64(catalogItem.RatedWatts) * (catalogItem.SurgeMultiplier - 1.0)))
			if singleMotorSurgeDelta > largestMotorSurge {
				largestMotorSurge = singleMotorSurgeDelta
			}
		}

		dayHours := math.Max(0, math.Min(sel.DaytimeHours, 10))
		nightHours := math.Max(0, math.Min(sel.NighttimeHours, 14))

		daytimeEnergyWh += float64(lineRunningWatts) * dayHours
		nighttimeEnergyWh += float64(lineRunningWatts) * nightHours

		// Engineering advisory for heavy borehole pumps or non-inverter ACs at night
		if catalogItem.Code == "BOREHOLE_PUMP_1HP" && nightHours > 0 {
			warnings = append(warnings,
				"Engineering Advisory: Shift 1HP Borehole Pump operation exclusively to Peak Solar Hours (11:00 AM – 2:00 PM) to avoid deep overnight LiFePO4 battery discharge.")
		}
	}

	if totalRunningWatts == 0 {
		return nil, errors.New("total running load watts must be greater than zero")
	}

	// 3. Deterministic Formula 2: Required Inverter Capacity (VA_inv)
	// VA_inv = max(W_run * 1.25, W_run + W_largest_motor_surge)
	headroomVA := int(math.Ceil(float64(totalRunningWatts) * SafetyHeadroomMultiplier))
	surgeTotalVA := totalRunningWatts + largestMotorSurge
	requiredInverterVA := headroomVA
	if surgeTotalVA > requiredInverterVA {
		requiredInverterVA = surgeTotalVA
	}

	// 4. Deterministic Formula 3: Required LiFePO4 Battery Bank Capacity (Wh_batt)
	// Wh_batt = (W_night_load * BackupHours) / (eta_inv(0.92) * DoD_LiFePO4(0.80))
	// Note: nighttimeEnergyWh already integrates (ApplianceWatts * NighttimeHours) across each appliance.
	if nighttimeEnergyWh == 0 && req.BackupAutonomyHours > 0 {
		// Fallback if user set 0 night hours on sliders but requested backup autonomy
		nighttimeEnergyWh = float64(totalRunningWatts) * 0.40 * req.BackupAutonomyHours
	}
	requiredBatteryWh := nighttimeEnergyWh / (InverterEfficiencyEta * LiFePO4MaxDoD)
	requiredLiFePO4KWh := math.Ceil((requiredBatteryWh/1000.0)*10.0) / 10.0
	if requiredLiFePO4KWh < 2.56 {
		requiredLiFePO4KWh = 2.56 // Minimum 2.56 kWh 24V/100Ah LiFePO4 module
	}

	// 5. Deterministic Formula 4: Required Solar PV Array (W_pv)
	// W_pv = ((Wh_batt * 0.80) + Wh_daytime_load) / (PeakSunHours * SystemDerating(0.78))
	dailyBatteryReplenishWh := requiredBatteryWh * LiFePO4MaxDoD
	requiredPVWatts := (dailyBatteryReplenishWh + daytimeEnergyWh) / (zone.PeakSunHours * SystemDeratingFactor)
	requiredSolarPVKWp := math.Ceil((requiredPVWatts/1000.0)*100.0) / 100.0

	// 6. Match to Curated Growatt Inverter & LiFePO4 Hardware Bundle
	recommendedBundle := s.matchGrowattBundle(requiredInverterVA, requiredLiFePO4KWh, requiredSolarPVKWp)

	// 7. Compute FX-Protected Amortization & Credit Schedule
	amortization, err := s.computeAmortization(recommendedBundle, req.PaymentMode, req.TenureMonths, req.DownPaymentPct)
	if err != nil {
		return nil, err
	}

	// 8. Compute DisCo Band A & Petrol/Diesel Generator ROI Comparison
	roi := s.computeNigerianROI(req, amortization, daytimeEnergyWh+nighttimeEnergyWh)

	return &domain.SizingCalculationResponse{
		StateRegion:         zone.StateName,
		GeoBelt:             zone.GeoBelt,
		LocalPeakSunHours:   zone.PeakSunHours,
		PeakRunningWatts:    totalRunningWatts,
		PeakSurgeVA:         surgeTotalVA,
		LargestMotorSurgeVA: largestMotorSurge,
		RequiredInverterVA:  requiredInverterVA,
		DaytimeEnergyWh:     math.Round(daytimeEnergyWh),
		NighttimeEnergyWh:   math.Round(nighttimeEnergyWh),
		TotalDailyEnergyWh:  math.Round(daytimeEnergyWh + nighttimeEnergyWh),
		RequiredLiFePO4KWh:  requiredLiFePO4KWh,
		RequiredSolarPVKWp:  requiredSolarPVKWp,
		RecommendedBundle:   recommendedBundle,
		Amortization:        amortization,
		ROIComparison:       roi,
		EngineeringWarnings: warnings,
		CalculatedAt:        time.Now().UTC(),
	}, nil
}

// matchGrowattBundle maps calculated VA, battery kWh, and PV kWp to the official Growatt SKU tiers.
func (s *SizingCalculatorService) matchGrowattBundle(reqVA int, reqBattKWh float64, reqPVKWp float64) domain.GrowattBundleSKU {
	// Tier 1: <= 2400W / 3000VA -> Growatt SPF 3000TL LVM-ES
	if reqVA <= 2800 && reqBattKWh <= 5.12 {
		return s.bundles[0]
	}
	// Tier 2: <= 4500W / 5000VA -> Growatt SPF 5000ES + 5.12kWh to 10.24kWh LiFePO4
	if reqVA <= 4800 && reqBattKWh <= 10.24 {
		if reqBattKWh > 5.5 {
			return s.bundles[2] // 5kVA Pro (10.24kWh Battery)
		}
		return s.bundles[1] // 5kVA Family Standard (5.12kWh Battery)
	}
	// Tier 3: > 4800VA -> Parallel Growatt SPF 5000ES (10kVA) or SPH 10000TL-HU Hybrid
	return s.bundles[3]
}

// computeAmortization enforces the non-negotiable business & credit risk guardrails:
// - Installments MUST use LiFePO4 batteries.
// - Down payment MUST be at least 30% of hardware price.
// - Mandatory 1.75% Equipment Insurance Fee is baked into the schedule.
func (s *SizingCalculatorService) computeAmortization(
	bundle domain.GrowattBundleSKU,
	mode domain.PaymentMode,
	tenureMonths int,
	downPaymentPct float64,
) (domain.AmortizationSummary, error) {
	hwPriceKobo := bundle.BaseCashPriceKobo

	if mode == domain.PaymentModeOutright || tenureMonths <= 1 {
		return domain.AmortizationSummary{
			PaymentMode:            domain.PaymentModeOutright,
			BatteryChemistry:       domain.BatteryChemistryLiFePO4,
			TenureMonths:           1,
			TotalHardwarePriceKobo: hwPriceKobo,
			DownPaymentPct:         100.0,
			DownPaymentKobo:        hwPriceKobo,
			EquipmentInsuranceKobo: 0,
			FinancedPrincipalKobo:  0,
			MonthlyInstallmentKobo: 0,
			DailyEquivalentKobo:    0,
			TotalContractValueKobo: hwPriceKobo,
		}, nil
	}

	if tenureMonths < 3 || tenureMonths > 36 {
		return domain.AmortizationSummary{}, errors.New("installment tenure must be between 3 and 36 months")
	}

	// Enforce 30% minimum down payment guardrail
	if downPaymentPct < MinInstallmentDownPaymentPct {
		downPaymentPct = MinInstallmentDownPaymentPct
	}
	if downPaymentPct > MaxInstallmentDownPaymentPct {
		downPaymentPct = MaxInstallmentDownPaymentPct
	}

	downPaymentKobo := int64(math.Round(float64(hwPriceKobo) * (downPaymentPct / 100.0)))
	insuranceFeeKobo := int64(math.Round(float64(hwPriceKobo) * MandatoryInsuranceRate))
	principalKobo := (hwPriceKobo - downPaymentKobo) + insuranceFeeKobo

	// Calculate total credit service charge over the selected tenure
	totalCreditChargeKobo := int64(math.Round(float64(principalKobo) * MonthlyFinancingCostRate * float64(tenureMonths)))
	totalFinancedPayableKobo := principalKobo + totalCreditChargeKobo
	monthlyInstallmentKobo := int64(math.Ceil(float64(totalFinancedPayableKobo) / float64(tenureMonths)))
	dailyEquivalentKobo := int64(math.Ceil(float64(monthlyInstallmentKobo) / 30.0))

	return domain.AmortizationSummary{
		PaymentMode:            domain.PaymentModeInstallment,
		BatteryChemistry:       domain.BatteryChemistryLiFePO4, // Strictly enforced
		TenureMonths:           tenureMonths,
		TotalHardwarePriceKobo: hwPriceKobo,
		DownPaymentPct:         downPaymentPct,
		DownPaymentKobo:        downPaymentKobo,
		EquipmentInsuranceKobo: insuranceFeeKobo,
		FinancedPrincipalKobo:  principalKobo,
		MonthlyInstallmentKobo: monthlyInstallmentKobo,
		DailyEquivalentKobo:    dailyEquivalentKobo,
		TotalContractValueKobo: downPaymentKobo + (monthlyInstallmentKobo * int64(tenureMonths)),
	}, nil
}

// computeNigerianROI compares the customer's current DisCo Band A/B bill + Petrol Generator burn
// against their Growatt PAYG monthly installment.
func (s *SizingCalculatorService) computeNigerianROI(
	req domain.SizingCalculationRequest,
	amort domain.AmortizationSummary,
	dailySolarWh float64,
) domain.ROIComparisonMetrics {
	gridMonthlyKobo := req.CurrentMonthlyGridBillNGN * 100
	if gridMonthlyKobo <= 0 {
		gridMonthlyKobo = 65000 * 100 // Default ₦65,000/month urban DisCo bill
	}

	fuelPriceNGN := req.FuelPricePerLiterNGN
	if fuelPriceNGN <= 0 {
		fuelPriceNGN = 1250 // Default ₦1,250/Liter Nigerian PMS petrol price
	}

	genHours := req.DailyGeneratorRunHours
	if genHours < 0 {
		genHours = 0
	}

	// Typical 3.5kVA–6.5kVA petrol generator burns ~1.35 Liters/hour under load
	litersPerMonth := genHours * 1.35 * 30.0
	fuelMonthlyKobo := int64(math.Round(litersPerMonth * float64(fuelPriceNGN) * 100.0))

	// Oil changes, spark plugs, andavr servicing (~₦18,000/month if running >3h/day)
	var genMaintKobo int64
	if genHours >= 2.0 {
		genMaintKobo = 18000 * 100
	}

	// Assume solar offsets 85% of previous generator + grid fossil expenditure
	totalCurrentSpendKobo := gridMonthlyKobo + fuelMonthlyKobo + genMaintKobo
	displacedEnergySpendKobo := int64(math.Round(float64(totalCurrentSpendKobo) * 0.85))

	monthlyNetSavingsKobo := displacedEnergySpendKobo - amort.MonthlyInstallmentKobo
	cumulative36mSavingsKobo := (displacedEnergySpendKobo * 36) - amort.TotalContractValueKobo

	var breakEvenMonths float64
	if displacedEnergySpendKobo > 0 {
		breakEvenMonths = math.Round((float64(amort.TotalHardwarePriceKobo)/float64(displacedEnergySpendKobo))*10.0) / 10.0
	}

	// 1 Liter of petrol burned emits ~2.31 kg of CO2; Grid displacement adds ~0.43 kg/kWh
	annualCO2Kg := (litersPerMonth * 12.0 * 2.31) + ((dailySolarWh / 1000.0) * 365.0 * 0.43)

	return domain.ROIComparisonMetrics{
		CurrentMonthlyGridSpendKobo:    gridMonthlyKobo,
		CurrentMonthlyFuelSpendKobo:    fuelMonthlyKobo,
		CurrentGeneratorMaintSpendKobo: genMaintKobo,
		TotalCurrentMonthlyEnergyKobo:  totalCurrentSpendKobo,
		ProjectedMonthlyNetSavingsKobo: monthlyNetSavingsKobo,
		Cumulative36MonthSavingsKobo:   cumulative36mSavingsKobo,
		PaybackBreakEvenMonths:         breakEvenMonths,
		CO2OffsetKgPerYear:             math.Round(annualCO2Kg),
	}
}

func (s *SizingCalculatorService) seedNigerianAppliances() {
	items := []domain.ApplianceCatalogItem{
		{Code: "LED_BULB_15W", Name: "Energy-Saving LED Bulb (15W)", Category: "LIGHTING", RatedWatts: 15, SurgeMultiplier: 1.0, IsMotorInductive: false, DefaultDayHours: 2, DefaultNightHours: 8},
		{Code: "CEILING_FAN_75W", Name: "AC/DC Ceiling or Standing Fan (75W)", Category: "COOLING", RatedWatts: 75, SurgeMultiplier: 1.3, IsMotorInductive: true, DefaultDayHours: 5, DefaultNightHours: 8},
		{Code: "SMART_TV_120W", Name: "55\" 4K Smart LED TV & Decoder (120W)", Category: "ENTERTAINMENT", RatedWatts: 120, SurgeMultiplier: 1.0, IsMotorInductive: false, DefaultDayHours: 4, DefaultNightHours: 5},
		{Code: "LAPTOP_ROUTER_90W", Name: "Laptop Workstation + Starlink/Fiber Router (90W)", Category: "OFFICE", RatedWatts: 90, SurgeMultiplier: 1.0, IsMotorInductive: false, DefaultDayHours: 7, DefaultNightHours: 4},
		{Code: "INVERTER_FRIDGE_180W", Name: "Modern Inverter Refrigerator (180W)", Category: "REFRIGERATION", RatedWatts: 180, SurgeMultiplier: 2.2, IsMotorInductive: true, DefaultDayHours: 6, DefaultNightHours: 6},
		{Code: "CHEST_FREEZER_250W", Name: "Deep Chest Freezer (250W)", Category: "REFRIGERATION", RatedWatts: 250, SurgeMultiplier: 2.8, IsMotorInductive: true, DefaultDayHours: 6, DefaultNightHours: 5},
		{Code: "INVERTER_AC_1HP", Name: "1.0 HP Dual-Inverter Split Air Conditioner (850W)", Category: "COOLING", RatedWatts: 850, SurgeMultiplier: 1.6, IsMotorInductive: true, DefaultDayHours: 4, DefaultNightHours: 4},
		{Code: "INVERTER_AC_1_5HP", Name: "1.5 HP Dual-Inverter Split Air Conditioner (1200W)", Category: "COOLING", RatedWatts: 1200, SurgeMultiplier: 1.7, IsMotorInductive: true, DefaultDayHours: 4, DefaultNightHours: 3},
		{Code: "BOREHOLE_PUMP_1HP", Name: "1.0 HP Submersible Borehole Water Pump (750W)", Category: "PUMPING", RatedWatts: 750, SurgeMultiplier: 3.0, IsMotorInductive: true, DefaultDayHours: 1.0, DefaultNightHours: 0},
		{Code: "WASHING_MACHINE_500W", Name: "Front-Load Washing Machine - Cold Wash (500W)", Category: "HOME", RatedWatts: 500, SurgeMultiplier: 2.0, IsMotorInductive: true, DefaultDayHours: 1.5, DefaultNightHours: 0},
	}
	for _, item := range items {
		s.appliances[item.Code] = item
	}
}

func (s *SizingCalculatorService) seedNigerianGeoZones() {
	zones := []domain.NigerianGeoZone{
		{StateName: "FCT ABUJA", GeoBelt: "MIDDLE_BELT", PeakSunHours: 5.1, DefaultLat: 9.0765, DefaultLng: 7.3986},
		{StateName: "BENUE", GeoBelt: "MIDDLE_BELT", PeakSunHours: 4.9, DefaultLat: 7.1904, DefaultLng: 8.1297},
		{StateName: "PLATEAU", GeoBelt: "MIDDLE_BELT", PeakSunHours: 5.3, DefaultLat: 9.8965, DefaultLng: 8.8583},
		{StateName: "NASARAWA", GeoBelt: "MIDDLE_BELT", PeakSunHours: 5.0, DefaultLat: 8.4998, DefaultLng: 8.5167},
		{StateName: "LAGOS", GeoBelt: "SOUTHERN_COASTAL", PeakSunHours: 4.1, DefaultLat: 6.5244, DefaultLng: 3.3792},
		{StateName: "RIVERS", GeoBelt: "SOUTHERN_COASTAL", PeakSunHours: 3.8, DefaultLat: 4.8156, DefaultLng: 7.0498},
		{StateName: "ENUGU", GeoBelt: "SOUTHERN_COASTAL", PeakSunHours: 4.4, DefaultLat: 6.4584, DefaultLng: 7.5464},
		{StateName: "KANO", GeoBelt: "NORTHERN_SAHEL", PeakSunHours: 5.9, DefaultLat: 12.0022, DefaultLng: 8.5920},
		{StateName: "KADUNA", GeoBelt: "NORTHERN_SAHEL", PeakSunHours: 5.6, DefaultLat: 10.5105, DefaultLng: 7.4165},
	}
	for _, z := range zones {
		s.geoZones[z.StateName] = z
	}
}

func (s *SizingCalculatorService) seedGrowattBundles() {
	// Prices stored in Kobo (₦1 = 100 Kobo)
	s.bundles = []domain.GrowattBundleSKU{
		{
			SKUCode:               "GW-SPF3000-LFP5",
			MarketingName:         "Growatt 3.0kVA Eco-Starter Bundle",
			InverterModel:         "Growatt SPF 3000TL LVM-ES",
			RatedOutputWatts:      3000,
			MaxSurgeVA:            6000,
			RecommendedBatteryKWh: 5.12,
			RecommendedPVKWp:      2.70,
			BatteryChemistry:      domain.BatteryChemistryLiFePO4,
			BaseCashPriceKobo:     2850000 * 100, // ₦2,850,000
			IdealCustomerProfile:  "2–3 Bedroom Flats: Fridge, Freezer, Fans, TV, Starlink & Lighting (24/7 Power)",
		},
		{
			SKUCode:               "GW-SPF5000-LFP5",
			MarketingName:         "Growatt 5.0kVA Family Standard Bundle",
			InverterModel:         "Growatt SPF 5000ES Off-Grid Hybrid",
			RatedOutputWatts:      5000,
			MaxSurgeVA:            10000,
			RecommendedBatteryKWh: 5.12,
			RecommendedPVKWp:      4.40,
			BatteryChemistry:      domain.BatteryChemistryLiFePO4,
			BaseCashPriceKobo:     4450000 * 100, // ₦4,450,000
			IdealCustomerProfile:  "Duplexes & SMEs: Runs 1x 1HP Inverter AC + Borehole Pump (Day) + Full Home Load",
		},
		{
			SKUCode:               "GW-SPF5000-LFP10",
			MarketingName:         "Growatt 5.0kVA Executive Night-Cool Bundle",
			InverterModel:         "Growatt SPF 5000ES Off-Grid Hybrid",
			RatedOutputWatts:      5000,
			MaxSurgeVA:            10000,
			RecommendedBatteryKWh: 10.24,
			RecommendedPVKWp:      5.50,
			BatteryChemistry:      domain.BatteryChemistryLiFePO4,
			BaseCashPriceKobo:     6300000 * 100, // ₦6,300,000
			IdealCustomerProfile:  "Executive Homes: Overnight Inverter AC cooling + 1HP Borehole + Deep Freezer",
		},
		{
			SKUCode:               "GW-SPH10000-LFP20",
			MarketingName:         "Growatt 10.0kVA Commercial & Estate Villa PowerPlant",
			InverterModel:         "Dual Parallel Growatt SPF 5000ES / SPH 10000TL",
			RatedOutputWatts:      10000,
			MaxSurgeVA:            20000,
			RecommendedBatteryKWh: 20.48,
			RecommendedPVKWp:      9.90,
			BatteryChemistry:      domain.BatteryChemistryLiFePO4,
			BaseCashPriceKobo:     11800000 * 100, // ₦11,800,000
			IdealCustomerProfile:  "Clinics, Hotels, Pharmacies & Large Residences: Multiple ACs, Pumps & 3-Phase/Split Loads",
		},
	}
}
