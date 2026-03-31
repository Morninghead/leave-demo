import { forwardRef } from 'react';
import ReactDatePicker from 'react-datepicker';
import { Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { th, enUS } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import './DatePicker.css';
import { isHolidayDate, toLocalDateString } from '../../utils/dateUtils';

export interface Holiday {
  id: string;
  holiday_date: string;
  name_th: string;
  name_en: string;
  holiday_type: 'company' | 'public' | 'religious';
  is_active: boolean;
}

export interface CalendarConflictData {
  date: string;
  status: 'available' | 'partial_conflict' | 'full_conflict';
  conflictType?: 'pending_leave' | 'approved_leave' | 'holiday' | 'weekend' | 'past_date';
  conflictDetails?: {
    employeeName: string;
    leaveType: string;
    status: string;
  }[];
  tooltipMessage?: string;
}

interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  required?: boolean;
  disabled?: boolean;
  holidays?: Holiday[];
  highlightHolidays?: boolean;
  conflictData?: CalendarConflictData[];  // NEW: Conflict data for calendar
  showConflictDetails?: boolean;           // NEW: Show conflict tooltips
  blockConflicts?: boolean;                // NEW: Prevent conflict date selection
  disabledDates?: string[];                // NEW: Array of date strings (YYYY-MM-DD) to disable
  specialOffDays?: string[];               // NEW: Array of special off-days (YYYY-MM-DD) to highlight
  showYearDropdown?: boolean;
  showMonthDropdown?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'dd/mm/yyyy',
  minDate,
  maxDate,
  required = false,
  disabled = false,
  holidays = [],
  highlightHolidays = true,
  conflictData = [],
  showConflictDetails = true,
  blockConflicts = false,
  disabledDates = [],
  specialOffDays = [],
  showYearDropdown = false,
  showMonthDropdown = false,
}: DatePickerProps) {
  const { i18n } = useTranslation();

  // Helper to format date for display (handles Thai year)
  const getDisplayDate = (date: Date | null): string => {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    let year = date.getFullYear();

    // Thai Year Conversion: Add 543
    if (i18n.language === 'th') {
      year += 543;
    }

    return `${day}/${month}/${year}`;
  };

  interface CustomInputProps {
    onClick?: () => void;
    value?: string;
  }

  const CustomInput = forwardRef<HTMLInputElement, CustomInputProps>(({ onClick }, ref) => (
    <div className="relative">
      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10" />
      <input
        ref={ref}
        value={getDisplayDate(value)} // Use custom formatted date
        onClick={onClick}
        placeholder={placeholder}
        readOnly
        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
        required={required}
        disabled={disabled}
      />
    </div>
  ));

  // Check if date is a holiday (any type)
  const isHoliday = (date: Date): boolean => {
    if (!highlightHolidays || holidays.length === 0) return false;
    return holidays.some(h => isHolidayDate(date, h.holiday_date));
  };

  // Check if date has conflicts
  // ✅ FIX: Use toLocalDateString instead of toISOString to avoid timezone shift
  const getDateConflict = (date: Date): CalendarConflictData | null => {
    if (!conflictData || conflictData.length === 0) return null;

    const dateStr = toLocalDateString(date);
    return conflictData.find(conflict => conflict.date === dateStr) || null;
  };

  // Check if date is in the past - disabled to allow past date selection
  // const isPastDate = (date: Date): boolean => {
  //   const today = new Date();
  //   today.setHours(0, 0, 0, 0); // Set to start of day for fair comparison
  //   const compareDate = new Date(date);
  //   compareDate.setHours(0, 0, 0, 0);
  //   return compareDate < today;
  // };

  // Check if date is a weekend
  const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday = 0, Saturday = 6
  };

  // Check if date is in disabled dates list
  const isDisabledDate = (date: Date): boolean => {
    if (!disabledDates || disabledDates.length === 0) return false;
    const dateStr = toLocalDateString(date);
    return disabledDates.includes(dateStr);
  };

  // Check if date is a special off-day
  const isSpecialOffDay = (date: Date): boolean => {
    if (!specialOffDays || specialOffDays.length === 0) return false;
    const dateStr = toLocalDateString(date);
    return specialOffDays.includes(dateStr);
  };

  // Enhanced day className with conflict handling
  const getDayClassName = (date: Date): string => {
    const classes = [];

    // Check for disabled dates first
    if (isDisabledDate(date)) classes.push('disabled-date');

    // Check for conflicts first
    const conflict = getDateConflict(date);
    if (conflict) {
      classes.push(`conflict-${conflict.status}`);
      classes.push(`conflict-type-${conflict.conflictType}`);
    }

    // Check for other date conditions
    if (isHoliday(date)) classes.push('holiday-date');
    if (isSpecialOffDay(date)) classes.push('special-off-day'); // ✅ Added
    // Disabled past date detection to allow selection
    // if (isPastDate(date)) classes.push('past-date');
    if (isWeekend(date)) classes.push('weekend-date');

    return classes.join(' ');
  };

  // Handle date selection with conflict blocking
  const handleDateChange = (date: Date | null) => {
    if (!date) {
      onChange(date);
      return;
    }

    // Check if date selection is blocked
    if (blockConflicts && getDateConflict(date)?.status === 'full_conflict') {
      return; // Prevent selection of fully conflicted dates
    }

    onChange(date);
  };

  // Generate range of years for dropdown
  const years = Array.from({ length: 121 }, (_, i) => new Date().getFullYear() - 100 + i); // 100 years back, 20 years forward
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(2000, i, 1);
    return d.toLocaleString(i18n.language === 'th' ? 'th-TH' : 'en-US', { month: 'long' });
  });

  return (
    <ReactDatePicker
      selected={value}
      onChange={handleDateChange}
      dateFormat="dd/MM/yyyy"
      minDate={minDate}
      maxDate={maxDate}
      customInput={<CustomInput />}
      disabled={disabled}
      showPopperArrow={false}
      popperPlacement="bottom-start"
      dayClassName={getDayClassName}
      title={showConflictDetails ? ((date: Date) => {
        const conflict = getDateConflict(date);
        return conflict?.tooltipMessage || '';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any : undefined}
      openToDate={value || new Date()} // Ensure calendar opens to a selectable date
      filterDate={(date) => !isDisabledDate(date)} // Prevent disabled date selection
      locale={i18n.language === 'th' ? th : enUS}
      renderCustomHeader={({
        date,
        changeYear,
        changeMonth,
        decreaseMonth,
        increaseMonth,
        prevMonthButtonDisabled,
        nextMonthButtonDisabled,
      }) => (
        <div className="flex items-center justify-between px-2 py-2">
          <button
            onClick={decreaseMonth}
            disabled={prevMonthButtonDisabled}
            type="button"
            className={`p-1 hover:bg-gray-100 rounded-full ${prevMonthButtonDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {"<"}
          </button>

          <div className="font-bold text-gray-700 flex gap-2">
            {showMonthDropdown ? (
              <select
                value={date.getMonth()}
                onChange={({ target: { value } }) => changeMonth(parseInt(value))}
                className="p-1 border rounded text-sm bg-white cursor-pointer"
              >
                {months.map((option, index) => (
                  <option key={option} value={index}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <span>{date.toLocaleString(i18n.language === 'th' ? 'th-TH' : 'en-US', { month: 'long' })}</span>
            )}

            {showYearDropdown ? (
              <select
                value={date.getFullYear()}
                onChange={({ target: { value } }) => changeYear(parseInt(value))}
                className="p-1 border rounded text-sm bg-white cursor-pointer"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {i18n.language === 'th' ? year + 543 : year}
                  </option>
                ))}
              </select>
            ) : (
              <span>{i18n.language === 'th' ? date.getFullYear() + 543 : date.getFullYear()}</span>
            )}
          </div>

          <button
            onClick={increaseMonth}
            disabled={nextMonthButtonDisabled}
            type="button"
            className={`p-1 hover:bg-gray-100 rounded-full ${nextMonthButtonDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {">"}
          </button>
        </div>
      )}
    />
  );
}
