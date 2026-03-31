/**
 * Centralized Export Service
 *
 * ระบบส่งออกแบบรวมศูนย์ที่รองรับภาษาไทย
 * Central export system with full Thai language support
 *
 * All pages should use this service for consistent exports
 * with proper Thai vowel and tone mark rendering
 */

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addThaiFont, setThaiFont } from '../utils/pdfFonts';

// ============================================================================
// Type Definitions
// ============================================================================

export type ExportFormat = 'pdf' | 'excel' | 'both';
export type PDFOrientation = 'portrait' | 'landscape';
export type PDFPageSize = 'a4' | 'a3' | 'letter';

export interface ExportColumn {
  key: string;
  label: string;
  width?: number; // for PDF (mm) and Excel (characters)
  align?: 'left' | 'center' | 'right';
  format?: (value: any) => string; // Custom formatting function
}

export interface ExportOptions {
  // Common options
  title: string;
  subtitle?: string;
  filename: string;
  format: ExportFormat;

  // Data
  columns: ExportColumn[];
  data: any[];

  // PDF specific
  pdfOrientation?: PDFOrientation;
  pdfPageSize?: PDFPageSize;
  pdfHeaderColor?: [number, number, number]; // RGB

  // Excel specific
  sheetName?: string;
  excelHeaderColor?: string; // Hex color

  // Optional metadata
  generatedBy?: string;
  reportDate?: string;
  companyName?: string;
  documentNumber?: string;

  // Signatures (for PDF)
  signatures?: Array<{
    label: string;
    showDate: boolean;
  }>;
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Export data to PDF, Excel, or both
 * รองรับการส่งออกเป็น PDF, Excel หรือทั้งสองอย่าง
 */
export async function exportData(options: ExportOptions): Promise<void> {
  try {
    if (options.format === 'pdf' || options.format === 'both') {
      await exportToPDF(options);
    }

    if (options.format === 'excel' || options.format === 'both') {
      await exportToExcel(options);
    }
  } catch (error) {
    console.error('Export failed:', error);
    throw new Error(`การส่งออกล้มเหลว / Export failed: ${error}`);
  }
}

// ============================================================================
// PDF Export
// ============================================================================

async function exportToPDF(options: ExportOptions): Promise<void> {
  const {
    title,
    subtitle,
    filename,
    columns,
    data,
    pdfOrientation = 'landscape',
    pdfPageSize = 'a4',
    pdfHeaderColor = [59, 130, 246], // Blue
    generatedBy,
    reportDate,
    companyName = 'Portfolio Leave Demo',
    documentNumber,
    signatures = [],
  } = options;

  // Create PDF document
  const doc = new jsPDF({
    orientation: pdfOrientation,
    unit: 'mm',
    format: pdfPageSize,
  });

  // Initialize Thai font support (CRITICAL for Thai vowels and tone marks)
  addThaiFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let currentY = 15;

  // Title
  doc.setFontSize(16);
  setThaiFont(doc, 'bold');
  doc.text(title, pageWidth / 2, currentY, { align: 'center' });
  currentY += 7;

  // Subtitle
  if (subtitle) {
    doc.setFontSize(12);
    setThaiFont(doc, 'normal');
    doc.text(subtitle, pageWidth / 2, currentY, { align: 'center' });
    currentY += 7;
  }

  // Metadata
  doc.setFontSize(10);
  doc.text(companyName, pageWidth / 2, currentY, { align: 'center' });
  currentY += 5;

  if (documentNumber) {
    doc.text(`เลขที่เอกสาร / Document No: ${documentNumber}`, pageWidth - 20, 15, { align: 'right' });
  }

  doc.text(`วันที่สร้าง / Generated: ${reportDate || new Date().toLocaleString('th-TH')}`, pageWidth / 2, currentY, { align: 'center' });
  currentY += 5;

  if (generatedBy) {
    doc.text(`โดย / By: ${generatedBy}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 5;
  }

  currentY += 5;

  // Prepare table data
  const headers = columns.map(col => col.label);
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      return col.format ? col.format(value) : String(value || '');
    })
  );

  // Calculate column widths and table centering
  const totalDefinedWidth = columns.reduce((sum, col) => sum + (col.width || 0), 0);
  const autoWidthColumns = columns.filter(col => !col.width).length;
  const availableWidth = pageWidth - 40; // 20mm margins on each side
  const autoWidth = autoWidthColumns > 0
    ? (availableWidth - totalDefinedWidth) / autoWidthColumns
    : 0;

  const columnStyles: any = {};
  columns.forEach((col, index) => {
    columnStyles[index] = {
      cellWidth: col.width || autoWidth,
      halign: col.align || 'left',
    };
  });

  const totalTableWidth = columns.reduce((sum, col) => sum + (col.width || autoWidth), 0);
  const leftMargin = (pageWidth - totalTableWidth) / 2;

  // Generate table
  autoTable(doc, {
    startY: currentY,
    head: [headers],
    body: rows,
    theme: 'grid',
    styles: {
      font: 'Sarabun',
      fontSize: pdfOrientation === 'portrait' ? 10 : 8,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: pdfHeaderColor,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: pdfOrientation === 'portrait' ? 11 : 9,
      halign: 'center',
      valign: 'middle',
    },
    columnStyles: columnStyles,
    margin: { left: leftMargin, right: leftMargin },
    tableWidth: totalTableWidth,
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // Signatures section
  if (signatures.length > 0) {
    addPDFSignatures(doc, signatures, currentY, pageWidth, pageHeight);
  }

  // Footer
  addPDFFooter(doc, pageWidth, pageHeight);

  // Save
  doc.save(`${filename}.pdf`);
}

function addPDFSignatures(
  doc: jsPDF,
  signatures: Array<{ label: string; showDate: boolean }>,
  startY: number,
  pageWidth: number,
  pageHeight: number
) {
  let currentY = startY;

  if (currentY > pageHeight - 60) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFontSize(12);
  setThaiFont(doc, 'bold');
  doc.text('ลายเซ็น / Signatures', 20, currentY);
  currentY += 10;

  const boxWidth = (pageWidth - 60) / signatures.length;
  const boxHeight = 35;

  signatures.forEach((sig, index) => {
    const x = 20 + index * (boxWidth + 10);

    // Draw box
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.5);
    doc.rect(x, currentY, boxWidth, boxHeight);

    // Label
    doc.setFontSize(9);
    setThaiFont(doc, 'bold');
    doc.text(sig.label, x + boxWidth / 2, currentY + 5, { align: 'center' });

    // Signature line
    doc.setLineWidth(0.3);
    doc.line(x + 5, currentY + 20, x + boxWidth - 5, currentY + 20);
    doc.setFontSize(8);
    setThaiFont(doc, 'normal');
    doc.text('ลายเซ็น / Signature', x + boxWidth / 2, currentY + 23, { align: 'center' });

    if (sig.showDate) {
      doc.text('วันที่ / Date: ______________', x + 5, currentY + boxHeight - 2);
    }
  });
}

function addPDFFooter(doc: jsPDF, pageWidth: number, pageHeight: number) {
  const pageCount = doc.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`หน้า / Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text('CONFIDENTIAL - For Internal Use Only', pageWidth / 2, pageHeight - 5, { align: 'center' });
  }
}

// ============================================================================
// Excel Export
// ============================================================================

async function exportToExcel(options: ExportOptions): Promise<void> {
  const {
    title,
    filename,
    columns,
    data,
    sheetName = 'Report',
    excelHeaderColor = '3B82F6',
    generatedBy,
    reportDate,
    companyName = 'Portfolio Leave Demo',
  } = options;

  const wb = XLSX.utils.book_new();

  // Add metadata
  wb.Props = {
    Title: title,
    Subject: 'Leave Management Report',
    Author: companyName,
    CreatedDate: new Date(),
  };

  // Prepare data for Excel
  const excelData = data.map(row => {
    const excelRow: any = {};
    columns.forEach(col => {
      const value = row[col.key];
      excelRow[col.label] = col.format ? col.format(value) : value;
    });
    return excelRow;
  });

  const ws = XLSX.utils.json_to_sheet(excelData);
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  // Style header row with Thai font support (Cordia New is native Windows Thai font)
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellAddress]) continue;

