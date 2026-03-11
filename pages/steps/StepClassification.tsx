import React from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Classification, MaterialSubType, ServiceSubType, RequestItem } from '../../types';
import { HelpTooltip } from '../../components/HelpTooltip';

interface StepClassificationProps {
  isAmendment: boolean;
  formData: Partial<RequestItem>;
  setFormData: (data: Partial<RequestItem>) => void;
  dbChecked: boolean;
  setDbChecked: (val: boolean) => void;
  addToast: (msg: string, type: string) => void;
  fieldErrors?: Record<string, string>;
}

export const StepClassification: React.FC<StepClassificationProps> = ({
  isAmendment,
  formData,
  setFormData,
  dbChecked,
  setDbChecked,
  addToast,
  fieldErrors = {},
}) => (
  <div className="space-y-6">
    {isAmendment ? (
      /* ---- Amendment: 3 fields only ---- */
      <>
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Amendment Details</h3>
        <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200/60 dark:border-amber-700/60 rounded-xl p-4">
          <label className="block text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">Existing Oracle Code <span className="text-red-500">*</span></label>
          <input
            type="text"
            className="w-full rounded-lg border-amber-200 dark:border-amber-700 shadow-sm border p-2.5 focus:border-amber-500 focus:ring-amber-500/20 transition bg-white dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
            value={formData.existingCode || ''}
            onChange={(e) => setFormData({ ...formData, existingCode: e.target.value })}
            placeholder="Enter the existing Oracle code..."
            aria-required="true"
            aria-label="Existing Oracle Code"
          />
          {fieldErrors.existingCode && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.existingCode}</p>}
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Current Oracle Description <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full rounded-lg border-slate-300 dark:border-slate-600 shadow-sm border p-2.5 focus:border-blue-500 focus:ring-blue-500/20 transition bg-white dark:bg-slate-700 dark:text-slate-200"
              rows={2}
              value={formData.existingDescription || ''}
              onChange={(e) => setFormData({ ...formData, existingDescription: e.target.value })}
              placeholder="Enter the current Oracle description..."
            />
            {fieldErrors.existingDescription && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.existingDescription}</p>}
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              New Proposed Description <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full rounded-lg border-slate-300 dark:border-slate-600 shadow-sm border p-2.5 focus:border-blue-500 focus:ring-blue-500/20 transition bg-white dark:bg-slate-700 dark:text-slate-200"
              rows={3}
              value={formData.proposedDescription || ''}
              onChange={(e) => setFormData({ ...formData, proposedDescription: e.target.value })}
              placeholder="Enter the new proposed description..."
            />
            {fieldErrors.proposedDescription && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.proposedDescription}</p>}
          </div>
        </div>
      </>
    ) : (
      /* ---- New Item: DB Check gate + Classification ---- */
      <>
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Database Check & Classification</h3>

        {/* DB Check gate */}
        {!dbChecked ? (
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200/60 dark:border-amber-700/60 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle size={20} className="text-amber-500 dark:text-amber-400 shrink-0" />
              <p className="text-amber-800 dark:text-amber-300 font-medium">Have you checked the Oracle ERP database to confirm this code does not already exist?</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => addToast('You must check the Oracle ERP database before proceeding. Please verify the code does not already exist.', 'warning')}
                className="px-5 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 font-medium text-slate-700 dark:text-slate-300 transition text-sm"
              >
                No, I haven't
              </button>
              <button
                onClick={() => setDbChecked(true)}
                className="btn-primary px-5 py-2.5 text-white rounded-lg font-medium transition text-sm"
              >
                Yes, I have checked
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200/60 dark:border-emerald-700/60 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">Database verification confirmed</p>
            <button onClick={() => setDbChecked(false)} className="ml-auto text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition">Reset</button>
          </div>
        )}
        {fieldErrors.dbChecked && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{fieldErrors.dbChecked}</p>}

        {/* Classification — shown after DB check confirmed */}
        {dbChecked && (
          <>
            <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">Classification<HelpTooltip text="Choose 'Item' for physical materials/parts or 'Service' for service-based coding requests" /></label>
              <div className="flex gap-4">
                {[Classification.ITEM, Classification.SERVICE].map(c => (
                  <button
                    key={c}
                    onClick={() => setFormData({
                      ...formData,
                      classification: c,
                      materialSubType: c === Classification.ITEM ? MaterialSubType.DIRECT_NONSTOCK : undefined,
                      serviceSubType: c === Classification.SERVICE ? undefined : undefined,
                      attributes: {},
                    })}
                    className={`flex-1 py-3.5 border-2 rounded-lg text-center font-semibold transition-all ${
                      formData.classification === c
                        ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800 border-slate-800 dark:border-slate-200 shadow-premium'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
                    }`}
                  >
                    {c === Classification.ITEM ? 'Material (Item)' : 'Service'}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-Type Selection */}
            {formData.classification === Classification.ITEM && (
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">Material Sub-Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {Object.values(MaterialSubType).map(st => (
                    <button
                      key={st}
                      onClick={() => setFormData({ ...formData, materialSubType: st })}
                      className={`p-3 border-2 rounded-lg text-center text-sm font-medium transition-all ${
                        formData.materialSubType === st
                          ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-600/10 dark:ring-blue-500/20'
                          : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {formData.classification === Classification.SERVICE && (
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">Service Sub-Type <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.values(ServiceSubType).map(st => (
                    <button
                      key={st}
                      onClick={() => setFormData({ ...formData, serviceSubType: st })}
                      className={`p-3 border-2 rounded-lg text-center text-sm font-medium transition-all ${
                        formData.serviceSubType === st
                          ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-600/10 dark:ring-blue-500/20'
                          : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500'
                    }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
                {fieldErrors.serviceSubType && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{fieldErrors.serviceSubType}</p>}
              </div>
            )}
          </>
        )}
      </>
    )}
  </div>
);
