# Current Database Schema Documentation

**Last Updated:** 2025-11-18
**Source:** Production Database Export (Neon PostgreSQL)

## Table: `notifications`

**Purpose:** Store system notifications for users across different modules (leave, warnings, approvals, etc.)

### Columns:

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | NO | `uuid_generate_v4()` | Primary key |
| `recipient_id` | UUID | NO | - | User receiving the notification (FK to employees.id) |
| `sender_id` | UUID | YES | - | User who triggered the notification (FK to employees.id) |
| `type` | VARCHAR | NO | - | Notification type (see allowed values below) |
| `title_th` | VARCHAR | NO | - | Thai title |
| `title_en` | VARCHAR | NO | - | English title |
| `message_th` | TEXT | NO | - | Thai message |
| `message_en` | TEXT | NO | - | English message |
| `reference_id` | UUID | YES | - | Related record ID (e.g., leave_request_id, warning_notice_id) |
| `reference_type` | VARCHAR | YES | - | Related record type (e.g., 'leave_request', 'warning_notice') |
| `is_read` | BOOLEAN | YES | `false` | Read status |
| `read_at` | TIMESTAMP | YES | - | Timestamp when read |
| `slack_sent` | BOOLEAN | YES | `false` | Slack notification sent |
| `slack_sent_at` | TIMESTAMP | YES | - | Slack sent timestamp |
| `email_sent` | BOOLEAN | YES | `false` | Email notification sent |
| `email_sent_at` | TIMESTAMP | YES | - | Email sent timestamp |
| `created_at` | TIMESTAMP | YES | `CURRENT_TIMESTAMP` | Creation timestamp |

### Allowed `type` Values:

```sql
CHECK (type IN (
  'leave_request',      -- Leave request submitted
  'approval_pending',   -- Awaiting approval
  'approved',           -- Request approved
  'rejected',           -- Request rejected
  'shift_swap',         -- Shift swap notification
  'system',             -- System notification
  'warning_issued',     -- Warning notice issued
  'warning_action',     -- Warning acknowledged/refused
  'warning_appeal',     -- Warning appeal submitted
  'warning_hr_review'   -- Warning HR review completed
))
```

### Indexes:

- Primary Key: `id`
- Performance: `idx_notifications_recipient` on `recipient_id`
- Performance: `idx_notifications_type` on `type`
- Performance: `idx_notifications_created_at` on `created_at DESC`

### Foreign Keys:

- `recipient_id` → `employees(id)`
- `sender_id` → `employees(id)`

---

## Common Notification Patterns:

### 1. Leave Request Notification
```sql
INSERT INTO notifications (
  recipient_id,
  sender_id,
  type,
  title_th,
  title_en,
  message_th,
  message_en,
  reference_id,
  reference_type
) VALUES (
  'approver-uuid',
  'employee-uuid',
  'leave_request',
  'มีคำขอลาใหม่',
  'New Leave Request',
  'พนักงาน X ขอลาวันที่...',
  'Employee X requested leave on...',
  'leave-request-uuid',
  'leave_request'
);
```

### 2. Warning Acknowledgement Notification
```sql
INSERT INTO notifications (
  recipient_id,
  sender_id,
  type,
  title_th,
  title_en,
  message_th,
  message_en,
  reference_id,
  reference_type
) VALUES (
  'issuer-uuid',
  'employee-uuid',
  'warning_action',
  'พนักงานรับทราบใบเตือน',
  'Employee acknowledged warning',
  'พนักงานได้รับทราบใบเตือนเลขที่ WN-2568-0001 แล้ว',
  'Employee has acknowledged warning notice WN-2568-0001',
  'warning-notice-uuid',
  'warning_notice'
);
```

---

## Migration Required

If you see error: **"violates check constraint chk_notification_type"**

Run this SQL script: `database/fix-notification-constraint.sql`

```bash
# Using Neon CLI or psql:
psql -h your-neon-host.neon.tech -d neondb -U your-user -f database/fix-notification-constraint.sql
```

---

## Notes:

1. **Schema Mismatch:** The `init-schema.sql` file shows `notification_type` but actual database uses `type`
2. **UUID vs INTEGER:** Database uses UUID for all foreign keys (not INTEGER as in some schema files)
3. **Constraints:** CHECK constraints may not be exported in JSON dumps - always verify with:
   ```sql
   SELECT * FROM information_schema.check_constraints
   WHERE constraint_schema = 'public';
   ```

---

**Related Files:**
- Production Schema Export: `wild-waterfall-55012189_production_neondb_2025-11-18_13-06-22.json`
- Fix Script: `database/fix-notification-constraint.sql`
- Init Schema: `database/init-schema.sql` (may be outdated)
