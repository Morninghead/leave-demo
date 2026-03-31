// netlify/functions/utils/approval-flow.ts - Enhanced with auto-skip logic
import { logger } from './logger';

import { query } from './db';

export interface ApproverInfo {
  id: string;
  employee_code: string;
  name: string;
  name_th: string;
  name_en: string;
  role: 'department_admin' | 'department_manager' | 'hr' | 'hr_or_admin_manager';
}

export interface ApprovalStage {
  stage: number;
  role: 'department_admin' | 'department_manager' | 'hr' | 'hr_or_admin_manager';
  description_th: string;
  description_en: string;
  isAutoSkipped?: boolean;
  autoSkipReason?: string;
  approvers?: ApproverInfo[];
}

export interface ApprovalFlow {
  stages: ApprovalStage[];
  totalStages: number;
  currentStage: number;
  skippedStages?: number[];
  autoSkipReason?: string;
}

export interface ApprovalFlowWithSkip extends ApprovalFlow {
  initialStage: number;
  skippedStages: number[];
  autoSkipReason: string;
  approvers?: ApproverInfo[];
}

export async function getApprovalFlow(employeeId: string): Promise<ApprovalFlow> {
  const employeeResult = await query(
    `SELECT role, is_department_admin, is_department_manager
     FROM employees
     WHERE id = $1`,
    [employeeId]
  );

  if (employeeResult.length === 0) {
    throw new Error('Employee not found');
  }

  const employee = employeeResult[0];
  const { role, is_department_admin: _is_department_admin, is_department_manager } = employee;

  const stages: ApprovalStage[] = role === 'hr'
    ? [
      {
        stage: 1,
        role: 'hr_or_admin_manager',
        description_th: 'HR หรือ Manager แผนก Admin อนุมัติ',
        description_en: 'HR or Admin Dept Manager Approval',
      },
      {
        stage: 2,
        role: 'hr',
        description_th: 'HR ยืนยัน',
        description_en: 'HR Confirmation',
      },
    ]
    : is_department_manager
      ? [
      {
        stage: 1,
        role: 'hr',
        description_th: 'HR อนุมัติ',
        description_en: 'HR Approval',
      },
      {
        stage: 2,
        role: 'hr',
        description_th: 'HR ยืนยัน',
        description_en: 'HR Confirmation',
      },
    ]
      : [
      {
        stage: 1,
        role: 'department_manager',
        description_th: 'Manager แผนกอนุมัติ',
        description_en: 'Department Manager Approval',
      },
      {
        stage: 2,
        role: 'hr',
        description_th: 'HR ยืนยัน',
        description_en: 'HR Confirmation',
      },
    ];

  return {
    stages,
    totalStages: stages.length,
    currentStage: 1,
  };
}

export function getNextStage(
  currentStage: number,
  totalStages: number
): number | null {
  if (currentStage < totalStages) {
    return currentStage + 1;
  }
  return null;
}

