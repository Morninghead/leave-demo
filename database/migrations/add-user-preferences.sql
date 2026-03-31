-- Migration: Add User Preferences Table
-- Date: 2025-01-11
-- Purpose: Allow employees to manage their notification preferences (email opt-out)

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  -- Email notification preferences
  email_notifications_enabled BOOLEAN DEFAULT true,
  email_leave_balance_alerts BOOLEAN DEFAULT true,
  email_leave_approval_updates BOOLEAN DEFAULT true,
  email_shift_swap_updates BOOLEAN DEFAULT true,

  -- Language preference
  preferred_language VARCHAR(5) DEFAULT 'th', -- 'th' or 'en'

  -- Dashboard preferences
  dashboard_refresh_interval INTEGER DEFAULT 300, -- seconds
  dashboard_widgets JSONB DEFAULT '[]',

  -- Timezone
  timezone VARCHAR(50) DEFAULT 'Asia/Bangkok',

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one preference record per employee
  UNIQUE(employee_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_user_preferences_employee_id ON user_preferences(employee_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_email_enabled ON user_preferences(email_notifications_enabled);

-- Add comment
COMMENT ON TABLE user_preferences IS 'User notification and display preferences';

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER trigger_update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();

-- Create default preferences for existing employees
INSERT INTO user_preferences (employee_id, email_notifications_enabled)
SELECT id, true
FROM employees
WHERE is_active = true
ON CONFLICT (employee_id) DO NOTHING;

-- Success message
SELECT 'User preferences table created successfully!' as message;
SELECT COUNT(*) || ' default preference records created' as message FROM user_preferences;
