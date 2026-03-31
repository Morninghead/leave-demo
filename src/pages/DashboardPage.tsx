// src/pages/DashboardPage.tsx - Full Code with Vibrant Gradients + Color Blind Friendly + Device-Aware UI
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { useHaptic } from "../hooks/useHaptic";
import { useDevice } from "../contexts/DeviceContext";
import { getDashboardStats, DashboardStats } from "../api/dashboard";
import { getLeaveBalances, LeaveBalance } from "../api/leave";
import { getLeaveRequests, LeaveRequest } from "../api/leave";
import { useSettings } from "../hooks/useSettings";
import { LeaveBalanceDetailModal } from "../components/dashboard/LeaveBalanceDetailModal";
import { StatusDetailModal } from "../components/dashboard/StatusDetailModal";
import { AttachmentBadge } from "../components/common/AttachmentBadge";
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Activity,
  Zap,
  Infinity as InfinityIcon,
  Plus,
  RefreshCw,
} from "lucide-react";
import {
  formatLeaveBalance,
  calculateLeavePercentage,
  daysToMinutes,
  formatThaiLeaveBalanceFromMinutes,
} from "../utils/leaveTimeFormatter";

const getDisplayName = (
  firstNameTh: string | null | undefined,
  lastNameTh: string | null | undefined,
  firstNameEn: string | null | undefined,
  lastNameEn: string | null | undefined,
  language: string
): string => {
  const fth = firstNameTh?.trim();
  const lth = lastNameTh?.trim();
  const fen = firstNameEn?.trim();
  const len = lastNameEn?.trim();

  if (language === 'th') {
    if (fth && lth) return `${fth} ${lth}`;
    if (fth) return fth;
    if (fen && len) return `${fen} ${len}`;
    if (fen) return fen;
    return 'ผู้ใช้งาน';
  } else {
    if (fen && len) return `${fen} ${len}`;
    if (fen) return fen;
    if (fth && lth) return `${fth} ${lth}`;
    if (fth) return fth;
    return 'User';
  }
};

const formatDateShort = (date: Date, language: string): string => {
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  };
  return new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-US', options).format(date);
};

const formatDays = (days: number | string, leaveTypeNameTh: string, leaveTypeNameEn: string, language: string): string => {
  const numDays = typeof days === 'string' ? parseFloat(days) : days;

  if (isNaN(numDays)) return '0';

  const typeName = language === 'th' ? leaveTypeNameTh : leaveTypeNameEn;
  const lowerTypeName = typeName.toLowerCase();

  const allowDecimal =
    lowerTypeName.includes('พักร้อน') ||
    lowerTypeName.includes('annual') ||
    lowerTypeName.includes('vacation') ||
    lowerTypeName.includes('ป่วย') ||
    lowerTypeName.includes('sick') ||
    lowerTypeName.includes('กิจ') ||
    lowerTypeName.includes('personal') ||
    lowerTypeName.includes('business');

  if (allowDecimal) {
    // แก้ไขปัญหา floating point precision และแสดงผลเป็นทศนิยม 1 ตำแหน่งเสมอ
    const roundedDays = Math.round(numDays * 2) / 2; // ปัดเป็นทศนิยม 0.5 เสมอ (30 นาที)
    return roundedDays % 1 === 0 ? roundedDays.toString() : roundedDays.toFixed(1);
  } else {
    return Math.floor(numDays).toString();
  }
};

import { PullToRefresh } from "../components/ui/PullToRefresh";
import { SkeletonDashboard } from "../components/ui/Skeleton";

