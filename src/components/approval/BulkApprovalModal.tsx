import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Filter, CheckSquare, Square, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { bulkApproveLeaveRequests, type BulkApprovalFilters, type BulkApprovalResult } from '@api/approval';
import { toast } from 'react-hot-toast';
import { DatePicker } from '../common/DatePicker';
import { AttachmentBadge } from '../common/AttachmentBadge';
import { formatDateTime } from '../../utils/dateUtils';

interface BulkApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'leave';
  requests: any[];
  departments: any[];
  leaveTypes?: any[];
  onSuccess: () => void;
}

export const BulkApprovalModal: React.FC<BulkApprovalModalProps> = ({
  isOpen,
  onClose,
  type,
  requests,
  departments,
  leaveTypes,
  onSuccess,
}) => {
  const { t, i18n } = useTranslation();
  const isThaiLanguage = i18n.language === 'th';

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<BulkApprovalFilters>({});
  const [filterMode, setFilterMode] = useState<'ids' | 'filters'>('ids');
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<BulkApprovalResult | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filter requests based on current filters
  const filteredRequests = requests.filter((req) => {
    if (filterMode === 'filters') {
      if (filters.department_id && req.department_id !== filters.department_id) return false;
      if (filters.leave_type_id && type === 'leave' && req.leave_type_id !== filters.leave_type_id) return false;
      if (filters.date_range) {
        const startDate = new Date(req.start_date || req.off_date);
        if (startDate < new Date(filters.date_range.start) || startDate > new Date(filters.date_range.end)) {
          return false;
        }
      }
      if (filters.month) {
        const reqDate = new Date(req.start_date || req.off_date);
        const [year, month] = filters.month.split('-');
        if (reqDate.getFullYear() !== parseInt(year) || reqDate.getMonth() + 1 !== parseInt(month)) {
          return false;
        }
      }
    }
    return true;
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRequests.map((req) => req.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkApproval = async () => {
    if (action === 'reject' && !rejectionReason.trim()) {
      toast.error(isThaiLanguage ? 'กรุณาระบุเหตุผลการปฏิเสธ' : 'Please provide rejection reason');
      return;
    }

    if (filterMode === 'ids' && selectedIds.size === 0) {
      toast.error(isThaiLanguage ? 'กรุณาเลือกรายการที่ต้องการอนุมัติ' : 'Please select requests to approve');
      return;
    }

    setIsProcessing(true);
    try {
      const request = {
        request_ids: filterMode === 'ids' ? Array.from(selectedIds) : undefined,
        filters: filterMode === 'filters' ? filters : undefined,
        action,
        rejection_reason: action === 'reject' ? rejectionReason : undefined,
      };

      const response = await bulkApproveLeaveRequests(request);

      setResult(response);
      toast.success(response.message);

      if (response.successful > 0) {
        onSuccess();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || (isThaiLanguage ? 'เกิดข้อผิดพลาด' : 'An error occurred'));
    } finally {
      setIsProcessing(false);
    }
  };

  const getCurrentWeek = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0],
    };
  };

  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {isThaiLanguage ? 'อนุมัติรายการแบบกลุ่ม' : 'Bulk Approval'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!result ? (
            <>
              {/* Mode Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {isThaiLanguage ? 'โหมดการเลือก' : 'Selection Mode'}
                </label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setFilterMode('ids')}
                    className={`px-4 py-2 rounded-md border ${filterMode === 'ids'
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    <CheckSquare className="inline-block h-4 w-4 mr-2" />
                    {isThaiLanguage ? 'เลือกเฉพาะรายการ' : 'Select Specific Items'}
                  </button>
                  <button
                    onClick={() => setFilterMode('filters')}
                    className={`px-4 py-2 rounded-md border ${filterMode === 'filters'
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    <Filter className="inline-block h-4 w-4 mr-2" />
                    {isThaiLanguage ? 'ใช้ตัวกรองข้อมูล' : 'Use Filters'}
                  </button>
                </div>
              </div>

              {/* Filters */}
              {filterMode === 'filters' && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center text-sm font-medium text-gray-900 mb-4"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    {isThaiLanguage ? 'ตัวกรองข้อมูล' : 'Filters'}
                  </button>

                  {showFilters && (
                    <div className="grid grid-cols-2 gap-4">
                      {/* Department Filter */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {isThaiLanguage ? 'แผนก' : 'Department'}
                        </label>
                        <select
                          value={filters.department_id || ''}
                          onChange={(e) => setFilters({ ...filters, department_id: e.target.value || undefined })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                        >
                          <option value="">{isThaiLanguage ? 'ทั้งหมด' : 'All'}</option>
                          {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {isThaiLanguage ? dept.name_th : dept.name_en}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Leave Type Filter (for leave requests) */}
                      {type === 'leave' && leaveTypes && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {isThaiLanguage ? 'ประเภทการลา' : 'Leave Type'}
                          </label>
                          <select
                            value={filters.leave_type_id || ''}
                            onChange={(e) => setFilters({ ...filters, leave_type_id: e.target.value || undefined })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                          >
                            <option value="">{isThaiLanguage ? 'ทั้งหมด' : 'All'}</option>
                            {leaveTypes.map((lt) => (
                              <option key={lt.id} value={lt.id}>
                                {isThaiLanguage ? lt.name_th : lt.name_en}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Month Filter */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {isThaiLanguage ? 'เดือน' : 'Month'}
                        </label>
                        <input
                          type="month"
                          value={filters.month || ''}
                          onChange={(e) => setFilters({ ...filters, month: e.target.value || undefined, date_range: undefined, week: undefined })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>

                      {/* This Week Quick Filter */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {isThaiLanguage ? 'สัปดาห์' : 'Week'}
                        </label>
                        <button
                          onClick={() => setFilters({ ...filters, week: getCurrentWeek(), month: undefined, date_range: undefined })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-left"
                        >
                          {isThaiLanguage ? 'สัปดาห์นี้' : 'This Week'}
                        </button>
                      </div>

                      {/* Date Range */}
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {isThaiLanguage ? 'ช่วงวันที่' : 'Date Range'}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <DatePicker
                            value={filters.date_range?.start ? new Date(filters.date_range.start) : null}
                            onChange={(date) => {
                              const dateStr = date
                                ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                                : '';
                              setFilters({
                                ...filters,
                                date_range: { start: dateStr, end: filters.date_range?.end || dateStr },
                                month: undefined,
                                week: undefined,
                              });
                            }}
                            placeholder={isThaiLanguage ? 'วว/ดด/ปปปป' : 'DD/MM/YYYY'}
                          />
                          <DatePicker
                            value={filters.date_range?.end ? new Date(filters.date_range.end) : null}
                            onChange={(date) => {
                              const dateStr = date
                                ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                                : '';
                              setFilters({
                                ...filters,
                                date_range: { start: filters.date_range?.start || dateStr, end: dateStr },
                                month: undefined,
                                week: undefined,
                              });
                            }}
                            placeholder={isThaiLanguage ? 'วว/ดด/ปปปป' : 'DD/MM/YYYY'}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Request List */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-900">
                    {isThaiLanguage ? 'รายการที่พบ' : 'Found Requests'} ({filteredRequests.length})
                  </h3>
                  {filterMode === 'ids' && (
                    <button
                      onClick={toggleSelectAll}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      {selectedIds.size === filteredRequests.length
                        ? (isThaiLanguage ? 'ยกเลิกทั้งหมด' : 'Deselect All')
                        : (isThaiLanguage ? 'เลือกทั้งหมด' : 'Select All')}
                    </button>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                  {filteredRequests.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      {isThaiLanguage ? 'ไม่พบรายการที่ตรงกับเงื่อนไข' : 'No requests found matching filters'}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {filteredRequests.map((req) => (
                        <div
                          key={req.id}
                          className={`p-4 hover:bg-gray-50 cursor-pointer ${selectedIds.has(req.id) ? 'bg-primary-50' : ''
                            }`}
                          onClick={() => filterMode === 'ids' && toggleSelect(req.id)}
                        >
                          <div className="flex items-start gap-3">
                            {filterMode === 'ids' && (
                              <div className="shrink-0 mt-1">
                                {selectedIds.has(req.id) ? (
                                  <CheckSquare className="h-5 w-5 text-primary-600" />
                                ) : (
                                  <Square className="h-5 w-5 text-gray-400" />
                                )}
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-gray-900">
                                  {isThaiLanguage ? req.employee_name_th : req.employee_name_en}
                                </p>
                                <span className="text-xs text-gray-500">
                                  {req.request_number}
                                </span>
                              </div>
                              {type === 'leave' && req.request_number && req.created_at && (
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                  <span className="font-mono text-blue-700">#{req.request_number}</span>
                                  <span className="text-gray-500">
                                    {isThaiLanguage ? 'สร้างเมื่อ' : 'Created'}: {formatDateTime(req.created_at, i18n.language)}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 flex-wrap text-sm text-gray-600 mt-1">
                                {type === 'leave' ? (
                                  <>
                                    <span>{isThaiLanguage ? req.leave_type_th : req.leave_type_en} •{' '}
                                      {req.start_date} - {req.end_date} ({req.total_days}{' '}
                                      {isThaiLanguage ? 'วัน' : 'days'})</span>
                                    {req.attachment_urls && req.attachment_urls.length > 0 && (
                                      <AttachmentBadge count={req.attachment_urls.length} attachments={req.attachment_urls} />
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {isThaiLanguage ? 'สลับวันหยุด' : 'Shift Swap'} • Off: {req.off_date} → Work:{' '}
                                    {req.work_date}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {isThaiLanguage ? 'การดำเนินการ' : 'Action'}
                </label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setAction('approve')}
                    className={`px-4 py-2 rounded-md border flex-1 ${action === 'approve'
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    <CheckCircle2 className="inline-block h-4 w-4 mr-2" />
                    {isThaiLanguage ? 'อนุมัติ' : 'Approve'}
                  </button>
                  <button
                    onClick={() => setAction('reject')}
                    className={`px-4 py-2 rounded-md border flex-1 ${action === 'reject'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    <XCircle className="inline-block h-4 w-4 mr-2" />
                    {isThaiLanguage ? 'ปฏิเสธ' : 'Reject'}
                  </button>
                </div>
              </div>

              {/* Rejection Reason */}
              {action === 'reject' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isThaiLanguage ? 'เหตุผลการปฏิเสธ' : 'Rejection Reason'} *
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    placeholder={isThaiLanguage ? 'กรุณาระบุเหตุผล...' : 'Please provide reason...'}
                  />
                </div>
              )}
            </>
          ) : (
            /* Results */
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">
                  {isThaiLanguage ? 'ผลการดำเนินการ' : 'Operation Results'}
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">{result.total}</div>
                    <div className="text-sm text-gray-600">{isThaiLanguage ? 'ทั้งหมด' : 'Total'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{result.successful}</div>
                    <div className="text-sm text-gray-600">{isThaiLanguage ? 'สำเร็จ' : 'Successful'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-600">{result.failed}</div>
                    <div className="text-sm text-gray-600">{isThaiLanguage ? 'ล้มเหลว' : 'Failed'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-600">{result.skipped}</div>
                    <div className="text-sm text-gray-600">{isThaiLanguage ? 'ข้าม' : 'Skipped'}</div>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-red-900 mb-2 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    {isThaiLanguage ? 'ข้อผิดพลาด' : 'Errors'}
                  </h4>
                  <div className="space-y-1">
                    {result.errors.map((err, idx) => (
                      <p key={idx} className="text-sm text-red-700">
                        • {err.reason}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t">
          {!result ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                {isThaiLanguage ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                onClick={handleBulkApproval}
                disabled={isProcessing || (filterMode === 'ids' && selectedIds.size === 0)}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing
                  ? (isThaiLanguage ? 'กำลังดำเนินการ...' : 'Processing...')
                  : action === 'approve'
                    ? (isThaiLanguage ? 'อนุมัติ' : 'Approve')
                    : (isThaiLanguage ? 'ปฏิเสธ' : 'Reject')}
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setResult(null);
                setSelectedIds(new Set());
                setRejectionReason('');
                onClose();
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
            >
              {isThaiLanguage ? 'ปิด' : 'Close'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


