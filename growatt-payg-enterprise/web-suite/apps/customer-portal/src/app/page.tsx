'use client';

/**
 * @fileoverview Customer Account Portal with Full Unified Energy, Financial & Forecast Storytelling Suite
 * Path: web-suite/apps/customer-portal/src/app/page.tsx
 */

import React, { useState } from 'react';
import { EnergyAnalyticsSuite } from './EnergyAnalyticsSuite';

export default function CustomerAccountPortalPage() {
  const [copiedAcct, setCopiedAcct] = useState<string | null>(null);

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
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 font-sans pb-20 selection:bg-[#10B981] selection:text-[#0B0F19]">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#0B0F19]/90 border-b border-[#64748B]/30 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-white">
              SKY<span className="text-[#22D3EE]">GRID</span> GROWATT &mdash; CUSTOMER ENERGY &amp; FINANCIAL ANALYTICS
            </h1>
            <p className="text-xs text-[#64748B] font-mono">
              Account: Engr. Shwarji I. Khatang &bull; Contract: CTR-NG-2026-001 &bull; Shroud: SEALED
            </p>
          </div>
          <span className="bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 text-xs font-mono font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <span>AC OUTPUT ACTIVE</span>
          </span>
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
        <section className="grid md:grid-cols-12 gap-6 bg-[#111827] border border-[#64748B]/30 rounded-2xl p-6 shadow-xl">
          <div className="md:col-span-7 space-y-3">
            <h2 className="text-base font-bold text-white">
              Instant Dedicated Virtual Account Top-Up (Auto-Unlocks in &lt; 5 Seconds)
            </h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {virtualAccounts.map((va) => (
                <div key={va.acctNo} className="bg-[#1E293B] border border-[#64748B]/30 p-3.5 rounded-xl space-y-1">
                  <span className="text-[10px] font-mono text-[#22D3EE] font-bold">{va.bank}</span>
                  <p className="text-base font-mono font-black text-white">{va.acctNo}</p>
                  <button
                    onClick={() => copyNUBAN(va.acctNo)}
                    className="w-full mt-2 bg-slate-900 hover:bg-[#10B981] hover:text-[#0B0F19] text-xs font-bold py-1.5 rounded-lg border border-[#64748B]/30 transition"
                  >
                    {copiedAcct === va.acctNo ? '✓ Copied' : 'Copy Account No'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-5 bg-[#1E293B]/60 border border-[#22D3EE]/30 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase text-[#22D3EE] font-bold">
                Offline GSM Blackout Fallback (STS / BLE Token)
              </span>
              <p className="text-base font-mono font-black text-[#FFBF00] tracking-widest mt-1">
                0014-00720-8492-1104-5921
              </p>
            </div>
            <p className="text-xs text-slate-300 mt-2">
              If cellular network is down at home after paying, punch this 20-digit code into the lower shroud keypad or beam via Mobile App Bluetooth.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}