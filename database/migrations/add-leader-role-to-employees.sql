-- Add leader as a valid employee role.
-- This supports production line leaders who handle probation evaluations.

ALTER TABLE employees
DROP CONSTRAINT IF EXISTS chk_employee_role;

ALTER TABLE employees
ADD CONSTRAINT chk_employee_role
CHECK (
  role IN ('employee', 'leader', 'manager', 'admin', 'hr', 'developer')
);
