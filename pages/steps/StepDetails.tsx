import React, { useRef, useState } from 'react';
import { Eye, Paperclip, FileText, X, UploadCloud, Loader2, AlertTriangle } from 'lucide-react';
import { AttachmentThumbnail } from '../../components/AttachmentThumbnail';
import { Classification, RequestItem, AttributeDefinition } from '../../types';
import { DynamicForm } from '../../components/DynamicForm';
import { ComboBoxInput } from '../../components/ComboBoxInput';
import { HelpTooltip } from '../../components/HelpTooltip';
import { UnspscSearch } from '../../components/UnspscSearch';
import { formatFileSize } from '../../lib/fileUpload';
import type { DuplicateMatch } from '../../lib/duplicateDetection';

const SERVICE_UOM_OPTIONS = ['Days', 'Hours', 'Lumpsum', 'Each', 'Monthly', 'Weekly', 'Per Visit', 'Per Unit'];
const ITEM_UOM_OPTIONS = ['Each', 'Set', 'Box', 'Pair', 'Meter', 'mm', 'Roll', 'Sheet', 'Piece', 'kg', 'g', 'Liter', 'Gallon', 'Drum', 'Bag', 'Bundle', 'Case', 'Pack', 'Ton', 'Foot', 'Inch'];

interface StepDetailsProps {
  formData: Partial<RequestItem>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<RequestItem>>>;
  generatedDescription: string;
  relevantAttributes: AttributeDefinition[];
  attributeSuggestions: Record<string, string[]>;
  projectSuggestions?: string[];
  requestId?: string;
  uploading: boolean;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  potentialDuplicates?: DuplicateMatch[];
  fieldErrors?: Record<string, string>;
}

