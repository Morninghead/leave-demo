-- Migration: Add missing pending_days column to leave_balances table
-- This column is used throughout the codebase but was missing from the original schema

-- Add pending_days column if it doesn't exist
ALTER TABLE leave_balances
ADD COLUMN IF NOT EXISTS pending_days DECIMAL(10, 2) DEFAULT 0;

-- Update any existing records to ensure pending_days is not NULL
UPDATE leave_balances
SET pending_days = 0
WHERE pending_days IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN leave_balances.pending_days IS 'Days currently pending approval (reserved from balance)';