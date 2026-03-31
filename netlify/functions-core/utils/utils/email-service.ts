/**
 * Email Service Utility
 *
 * Provides email sending functionality with template support
 * Supports multiple email providers (SendGrid, AWS SES, NodeMailer)
 */

import { logger } from './logger';
import { query } from './db';

// Email provider configuration from environment
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'console'; // 'sendgrid', 'ses', 'smtp', 'console'
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const AWS_SES_REGION = process.env.AWS_SES_REGION || 'us-east-1';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

interface EmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
}

interface EmailTemplate {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

/**
 * Get email alert settings from database
 */
export async function getEmailAlertSettings(): Promise<any> {
  try {
    const settings = await query(`
      SELECT setting_key, setting_value
      FROM company_settings
      WHERE setting_key LIKE 'email_alert_%'
    `);

    const settingsObj: any = {
      enabled: false,
      sender_email: 'noreply@company.com',
      sender_name: 'HR Leave System',
      reply_to_email: 'hr@company.com',
    };

    settings.forEach((row: any) => {
      const key = row.setting_key.replace('email_alert_', '');
      let value = row.setting_value;

      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(value) && value !== '') value = parseFloat(value);
      else if (value.startsWith('[')) {
        try {
          value = JSON.parse(value);
        } catch (e) {
          // Keep as string
        }
      }

      settingsObj[key] = value;
    });

    return settingsObj;
  } catch (error) {
    logger.error('Error fetching email alert settings:', error);
    return {
      enabled: false,
      sender_email: 'noreply@company.com',
      sender_name: 'HR Leave System',
      reply_to_email: 'hr@company.com',
    };
  }
}

/**
 * Check if email alerts are enabled
 */
export async function areEmailAlertsEnabled(): Promise<boolean> {
  const settings = await getEmailAlertSettings();
  return settings.enabled === true;
}

/**
 * Generate email template for leave balance alert
 */
