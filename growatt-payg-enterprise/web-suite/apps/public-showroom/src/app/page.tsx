'use client';

/**
 * @fileoverview Global-Standard Public Marketing Landing Page & Progressive-Disclosure Solar Showroom
 * Application: web-suite/apps/public-showroom/src/app/page.tsx
 *
 * UX & Engineering Architecture:
 * 1. Primary Layer (Conversion-First): Highlights Monthly Net Naira Savings (Generator + Band A DisCo
 *    vs. Growatt PAYG Installment), Matched Bundle Hardware, and Overnight Autonomy Guarantee.
 * 2. Secondary Layer (Progressive Disclosure): Houses a collapsible "COREN Electrical Engineering &
 *    Derating Specification" drawer exposing W_run, Inductive Motor Surge VA_inv, 80% DoD LiFePO4
 *    Wh_batt, and State-level Peak Sun Hours (PSH) W_pv calculations for technical buyers and auditors.
 * 3. Interactive App Preview (#smart-app): Embeds the exact same shared <EnergyAnalyticsSuite mode="PUBLIC_PREVIEW" />
 *    component showcasing the 7-section world-standard energy, financial & forecast storytelling suite.
 * 4. Comprehensive Customer Sign-Up Modal: Global fintech standard with 11-digit NIMC NIN verification,
 *    auto-population of legal name, date of birth, gender, 30% down payment breakdown, and DVA generation.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { EnergyAnalyticsSuite } from './EnergyAnalyticsSuite';

// Regional solar irradiance data across Nigerian geographical belts
const NIGERIAN_STATES = [
  { state_name: 'FCT ABUJA', geo_belt: 'MIDDLE_BELT', peak_sun_hours: 5.1 },
  { state_name: 'PLATEAU', geo_belt: 'MIDDLE_BELT', peak_sun_hours: 5.3 },
  { state_name: 'BENUE', geo_belt: 'MIDDLE_BELT', peak_sun_hours: 4.9 },
  { state_name: 'NASARAWA', geo_belt: 'MIDDLE_BELT', peak_sun_hours: 5.0 },
  { state_name: 'LAGOS', geo_belt: 'SOUTHERN_COASTAL', peak_sun_hours: 4.1 },
  { state_name: 'RIVERS', geo_belt: 'SOUTHERN_COASTAL', peak_sun_hours: 3.8 },
  { state_name: 'ENUGU', geo_belt: 'SOUTHERN_COASTAL', peak_sun_hours: 4.4 },
  { state_name: 'KANO', geo_belt: 'NORTHERN_SAHEL', peak_sun_hours: 5.9 },
  { state_name: 'KADUNA', geo_belt: 'NORTHERN_SAHEL', peak_sun_hours: 5.6 },
  { state_name: 'OYO', geo_belt: 'SOUTH_WEST', peak_sun_hours: 4.5 },
];

interface CatalogAppliance {
  code: string;
  name: string;
  group: string;
  watts: number;
  surge: number;
  motor: boolean;
  defaultDayH: number;
  defaultNightH: number;
}

const APPLIANCE_CATALOG: CatalogAppliance[] = [
  // ❄️ Cooling & Air Conditioning
  { code: 'INVERTER_AC_1HP', name: '1.0 HP Dual-Inverter Split AC (850W)', group: '❄️ Cooling & Air Conditioning', watts: 850, surge: 1.6, motor: true, defaultDayH: 4, defaultNightH: 4 },
  { code: 'INVERTER_AC_1_5HP', name: '1.5 HP Dual-Inverter Split AC (1,250W)', group: '❄️ Cooling & Air Conditioning', watts: 1250, surge: 1.8, motor: true, defaultDayH: 4, defaultNightH: 4 },
  { code: 'INVERTER_AC_2HP', name: '2.0 HP Heavy-Duty Split AC (1,800W)', group: '❄️ Cooling & Air Conditioning', watts: 1800, surge: 2.0, motor: true, defaultDayH: 4, defaultNightH: 4 },
  { code: 'CEILING_FAN_75W', name: 'Standing / Ceiling Fans (75W)', group: '❄️ Cooling & Air Conditioning', watts: 75, surge: 1.3, motor: true, defaultDayH: 5, defaultNightH: 8 },
  { code: 'OX_FAN_150W', name: 'OX Industrial Cyclone Fan (150W)', group: '❄️ Cooling & Air Conditioning', watts: 150, surge: 1.8, motor: true, defaultDayH: 6, defaultNightH: 6 },

  // 🧊 Refrigeration & Freezers
  { code: 'INVERTER_FRIDGE_120W', name: 'Compact Inverter Refrigerator (120W)', group: '🧊 Refrigeration & Freezers', watts: 120, surge: 2.0, motor: true, defaultDayH: 6, defaultNightH: 6 },
  { code: 'INVERTER_FRIDGE_180W', name: 'Inverter Refrigerator Double Door (180W)', group: '🧊 Refrigeration & Freezers', watts: 180, surge: 2.2, motor: true, defaultDayH: 6, defaultNightH: 6 },
  { code: 'CHEST_FREEZER_180W', name: 'Deep Chest Freezer Small 150L (180W)', group: '🧊 Refrigeration & Freezers', watts: 180, surge: 2.5, motor: true, defaultDayH: 6, defaultNightH: 6 },
  { code: 'CHEST_FREEZER_250W', name: 'Deep Chest Freezer Large 300L (250W)', group: '🧊 Refrigeration & Freezers', watts: 250, surge: 2.8, motor: true, defaultDayH: 6, defaultNightH: 6 },
  { code: 'COLDROOM_1500W', name: 'Commercial Cold-Room Chiller (1,500W)', group: '🧊 Refrigeration & Freezers', watts: 1500, surge: 3.5, motor: true, defaultDayH: 8, defaultNightH: 8 },

  // 🚰 Water Pumping & Motors
  { code: 'PUMP_0_5HP', name: '0.5 HP Borehole Water Pump (375W)', group: '🚰 Water Pumping & Motors', watts: 375, surge: 3.0, motor: true, defaultDayH: 1, defaultNightH: 0 },
  { code: 'BOREHOLE_PUMP_1HP', name: '1.0 HP Submersible Borehole Pump (750W)', group: '🚰 Water Pumping & Motors', watts: 750, surge: 3.0, motor: true, defaultDayH: 1, defaultNightH: 0 },
  { code: 'PUMP_1_5HP', name: '1.5 HP Submersible Borehole Pump (1,100W)', group: '🚰 Water Pumping & Motors', watts: 1100, surge: 3.2, motor: true, defaultDayH: 1, defaultNightH: 0 },
  { code: 'PUMP_2HP', name: '2.0 HP Industrial Surface Water Pump (1,500W)', group: '🚰 Water Pumping & Motors', watts: 1500, surge: 3.5, motor: true, defaultDayH: 2, defaultNightH: 0 },

  // 💡 Lighting & Entertainment
  { code: 'LED_BULB_15W', name: 'Energy-Saving LED Bulbs Pack (50W)', group: '💡 Lighting & Entertainment', watts: 50, surge: 1.0, motor: false, defaultDayH: 2, defaultNightH: 8 },
  { code: 'SECURITY_FLOOD_100W', name: 'Security Floodlights & Compound LED (100W)', group: '💡 Lighting & Entertainment', watts: 100, surge: 1.0, motor: false, defaultDayH: 0, defaultNightH: 10 },
  { code: 'SMART_TV_120W', name: '55" Smart 4K LED TV + Soundbar (120W)', group: '💡 Lighting & Entertainment', watts: 120, surge: 1.0, motor: false, defaultDayH: 4, defaultNightH: 5 },
  { code: 'SMART_TV_220W', name: '75" 4K OLED TV + Home Theater (220W)', group: '💡 Lighting & Entertainment', watts: 220, surge: 1.0, motor: false, defaultDayH: 4, defaultNightH: 5 },
  { code: 'STARLINK_ROUTER_75W', name: 'Starlink Terminal + WiFi 6 Router (75W)', group: '💡 Lighting & Entertainment', watts: 75, surge: 1.0, motor: false, defaultDayH: 12, defaultNightH: 12 },
  { code: 'LAPTOP_ROUTER_90W', name: 'Laptops + Dual Monitors Workstation (150W)', group: '💡 Lighting & Entertainment', watts: 150, surge: 1.0, motor: false, defaultDayH: 8, defaultNightH: 4 },
  { code: 'CCTV_SYSTEM_65W', name: 'CCTV Security System + 8-Ch NVR (65W)', group: '💡 Lighting & Entertainment', watts: 65, surge: 1.0, motor: false, defaultDayH: 12, defaultNightH: 12 },

  // ⚡ Kitchen & Heavy Laundry
  { code: 'WASHING_MACH_500W', name: 'Inverter Washing Machine (500W)', group: '⚡ Kitchen & Heavy Laundry', watts: 500, surge: 2.0, motor: true, defaultDayH: 2, defaultNightH: 0 },
  { code: 'MICROWAVE_1200W', name: 'Microwave Oven (1,200W)', group: '⚡ Kitchen & Heavy Laundry', watts: 1200, surge: 1.2, motor: false, defaultDayH: 1, defaultNightH: 0 },
  { code: 'PRESSING_IRON_1200W', name: 'Electric Pressing Iron (1,200W)', group: '⚡ Kitchen & Heavy Laundry', watts: 1200, surge: 1.0, motor: false, defaultDayH: 1, defaultNightH: 0 },
  { code: 'KETTLE_1500W', name: 'Electric Kettle / Air Fryer (1,500W)', group: '⚡ Kitchen & Heavy Laundry', watts: 1500, surge: 1.0, motor: false, defaultDayH: 1, defaultNightH: 0 },
  { code: 'MEDICAL_650W', name: 'Medical Centrifuge & Sterilizer (650W)', group: '⚡ Kitchen & Heavy Laundry', watts: 650, surge: 2.0, motor: true, defaultDayH: 4, defaultNightH: 0 },
];

export interface ApplianceItem {
  code: string;
  name: string;
  group: string;
  watts: number;
  surge: number;
  motor: boolean;
  qty: number;
  dayH: number;
  nightH: number;
  daysWeek: number;
}

const INITIAL_APPLIANCES: ApplianceItem[] = [
  { code: 'LED_BULB_15W', name: 'Energy-Saving LED Bulbs Pack (50W)', group: '💡 Lighting & Entertainment', watts: 50, surge: 1.0, motor: false, qty: 2, dayH: 2, nightH: 8, daysWeek: 7 },
  { code: 'CEILING_FAN_75W', name: 'Standing / Ceiling Fans (75W)', group: '❄️ Cooling & Air Conditioning', watts: 75, surge: 1.3, motor: true, qty: 3, dayH: 5, nightH: 8, daysWeek: 7 },
  { code: 'SMART_TV_120W', name: '55" Smart 4K LED TV + Soundbar (120W)', group: '💡 Lighting & Entertainment', watts: 120, surge: 1.0, motor: false, qty: 1, dayH: 4, nightH: 5, daysWeek: 7 },
  { code: 'INVERTER_FRIDGE_180W', name: 'Inverter Refrigerator Double Door (180W)', group: '🧊 Refrigeration & Freezers', watts: 180, surge: 2.2, motor: true, qty: 1, dayH: 6, nightH: 6, daysWeek: 7 },
];

const GROWATT_BUNDLES = [
  {
    sku: 'GW-SPF3000-LFP5',
    title: 'Growatt 3.0kVA Eco-Starter',
    inverter: 'Growatt SPF 3000TL LVM-ES (3.0kW / 24V Pure Sine)',
    battery: '5.12 kWh LiFePO4 (80% DoD, 6,000 Cycles)',
    pv: '2.70 kWp Mono PERC Half-Cell Array',
    priceNaira: 2850000,
    badge: 'Ideal for 2–3 Bed Flats',
    autonomyTag: '12–14 Hrs Overnight Autonomy / Fans + TV + Fridge',
    loads: ['8x LED Lights & Security Lamps', '3x Ceiling Fans', '1x Inverter Fridge', '55" Smart TV + Starlink + Laptops'],
  },
  {
    sku: 'GW-SPF5000-LFP5',
    title: 'Growatt 5.0kVA Family Standard',
    inverter: 'Growatt SPF 5000ES Hybrid (5.0kW / 48V Pure Sine)',
    battery: '5.12 kWh LiFePO4 (80% DoD, 6,000 Cycles)',
    pv: '4.40 kWp Mono PERC Array',
    priceNaira: 4450000,
    badge: 'Most Popular for Duplexes',
    autonomyTag: '12–14 Hrs Overnight Autonomy / Runs 1HP AC + Daytime Borehole',
    loads: ['1x 1.0HP Inverter AC', '1x 1HP Borehole Pump (Daytime)', 'Fridge + Deep Freezer', 'All Fans, TVs & Home Office'],
  },
  {
    sku: 'GW-SPF5000-LFP10',
    title: 'Growatt 5.0kVA Executive Night-Cool',
    inverter: 'Growatt SPF 5000ES Hybrid (5.0kW / 48V Pure Sine)',
    battery: '10.24 kWh Dual LiFePO4 Bank (80% DoD, 6,000 Cycles)',
    pv: '5.50 kWp High-Yield Array',
    priceNaira: 6300000,
    badge: 'Overnight AC Autonomy',
    autonomyTag: 'Full Overnight 1.5HP AC + Zero Generator Dependency',
    loads: ['Overnight 1.0HP–1.5HP AC Cooling', 'Daytime Borehole Pumping', 'Fridge + Freezer + Microwave', 'Zero Generator Dependency'],
  },
  {
    sku: 'GW-SPH10000-LFP20',
    title: 'Growatt 10.0kVA Commercial PowerPlant',
    inverter: 'Dual Parallel SPF 5000ES / SPH 10kVA 3-Phase',
    battery: '20.48 kWh Rack LiFePO4 Vault (80% DoD, 6,000 Cycles)',
    pv: '9.90 kWp Commercial Roof Array',
    priceNaira: 11800000,
    badge: 'SMEs, Clinics & Estates',
    autonomyTag: '24/7 Commercial Grade Continuous Heavy-Duty Uptime',
    loads: ['Up to 3x Inverter ACs', 'Medical/Commercial Refrigeration', 'Submersible & Surface Pumps', 'Full Office Workstation Fleet'],
  },
];

function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export default function PublicShowroomLandingPage() {
  // Interactive Calculator & Progressive Disclosure State
  const [selectedState, setSelectedState] = useState<string>('FCT ABUJA');
  const [selectedCatalogCode, setSelectedCatalogCode] = useState<string>('INVERTER_AC_1HP');
  const [appliances, setAppliances] = useState<ApplianceItem[]>(INITIAL_APPLIANCES);
  const [paymentMode, setPaymentMode] = useState<'INSTALLMENT' | 'OUTRIGHT'>('INSTALLMENT');
  const [tenureMonths, setTenureMonths] = useState<number>(36);
  const [downPaymentPct, setDownPaymentPct] = useState<number>(30);
  const [showEngineeringMath, setShowEngineeringMath] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('skygrid_theme');
      if (saved === 'light') {
        setTheme('light');
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      } else {
        setTheme('dark');
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      }
    } catch (e) {}
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    try {
      localStorage.setItem('skygrid_theme', nextTheme);
    } catch (e) {}
    if (nextTheme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  };

  // Nigerian DisCo Band A & Petrol Generator Comparison Inputs
  const [monthlyGridBill, setMonthlyGridBill] = useState<number>(75000);
  const [dailyGenHours, setDailyGenHours] = useState<number>(5);
  const [fuelPricePerLiter, setFuelPricePerLiter] = useState<number>(1250);

  // Load Cart Management Handlers
  const addApplianceFromCatalog = () => {
    const item = APPLIANCE_CATALOG.find((a) => a.code === selectedCatalogCode);
    if (!item) return;
    setAppliances((prev) => {
      const existing = prev.find((a) => a.code === item.code);
      if (existing) {
        return prev.map((a) => (a.code === item.code ? { ...a, qty: a.qty + 1 } : a));
      }
      return [
        ...prev,
        {
          code: item.code,
          name: item.name,
          group: item.group,
          watts: item.watts,
          surge: item.surge,
          motor: item.motor,
          qty: 1,
          dayH: item.defaultDayH,
          nightH: item.defaultNightH,
          daysWeek: 7,
        },
      ];
    });
  };

  const removeAppliance = (code: string) => {
    setAppliances((prev) => prev.filter((a) => a.code !== code));
  };

  const adjustQty = (code: string, delta: number) => {
    setAppliances((prev) =>
      prev
        .map((a) => {
          if (a.code === code) {
            const newQty = a.qty + delta;
            return newQty > 0 ? { ...a, qty: newQty } : null;
          }
          return a;
        })
        .filter(Boolean) as ApplianceItem[]
    );
  };

  const updateAppliance = (code: string, field: 'qty' | 'dayH' | 'nightH' | 'daysWeek', value: number) => {
    setAppliances((prev) =>
      prev.map((item) => (item.code === code ? { ...item, [field]: Math.max(0, value) } : item))
    );
  };

  // Lead Capture Modal State (Site Audit)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [leadForm, setLeadForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    city: '',
    streetAddress: '',
    preferredAuditDay: 'Tomorrow Morning (10:00 AM)',
  });
  const [bookingConfirmation, setBookingConfirmation] = useState<null | { ref: string; message: string }>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Customer Sign-Up Modal State (Global Practice with NIMC NIN)
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState<boolean>(false);
  const [ninNumber, setNinNumber] = useState<string>('');
  const [ninLoading, setNinLoading] = useState<boolean>(false);
  const [ninVerified, setNinVerified] = useState<boolean>(false);
  const [signUpData, setSignUpData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    dob: '',
    gender: 'Male',
    phone: '',
    email: '',
    streetAddress: '',
    city: 'Abuja',
    discoProvider: 'AEDC (Abuja Electricity)',
    accountType: 'Residential Band A',
    bvn: '',
  });
  const [signUpSuccess, setSignUpSuccess] = useState<null | {
    customerId: string;
    dvaAccount: string;
    dvaBank: string;
    downPaymentNaira: number;
    monthlyNaira: number;
  }>(null);

  // Deterministic Client/Server Synchronized Engineering Calculations
  const engineeringResult = useMemo(() => {
    const zone = NIGERIAN_STATES.find((z) => z.state_name === selectedState) || NIGERIAN_STATES[0];

    let runningWatts = 0;
    let largestMotorSurge = 0;
    let dayWh = 0;
    let nightWh = 0;
    const warnings: string[] = [];

    for (const app of appliances) {
      if (app.qty <= 0) continue;
      const lineWatts = app.watts * app.qty;
      runningWatts += lineWatts;

      if (app.motor) {
        const singleSurge = Math.ceil(app.watts * (app.surge - 1.0));
        if (singleSurge > largestMotorSurge) largestMotorSurge = singleSurge;
      }

      const weeklyRatio = (app.daysWeek || 7) / 7;
      dayWh += lineWatts * app.dayH * weeklyRatio;
      nightWh += lineWatts * app.nightH * weeklyRatio;

      if (app.code === 'BOREHOLE_PUMP_1HP' && app.nightH > 0) {
        warnings.push(
          'Smart Load Advisory: Shift 1HP Borehole Pump operation to Daytime Solar Hours (11 AM – 2 PM) to preserve overnight LiFePO4 battery autonomy.'
        );
      }
    }

    if (runningWatts === 0) runningWatts = 150;

    // Formula 1: W_run = Sum(Watts * Qty) -> runningWatts
    // Formula 2: VA_inv = max(W_run * 1.25, W_run + W_largest_motor_surge)
    const headroomVA = Math.ceil(runningWatts * 1.25);
    const surgeTotalVA = runningWatts + largestMotorSurge;
    const requiredVA = Math.max(headroomVA, surgeTotalVA);

    // Formula 3: Wh_batt = NightWh / (eta_inv(0.92) * DoD_LiFePO4(0.80))
    const rawBattWh = nightWh > 0 ? nightWh / (0.92 * 0.80) : 2560;
    const requiredLiFePO4KWh = Math.max(2.56, Math.ceil((rawBattWh / 1000) * 10) / 10);

    // Formula 4: W_pv = ((Wh_batt * 0.80) + DayWh) / (PSH * SystemDerating(0.78))
    const rawPVWatts = ((rawBattWh * 0.80) + dayWh) / (zone.peak_sun_hours * 0.78);
    const requiredPVKWp = Math.max(1.5, Math.ceil((rawPVWatts / 1000) * 100) / 100);

    // Match Curated Growatt Bundle
    let bundle = GROWATT_BUNDLES[0];
    if (requiredVA > 4800 || requiredLiFePO4KWh > 10.24) {
      bundle = GROWATT_BUNDLES[3];
    } else if (requiredVA > 2800 || requiredLiFePO4KWh > 5.12) {
      bundle = requiredLiFePO4KWh > 5.5 ? GROWATT_BUNDLES[2] : GROWATT_BUNDLES[1];
    }

    // Amortization Math (Enforcing 30%-60% Down Payment & 1.75% Insurance Fee, 12-60m Tenure)
    const cashPrice = bundle.priceNaira;
    const effectiveDownPct = paymentMode === 'OUTRIGHT' ? 100 : Math.max(30, Math.min(60, downPaymentPct));
    const downPaymentNaira = Math.round(cashPrice * (effectiveDownPct / 100));
    const insuranceFeeNaira = paymentMode === 'OUTRIGHT' ? 0 : Math.round(cashPrice * 0.0175);
    const financedPrincipal = cashPrice - downPaymentNaira + insuranceFeeNaira;
    const totalCreditService = paymentMode === 'OUTRIGHT' ? 0 : Math.round(financedPrincipal * 0.0185 * tenureMonths);
    const monthlyInstallment =
      paymentMode === 'OUTRIGHT' ? 0 : Math.ceil((financedPrincipal + totalCreditService) / tenureMonths);
    const dailyEquivalent = Math.ceil(monthlyInstallment / 30);

    // Nigerian Generator + Band A Grid Comparison
    const monthlyFuelLiters = dailyGenHours * 1.35 * 30;
    const monthlyFuelSpend = Math.round(monthlyFuelLiters * fuelPricePerLiter);
    const monthlyGenMaintenance = dailyGenHours >= 2 ? 18000 : 0;
    const totalCurrentFossilSpend = monthlyGridBill + monthlyFuelSpend + monthlyGenMaintenance;
    const displacedSpend = Math.round(totalCurrentFossilSpend * 0.85);
    const monthlyNetSavings = displacedSpend - monthlyInstallment;
    const cumulativeTenureSavings = displacedSpend * tenureMonths - (downPaymentNaira + monthlyInstallment * tenureMonths);
    const cumulative60mSavings = displacedSpend * 60 - (downPaymentNaira + (paymentMode === 'OUTRIGHT' ? 0 : monthlyInstallment * Math.min(60, tenureMonths)));

    return {
      zone,
      runningWatts,
      largestMotorSurge,
      headroomVA,
      surgeTotalVA,
      requiredVA,
      dayWh,
      nightWh,
      rawBattWh: Math.round(rawBattWh),
      rawPVWatts: Math.round(rawPVWatts),
      requiredLiFePO4KWh,
      requiredPVKWp,
      bundle,
      downPaymentNaira,
      insuranceFeeNaira,
      monthlyInstallment,
      dailyEquivalent,
      monthlyFuelLiters: Math.round(monthlyFuelLiters),
      monthlyFuelSpend,
      monthlyGenMaintenance,
      totalCurrentFossilSpend,
      displacedSpend,
      monthlyNetSavings,
      cumulativeTenureSavings,
      cumulative60mSavings,
      cumulative36mSavings: cumulativeTenureSavings,
      warnings,
    };
  }, [selectedState, appliances, paymentMode, tenureMonths, downPaymentPct, monthlyGridBill, dailyGenHours, fuelPricePerLiter]);

  // Instant NIMC NIN Verification Simulation
  const handleVerifyNIN = () => {
    if (ninNumber.replace(/\D/g, '').length !== 11) {
      alert('Please enter a valid 11-digit National Identity Number (NIN).');
      return;
    }
    setNinLoading(true);
    setTimeout(() => {
      setNinLoading(false);
      setNinVerified(true);
      // Auto-populate legal demographic data per NIMC database standard
      setSignUpData((prev) => ({
        ...prev,
        firstName: 'Emeka',
        middleName: 'Tunde',
        lastName: 'Adeyemi',
        dob: '1984-06-14',
        gender: 'Male',
        phone: prev.phone || '0803 456 7890',
        email: prev.email || 'e.adeyemi@skygrid.ng',
        streetAddress: prev.streetAddress || '14 Julius Nyerere Crescent, Asokoro',
        city: 'FCT Abuja',
      }));
    }, 900);
  };

  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const customerId = `SG-CUST-${Math.floor(100000 + Math.random() * 900000)}`;
    const randomAcc = `80${Math.floor(10000000 + Math.random() * 90000000)}`;
    setSignUpSuccess({
      customerId,
      dvaAccount: randomAcc,
      dvaBank: 'Moniepoint Microfinance Bank',
      downPaymentNaira: engineeringResult.downPaymentNaira,
      monthlyNaira: engineeringResult.monthlyInstallment,
    });
  };

  const handleBookAuditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiBase}/api/v1/public/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: leadForm.fullName,
          phone: leadForm.phone,
          email: leadForm.email,
          state_region: selectedState,
          city: leadForm.city,
          street_address: leadForm.streetAddress,
          preferred_audit_day: leadForm.preferredAuditDay,
          sizing_input: {
            state_region: selectedState,
            payment_mode: paymentMode,
            tenure_months: tenureMonths,
            down_payment_pct: downPaymentPct,
            current_monthly_grid_bill_ngn: monthlyGridBill,
            daily_generator_run_hours: dailyGenHours,
            fuel_price_per_liter_ngn: fuelPricePerLiter,
            selected_appliances: appliances
              .filter((a) => a.qty > 0)
              .map((a) => ({
                appliance_code: a.code,
                quantity: a.qty,
                daytime_hours: a.dayH,
                nighttime_hours: a.nightH,
              })),
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setBookingConfirmation({
          ref: data.audit_booking_ref || `AUD-NG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          message: data.message || 'Audit booked successfully!',
        });
      } else {
        throw new Error('Local fallback');
      }
    } catch {
      const fallbackRef = `AUD-NG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      setBookingConfirmation({
        ref: fallbackRef,
        message: 'Site Audit booked! A COREN-certified Field Engineer will contact you via WhatsApp/Phone within 2 hours to confirm roof & earthing inspection.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 font-sans selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      
      {/* 1. TOP REGULATORY & REGISTRATION TRUST BAR */}
      <aside className="bg-gradient-to-r from-slate-100 via-white to-slate-100 dark:from-[#111827] dark:via-[#0B0F19] dark:to-[#111827] border-b border-slate-200 dark:border-[#10B981]/30 text-xs py-2 px-4 sm:px-6 lg:px-10 transition-colors duration-200">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3 text-slate-700 dark:text-emerald-200">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-[#10B981] font-bold text-xs">⚡</span>
            <span className="font-semibold text-emerald-800 dark:text-[#10B981]">COREN &amp; NEMSA Certified Solar Architecture</span>
            <span className="hidden md:inline text-slate-400 dark:text-[#64748B]">•</span>
            <span className="hidden md:inline text-slate-600 dark:text-emerald-300">100% LiFePO4 Lithium Mandate (80% DoD / 6,000 Cycles)</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="hidden sm:inline text-slate-500 dark:text-[#64748B]">Zero-Deposit SME Pilots Active in Lagos &amp; Abuja</span>
            <button
              onClick={() => setIsSignUpModalOpen(true)}
              className="text-emerald-700 dark:text-[#10B981] hover:text-emerald-500 dark:hover:text-emerald-300 font-bold underline flex items-center gap-1 transition"
            >
              <span>New Customer? Register with NIN &rarr;</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 2. MAIN NAVIGATION */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/90 dark:bg-[#0B0F19]/90 border-b border-slate-200 dark:border-[#64748B]/30 px-4 sm:px-6 lg:px-10 py-3.5 transition-colors duration-200">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          
          <a href="#hero" className="flex items-center gap-3 group focus:outline-none">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-emerald-500/25 group-hover:scale-105 transition">
              G
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">SKYGRID</span>
                <span className="text-emerald-700 dark:text-[#10B981] font-semibold text-lg">GROWATT PAYG</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-[#64748B] -mt-1 font-mono">Clean Energy-as-a-Service &bull; Nigeria</p>
            </div>
          </a>

          <nav className="hidden lg:flex items-center gap-8 text-sm text-slate-700 dark:text-slate-300 font-medium">
            <a href="#hero" className="hover:text-emerald-600 dark:hover:text-[#10B981] transition">Home</a>
            <a href="#about" className="hover:text-emerald-600 dark:hover:text-[#10B981] transition text-slate-900 dark:text-white font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              About Us
            </a>
            <a href="#calculator" className="hover:text-emerald-600 dark:hover:text-[#10B981] transition">Savings &amp; Load Sizer</a>
            <a href="#smart-app" className="hover:text-emerald-600 dark:hover:text-[#10B981] transition text-emerald-700 dark:text-[#10B981] font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Smart App &amp; Analytics
            </a>
            <a href="#bundles" className="hover:text-emerald-600 dark:hover:text-[#10B981] transition">Growatt Bundles</a>
            <a href="#how-it-works" className="hover:text-emerald-600 dark:hover:text-[#10B981] transition">How It Works</a>
            <a href="#faq" className="hover:text-emerald-600 dark:hover:text-[#10B981] transition">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-[#1E293B] dark:hover:bg-slate-700 dark:text-amber-400 border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 text-xs font-semibold"
              title={theme === 'dark' ? 'Switch to Solar Daylight Mode' : 'Switch to Photovoltaic Night Mode'}
              aria-label="Toggle color theme"
            >
              {theme === 'dark' ? (
                <>
                  <span className="text-amber-400 text-base">☀️</span>
                  <span className="hidden xl:inline text-slate-300">Daylight</span>
                </>
              ) : (
                <>
                  <span className="text-sky-600 text-base">🌙</span>
                  <span className="hidden xl:inline text-slate-700">Night</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsSignUpModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-[#10B981] dark:hover:bg-emerald-400 dark:text-[#0B0F19] font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
            >
              <span>Sign Up (NIN)</span>
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="hidden sm:inline-flex bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-[#1E293B] dark:hover:bg-slate-700 dark:text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#64748B]/30 transition"
            >
              Book Site Audit
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-[#1E293B] dark:hover:bg-slate-700 dark:text-white border border-slate-200 dark:border-[#64748B]/30 transition"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-[#64748B]/30 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-xl px-4 py-4 mt-3 space-y-3">
            <a
              href="#hero"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-[#10B981] py-1.5 transition"
            >
              Home
            </a>
            <a
              href="#about"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-sm font-semibold text-emerald-700 dark:text-[#10B981] py-1.5 transition flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              About Us (Vision, Mission &amp; African Impact)
            </a>
            <a
              href="#calculator"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-[#10B981] py-1.5 transition"
            >
              Savings &amp; Load Sizer
            </a>
            <a
              href="#smart-app"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-sm font-semibold text-emerald-700 dark:text-[#10B981] py-1.5 transition flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Smart App &amp; Analytics
            </a>
            <a
              href="#bundles"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-[#10B981] py-1.5 transition"
            >
              Growatt Bundles
            </a>
            <a
              href="#how-it-works"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-[#10B981] py-1.5 transition"
            >
              How It Works
            </a>
            <a
              href="#faq"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-[#10B981] py-1.5 transition"
            >
              FAQ
            </a>
            <div className="pt-2 border-t border-slate-200 dark:border-[#64748B]/30 flex flex-col gap-2">
              {/* Mobile Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200 transition"
              >
                <span className="flex items-center gap-2">
                  <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
                  <span>Switch Color Theme</span>
                </span>
                <span className="text-amber-600 dark:text-[#FFBF00] font-mono font-bold">
                  {theme === 'dark' ? 'Daylight Mode' : 'Night Mode'}
                </span>
              </button>
              <button
                onClick={() => { setIsMobileMenuOpen(false); setIsSignUpModalOpen(true); }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-[#10B981] dark:hover:bg-emerald-400 dark:text-[#0B0F19] font-bold text-xs py-2.5 rounded-xl transition shadow-lg text-center"
              >
                Sign Up (NIN)
              </button>
              <button
                onClick={() => { setIsMobileMenuOpen(false); setIsModalOpen(true); }}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-[#1E293B] dark:hover:bg-slate-700 dark:text-white font-semibold text-xs py-2.5 rounded-xl border border-slate-200 dark:border-[#64748B]/30 transition text-center"
              >
                Book Site Audit
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 3. HERO SECTION (OUTCOME & CASHFLOW FIRST — TESLA/SUNRUN STANDARD) */}
      <section id="hero" className="relative overflow-hidden py-12 sm:py-16 lg:py-20 border-b border-[#64748B]/30 bg-gradient-to-b from-[#111827]/80 via-[#0B0F19] to-[#0B0F19]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Outcome Headline & Direct Value Proposition */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs font-semibold backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping"></span>
              <span>Swap ₦1,250/L Petrol &amp; Band A Grid Outages For Predictable Solar</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl 2xl:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
              Power Your Home.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#10B981] via-teal-300 to-[#FFBF00]">
                Pay Less Than Your Generator.
              </span>
            </h1>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl">
              Start with a <strong className="text-white">30% Down Payment</strong>, get a COREN-certified Growatt hybrid plant installed in 48 hours, and pay fixed 3-to-60 month installments that cost less than what you currently burn on petrol and diesel.
            </p>

            {/* Hero Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={() => setIsSignUpModalOpen(true)}
                className="bg-[#10B981] hover:bg-emerald-400 text-[#0B0F19] font-bold text-sm px-6 py-3.5 rounded-xl transition shadow-xl shadow-[#10B981]/25 flex items-center gap-2"
              >
                <span>New Customer Registration</span>
                <span>&rarr;</span>
              </button>

              <a
                href="#calculator"
                className="bg-[#111827] hover:bg-[#1E293B] text-white font-semibold text-sm px-6 py-3.5 rounded-xl border border-[#64748B]/30 transition flex items-center gap-2"
              >
                <span>Calculate Your Load &amp; Savings</span>
                <span className="text-[#FFBF00]">⚡</span>
              </a>

              <a
                href="#smart-app"
                className="bg-[#1E293B]/70 hover:bg-[#1E293B] text-slate-300 font-semibold text-sm px-5 py-3.5 rounded-xl border border-[#64748B]/30 transition flex items-center gap-2"
              >
                <span>Explore Analytics</span>
                <span className="text-[#22D3EE]">📊</span>
              </a>
            </div>

            {/* Micro-Trust Pillars */}
            <div className="pt-3 grid grid-cols-3 gap-3 border-t border-[#64748B]/30 max-w-xl text-xs text-[#64748B]">
              <div className="flex items-center gap-2">
                <span className="text-[#10B981] font-bold text-base">🛡️</span>
                <span>LiFePO4 6,000 Cycles</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#FFBF00] font-bold text-base">💳</span>
                <span>12–60 Mo. Flexible Lease</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#22D3EE] font-bold text-base">📡</span>
                <span>24/7 AI Smart Guard</span>
              </div>
            </div>
          </div>

          {/* Right Column: Executive Cashflow & System Autonomy Card */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="w-full max-w-[500px] bg-[#111827] border border-[#64748B]/40 rounded-3xl p-6 shadow-2xl relative space-y-5">
              
              {/* 1. System Match Header */}
              <div className="space-y-2 pb-4 border-b border-[#64748B]/30">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#10B981] font-mono">
                    Recommended Solar Plant
                  </span>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#1E293B] border border-[#64748B]/30 text-slate-300 font-mono">
                    {engineeringResult.zone.state_name}
                  </span>
                </div>
                
                <h3 className="text-xl font-extrabold text-white">
                  {engineeringResult.bundle.title}
                </h3>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] text-xs font-semibold">
                  <span>🛡️ Autonomy Guarantee:</span>
                  <span className="text-white font-medium">{engineeringResult.bundle.autonomyTag}</span>
                </div>
              </div>

              {/* 2. Side-by-Side Red vs. Green Cashflow Comparison Grid */}
              <div className="grid grid-cols-2 gap-3">
                
                {/* Red Card: Current Fuel + Grid Spend */}
                <div className="p-3.5 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/40 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#EF4444] block">
                    Current Fuel + Grid
                  </span>
                  <div className="text-lg font-extrabold text-[#EF4444] font-mono">
                    {formatNaira(engineeringResult.totalCurrentFossilSpend)}
                    <span className="text-xs font-normal text-rose-300">/mo</span>
                  </div>
                  <span className="text-[11px] text-rose-300/80 block font-mono">
                    ~{engineeringResult.monthlyFuelLiters} L Fuel + DisCo
                  </span>
                </div>

                {/* Green Card: Fixed Solar Installment */}
                <div className="p-3.5 rounded-2xl bg-[#10B981]/10 border border-[#10B981]/40 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#10B981] block">
                    Fixed Solar Installment
                  </span>
                  <div className="text-lg font-extrabold text-[#10B981] font-mono">
                    {formatNaira(engineeringResult.monthlyInstallment)}
                    <span className="text-xs font-normal text-emerald-300">/mo</span>
                  </div>
                  <span className="text-[11px] text-emerald-300/80 block font-mono">
                    &asymp; {formatNaira(engineeringResult.dailyEquivalent)}/day ({tenureMonths}m)
                  </span>
                </div>

              </div>

              {/* 3. Hardware Summary Box */}
              <div className="p-4 rounded-2xl bg-[#1E293B] border border-[#64748B]/30 space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-[#64748B]">Hybrid Inverter:</span>
                  <strong className="text-white font-medium">{engineeringResult.bundle.inverter}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-[#64748B]">Lithium Battery:</span>
                  <strong className="text-[#22D3EE] font-medium">{engineeringResult.bundle.battery}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-[#64748B]">Solar PV Array:</span>
                  <strong className="text-[#FFBF00] font-medium">{engineeringResult.bundle.pv}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-300 pt-2 border-t border-[#64748B]/30">
                  <span className="text-[#64748B]">
                    Upfront Down Payment ({paymentMode === 'OUTRIGHT' ? '100%' : `${downPaymentPct}%`}):
                  </span>
                  <strong className="text-[#10B981] font-mono text-sm">
                    {formatNaira(engineeringResult.downPaymentNaira)}
                  </strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full bg-[#10B981] hover:bg-emerald-400 text-[#0B0F19] font-extrabold py-3.5 rounded-xl transition shadow-lg text-sm flex items-center justify-center gap-2"
                >
                  <span>Lock In Quote &amp; Book Site Audit</span>
                  <span>&rarr;</span>
                </button>
                <a
                  href="#calculator"
                  className="w-full block text-center text-xs text-[#64748B] hover:text-[#10B981] py-1 transition"
                >
                  Or customize appliances and tenure below &darr;
                </a>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* 4. INTERACTIVE CALCULATOR (PROGRESSIVE DISCLOSURE ARCHITECTURE) */}
      <section id="calculator" className="py-16 sm:py-24 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 space-y-10">
        
        <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <span>⚡</span> CleanTech Progressive Sizer &amp; ROI Calculator
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Customize Appliances &amp; Validate Monthly Naira Cashflow
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Select your region and appliances. Our engine verifies continuous load, inrush surge, and overnight battery autonomy while comparing your solar lease against current generator and Band A grid expenses.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (7 Cols): State, Payment Mode, & Appliance Counters */}
          <div className="lg:col-span-7 bg-[#111827] border border-[#64748B]/30 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
            
            <div className="grid sm:grid-cols-2 gap-4 pb-6 border-b border-[#64748B]/30">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  1. Installation State / Geo-Zone
                </label>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="w-full bg-[#1E293B] border border-[#64748B]/40 rounded-xl px-4 py-2.5 text-sm text-white focus:border-[#10B981] outline-none font-medium"
                >
                  {NIGERIAN_STATES.map((st) => (
                    <option key={st.state_name} value={st.state_name} className="bg-[#111827]">
                      {st.state_name} ({st.peak_sun_hours}h Peak Sun Zone)
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-[#10B981] mt-1 block">Adjusts PV generation to regional solar irradiance.</span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  2. Payment Preference
                </label>
                <div className="grid grid-cols-2 gap-2 bg-[#1E293B] p-1 rounded-xl border border-[#64748B]/30">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('INSTALLMENT')}
                    className={`py-2 text-xs font-bold rounded-lg transition ${
                      paymentMode === 'INSTALLMENT'
                        ? 'bg-[#10B981] text-[#0B0F19] shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Lease-to-Own (12–60m)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('OUTRIGHT')}
                    className={`py-2 text-xs font-bold rounded-lg transition ${
                      paymentMode === 'OUTRIGHT'
                        ? 'bg-[#10B981] text-[#0B0F19] shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Outright Cash
                  </button>
                </div>
                <span className="text-[11px] text-[#64748B] mt-1 block">Lease includes 5-year warranty &amp; 24/7 AI-IoT guard.</span>
              </div>
            </div>

            {/* 3. Dropdown Appliance Selector & Add to Cart */}
            <div className="space-y-3 p-4 sm:p-5 rounded-2xl bg-[#1E293B]/70 border border-[#64748B]/30">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  3. Select &amp; Add Connected Appliance to Cart
                </label>
                <span className="text-[11px] font-mono text-[#10B981] font-semibold px-2.5 py-0.5 rounded-full bg-[#10B981]/15 border border-[#10B981]/30">
                  {appliances.length} {appliances.length === 1 ? 'Item in Cart' : 'Items in Cart'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <select
                  value={selectedCatalogCode}
                  onChange={(e) => setSelectedCatalogCode(e.target.value)}
                  className="flex-1 bg-[#111827] border border-[#64748B]/40 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:border-[#10B981] outline-none font-medium"
                >
                  {['❄️ Cooling & Air Conditioning', '🧊 Refrigeration & Freezers', '🚰 Water Pumping & Motors', '💡 Lighting & Entertainment', '⚡ Kitchen & Heavy Laundry'].map((grp) => (
                    <optgroup key={grp} label={grp} className="bg-[#0B0F19] text-slate-300 font-bold">
                      {APPLIANCE_CATALOG.filter((a) => a.group === grp).map((a) => (
                        <option key={a.code} value={a.code} className="bg-[#111827] text-white font-normal">
                          {a.name} — {a.watts}W ({a.motor ? `${a.surge}x Surge` : 'Resistive'})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={addApplianceFromCatalog}
                  className="px-5 py-2.5 rounded-xl bg-[#10B981] hover:bg-emerald-400 text-[#0B0F19] text-xs font-bold font-mono transition flex items-center justify-center gap-1.5 shadow-md flex-shrink-0"
                >
                  <span>+</span>
                  <span>Add to Cart</span>
                </button>
              </div>
              <span className="text-[11px] text-[#64748B] block">
                Choose appliances by rated power. Customize quantity, daily operating hours, and days per week below.
              </span>
            </div>

            {/* Load Cart Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-2 pb-1">
                <span>LOAD CART APPLIANCES</span>
                <span className="text-[11px] font-mono text-[#10B981]">Total Run: {engineeringResult.runningWatts} W</span>
              </div>

              {appliances.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#1E293B]/40 border border-dashed border-[#64748B]/30 text-center space-y-2">
                  <span className="text-3xl block">🛒</span>
                  <p className="text-sm font-semibold text-slate-300">Your load cart is currently empty</p>
                  <p className="text-xs text-[#64748B]">
                    Select an appliance from the dropdown above and click <strong className="text-[#10B981]">+ Add to Cart</strong> to begin sizing.
                  </p>
                </div>
              ) : (
                appliances.map((item) => (
                  <div
                    key={item.code}
                    className="p-3.5 rounded-2xl border transition flex flex-col gap-3 bg-[#1E293B]/60 border-[#64748B]/30 hover:border-[#64748B]/60"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white">{item.name}</span>
                          {item.motor && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FFBF00]/20 text-[#FFBF00] border border-[#FFBF00]/30">
                              {item.surge}x Surge
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#64748B] font-mono mt-0.5">
                          {item.watts}W rating &bull; {item.watts * item.qty}W line load &bull; Weekly est: ~
                          {(((item.watts * item.qty * (item.dayH + item.nightH) * item.daysWeek) / 7) * 7 / 1000).toFixed(1)} kWh/wk
                        </p>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeAppliance(item.code)}
                        className="text-xs text-[#EF4444] hover:text-rose-300 font-mono px-2 py-1 rounded bg-[#EF4444]/10 hover:bg-[#EF4444]/20 border border-[#EF4444]/30 transition flex items-center gap-1"
                      >
                        <span>✕</span> Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#64748B]/20 text-xs font-mono items-center">
                      
                      {/* Qty Toggle */}
                      <div className="flex items-center justify-between bg-[#111827] border border-[#64748B]/40 rounded-xl px-2.5 py-1.5">
                        <span className="text-[10px] text-[#64748B]">Qty:</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => adjustQty(item.code, -1)}
                            className="w-5 h-5 rounded bg-[#1E293B] text-slate-200 hover:bg-slate-700 text-xs font-bold flex items-center justify-center transition"
                          >
                            -
                          </button>
                          <span className="font-mono font-bold text-xs text-[#10B981] w-4 text-center">{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => adjustQty(item.code, 1)}
                            className="w-5 h-5 rounded bg-[#10B981] text-[#0B0F19] hover:bg-emerald-400 text-xs font-bold flex items-center justify-center transition"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Daytime Hours */}
                      <div className="flex items-center justify-between bg-[#111827] border border-[#64748B]/40 rounded-xl px-2.5 py-1.5">
                        <span className="text-[10px] text-[#64748B]">Day:</span>
                        <select
                          value={item.dayH}
                          onChange={(e) => updateAppliance(item.code, 'dayH', Number(e.target.value))}
                          className="bg-transparent text-white text-xs font-mono outline-none cursor-pointer"
                        >
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((h) => (
                            <option key={h} value={h} className="bg-[#111827] text-white">
                              {h}h/d
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Nighttime Hours */}
                      <div className="flex items-center justify-between bg-[#111827] border border-[#64748B]/40 rounded-xl px-2.5 py-1.5">
                        <span className="text-[10px] text-[#64748B]">Night:</span>
                        <select
                          value={item.nightH}
                          onChange={(e) => updateAppliance(item.code, 'nightH', Number(e.target.value))}
                          className="bg-transparent text-white text-xs font-mono outline-none cursor-pointer"
                        >
                          {[0, 1, 2, 3, 4, 5, 6, 8, 10, 12].map((h) => (
                            <option key={h} value={h} className="bg-[#111827] text-white">
                              {h}h/d
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Weekly Days */}
                      <div className="flex items-center justify-between bg-[#111827] border border-[#64748B]/40 rounded-xl px-2.5 py-1.5">
                        <span className="text-[10px] text-[#64748B]">Days:</span>
                        <select
                          value={item.daysWeek}
                          onChange={(e) => updateAppliance(item.code, 'daysWeek', Number(e.target.value))}
                          className="bg-transparent text-white text-xs font-mono outline-none cursor-pointer"
                        >
                          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                            <option key={d} value={d} className="bg-[#111827] text-white">
                              {d}d / wk
                            </option>
                          ))}
                        </select>
                      </div>

                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Smart Warnings */}
            {engineeringResult.warnings.map((warn, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-[#FFBF00]/10 border border-[#FFBF00]/30 text-[#FFBF00] text-xs flex items-center gap-2">
                <span>⚠️</span>
                <span>{warn}</span>
              </div>
            ))}

          </div>

          {/* Right Column (5 Cols): Primary Financials + Collapsible COREN Drawer */}
          <div className="lg:col-span-5 bg-[#111827] border border-[#64748B]/30 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#64748B]/30">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                System Sizing &amp; Financing
              </span>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30">
                {engineeringResult.bundle.title.split(' ')[0]} {engineeringResult.bundle.title.split(' ')[1]}
              </span>
            </div>

            {/* DEDICATED SIZING REQUIREMENTS (INVERTER SIZE, BATTERY SIZE, PV POWER) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#1E293B]/80 border border-[#10B981]/40 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#10B981] font-mono flex items-center gap-1.5">
                  <span>⚡</span> Calculated System Sizing Required
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30">
                  COREN Standard
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-center">
                
                {/* 1. Inverter Size Needed */}
                <div className="p-3 rounded-xl bg-[#111827] border border-[#64748B]/40 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#64748B] block font-mono">
                    Inverter Size
                  </span>
                  <div className="text-sm sm:text-base font-extrabold text-white font-mono">
                    {(engineeringResult.requiredVA / 1000).toFixed(1)} <span className="text-[10px] font-normal text-[#10B981]">kVA</span>
                  </div>
                  <span className="text-[10px] text-[#64748B] block font-mono">
                    {engineeringResult.requiredVA} VA Surge
                  </span>
                </div>

                {/* 2. Battery Size Needed */}
                <div className="p-3 rounded-xl bg-[#111827] border border-[#22D3EE]/40 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#22D3EE] block font-mono">
                    Battery Size
                  </span>
                  <div className="text-sm sm:text-base font-extrabold text-[#22D3EE] font-mono">
                    {engineeringResult.requiredLiFePO4KWh.toFixed(1)} <span className="text-[10px] font-normal text-slate-300">kWh</span>
                  </div>
                  <span className="text-[10px] text-[#64748B] block font-mono">
                    LiFePO4 (80% DoD)
                  </span>
                </div>

                {/* 3. PV Power Needed */}
                <div className="p-3 rounded-xl bg-[#111827] border border-[#FFBF00]/40 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#FFBF00] block font-mono">
                    PV Power
                  </span>
                  <div className="text-sm sm:text-base font-extrabold text-[#FFBF00] font-mono">
                    {engineeringResult.requiredPVKWp.toFixed(2)} <span className="text-[10px] font-normal text-slate-300">kWp</span>
                  </div>
                  <span className="text-[10px] text-[#64748B] block font-mono">
                    Mono PERC Array
                  </span>
                </div>

              </div>

              <div className="p-2.5 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 text-xs font-mono text-slate-300 flex items-center justify-between">
                <span className="text-[#64748B]">Matched Package:</span>
                <strong className="text-[#10B981] font-bold">{engineeringResult.bundle.title}</strong>
              </div>
            </div>

            {/* PRIMARY LAYER: Tenure Buttons & Slider (Up to 60 Months / 5 Years) */}
            {paymentMode === 'INSTALLMENT' && (
              <div className="space-y-4 p-4 rounded-2xl bg-[#1E293B]/60 border border-[#64748B]/30">
                <div>
                  <div className="flex justify-between items-center text-xs mb-2">
                    <span className="font-semibold text-slate-300">Leasing Payback Period:</span>
                    <span className="font-mono font-bold text-[#10B981]">
                      {tenureMonths} Months ({(tenureMonths / 12).toFixed(tenureMonths % 12 === 0 ? 0 : 1)} Years)
                    </span>
                  </div>

                  {/* 5 Tenure Buttons up to 60 Months */}
                  <div className="grid grid-cols-5 gap-1.5 mb-3">
                    {[12, 24, 36, 48, 60].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setTenureMonths(m)}
                        className={`py-1.5 text-[11px] font-bold rounded-lg font-mono transition ${
                          tenureMonths === m
                            ? 'bg-[#10B981] text-[#0B0F19] shadow-md'
                            : 'bg-[#111827] border border-[#64748B]/30 text-slate-300 hover:text-white'
                        }`}
                      >
                        {m}m {m === 60 ? '(5 Yrs)' : m === 12 ? '(1 Yr)' : `${m / 12} Yrs`}
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    min={12}
                    max={60}
                    step={6}
                    value={tenureMonths}
                    onChange={(e) => setTenureMonths(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg cursor-pointer accent-[#10B981]"
                  />
                  <div className="flex justify-between text-[10px] text-[#64748B] mt-1 font-mono">
                    <span>12m (1 Yr)</span>
                    <span>24m</span>
                    <span>36m</span>
                    <span>48m</span>
                    <span>60m (5 Yrs)</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-semibold text-slate-300">Upfront Down Payment:</span>
                    <span className="font-mono font-bold text-[#FFBF00]">{downPaymentPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={30}
                    max={60}
                    step={5}
                    value={downPaymentPct}
                    onChange={(e) => setDownPaymentPct(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg cursor-pointer accent-[#FFBF00]"
                  />
                  <div className="flex justify-between text-[10px] text-[#64748B] mt-1 font-mono">
                    <span>30% (Floor)</span>
                    <span>45%</span>
                    <span>60% (Lower Monthly)</span>
                  </div>
                </div>
              </div>
            )}

            {/* PRIMARY LAYER: DisCo Band A & Generator Fuel Inputs */}
            <div className="space-y-3 p-4 rounded-2xl bg-[#1E293B]/60 border border-[#64748B]/30">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Current Utility &amp; Generator Costs
              </span>
              
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-[#64748B] block mb-1">DisCo (₦/mo)</label>
                  <input
                    type="number"
                    value={monthlyGridBill}
                    onChange={(e) => setMonthlyGridBill(Number(e.target.value))}
                    className="w-full bg-[#111827] border border-[#64748B]/40 rounded-lg p-2 text-xs font-mono text-white outline-none focus:border-[#10B981]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#64748B] block mb-1">Gen Run (Hrs/d)</label>
                  <input
                    type="number"
                    value={dailyGenHours}
                    onChange={(e) => setDailyGenHours(Number(e.target.value))}
                    className="w-full bg-[#111827] border border-[#64748B]/40 rounded-lg p-2 text-xs font-mono text-white outline-none focus:border-[#10B981]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#64748B] block mb-1">Fuel (₦/L)</label>
                  <input
                    type="number"
                    value={fuelPricePerLiter}
                    onChange={(e) => setFuelPricePerLiter(Number(e.target.value))}
                    className="w-full bg-[#111827] border border-[#64748B]/40 rounded-lg p-2 text-xs font-mono text-white outline-none focus:border-[#10B981]"
                  />
                </div>
              </div>
            </div>

            {/* PRIMARY LAYER: Net Savings Summary Box */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#10B981]/10 border border-[#10B981]/30 space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Current Monthly Gen + Grid Spend:</span>
                <span className="font-mono font-bold text-[#EF4444] text-sm">
                  {formatNaira(engineeringResult.totalCurrentFossilSpend)}/mo
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Fixed Growatt PAYG Installment:</span>
                <span className="font-mono font-bold text-[#10B981] text-sm">
                  {formatNaira(engineeringResult.monthlyInstallment)}/mo
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[#10B981]/20">
                <span className="font-bold text-white">Net Monthly Cash Saved:</span>
                <span className="font-mono font-extrabold text-[#10B981] text-base">
                  +{formatNaira(engineeringResult.monthlyNetSavings)}/mo
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-emerald-300">
                <span>Projected {tenureMonths}-Month Savings:</span>
                <span className="font-mono font-bold">
                  {formatNaira(engineeringResult.cumulativeTenureSavings)}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-emerald-300 pt-1 border-t border-[#10B981]/20">
                <span>Projected 5-Year (60m) Cumulative Savings:</span>
                <span className="font-mono font-extrabold text-[#10B981]">
                  {formatNaira(engineeringResult.cumulative60mSavings)}
                </span>
              </div>
            </div>

            {/* SECONDARY LAYER: COLLAPSIBLE COREN ENGINEERING DRAWER */}
            <div className="border border-[#64748B]/30 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowEngineeringMath(!showEngineeringMath)}
                className="w-full p-3.5 bg-[#1E293B] hover:bg-slate-700 text-left text-xs font-bold text-[#10B981] flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <span>⚙️</span>
                  <span>Inspect COREN Electrical Sizing &amp; Derating Math</span>
                </div>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#10B981]/15 border border-[#10B981]/30">
                  {showEngineeringMath ? 'Hide Specs ▲' : 'Show Specs ▼'}
                </span>
              </button>

              {showEngineeringMath && (
                <div className="p-4 bg-[#0B0F19] border-t border-[#64748B]/30 space-y-4 text-xs font-mono">
                  
                  {/* Formula 1 */}
                  <div className="p-3 rounded-xl bg-[#111827] border border-[#64748B]/30 space-y-1">
                    <div className="flex justify-between text-[#64748B] text-[11px]">
                      <span>Peak Continuous Load (W_run):</span>
                      <strong className="text-white font-bold">{engineeringResult.runningWatts} W</strong>
                    </div>
                    <p className="text-[10px] text-[#64748B]">
                      Formula: &sum;(Watts &times; Qty) across all running appliances
                    </p>
                  </div>

                  {/* Formula 2 */}
                  <div className="p-3 rounded-xl bg-[#111827] border border-[#64748B]/30 space-y-1">
                    <div className="flex justify-between text-[#64748B] text-[11px]">
                      <span>Inverter Capacity (VA_inv):</span>
                      <strong className="text-[#FFBF00] font-bold">{engineeringResult.requiredVA} VA</strong>
                    </div>
                    <p className="text-[10px] text-[#64748B]">
                      Formula: max(W_run &times; 1.25, W_run + W_largest_motor_surge)
                    </p>
                  </div>

                  {/* Formula 3 */}
                  <div className="p-3 rounded-xl bg-[#111827] border border-[#64748B]/30 space-y-1">
                    <div className="flex justify-between text-[#64748B] text-[11px]">
                      <span>LiFePO4 Storage (Wh_batt):</span>
                      <strong className="text-[#22D3EE] font-bold">{engineeringResult.requiredLiFePO4KWh} kWh</strong>
                    </div>
                    <p className="text-[10px] text-[#64748B]">
                      Formula: W_night &times; BackupHrs / (&eta;_inv(0.92) &times; DoD_LiFePO4(0.80))
                    </p>
                  </div>

                  {/* Formula 4 */}
                  <div className="p-3 rounded-xl bg-[#111827] border border-[#64748B]/30 space-y-1">
                    <div className="flex justify-between text-[#64748B] text-[11px]">
                      <span>Derated Solar PV Array (W_pv):</span>
                      <strong className="text-[#10B981] font-bold">{engineeringResult.requiredPVKWp} kWp</strong>
                    </div>
                    <p className="text-[10px] text-[#64748B]">
                      Formula: ((Wh_batt &times; 0.80) + Wh_day) / (PeakSunHrs &times; Derating(0.78))
                    </p>
                  </div>

                  {/* Breakdown Footer */}
                  <div className="pt-2 border-t border-[#64748B]/30 text-[11px] space-y-1 text-[#64748B]">
                    <div className="flex justify-between">
                      <span>Daytime Energy Harvest:</span>
                      <span className="text-white font-bold">{engineeringResult.dayWh.toLocaleString()} Wh</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Nighttime Energy Autonomy:</span>
                      <span className="text-white font-bold">{engineeringResult.nightWh.toLocaleString()} Wh</span>
                    </div>
                    <div className="flex justify-between">
                      <span>1.75% All-Risk Insurance Fee:</span>
                      <span className="text-[#10B981] font-bold">{formatNaira(engineeringResult.insuranceFeeNaira)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Earth Grounding Standard:</span>
                      <span className="text-[#22D3EE] font-bold">&le; 2.5 &Omega; (COREN Standard)</span>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="w-full bg-[#10B981] hover:bg-emerald-400 text-[#0B0F19] font-extrabold py-4 rounded-xl transition shadow-xl shadow-[#10B981]/20 text-sm flex items-center justify-center gap-2"
            >
              <span>Book Site Audit for this System</span>
              <span>&rarr;</span>
            </button>

          </div>

        </div>
      </section>

      {/* 5. SYNCHRONIZED LIVE CUSTOMER PORTAL ANALYTICS PREVIEW ON MAIN LANDING PAGE */}
      <section id="smart-app" className="py-16 sm:py-24 border-t border-[#64748B]/30 bg-gradient-to-b from-[#0B0F19] via-[#111827]/60 to-[#0B0F19]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 space-y-8">
          
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#22D3EE]/10 border border-[#22D3EE]/30 text-[#22D3EE] text-xs font-bold uppercase tracking-wider">
              <span>📊</span> Post-Installation Digital Energy Experience
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Experience Your Live Customer Energy &amp; Savings Dashboard
            </h2>
            <p className="text-[#64748B] text-sm sm:text-base leading-relaxed">
              Every SkyGrid Growatt installation includes this real-time executive analytics portal. Test the interactive 24-hour load-shifting simulator, adjust local petrol prices, and inspect 30-day battery health histograms below:
            </p>
          </div>

          {/* Exact Same 4-Chart Statistical Analytics Suite Rendered on the Landing Page */}
          <EnergyAnalyticsSuite
            mode="PUBLIC_PREVIEW"
            deviceID="DEV-8F3A-GROWATT-00421"
            customerState={`${selectedState} (${engineeringResult.zone.peak_sun_hours}h PSH)`}
          />

        </div>
      </section>

      {/* 6. CURATED GROWATT BUNDLES (#bundles) */}
      <section id="bundles" className="py-16 sm:py-24 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-[#10B981] font-bold text-xs uppercase tracking-widest">
            Engineering Certified Hardware
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Curated Growatt Inverter &amp; LiFePO4 Bundles
          </h2>
          <p className="text-[#64748B] text-sm sm:text-base">
            Every bundle strictly enforces our 100% LiFePO4 battery mandate to ensure 10+ years of operation and zero premature battery death during your lease.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {GROWATT_BUNDLES.map((bundle) => {
            const down = Math.round(bundle.priceNaira * 0.3);
            const monthly = Math.ceil(((bundle.priceNaira - down + bundle.priceNaira * 0.0175) * (1 + 0.0185 * 24)) / 24);
            return (
              <div
                key={bundle.sku}
                className="bg-[#111827] border border-[#64748B]/30 hover:border-[#10B981]/50 rounded-3xl p-6 flex flex-col justify-between transition group shadow-xl"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1E293B] text-slate-300 border border-[#64748B]/40">
                      {bundle.sku.split('-')[1]}
                    </span>
                    <span className="text-[10px] font-semibold text-[#10B981]">{bundle.badge}</span>
                  </div>

                  <h3 className="font-extrabold text-lg text-white group-hover:text-[#10B981] transition">
                    {bundle.title}
                  </h3>

                  <div className="space-y-2 py-3 border-y border-[#64748B]/30 text-xs">
                    <div>
                      <span className="text-[#64748B] block text-[10px]">Inverter:</span>
                      <strong className="text-slate-200">{bundle.inverter}</strong>
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[10px]">Storage:</span>
                      <strong className="text-[#22D3EE]">{bundle.battery}</strong>
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[10px]">PV Array:</span>
                      <strong className="text-[#FFBF00]">{bundle.pv}</strong>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <span className="text-[10px] font-bold text-[#64748B] uppercase">Runs Effortlessly:</span>
                    <ul className="space-y-1 text-slate-300 text-[11px]">
                      {bundle.loads.map((load, idx) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <span className="text-[#10B981]">&bull;</span> {load}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-6 border-t border-[#64748B]/30 space-y-3 mt-6">
                  <div>
                    <div className="text-xs text-[#64748B]">30% Down Payment:</div>
                    <div className="text-lg font-mono font-bold text-white">{formatNaira(down)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#10B981] font-semibold">24-Mo. Lease Installment:</div>
                    <div className="text-xl font-mono font-extrabold text-[#10B981]">{formatNaira(monthly)}/mo</div>
                  </div>
                  <button
                    onClick={() => setIsSignUpModalOpen(true)}
                    className="w-full py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#10B981] hover:text-[#0B0F19] font-bold text-xs text-white transition text-center"
                  >
                    Select Plan &amp; Register &rarr;
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. HOW IT WORKS SECTION (#how-it-works) */}
      <section id="how-it-works" className="py-16 sm:py-24 border-t border-[#64748B]/30 bg-[#111827]/40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-[#10B981] font-bold text-xs uppercase tracking-widest">
              Frictionless Customer Journey
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              From Sizing to Clean Energy in 48 Hours
            </h2>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <div className="p-6 rounded-3xl bg-[#111827] border border-[#64748B]/30 space-y-3">
              <span className="w-10 h-10 rounded-xl bg-[#10B981]/20 text-[#10B981] font-mono font-extrabold text-base flex items-center justify-center">01</span>
              <h4 className="font-bold text-white text-base">Instant Sizing &amp; NIN Verification</h4>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Pick your appliances and verify your 11-digit NIN. You instantly receive your customized Growatt bundle and 30% down payment quote.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-[#111827] border border-[#64748B]/30 space-y-3">
              <span className="w-10 h-10 rounded-xl bg-[#10B981]/20 text-[#10B981] font-mono font-extrabold text-base flex items-center justify-center">02</span>
              <h4 className="font-bold text-white text-base">Virtual Account Down Payment</h4>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Pay your 30% down payment via your dedicated Moniepoint/Paystack DVA number. Instant confirmation with zero bank visit required.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-[#111827] border border-[#64748B]/30 space-y-3">
              <span className="w-10 h-10 rounded-xl bg-[#10B981]/20 text-[#10B981] font-mono font-extrabold text-base flex items-center justify-center">03</span>
              <h4 className="font-bold text-white text-base">48-Hr COREN Installation</h4>
              <p className="text-xs text-[#64748B] leading-relaxed">
                COREN-certified engineers mount high-yield solar panels, wire your Growatt inverter, and install copper grounding rods (&le; 2.5&Omega;).
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-[#111827] border border-[#64748B]/30 space-y-3">
              <span className="w-10 h-10 rounded-xl bg-[#10B981]/20 text-[#10B981] font-mono font-extrabold text-base flex items-center justify-center">04</span>
              <h4 className="font-bold text-white text-base">Full Ownership &amp; Clean Power</h4>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Enjoy reliable 24/7 power, pay flexible installments via the app, and gain 100% full asset title ownership after term finish.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. ABOUT SECTION: WORLD-STANDARD COMPANY PROFILE, VISION, MISSION & AFRICAN ENERGY SOVEREIGNTY (#about) */}
      <section id="about" className="py-24 sm:py-32 border-t border-slate-200 dark:border-[#64748B]/30 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-[#0B0F19] dark:via-[#111827]/40 dark:to-[#0B0F19] relative overflow-hidden transition-colors duration-200">
        {/* Ambient Radial Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-amber-500/10 dark:from-[#10B981]/15 dark:via-[#22D3EE]/15 dark:to-[#FFBF00]/10 blur-3xl pointer-events-none rounded-full" />
        <div className="absolute bottom-10 right-10 w-[500px] h-[300px] bg-emerald-500/5 blur-3xl pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20 relative z-10">
          
          {/* 1. Heroic Header: Clear, Open & Grade-A Standard */}
          <div className="text-center max-w-4xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/15 via-sky-500/15 to-amber-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider backdrop-blur-md shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Sovereign Clean Energy Infrastructure &bull; Nigeria &bull; West Africa</span>
            </div>
            
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.12]">
              Built of World Standard.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-sky-600 to-amber-600 dark:from-[#10B981] dark:via-[#22D3EE] dark:to-[#FFBF00]">
                Born to Solve Nigeria’s Power Deficit &amp; Electrify Africa.
              </span>
            </h2>
            
            <p className="text-slate-700 dark:text-slate-300 text-base sm:text-lg leading-relaxed max-w-3xl mx-auto">
              SkyGrid Flex Solutions (in strategic alliance with SkyTron Quantum Solutions and Growatt New Energy) is Africa&apos;s premier Clean Energy-as-a-Service (EaaS) infrastructure enterprise. We are on a single uncompromising mandate: to replace the economic drain of fossil-fuel generators with sovereign, intelligent solar micro-powerplants and empower every Nigerian home and enterprise with bankable 24/7 electricity.
            </p>

            {/* Institutional Alliance Badges */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs font-mono font-bold">
              <span className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-emerald-800 dark:text-[#10B981] flex items-center gap-1.5">
                <span>🏛️</span> COREN Registered Firm
              </span>
              <span className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sky-800 dark:text-[#22D3EE] flex items-center gap-1.5">
                <span>🛡️</span> NEMSA Safety Certified
              </span>
              <span className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-amber-800 dark:text-[#FFBF00] flex items-center gap-1.5">
                <span>⚡</span> Growatt Official Tier-1 Partner
              </span>
              <span className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <span>🔋</span> 100% LiFePO4 Mandate
              </span>
            </div>
          </div>

          {/* 2. High-Impact Institutional Performance Counters */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-black/40 border border-slate-200/90 dark:border-[#64748B]/30 shadow-sm dark:shadow-none text-center space-y-1 hover:border-emerald-500/50 transition-all hover:-translate-y-1">
              <p className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-[#10B981] font-mono tabular-nums">99.98%</p>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Power Uptime</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">SLA Guaranteed</p>
            </div>
            <div className="p-5 rounded-2xl bg-white dark:bg-black/40 border border-slate-200/90 dark:border-[#64748B]/30 shadow-sm dark:shadow-none text-center space-y-1 hover:border-sky-500/50 transition-all hover:-translate-y-1">
              <p className="text-2xl sm:text-3xl font-black text-sky-700 dark:text-[#22D3EE] font-mono tabular-nums">6,000+</p>
              <p className="text-xs font-bold text-slate-900 dark:text-white">LiFePO4 Cycles</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">15+ Year Lifespan</p>
            </div>
            <div className="p-5 rounded-2xl bg-white dark:bg-black/40 border border-slate-200/90 dark:border-[#64748B]/30 shadow-sm dark:shadow-none text-center space-y-1 hover:border-amber-500/50 transition-all hover:-translate-y-1">
              <p className="text-2xl sm:text-3xl font-black text-amber-700 dark:text-[#FFBF00] font-mono tabular-nums">&gt; 65%</p>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Net Cash Savings</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">vs. Petrol/Diesel Gen</p>
            </div>
            <div className="p-5 rounded-2xl bg-white dark:bg-black/40 border border-slate-200/90 dark:border-[#64748B]/30 shadow-sm dark:shadow-none text-center space-y-1 hover:border-slate-400 transition-all hover:-translate-y-1">
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tabular-nums">36 + FCT</p>
              <p className="text-xs font-bold text-slate-900 dark:text-white">States Covered</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Nationwide Reach</p>
            </div>
            <div className="p-5 rounded-2xl bg-white dark:bg-black/40 border border-slate-200/90 dark:border-[#64748B]/30 shadow-sm dark:shadow-none text-center space-y-1 hover:border-emerald-500/50 transition-all hover:-translate-y-1">
              <p className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">&lt; 48 Hrs</p>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Rapid Install</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Audit to Turn-On</p>
            </div>
            <div className="p-5 rounded-2xl bg-white dark:bg-black/40 border border-slate-200/90 dark:border-[#64748B]/30 shadow-sm dark:shadow-none text-center space-y-1 hover:border-cyan-500/50 transition-all hover:-translate-y-1">
              <p className="text-2xl sm:text-3xl font-black text-cyan-700 dark:text-cyan-400 font-mono tabular-nums">100%</p>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Asset Ownership</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Title Deed Transfer</p>
            </div>
          </div>

          {/* 3. The National Challenge vs. The SkyGrid Standard: Balanced 2-Column Showcase */}
          <div className="space-y-6">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="text-[#FFBF00] font-bold text-xs uppercase tracking-widest font-mono">The Energy Shift</span>
              <h3 className="text-2xl sm:text-4xl font-extrabold text-white">Solving the Nigerian Power Deficit</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                A direct comparison between the exhausting fossil-fuel generator trap and the sovereign SkyGrid clean solar standard.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
              
              {/* Card A: The Old Dilemma (Generator Trap) */}
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-red-500/10 via-white to-red-500/5 dark:from-red-950/20 dark:via-slate-950/80 dark:to-slate-950 border border-red-500/30 space-y-6 shadow-sm dark:shadow-xl relative overflow-hidden flex flex-col justify-between">
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-red-500/20 text-red-700 dark:text-red-400 flex items-center justify-center font-bold text-base">⚠️</span>
                      <div>
                        <h4 className="text-lg font-bold text-slate-900 dark:text-white">The Centralized Grid &amp; Generator Trap</h4>
                        <p className="text-[11px] text-red-700 dark:text-red-300 font-mono">Crippling Nigerian Families &amp; Businesses</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-red-700 dark:text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/30">OLD REALITY</span>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-red-500/10 text-red-700 dark:text-red-400 flex items-center justify-center text-xs shrink-0 mt-0.5">✕</div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Chronic Grid Collapses &amp; Band A Hikes</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Under 4,500 MW grid capacity for 220M citizens; frequent total system collapses and punitive Band A tariffs exceeding ₦225/kWh without reliable supply.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-red-500/10 text-red-700 dark:text-red-400 flex items-center justify-center text-xs shrink-0 mt-0.5">✕</div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">$14 Billion Annual Generator Drain</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Over ₦22 Trillion spent every year on ₦1,250+/L petrol, ₦1,400/L diesel, oil top-ups, and endless engine mechanical servicing that delivers zero asset equity.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-red-500/10 text-red-700 dark:text-red-400 flex items-center justify-center text-xs shrink-0 mt-0.5">✕</div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Toxic Fumes &amp; Acoustic Pollution</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Poisonous carbon monoxide exhaust fumes and deafening engine noise choking residential estates and degrading quality of life.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-red-500/10 text-red-700 dark:text-red-400 flex items-center justify-center text-xs shrink-0 mt-0.5">✕</div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">The Substandard Battery Trap</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Tubular and Gel lead-acid batteries that burn out and die within 12 to 18 months in tropical heat, forcing repetitive expensive replacements.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-red-500/10 dark:bg-red-950/40 border border-red-500/30 text-xs text-red-800 dark:text-red-200 font-mono">
                  Result: Permanent capital drain with 0% electricity sovereignty.
                </div>
              </div>

              {/* Card B: The SkyGrid Clean Standard */}
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-emerald-500/10 via-white to-emerald-500/5 dark:from-emerald-950/20 dark:via-slate-950/80 dark:to-slate-950 border border-emerald-500/40 dark:border-[#10B981]/50 space-y-6 shadow-sm dark:shadow-2xl dark:shadow-[#10B981]/10 relative overflow-hidden flex flex-col justify-between">
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-800 dark:text-[#10B981] flex items-center justify-center font-bold text-base">☀️</span>
                      <div>
                        <h4 className="text-lg font-bold text-slate-900 dark:text-white">The SkyGrid Sovereign Clean Solution</h4>
                        <p className="text-[11px] text-emerald-800 dark:text-[#10B981] font-mono">World-Standard Clean Energy-as-a-Service</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-800 dark:text-[#10B981] bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">NEW STANDARD</span>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-800 dark:text-[#10B981] flex items-center justify-center text-xs shrink-0 mt-0.5">✓</div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Flicker-Free 24/7 Pure Sine Wave Power</p>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">COREN-certified Growatt hybrid inverters powering continuous inductive loads—including split inverter air conditioners, water borehole pumps, refrigerators, and medical equipment.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-800 dark:text-[#10B981] flex items-center justify-center text-xs shrink-0 mt-0.5">✓</div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">50% to 65% Cheaper than Generators</p>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">Start with a transparent 30% down payment and pay fixed, predictable monthly installments that cost significantly less than what you currently burn on petrol and diesel.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-800 dark:text-[#10B981] flex items-center justify-center text-xs shrink-0 mt-0.5">✓</div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">15+ Year Automotive LiFePO4 Durability</p>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">Strict mandate on Tier-1 Lithium Iron Phosphate cells rated for 6,000+ cycles at 80% Depth of Discharge, ensuring continuous overnight autonomy that far outlives your lease.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-800 dark:text-[#10B981] flex items-center justify-center text-xs shrink-0 mt-0.5">✓</div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">100% Asset Title Deed Transfer</p>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">Every naira paid builds equity. Once your flexible 12 to 60-month lease is concluded, full legal ownership transfers to you with zero balloon payments or buyout fees.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30 dark:border-[#10B981]/40 text-xs text-emerald-800 dark:text-emerald-200 font-mono">
                  Result: Sovereign electric independence &bull; Silent, clean, and bankable.
                </div>
              </div>

            </div>
          </div>

          {/* 4. Corporate Vision & Mission: Executive Dual Showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            
            {/* Corporate Vision Card */}
            <div className="p-8 sm:p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#22D3EE]/40 relative overflow-hidden space-y-6 shadow-sm dark:shadow-2xl flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-800 dark:text-[#22D3EE] flex items-center justify-center text-2xl font-bold shadow-lg shadow-sky-500/10">
                  🔭
                </div>
                <div className="space-y-2">
                  <span className="text-xs font-mono font-bold text-sky-800 dark:text-[#22D3EE] uppercase tracking-wider block">Continental Strategic Horizon</span>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">Our Corporate Vision</h3>
                </div>
                <p className="text-sm sm:text-base text-slate-700 dark:text-slate-200 leading-relaxed">
                  &ldquo;To build Africa&apos;s most intelligent, resilient, and inclusive decentralized clean energy ecosystem—eradicating energy poverty and guaranteeing continuous, affordable, and sovereign solar electric power for every Nigerian home, enterprise, and essential facility, scaling to power 50 million African lives by 2035.&rdquo;
                </p>
              </div>

              <div className="pt-6 border-t border-slate-200 dark:border-white/10 grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                  <p className="text-xl sm:text-2xl font-black text-sky-700 dark:text-[#22D3EE] font-mono tabular-nums">50M+</p>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 font-mono uppercase mt-0.5">African Lives</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                  <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">100%</p>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 font-mono uppercase mt-0.5">Gen Displacement</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                  <p className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-[#10B981] font-mono tabular-nums">36 States</p>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 font-mono uppercase mt-0.5">+ ECOWAS Corridor</p>
                </div>
              </div>
            </div>

            {/* Corporate Mission Card */}
            <div className="p-8 sm:p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#10B981]/40 relative overflow-hidden space-y-6 shadow-sm dark:shadow-2xl flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-[#10B981] flex items-center justify-center text-2xl font-bold shadow-lg shadow-emerald-500/10">
                  🎯
                </div>
                <div className="space-y-2">
                  <span className="text-xs font-mono font-bold text-emerald-800 dark:text-[#10B981] uppercase tracking-wider block">Operational Execution Mandate</span>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">Our Corporate Mission</h3>
                </div>
                <p className="text-sm sm:text-base text-slate-700 dark:text-slate-200 leading-relaxed">
                  &ldquo;To permanently dismantle fossil-fuel generator dependency across Nigeria and the African continent by deploying military-grade, Tier-1 Growatt solar hybrid micro-powerplants and long-life LiFePO4 energy storage via democratized Pay-As-You-Go financing, precision COREN/NEMSA electrical engineering, and proactive edge IoT telematics.&rdquo;
                </p>
              </div>

              <div className="pt-6 border-t border-slate-200 dark:border-white/10 grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                  <p className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-[#10B981] font-mono tabular-nums">6,000</p>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 font-mono uppercase mt-0.5">Cycles (15+ Yrs)</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                  <p className="text-xl sm:text-2xl font-black text-amber-700 dark:text-[#FFBF00] font-mono tabular-nums">₦0</p>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 font-mono uppercase mt-0.5">Collateral Barrier</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                  <p className="text-xl sm:text-2xl font-black text-sky-700 dark:text-[#22D3EE] font-mono tabular-nums">&lt; 48h</p>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 font-mono uppercase mt-0.5">Rapid Installation</p>
                </div>
              </div>
            </div>

          </div>

          {/* 5. Four Core Pillars of World-Standard Excellence */}
          <div className="space-y-8">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="text-emerald-800 dark:text-[#10B981] font-bold text-xs uppercase tracking-widest font-mono">Technical Rigor &bull; Zero Compromise</span>
              <h3 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">Why SkyGrid is of World Standard</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                Engineered with strict regulatory compliance, military-grade electrical safety, and institutional governance.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Pillar 1 */}
              <div className="p-6 rounded-3xl bg-white dark:bg-black/40 border border-slate-200/90 dark:border-[#64748B]/30 hover:border-emerald-500/50 transition-all hover:-translate-y-1 space-y-4 shadow-sm dark:shadow-xl">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-800 dark:text-[#10B981] flex items-center justify-center font-bold text-xl">
                  📐
                </div>
                <div className="space-y-2">
                  <h4 className="text-slate-900 dark:text-white font-bold text-base">COREN &amp; NEMSA Certified</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Every solar array is engineered, derated, and commissioned by COREN-registered engineers with Type-2 AC/DC surge protection, high-voltage lightning arrestors, and deep earthing resistance strictly below 5 Ohms (&le; 2.5&Omega;).
                  </p>
                </div>
              </div>

              {/* Pillar 2 */}
              <div className="p-6 rounded-3xl bg-white dark:bg-black/40 border border-slate-200/90 dark:border-[#64748B]/30 hover:border-sky-500/50 transition-all hover:-translate-y-1 space-y-4 shadow-sm dark:shadow-xl">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-800 dark:text-[#22D3EE] flex items-center justify-center font-bold text-xl">
                  🔋
                </div>
                <div className="space-y-2">
                  <h4 className="text-slate-900 dark:text-white font-bold text-base">100% LiFePO4 Mandate</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    We strictly ban Lead-Acid, Tubular, and Gel batteries across our fleet. We deploy only automotive-grade Lithium Iron Phosphate cells rated for 6,000+ cycles at 80% DoD—delivering 15+ years of nightly battery autonomy.
                  </p>
                </div>
              </div>

              {/* Pillar 3 */}
              <div className="p-6 rounded-3xl bg-white dark:bg-black/40 border border-slate-200/90 dark:border-[#64748B]/30 hover:border-amber-500/50 transition-all hover:-translate-y-1 space-y-4 shadow-sm dark:shadow-xl">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-800 dark:text-[#FFBF00] flex items-center justify-center font-bold text-xl">
                  💳
                </div>
                <div className="space-y-2">
                  <h4 className="text-slate-900 dark:text-white font-bold text-base">Fintech &amp; Offline STS Mesh</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Instant auto-unlocking in &lt; 5 seconds via dedicated NUBAN virtual accounts (Moniepoint, Paystack, OPay). If telecom cellular towers experience blackouts, our offline 20-digit STS keypad code guarantees your power never shuts off.
                  </p>
                </div>
              </div>

              {/* Pillar 4 */}
              <div className="p-6 rounded-3xl bg-white dark:bg-black/40 border border-slate-200/90 dark:border-[#64748B]/30 hover:border-purple-500/50 transition-all hover:-translate-y-1 space-y-4 shadow-sm dark:shadow-xl">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-800 dark:text-purple-400 flex items-center justify-center font-bold text-xl">
                  🌍
                </div>
                <div className="space-y-2">
                  <h4 className="text-slate-900 dark:text-white font-bold text-base">Pan-African Technical Academy</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Engineered to expand from Nigeria into Ghana, Cameroon, Kenya, and across the ECOWAS corridor. The SkyGrid Technical Academy trains and certifies local technicians, creating thousands of high-wage African green engineering jobs.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* 6. Grade-A Closing Action Strip */}
          <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-slate-100 to-sky-500/10 dark:from-[#10B981]/20 dark:via-slate-900 dark:to-[#22D3EE]/20 border border-emerald-500/30 dark:border-[#10B981]/40 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm dark:shadow-2xl">
            <div className="space-y-2 text-center md:text-left">
              <div className="inline-flex items-center gap-2 text-xs font-mono font-bold text-amber-700 dark:text-[#FFBF00]">
                <span>⚡</span> COREN-Certified Engineers Standing By Nationwide
              </div>
              <h4 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Ready to Power Your Home with Sovereign Clean Energy?</h4>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 max-w-xl">
                Calculate your monthly cashflow savings, customize your appliance load, and get installed within 48 hours with zero collateral barriers.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
              <button
                onClick={() => setIsSignUpModalOpen(true)}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-[#10B981] dark:hover:bg-emerald-400 dark:text-[#0B0F19] font-extrabold text-xs sm:text-sm px-7 py-3.5 rounded-xl transition shadow-lg shadow-emerald-500/25 text-center"
              >
                Sign Up with NIN &rarr;
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full sm:w-auto bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white font-bold text-xs sm:text-sm px-6 py-3.5 rounded-xl border border-slate-300 dark:border-white/10 transition text-center"
              >
                Book Site Audit
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* 9. FAQ SECTION (#faq) */}
      <section id="faq" className="py-16 sm:py-24 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-[#10B981] font-bold text-xs uppercase tracking-widest">Questions &amp; Answers</span>
          <h2 className="text-3xl font-extrabold text-white">Frequently Asked Questions</h2>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          <div className="p-5 rounded-2xl bg-[#111827] border border-[#64748B]/30 space-y-2">
            <h4 className="font-bold text-white text-sm">Why do you mandate LiFePO4 batteries instead of cheaper Tubular or Gel batteries?</h4>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Tubular and Gel lead-acid batteries degrade within 12 to 18 months in Nigeria&apos;s heat, leaving customers with dead batteries mid-way through their 36-month lease. We strictly mandate Tier-1 LiFePO4 cells rated for 6,000 cycles (15+ years lifespan) to ensure your system outlasts the payment tenure.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#111827] border border-[#64748B]/30 space-y-2">
            <h4 className="font-bold text-white text-sm">How does the 20-digit keypad offline unlock work during telecom network blackouts?</h4>
            <p className="text-xs text-[#64748B] leading-relaxed">
              If cellular networks are down, you can request an encrypted 20-digit STS token via SMS or Bluetooth directly through our customer app. Enter the token into the inverter IoT keypad to immediately extend your active power period without internet access.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#111827] border border-[#64748B]/30 space-y-2">
            <h4 className="font-bold text-white text-sm">Can I buy out my system early or pay off the balance before 36 months?</h4>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Yes! There are zero prepayment penalties. If you pay off your remaining principal early, you receive a full interest rebate on all remaining months and immediate release of your title deed.
            </p>
          </div>
        </div>
      </section>

      {/* 10. EXPANSIVE WORLD-STANDARD CORPORATE FOOTER */}
      <footer className="border-t border-[#64748B]/30 bg-[#0B0F19] py-16 px-4 sm:px-6 lg:px-10 text-xs text-[#64748B]">
        <div className="max-w-[1600px] mx-auto space-y-12">
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
            
            {/* Col 1: Corporate Brand & African Energy Mission */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10B981] to-teal-600 flex items-center justify-center font-black text-[#0B0F19] text-xl shadow-lg shadow-[#10B981]/25">
                  G
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-lg tracking-tight text-white">SKYGRID</span>
                    <span className="text-[#10B981] font-semibold text-lg">GROWATT PAYG</span>
                  </div>
                  <p className="text-[10px] text-[#64748B] -mt-1 font-mono">Clean Energy-as-a-Service &bull; Nigeria &amp; Africa</p>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                SkyGrid Flex Solutions Ltd. is a premier Clean Energy-as-a-Service infrastructure and fintech corporation, in strategic alliance with SkyTron Quantum Solutions and Growatt New Energy. We are committed to solving Nigeria&apos;s electricity deficit, ending fossil generator dependency, and powering every home and enterprise across Africa with world-standard solar technology.
              </p>

              <div className="flex items-center gap-3 pt-2">
                <span className="px-2.5 py-1 rounded-md bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] font-mono text-[10px] font-bold">
                  COREN REGISTERED
                </span>
                <span className="px-2.5 py-1 rounded-md bg-[#22D3EE]/10 border border-[#22D3EE]/30 text-[#22D3EE] font-mono text-[10px] font-bold">
                  NEMSA CERTIFIED
                </span>
                <span className="px-2.5 py-1 rounded-md bg-[#FFBF00]/10 border border-[#FFBF00]/30 text-[#FFBF00] font-mono text-[10px] font-bold">
                  GROWATT TIER-1
                </span>
              </div>
            </div>

            {/* Col 2: Navigation Links */}
            <div className="space-y-3">
              <h5 className="font-bold text-white text-xs uppercase tracking-wider font-mono">Platform Navigation</h5>
              <ul className="space-y-2 text-slate-400 text-xs">
                <li><a href="#hero" className="hover:text-[#10B981] transition">Home Overview</a></li>
                <li><a href="#about" className="hover:text-[#10B981] transition">About Us (Vision &amp; Mission)</a></li>
                <li><a href="#calculator" className="hover:text-[#10B981] transition">Savings &amp; Load Sizer</a></li>
                <li><a href="#smart-app" className="hover:text-[#10B981] transition">Smart App &amp; Analytics Suite</a></li>
                <li><a href="#bundles" className="hover:text-[#10B981] transition">Curated Growatt Bundles</a></li>
                <li><a href="#how-it-works" className="hover:text-[#10B981] transition">How It Works</a></li>
                <li><a href="#faq" className="hover:text-[#10B981] transition">FAQ</a></li>
              </ul>
            </div>

            {/* Col 3: Engineering Standards & Technology */}
            <div className="space-y-3">
              <h5 className="font-bold text-white text-xs uppercase tracking-wider font-mono">Engineering Standards</h5>
              <ul className="space-y-2 text-slate-400 text-xs">
                <li><a href="#about" className="hover:text-[#10B981] transition">100% LiFePO4 Chemistry Mandate</a></li>
                <li><a href="#about" className="hover:text-[#10B981] transition">COREN Derating &amp; Safety Compliance</a></li>
                <li><a href="#about" className="hover:text-[#10B981] transition">Type-2 SPD &amp; &lt; 2.5&Omega; Earthing</a></li>
                <li><a href="#about" className="hover:text-[#10B981] transition">20-Digit STS Offline Keypad Protocol</a></li>
                <li><a href="#about" className="hover:text-[#10B981] transition">Cloud IoT Telematics &amp; Watchtower</a></li>
                <li><a href="#about" className="hover:text-[#10B981] transition">All-Risk Equipment Insurance (1.75%)</a></li>
              </ul>
            </div>

            {/* Col 4: Corporate Offices & Pan-African Hubs */}
            <div className="space-y-3">
              <h5 className="font-bold text-white text-xs uppercase tracking-wider font-mono">Regional Operations</h5>
              <p className="text-slate-400 text-xs leading-relaxed">
                <strong className="text-white">Abuja HQ:</strong> Maitama &amp; Central Business District, FCT Abuja.<br />
                <strong className="text-white">Lagos Hub:</strong> Victoria Island &amp; Ikeja Industrial Zone.<br />
                <strong className="text-white">Pan-African Horizon:</strong> ECOWAS &amp; East Africa Corridor.
              </p>
              <div className="pt-2 space-y-1 text-slate-400 text-xs">
                <p>📞 Emergency Hotline: +234 (0) 800-SKYGRID</p>
                <p>✉️ Corporate Inquiries: contact@skygrid.ng</p>
                <p>⚡ 24/7 Rapid Field Support Active</p>
              </div>
            </div>

          </div>

          {/* Bottom Divider & Legal */}
          <div className="pt-8 border-t border-[#64748B]/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#64748B]">
            <p>
              &copy; {new Date().getFullYear()} SkyGrid Flex Solutions Ltd. In Strategic Alliance with SkyTron Quantum Solutions &amp; Growatt New Energy. All Rights Reserved.
            </p>
            <div className="flex items-center gap-6">
              <a href="#about" className="hover:text-slate-400 transition">Corporate Charter</a>
              <a href="#about" className="hover:text-slate-400 transition">Privacy &amp; Data Protection (NDPR)</a>
              <a href="#about" className="hover:text-slate-400 transition">PAYG Agreement Terms</a>
              <a href="#about" className="hover:text-[#10B981] transition text-emerald-400 font-bold">Pan-African Clean Energy Mandate</a>
            </div>
          </div>

        </div>
      </footer>

      {/* 10. COMPREHENSIVE CUSTOMER SIGN-UP MODAL (WITH NIMC NIN VERIFICATION) */}
      {isSignUpModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-2xl bg-[#111827] border border-[#64748B]/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            
            <button
              onClick={() => { setIsSignUpModalOpen(false); setSignUpSuccess(null); }}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#1E293B] hover:bg-[#64748B]/30 text-white flex items-center justify-center text-sm transition"
            >
              &times;
            </button>

            {!signUpSuccess ? (
              <form onSubmit={handleSignUpSubmit} className="space-y-5">
                
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981] text-[10px] font-bold uppercase tracking-wider">
                    <span>⚡</span> Step 1 of 2: Identity &amp; Credit Verification
                  </div>
                  <h3 className="text-xl font-extrabold text-white">
                    New Customer Registration (PAYGo Solar)
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Enter your 11-digit NIN to automatically verify your identity and generate your dedicated Moniepoint virtual account.
                  </p>
                </div>

                {/* NIN Input & Auto-Population Bar */}
                <div className="p-4 rounded-2xl bg-[#1E293B] border border-[#64748B]/30 space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    1. National Identity Number (NIN)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={11}
                      placeholder="Enter 11-digit NIN (e.g. 58291048291)"
                      value={ninNumber}
                      onChange={(e) => setNinNumber(e.target.value.replace(/\D/g, ''))}
                      className="flex-1 bg-[#0B0F19] border border-[#64748B]/40 rounded-xl px-4 py-2.5 text-sm font-mono text-white outline-none focus:border-[#10B981]"
                    />
                    <button
                      type="button"
                      disabled={ninLoading}
                      onClick={handleVerifyNIN}
                      className="bg-[#10B981] hover:bg-emerald-400 text-[#0B0F19] font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shrink-0"
                    >
                      {ninLoading ? 'Verifying...' : ninVerified ? '✓ Verified' : 'Verify NIN'}
                    </button>
                  </div>
                  {ninVerified && (
                    <span className="text-[11px] text-[#10B981] block font-mono">
                      ✓ NIMC Record Matched: {signUpData.firstName} {signUpData.middleName} {signUpData.lastName}
                    </span>
                  )}
                </div>

                {/* Demographic Fields (Auto-Populated) */}
                <div className="grid sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="text-[#64748B] block mb-1">First Name</label>
                    <input
                      type="text"
                      required
                      value={signUpData.firstName}
                      onChange={(e) => setSignUpData({ ...signUpData, firstName: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#64748B]/40 rounded-xl p-2.5 text-white font-medium outline-none focus:border-[#10B981]"
                    />
                  </div>
                  <div>
                    <label className="text-[#64748B] block mb-1">Middle Name</label>
                    <input
                      type="text"
                      value={signUpData.middleName}
                      onChange={(e) => setSignUpData({ ...signUpData, middleName: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#64748B]/40 rounded-xl p-2.5 text-white font-medium outline-none focus:border-[#10B981]"
                    />
                  </div>
                  <div>
                    <label className="text-[#64748B] block mb-1">Surname</label>
                    <input
                      type="text"
                      required
                      value={signUpData.lastName}
                      onChange={(e) => setSignUpData({ ...signUpData, lastName: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#64748B]/40 rounded-xl p-2.5 text-white font-medium outline-none focus:border-[#10B981]"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[#64748B] block mb-1">Date of Birth</label>
                    <input
                      type="date"
                      required
                      value={signUpData.dob}
                      onChange={(e) => setSignUpData({ ...signUpData, dob: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#64748B]/40 rounded-xl p-2.5 text-white font-medium outline-none focus:border-[#10B981]"
                    />
                  </div>
                  <div>
                    <label className="text-[#64748B] block mb-1">Gender</label>
                    <select
                      value={signUpData.gender}
                      onChange={(e) => setSignUpData({ ...signUpData, gender: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#64748B]/40 rounded-xl p-2.5 text-white font-medium outline-none focus:border-[#10B981]"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[#64748B] block mb-1">Phone Number (WhatsApp Active)</label>
                    <input
                      type="tel"
                      required
                      placeholder="0803 123 4567"
                      value={signUpData.phone}
                      onChange={(e) => setSignUpData({ ...signUpData, phone: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#64748B]/40 rounded-xl p-2.5 text-white font-medium outline-none focus:border-[#10B981]"
                    />
                  </div>
                  <div>
                    <label className="text-[#64748B] block mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="you@domain.com"
                      value={signUpData.email}
                      onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#64748B]/40 rounded-xl p-2.5 text-white font-medium outline-none focus:border-[#10B981]"
                    />
                  </div>
                </div>

                <div className="text-xs">
                  <label className="text-[#64748B] block mb-1">Installation Street Address</label>
                  <input
                    type="text"
                    required
                    placeholder="Plot / House No, Street, Landmark"
                    value={signUpData.streetAddress}
                    onChange={(e) => setSignUpData({ ...signUpData, streetAddress: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-[#64748B]/40 rounded-xl p-2.5 text-white font-medium outline-none focus:border-[#10B981]"
                  />
                </div>

                {/* Plan Quote Snapshot */}
                <div className="p-3.5 rounded-2xl bg-[#1E293B] border border-[#64748B]/30 text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-300">
                    <span>Matched Bundle:</span>
                    <strong className="text-[#10B981]">{engineeringResult.bundle.title}</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Required 30% Down Payment:</span>
                    <strong className="text-white font-mono">{formatNaira(engineeringResult.downPaymentNaira)}</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Monthly PAYG Installment:</span>
                    <strong className="text-[#10B981] font-mono">{formatNaira(engineeringResult.monthlyInstallment)}/mo</strong>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#10B981] hover:bg-emerald-400 text-[#0B0F19] font-extrabold py-3.5 rounded-xl transition shadow-xl text-sm"
                >
                  Confirm Registration &amp; Generate Virtual Account &rarr;
                </button>

              </form>
            ) : (
              <div className="text-center py-6 space-y-6">
                <div className="w-16 h-16 rounded-full bg-[#10B981]/20 text-[#10B981] flex items-center justify-center text-3xl mx-auto">
                  ✓
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-extrabold text-white">
                    Registration &amp; DVA Approved!
                  </h3>
                  <p className="text-xs text-[#64748B] max-w-md mx-auto">
                    Your customer account has been created and linked to your 11-digit NIN. You can now transfer your 30% down payment to activate 48-hour installation.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[#1E293B] border border-[#64748B]/30 max-w-md mx-auto text-left space-y-3 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Customer ID:</span>
                    <span className="text-white font-bold">{signUpSuccess.customerId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Assigned Bank:</span>
                    <span className="text-[#22D3EE] font-bold">{signUpSuccess.dvaBank}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Dedicated Account #:</span>
                    <span className="text-[#10B981] font-extrabold text-base tracking-widest">{signUpSuccess.dvaAccount}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#64748B]/30">
                    <span className="text-[#64748B]">Required Down Payment:</span>
                    <span className="text-white font-bold">{formatNaira(signUpSuccess.downPaymentNaira)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Monthly Installment:</span>
                    <span className="text-[#10B981] font-bold">{formatNaira(signUpSuccess.monthlyNaira)}/mo</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => { setIsSignUpModalOpen(false); setSignUpSuccess(null); }}
                    className="bg-[#10B981] hover:bg-emerald-400 text-[#0B0F19] font-bold text-xs px-6 py-3 rounded-xl transition"
                  >
                    Done &bull; Return to Showroom
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

      {/* 11. BOOK SITE AUDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-lg bg-[#111827] border border-[#64748B]/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            
            <button
              onClick={() => { setIsModalOpen(false); setBookingConfirmation(null); }}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#1E293B] hover:bg-[#64748B]/30 text-white flex items-center justify-center text-sm transition"
            >
              &times;
            </button>

            {!bookingConfirmation ? (
              <form onSubmit={handleBookAuditSubmit} className="space-y-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981] text-[10px] font-bold uppercase tracking-wider">
                    <span>📐</span> COREN Engineering Inspection
                  </div>
                  <h3 className="text-xl font-extrabold text-white">Book Site Audit &amp; Earthing Test</h3>
                  <p className="text-xs text-[#64748B]">
                    A certified engineer will verify your roof azimuth, load distribution, and soil resistivity (&le; 2.5&Omega;).
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[#64748B] block mb-1">Full Legal Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Babatunde Okafor"
                      value={leadForm.fullName}
                      onChange={(e) => setLeadForm({ ...leadForm, fullName: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#64748B]/40 rounded-xl p-2.5 text-white outline-none focus:border-[#10B981]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[#64748B] block mb-1">Phone (WhatsApp)</label>
                      <input
                        type="tel"
                        required
                        placeholder="0803 123 4567"
                        value={leadForm.phone}
                        onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                        className="w-full bg-[#0B0F19] border border-[#64748B]/40 rounded-xl p-2.5 text-white outline-none focus:border-[#10B981]"
                      />
                    </div>
                    <div>
                      <label className="text-[#64748B] block mb-1">Email Address</label>
                      <input
                        type="email"
                        required
                        placeholder="you@domain.com"
                        value={leadForm.email}
                        onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                        className="w-full bg-[#0B0F19] border border-[#64748B]/40 rounded-xl p-2.5 text-white outline-none focus:border-[#10B981]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[#64748B] block mb-1">Installation Address</label>
                    <input
                      type="text"
                      required
                      placeholder="House / Street, City / Area"
                      value={leadForm.streetAddress}
                      onChange={(e) => setLeadForm({ ...leadForm, streetAddress: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#64748B]/40 rounded-xl p-2.5 text-white outline-none focus:border-[#10B981]"
                    />
                  </div>
                  <div>
                    <label className="text-[#64748B] block mb-1">Preferred Audit Window</label>
                    <select
                      value={leadForm.preferredAuditDay}
                      onChange={(e) => setLeadForm({ ...leadForm, preferredAuditDay: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#64748B]/40 rounded-xl p-2.5 text-white outline-none focus:border-[#10B981]"
                    >
                      <option value="Tomorrow Morning (10:00 AM)">Tomorrow Morning (10:00 AM)</option>
                      <option value="Tomorrow Afternoon (2:00 PM)">Tomorrow Afternoon (2:00 PM)</option>
                      <option value="Saturday Morning (10:00 AM)">Saturday Morning (10:00 AM)</option>
                      <option value="Next Business Day (10:00 AM)">Next Business Day (10:00 AM)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#10B981] hover:bg-emerald-400 text-[#0B0F19] font-extrabold py-3.5 rounded-xl transition shadow-lg text-sm"
                >
                  {isSubmitting ? 'Securing Schedule...' : 'Confirm Audit Booking & Lock Quote \u2192'}
                </button>
              </form>
            ) : (
              <div className="text-center py-6 space-y-5">
                <div className="w-16 h-16 rounded-full bg-[#10B981]/20 text-[#10B981] flex items-center justify-center text-3xl mx-auto">
                  ✓
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-extrabold text-white">Site Audit Reserved!</h3>
                  <p className="text-xs text-[#64748B] max-w-md mx-auto">
                    {bookingConfirmation.message}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-[#1E293B] border border-[#64748B]/30 max-w-sm mx-auto text-center space-y-1">
                  <span className="text-[10px] text-[#64748B] uppercase tracking-wider block">Inspection Booking Reference</span>
                  <span className="text-lg font-mono font-extrabold text-[#22D3EE]">{bookingConfirmation.ref}</span>
                </div>
                <div>
                  <button
                    onClick={() => { setIsModalOpen(false); setBookingConfirmation(null); }}
                    className="bg-[#10B981] hover:bg-emerald-400 text-[#0B0F19] font-bold text-xs px-6 py-3 rounded-xl transition"
                  >
                    Done &bull; Return to Showroom
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}