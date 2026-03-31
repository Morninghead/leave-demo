
import { Handler } from '@netlify/functions';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { query } from './utils/db';
import { successResponse, errorResponse, handleCORS } from './utils/response';

type ProbationCandidateRow = {
  employee_id: string;
  employee_code: string;
  first_name_th: string | null;
  last_name_th: string | null;
  first_name_en: string | null;
  last_name_en: string | null;
  department_id: string | null;
  department_name_th: string | null;
  department_name_en: string | null;
  position_th: string | null;
  position_en: string | null;
  hire_date: string;
  days_worked: number | string;
  review_due_date: string;
  probation_end_date: string;
  evaluation_id: string | null;
  form_number: string | null;
  evaluation_status: string | null;
  current_step: string | null;
  has_leader_stage: boolean | null;
  hr_document_reference: string | null;
  hr_document_issued_at: string | null;
  hr_document_issued_by_code: string | null;
  total_score: number | string | null;
  evaluation_result: string | null;
  completed_at: string | null;
};

type EvaluationDetailRow = {
  evaluation_id: string;
  form_number: string;
  employee_id: string;
  employee_code: string;
  first_name_th: string | null;
  last_name_th: string | null;
  first_name_en: string | null;
  last_name_en: string | null;
  department_id: string | null;
  department_name_th: string | null;
  department_name_en: string | null;
  position_th: string | null;
  position_en: string | null;
  hire_date: string;
  probation_start_date: string;
  probation_end_date: string;
  extension_end_date: string | null;
  status: string;
  current_step: string;
  has_leader_stage: boolean;
  pass_threshold: number | string;
  total_score: number | string;
  recommendation: string | null;
  result_comment: string | null;
  employee_visible: boolean;
  completed_at: string | null;
  issuer_hr_id: string;
  leader_id: string | null;
  manager_id: string;
  hr_ack_id: string;
  hr_manager_id: string;
  issuer_hr_code: string | null;
  issuer_hr_first_name_th: string | null;
  issuer_hr_last_name_th: string | null;
  issuer_hr_first_name_en: string | null;
  issuer_hr_last_name_en: string | null;
  leader_code: string | null;
  leader_first_name_th: string | null;
  leader_last_name_th: string | null;
  leader_first_name_en: string | null;
  leader_last_name_en: string | null;
  manager_code: string | null;
  manager_first_name_th: string | null;
  manager_last_name_th: string | null;
  manager_first_name_en: string | null;
  manager_last_name_en: string | null;
  hr_ack_code: string | null;
  hr_ack_first_name_th: string | null;
  hr_ack_last_name_th: string | null;
  hr_ack_first_name_en: string | null;
  hr_ack_last_name_en: string | null;
  hr_manager_code: string | null;
  hr_manager_first_name_th: string | null;
  hr_manager_last_name_th: string | null;
  hr_manager_first_name_en: string | null;
  hr_manager_last_name_en: string | null;
};

type EvaluationScoreRow = {
  question_code: string;
  section_code: string;
  question_text_th: string;
  question_text_en: string;
  max_score: number | string;
  score: number | string;
  comment: string | null;
};

type EvaluationActionRow = {
  id: string;
  action_step: string;
  action_type: string;
  actor_id: string;
  actor_code: string | null;
  actor_first_name_th: string | null;
  actor_last_name_th: string | null;
  actor_first_name_en: string | null;
  actor_last_name_en: string | null;
  comment: string | null;
  recommendation: string | null;
  signature_data: string | null;
  signed_at: string | null;
  created_at: string;
  metadata: Record<string, any> | null;
};

type LeaveSummaryRow = {
  employee_id: string;
  leave_type_code: string | null;
  leave_type_name_th: string | null;
  leave_type_name_en: string | null;
  total_days: number | string;
};

type ProbationSummary = {
  total_candidates: number;
  due_soon: number;
  pending_hr_document: number;
  pending_assessor_review: number;
  pending_employee_notification: number;
  completed: number;
};

type TemplateQuestion = {
  question_code: string;
  question_no: string;
  section_code: string;
  question_text_th: string;
  question_text_en: string;
  max_score: number;
};

type TemplateSection = {
  section_code: string;
  section_no: string;
  title_th: string;
  title_en: string;
  max_score: number;
  questions: TemplateQuestion[];
};

const DEV_CODE = '999999999';
const REVIEW_DAY = 60;
const PROBATION_SCOPE_DAYS = 119;
const DUE_SOON_OFFSET = 2;
const MIN_VISIBLE_HIRE_DATE = '2025-11-01';
const RECOMMENDATIONS = ['PASS', 'FAIL', 'EXTEND', 'OTHER', 'RESIGNED'] as const;
const FINAL_RECOMMENDATIONS = ['PASS', 'FAIL', 'RESIGNED'] as const;

const EVALUATION_TEMPLATE: TemplateSection[] = [
  {
    section_code: 'QUALITY',
    section_no: '1',
    title_th: 'คุณภาพและปริมาณงาน',
    title_en: 'The quality and quantity of work',
    max_score: 40,
    questions: [
      { question_code: '1.1', question_no: '1.1', section_code: 'QUALITY', question_text_th: 'คุณภาพของงานตามมาตรฐานที่กำหนด', question_text_en: 'The standards quality of work', max_score: 20 },
      { question_code: '1.2', question_no: '1.2', section_code: 'QUALITY', question_text_th: 'ปริมาณงาน ผลงาน', question_text_en: 'Quantity of work', max_score: 20 },
    ],
  },
  {
    section_code: 'ABILITY',
    section_no: '2',
    title_th: 'ความสามารถในการทำงานและความคิดริเริ่ม',
    title_en: 'Ability to work and initiative',
    max_score: 30,
    questions: [
      { question_code: '2.1', question_no: '2.1', section_code: 'ABILITY', question_text_th: 'ความสามารถในการตัดสินใจแก้ไขปัญหา', question_text_en: 'Adjudication to solving problems', max_score: 5 },
      { question_code: '2.2', question_no: '2.2', section_code: 'ABILITY', question_text_th: 'ความสามารถในการเรียนรู้งานใหม่', question_text_en: 'Learning new jobs', max_score: 5 },
      { question_code: '2.3', question_no: '2.3', section_code: 'ABILITY', question_text_th: 'ความคิดริเริ่มและการปรับปรุงวิธีการทำงาน', question_text_en: 'Initiative and improvement', max_score: 10 },
      { question_code: '2.4', question_no: '2.4', section_code: 'ABILITY', question_text_th: 'ความรอบรู้ในหน้าที่การงาน', question_text_en: 'Knowledge in duty', max_score: 10 },
    ],
  },
  {
    section_code: 'HABITS',
    section_no: '3',
    title_th: 'อุปนิสัยและทัศนคติในการทำงาน',
    title_en: 'Habits and attitudes of working',
    max_score: 30,
    questions: [
      { question_code: '3.1', question_no: '3.1', section_code: 'HABITS', question_text_th: 'ความร่วมมือกับเพื่อนร่วมงาน', question_text_en: 'Collaboration with other', max_score: 5 },
      { question_code: '3.2', question_no: '3.2', section_code: 'HABITS', question_text_th: 'การปฏิบัติงานตามระเบียบ คำสั่งบริษัท', question_text_en: 'Compliance and regulatory company', max_score: 5 },
      { question_code: '3.3', question_no: '3.3', section_code: 'HABITS', question_text_th: 'ความขยันหมั่นเพียรและความเอาใจใส่ในหน้าที่', question_text_en: 'Diligent and caring work', max_score: 10 },
      { question_code: '3.4', question_no: '3.4', section_code: 'HABITS', question_text_th: 'ทัศนคติต่อบริษัทและการปกครองบังคับบัญชา', question_text_en: 'Attitude towards company', max_score: 5 },
      { question_code: '3.5', question_no: '3.5', section_code: 'HABITS', question_text_th: 'ความเชื่อถือได้', question_text_en: 'Trust', max_score: 5 },
    ],
  },
];

