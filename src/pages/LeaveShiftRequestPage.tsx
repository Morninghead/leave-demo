import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusCircle, History } from 'lucide-react';

import { LeaveRequestForm } from '../components/leave/LeaveRequestForm';
import { LeaveHistory } from '../components/leave/LeaveHistory';
import { LeaveBalance } from '../components/leave/LeaveBalance';
import { ShiftSwapForm } from '../components/shift/ShiftSwapForm';
import { ShiftSwapHistory } from '../components/shift/ShiftSwapHistory';
import { useAuth } from '../hooks/useAuth';

export function LeaveShiftRequestPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'leave' | 'shift'>('leave');
  const [refreshKey, setRefreshKey] = useState(0); // Add refresh trigger

  // ✅ Check if user can manage shift swaps (HR only)
  // Note: Manager and Admin can NO LONGER manage shift swaps
  const canManageShiftSwaps = user?.role === 'hr';

  // ปิดฟอร์ม
  const handleCloseLeaveForm = () => setShowLeaveForm(false);
  const handleSuccessLeaveForm = () => {
    setShowLeaveForm(false);
    // Trigger data refresh
    setRefreshKey(prev => prev + 1);
  };

  const handleCloseShiftForm = () => setShowShiftForm(false);
  const handleSuccessShiftForm = () => {
    setShowShiftForm(false);
    // Trigger data refresh
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          {t('leaveShift.title', { defaultValue: 'ใบลา/สลับกะ' })}
        </h1>
        {!showLeaveForm && !showShiftForm && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowLeaveForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
            >
              <PlusCircle className="w-5 h-5" />
              {t('leave.newRequest')}
            </button>
            {/* ✅ Only show shift swap button for Admin/HR/Manager */}
            {canManageShiftSwaps && (
              <button
                onClick={() => setShowShiftForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700"
              >
                <PlusCircle className="w-5 h-5" />
                {t('shift.newRequest')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Forms */}
      {showLeaveForm && (
        <LeaveRequestForm
          onClose={handleCloseLeaveForm}
          onSuccess={handleSuccessLeaveForm}
        />
      )}
      {/* ✅ Only show shift swap form for Admin/HR/Manager */}
      {showShiftForm && canManageShiftSwaps && (
        <ShiftSwapForm
          onCancel={handleCloseShiftForm}
          onSuccess={handleSuccessShiftForm}
        />
      )}

      {/* Tabs switch ประวัติ */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('leave')}
          className={`px-4 py-2 font-medium transition-colors ${activeTab === 'leave'
            ? 'text-blue-600 border-b-2 border-blue-600'
            : 'text-gray-600 hover:text-gray-900'
            }`}
        >
          {t('leave.history')}
        </button>
        {/* ✅ Only show shift swap tab for Admin/HR/Manager */}
        {canManageShiftSwaps && (
          <button
            onClick={() => setActiveTab('shift')}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${activeTab === 'shift'
              ? 'text-green-600 border-b-2 border-green-600'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <History className="w-4 h-4" />
            {t('shift.history')}
          </button>
        )}
      </div>

      {activeTab === 'leave' ? (
        <>
          <LeaveHistory key={`leave-history-${refreshKey}`} />
          <LeaveBalance key={`leave-balance-${refreshKey}`} />
        </>
      ) : (
        // ✅ Only render shift history for Admin/HR/Manager
        canManageShiftSwaps && <ShiftSwapHistory key={`shift-history-${refreshKey}`} />
      )}
    </div>
  );
}
