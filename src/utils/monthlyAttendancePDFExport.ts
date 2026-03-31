/**
 * Monthly Attendance Report PDF Export
 *
 * Thai Labor Law Compliance Format:
 * - Table with employees as rows, days as columns
 * - Mark leave days with leave type code
 * - Mark shift swap days with "S"
 * - Signature space for employee confirmation
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addThaiFont, setThaiFont } from './pdfFonts';

interface DayRecord {
  day: number;
  date?: string; // YYYY-MM-DD format for fiscal month matching
  leave_type?: string;
  leave_code?: string;
  is_shift_swap: boolean;
  status: string;
  leave_duration?: 'full' | 'half_day_morning' | 'half_day_afternoon' | 'hourly';
  leave_hours?: number;
}

interface EmployeeMonthlyData {
  employee_code: string;
  employee_name: string;
  position?: string;
  days: DayRecord[];
  total_leave_days: number;
  total_shift_swaps: number;
}

interface MonthlyAttendanceData {
  department_name: string;
  year: number;
  month: number;
  month_name: string;
  days_in_month: number;
  employees: EmployeeMonthlyData[];
  calendar_dates?: string[]; // YYYY-MM-DD format dates for fiscal year support
}

/**
 * Export Monthly Attendance Report as PDF - COMPLETELY REDESIGNED
 */
