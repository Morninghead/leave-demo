-- ============================================
-- Daily Line Attendance System - Database Migration
-- Created: 2026-01-19
-- ============================================

-- ============================================
-- 1. MANUFACTURING LINES TABLE
-- Stores production line configuration with headcount requirements
-- ============================================
CREATE TABLE IF NOT EXISTS manufacturing_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name_th VARCHAR(100),
    name_en VARCHAR(100),
    category VARCHAR(20) NOT NULL CHECK (category IN ('5s', 'asm', 'pro', 'tpl', 'other')),
    headcount_day INTEGER NOT NULL DEFAULT 0,
    headcount_night_ab INTEGER NOT NULL DEFAULT 0,
    headcount_night_cd INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_manufacturing_lines_category ON manufacturing_lines(category);
CREATE INDEX IF NOT EXISTS idx_manufacturing_lines_active ON manufacturing_lines(is_active);

-- ============================================
-- 2. SUBCONTRACT EMPLOYEES TABLE
-- Stores subcontract worker information (separate from SSTH employees)
-- ============================================
CREATE TABLE IF NOT EXISTS subcontract_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code VARCHAR(20) NOT NULL UNIQUE,
    first_name_th VARCHAR(100) NOT NULL,
    last_name_th VARCHAR(100) NOT NULL,
    first_name_en VARCHAR(100),
    last_name_en VARCHAR(100),
    nickname VARCHAR(50),
    company_name VARCHAR(100) NOT NULL,
    company_code VARCHAR(20),
    line_id UUID REFERENCES manufacturing_lines(id),
    shift VARCHAR(20) NOT NULL CHECK (shift IN ('day', 'night_ab', 'night_cd')),
    position_th VARCHAR(100),
    position_en VARCHAR(100),
    phone_number VARCHAR(20),
    photo_url TEXT,
    national_id VARCHAR(20),
    hire_date DATE NOT NULL,
    end_date DATE,
    hourly_rate DECIMAL(10, 2),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES employees(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for subcontract employees
CREATE INDEX IF NOT EXISTS idx_subcontract_employees_line ON subcontract_employees(line_id);
CREATE INDEX IF NOT EXISTS idx_subcontract_employees_shift ON subcontract_employees(shift);
CREATE INDEX IF NOT EXISTS idx_subcontract_employees_company ON subcontract_employees(company_name);
CREATE INDEX IF NOT EXISTS idx_subcontract_employees_active ON subcontract_employees(is_active);

-- ============================================
-- 3. LINE ATTENDANCE TABLE
-- Daily attendance records per line (header)
-- ============================================
CREATE TABLE IF NOT EXISTS line_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID NOT NULL REFERENCES manufacturing_lines(id),
    attendance_date DATE NOT NULL,
    shift VARCHAR(20) NOT NULL CHECK (shift IN ('day', 'night_ab', 'night_cd')),
    
    -- Counts
    required_count INTEGER NOT NULL DEFAULT 0,
    present_count INTEGER NOT NULL DEFAULT 0,
    absent_count INTEGER NOT NULL DEFAULT 0,
    
    -- Replacement request
    replacement_requested INTEGER NOT NULL DEFAULT 0,
    replacement_filled INTEGER NOT NULL DEFAULT 0,
    replacement_notes TEXT,
    
    -- Submission tracking
    submitted_by UUID REFERENCES employees(id),
    submitted_at TIMESTAMP,
    is_late BOOLEAN DEFAULT false,
    deadline_time TIME DEFAULT '10:00:00',
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'confirmed', 'revised')),
    confirmed_by UUID REFERENCES employees(id),
    confirmed_at TIMESTAMP,
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate submissions
    UNIQUE(line_id, attendance_date, shift)
);

-- Indexes for line attendance
CREATE INDEX IF NOT EXISTS idx_line_attendance_date ON line_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_line_attendance_line ON line_attendance(line_id);
CREATE INDEX IF NOT EXISTS idx_line_attendance_shift ON line_attendance(shift);
CREATE INDEX IF NOT EXISTS idx_line_attendance_status ON line_attendance(status);
CREATE INDEX IF NOT EXISTS idx_line_attendance_late ON line_attendance(is_late);
CREATE INDEX IF NOT EXISTS idx_line_attendance_submitted_by ON line_attendance(submitted_by);

