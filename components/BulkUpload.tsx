import React, { useState, useRef } from 'react';
import {
  Upload, Download, FileSpreadsheet, X, CheckCircle, AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useRequestStore, useUserStore, useAdminStore } from '../stores';
import {
  Classification, MaterialSubType, ServiceSubType, RequestStatus,
  RequestItem, AttributeType,
} from '../types';
import * as XLSX from 'xlsx';
import {
  buildColumnsForSheet, parseRowAttributes, toStr,
  type ExcelColumn,
} from '../lib/bulkUploadHelpers';

interface BulkUploadProps {
  onClose: () => void;
}

interface ParsedRow {
  title: string;
  classification: Classification;
  subType?: string;
  description: string;
  project: string;
  unspscCode?: string;
  uom?: string;
  attributes: Record<string, string | number | string[] | Record<string, string | number>>;
  sourceSheet: 'Items' | 'Services' | 'Legacy';
  errors: string[];
  warnings: string[];
}

// ────────────────── Constants ──────────────────

const ITEM_SUB_TYPES = Object.values(MaterialSubType);
const SERVICE_SUB_TYPES = Object.values(ServiceSubType);

const ITEM_UOMS = [
  'Each', 'Set', 'Box', 'Pair', 'Meter', 'mm', 'Roll', 'Sheet', 'Piece',
  'kg', 'g', 'Liter', 'Gallon', 'Drum', 'Bag', 'Bundle', 'Case', 'Pack',
  'Ton', 'Foot', 'Inch',
];

const SERVICE_UOMS = [
  'Days', 'Hours', 'Lumpsum', 'Each', 'Monthly', 'Weekly', 'Per Visit', 'Per Unit',
];

// ────────────────── Component ──────────────────

