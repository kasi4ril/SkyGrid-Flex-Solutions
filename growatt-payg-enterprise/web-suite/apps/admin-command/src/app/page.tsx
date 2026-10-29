/**
 * @fileoverview Executive Admin Command Center, GIS Fleet Watchtower & RMA Console
 * Application: web-suite/apps/admin-command
 */

'use client';

import React, { useState, useMemo } from 'react';

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
  monthly_installment_ngn: number;
}

const INITIAL_FLEET: FleetUnit[] = [
  {
    device_id: 'DEV-8F3A-GROWATT-00421',
    contract_id: 'CTR-ABJ-2026-001',
    customer_name: 'Engr. Amina Danjuma',
    city: 'Maitama',
    state_region: 'FCT ABUJA',
    model_sku: 'Growatt SPF 5000ES (10.24kWh LiFePO4)',
    growatt_serial: 'GW-SPF5000ES-99881',
    seal_serial: 'SEAL-NG-00421',
    earthing_ohms: 2.4,
    gps_lat: 9.0882,
    gps_lng: 7.4934,
    pin_color: 'GREEN',
    contract_status: 'ACTIVE',
    relay_state: 'ACTIVE_ON',
    tamper_state: 'SEALED',
    battery_soc_pct: 92,
    pv_watts: 3420,
    ac_load_watts: 1150,
    inverter_temp_c: 37.5,
    paid_days_left: 19.4,
    monthly_installment_ngn: 185000,
  },
  {
    device_id: 'DEV-4C91-GROWATT-00812',
    contract_id: 'CTR-BEN-2026-014',
    customer_name: 'St. Mary Clinic & Maternity',
    city: 'Otukpo',
    state_region: 'BENUE',
    model_sku: 'Growatt SPH 10000TL (20.48kWh LiFePO4)',
    growatt_serial: 'GW-SPH10000-77210',
    seal_serial: 'SEAL-NG-00812',
    earthing_ohms: 1.9,
    gps_lat: 7.1904,
    gps_lng: 8.1297,
    pin_color: 'GREEN',
    contract_status: 'ACTIVE',
    relay_state: 'ACTIVE_ON',
    tamper_state: 'SEALED',
    battery_soc_pct: 88,
    pv_watts: 6890,
    ac_load_watts: 2940,
    inverter_temp_c: 40.2,
    paid_days_left: 26.0,
    monthly_installment_ngn: 340000,
  },
  {
    device_id: 'DEV-7B12-GROWATT-00509',
    contract_id: 'CTR-JOS-2026-089',
    customer_name: 'Rayfield Cold-Room & Retail',
    city: 'Jos South',
    state_region: 'PLATEAU',
    model_sku: 'Growatt SPF 5000ES (5.12kWh LiFePO4)',
    growatt_serial: 'GW-SPF5000ES-44102',
    seal_serial: 'SEAL-NG-00509',
    earthing_ohms: 3.1,
    gps_lat: 9.8965,
    gps_lng: 8.8583,
    pin_color: 'YELLOW',
    contract_status: 'GRACE_PERIOD',
    relay_state: 'ACTIVE_ON',
    tamper_state: 'SEALED',
    battery_soc_pct: 23,
    pv_watts: 610,
    ac_load_watts: 980,
    inverter_temp_c: 35.0,
    paid_days_left: 0.0,
    monthly_installment_ngn: 132000,
  },
  {
    device_id: 'DEV-9E04-GROWATT-00933',
    contract_id: 'CTR-LAG-2026-112',
    customer_name: 'Lekki Phase 1 Pharmacy',
    city: 'Lekki',
    state_region: 'LAGOS',
    model_sku: 'Growatt SPF 5000ES (5.12kWh LiFePO4)',
    growatt_serial: 'GW-SPF5000ES-61904',
    seal_serial: 'SEAL-NG-00933',
    earthing_ohms: 3.8,
    gps_lat: 6.4474,
    gps_lng: 3.4723,
    pin_color: 'RED',
    contract_status: 'LOCKED_TAMPER',
    relay_state: 'STANDBY_LOCKED',
    tamper_state: 'TRIPPED',
    battery_soc_pct: 96, // MPPT stays active during lockout so battery stays healthy!
    pv_watts: 1420,
    ac_load_watts: 0,
    inverter_temp_c: 33.1,
    paid_days_left: 8.5,
    monthly_installment_ngn: 132000,
  },
];

