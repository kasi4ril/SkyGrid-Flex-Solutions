'use client';

import React, { useState, useEffect } from 'react';

export interface GuidedTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToStep?: (stepId: string) => void;
}

interface TourStep {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  metrics: { label: string; value: string; color: string }[];
  codeSnippet?: string;
  targetApp: string;
  actionText: string;
  actionUrl: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'step-sizing',
    badge: 'Step 1 of 5 • Engineering Sizer',
    title: 'COREN Derating & Photovoltaic Sizing Engine',
    subtitle: 'Standards-compliant load sizing across 10 Nigerian solar irradiance belts',
    description:
      'Calculates inductive motor surge capacity (VA_inv), 80% Depth-of-Discharge LiFePO4 battery reserve (Wh_batt), and state-level Peak Sun Hours (PSH). Prevents undersizing and guarantees 12–14 hours overnight autonomy.',
    metrics: [
      { label: 'COREN Inverter Derating', value: '1.25x Over-Current', color: 'text-amber-500' },
      { label: 'LiFePO4 DoD Reserve', value: '80% (6,000 Cycles)', color: 'text-emerald-500' },
      { label: 'Abuja Middle Belt PSH', value: '5.10 PSH / day', color: 'text-cyan-500' },
    ],
    codeSnippet: `P_pv = (Daily_Load_Wh / PSH) × 1.25 Derating_Factor
Battery_Wh = (Night_Load_Wh / 0.80 DoD) × 1.15 Temp_Derate`,
    targetApp: 'Public Showroom',
    actionText: 'Explore COREN Calculator',
    actionUrl: '#calculator',
  },
  {
    id: 'step-powerflow',
    badge: 'Step 2 of 5 • Customer Portal',
    title: 'Animated Live Power Flow & 16S BMS Digital Twin',
    subtitle: 'Real-time telemetry streaming from Growatt SPF 5000ES hybrid inverter',
    description:
      'Visualizes dynamic power vectors: PV generation ingress (Watts), LiFePO4 charge/discharge currents, inverter core temperature, and facility load demand. Tracks 16-cell LiFePO4 millivolt delta (<15mV tolerance).',
    metrics: [
      { label: 'PV Ingress Live', value: '4,280 W (284 VDC)', color: 'text-amber-500' },
      { label: 'LiFePO4 BMS SoC', value: '94.2% (16S Balanced)', color: 'text-emerald-500' },
      { label: 'Facility Load', value: '1,420 W (True RMS)', color: 'text-cyan-500' },
    ],
    codeSnippet: `Modbus Register 0x0001: PV1 Voltage (0.1V resolution)
Modbus Register 0x001B: LiFePO4 Pack SoC (%)
BMS Cell Delta: Max - Min ≤ 15mV (Over-charge protect)`,
    targetApp: 'Customer Portal',
    actionText: 'View Customer Dashboard',
    actionUrl: '/customer-portal',
  },
  {
    id: 'step-sts',
    badge: 'Step 3 of 5 • Fintech & PAYGo',
    title: 'STS 20-Digit Keypad & Moniepoint Webhook Settlement',
    subtitle: 'Bank-grade automated reconciliation and STS-compliant token issuance',
    description:
      'Seamlessly matches customer bank transfers via Moniepoint MFB and Paystack Dedicated Virtual Accounts (DVA). Instantly computes kWh credit and mints 20-digit Standard Transfer Specification (STS) tamper-proof tokens.',
    metrics: [
      { label: 'Settlement Latency', value: '< 2.4 Seconds (DVA)', color: 'text-emerald-500' },
      { label: 'STS Encryption', value: 'IEC 62055-41 20-Digit', color: 'text-amber-500' },
      { label: 'Token Days Active', value: '38 Days Available', color: 'text-cyan-500' },
    ],
    codeSnippet: `HMAC_SHA256(SecretKey, MeterID + EpochMinutes + Units)
Token Format: [5829] - [1049] - [8823] - [0914] - [7492]
Webhook: POST /api/v1/payments/webhook/moniepoint (Verified)`,
    targetApp: 'Customer Portal',
    actionText: 'Inspect STS Token Vault',
    actionUrl: '/customer-portal#paygo',
  },
  {
    id: 'step-tamper',
    badge: 'Step 4 of 5 • Hardware Security',
    title: 'Anti-Tamper Shroud & 15-Minute Dead-Man Interlock',
    subtitle: 'Physical microswitch trip detection and EMQX MQTT heartbeat enforcement',
    description:
      'A tamper-evident hardware shroud protects AC/DC terminals. If breached, the physical microswitch trips within 50ms, generating an emergency MQTT alert and starting a 15-minute countdown before software lockout.',
    metrics: [
      { label: 'Microswitch Latency', value: '< 50ms Hardware Trip', color: 'text-rose-500' },
      { label: 'MQTT Dead-Man', value: '15 Min Heartbeat Guard', color: 'text-amber-500' },
      { label: 'EEPROM Wear Guard', value: 'Max 1 Write / 60s', color: 'text-cyan-500' },
    ],
    codeSnippet: `EMQX Broker: Topic: telemetry/{deviceId}/tamper
Payload: { "shroud_closed": false, "trip_ms": 42 }
Action: Trip Dry-Contact Contactor & Flag Admin Watchtower`,
    targetApp: 'Admin Command',
    actionText: 'Inspect Tamper Queue',
    actionUrl: '/admin-command#tamper',
  },
  {
    id: 'step-coren',
    badge: 'Step 5 of 5 • Statutory Compliance',
    title: 'COREN Earthing Sign-Off & Commissioning Pipeline',
    subtitle: 'Strict ≤ 5.00Ω soil earthing resistance verification and digital certificates',
    description:
      'Every solar installation must complete a 16-step ERP pipeline. Commissioning is blocked until a certified COREN registered engineer conducts Wenner 4-pin fall-of-potential testing and certifies earthing resistance ≤ 5.00Ω.',
    metrics: [
      { label: 'COREN Pass Limit', value: '≤ 5.00 Ω (Mandatory)', color: 'text-emerald-500' },
      { label: 'Test Method', value: 'Wenner 4-Pin Array', color: 'text-amber-500' },
      { label: 'Audit Trail', value: 'SHA-256 Ledger Signed', color: 'text-cyan-500' },
    ],
    codeSnippet: `IF Earthing_Resistance > 5.00 Ω:
  STATUS = REJECTED_EARTHING_FAIL (Enforce Copper Rod Addition)
ELSE:
  STATUS = COMMISSIONED (Generate COREN Compliance Certificate)`,
    targetApp: 'Admin Command',
    actionText: 'View COREN Audit Ledger',
    actionUrl: '/admin-command#compliance',
  },
];

