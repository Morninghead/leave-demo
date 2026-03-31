-- Migration: Add year and swap_count_for_year columns to shift_swap_requests
-- Date: 2025-12-15
-- Description: Add columns needed for annual swap limit tracking (Thailand labor law: 12 swaps/year)

-- Add year column to track which year the swap request belongs to
ALTER TABLE shift_swap_requests
ADD COLUMN IF NOT EXISTS year INTEGER;

-- Add swap_count_for_year column to track the running count for the employee in that year
ALTER TABLE shift_swap_requests
ADD COLUMN IF NOT EXISTS swap_count_for_year INTEGER DEFAULT 0;

-- Backfill year column for existing records based on work_date
UPDATE shift_swap_requests
SET year = EXTRACT(YEAR FROM work_date)::INTEGER
WHERE year IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN shift_swap_requests.year IS 'Year of the shift swap request (for annual limit tracking, Thailand labor law: 12 swaps/year)';
COMMENT ON COLUMN shift_swap_requests.swap_count_for_year IS 'Running count of approved swaps for the employee in this year';

-- Create index for efficient querying by employee and year
CREATE INDEX IF NOT EXISTS idx_shift_swap_requests_employee_year 
ON shift_swap_requests(employee_id, year);

-- Recalculate swap_count_for_year for existing approved records
WITH swap_counts AS (
  SELECT 
    id,
    employee_id,
    year,
    ROW_NUMBER() OVER (
      PARTITION BY employee_id, year 
      ORDER BY created_at
    ) as swap_number
  FROM shift_swap_requests
  WHERE status = 'approved' AND year IS NOT NULL
)
UPDATE shift_swap_requests ssr
SET swap_count_for_year = sc.swap_number
FROM swap_counts sc
WHERE ssr.id = sc.id;
