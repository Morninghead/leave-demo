/**
 * Export data to CSV format with UTF-8 BOM for Thai language support
 */
export function exportToCSV(
  data: any[],
  filename: string,
  includeTimestamp: boolean = true
) {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);

  // Create CSV content
  const csvRows = [];

  // Add header row
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];

      // Handle different data types
      if (value === null || value === undefined) {
        return '';
      }

      // Escape quotes and wrap in quotes if contains comma, newline, or quote
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    });

    csvRows.push(values.join(','));
  }

  const csvContent = csvRows.join('\n');

  // Add UTF-8 BOM for proper Thai character encoding
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  // Create download link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  const timestamp = includeTimestamp
    ? `_${new Date().toISOString().split('T')[0]}`
    : '';

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}${timestamp}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export multiple datasets to separate CSV files (zipped would require additional library)
 * For now, we'll download them sequentially
 */
export function exportMultipleCSV(
  datasets: Array<{ name: string; data: any[] }>,
  baseFilename: string
) {
  datasets.forEach((dataset, index) => {
    if (dataset.data.length > 0) {
      // Add slight delay between downloads to prevent browser blocking
      setTimeout(() => {
        exportToCSV(dataset.data, `${baseFilename}_${dataset.name}`, true);
      }, index * 200);
    }
  });
}
