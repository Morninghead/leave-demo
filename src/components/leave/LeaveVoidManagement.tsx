import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, Ban, CheckCircle, X, Calendar, User } from "lucide-react";
import { LeaveRequest } from "../../types/leave";
import { getLeaveRequests, voidLeaveRequest } from "../../api/leave";
import { formatDateShort, formatDateTime } from "../../utils/dateUtils";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../hooks/useToast";
import { formatLeaveDurationDisplay } from "../../utils/leaveCalculator";
import { AttachmentBadge } from "../common/AttachmentBadge";

export function LeaveVoidManagement() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { showToast, showModal } = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "approved" | "voided" | "all"
  >("approved");
  const [voidingRequest, setVoidingRequest] = useState<LeaveRequest | null>(
    null,
  );
  const [voidReason, setVoidReason] = useState("");
  const [voidLoading, setVoidLoading] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch ALL approved and voided requests using void management mode
      const allRequests = await getLeaveRequests({
        for_void_management: true,
        status: "all", // Get both approved and voided
      });

      setRequests(Array.isArray(allRequests) ? allRequests : []);
    } catch (error) {
      console.error("Failed to load requests:", error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleVoid = async () => {
    if (!voidingRequest) return;
    if (!voidReason.trim() || voidReason.trim().length < 5) {
      showToast(
        i18n.language === "th"
          ? "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร"
          : "Please provide a reason (min 5 characters)",
        "error",
      );
      return;
    }

    const confirmMsg =
      i18n.language === "th"
        ? "ต้องการยกเลิกใบลานี้หรือไม่? วันลาจะถูกคืนให้พนักงาน"
        : "Void this leave request? Leave days will be restored to employee.";

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

    setVoidLoading(true);
    try {
      await voidLeaveRequest(voidingRequest.id, voidReason);
      showToast(
        i18n.language === "th"
          ? "ยกเลิกใบลาสำเร็จ"
          : "Leave voided successfully",
        "success",
      );
      await loadRequests();
      setVoidingRequest(null);
      setVoidReason("");
    } catch (error: any) {
      showToast(error.message || "Failed to void request", "error");
    } finally {
      setVoidLoading(false);
    }
  };

  // Filter by search term and status
  const filteredRequests = useMemo(
    () =>
      requests.filter((req) => {
        // Status filter
        if (filterStatus !== "all" && req.status !== filterStatus) {
          return false;
        }

        // Search filter
        if (searchTerm) {
          const search = searchTerm.toLowerCase();
          return (
            req.request_number?.toLowerCase().includes(search) ||
            req.employee_code?.toLowerCase().includes(search) ||
            req.employee_name_th?.toLowerCase().includes(search) ||
            req.employee_name_en?.toLowerCase().includes(search) ||
            req.leave_type_name_th?.toLowerCase().includes(search) ||
            req.leave_type_name_en?.toLowerCase().includes(search) ||
            req.hr_name_th?.toLowerCase().includes(search) ||
            req.hr_name_en?.toLowerCase().includes(search) ||
            req.manager_name_th?.toLowerCase().includes(search) ||
            req.manager_name_en?.toLowerCase().includes(search) ||
            req.admin_name_th?.toLowerCase().includes(search) ||
            req.admin_name_en?.toLowerCase().includes(search)
          );
        }

        return true;
      }),
    [requests, filterStatus, searchTerm],
  );

  // ✅ FIXED: Move useMemo hooks BEFORE any early returns to prevent hooks violation
  const groupedRequests = useMemo(() => {
    const groups: Record<string, LeaveRequest[]> = {};
    filteredRequests.forEach((req) => {
      const deptName =
        i18n.language === "th"
          ? req.department_name_th || t("common.unknownDepartment")
          : req.department_name_en || t("common.unknownDepartment");

      const key = deptName || "Unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(req);
    });
    return groups;
  }, [filteredRequests, i18n.language, t]);

  const sortedGroupKeys = useMemo(() => {
    return Object.keys(groupedRequests).sort((a, b) => a.localeCompare(b));
  }, [groupedRequests]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800 border-green-200";
      case "voided":
        return "bg-orange-100 text-orange-800 border-orange-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "voided":
        return <Ban className="w-4 h-4 text-orange-600" />;
      default:
        return null;
    }
  };

  const getApproverDisplayName = (request: LeaveRequest) => {
    const isThai = i18n.language === "th";
    const hrName = isThai ? request.hr_name_th : request.hr_name_en;
    const managerName = isThai
      ? request.manager_name_th
      : request.manager_name_en;
    const adminName = isThai ? request.admin_name_th : request.admin_name_en;

    if (hrName) return hrName;
    if (managerName) return managerName;
    if (adminName) return adminName;

    if (
      request.hr_approver_needs_review ||
      request.manager_approver_needs_review ||
      request.admin_approver_needs_review
    ) {
      return isThai
        ? "ต้องตรวจสอบข้อมูลผู้อนุมัติย้อนหลัง"
        : "Legacy approver needs review";
    }

    return isThai ? "ไม่พบข้อมูลผู้อนุมัติ" : "Approver unavailable";
  };

  // Check if user can void (HR/Admin only)
  const canVoid = user && ["hr", "admin"].includes(user.role);
  const createdAtLabel = i18n.language === "th" ? "สร้างเมื่อ" : "Created";

  // ✅ Early returns AFTER all hooks are called
  if (!canVoid) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">{t("common.noPermission")}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Ban className="w-7 h-7 text-orange-600" />
            {i18n.language === "th"
              ? "ยกเลิกใบลาที่อนุมัติแล้ว"
              : "Void Approved Leaves"}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {i18n.language === "th"
              ? "ยกเลิกใบลาที่อนุมัติแล้ว วันลาจะถูกคืนให้พนักงาน"
              : "Void approved leave requests. Leave days will be restored to employees."}
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                i18n.language === "th"
                  ? "ค้นหาด้วยเลขที่คำขอ, รหัสพนักงาน, ชื่อ, ประเภทลา..."
                  : "Search by request number, employee code, name, leave type..."
              }
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus("approved")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === "approved"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {i18n.language === "th" ? "อนุมัติแล้ว" : "Approved"}
              <span className="ml-2 bg-green-200 text-green-800 px-2 py-0.5 rounded-full text-xs">
                {requests.filter((r) => r.status === "approved").length}
              </span>
            </button>
            <button
              onClick={() => setFilterStatus("voided")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === "voided"
                  ? "bg-orange-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {i18n.language === "th" ? "ยกเลิกแล้ว" : "Voided"}
              <span className="ml-2 bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full text-xs">
                {requests.filter((r) => r.status === "voided").length}
              </span>
            </button>
            <button
              onClick={() => setFilterStatus("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === "all"
                  ? "bg-gray-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {t("common.all")}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">
                  {i18n.language === "th"
                    ? "ใบลาที่อนุมัติแล้ว"
                    : "Approved Leaves"}
                </p>
                <p className="text-2xl font-bold text-green-900">
                  {requests.filter((r) => r.status === "approved").length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700">
                  {i18n.language === "th"
                    ? "ใบลาที่ยกเลิกแล้ว"
                    : "Voided Leaves"}
                </p>
                <p className="text-2xl font-bold text-orange-900">
                  {requests.filter((r) => r.status === "voided").length}
                </p>
              </div>
              <Ban className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-4 text-sm text-gray-600">
          {i18n.language === "th"
            ? `พบ ${filteredRequests.length} รายการ`
            : `Found ${filteredRequests.length} result(s)`}
        </div>

        {/* Requests List */}
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Ban className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">
              {i18n.language === "th" ? "ไม่พบใบลา" : "No leave requests found"}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {sortedGroupKeys.map((deptName) => {
              const deptRequests = groupedRequests[deptName];
              return (
                <div
                  key={deptName}
                  className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                >
                  <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-3 px-1 border-l-4 border-orange-500 pl-3">
                    {deptName}
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full border border-gray-200 font-normal">
                      {deptRequests.length}
                    </span>
                  </h3>

                  <div className="space-y-3">
                    {deptRequests.map((request) => (
                      <div
                        key={request.id}
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            {/* Employee Info */}
                            <div className="flex items-center gap-3 mb-2">
                              <User className="w-5 h-5 text-gray-400" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                    #{request.request_number}
                                  </span>
                                  <span className="font-semibold text-gray-900">
                                    {i18n.language === "th"
                                      ? request.employee_name_th
                                      : request.employee_name_en}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    ({request.employee_code})
                                  </span>
                                  <span
                                    className={`px-2 py-1 text-xs font-medium rounded-full border flex items-center gap-1 ${getStatusColor(
                                      request.status,
                                    )}`}
                                  >
                                    {getStatusIcon(request.status)}
                                    {request.status === "approved"
                                      ? i18n.language === "th"
                                        ? "อนุมัติแล้ว"
                                        : "Approved"
                                      : i18n.language === "th"
                                        ? "ยกเลิกแล้ว"
                                        : "Voided"}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 flex items-center gap-2 flex-wrap">
                                  <span>
                                    {i18n.language === "th"
                                      ? request.leave_type_name_th
                                      : request.leave_type_name_en}
                                  </span>
                                  {request.attachment_urls &&
                                    request.attachment_urls.length > 0 && (
                                      <AttachmentBadge
                                        count={request.attachment_urls.length}
                                        attachments={request.attachment_urls}
                                      />
                                    )}
                                </p>
                                <p className="text-sm text-gray-600 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <span className="font-mono text-blue-700">
                                    #{request.request_number}
                                  </span>
                                  <span>
                                    {createdAtLabel}:{" "}
                                    {formatDateTime(request.created_at, i18n.language)}
                                  </span>
                                </p>
                                <p className="text-sm text-gray-600 mt-1">
                                  <span className="font-medium">
                                    {i18n.language === "th"
                                      ? "ผู้อนุมัติ:"
                                      : "Approved by:"}
                                  </span>{" "}
                                  {getApproverDisplayName(request)}
                                </p>
                              </div>
                            </div>

                            {/* Date Info */}
                            <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                <span className="font-medium">
                                  {t("leave.startDate")}:
                                </span>
                                {formatDateShort(
                                  new Date(request.start_date),
                                  i18n.language,
                                )}
                              </div>
                              <div>
                                <span className="font-medium">
                                  {t("leave.endDate")}:
                                </span>{" "}
                                {formatDateShort(
                                  new Date(request.end_date),
                                  i18n.language,
                                )}
                              </div>
                              <div>
                                <span className="font-medium">
                                  {t("leave.totalDays")}:
                                </span>{" "}
                                {request.is_hourly_leave
                                  ? (() => {
                                      const finalMinutes = Math.round(
                                        request.leave_minutes || 0,
                                      );
                                      const hours = Math.floor(
                                        finalMinutes / 60,
                                      );
                                      const minutes = finalMinutes % 60;
                                      return i18n.language === "th"
                                        ? `${hours} ชม.${minutes > 0 ? ` ${minutes} นาที` : ""}`
                                        : `${hours} hr${hours !== 1 ? "s" : ""}${minutes > 0 ? ` ${minutes} min` : ""}`;
                                    })()
                                  : formatLeaveDurationDisplay(
                                      request,
                                      i18n.language as "th" | "en",
                                    )}
                              </div>
                            </div>

                            {/* Void Info (if voided) */}
                            {request.status === "voided" &&
                              (request as any).void_reason && (
                                <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm">
                                  <span className="font-medium text-orange-800">
                                    {i18n.language === "th"
                                      ? "เหตุผลยกเลิก:"
                                      : "Void Reason:"}
                                  </span>{" "}
                                  <span className="text-orange-700">
                                    {(request as any).void_reason}
                                  </span>
                                </div>
                              )}
                          </div>

                          {/* Void Button */}
                          {request.status === "approved" && (
                            <button
                              onClick={() => setVoidingRequest(request)}
                              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors whitespace-nowrap"
                            >
                              <Ban className="w-4 h-4" />
                              {i18n.language === "th" ? "ยกเลิก" : "Void"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Void Confirmation Modal */}
      {voidingRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-600 to-amber-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center gap-3 text-white">
                <Ban className="w-6 h-6" />
                <h2 className="text-xl font-semibold">
                  {i18n.language === "th" ? "ยกเลิกใบลา" : "Void Leave Request"}
                </h2>
              </div>
              <button
                onClick={() => {
                  setVoidingRequest(null);
                  setVoidReason("");
                }}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-xs font-mono text-gray-500 mb-1">
                  #{voidingRequest.request_number}
                </p>
                <p className="text-sm text-gray-600 mb-1">
                  {createdAtLabel}:{" "}
                  {formatDateTime(voidingRequest.created_at, i18n.language)}
                </p>
                <p className="font-medium text-gray-900 mb-1">
                  {i18n.language === "th"
                    ? voidingRequest.employee_name_th
                    : voidingRequest.employee_name_en}
                </p>
                <p className="text-sm text-gray-600">
                  {i18n.language === "th"
                    ? voidingRequest.leave_type_name_th
                    : voidingRequest.leave_type_name_en}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">
                    {i18n.language === "th" ? "ผู้อนุมัติ:" : "Approved by:"}
                  </span>{" "}
                  {getApproverDisplayName(voidingRequest)}
                </p>
                <p className="text-sm text-gray-600">
                  {formatDateShort(
                    new Date(voidingRequest.start_date),
                    i18n.language,
                  )}{" "}
                  -{" "}
                  {formatDateShort(
                    new Date(voidingRequest.end_date),
                    i18n.language,
                  )}
                </p>
              </div>

              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <strong>
                  {i18n.language === "th" ? "หมายเหตุ:" : "Note:"}
                </strong>{" "}
                {i18n.language === "th"
                  ? `วันลา ${voidingRequest.total_days} วัน จะถูกคืนให้พนักงาน`
                  : `${voidingRequest.total_days} leave day(s) will be restored to the employee`}
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                {i18n.language === "th" ? "เหตุผลในการยกเลิก" : "Void Reason"} *
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                placeholder={
                  i18n.language === "th"
                    ? "เช่น พนักงานมาทำงานจริง, ข้อมูลผิดพลาด..."
                    : "e.g., Employee came to work, data entry error..."
                }
              />
            </div>

            {/* Footer */}
            <div className="border-t px-6 py-4 flex gap-3 justify-end bg-gray-50 rounded-b-xl">
              <button
                onClick={() => {
                  setVoidingRequest(null);
                  setVoidReason("");
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleVoid}
                disabled={voidLoading || voidReason.trim().length < 5}
                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Ban className="w-4 h-4" />
                {voidLoading
                  ? i18n.language === "th"
                    ? "กำลังดำเนินการ..."
                    : "Processing..."
                  : i18n.language === "th"
                    ? "ยืนยันยกเลิก"
                    : "Confirm Void"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

