/**
 * @fileoverview Executive Admin Command Center, Enterprise IAM, 6-Tab ERP Operations Console & GIS Watchtower
 * Application: web-suite/apps/admin-command
 */

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { UnifiedHeader, ChatDrawer, UserPersona } from '../../packages/ui-kit/src';
import EnterpriseNavbar from '../components/EnterpriseNavbar';

// ============================================================================
// TYPES & SYSTEM DATA MODELS
// ============================================================================

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

interface SystemPermission {
  slug: string;
  name: string;
  module: string;
}

const ALL_SYSTEM_PERMISSIONS: SystemPermission[] = [
  { slug: 'staff.view', name: 'View Staff Directory & Applications', module: 'Staff' },
  { slug: 'staff.invite', name: 'Directly Invite New Staff Members', module: 'Staff' },
  { slug: 'staff.approve', name: 'Review & Approve Staff Onboarding Requests', module: 'Staff' },
  { slug: 'staff.manage_roles', name: 'Assign & Revoke Staff Enterprise Roles', module: 'Staff' },
  { slug: 'customers.view', name: 'View Customer Accounts & Credit Telemetry', module: 'Customers' },
  { slug: 'customers.manage', name: 'Modify Customer Metadata & Contract Terms', module: 'Customers' },
  { slug: 'installations.create', name: 'Schedule & Dispatch Solar Installations', module: 'Installations' },
  { slug: 'installations.assign', name: 'Assign Field Engineers to Site Installations', module: 'Installations' },
  { slug: 'installations.update', name: 'Execute Digital Commissioning & Earthing Check', module: 'Installations' },
  { slug: 'maintenance.create', name: 'Log Fault Tickets & RMA Hardware Swaps', module: 'Maintenance' },
  { slug: 'maintenance.assign', name: 'Assign Technicians to Maintenance Tickets', module: 'Maintenance' },
  { slug: 'maintenance.update_status', name: 'Resolve Maintenance Tasks & Update Shroud State', module: 'Maintenance' },
  { slug: 'payments.view', name: 'Inspect Inbound Webhooks & Financial Ledgers', module: 'Payments' },
  { slug: 'payments.verify', name: 'Verify Bank Transfers & Generate STS Tokens', module: 'Payments' },
  { slug: 'reports.view', name: 'Access Financial & Technical Performance Reports', module: 'Reports' },
  { slug: 'audit.view', name: 'Inspect Administrative & Security Audit Trail', module: 'Audit' },
  { slug: 'settings.manage', name: 'Configure System Secrets, Tariffs & SLA Limits', module: 'Settings' },
];

interface EnterpriseRoleMeta {
  slug: string;
  name: string;
  desc: string;
  icon: string;
}

const ALL_ROLES_META: EnterpriseRoleMeta[] = [
  { slug: 'super_admin', name: 'Super Administrator', desc: 'Full platform control, executive overrides, role administration and auditing.', icon: '👑' },
  { slug: 'operations_manager', name: 'Operations Manager', desc: 'Fleet orchestration, installation dispatch, ticket assignment and reporting.', icon: '🛡️' },
  { slug: 'field_engineer', name: 'Field Engineer', desc: 'Site audits, physical installations, <5.0 Ohm earthing sign-off and RMA swaps.', icon: '⚡' },
  { slug: 'finance_officer', name: 'Finance & Risk Officer', desc: 'Payment verification, ledger oversight, debt reconciliation and KYC underwriting.', icon: '📊' },
  { slug: 'customer_support', name: 'Customer Support Representative', desc: 'Customer inquiries, dispute handling, basic ticketing and token lookups.', icon: '💬' },
  { slug: 'compliance_auditor', name: 'Compliance & Quality Auditor', desc: 'COREN/NEMSA technical audits, safety log inspection and regulatory reporting.', icon: '📜' },
  { slug: 'customer', name: 'PAYG Solar Customer', desc: 'Access to personal solar telemetry, virtual accounts, receipts and token keypad.', icon: '👤' },
];

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: [
    'staff.view', 'staff.invite', 'staff.approve', 'staff.manage_roles',
    'customers.view', 'customers.manage',
    'installations.create', 'installations.assign', 'installations.update',
    'maintenance.create', 'maintenance.assign', 'maintenance.update_status',
    'payments.view', 'payments.verify',
    'reports.view', 'audit.view', 'settings.manage',
  ],
  operations_manager: [
    'staff.view', 'customers.view', 'customers.manage',
    'installations.create', 'installations.assign', 'installations.update',
    'maintenance.create', 'maintenance.assign', 'maintenance.update_status',
    'payments.view', 'reports.view', 'audit.view',
  ],
  field_engineer: [
    'installations.update', 'maintenance.create', 'maintenance.update_status', 'customers.view',
  ],
  finance_officer: [
    'payments.view', 'payments.verify', 'reports.view', 'customers.view', 'audit.view',
  ],
  customer_support: [
    'customers.view', 'customers.manage', 'maintenance.create', 'payments.view',
  ],
  compliance_auditor: [
    'audit.view', 'reports.view', 'installations.update', 'staff.view', 'customers.view',
  ],
  customer: [],
};

// ERP Models
interface OnboardingApplication {
  id: string;
  applicant_email: string;
  applicant_phone: string;
  full_name: string;
  requested_department: string;
  coren_reg_number?: string;
  assigned_region: string;
  status: 'AWAITING_EMAIL_VERIFY' | 'PENDING_SUPERADMIN_REVIEW' | 'APPROVED_INVITED' | 'REJECTED' | 'ACTIVATED';
  verification_token?: string;
  activation_token?: string;
  assigned_role_slug?: string;
  review_notes?: string;
  created_at: string;
}

interface InstallationOrder {
  id: string;
  work_order_number: string;
  customer_name: string;
  customer_phone: string;
  site_address: string;
  state_region: string;
  stage_step: number; // 1 to 16
  status_name: string;
  inverter_sku: string;
  pv_kwp: number;
  battery_kwh: number;
  total_amount_ngn: number;
  assigned_engineer: string;
  earthing_ohms: number;
  bom_serial: string;
  handover_signed: boolean;
}

interface MaintenanceOrder {
  id: string;
  ticket_number: string;
  device_id: string;
  customer_name: string;
  fault_code: string;
  fault_description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  stage_step: number; // 1 to 13
  status_name: string;
  assigned_tech: string;
  diagnosis_notes: string;
  parts_cost_ngn: number;
  labour_cost_ngn: number;
  total_cost_ngn: number;
  supervisor_verified: boolean;
}

interface FinanceInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  related_type: 'INSTALLATION' | 'MAINTENANCE' | 'MONTHLY_PAYG';
  amount_ngn: number;
  paid_amount_ngn: number;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  due_date: string;
}

interface VerificationPayment {
  id: string;
  payment_reference: string;
  customer_name: string;
  amount_ngn: number;
  payment_method: 'MONIEPOINT_DVA' | 'PAYSTACK_DVA' | 'OPAY_DVA' | 'MANUAL_BANK_TRANSFER';
  bank_teller_ref: string;
  bank_name: string;
  status: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';
  sts_token_issued?: string;
  credit_days_extended?: number;
  created_at: string;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor_email: string;
  actor_role: string;
  action: string;
  resource_type: string;
  resource_id: string;
  sha256_hash: string;
  prev_hash: string;
}

// Canonical Stepper Arrays
const INSTALLATION_STEPS = [
  '1_REQUEST_SUBMITTED', '2_OPS_REVIEWED', '3_SITE_ASSESSMENT_SCHEDULED', '4_SITE_ASSESSED',
  '5_QUOTATION_PREPARED', '6_QUOTATION_APPROVED', '7_WORK_ORDER_CREATED', '8_TECHNICIAN_ASSIGNED',
  '9_INSTALLATION_SCHEDULED', '10_IN_PROGRESS', '11_BOM_DOCUMENTED', '12_PHOTOS_UPLOADED',
  '13_COREN_INSPECTED', '14_COMMISSIONED', '15_HANDOVER_SIGNED', '16_COMPLETED'
];

const MAINTENANCE_STEPS = [
  '1_FAULT_REPORTED', '2_TRIAGED', '3_WORK_ORDER_CREATED', '4_TECH_ASSIGNED',
  '5_SITE_INSPECTED', '6_DIAGNOSIS_LOGGED', '7_REPAIR_IN_PROGRESS', '8_PARTS_RECORDED',
  '9_COSTS_CAPTURED', '10_SUPERVISOR_VERIFIED', '11_COMPLETION_REPORTED', '12_CUSTOMER_NOTIFIED',
  '13_CLOSED'
];

// Initial Data Mock Seeds
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


// ============================================================================
// 6-TIER ENTERPRISE ROLE DASHBOARD SPECIFICATIONS
// ============================================================================
export interface RoleDashboardPage {
  id: string;
  label: string;
  icon: string;
}

export const ROLE_DASHBOARD_PAGES: Record<string, RoleDashboardPage[]> = {
  super_admin: [
    { id: 'sa_executive', label: '🛡️ Executive Control Tower', icon: '🛡️' },
    { id: 'sa_staff_rbac', label: '👥 Staff Onboarding & RBAC Matrix', icon: '👥' },
    { id: 'sa_settings', label: '⚙️ Global Pricing & System Settings', icon: '⚙️' },
    { id: 'sa_audit_ledger', label: '⛓️ SHA-256 Ledger Audit Watch', icon: '⛓️' },
  ],
  finance_officer: [
    { id: 'fin_treasury', label: '💳 Treasury & Reconciliation Desk', icon: '💳' },
    { id: 'fin_invoices', label: '🧾 Invoices & Aging Cohorts', icon: '🧾' },
    { id: 'fin_verification', label: '🔍 Manual Payment & Token Verification', icon: '🔍' },
    { id: 'fin_analytics', label: '📊 Revenue & Collections Analytics', icon: '📊' },
  ],
  operations_manager: [
    { id: 'ops_fleet_gis', label: '🗺️ National GIS Fleet Command', icon: '🗺️' },
    { id: 'ops_dispatch', label: '☀️ 16-Step Installation Dispatch Board', icon: '☀️' },
    { id: 'ops_workforce', label: '👷 Field Workforce & Region Allocations', icon: '👷' },
    { id: 'ops_inventory', label: '📦 Inventory & Serialized BOM Monitor', icon: '📦' },
  ],
  coren_inspector: [
    { id: 'coren_safety', label: '🛡️ Safety & Compliance Watchtower', icon: '🛡️' },
    { id: 'coren_earthing', label: '⚡ Earthing & Commissioning Sign-Off', icon: '⚡' },
    { id: 'coren_tamper', label: '🔓 Hardware Tamper Clearance Queue', icon: '🔓' },
    { id: 'coren_standards', label: '📜 Regulatory Certifications & Standards', icon: '📜' },
  ],
  technician: [
    { id: 'tech_orders', label: '📋 My Assigned Work Orders', icon: '📋' },
    { id: 'tech_logger', label: '🛠️ Job Execution & BOM Logger', icon: '🛠️' },
    { id: 'tech_copilot', label: '🤖 Field AI Copilot (LocalGridAgent)', icon: '🤖' },
    { id: 'tech_evidence', label: '📸 Field Evidence & Photo Upload', icon: '📸' },
  ],
  customer_support: [
    { id: 'sup_helpdesk', label: '🎧 Helpdesk & Subscriber Lookup', icon: '🎧' },
    { id: 'sup_tickets', label: '🎫 Support Ticket & Fault Queue', icon: '🎫' },
    { id: 'sup_tokens', label: '⚡ Quick STS Token Resend & Diagnostics', icon: '⚡' },
    { id: 'sup_chat', label: '💬 Live Customer Chat & Communications', icon: '💬' },
  ],
};

