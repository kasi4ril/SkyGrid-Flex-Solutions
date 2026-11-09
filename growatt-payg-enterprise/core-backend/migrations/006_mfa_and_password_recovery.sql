-- ============================================================================
-- 006_mfa_and_password_recovery.sql
-- Two-Factor Authentication (2FA / MFA), Email/Phone Verification Challenges,
-- and Self-Service Password Recovery Engine.
-- Target: PostgreSQL 16+
-- ============================================================================

BEGIN;

-- 1. ENHANCE USERS TABLE WITH 2FA & PHONE VERIFICATION FLAGS
ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS preferred_mfa_channel VARCHAR(20) NOT NULL DEFAULT 'EMAIL_AND_SMS';

-- 2. MFA CHALLENGES TABLE
-- Tracks short-lived 6-digit OTP challenges during user authentication.
CREATE TABLE IF NOT EXISTS mfa_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mfa_token_hash VARCHAR(64) UNIQUE NOT NULL,
    code_hash VARCHAR(64) NOT NULL,
    channel VARCHAR(30) NOT NULL DEFAULT 'EMAIL_AND_SMS',
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(50),
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_challenges_token_hash ON mfa_challenges(mfa_token_hash);
CREATE INDEX IF NOT EXISTS idx_mfa_challenges_user_id ON mfa_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_challenges_expires ON mfa_challenges(expires_at);

-- 3. PASSWORD RESET TOKENS TABLE
-- Tracks self-service forgot & recovery password OTPs and tokens.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    code_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON password_reset_tokens(expires_at);

COMMIT;
