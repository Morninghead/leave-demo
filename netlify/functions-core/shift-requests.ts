// netlify/functions/shift-requests.ts
import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { getApprovalFlow } from './utils/approval-flow';

const getShiftRequests = async (event: AuthenticatedEvent) => {
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

    console.log('=== GET SHIFT SWAP REQUESTS ===');
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

    let queryText = `
      SELECT
        sr.id,
        sr.request_number,
        sr.employee_id,
        e.employee_code,
        CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name_th,
        CONCAT(e.first_name_en, ' ', e.last_name_en) as employee_name_en,
        d.name_th as department_name_th,
        d.name_en as department_name_en,
        sr.work_date,
        sr.off_date,
        sr.reason_th,
        sr.reason_en,
        sr.status,
        sr.department_admin_approved_by,
        sr.department_admin_approved_at,
        sr.department_manager_approved_by,
        sr.department_manager_approved_at,
        sr.hr_approved_by,
        sr.hr_approved_at,
        sr.rejection_reason_th,
        sr.rejection_reason_en,
        sr.created_at,
        sr.updated_at,
        sr.current_approval_stage,
        e.department_id,
        e.role as employee_role,
        e.is_department_admin as employee_is_dept_admin,
        e.is_department_manager as employee_is_dept_manager
      FROM shift_swap_requests sr
      LEFT JOIN employees e ON sr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];

    if (forApproval) {
      queryText += ` AND sr.status = 'pending'`;

      // ✅ HR เห็นทุก request รวมของตัวเอง (แต่อนุมัติของตัวเองไม่ได้ - ตรวจสอบใน canApprove)
      // Dept Admin/Manager กรอง request ของตัวเองออก
      if (role === 'hr') {
        console.log('🏢 HR: See ALL requests (including own), all departments');
        // ไม่กรองของตัวเองออก
      } else {
        // Dept Admin/Manager ไม่ควรเห็น request ของตัวเอง
        queryText += ` AND sr.employee_id != $${queryParams.length + 1}`;
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
      queryText += ` AND sr.employee_id = $${queryParams.length + 1}`;
      queryParams.push(userId);
      if (status !== 'all') {
        queryText += ` AND sr.status = $${queryParams.length + 1}`;
        queryParams.push(status);
      }
      console.log('👤 Personal mode: show own requests');
    }

    queryText += ` ORDER BY sr.created_at DESC`;
    console.log('SQL Query:', queryText);
    console.log('Params:', queryParams);

    const shiftRequests = await query(queryText, queryParams);
    console.log(`📊 Found ${shiftRequests.length} requests (before filtering)`);

    // Filter by approval stage (same logic as leave requests)
    let filteredRequests = shiftRequests;
    if (forApproval && (role === 'hr' || is_department_admin || is_department_manager)) {
      const resultRequests = [];
      for (const request of shiftRequests) {
        try {
          const flow = await getApprovalFlow(request.employee_id);
          const currentStage = request.current_approval_stage || 1; // ✅ ถ้าเป็น null ให้ใช้ 1
          const stageInfo = flow.stages.find(s => s.stage === currentStage);
          let canApprove = false;
          let shouldInclude = false;

          // ✅ HR sees ALL requests regardless of stage (must check BEFORE stageInfo check)
          if (role === 'hr') {
            shouldInclude = true; // HR sees everything
            // Set canApprove based on stage
            if (stageInfo && stageInfo.role === 'hr') {
              canApprove = true;
            }
            // Prevent self-approval
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

    console.log(`📤 Returning ${filteredRequests.length} shift swap requests`);
    return successResponse({
      shift_requests: filteredRequests,
      success: true
    });
  } catch (error: any) {
    console.error('❌ Get shift requests error:', error);
    return errorResponse(error.message || 'Failed to get shift requests', 500);
  }
};

export const handler: Handler = requireAuth(getShiftRequests);
