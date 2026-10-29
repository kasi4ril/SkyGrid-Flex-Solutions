-- ============================================================================
-- 001_init_schema.sql
-- Enterprise Growatt PAYG Solar, Fintech & AI Energy Management Platform
-- Target: PostgreSQL 16 + TimescaleDB + pgvector
-- ============================================================================

BEGIN;

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "timescaledb";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. Custom Domain Enumerations
CREATE TYPE payment_mode_enum AS ENUM ('OUTRIGHT', 'INSTALLMENT');
CREATE TYPE battery_chemistry_enum AS ENUM ('LIFEPO4', 'LEAD_ACID_TUBULAR');
CREATE TYPE quote_status_enum AS ENUM ('DRAFT', 'AUDIT_BOOKED', 'AUDITED', 'CONVERTED', 'EXPIRED');
CREATE TYPE kyc_status_enum AS ENUM ('PENDING', 'VERIFIED', 'MANUAL_REVIEW', 'REJECTED');
CREATE TYPE contract_status_enum AS ENUM (
    'PENDING_INSTALL',
    'ACTIVE',
    'GRACE_PERIOD',
    'HOLIDAY_FREEZE',
    'LOCKED_DEFAULT',
    'LOCKED_TAMPER',
    'REPOSSESSION_ORDER',
    'FULLY_OWNED'
);
CREATE TYPE repayment_freq_enum AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
CREATE TYPE payment_provider_enum AS ENUM ('MONIEPOINT', 'PAYSTACK', 'OPAY', 'NIBSS_DIRECT_DEBIT', 'POS_FIELD_AGENT');
CREATE TYPE ledger_entry_type_enum AS ENUM ('CREDIT', 'DEBIT');
CREATE TYPE relay_state_enum AS ENUM ('ACTIVE_ON', 'STANDBY_LOCKED', 'FAULT_OFF');
CREATE TYPE tamper_state_enum AS ENUM ('SEALED', 'TRIPPED');
CREATE TYPE doc_category_enum AS ENUM ('GROWATT_MANUAL', 'FAULT_CODE', 'FINANCING_POLICY', 'APPLIANCE_TIPS');

-- ============================================================================
-- 3. CUSTOMERS & NIGERIAN KYC UNDERWRITING
-- ============================================================================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(160) NOT NULL,
    phone VARCHAR(24) UNIQUE NOT NULL,
    email VARCHAR(160) UNIQUE,
    state_region VARCHAR(64) NOT NULL,
    city VARCHAR(80) NOT NULL,
    street_address TEXT NOT NULL,
    gps_lat DOUBLE PRECISION,
    gps_lng DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE kyc_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    nin_hash VARCHAR(128) NOT NULL,
    bvn_hash VARCHAR(128) NOT NULL,
    verification_provider VARCHAR(64) NOT NULL, -- SMILE_ID, PREMBLY, DOJAH
    liveness_confidence_pct NUMERIC(5,2),
    credit_bureau_score INT,
    monthly_inflow_kobo BIGINT,
    debt_to_income_ratio NUMERIC(5,2),
    direct_debit_mandate_code VARCHAR(128),
    kyc_status kyc_status_enum NOT NULL DEFAULT 'PENDING',
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. AUTO-SIZING QUOTES & NIGERIAN ROI CALCULATOR
-- ============================================================================
CREATE TABLE sizing_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    full_name VARCHAR(160) NOT NULL,
    phone VARCHAR(24) NOT NULL,
    email VARCHAR(160),
    state_region VARCHAR(64) NOT NULL,
    city VARCHAR(80) NOT NULL,
    local_psh_factor NUMERIC(4,2) NOT NULL DEFAULT 4.50, -- Geo-zone adjusted (3.5h South to 6.0h North)
    gps_lat DOUBLE PRECISION,
    gps_lng DOUBLE PRECISION,
    appliances_jsonb JSONB NOT NULL,
    running_watts INT NOT NULL CHECK (running_watts > 0),
    surge_va INT NOT NULL CHECK (surge_va >= running_watts),
    recommended_growatt_sku VARCHAR(64) NOT NULL,
    battery_chemistry battery_chemistry_enum NOT NULL DEFAULT 'LIFEPO4',
    recommended_battery_kwh NUMERIC(6,2) NOT NULL,
    recommended_pv_kwp NUMERIC(6,2) NOT NULL,
    -- Nigerian DisCo Band A & Petrol/Diesel Generator ROI metrics
    disco_tariff_band VARCHAR(16) DEFAULT 'BAND_A',
    current_monthly_grid_spend_kobo BIGINT NOT NULL DEFAULT 0,
    current_monthly_fuel_spend_kobo BIGINT NOT NULL DEFAULT 0,
    projected_monthly_savings_kobo BIGINT NOT NULL DEFAULT 0,
    -- Financing Configuration
    payment_mode payment_mode_enum NOT NULL,
    tenure_months SMALLINT NOT NULL CHECK (tenure_months BETWEEN 1 AND 36),
    total_system_price_kobo BIGINT NOT NULL,
    down_payment_kobo BIGINT NOT NULL,
    insurance_fee_kobo BIGINT NOT NULL,
    monthly_installment_kobo BIGINT NOT NULL,
    status quote_status_enum NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- BUSINESS RULE: Installment plans MUST strictly use LiFePO4 batteries
    CONSTRAINT chk_installment_lifepo4_mandate CHECK (
        (payment_mode = 'OUTRIGHT') OR
        (payment_mode = 'INSTALLMENT' AND battery_chemistry = 'LIFEPO4')
    ),
    -- BUSINESS RULE: Installment plans require at least 30% down payment
    CONSTRAINT chk_down_payment_minimum CHECK (
        (payment_mode = 'OUTRIGHT') OR
        (down_payment_kobo >= (total_system_price_kobo * 30) / 100)
    )
);

