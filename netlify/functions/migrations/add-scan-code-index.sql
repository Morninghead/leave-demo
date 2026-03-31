-- Migration: Add scan_code indexing and constraints for login functionality
-- Purpose: Improve scan_code lookup performance and ensure data integrity for scan_code authentication

-- Step 1: Add performance index for scan_code lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employees_scan_code_lookup
ON employees(scan_code);

-- Step 2: Verify and add unique constraint for scan_code if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'employees'::regclass
        AND conname = 'employees_scan_code_unique'
        AND contype = 'u'
    ) THEN
        ALTER TABLE employees ADD CONSTRAINT employees_scan_code_unique UNIQUE (scan_code);
        RAISE NOTICE 'Added unique constraint for scan_code';
    ELSE
        RAISE NOTICE 'Unique constraint for scan_code already exists';
    END IF;
END $$;

-- Step 3: Create a partial index for active employees scan_code lookup (optional optimization)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employees_active_scan_code
ON employees(scan_code)
WHERE status = 'active';

-- Step 4: Add comment to scan_code column for documentation
COMMENT ON COLUMN employees.scan_code IS 'Employee scan code used for quick login authentication (typically 5-digit code)';

-- Step 5: Verify the changes
SELECT
    column_name,
    is_nullable,
    column_default,
    data_type
FROM information_schema.columns
WHERE table_name = 'employees'
AND column_name = 'scan_code';

-- Step 6: Check for any existing scan_code duplicates (for data integrity)
SELECT
    scan_code,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(employee_code) as employee_codes
FROM employees
WHERE scan_code IS NOT NULL
GROUP BY scan_code
HAVING COUNT(*) > 1;

-- If duplicates exist, they should be resolved before implementing scan_code login
-- The query above will show any scan_codes that are shared by multiple employees

-- Step 7: Report index creation status
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'employees'
AND indexname LIKE '%scan_code%';