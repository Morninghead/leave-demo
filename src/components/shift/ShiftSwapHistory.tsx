import { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import { Calendar, ArrowRightLeft, Clock, CheckCircle, XCircle, Ban } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { ShiftSwapRequest } from '../../types/shift';
import { getShiftSwapRequests, cancelShiftSwap } from '../../api/shift';
import { formatDateShort } from '../../utils/dateUtils';

export function ShiftSwapHistory() {
  const { t, i18n } = useTranslation();
  const { showToast, showModal } = useToast();
  const [requests, setRequests] = useState<ShiftSwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | 'canceled'>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filterStatus, pageSize, requests]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await getShiftSwapRequests();
      setRequests(data || []);
    } catch (error: any) {
      logger.error('Failed to load shift history:', error);
    } finally {
      setLoading(false);
    }
  };

  // ฟังก์ชันยกเลิก (เพิ่ม log detail)
  const handleCancel = async (requestId: string) => {
    const confirmed = await showModal('confirm', t('shift.cancelRequest'), {
      message: t('shift.confirmCancel') || 'ยืนยันการยกเลิกคำขอนี้?',
      confirmText: t('shift.cancel'),
      cancelText: t('common.cancel'),
    });

    if (!confirmed) return;
    setActionLoading(requestId);
    try {
      logger.log('🟡 เรียก cancelShiftSwap', requestId);
      await cancelShiftSwap(requestId);
      await loadRequests();
      logger.log('🟢 ยกเลิก shift swap สำเร็จ', requestId);
    } catch (error: any) {
      // เพิ่ม log ทั้ง error และ error.response
      logger.error('❌ Cancel shift swap error:', error);
      if (error.response) {
        logger.error('❌ Error Response Data:', error.response.data);
        showToast('API error: ' + (JSON.stringify(error.response.data) || error.message), 'error');
      } else {
        showToast(error.message, 'error');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const counts = {
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
    canceled: requests.filter(r => r.status === 'cancel').length,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'approved': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rejected': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'canceled': return <Ban className="w-5 h-5 text-gray-600" />;
      default: return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'canceled': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredRequests = requests.filter(req => req.status === filterStatus);
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const paginatedRequests = filteredRequests.slice((page - 1) * pageSize, page * pageSize);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab filter */}
      <div className="flex flex-wrap gap-2 mb-2">
        <button
          onClick={() => setFilterStatus('pending')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'pending'
            ? 'bg-yellow-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          {t('shift.pending')}
          <span className="ml-2 bg-yellow-100 text-yellow-800 py-0.5 px-2.5 rounded-full text-xs">
            {counts.pending}
          </span>
        </button>
        <button
          onClick={() => setFilterStatus('approved')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'approved'
            ? 'bg-green-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          {t('shift.approved')}
          <span className="ml-2 bg-green-100 text-green-800 py-0.5 px-2.5 rounded-full text-xs">
            {counts.approved}
          </span>
        </button>
        <button
          onClick={() => setFilterStatus('rejected')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'rejected'
            ? 'bg-red-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          {t('shift.rejected')}
          <span className="ml-2 bg-red-100 text-red-800 py-0.5 px-2.5 rounded-full text-xs">
            {counts.rejected}
          </span>
        </button>
        <button
          onClick={() => setFilterStatus('canceled')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'canceled'
            ? 'bg-gray-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          {t('shift.canceled')}
          <span className="ml-2 bg-gray-100 text-gray-800 py-0.5 px-2.5 rounded-full text-xs">
            {counts.canceled}
          </span>
        </button>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center gap-2 mb-2">
        <span>แสดงผลหน้าละ:</span>
        <select
          value={pageSize}
          onChange={e => {
            setPageSize(Number(e.target.value));
          }}
          className="border rounded px-2 py-1"
        >
          {[5, 10, 15, 20].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <button
          disabled={page === 1}
          onClick={() => setPage(p => p - 1)}
          className="border rounded px-3 py-1"
        >
          ก่อนหน้า
        </button>
        <span>{page} / {totalPages}</span>
        <button
          disabled={page === totalPages}
          onClick={() => setPage(p => p + 1)}
          className="border rounded px-3 py-1"
        >
          ถัดไป
        </button>
      </div>

      {/* Request List */}
      <div className="space-y-3">
        {paginatedRequests.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {t('shift.noHistory')}
            </h3>
          </div>
        ) : (
          paginatedRequests.map((request) => (
            <div
              key={request.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                {/* ซ้าย card */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    {getStatusIcon(request.status)}
                    <h3 className="font-semibold text-gray-900">{t('shift.swapRequest')}</h3>
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(request.status)}`}
                    >
                      {t(`shift.${request.status}`)}
                    </span>
                  </div>
                  <div className="grid md:grid-cols-3 gap-3 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>
                        {request.work_date && formatDateShort(new Date(request.work_date), i18n.language)}
                        {' - '}
                        {request.off_date && formatDateShort(new Date(request.off_date), i18n.language)}
                      </span>
                    </div>
                    <div>
                      {request.reason_th && (
                        <span className="block text-gray-600">{i18n.language === 'th' ? request.reason_th : request.reason_en}</span>
                      )}
                    </div>
                    <div className="text-gray-500">
                      {formatDateShort(new Date(request.created_at), i18n.language)}
                    </div>
                  </div>
                </div>
                {/* ขวาสุด: ปุ่มยกเลิก */}
                {request.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCancel(request.id)}
                      disabled={actionLoading === request.id}
                      className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title={t('shift.cancel')}
                    >
                      <Ban className="w-4 h-4" />
                      <span className="hidden sm:inline">
                        {actionLoading === request.id ? t('common.loading') : t('shift.cancel')}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
