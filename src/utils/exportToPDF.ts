import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { addThaiFont } from './pdfFonts';

interface PDFExportOptions {
  title: string;
  subtitle?: string;
  orientation?: 'portrait' | 'landscape';
  companyName?: string;
  includeTimestamp?: boolean;
  includePageNumbers?: boolean;
}

interface TableColumn {
  header: string;
  dataKey: string;
}

/**
 * Export data to professional PDF with company branding
 */
export async function exportToPDF(
  data: any[],
  columns: TableColumn[],
  filename: string,
  options: PDFExportOptions = { title: 'Report' }
) {
  const {
    title,
    subtitle,
    orientation = 'portrait',
    companyName = 'Portfolio Leave Demo',
    includeTimestamp = true,
    includePageNumbers = true,
  } = options;

  // Create PDF document
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  // Add Thai font support
  addThaiFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 20;

  // Company Name (Top)
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont('Sarabun', 'normal');
  doc.text(companyName || '', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  // Report Title
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.setFont('Sarabun', 'bold');
  doc.text(title, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  // Subtitle (if provided)
  if (subtitle) {
    doc.setFontSize(12);
    doc.setFont('Sarabun', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
  }

  // Timestamp
  if (includeTimestamp) {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    const timestamp = new Date().toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    doc.text(`Generated: ${timestamp}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;
  }

  // Separator line
  doc.setDrawColor(200, 200, 200);
  doc.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 5;

  // Create table
  autoTable(doc, {
    startY: yPosition,
    head: [columns.map(col => col.header)],
    body: data.map(row => columns.map(col => row[col.dataKey] ?? '-')),
    styles: {
      fontSize: 9,
      cellPadding: 3,
      font: 'Sarabun',
    },
    headStyles: {
      fillColor: [59, 130, 246], // Blue color
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251], // Light gray
    },
    margin: { left: 15, right: 15 },
    theme: 'striped',
    didDrawPage: (_data) => {
      // Footer with page numbers
      if (includePageNumbers) {
        const pageCount = (doc as any).internal.getNumberOfPages();
        const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;

        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(
          `Page ${currentPage} of ${pageCount}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );

        // Footer line
        doc.setDrawColor(200, 200, 200);
        doc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);
      }
    },
  });

  // Save PDF
  doc.save(`${filename}.pdf`);
}

/**
 * Export PDF with embedded charts
 */
export async function exportToPDFWithCharts(
  data: any[],
  columns: TableColumn[],
  chartElementIds: string[],
  filename: string,
  options: PDFExportOptions = { title: 'Report' }
) {
  const {
    title,
    subtitle,
    orientation = 'portrait',
    companyName = 'Portfolio Leave Demo',
    includeTimestamp = true,
    includePageNumbers = true,
  } = options;

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  // Add Thai font support
  addThaiFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 20;

  // Header
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont('Sarabun', 'normal');
  doc.text(companyName || '', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.setFont('Sarabun', 'bold');
  doc.text(title, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  if (subtitle) {
    doc.setFontSize(12);
    doc.setFont('Sarabun', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
  }

  if (includeTimestamp) {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    const timestamp = new Date().toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    doc.text(`Generated: ${timestamp}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 10;

  // Capture and embed charts
  for (const chartId of chartElementIds) {
    const chartElement = document.getElementById(chartId);
    if (chartElement) {
      try {
        const canvas = await html2canvas(chartElement, {
          scale: 2,
          backgroundColor: '#ffffff',
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - 30;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        // Check if we need a new page
        if (yPosition + imgHeight > pageHeight - 30) {
          doc.addPage();
          yPosition = 20;
        }

        doc.addImage(imgData, 'PNG', 15, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 10;
      } catch (error) {
        console.error(`Failed to capture chart ${chartId}:`, error);
      }
    }
  }

  // Add new page for table
  doc.addPage();
  yPosition = 20;

  // Table title
  doc.setFontSize(14);
  doc.setFont('Sarabun', 'bold');
  doc.text('Detailed Data', 15, yPosition);
  yPosition += 10;

  // Create table
  autoTable(doc, {
    startY: yPosition,
    head: [columns.map(col => col.header)],
    body: data.map(row => columns.map(col => row[col.dataKey] ?? '-')),
    styles: {
      fontSize: 8,
      cellPadding: 2,
      font: 'Sarabun',
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    margin: { left: 15, right: 15 },
    theme: 'striped',
    didDrawPage: (_data) => {
      if (includePageNumbers) {
        const pageCount = (doc as any).internal.getNumberOfPages();
        const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;

        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(
          `Page ${currentPage} of ${pageCount}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );

        doc.setDrawColor(200, 200, 200);
        doc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);
      }
    },
  });

  doc.save(`${filename}.pdf`);
}

/**
 * Export summary PDF with key metrics
 */
export function exportSummaryPDF(
  summaryData: { label: string; value: string | number }[],
  filename: string,
  title: string
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Add Thai font support
  addThaiFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 30;

  // Title
  doc.setFontSize(20);
  doc.setFont('Sarabun', 'bold');
  doc.text(title, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Company name
  doc.setFontSize(10);
  doc.setFont('Sarabun', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Portfolio Leave Demo', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 20;

  // Summary boxes
  summaryData.forEach((item, _index) => {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 30;
    }

    // Box background
    doc.setFillColor(249, 250, 251);
    doc.rect(30, yPosition, pageWidth - 60, 20, 'F');

    // Label
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(item.label, 35, yPosition + 8);

    // Value
    doc.setFontSize(16);
    doc.setFont('Sarabun', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(String(item.value), 35, yPosition + 16);

    yPosition += 25;
  });

  // Timestamp
  yPosition += 10;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  const timestamp = new Date().toLocaleString('th-TH', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  doc.text(`Generated: ${timestamp}`, pageWidth / 2, yPosition, { align: 'center' });

  doc.save(`${filename}.pdf`);
}
