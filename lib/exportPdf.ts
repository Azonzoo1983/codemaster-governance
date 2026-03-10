import jsPDF from 'jspdf';
import { RequestItem, Priority, User, RequestStatus, Role } from '../types';
import { calculateBusinessHours } from './businessHours';

// Colors
const BLUE_R = 37, BLUE_G = 99, BLUE_B = 235;
const DARK_R = 30, DARK_G = 41, DARK_B = 59;
const MED_R = 100, MED_G = 116, MED_B = 139;
const LIGHT_R = 241, LIGHT_G = 245, LIGHT_B = 249;

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_HEIGHT - 20) {
    doc.addPage();
    return MARGIN + 10;
  }
  return y;
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  y = checkPageBreak(doc, y, 16);
  doc.setFillColor(LIGHT_R, LIGHT_G, LIGHT_B);
  doc.roundedRect(MARGIN, y - 5, CONTENT_WIDTH, 10, 2, 2, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(BLUE_R, BLUE_G, BLUE_B);
  doc.text(title, MARGIN + 4, y + 2);
  doc.setTextColor(DARK_R, DARK_G, DARK_B);
  return y + 12;
}

function drawTableHeader(doc: jsPDF, cols: { label: string; x: number }[], y: number): number {
  doc.setFillColor(BLUE_R, BLUE_G, BLUE_B);
  doc.rect(MARGIN, y - 4, CONTENT_WIDTH, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  cols.forEach(c => doc.text(c.label, c.x, y));
  return y + 6;
}

function drawTableRow(doc: jsPDF, cols: { text: string; x: number }[], y: number, idx: number): number {
  if (idx % 2 === 0) {
    doc.setFillColor(248, 250, 252);
    doc.rect(MARGIN, y - 3.5, CONTENT_WIDTH, 6, 'F');
  }
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(DARK_R, DARK_G, DARK_B);
  cols.forEach(c => doc.text(c.text, c.x, y));
  return y + 5.5;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.substring(0, max - 2) + '...' : str;
}

function addFooters(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(MED_R, MED_G, MED_B);
    const footerY = PAGE_HEIGHT - 8;
    doc.text(`Generated on ${new Date().toLocaleDateString()} | CodeMaster Governance Tool`, MARGIN, footerY);
    doc.text(`Page ${i} of ${totalPages}`, PAGE_WIDTH - MARGIN - 20, footerY);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, footerY - 3, PAGE_WIDTH - MARGIN, footerY - 3);
  }
}

/**
 * Export the Reports page as a PDF using jsPDF (data-driven, not screenshot).
 */
