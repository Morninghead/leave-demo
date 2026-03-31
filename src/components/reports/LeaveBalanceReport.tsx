import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Download } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { LeaveBalance, getLeaveBalanceReport } from '../../api/reports';
import { lazyExportToExcel } from '../../utils/exportUtilsLazy';

export function LeaveBalanceReport() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await getLeaveBalanceReport();
      setBalances(data);
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    const exportData = balances.map((balance) => ({
      'รหัสพนักงาน': balance.employee_code,
      'ชื่อ-นามสกุล': i18n.language === 'th' ? balance.employee_name_th : balance.employee_name_en,
      'แผนก': balance.department_name_en || '-',
      'ตำแหน่ง': i18n.language === 'th' ? balance.position_th : balance.position_en,
      'ลาป่วยคงเหลือ': balance.sick_leave_balance || 0,
      'ลาป่วยใช้ไป': balance.sick_leave_used || 0,
      'ลาพักร้อนคงเหลือ': balance.annual_leave_balance || 0,
      'ลาพักร้อนใช้ไป': balance.annual_leave_used || 0,
      'ลากิจคงเหลือ': balance.personal_leave_balance || 0,
      'ลากิจใช้ไป': balance.personal_leave_used || 0,
    }));

    await lazyExportToExcel(exportData, `Leave_Balance_Report_${new Date().toISOString().split('T')[0]}`);
  };

  if (loading) {
    return <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            {t('reports.leaveBalanceReport')}
          </h3>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700"
        >
          <Download className="w-5 h-5" />
          {t('reports.exportExcel')}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('reports.employeeCode')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('reports.employeeName')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('reports.department')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-blue-50">
                  {t('reports.sickLeave')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-green-50">
                  {t('reports.annualLeave')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-yellow-50">
                  {t('reports.personalLeave')}
                </th>
              </tr>
              <tr className="bg-gray-50">
                <th colSpan={3}></th>
                <th className="px-2 py-2 text-center bg-blue-50">
                  <div className="flex justify-around text-xs text-gray-600">
                    <span>{t('reports.remaining')}</span>
                    <span>{t('reports.used')}</span>
                  </div>
                </th>
                <th className="px-2 py-2 text-center bg-green-50">
                  <div className="flex justify-around text-xs text-gray-600">
                    <span>{t('reports.remaining')}</span>
                    <span>{t('reports.used')}</span>
                  </div>
                </th>
                <th className="px-2 py-2 text-center bg-yellow-50">
                  <div className="flex justify-around text-xs text-gray-600">
                    <span>{t('reports.remaining')}</span>
                    <span>{t('reports.used')}</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {balances.map((balance) => (
                <tr key={balance.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-gray-900">
                    {balance.employee_code}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-900">
                      {i18n.language === 'th' ? balance.employee_name_th : balance.employee_name_en}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {balance.department_name_en || '-'}
                  </td>
                  <td className="px-2 py-3 bg-blue-50">
                    <div className="flex justify-around">
                      <span className="font-semibold text-blue-600">
                        {balance.sick_leave_balance || 0}
                      </span>
                      <span className="text-gray-500">{balance.sick_leave_used || 0}</span>
                    </div>
                  </td>
                  <td className="px-2 py-3 bg-green-50">
                    <div className="flex justify-around">
                      <span className="font-semibold text-green-600">
                        {balance.annual_leave_balance || 0}
                      </span>
                      <span className="text-gray-500">{balance.annual_leave_used || 0}</span>
                    </div>
                  </td>
                  <td className="px-2 py-3 bg-yellow-50">
                    <div className="flex justify-around">
                      <span className="font-semibold text-yellow-600">
                        {balance.personal_leave_balance || 0}
                      </span>
                      <span className="text-gray-500">{balance.personal_leave_used || 0}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {balances.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">{t('reports.noData')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