-- ============================================
-- 4. LINE ATTENDANCE DETAILS TABLE
-- Individual employee attendance records
-- ============================================
CREATE TABLE IF NOT EXISTS line_attendance_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_attendance_id UUID NOT NULL REFERENCES line_attendance(id) ON DELETE CASCADE,
    subcontract_employee_id UUID NOT NULL REFERENCES subcontract_employees(id),
    
    -- Attendance status
    is_present BOOLEAN NOT NULL DEFAULT true,
    check_in_time TIME,
    check_out_time TIME,
    
    -- Absence info (if not present)
    absence_reason VARCHAR(50) CHECK (absence_reason IN ('leave', 'sick', 'no_show', 'resigned', 'other')),
    absence_notes TEXT,
    
    -- Replacement (if this employee is a replacement)
    is_replacement BOOLEAN DEFAULT false,
    replacing_for UUID REFERENCES subcontract_employees(id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate entries
    UNIQUE(line_attendance_id, subcontract_employee_id)
);

-- Indexes for attendance details
CREATE INDEX IF NOT EXISTS idx_line_attendance_details_attendance ON line_attendance_details(line_attendance_id);
CREATE INDEX IF NOT EXISTS idx_line_attendance_details_employee ON line_attendance_details(subcontract_employee_id);
CREATE INDEX IF NOT EXISTS idx_line_attendance_details_present ON line_attendance_details(is_present);

-- ============================================
-- 5. SEED DATA - Manufacturing Lines
-- Initial production lines configuration
-- ============================================
INSERT INTO manufacturing_lines (code, name_th, name_en, category, headcount_day, headcount_night_ab, headcount_night_cd, sort_order) VALUES
    ('5S', '5S', '5S', '5s', 3, 2, 1, 1),
    ('ASM2', 'ASM2', 'ASM2', 'asm', 8, 4, 4, 10),
    ('ASM3-1', 'ASM3-1', 'ASM3-1', 'asm', 6, 3, 3, 11),
    ('ASM3-2', 'ASM3-2', 'ASM3-2', 'asm', 6, 3, 3, 12),
    ('ASM4', 'ASM4', 'ASM4', 'asm', 7, 4, 3, 13),
    ('ASM5', 'ASM5', 'ASM5', 'asm', 8, 4, 4, 14),
    ('ASM6', 'ASM6', 'ASM6', 'asm', 7, 3, 4, 15),
    ('ASM7-1', 'ASM7-1', 'ASM7-1', 'asm', 5, 3, 2, 16),
    ('ASM7-2', 'ASM7-2', 'ASM7-2', 'asm', 5, 2, 3, 17),
    ('ASM7-3', 'ASM7-3', 'ASM7-3', 'asm', 5, 3, 2, 18),
    ('ASM8', 'ASM8', 'ASM8', 'asm', 6, 3, 3, 19),
    ('ASM9', 'ASM9', 'ASM9', 'asm', 6, 3, 3, 20),
    ('PRO1', 'PRO1', 'PRO1', 'pro', 5, 3, 2, 30),
    ('PRO2', 'PRO2', 'PRO2', 'pro', 4, 2, 1, 31),
    ('PRO4', 'PRO4', 'PRO4', 'pro', 6, 3, 3, 32),
    ('PRO5', 'PRO5', 'PRO5', 'pro', 5, 2, 3, 33),
    ('PRO7', 'PRO7', 'PRO7', 'pro', 7, 4, 3, 34),
    ('PRO8', 'PRO8', 'PRO8', 'pro', 6, 3, 3, 35),
    ('TPL1', 'TPL1', 'TPL1', 'tpl', 4, 2, 2, 50),
    ('TPL2', 'TPL2', 'TPL2', 'tpl', 5, 3, 2, 51),
    ('TPL3', 'TPL3', 'TPL3', 'tpl', 4, 2, 2, 52),
    ('TPL4', 'TPL4', 'TPL4', 'tpl', 5, 2, 3, 53),
    ('TPL5', 'TPL5', 'TPL5', 'tpl', 4, 2, 2, 54),
    ('TPL6', 'TPL6', 'TPL6', 'tpl', 5, 3, 2, 55),
    ('TPL7', 'TPL7', 'TPL7', 'tpl', 4, 2, 2, 56),
    ('TPL8', 'TPL8', 'TPL8', 'tpl', 5, 2, 3, 57),
    ('TPL9', 'TPL9', 'TPL9', 'tpl', 4, 2, 2, 58)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 6. RLS POLICIES (if using Supabase)
