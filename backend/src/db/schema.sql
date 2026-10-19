-- ============================================================================
-- PRIVATE TUITION MANAGEMENT SYSTEM - POSTGRESQL SCHEMA
-- Built for Bangladesh Tuition & Coaching Management
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clean schema setup (or run cleanly)
CREATE SCHEMA IF NOT EXISTS public;

-- 1. ADMINISTRATORS TABLE
-- Invariant: Exactly three pre-authorized administrator identities.
CREATE TABLE IF NOT EXISTS administrators (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('OWNER', 'ADMINISTRATOR_2', 'ADMINISTRATOR_3')),
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to enforce strictly at most 3 administrators in the database
CREATE OR REPLACE FUNCTION enforce_admin_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM administrators) >= 3 THEN
        RAISE EXCEPTION 'System invariant violation: Maximum of exactly three administrator accounts permitted.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_admin_limit ON administrators;
CREATE TRIGGER trg_enforce_admin_limit
BEFORE INSERT ON administrators
FOR EACH ROW
EXECUTE FUNCTION enforce_admin_limit();

-- 2. SESSIONS TABLE
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(64) PRIMARY KEY,
    admin_id INT NOT NULL REFERENCES administrators(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_admin_id ON sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- 3. BATCHES TABLE
CREATE TABLE IF NOT EXISTS batches (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    class_name VARCHAR(100) NOT NULL,
    subject VARCHAR(100),
    default_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (default_fee >= 0),
    default_billing_mode VARCHAR(20) NOT NULL DEFAULT 'AUTOMATIC' CHECK (default_billing_mode IN ('AUTOMATIC', 'MANUAL')),
    billing_day_of_month INT NOT NULL DEFAULT 1 CHECK (billing_day_of_month BETWEEN 1 AND 28),
    grace_period_days INT NOT NULL DEFAULT 7 CHECK (grace_period_days >= 0),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    schedule_text VARCHAR(255),
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_batches_is_active ON batches(is_active);

-- 4. STUDENTS TABLE
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    student_code VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(200) NOT NULL,
    student_phone VARCHAR(30),
    guardian_phone VARCHAR(30) NOT NULL,
    batch_id INT NOT NULL REFERENCES batches(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    class_name VARCHAR(100) NOT NULL,
    admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
    monthly_fee NUMERIC(12, 2) CHECK (monthly_fee IS NULL OR monthly_fee >= 0),
    billing_mode VARCHAR(20) CHECK (billing_mode IS NULL OR billing_mode IN ('AUTOMATIC', 'MANUAL')),
    billing_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'COMPLETED', 'ARCHIVED')),
    address TEXT,
    notes TEXT,
    photo_filename VARCHAR(255),
    photo_mime_type VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_students_batch_id ON students(batch_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_guardian_phone ON students(guardian_phone);
CREATE INDEX IF NOT EXISTS idx_students_code ON students(student_code);

-- 5. ENROLLMENT HISTORY (Tracks batch movement over time)
CREATE TABLE IF NOT EXISTS enrollment_history (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    batch_id INT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    fee_snapshot NUMERIC(12, 2) NOT NULL,
    billing_mode_snapshot VARCHAR(20) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_enrollment_student ON enrollment_history(student_id);

-- 6. BILLING RECORDS (Monthly obligations)
CREATE TABLE IF NOT EXISTS billing_records (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    batch_id INT NOT NULL REFERENCES batches(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    billing_year INT NOT NULL CHECK (billing_year BETWEEN 2000 AND 2100),
    billing_month INT NOT NULL CHECK (billing_month BETWEEN 1 AND 12),
    fee_amount NUMERIC(12, 2) NOT NULL CHECK (fee_amount >= 0),
    adjusted_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (adjusted_amount >= 0),
    due_date DATE NOT NULL,
    notes TEXT,
    created_by INT REFERENCES administrators(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_student_billing_period UNIQUE (student_id, billing_year, billing_month)
);

CREATE INDEX IF NOT EXISTS idx_billing_student ON billing_records(student_id);
CREATE INDEX IF NOT EXISTS idx_billing_period ON billing_records(billing_year, billing_month);
CREATE INDEX IF NOT EXISTS idx_billing_batch ON billing_records(batch_id);

-- 7. PAYMENT TRANSACTIONS (Money received)
CREATE TABLE IF NOT EXISTS payment_transactions (
    id SERIAL PRIMARY KEY,
    receipt_number VARCHAR(50) NOT NULL UNIQUE,
    student_id INT NOT NULL REFERENCES students(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('CASH', 'BKASH', 'NAGAD', 'ROCKET', 'BANK_TRANSFER', 'OTHER')),
    transaction_reference VARCHAR(100),
    notes TEXT,
    recorded_by INT NOT NULL REFERENCES administrators(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'REVERSED')),
    reversal_reason TEXT,
    reversed_at TIMESTAMPTZ,
    reversed_by INT REFERENCES administrators(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_student ON payment_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payment_transactions(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payment_transactions(status);

-- 8. PAYMENT ALLOCATIONS (Links money to bills)
CREATE TABLE IF NOT EXISTS payment_allocations (
    id SERIAL PRIMARY KEY,
    payment_id INT NOT NULL REFERENCES payment_transactions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    billing_record_id INT NOT NULL REFERENCES billing_records(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    allocated_amount NUMERIC(12, 2) NOT NULL CHECK (allocated_amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_allocations_billing ON payment_allocations(billing_record_id);

-- 9. FEE ADJUSTMENTS (Waivers, scholarships, discounts)
CREATE TABLE IF NOT EXISTS fee_adjustments (
    id SERIAL PRIMARY KEY,
    billing_record_id INT NOT NULL REFERENCES billing_records(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    adjustment_type VARCHAR(50) NOT NULL CHECK (adjustment_type IN ('WAIVER', 'SCHOLARSHIP', 'DISCOUNT', 'CORRECTION')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    approved_by INT NOT NULL REFERENCES administrators(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_adjustments_billing ON fee_adjustments(billing_record_id);

-- 10. AUDIT LOGS (Immutable record of security and financial events)
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    admin_id INT REFERENCES administrators(id) ON DELETE SET NULL,
    admin_name VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

-- 11. APPLICATION SETTINGS
CREATE TABLE IF NOT EXISTS application_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description VARCHAR(255),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by INT REFERENCES administrators(id) ON DELETE SET NULL
);

-- Default system settings
INSERT INTO application_settings (key, value, description)
VALUES 
    ('institution_name', 'Tuition Care', 'Display name of the tutor or coaching center'),
    ('institution_contact', '01911735403', 'Official contact phone number'),
    ('institution_address', 'Gazipur, Dhaka, Bangladesh', 'Address displayed on invoices and receipts'),
    ('default_currency', 'BDT', 'Currency code'),
    ('currency_symbol', '৳', 'Currency symbol'),
    ('default_timezone', 'Asia/Dhaka', 'Standard application timezone'),
    ('default_interface_language', 'bn', 'Default system language (en or bn)'),
    ('default_billing_mode', 'AUTOMATIC', 'Global default billing mode'),
    ('receipt_prefix', 'REC-', 'Prefix for payment receipt numbers'),
    ('student_id_prefix', 'STU-', 'Prefix for student identification numbers')
ON CONFLICT (key) DO NOTHING;
