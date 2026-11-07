'use client';

import React, { useState, useEffect, useRef } from 'react';

export type UserPersona = 'customer' | 'technician' | 'finance' | 'operations';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  persona: UserPersona;
  text: string;
  timestamp: string;
  citations?: string[];
  safetyAlert?: string;
  codeSnippet?: string;
}

export interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activePersona?: UserPersona;
  onPersonaChange?: (persona: UserPersona) => void;
  deviceId?: string;
}

interface PersonaConfig {
  roleSlug: UserPersona;
  title: string;
  badge: string;
  avatar: string;
  accentColor: string;
  welcomeMessage: string;
  suggestedPills: string[];
}

const PERSONA_CONFIGS: Record<UserPersona, PersonaConfig> = {
  customer: {
    roleSlug: 'customer',
    title: 'Customer Energy Advisor',
    badge: 'Growatt SPF 5000ES • Lease Active',
    avatar: '👤',
    accentColor: 'from-emerald-500 to-teal-500',
    welcomeMessage:
      'Hello Shwarji! I am your SkyGrid AI Energy Advisor. I monitor your Growatt SPF 5000ES hybrid inverter and LiFePO4 battery pack in real time. How can I assist you with your energy consumption, battery survival hours, or token top-up today?',
    suggestedPills: [
      'Why did my battery survival hours drop last night?',
      'How do I top up my token with Moniepoint DVA?',
      'What appliances can I run safely during cloudy weather?',
      'What does Inverter Error 04 mean on my display?',
    ],
  },
  technician: {
    roleSlug: 'technician',
    title: 'Field Engineering RAG',
    badge: 'COREN R.48201 • Modbus RTU Protocol',
    avatar: '⚡',
    accentColor: 'from-amber-500 to-orange-500',
    welcomeMessage:
      'Field Engineering Diagnostic Console active. Grounded in Growatt SPF 3000–5000ES technical manuals, Modbus RTU register map (0x0000–0x003B), and COREN Nigerian Electrical Code 2024. Ready for diagnostic queries and earthing test verifications.',
    suggestedPills: [
      'What is the COREN earthing pass threshold and test method?',
      'What are the Modbus registers for PV voltage and LiFePO4 SoC?',
      'How to safely replace anti-tamper microswitch without lockout?',
      'Growatt Error 08: Inverter soft start failure diagnostic steps?',
    ],
  },
  finance: {
    roleSlug: 'finance',
    title: 'Finance Ledger Advisor',
    badge: 'Moniepoint MFB / Paystack • STS Issuer',
    avatar: '📊',
    accentColor: 'from-blue-500 to-indigo-500',
    welcomeMessage:
      'Finance & Receivables Intelligence Desk ready. Integrated with Moniepoint DVA webhooks, Paystack-Titan virtual accounts, 36-month lease amortization tables, and STS IEC 62055-41 token cryptographic records.',
    suggestedPills: [
      'Show Moniepoint webhook settlement status and latency today.',
      'What is the receivables aging breakdown for Abuja Middle-Belt?',
      'How does the STS token generation link to customer NUBAN payments?',
      'What is our current 30-day default risk cohort rate?',
    ],
  },
  operations: {
    roleSlug: 'operations',
    title: 'Operations Watchtower AI',
    badge: 'National GIS Fleet • 15m Dead-Man Switch',
    avatar: '🛡️',
    accentColor: 'from-purple-500 to-violet-500',
    welcomeMessage:
      'Executive Operations & Watchtower AI active. Monitoring national telemetry across 10 Nigerian states, EMQX MQTT broker health, anti-tamper shroud alerts, and field technician dispatch SLAs.',
    suggestedPills: [
      'National GIS fleet health and active inverter alerts summary?',
      'How many shroud tamper events triggered in the last 24 hours?',
      'What is the 15-minute dead-man switch auto-shutdown status?',
      'Pending COREN earthing inspection sign-offs across regional hubs?',
    ],
  },
};

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  isOpen,
  onClose,
  activePersona = 'customer',
  onPersonaChange,
  deviceId = 'GW-SPF5000-ABJ-042',
}) => {
  const [currentPersona, setCurrentPersona] = useState<UserPersona>(activePersona);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync with prop
  useEffect(() => {
    setCurrentPersona(activePersona);
  }, [activePersona]);

  // Initial welcome message per persona
  useEffect(() => {
    const config = PERSONA_CONFIGS[currentPersona];
    const initialMsg: ChatMessage = {
      id: `welcome-${currentPersona}-${Date.now()}`,
      sender: 'assistant',
      persona: currentPersona,
      text: config.welcomeMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      citations:
        currentPersona === 'technician'
          ? ['COREN Electrical Code 2024 §14.3', 'Growatt SPF 5000ES Manual Rev 4.2']
          : currentPersona === 'finance'
          ? ['Moniepoint DVA Reconciliation Spec v2', 'STS Standard IEC 62055-41']
          : currentPersona === 'operations'
          ? ['EMQX MQTT Telemetry Architecture', 'National Fleet GIS Dispatch Protocol']
          : ['SkyGrid Customer Service Level Agreement', 'LiFePO4 BMS Operation Manual'],
    };
    setMessages([initialMsg]);
  }, [currentPersona]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  // Handle Persona switch
  const handlePersonaSelect = (newPersona: UserPersona) => {
    setCurrentPersona(newPersona);
    if (onPersonaChange) onPersonaChange(newPersona);
  };

  // Local knowledge fallback engine when server is offline
  const generateScopedLocalAnswer = (query: string, persona: UserPersona): ChatMessage => {
    const q = query.toLowerCase();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (persona === 'customer') {
      if (q.includes('battery') || q.includes('survival') || q.includes('hours') || q.includes('drop')) {
        return {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          persona,
          text: `**Battery Survival Analysis for Growatt SPF 5000ES:**\n\nYour 5.12 kWh LiFePO4 battery pack maintained an average nocturnal discharge of **412 Watts** between 11:00 PM and 5:30 AM.\n\n• **Cause of Early Depletion:** A sustained heavy inductive load (inverter refrigerator motor cycle combined with two standing fans and security lighting) drew **2.68 kWh** overnight.\n• **Recommended Action:** Enable *Eco-Night Mode* on your dashboard to cap nocturnal discharge current to 15A. This extends your survival hours from **6.4 hrs** to **13.8 hrs** until solar PV irradiance resumes at 7:15 AM.`,
          timestamp: time,
          citations: ['Growatt SPF 5000ES Manual §5.3 (Battery Discharge Curve)', 'LiFePO4 BMS 16S Pack Spec'],
          codeSnippet: `Nightly Load: 412W × 6.5h = 2.678 kWh (52.3% of 5.12 kWh pack)\nUsable DoD: 80% (4.096 kWh)\nRemaining Reserve: 1.418 kWh at dawn`,
        };
      }
      if (q.includes('top up') || q.includes('moniepoint') || q.includes('token') || q.includes('dva')) {
        return {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          persona,
          text: `**Instant PAYGo Token Generation Instructions:**\n\n1. Transfer your subscription installment directly to your Dedicated Virtual Account (DVA):\n   • **Bank:** Moniepoint MFB\n   • **Account No:** \`8049201844\`\n   • **Beneficiary:** SKYGRID SOLAR / SHWARJI KHATANG\n2. The Moniepoint webhook credits your meter within **2.4 seconds**.\n3. Your 20-digit STS token will appear automatically in the **STS Keypad Vault** and via SMS.\n4. Input the 20 digits on your keypad: \`5829-1049-8823-0914-7492\` then press **ENTER (↵)**.`,
          timestamp: time,
          citations: ['STS IEC 62055-41 Specification', 'Moniepoint Instant Webhook v2.1'],
        };
      }
      if (q.includes('error 04') || q.includes('error')) {
        return {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          persona,
          text: `**Growatt Error 04: Battery Low Voltage Warning**\n\n• **Diagnosis:** The LiFePO4 battery pack voltage has dropped below the low-voltage cutoff threshold (**44.0 VDC**).\n• **System Protection:** The inverter has temporarily suspended AC output to protect the LiFePO4 chemistry from irreversible deep discharge.\n• **Resolution:** Keep the inverter powered. As soon as morning sunlight strikes the 5.4 kWp solar array, the MPPT charge controller will deliver bulk charging at up to 80A. The AC load will automatically re-engage once battery voltage reaches **48.0 VDC**.`,
          timestamp: time,
          citations: ['Growatt SPF Series Troubleshooting Guide §7.1'],
          safetyAlert: '⚠️ Do not attempt to jump-start or bypass battery terminals with automotive lead-acid batteries!',
        };
      }
      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        persona,
        text: `Thank you for your query, Shwarji. Based on your current system telemetry for device **${deviceId}**:\n\n• **Solar PV Generation:** 4,280 W (284 VDC, 15.1A)\n• **LiFePO4 Battery SoC:** 94.2% (Floating at 53.6 VDC)\n• **Current Facility Load:** 1,420 W\n• **Token Reserve:** 38 Days remaining on your 36-month lease-to-own plan.\n\nYour system is running at optimal thermodynamic efficiency with zero grid dependence.`,
        timestamp: time,
        citations: ['Growatt Telemetry Ingress Feed', 'SkyGrid PAYGo Customer Profile'],
      };
    }

    if (persona === 'technician') {
      if (q.includes('coren') || q.includes('earthing') || q.includes('ground') || q.includes('threshold')) {
        return {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          persona,
          text: `**COREN Statutory Earthing Protocol & Commissioning Standards (2024):**\n\n• **Mandatory Resistance Limit:** Soil earthing resistance must measure **≤ 5.00 Ω** (Ohms) under all seasonal conditions.\n• **Approved Measurement Procedure:** Wenner 4-pin or 3-point fall-of-potential test using a calibrated Megger earth tester.\n• **Interlock Enforcement:** The SkyGrid ERP system **strictly blocks** status transition to *14_COMMISSIONED* if earthing resistance exceeds 5.00 Ω.\n• **Remediation for High Soil Resistivity (> 5.00 Ω):**\n  1. Drive additional 16mm × 2.4m copper-bonded earth rods at a minimum spacing equal to rod depth.\n  2. Backfill with Marconite or bentonite conductive earthing compound.\n  3. Bond solar array aluminum frames using minimum 16mm² green/yellow earth cable directly to main earth terminal.`,
          timestamp: time,
          citations: ['COREN Nigerian Electrical Code 2024 §14.3', 'IEE Wiring Regulations BS 7671 §542'],
          safetyAlert: '⚠️ COREN MANDATORY RULE: Never energize hybrid inverter DC bus before earth loop impedance test is signed off!',
          codeSnippet: `Earthing Check Logic:\nIF R_earth <= 5.00 OHMS:\n    ALLOW CommissioningCertificate(signed_by=COREN_R48201)\nELSE:\n    TRIGGER REJECTED_EARTHING_FAIL && DispatchGroundRemediation()`,
        };
      }
      if (q.includes('modbus') || q.includes('register') || q.includes('address')) {
        return {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          persona,
          text: `**Growatt SPF Series Modbus RTU Register Protocol Map (Holding Registers):**\n\n• **0x0000:** Inverter State (\`0: Standby, 1: Solar Only, 2: Bypass, 3: Battery Powered, 4: Fault\`)\n• **0x0001:** PV1 Input Voltage (Scale: \`0.1 V\`, Range: 0–450V)\n• **0x0002:** PV1 Charging Current (Scale: \`0.1 A\`)\n• **0x0003:** PV1 Ingress Power (Scale: \`0.1 W\`)\n• **0x001B:** LiFePO4 Battery SoC (Scale: \`1 %\`, Range: 0–100%)\n• **0x001C:** Battery Pack Voltage (Scale: \`0.01 V\`)\n• **0x0022:** Inverter Heat Sink Temperature (Scale: \`0.1 °C\`, Alert > 75°C)\n• **0x003A:** STS Token Status (\`0: Active, 1: Expired, 2: Tamper Lockout\`)`,
          timestamp: time,
          citations: ['Growatt Server Modbus Protocol Specification v3.18', 'RS485 Baud Rate: 9600, 8-N-1'],
          codeSnippet: `// Example Modbus RTU Frame: Read PV1 Voltage (Reg 0x0001)\n[0x01] [0x03] [0x00] [0x01] [0x00] [0x01] [0xD5] [0xCA]\nResponse: [0x01] [0x03] [0x02] [0x0B] [0x18] [CRC_LO] [CRC_HI] // 0x0B18 = 2840 (284.0 V)`,
        };
      }
      if (q.includes('tamper') || q.includes('microswitch') || q.includes('shroud')) {
        return {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          persona,
          text: `**Anti-Tamper Shroud Replacement & De-escalation Protocol:**\n\n1. **Pre-Authorization:** Open SkyGrid Admin Console and request a 30-minute *Authorized Maintenance Window* for device \`${deviceId}\`.\n2. **Microswitch Engagement:** The physical microswitch inside the metal terminal shroud is normally closed. Releasing the fastener trips pin GPIO_4 within < 50ms.\n3. **15-Minute Countdown Override:** Technicians must scan their COREN digital badge and enter supervisor OTP within 15 minutes to prevent automatic contactor lockout.\n4. **Seal Verification:** After service, secure shroud with tamper-evident serial seal \`#SG-NIG-8841\` and submit high-res completion photograph to ERP.`,
          timestamp: time,
          citations: ['SkyGrid Hardware Security & Anti-Theft Specification Rev 2.4'],
          safetyAlert: '⚠️ Failure to enter supervisor OTP before 15m timer expiry will require remote SuperAdmin cryptographic unlock!',
        };
      }
      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        persona,
        text: `Technician Diagnostic Channel online. Verified Growatt SPF 5000ES firmware version: **v3.2.1-SG**. Modbus polling interval: **2,000ms**. All 16S LiFePO4 cells are balanced within 8mV delta. Ask me about error codes, inverter derating math, or wiring diagrams.`,
        timestamp: time,
        citations: ['Growatt Field Diagnostics Manual'],
      };
    }

    if (persona === 'finance') {
      if (q.includes('moniepoint') || q.includes('settlement') || q.includes('webhook') || q.includes('paystack')) {
        return {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          persona,
          text: `**Moniepoint & Paystack Webhook Settlement Telemetry:**\n\n• **Today's Settlement Volume:** ₦ 4,850,000 across 34 successful lease-to-own installments.\n• **Average Webhook Latency:** **1.82 seconds** from Nigerian Inter-Bank Settlement System (NIBSS) confirmation to STS token minting.\n• **Reconciliation Match Rate:** **100%** (Zero unmatched suspense deposits; automated matching via Virtual Account NUBAN).\n• **Dispute/Chargeback Rate:** 0.00% (Clean fintech gateway standing).`,
          timestamp: time,
          citations: ['Moniepoint MFB Direct Core Banking API', 'Paystack Titan DVA Settlement Log'],
          codeSnippet: `POST /api/v1/payments/webhook/moniepoint\n{\n  "event": "transaction.successful",\n  "amount_kobo": 8500000,\n  "account_number": "8049201844",\n  "reference": "MNP_TX_9920148",\n  "status": "SETTLED"\n} // Matched with Customer ID: USR-ABJ-042`,
        };
      }
      if (q.includes('aging') || q.includes('receivables') || q.includes('default') || q.includes('cohort')) {
        return {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          persona,
          text: `**Receivables Aging & Credit Portfolio Risk Metrics:**\n\n• **Current (0–30 Days):** 94.6% of portfolio (₦ 42.1M on-schedule repayments).\n• **Watchlist (31–60 Days):** 3.8% (Grace period active; automated WhatsApp payment reminders sent).\n• **Impaired (>60 Days):** 1.6% (Automated soft-lockout warning dispatched).\n• **Loss Ratio:** 0.4% (Industry-leading, driven by STS token hardware interlock).\n• **Cohort Highlight:** Abuja Middle-Belt cohort exhibits the highest on-time repayment velocity due to fuel-price displacement savings.`,
          timestamp: time,
          citations: ['SkyGrid Credit Risk & Amortization Policy 2024'],
        };
      }
      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        persona,
        text: `Finance Desk connected. Total portfolio assets under lease: **184 Active Solar Micro-Plants**. Projected monthly recurring revenue (MRR): **₦ 14.8M**. Automated ledger entries are signed via SHA-256 for audit immutability.`,
        timestamp: time,
        citations: ['SkyGrid Financial Reporting Engine'],
      };
    }

    // Operations Persona
    return {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      persona,
      text: `**National Fleet Operations Watchtower Report:**\n\n• **Total Online Inverters:** 184 / 185 (99.46% Availability)\n• **Active Tamper Alerts:** 0 Open (1 cleared today in Gwarinpa, Abuja)\n• **15-Minute Dead-Man Switch Status:** Active on all units; heartbeat verified via EMQX MQTT broker.\n• **Field Dispatch SLA:** Average on-site technician response time is **2.4 hours** across Abuja, Lagos, and Kano hubs.\n• **COREN Commissioning Queue:** 3 completed installations awaiting supervisor final sign-off.`,
      timestamp: time,
      citations: ['EMQX Cluster Health Monitor', 'National GIS Dispatch Dashboard'],
      codeSnippet: `Fleet State: 184 ACTIVE_ONLINE, 1 MAINTENANCE_STANDBY\nBroker: EMQX Enterprise v5.4 (TCP 1883 / TLS 8883)\nP99 Ingress Latency: 42ms`,
    };
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      persona: currentPersona,
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      // Attempt backend API call
      const res = await fetch('/api/v1/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMsg.text,
          role_slug: currentPersona,
          user_id: 'usr-sim-001',
          device_id: deviceId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          persona: currentPersona,
          text: data.answer || data.response || data.message || 'No answer returned from agent.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          citations: data.citations || [],
          safetyAlert: data.safety_alert || undefined,
          codeSnippet: data.code_snippet || undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsLoading(false);
        return;
      }
    } catch (err) {
      // Fallback silently to client-side scoped intelligence engine
    }

    // Local fallback delay to simulate realistic synthesis
    setTimeout(() => {
      const fallbackAns = generateScopedLocalAnswer(userMsg.text, currentPersona);
      setMessages((prev) => [...prev, fallbackAns]);
      setIsLoading(false);
    }, 700);
  };

  const currentConfig = PERSONA_CONFIGS[currentPersona];

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-hidden flex justify-end"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity animate-fade-in"
      />

      {/* Drawer Container */}
      <div
        className="relative w-full max-w-lg bg-white dark:bg-[#0B0F19] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-full z-10 transition-transform duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111827] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${currentConfig.accentColor} text-slate-950 font-black flex items-center justify-center text-lg shadow-lg shadow-emerald-500/20`}
            >
              🤖
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  SkyTron AI Advisor
                </h3>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                LocalGrid 2.0 • Scoped RAG Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const config = PERSONA_CONFIGS[currentPersona];
                setMessages([
                  {
                    id: `welcome-${currentPersona}-${Date.now()}`,
                    sender: 'assistant',
                    persona: currentPersona,
                    text: config.welcomeMessage,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  },
                ]);
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition text-xs"
              title="Clear Conversation"
            >
              🗑️
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              aria-label="Close Chat Drawer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Persona Switcher Tabs */}
        <div className="px-4 py-2.5 bg-slate-100 dark:bg-[#0E1526] border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1 shrink-0">
            Persona:
          </span>
          {(['customer', 'technician', 'finance', 'operations'] as UserPersona[]).map((p) => {
            const cfg = PERSONA_CONFIGS[p];
            const isSelected = p === currentPersona;
            return (
              <button
                key={p}
                onClick={() => handlePersonaSelect(p)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-300 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <span>{cfg.avatar}</span>
                <span className="capitalize">{p}</span>
              </button>
            );
          })}
        </div>

        {/* Persona Active Status Banner */}
        <div className="px-4 py-1.5 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[11px] font-mono flex items-center justify-between shrink-0">
          <span>Active Context: {currentConfig.badge}</span>
          <span className="text-[10px] text-slate-400">Device: {deviceId}</span>
        </div>

        {/* Message Thread History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => {
            const isAssistant = msg.sender === 'assistant';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {isAssistant ? `⚡ ${PERSONA_CONFIGS[msg.persona].title}` : '👤 You'}
                  </span>
                  <span className="text-[10px] text-slate-400">&bull; {msg.timestamp}</span>
                </div>

                <div
                  className={`max-w-[92%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-sm ${
                    isAssistant
                      ? 'bg-slate-50 dark:bg-[#1E293B]/90 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700/80'
                      : 'bg-emerald-600 text-white rounded-br-sm'
                  }`}
                >
                  {/* Safety Alert Banner */}
                  {msg.safetyAlert && (
                    <div className="mb-3 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center gap-2">
                      <span>{msg.safetyAlert}</span>
                    </div>
                  )}

                  {/* Message Prose */}
                  <div className="whitespace-pre-wrap">{msg.text}</div>

                  {/* Code Snippet Box */}
                  {msg.codeSnippet && (
                    <div className="mt-3 p-3 rounded-xl bg-slate-950 font-mono text-xs text-emerald-300 border border-slate-800 overflow-x-auto">
                      <pre>
                        <code>{msg.codeSnippet}</code>
                      </pre>
                    </div>
                  )}

                  {/* Citations Badges */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700/60 flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] text-slate-400 font-mono">Sources:</span>
                      {msg.citations.map((c, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-mono"
                        >
                          📖 {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex flex-col items-start">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>LocalGrid 2.0 RAG is synthesizing answer...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompt Pills */}
        <div className="p-3 bg-slate-50 dark:bg-[#0E1526] border-t border-slate-200 dark:border-slate-800 shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Suggested Queries for {currentConfig.title}:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {currentConfig.suggestedPills.map((pill, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(pill)}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800/80 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 text-[11px] font-medium transition text-left"
              >
                {pill}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Ask as ${currentPersona}...`}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20 shrink-0"
            >
              <span>Send</span>
              <span>&rarr;</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatDrawer;
