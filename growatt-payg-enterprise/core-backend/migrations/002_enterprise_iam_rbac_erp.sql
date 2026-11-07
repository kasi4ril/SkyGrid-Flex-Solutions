-- ============================================================================
-- 002_enterprise_iam_rbac_erp.sql
-- Enterprise IAM, Granular Role-Based Access Control (RBAC),
-- Hybrid Staff Onboarding Pipeline & Audit Ledger Engine
-- Target: PostgreSQL 16+
-- ============================================================================

BEGIN;

-- 1. USERS TABLE
-- Central identity table for both internal staff and external PAYG customers.
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) UNIQUE,
    password_hash TEXT NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('STAFF', 'CUSTOMER')),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_VERIFICATION' 
        CHECK (status IN ('PENDING_VERIFICATION', 'PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED')),
    email_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_type_status ON users(user_type, status);

-- 2. ROLES TABLE
-- Pre-seeded with 7 system enterprise roles.
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roles_slug ON roles(slug);

-- 3. PERMISSIONS TABLE
-- Granular capability definitions across business and technical domains.
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    module VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permissions_slug ON permissions(slug);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);

-- 4. ROLE_PERMISSIONS JOIN TABLE
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 5. USER_ROLES JOIN TABLE
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- 6. STAFF PROFILES TABLE
-- Professional engineering, department, and COREN credentials for internal personnel.
CREATE TABLE IF NOT EXISTS staff_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    department VARCHAR(100) NOT NULL,
    coren_reg_number VARCHAR(80),
    assigned_region VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_emp_code ON staff_profiles(employee_code);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_department ON staff_profiles(department);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_region ON staff_profiles(assigned_region);

-- 7. STAFF ONBOARDING REQUESTS TABLE
-- State machine for the Hybrid Staff Onboarding Pipeline:
-- Apply -> Verify Email -> SuperAdmin Review & Role Assignment -> Activation
CREATE TABLE IF NOT EXISTS staff_onboarding_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    applicant_email VARCHAR(255) UNIQUE NOT NULL,
    applicant_phone VARCHAR(50),
    full_name VARCHAR(160) NOT NULL,
    requested_department VARCHAR(100) NOT NULL,
    coren_reg_number VARCHAR(80),
    assigned_region VARCHAR(100),
    verification_token_hash VARCHAR(64),
    status VARCHAR(40) NOT NULL DEFAULT 'AWAITING_EMAIL_VERIFY'
        CHECK (status IN ('AWAITING_EMAIL_VERIFY', 'PENDING_SUPERADMIN_REVIEW', 'APPROVED_INVITED', 'REJECTED', 'ACTIVATED')),
    assigned_role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    review_notes TEXT,
    activation_token_hash VARCHAR(64),
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_onboarding_email ON staff_onboarding_requests(applicant_email);
CREATE INDEX IF NOT EXISTS idx_staff_onboarding_status ON staff_onboarding_requests(status);
CREATE INDEX IF NOT EXISTS idx_staff_onboarding_verify_token ON staff_onboarding_requests(verification_token_hash);
CREATE INDEX IF NOT EXISTS idx_staff_onboarding_act_token ON staff_onboarding_requests(activation_token_hash);

-- 8. SESSIONS TABLE
-- Authenticated sessions with SHA-256 hashed refresh tokens for secure rotation.
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(64) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_hash ON sessions(refresh_token_hash);

-- 9. AUDIT LOGS TABLE
-- Cryptographic integrity & compliance trail for all privileged administrative and security operations.
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100),
    payload JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- 10. SEED PERMISSIONS (ALL 17 GRANULAR PERMISSIONS)
