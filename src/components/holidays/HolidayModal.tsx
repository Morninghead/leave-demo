import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Calendar, Clock, Plus, Trash2 } from 'lucide-react';
import { DatePicker } from '../common/DatePicker';

export interface HolidayFormData {
  holiday_date: string;
  name_th: string;
  name_en: string;
  holiday_type: 'company' | 'public' | 'religious';
  departments?: string[];
  notify_days_before?: number;
  notification_message?: string;
  location?: string;
  notes?: string;
}

export interface HolidayItem {
  date: Date;
  name_th: string;
  name_en: string;
}

export interface Holiday {
  id: string;
  holiday_date: string;
  name_th: string;
  name_en: string;
  holiday_type: 'company' | 'public' | 'religious';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by_name_th?: string;
  created_by_name_en?: string;
  notes?: string;
  location?: string;
  notify_days_before?: number;
  notification_message?: string;
}

interface HolidayModalProps {
  holiday: Holiday | null;
  onClose: () => void;
  onSubmit: (data: HolidayFormData) => Promise<void>;
}

export function HolidayModal({ holiday, onClose, onSubmit }: HolidayModalProps) {
  const { i18n } = useTranslation();
  const [holidayItems, setHolidayItems] = useState<HolidayItem[]>([
    { date: new Date(), name_th: '', name_en: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper function to convert Date to local date string (YYYY-MM-DD) without timezone shift
  const toLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper functions for holiday item management
  const addHolidayItem = () => {
    setHolidayItems([...holidayItems, { date: new Date(), name_th: '', name_en: '' }]);
  };

  const removeHolidayItem = (index: number) => {
    if (holidayItems.length > 1) {
      const newItems = holidayItems.filter((_, i) => i !== index);
      setHolidayItems(newItems);
    }
  };

  const updateHolidayDate = (index: number, date: Date | null) => {
    const newItems = [...holidayItems];
    newItems[index] = { ...newItems[index], date: date || new Date() };
    setHolidayItems(newItems);
  };

  const updateHolidayName = (index: number, field: 'name_th' | 'name_en', value: string) => {
    const newItems = [...holidayItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setHolidayItems(newItems);
  };

  const getValidHolidayItems = (): HolidayItem[] => {
    return holidayItems.filter(item =>
      item.date &&
      item.name_th.trim() &&
      item.name_en.trim()
    );
  };

  // Initialize form data when editing
  useEffect(() => {
    if (holiday) {
      setHolidayItems([{
        date: new Date(holiday.holiday_date),
        name_th: holiday.name_th,
        name_en: holiday.name_en
      }]);
    }
  }, [holiday]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    const validItems = getValidHolidayItems();
    if (validItems.length === 0) {
      setError(i18n.language === 'th' ? 'กรุณาระบุข้อมูลที่จำเป็น' : 'Please fill in required fields');
      return;
    }

    // Check for incomplete items
    const incompleteItems = holidayItems.some(item => !item.date || !item.name_th.trim() || !item.name_en.trim());
    if (incompleteItems) {
      setError(i18n.language === 'th' ? 'กรุณากรอกข้อมูลให้ครบทุกช่อง' : 'Please fill in all required fields for each holiday');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Submit each holiday item
      for (const item of validItems) {
        const submitData: HolidayFormData = {
          holiday_date: toLocalDateString(item.date),
          name_th: item.name_th,
          name_en: item.name_en,
          holiday_type: 'company'
        };
        await onSubmit(submitData);
      }

      onClose();
    } catch (err: any) {
      console.error('Failed to save holiday:', err);
      setError(err.message || 'Failed to save holiday');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {holiday ? (i18n.language === 'th' ? 'แก้ไขวันหยุดประจำปี' : 'Edit Holiday') : (i18n.language === 'th' ? 'เพิ่มวันหยุดประจำปี' : 'Add Holidays')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            {/* Holiday Items List */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-medium text-gray-700">
                  {i18n.language === 'th' ? 'รายการวันหยุด' : 'Holiday List'} <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={addHolidayItem}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {i18n.language === 'th' ? 'เพิ่มวันหยุด' : 'Add Holiday'}
                </button>
              </div>

              {/* Holiday Items */}
              <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {holidayItems.map((item, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="shrink-0 w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {i18n.language === 'th' ? 'วันหยุดที่' : 'Holiday'} {index + 1}
                        </span>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeHolidayItem(index)}
                        disabled={holidayItems.length === 1}
                        className="shrink-0 p-1 text-red-600 hover:bg-red-50 rounded transition-colors disabled:text-gray-400 disabled:hover:bg-transparent"
                        title={i18n.language === 'th' ? 'ลบวันหยุด' : 'Remove holiday'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Date Picker */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {i18n.language === 'th' ? 'วันที่' : 'Date'} <span className="text-red-500">*</span>
                      </label>
                      <DatePicker
                        value={item.date}
                        onChange={(date) => updateHolidayDate(index, date)}
                        placeholder={i18n.language === 'th' ? 'เลือกวันที่' : 'Select date'}
                        showYearDropdown
                        showMonthDropdown
                      />
                    </div>

                    {/* Names */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {i18n.language === 'th' ? 'ชื่อ (ไทย)' : 'Name (Thai)'} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={item.name_th}
                          onChange={(e) => updateHolidayName(index, 'name_th', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          placeholder={i18n.language === 'th' ? 'เช่น วันสงกรานต์' : 'e.g., Songkran'}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {i18n.language === 'th' ? 'ชื่อ (อังกฤษ)' : 'Name (English)'} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={item.name_en}
                          onChange={(e) => updateHolidayName(index, 'name_en', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          placeholder={i18n.language === 'th' ? 'เช่น Songkran' : 'e.g., Songkran'}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            {holidayItems.length > 1 && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm font-medium text-green-800 mb-2">
                  {i18n.language === 'th' ? 'สรุปรายการวันหยุด' : 'Holiday Summary'}
                </div>
                <div className="text-sm text-green-700">
                  <div>
                    {i18n.language === 'th' ? 'จำนวนรายการทั้งหมด: ' : 'Total items: '}
                    <span className="font-bold">{holidayItems.length}</span>
                  </div>
                  <div>
                    {i18n.language === 'th' ? 'รายการที่สมบูรณ์: ' : 'Complete items: '}
                    <span className="font-bold">{getValidHolidayItems().length}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Preview */}
            {getValidHolidayItems().length > 0 && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-medium text-blue-800 mb-3">
                  {i18n.language === 'th' ? 'วันหยุดที่จะเพิ่ม:' : 'Holidays to be added:'}
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {getValidHolidayItems().map((item, index) => (
                    <div key={index} className="text-sm text-blue-700">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4" />
                        <span className="font-medium">
                          {item.date.toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </span>
                        <span className="text-gray-500">
                          ({item.date.toLocaleDateString('en-GB', { weekday: 'short' })})
                        </span>
                      </div>
                      <div className="ml-6">
                        <div>🇹🇭 {item.name_th}</div>
                        <div>🇬🇧 {item.name_en}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {i18n.language === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {i18n.language === 'th' ? 'กำลังบันทึก...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    <Clock className="w-5 h-5" />
                    {holiday ? (i18n.language === 'th' ? 'อัปเดตวันหยุด' : 'Update Holiday') : (i18n.language === 'th' ? 'เพิ่มวันหยุด' : 'Add Holidays')}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

