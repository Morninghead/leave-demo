import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Save, X, Trash2, AlertCircle, RefreshCw, Download, Settings } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { getLeavePolicies, updateLeavePolicy, createLeavePoliciesForYear } from '../../api/leave-policy';
import { deleteLeaveType } from '../../api/leave';
import { LeaveTypeModal } from '../leave/LeaveTypeModal';
import { getLeaveTypes, LeaveType } from '../../api/leaveTypes';

interface LeavePolicy {
  id: string;
  year: number;
  leave_type_id: string;
  leave_type_code: string;
  leave_type_name_th: string;
  leave_type_name_en: string;
  default_days: number;
  notes?: string;
}

export function LeavePolicyPage() {
  const { t, i18n } = useTranslation();
  const { showToast, showModal: showConfirmModal } = useToast();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [editNotes, setEditNotes] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);

  const loadPolicies = async () => {
    setLoading(true);
    try {
      const data = await getLeavePolicies(selectedYear);
      setPolicies(data || []);
    } catch (error) {
      console.error('Failed to load policies:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicies();
  }, [selectedYear]);

  const handleCreateYear = async () => {
    const confirmed = await showConfirmModal('confirm', t('leavePolicy.createNewYear'), {
      message: t('leavePolicy.confirmCreate', { year: selectedYear }),
      confirmText: t('common.create'),
      cancelText: t('common.cancel'),
    });

    if (!confirmed) {
      return;
    }

    try {
      await createLeavePoliciesForYear(selectedYear);
      await loadPolicies();
    } catch (error: any) {
      showToast(error.message || 'Failed to create policies', 'error');
    }
  };

  const handleEdit = (policy: LeavePolicy) => {
    setEditingId(policy.id);
    setEditValue(policy.default_days);
    setEditNotes(policy.notes || '');
  };

  const handleSave = async (policyId: string) => {
    try {
      await updateLeavePolicy(policyId, {
        default_days: editValue,
        notes: editNotes,
      });
      await loadPolicies();
      setEditingId(null);
    } catch (error: any) {
      showToast(error.message || 'Failed to update policy', 'error');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue(0);
    setEditNotes('');
  };

  const handleDeleteLeaveType = async (leaveTypeId: string) => {
    try {
      await deleteLeaveType(leaveTypeId);
      await loadPolicies();
      setDeleteConfirm(null);
      showToast(t('leaveType.deleteSuccess'), 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to delete leave type', 'error');
      setDeleteConfirm(null);
    }
  };

  const handleModalSuccess = () => {
    loadPolicies();
    setEditingLeaveType(null);
  };

  const handleEditLeaveType = async (leaveTypeId: string) => {
    try {
      // Fetch all leave types and find the one to edit
      const allTypes = await getLeaveTypes();
      const typeToEdit = allTypes.find(t => t.id === leaveTypeId);
      if (typeToEdit) {
        setEditingLeaveType(typeToEdit);
        setShowModal(true);
      } else {
        showToast('Leave type not found', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to load leave type', 'error');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingLeaveType(null);
  };

  const handleSyncBalances = async () => {
    setSyncing(true);
    try {
      // Call the admin sync function
      const response = await fetch('/.netlify/functions/admin-sync-all-balances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ year: selectedYear }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      showToast(
        t('leavePolicy.syncSuccess', {
          count: result.employees_processed || 0,
          created: result.balances_created || 0,
          updated: result.balances_updated || 0
        }),
        'success'
      );
    } catch (error: any) {
      console.error('Failed to sync balances:', error);
      showToast(error.message || t('leavePolicy.syncError'), 'error');
    } finally {
      setSyncing(false);
    }
  };

  const years = Array.from({ length: 10 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('leavePolicy.title')}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={handleSyncBalances}
            disabled={syncing}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                {t('common.syncing')}
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5 mr-2" />
                {t('leavePolicy.syncBalances')}
              </>
            )}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            {t('leaveType.createNew')}
          </button>
        </div>
      </div>

      {/* Year Selector */}
      <div className="flex items-center space-x-4">
        <label className="text-sm font-medium text-gray-700">
          {t('leavePolicy.selectYear')}:
        </label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded-md"
        >
          {years.map(year => (
            <option key={year} value={year}>{t('common.year')} {year}</option>
          ))}
        </select>
        {policies.length === 0 && (
          <button
            onClick={handleCreateYear}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            + {t('leavePolicy.createNewYear')}
          </button>
        )}
      </div>

      {/* Policies Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : policies.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">
            {t('leavePolicy.noPolicies', { year: selectedYear })}
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('leavePolicy.leaveType')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('leavePolicy.code')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('leavePolicy.daysPerYear')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('leavePolicy.notes')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {policies.map((policy) => (
                <tr key={policy.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {i18n.language === 'th' ? policy.leave_type_name_th : policy.leave_type_name_en}
                      </div>
                      <div className="text-sm text-gray-500">
                        {i18n.language === 'th' ? policy.leave_type_name_en : policy.leave_type_name_th}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {policy.leave_type_code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingId === policy.id ? (
                      <input
                        type="number"
                        value={editValue || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setEditValue(isNaN(val) ? 0 : val);
                        }}
                        className="w-24 px-2 py-1 border rounded text-right"
                        min="0"
                        step="0.5"
                      />
                    ) : (
                      <span className="text-sm text-gray-900">{policy.default_days}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingId === policy.id ? (
                      <input
                        type="text"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder={t('leavePolicy.notesPlaceholder')}
                        className="w-full px-2 py-1 border rounded"
                      />
                    ) : (
                      <span className="text-sm text-gray-500">{policy.notes || '-'}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {editingId === policy.id ? (
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleSave(policy.id)}
                          className="text-green-600 hover:text-green-900"
                          title="Save policy changes"
                        >
                          <Save className="w-5 h-5" />
                        </button>
                        <button
                          onClick={handleCancel}
                          className="text-gray-600 hover:text-gray-900"
                          title="Cancel"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEditLeaveType(policy.leave_type_id)}
                          className="text-purple-600 hover:text-purple-900"
                          title={i18n.language === 'th' ? 'แก้ไขประเภทการลา (ชื่อ, สี, อนุญาตลาเป็นชั่วโมง)' : 'Edit leave type (name, color, hourly leave)'}
                        >
                          <Settings className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleEdit(policy)}
                          className="text-blue-600 hover:text-blue-900"
                          title={i18n.language === 'th' ? 'แก้ไขนโยบาย (จำนวนวัน, หมายเหตุ)' : 'Edit policy (days, notes)'}
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        {deleteConfirm === policy.leave_type_id ? (
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-red-600">{t('common.confirmDelete')}?</span>
                            <button
                              onClick={() => handleDeleteLeaveType(policy.leave_type_id)}
                              className="text-red-600 hover:text-red-900 font-bold"
                            >
                              {t('common.yes')}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              {t('common.no')}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(policy.leave_type_id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete leave type"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">{t('leavePolicy.infoTitle')}:</p>
          <p className="mt-1">{t('leavePolicy.infoMessage')}</p>
          <p className="mt-1">{t('leavePolicy.infoEdit')}</p>
        </div>
      </div>

      {/* Modal */}
      <LeaveTypeModal
        isOpen={showModal}
        onClose={handleCloseModal}
        onSuccess={handleModalSuccess}
        editLeaveType={editingLeaveType}
      />
    </div>
  );
}