export async function canUserApprove(
  userId: string,
  employeeId: string,
  departmentId: string,
  currentStage: number
): Promise<{ allowed: boolean; reason?: string; isSkippingStage?: boolean; skipMessage?: string; shouldBypassToFinal?: boolean }> {

  logger.log('🔍 [APPROVAL] Checking approval permission:', {
    userId: userId,
    employeeId: employeeId,
    departmentId: departmentId,
    currentStage
  });

  // ✅ Get user info FIRST
  const userResult = await query(
    `SELECT role, department_id, is_department_admin, is_department_manager, employee_code
     FROM employees
     WHERE id = $1`,
    [userId]
  );

  if (userResult.length === 0) {
    logger.log('❌ [APPROVAL] User not found');
    return { allowed: false, reason: 'User not found' };
  }

  const user = userResult[0];
  logger.log('✅ [APPROVAL] User info:', {
    role: user.role,
    departmentId: user.department_id,
    isDeptAdmin: user.is_department_admin,
    isDeptManager: user.is_department_manager
  });

  // ❌ Cannot approve own request
  if (userId === employeeId) {
    logger.log('❌ [APPROVAL] Cannot approve own request');
    return { allowed: false, reason: 'Cannot approve own request' };
  }

  // Get approval flow
  const flow = await getApprovalFlow(employeeId);
  const currentStageInfo = flow.stages.find((s) => s.stage === currentStage);

  if (!currentStageInfo) {
    logger.log('❌ [APPROVAL] Invalid approval stage:', currentStage);
    return { allowed: false, reason: 'Invalid approval stage' };
  }

  logger.log('✅ [APPROVAL] Current stage info:', {
    stage: currentStageInfo.stage,
    requiredRole: currentStageInfo.role
  });

  // ❌ Admin CANNOT approve - this role is for viewing reports only
  if (user.role === 'admin') {
    logger.log('❌ [APPROVAL] Admin role cannot approve requests');
    return {
      allowed: false,
      reason: 'Admin role does not have permission to approve requests. Only HR, Department Admin, and Department Manager can approve.'
    };
  }

  // ⭐ SUPER APPROVAL POWER: HR can approve at any stage and bypass remaining stages
  if (user.role === 'hr') {
    const stageRole = currentStageInfo.role as string;
    const isCorrectStage = stageRole === 'hr';
    
    if (isCorrectStage) {
      logger.log(`✅ [APPROVAL] ${user.role} is approving at correct stage (or as super user)`);
      if (stageRole === 'hr') {
         return { allowed: true };
      }
      logger.log('⭐ [APPROVAL] HR is approving at stage', currentStage, '(normally requires', currentStageInfo.role + ') - BYPASSING TO FINAL APPROVAL');
      return {
        allowed: true,
        isSkippingStage: true,
        skipMessage: `HR is approving at stage ${currentStage} and bypassing to final approval (normally requires ${currentStageInfo.role})`,
        shouldBypassToFinal: true
      };
    }

    logger.log('⭐ [APPROVAL] HR is approving at stage', currentStage, '(normally requires', currentStageInfo.role + ') - BYPASSING TO FINAL APPROVAL');
    return {
      allowed: true,
      isSkippingStage: true,
      skipMessage: `HR is approving at stage ${currentStage} and bypassing to final approval (normally requires ${currentStageInfo.role})`,
      shouldBypassToFinal: true
    };
  }

  // Check role-based permissions
  if (currentStageInfo.role === 'department_manager') {
    // ⭐ Check if user has multi-department permission for this department
    const hasMultiDeptPermission = await query(
      `SELECT 1 FROM employee_department_permissions 
       WHERE employee_id = $1 AND department_id = $2 
       AND permission_type IN ('approve', 'manage') AND is_active = true`,
      [userId, departmentId]
    );

    // ✅ Check if it's their own department (and they are a manager) OR if they have explicit multi-dept permission
    const isManagerRole = user.is_department_manager || user.role === 'manager';
    if ((isManagerRole && user.department_id === departmentId) || hasMultiDeptPermission.length > 0) {
      logger.log('✅ [APPROVAL] User is authorized as department manager (own dept or multi-dept permission)');
      return { allowed: true };
    }
    logger.log('❌ [APPROVAL] User is not a department manager or different department');
    return {
      allowed: false,
      reason: 'You must be a department manager in the same department to approve at this stage'
    };
  }

  // 🆕 HR or Admin Manager Approval (for HR leaves)
  if (currentStageInfo.role === 'hr_or_admin_manager') {
    // 1. Any HR can approve
    if (user.role === 'hr') {
      logger.log('✅ [APPROVAL] HR is authorized to approve other HR leave');
      return { allowed: true };
    }

    // 2. Admin Department Manager can approve
    const isAdminDeptManager = await query(
      `SELECT 1 FROM employees e
       JOIN departments d ON e.department_id = d.id
       WHERE e.id = $1 
         AND e.is_department_manager = true
         AND (d.department_code = 'ADMIN' OR d.name_en ILIKE '%Admin%')`,
      [userId]
    );

    if (isAdminDeptManager.length > 0) {
      logger.log('✅ [APPROVAL] Admin Dept Manager is authorized to approve HR leave');
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: 'Only HR or Admin Department Manager can approve this request'
    };
  }


  logger.log('❌ [APPROVAL] No matching authorization found');
  return {
    allowed: false,
    reason: `You are not authorized to approve at stage ${currentStage}`,
  };
}

/**
 * Enhanced approval flow that detects and auto-skips stages where requester is the only approver
 * This prevents requests from getting stuck when admin/manager creates their own leave request
 */
