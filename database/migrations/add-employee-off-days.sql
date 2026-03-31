-- Migration: Add employee_off_days table
-- Purpose: Track scheduled off-days for employees with non-standard work weeks
-- Example: Alternating Saturday offs (Saturday Week 1, Week 3, etc.)

-- Step 1: Create employee_off_days table
CREATE TABLE IF NOT EXISTS employee_off_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  off_date DATE NOT NULL,
  off_type VARCHAR(50) DEFAULT 'alternating_saturday' CHECK (
    off_type IN ('weekly_saturday', 'alternating_saturday', 'weekly_sunday', 'custom')
  ),
  notes TEXT,
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Prevent duplicate off-days for same employee
  CONSTRAINT unique_employee_off_date UNIQUE (employee_id, off_date)
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_off_days_employee 
  ON employee_off_days(employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_off_days_date 
  ON employee_off_days(off_date);

CREATE INDEX IF NOT EXISTS idx_employee_off_days_employee_daterange 
  ON employee_off_days(employee_id, off_date);

CREATE INDEX IF NOT EXISTS idx_employee_off_days_type 
  ON employee_off_days(off_type);

-- Step 3: Add comments for documentation
COMMENT ON TABLE employee_off_days IS 'Tracks scheduled off-days for employees with non-standard work weeks (e.g., alternating Saturdays)';
COMMENT ON COLUMN employee_off_days.employee_id IS 'Employee ID (FK to employees table)';
COMMENT ON COLUMN employee_off_days.off_date IS 'Date of the scheduled off-day';
COMMENT ON COLUMN employee_off_days.off_type IS 'Type of off-day: weekly_saturday, alternating_saturday, weekly_sunday, or custom';
COMMENT ON COLUMN employee_off_days.notes IS 'Optional notes about this off-day';
COMMENT ON COLUMN employee_off_days.created_by IS 'ID of user who created this record (usually HR)';

-- Step 4: Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_employee_off_days_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_employee_off_days_updated_at
  BEFORE UPDATE ON employee_off_days
  FOR EACH ROW
  EXECUTE FUNCTION update_employee_off_days_updated_at();

-- Step 5: Verification queries
SELECT 
  'employee_off_days table created' as status,
  COUNT(*) as record_count
FROM employee_off_days;

-- Verify indexes
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'employee_off_days'
ORDER BY indexname;

-- Verify constraints
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'employee_off_days'::regclass
ORDER BY conname;
