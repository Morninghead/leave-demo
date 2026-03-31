import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { getApprovalFlow } from './utils/approval-flow';

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

    console.log('=== GET LEAVE REQUESTS ===');
    console.log('User ID:', userId);
    console.log('User Role:', userRole);
    console.log('For Approval:', forApproval);
    console.log('Status Filter:', status);

    // Get current user's info
    const userInfoResult = await query(
      `SELECT department_id, is_department_admin, is_department_manager, role FROM employees WHERE id = $1`,
      [userId]
    );
    if (userInfoResult.length === 0) {
      return errorResponse('User not found', 404);
    }
    const userInfo = userInfoResult[0];
    const { department_id: userDeptId, is_department_admin, is_department_manager, role } = userInfo;
    console.log('User Info:', { department_id: userDeptId, is_department_admin, is_department_manager, role });

    // Full display info query for dashboard and tracking
    let queryText = `
      SELECT
        lr.id,
        lr.request_number,
        lr.employee_id,
        e.employee_code,
        CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name_th,
        CONCAT(e.first_name_en, ' ', e.last_name_en) as employee_name_en,
        d.name_th as department_name_th,
        d.name_en as department_name_en,
        lr.leave_type_id,
        lt.code as leave_type_code,
        lt.name_th as leave_type_name_th,
        lt.name_en as leave_type_name_en,
        lr.start_date,
        lr.end_date,
        lr.total_days,
        lr.reason,
        lr.reason_language,
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
        e.is_department_admin as employee_is_dept_admin,
        e.is_department_manager as employee_is_dept_manager,
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
      WHERE 1=1
    `;
    const queryParams: any[] = [];

    if (forApproval) {
      queryText += ` AND lr.status = 'pending'`;

      // ✅ HR เห็นทุก request รวมของตัวเอง (แต่อนุมัติของตัวเองไม่ได้ - ตรวจสอบใน canApprove)
      // Dept Admin/Manager กรอง request ของตัวเองออก
      if (role === 'hr') {
        console.log('🏢 HR: See ALL requests (including own), all departments');
        // ไม่กรองของตัวเองออก
      } else {
        // Dept Admin/Manager ไม่ควรเห็น request ของตัวเอง
        queryText += ` AND lr.employee_id != $${queryParams.length + 1}`;
        queryParams.push(userId);

        if (is_department_admin || is_department_manager) {
          queryText += ` AND e.department_id = $${queryParams.length + 1}`;
          queryParams.push(userDeptId);
          console.log(`🏢 Dept Admin/Manager: See all for dept ${userDeptId} (excluding own)`);
        } else {
          queryText += ` AND 1 = 0`;
          console.log('❌ Regular employee: cannot approve');
        }
      }
    } else {
      // Personal requests
      queryText += ` AND lr.employee_id = $${queryParams.length + 1}`;
      queryParams.push(userId);
      if (status !== 'all') {
        queryText += ` AND lr.status = $${queryParams.length + 1}`;
        queryParams.push(status);
      }
      console.log('👤 Personal mode: show own requests');
    }
    queryText += ` ORDER BY lr.created_at DESC`;
    console.log('SQL Query:', queryText);
    console.log('Params:', queryParams);

    const leaveRequests = await query(queryText, queryParams);
    console.log(`📊 Found ${leaveRequests.length} requests (before filtering)`);

    // Optimized approval flow processing to fix N+1 query problem
    let filteredRequests = leaveRequests;
    if (forApproval && (role === 'hr' || is_department_admin || is_department_manager)) {
      // ✅ BATCH PROCESSING: Get all unique employee IDs first
      const uniqueEmployeeIds = [...new Set(leaveRequests.map(req => req.employee_id))];

      // ✅ BATCH PROCESSING: Fetch all approval flows in parallel (major performance improvement)
      const approvalFlowPromises = uniqueEmployeeIds.map(async (employeeId) => {
        try {
          const flow = await getApprovalFlow(employeeId);
          return { employeeId, flow, error: null };
        } catch (error) {
          console.error(`Error fetching approval flow for employee ${employeeId}:`, error);
          return { employeeId, flow: null, error };
        }
      });

      const approvalFlowResults = await Promise.all(approvalFlowPromises);

      // ✅ Create lookup map for O(1) access instead of repeated queries
      const approvalFlowMap = new Map();
      approvalFlowResults.forEach(({ employeeId, flow, error }) => {
        if (!error && flow) {
          approvalFlowMap.set(employeeId, flow);
        }
      });

      // ✅ PROCESS REQUESTS using cached approval flows (no more N+1 queries)
      const resultRequests = [];
      for (const request of leaveRequests) {
        try {
          const flow = approvalFlowMap.get(request.employee_id);
          if (!flow) {
            console.warn(`No approval flow found for employee ${request.employee_id}, skipping request`);
            continue;
          }

          const currentStage = request.current_approval_stage || 1; // ✅ ถ้าเป็น null ให้ใช้ 1
          const stageInfo = flow.stages.find(s => s.stage === currentStage);
          let canApprove = false;
          let shouldInclude = false;

          // ✅ HR sees ALL requests regardless of stage (must check BEFORE stageInfo check)
          if (role === 'hr') {
            shouldInclude = true; // HR sees everything
            // ⭐ HR has SUPER APPROVAL POWER - can approve at ANY stage
            canApprove = true;
            // Prevent self-approval
            if (request.employee_id === userId) {
              canApprove = false;
            }
          } else if (role === 'admin') {
            // ⭐ Admin also has SUPER APPROVAL POWER
            shouldInclude = true;
            canApprove = true;
            if (request.employee_id === userId) {
              canApprove = false;
            }
          } else {
            // Dept Admin/Manager only see what they can approve
            if (stageInfo) {
              if (stageInfo.role === 'department_admin') {
                canApprove = is_department_admin && userDeptId === request.department_id;
                shouldInclude = canApprove;
              } else if (stageInfo.role === 'department_manager') {
                canApprove = is_department_manager && userDeptId === request.department_id;
                shouldInclude = canApprove;
              } else if (stageInfo.role === 'hr') {
                // Dept Admin/Manager ที่มี role HR ก็อนุมัติได้
                canApprove = role === 'hr';
                shouldInclude = canApprove;
              }
            }
          }

          if (shouldInclude) {
            resultRequests.push({
              ...request,
              canApprove,
              approvalStage: stageInfo ? stageInfo.role : null
            });
          }
        } catch (error) {
          console.error(`Error checking approval for request ${request.id}:`, error);
        }
      }
      filteredRequests = resultRequests;
      console.log(`✅ Final: ${filteredRequests.length} requests (canApprove set)`);
    }

    // Parse attachment_urls as array
    const processedRequests = filteredRequests.map((req) => {
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
        attachment_urls: attachmentUrls
      };
    });

    console.log(`📤 Returning ${processedRequests.length} leave requests`);
    return successResponse({
      leave_requests: processedRequests,
      success: true
    });

  } catch (error: any) {
    console.error('❌ Get leave requests error:', error);
    return errorResponse(error.message || 'Failed to get leave requests', 500);
  }
};

export const handler: Handler = requireAuth(getLeaveRequests);