export function exportMonthlyAttendancePDF(data: MonthlyAttendanceData) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4', // A4 landscape (297mm x 210mm)
  });

  // Initialize Thai font - using standard pattern
  addThaiFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ULTRA-NARROW MARGINS FOR MAXIMUM SPACE UTILIZATION
  const margin = 2; // Ultra-narrow 2mm margins
  const usableWidth = pageWidth - (margin * 2);
  const usableHeight = pageHeight - (margin * 2);

  let currentY = margin + 2;

  // COMPACT HEADER DESIGN - Single title line
  setThaiFont(doc, 'bold');
  doc.setFontSize(12);
  doc.text('รายงานการลาและสลับวันหยุดรายเดือน / Monthly Leave & Shift Swap Report', margin, currentY);
  currentY += 5;

  // Department and Date in single line with separators
  setThaiFont(doc, 'normal');
  doc.setFontSize(8);
  const infoText = `แผนก: ${data.department_name} | ${data.month_name} ${data.year} | ${new Date().toLocaleDateString('th-TH')}`;
  doc.text(infoText, margin, currentY);
  currentY += 4;

  // Helper to get short code (copied from comprehensiveReportPDFExport)
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

  // Compact Legend with better positioning
  doc.setFontSize(6);
  doc.setTextColor(80, 80, 80);
  doc.text('Codes: Sick=Sick Leave, Vac=Vacation, PL=Personal, Mat=Maternity, Ord=Ordination, S=Swap, P=Pending', margin, currentY);
  doc.setTextColor(0, 0, 0); // Reset text color
  currentY += 3;

  // COMPACT TABLE DESIGN - Ultra-condensed headers
  const tableHeaders = [
    'รหัส',     // Compact Header
    'ชื่อ-นามสกุล',
    'ตำแหน่ง', // New Position Column
  ];

  // Add day columns - Use actual calendar dates if provided (fiscal year support)
  if (data.calendar_dates && data.calendar_dates.length > 0) {
    data.calendar_dates.forEach(dateStr => {
      const day = parseInt(dateStr.split('-')[2]);
      tableHeaders.push(day.toString());
    });
  } else {
    // Fallback: Add day columns (1-31)
    for (let day = 1; day <= data.days_in_month; day++) {
      tableHeaders.push(day.toString());
    }
  }

  // Compact summary columns
  tableHeaders.push('ลา\nL');
  tableHeaders.push('สลับ\nS');
  tableHeaders.push('ลายเซ็น\nSig');

  // Prepare table body
  const tableBody = data.employees.map(emp => {
    const row: any[] = [
      emp.employee_code,
      emp.employee_name,
      emp.position || '-', // Add Position data
    ];

    // Add marks for each day - use calendar_dates if available for fiscal month support
    if (data.calendar_dates && data.calendar_dates.length > 0) {
      data.calendar_dates.forEach(dateStr => {
        // Find the day record matching this date
        const dayRecord = emp.days.find(d => d.date === dateStr);
        let mark = '';

        if (dayRecord) {
          const hasLeave = dayRecord.leave_code || dayRecord.leave_type;

          if (hasLeave || dayRecord.is_shift_swap) {
            if (dayRecord.status === 'pending') {
              mark = 'P';
            } else if (dayRecord.status === 'approved') {
              if (dayRecord.is_shift_swap) {
                mark = 'S';
              } else {
                const code = getLeaveShortCode(dayRecord.leave_code || '', dayRecord.leave_type || '');
                if (dayRecord.leave_duration === 'hourly') {
                  mark = `${code}\n${Number(dayRecord.leave_hours || 0).toFixed(1)}h`;
                } else if (dayRecord.leave_duration === 'half_day_morning') {
                  mark = `${code}\n½AM`;
                } else if (dayRecord.leave_duration === 'half_day_afternoon') {
                  mark = `${code}\n½PM`;
                } else {
                  mark = code;
                }
              }
            } else if (dayRecord.status === 'rejected') {
              mark = 'X';
            }
          }
        }
        row.push(mark);
      });
    } else {
      // Fallback: Original logic for 1 to days_in_month
      for (let dayNum = 1; dayNum <= data.days_in_month; dayNum++) {
        const dayRecord = emp.days.find(d => d.day === dayNum);
        let mark = '';

        if (dayRecord) {
          const hasLeave = dayRecord.leave_code || dayRecord.leave_type;

          if (hasLeave || dayRecord.is_shift_swap) {
            if (dayRecord.status === 'pending') {
              mark = 'P';
            } else if (dayRecord.status === 'approved') {
              if (dayRecord.is_shift_swap) {
                mark = 'S';
              } else {
                const code = getLeaveShortCode(dayRecord.leave_code || '', dayRecord.leave_type || '');
                if (dayRecord.leave_duration === 'hourly') {
                  mark = `${code}\n${Number(dayRecord.leave_hours || 0).toFixed(1)}h`;
                } else if (dayRecord.leave_duration === 'half_day_morning') {
                  mark = `${code}\n½AM`;
                } else if (dayRecord.leave_duration === 'half_day_afternoon') {
                  mark = `${code}\n½PM`;
                } else {
                  mark = code;
                }
              }
            } else if (dayRecord.status === 'rejected') {
              mark = 'X';
            }
          }
        }
        row.push(mark);
      }
    }

    // Add summary columns
    row.push(emp.total_leave_days.toString());
    row.push(emp.total_shift_swaps.toString());
    row.push(''); // Empty signature cell

    return row;
  });

  // A4 landscape = 297mm x 210mm
  // With 2mm margins on each side, usable width = 293mm
  // We need to fit: employee_code + name + position + 31 day columns + L + S + signature

  // Column widths optimized for readability
  const employeeCodeWidth = 12;
  const nameWidth = 22;
  const positionWidth = 18; // New Position column width
  const fixedColumnsWidth = employeeCodeWidth + nameWidth + positionWidth;

  // Summary columns
  const leaveTotalWidth = 6;
  const swapTotalWidth = 6;

  // Day columns - calculate width for 31 days max
  // Reserve space for fixed columns and summary, rest goes to days
  const dayColumnsSpace = usableWidth - fixedColumnsWidth - leaveTotalWidth - swapTotalWidth - 25; // 25mm for signature
  const dayColumnWidth = Math.floor((dayColumnsSpace / 31) * 10) / 10;

  // Signature column gets remaining space to right margin
  const usedWidthForDays = dayColumnWidth * data.days_in_month;
  const signatureWidth = usableWidth - fixedColumnsWidth - usedWidthForDays - leaveTotalWidth - swapTotalWidth;

  // Total table width = full usable width
  const calculatedTableWidth = usableWidth;

  const columnStyles: any = {
    0: { cellWidth: employeeCodeWidth, halign: 'center', valign: 'middle', cellPadding: 0.5, fontSize: 5 }, // Employee code
    1: { cellWidth: nameWidth, halign: 'left', valign: 'middle', cellPadding: 0.5, fontSize: 5 }, // Name
    2: { cellWidth: positionWidth, halign: 'left', valign: 'middle', cellPadding: 0.5, fontSize: 5 }, // Position
  };

  // Day columns - readable font size
  for (let i = 0; i < data.days_in_month; i++) {
    columnStyles[3 + i] = { // Shifted by +1 (0:Code, 1:Name, 2:Position -> 3:Day1)
      cellWidth: dayColumnWidth,
      halign: 'center',
      valign: 'middle',
      cellPadding: 0.2,
      fontSize: 6, // Readable font size for marks
      minCellHeight: 5,
      fontStyle: 'bold' // Bold for visibility
    };
  }

  // Summary columns
  columnStyles[data.days_in_month + 3] = { // Shifted by +1
    cellWidth: leaveTotalWidth,
    halign: 'center',
    valign: 'middle',
    fontStyle: 'bold',
    cellPadding: 0.3,
    fontSize: 6,
    fillColor: [255, 240, 230] // Light orange for leave
  };
  columnStyles[data.days_in_month + 4] = { // Shifted by +1
    cellWidth: swapTotalWidth,
    halign: 'center',
    valign: 'middle',
    fontStyle: 'bold',
    cellPadding: 0.3,
    fontSize: 6,
    fillColor: [230, 240, 255] // Light blue for swap
  };
  columnStyles[data.days_in_month + 5] = { // Shifted by +1
    cellWidth: signatureWidth,
    halign: 'center',
    valign: 'middle',
    textColor: [150, 150, 150],
    fontStyle: 'normal',
    cellPadding: 0.5,
    fontSize: 5,
    fillColor: [252, 252, 252], // Very light gray
    lineWidth: 0.15,
    minCellHeight: 6
  };

  // Generate ultra-compact table with enhanced design
  autoTable(doc, {
    startY: currentY,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    styles: {
      font: 'Sarabun',
      fontSize: 5, // Slightly larger for readability
      cellPadding: 0.3,
      lineColor: [180, 180, 180],
      lineWidth: 0.1,
      overflow: 'ellipsize', // Truncate instead of wrap
      minCellHeight: 5,
    },
    headStyles: {
      fillColor: [70, 130, 180],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 5,
      halign: 'center',
      valign: 'middle',
      cellPadding: 0.3,
      minCellHeight: 6,
    },
    columnStyles: columnStyles,
    rowPageBreak: 'avoid',
    bodyStyles: {
      overflow: 'ellipsize',
      minCellHeight: 5,
      cellPadding: 0.3,
      fontSize: 5,
    },
    didParseCell: (data: any) => {
      // Day columns start at index 3 (after employee_code, name, position)
      const dayColumnsStartIndex = 3;
      const dayColumnsEndIndex = 3 + data.table.body[0]?.length - 6 || dayColumnsStartIndex; // Rough calc

      // Style day columns (color-code marks)
      if (data.column.index >= dayColumnsStartIndex && data.column.index < data.table.columns.length - 3) {
        const text = data.cell.text[0];
        if (text === 'L') {
          data.cell.styles.textColor = [220, 38, 38]; // Red for leave
          data.cell.styles.fontStyle = 'bold';
        } else if (text === 'S') {
          data.cell.styles.textColor = [37, 99, 235]; // Blue for shift swap
          data.cell.styles.fontStyle = 'bold';
        } else if (text === 'P') {
          data.cell.styles.textColor = [234, 179, 8]; // Yellow for pending
          data.cell.styles.fontStyle = 'bold';
        } else if (text === 'X') {
          data.cell.styles.textColor = [107, 114, 128]; // Gray for rejected
        }
      }
    },
    margin: { left: margin, right: margin, top: margin, bottom: margin },
    tableWidth: calculatedTableWidth, // Use calculated width, NOT 'auto'
    showHead: 'firstPage',
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // Ultra-compact summary section
  doc.setFontSize(8);
  setThaiFont(doc, 'bold');
  doc.text('สรุป:', margin, currentY);
  currentY += 3;

  doc.setFontSize(7);
  setThaiFont(doc, 'normal');
  const totalLeave = data.employees.reduce((sum, e) => sum + e.total_leave_days, 0);
  const totalSwap = data.employees.reduce((sum, e) => sum + e.total_shift_swaps, 0);
  const summaryText = `พนักงาน: ${data.employees.length} | ลา: ${totalLeave} วัน | สลับ: ${totalSwap} วัน`;
  doc.text(summaryText, margin, currentY);
  currentY += 4;

  // OPTIMIZED SIGNATURE SECTION FOR LANDSCAPE
  const signatureSectionHeight = 35; // Reduced height
  if (currentY + signatureSectionHeight > pageHeight - 15) {
    doc.addPage();
    currentY = 12;
  }

  // Perfect 3-column signature layout for landscape
  const signatureY = currentY;
  const sigWidth = pageWidth / 3;
  const col1X = sigWidth / 2;
  const col2X = sigWidth + sigWidth / 2;
  const col3X = sigWidth * 2 + sigWidth / 2;

  doc.setFontSize(9);
  setThaiFont(doc, 'bold');

  // OPTIMIZED SIGNATURE BOXES
  const sigBoxWidth = 35;

  // Prepared by
  doc.text('Prepared by / จัดทำโดย', col1X, signatureY, { align: 'center' });
  doc.line(col1X - sigBoxWidth, signatureY + 12, col1X + sigBoxWidth, signatureY + 12);
  doc.text('_________________________', col1X, signatureY + 8, { align: 'center' });
  setThaiFont(doc, 'normal');
  doc.text('Date / วันที่: ___________', col1X, signatureY + 17, { align: 'center' });

  // Reviewed by
  setThaiFont(doc, 'bold');
  doc.text('Reviewed by / ตรวจสอบโดย', col2X, signatureY, { align: 'center' });
  doc.line(col2X - sigBoxWidth, signatureY + 12, col2X + sigBoxWidth, signatureY + 12);
  doc.text('_________________________', col2X, signatureY + 8, { align: 'center' });
  setThaiFont(doc, 'normal');
  doc.text('(Department Manager / หัวหน้าแผนก)', col2X, signatureY + 17, { align: 'center' });
  doc.text('Date / วันที่: ___________', col2X, signatureY + 22, { align: 'center' });

  // Approved by
  setThaiFont(doc, 'bold');
  doc.text('Approved by / อนุมัติโดย', col3X, signatureY, { align: 'center' });
  doc.line(col3X - sigBoxWidth, signatureY + 12, col3X + sigBoxWidth, signatureY + 12);
  doc.text('_________________________', col3X, signatureY + 8, { align: 'center' });
  setThaiFont(doc, 'normal');
  doc.text('(HR Manager / ผู้จัดการฝ่ายบุคคล)', col3X, signatureY + 17, { align: 'center' });
  doc.text('Date / วันที่: ___________', col3X, signatureY + 22, { align: 'center' });

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(128, 128, 128);
  doc.text(
    'CONFIDENTIAL - For Internal Use Only | Labor Law Compliance Document',
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );
  doc.text(`Page 1 of 1`, pageWidth / 2, pageHeight - 4, { align: 'center' });

  // Save PDF
  const filename = `Monthly_Attendance_${data.department_name.replace(/\s+/g, '_')}_${data.year}_${String(data.month).padStart(2, '0')}.pdf`;
  doc.save(filename);
}