const TEMPLATE_QUESTIONS = EVALUATION_TEMPLATE.flatMap((section) => section.questions);
const QUESTION_MAP = new Map(TEMPLATE_QUESTIONS.map((question) => [question.question_code, question]));

function normalizeRole(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase();
}

function getDisplayName(
  firstNameTh: string | null | undefined,
  lastNameTh: string | null | undefined,
  firstNameEn: string | null | undefined,
  lastNameEn: string | null | undefined
) {
  return {
    th: [firstNameTh, lastNameTh].filter(Boolean).join(' ').trim(),
    en: [firstNameEn, lastNameEn].filter(Boolean).join(' ').trim(),
  };
}

function isProbationViewer(event: AuthenticatedEvent) {
  const role = normalizeRole(event.user?.role);
  const employeeCode = String(event.user?.employeeCode || '').trim();
  return ['leader', 'manager', 'hr', 'admin', 'dev'].includes(role) || employeeCode === DEV_CODE;
}

function canIssueHrDocument(event: AuthenticatedEvent) {
  const role = normalizeRole(event.user?.role);
  const employeeCode = String(event.user?.employeeCode || '').trim();
  return ['hr', 'admin', 'dev'].includes(role) || employeeCode === DEV_CODE;
}

function canCancelEvaluation(event: AuthenticatedEvent) {
  return canIssueHrDocument(event);
}

function selectProbationApprovers(
  hrRows: Array<{
    id: string;
    employee_code: string;
    role: string;
    is_department_manager: boolean;
    is_department_admin: boolean;
  }>,
  issuerHrId: string
) {
  const issuerRow = hrRows.find((row) => row.id === issuerHrId);
  const hrManagerId =
    hrRows.find((row) => row.role === 'admin' || row.is_department_admin || row.is_department_manager)?.id ||
    issuerRow?.id ||
    hrRows[0]?.id ||
    issuerHrId;
  const hrAckId =
    hrRows.find((row) => row.role === 'hr' && row.id !== hrManagerId)?.id ||
    hrRows.find((row) => row.id !== hrManagerId)?.id ||
    hrManagerId;

  return { hrAckId, hrManagerId };
}

function getWorkflowStage(row: ProbationCandidateRow) {
  const daysWorked = Number(row.days_worked);
  const status = String(row.evaluation_status || '').toUpperCase();

  if (status === 'COMPLETED' || row.completed_at) return 'completed';
  if (status === 'PENDING_LEADER' || status === 'PENDING_MANAGER') return 'pending_assessor_review';
  if (status === 'PENDING_HR' || status === 'PENDING_HR_MANAGER') return 'pending_employee_notification';

  if (status === 'DRAFT' || status === 'CANCELLED') {
    return daysWorked >= REVIEW_DAY ? 'pending_hr_document' : 'watchlist';
  }

  if (daysWorked >= REVIEW_DAY) return 'pending_hr_document';
  if (daysWorked >= REVIEW_DAY - DUE_SOON_OFFSET) return 'due_soon';
  return 'watchlist';
}

function generateFormNumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `EVAL-${yyyy}${mm}${dd}-${hh}${mi}${ss}${ms}`;
}

async function getLeaveSummary(employeeIds: string[]) {
  if (employeeIds.length === 0) {
    return new Map<string, LeaveSummaryRow[]>();
  }

  const leaveRows = await query<LeaveSummaryRow>(
    `
    SELECT
      lr.employee_id,
      lt.code AS leave_type_code,
      lt.name_th AS leave_type_name_th,
      lt.name_en AS leave_type_name_en,
      COALESCE(SUM(lr.total_days), 0) AS total_days
    FROM leave_requests lr
    LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
    WHERE lr.employee_id = ANY($1::uuid[])
      AND lr.status = 'approved'
    GROUP BY lr.employee_id, lt.code, lt.name_th, lt.name_en
    ORDER BY lr.employee_id, lt.name_th
    `,
    [employeeIds]
  );

  return leaveRows.reduce((map, row) => {
    const current = map.get(row.employee_id) || [];
    current.push(row);
    map.set(row.employee_id, current);
    return map;
  }, new Map<string, LeaveSummaryRow[]>());
}

function buildSectionScores(scoreRows: EvaluationScoreRow[]) {
  const scoreMap = new Map(scoreRows.map((row) => [row.question_code, row]));

  return EVALUATION_TEMPLATE.map((section) => {
    const questions = section.questions.map((question) => {
      const saved = scoreMap.get(question.question_code);
      return {
        question_code: question.question_code,
        question_no: question.question_no,
        question_text_th: question.question_text_th,
        question_text_en: question.question_text_en,
        max_score: question.max_score,
        score: saved ? Number(saved.score) : 0,
        comment: saved?.comment || '',
      };
    });

    return {
      section_code: section.section_code,
      section_no: section.section_no,
      title_th: section.title_th,
      title_en: section.title_en,
      max_score: section.max_score,
      total_score: questions.reduce((sum, question) => sum + Number(question.score || 0), 0),
      questions,
    };
  });
}

function computeTotalScoreFromSections(
  sections: Array<{ questions: Array<{ score: number }> }>
) {
  return sections.reduce(
    (sectionSum, section) =>
      sectionSum + section.questions.reduce((sum, question) => sum + Number(question.score || 0), 0),
    0
  );
}