export function DashboardPage() {
  const CONDITIONAL_BALANCE_CODES = new Set(['WORK_INJURY']);
  const { t, i18n } = useTranslation();
  const haptic = useHaptic();
  const { user } = useAuth();
  const { isMobile, isTablet } = useDevice();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    leave_stats: { total: 0, pending: 0, approved: 0, rejected: 0, canceled: 0 }
  } as DashboardStats);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [recentLeaves, setRecentLeaves] = useState<LeaveRequest[]>([]);

  // Modals
  const [selectedBalance, setSelectedBalance] = useState<{ balance: LeaveBalance, gradient: string } | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<{ type: 'leave', status: 'pending' | 'approved' | 'rejected', gradient: string } | null>(null);

  const displayName = getDisplayName(
    user?.first_name_th,
    user?.last_name_th,
    user?.first_name_en,
    user?.last_name_en,
    i18n.language
  );

  const loadDashboardData = async (force: boolean = false) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);

      const [statsData, balancesData, leavesData] = await Promise.all([
        getDashboardStats().catch(() => ({ leave_stats: { total: 0, pending: 0, approved: 0, rejected: 0, canceled: 0 } } as any)),
        getLeaveBalances().catch(() => ({ balances: [] })),
        getLeaveRequests().catch(() => [])
      ]);

      setStats(statsData as DashboardStats);
      setBalances(balancesData.balances || []);
      setRecentLeaves(leavesData || []);

    } catch (error) {
      console.error("Failed to load dashboard data", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const { settings } = useSettings();

  const filteredBalances = useMemo(() => {
    return balances.filter(b => {
      const code = (b.leave_type_code || '').toUpperCase();
      if (CONDITIONAL_BALANCE_CODES.has(code)) {
        const usedDays = Number(b.used_days || 0);
        const pendingDays = Number(b.pending_days || 0);
        if (usedDays <= 0 && pendingDays <= 0) return false;
      }
      const nameEn = (b.leave_type_name_en || '').toLowerCase();
      const nameTh = (b.leave_type_name_th || '');

      const isVacation = code === 'VL' || code === 'VAC' || code === 'ANNUAL' ||
        (b as any).is_annual_leave === true || String((b as any).is_annual_leave) === 'true'
        || nameEn.includes('vacation') || nameEn.includes('annual') || nameEn.includes('พักร้อน')
        || nameTh.includes('พักร้อน') || nameTh.includes('vacation') || nameTh.includes('annual');

      if (isVacation) {
        if (!user?.hire_date) {
          return false;
        }

        const hireDateStr = String(user.hire_date);
        let hireDate = new Date(hireDateStr);

        // Safety parse
        if (isNaN(hireDate.getTime())) {
          const parts = hireDateStr.split(/[-/]/);
          if (parts.length === 3) {
            if (parts[0].length === 4) hireDate = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
            else if (parts[2].length === 4) hireDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          }
        }

        const today = new Date();

        if (!settings) {
          return false;
        }

        const isTenureRequired = settings.require_1_year_tenure_for_vacation === true ||
          String(settings.require_1_year_tenure_for_vacation) === 'true';

        if (isTenureRequired) {
          let yearsDiff = today.getFullYear() - hireDate.getFullYear();
          if (
            today.getMonth() < hireDate.getMonth() ||
            (today.getMonth() === hireDate.getMonth() && today.getDate() < hireDate.getDate())
          ) {
            yearsDiff--;
          }
          return yearsDiff >= 1;
        } else {
          const diffTime = Math.abs(today.getTime() - hireDate.getTime());
          const daysDiff = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          return daysDiff >= 119;
        }
      }

      return true;
    });
  }, [balances, settings, user]);

  // Layout Helpers
  const getContainerSpacing = () => isMobile ? '' : 'py-8';
  const getWelcomeGridClass = () => isMobile ? 'grid grid-cols-1 gap-4 mb-6' : 'grid grid-cols-3 gap-6 mb-8';
  const getStatsGridClass = () => isMobile ? 'grid grid-cols-2 gap-3 mb-6' : isTablet ? 'grid grid-cols-3 gap-4 mb-8' : 'grid grid-cols-3 gap-6 mb-8';
  const getHeadingSize = () => isMobile ? 'text-lg' : 'text-xl';
  const getBalanceGridClass = () => isMobile ? 'grid grid-cols-1 gap-3 mb-8' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12';
  const getHistoryGridClass = () => isMobile ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-2 gap-4';

  const formatBalanceForDisplay = (balance: LeaveBalance, index: number) => {
    const formatted = formatLeaveBalance(
      Number(balance.total_days),
      Number(balance.used_days),
      Number(balance.available_days || balance.remaining_days),
      balance.allow_hourly_leave,
      undefined, // total_minutes
      balance.used_minutes,
      480,
      i18n.language as 'th' | 'en'
    );

    // Colors
    const gradients = [
      { gradient: 'from-blue-500 via-blue-600 to-indigo-700', shadow: 'shadow-blue-500/30' },
      { gradient: 'from-emerald-400 via-emerald-500 to-green-600', shadow: 'shadow-emerald-500/30' },
      { gradient: 'from-amber-400 via-amber-500 to-orange-600', shadow: 'shadow-amber-500/30' },
      { gradient: 'from-rose-400 via-rose-500 to-pink-600', shadow: 'shadow-rose-500/30' },
      { gradient: 'from-purple-500 via-purple-600 to-indigo-600', shadow: 'shadow-purple-500/30' },
      { gradient: 'from-cyan-400 via-cyan-500 to-blue-600', shadow: 'shadow-cyan-500/30' },
    ];
    const colorSet = gradients[index % gradients.length];

    const percentage = calculateLeavePercentage(Number(balance.used_days), Number(balance.total_days), balance.total_days === 0);

    return { colorSet, formattedBalance: formatted, percentage };
  };

  return (
    <PullToRefresh onRefresh={() => loadDashboardData(true)}>
      <div className={`min-h-screen bg-gray-50 ${getContainerSpacing()}`}>


        {loading && !refreshing ? (
          <div className={`p-4 ${getContainerSpacing()}`}>
            <SkeletonDashboard />
          </div>
        ) : (

          <div className={`${isMobile ? 'px-4 pb-20' : isTablet ? 'px-6' : 'px-6'} ${getContainerSpacing()}`}>
            {/* Page Header with Refresh Button */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <Activity className="w-8 h-8 text-blue-600" />
                <h1 className="text-3xl font-bold text-gray-900">{t("dashboard.title")}</h1>
              </div>
              <button
                onClick={() => {
                  haptic.trigger('light');
                  loadDashboardData(true);
                }}
                disabled={refreshing || loading}
                className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${refreshing || loading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? t("common.refreshing", "Refreshing...") : t("common.refresh", "Refresh")}
              </button>
            </div>

            {/* Top Row - Welcome + Quick Stats */}
            <div className={getWelcomeGridClass()}>
              {/* Welcome Card - With Profile Picture */}
              <div className={`${isMobile ? 'lg:col-span-1' : 'lg:col-span-2'} bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 ${isMobile ? 'rounded-2xl p-6' : 'rounded-3xl p-8'} text-white relative overflow-hidden shadow-xl ${isMobile ? 'min-h-[140px]' : 'min-h-[180px]'}`}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-400/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>

                <div className="relative z-10 flex items-center gap-5 h-full">
                  {/* Profile Picture */}
                  <div className={`flex-shrink-0 ${isMobile ? 'w-16 h-16' : 'w-20 h-20'} rounded-full bg-white/20 border-4 border-white/40 overflow-hidden shadow-lg`}>
                    {user?.profile_image_url ? (
                      <img
                        src={user.profile_image_url}
                        alt={displayName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Hide image on error and show initials instead
                          (e.target as HTMLImageElement).style.display = 'none';
                          const parent = (e.target as HTMLImageElement).parentElement;
                          if (parent) {
                            // Safe DOM manipulation - prevents XSS from user-derived content
                            parent.textContent = '';
                            const initialsDiv = document.createElement('div');
                            initialsDiv.className = `w-full h-full flex items-center justify-center text-white font-bold ${isMobile ? 'text-xl' : 'text-2xl'}`;
                            initialsDiv.textContent = displayName.charAt(0).toUpperCase();
                            parent.appendChild(initialsDiv);
                          }
                        }}
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center text-white font-bold ${isMobile ? 'text-xl' : 'text-2xl'} bg-gradient-to-br from-indigo-400 to-purple-600`}>
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Welcome Text */}
                  <div className="flex flex-col justify-center">
                    <p className={`${isMobile ? 'text-lg' : 'text-xl'} text-white/95 mb-1`}>
                      {t("common.welcome")}, <span className="font-semibold">{displayName}</span>
                    </p>
                    <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-white/80`}>
                      {new Date().toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-US', {
                        weekday: isMobile ? 'short' : 'long',
                        day: 'numeric',
                        month: isMobile ? 'short' : 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Total Summary Card - NO GRADIENT */}
              <div className={`bg-white ${isMobile ? 'rounded-2xl p-4' : 'rounded-3xl p-6'} shadow-lg border-2 border-gray-200 ${isMobile ? 'min-h-[140px]' : 'min-h-[180px]'} flex flex-col justify-between`}>
                <div className="flex items-center justify-between mb-4">
                  <Zap className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} text-orange-600`} />
                  <span className={`${isMobile ? 'text-xs' : 'text-xs'} font-semibold text-gray-500 uppercase tracking-wide`}>
                    {i18n.language === "th" ? "สรุป" : "Summary"}
                  </span>
                </div>
                <div className="space-y-2 flex-grow flex flex-col justify-center">
                  <div className="flex justify-between items-center">
                    <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600`}>{i18n.language === "th" ? "คำขอทั้งหมด" : "Total Requests"}</span>
                    <span className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900`}>
                      {stats.leave_stats.pending + stats.leave_stats.approved + stats.leave_stats.rejected}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {/* Stats Grid - Vibrant Gradients - CLICKABLE */}

            <div className={getStatsGridClass()}>
              {/* Leave Stats */}
              <div
                onClick={() => {
                  haptic.trigger('light');
                  setSelectedStatus({ type: 'leave', status: 'pending', gradient: 'from-amber-400 via-orange-500 to-orange-600' });
                }}
                className={`bg-gradient-to-br from-amber-400 via-orange-500 to-orange-600 rounded-2xl ${isMobile ? 'p-6' : 'p-8'} text-white shadow-lg hover:shadow-2xl hover:scale-105 transition-all relative overflow-hidden ${isMobile ? 'min-h-[120px]' : 'min-h-[180px]'} cursor-pointer group`}
                role="button"
                tabIndex={0}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
                <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
                  <Clock className="w-32 h-32" />
                </div>

                <div className="relative z-10 flex flex-col justify-center h-full">
                  <div className="flex items-center gap-3 mb-2 opacity-90">
                    <Clock className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'}`} />
                    <p className={`${isMobile ? 'text-sm' : 'text-lg'} font-medium`}>
                      {i18n.language === "th" ? "ลา - รออนุมัติ" : "Leave - Pending"}
                    </p>
                  </div>
                  <p className={`${isMobile ? 'text-4xl' : 'text-5xl'} font-bold tracking-tight`}>{stats.leave_stats.pending}</p>
                  <div className="mt-2 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 w-fit px-2 py-1 rounded">
                    {i18n.language === "th" ? "คลิกเพื่อดูรายละเอียด" : "Click for details"}
                  </div>
                </div>
              </div>

              <div
                onClick={() => {
                  haptic.trigger('light');
                  setSelectedStatus({ type: 'leave', status: 'approved', gradient: 'from-blue-500 via-blue-600 to-indigo-700' });
                }}
                className={`bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 rounded-2xl ${isMobile ? 'p-6' : 'p-8'} text-white shadow-lg hover:shadow-2xl hover:scale-105 transition-all relative overflow-hidden ${isMobile ? 'min-h-[120px]' : 'min-h-[180px]'} cursor-pointer group`}
                role="button"
                tabIndex={0}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
                <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
                  <CheckCircle className="w-32 h-32" />
                </div>

                <div className="relative z-10 flex flex-col justify-center h-full">
                  <div className="flex items-center gap-3 mb-2 opacity-90">
                    <CheckCircle className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'}`} />
                    <p className={`${isMobile ? 'text-sm' : 'text-lg'} font-medium`}>
                      {i18n.language === "th" ? "ลา - อนุมัติ" : "Leave - Approved"}
                    </p>
                  </div>
                  <p className={`${isMobile ? 'text-4xl' : 'text-5xl'} font-bold tracking-tight`}>{stats.leave_stats.approved}</p>
                  <div className="mt-2 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 w-fit px-2 py-1 rounded">
                    {i18n.language === "th" ? "คลิกเพื่อดูรายละเอียด" : "Click for details"}
                  </div>
                </div>
              </div>

              <div
                onClick={() => {
                  haptic.trigger('light');
                  setSelectedStatus({ type: 'leave', status: 'rejected', gradient: 'from-red-500 via-rose-600 to-pink-700' });
                }}
                className={`bg-gradient-to-br from-red-500 via-rose-600 to-pink-700 rounded-2xl ${isMobile ? 'p-6' : 'p-8'} text-white shadow-lg hover:shadow-2xl hover:scale-105 transition-all relative overflow-hidden ${isMobile ? 'min-h-[120px]' : 'min-h-[180px]'} cursor-pointer group`}
                role="button"
                tabIndex={0}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
                <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
                  <XCircle className="w-32 h-32" />
                </div>

                <div className="relative z-10 flex flex-col justify-center h-full">
                  <div className="flex items-center gap-3 mb-2 opacity-90">
                    <XCircle className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'}`} />
                    <p className={`${isMobile ? 'text-sm' : 'text-lg'} font-medium`}>
                      {i18n.language === "th" ? "ลา - ไม่อนุมัติ" : "Leave - Rejected"}
                    </p>
                  </div>
                  <p className={`${isMobile ? 'text-4xl' : 'text-5xl'} font-bold tracking-tight`}>{stats.leave_stats.rejected}</p>
                  <div className="mt-2 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 w-fit px-2 py-1 rounded">
                    {i18n.language === "th" ? "คลิกเพื่อดูรายละเอียด" : "Click for details"}
                  </div>
                </div>
              </div>

              {/* Leave Balance - Colorful Gradients */}
              <div className="col-span-full">
                <h2 className={`${getHeadingSize()} font-bold text-gray-900 mb-4 flex items-center gap-2`}>
                  <TrendingUp className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-blue-600`} />
                  {t("leave.balance")}
                </h2>
                <div className={getBalanceGridClass()}>
                  {filteredBalances.length === 0 ? (
                    <p className="text-gray-500 py-8 col-span-full">{t("common.noData")}</p>
                  ) : (
                    filteredBalances.map((balance, index) => {
                      const {
                        colorSet,
                        formattedBalance,
                        percentage
                      } = formatBalanceForDisplay(balance, index);

                      return (
                        <div
                          key={balance.id}
                          onClick={() => {
                            haptic.trigger('light');
                            setSelectedBalance({ balance, gradient: colorSet.gradient });
                          }}
                          className={`bg-gradient-to-br ${colorSet.gradient} ${colorSet.shadow} rounded-2xl ${isMobile ? 'p-4' : 'p-5'} text-white shadow-lg hover:shadow-2xl hover:scale-105 transition-all relative overflow-hidden cursor-pointer group`}
                          role="button"
                          tabIndex={0}
                          onKeyPress={(e) => e.key === 'Enter' && setSelectedBalance({ balance, gradient: colorSet.gradient })}
                        >
                          {/* Click indicator */}
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs bg-white/30 px-2 py-1 rounded-full">
                              {i18n.language === 'th' ? 'คลิกดูรายละเอียด' : 'Click for details'}
                            </span>
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
                          <div className="relative z-10 flex flex-col h-full ${isMobile ? 'min-h-[140px]' : 'min-h-[180px]'}">
                            {/* Leave Type Name */}
                            <h3 className={`font-bold ${isMobile ? 'text-sm' : 'text-base'} mb-3 line-clamp-2 opacity-95 leading-tight`}>
                              {i18n.language === "th"
                                ? balance.leave_type_name_th
                                : balance.leave_type_name_en}
                            </h3>

                            {/* Main Display */}
                            {Number(balance.total_days) === 0 ? (
                              // No Entitlement Case
                              <div className="mb-4">
                                <div className="text-sm opacity-90 mb-2">
                                  {i18n.language === "th" ? "สถานะ" : "Status"}
                                </div>
                                <div className="text-xl font-bold leading-tight flex items-center gap-2">
                                  <AlertCircle className="w-6 h-6" />
                                  <span className="whitespace-nowrap">{i18n.language === "th" ? "ไม่มีสิทธิ์วันลา" : "No Entitlement"}</span>
                                </div>
                                <div className="text-xs opacity-75 mt-1">
                                  {i18n.language === "th" ? "ไม่พบวันลาคงเหลือ" : "0 balance allocated"}
                                </div>
                              </div>
                            ) : formattedBalance.isUnlimited ? (
                              // Unlimited Leave Type
                              <div className="mb-4">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                  {balance.is_unpaid_leave === true ||
                                    balance.leave_type_code === 'UNPAID' ||
                                    balance.leave_type_name_en?.toLowerCase().includes('unpaid') ||
                                    balance.leave_type_name_th?.includes('ไม่รับค่าจ้าง') ? (
                                    // Unpaid Leave - Show text instead of infinity icon
                                    <span className="text-2xl font-bold text-center">
                                      {i18n.language === "th" ? "ไม่รับค่าจ้าง" : "Unpaid"}
                                    </span>
                                  ) : (
                                    // Other Unlimited Leave - Show infinity icon
                                    <InfinityIcon className="w-12 h-12" />
                                  )}
                                </div>
                                <div className="text-sm opacity-90 text-center">
                                  {i18n.language === "th" ? "ใช้ไปแล้ว" : "Used"}: <span className="font-bold">{formattedBalance.used}</span>
                                </div>
                              </div>
                            ) : (
                              // Limited Leave Type
                              <div>
                                <div className="mb-4">
                                  {balance.allow_hourly_leave ? (
                                    // Hourly Leave - Show Thai time format (.5 day + hours)
                                    <div className="space-y-1">
                                      <div className="text-sm opacity-90 mb-2">
                                        {i18n.language === "th" ? "คงเหลือ (พร้อมใช้)" : "Available (Ready to Use)"}
                                      </div>
                                      <div className="text-3xl font-bold leading-tight">
                                        {(() => {
                                          // Use remaining_minutes if available, otherwise calculate from available_days or remaining_days
                                          const minutes = balance.remaining_minutes !== undefined && balance.remaining_minutes >= 0
                                            ? balance.remaining_minutes
                                            : (parseFloat(balance.available_days?.toString() || balance.remaining_days?.toString() || '0') * 480);

                                          return formatThaiLeaveBalanceFromMinutes(minutes, 480, i18n.language as 'th' | 'en');
                                        })()}
                                      </div>
                                      <div className="text-xs opacity-75 mt-1">
                                        {i18n.language === "th" ? "จากทั้งหมด " : "From total "} {formattedBalance.total}
                                      </div>
                                    </div>
                                  ) : balance.allow_hourly_leave ? (
                                    // Fallback for hourly leave without halfDayFormat
                                    <div className="space-y-1">
                                      <div className="text-sm opacity-90 mb-2">
                                        {i18n.language === "th" ? "คงเหลือ (พร้อมใช้)" : "Available (Ready to Use)"}
                                      </div>
                                      <div className="text-4xl font-bold leading-tight">
                                        {formattedBalance.remaining}
                                      </div>
                                      <div className="text-xs opacity-75 mt-1">
                                        {i18n.language === "th" ? "จากทั้งหมด " : "From total "} {formattedBalance.total}
                                      </div>
                                    </div>
                                  ) : (
                                    // Regular Day-based Leave - Show days only
                                    <div className="space-y-1">
                                      <div className="text-sm opacity-90 mb-2">
                                        {i18n.language === "th" ? "คงเหลือ" : "Remaining"}
                                      </div>
                                      <div className="text-4xl font-bold leading-tight">
                                        {balance.available_days || (balance.display_days !== undefined ? balance.display_days : balance.remaining_days)} {i18n.language === "th" ? "วัน" : "days"}
                                      </div>
                                      <div className="text-xs opacity-75 mt-1">
                                        {i18n.language === "th" ? "จากทั้งหมด " : "From total "} {balance.total_days} {i18n.language === "th" ? "วัน" : "days"}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full bg-white/20 rounded-full h-2.5 mb-2 backdrop-blur-sm">
                                  <div
                                    className="bg-white h-2.5 rounded-full transition-all duration-500 shadow-lg"
                                    style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
                                  ></div>
                                </div>

                                {/* Used Display */}
                                <div className="flex justify-between text-xs opacity-90">
                                  <span>{t("leave.used")}</span>
                                  <span className="font-semibold">
                                    {balance.allow_hourly_leave && balance.used_minutes !== undefined
                                      ? formatThaiLeaveBalanceFromMinutes(
                                        balance.used_minutes,
                                        480,
                                        i18n.language as 'th' | 'en'
                                      )
                                      : `${balance.used_days} ${i18n.language === "th" ? "วัน" : "days"}`}
                                  </span>
                                </div>
                              </div>
                            )
                            }
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Recent History */}
              <div className={`col-span-full bg-white ${isMobile ? 'rounded-2xl' : 'rounded-3xl'} ${isMobile ? 'p-4' : 'p-6'} shadow-lg border-2 border-gray-200`}>
                <h2 className={`${getHeadingSize()} font-bold text-gray-900 mb-6 flex items-center gap-2`}>
                  <Calendar className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-blue-600`} />
                  {t("leave.history")}
                </h2>

                {recentLeaves.length === 0 ? (
                  <div className={`text-center ${isMobile ? 'py-8' : 'py-12'} text-gray-500`}>
                    <Calendar className={`${isMobile ? 'h-10 w-10' : 'h-12 w-12'} mx-auto mb-3 text-gray-300`} />
                    <p>{t("leave.noHistory")}</p>
                  </div>
                ) : (
                  <div className={getHistoryGridClass()}>
                    {recentLeaves.slice(0, isMobile ? 4 : 6).map((leave) => (
                      <div
                        key={leave.id}
                        className={`group relative bg-gradient-to-br from-gray-50 to-white border-2 border-gray-300 rounded-2xl ${isMobile ? 'p-4' : 'p-5'} hover:border-blue-500 hover:shadow-xl transition-all`}
                      >
                        {/* Status Badge */}
                        <div className="absolute top-4 right-4">
                          <span
                            className={`inline-flex items-center justify-center ${isMobile ? 'w-8 h-8' : 'w-10 h-10'} rounded-full border-2 shadow-lg ${leave.status === "approved"
                              ? "bg-gradient-to-br from-blue-400 to-blue-600 text-white border-blue-700"
                              : leave.status === "rejected"
                                ? "bg-gradient-to-br from-red-400 to-red-600 text-white border-red-700"
                                : leave.status === "canceled"
                                  ? "bg-gradient-to-br from-gray-400 to-gray-600 text-white border-gray-700"
                                  : "bg-gradient-to-br from-orange-400 to-orange-600 text-white border-orange-700"
                              }`}
                          >
                            {leave.status === "approved" ? (
                              <CheckCircle className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                            ) : leave.status === "rejected" ? (
                              <XCircle className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                            ) : leave.status === "canceled" ? (
                              <AlertCircle className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                            ) : (
                              <Clock className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                            )}
                          </span>
                        </div>



                        {/* Content */}
                        <div className="mb-3 pr-12">
                          <h3 className={`font-bold text-gray-900 ${isMobile ? 'text-sm' : ''}`}>
                            {i18n.language === "th"
                              ? leave.leave_type_name_th
                              : leave.leave_type_name_en}
                          </h3>
                          {leave.attachment_urls && leave.attachment_urls.length > 0 && (
                            <div className="mt-1">
                              <AttachmentBadge
                                count={leave.attachment_urls.length}
                                attachments={leave.attachment_urls}
                              />
                            </div>
                          )}
                        </div>

                        <div className={`flex items-center gap-2 ${isMobile ? 'text-xs' : 'text-sm'} text-gray-600 mb-3`}>
                          <Calendar className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
                          <span>
                            {formatDateShort(new Date(leave.start_date), i18n.language)}
                            {" → "}
                            {formatDateShort(new Date(leave.end_date), i18n.language)}
                          </span>
                        </div>

                        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-3 py-1 rounded-full inline-flex items-center gap-1 shadow-lg">
                          {leave.is_hourly_leave && leave.leave_minutes ? (
                            // Hourly leave display
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold`}>
                                {(() => {
                                  const finalMinutes = Math.round(leave.leave_minutes);
                                  const minutesPerDay = 480;
                                  const halfDayMinutes = 240;

                                  // Full day
                                  if (finalMinutes >= minutesPerDay && finalMinutes % minutesPerDay === 0) {
                                    return `${finalMinutes / minutesPerDay} ${i18n.language === 'th' ? 'วัน' : 'day(s)'}`;
                                  }

                                  // Half day
                                  if (finalMinutes === halfDayMinutes) {
                                    return i18n.language === 'th' ? 'ครึ่งวัน' : 'Half day';
                                  }

                                  // Less than 1 hour
                                  if (finalMinutes < 60) {
                                    const roundedMinutes = Math.round(finalMinutes / 30) * 30;
                                    return `${Math.max(roundedMinutes, 30)} ${i18n.language === 'th' ? 'นาที' : 'min'}`;
                                  }

                                  // Hours (round to 0.5 increments)
                                  const hours = Math.round((finalMinutes / 60) * 2) / 2;
                                  const displayHours = hours % 1 === 0 ? hours.toString() : hours.toFixed(1);
                                  return `${displayHours} ${i18n.language === 'th' ? 'ชม.' : 'hr'}`;
                                })()}
                              </span>
                            </div>
                          ) : (
                            // Regular day-based leave
                            <>
                              <span className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold`}>
                                {formatDays(leave.total_days, leave.leave_type_name_th || '', leave.leave_type_name_en || '', i18n.language)}
                              </span>
                              <span className="text-xs">{t("common.days")}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {/* Leave Balance Detail Modal */}
            {
              selectedBalance && (
                <LeaveBalanceDetailModal
                  balance={selectedBalance.balance}
                  colorGradient={selectedBalance.gradient}
                  onClose={() => setSelectedBalance(null)}
                />
              )
            }

            {/* Status Detail Modal */}
            {
              selectedStatus && (
                <StatusDetailModal
                  type={selectedStatus.type}
                  status={selectedStatus.status}
                  colorGradient={selectedStatus.gradient}
                  onClose={() => setSelectedStatus(null)}
                />
              )
            }
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
