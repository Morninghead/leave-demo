-- Migration: Add password security settings to company_settings
-- File: netlify/functions/migrations/002_add_password_security_settings.sql

-- Insert password security settings into company_settings table
INSERT INTO company_settings (setting_key, setting_value, description) VALUES
('force_password_change_on_first_login', 'false', 'Force employees to change password on first login'),
('password_min_length', '8', 'Minimum password length requirement'),
('password_require_uppercase', 'true', 'Require uppercase letters in passwords'),
('password_require_lowercase', 'true', 'Require lowercase letters in passwords'),
('password_require_numbers', 'true', 'Require numbers in passwords'),
('password_require_special_chars', 'true', 'Require special characters in passwords'),
('password_expiry_days', '90', 'Number of days before password expires (0 = never expires)')
ON CONFLICT (setting_key) DO UPDATE SET
  description = EXCLUDED.description;

-- Add password-related columns to employees table if they don't exist
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS salt VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Create index for password-related queries
CREATE INDEX IF NOT EXISTS idx_employees_password_change ON employees(must_change_password, is_active);
CREATE INDEX IF NOT EXISTS idx_employees_password_changed_at ON employees(password_changed_at);

-- Add password policy audit log table
CREATE TABLE IF NOT EXISTS password_change_logs (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(36) NOT NULL REFERENCES employees(id),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(36) REFERENCES employees(id), -- NULL for self-change
    change_reason TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_change_logs_employee ON password_change_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_password_change_logs_date ON password_change_logs(changed_at);