type ProbationNotificationInput = {
  recipientId: string;
  senderId: string | null;
  titleTh: string;
  titleEn: string;
  messageTh: string;
  messageEn: string;
  evaluationId: string;
};

async function createProbationNotification(input: ProbationNotificationInput) {
  await query(
    `
    INSERT INTO notifications (
      recipient_id,
      sender_id,
      title_th,
      title_en,
      message_th,
      message_en,
      type,
      reference_id,
      reference_type
    )
    VALUES ($1, $2, $3, $4, $5, $6, 'system', $7, 'probation_evaluation')
    `,
    [
      input.recipientId,
      input.senderId,
      input.titleTh,
      input.titleEn,
      input.messageTh,
      input.messageEn,
      input.evaluationId,
    ]
  );
}

function uniqueRecipientIds(ids: Array<string | null | undefined>, excludeIds: string[] = []) {
  const excluded = new Set(excludeIds.filter(Boolean));
  return [...new Set(ids.filter((id): id is string => !!id && !excluded.has(id)))];
}

async function notifyProbationIssue(
  evaluationId: string,
  senderId: string,
  formNumber: string,
  employeeNameTh: string,
  employeeNameEn: string,
  nextStep: 'LEADER' | 'MANAGER',
  recipientId: string
) {
  const stepLabelTh = nextStep === 'LEADER' ? 'หัวหน้างาน' : 'ผู้จัดการ';
  const stepLabelEn = nextStep === 'LEADER' ? 'Leader' : 'Manager';

  await createProbationNotification({
    recipientId,
    senderId,
    evaluationId,
    titleTh: 'มีแบบประเมินทดลองงานรอดำเนินการ',
    titleEn: 'Probation evaluation requires your action',
    messageTh: `แบบประเมิน ${formNumber} ของ ${employeeNameTh} ถูกส่งถึง ${stepLabelTh} แล้ว กรุณาเข้าไปประเมิน`,
    messageEn: `Probation evaluation ${formNumber} for ${employeeNameEn} has been assigned to the ${stepLabelEn}. Please review it.`,
  });
}

async function notifyProbationStepChange(
  form: EvaluationDetailRow,
  actorId: string,
  nextStatus: string,
  nextStep: string
) {
  const employeeName = getDisplayName(
    form.first_name_th,
    form.last_name_th,
    form.first_name_en,
    form.last_name_en
  );

  if (nextStatus === 'PENDING_MANAGER' && form.manager_id) {
    await createProbationNotification({
      recipientId: form.manager_id,
      senderId: actorId,
      evaluationId: form.evaluation_id,
      titleTh: 'มีแบบประเมินทดลองงานรอผู้จัดการ',
      titleEn: 'Probation evaluation pending manager review',
      messageTh: `แบบประเมิน ${form.form_number} ของ ${employeeName.th} รอผู้จัดการให้คะแนนต่อ`,
      messageEn: `Probation evaluation ${form.form_number} for ${employeeName.en} is waiting for manager review.`,
    });
    return;
  }

  if (nextStatus === 'PENDING_HR' && form.hr_ack_id) {
    await createProbationNotification({
      recipientId: form.hr_ack_id,
      senderId: actorId,
      evaluationId: form.evaluation_id,
      titleTh: 'มีแบบประเมินทดลองงานรอ HR',
      titleEn: 'Probation evaluation pending HR review',
      messageTh: `แบบประเมิน ${form.form_number} ของ ${employeeName.th} รอ HR ดำเนินการต่อ`,
      messageEn: `Probation evaluation ${form.form_number} for ${employeeName.en} is waiting for HR review.`,
    });
    return;
  }

  if (nextStatus === 'PENDING_HR_MANAGER' && form.hr_manager_id) {
    await createProbationNotification({
      recipientId: form.hr_manager_id,
      senderId: actorId,
      evaluationId: form.evaluation_id,
      titleTh: 'มีแบบประเมินทดลองงานรอ Admin Manager',
      titleEn: 'Probation evaluation pending Admin Manager review',
      messageTh: `แบบประเมิน ${form.form_number} ของ ${employeeName.th} รอ Admin Manager พิจารณา`,
      messageEn: `Probation evaluation ${form.form_number} for ${employeeName.en} is waiting for Admin Manager review.`,
    });
    return;
  }

  if (nextStatus === 'COMPLETED') {
    const recipients = uniqueRecipientIds(
      [form.employee_id, form.issuer_hr_id, form.leader_id, form.manager_id, form.hr_ack_id, form.hr_manager_id],
      [actorId]
    );

    for (const recipientId of recipients) {
      const isEmployee = recipientId === form.employee_id;
      await createProbationNotification({
        recipientId,
        senderId: actorId,
        evaluationId: form.evaluation_id,
        titleTh: isEmployee ? 'ผลประเมินทดลองงานพร้อมแล้ว' : 'แบบประเมินทดลองงานเสร็จสิ้นแล้ว',
        titleEn: isEmployee ? 'Your probation result is ready' : 'Probation evaluation has been completed',
        messageTh: isEmployee
          ? `ผลประเมินทดลองงานเลขที่ ${form.form_number} ของคุณพร้อมให้ตรวจสอบแล้ว`
          : `แบบประเมิน ${form.form_number} ของ ${employeeName.th} เสร็จสิ้นแล้ว`,
        messageEn: isEmployee
          ? `Your probation evaluation result ${form.form_number} is now available.`
          : `Probation evaluation ${form.form_number} for ${employeeName.en} has been completed.`,
      });
    }
  }
}

async function notifyProbationCancelled(form: EvaluationDetailRow, actorId: string) {
  const employeeName = getDisplayName(
    form.first_name_th,
    form.last_name_th,
    form.first_name_en,
    form.last_name_en
  );
  const recipients = uniqueRecipientIds(
    [form.employee_id, form.issuer_hr_id, form.leader_id, form.manager_id, form.hr_ack_id, form.hr_manager_id],
    [actorId]
  );

  for (const recipientId of recipients) {
    const isEmployee = recipientId === form.employee_id;
    await createProbationNotification({
      recipientId,
      senderId: actorId,
      evaluationId: form.evaluation_id,
      titleTh: isEmployee ? 'ใบประเมินทดลองงานของคุณถูกยกเลิก' : 'ใบประเมินทดลองงานถูกยกเลิก',
      titleEn: isEmployee ? 'Your probation evaluation was cancelled' : 'Probation evaluation was cancelled',
      messageTh: isEmployee
        ? `ใบประเมินทดลองงานเลขที่ ${form.form_number} ของคุณถูกยกเลิกแล้ว`
        : `ใบประเมิน ${form.form_number} ของ ${employeeName.th} ถูกยกเลิกแล้ว`,
      messageEn: isEmployee
        ? `Your probation evaluation ${form.form_number} has been cancelled.`
        : `Probation evaluation ${form.form_number} for ${employeeName.en} has been cancelled.`,
    });
  }
}

