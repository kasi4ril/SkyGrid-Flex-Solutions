'use client';

/**
 * @fileoverview Customer Account Portal with Full Unified Energy, Financial & Forecast Storytelling Suite
 * Path: web-suite/apps/customer-portal/src/app/page.tsx
 */

import React, { useState, useEffect } from 'react';
import { EnergyAnalyticsSuite } from './EnergyAnalyticsSuite';

export default function CustomerAccountPortalPage() {
  const [copiedAcct, setCopiedAcct] = useState<string | null>(null);
  const [showAboutModal, setShowAboutModal] = useState<boolean>(false);
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
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 font-sans pb-20 selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/90 dark:bg-[#0B0F19]/90 border-b border-slate-200 dark:border-[#64748B]/30 px-4 sm:px-6 py-4 transition-colors duration-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
              SKY<span className="text-[#0284C7] dark:text-[#22D3EE]">GRID</span> GROWATT &mdash; CUSTOMER ENERGY &amp; FINANCIAL ANALYTICS
            </h1>
            <p className="text-xs text-slate-600 dark:text-[#64748B] font-mono">
              Account: Engr. Shwarji I. Khatang &bull; Contract: CTR-NG-2026-001 &bull; Shroud: SEALED
            </p>
          </div>
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
                  <span className="hidden md:inline text-slate-300">Daylight</span>
                </>
              ) : (
                <>
                  <span className="text-sky-600 text-base">🌙</span>
                  <span className="hidden md:inline text-slate-700">Night</span>
                </>
              )}
            </button>

            <button
              onClick={() => setShowAboutModal(true)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#1E293B] dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#64748B]/30 transition flex items-center gap-1.5"
            >
              <span>🌍</span>
              <span className="hidden sm:inline">About SkyGrid (Vision &amp; Mission)</span>
              <span className="sm:hidden">About</span>
            </button>
            <span className="bg-emerald-500/15 text-emerald-800 dark:text-[#10B981] border border-emerald-600/30 dark:border-[#10B981]/30 text-xs font-mono font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>AC OUTPUT ACTIVE</span>
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* 1. Shared 4-Quadrant Statistical Energy Analytics Suite */}
        <EnergyAnalyticsSuite
          mode="CUSTOMER_PORTAL"
          deviceID="DEV-8F3A-GROWATT-00421"
          customerState="JOS / PLATEAU (5.3 PSH)"
        />

        {/* 2. Dedicated Virtual Account Top-Up & 20-Digit Offline Keypad/BLE Token Vault */}
        <section className="grid md:grid-cols-12 gap-6 bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-[#64748B]/30 rounded-2xl p-6 shadow-sm dark:shadow-xl transition-colors duration-200">
          <div className="md:col-span-7 space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Instant Dedicated Virtual Account Top-Up (Auto-Unlocks in &lt; 5 Seconds)
            </h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {virtualAccounts.map((va) => (
                <div key={va.acctNo} className="bg-slate-100/90 dark:bg-[#1E293B] border border-slate-200/80 dark:border-[#64748B]/30 p-3.5 rounded-xl space-y-1">
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
                0014-00720-8492-1104-5921
              </p>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 mt-2">
              If cellular network is down at home after paying, punch this 20-digit code into the lower shroud keypad or beam via Mobile App Bluetooth.
            </p>
          </div>
        </section>
      </main>

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

              <div className="grid sm:grid-cols-2 gap-4 my-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-sky-500/30 dark:border-[#22D3EE]/30 space-y-2">
                  <div className="flex items-center gap-2 text-sky-800 dark:text-[#22D3EE] font-bold text-sm">
                    <span>🔭</span> Our Corporate Vision
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    To build Africa&apos;s most intelligent, resilient, and inclusive clean energy ecosystem—eradicating energy poverty and guaranteeing continuous, affordable, and sovereign solar electric power for every Nigerian home, scaling to power 50 million African lives by 2035.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-emerald-500/30 dark:border-[#10B981]/30 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-[#10B981] font-bold text-sm">
                    <span>🎯</span> Our Corporate Mission
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    To displace noisy, toxic fossil-fuel generators across Nigeria and Africa by deploying military-grade, Tier-1 Growatt hybrid inverters and 6,000-cycle LiFePO4 storage via accessible Pay-As-You-Go financing, edge IoT telematics, and local COREN/NEMSA engineering.
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <h4 className="text-slate-900 dark:text-white font-bold text-sm">Why We Are Different</h4>
                <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 list-disc list-inside">
                  <li><strong className="text-slate-900 dark:text-white">COREN &amp; NEMSA Certified:</strong> Type-2 SPDs, lightning arrestors, and deep earthing resistance &le; 2.5&Omega;.</li>
                  <li><strong className="text-slate-900 dark:text-white">100% LiFePO4 Battery Mandate:</strong> 6,000+ cycles at 80% DoD (15+ year lifespan), banning dead lead-acid batteries.</li>
                  <li><strong className="text-slate-900 dark:text-white">Offline STS Keypad Mesh:</strong> 20-digit encrypted token generation to keep power on during telecommunications blackouts.</li>
                  <li><strong className="text-slate-900 dark:text-white">Pan-African Blueprint:</strong> Scaling from 36 Nigerian states into ECOWAS and East Africa.</li>
                </ul>
              </div>
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

      {/* Corporate Footer */}
      <footer className="mt-20 border-t border-slate-200 dark:border-[#64748B]/30 bg-slate-100 dark:bg-[#0B0F19] py-8 px-4 text-center text-xs text-slate-600 dark:text-[#64748B]">
        <p>
          &copy; {new Date().getFullYear()} SkyGrid Flex Solutions Ltd. &bull; In Strategic Alliance with SkyTron Quantum Solutions &amp; Growatt New Energy.
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          COREN Registered Engineering Firm &bull; NEMSA Certified &bull; Sovereign Clean Energy For Nigeria &amp; Africa.
        </p>
      </footer>
    </div>
  );
}
