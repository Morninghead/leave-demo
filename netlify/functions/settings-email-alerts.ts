/**
 * Email Alert Settings Management
 *
 * Allows admins to configure email alert settings:
 * - Enable/disable email alerts globally
 * - Configure alert thresholds
 * - Set email templates
 * - Manage recipient lists
 */

import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

interface EmailAlertSettings {
  // Global settings
  email_alerts_enabled: boolean;

  // Alert thresholds
  low_balance_threshold: number; // Percentage (e.g., 20 for 20%)
  high_unused_threshold: number; // Percentage (e.g., 80 for 80%)
  expiring_leave_months: number; // Months before year-end

  // Email configuration
  sender_email: string;
  sender_name: string;
  reply_to_email: string;

  // Alert frequency
  alert_frequency: 'daily' | 'weekly' | 'monthly';
  alert_day_of_week: number; // 0-6 (Sunday-Saturday) for weekly
  alert_day_of_month: number; // 1-31 for monthly

  // Recipients
  send_to_employee: boolean;
  send_to_manager: boolean;
  send_to_hr: boolean;
  cc_emails: string[]; // Additional CC recipients

  // Email template customization
  email_subject_template: string;
  email_body_template_th: string;
  email_body_template_en: string;
}

const emailAlertSettingsHandler = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  const userRole = event.user?.role;

  // Only HR and admin can manage email alert settings
  if (!['hr', 'admin'].includes(userRole || '')) {
    return errorResponse('Permission denied. Only HR and admin can manage email alert settings.', 403);
  }

  try {
    // GET - Retrieve email alert settings
    if (event.httpMethod === 'GET') {
      const settings = await query(`
        SELECT
          setting_key,
          setting_value,
          description
        FROM company_settings
        WHERE setting_key LIKE 'email_alert_%'
        ORDER BY setting_key
      `);

      // Convert to structured object
      const settingsObj: any = {
        email_alerts_enabled: false,
        low_balance_threshold: 20,
        high_unused_threshold: 80,
        expiring_leave_months: 3,
        sender_email: 'noreply@company.com',
        sender_name: 'HR Leave System',
        reply_to_email: 'hr@company.com',
        alert_frequency: 'weekly',
        alert_day_of_week: 1, // Monday
        alert_day_of_month: 1,
        send_to_employee: true,
        send_to_manager: true,
        send_to_hr: true,
        cc_emails: [],
        email_subject_template: '[HR Alert] Leave Balance Notification',
        email_body_template_th: '',
        email_body_template_en: '',
      };

      settings.forEach((row: any) => {
        const key = row.setting_key.replace('email_alert_', '');
        let value = row.setting_value;

        // Parse boolean values
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        // Parse number values
        else if (!isNaN(value) && value !== '') value = parseFloat(value);
        // Parse JSON arrays
        else if (value.startsWith('[')) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // Keep as string if JSON parse fails
          }
        }

        settingsObj[key] = value;
      });

      return successResponse({ settings: settingsObj });
    }

    // POST - Update email alert settings
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const settings: Partial<EmailAlertSettings> = body.settings;

      if (!settings) {
        return errorResponse('Settings object is required', 400);
      }

      // Update settings in database
      const updates: Array<{ key: string; value: string; description: string }> = [];

      // Global settings
      if (settings.email_alerts_enabled !== undefined) {
        updates.push({
          key: 'email_alert_enabled',
          value: String(settings.email_alerts_enabled),
          description: 'Enable or disable email alerts globally'
        });
      }

      // Thresholds
      if (settings.low_balance_threshold !== undefined) {
        updates.push({
          key: 'email_alert_low_balance_threshold',
          value: String(settings.low_balance_threshold),
          description: 'Low balance threshold percentage (0-100)'
        });
      }

      if (settings.high_unused_threshold !== undefined) {
        updates.push({
          key: 'email_alert_high_unused_threshold',
          value: String(settings.high_unused_threshold),
          description: 'High unused leave threshold percentage (0-100)'
        });
      }

      if (settings.expiring_leave_months !== undefined) {
        updates.push({
          key: 'email_alert_expiring_leave_months',
          value: String(settings.expiring_leave_months),
          description: 'Months before year-end to trigger expiring leave alert'
        });
      }

      // Email configuration
      if (settings.sender_email) {
        updates.push({
          key: 'email_alert_sender_email',
          value: settings.sender_email,
          description: 'Sender email address for alerts'
        });
      }

      if (settings.sender_name) {
        updates.push({
          key: 'email_alert_sender_name',
          value: settings.sender_name,
          description: 'Sender name for alerts'
        });
      }

      if (settings.reply_to_email) {
        updates.push({
          key: 'email_alert_reply_to_email',
          value: settings.reply_to_email,
          description: 'Reply-to email address'
        });
      }

      // Frequency settings
      if (settings.alert_frequency) {
        updates.push({
          key: 'email_alert_frequency',
          value: settings.alert_frequency,
          description: 'Alert frequency: daily, weekly, or monthly'
        });
      }

      if (settings.alert_day_of_week !== undefined) {
        updates.push({
          key: 'email_alert_day_of_week',
          value: String(settings.alert_day_of_week),
          description: 'Day of week for weekly alerts (0-6, Sunday-Saturday)'
        });
      }

      if (settings.alert_day_of_month !== undefined) {
        updates.push({
          key: 'email_alert_day_of_month',
          value: String(settings.alert_day_of_month),
          description: 'Day of month for monthly alerts (1-31)'
        });
      }

      // Recipients
      if (settings.send_to_employee !== undefined) {
        updates.push({
          key: 'email_alert_send_to_employee',
          value: String(settings.send_to_employee),
          description: 'Send alerts to employees'
        });
      }

      if (settings.send_to_manager !== undefined) {
        updates.push({
          key: 'email_alert_send_to_manager',
          value: String(settings.send_to_manager),
          description: 'Send alerts to managers'
        });
      }

      if (settings.send_to_hr !== undefined) {
        updates.push({
          key: 'email_alert_send_to_hr',
          value: String(settings.send_to_hr),
          description: 'Send alerts to HR team'
        });
      }

      if (settings.cc_emails) {
        updates.push({
          key: 'email_alert_cc_emails',
          value: JSON.stringify(settings.cc_emails),
          description: 'Additional CC email addresses (JSON array)'
        });
      }

      // Email templates
      if (settings.email_subject_template) {
        updates.push({
          key: 'email_alert_subject_template',
          value: settings.email_subject_template,
          description: 'Email subject template'
        });
      }

      if (settings.email_body_template_th) {
        updates.push({
          key: 'email_alert_body_template_th',
          value: settings.email_body_template_th,
          description: 'Email body template (Thai)'
        });
      }

      if (settings.email_body_template_en) {
        updates.push({
          key: 'email_alert_body_template_en',
          value: settings.email_body_template_en,
          description: 'Email body template (English)'
        });
      }

      // Insert or update settings
      for (const update of updates) {
        await query(`
          INSERT INTO company_settings (setting_key, setting_value, description, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (setting_key)
          DO UPDATE SET
            setting_value = EXCLUDED.setting_value,
            description = EXCLUDED.description,
            updated_at = NOW()
        `, [update.key, update.value, update.description]);
      }

      return successResponse({
        message: 'Email alert settings updated successfully',
        updated_settings: updates.length
      });
    }

    return errorResponse('Method not allowed', 405);

  } catch (error: any) {
    console.error('Email alert settings error:', error);
    return errorResponse(error.message || 'Failed to manage email alert settings', 500);
  }
};

export const handler: Handler = requireAuth(emailAlertSettingsHandler);