export function generateLeaveBalanceAlertEmail(
  employee: any,
  riskLevel: 'high' | 'medium' | 'low',
  riskMessages: string[],
  language: 'th' | 'en' = 'th'
): EmailTemplate {
  const employeeName = language === 'th' ? employee.employee_name_th : employee.employee_name_en;

  if (language === 'th') {
    const subject = `[แจ้งเตือน HR] ยอดคงเหลือวันลาของคุณ - ระดับความเสี่ยง: ${riskLevel === 'high' ? 'สูง' : riskLevel === 'medium' ? 'กลาง' : 'ต่ำ'
      }`;

    const riskColor = riskLevel === 'high' ? '#DC2626' : riskLevel === 'medium' ? '#D97706' : '#16A34A';
    const riskBadge = riskLevel === 'high' ? '🔴 สูง' : riskLevel === 'medium' ? '🟡 กลาง' : '🟢 ต่ำ';

    const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Sarabun', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1E40AF; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #F9FAFB; padding: 30px; border: 1px solid #E5E7EB; }
    .risk-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; background-color: ${riskColor}; color: white; }
    .balance-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .balance-table th, .balance-table td { padding: 12px; text-align: left; border-bottom: 1px solid #E5E7EB; }
    .balance-table th { background-color: #F3F4F6; font-weight: bold; }
    .warning-box { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .action-box { background-color: #DBEAFE; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .footer { text-align: center; padding: 20px; color: #6B7280; font-size: 14px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #1E40AF; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">แจ้งเตือนยอดคงเหลือวันลา</h2>
    </div>
    <div class="content">
      <p>เรียน คุณ${employeeName},</p>

      <p>ระบบตรวจพบว่ายอดคงเหลือวันลาของคุณอยู่ในระดับความเสี่ยง:</p>

      <p style="text-align: center;">
        <span class="risk-badge">${riskBadge}</span>
      </p>

      <table class="balance-table">
        <thead>
          <tr>
            <th>ประเภทการลา</th>
            <th>จัดสรร</th>
            <th>ใช้ไป</th>
            <th>คงเหลือ</th>
          </tr>
        </thead>
        <tbody>
          ${employee.leave_balances.map((lb: any) => `
            <tr>
              <td>${lb.leave_type_name_th}</td>
              <td>${lb.allocated_days}</td>
              <td>${lb.used_days.toFixed(1)}</td>
              <td><strong>${lb.remaining_days.toFixed(1)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${riskMessages.length > 0 ? `
      <div class="warning-box">
        <strong>⚠️ คำเตือน:</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          ${riskMessages.map(msg => `<li>${msg}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      <div class="action-box">
        <strong>💡 คำแนะนำ:</strong>
        ${riskLevel === 'high' ? `
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>วางแผนการลาล่วงหน้าเพื่อความต่อเนื่องในการทำงาน</li>
          <li>ตรวจสอบกับหัวหน้างานเกี่ยวกับช่วงเวลาที่เหมาะสม</li>
          <li>พิจารณาการใช้วันลาที่เหลือก่อนสิ้นปี</li>
        </ul>
        ` : riskLevel === 'medium' && employee.risk_flags.high_unused_warning ? `
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>คุณมีวันลาคงเหลืออยู่จำนวนมาก ควรใช้เพื่อพักผ่อน</li>
          <li>การพักผ่อนที่เพียงพอช่วยเพิ่มประสิทธิภาพในการทำงาน</li>
          <li>สามารถปรึกษาหัวหน้างานเพื่อวางแผนการลาได้</li>
        </ul>
        ` : `
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>ยอดคงเหลือวันลาของคุณอยู่ในเกณฑ์ปกติ</li>
          <li>สามารถตรวจสอบรายละเอียดเพิ่มเติมได้ในระบบ</li>
        </ul>
        `}
      </div>

      <p style="text-align: center; margin-top: 30px;">
        <a href="${process.env.APP_URL || 'https://leave.company.com'}/leave-balance" class="button">
          ตรวจสอบรายละเอียด
        </a>
      </p>
    </div>
    <div class="footer">
      <p>อีเมลนี้ส่งโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับ</p>
      <p>หากมีคำถาม กรุณาติดต่อฝ่ายทรัพยากรบุคคล</p>
    </div>
  </div>
</body>
</html>
    `;

    const bodyText = `
เรียน คุณ${employeeName},

ระบบตรวจพบว่ายอดคงเหลือวันลาของคุณอยู่ในระดับความเสี่ยง: ${riskBadge}

รายละเอียดยอดคงเหลือวันลา:
${employee.leave_balances.map((lb: any) =>
      `- ${lb.leave_type_name_th}: ใช้ไป ${lb.used_days.toFixed(1)}/${lb.allocated_days} วัน, คงเหลือ ${lb.remaining_days.toFixed(1)} วัน`
    ).join('\n')}

${riskMessages.length > 0 ? `\nคำเตือน:\n${riskMessages.map((msg, i) => `${i + 1}. ${msg}`).join('\n')}` : ''}

กรุณาตรวจสอบรายละเอียดในระบบ: ${process.env.APP_URL || 'https://leave.company.com'}/leave-balance

---
อีเมลนี้ส่งโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับ
หากมีคำถาม กรุณาติดต่อฝ่ายทรัพยากรบุคคล
    `;

    return { subject, bodyHtml, bodyText };

  } else {
    // English version
    const subject = `[HR Alert] Your Leave Balance Status - Risk Level: ${riskLevel === 'high' ? 'High' : riskLevel === 'medium' ? 'Medium' : 'Low'
      }`;

    const riskColor = riskLevel === 'high' ? '#DC2626' : riskLevel === 'medium' ? '#D97706' : '#16A34A';
    const riskBadge = riskLevel === 'high' ? '🔴 High' : riskLevel === 'medium' ? '🟡 Medium' : '🟢 Low';

    const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1E40AF; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #F9FAFB; padding: 30px; border: 1px solid #E5E7EB; }
    .risk-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; background-color: ${riskColor}; color: white; }
    .balance-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .balance-table th, .balance-table td { padding: 12px; text-align: left; border-bottom: 1px solid #E5E7EB; }
    .balance-table th { background-color: #F3F4F6; font-weight: bold; }
    .warning-box { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .action-box { background-color: #DBEAFE; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .footer { text-align: center; padding: 20px; color: #6B7280; font-size: 14px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #1E40AF; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">Leave Balance Alert</h2>
    </div>
    <div class="content">
      <p>Dear ${employeeName},</p>

      <p>Our system has detected that your leave balance is at the following risk level:</p>

      <p style="text-align: center;">
        <span class="risk-badge">${riskBadge}</span>
      </p>

      <table class="balance-table">
        <thead>
          <tr>
            <th>Leave Type</th>
            <th>Allocated</th>
            <th>Used</th>
            <th>Remaining</th>
          </tr>
        </thead>
        <tbody>
          ${employee.leave_balances.map((lb: any) => `
            <tr>
              <td>${lb.leave_type_name_en}</td>
              <td>${lb.allocated_days}</td>
              <td>${lb.used_days.toFixed(1)}</td>
              <td><strong>${lb.remaining_days.toFixed(1)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${riskMessages.length > 0 ? `
      <div class="warning-box">
        <strong>⚠️ Warnings:</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          ${riskMessages.map(msg => `<li>${msg}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      <div class="action-box">
        <strong>💡 Recommendations:</strong>
        ${riskLevel === 'high' ? `
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>Plan your leave in advance to ensure work continuity</li>
          <li>Coordinate with your manager for suitable timing</li>
          <li>Consider using remaining leave days before year-end</li>
        </ul>
        ` : riskLevel === 'medium' && employee.risk_flags.high_unused_warning ? `
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>You have significant unused leave - consider taking time to rest</li>
          <li>Adequate rest improves work performance</li>
          <li>Consult with your manager to plan your leave</li>
        </ul>
        ` : `
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>Your leave balance is within normal range</li>
          <li>You can check more details in the system</li>
        </ul>
        `}
      </div>

      <p style="text-align: center; margin-top: 30px;">
        <a href="${process.env.APP_URL || 'https://leave.company.com'}/leave-balance" class="button">
          View Details
        </a>
      </p>
    </div>
    <div class="footer">
      <p>This is an automated email. Please do not reply.</p>
      <p>If you have questions, please contact HR department.</p>
    </div>
  </div>
</body>
</html>
    `;

    const bodyText = `
Dear ${employeeName},

Our system has detected that your leave balance is at risk level: ${riskBadge}

Leave Balance Details:
${employee.leave_balances.map((lb: any) =>
      `- ${lb.leave_type_name_en}: Used ${lb.used_days.toFixed(1)}/${lb.allocated_days} days, Remaining ${lb.remaining_days.toFixed(1)} days`
    ).join('\n')}

${riskMessages.length > 0 ? `\nWarnings:\n${riskMessages.map((msg, i) => `${i + 1}. ${msg}`).join('\n')}` : ''}

Please check details in the system: ${process.env.APP_URL || 'https://leave.company.com'}/leave-balance

---
This is an automated email. Please do not reply.
If you have questions, please contact HR department.
    `;

    return { subject, bodyHtml, bodyText };
  }
}

/**
 * Send email using configured provider
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    // Check if emails are enabled
    const alertsEnabled = await areEmailAlertsEnabled();
    if (!alertsEnabled && EMAIL_PROVIDER !== 'console') {
      logger.log('[Email] Alerts disabled, skipping email send');
      return false;
    }

    const settings = await getEmailAlertSettings();

    // Set defaults from settings
    const from = options.from || settings.sender_email || 'noreply@company.com';
    const fromName = options.fromName || settings.sender_name || 'HR Leave System';
    const replyTo = options.replyTo || settings.reply_to_email || 'hr@company.com';

    switch (EMAIL_PROVIDER) {
      case 'console':
        // Console output for development/testing
        logger.log('='.repeat(80));
        logger.log('[Email] CONSOLE MODE - Email would be sent:');
        logger.log('From:', `${fromName} <${from}>`);
        logger.log('To:', options.to);
        if (options.cc) logger.log('CC:', options.cc);
        if (options.bcc) logger.log('BCC:', options.bcc);
        logger.log('Subject:', options.subject);
        logger.log('Reply-To:', replyTo);
        logger.log('---');
        logger.log(options.text || 'HTML email (text version not provided)');
        logger.log('='.repeat(80));
        return true;

      case 'sendgrid':
        return await sendEmailViaSendGrid(options, from, fromName, replyTo);

      case 'ses':
        return await sendEmailViaSES(options, from, fromName, replyTo);

      case 'smtp':
        return await sendEmailViaSMTP(options, from, fromName, replyTo);

      default:
        logger.error(`[Email] Unknown provider: ${EMAIL_PROVIDER}`);
        return false;
    }
  } catch (error) {
    logger.error('[Email] Send error:', error);
    return false;
  }
}

/**
 * Send email via SendGrid (placeholder - requires @sendgrid/mail package)
 */
async function sendEmailViaSendGrid(
  options: EmailOptions,
  from: string,
  fromName: string,
  replyTo: string
): Promise<boolean> {
  logger.log('[Email] SendGrid integration not yet implemented');
  logger.log('[Email] Install: npm install @sendgrid/mail');
  logger.log('[Email] Set SENDGRID_API_KEY environment variable');

  // Placeholder for SendGrid implementation
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(SENDGRID_API_KEY);
  // await sgMail.send({...});

  return false;
}

/**
 * Send email via AWS SES (placeholder - requires aws-sdk package)
 */
async function sendEmailViaSES(
  options: EmailOptions,
  from: string,
  fromName: string,
  replyTo: string
): Promise<boolean> {
  logger.log('[Email] AWS SES integration not yet implemented');
  logger.log('[Email] Install: npm install @aws-sdk/client-ses');
  logger.log('[Email] Configure AWS credentials');

  // Placeholder for AWS SES implementation
  // const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
  // const client = new SESClient({ region: AWS_SES_REGION });
  // await client.send(new SendEmailCommand({...}));

  return false;
}

/**
 * Send email via SMTP (using nodemailer)
 */
async function sendEmailViaSMTP(
  options: EmailOptions,
  from: string,
  fromName: string,
  replyTo: string
): Promise<boolean> {
  try {
    const nodemailer = await import('nodemailer');

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    // Prepare email
    const mailOptions = {
      from: `${fromName} <${from}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
      bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
      replyTo: replyTo,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtmlTags(options.html || ''),
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    logger.log('[Email] Sent successfully:', info.messageId);

    return true;
  } catch (error) {
    logger.error('[Email] SMTP send failed:', error);
    return false;
  }
}

/**
 * Strip HTML tags for plain text
 */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Log email to database for audit trail
 */
export async function logEmailSent(
  recipient: string,
  subject: string,
  emailType: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    await query(`
      INSERT INTO email_logs (recipient, subject, email_type, sent_at, success, error_message)
      VALUES ($1, $2, $3, NOW(), $4, $5)
    `, [recipient, subject, emailType, success, errorMessage || null]);
  } catch (error) {
    logger.error('[Email] Failed to log email:', error);
  }
}

// ===== LEAVE REQUEST EMAIL NOTIFICATIONS =====

/**
 * Send Leave Request Submitted Confirmation
 */
export async function sendLeaveRequestSubmitted(
  employeeName: string,
  employeeEmail: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  totalDays: number,
  requestId: string
): Promise<boolean> {
  const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'http://localhost:8888';
  const subject = `Leave Request Submitted - ${startDate} to ${endDate}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #faf5ff; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8b5cf6; }
    .button { display: inline-block; background: #8b5cf6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9d5ff; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">📋 Leave Request Submitted</h1>
    </div>
    <div class="content">
      <p>Hello ${employeeName},</p>
      <p>Your leave request has been successfully submitted and is pending approval.</p>

      <div class="info-box">
        <p><strong>Request Summary:</strong></p>
        <p>Type: <strong>${leaveType}</strong></p>
        <p>Period: ${startDate} to ${endDate}</p>
        <p>Duration: ${totalDays} days</p>
        <p>Status: <span style="color: #f59e0b;">⏳ Pending Approval</span></p>
      </div>

      <p>You will receive an email notification once your request has been reviewed.</p>

      <center>
        <a href="${appUrl}/leave" class="button">View My Requests</a>
      </center>

      <div class="footer">
        <p>SSTH Leave Management System</p>
        <p style="font-size: 12px; color: #9ca3af;">This is an automated email. Please do not reply.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const sent = await sendEmail({
    to: employeeEmail,
    subject,
    html,
  });

  await logEmailSent(employeeEmail, subject, 'leave_request_submitted', sent);
  return sent;
}

/**
 * Send Leave Request Notification to Approver
 */
export async function sendLeaveRequestPendingApproval(
  employeeName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  totalDays: number,
  approverEmail: string,
  approverName: string,
  requestId: string
): Promise<boolean> {
  const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'http://localhost:8888';
  const subject = `New Leave Request from ${employeeName} - Requires Your Approval`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .info-label { font-weight: 600; color: #6b7280; }
    .info-value { color: #111827; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">🏖️ New Leave Request</h1>
      <p style="margin: 10px 0 0 0;">Requires Your Approval</p>
    </div>
    <div class="content">
      <p>Hello ${approverName},</p>
      <p>A new leave request has been submitted and requires your approval:</p>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Employee:</span>
          <span class="info-value"><strong>${employeeName}</strong></span>
        </div>
        <div class="info-row">
          <span class="info-label">Leave Type:</span>
          <span class="info-value">${leaveType}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Start Date:</span>
          <span class="info-value">${startDate}</span>
        </div>
        <div class="info-row">
          <span class="info-label">End Date:</span>
          <span class="info-value">${endDate}</span>
        </div>
        <div class="info-row" style="border-bottom: none;">
          <span class="info-label">Total Days:</span>
          <span class="info-value"><strong style="color: #3b82f6;">${totalDays} days</strong></span>
        </div>
      </div>

      <p>Please review and approve or reject this request at your earliest convenience.</p>

      <center>
        <a href="${appUrl}/approval" class="button">Review Request</a>
      </center>

      <div class="footer">
        <p>SSTH Leave Management System</p>
        <p style="font-size: 12px; color: #9ca3af;">This is an automated email. Please do not reply.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const sent = await sendEmail({
    to: approverEmail,
    subject,
    html,
  });

  await logEmailSent(approverEmail, subject, 'leave_request_pending', sent);
  return sent;
}

/**
 * Send Leave Request Approved Notification
 */
export async function sendLeaveRequestApproved(
  employeeName: string,
  employeeEmail: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  totalDays: number,
  approverName: string
): Promise<boolean> {
  const subject = `Your Leave Request Has Been Approved - ${startDate} to ${endDate}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f0fdf4; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
    .success-badge { background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin: 10px 0; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #d1fae5; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">✅ Leave Request Approved</h1>
    </div>
    <div class="content">
      <p>Hello ${employeeName},</p>
      <p>Great news! Your leave request has been approved.</p>

      <center>
        <span class="success-badge">✓ Approved by ${approverName}</span>
      </center>

      <div class="info-box">
        <p><strong>Leave Details:</strong></p>
        <p>Type: <strong>${leaveType}</strong></p>
        <p>Period: ${startDate} to ${endDate}</p>
        <p>Duration: ${totalDays} days</p>
      </div>

      <p>Your leave has been recorded in the system. Enjoy your time off!</p>

      <div class="footer">
        <p>SSTH Leave Management System</p>
        <p style="font-size: 12px; color: #9ca3af;">This is an automated email. Please do not reply.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const sent = await sendEmail({
    to: employeeEmail,
    subject,
    html,
  });

  await logEmailSent(employeeEmail, subject, 'leave_request_approved', sent);
  return sent;
}

/**
 * Send Leave Request Rejected Notification
 */
export async function sendLeaveRequestRejected(
  employeeName: string,
  employeeEmail: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  rejectorName: string,
  reason?: string
): Promise<boolean> {
  const subject = `Leave Request Update - ${startDate} to ${endDate}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #fef2f2; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #fecaca; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">❌ Leave Request Not Approved</h1>
    </div>
    <div class="content">
      <p>Hello ${employeeName},</p>
      <p>We regret to inform you that your leave request has not been approved.</p>

      <div class="info-box">
        <p><strong>Leave Details:</strong></p>
        <p>Type: ${leaveType}</p>
        <p>Period: ${startDate} to ${endDate}</p>
        <p>Declined by: ${rejectorName}</p>
        ${reason ? `<p style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #fee2e2;"><strong>Reason:</strong><br>${reason}</p>` : ''}
      </div>

      <p>If you have questions about this decision, please contact your manager or HR department.</p>

      <div class="footer">
        <p>SSTH Leave Management System</p>
        <p style="font-size: 12px; color: #9ca3af;">This is an automated email. Please do not reply.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const sent = await sendEmail({
    to: employeeEmail,
    subject,
    html,
  });

  await logEmailSent(employeeEmail, subject, 'leave_request_rejected', sent);
  return sent;
}

/**
 * Send Shift Swap Request Notification
 */
export async function sendShiftSwapNotification(
  employeeName: string,
  workDate: string,
  offDate: string,
  approverEmail: string,
  approverName: string
): Promise<boolean> {
  const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'http://localhost:8888';
  const subject = `New Shift Swap Request from ${employeeName}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f0f9ff; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #06b6d4; }
    .button { display: inline-block; background: #06b6d4; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #bae6fd; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">🔄 Shift Swap Request</h1>
    </div>
    <div class="content">
      <p>Hello ${approverName},</p>
      <p>A shift swap request has been submitted and requires your approval:</p>

      <div class="info-box">
        <p><strong>Employee:</strong> ${employeeName}</p>
        <p><strong>Work Date:</strong> ${workDate}</p>
        <p><strong>Off Date:</strong> ${offDate}</p>
      </div>

      <center>
        <a href="${appUrl}/approval" class="button">Review Request</a>
      </center>

      <div class="footer">
        <p>SSTH Leave Management System</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const sent = await sendEmail({
    to: approverEmail,
    subject,
    html,
  });

  await logEmailSent(approverEmail, subject, 'shift_swap_request', sent);
  return sent;
}
