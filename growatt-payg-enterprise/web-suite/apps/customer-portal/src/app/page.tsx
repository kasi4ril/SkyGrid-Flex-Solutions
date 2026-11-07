'use client';

/**
 * @fileoverview Customer Account Portal with Full Unified Energy, Financial & Forecast Storytelling Suite
 * Professional Landing Page Dashboard with Fixed Header, Static Left Navigation Pane & Live GPS Auto-Detect
 * Path: web-suite/apps/customer-portal/src/app/page.tsx
 */

import React, { useState, useEffect } from 'react';
import { EnergyAnalyticsSuite } from './EnergyAnalyticsSuite';
import { UnifiedHeader, ChatDrawer, UserPersona } from '../../packages/ui-kit/src';
import EnterpriseNavbar from '../components/EnterpriseNavbar';

export default function CustomerAccountPortalPage() {
  const [copiedAcct, setCopiedAcct] = useState<string | null>(null);
  const [showAboutModal, setShowAboutModal] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [persona, setPersona] = useState<UserPersona>('customer');
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'analytics' | 'telemetry' | 'paygo' | 'hardware'>('analytics');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [gpsStatus, setGpsStatus] = useState<string>('📍 9.0765°N, 7.3986°E');
  const [isDetectingGPS, setIsDetectingGPS] = useState<boolean>(false);
  const [session, setSession] = useState<{ full_name?: string; email?: string; role?: string; token?: string } | null>(null);

  useEffect(() => {
    const readSession = () => {
      try {
        const raw = localStorage.getItem('skytron_session');
        if (raw) {
          setSession(JSON.parse(raw));
        }
      } catch (e) {}
    };
    readSession();
    window.addEventListener('storage', readSession);
    window.addEventListener('skytron_auth_change', readSession as EventListener);
    return () => {
      window.removeEventListener('storage', readSession);
      window.removeEventListener('skytron_auth_change', readSession as EventListener);
    };
  }, []);

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

  const detectSiteGPS = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsDetectingGPS(true);
    setGpsStatus('🛰️ Acquiring Fix...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetectingGPS(false);
        const lat = pos.coords.latitude.toFixed(4);
        const lng = pos.coords.longitude.toFixed(4);
        setGpsStatus(`📍 ${lat}°N, ${lng}°E`);
      },
      (err) => {
        setIsDetectingGPS(false);
        setGpsStatus('📍 9.0765°N, 7.3986°E');
        alert('Could not auto-detect live GPS: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const virtualAccounts = [
    { bank: 'Moniepoint MFB', acctNo: '8049201844', name: 'SKYGRID SOLAR / SHWARJI KHATANG' },
    { bank: 'Paystack-Titan', acctNo: '9938471029', name: 'SKYGRID SOLAR / SHWARJI KHATANG' },
    { bank: 'OPay Digital', acctNo: '7083920194', name: 'SKYGRID SOLAR / SHWARJI KHATANG' },
  ];

  const copyNUBAN = (nuban: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(nuban);
    }
    setCopiedAcct(nuban);
    setTimeout(() => setCopiedAcct(null), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 font-sans selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      
      {/* 1. ENTERPRISE GLOBAL NAVBAR */}
      <EnterpriseNavbar activeTab="portal" />

      {/* 2. CUSTOMER COMMAND & TELEMETRY SUB-HEADER */}
      <header className="sticky top-16 z-40 bg-white/95 dark:bg-[#0E1526]/95 backdrop-blur-md border-b border-slate-200 dark:border-white/10 px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        
        {/* Left Section: Mobile Menu, Customer Welcome & Geo-Tag */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white shrink-0 transition"
            title="Toggle Navigation Menu"
          >
            <span className="text-base font-bold">☰</span>
          </button>

          {/* Customer Welcome & Identification */}
          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">Customer:</span>
              <h1 className="font-heading font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate leading-tight">
                {session?.full_name || 'Engr. Shwarji I. Khatang'}
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-semibold font-mono whitespace-nowrap">
                ● ACTIVE LEASE
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate flex items-center gap-2 mt-0.5">
              <span>DEV-8F3A-GROWATT-00421</span>
              <span>&bull;</span>
              <span>Maitama, Abuja</span>
              <span>&bull;</span>
              <button
                type="button"
                onClick={detectSiteGPS}
                disabled={isDetectingGPS}
                className="hover:underline text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 transition"
                title="Auto-Detect Site GPS Coordinates"
              >
                <span>{isDetectingGPS ? '🛰️' : '📍'}</span>
                <span>{gpsStatus}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Section: Token Days Left, Ask AI, Logout & Far-Right Passport */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden sm:flex items-center px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono">
            <span className="font-extrabold text-amber-700 dark:text-[#FFBF00] flex items-center gap-1.5">
              <span>⏳ 19.4 Days</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal hidden xl:inline">● Auto-PAYG</span>
            </span>
          </div>

          <button
            onClick={() => setIsChatOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:brightness-110 shadow-md shadow-emerald-500/20 transition cursor-pointer"
            title="Ask SkyTron AI (LocalGrid RAG)"
          >
            <span>🤖</span>
            <span>Ask AI</span>
          </button>

          {/* Logout Button (Redirects to Refreshed Landing Page) */}
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.removeItem('skytron_session');
                window.location.href = '/';
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-600 dark:text-rose-400 transition cursor-pointer"
            title="Logout & Return to Main Landing Page"
          >
            <span>🚪</span>
            <span className="hidden sm:inline">Logout</span>
          </button>

          {/* Far Right: Round Customer Passport Space */}
          <div className="relative shrink-0 ml-1" title="Verified NIMC Customer Passport">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full p-0.5 bg-gradient-to-tr from-teal-500 via-amber-400 to-sky-400 shadow-md shadow-teal-500/20">
              <img
                src={typeof window !== 'undefined' ? (localStorage.getItem('customer_passport_photo') || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80') : 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80'}
                alt="Customer Passport"
                className="w-full h-full rounded-full object-cover border-2 border-slate-900"
              />
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" title="Verified NIMC Biometric Identity" />
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN BODY (STATIC LEFT SIDEBAR + INDEPENDENT SCROLLING PANE)           */}
      {/* ========================================================================= */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Static Left Sidebar Pane */}
        <aside
          className={`${
            sidebarOpen ? 'fixed inset-y-0 left-0 z-50 shadow-2xl flex' : 'hidden md:flex'
          } flex-col w-64 md:w-72 shrink-0 bg-white dark:bg-[#0D1322] border-r border-slate-200 dark:border-white/10 justify-between overflow-y-auto p-4 z-30 transition-all duration-300`}
        >
          <div className="space-y-6">
            
            {/* Section: Navigation Pages */}
            <div>
              <div className="flex items-center justify-between px-2 mb-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                  PORTAL PAGES
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-700 dark:text-cyan-400 font-mono font-bold">
                  4 MODULES
                </span>
              </div>

              <nav className="space-y-2">
                {/* 1. Financial Story */}
                <button
                  onClick={() => { setActiveTab('analytics'); setSidebarOpen(false); }}
                  className={`w-full text-left px-3.5 py-3 rounded-2xl transition shadow-md flex items-center justify-between group ${
                    activeTab === 'analytics'
                      ? 'bg-amber-400 text-slate-950 font-bold border border-amber-300 shadow-amber-400/20'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white font-medium border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">✨</span>
                    <div>
                      <span className="text-xs font-bold block leading-tight">Financial Story</span>
                      <span className="text-[10px] opacity-75 font-normal block">Triple-source ROI &amp; AI</span>
                    </div>
                  </div>
                  <span className="text-xs opacity-60">&rarr;</span>
                </button>

                {/* 2. Live Power Flow */}
                <button
                  onClick={() => { setActiveTab('telemetry'); setSidebarOpen(false); }}
                  className={`w-full text-left px-3.5 py-3 rounded-2xl transition shadow-md flex items-center justify-between group ${
                    activeTab === 'telemetry'
                      ? 'bg-amber-400 text-slate-950 font-bold border border-amber-300 shadow-amber-400/20'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white font-medium border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">⚡</span>
                    <div>
                      <span className="text-xs font-bold block leading-tight">Live Power Flow</span>
                      <span className="text-[10px] opacity-75 font-normal block">PV, Battery, Load &amp; Grid</span>
                    </div>
                  </div>
                  <span className="text-xs opacity-60">&rarr;</span>
                </button>

                {/* 3. PAYGo Wallet & Token */}
                <button
                  onClick={() => { setActiveTab('paygo'); setSidebarOpen(false); }}
                  className={`w-full text-left px-3.5 py-3 rounded-2xl transition shadow-md flex items-center justify-between group ${
                    activeTab === 'paygo'
                      ? 'bg-amber-400 text-slate-950 font-bold border border-amber-300 shadow-amber-400/20'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white font-medium border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">💳</span>
                    <div>
                      <span className="text-xs font-bold block leading-tight">PAYGo Wallet</span>
                      <span className="text-[10px] opacity-75 font-normal block">DVA, 20-digit STS &amp; Keypad</span>
                    </div>
                  </div>
                  <span className="text-xs opacity-60">&rarr;</span>
                </button>

                {/* 4. Hardware Passport */}
                <button
                  onClick={() => { setActiveTab('hardware'); setSidebarOpen(false); }}
                  className={`w-full text-left px-3.5 py-3 rounded-2xl transition shadow-md flex items-center justify-between group ${
                    activeTab === 'hardware'
                      ? 'bg-amber-400 text-slate-950 font-bold border border-amber-300 shadow-amber-400/20'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white font-medium border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">🛡️</span>
                    <div>
                      <span className="text-xs font-bold block leading-tight">Hardware Passport</span>
                      <span className="text-[10px] opacity-75 font-normal block">COREN Seal, SPF &amp; LiFePO4</span>
                    </div>
                  </div>
                  <span className="text-xs opacity-60">&rarr;</span>
                </button>
              </nav>
            </div>

            {/* Quick Actions */}
            <div>
              <div className="px-2 mb-2.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                  QUICK ACTIONS
                </span>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => alert('Simulated Moniepoint ₦145,000 transfer confirmed! 30 days added to token.')}
                  className="w-full text-left p-2.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-700 dark:text-teal-300 text-xs font-semibold flex items-center gap-2 transition"
                >
                  <span>💰</span>
                  <span>Simulate ₦145k Top-Up</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAboutModal(true)}
                  className="w-full text-left p-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-700 dark:text-sky-300 text-xs font-semibold flex items-center gap-2 transition"
                >
                  <span>🌍</span>
                  <span>About SkyGrid Charter</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar Footer Status Card */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10 space-y-3">
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Cloud RTU Link:</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-bold font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> ONLINE
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Telemetry SLA:</span>
                <span className="text-slate-800 dark:text-white font-mono">8ms Inverter RTU</span>
              </div>
            </div>

            <a
              href="/"
              className="w-full py-2.5 rounded-xl text-xs font-bold text-teal-700 dark:text-teal-300 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center gap-2 transition"
            >
              <span>&larr;</span>
              <span>Return to Showroom</span>
            </a>
          </div>
        </aside>

        {/* Scrollable Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          
          {/* TAB 1: Financial Story & Analytics */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Static/Sticky Subheader Pane: Customer Chosen Subscribed Package & 4 Core Specs (Lapping Flush with Header Pane) */}
              <div className="sticky top-0 z-20 -mt-4 sm:-mt-6 lg:-mt-8 -mx-4 sm:-mx-6 lg:-mx-8 p-4 sm:p-5 lg:px-8 rounded-none border-x-0 border-t-0 border-b border-sky-500/30 bg-white/95 dark:bg-[#0D1527]/98 backdrop-blur-md shadow-xl space-y-3.5 mb-6">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400 text-lg shrink-0 shadow-sm">
                      📦
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
                        Customer's Chosen Subscribed Package
                      </span>
                      <h3 className="text-slate-900 dark:text-white font-heading font-extrabold text-sm sm:text-base leading-tight">
                        5.4 kWp Executive Solar Home (Hybrid SPF 5000ES)
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-3 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/30 font-mono font-bold">
                      🏡 Residential Plan
                    </span>
                    <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 border border-emerald-500/30 font-mono font-semibold">
                      10.24 kWh LiFePO4
                    </span>
                  </div>
                </div>

                {/* Static 4-Grid Core Specs: Solar Array Size, Battery Model & Size, Days of Token Left, Inverter Size & Model */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {/* 1. Solar Array Size */}
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                      <span>Solar Array Size</span>
                      <span className="text-amber-500">☀️</span>
                    </div>
                    <div className="text-sm sm:text-base font-heading font-extrabold text-amber-600 dark:text-[#FFBF00] font-mono">
                      5.5 kWp (10x 550W)
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Tier-1 Bifacial PV</span>
                  </div>

                  {/* 2. Battery Model & Size */}
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                      <span>Battery Model &amp; Size</span>
                      <span className="text-teal-500">🔋</span>
                    </div>
                    <div className="text-sm sm:text-base font-heading font-extrabold text-teal-600 dark:text-cyan-400 font-mono">
                      10.24 kWh • GBLI 5001
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">LiFePO4 Active BMS</span>
                  </div>

                  {/* 3. Days of Token Left */}
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                    <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 text-[10px] uppercase font-bold tracking-wider">
                      <span>Days of Token Left</span>
                      <span className="text-amber-500">⏳</span>
                    </div>
                    <div className="text-sm sm:text-base font-heading font-extrabold text-amber-700 dark:text-[#FFBF00] font-mono">
                      19.4 Days
                    </div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-mono">● Auto-PAYG Synchronized</span>
                  </div>

                  {/* 4. Inverter Size & Model */}
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                      <span>Inverter Size &amp; Model</span>
                      <span className="text-sky-500">⚡</span>
                    </div>
                    <div className="text-sm sm:text-base font-heading font-extrabold text-slate-900 dark:text-white font-mono">
                      5,000W • SPF 5000ES
                    </div>
                    <span className="text-[10px] text-sky-600 dark:text-sky-400 block font-mono">Dual MPPT Pure Sine</span>
                  </div>
                </div>
              </div>

              {/* Shared 4-Quadrant Statistical Energy Analytics Suite */}
              <EnergyAnalyticsSuite
                mode="CUSTOMER_PORTAL"
                deviceID="DEV-8F3A-GROWATT-00421"
                customerState="JOS / PLATEAU (5.3 PSH)"
              />
            </div>
          )}

          {/* TAB 2: Live Power Flow & Telemetry */}
          {activeTab === 'telemetry' && (
            <div className="space-y-6">
              {/* Static/Sticky Subheader: 4 Telemetry Gauges (Solar PV Ingress, Battery SoC, Load Demand, Inverter Core Temp) */}
              <div className="sticky top-0 z-20 p-4 sm:p-5 rounded-2xl bg-white/95 dark:bg-[#0D1527]/95 backdrop-blur-md border border-teal-500/30 shadow-xl">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {/* Solar PV Ingress */}
                  <div className="p-3 sm:p-4 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 space-y-1">
                    <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 mb-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider">Solar PV Ingress</span>
                      <span className="text-amber-500">☀️</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-heading font-extrabold text-amber-600 dark:text-[#FFBF00] font-mono">3,420 <span className="text-xs font-normal">W</span></div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 block">5.4 kWp Rooftop Array</span>
                  </div>

                  {/* Battery SoC */}
                  <div className="p-3 sm:p-4 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 space-y-1">
                    <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 mb-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider">Battery SoC</span>
                      <span className="text-teal-500">🔋</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-heading font-extrabold text-teal-600 dark:text-cyan-400 font-mono">92<span className="text-xs font-normal">%</span></div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block font-mono">10.24 kWh • 53.1V • 27°C</span>
                  </div>

                  {/* Load Demand (Renamed from Household Consumption) */}
                  <div className="p-3 sm:p-4 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 space-y-1">
                    <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 mb-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider">Load Demand</span>
                      <span className="text-slate-800 dark:text-white">🏠</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-heading font-extrabold text-slate-900 dark:text-white font-mono">1,150 <span className="text-xs font-normal">W</span></div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 block">100% Solar Self-Supply</span>
                  </div>

                  {/* Inverter Core Temp */}
                  <div className="p-3 sm:p-4 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 space-y-1">
                    <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 mb-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider">Inverter Core Temp</span>
                      <span className="text-amber-600 dark:text-amber-400">🌡️</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-heading font-extrabold text-slate-900 dark:text-white font-mono">37.5 <span className="text-xs font-normal">°C</span></div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">Cooling Fans: Idle / Quiet</span>
                  </div>
                </div>
              </div>

              {/* 2-Column Split: 24h Predictive Horizon Graph (Left) & CleanTech AI Advisor (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                
                {/* Left Side: 24-Hour Predictive Horizon Chart & KPI Tiles */}
                <div className="lg:col-span-7 bg-white dark:bg-black/40 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-white/10 flex flex-col justify-between space-y-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
                        ⚡
                      </div>
                      <div>
                        <h4 className="font-heading font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                          24-Hour Predictive Horizon: Solar Generation vs. Facility Load Demand
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          ML Intelligence Engine (LightGBM + NeuralProphet) • 96.8% Confidence Interval • Open-Meteo GHI Solar Feed
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 font-mono font-bold border border-sky-500/30">
                      ● ML Model: LightGBM-SolarNet-v2
                    </span>
                  </div>

                  {/* 4 Forecast Summary KPI Tiles */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase block">Predicted Day Harvest</span>
                      <span className="text-base font-extrabold text-amber-600 dark:text-[#FFBF00] font-mono">24.5 kWh</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5">+18.2% vs. 30d Baseline</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase block">Projected Facility Load</span>
                      <span className="text-base font-extrabold text-sky-600 dark:text-[#22D3EE] font-mono">13.8 kWh</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">8.4 kWh Night Cycle</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase block">Min Battery Sunrise Floor</span>
                      <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">64%</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5">+44% Reserve Cushion</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase block">Gen Runtime Required</span>
                      <span className="text-base font-extrabold text-teal-600 dark:text-teal-400 font-mono">0.0 Hours</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5">100% Solar Autonomy</span>
                    </div>
                  </div>

                  {/* Visual 24h Horizon Predictive SVG Chart (Upgraded Proportional Scaling) */}
                  <div className="relative w-full flex-1 min-h-[300px] bg-slate-100 dark:bg-slate-950/80 p-5 rounded-2xl border border-slate-200 dark:border-white/5 flex flex-col justify-between shadow-inner">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400 pb-2">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-amber-500 inline-block"></span> Forecasted Solar Generation (kW)</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 border-t-2 border-dashed border-sky-500 inline-block"></span> Predicted Facility Load (kW)</span>
                      </div>
                      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        ◈ 100% Self-Powered Window: 08:45 AM – 18:30 PM
                      </span>
                    </div>

                    <div className="w-full flex-1 relative my-1">
                      <svg viewBox="0 0 760 270" className="w-full h-auto overflow-visible select-none">
                        <defs>
                          <linearGradient id="mlSolarGradReact" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#FFBF00" stopOpacity="0.45" />
                            <stop offset="100%" stopColor="#FFBF00" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Horizontal Grid Lines & Y-Axis Reference Labels */}
                        {[
                          { y: 25, label: '5.0 kW' },
                          { y: 67, label: '4.0 kW' },
                          { y: 109, label: '3.0 kW' },
                          { y: 151, label: '2.0 kW' },
                          { y: 193, label: '1.0 kW' },
                          { y: 235, label: '0 kW' },
                        ].map((grid, idx) => (
                          <g key={idx}>
                            <line
                              x1="55"
                              y1={grid.y}
                              x2="735"
                              y2={grid.y}
                              stroke="#94A3B8"
                              strokeOpacity={idx === 5 ? "0.6" : "0.25"}
                              strokeDasharray={idx === 5 ? undefined : "3,3"}
                              strokeWidth={idx === 5 ? "1.5" : "0.8"}
                            />
                            <text
                              x="47"
                              y={grid.y + 4}
                              fill="#64748B"
                              fontSize="9.5"
                              fontFamily="monospace"
                              textAnchor="end"
                            >
                              {grid.label}
                            </text>
                            <line
                              x1="50"
                              y1={grid.y}
                              x2="55"
                              y2={grid.y}
                              stroke="#64748B"
                              strokeWidth="1.5"
                            />
                          </g>
                        ))}

                        {/* Solid Left Vertical Y-Axis */}
                        <line x1="55" y1="18" x2="55" y2="235" stroke="#64748B" strokeWidth="1.5" />
                        <polygon points="51,20 59,20 55,12" fill="#0284C7" />
                        <text x="50" y="14" fill="#0284C7" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="end">▲ kW</text>

                        {/* Solid Bottom Horizontal X-Axis */}
                        <line x1="55" y1="235" x2="745" y2="235" stroke="#64748B" strokeWidth="1.5" />
                        <polygon points="742,231 742,239 749,235" fill="#64748B" />

                        {/* Solar Area Harvest Polygon */}
                        <polygon
                          points="55,235 210,235 240,225 281,159 296,138 338,75 402,29 451,63 508,130 550,197 579,235 735,235"
                          fill="url(#mlSolarGradReact)"
                        />

                        {/* Solar Curve Path (Smooth Cubic / Polyline) */}
                        <path
                          d="M 55 235 L 210 235 Q 225 235 240 225 Q 260 210 281 159 Q 290 145 296 138 Q 338 75 402 29 Q 451 63 508 130 Q 550 197 579 235 L 735 235"
                          fill="none"
                          stroke="#FFBF00"
                          strokeWidth="2.5"
                        />

                        {/* Load Curve Path (Smooth Fluctuating Baseline + Peaks) */}
                        <path
                          d="M 55 195 Q 110 195 168 193 Q 220 190 260 170 Q 281 160 296 138 Q 340 180 395 184 Q 450 180 508 165 Q 560 145 607 117 Q 660 160 700 190 L 735 195"
                          fill="none"
                          stroke="#0EA5E9"
                          strokeWidth="2"
                          strokeDasharray="5,3"
                        />

                        {/* Solar Autonomy Crossover Pin & Badge (08:30 AM) */}
                        <g transform="translate(296, 138)">
                          <circle r="7" fill="#10B981" fillOpacity="0.3" className="animate-ping" />
                          <circle r="4.5" fill="#10B981" stroke="#0F172A" strokeWidth="2" />
                          <line x1="0" y1="-5" x2="0" y2="-45" stroke="#10B981" strokeWidth="1.5" strokeDasharray="2,2" />
                          <rect x="-75" y="-68" width="150" height="23" rx="6" fill="#0F172A" stroke="#10B981" strokeWidth="1" />
                          <text x="0" y="-53" fill="#10B981" fontSize="9.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                            ◈ AUTONOMY: 08:30 AM
                          </text>
                        </g>

                        {/* Midday Peak Generation Badge (12:15 PM) */}
                        <g transform="translate(402, 29)">
                          <circle r="4.5" fill="#FFBF00" stroke="#0F172A" strokeWidth="2" />
                          <rect x="-65" y="-24" width="130" height="20" rx="5" fill="#0F172A" stroke="#FFBF00" strokeWidth="1" />
                          <text x="0" y="-10" fill="#FFBF00" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                            ★ PEAK: 4.9 kW (12:15)
                          </text>
                        </g>
                      </svg>
                    </div>

                    {/* Timeline Axis Labels (00:00 to 24:00) */}
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-mono px-3 pt-2 border-t border-slate-200 dark:border-white/5">
                      <span>00:00</span>
                      <span>04:00</span>
                      <span>08:00</span>
                      <span className="text-amber-600 dark:text-amber-400 font-bold">12:00 (Peak 4.9 kW)</span>
                      <span>16:00</span>
                      <span className="text-sky-600 dark:text-sky-400 font-bold">19:30 (Evening Peak 2.8 kW)</span>
                      <span>24:00</span>
                    </div>
                  </div>
                </div>

                {/* Right Side: AI Agent Operational Advisory & Economic Dispatch Pane */}
                <div className="lg:col-span-5 p-5 sm:p-6 rounded-3xl bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 border border-teal-500/40 shadow-xl flex flex-col justify-between gap-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                        ✨
                      </div>
                      <div>
                        <h4 className="font-heading font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                          LocalGridAgent™ AI Advisor
                        </h4>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">Real-Time Autonomous Dispatch</span>
                      </div>
                    </div>
                    <span className="text-[9px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-mono font-bold border border-emerald-500/30 flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>ACTIVE</span>
                    </span>
                  </div>

                  {/* Recommendation Banner */}
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🌟</span>
                      <div>
                        <span className="text-[11px] sm:text-xs font-heading font-extrabold text-slate-900 dark:text-white block leading-tight">
                          RECOMMENDATION: REMAIN 100% ON SOLAR
                        </span>
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-300">
                          Full overnight battery self-sufficiency with 64% reserve floor.
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 whitespace-nowrap shrink-0">
                      Score: 98.4/100
                    </span>
                  </div>

                  {/* 3 Economic Cards Placed Below Each Other (Stacked Vertically) */}
                  <div className="flex flex-col gap-2.5 font-mono">
                    {/* Card 1: Solar Asset Marginal Cost */}
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-black/40 border border-emerald-500/20 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">1. Solar Asset Marginal Cost</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">OPTIMAL</span>
                      </div>
                      <div className="text-lg font-extrabold text-slate-900 dark:text-white">₦0.00 <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">/ kWh surplus</span></div>
                      <span className="text-[10px] text-slate-600 dark:text-slate-400 block">Fixed asset levelized @ ₦68/kWh • Zero extra cost</span>
                    </div>

                    {/* Card 2: National Grid Band A Alternative */}
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-300 dark:border-slate-700/50 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase">2. National Grid Band A</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">ERRATIC</span>
                      </div>
                      <div className="text-lg font-extrabold text-slate-800 dark:text-slate-300">₦209.00 <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">/ kWh</span></div>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 block">Frequent voltage sags • 42 hrs/mo blackout risk</span>
                    </div>

                    {/* Card 3: Fossil Generator Alternative */}
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-black/40 border border-rose-300 dark:border-rose-900/40 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase">3. Fossil Generator</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300">COSTLY</span>
                      </div>
                      <div className="text-lg font-extrabold text-rose-600 dark:text-rose-400">₦446.40 <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">/ kWh</span></div>
                      <span className="text-[10px] text-rose-700 dark:text-rose-300 block">Running gen wastes ₦13,400 tonight @ ₦1,250/L</span>
                    </div>
                  </div>

                  {/* Plain-Language AI Actionable Directives */}
                  <div className="p-3 rounded-2xl bg-slate-100 dark:bg-black/50 border border-slate-200 dark:border-white/5 space-y-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    <p className="text-[11px]">
                      <strong className="text-slate-900 dark:text-white">AI Dispatch Note:</strong> Forecast of <strong className="text-amber-600 dark:text-amber-400">24.5 kWh</strong> harvest + current <strong className="text-teal-600 dark:text-teal-400">92% (10.24 kWh)</strong> SoC guarantees 100% autonomy with a <strong>64% reserve floor</strong> at sunrise (06:00 AM).
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-white/10 text-[10px]">
                      <div className="flex items-start gap-1">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">1.</span>
                        <span><strong className="text-slate-900 dark:text-white">Gen OFF:</strong> Saves 5.8L (₦7,250).</span>
                      </div>
                      <div className="flex items-start gap-1">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">2.</span>
                        <span><strong className="text-slate-900 dark:text-white">Solar Priority:</strong> AC &amp; fridge cushioned.</span>
                      </div>
                      <div className="flex items-start gap-1">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">3.</span>
                        <span><strong className="text-slate-900 dark:text-white">Surplus:</strong> Pump water 11:30–14:30.</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          )}

          {/* TAB 3: PAYGo Wallet & Token Keypad */}
          {activeTab === 'paygo' && (
            <div className="space-y-6">
              <section className="grid md:grid-cols-12 gap-6 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                <div className="md:col-span-7 space-y-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Instant Dedicated Virtual Account Top-Up (Auto-Unlocks in &lt; 5 Seconds)
                  </h2>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {virtualAccounts.map((va) => (
                      <div key={va.acctNo} className="bg-slate-100/90 dark:bg-[#1E293B] border border-slate-200 dark:border-[#64748B]/30 p-3.5 rounded-xl space-y-1">
                        <span className="text-[10px] font-mono text-sky-700 dark:text-[#22D3EE] font-bold">{va.bank}</span>
                        <p className="text-base font-mono font-black text-slate-900 dark:text-white tabular-nums">{va.acctNo}</p>
                        <button
                          onClick={() => copyNUBAN(va.acctNo)}
                          className="w-full mt-2 bg-white hover:bg-emerald-600 hover:text-white dark:bg-slate-900 dark:hover:bg-[#10B981] dark:hover:text-[#0B0F19] text-xs font-bold py-1.5 rounded-lg border border-slate-300 dark:border-[#64748B]/30 text-slate-700 dark:text-slate-200 transition"
                        >
                          {copiedAcct === va.acctNo ? '✓ Copied' : 'Copy Account No'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-5 bg-slate-100/90 dark:bg-[#1E293B]/60 border border-sky-500/30 dark:border-[#22D3EE]/30 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-sky-800 dark:text-[#22D3EE] font-bold">
                      Offline GSM Blackout Fallback (STS / BLE Token)
                    </span>
                    <p className="text-base font-mono font-black text-amber-700 dark:text-[#FFBF00] tracking-widest mt-1 tabular-nums">
                      4819 - 2049 - 5510 - 8291 - 7304
                    </p>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-2">
                    If cellular network is down at home after paying, punch this 20-digit code into the lower shroud keypad or beam via Mobile App Bluetooth.
                  </p>
                </div>
              </section>
            </div>
          )}

          {/* TAB 4: Hardware Passport & COREN */}
          {activeTab === 'hardware' && (
            <div className="space-y-6">
              <div className="p-5 rounded-3xl bg-white dark:bg-black/40 border border-sky-500/20 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider block">Subscribed Clean Energy Package</span>
                  <h3 className="text-base sm:text-lg font-heading font-extrabold text-slate-900 dark:text-white">5.4 kWp Executive Solar Home (Hybrid SPF 5000ES)</h3>
                  <p className="text-xs text-sky-600 dark:text-cyan-400 font-mono mt-0.5">5.4 kWp Bifacial PV + 10.24 kWh LiFePO4 Storage Architecture</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-500/30 font-semibold">
                    ✓ COREN &amp; NEMSA Certified
                  </span>
                  <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white font-semibold">
                    10-Year EPC Warranty
                  </span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-black/40 p-6 rounded-2xl border border-slate-200 dark:border-white/10 space-y-3 text-xs shadow-sm">
                  <h4 className="font-heading font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs pb-2 border-b border-slate-200 dark:border-white/10">1. Inverter Specification</h4>
                  <div className="flex justify-between"><span className="text-slate-500">Inverter Type:</span> <strong className="text-slate-900 dark:text-white">Hybrid Off-Grid Pure Sine Wave</strong></div>
                  <div className="flex justify-between"><span className="text-slate-500">Model:</span> <strong className="text-slate-900 dark:text-white font-mono">Growatt SPF 5000ES</strong></div>
                  <div className="flex justify-between"><span className="text-slate-500">Rated Power:</span> <strong className="text-amber-600 dark:text-[#FFBF00] font-mono">5,000W Cont. / 10,000VA Surge</strong></div>
                  <div className="flex justify-between"><span className="text-slate-500">Serial No:</span> <strong className="text-slate-900 dark:text-white font-mono">GW-SPF5000ES-99881</strong></div>
                </div>

                <div className="bg-white dark:bg-black/40 p-6 rounded-2xl border border-slate-200 dark:border-white/10 space-y-3 text-xs shadow-sm">
                  <h4 className="font-heading font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs pb-2 border-b border-slate-200 dark:border-white/10">2. Storage Specification</h4>
                  <div className="flex justify-between"><span className="text-slate-500">Chemistry:</span> <strong className="text-slate-900 dark:text-white">LiFePO4 Lithium Iron Phosphate</strong></div>
                  <div className="flex justify-between"><span className="text-slate-500">Model:</span> <strong className="text-slate-900 dark:text-white font-mono">Felicity / Growatt GBLI 5001</strong></div>
                  <div className="flex justify-between"><span className="text-slate-500">Capacity:</span> <strong className="text-teal-600 dark:text-cyan-400 font-mono">10.24 kWh / 200Ah @ 51.2V DC</strong></div>
                  <div className="flex justify-between"><span className="text-slate-500">Battery Serial:</span> <strong className="text-slate-900 dark:text-white font-mono">LFP-512V-100AH-441</strong></div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Footer Status */}
          <div className="mt-8 pt-4 border-t border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Connected to Growatt Cloud Telemetry Engine &bull; Encryption: TLS 1.3 AES-256 &bull; Active Node: Jos HQ / Maitama DC</span>
            <a href="/" className="text-teal-600 dark:text-cyan-400 hover:underline font-semibold">
              Return to Showroom &rarr;
            </a>
          </div>
        </main>

      </div>

      {/* Corporate About Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#64748B]/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-slate-900 dark:text-slate-100">
            <button
              onClick={() => setShowAboutModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#1E293B] dark:hover:bg-[#64748B]/30 dark:text-white flex items-center justify-center text-sm transition"
            >
              &times;
            </button>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-[#10B981] border border-emerald-600/30 dark:border-[#10B981]/30 text-xs font-bold uppercase tracking-wider font-mono">
                <span>🌍</span> Clean Energy Sovereignty &bull; Nigeria &amp; Africa
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">About SkyGrid Flex Solutions</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                In Strategic Alliance with SkyTron Quantum Solutions &amp; Growatt New Energy.
              </p>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
              <p>
                SkyGrid Flex Solutions is a world-class Clean Energy-as-a-Service (EaaS) infrastructure enterprise engineered to permanently solve Nigeria&apos;s chronic electricity deficit and liberate households, healthcare centers, and commerce from the crippling economic drain of fossil-fuel generators.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-[#64748B]/30 flex justify-end">
              <button
                onClick={() => setShowAboutModal(false)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-lg"
              >
                Close Charter
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Multi-Persona RAG Chat Drawer */}
      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        activePersona={persona}
        onPersonaChange={setPersona}
        deviceId="DEV-8F3A-GROWATT-00421"
      />
    </div>
  );
}
