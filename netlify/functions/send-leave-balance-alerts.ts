/**
 * Automated Leave Balance Email Alerts
 *
 * This function sends automated email alerts to employees with high-risk leave balances
 * Can be triggered manually or scheduled via cron job
 *
 * Usage:
 * - Manual: Call /.netlify/functions/send-leave-balance-alerts
 * - Scheduled: Set up Netlify scheduled function or external cron
 */

import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import {
  areEmailAlertsEnabled,
  getEmailAlertSettings,
  generateLeaveBalanceAlertEmail,
  sendEmail,
  logEmailSent
} from './utils/email-service';

interface EmployeeWithRisk {
  employee_id: string;
  employee_code: string;
  employee_name_th: string;
  employee_name_en: string;
  employee_email: string;
  manager_email: string | null;
  department_name_th: string;
  department_name_en: string;
  leave_balances: any[];
  risk_flags: any;
  risk_level: 'high' | 'medium' | 'low';
}

/**
 * Get employees who need to receive email alerts
 */
async function getEmployeesForAlerts(): Promise<EmployeeWithRisk[]> {
  try {
    const settings = await getEmailAlertSettings();

    // Get all active employees with their leave balances
    const employees = await query(`
      SELECT
        e.id as employee_id,
        e.employee_code,
        e.first_name_th,
        e.last_name_th,
        e.first_name_en,
        e.last_name_en,
        e.email as employee_email,
        e.hire_date,
        d.name_th as department_name_th,
        d.name_en as department_name_en,
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.hire_date)) +
        EXTRACT(MONTH FROM AGE(CURRENT_DATE, e.hire_date)) / 12.0 as years_of_service
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.is_active = true
        AND e.email IS NOT NULL
        AND e.email != ''
      ORDER BY e.employee_code
    `);

    const employeesWithRisk: EmployeeWithRisk[] = [];

    for (const emp of employees) {
      // Get leave balances
      const balances = await query(`
        SELECT
          lt.code as leave_type_code,
          lt.name_th as leave_type_name_th,
          lt.name_en as leave_type_name_en,
          COALESCE(lb.total_days, 0) as allocated_days,
          COALESCE(lb.used_days, 0) as used_days,
          COALESCE(lb.remaining_days, 0) as remaining_days
        FROM leave_types lt
        LEFT JOIN leave_balances lb ON lt.id = lb.leave_type_id
          AND lb.employee_id = $1
          AND lb.year = EXTRACT(YEAR FROM CURRENT_DATE)
        WHERE lt.is_active = true
          AND lt.code IN ('VAC', 'SICK', 'PL')
        ORDER BY lt.sort_order
      `, [emp.employee_id]);

      // Calculate risk
      const annualLeave = balances.find((lb: any) => lb.leave_type_code === 'VAC');
      let riskLevel: 'high' | 'medium' | 'low' = 'low';
      const riskMessages: string[] = [];
      let lowBalanceWarning = false;
      let highUnusedWarning = false;
      let expiringLeaveAlert = false;

      if (annualLeave && annualLeave.allocated_days > 0) {
        const remainingPercentage = annualLeave.remaining_days / annualLeave.allocated_days;
        const usedPercentage = annualLeave.used_days / annualLeave.allocated_days;

        // Low balance check
        const lowThreshold = (settings.low_balance_threshold || 20) / 100;
        if (remainingPercentage < lowThreshold) {
          lowBalanceWarning = true;
          riskLevel = 'high';
          riskMessages.push(
            `คุณมีวันลาพักร้อนคงเหลือน้อย (${annualLeave.remaining_days.toFixed(1)}/${annualLeave.allocated_days} วัน)`
          );
        }

        // High unused check
        const highUnusedThreshold = (settings.high_unused_threshold || 80) / 100;
        if (usedPercentage < (1 - highUnusedThreshold) && emp.years_of_service > 1) {
          highUnusedWarning = true;
          if (riskLevel === 'low') riskLevel = 'medium';
          riskMessages.push(
            `คุณมีวันลาคงเหลือจำนวนมาก (ใช้ไปเพียง ${annualLeave.used_days.toFixed(1)}/${annualLeave.allocated_days} วัน)`
          );
        }

        // Expiring leave check
        const currentMonth = new Date().getMonth() + 1;
        const monthsUntilYearEnd = 12 - currentMonth;
        const expiringMonths = settings.expiring_leave_months || 3;
        if (remainingPercentage > 0.50 && monthsUntilYearEnd < expiringMonths) {
          expiringLeaveAlert = true;
          if (riskLevel === 'low') riskLevel = 'medium';
          riskMessages.push(
            `วันลาของคุณอาจหมดอายุในอีก ${monthsUntilYearEnd} เดือน`
          );
        }
      }

      // Only include employees with medium or high risk
      if (riskLevel !== 'low') {
        // Get manager email if needed
        let managerEmail = null;
        if (settings.send_to_manager) {
          const managerData = await query(`
            SELECT m.email
            FROM employees e
            INNER JOIN employees m ON e.department_id = m.department_id
            WHERE e.id = $1
              AND m.is_department_manager = true
              AND m.is_active = true
              AND m.email IS NOT NULL
            LIMIT 1
          `, [emp.employee_id]);

          if (managerData.length > 0) {
            managerEmail = managerData[0].email;
          }
        }

        employeesWithRisk.push({
          employee_id: emp.employee_id,
          employee_code: emp.employee_code,
          employee_name_th: `${emp.first_name_th} ${emp.last_name_th}`,
          employee_name_en: `${emp.first_name_en} ${emp.last_name_en}`,
          employee_email: emp.employee_email,
          manager_email: managerEmail,
          department_name_th: emp.department_name_th || '-',
          department_name_en: emp.department_name_en || '-',
          leave_balances: balances,
          risk_flags: {
            low_balance_warning: lowBalanceWarning,
            high_unused_warning: highUnusedWarning,
            expiring_leave_alert: expiringLeaveAlert,
            risk_messages: riskMessages
          },
          risk_level: riskLevel
        });
      }
    }

    return employeesWithRisk;

  } catch (error) {
    console.error('[Email Alerts] Error getting employees:', error);
    return [];
  }
}

