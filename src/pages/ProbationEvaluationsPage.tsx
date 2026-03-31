import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, RefreshCw, Search, FilePlus2, Clock3, CircleAlert, UserX } from 'lucide-react';
import {
  cancelProbationEvaluation,
  getProbationEvaluations,
  issueProbationHrDocument,
  ProbationCandidate,
  ProbationSummary,
  ProbationWorkflowStage,
} from '../api/probationEvaluations';
import { getEmployees, Employee, deleteEmployee } from '../api/employee';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { isDev } from '../utils/permissions';

const EMPTY_SUMMARY: ProbationSummary = {
  total_candidates: 0,
  due_soon: 0,
  pending_hr_document: 0,
  pending_assessor_review: 0,
  pending_employee_notification: 0,
  completed: 0,
};

const STAGE_OPTIONS: { value: string; labelTh: string; labelEn: string }[] = [
  { value: 'all', labelTh: 'ทั้งหมด', labelEn: 'All' },
  { value: 'watchlist', labelTh: 'รอติดตาม', labelEn: 'Watchlist' },
  { value: 'due_soon', labelTh: 'แจ้งเตือนล่วงหน้า', labelEn: 'Due Soon' },
  { value: 'pending_hr_document', labelTh: 'รอ HR ออกเอกสาร', labelEn: 'Pending HR Document' },
  { value: 'pending_assessor_review', labelTh: 'รอผู้ประเมินให้คะแนน', labelEn: 'Pending Assessor Review' },
  {
    value: 'pending_employee_notification',
    labelTh: 'รอแจ้งผลพนักงาน',
    labelEn: 'Pending Employee Notification',
  },
  { value: 'completed', labelTh: 'เสร็จสิ้น', labelEn: 'Completed' },
];

function formatDate(value: string, locale: string) {
  return new Date(value).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-GB');
}

function stageLabel(stage: ProbationWorkflowStage, language: string) {
  const labels: Record<ProbationWorkflowStage, { th: string; en: string }> = {
    watchlist: { th: 'รอติดตาม', en: 'Watchlist' },
    due_soon: { th: 'แจ้งเตือนล่วงหน้า', en: 'Due Soon' },
    pending_hr_document: { th: 'รอ HR ออกเอกสาร', en: 'Pending HR Document' },
    pending_assessor_review: { th: 'รอผู้ประเมินให้คะแนน', en: 'Pending Assessor Review' },
    pending_employee_notification: { th: 'รอแจ้งผลพนักงาน', en: 'Pending Employee Notification' },
    completed: { th: 'เสร็จสิ้น', en: 'Completed' },
  };

  return language === 'th' ? labels[stage].th : labels[stage].en;
}

