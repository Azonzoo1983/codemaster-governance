import React, { useState, useRef } from 'react';
import { Upload, Download, FileSpreadsheet, X, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useRequestStore, useUserStore, useAdminStore } from '../stores';
import { Classification, MaterialSubType, RequestStatus, RequestItem } from '../types';
import * as XLSX from 'xlsx';

interface BulkUploadProps {
  onClose: () => void;
}

interface ParsedRow {
  title: string;
  classification: string;
  materialSubType?: string;
  description: string;
  project: string;
  unspscCode?: string;
  uom?: string;
  existingCode?: string;
  requestType: string;
  errors: string[];
}

export const BulkUpload: React.FC<BulkUploadProps> = ({ onClose }) => {
  const addRequest = useRequestStore((s) => s.addRequest);
  const currentUser = useUserStore((s) => s.currentUser);
  const priorities = useAdminStore((s) => s.priorities);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const headers = [
      'Title',
      'Classification (Item/Service)',
      'Material Sub-Type',
      'Request Type (New/Amendment)',
      'Existing Oracle Code',
      'Description',
      'Project',
      'UNSPSC Code',
      'UOM',
    ];
    const sampleRows = [
      ['Steel Pipe 6 inch', 'Item', 'Direct (Nonstock)', 'New', '', 'Carbon steel pipe 6 inch diameter', 'PROJ-001', '30151500', 'Each'],
      ['Bearing SKF 6205', 'Item', 'Spare Parts', 'New', '', 'Deep groove ball bearing SKF 6205', 'PROJ-001', '31171500', 'Each'],
      ['Welding Service', 'Service', '', 'New', '', 'On-site welding for pipeline repair', 'PROJ-002', '', 'Lumpsum'],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

    // Set column widths
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 5, 20) }));

    // Add data validation (dropdowns) for specific columns
    // Column B (index 1) = Classification
    // Column C (index 2) = Material Sub-Type
    // Column D (index 3) = Request Type
    // Column I (index 8) = UOM
    const validationRows = 200; // support up to 200 rows
    if (!ws['!dataValidation']) ws['!dataValidation'] = [];

    // Classification dropdown (column B, rows 2-201)
    ws['!dataValidation'].push({
      type: 'list',
      sqref: `B2:B${validationRows + 1}`,
      formulas: ['"Item,Service"'],
    });

    // Material Sub-Type dropdown (column C)
    ws['!dataValidation'].push({
      type: 'list',
      sqref: `C2:C${validationRows + 1}`,
      formulas: ['"Direct (Nonstock),Inventory (Stock),Spare Parts"'],
    });

    // Request Type dropdown (column D)
    ws['!dataValidation'].push({
      type: 'list',
      sqref: `D2:D${validationRows + 1}`,
      formulas: ['"New,Amendment"'],
    });

    // UOM dropdown (column I) - combined Item + Service UOMs
    ws['!dataValidation'].push({
      type: 'list',
      sqref: `I2:I${validationRows + 1}`,
      formulas: ['"Each,Set,Box,Pair,Meter,mm,Roll,Sheet,Piece,kg,g,Liter,Gallon,Drum,Bag,Bundle,Case,Pack,Ton,Foot,Inch,Days,Hours,Lumpsum,Monthly,Weekly,Per Visit,Per Unit"'],
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bulk Upload Template');
    XLSX.writeFile(wb, 'CodeMaster_Bulk_Upload_Template.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

      const parsed: ParsedRow[] = rows.map((row, idx) => {
        const errors: string[] = [];
        const title = (row['Title'] || '').trim();
        const classification = (row['Classification (Item/Service)'] || '').trim();
        const materialSubType = (row['Material Sub-Type'] || '').trim();
        const requestType = (row['Request Type (New/Amendment)'] || 'New').trim();
        const existingCode = (row['Existing Oracle Code'] || '').trim();
        const description = (row['Description'] || '').trim();
        const project = (row['Project'] || '').trim();
        const unspscCode = (row['UNSPSC Code'] || '').trim();
        const uom = (row['UOM'] || '').trim();

        const VALID_MATERIAL_SUB_TYPES = ['Direct (Nonstock)', 'Inventory (Stock)', 'Spare Parts'];
        const VALID_REQUEST_TYPES = ['New', 'Amendment'];
        const VALID_UOMS = ['Each', 'Set', 'Box', 'Pair', 'Meter', 'mm', 'Roll', 'Sheet', 'Piece', 'kg', 'g', 'Liter', 'Gallon', 'Drum', 'Bag', 'Bundle', 'Case', 'Pack', 'Ton', 'Foot', 'Inch', 'Days', 'Hours', 'Lumpsum', 'Monthly', 'Weekly', 'Per Visit', 'Per Unit'];

        if (!title) errors.push('Title is required');
        if (!classification || !['Item', 'Service'].includes(classification)) {
          errors.push('Classification must be "Item" or "Service"');
        }
        if (materialSubType && !VALID_MATERIAL_SUB_TYPES.includes(materialSubType)) {
          errors.push(`Invalid Material Sub-Type: "${materialSubType}"`);
        }
        if (requestType && !VALID_REQUEST_TYPES.includes(requestType)) {
          errors.push(`Invalid Request Type: "${requestType}"`);
        }
        if (uom && !VALID_UOMS.includes(uom)) {
          errors.push(`Invalid UOM: "${uom}"`);
        }
        if (!project) errors.push('Project is required');
        if (requestType === 'Amendment' && !existingCode) {
          errors.push('Existing Oracle Code required for amendments');
        }

        return {
          title,
          classification,
          materialSubType,
          description,
          project,
          unspscCode,
          uom,
          existingCode,
          requestType,
          errors,
        };
      });

      setParsedRows(parsed);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBulkSubmit = async () => {
    const validRows = parsedRows.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) return;

    setUploading(true);
    const normalPriority = priorities.find((p) => p.name === 'Normal') || priorities[0];

    let count = 0;
    for (const row of validRows) {
      const classificationEnum = row.classification === 'Item' ? Classification.ITEM : Classification.SERVICE;
      const matSubType = Object.values(MaterialSubType).find((v) => v === row.materialSubType);

      const newReq: Omit<RequestItem, 'id' | 'createdAt' | 'updatedAt' | 'history' | 'stageTimestamps'> = {
        requesterId: currentUser.id,
        classification: classificationEnum,
        priorityId: normalPriority?.id || 'p1',
        title: row.title,
        description: row.description,
        project: row.project,
        status: RequestStatus.SUBMITTED_TO_POC,
        attributes: {},
        generatedDescription: row.description,
        requestType: row.requestType === 'Amendment' ? 'Amendment' : 'New',
        existingCode: row.existingCode || '',
        materialSubType: matSubType,
        uom: row.uom || '',
        unspscCode: row.unspscCode || '',
      };

      addRequest(newReq);
      count++;
      // Small delay between requests to not overwhelm the system
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setUploadCount(count);
    setUploading(false);
    setUploaded(true);
  };

  const validCount = parsedRows.filter((r) => r.errors.length === 0).length;
  const errorCount = parsedRows.filter((r) => r.errors.length > 0).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
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
                {uploadCount} Requests Created
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                All valid requests have been submitted to the coding team.
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
                  Download the Excel template, fill it with your item/service coding requests, then upload it below.
                </p>
                <button onClick={downloadTemplate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2">
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

                  <div className="flex gap-4 mb-4">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-2 rounded-lg text-sm">
                      <span className="font-bold text-green-700 dark:text-green-400">{validCount}</span>{' '}
                      <span className="text-green-600 dark:text-green-500">valid rows</span>
                    </div>
                    {errorCount > 0 && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2 rounded-lg text-sm">
                        <span className="font-bold text-red-700 dark:text-red-400">{errorCount}</span>{' '}
                        <span className="text-red-600 dark:text-red-500">rows with errors</span>
                      </div>
                    )}
                  </div>

                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">#</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Title</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Type</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Project</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {parsedRows.map((row, idx) => (
                          <tr key={idx} className={row.errors.length > 0 ? 'bg-red-50/50 dark:bg-red-900/10' : ''}>
                            <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-medium">{row.title || '(empty)'}</td>
                            <td className="px-3 py-2 text-slate-500">{row.classification}</td>
                            <td className="px-3 py-2 text-slate-500">{row.project}</td>
                            <td className="px-3 py-2">
                              {row.errors.length > 0 ? (
                                <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                                  <AlertTriangle size={12} /> {row.errors[0]}
                                </span>
                              ) : (
                                <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                                  <CheckCircle size={12} /> Valid
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={handleBulkSubmit}
                      disabled={uploading || validCount === 0}
                      className="btn-primary text-white px-6 py-2.5 rounded-lg flex items-center gap-2 disabled:opacity-50"
                    >
                      {uploading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" /> Submitting...
                        </>
                      ) : (
                        <>
                          <Upload size={16} /> Submit {validCount} Requests
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
