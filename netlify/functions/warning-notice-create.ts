// netlify/functions/warning-notice-create.ts
import { Handler } from '@netlify/functions';
import { sql } from './utils/db';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';

/**
 * Warning Notice Creation API
 * POST: Create new warning notice
 * Only Admin, Manager (with is_department_manager), or HR can create
 */

interface CreateWarningRequest {
  employee_id: string | number; // Can be UUID string or numeric ID
  warning_type: 'VERBAL' | 'WRITTEN_1ST' | 'WRITTEN_2ND' | 'FINAL_WARNING' | 'SUSPENSION' | 'TERMINATION';
  offense_type_id: number | string; // Will be converted to number
  incident_date: string;
  incident_description: string;
  incident_location?: string;
  penalty_description: string;
  suspension_days?: number;
  suspension_start_date?: string;
  suspension_end_date?: string;
  effective_date: string;
  attachments_urls?: string[];
  witnesses?: Array<{
    witness_employee_id?: number | string; // Can be UUID or numeric
    witness_name?: string;
    witness_position?: string;
    statement?: string;
  }>;
}

// Check if user can issue warnings
async function canIssueWarning(event: AuthenticatedEvent): Promise<boolean> {
  const userId = event.user?.userId;
  const userRole = event.user?.role;

  // Admin, HR, and Dev can always issue warnings
  if (userRole === 'admin' || userRole === 'hr' || userRole === 'dev') {
    return true;
  }

  // Check if user is department manager or admin
  const [employee] = await sql`
    SELECT is_department_manager, is_department_admin
    FROM employees
    WHERE id = ${userId}
  ` as any;

  if (!employee) {
    return false;
  }

  return employee.is_department_manager || employee.is_department_admin;
}