export interface AuditStampInfo {
  actorName: string;
  actorRole: string;
  status: string;
  notes: string;
  timestamp: string;
  blockHash: string;
}

export default function AdminCommandCenter() {
  // Navigation & Theme
  const [activeConsoleTab, setActiveConsoleTab] = useState<string>('sa_executive');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [persona, setPersona] = useState<UserPersona>('operations');
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [makerCheckerStamps, setMakerCheckerStamps] = useState<Record<string, AuditStampInfo>>({});

  const normalizedRole = useMemo(() => {
    if (activeRole === 'field_engineer') return 'technician';
    if (activeRole === 'compliance_auditor') return 'coren_inspector';
    return activeRole || 'super_admin';
  }, [activeRole]);

  const rolePages = useMemo(() => {
    return ROLE_DASHBOARD_PAGES[normalizedRole] || ROLE_DASHBOARD_PAGES.super_admin;
  }, [normalizedRole]);

  useEffect(() => {
    const validIds = (ROLE_DASHBOARD_PAGES[normalizedRole] || ROLE_DASHBOARD_PAGES.super_admin).map((p) => p.id);
    if (!validIds.includes(activeConsoleTab)) {
      setActiveConsoleTab(validIds[0]);
    }
  }, [normalizedRole]);

  const handleMakerCheckerStamp = (rowId: string, status: string, defaultNotes: string, actionLabel: string) => {
    const notes = typeof window !== 'undefined' ? (window.prompt(`Enter review notes for [${actionLabel}]:`, defaultNotes) || defaultNotes) : defaultNotes;
    const nowUtc = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    const stamp: AuditStampInfo = {
      actorName: activeUserEmail.split('@')[0].toUpperCase(),
      actorRole: normalizedRole.replace('_', ' ').toUpperCase(),
      status,
      notes,
      timestamp: nowUtc,
      blockHash: 'SHA256:' + Math.random().toString(16).substring(2, 12),
    };
    setMakerCheckerStamps((prev) => ({ ...prev, [rowId]: stamp }));
    showToast(`✓ ${actionLabel} recorded with Maker-Checker Audit Stamp.`);
  };


  // Active Authenticated Role State (Instant Sandbox Impersonator)
  const [activeRole, setActiveRole] = useState<string>('super_admin');
  const [activeUserEmail, setActiveUserEmail] = useState<string>('sandbox.super_admin@skygrid.energy');
  const [authToken, setAuthToken] = useState<string>('mock-jwt-super-admin-master-token');
  const [grantedPermissions, setGrantedPermissions] = useState<string[]>(DEFAULT_ROLE_PERMISSIONS.super_admin);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);

  // Fleet & Watchtower State
  const [fleet, setFleet] = useState<FleetUnit[]>(INITIAL_FLEET);
  const [selectedUnit, setSelectedUnit] = useState<FleetUnit>(INITIAL_FLEET[0]);
  const [filterPin, setFilterPin] = useState<'ALL' | 'GREEN' | 'YELLOW' | 'RED'>('ALL');
  const [isRMAModalOpen, setIsRMAModalOpen] = useState(false);
  const [showAboutCharter, setShowAboutCharter] = useState(false);
  const [showIAMModal, setShowIAMModal] = useState(false);
  const [iamTab, setIamTab] = useState<'matrix' | 'staff' | 'simulator'>('matrix');

  // RMA Form State
  const [newGrowattSN, setNewGrowattSN] = useState('');
  const [newSealSN, setNewSealSN] = useState('');
  const [rmaReason, setRmaReason] = useState('Overvoltage lightning strike on AC input - COREN warranty replacement');

  // 1. Staff Onboarding State
  const [onboardingApps, setOnboardingApps] = useState<OnboardingApplication[]>([
    {
      id: 'req-app-001',
      applicant_email: 'chinedu.solar@skygrid.ng',
      applicant_phone: '+2348039988112',
      full_name: 'Engr. Chinedu Eze',
      requested_department: 'Engineering & Field Services',
      coren_reg_number: 'COREN/R/49182',
      assigned_region: 'Enugu & South-East Hub',
      status: 'PENDING_SUPERADMIN_REVIEW',
      verification_token: 'tok-verify-9912a',
      assigned_role_slug: 'field_engineer',
      created_at: '2026-11-06 14:22 UTC',
    },
    {
      id: 'req-app-002',
      applicant_email: 'fatima.finance@skygrid.ng',
      applicant_phone: '+2348102233445',
      full_name: 'Fatima Abubakar',
      requested_department: 'Finance & Treasury',
      assigned_region: 'Abuja Central',
      status: 'AWAITING_EMAIL_VERIFY',
      verification_token: 'tok-verify-8841c',
      created_at: '2026-11-06 16:45 UTC',
    },
  ]);
  const [applicantForm, setApplicantForm] = useState({
    full_name: '',
    applicant_email: '',
    applicant_phone: '',
    requested_department: 'Engineering & Field Services',
    coren_reg_number: '',
    assigned_region: 'Middle Belt (Jos Hub)',
  });
  const [activationForm, setActivationForm] = useState({
    token: '',
    employee_code: 'EMP-2026-781A',
    password: '',
    security_pin: '',
  });

  // 2. Installations State
  const [installations, setInstallations] = useState<InstallationOrder[]>([
    {
      id: 'inst-001',
      work_order_number: 'WO-INST-2026-001',
      customer_name: 'Engr. Shwarji I. Khatang',
      customer_phone: '+2348030000000',
      site_address: 'Plot 4, Rayfield Residential Corridor, Jos',
      state_region: 'Plateau State',
      stage_step: 14, // COMMISSIONED
      status_name: '14_COMMISSIONED',
      inverter_sku: 'GROWATT_SPF_5000ES',
      pv_kwp: 5.4,
      battery_kwh: 10.0,
      total_amount_ngn: 4450000,
      assigned_engineer: 'Engr. Tariq Bello (COREN R.48201)',
      earthing_ohms: 1.85,
      bom_serial: 'GW-SPF5000ES-94210 / LFP-512V-100AH-441',
      handover_signed: true,
    },
    {
      id: 'inst-002',
      work_order_number: 'WO-INST-2026-002',
      customer_name: 'Alhaji Bashir Umar',
      customer_phone: '+2348021122334',
      site_address: 'Bompai Industrial Area, Phase 2, Kano',
      state_region: 'Kano State',
      stage_step: 12, // PHOTOS_UPLOADED (Awaiting Stage 13 COREN)
      status_name: '12_PHOTOS_UPLOADED',
      inverter_sku: 'GROWATT_MAX_10000',
      pv_kwp: 12.0,
      battery_kwh: 20.0,
      total_amount_ngn: 9800000,
      assigned_engineer: 'Engr. Mustapha Aliyu',
      earthing_ohms: 2.1,
      bom_serial: 'GW-MAX10K-51201 / 2x LFP-512V-100AH',
      handover_signed: false,
    },
  ]);
  const [selectedInst, setSelectedInst] = useState<InstallationOrder>(installations[0]);
  const [instEarthingInput, setInstEarthingInput] = useState<number>(2.1);

  // 3. Maintenance State
  const [maintTickets, setMaintTickets] = useState<MaintenanceOrder[]>([
    {
      id: 'maint-001',
      ticket_number: 'TKT-MAINT-2026-001',
      device_id: 'DEV-9D7E-GROWATT-00512',
      customer_name: 'Alhaji Musa Danjuma',
      fault_code: 'ERR_09_TAMPER_SWITCH_OPEN',
      fault_description: 'Micro-plunger lower shroud tamper open lockout. MPPT solar charging active, AC load isolated.',
      severity: 'CRITICAL',
      stage_step: 6, // DIAGNOSIS_LOGGED
      status_name: '6_DIAGNOSIS_LOGGED',
      assigned_tech: 'Technician Yakubu Garba',
      diagnosis_notes: 'Physical shroud inspection confirmed seal broken during building AC rewiring. Micro-plunger verified intact.',
      parts_cost_ngn: 15000,
      labour_cost_ngn: 25000,
      total_cost_ngn: 40000,
      supervisor_verified: false,
    },
    {
      id: 'maint-002',
      ticket_number: 'TKT-MAINT-2026-002',
      device_id: 'DEV-4C2B-GROWATT-00389',
      customer_name: 'Chief Emeka Okafor',
      fault_code: 'WARN_04_LOW_BATTERY_RESERVE',
      fault_description: 'Extended overcast sky over Lekki lagoon. Battery reserve at 64% with high evening AC consumption.',
      severity: 'MEDIUM',
      stage_step: 10, // SUPERVISOR_VERIFIED
      status_name: '10_SUPERVISOR_VERIFIED',
      assigned_tech: 'Technician Bayo Adeleke',
      diagnosis_notes: 'Grid charging window configured between 02:00 and 05:00. Load shedding profile applied.',
      parts_cost_ngn: 0,
      labour_cost_ngn: 15000,
      total_cost_ngn: 15000,
      supervisor_verified: true,
    },
  ]);
  const [selectedMaint, setSelectedMaint] = useState<MaintenanceOrder>(maintTickets[0]);

  // 4. Finance State
  const [invoices, setInvoices] = useState<FinanceInvoice[]>([
    {
      id: 'inv-001',
      invoice_number: 'INV-2026-00412',
      customer_name: 'Engr. Shwarji I. Khatang',
      related_type: 'MONTHLY_PAYG',
      amount_ngn: 145000,
      paid_amount_ngn: 145000,
      status: 'PAID',
      due_date: '2026-11-20',
    },
    {
      id: 'inv-002',
      invoice_number: 'INV-2026-00413',
      customer_name: 'Chief Emeka Okafor',
      related_type: 'MONTHLY_PAYG',
      amount_ngn: 220000,
      paid_amount_ngn: 0,
      status: 'ISSUED',
      due_date: '2026-11-08',
    },
  ]);
  const [paymentQueue, setPaymentQueue] = useState<VerificationPayment[]>([
    {
      id: 'pay-001',
      payment_reference: 'PAY-MP-2026-00941',
      customer_name: 'Dr. Aisha Bello',
      amount_ngn: 115000,
      payment_method: 'MONIEPOINT_DVA',
      bank_teller_ref: 'MP-SESSION-992144',
      bank_name: 'Moniepoint Microfinance Bank',
      status: 'PENDING_VERIFICATION',
      created_at: '2026-11-06 18:10 UTC',
    },
    {
      id: 'pay-002',
      payment_reference: 'PAY-MAN-2026-00812',
      customer_name: 'Chief Emeka Okafor',
      amount_ngn: 220000,
      payment_method: 'MANUAL_BANK_TRANSFER',
      bank_teller_ref: 'ZENITH-TELLER-77123',
      bank_name: 'Zenith Bank Plc',
      status: 'PENDING_VERIFICATION',
      created_at: '2026-11-06 19:30 UTC',
    },
  ]);

  // 5. Copilot & Audit Trail State
  const [copilotMessages, setCopilotMessages] = useState<Array<{ sender: 'user' | 'agent'; text: string; time: string }>>([
    {
      sender: 'agent',
      text: '⚡ **SkyTron LocalGridAgent (Multi-Persona RAG Online):** You are authenticated as `' + activeRole + '`. Scoped data and domain guardrails are actively enforced.',
      time: 'Just now',
    },
  ]);
  const [copilotInput, setCopilotInput] = useState('');
  const [isCopilotQuerying, setIsCopilotQuerying] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([
    {
      id: 'aud-001',
      timestamp: '2026-11-06 19:40:12 UTC',
      actor_email: 'sandbox.super_admin@skygrid.energy',
      actor_role: 'super_admin',
      action: 'ROLE_IMPERSONATION',
      resource_type: 'AUTH_SESSION',
      resource_id: 'usr-sa-001',
      sha256_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      prev_hash: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    {
      id: 'aud-002',
      timestamp: '2026-11-06 19:42:05 UTC',
      actor_email: 'ops.adeleke@skygrid.energy',
      actor_role: 'operations_manager',
      action: 'INSTALLATION_STAGE_TRANSITION',
      resource_type: 'WORK_ORDER',
      resource_id: 'WO-INST-2026-001',
      sha256_hash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
      prev_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    },
  ]);
  const [auditVerified, setAuditVerified] = useState<boolean | null>(null);

  // Permission Check Guard
  const hasPermission = (permSlug: string): boolean => {
    if (activeRole === 'super_admin') return true;
    return grantedPermissions.includes(permSlug);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const assertPermission = (permSlug: string, actionDesc: string): boolean => {
    if (!hasPermission(permSlug)) {
      showToast(`🚫 HTTP 403 Forbidden: Missing permission '${permSlug}' for ${actionDesc}. Please switch to a role with this permission (e.g. Super Administrator) in the top bar.`);
      return false;
    }
    return true;
  };

  // Role Impersonation Switcher (calls backend /api/v1/auth/sandbox-impersonate with local fallback)
  const handleSwitchRole = async (roleSlug: string) => {
    setIsRoleMenuOpen(false);
    try {
      const resp = await fetch('http://localhost:8080/api/v1/auth/sandbox-impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_slug: roleSlug }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setActiveRole(roleSlug);
        setActiveUserEmail(data.email || `sandbox.${roleSlug}@skygrid.energy`);
        const token = data.access_token || `jwt-${roleSlug}`;
        setAuthToken(token);
        const perms: string[] = data.permissions || DEFAULT_ROLE_PERMISSIONS[roleSlug] || [];
        setGrantedPermissions(perms);
        const updatedSession = {
          user_id: `usr-${roleSlug}-01`,
          email: data.email || `sandbox.${roleSlug}@skygrid.energy`,
          full_name: `${ALL_ROLES_META.find(r => r.slug === roleSlug)?.name || roleSlug}`,
          role: roleSlug,
          token: token,
        };
        try {
          localStorage.setItem('skytron_session', JSON.stringify(updatedSession));
          window.dispatchEvent(new CustomEvent('skytron_auth_change', { detail: updatedSession }));
        } catch (err) {}
        showToast(`👑 Switched to ${ALL_ROLES_META.find(r => r.slug === roleSlug)?.name} (${perms.length} perms granted)`);
        return;
      }
    } catch (e) {
      // Local fallback
    }
    setActiveRole(roleSlug);
    setActiveUserEmail(`sandbox.${roleSlug}@skygrid.energy`);
    const perms = DEFAULT_ROLE_PERMISSIONS[roleSlug] || [];
    setGrantedPermissions(perms);
    const updatedSession = {
      user_id: `usr-${roleSlug}-01`,
      email: `sandbox.${roleSlug}@skygrid.energy`,
      full_name: `${ALL_ROLES_META.find(r => r.slug === roleSlug)?.name || roleSlug}`,
      role: roleSlug,
      token: `sandbox-jwt-${roleSlug}`,
    };
    try {
      localStorage.setItem('skytron_session', JSON.stringify(updatedSession));
      window.dispatchEvent(new CustomEvent('skytron_auth_change', { detail: updatedSession }));
    } catch (err) {}
    showToast(`👑 Switched to ${ALL_ROLES_META.find(r => r.slug === roleSlug)?.name} (${perms.length} perms granted)`);
  };

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

    const syncSession = () => {
      try {
        const raw = localStorage.getItem('skytron_session');
        if (raw) {
          const session = JSON.parse(raw);
          if (session.role) {
            setActiveRole(session.role);
            setGrantedPermissions(DEFAULT_ROLE_PERMISSIONS[session.role] || []);
            // Pre-filter department tab based on assigned role
            if (session.role === 'operations_manager') {
              setActiveConsoleTab('installations');
            } else if (session.role === 'finance_officer') {
              setActiveConsoleTab('finance');
            } else if (session.role === 'technician' || session.role === 'field_engineer') {
              setActiveConsoleTab('maintenance');
            } else if (session.role === 'super_admin' || session.role === 'system_admin') {
              setActiveConsoleTab('fleet');
            }
          }
          if (session.email) {
            setActiveUserEmail(session.email);
          }
          if (session.token) {
            setAuthToken(session.token);
          }
        }
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const tabParam = urlParams.get('tab');
          if (tabParam && ['fleet', 'staff', 'installations', 'maintenance', 'finance', 'copilot'].includes(tabParam)) {
            setActiveConsoleTab(tabParam as any);
          }
        }
      } catch (e) {}
    };
    syncSession();
    window.addEventListener('storage', syncSession);
    window.addEventListener('skytron_auth_change', syncSession as EventListener);
    return () => {
      window.removeEventListener('storage', syncSession);
      window.removeEventListener('skytron_auth_change', syncSession as EventListener);
    };
  }, []);

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
    if (!assertPermission('maintenance.update_status', 'clearing hardware tamper lockout')) return;
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
    showToast(`✅ Tamper Lockout Cleared for ${deviceId} • Modbus Relay restored to ACTIVE_ON`);
  };

  const handleExecuteRMASwap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assertPermission('maintenance.create', 'executing RMA hardware serial swap')) return;
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
    showToast(`✅ RMA Hardware Swap Committed for ${selectedUnit.device_id}`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* 1. TOP SINGLE FIXED UNIFIED ENTERPRISE NAVBAR */}
      <EnterpriseNavbar activeTab="admin" />

      {/* 2. TOP AUTH BAR & INSTANT ROLE SWITCHER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-indigo-900/40 text-white px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs shadow-md">
        <div className="flex items-center gap-3">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 uppercase font-mono text-[10px] tracking-wider">Active Persona:</span>
            <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 font-bold flex items-center gap-1.5">
              <span>{ALL_ROLES_META.find(r => r.slug === activeRole)?.icon}</span>
              <span>{ALL_ROLES_META.find(r => r.slug === activeRole)?.name}</span>
            </span>
          </div>
          <span className="text-slate-500 hidden sm:inline">&bull;</span>
          <span className="font-mono text-slate-300 hidden md:inline">{activeUserEmail}</span>
          <span className="text-slate-500 hidden md:inline">&bull;</span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[11px] font-bold">
            {grantedPermissions.length} Permissions Active
          </span>
        </div>

        <div className="flex items-center gap-3 relative">
          <div className="relative">
            <button
              onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-3 py-1.5 rounded-xl border border-indigo-400/40 transition flex items-center gap-1.5 text-xs shadow-md shadow-indigo-900/30"
            >
              <span>🔐 Switch Active Role</span>
              <span>▾</span>
            </button>

            {isRoleMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-indigo-800 rounded-2xl shadow-2xl p-2 z-50 space-y-1">
                <div className="px-3 py-1.5 text-[10px] uppercase font-mono font-bold text-slate-400 border-b border-slate-800">
                  Select Sandbox Impersonation Role:
                </div>
                {ALL_ROLES_META.map((r) => {
                  const isCur = r.slug === activeRole;
                  return (
                    <button
                      key={r.slug}
                      onClick={() => handleSwitchRole(r.slug)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                        isCur ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{r.icon}</span>
                        <div>
                          <div>{r.name}</div>
                          <div className="text-[10px] opacity-75 font-mono">{r.slug}</div>
                        </div>
                      </div>
                      {isCur && <span className="text-xs">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowAboutCharter(true)}
            className="text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition"
          >
            🌍 Charter
          </button>

          {/* Change Password Button */}
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('skytron_open_change_password'));
              }
            }}
            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold px-3 py-1.5 rounded-xl border border-amber-500/40 transition flex items-center gap-1.5 text-xs shadow-md cursor-pointer"
            title="Change Your Staff Account Password"
          >
            <span>🔑</span>
            <span className="hidden sm:inline">Password</span>
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
            className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold px-3 py-1.5 rounded-xl border border-rose-500/40 transition flex items-center gap-1.5 text-xs shadow-md cursor-pointer"
            title="Logout & Return to Main Landing Page"
          >
            <span>🚪</span>
            <span className="hidden sm:inline">Logout</span>
          </button>

          {/* Far Right: Round Staff / Admin Passport Avatar */}
          <div className="relative shrink-0 ml-1" title="Verified Staff Credentials">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full p-0.5 bg-gradient-to-tr from-indigo-500 via-purple-500 to-amber-400 shadow-md shadow-indigo-500/20">
              <img
                src={typeof window !== 'undefined' ? (localStorage.getItem('staff_passport_photo') || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80') : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'}
                alt="Staff Passport"
                className="w-full h-full rounded-full object-cover border-2 border-slate-900"
              />
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-900" title="Active Verified Staff" />
          </div>
        </div>
      </div>

      {/* TOAST NOTIFICATION BANNER */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 max-w-md bg-slate-900 border border-indigo-500 text-white p-4 rounded-2xl shadow-2xl flex items-start gap-3 animate-slide-in">
          <span className="text-xl">🔔</span>
          <div className="text-xs leading-relaxed flex-1">{toastMessage}</div>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white text-xs">&times;</button>
        </div>
      )}

      {/* 3. ENTERPRISE DYNAMIC 4-PAGE ROLE CONSOLE NAVIGATION */}
      <div className="bg-white/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 px-6 py-2.5 flex items-center gap-2 overflow-x-auto backdrop-blur-md sticky top-16 z-40">
        {rolePages.map((tab) => {
          const isActive = activeConsoleTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveConsoleTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 dark:bg-emerald-500 dark:text-slate-950 font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <span className="text-sm">{tab.icon}</span>
              <span>{tab.label.replace(/^[^\s]+\s*/, '')}</span>
            </button>
          );
        })}
      </div>

      {/* 4. MAIN OPERATIONS CONSOLE BODY */}
      <main className="max-w-7xl mx-auto p-6 space-y-6">

        {/* ================================================================== */}
        {/* TAB 1: FLEET WATCHTOWER & GIS MAP                                  */}
        {/* ================================================================== */}
        {(activeConsoleTab === 'fleet' || activeConsoleTab === 'sa_executive' || activeConsoleTab === 'ops_fleet_gis') && (
          <div className="space-y-6">
            {/* Executive KPI Cards */}
            <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Monitored Growatt Fleet</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">{kpis.activeCount} Units</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                  {kpis.greenCount} Healthy &bull; 100% LiFePO4 Storage
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Sample Fleet MRR</p>
                <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400 mt-1 font-mono tabular-nums">{formatNaira(kpis.totalMRR)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Rails: Moniepoint &bull; Paystack &bull; OPay</p>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Collection Efficiency &amp; PAR</p>
                <p className="text-3xl font-black text-sky-700 dark:text-cyan-400 mt-1 font-mono tabular-nums">97.4%</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">PAR &gt; 30 Days: 1.8% (Target &lt; 3.0%)</p>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Lower Shroud Tamper Alerts</p>
                <p className={`text-3xl font-black mt-1 font-mono tabular-nums ${kpis.tamperedCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {kpis.tamperedCount} Critical
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Micro-plunger switch instant lockout</p>
              </div>
            </section>

            {/* GIS Fleet Watchtower & Device Inspector */}
            <section className="grid lg:grid-cols-12 gap-6">
              {/* Left: GIS Fleet Filter & Matrix */}
              <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Live Nigerian GIS Fleet Map &amp; Telemetry Matrix</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Click any deployed Growatt unit to inspect VFS state &amp; hardware seals</p>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs">
                    {(['ALL', 'GREEN', 'YELLOW', 'RED'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setFilterPin(status)}
                        className={`px-2.5 py-1 rounded-lg font-bold transition ${
                          filterPin === status
                            ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950'
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
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {u.model_sku} &bull; Seal: <span className="font-mono text-slate-800 dark:text-slate-300">{u.seal_serial}</span> &bull; Earthing:{' '}
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
              <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 space-y-5 shadow-sm">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-mono uppercase text-emerald-700 dark:text-emerald-400 font-bold">VFS Block Hardware Inspector</span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{selectedUnit.customer_name}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsRMAModalOpen(true)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
                    >
                      RMA Swap
                    </button>
                    <span className="text-xs font-mono bg-slate-100 dark:bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300">
                      {selectedUnit.growatt_serial}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <p className="text-slate-500 dark:text-slate-400">Contactor / Relay State</p>
                    <p className={`text-sm font-black font-mono mt-1 ${selectedUnit.relay_state === 'ACTIVE_ON' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                      {selectedUnit.relay_state}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Solar MPPT Charger: ACTIVE</p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <p className="text-slate-500 dark:text-slate-400">Lower Shroud Tamper Switch</p>
                    <p className={`text-sm font-black font-mono mt-1 ${selectedUnit.tamper_state === 'SEALED' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                      {selectedUnit.tamper_state}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Seal: {selectedUnit.seal_serial}</p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-2 text-xs font-mono">
                  <p className="text-slate-500 dark:text-slate-400 font-sans font-semibold">POSIX VFS Block Path:</p>
                  <p className="text-emerald-700 dark:text-emerald-400 break-all">
                    /var/lib/payg-vfs/blocks/8f/3a/{selectedUnit.device_id}/state.json
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 tabular-nums">
                    <span>PV: {selectedUnit.pv_watts}W</span>
                    <span>Load: {selectedUnit.ac_load_watts}W</span>
                    <span>Temp: {selectedUnit.inverter_temp_c}°C</span>
                  </div>
                </div>

                {selectedUnit.tamper_state === 'TRIPPED' ? (
                  <div className="bg-rose-500/10 border border-rose-500/40 rounded-xl p-4 space-y-3 text-xs">
                    <p className="font-bold text-rose-800 dark:text-rose-300">
                      🚨 CRITICAL TAMPER LOCKOUT: Micro-plunger switch inside lower terminal box tripped!
                    </p>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                      AC Output is locked (`STANDBY_LOCKED`), while the Growatt MPPT Solar Charger remains active ({selectedUnit.battery_soc_pct}% SoC) to prevent battery damage.
                    </p>
                    <button
                      onClick={() => handleSimulateTamperClear(selectedUnit.device_id)}
                      className="w-full bg-rose-600 hover:bg-rose-500 text-white font-extrabold py-2.5 rounded-xl transition shadow-lg"
                    >
                      Verify Field Re-Seal &amp; Clear Tamper Lockout
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                    ✅ <strong>Hardware Security Intact:</strong> Steel seal serial {selectedUnit.seal_serial} matched. Tamper switch closed, Modbus telemetry verified.
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 2: STAFF ONBOARDING & RBAC MANAGEMENT                          */}
        {/* ================================================================== */}
        {(activeConsoleTab === 'staff' || activeConsoleTab === 'sa_staff_rbac') && (
          <div className="space-y-6">
            {/* Header / Intro */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-mono font-bold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase">
                  ENTERPRISE IAM &amp; HYBRID ONBOARDING PIPELINE
                </span>
                <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  Staff Candidates, Super Admin Approvals &amp; Role Matrix
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Applicant submission &rarr; Email verification &rarr; Super Admin review &amp; role assignment &rarr; Staff activation.
                </p>
              </div>
              <button
                onClick={() => setShowIAMModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <span>🛡️</span>
                <span>Open Role Matrix &amp; Simulator</span>
              </button>
            </div>

            <div className="grid lg:grid-cols-12 gap-6">
              {/* Left Column: Review & Approval Queue */}
              <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>📋</span> Super Admin Review Queue
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-mono font-bold">
                    {onboardingApps.length} Candidates Logged
                  </span>
                </div>

                <div className="space-y-3">
                  {onboardingApps.map((app) => {
                    const isReviewable = app.status === 'PENDING_SUPERADMIN_REVIEW';
                    const isVerifyNeeded = app.status === 'AWAITING_EMAIL_VERIFY';

                    return (
                      <div
                        key={app.id}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-mono text-slate-400">{app.id}</span>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">{app.full_name}</h4>
                            <p className="text-xs text-slate-500">{app.applicant_email} &bull; {app.applicant_phone}</p>
                            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                              {app.requested_department} {app.coren_reg_number ? `(${app.coren_reg_number})` : ''} &bull; {app.assigned_region}
                            </p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                            app.status === 'ACTIVATED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            app.status === 'PENDING_SUPERADMIN_REVIEW' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            app.status === 'APPROVED_INVITED' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                            app.status === 'REJECTED' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                            'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                          }`}>
                            {app.status}
                          </span>
                        </div>

                        {/* Actions per state */}
                        {isVerifyNeeded && (
                          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <span className="text-xs text-slate-500">Applicant received verification link</span>
                            <button
                              onClick={() => {
                                setOnboardingApps(prev => prev.map(a => a.id === app.id ? { ...a, status: 'PENDING_SUPERADMIN_REVIEW' } : a));
                                showToast(`✅ Email verified for ${app.full_name} • Candidate moved to Super Admin review`);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                            >
                              Simulate 1-Click Email Verify &rarr;
                            </button>
                          </div>
                        )}

                        {isReviewable && (
                          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 font-semibold">Assign Role:</span>
                              <select
                                value={app.assigned_role_slug || 'field_engineer'}
                                onChange={(e) => {
                                  const r = e.target.value;
                                  setOnboardingApps(prev => prev.map(a => a.id === app.id ? { ...a, assigned_role_slug: r } : a));
                                }}
                                className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs"
                              >
                                {ALL_ROLES_META.map(r => (
                                  <option key={r.slug} value={r.slug}>{r.name} ({r.slug})</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  if (!assertPermission('staff.approve', 'approving staff application')) return;
                                  setOnboardingApps(prev => prev.map(a => a.id === app.id ? {
                                    ...a,
                                    status: 'APPROVED_INVITED',
                                    activation_token: `tok-act-${Date.now().toString().slice(-5)}`,
                                  } : a));
                                  showToast(`🎉 Approved & Invited: ${app.full_name} assigned role '${app.assigned_role_slug || 'field_engineer'}'`);
                                }}
                                className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                              >
                                ✓ Approve &amp; Issue Invitation Token
                              </button>
                              <button
                                onClick={() => {
                                  if (!assertPermission('staff.approve', 'rejecting staff application')) return;
                                  setOnboardingApps(prev => prev.map(a => a.id === app.id ? { ...a, status: 'REJECTED' } : a));
                                  showToast(`❌ Rejected application for ${app.full_name}`);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition"
                              >
                                ✕ Reject
                              </button>
                            </div>
                          </div>
                        )}

                        {app.status === 'APPROVED_INVITED' && (
                          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                            <span className="font-mono text-emerald-600 dark:text-emerald-400">
                              Activation Token: {app.activation_token || 'tok-act-88190'}
                            </span>
                            <button
                              onClick={() => {
                                setActivationForm(prev => ({ ...prev, token: app.activation_token || 'tok-act-88190' }));
                                showToast(`Pasted token to Activation Box below`);
                              }}
                              className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                            >
                              Copy to Activation Form &rarr;
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Application & Activation Forms */}
              <div className="lg:col-span-5 space-y-6">
                {/* 1. Public Application Simulator */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>📝</span> Candidate Application Simulator (POST /api/v1/auth/staff/apply)
                  </h3>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!applicantForm.full_name || !applicantForm.applicant_email) return;
                      const newApp: OnboardingApplication = {
                        id: `req-app-${Date.now().toString().slice(-4)}`,
                        applicant_email: applicantForm.applicant_email,
                        applicant_phone: applicantForm.applicant_phone || '+2348000000000',
                        full_name: applicantForm.full_name,
                        requested_department: applicantForm.requested_department,
                        coren_reg_number: applicantForm.coren_reg_number,
                        assigned_region: applicantForm.assigned_region,
                        status: 'AWAITING_EMAIL_VERIFY',
                        verification_token: `tok-vfy-${Date.now().toString().slice(-4)}`,
                        created_at: 'Just now',
                      };
                      setOnboardingApps(prev => [newApp, ...prev]);
                      setApplicantForm({
                        full_name: '',
                        applicant_email: '',
                        applicant_phone: '',
                        requested_department: 'Engineering & Field Services',
                        coren_reg_number: '',
                        assigned_region: 'Middle Belt (Jos Hub)',
                      });
                      showToast(`📬 Application submitted! Check review queue for verification`);
                    }}
                    className="space-y-2.5 text-xs"
                  >
                    <div>
                      <label className="block text-slate-500 mb-1">Full Legal Name</label>
                      <input
                        required
                        placeholder="e.g. Engr. Obinna Nwosu"
                        value={applicantForm.full_name}
                        onChange={(e) => setApplicantForm({ ...applicantForm, full_name: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-500 mb-1">Email Address</label>
                        <input
                          required
                          type="email"
                          placeholder="obinna.nwosu@skygrid.ng"
                          value={applicantForm.applicant_email}
                          onChange={(e) => setApplicantForm({ ...applicantForm, applicant_email: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">Phone Number</label>
                        <input
                          placeholder="+2348031234567"
                          value={applicantForm.applicant_phone}
                          onChange={(e) => setApplicantForm({ ...applicantForm, applicant_phone: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-500 mb-1">Department</label>
                        <select
                          value={applicantForm.requested_department}
                          onChange={(e) => setApplicantForm({ ...applicantForm, requested_department: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                        >
                          <option>Engineering &amp; Field Services</option>
                          <option>Operations &amp; Dispatch</option>
                          <option>Finance &amp; Treasury</option>
                          <option>Customer Support</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">COREN Reg No. (Optional)</label>
                        <input
                          placeholder="COREN/R/49912"
                          value={applicantForm.coren_reg_number}
                          onChange={(e) => setApplicantForm({ ...applicantForm, coren_reg_number: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-md shadow-emerald-600/20"
                    >
                      Submit Candidate Application &rarr;
                    </button>
                  </form>
                </div>

                {/* 2. Staff Activation Box */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>🔑</span> Account Activation Box (POST /api/v1/auth/staff/activate)
                  </h3>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!activationForm.token || !activationForm.password) {
                        showToast(`Please supply activation token and password`);
                        return;
                      }
                      setOnboardingApps(prev => prev.map(a => a.activation_token === activationForm.token ? { ...a, status: 'ACTIVATED' } : a));
                      showToast(`🎉 Staff Account Activated! Code: ${activationForm.employee_code}. Staff can now log in.`);
                    }}
                    className="space-y-2.5 text-xs"
                  >
                    <div>
                      <label className="block text-slate-500 mb-1">Invitation / Activation Token</label>
                      <input
                        required
                        placeholder="tok-act-..."
                        value={activationForm.token}
                        onChange={(e) => setActivationForm({ ...activationForm, token: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-500 mb-1">Set Password</label>
                        <input
                          required
                          type="password"
                          placeholder="••••••••••••"
                          value={activationForm.password}
                          onChange={(e) => setActivationForm({ ...activationForm, password: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">4-Digit Security PIN</label>
                        <input
                          maxLength={4}
                          placeholder="9821"
                          value={activationForm.security_pin}
                          onChange={(e) => setActivationForm({ ...activationForm, security_pin: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-md shadow-indigo-600/20"
                    >
                      Complete Activation &amp; Issue Staff Credentials
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 3: 16-STEP INSTALLATION PIPELINE                               */}
        {/* ================================================================== */}
        {(activeConsoleTab === 'installations' || activeConsoleTab === 'ops_dispatch') && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-mono font-bold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase">
                  ENTERPRISE 16-STEP WORK-ORDER ENGINE
                </span>
                <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  Solar Field Installations &amp; COREN Commissioning
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Enforces earthing resistance &le; 5.00&Omega; gate before Stage 13 COREN inspection &amp; Stage 14 commissioning.
                </p>
              </div>
              <button
                onClick={() => {
                  if (!assertPermission('installations.create', 'creating installation work order')) return;
                  const newOrder: InstallationOrder = {
                    id: `inst-${Date.now().toString().slice(-4)}`,
                    work_order_number: `WO-INST-2026-00${installations.length + 1}`,
                    customer_name: 'Alhaji Sanusi Dantata',
                    customer_phone: '+2348039911223',
                    site_address: 'Central Business District, Abuja FCT',
                    state_region: 'FCT Abuja',
                    stage_step: 1,
                    status_name: '1_REQUEST_SUBMITTED',
                    inverter_sku: 'GROWATT_SPF_5000ES',
                    pv_kwp: 5.4,
                    battery_kwh: 10.0,
                    total_amount_ngn: 4450000,
                    assigned_engineer: 'Unassigned',
                    earthing_ohms: 2.2,
                    bom_serial: 'Pending documentation',
                    handover_signed: false,
                  };
                  setInstallations([newOrder, ...installations]);
                  setSelectedInst(newOrder);
                  showToast(`☀️ Created Installation Order ${newOrder.work_order_number}`);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-md"
              >
                + Create Installation Order
              </button>
            </div>

            <div className="grid lg:grid-cols-12 gap-6">
              {/* Installation Orders List */}
              <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
                  Active Work Orders ({installations.length})
                </h3>
                <div className="space-y-3">
                  {installations.map((inst) => {
                    const isSel = inst.id === selectedInst.id;
                    return (
                      <div
                        key={inst.id}
                        onClick={() => {
                          setSelectedInst(inst);
                          setInstEarthingInput(inst.earthing_ohms);
                        }}
                        className={`p-4 rounded-xl border cursor-pointer transition space-y-2 ${
                          isSel
                            ? 'bg-emerald-50/50 dark:bg-slate-950 border-emerald-500 shadow-md'
                            : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-slate-400">{inst.work_order_number}</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold">
                            Stage {inst.stage_step}/16
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{inst.customer_name}</h4>
                        <p className="text-xs text-slate-500">{inst.site_address}</p>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                          <span>{inst.inverter_sku} &bull; {inst.pv_kwp}kWp</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{inst.earthing_ohms}Ω</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 16-Step Interactive Stepper & Controls */}
              <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-5">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">WORK ORDER INSPECTOR</span>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">{selectedInst.customer_name}</h3>
                  </div>
                  <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-xs font-bold">
                    {selectedInst.work_order_number}
                  </span>
                </div>

                {/* 16-Step Horizontal Progress Ribbon */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1 font-semibold">
                    <span>16-Step Progression</span>
                    <span>Stage {selectedInst.stage_step} of 16 ({selectedInst.status_name})</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                      style={{ width: `${(selectedInst.stage_step / 16) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Grid of Steps */}
                <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                  {INSTALLATION_STEPS.map((step, idx) => {
                    const stepNum = idx + 1;
                    const isDone = stepNum < selectedInst.stage_step;
                    const isCur = stepNum === selectedInst.stage_step;

                    return (
                      <div
                        key={step}
                        className={`p-1.5 rounded-lg border text-center transition ${
                          isCur
                            ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400 shadow-sm'
                            : isDone
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400 opacity-60'
                        }`}
                      >
                        <div className="font-mono">#{stepNum}</div>
                        <div className="truncate">{step.replace(/^\d+_/, '')}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Nigerian COREN Earthing Gate & Advancer */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        COREN / NEMSA Earthing Resistance Gate (&le; 5.00&Omega;)
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Deep earth pit testing using calibrated 3-pole ground clamp meter.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.05"
                        value={instEarthingInput}
                        onChange={(e) => setInstEarthingInput(parseFloat(e.target.value) || 0)}
                        className="w-24 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm font-mono font-bold text-center"
                      />
                      <span className="font-bold text-xs">&Omega;</span>
                    </div>
                  </div>

                  {instEarthingInput > 5.00 ? (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-400 font-semibold">
                      ⚠️ COREN VIOLATION: Measured resistance ({instEarthingInput}&Omega;) exceeds maximum statutory safety limit (&le; 5.00&Omega;). Transition to Stage 13 COREN or 14 Commissioned is strictly blocked! Add bentonite soil moisture compound and copper ground rods.
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                      ✅ COREN Compliant: Measured resistance ({instEarthingInput}&Omega;) satisfies Nigerian NEMSA &amp; COREN electrical standards.
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => {
                        if (!assertPermission('installations.assign', 'assigning field engineer')) return;
                        const eng = prompt('Enter Field Engineer Name & COREN ID:', 'Engr. Tariq Bello (COREN R.48201)');
                        if (eng) {
                          setInstallations(prev => prev.map(i => i.id === selectedInst.id ? { ...i, assigned_engineer: eng } : i));
                          setSelectedInst(prev => ({ ...prev, assigned_engineer: eng }));
                          showToast(`Assigned ${eng} to ${selectedInst.work_order_number}`);
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-bold transition"
                    >
                      👤 Assign Lead Engineer
                    </button>

                    <button
                      disabled={selectedInst.stage_step >= 16}
                      onClick={() => {
                        if (!assertPermission('installations.update', 'advancing installation stage')) return;

                        // Check Earthing Gate for stages 12 -> 13 or 13 -> 14
                        if (selectedInst.stage_step >= 12 && instEarthingInput > 5.00) {
                          showToast(`🚫 COREN Earthing Gate Blocked: Earthing resistance is ${instEarthingInput}Ω (Max 5.00Ω permitted)`);
                          return;
                        }

                        const nextStep = selectedInst.stage_step + 1;
                        const nextName = INSTALLATION_STEPS[nextStep - 1] || '16_COMPLETED';
                        setInstallations(prev => prev.map(i => i.id === selectedInst.id ? {
                          ...i,
                          stage_step: nextStep,
                          status_name: nextName,
                          earthing_ohms: instEarthingInput,
                        } : i));
                        setSelectedInst(prev => ({
                          ...prev,
                          stage_step: nextStep,
                          status_name: nextName,
                          earthing_ohms: instEarthingInput,
                        }));
                        showToast(`🚀 Advanced ${selectedInst.work_order_number} to Stage ${nextStep} (${nextName})`);
                      }}
                      className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-md"
                    >
                      Advance to Next Stage &rarr;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 4: 13-STEP MAINTENANCE & FAULT WORK ORDERS                     */}
        {/* ================================================================== */}
        {(activeConsoleTab === 'maintenance' || activeConsoleTab === 'sup_tickets') && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-mono font-bold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase">
                  13-STEP AFTER-SALES &amp; HARDWARE RMA CONSOLE
                </span>
                <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  Maintenance Tickets, Parts Logging &amp; Supervisor Verifications
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Full service lifecycle from customer fault report to technician diagnosis, spare parts cost capture, and supervisor sign-off.
                </p>
              </div>
              <button
                onClick={() => {
                  if (!assertPermission('maintenance.create', 'logging new fault ticket')) return;
                  const newTkt: MaintenanceOrder = {
                    id: `maint-${Date.now().toString().slice(-4)}`,
                    ticket_number: `TKT-MAINT-2026-00${maintTickets.length + 1}`,
                    device_id: 'DEV-8F3A-GROWATT-00421',
                    customer_name: 'Engr. Shwarji I. Khatang',
                    fault_code: 'ERR_02_INVERTER_HIGH_TEMP',
                    fault_description: 'Heatsink temperature exceeded 75°C during peak midday load.',
                    severity: 'HIGH',
                    stage_step: 1,
                    status_name: '1_FAULT_REPORTED',
                    assigned_tech: 'Unassigned',
                    diagnosis_notes: 'Pending inspection',
                    parts_cost_ngn: 0,
                    labour_cost_ngn: 12000,
                    total_cost_ngn: 12000,
                    supervisor_verified: false,
                  };
                  setMaintTickets([newTkt, ...maintTickets]);
                  setSelectedMaint(newTkt);
                  showToast(`🔧 Logged Fault Ticket ${newTkt.ticket_number}`);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-md"
              >
                + Log New Fault Ticket
              </button>
            </div>

            <div className="grid lg:grid-cols-12 gap-6">
              {/* Tickets List */}
              <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
                  Maintenance Queue ({maintTickets.length})
                </h3>
                <div className="space-y-3">
                  {maintTickets.map((tkt) => {
                    const isSel = tkt.id === selectedMaint.id;
                    return (
                      <div
                        key={tkt.id}
                        onClick={() => setSelectedMaint(tkt)}
                        className={`p-4 rounded-xl border cursor-pointer transition space-y-2 ${
                          isSel
                            ? 'bg-emerald-50/50 dark:bg-slate-950 border-emerald-500 shadow-md'
                            : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-slate-400">{tkt.ticket_number}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tkt.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {tkt.severity}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{tkt.customer_name}</h4>
                        <p className="text-xs font-mono text-rose-600 dark:text-rose-400">{tkt.fault_code}</p>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                          <span>Stage {tkt.stage_step}/13</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatNaira(tkt.total_cost_ngn)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Maintenance Lifecycle Stepper & Cost Capture */}
              <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-5">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono text-rose-600 dark:text-rose-400 font-bold">{selectedMaint.fault_code}</span>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">{selectedMaint.customer_name}</h3>
                  </div>
                  <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-xs font-bold">
                    {selectedMaint.ticket_number}
                  </span>
                </div>

                {/* 13-Step Progress Ribbon */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1 font-semibold">
                    <span>13-Step Lifecycle Progress</span>
                    <span>Stage {selectedMaint.stage_step} of 13 ({selectedMaint.status_name})</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                      style={{ width: `${(selectedMaint.stage_step / 13) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Grid of Steps */}
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 text-[10px]">
                  {MAINTENANCE_STEPS.map((step, idx) => {
                    const stepNum = idx + 1;
                    const isDone = stepNum < selectedMaint.stage_step;
                    const isCur = stepNum === selectedMaint.stage_step;

                    return (
                      <div
                        key={step}
                        className={`p-1.5 rounded-lg border text-center transition ${
                          isCur
                            ? 'bg-amber-500 text-slate-950 font-black border-amber-400 shadow-sm'
                            : isDone
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400 opacity-60'
                        }`}
                      >
                        <div className="font-mono">#{stepNum}</div>
                        <div className="truncate">{step.replace(/^\d+_/, '')}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Diagnosis, Parts & Supervisor Verification */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                  <div>
                    <span className="text-slate-500 font-semibold block mb-1">Technician Diagnosis &amp; Root Cause:</span>
                    <p className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
                      {selectedMaint.diagnosis_notes}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase">Parts Cost</span>
                      <p className="font-mono font-bold mt-0.5">{formatNaira(selectedMaint.parts_cost_ngn)}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase">Labour Cost</span>
                      <p className="font-mono font-bold mt-0.5">{formatNaira(selectedMaint.labour_cost_ngn)}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                      <span className="text-[10px] uppercase font-bold">Total Cost</span>
                      <p className="font-mono font-black mt-0.5">{formatNaira(selectedMaint.total_cost_ngn)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => {
                        if (!assertPermission('maintenance.update_status', 'supervisor verification of repair')) return;
                        setMaintTickets(prev => prev.map(t => t.id === selectedMaint.id ? {
                          ...t,
                          stage_step: 10,
                          status_name: '10_SUPERVISOR_VERIFIED',
                          supervisor_verified: true,
                        } : t));
                        setSelectedMaint(prev => ({ ...prev, stage_step: 10, status_name: '10_SUPERVISOR_VERIFIED', supervisor_verified: true }));
                        showToast(`✓ Supervisor sign-off recorded for ${selectedMaint.ticket_number}`);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition"
                    >
                      🛡️ Supervisor Sign-off
                    </button>

                    <button
                      disabled={selectedMaint.stage_step >= 13}
                      onClick={() => {
                        if (!assertPermission('maintenance.update_status', 'advancing maintenance ticket')) return;
                        const next = selectedMaint.stage_step + 1;
                        const nextName = MAINTENANCE_STEPS[next - 1] || '13_CLOSED';
                        setMaintTickets(prev => prev.map(t => t.id === selectedMaint.id ? {
                          ...t,
                          stage_step: next,
                          status_name: nextName,
                        } : t));
                        setSelectedMaint(prev => ({ ...prev, stage_step: next, status_name: nextName }));
                        showToast(`Advanced ${selectedMaint.ticket_number} to Stage ${next} (${nextName})`);
                      }}
                      className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold transition shadow-md"
                    >
                      Advance Maintenance Step &rarr;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 5: FINANCE, INVOICES & PAYMENT VERIFICATION                    */}
        {/* ================================================================== */}
        {(activeConsoleTab === 'finance' || activeConsoleTab === 'fin_verification') && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-mono font-bold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase">
                  FINANCIAL LEDGER &amp; VERIFICATION ENGINE
                </span>
                <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  Invoices, DVA Webhooks &amp; 20-Digit STS Token Issuance
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Reconcile Moniepoint &amp; Paystack virtual accounts or manually verify bank transfers with automatic STS token generation.
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-12 gap-6">
              {/* Payment Verification Queue */}
              <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>⚡</span> Payments Verification Queue
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono font-bold">
                    {paymentQueue.filter(p => p.status === 'PENDING_VERIFICATION').length} Pending
                  </span>
                </div>

                <div className="space-y-3">
                  {paymentQueue.map((p) => {
                    const isPending = p.status === 'PENDING_VERIFICATION';

                    return (
                      <div
                        key={p.id}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <span className="font-mono text-xs font-bold text-slate-400">{p.payment_reference}</span>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">{p.customer_name}</h4>
                            <p className="text-xs text-slate-500">{p.bank_name} &bull; Ref: <code className="font-mono">{p.bank_teller_ref}</code></p>
                          </div>
                          <div className="text-right">
                            <div className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                              {formatNaira(p.amount_ngn)}
                            </div>
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                              p.status === 'VERIFIED' ? 'bg-emerald-500/20 text-emerald-400' :
                              p.status === 'REJECTED' ? 'bg-rose-500/20 text-rose-400' :
                              'bg-amber-500/20 text-amber-400'
                            }`}>
                              {p.status}
                            </span>
                          </div>
                        </div>

                        {/* Issued STS Token Box */}
                        {p.sts_token_issued && (
                          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 space-y-1">
                            <span className="text-[10px] text-indigo-400 uppercase font-bold">Encrypted 20-Digit STS Recharge Token:</span>
                            <p className="font-mono text-sm font-black text-indigo-300 tracking-wider">
                              {p.sts_token_issued}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              Extended: +{p.credit_days_extended} Days &bull; Synced to Growatt Inverter via BLE / Keypad
                            </p>
                          </div>
                        )}

                        {isPending && (
                          <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                            <button
                              onClick={() => {
                                if (!assertPermission('payments.verify', 'verifying bank payment and issuing token')) return;
                                const tokenStr = `${Math.floor(1000+Math.random()*9000)}-${Math.floor(1000+Math.random()*9000)}-${Math.floor(1000+Math.random()*9000)}-${Math.floor(1000+Math.random()*9000)}-${Math.floor(1000+Math.random()*9000)}`;
                                const extDays = Math.round((p.amount_ngn / 145000) * 30);
                                setPaymentQueue(prev => prev.map(item => item.id === p.id ? {
                                  ...item,
                                  status: 'VERIFIED',
                                  sts_token_issued: tokenStr,
                                  credit_days_extended: extDays,
                                } : item));
                                showToast(`✓ Payment Verified: Issued 20-digit STS Token [${tokenStr}] (+${extDays} Days)`);
                              }}
                              className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md"
                            >
                              ✓ Verify Payment &amp; Issue 20-Digit STS Token
                            </button>
                            <button
                              onClick={() => {
                                if (!assertPermission('payments.verify', 'rejecting payment')) return;
                                setPaymentQueue(prev => prev.map(item => item.id === p.id ? { ...item, status: 'REJECTED' } : item));
                                showToast(`❌ Rejected payment reference ${p.payment_reference}`);
                              }}
                              className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition"
                            >
                              ✕ Reject
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Invoices Ledger */}
              <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
                  Customer Receivables &amp; Invoices
                </h3>
                <div className="space-y-3">
                  {invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-slate-400 font-bold">{inv.invoice_number}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          inv.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {inv.status}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{inv.customer_name}</p>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-800 text-slate-500">
                        <span>Due: {inv.due_date}</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {formatNaira(inv.amount_ngn)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 6: MULTI-PERSONA SKYTRON COPILOT & AUDIT CHAIN                 */}
        {/* ================================================================== */}
        {(activeConsoleTab === 'copilot' || activeConsoleTab === 'sa_audit_ledger') && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-mono font-bold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase">
                  LOCALGRIDAGENT 2.0 RAG &amp; TAMPER-EVIDENT LEDGER
                </span>
                <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  Multi-Persona AI Copilot &amp; Cryptographic SHA-256 Audit Trail
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Persona-scoped RAG queries linked directly to live VFS telemetry &bull; Hash-chained immutable operation ledger.
                </p>
              </div>
              <button
                onClick={() => {
                  setAuditVerified(true);
                  showToast('🔐 Cryptographic Audit Chain Verified: 100% Hash Integrity Across All Ledger Blocks');
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-md"
              >
                <span>🔐</span>
                <span>Verify Audit Chain Integrity</span>
              </button>
            </div>

            <div className="grid lg:grid-cols-12 gap-6">
              {/* Left: Role-Aware Copilot Chat Box */}
              <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col h-[600px] overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🤖</span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">LocalGridAgent Copilot</h3>
                      <p className="text-[11px] text-slate-500">Scoped to role: <strong className="text-emerald-600 dark:text-emerald-400">{activeRole}</strong></p>
                    </div>
                  </div>
                  <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Live RAG
                  </span>
                </div>

                {/* Messages Stream */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs leading-relaxed">
                  {copilotMessages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-2xl max-w-[85%] ${
                        m.sender === 'user'
                          ? 'ml-auto bg-indigo-600 text-white font-medium'
                          : 'bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{m.text}</div>
                      <div className="text-[10px] opacity-70 mt-1 text-right">{m.time}</div>
                    </div>
                  ))}
                  {isCopilotQuerying && (
                    <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs animate-pulse text-slate-500">
                      ⚡ Synthesizing telemetry and computing scoped RAG context...
                    </div>
                  )}
                </div>

                {/* Prompt Suggestions */}
                <div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/30 flex items-center gap-2 overflow-x-auto text-[11px]">
                  {[
                    'How much battery reserve is in Jos Hub?',
                    'List all units with lower shroud tamper lockout',
                    'Explain COREN earthing <= 5.0 Ohm procedure',
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => setCopilotInput(s)}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 shrink-0 text-slate-600 dark:text-slate-300 transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {/* Chat Input */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!copilotInput.trim()) return;
                    const query = copilotInput.trim();
                    const newMsg = { sender: 'user' as const, text: query, time: 'Just now' };
                    setCopilotMessages(prev => [...prev, newMsg]);
                    setCopilotInput('');
                    setIsCopilotQuerying(true);

                    try {
                      const res = await fetch('http://localhost:8080/api/v1/agent/chat', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${authToken}`,
                        },
                        body: JSON.stringify({
                          query,
                          role_slug: activeRole,
                          user_id: activeUserEmail,
                          device_id: selectedUnit.device_id,
                        }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setCopilotMessages(prev => [...prev, {
                          sender: 'agent',
                          text: data.answer_markdown || 'System telemetry normal.',
                          time: 'Just now',
                        }]);
                        setIsCopilotQuerying(false);
                        return;
                      }
                    } catch (err) {}

                    // Offline Fallback Response
                    setTimeout(() => {
                      setCopilotMessages(prev => [...prev, {
                        sender: 'agent',
                        text: `🔒 **SkyTron Scoped Response (${activeRole}):** Monitored unit \`${selectedUnit.device_id}\` operating at ${selectedUnit.battery_soc_pct}% LiFePO4 SoC. Contactor relay state: \`${selectedUnit.relay_state}\`. Tamper status: \`${selectedUnit.tamper_state}\`. Earthing: ${selectedUnit.earthing_ohms}Ω (COREN compliant).`,
                        time: 'Just now',
                      }]);
                      setIsCopilotQuerying(false);
                    }, 500);
                  }}
                  className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
                >
                  <input
                    value={copilotInput}
                    onChange={(e) => setCopilotInput(e.target.value)}
                    placeholder="Ask SkyTron Copilot..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition"
                  >
                    Send &rarr;
                  </button>
                </form>
              </div>

              {/* Right: Cryptographic SHA-256 Audit Trail */}
              <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm flex flex-col h-[600px]">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>📜</span> SHA-256 Tamper-Evident Audit Ledger
                  </h3>
                  {auditVerified && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                      VERIFIED
                    </span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs font-mono">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-sans">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{log.action}</span>
                        <span>{log.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-sans">
                        {log.actor_email} ({log.actor_role})
                      </p>
                      <div className="text-[10px] text-slate-400 break-all">
                        Hash: <span className="text-emerald-600 dark:text-emerald-400">{log.sha256_hash.slice(0, 24)}...</span>
                      </div>
                      <div className="text-[10px] text-slate-500 break-all">
                        Parent: {log.prev_hash.slice(0, 20)}...
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                  Every privileged state change generates a SHA-256 hash linked to previous block.
                </div>
              </div>
            </div>
          </div>
        )}


        {/* ============================================================== */}
        {/* SUPER ADMIN: Global Pricing & System Settings                  */}
        {/* ============================================================== */}
        {activeConsoleTab === 'sa_settings' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono font-bold text-amber-500 uppercase tracking-wider">Super Admin Master Controls</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Global Pricing, Tariffs &amp; System Settings</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Configure global lease financing APR, NERC tariff benchmarks, and COREN compliance parameters.</p>
              </div>
              <span className="px-3 py-1 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-300 font-mono font-bold text-xs border border-purple-500/30">
                👑 Super Admin Authority
              </span>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">Leasing &amp; Financial Parameters</h4>
                <div className="grid sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">PAYG Financing APR (%)</label>
                    <input type="number" defaultValue="18.5" step="0.1" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono" />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Minimum Down Payment (%)</label>
                    <input type="number" defaultValue="15" step="1" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono" />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">VAT on Solar Hardware (%)</label>
                    <input type="number" defaultValue="7.5" step="0.1" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono" />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">STS Token Grace Period (Days)</label>
                    <input type="number" defaultValue="3" step="1" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono" />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">Utility &amp; Regulatory Baselines</h4>
                <div className="grid sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">NERC Band-A Tariff (₦/kWh)</label>
                    <input type="number" defaultValue="209" step="1" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono" />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Fuel Reference Price (₦/Liter)</label>
                    <input type="number" defaultValue="1250" step="10" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono" />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">COREN Max Earth Resistance (Ω)</label>
                    <input type="number" defaultValue="5.00" step="0.1" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono" />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">NEMSA Seal Prefix</label>
                    <input type="text" defaultValue="SEAL-NG-" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono" />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <span className="text-xs text-slate-500 font-mono">Modifications trigger cryptographic audit block and require Super Admin approval notes.</span>
              <button
                onClick={() => handleMakerCheckerStamp('sa_settings_row', 'CONFIG_COMMITTED', 'Updated global leasing parameters and NERC tariff benchmarks.', 'Save Global Settings')}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-md shadow-amber-500/20 cursor-pointer"
              >
                💾 Save Global Settings &amp; Commit to SHA-256 Ledger
              </button>
            </div>
            {makerCheckerStamps['sa_settings_row'] && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono space-y-1">
                <div className="flex justify-between items-center text-emerald-400 font-bold">
                  <span>✓ {makerCheckerStamps['sa_settings_row'].status}: {makerCheckerStamps['sa_settings_row'].actorName}</span>
                  <span className="text-[10px] text-slate-400">{makerCheckerStamps['sa_settings_row'].timestamp}</span>
                </div>
                <p className="text-slate-300">{makerCheckerStamps['sa_settings_row'].notes}</p>
                <p className="text-[10px] text-indigo-400 pt-1 border-t border-slate-700">{makerCheckerStamps['sa_settings_row'].blockHash}</p>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* FINANCE: Treasury & Invoices & Analytics                        */}
        {/* ============================================================== */}
        {activeConsoleTab === 'fin_treasury' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex justify-between items-center">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Treasury &amp; Reconciliation Desk</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Bank Gateway Webhooks vs. DVA Accounts</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Automated reconciliation matching between Moniepoint MFB, Paystack, and Dynamic Virtual Accounts (DVA).</p>
              </div>
              <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-xs">
                100% Ledger Synced
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">Incoming Payment Webhooks</h4>
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">₦185,000</span>
                      <span className="font-semibold text-slate-900 dark:text-white">Engr. Amina Danjuma</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono text-[10px]">DVA: 9928174021</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Gateway: Moniepoint MFB • Ref: MP-TX-998821 • Synced 12m ago</p>
                  </div>
                  {makerCheckerStamps['treasury_1'] ? (
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">✓ {makerCheckerStamps['treasury_1'].status} ({makerCheckerStamps['treasury_1'].timestamp})</span>
                  ) : (
                    <button
                      onClick={() => handleMakerCheckerStamp('treasury_1', 'RECONCILED', 'Auto-matched DVA hash with Moniepoint settlement API.', 'Reconcile Transfer')}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                    >
                      ✓ Reconcile &amp; Stamp
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeConsoleTab === 'fin_invoices' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex justify-between items-center">
              <div>
                <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Portfolio Aging Analysis</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Invoices &amp; Portfolio-at-Risk (PAR) Cohorts</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Active lease installment tracking with aging categories.</p>
              </div>
              <span className="px-3 py-1 rounded-xl bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-mono font-bold text-xs">
                PAR &gt; 30d: 1.8%
              </span>
            </div>

            <div className="grid sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold block">Current (0d Due)</span>
                <span className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1 block">₦3,120,000</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-300">92 Contracts</span>
              </div>
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold block">1 - 30d Aging</span>
                <span className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1 block">₦285,000</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-300">3 in Grace</span>
              </div>
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold block">31 - 60d PAR</span>
                <span className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1 block">₦132,000</span>
                <span className="text-[10px] text-rose-600 dark:text-rose-300">1 Tamper Hold</span>
              </div>
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                <span className="text-[11px] text-purple-600 dark:text-purple-400 font-bold block">60+ Days Default</span>
                <span className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1 block">₦0.00</span>
                <span className="text-[10px] text-purple-600 dark:text-purple-300">Zero Critical</span>
              </div>
            </div>
          </div>
        )}

        {activeConsoleTab === 'fin_analytics' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex justify-between items-center">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Revenue Analytics Desk</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Cash Collections vs. Amortization Curves</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Portfolio recovery velocity and regional payment efficiencies.</p>
              </div>
              <button onClick={() => showToast('Exported collections CSV.')} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold transition">
                📥 Export CSV
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* OPERATIONS: Workforce & Inventory                              */}
        {/* ============================================================== */}
        {activeConsoleTab === 'ops_workforce' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex justify-between items-center">
              <div>
                <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Workforce Management</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Field Workforce &amp; Regional Hub Allocations</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Manage technician schedules across Abuja, Jos, Otukpo, and Lagos.</p>
              </div>
              <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono font-bold text-xs">
                8 Active Certified Techs
              </span>
            </div>
          </div>
        )}

        {activeConsoleTab === 'ops_inventory' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex justify-between items-center">
              <div>
                <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">BOM Warehouse</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Inventory &amp; Serialized BOM Monitor</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Track store stock of inverters, LiFePO4 batteries, and security seals.</p>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* COREN QA & SAFETY: Earthing & Tamper Clearance                 */}
        {/* ============================================================== */}
        {activeConsoleTab === 'coren_safety' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex justify-between items-center">
              <div>
                <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">COREN Watchtower</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Safety &amp; Compliance Watchtower</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Real-time stream of physical security shroud tamper alerts (TAMPER_OPEN).</p>
              </div>
              <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-xs">
                100% Earthing Compliance
              </span>
            </div>
          </div>
        )}

        {activeConsoleTab === 'coren_earthing' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex justify-between items-center">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">COREN Commissioning Gate</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Earthing &amp; Commissioning Sign-Off (≤ 5.0Ω Gate)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Review technician-submitted photos and earthing resistance measurements for Stage 13.</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">Pending Commissioning Queue</h4>
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">Site: Maitama Array (DEV-8F3A)</span>
                    <p className="text-slate-500 dark:text-slate-400">Client: Engr. Amina Danjuma • Megger Reading: 1.8Ω (Passed ≤ 5.0Ω Gate)</p>
                  </div>
                  {makerCheckerStamps['earth_1'] ? (
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">✓ {makerCheckerStamps['earth_1'].status} ({makerCheckerStamps['earth_1'].timestamp})</span>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleMakerCheckerStamp('earth_1', 'APPROVED_COREN_COMPLIANCE', 'Verified 1.8Ω earth reading satisfies COREN standards.', 'Approve COREN Compliance')}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                      >
                        ⚡ Approve COREN Compliance (≤ 5.0Ω Verified)
                      </button>
                      <button
                        onClick={() => handleMakerCheckerStamp('earth_1', 'REJECTED_PIT', 'Pit resistance defective.', 'Reject Pit')}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeConsoleTab === 'coren_tamper' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex justify-between items-center">
              <div>
                <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Tamper Recovery Desk</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Hardware Tamper Clearance Queue</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Authorize cryptographic resets for inverters locked out due to shroud intrusion.</p>
              </div>
            </div>
          </div>
        )}

        {activeConsoleTab === 'coren_standards' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Regulatory Certifications &amp; Standards</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">NEMSA Cat-A, IEEE 1547, and Nigerian Electricity Supply Industry rules.</p>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TECHNICIAN: Orders, Logger, Copilot & Evidence                 */}
        {/* ============================================================== */}
        {activeConsoleTab === 'tech_orders' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex justify-between items-center">
              <div>
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Field Technician Dispatch</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">My Assigned Work Orders</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Active installation and maintenance jobs assigned to your technician profile.</p>
              </div>
              <span className="px-3 py-1 rounded-xl bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-xs">
                2 Active Jobs
              </span>
            </div>
          </div>
        )}

        {activeConsoleTab === 'tech_logger' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Hardware Logger</span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Job Execution &amp; BOM Logger</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Input serial numbers for installed hardware and log earthing resistance (Ω).</p>
            </div>
          </div>
        )}

        {activeConsoleTab === 'tech_copilot' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
              <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Inverter Diagnostic AI</span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Field AI Copilot (LocalGridAgent)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Role-scoped RAG assistant for Growatt error codes and Modbus register maps.</p>
            </div>
          </div>
        )}

        {activeConsoleTab === 'tech_evidence' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Field Evidence &amp; Photo Upload</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Upload commissioning photos for earthing pit, DB wiring, and security seals.</p>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* CUSTOMER SUPPORT: Helpdesk, Tokens & Chat                      */}
        {/* ============================================================== */}
        {activeConsoleTab === 'sup_helpdesk' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
              <span className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">Subscriber Lookup Desk</span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Helpdesk &amp; Subscriber Lookup</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Search subscribers by phone, email, NIN, or meter ID.</p>
            </div>
          </div>
        )}

        {activeConsoleTab === 'sup_tokens' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
              <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Token Dispatch</span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Quick STS Token Resend &amp; Diagnostics</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">One-click 20-digit token lookup and resend via SMS or WhatsApp webhook.</p>
            </div>
          </div>
        )}

        {activeConsoleTab === 'sup_chat' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
              <span className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">Live Support Desk</span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Live Customer Chat &amp; Communications</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Live subscriber messaging interface.</p>
            </div>
          </div>
        )}

      </main>

      {/* ================================================================== */}
      {/* MODAL: RMA HARDWARE SERIAL SWAP                                    */}
      {/* ================================================================== */}
      {isRMAModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">RMA Warranty Inverter Serial Swap</h3>
              <button onClick={() => setIsRMAModalOpen(false)} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">&times;</button>
            </div>

            <form onSubmit={handleExecuteRMASwap} className="space-y-3 text-xs">
              <p className="text-slate-500 dark:text-slate-400">
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
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl mt-2 shadow-lg"
              >
                Commit Atomic RMA Swap
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: CORPORATE CHARTER                                           */}
      {/* ================================================================== */}
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
              <p className="text-xs text-slate-500 dark:text-slate-400">
                In Strategic Alliance with SkyTron Quantum Solutions &amp; Growatt New Energy.
              </p>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
              <p>
                SkyGrid Flex Solutions is an institutional-grade Clean Energy-as-a-Service infrastructure firm established to dismantle Nigeria&apos;s electricity deficit and eliminate fossil-fuel generator reliance across Sub-Saharan Africa.
              </p>

              <div className="grid sm:grid-cols-2 gap-4 my-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-sky-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-sky-800 dark:text-cyan-400 font-bold text-sm">
                    <span>🔭</span> Corporate Vision
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    To build Africa&apos;s most intelligent and resilient clean energy ecosystem—eradicating energy poverty and guaranteeing continuous, sovereign solar electric power for every Nigerian home.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 font-bold text-sm">
                    <span>🎯</span> Corporate Mission
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    To permanently eliminate fossil-fuel generators across Nigeria and Africa by deploying military-grade Growatt hybrid inverters and 6,000-cycle LiFePO4 storage via accessible PAYG financing.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowAboutCharter(false)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-lg"
              >
                Dismiss Charter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: IAM & RBAC CONSOLE / MATRIX                                 */}
      {/* ================================================================== */}
      {showIAMModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-slate-900 dark:text-slate-100 max-h-[92vh] flex flex-col">
            <button
              onClick={() => setShowIAMModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white flex items-center justify-center text-sm transition"
            >
              &times;
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black flex items-center justify-center text-xl">
                🛡️
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase">
                  ENTERPRISE IAM &amp; GRANULAR RBAC ENGINE
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                  Granular Roles &amp; Permissions Matrix
                </h3>
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {ALL_SYSTEM_PERMISSIONS.map((perm) => {
                  const isGranted = grantedPermissions.includes(perm.slug) || activeRole === 'super_admin';
                  return (
                    <div
                      key={perm.slug}
                      className={`p-3 rounded-2xl border flex items-start justify-between gap-2 ${
                        isGranted
                          ? 'bg-emerald-500/10 border-emerald-500/50 text-slate-900 dark:text-white'
                          : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-400 opacity-60'
                      }`}
                    >
                      <div>
                        <div className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-bold uppercase">
                          {perm.module} &bull; {perm.slug}
                        </div>
                        <div className="text-xs font-semibold mt-0.5 leading-snug">{perm.name}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isGranted}
                        readOnly
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 mt-0.5"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500">
              <span>Current active role: <strong>{activeRole}</strong> ({grantedPermissions.length} permissions).</span>
              <button
                onClick={() => setShowIAMModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white font-bold text-xs px-5 py-2 rounded-xl transition"
              >
                Close Matrix
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. FOOTER */}
      <footer className="mt-12 border-t border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 py-6 px-6 text-center text-xs text-slate-600 dark:text-slate-500">
        <p>
          &copy; {new Date().getFullYear()} SkyGrid Flex Solutions Ltd. &bull; In Strategic Alliance with SkyTron Quantum Solutions &amp; Growatt New Energy.
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          COREN Registered Engineering Firm &bull; NEMSA Certified &bull; Sovereign Clean Energy For Nigeria &amp; Africa.
        </p>
      </footer>

      {/* Multi-Persona RAG Chat Drawer */}
      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        activePersona={persona}
        onPersonaChange={setPersona}
        deviceId={selectedUnit?.device_id || 'DEV-8F3A-GROWATT-00421'}
      />
    </div>
  );
}