export async function getStageApprovers(
  departmentId: string,
  role: 'department_admin' | 'department_manager' | 'hr' | 'hr_or_admin_manager',
  requesterEmployeeId?: string
): Promise<ApproverInfo[]> {
  logger.log(`🔍 [APPROVERS] Getting ${role} approvers for department: ${departmentId}`);

  const approversQuery = role === 'hr'
    ? `
      SELECT id, employee_code,
             CASE
               WHEN first_name_th IS NOT NULL AND last_name_th IS NOT NULL THEN first_name_th || ' ' || last_name_th
               WHEN first_name_en IS NOT NULL AND last_name_en IS NOT NULL THEN first_name_en || ' ' || last_name_en
               WHEN first_name_th IS NOT NULL THEN first_name_th
               WHEN first_name_en IS NOT NULL THEN first_name_en
               ELSE employee_code
             END as name,
             '${role}' as role
      FROM employees
      WHERE role = 'hr'
      AND is_active = true
      AND employee_code != '999999999'
      ${requesterEmployeeId ? `AND id != '${requesterEmployeeId}'` : ''}
      ORDER BY employee_code
    `
    : role === 'hr_or_admin_manager'
      ? `
      SELECT id, employee_code,
             CASE
               WHEN first_name_th IS NOT NULL AND last_name_th IS NOT NULL THEN first_name_th || ' ' || last_name_th
               WHEN first_name_en IS NOT NULL AND last_name_en IS NOT NULL THEN first_name_en || ' ' || last_name_en
               WHEN first_name_th IS NOT NULL THEN first_name_th
               WHEN first_name_en IS NOT NULL THEN first_name_en
               ELSE employee_code
             END as name,
             role
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE (
        (e.role = 'hr') OR 
        (e.is_department_manager = true AND (d.department_code = 'ADMIN' OR d.name_en ILIKE '%Admin%'))
      )
      AND e.is_active = true
      AND e.employee_code != '999999999'
      ${requesterEmployeeId ? `AND e.id != '${requesterEmployeeId}'` : ''}
      ORDER BY e.employee_code
    `
      : role === 'department_manager'
        ? `
        WITH approver_candidates AS (
          SELECT
            e.id,
            e.employee_code,
            CASE
              WHEN e.first_name_th IS NOT NULL AND e.last_name_th IS NOT NULL THEN e.first_name_th || ' ' || e.last_name_th
              WHEN e.first_name_en IS NOT NULL AND e.last_name_en IS NOT NULL THEN e.first_name_en || ' ' || e.last_name_en
              WHEN e.first_name_th IS NOT NULL THEN e.first_name_th
              WHEN e.first_name_en IS NOT NULL THEN e.first_name_en
              ELSE e.employee_code
            END AS name,
            '${role}' AS role
          FROM employees e
          WHERE e.department_id = $1
            AND (e.is_department_manager = true OR LOWER(e.role) = 'manager' OR e.role = 'ผู้จัดการ')
            AND e.is_active = true
            AND e.employee_code != '999999999'
            AND ($2::uuid IS NULL OR e.id <> $2)

          UNION

          SELECT
            e.id,
            e.employee_code,
            CASE
              WHEN e.first_name_th IS NOT NULL AND e.last_name_th IS NOT NULL THEN e.first_name_th || ' ' || e.last_name_th
              WHEN e.first_name_en IS NOT NULL AND e.last_name_en IS NOT NULL THEN e.first_name_en || ' ' || e.last_name_en
              WHEN e.first_name_th IS NOT NULL THEN e.first_name_th
              WHEN e.first_name_en IS NOT NULL THEN e.first_name_en
              ELSE e.employee_code
            END AS name,
            '${role}' AS role
          FROM employee_department_permissions p
          JOIN employees e ON e.id = p.employee_id
          WHERE p.department_id = $1
            AND p.permission_type IN ('approve', 'manage')
            AND p.is_active = true
            AND e.is_active = true
            AND e.employee_code != '999999999'
            AND ($2::uuid IS NULL OR e.id <> $2)
        )
        SELECT DISTINCT ON (id)
               id,
               employee_code,
               name,
               role
        FROM approver_candidates
        ORDER BY id, employee_code
      `
        : `
        SELECT id, employee_code,
               CASE
                 WHEN first_name_th IS NOT NULL AND last_name_th IS NOT NULL THEN first_name_th || ' ' || last_name_th
                 WHEN first_name_en IS NOT NULL AND last_name_en IS NOT NULL THEN first_name_en || ' ' || last_name_en
                 WHEN first_name_th IS NOT NULL THEN first_name_th
                 WHEN first_name_en IS NOT NULL THEN first_name_en
                 ELSE employee_code
               END as name,
               '${role}' as role
        FROM employees
        WHERE department_id = $1
          AND is_department_admin = true
          AND is_active = true
          AND employee_code != '999999999'
          AND ($2::uuid IS NULL OR id <> $2)
        ORDER BY employee_code
      `;

  if (role === 'hr') {
    logger.log('🏢 [APPROVERS] Query for HR approvers');
  } else if (role === 'hr_or_admin_manager') {
    logger.log('🏢 [APPROVERS] Query for HR/Admin Manager approvers');
  } else {
    logger.log(`👔 [APPROVERS] Query for ${role} approvers in department ${departmentId}`);
  }

  const approversResult = await query(
    approversQuery,
    role !== 'hr' && role !== 'hr_or_admin_manager'
      ? [departmentId, requesterEmployeeId || null]
      : []
  );

  logger.log(`✅ [APPROVERS] Found ${approversResult.length} ${role} approvers:`,
    approversResult.map(r => ({ id: r.id, employee_code: r.employee_code, name: r.name, role: r.role }))
  );

  // If no approvers found for department roles, try fallback options
  if (approversResult.length === 0 && role !== 'hr') {
    logger.log(`⚠️ [APPROVERS] No ${role} found for department ${departmentId}, trying fallback...`);

    // 1. For department_admin, first try department_manager in the same department
    if (role === 'department_admin') {
      logger.log(`🔄 [APPROVERS] Trying department_manager as fallback for department_admin...`);
      const managerFallbackQuery = `
        SELECT id, employee_code,
               CASE
                 WHEN first_name_th IS NOT NULL AND last_name_th IS NOT NULL THEN first_name_th || ' ' || last_name_th
                 WHEN first_name_en IS NOT NULL AND last_name_en IS NOT NULL THEN first_name_en || ' ' || last_name_en
                 WHEN first_name_th IS NOT NULL THEN first_name_th
                 WHEN first_name_en IS NOT NULL THEN first_name_en
                 ELSE employee_code
               END as name,
               'department_manager' as role
        FROM employees
        WHERE department_id = $1
        AND is_department_manager = true
        AND is_active = true
        AND employee_code != '999999999'
        ${requesterEmployeeId ? `AND id != '${requesterEmployeeId}'` : ''}
        ORDER BY employee_code
      `;

      const managerFallbackResult = await query(managerFallbackQuery, [departmentId]);

      if (managerFallbackResult.length > 0) {
        logger.log(`✅ [APPROVERS] Found ${managerFallbackResult.length} managers as fallback`);
        return managerFallbackResult.map(row => ({
          id: row.id,
          employee_code: row.employee_code,
          name: row.name,
          name_th: row.name,
          name_en: row.name,
          role: 'department_manager' as 'department_admin' | 'department_manager' | 'hr' | 'hr_or_admin_manager'
        }));
      }
    }

    // 2. ✅ FINAL FALLBACK: If Dept Admin/Manager not found, use HR (Global)
    logger.log(`🔄 [APPROVERS] Dept leadership missing. Fallback to HR...`);
    const hrFallbackQuery = `
      SELECT id, employee_code,
             CASE
               WHEN first_name_th IS NOT NULL AND last_name_th IS NOT NULL THEN first_name_th || ' ' || last_name_th
               WHEN first_name_en IS NOT NULL AND last_name_en IS NOT NULL THEN first_name_en || ' ' || last_name_en
               WHEN first_name_th IS NOT NULL THEN first_name_th
               WHEN first_name_en IS NOT NULL THEN first_name_en
               ELSE employee_code
             END as name,
             'hr' as role
      FROM employees
      WHERE role = 'hr'
      AND is_active = true
      AND employee_code != '999999999'
      ${requesterEmployeeId ? `AND id != '${requesterEmployeeId}'` : ''}
      ORDER BY employee_code
    `;

    const hrFallbackResult = await query(hrFallbackQuery);
    logger.log(`🌍 [APPROVERS] HR fallback found ${hrFallbackResult.length} approvers`);

    return hrFallbackResult.map(row => ({
      id: row.id,
      employee_code: row.employee_code,
      name: row.name,
      name_th: row.name,
      name_en: row.name,
      role: 'hr' as 'department_admin' | 'department_manager' | 'hr' | 'hr_or_admin_manager'
    }));
  }

  return approversResult.map(row => ({
    id: row.id,
    employee_code: row.employee_code,
    name: row.name,
    name_th: row.name,
    name_en: row.name,
    role: row.role as 'department_admin' | 'department_manager' | 'hr' | 'hr_or_admin_manager'
  }));
}

