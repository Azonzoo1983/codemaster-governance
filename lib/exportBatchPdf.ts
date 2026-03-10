import jsPDF from 'jspdf';
import { RequestItem, Priority, User, AttributeDefinition } from '../types';

const PAGE_WIDTH = 210; // A4 width in mm
const PAGE_HEIGHT = 297; // A4 height in mm
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function wrapText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  lines.forEach((line: string, i: number) => {
    doc.text(line, x, y + i * lineHeight);
  });
  return y + lines.length * lineHeight;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_HEIGHT - 25) {
    doc.addPage();
    return MARGIN + 10;
  }
  return y;
}

function drawKeyValue(doc: jsPDF, key: string, value: string, x: number, y: number, maxWidth: number): number {
  y = checkPageBreak(doc, y, 8);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139); // MEDIUM_GRAY
  doc.text(`${key}:`, x, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59); // DARK_GRAY
  const keyWidth = doc.getTextWidth(`${key}: `);
  const valueX = x + keyWidth + 2;
  const availableWidth = maxWidth - keyWidth - 2;
  if (availableWidth > 20) {
    y = wrapText(doc, value || '-', valueX, y, availableWidth, 4.5);
  } else {
    y += 4.5;
    y = wrapText(doc, value || '-', x + 4, y, maxWidth - 4, 4.5);
  }
  return y + 2;
}

function addFooters(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    const footerY = PAGE_HEIGHT - 8;
    doc.text(`Generated on ${new Date().toLocaleDateString()} | CodeMaster Governance Tool`, MARGIN, footerY);
    doc.text(`Page ${i} of ${totalPages}`, PAGE_WIDTH - MARGIN - 20, footerY);
    // Footer line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, footerY - 3, PAGE_WIDTH - MARGIN, footerY - 3);
  }
}

// =============================================
// Batch PDF Export
// =============================================
export function exportBatchPdf(
  requests: RequestItem[],
  priorities: Priority[],
  users: User[],
  attributes: AttributeDefinition[]
): void {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const today = new Date().toLocaleDateString();
  const dateSlug = new Date().toISOString().slice(0, 10);

  // ===== COVER PAGE =====
  doc.setFillColor(37, 99, 235); // BLUE
  doc.rect(0, 0, PAGE_WIDTH, 60, 'F');
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('CodeMaster Governance', MARGIN, 28);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Batch Report', MARGIN, 40);
  doc.setFontSize(10);
  doc.text(`Date: ${today}`, MARGIN, 52);

  // Summary info on cover
  let y = 80;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Report Summary', MARGIN, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Total Requests: ${requests.length}`, MARGIN, y);
  y += 7;
  const statusCounts: Record<string, number> = {};
  requests.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });
  Object.entries(statusCounts).forEach(([status, count]) => {
    doc.text(`${status}: ${count}`, MARGIN + 4, y);
    y += 6;
  });

  // ===== REQUEST PAGES =====
  requests.forEach((request) => {
    doc.addPage();
    let y = MARGIN;

    // Header bar
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, PAGE_WIDTH, 22, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`Request: ${request.id}`, MARGIN, 10);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(request.title.length > 60 ? request.title.substring(0, 58) + '...' : request.title, MARGIN, 17);
    y = 30;

    const col1X = MARGIN + 2;
    const priority = priorities.find(p => p.id === request.priorityId);
    const requester = users.find(u => u.id === request.requesterId);
    const specialist = users.find(u => u.id === request.assignedSpecialistId);

    // Request details section
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(MARGIN, y - 5, CONTENT_WIDTH, 10, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text('Request Details', MARGIN + 4, y + 2);
    doc.setTextColor(30, 41, 59);
    y += 12;

    y = drawKeyValue(doc, 'ID', request.id, col1X, y, CONTENT_WIDTH - 4);
    y = drawKeyValue(doc, 'Title', request.title, col1X, y, CONTENT_WIDTH - 4);
    y = drawKeyValue(doc, 'Status', request.status, col1X, y, CONTENT_WIDTH - 4);
    y = drawKeyValue(doc, 'Priority', priority?.name ?? 'Unknown', col1X, y, CONTENT_WIDTH - 4);
    y = drawKeyValue(doc, 'Requester', requester?.name ?? 'Unknown', col1X, y, CONTENT_WIDTH - 4);
    y = drawKeyValue(doc, 'Specialist', specialist?.name ?? 'Not assigned', col1X, y, CONTENT_WIDTH - 4);
    y = drawKeyValue(doc, 'Created', new Date(request.createdAt).toLocaleString(), col1X, y, CONTENT_WIDTH - 4);

    // Description
    y += 4;
    y = checkPageBreak(doc, y, 14);
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(MARGIN, y - 5, CONTENT_WIDTH, 10, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text('Description', MARGIN + 4, y + 2);
    doc.setTextColor(30, 41, 59);
    y += 12;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    const descText = request.description || 'No description provided.';
    y = wrapText(doc, descText, col1X, y, CONTENT_WIDTH - 4, 4.5);

    // Oracle Code if exists
    if (request.oracleCode) {
      y += 4;
      y = drawKeyValue(doc, 'Oracle Code', request.oracleCode, col1X, y, CONTENT_WIDTH - 4);
    }
  });

  // ===== SUMMARY TABLE (LAST PAGE) =====
  doc.addPage();
  let sy = MARGIN;

  // Header
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, PAGE_WIDTH, 22, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Summary Table', MARGIN, 14);
  sy = 30;

  // Table header
  doc.setFillColor(37, 99, 235);
  doc.rect(MARGIN, sy - 4, CONTENT_WIDTH, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const colId = MARGIN + 2;
  const colTitle = MARGIN + 30;
  const colStatus = MARGIN + 105;
  const colPrio = MARGIN + 155;
  doc.text('ID', colId, sy);
  doc.text('Title', colTitle, sy);
  doc.text('Status', colStatus, sy);
  doc.text('Priority', colPrio, sy);
  sy += 6;

  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  requests.forEach((req, idx) => {
    sy = checkPageBreak(doc, sy, 8);

    // Alternating row background
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(MARGIN, sy - 3.5, CONTENT_WIDTH, 6, 'F');
    }

    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(req.id.length > 14 ? req.id.substring(0, 12) + '...' : req.id, colId, sy);
    const titleText = req.title.length > 40 ? req.title.substring(0, 38) + '...' : req.title;
    doc.text(titleText, colTitle, sy);
    const statusText = req.status.length > 24 ? req.status.substring(0, 22) + '...' : req.status;
    doc.text(statusText, colStatus, sy);
    const pName = priorities.find(p => p.id === req.priorityId)?.name || 'Unknown';
    doc.text(pName, colPrio, sy);
    sy += 5.5;
  });

  // Add footers
  addFooters(doc);

  doc.save(`Batch_Report_${dateSlug}.pdf`);
}

