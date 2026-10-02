// Heavy export libraries are loaded on demand so they stay out of the
// initial bundle and only download when a user actually exports.
async function loadXLSX() {
  return await import('xlsx');
}

async function loadPDF() {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  return { jsPDF, autoTable };
}

export async function exportToExcel(data: any[], filename: string) {
  const XLSX = await loadXLSX();
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export async function exportToPDF(data: any[], columns: string[], filename: string, title: string) {
  const { jsPDF, autoTable } = await loadPDF();
  const doc = new jsPDF();

  // Add title
  doc.setFontSize(18);
  doc.text(title, 14, 20);

  // Add date
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

  // Prepare table data
  const headers = [columns];
  const rows = data.map(row => columns.map(col => row[col] || ''));

  // Add table
  autoTable(doc, {
    head: headers,
    body: rows,
    startY: 35,
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235] },
  });

  doc.save(`${filename}.pdf`);
}
