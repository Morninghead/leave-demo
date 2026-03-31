// netlify/functions/utils/approval-flow.ts - Enhanced with auto-skip logic
import { logger } from './logger';

import { query } from './db';

export interface ApproverInfo {
  id: string;
  employee_code: string;
  name: string;
  name_th: string;
  name_en: string;
  role: 'department_admin' | 'department_manager' | 'hr';
}

export interface ApprovalStage {
  stage: number;
  role: 'department_admin' | 'department_manager' | 'hr';
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
     WHERE id = $1 AND is_active = true`,
    [employeeId]
  );

  if (employeeResult.length === 0) {
    throw new Error('Employee not found');
  }

  const employee = employeeResult[0];
  const { role, is_department_admin, is_department_manager } = employee;

  let stages: ApprovalStage[] = [];

  if (role === 'hr') {
    stages = [
      {
        stage: 1,
        role: 'department_admin',
        description_th: 'Admin แผนก Admin อนุมัติ',
        description_en: 'Admin Department Admin Approval',
      },
    ];
  } else if (is_department_admin) {
    stages = [
      {
        stage: 1,
        role: 'department_manager',
        description_th: 'Manager แผนกอนุมัติ',
        description_en: 'Department Manager Approval',
      },
      {
        stage: 2,
        role: 'hr',
        description_th: 'HR อนุมัติ',
        description_en: 'HR Approval',
      },
    ];
  } else if (is_department_manager) {
    stages = [
      {
        stage: 1,
        role: 'department_admin',
        description_th: 'Admin แผนกอนุมัติ',
        description_en: 'Department Admin Approval',
      },
      {
        stage: 2,
        role: 'hr',
        description_th: 'HR อนุมัติ',
        description_en: 'HR Approval',
      },
    ];
  } else {
    stages = [
      {
        stage: 1,
        role: 'department_admin',
        description_th: 'Admin แผนกอนุมัติ',
        description_en: 'Department Admin Approval',
      },
      {
        stage: 2,
        role: 'department_manager',
        description_th: 'Manager แผนกอนุมัติ',
        description_en: 'Department Manager Approval',
      },
      {
        stage: 3,
        role: 'hr',
        description_th: 'HR อนุมัติ',
        description_en: 'HR Approval',
      },
    ];
  }

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

  const userResult = await query(
    `SELECT role, department_id, is_department_admin, is_department_manager
     FROM employees
     WHERE id = $1 AND is_active = true`,
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

  // ⭐ SUPER APPROVAL POWER: HR can approve at any stage and BYPASS ALL remaining stages (except own request)
  if (user.role === 'hr') {
    const isCorrectStage = currentStageInfo.role === 'hr';
    if (isCorrectStage) {
      logger.log('✅ [APPROVAL] HR is approving at correct stage');
      return { allowed: true };
    } else {
      logger.log('⭐ [APPROVAL] HR is approving at stage', currentStage, '(normally requires', currentStageInfo.role + ') - BYPASSING TO FINAL APPROVAL');
      return {
        allowed: true,
        isSkippingStage: true,
        skipMessage: `HR is approving at stage ${currentStage} and bypassing to final approval (normally requires ${currentStageInfo.role})`,
        shouldBypassToFinal: true
      };
    }
  }

  // Check role-based permissions
  if (currentStageInfo.role === 'department_admin') {
    if (user.is_department_admin && user.department_id === departmentId) {
      logger.log('✅ [APPROVAL] User is authorized as department admin');
      return { allowed: true };
    }
    logger.log('❌ [APPROVAL] User is not a department admin or different department');
    return {
      allowed: false,
      reason: 'You must be a department admin in the same department to approve at this stage'
    };
  }

  if (currentStageInfo.role === 'department_manager') {
    if (user.is_department_manager && user.department_id === departmentId) {
      logger.log('✅ [APPROVAL] User is authorized as department manager');
      return { allowed: true };
    }
    logger.log('❌ [APPROVAL] User is not a department manager or different department');
    return {
      allowed: false,
      reason: 'You must be a department manager in the same department to approve at this stage'
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
  role: 'department_admin' | 'department_manager' | 'hr',
  requesterEmployeeId?: string
): Promise<ApproverInfo[]> {
  logger.log(`🔍 [APPROVERS] Getting ${role} approvers for department: ${departmentId}`);

  let approversQuery = '';

  if (role === 'hr') {
    // Get all HR employees - use flexible column selection
    approversQuery = `
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
      ORDER BY employee_code
    `;
    logger.log('🏢 [APPROVERS] Query for HR approvers');
  } else {
    // Get department-specific approvers - use flexible column selection
    const roleField = role === 'department_admin' ? 'is_department_admin' : 'is_department_manager';
    approversQuery = `
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
      AND ${roleField} = true
      AND is_active = true
      ORDER BY employee_code
    `;
    logger.log(`👔 [APPROVERS] Query for ${role} approvers in department ${departmentId}`);
  }

  const approversResult = await query(approversQuery, role !== 'hr' ? [departmentId] : []);

  logger.log(`✅ [APPROVERS] Found ${approversResult.length} ${role} approvers:`,
    approversResult.map(r => ({ id: r.id, employee_code: r.employee_code, name: r.name, role: r.role }))
  );

  // If no approvers found for department roles, try to get any employees with that role as fallback
  if (approversResult.length === 0 && role !== 'hr') {
    logger.log(`⚠️ [APPROVERS] No ${role} found for department ${departmentId}, trying fallback...`);

    const fallbackQuery = `
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
      WHERE ${role === 'department_admin' ? 'is_department_admin' : 'is_department_manager'} = true
      AND is_active = true
      ORDER BY first_name_th, first_name_en
      LIMIT 5
    `;

    const fallbackResult = await query(fallbackQuery);
    logger.log(`🔄 [APPROVERS] Fallback found ${fallbackResult.length} ${role} approvers:`,
      fallbackResult.map(r => ({ id: r.id, employee_code: r.employee_code, name: r.name, role: r.role }))
    );

    if (fallbackResult.length > 0) {
      return fallbackResult.map(row => ({
        id: row.id,
        employee_code: row.employee_code,
        name: row.name,
        name_th: row.name,
        name_en: row.name,
        role: row.role as 'department_admin' | 'department_manager' | 'hr'
      }));
    }
  }

  // No more mock approvers - return empty array if no approvers found in database
  if (approversResult.length === 0) {
    logger.log(`⚠️ [APPROVERS] No ${role} approvers found in database for department ${departmentId}`);

    // Final fallback - try company-wide approvers (excluding the requester)
    const companyWideQuery = role === 'hr'
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
        AND id != $1
        ORDER BY first_name_th, first_name_en
        LIMIT 5
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
        WHERE ${role === 'department_admin' ? 'is_department_admin' : 'is_department_manager'} = true
        AND is_active = true
        AND id != $1
        ORDER BY first_name_th, first_name_en
        LIMIT 5
      `;

    try {
      // Use the requesterEmployeeId to exclude the requester from company-wide search
      const companyWideResult = await query(companyWideQuery, requesterEmployeeId !== null ? [requesterEmployeeId] : []);
      logger.log(`🌍 [APPROVERS] Company-wide fallback found ${companyWideResult.length} ${role} approvers`);

      return companyWideResult.map(row => ({
        id: row.id,
        employee_code: row.employee_code,
        name: row.name,
        name_th: row.name,
        name_en: row.name,
        role: row.role as 'department_admin' | 'department_manager' | 'hr'
      }));
    } catch (error) {
      logger.error(`❌ [APPROVERS] Error in company-wide fallback query:`, error);
      return [];
    }
  }

  return approversResult.map(row => ({
    id: row.id,
    employee_code: row.employee_code,
    name: row.name,
    name_th: row.name,
    name_en: row.name,
    role: row.role as 'department_admin' | 'department_manager' | 'hr'
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
    currentStage: initialStage
  };
}
