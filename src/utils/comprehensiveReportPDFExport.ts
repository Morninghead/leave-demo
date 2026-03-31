/**
 * Comprehensive Leave & Shift Report PDF Export Utility
 *
 * Generates professional PDF reports with signature sections
 * for labor law compliance documentation
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addThaiFont, setThaiFont, addThaiText } from './pdfFonts';

interface PDFSignatureSection {
  label: string;
  name?: string;
  position?: string;
  showDate: boolean;
  showAcknowledgment?: boolean;
}

interface PDFOptions {
  title: string;
  subtitle?: string;
  reportType: 'individual' | 'department' | 'company-wide';
  dateRange: {
    start: string;
    end: string;
  };
  generatedBy: string;
  documentNumber?: string;
  signatures: PDFSignatureSection[];
  language?: 'th' | 'en';
}

interface LeaveRecord {
  date: string;
  leave_type: string;
  duration: string;
  status: string;
  reason?: string;
  is_shift_swap?: boolean;
}

interface EmployeeData {
  employee_code: string;
  employee_name: string;
  department?: string;
  position?: string;
  records?: LeaveRecord[]; // Optional - for detailed reports
  // Summary fields (when records not provided)
  leave?: number;
  shift?: number;
  total?: number;
}

interface DepartmentData {
  department_name: string;
  department_code?: string;
  total_employees: number;
  employees: any[]; // Changed to any to support both simple and detailed employee objects
  summary: {
    total_leave_requests: number;
    total_shift_swaps: number;
    total_days: number;
  };
}

interface CompanyData {
  departments: DepartmentData[];
  overall_summary: {
    total_departments: number;
    total_employees: number;
    total_requests: number;
    total_days: number;
  };
  all_leave_types?: { code: string; name_th: string; name_en: string }[];
}

/**
 * Export Individual Employee Leave Report
 */
