import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusCircle, History } from 'lucide-react';
import { ShiftSwapForm } from '../components/shift/ShiftSwapForm';
import { ShiftSwapHistory } from '../components/shift/ShiftSwapHistory';
import { useDevice } from '../contexts/DeviceContext';

export function ShiftSwapPage() {
  const { t } = useTranslation();
  const { deviceType, isMobile, isTablet } = useDevice();
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'new'>('history');
  const [refreshKey, setRefreshKey] = useState(0); // Add refresh trigger

  const handleCloseForm = () => {
    setShowForm(false);
    setActiveTab('history');
  };

  const handleSuccess = () => {
    setShowForm(false);
    setActiveTab('history');
    // Trigger data refresh
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className={`${isMobile ? 'p-4' : isTablet ? 'p-5 max-w-5xl' : 'p-6 max-w-6xl'} mx-auto`}>
      <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-center'} mb-6`}>
        <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-gray-900`}>{t('shift.title')}</h1>
        {!showForm && (
          <button
            onClick={() => {
              setShowForm(true);
              setActiveTab('new');
            }}
            className={`flex items-center gap-2 ${isMobile ? 'px-3 py-2 text-sm w-full justify-center' : 'px-4 py-2'} bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700`}
          >
            <PlusCircle className="w-5 h-5" />
            {t('shift.newRequest')}
          </button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/18 z-[9999] flex items-center justify-center p-4">
          <ShiftSwapForm
            onSuccess={handleSuccess}
            onCancel={handleCloseForm}
          />
        </div>
      )}

      {!showForm && (
        <>
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
                activeTab === 'history'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <History className="w-4 h-4" />
              {t('shift.history')}
            </button>
          </div>
          <ShiftSwapHistory key={`shift-history-${refreshKey}`} />
        </>
      )}
    </div>
  );
}