-- ============================================================================
-- 5. PHYSICAL SITE AUDITS & FIELD COMMISSIONING CHECKLISTS
-- ============================================================================
CREATE TABLE site_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES sizing_quotes(id) ON DELETE RESTRICT,
    auditor_engineer_id UUID NOT NULL,
    roof_structure_type VARCHAR(64) NOT NULL,
    compass_azimuth_deg NUMERIC(5,2) NOT NULL,
    roof_tilt_deg NUMERIC(4,2) NOT NULL,
    shading_obstruction_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    cable_run_meters NUMERIC(5,2) NOT NULL,
    earthing_resistance_ohms NUMERIC(5,2), -- Must beverified < 5.0 Ohms at commissioning
    lower_shroud_seal_serial VARCHAR(64),
    audit_photos_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
    approved_for_install BOOLEAN NOT NULL DEFAULT FALSE,
    audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. HARDWARE DEVICES & RMA AUDIT TRAIL
-- ============================================================================
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    growatt_serial VARCHAR(64) UNIQUE NOT NULL,
    battery_serial VARCHAR(64) UNIQUE NOT NULL,
    edge_controller_imei VARCHAR(32) UNIQUE NOT NULL,
    ble_mac_address VARCHAR(24) UNIQUE,
    lower_shroud_seal_serial VARCHAR(64) UNIQUE NOT NULL,
    model_sku VARCHAR(64) NOT NULL,
    pv_kwp_installed NUMERIC(6,2) NOT NULL,
    battery_kwh_installed NUMERIC(6,2) NOT NULL,
    gps_lat DOUBLE PRECISION NOT NULL,
    gps_lng DOUBLE PRECISION NOT NULL,
    local_psh_factor NUMERIC(4,2) NOT NULL DEFAULT 4.50,
    vfs_path TEXT UNIQUE NOT NULL,
    relay_state relay_state_enum NOT NULL DEFAULT 'STANDBY_LOCKED',
    tamper_switch_state tamper_state_enum NOT NULL DEFAULT 'SEALED',
    harmattan_soiling_alert BOOLEAN NOT NULL DEFAULT FALSE,
    offline_token_counter BIGINT NOT NULL DEFAULT 0,
    last_heartbeat_at TIMESTAMPTZ,
    installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE device_rma_swaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
    old_growatt_serial VARCHAR(64) NOT NULL,
    new_growatt_serial VARCHAR(64) NOT NULL,
    old_seal_serial VARCHAR(64) NOT NULL,
    new_seal_serial VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    field_engineer_id UUID NOT NULL,
    swapped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. PAYG CONTRACTS, VIRTUAL ACCOUNTS & OFFLINE STS/HMAC TOKENS