async function getEvaluationFormRow(evaluationId: string) {
  const forms = await query<EvaluationDetailRow>(
    `
    SELECT
      ef.id AS evaluation_id,
      ef.form_number,
      ef.employee_id,
      e.employee_code,
      e.first_name_th,
      e.last_name_th,
      e.first_name_en,
      e.last_name_en,
      e.department_id,
      d.name_th AS department_name_th,
      d.name_en AS department_name_en,
      e.position_th,
      e.position_en,
      e.hire_date::date::text AS hire_date,
      ef.probation_start_date::text,
      ef.probation_end_date::text,
      ef.extension_end_date::text,
      ef.status,
      ef.current_step,
      ef.has_leader_stage,
      ef.pass_threshold,
      ef.total_score,
      ef.recommendation,
      ef.result_comment,
      ef.employee_visible,
      ef.completed_at::text,
      ef.issuer_hr_id,
      ef.leader_id,
      ef.manager_id,
      ef.hr_ack_id,
      ef.hr_manager_id,
      issuer.employee_code AS issuer_hr_code,
      issuer.first_name_th AS issuer_hr_first_name_th,
      issuer.last_name_th AS issuer_hr_last_name_th,
      issuer.first_name_en AS issuer_hr_first_name_en,
      issuer.last_name_en AS issuer_hr_last_name_en,
      leader.employee_code AS leader_code,
      leader.first_name_th AS leader_first_name_th,
      leader.last_name_th AS leader_last_name_th,
      leader.first_name_en AS leader_first_name_en,
      leader.last_name_en AS leader_last_name_en,
      manager.employee_code AS manager_code,
      manager.first_name_th AS manager_first_name_th,
      manager.last_name_th AS manager_last_name_th,
      manager.first_name_en AS manager_first_name_en,
      manager.last_name_en AS manager_last_name_en,
      hr_ack.employee_code AS hr_ack_code,
      hr_ack.first_name_th AS hr_ack_first_name_th,
      hr_ack.last_name_th AS hr_ack_last_name_th,
      hr_ack.first_name_en AS hr_ack_first_name_en,
      hr_ack.last_name_en AS hr_ack_last_name_en,
      hr_manager.employee_code AS hr_manager_code,
      hr_manager.first_name_th AS hr_manager_first_name_th,
      hr_manager.last_name_th AS hr_manager_last_name_th,
      hr_manager.first_name_en AS hr_manager_first_name_en,
      hr_manager.last_name_en AS hr_manager_last_name_en
    FROM evaluation_forms ef
    INNER JOIN employees e ON e.id = ef.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN employees issuer ON issuer.id = ef.issuer_hr_id
    LEFT JOIN employees leader ON leader.id = ef.leader_id
    LEFT JOIN employees manager ON manager.id = ef.manager_id
    LEFT JOIN employees hr_ack ON hr_ack.id = ef.hr_ack_id
    LEFT JOIN employees hr_manager ON hr_manager.id = ef.hr_manager_id
    WHERE ef.id = $1
    LIMIT 1
    `,
    [evaluationId]
  );

  return forms[0] || null;
}

function canEditEvaluation(event: AuthenticatedEvent, form: EvaluationDetailRow) {
  const role = normalizeRole(event.user?.role);
  const employeeCode = String(event.user?.employeeCode || '').trim();
  const userId = String(event.user?.userId || '').trim();

  if (['hr', 'admin', 'dev'].includes(role) || employeeCode === DEV_CODE) return true;
  if (form.current_step === 'LEADER') return userId === form.leader_id;
  if (form.current_step === 'MANAGER') return userId === form.manager_id;
  if (form.current_step === 'HR') return userId === form.hr_ack_id;
  if (form.current_step === 'HR_MANAGER') return userId === form.hr_manager_id;
  return false;
}

function validateScoresPayload(scores: any[]) {
  if (!Array.isArray(scores) || scores.length === 0) {
    throw new Error('scores is required');
  }

  const seen = new Set<string>();
  const normalized = scores.map((item) => {
    const template = QUESTION_MAP.get(String(item.question_code || '').trim());
    if (!template) {
      throw new Error(`Unknown question code: ${item.question_code}`);
    }
    if (seen.has(template.question_code)) {
      throw new Error(`Duplicate question code: ${template.question_code}`);
    }

    const score = Number(item.score);
    if (!Number.isFinite(score)) {
      throw new Error(`Score must be numeric for question ${template.question_code}`);
    }
    if (score < 0 || score > template.max_score) {
      throw new Error(`Score for ${template.question_code} must be between 0 and ${template.max_score}`);
    }

    seen.add(template.question_code);
    return { ...template, score, comment: String(item.comment || '').trim() };
  });

  if (normalized.length !== TEMPLATE_QUESTIONS.length) {
    throw new Error(`All ${TEMPLATE_QUESTIONS.length} questions must be submitted`);
  }

  return normalized;
}

