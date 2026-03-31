import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  FileSignature,
  Printer,
  RefreshCw,
  Save,
  Send,
} from 'lucide-react';
import { Logo } from '../components/common/logo';
import {
  cancelProbationEvaluation,
  getProbationEvaluationDetail,
  ProbationEvaluationDetail,
  ProbationEvaluationSection,
  saveProbationEvaluation,
  submitProbationEvaluation,
} from '../api/probationEvaluations';
import { useToast } from '../hooks/useToast';

const RECOMMENDATION_OPTIONS = [
  { value: 'PASS', labelTh: 'ผ่านการทดลองงานและบรรจุเป็นพนักงานประจำ', labelEn: 'Pass probation and adjust as a regular employee' },
  { value: 'FAIL', labelTh: 'ไม่ผ่านการทดลองงาน', labelEn: 'Not pass probation' },
  { value: 'RESIGNED', labelTh: 'ลาออกแล้ว', labelEn: 'Resigned' },
  { value: 'EXTEND', labelTh: 'ขยายระยะเวลาทดลองงาน', labelEn: 'Extend probation period' },
  { value: 'OTHER', labelTh: 'อื่นๆ', labelEn: 'Other' },
];

const PRINT_RECOMMENDATION_OPTIONS = RECOMMENDATION_OPTIONS.filter(
  (option) => !['RESIGNED', 'EXTEND'].includes(option.value)
);

type AttendanceStats = {
  sick: number;
  business: number;
  absent: number;
  late: number;
  punishment: number;
  remark: string;
};

function formatDate(value: string | null | undefined, language: string) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-GB');
}

function toInputDate(value: string | null | undefined) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function getStepLabel(step: string, language: string) {
  const labels: Record<string, { th: string; en: string }> = {
    LEADER: { th: 'หัวหน้างาน', en: 'Leader' },
    MANAGER: { th: 'ผู้จัดการ', en: 'Manager' },
    HR: { th: 'HR', en: 'HR' },
    HR_MANAGER: { th: 'HR Manager', en: 'HR Manager' },
    COMPLETED: { th: 'เสร็จสิ้น', en: 'Completed' },
  };

  return language === 'th' ? labels[step]?.th || step : labels[step]?.en || step;
}

function buildAttendanceStats(evaluation: ProbationEvaluationDetail): AttendanceStats {
  return evaluation.leave_summary.reduce<AttendanceStats>(
    (acc, item) => {
      const code = String(item.leave_type_code || '').trim().toUpperCase();
      const nameTh = String(item.leave_type_name_th || '').trim();
      const nameEn = String(item.leave_type_name_en || '').trim();
      const total = Number(item.total_days || 0);

      if (['SICK', 'SL', 'SCK'].includes(code)) {
        acc.sick += total;
      } else if (['PERSONAL', 'BUSINESS', 'PL'].includes(code)) {
        acc.business += total;
      } else if (['ABSENT'].includes(code)) {
        acc.absent += total;
      } else if (['LATE'].includes(code)) {
        acc.late += total;
      } else if (['PUNISHMENT', 'PUNISH'].includes(code)) {
        acc.punishment += total;
      } else {
        const label = nameTh || nameEn || code || 'Other';
        acc.remark = acc.remark ? `${acc.remark}, ${label}: ${total}` : `${label}: ${total}`;
      }

      return acc;
    },
    { sick: 0, business: 0, absent: 0, late: 0, punishment: 0, remark: '' }
  );
}

function totalScore(sections: ProbationEvaluationSection[]) {
  return sections.reduce(
    (sum, section) =>
      sum + section.questions.reduce((questionSum, question) => questionSum + Number(question.score || 0), 0),
    0
  );
}

function formatScoreValue(value: number | string | null | undefined) {
  return Math.round(Number(value || 0));
}

function normalizeSections(sections: ProbationEvaluationSection[]) {
  return sections.map((section) => {
    const questions = section.questions.map((question) => ({
      ...question,
      score: formatScoreValue(question.score),
    }));

    return {
      ...section,
      questions,
      total_score: questions.reduce((sum, question) => sum + formatScoreValue(question.score), 0),
    };
  });
}

