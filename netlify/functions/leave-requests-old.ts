import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

interface LeaveRequest {
  id: string;
  request_number: string;
  employee_id: string;
  employee_code: string;
  employee_name_th: string;
  employee_name_en: string;
  department_name_th: string;
  leave_type_id: string;
  leave_type_code: string;
  leave_type_name_th: string;
  leave_type_name_en: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason_th: string;
  reason_en: string;
  attachment_urls: any;
  status: string;
  current_approval_stage: number;
  created_at: string;
  is_half_day: boolean;
  half_day_period: string | null;
  shift_type: string;
  start_time: string | null;
  end_time: string | null;
  department_admin_approved_by: string;
  department_admin_approved_at: string;
  admin_name_th: string;
  admin_name_en: string;
  department_manager_approved_by: string;
  department_manager_approved_at: string;
  manager_name_th: string;
  manager_name_en: string;
  hr_approved_by: string;
  hr_approved_at: string;
  hr_name_th: string;
  hr_name_en: string;
}

const getLeaveRequests = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const userId = event.user?.userId;
    const userRole = event.user?.role;
    const params = event.queryStringParameters || {};
    const status = params.status || 'all';
    const forApproval = params.for_approval === 'true';

    let queryText = `
      SELECT
        lr.id,
        lr.request_number,
        lr.employee_id,
        e.employee_code,
        CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name_th,
        CONCAT(e.first_name_en, ' ', e.last_name_en) as employee_name_en,
        d.name_th as department_name_th,
        lr.leave_type_id,
        lt.code as leave_type_code,
        lt.name_th as leave_type_name_th,
        lt.name_en as leave_type_name_en,
        lr.start_date,
        lr.end_date,
        lr.total_days,
        lr.reason_th,
        lr.reason_en,
        lr.attachment_urls,
        lr.status,
        lr.current_approval_stage,
        lr.created_at,
        lr.is_half_day,
        lr.half_day_period,
        lr.shift_type,
        lr.start_time,
        lr.end_time,
        e.department_id,
        e.role as employee_role,
        lr.department_admin_approved_by,
        lr.department_admin_approved_at,
        (SELECT CONCAT(first_name_th, ' ', last_name_th) FROM employees WHERE id = lr.department_admin_approved_by) as admin_name_th,
        (SELECT CONCAT(first_name_en, ' ', last_name_en) FROM employees WHERE id = lr.department_admin_approved_by) as admin_name_en,
        lr.department_manager_approved_by,
        lr.department_manager_approved_at,
        (SELECT CONCAT(first_name_th, ' ', last_name_th) FROM employees WHERE id = lr.department_manager_approved_by) as manager_name_th,
        (SELECT CONCAT(first_name_en, ' ', last_name_en) FROM employees WHERE id = lr.department_manager_approved_by) as manager_name_en,
        lr.hr_approved_by,
        lr.hr_approved_at,
        (SELECT CONCAT(first_name_th, ' ', last_name_th) FROM employees WHERE id = lr.hr_approved_by) as hr_name_th,
        (SELECT CONCAT(first_name_en, ' ', last_name_en) FROM employees WHERE id = lr.hr_approved_by) as hr_name_en
      FROM leave_requests lr
      LEFT JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
    `;

    const queryParams: any[] = [];
    const conditions: string[] = [];

    // Get user info
    const userInfo = await query(
      `SELECT department_id FROM employees WHERE id = $1`,
      [userId]
    );
    const userDeptId = userInfo[0]?.department_id;

    const approverRoles = await query(
      `SELECT approver_role FROM department_approvers WHERE employee_id = $1 AND department_id = $2 AND is_active = true`,
      [userId, userDeptId]
    );

    const userIsDeptAdmin = approverRoles.some(r => r.approver_role === 'admin');
    const userIsDeptManager = approverRoles.some(r => r.approver_role === 'manager');

    if (forApproval) {
      // ไม่แสดงคำขอของตัวเอง
      conditions.push(`lr.employee_id != $${queryParams.length + 1}`);
      queryParams.push(userId);

      if (userIsDeptAdmin) {
        conditions.push(`e.department_id = $${queryParams.length + 1}`);
        queryParams.push(userDeptId);
        conditions.push(`lr.status = 'pending'`);
      } else if (userIsDeptManager) {
        conditions.push(`e.department_id = $${queryParams.length + 1}`);
        queryParams.push(userDeptId);
        conditions.push(`lr.status = 'pending'`);
      } else if (userRole === 'hr') {
        conditions.push(`lr.status = 'pending'`);
      } else {
        conditions.push(`1 = 0`);
      }
    } else {
      // ✅ แสดงคำขอของตัวเอง
      conditions.push(`lr.employee_id = $${queryParams.length + 1}`);
      queryParams.push(userId);
    }

    // ✅ เพิ่ม status filter (รองรับ ?status=pending)
    if (!forApproval && status !== 'all') {
      conditions.push(`lr.status = $${queryParams.length + 1}`);
      queryParams.push(status);
    }

    if (conditions.length > 0) {
      queryText += ` WHERE ${conditions.join(' AND ')}`;
    }

    queryText += ` ORDER BY lr.created_at DESC`;

    console.log('=== LEAVE REQUESTS QUERY ===');
    console.log('Query:', queryText);
    console.log('Params:', queryParams);

    const leaveRequests = await query(queryText, queryParams);

    // Process attachment URLs
    const processedRequests = leaveRequests.map((req) => {
      let attachmentUrls: string[] = [];
      if (req.attachment_urls) {
        if (typeof req.attachment_urls === 'string') {
          try {
            attachmentUrls = JSON.parse(req.attachment_urls);
          } catch (e) {
            console.error('Failed to parse attachment_urls:', req.attachment_urls, e);
            attachmentUrls = [];
          }
        } else if (Array.isArray(req.attachment_urls)) {
          attachmentUrls = req.attachment_urls;
        }
      }

      return {
        ...req,
        attachment_urls: attachmentUrls,
      };
    });

    console.log(`Found ${processedRequests.length} leave requests`);

    return successResponse({ leave_requests: processedRequests });
  } catch (error: any) {
    console.error('Get leave requests error:', error);
    return errorResponse(error.message || 'Failed to get leave requests', 500);
  }
};

export const handler: Handler = requireAuth(getLeaveRequests);