import jsPDF from 'jspdf';
import { RequestItem, Priority, User, AttributeDefinition } from '../types';

// Colors
const BLUE = '#2563eb';
const DARK_GRAY = '#1e293b';
const LIGHT_GRAY = '#f1f5f9';
const MEDIUM_GRAY = '#64748b';

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

function drawSectionHeader(doc: jsPDF, title: string, y: number): number {
  y = checkPageBreak(doc, y, 14);
  // Light gray background bar
  doc.setFillColor(241, 245, 249); // LIGHT_GRAY
  doc.roundedRect(MARGIN, y - 5, CONTENT_WIDTH, 10, 2, 2, 'F');
  // Blue text
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235); // BLUE
  doc.text(title, MARGIN + 4, y + 2);
  doc.setTextColor(30, 41, 59); // DARK_GRAY
  return y + 12;
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

function formatAttributeValue(value: string | number | string[] | Record<string, string | number> | undefined): string {
  if (value === undefined || value === null || value === '') return '-';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') {
    // Dimension block or numeric+unit objects
    return Object.entries(value)
      .filter(([, v]) => v !== '' && v !== undefined && v !== null)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  }
  return String(value);
}

export function exportRequestPdf(
  request: RequestItem,
  priority: Priority | undefined,
  users: User[],
  attributes: AttributeDefinition[]
): void {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  let y = MARGIN;

  // ===== HEADER =====
  doc.setFillColor(37, 99, 235); // BLUE
  doc.rect(0, 0, PAGE_WIDTH, 28, 'F');
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('CodeMaster Governance - Request Form', MARGIN, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Request ID: ${request.id}`, MARGIN, 19);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, PAGE_WIDTH - MARGIN - 40, 19);
  y = 36;

  // ===== SECTION 1: Request Details =====
  y = drawSectionHeader(doc, 'Section 1: Request Details', y);

  const col1X = MARGIN + 2;
  const col2X = MARGIN + CONTENT_WIDTH / 2 + 2;
  const halfWidth = CONTENT_WIDTH / 2 - 4;

  y = drawKeyValue(doc, 'ID', request.id, col1X, y, halfWidth);
  const yRight = drawKeyValue(doc, 'Title', request.title, col2X, y - (y - 36 > 44 ? 6.5 : 6.5), halfWidth);
  // Reset — draw them sequentially for simplicity
  y = drawSectionHeader(doc, 'Section 1: Request Details', 36);
  y = drawKeyValue(doc, 'ID', request.id, col1X, y, CONTENT_WIDTH - 4);
  y = drawKeyValue(doc, 'Title', request.title, col1X, y, CONTENT_WIDTH - 4);
  y = drawKeyValue(doc, 'Classification', request.classification, col1X, y, halfWidth);
  y = drawKeyValue(doc, 'Priority', priority?.name ?? 'Unknown', col1X, y, halfWidth);
  y = drawKeyValue(doc, 'Status', request.status, col1X, y, halfWidth);
  y = drawKeyValue(doc, 'Created', new Date(request.createdAt).toLocaleString(), col1X, y, halfWidth);
  y = drawKeyValue(doc, 'Updated', new Date(request.updatedAt).toLocaleString(), col1X, y, halfWidth);
  y += 4;

  // ===== SECTION 2: Requester Info =====
  y = drawSectionHeader(doc, 'Section 2: Requester Information', y);
  const requester = users.find(u => u.id === request.requesterId);
  y = drawKeyValue(doc, 'Requester', requester?.name ?? 'Unknown', col1X, y, CONTENT_WIDTH - 4);
  y = drawKeyValue(doc, 'Department', requester?.department ?? '-', col1X, y, CONTENT_WIDTH - 4);
  y = drawKeyValue(doc, 'Project', request.project, col1X, y, CONTENT_WIDTH - 4);
  y += 4;

  // ===== SECTION 3: Description =====
  y = drawSectionHeader(doc, 'Section 3: Description', y);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  y = checkPageBreak(doc, y, 12);
  y = wrapText(doc, request.description || 'No description provided.', col1X, y, CONTENT_WIDTH - 4, 4.5);
  y += 6;

  // ===== SECTION 4: Dynamic Attributes =====
  const activeAttributes = attributes.filter(a => a.active);
  if (activeAttributes.length > 0) {
    y = drawSectionHeader(doc, 'Section 4: Dynamic Attributes', y);
    activeAttributes.forEach(attr => {
      const value = request.attributes?.[attr.id];
      const displayValue = formatAttributeValue(value);
      if (displayValue !== '-') {
        y = checkPageBreak(doc, y, 8);
        y = drawKeyValue(doc, attr.name, displayValue, col1X, y, CONTENT_WIDTH - 4);
      }
    });
    y += 4;
  }

  // ===== SECTION 5: Workflow =====
  y = drawSectionHeader(doc, 'Section 5: Workflow', y);
  const specialist = users.find(u => u.id === request.assignedSpecialistId);
  const techReviewer = users.find(u => u.id === request.technicalReviewerId);
  y = drawKeyValue(doc, 'Assigned Specialist', specialist?.name ?? 'Not assigned', col1X, y, CONTENT_WIDTH - 4);
  y = drawKeyValue(doc, 'Technical Reviewer', techReviewer?.name ?? 'Not assigned', col1X, y, CONTENT_WIDTH - 4);
  if (request.oracleCode) {
    y = drawKeyValue(doc, 'Oracle Code', request.oracleCode, col1X, y, CONTENT_WIDTH - 4);
  }
  if (request.finalDescription) {
    y = drawKeyValue(doc, 'Final Description', request.finalDescription, col1X, y, CONTENT_WIDTH - 4);
  }
  y += 4;

  // ===== SECTION 6: Audit Trail =====
  if (request.history && request.history.length > 0) {
    y = drawSectionHeader(doc, 'Section 6: Audit Trail', y);

    // Table header
    y = checkPageBreak(doc, y, 10);
    doc.setFillColor(37, 99, 235);
    doc.rect(MARGIN, y - 4, CONTENT_WIDTH, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    const colDate = MARGIN + 2;
    const colAction = MARGIN + 40;
    const colUser = MARGIN + 100;
    const colDetails = MARGIN + 135;
    doc.text('Date', colDate, y);
    doc.text('Action', colAction, y);
    doc.text('User', colUser, y);
    doc.text('Details', colDetails, y);
    y += 6;

    // Table rows
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    request.history.forEach((log, idx) => {
      y = checkPageBreak(doc, y, 8);

      // Alternating row background
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(MARGIN, y - 3.5, CONTENT_WIDTH, 6, 'F');
      }

      doc.setFontSize(7.5);
      doc.text(new Date(log.timestamp).toLocaleDateString(), colDate, y);
      // Truncate long action text
      const actionText = log.action.length > 30 ? log.action.substring(0, 28) + '...' : log.action;
      doc.text(actionText, colAction, y);
      const userText = log.user.length > 18 ? log.user.substring(0, 16) + '...' : log.user;
      doc.text(userText, colUser, y);
      const detailText = log.details ? (log.details.length > 25 ? log.details.substring(0, 23) + '...' : log.details) : '-';
      doc.text(detailText, colDetails, y);
      y += 5.5;
    });
  }

  // ===== FOOTER =====
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

  doc.save(`Request_${request.id}_Form.pdf`);
}
