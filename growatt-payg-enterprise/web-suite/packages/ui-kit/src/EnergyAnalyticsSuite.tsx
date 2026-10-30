/**
 * @fileoverview Enterprise 4-Quadrant Energy & Financial Statistical Analytics Suite
 * Shared identically between `customer-portal` (Authenticated Account Dashboard)
 * and `public-showroom` (Main Landing Page Live Interactive Preview).
 *
 * Statistical Visualization Standards Implemented:
 * 1. Dual-Axis Multi-Series Spline Line & Area Graph (24h Solar W vs. Load W + LiFePO4 SoC %)
 * 2. Stacked & Grouped Categorical Financial Bar Chart (30d Petrol + Band A Grid vs. Fixed Solar Lease)
 * 3. Paired Daily Integral Column Bar Chart (7d Forecasted Solar kWh vs. Load kWh + Cloud Cover)
 * 4. Contiguous-Bin Statistical Frequency Histogram (30d Load Watts & LiFePO4 SoC % Operating Regimes)
 */

'use client';

import React, { useState, useMemo } from 'react';

export interface EnergyAnalyticsSuiteProps {
  mode?: 'CUSTOMER_PORTAL' | 'PUBLIC_PREVIEW';
  deviceID?: string;
  customerState?: string;
}

interface HourlyForecastPoint {
  hourLabel: string;
  solarW: number;
  baseLoadW: number;
  baseSoC: number;
}

const BASE_24H_TELEMETRY: HourlyForecastPoint[] = [
  { hourLabel: '00:00', solarW: 0, baseLoadW: 380, baseSoC: 76 },
  { hourLabel: '03:00', solarW: 0, baseLoadW: 340, baseSoC: 70 },
  { hourLabel: '06:00', solarW: 60, baseLoadW: 520, baseSoC: 64 },
  { hourLabel: '09:00', solarW: 1950, baseLoadW: 780, baseSoC: 78 },
  { hourLabel: '12:00', solarW: 3650, baseLoadW: 1150, baseSoC: 96 },
  { hourLabel: '15:00', solarW: 3120, baseLoadW: 940, baseSoC: 100 },
  { hourLabel: '18:00', solarW: 180, baseLoadW: 1050, baseSoC: 92 },
  { hourLabel: '21:00', solarW: 0, baseLoadW: 1240, baseSoC: 82 },
  { hourLabel: '24:00', solarW: 0, baseLoadW: 450, baseSoC: 74 },
];

const SEVEN_DAY_PAIRED_KWH = [
  { day: 'Fri', date: 'Oct 30', solarKWh: 21.4, loadKWh: 14.8, cloudPct: 18, deficit: false },
  { day: 'Sat', date: 'Oct 31', solarKWh: 22.1, loadKWh: 15.6, cloudPct: 14, deficit: false },
  { day: 'Sun', date: 'Nov 01', solarKWh: 12.6, loadKWh: 15.2, cloudPct: 76, deficit: true },
  { day: 'Mon', date: 'Nov 02', solarKWh: 20.8, loadKWh: 14.1, cloudPct: 22, deficit: false },
  { day: 'Tue', date: 'Nov 03', solarKWh: 21.9, loadKWh: 14.5, cloudPct: 15, deficit: false },
  { day: 'Wed', date: 'Nov 04', solarKWh: 22.5, loadKWh: 14.3, cloudPct: 12, deficit: false },
  { day: 'Thu', date: 'Nov 05', solarKWh: 21.2, loadKWh: 14.7, cloudPct: 19, deficit: false },
];

const LOAD_REGIME_HISTOGRAM_BINS = [
  { binRange: '0 – 400W', label: 'Night Baseload', pctHours: 38, hoursCount: 274, color: '#10b981' },
  { binRange: '400 – 1000W', label: 'Fridge + Fans + TV', pctHours: 34, hoursCount: 245, color: '#06b6d4' },
  { binRange: '1000 – 2000W', label: '1HP Inverter AC', pctHours: 21, hoursCount: 151, color: '#3b82f6' },
  { binRange: '2000 – 3500W', label: 'Borehole + AC', pctHours: 6, hoursCount: 43, color: '#f59e0b' },
  { binRange: '3500 – 5000W', label: 'Peak Motor Surge', pctHours: 1, hoursCount: 7, color: '#f43f5e' },
];