function getRecommendationMeta(value: string, language: string) {
  const option = RECOMMENDATION_OPTIONS.find((item) => item.value === value);
  const label = option
    ? language === 'th'
      ? option.labelTh
      : option.labelEn
    : language === 'th'
      ? 'ยังไม่ได้เลือก'
      : 'Not selected';

  const toneMap: Record<string, string> = {
    PASS: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    FAIL: 'border-rose-200 bg-rose-50 text-rose-700',
    RESIGNED: 'border-slate-200 bg-slate-100 text-slate-700',
    EXTEND: 'border-amber-200 bg-amber-50 text-amber-700',
    OTHER: 'border-violet-200 bg-violet-50 text-violet-700',
  };

  return {
    label,
    tone: toneMap[value] || 'border-gray-200 bg-gray-50 text-gray-600',
  };
}

export function ProbationEvaluationFormPage() {
  const { evaluationId } = useParams<{ evaluationId: string }>();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { showToast } = useToast();

  const [evaluation, setEvaluation] = useState<ProbationEvaluationDetail | null>(null);
  const [sections, setSections] = useState<ProbationEvaluationSection[]>([]);
  const [recommendation, setRecommendation] = useState<string>('');
  const [resultComment, setResultComment] = useState('');
  const [extensionEndDate, setExtensionEndDate] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [actionComment, setActionComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!evaluationId) return;

    setLoading(true);
    try {
      const response = await getProbationEvaluationDetail(evaluationId);
      setEvaluation(response.evaluation);
      setSections(normalizeSections(response.evaluation.sections));
      setRecommendation(response.evaluation.recommendation || '');
      setResultComment(response.evaluation.result_comment || '');
      setExtensionEndDate(toInputDate(response.evaluation.extension_end_date));
      setSignatureData('');
      setActionComment('');
    } catch (error: any) {
      showToast(error.message || 'Failed to load evaluation detail', 'error');
    } finally {
      setLoading(false);
    }
  }, [evaluationId, showToast]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const currentTotal = useMemo(() => totalScore(sections), [sections]);
  const recommendationMeta = useMemo(
    () => getRecommendationMeta(recommendation, i18n.language),
    [recommendation, i18n.language]
  );
  const attendanceStats = useMemo(
    () => (evaluation ? buildAttendanceStats(evaluation) : { sick: 0, business: 0, absent: 0, late: 0, punishment: 0, remark: '' }),
    [evaluation]
  );

  const updateQuestion = (
    sectionCode: string,
    questionCode: string,
    field: 'score' | 'comment',
    value: number | string
  ) => {
    setSections((previous) =>
      previous.map((section) => {
        if (section.section_code !== sectionCode) return section;

        const questions = section.questions.map((question) => {
          if (question.question_code !== questionCode) return question;
          return {
            ...question,
            [field]: field === 'score' ? formatScoreValue(value) : String(value),
          };
        });

        return {
          ...section,
          questions,
          total_score: questions.reduce((sum, question) => sum + formatScoreValue(question.score), 0),
        };
      })
    );
  };

  const buildPayload = () => ({
    scores: sections.flatMap((section) =>
      section.questions.map((question) => ({
        question_code: question.question_code,
        score: formatScoreValue(question.score),
        comment: question.comment || '',
      }))
    ),
    recommendation: recommendation || null,
    result_comment: resultComment,
    extension_end_date: recommendation === 'EXTEND' ? extensionEndDate || null : null,
  });

  const handleSave = async () => {
    if (!evaluationId) return;

    setSaving(true);
    try {
      const response = await saveProbationEvaluation(evaluationId, buildPayload());
      setEvaluation(response.evaluation);
      setSections(normalizeSections(response.evaluation.sections));
      showToast(i18n.language === 'th' ? 'บันทึกแบบประเมินแล้ว' : 'Evaluation saved', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to save evaluation', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!evaluationId || !evaluation) return;

    if (
      !window.confirm(
        i18n.language === 'th'
          ? `ยืนยันส่งแบบประเมินขั้นตอน ${getStepLabel(evaluation.current_step, i18n.language)} ?`
          : `Confirm submit for ${getStepLabel(evaluation.current_step, i18n.language)} step?`
      )
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await submitProbationEvaluation(evaluationId, {
        ...buildPayload(),
        signature_data: signatureData || undefined,
        action_comment: actionComment || undefined,
      });
      setEvaluation(response.evaluation);
      setSections(normalizeSections(response.evaluation.sections));
      setActionComment('');
      setSignatureData('');
      showToast(i18n.language === 'th' ? 'ส่งแบบประเมินเรียบร้อยแล้ว' : 'Evaluation submitted', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to submit evaluation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEvaluation = async () => {
    if (!evaluationId || !evaluation) return;

    if (
      !window.confirm(
        i18n.language === 'th'
          ? `ยืนยันยกเลิกใบประเมินเลขที่ ${evaluation.form_number} ?`
          : `Confirm cancelling evaluation ${evaluation.form_number}?`
      )
    ) {
      return;
    }

    const comment = window.prompt(
      i18n.language === 'th'
        ? 'เหตุผลในการยกเลิกใบประเมิน (ไม่บังคับ)'
        : 'Cancellation reason (optional)',
      actionComment || ''
    );

    setCancelling(true);
    try {
      const response = await cancelProbationEvaluation(evaluationId, {
        comment: comment || undefined,
      });
      setEvaluation(response.evaluation);
      showToast(i18n.language === 'th' ? 'ยกเลิกใบประเมินเรียบร้อยแล้ว' : 'Evaluation cancelled', 'success');
      navigate('/probation-evaluations');
    } catch (error: any) {
      showToast(error.message || 'Failed to cancel evaluation', 'error');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-3 text-gray-500">
        <RefreshCw className="h-5 w-5 animate-spin" />
        {i18n.language === 'th' ? 'กำลังโหลดแบบประเมิน...' : 'Loading evaluation form...'}
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-700">
        {i18n.language === 'th' ? 'ไม่พบแบบประเมินนี้' : 'Evaluation form not found'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => navigate('/probation-evaluations')}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            {i18n.language === 'th' ? 'กลับไปหน้ารายการ' : 'Back to list'}
          </button>
          <div className="flex items-center gap-2 text-blue-700">
            <ClipboardCheck className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              Portfolio Form / {evaluation.form_number}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {i18n.language === 'th' ? 'แบบประเมินทดลองงาน' : 'Probation Evaluation Form'}
          </h1>
          <p className="max-w-3xl text-sm text-gray-600">
            {i18n.language === 'th'
              ? 'ฟอร์มนี้ออกแบบให้เล่า flow ประเมินทดลองงานแบบจบในหน้าเดียว ทั้งให้คะแนน บันทึก ส่งต่อ และพิมพ์จากข้อมูลชุดเดียวกัน'
              : 'This form keeps the full probation story in one place: scoring, saving, submission, and printing on the same demo dataset.'}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500">
              {i18n.language === 'th' ? 'ขั้นตอนปัจจุบัน' : 'Current Step'}
            </div>
            <div className="mt-2 text-lg font-semibold text-blue-700">
              {getStepLabel(evaluation.current_step, i18n.language)}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500">
              {i18n.language === 'th' ? 'คะแนนรวม' : 'Total Score'}
            </div>
            <div className="mt-2 text-lg font-semibold text-gray-900">{formatScoreValue(currentTotal)} / 100</div>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500">
              {i18n.language === 'th' ? 'เกณฑ์ผ่าน' : 'Pass Threshold'}
            </div>
            <div className="mt-2 text-lg font-semibold text-green-700">{evaluation.pass_threshold}</div>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <Printer className="h-4 w-4" />
            {i18n.language === 'th' ? 'พิมพ์แบบประเมิน' : 'Print Form'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="probation-print-sheet overflow-hidden rounded-[28px] border border-stone-300 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <div className="probation-print-header border-b border-stone-300 bg-stone-100 px-6 py-5 print:px-4 print:py-4">
            <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-4 print:grid-cols-[72px_minmax(0,1fr)]">
              <div className="flex items-center justify-center">
                <Logo size="large" />
              </div>
              <div className="text-center">
                <h2 className="probation-print-main-title text-2xl font-semibold text-gray-900 print:text-xl">
                  แบบประเมินผลการทดลองงาน/Evaluation Form
                </h2>
                <div className="probation-print-form-number mt-2 text-xs uppercase tracking-[0.18em] text-gray-500">
                  {evaluation.form_number}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm text-gray-900 probation-form-table">
              <colgroup>
                <col className="w-[16%]" />
                <col className="w-[34%]" />
                <col className="w-[16%]" />
                <col className="w-[34%]" />
              </colgroup>
              <tbody>
                <tr>
                  <td className="border border-stone-300 bg-stone-50 px-4 py-3 font-semibold leading-tight">
                    <div>ชื่อ</div>
                    <div className="text-[10px] font-medium whitespace-nowrap text-gray-600">Name</div>
                  </td>
                  <td className="border border-stone-300 px-4 py-3 font-semibold">
                    {i18n.language === 'th' ? evaluation.employee.name_th : evaluation.employee.name_en || evaluation.employee.name_th}
                  </td>
                  <td className="border border-stone-300 bg-stone-50 px-4 py-3 font-semibold leading-tight">
                    <div>ตำแหน่ง</div>
                    <div className="text-[10px] font-medium whitespace-nowrap text-gray-600">Position</div>
                  </td>
                  <td className="border border-stone-300 px-4 py-3">
                    {i18n.language === 'th'
                      ? evaluation.employee.position_th || '-'
                      : evaluation.employee.position_en || evaluation.employee.position_th || '-'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-stone-300 bg-stone-50 px-4 py-3 font-semibold leading-tight">
                    <div>รหัสพนักงาน</div>
                    <div className="text-[10px] font-medium whitespace-nowrap text-gray-600">Employee Code</div>
                  </td>
                  <td className="border border-stone-300 px-4 py-3">
                    {evaluation.employee.employee_code || '-'}
                  </td>
                  <td className="border border-stone-300 bg-stone-50 px-4 py-3 font-semibold leading-tight">
                    <div>หัวหน้างาน</div>
                    <div className="text-[10px] font-medium whitespace-nowrap text-gray-600">Leader</div>
                  </td>
                  <td className="border border-stone-300 px-4 py-3">
                    {evaluation.approvers.leader
                      ? i18n.language === 'th'
                        ? evaluation.approvers.leader.th || evaluation.approvers.leader.en
                        : evaluation.approvers.leader.en || evaluation.approvers.leader.th
                      : '-'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-stone-300 bg-stone-50 px-4 py-3 font-semibold leading-tight">
                    <div>ฝ่าย</div>
                    <div className="text-[10px] font-medium whitespace-nowrap text-gray-600">Dept</div>
                  </td>
                  <td className="border border-stone-300 px-4 py-3">
                    {i18n.language === 'th'
                      ? evaluation.employee.department_name_th || '-'
                      : evaluation.employee.department_name_en || evaluation.employee.department_name_th || '-'}
                  </td>
                  <td className="border border-stone-300 bg-stone-50 px-4 py-3 font-semibold leading-tight">
                    <div>ผู้จัดการ</div>
                    <div className="text-[10px] font-medium whitespace-nowrap text-gray-600">Manager</div>
                  </td>
                  <td className="border border-stone-300 px-4 py-3">
                    {i18n.language === 'th'
                      ? evaluation.approvers.manager.th || evaluation.approvers.manager.en
                      : evaluation.approvers.manager.en || evaluation.approvers.manager.th}
                  </td>
                </tr>
                <tr>
                  <td className="border border-stone-300 bg-stone-50 px-4 py-3 font-semibold">
                    ทดลองงานตั้งแต่วันที่
                    <div className="mt-1 text-[10px] font-medium whitespace-nowrap text-gray-500">Start date of probation</div>
                  </td>
                  <td className="border border-stone-300 px-4 py-3">{formatDate(evaluation.probation_start_date, i18n.language)}</td>
                  <td className="border border-stone-300 bg-stone-50 px-4 py-3 font-semibold">
                    จนถึงวันที่
                    <div className="mt-1 text-[10px] font-medium whitespace-nowrap text-gray-500">End date of probation</div>
                  </td>
                  <td className="border border-stone-300 px-4 py-3">{formatDate(evaluation.probation_end_date, i18n.language)}</td>
                </tr>
                <tr>
                  <td className="border border-stone-300 bg-stone-50 px-4 py-3 font-semibold leading-tight">
                    <div>HR</div>
                  </td>
                  <td className="border border-stone-300 px-4 py-3">
                    {i18n.language === 'th'
                      ? evaluation.approvers.hr_ack.th || evaluation.approvers.hr_ack.en
                      : evaluation.approvers.hr_ack.en || evaluation.approvers.hr_ack.th}
                  </td>
                  <td className="border border-stone-300 bg-stone-50 px-4 py-3 font-semibold leading-tight">
                    <div>Admin Manager</div>
                  </td>
                  <td className="border border-stone-300 px-4 py-3">
                    {i18n.language === 'th'
                      ? evaluation.approvers.hr_manager.th || evaluation.approvers.hr_manager.en
                      : evaluation.approvers.hr_manager.en || evaluation.approvers.hr_manager.th}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm text-gray-900 probation-form-table">
              <thead>
                <tr className="bg-stone-100">
                  <th className="w-[5%] border border-stone-300 px-3 py-3 align-middle text-left">#</th>
                  <th className="w-[58%] border border-stone-300 px-3 py-3 align-middle text-left">
                    รายการประเมิน/Criteria
                  </th>
                  <th className="w-[10%] border border-stone-300 px-3 py-3 align-middle text-center whitespace-nowrap">
                    คะแนนเต็ม
                  </th>
                  <th className="w-[10%] border border-stone-300 px-3 py-3 align-middle text-center whitespace-nowrap">
                    คะแนน/Score
                  </th>
                  <th className="w-[17%] border border-stone-300 px-3 py-3 align-middle text-left">
                    ความคิดเห็นเพิ่มเติม/Comment
                  </th>
                </tr>
              </thead>
              <tbody>
                {sections.map((section) => (
                  <>
                    <tr key={section.section_code} className="bg-stone-50 align-middle">
                      <td className="border border-stone-300 px-3 py-2 font-semibold align-middle">{section.section_no}</td>
                      <td className="border border-stone-300 px-3 py-2 font-semibold leading-snug">
                        {section.title_th}/{section.title_en} (score {section.max_score})
                      </td>
                      <td className="border border-stone-300 px-3 py-2 text-center font-semibold align-middle">{section.max_score}</td>
                      <td className="border border-stone-300 px-3 py-2 text-center font-semibold align-middle">{formatScoreValue(section.total_score)}</td>
                      <td className="border border-stone-300 px-3 py-2 align-middle text-[10px] font-medium leading-tight text-gray-700">
                        {i18n.language === 'th' ? 'คะแนนรวมของหมวด' : 'Section total'}
                      </td>
                    </tr>
                    {section.questions.map((question) => (
                      <tr key={question.question_code} className="align-middle">
                        <td className="border border-stone-300 px-3 py-2 align-middle">{question.question_no}</td>
                        <td className="border border-stone-300 px-3 py-2 align-middle">
                          <div className="font-medium">{question.question_text_th}</div>
                          <div className="probation-print-secondary mt-1 text-xs text-gray-500">{question.question_text_en}</div>
                        </td>
                        <td className="border border-stone-300 px-3 py-2 text-center align-middle">{question.max_score}</td>
                        <td className="border border-stone-300 px-2 py-2 align-middle">
                          <input
                            type="number"
                            min={0}
                            max={question.max_score}
                            step="1"
                            value={question.score}
                            disabled={!evaluation.permissions.can_edit}
                            onChange={(event) =>
                              updateQuestion(
                                section.section_code,
                                question.question_code,
                                'score',
                                Math.min(question.max_score, Math.max(0, formatScoreValue(event.target.value || 0)))
                              )
                            }
                            className="probation-score-input w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-center text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 print:border-0 print:bg-transparent print:px-0 print:text-right print:shadow-none"
                          />
                        </td>
                        <td className="border border-stone-300 px-2 py-2 align-middle">
                          <textarea
                            rows={2}
                            value={question.comment}
                            disabled={!evaluation.permissions.can_edit}
                            onChange={(event) =>
                              updateQuestion(section.section_code, question.question_code, 'comment', event.target.value)
                            }
                            className="probation-score-comment min-h-14 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 print:border-0 print:bg-transparent print:px-0 print:shadow-none"
                            placeholder={i18n.language === 'th' ? 'หมายเหตุ' : 'Comment'}
                          />
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
                <tr className="align-middle">
                  <td colSpan={3} className="border border-stone-300 px-3 py-3 text-right font-semibold align-middle">
                    คะแนนรวม/Score 100
                  </td>
                  <td className="border border-stone-300 px-3 py-3 text-center align-middle text-lg font-bold">
                    {formatScoreValue(currentTotal)}
                  </td>
                  <td className="border border-stone-300 px-3 py-3 align-middle text-xs leading-tight text-gray-600">
                    {currentTotal >= evaluation.pass_threshold
                      ? i18n.language === 'th'
                        ? 'มากกว่า 65 คะแนน ถือว่าผ่าน'
                        : 'More than 65 scores are pass evaluation'
                      : i18n.language === 'th'
                        ? 'ต่ำกว่าเกณฑ์ผ่าน'
                        : 'Below pass threshold'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="border-t border-stone-300 px-6 py-5 print:px-4 print:py-4">
            <h3 className="probation-print-section-title text-base font-semibold text-gray-900">ผลการประเมิน/Evaluation Results</h3>
            <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 print:hidden">
              <div className="text-xs uppercase tracking-wide text-stone-500">
                {i18n.language === 'th' ? 'ผลที่เลือก' : 'Selected Result'}
              </div>
              <div className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${recommendationMeta.tone}`}>
                {recommendationMeta.label}
              </div>
            </div>

            <div className="mt-4 hidden space-y-2 print:block">
              {PRINT_RECOMMENDATION_OPTIONS.map((option) => {
                const checked = recommendation === option.value;
                return (
                  <div key={option.value} className="flex items-center gap-2 text-sm text-gray-900">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-600 text-[10px]">
                      {checked ? '•' : ''}
                    </span>
                    <span>{i18n.language === 'th' ? option.labelTh : option.labelEn}</span>
                  </div>
                );
              })}
            </div>

            {recommendation === 'EXTEND' && (
              <div className="mt-3 flex items-center gap-3 text-sm">
                <span className="font-medium text-gray-700">
                  {i18n.language === 'th' ? 'ขยายถึงวันที่' : 'Extend until'}
                </span>
                <input
                  type="date"
                  value={extensionEndDate}
                  onChange={(event) => setExtensionEndDate(event.target.value)}
                  disabled={!evaluation.permissions.can_edit}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 print:border-0 print:px-0"
                />
              </div>
            )}

            <div className="probation-overall-comment mt-5">
              <label className="probation-print-section-label mb-2 block text-sm font-medium text-gray-700">
                ความเห็นเพิ่มเติม/Comment
              </label>
              <textarea
                value={resultComment}
                onChange={(event) => setResultComment(event.target.value)}
                disabled={!evaluation.permissions.can_edit}
                rows={4}
                className="probation-result-comment w-full border-0 border-b border-dashed border-stone-300 bg-transparent px-0 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-0 print:min-h-24 print:border-0 print:px-0 print:py-0"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm text-gray-900 probation-form-table">
              <thead>
                <tr className="bg-stone-100">
                  <th colSpan={6} className="border border-stone-300 px-3 py-3 text-center font-semibold">
                    สถิติการมาทำงานและการลงโทษทางวินัย/Attendance and disciplinary action
                  </th>
                </tr>
                <tr className="bg-stone-50">
                  <th className="border border-stone-300 px-3 py-2 text-center">Attendance</th>
                  <th className="border border-stone-300 px-3 py-2 text-center">Sick</th>
                  <th className="border border-stone-300 px-3 py-2 text-center">Business</th>
                  <th className="border border-stone-300 px-3 py-2 text-center">Absent</th>
                  <th className="border border-stone-300 px-3 py-2 text-center">Late</th>
                  <th className="border border-stone-300 px-3 py-2 text-center">Punishment / Remark</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-stone-300 px-3 py-3 text-center">Attendance</td>
                  <td className="border border-stone-300 px-3 py-3 text-center">{attendanceStats.sick}</td>
                  <td className="border border-stone-300 px-3 py-3 text-center">{attendanceStats.business}</td>
                  <td className="border border-stone-300 px-3 py-3 text-center">{attendanceStats.absent}</td>
                  <td className="border border-stone-300 px-3 py-3 text-center">{attendanceStats.late}</td>
                  <td className="border border-stone-300 px-3 py-3 text-center">
                    {attendanceStats.punishment}
                    {attendanceStats.remark ? ` / ${attendanceStats.remark}` : ''}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="probation-print-signature-section border-t border-stone-200 px-4 py-5">
            {[
              [
                {
                  title: 'พนักงานผู้ถูกประเมิน/Employee',
                  value: i18n.language === 'th'
                    ? evaluation.employee.name_th
                    : evaluation.employee.name_en || evaluation.employee.name_th,
                },
                { title: 'ผู้ประเมิน/Assessor', value: signatureData || '' },
                {
                  title: 'ผู้จัดการแผนก/Manager',
                  value: i18n.language === 'th'
                    ? evaluation.approvers.manager.th || evaluation.approvers.manager.en
                    : evaluation.approvers.manager.en || evaluation.approvers.manager.th,
                },
              ],
              [
                {
                  title: 'บุคคล/HR',
                  value: i18n.language === 'th'
                    ? evaluation.approvers.hr_ack.th || evaluation.approvers.hr_ack.en
                    : evaluation.approvers.hr_ack.en || evaluation.approvers.hr_ack.th,
                },
                {
                  title: 'Admin Manager',
                  value: i18n.language === 'th'
                    ? evaluation.approvers.hr_manager.th || evaluation.approvers.hr_manager.en
                    : evaluation.approvers.hr_manager.en || evaluation.approvers.hr_manager.th,
                },
              ],
            ].map((row, rowIndex) => (
              <div
                key={`signature-row-${rowIndex}`}
                className={`probation-print-signatures grid gap-4 ${
                  row.length === 3 ? 'md:grid-cols-3' : 'mx-auto max-w-3xl md:grid-cols-2'
                } ${rowIndex > 0 ? 'mt-8' : ''}`}
              >
                {row.map((signer) => (
                  <div key={signer.title} className="probation-print-signature flex min-h-[100px] flex-col items-center gap-2 text-center">
                    <div className="probation-print-signature-line flex min-h-12 w-full max-w-[220px] items-end justify-center border-b border-gray-400 px-3 pb-1 text-sm text-gray-800">
                      {' '}
                    </div>
                    <div className="probation-print-signature-name text-sm text-gray-800">{signer.value || ' '}</div>
                    <div className="probation-print-signature-title text-sm font-medium text-gray-700">{signer.title}</div>
                    <div className="probation-print-signature-date text-xs text-gray-500">____ / ____ / ______</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
        <aside className="no-print space-y-6">
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <FileSignature className="h-5 w-5 text-blue-600" />
              {i18n.language === 'th' ? 'แผงควบคุมการประเมิน' : 'Evaluation Controls'}
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {i18n.language === 'th' ? 'ลายเซ็น / acknowledgement' : 'Signature / acknowledgement'}
                </label>
                <input
                  value={signatureData}
                  onChange={(event) => setSignatureData(event.target.value)}
                  disabled={!evaluation.permissions.can_edit}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder={
                    i18n.language === 'th'
                      ? 'พิมพ์ชื่อผู้ประเมินเพื่อใช้เป็นลายเซ็นทดสอบ'
                      : 'Type evaluator name for testing signature flow'
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  {i18n.language === 'th' ? 'ผลการประเมิน' : 'Evaluation Result'}
                </label>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {RECOMMENDATION_OPTIONS.map((option) => {
                    const active = recommendation === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setRecommendation(option.value)}
                        disabled={!evaluation.permissions.can_edit}
                        className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          active
                            ? option.value === 'PASS'
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm'
                              : option.value === 'FAIL'
                                ? 'border-rose-300 bg-rose-50 text-rose-800 shadow-sm'
                                : option.value === 'RESIGNED'
                                  ? 'border-slate-300 bg-slate-100 text-slate-800 shadow-sm'
                                  : option.value === 'EXTEND'
                                    ? 'border-amber-300 bg-amber-50 text-amber-800 shadow-sm'
                                    : 'border-violet-300 bg-violet-50 text-violet-800 shadow-sm'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-medium leading-snug">
                          {i18n.language === 'th' ? option.labelTh : option.labelEn}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {recommendation === 'EXTEND' && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    {i18n.language === 'th' ? 'ขยายถึงวันที่' : 'Extend until'}
                  </label>
                  <input
                    type="date"
                    value={extensionEndDate}
                    onChange={(event) => setExtensionEndDate(event.target.value)}
                    disabled={!evaluation.permissions.can_edit}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">
                  {i18n.language === 'th' ? 'หมายเหตุในการส่งต่อ' : 'Submission Note'}
                </label>
                <textarea
                  value={actionComment}
                  onChange={(event) => setActionComment(event.target.value)}
                  disabled={!evaluation.permissions.can_edit}
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder={
                    i18n.language === 'th'
                      ? 'บันทึกหมายเหตุสำหรับ action history'
                      : 'Optional note saved to action history'
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700 hover:bg-sky-100"
                >
                  <Printer className="h-4 w-4" />
                  {i18n.language === 'th' ? 'พิมพ์แบบประเมิน' : 'Print Form'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={!evaluation.permissions.can_edit || saving || submitting || cancelling}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {i18n.language === 'th' ? 'บันทึกฉบับร่าง' : 'Save Draft'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCancelEvaluation()}
                  disabled={!evaluation.permissions.can_cancel || saving || submitting || cancelling}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                >
                  {cancelling ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CircleAlert className="h-4 w-4" />}
                  {i18n.language === 'th' ? 'ยกเลิกใบประเมิน' : 'Cancel Evaluation'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={!evaluation.permissions.can_submit || saving || submitting || cancelling}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {i18n.language === 'th' ? 'ส่งต่อขั้นตอนถัดไป' : 'Submit to Next Step'}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              {i18n.language === 'th' ? 'ประวัติการดำเนินการ' : 'Action History'}
            </div>
            <div className="mt-4 space-y-3">
              {evaluation.actions.length === 0 ? (
                <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
                  {i18n.language === 'th' ? 'ยังไม่มี action history' : 'No action history yet'}
                </div>
              ) : (
                evaluation.actions.map((action) => (
                  <div key={action.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-gray-900">
                          {action.action_type} • {getStepLabel(action.action_step, i18n.language)}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {(i18n.language === 'th' ? action.actor_name_th : action.actor_name_en || action.actor_name_th) || '-'}
                          {action.actor_code ? ` • ${action.actor_code}` : ''}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">{formatDate(action.created_at, i18n.language)}</div>
                    </div>
                    {action.comment && <div className="mt-3 text-sm text-gray-700">{action.comment}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default ProbationEvaluationFormPage;
