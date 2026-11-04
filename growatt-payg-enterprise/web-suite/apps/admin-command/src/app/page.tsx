/**
 * @fileoverview Executive Admin Command Center, GIS Fleet Watchtower & RMA Console
 * Application: web-suite/apps/admin-command
 */

'use client';

import React, { useState, useMemo, useEffect } from 'react';

interface FleetUnit {
  device_id: string;
  contract_id: string;
  customer_name: string;
  city: string;
  state_region: string;
  model_sku: string;
  growatt_serial: string;
  seal_serial: string;
  earthing_ohms: number;
  gps_lat: number;
  gps_lng: number;
  pin_color: 'GREEN' | 'YELLOW' | 'RED';
  contract_status: 'ACTIVE' | 'GRACE_PERIOD' | 'LOCKED_DEFAULT' | 'LOCKED_TAMPER' | 'FULLY_OWNED';
  relay_state: 'ACTIVE_ON' | 'STANDBY_LOCKED' | 'FAULT_OFF';
  tamper_state: 'SEALED' | 'TRIPPED';
  battery_soc_pct: number;
  pv_watts: number;
  ac_load_watts: number;
  inverter_temp_c: number;
  paid_days_left: number;
  last_mqtt_seen: string;
}

const INITIAL_FLEET: FleetUnit[] = [
  {
    device_id: 'DEV-8F3A-GROWATT-00421',
    contract_id: 'CTR-NG-2026-001',
    customer_name: 'Engr. Shwarji I. Khatang',
    city: 'Jos',
    state_region: 'Plateau State (Middle Belt)',
    model_sku: 'GW-SPF5000-LFP5',
    growatt_serial: 'GW-SPF5000ES-94210',
    seal_serial: 'SEAL-NG-04210',
    earthing_ohms: 1.85,
    gps_lat: 9.8965,
    gps_lng: 8.8583,
    pin_color: 'GREEN',
    contract_status: 'ACTIVE',
    relay_state: 'ACTIVE_ON',
    tamper_state: 'SEALED',
    battery_soc_pct: 94,
    pv_watts: 3420,
    ac_load_watts: 850,
    inverter_temp_c: 41.2,
    paid_days_left: 19,
    last_mqtt_seen: 'Just now (12s ago)',
  },
  {
    device_id: 'DEV-1A9F-GROWATT-00108',
    contract_id: 'CTR-NG-2026-002',
    customer_name: 'Dr. Aisha Bello',
    city: 'Wuse II, Abuja',
    state_region: 'FCT Abuja (Middle Belt)',
    model_sku: 'GW-SPF3000-LFP5',
    growatt_serial: 'GW-SPF3000TL-10802',
    seal_serial: 'SEAL-NG-01082',
    earthing_ohms: 2.1,
    gps_lat: 9.0765,
    gps_lng: 7.3986,
    pin_color: 'GREEN',
    contract_status: 'ACTIVE',
    relay_state: 'ACTIVE_ON',
    tamper_state: 'SEALED',
    battery_soc_pct: 88,
    pv_watts: 2150,
    ac_load_watts: 620,
    inverter_temp_c: 38.6,
    paid_days_left: 26,
    last_mqtt_seen: '35s ago',
  },
  {
    device_id: 'DEV-4C2B-GROWATT-00389',
    contract_id: 'CTR-NG-2026-003',
    customer_name: 'Chief Emeka Okafor',
    city: 'Lekki Phase 1, Lagos',
    state_region: 'Lagos State (Southern Coastal)',
    model_sku: 'GW-SPF6000-LFP10',
    growatt_serial: 'GW-SPF6000DVM-38914',
    seal_serial: 'SEAL-NG-03894',
    earthing_ohms: 2.45,
    gps_lat: 6.4474,
    gps_lng: 3.4842,
    pin_color: 'YELLOW',
    contract_status: 'GRACE_PERIOD',
    relay_state: 'ACTIVE_ON',
    tamper_state: 'SEALED',
    battery_soc_pct: 64,
    pv_watts: 4100,
    ac_load_watts: 2400,
    inverter_temp_c: 44.1,
    paid_days_left: 1,
    last_mqtt_seen: '1m ago',
  },
  {
    device_id: 'DEV-9D7E-GROWATT-00512',
    contract_id: 'CTR-NG-2026-004',
    customer_name: 'Alhaji Musa Danjuma',
    city: 'Bompai Industrial, Kano',
    state_region: 'Kano State (Northern Sahel)',
    model_sku: 'GW-MAX10K-LFP15',
    growatt_serial: 'GW-MAX10000-51201',
    seal_serial: 'SEAL-NG-05121',
    earthing_ohms: 1.6,
    gps_lat: 12.0022,
    gps_lng: 8.592,
    pin_color: 'RED',
    contract_status: 'LOCKED_TAMPER',
    relay_state: 'STANDBY_LOCKED',
    tamper_state: 'TRIPPED',
    battery_soc_pct: 72,
    pv_watts: 6800,
    ac_load_watts: 0,
    inverter_temp_c: 46.5,
    paid_days_left: 14,
    last_mqtt_seen: '45s ago',
  },
];

