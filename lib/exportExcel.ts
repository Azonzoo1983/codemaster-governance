import * as XLSX from 'xlsx';
import { RequestItem, Priority, User } from '../types';

/**
 * Auto-size worksheet columns based on content width.
 */
function autoFitColumns(ws: XLSX.WorkSheet, data: Record<string, unknown>[]): void {
  if (data.length === 0) return;
  const keys = Object.keys(data[0]);
  const colWidths = keys.map((key) => {
    const maxContent = Math.max(
      key.length,
      ...data.map((row) => String(row[key] ?? '').length)
    );
    return { wch: Math.min(maxContent + 2, 60) };
  });
  ws['!cols'] = colWidths;
}

/**
 * Trigger a browser download for the given workbook.
 */
function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void {
  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbOut], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export requests data to an Excel (.xlsx) file with a "Requests" sheet.
 */
export function exportRequestsToExcel(
  requests: RequestItem[],
  priorities: Priority[],
  users: User[],
  filename?: string
): void {
  if (requests.length === 0) return;

  const priorityMap = new Map(priorities.map((p) => [p.id, p.name]));
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const rows = requests.map((r) => ({
    ID: r.id,
    Title: r.title,
    Classification: r.classification,
    'Sub-Type': r.materialSubType || r.serviceSubType || '',
    Status: r.status,
    Priority: priorityMap.get(r.priorityId) || '',
    Project: r.project || '',
    Requester: userMap.get(r.requesterId) || '',
    Specialist: r.assignedSpecialistId ? userMap.get(r.assignedSpecialistId) || '' : '',
    Created: new Date(r.createdAt).toLocaleDateString(),
    Updated: new Date(r.updatedAt).toLocaleDateString(),
    'SLA Hours': priorities.find((p) => p.id === r.priorityId)?.slaHours ?? '',
    'Oracle Code': r.oracleCode || '',
    Description: r.description || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  autoFitColumns(ws, rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Requests');

  const defaultName = `codemaster-requests-${new Date().toISOString().slice(0, 10)}`;
  downloadWorkbook(wb, filename || defaultName);
}

/**
 * Export a flattened audit log from all requests to an Excel (.xlsx) file.
 */
export function exportAuditLogToExcel(
  requests: RequestItem[],
  users: User[],
  filename?: string
): void {
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const rows: Record<string, unknown>[] = [];

  requests.forEach((req) => {
    (req.history || []).forEach((entry) => {
      rows.push({
        'Request ID': req.id,
        'Request Title': req.title,
        Timestamp: new Date(entry.timestamp).toLocaleString(),
        Action: entry.action,
        User: userMap.get(entry.user) || entry.user,
        Details: entry.details || '',
        'Changed Fields': (entry.changedFields || [])
          .map((cf) => `${cf.field}: "${cf.oldValue}" -> "${cf.newValue}"`)
          .join('; '),
      });
    });
  });

  // Sort by timestamp descending
  rows.sort((a, b) => {
    const ta = new Date(String(a['Timestamp'])).getTime();
    const tb = new Date(String(b['Timestamp'])).getTime();
    return tb - ta;
  });

  if (rows.length === 0) return;

  const ws = XLSX.utils.json_to_sheet(rows);
  autoFitColumns(ws, rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Audit Log');

  const defaultName = `codemaster-audit-log-${new Date().toISOString().slice(0, 10)}`;
  downloadWorkbook(wb, filename || defaultName);
}
