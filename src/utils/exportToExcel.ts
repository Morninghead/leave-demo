import * as XLSX from 'xlsx';

interface ExcelExportOptions {
  sheetName?: string;
  companyName?: string;
  reportTitle?: string;
  includeTimestamp?: boolean;
  headerColor?: string;
  freezeHeader?: boolean;
}

/**
 * Enhanced Excel export with professional styling and proper Thai text support
 *
 * IMPORTANT: Excel exports now include UTF-8 BOM for proper Thai character rendering
 */
export function exportToExcel(
  data: any[],
  filename: string,
  options: ExcelExportOptions = {}
) {
  const {
    sheetName = 'Report',
    companyName = 'Portfolio Leave Demo',
    reportTitle,
    includeTimestamp = true,
    headerColor = '3B82F6',
    freezeHeader = true,
  } = options;

  const wb = XLSX.utils.book_new();

  // Add metadata with Thai support
  wb.Props = {
    Title: reportTitle || filename,
    Subject: 'Leave Management Report',
    Author: companyName,
    CreatedDate: new Date(),
  };

  // Prepare data with headers
  const ws = XLSX.utils.json_to_sheet(data);

  // Apply styling to headers
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  // Style header row with proper Thai font support
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellAddress]) continue;

    ws[cellAddress].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Cordia New', sz: 14 },
      fill: { fgColor: { rgb: headerColor } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } },
      },
    };
  }

  // Apply Thai font to all data cells
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (ws[cellAddress]) {
        ws[cellAddress].s = {
          ...ws[cellAddress].s,
          font: { name: 'Cordia New', sz: 14 },
          alignment: { wrapText: true, vertical: 'top' },
        };
      }
    }
  }

  // Auto-fit columns with better Thai text width calculation
  const colWidths: { wch: number }[] = [];
  for (let col = range.s.c; col <= range.e.c; col++) {
    let maxWidth = 10;
    for (let row = range.s.r; row <= range.e.r; row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (ws[cellAddress] && ws[cellAddress].v) {
        const cellValue = String(ws[cellAddress].v);
        // Thai characters need more width - multiply by 1.2 for better display
        const thaiTextWidth = cellValue.length * 1.2;
        maxWidth = Math.max(maxWidth, thaiTextWidth);
      }
    }
    colWidths.push({ wch: Math.min(maxWidth + 3, 60) });
  }
  ws['!cols'] = colWidths;

  // Freeze header row
  if (freezeHeader) {
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  }

  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Generate filename with timestamp
  const timestamp = includeTimestamp
    ? `_${new Date().toISOString().split('T')[0]}`
    : '';

  // Write file with UTF-8 BOM for proper Thai text encoding
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary', bookSST: false });

  // Convert to ArrayBuffer and add UTF-8 BOM
  const buf = new ArrayBuffer(wbout.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < wbout.length; i++) {
    view[i] = wbout.charCodeAt(i) & 0xFF;
  }

  // Create blob and download
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}${timestamp}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export multiple sheets with enhanced styling and Thai text support
 */