export default function AdminCommandCenter() {
  const [fleet, setFleet] = useState<FleetUnit[]>(INITIAL_FLEET);
  const [selectedUnit, setSelectedUnit] = useState<FleetUnit>(INITIAL_FLEET[0]);
  const [filterPin, setFilterPin] = useState<'ALL' | 'GREEN' | 'YELLOW' | 'RED'>('ALL');
  const [isRMAModalOpen, setIsRMAModalOpen] = useState(false);
  const [showAboutCharter, setShowAboutCharter] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // RMA Form State
  const [newGrowattSN, setNewGrowattSN] = useState('');
  const [newSealSN, setNewSealSN] = useState('');
  const [rmaReason, setRmaReason] = useState('Overvoltage lightning strike on AC input - COREN warranty replacement');

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

  const filteredFleet = useMemo(() => {
    if (filterPin === 'ALL') return fleet;
    return fleet.filter((u) => u.pin_color === filterPin);
  }, [fleet, filterPin]);

  const kpis = useMemo(() => {
    const activeCount = fleet.length;
    const greenCount = fleet.filter((u) => u.pin_color === 'GREEN').length;
    const tamperedCount = fleet.filter((u) => u.tamper_state === 'TRIPPED').length;
    const totalMRR = 3450000;
    return { activeCount, greenCount, tamperedCount, totalMRR };
  }, [fleet]);

  const formatNaira = (amt: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(amt);
  };

  const handleSimulateTamperClear = (deviceId: string) => {
    setFleet((prev) =>
      prev.map((unit) => {
        if (unit.device_id === deviceId) {
          const updated: FleetUnit = {
            ...unit,
            tamper_state: 'SEALED',
            relay_state: 'ACTIVE_ON',
            contract_status: 'ACTIVE',
            pin_color: 'GREEN',
          };
          if (selectedUnit.device_id === deviceId) {
            setSelectedUnit(updated);
          }
          return updated;
        }
        return unit;
      })
    );
  };

  const handleExecuteRMASwap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGrowattSN || !newSealSN) return;

    setFleet((prev) =>
      prev.map((unit) => {
        if (unit.device_id === selectedUnit.device_id) {
          const updated: FleetUnit = {
            ...unit,
            growatt_serial: newGrowattSN,
            seal_serial: newSealSN,
            tamper_state: 'SEALED',
            relay_state: 'ACTIVE_ON',
            pin_color: 'GREEN',
          };
          setSelectedUnit(updated);
          return updated;
        }
        return unit;
      })
    );

    setIsRMAModalOpen(false);
    setNewGrowattSN('');
    setNewSealSN('');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Top Executive Command Bar */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-lg">
            A
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
              SKYGRID GROWATT PAYG — EXECUTIVE ADMIN COMMAND & WATCHTOWER
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              EMQX 15m Dead-Man&apos;s Switch Active • Growatt EEPROM Flash Wear Guard Enabled
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-amber-400 border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 text-xs font-semibold"
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
            onClick={() => setShowAboutCharter(true)}
            className="bg-slate-100 hover:bg-slate-200 text-emerald-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-emerald-400 font-semibold px-3 py-2 rounded-xl border border-emerald-500/30 transition flex items-center gap-1.5"
          >
            <span>🌍</span>
            <span>About Corporate Charter</span>
          </button>
          <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono">
            MQTT Broker: ONLINE (1883/8883)
          </span>
          <button
            onClick={() => setIsRMAModalOpen(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white font-semibold px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 transition"
          >
            RMA Inverter Serial Swap
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* 1. EXECUTIVE KPI CARDS */}
        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 rounded-2xl shadow-sm dark:shadow-xl transition-colors duration-200">
            <p className="text-xs text-slate-600 dark:text-slate-400 uppercase font-semibold">Monitored Growatt Fleet</p>
            <p className="text-3xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">{kpis.activeCount} Units</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
              {kpis.greenCount} Healthy • 100% LiFePO4 Storage
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 rounded-2xl shadow-sm dark:shadow-xl transition-colors duration-200">
            <p className="text-xs text-slate-600 dark:text-slate-400 uppercase font-semibold">Sample Fleet MRR</p>
            <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400 mt-1 font-mono tabular-nums">{formatNaira(kpis.totalMRR)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Rails: Moniepoint • Paystack • OPay</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 rounded-2xl shadow-sm dark:shadow-xl transition-colors duration-200">
            <p className="text-xs text-slate-600 dark:text-slate-400 uppercase font-semibold">Collection Efficiency & PAR</p>
            <p className="text-3xl font-black text-sky-700 dark:text-cyan-400 mt-1 font-mono tabular-nums">97.4%</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">PAR &gt; 30 Days: 1.8% (Target &lt; 3.0%)</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 rounded-2xl shadow-sm dark:shadow-xl transition-colors duration-200">
            <p className="text-xs text-slate-600 dark:text-slate-400 uppercase font-semibold">Lower Shroud Tamper Alerts</p>
            <p className={`text-3xl font-black mt-1 font-mono tabular-nums ${kpis.tamperedCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
              {kpis.tamperedCount} Critical
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Micro-plunger switch instant lockout</p>
          </div>
        </section>

        {/* 2. GIS FLEET WATCHTOWER & LIVE DEVICE INSPECTOR */}
        <section className="grid lg:grid-cols-12 gap-6">
          {/* Left: GIS Fleet Filter & Unit Matrix */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm dark:shadow-xl transition-colors duration-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Live Nigerian GIS Fleet Map & Telemetry Matrix</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">Click any deployed Growatt unit to inspect VFS state & hardware seals</p>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                {(['ALL', 'GREEN', 'YELLOW', 'RED'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterPin(status)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${
                      filterPin === status
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-emerald-500 dark:text-slate-950'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900 dark:bg-slate-950 dark:text-slate-400 dark:hover:text-white border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredFleet.map((u) => {
                const isSelected = u.device_id === selectedUnit.device_id;
                const badgeClass =
                  u.pin_color === 'GREEN'
                    ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-600/30 dark:border-emerald-500/30'
                    : u.pin_color === 'YELLOW'
                    ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-600/30 dark:border-amber-500/30'
                    : 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-600/30 dark:border-rose-500/30';

                return (
                  <div
                    key={u.device_id}
                    onClick={() => setSelectedUnit(u)}
                    className={`p-4 rounded-xl border cursor-pointer transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-emerald-50/50 dark:bg-slate-950 border-emerald-500 shadow-md shadow-emerald-500/10'
                        : 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${badgeClass}`}>
                          ● {u.pin_color} / {u.contract_status}
                        </span>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{u.device_id}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {u.customer_name} — <span className="text-emerald-700 dark:text-emerald-400">{u.city}, {u.state_region}</span>
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {u.model_sku} • Seal: <span className="font-mono text-slate-800 dark:text-slate-300">{u.seal_serial}</span> • Earthing:{' '}
                        <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">{u.earthing_ohms}Ω</span>
                      </p>
                    </div>

                    <div className="flex sm:flex-col items-end justify-between gap-1 text-right">
                      <span className="text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                        PV: {u.pv_watts}W | Load: {u.ac_load_watts}W
                      </span>
                      <span className="text-xs font-mono text-sky-700 dark:text-cyan-400 tabular-nums">
                        LiFePO4 SoC: {u.battery_soc_pct}%
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        Credit Left: {u.paid_days_left} days
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Deep Hardware & Anti-Tamper Inspector */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 space-y-5 shadow-sm dark:shadow-xl transition-colors duration-200">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono uppercase text-emerald-700 dark:text-emerald-400 font-bold">VFS Block Hardware Inspector</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{selectedUnit.customer_name}</h3>
              </div>
              <span className="text-xs font-mono bg-slate-100 dark:bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300">
                {selectedUnit.growatt_serial}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <p className="text-slate-600 dark:text-slate-400">Contactor / Relay State</p>
                <p className={`text-sm font-black font-mono mt-1 ${selectedUnit.relay_state === 'ACTIVE_ON' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                  {selectedUnit.relay_state}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Solar MPPT Charger: ACTIVE</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <p className="text-slate-600 dark:text-slate-400">Lower Shroud Tamper Switch</p>
                <p className={`text-sm font-black font-mono mt-1 ${selectedUnit.tamper_state === 'SEALED' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                  {selectedUnit.tamper_state}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Seal: {selectedUnit.seal_serial}</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-2 text-xs font-mono">
              <p className="text-slate-600 dark:text-slate-400 font-sans font-semibold">POSIX VFS Block Path:</p>
              <p className="text-emerald-700 dark:text-emerald-400 break-all">
                /var/lib/payg-vfs/blocks/8f/3a/{selectedUnit.device_id}/state.json
              </p>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 tabular-nums">
                <span>PV: {selectedUnit.pv_watts}W</span>
                <span>Load: {selectedUnit.ac_load_watts}W</span>
                <span>Temp: {selectedUnit.inverter_temp_c}°C</span>
              </div>
            </div>

            {selectedUnit.tamper_state === 'TRIPPED' && (
              <div className="bg-rose-500/10 border border-rose-500/40 rounded-xl p-4 space-y-3 text-xs">
                <p className="font-bold text-rose-800 dark:text-rose-300">
                  🚨 CRITICAL TAMPER LOCKOUT: Micro-plunger switch inside lower terminal box tripped!
                </p>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  AC Output is locked (`STANDBY_LOCKED`), while the Growatt MPPT Solar Charger remains active ({selectedUnit.battery_soc_pct}% SoC) to prevent parasitic battery death. Automatic payment unlock is blocked until a Field Engineer inspects and re-seals the shroud.
                </p>
                <button
                  onClick={() => handleSimulateTamperClear(selectedUnit.device_id)}
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white dark:bg-rose-500 dark:hover:bg-rose-400 dark:text-slate-950 font-extrabold py-2.5 rounded-xl transition"
                >
                  Verify Field Re-Seal & Clear Tamper Lockout
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* RMA HARDWARE SERIAL SWAP MODAL */}
      {isRMAModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">RMA Warranty Inverter Serial Swap</h3>
              <button onClick={() => setIsRMAModalOpen(false)} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">✕</button>
            </div>

            <form onSubmit={handleExecuteRMASwap} className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-400">
                Swapping hardware for <strong className="text-slate-900 dark:text-white">{selectedUnit.customer_name}</strong> ({selectedUnit.device_id}). Contract ledger and VFS history will be preserved.
              </p>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Current Growatt Serial</label>
                <input
                  disabled
                  value={selectedUnit.growatt_serial}
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-500 font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Replacement Growatt Serial *</label>
                <input
                  required
                  placeholder="e.g. GW-SPF5000ES-88412"
                  value={newGrowattSN}
                  onChange={(e) => setNewGrowattSN(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">New Lower Shroud Steel Seal Serial *</label>
                <input
                  required
                  placeholder="e.g. SEAL-NG-09912"
                  value={newSealSN}
                  onChange={(e) => setNewSealSN(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Engineering RMA Reason</label>
                <input
                  value={rmaReason}
                  onChange={(e) => setRmaReason(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950 font-bold py-2.5 rounded-xl mt-2 shadow-lg"
              >
                Commit Atomic RMA Swap
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Corporate Charter Modal */}
      {showAboutCharter && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-slate-900 dark:text-slate-100">
            <button
              onClick={() => setShowAboutCharter(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white flex items-center justify-center text-sm transition"
            >
              &times;
            </button>

            <div className="space-y-1">
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider">
                🌍 Executive Corporate Charter
              </span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                SkyGrid Flex Solutions &bull; World-Standard Clean Energy
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                In Strategic Alliance with SkyTron Quantum Solutions &amp; Growatt New Energy.
              </p>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
              <p>
                SkyGrid Flex Solutions is an institutional-grade Clean Energy-as-a-Service infrastructure firm established to dismantle Nigeria&apos;s electricity deficit and eliminate fossil-fuel generator reliance across Sub-Saharan Africa.
              </p>

              <div className="grid sm:grid-cols-2 gap-4 my-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-sky-500/30 dark:border-cyan-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-sky-800 dark:text-cyan-400 font-bold text-sm">
                    <span>🔭</span> Corporate Vision
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    To build Africa&apos;s most intelligent and resilient clean energy ecosystem—eradicating energy poverty and guaranteeing continuous, sovereign solar electric power for every Nigerian home, scaling to power 50 million African lives by 2035.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 font-bold text-sm">
                    <span>🎯</span> Corporate Mission
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    To permanently eliminate fossil-fuel generators across Nigeria and Africa by deploying military-grade Growatt hybrid inverters and 6,000-cycle LiFePO4 storage via accessible PAYG financing, precision COREN/NEMSA engineering, and edge IoT telematics.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-slate-900 dark:text-white font-bold text-sm">World-Standard Operating Principles</h4>
                <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 list-disc list-inside">
                  <li><strong className="text-slate-900 dark:text-white">COREN &amp; NEMSA Standards:</strong> Strict electrical engineering, Type-2 SPDs, lightning arrestors, and deep earthing &le; 2.5&Omega;.</li>
                  <li><strong className="text-slate-900 dark:text-white">100% LiFePO4 Lithium Mandate:</strong> 6,000+ cycles (15+ year lifespan) with zero Lead-Acid or Gel batteries.</li>
                  <li><strong className="text-slate-900 dark:text-white">Offline STS Keypad Mesh:</strong> 20-digit encrypted token generation for uninterrupted power during telecommunication cell tower blackouts.</li>
                  <li><strong className="text-slate-900 dark:text-white">Pan-African Horizon:</strong> Regional deployment across Nigeria&apos;s 36 states and the broader ECOWAS clean energy corridor.</li>
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowAboutCharter(false)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-lg"
              >
                Dismiss Charter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Command Footer */}
      <footer className="mt-12 border-t border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 py-6 px-6 text-center text-xs text-slate-600 dark:text-slate-500">
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