// =============================================
// Audit Trail PDF Export
// =============================================
export function exportAuditTrailPdf(
  requests: RequestItem[],
  users: User[]
): void {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const today = new Date().toLocaleDateString();
  const dateSlug = new Date().toISOString().slice(0, 10);

  // ===== COVER PAGE =====
  doc.setFillColor(37, 99, 235); // BLUE
  doc.rect(0, 0, PAGE_WIDTH, 60, 'F');
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('CodeMaster Governance', MARGIN, 28);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Audit Trail Report', MARGIN, 40);
  doc.setFontSize(10);
  doc.text(`Date: ${today}`, MARGIN, 52);

  // Collect all history entries from all requests
  const allEntries: {
    timestamp: string;
    requestId: string;
    action: string;
    user: string;
    details: string;
  }[] = [];

  requests.forEach(req => {
    (req.history || []).forEach(log => {
      allEntries.push({
        timestamp: log.timestamp,
        requestId: req.id,
        action: log.action,
        user: log.user,
        details: log.details || '-',
      });
    });
  });

  // Sort by timestamp descending (newest first)
  allEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Summary on cover
  let y = 80;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Report Summary', MARGIN, y);
  y += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Total Audit Entries: ${allEntries.length}`, MARGIN, y);
  y += 7;
  doc.text(`Requests Covered: ${requests.length}`, MARGIN, y);

  // ===== AUDIT TABLE =====
  doc.addPage();
  y = MARGIN;

  // Header bar
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, PAGE_WIDTH, 22, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Audit Trail', MARGIN, 14);
  y = 30;

  // Table header
  doc.setFillColor(37, 99, 235);
  doc.rect(MARGIN, y - 4, CONTENT_WIDTH, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const colDate = MARGIN + 2;
  const colReqId = MARGIN + 32;
  const colAction = MARGIN + 60;
  const colUser = MARGIN + 115;
  const colDetails = MARGIN + 145;
  doc.text('Date', colDate, y);
  doc.text('Request ID', colReqId, y);
  doc.text('Action', colAction, y);
  doc.text('User', colUser, y);
  doc.text('Details', colDetails, y);
  y += 6;

  // Table rows
  doc.setFont('helvetica', 'normal');
  allEntries.forEach((entry, idx) => {
    y = checkPageBreak(doc, y, 8);

    // Re-draw table header after page break
    if (y <= MARGIN + 11) {
      doc.setFillColor(37, 99, 235);
      doc.rect(MARGIN, y - 4, CONTENT_WIDTH, 7, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Date', colDate, y);
      doc.text('Request ID', colReqId, y);
      doc.text('Action', colAction, y);
      doc.text('User', colUser, y);
      doc.text('Details', colDetails, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
    }

    // Alternating row background
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(MARGIN, y - 3.5, CONTENT_WIDTH, 6, 'F');
    }

    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(new Date(entry.timestamp).toLocaleDateString(), colDate, y);
    const reqIdText = entry.requestId.length > 14 ? entry.requestId.substring(0, 12) + '...' : entry.requestId;
    doc.text(reqIdText, colReqId, y);
    const actionText = entry.action.length > 28 ? entry.action.substring(0, 26) + '...' : entry.action;
    doc.text(actionText, colAction, y);
    const userText = entry.user.length > 16 ? entry.user.substring(0, 14) + '...' : entry.user;
    doc.text(userText, colUser, y);
    const detailText = entry.details.length > 22 ? entry.details.substring(0, 20) + '...' : entry.details;
    doc.text(detailText, colDetails, y);
    y += 5.5;
  });

  // Add footers
  addFooters(doc);

  doc.save(`Audit_Trail_${dateSlug}.pdf`);
}
