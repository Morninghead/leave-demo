import api from './auth';

export type ProbationWorkflowStage =
  | 'watchlist'
  | 'due_soon'
  | 'pending_hr_document'
  | 'pending_assessor_review'
  | 'pending_employee_notification'
  | 'completed';

export interface ProbationLeaveSummary {
  leave_type_code?: string | null;
  leave_type_name_th: string | null;
  leave_type_name_en: string | null;
  total_days: number;
}

export interface ProbationCandidate {
  employee_id: string;
  employee_code: string;
  name_th: string;
  name_en: string;
  department_id: string | null;
  department_name_th: string | null;
  department_name_en: string | null;
  position_th: string | null;
  position_en: string | null;
  hire_date: string;
  days_worked: number;
  review_due_date: string;
  probation_end_date: string;
  workflow_stage: ProbationWorkflowStage;
  evaluation_id: string | null;
  form_number?: string | null;
  evaluation_status: string | null;
  current_step?: string | null;
  has_leader_stage?: boolean;
  hr_document_reference: string | null;
  hr_document_issued_at: string | null;
  hr_document_issued_by_code?: string | null;
  total_score: number | null;
  evaluation_result: string | null;
  completed_at?: string | null;
  leave_summary: ProbationLeaveSummary[];
}

export interface ProbationSummary {
  total_candidates: number;
  due_soon: number;
  pending_hr_document: number;
  pending_assessor_review: number;
  pending_employee_notification: number;
  completed: number;
}

export interface ProbationEvaluationResponse {
  summary: ProbationSummary;
  candidates: ProbationCandidate[];
}

export interface IssueProbationDocumentResponse {
  message: string;
  evaluation: {
    id: string;
    form_number: string;
    status: string;
    current_step: string;
    probation_start_date?: string;
    probation_end_date?: string;
    hr_document_reference?: string | null;
  };
}

export interface ProbationEvaluationQuestion {
  question_code: string;
  question_no: string;
  question_text_th: string;
  question_text_en: string;
  max_score: number;
  score: number;
  comment: string;
}

export interface ProbationEvaluationSection {
  section_code: string;
  section_no: string;
  title_th: string;
  title_en: string;
  max_score: number;
  total_score: number;
  questions: ProbationEvaluationQuestion[];
}

export interface ProbationEvaluationAction {
  id: string;
  action_step: string;
  action_type: string;
  actor_id: string;
  actor_code: string | null;
  actor_name_th: string;
  actor_name_en: string;
  comment: string;
  recommendation: string | null;
  signature_data: string | null;
  signed_at: string | null;
  created_at: string;
  metadata: Record<string, any> | null;
}

export interface ProbationEvaluationApprover {
  id: string;
  employee_code: string | null;
  th: string;
  en: string;
}

export interface ProbationEvaluationDetail {
  id: string;
  form_number: string;
  employee: {
    id: string;
    employee_code: string;
    name_th: string;
    name_en: string;
    department_id: string | null;
    department_name_th: string | null;
    department_name_en: string | null;
    position_th: string | null;
    position_en: string | null;
    hire_date: string;
  };
  probation_start_date: string;
  probation_end_date: string;
  extension_end_date: string | null;
  status: string;
  current_step: string;
  pass_threshold: number;
  total_score: number;
  recommendation: string | null;
  result_comment: string;
  employee_visible: boolean;
  completed_at: string | null;
  approvers: {
    issuer_hr: ProbationEvaluationApprover;
    leader: ProbationEvaluationApprover | null;
    manager: ProbationEvaluationApprover;
    hr_ack: ProbationEvaluationApprover;
    hr_manager: ProbationEvaluationApprover;
  };
  leave_summary: ProbationLeaveSummary[];
  sections: ProbationEvaluationSection[];
  actions: ProbationEvaluationAction[];
  permissions: {
    can_edit: boolean;
    can_submit: boolean;
    can_cancel?: boolean;
  };
}

export interface ProbationEvaluationDetailResponse {
  evaluation: ProbationEvaluationDetail;
}

export interface SaveProbationEvaluationPayload {
  scores: Array<{
    question_code: string;
    score: number;
    comment?: string;
  }>;
  recommendation?: string | null;
  result_comment?: string;
  extension_end_date?: string | null;
}

export interface SubmitProbationEvaluationPayload extends SaveProbationEvaluationPayload {
  signature_data?: string;
  action_comment?: string;
}

export interface CancelProbationEvaluationPayload {
  comment?: string;
}

export async function getProbationEvaluations(params?: {
  search?: string;
  stage?: string;
}): Promise<ProbationEvaluationResponse> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.stage) queryParams.append('stage', params.stage);

    const suffix = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const response = await api.get<ProbationEvaluationResponse>(`/probation-evaluations${suffix}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to load probation evaluations');
  }
}

export async function issueProbationHrDocument(
  employeeId: string,
  documentReference?: string,
  leaderId?: string
): Promise<IssueProbationDocumentResponse> {
  try {
    const response = await api.post<IssueProbationDocumentResponse>('/probation-evaluations/issue-document', {
      employee_id: employeeId,
      document_reference: documentReference,
      leader_id: leaderId,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to issue probation document');
  }
}

export async function getProbationEvaluationDetail(
  evaluationId: string
): Promise<ProbationEvaluationDetailResponse> {
  try {
    const response = await api.get<ProbationEvaluationDetailResponse>(`/probation-evaluations/${evaluationId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to load evaluation detail');
  }
}

export async function saveProbationEvaluation(
  evaluationId: string,
  payload: SaveProbationEvaluationPayload
): Promise<ProbationEvaluationDetailResponse> {
  try {
    const response = await api.put<ProbationEvaluationDetailResponse>(`/probation-evaluations/${evaluationId}`, payload);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to save evaluation');
  }
}

export async function submitProbationEvaluation(
  evaluationId: string,
  payload: SubmitProbationEvaluationPayload
): Promise<ProbationEvaluationDetailResponse> {
  try {
    const response = await api.post<ProbationEvaluationDetailResponse>(
      `/probation-evaluations/${evaluationId}/submit`,
      payload
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to submit evaluation');
  }
}

export async function cancelProbationEvaluation(
  evaluationId: string,
  payload?: CancelProbationEvaluationPayload
): Promise<ProbationEvaluationDetailResponse> {
  try {
    const response = await api.post<ProbationEvaluationDetailResponse>(
      `/probation-evaluations/${evaluationId}/cancel`,
      payload || {}
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to cancel evaluation');
  }
}
