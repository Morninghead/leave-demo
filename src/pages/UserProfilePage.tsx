import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import {
  User,
  Mail,
  Phone,
  Calendar,
  Building2,
  Key,
  Camera,
  Briefcase,
  Clock,
  Edit2,
  Save,
  X as XIcon,
  MapPin,
  UserCircle2,
  AlertTriangle,
  IdCard,
  Cake,
  Link2,
  Unlink,
  MessageCircleMore
} from 'lucide-react';
import { PasswordChangeModal } from '../components/auth/PasswordChangeModal';
import { DatePicker } from '../components/common/DatePicker';
import { useToast } from '../hooks/useToast';
import { logger } from '../utils/logger';
import { getRoleName, getRoleBadgeColor } from '../types/auth';
import {
  beginLineLogin,
  cleanupLineLoginCallbackUrl,
  clearLineLoginPending,
  getLineIdToken,
  hasRecentLineLoginPending,
  isLineLoginCallbackUrl,
} from '../utils/line-liff';
import {
  getLineAccountStatus,
  LineAccountStatus,
  linkLineAccount,
  unlinkLineAccount,
} from '../api/lineAuth';

interface LeaveBalanceSummary {
  leave_type: string;
  total_days: number;
  used_days: number;
  remaining_days: number;
}