export const StepDetails: React.FC<StepDetailsProps> = ({
  formData,
  setFormData,
  generatedDescription,
  relevantAttributes,
  attributeSuggestions,
  projectSuggestions = [],
  requestId,
  uploading,
  onFileUpload,
  onFileDrop,
  potentialDuplicates = [],
  fieldErrors = {},
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (dragCounter.current === 1) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragging(false);
    dragCounter.current = 0;
    onFileDrop(e);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Core Details & Specifications</h3>

      {/* Auto-Description Preview */}
      <div className="bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100/60 dark:border-blue-800/60 p-4 rounded-xl">
        <div className="flex items-center gap-2 mb-1">
          <Eye size={14} className="text-blue-500 dark:text-blue-400" />
          <h4 className="text-xs uppercase font-bold text-blue-500 dark:text-blue-400 tracking-wide">Auto-Generated Description Preview</h4>
        </div>
        <p className="font-mono text-base text-blue-900 dark:text-blue-200 break-all min-h-[24px]">
          {generatedDescription || '(Complete attributes below to generate)'}
        </p>
      </div>

      {/* Duplicate Detection Warning */}
      {potentialDuplicates.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
            <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Potential Duplicate{potentialDuplicates.length > 1 ? 's' : ''} Found
            </h4>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
            The following existing requests appear similar. Please verify this is not a duplicate before submitting.
          </p>
          <div className="space-y-2">
            {potentialDuplicates.map((dup) => (
              <div
                key={dup.request.id}
                className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-lg p-3 border border-amber-200/40 dark:border-amber-700/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium text-amber-700 dark:text-amber-400">
                      {dup.request.id}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                      {Math.round(dup.score * 100)}% match
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 truncate mt-0.5">
                    {dup.request.title || dup.request.generatedDescription}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{dup.reason}</p>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500 ml-3 whitespace-nowrap">
                  {dup.request.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* UNSPSC Code */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          UNSPSC Commodity Code
          <HelpTooltip text="Search by UNSPSC code number or description to find the right commodity classification" />
        </label>
        <UnspscSearch
          value={formData.unspscCode || ''}
          onChange={(code) => setFormData(prev => ({ ...prev, unspscCode: code }))}
          disabled={false}
        />
      </div>

      {/* Short Description (240 chars) */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Short Description (max 240 characters)
          <HelpTooltip text="A concise description for Oracle. Auto-populated from the generated description but can be edited." />
        </label>
        <input
          type="text"
          maxLength={240}
          className="w-full rounded-lg border-slate-300 dark:border-slate-600 shadow-sm border p-2.5 focus:border-blue-500 focus:ring-blue-500/20 transition bg-white dark:bg-slate-700 dark:text-slate-200"
          value={formData.shortDescription || generatedDescription?.slice(0, 240) || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, shortDescription: e.target.value }))}
          placeholder="Short description for Oracle..."
        />
        <div className="text-xs text-slate-400 text-right mt-1">
          {(formData.shortDescription || generatedDescription?.slice(0, 240) || '').length}/240
        </div>
      </div>

      {/* Long Description (500 chars) */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Long Description (max 500 characters)
          <HelpTooltip text="A detailed description with full specifications. Can include additional details not in the short description." />
        </label>
        <textarea
          maxLength={500}
          rows={3}
          className="w-full rounded-lg border-slate-300 dark:border-slate-600 shadow-sm border p-2.5 focus:border-blue-500 focus:ring-blue-500/20 transition bg-white dark:bg-slate-700 dark:text-slate-200"
          value={formData.longDescription || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, longDescription: e.target.value }))}
          placeholder="Detailed description with full specifications..."
        />
        <div className="text-xs text-slate-400 text-right mt-1">
          {(formData.longDescription || '').length}/500
        </div>
      </div>

      {/* Brand/Manufacturer — handled by DynamicForm ComboBoxInput via suggestions prop */}

      {/* Core Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Project Code <span className="text-red-500">*</span></label>
          <ComboBoxInput
            id="field-project"
            value={formData.project || ''}
            onChange={(val) => setFormData(prev => ({ ...prev, project: val }))}
            suggestions={projectSuggestions}
            placeholder="e.g. PRJ-2026-001"
            aria-required={true}
            className="w-full rounded-lg border-slate-300 dark:border-slate-600 shadow-sm border p-2.5 focus:border-blue-500 focus:ring-blue-500/20 transition bg-white dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
          />
          {fieldErrors.project && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.project}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Resource Code</label>
          <input
            type="text"
            className="w-full rounded-lg border-slate-300 dark:border-slate-600 shadow-sm border p-2.5 focus:border-blue-500 focus:ring-blue-500/20 transition bg-white dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
            value={formData.resourceCode || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, resourceCode: e.target.value }))}
            placeholder="Optional"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Unit of Measurement (UOM)
            {formData.classification === Classification.SERVICE && <span className="text-red-500"> *</span>}
          </label>
          <ComboBoxInput
            id="field-uom"
            value={formData.uom || ''}
            onChange={(val) => setFormData(prev => ({ ...prev, uom: val }))}
            suggestions={formData.classification === Classification.SERVICE ? SERVICE_UOM_OPTIONS : ITEM_UOM_OPTIONS}
            placeholder="Type or select UOM..."
            aria-required={formData.classification === Classification.SERVICE || undefined}
            className="w-full rounded-lg border-slate-300 dark:border-slate-600 shadow-sm border p-2.5 focus:border-blue-500 focus:ring-blue-500/20 transition bg-white dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
          />
        </div>
      </div>

      {/* Dynamic Attributes */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
        <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-4 uppercase tracking-wide">
          {formData.classification === Classification.ITEM ? 'Material Attributes' : 'Service Attributes'}
        </h4>
        <DynamicForm
          attributes={relevantAttributes}
          values={formData.attributes || {}}
          onChange={(key, val) => setFormData(prev => ({ ...prev, attributes: { ...prev.attributes, [key]: val } }))}
          highlightEmpty={!!requestId}
          suggestions={attributeSuggestions}
          fieldErrors={fieldErrors}
        />
      </div>

      {/* Attachments */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
        <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
          <Paperclip size={14} strokeWidth={1.75} /> Attachments<HelpTooltip text="Upload supporting documents like specifications, drawings, or data sheets (max 10MB each)" />
        </h4>
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
            ${isDragging
              ? 'border-blue-500 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-500/10'
              : 'border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/30 hover:border-blue-400 hover:bg-blue-50/40 dark:hover:border-blue-500/60 dark:hover:bg-blue-500/5'
            }
            ${uploading ? 'pointer-events-none' : ''}
          `}
        >
          {uploading && (
            <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 rounded-xl flex items-center justify-center z-10 backdrop-blur-[1px]">
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={28} strokeWidth={1.75} className="animate-spin text-blue-500 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Uploading...</span>
              </div>
            </div>
          )}
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <div className={`p-3 rounded-full mb-3 transition-colors ${isDragging ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-slate-100 dark:bg-slate-700/60'}`}>
              <UploadCloud size={28} strokeWidth={1.5} className={`transition-colors ${isDragging ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
              {isDragging ? 'Drop files here' : 'Drag & drop files here or click to browse'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Max 10MB per file (Images, PDF, Office, CSV)
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
            multiple
            onChange={onFileUpload}
            disabled={uploading}
            aria-label="Attach file"
          />
        </div>

        {formData.attachments && formData.attachments.length > 0 && (
          <div className="mt-3 space-y-2">
            {formData.attachments.map(att => (
              <AttachmentThumbnail
                key={att.id}
                attachment={att}
                showRemove
                onRemove={() => setFormData(prev => ({ ...prev, attachments: prev.attachments?.filter(a => a.id !== att.id) }))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
