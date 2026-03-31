-- Migration: Add probation-based annual leave fields
-- Adds probation tracking and pro-rata calculation support

-- Add probation fields to leave_policies table (Thailand labor law: 120 days probation)
ALTER TABLE leave_policies
ADD COLUMN probation_days INTEGER DEFAULT 120,
ADD COLUMN annual_leave_after_probation INTEGER DEFAULT 6,
ADD COLUMN minimum_entitlement_date DATE;

-- Add probation calculation fields to leave_balances table  
ALTER TABLE leave_balances
ADD COLUMN probation_end_date DATE,
ADD COLUMN is_probation_complete BOOLEAN DEFAULT false,
ADD COLUMN pro_rata_months DECIMAL(5,2) DEFAULT 0,
ADD COLUMN pro_rata_days DECIMAL(5,2) DEFAULT 0;

-- Update existing leave_balances with probation calculations (Thailand: 120 days)
UPDATE leave_balances
SET
  probation_end_date = (
    SELECT (e.hire_date + INTERVAL '120 days')::DATE
    FROM employees e
    WHERE e.id = leave_balances.employee_id
  ),
  is_probation_complete = (
    SELECT (e.hire_date + INTERVAL '120 days')::DATE <= CURRENT_DATE
    FROM employees e
    WHERE e.id = leave_balances.employee_id
  ),
  pro_rata_months = CASE
    WHEN (e.hire_date + INTERVAL '120 days')::DATE <= CURRENT_DATE THEN
      -- Calculate months from probation end date to year end
      EXTRACT(MONTH FROM AGE((e.hire_date + INTERVAL '120 days')::DATE, DATE_TRUNC('year', CURRENT_DATE))) +
      EXTRACT(DAY FROM (e.hire_date + INTERVAL '120 days')::DATE) / 30
    ELSE 0
  END,
  pro_rata_days = CASE
    WHEN (e.hire_date + INTERVAL '120 days')::DATE <= CURRENT_DATE THEN
      -- Thailand pro-rata: (months_worked / 12) * 6 days annual leave
      ROUND(
        (
          (EXTRACT(MONTH FROM AGE((e.hire_date + INTERVAL '120 days')::DATE, DATE_TRUNC('year', CURRENT_DATE))) +
          EXTRACT(DAY FROM (e.hire_date + INTERVAL '120 days')::DATE) / 30
        ) / 12 *
        COALESCE(
          (SELECT annual_leave_after_probation FROM leave_policies lp
           WHERE lp.leave_type_id = leave_balances.leave_type_id
           AND lp.is_active = true
           LIMIT 1), 6
        ), 2
      )
    ELSE 0
  END
FROM employees e
WHERE e.id = leave_balances.employee_id;

-- Update total_days to use pro-rata calculation for annual leave
UPDATE leave_balances 
SET total_days = CASE 
  WHEN lt.code = 'ANNUAL' AND lb.is_probation_complete = true THEN 
    lb.pro_rata_days
  ELSE 
    lb.total_days
  END
FROM leave_balances lb
JOIN leave_types lt ON lb.leave_type_id = lt.id
WHERE lt.code = 'ANNUAL';

-- Add index for performance
CREATE INDEX idx_leave_balances_probation ON leave_balances(is_probation_complete);
CREATE INDEX idx_leave_policies_probation ON leave_policies(probation_days, annual_leave_after_probation);

-- Update existing leave_policies to set Thailand probation defaults for annual leave
UPDATE leave_policies
SET
  probation_days = 120,
  annual_leave_after_probation = 6
WHERE leave_type_id = (
  SELECT id FROM leave_types WHERE code = 'ANNUAL'
) AND is_active = true;

-- Add comment to document the changes (Thailand labor law compliance)
COMMENT ON COLUMN leave_policies.probation_days IS 'Thailand: 120 days probation before leave entitlement starts';
COMMENT ON COLUMN leave_policies.annual_leave_after_probation IS 'Thailand: 6 days annual leave after probation completion';
COMMENT ON COLUMN leave_policies.minimum_entitlement_date IS 'Minimum date when leave entitlement becomes active (overrides probation end date)';
COMMENT ON COLUMN leave_balances.probation_end_date IS 'Thailand: Calculated end date of 120-day probation period';
COMMENT ON COLUMN leave_balances.is_probation_complete IS 'Whether employee has completed 120-day probation';
COMMENT ON COLUMN leave_balances.pro_rata_months IS 'Thailand: Months worked in current year for pro-rata calculation (>15 days = full month)';
COMMENT ON COLUMN leave_balances.pro_rata_days IS 'Thailand: Calculated pro-rata leave days (months_worked/12 * 6 days)';