// src/components/settings/FiscalSettingsCard.tsx
// Fiscal year settings card for HR/Admin settings page

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Settings, Save, RefreshCw, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import {
    getFiscalSettings,
    updateFiscalSettings,
    FiscalSettings,
    calculateFiscalYear,
    getFiscalYearDateRange,
    getCycleTypeDisplay
} from '../../api/fiscal';

export function FiscalSettingsCard() {
    const { t, i18n } = useTranslation();
    const { showToast } = useToast();
    const { user } = useAuth();

    const [settings, setSettings] = useState<FiscalSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isDefault, setIsDefault] = useState(true);
    const [hasChanges, setHasChanges] = useState(false);

    // Form state
    const [cycleType, setCycleType] = useState<'day_of_month' | 'calendar' | 'thai_government'>('day_of_month');
    const [cycleStartDay, setCycleStartDay] = useState(26);
    const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(10);

    // Check if user can edit
    const canEdit = user?.role === 'hr' || user?.role === 'admin';

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const response = await getFiscalSettings();
            setSettings(response.settings);
            setIsDefault(response.is_default);

            // Set form state
            setCycleType(response.settings.cycle_type);
            setCycleStartDay(response.settings.cycle_start_day);
            setFiscalYearStartMonth(response.settings.fiscal_year_start_month);
            setHasChanges(false);
        } catch (error) {
            console.error('Failed to load fiscal settings:', error);
            showToast(t('common.error'), 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!canEdit) return;

        try {
            setSaving(true);

            // Generate descriptions
            let descriptionTh = '';
            let descriptionEn = '';

            switch (cycleType) {
                case 'calendar':
                    descriptionTh = 'ปีปฏิทิน (1 มกราคม - 31 ธันวาคม)';
                    descriptionEn = 'Calendar Year (January 1 - December 31)';
                    break;
                case 'thai_government':
                    descriptionTh = `ปีงบประมาณราชการ (1 ${getMonthName(fiscalYearStartMonth, 'th')} - ${getMonthName(fiscalYearStartMonth - 1 || 12, 'th')})`;
                    descriptionEn = `Thai Government Fiscal (${getMonthName(fiscalYearStartMonth, 'en')} 1 - ${getMonthName(fiscalYearStartMonth - 1 || 12, 'en')})`;
                    break;
                case 'day_of_month':
                default:
                    descriptionTh = `รอบการทำงาน วันที่ ${cycleStartDay} - ${cycleStartDay - 1} ของเดือน`;
                    descriptionEn = `Payroll cycle: ${cycleStartDay}th to ${cycleStartDay - 1}th of each month`;
                    break;
            }

            await updateFiscalSettings({
                cycle_type: cycleType,
                cycle_start_day: cycleStartDay,
                fiscal_year_start_month: fiscalYearStartMonth,
                description_th: descriptionTh,
                description_en: descriptionEn,
            });

            showToast(t('settings.saved') || 'Settings saved successfully', 'success');
            setHasChanges(false);
            await loadSettings();
        } catch (error: any) {
            console.error('Failed to save fiscal settings:', error);
            showToast(error.response?.data?.error || t('common.error'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const getMonthName = (month: number, lang: 'th' | 'en'): string => {
        const monthNames = {
            th: ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'],
            en: ['', 'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'],
        };
        return monthNames[lang][month] || '';
    };

    // Calculate current fiscal year preview
    const currentFiscalYear = settings ? calculateFiscalYear(new Date(), {
        ...settings,
        cycle_type: cycleType,
        cycle_start_day: cycleStartDay,
        fiscal_year_start_month: fiscalYearStartMonth,
    }) : 2026;

    const fiscalRange = settings ? getFiscalYearDateRange(currentFiscalYear, {
        ...settings,
        cycle_type: cycleType,
        cycle_start_day: cycleStartDay,
        fiscal_year_start_month: fiscalYearStartMonth,
    }) : null;

    const formatPreviewDate = (date: Date): string => {
        return date.toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Calendar className="w-6 h-6" />
                        <div>
                            <h3 className="text-lg font-semibold">
                                {i18n.language === 'th' ? 'ตั้งค่าปีการทำงาน (Fiscal Year)' : 'Fiscal Year Settings'}
                            </h3>
                            <p className="text-sm text-indigo-100">
                                {i18n.language === 'th' ? 'กำหนดรอบการคำนวณวันลาและสถิติต่างๆ' : 'Configure leave calculation and statistics period'}
                            </p>
                        </div>
                    </div>
                    {!canEdit && (
                        <span className="px-3 py-1 bg-white/20 rounded-full text-xs">
                            {i18n.language === 'th' ? 'ดูอย่างเดียว' : 'View Only'}
                        </span>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
                {/* Info Banner */}
                {isDefault && (
                    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm text-amber-800 font-medium">
                                {i18n.language === 'th' ? 'ใช้ค่าเริ่มต้นของระบบ' : 'Using System Defaults'}
                            </p>
                            <p className="text-xs text-amber-600 mt-1">
                                {i18n.language === 'th'
                                    ? 'ยังไม่ได้บันทึกการตั้งค่า กรุณากดบันทึกเพื่อยืนยันการตั้งค่า'
                                    : 'Settings not saved yet. Please save to confirm.'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Cycle Type Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {i18n.language === 'th' ? 'รูปแบบรอบการทำงาน' : 'Fiscal Cycle Type'}
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                            { value: 'day_of_month', labelTh: 'รอบเงินเดือน (กำหนดวัน)', labelEn: 'Payroll (Day of Month)' },
                            { value: 'calendar', labelTh: 'ปีปฏิทิน', labelEn: 'Calendar Year' },
                            { value: 'thai_government', labelTh: 'ปีงบประมาณราชการ', labelEn: 'Thai Government FY' },
                        ].map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                disabled={!canEdit}
                                onClick={() => {
                                    setCycleType(option.value as typeof cycleType);
                                    setHasChanges(true);
                                }}
                                className={`
                  p-4 rounded-lg border-2 text-left transition-all
                  ${cycleType === option.value
                                        ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'}
                  ${!canEdit ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                `}
                            >
                                <div className="flex items-center gap-2">
                                    {cycleType === option.value && <CheckCircle className="w-4 h-4 text-indigo-600" />}
                                    <span className={`font-medium ${cycleType === option.value ? 'text-indigo-700' : 'text-gray-700'}`}>
                                        {i18n.language === 'th' ? option.labelTh : option.labelEn}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Day of Month Setting (only for day_of_month type) */}
                {cycleType === 'day_of_month' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {i18n.language === 'th' ? 'วันเริ่มต้นรอบ' : 'Cycle Start Day'}
                        </label>
                        <div className="flex items-center gap-3">
                            <select
                                value={cycleStartDay}
                                onChange={(e) => {
                                    setCycleStartDay(parseInt(e.target.value));
                                    setHasChanges(true);
                                }}
                                disabled={!canEdit}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                            >
                                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                                    <option key={day} value={day}>
                                        {i18n.language === 'th' ? `วันที่ ${day}` : `Day ${day}`}
                                    </option>
                                ))}
                            </select>
                            <span className="text-sm text-gray-500">
                                {i18n.language === 'th'
                                    ? `รอบจะเริ่มวันที่ ${cycleStartDay} และสิ้นสุดวันที่ ${cycleStartDay - 1} ของเดือนถัดไป`
                                    : `Cycle runs from ${cycleStartDay}th to ${cycleStartDay - 1}th of next month`}
                            </span>
                        </div>
                    </div>
                )}

                {/* Fiscal Year Start Month (only for thai_government type) */}
                {cycleType === 'thai_government' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {i18n.language === 'th' ? 'เดือนเริ่มต้นปีงบประมาณ' : 'Fiscal Year Start Month'}
                        </label>
                        <select
                            value={fiscalYearStartMonth}
                            onChange={(e) => {
                                setFiscalYearStartMonth(parseInt(e.target.value));
                                setHasChanges(true);
                            }}
                            disabled={!canEdit}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                <option key={month} value={month}>
                                    {getMonthName(month, i18n.language === 'th' ? 'th' : 'en')}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Preview */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 mb-3">
                        <Info className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">
                            {i18n.language === 'th' ? 'ตัวอย่างการคำนวณ' : 'Calculation Preview'}
                        </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-gray-500">
                                {i18n.language === 'th' ? 'ปีการทำงานปัจจุบัน:' : 'Current Fiscal Year:'}
                            </span>
                            <span className="ml-2 font-semibold text-indigo-600">
                                {i18n.language === 'th' ? currentFiscalYear + 543 : currentFiscalYear}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-500">
                                {i18n.language === 'th' ? 'ช่วงเวลา:' : 'Period:'}
                            </span>
                            <span className="ml-2 font-medium text-gray-700">
                                {fiscalRange && `${formatPreviewDate(fiscalRange.start)} - ${formatPreviewDate(fiscalRange.end)}`}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Last Updated Info */}
                {settings?.updated_at && !isDefault && (
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                        <Settings className="w-3 h-3" />
                        {i18n.language === 'th' ? 'แก้ไขล่าสุด:' : 'Last updated:'} {new Date(settings.updated_at).toLocaleString()}
                        {settings.updated_by_name_th && ` โดย ${settings.updated_by_name_th}`}
                    </div>
                )}

                {/* Save Button */}
                {canEdit && (
                    <div className="flex justify-end pt-4 border-t border-gray-200">
                        <button
                            onClick={handleSave}
                            disabled={saving || !hasChanges}
                            className={`
                flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all
                ${hasChanges && !saving
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
              `}
                        >
                            {saving ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    {i18n.language === 'th' ? 'กำลังบันทึก...' : 'Saving...'}
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    {i18n.language === 'th' ? 'บันทึกการตั้งค่า' : 'Save Settings'}
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

