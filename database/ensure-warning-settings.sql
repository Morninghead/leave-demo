-- ============================================================================
-- ENSURE WARNING SYSTEM SETTINGS
-- ============================================================================
-- This script ensures warning_system_settings table has:
-- 1. Unique constraint on setting_key
-- 2. Default settings if they don't exist
-- ============================================================================

-- 1. Add unique constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'warning_system_settings_setting_key_key'
    ) THEN
        ALTER TABLE warning_system_settings
        ADD CONSTRAINT warning_system_settings_setting_key_key UNIQUE (setting_key);

        RAISE NOTICE 'Added unique constraint on setting_key';
    ELSE
        RAISE NOTICE 'Unique constraint already exists';
    END IF;
END $$;

-- 2. Insert default settings if they don't exist
INSERT INTO warning_system_settings (setting_key, setting_value, value_type, description_th, description_en)
VALUES
  ('system_enabled', 'true', 'BOOLEAN', 'เปิดใช้งานระบบใบเตือน', 'Enable warning system'),
  ('appeal_deadline_days', '15', 'INTEGER', 'จำนวนวันในการยื่นอุทธรณ์', 'Days to submit appeal'),
  ('warning_expiry_months', '12', 'INTEGER', 'ใบเตือนหมดอายุภายใน (เดือน)', 'Warning expiry period (months)'),
  ('require_signature', 'true', 'BOOLEAN', 'บังคับให้เซ็นรับทราบ', 'Require signature'),
  ('allow_signature_refusal', 'true', 'BOOLEAN', 'อนุญาตให้ปฏิเสธเซ็น', 'Allow signature refusal'),
  ('min_scroll_percentage', '100', 'INTEGER', 'ต้องเลื่อนอ่านขั้นต่ำ (%)', 'Minimum scroll percentage'),
  ('auto_send_email', 'false', 'BOOLEAN', 'ส่งอีเมลอัตโนมัติ', 'Auto send email'),
  ('email_provider', 'console', 'STRING', 'ผู้ให้บริการอีเมล', 'Email provider')
ON CONFLICT (setting_key) DO NOTHING;

-- 3. Verify settings
SELECT
  setting_key,
  setting_value,
  value_type,
  description_th,
  updated_at
FROM warning_system_settings
ORDER BY
  CASE setting_key
    WHEN 'system_enabled' THEN 1
    WHEN 'appeal_deadline_days' THEN 2
    WHEN 'warning_expiry_months' THEN 3
    WHEN 'require_signature' THEN 4
    WHEN 'allow_signature_refusal' THEN 5
    WHEN 'min_scroll_percentage' THEN 6
    WHEN 'auto_send_email' THEN 7
    WHEN 'email_provider' THEN 8
    ELSE 99
  END;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Check constraint exists:
SELECT
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'warning_system_settings'::regclass
  AND conname = 'warning_system_settings_setting_key_key';

-- Count settings:
SELECT COUNT(*) as total_settings
FROM warning_system_settings;

-- ============================================================================