const SOC_DISTRIBUTION_HISTOGRAM_BINS = [
  { binRange: '0 – 20%', label: 'DoD Safety Floor', pctHours: 0, hoursCount: 0, color: '#f43f5e' },
  { binRange: '20 – 40%', label: 'Deep Reserve', pctHours: 8, hoursCount: 58, color: '#f59e0b' },
  { binRange: '40 – 60%', label: 'Morning Wakeup', pctHours: 19, hoursCount: 137, color: '#3b82f6' },
  { binRange: '60 – 80%', label: 'Evening Cycling', pctHours: 31, hoursCount: 223, color: '#06b6d4' },
  { binRange: '80 – 100%', label: 'Full Solar Saturation', pctHours: 42, hoursCount: 302, color: '#10b981' },
];

function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function EnergyAnalyticsSuite({
  mode = 'CUSTOMER_PORTAL',
  deviceID = 'DEV-8F3A-GROWATT-00421',
  customerState = 'JOS / PLATEAU (5.3 PSH)',
}: EnergyAnalyticsSuiteProps) {
  // Interactive "What-If" Simulation States for Chart 1 (Line Graph)
  const [simulateNightAC, setSimulateNightAC] = useState<boolean>(false);
  const [shiftPumpToMidday, setShiftPumpToMidday] = useState<boolean>(true);

  // Interactive Financial Benchmark States for Chart 2 (Stacked Bar Chart)
  const [petrolPriceNGN, setPetrolPriceNGN] = useState<number>(1250);
  const [dailyGenHours, setDailyGenHours] = useState<number>(5);
  const [monthlyDisCoBillNGN, setMonthlyDisCoBillNGN] = useState<number>(65000);
  const fixedSolarInstallmentNGN = 145000;

  // Toggle for Chart 4 (Statistical Histogram: Load Watts vs. Battery SoC %)
  const [histogramMode, setHistogramMode] = useState<'LOAD_WATTS' | 'BATTERY_SOC'>('LOAD_WATTS');

  // 1. Dynamically Compute 24-Hour Line Graph Series based on "What-If" Toggles
  const simulated24hSeries = useMemo(() => {
    return BASE_24H_TELEMETRY.map((pt, idx) => {
      let loadW = pt.baseLoadW;
      let soc = pt.baseSoC;

      // If user shifts 1HP Borehole Pump (750W) to 12:00 PM peak sun vs running at 06:00 AM
      if (shiftPumpToMidday) {
        if (pt.hourLabel === '12:00') loadW += 750;
      } else {
        if (pt.hourLabel === '06:00') {
          loadW += 750;
          soc = Math.max(22, soc - 14);
        }
      }

      // If user runs an extra 1HP AC overnight (21:00 - 03:00)
      if (simulateNightAC && (idx <= 1 || idx >= 6)) {
        loadW += 850;
        soc = Math.max(20, soc - 22);
      }

      return {
        ...pt,
        loadW,
        soc,
      };
    });
  }, [simulateNightAC, shiftPumpToMidday]);

  // 2. Dynamically Compute 30-Day Petrol + DisCo Band A Stacked Bar Metrics
  const financialMetrics = useMemo(() => {
    const monthlyFuelLiters = Math.round(dailyGenHours * 1.35 * 30);
    const monthlyFuelCost = monthlyFuelLiters * petrolPriceNGN;
    const monthlyGenMaintenance = dailyGenHours >= 2 ? 18000 : 0;
    const totalFossilAndGridCost = monthlyFuelCost + monthlyGenMaintenance + monthlyDisCoBillNGN;
    const netMonthlyCashflowGain = totalFossilAndGridCost - fixedSolarInstallmentNGN;

    return {
      monthlyFuelLiters,
      monthlyFuelCost,
      monthlyGenMaintenance,
      totalFossilAndGridCost,
      netMonthlyCashflowGain,
    };
  }, [petrolPriceNGN, dailyGenHours, monthlyDisCoBillNGN]);

  // SVG Coordinate Helpers for Chart 1 (720x250 canvas)
  const chartWidth = 640;
  const chartHeight = 190;
  const padLeft = 48;
  const padTop = 20;

  const solarPointsAttr = simulated24hSeries
    .map((pt, i) => {
      const x = padLeft + (i / (simulated24hSeries.length - 1)) * chartWidth;
      const y = padTop + chartHeight - (pt.solarW / 4000) * chartHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const solarAreaAttr = `${padLeft},${padTop + chartHeight} ${solarPointsAttr} ${
    padLeft + chartWidth
  },${padTop + chartHeight}`;

  const loadPointsAttr = simulated24hSeries
    .map((pt, i) => {
      const x = padLeft + (i / (simulated24hSeries.length - 1)) * chartWidth;
      const y = padTop + chartHeight - (pt.loadW / 4000) * chartHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const socPointsAttr = simulated24hSeries
    .map((pt, i) => {
      const x = padLeft + (i / (simulated24hSeries.length - 1)) * chartWidth;
      const y = padTop + chartHeight - (pt.soc / 100) * chartHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const activeHistogramBins =
    histogramMode === 'LOAD_WATTS' ? LOAD_REGIME_HISTOGRAM_BINS : SOC_DISTRIBUTION_HISTOGRAM_BINS;

  return (
    <div className="space-y-6">
      {/* Context Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
              {mode === 'PUBLIC_PREVIEW'
                ? '● LIVE INTERACTIVE CUSTOMER PORTAL PREVIEW (SAMPLE ACCOUNT TELEMETRY)'
                : `● LIVE ANALYTICS ENGINE — ${deviceID}`}
            </p>
            <p className="text-[11px] text-slate-400">
              Irradiance Zone: <strong className="text-slate-200">{customerState}</strong> • Growatt SPF 5000ES + 10.24kWh LiFePO4
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg font-mono text-cyan-300">
            Harmattan Dust Loss: 3.4% (Clean)
          </span>
          <span className="bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-lg font-mono font-bold text-emerald-300">
            Credit Clock: 19.5 Days Left
          </span>
        </div>
      </div>

      {/* QUADRANT 1: EXECUTIVE KPI SCOREBOARD (4 HIGH-SIGNAL CARDS) */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
            1. 30-Day Fossil Spend Avoided
          </p>
          <p className="text-2xl sm:text-3xl font-black text-white font-mono mt-1">
            {formatNaira(financialMetrics.totalFossilAndGridCost)}
          </p>
          <p className="text-[11px] text-emerald-400 mt-1">
            ⛽ {financialMetrics.monthlyFuelLiters}L Petrol Displaced + Band A Grid
          </p>
        </div>

        <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-5 shadow-lg shadow-emerald-500/5">
          <p className="text-[11px] uppercase tracking-wider text-emerald-300 font-bold">
            2. Net Monthly Cashflow Profit
          </p>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono mt-1">
            +{formatNaira(Math.max(0, financialMetrics.netMonthlyCashflowGain))}
            <span className="text-xs font-normal text-slate-400">/mo</span>
          </p>
          <p className="text-[11px] text-slate-300 mt-1">
            Saved after paying {formatNaira(fixedSolarInstallmentNGN)} solar lease
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
            3. Solar Self-Sufficiency Ratio
          </p>
          <p className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono mt-1">94.2%</p>
          <p className="text-[11px] text-slate-400 mt-1">
            612 kWh PV Generated vs. 649 kWh Demand
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex justify-between items-center">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
              4. Lease-to-Own Equity
            </p>
            <span className="text-[11px] font-mono font-bold text-emerald-400">38.9% Owned</span>
          </div>
          <p className="text-2xl font-black text-white font-mono mt-1">14 / 36 Mos</p>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full" style={{ width: '38.9%' }} />
          </div>
        </div>
      </div>

      {/* CHARTS ROW 1: 24H DUAL-AXIS LINE GRAPH + 30D STACKED FINANCIAL BAR CHART */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* CHART 1: 24-HOUR DUAL-AXIS SPLINE LINE & AREA GRAPH */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold">
                CHART 1 • DUAL-AXIS LINE GRAPH (CONTINUOUS TIME-SERIES)
              </span>
              <h3 className="text-base font-bold text-white">
                24-Hour Forecasted Solar Generation (W) vs. Load Demand (W) & LiFePO4 SoC (%)
              </h3>
            </div>

            {/* Interactive What-If Load Buttons */}
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setShiftPumpToMidday(!shiftPumpToMidday)}
                className={`px-2.5 py-1 rounded-lg font-semibold border transition ${
                  shiftPumpToMidday
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-950 border-slate-700 text-slate-400'
                }`}
              >
                {shiftPumpToMidday ? '✓ Borehole Pump @ 12:00 PM (Free Sun)' : '⚠️ Borehole Pump @ 06:00 AM (Drains Batt)'}
              </button>
              <button
                type="button"
                onClick={() => setSimulateNightAC(!simulateNightAC)}
                className={`px-2.5 py-1 rounded-lg font-semibold border transition ${
                  simulateNightAC
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-slate-950 border-slate-700 text-slate-400'
                }`}
              >
                {simulateNightAC ? '❄️ +1HP Night AC Simulated (+850W)' : '+ Simulate Night 1HP AC'}
              </button>
            </div>
          </div>

          {/* SVG Dual-Axis Line & Area Graph */}
          <div className="w-full overflow-x-auto">
            <svg viewBox="0 0 740 250" className="w-full h-auto select-none">
              <defs>
                <linearGradient id="solarAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.45" />
                  <stop offset="60%" stopColor="#10b981" stopOpacity="0.20" />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines & Left Axis (Watts: 0W to 4,000W) */}
              {[0, 1000, 2000, 3000, 4000].map((wVal) => {
                const y = padTop + chartHeight - (wVal / 4000) * chartHeight;
                return (
                  <g key={wVal}>
                    <line x1={padLeft} y1={y} x2={padLeft + chartWidth} y2={y} stroke="#1e293b" strokeWidth="1" />
                    <text x={padLeft - 6} y={y + 4} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">
                      {wVal}W
                    </text>
                  </g>
                );
              })}

              {/* Right Axis Labels (Battery SoC %: 0% to 100%) */}
              {[20, 50, 80, 100].map((socVal) => {
                const y = padTop + chartHeight - (socVal / 100) * chartHeight;
                return (
                  <text
                    key={socVal}
                    x={padLeft + chartWidth + 8}
                    y={y + 4}
                    textAnchor="start"
                    fill="#38bdf8"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {socVal}%
                  </text>
                );
              })}

              {/* Highlighted Midday "Free Solar Window" Band (10:30 AM - 02:30 PM) */}
              <rect
                x={padLeft + chartWidth * 0.42}
                y={padTop}
                width={chartWidth * 0.22}
                height={chartHeight}
                fill="#0ea5e9"
                fillOpacity="0.08"
              />
              <text
                x={padLeft + chartWidth * 0.53}
                y={padTop + 14}
                textAnchor="middle"
                fill="#38bdf8"
                fontSize="9"
                fontWeight="bold"
              >
                ⚡ FREE SURPLUS SOLAR WINDOW
              </text>

              {/* 20% LiFePO4 Depth-of-Discharge Safety Floor Line */}
              <line
                x1={padLeft}
                y1={padTop + chartHeight - 0.2 * chartHeight}
                x2={padLeft + chartWidth}
                y2={padTop + chartHeight - 0.2 * chartHeight}
                stroke="#f43f5e"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <text
                x={padLeft + 8}
                y={padTop + chartHeight - 0.2 * chartHeight - 5}
                fill="#fb7185"
                fontSize="9"
                fontFamily="monospace"
              >
                20% LiFePO4 DoD Protection Floor
              </text>

              {/* Series 1: Solar PV Generation Area & Line (Sky Blue to Emerald Clean Solar) */}
              <polygon points={solarAreaAttr} fill="url(#solarAreaGrad)" />
              <polyline
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="3"
                points={solarPointsAttr}
              />

              {/* Series 2: Home/SME Load Demand Line (Amber) */}
              <polyline
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                points={loadPointsAttr}
              />

              {/* Series 3: Projected LiFePO4 Battery SoC % Trajectory (Cyan Dashed) */}
              <polyline
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                points={socPointsAttr}
              />

              {/* Data Nodes & X-Axis Hour Labels */}
              {simulated24hSeries.map((pt, i) => {
                const x = padLeft + (i / (simulated24hSeries.length - 1)) * chartWidth;
                const ySolar = padTop + chartHeight - (pt.solarW / 4000) * chartHeight;
                const yLoad = padTop + chartHeight - (pt.loadW / 4000) * chartHeight;
                const ySoC = padTop + chartHeight - (pt.soc / 100) * chartHeight;

                return (
                  <g key={pt.hourLabel}>
                    <circle cx={x} cy={ySolar} r="4" fill="#0ea5e9" stroke="#ffffff" strokeWidth="1" />
                    <circle cx={x} cy={yLoad} r="3.5" fill="#f59e0b" />
                    <circle cx={x} cy={ySoC} r="3" fill="#38bdf8" />
                    <text
                      x={x}
                      y={padTop + chartHeight + 18}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {pt.hourLabel}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Legend & Coaching Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
                <span className="w-3 h-3 rounded-sm bg-sky-500 inline-block" /> Forecasted Solar PV (W)
              </span>
              <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> Forecasted Load Demand (W)
              </span>
              <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                <span className="w-3 h-0.5 bg-cyan-400 inline-block" /> Projected LiFePO4 SoC (%)
              </span>
            </div>
            <span className="text-slate-400 font-mono text-[11px]">
              Min Overnight Reserve: {Math.min(...simulated24hSeries.map((s) => s.soc))}% SoC
            </span>
          </div>
        </div>

        {/* CHART 2: 30-DAY STACKED FINANCIAL BAR CHART (FOSSIL BURN VS. SOLAR LEASE) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <span className="text-[10px] font-mono uppercase text-rose-400 font-bold">
              CHART 2 • STACKED & GROUPED FINANCIAL BAR CHART
            </span>
            <h3 className="text-base font-bold text-white">
              30-Day Petrol Generator + DisCo Band A vs. Fixed Solar Lease
            </h3>
          </div>

          {/* Interactive Local Fuel & Tariff Benchmark Inputs */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <label className="text-[10px] text-slate-400 block">Petrol (₦/Liter)</label>
              <input
                type="number"
                value={petrolPriceNGN}
                onChange={(e) => setPetrolPriceNGN(Math.max(100, Number(e.target.value)))}
                className="w-full bg-transparent font-mono font-bold text-white text-sm outline-none mt-0.5"
              />
            </div>
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <label className="text-[10px] text-slate-400 block">Gen Run (Hrs/Day)</label>
              <input
                type="number"
                min={0}
                max={24}
                value={dailyGenHours}
                onChange={(e) => setDailyGenHours(Math.max(0, Number(e.target.value)))}
                className="w-full bg-transparent font-mono font-bold text-white text-sm outline-none mt-0.5"
              />
            </div>
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <label className="text-[10px] text-slate-400 block">DisCo Bill (₦/Mo)</label>
              <input
                type="number"
                value={monthlyDisCoBillNGN}
                onChange={(e) => setMonthlyDisCoBillNGN(Math.max(0, Number(e.target.value)))}
                className="w-full bg-transparent font-mono font-bold text-white text-sm outline-none mt-0.5"
              />
            </div>
          </div>

          {/* Horizontal Comparative Stacked Bar Visualization */}
          <div className="space-y-4 my-auto py-2">
            {/* Bar 1: Stacked Fossil + Grid Bill */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-rose-300">1. Monthly Generator + Band A Grid Spend</span>
                <span className="font-mono font-black text-rose-400">
                  {formatNaira(financialMetrics.totalFossilAndGridCost)}
                </span>
              </div>
              <div className="w-full h-7 bg-slate-950 rounded-xl overflow-hidden flex border border-slate-800">
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      (financialMetrics.monthlyFuelCost / Math.max(1, financialMetrics.totalFossilAndGridCost)) * 100
                    )}%`,
                  }}
                  className="bg-rose-500 h-full flex items-center justify-center text-[10px] font-bold text-slate-950 overflow-hidden"
                  title="Monthly Petrol Burn"
                >
                  Petrol ({formatNaira(financialMetrics.monthlyFuelCost)})
                </div>
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      (monthlyDisCoBillNGN / Math.max(1, financialMetrics.totalFossilAndGridCost)) * 100
                    )}%`,
                  }}
                  className="bg-purple-500 h-full flex items-center justify-center text-[10px] font-bold text-white overflow-hidden"
                  title="Monthly DisCo Band A Bill"
                >
                  DisCo
                </div>
                <div className="bg-amber-500 flex-1 h-full" title="Generator Oil & Servicing" />
              </div>
              <div className="flex gap-4 text-[10px] text-slate-400">
                <span>🟥 Petrol: {formatNaira(financialMetrics.monthlyFuelCost)}</span>
                <span>🟪 DisCo: {formatNaira(monthlyDisCoBillNGN)}</span>
                <span>🟧 Gen Service: {formatNaira(financialMetrics.monthlyGenMaintenance)}</span>
              </div>
            </div>

            {/* Bar 2: Fixed Growatt PAYG Installment */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-emerald-300">2. Fixed Growatt PAYG Monthly Installment</span>
                <span className="font-mono font-black text-emerald-400">
                  {formatNaira(fixedSolarInstallmentNGN)}
                </span>
              </div>
              <div className="w-full h-7 bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      (fixedSolarInstallmentNGN / Math.max(1, financialMetrics.totalFossilAndGridCost)) * 100
                    )}%`,
                  }}
                  className="bg-emerald-500 h-full flex items-center px-3 text-[10px] font-extrabold text-slate-950"
                >
                  Builds 100% Ownership
                </div>
              </div>
            </div>

            {/* Bar 3: Net Monthly Cashflow Retained */}
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">Net Cash Saved Every Month</p>
                <p className="text-[11px] text-slate-300">Immediate positive cashflow + zero noise</p>
              </div>
              <span className="text-xl font-mono font-black text-emerald-400">
                +{formatNaira(Math.max(0, financialMetrics.netMonthlyCashflowGain))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CHARTS ROW 2: 7-DAY PAIRED COLUMN BAR CHART + 30-DAY OPERATING REGIME HISTOGRAM */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* CHART 3: 7-DAY PAIRED DAILY INTEGRAL COLUMN BAR CHART */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-mono uppercase text-sky-400 font-bold">
                CHART 3 • PAIRED DAILY COLUMN BAR CHART (kWh INTEGRALS)
              </span>
              <h3 className="text-base font-bold text-white">
                7-Day Forecasted Solar Harvest (kWh) vs. Load Demand (kWh)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Open-Meteo GHI</span>
          </div>

          <div className="grid grid-cols-7 gap-2 items-end h-44 pt-4 px-2 bg-slate-950/70 rounded-xl border border-slate-800/80">
            {SEVEN_DAY_PAIRED_KWH.map((d) => {
              const solarH = Math.round((d.solarKWh / 25) * 110);
              const loadH = Math.round((d.loadKWh / 25) * 110);
              return (
                <div key={d.day} className="flex flex-col items-center space-y-1.5">
                  <span className="text-[9px] font-mono text-slate-400">{d.cloudPct}%☁️</span>
                  <div className="flex items-end gap-1 h-28">
                    <div
                      style={{ height: `${solarH}px` }}
                      className="w-3 sm:w-4 bg-gradient-to-t from-emerald-500 to-sky-400 rounded-t shadow-sm shadow-sky-500/25"
                      title={`Solar: ${d.solarKWh} kWh`}
                    />
                    <div
                      style={{ height: `${loadH}px` }}
                      className={`w-3 sm:w-4 rounded-t ${d.deficit ? 'bg-rose-500' : 'bg-amber-500'}`}
                      title={`Load: ${d.loadKWh} kWh`}
                    />
                  </div>
                  <div className="text-center">
                    <p className={`text-xs font-bold ${d.deficit ? 'text-rose-400' : 'text-white'}`}>{d.day}</p>
                    <p className="text-[9px] font-mono text-slate-500">{d.solarKWh}kWh</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-300 bg-amber-950/30 border border-amber-500/30 rounded-xl px-3.5 py-2.5">
            <span>
              ⚠️ <strong>Sunday Rainy Deficit Alert (76% Cloud Cover):</strong> Forecasted PV (12.6 kWh) is below normal load (15.2 kWh). Reduce Sunday night AC by 2 hrs to preserve 35% LiFePO4 reserve.
            </span>
          </div>
        </div>

        {/* CHART 4: CONTIGUOUS-BIN STATISTICAL FREQUENCY HISTOGRAM */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">
                CHART 4 • CONTIGUOUS-BIN STATISTICAL HISTOGRAM (720 HRS)
              </span>
              <h3 className="text-base font-bold text-white">
                30-Day Operating Regime Frequency Distribution
              </h3>
            </div>

            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
              <button
                type="button"
                onClick={() => setHistogramMode('LOAD_WATTS')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  histogramMode === 'LOAD_WATTS' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
                }`}
              >
                Load Watts Bins
              </button>
              <button
                type="button"
                onClick={() => setHistogramMode('BATTERY_SOC')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  histogramMode === 'BATTERY_SOC' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400'
                }`}
              >
                LiFePO4 SoC % Bins
              </button>
            </div>
          </div>

          {/* Contiguous Statistical Histogram (Zero gap between adjacent numeric intervals) */}
          <div className="bg-slate-950/70 rounded-xl border border-slate-800/80 p-4">
            <div className="grid grid-cols-5 items-end h-36 gap-0 border-b border-l border-slate-700 pl-1 pb-1">
              {activeHistogramBins.map((b) => {
                const barHeightPct = Math.max(4, Math.round((b.pctHours / 45) * 100));
                return (
                  <div key={b.binRange} className="flex flex-col items-center justify-end h-full">
                    <span className="text-[10px] font-mono font-bold text-white mb-1">
                      {b.pctHours}% ({b.hoursCount}h)
                    </span>
                    <div
                      style={{ height: `${barHeightPct}%`, backgroundColor: b.color }}
                      className="w-full border-r border-t border-slate-950/60 transition-all opacity-90 hover:opacity-100"
                    />
                  </div>
                );
              })}
            </div>

            {/* Contiguous Interval X-Axis Labels */}
            <div className="grid grid-cols-5 text-center pt-2">
              {activeHistogramBins.map((b) => (
                <div key={b.binRange} className="px-1">
                  <p className="text-[10px] font-mono font-bold text-slate-200">{b.binRange}</p>
                  <p className="text-[9px] text-slate-400 truncate">{b.label}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5">
            📊 <strong>Statistical Verdict:</strong>{' '}
            {histogramMode === 'LOAD_WATTS'
              ? 'Your inverter operates below 1,000W (20% capacity) for 72% of the month (519 hrs), guaranteeing zero IGBT thermal stress.'
              : 'Your LiFePO4 battery spends 73% of the month between 60%–100% SoC and 0 hours below the 20% DoD floor, preserving its 6,000-cycle lifespan.'}
          </p>
        </div>
      </div>
    </div>
  );
}