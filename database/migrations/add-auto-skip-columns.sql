-- Migration: Add auto-skip columns to leave_requests and shift_swap_requests
-- Date: 2025-11-15
-- Description: Add skipped_stages and auto_skip_reason columns to support auto-skip approval flow

-- Add columns to leave_requests table
ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS skipped_stages JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS auto_skip_reason TEXT;

-- Add columns to shift_swap_requests table
ALTER TABLE shift_swap_requests
ADD COLUMN IF NOT EXISTS skipped_stages JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS auto_skip_reason TEXT;

-- Add comments for documentation
COMMENT ON COLUMN leave_requests.skipped_stages IS 'Array of approval stages that were automatically skipped (e.g., [1, 2])';
COMMENT ON COLUMN leave_requests.auto_skip_reason IS 'Reason why stages were skipped (e.g., "Requester is department admin")';
COMMENT ON COLUMN shift_swap_requests.skipped_stages IS 'Array of approval stages that were automatically skipped (e.g., [1, 2])';
COMMENT ON COLUMN shift_swap_requests.auto_skip_reason IS 'Reason why stages were skipped (e.g., "Requester is department admin")';
