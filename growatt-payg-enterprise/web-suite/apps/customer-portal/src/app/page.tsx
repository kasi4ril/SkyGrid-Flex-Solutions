/**
 * @fileoverview Customer Self-Service & PAYGo Telemetry Portal
 * Application: web-suite/apps/customer-portal
 */

'use client';

import React, { useState } from 'react';

interface CustomerProfile {
  name: string;
  deviceId: string;
  contractId: string;
  location: string;
  model: string;
  statusLabel: string;
  statusColor: string;
  daysLeft: number;
  pvWatts: string;
  socPct: string;
  battDetail: string;
  loadWatts: string;
  tempC: string;
  dvaAccount: string;
  dvaName: string;
  monthlyNgn: string;
  stsToken: string;
  equityText: string;
  equityPct: string;
  invSerial: string;
  battSerial: string;
  sealSerial: string;
  earthingOhms: string;
}

const DEMO_PROFILES: Record<string, CustomerProfile> = {
  amina: {
    name: 'Engr. Amina Danjuma',
    deviceId: 'DEV-8F3A-GROWATT-00421',
    contractId: 'CTR-ABJ-2026-001',
    location: 'Maitama, FCT Abuja',
    model: 'Growatt SPF 5000ES (10.24kWh LiFePO4)',
    statusLabel: '● ACTIVE LEASE',
    statusColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    daysLeft: 19.4,
    pvWatts: '3,420 W',
    socPct: '92%',
    battDetail: '10.24 kWh • 53.1V • 27°C',
    loadWatts: '1,150 W',
    tempC: '37.5 °C',
    dvaAccount: '9928174021',
    dvaName: 'SkyGrid / Amina Danjuma',
    monthlyNgn: '₦185,000 / month',
    stsToken: '4819 - 2049 - 5510 - 8291 - 7304',
    equityText: 'Month 11 of 36 (30.5% Equity Owned)',
    equityPct: '30.5%',
    invSerial: 'GW-SPF5000ES-99881',
    battSerial: 'LFP-512V-100AH-441 (10.24kWh)',
    sealSerial: 'SEAL-NG-00421 (INTACT)',
    earthingOhms: '2.4 Ω (COREN Compliant < 5.0Ω)',
  },
  stmary: {
    name: 'St. Mary Clinic & Maternity',
    deviceId: 'DEV-4C91-GROWATT-00812',
    contractId: 'CTR-BEN-2026-014',
    location: 'Otukpo, Benue State',
    model: 'Growatt SPH 10000TL (20.48kWh LiFePO4)',
    statusLabel: '● CLINICAL GRADE ACTIVE',
    statusColor: 'bg-[#19A89A]/20 text-[#19A89A] border-[#19A89A]/30',
    daysLeft: 26.0,
    pvWatts: '6,890 W',
    socPct: '88%',
    battDetail: '20.48 kWh • 52.9V • 29°C',
    loadWatts: '2,940 W',
    tempC: '40.2 °C',
    dvaAccount: '9928174034',
    dvaName: 'SkyGrid / St. Mary Clinic',
    monthlyNgn: '₦340,000 / month',
    stsToken: '7104 - 9921 - 3840 - 1109 - 4820',
    equityText: 'Month 18 of 36 (50.0% Equity Owned)',
    equityPct: '50.0%',
    invSerial: 'GW-SPH10000-77210',
    battSerial: 'LFP-512V-200AH-912 (20.48kWh)',
    sealSerial: 'SEAL-NG-00812 (INTACT)',
    earthingOhms: '1.9 Ω (Hospital Grade Compliant)',
  },
  lekki: {
    name: 'Lekki Phase 1 Pharmacy',
    deviceId: 'DEV-9E04-GROWATT-00933',
    contractId: 'CTR-LAG-2026-112',
    location: 'Lekki Phase 1, Lagos State',
    model: 'Growatt SPF 5000ES (5.12kWh LiFePO4)',
    statusLabel: '⚠️ TAMPER TRIP (MPPT SAFE MODE)',
    statusColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    daysLeft: 8.5,
    pvWatts: '1,420 W',
    socPct: '96%',
    battDetail: '5.12 kWh • 53.4V • 33°C',
    loadWatts: '0 W (Standby Locked)',
    tempC: '33.1 °C',
    dvaAccount: '9928174099',
    dvaName: 'SkyGrid / Lekki Pharmacy',
    monthlyNgn: '₦132,000 / month',
    stsToken: '9901 - 4210 - 8812 - 3401 - 6619',
    equityText: 'Month 6 of 36 (16.6% Equity Owned)',
    equityPct: '16.6%',
    invSerial: 'GW-SPF5000ES-61904',
    battSerial: 'LFP-512V-100AH-301 (5.12kWh)',
    sealSerial: 'SEAL-NG-00933 (TRIPPED - INSPECTION REQUIRED)',
    earthingOhms: '3.8 Ω (COREN Compliant < 5.0Ω)',
  },
};