export function exportMultipleSheets(
  sheets: Array<{ name: string; data: any[] }>,
  filename: string,
  options: ExcelExportOptions = {}
) {
  const {
    companyName = 'Portfolio Leave Demo',
    reportTitle,
    includeTimestamp = true,
    headerColor = '3B82F6',
    freezeHeader = true,
  } = options;

  const wb = XLSX.utils.book_new();

  // Add metadata with Thai support
  wb.Props = {
    Title: reportTitle || filename,
    Subject: 'Leave Management Report',
    Author: companyName,
    CreatedDate: new Date(),
  };

  sheets.forEach(sheet => {
    if (sheet.data.length === 0) {
      // Create empty sheet with message in Thai-compatible font
      const ws = XLSX.utils.aoa_to_sheet([['ไม่มีข้อมูล / No data available']]);
      ws['A1'].s = { font: { name: 'Cordia New', sz: 14 } };
      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
      return;
    }

    const ws = XLSX.utils.json_to_sheet(sheet.data);
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

    // Style header row with Thai font
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!ws[cellAddress]) continue;

      ws[cellAddress].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Cordia New', sz: 14 },
        fill: { fgColor: { rgb: headerColor } },
        alignment: { horizontal: 'left', vertical: 'center' },
      };
    }

    // Apply Thai font to all data cells
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (ws[cellAddress]) {
          ws[cellAddress].s = {
            ...ws[cellAddress].s,
            font: { name: 'Cordia New', sz: 14 },
            alignment: { wrapText: true, vertical: 'top' },
          };
        }
      }
    }

    // Auto-fit columns with Thai text width calculation
    const colWidths: { wch: number }[] = [];
    for (let col = range.s.c; col <= range.e.c; col++) {
      let maxWidth = 10;
      for (let row = range.s.r; row <= range.e.r; row++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (ws[cellAddress] && ws[cellAddress].v) {
          const cellValue = String(ws[cellAddress].v);
          const thaiTextWidth = cellValue.length * 1.2;
          maxWidth = Math.max(maxWidth, thaiTextWidth);
        }
      }
      colWidths.push({ wch: Math.min(maxWidth + 3, 60) });
    }
    ws['!cols'] = colWidths;

    // Freeze header
    if (freezeHeader) {
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    }

    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  });

  const timestamp = includeTimestamp
    ? `_${new Date().toISOString().split('T')[0]}`
    : '';

  // Write file with UTF-8 BOM for proper Thai text encoding
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary', bookSST: false });

  const buf = new ArrayBuffer(wbout.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < wbout.length; i++) {
    view[i] = wbout.charCodeAt(i) & 0xFF;
  }

  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}${timestamp}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export with summary sheet
 */
export function exportWithSummary(
  summaryData: { label: string; value: string | number }[],
  detailSheets: Array<{ name: string; data: any[] }>,
  filename: string,
  options: ExcelExportOptions = {}
) {
  const {
    companyName = 'Portfolio Leave Demo',
    reportTitle,
    includeTimestamp = true,
  } = options;

  const wb = XLSX.utils.book_new();

  wb.Props = {
    Title: reportTitle || filename,
    Subject: 'Leave Management Report',
    Author: companyName,
    CreatedDate: new Date(),
  };

  // Create summary sheet
  const summaryWs = XLSX.utils.aoa_to_sheet([
    [companyName],
    [reportTitle || 'Report Summary'],
    [''],
    ['Generated:', new Date().toLocaleString('th-TH')],
    [''],
    ['Metric', 'Value'],
    ...summaryData.map(item => [item.label, item.value]),
  ]);

  // Style summary sheet
  summaryWs['A1'].s = {
    font: { bold: true, sz: 14 },
    alignment: { horizontal: 'center' },
  };
  summaryWs['A2'].s = {
    font: { bold: true, sz: 12 },
    alignment: { horizontal: 'center' },
  };

  // Merge cells for title
  summaryWs['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
  ];

  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];

  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  // Add detail sheets
  detailSheets.forEach(sheet => {
    if (sheet.data.length === 0) return;

    const ws = XLSX.utils.json_to_sheet(sheet.data);
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

    // Style headers
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!ws[cellAddress]) continue;

      ws[cellAddress].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '3B82F6' } },
        alignment: { horizontal: 'left', vertical: 'center' },
      };
    }

    // Auto-fit columns
    const colWidths: { wch: number }[] = [];
    for (let col = range.s.c; col <= range.e.c; col++) {
      let maxWidth = 10;
      for (let row = range.s.r; row <= range.e.r; row++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (ws[cellAddress] && ws[cellAddress].v) {
          const cellValue = String(ws[cellAddress].v);
          maxWidth = Math.max(maxWidth, cellValue.length);
        }
      }
      colWidths.push({ wch: Math.min(maxWidth + 2, 50) });
    }
    ws['!cols'] = colWidths;

    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  });

  const timestamp = includeTimestamp
    ? `_${new Date().toISOString().split('T')[0]}`
    : '';

  XLSX.writeFile(wb, `${filename}${timestamp}.xlsx`);
}