export async function getApprovalFlowWithApprovers(
  employeeId: string,
  departmentId: string
): Promise<ApprovalFlow> {
  logger.log('🔍 [APPROVERS] Getting approval flow with approver names for employee:', employeeId, 'department:', departmentId);

  // Get base flow
  const baseFlow = await getApprovalFlow(employeeId);
  logger.log(`📋 [APPROVERS] Base flow has ${baseFlow.stages.length} stages`);

  // Get approvers for each stage
  for (const stage of baseFlow.stages) {
    try {
      logger.log(`🔍 [APPROVERS] Processing stage ${stage.stage} (${stage.role})...`);
      const approvers = await getStageApprovers(departmentId, stage.role, employeeId);
      stage.approvers = approvers;
      logger.log(`✅ [APPROVERS] Stage ${stage.stage} (${stage.role}): Found ${approvers.length} approvers`);

      if (approvers.length > 0) {
        logger.log(`👥 [APPROVERS] Approver names:`, approvers.map(a => a.name_th || a.name_en));
      }
    } catch (error) {
      logger.error(`❌ [APPROVERS] Error getting approvers for stage ${stage.stage}:`, error);
      stage.approvers = [];
    }
  }

  logger.log('🎯 [APPROVERS] Final approval flow:', {
    totalStages: baseFlow.stages.length,
    stagesWithApprovers: baseFlow.stages.filter(s => s.approvers && s.approvers.length > 0).length,
    stagesWithoutApprovers: baseFlow.stages.filter(s => !s.approvers || s.approvers.length === 0).length
  });

  return baseFlow;
}