-- ============================================================================
INSERT INTO permissions (slug, name, module) VALUES
    ('staff.view', 'View Staff Directory & Applications', 'staff'),
    ('staff.invite', 'Directly Invite New Staff Members', 'staff'),
    ('staff.approve', 'Review & Approve Staff Onboarding Requests', 'staff'),
    ('staff.manage_roles', 'Assign & Revoke Staff Enterprise Roles', 'staff'),
    ('customers.view', 'View Customer Accounts & Credit Telemetry', 'customers'),
    ('customers.manage', 'Modify Customer Metadata & Contract Terms', 'customers'),
    ('installations.create', 'Schedule & Dispatch Solar Installations', 'installations'),
    ('installations.assign', 'Assign Field Engineers to Site Installations', 'installations'),
    ('installations.update', 'Execute Digital Commissioning & Earthing Check', 'installations'),
    ('maintenance.create', 'Log Fault Tickets & RMA Hardware Swaps', 'maintenance'),
    ('maintenance.assign', 'Assign Technicians to Maintenance Tickets', 'maintenance'),
    ('maintenance.update_status', 'Resolve Maintenance Tasks & Update Shroud State', 'maintenance'),
    ('payments.view', 'Inspect Inbound Webhooks & Financial Ledgers', 'payments'),
    ('payments.verify', 'Verify Bank Transfers & Generate STS Tokens', 'payments'),
    ('reports.view', 'Access Financial & Technical Performance Reports', 'reports'),
    ('audit.view', 'Inspect Administrative & Security Audit Trail', 'audit'),
    ('settings.manage', 'Configure System Secrets, Tariffs & SLA Limits', 'settings')
ON CONFLICT (slug) DO UPDATE SET 
    name = EXCLUDED.name,
    module = EXCLUDED.module;

-- ============================================================================
-- 11. SEED 7 ENTERPRISE ROLES
-- ============================================================================
INSERT INTO roles (slug, name, description, is_system_role) VALUES
    ('super_admin', 'Super Administrator', 'Full platform control, executive overrides, role administration and auditing.', TRUE),
    ('operations_manager', 'Operations Manager', 'Fleet orchestration, installation dispatch, ticket assignment and reporting.', TRUE),
    ('field_engineer', 'Field Engineer', 'Site audits, physical installations, <5.0 Ohm earthing sign-off and RMA swaps.', TRUE),
    ('finance_officer', 'Finance & Risk Officer', 'Payment verification, ledger oversight, debt reconciliation and KYC underwriting.', TRUE),
    ('customer_support', 'Customer Support Representative', 'Customer inquiries, dispute handling, basic ticketing and token lookups.', TRUE),
    ('compliance_auditor', 'Compliance & Quality Auditor', 'COREN/NEMSA technical audits, safety log inspection and regulatory reporting.', TRUE),
    ('customer', 'PAYG Solar Customer', 'Access to personal solar telemetry, virtual accounts, receipts and token keypad.', TRUE)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system_role = EXCLUDED.is_system_role;

-- ============================================================================
-- 12. SEED ROLE_PERMISSIONS MAPPING
-- ============================================================================

-- SUPER ADMIN: ALL 17 Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.slug = 'super_admin'
ON CONFLICT DO NOTHING;

-- OPERATIONS MANAGER: Fleet, Staff View, Installations, Maintenance, Customers, Reports
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.slug = 'operations_manager'
AND p.slug IN (
    'staff.view', 'customers.view', 'customers.manage',
    'installations.create', 'installations.assign', 'installations.update',
    'maintenance.create', 'maintenance.assign', 'maintenance.update_status',
    'payments.view', 'reports.view', 'audit.view'
)
ON CONFLICT DO NOTHING;

-- FIELD ENGINEER: Installations & Maintenance execution, Customer view
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.slug = 'field_engineer'
AND p.slug IN (
    'installations.update', 'maintenance.create', 'maintenance.update_status', 'customers.view'
)
ON CONFLICT DO NOTHING;

-- FINANCE OFFICER: Payments, Ledgers, Reports, Customer View, Audit View
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.slug = 'finance_officer'
AND p.slug IN (
    'payments.view', 'payments.verify', 'reports.view', 'customers.view', 'audit.view'
)
ON CONFLICT DO NOTHING;

-- CUSTOMER SUPPORT: Customers, Tickets, Token lookups, Basic View
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.slug = 'customer_support'
AND p.slug IN (
    'customers.view', 'customers.manage', 'maintenance.create', 'payments.view'
)
ON CONFLICT DO NOTHING;

-- COMPLIANCE AUDITOR: Audit, Reports, Installations View/Update, Staff View
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.slug = 'compliance_auditor'
AND p.slug IN (
    'audit.view', 'reports.view', 'installations.update', 'staff.view', 'customers.view'
)
ON CONFLICT DO NOTHING;

COMMIT;