async function listProbationEvaluations(event: AuthenticatedEvent) {
  if (!isProbationViewer(event)) {
    return errorResponse('Insufficient permissions', 403);
  }

  const search = String(event.queryStringParameters?.search || '').trim();
  const stage = String(event.queryStringParameters?.stage || 'all').trim().toLowerCase();

  const rows = await query<ProbationCandidateRow>(
    `
    WITH latest_form AS (
      SELECT DISTINCT ON (ef.employee_id)
        ef.id,
        ef.employee_id,
        ef.form_number,
        ef.status,
        ef.current_step,
        ef.has_leader_stage,
        ef.total_score,
        ef.recommendation,
        ef.completed_at
      FROM evaluation_forms ef
      ORDER BY ef.employee_id, ef.created_at DESC
    ),
    latest_issue_action AS (
      SELECT DISTINCT ON (efa.evaluation_form_id)
        efa.evaluation_form_id,
        efa.created_at,
        efa.actor_id,
        efa.metadata
      FROM evaluation_form_actions efa
      WHERE efa.action_step = 'ISSUE'
        AND efa.action_type = 'ISSUED'
      ORDER BY efa.evaluation_form_id, efa.created_at DESC
    )
    SELECT
      e.id AS employee_id,
      e.employee_code,
      e.first_name_th,
      e.last_name_th,
      e.first_name_en,
      e.last_name_en,
      e.department_id,
      d.name_th AS department_name_th,
      d.name_en AS department_name_en,
      e.position_th,
      e.position_en,
      e.hire_date::date::text AS hire_date,
      (CURRENT_DATE - e.hire_date::date) + 1 AS days_worked,
      (e.hire_date::date + INTERVAL '${REVIEW_DAY - 1} days')::date::text AS review_due_date,
      (e.hire_date::date + INTERVAL '${PROBATION_SCOPE_DAYS} days')::date::text AS probation_end_date,
      ef.id AS evaluation_id,
      ef.form_number,
      ef.status AS evaluation_status,
      ef.current_step,
      ef.has_leader_stage,
      latest_issue_action.metadata->>'document_reference' AS hr_document_reference,
      latest_issue_action.created_at::text AS hr_document_issued_at,
      issuer.employee_code AS hr_document_issued_by_code,
      ef.total_score,
      ef.recommendation AS evaluation_result,
      ef.completed_at::text
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN latest_form ef ON ef.employee_id = e.id
    LEFT JOIN latest_issue_action ON latest_issue_action.evaluation_form_id = ef.id
    LEFT JOIN employees issuer ON issuer.id = latest_issue_action.actor_id
    WHERE e.hire_date IS NOT NULL
      AND e.hire_date::date >= $3::date
      AND (e.is_active = true OR ef.id IS NOT NULL)
      AND NOT (
        COALESCE(ef.recommendation, '') = ANY($4::text[])
        AND (COALESCE(ef.status, '') = 'COMPLETED' OR ef.completed_at IS NOT NULL)
      )
      AND (CURRENT_DATE - e.hire_date::date) >= 0
      AND (
        $1 = '' OR
        e.employee_code ILIKE $2 OR
        CONCAT_WS(' ', e.first_name_th, e.last_name_th) ILIKE $2 OR
        CONCAT_WS(' ', e.first_name_en, e.last_name_en) ILIKE $2 OR
        d.name_th ILIKE $2 OR
        d.name_en ILIKE $2
      )
    ORDER BY e.hire_date ASC, e.employee_code ASC
    `,
    [search, `%${search}%`, MIN_VISIBLE_HIRE_DATE, FINAL_RECOMMENDATIONS]
  );

  const leaveSummaryMap = await getLeaveSummary(rows.map((row) => row.employee_id));

  const candidates = rows
    .map((row) => {
      const workflowStage = getWorkflowStage(row);
      return {
        employee_id: row.employee_id,
        employee_code: row.employee_code,
        name_th: getDisplayName(row.first_name_th, row.last_name_th, null, null).th,
        name_en: getDisplayName(null, null, row.first_name_en, row.last_name_en).en,
        department_id: row.department_id,
        department_name_th: row.department_name_th,
        department_name_en: row.department_name_en,
        position_th: row.position_th,
        position_en: row.position_en,
        hire_date: row.hire_date,
        days_worked: Number(row.days_worked),
        review_due_date: row.review_due_date,
        probation_end_date: row.probation_end_date,
        workflow_stage: workflowStage,
        evaluation_id: row.evaluation_status === 'CANCELLED' ? null : row.evaluation_id,
        form_number: row.evaluation_status === 'CANCELLED' ? null : row.form_number,
        evaluation_status: row.evaluation_status,
        current_step: row.evaluation_status === 'CANCELLED' ? null : row.current_step,
        has_leader_stage: row.evaluation_status === 'CANCELLED' ? false : !!row.has_leader_stage,
        hr_document_reference: row.hr_document_reference,
        hr_document_issued_at: row.hr_document_issued_at,
        hr_document_issued_by_code: row.hr_document_issued_by_code,
        total_score: row.total_score === null ? null : Number(row.total_score),
        evaluation_result: row.evaluation_result,
        completed_at: row.completed_at,
        leave_summary: (leaveSummaryMap.get(row.employee_id) || []).map((item) => ({
          leave_type_name_th: item.leave_type_name_th,
          leave_type_name_en: item.leave_type_name_en,
          total_days: Number(item.total_days),
        })),
      };
    })
    .filter((candidate) => stage === 'all' || candidate.workflow_stage === stage);

  const summary = candidates.reduce<ProbationSummary>(
    (acc, candidate) => {
      acc.total_candidates += 1;
      if (candidate.workflow_stage === 'due_soon') acc.due_soon += 1;
      if (candidate.workflow_stage === 'pending_hr_document') acc.pending_hr_document += 1;
      if (candidate.workflow_stage === 'pending_assessor_review') acc.pending_assessor_review += 1;
      if (candidate.workflow_stage === 'pending_employee_notification') acc.pending_employee_notification += 1;
      if (candidate.workflow_stage === 'completed') acc.completed += 1;
      return acc;
    },
    {
      total_candidates: 0,
      due_soon: 0,
      pending_hr_document: 0,
      pending_assessor_review: 0,
      pending_employee_notification: 0,
      completed: 0,
    }
  );

  return successResponse({ summary, candidates });
}