export async function getApprovalFlowWithAutoSkip(
  employeeId: string,
  departmentId: string
): Promise<ApprovalFlowWithSkip> {
  logger.log('🔍 [AUTO-SKIP] Analyzing approval flow for employee:', employeeId, 'department:', departmentId);

  // Get base flow
  const baseFlow = await getApprovalFlow(employeeId);

  // Get requester info
  const requesterResult = await query(
    `SELECT role, is_department_admin, is_department_manager, department_id, employee_code,
            first_name_th, last_name_th, first_name_en, last_name_en
     FROM employees
     WHERE id = $1`,
    [employeeId]
  );

  if (requesterResult.length === 0) {
    logger.error('❌ [AUTO-SKIP] Employee not found with ID:', employeeId);
    throw new Error('Employee not found');
  }

  const requester = requesterResult[0];
  const name = requester.first_name_th && requester.last_name_th
    ? `${requester.first_name_th} ${requester.last_name_th}`
    : requester.first_name_en && requester.last_name_en
      ? `${requester.first_name_en} ${requester.last_name_en}`
      : requester.employee_code;

  logger.log('✅ [AUTO-SKIP] Requester info:', {
    employeeId: employeeId,
    employeeCode: requester.employee_code,
    name: name,
    role: requester.role,
    isDeptAdmin: requester.is_department_admin,
    isDeptManager: requester.is_department_manager,
    departmentId: requester.department_id
  });

  // Special debug for employee 202501004
  if (requester.employee_code === '202501004' || name.includes('สมศรี') || name.includes('Samsee')) {
    logger.log('🎯 [AUTO-SKIP] DEBUG: Found employee 202501004 - checking auto-skip conditions');
    logger.log('🔍 [AUTO-SKIP] Employee flags:', {
      isDepartmentAdmin: requester.is_department_admin,
      isDepartmentManager: requester.is_department_manager,
      role: requester.role
    });
  }

  const skippedStages: number[] = [];
  const skipReasons: string[] = [];

  // Check each stage for potential self-approval conflicts
  for (const stage of baseFlow.stages) {
    logger.log(`🔍 [AUTO-SKIP] Checking stage ${stage.stage} (${stage.role})`);

    let shouldSkip = false;
    let skipReason = '';

    // Check if requester would be approving their own request
    if (stage.role === 'department_admin') {
      // Check if there are OTHER department admins in the same department
      const otherAdmins = await query(
        `SELECT COUNT(*) as count
         FROM employees
         WHERE department_id = $1
         AND is_department_admin = true
         AND id != $2
         AND is_active = true`,
        [departmentId, employeeId]
      );

      const otherAdminCount = parseInt(otherAdmins[0].count);
      logger.log(`  → Other admins in department: ${otherAdminCount}`);

      if (requester.is_department_admin && otherAdminCount === 0) {
        shouldSkip = true;
        skipReason = 'Requester is the only department admin';
        logger.log(`  ⏭️  Auto-skip: ${skipReason}`);
      }
    }
    else if (stage.role === 'department_manager') {
      // Check if there are OTHER department managers in the same department
      const otherManagers = await query(
        `SELECT COUNT(*) as count
         FROM employees
         WHERE department_id = $1
         AND is_department_manager = true
         AND id != $2
         AND is_active = true`,
        [departmentId, employeeId]
      );

      const otherManagerCount = parseInt(otherManagers[0].count);
      logger.log(`  → Other managers in department: ${otherManagerCount}`);

      if (requester.is_department_manager && otherManagerCount === 0) {
        shouldSkip = true;
        skipReason = 'Requester is the only department manager';
        logger.log(`  ⏭️  Auto-skip: ${skipReason}`);
      }
    }
    else if (stage.role === 'hr') {
      // Check if there are OTHER HR employees
      const otherHR = await query(
        `SELECT COUNT(*) as count
         FROM employees
         WHERE role = 'hr'
         AND id != $1
         AND is_active = true`,
        [employeeId]
      );

      const otherHRCount = parseInt(otherHR[0].count);
      logger.log(`  → Other HR employees: ${otherHRCount}`);

      if (requester.role === 'hr' && otherHRCount === 0) {
        shouldSkip = true;
        skipReason = 'Requester is the only HR employee';
        logger.log(`  ⏭️  Auto-skip: ${skipReason}`);
      }
    }
    else if (stage.role === 'hr_or_admin_manager') {
      // Check if there are OTHER HRs or Admin Managers
      const otherApprovers = await query(
        `SELECT COUNT(*) as count
         FROM employees e
         LEFT JOIN departments d ON e.department_id = d.id
         WHERE (
           (e.role = 'hr') OR 
           (e.is_department_manager = true AND (d.department_code = 'ADMIN' OR d.name_en ILIKE '%Admin%'))
         )
         AND e.id != $1
         AND e.is_active = true`,
        [employeeId]
      );

      const count = parseInt(otherApprovers[0].count);
      logger.log(`  → Other HR/Admin Managers: ${count}`);

      if (count === 0) {
        shouldSkip = true;
        skipReason = 'No other HR or Admin Manager available';
        logger.log(`  ⏭️  Auto-skip: ${skipReason}`);
      }
    }

    if (shouldSkip) {
      skippedStages.push(stage.stage);
      skipReasons.push(`Stage ${stage.stage} (${stage.role}): ${skipReason}`);
      stage.isAutoSkipped = true;
      stage.autoSkipReason = skipReason;
    }
  }

  // Determine the initial stage (first non-skipped stage)
  let initialStage = 1;
  for (let i = 1; i <= baseFlow.totalStages; i++) {
    if (!skippedStages.includes(i)) {
      initialStage = i;
      break;
    }
  }

  // If all stages are skipped, the request is auto-approved
  if (skippedStages.length === baseFlow.totalStages) {
    logger.log('⚠️  [AUTO-SKIP] ALL stages skipped - request will be auto-approved');
    initialStage = baseFlow.totalStages + 1; // Beyond last stage = approved
  }

  const autoSkipReason = skipReasons.length > 0
    ? skipReasons.join('; ')
    : '';

  let approvers: ApproverInfo[] = [];
  if (initialStage <= baseFlow.totalStages) {
    const initialStageInfo = baseFlow.stages.find((stage) => stage.stage === initialStage);
    if (initialStageInfo) {
      try {
        approvers = await getStageApprovers(departmentId, initialStageInfo.role, employeeId);
        initialStageInfo.approvers = approvers;
      } catch (error) {
        logger.error('❌ [AUTO-SKIP] Failed to resolve initial approvers:', error);
      }
    }
  }

  logger.log('✅ [AUTO-SKIP] Analysis complete:', {
    totalStages: baseFlow.totalStages,
    skippedStages,
    initialStage,
    autoSkipReason
  });

  return {
    ...baseFlow,
    initialStage,
    skippedStages,
    autoSkipReason,
    currentStage: initialStage,
    approvers
  };
}