/**
 * Send email alerts to employees
 */
async function sendEmailAlerts(employees: EmployeeWithRisk[], settings: any): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const employee of employees) {
    try {
      // Determine language (default to Thai)
      const language = 'th'; // Could be fetched from employee preferences

      // Generate email content
      const emailTemplate = generateLeaveBalanceAlertEmail(
        employee,
        employee.risk_level,
        employee.risk_flags.risk_messages,
        language
      );

      // Check user preferences before adding to recipient list
      const userPrefs = await query(`
        SELECT
          email_notifications_enabled,
          email_leave_balance_alerts
        FROM user_preferences
        WHERE employee_id = $1
      `, [employee.employee_id]);

      const canSendToEmployee = userPrefs.length > 0
        ? (userPrefs[0].email_notifications_enabled && userPrefs[0].email_leave_balance_alerts)
        : true; // Default to true if no preferences set

      // Build recipient list
      const recipients: string[] = [];
      if (settings.send_to_employee && employee.employee_email && canSendToEmployee) {
        recipients.push(employee.employee_email);
      }
      if (settings.send_to_manager && employee.manager_email) {
        recipients.push(employee.manager_email);
      }

      if (recipients.length === 0) {
        console.log(`[Email Alerts] No recipients for ${employee.employee_code}, skipping`);
        skipped++;
        continue;
      }

      // Add CC recipients
      const ccRecipients = settings.cc_emails || [];
      if (settings.send_to_hr) {
        // Could add HR email addresses here
      }

      // Send email
      const emailSent = await sendEmail({
        to: recipients,
        cc: ccRecipients.length > 0 ? ccRecipients : undefined,
        subject: emailTemplate.subject,
        html: emailTemplate.bodyHtml,
        text: emailTemplate.bodyText,
      });

      if (emailSent) {
        sent++;
        await logEmailSent(
          recipients.join(', '),
          emailTemplate.subject,
          `leave_balance_alert_${employee.risk_level}`,
          true
        );
        console.log(`[Email Alerts] Sent to ${employee.employee_code} (${employee.risk_level})`);
      } else {
        failed++;
        await logEmailSent(
          recipients.join(', '),
          emailTemplate.subject,
          `leave_balance_alert_${employee.risk_level}`,
          false,
          'Email send failed'
        );
        console.error(`[Email Alerts] Failed to send to ${employee.employee_code}`);
      }

    } catch (error) {
      failed++;
      console.error(`[Email Alerts] Error sending to ${employee.employee_code}:`, error);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { sent, failed, skipped };
}

/**
 * Main handler
 */
const sendLeaveBalanceAlertsHandler = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  // Only allow HR and admin to manually trigger
  // (For scheduled/cron execution, auth would be bypassed)
  const userRole = event.user?.role;
  const isCronJob = event.headers['x-netlify-cron'] === 'true';

  if (!isCronJob && !['hr', 'admin'].includes(userRole || '')) {
    return errorResponse('Permission denied. Only HR and admin can trigger email alerts.', 403);
  }

  try {
    // Check if email alerts are enabled
    const alertsEnabled = await areEmailAlertsEnabled();
    if (!alertsEnabled) {
      return successResponse({
        message: 'Email alerts are disabled in settings',
        sent: 0,
        failed: 0,
        skipped: 0
      });
    }

    const settings = await getEmailAlertSettings();

    console.log('[Email Alerts] Starting email alert job...');

    // Get employees who need alerts
    const employees = await getEmployeesForAlerts();
    console.log(`[Email Alerts] Found ${employees.length} employees needing alerts`);

    if (employees.length === 0) {
      return successResponse({
        message: 'No employees need alerts at this time',
        sent: 0,
        failed: 0,
        skipped: 0
      });
    }

    // Send emails
    const results = await sendEmailAlerts(employees, settings);

    console.log(`[Email Alerts] Job complete: ${results.sent} sent, ${results.failed} failed, ${results.skipped} skipped`);

    return successResponse({
      message: `Email alerts sent successfully`,
      ...results,
      total_checked: employees.length
    });

  } catch (error: any) {
    console.error('[Email Alerts] Job error:', error);
    return errorResponse(error.message || 'Failed to send email alerts', 500);
  }
};

export const handler: Handler = requireAuth(sendLeaveBalanceAlertsHandler);
