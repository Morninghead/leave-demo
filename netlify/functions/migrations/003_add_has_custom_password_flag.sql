-- Add flag to track if user has set a custom password
-- This will disable national ID fallback for users who have set custom passwords
ALTER TABLE employees
ADD COLUMN has_custom_password BOOLEAN DEFAULT FALSE;

-- Add comment to explain the purpose
COMMENT ON COLUMN employees.has_custom_password IS 'Indicates if user has set a custom password. When TRUE, national ID authentication is disabled.';

-- Update existing users who already have password hashes to set has_custom_password = TRUE
-- This assumes that existing password hashes were set by users intentionally
UPDATE employees
SET has_custom_password = TRUE
WHERE password_hash IS NOT NULL AND password_hash != '';

-- Create index for performance
CREATE INDEX idx_employees_has_custom_password ON employees(has_custom_password);

-- Add index for login queries
CREATE INDEX idx_employees_employee_code_active ON employees(employee_code) WHERE is_active = true;