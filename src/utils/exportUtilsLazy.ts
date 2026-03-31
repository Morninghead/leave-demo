// Lazy-loaded export utilities to reduce initial bundle size

export const lazyExportToExcel = async (data: any[], filename: string, sheetName: string = 'Sheet1') => {
  const { exportToExcel } = await import('./exportUtils');
  return exportToExcel(data, filename, sheetName);
};

export const lazyExportMultipleSheets = async (
  sheets: Array<{ name: string; data: any[] }>,
  filename: string
) => {
  const { exportMultipleSheets } = await import('./exportUtils');
  return exportMultipleSheets(sheets, filename);
};

export const lazyExportToPDF = async (
  data: any[],
  columns: any[],
  filename: string,
  options: any = { title: 'Report' }
) => {
  const { exportToPDF } = await import('./exportToPDF');
  return exportToPDF(data, columns, filename, options);
};

export const lazyExportToPDFWithCharts = async (
  data: any[],
  columns: any[],
  chartElementIds: string[],
  filename: string,
  options: any = { title: 'Report' }
) => {
  const { exportToPDFWithCharts } = await import('./exportToPDF');
  return exportToPDFWithCharts(data, columns, chartElementIds, filename, options);
};

export const lazyExportSummaryPDF = async (
  summaryData: { label: string; value: string | number }[],
  filename: string,
  title: string
) => {
  const { exportSummaryPDF } = await import('./exportToPDF');
  return exportSummaryPDF(summaryData, filename, title);
};

export const lazyExportToExcelEnhanced = async (
  data: any[],
  filename: string,
  options: any = {}
) => {
  const { exportToExcel: exportToExcelEnhanced } = await import('./exportToExcel');
  return exportToExcelEnhanced(data, filename, options);
};

export const lazyExportMultipleSheetsEnhanced = async (
  sheets: Array<{ name: string; data: any[] }>,
  filename: string,
  options: any = {}
) => {
  const { exportMultipleSheets: exportMultipleSheetsEnhanced } = await import('./exportToExcel');
  return exportMultipleSheetsEnhanced(sheets, filename, options);
};

export const lazyExportWithSummary = async (
  summaryData: { label: string; value: string | number }[],
  detailSheets: Array<{ name: string; data: any[] }>,
  filename: string,
  options: any = {}
) => {
  const { exportWithSummary } = await import('./exportToExcel');
  return exportWithSummary(summaryData, detailSheets, filename, options);
};