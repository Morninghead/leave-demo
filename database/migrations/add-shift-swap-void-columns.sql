-- Migration: Add void columns to shift_swap_requests table
-- Run this migration to support voiding approved shift swap requests

-- Add void_reason column if it doesn't exist
ALTER TABLE shift_swap_requests ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- Add voided_by column (references employees.id)
ALTER TABLE shift_swap_requests ADD COLUMN IF NOT EXISTS voided_by INTEGER REFERENCES employees(id);

-- Add voided_at timestamp
ALTER TABLE shift_swap_requests ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP;

-- Add 'voided' to status check constraint if not already present
-- First, drop the existing constraint
DO $$ 
BEGIN
    -- Try to drop the existing constraint (may fail if doesn't exist)
    ALTER TABLE shift_swap_requests DROP CONSTRAINT IF EXISTS shift_swap_requests_status_check;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- Create new check constraint with 'voided' status
ALTER TABLE shift_swap_requests ADD CONSTRAINT shift_swap_requests_status_check 
    CHECK (status IN ('pending', 'approved', 'rejected', 'canceled', 'voided'));

-- Add index for querying voided requests
CREATE INDEX IF NOT EXISTS idx_shift_swap_requests_voided ON shift_swap_requests(voided_at) WHERE status = 'voided';

-- Comment for documentation
COMMENT ON COLUMN shift_swap_requests.void_reason IS 'Reason for voiding an approved shift swap request (HR/Admin only)';
COMMENT ON COLUMN shift_swap_requests.voided_by IS 'ID of user who voided the request';
COMMENT ON COLUMN shift_swap_requests.voided_at IS 'Timestamp when the request was voided';
