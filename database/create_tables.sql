-- ============================================================
-- NCR HOME TUITION - DATABASE SCHEMA
-- ============================================================
-- Run this in Supabase SQL Editor to create tables.
-- Safe to run multiple times (uses IF NOT EXISTS).
--
-- IDs auto-generate on INSERT:
--   Students: NCR001, NCR002, NCR003 ...
--   Tutors:   TECH001, TECH002, TECH003 ...
--
-- You can import CSV WITHOUT the id column.
-- ============================================================


-- ============================================================
-- FUNCTION: Generate next student ID (NCR + 3 digits)
-- ============================================================

CREATE OR REPLACE FUNCTION generate_student_id()
RETURNS TRIGGER AS $$
DECLARE
    max_num INTEGER := 0;
    row_rec RECORD;
BEGIN
    -- Only generate if id is NULL or empty
    IF NEW.id IS NOT NULL AND NEW.id != '' THEN
        RETURN NEW;
    END IF;

    -- Find the highest existing NCR number
    FOR row_rec IN SELECT id FROM students LOOP
        IF row_rec.id ~ '^NCR[0-9]+$' THEN
            IF CAST(SUBSTRING(row_rec.id FROM 4) AS INTEGER) > max_num THEN
                max_num := CAST(SUBSTRING(row_rec.id FROM 4) AS INTEGER);
            END IF;
        END IF;
    END LOOP;

    -- Also check UUID-based old IDs to skip them
    -- (they don't match the NCR pattern so they're ignored)

    -- Generate next ID
    NEW.id := 'NCR' || LPAD((max_num + 1)::TEXT, 3, '0');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- FUNCTION: Generate next tutor ID (TECH + 3 digits)
-- ============================================================

CREATE OR REPLACE FUNCTION generate_tutor_id()
RETURNS TRIGGER AS $$
DECLARE
    max_num INTEGER := 0;
    row_rec RECORD;
BEGIN
    -- Only generate if id is NULL or empty
    IF NEW.id IS NOT NULL AND NEW.id != '' THEN
        RETURN NEW;
    END IF;

    -- Find the highest existing TECH number
    FOR row_rec IN SELECT id FROM tutors LOOP
        IF row_rec.id ~ '^TECH[0-9]+$' THEN
            IF CAST(SUBSTRING(row_rec.id FROM 5) AS INTEGER) > max_num THEN
                max_num := CAST(SUBSTRING(row_rec.id FROM 5) AS INTEGER);
            END IF;
        END IF;
    END LOOP;

    -- Generate next ID
    NEW.id := 'TECH' || LPAD((max_num + 1)::TEXT, 3, '0');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- STUDENTS TABLE
-- ID column allows NULL — trigger auto-fills NCR001, NCR002 ...
-- ============================================================

CREATE TABLE IF NOT EXISTS students (
    id                  TEXT PRIMARY KEY,
    type                TEXT DEFAULT 'student',
    name                TEXT NOT NULL,
    mobile_no           TEXT NOT NULL,
    email               TEXT NOT NULL,
    course              TEXT NOT NULL,
    subject             TEXT NOT NULL,
    "Preferred_Gender"  TEXT,
    qualification       TEXT,
    address             TEXT,
    experience_years    NUMERIC,
    payment             NUMERIC,
    payment_type        TEXT DEFAULT 'per_hour',
    preferred_mode      TEXT DEFAULT 'online',
    language            TEXT DEFAULT 'English',
    country             TEXT DEFAULT 'India',
    city                TEXT,
    timezone            TEXT DEFAULT 'Asia/Kolkata',
    status              TEXT DEFAULT 'active',
    joined_date         TEXT,
    created_at          TEXT,
    updated_at          TEXT,
    ip_address          TEXT,
    user_agent          TEXT,
    source              TEXT DEFAULT 'website'
);

-- Drop old trigger if exists, then create new one
DROP TRIGGER IF EXISTS trg_generate_student_id ON students;
CREATE TRIGGER trg_generate_student_id
    BEFORE INSERT ON students
    FOR EACH ROW
    EXECUTE FUNCTION generate_student_id();


-- ============================================================
-- TUTORS TABLE
-- ID column allows NULL — trigger auto-fills TECH001, TECH002 ...
-- ============================================================

CREATE TABLE IF NOT EXISTS tutors (
    id                  TEXT PRIMARY KEY,
    type                TEXT DEFAULT 'tutor',
    name                TEXT NOT NULL,
    mobile_no           TEXT NOT NULL,
    email               TEXT NOT NULL,
    course              TEXT NOT NULL,
    subject             TEXT NOT NULL,
    qualification       TEXT,
    address             TEXT,
    experience_years    NUMERIC,
    payment             NUMERIC,
    payment_type        TEXT DEFAULT 'per_hour',
    preferred_mode      TEXT DEFAULT 'online',
    language            TEXT DEFAULT 'English',
    country             TEXT DEFAULT 'India',
    city                TEXT,
    timezone            TEXT DEFAULT 'Asia/Kolkata',
    status              TEXT DEFAULT 'active',
    joined_date         TEXT,
    created_at          TEXT,
    updated_at          TEXT,
    ip_address          TEXT,
    user_agent          TEXT,
    source              TEXT DEFAULT 'website'
);

-- Drop old trigger if exists, then create new one
DROP TRIGGER IF EXISTS trg_generate_tutor_id ON tutors;
CREATE TRIGGER trg_generate_tutor_id
    BEFORE INSERT ON tutors
    FOR EACH ROW
    EXECUTE FUNCTION generate_tutor_id();


-- ============================================================
-- ADMINS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS admins (
    id              TEXT PRIMARY KEY,
    username        TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL
);


-- ============================================================
-- ADMIN SESSIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_sessions (
    id              TEXT PRIMARY KEY,
    session_token   TEXT UNIQUE NOT NULL,
    admin_id        TEXT NOT NULL,
    created_at      TEXT,
    expires_at      TEXT
);


-- ============================================================
-- PAYMENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS payments (
    id                      TEXT PRIMARY KEY,
    email                   TEXT NOT NULL,
    mobile_no               TEXT NOT NULL,
    amount                  NUMERIC NOT NULL,
    currency                TEXT DEFAULT 'INR',
    user_type               TEXT,
    user_ids                TEXT,
    razorpay_order_id       TEXT,
    razorpay_payment_id     TEXT,
    razorpay_signature      TEXT,
    status                  TEXT DEFAULT 'created',
    created_at              TEXT,
    updated_at              TEXT
);


-- ============================================================
-- INDEXES (speed up queries)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_city ON students(city);
CREATE INDEX IF NOT EXISTS idx_students_type ON students(type);

CREATE INDEX IF NOT EXISTS idx_tutors_status ON tutors(status);
CREATE INDEX IF NOT EXISTS idx_tutors_city ON tutors(city);
CREATE INDEX IF NOT EXISTS idx_tutors_type ON tutors(type);

CREATE INDEX IF NOT EXISTS idx_payments_email ON payments(email);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);


-- ============================================================
-- DONE! 
-- ============================================================
-- Tables created with auto-increment triggers.
-- You can now import CSV without the id column.
-- IDs will auto-generate: NCR001, NCR002 ... and TECH001, TECH002 ...
-- ============================================================