export function exportToPdf(
  requests: RequestItem[],
  priorities: Priority[],
  users: User[],
  filename: string
): void {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const today = new Date().toLocaleDateString();

  // ===== COVER PAGE =====
  doc.setFillColor(BLUE_R, BLUE_G, BLUE_B);
  doc.rect(0, 0, PAGE_WIDTH, 60, 'F');
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('CodeMaster Governance', MARGIN, 28);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Performance Report', MARGIN, 40);
  doc.setFontSize(10);
  doc.text(`Date: ${today}`, MARGIN, 52);

  // Summary on cover
  let y = 80;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(DARK_R, DARK_G, DARK_B);
  doc.text('Report Summary', MARGIN, y);
  y += 10;

  const completedRequests = requests.filter(r => r.status === RequestStatus.COMPLETED);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(MED_R, MED_G, MED_B);
  doc.text(`Total Requests: ${requests.length}`, MARGIN, y); y += 7;
  doc.text(`Completed: ${completedRequests.length}`, MARGIN, y); y += 7;
  doc.text(`Active Specialists: ${users.filter(u => u.role === Role.SPECIALIST && requests.some(r => r.assignedSpecialistId === u.id)).length}`, MARGIN, y); y += 7;

  // ===== PAGE 2: Status Distribution =====
  doc.addPage();
  y = MARGIN;

  doc.setFillColor(BLUE_R, BLUE_G, BLUE_B);
  doc.rect(0, 0, PAGE_WIDTH, 22, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Status Distribution', MARGIN, 14);
  y = 32;

  // Status table
  const statusCounts: Record<string, number> = {};
  requests.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });
  const statusEntries = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);

  const sColStatus = MARGIN + 2;
  const sColCount = MARGIN + 120;
  const sColPct = MARGIN + 150;

  y = drawTableHeader(doc, [
    { label: 'Status', x: sColStatus },
    { label: 'Count', x: sColCount },
    { label: '% of Total', x: sColPct },
  ], y);

  statusEntries.forEach(([status, count], idx) => {
    y = checkPageBreak(doc, y, 8);
    const pct = requests.length > 0 ? ((count / requests.length) * 100).toFixed(1) + '%' : '0%';
    y = drawTableRow(doc, [
      { text: truncate(status, 50), x: sColStatus },
      { text: String(count), x: sColCount },
      { text: pct, x: sColPct },
    ], y, idx);
  });

  // ===== Priority Distribution =====
  y += 10;
  y = drawSectionTitle(doc, 'Priority Distribution', y);

  const priorityCounts: Record<string, number> = {};
  requests.forEach(r => {
    const name = priorities.find(p => p.id === r.priorityId)?.name || 'Unknown';
    priorityCounts[name] = (priorityCounts[name] || 0) + 1;
  });
  const priorityEntries = Object.entries(priorityCounts).sort((a, b) => b[1] - a[1]);

  y = drawTableHeader(doc, [
    { label: 'Priority', x: sColStatus },
    { label: 'Count', x: sColCount },
    { label: '% of Total', x: sColPct },
  ], y);

  priorityEntries.forEach(([prio, count], idx) => {
    y = checkPageBreak(doc, y, 8);
    const pct = requests.length > 0 ? ((count / requests.length) * 100).toFixed(1) + '%' : '0%';
    y = drawTableRow(doc, [
      { text: prio, x: sColStatus },
      { text: String(count), x: sColCount },
      { text: pct, x: sColPct },
    ], y, idx);
  });

  // ===== Classification Breakdown =====
  y += 10;
  y = drawSectionTitle(doc, 'Classification Breakdown', y);

  const classCounts: Record<string, number> = {};
  requests.forEach(r => { classCounts[r.classification] = (classCounts[r.classification] || 0) + 1; });
  const classEntries = Object.entries(classCounts).sort((a, b) => b[1] - a[1]);

  y = drawTableHeader(doc, [
    { label: 'Classification', x: sColStatus },
    { label: 'Count', x: sColCount },
    { label: '% of Total', x: sColPct },
  ], y);

  classEntries.forEach(([cls, count], idx) => {
    y = checkPageBreak(doc, y, 8);
    const pct = requests.length > 0 ? ((count / requests.length) * 100).toFixed(1) + '%' : '0%';
    y = drawTableRow(doc, [
      { text: cls, x: sColStatus },
      { text: String(count), x: sColCount },
      { text: pct, x: sColPct },
    ], y, idx);
  });

  // ===== SLA Performance =====
  if (completedRequests.length > 0) {
    y += 10;
    y = drawSectionTitle(doc, 'SLA Performance', y);

    let metCount = 0;
    const slaRows: { id: string; title: string; actual: string; target: string; met: string }[] = [];

    completedRequests.forEach(req => {
      const completedLog = req.history.find(h => h.action.includes('completed') || h.action.includes('Completed') || h.action.includes('Code Created'));
      const completedDate = completedLog ? new Date(completedLog.timestamp) : new Date(req.updatedAt);
      const durationHours = calculateBusinessHours(req.createdAt, completedDate);
      const prio = priorities.find(p => p.id === req.priorityId);
      const sla = prio?.slaHours || 24;
      const met = durationHours <= sla;
      if (met) metCount++;
      slaRows.push({
        id: req.id.slice(-8),
        title: truncate(req.title, 30),
        actual: (Math.round(durationHours * 10) / 10) + 'h',
        target: sla + 'h',
        met: met ? 'Yes' : 'No',
      });
    });

    const compRate = ((metCount / completedRequests.length) * 100).toFixed(1);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(MED_R, MED_G, MED_B);
    doc.text(`Overall SLA Compliance: ${compRate}% (${metCount}/${completedRequests.length})`, MARGIN + 2, y);
    y += 8;

    const slaCols = [
      { label: 'ID', x: MARGIN + 2 },
      { label: 'Title', x: MARGIN + 25 },
      { label: 'Actual', x: MARGIN + 100 },
      { label: 'Target', x: MARGIN + 125 },
      { label: 'Met SLA', x: MARGIN + 150 },
    ];
    y = drawTableHeader(doc, slaCols, y);

    slaRows.forEach((row, idx) => {
      y = checkPageBreak(doc, y, 8);
      y = drawTableRow(doc, [
        { text: row.id, x: slaCols[0].x },
        { text: row.title, x: slaCols[1].x },
        { text: row.actual, x: slaCols[2].x },
        { text: row.target, x: slaCols[3].x },
        { text: row.met, x: slaCols[4].x },
      ], y, idx);
    });
  }

  // ===== Specialist Performance =====
  doc.addPage();
  y = MARGIN;

  doc.setFillColor(BLUE_R, BLUE_G, BLUE_B);
  doc.rect(0, 0, PAGE_WIDTH, 22, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Specialist Performance', MARGIN, 14);
  y = 32;

  const specialists = users.filter(u => u.role === Role.SPECIALIST);
  const specData = specialists.map(spec => {
    const assigned = requests.filter(r => r.assignedSpecialistId === spec.id);
    const completed = assigned.filter(r => r.status === RequestStatus.COMPLETED);
    const avgTime = completed.length > 0
      ? completed.reduce((sum, r) => sum + calculateBusinessHours(r.createdAt, r.updatedAt), 0) / completed.length
      : 0;
    return {
      name: truncate(spec.name, 22),
      assigned: String(assigned.length),
      completed: String(completed.length),
      inProgress: String(assigned.length - completed.length),
      avgHours: (Math.round(avgTime * 10) / 10) + 'h',
    };
  }).filter(s => s.assigned !== '0');

  if (specData.length > 0) {
    const specCols = [
      { label: 'Specialist', x: MARGIN + 2 },
      { label: 'Assigned', x: MARGIN + 60 },
      { label: 'Completed', x: MARGIN + 85 },
      { label: 'In Progress', x: MARGIN + 115 },
      { label: 'Avg Time', x: MARGIN + 150 },
    ];
    y = drawTableHeader(doc, specCols, y);

    specData.forEach((row, idx) => {
      y = checkPageBreak(doc, y, 8);
      y = drawTableRow(doc, [
        { text: row.name, x: specCols[0].x },
        { text: row.assigned, x: specCols[1].x },
        { text: row.completed, x: specCols[2].x },
        { text: row.inProgress, x: specCols[3].x },
        { text: row.avgHours, x: specCols[4].x },
      ], y, idx);
    });
  } else {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(MED_R, MED_G, MED_B);
    doc.text('No specialist data available.', MARGIN + 2, y);
    y += 8;
  }

  // ===== By Requester =====
  y += 10;
  y = drawSectionTitle(doc, 'Requests by User (Top 10)', y);

  const reqCounts: Record<string, number> = {};
  requests.forEach(r => {
    const user = users.find(u => u.id === r.requesterId);
    const name = user?.name || 'Unknown';
    reqCounts[name] = (reqCounts[name] || 0) + 1;
  });
  const reqEntries = Object.entries(reqCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  y = drawTableHeader(doc, [
    { label: 'Requester', x: sColStatus },
    { label: 'Count', x: sColCount },
  ], y);

  reqEntries.forEach(([name, count], idx) => {
    y = checkPageBreak(doc, y, 8);
    y = drawTableRow(doc, [
      { text: truncate(name, 50), x: sColStatus },
      { text: String(count), x: sColCount },
    ], y, idx);
  });

  // ===== By Project =====
  y += 10;
  y = drawSectionTitle(doc, 'Requests by Project (Top 10)', y);

  const projCounts: Record<string, number> = {};
  requests.forEach(r => {
    const proj = r.project || 'Unassigned';
    projCounts[proj] = (projCounts[proj] || 0) + 1;
  });
  const projEntries = Object.entries(projCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  y = drawTableHeader(doc, [
    { label: 'Project', x: sColStatus },
    { label: 'Count', x: sColCount },
  ], y);

  projEntries.forEach(([name, count], idx) => {
    y = checkPageBreak(doc, y, 8);
    y = drawTableRow(doc, [
      { text: truncate(name, 50), x: sColStatus },
      { text: String(count), x: sColCount },
    ], y, idx);
  });

  // ===== By Department =====
  y += 10;
  y = drawSectionTitle(doc, 'Requests by Department', y);

  const deptCounts: Record<string, number> = {};
  requests.forEach(r => {
    const user = users.find(u => u.id === r.requesterId);
    const dept = user?.department || 'Unknown';
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;
  });
  const deptEntries = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);

  y = drawTableHeader(doc, [
    { label: 'Department', x: sColStatus },
    { label: 'Count', x: sColCount },
  ], y);

  deptEntries.forEach(([name, count], idx) => {
    y = checkPageBreak(doc, y, 8);
    y = drawTableRow(doc, [
      { text: truncate(name, 50), x: sColStatus },
      { text: String(count), x: sColCount },
    ], y, idx);
  });

  // ===== All Requests Summary Table =====
  doc.addPage();
  y = MARGIN;

  doc.setFillColor(BLUE_R, BLUE_G, BLUE_B);
  doc.rect(0, 0, PAGE_WIDTH, 22, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('All Requests Summary', MARGIN, 14);
  y = 32;

  const allCols = [
    { label: 'ID', x: MARGIN + 2 },
    { label: 'Title', x: MARGIN + 25 },
    { label: 'Classification', x: MARGIN + 90 },
    { label: 'Status', x: MARGIN + 120 },
    { label: 'Priority', x: MARGIN + 160 },
  ];
  y = drawTableHeader(doc, allCols, y);

  requests.forEach((req, idx) => {
    y = checkPageBreak(doc, y, 8);

    // Re-draw header after page break
    if (y <= MARGIN + 11) {
      y = drawTableHeader(doc, allCols, y);
    }

    const pName = priorities.find(p => p.id === req.priorityId)?.name || 'Unknown';
    y = drawTableRow(doc, [
      { text: truncate(req.id, 12), x: allCols[0].x },
      { text: truncate(req.title, 30), x: allCols[1].x },
      { text: req.classification, x: allCols[2].x },
      { text: truncate(req.status, 18), x: allCols[3].x },
      { text: pName, x: allCols[4].x },
    ], y, idx);
  });

  // Add footers
  addFooters(doc);

  doc.save(`${filename}.pdf`);
}