-- ============================================================================
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID REFERENCES sizing_quotes(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    device_id UUID UNIQUE NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
    total_price_kobo BIGINT NOT NULL CHECK (total_price_kobo > 0),
    down_payment_kobo BIGINT NOT NULL CHECK (down_payment_kobo >= 0),
    insurance_fee_kobo BIGINT NOT NULL CHECK (insurance_fee_kobo >= 0),
    monthly_installment_kobo BIGINT NOT NULL CHECK (monthly_installment_kobo >= 0),
    tenure_months SMALLINT NOT NULL CHECK (tenure_months BETWEEN 1 AND 36),
    repayment_frequency repayment_freq_enum NOT NULL DEFAULT 'MONTHLY',
    paid_until_at TIMESTAMPTZ NOT NULL,
    grace_period_hours SMALLINT NOT NULL DEFAULT 48,
    status contract_status_enum NOT NULL DEFAULT 'PENDING_INSTALL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE virtual_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
    provider payment_provider_enum NOT NULL,
    account_number VARCHAR(20) UNIQUE NOT NULL,
    account_name VARCHAR(160) NOT NULL,
    bank_name VARCHAR(80) NOT NULL,
    provider_customer_code VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE offline_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
    sequence_counter BIGINT NOT NULL,
    token_code_masked VARCHAR(32) NOT NULL,
    token_code_hash VARCHAR(128) UNIQUE NOT NULL,
    energy_seconds_granted BIGINT NOT NULL CHECK (energy_seconds_granted > 0),
    delivery_channel VARCHAR(32) NOT NULL DEFAULT 'SMS_AND_BLE',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    redeemed_at TIMESTAMPTZ,
    UNIQUE (device_id, sequence_counter)
);

-- ============================================================================
-- 8. IMMUTABLE DOUBLE-ENTRY LEDGER (APPEND-ONLY)
-- ============================================================================
CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
    provider payment_provider_enum NOT NULL,
    idempotency_tx_ref VARCHAR(128) UNIQUE NOT NULL,
    entry_type ledger_entry_type_enum NOT NULL,
    amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
    energy_seconds_delta BIGINT NOT NULL,
    offline_token_id UUID REFERENCES offline_tokens(id),
    raw_webhook_jsonb JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce strict immutability: Block UPDATE and DELETE on ledger_entries
CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'SECURITY VIOLATION: ledger_entries is an immutable append-only financial table. % operations are strictly prohibited.', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_immutable_ledger_entries
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

-- ============================================================================
-- 9. TIMESCALEDB HYPERTABLE: INVERTER TELEMETRY
-- ============================================================================
CREATE TABLE inverter_telemetry (
    time TIMESTAMPTZ NOT NULL,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
    pv_volts NUMERIC(6,2) NOT NULL,
    pv_watts NUMERIC(8,2) NOT NULL,
    ac_output_watts NUMERIC(8,2) NOT NULL,
    ac_grid_volts NUMERIC(6,2) NOT NULL,
    battery_volts NUMERIC(6,2) NOT NULL,
    battery_soc_pct NUMERIC(5,2) NOT NULL CHECK (battery_soc_pct BETWEEN 0 AND 100),
    inverter_temp_c NUMERIC(5,2) NOT NULL,
    growatt_status_code INT NOT NULL,
    growatt_fault_code INT NOT NULL DEFAULT 0,
    tamper_pin_high BOOLEAN NOT NULL DEFAULT FALSE
);

-- Convert to TimescaleDB Hypertable partitioned by 7 days
SELECT create_hypertable(
    'inverter_telemetry',
    'time',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Enable native TimescaleDB columnar compression after 14 days
ALTER TABLE inverter_telemetry SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('inverter_telemetry', INTERVAL '14 days', if_not_exists => TRUE);

-- ============================================================================
-- 10. PGVECTOR KNOWLEDGE STORE FOR LOCALGRIDAGENT (RAG)
-- ============================================================================
CREATE TABLE knowledge_vectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_category doc_category_enum NOT NULL,
    model_sku VARCHAR(64) NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HNSW Index for fast cosine similarity search on Growatt manuals & policies
CREATE INDEX idx_knowledge_vectors_embedding_hnsw
ON knowledge_vectors USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- 11. OPERATIONAL INDEXES
-- ============================================================================
CREATE INDEX idx_contracts_status_paid_until ON contracts(status, paid_until_at);
CREATE INDEX idx_ledger_contract_created ON ledger_entries(contract_id, created_at DESC);
CREATE INDEX idx_telemetry_device_time ON inverter_telemetry(device_id, time DESC);
CREATE INDEX idx_devices_tamper_state ON devices(tamper_switch_state) WHERE tamper_switch_state = 'TRIPPED';

COMMIT;