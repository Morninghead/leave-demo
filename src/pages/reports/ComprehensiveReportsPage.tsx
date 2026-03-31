/**
 * Comprehensive Leave & Shift Reports Page
 *
 * Labor Law Compliance Reporting System
 * Provides 3 types of reports with PDF export and signature sections:
 * 1. Individual Employee Report
 * 2. Department Report
 * 3. Company-wide Report
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Building2,
  Users,
  AlertCircle,
  Download,
  Trash2,
  Database,
  FileCheck,
  Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { generateTestData, cleanupTestData } from '../../api/reports';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';

export default function ComprehensiveReportsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showModal } = useToast();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = user?.role === 'admin';

  const reportCards = [
    {
      id: 'individual',
      title: 'รายงานรายบุคคล',
      titleEn: 'Individual Employee Report',
      description: 'รายงานการลาและสลับวันหยุดของพนักงานแต่ละคน พร้อมลายเซ็นรับทราบ',
      descriptionEn: 'Leave and shift swap report for individual employee with signature acknowledgment',
      icon: FileText,
      color: 'blue',
      route: '/reports/comprehensive/individual',
      permissions: ['employee', 'manager', 'hr', 'admin', 'dev'],
    },
    {
      id: 'department',
      title: 'รายงานรายแผนก',
      titleEn: 'Department Report',
      description: 'สรุปการลาและสลับวันหยุดของพนักงานทั้งแผนก พร้อมลายเซ็นหัวหน้าแผนก',
      descriptionEn: 'Summary of leave and shift swaps for entire department with manager signature',
      icon: Building2,
      color: 'green',
      route: '/reports/comprehensive/department',
      permissions: ['manager', 'hr', 'admin', 'dev'],
    },
    {
      id: 'company',
      title: 'รายงานภาพรวมทั้งบริษัท',
      titleEn: 'Company-wide Report',
      description: 'รายงานสรุปทุกแผนกและสถิติการใช้วันลาทั้งองค์กร พร้อมลายเซ็นผู้บริหาร',
      descriptionEn: 'Organization-wide summary with executive signature',
      icon: Users,
      color: 'purple',
      route: '/reports/comprehensive/company',
      permissions: ['hr', 'admin', 'dev'],
    },
  ];

  const handleGenerateTestData = async () => {
    const confirmMsg = i18n.language === 'th'
      ? 'สร้างข้อมูลทดสอบ: คำขอลา 100 รายการ และรายการสลับวัน 30 รายการ?'
      : 'Generate 100 test leave requests and 30 shift swaps?';

    const confirmed = await showModal('confirm', i18n.language === 'th' ? 'สร้างข้อมูลทดสอบ' : 'Generate Test Data', {
      message: confirmMsg,
      confirmText: i18n.language === 'th' ? 'สร้าง' : 'Generate',
      cancelText: t('common.cancel'),
    });

    if (!confirmed) return;

    setLoading(true);
    setMessage(null);

    try {
      const result = await generateTestData({
        num_leave_requests: 100,
        num_shift_swaps: 30,
        months_back: 6,
        months_forward: 3,
      });

      setMessage({
        type: 'success',
        text: i18n.language === 'th'
          ? `✅ สร้างข้อมูลทดสอบสำเร็จ: คำขอลา ${result.stats.leave_requests_created} รายการ และการสลับวัน ${result.stats.shift_swap_requests_created} รายการ สำหรับพนักงาน ${result.stats.employees_with_data} คน`
          : `✅ Generated ${result.stats.leave_requests_created} leave requests and ${result.stats.shift_swap_requests_created} shift swaps for ${result.stats.employees_with_data} employees`,
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: `❌ ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCleanupTestData = async () => {
    const confirmMsg = i18n.language === 'th'
      ? '⚠️ คำเตือน: การกระทำนี้จะลบข้อมูลทดสอบทั้งหมดถาวร ดำเนินการต่อหรือไม่?'
      : '⚠️ WARNING: This will permanently delete all test data. Continue?';

    const confirmed = await showModal('confirm', i18n.language === 'th' ? 'ล้างข้อมูลทดสอบ' : 'Cleanup Test Data', {
      message: confirmMsg,
      confirmText: i18n.language === 'th' ? 'ล้างข้อมูล' : 'Cleanup',
      cancelText: t('common.cancel'),
    });

    if (!confirmed) return;

    setLoading(true);
    setMessage(null);

    try {
      const result = await cleanupTestData(true);
      setMessage({
        type: 'success',
        text: i18n.language === 'th'
          ? `✅ ลบข้อมูลทดสอบแล้ว ${result.stats.total_deleted} รายการ (คำขอลา ${result.stats.leave_requests_deleted} รายการ, การสลับวัน ${result.stats.shift_swap_requests_deleted} รายการ)`
          : `✅ Deleted ${result.stats.total_deleted} test records (${result.stats.leave_requests_deleted} leave requests, ${result.stats.shift_swap_requests_deleted} shift swaps)`,
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: `❌ ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const canAccessReport = (permissions: string[]) => {
    return permissions.includes(user?.role || '');
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 pt-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileCheck className="w-8 h-8 text-red-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {i18n.language === 'th' ? 'รายงานครบถ้วนสำหรับกฎหมายแรงงาน' : 'Comprehensive Labor Law Reports'}
            </h1>
            <p className="text-gray-600 mt-1">
              {i18n.language === 'th'
                ? 'รายงานที่มีลายเซ็นรับทราบ สำหรับเอกสารทางกฎหมายและการตรวจสอบ'
                : 'Reports with signature acknowledgment for legal documentation and audit'}
            </p>
          </div>
        </div>
      </div>

      {/* Alert Notice */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900">
              {i18n.language === 'th' ? 'เอกสารทางกฎหมาย' : 'Legal Documentation'}
            </h3>
            <p className="text-sm text-amber-800 mt-1">
              {i18n.language === 'th'
                ? 'รายงานเหล่านี้มีผลทางกฎหมาย กรุณาตรวจสอบความถูกต้องของข้อมูลก่อนลงลายเซ็น รายงานจะถูกเก็บไว้เป็นหลักฐานสำหรับการตรวจสอบด้านกฎหมายแรงงาน'
                : 'These reports are legally binding. Please verify all information before signing. Reports will be retained as evidence for labor law compliance audits.'}
            </p>
          </div>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div
          className={`p-4 rounded-lg border-l-4 ${message.type === 'success'
            ? 'bg-green-50 border-green-500 text-green-800'
            : 'bg-red-50 border-red-500 text-red-800'
            }`}
        >
          {message.text}
        </div>
      )}

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportCards.map((card) => {
          const Icon = card.icon;
          const hasAccess = canAccessReport(card.permissions);

          return (
            <div
              key={card.id}
              className={`bg-white rounded-lg shadow-lg border-2 transition-all duration-200 ${hasAccess
                ? 'border-gray-200 hover:border-blue-400 hover:shadow-xl cursor-pointer'
                : 'border-gray-100 opacity-60 cursor-not-allowed'
                }`}
              onClick={() => hasAccess && navigate(card.route)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`p-3 rounded-lg ${card.color === 'blue'
                      ? 'bg-blue-100'
                      : card.color === 'green'
                        ? 'bg-green-100'
                        : 'bg-purple-100'
                      }`}
                  >
                    <Icon
                      className={`w-6 h-6 ${card.color === 'blue'
                        ? 'text-blue-600'
                        : card.color === 'green'
                          ? 'text-green-600'
                          : 'text-purple-600'
                        }`}
                    />
                  </div>
                  {!hasAccess && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                      No Access
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {i18n.language === 'th' ? card.title : card.titleEn}
                </h3>

                <p className="text-sm text-gray-600 mb-4">
                  {i18n.language === 'th' ? card.description : card.descriptionEn}
                </p>

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Calendar className="w-4 h-4" />
                  <span>{i18n.language === 'th' ? 'เลือกช่วงเวลา' : 'Select date range'}</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                  <Download className="w-4 h-4" />
                  <span>{i18n.language === 'th' ? 'ดาวน์โหลด PDF' : 'Download PDF'}</span>
                </div>
              </div>

              {hasAccess && (
                <div
                  className={`px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-lg text-center font-medium ${card.color === 'blue'
                    ? 'text-blue-600'
                    : card.color === 'green'
                      ? 'text-green-600'
                      : 'text-purple-600'
                    }`}
                >
                  {i18n.language === 'th' ? 'สร้างรายงาน →' : 'Generate Report →'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Admin Tools */}
      {isAdmin && (
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-gray-700" />
            <h3 className="text-lg font-bold text-gray-900">
              {i18n.language === 'th' ? 'เครื่องมือผู้ดูแลระบบ' : 'Admin Tools'}
            </h3>
            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">ADMIN ONLY</span>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            {i18n.language === 'th'
              ? 'สร้างข้อมูลทดสอบสำหรับทดสอบรายงาน หรือลบข้อมูลทดสอบก่อนใช้งานจริง'
              : 'Generate test data for testing reports, or cleanup test data before production deployment'}
          </p>

          <div className="flex gap-3">
            <button
              onClick={handleGenerateTestData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Database className="w-4 h-4" />
              {loading
                ? (i18n.language === 'th' ? 'กำลังสร้าง...' : 'Generating...')
                : (i18n.language === 'th' ? 'สร้างข้อมูลทดสอบ' : 'Generate Test Data')}
            </button>

            <button
              onClick={handleCleanupTestData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              {loading
                ? (i18n.language === 'th' ? 'กำลังลบ...' : 'Cleaning...')
                : (i18n.language === 'th' ? 'ล้างข้อมูลทดสอบ' : 'Cleanup Test Data')}
            </button>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">
              {i18n.language === 'th' ? 'วิธีใช้งาน' : 'How to Use'}
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• {i18n.language === 'th' ? 'เลือกประเภทรายงานที่ต้องการ' : 'Select the report type you need'}</li>
              <li>
                • {i18n.language === 'th' ? 'กำหนดช่วงเวลาและพนักงาน/แผนก' : 'Configure date range and employee/department'}
              </li>
              <li>• {i18n.language === 'th' ? 'ตรวจสอบข้อมูลในหน้าจอ' : 'Review data on screen'}</li>
              <li>
                • {i18n.language === 'th' ? 'ดาวน์โหลด PDF พร้อมพื้นที่ลายเซ็น' : 'Download PDF with signature sections'}
              </li>
              <li>• {i18n.language === 'th' ? 'พิมพ์และเซ็นรับทราบ' : 'Print and sign for acknowledgment'}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
