import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  Building2,
  FileText,
  Target,
  TrendingUp,
} from 'lucide-react';
import { ReportCard } from '../components/reports/ReportCard';
import { useDevice } from '../contexts/DeviceContext';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

export default function ReportsHub() {
  const { t, i18n } = useTranslation();
  const { deviceType, isMobile, isTablet } = useDevice();

  // Auto-refresh every 10 minutes for reports hub
  const dummyRefresh = () => {
    // Reports hub is a navigation page.
  };

  useAutoRefresh({
    category: 'REPORTS',
    dataType: 'SUMMARY',
    onRefresh: dummyRefresh,
  });

  const getGridClass = () => {
    switch (deviceType) {
      case 'mobile': return 'grid grid-cols-1 gap-4';
      case 'tablet': return 'grid grid-cols-2 gap-5';
      case 'desktop':
      default: return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
    }
  };

  return (
    <div className={`max-w-7xl mx-auto ${isMobile ? 'p-4 space-y-4' : isTablet ? 'p-5 space-y-5' : 'p-6 space-y-6'} pt-16`}>
      <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center justify-between'} mb-6`}>
        <div className="flex items-center gap-3">
          <BarChart3 className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} text-blue-600`} />
          <div>
            <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-gray-900`}>
              {t('reports.title')}
            </h1>
            <p className="text-gray-600 mt-1">
              {i18n.language === 'th'
                ? 'รายงานที่คัดไว้สำหรับ portfolio demo โดยเน้นการลา การอนุมัติ และภาพรวมการใช้งาน'
                : 'A focused set of portfolio demo reports covering leave, approvals, and operational summaries.'}
            </p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Target className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-blue-600`} />
          <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900`}>
            {i18n.language === 'th' ? 'Selected Demo Reports' : 'Selected Demo Reports'}
          </h2>
        </div>
        <div className={getGridClass()}>
          <ReportCard
            title={i18n.language === 'th' ? 'Executive Dashboard' : 'Executive Dashboard'}
            description={
              i18n.language === 'th'
                ? 'ภาพรวม KPI การลา อัตราการอนุมัติ แนวโน้มรายเดือน และกิจกรรมล่าสุดสำหรับใช้เล่า product story'
                : 'Portfolio-ready KPI overview covering leave volume, approval rate, trends, and recent activity.'
            }
            icon={TrendingUp}
            route="/reports/executive-dashboard"
            color="blue"
            badge={i18n.language === 'th' ? 'Core Demo' : 'Core Demo'}
          />
          <ReportCard
            title={i18n.language === 'th' ? 'Department Analytics' : 'Department Analytics'}
            description={
              i18n.language === 'th'
                ? 'เปรียบเทียบข้อมูลการลาระดับแผนกเพื่อโชว์มุมมองผู้จัดการและ HR'
                : 'Department-level analytics for manager and HR storytelling.'
            }
            icon={Building2}
            route="/reports/department-analytics"
            color="yellow"
          />
          <ReportCard
            title={t('reports.leaveBalanceReport')}
            description={t('reports.leaveBalanceDesc')}
            icon={FileText}
            route="/reports/leave-balance"
            color="green"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-600">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {i18n.language === 'th' ? 'รายงานใน demo นี้เน้นอะไร' : 'What this demo report set highlights'}
            </h3>
            <p className="text-gray-600 mb-4">
              {i18n.language === 'th'
                ? 'รายงานชุดนี้ถูกคัดมาเพื่อช่วยเล่า flow หลักของระบบ ตั้งแต่สิทธิ์การลา ภาพรวมการอนุมัติ ไปจนถึงสรุปการลาระดับทีม'
                : 'These reports were selected to support the core demo narrative: leave balances, approval visibility, and team-level leave summaries.'}
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                {i18n.language === 'th' ? 'ใช้คู่กับหน้า Leave และ Approval เพื่อให้เห็นวงจรการทำงานครบ' : 'Use alongside Leave and Approval pages for a full workflow narrative.'}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                {i18n.language === 'th'
                  ? 'Executive Dashboard ช่วยสรุปภาพรวมให้คนดูเข้าใจระบบได้เร็ว'
                  : 'Executive Dashboard gives viewers a fast understanding of the product value.'}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                {i18n.language === 'th'
                  ? 'Department Analytics และ Leave Balance Report ช่วยปิดเรื่องมุมมองทีมและมุมมองพนักงาน'
                  : 'Department Analytics and Leave Balance Report complete the team and employee perspectives.'}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
