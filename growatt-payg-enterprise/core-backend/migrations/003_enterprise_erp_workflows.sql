-- ============================================================================
-- 003_enterprise_erp_workflows.sql
-- 16-Step Installation Pipeline, 13-Step Maintenance Lifecycle,
-- Invoicing Ledger & Multi-Rail Payment Verification Engine
-- Target: PostgreSQL 16+
-- ============================================================================

BEGIN;

-- 1. INSTALLATION WORK ORDERS TABLE (16-Step Pipeline)
CREATE TABLE IF NOT EXISTS installation_work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_number VARCHAR(60) UNIQUE NOT NULL,
    customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_name VARCHAR(160) NOT NULL,
    customer_phone VARCHAR(50),
    customer_email VARCHAR(255),
    site_address TEXT NOT NULL,
    gps_lat DOUBLE PRECISION NOT NULL,
    gps_lng DOUBLE PRECISION NOT NULL,
    state_region VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT '1_REQUEST_SUBMITTED'
        CHECK (status IN (
            '1_REQUEST_SUBMITTED',
            '2_OPS_REVIEWED',
            '3_SITE_ASSESSMENT_SCHEDULED',
            '4_SITE_ASSESSED',
            '5_QUOTATION_PREPARED',
            '6_QUOTATION_APPROVED',
            '7_WORK_ORDER_CREATED',
            '8_TECHNICIAN_ASSIGNED',
            '9_INSTALLATION_SCHEDULED',
            '10_IN_PROGRESS',
            '11_BOM_DOCUMENTED',
            '12_PHOTOS_UPLOADED',
            '13_COREN_INSPECTED',
            '14_COMMISSIONED',
            '15_HANDOVER_SIGNED',
            '16_COMPLETED'
        )),
    inverter_sku VARCHAR(80) NOT NULL,
    pv_kwp_planned DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    battery_kwh_planned DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    total_amount_kobo BIGINT NOT NULL DEFAULT 0,
    assigned_engineer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_engineer_name VARCHAR(160),
    scheduled_date TIMESTAMPTZ,
    bom_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    photos JSONB NOT NULL DEFAULT '[]'::jsonb,
    earthing_resistance_ohms DOUBLE PRECISION,
    coren_inspector_id UUID REFERENCES users(id) ON DELETE SET NULL,
    coren_certificate_no VARCHAR(100),
    handover_signature TEXT,
    handover_signed_at TIMESTAMPTZ,
    device_id VARCHAR(100),
    growatt_serial VARCHAR(100),
    battery_serial VARCHAR(100),
    approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by_staff_name TEXT,
    approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approval_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inst_wo_number ON installation_work_orders(work_order_number);
CREATE INDEX IF NOT EXISTS idx_inst_status ON installation_work_orders(status);
CREATE INDEX IF NOT EXISTS idx_inst_customer ON installation_work_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_inst_assigned_eng ON installation_work_orders(assigned_engineer_id);
CREATE INDEX IF NOT EXISTS idx_inst_device_id ON installation_work_orders(device_id);

-- 2. MAINTENANCE & AFTER-SALES SERVICE TICKETS (13-Step Lifecycle)
CREATE TABLE IF NOT EXISTS maintenance_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(60) UNIQUE NOT NULL,
    customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_name VARCHAR(160) NOT NULL,
    device_id VARCHAR(100) NOT NULL,
    inverter_serial VARCHAR(100),
    fault_code INT NOT NULL DEFAULT 0,
    fault_description TEXT NOT NULL,
    severity VARCHAR(30) NOT NULL DEFAULT 'MEDIUM'
        CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status VARCHAR(50) NOT NULL DEFAULT '1_FAULT_REPORTED'
        CHECK (status IN (
            '1_FAULT_REPORTED',
            '2_TRIAGED',
            '3_WORK_ORDER_CREATED',
            '4_TECH_ASSIGNED',
            '5_SITE_INSPECTED',
            '6_DIAGNOSIS_LOGGED',
            '7_REPAIR_IN_PROGRESS',
            '8_PARTS_RECORDED',
            '9_COSTS_CAPTURED',
            '10_SUPERVISOR_VERIFIED',
            '11_COMPLETION_REPORTED',
            '12_CUSTOMER_NOTIFIED',
            '13_CLOSED'
        )),
    assigned_technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_technician_name VARCHAR(160),
    diagnosis_notes TEXT,
    spare_parts_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    labour_cost_kobo BIGINT NOT NULL DEFAULT 0,
    parts_cost_kobo BIGINT NOT NULL DEFAULT 0,
    total_cost_kobo BIGINT NOT NULL DEFAULT 0,
    supervisor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    supervisor_notes TEXT,
    supervisor_verified_at TIMESTAMPTZ,
    approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by_staff_name TEXT,
    approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approval_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    customer_notified_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maint_ticket_num ON maintenance_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_maint_status ON maintenance_tickets(status);
CREATE INDEX IF NOT EXISTS idx_maint_device ON maintenance_tickets(device_id);
CREATE INDEX IF NOT EXISTS idx_maint_customer ON maintenance_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_maint_tech ON maintenance_tickets(assigned_technician_id);

-- 3. INVOICES TABLE
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(60) UNIQUE NOT NULL,
    customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_name VARCHAR(160) NOT NULL,
    customer_email VARCHAR(255),
    related_type VARCHAR(40) NOT NULL CHECK (related_type IN ('INSTALLATION', 'MAINTENANCE', 'CONTRACT', 'RECHARGE')),
    related_id VARCHAR(100) NOT NULL,
    amount_kobo BIGINT NOT NULL,
    paid_amount_kobo BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'ISSUED'
        CHECK (status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED')),
    due_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_related ON invoices(related_type, related_id);

-- 4. FINANCE PAYMENTS & VERIFICATION QUEUE
CREATE TABLE IF NOT EXISTS finance_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_reference VARCHAR(80) UNIQUE NOT NULL,
    customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    amount_kobo BIGINT NOT NULL,
    payment_method VARCHAR(40) NOT NULL
        CHECK (payment_method IN ('MONIEPOINT_DVA', 'PAYSTACK_DVA', 'OPAY_DVA', 'MANUAL_BANK_TRANSFER')),
    bank_teller_ref VARCHAR(100),
    bank_name VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_VERIFICATION'
        CHECK (status IN ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED')),
    verified_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by_staff_name TEXT,
    approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approval_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    sts_token_issued VARCHAR(60),
    credit_days_extended DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_ref ON finance_payments(payment_reference);
CREATE INDEX IF NOT EXISTS idx_payments_status ON finance_payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON finance_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON finance_payments(invoice_id);

COMMIT;
