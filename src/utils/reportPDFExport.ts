import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addThaiFont, setThaiFont } from './pdfFonts';

interface PDFExportOptions {
  title: string;
  subtitle?: string;
  orientation?: 'portrait' | 'landscape';
  companyName?: string;
  generatedBy?: string;
}

interface TableColumn {
  header: string;
  dataKey: string;
  width?: number;
}

interface DashboardPDFData {
  kpis: Array<{ label: string; value: string | number }>;
  monthlyTrends?: any[];
  leaveTypes?: any[];
  departments?: any[];
  alerts?: any[];
}

/**
 * Professional PDF Export for Executive Dashboard
 */
export function exportExecutiveDashboardToPDF(
  data: DashboardPDFData,
  options: PDFExportOptions
) {
  const {
    title,
    subtitle,
    orientation = 'portrait',
    companyName = 'Portfolio Leave Demo',
    generatedBy,
  } = options;

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  // Initialize Thai font support
  addThaiFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let currentY = 20;

  // ===== Header =====
  doc.setFontSize(20);
  setThaiFont(doc, 'bold');
  doc.setTextColor(31, 41, 55); // Gray-800
  doc.text(title, pageWidth / 2, currentY, { align: 'center' });
  currentY += 10;

  if (subtitle) {
    doc.setFontSize(12);
    setThaiFont(doc, 'normal');
    doc.setTextColor(107, 114, 128); // Gray-500
    doc.text(subtitle, pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;
  }

  // Company name and date
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(companyName, pageWidth / 2, currentY, { align: 'center' });
  currentY += 5;
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, currentY, {
    align: 'center',
  });
  currentY += 5;

  if (generatedBy) {
    doc.text(`By: ${generatedBy}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 5;
  }

  // Divider line
  doc.setDrawColor(229, 231, 235); // Gray-200
  doc.setLineWidth(0.5);
  doc.line(20, currentY, pageWidth - 20, currentY);
  currentY += 10;

  // ===== KPIs Section =====
  doc.setFontSize(14);
  setThaiFont(doc, 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text('Key Performance Indicators', 20, currentY);
  currentY += 8;

  // KPIs in grid format
  const kpiColWidth = (pageWidth - 40) / 2;
  data.kpis.forEach((kpi, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 20 + col * kpiColWidth;
    const y = currentY + row * 15;

    doc.setFontSize(10);
    setThaiFont(doc, 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(kpi.label, x, y);

    doc.setFontSize(16);
    setThaiFont(doc, 'bold');
    doc.setTextColor(59, 130, 246); // Blue-600
    doc.text(String(kpi.value), x, y + 6);
  });

  currentY += Math.ceil(data.kpis.length / 2) * 15 + 10;

  // Check if we need a new page
  if (currentY > pageHeight - 60) {
    doc.addPage();
    currentY = 20;
  }

  // ===== Monthly Trends Table =====
  if (data.monthlyTrends && data.monthlyTrends.length > 0) {
    doc.setFontSize(14);
    setThaiFont(doc, 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text('Monthly Trends', 20, currentY);
    currentY += 5;

    autoTable(doc, {
      startY: currentY,
      head: [['Month', 'Total Requests', 'Approved', 'Rejected']],
      body: data.monthlyTrends.map((trend) => [
        trend.month,
        trend.requests,
        trend.approved,
        trend.rejected,
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: [59, 130, 246], // Blue-600
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10,
        font: 'Sarabun',
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [31, 41, 55],
        font: 'Sarabun',
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251], // Gray-50
      },
      styles: {
        font: 'Sarabun',
      },
      margin: { left: 20, right: 20 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Check if we need a new page
  if (currentY > pageHeight - 60) {
    doc.addPage();
    currentY = 20;
  }

  // ===== Leave Type Distribution Table =====
  if (data.leaveTypes && data.leaveTypes.length > 0) {
    doc.setFontSize(14);
    setThaiFont(doc, 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text('Leave Type Distribution', 20, currentY);
    currentY += 5;

    autoTable(doc, {
      startY: currentY,
      head: [['Leave Type', 'Count', 'Percentage']],
      body: data.leaveTypes
        .filter(type => type.name && type.name.trim() !== '')
        .map(type => ({
          ...type,
          name: type.name.toString().trim()
        }))
        .filter(type => {
          // Simple filtering
          const name = type.name;
          return name && name.length > 1;
        })
        .map((type) => {
          const total = data.leaveTypes.reduce((sum, t) => sum + t.value, 0);
          const percentage = total > 0 ? ((type.value / total) * 100).toFixed(1) : '0.0';
          return [type.name, type.value, `${percentage}%`];
        }),
      theme: 'grid',
      headStyles: {
        fillColor: [16, 185, 129], // Green-600
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10,
        font: 'Sarabun',
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [31, 41, 55],
        font: 'Sarabun',
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      styles: {
        font: 'Sarabun',
      },
      margin: { left: 20, right: 20 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Check if we need a new page
  if (currentY > pageHeight - 60) {
    doc.addPage();
    currentY = 20;
  }

  // ===== Department Statistics Table =====
  if (data.departments && data.departments.length > 0) {
    doc.setFontSize(14);
    setThaiFont(doc, 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text('Department Statistics', 20, currentY);
    currentY += 5;

    autoTable(doc, {
      startY: currentY,
      head: [['Department', 'Requests', 'Total Days', 'Avg Days/Request']],
      body: data.departments
        .filter(dept => dept.department && dept.department.trim() !== '')
        .map(dept => ({
          ...dept,
          department: dept.department.toString().trim()
        }))
        .filter(dept => {
          // Simple filtering
          const name = dept.department;
          return name && name.length > 1;
        })
        .map((dept) => [
          dept.department,
          dept.requests,
          dept.days,
          dept.requests > 0 ? (dept.days / dept.requests).toFixed(1) : '0.0',
        ]),
      theme: 'grid',
      headStyles: {
        fillColor: [139, 92, 246], // Purple-600
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10,
        font: 'Sarabun',
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [31, 41, 55],
        font: 'Sarabun',
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      styles: {
        font: 'Sarabun',
      },
      margin: { left: 20, right: 20 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // ===== System Alerts =====
  if (data.alerts && data.alerts.length > 0) {
    // Check if we need a new page
    if (currentY > pageHeight - 80) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(14);
    setThaiFont(doc, 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text('System Alerts', 20, currentY);
    currentY += 8;

    data.alerts.forEach((alert) => {
      const severityColor: [number, number, number] =
        alert.severity === 'error'
          ? [239, 68, 68]
          : alert.severity === 'warning'
            ? [245, 158, 11]
            : [59, 130, 246];

      doc.setFontSize(9);
      setThaiFont(doc, 'bold');
      doc.setTextColor(...severityColor);
      doc.text(`[${alert.severity.toUpperCase()}]`, 20, currentY);

      setThaiFont(doc, 'normal');
      doc.setTextColor(31, 41, 55);
      const lines = doc.splitTextToSize(alert.message, pageWidth - 60);
      doc.text(lines, 45, currentY);
      currentY += lines.length * 5 + 3;

      if (currentY > pageHeight - 30) {
        doc.addPage();
        currentY = 20;
      }
    });
  }

  // ===== Footer on every page =====
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175); // Gray-400
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.text(
      'Confidential - SSTH Internal Use Only',
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  // Save the PDF
  const filename = `Executive_Dashboard_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

/**
 * Professional PDF Export for Leave Balance Report
 */
export function exportLeaveBalanceReportToPDF(
  balances: any[],
  options: PDFExportOptions
) {
  const {
    title,
    subtitle,
    orientation = 'landscape',
    companyName = 'Portfolio Leave Demo',
    generatedBy,
  } = options;

  const doc = new jsPDF({
    orientation,
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
  doc.setTextColor(31, 41, 55);
  doc.text(title, pageWidth / 2, currentY, { align: 'center' });
  currentY += 8;

  if (subtitle) {
    doc.setFontSize(11);
    setThaiFont(doc, 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(subtitle, pageWidth / 2, currentY, { align: 'center' });
    currentY += 7;
  }

  doc.setFontSize(9);
  doc.text(companyName, pageWidth / 2, currentY, { align: 'center' });
  currentY += 4;
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, currentY, {
    align: 'center',
  });
  currentY += 10;

  // Table
  autoTable(doc, {
    startY: currentY,
    head: [
      [
        'Employee Code',
        'Name',
        'Department',
        'Sick\nBalance',
        'Sick\nUsed',
        'Annual\nBalance',
        'Annual\nUsed',
        'Personal\nBalance',
        'Personal\nUsed',
      ],
    ],
    body: balances.map((balance) => [
      balance.employee_code,
      balance.employee_name_en || balance.employee_name_th,
      balance.department_name_en || balance.department_name_th,
      balance.sick_leave_balance || 0,
      balance.sick_leave_used || 0,
      balance.annual_leave_balance || 0,
      balance.annual_leave_used || 0,
      balance.personal_leave_balance || 0,
      balance.personal_leave_used || 0,
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      font: 'Sarabun',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [31, 41, 55],
      font: 'Sarabun',
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    styles: {
      font: 'Sarabun',
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 35 },
      2: { cellWidth: 30 },
      3: { halign: 'center', cellWidth: 15 },
      4: { halign: 'center', cellWidth: 15 },
      5: { halign: 'center', cellWidth: 15 },
      6: { halign: 'center', cellWidth: 15 },
      7: { halign: 'center', cellWidth: 15 },
      8: { halign: 'center', cellWidth: 15 },
    },
    margin: { left: 10, right: 10 },
  });

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.text(
      'Confidential - SSTH Internal Use Only',
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  const filename = `Leave_Balance_Report_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

/**
 * Professional PDF Export for Company Holidays with Calendar & List View
 */
export function exportCompanyHolidaysPDF(
  holidays: any[],
  options: PDFExportOptions
) {
  const {
    title,
    subtitle,
    companyName = 'Portfolio Leave Demo',
  } = options;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Initialize Thai font support
  addThaiFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // =====================
  // PAGE 1: CALENDAR VIEW
  // =====================

  let currentY = 15;

  // Header Text
  doc.setFontSize(24);
  setThaiFont(doc, 'bold');
  doc.setTextColor(30, 58, 138); // Blue-800
  doc.text(companyName, pageWidth / 2, currentY, { align: 'center' });
  currentY += 10;

  doc.setFontSize(18);
  doc.setTextColor(31, 41, 55); // Gray-800
  doc.text(title, pageWidth / 2, currentY, { align: 'center' });
  currentY += 8;

  if (subtitle) {
    doc.setFontSize(12);
    setThaiFont(doc, 'normal');
    doc.setTextColor(107, 114, 128); // Gray-500
    doc.text(subtitle, pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;
  } else {
    currentY += 5;
  }

  // Draw 12 Months Grid (3 Rows x 4 Columns)
  const marginX = 10;
  const marginY = currentY;
  const gridGapX = 8;
  const gridGapY = 8;
  const cols = 4;
  const rows = 3;

  const boxWidth = (pageWidth - (marginX * 2) - (gridGapX * (cols - 1))) / cols;
  const boxHeight = (pageHeight - marginY - 10 - (gridGapY * (rows - 1))) / rows;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthNamesTh = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const daysHeader = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Determine year
  const year = holidays.length > 0 ? new Date(holidays[0].holiday_date).getFullYear() : new Date().getFullYear();

  for (let m = 0; m < 12; m++) {
    const row = Math.floor(m / cols);
    const col = m % cols;

    const x = marginX + (col * (boxWidth + gridGapX));
    const y = marginY + (row * (boxHeight + gridGapY));

    // Background for Month Header
    doc.setFillColor(243, 244, 246); // Gray-100
    doc.roundedRect(x, y, boxWidth, 8, 2, 2, 'F');

    // Month Name
    doc.setFontSize(10);
    setThaiFont(doc, 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text(`${monthNamesTh[m]} ${monthNames[m]}`, x + (boxWidth / 2), y + 5.5, { align: 'center' });

    // Days Header
    const contentY = y + 12;
    const cellWidth = boxWidth / 7;
    const cellHeight = 5;

    doc.setFontSize(7);
    setThaiFont(doc, 'bold');
    daysHeader.forEach((d, i) => {
      const dx = x + (i * cellWidth);
      if (i === 0) doc.setTextColor(220, 38, 38); // Red Sun
      else if (i === 6) doc.setTextColor(37, 99, 235); // Blue Sat
      else doc.setTextColor(107, 114, 128); // Gray

      doc.text(d, dx + (cellWidth / 2), contentY, { align: 'center' });
    });

    // Days Grid
    const date = new Date(year, m, 1);
    const firstDay = date.getDay();
    const daysInMonth = new Date(year, m + 1, 0).getDate();

    let currentDay = 1;
    let line = 1;

    doc.setFontSize(7);
    setThaiFont(doc, 'normal');

    while (currentDay <= daysInMonth) {
      const dy = contentY + (line * cellHeight);

      for (let i = 0; i < 7; i++) {
        if (line === 1 && i < firstDay) {
          continue;
        }

        if (currentDay > daysInMonth) break;

        const dx = x + (i * cellWidth);

        // Check holiday
        const isHoliday = holidays.some((h: any) => {
          const hd = new Date(h.holiday_date);
          return hd.getDate() === currentDay && hd.getMonth() === m && hd.getFullYear() === year;
        });

        if (isHoliday) {
          // Holiday Highlight
          doc.setFillColor(254, 243, 199); // Amber-100
          doc.setDrawColor(245, 158, 11); // Amber-500
          doc.circle(dx + (cellWidth / 2), dy - 1.5, 2.8, 'FD');
          doc.setTextColor(180, 83, 9); // Amber-900
          setThaiFont(doc, 'bold');
        } else {
          // Normal Day
          const isWeekend = i === 0 || i === 6;
          if (isWeekend) doc.setTextColor(156, 163, 175);
          else doc.setTextColor(75, 85, 99);
          setThaiFont(doc, 'normal');
        }

        doc.text(String(currentDay), dx + (cellWidth / 2), dy, { align: 'center' });
        currentDay++;
      }
      line++;
    }

    // Border
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'S');
  }

  // Page 1 Footer
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 10, pageHeight - 5, { align: 'right' });

  // =====================
  // PAGE 2: LIST VIEW
  // =====================
  doc.addPage();

  currentY = 20;
  doc.setFontSize(16);
  setThaiFont(doc, 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text('รายการวันหยุด (Holiday List)', pageWidth / 2, currentY, { align: 'center' });
  currentY += 10;

  // Simple List: Date, Thai Name, English Name
  autoTable(doc, {
    startY: currentY,
    head: [
      [
        'Date',
        'Holiday Name (Thai)',
        'Holiday Name (English)',
      ],
    ],
    body: holidays.map((holiday: any) => {
      const date = new Date(holiday.holiday_date);
      const dateStr = date.toLocaleDateString('th-TH', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });

      return [
        dateStr,
        holiday.name_th || '',
        holiday.name_en || '',
      ];
    }),
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138], // Blue-800
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center',
      font: 'Sarabun',
    },
    bodyStyles: {
      fontSize: 10,
      textColor: [31, 41, 55],
      font: 'Sarabun',
      cellPadding: 4,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251], // Gray-50
    },
    styles: {
      font: 'Sarabun',
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 'auto' },
    },
    margin: { left: 20, right: 20 },
  });

  // Footer (Page 2+)
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Page ${i} of ${totalPages} - ${companyName}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
  }

  const filename = `Company_Holidays_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
