import { Handler } from "@netlify/functions";
import { query } from "./utils/db";
import { requireAuth, AuthenticatedEvent } from "./utils/auth-middleware";
import { successResponse, errorResponse, handleCORS } from "./utils/response";
import { getApprovalFlow } from "./utils/approval-flow";

const getLeaveRequests = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const userId = event.user?.userId;
    const userRole = event.user?.role;
    const params = event.queryStringParameters || {};
    const status = params.status || "all";
    const forApproval = params.for_approval === "true";

    console.log("=== GET LEAVE REQUESTS ===");
    console.log("User ID:", userId);
    console.log("User Role:", userRole);
    console.log("For Approval:", forApproval);
    console.log("Status Filter:", status);

    const userInfoResult = await query(
      `SELECT department_id, is_department_admin, is_department_manager, role, employee_code FROM employees WHERE id = $1`,
      [userId],
    );
    if (userInfoResult.length === 0) {
      return errorResponse("User not found", 404);
    }
    const userInfo = userInfoResult[0];
    const {
      department_id: userDeptId,
      is_department_admin,
      is_department_manager,
      role,
      employee_code,
    } = userInfo;
    console.log("User Info:", {
      department_id: userDeptId,
      is_department_admin,
      is_department_manager,
      role,
      employee_code,
    });

    // 🔍 DEBUG: Check manager detection
    const normalizedRole = role?.toLowerCase()?.trim() || "";
    const isManagerByRole =
      normalizedRole === "manager" || role === "ผู้จัดการ";
    const isManagerByFlag = is_department_manager === true;
    console.log("🔍 [DEBUG] Manager Detection:", {
      rawRole: role,
      normalizedRole,
      isManagerByRole,
      isManagerByFlag,
      is_department_manager_type: typeof is_department_manager,
      is_department_manager_value: is_department_manager,
    });

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
        -- 🔍 DEBUG: Count managers in department for troubleshooting
        (SELECT COUNT(*) FROM employees WHERE department_id = e.department_id AND is_department_admin = true AND id != lr.employee_id AND employee_code != '999999999' AND is_active = true) as debug_dept_admin_count,
        (SELECT COUNT(*) FROM employees WHERE department_id = e.department_id AND is_department_manager = true AND id != lr.employee_id AND employee_code != '999999999' AND is_active = true) as debug_dept_manager_flag_count,
        (SELECT COUNT(*) FROM employees WHERE department_id = e.department_id AND role = 'ผู้จัดการ' AND id != lr.employee_id AND employee_code != '999999999' AND is_active = true) as debug_manager_role_th_count,
        (SELECT COUNT(*) FROM employees WHERE department_id = e.department_id AND LOWER(role) = 'manager' AND id != lr.employee_id AND employee_code != '999999999' AND is_active = true) as debug_manager_role_en_count,
        lr.department_admin_approved_by,
        lr.department_admin_approved_at,
        (
          SELECT CASE
            WHEN employee_code = '999999999' THEN NULL
            ELSE NULLIF(BTRIM(CONCAT_WS(' ', NULLIF(first_name_th, ''), NULLIF(last_name_th, ''))), '')
          END
          FROM employees
          WHERE id = lr.department_admin_approved_by
        ) as admin_name_th,
        (
          SELECT CASE
            WHEN employee_code = '999999999' THEN NULL
            ELSE NULLIF(BTRIM(CONCAT_WS(' ', NULLIF(first_name_en, ''), NULLIF(last_name_en, ''))), '')
          END
          FROM employees
          WHERE id = lr.department_admin_approved_by
        ) as admin_name_en,
        EXISTS(
          SELECT 1
          FROM employees
          WHERE id = lr.department_admin_approved_by
            AND employee_code = '999999999'
        ) as admin_approver_needs_review,
        lr.department_manager_approved_by,
        lr.department_manager_approved_at,
        (
          SELECT CASE
            WHEN employee_code = '999999999' THEN NULL
            ELSE NULLIF(BTRIM(CONCAT_WS(' ', NULLIF(first_name_th, ''), NULLIF(last_name_th, ''))), '')
          END
          FROM employees
          WHERE id = lr.department_manager_approved_by
        ) as manager_name_th,
        (
          SELECT CASE
            WHEN employee_code = '999999999' THEN NULL
            ELSE NULLIF(BTRIM(CONCAT_WS(' ', NULLIF(first_name_en, ''), NULLIF(last_name_en, ''))), '')
          END
          FROM employees
          WHERE id = lr.department_manager_approved_by
        ) as manager_name_en,
        EXISTS(
          SELECT 1
          FROM employees
          WHERE id = lr.department_manager_approved_by
            AND employee_code = '999999999'
        ) as manager_approver_needs_review,
        lr.hr_approved_by,
        lr.hr_approved_at,
        (
          SELECT CASE
            WHEN employee_code = '999999999' THEN NULL
            ELSE NULLIF(BTRIM(CONCAT_WS(' ', NULLIF(first_name_th, ''), NULLIF(last_name_th, ''))), '')
          END
          FROM employees
          WHERE id = lr.hr_approved_by
        ) as hr_name_th,
        (
          SELECT CASE
            WHEN employee_code = '999999999' THEN NULL
            ELSE NULLIF(BTRIM(CONCAT_WS(' ', NULLIF(first_name_en, ''), NULLIF(last_name_en, ''))), '')
          END
          FROM employees
          WHERE id = lr.hr_approved_by
        ) as hr_name_en,
        EXISTS(
          SELECT 1
          FROM employees
          WHERE id = lr.hr_approved_by
            AND employee_code = '999999999'
        ) as hr_approver_needs_review,
        CASE
          WHEN lr.status != 'pending' THEN NULL
          WHEN lr.current_approval_stage = 1 THEN COALESCE(
             -- 🏥 Case 1: HR Request -> Priority: Other HR (not self) -> Admin Dept Manager
             CASE WHEN e.role = 'hr' THEN (
               SELECT COALESCE(
                 -- First try: Other HRs
                 (SELECT STRING_AGG(NULLIF(BTRIM(CONCAT_WS(' ', NULLIF(first_name_th, ''), NULLIF(last_name_th, ''))), ''), ', ')
                  FROM employees 
                  WHERE role = 'hr' AND id != lr.employee_id AND employee_code != '999999999' AND is_active = true),
                 -- Fallback: Admin Dept Manager
                 (SELECT STRING_AGG(NULLIF(BTRIM(CONCAT_WS(' ', NULLIF(first_name_th, ''), NULLIF(last_name_th, ''))), ''), ', ')
                  FROM employees 
                  WHERE is_department_manager = true 
                    AND department_id = (SELECT id FROM departments WHERE department_code = 'ADMIN' OR name_en ILIKE '%Admin%' LIMIT 1)
                    AND employee_code != '999999999' AND is_active = true)
               )
             ) END,
             
             -- 👔 Case 2: Manager Request -> Priority: HR
             CASE WHEN e.is_department_manager = true OR LOWER(e.role) = 'manager' OR e.role = 'ผู้จัดการ' THEN (
                SELECT STRING_AGG(NULLIF(BTRIM(CONCAT_WS(' ', NULLIF(first_name_th, ''), NULLIF(last_name_th, ''))), ''), ', ')
                FROM employees 
                WHERE role = 'hr' AND id != lr.employee_id AND employee_code != '999999999' AND is_active = true
             ) END,

             -- 👤 Case 3: Regular Employee -> Department Manager
             (SELECT STRING_AGG(NULLIF(BTRIM(CONCAT_WS(' ', NULLIF(first_name_th, ''), NULLIF(last_name_th, ''))), ''), ', ')
              FROM employees 
              WHERE department_id = e.department_id AND (is_department_manager = true OR LOWER(role) = 'manager' OR role = 'ผู้จัดการ') AND id != lr.employee_id AND employee_code != '999999999' AND is_active = true)
          )
          WHEN lr.current_approval_stage = 2 THEN (
             -- Stage 2: HR Confirmation (Always)
             SELECT STRING_AGG(NULLIF(BTRIM(CONCAT_WS(' ', NULLIF(first_name_th, ''), NULLIF(last_name_th, ''))), ''), ', ')
             FROM employees 
             WHERE role = 'hr' AND id != lr.employee_id AND employee_code != '999999999' AND is_active = true
          )
          ELSE NULL
        END as next_approver_name_th,
        CASE
          WHEN lr.status != 'pending' THEN NULL
          WHEN lr.current_approval_stage = 1 THEN COALESCE(
             -- 🏥 Case 1: HR Request -> Priority: Other HR (not self) -> Admin Dept Manager
             CASE WHEN e.role = 'hr' THEN (
               SELECT COALESCE(
                 -- First try: Other HRs
                 (SELECT STRING_AGG(NULLIF(BTRIM(CONCAT_WS(' ', NULLIF(first_name_en, ''), NULLIF(last_name_en, ''))), ''), ', ')
                  FROM employees 
                  WHERE role = 'hr' AND id != lr.employee_id AND employee_code != '999999999' AND is_active = true),
                 -- Fallback: Admin Dept Manager
                 (SELECT STRING_AGG(NULLIF(BTRIM(CONCAT_WS(' ', NULLIF(first_name_en, ''), NULLIF(last_name_en, ''))), ''), ', ')
                  FROM employees 
                  WHERE is_department_manager = true 
                    AND department_id = (SELECT id FROM departments WHERE department_code = 'ADMIN' OR name_en ILIKE '%Admin%' LIMIT 1)
                    AND employee_code != '999999999' AND is_active = true)
               )
             ) END,
             
             -- 👔 Case 2: Manager Request -> Priority: HR
             CASE WHEN e.is_department_manager = true OR LOWER(e.role) = 'manager' OR e.role = 'ผู้จัดการ' THEN (
                SELECT STRING_AGG(NULLIF(BTRIM(CONCAT_WS(' ', NULLIF(first_name_en, ''), NULLIF(last_name_en, ''))), ''), ', ')
                FROM employees 
                WHERE role = 'hr' AND id != lr.employee_id AND employee_code != '999999999' AND is_active = true
             ) END,

             -- 👤 Case 3: Regular Employee -> Department Manager
             (SELECT STRING_AGG(NULLIF(BTRIM(CONCAT_WS(' ', NULLIF(first_name_en, ''), NULLIF(last_name_en, ''))), ''), ', ')
              FROM employees 
              WHERE department_id = e.department_id AND (is_department_manager = true OR LOWER(role) = 'manager' OR role = 'ผู้จัดการ') AND id != lr.employee_id AND employee_code != '999999999' AND is_active = true)
          )
          WHEN lr.current_approval_stage = 2 THEN (
             -- Stage 2: HR Confirmation (Always)
             SELECT STRING_AGG(NULLIF(BTRIM(CONCAT_WS(' ', NULLIF(first_name_en, ''), NULLIF(last_name_en, ''))), ''), ', ')
             FROM employees 
             WHERE role = 'hr' AND id != lr.employee_id AND employee_code != '999999999' AND is_active = true
          )
          ELSE NULL
        END as next_approver_name_en
      FROM leave_requests lr
      LEFT JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE 1=1
    `;
    const queryParams: any[] = [];

    const forVoidManagement = params.for_void_management === "true";
    const forApprovalHistory = params.for_approval_history === "true";

    // 📜 Approval History mode: Show requests that this user has approved/rejected
    if (forApprovalHistory) {
      console.log(
        "📜 Approval History mode: Showing requests approved/rejected by user",
      );

      // Filter by status if provided
      if (status === "approved") {
        queryText += ` AND lr.status = 'approved'`;
      } else if (status === "rejected") {
        queryText += ` AND lr.status = 'rejected'`;
      } else {
        queryText += ` AND lr.status IN ('approved', 'rejected')`;
      }

      // Only show requests where this user was an approver
      queryText += ` AND (lr.department_manager_approved_by = $${queryParams.length + 1} OR lr.hr_approved_by = $${queryParams.length + 1})`;
      queryParams.push(userId);
    } else if (forVoidManagement) {
      if (role !== "hr" && role !== "admin") {
        return errorResponse(
          "Only HR and Admin can access void management",
          403,
        );
      }
      if (status !== "all") {
        queryText += ` AND lr.status = $${queryParams.length + 1}`;
        queryParams.push(status);
      } else {
        queryText += ` AND lr.status IN ('approved', 'voided')`;
      }
      console.log(
        "🚫 Void Management mode: HR/Admin viewing all approved/voided requests",
      );
    } else if (forApproval) {
      queryText += ` AND lr.status = 'pending'`;

      if (normalizedRole === "hr" || normalizedRole === "admin") {
        console.log(
          "🏢 HR/Admin: See ALL requests (including own), all departments",
        );
      } else {
        queryText += ` AND lr.employee_id != $${queryParams.length + 1}`;
        queryParams.push(userId);

        // ✅ Use isManagerByRole (case-insensitive) instead of raw role comparison
        const canSeeApprovals =
          is_department_admin || isManagerByFlag || isManagerByRole;
        console.log("🔍 [DEBUG] canSeeApprovals decision:", {
          is_department_admin,
          isManagerByFlag,
          isManagerByRole,
          result: canSeeApprovals,
        });
        let allDeptIds: string[] = [userDeptId];

        if (canSeeApprovals) {
          const additionalDepts = await query(
            `SELECT department_id FROM employee_department_permissions 
             WHERE employee_id = $1 AND permission_type = 'approve' AND is_active = true`,
            [userId],
          );

          const additionalDeptIds = additionalDepts.map(
            (d: { department_id: string }) => d.department_id,
          );
          allDeptIds = [userDeptId, ...additionalDeptIds];

          const placeholders = allDeptIds
            .map((_, i) => `$${queryParams.length + 1 + i}`)
            .join(", ");
          queryText += ` AND e.department_id IN (${placeholders})`;
          queryParams.push(...allDeptIds);

          console.log(
            `🏢 Dept Admin/Manager: See requests for ${allDeptIds.length} dept(s):`,
            allDeptIds,
          );
        } else {
          queryText += ` AND 1 = 0`;
          console.log("❌ Regular employee: cannot approve");
        }

        (global as any).__temp_allDeptIds = allDeptIds;
      }
    } else {
      queryText += ` AND lr.employee_id = $${queryParams.length + 1}`;
      queryParams.push(userId);
      if (status !== "all") {
        queryText += ` AND lr.status = $${queryParams.length + 1}`;
        queryParams.push(status);
      }
      console.log("👤 Personal mode: show own requests");
    }
    queryText += ` ORDER BY lr.created_at DESC`;
    console.log("SQL Query:", queryText);
    console.log("Params:", queryParams);

    const leaveRequests = await query(queryText, queryParams);
    console.log(`📊 Found ${leaveRequests.length} requests (before filtering)`);

    let filteredRequests = leaveRequests;
    // ✅ Use normalized role check (case-insensitive)
    const isManagerRole = isManagerByRole || isManagerByFlag;
    console.log("🔍 [DEBUG] isManagerRole for filtering:", isManagerRole);
    if (
      forApproval &&
      (normalizedRole === "hr" ||
        normalizedRole === "admin" ||
        is_department_admin ||
        isManagerRole)
    ) {
      const uniqueEmployeeIds = [
        ...new Set(leaveRequests.map((req) => req.employee_id)),
      ];

      const approvalFlowPromises = uniqueEmployeeIds.map(async (employeeId) => {
        try {
          const flow = await getApprovalFlow(employeeId);
          return { employeeId, flow, error: null };
        } catch (error) {
          console.error(
            `Error fetching approval flow for employee ${employeeId}:`,
            error,
          );
          return { employeeId, flow: null, error };
        }
      });

      const approvalFlowResults = await Promise.all(approvalFlowPromises);

      const approvalFlowMap = new Map();
      approvalFlowResults.forEach(({ employeeId, flow, error }) => {
        if (!error && flow) {
          approvalFlowMap.set(employeeId, flow);
        }
      });

      const resultRequests = [];
      for (const request of leaveRequests) {
        try {
          const flow = approvalFlowMap.get(request.employee_id);
          if (!flow) {
            console.warn(
              `No approval flow found for employee ${request.employee_id}, skipping request`,
            );
            continue;
          }

          const currentStage = request.current_approval_stage || 1;
          const stageInfo = flow.stages.find(
            (s: { stage: number; role: string }) => s.stage === currentStage,
          );
          let canApprove = false;
          let shouldInclude = false;

          if (role === "hr") {
            shouldInclude = true;
            canApprove = true;
            if (request.employee_id === userId) {
              canApprove = false;
            }
          } else if (role === "admin") {
            shouldInclude = true;
            canApprove = false;
          } else {
            if (stageInfo) {
              const allDeptIds: string[] = (global as any)
                .__temp_allDeptIds || [userDeptId];
              const canApproveThisDept = allDeptIds.includes(
                request.department_id,
              );

              if (isManagerRole && canApproveThisDept) {
                if (stageInfo.role === "department_manager") {
                  canApprove = true;
                  shouldInclude = true;
                }
              }

              if (stageInfo.role === "hr") {
                // HR can approve
                if (role === "hr") {
                  canApprove = true;
                  shouldInclude = true;
                }
              }

              if (stageInfo.role === "hr_or_admin_manager") {
                // HR OR Admin Dept Manager can approve
                if (role === "hr") {
                  canApprove = true;
                  shouldInclude = true;
                }
                // Check if user is Admin Dept Manager
                if (isManagerRole) {
                  // Admin Dept Manager implies they are a manager.
                  // We rely on 'canApproveThisDept' to filter if they are in the right department (Admin).
                  // Since HR requests (requester) are in Admin Dept (usually),
                  // and canApproveThisDept checks if manager has auth over requester's dept,
                  // this matches correctly.
                  if (canApproveThisDept) {
                    canApprove = true;
                    shouldInclude = true;
                  }
                }
              }
            }
          }

          if (shouldInclude) {
            resultRequests.push({
              ...request,
              canApprove,
              approvalStage: stageInfo ? stageInfo.role : null,
            });
          }
        } catch (error) {
          console.error(
            `Error checking approval for request ${request.id}:`,
            error,
          );
        }
      }
      filteredRequests = resultRequests;
      console.log(
        `✅ Final: ${filteredRequests.length} requests (canApprove set)`,
      );
    }

    const processedRequests = filteredRequests.map((req) => {
      let attachmentUrls: string[] = [];
      if (req.attachment_urls) {
        if (typeof req.attachment_urls === "string") {
          try {
            attachmentUrls = JSON.parse(req.attachment_urls);
          } catch (e) {
            console.error(
              "Failed to parse attachment_urls:",
              req.attachment_urls,
              e,
            );
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

    console.log(`📤 Returning ${processedRequests.length} leave requests`);
    return successResponse({
      leave_requests: processedRequests,
      success: true,
    });
  } catch (error: any) {
    console.error("❌ Get leave requests error:", error);
    return errorResponse(error.message || "Failed to get leave requests", 500);
  }
};

export const handler: Handler = requireAuth(getLeaveRequests);
