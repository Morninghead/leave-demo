import * as XLSX from 'xlsx';

export function exportToExcel(data: any[], filename: string, sheetName: string = 'Sheet1') {
  // สร้าง workbook
  const wb = XLSX.utils.book_new();
  
  // สร้าง worksheet จากข้อมูล
  const ws = XLSX.utils.json_to_sheet(data);
  
  // เพิ่ม worksheet เข้า workbook
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  // Export เป็นไฟล์
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportMultipleSheets(
  sheets: Array<{ name: string; data: any[] }>,
  filename: string
) {
  const wb = XLSX.utils.book_new();
  
  sheets.forEach(sheet => {
    const ws = XLSX.utils.json_to_sheet(sheet.data);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  });
  
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
