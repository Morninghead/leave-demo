// src/components/dashboard/StatusDetailModal.tsx
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ResponsiveModal } from "../../components/ui";
import {
  X,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Trash2,
  UserCheck,
  XOctagon,
} from "lucide-react";
import {
  getLeaveRequests,
  LeaveRequest,
  updateLeaveRequestStatus,
  requestLeaveCancellation,
} from "../../api/leave";
import { formatLeaveDuration } from "../../utils/leaveTimeFormatter";
import api from "../../api/auth";
import { AttachmentBadge } from "../common/AttachmentBadge";
import { useToast } from "../../hooks/useToast";
import { formatDateTime } from "../../utils/dateUtils";

interface StatusDetailModalProps {
  type: "leave" | "shift";
  status: "pending" | "approved" | "rejected";
  colorGradient: string;
  onClose: () => void;
}

interface ShiftSwapRequest {
  id: string;
  employee_id: string;
  employee_name?: string;
  work_date: string;
  off_date: string;
  status: string;
  reason?: string;
  created_at: string;
}

export function StatusDetailModal({
  type,
  status,
  colorGradient,
  onClose,
}: StatusDetailModalProps) {
  const { i18n } = useTranslation();
  const { showToast, showModal } = useToast();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [shiftRequests, setShiftRequests] = useState<ShiftSwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);
  const [showCancellationForm, setShowCancellationForm] = useState<
    string | null
  >(null);
  const [cancellationReason, setCancellationReason] = useState("");

  const isThaiLanguage = i18n.language === "th";

  // Get display texts based on type and status
  const getTitle = () => {
    const typeText =
      type === "leave"
        ? isThaiLanguage
          ? "คำขอลา"
          : "Leave Requests"
        : isThaiLanguage
          ? "คำขอสลับกะ"
          : "Shift Swap Requests";

    const statusText = {
      pending: isThaiLanguage ? "รออนุมัติ" : "Pending",
      approved: isThaiLanguage ? "อนุมัติ" : "Approved",
      rejected: isThaiLanguage ? "ไม่อนุมัติ" : "Rejected",
    }[status];

    return `${typeText} - ${statusText}`;
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      if (type === "leave") {
        const data = await getLeaveRequests({ status });
        setLeaveRequests(data);
      } else {
        // Fetch shift swap requests using dashboard-specific API
        const response = await api.get(
          `/shift-swap-dashboard?status=${status}`,
        );
        const requests = response.data.shift_swap_requests || [];
        // Map the response to our interface
        const mappedRequests = requests.map((req: any) => ({
          id: req.id,
          employee_id: req.employee_id,
          employee_name: req.employee_name_th || req.employee_name_en || "",
          work_date: req.work_date,
          off_date: req.off_date,
          status: req.status,
          reason: req.reason,
          created_at: req.created_at,
        }));
        setShiftRequests(mappedRequests);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }, [type, status]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle cancel leave request
  const handleCancel = async (requestId: string) => {
    const confirmMessage = isThaiLanguage
      ? "คุณต้องการยกเลิกคำขอลานี้หรือไม่?"
      : "Are you sure you want to cancel this leave request?";

    const confirmed = await showModal(
      "confirm",
      isThaiLanguage ? "ยืนยันการยกเลิก" : "Cancel Confirmation",
      {
        message: confirmMessage,
        confirmText: isThaiLanguage ? "ยกเลิกคำขอ" : "Cancel Request",
        cancelText: i18n.language === "th" ? "ยกเลิก" : "Back",
      },
    );

    if (!confirmed) return;

    setCancelLoading(requestId);
    try {
      await updateLeaveRequestStatus(requestId, "cancel");
      // Reload data after successful cancel
      await loadData();
    } catch (error: any) {
      console.error("Failed to cancel leave request:", error);
      showToast(
        error.message ||
          (isThaiLanguage
            ? "ไม่สามารถยกเลิกคำขอลาได้"
            : "Failed to cancel leave request"),
        "error",
      );
    } finally {
      setCancelLoading(null);
    }
  };

  // Handle approved leave cancellation request
  const handleRequestCancellation = async (requestId: string) => {
    if (!cancellationReason.trim() || cancellationReason.trim().length < 5) {
      showToast(
        isThaiLanguage
          ? "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร"
          : "Please provide a reason (minimum 5 characters)",
        "warning",
      );
      return;
    }

    const confirmMsg = isThaiLanguage
      ? "ต้องการส่งคำขอยกเลิกใบลาหรือไม่? คำขอจะต้องได้รับการอนุมัติจาก HR"
      : "Submit cancellation request? This will require HR approval.";

    const confirmed = await showModal(
      "confirm",
      isThaiLanguage ? "ยืนยันคำขอ" : "Request Confirmation",
      {
        message: confirmMsg,
        confirmText: isThaiLanguage ? "ส่งคำขอ" : "Submit Request",
        cancelText: i18n.language === "th" ? "ยกเลิก" : "Back",
      },
    );

    if (!confirmed) return;

    setCancelLoading(requestId);
    try {
      const result = await requestLeaveCancellation(
        requestId,
        cancellationReason,
      );
      showToast(
        result.requires_hr_approval
          ? isThaiLanguage
            ? "ส่งคำขอยกเลิกแล้ว รอ HR อนุมัติ"
            : "Cancellation request submitted. Waiting for HR approval."
          : isThaiLanguage
            ? "ยกเลิกคำขอลาเรียบร้อย"
            : "Leave request canceled.",
        "success",
      );
      setShowCancellationForm(null);
      setCancellationReason("");
      await loadData();
    } catch (error: any) {
      console.error("Failed to request cancellation:", error);
      showToast(
        error.message ||
          (isThaiLanguage
            ? "ไม่สามารถส่งคำขอยกเลิกได้"
            : "Failed to submit cancellation request"),
        "error",
      );
    } finally {
      setCancelLoading(null);
    }
  };

  // Check if can request cancellation (24hr Thailand TZ)
  const canRequestCancellation = (leave: LeaveRequest) => {
    if (status !== "approved") return false;
    const thaiOffset = 7 * 60 * 60 * 1000;
    const thaiNow = new Date(Date.now() + thaiOffset);
    const startDate = new Date(leave.start_date);
    startDate.setHours(0, 0, 0, 0);
    const hoursUntilStart =
      (startDate.getTime() - thaiNow.getTime()) / (1000 * 60 * 60);
    return hoursUntilStart >= 24;
  };

  const getLegacyApproverFallback = () =>
    isThaiLanguage
      ? "ต้องตรวจสอบข้อมูลผู้อนุมัติย้อนหลัง"
      : "Legacy approver needs review";

  const getNamedApprover = (
    leave: LeaveRequest,
    role: "admin" | "manager" | "hr",
  ) => {
    const name =
      role === "admin"
        ? isThaiLanguage
          ? leave.admin_name_th
          : leave.admin_name_en
        : role === "manager"
          ? isThaiLanguage
            ? leave.manager_name_th
            : leave.manager_name_en
          : isThaiLanguage
            ? leave.hr_name_th
            : leave.hr_name_en;

    const needsReview =
      role === "admin"
        ? leave.admin_approver_needs_review
        : role === "manager"
          ? leave.manager_approver_needs_review
          : leave.hr_approver_needs_review;

    if (name) {
      return name;
    }

    if (needsReview) {
      return getLegacyApproverFallback();
    }

    return null;
  };

  // Get approver display name for cards and fallback safely for legacy bad rows
  const getApproverDisplayName = (leave: LeaveRequest): string | null => {
    if (status === "pending") {
      // For pending requests, show the next approver name from backend
      // Backend uses COALESCE: Dept Admin → Dept Manager → HR
      const approverName = isThaiLanguage
        ? leave.next_approver_name_th
        : leave.next_approver_name_en;
      if (approverName) {
        return `${isThaiLanguage ? "รอ" : "Awaiting "}${approverName}${isThaiLanguage ? " อนุมัติ" : ""}`;
      }
      // Fallback only if backend somehow returns null (should not happen)
      return isThaiLanguage ? "รอผู้อนุมัติ" : "Awaiting Approver";
    } else if (status === "approved") {
      // For approved requests, show who approved
      const hrName = getNamedApprover(leave, "hr");
      const managerName = getNamedApprover(leave, "manager");
      const adminName = getNamedApprover(leave, "admin");

      if (hrName) {
        return `${isThaiLanguage ? "อนุมัติโดย" : "Approved by"} ${hrName}`;
      } else if (managerName) {
        return `${isThaiLanguage ? "อนุมัติโดย" : "Approved by"} ${managerName}`;
      } else if (adminName) {
        return `${isThaiLanguage ? "อนุมัติโดย" : "Approved by"} ${adminName}`;
      }
      return null;
    } else if (status === "rejected") {
      // For rejected requests, show who rejected (use similar logic)
      const hrName = getNamedApprover(leave, "hr");
      const managerName = getNamedApprover(leave, "manager");
      const adminName = getNamedApprover(leave, "admin");

      if (hrName) {
        return `${isThaiLanguage ? "ไม่อนุมัติโดย" : "Rejected by"} ${hrName}`;
      } else if (managerName) {
        return `${isThaiLanguage ? "ไม่อนุมัติโดย" : "Rejected by"} ${managerName}`;
      } else if (adminName) {
        return `${isThaiLanguage ? "ไม่อนุมัติโดย" : "Rejected by"} ${adminName}`;
      }
      return null;
    }
    return null;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isThaiLanguage ? "th-TH" : "en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusIcon = () => {
    switch (status) {
      case "approved":
        return <CheckCircle className="w-6 h-6" />;
      case "rejected":
        return <XCircle className="w-6 h-6" />;
      default:
        return <Clock className="w-6 h-6" />;
    }
  };

  const requests = type === "leave" ? leaveRequests : shiftRequests;

  return (
    <ResponsiveModal
      isOpen={true}
      onClose={onClose}
      hideCloseButton={true}
      title={getTitle()}
      className="max-w-3xl"
    >
      <div className="bg-white w-full h-full flex flex-col">
        {/* Header */}
        <div
          className={`bg-gradient-to-br ${colorGradient} p-6 text-white relative overflow-hidden shrink-0`}
        >
          {/* Decorative circle - behind everything */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

          {/* Close button - high z-index with larger touch target */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-3 bg-white/20 hover:bg-white/40 rounded-full transition-colors z-20 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="relative z-10 flex items-center gap-4 pr-12">
            {getStatusIcon()}
            <div>
              <h2 className="text-2xl font-bold">{getTitle()}</h2>
              <p className="text-sm opacity-80">
                {isThaiLanguage
                  ? `พบ ${requests.length} รายการ`
                  : `Found ${requests.length} item(s)`}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>{isThaiLanguage ? "ไม่พบรายการ" : "No items found"}</p>
            </div>
          ) : type === "leave" ? (
            // Leave Requests List
            <div className="space-y-3">
              {leaveRequests.map((leave) => {
                const approverInfo = getApproverDisplayName(leave);
                return (
                  <div
                    key={leave.id}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-4 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-bold text-gray-900">
                            {isThaiLanguage
                              ? leave.leave_type_name_th
                              : leave.leave_type_name_en}
                          </h3>
                          {leave.attachment_urls &&
                            leave.attachment_urls.length > 0 && (
                              <AttachmentBadge
                                count={leave.attachment_urls.length}
                                attachments={leave.attachment_urls}
                              />
                            )}
                        </div>

                        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <span className="font-mono text-blue-700">
                            #{leave.request_number}
                          </span>
                          <span className="text-gray-500">
                            {isThaiLanguage ? "สร้างเมื่อ" : "Created"}:{" "}
                            {formatDateTime(leave.created_at, i18n.language)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {formatDate(leave.start_date)} -{" "}
                            {formatDate(leave.end_date)}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                            {formatLeaveDuration(
                              leave.total_days,
                              leave.leave_minutes,
                              leave.is_hourly_leave || false,
                              isThaiLanguage ? "th" : "en",
                            )}
                          </span>
                        </div>

                        {/* Approver Info Badge */}
                        {approverInfo && (
                          <div className="flex items-center gap-2 mt-2 text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-lg w-fit">
                            <UserCheck className="w-4 h-4" />
                            <span>{approverInfo}</span>
                          </div>
                        )}

                        {leave.reason_th && (
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                            <span className="font-medium">
                              {isThaiLanguage ? "เหตุผล:" : "Reason:"}
                            </span>{" "}
                            {leave.reason_th}
                          </p>
                        )}
                      </div>

                      {/* Cancel Button for Pending Requests */}
                      {status === "pending" && (
                        <button
                          onClick={() => handleCancel(leave.id)}
                          disabled={cancelLoading === leave.id}
                          className="flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 text-sm"
                          title={isThaiLanguage ? "ยกเลิก" : "Cancel"}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="hidden sm:inline">
                            {cancelLoading === leave.id
                              ? isThaiLanguage
                                ? "กำลังยกเลิก..."
                                : "Canceling..."
                              : isThaiLanguage
                                ? "ยกเลิก"
                                : "Cancel"}
                          </span>
                        </button>
                      )}

                      {/* Request Cancellation Button for Approved Requests */}
                      {status === "approved" &&
                        canRequestCancellation(leave) &&
                        !showCancellationForm && (
                          <button
                            onClick={() => setShowCancellationForm(leave.id)}
                            className="flex items-center gap-1 px-3 py-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50 text-sm"
                            title={
                              isThaiLanguage
                                ? "ขอยกเลิก"
                                : "Request Cancellation"
                            }
                          >
                            <XOctagon className="w-4 h-4" />
                            <span className="hidden sm:inline">
                              {isThaiLanguage ? "ขอยกเลิก" : "Request Cancel"}
                            </span>
                          </button>
                        )}
                    </div>

                    {/* Cancellation Request Form */}
                    {showCancellationForm === leave.id && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {isThaiLanguage
                            ? "ระบุสาเหตุการยกเลิก"
                            : "Cancellation Reason"}{" "}
                          *
                        </label>
                        <textarea
                          value={cancellationReason}
                          onChange={(e) =>
                            setCancellationReason(e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 mb-2"
                          placeholder={
                            isThaiLanguage
                              ? "เช่น ต้องการเปลี่ยนวันลา, มีเหตุด่วน..."
                              : "e.g., Change date, urgent matter..."
                          }
                          rows={2}
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => {
                              setShowCancellationForm(null);
                              setCancellationReason("");
                            }}
                            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                          >
                            {isThaiLanguage ? "ยกเลิก" : "Cancel"}
                          </button>
                          <button
                            onClick={() => handleRequestCancellation(leave.id)}
                            disabled={
                              cancelLoading === leave.id ||
                              cancellationReason.trim().length < 5
                            }
                            className="px-3 py-1.5 text-sm bg-amber-600 text-white hover:bg-amber-700 rounded-lg disabled:opacity-50"
                          >
                            {cancelLoading === leave.id
                              ? isThaiLanguage
                                ? "กำลังส่ง..."
                                : "Sending..."
                              : isThaiLanguage
                                ? "ยืนยัน"
                                : "Confirm"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            // Shift Swap Requests List
            <div className="space-y-3">
              {shiftRequests.map((shift) => (
                <div
                  key={shift.id}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-4 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-gray-900">
                          {shift.employee_name ||
                            (isThaiLanguage ? "พนักงาน" : "Employee")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {isThaiLanguage ? "วันทำงาน" : "Work"}:{" "}
                          {formatDate(shift.work_date)} →{" "}
                          {isThaiLanguage ? "วันหยุด" : "Off"}:{" "}
                          {formatDate(shift.off_date)}
                        </span>
                      </div>

                      {shift.reason && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                          <span className="font-medium">
                            {isThaiLanguage ? "เหตุผล:" : "Reason:"}
                          </span>{" "}
                          {shift.reason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-800 text-white font-medium rounded-xl hover:bg-gray-900 transition-colors"
          >
            {isThaiLanguage ? "ปิด" : "Close"}
          </button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
