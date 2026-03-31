
import { schedule } from '@netlify/functions';
import { sql } from './utils/db';

/**
 * Warning Notice Timeout Scheduler
 * specific: This function runs automatically to check for expired warning notices.
 * Schedule: Runs every day at midnight (cron: 0 0 * * *)
 */
const handler = schedule('0 0 * * *', async () => {
    console.log('⏰ Starting Warning Timeout Scheduler...');

    try {
        // 1. Get Acknowledgement Deadline from settings
        const [settingResult] = await sql`
      SELECT setting_value 
      FROM warning_system_settings 
      WHERE setting_key = 'acknowledgement_deadline_days'
    ` as any;

        // Default to 7 days if not set
        const deadlineDays = parseInt(settingResult?.setting_value || '7', 10);
        console.log(`ℹ️ Acknowledgement deadline: ${deadlineDays} days`);

        // 2. Find expired warnings
        // Status must be PENDING_ACKNOWLEDGMENT (specifically waiting for employee)
        // Created more than deadlineDays ago
        const expiredWarnings = await sql`
      SELECT id, notice_number, employee_id, issued_by
      FROM warning_notices
      WHERE status = 'PENDING_ACKNOWLEDGMENT'
      AND created_at < NOW() - (${deadlineDays} || ' days')::INTERVAL
    ` as any;

        console.log(`🔍 Found ${expiredWarnings?.length || 0} expired warnings`);

        if (!expiredWarnings || expiredWarnings.length === 0) {
            console.log('✅ No expired warnings found. Scheduler finished.');
            return { statusCode: 200 };
        }

        // 3. Process each expired warning
        let successCount = 0;
        let errorCount = 0;

        for (const warning of expiredWarnings) {
            try {
                await sql.begin(async (sql) => {
                    // A. Insert refusal record (System Refusal)
                    const refuseReason = 'ระบบปิดอัตโนมัติ: หมดเวลาการรับทราบ (Auto-closed: Timeout)';
                    const now = new Date();

                    await sql`
            INSERT INTO warning_acknowledgements (
              warning_notice_id,
              employee_id,
              action_type,
              refused_at,
              refuse_reason_th,
              signature_refused,
              ip_address,
              user_agent
            ) VALUES (
              ${warning.id},
              ${warning.employee_id},
              'REFUSED',
              ${now},
              ${refuseReason},
              true,
              '127.0.0.1',
              'System Scheduler'
            )
          `;

                    // B. Update Warning Status
                    await sql`
            UPDATE warning_notices
            SET 
              status = 'SIGNATURE_REFUSED',
              is_active = true,
              updated_at = NOW()
            WHERE id = ${warning.id}
          `;

                    // C. Log Audit Trail
                    await sql`
            INSERT INTO warning_audit_logs (
              warning_notice_id,
              action,
              performed_by,
              ip_address,
              changes,
              notes
            ) VALUES (
              ${warning.id},
              'SYSTEM_AUTO_CLOSE',
              NULL, -- System action
              '127.0.0.1',
              ${JSON.stringify({ reason: 'Timeout', deadline_days: deadlineDays })}::jsonb,
              'ระบบปิดงานอัตโนมัติเนื่องจากพนักงานไม่รับทราบภายในกำหนด'
            )
          `;

                    // D. Notification (Optional - to Issuer/HR)
                    // We'll skip complex notification logic here for simplicity, 
                    // but in production you'd want to notify the manager.
                    await sql`
           INSERT INTO notifications (
             employee_id,
             title_th,
             title_en,
             message_th,
             message_en,
             notification_type,
             related_id,
             related_type,
             is_read
           ) VALUES (
             ${warning.issued_by},
             'ใบเตือนหมดเวลาการรับทราบ',
             'Warning notice timed out',
             ${`ใบเตือนเลขที่ ${warning.notice_number} ถูกระบบปิดงานอัตโนมัติเนื่องจากครบกำหนดเวลา`},
             ${`Warning notice ${warning.notice_number} has been auto-closed due to acknowledgement timeout`},
             'warning',
             ${warning.id},
             'warning_notice',
             false
           )
          `;
                });

                console.log(`✅ Successfully closed warning ${warning.notice_number}`);
                successCount++;
            } catch (err) {
                console.error(`❌ Failed to process warning ${warning.notice_number}:`, err);
                errorCount++;
            }
        }

        console.log(`🏁 Timeout Scheduler Finished. Success: ${successCount}, Errors: ${errorCount}`);
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, processed: successCount, errors: errorCount }),
        };

    } catch (error: any) {
        console.error('❌ Critical Scheduler Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: error.message }),
        };
    }
});

export { handler };
