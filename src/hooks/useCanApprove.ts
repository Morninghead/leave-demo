// src/hooks/useCanApprove.ts
import { useMemo } from 'react';
import { useAuth } from './useAuth';

interface ApprovalRequest {
  current_approval_stage?: number;
  employee_id: string;
  employee_department_id?: string;
  status: string;
}

/**
 * Hook to determine if current user can approve a request at its current stage
 *
 * Approval stages (dynamic based on requester's role):
 * - Regular Employee: Stage 1 (Dept Admin) → Stage 2 (Dept Manager) → Stage 3 (HR)
 * - Department Manager: Stage 1 (Dept Admin) → Stage 2 (HR)
 * - Department Admin: Stage 1 (Dept Manager) → Stage 2 (HR)
 * - HR Employee: Stage 1 (Dept Admin)
 *
 * Super Approval Powers:
 * - HR: Can approve at ANY stage (with warning notification)
 * - Note: Admin CANNOT approve - this role is for viewing reports only
 *
 * Rules:
 * - Cannot approve own requests
 * - Must match department for department-level approvals
 * - Only HR has super approval power to skip stages
 */
export function useCanApprove(request: ApprovalRequest | null) {
  const { user } = useAuth();

  return useMemo(() => {
    if (!request || !user) return false;

    // Cannot approve own requests
    if (request.employee_id === user.id) return false;

    // Can only approve pending requests
    if (request.status !== 'pending') return false;

    // ❌ Admin CANNOT approve - this role is for viewing reports only
    if (user.role === 'admin') return false;

    // ⭐ SUPER APPROVAL POWER: HR can approve at any stage
    if (user.role === 'hr') return true;

    const currentStage = request.current_approval_stage || 1; // Default to stage 1 if not set
    const userDept = user.department_id;
    const requestDept = request.employee_department_id;

    // Stage 1: Department Admin approval
    if (currentStage === 1) {
      const isDeptAdmin = user.is_department_admin || false;
      const sameDept = userDept === requestDept;
      return isDeptAdmin && sameDept;
    }

    // Stage 2: Department Manager approval
    if (currentStage === 2) {
      const isDeptManager = user.is_department_manager || user.role === 'manager';
      const sameDept = userDept === requestDept;
      return isDeptManager && sameDept;
    }

    // Stage 3: HR approval
    // Note: HR role approval is already handled above with super power at line 50,
    // but this stage check is kept for completeness and clarity
    if (currentStage === 3) {
      // HR can always approve (already checked above), but keeping the check
      // here for completeness. This will only be reached for non-HR/non-admin users
      return false; // Non-HR users cannot approve at stage 3
    }

    return false;
  }, [request, user]);
}

/**
 * Hook to determine if user can edit/delete a request
 */
export function useCanEditRequest(request: ApprovalRequest | null) {
  const { user } = useAuth();

  return useMemo(() => {
    if (!request || !user) return false;

    // Owner can edit/delete their own pending requests
    if (request.employee_id === user.id && request.status === 'pending') {
      return true;
    }


    // Only HR can edit any request (Admin cannot)
    if (user.role === 'hr') {
      return true;
    }

    return false;
  }, [request, user]);
}

/**
 * Hook to determine if user can delete a request
 */
export function useCanDeleteRequest(request: ApprovalRequest | null) {
  const { user } = useAuth();

  return useMemo(() => {
    if (!request || !user) return false;

    // Only owner can delete their own pending requests
    if (request.employee_id === user.id && request.status === 'pending') {
      return true;
    }


    // Note: Admin CANNOT delete requests - only owner can delete their pending requests

    return false;
  }, [request, user]);
}

/**
 * Hook to check if user is skipping approval stages
 * Returns warning info if user has super approval power and is approving at non-standard stage
 */
export function useApprovalStageWarning(request: ApprovalRequest | null) {
  const { user } = useAuth();

  return useMemo(() => {
    if (!request || !user) return null;

    // Cannot approve own requests
    if (request.employee_id === user.id) return null;

    // Can only check for pending requests
    if (request.status !== 'pending') return null;

    const currentStage = request.current_approval_stage;

    // Note: Admin CANNOT approve, so no warning needed for admin
    // (Admin role is for viewing reports only)

    // HR skipping if not at stage 3
    if (user.role === 'hr' && currentStage !== 3) {
      return {
        isSkipping: true,
        role: 'hr',
        message: `คุณกำลังอนุมัติที่ stage ${currentStage} (โดยปกติ HR อนุมัติที่ stage 3)`,
        messageEn: `You are approving at stage ${currentStage} (normally HR approves at stage 3)`
      };
    }

    return null;
  }, [request, user]);
}
