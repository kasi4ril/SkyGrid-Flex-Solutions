'use client';

/**
 * @fileoverview Definitive Unified Customer Energy, Financial & Forecast Storytelling Dashboard
 * Module: EnergyAnalyticsSuite.tsx
 * Architecture: CleanTech Progressive Disclosure & Storyteller Engine
 *
 * Compliant with:
 * - Section 1: Executive Customer Identity, Circular Picture Column, Live Geo-Tag & "Roof ATM" Ticker
 * - Section 2: Narrative Headline Panel + DisCo Feeder & Harmattan Micro-Climate Intelligence Strip
 * - Section 3: Package Amortization Ledger + Clean Energy Credit & Bankability Passport
 * - Section 4: Historical Time-Variance Line Graph & Period Totals (1D | 1W | 1M | 1Y) with Autonomy Anchor
 * - Section 5: Forecast-Driven Dynamic Battery Survival Clock (Quantile Load P25, P50, P90)
 * - Section 6: Triple-Source Substitution Tracker & Grouped Financial Bar Chart (Solar vs Grid vs Gen)
 * - Section 7: Multi-Horizon Forecasted Sunshine & Load Confidence-Band Chart with LocalGridAgent AI
 */

import React, { useState, useMemo } from 'react';

// ============================================================================
// TYPES & PROPS
// ============================================================================

export type SuiteMode = 'PUBLIC_PREVIEW' | 'CUSTOMER_PORTAL';
export type CustomerSegment = 'residential' | 'commercial' | 'industrial';
export type TimeframePeriod = '1D' | '1W' | '1M' | '1Y';
export type ForecastHorizon = '1H' | '1D' | '1W' | '1M' | '1Y';

export interface EnergyAnalyticsSuiteProps {
  mode?: SuiteMode;
  deviceID?: string;
  customerState?: string;
  onOpenContract?: () => void;
}

// ============================================================================
// UTILITIES: SI UNIT SCALING & CURRENCY
// ============================================================================

export function formatSI(
  rawWatts: number,
  type: 'POWER' | 'ENERGY'
): { num: string; unit: string; full: string } {
  const abs = Math.abs(rawWatts);
  if (type === 'POWER') {
    if (abs >= 1_000_000) {
      const v = (rawWatts / 1_000_000).toFixed(2);
      return { num: v, unit: 'MW', full: `${v} MW` };
    }
    if (abs >= 1_000) {
      const v = (rawWatts / 1_000).toFixed(2);
      return { num: v, unit: 'kW', full: `${v} kW` };
    }
    const v = Math.round(rawWatts).toString();
    return { num: v, unit: 'W', full: `${v} W` };
  } else {
    if (abs >= 1_000_000) {
      const v = (rawWatts / 1_000_000).toFixed(2);
      return { num: v, unit: 'MWh', full: `${v} MWh` };
    }
    if (abs >= 1_000) {
      const v = (rawWatts / 1_000).toFixed(2);
      return { num: v, unit: 'kWh', full: `${v} kWh` };
    }
    const v = Math.round(rawWatts).toString();
    return { num: v, unit: 'Wh', full: `${v} Wh` };
  }
}

export function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
}

// ============================================================================
// SEGMENT PROFILES DATA REPOSITORY
// ============================================================================

interface SegmentData {
  customerName: string;
  customerInitials: string;
  customerID: string;
  contractID: string;
  badgeLabel: string;
  packageName: string;
  packageSpecs: string;
  address: string;
  gpsCoords: string;
  roofAzimuth: string;
  earthingOhms: string;
  shroudSerial: string;
  feederName: string;
  feederStatus: string;
  feederVolts: number;
  dustLossPct: number;
  opticalEfficiencyPct: number;
  // Roof ATM
  todayHarvestNaira: number;
  todayPetrolAvoidedLiters: number;
  paybackProgressPct: number;
  // Financial Amortization
  totalPackageCost: number;
  paidToDate: number;
  balanceLeft: number;
  equityPct: number;
  monthsPaid: number;
  totalTenureMonths: number;
  monthlyInstallment: number;
  walletDaysRemaining: number;
  // Credit & Bankability
  creditScore: number;
  creditTier: string;
  preApprovedFacility: string;
  carbonOffsetTons: number;
  treesEquivalent: number;
  // Battery Physics & Quantiles
  batteryCapacityWh: number;
  currentSoC: number;
  p25BaseloadWatts: number;
  p50ForecastWatts: number;
  p90PeakWatts: number;
  // Dynamic Narratives per timeframe
  narratives: Record<TimeframePeriod, string>;
  // Base energy totals per timeframe (Solar Wh, Load Wh)
  periodTotals: Record<TimeframePeriod, { solarWh: number; loadWh: number }>;
}