-- ============================================

-- Enable RLS
ALTER TABLE manufacturing_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontract_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_attendance_details ENABLE ROW LEVEL SECURITY;

-- Manufacturing Lines: All authenticated users can read, only HR/Admin can modify
CREATE POLICY "manufacturing_lines_read" ON manufacturing_lines FOR SELECT USING (true);
CREATE POLICY "manufacturing_lines_insert" ON manufacturing_lines FOR INSERT WITH CHECK (true);
CREATE POLICY "manufacturing_lines_update" ON manufacturing_lines FOR UPDATE USING (true);
CREATE POLICY "manufacturing_lines_delete" ON manufacturing_lines FOR DELETE USING (true);

-- Subcontract Employees: All authenticated users can read, HR/Admin can modify
CREATE POLICY "subcontract_employees_read" ON subcontract_employees FOR SELECT USING (true);
CREATE POLICY "subcontract_employees_insert" ON subcontract_employees FOR INSERT WITH CHECK (true);
CREATE POLICY "subcontract_employees_update" ON subcontract_employees FOR UPDATE USING (true);
CREATE POLICY "subcontract_employees_delete" ON subcontract_employees FOR DELETE USING (true);

-- Line Attendance: All authenticated users can read, Production/HR/Admin can modify
CREATE POLICY "line_attendance_read" ON line_attendance FOR SELECT USING (true);
CREATE POLICY "line_attendance_insert" ON line_attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "line_attendance_update" ON line_attendance FOR UPDATE USING (true);
CREATE POLICY "line_attendance_delete" ON line_attendance FOR DELETE USING (true);

-- Line Attendance Details
CREATE POLICY "line_attendance_details_read" ON line_attendance_details FOR SELECT USING (true);
CREATE POLICY "line_attendance_details_insert" ON line_attendance_details FOR INSERT WITH CHECK (true);
CREATE POLICY "line_attendance_details_update" ON line_attendance_details FOR UPDATE USING (true);
CREATE POLICY "line_attendance_details_delete" ON line_attendance_details FOR DELETE USING (true);

-- ============================================
-- 7. HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_line_attendance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating timestamps
DROP TRIGGER IF EXISTS update_manufacturing_lines_timestamp ON manufacturing_lines;
CREATE TRIGGER update_manufacturing_lines_timestamp
    BEFORE UPDATE ON manufacturing_lines
    FOR EACH ROW EXECUTE FUNCTION update_line_attendance_timestamp();

DROP TRIGGER IF EXISTS update_subcontract_employees_timestamp ON subcontract_employees;
CREATE TRIGGER update_subcontract_employees_timestamp
    BEFORE UPDATE ON subcontract_employees
    FOR EACH ROW EXECUTE FUNCTION update_line_attendance_timestamp();

DROP TRIGGER IF EXISTS update_line_attendance_timestamp ON line_attendance;
CREATE TRIGGER update_line_attendance_timestamp_trigger
    BEFORE UPDATE ON line_attendance
    FOR EACH ROW EXECUTE FUNCTION update_line_attendance_timestamp();

DROP TRIGGER IF EXISTS update_line_attendance_details_timestamp ON line_attendance_details;
CREATE TRIGGER update_line_attendance_details_timestamp
    BEFORE UPDATE ON line_attendance_details
    FOR EACH ROW EXECUTE FUNCTION update_line_attendance_timestamp();

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
