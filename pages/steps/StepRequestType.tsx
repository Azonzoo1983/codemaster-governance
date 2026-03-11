import React from 'react';
import { RequestItem } from '../../types';

interface StepRequestTypeProps {
  formData: Partial<RequestItem>;
  setFormData: (data: Partial<RequestItem>) => void;
}

export const StepRequestType: React.FC<StepRequestTypeProps> = ({ formData, setFormData }) => (
  <div className="space-y-6">
    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">What type of request is this?</h3>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <button
        onClick={() => setFormData({ ...formData, requestType: 'New', existingCode: '' })}
        className={`p-5 border-2 rounded-xl text-left transition-all ${
          formData.requestType === 'New' ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-premium ring-1 ring-blue-600/10 dark:ring-blue-500/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.requestType === 'New' ? 'border-blue-600 dark:border-blue-400' : 'border-slate-300 dark:border-slate-500'}`}>
            {formData.requestType === 'New' && <div className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400" />}
          </div>
          <span className="font-bold text-lg text-slate-900 dark:text-slate-100">New Item</span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 ml-8">Code does not exist in the system — create a new item or service code.</p>
      </button>

      <button
        onClick={() => setFormData({ ...formData, requestType: 'Amendment' })}
        className={`p-5 border-2 rounded-xl text-left transition-all ${
          formData.requestType === 'Amendment' ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-premium ring-1 ring-blue-600/10 dark:ring-blue-500/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.requestType === 'Amendment' ? 'border-blue-600 dark:border-blue-400' : 'border-slate-300 dark:border-slate-500'}`}>
            {formData.requestType === 'Amendment' && <div className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400" />}
          </div>
          <span className="font-bold text-lg text-slate-900 dark:text-slate-100">Amendment</span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 ml-8">Code exists but description requires modification.</p>
      </button>
    </div>
  </div>
);
