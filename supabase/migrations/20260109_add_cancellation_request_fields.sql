-- Migration: Add Leave Cancellation Request Fields
-- This enables the workflow where employees can REQUEST cancellation of approved leave,
-- but HR must approve the cancellation before balance is restored.

-- Add cancellation request fields
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS cancellation_requested_by UUID REFERENCES employees(id),
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancellation_approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS cancellation_approved_by UUID REFERENCES employees(id),
ADD COLUMN IF NOT EXISTS cancellation_rejected_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS cancellation_rejected_by UUID REFERENCES employees(id),
ADD COLUMN IF NOT EXISTS cancellation_rejection_reason TEXT;

-- Add index for quick filtering of cancellation_pending requests
CREATE INDEX IF NOT EXISTS idx_leave_requests_cancellation_pending 
ON leave_requests(status) 
WHERE status = 'cancellation_pending';

-- Comment for documentation
COMMENT ON COLUMN leave_requests.cancellation_requested_at IS 'Timestamp when employee requested cancellation';
COMMENT ON COLUMN leave_requests.cancellation_reason IS 'Employee reason for requesting cancellation (required)';
COMMENT ON COLUMN leave_requests.cancellation_rejection_reason IS 'HR reason for rejecting cancellation (required if rejected)';