async function getProbationEvaluationDetail(event: AuthenticatedEvent, evaluationId: string) {
  const form = await getEvaluationFormRow(evaluationId);
  if (!form) {
    return errorResponse('Evaluation form not found', 404);
  }

  const userId = String(event.user?.userId || '').trim();
  const employeeCanView = userId === form.employee_id && form.employee_visible;
  const canView =
    isProbationViewer(event) ||
    employeeCanView ||
    userId === form.leader_id ||
    userId === form.manager_id ||
    userId === form.hr_ack_id ||
    userId === form.hr_manager_id;

  if (!canView) {
    return errorResponse('Insufficient permissions', 403);
  }

  const [scoreRows, actionRows, leaveSummaryMap] = await Promise.all([
    query<EvaluationScoreRow>(
      `
      SELECT
        question_code,
        section_code,
        question_text_th,
        question_text_en,
        max_score,
        score,
        comment
      FROM evaluation_form_scores
      WHERE evaluation_form_id = $1
      ORDER BY question_code ASC
      `,
      [evaluationId]
    ),
    query<EvaluationActionRow>(
      `
      SELECT
        efa.id,
        efa.action_step,
        efa.action_type,
        efa.actor_id,
        actor.employee_code AS actor_code,
        actor.first_name_th AS actor_first_name_th,
        actor.last_name_th AS actor_last_name_th,
        actor.first_name_en AS actor_first_name_en,
        actor.last_name_en AS actor_last_name_en,
        efa.comment,
        efa.recommendation,
        efa.signature_data,
        efa.signed_at::text,
        efa.created_at::text,
        efa.metadata
      FROM evaluation_form_actions efa
      LEFT JOIN employees actor ON actor.id = efa.actor_id
      WHERE efa.evaluation_form_id = $1
      ORDER BY efa.created_at ASC, efa.id ASC
      `,
      [evaluationId]
    ),
    getLeaveSummary([form.employee_id]),
  ]);

  const leaveSummary = (leaveSummaryMap.get(form.employee_id) || []).map((item) => ({
    leave_type_code: item.leave_type_code,
    leave_type_name_th: item.leave_type_name_th,
    leave_type_name_en: item.leave_type_name_en,
    total_days: Number(item.total_days),
  }));

  const sections = buildSectionScores(scoreRows);
  const editable = canEditEvaluation(event, form) && !['COMPLETED', 'CANCELLED'].includes(form.status);

  return successResponse({
    evaluation: {
      id: form.evaluation_id,
      form_number: form.form_number,
      employee: {
        id: form.employee_id,
        employee_code: form.employee_code,
        name_th: getDisplayName(form.first_name_th, form.last_name_th, null, null).th,
        name_en: getDisplayName(null, null, form.first_name_en, form.last_name_en).en,
        department_id: form.department_id,
        department_name_th: form.department_name_th,
        department_name_en: form.department_name_en,
        position_th: form.position_th,
        position_en: form.position_en,
        hire_date: form.hire_date,
      },
      probation_start_date: form.probation_start_date,
      probation_end_date: form.probation_end_date,
      extension_end_date: form.extension_end_date,
      status: form.status,
      current_step: form.current_step,
      pass_threshold: Number(form.pass_threshold),
      total_score: Number(form.total_score),
      recommendation: form.recommendation,
      result_comment: form.result_comment || '',
      employee_visible: form.employee_visible,
      completed_at: form.completed_at,
      approvers: {
        issuer_hr: {
          id: form.issuer_hr_id,
          employee_code: form.issuer_hr_code,
          ...getDisplayName(
            form.issuer_hr_first_name_th,
            form.issuer_hr_last_name_th,
            form.issuer_hr_first_name_en,
            form.issuer_hr_last_name_en
          ),
        },
        leader: form.leader_id
          ? {
              id: form.leader_id,
              employee_code: form.leader_code,
              ...getDisplayName(
                form.leader_first_name_th,
                form.leader_last_name_th,
                form.leader_first_name_en,
                form.leader_last_name_en
              ),
            }
          : null,
        manager: {
          id: form.manager_id,
          employee_code: form.manager_code,
          ...getDisplayName(
            form.manager_first_name_th,
            form.manager_last_name_th,
            form.manager_first_name_en,
            form.manager_last_name_en
          ),
        },
        hr_ack: {
          id: form.hr_ack_id,
          employee_code: form.hr_ack_code,
          ...getDisplayName(
            form.hr_ack_first_name_th,
            form.hr_ack_last_name_th,
            form.hr_ack_first_name_en,
            form.hr_ack_last_name_en
          ),
        },
        hr_manager: {
          id: form.hr_manager_id,
          employee_code: form.hr_manager_code,
          ...getDisplayName(
            form.hr_manager_first_name_th,
            form.hr_manager_last_name_th,
            form.hr_manager_first_name_en,
            form.hr_manager_last_name_en
          ),
        },
      },
      leave_summary: leaveSummary,
      sections,
      actions: actionRows.map((action) => ({
        id: action.id,
        action_step: action.action_step,
        action_type: action.action_type,
        actor_id: action.actor_id,
        actor_code: action.actor_code,
        actor_name_th: getDisplayName(action.actor_first_name_th, action.actor_last_name_th, null, null).th,
        actor_name_en: getDisplayName(null, null, action.actor_first_name_en, action.actor_last_name_en).en,
        comment: action.comment || '',
        recommendation: action.recommendation,
        signature_data: action.signature_data,
        signed_at: action.signed_at,
        created_at: action.created_at,
        metadata: action.metadata,
      })),
      permissions: {
        can_edit: editable,
        can_submit: editable,
        can_cancel: canCancelEvaluation(event) && form.status !== 'CANCELLED',
      },
    },
  });
}

