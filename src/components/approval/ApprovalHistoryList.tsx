import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  History,
  Check,
  X,
  Clock,
  Calendar,
  Building2,
  FileText,
  Filter,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";

interface ApprovalHistoryItem {
  id: string;
  request_number: string;
  employee_name_th: string;
  employee_name_en: string;
  employee_code: string;
  department_name_th: string;
  department_name_en: string;
  leave_type_name_th: string;
  leave_type_name_en: string;
  start_date: string;
  end_date: string;
  total_days: number;
  status: string;
  reason: string;
  created_at: string;
  department_manager_approved_by: string | null;
  department_manager_approved_at: string | null;
  manager_name_th: string | null;
  manager_name_en: string | null;
  manager_approver_needs_review?: boolean;
  hr_approved_by: string | null;
  hr_approved_at: string | null;
  hr_name_th: string | null;
  hr_name_en: string | null;
  hr_approver_needs_review?: boolean;
  rejection_reason?: string;
}

export function ApprovalHistoryList() {
  const { i18n } = useTranslation();

  const [history, setHistory] = useState<ApprovalHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "approved" | "rejected">("all");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const getApproverDisplayName = (
    item: ApprovalHistoryItem,
    role: "manager" | "hr",
  ) => {
    const isThai = i18n.language === "th";
    const name =
      role === "manager"
        ? isThai
          ? item.manager_name_th
          : item.manager_name_en
        : isThai
          ? item.hr_name_th
          : item.hr_name_en;
    const needsReview =
      role === "manager"
        ? item.manager_approver_needs_review
        : item.hr_approver_needs_review;

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

  const fetchApprovalHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/.netlify/functions/leave-requests?for_approval_history=true&status=${filter}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch approval history");
      }

      const data = await response.json();

      setHistory(data.leave_requests || []);
    } catch (err: unknown) {
      console.error("Error fetching approval history:", err);
      const message =
        err instanceof Error ? err.message : "Failed to load approval history";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchApprovalHistory();
  }, [fetchApprovalHistory]);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString(i18n.language === "th" ? "th-TH" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString(i18n.language === "th" ? "th-TH" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <Check className="w-3 h-3" />
            {i18n.language === "th" ? "อนุมัติแล้ว" : "Approved"}
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <X className="w-3 h-3" />
            {i18n.language === "th" ? "ไม่อนุมัติ" : "Rejected"}
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3" />
            {i18n.language === "th" ? "รออนุมัติ" : "Pending"}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600">
            {i18n.language === "th" ? "กำลังโหลด..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
        <p className="text-red-700">{error}</p>
        <button
          onClick={fetchApprovalHistory}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          {i18n.language === "th" ? "ลองใหม่" : "Retry"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <History className="w-6 h-6 text-purple-600" />
          <h2 className="text-xl font-semibold text-gray-900">
            {i18n.language === "th"
              ? "ประวัติการอนุมัติของฉัน"
              : "My Approval History"}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={filter}
              onChange={(e) =>
                setFilter(e.target.value as "all" | "approved" | "rejected")
              }
              className="appearance-none px-4 py-2 pr-10 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
            >
              <option value="all">
                {i18n.language === "th" ? "ทั้งหมด" : "All"}
              </option>
              <option value="approved">
                {i18n.language === "th" ? "อนุมัติแล้ว" : "Approved"}
              </option>
              <option value="rejected">
                {i18n.language === "th" ? "ไม่อนุมัติ" : "Rejected"}
              </option>
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          <button
            onClick={fetchApprovalHistory}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title={i18n.language === "th" ? "รีเฟรช" : "Refresh"}
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
          <p className="text-sm text-purple-600 font-medium">
            {i18n.language === "th" ? "ทั้งหมด" : "Total"}
          </p>
          <p className="text-2xl font-bold text-purple-700">{history.length}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <p className="text-sm text-green-600 font-medium">
            {i18n.language === "th" ? "อนุมัติ" : "Approved"}
          </p>
          <p className="text-2xl font-bold text-green-700">
            {history.filter((h) => h.status === "approved").length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
          <p className="text-sm text-red-600 font-medium">
            {i18n.language === "th" ? "ไม่อนุมัติ" : "Rejected"}
          </p>
          <p className="text-2xl font-bold text-red-700">
            {history.filter((h) => h.status === "rejected").length}
          </p>
        </div>
      </div>

      {/* History List */}
      {history.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <History className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">
            {i18n.language === "th"
              ? "ยังไม่มีประวัติการอนุมัติ"
              : "No approval history yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => {
            const isExpanded = expandedItems.has(item.id);
            const employeeName =
              i18n.language === "th"
                ? item.employee_name_th
                : item.employee_name_en;
            const deptName =
              i18n.language === "th"
                ? item.department_name_th
                : item.department_name_en;
            const leaveType =
              i18n.language === "th"
                ? item.leave_type_name_th
                : item.leave_type_name_en;

            return (
              <div
                key={item.id}
                className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden hover:border-purple-300 transition-colors"
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => toggleExpand(item.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-gray-500">
                          #{item.request_number}
                        </span>
                        <span className="text-xs text-gray-500">
                          {i18n.language === "th" ? "สร้างเมื่อ" : "Created"}:{" "}
                          {formatDateTime(item.created_at)}
                        </span>
                        {getStatusBadge(item.status)}
                      </div>

                      <h3 className="font-semibold text-gray-900 truncate">
                        {employeeName}
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {deptName}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          {leaveType}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(item.start_date)} -{" "}
                          {formatDate(item.end_date)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded text-sm font-medium ${
                          item.total_days <= 1
                            ? "bg-blue-100 text-blue-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {item.total_days}{" "}
                        {i18n.language === "th" ? "วัน" : "day(s)"}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase mb-1">
                          {i18n.language === "th" ? "เหตุผล" : "Reason"}
                        </p>
                        <p className="text-sm text-gray-900">
                          {item.reason || "-"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase mb-1">
                          {i18n.language === "th" ? "วันที่ขอ" : "Requested At"}
                        </p>
                        <p className="text-sm text-gray-900">
                          {formatDateTime(item.created_at)}
                        </p>
                      </div>

                      <div className="md:col-span-2">
                        <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                          {i18n.language === "th"
                            ? "ลำดับการอนุมัติ"
                            : "Approval Timeline"}
                        </p>
                        <div className="flex flex-col gap-2">
                          {item.department_manager_approved_by && (
                            <div className="flex items-center gap-2 text-sm">
                              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                                <Check className="w-3 h-3 text-green-600" />
                              </div>
                              <span className="text-gray-600">
                                {i18n.language === "th"
                                  ? "ผู้จัดการอนุมัติ:"
                                  : "Manager Approved:"}
                              </span>
                              <span className="font-medium text-gray-900">
                                {getApproverDisplayName(item, "manager")}
                              </span>
                              <span className="text-gray-500 text-xs">
                                (
                                {formatDateTime(
                                  item.department_manager_approved_at || "",
                                )}
                                )
                              </span>
                            </div>
                          )}

                          {item.hr_approved_by && (
                            <div className="flex items-center gap-2 text-sm">
                              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                                <Check className="w-3 h-3 text-green-600" />
                              </div>
                              <span className="text-gray-600">
                                {i18n.language === "th"
                                  ? "HR อนุมัติ:"
                                  : "HR Approved:"}
                              </span>
                              <span className="font-medium text-gray-900">
                                {getApproverDisplayName(item, "hr")}
                              </span>
                              <span className="text-gray-500 text-xs">
                                ({formatDateTime(item.hr_approved_at || "")})
                              </span>
                            </div>
                          )}

                          {item.status === "rejected" &&
                            item.rejection_reason && (
                              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-xs font-medium text-red-600 mb-1">
                                  {i18n.language === "th"
                                    ? "เหตุผลที่ไม่อนุมัติ"
                                    : "Rejection Reason"}
                                </p>
                                <p className="text-sm text-red-800">
                                  {item.rejection_reason}
                                </p>
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