export function UserProfilePage() {
  const HIDDEN_BALANCE_CODES = new Set(['WORK_INJURY']);
  const { t, i18n } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { settings } = useSettings();
  const { showToast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceSummary[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [lineAccountStatus, setLineAccountStatus] = useState<LineAccountStatus | null>(null);
  const [loadingLineAccount, setLoadingLineAccount] = useState(true);
  const [lineActionLoading, setLineActionLoading] = useState(false);
  const lineResumeRef = useRef(false);

  // Editable fields state
  const [editedData, setEditedData] = useState({
    first_name_th: user?.first_name_th || '',
    last_name_th: user?.last_name_th || '',
    first_name_en: user?.first_name_en || '',
    last_name_en: user?.last_name_en || '',
    phone: user?.phone || '',
    email: user?.email || '',
    birth_date: user?.birth_date || '',
    address_th: user?.address_th || '',
    emergency_contact_name: user?.emergency_contact_name || '',
    emergency_contact_phone: user?.emergency_contact_phone || ''
  });

  useEffect(() => {
    if (user) {
      setEditedData({
        first_name_th: user.first_name_th || '',
        last_name_th: user.last_name_th || '',
        first_name_en: user.first_name_en || '',
        last_name_en: user.last_name_en || '',
        phone: user.phone || '',
        email: user.email || '',
        birth_date: user.birth_date ? new Date(user.birth_date).toISOString().split('T')[0] : '',
        address_th: user.address_th || '',
        emergency_contact_name: user.emergency_contact_name || '',
        emergency_contact_phone: user.emergency_contact_phone || ''
      });
    }
  }, [user]);

  useEffect(() => {
    fetchLeaveBalances();
  }, [i18n.language]); // Re-fetch when language changes to get correct leave type names

  const fetchLineAccountStatus = useCallback(async () => {
    try {
      setLoadingLineAccount(true);
      const status = await getLineAccountStatus();
      setLineAccountStatus(status);
    } catch (error) {
      logger.error('Failed to fetch LINE account status:', error);
    } finally {
      setLoadingLineAccount(false);
    }
  }, []);

  useEffect(() => {
    void fetchLineAccountStatus();
  }, [fetchLineAccountStatus]);

  const resumeLineLink = useCallback(async () => {
    if (
      lineResumeRef.current ||
      !lineAccountStatus?.ready ||
      !lineAccountStatus.liffId
    ) {
      return;
    }

    const shouldResume = isLineLoginCallbackUrl() || hasRecentLineLoginPending();
    if (!shouldResume) {
      clearLineLoginPending();
      return;
    }

    lineResumeRef.current = true;
    setLineActionLoading(true);

    try {
      const idToken = await getLineIdToken(lineAccountStatus.liffId);
      await linkLineAccount(idToken);
      clearLineLoginPending();
      cleanupLineLoginCallbackUrl();
      await fetchLineAccountStatus();
      showToast(
        i18n.language === 'th'
          ? 'เชื่อมบัญชี LINE สำเร็จ'
          : 'LINE account linked successfully',
        'success'
      );
    } catch (error: any) {
      clearLineLoginPending();
      cleanupLineLoginCallbackUrl();
      showToast(
        error.message || (i18n.language === 'th'
          ? 'เชื่อมบัญชี LINE ไม่สำเร็จ'
          : 'Failed to link LINE account'),
        'error'
      );
    } finally {
      lineResumeRef.current = false;
      setLineActionLoading(false);
    }
  }, [fetchLineAccountStatus, i18n.language, lineAccountStatus, showToast]);

  useEffect(() => {
    if (!lineAccountStatus?.ready || !lineAccountStatus.liffId) {
      return;
    }

    void resumeLineLink();

    const handleAppResume = () => {
      if (document.visibilityState === 'hidden') {
        return;
      }
      void resumeLineLink();
    };

    window.addEventListener('focus', handleAppResume);
    window.addEventListener('pageshow', handleAppResume);
    document.addEventListener('visibilitychange', handleAppResume);

    return () => {
      window.removeEventListener('focus', handleAppResume);
      window.removeEventListener('pageshow', handleAppResume);
      document.removeEventListener('visibilitychange', handleAppResume);
    };
  }, [lineAccountStatus, resumeLineLink]);

  const fetchLeaveBalances = async () => {
    try {
      setLoadingBalances(true);
      const response = await fetch('/.netlify/functions/leave-balance', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        // Map the response to our LeaveBalanceSummary interface
        let balances = (result.leave_balances || []).map((balance: any) => ({
          leave_type: i18n.language === 'th' ? balance.leave_type_name_th : balance.leave_type_name_en,
          leave_type_code: balance.leave_type_code || '',
          leave_type_name_en: balance.leave_type_name_en || '',
          leave_type_name_th: balance.leave_type_name_th || '',
          total_days: parseFloat(balance.total_days || 0),
          used_days: parseFloat(balance.used_days || 0),
          remaining_days: balance.is_unlimited_leave
            ? Infinity
            : parseFloat(balance.total_days || 0) - parseFloat(balance.used_days || 0)
        }));

        balances = balances.filter((b: any) => {
          const code = (b.leave_type_code || '').toUpperCase();
          if (HIDDEN_BALANCE_CODES.has(code)) return false;
          const nameEn = (b.leave_type_name_en || '').toLowerCase();
          const nameTh = (b.leave_type_name_th || '');
          const isVacation = code === 'VL' || code === 'VAC' || code === 'ANNUAL' || b.is_annual_leave
            || nameEn.includes('vacation') || nameEn.includes('annual') || nameTh.includes('ลาพักร้อน');

          if (isVacation) {
            if (!user?.hire_date) return false;

            const parts = String(user.hire_date).split(/[-/]/);
            let hireDate = new Date(user.hire_date);
            if (parts.length === 3) {
              if (parts[0].length === 4) {
                hireDate = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
              } else if (parts[2].length === 4) {
                hireDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
              }
            }

            const today = new Date();

            // If settings hasn't loaded yet, hide vacation leave by default (fail-safe)
            if (!settings) return false;

            // Convert string 'true' to boolean if needed, and handle undefined
            const isTenureRequired = settings.require_1_year_tenure_for_vacation === true ||
              String(settings.require_1_year_tenure_for_vacation) === 'true';

            if (isTenureRequired) {
              let yearsDiff = today.getFullYear() - hireDate.getFullYear();
              if (
                today.getMonth() < hireDate.getMonth() ||
                (today.getMonth() === hireDate.getMonth() && today.getDate() < hireDate.getDate())
              ) {
                yearsDiff--;
              }
              return yearsDiff >= 1;
            } else {
              // 119-day probation logic
              const diffTime = Math.abs(today.getTime() - hireDate.getTime());
              const daysDiff = Math.floor(diffTime / (1000 * 60 * 60 * 24));
              return daysDiff >= 119;
            }
          }
          return true;
        });

        setLeaveBalances(balances);
      }
    } catch (error) {
      logger.error('Failed to fetch leave balances:', error);
    } finally {
      setLoadingBalances(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Validate email format
      if (editedData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editedData.email)) {
        showToast(
          i18n.language === 'th' ? 'รูปแบบอีเมลไม่ถูกต้อง' : 'Invalid email format',
          'error'
        );
        return;
      }

      // Validate phone format (basic)
      if (editedData.phone && !/^[0-9\-\+\(\)\s]{9,20}$/.test(editedData.phone)) {
        showToast(
          i18n.language === 'th' ? 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง' : 'Invalid phone format',
          'error'
        );
        return;
      }

      const response = await fetch('/.netlify/functions/update-profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editedData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update profile');
      }

      // Try to refresh user data, but don't fail if it errors
      try {
        await refreshUser();
      } catch (refreshError) {
        logger.warn('Failed to refresh user after profile update:', refreshError);
        // Don't show error to user - profile was still updated successfully
        // The refreshUser function now handles server errors gracefully
      }

      setIsEditing(false);
      showToast(
        i18n.language === 'th' ? 'อัปเดตข้อมูลสำเร็จ' : 'Profile updated successfully',
        'success'
      );
    } catch (error: any) {
      logger.error('Failed to update profile:', error);
      showToast(
        error.message || (i18n.language === 'th' ? 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล' : 'Failed to update profile'),
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setEditedData({
        first_name_th: user.first_name_th || '',
        last_name_th: user.last_name_th || '',
        first_name_en: user.first_name_en || '',
        last_name_en: user.last_name_en || '',
        phone: user.phone || '',
        email: user.email || '',
        birth_date: user.birth_date || '',
        address_th: user.address_th || '',
        emergency_contact_name: user.emergency_contact_name || '',
        emergency_contact_phone: user.emergency_contact_phone || ''
      });
    }
    setIsEditing(false);
  };

  const handleProfileImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast(
        i18n.language === 'th' ? 'กรุณาเลือกไฟล์รูปภาพ' : 'Please select an image file',
        'error'
      );
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast(
        i18n.language === 'th' ? 'ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 5MB)' : 'File too large (max 5MB)',
        'error'
      );
      return;
    }

    try {
      setUploading(true);

      // Convert file to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result as string;

        const response = await fetch('/.netlify/functions/upload-profile-image', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            imageData: base64data,
            fileName: file.name,
            mimeType: file.type
          })
        });

        if (!response.ok) {
          throw new Error('Failed to upload image');
        }

        await refreshUser();
        showToast(
          i18n.language === 'th' ? 'อัปโหลดรูปโปรไฟล์สำเร็จ' : 'Profile image uploaded successfully',
          'success'
        );
      };

      reader.readAsDataURL(file);
    } catch (error) {
      logger.error('Failed to upload profile image:', error);
      showToast(
        i18n.language === 'th' ? 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ' : 'Failed to upload image',
        'error'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleLinkLineAccount = async () => {
    if (!lineAccountStatus?.ready || !lineAccountStatus.liffId) {
      showToast(
        i18n.language === 'th'
          ? 'LINE ยังไม่พร้อมใช้งานสำหรับการเชื่อมบัญชี'
          : 'LINE is not ready for account linking',
        'error'
      );
      return;
    }

    setLineActionLoading(true);

    try {
      const result = await beginLineLogin(lineAccountStatus.liffId);

      if (result.redirected) {
        return;
      }

      if (!result.idToken) {
        throw new Error('LINE identity token is invalid or expired');
      }

      await linkLineAccount(result.idToken);
      await fetchLineAccountStatus();
      showToast(
        i18n.language === 'th'
          ? 'เชื่อมบัญชี LINE สำเร็จ'
          : 'LINE account linked successfully',
        'success'
      );
    } catch (error: any) {
      clearLineLoginPending();
      showToast(
        error.message || (i18n.language === 'th'
          ? 'เชื่อมบัญชี LINE ไม่สำเร็จ'
          : 'Failed to link LINE account'),
        'error'
      );
    } finally {
      setLineActionLoading(false);
    }
  };

  const handleUnlinkLineAccount = async () => {
    try {
      setLineActionLoading(true);
      await unlinkLineAccount();
      await fetchLineAccountStatus();
      showToast(
        i18n.language === 'th'
          ? 'ยกเลิกการเชื่อมบัญชี LINE สำเร็จ'
          : 'LINE account unlinked successfully',
        'success'
      );
    } catch (error: any) {
      showToast(
        error.message || (i18n.language === 'th'
          ? 'ยกเลิกการเชื่อมบัญชี LINE ไม่สำเร็จ'
          : 'Failed to unlink LINE account'),
        'error'
      );
    } finally {
      setLineActionLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">{t('common.loading')}</div>
      </div>
    );
  }

  const displayName = i18n.language === 'th'
    ? `${user.first_name_th} ${user.last_name_th}`
    : `${user.first_name_en} ${user.last_name_en}`;

  const initials = i18n.language === 'th'
    ? `${user.first_name_th?.charAt(0) || ''}${user.last_name_th?.charAt(0) || ''}`
    : `${user.first_name_en?.charAt(0) || ''}${user.last_name_en?.charAt(0) || ''}`;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4 sm:gap-6">
            {/* Profile Image */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shadow-lg">
                {user.profile_image_url ? (
                  <img
                    src={user.profile_image_url}
                    alt="Profile"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>

              {/* Upload Button */}
              <label className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-lg cursor-pointer hover:bg-gray-50 border border-gray-200 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfileImageUpload}
                  className="hidden"
                  disabled={uploading}
                />
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 text-gray-600" />
                )}
              </label>
            </div>

            {/* Basic Info */}
            <div className={`flex-1 min-w-0 ${isEditing ? 'w-full' : ''}`}>
              {isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {i18n.language === 'th' ? 'ชื่อ (ไทย)' : 'First Name (TH)'}
                    </label>
                    <input
                      type="text"
                      value={editedData.first_name_th}
                      onChange={(e) => setEditedData({ ...editedData, first_name_th: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {i18n.language === 'th' ? 'นามสกุล (ไทย)' : 'Last Name (TH)'}
                    </label>
                    <input
                      type="text"
                      value={editedData.last_name_th}
                      onChange={(e) => setEditedData({ ...editedData, last_name_th: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {i18n.language === 'th' ? 'ชื่อ (อังกฤษ)' : 'First Name (EN)'}
                    </label>
                    <input
                      type="text"
                      value={editedData.first_name_en}
                      onChange={(e) => setEditedData({ ...editedData, first_name_en: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {i18n.language === 'th' ? 'นามสกุล (อังกฤษ)' : 'Last Name (EN)'}
                    </label>
                    <input
                      type="text"
                      value={editedData.last_name_en}
                      onChange={(e) => setEditedData({ ...editedData, last_name_en: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                    />
                  </div>
                </div>
              ) : (
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{displayName}</h1>
              )}
              <p className="text-gray-600 mt-1 text-sm sm:text-base">
                {i18n.language === 'th' ? user.position_th : user.position_en}
              </p>
              <div className="flex items-center gap-2 sm:gap-4 mt-2 flex-wrap">
                <span className="text-xs sm:text-sm text-gray-500">
                  <IdCard className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  <span className="hidden xs:inline">{i18n.language === 'th' ? 'รหัส:' : 'Code:'}</span>
                  <span className="font-mono font-semibold text-gray-900 ml-1">
                    {user.employee_code}
                  </span>
                </span>
                <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-medium ${user.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
                  }`}>
                  {user.status === 'active'
                    ? (i18n.language === 'th' ? 'ใช้งาน' : 'Active')
                    : (i18n.language === 'th' ? 'ไม่ใช้งาน' : 'Inactive')
                  }
                </span>
                <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                  {getRoleName(user.role, i18n.language as 'th' | 'en')}
                </span>
              </div>
            </div>
          </div>

          {/* Edit/Save Buttons - Full width on mobile */}
          <div className="flex gap-2 w-full sm:w-auto sm:flex-shrink-0">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <XIcon className="w-4 h-4" />
                  <span className="text-sm">{i18n.language === 'th' ? 'ยกเลิก' : 'Cancel'}</span>
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span className="text-sm">{i18n.language === 'th' ? 'บันทึก' : 'Save'}</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                <span className="text-sm whitespace-nowrap">{i18n.language === 'th' ? 'แก้ไขข้อมูล' : 'Edit Profile'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-blue-600" />
          {i18n.language === 'th' ? 'ข้อมูลติดต่อ' : 'Contact Information'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Email - Editable */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4 inline mr-2" />
              {i18n.language === 'th' ? 'อีเมล' : 'Email'}
              {isEditing && <span className="text-blue-600 ml-1">*</span>}
            </label>
            {isEditing ? (
              <input
                type="email"
                value={editedData.email}
                onChange={(e) => setEditedData({ ...editedData, email: e.target.value })}
                placeholder={i18n.language === 'th' ? 'กรอกอีเมล' : 'Enter email'}
                className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <p className="text-gray-900">{user.email || '-'}</p>
            )}
          </div>

          {/* Phone - Editable */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Phone className="w-4 h-4 inline mr-2" />
              {i18n.language === 'th' ? 'เบอร์โทรศัพท์' : 'Phone Number'}
              {isEditing && <span className="text-blue-600 ml-1">*</span>}
            </label>
            {isEditing ? (
              <input
                type="tel"
                value={editedData.phone}
                onChange={(e) => setEditedData({ ...editedData, phone: e.target.value })}
                placeholder={i18n.language === 'th' ? 'กรอกเบอร์โทรศัพท์' : 'Enter phone number'}
                className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <p className="text-gray-900">{user.phone || '-'}</p>
            )}
          </div>

          {/* Birth Date - Editable */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Cake className="w-4 h-4 inline mr-2" />
              {i18n.language === 'th' ? 'วันเกิด' : 'Birth Date'}
              {isEditing && <span className="text-blue-600 ml-1">*</span>}
            </label>
            {isEditing ? (
              <DatePicker
                value={editedData.birth_date ? new Date(editedData.birth_date) : null}
                onChange={(date) => {
                  if (date) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    setEditedData({ ...editedData, birth_date: `${year}-${month}-${day}` });
                  } else {
                    setEditedData({ ...editedData, birth_date: '' });
                  }
                }}
                showYearDropdown
                showMonthDropdown
                maxDate={new Date()}
                placeholder={i18n.language === 'th' ? 'วว/ดด/ปปปป' : 'DD/MM/YYYY'}
              />
            ) : (
              <p className="text-gray-900">
                {user.birth_date
                  ? new Date(user.birth_date).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-US')
                  : '-'
                }
              </p>
            )}
          </div>

          {/* Address - Editable */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-2" />
              {i18n.language === 'th' ? 'ที่อยู่' : 'Address'}
              {isEditing && <span className="text-blue-600 ml-1">*</span>}
            </label>
            {isEditing ? (
              <textarea
                value={editedData.address_th}
                onChange={(e) => setEditedData({ ...editedData, address_th: e.target.value })}
                placeholder={i18n.language === 'th' ? 'กรอกที่อยู่' : 'Enter address'}
                rows={3}
                className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <p className="text-gray-900 whitespace-pre-wrap">{user.address_th || '-'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Emergency Contact */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          {i18n.language === 'th' ? 'ผู้ติดต่อฉุกเฉิน' : 'Emergency Contact'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Emergency Contact Name - Editable */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <UserCircle2 className="w-4 h-4 inline mr-2" />
              {i18n.language === 'th' ? 'ชื่อผู้ติดต่อฉุกเฉิน' : 'Emergency Contact Name'}
              {isEditing && <span className="text-blue-600 ml-1">*</span>}
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editedData.emergency_contact_name}
                onChange={(e) => setEditedData({ ...editedData, emergency_contact_name: e.target.value })}
                placeholder={i18n.language === 'th' ? 'กรอกชื่อผู้ติดต่อฉุกเฉิน' : 'Enter emergency contact name'}
                className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <p className="text-gray-900">{user.emergency_contact_name || '-'}</p>
            )}
          </div>

          {/* Emergency Contact Phone - Editable */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Phone className="w-4 h-4 inline mr-2" />
              {i18n.language === 'th' ? 'เบอร์โทรศัพท์ฉุกเฉิน' : 'Emergency Phone Number'}
              {isEditing && <span className="text-blue-600 ml-1">*</span>}
            </label>
            {isEditing ? (
              <input
                type="tel"
                value={editedData.emergency_contact_phone}
                onChange={(e) => setEditedData({ ...editedData, emergency_contact_phone: e.target.value })}
                placeholder={i18n.language === 'th' ? 'กรอกเบอร์โทรศัพท์ฉุกเฉิน' : 'Enter emergency phone number'}
                className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <p className="text-gray-900">{user.emergency_contact_phone || '-'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Employment Information - Read-only */}
      <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-300 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-gray-600" />
          {i18n.language === 'th' ? 'ข้อมูลการจ้างงาน' : 'Employment Information'}
          <span className="text-xs text-gray-500 font-normal ml-2">
            ({i18n.language === 'th' ? 'ไม่สามารถแก้ไขได้' : 'Read-only'})
          </span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Department */}
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              <Building2 className="w-4 h-4 inline mr-2" />
              {i18n.language === 'th' ? 'แผนก' : 'Department'}
            </label>
            <p className="text-gray-900 font-medium">
              {i18n.language === 'th' ? user.department_name_th : user.department_name_en}
            </p>
          </div>

          {/* Hire Date */}
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              <Calendar className="w-4 h-4 inline mr-2" />
              {i18n.language === 'th' ? 'วันที่เริ่มงาน' : 'Hire Date'}
            </label>
            <p className="text-gray-900 font-medium">
              {user.hire_date
                ? new Date(user.hire_date).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-US')
                : '-'
              }
            </p>
          </div>

          {/* Scan Code */}
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              <IdCard className="w-4 h-4 inline mr-2" />
              {i18n.language === 'th' ? 'รหัสสแกน' : 'Scan Code'}
            </label>
            <p className="text-gray-900 font-mono font-medium">{user.scan_code || '-'}</p>
          </div>

          {/* Employee Code */}
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              <IdCard className="w-4 h-4 inline mr-2" />
              {i18n.language === 'th' ? 'รหัสพนักงาน' : 'Employee Code'}
            </label>
            <p className="text-gray-900 font-mono font-medium">{user.employee_code}</p>
          </div>
        </div>
      </div>

      {/* Leave Balance Summary */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          {i18n.language === 'th' ? 'สรุปวันลา' : 'Leave Balance Summary'}
        </h2>

        {loadingBalances ? (
          <div className="text-center py-8 text-gray-500">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            {i18n.language === 'th' ? 'กำลังโหลด...' : 'Loading...'}
          </div>
        ) : leaveBalances.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leaveBalances.map((balance, index) => {
              const isUnlimited = balance.remaining_days === Infinity;
              return (
                <div key={index} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                  <h3 className="font-semibold text-gray-900 mb-3">{balance.leave_type}</h3>
                  <div className="space-y-2 text-sm">
                    {isUnlimited ? (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">
                            {i18n.language === 'th' ? 'ลาไปแล้ว:' : 'Days Taken:'}
                          </span>
                          <span className="font-bold text-blue-600">{balance.used_days} {i18n.language === 'th' ? 'วัน' : 'days'}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-blue-300">
                          <span className="text-gray-700 font-medium">
                            {i18n.language === 'th' ? 'คงเหลือ:' : 'Remaining:'}
                          </span>
                          <span className="font-bold text-green-600 text-lg">
                            {i18n.language === 'th' ? 'ไม่จำกัด' : 'Unlimited'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">
                            {i18n.language === 'th' ? 'ทั้งหมด:' : 'Total:'}
                          </span>
                          <span className="font-bold text-gray-900">{balance.total_days} {i18n.language === 'th' ? 'วัน' : 'days'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">
                            {i18n.language === 'th' ? 'ใช้ไป:' : 'Used:'}
                          </span>
                          <span className="font-bold text-red-600">{balance.used_days} {i18n.language === 'th' ? 'วัน' : 'days'}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-blue-300">
                          <span className="text-gray-700 font-medium">
                            {i18n.language === 'th' ? 'คงเหลือ:' : 'Remaining:'}
                          </span>
                          <span className="font-bold text-green-600 text-lg">{balance.remaining_days} {i18n.language === 'th' ? 'วัน' : 'days'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            {i18n.language === 'th' ? 'ไม่มีข้อมูลวันลา' : 'No leave balance data'}
          </div>
        )}
      </div>

      {/* Security Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-red-600" />
          {i18n.language === 'th' ? 'ความปลอดภัย' : 'Security'}
        </h2>

        <button
          onClick={() => setShowPasswordModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Key className="w-4 h-4" />
          {i18n.language === 'th' ? 'เปลี่ยนรหัสผ่าน' : 'Change Password'}
        </button>
      </div>

      {/* LINE Account */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <MessageCircleMore className="w-5 h-5 text-green-600" />
              {i18n.language === 'th' ? 'บัญชี LINE' : 'LINE Account'}
            </h2>
            <p className="text-sm text-gray-500">
              {i18n.language === 'th'
                ? 'ใช้สำหรับผูก LINE ของพนักงานเข้ากับบัญชีในระบบ เพื่อเข้าสู่ระบบด้วย LINE ได้'
                : 'Link your employee account with LINE so you can sign in with LINE later.'}
            </p>
          </div>

          <div className="text-sm">
            {loadingLineAccount ? (
              <span className="text-gray-500">
                {i18n.language === 'th' ? 'กำลังตรวจสอบ...' : 'Checking...'}
              </span>
            ) : lineAccountStatus?.linked ? (
              <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">
                {i18n.language === 'th' ? 'เชื่อมแล้ว' : 'Linked'}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
                {i18n.language === 'th' ? 'ยังไม่เชื่อม' : 'Not linked'}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          {loadingLineAccount ? (
            <div className="text-sm text-gray-500">
              {i18n.language === 'th' ? 'กำลังโหลดข้อมูลการเชื่อม LINE...' : 'Loading LINE account details...'}
            </div>
          ) : (
            <>
              {lineAccountStatus?.linked && lineAccountStatus.link ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    {lineAccountStatus.link.pictureUrl ? (
                      <img
                        src={lineAccountStatus.link.pictureUrl}
                        alt="LINE"
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
                        <MessageCircleMore className="h-6 w-6" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-gray-900">
                        {lineAccountStatus.link.lineDisplayName || (i18n.language === 'th' ? 'บัญชี LINE ที่เชื่อมไว้' : 'Linked LINE account')}
                      </div>
                      <div className="text-sm text-gray-500">
                        {lineAccountStatus.link.lineUserIdMasked || '-'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {i18n.language === 'th' ? 'เชื่อมเมื่อ' : 'Linked on'}{' '}
                        {new Date(lineAccountStatus.link.linkedAt).toLocaleString(i18n.language === 'th' ? 'th-TH' : 'en-US')}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleUnlinkLineAccount}
                    disabled={lineActionLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Unlink className="h-4 w-4" />
                    {lineActionLoading
                      ? (i18n.language === 'th' ? 'กำลังดำเนินการ...' : 'Working...')
                      : (i18n.language === 'th' ? 'ยกเลิกการเชื่อม' : 'Unlink')}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-gray-600">
                    {!lineAccountStatus?.enabled
                      ? (lineAccountStatus?.message || (i18n.language === 'th'
                          ? 'ระบบปิดการเชื่อมบัญชี LINE อยู่ในขณะนี้'
                          : 'LINE account linking is currently disabled'))
                      : !lineAccountStatus.ready
                        ? (i18n.language === 'th'
                            ? 'LINE ยังตั้งค่าไม่ครบสำหรับการเชื่อมบัญชี'
                            : 'LINE is not configured yet for account linking')
                        : (i18n.language === 'th'
                            ? 'กดปุ่มด้านล่างเพื่อยืนยันตัวตนกับ LINE และผูกบัญชีเข้ากับพนักงานคนนี้'
                            : 'Use the button below to authenticate with LINE and link it to this employee account.')}
                  </div>

                  <button
                    type="button"
                    onClick={handleLinkLineAccount}
                    disabled={!lineAccountStatus?.ready || lineActionLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    <Link2 className="h-4 w-4" />
                    {lineActionLoading
                      ? (i18n.language === 'th' ? 'กำลังเชื่อม...' : 'Linking...')
                      : (i18n.language === 'th' ? 'เชื่อมบัญชี LINE' : 'Link LINE Account')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <PasswordChangeModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          isForced={false}
          isOwnPassword={true}
        />
      )}
    </div>
  );
}
