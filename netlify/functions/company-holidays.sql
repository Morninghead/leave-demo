-- Company Holidays Database Schema
-- This file creates the company_holidays table with comprehensive holiday management features

-- Create company_holidays table
CREATE TABLE IF NOT EXISTS company_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL,
  name_th TEXT NOT NULL,
  name_en TEXT NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_type VARCHAR(20) DEFAULT 'none',
  recurrence_config JSONB DEFAULT NULL,
  holiday_type VARCHAR(20) DEFAULT 'company',
  is_active BOOLEAN DEFAULT true,
  notify_days_before INTEGER DEFAULT 7,
  notification_message TEXT DEFAULT NULL,
  location TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES employees(id),
  -- Optional: Department restrictions for multi-tenant scenarios
  departments UUID[] DEFAULT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_holidays_date ON company_holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_company_holidays_type ON company_holidays(holiday_type);
CREATE INDEX IF NOT EXISTS idx_company_holidays_active ON company_holidays(is_active, holiday_date);

-- Add unique constraint to prevent duplicate holidays
ALTER TABLE company_holidays
ADD CONSTRAINT IF NOT EXISTS unique_holiday_date_type
UNIQUE (holiday_date, holiday_type);

-- Insert sample company holidays for testing
INSERT INTO company_holidays (id, holiday_date, name_th, name_en, is_recurring, recurrence_type, recurrence_config, holiday_type, is_active, notify_days_before, notification_message, location, created_by) VALUES
('550e8400-e29b-41b8-a75a-cc6', '2025-01-01', 'วันขึ้นปีใหม่', 'New Year''s Day', false, 'none', NULL, 'company', true, 7, 'Happy New Year!', NULL, (SELECT id FROM employees LIMIT 1)),
('550e8400-e29b-41b8-a75a-cc7', '2025-02-14', 'วันวาเลนไทน์', 'Valentine''s Day', false, 'none', NULL, 'company', true, 7, 'Valentine''s Day', NULL, (SELECT id FROM employees LIMIT 1)),
('550e8400-e29b-41b8-a75a-cc8', '2025-04-13', 'วันสงกรานต์', 'Songkran Festival', false, 'none', NULL, 'company', true, 7, 'Happy Songkran Festival!', NULL, (SELECT id FROM employees LIMIT 1))
ON CONFLICT (id) DO NOTHING;

-- Insert annual recurring holiday template (Chinese New Year)
INSERT INTO company_holidays (id, holiday_date, name_th, name_en, is_recurring, recurrence_type, recurrence_config, holiday_type, is_active, notify_days_before, notification_message, location, created_by) VALUES
('550e8400-e29b-41b8-a75a-cc9', '2025-01-29', 'วันตรุษจีน', 'Chinese New Year', true, 'yearly', NULL, 'company', true, 7, 'Chinese New Year', NULL, (SELECT id FROM employees LIMIT 1))
ON CONFLICT (id) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE company_holidays IS 'Company holidays management table with multi-language support and recurring patterns';
COMMENT ON COLUMN company_holidays.holiday_date IS 'Date of the holiday in YYYY-MM-DD format';
COMMENT ON COLUMN company_holidays.name_th IS 'Holiday name in Thai language';
COMMENT ON COLUMN company_holidays.name_en IS 'Holiday name in English language';
COMMENT ON COLUMN company_holidays.is_recurring IS 'Whether this holiday recurs yearly/monthly';
COMMENT ON COLUMN company_holidays.recurrence_type IS 'Type of recurrence: none, yearly, monthly, custom';
COMMENT ON COLUMN company_holidays.recurrence_config IS 'JSON configuration for custom recurrence patterns';
COMMENT ON COLUMN company_holidays.holiday_type IS 'Type of holiday: company, public, religious';
COMMENT ON COLUMN company_holidays.notify_days_before IS 'Number of days to notify employees before holiday';
COMMENT ON COLUMN company_holidays.departments IS 'Array of department IDs if holiday applies to specific departments only';

-- Add trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_company_holidays_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS update_company_holidays_timestamp
BEFORE UPDATE ON company_holidays
FOR EACH ROW
EXECUTE update_company_holidays_timestamp();

-- Grant permissions to relevant roles
-- Note: Adjust role names as needed for your specific system
-- GRANT SELECT, INSERT, UPDATE, DELETE ON company_holidays TO hr_role;
-- GRANT SELECT ON company_holidays TO manager_role;
-- GRANT SELECT ON company_holidays TO employee_role;