const handler: Handler = requireAuth(async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Check if warning system is enabled
    const [systemSetting] = await sql`
        SELECT setting_value FROM warning_system_settings WHERE setting_key = 'system_enabled'
      ` as any;

    if (systemSetting?.setting_value !== 'true') {
      return errorResponse('Warning system is currently disabled', 403);
    }

    // Check permission
    const hasPermission = await canIssueWarning(event);
    if (!hasPermission) {
      return errorResponse('Only Admin, Department Manager, or HR can issue warning notices', 403);
    }

    const body: CreateWarningRequest = JSON.parse(event.body || '{}');
    const userId = event.user?.userId;

    // Detailed request logging for debugging
    console.log('📝 Warning creation request:', {
      warning_type: body.warning_type,
      employee_id: body.employee_id,
      employee_id_type: typeof body.employee_id,
      offense_type_id: body.offense_type_id,
      offense_type_id_type: typeof body.offense_type_id,
      has_incident_description: !!body.incident_description,
      has_penalty_description: !!body.penalty_description,
      suspension_days: body.suspension_days,
      has_suspension_dates: !!(body.suspension_start_date && body.suspension_end_date),
    });

    // Handle employee_id - can be UUID string or number
    const employeeId = body.employee_id;

    // Handle offense_type_id - convert to number if string
    const offenseTypeId = body.offense_type_id ?
      (typeof body.offense_type_id === 'string' ? parseInt(body.offense_type_id, 10) : body.offense_type_id) :
      null;

    console.log('🔍 Processed IDs:', {
      employeeId,
      employeeIdType: typeof employeeId,
      offenseTypeId,
      offenseTypeIdType: typeof offenseTypeId
    });

    // Validation - employee_id can be UUID string or number
    if (!employeeId) {
      console.warn('❌ Validation failed: Missing employee_id');
      return errorResponse('Employee ID is required', 400);
    }

    // For numeric employee_id, check if it's a valid number
    if (typeof employeeId === 'number' && isNaN(employeeId)) {
      console.warn('❌ Validation failed: Invalid numeric employee_id');
      return errorResponse('Valid Employee ID is required', 400);
    }

    // offense_type_id must be a valid number
    if (!offenseTypeId || isNaN(offenseTypeId)) {
      console.warn('❌ Validation failed: Invalid offense_type_id');
      return errorResponse('Valid Offense Type ID is required', 400);
    }

    const validWarningTypes = ['VERBAL', 'WRITTEN_1ST', 'WRITTEN_2ND', 'FINAL_WARNING', 'SUSPENSION', 'TERMINATION'];
    if (!body.warning_type || !validWarningTypes.includes(body.warning_type)) {
      console.warn('❌ Validation failed: Invalid warning_type:', body.warning_type);
      return errorResponse(`Warning type must be one of: ${validWarningTypes.join(', ')}`, 400);
    }

    // Role-based Warning Type Restriction
    // Only HR, Admin, or Dev can issue SUSPENSION or TERMINATION
    const isSeverePenalty = ['SUSPENSION', 'TERMINATION'].includes(body.warning_type);
    const userRole = event.user?.role;
    const isPrivilegedUser = userRole === 'hr' || userRole === 'admin' || userRole === 'dev';

    if (isSeverePenalty && !isPrivilegedUser) {
      console.warn(`❌ Access Authorization: Role '${userRole}' attempted to create severe warning type '${body.warning_type}'`);
      return errorResponse('Only HR or Admin can issue Suspension or Termination warnings', 403);
    }

    if (!body.incident_date || !body.incident_description) {
      console.warn('❌ Validation failed: Missing incident_date or incident_description');
      return errorResponse('Incident date and description are required', 400);
    }

    if (!body.penalty_description) {
      console.warn('❌ Validation failed: Missing penalty_description');
      return errorResponse('Penalty description is required', 400);
    }

    if (!body.effective_date) {
      console.warn('❌ Validation failed: Missing effective_date');
      return errorResponse('Effective date is required', 400);
    }

    // Validate suspension details (ONLY for SUSPENSION type)
    if (body.warning_type === 'SUSPENSION') {
      console.log('🔍 Validating SUSPENSION-specific fields');
      if (!body.suspension_days || body.suspension_days <= 0) {
        console.warn('❌ Validation failed: Invalid suspension_days:', body.suspension_days);
        return errorResponse('Suspension days must be greater than 0', 400);
      }
      if (!body.suspension_start_date || !body.suspension_end_date) {
        console.warn('❌ Validation failed: Missing suspension dates');
        return errorResponse('Suspension start and end dates are required', 400);
      }
    }

    console.log('✅ All validations passed for warning type:', body.warning_type);

    // Check if employee exists
    const [employee] = await sql`
        SELECT id, employee_code, first_name_th, last_name_th
        FROM employees
        WHERE id = ${employeeId}
      ` as any;

    if (!employee) {
      return errorResponse('Employee not found', 404);
    }

    // 1. Create Warning Notice with Retry logic for ID generation (handling race conditions)
    let warningNotice;
    let noticeNumber;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Generate notice number
        const year = new Date().getFullYear();
        const yearBE = year + 543;
        const [maxResult] = await sql`
          SELECT COALESCE(MAX(CAST(SUBSTRING(notice_number FROM '^WN-[0-9]+-([0-9]+)$') AS INTEGER)), 0) as max_sequence
          FROM warning_notices
          WHERE notice_number LIKE 'WN-' || ${yearBE} || '-%'
        ` as any;
        const nextSequence = (maxResult?.max_sequence || 0) + 1;
        noticeNumber = `WN-${yearBE}-${nextSequence.toString().padStart(4, '0')}`;

        // Double check if this number already exists (to handle race conditions more robustly)
        const [existing] = await sql`
          SELECT id FROM warning_notices WHERE notice_number = ${noticeNumber}
        ` as any;

        if (existing) {
          console.warn(`⚠️ Notice number ${noticeNumber} collision detected (pre-check), retrying...`);
          await new Promise(r => setTimeout(r, 300)); // Delay and retry
          continue;
        }

        // Get warning expiry months
        const [expiryMonthsSetting] = await sql`SELECT setting_value FROM warning_system_settings WHERE setting_key = 'warning_expiry_months'` as any;
        const expiryMonths = parseInt(expiryMonthsSetting?.setting_value || '12', 10);

        // Calculate dates
        const effectiveDate = new Date(body.effective_date);
        const expiryDate = new Date(effectiveDate);
        expiryDate.setMonth(expiryDate.getMonth() + expiryMonths);
        const autoInactiveDate = new Date(effectiveDate);
        autoInactiveDate.setMonth(autoInactiveDate.getMonth() + 12);

        // Determine HR approval
        const requiresHRApproval = body.warning_type === 'SUSPENSION' || body.warning_type === 'TERMINATION';
        const initialStatus = 'PENDING_ACKNOWLEDGMENT';
        const hrApprovalStatus = requiresHRApproval ? 'PENDING_HR_REVIEW' : null;
        const attachmentsArray = body.attachments_urls && body.attachments_urls.length > 0 ? body.attachments_urls : null;

        // Insert warning notice
        const [result] = await sql`
            INSERT INTO warning_notices (
            notice_number, employee_id, issued_by, warning_type, offense_type_id,
            incident_date, incident_description, incident_location, penalty_description,
            suspension_days, suspension_start_date, suspension_end_date,
            effective_date, expiry_date, is_active, auto_inactive_date,
            requires_hr_approval, hr_approval_status, attachments_urls, status
          ) VALUES (
            ${noticeNumber}, ${employeeId}, ${userId}, ${body.warning_type}, ${offenseTypeId},
            ${body.incident_date}, ${body.incident_description}, ${body.incident_location || null}, ${body.penalty_description},
            ${body.suspension_days || 0}, ${body.suspension_start_date || null}, ${body.suspension_end_date || null},
            ${body.effective_date}, ${expiryDate.toISOString().split('T')[0]}, true, ${autoInactiveDate.toISOString().split('T')[0]},
            ${requiresHRApproval}, ${hrApprovalStatus}, ${attachmentsArray}, ${initialStatus}
          )
          RETURNING *
        ` as any;
        warningNotice = result;
        break; // Success!

      } catch (insertError: any) {
        // Check for unique constraint violation on notice_number
        if (attempt < maxRetries && (insertError.code === '23505' || insertError.message?.includes('unique'))) {
          console.warn(`Retry attempt ${attempt} for notice number collision`);
          await new Promise(r => setTimeout(r, 200)); // Small delay
          continue;
        }
        throw insertError; // Throw other errors or if retries exhausted
      }
    }

    // Capture variables for subsequent steps
    const requiresHRApproval = warningNotice.requires_hr_approval;
    const initialStatus = warningNotice.status;
    const expiryDate = warningNotice.expiry_date;

    // 2. Insert Witnesses
    if (body.witnesses && body.witnesses.length > 0) {
      for (const witness of body.witnesses) {
        await sql`
          INSERT INTO warning_witnesses (
            warning_notice_id, witness_employee_id, witness_name, witness_position, statement_th
          ) VALUES (
            ${warningNotice.id}, ${witness.witness_employee_id || null}, ${witness.witness_name || null},
            ${witness.witness_position || null}, ${witness.statement || null}
          )
        `;
      }
    }

    // 3. Log Audit Trail
    const notes = requiresHRApproval
      ? 'สร้างใบเตือน รอ HR อนุมัติ\n---\nWarning notice created, pending HR approval'
      : 'สร้างใบเตือน\n---\nWarning notice created';

    await sql`
      INSERT INTO warning_audit_logs (
        warning_notice_id, action, performed_by, ip_address, changes, notes
      ) VALUES (
        ${warningNotice.id},
        ${requiresHRApproval ? 'CREATED_PENDING_HR_REVIEW' : 'CREATED'},
        ${userId},
        ${event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown'},
        ${JSON.stringify({ notice_number: noticeNumber, employee: employee.employee_code })}::jsonb,
        ${notes}
      )
    `;

    // 4. Notifications
    try {
      if (!requiresHRApproval) {
        await sql`
          INSERT INTO notifications (
            employee_id, title_th, title_en, message_th, message_en,
            notification_type, related_type, related_id, is_read
          ) VALUES (
            ${employeeId},
            'คุณได้รับใบเตือน',
            'You have received a warning notice',
            ${'คุณได้รับใบเตือน ' + body.warning_type + ' (เลขที่ ' + noticeNumber + ') กรุณาเข้าสู่ระบบเพื่ออ่านและรับทราบ'},
            ${'You have received a ' + body.warning_type + ' (Notice No. ' + noticeNumber + '). Please login to read and acknowledge.'},
            'system', 'warning_notice', ${warningNotice.id}, false
          )
        `;
      } else {
        const hrUsers = await sql`SELECT id FROM employees WHERE role = 'hr' OR role = 'dev'` as any;
        for (const hrUser of hrUsers) {
          await sql`
            INSERT INTO notifications (
              employee_id, title_th, title_en, message_th, message_en,
              notification_type, related_type, related_id, is_read
            ) VALUES (
              ${hrUser.id},
              'รอการอนุมัติใบเตือน',
              'Warning notice pending approval',
              ${'ใบเตือน ' + body.warning_type + ' (เลขที่ ' + noticeNumber + ') รอการอนุมัติจากฝ่าย HR'},
              ${'Warning notice ' + body.warning_type + ' (Notice No. ' + noticeNumber + ') is pending HR approval'},
              'system', 'warning_notice', ${warningNotice.id}, false
            )
          `;
        }
      }
    } catch (notifyError) {
      console.error('❌ Notification failed (non-critical):', notifyError);
      // Do not fail the request if notification fails, the warning is already created
    }

    return successResponse({
      success: true,
      message: requiresHRApproval
        ? 'Warning notice created successfully, pending HR approval'
        : 'Warning notice created successfully',
      warningNotice: {
        id: warningNotice.id,
        notice_number: noticeNumber,
        status: initialStatus,
        requires_hr_approval: requiresHRApproval,
        expiry_date: expiryDate instanceof Date ? expiryDate.toISOString().split('T')[0] : expiryDate,
      },
    }, 201);

  } catch (error: any) {
    // Temporary detailed error logging to diagnose the issue
    console.error('❌ Warning creation error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
    });
    return errorResponse(error.message || 'Failed to create warning notice', 500);
  }
});

export { handler };