export function exportIndividualLeaveReportPDF(
  employeeData: EmployeeData,
  options: PDFOptions
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Initialize Thai font support
  addThaiFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let currentY = 20;

  // Reset color for content
  doc.setTextColor(0, 0, 0);
  setThaiFont(doc, 'normal');

  // Header
  doc.setFontSize(18);
  setThaiFont(doc, 'bold');
  doc.text(options.title, pageWidth / 2, currentY, { align: 'center' });
  currentY += 8;

  if (options.subtitle) {
    doc.setFontSize(12);
    setThaiFont(doc, 'normal');
    doc.text(options.subtitle, pageWidth / 2, currentY, { align: 'center' });
    currentY += 7;
  }

  // Document Number
  if (options.documentNumber) {
    doc.setFontSize(10);
    doc.text(`Document No: ${options.documentNumber}`, pageWidth - 20, 20, { align: 'right' });
  }

  // Company name and date
  doc.setFontSize(10);
  doc.text('Portfolio Leave Demo', pageWidth / 2, currentY, { align: 'center' });
  currentY += 5;
  doc.text(
    `Report Period: ${options.dateRange.start} to ${options.dateRange.end}`,
    pageWidth / 2,
    currentY,
    { align: 'center' }
  );
  currentY += 5;
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, currentY, {
    align: 'center',
  });
  currentY += 3;
  doc.text(`By: ${options.generatedBy}`, pageWidth / 2, currentY, { align: 'center' });
  currentY += 10;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(20, currentY, pageWidth - 20, currentY);
  currentY += 10;

  // Employee Information
  doc.setFontSize(14);
  setThaiFont(doc, 'bold');
  doc.text('Employee Information', 20, currentY);
  currentY += 7;

  doc.setFontSize(10);
  setThaiFont(doc, 'normal');
  doc.text(`Employee Code: ${employeeData.employee_code}`, 25, currentY);
  currentY += 5;
  doc.text(`Name: ${employeeData.employee_name}`, 25, currentY);
  currentY += 5;
  doc.text(`Department: ${employeeData.department}`, 25, currentY);
  currentY += 5;
  if (employeeData.position) {
    doc.text(`Position: ${employeeData.position}`, 25, currentY);
    currentY += 5;
  }
  currentY += 5;

  // Leave Records Table
  doc.setFontSize(14);
  setThaiFont(doc, 'bold');
  doc.text('Leave & Shift Swap Records', 20, currentY);
  currentY += 5;

  const records = employeeData.records || [];

  // Calculate table width and center alignment for portrait A4
  const col1Width = 30;
  const col2Width = 45;
  const col3Width = 25;
  const col4Width = 25;
  const col5Width = 35;
  const col6Width = 35;
  const totalTableWidth = col1Width + col2Width + col3Width + col4Width + col5Width + col6Width;
  const rightMargin = 5; // Very small right margin (5mm)
  const leftMargin = pageWidth - totalTableWidth - rightMargin;

  autoTable(doc, {
    startY: currentY,
    head: [['Date', 'Type', 'Duration', 'Status', 'Category', 'Signature']],
    body: records.map((record) => [
      record.date,
      record.leave_type,
      record.duration,
      record.status === 'approved' ? 'Approved' : record.status === 'pending' ? 'Pending' : 'Rejected',
      record.is_shift_swap ? 'Shift Swap' : 'Leave Request',
      '_____________________', // Individual signature line for each record
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center',
      font: 'Sarabun',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [31, 41, 55],
      font: 'Sarabun',
      lineColor: [200, 200, 200],
    },
    columnStyles: {
      0: { cellWidth: col1Width, halign: 'center' },
      1: { cellWidth: col2Width },
      2: { cellWidth: col3Width, halign: 'center' },
      3: { cellWidth: col4Width, halign: 'center' },
      4: { cellWidth: col5Width, halign: 'center' },
      5: { cellWidth: col6Width, halign: 'center', textColor: [50, 50, 50], fontStyle: 'bold' },
    },
    margin: { left: leftMargin, right: rightMargin },
    tableWidth: totalTableWidth,
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    styles: {
      font: 'Sarabun',
      fontStyle: 'normal',
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // Summary
  const totalApproved = records.filter(r => r.status === 'approved').length;
  const totalPending = records.filter(r => r.status === 'pending').length;
  const totalLeave = records.filter(r => !r.is_shift_swap).length;
  const totalShiftSwap = records.filter(r => r.is_shift_swap).length;

  doc.setFontSize(12);
  setThaiFont(doc, 'bold');
  doc.text('Summary', 20, currentY);
  currentY += 7;

  doc.setFontSize(10);
  setThaiFont(doc, 'normal');
  doc.text(`Total Records: ${records.length}`, 25, currentY);
  currentY += 5;
  doc.text(`Leave Requests: ${totalLeave}`, 25, currentY);
  currentY += 5;
  doc.text(`Shift Swaps: ${totalShiftSwap}`, 25, currentY);
  currentY += 5;
  doc.text(`Approved: ${totalApproved}`, 25, currentY);
  currentY += 5;
  doc.text(`Pending: ${totalPending}`, 25, currentY);
  currentY += 15;

  // Signature Section
  addSignatureSections(doc, options.signatures, currentY, pageWidth, pageHeight);

  // Add footer
  addFooter(doc, pageWidth, pageHeight);

  // ✅ Add watermark ON TOP of all content with transparency
  addWatermark(doc, pageWidth, pageHeight);

  // Save
  const filename = `Leave_Report_Individual_${employeeData.employee_code}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

/**
 * Export Department Leave Report
 */
export function exportDepartmentLeaveReportPDF(
  deptData: DepartmentData,
  options: PDFOptions
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Initialize Thai font support
  addThaiFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let currentY = 20;

  // Header (similar to individual report)
  doc.setFontSize(18);
  setThaiFont(doc, 'bold');
  doc.text(options.title, pageWidth / 2, currentY, { align: 'center' });
  currentY += 8;

  if (options.subtitle) {
    doc.setFontSize(12);
    setThaiFont(doc, 'normal');
    doc.text(options.subtitle, pageWidth / 2, currentY, { align: 'center' });
    currentY += 7;
  }

  doc.setFontSize(10);
  doc.text(`Report Period: ${options.dateRange.start} to ${options.dateRange.end}`, pageWidth / 2, currentY, { align: 'center' });
  currentY += 5;
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, currentY, { align: 'center' });
  currentY += 10;

  // Department Info
  doc.setFontSize(14);
  setThaiFont(doc, 'bold');
  doc.text(`Department: ${deptData.department_name}`, 20, currentY);
  currentY += 7;

  doc.setFontSize(10);
  setThaiFont(doc, 'normal');
  doc.text(`Total Employees: ${deptData.total_employees}`, 25, currentY);
  currentY += 10;

  // Summary table by employee
  const employeeSummary = deptData.employees.map(emp => {
    // Handle both formats: with records array or with pre-calculated summary
    let totalLeave: number;
    let totalShift: number;
    let totalApproved: number;

    if (emp.records && emp.records.length > 0) {
      // Calculate from detailed records
      totalLeave = emp.records.filter(r => !r.is_shift_swap && r.status === 'approved').length;
      totalShift = emp.records.filter(r => r.is_shift_swap && r.status === 'approved').length;
      totalApproved = emp.records.filter(r => r.status === 'approved').length;
    } else {
      // Use pre-calculated summary values
      totalLeave = emp.leave || 0;
      totalShift = emp.shift || 0;
      totalApproved = emp.total || 0;
    }

    return {
      code: emp.employee_code,
      name: emp.employee_name,
      leave: totalLeave,
      shift: totalShift,
      total: totalApproved,
      signature: '_________________________', // Signature line for each employee
    };
  });

  // Calculate table width and center alignment for landscape A4
  const empCodeWidth = 35;
  const empNameWidth = 70;
  const leaveReqWidth = 40;
  const shiftSwapWidth = 40;
  const totalApprovedWidth = 40;
  const signatureWidth = 40;
  const deptTableWidth = empCodeWidth + empNameWidth + leaveReqWidth + shiftSwapWidth + totalApprovedWidth + signatureWidth;
  const rightMargin = 5; // Very small right margin (5mm)
  const deptLeftMargin = pageWidth - deptTableWidth - rightMargin;

  autoTable(doc, {
    startY: currentY,
    head: [['Employee Code', 'Name', 'Leave Requests', 'Shift Swaps', 'Total Approved', 'Signature']],
    body: employeeSummary.map(emp => [
      emp.code,
      emp.name,
      emp.leave,
      emp.shift,
      emp.total,
      emp.signature,
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center',
      font: 'Sarabun',
    },
    bodyStyles: {
      fontSize: 9,
      font: 'Sarabun',
      textColor: [31, 41, 55],
    },
    columnStyles: {
      0: { cellWidth: empCodeWidth, halign: 'center' },
      1: { cellWidth: empNameWidth },
      2: { cellWidth: leaveReqWidth, halign: 'center' },
      3: { cellWidth: shiftSwapWidth, halign: 'center' },
      4: { cellWidth: totalApprovedWidth, halign: 'center' },
      5: { cellWidth: signatureWidth, halign: 'center', textColor: [50, 50, 50], fontStyle: 'bold' },
    },
    margin: { left: deptLeftMargin, right: rightMargin },
    tableWidth: deptTableWidth,
    styles: {
      font: 'Sarabun',
      fontStyle: 'normal',
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // Department Summary
  doc.setFontSize(12);
  setThaiFont(doc, 'bold');
  doc.text('Department Summary', 20, currentY);
  currentY += 7;

  doc.setFontSize(10);
  setThaiFont(doc, 'normal');
  doc.text(`Total Leave Requests: ${deptData.summary.total_leave_requests}`, 25, currentY);
  currentY += 5;
  doc.text(`Total Shift Swaps: ${deptData.summary.total_shift_swaps}`, 25, currentY);
  currentY += 5;
  doc.text(`Total Days: ${deptData.summary.total_days}`, 25, currentY);
  currentY += 15;

  // Signature Section
  addSignatureSections(doc, options.signatures, currentY, pageWidth, pageHeight);

  // Footer
  addFooter(doc, pageWidth, pageHeight);

  const filename = `Leave_Report_Department_${deptData.department_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

/**
 * Export Department Detailed Report (Per-Employee with Leave Dates)
 * Shows each employee's leave records with dates, status, and past/future indicators
 */
/**
 * Export Department Detailed Report (Per-Employee with Leave Dates)
 * Shows each employee's leave records with dates, status, and past/future indicators
 * Dynamically switches to Grid View (Monthly style) for periods <= 35 days
 */
import { eachDayOfInterval, format, parseISO, differenceInDays, isWithinInterval, addDays } from 'date-fns';

interface DetailedLeaveRecord {
  id: string;
  date: string;
  end_date?: string; // Added to support ranges
  leave_type: string;
  leave_type_code: string;
  duration: string;
  total_days: number;
  status: string;
  reason?: string;
  is_shift_swap: boolean;
  created_at: string;
  approved_at?: string;
  is_half_day?: boolean;
  half_day_period?: string; // 'morning' | 'afternoon' | 'first_half' | 'second_half'
}

interface DetailedEmployeeData {
  employee_id: string;
  employee_code: string;
  employee_name_th: string;
  employee_name_en: string;
  position_th?: string;
  position_en?: string;
  hire_date?: string;
  total_leave_requests: number;
  total_shift_swaps: number;
  approved_leave_requests: number;
  approved_shift_swaps: number;
  pending_requests: number;
  total_days_taken: number;
  records?: DetailedLeaveRecord[];
}

interface DetailedDepartmentData {
  department: {
    id: string;
    code: string;
    name_th: string;
    name_en: string;
  };
  date_range: {
    start: string;
    end: string;
  };
  employees: DetailedEmployeeData[];
  summary: {
    total_employees: number;
    total_leave_requests: number;
    total_shift_swaps: number;
    total_approved_requests: number;
    total_pending_requests: number;
    total_days: number;
  };
}

interface DetailedPDFOptions {
  title: string;
  subtitle?: string;
  dateRange: { start: string; end: string };
  generatedBy: string;
  documentNumber?: string;
  language: 'th' | 'en';
}

export function exportDepartmentDetailedReportPDF(
  deptData: DetailedDepartmentData,
  options: DetailedPDFOptions
) {
  // Check duration to decide layout
  const startDate = parseISO(options.dateRange.start);
  const endDate = parseISO(options.dateRange.end);
  const daysDiff = differenceInDays(endDate, startDate) + 1;
  const useGridLayout = daysDiff <= 35; // Use grid if fits on A4 Landscape (~31-35 days)

  if (useGridLayout) {
    exportDepartmentGridReport(deptData, options, startDate, endDate);
  } else {
    exportDepartmentListReport(deptData, options);
  }
}

/**
 * Grid Layout Implementation (Matches Monthly Report Style)
 */
function exportDepartmentGridReport(
  deptData: DetailedDepartmentData,
  options: DetailedPDFOptions,
  startDate: Date,
  endDate: Date
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  addThaiFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 2; // Ultra-narrow margins like Monthly Report
  let currentY = margin + 2;
  const isThai = options.language === 'th';

  // Header
  setThaiFont(doc, 'bold');
  doc.setFontSize(12);
  doc.text(options.title, margin, currentY);
  currentY += 5;

  setThaiFont(doc, 'normal');
  doc.setFontSize(8);
  const infoText = `${isThai ? 'แผนก' : 'Department'}: ${isThai ? deptData.department.name_th : deptData.department.name_en} | ${options.subtitle || ''} | ${options.dateRange.start} - ${options.dateRange.end}`;
  doc.text(infoText, margin, currentY);
  currentY += 4;

  // Legend
  doc.setFontSize(6);
  doc.setTextColor(80, 80, 80);
  doc.text('Codes: Sick=Sick Leave, Vac=Vacation, PL=Personal, Mat=Maternity, Ord=Ordination, S=Swap, P=Pending', margin, currentY);
  doc.setTextColor(0, 0, 0);
  currentY += 3;

  // Prepare Grid Dates
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  // Table Headers
  const tableHeaders = [
    isThai ? 'รหัส' : 'ID',
    isThai ? 'ชื่อ-นามสกุล' : 'Name',
    isThai ? 'ตำแหน่ง' : 'Position',
  ];

  // Date Headers (Day number)
  days.forEach(day => {
    tableHeaders.push(format(day, 'd'));
  });

  // Summary Headers
  tableHeaders.push('L'); // Leave Total
  tableHeaders.push('S'); // Swap Total
  tableHeaders.push(isThai ? 'ลายเซ็น' : 'Sign');

  // Helper to get short code
  const getLeaveShortCode = (code: string, name: string) => {
    const c = (code || '').toLowerCase();
    const n = (name || '').toLowerCase();

    // Check name first as it's often more descriptive
    if (n.includes('sick') || c.includes('sick') || n.includes('ป่วย')) return 'Sick';
    if (n.includes('annual') || n.includes('vacation') || n.includes('พักร้อน') || c.includes('vac')) return 'Vac';
    if (n.includes('personal') || n.includes('business') || n.includes('กิจ') || c.includes('bus') || c.includes('pl')) return 'PL';
    if (n.includes('maternity') || n.includes('คลอด') || c.includes('mat')) return 'Mat';
    if (n.includes('paternity') || c.includes('pat')) return 'Pat';
    if (n.includes('ordination') || n.includes('บวช') || c.includes('ord')) return 'Ord';
    if (n.includes('sterilization') || n.includes('ทำหมัน') || c.includes('ster')) return 'Ster';
    if (n.includes('training') || n.includes('ฝึกอบรม') || c.includes('train')) return 'Train';
    if (n.includes('military') || n.includes('ทหาร') || c.includes('mil')) return 'Mil';

    // Fallback to code if sufficient length, otherwise first 3 of name
    if (code && code.length >= 2 && code !== 'L') return code.substring(0, 4).toUpperCase();
    return (name || code || 'L').substring(0, 3).toUpperCase();
  };

  // Helper to get period text
  const getPeriodText = (period?: string) => {
    if (!period) return '';
    if (period === 'morning' || period === 'first_half') return 'AM';
    if (period === 'afternoon' || period === 'second_half') return 'PM';
    return '';
  };

  // Prepare Table Body
  const tableBody: any[] = [];
  let lastDeptCode = '';

  deptData.employees.forEach(emp => {
    // Check for department change (For All Departments Report)
    const empDeptCode = (emp as any).department_code;
    const empDeptName = isThai ? (emp as any).department_name_th : (emp as any).department_name_en;

    if (empDeptCode && empDeptCode !== lastDeptCode) {
      // Insert Department Header Row
      const deptHeader = `${isThai ? 'แผนก' : 'Department'}: ${empDeptName} (${empDeptCode})`;
      tableBody.push([{
        content: deptHeader,
        colSpan: tableHeaders.length,
        styles: {
          fillColor: [240, 240, 240],
          fontStyle: 'bold',
          halign: 'left',
          textColor: [50, 50, 50]
        }
      }]);
      lastDeptCode = empDeptCode;
    }

    const empName = isThai ? emp.employee_name_th : emp.employee_name_en;
    const empPos = isThai ? (emp.position_th || '-') : (emp.position_en || '-');

    const row: any[] = [
      emp.employee_code,
      empName,
      empPos
    ];

    // Map records to dates
    days.forEach(day => {
      let mark = '';

      if (emp.records) {
        for (const rec of emp.records) {
          const recStart = parseISO(rec.date);
          const recEnd = rec.end_date ? parseISO(rec.end_date) : recStart;

          if (isWithinInterval(day, { start: recStart, end: recEnd })) {
            if (rec.status === 'pending') {
              mark = 'P'; // Pending is always just P
            } else if (rec.status === 'approved') {
              if (rec.is_shift_swap) {
                mark = 'S';
              } else {
                // Normal Leave
                const code = getLeaveShortCode(rec.leave_type_code || '', rec.leave_type || '');

                if (rec.is_half_day) {
                  const period = getPeriodText(rec.half_day_period);
                  // Format: "Sick\nAM" or "Vac\nPM"
                  mark = `${code}\n${period}`;
                } else {
                  mark = code;
                }
              }
            } else if (rec.status === 'rejected') {
              mark = 'X';
            }
            break;
          }
        }
      }
      row.push(mark);
    });

    // Totals
    const leaveTotal = Number(emp.total_days_taken || 0);
    const leaveTotalStr = Number.isInteger(leaveTotal) ? leaveTotal.toString() : leaveTotal.toFixed(1);

    row.push(leaveTotalStr);
    row.push(emp.approved_shift_swaps || 0);
    row.push(''); // Signature

    tableBody.push(row);
  });

  // Column Styles Calculation
  const usableWidth = pageWidth - (margin * 2);
  const fixedWidths = {
    code: 12,
    name: 30, // Reduced name
    pos: 20, // Reduced position
    summary: 7, // Slightly larger summary
    sig: 15 // Reduced sig
  };
  const fixedTotal = fixedWidths.code + fixedWidths.name + fixedWidths.pos + (fixedWidths.summary * 2) + fixedWidths.sig;
  const remainingForDays = usableWidth - fixedTotal;
  const dayColWidth = remainingForDays / days.length;

  const columnStyles: any = {
    0: { cellWidth: fixedWidths.code, halign: 'center', valign: 'middle', fontSize: 6 },
    1: { cellWidth: fixedWidths.name, halign: 'left', valign: 'middle', fontSize: 6 },
    2: { cellWidth: fixedWidths.pos, halign: 'left', valign: 'middle', fontSize: 6 },
  };

  // Day columns styles
  for (let i = 0; i < days.length; i++) {
    columnStyles[3 + i] = {
      cellWidth: dayColWidth,
      halign: 'center',
      valign: 'middle',
      fontSize: 5, // Smaller font for codes
      fontStyle: 'bold',
      cellPadding: 0.3
    };
  }

  // Summary columns styles
  const sumIdx = 3 + days.length;
  columnStyles[sumIdx] = { cellWidth: fixedWidths.summary, halign: 'center', fontSize: 6, fontStyle: 'bold', fillColor: [255, 240, 230] }; // Leave
  columnStyles[sumIdx + 1] = { cellWidth: fixedWidths.summary, halign: 'center', fontSize: 6, fontStyle: 'bold', fillColor: [230, 240, 255] }; // Swap
  columnStyles[sumIdx + 2] = { cellWidth: fixedWidths.sig, halign: 'center', fontSize: 5 }; // Signature

  autoTable(doc, {
    startY: currentY,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    styles: {
      font: 'Sarabun',
      fontSize: 6,
      lineWidth: 0.1,
      lineColor: [200, 200, 200],
      cellPadding: 0.3,
      minCellHeight: 6, // Slightly taller for wrapped text
      overflow: 'visible' // Allow text wrap
    },
    headStyles: {
      fillColor: [70, 130, 180],
      textColor: 255,
      halign: 'center',
      valign: 'middle',
      fontSize: 6,
      fontStyle: 'bold',
      minCellHeight: 6
    },
    columnStyles,
    margin: { left: margin, right: margin },
    tableWidth: 'auto',
    didParseCell: (data) => {
      // Color coding for marks
      if (data.section === 'body' && data.column.index >= 3 && data.column.index < sumIdx) {
        const text = data.cell.text[0]; // First line of text
        if (text === 'S') {
          data.cell.styles.textColor = [37, 99, 235]; // Blue Swap
        } else if (text === 'P') {
          data.cell.styles.textColor = [234, 179, 8]; // Pending
        } else if (text === 'X') {
          data.cell.styles.textColor = [150, 150, 150]; // Rejected
        } else if (text) {
          // Leave Code (Sick, Vac, etc)
          data.cell.styles.textColor = [220, 38, 38]; // Red Leave
        }
      }
    }
  });

  // Footer / Signatures would go here if needed, but for "Monthly" style usually just the table + compact summary
  currentY = (doc as any).lastAutoTable.finalY + 5;

  // Compact summary
  doc.setFontSize(8);
  setThaiFont(doc, 'normal');
  doc.text(`Total Employees: ${deptData.employees.length} | Leave Requests: ${deptData.summary.total_leave_requests} | Shift Swaps: ${deptData.summary.total_shift_swaps}`, margin, currentY);

  // Add watermark
  doc.save(`Department_Report_Grid_${options.dateRange.start}_${options.dateRange.end}.pdf`);
}

/**
 * List Layout Implementation (Original Detailed Report)
 */
function exportDepartmentListReport(
  deptData: DetailedDepartmentData,
  options: DetailedPDFOptions
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  addThaiFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let currentY = 20;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isThai = options.language === 'th';
  const deptName = isThai ? deptData.department.name_th : deptData.department.name_en;

  // Header
  doc.setFontSize(16);
  setThaiFont(doc, 'bold');
  doc.text(options.title, pageWidth / 2, currentY, { align: 'center' });
  currentY += 7;

  if (options.subtitle) {
    doc.setFontSize(11);
    setThaiFont(doc, 'normal');
    doc.text(options.subtitle, pageWidth / 2, currentY, { align: 'center' });
    currentY += 6;
  }

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`${isThai ? 'ช่วงเวลา' : 'Period'}: ${options.dateRange.start} - ${options.dateRange.end}`, pageWidth / 2, currentY, { align: 'center' });
  currentY += 4;
  doc.text(`${isThai ? 'ออกโดย' : 'Generated by'}: ${options.generatedBy} | ${new Date().toLocaleDateString(isThai ? 'th-TH' : 'en-US')}`, pageWidth / 2, currentY, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  currentY += 8;

  // Department Summary Box
  doc.setFillColor(240, 245, 255);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 18, 2, 2, 'F');
  currentY += 6;

  doc.setFontSize(10);
  setThaiFont(doc, 'bold');
  doc.text(`${isThai ? 'แผนก' : 'Department'}: ${deptName}`, margin + 5, currentY);
  currentY += 5;

  doc.setFontSize(9);
  setThaiFont(doc, 'normal');
  const summaryText = `${isThai ? 'พนักงาน' : 'Employees'}: ${deptData.summary.total_employees} | ${isThai ? 'ลา' : 'Leave'}: ${deptData.summary.total_leave_requests} | ${isThai ? 'สลับ' : 'Swap'}: ${deptData.summary.total_shift_swaps} | ${isThai ? 'รวมวัน' : 'Total Days'}: ${deptData.summary.total_days}`;
  doc.text(summaryText, margin + 5, currentY);
  currentY += 12;

  // Process each employee
  let lastDeptCode = '';

  for (const emp of deptData.employees) {
    // Check for department change (For All Departments Report)
    const empDeptCode = (emp as any).department_code;
    const empDeptName = isThai ? (emp as any).department_name_th : (emp as any).department_name_en;

    if (empDeptCode && empDeptCode !== lastDeptCode) {
      // Check if we need a new page for the department header
      if (currentY > pageHeight - 40) {
        doc.addPage();
        currentY = 20;
      }

      // Draw Department Header
      doc.setFillColor(240, 240, 240); // Light gray background
      doc.rect(margin, currentY, pageWidth - margin * 2, 12, 'F');

      doc.setTextColor(30, 41, 59); // Dark slate
      doc.setFontSize(14);
      setThaiFont(doc, 'bold');
      doc.text(`${(isThai ? 'แผนก' : 'Department')}: ${empDeptName} (${empDeptCode})`, margin + 5, currentY + 8);

      doc.setTextColor(0, 0, 0);
      currentY += 18; // Add specific spacing after department header
      lastDeptCode = empDeptCode;
    }

    const empName = isThai ? emp.employee_name_th : emp.employee_name_en;
    const empPosition = isThai ? (emp.position_th || '-') : (emp.position_en || '-');
    const records = emp.records || [];

    // Check if we need a new page (need at least 50mm for employee section)
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 20;
    }

    // Employee Header
    doc.setFillColor(59, 130, 246);
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, 10, 1, 1, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    setThaiFont(doc, 'bold');
    doc.text(`${emp.employee_code} - ${empName}`, margin + 3, currentY + 6.5);

    doc.setFontSize(8);
    setThaiFont(doc, 'normal');
    doc.text(empPosition, pageWidth - margin - 3, currentY + 6.5, { align: 'right' });

    doc.setTextColor(0, 0, 0);
    currentY += 12;

    if (records.length === 0) {
      // No records message
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text(isThai ? '- ไม่มีรายการลาหรือสลับวันหยุดในช่วงเวลานี้ -' : '- No leave or swap records in this period -', pageWidth / 2, currentY, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      currentY += 10;
    } else {
      // Sort records by date
      const sortedRecords = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Build table data with past/future indicator
      const tableData = sortedRecords.map(rec => {
        const recDate = new Date(rec.date);
        recDate.setHours(0, 0, 0, 0);
        const isPast = recDate < today;
        const timeCategory = isPast ? (isThai ? 'ผ่านมาแล้ว' : 'Past') : (isThai ? 'วันลายังมาไม่ถึง' : 'Upcoming');

        const [statusText, statusColor]: [string, number[]] = rec.status === 'approved'
          ? [isThai ? '✓ อนุมัติ' : '✓ Approved', [22, 163, 74]]
          : rec.status === 'pending'
            ? [isThai ? '◌ รออนุมัติ' : '◌ Pending', [234, 179, 8]]
            : [isThai ? '✗ ปฏิเสธ' : '✗ Rejected', [156, 163, 175]];

        const typeText = rec.is_shift_swap ? (isThai ? 'สลับวันหยุด' : 'Shift Swap') : rec.leave_type;

        return {
          date: rec.date,
          type: typeText,
          days: rec.total_days.toString(),
          status: statusText,
          statusColor: statusColor,
          category: timeCategory,
          isPast: isPast,
        };
      });

      // Create table
      autoTable(doc, {
        startY: currentY,
        head: [[
          isThai ? 'วันที่' : 'Date',
          isThai ? 'ประเภท' : 'Type',
          isThai ? 'วัน' : 'Days',
          isThai ? 'สถานะ' : 'Status',
          isThai ? 'ช่วงเวลา' : 'Period',
        ]],
        body: tableData.map(row => [row.date, row.type, row.days, row.status, row.category]),
        theme: 'striped',
        headStyles: {
          fillColor: [100, 116, 139],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'center',
          font: 'Sarabun',
        },
        bodyStyles: {
          fontSize: 8,
          font: 'Sarabun',
          cellPadding: 2,
        },
        columnStyles: {
          0: { cellWidth: 28, halign: 'center' },
          1: { cellWidth: 50 },
          2: { cellWidth: 15, halign: 'center' },
          3: { cellWidth: 30, halign: 'center' },
          4: { cellWidth: 25, halign: 'center' },
        },
        margin: { left: margin, right: margin },
        tableWidth: 'auto',
        styles: {
          font: 'Sarabun',
          overflow: 'ellipsize',
        },
        didParseCell: (data: any) => {
          // Color the status column
          if (data.column.index === 3 && data.section === 'body') {
            const rowIndex = data.row.index;
            if (tableData[rowIndex]) {
              data.cell.styles.textColor = tableData[rowIndex].statusColor;
              data.cell.styles.fontStyle = 'bold';
            }
          }
          // Gray out past entries
          if (data.section === 'body') {
            const rowIndex = data.row.index;
            if (tableData[rowIndex]?.isPast && data.column.index !== 3) {
              data.cell.styles.textColor = [120, 120, 120];
            }
          }
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 3;

      // Employee summary line
      doc.setFontSize(8);
      setThaiFont(doc, 'normal');
      doc.setTextColor(80, 80, 80);
      const empSummary = `${isThai ? 'สรุป' : 'Summary'}: ${isThai ? 'ลา' : 'Leave'} ${emp.approved_leave_requests} ${isThai ? 'วัน' : 'days'} | ${isThai ? 'สลับ' : 'Swap'} ${emp.approved_shift_swaps} ${isThai ? 'วัน' : 'days'} | ${isThai ? 'รออนุมัติ' : 'Pending'} ${emp.pending_requests}`;
      doc.text(empSummary, margin + 2, currentY);

      // Signature line
      doc.setTextColor(150, 150, 150);
      doc.text(`${isThai ? 'ลายเซ็น' : 'Signature'}: _________________________`, pageWidth - margin - 60, currentY);
      doc.setTextColor(0, 0, 0);
      currentY += 8;
    }

    // Add separator line
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 6;
  }

  // Final signature section
  if (currentY > pageHeight - 50) {
    doc.addPage();
    currentY = 20;
  }

  currentY += 5;
  doc.setFontSize(10);
  setThaiFont(doc, 'bold');
  doc.text(isThai ? 'ลงนามรับรอง / Certification' : 'Certification', margin, currentY);
  currentY += 10;

  // 3 signature boxes
  const boxWidth = (pageWidth - margin * 2 - 20) / 3;
  const roles = isThai
    ? ['ผู้จัดทำ', 'หัวหน้าแผนก', 'ฝ่ายบุคคล']
    : ['Prepared by', 'Dept. Manager', 'HR'];

  roles.forEach((role, i) => {
    const x = margin + i * (boxWidth + 10);
    doc.setDrawColor(150, 150, 150);
    doc.rect(x, currentY, boxWidth, 25);

    doc.setFontSize(9);
    setThaiFont(doc, 'bold');
    doc.text(role, x + boxWidth / 2, currentY + 5, { align: 'center' });

    doc.setDrawColor(100, 100, 100);
    doc.line(x + 10, currentY + 15, x + boxWidth - 10, currentY + 15);

    doc.setFontSize(7);
    setThaiFont(doc, 'normal');
    doc.text(`${isThai ? 'วันที่' : 'Date'}: ____________`, x + boxWidth / 2, currentY + 22, { align: 'center' });
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i}/${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    doc.text('CONFIDENTIAL - Labor Law Compliance Document', pageWidth / 2, pageHeight - 4, { align: 'center' });
  }

  const filename = `Leave_Detail_${deptData.department.code}_${options.dateRange.start}_to_${options.dateRange.end}.pdf`;
  doc.save(filename);
}

/**
 * Export Company-wide Leave Report
 */
export function exportCompanyWideLeaveReportPDF(
  companyData: CompanyData,
  options: PDFOptions
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Initialize Thai font support
  addThaiFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let currentY = 20;

  // Header
  doc.setFontSize(18);
  setThaiFont(doc, 'bold');
  doc.text(options.title, pageWidth / 2, currentY, { align: 'center' });
  currentY += 8;

  if (options.subtitle) {
    doc.setFontSize(12);
    setThaiFont(doc, 'normal');
    doc.text(options.subtitle, pageWidth / 2, currentY, { align: 'center' });
    currentY += 7;
  }

  doc.setFontSize(10);
  doc.text(`Report Period: ${options.dateRange.start} to ${options.dateRange.end}`, pageWidth / 2, currentY, { align: 'center' });
  currentY += 5;
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, currentY, { align: 'center' });
  currentY += 10;

  // Overall Summary
  doc.setFontSize(14);
  setThaiFont(doc, 'bold');
  doc.text('Company-wide Summary', 20, currentY);
  currentY += 7;

  doc.setFontSize(10);
  setThaiFont(doc, 'normal');
  doc.text(`Total Departments: ${companyData.overall_summary.total_departments}`, 25, currentY);
  currentY += 5;
  doc.text(`Total Employees: ${companyData.overall_summary.total_employees}`, 25, currentY);
  currentY += 5;
  doc.text(`Total Requests: ${companyData.overall_summary.total_requests}`, 25, currentY);
  currentY += 5;
  doc.text(`Total Days: ${companyData.overall_summary.total_days.toFixed(1)}`, 25, currentY);
  currentY += 10;

  // Department Summary Table
  const deptNameWidth = 70;
  const employeesWidth = 40;
  const leaveRequestsWidth = 45;
  const shiftSwapsWidth = 40;
  const totalDaysWidth = 40;

  autoTable(doc, {
    startY: currentY,
    head: [['Department', 'Employees', 'Leave Requests', 'Shift Swaps', 'Total Days']],
    body: companyData.departments.map(dept => [
      dept.department_name,
      dept.total_employees,
      dept.summary.total_leave_requests,
      dept.summary.total_shift_swaps,
      dept.summary.total_days.toFixed(1),
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center',
      font: 'Sarabun',
    },
    bodyStyles: {
      fontSize: 9,
      font: 'Sarabun',
      textColor: [31, 41, 55],
    },
    columnStyles: {
      0: { cellWidth: deptNameWidth },
      1: { cellWidth: employeesWidth, halign: 'center' },
      2: { cellWidth: leaveRequestsWidth, halign: 'center' },
      3: { cellWidth: shiftSwapsWidth, halign: 'center' },
      4: { cellWidth: totalDaysWidth, halign: 'center' },
    },
    styles: {
      font: 'Sarabun',
      fontStyle: 'normal',
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // Detailed Breakdown by Department (If leave types provided)
  if (companyData.all_leave_types && companyData.all_leave_types.length > 0) {
    doc.addPage();
    currentY = 20;

    doc.setFontSize(16);
    setThaiFont(doc, 'bold');
    doc.text('Detailed Employee Leave Breakdown', 20, currentY);
    currentY += 10;

    // Prepare dynamic columns
    const leaveTypes = companyData.all_leave_types;
    // Columns: ID, Name, [Type1, Type2, ...], Total
    const baseHeaders = ['ID', 'Name'];

    // Use Name instead of Code for headers
    const lang = options?.language || 'th';
    const typeHeaders = leaveTypes.map(lt => lang === 'th' ? (lt.name_th || lt.name_en) : (lt.name_en || lt.name_th));

    const headers = [...baseHeaders, ...typeHeaders, 'Total'];

    // Iterate through departments
    for (const dept of companyData.departments) {
      if (!dept.employees || dept.employees.length === 0) continue;

      // Check for page break
      if (currentY > pageHeight - 40) {
        doc.addPage();
        currentY = 20;
      }

      // Dept Header
      doc.setFontSize(12);
      setThaiFont(doc, 'bold');
      doc.setFillColor(240, 240, 240);
      doc.rect(14, currentY, pageWidth - 28, 8, 'F');
      doc.text(`Department: ${dept.department_name} (${dept.department_code || '-'})`, 20, currentY + 5.5);
      currentY += 10;

      // Process rows
      const rows = dept.employees.map(emp => {
        const stats = (emp.leave_stats || {}) as Record<string, number>;

        const formatVal = (val: number) => {
          if (val === 0) return '-';
          if (Number.isInteger(val)) return val.toString();

          // Hourly Check (only for values less than 1)
          if (val < 1) {
            const hours = val * 8;
            // If perfectly divisible by hours (allow small float error)
            if (Math.abs(Math.round(hours) - hours) < 0.001) {
              // Keep 0.5 as is, convert others to hours (e.g. 0.25 -> 2h)
              if (val === 0.5) return '0.5';
              return `${Math.round(hours)}h`;
            }
          }
          return parseFloat(val.toFixed(2)).toString();
        };

        const typeValues = leaveTypes.map(lt => {
          const val = stats[lt.code] || 0;
          return formatVal(val);
        });

        // Calculate total for this employee
        const total: number = Object.values(stats).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);

        // Determine name based on language option (default to TH if not specified, or checks field availability)
        // Note: The interface might not strictly have 'employee_name_th' typed in 'any' usage here, so we cast/check.
        const lang = options?.language || 'th';
        const name = lang === 'th'
          ? (emp.employee_name_th || emp.employee_name_en || emp.employee_name)
          : (emp.employee_name_en || emp.employee_name_th || emp.employee_name);

        return [
          emp.employee_code,
          name || '-',
          ...typeValues,
          formatVal(total)
        ];
      });

      // Render Table
      autoTable(doc, {
        startY: currentY,
        head: [headers],
        body: rows,
        theme: 'grid',
        headStyles: {
          fillColor: [100, 116, 139], // Slate 500
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'center',
          font: 'Sarabun',
        },
        bodyStyles: {
          fontSize: 8,
          font: 'Sarabun',
          textColor: [30, 30, 30],
          cellPadding: 1,
        },
        columnStyles: {
          0: { cellWidth: 20 }, // ID
          1: { cellWidth: 50 }, // Name
          // Auto for others
        },
        styles: {
          font: 'Sarabun',
          overflow: 'linebreak',
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;
    }
  }

  // Signature Section
  addSignatureSections(doc, options.signatures, currentY, pageWidth, pageHeight);

  // Footer
  addFooter(doc, pageWidth, pageHeight);

  const filename = `Leave_Report_Company_Wide_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

/**
 * Add signature sections to PDF
 */
function addSignatureSections(
  doc: jsPDF,
  signatures: PDFSignatureSection[],
  startY: number,
  pageWidth: number,
  pageHeight: number
) {
  let currentY = startY;

  // Check if we need a new page (adjust threshold for landscape)
  if (currentY > pageHeight - 100) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFontSize(12);
  setThaiFont(doc, 'bold');
  doc.text('Acknowledgment & Signatures', 20, currentY);
  currentY += 10;

  // Acknowledgment statement
  signatures.forEach((sig, index) => {
    if (sig.showAcknowledgment && index === 0) {
      doc.setFontSize(9);
      setThaiFont(doc, 'normal');
      const statement = 'I hereby acknowledge that the information in this report is accurate and complete to the best of my knowledge.';
      doc.text(statement, 20, currentY, { maxWidth: pageWidth - 40 });
      currentY += 10;
    }
  });

  // Optimized signature layout for landscape A4
  // Use fixed box dimensions that work well in landscape
  const boxWidth = 80; // Fixed width for better space utilization
  const boxHeight = 50; // Increased height for better signature space
  const horizontalSpacing = 20; // Space between boxes
  const maxBoxesPerRow = Math.floor((pageWidth - 60) / (boxWidth + horizontalSpacing));

  // Arrange signatures in rows for better landscape utilization
  const rows = Math.ceil(signatures.length / maxBoxesPerRow);

  for (let row = 0; row < rows; row++) {
    const startIndex = row * maxBoxesPerRow;
    const endIndex = Math.min(startIndex + maxBoxesPerRow, signatures.length);
    const signaturesInRow = endIndex - startIndex;

    // Calculate starting X position to center this row
    const totalRowWidth = signaturesInRow * boxWidth + (signaturesInRow - 1) * horizontalSpacing;
    const startX = (pageWidth - totalRowWidth) / 2;

    // Process each signature in this row
    signatures.forEach((sig, index) => {
      if (index >= startIndex && index < endIndex) {
        const colIndex = index - startIndex;
        const x = startX + colIndex * (boxWidth + horizontalSpacing);

        // Draw signature box with better styling
        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(0.8);
        doc.rect(x, currentY, boxWidth, boxHeight);

        // Add subtle background (use rect with 'F' fill style)
        doc.setFillColor(248, 250, 252);
        doc.rect(x + 0.5, currentY + 0.5, boxWidth - 1, boxHeight - 1, 'F');

        // Label (wrapped if needed)
        doc.setFontSize(10);
        setThaiFont(doc, 'bold');
        doc.setTextColor(50, 50, 50);

        // Split long labels into multiple lines
        const maxLabelWidth = boxWidth - 10;
        const words = sig.label.split(' ');
        let line = '';
        let lineY = currentY + 8;

        words.forEach((word) => {
          const testLine = line + word + ' ';
          const testWidth = doc.getTextWidth(testLine);
          if (testWidth > maxLabelWidth && line.length > 0) {
            doc.text(line.trim(), x + boxWidth / 2, lineY, { align: 'center' });
            line = word + ' ';
            lineY += 6;
          } else {
            line = testLine;
          }
        });
        if (line.trim()) {
          doc.text(line.trim(), x + boxWidth / 2, lineY, { align: 'center' });
        }

        // Signature line (longer and more prominent)
        doc.setDrawColor(50, 50, 50);
        doc.setLineWidth(0.5);
        doc.line(x + 8, currentY + 30, x + boxWidth - 8, currentY + 30);

        // Signature text
        doc.setFontSize(9);
        setThaiFont(doc, 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text('Signature', x + boxWidth / 2, currentY + 35, { align: 'center' });

        // Name and position (if provided)
        doc.setFontSize(8);
        setThaiFont(doc, 'normal');
        doc.setTextColor(70, 70, 70);

        const infoY = currentY + 40;
        if (sig.name) {
          doc.text(`Name: ${sig.name}`, x + 8, infoY);
        }

        if (sig.position) {
          doc.text(`Position: ${sig.position}`, x + 8, sig.name ? infoY + 4 : infoY);
        }

        // Date field
        if (sig.showDate) {
          doc.text('Date: _______________', x + 8, currentY + boxHeight - 3);
        }
      }
    });

    // Move to next row if there are more signatures
    if (row < rows - 1) {
      currentY += boxHeight + 15;
    }
  }
}

/**
 * Add footer to all pages
 */
function addFooter(doc: jsPDF, pageWidth: number, pageHeight: number) {
  const pageCount = doc.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, {
      align: 'center',
    });
    doc.text(
      'CONFIDENTIAL - For Internal Use Only | Labor Law Compliance Document',
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }
}

/**
 * Add watermark on top of all content with transparency
 * This is called AFTER all content is drawn so watermark appears on top
 */
function addWatermark(doc: jsPDF, pageWidth: number, pageHeight: number) {
  const pageCount = doc.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Save current graphics state
    doc.saveGraphicsState();

    // Set transparency using GState (0.08 = 8% opacity - very light)
    const gState = new (doc as any).GState({ opacity: 0.08 });
    doc.setGState(gState);

    // Draw watermark text
    doc.setFontSize(60);
    doc.setTextColor(100, 100, 100);
    doc.text('OFFICIAL', pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: 45,
    });

    // Restore graphics state (reset opacity)
    doc.restoreGraphicsState();
  }
}