export const GuidedTourModal: React.FC<GuidedTourModalProps> = ({
  isOpen,
  onClose,
  onNavigateToStep,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && currentStepIndex < TOUR_STEPS.length - 1) {
        setCurrentStepIndex((prev) => prev + 1);
      }
      if (e.key === 'ArrowLeft' && currentStepIndex > 0) {
        setCurrentStepIndex((prev) => prev - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex, onClose]);

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
    >
      <div
        className="relative w-full max-w-3xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-[#1E293B]/50">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-sm">
              ▶️
            </span>
            <div>
              <span className="text-xs font-mono font-bold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase">
                {currentStep.badge}
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                SkyGrid Enterprise Guided Architecture Tour
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 transition"
            aria-label="Close Tour"
          >
            ✕
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-slate-100 dark:bg-slate-800 w-full flex">
          {TOUR_STEPS.map((_, idx) => (
            <div
              key={idx}
              className={`h-full flex-1 transition-all duration-300 ${
                idx <= currentStepIndex
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : 'bg-transparent'
              }`}
            />
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
          {/* Step Title & Subtitle */}
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {currentStep.title}
            </h3>
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mt-1">
              {currentStep.subtitle}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">
              {currentStep.description}
            </p>
          </div>

          {/* Key Engineering Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {currentStep.metrics.map((m, i) => (
              <div
                key={i}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60"
              >
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {m.label}
                </div>
                <div className={`text-sm font-bold mt-1 font-mono ${m.color}`}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>

          {/* Technical Code / Protocol Snippet */}
          {currentStep.codeSnippet && (
            <div className="rounded-2xl bg-slate-950 p-4 border border-slate-800 font-mono text-xs text-slate-300">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Verified System Logic</span>
                <span className="text-emerald-400">SHA-256 Validated</span>
              </div>
              <pre className="overflow-x-auto text-emerald-300 leading-relaxed">
                <code>{currentStep.codeSnippet}</code>
              </pre>
            </div>
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1E293B]/50 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStepIndex(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  idx === currentStepIndex
                    ? 'w-6 bg-emerald-500'
                    : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                }`}
                title={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentStepIndex === 0}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200/50 dark:hover:bg-slate-800 transition text-slate-700 dark:text-slate-200"
            >
              &larr; Previous
            </button>

            {currentStepIndex < TOUR_STEPS.length - 1 ? (
              <button
                onClick={() => setCurrentStepIndex((prev) => prev + 1)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg shadow-emerald-500/20"
              >
                Next Step &rarr;
              </button>
            ) : (
              <button
                onClick={() => {
                  onClose();
                  if (onNavigateToStep) onNavigateToStep(currentStep.id);
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 transition shadow-lg shadow-emerald-500/25"
              >
                Complete Tour & Explore App
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuidedTourModal;
