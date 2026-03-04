import Papa from 'papaparse';

/**
 * Export an array of objects to a CSV file and trigger download.
 */
export function exportToCsv(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) return;
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
