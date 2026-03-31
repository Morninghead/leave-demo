import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck, Ban, AlertCircle, History } from 'lucide-react';
import { LeaveApprovalDashboard } from '../components/leave/LeaveApprovalDashboard';
import { LeaveVoidManagement } from '../components/leave/LeaveVoidManagement';
import { CancellationReviewWidget } from '../components/leave/CancellationReviewWidget';
import { ApprovalHistoryList } from '../components/approval/ApprovalHistoryList';
import { useDevice } from '../contexts/DeviceContext';
import { useAuth } from '../contexts/AuthContext';
import { getCancellationPendingRequests } from '../api/leave';

export function LeaveApprovalPage() {
  const { i18n, t } = useTranslation();
  const { isMobile, isTablet } = useDevice();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'approval' | 'void' | 'cancellation' | 'history'>('approval');
  const [cancellationCount, setCancellationCount] = useState(0);

  // Check if user can access void tab (HR/Admin only) - case insensitive
  const userRole = user?.role?.toLowerCase() || '';
  const canVoid = user && ['hr', 'admin'].includes(userRole);

  // Fetch cancellation pending count
  useEffect(() => {
    if (canVoid) {
      getCancellationPendingRequests()
        .then(requests => setCancellationCount(requests.length))
        .catch(() => setCancellationCount(0));
    }
  }, [canVoid]);

  const refreshCancellationCount = () => {
    if (canVoid) {
      getCancellationPendingRequests()
        .then(requests => setCancellationCount(requests.length))
        .catch(() => setCancellationCount(0));
    }
  };

  return (
    <div className={isMobile ? 'p-4' : isTablet ? 'p-5' : 'p-6'}>
      {/* Tabs - Only show if user can void */}
      {canVoid && (
        <div className="mb-6">
          <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
            <button
              onClick={() => setActiveTab('approval')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors relative whitespace-nowrap ${activeTab === 'approval'
                ? 'text-blue-600 border-b-2 border-blue-600 -mb-[2px]'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <ClipboardCheck className="w-5 h-5" />
              {i18n.language === 'th' ? 'อนุมัติคำขอลา' : 'Leave Approval'}
            </button>
            <button
              onClick={() => setActiveTab('cancellation')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors relative whitespace-nowrap ${activeTab === 'cancellation'
                ? 'text-amber-600 border-b-2 border-amber-600 -mb-[2px]'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <AlertCircle className="w-5 h-5" />
              {t('approval.cancellationRequests')}
              {cancellationCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                  {cancellationCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('void')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors relative whitespace-nowrap ${activeTab === 'void'
                ? 'text-orange-600 border-b-2 border-orange-600 -mb-[2px]'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <Ban className="w-5 h-5" />
              {i18n.language === 'th' ? 'ยกเลิกใบลา (Void)' : 'Void Leaves'}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors relative whitespace-nowrap ${activeTab === 'history'
                ? 'text-purple-600 border-b-2 border-purple-600 -mb-[2px]'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <History className="w-5 h-5" />
              {i18n.language === 'th' ? 'ประวัติการอนุมัติ' : 'Approval History'}
            </button>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'approval' && <LeaveApprovalDashboard />}
      {activeTab === 'cancellation' && canVoid && (
        <CancellationReviewWidget onUpdate={refreshCancellationCount} />
      )}
      {activeTab === 'void' && <LeaveVoidManagement />}
      {activeTab === 'history' && <ApprovalHistoryList />}
    </div>
  );
}

