import React from 'react';
import { AlertTriangle, Eye } from 'lucide-react';
import { Classification, RequestItem } from '../../types';
import { HelpTooltip } from '../../components/HelpTooltip';

interface Priority {
  id: string;
  name: string;
  description?: string;
  slaHours?: number;
  active: boolean;
  displayOrder: number;
  requiresApproval?: boolean;
}

interface StepPriorityProps {
  formData: Partial<RequestItem>;
  setFormData: (data: Partial<RequestItem>) => void;
  priorities: Priority[];
  selectedPriority: Priority | undefined;
  isAmendment: boolean;
  generatedDescription: string;
}

export const StepPriority: React.FC<StepPriorityProps> = ({
  formData,
  setFormData,
  priorities,
  selectedPriority,
  isAmendment,
  generatedDescription,
}) => (
  <div className="space-y-6">
    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Urgency, Priority & Final Review</h3>

    {/* Priority Selection */}
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Priority Level <span className="text-red-500">*</span><HelpTooltip text="Normal: 2 business days. Urgent: 1 day. Critical: same day (requires manager approval)" /></label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {priorities.filter(p => p.active).sort((a, b) => a.displayOrder - b.displayOrder).map(p => (
          <button
            key={p.id}
            onClick={() => setFormData({ ...formData, priorityId: p.id })}
            className={`p-4 border-2 rounded-xl text-left transition-all ${
              formData.priorityId === p.id
                ? p.name === 'Critical'
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/30 shadow-premium ring-1 ring-rose-500/20'
                  : p.name === 'Urgent'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 shadow-premium ring-1 ring-amber-500/20'
                    : 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 shadow-premium ring-1 ring-emerald-500/20'
                : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
            }`}
          >
            <div className="font-bold text-base mb-1 text-slate-900 dark:text-slate-100">{p.name}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{p.description}</p>
            {p.slaHours && (
              <p className="text-xs font-medium mt-2 text-slate-600 dark:text-slate-400">SLA: {p.slaHours}h</p>
            )}
          </button>
        ))}
      </div>
    </div>

    {/* Critical Priority - Approval Fields */}
    {selectedPriority?.requiresApproval && (
      <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200/60 dark:border-rose-700/60 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300">
          <AlertTriangle size={18} strokeWidth={1.75} />
          <span className="font-semibold">Critical Priority - Manager Approval Required</span>
        </div>
        <div>
          <label className="block text-sm font-medium text-rose-800 dark:text-rose-300 mb-1">Justification <span className="text-rose-600">*</span></label>
          <textarea
            className="w-full rounded-lg border-rose-200 dark:border-rose-700 shadow-sm border p-3 focus:border-rose-500 focus:ring-rose-500/20 transition bg-white dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
            rows={3}
            value={formData.justification || ''}
            onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
            placeholder="Explain why this request is critical and requires same-day processing..."
            aria-required="true"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-rose-800 dark:text-rose-300 mb-1">Approving Manager Name <span className="text-rose-600">*</span></label>
            <input
              type="text"
              className="w-full rounded-lg border-rose-200 dark:border-rose-700 shadow-sm border p-2.5 focus:border-rose-500 focus:ring-rose-500/20 transition bg-white dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              value={formData.managerName || ''}
              onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
              placeholder="e.g. John Doe"
              aria-required="true"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-rose-800 dark:text-rose-300 mb-1">Approving Manager Email <span className="text-rose-600">*</span></label>
            <input
              type="email"
              className="w-full rounded-lg border-rose-200 dark:border-rose-700 shadow-sm border p-2.5 focus:border-rose-500 focus:ring-rose-500/20 transition bg-white dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              value={formData.managerEmail || ''}
              onChange={(e) => setFormData({ ...formData, managerEmail: e.target.value })}
              placeholder="e.g. john@company.com"
              aria-required="true"
            />
          </div>
        </div>
        <p className="text-xs text-rose-600 dark:text-rose-400 italic">
          This request will require manager approval before it reaches the coding team.
          {selectedPriority.slaHours && ` Must be submitted at least ${selectedPriority.slaHours} hours before end of business.`}
        </p>
      </div>
    )}

    {/* Review Summary */}
    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-5 mt-4">
      <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4 flex items-center gap-2">
        <Eye size={16} strokeWidth={1.75} /> Request Summary
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div className="flex justify-between py-2 border-b border-slate-200/60 dark:border-slate-700/60">
          <span className="text-slate-500 dark:text-slate-400">Request Type</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">{formData.requestType}</span>
        </div>
        <div className="flex justify-between py-2 border-b border-slate-200/60 dark:border-slate-700/60">
          <span className="text-slate-500 dark:text-slate-400">Classification</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">{formData.classification}</span>
        </div>
        {formData.classification === Classification.ITEM && formData.materialSubType && (
          <div className="flex justify-between py-2 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-500 dark:text-slate-400">Material Sub-Type</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{formData.materialSubType}</span>
          </div>
        )}
        {formData.classification === Classification.SERVICE && formData.serviceSubType && (
          <div className="flex justify-between py-2 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-500 dark:text-slate-400">Service Sub-Type</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{formData.serviceSubType}</span>
          </div>
        )}
        {formData.existingCode && (
          <div className="flex justify-between py-2 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-500 dark:text-slate-400">Existing Code</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{formData.existingCode}</span>
          </div>
        )}
        {formData.project && (
          <div className="flex justify-between py-2 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-500 dark:text-slate-400">Project Code</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{formData.project}</span>
          </div>
        )}
        {formData.unspscCode && (
          <div className="flex justify-between py-2 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-500 dark:text-slate-400">UNSPSC Code</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{formData.unspscCode}</span>
          </div>
        )}
        {formData.uom && (
          <div className="flex justify-between py-2 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-500 dark:text-slate-400">UOM</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{formData.uom}</span>
          </div>
        )}
        <div className="flex justify-between py-2 border-b border-slate-200/60 dark:border-slate-700/60">
          <span className="text-slate-500 dark:text-slate-400">Priority</span>
          <span className={`font-medium ${selectedPriority?.name === 'Critical' ? 'text-rose-600 dark:text-rose-400' : selectedPriority?.name === 'Urgent' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {selectedPriority?.name || 'Not selected'}
          </span>
        </div>
        <div className="flex justify-between py-2 border-b border-slate-200/60 dark:border-slate-700/60">
          <span className="text-slate-500 dark:text-slate-400">Attachments</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">{formData.attachments?.length || 0} file(s)</span>
        </div>
      </div>

      {generatedDescription && (
        <div className="mt-4 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100/60 dark:border-blue-800/60 rounded-xl p-3">
          <p className="text-xs uppercase font-bold text-blue-500 dark:text-blue-400 mb-1 tracking-wide">Auto-Generated Description</p>
          <p className="font-mono text-sm text-blue-900 dark:text-blue-200">{generatedDescription}</p>
        </div>
      )}
    </div>
  </div>
);
