-- Migration: Add void columns to leave_requests table
-- Run this migration to support voiding approved leave requests

-- Add void_reason column if it doesn't exist
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- Add voided_by column (references employees.id)
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES employees(id);

-- Add voided_at timestamp
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP;

-- Add 'voided' to status check constraint if not already present
-- First, drop the existing constraint
DO $$ 
BEGIN
    -- Try to drop the existing constraint (may fail if doesn't exist)
    ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_status_check;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- Create new check constraint with 'voided' status
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_status_check 
    CHECK (status IN ('pending', 'approved', 'rejected', 'canceled', 'voided'));

-- Add index for querying voided requests
CREATE INDEX IF NOT EXISTS idx_leave_requests_voided ON leave_requests(voided_at) WHERE status = 'voided';

-- Comment for documentation
COMMENT ON COLUMN leave_requests.void_reason IS 'Reason for voiding an approved leave request (HR/Admin only)';
COMMENT ON COLUMN leave_requests.voided_by IS 'ID of user who voided the request';
COMMENT ON COLUMN leave_requests.voided_at IS 'Timestamp when the request was voided';
