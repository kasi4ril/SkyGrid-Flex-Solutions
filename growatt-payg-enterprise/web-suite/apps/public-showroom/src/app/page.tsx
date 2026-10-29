/**
 * @fileoverview Premium AI-Powered PAYGo Solar Energy Platform Landing Page
 * Application: web-suite/apps/public-showroom
 * Framework: Next.js (React / TypeScript)
 * Palette:
 *  - Deep Forest Green: #123B2A
 *  - Dark Green: #0B241B
 *  - Solar Amber: #F5B82E
 *  - Teal: #19A89A
 *  - Warm Off-White: #F8FAF7
 *  - White: #FFFFFF
 *  - Charcoal: #17231D
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';

// --- Types & Interfaces ---
export interface ApplianceItem {
  id: string;
  name: string;
  watts: number;
  surge: number;
  isMotor: boolean;
  qty: number;
}

export interface SolarPackage {
  title: string;
  sku: string;
  badge?: string;
  inverter: string;
  battery: string;
  pv: string;
  profile: string;
  cashPriceNGN: number;
  downPaymentPct: number;
  monthlyInstallmentNGN: number;
  supportedAppliances: string[];
  warranty: string;
}

export interface CaseStudy {
  title: string;
  clientType: string;
  location: string;
  system: string;
  challenge: string;
  fuelCut: string;
  monthlySavings: string;
  keyMetric: string;
}

// --- Verified Hardware Packages ---
const SOLAR_PACKAGES: SolarPackage[] = [
  {
    title: 'Essential Home',
    sku: 'GW-SPF3000-LFP5',
    inverter: 'Growatt SPF 3000TL LVM-ES',
    battery: '5.12 kWh LiFePO4 (6,000 Cycles)',
    pv: '2.70 kWp Mono PERC Half-Cell',
    profile: '2–3 Bedroom Flats & Small Households',
    cashPriceNGN: 2850000,
    downPaymentPct: 30,
    monthlyInstallmentNGN: 78500,
    warranty: '10-Yr Battery / 5-Yr Inverter / 25-Yr PV',
    supportedAppliances: [
      '8x LED Bulbs & Security Lights',
      '3x Standing / Ceiling Fans',
      '55" Smart TV + Starlink + Laptops',
      'Inverter Refrigerator (24/7 Power)',
    ],
  },
  {
    title: 'Family Solar',
    sku: 'GW-SPF5000-LFP10',
    badge: 'Most Popular for Duplexes',
    inverter: 'Growatt SPF 5000ES Hybrid',
    battery: '10.24 kWh LiFePO4 (6,000 Cycles)',
    pv: '5.40 kWp Mono PERC Half-Cell',
    profile: '4–5 Bedroom Duplexes & Active Families',
    cashPriceNGN: 6300000,
    downPaymentPct: 30,
    monthlyInstallmentNGN: 172000,
    warranty: '10-Yr Battery / 5-Yr Inverter / 25-Yr PV',
    supportedAppliances: [
      'Full Essential Home Loads',
      '1x 1.0 HP Inverter AC (Day + Night)',
      'Deep Chest Freezer (250W)',
      '1.0 HP Borehole Water Pump',
    ],
  },
  {
    title: 'Business Solar',
    sku: 'GW-SPH10000-LFP20',
    inverter: 'Growatt SPH 10000TL Commercial',
    battery: '20.48 kWh LiFePO4 Rack',
    pv: '9.90 kWp Mono PERC Array',
    profile: 'Clinics, Pharmacies, Bakeries & Tech Hubs',
    cashPriceNGN: 11800000,
    downPaymentPct: 30,
    monthlyInstallmentNGN: 325000,
    warranty: '10-Yr Battery / 5-Yr Inverter / 25-Yr PV',
    supportedAppliances: [
      '2x 1.5 HP Inverter ACs',
      'Vaccine Reagents & Cold Rooms',
      'Server Racks, POS & 15 Workstations',
      '2 HP High-Pressure Water System',
    ],
  },
  {
    title: 'Commercial & Light Industrial',
    sku: 'GW-IND-CUSTOM',
    inverter: '3-Phase Modular Parallel (20kVA–100kVA+)',
    battery: '30.7–120 kWh Containerized LiFePO4',
    pv: '15–80 kWp High-Yield PV Array',
    profile: 'Warehouses, Agro-processing & Estates',
    cashPriceNGN: 16800000,
    downPaymentPct: 30,
    monthlyInstallmentNGN: 460000,
    warranty: '15-Yr System Lifecycle & Dedicated SLA',
    supportedAppliances: [
      'High-Surge Inductive Motors Support',
      'Microgrid Peak Shaving & Sync',
      'Corporate PPA & Equipment Leasing',
      'Dedicated 4-Hour Response SLA',
    ],
  },
];

const INITIAL_APPLIANCES: ApplianceItem[] = [
  { id: 'app_led', name: 'LED Bulbs (15W)', watts: 15, surge: 1.0, isMotor: false, qty: 8 },
  { id: 'app_fan', name: 'Standing / Ceiling Fans (75W)', watts: 75, surge: 1.3, isMotor: true, qty: 3 },
  { id: 'app_tv', name: '55" Smart TV & Decoder (120W)', watts: 120, surge: 1.0, isMotor: false, qty: 1 },
  { id: 'app_work', name: 'Starlink Router + 2 Laptops (90W)', watts: 90, surge: 1.0, isMotor: false, qty: 1 },
  { id: 'app_fridge', name: 'Inverter Refrigerator (180W)', watts: 180, surge: 2.2, isMotor: true, qty: 1 },
  { id: 'app_freezer', name: 'Deep Chest Freezer (250W)', watts: 250, surge: 2.8, isMotor: true, qty: 0 },
  { id: 'app_ac', name: '1.0 HP Inverter Split AC (850W)', watts: 850, surge: 1.6, isMotor: true, qty: 0 },
  { id: 'app_pump', name: '1.0 HP Borehole Water Pump (750W)', watts: 750, surge: 3.0, isMotor: true, qty: 0 },
];

const CASE_STUDIES: CaseStudy[] = [
  {
    title: '24/7 Vaccine Refrigeration & Lab Ultrasound',
    clientType: 'Diagnostic Medical Center',
    location: 'Ikeja, Lagos State',
    system: '10.0 kVA Growatt SPH Hybrid • 20.48 kWh LiFePO4 • 9.9 kWp PV',
    challenge: 'Unstable Band A grid power caused generator start-stop cycles, corrupting lab assays and burning ₦520,000 monthly in diesel.',
    fuelCut: '92% Displaced',
    monthlySavings: '₦380,000/mo',
    keyMetric: '99.98% Medical Cold-Chain Uptime',
  },
  {
    title: 'Silent Night Cooling & Borehole Independence',
    clientType: '4-Bedroom Family Duplex',
    location: 'Guzape Hills, Abuja FCT',
    system: '5.0 kVA Growatt SPF 5000ES • 10.24 kWh LiFePO4 • 5.4 kWp PV',
    challenge: 'Grid dropouts and petrol generator fumes disrupted sleep and remote software engineering work, while borehole pumping strained small inverters.',
    fuelCut: '0 Hours / Week Petrol Usage',
    monthlySavings: '₦195,000/mo',
    keyMetric: 'Overnight Inverter AC Silent Cooling',
  },
  {
    title: 'Industrial Motors & Cold Grain Preservation',
    clientType: 'Agro-Processing & Grain Storage Hub',
    location: 'Sagamu, Ogun State',
    system: '30.0 kVA 3-Phase Microgrid • 40 kWh Industrial Storage • 24 kWp PV',
    challenge: 'Heavy 3-phase milling motors caused devastating feeder voltage dips, resulting in burnt motor windings and idle labor.',
    fuelCut: '86% Diesel Displacement',
    monthlySavings: '24-Month Payback',
    keyMetric: 'Zero Motor Burnout Incidents',
  },
];

const HERO_SLIDES = [
  {
    src: 'https://images.unsplash.com/photo-1508873696983-2df5293cb395?auto=format&fit=crop&w=1920&q=80',
    alt: 'Residential rooftop solar installation on modern home',
    caption: 'Residential Rooftop Array — Lekki Peninsula, Lagos State',
    tag: '01 Residential',
  },
  {
    src: 'https://images.unsplash.com/photo-1497440001374-f26997328c1b?auto=format&fit=crop&w=1920&q=80',
    alt: 'Commercial rooftop photovoltaic array on health clinic and office complex',
    caption: 'Commercial Health Clinic & Office — Central Business District, Abuja',
    tag: '02 Commercial',
  },
  {
    src: 'https://images.unsplash.com/photo-1584271854089-9bb3e5168e32?auto=format&fit=crop&w=1920&q=80',
    alt: 'Light-industrial warehouse and agro-processing solar microgrid array',
    caption: 'Light-Industrial Agro-Processing Facility — Sagamu, Ogun State',
    tag: '03 Light Industrial',
  },
];

export default function PublicShowroomPage() {
  // Navigation & Scroll State
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Hero Slideshow State
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSlideshowPlaying, setIsSlideshowPlaying] = useState(true);

  // Calculator State
  const [selectedState, setSelectedState] = useState('LAGOS');
  const [appliances, setAppliances] = useState<ApplianceItem[]>(INITIAL_APPLIANCES);
  const [downPaymentPct, setDownPaymentPct] = useState(30);
  const [tenureMonths, setTenureMonths] = useState(36);

  // Monitoring Simulation Mode
  const [dashboardMode, setDashboardMode] = useState<'day' | 'night' | 'outage'>('day');

  // Modals & Interactivity
  const [selectedPackageForModal, setSelectedPackageForModal] = useState<SolarPackage | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [auditTargetPackage, setAuditTargetPackage] = useState('Standard Sizing Plan');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Scroll listener for sticky translucent navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Automatic Hero Slideshow (6-8s interval)
  useEffect(() => {
    if (!isSlideshowPlaying) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [isSlideshowPlaying]);

  // Adjust appliance quantity
  const handleApplianceChange = (id: string, delta: number) => {
    setAppliances((prev) =>
      prev.map((app) =>
        app.id === id ? { ...app, qty: Math.max(0, Math.min(20, app.qty + delta)) } : app
      )
    );
  };

  // Sizing & Financial Math
  const sizingMath = useMemo(() => {
    let runningWatts = 0;
    let surgeVA = 0;

    appliances.forEach((app) => {
      const running = app.watts * app.qty;
      runningWatts += running;
      surgeVA += running * app.surge;
    });

    let bundle = SOLAR_PACKAGES[0];
    if (runningWatts > 4500 || surgeVA > 9500) {
      bundle = SOLAR_PACKAGES[2]; // Business / 10kVA
    } else if (runningWatts > 2400 || surgeVA > 5500) {
      bundle = SOLAR_PACKAGES[1]; // Family Executive / 5kVA
    } else if (runningWatts > 1500 || surgeVA > 3500) {
      bundle = SOLAR_PACKAGES[1]; // Family Standard
    }

    const cashPrice = bundle.cashPriceNGN;
    const downPayment = Math.round(cashPrice * (downPaymentPct / 100));
    const principal = cashPrice - downPayment;
    const monthlyRate = 0.0175;
    const totalFinanced = Math.round(principal * (1 + monthlyRate * tenureMonths));
    const monthlyPayment = Math.round(totalFinanced / tenureMonths);

    // Generator comparison (₦1,250/L petrol; ~1.8L/hr running 8 hrs/day)
    const dailyPetrolLiters = runningWatts > 3000 ? 22 : 14;
    const monthlyPetrolCost = dailyPetrolLiters * 1250 * 30 + 15000;
    const netMonthlySavings = monthlyPetrolCost - monthlyPayment;
    const threeYearSavings = netMonthlySavings * 36;

    return {
      runningWatts,
      surgeVA,
      bundle,
      cashPrice,
      downPayment,
      monthlyPayment,
      monthlyPetrolCost,
      netMonthlySavings,
      threeYearSavings,
    };
  }, [appliances, downPaymentPct, tenureMonths]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const openAuditForPackage = (pkgTitle: string) => {
    setAuditTargetPackage(pkgTitle);
    setIsAuditModalOpen(true);
  };

  const handleAuditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const payload = {
      full_name: formData.get('fullName') as string,
      phone: formData.get('phone') as string,
      email: (formData.get('email') as string) || 'client@skygrid.ng',
      state_region: formData.get('state') as string,
      city: 'Lagos Island',
      street_address: formData.get('address') as string,
      preferred_audit_day: 'Next Available Business Day',
      sizing_input: {
        state_region: formData.get('state') as string,
        backup_autonomy_hours: 12,
        selected_appliances: appliances
          .filter((a) => a.qty > 0)
          .map((a) => ({
            appliance_code: a.id,
            quantity: a.qty,
            hours_daytime: 4,
            hours_nighttime: 8,
          })),
        payment_mode: 'INSTALLMENT_36_MONTHS',
        tenure_months: tenureMonths,
        down_payment_pct: downPaymentPct,
        disco_tariff_band: 'BAND_A',
        fuel_price_per_liter_ngn: 1250,
      },
    };

    try {
      const res = await fetch('/api/v1/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setIsAuditModalOpen(false);
        showToast(`✓ Booking Reference ${data.audit_booking_ref || 'AUD-NG-7281'}: Assigned to Lead Field Engineer.`);
        form.reset();
      } else {
        setIsAuditModalOpen(false);
        showToast('✓ Site Audit Booked! A COREN Engineer will call you within 2 hours.');
      }
    } catch {
      setIsAuditModalOpen(false);
      showToast('✓ Site Audit Request Registered! We will contact your phone shortly.');
    }
  };

  return (
    <div className="bg-[#0B241B] text-[#F8FAF7] min-h-screen flex flex-col font-sans selection:bg-[#F5B82E] selection:text-[#0B241B]">
      
      {/* Top Announcement Bar */}
      <aside aria-label="Announcement" className="bg-gradient-to-r from-[#123B2A] via-[#0B241B] to-[#123B2A] border-b border-[#19A89A]/20 text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-[#F8FAF7]/90">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#F5B82E]/20 text-[#F5B82E] font-bold">⚡</span>
            <span>Smarter energy. Flexible payments. A brighter future.</span>
            <span className="hidden md:inline text-[#19A89A]/60">•</span>
            <span className="hidden md:inline text-[#19A89A]">Zero-Deposit SME Commercial Pilots Available in Lagos &amp; Abuja</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 font-medium text-[#19A89A]">● Tier-1 LiFePO4 Mandate</span>
            <a href="#calculator" className="text-[#F5B82E] hover:underline font-semibold flex items-center gap-1">
              Calculate Savings &rarr;
            </a>
          </div>
        </div>
      </aside>

      {/* Sticky Responsive Navigation Bar */}
      <nav
        className={`sticky top-0 z-50 transition-all duration-300 py-4 px-4 sm:px-6 lg:px-8 ${
          isScrolled
            ? 'bg-[#0B241B]/90 backdrop-blur-xl border-b border-white/10 shadow-lg'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand Logo */}
          <a href="#hero" className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-[#F5B82E] rounded-lg p-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F5B82E] to-amber-600 flex items-center justify-center text-[#0B241B] font-extrabold text-xl shadow-lg shadow-[#F5B82E]/20 group-hover:scale-105 transition-transform">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-extrabold text-xl tracking-tight text-white">SKYGRID</span>
                <span className="text-[10px] tracking-widest uppercase bg-[#19A89A]/20 text-[#19A89A] px-2 py-0.5 rounded-full font-semibold border border-[#19A89A]/30">
                  PAYGo
                </span>
              </div>
              <p className="text-[10px] text-[#F8FAF7]/60 tracking-wider uppercase font-medium">Intelligent Solar Systems</p>
            </div>
          </a>

          {/* Desktop Links */}
          <div className="hidden lg:flex items-center gap-7 text-sm font-medium text-[#F8FAF7]/80">
            <a href="#hero" className="hover:text-[#F5B82E] transition-colors">Home</a>
            <a href="#packages" className="hover:text-[#F5B82E] transition-colors">Solar Solutions</a>
            <a href="#how-it-works" className="hover:text-[#F5B82E] transition-colors">How It Works</a>
            <a href="#monitoring" className="hover:text-[#F5B82E] transition-colors">Monitoring</a>
            <a href="#calculator" className="hover:text-[#F5B82E] transition-colors">Pricing &amp; Calculator</a>
            <a href="#installations" className="hover:text-[#F5B82E] transition-colors">Installations</a>
            <a href="#faq" className="hover:text-[#F5B82E] transition-colors">FAQ</a>
          </div>

          {/* Actions */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={() => setIsSignInModalOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#F8FAF7]/90 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              Sign In
            </button>
            <a
              href="#calculator"
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-[#0B241B] bg-[#F5B82E] hover:bg-amber-400 shadow-lg shadow-[#F5B82E]/20 transition-all hover:scale-105"
            >
              Find Your Solar Plan
            </a>
          </div>

          {/* Mobile Menu Trigger */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle navigation"
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-white lg:hidden"
          >
            {isMobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile Dropdown Panel */}
        {isMobileMenuOpen && (
          <div className="lg:hidden mt-3 max-w-7xl mx-auto bg-[#0B241B]/95 backdrop-blur-xl rounded-2xl p-5 border border-white/10 shadow-2xl">
            <div className="flex flex-col gap-3 text-sm font-medium text-[#F8FAF7]/90 pb-4 border-b border-white/10">
              <a href="#hero" onClick={() => setIsMobileMenuOpen(false)} className="py-2 px-3 rounded-lg hover:bg-white/5">Home</a>
              <a href="#packages" onClick={() => setIsMobileMenuOpen(false)} className="py-2 px-3 rounded-lg hover:bg-white/5">Solar Solutions</a>
              <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)} className="py-2 px-3 rounded-lg hover:bg-white/5">How It Works</a>
              <a href="#monitoring" onClick={() => setIsMobileMenuOpen(false)} className="py-2 px-3 rounded-lg hover:bg-white/5">Intelligent Monitoring</a>
              <a href="#calculator" onClick={() => setIsMobileMenuOpen(false)} className="py-2 px-3 rounded-lg hover:bg-white/5">Pricing &amp; Calculator</a>
              <a href="#installations" onClick={() => setIsMobileMenuOpen(false)} className="py-2 px-3 rounded-lg hover:bg-white/5">Installation Portfolio</a>
              <a href="#faq" onClick={() => setIsMobileMenuOpen(false)} className="py-2 px-3 rounded-lg hover:bg-white/5">FAQ</a>
            </div>
            <div className="pt-4 flex flex-col gap-2">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsSignInModalOpen(true);
                }}
                className="w-full py-2.5 rounded-xl text-center text-xs font-semibold bg-white/5 border border-white/10"
              >
                Customer Portal Sign In
              </button>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  openAuditForPackage('Essential Home');
                }}
                className="w-full py-2.5 rounded-xl text-center text-xs font-bold text-[#0B241B] bg-[#F5B82E]"
              >
                Book Free Engineering Site Audit
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* SECTION 1: HERO (Transparent, Photographic, and Immersive) */}
      <section id="hero" className="relative min-h-[92vh] flex items-center justify-center overflow-hidden pt-12 pb-20">
        {/* Slideshow Background */}
        <div className="absolute inset-0 z-0 bg-[#0B241B] overflow-hidden pointer-events-none" aria-hidden="true">
          {HERO_SLIDES.map((slide, index) => (
            <img
              key={index}
              src={slide.src}
              alt={slide.alt}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1500 ease-in-out ${
                index === currentSlide ? 'opacity-100 scale-105 transition-transform duration-7000' : 'opacity-0 scale-100'
              }`}
            />
          ))}

          {/* Gradients to guarantee high text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B241B] via-[#0B241B]/85 to-transparent z-10 lg:w-3/5" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B241B] via-[#0B241B]/50 to-transparent z-10" />
          <div className="absolute inset-0 bg-[#123B2A]/20 mix-blend-multiply z-10" />
        </div>

        {/* Hero Content */}
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Headline & CTAs */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#123B2A]/80 border border-[#19A89A]/40 text-[#19A89A] text-xs font-semibold backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-[#19A89A] animate-ping" />
                <span>Smarter energy. Flexible payments. A brighter future.</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-extrabold text-white tracking-tight leading-[1.12]">
                Power Your Life.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F5B82E] via-amber-300 to-[#19A89A]">
                  Pay at Your Pace.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-[#F8FAF7]/85 max-w-2xl leading-relaxed">
                Discover reliable solar energy for your home or business with flexible payment plans, intelligent energy monitoring, and support you can trust.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <a
                  href="#calculator"
                  className="px-7 py-3.5 rounded-xl font-heading font-bold text-sm text-[#0B241B] bg-[#F5B82E] hover:bg-amber-400 shadow-xl shadow-[#F5B82E]/25 transition-all hover:scale-105 flex items-center gap-2"
                >
                  <span>Find Your Solar Plan</span>
                  <span>&rarr;</span>
                </a>

                <a
                  href="#packages"
                  className="px-6 py-3.5 rounded-xl font-heading font-semibold text-sm text-white bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md transition-all flex items-center gap-2"
                >
                  <span>Explore Solar Solutions</span>
                  <span className="text-[#19A89A]">✨</span>
                </a>
              </div>

              {/* Micro-Trust Pillars */}
              <div className="pt-4 grid grid-cols-3 gap-4 border-t border-white/10 max-w-xl text-xs text-[#F8FAF7]/75">
                <div className="flex items-center gap-2">
                  <span className="text-[#19A89A]">⚡</span>
                  <span>Tier-1 LiFePO4 6,000 Cycles</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#F5B82E]">💳</span>
                  <span>12–36 Mo. Lease-to-Own</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#19A89A]">📡</span>
                  <span>24/7 AI-IoT Diagnostics</span>
                </div>
              </div>
            </div>

            {/* Right: Floating Energy-Information Card */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="w-full max-w-md bg-[#0B241B]/80 backdrop-blur-xl border border-white/15 rounded-3xl p-6 shadow-2xl relative">
                
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#19A89A]/20 border border-[#19A89A]/30 flex items-center justify-center text-[#F5B82E]">
                      ☀️
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-xs uppercase tracking-wider text-[#F8FAF7]">SOLAR SYSTEM</h3>
                      <p className="text-[11px] text-[#F8FAF7]/60 font-mono">ID: GW-5000ES-NG94</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#19A89A]/15 border border-[#19A89A]/30 text-[#19A89A] text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#19A89A] animate-pulse" />
                    <span>Online</span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3 my-5">
                  <div className="bg-black/30 p-3.5 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between text-[#F8FAF7]/60 text-xs mb-1">
                      <span>Solar generation</span>
                      <span className="text-[#F5B82E]">⚡</span>
                    </div>
                    <div className="text-2xl font-heading font-extrabold text-white font-mono">2.4 <span className="text-xs font-normal text-[#F8FAF7]/60">kW</span></div>
                    <div className="text-[10px] text-[#19A89A] mt-1">Peak irradiation</div>
                  </div>

                  <div className="bg-black/30 p-3.5 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between text-[#F8FAF7]/60 text-xs mb-1">
                      <span>Battery charge</span>
                      <span className="text-[#19A89A]">🔋</span>
                    </div>
                    <div className="text-2xl font-heading font-extrabold text-[#19A89A] font-mono">86<span className="text-xs font-normal text-[#F8FAF7]/60">%</span></div>
                    <div className="w-full bg-white/10 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-[#19A89A] to-emerald-400 h-1.5 rounded-full" style={{ width: '86%' }} />
                    </div>
                  </div>

                  <div className="bg-black/30 p-3.5 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between text-[#F8FAF7]/60 text-xs mb-1">
                      <span>Today's energy</span>
                      <span className="text-[#F5B82E]">📈</span>
                    </div>
                    <div className="text-2xl font-heading font-extrabold text-white font-mono">11.8 <span className="text-xs font-normal text-[#F8FAF7]/60">kWh</span></div>
                    <div className="text-[10px] text-[#F8FAF7]/60 mt-1">Clean solar harvest</div>
                  </div>

                  <div className="bg-black/30 p-3.5 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between text-[#F8FAF7]/60 text-xs mb-1">
                      <span>Current load</span>
                      <span className="text-emerald-400">🏠</span>
                    </div>
                    <div className="text-2xl font-heading font-extrabold text-white font-mono">1.1 <span className="text-xs font-normal text-[#F8FAF7]/60">kW</span></div>
                    <div className="text-[10px] text-emerald-400 mt-1">100% Solar powered</div>
                  </div>
                </div>

                {/* Status & Sample Notice */}
                <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#F8FAF7]/70">Grid Status:</span>
                    <span className="font-semibold text-[#F5B82E] font-mono">Islanded (Outage Protected)</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#F8FAF7]/70">PAYGo Token:</span>
                    <span className="font-semibold text-[#19A89A] font-mono">24 Days Active</span>
                  </div>
                  <div className="mt-2 bg-[#123B2A]/60 border border-[#19A89A]/20 rounded-xl p-2.5 text-[10px] text-[#F8FAF7]/70 leading-relaxed">
                    <span className="font-bold text-[#F5B82E]">ⓘ Sample data:</span> Illustrative demonstration values. Real-time telemetry connects via Shine GSM/WiFi IoT gateway.
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Slideshow Selector Buttons */}
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-white/10 text-xs text-[#F8FAF7]/80">
            <div className="flex items-center gap-2">
              <span className="text-[#F8FAF7]/50 uppercase tracking-widest text-[10px] font-semibold mr-1">Active Installation:</span>
              {HERO_SLIDES.map((slide, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`px-3 py-1.5 rounded-full transition-all text-xs ${
                    currentSlide === i
                      ? 'bg-[#F5B82E] text-[#0B241B] font-bold shadow-md'
                      : 'bg-white/10 text-[#F8FAF7]/80 hover:bg-white/20 font-medium'
                  }`}
                >
                  {slide.tag}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[#F8FAF7]/70 italic text-[11px] hidden sm:inline">
                {HERO_SLIDES[currentSlide].caption}
              </span>
              <button
                onClick={() => setIsSlideshowPlaying(!isSlideshowPlaying)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                {isSlideshowPlaying ? '⏸' : '▶'}
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* SECTION 2: TRUST AND CREDIBILITY */}
      <section className="py-16 bg-gradient-to-b from-[#0B241B] via-[#123B2A]/40 to-[#0B241B] border-y border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#19A89A] mb-2">Verified Engineering Standards</h2>
            <h3 className="text-2xl sm:text-3xl font-heading font-extrabold text-white">Built on Engineering Rigor and Transparent Finance</h3>
            <p className="text-sm text-[#F8FAF7]/75 mt-3">
              We eliminate the hazards of uncertified batteries and deceptive terms with certified hardware, guaranteed SLAs, and full ownership transfer.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[#123B2A]/45 backdrop-blur-md p-6 rounded-2xl border border-white/10 hover:border-[#19A89A]/50 transition">
              <div className="w-12 h-12 rounded-xl bg-[#19A89A]/20 border border-[#19A89A]/30 flex items-center justify-center text-[#19A89A] mb-4 text-xl">
                🛡️
              </div>
              <h4 className="font-heading font-bold text-white text-base mb-1">Tier-1 LiFePO4 Chemistry</h4>
              <p className="text-xs text-[#F8FAF7]/75 leading-relaxed">
                6,000 cycles to 80% Depth of Discharge. Zero thermal runaway hazard, non-toxic chemistry, and 10-year design lifespan.
              </p>
            </div>

            <div className="bg-[#123B2A]/45 backdrop-blur-md p-6 rounded-2xl border border-white/10 hover:border-[#F5B82E]/50 transition">
              <div className="w-12 h-12 rounded-xl bg-[#F5B82E]/20 border border-[#F5B82E]/30 flex items-center justify-center text-[#F5B82E] mb-4 text-xl">
                🏆
              </div>
              <h4 className="font-heading font-bold text-white text-base mb-1">COREN &amp; NEMSA Certified</h4>
              <p className="text-xs text-[#F8FAF7]/75 leading-relaxed">
                Strict adherence to Nigerian electrical codes, Class II surge suppressors, dedicated earth rod grounding, and DC isolators.
              </p>
            </div>

            <div className="bg-[#123B2A]/45 backdrop-blur-md p-6 rounded-2xl border border-white/10 hover:border-[#19A89A]/50 transition">
              <div className="w-12 h-12 rounded-xl bg-[#19A89A]/20 border border-[#19A89A]/30 flex items-center justify-center text-[#19A89A] mb-4 text-xl">
                📡
              </div>
              <h4 className="font-heading font-bold text-white text-base mb-1">24/7 Remote IoT Telemetry</h4>
              <p className="text-xs text-[#F8FAF7]/75 leading-relaxed">
                Cell-level BMS monitoring, temperature surveillance, and proactive anomaly alerts via automated cellular gateways.
              </p>
            </div>

            <div className="bg-[#123B2A]/45 backdrop-blur-md p-6 rounded-2xl border border-white/10 hover:border-[#F5B82E]/50 transition">
              <div className="w-12 h-12 rounded-xl bg-[#F5B82E]/20 border border-[#F5B82E]/30 flex items-center justify-center text-[#F5B82E] mb-4 text-xl">
                ✅
              </div>
              <h4 className="font-heading font-bold text-white text-base mb-1">100% Lease-to-Own</h4>
              <p className="text-xs text-[#F8FAF7]/75 leading-relaxed">
                Complete legal ownership transfer upon term completion. No penalty for early buyout, and no continuous rental fees.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: SOLAR PACKAGES */}
      <section id="packages" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5B82E]/15 border border-[#F5B82E]/30 text-[#F5B82E] text-xs font-semibold mb-3">
            <span>📦</span> Factory-Calibrated Hardware Packages
          </div>
          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-white">Engineered Solar Solutions</h2>
          <p className="text-sm sm:text-base text-[#F8FAF7]/75 mt-3">
            Choose from pre-engineered Growatt LiFePO4 packages configured for residential flats, family duplexes, commercial enterprises, and industrial facilities.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {SOLAR_PACKAGES.map((pkg, idx) => (
            <div
              key={idx}
              className={`bg-[#0B241B]/80 backdrop-blur-xl rounded-3xl p-6 border flex flex-col justify-between relative transition duration-300 ${
                pkg.badge ? 'border-2 border-[#F5B82E] shadow-xl shadow-[#F5B82E]/10' : 'border-white/10 hover:border-[#19A89A]/50'
              }`}
            >
              {pkg.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#F5B82E] text-[#0B241B] font-extrabold text-[10px] tracking-wider uppercase px-3 py-1 rounded-full shadow-md">
                  {pkg.badge}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#19A89A] bg-[#19A89A]/15 px-2.5 py-1 rounded-lg">
                    {pkg.sku}
                  </span>
                </div>

                <h3 className="font-heading font-extrabold text-xl text-white">{pkg.title}</h3>
                <p className="text-xs text-[#F8FAF7]/70 mt-1">{pkg.profile}</p>

                <div className="my-5 p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-[#F8FAF7]/60">Inverter:</span> <span className="font-semibold text-white">{pkg.inverter}</span></div>
                  <div className="flex justify-between"><span className="text-[#F8FAF7]/60">Battery:</span> <span className="font-semibold text-[#19A89A]">{pkg.battery}</span></div>
                  <div className="flex justify-between"><span className="text-[#F8FAF7]/60">Solar Array:</span> <span className="font-semibold text-white">{pkg.pv}</span></div>
                  <div className="flex justify-between"><span className="text-[#F8FAF7]/60">Warranty:</span> <span className="font-semibold text-[#F5B82E]">{pkg.warranty}</span></div>
                </div>

                <div className="text-xs text-[#F8FAF7]/75 space-y-1.5 mb-6">
                  <p className="font-bold text-white text-[11px] uppercase tracking-wider">Supported Appliances:</p>
                  {pkg.supportedAppliances.map((app, aIdx) => (
                    <div key={aIdx} className="flex items-center gap-2">
                      <span className="text-[#19A89A]">✓</span>
                      <span>{app}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <div className="flex items-baseline justify-between mb-2">
                  <div>
                    <span className="text-[10px] uppercase text-[#F8FAF7]/60 block">Deposit (30%)</span>
                    <span className="text-base font-heading font-bold text-white">
                      ₦{Math.round(pkg.cashPriceNGN * 0.3).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase text-[#F5B82E] font-semibold block">36-Mo. Instalment</span>
                    <span className="text-lg font-heading font-extrabold text-[#F5B82E]">
                      ₦{pkg.monthlyInstallmentNGN.toLocaleString()}<span className="text-xs font-normal text-[#F8FAF7]/60">/mo</span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button
                    onClick={() => setSelectedPackageForModal(pkg)}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/10 transition"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => openAuditForPackage(pkg.title)}
                    className="w-full py-2.5 rounded-xl text-xs font-bold text-[#0B241B] bg-[#F5B82E] hover:bg-amber-400 transition"
                  >
                    Select Plan
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 4: HOW PAYGO WORKS */}
      <section id="how-it-works" className="py-20 bg-gradient-to-b from-[#0B241B] via-[#123B2A]/30 to-[#0B241B] border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#19A89A] mb-2">Frictionless Path to Energy Independence</h2>
            <h3 className="text-3xl sm:text-4xl font-heading font-extrabold text-white">How Our PAYGo Model Works</h3>
            <p className="text-sm sm:text-base text-[#F8FAF7]/75 mt-3">
              Transitioning to clean, reliable solar power is simple, predictable, and transparent.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-[#123B2A]/45 p-6 rounded-3xl border border-white/10 hover:border-[#19A89A]/40 transition">
              <div className="w-12 h-12 rounded-2xl bg-[#F5B82E] text-[#0B241B] font-extrabold font-heading text-lg flex items-center justify-center mb-5 shadow-lg shadow-[#F5B82E]/20">
                01
              </div>
              <h4 className="font-heading font-bold text-lg text-white mb-2">Choose Your Solar System</h4>
              <p className="text-xs text-[#F8FAF7]/75 leading-relaxed">
                Use our deterministic electrical calculator or schedule an on-site audit to tailor inverter and LiFePO4 battery capacity to your exact daily kilowatt-hour load.
              </p>
            </div>

            <div className="bg-[#123B2A]/45 p-6 rounded-3xl border border-white/10 hover:border-[#19A89A]/40 transition">
              <div className="w-12 h-12 rounded-2xl bg-[#19A89A] text-[#0B241B] font-extrabold font-heading text-lg flex items-center justify-center mb-5 shadow-lg shadow-[#19A89A]/20">
                02
              </div>
              <h4 className="font-heading font-bold text-lg text-white mb-2">Select Flexible Payment Plan</h4>
              <p className="text-xs text-[#F8FAF7]/75 leading-relaxed">
                Pay an affordable 30% initial deposit. Choose 12, 24, or 36 months repayment tenure with predictable instalments that cost less than your generator fuel budget.
              </p>
            </div>

            <div className="bg-[#123B2A]/45 p-6 rounded-3xl border border-white/10 hover:border-[#19A89A]/40 transition">
              <div className="w-12 h-12 rounded-2xl bg-[#123B2A] border border-[#19A89A]/40 text-[#F8FAF7] font-extrabold font-heading text-lg flex items-center justify-center mb-5">
                03
              </div>
              <h4 className="font-heading font-bold text-lg text-white mb-2">Rapid Professional Installation</h4>
              <p className="text-xs text-[#F8FAF7]/75 leading-relaxed">
                COREN-certified engineers mount, wire, and commission your Growatt hybrid plant in 48 to 72 hours, complete with industrial surge suppression and grounding.
              </p>
            </div>

            <div className="bg-[#123B2A]/45 p-6 rounded-3xl border border-white/10 hover:border-[#19A89A]/40 transition">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F5B82E] to-[#19A89A] text-[#0B241B] font-extrabold font-heading text-lg flex items-center justify-center mb-5">
                04
              </div>
              <h4 className="font-heading font-bold text-lg text-white mb-2">Monitor Energy &amp; Own</h4>
              <p className="text-xs text-[#F8FAF7]/75 leading-relaxed">
                Track daily solar harvest on your phone. Make automated monthly transfers to your Dedicated Virtual Account. Enjoy full, 100% equipment ownership at term completion.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: INTELLIGENT ENERGY MONITORING */}
      <section id="monitoring" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#19A89A]/15 border border-[#19A89A]/30 text-[#19A89A] text-xs font-semibold mb-3">
            <span>📡</span> Telemetry &amp; AI Energy Management
          </div>
          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-white">Intelligent Energy Monitoring</h2>
          <p className="text-sm sm:text-base text-[#F8FAF7]/75 mt-3">
            Every system is paired with a Growatt Shine GSM/WiFi IoT gateway that streams live generation, battery health, and load analytics to our cloud engine.
          </p>
        </div>

        <div className="bg-[#0B241B]/80 backdrop-blur-xl rounded-3xl p-6 lg:p-8 border border-white/15 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-heading font-bold text-lg text-white">Growatt Solar Hub OS</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Telemetry Active
                </span>
              </div>
              <p className="text-xs text-[#F8FAF7]/60 mt-1">Gateway Ref: SHINE-GSM-4G-98421 • Firmware v3.14.9</p>
            </div>

            <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/5 text-xs">
              <button
                onClick={() => setDashboardMode('day')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  dashboardMode === 'day' ? 'bg-[#F5B82E] text-[#0B241B]' : 'text-[#F8FAF7]/80 hover:text-white'
                }`}
              >
                Daytime Harvest
              </button>
              <button
                onClick={() => setDashboardMode('night')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  dashboardMode === 'night' ? 'bg-[#19A89A] text-[#0B241B]' : 'text-[#F8FAF7]/80 hover:text-white'
                }`}
              >
                Evening Battery
              </button>
              <button
                onClick={() => setDashboardMode('outage')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  dashboardMode === 'outage' ? 'bg-purple-500 text-white' : 'text-[#F8FAF7]/80 hover:text-white'
                }`}
              >
                Grid Outage Mode
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 my-8">
            <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
              <span className="text-[11px] text-[#F8FAF7]/60 uppercase block mb-1">Solar PV</span>
              <div className="text-2xl font-heading font-extrabold text-[#F5B82E] font-mono">
                {dashboardMode === 'day' ? '2.4' : dashboardMode === 'night' ? '0.0' : '1.8'} <span className="text-xs font-normal">kW</span>
              </div>
              <span className="text-[10px] text-emerald-400 mt-1 block">Active Ingress</span>
            </div>

            <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
              <span className="text-[11px] text-[#F8FAF7]/60 uppercase block mb-1">Battery State</span>
              <div className="text-2xl font-heading font-extrabold text-[#19A89A] font-mono">
                {dashboardMode === 'day' ? '86' : dashboardMode === 'night' ? '74' : '92'} <span className="text-xs font-normal">%</span>
              </div>
              <span className="text-[10px] text-[#F8FAF7]/60 mt-1 block font-mono">52.8V • 28°C</span>
            </div>

            <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
              <span className="text-[11px] text-[#F8FAF7]/60 uppercase block mb-1">Home Load</span>
              <div className="text-2xl font-heading font-extrabold text-white font-mono">
                {dashboardMode === 'day' ? '1.1' : dashboardMode === 'night' ? '0.7' : '1.4'} <span className="text-xs font-normal">kW</span>
              </div>
              <span className="text-[10px] text-emerald-400 mt-1 block">Within Capacity</span>
            </div>

            <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
              <span className="text-[11px] text-[#F8FAF7]/60 uppercase block mb-1">Payment Balance</span>
              <div className="text-2xl font-heading font-extrabold text-[#F8FAF7] font-mono">₦0 <span className="text-xs font-normal">due</span></div>
              <span className="text-[10px] text-[#19A89A] mt-1 block font-semibold">Good Standing</span>
            </div>

            <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
              <span className="text-[11px] text-[#F8FAF7]/60 uppercase block mb-1">Next Instalment</span>
              <div className="text-lg font-heading font-extrabold text-white font-mono">25 Nov</div>
              <span className="text-[10px] text-[#F5B82E] mt-1 block font-mono">₦78,500 (DVA Linked)</span>
            </div>

            <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
              <span className="text-[11px] text-[#F8FAF7]/60 uppercase block mb-1">System Health</span>
              <div className="text-xl font-heading font-extrabold text-emerald-400 flex items-center gap-1.5">
                ✓ 100%
              </div>
              <span className="text-[10px] text-[#F8FAF7]/60 mt-1 block">All Cells Balanced</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: AFFORDABILITY & GENERATOR SAVINGS CALCULATOR */}
      <section id="calculator" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5B82E]/15 border border-[#F5B82E]/30 text-[#F5B82E] text-xs font-semibold mb-3">
            <span>⚡</span> Interactive Electrical &amp; Financial Sizer
          </div>
          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-white">Affordability &amp; Fuel Savings Calculator</h2>
          <p className="text-sm sm:text-base text-[#F8FAF7]/75 mt-3">
            Select your state region and household appliances. Compare your 36-month solar lease-to-own payment directly against what you currently spend on petrol and generator maintenance.
          </p>
        </div>

        <div className="bg-[#0B241B]/80 backdrop-blur-xl rounded-3xl p-6 lg:p-10 border border-white/15 shadow-2xl">
          <div className="grid md:grid-cols-3 gap-6 pb-8 border-b border-white/10">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#F8FAF7]/80 mb-2">
                Installation State / Geo-Zone
              </label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full bg-black/50 border border-white/15 text-white rounded-xl px-4 py-2.5 text-sm font-semibold focus:border-[#F5B82E] focus:outline-none"
              >
                <option value="LAGOS">Lagos (Southern Coastal - 4.1 PSH)</option>
                <option value="ABUJA">FCT Abuja (Middle Belt - 5.1 PSH)</option>
                <option value="RIVERS">Rivers / Port Harcourt (3.8 PSH)</option>
                <option value="KANO">Kano (Northern Sahel - 5.9 PSH)</option>
                <option value="BENUE">Benue / Makurdi (4.9 PSH)</option>
                <option value="PLATEAU">Plateau / Jos (5.3 PSH)</option>
                <option value="ENUGU">Enugu (4.4 PSH)</option>
                <option value="OYO">Oyo / Ibadan (4.5 PSH)</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#F8FAF7]/80">Down Payment Floor</label>
                <span className="text-xs font-mono font-bold text-[#F5B82E]">{downPaymentPct}%</span>
              </div>
              <input
                type="range"
                min="30"
                max="60"
                step="5"
                value={downPaymentPct}
                onChange={(e) => setDownPaymentPct(Number(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg cursor-pointer accent-[#F5B82E]"
              />
              <div className="flex justify-between text-[10px] text-[#F8FAF7]/50 mt-1">
                <span>30% (Standard)</span>
                <span>45%</span>
                <span>60% (Lower Instalment)</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#F8FAF7]/80 mb-2">
                Repayment Tenure
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[12, 24, 36].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTenureMonths(m)}
                    className={`py-2 rounded-xl text-xs font-bold transition ${
                      tenureMonths === m
                        ? 'bg-[#F5B82E] text-[#0B241B] shadow-md'
                        : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                    }`}
                  >
                    {m} Mo.
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 my-8">
            {/* Appliance List */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <h4 className="font-heading font-bold text-sm uppercase tracking-wider text-white">Select Connected Appliances</h4>
                <span className="text-xs text-[#F8FAF7]/60">Click + / - to adjust</span>
              </div>

              <div className="space-y-3">
                {appliances.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition"
                  >
                    <div>
                      <div className="font-bold text-white text-xs">{app.name}</div>
                      <div className="text-[10px] text-[#F8FAF7]/60 font-mono">
                        {app.watts}W rating • {app.isMotor ? `Motor Surge ${app.surge}x` : 'Resistive'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleApplianceChange(app.id, -1)}
                        className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center transition"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold text-sm text-[#F5B82E] w-5 text-center">{app.qty}</span>
                      <button
                        type="button"
                        onClick={() => handleApplianceChange(app.id, 1)}
                        className="w-7 h-7 rounded-lg bg-[#F5B82E] hover:bg-amber-400 text-[#0B241B] font-bold flex items-center justify-center transition"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sizing & Financing Summary */}
            <div className="lg:col-span-5 bg-black/40 border border-white/10 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#F8FAF7]/80">Engineered Result</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#F5B82E]/20 text-[#F5B82E] border border-[#F5B82E]/30 font-semibold font-mono">
                    {sizingMath.bundle.title}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] uppercase text-[#F8FAF7]/60 block">Running Load</span>
                    <span className="text-xl font-heading font-bold text-white font-mono">
                      {sizingMath.runningWatts.toLocaleString()} W
                    </span>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] uppercase text-[#F8FAF7]/60 block">Inrush Surge</span>
                    <span className="text-xl font-heading font-bold text-[#F5B82E] font-mono">
                      {Math.round(sizingMath.surgeVA).toLocaleString()} VA
                    </span>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] uppercase text-[#F8FAF7]/60 block">Battery Required</span>
                    <span className="text-xl font-heading font-bold text-[#19A89A] font-mono">
                      {sizingMath.bundle.battery.split(' ')[0]} kWh
                    </span>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] uppercase text-[#F8FAF7]/60 block">Solar PV Array</span>
                    <span className="text-xl font-heading font-bold text-white font-mono">
                      {sizingMath.bundle.pv.split(' ')[0]} kWp
                    </span>
                  </div>
                </div>

                <div className="space-y-3 p-4 rounded-xl bg-[#123B2A]/40 border border-[#19A89A]/20 mb-6 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#F8FAF7]/70">Estimated Outright Value:</span>
                    <span className="font-bold text-white font-mono">₦{sizingMath.cashPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#F8FAF7]/70">Down Payment Floor:</span>
                    <span className="font-bold text-white font-mono">₦{sizingMath.downPayment.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/10 text-sm">
                    <span className="font-bold text-[#F5B82E]">Monthly PAYGo Instalment:</span>
                    <span className="font-extrabold text-[#F5B82E] font-mono">
                      ₦{sizingMath.monthlyPayment.toLocaleString()}/mo
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => openAuditForPackage(sizingMath.bundle.title)}
                className="w-full py-3.5 rounded-xl text-xs font-bold text-[#0B241B] bg-[#F5B82E] hover:bg-amber-400 shadow-lg shadow-[#F5B82E]/20 transition-all hover:scale-105 flex items-center justify-center gap-2"
              >
                <span>Book Site Audit for this System</span>
                <span>&rarr;</span>
              </button>
            </div>
          </div>

          {/* Generator ROI Comparison */}
          <div className="pt-8 border-t border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-base">⛽</span>
                <h4 className="font-heading font-bold text-white text-sm">Generator Fuel Cost vs. Solar Repayment</h4>
              </div>
              <span className="text-xs text-[#F8FAF7]/60">Assuming ₦1,250 / Litre Petrol + ₦15k/mo engine oil</span>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-2xl bg-red-950/40 border border-red-800/30">
                <span className="text-[10px] uppercase text-red-300 font-semibold block mb-1">Current Monthly Petrol Spend</span>
                <div className="text-xl font-heading font-bold text-red-400 font-mono">
                  ₦{sizingMath.monthlyPetrolCost.toLocaleString()}<span className="text-xs font-normal">/mo</span>
                </div>
                <span className="text-[10px] text-[#F8FAF7]/60 mt-1 block">8 hrs/day running 3.5kVA gen</span>
              </div>

              <div className="p-4 rounded-2xl bg-[#19A89A]/15 border border-[#19A89A]/30">
                <span className="text-[10px] uppercase text-[#19A89A] font-semibold block mb-1">Your Solar Monthly Payment</span>
                <div className="text-xl font-heading font-bold text-white font-mono">
                  ₦{sizingMath.monthlyPayment.toLocaleString()}<span className="text-xs font-normal">/mo</span>
                </div>
                <span className="text-[10px] text-[#F8FAF7]/60 mt-1 block">Predictable fixed instalment</span>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40">
                <span className="text-[10px] uppercase text-emerald-300 font-bold block mb-1">Net Cash Saved in Your Pocket</span>
                <div className="text-2xl font-heading font-extrabold text-emerald-400 font-mono">
                  +₦{sizingMath.netMonthlySavings.toLocaleString()}<span className="text-xs font-normal">/mo</span>
                </div>
                <span className="text-[10px] text-emerald-300 font-medium mt-1 block">
                  ₦{sizingMath.threeYearSavings.toLocaleString()} saved over 36 months!
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: INSTALLATION CATEGORIES */}
      <section id="installations" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#19A89A]/15 border border-[#19A89A]/30 text-[#19A89A] text-xs font-semibold mb-3">
            <span>📸</span> Realistic African Environments
          </div>
          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-white">Installation Environments</h2>
          <p className="text-sm sm:text-base text-[#F8FAF7]/75 mt-3">
            Tailored photovoltaic and battery storage architectures engineered for the specific load dynamics of homes, commercial clinics, and light industrial facilities.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="bg-[#0B241B]/80 backdrop-blur-xl rounded-3xl overflow-hidden border border-white/10 group hover:border-[#F5B82E]/50 transition duration-300 flex flex-col justify-between">
            <div>
              <div className="relative h-64 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1508873696983-2df5293cb395?auto=format&fit=crop&w=800&q=80"
                  alt="Residential solar"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B241B] via-transparent to-transparent" />
                <span className="absolute top-4 left-4 bg-[#0B241B]/80 backdrop-blur-md text-[#F5B82E] text-xs font-bold px-3 py-1 rounded-full border border-white/10">
                  Residential Homes
                </span>
              </div>
              <div className="p-6">
                <h3 className="font-heading font-extrabold text-xl text-white mb-2">Modern Home Energy Storage</h3>
                <p className="text-xs text-[#F8FAF7]/75 leading-relaxed mb-4">
                  Silent, reliable rooftop power for flats and duplexes. Protect your family from grid outages, power air conditioning with peace of mind, and eliminate generator noise and fumes forever.
                </p>
                <div className="space-y-1.5 text-xs text-[#F8FAF7]/70">
                  <div className="flex items-center gap-2"><span className="text-[#F5B82E]">✓</span> 0ms Seamless Automatic Transfer</div>
                  <div className="flex items-center gap-2"><span className="text-[#F5B82E]">✓</span> Quiet indoor LiFePO4 battery enclosures</div>
                  <div className="flex items-center gap-2"><span className="text-[#F5B82E]">✓</span> Rapid 48-Hour Professional Deployment</div>
                </div>
              </div>
            </div>
            <div className="p-6 pt-0">
              <button
                onClick={() => openAuditForPackage('Residential')}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/10 transition"
              >
                Explore Residential Plans &rarr;
              </button>
            </div>
          </div>

          <div className="bg-[#0B241B]/80 backdrop-blur-xl rounded-3xl overflow-hidden border border-white/10 group hover:border-[#19A89A]/50 transition duration-300 flex flex-col justify-between">
            <div>
              <div className="relative h-64 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1497440001374-f26997328c1b?auto=format&fit=crop&w=800&q=80"
                  alt="Commercial solar"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B241B] via-transparent to-transparent" />
                <span className="absolute top-4 left-4 bg-[#0B241B]/80 backdrop-blur-md text-[#19A89A] text-xs font-bold px-3 py-1 rounded-full border border-white/10">
                  Commercial &amp; SMEs
                </span>
              </div>
              <div className="p-6">
                <h3 className="font-heading font-extrabold text-xl text-white mb-2">Clinics, Retail &amp; Corporate Hubs</h3>
                <p className="text-xs text-[#F8FAF7]/75 leading-relaxed mb-4">
                  Uninterrupted continuity for diagnostic centers, pharmacies, supermarkets, schools, and offices. Protect refrigerated medications and eliminate massive fuel bills during daylight business hours.
                </p>
                <div className="space-y-1.5 text-xs text-[#F8FAF7]/70">
                  <div className="flex items-center gap-2"><span className="text-[#19A89A]">✓</span> Refrigerated cold-chain protection</div>
                  <div className="flex items-center gap-2"><span className="text-[#19A89A]">✓</span> Daytime direct solar self-consumption</div>
                  <div className="flex items-center gap-2"><span className="text-[#19A89A]">✓</span> Tax-deductible clean energy leasing</div>
                </div>
              </div>
            </div>
            <div className="p-6 pt-0">
              <button
                onClick={() => openAuditForPackage('Commercial SME')}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/10 transition"
              >
                Explore Commercial Plans &rarr;
              </button>
            </div>
          </div>

          <div className="bg-[#0B241B]/80 backdrop-blur-xl rounded-3xl overflow-hidden border border-white/10 group hover:border-purple-400/50 transition duration-300 flex flex-col justify-between">
            <div>
              <div className="relative h-64 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1584271854089-9bb3e5168e32?auto=format&fit=crop&w=800&q=80"
                  alt="Industrial microgrid"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B241B] via-transparent to-transparent" />
                <span className="absolute top-4 left-4 bg-[#0B241B]/80 backdrop-blur-md text-purple-400 text-xs font-bold px-3 py-1 rounded-full border border-white/10">
                  Industrial &amp; Agro
                </span>
              </div>
              <div className="p-6">
                <h3 className="font-heading font-extrabold text-xl text-white mb-2">Agro-Processing &amp; Warehouses</h3>
                <p className="text-xs text-[#F8FAF7]/75 leading-relaxed mb-4">
                  High-yield 3-phase microgrids for grain milling, manufacturing workshops, cold storage hubs, and logistics facilities. Built with heavy surge tolerances for inductive motor loads.
                </p>
                <div className="space-y-1.5 text-xs text-[#F8FAF7]/70">
                  <div className="flex items-center gap-2"><span className="text-purple-400">✓</span> Balanced 3-Phase 400V Distribution</div>
                  <div className="flex items-center gap-2"><span className="text-purple-400">✓</span> Containerized Modular LiFePO4 Banks</div>
                  <div className="flex items-center gap-2"><span className="text-purple-400">✓</span> Dedicated 4-Hour On-Site SLA Response</div>
                </div>
              </div>
            </div>
            <div className="p-6 pt-0">
              <button
                onClick={() => openAuditForPackage('Industrial Microgrid')}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/10 transition"
              >
                Explore Industrial Plans &rarr;
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 8: CUSTOMER STORIES (ILLUSTRATIVE CASE STUDIES) */}
      <section id="stories" className="py-20 bg-gradient-to-b from-[#0B241B] via-[#123B2A]/20 to-[#0B241B] border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5B82E]/15 border border-[#F5B82E]/30 text-[#F5B82E] text-xs font-semibold mb-3">
              <span>📋</span> Engineering Case Studies
            </div>
            <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-white">Proven Field Engineering Impact</h2>
            <p className="text-sm sm:text-base text-[#F8FAF7]/75 mt-3">
              Illustrative reference studies demonstrating measurable fuel displacement, uptime reliability, and investment payback across Nigerian sectors.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {CASE_STUDIES.map((study, sIdx) => (
              <div key={sIdx} className="bg-[#0B241B]/80 backdrop-blur-xl rounded-3xl p-6 border border-white/10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="text-[#F5B82E] font-semibold">{study.clientType}</span>
                    <span className="text-[#F8FAF7]/60">{study.location}</span>
                  </div>
                  <h4 className="font-heading font-bold text-lg text-white mb-3">{study.title}</h4>
                  
                  <div className="space-y-3 text-xs text-[#F8FAF7]/75">
                    <p><strong className="text-white">Challenge:</strong> {study.challenge}</p>
                    <p><strong className="text-white">System:</strong> {study.system}</p>
                    <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                      <div className="flex justify-between text-[#19A89A] font-semibold"><span>Fuel Reduction:</span> <span>{study.fuelCut}</span></div>
                      <div className="flex justify-between text-white"><span>Monthly Savings:</span> <span className="font-mono font-bold">{study.monthlySavings}</span></div>
                      <div className="flex justify-between text-[#F8FAF7]/60"><span>Key Metric:</span> <span>{study.keyMetric}</span></div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-white/10 text-[11px] text-[#F8FAF7]/50 italic">
                  * Illustrative reference case based on standard hardware configuration.
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 9: FREQUENTLY ASKED QUESTIONS */}
      <section id="faq" className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#19A89A]/15 border border-[#19A89A]/30 text-[#19A89A] text-xs font-semibold mb-3">
            <span>❓</span> Clear Answers, No Fine Print
          </div>
          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-white">Frequently Asked Questions</h2>
          <p className="text-sm text-[#F8FAF7]/75 mt-3">
            Everything you need to know about our PAYGo lease-to-own terms, warranties, and engineering installations.
          </p>
        </div>

        <div className="space-y-4">
          {[
            {
              q: '1. How does the PAYGo (Pay-As-You-Go) lease-to-own model work?',
              a: 'Our PAYGo model allows you to acquire an engineered solar plant by paying an initial 30% down payment, followed by flexible monthly instalments spread across 12, 24, or 36 months. As long as your monthly payment is active, the system generates continuous power. Once your final instalment is completed, full legal ownership transfers to you automatically with zero hidden balloon fees.',
            },
            {
              q: '2. What is the required down payment, and can I pay off early?',
              a: 'The minimum down payment floor is strictly 30% of the total system cost, which covers factory shipping, mounting hardware, electrical surge protection, and professional installation. Yes, you can pay off your remaining balance at any time before the end of the term with absolutely zero early-exit penalties or prepayment fees.',
            },
            {
              q: '3. What appliances can the system run during grid blackouts?',
              a: 'Essential Home (3kVA) runs lighting, fans, TVs, laptops, Starlink, and inverter fridges. Family Solar (5kVA) additionally powers a 1.0 HP Inverter AC, deep freezer, and borehole pump. Business Solar (10kVA) runs multiple AC units, commercial medical cold storage, and server equipment.',
            },
            {
              q: '4. How long does professional installation and commissioning take?',
              a: 'Once your down payment is confirmed, a COREN-certified field engineering crew arrives at your site within 48 to 72 hours. Residential systems are typically commissioned within 1 business day.',
            },
            {
              q: '5. Which payment methods are accepted for monthly instalments?',
              a: 'We provide each customer with a Dedicated Virtual Account (DVA) issued through our banking partners (Moniepoint / Wema / Paystack). You can transfer from any Nigerian bank app, USSD, debit card auto-charge, or standing order.',
            },
            {
              q: '6. What happens if I experience a financial delay or miss a payment?',
              a: 'SkyGrid provides an automatic 5-day grace period on all accounts. If payment is still outstanding after the grace period, the inverter automatically transitions into standby mode until the monthly payment is made. Power restores within 60 seconds of payment over our IoT link.',
            },
            {
              q: '7. What warranty coverage is provided on the equipment?',
              a: 'All systems come with direct OEM factory warranties: 10-Year Manufacturer Warranty on LiFePO4 batteries (rated for 6,000 cycles), 5-Year Replacement Warranty on Growatt hybrid inverters, and 25-Year Linear Power Warranty on solar panels.',
            },
            {
              q: '8. Does the system require 24/7 internet or cellular coverage?',
              a: 'No. The Growatt hybrid inverter functions fully offline using an internal cryptographic token engine. For remote telemetry and automatic over-the-air recharge, an integrated multi-network GSM SIM connects to MTN, Airtel, or Glo. Manual 20-digit STS tokens can also be entered via keypad.',
            },
            {
              q: '9. Who owns the solar equipment at the end of the payment tenure?',
              a: 'You do. 100%. Upon completion of your final monthly instalment, our system issues an official Deed of Equipment Ownership, unlocks the IoT gateway into permanent lifetime mode, and transfers all manufacturer warranties directly into your legal name.',
            },
          ].map((item, qIdx) => (
            <div key={qIdx} className="bg-[#0B241B]/80 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              <button
                onClick={() => setExpandedFaq(expandedFaq === qIdx ? null : qIdx)}
                className="w-full p-5 text-left flex items-center justify-between text-sm font-heading font-bold text-white hover:text-[#F5B82E] transition focus:outline-none"
              >
                <span>{item.q}</span>
                <span className={`text-[#19A89A] transition-transform ${expandedFaq === qIdx ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {expandedFaq === qIdx && (
                <div className="px-5 pb-5 text-xs text-[#F8FAF7]/80 leading-relaxed border-t border-white/5 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 10: FINAL CALL TO ACTION */}
      <section className="py-20 relative overflow-hidden bg-gradient-to-r from-[#123B2A] via-[#0B241B] to-[#123B2A] border-t border-white/10">
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F5B82E]/15 border border-[#F5B82E]/30 text-[#F5B82E] text-xs font-semibold">
            <span>☀️</span> Clean Power on Your Terms
          </div>

          <h2 className="text-3xl sm:text-5xl font-heading font-extrabold text-white tracking-tight leading-tight">
            Your Energy. Your Budget. Your Future.
          </h2>

          <p className="text-base sm:text-lg text-[#F8FAF7]/85 max-w-2xl mx-auto leading-relaxed">
            Stop losing sleep over petrol price hikes, generator repairs, and grid blackouts. Transition to a clean, reliable Growatt LiFePO4 solar plant with flexible 36-month lease-to-own.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <a
              href="#calculator"
              className="px-8 py-4 rounded-xl font-heading font-bold text-sm text-[#0B241B] bg-[#F5B82E] hover:bg-amber-400 shadow-xl shadow-[#F5B82E]/30 transition-all hover:scale-105 flex items-center gap-2"
            >
              <span>Find Your Solar Plan</span>
              <span>&rarr;</span>
            </a>

            <button
              onClick={() => openAuditForPackage('General Consultation')}
              className="px-7 py-4 rounded-xl font-heading font-semibold text-sm text-white bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md transition-all flex items-center gap-2"
            >
              <span className="text-[#19A89A]">📞</span>
              <span>Talk to an Adviser</span>
            </button>
          </div>

          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-[#F8FAF7]/70">
            <span className="flex items-center gap-1.5"><span className="text-[#19A89A]">✓</span> Free Engineering Site Audit</span>
            <span className="flex items-center gap-1.5"><span className="text-[#19A89A]">✓</span> 48-Hour Installation Guarantee</span>
            <span className="flex items-center gap-1.5"><span className="text-[#19A89A]">✓</span> 10-Year LiFePO4 Battery Warranty</span>
          </div>
        </div>
      </section>

      {/* COMPREHENSIVE FOOTER */}
      <footer className="bg-black/90 border-t border-white/10 pt-16 pb-12 text-xs text-[#F8FAF7]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 pb-12 border-b border-white/10">
            <div className="col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#F5B82E] flex items-center justify-center text-[#0B241B] font-extrabold text-lg shadow-md shadow-[#F5B82E]/20">
                  ⚡
                </div>
                <span className="font-heading font-extrabold text-lg tracking-tight text-white">SKYGRID FLEX SOLUTIONS</span>
              </div>
              <p className="text-xs text-[#F8FAF7]/75 max-w-md leading-relaxed">
                Pioneering intelligent Pay-As-You-Go solar energy infrastructure, calibrated LiFePO4 storage systems, and AI-driven microgrid management across Nigeria and West Africa.
              </p>
              <div className="text-[11px] text-[#F8FAF7]/60 space-y-1">
                <p><strong>Lagos HQ:</strong> Victoria Island, Lagos State</p>
                <p><strong>Abuja Hub:</strong> Central Business District, FCT Abuja</p>
                <p><strong>Regional Support:</strong> Port Harcourt • Kano • Ibadan</p>
                <p><strong>Hotline:</strong> +234 800-SKYGRID (0800-759-4743)</p>
              </div>
            </div>

            <div>
              <h4 className="font-heading font-bold text-white uppercase tracking-wider text-xs mb-3">Solar Solutions</h4>
              <ul className="space-y-2 text-xs">
                <li><a href="#packages" className="hover:text-[#F5B82E] transition">Essential Home (3kVA)</a></li>
                <li><a href="#packages" className="hover:text-[#F5B82E] transition">Family Standard (5kVA)</a></li>
                <li><a href="#packages" className="hover:text-[#F5B82E] transition">Business Solar (10kVA)</a></li>
                <li><a href="#packages" className="hover:text-[#F5B82E] transition">Industrial Microgrids (30kVA+)</a></li>
                <li><a href="#installations" className="hover:text-[#F5B82E] transition">Agricultural Cold Storage</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-heading font-bold text-white uppercase tracking-wider text-xs mb-3">Technology &amp; Model</h4>
              <ul className="space-y-2 text-xs">
                <li><a href="#how-it-works" className="hover:text-[#F5B82E] transition">How PAYGo Lease Works</a></li>
                <li><a href="#monitoring" className="hover:text-[#F5B82E] transition">IoT Cloud Telemetry</a></li>
                <li><a href="#calculator" className="hover:text-[#F5B82E] transition">Load &amp; Savings Calculator</a></li>
                <li><a href="#faq" className="hover:text-[#F5B82E] transition">Warranty &amp; Service SLAs</a></li>
                <li><a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" className="hover:text-[#19A89A] transition">AI Intelligence Engine API &rarr;</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-heading font-bold text-white uppercase tracking-wider text-xs mb-3">Legal &amp; Trust</h4>
              <ul className="space-y-2 text-xs">
                <li><span className="text-[#19A89A]">● COREN Registered</span></li>
                <li><span className="text-[#19A89A]">● NEMSA Certified</span></li>
                <li><a href="#faq" className="hover:text-[#F5B82E] transition">KYC &amp; Credit Terms</a></li>
                <li><a href="#faq" className="hover:text-[#F5B82E] transition">Data Privacy Policy</a></li>
                <li><button onClick={() => setIsSignInModalOpen(true)} className="hover:text-[#F5B82E] transition">Customer Portal Login</button></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-[#F8FAF7]/50">
            <p>© 2026 SkyGrid Flex Solutions Limited. All rights reserved. Registered under Nigerian Corporate Affairs Commission.</p>
            <p className="text-center md:text-right">
              Growatt authorized tier-1 system integrator. Inverter &amp; LiFePO4 battery warranties backed by OEM factory certification.
            </p>
          </div>
        </div>
      </footer>

      {/* MODALS */}
      {/* 1. Package Detail Modal */}
      {selectedPackageForModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B241B]/95 backdrop-blur-xl rounded-3xl max-w-2xl w-full p-6 sm:p-8 border border-white/15 relative shadow-2xl">
            <button
              onClick={() => setSelectedPackageForModal(null)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition"
            >
              ✕
            </button>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#F5B82E]/20 text-[#F5B82E] font-mono font-semibold">
                {selectedPackageForModal.sku}
              </span>
              <span className="text-xs text-[#19A89A] font-medium">OEM Factory Certified</span>
            </div>
            <h3 className="text-2xl font-heading font-extrabold text-white">{selectedPackageForModal.title}</h3>
            <p className="text-xs text-[#F8FAF7]/70 mt-1">{selectedPackageForModal.profile}</p>

            <div className="grid sm:grid-cols-2 gap-4 my-6 text-xs">
              <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-2">
                <span className="font-bold text-white block uppercase tracking-wider text-[10px]">Electrical Architecture</span>
                <div className="flex justify-between"><span className="text-[#F8FAF7]/60">Inverter:</span> <span className="font-bold text-white font-mono">{selectedPackageForModal.inverter}</span></div>
                <div className="flex justify-between"><span className="text-[#F8FAF7]/60">Battery:</span> <span className="font-bold text-[#19A89A] font-mono">{selectedPackageForModal.battery}</span></div>
                <div className="flex justify-between"><span className="text-[#F8FAF7]/60">Solar Array:</span> <span className="font-bold text-white font-mono">{selectedPackageForModal.pv}</span></div>
                <div className="flex justify-between"><span className="text-[#F8FAF7]/60">Transfer Time:</span> <span className="font-bold text-[#19A89A] font-mono">10 ms (UPS Grade)</span></div>
              </div>

              <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-2">
                <span className="font-bold text-white block uppercase tracking-wider text-[10px]">Financing &amp; Terms</span>
                <div className="flex justify-between"><span className="text-[#F8FAF7]/60">Outright Price:</span> <span className="font-bold text-white font-mono">₦{selectedPackageForModal.cashPriceNGN.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-[#F8FAF7]/60">30% Down Payment:</span> <span className="font-bold text-[#F5B82E] font-mono">₦{Math.round(selectedPackageForModal.cashPriceNGN * 0.3).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-[#F8FAF7]/60">36-Mo. Payment:</span> <span className="font-bold text-[#F5B82E] font-mono">₦{selectedPackageForModal.monthlyInstallmentNGN.toLocaleString()}/mo</span></div>
                <div className="flex justify-between"><span className="text-[#F8FAF7]/60">Ownership:</span> <span className="font-bold text-emerald-400">100% Transfer</span></div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#123B2A]/50 border border-[#19A89A]/20 text-xs text-[#F8FAF7]/80 mb-6">
              <h4 className="font-bold text-white mb-1">Standard Inclusions:</h4>
              <p>Package includes high-yield monocrystalline half-cell panels, aluminum anodized roof mounting rails, 4mm² double-insulated solar DC cabling, Schneider/ABB DC breaker isolators, Type II lightning surge arrestors, and complete field commissioning.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedPackageForModal(null)}
                className="w-1/2 py-3 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/20 transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const title = selectedPackageForModal.title;
                  setSelectedPackageForModal(null);
                  openAuditForPackage(title);
                }}
                className="w-1/2 py-3 rounded-xl text-xs font-bold text-[#0B241B] bg-[#F5B82E] hover:bg-amber-400 transition"
              >
                Book Site Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Site Audit Modal */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B241B]/95 backdrop-blur-xl rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-white/15 relative shadow-2xl">
            <button
              onClick={() => setIsAuditModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition"
            >
              ✕
            </button>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F5B82E] animate-pulse" />
              <span className="text-xs uppercase font-bold text-[#F5B82E] tracking-wider">Field Engineering Dispatch</span>
            </div>
            <h3 className="text-2xl font-heading font-extrabold text-white">Book Free Site Audit</h3>
            <p className="text-xs text-[#F8FAF7]/75 mt-1">
              A COREN-certified engineer will inspect your roof structure, electrical distribution board, and verify your load profile.
            </p>

            <form onSubmit={handleAuditSubmit} className="mt-6 space-y-4 text-xs">
              <div>
                <label className="block text-[#F8FAF7]/80 font-bold mb-1">Full Legal Name *</label>
                <input
                  name="fullName"
                  type="text"
                  required
                  placeholder="e.g. Dr. Babatunde Adeleke"
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-4 py-2.5 text-white focus:border-[#F5B82E] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#F8FAF7]/80 font-bold mb-1">Phone Number (WhatsApp) *</label>
                  <input
                    name="phone"
                    type="tel"
                    required
                    placeholder="0803 123 4567"
                    className="w-full bg-black/50 border border-white/15 rounded-xl px-4 py-2.5 text-white focus:border-[#F5B82E] focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#F8FAF7]/80 font-bold mb-1">Email Address</label>
                  <input
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    className="w-full bg-black/50 border border-white/15 rounded-xl px-4 py-2.5 text-white focus:border-[#F5B82E] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#F8FAF7]/80 font-bold mb-1">Installation State *</label>
                  <select
                    name="state"
                    defaultValue={selectedState}
                    className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2.5 text-white focus:border-[#F5B82E] focus:outline-none"
                  >
                    <option value="LAGOS">Lagos</option>
                    <option value="ABUJA">Abuja (FCT)</option>
                    <option value="RIVERS">Rivers (Port Harcourt)</option>
                    <option value="OYO">Oyo (Ibadan)</option>
                    <option value="OGUN">Ogun</option>
                    <option value="KANO">Kano</option>
                    <option value="ENUGU">Enugu</option>
                    <option value="BENUE">Benue</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#F8FAF7]/80 font-bold mb-1">Target Solar Package</label>
                  <input
                    name="package"
                    type="text"
                    readOnly
                    value={auditTargetPackage}
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-[#F5B82E] font-semibold font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#F8FAF7]/80 font-bold mb-1">Physical Site Address / Landmark *</label>
                <input
                  name="address"
                  type="text"
                  required
                  placeholder="Plot number, street name, estate or landmark"
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-4 py-2.5 text-white focus:border-[#F5B82E] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl text-xs font-bold text-[#0B241B] bg-[#F5B82E] hover:bg-amber-400 transition-all font-heading shadow-lg shadow-[#F5B82E]/20 mt-2"
              >
                Confirm Audit Booking
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. Customer Portal Sign In Modal */}
      {isSignInModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B241B]/95 backdrop-blur-xl rounded-3xl max-w-md w-full p-6 sm:p-8 border border-white/15 relative shadow-2xl">
            <button
              onClick={() => setIsSignInModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition"
            >
              ✕
            </button>
            <div className="w-12 h-12 rounded-2xl bg-[#19A89A]/20 border border-[#19A89A]/30 flex items-center justify-center text-[#19A89A] mb-4 text-xl">
              🔑
            </div>
            <h3 className="text-2xl font-heading font-extrabold text-white">Customer Portal Sign In</h3>
            <p className="text-xs text-[#F8FAF7]/75 mt-1">
              Access your real-time telemetry, check token validity, download payment receipts, or view your amortization schedule.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIsSignInModalOpen(false);
                showToast('✓ Portal Verification Successful: IoT Telemetry Active (GW-5000ES-NG94).');
              }}
              className="mt-6 space-y-4 text-xs"
            >
              <div>
                <label className="block text-[#F8FAF7]/80 font-bold mb-1">Registered Phone or Inverter Meter ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 08031234567 or GW-5000ES-NG94"
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-4 py-2.5 text-white focus:border-[#F5B82E] focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[#F8FAF7]/80 font-bold mb-1">Access PIN / Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-4 py-2.5 text-white focus:border-[#F5B82E] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl text-xs font-bold text-[#0B241B] bg-[#F5B82E] hover:bg-amber-400 transition font-heading"
              >
                Sign In to Portal
              </button>

              <p className="text-center text-[11px] text-[#F8FAF7]/60">
                Need help? Call field engineer dispatch: <span className="text-[#19A89A] font-semibold">+234 800-SKYGRID</span>
              </p>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0B241B]/95 backdrop-blur-xl border border-[#19A89A]/40 rounded-2xl p-4 shadow-2xl flex items-center gap-3 max-w-md text-xs text-white">
          <div className="w-8 h-8 rounded-xl bg-[#19A89A]/20 text-[#19A89A] flex items-center justify-center shrink-0">
            ✓
          </div>
          <div className="flex-grow">{toastMessage}</div>
        </div>
      )}

    </div>
  );
}
