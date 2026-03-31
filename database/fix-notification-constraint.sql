-- ============================================================================
-- FIX NOTIFICATION TYPE CONSTRAINT
-- ============================================================================
-- This script fixes the CHECK constraint issue on notifications.type column
-- Run this if you get: "violates check constraint chk_notification_type"
-- ============================================================================

-- 1. Drop existing CHECK constraint (if exists)
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS chk_notification_type;

-- 2. Add new CHECK constraint with all allowed values
ALTER TABLE notifications
ADD CONSTRAINT chk_notification_type
CHECK (type IN (
  'leave_request',
  'approval_pending',
  'approved',
  'rejected',
  'shift_swap',
  'system',
  'warning_issued',
  'warning_action',
  'warning_appeal',
  'warning_hr_review'
));

-- 3. Create index on type for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_type
ON notifications(type);

-- 4. Create index on recipient_id for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_recipient
ON notifications(recipient_id);

-- 5. Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
ON notifications(created_at DESC);

-- 6. Verify constraint
SELECT
  constraint_name,
  check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'chk_notification_type';

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this to check if the constraint is working:
-- INSERT INTO notifications (recipient_id, title_th, title_en, message_th, message_en, type)
-- VALUES (
--   '00000000-0000-0000-0000-000000000000',
--   'ทดสอบ',
--   'Test',
--   'ข้อความทดสอบ',
--   'Test message',
--   'warning_action'
-- );
-- ============================================================================