function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export default function AdminCommandDashboard() {
  const [fleet, setFleet] = useState<FleetUnit[]>(INITIAL_FLEET);
  const [filterPin, setFilterPin] = useState<'ALL' | 'GREEN' | 'YELLOW' | 'RED'>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<FleetUnit>(INITIAL_FLEET[0]);

  // RMA Hardware Swap Modal State
  const [isRMAModalOpen, setIsRMAModalOpen] = useState(false);
  const [newGrowattSN, setNewGrowattSN] = useState('');
  const [newSealSN, setNewSealSN] = useState('');
  const [rmaReason, setRmaReason] = useState('Lightning surge on RS485 board — replaced under 1.75% equipment insurance');

  const filteredFleet = useMemo(() => {
    if (filterPin === 'ALL') return fleet;
    return fleet.filter((u) => u.pin_color === filterPin);
  }, [fleet, filterPin]);

  const kpis = useMemo(() => {
    const totalMRR = fleet.reduce((acc, u) => acc + u.monthly_installment_ngn, 0);
    const tamperedCount = fleet.filter((u) => u.tamper_state === 'TRIPPED').length;
    const greenCount = fleet.filter((u) => u.pin_color === 'GREEN').length;
    return {
      activeCount: fleet.length,
      totalMRR,
      tamperedCount,
      greenCount,
    };
  }, [fleet]);

  const handleSimulateTamperClear = (deviceID: string) => {
    setFleet((prev) =>
      prev.map((u) =>
        u.device_id === deviceID
          ? {
              ...u,
              tamper_state: 'SEALED',
              contract_status: 'ACTIVE',
              relay_state: 'ACTIVE_ON',
              pin_color: 'GREEN',
            }
          : u
      )
    );
  };

  const handleExecuteRMASwap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGrowattSN.trim() || !newSealSN.trim()) return;

    setFleet((prev) =>
      prev.map((u) =>
        u.device_id === selectedUnit.device_id
          ? {
              ...u,
              growatt_serial: newGrowattSN.trim().toUpperCase(),
              seal_serial: newSealSN.trim().toUpperCase(),
              tamper_state: 'SEALED',
              relay_state: 'ACTIVE_ON',
              contract_status: 'ACTIVE',
              pin_color: 'GREEN',
            }
          : u
      )
    );
    setSelectedUnit((prev) => ({
      ...prev,
      growatt_serial: newGrowattSN.trim().toUpperCase(),
      seal_serial: newSealSN.trim().toUpperCase(),
    }));
    setNewGrowattSN('');
    setNewSealSN('');
    setIsRMAModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Top Executive Command Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-lg">
            A
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white">
              SKYTRON GROWATT PAYG — EXECUTIVE ADMIN COMMAND & WATCHTOWER
            </h1>
            <p className="text-xs text-slate-400">
              EMQX 15m Dead-Man&apos;s Switch Active • Growatt EEPROM Flash Wear Guard Enabled
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono">
            MQTT Broker: ONLINE (1883/8883)
          </span>
          <button
            onClick={() => setIsRMAModalOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-white font-semibold px-3.5 py-2 rounded-xl border border-slate-700 transition"
          >
            RMA Inverter Serial Swap
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* 1. EXECUTIVE KPI CARDS */}
        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <p className="text-xs text-slate-400 uppercase font-semibold">Monitored Growatt Fleet</p>
            <p className="text-3xl font-black text-white mt-1">{kpis.activeCount} Units</p>
            <p className="text-xs text-emerald-400 mt-1">
              {kpis.greenCount} Healthy • 100% LiFePO4 Storage
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <p className="text-xs text-slate-400 uppercase font-semibold">Sample Fleet MRR</p>
            <p className="text-3xl font-black text-emerald-400 mt-1 font-mono">{formatNaira(kpis.totalMRR)}</p>
            <p className="text-xs text-slate-400 mt-1">Rails: Moniepoint • Paystack • OPay</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <p className="text-xs text-slate-400 uppercase font-semibold">Collection Efficiency & PAR</p>
            <p className="text-3xl font-black text-cyan-400 mt-1 font-mono">97.4%</p>
            <p className="text-xs text-slate-400 mt-1">PAR &gt; 30 Days: 1.8% (Target &lt; 3.0%)</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <p className="text-xs text-slate-400 uppercase font-semibold">Lower Shroud Tamper Alerts</p>
            <p className={`text-3xl font-black mt-1 font-mono ${kpis.tamperedCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {kpis.tamperedCount} Critical
            </p>
            <p className="text-xs text-slate-400 mt-1">Micro-plunger switch instant lockout</p>
          </div>
        </section>

        {/* 2. GIS FLEET WATCHTOWER & LIVE DEVICE INSPECTOR */}
        <section className="grid lg:grid-cols-12 gap-6">
          {/* Left: GIS Fleet Filter & Unit Matrix */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white">Live Nigerian GIS Fleet Map & Telemetry Matrix</h2>
                <p className="text-xs text-slate-400">Click any deployed Growatt unit to inspect VFS state & hardware seals</p>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                {(['ALL', 'GREEN', 'YELLOW', 'RED'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterPin(status)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${
                      filterPin === status
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
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
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : u.pin_color === 'YELLOW'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30';

                return (
                  <div
                    key={u.device_id}
                    onClick={() => setSelectedUnit(u)}
                    className={`p-4 rounded-xl border cursor-pointer transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-slate-950 border-emerald-500 shadow-lg shadow-emerald-500/5'
                        : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${badgeClass}`}>
                          ● {u.pin_color} / {u.contract_status}
                        </span>
                        <span className="text-xs font-mono text-slate-400">{u.device_id}</span>
                      </div>
                      <p className="text-sm font-bold text-white">
                        {u.customer_name} — <span className="text-emerald-400">{u.city}, {u.state_region}</span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {u.model_sku} • Seal: <span className="font-mono text-slate-300">{u.seal_serial}</span> • Earthing:{' '}
                        <span className="font-mono text-emerald-400">{u.earthing_ohms}Ω</span>
                      </p>
                    </div>

                    <div className="flex sm:flex-col items-end justify-between gap-1 text-right">
                      <span className="text-xs font-mono font-bold text-white">
                        PV: {u.pv_watts}W | Load: {u.ac_load_watts}W
                      </span>
                      <span className="text-xs font-mono text-cyan-400">
                        LiFePO4 SoC: {u.battery_soc_pct}%
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Credit Left: {u.paid_days_left} days
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Deep Hardware & Anti-Tamper Inspector */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono uppercase text-emerald-400">VFS Block Hardware Inspector</span>
                <h3 className="text-base font-bold text-white">{selectedUnit.customer_name}</h3>
              </div>
              <span className="text-xs font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300">
                {selectedUnit.growatt_serial}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <p className="text-slate-400">Contactor / Relay State</p>
                <p className={`text-sm font-black font-mono mt-1 ${selectedUnit.relay_state === 'ACTIVE_ON' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {selectedUnit.relay_state}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Solar MPPT Charger: ACTIVE</p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <p className="text-slate-400">Lower Shroud Tamper Switch</p>
                <p className={`text-sm font-black font-mono mt-1 ${selectedUnit.tamper_state === 'SEALED' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {selectedUnit.tamper_state}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Seal: {selectedUnit.seal_serial}</p>
              </div>
            </div>

            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-2 text-xs font-mono">
              <p className="text-slate-400 font-sans font-semibold">POSIX VFS Block Path:</p>
              <p className="text-emerald-400 break-all">
                /var/lib/payg-vfs/blocks/8f/3a/{selectedUnit.device_id}/state.json
              </p>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-slate-300">
                <span>PV: {selectedUnit.pv_watts}W</span>
                <span>Load: {selectedUnit.ac_load_watts}W</span>
                <span>Temp: {selectedUnit.inverter_temp_c}°C</span>
              </div>
            </div>

            {selectedUnit.tamper_state === 'TRIPPED' && (
              <div className="bg-rose-950/60 border border-rose-500/40 rounded-xl p-4 space-y-3 text-xs">
                <p className="font-bold text-rose-300">
                  🚨 CRITICAL TAMPER LOCKOUT: Micro-plunger switch inside lower terminal box tripped!
                </p>
                <p className="text-slate-300 leading-relaxed">
                  AC Output is locked (`STANDBY_LOCKED`), while the Growatt MPPT Solar Charger remains active ({selectedUnit.battery_soc_pct}% SoC) to prevent parasitic battery death. Automatic payment unlock is blocked until a Field Engineer inspects and re-seals the shroud.
                </p>
                <button
                  onClick={() => handleSimulateTamperClear(selectedUnit.device_id)}
                  className="w-full bg-rose-500 hover:bg-rose-400 text-slate-950 font-extrabold py-2.5 rounded-xl transition"
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">RMA Warranty Inverter Serial Swap</h3>
              <button onClick={() => setIsRMAModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleExecuteRMASwap} className="space-y-3 text-xs">
              <p className="text-slate-400">
                Swapping hardware for <strong className="text-white">{selectedUnit.customer_name}</strong> ({selectedUnit.device_id}). Contract ledger and VFS history will be preserved.
              </p>

              <div>
                <label className="block text-slate-300 mb-1">Current Growatt Serial</label>
                <input
                  disabled
                  value={selectedUnit.growatt_serial}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Replacement Growatt Serial *</label>
                <input
                  required
                  placeholder="e.g. GW-SPF5000ES-88412"
                  value={newGrowattSN}
                  onChange={(e) => setNewGrowattSN(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">New Lower Shroud Steel Seal Serial *</label>
                <input
                  required
                  placeholder="e.g. SEAL-NG-09912"
                  value={newSealSN}
                  onChange={(e) => setNewSealSN(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Engineering RMA Reason</label>
                <input
                  value={rmaReason}
                  onChange={(e) => setRmaReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl mt-2"
              >
                Commit Atomic RMA Swap
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}