    ws[cellAddress].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Cordia New', sz: 14 },
      fill: { fgColor: { rgb: excelHeaderColor } },
      alignment: { horizontal: 'center', vertical: 'center' },
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
          alignment: { wrapText: true, vertical: 'top', horizontal: columns[col].align || 'left' },
        };
      }
    }
  }

  // Auto-fit columns with Thai text width calculation
  const colWidths: { wch: number }[] = [];
  columns.forEach((col, colIndex) => {
    if (col.width) {
      // Use specified width
      colWidths.push({ wch: col.width });
    } else {
      // Calculate width based on content
      let maxWidth = col.label.length * 1.2; // Header width
      for (let row = range.s.r + 1; row <= range.e.r; row++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: colIndex });
        if (ws[cellAddress] && ws[cellAddress].v) {
          const cellValue = String(ws[cellAddress].v);
          const thaiTextWidth = cellValue.length * 1.2; // Thai characters need more width
          maxWidth = Math.max(maxWidth, thaiTextWidth);
        }
      }
      colWidths.push({ wch: Math.min(maxWidth + 3, 60) });
    }
  });
  ws['!cols'] = colWidths;

  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Write file with proper UTF-8 encoding for Thai text
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
  link.download = `${filename}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format date for Thai display
 * แสดงวันที่ในรูปแบบภาษาไทย
 */
export function formatDateThai(date: Date | string): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format number with Thai locale
 * แสดงตัวเลขในรูปแบบภาษาไทย
 */
export function formatNumberThai(num: number): string {
  return num.toLocaleString('th-TH');
}