function stageBadgeClass(stage: ProbationWorkflowStage) {
  switch (stage) {
    case 'pending_hr_document':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'due_soon':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'pending_assessor_review':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'pending_employee_notification':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'completed':
      return 'bg-green-100 text-green-700 border-green-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export function ProbationEvaluationsPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [summary, setSummary] = useState<ProbationSummary>(EMPTY_SUMMARY);
  const [candidates, setCandidates] = useState<ProbationCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuingEmployeeId, setIssuingEmployeeId] = useState<string | null>(null);
  const [resigningEmployeeId, setResigningEmployeeId] = useState<string | null>(null);
  const [cancellingEvaluationId, setCancellingEvaluationId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('all');
  const [leaderOptions, setLeaderOptions] = useState<Employee[]>([]);
  const [loadingLeaders, setLoadingLeaders] = useState(false);
  const [issueDialogCandidate, setIssueDialogCandidate] = useState<ProbationCandidate | null>(null);
  const [issueDocumentReference, setIssueDocumentReference] = useState('');
  const [selectedLeaderId, setSelectedLeaderId] = useState('');

  const canIssueDocument =
    isDev(user) || ['hr', 'admin'].includes(user?.role || '');

  const loadLeaderOptions = useCallback(async () => {
    if (!canIssueDocument) return;

    setLoadingLeaders(true);
    try {
      const leaders = await getEmployees({ role: 'leader', status: 'active' });
      setLeaderOptions(leaders);
    } catch (error: any) {
      showToast(error.message || 'Failed to load leaders', 'error');
    } finally {
      setLoadingLeaders(false);
    }
  }, [canIssueDocument, showToast]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getProbationEvaluations({ search, stage });
      setSummary(response.summary);
      setCandidates(response.candidates);
    } catch (error: any) {
      showToast(error.message || 'Failed to load probation evaluations', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, showToast, stage]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (canIssueDocument) {
      void loadLeaderOptions();
    }
  }, [canIssueDocument, loadLeaderOptions]);

  const cards = useMemo(
    () => [
      {
        key: 'total',
        label: i18n.language === 'th' ? 'พนักงานในช่วงทดลองงาน' : 'Employees In Scope',
        value: summary.total_candidates,
        tone: 'bg-slate-100 text-slate-700',
      },
      {
        key: 'due_soon',
        label: i18n.language === 'th' ? 'ครบกำหนดแจ้งเตือน' : 'Due Soon',
        value: summary.due_soon,
        tone: 'bg-amber-100 text-amber-700',
      },
      {
        key: 'pending_hr',
        label: i18n.language === 'th' ? 'รอ HR ออกเอกสาร' : 'Pending HR Document',
        value: summary.pending_hr_document,
        tone: 'bg-red-100 text-red-700',
      },
      {
        key: 'pending_assessor',
        label: i18n.language === 'th' ? 'รอผู้ประเมิน' : 'Pending Assessor Review',
        value: summary.pending_assessor_review,
        tone: 'bg-blue-100 text-blue-700',
      },
    ],
    [i18n.language, summary]
  );

  const handleIssueDocument = (candidate: ProbationCandidate) => {
    setIssueDialogCandidate(candidate);
    setIssueDocumentReference(candidate.hr_document_reference || '');
    setSelectedLeaderId('');
  };

  const handleConfirmIssueDocument = async () => {
    if (!issueDialogCandidate) return;

    setIssuingEmployeeId(issueDialogCandidate.employee_id);
    try {
      const response = await issueProbationHrDocument(
        issueDialogCandidate.employee_id,
        issueDocumentReference || undefined,
        selectedLeaderId || undefined
      );
      showToast(
        response.message ||
          (i18n.language === 'th'
            ? 'ออกเอกสารประเมินทดลองงานเรียบร้อยแล้ว'
            : 'Probation document issued successfully'),
        'success'
      );
      setIssueDialogCandidate(null);
      setIssueDocumentReference('');
      setSelectedLeaderId('');
      await loadData();
    } catch (error: any) {
      showToast(error.message || 'Failed to issue probation document', 'error');
    } finally {
      setIssuingEmployeeId(null);
    }
  };

  const handleMarkResigned = async (candidate: ProbationCandidate) => {
    const confirmed = window.confirm(
      i18n.language === 'th'
        ? `ยืนยันบันทึกว่า ${candidate.name_th} ลาออกแล้ว?`
        : `Confirm marking ${candidate.name_en || candidate.name_th} as resigned?`
    );

    if (!confirmed) return;

    const reason = window.prompt(
      i18n.language === 'th'
        ? 'เหตุผลการลาออก (ไม่บังคับ)'
        : 'Resignation reason (optional)',
      ''
    );

    const today = new Date().toISOString().slice(0, 10);

    setResigningEmployeeId(candidate.employee_id);
    try {
      await deleteEmployee(candidate.employee_id, today, reason || undefined);
      showToast(
        i18n.language === 'th'
          ? 'บันทึกพนักงานลาออกเรียบร้อยแล้ว'
          : 'Employee marked as resigned successfully',
        'success'
      );
      await loadData();
    } catch (error: any) {
      showToast(error.message || 'Failed to mark employee as resigned', 'error');
    } finally {
      setResigningEmployeeId(null);
    }
  };

  const handleCancelEvaluation = async (candidate: ProbationCandidate) => {
    if (!candidate.evaluation_id) return;

    const confirmed = window.confirm(
      i18n.language === 'th'
        ? `ยืนยันยกเลิกใบประเมินของ ${candidate.name_th} ?`
        : `Confirm cancelling evaluation for ${candidate.name_en || candidate.name_th}?`
    );

    if (!confirmed) return;

    const comment = window.prompt(
      i18n.language === 'th'
        ? 'เหตุผลในการยกเลิกใบประเมิน (ไม่บังคับ)'
        : 'Cancellation reason (optional)',
      ''
    );

    setCancellingEvaluationId(candidate.evaluation_id);
    try {
      await cancelProbationEvaluation(candidate.evaluation_id, {
        comment: comment || undefined,
      });
      showToast(
        i18n.language === 'th'
          ? 'ยกเลิกใบประเมินเรียบร้อยแล้ว'
          : 'Evaluation cancelled successfully',
        'success'
      );
      await loadData();
    } catch (error: any) {
      showToast(error.message || 'Failed to cancel evaluation', 'error');
    } finally {
      setCancellingEvaluationId(null);
    }
  };

  const leaderSelectOptions = leaderOptions.map((leader) => ({
    value: leader.id,
    label:
      i18n.language === 'th'
        ? `${leader.name_th} (${leader.employee_code})`
        : `${leader.name_en || leader.name_th} (${leader.employee_code})`,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-blue-700">
            <ClipboardCheck className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">Portfolio Demo / Neon</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            {i18n.language === 'th' ? 'ประเมินทดลองงาน' : 'Probation Evaluations'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">
            {i18n.language === 'th'
              ? 'หน้านี้ใช้ข้อมูลจริงจาก Neon เพื่อโชว์ flow การประเมินทดลองงานใน portfolio demo'
              : 'This screen reads live Neon data for the portfolio probation workflow.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {i18n.language === 'th' ? 'รีเฟรช' : 'Refresh'}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.key} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">{card.label}</div>
            <div className={`mt-3 inline-flex rounded-full px-3 py-1 text-2xl font-bold ${card.tone}`}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                i18n.language === 'th'
                  ? 'ค้นหาจากรหัสพนักงาน, ชื่อ, หรือแผนก'
                  : 'Search by code, name, or department'
              }
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <select
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            {STAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {i18n.language === 'th' ? option.labelTh : option.labelEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CircleAlert className="h-4 w-4 text-amber-500" />
            {i18n.language === 'th'
              ? 'หน้าประเมินนี้อ้างอิงฐานข้อมูลจริงของ demo เพื่อให้ scoring, sign-off และ print flow เดินได้จากชุดข้อมูลเดียวกัน'
              : 'This page uses the demo database records directly so scoring, sign-off, and printing all stay on one workflow.'}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 px-5 py-16 text-gray-500">
            <RefreshCw className="h-5 w-5 animate-spin" />
            {i18n.language === 'th' ? 'กำลังโหลดข้อมูลทดลองงาน...' : 'Loading probation data...'}
          </div>
        ) : candidates.length === 0 ? (
          <div className="px-5 py-16 text-center text-gray-500">
            {i18n.language === 'th'
              ? 'ไม่พบพนักงานที่เข้าเงื่อนไขทดลองงานในตัวกรองนี้'
              : 'No probation candidates matched this filter'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3">{i18n.language === 'th' ? 'พนักงาน' : 'Employee'}</th>
                  <th className="px-5 py-3">{i18n.language === 'th' ? 'อายุงาน' : 'Days Worked'}</th>
                  <th className="px-5 py-3">{i18n.language === 'th' ? 'ครบ 60 วัน' : '60-Day Review'}</th>
                  <th className="px-5 py-3">{i18n.language === 'th' ? 'ครบ 119 วัน' : '119-Day Limit'}</th>
                  <th className="px-5 py-3">{i18n.language === 'th' ? 'สถานะ' : 'Stage'}</th>
                  <th className="px-5 py-3">{i18n.language === 'th' ? 'วันลาที่ใช้แล้ว' : 'Approved Leave Days'}</th>
                  <th className="w-[240px] px-5 py-3">{i18n.language === 'th' ? 'การดำเนินการ' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {candidates.map((candidate) => {
                  const totalLeaveDays = candidate.leave_summary.reduce(
                    (sum, item) => sum + item.total_days,
                    0
                  );

                  return (
                    <tr key={candidate.employee_id} className="align-top">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-900">
                          {i18n.language === 'th' ? candidate.name_th : candidate.name_en || candidate.name_th}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {candidate.employee_code}
                          {candidate.position_th ? ` • ${i18n.language === 'th' ? candidate.position_th : candidate.position_en || candidate.position_th}` : ''}
                        </div>
                        {candidate.form_number && (
                          <div className="mt-1 text-xs text-blue-600">
                            {candidate.form_number}
                          </div>
                        )}
                        <div className="mt-1 text-xs text-gray-400">
                          {i18n.language === 'th'
                            ? candidate.department_name_th || '-'
                            : candidate.department_name_en || candidate.department_name_th || '-'}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-900">{candidate.days_worked}</div>
                        <div className="text-xs text-gray-500">
                          {i18n.language === 'th' ? 'เริ่มงาน' : 'Hire Date'} {formatDate(candidate.hire_date, i18n.language)}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-700">
                        {formatDate(candidate.review_due_date, i18n.language)}
                      </td>
                      <td className="px-5 py-4 text-gray-700">
                        {formatDate(candidate.probation_end_date, i18n.language)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${stageBadgeClass(
                            candidate.workflow_stage
                          )}`}
                        >
                          {stageLabel(candidate.workflow_stage, i18n.language)}
                        </span>
                        {candidate.hr_document_issued_at && (
                          <div className="mt-2 text-xs text-gray-500">
                            {i18n.language === 'th' ? 'ออกเอกสารแล้ว' : 'Issued'}{' '}
                            {formatDate(candidate.hr_document_issued_at, i18n.language)}
                          </div>
                        )}
                        {candidate.current_step && (
                          <div className="mt-1 text-xs text-gray-400">
                            {i18n.language === 'th' ? 'ขั้นตอนปัจจุบัน' : 'Current step'}: {candidate.current_step}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-900">{totalLeaveDays.toFixed(1)}</div>
                        {candidate.leave_summary.length > 0 && (
                          <div className="mt-2 space-y-1 text-xs text-gray-500">
                            {candidate.leave_summary.slice(0, 3).map((item, index) => (
                              <div key={`${candidate.employee_id}-${index}`}>
                                {(i18n.language === 'th'
                                  ? item.leave_type_name_th
                                  : item.leave_type_name_en || item.leave_type_name_th) || '-'}:{' '}
                                {item.total_days}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="w-[200px] space-y-2">
                          {candidate.evaluation_id ? (
                            <div className="space-y-2">
                              <button
                                type="button"
                                onClick={() => navigate(`/probation-evaluations/${candidate.evaluation_id}`)}
                                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100"
                              >
                                <ClipboardCheck className="h-4 w-4" />
                                {i18n.language === 'th' ? 'เปิดแบบประเมิน' : 'Open Form'}
                              </button>

                              {canIssueDocument && (
                                <button
                                  type="button"
                                  onClick={() => void handleCancelEvaluation(candidate)}
                                  disabled={cancellingEvaluationId === candidate.evaluation_id}
                                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                                >
                                  {cancellingEvaluationId === candidate.evaluation_id ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CircleAlert className="h-4 w-4" />
                                  )}
                                  {i18n.language === 'th' ? 'ยกเลิกใบประเมิน' : 'Cancel Evaluation'}
                                </button>
                              )}

                              {canIssueDocument && (
                                <button
                                  type="button"
                                  onClick={() => void handleMarkResigned(candidate)}
                                  disabled={resigningEmployeeId === candidate.employee_id}
                                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                                >
                                  {resigningEmployeeId === candidate.employee_id ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <UserX className="h-4 w-4" />
                                  )}
                                  {i18n.language === 'th' ? 'ลาออก' : 'Resigned'}
                                </button>
                              )}
                            </div>
                          ) : null}

                          {!candidate.evaluation_id && canIssueDocument && (
                            <button
                              type="button"
                              onClick={() => void handleMarkResigned(candidate)}
                              disabled={resigningEmployeeId === candidate.employee_id}
                              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                            >
                              {resigningEmployeeId === candidate.employee_id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <UserX className="h-4 w-4" />
                              )}
                              {i18n.language === 'th' ? 'ลาออก' : 'Resigned'}
                            </button>
                          )}

                          {canIssueDocument && candidate.workflow_stage === 'pending_hr_document' ? (
                            <button
                              type="button"
                              onClick={() => handleIssueDocument(candidate)}
                              disabled={issuingEmployeeId === candidate.employee_id}
                              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                            >
                              {issuingEmployeeId === candidate.employee_id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <FilePlus2 className="h-4 w-4" />
                              )}
                              {i18n.language === 'th' ? 'ออกเอกสาร HR' : 'Issue HR Document'}
                            </button>
                          ) : !candidate.evaluation_id ? (
                            <div className="inline-flex items-center gap-2 text-xs text-gray-500">
                              <Clock3 className="h-4 w-4" />
                              {i18n.language === 'th' ? 'รอขั้นตอนถัดไป' : 'Waiting for next step'}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {issueDialogCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {i18n.language === 'th' ? 'ออกเอกสารประเมินทดลองงาน' : 'Issue Probation Document'}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {i18n.language === 'th'
                    ? `กำหนดเลขที่เอกสารและเลือก Leader สำหรับ ${issueDialogCandidate.name_th}`
                    : `Set document reference and choose a leader for ${issueDialogCandidate.name_en || issueDialogCandidate.name_th}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIssueDialogCandidate(null);
                  setIssueDocumentReference('');
                  setSelectedLeaderId('');
                }}
                className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
              >
                {i18n.language === 'th' ? 'ปิด' : 'Close'}
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  {i18n.language === 'th' ? 'เลขที่เอกสาร' : 'Document Reference'}
                </label>
                <input
                  value={issueDocumentReference}
                  onChange={(event) => setIssueDocumentReference(event.target.value)}
                  placeholder={i18n.language === 'th' ? 'ระบุเลขที่เอกสาร (ถ้ามี)' : 'Enter document reference (optional)'}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  {i18n.language === 'th' ? 'Leader ผู้ประเมิน' : 'Leader Assessor'}
                </label>
                <SearchableSelect
                  value={selectedLeaderId}
                  options={leaderSelectOptions}
                  onChange={setSelectedLeaderId}
                  disabled={loadingLeaders}
                  placeholder={
                    loadingLeaders
                      ? i18n.language === 'th'
                        ? 'กำลังโหลดรายชื่อ Leader...'
                        : 'Loading leaders...'
                      : i18n.language === 'th'
                        ? 'เลือก Leader สำหรับใบประเมินนี้'
                        : 'Select a leader for this probation form'
                  }
                />
                <p className="mt-2 text-xs text-gray-500">
                  {i18n.language === 'th'
                    ? 'หากไม่เลือก ระบบจะใช้ direct leader เดิมของพนักงาน หรือ fallback ตามกติกาปัจจุบัน'
                    : 'If no leader is selected, the system will fall back to the employee direct leader or the current default rule.'}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIssueDialogCandidate(null);
                  setIssueDocumentReference('');
                  setSelectedLeaderId('');
                }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {i18n.language === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmIssueDocument()}
                disabled={issuingEmployeeId === issueDialogCandidate.employee_id}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {issuingEmployeeId === issueDialogCandidate.employee_id && (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                )}
                {i18n.language === 'th' ? 'ยืนยันออกเอกสาร' : 'Confirm Issue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProbationEvaluationsPage;
