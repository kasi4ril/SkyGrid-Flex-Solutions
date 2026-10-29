/**
 * @fileoverview Shared TypeScript SDK for Growatt PAYG Solar Sizing, Nigerian Geo-Zones,
 * and DisCo Band A / Petrol Generator ROI Math.
 * Shared across Next.js Web Apps (web-suite) and React Native Mobile Apps (mobile-suite).
 */

export type PaymentMode = 'OUTRIGHT' | 'INSTALLMENT';
export type BatteryChemistry = 'LIFEPO4' | 'LEAD_ACID_TUBULAR';

export interface ApplianceCatalogItem {
  code: string;
  name: string;
  category: string;
  rated_watts: number;
  surge_multiplier: number;
  is_motor_inductive: boolean;
  default_day_hours: number;
  default_night_hours: number;
}

export interface SelectedApplianceInput {
  appliance_code: string;
  quantity: number;
  daytime_hours: number;
  nighttime_hours: number;
}

export interface NigerianGeoZone {
  state_name: string;
  geo_belt: 'NORTHERN_SAHEL' | 'MIDDLE_BELT' | 'SOUTHERN_COASTAL';
  peak_sun_hours: number;
  default_lat: number;
  default_lng: number;
}

export interface GrowattBundleSKU {
  sku_code: string;
  marketing_name: string;
  inverter_model: string;
  rated_output_watts: number;
  max_surge_va: number;
  recommended_battery_kwh: number;
  recommended_pv_kwp: number;
  battery_chemistry: BatteryChemistry;
  base_cash_price_kobo: number;
  ideal_customer_profile: string;
}

export interface AmortizationSummary {
  payment_mode: PaymentMode;
  battery_chemistry: BatteryChemistry;
  tenure_months: number;
  total_hardware_price_kobo: number;
  down_payment_pct: number;
  down_payment_kobo: number;
  equipment_insurance_kobo: number;
  financed_principal_kobo: number;
  monthly_installment_kobo: number;
  daily_equivalent_kobo: number;
  total_contract_value_kobo: number;
}

export interface ROIComparisonMetrics {
  current_monthly_grid_spend_kobo: number;
  current_monthly_fuel_spend_kobo: number;
  current_generator_maint_spend_kobo: number;
  total_current_monthly_energy_kobo: number;
  projected_monthly_net_savings_kobo: number;
  cumulative_36_month_savings_kobo: number;
  payback_break_even_months: number;
  co2_offset_kg_per_year: number;
}

export interface SizingCalculationResponse {
  state_region: string;
  geo_belt: string;
  local_peak_sun_hours: number;
  peak_running_watts: number;
  peak_surge_va: number;
  largest_motor_surge_va: number;
  required_inverter_va: number;
  daytime_energy_wh: number;
  nighttime_energy_wh: number;
  total_daily_energy_wh: number;
  required_lifepo4_kwh: number;
  required_solar_pv_kwp: number;
  recommended_bundle: GrowattBundleSKU;
  amortization: AmortizationSummary;
  roi_comparison: ROIComparisonMetrics;
  engineering_warnings: string[];
  calculated_at: string;
}

/**
 * Formats integer Kobo values into Nigerian Naira (₦) currency strings.
 * Example: 445000000 -> "₦4,450,000"
 */
export function formatKoboToNaira(kobo: number): string {
  const naira = Math.round(kobo / 100);
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(naira);
}