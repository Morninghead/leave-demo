import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Calendar,
  Clock,
  User,
  FileText,
  AlertCircle,
  CheckCircle,
  Ban,
  XCircle,
} from "lucide-react";
import { useToast } from "../../hooks/useToast";
import { LeaveRequest } from "../../types/leave";
import {
  updateLeaveRequestStatus,
  voidLeaveRequest,
  requestLeaveCancellation,
} from "../../api/leave";
import { formatDateRange, formatDateTime } from "../../utils/dateUtils";
import { AttachmentsList } from "./AttachmentsList";
import { useAuth } from "../../contexts/AuthContext";
import { getShiftConfig } from "../../utils/shiftconfig";
import { formatLeaveDurationDisplay } from "../../utils/leaveCalculator";

interface LeaveRequestDetailProps {
  request: LeaveRequest;
  onClose: () => void;
  onUpdate: () => void;
}

export function LeaveRequestDetail({
  request,
  onClose,
  onUpdate,
}: LeaveRequestDetailProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { showToast, showModal } = useToast();
  const [loading, setLoading] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showVoidForm, setShowVoidForm] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [showCancellationForm, setShowCancellationForm] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");

  const validShiftType =
    request.shift_type === "day" || request.shift_type === "night"
      ? request.shift_type
      : "day";
  const shiftConfig = getShiftConfig(validShiftType);
  const halfDayPeriod = request.half_day_period
    ? shiftConfig.half_periods[request.half_day_period as "first" | "second"]
    : null;

  const handleApprove = async () => {
    const confirmed = await showModal("confirm", t("leave.approveRequest"), {
      message: t("leave.confirmApprove"),
      confirmText: t("leave.approve"),
      cancelText: t("common.cancel"),
    });

    if (!confirmed) return;

    setLoading(true);
    try {
      await updateLeaveRequestStatus(request.id, "approve");
      onUpdate();
      onClose();
    } catch (error: any) {
      showToast(error.message || t("leave.actionFailed"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      showToast(t("leave.pleaseProvideReason"), "warning");
      return;
    }

    const confirmed = await showModal("confirm", t("leave.rejectRequest"), {
      message: t("leave.confirmReject"),
      confirmText: t("leave.reject"),
      cancelText: t("common.cancel"),
    });

    if (!confirmed) return;

    setLoading(true);
    try {
      await updateLeaveRequestStatus(request.id, "reject", rejectionReason);
      onUpdate();
      onClose();
    } catch (error: any) {
      showToast(error.message || t("leave.actionFailed"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVoid = async () => {
    if (!voidReason.trim() || voidReason.trim().length < 5) {
      showToast(
        i18n.language === "th"
          ? "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร"
          : "Please provide a reason (minimum 5 characters)",
        "warning",
      );
      return;
    }

    const confirmMsg =
      i18n.language === "th"
        ? `ต้องการยกเลิกใบลานี้หรือไม่? จำนวน ${request.total_days} วัน จะถูกคืนกลับไปยังยอดลาคงเหลือ`
        : `Are you sure you want to void this leave request? ${request.total_days} day(s) will be restored to the balance.`;

    const confirmed = await showModal(
      "confirm",
      i18n.language === "th" ? "ยืนยันการยกเลิก" : "Void Confirmation",
      {
        message: confirmMsg,
        confirmText: i18n.language === "th" ? "ยกเลิกใบลา" : "Void Leave",
        cancelText: t("common.cancel"),
      },
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      const result = await voidLeaveRequest(request.id, voidReason);
      showToast(
        i18n.language === "th"
          ? `ยกเลิกใบลาสำเร็จ คืน ${result.balance_restored} วัน`
          : `Leave request voided. ${result.balance_restored} day(s) restored.`,
        "success",
      );
      onUpdate();
      onClose();
    } catch (error: any) {
      showToast(error.message || t("leave.actionFailed"), "error");
    } finally {
      setLoading(false);
    }
  };

  // Handle employee cancellation request
  const handleRequestCancellation = async () => {
    if (!cancellationReason.trim() || cancellationReason.trim().length < 5) {
      showToast(
        i18n.language === "th"
          ? "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร"
          : "Please provide a reason (minimum 5 characters)",
        "warning",
      );
      return;
    }

    const confirmMsg =
      i18n.language === "th"
        ? "ต้องการส่งคำขอยกเลิกใบลาหรือไม่? คำขอจะต้องได้รับการอนุมัติจาก HR"
        : "Submit cancellation request? This will require HR approval.";

    const confirmed = await showModal(
      "confirm",
      i18n.language === "th" ? "ยืนยันคำขอ" : "Request Confirmation",
      {
        message: confirmMsg,
        confirmText: t("common.confirm"),
        cancelText: t("common.cancel"),
      },
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      const result = await requestLeaveCancellation(
        request.id,
        cancellationReason,
      );
      showToast(
        result.requires_hr_approval
          ? i18n.language === "th"
            ? "ส่งคำขอยกเลิกแล้ว รอ HR อนุมัติ"
            : "Cancellation request submitted. Waiting for HR approval."
          : i18n.language === "th"
            ? "ยกเลิกคำขอลาเรียบร้อย"
            : "Leave request canceled.",
        "success",
      );
      onUpdate();
      onClose();
    } catch (error: any) {
      showToast(error.message || t("leave.actionFailed"), "error");
    } finally {
      setLoading(false);
    }
  };

  const canApprove = user && ["admin", "hr", "manager"].includes(user.role);
  const canVoid = user && ["admin", "hr"].includes(user.role);
  const isPending = request.status === "pending";

  // Check if current user is owner and can request cancellation
  const isOwner = user?.id === request.employee_id;
  const canRequestCancellation =
    isOwner &&
    request.status === "approved" &&
    (() => {
      // Check 24hrs in Thailand timezone
      const thaiOffset = 7 * 60 * 60 * 1000;
      const thaiNow = new Date(Date.now() + thaiOffset);
      const startDate = new Date(request.start_date);
      startDate.setHours(0, 0, 0, 0);
      const hoursUntilStart =
        (startDate.getTime() - thaiNow.getTime()) / (1000 * 60 * 60);
      return hoursUntilStart >= 24;
    })();

  const getApproverDisplayName = (role: "admin" | "manager" | "hr") => {
    const isThai = i18n.language === "th";

    const name =
      role === "admin"
        ? isThai
          ? request.admin_name_th
          : request.admin_name_en
        : role === "manager"
          ? isThai
            ? request.manager_name_th
            : request.manager_name_en
          : isThai
            ? request.hr_name_th
            : request.hr_name_en;

    const needsReview =
      role === "admin"
        ? request.admin_approver_needs_review
        : role === "manager"
          ? request.manager_approver_needs_review
          : request.hr_approver_needs_review;

    if (name) {
      return name;
    }

    if (needsReview) {
      return isThai
        ? "ต้องตรวจสอบข้อมูลผู้อนุมัติย้อนหลัง"
        : "Legacy approver needs review";
    }

    return "-";
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] md:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">
              {t("leave.requestDetail")}
            </h2>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                request.status === "approved"
                  ? "bg-green-100 text-green-800"
                  : request.status === "rejected"
                    ? "bg-red-100 text-red-800"
                    : request.status === "canceled"
                      ? "bg-gray-100 text-gray-800"
                      : request.status === "voided"
                        ? "bg-orange-100 text-orange-800"
                        : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {request.status === "voided"
                ? i18n.language === "th"
                  ? "ยกเลิกแล้ว (Voided)"
                  : "Voided"
                : t(`leave.${request.status}`)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Request Number */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="space-y-2 text-blue-900">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                <span className="font-medium">{t("leave.requestNumber")}:</span>
                <span className="font-mono">{request.request_number}</span>
              </div>
              <div className="text-sm">
                <span className="font-medium">
                  {i18n.language === "th" ? "สร้างเมื่อ:" : "Created:"}
                </span>{" "}
                {formatDateTime(request.created_at, i18n.language)}
              </div>
            </div>
          </div>

          {/* Employee Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("employee.name")}
              </label>
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-gray-400" />
                <span>
                  {i18n.language === "th"
                    ? request.employee_name_th
                    : request.employee_name_en}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("leave.leaveType")}
              </label>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800">
                {i18n.language === "th"
                  ? request.leave_type_name_th
                  : request.leave_type_name_en}
              </span>
            </div>
          </div>

          {/* Date & Time Info */}
          <div className="border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("leave.leavePeriod")}
                </label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span>
                    {formatDateRange(request.start_date, request.end_date)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("leave.totalDays")}
                </label>
                <span className="text-lg font-semibold text-blue-600">
                  {request.is_hourly_leave
                    ? (() => {
                        const finalMinutes = Math.round(
                          request.leave_minutes || 0,
                        );
                        const isExactHour = finalMinutes % 60 === 0;
                        const hours = Math.floor(finalMinutes / 60);
                        const minutes = isExactHour ? 0 : finalMinutes % 60;
                        const language = i18n.language as "th" | "en";
                        if (language === "th") {
                          return `${hours} ชม.${minutes > 0 ? ` ${minutes} นาที` : ""}`;
                        } else {
                          return `${hours} hour${hours !== 1 ? "s" : ""}${minutes > 0 ? ` ${minutes} minute${minutes !== 1 ? "s" : ""}` : ""}`;
                        }
                      })()
                    : formatLeaveDurationDisplay(
                        request,
                        i18n.language as "th" | "en",
                      )}
                </span>
              </div>
            </div>

            {/* Shift & Time */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("leave.shiftType")}
                </label>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800">
                  {request.shift_type === "day"
                    ? t("leave.dayShift")
                    : t("leave.nightShift")}
                </span>
              </div>

              {request.is_half_day && halfDayPeriod && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("leave.halfDayPeriod")}
                  </label>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-orange-100 text-orange-800">
                    {i18n.language === "th"
                      ? halfDayPeriod.name_th
                      : halfDayPeriod.name_en}
                  </span>
                </div>
              )}

              {request.start_time && request.end_time && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("leave.workingHours")}
                  </label>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <span>
                      {request.start_time?.substring(0, 5)} -{" "}
                      {request.end_time?.substring(0, 5)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ✅ Reason - แสดงช่องเดียวพร้อม Language Badge */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-medium text-gray-700">
                {t("leave.reason")}
              </label>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  request.reason_language === "th"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {request.reason_language === "th" ? "🇹🇭 TH" : "🇺🇸 EN"}
              </span>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-900 whitespace-pre-wrap">
                {request.reason}
              </p>
            </div>
          </div>

          {/* Attachments */}
          {request.attachment_urls && request.attachment_urls.length > 0 && (
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {t("leave.attachments")}
              </label>
              <AttachmentsList attachments={request.attachment_urls} />
            </div>
          )}

          {/* Approval History */}
          {(request.department_admin_approved_at ||
            request.department_manager_approved_at ||
            request.hr_approved_at) && (
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {t("leave.approvalHistory")}
              </label>
              <div className="space-y-3">
                {request.department_admin_approved_at && (
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <div className="font-medium text-gray-900">
                        {getApproverDisplayName("admin")}
                      </div>
                      <div className="text-sm text-gray-600">
                        {t("leave.departmentAdmin")} •{" "}
                        {new Date(
                          request.department_admin_approved_at,
                        ).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}

                {request.department_manager_approved_at && (
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <div className="font-medium text-gray-900">
                        {getApproverDisplayName("manager")}
                      </div>
                      <div className="text-sm text-gray-600">
                        {t("leave.departmentManager")} •{" "}
                        {new Date(
                          request.department_manager_approved_at,
                        ).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}

                {request.hr_approved_at && (
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <div className="font-medium text-gray-900">
                        {getApproverDisplayName("hr")}
                      </div>
                      <div className="text-sm text-gray-600">
                        {t("leave.hr")} •{" "}
                        {new Date(request.hr_approved_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Next Approver (for pending requests) */}
          {(request.status === "pending" ||
            request.status === "department_approved") &&
            (request.next_approver_name_th ||
              request.next_approver_name_en) && (
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  {t("approval.currentStage")}
                </label>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <div className="font-medium text-yellow-900 mb-1">
                        {t("approval.waitingForApproval")}
                      </div>
                      <p className="text-yellow-800">
                        {i18n.language === "th"
                          ? request.next_approver_name_th ||
                            request.next_approver_name_en
                          : request.next_approver_name_en ||
                            request.next_approver_name_th}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* Rejection Reason */}
          {request.status === "rejected" && request.rejection_reason_th && (
            <div className="border-t pt-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <div className="font-medium text-red-900 mb-1">
                      {t("leave.rejectionReason")}
                    </div>
                    <p className="text-red-700">
                      {i18n.language === "th"
                        ? request.rejection_reason_th
                        : request.rejection_reason_en ||
                          request.rejection_reason_th}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions for pending requests */}
        {canApprove && isPending && !showRejectForm && (
          <div className="border-t px-6 py-4 flex gap-3 justify-end bg-gray-50">
            <button
              onClick={() => setShowRejectForm(true)}
              className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50"
              disabled={loading}
            >
              {t("leave.reject")}
            </button>
            <button
              onClick={handleApprove}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
              disabled={loading}
            >
              {loading ? t("common.loading") : t("leave.approve")}
            </button>
          </div>
        )}

        {/* Employee Cancellation Request button (for owner of approved requests) */}
        {canRequestCancellation && !showCancellationForm && !showVoidForm && (
          <div className="border-t px-6 py-4 flex gap-3 justify-between bg-amber-50">
            <div className="text-sm text-amber-700">
              <XCircle className="w-4 h-4 inline mr-1" />
              {i18n.language === "th"
                ? "คุณสามารถขอยกเลิกใบลาได้ (ต้องได้รับการอนุมัติจาก HR)"
                : "You can request cancellation (requires HR approval)"}
            </div>
            <button
              onClick={() => setShowCancellationForm(true)}
              className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 flex items-center gap-2"
              disabled={loading}
            >
              <XCircle className="w-4 h-4" />
              {i18n.language === "th" ? "ขอยกเลิกใบลา" : "Request Cancellation"}
            </button>
          </div>
        )}

        {/* Employee Cancellation Form */}
        {showCancellationForm && (
          <div className="border-t px-6 py-4 bg-amber-50">
            <div className="mb-3">
              <div className="flex items-center gap-2 text-amber-800 font-medium mb-2">
                <XCircle className="w-5 h-5" />
                {i18n.language === "th"
                  ? "ขอยกเลิกใบลาที่อนุมัติแล้ว"
                  : "Request Cancellation of Approved Leave"}
              </div>
              <p className="text-sm text-amber-700">
                {i18n.language === "th"
                  ? "คำขอยกเลิกจะถูกส่งไปให้ HR พิจารณา หากอนุมัติ วันลาจะถูกคืนกลับ"
                  : "Your cancellation request will be sent to HR for review. If approved, leave days will be restored."}
              </p>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {i18n.language === "th"
                ? "เหตุผลในการขอยกเลิก"
                : "Cancellation Reason"}{" "}
              *
            </label>
            <textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 mb-3"
              placeholder={
                i18n.language === "th"
                  ? "เช่น ต้องการเปลี่ยนวันลา, มีเหตุด่วน..."
                  : "e.g., Need to change leave date, urgent matter..."
              }
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCancellationForm(false);
                  setCancellationReason("");
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleRequestCancellation}
                className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:bg-gray-400"
                disabled={loading || cancellationReason.trim().length < 5}
              >
                {loading
                  ? t("common.loading")
                  : i18n.language === "th"
                    ? "ส่งคำขอยกเลิก"
                    : "Submit Request"}
              </button>
            </div>
          </div>
        )}

        {/* Void button for approved requests (HR/Admin only) */}
        {canVoid &&
          request.status === "approved" &&
          !showVoidForm &&
          !showCancellationForm && (
            <div className="border-t px-6 py-4 flex gap-3 justify-between bg-orange-50">
              <div className="text-sm text-orange-700">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                {i18n.language === "th"
                  ? "HR/Admin สามารถยกเลิกใบลาที่อนุมัติแล้วได้ หากพนักงานไม่ได้ลาจริง"
                  : "HR/Admin can void approved leave if employee did not actually take leave"}
              </div>
              <button
                onClick={() => setShowVoidForm(true)}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 flex items-center gap-2"
                disabled={loading}
              >
                <Ban className="w-4 h-4" />
                {i18n.language === "th" ? "ยกเลิกใบลา (Void)" : "Void Leave"}
              </button>
            </div>
          )}

        {/* Void Form */}
        {showVoidForm && (
          <div className="border-t px-6 py-4 bg-orange-50">
            <div className="mb-3">
              <div className="flex items-center gap-2 text-orange-800 font-medium mb-2">
                <Ban className="w-5 h-5" />
                {i18n.language === "th"
                  ? "ยกเลิกใบลาที่อนุมัติแล้ว"
                  : "Void Approved Leave"}
              </div>
              <p className="text-sm text-orange-700">
                {i18n.language === "th"
                  ? `จำนวน ${request.total_days} วัน จะถูกคืนกลับไปยังยอดลาคงเหลือของพนักงาน`
                  : `${request.total_days} day(s) will be restored to the employee's leave balance`}
              </p>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {i18n.language === "th" ? "เหตุผลในการยกเลิก" : "Void Reason"} *
            </label>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 mb-3"
              placeholder={
                i18n.language === "th"
                  ? "เช่น พนักงานไม่ได้ลาจริง, ลงผิด..."
                  : "e.g., Employee did not take leave, wrong entry..."
              }
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowVoidForm(false);
                  setVoidReason("");
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleVoid}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-400"
                disabled={loading || voidReason.trim().length < 5}
              >
                {loading
                  ? t("common.loading")
                  : i18n.language === "th"
                    ? "ยืนยันยกเลิก"
                    : "Confirm Void"}
              </button>
            </div>
          </div>
        )}

        {/* Reject Form */}
        {showRejectForm && (
          <div className="border-t px-6 py-4 bg-red-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("leave.rejectionReason")} *
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 mb-3"
              placeholder={t("leave.enterReasonEn")}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectionReason("");
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400"
                disabled={loading || !rejectionReason.trim()}
              >
                {loading ? t("common.loading") : t("leave.reject")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

