import { Handler } from '@netlify/functions';
import { handleCORS, successResponse, errorResponse } from './utils/response';
import { verifyToken, getTokenFromHeader } from './utils/jwt';
import { getApprovalFlowWithAutoSkip } from './utils/approval-flow';
import { getStageApprovers } from './utils/approval-flow';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return handleCORS();
  }

  try {
    // Verify JWT token
    const token = getTokenFromHeader(event.headers.authorization || event.headers.Authorization);

    if (!token) {
      return errorResponse('No token provided', 401);
    }

    const decoded = verifyToken(token);
    const userId = decoded.userId;

    // Get employee_id and department_id from query parameters
    const { employee_id, department_id } = event.queryStringParameters || {};

    console.log('📥 [APPROVAL-FLOW] Received parameters:', {
      userId,
      employee_id,
      department_id,
      allParams: event.queryStringParameters
    });

    if (!employee_id || !department_id) {
      console.error('❌ [APPROVAL-FLOW] Missing parameters:', { employee_id, department_id });
      return errorResponse('Missing required parameters: employee_id, department_id', 400);
    }

    console.log('🔍 [APPROVAL-FLOW] Getting approval flow info:', {
      userId,
      employee_id,
      department_id,
      employee_code: employee_id // Debug: showing employee_id to see if it's the right one
    });

    // Special debug for employee 202501004
    if (employee_id.includes('202501004')) {
      console.log('🎯 [APPROVAL-FLOW] DEBUG: Processing employee 202501004 - should auto-skip if admin-only department');
    }

    // Get approval flow with auto-skip logic
    const approvalFlowWithSkip = await getApprovalFlowWithAutoSkip(employee_id, department_id);

    console.log('🎯 [APPROVAL-FLOW] Auto-skip analysis:', {
      initialStage: approvalFlowWithSkip.initialStage,
      skippedStages: approvalFlowWithSkip.skippedStages,
      autoSkipReason: approvalFlowWithSkip.autoSkipReason,
      totalStages: approvalFlowWithSkip.totalStages
    });

    // Get approvers for non-skipped stages only
    const stagesWithApprovers = [];
    for (const stage of approvalFlowWithSkip.stages) {
      // Skip stages that were auto-skipped
      if (approvalFlowWithSkip.skippedStages.includes(stage.stage)) {
        console.log(`⏭️ [APPROVAL-FLOW] Skipping stage ${stage.stage} (${stage.role}) - auto-skipped`);
        continue;
      }

      try {
        console.log(`🔍 [APPROVAL-FLOW] Getting approvers for stage ${stage.stage} (${stage.role})...`);
        const approvers = await getStageApprovers(department_id, stage.role, employee_id);

        stage.approvers = approvers;
        stagesWithApprovers.push(stage);

        console.log(`✅ [APPROVAL-FLOW] Stage ${stage.stage} (${stage.role}): Found ${approvers.length} approvers`);
        if (approvers.length > 0) {
          console.log(`👥 [APPROVAL-FLOW] Approver names:`, approvers.map(a => a.name_th || a.name_en));
        }
      } catch (error) {
        console.error(`❌ [APPROVAL-FLOW] Error getting approvers for stage ${stage.stage}:`, error);
        stage.approvers = [];
        stagesWithApprovers.push(stage);
      }
    }

    // Create the final approval flow object
    const finalApprovalFlow = {
      stages: stagesWithApprovers,
      totalStages: approvalFlowWithSkip.totalStages,
      currentStage: approvalFlowWithSkip.initialStage,
      skippedStages: approvalFlowWithSkip.skippedStages,
      autoSkipReason: approvalFlowWithSkip.autoSkipReason,
      originalStages: approvalFlowWithSkip.stages.map(s => ({
        stage: s.stage,
        role: s.role,
        description_th: s.description_th,
        description_en: s.description_en,
        isAutoSkipped: s.isAutoSkipped,
        autoSkipReason: s.autoSkipReason
      }))
    };

    console.log('🎯 [APPROVAL-FLOW] Final approval flow:', {
      totalStages: finalApprovalFlow.totalStages,
      currentStage: finalApprovalFlow.currentStage,
      skippedStages: finalApprovalFlow.skippedStages,
      stagesWithApprovers: finalApprovalFlow.stages.length,
      autoSkipReason: finalApprovalFlow.autoSkipReason
    });

    return successResponse({
      approvalFlow: finalApprovalFlow,
      requested_by: {
        user_id: userId,
        employee_id,
        department_id
      }
    });

  } catch (error: any) {
    console.error('❌ [APPROVAL-FLOW] Error getting approval flow info:', error);
    return errorResponse(error.message || 'Failed to get approval flow info', 500);
  }
};