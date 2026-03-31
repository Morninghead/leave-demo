-- Migration: Add Email Logs Table
-- Date: 2025-01-11
-- Purpose: Track email alerts sent by the system for audit and debugging

-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id SERIAL PRIMARY KEY,
  recipient VARCHAR(500) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  email_type VARCHAR(100) NOT NULL, -- 'leave_balance_alert_high', 'leave_balance_alert_medium', etc.
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster querying
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_success ON email_logs(success);

-- Add comment
COMMENT ON TABLE email_logs IS 'Audit log of all emails sent by the system';

-- Insert sample email alert settings (if not exists)
INSERT INTO company_settings (setting_key, setting_value, description)
VALUES
  ('email_alert_enabled', 'false', 'Enable or disable email alerts globally')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO company_settings (setting_key, setting_value, description)
VALUES
  ('email_alert_low_balance_threshold', '20', 'Low balance threshold percentage (0-100)')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO company_settings (setting_key, setting_value, description)
VALUES
  ('email_alert_high_unused_threshold', '80', 'High unused leave threshold percentage (0-100)')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO company_settings (setting_key, setting_value, description)
VALUES
  ('email_alert_expiring_leave_months', '3', 'Months before year-end to trigger expiring leave alert')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO company_settings (setting_key, setting_value, description)
VALUES
  ('email_alert_sender_email', 'noreply@company.com', 'Sender email address for alerts')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO company_settings (setting_key, setting_value, description)
VALUES
  ('email_alert_sender_name', 'HR Leave System', 'Sender name for alerts')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO company_settings (setting_key, setting_value, description)
VALUES
  ('email_alert_reply_to_email', 'hr@company.com', 'Reply-to email address')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO company_settings (setting_key, setting_value, description)
VALUES
  ('email_alert_frequency', 'weekly', 'Alert frequency: daily, weekly, or monthly')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO company_settings (setting_key, setting_value, description)
VALUES
  ('email_alert_day_of_week', '1', 'Day of week for weekly alerts (0-6, Sunday-Saturday)')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO company_settings (setting_key, setting_value, description)
VALUES
  ('email_alert_day_of_month', '1', 'Day of month for monthly alerts (1-31)')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO company_settings (setting_key, setting_value, description)
VALUES
  ('email_alert_send_to_employee', 'true', 'Send alerts to employees')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO company_settings (setting_key, setting_value, description)
VALUES
  ('email_alert_send_to_manager', 'true', 'Send alerts to managers')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO company_settings (setting_key, setting_value, description)
VALUES
  ('email_alert_send_to_hr', 'true', 'Send alerts to HR team')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO company_settings (setting_key, setting_value, description)
VALUES
  ('email_alert_cc_emails', '[]', 'Additional CC email addresses (JSON array)')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO company_settings (setting_key, setting_value, description)
VALUES
  ('email_alert_subject_template', '[HR Alert] Leave Balance Notification', 'Email subject template')
ON CONFLICT (setting_key) DO NOTHING;

-- Success message
SELECT 'Email logs table and settings created successfully!' as message;
