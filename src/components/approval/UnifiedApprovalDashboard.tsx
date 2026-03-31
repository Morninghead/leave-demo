// src/components/approval/UnifiedApprovalDashboard.tsx
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Filter, Bell, CheckSquare, Ban, AlertCircle, RefreshCw } from 'lucide-react';
import { LeaveApprovalList } from './LeaveApprovalList';
import { ApprovalFilters } from './ApprovalFilters';
import { BulkApprovalModal } from './BulkApprovalModal';
import { LeaveVoidManagement } from '../leave/LeaveVoidManagement';
import { getApprovalCounts } from '../../api/approval';
import { useAuth } from '../../contexts/AuthContext';
import { useDevice } from '../../contexts/DeviceContext';
import api from '../../api/auth';

import { CancellationReviewWidget } from '../leave/CancellationReviewWidget';
import { getCancellationPendingRequests } from '../../api/leave';

type TabType = 'leave' | 'void' | 'cancellation';

export function UnifiedApprovalDashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { isMobile } = useDevice();
  const [activeTab, setActiveTab] = useState<TabType>('leave');
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkApproval, setShowBulkApproval] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [counts, setCounts] = useState({
    leave_requests: 0,
    cancellation_requests: 0,
    total: 0,
  });
  const countsRequestIdRef = useRef(0);

  // ✅ FIXED: Use useMemo for canVoid to stabilize hook order
  const canVoid = useMemo(() => {
    return user && ['hr', 'admin'].includes(user.role?.toLowerCase() || '');
  }, [user]);

  const refreshDashboardData = useCallback(async () => {
    const requestId = ++countsRequestIdRef.current;
    try {
      const [approvalCounts, cancellationRequests] = await Promise.all([
        getApprovalCounts(),
        canVoid ? getCancellationPendingRequests() : Promise.resolve([]),
      ]);

      if (requestId !== countsRequestIdRef.current) {
        return;
      }

      const cancellationCount = cancellationRequests.length;
      setCounts({
        leave_requests: approvalCounts.leave_requests,
        cancellation_requests: cancellationCount,
        total: approvalCounts.leave_requests + cancellationCount,
      });
    } catch (error) {
      if (requestId !== countsRequestIdRef.current) {
        return;
      }
      console.error('Failed to refresh approval dashboard data:', error);
    }
  }, [canVoid]);

  const loadDepartments = useCallback(async () => {
    try {
      const response = await api.get('/departments');
      setDepartments(response.data.departments || []);
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  }, []);

  const loadLeaveTypes = useCallback(async () => {
    try {
      const response = await api.get('/leave-types');
      setLeaveTypes(response.data.leave_types || []);
    } catch (error) {
      console.error('Failed to load leave types:', error);
    }
  }, []);

  const loadPendingRequests = useCallback(async () => {
    try {
      const response = await api.get('/leave-requests?for_approval=true');
      setPendingRequests(response.data.leave_requests || []);
    } catch (error) {
      console.error('Failed to load pending requests:', error);
    }
  }, []);

  useEffect(() => {
    refreshDashboardData();
    loadDepartments();
    loadLeaveTypes();
  }, [loadDepartments, loadLeaveTypes, refreshDashboardData]);

  useEffect(() => {
    if (showBulkApproval) {
      loadPendingRequests();
    }
  }, [activeTab, loadPendingRequests, showBulkApproval]);

  // ✅ FIXED: Use useMemo for tabs to stabilize hook order
  const tabs = useMemo(() => [
    {
      id: 'leave' as TabType,
      label: isMobile
        ? (i18n.language === 'th' ? 'คำขอลา' : 'Leave')
        : t('approval.leaveRequests'),
      icon: FileText,
      count: counts.leave_requests,
      color: 'blue',
    },
    // Cancellation Requests Tab (HR/Admin)
    ...(canVoid ? [{
      id: 'cancellation' as TabType,
      label: isMobile
        ? (i18n.language === 'th' ? 'ยกเลิกคำขอ' : 'Cancel Req')
        : (i18n.language === 'th' ? 'คำขอยกเลิก (Cancellation)' : 'Cancellation Requests'),
      icon: AlertCircle,
      count: counts.cancellation_requests,
      color: 'amber',
    }] : []),
    // Void tab only for HR/Admin
    ...(canVoid ? [{
      id: 'void' as TabType,
      label: isMobile
        ? (i18n.language === 'th' ? 'Void ใบลา' : 'Void')
        : (i18n.language === 'th' ? 'ยกเลิกใบลา (Void)' : 'Void Leaves'),
      icon: Ban,
      count: 0, // We don't show count for void tab
      color: 'orange',
    }] : []),
  ], [t, counts, canVoid, i18n.language, isMobile]);

  const summaryCards = useMemo(() => {
    const cards = [
      {
        key: 'leave',
        label: t('approval.leaveRequests'),
        value: counts.leave_requests,
        icon: FileText,
        containerClass: 'from-blue-50 to-blue-100 border-blue-200',
        accentClass: 'text-blue-600',
        valueClass: 'text-blue-900',
      },
      ...(canVoid ? [{
        key: 'cancellation',
        label: i18n.language === 'th' ? 'คำขอยกเลิก' : 'Cancellation',
        value: counts.cancellation_requests,
        icon: AlertCircle,
        containerClass: 'from-amber-50 to-amber-100 border-amber-200',
        accentClass: 'text-amber-600',
        valueClass: 'text-amber-900',
      }] : []),
      {
        key: 'total',
        label: t('approval.totalPending'),
        value: counts.total,
        icon: Bell,
        containerClass: 'from-green-50 to-green-100 border-green-200',
        accentClass: 'text-green-600',
        valueClass: 'text-green-900',
      },
    ];

    return cards;
  }, [counts, canVoid, i18n.language, t]);

  return (
    <div className={`mx-auto max-w-7xl ${isMobile ? 'px-4 pb-6 pt-4' : 'p-6'}`}>
      {/* Header */}
      <div className={`mb-6 ${isMobile ? 'space-y-4' : 'flex items-center justify-between'}`}>
        <div className={isMobile ? '' : ''}>
          <div className="flex items-center gap-3">
            <div className={`${isMobile ? 'h-11 w-11' : 'w-10 h-10'} bg-blue-100 rounded-full flex items-center justify-center`}>
              <Bell className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className={`${isMobile ? 'text-xl leading-tight' : 'text-2xl'} font-bold text-gray-900`}>
                {t('approval.dashboard')}
              </h1>
              <p className="text-sm text-gray-600 mt-0.5">
                {t('approval.pendingApprovals', { total: counts.total })}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className={`flex ${isMobile ? 'gap-2' : 'items-center gap-3'}`}>
          {/* Bulk Approval Button */}
          <button
            onClick={() => setShowBulkApproval(true)}
            className={`flex items-center justify-center gap-2 rounded-lg bg-primary-600 text-white transition-colors hover:bg-primary-700 ${
              isMobile ? 'min-h-[44px] flex-1 px-3 py-2.5 text-sm' : 'px-4 py-2'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span className="text-sm font-medium">
              {t('approval.bulkApprove') || 'Bulk Approve'}
            </span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={refreshDashboardData}
            className={`text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors ${
              isMobile ? 'min-h-[44px] min-w-[44px] border border-gray-200 bg-white p-2.5' : 'p-2'
            }`}
            title={t('common.refresh')}
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center justify-center gap-2 border rounded-lg transition-colors ${
              isMobile ? 'min-h-[44px] px-3 py-2.5' : 'px-4 py-2'
            } ${showFilters
              ? 'bg-blue-50 border-blue-600 text-blue-600'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">{t('common.filter')}</span>
          </button>
        </div>
      </div>

      {/* Filters (Collapsible) */}
      {showFilters && (
        <div className="mb-6">
          <ApprovalFilters />
        </div>
      )}

      {/* Summary Cards */}
      <div className={`mb-6 grid gap-4 ${isMobile ? 'grid-cols-1' : canVoid ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-3'}`}>
        {summaryCards.map((card) => (
          <div
            key={card.key}
            className={`rounded-lg border bg-gradient-to-br p-4 ${card.containerClass}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${card.accentClass}`}>{card.label}</p>
                <p className={`mt-1 text-3xl font-bold ${card.valueClass}`}>{card.value}</p>
              </div>
              <card.icon className={`h-8 w-8 ${card.accentClass}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav
          className={`flex gap-2 ${isMobile ? 'overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : ''}`}
          aria-label={i18n.language === 'th' ? 'ประเภทคำขออนุมัติ' : 'Approval request tabs'}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 border-b-2 font-medium text-sm transition-all whitespace-nowrap shrink-0 rounded-t-xl
                ${isMobile ? 'px-4 py-3' : 'px-6 py-3'}
                ${activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className={`
                    px-2.5 py-0.5 rounded-full text-xs font-bold
                    ${activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700'
                    }
                  `}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        {activeTab === 'leave' && (
          <LeaveApprovalList
            onUpdate={refreshDashboardData}
          />
        )}

        {activeTab === 'cancellation' && (
          <CancellationReviewWidget
            onUpdate={refreshDashboardData}
          />
        )}

        {activeTab === 'void' && (
          <LeaveVoidManagement />
        )}
      </div>

      {/* Bulk Approval Modal */}
      {activeTab === 'leave' && (
        <BulkApprovalModal
          isOpen={showBulkApproval}
          onClose={() => setShowBulkApproval(false)}
          type="leave"
          requests={pendingRequests}
          departments={departments}
          leaveTypes={leaveTypes}
          onSuccess={() => {
            refreshDashboardData();
            setShowBulkApproval(false);
          }}
        />
      )}
    </div>
  );
}
