import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PasswordChangeModal } from '../components/auth/PasswordChangeModal';

export function PasswordChangePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {i18n.language === 'th' ? 'กลับหน้าหลัก' : 'Back to Dashboard'}
            </button>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-blue-600" />
              <h1 className="text-lg font-semibold text-gray-900">
                {i18n.language === 'th' ? 'เปลี่ยนรหัสผ่าน' : 'Change Password'}
              </h1>
            </div>
            <div className="w-10"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8">
        <div className="text-center max-w-md">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <Shield className="h-16 w-16 text-blue-600 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {i18n.language === 'th' ? 'เปลี่ยนรหัสผ่าน' : 'Change Password'}
            </h2>
            <p className="text-gray-600 mb-6">
              {i18n.language === 'th'
                ? 'เปลี่ยนรหัสผ่านเพื่อความปลอดภัยบัญชีผู้ใช้ของคุณ'
                : 'Change your password to keep your account secure'}
            </p>

            <button
              onClick={() => setShowModal(true)}
              className="w-full bg-blue-600 text-white rounded-lg px-6 py-3 font-medium hover:bg-blue-700 transition-colors"
            >
              {i18n.language === 'th' ? 'เปลี่ยนรหัสผ่าน' : 'Change Password'}
            </button>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      <PasswordChangeModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        isForced={false}
        isOwnPassword={true}
      />
    </div>
  );
}