export const BulkUpload: React.FC<BulkUploadProps> = ({ onClose }) => {
  const addRequest = useRequestStore((s) => s.addRequest);
  const currentUser = useUserStore((s) => s.currentUser);
  const priorities = useAdminStore((s) => s.priorities);
  const allAttributes = useAdminStore((s) => s.attributes);

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ──── Template Generation (2-sheet with attributes) ────

  const downloadTemplate = async () => {
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.default.Workbook();

    const itemColumns = buildColumnsForSheet(allAttributes, Classification.ITEM);
    const serviceColumns = buildColumnsForSheet(allAttributes, Classification.SERVICE);

    // Style constants
    const mandatoryFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE67E22' } }; // orange
    const optionalFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF4472C4' } }; // blue
    const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    const headerAlign = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const borderStyle = { bottom: { style: 'thin' as const, color: { argb: 'FF000000' } } };

    const buildSheet = (
      sheetName: string,
      columns: ExcelColumn[],
      sampleRows: Record<string, string | number>[],
    ) => {
      const ws = wb.addWorksheet(sheetName);

      // Header row
      const headers = columns.map((c) => c.header);
      const headerRow = ws.addRow(headers);
      headerRow.height = 28;

      headerRow.eachCell((cell, colNumber) => {
        const col = columns[colNumber - 1];
        cell.font = headerFont;
        cell.fill = col.mandatory ? mandatoryFill : optionalFill;
        cell.alignment = headerAlign;
        cell.border = borderStyle;
      });

      // Column widths
      ws.columns.forEach((wsCol, i) => {
        wsCol.width = columns[i]?.width || 18;
      });

      // Freeze header row
      ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];

      // Sample data rows
      for (const sampleRow of sampleRows) {
        const rowData = columns.map((c) => sampleRow[c.header] ?? '');
        ws.addRow(rowData);
      }

      // Data validations for rows 2..201
      const maxRow = 201;
      for (let r = 2; r <= maxRow; r++) {
        for (let c = 0; c < columns.length; c++) {
          const col = columns[c];
          if (col.dataValidation && col.dataValidation.length > 0) {
            const formulaStr = col.dataValidation.join(',');
            // ExcelJS data validation needs formulae wrapped in quotes inside the string
            ws.getCell(r, c + 1).dataValidation = {
              type: 'list',
              allowBlank: true,
              formulae: [`"${formulaStr}"`],
            };
          }
        }
      }

      return ws;
    };

    // ── Items sheet ──
    const itemSample1: Record<string, string | number> = {
      'Title': 'Steel Pipe 6 inch',
      'Sub-Type': 'Direct (Nonstock)',
      'Description': 'Carbon steel pipe 6 inch diameter',
      'Project': 'PROJ-001',
      'UNSPSC Code': '30151500',
      'UOM': 'Each',
      'Material Type & Specs': 'Carbon Steel ASTM A53',
      'Material Grade/Classification': 'Grade B',
      'Dim: Length': '6000',
      'Dim: Diameter': '150',
      'Dim: Unit': 'mm',
      'Part Number/Ref Code': 'CS-PIPE-6IN',
      'Brand/Manufacturer': 'Tenaris',
      'Surface Finish/Coating': 'Black painted',
      'Compliance Standards': 'ASTM A53 / API 5L',
    };
    const itemSample2: Record<string, string | number> = {
      'Title': 'Bearing SKF 6205',
      'Sub-Type': 'Spare Parts',
      'Description': 'Deep groove ball bearing',
      'Project': 'PROJ-001',
      'UOM': 'Each',
      'Material Type & Specs': 'Chrome Steel',
      'Part Number/Ref Code': 'SKF-6205-2RS',
      'Brand/Manufacturer': 'SKF',
      'Machine/Equipment Name & Model': 'Pump P-101',
    };

    buildSheet('Items', itemColumns, [itemSample1, itemSample2]);

    // ── Services sheet ──
    const svcSample1: Record<string, string | number> = {
      'Title': 'Welding Service',
      'Sub-Type': 'Maintenance',
      'Description': 'On-site welding for pipeline repair',
      'Project': 'PROJ-002',
      'UOM': 'Lumpsum',
      'Service Details/Specs': 'SMAW and GTAW welding for 6" CS pipe',
      'Scope of Work': 'Mobilize crew, weld 10 joints, NDT inspection, demobilize',
      'Duration': '5 days',
      'Frequency': 'One-time',
      'Qualifications / Certifications Required': 'AWS D1.1 certified welder',
    };
    const svcSample2: Record<string, string | number> = {
      'Title': 'IT Support Contract',
      'Sub-Type': 'Software/IT',
      'Description': 'Monthly IT helpdesk support',
      'Project': 'PROJ-003',
      'UOM': 'Monthly',
      'Service Details/Specs': 'L1/L2 support for ERP and office applications',
      'Scope of Work': 'Remote helpdesk, on-site visits as needed, quarterly reports',
      'Duration': '12 months',
      'Frequency': 'Monthly',
    };

    buildSheet('Services', serviceColumns, [svcSample1, svcSample2]);

    // ── Instructions sheet ──
    const instWs = wb.addWorksheet('Instructions');
    const instData = [
      ['CodeMaster Bulk Upload - Instructions'],
      [''],
      ['This workbook contains two sheets: "Items" and "Services".'],
      ['Fill the relevant sheet(s) based on what you need to create.'],
      [''],
      ['COLUMN COLORS:'],
      ['  Orange headers = Mandatory fields (must be filled)'],
      ['  Blue headers = Optional fields (recommended for completeness)'],
      [''],
      ['TIPS:'],
      ['  - Each row becomes one draft request.'],
      ['  - Use the dropdown menus for Sub-Type, UOM, and other validated fields.'],
      ['  - For Multi-Select fields (e.g. Certifications), separate values with commas.'],
      ['  - Dimension fields: fill at least one dimension value + the unit.'],
      ['  - Numeric + Unit fields: fill the value column; unit column has a dropdown.'],
      ['  - You can fill both sheets in one upload.'],
      ['  - Rows with missing mandatory fields (orange columns) will be REJECTED.'],
      ['    Make sure all orange columns are filled before uploading.'],
      [''],
      ['AMENDMENTS:'],
      ['  Amendments to existing Oracle codes should be created via the single request form,'],
      ['  not through bulk upload.'],
    ];
    instData.forEach((rowArr) => {
      instWs.addRow(rowArr);
    });
    instWs.getColumn(1).width = 80;
    // Style the title
    const titleCell = instWs.getCell('A1');
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF2C3E50' } };

    // Generate and download
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CodeMaster_Bulk_Upload_Template.xlsx';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // ──── File Parser (multi-sheet with attributes) ────

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });

      const sheetNames = workbook.SheetNames.map((n) => n.toLowerCase());
      const hasItemsSheet = sheetNames.includes('items');
      const hasServicesSheet = sheetNames.includes('services');
      const isNewFormat = hasItemsSheet || hasServicesSheet;

      const parsed: ParsedRow[] = [];

      if (isNewFormat) {
        // ── New 2-sheet format ──
        if (hasItemsSheet) {
          const sheetName = workbook.SheetNames[sheetNames.indexOf('items')];
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
          const columns = buildColumnsForSheet(allAttributes, Classification.ITEM);
          parseSheetRows(rows, columns, Classification.ITEM, 'Items', parsed);
        }
        if (hasServicesSheet) {
          const sheetName = workbook.SheetNames[sheetNames.indexOf('services')];
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
          const columns = buildColumnsForSheet(allAttributes, Classification.SERVICE);
          parseSheetRows(rows, columns, Classification.SERVICE, 'Services', parsed);
        }
      } else {
        // ── Legacy single-sheet fallback ──
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
        parseLegacyRows(rows, parsed);
      }

      setParsedRows(parsed);
    };
    reader.readAsArrayBuffer(file);

    // Reset file input so the same file can be re-uploaded if needed
    e.target.value = '';
  };

  /** Parse rows from the new-format Items or Services sheet */
  const parseSheetRows = (
    rows: Record<string, unknown>[],
    columns: ExcelColumn[],
    classification: Classification,
    sourceSheet: 'Items' | 'Services',
    out: ParsedRow[],
  ) => {
    const isItem = classification === Classification.ITEM;
    const validSubTypes = isItem ? ITEM_SUB_TYPES : SERVICE_SUB_TYPES;
    const validUoms = isItem ? ITEM_UOMS : SERVICE_UOMS;

    for (const row of rows) {
      const errors: string[] = [];
      const warnings: string[] = [];

      const title = toStr(row['Title']);
      const subType = toStr(row['Sub-Type']);
      const description = toStr(row['Description']);
      const project = toStr(row['Project']);
      const unspscCode = toStr(row['UNSPSC Code']);
      const uom = toStr(row['UOM']);

      // Hard errors — block saving
      if (!title) errors.push('Title is required');
      if (!project) errors.push('Project is required');
      if (subType && !(validSubTypes as string[]).includes(subType)) {
        errors.push(`Invalid Sub-Type: "${subType}"`);
      }
      if (uom && !validUoms.includes(uom)) {
        errors.push(`Invalid UOM: "${uom}"`);
      }

      // Parse attributes from remaining columns
      const attributes = parseRowAttributes(row, columns, allAttributes);

      // Missing mandatory attributes = ERRORS (block saving — user must fix the Excel)
      const mandatoryAttrs = allAttributes.filter(
        (a) =>
          a.mandatory &&
          a.active &&
          a.visibleForClassification?.includes(classification),
      );
      for (const attr of mandatoryAttrs) {
        const val = attributes[attr.id];
        let isFilled = false;
        if (val == null) {
          isFilled = false;
        } else if (typeof val === 'string') {
          isFilled = val.trim() !== '';
        } else if (typeof val === 'number') {
          isFilled = true;
        } else if (Array.isArray(val)) {
          isFilled = val.length > 0;
        } else if (typeof val === 'object') {
          // NUMERIC_UNIT or DIMENSION_BLOCK
          isFilled = Object.entries(val).some(
            ([k, v]) => k !== '_unit' && String(v || '').trim() !== '',
          );
        }
        if (!isFilled) {
          errors.push(`Missing mandatory: ${attr.name}`);
        }
      }

      out.push({
        title,
        classification,
        subType,
        description,
        project,
        unspscCode,
        uom,
        attributes,
        sourceSheet,
        errors,
        warnings,
      });
    }
  };

  /** Legacy single-sheet parser (backward compatibility) */
  const parseLegacyRows = (
    rows: Record<string, unknown>[],
    out: ParsedRow[],
  ) => {
    const ALL_SUB_TYPES = [...ITEM_SUB_TYPES, ...SERVICE_SUB_TYPES] as string[];
    const ALL_UOMS = [...new Set([...ITEM_UOMS, ...SERVICE_UOMS])];

    for (const row of rows) {
      const errors: string[] = [];
      const warnings: string[] = [];

      const title = toStr(row['Title']);
      const classStr = toStr(row['Classification (Item/Service)']);
      const subType = toStr(row['Sub-Type']) || toStr(row['Material Sub-Type']);
      const description = toStr(row['Description']);
      const project = toStr(row['Project']);
      const unspscCode = toStr(row['UNSPSC Code']);
      const uom = toStr(row['UOM']);

      if (!title) errors.push('Title is required');
      if (!classStr || !['Item', 'Service'].includes(classStr)) {
        errors.push('Classification must be "Item" or "Service"');
      }
      if (subType && !ALL_SUB_TYPES.includes(subType)) {
        errors.push(`Invalid Sub-Type: "${subType}"`);
      }
      if (subType && classStr === 'Item' && (SERVICE_SUB_TYPES as string[]).includes(subType)) {
        errors.push(`"${subType}" is a Service sub-type, not valid for Item`);
      }
      if (subType && classStr === 'Service' && (ITEM_SUB_TYPES as string[]).includes(subType)) {
        errors.push(`"${subType}" is an Item sub-type, not valid for Service`);
      }
      if (uom && !ALL_UOMS.includes(uom)) {
        errors.push(`Invalid UOM: "${uom}"`);
      }
      if (!project) errors.push('Project is required');

      // Legacy templates have no attributes
      warnings.push('Old template — no attribute columns. Drafts will be incomplete.');

      const classification =
        classStr === 'Service' ? Classification.SERVICE : Classification.ITEM;

      out.push({
        title,
        classification,
        subType,
        description,
        project,
        unspscCode,
        uom,
        attributes: {},
        sourceSheet: 'Legacy',
        errors,
        warnings,
      });
    }
  };

  // ──── Submission ────

  const handleBulkSubmit = async () => {
    const validRows = parsedRows.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) return;


    setUploading(true);
    const normalPriority = priorities.find((p) => p.name === 'Normal') || priorities[0] || { id: 'p1' };

    let count = 0;
    for (const row of validRows) {
      const isItem = row.classification === Classification.ITEM;
      const matSubType = isItem
        ? Object.values(MaterialSubType).find((v) => v === row.subType)
        : undefined;
      const svcSubType = !isItem
        ? Object.values(ServiceSubType).find((v) => v === row.subType)
        : undefined;

      const newReq: Omit<RequestItem, 'id' | 'createdAt' | 'updatedAt' | 'history' | 'stageTimestamps'> = {
        requesterId: currentUser.id,
        classification: row.classification,
        priorityId: normalPriority?.id || 'p1',
        title: row.title,
        description: row.description,
        project: row.project,
        status: RequestStatus.DRAFT,
        attributes: row.attributes,
        generatedDescription: row.description,
        requestType: 'New',
        materialSubType: matSubType,
        serviceSubType: svcSubType,
        uom: row.uom || '',
        unspscCode: row.unspscCode || '',
      };

      try {
        addRequest(newReq);
        count++;
      } catch {
        // addRequest uses optimistic update with rollback; failures surface via toast
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setUploadCount(count);
    setUploading(false);
    setUploaded(true);
  };

  // ──── Computed values ────

  const validCount = parsedRows.filter((r) => r.errors.length === 0).length;
  const errorCount = parsedRows.filter((r) => r.errors.length > 0).length;

  // ──── Render ────

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="text-blue-600 dark:text-blue-400" size={24} />
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Bulk Upload Requests</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {uploaded ? (
            <div className="text-center py-12">
              <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
              <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                {uploadCount} Drafts Created
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                All valid requests have been saved as drafts. Go to <strong>My Drafts</strong> to review
                and submit them in bulk.
              </p>
              <button onClick={onClose} className="mt-6 btn-primary text-white px-6 py-2.5 rounded-lg">
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Step 1: Download Template */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-xl">
                <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                  <Download size={16} /> Step 1: Download Template
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
                  Download the Excel template with two sheets: <strong>Items</strong> and <strong>Services</strong>.
                  Fill the relevant sheet(s) with your coding requests. Orange columns are mandatory.
                  For amendments to existing codes, use the single request form.
                </p>
                <button
                  onClick={downloadTemplate}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2"
                >
                  <Download size={14} /> Download Template
                </button>
              </div>

              {/* Step 2: Upload File */}
              <div>
                <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                  <Upload size={16} /> Step 2: Upload Completed File
                </h3>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition"
                >
                  <Upload size={32} className="mx-auto text-slate-400 mb-3" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Click to upload your Excel file (.xlsx)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Step 3: Review & Submit */}
              {parsedRows.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                    Step 3: Review & Submit
                  </h3>

                  {/* Summary badges */}
                  <div className="flex gap-3 mb-4 flex-wrap">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-2 rounded-lg text-sm">
                      <span className="font-bold text-green-700 dark:text-green-400">{validCount}</span>{' '}
                      <span className="text-green-600 dark:text-green-500">valid rows</span>
                    </div>
                    {errorCount > 0 && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2 rounded-lg text-sm">
                        <span className="font-bold text-red-700 dark:text-red-400">{errorCount}</span>{' '}
                        <span className="text-red-600 dark:text-red-500">rejected</span>
                      </div>
                    )}
                  </div>

                  {/* Review table */}
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-x-auto max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">#</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Source</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Title</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Project</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Attributes</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {parsedRows.map((row, idx) => {
                          const attrCount = Object.keys(row.attributes).length;
                          const hasErrors = row.errors.length > 0;
                          return (
                            <tr
                              key={`${row.sourceSheet}-${idx}`}
                              className={hasErrors ? 'bg-red-50/50 dark:bg-red-900/10' : ''}
                            >
                              <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                    row.sourceSheet === 'Items'
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                      : row.sourceSheet === 'Services'
                                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                                  }`}
                                >
                                  {row.sourceSheet}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-medium max-w-[200px] truncate">
                                {row.title || '(empty)'}
                              </td>
                              <td className="px-3 py-2 text-slate-500">{row.project}</td>
                              <td className="px-3 py-2 text-slate-500 text-xs">
                                {attrCount > 0 ? `${attrCount} filled` : '—'}
                              </td>
                              <td className="px-3 py-2">
                                {hasErrors ? (
                                  <span
                                    className="text-red-600 dark:text-red-400 flex items-center gap-1 text-xs cursor-help"
                                    title={row.errors.join('\n')}
                                  >
                                    <AlertTriangle size={12} /> {row.errors[0]}{row.errors.length > 1 ? ` (+${row.errors.length - 1})` : ''}
                                  </span>
                                ) : (
                                  <span className="text-green-600 dark:text-green-400 flex items-center gap-1 text-xs">
                                    <CheckCircle size={12} /> Valid
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Helpful note when there are rejected rows */}
                  {errorCount > 0 && (
                    <div className="mt-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                      <span>
                        Rejected rows are missing required fields (title, project, or mandatory attributes).
                        Fix them in the Excel file and re-upload. Only valid rows will be saved.
                      </span>
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={handleBulkSubmit}
                      disabled={uploading || validCount === 0}
                      className="btn-primary text-white px-6 py-2.5 rounded-lg flex items-center gap-2 disabled:opacity-50"
                    >
                      {uploading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" /> Saving Drafts...
                        </>
                      ) : (
                        <>
                          <Upload size={16} /> Save {validCount} as Drafts
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
