-- Migration: Fix void columns type (INT to UUID) for leave_requests table
-- Run this if you previously ran the migration with INTEGER type

-- 1. Drop and recreate voided_by column with correct UUID type
DO $$ 
BEGIN
    -- Check if voided_by exists and is wrong type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leave_requests' AND column_name = 'voided_by' AND data_type = 'integer'
    ) THEN
        ALTER TABLE leave_requests DROP COLUMN voided_by;
        ALTER TABLE leave_requests ADD COLUMN voided_by UUID REFERENCES employees(id);
        RAISE NOTICE 'Fixed voided_by column type from INTEGER to UUID';
    END IF;
END $$;

-- 2. Ensure all columns exist with correct types
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS void_reason TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES employees(id);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP;

-- 3. Ensure 'voided' status is in the check constraint
DO $$ 
BEGIN
    ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_status_check;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- Create new check constraint with 'voided' status
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_status_check 
    CHECK (status IN ('pending', 'approved', 'rejected', 'canceled', 'voided', 'department_approved'));

-- 4. Add index for querying voided requests
CREATE INDEX IF NOT EXISTS idx_leave_requests_voided ON leave_requests(voided_at) WHERE status = 'voided';

COMMENT ON COLUMN leave_requests.void_reason IS 'Reason for voiding an approved leave request (HR/Admin only)';
COMMENT ON COLUMN leave_requests.voided_by IS 'UUID of user who voided the request';
COMMENT ON COLUMN leave_requests.voided_at IS 'Timestamp when the request was voided';

SELECT 'Migration complete: leave_requests void columns fixed' AS result;
