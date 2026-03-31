import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusCircle, History, Clock, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useDevice } from '../contexts/DeviceContext';
import { LeaveRequestForm } from '../components/leave/LeaveRequestForm';
import { LeaveHistory } from '../components/leave/LeaveHistory';
import { LeaveBalance } from '../components/leave/LeaveBalance';

export function LeavePage() {
  const { t } = useTranslation();
  const { deviceType, isMobile, isTablet } = useDevice();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'balance' | 'history'>('balance');
  const [refreshKey, setRefreshKey] = useState(0); // Add refresh trigger

  const handleCloseForm = () => {
    setShowForm(false);
  };

  const handleSuccess = () => {
    setShowForm(false);
    // Trigger data refresh by incrementing key
    setRefreshKey(prev => prev + 1);
  };

  // Device-specific layout functions
  const getContainerClass = () => {
    switch (deviceType) {
      case 'mobile': return 'px-4 py-3 max-w-full';
      case 'tablet': return 'px-6 py-4 max-w-4xl';
      case 'desktop':
      default: return 'p-6 max-w-6xl mx-auto';
    }
  };

  const getHeadingSize = () => {
    switch (deviceType) {
      case 'mobile': return 'text-xl';
      case 'tablet': return 'text-2xl';
      case 'desktop':
      default: return 'text-3xl';
    }
  };

  const getButtonClass = () => {
    switch (deviceType) {
      case 'mobile': return 'px-3 py-2 text-sm';
      case 'tablet': return 'px-4 py-2 text-sm';
      case 'desktop':
      default: return 'px-4 py-2 text-sm';
    }
  };

  return (
    <div className={getContainerClass()}>
      {/* Header */}
      <div className={`flex ${isMobile ? 'flex-col gap-4' : 'justify-between items-center'} mb-6`}>
        <div className={`flex items-center gap-3 ${isMobile ? 'mb-2' : ''}`}>
          {isMobile && (
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}
          <h1 className={`${getHeadingSize()} font-bold text-gray-900`}>{t('leave.title')}</h1>
        </div>

        {!showForm && (
          <div className={`flex ${isMobile ? 'flex-col gap-2 w-full' : 'gap-3'}`}>
            <button
              onClick={() => setShowForm(true)}
              className={`flex items-center justify-center gap-2 ${getButtonClass()} bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-all ${isMobile ? 'w-full' : ''}`}
            >
              <PlusCircle className="w-4 h-4" />
              {t('leave.newRequest')}
            </button>

            {/* Hourly Leave Button */}
            <Link
              to="/leave/hourly"
              className={`flex items-center justify-center gap-2 ${getButtonClass()} bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-all ${isMobile ? 'w-full' : ''}`}
            >
              <Clock className="w-4 h-4" />
              {t('leave.hourlyRequest', 'ลาเป็นชั่วโมง')}
            </Link>
          </div>
        )}
      </div>

      {showForm ? (
        <LeaveRequestForm
          onClose={handleCloseForm}
          onSuccess={handleSuccess}
        />
      ) : (
        <>
          {/* Tabs */}
          <div className={`flex ${isMobile ? 'flex-col' : 'gap-2'} mb-6 ${isMobile ? '' : 'border-b border-gray-200'}`}>
            <button
              onClick={() => setActiveTab('balance')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'balance'
                  ? isMobile
                    ? 'bg-blue-600 text-white rounded-lg'
                    : 'text-blue-600 border-b-2 border-blue-600'
                  : isMobile
                    ? 'bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200'
                    : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('leave.balance')}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
                activeTab === 'history'
                  ? isMobile
                    ? 'bg-blue-600 text-white rounded-lg'
                    : 'text-blue-600 border-b-2 border-blue-600'
                  : isMobile
                    ? 'bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200'
                    : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <History className="w-4 h-4" />
              {t('leave.history')}
            </button>
          </div>

          {/* Content */}
          <div className={`${isMobile ? 'pb-20' : ''}`}>
            {activeTab === 'balance' ? <LeaveBalance key={`balance-${refreshKey}`} /> : <LeaveHistory key={`history-${refreshKey}`} />}
          </div>
        </>
      )}
    </div>
  );
}