const SEGMENTS: Record<CustomerSegment, SegmentData> = {
  residential: {
    customerName: 'Engr. Shwarji I. Khatang',
    customerInitials: 'SK',
    customerID: 'SKY-CUST-88421',
    contractID: 'CTR-JOS-2026-001',
    badgeLabel: 'COREN Verified Asset',
    packageName: 'Growatt SPF 5000ES 5.4 kWp Executive Solar Home',
    packageSpecs: '5.4 kWp Solar • 10.0 kWh LiFePO4 • 5.0 kVA Hybrid Inverter',
    address: 'Plot 14 Commercial Area, Yakubu Gowon Way, Jos, Plateau State',
    gpsCoords: '9.8365° N, 8.8883° E',
    roofAzimuth: '182° SSW (Tilt 15° True Solar Meridian)',
    earthingOhms: '1.85 Ω (< 2.5 Ω COREN & NEMSA Certified)',
    shroudSerial: 'SEAL-NG-00421 (Tamper-evident optical loop active)',
    feederName: 'JED Rayfield 33kV Band A Feeder',
    feederStatus: 'Grid Collapsed (0V AC) — 112h Blackouts Bridged Seamlessly',
    feederVolts: 0,
    dustLossPct: 4.2,
    opticalEfficiencyPct: 95.8,
    todayHarvestNaira: 11750,
    todayPetrolAvoidedLiters: 9.4,
    paybackProgressPct: 54.2,
    totalPackageCost: 6300000,
    paidToDate: 3920000,
    balanceLeft: 2380000,
    equityPct: 62.2,
    monthsPaid: 14,
    totalTenureMonths: 36,
    monthlyInstallment: 145000,
    walletDaysRemaining: 19.5,
    creditScore: 792,
    creditTier: 'Tier-1 Prime',
    preApprovedFacility: 'Eligible for 0%-Deposit LiFePO4 Battery Expansion',
    carbonOffsetTons: 1.45,
    treesEquivalent: 67,
    batteryCapacityWh: 10000,
    currentSoC: 88,
    p25BaseloadWatts: 310,
    p50ForecastWatts: 475,
    p90PeakWatts: 1020,
    narratives: {
      '1D': 'Today your solar array achieved 98.4% facility self-sufficiency, generating 24.8 kWh of clean power. Your LiFePO4 battery smoothly bridged 6.5 hours of JED Rayfield grid blackouts, saving ₦14,350 in generator petrol and maintenance.',
      '1W': 'Over the past 7 days, your system harvested 178 kWh of free solar power. Despite 38 hours of cumulative utility grid outages, zero business hours were lost, and you retained ₦82,400 in fuel expenditure.',
      '1M': 'Your system harvested 18% more solar power this month due to clear weather. By relying on your LiFePO4 storage during evening grid collapses, you completely avoided 112 hours of utility blackouts and saved an estimated ₦176,250 that would have otherwise been spent on generator petrol.',
      '1Y': 'Over the past 12 months, your Growatt asset generated 7.82 MWh of clean electricity, avoiding 1,420 hours of DisCo blackouts and displacing ₦2,114,000 in fuel costs — accelerating full asset payback to month 28.',
    },
    periodTotals: {
      '1D': { solarWh: 24800, loadWh: 16400 },
      '1W': { solarWh: 178000, loadWh: 116000 },
      '1M': { solarWh: 745000, loadWh: 502000 },
      '1Y': { solarWh: 7820000, loadWh: 5600000 },
    },
  },
  commercial: {
    customerName: 'St. Mary Specialist Hospital & Lab',
    customerInitials: 'SM',
    customerID: 'SKY-CUST-44109',
    contractID: 'CTR-BEN-2026-014',
    badgeLabel: 'NEMSA Hospital Grade Tier-1',
    packageName: 'Growatt SPH 10000TL 10.0 kWp Clinical Cold-Chain',
    packageSpecs: '10.0 kWp Solar • 20.48 kWh LiFePO4 • 10.0 kVA Commercial Inverter',
    address: 'KM 4 Otukpo-Enugu Expressway, Otukpo, Benue State',
    gpsCoords: '7.1982° N, 8.1341° E',
    roofAzimuth: '178° True South (Tilt 12°)',
    earthingOhms: '1.42 Ω (Hospital Sub-2.0Ω Clean Ground)',
    shroudSerial: 'SEAL-BEN-09188 (Dual-lock steel seal verified)',
    feederName: 'JED Makurdi-Otukpo 33kV Feeder',
    feederStatus: 'Grid Collapsed (0V AC) — 184h Cold-Chain Downtime Prevented',
    feederVolts: 0,
    dustLossPct: 5.9,
    opticalEfficiencyPct: 94.1,
    todayHarvestNaira: 28400,
    todayPetrolAvoidedLiters: 22.8,
    paybackProgressPct: 48.6,
    totalPackageCost: 14800000,
    paidToDate: 7200000,
    balanceLeft: 7600000,
    equityPct: 48.6,
    monthsPaid: 17,
    totalTenureMonths: 36,
    monthlyInstallment: 380000,
    walletDaysRemaining: 24.2,
    creditScore: 815,
    creditTier: 'Corporate AAA Prime',
    preApprovedFacility: 'Eligible for 5.0kW Expansion + Zero-Collateral Terms',
    carbonOffsetTons: 3.82,
    treesEquivalent: 175,
    batteryCapacityWh: 20480,
    currentSoC: 92,
    p25BaseloadWatts: 720,
    p50ForecastWatts: 1150,
    p90PeakWatts: 2800,
    narratives: {
      '1D': 'Today your commercial cold-chain array generated 48.2 kWh, shaving peak clinic load by 4.8 kW between 11:30 AM and 3:00 PM. Critical vaccine refrigeration and surgery suites operated with zero interruption.',
      '1W': 'This week your Growatt commercial asset eliminated 46 hours of local grid downtime, preserving ₦1,250,000 in temperature-sensitive medical inventory and saving ₦164,000 against heavy diesel running costs.',
      '1M': 'By automatically shaving facility peak demand during afternoon clinic rush hours, your system bypassed utility maximum-demand surcharges, kept laboratory diagnostics uninterrupted, and eliminated ₦334,000 in diesel expenditure.',
      '1Y': 'Annual commercial yield reached 17.4 MWh with 99.9% uptime across all medical circuits. You avoided 2,240 hours of grid collapse, fully protecting patient services while saving ₦4,120,000 in fuel.',
    },
    periodTotals: {
      '1D': { solarWh: 48200, loadWh: 34800 },
      '1W': { solarWh: 342000, loadWh: 245000 },
      '1M': { solarWh: 1480000, loadWh: 1040000 },
      '1Y': { solarWh: 17400000, loadWh: 12200000 },
    },
  },
  industrial: {
    customerName: 'Apex Agro-Industrial Mill & Cold-Storage',
    customerInitials: 'AA',
    customerID: 'SKY-CUST-19203',
    contractID: 'CTR-KAD-2026-088',
    badgeLabel: '3-Phase Industrial Microgrid Certified',
    packageName: 'Growatt WIT 25.0 kWp 3-Phase Commercial Microgrid',
    packageSpecs: '25.0 kWp Solar • 51.2 kWh High-Voltage LiFePO4 • 30.0 kVA 3-Phase Inverter',
    address: 'Plot 8 Industrial Layout, Kakuri, Kaduna State',
    gpsCoords: '10.4591° N, 7.4192° E',
    roofAzimuth: '180° True South (Tilt 11°)',
    earthingOhms: '0.98 Ω (Sub-1.0 Ω Heavy Industrial Earthing)',
    shroudSerial: 'SEAL-KAD-00712 (Fiber-optic tamper monitored)',
    feederName: 'Kaduna Electric 33kV Dedicated Industrial Feeder',
    feederStatus: 'Feeder Shedding Active (0V AC) — 260h Heavy Milling Bridged',
    feederVolts: 0,
    dustLossPct: 7.6,
    opticalEfficiencyPct: 92.4,
    todayHarvestNaira: 74500,
    todayPetrolAvoidedLiters: 59.6,
    paybackProgressPct: 41.2,
    totalPackageCost: 36500000,
    paidToDate: 15000000,
    balanceLeft: 21500000,
    equityPct: 41.1,
    monthsPaid: 15,
    totalTenureMonths: 36,
    monthlyInstallment: 980000,
    walletDaysRemaining: 18.0,
    creditScore: 838,
    creditTier: 'Industrial Tier-1 Enterprise',
    preApprovedFacility: 'Eligible for Utility Intertie / Grid Net-Metering Facility',
    carbonOffsetTons: 9.64,
    treesEquivalent: 442,
    batteryCapacityWh: 51200,
    currentSoC: 85,
    p25BaseloadWatts: 1600,
    p50ForecastWatts: 2850,
    p90PeakWatts: 6400,
    narratives: {
      '1D': 'Today your 3-phase microgrid balanced motor inrush current seamlessly across L1/L2/L3 (1.8% imbalance), keeping heavy milling operations autonomous and saving ₦74,500 in industrial diesel.',
      '1W': 'Over the past 7 days, 1.25 MWh of clean electricity powered grain storage chillers and conveyers without a single phase dropout, avoiding ₦482,000 in fuel and utility kVA penalty surcharges.',
      '1M': 'Your multi-string array achieved an 84.6% Performance Ratio with 0.98 Power Factor stability. The facility completely bypassed 260 hours of utility load-shedding, retaining ₦965,000 in net operating margins.',
      '1Y': 'Year-to-date industrial harvest crossed 44.8 MWh with 100% compliance with NERC 50Hz frequency standards. The plant saved ₦11,580,000 against heavy diesel running, retaining core enterprise equity.',
    },
    periodTotals: {
      '1D': { solarWh: 122000, loadWh: 88000 },
      '1W': { solarWh: 860000, loadWh: 615000 },
      '1M': { solarWh: 3720000, loadWh: 2650000 },
      '1Y': { solarWh: 44800000, loadWh: 32000000 },
    },
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function EnergyAnalyticsSuite({
  mode = 'PUBLIC_PREVIEW',
  deviceID = 'DEV-8F3A-GROWATT-00421',
  customerState = 'Plateau (5.3h PSH)',
  onOpenContract,
}: EnergyAnalyticsSuiteProps) {
  // Navigation & Interactive State
  const [segment, setSegment] = useState<CustomerSegment>('residential');
  const [timeframe, setTimeframe] = useState<TimeframePeriod>('1M');
  const [forecastHorizon, setForecastHorizon] = useState<ForecastHorizon>('1D');
  const [showGisModal, setShowGisModal] = useState<boolean>(false);
  const [showAgentDrawer, setShowAgentDrawer] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const solarGradId = `solarGrad-${mode || "DEFAULT"}`;

  const activeData = useMemo(() => SEGMENTS[segment], [segment]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // --------------------------------------------------------------------------
  // SECTION 3: Ownership Donut Calculations
  // --------------------------------------------------------------------------
  const donutRadius = 40;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const donutStrokeDashoffset = donutCircumference - (activeData.equityPct / 100) * donutCircumference;

  // --------------------------------------------------------------------------
  // SECTION 4: 24h Solar & Load Historical Curve Simulation (Scaled to Segment)
  // --------------------------------------------------------------------------
  const historySeries = useMemo(() => {
    // 24 points: 00:00 to 23:00
    const peakWatts =
      segment === 'residential' ? 4620 : segment === 'commercial' ? 8900 : 23400;
    const baseLoad = activeData.p25BaseloadWatts;
    const peakLoad = activeData.p90PeakWatts;

    return Array.from({ length: 24 }, (_, hour) => {
      // Solar Bell Curve from 06:00 to 18:30 (Peak ~12:45)
      let solarW = 0;
      if (hour >= 6 && hour <= 18) {
        const rad = ((hour - 6) / 12) * Math.PI;
        solarW = Math.round(peakWatts * Math.sin(rad) * 0.96);
      }

      // Facility Load Curve: Baseload overnight, morning bump (07-09), midday shift, evening peak (19-22)
      let loadW = baseLoad;
      if (hour >= 7 && hour <= 9) loadW = baseLoad + (peakLoad - baseLoad) * 0.6;
      else if (hour >= 11 && hour <= 15) loadW = baseLoad + (peakLoad - baseLoad) * 0.55;
      else if (hour >= 18 && hour <= 22) loadW = peakLoad;

      return {
        hour: `${hour.toString().padStart(2, '0')}:00`,
        solarW,
        loadW,
      };
    });
  }, [segment, activeData]);

  // SVG Chart Geometry for Section 4
  const chartW = 740;
  const chartH = 240;
  const padL = 60;
  const padR = 20;
  const padT = 30;
  const padB = 40;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const maxPowerW = useMemo(() => {
    return Math.max(...historySeries.map((d) => Math.max(d.solarW, d.loadW))) * 1.15;
  }, [historySeries]);

  const solarPolyPoints = useMemo(() => {
    const pts = historySeries.map((d, i) => {
      const x = padL + (i / (historySeries.length - 1)) * plotW;
      const y = padT + plotH - (d.solarW / maxPowerW) * plotH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const firstX = padL;
    const lastX = padL + plotW;
    const baseY = padT + plotH;
    return `${firstX},${baseY} ${pts.join(' ')} ${lastX},${baseY}`;
  }, [historySeries, maxPowerW, plotW, plotH]);

  const solarLinePath = useMemo(() => {
    return historySeries
      .map((d, i) => {
        const x = padL + (i / (historySeries.length - 1)) * plotW;
        const y = padT + plotH - (d.solarW / maxPowerW) * plotH;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [historySeries, maxPowerW, plotW, plotH]);

  const loadLinePath = useMemo(() => {
    return historySeries
      .map((d, i) => {
        const x = padL + (i / (historySeries.length - 1)) * plotW;
        const y = padT + plotH - (d.loadW / maxPowerW) * plotH;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [historySeries, maxPowerW, plotW, plotH]);

  // Autonomy Crossover coordinate (at hour index 8.5 -> 08:30 AM)
  const crossoverX = padL + (8.5 / 23) * plotW;
  const crossoverY = padT + plotH - (activeData.p25BaseloadWatts * 1.3 / maxPowerW) * plotH;

  // --------------------------------------------------------------------------
  // SECTION 5: Battery Survival Clock Math (Above 20% DoD)
  // --------------------------------------------------------------------------
  const usableBatteryWh = useMemo(() => {
    const usableFraction = Math.max(0, (activeData.currentSoC - 20) / 100);
    return Math.round(activeData.batteryCapacityWh * usableFraction);
  }, [activeData]);

  const survivalHours = useMemo(() => {
    const expectedH = usableBatteryWh / activeData.p50ForecastWatts;
    const lightH = usableBatteryWh / activeData.p25BaseloadWatts;
    const heavyH = usableBatteryWh / activeData.p90PeakWatts;

    const fmt = (hrs: number) => {
      const h = Math.floor(hrs);
      const m = Math.round((hrs - h) * 60);
      return `${h} hrs ${m.toString().padStart(2, '0')} mins`;
    };

    return {
      expected: fmt(expectedH),
      expectedRaw: expectedH,
      light: fmt(lightH),
      heavy: fmt(heavyH),
    };
  }, [usableBatteryWh, activeData]);

  // --------------------------------------------------------------------------
  // SECTION 6: Triple-Source Substitution Calculations
  // --------------------------------------------------------------------------
  const periodKWh = activeData.periodTotals[timeframe].solarWh / 1000;
  const gridTariffNaira = 209; // NERC Band A Tariff
  const genFuelPriceNaira = 1250; // Petrol/Diesel per liter
  const genKWhPerLiter = 2.8; // Nigerian Engineering Standard (2.8 kWh / L)

  const costComparison = useMemo(() => {
    // 1. Solar PAYG cost for period
    let solarCost = 0;
    if (timeframe === '1D') solarCost = activeData.monthlyInstallment / 30;
    else if (timeframe === '1W') solarCost = (activeData.monthlyInstallment / 30) * 7;
    else if (timeframe === '1M') solarCost = activeData.monthlyInstallment;
    else solarCost = activeData.monthlyInstallment * 12;

    // 2. National Grid estimated cost for same energy
    const gridCost = Math.round(periodKWh * gridTariffNaira);

    // 3. Fossil Generator estimated cost: (kWh / 2.8) * 1250 + maintenance
    const litersNeeded = periodKWh / genKWhPerLiter;
    const maintenanceFactor =
      timeframe === '1D' ? 950 : timeframe === '1W' ? 6500 : timeframe === '1M' ? 28000 : 336000;
    const genCost = Math.round(litersNeeded * genFuelPriceNaira + maintenanceFactor);

    const netSavingsVsGen = Math.max(0, genCost - solarCost);
    const netSavingsVsGrid = Math.round(solarCost - gridCost);

    return {
      solarCost,
      gridCost,
      genCost,
      litersNeeded: Math.round(litersNeeded * 10) / 10,
      netSavingsVsGen,
      netSavingsVsGrid,
    };
  }, [periodKWh, timeframe, activeData]);

  // --------------------------------------------------------------------------
  // SECTION 7: Multi-Horizon Sunshine & Load Confidence-Band Simulation
  // --------------------------------------------------------------------------
  const forecastSeries = useMemo(() => {
    let count = 24;
    let labelPrefix = 'H';
    if (forecastHorizon === '1H') count = 12; // 5-min intervals
    else if (forecastHorizon === '1D') count = 24; // 24 hours
    else if (forecastHorizon === '1W') count = 7; // 7 days
    else if (forecastHorizon === '1M') count = 4; // 4 weeks
    else count = 12; // 12 months

    const peakW =
      segment === 'residential' ? 4800 : segment === 'commercial' ? 9500 : 24500;
    const avgLoadW = activeData.p50ForecastWatts;

    return Array.from({ length: count }, (_, i) => {
      let solarMean = 0;
      let solarUpper = 0;
      let solarLower = 0;
      let loadMean = avgLoadW;

      if (forecastHorizon === '1D') {
        if (i >= 6 && i <= 18) {
          const s = Math.sin(((i - 6) / 12) * Math.PI) * peakW;
          solarMean = Math.round(s);
          solarUpper = Math.round(s * 1.15);
          solarLower = Math.max(0, Math.round(s * 0.85));
        }
        if (i >= 18 && i <= 22) loadMean = activeData.p90PeakWatts;
      } else if (forecastHorizon === '1W') {
        const variation = [1.02, 0.98, 1.05, 0.78, 0.95, 1.08, 1.0]; // Thu dust front
        const v = variation[i % 7];
        solarMean = Math.round(peakW * 0.88 * v);
        solarUpper = Math.round(solarMean * 1.12);
        solarLower = Math.round(solarMean * 0.85);
        loadMean = Math.round(avgLoadW * (i >= 5 ? 0.75 : 1.1));
      } else {
        solarMean = Math.round(peakW * 0.82);
        solarUpper = Math.round(solarMean * 1.18);
        solarLower = Math.round(solarMean * 0.82);
      }

      return {
        label: `${labelPrefix}${i + 1}`,
        solarMean,
        solarUpper,
        solarLower,
        loadMean,
      };
    });
  }, [forecastHorizon, segment, activeData]);

  const forecastMaxW = useMemo(() => {
    return Math.max(...forecastSeries.map((d) => Math.max(d.solarUpper, d.loadMean))) * 1.15 || 5000;
  }, [forecastSeries]);

  const forecastBandPolygon = useMemo(() => {
    const ptsUpper = forecastSeries.map((d, i) => {
      const x = padL + (i / (forecastSeries.length - 1)) * plotW;
      const y = padT + plotH - (d.solarUpper / forecastMaxW) * plotH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const ptsLowerRev = forecastSeries
      .slice()
      .reverse()
      .map((d, i) => {
        const origIdx = forecastSeries.length - 1 - i;
        const x = padL + (origIdx / (forecastSeries.length - 1)) * plotW;
        const y = padT + plotH - (d.solarLower / forecastMaxW) * plotH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
    return `${ptsUpper.join(' ')} ${ptsLowerRev.join(' ')}`;
  }, [forecastSeries, forecastMaxW, plotW, plotH]);

  const forecastSolarLine = useMemo(() => {
    return forecastSeries
      .map((d, i) => {
        const x = padL + (i / (forecastSeries.length - 1)) * plotW;
        const y = padT + plotH - (d.solarMean / forecastMaxW) * plotH;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [forecastSeries, forecastMaxW, plotW, plotH]);

  const forecastLoadLine = useMemo(() => {
    return forecastSeries
      .map((d, i) => {
        const x = padL + (i / (forecastSeries.length - 1)) * plotW;
        const y = padT + plotH - (d.loadMean / forecastMaxW) * plotH;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [forecastSeries, forecastMaxW, plotW, plotH]);

  // ==========================================================================
  // RENDER UI
  // ==========================================================================
  return (
    <div className="w-full bg-[#0B0F19] text-slate-100 font-sans space-y-6 sm:space-y-8 select-none">
      
      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl bg-[#111827] border border-[#10B981]/50 text-[#10B981] text-xs font-mono font-bold shadow-2xl shadow-emerald-950/80 flex items-center gap-3 animate-fade-in">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =====================================================================
          SECTION 1: Executive Customer Identity, Picture Column, Geo-Tag & Roof ATM
         ===================================================================== */}
      <section className="p-5 sm:p-6 rounded-3xl bg-[#111827] border border-[#64748B]/30 shadow-2xl backdrop-blur-md space-y-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          
          {/* Customer Avatar & Verified Metadata */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-tr from-amber-500 via-emerald-500 to-sky-400 p-0.5">
                <div className="w-full h-full rounded-full bg-[#1E293B] flex items-center justify-center text-xl sm:text-2xl font-black text-[#FFBF00] font-heading">
                  {activeData.customerInitials}
                </div>
              </div>
              <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#0B0F19] animate-pulse" />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  {activeData.customerName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] text-[10px] font-mono font-bold">
                  ✓ {activeData.badgeLabel}
                </span>
              </div>
              <div className="text-xs text-[#64748B] font-mono flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>ID: <strong className="text-slate-200">{activeData.customerID}</strong></span>
                <span>•</span>
                <span>Contract: <strong className="text-slate-200">{activeData.contractID}</strong></span>
                <span>•</span>
                <span>Device: <strong className="text-[#FFBF00]">{deviceID}</strong></span>
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-1.5 pt-0.5">
                <span className="text-[#64748B]">📍 {activeData.address}</span>
              </div>
            </div>
          </div>

          {/* Interactive Geo-Tag & Segment Switcher */}
          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
            
            {/* Clickable GPS Geo-Tag Pill */}
            <button
              type="button"
              onClick={() => setShowGisModal(true)}
              className="px-3.5 py-2 rounded-xl bg-[#1E293B] hover:bg-[#1E293B] border border-[#64748B]/40 hover:border-[#FFBF00]/50 text-xs text-[#FFBF00] font-mono transition flex items-center gap-2 shadow-inner group"
            >
              <span className="text-sm group-hover:scale-110 transition">🛰️</span>
              <span className="font-semibold underline decoration-amber-400/40 underline-offset-4">
                {activeData.gpsCoords} — Inspect Roof &amp; Feeder GIS
              </span>
            </button>

            {/* Segment Viewport Switcher */}
            <div className="inline-flex rounded-xl p-1 bg-[#1E293B] border border-[#64748B]/30 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSegment('residential')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  segment === 'residential'
                    ? 'bg-[#FFBF00] text-[#0B0F19] font-bold shadow'
                    : 'text-[#64748B] hover:text-white'
                }`}
              >
                1. Residential
              </button>
              <button
                type="button"
                onClick={() => setSegment('commercial')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  segment === 'commercial'
                    ? 'bg-[#FFBF00] text-[#0B0F19] font-bold shadow'
                    : 'text-[#64748B] hover:text-white'
                }`}
              >
                2. Commercial SME
              </button>
              <button
                type="button"
                onClick={() => setSegment('industrial')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  segment === 'industrial'
                    ? 'bg-[#FFBF00] text-[#0B0F19] font-bold shadow'
                    : 'text-[#64748B] hover:text-white'
                }`}
              >
                3. Industrial
              </button>
            </div>
          </div>
        </div>

        {/* Signature Innovation: Live "Solar Wallet / Roof ATM" Ticker */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#10B981]/15 via-[#111827] to-[#FFBF00]/10 border border-[#10B981]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#10B981]/20 border border-[#10B981]/40 flex items-center justify-center text-xl text-[#10B981] font-bold">
              🏧
            </div>
            <div>
              <span className="text-[11px] text-[#10B981] font-bold uppercase tracking-wider block font-mono">
                Live Roof ATM &bull; Clean Energy Yield Counter
              </span>
              <div className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
                <span>Today&apos;s Roof ATM Yield:</span>
                <span className="text-[#10B981] font-mono font-black">
                  +{formatNaira(activeData.todayHarvestNaira)}
                </span>
                <span className="text-xs text-[#64748B] font-mono hidden sm:inline">
                  • {activeData.todayPetrolAvoidedLiters}L Petrol Displaced Today
                </span>
              </div>
            </div>
          </div>

          <div className="w-full md:w-72 space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-[#64748B]">Total System Cost Recouped:</span>
              <strong className="text-[#FFBF00]">{activeData.paybackProgressPct}%</strong>
            </div>
            <div className="w-full h-2 rounded-full bg-[#1E293B] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full transition-all duration-700"
                style={{ width: `${activeData.paybackProgressPct}%` }}
              />
            </div>
            <span className="text-[10px] text-[#64748B] font-mono block text-right">
              {activeData.paybackProgressPct}% of Total System Cost Harvested from the Sun
            </span>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 2: Narrative Headline Panel + DisCo Feeder & Harmattan Strip
         ===================================================================== */}
      <section className="space-y-3">
        {/* Top-Fold Natural-Language Data Storyteller */}
        <div className="p-5 rounded-2xl bg-[#111827] border-l-4 border-[#FFBF00] border-y border-r border-[#64748B]/30 shadow-xl space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FFBF00] animate-pulse" />
              <span className="text-xs font-bold text-[#FFBF00] font-mono uppercase tracking-wider">
                Natural-Language Energy Storyteller &bull; Period: {timeframe}
              </span>
            </div>
            <span className="text-xs text-[#64748B] font-mono">
              Algorithmic Telemetry Synthesis
            </span>
          </div>
          <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-sans font-medium">
            &ldquo;{activeData.narratives[timeframe]}&rdquo;
          </p>
        </div>

        {/* Automated DisCo Feeder & Harmattan Micro-Climate Telemetry Strip */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
          
          {/* DisCo Feeder Health Pill */}
          <div className="p-3 rounded-xl bg-[#111827] border border-[#EF4444]/30 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-ping flex-shrink-0" />
            <div className="overflow-hidden">
              <span className="text-[#EF4444] font-bold block truncate">
                ⚡ {activeData.feederName}
              </span>
              <span className="text-[11px] text-slate-300 block truncate">
                {activeData.feederStatus}
              </span>
            </div>
          </div>

          {/* Harmattan Optical Soiling Pill */}
          <div className="p-3 rounded-xl bg-[#111827] border border-[#10B981]/30 flex items-center gap-3">
            <span className="text-lg flex-shrink-0">☀️</span>
            <div className="overflow-hidden">
              <span className="text-[#10B981] font-bold block truncate">
                Optical Efficiency: {activeData.opticalEfficiencyPct}%
              </span>
              <span className="text-[11px] text-slate-300 block truncate">
                {activeData.dustLossPct}% Harmattan Dust Loss &bull; Panel Glass Clean
              </span>
            </div>
          </div>

          {/* Live Inverter & Battery Heartbeat */}
          <div className="p-3 rounded-xl bg-[#111827] border border-[#22D3EE]/30 flex items-center gap-3 sm:col-span-2 lg:col-span-1">
            <span className="text-lg flex-shrink-0">🔋</span>
            <div className="overflow-hidden">
              <span className="text-[#22D3EE] font-bold block truncate">
                LiFePO4 Reserve: {activeData.currentSoC}% (52.8V DC)
              </span>
              <span className="text-[11px] text-slate-300 block truncate">
                AC Output: 230.2V @ 50.02 Hz (Micro-break &lt; 10ms)
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 3: Package Amortization Ledger + Credit Passport
         ===================================================================== */}
      <section className="p-5 sm:p-6 rounded-3xl bg-[#111827] border border-[#64748B]/30 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#64748B]/30 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>💳</span> Package Amortization Ledger &amp; Clean Energy Bankability Passport
            </h2>
            <p className="text-xs text-[#64748B] font-mono">
              Transparent 36-Month Lease-to-Own contract. Zero balloon fees or prepayment penalties.
            </p>
          </div>
          <button
            type="button"
            onClick={() => showToast('✓ Official COREN/NEMSA Lease Agreement Downloaded')}
            className="px-3 py-1.5 rounded-lg bg-[#1E293B] hover:bg-[#64748B]/30 text-xs font-mono text-slate-200 transition"
          >
            Download Agreement (PDF)
          </button>
        </div>

        <div className="grid lg:grid-cols-12 gap-6 items-center">
          
          {/* Circular Donut Ownership Gauge (3 Cols) */}
          <div className="lg:col-span-3 flex flex-col items-center justify-center p-4 rounded-2xl bg-[#1E293B] border border-[#64748B]/30 text-center space-y-2">
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r={donutRadius}
                  stroke="#1E293B"
                  strokeWidth="10"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={donutRadius}
                  stroke="#FFBF00"
                  strokeWidth="10"
                  strokeDasharray={donutCircumference}
                  strokeDashoffset={donutStrokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-[#FFBF00] font-mono">
                  {activeData.equityPct}%
                </span>
                <span className="text-[9px] text-[#64748B] font-bold uppercase tracking-wider">
                  Equity Owned
                </span>
              </div>
            </div>
            <div className="text-xs font-mono">
              <span className="text-slate-300 font-bold">
                {activeData.monthsPaid} of {activeData.totalTenureMonths} Months
              </span>
              <p className="text-[10px] text-[#64748B]">Amortization On Schedule</p>
            </div>
          </div>

          {/* 4 Package Financial Cards (6 Cols) */}
          <div className="lg:col-span-6 grid sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-[#1E293B] border border-[#64748B]/30 space-y-1">
              <span className="text-[11px] text-[#64748B] font-mono block">Total Chosen Package Cost</span>
              <div className="text-lg font-black text-white font-mono">
                {formatNaira(activeData.totalPackageCost)}
              </div>
              <span className="text-[10px] text-[#10B981] font-mono block">
                Paid to Date: {formatNaira(activeData.paidToDate)}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#1E293B] border border-[#64748B]/30 space-y-1">
              <span className="text-[11px] text-[#64748B] font-mono block">Balance Left to Full Offset</span>
              <div className="text-lg font-black text-[#FFBF00] font-mono">
                {formatNaira(activeData.balanceLeft)}
              </div>
              <span className="text-[10px] text-[#64748B] font-mono block">
                Zero early-payoff penalty
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#1E293B] border border-[#64748B]/30 space-y-1">
              <span className="text-[11px] text-[#64748B] font-mono block">Fixed Monthly Lease Due</span>
              <div className="text-lg font-black text-white font-mono">
                {formatNaira(activeData.monthlyInstallment)} <span className="text-xs text-[#64748B] font-normal">/mo</span>
              </div>
              <span className="text-[10px] text-[#10B981] font-mono block">
                Next Due: {activeData.walletDaysRemaining} Wallet Days Left
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#1E293B] border border-[#64748B]/30 space-y-1">
              <span className="text-[11px] text-[#64748B] font-mono block">Remaining Lease Tenure</span>
              <div className="text-lg font-black text-white font-mono">
                {activeData.totalTenureMonths - activeData.monthsPaid} Months Left
              </div>
              <span className="text-[10px] text-[#FFBF00] font-mono block">
                100% Title Deed at Month 36
              </span>
            </div>
          </div>

          {/* Clean Energy Credit & Bankability Passport Card (3 Cols) */}
          <div className="lg:col-span-3 p-4 rounded-2xl bg-gradient-to-br from-[#111827] via-[#1E293B] to-[#10B981]/15 border border-[#10B981]/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#10B981] uppercase tracking-widest font-mono">
                Energy Credit Passport
              </span>
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
            </div>

            <div>
              <span className="text-xs text-[#64748B] block font-mono">Verifiable Clean Energy Score:</span>
              <div className="text-2xl font-black text-[#10B981] font-mono">
                {activeData.creditScore} <span className="text-xs font-normal text-[#64748B]">/ 850</span>
              </div>
              <span className="text-[11px] text-[#10B981] font-semibold block">
                {activeData.creditTier}
              </span>
            </div>

            <div className="pt-2 border-t border-[#64748B]/30 space-y-1 text-[11px] font-mono">
              <div className="text-[#FFBF00] font-semibold">
                ★ {activeData.preApprovedFacility}
              </div>
              <div className="text-[#64748B]">
                COREN/ESG Offset: <strong className="text-white">{activeData.carbonOffsetTons} tCO₂e</strong> ({activeData.treesEquivalent} Trees)
              </div>
            </div>

            <button
              type="button"
              onClick={() => showToast('✓ ESG Carbon Offset Certificate generated (1.45 tCO2e COREN verified)')}
              className="w-full py-2 rounded-xl bg-[#10B981]/20 hover:bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] text-xs font-mono font-bold transition text-center"
            >
              Download ESG Certificate
            </button>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 4: Historical Time-Variance Line Graph (1D | 1W | 1M | 1Y)
         ===================================================================== */}
      <section className="p-5 sm:p-6 rounded-3xl bg-[#111827] border border-[#64748B]/30 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#64748B]/30 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>📈</span> Historical Energy Generation vs. Facility Load Demand
            </h2>
            <p className="text-xs text-[#64748B] font-mono">
              Continuous integral telemetry logged via atomic Growatt Modbus VFS store.
            </p>
          </div>

          {/* Timeframe Selector Tabs */}
          <div className="inline-flex rounded-xl p-1 bg-[#1E293B] border border-[#64748B]/30 text-xs font-semibold">
            {(['1D', '1W', '1M', '1Y'] as TimeframePeriod[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTimeframe(t)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  timeframe === t
                    ? 'bg-[#FFBF00] text-[#0B0F19] font-bold shadow'
                    : 'text-[#64748B] hover:text-white'
                }`}
              >
                {t === '1D' ? '1 Day' : t === '1W' ? '1 Week' : t === '1M' ? '1 Month' : '1 Year'}
              </button>
            ))}
          </div>
        </div>

        {/* Period Integral KPI Cards */}
        <div className="grid grid-cols-3 gap-3 font-mono">
          <div className="p-3.5 rounded-2xl bg-[#1E293B] border border-[#64748B]/30 space-y-1">
            <span className="text-[11px] text-[#FFBF00] font-bold uppercase tracking-wider block">
              Total Solar Generated
            </span>
            <div className="text-lg sm:text-2xl font-black text-[#FFBF00]">
              {formatSI(activeData.periodTotals[timeframe].solarWh, 'ENERGY').full}
            </div>
            <span className="text-[10px] text-[#64748B] block">Clean MPPT Harvest</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#1E293B] border border-[#64748B]/30 space-y-1">
            <span className="text-[11px] text-slate-300 font-bold uppercase tracking-wider block">
              Facility Load Consumed
            </span>
            <div className="text-lg sm:text-2xl font-black text-slate-200">
              {formatSI(activeData.periodTotals[timeframe].loadWh, 'ENERGY').full}
            </div>
            <span className="text-[10px] text-[#64748B] block">Total Active Appliance Use</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#1E293B] border border-[#64748B]/30 space-y-1">
            <span className="text-[11px] text-[#10B981] font-bold uppercase tracking-wider block">
              Solar Self-Sufficiency
            </span>
            <div className="text-lg sm:text-2xl font-black text-[#10B981]">
              {Math.min(
                100,
                Math.round(
                  (activeData.periodTotals[timeframe].solarWh /
                    activeData.periodTotals[timeframe].loadWh) *
                    100
                )
              )}%
            </div>
            <span className="text-[10px] text-[#10B981]/80 block">Zero Grid Import Needed</span>
          </div>
        </div>

        {/* Autonomy Crossover Banner */}
        <div className="p-3 rounded-xl bg-[#FFBF00]/10 border border-[#FFBF00]/30 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FFBF00] animate-ping" />
            <span className="font-bold text-white">◈ Solar Autonomy Transition Point:</span>
            <span className="text-[#FFBF00] font-bold">08:30 AM Daily</span>
          </div>
          <span className="text-slate-300 hidden sm:inline text-[11px]">
            Array output surpasses facility baseload; 100% autonomous battery charging begins
          </span>
        </div>

        {/* Dual-Axis SVG Line & Area Chart */}
        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto select-none">
            <defs>
              <linearGradient id={solarGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFBF00" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#FFBF00" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
              const y = padT + plotH * pct;
              const val = Math.round(maxPowerW * (1 - pct));
              return (
                <g key={idx}>
                  <line
                    x1={padL}
                    y1={y}
                    x2={padL + plotW}
                    y2={y}
                    stroke="#1E293B"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x={padL - 10}
                    y={y + 3}
                    fill="#64748B"
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    {formatSI(val, 'POWER').full}
                  </text>
                </g>
              );
            })}

            {/* Solar Harvest Area & Line (Amber) */}
            <polygon points={solarPolyPoints} fill={`url(#${solarGradId})`} />
            <path d={solarLinePath} fill="none" stroke="#FFBF00" strokeWidth="2.5" />

            {/* Facility Load Line (Slate dashed) */}
            <path
              d={loadLinePath}
              fill="none"
              stroke="#94A3B8"
              strokeWidth="2"
              strokeDasharray="4 4"
            />

            {/* Solar Autonomy Transition Point Pin Anchor (08:30 AM) */}
            <g transform={`translate(${crossoverX.toFixed(1)}, ${crossoverY.toFixed(1)})`}>
              <circle r="6" fill="#FFBF00" fillOpacity="0.3" className="animate-ping" />
              <circle r="4" fill="#FFBF00" stroke="#0F172A" strokeWidth="2" />
              <line x1="0" y1="-5" x2="0" y2="-25" stroke="#FFBF00" strokeWidth="1.5" strokeDasharray="2 2" />
              <rect x="-60" y="-45" width="120" height="20" rx="6" fill="#0F172A" stroke="#FFBF00" strokeWidth="1" />
              <text x="0" y="-32" fill="#FFBF00" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                ◈ AUTONOMY: 08:30 AM
              </text>
            </g>

            {/* X-Axis Hour Labels */}
            {historySeries.map((d, i) => {
              if (i % 3 !== 0 && i !== 23) return null;
              const x = padL + (i / (historySeries.length - 1)) * plotW;
              return (
                <text
                  key={i}
                  x={x}
                  y={chartH - 12}
                  fill="#64748B"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {d.hour}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-mono pt-2 border-t border-[#64748B]/30">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#FFBF00]" />
            <span className="text-slate-300">☀️ Solar Array Output (#FFBF00)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-0.5 border-t-2 border-dashed border-[#64748B]" />
            <span className="text-slate-300">🏢 Connected Facility Load (#94A3B8)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFBF00] animate-ping" />
            <span className="text-[#FFBF00]">◈ Solar Autonomy Crossover (08:30 AM)</span>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 5: Forecast-Driven Dynamic Battery Survival Clock
         ===================================================================== */}
      <section className="p-5 sm:p-6 rounded-3xl bg-[#111827] border border-[#64748B]/30 shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#64748B]/30 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>⏱️</span> Dynamic Battery Survival Clock &bull; Quantile Load Forecast
            </h2>
            <p className="text-xs text-[#64748B] font-mono">
              Calculated from usable LiFePO4 energy ({formatSI(usableBatteryWh, 'ENERGY').full}) above the 20% DoD safety floor.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] text-xs font-mono font-bold">
            SoC: {activeData.currentSoC}% Active
          </span>
        </div>

        {/* 3 Quantile Load Scenarios */}
        <div className="grid md:grid-cols-3 gap-4 font-mono">
          
          {/* 1. Expected Autonomy */}
          <div className="p-4 rounded-2xl bg-[#10B981]/10 border border-[#10B981]/40 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[#10B981] uppercase tracking-wider">
                1. Expected Autonomy (P₅₀)
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981] font-bold">
                FORECASTED
              </span>
            </div>
            <div className="text-2xl font-black text-[#10B981]">
              {survivalHours.expected}
            </div>
            <span className="text-[11px] text-slate-300 font-sans block leading-relaxed">
              Comfortably bridges tonight and reaches tomorrow&apos;s 08:30 AM Solar Autonomy Crossover with 36% battery reserve to spare.
            </span>
            <div className="pt-2 text-[10px] text-[#10B981] border-t border-[#10B981]/20">
              Pace: ~{activeData.p50ForecastWatts} W Mean Evening Demand
            </div>
          </div>

          {/* 2. Light-Usage Pace */}
          <div className="p-4 rounded-2xl bg-[#1E293B] border border-[#64748B]/30 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[#22D3EE] uppercase tracking-wider">
                2. Light-Usage Pace (P₂₅)
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#22D3EE]/20 text-[#22D3EE] font-bold">
                BASELOAD
              </span>
            </div>
            <div className="text-2xl font-black text-[#22D3EE]">
              {survivalHours.light}
            </div>
            <span className="text-[11px] text-slate-300 font-sans block leading-relaxed">
              Baseload endurance (fans, refrigeration, lighting &amp; WiFi). Stretches through tomorrow midday without strain.
            </span>
            <div className="pt-2 text-[10px] text-[#22D3EE] border-t border-[#64748B]/30">
              Pace: ~{activeData.p25BaseloadWatts} W 25th Percentile
            </div>
          </div>

          {/* 3. Heavy-Usage Pace */}
          <div className="p-4 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/40 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[#EF4444] uppercase tracking-wider">
                3. Heavy-Usage Pace (P₉₀)
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#EF4444]/20 text-[#EF4444] font-bold">
                PEAK LOAD
              </span>
            </div>
            <div className="text-2xl font-black text-[#EF4444]">
              {survivalHours.heavy}
            </div>
            <span className="text-[11px] text-slate-300 font-sans block leading-relaxed">
              Depletes at 04:10 AM — keep evening load near your normal pattern to prevent grid or generator fallback.
            </span>
            <div className="pt-2 text-[10px] text-[#EF4444] border-t border-[#EF4444]/20">
              Pace: ~{activeData.p90PeakWatts} W 90th Percentile
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 6: Triple-Source Substitution Tracker & Grouped Bar Chart
         ===================================================================== */}
      <section className="p-5 sm:p-6 rounded-3xl bg-[#111827] border border-[#64748B]/30 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#64748B]/30 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>⚖️</span> Triple-Source Substitution Tracker &bull; Financial Optimization
            </h2>
            <p className="text-xs text-[#64748B] font-mono">
              Strict economic comparison: Solar PAYG vs. NERC Band A Grid vs. Petrol/Diesel Generator.
            </p>
          </div>
          <span className="text-xs text-[#10B981] font-mono font-bold">
            Period: {timeframe} ({periodKWh.toFixed(1)} kWh Displaced)
          </span>
        </div>

        {/* 3 Source Cards Matrix */}
        <div className="grid md:grid-cols-3 gap-4 font-mono">
          
          {/* Source 1: Solar PAYG */}
          <div className="p-4 rounded-2xl bg-[#10B981]/10 border border-[#10B981]/40 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[#10B981] uppercase tracking-wider">
                ☀️ Solar PAYG Asset
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981]">
                PRIMARY
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[#64748B] uppercase block">Levelized Cost / kWh</span>
              <div className="text-2xl font-black text-[#10B981]">
                ₦118 <span className="text-xs font-normal text-[#10B981]">/ kWh</span>
              </div>
            </div>
            <div className="space-y-1 text-xs text-slate-300 pt-2 border-t border-[#10B981]/20">
              <div className="flex justify-between">
                <span>Period Outlay:</span>
                <strong className="text-white">{formatNaira(costComparison.solarCost)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Availability:</span>
                <strong className="text-[#10B981]">99.8% Continuous</strong>
              </div>
              <div className="flex justify-between">
                <span>Asset Status:</span>
                <strong className="text-white">100% Own at Month 36</strong>
              </div>
            </div>
          </div>

          {/* Source 2: National Grid Band A */}
          <div className="p-4 rounded-2xl bg-[#1E293B] border border-[#64748B]/30 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                ⚡ National Grid (Band A)
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#1E293B] text-[#64748B]">
                DISCO
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[#64748B] uppercase block">NERC Band A Tariff</span>
              <div className="text-2xl font-black text-slate-200">
                ₦209 <span className="text-xs font-normal text-[#64748B]">/ kWh</span>
              </div>
            </div>
            <div className="space-y-1 text-xs text-[#64748B] pt-2 border-t border-[#64748B]/30">
              <div className="flex justify-between">
                <span>Baseline Would Spend:</span>
                <strong className="text-slate-200">{formatNaira(costComparison.gridCost)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Feeder Stability:</span>
                <strong className="text-[#FFBF00]">35.0% (Surge Risk)</strong>
              </div>
              <div className="flex justify-between">
                <span>Blackout Risk:</span>
                <strong className="text-[#EF4444]">112h Outage / Month</strong>
              </div>
            </div>
          </div>

          {/* Source 3: Fossil Generator */}
          <div className="p-4 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/30 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[#EF4444] uppercase tracking-wider">
                ⛽ Fossil Generator
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#EF4444]/20 text-[#EF4444]">
                FOSSIL BURN
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[#64748B] uppercase block">Specific Yield Fuel Cost</span>
              <div className="text-2xl font-black text-[#EF4444]">
                ₦525 <span className="text-xs font-normal text-[#EF4444]">/ kWh</span>
              </div>
            </div>
            <div className="space-y-1 text-xs text-slate-300 pt-2 border-t border-[#EF4444]/20">
              <div className="flex justify-between">
                <span>Period Burn &amp; Lube:</span>
                <strong className="text-[#EF4444]">{formatNaira(costComparison.genCost)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Fuel Needed:</span>
                <strong className="text-white">{costComparison.litersNeeded} L @ 2.8 kWh/L</strong>
              </div>
              <div className="flex justify-between">
                <span>Noise &amp; Pollution:</span>
                <strong className="text-[#EF4444]">85 dB • High Smoke</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Grouped Vertical Bar Visualization & Net Substitution Callout */}
        <div className="p-4 rounded-2xl bg-[#1E293B] border border-[#64748B]/30 flex flex-col md:flex-row items-center justify-between gap-6 font-mono">
          <div className="space-y-1">
            <span className="text-xs text-[#64748B] uppercase tracking-wider block font-bold">
              Net Financial Substitution Gain:
            </span>
            <div className="text-2xl sm:text-3xl font-black text-[#10B981]">
              +{formatNaira(costComparison.netSavingsVsGen)} Saved
            </div>
            <span className="text-xs text-slate-300">
              Retained cash vs. fossil generator operation for {timeframe} interval.
            </span>
          </div>

          {/* Proportional Bars */}
          <div className="w-full md:w-80 space-y-2 text-xs">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[#10B981]">Solar Asset:</span>
                <span className="text-white">{formatNaira(costComparison.solarCost)}</span>
              </div>
              <div className="h-2 rounded-full bg-[#1E293B] overflow-hidden">
                <div
                  className="h-full bg-[#10B981] rounded-full"
                  style={{
                    width: `${Math.round((costComparison.solarCost / costComparison.genCost) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[#64748B]">Grid Band A:</span>
                <span className="text-slate-300">{formatNaira(costComparison.gridCost)}</span>
              </div>
              <div className="h-2 rounded-full bg-[#1E293B] overflow-hidden">
                <div
                  className="h-full bg-[#64748B] rounded-full"
                  style={{
                    width: `${Math.round((costComparison.gridCost / costComparison.genCost) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[#EF4444]">Generator Fuel + Servicing:</span>
                <span className="text-[#EF4444] font-bold">{formatNaira(costComparison.genCost)}</span>
              </div>
              <div className="h-2 rounded-full bg-[#1E293B] overflow-hidden">
                <div className="h-full bg-[#EF4444] rounded-full w-full" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 7: Multi-Horizon Sunshine & Load Confidence-Band Chart
         ===================================================================== */}
      <section className="p-5 sm:p-6 rounded-3xl bg-[#111827] border border-[#64748B]/30 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#64748B]/30 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>🔮</span> Multi-Horizon Forecasted Sunshine &amp; Load Confidence Band
            </h2>
            <p className="text-xs text-[#64748B] font-mono">
              LightGBM &amp; NeuralProphet micro-climate synthesis with P10–P90 meteorological confidence bounds.
            </p>
          </div>

          {/* Horizon Selector Tabs */}
          <div className="inline-flex rounded-xl p-1 bg-[#1E293B] border border-[#64748B]/30 text-xs font-semibold">
            {(['1H', '1D', '1W', '1M', '1Y'] as ForecastHorizon[]).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setForecastHorizon(h)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  forecastHorizon === h
                    ? 'bg-[#22D3EE] text-[#0B0F19] font-bold shadow'
                    : 'text-[#64748B] hover:text-white'
                }`}
              >
                {h === '1H' ? 'Next Hour' : h === '1D' ? 'Next Day' : h === '1W' ? 'Next Week' : h === '1M' ? 'Next Month' : 'Next Year'}
              </button>
            ))}
          </div>
        </div>

        {/* Confidence-Interval SVG Band Chart */}
        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto select-none">
            {/* Shaded Upper/Lower Meteorological Confidence Band */}
            <polygon points={forecastBandPolygon} fill="#22D3EE" fillOpacity="0.15" />

            {/* Mean Forecasted Solar Generation (Cyan line) */}
            <path d={forecastSolarLine} fill="none" stroke="#22D3EE" strokeWidth="2.5" />

            {/* Forecasted Load Demand (Amber line) */}
            <path d={forecastLoadLine} fill="none" stroke="#F59E0B" strokeWidth="2" strokeDasharray="3 3" />

            {/* Grid references */}
            {[0, 0.5, 1].map((pct, idx) => {
              const y = padT + plotH * pct;
              const val = Math.round(forecastMaxW * (1 - pct));
              return (
                <g key={idx}>
                  <line
                    x1={padL}
                    y1={y}
                    x2={padL + plotW}
                    y2={y}
                    stroke="#1E293B"
                    strokeDasharray="2 2"
                    strokeWidth="1"
                  />
                  <text
                    x={padL - 10}
                    y={y + 3}
                    fill="#64748B"
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    {formatSI(val, 'POWER').full}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Proactive AI Coaching Callout & Agent Drawer Button */}
        <div className="p-4 rounded-2xl bg-[#22D3EE]/10 border border-[#22D3EE]/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl flex-shrink-0">🤖</span>
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-[#22D3EE] uppercase tracking-wider font-mono block">
                LocalGridAgent&trade; AI Dispatch Advisory
              </span>
              <p className="text-xs sm:text-sm text-slate-200 font-sans leading-relaxed">
                <strong className="text-white">AI Dispatch Note:</strong> Based on forecast of {formatSI(activeData.p90PeakWatts * 1.6, 'POWER').full} peak solar yield tomorrow at 12:45 PM and your current {activeData.currentSoC}% battery state of charge, your facility is 100% autonomous. Remain on solar priority. Schedule cold-room precooling, water pumping, and heavy appliances between 11:00 AM and 2:30 PM to achieve 100% free solar absorption without cycling battery reserves or paying grid tariffs.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAgentDrawer(true)}
            className="px-4 py-2.5 rounded-xl bg-[#22D3EE] hover:bg-cyan-300 text-[#0B0F19] font-bold text-xs font-mono transition flex-shrink-0 flex items-center gap-2 shadow-lg shadow-cyan-950"
          >
            <span>💬</span>
            <span>Open LocalGridAgent AI</span>
          </button>
        </div>
      </section>

      {/* =====================================================================
          INTERACTIVE MODAL 1: Roof & Feeder GIS Inspection Modal
         ===================================================================== */}
      {showGisModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-xl rounded-3xl bg-[#111827] border border-[#64748B]/40 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#64748B]/30 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🛰️</span>
                <h3 className="text-base font-bold text-white">
                  Verified Roof GIS &amp; Electrical Feeder Inspection
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGisModal(false)}
                className="w-8 h-8 rounded-full bg-[#1E293B] hover:bg-[#64748B]/30 text-[#64748B] hover:text-white flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-[#1E293B] border border-[#64748B]/30 space-y-1">
                <span className="text-[#64748B] block">GPS Coordinates &amp; Micro-Climate Geo-Belt:</span>
                <strong className="text-[#FFBF00] text-sm">{activeData.gpsCoords}</strong>
                <span className="text-[11px] text-[#64748B] block">Zone: {customerState}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#1E293B] border border-[#64748B]/30 space-y-1">
                  <span className="text-[#64748B] block">Roof Azimuth &amp; Tilt:</span>
                  <strong className="text-white">{activeData.roofAzimuth}</strong>
                </div>

                <div className="p-3 rounded-xl bg-[#1E293B] border border-[#64748B]/30 space-y-1">
                  <span className="text-[#64748B] block">Ground Earthing Resistance:</span>
                  <strong className="text-[#10B981]">{activeData.earthingOhms}</strong>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#1E293B] border border-[#64748B]/30 space-y-1">
                <span className="text-[#64748B] block">Lower-Shroud Security Seal:</span>
                <strong className="text-white">{activeData.shroudSerial}</strong>
              </div>

              <div className="p-3 rounded-xl bg-[#1E293B] border border-[#64748B]/30 space-y-1">
                <span className="text-[#64748B] block">Connected Utility Substation:</span>
                <strong className="text-[#EF4444]">{activeData.feederName}</strong>
                <span className="text-[11px] text-[#64748B] block">Status: {activeData.feederStatus}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(activeData.gpsCoords);
                  }
                  showToast('✓ GPS Coordinates Copied to Clipboard');
                }}
                className="px-4 py-2 rounded-xl bg-[#1E293B] hover:bg-[#64748B]/30 text-xs font-mono text-slate-200 transition"
              >
                Copy GPS Coordinates
              </button>
              <button
                type="button"
                onClick={() => setShowGisModal(false)}
                className="px-5 py-2 rounded-xl bg-[#FFBF00] hover:bg-amber-300 text-[#0B0F19] text-xs font-bold font-mono transition"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          INTERACTIVE MODAL 2: LocalGridAgent AI Advisory Drawer
         ===================================================================== */}
      {showAgentDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg h-full bg-[#111827] border-l border-[#64748B]/40 shadow-2xl p-6 flex flex-col justify-between space-y-4">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#64748B]/30 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#22D3EE]/20 border border-[#22D3EE]/40 flex items-center justify-center text-xl text-[#22D3EE]">
                  🤖
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">LocalGridAgent&trade; AI</h3>
                  <p className="text-xs text-[#22D3EE] font-mono">Read-Only Telemetry Advisory &bull; Active</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAgentDrawer(false)}
                className="w-8 h-8 rounded-full bg-[#1E293B] hover:bg-[#64748B]/30 text-[#64748B] hover:text-white flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            {/* Conversation Area */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs font-mono">
              <div className="p-3.5 rounded-2xl bg-[#22D3EE]/10 border border-[#22D3EE]/30 text-slate-200 leading-relaxed font-sans">
                👋 Hello {activeData.customerName}. I am your dedicated <strong>LocalGridAgent</strong>. I monitor your Growatt SPF inverter, LiFePO4 battery telemetry, and local meteorological forecasts in real-time.
              </div>

              <div className="p-3 rounded-xl bg-[#1E293B] border border-[#64748B]/30 space-y-1">
                <span className="text-[#64748B] block">Current Telemetry Snapshot:</span>
                <div className="text-[#10B981] font-bold">
                  • Battery SoC: {activeData.currentSoC}% ({formatSI(usableBatteryWh, 'ENERGY').full} Usable)
                </div>
                <div className="text-slate-300">
                  • Utility Grid: 0V AC (JED Rayfield Feeder Collapsed)
                </div>
                <div className="text-[#FFBF00]">
                  • Next Solar Autonomy: Tomorrow at 08:30 AM
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#1E293B] border border-[#64748B]/30 text-slate-200 leading-relaxed font-sans">
                💡 <strong>Operational Dispatch Recommendation:</strong>
                <p className="mt-1">
                  Based on forecast, remain 100% on solar battery reserve tonight. Your evening load curve will leave approximately 36% battery capacity by sunrise. No generator cranking or grid alternative is required based on financial analysis.
                </p>
              </div>
            </div>

            {/* Prompt Shortcuts */}
            <div className="space-y-2 pt-2 border-t border-[#64748B]/30">
              <span className="text-[10px] text-[#64748B] font-mono uppercase block">
                Quick Advisory Inquiries:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => showToast('LocalGridAgent: Safe to run borehole pump between 11:30 AM – 2:00 PM.')}
                  className="p-2 rounded-lg bg-[#1E293B] hover:bg-[#1E293B] border border-[#64748B]/30 text-left text-slate-300 hover:text-white transition"
                >
                  💧 Can I run the water pump?
                </button>
                <button
                  type="button"
                  onClick={() => showToast('LocalGridAgent: Expected battery survival is 14 hrs 20 mins.')}
                  className="p-2 rounded-lg bg-[#1E293B] hover:bg-[#1E293B] border border-[#64748B]/30 text-left text-slate-300 hover:text-white transition"
                >
                  🔋 What is my battery clock?
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowAgentDrawer(false)}
                className="w-full py-2.5 rounded-xl bg-[#22D3EE] hover:bg-cyan-300 text-[#0B0F19] text-xs font-bold font-mono transition"
              >
                Close AI Drawer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default EnergyAnalyticsSuite;

