'use client';

import React, { useState, useEffect, useRef } from 'react';
import { UserPersona } from './ChatDrawer';
import { GuidedTourModal } from './GuidedTourModal';

export interface UnifiedHeaderProps {
  currentApp?: 'showroom' | 'portal' | 'admin';
  activePersona?: UserPersona;
  onPersonaChange?: (persona: UserPersona) => void;
  onOpenChat?: () => void;
  onOpenTour?: () => void;
  onContextualAction?: (action: string) => void;
  isChatOpen?: boolean;
}

export const UnifiedHeader: React.FC<UnifiedHeaderProps> = ({
  currentApp = 'showroom',
  activePersona = 'customer',
  onPersonaChange,
  onOpenChat,
  onOpenTour,
  onContextualAction,
  isChatOpen = false,
}) => {
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  // Dropdown states
  const [openDropdown, setOpenDropdown] = useState<'solutions' | 'energy' | 'operations' | 'persona' | 'apps' | null>(null);
  // Audio chime enabled
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  // Tour modal state
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);
  // Mobile menu open
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const headerRef = useRef<HTMLDivElement>(null);

  // Sync theme on mount
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('skygrid_theme');
      if (savedTheme === 'light') {
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

  // Handle ESC dismissal & outside click
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenDropdown(null);
        setIsMobileMenuOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Web Audio synthesizer for pleasant click chime
  const playUiChime = (type: 'click' | 'toggle' | 'alert' = 'click') => {
    if (!isAudioEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'click') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08); // A5
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'toggle') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'alert') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(440, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch (e) {}
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    playUiChime('toggle');
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

  const handleAdminNav = (e: React.MouseEvent, section?: string) => {
    if (onContextualAction) {
      e.preventDefault();
      onContextualAction(section ? `NAV_ADMIN_${section.toUpperCase()}` : 'OPEN_ADMIN');
      setOpenDropdown(null);
    } else if (typeof window !== 'undefined' && (window as unknown as { openAdminPortal?: () => void }).openAdminPortal) {
      e.preventDefault();
      (window as unknown as { openAdminPortal: () => void }).openAdminPortal();
      if (section && (window as unknown as { switchAdminTab?: (t: string) => void }).switchAdminTab) {
        (window as unknown as { switchAdminTab: (t: string) => void }).switchAdminTab(section);
      }
      setOpenDropdown(null);
    }
  };

  const handlePersonaSwitch = (p: UserPersona) => {
    playUiChime('click');
    setOpenDropdown(null);
    if (onPersonaChange) onPersonaChange(p);
  };

  const toggleDropdown = (name: 'solutions' | 'energy' | 'operations' | 'persona' | 'apps') => {
    playUiChime('click');
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const handleTourTrigger = () => {
    playUiChime('click');
    if (onOpenTour) {
      onOpenTour();
    } else {
      setIsTourOpen(true);
    }
  };

  const personaMeta: Record<UserPersona, { label: string; role: string; icon: string; color: string }> = {
    customer: { label: 'Shwarji K.', role: 'Customer', icon: '👤', color: 'bg-emerald-500' },
    technician: { label: 'Engr. Tariq', role: 'Technician', icon: '⚡', color: 'bg-amber-500' },
    finance: { label: 'Amina D.', role: 'Finance', icon: '📊', color: 'bg-blue-500' },
    operations: { label: 'Babajide A.', role: 'Ops Manager', icon: '🛡️', color: 'bg-purple-500' },
  };

  const currentPersonaInfo = personaMeta[activePersona];

  return (
    <>
      <header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-50 h-16 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-200 shadow-sm"
      >
        <div className="max-w-[1700px] w-full h-full mx-auto px-3 sm:px-6 flex items-center justify-between gap-3">
          
          {/* ========================================================================= */}
          {/* ZONE A (LEFT): Brand Logo + Live System Pulse + Portal Switcher           */}
          {/* ========================================================================= */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Logo Link */}
            <a
              href="http://localhost:3000"
              onClick={() => playUiChime('click')}
              className="flex items-center gap-2.5 group focus:outline-none"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 font-black flex items-center justify-center text-lg shadow-md shadow-emerald-500/25 group-hover:scale-105 transition">
                ⚡
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                    SKYGRID
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 font-mono">
                    GROWATT PAYG
                  </span>
                </div>
              </div>
            </a>

            {/* Live System Status Dot */}
            <div
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-mono cursor-default"
              title="EMQX Enterprise MQTT Broker (1883/8883) & SHA-256 Ledger Synchronized"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden xl:inline">ONLINE</span>
            </div>

            {/* App Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown('apps')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition"
              >
                <span>
                  {currentApp === 'showroom' && '🏢 Showroom'}
                  {currentApp === 'portal' && '⚡ Customer'}
                  {currentApp === 'admin' && '🛡️ Admin'}
                </span>
                <span className="text-[10px] text-slate-400">▾</span>
              </button>

              {openDropdown === 'apps' && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-2xl z-50 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1 font-mono">
                    Switch Active Application
                  </div>
                  <a
                    href="http://localhost:3000"
                    className={`flex items-center gap-2.5 p-2 rounded-xl text-xs font-semibold transition ${
                      currentApp === 'showroom'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-base">🏢</span>
                    <div>
                      <div>Public Showroom</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        Port 3000 &bull; Sizing &amp; Packages
                      </div>
                    </div>
                  </a>
                  <a
                    href="http://localhost:3001"
                    className={`flex items-center gap-2.5 p-2 rounded-xl text-xs font-semibold transition ${
                      currentApp === 'portal'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-base">⚡</span>
                    <div>
                      <div>Customer Account Portal</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        Port 3001 &bull; Telemetry &amp; Top-Up
                      </div>
                    </div>
                  </a>
                  <a
                    href="http://localhost:3002"
                    onClick={(e) => handleAdminNav(e)}
                    className={`flex items-center gap-2.5 p-2 rounded-xl text-xs font-semibold transition ${
                      currentApp === 'admin'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-base">🛡️</span>
                    <div>
                      <div>Admin Command &amp; Watchtower</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        Port 3002 &bull; GIS Fleet &amp; Tamper
                      </div>
                    </div>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* ZONE B (CENTER): Semantic Navigation & Dropdowns                           */}
          {/* ========================================================================= */}
          <nav className="hidden md:flex items-center gap-1.5 xl:gap-2 text-xs xl:text-sm font-medium">
            
            <a
              href="http://localhost:3000#hero"
              className="text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
            >
              Home
            </a>

            {/* 1. Solutions & Sizing Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => toggleDropdown('solutions')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  openDropdown === 'solutions'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <span>☀️ Solutions &amp; Sizing</span>
                <span className="text-[10px] text-slate-400">▾</span>
              </button>

              {openDropdown === 'solutions' && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 shadow-2xl z-50 space-y-1">
                  <a
                    href="http://localhost:3000#hero"
                    onClick={() => setOpenDropdown(null)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                      🏢
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Public Showroom</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">3.0kVA to 10kVA Hybrid Bundles</div>
                    </div>
                  </a>

                  <a
                    href="http://localhost:3000#calculator"
                    onClick={() => setOpenDropdown(null)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                      📐
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">COREN Load Calculator</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">10-State Peak Sun Hours &amp; Derating</div>
                    </div>
                  </a>

                  <a
                    href="http://localhost:3000#bundles"
                    onClick={() => setOpenDropdown(null)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                      📦
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Lease-to-Own Packages</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">36-Month Zero-Deposit Financing</div>
                    </div>
                  </a>

                  <a
                    href="http://localhost:3000#savings"
                    onClick={() => setOpenDropdown(null)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold text-sm">
                      📊
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Net Naira ROI Comparator</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Petrol / Diesel Gen Set vs. Solar</div>
                    </div>
                  </a>
                </div>
              )}
            </div>

            {/* 2. My Energy & Hardware Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => toggleDropdown('energy')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  openDropdown === 'energy'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <span>⚡ My Energy &amp; Hardware</span>
                <span className="text-[10px] text-slate-400">▾</span>
              </button>

              {openDropdown === 'energy' && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 shadow-2xl z-50 space-y-1">
                  <a
                    href="http://localhost:3001"
                    onClick={() => setOpenDropdown(null)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                      👤
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Customer Portal Dashboard</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Live Telemetry &amp; Top-Up Control</div>
                    </div>
                  </a>

                  <a
                    href="http://localhost:3001#powerflow"
                    onClick={() => setOpenDropdown(null)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold text-sm">
                      🌊
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Animated Power Flow</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">PV, Battery, Inverter, Grid &amp; Load</div>
                    </div>
                  </a>

                  <a
                    href="http://localhost:3001#battery"
                    onClick={() => setOpenDropdown(null)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                      🔋
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">16S BMS Digital Twin</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Cell Millivolt Delta &amp; Pack Health</div>
                    </div>
                  </a>

                  <a
                    href="http://localhost:3001#registers"
                    onClick={() => setOpenDropdown(null)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                      📟
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Modbus RTU Registers</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Holding Registers 0x0000–0x003B</div>
                    </div>
                  </a>

                  <a
                    href="http://localhost:3001#keypad"
                    onClick={() => setOpenDropdown(null)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-sm">
                      🔑
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">STS PAYGo Keypad Vault</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">20-Digit Tamper-Proof Token Input</div>
                    </div>
                  </a>
                </div>
              )}
            </div>

            {/* 3. Operations & Compliance Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => toggleDropdown('operations')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  openDropdown === 'operations'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <span>🛡️ Operations &amp; Compliance</span>
                <span className="text-[10px] text-slate-400">▾</span>
              </button>

              {openDropdown === 'operations' && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 shadow-2xl z-50 space-y-1">
                  <a
                    href="http://localhost:3002"
                    onClick={(e) => handleAdminNav(e)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                      🛰️
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Executive Admin Watchtower</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">National Fleet Command Center</div>
                    </div>
                  </a>

                  <a
                    href="http://localhost:3002#fleet"
                    onClick={(e) => handleAdminNav(e, 'fleet')}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                      🗺️
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">GIS Fleet Map &amp; SLA</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">10-State Real-Time Telemetry Map</div>
                    </div>
                  </a>

                  <a
                    href="http://localhost:3002#tamper"
                    onClick={(e) => handleAdminNav(e, 'fleet')}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-sm">
                      🚨
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Shroud Tamper Queue</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Microswitch Trip &amp; 15m Interlock</div>
                    </div>
                  </a>

                  <a
                    href="http://localhost:3002#earthing"
                    onClick={(e) => handleAdminNav(e, 'installations')}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                      ⚡
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">COREN Earthing Sign-Off</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Mandatory &le; 5.00&Omega; Validation</div>
                    </div>
                  </a>

                  <a
                    href="http://localhost:3002#ledger"
                    onClick={(e) => handleAdminNav(e, 'copilot')}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-sm">
                      📜
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">SHA-256 Ledger &amp; RMA</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Inverter Serial Swap &amp; Audit Trail</div>
                    </div>
                  </a>
                </div>
              )}
            </div>

            <a
              href="http://localhost:3000#faq"
              className="text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
            >
              FAQ
            </a>

            <a
              href="http://localhost:3000#contact"
              className="text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
            >
              Contact
            </a>

            {/* Quick Direct Navigation Action Buttons */}
            <button
              type="button"
              onClick={() => {
                playUiChime('click');
                if (onContextualAction) onContextualAction('CUSTOMER_LOGIN');
              }}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30 text-xs font-bold transition"
              title="Users Sign In to Customer Portal"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span>Users Sign In</span>
            </button>

            <button
              type="button"
              onClick={(e) => handleAdminNav(e)}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-semibold transition"
              title="Executive Admin & ERP Console"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
              <span>👑 Admin Command</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playUiChime('click');
                if (onContextualAction) onContextualAction('SIGN_UP');
              }}
              className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/35 text-xs font-bold transition shadow-sm"
              title="Sign Up with 11-Digit NIMC NIN"
            >
              <span>⚡ Sign Up with NIN</span>
            </button>

          </nav>

          {/* ========================================================================= */}
          {/* ZONE C (RIGHT): Utilities + Tour + Voice + Theme + Persona + AI + CTA      */}
          {/* ========================================================================= */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            
            {/* Guided Tour Trigger Button */}
            <button
              onClick={handleTourTrigger}
              className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold transition shadow-sm"
              title="Launch 5-Step Golden Path Guided Tour"
            >
              <span>▶️</span>
              <span className="hidden xl:inline">Guided Demo</span>
            </button>

            {/* Audio Voice / Chime Synthesizer Toggle */}
            <button
              onClick={() => {
                const nextState = !isAudioEnabled;
                setIsAudioEnabled(nextState);
                if (nextState) playUiChime('toggle');
              }}
              className={`p-2 rounded-xl border text-xs font-semibold transition ${
                isAudioEnabled
                  ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border-slate-200 dark:border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/50 text-slate-400 border-slate-200 dark:border-slate-800'
              }`}
              title={isAudioEnabled ? 'UI Sound Synthesizer Active (Click to mute)' : 'UI Sound Muted (Click to enable)'}
              aria-label="Toggle UI Audio"
            >
              <span>{isAudioEnabled ? '🔊' : '🔇'}</span>
            </button>

            {/* Daylight / Night Adaptive Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition text-xs font-semibold"
              title={theme === 'dark' ? 'Switch to Solar Daylight Mode' : 'Switch to Photovoltaic Night Mode'}
              aria-label="Toggle Color Theme"
            >
              {theme === 'dark' ? (
                <span className="text-amber-400 text-sm">☀️</span>
              ) : (
                <span className="text-sky-600 text-sm">🌙</span>
              )}
            </button>

            {/* Role Switcher / Persona Pill */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown('persona')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-medium transition"
                title="Switch Active User Persona"
              >
                <span className="text-sm">{currentPersonaInfo.icon}</span>
                <span className="hidden md:inline font-bold text-slate-800 dark:text-slate-200">
                  {currentPersonaInfo.role}
                </span>
                <span className="text-[10px] text-slate-400">▾</span>
              </button>

              {openDropdown === 'persona' && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 shadow-2xl z-50 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1 font-mono">
                    Simulate IAM Role &amp; RAG Persona
                  </div>
                  {(['customer', 'technician', 'finance', 'operations'] as UserPersona[]).map((p) => {
                    const info = personaMeta[p];
                    const isSelected = p === activePersona;
                    return (
                      <button
                        key={p}
                        onClick={() => handlePersonaSwitch(p)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition ${
                          isSelected
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{info.icon}</span>
                          <div>
                            <div>{info.label}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{info.role}</div>
                          </div>
                        </div>
                        {isSelected && <span className="text-emerald-500 font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Ask SkyTron AI Drawer Trigger Button */}
            <button
              onClick={() => {
                playUiChime('click');
                if (onOpenChat) onOpenChat();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition shadow-md ${
                isChatOpen
                  ? 'bg-emerald-600 text-white shadow-emerald-500/30 ring-2 ring-emerald-500'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:brightness-110 shadow-emerald-500/20'
              }`}
              title="Ask SkyTron AI (LocalGrid 2.0 Scoped RAG)"
            >
              <span>🤖</span>
              <span className="hidden sm:inline">Ask AI</span>
            </button>

            {/* Contextual Action CTA */}
            {currentApp === 'portal' && (
              <button
                onClick={() => {
                  playUiChime('click');
                  if (onContextualAction) onContextualAction('TOP_UP');
                }}
                className="hidden xl:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition shadow-sm"
              >
                <span>💳</span>
                <span>Top-Up</span>
              </button>
            )}

            {currentApp === 'admin' && (
              <button
                onClick={() => {
                  playUiChime('alert');
                  if (onContextualAction) onContextualAction('TAMPER_QUEUE');
                }}
                className="hidden xl:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-xs transition shadow-sm"
              >
                <span>🛡️</span>
                <span>Tamper Alert</span>
              </button>
            )}

            {currentApp === 'showroom' && (
              <button
                onClick={() => {
                  playUiChime('click');
                  if (onContextualAction) onContextualAction('BOOK_AUDIT');
                }}
                className="hidden xl:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition shadow-sm"
              >
                <span>📅</span>
                <span>Book Audit</span>
              </button>
            )}

            {/* Mobile Menu Hamburger */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 transition"
              aria-label="Toggle Mobile Menu"
            >
              {isMobileMenuOpen ? '✕' : '☰'}
            </button>

          </div>

        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">
                SKYGRID MOBILE COMMAND
              </span>
              <button
                onClick={handleTourTrigger}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
              >
                <span>▶️</span> Guided Demo
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  if (onContextualAction) onContextualAction('SIGN_UP');
                }}
                className="p-2.5 rounded-xl bg-emerald-500/15 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
              >
                ⚡ Sign Up
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  if (onContextualAction) onContextualAction('CUSTOMER_LOGIN');
                }}
                className="p-2.5 rounded-xl bg-amber-500/15 text-center text-xs font-bold text-amber-500 border border-amber-500/30"
              >
                🔑 Sign In
              </button>
              <button
                type="button"
                onClick={(e) => {
                  setIsMobileMenuOpen(false);
                  handleAdminNav(e);
                }}
                className="p-2.5 rounded-xl bg-indigo-500/15 text-center text-xs font-bold text-indigo-400 border border-indigo-500/30"
              >
                👑 Admin
              </button>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1 text-xs font-medium">
              <a
                href="http://localhost:3000#hero"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200"
              >
                🏠 Home (Public Showroom)
              </a>
              <a
                href="http://localhost:3000#calculator"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200"
              >
                📐 COREN Load Sizer &amp; Pricing
              </a>
              <a
                href="http://localhost:3000#bundles"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200"
              >
                📦 Lease-to-Own Packages
              </a>
              <a
                href="http://localhost:3000#faq"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200"
              >
                ❓ FAQ
              </a>
              <a
                href="http://localhost:3000#contact"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200"
              >
                📞 Contact Us
              </a>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  if (onOpenChat) onOpenChat();
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2"
              >
                <span>🤖</span>
                <span>Ask SkyTron Quantum AI</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Embedded Guided Tour Modal */}
      <GuidedTourModal
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        onNavigateToStep={() => setIsTourOpen(false)}
      />
    </>
  );
};

export default UnifiedHeader;