export default function CustomerPortalPage() {
  const [currentAccountKey, setCurrentAccountKey] = useState<string>('amina');
  const [activeTab, setActiveTab] = useState<'telemetry' | 'paygo' | 'hardware'>('telemetry');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('skygrid_theme');
      if (saved === 'light' || saved === 'dark') {
        setTheme(saved);
        if (saved === 'light') document.documentElement.classList.add('light');
        else document.documentElement.classList.remove('light');
      }
    } catch (e) {}
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('skygrid_theme', next);
    } catch (e) {}
    if (next === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  };

  const profile = DEMO_PROFILES[currentAccountKey] || DEMO_PROFILES.amina;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSimulateTopUp = () => {
    profile.daysLeft = parseFloat((profile.daysLeft + 30).toFixed(1));
    const p1 = Math.floor(1000 + Math.random() * 9000);
    const p2 = Math.floor(1000 + Math.random() * 9000);
    const p3 = Math.floor(1000 + Math.random() * 9000);
    const p4 = Math.floor(1000 + Math.random() * 9000);
    const p5 = Math.floor(1000 + Math.random() * 9000);
    profile.stsToken = `${p1} - ${p2} - ${p3} - ${p4} - ${p5}`;
    showToast(`✓ Top-Up Confirmed! +30 Days Power Added (${profile.daysLeft} Days Total). STS Token Issued.`);
  };

  return (
    <div className={`min-h-screen p-4 sm:p-8 font-sans transition-colors duration-300 ${theme === 'light' ? 'bg-[#F8FAF7] text-[#17231D]' : 'bg-[#0B241B] text-[#F8FAF7]'}`}>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Developer Quick Switcher */}
        <div className="bg-[#123B2A]/60 border border-[#F5B82E]/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#F5B82E] font-bold">⚡ Developer / Demo Access Switcher:</span>
            <span className="text-[#19A89A]">Select profile to preview live telemetry &amp; contract state:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCurrentAccountKey('amina')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                currentAccountKey === 'amina' ? 'bg-[#F5B82E] text-[#0B241B]' : 'bg-white/10 text-white'
              }`}
            >
              Engr. Amina (5kVA Abuja)
            </button>
            <button
              onClick={() => setCurrentAccountKey('stmary')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                currentAccountKey === 'stmary' ? 'bg-[#19A89A] text-[#0B241B]' : 'bg-white/10 text-white'
              }`}
            >
              St. Mary Clinic (10kVA Benue)
            </button>
            <button
              onClick={() => setCurrentAccountKey('lekki')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                currentAccountKey === 'lekki' ? 'bg-amber-500 text-[#0B241B]' : 'bg-white/10 text-white'
              }`}
            >
              Lekki Pharmacy (Tamper Alert)
            </button>
          </div>
        </div>

        {/* Portal Container */}
        <div className={`backdrop-blur-xl border rounded-3xl p-6 sm:p-8 shadow-2xl space-y-8 transition-colors ${
          theme === 'light' ? 'bg-white border-[#123B2A]/15 text-[#17231D]' : 'bg-[#0B241B]/90 border-white/15 text-white'
        }`}>
          
          {/* Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F5B82E] to-[#19A89A] flex items-center justify-center text-[#0B241B] font-extrabold text-xl shadow-lg">
                ⚡
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className={`font-heading font-extrabold text-2xl ${theme === 'light' ? 'text-[#17231D]' : 'text-white'}`}>{profile.name}</h1>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold font-mono ${profile.statusColor}`}>
                    {profile.statusLabel}
                  </span>
                </div>
                <p className="text-xs opacity-70 font-mono mt-0.5">
                  Device: {profile.deviceId} • {profile.location} • {profile.model}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={`${theme === 'light' ? 'bg-[#F0F5F2]' : 'bg-black/40'} px-4 py-2 rounded-xl border border-white/10 text-right`}>
                <span className="text-[10px] opacity-70 uppercase block">Active Power Balance</span>
                <span className="text-lg font-heading font-bold text-[#F5B82E] font-mono">{profile.daysLeft} Days</span>
              </div>
              <button
                onClick={toggleTheme}
                aria-label="Toggle Theme"
                className="px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all bg-white/10 hover:bg-white/20 border border-white/10"
              >
                <span>{theme === 'dark' ? '🌙 Dark' : '☀️ Light'}</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-3 border-b border-white/10 pb-3 text-xs">
            <button
              onClick={() => setActiveTab('telemetry')}
              className={`px-4 py-2 rounded-xl font-bold transition ${
                activeTab === 'telemetry' ? 'bg-[#F5B82E] text-[#0B241B] shadow-md' : 'bg-white/5 text-white hover:bg-white/10'
              }`}
            >
              Live Telemetry &amp; Power Flow
            </button>
            <button
              onClick={() => setActiveTab('paygo')}
              className={`px-4 py-2 rounded-xl font-bold transition ${
                activeTab === 'paygo' ? 'bg-[#F5B82E] text-[#0B241B] shadow-md' : 'bg-white/5 text-white hover:bg-white/10'
              }`}
            >
              PAYGo Contract &amp; STS Token
            </button>
            <button
              onClick={() => setActiveTab('hardware')}
              className={`px-4 py-2 rounded-xl font-bold transition ${
                activeTab === 'hardware' ? 'bg-[#F5B82E] text-[#0B241B] shadow-md' : 'bg-white/5 text-white hover:bg-white/10'
              }`}
            >
              Hardware &amp; Engineering Passport
            </button>
          </div>

          {/* Tab 1: Telemetry */}
          {activeTab === 'telemetry' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                  <span className="text-xs text-[#F8FAF7]/60 block mb-1">Solar PV Generation</span>
                  <div className="text-2xl font-heading font-extrabold text-[#F5B82E] font-mono">{profile.pvWatts}</div>
                  <span className="text-[10px] text-emerald-400 mt-1 block">Active Ingress</span>
                </div>

                <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                  <span className="text-xs text-[#F8FAF7]/60 block mb-1">Battery State of Charge</span>
                  <div className="text-2xl font-heading font-extrabold text-[#19A89A] font-mono">{profile.socPct}</div>
                  <span className="text-[10px] text-[#F8FAF7]/60 mt-1 block font-mono">{profile.battDetail}</span>
                </div>

                <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                  <span className="text-xs text-[#F8FAF7]/60 block mb-1">Household Consumption</span>
                  <div className="text-2xl font-heading font-extrabold text-white font-mono">{profile.loadWatts}</div>
                  <span className="text-[10px] text-emerald-400 mt-1 block">100% Solar Self-Supply</span>
                </div>

                <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                  <span className="text-xs text-[#F8FAF7]/60 block mb-1">Inverter Core Temperature</span>
                  <div className="text-2xl font-heading font-extrabold text-white font-mono">{profile.tempC}</div>
                  <span className="text-[10px] text-[#F8FAF7]/60 mt-1 block">Cooling Fans: Quiet</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: PAYGo */}
          {activeTab === 'paygo' && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-black/40 p-6 rounded-2xl border border-white/10 space-y-4 text-xs">
                <h3 className="font-bold uppercase tracking-wider text-[#19A89A]">Dedicated Virtual Account (DVA)</h3>
                <div className="p-4 rounded-xl bg-[#123B2A]/40 border border-[#19A89A]/30 space-y-2">
                  <div className="flex justify-between"><span className="text-[#F8FAF7]/70">Bank:</span> <span className="font-bold text-white">Moniepoint MFB / Wema Bank</span></div>
                  <div className="flex justify-between"><span className="text-[#F8FAF7]/70">Account Number:</span> <span className="font-bold text-[#F5B82E] font-mono text-sm">{profile.dvaAccount}</span></div>
                  <div className="flex justify-between"><span className="text-[#F8FAF7]/70">Beneficiary:</span> <span className="font-bold text-white">{profile.dvaName}</span></div>
                  <div className="flex justify-between"><span className="text-[#F8FAF7]/70">Monthly Payment:</span> <span className="font-bold text-[#F5B82E] font-mono">{profile.monthlyNgn}</span></div>
                </div>
                <button
                  onClick={handleSimulateTopUp}
                  className="w-full py-3.5 rounded-xl font-bold text-[#0B241B] bg-[#F5B82E] hover:bg-amber-400 transition"
                >
                  Simulate Monthly Bank Transfer Top-Up
                </button>
              </div>

              <div className="bg-black/40 p-6 rounded-2xl border border-white/10 space-y-4 text-xs flex flex-col justify-between">
                <div>
                  <h3 className="font-bold uppercase tracking-wider text-[#F5B82E]">Offline STS Keypad Backup Token</h3>
                  <div className="my-4 p-4 rounded-xl bg-black/60 border border-[#F5B82E]/40 text-center">
                    <span className="text-[10px] text-[#F8FAF7]/60 block mb-1">Enter into Inverter Keypad If Offline</span>
                    <div className="font-mono font-extrabold text-base text-[#F5B82E] py-1">{profile.stsToken}</div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-[#F8FAF7]/70">Ownership Progress:</span>
                      <span className="font-bold text-white font-mono">{profile.equityText}</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div className="bg-[#F5B82E] h-2 rounded-full" style={{ width: profile.equityPct }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Hardware */}
          {activeTab === 'hardware' && (
            <div className="grid md:grid-cols-2 gap-6 text-xs">
              <div className="bg-black/40 p-6 rounded-2xl border border-white/10 space-y-3">
                <h3 className="font-bold uppercase text-white pb-2 border-b border-white/10">Certified Hardware Manifest</h3>
                <div className="flex justify-between"><span className="text-[#F8FAF7]/60">Inverter Serial:</span> <span className="font-mono text-white">{profile.invSerial}</span></div>
                <div className="flex justify-between"><span className="text-[#F8FAF7]/60">Battery Pack:</span> <span className="font-mono text-[#19A89A]">{profile.battSerial}</span></div>
                <div className="flex justify-between"><span className="text-[#F8FAF7]/60">Tamper Seal:</span> <span className="font-mono text-white">{profile.sealSerial}</span></div>
                <div className="flex justify-between"><span className="text-[#F8FAF7]/60">Earthing Ohms:</span> <span className="font-mono text-emerald-400">{profile.earthingOhms}</span></div>
              </div>

              <div className="bg-black/40 p-6 rounded-2xl border border-white/10 space-y-3">
                <h3 className="font-bold uppercase text-white pb-2 border-b border-white/10">Field Engineering Support</h3>
                <p className="text-[#F8FAF7]/75">Assigned Lead Engineer: <strong>Engr. Emeka Okafor</strong> (COREN #48291)</p>
                <button
                  onClick={() => showToast('✓ Service Request Dispatched. Field engineer will call you.')}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition"
                >
                  Request On-Site Service
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0B241B]/95 backdrop-blur-xl border border-[#19A89A]/40 rounded-2xl p-4 shadow-2xl text-xs text-white">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