async function issueHrDocument(event: AuthenticatedEvent) {
  if (!canIssueHrDocument(event)) {
    return errorResponse('Insufficient permissions', 403);
  }

  const body = event.body ? JSON.parse(event.body) : {};
  const employeeId = String(body.employee_id || '').trim();
  const documentReference = String(body.document_reference || '').trim() || null;
  const selectedLeaderId = String(body.leader_id || '').trim() || null;

  if (!employeeId) {
    return errorResponse('employee_id is required', 400);
  }

  const employees = await query<{
    employee_id: string;
    employee_code: string;
    first_name_th: string | null;
    last_name_th: string | null;
    first_name_en: string | null;
    last_name_en: string | null;
    department_id: string | null;
    hire_date: string;
    direct_leader_id: string | null;
  }>(
    `
    SELECT
      id AS employee_id,
      employee_code,
      first_name_th,
      last_name_th,
      first_name_en,
      last_name_en,
      department_id,
      hire_date::date::text AS hire_date,
      direct_leader_id
    FROM employees
    WHERE id = $1
      AND is_active = true
      AND hire_date IS NOT NULL
    LIMIT 1
    `,
    [employeeId]
  );

  const employee = employees[0];
  if (!employee) {
    return errorResponse('Employee not found', 404);
  }

  let validatedLeaderId: string | null = null;
  if (selectedLeaderId) {
    const leaderRows = await query<{ id: string }>(
      `
      SELECT id
      FROM employees
      WHERE id = $1
        AND is_active = true
        AND LOWER(role) = 'leader'
      LIMIT 1
      `,
      [selectedLeaderId]
    );

    if (!leaderRows[0]) {
      return errorResponse('Selected leader is invalid', 400);
    }

    validatedLeaderId = leaderRows[0].id;
  }

  if (new Date(employee.hire_date) < new Date(MIN_VISIBLE_HIRE_DATE)) {
    return errorResponse(`Only employees hired on or after ${MIN_VISIBLE_HIRE_DATE} are in scope`, 400);
  }

  const daysWorked = Math.max(0, Math.floor((Date.now() - new Date(employee.hire_date).getTime()) / 86400000) + 1);
  if (daysWorked < REVIEW_DAY) {
    return errorResponse('HR document can only be issued once the employee has reached 60 days', 400);
  }

  const existingForms = await query<{
    id: string;
    form_number: string;
    status: string;
    current_step: string;
    probation_start_date: string;
    probation_end_date: string;
  }>(
    `
    SELECT
      id,
      form_number,
      status,
      current_step,
      probation_start_date::text,
      probation_end_date::text
    FROM evaluation_forms
    WHERE employee_id = $1
      AND status <> 'CANCELLED'
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [employeeId]
  );

  if (existingForms[0]) {
    return successResponse({
      message: 'Evaluation form already exists for this employee',
      evaluation: {
        id: existingForms[0].id,
        form_number: existingForms[0].form_number,
        status: existingForms[0].status,
        current_step: existingForms[0].current_step,
        probation_start_date: existingForms[0].probation_start_date,
        probation_end_date: existingForms[0].probation_end_date,
        hr_document_reference: documentReference,
      },
    });
  }

  const [managerRows, hrRows] = await Promise.all([
    query<{ id: string }>(
      `
      SELECT id
      FROM employees
      WHERE department_id = $1
        AND is_active = true
        AND employee_code != $2
        AND id != $3
        AND (
          is_department_manager = true OR
          LOWER(role) = 'manager' OR
          role = 'ผู้จัดการ'
        )
      ORDER BY is_department_manager DESC, employee_code ASC
      LIMIT 1
      `,
      [employee.department_id, DEV_CODE, employeeId]
    ),
    query<{
      id: string;
      employee_code: string;
      role: string;
      is_department_manager: boolean;
      is_department_admin: boolean;
    }>(
      `
      SELECT
        id,
        employee_code,
        LOWER(role) AS role,
        COALESCE(is_department_manager, false) AS is_department_manager,
        COALESCE(is_department_admin, false) AS is_department_admin
      FROM employees
      WHERE is_active = true
        AND employee_code != $1
        AND (LOWER(role) = 'hr' OR LOWER(role) = 'admin')
      ORDER BY
        CASE
          WHEN COALESCE(is_department_manager, false) = true THEN 0
          WHEN COALESCE(is_department_admin, false) = true THEN 1
          WHEN LOWER(role) = 'admin' THEN 2
          WHEN LOWER(role) = 'hr' THEN 3
          ELSE 4
        END,
        employee_code ASC
      `,
      [DEV_CODE]
    ),
  ]);

  const leaderId = validatedLeaderId || employee.direct_leader_id || managerRows[0]?.id || null;
  const managerId = managerRows[0]?.id || leaderId;
  const issuerHrId = String(event.user?.userId || '').trim();
  const { hrAckId, hrManagerId } = selectProbationApprovers(hrRows, issuerHrId);

  if (!managerId) {
    return errorResponse('No department manager found for this employee', 400);
  }

  const formNumber = generateFormNumber();
  const hasLeaderStage = !!leaderId && leaderId !== managerId;
  const probationStartDate = employee.hire_date;
  const probationEndDate = new Date(new Date(employee.hire_date).getTime() + PROBATION_SCOPE_DAYS * 86400000)
    .toISOString()
    .slice(0, 10);

  const insertedForms = await query<{ id: string }>(
    `
    INSERT INTO evaluation_forms (
      form_number,
      employee_id,
      department_id,
      issuer_hr_id,
      leader_id,
      manager_id,
      hr_ack_id,
      hr_manager_id,
      probation_start_date,
      probation_end_date,
      has_leader_stage,
      status,
      current_step
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10::date, $11, $12, $13)
    RETURNING id
    `,
    [
      formNumber,
      employeeId,
      employee.department_id,
      issuerHrId,
      leaderId,
      managerId,
      hrAckId,
      hrManagerId,
      probationStartDate,
      probationEndDate,
      hasLeaderStage,
      hasLeaderStage ? 'PENDING_LEADER' : 'PENDING_MANAGER',
      hasLeaderStage ? 'LEADER' : 'MANAGER',
    ]
  );

  const evaluationId = insertedForms[0]?.id;
  if (!evaluationId) {
    return errorResponse('Failed to create evaluation form', 500);
  }

  await query(
    `
    INSERT INTO evaluation_form_actions (
      evaluation_form_id,
      action_step,
      action_type,
      actor_id,
      metadata
    )
    VALUES ($1, 'ISSUE', 'ISSUED', $2, $3::jsonb)
    `,
    [
      evaluationId,
      issuerHrId,
      JSON.stringify({
        document_reference: documentReference,
        issued_for_review_day: REVIEW_DAY,
      }),
    ]
  );

  const employeeNames = getDisplayName(
    employee.first_name_th,
    employee.last_name_th,
    employee.first_name_en,
    employee.last_name_en
  );
  const initialRecipientId = hasLeaderStage ? leaderId : managerId;
  const initialStep = hasLeaderStage ? 'LEADER' : 'MANAGER';
  if (initialRecipientId) {
    await notifyProbationIssue(
      evaluationId,
      issuerHrId,
      formNumber,
      employeeNames.th || employee.employee_code,
      employeeNames.en || employee.employee_code,
      initialStep,
      initialRecipientId
    );
  }

  return successResponse(
    {
      message: 'Probation HR document issued successfully',
      evaluation: {
        id: evaluationId,
        form_number: formNumber,
        status: hasLeaderStage ? 'PENDING_LEADER' : 'PENDING_MANAGER',
        current_step: hasLeaderStage ? 'LEADER' : 'MANAGER',
        probation_start_date: probationStartDate,
        probation_end_date: probationEndDate,
        hr_document_reference: documentReference,
      },
    },
    201
  );
}

type PersistEvaluationOptions = {
  submit: boolean;
  scores: any[];
  recommendation?: string | null;
  resultComment?: string | null;
  extensionEndDate?: string | null;
  signatureData?: string | null;
  actionComment?: string | null;
};

async function persistEvaluationState(
  event: AuthenticatedEvent,
  evaluationId: string,
  options: PersistEvaluationOptions
) {
  const form = await getEvaluationFormRow(evaluationId);
  if (!form) {
    return errorResponse('Evaluation form not found', 404);
  }

  if (!canEditEvaluation(event, form)) {
    return errorResponse('Insufficient permissions', 403);
  }

  if (options.submit && ['COMPLETED', 'CANCELLED'].includes(form.status)) {
    return errorResponse('This evaluation cannot be submitted anymore', 400);
  }

  const normalizedScores = validateScoresPayload(options.scores);
  const sections = buildSectionScores(
    normalizedScores.map((item) => ({
      question_code: item.question_code,
      section_code: item.section_code,
      question_text_th: item.question_text_th,
      question_text_en: item.question_text_en,
      max_score: item.max_score,
      score: item.score,
      comment: item.comment,
    }))
  );
  const totalScore = computeTotalScoreFromSections(sections);

  const recommendation = options.recommendation ? String(options.recommendation).trim().toUpperCase() : null;
  if (recommendation && !RECOMMENDATIONS.includes(recommendation as any)) {
    return errorResponse('Invalid recommendation', 400);
  }

  if (recommendation === 'EXTEND' && !options.extensionEndDate) {
    return errorResponse('extension_end_date is required when recommendation is EXTEND', 400);
  }

  for (const item of normalizedScores) {
    await query(
      `
      INSERT INTO evaluation_form_scores (
        evaluation_form_id,
        question_code,
        section_code,
        question_text_th,
        question_text_en,
        max_score,
        score,
        comment
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (evaluation_form_id, question_code)
      DO UPDATE SET
        section_code = EXCLUDED.section_code,
        question_text_th = EXCLUDED.question_text_th,
        question_text_en = EXCLUDED.question_text_en,
        max_score = EXCLUDED.max_score,
        score = EXCLUDED.score,
        comment = EXCLUDED.comment
      `,
      [
        evaluationId,
        item.question_code,
        item.section_code,
        item.question_text_th,
        item.question_text_en,
        item.max_score,
        item.score,
        item.comment || null,
      ]
    );
  }

  let nextStatus = form.status;
  let nextStep = form.current_step;
  let completedAt: string | null = null;

  if (options.submit) {
    if (form.current_step === 'LEADER') {
      nextStatus = 'PENDING_MANAGER';
      nextStep = 'MANAGER';
    } else if (form.current_step === 'MANAGER') {
      nextStatus = 'PENDING_HR';
      nextStep = 'HR';
    } else if (form.current_step === 'HR') {
      nextStatus = 'PENDING_HR_MANAGER';
      nextStep = 'HR_MANAGER';
    } else if (form.current_step === 'HR_MANAGER') {
      nextStatus = 'COMPLETED';
      nextStep = 'COMPLETED';
      completedAt = new Date().toISOString();
    }
  }

  await query(
    `
    UPDATE evaluation_forms
    SET
      total_score = $2,
      recommendation = $3,
      result_comment = $4,
      extension_end_date = $5::date,
      status = $6,
      current_step = $7,
      completed_at = $8::timestamptz,
      employee_visible = $9
    WHERE id = $1
    `,
    [
      evaluationId,
      totalScore,
      recommendation,
      options.resultComment || null,
      options.extensionEndDate || null,
      nextStatus,
      nextStep,
      completedAt,
      nextStatus === 'COMPLETED',
    ]
  );

  if (options.submit) {
    await query(
      `
      INSERT INTO evaluation_form_actions (
        evaluation_form_id,
        action_step,
        action_type,
        actor_id,
        comment,
        recommendation,
        signature_data,
        signed_at,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8::jsonb)
      `,
      [
        evaluationId,
        form.current_step,
        nextStatus === 'COMPLETED' ? 'COMPLETED' : 'SUBMITTED',
        String(event.user?.userId || '').trim(),
        options.actionComment || null,
        recommendation,
        options.signatureData || null,
        JSON.stringify({
          next_status: nextStatus,
          next_step: nextStep,
        }),
      ]
    );

    await notifyProbationStepChange(
      form,
      String(event.user?.userId || '').trim(),
      nextStatus,
      nextStep
    );
  }

  return getProbationEvaluationDetail(event, evaluationId);
}

async function saveProbationEvaluation(event: AuthenticatedEvent, evaluationId: string) {
  const body = event.body ? JSON.parse(event.body) : {};
  return persistEvaluationState(event, evaluationId, {
    submit: false,
    scores: body.scores,
    recommendation: body.recommendation,
    resultComment: body.result_comment,
    extensionEndDate: body.extension_end_date,
  });
}

async function submitProbationEvaluation(event: AuthenticatedEvent, evaluationId: string) {
  const body = event.body ? JSON.parse(event.body) : {};
  return persistEvaluationState(event, evaluationId, {
    submit: true,
    scores: body.scores,
    recommendation: body.recommendation,
    resultComment: body.result_comment,
    extensionEndDate: body.extension_end_date,
    signatureData: body.signature_data,
    actionComment: body.action_comment,
  });
}

async function cancelProbationEvaluation(event: AuthenticatedEvent, evaluationId: string) {
  if (!canCancelEvaluation(event)) {
    return errorResponse('Insufficient permissions', 403);
  }

  const form = await getEvaluationFormRow(evaluationId);
  if (!form) {
    return errorResponse('Evaluation form not found', 404);
  }

  if (form.status === 'CANCELLED') {
    return errorResponse('This evaluation cannot be cancelled anymore', 400);
  }

  const body = event.body ? JSON.parse(event.body) : {};
  const comment = String(body.comment || '').trim() || null;

  await query(
    `
    UPDATE evaluation_forms
    SET
      status = 'CANCELLED',
      current_step = 'COMPLETED',
      completed_at = NULL,
      employee_visible = false
    WHERE id = $1
    `,
    [evaluationId]
  );

  await query(
    `
    INSERT INTO evaluation_form_actions (
      evaluation_form_id,
      action_step,
      action_type,
      actor_id,
      comment,
      metadata
    )
    VALUES ($1, 'ISSUE', 'CANCELLED', $2, $3, $4::jsonb)
    `,
    [
      evaluationId,
      String(event.user?.userId || '').trim(),
      comment,
      JSON.stringify({
        cancelled_from_status: form.status,
        cancelled_from_step: form.current_step,
      }),
    ]
  );

  await notifyProbationCancelled(form, String(event.user?.userId || '').trim());

  return getProbationEvaluationDetail(event, evaluationId);
}

async function probationEvaluationsHandler(event: AuthenticatedEvent) {
  try {
    const rawPath = String(event.path || '');
    const suffix = rawPath.replace(/^.*\/probation-evaluations/, '') || '/';
    const segments = suffix.split('/').filter(Boolean);

    if (event.httpMethod === 'GET' && segments.length === 0) {
      return await listProbationEvaluations(event);
    }

    if (event.httpMethod === 'POST' && segments.length === 1 && segments[0] === 'issue-document') {
      return await issueHrDocument(event);
    }

    if (segments.length >= 1) {
      const evaluationId = segments[0];

      if (event.httpMethod === 'GET' && segments.length === 1) {
        return await getProbationEvaluationDetail(event, evaluationId);
      }

      if (event.httpMethod === 'PUT' && segments.length === 1) {
        return await saveProbationEvaluation(event, evaluationId);
      }

      if (event.httpMethod === 'POST' && segments.length === 2 && segments[1] === 'submit') {
        return await submitProbationEvaluation(event, evaluationId);
      }

      if (event.httpMethod === 'POST' && segments.length === 2 && segments[1] === 'cancel') {
        return await cancelProbationEvaluation(event, evaluationId);
      }
    }

    return errorResponse('Method not allowed', 405);
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to handle probation evaluation request', 500);
  }
}

export const handler: Handler = requireAuth(probationEvaluationsHandler);
