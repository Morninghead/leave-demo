import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import { X, Upload, Trash2, FileText, RefreshCw } from 'lucide-react';
import { DatePicker } from '../common/DatePicker';
import { LeaveType } from '../../types/leave';
import { getLeaveTypes, createLeaveRequest } from '../../api/leave';
import { getCompanyHolidays } from '../../api/holidays';
import { checkDuplicateLeaveRequest, DuplicateCheckResponse } from '../../api/leaveDuplicates';
import { ConflictResolutionModal } from './ConflictResolutionModal';
import { uploadToSupabase } from '../../utils/supabaseUpload';
import { useToast } from '../../hooks/useToast'; // ✅ ใช้ hook ที่มีอยู่แล้ว
import api from '../../api/auth';
import type { Holiday } from '../common/DatePicker';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useSettings';

interface LeaveRequestFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function LeaveRequestForm({ onClose, onSuccess }: LeaveRequestFormProps) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast(); // ✅ ใช้ toast hook
  const { user } = useAuth();
  const { settings } = useSettings();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [specialOffDays, setSpecialOffDays] = useState<string[]>([]); // ✅ NEW: Special Off Days
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [conflictCheck, setConflictCheck] = useState<DuplicateCheckResponse | null>(null);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: null as Date | null,
    end_date: null as Date | null,
    reason: '',
    shift_type: 'day' as 'day' | 'night' | 'evening',
    is_half_day: false,
    half_day_period: '',
    is_hourly_leave: false,
    leave_start_time: '',
    leave_end_time: '',
  });

  const [totalMinutes, setTotalMinutes] = useState(0);
  const [totalDays, setTotalDays] = useState(0);

  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState<{ file: File; preview: string }[]>([]);
  const selectedLeaveType = leaveTypes.find((type) => type.id === formData.leave_type_id);
  const requiresAttachment = !!selectedLeaveType?.requires_attachment;
  const isWorkInjuryLeave = (selectedLeaveType?.code || '').toUpperCase() === 'WORK_INJURY';

  // Generate time slots based on shift type (24-hour format)
  // Excludes lunch break: 
  // Day: 12:00-13:00
  // Night: 00:00-01:00
  // Evening: 21:00-22:00
  const getStartTimeSlots = () => {
    if (formData.shift_type === 'day') {
      // กะเช้า: 08:00 - 17:00
      const slots: string[] = [];
      for (let hour = 8; hour <= 16; hour++) {
        if (hour === 12) continue; // Skip 12:00-13:00 break
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
        if (hour < 16) slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
      return slots;
    } else if (formData.shift_type === 'night') {
      // กะดึก: 20:00 - 05:00
      const slots: string[] = [];
      for (let hour = 20; hour <= 23; hour++) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
      for (let hour = 1; hour <= 4; hour++) { // Skip 00:00 break (starts 00:00)
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
        if (hour < 4) slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
      return slots;
    } else { // Evening: 17:00 - 02:00
      // Break: 21:00 - 22:00
      const slots: string[] = [];
      // 17:00 - 20:30
      for (let hour = 17; hour <= 20; hour++) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
      // Resume 22:00 - 01:00 (Max start 01:00 for 1h duration to 02:00)
      for (let hour = 22; hour <= 23; hour++) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
      for (let hour = 0; hour <= 1; hour++) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
        if (hour < 1) slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
      return slots;
    }
  };

  const getAllTimeSlots = () => {
    if (formData.shift_type === 'day') {
      const slots: string[] = [];
      for (let hour = 8; hour <= 17; hour++) {
        if (hour === 12) continue;
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
        if (hour < 17) slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
      return slots;
    } else if (formData.shift_type === 'night') {
      const slots: string[] = [];
      for (let hour = 20; hour <= 23; hour++) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
      for (let hour = 1; hour <= 5; hour++) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
        if (hour < 5) slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
      return slots;
    } else { // Evening shift end times
      const slots: string[] = [];
      // 17:00 - 21:00 (Before break)
      for (let hour = 17; hour <= 21; hour++) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
        if (hour < 21) slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
      // 22:00 - 02:00 (After break)
      for (let hour = 22; hour <= 23; hour++) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
      for (let hour = 0; hour <= 2; hour++) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
        if (hour < 2) slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
      return slots;
    }
  };

  // Get filtered end time slots (must be after start time and duration >= 1 hour)
  const getEndTimeSlots = () => {
    if (!formData.leave_start_time) return getAllTimeSlots();

    const allSlots = getAllTimeSlots();
    const [startHour, startMin] = formData.leave_start_time.split(':').map(Number);
    let startTotalMins = startHour * 60 + startMin;

    // Normalize start time for overnight calculation (Night: 20:00-05:00, Evening: 17:00-02:00)
    if ((formData.shift_type === 'night' && startHour < 20) ||
      (formData.shift_type === 'evening' && startHour < 12)) { // Evening shift crosses midnight (00:00-02:00)
      startTotalMins += 24 * 60;
    }

    return allSlots.filter((slot) => {
      const [endHour, endMin] = slot.split(':').map(Number);
      let endTotalMins = endHour * 60 + endMin;

      // Normalize end time
      if ((formData.shift_type === 'night' && endHour < 20) ||
        (formData.shift_type === 'evening' && endHour < 12)) { // Evening shift crosses midnight (00:00-02:00)
        endTotalMins += 24 * 60;
      }

      if (endTotalMins <= startTotalMins) return false;

      let duration = endTotalMins - startTotalMins;

      // Deduct lunch break
      if (formData.shift_type === 'day') {
        const lunchStart = 12 * 60; // 12:00
        const lunchEnd = 13 * 60;   // 13:00
        if (startTotalMins <= lunchStart && endTotalMins >= lunchEnd) duration -= 60;
      } else if (formData.shift_type === 'night') {
        const lunchStart = 24 * 60; // 00:00 (normalized)
        const lunchEnd = 25 * 60;   // 01:00 (normalized)
        if (startTotalMins <= lunchStart && endTotalMins >= lunchEnd) duration -= 60;
      } else { // Evening
        const lunchStart = 21 * 60; // 21:00
        const lunchEnd = 22 * 60;   // 22:00
        if (startTotalMins <= lunchStart && endTotalMins >= lunchEnd) duration -= 60;
      }

      return duration >= 60; // Filter: Minimum 1 hour
    });
  };

  useEffect(() => {
    const loadLeaveTypes = async () => {
      try {
        const types = await getLeaveTypes();
        setLeaveTypes(types);
      } catch (err: any) {
        logger.error('Failed to load leave types:', err);
        // ✅ แสดง toast
        showToast(t('leave.failedToLoadTypes') || 'Failed to load leave types', 'error');
      }
    };

    const loadHolidays = async () => {
      try {
        const currentYear = new Date().getFullYear().toString();
        const nextYear = (new Date().getFullYear() + 1).toString();

        // Load holidays for current and next year to cover date ranges
        const [currentYearHolidays, nextYearHolidays] = await Promise.all([
          getCompanyHolidays(currentYear),
          getCompanyHolidays(nextYear)
        ]);

        setHolidays([...currentYearHolidays, ...nextYearHolidays]);
      } catch (err: any) {
        logger.error('Failed to load holidays:', err);
        // Non-critical, don't show error toast
      }
    };

    const loadOffDays = async () => {
      try {
        // Load off-days for next 12 months
        const today = new Date();
        const future = new Date();
        future.setMonth(future.getMonth() + 12);

        const startDate = today.toISOString().split('T')[0];
        const endDate = future.toISOString().split('T')[0];

        // Call API to get off-days for current user (handled by backend token)
        // If the backend requires employee_id, we might need to get it first.
        // Assuming /employee-off-days works for "me" or accepts no param for current user,
        // OR we need to pass the user ID if we have it.
        // Since we don't have user ID in props, we'll try fetching without it (if backend supports)
        // or check if we can get it.
        // Actually best to look at ShiftSwapForm usage: `api.get(/employee-off-days?employee_id=...)`
        // We lack employee_id in this context.
        // However, usually GET /employee-off-days without param might return for current user or we can use /me first.
        // Let's assume there is an endpoint or we can get user profile.
        // Safest approach: Fetch profile or use a "my-off-days" if available.
        // If not available, we might skip this or try passing empty employee_id if backend defaults to self.
        // Checking API: ShiftSwapForm passes employee_id.
        // Let's try to get profile first.
        const profileRes = await api.get('/auth/me').catch(() => null);
        if (profileRes?.data?.user?.id) {
          const response = await api.get(`/employee-off-days?employee_id=${profileRes.data.user.id}&start_date=${startDate}&end_date=${endDate}`);
          const offDates = (response.data.off_days || []).map((od: any) => od.off_date);
          setSpecialOffDays(offDates);
        }
      } catch (err) {
        console.error('Failed to load off days:', err);
      }
    };

    loadLeaveTypes();
    loadHolidays();
    loadOffDays(); // ✅ Load special off-days
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ NEW: Calculate Total Days for Standard Leave (Non-Hourly)
  useEffect(() => {
    if (!formData.is_hourly_leave && formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      let days = 0;
      const current = new Date(start);

      // Reset time to midnight for accurate comparison
      current.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      while (current <= end) {
        const dateStr = toLocalDateString(current);
        const dayOfWeek = current.getDay();
        const isSunday = dayOfWeek === 0;

        // Check if holiday
        const isHoliday = holidays.some(h => h.holiday_date === dateStr);

        // Check if special off-day
        const isSpecial = specialOffDays.includes(dateStr);

        // Count only if NOT Sunday, NOT Holiday, NOT Special Off Day
        if (!isSunday && !isHoliday && !isSpecial) {
          days += formData.is_half_day ? 0.5 : 1;
        }

        // Move to next day
        current.setDate(current.getDate() + 1);
      }

      setTotalDays(days);
      setTotalMinutes(days * 480); // 8 hours * 60
    }
  }, [formData.start_date, formData.end_date, formData.is_hourly_leave, formData.is_half_day, holidays, specialOffDays]);

  // Reset end time when start time changes
  useEffect(() => {
    if (formData.is_hourly_leave && formData.leave_start_time) {
      const endSlots = getEndTimeSlots();
      // If current end time is not valid anymore, reset it
      if (formData.leave_end_time && !endSlots.includes(formData.leave_end_time)) {
        setFormData(prev => ({ ...prev, leave_end_time: '' }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.leave_start_time, formData.is_hourly_leave]);

  // Calculate minutes and days for hourly leave
  useEffect(() => {
    if (formData.is_hourly_leave && formData.leave_start_time && formData.leave_end_time) {
      try {
        const [startHour, startMin] = formData.leave_start_time.split(':').map(Number);
        const [endHour, endMin] = formData.leave_end_time.split(':').map(Number);

        const startTotal = startHour * 60 + startMin;
        let endTotal = endHour * 60 + endMin;

        // Handle night shift (crosses midnight)
        if (formData.shift_type === 'night') {
          // If end time is earlier than start time, it means it's the next day
          if (endTotal < startTotal) {
            endTotal += 24 * 60; // Add 24 hours
          }
        }

        let minutes = endTotal - startTotal;

        // Apply lunch break deduction for day shift
        if (formData.shift_type === 'day') {
          // Check if the time range spans over lunch break (12:00-13:00)
          const lunchStart = 12 * 60; // 12:00 = 720 minutes
          const lunchEnd = 13 * 60;   // 13:00 = 780 minutes

          // If leave starts before or at lunch break and ends after or at lunch break end
          if (startTotal <= lunchStart && endTotal >= lunchEnd) {
            // Subtract 60 minutes for lunch break
            minutes -= 60;
          }
          // If leave starts during lunch break, treat it as starting after lunch
          else if (startTotal > lunchStart && startTotal < lunchEnd) {
            minutes = endTotal - lunchEnd; // Calculate from lunch end time
          }
          // If leave ends during lunch break, treat it as ending at lunch start
          else if (endTotal > lunchStart && endTotal <= lunchEnd) {
            minutes = lunchStart - startTotal; // Calculate until lunch start time
          }

        }

        if (minutes > 0) {
          setTotalMinutes(minutes);
          // Convert to days: 8 working hours = 1 day (480 minutes = 1 day)
          // 4 hours = 0.5 day (240 minutes = 0.5 day)
          const days = minutes / 480;
          setTotalDays(Math.round(days * 100) / 100); // Round to 2 decimals
        } else {
          setTotalMinutes(0);
          setTotalDays(0);
        }
      } catch {
        setTotalMinutes(0);
        setTotalDays(0);
      }
    } else {
      setTotalMinutes(0);
      setTotalDays(0);
    }
  }, [formData.is_hourly_leave, formData.leave_start_time, formData.leave_end_time, formData.shift_type]);



  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file size (50MB limit)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
    const invalidFiles = files.filter(file => file.size > MAX_FILE_SIZE);

    if (invalidFiles.length > 0) {
      const fileNames = invalidFiles.map(f => f.name).join(', ');
      const fileSizeMB = (invalidFiles[0].size / (1024 * 1024)).toFixed(1);
      showToast(
        `Files too large: ${fileNames}. Maximum size is 50MB, but ${fileSizeMB}MB file(s) detected.`,
        'error'
      );
      // Clear the input
      e.target.value = '';
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    const invalidTypes = files.filter(file => !allowedTypes.includes(file.type));

    if (invalidTypes.length > 0) {
      const fileNames = invalidTypes.map(f => f.name).join(', ');
      showToast(
        `Invalid file types: ${fileNames}. Only images (JPG, PNG, GIF, WebP) and PDF files are allowed.`,
        'error'
      );
      // Clear the input
      e.target.value = '';
      return;
    }

    const newPreviews = files.map((file) => {
      const preview = URL.createObjectURL(file);
      return { file, preview };
    });

    setAttachments((prev) => [...prev, ...files]);
    setAttachmentPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeAttachment = (index: number) => {
    URL.revokeObjectURL(attachmentPreviews[index].preview);
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setAttachmentPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // Helper function to convert Date to local date string (YYYY-MM-DD) without timezone shift
  const toLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Check for duplicate/overlapping leave requests
  const checkForConflicts = async () => {
    if (!formData.start_date || !formData.end_date) {
      setConflictCheck(null);
      return;
    }

    setCheckingConflicts(true);
    try {
      // ✅ FIX: Use toLocalDateString instead of toISOString to avoid UTC timezone shift
      // toISOString() converts to UTC which can shift the date by 1 day in Bangkok timezone
      const checkData = {
        start_date: toLocalDateString(formData.start_date),
        end_date: toLocalDateString(formData.end_date),
        is_half_day: formData.is_half_day,
        half_day_period: formData.half_day_period as 'morning' | 'afternoon' | 'first_half' | 'second_half',
        is_hourly_leave: formData.is_hourly_leave,
        leave_start_time: formData.leave_start_time,
        leave_end_time: formData.leave_end_time
      };

      const result = await checkDuplicateLeaveRequest(checkData);
      setConflictCheck(result);

      if (result.hasConflict) {
        setShowConflictModal(true);
      }
    } catch (error: any) {
      logger.error('Error checking for conflicts:', error);
      // Don't show error to user, just log it
    } finally {
      setCheckingConflicts(false);
    }
  };

  // Check conflicts when dates change
  useEffect(() => {
    if (formData.start_date && formData.end_date) {
      const timer = setTimeout(() => {
        checkForConflicts();
      }, 500); // Debounce to avoid too many API calls
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.start_date, formData.end_date, formData.is_hourly_leave, formData.leave_start_time, formData.leave_end_time]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // ✅ Validation
      if (!formData.reason || formData.reason.trim() === '') {
        showToast(t('leave.pleaseProvideReason') || 'Please provide a reason', 'error');
        setLoading(false);
        return;
      }

      if (!formData.leave_type_id || !formData.start_date || !formData.end_date) {
        showToast(t('leave.fillRequired') || 'Please fill in all required fields', 'error');
        setLoading(false);
        return;
      }

      if (requiresAttachment && attachments.length === 0) {
        showToast(
          i18n.language === 'th'
            ? 'ประเภทการลานี้ต้องแนบใบรับรองแพทย์ทุกครั้ง'
            : 'This leave type requires a medical certificate attachment for every request',
          'error'
        );
        setLoading(false);
        return;
      }

      // Conflict validation is handled by disabled submit button

      // Hourly leave validation
      if (formData.is_hourly_leave) {
        if (formData.start_date.toDateString() !== formData.end_date.toDateString()) {
          showToast(
            i18n.language === 'th'
              ? 'ลาเป็นชั่วโมงต้องเป็นวันเดียวกัน'
              : 'Hourly leave must be on the same day',
            'error'
          );
          setLoading(false);
          return;
        }

        if (!formData.leave_start_time || !formData.leave_end_time) {
          showToast(
            i18n.language === 'th'
              ? 'กรุณาระบุเวลาเริ่มและเวลาสิ้นสุด'
              : 'Please specify start and end time',
            'error'
          );
          setLoading(false);
          return;
        }

        if (totalMinutes < 60) {
          showToast(
            i18n.language === 'th'
              ? 'ลาเป็นชั่วโมงต้องไม่น้อยกว่า 1 ชั่วโมง'
              : 'Hourly leave must be at least 1 hour',
            'error'
          );
          setLoading(false);
          return;
        }
      }

      // Half-day validation
      if (formData.is_half_day && !formData.is_hourly_leave) {
        if (formData.start_date.toDateString() !== formData.end_date.toDateString()) {
          showToast(t('leave.halfDaySameDate') || 'Half-day leave must be on the same day', 'error');
          setLoading(false);
          return;
        }

        if (!formData.half_day_period) {
          showToast(t('leave.selectPeriod') || 'Please select half-day period', 'error');
          setLoading(false);
          return;
        }
      }

      // Upload attachments
      let uploadedUrls: string[] = [];
      if (attachments.length > 0) {
        setUploading(true);
        try {
          uploadedUrls = await Promise.all(
            attachments.map((file) => uploadToSupabase(file, 'leave-attachments'))
          );
        } catch (uploadErr: any) {
          logger.error('Upload error:', uploadErr);
          // Show the actual error message from the upload function
          const errorMessage = uploadErr?.message || t('leave.uploadFailed') || 'Failed to upload attachments';
          showToast(errorMessage, 'error');
          setUploading(false);
          setLoading(false);
          return;
        }
        setUploading(false);
      }

      // Prepare request data (using component-level toLocalDateString)
      const requestData = {
        leave_type_id: formData.leave_type_id,
        start_date: toLocalDateString(formData.start_date),
        end_date: toLocalDateString(formData.end_date),
        reason: formData.reason,
        attachment_urls: uploadedUrls,
        is_hourly_leave: formData.is_hourly_leave,
        leave_minutes: formData.is_hourly_leave ? totalMinutes : undefined,
        leave_start_time: formData.is_hourly_leave ? formData.leave_start_time : undefined,
        leave_end_time: formData.is_hourly_leave ? formData.leave_end_time : undefined,
        is_half_day: formData.is_hourly_leave ? false : formData.is_half_day,
        half_day_period: formData.is_half_day && !formData.is_hourly_leave ? formData.half_day_period as 'morning' | 'afternoon' | 'first_half' | 'second_half' : null,
        shift_type: formData.shift_type,
      };

      logger.log('📝 Submitting leave request:', requestData);

      await createLeaveRequest(requestData);

      // ✅ Success toast
      showToast(
        t('leave.requestSuccess') || 'Leave request submitted successfully!',
        'success'
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      logger.error('❌ Submit error:', err);

      // ✅ Error toast
      showToast(
        err.message || t('leave.submitFailed') || 'Failed to submit leave request',
        'error'
      );
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] md:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900">{t('leave.request')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading || uploading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form - Added pb-safe for mobile bottom navigation */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}>
          {/* Leave Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('leave.leaveType')} *
            </label>
            <select
              value={formData.leave_type_id}
              onChange={(e) => setFormData({ ...formData, leave_type_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">{t('common.select')}</option>
              {leaveTypes
                .filter((type) => {
                  const isVacation = (type as any).is_annual_leave || type.code === 'VL' || type.code === 'VAC' || type.name_en?.toLowerCase().includes('vacation') || type.name_en?.toLowerCase().includes('annual') || type.name_th?.includes('ลาพักร้อน');

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

                    if (settings?.require_1_year_tenure_for_vacation === true) {
                      let yearsDiff = today.getFullYear() - hireDate.getFullYear();
                      if (
                        today.getMonth() < hireDate.getMonth() ||
                        (today.getMonth() === hireDate.getMonth() && today.getDate() < hireDate.getDate())
                      ) {
                        yearsDiff--;
                      }
                      if (yearsDiff < 1) {
                        return false;
                      }
                    } else {
                      // 119-day probation logic
                      const diffTime = today.getTime() - hireDate.getTime();
                      const daysDiff = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                      if (daysDiff < 119) {
                        return false;
                      }
                    }
                  }

                  // Filter based on hourly leave selection
                  if (formData.is_hourly_leave) {
                    return type.allow_hourly_leave === true;
                  }
                  return true;
                })
                .map((type) => (
                  <option key={type.id} value={type.id}>
                    {i18n.language === 'th' ? type.name_th : type.name_en}
                  </option>
                ))}
            </select>
            {formData.is_hourly_leave && leaveTypes.filter(t => t.allow_hourly_leave).length === 0 && (
              <p className="text-xs text-red-600 mt-1">
                {i18n.language === 'th'
                  ? 'ไม่มีประเภทการลาที่รองรับการลาเป็นชั่วโมง'
                  : 'No leave types support hourly leave'}
              </p>
            )}
            {isWorkInjuryLeave && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {i18n.language === 'th'
                  ? 'ลาประเภทนี้ใช้เก็บสถิติอุบัติเหตุจากการทำงาน และต้องแนบใบรับรองแพทย์ทุกครั้ง ระบบจะไม่หักโควตาลาป่วย 30 วัน'
                  : 'This leave type tracks work-related injury cases and requires a medical certificate every time. It will not deduct the 30-day sick leave quota.'}
              </div>
            )}
          </div>

          {/* Shift Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('leave.shiftType')} *
            </label>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="day"
                  checked={formData.shift_type === 'day'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      shift_type: e.target.value as 'day' | 'night' | 'evening',
                      half_day_period: '',
                      leave_start_time: '',
                      leave_end_time: '',
                    })
                  }
                  className="mr-2"
                />
                <span>{i18n.language === 'th' ? 'กะเช้า (08:00-17:00)' : 'Day Shift (08:00-17:00)'}</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="evening"
                  checked={formData.shift_type === 'evening'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      shift_type: e.target.value as 'day' | 'night' | 'evening',
                      half_day_period: '',
                      leave_start_time: '',
                      leave_end_time: '',
                    })
                  }
                  className="mr-2"
                />
                <span>{i18n.language === 'th' ? 'กะดึก (17:00-02:00)' : 'Night Shift (17:00-02:00)'}</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="night"
                  checked={formData.shift_type === 'night'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      shift_type: e.target.value as 'day' | 'night' | 'evening',
                      half_day_period: '',
                      leave_start_time: '',
                      leave_end_time: '',
                    })
                  }
                  className="mr-2"
                />
                <span>{i18n.language === 'th' ? 'กะดึก (20:00-05:00)' : 'Night Shift (20:00-05:00)'}</span>
              </label>
            </div>
          </div>

          {/* Hourly Leave Option - Moved here next to Shift Type */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {i18n.language === 'th' ? 'ประเภทการลา' : 'Leave Type'}
            </label>
            <div className="space-y-3">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  checked={!formData.is_hourly_leave}
                  onChange={() =>
                    setFormData({
                      ...formData,
                      is_hourly_leave: false,
                      leave_start_time: '',
                      leave_end_time: '',
                      leave_type_id: '',
                    })
                  }
                  className="mr-2"
                />
                <span className="text-sm">
                  {i18n.language === 'th' ? 'ลาเต็มวัน / ครึ่งวัน' : 'Full Day / Half Day'}
                </span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  checked={formData.is_hourly_leave}
                  onChange={() =>
                    setFormData({
                      ...formData,
                      is_hourly_leave: true,
                      is_half_day: false,
                      half_day_period: '',
                      leave_type_id: '',
                    })
                  }
                  className="mr-2"
                />
                <div>
                  <span className="text-sm font-medium text-blue-900">
                    {i18n.language === 'th' ? 'ลาเป็นชั่วโมง' : 'Hourly Leave'}
                  </span>
                  <p className="text-xs text-blue-700 mt-1">
                    {i18n.language === 'th'
                      ? 'ลาเป็นช่วงเวลา (ขั้นต่ำ 1 ชม., 4 ชม. = 0.5 วัน)'
                      : 'Leave by hours (minimum 1 hour, 4 hrs = 0.5 day)'}
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Time Picker for Hourly Leave */}
          {
            formData.is_hourly_leave && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {i18n.language === 'th' ? 'เวลาเริ่ม' : 'Start Time'} *
                    </label>
                    <select
                      value={formData.leave_start_time}
                      onChange={(e) =>
                        setFormData({ ...formData, leave_start_time: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required={formData.is_hourly_leave}
                    >
                      <option value="">
                        {i18n.language === 'th' ? 'เลือกเวลาเริ่ม' : 'Select start time'}
                      </option>
                      {getStartTimeSlots().map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.shift_type === 'day'
                        ? i18n.language === 'th'
                          ? 'เวลาเริ่มสูงสุด: 16:30'
                          : 'Max start time: 16:30'
                        : i18n.language === 'th'
                          ? 'เวลาในกะดึก: 20:00-05:00'
                          : 'Night shift: 20:00-05:00'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {i18n.language === 'th' ? 'เวลาสิ้นสุด' : 'End Time'} *
                    </label>
                    <select
                      value={formData.leave_end_time}
                      onChange={(e) =>
                        setFormData({ ...formData, leave_end_time: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required={formData.is_hourly_leave}
                      disabled={!formData.leave_start_time}
                    >
                      <option value="">
                        {i18n.language === 'th'
                          ? formData.leave_start_time
                            ? 'เลือกเวลาสิ้นสุด'
                            : 'เลือกเวลาเริ่มก่อน'
                          : formData.leave_start_time
                            ? 'Select end time'
                            : 'Select start time first'}
                      </option>
                      {getEndTimeSlots().map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                    {!formData.leave_start_time && (
                      <p className="text-xs text-gray-500 mt-1">
                        {i18n.language === 'th'
                          ? 'กรุณาเลือกเวลาเริ่มก่อน'
                          : 'Please select start time first'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Duration Display */}
                {totalMinutes > 0 && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-900">
                        {i18n.language === 'th' ? 'ระยะเวลาที่ลา' : 'Leave Duration'}
                      </span>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          {(() => {
                            const finalMinutes = Math.round(totalMinutes);
                            const isExactHour = finalMinutes % 60 === 0;
                            const hours = Math.floor(finalMinutes / 60);
                            const minutes = isExactHour ? 0 : finalMinutes % 60;
                            return `${hours} ${i18n.language === 'th' ? 'ชม.' : 'hr'}${minutes > 0 ? ` ${minutes} ${i18n.language === 'th' ? 'นาที' : 'min'}` : ''}`;
                          })()}
                        </div>
                        <div className="text-xs text-green-700">
                          = {totalDays} {i18n.language === 'th' ? 'วัน' : 'day(s)'} ({totalMinutes}{' '}
                          {i18n.language === 'th' ? 'นาที' : 'minutes'})
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          {i18n.language === 'th'
                            ? '(8 ชม. = 1 วัน, 4 ชม. = 0.5 วัน)'
                            : '(8 hrs = 1 day, 4 hrs = 0.5 day)'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )
          }

          {/* Half Day Checkbox - Only show when NOT hourly leave */}
          {
            !formData.is_hourly_leave && (
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_half_day}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        is_half_day: e.target.checked,
                        half_day_period: '',
                      })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">ลาครึ่งวัน</span>
                </label>
              </div>
            )
          }

          {/* Half Day Period Dropdown */}
          {
            formData.is_half_day && !formData.is_hourly_leave && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('leave.period')} *
                </label>
                <select
                  value={formData.half_day_period}
                  onChange={(e) => setFormData({ ...formData, half_day_period: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required={formData.is_half_day}
                >
                  <option value="">{t('common.select')}</option>
                  {formData.shift_type === 'day' ? (
                    <>
                      <option value="morning">ครึ่งเช้า (08:00-12:00)</option>
                      <option value="afternoon">ครึ่งบ่าย (13:00-17:00)</option>
                    </>
                  ) : (
                    <>
                      <option value="first_half">ช่วงแรก (20:00-00:00)</option>
                      <option value="second_half">ช่วงหลัง (01:00-05:00)</option>
                    </>
                  )}
                </select>
              </div>
            )
          }

          {/* Date Selection - Different for hourly vs regular leave */}
          {
            formData.is_hourly_leave ? (
              // Single date picker for hourly leave
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {i18n.language === 'th' ? 'วันที่' : 'Date'} <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  {i18n.language === 'th'
                    ? 'ลาเป็นชั่วโมงสามารถเลือกได้เพียงวันเดียว'
                    : 'Hourly leave can only be selected for a single day'
                  }
                </p>
                <div className="relative">
                  <DatePicker
                    value={formData.start_date}
                    onChange={(date) => {
                      // For hourly leave, set both start_date and end_date to the same date
                      setFormData({
                        ...formData,
                        start_date: date,
                        end_date: date
                      });
                    }}
                    placeholder={t('date.selectDate')}
                    required
                    holidays={holidays}
                    highlightHolidays={true}
                    specialOffDays={specialOffDays}
                  />
                  {formData.start_date && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          start_date: null,
                          end_date: null,
                        });
                      }}
                      className="absolute top-2 right-2 bg-red-50 hover:bg-red-100 p-1 rounded-full text-red-600"
                      title={i18n.language === 'th' ? 'ลบวันที่เลือก' : 'Clear selected date'}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Date range for regular leave */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('leave.startDate')} *
                    </label>
                    <div className="relative">
                      <DatePicker
                        value={formData.start_date}
                        onChange={(date) => setFormData({ ...formData, start_date: date })}
                        placeholder={t('date.selectDate')}
                        required
                        holidays={holidays}
                        highlightHolidays={true}
                        specialOffDays={specialOffDays}
                      />
                      {formData.start_date && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              start_date: null,
                              end_date: null,
                            });
                          }}
                          className="absolute top-2 right-2 bg-red-50 hover:bg-red-100 p-1 rounded-full text-red-600"
                          title={i18n.language === 'th' ? 'ลบวันที่เลือก' : 'Clear selected date'}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('leave.endDate')} *
                    </label>
                    <div className="relative">
                      <DatePicker
                        value={formData.end_date}
                        onChange={(date) => setFormData({ ...formData, end_date: date })}
                        placeholder={t('date.selectDate')}
                        required
                        minDate={formData.start_date || undefined}
                        holidays={holidays}
                        highlightHolidays={true}
                        specialOffDays={specialOffDays}
                      />
                      {formData.end_date && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              start_date: null,
                              end_date: null,
                            });
                          }}
                          className="absolute top-2 right-2 bg-red-50 hover:bg-red-100 p-1 rounded-full text-red-600"
                          title={i18n.language === 'th' ? 'ลบวันที่เลือก' : 'Clear selected date'}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Duration Display for Standard Leave */}
                {totalDays > 0 && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-900">
                        {i18n.language === 'th' ? 'ระยะเวลาที่ลา' : 'Leave Duration'}
                      </span>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          {totalDays} {i18n.language === 'th' ? 'วัน' : 'day(s)'}
                        </div>
                        <div className="text-xs text-green-700 mt-1">
                          {i18n.language === 'th'
                            ? '(ไม่รวมวันหยุดบริษัท, วันอาทิตย์ และวันหยุดพิเศษ)'
                            : '(Excluding company holidays, Sundays, and special off-days)'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )
          }

          {/* Conflict Warning */}
          {
            conflictCheck && conflictCheck.hasConflict && (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 animate-pulse">
                    <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 7h-2v2H7v-2h2v2zm1-2h2v4H8v-4h2v4zm0-4h2v6H7V7h2v6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-red-800">
                        {i18n.language === 'th' ? '🚫 ไม่สามารถส่งคำขอได้' : '🚫 Cannot Submit Request'}
                      </h3>
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">
                        {i18n.language === 'th' ? 'มีวันที่ซ้ำซ้อน' : 'Conflicting Dates'}
                      </span>
                    </div>
                    <div className="mt-3 text-sm text-red-700 font-medium">
                      {conflictCheck.message}
                    </div>
                    {conflictCheck.conflictingRequests.length > 0 && (
                      <div className="mt-4 bg-red-100 rounded-lg p-3">
                        <p className="text-sm font-semibold text-red-800 mb-3">
                          {i18n.language === 'th' ? '📋 คำขอลาที่ซ้ำซ้อน:' : '📋 Conflicting requests:'}
                        </p>
                        <ul className="text-sm text-red-700 space-y-2">
                          {conflictCheck.conflictingRequests.map((req, index) => (
                            <li key={index} className="flex items-start gap-3 bg-white rounded-md p-2 border border-red-200">
                              <div className="flex-shrink-0 mt-0.5">
                                <svg className="w-4 h-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414-1.414L8.586 10 7.293 8.707a1 1 0 101.414 1.414l2 2a1 1 0 001.414 0l4-4a1 1 0 00-1.414-1.414l-2.293 2.293a1 1 0 00-1.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div className="flex-1">
                                <span className="text-red-700">{req.details}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {conflictCheck.tip && (
                      <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-yellow-600 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h3a1 1 0 001-1v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-xs text-yellow-700 italic">
                              {conflictCheck.tip}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Button state indicator */}
                    <div className="mt-4 flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M15 8a3 3 0 11-6 0 3 3 0 016 0zm-4 2.75a.75.75 0 011.5 0V9a.75.75 0 01-1.5 0V4.5a.75.75 0 01-1.5 0V2.75zM17.5 6a.75.75 0 100-1.5.75.75 0 001.5.75V8a.75.75 0 001.5 0V6a.75.75 0 00-1.5-.75zM7.5 6a.75.75 0 100-1.5.75.75 0 001.5.75V8a.75.75 0 001.5 0V6a.75.75 0 00-1.5-.75z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-red-600 font-medium">
                        {i18n.language === 'th' ? 'ปุ่มปุ่มส่งถูกปิดถู่เหลือก' : 'Submit button is disabled above'}
                      </span>
                    </div>

                    {/* Clear Form Button */}
                    <div className="mt-6 flex justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            leave_type_id: '',
                            shift_type: 'day',
                            start_date: null,
                            end_date: null,
                            reason: '',
                            is_half_day: false,
                            is_hourly_leave: false,
                            half_day_period: '',
                            leave_start_time: '',
                            leave_end_time: ''
                          });
                          setAttachmentPreviews([]);
                          setConflictCheck(null);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md transition-colors duration-200"
                      >
                        <RefreshCw className="w-4 h-4" />
                        {i18n.language === 'th' ? 'เริ่มต้นใหม่ / Clear Form' : 'Start Over / Clear Form'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          }

          {/* Conflict Loading Indicator */}
          {
            checkingConflicts && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V4C8 2.9 9 2 10 2h4c1 0 2 .9 2 2v4c0 1.1-.9 2-2 2H10c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  </svg>
                  <div className="text-sm text-blue-700">
                    {i18n.language === 'th' ? 'กำลังตรวจสอบวันที่ซ้ำซ้อน...' : 'Checking for overlapping dates...'}
                  </div>
                </div>
              </div>
            )
          }

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('leave.reason')} *
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={
                i18n.language === 'th'
                  ? 'ระบุเหตุผลการลา (สามารถเขียนเป็นภาษาไทยหรืออังกฤษก็ได้)'
                  : 'Enter leave reason (You can write in Thai or English)'
              }
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              {i18n.language === 'th'
                ? 'คุณสามารถเขียนเป็นภาษาไทยหรือภาษาอังกฤษก็ได้'
                : 'You can write in Thai or English'}
            </p>
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('leave.attachment')}
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <input
                type="file"
                onChange={handleFileSelect}
                multiple
                accept="image/*,.pdf"
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center cursor-pointer"
              >
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">{t('common.upload')}</span>
              </label>
            </div>

            {/* Preview */}
            {attachmentPreviews.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-4">
                {attachmentPreviews.map((item, index) => {
                  const fileSizeMB = (item.file.size / (1024 * 1024)).toFixed(1);
                  const isLargeFile = item.file.size > 50 * 1024 * 1024;

                  return (
                    <div key={index} className={`relative group ${isLargeFile ? 'ring-2 ring-red-300' : ''}`}>
                      {item.file.type.startsWith('image/') ? (
                        <img
                          src={item.preview}
                          alt={item.file.name}
                          className="w-full h-24 object-cover rounded"
                        />
                      ) : (
                        <div className="w-full h-24 bg-gray-100 rounded flex items-center justify-center">
                          <FileText className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {/* File info */}
                      <div className="mt-1">
                        <p className="text-xs text-gray-600 truncate" title={item.file.name}>
                          {item.file.name}
                        </p>
                        <p className={`text-xs ${isLargeFile ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                          {fileSizeMB} MB
                          {isLargeFile && ' ⚠️'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={loading || uploading}
            >
              {t('common.cancel')}
            </button>
            <div className="relative group">
              <button
                type="submit"
                disabled={loading || uploading || (conflictCheck && conflictCheck.hasConflict) || false}
                className={`px-4 py-2 rounded-md transition-all duration-200 ${conflictCheck && conflictCheck.hasConflict
                  ? 'bg-red-600 text-white hover:bg-red-700 cursor-not-allowed opacity-75'
                  : loading || uploading
                    ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                title={
                  conflictCheck && conflictCheck.hasConflict
                    ? (i18n.language === 'th'
                      ? 'ไม่สามารถส่งคำขอได้: พบวันที่ซ้ำซ้อนกับคำขอที่มีอยู่'
                      : 'Cannot Submit Request: Found Conflicting Dates')
                    : ''
                }
              >
                {conflictCheck && conflictCheck.hasConflict
                  ? i18n.language === 'th' ? 'วันที่ซ้ำซ้อน' : 'Conflicting Dates'
                  : uploading
                    ? t('leave.uploading') || 'Uploading...'
                    : loading
                      ? t('leave.submitting') || 'Submitting...'
                      : t('common.submit')}
              </button>

              {/* Tooltip for disabled state */}
              {conflictCheck && conflictCheck.hasConflict && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block">
                  <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
                    <div className="font-medium mb-1">
                      {i18n.language === 'th' ? 'ไม่สามารถส่งคำขอ' : 'Cannot Submit Request'}
                    </div>
                    <div className="text-gray-300">
                      {i18n.language === 'th'
                        ? 'มีวันที่ซ้ำซ้อน'
                        : 'Conflicting dates found'}
                    </div>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-gray-900"></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form >
      </div >
      {/* Conflict Resolution Modal */}
      {showConflictModal && (
        <ConflictResolutionModal
          isOpen={showConflictModal}
          onClose={() => setShowConflictModal(false)}
          requestedDate={formData.start_date!}
          conflictingRequests={(conflictCheck?.conflictingRequests || []).map(req => ({
            id: req.id,
            employee_name: req.details,
            leave_type_name: req.leave_type_name,
            status: req.status,
            conflict_date: req.dates
          }))}
          suggestions={[]} // TODO: Integrate smart suggestions
          onResolveWithAlternative={async (suggestion: any) => {
            logger.log('Rescheduling with alternative date:', suggestion);
            // TODO: Implement rescheduling logic
          }}
          onContactTeamLeader={async () => {
            logger.log('Contacting team leader for conflict resolution');
            // TODO: Implement team leader notification
          }}
        />
      )}
    </div>
  );
};
